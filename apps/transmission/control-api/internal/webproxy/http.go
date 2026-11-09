package webproxy

import (
	"bufio"
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	maximumHeaderBytes = 64 * 1024
	proxyRealm         = `Basic realm="Transmission VPN web proxy"`
)

var errHeadersTooLarge = errors.New("HTTP headers exceed 64 KiB")

// handleHTTP serves CONNECT tunnels and absolute-form HTTP requests on one connection.
func (service *Service) handleHTTP(
	ctx context.Context,
	connection net.Conn,
	reader *bufio.Reader,
	clientKey string,
) {
	waitingForNextRequest := false
	for {
		headerDeadline, err := service.awaitHTTPHeader(connection, reader, waitingForNextRequest)
		if err != nil {
			if errors.Is(err, errHeadersTooLarge) {
				service.writeHTTPFailure(connection, http.StatusRequestHeaderFieldsTooLarge, "Request headers are too large.", nil)
			}

			return
		}
		request, err := http.ReadRequest(reader)
		if err != nil {
			if !errors.Is(err, io.EOF) {
				service.writeHTTPFailure(connection, http.StatusBadRequest, "Bad request.", nil)
			}

			return
		}

		username, password, supplied := proxyBasicCredentials(request.Header.Get("Proxy-Authorization"))
		if service.authenticator.blocked(clientKey) {
			service.writeHTTPFailure(
				connection,
				http.StatusTooManyRequests,
				"Too many failed logins. Try again later.",
				map[string]string{"Retry-After": strconv.Itoa(int(loginBlockDuration.Seconds()))},
			)

			return
		}
		if !supplied {
			service.writeProxyAuthenticationRequired(connection)

			return
		}

		authenticationContext, cancelAuthentication := context.WithDeadline(ctx, headerDeadline)
		authentication, login := service.authenticator.authenticate(
			authenticationContext,
			username,
			password,
			clientKey,
		)
		cancelAuthentication()
		if authentication == authenticationBlocked {
			service.writeHTTPFailure(
				connection,
				http.StatusTooManyRequests,
				"Too many failed logins. Try again later.",
				map[string]string{"Retry-After": strconv.Itoa(int(loginBlockDuration.Seconds()))},
			)

			return
		}
		if authentication != authenticationAllowed {
			service.writeProxyAuthenticationRequired(connection)

			return
		}

		if _, protected := service.routeForLogin(login); !protected {
			service.writeHTTPFailure(connection, http.StatusServiceUnavailable, "The VPN isn't connected", nil)

			return
		}
		if !service.linkConnection(connection, login) {
			return
		}
		if err := connection.SetReadDeadline(time.Time{}); err != nil {
			return
		}

		if request.Method == http.MethodConnect {
			service.handleHTTPConnect(ctx, connection, reader, request, login)

			return
		}

		if !request.URL.IsAbs() || request.URL.Scheme != "http" || request.URL.Host == "" {
			service.writeHTTPFailure(connection, http.StatusBadRequest, "Use an absolute http:// URL.", nil)

			return
		}

		clientWantsClose := request.Close
		requestHasBody := request.ContentLength != 0 || len(request.TransferEncoding) > 0
		if requestHasBody {
			request.Body = &nonDrainingRequestBody{Reader: request.Body}
		}
		stripHopByHopHeaders(request.Header)
		request.Close = false
		request.RequestURI = ""
		request = request.WithContext(context.WithValue(ctx, outboundLoginContextKey{}, login))

		response, err := service.transportForLogin(login).RoundTrip(request)
		if err != nil {
			service.writeHTTPDialFailure(connection, err)

			return
		}
		stripHopByHopHeaders(response.Header)
		prepareHTTPResponse(response, request)

		writeError := service.writeHTTPResponse(connection, response)
		closeError := response.Body.Close()
		if writeError != nil || closeError != nil {
			return
		}
		if clientWantsClose || requestHasBody || response.Close {
			return
		}

		waitingForNextRequest = true
	}
}

// awaitHTTPHeader applies the idle and per-request limits before parsing a header.
func (service *Service) awaitHTTPHeader(
	connection net.Conn,
	reader *bufio.Reader,
	waitingForNextRequest bool,
) (time.Time, error) {
	if waitingForNextRequest && reader.Buffered() == 0 {
		if err := connection.SetReadDeadline(service.clock().Add(service.keepAliveTimeout)); err != nil {
			return time.Time{}, err
		}
		if _, err := reader.Peek(1); err != nil {
			return time.Time{}, err
		}
	}

	headerDeadline := service.clock().Add(service.headerTimeout)
	if err := connection.SetReadDeadline(headerDeadline); err != nil {
		return time.Time{}, err
	}

	return headerDeadline, ensureHTTPHeader(reader)
}

// handleHTTPConnect opens one guarded destination and then switches to a raw tunnel.
func (service *Service) handleHTTPConnect(
	ctx context.Context,
	connection net.Conn,
	reader *bufio.Reader,
	request *http.Request,
	login Login,
) {
	target := request.URL.Host
	if target == "" {
		target = request.Host
	}
	if _, _, err := net.SplitHostPort(target); err != nil {
		service.writeHTTPFailure(connection, http.StatusBadRequest, "CONNECT requires host:port.", nil)

		return
	}

	destination, err := service.dialGuardedForLogin(ctx, login, "tcp", target)
	if err != nil {
		service.writeHTTPDialFailure(connection, err)

		return
	}

	writer := service.newHTTPResponseWriter(connection)
	if _, err := writer.WriteString("HTTP/1.1 200 Connection Established\r\n\r\n"); err != nil {
		_ = destination.Close()

		return
	}
	if err := writer.Flush(); err != nil {
		_ = destination.Close()

		return
	}

	client := &bufferedConnection{Conn: connection, reader: reader}
	copyTunnel(client, destination)
}

// writeHTTPDialFailure maps guarded-dial refusals to the public proxy contract.
func (service *Service) writeHTTPDialFailure(connection net.Conn, err error) {
	switch {
	case errors.Is(err, errVPNNotProtected):
		service.writeHTTPFailure(connection, http.StatusServiceUnavailable, "The VPN isn't connected", nil)
	case errors.Is(err, errDestinationNotAllowed), errors.Is(err, errUnsupportedAddress):
		service.writeHTTPFailure(connection, http.StatusForbidden, "Destination not allowed", nil)
	default:
		service.writeHTTPFailure(connection, http.StatusBadGateway, "The destination could not be reached.", nil)
	}
}

// ensureHTTPHeader fills the shared reader until one complete bounded header is present.
func ensureHTTPHeader(reader *bufio.Reader) error {
	searchStart := 0
	for {
		bufferedBytes := reader.Buffered()
		if bufferedBytes > searchStart {
			content, err := reader.Peek(bufferedBytes)
			if err != nil {
				return err
			}
			if headerEnd := httpHeaderEnd(content[searchStart:]); headerEnd >= 0 {
				headerEnd += searchStart
				if headerEnd > maximumHeaderBytes {
					return errHeadersTooLarge
				}

				return nil
			}
		}
		if bufferedBytes >= maximumHeaderBytes {
			return errHeadersTooLarge
		}
		if _, err := reader.Peek(bufferedBytes + 1); err != nil {
			return err
		}
		searchStart = max(0, bufferedBytes-3)
	}
}

// httpHeaderEnd finds the first CRLF or LF-only header terminator.
func httpHeaderEnd(content []byte) int {
	carriageReturnEnd := bytes.Index(content, []byte("\r\n\r\n"))
	lineFeedEnd := bytes.Index(content, []byte("\n\n"))
	if carriageReturnEnd >= 0 && (lineFeedEnd < 0 || carriageReturnEnd < lineFeedEnd) {
		return carriageReturnEnd + 4
	}
	if lineFeedEnd >= 0 {
		return lineFeedEnd + 2
	}

	return -1
}

// prepareHTTPResponse matches downstream framing to the client's protocol version.
func prepareHTTPResponse(response *http.Response, request *http.Request) {
	response.Proto = request.Proto
	response.ProtoMajor = request.ProtoMajor
	response.ProtoMinor = request.ProtoMinor
	if request.ProtoMajor == 1 && request.ProtoMinor == 0 {
		response.TransferEncoding = nil
		if response.ContentLength < 0 {
			response.Close = true
		}
	}
}

// proxyBasicCredentials decodes one Proxy-Authorization Basic value.
func proxyBasicCredentials(value string) (string, string, bool) {
	scheme, encoded, found := strings.Cut(strings.TrimSpace(value), " ")
	if !found || !strings.EqualFold(scheme, "Basic") || encoded == "" {
		return "", "", false
	}

	decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(encoded))
	if err != nil {
		return "", "", true
	}
	username, password, found := strings.Cut(string(decoded), ":")
	if !found {
		return "", "", true
	}

	return username, password, true
}

// stripHopByHopHeaders removes fixed and Connection-nominated transport headers.
func stripHopByHopHeaders(header http.Header) {
	for _, connectionValue := range header.Values("Connection") {
		for _, token := range strings.Split(connectionValue, ",") {
			header.Del(strings.TrimSpace(token))
		}
	}

	hopByHopHeaders := []string{
		"Connection",
		"Keep-Alive",
		"Proxy-Authenticate",
		"Proxy-Authorization",
		"Proxy-Connection",
		"Te",
		"Trailer",
		"Transfer-Encoding",
		"Upgrade",
	}
	for _, name := range hopByHopHeaders {
		header.Del(name)
	}
}

// writeProxyAuthenticationRequired sends the fixed Basic proxy challenge.
func (service *Service) writeProxyAuthenticationRequired(connection net.Conn) {
	service.writeHTTPFailure(
		connection,
		http.StatusProxyAuthRequired,
		"Proxy authentication required.",
		map[string]string{"Proxy-Authenticate": proxyRealm},
	)
}

// writeHTTPFailure writes one small non-cacheable response and closes the request path.
func (service *Service) writeHTTPFailure(
	connection net.Conn,
	statusCode int,
	message string,
	headers map[string]string,
) {
	body := message + "\n"
	response := &http.Response{
		Status:        fmt.Sprintf("%d %s", statusCode, http.StatusText(statusCode)),
		StatusCode:    statusCode,
		Proto:         "HTTP/1.1",
		ProtoMajor:    1,
		ProtoMinor:    1,
		Header:        make(http.Header),
		Body:          io.NopCloser(strings.NewReader(body)),
		ContentLength: int64(len(body)),
		Close:         true,
	}
	response.Header.Set("Cache-Control", "no-store")
	response.Header.Set("Content-Type", "text/plain; charset=utf-8")
	for name, value := range headers {
		response.Header.Set(name, value)
	}

	_ = service.writeHTTPResponse(connection, response)
	_ = response.Body.Close()
}

// writeHTTPResponse serializes one response with a bounded no-progress interval.
func (service *Service) writeHTTPResponse(connection net.Conn, response *http.Response) error {
	writer := service.newHTTPResponseWriter(connection)
	if err := response.Write(writer); err != nil {
		return err
	}

	return writer.Flush()
}

// newHTTPResponseWriter refreshes the socket write deadline after every successful write.
func (service *Service) newHTTPResponseWriter(connection net.Conn) *bufio.Writer {
	return bufio.NewWriter(&progressDeadlineWriter{
		connection: connection,
		timeout:    service.writeTimeout,
		clock:      service.clock,
	})
}

// progressDeadlineWriter ends a response after sixty seconds without write progress.
type progressDeadlineWriter struct {
	connection net.Conn
	timeout    time.Duration
	clock      func() time.Time
}

// Write refreshes the no-progress deadline before and after a socket write.
func (writer *progressDeadlineWriter) Write(content []byte) (int, error) {
	if err := writer.connection.SetWriteDeadline(writer.clock().Add(writer.timeout)); err != nil {
		return 0, err
	}

	written, err := writer.connection.Write(content)
	if written > 0 {
		deadlineError := writer.connection.SetWriteDeadline(writer.clock().Add(writer.timeout))
		if err == nil {
			err = deadlineError
		}
	}

	return written, err
}

// nonDrainingRequestBody lets the transport close a rejected upload without reading it.
//
// The client socket closes with the handler, which releases any transport read still
// waiting after an upstream sent an early response.
type nonDrainingRequestBody struct {
	io.Reader
}

// Close deliberately leaves unread downstream bytes for connection teardown.
func (body *nonDrainingRequestBody) Close() error {
	return nil
}
