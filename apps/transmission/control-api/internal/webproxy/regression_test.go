package webproxy

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// TestHTTPRejectionsDoNotDrainRequestBodies covers every post-parse refusal path.
//
// A client that declares a large body but sends none must receive its response and
// lose the connection without holding a handler past the bounded assertion window.
func TestHTTPRejectionsDoNotDrainRequestBodies(testingObject *testing.T) {
	authorization := basicProxyAuthorization(testProxyUsername, testProxyPassword)
	wrongAuthorization := basicProxyAuthorization(testProxyUsername, "wrong password")

	testCases := []struct {
		name           string
		request        string
		expectedStatus int
		configure      func(*Service)
	}{
		{
			name: "missing credentials with content length",
			request: "GET http://1.1.1.1/ HTTP/1.1\r\nHost: x\r\n" +
				"Content-Length: 100000000\r\n\r\n",
			expectedStatus: http.StatusProxyAuthRequired,
		},
		{
			name: "missing credentials with chunked body",
			request: "GET http://1.1.1.1/ HTTP/1.1\r\nHost: x\r\n" +
				"Transfer-Encoding: chunked\r\nConnection: close\r\n\r\n",
			expectedStatus: http.StatusProxyAuthRequired,
		},
		{
			name: "wrong password",
			request: "GET http://1.1.1.1/ HTTP/1.1\r\nHost: x\r\nProxy-Authorization: " +
				wrongAuthorization + "\r\nContent-Length: 100000000\r\n\r\n",
			expectedStatus: http.StatusProxyAuthRequired,
		},
		{
			name: "blocked client",
			request: "GET http://1.1.1.1/ HTTP/1.1\r\nHost: x\r\nProxy-Authorization: " +
				authorization + "\r\nContent-Length: 100000000\r\n\r\n",
			expectedStatus: http.StatusTooManyRequests,
			configure: func(service *Service) {
				service.authenticator.mutex.Lock()
				service.authenticator.failures["pipe"] = loginFailureState{
					blockedUntil: time.Now().Add(time.Minute),
				}
				service.authenticator.mutex.Unlock()
			},
		},
		{
			name: "VPN unavailable",
			request: "GET http://1.1.1.1/ HTTP/1.1\r\nHost: x\r\nProxy-Authorization: " +
				authorization + "\r\nContent-Length: 100000000\r\n\r\n",
			expectedStatus: http.StatusServiceUnavailable,
			configure: func(service *Service) {
				service.vpnProtected = func() bool { return false }
			},
		},
		{
			name: "invalid request target",
			request: "GET /relative HTTP/1.1\r\nHost: x\r\nProxy-Authorization: " +
				authorization + "\r\nContent-Length: 100000000\r\n\r\n",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name: "refused destination",
			request: "GET http://1.1.1.1/ HTTP/1.1\r\nHost: x\r\nProxy-Authorization: " +
				authorization + "\r\nContent-Length: 100000000\r\n\r\n",
			expectedStatus: http.StatusForbidden,
			configure: func(service *Service) {
				service.destinationAllowed = func(net.IP) bool { return false }
			},
		},
	}

	for _, testCase := range testCases {
		testingObject.Run(testCase.name, func(testingObject *testing.T) {
			service := newProtocolTestService(testingObject)
			service.headerTimeout = 2 * time.Second
			if testCase.configure != nil {
				testCase.configure(service)
			}

			statusCode, elapsed := runHTTPRejectionWithoutBody(testingObject, service, testCase.request)
			if statusCode != testCase.expectedStatus {
				testingObject.Fatalf("response status = %d, want %d", statusCode, testCase.expectedStatus)
			}
			if elapsed > 500*time.Millisecond {
				testingObject.Fatalf("rejected request held its connection for %s", elapsed)
			}
		})
	}
}

// runHTTPRejectionWithoutBody sends headers only and waits for the handler to return.
func runHTTPRejectionWithoutBody(
	testingObject *testing.T,
	service *Service,
	requestText string,
) (int, time.Duration) {
	testingObject.Helper()

	clientConnection, serverConnection := net.Pipe()
	completed := make(chan struct{})
	startedAt := time.Now()
	go func() {
		service.handleConnection(context.Background(), serverConnection)
		_ = serverConnection.Close()
		close(completed)
	}()
	testingObject.Cleanup(func() { _ = clientConnection.Close() })

	if err := clientConnection.SetDeadline(time.Now().Add(3 * time.Second)); err != nil {
		testingObject.Fatalf("set rejected-client deadline: %v", err)
	}
	if _, err := io.WriteString(clientConnection, requestText); err != nil {
		testingObject.Fatalf("write rejected request: %v", err)
	}
	response, err := http.ReadResponse(bufio.NewReader(clientConnection), &http.Request{Method: http.MethodGet})
	if err != nil {
		testingObject.Fatalf("read rejected response: %v", err)
	}
	_, _ = io.ReadAll(response.Body)
	_ = response.Body.Close()

	select {
	case <-completed:
		return response.StatusCode, time.Since(startedAt)
	case <-time.After(500 * time.Millisecond):
		_ = clientConnection.Close()
		<-completed
		testingObject.Fatal("rejected request handler waited for the declared body")

		return 0, 0
	}
}

// TestConcurrentAuthenticationAttemptsAreReservedBeforeVerification caps one client.
//
// Fifty simultaneous wrong passwords may start at most ten verifications because each
// attempt consumes the client's budget before entering the expensive verifier.
func TestConcurrentAuthenticationAttemptsAreReservedBeforeVerification(testingObject *testing.T) {
	verificationStarted := make(chan struct{}, 50)
	releaseVerifications := make(chan struct{})
	var currentVerifications atomic.Int64
	var maximumVerifications atomic.Int64
	authentication := newAuthenticator(
		[]byte("01234567890123456789012345678901"),
		"dummy-hash",
		func(context.Context, string, string) (bool, error) {
			current := currentVerifications.Add(1)
			for {
				observed := maximumVerifications.Load()
				if current <= observed || maximumVerifications.CompareAndSwap(observed, current) {
					break
				}
			}
			verificationStarted <- struct{}{}
			<-releaseVerifications
			currentVerifications.Add(-1)

			return false, nil
		},
		time.Now,
	)
	authentication.setLogins([]Login{
		{ID: "login", Username: testProxyUsername, PasswordHash: "real-hash"},
	})

	const attempts = 50
	var group sync.WaitGroup
	for attempt := 0; attempt < attempts; attempt++ {
		group.Add(1)
		go func() {
			defer group.Done()
			_, _ = authentication.authenticate(
				context.Background(),
				testProxyUsername,
				"wrong password",
				"one-client",
			)
		}()
	}

	for started := 0; started < loginFailureLimit; started++ {
		select {
		case <-verificationStarted:
		case <-time.After(time.Second):
			close(releaseVerifications)
			group.Wait()
			testingObject.Fatalf("only %d verifications started", started)
		}
	}
	time.Sleep(25 * time.Millisecond)
	if queued := len(verificationStarted); queued != 0 {
		close(releaseVerifications)
		group.Wait()
		testingObject.Fatalf("extra verifications started = %d", queued)
	}

	close(releaseVerifications)
	group.Wait()
	if maximum := maximumVerifications.Load(); maximum != loginFailureLimit {
		testingObject.Fatalf("maximum concurrent verifications = %d, want %d", maximum, loginFailureLimit)
	}
}

// TestUnknownProxyUsernameUsesDummyVerifier prevents a username timing oracle.
//
// Even a missing username performs one check against the configured dummy hash, and a
// coincidental dummy match still cannot authenticate a nonexistent login.
func TestUnknownProxyUsernameUsesDummyVerifier(testingObject *testing.T) {
	const dummyHash = "dummy-password-hash"
	verifiedHashes := make(chan string, 1)
	authentication := newAuthenticator(
		[]byte("01234567890123456789012345678901"),
		dummyHash,
		func(_ context.Context, _ string, encodedHash string) (bool, error) {
			verifiedHashes <- encodedHash

			return true, nil
		},
		time.Now,
	)
	authentication.setLogins([]Login{
		{ID: "login", Username: testProxyUsername, PasswordHash: "real-hash"},
	})

	result, login := authentication.authenticate(
		context.Background(),
		"missing-user",
		"password",
		"client",
	)
	if result != authenticationInvalid || login.ID != "" {
		testingObject.Fatalf("unknown-user result = %v, login = %+v", result, login)
	}
	select {
	case verifiedHash := <-verifiedHashes:
		if verifiedHash != dummyHash {
			testingObject.Fatalf("unknown-user verifier hash = %q", verifiedHash)
		}
	default:
		testingObject.Fatal("unknown username skipped password verification")
	}
}

// TestHTTPAuthenticationWaitStopsAtHeaderDeadline bounds queued verification work.
//
// The verifier waits only on its context, proving the HTTP header deadline remains the
// cancellation boundary until credentials and VPN state have both been checked.
func TestHTTPAuthenticationWaitStopsAtHeaderDeadline(testingObject *testing.T) {
	service := newProtocolTestService(testingObject)
	service.headerTimeout = 50 * time.Millisecond
	service.authenticator = newAuthenticator(
		[]byte("01234567890123456789012345678901"),
		"dummy-hash",
		func(ctx context.Context, _ string, _ string) (bool, error) {
			<-ctx.Done()

			return false, ctx.Err()
		},
		time.Now,
	)
	service.authenticator.setLogins([]Login{
		{ID: "login", Username: testProxyUsername, PasswordHash: "real-hash"},
	})

	authorization := basicProxyAuthorization(testProxyUsername, testProxyPassword)
	startedAt := time.Now()
	response := runHTTPProxyRequest(
		testingObject,
		service,
		"GET http://1.1.1.1/ HTTP/1.1\r\nHost: x\r\nProxy-Authorization: "+
			authorization+"\r\nConnection: close\r\n\r\n",
	)
	defer response.Body.Close()
	if response.StatusCode != http.StatusProxyAuthRequired {
		testingObject.Fatalf("timed-out authentication status = %d", response.StatusCode)
	}
	if elapsed := time.Since(startedAt); elapsed > 500*time.Millisecond {
		testingObject.Fatalf("authentication wait stopped after %s", elapsed)
	}
}

// TestSuccessfulAuthenticationClearsOnlyItsClientKey isolates failure budgets.
//
// A correct password from one device must not erase failures accumulated by another
// address, even when both devices use the same proxy login.
func TestSuccessfulAuthenticationClearsOnlyItsClientKey(testingObject *testing.T) {
	authentication := newAuthenticator(
		[]byte("01234567890123456789012345678901"),
		"dummy-hash",
		func(_ context.Context, password string, _ string) (bool, error) {
			return password == testProxyPassword, nil
		},
		time.Now,
	)
	authentication.setLogins([]Login{
		{ID: "login", Username: testProxyUsername, PasswordHash: "real-hash"},
	})

	for _, clientKey := range []string{"client-a", "client-b"} {
		result, _ := authentication.authenticate(
			context.Background(),
			testProxyUsername,
			"wrong password",
			clientKey,
		)
		if result != authenticationInvalid {
			testingObject.Fatalf("%s wrong-password result = %v", clientKey, result)
		}
	}
	result, _ := authentication.authenticate(
		context.Background(),
		testProxyUsername,
		testProxyPassword,
		"client-a",
	)
	if result != authenticationAllowed {
		testingObject.Fatalf("correct-password result = %v", result)
	}

	authentication.mutex.Lock()
	_, firstFound := authentication.failures["client-a"]
	secondState, secondFound := authentication.failures["client-b"]
	authentication.mutex.Unlock()
	if firstFound || !secondFound || len(secondState.failures) != 1 {
		testingObject.Fatalf(
			"failure states after success: client-a found=%t, client-b=%+v found=%t",
			firstFound,
			secondState,
			secondFound,
		)
	}
}

// TestClientLimitKeyUsesCompleteIPv6Address keeps private clients independent.
//
// Link-local and unique-local addresses retain every address bit instead of sharing a
// broad delegated prefix that lets one device block its neighbors.
func TestClientLimitKeyUsesCompleteIPv6Address(testingObject *testing.T) {
	testCases := []struct {
		name   string
		first  string
		second string
	}{
		{name: "link local", first: "fe80::1", second: "fe80::aaaa:bbbb:cccc:dddd"},
		{name: "unique local", first: "fd12:3456:789a::1", second: "fd12:3456:789a:ff00::1"},
	}

	for _, testCase := range testCases {
		testingObject.Run(testCase.name, func(testingObject *testing.T) {
			firstKey := clientLimitKey(&net.TCPAddr{IP: net.ParseIP(testCase.first), Zone: "eth0"})
			secondKey := clientLimitKey(&net.TCPAddr{IP: net.ParseIP(testCase.second), Zone: "eth1"})
			if firstKey == secondKey || firstKey != testCase.first || secondKey != testCase.second {
				testingObject.Fatalf("client keys = %q and %q", firstKey, secondKey)
			}
		})
	}
}

// TestHTTPRequestBodyForcesConnectionClose prevents shared-reader concurrency.
//
// An upstream may answer before the transport finishes reading the request body. The
// proxy returns that response, then closes instead of parsing a pipelined request.
func TestHTTPRequestBodyForcesConnectionClose(testingObject *testing.T) {
	service := newProtocolTestService(testingObject)
	service.rawDialContext = func(context.Context, string, string) (net.Conn, error) {
		transportConnection, upstreamConnection := net.Pipe()
		go func() {
			defer upstreamConnection.Close()
			reader := bufio.NewReader(upstreamConnection)
			for {
				line, err := reader.ReadString('\n')
				if err != nil {
					return
				}
				if line == "\r\n" {
					break
				}
			}
			_, _ = io.WriteString(
				upstreamConnection,
				"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok",
			)
			_, _ = io.Copy(io.Discard, reader)
		}()

		return transportConnection, nil
	}

	clientConnection, serverConnection := net.Pipe()
	completed := make(chan struct{})
	go func() {
		service.handleConnection(context.Background(), serverConnection)
		_ = serverConnection.Close()
		close(completed)
	}()
	defer clientConnection.Close()
	if err := clientConnection.SetDeadline(time.Now().Add(3 * time.Second)); err != nil {
		testingObject.Fatalf("set client deadline: %v", err)
	}

	authorization := basicProxyAuthorization(testProxyUsername, testProxyPassword)
	requestStart := "POST http://1.1.1.1/ HTTP/1.1\r\nHost: x\r\nProxy-Authorization: " +
		authorization + "\r\nContent-Length: 20\r\n\r\n0123456789"
	if _, err := io.WriteString(clientConnection, requestStart); err != nil {
		testingObject.Fatalf("write partial request body: %v", err)
	}

	reader := bufio.NewReader(clientConnection)
	response, err := http.ReadResponse(reader, &http.Request{Method: http.MethodPost})
	if err != nil {
		testingObject.Fatalf("read early upstream response: %v", err)
	}
	body, err := io.ReadAll(response.Body)
	_ = response.Body.Close()
	if err != nil || response.StatusCode != http.StatusOK || string(body) != "ok" {
		testingObject.Fatalf("early upstream response = %d %q, %v", response.StatusCode, body, err)
	}

	secondRequest := "abcdefghijGET http://1.1.1.1/second HTTP/1.1\r\nHost: x\r\n" +
		"Proxy-Authorization: " + authorization + "\r\n\r\n"
	_, _ = io.WriteString(clientConnection, secondRequest)
	if _, err := reader.ReadByte(); !errors.Is(err, io.EOF) {
		testingObject.Fatalf("body request connection read = %v, want EOF", err)
	}
	select {
	case <-completed:
	case <-time.After(time.Second):
		testingObject.Fatal("body request handler did not close")
	}
}

// TestAcceptLoopRecoversConnectionPanic isolates a bad client goroutine.
//
// A deliberate panic during the first connection must be logged and cleaned up while
// the same accept loop remains available to serve a second client.
func TestAcceptLoopRecoversConnectionPanic(testingObject *testing.T) {
	service := newProtocolTestService(testingObject)
	var clientChecks atomic.Int64
	service.clientAllowed = func(net.Addr) bool {
		if clientChecks.Add(1) == 1 {
			panic("deliberate connection panic")
		}

		return true
	}

	listener := newQueuedListener()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	acceptCompleted := make(chan struct{})
	go func() {
		service.acceptLoop(ctx, listener)
		close(acceptCompleted)
	}()

	// Set deadlines before queueing: the handler may panic and close its end first,
	// and net.Pipe refuses deadline changes once either end is closed.
	firstClient, firstServer := net.Pipe()
	if err := firstClient.SetReadDeadline(time.Now().Add(time.Second)); err != nil {
		testingObject.Fatalf("set first panic-client deadline: %v", err)
	}
	listener.connections <- firstServer
	if _, err := firstClient.Read(make([]byte, 1)); !errors.Is(err, io.EOF) {
		testingObject.Fatalf("panic connection read = %v, want EOF", err)
	}
	_ = firstClient.Close()

	secondClient, secondServer := net.Pipe()
	if err := secondClient.SetDeadline(time.Now().Add(time.Second)); err != nil {
		testingObject.Fatalf("set second panic-client deadline: %v", err)
	}
	listener.connections <- secondServer
	if _, err := io.WriteString(secondClient, "GET http://1.1.1.1/ HTTP/1.1\r\nHost: x\r\n\r\n"); err != nil {
		testingObject.Fatalf("write request after panic: %v", err)
	}
	response, err := http.ReadResponse(bufio.NewReader(secondClient), &http.Request{Method: http.MethodGet})
	if err != nil {
		testingObject.Fatalf("read response after panic: %v", err)
	}
	_ = response.Body.Close()
	if response.StatusCode != http.StatusProxyAuthRequired {
		testingObject.Fatalf("response after panic = %d", response.StatusCode)
	}
	_ = secondClient.Close()

	_ = listener.Close()
	select {
	case <-acceptCompleted:
	case <-time.After(time.Second):
		testingObject.Fatal("accept loop did not stop")
	}
	service.connectionGroup.Wait()
}

// TestEnsureHTTPHeaderScalesWithOneByteReads guards the linear scan boundary.
//
// Delivering a maximum-sized header one byte at a time stays comfortably below the
// former whole-buffer-rescan cost while retaining the exact 64 KiB limit.
func TestEnsureHTTPHeaderScalesWithOneByteReads(testingObject *testing.T) {
	content := []byte(strings.Repeat("x", maximumHeaderBytes-4) + "\r\n\r\n")
	reader := bufio.NewReaderSize(&oneByteReader{content: content}, maximumHeaderBytes+1)

	startedAt := time.Now()
	if err := ensureHTTPHeader(reader); err != nil {
		testingObject.Fatalf("scan one-byte header: %v", err)
	}
	if elapsed := time.Since(startedAt); elapsed > time.Second {
		testingObject.Fatalf("one-byte header scan took %s", elapsed)
	}
}

// TestHTTPHeaderScannerAcceptsLFOnlyRequests matches net/http parsing behavior.
//
// Go accepts request lines terminated only by LF, so the bounded pre-scan must find the
// same header ending instead of holding a valid request until its deadline.
func TestHTTPHeaderScannerAcceptsLFOnlyRequests(testingObject *testing.T) {
	service := newProtocolTestService(testingObject)
	service.vpnProtected = func() bool { return false }
	authorization := basicProxyAuthorization(testProxyUsername, testProxyPassword)
	response := runHTTPProxyRequest(
		testingObject,
		service,
		"GET http://1.1.1.1/ HTTP/1.1\nHost: x\nProxy-Authorization: "+authorization+"\n\n",
	)
	defer response.Body.Close()
	if response.StatusCode != http.StatusServiceUnavailable {
		testingObject.Fatalf("LF-only response status = %d", response.StatusCode)
	}
}

// TestPerClientConnectionLimitPreservesGlobalCapacity caps one address at 256.
//
// The test lowers the configurable test boundary to two sockets, then proves a third
// connection from the same key is closed before it can consume a handler.
func TestPerClientConnectionLimitPreservesGlobalCapacity(testingObject *testing.T) {
	if maximumClientConnections != 256 {
		testingObject.Fatalf("default per-client connection limit = %d", maximumClientConnections)
	}

	service := newProtocolTestService(testingObject)
	service.clientConnectionLimit = 2
	listener := newQueuedListener()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	acceptCompleted := make(chan struct{})
	go func() {
		service.acceptLoop(ctx, listener)
		close(acceptCompleted)
	}()

	clients := make([]net.Conn, 0, 2)
	for range 2 {
		clientConnection, serverConnection := net.Pipe()
		clients = append(clients, clientConnection)
		listener.connections <- serverConnection
	}
	waitForClientConnectionCount(testingObject, service, "pipe", 2)

	thirdClient, thirdServer := net.Pipe()
	listener.connections <- thirdServer
	if err := thirdClient.SetReadDeadline(time.Now().Add(time.Second)); err != nil {
		testingObject.Fatalf("set limited-client deadline: %v", err)
	}
	if _, err := thirdClient.Read(make([]byte, 1)); !errors.Is(err, io.EOF) {
		testingObject.Fatalf("over-limit connection read = %v, want EOF", err)
	}
	_ = thirdClient.Close()

	for _, connection := range clients {
		_ = connection.Close()
	}
	waitForClientConnectionCount(testingObject, service, "pipe", 0)
	_ = listener.Close()
	select {
	case <-acceptCompleted:
	case <-time.After(time.Second):
		testingObject.Fatal("limited accept loop did not stop")
	}
	service.connectionGroup.Wait()
}

// oneByteReader returns exactly one byte for every Read call.
type oneByteReader struct {
	content []byte
}

// Read copies one remaining byte so header scanning sees the worst fragmentation.
func (reader *oneByteReader) Read(content []byte) (int, error) {
	if len(reader.content) == 0 {
		return 0, io.EOF
	}
	content[0] = reader.content[0]
	reader.content = reader.content[1:]

	return 1, nil
}

// queuedListener returns test connections supplied through a channel.
type queuedListener struct {
	connections chan net.Conn
	closed      chan struct{}
	closeOnce   sync.Once
}

// newQueuedListener creates an open listener for deterministic accept-loop tests.
func newQueuedListener() *queuedListener {
	return &queuedListener{
		connections: make(chan net.Conn),
		closed:      make(chan struct{}),
	}
}

// Accept waits for the next supplied connection or listener closure.
func (listener *queuedListener) Accept() (net.Conn, error) {
	select {
	case connection := <-listener.connections:
		return connection, nil
	case <-listener.closed:
		return nil, net.ErrClosed
	}
}

// Close releases a blocked Accept call exactly once.
func (listener *queuedListener) Close() error {
	listener.closeOnce.Do(func() { close(listener.closed) })

	return nil
}

// Addr returns a stable address for diagnostics.
func (listener *queuedListener) Addr() net.Addr {
	return testAddress("queued-listener")
}

// waitForClientConnectionCount waits for one per-client accounting transition.
func waitForClientConnectionCount(
	testingObject *testing.T,
	service *Service,
	clientKey string,
	expected int,
) {
	testingObject.Helper()

	deadline := time.Now().Add(time.Second)
	for {
		service.mutex.Lock()
		count := service.connectionsByClient[clientKey]
		service.mutex.Unlock()
		if count == expected {
			return
		}
		if time.Now().After(deadline) {
			testingObject.Fatalf("client connection count = %d, want %d", count, expected)
		}

		time.Sleep(time.Millisecond)
	}
}

// TestHTTPTransportTimeoutsBoundUpstreamWaiting verifies production timeout values.
//
// Response headers may take at most 60 seconds, and pooled upstream connections are
// discarded after 90 idle seconds instead of keeping resources indefinitely.
func TestHTTPTransportTimeoutsBoundUpstreamWaiting(testingObject *testing.T) {
	service := newProtocolTestService(testingObject)
	if service.transport.ResponseHeaderTimeout != 60*time.Second {
		testingObject.Fatalf(
			"response header timeout = %s",
			service.transport.ResponseHeaderTimeout,
		)
	}
	if service.transport.IdleConnTimeout != 90*time.Second {
		testingObject.Fatalf("idle connection timeout = %s", service.transport.IdleConnTimeout)
	}

	service.transport.ResponseHeaderTimeout = 50 * time.Millisecond
	var upstreamPeer net.Conn
	service.rawDialContext = func(context.Context, string, string) (net.Conn, error) {
		transportConnection, peerConnection := net.Pipe()
		upstreamPeer = peerConnection
		go func() { _, _ = io.Copy(io.Discard, peerConnection) }()

		return transportConnection, nil
	}
	defer func() {
		if upstreamPeer != nil {
			_ = upstreamPeer.Close()
		}
	}()

	authorization := basicProxyAuthorization(testProxyUsername, testProxyPassword)
	startedAt := time.Now()
	response := runHTTPProxyRequest(
		testingObject,
		service,
		"GET http://1.1.1.1/ HTTP/1.1\r\nHost: x\r\nProxy-Authorization: "+
			authorization+"\r\nConnection: close\r\n\r\n",
	)
	defer response.Body.Close()
	if response.StatusCode != http.StatusBadGateway {
		testingObject.Fatalf("response-header timeout status = %d", response.StatusCode)
	}
	if elapsed := time.Since(startedAt); elapsed > time.Second {
		testingObject.Fatalf("response-header timeout returned after %s", elapsed)
	}
}

// TestHTTPResponseWriteDeadlineReleasesStoppedReader bounds downstream backpressure.
//
// A client that sends a valid request and then stops reading cannot hold its connection
// slot longer than the configured no-progress write interval.
func TestHTTPResponseWriteDeadlineReleasesStoppedReader(testingObject *testing.T) {
	service := newProtocolTestService(testingObject)
	service.writeTimeout = 50 * time.Millisecond
	service.rawDialContext = func(context.Context, string, string) (net.Conn, error) {
		transportConnection, upstreamConnection := net.Pipe()
		go func() {
			defer upstreamConnection.Close()
			reader := bufio.NewReader(upstreamConnection)
			for {
				line, err := reader.ReadString('\n')
				if err != nil {
					return
				}
				if line == "\r\n" {
					break
				}
			}
			_, _ = io.WriteString(
				upstreamConnection,
				"HTTP/1.1 200 OK\r\nContent-Length: 1048576\r\n\r\n"+
					strings.Repeat("x", 1024*1024),
			)
		}()

		return transportConnection, nil
	}

	clientConnection, serverConnection := net.Pipe()
	completed := make(chan struct{})
	go func() {
		service.handleConnection(context.Background(), serverConnection)
		_ = serverConnection.Close()
		close(completed)
	}()
	defer clientConnection.Close()

	authorization := basicProxyAuthorization(testProxyUsername, testProxyPassword)
	requestText := "GET http://1.1.1.1/ HTTP/1.1\r\nHost: x\r\nProxy-Authorization: " +
		authorization + "\r\nConnection: close\r\n\r\n"
	if _, err := io.WriteString(clientConnection, requestText); err != nil {
		testingObject.Fatalf("write stopped-reader request: %v", err)
	}

	select {
	case <-completed:
	case <-time.After(time.Second):
		testingObject.Fatal("stopped response reader held the handler")
	}
}

// TestConfigurationReloadClosesInvalidatedLoginConnections covers removal and re-keying.
//
// Established CONNECT tunnels are tied to the login identifier and hash that opened
// them, so a reload revokes access immediately instead of waiting for socket closure.
func TestConfigurationReloadClosesInvalidatedLoginConnections(testingObject *testing.T) {
	testCases := []struct {
		name   string
		logins []Login
	}{
		{
			name: "login removed",
			logins: []Login{
				{ID: "replacement", Username: "replacement", PasswordHash: "replacement-hash"},
			},
		},
		{
			name: "password hash changed",
			logins: []Login{
				{ID: "active-login", Username: testProxyUsername, PasswordHash: "new-hash"},
			},
		},
	}

	for _, testCase := range testCases {
		testingObject.Run(testCase.name, func(testingObject *testing.T) {
			service := newProtocolTestService(testingObject)
			listener := newQueuedListener()
			service.listen = func(string, string) (net.Listener, error) { return listener, nil }

			var destinationPeer net.Conn
			service.rawDialContext = func(context.Context, string, string) (net.Conn, error) {
				destinationConnection, peerConnection := net.Pipe()
				destinationPeer = peerConnection

				return destinationConnection, nil
			}
			defer func() {
				if destinationPeer != nil {
					_ = destinationPeer.Close()
				}
			}()

			initialConfiguration := RuntimeConfig{
				Enabled: true,
				Logins: []Login{
					{ID: "active-login", Username: testProxyUsername, PasswordHash: "old-hash"},
				},
			}
			writeRuntimeConfig(testingObject, service.config.ConfigPath, initialConfiguration)
			if err := service.reloadConfiguration(context.Background()); err != nil {
				testingObject.Fatalf("load initial proxy configuration: %v", err)
			}
			defer service.shutdown()

			clientConnection, serverConnection := net.Pipe()
			listener.connections <- serverConnection
			if err := clientConnection.SetDeadline(time.Now().Add(2 * time.Second)); err != nil {
				testingObject.Fatalf("set revocation-client deadline: %v", err)
			}
			authorization := basicProxyAuthorization(testProxyUsername, testProxyPassword)
			if _, err := io.WriteString(
				clientConnection,
				"CONNECT 1.1.1.1:443 HTTP/1.1\r\nHost: 1.1.1.1:443\r\nProxy-Authorization: "+
					authorization+"\r\n\r\n",
			); err != nil {
				testingObject.Fatalf("write revocable CONNECT: %v", err)
			}
			reader := bufio.NewReader(clientConnection)
			response, err := http.ReadResponse(reader, &http.Request{Method: http.MethodConnect})
			if err != nil {
				testingObject.Fatalf("read revocable CONNECT response: %v", err)
			}
			_ = response.Body.Close()
			if response.StatusCode != http.StatusOK {
				testingObject.Fatalf("revocable CONNECT status = %d", response.StatusCode)
			}

			writeRuntimeConfig(testingObject, service.config.ConfigPath, RuntimeConfig{
				Enabled: true,
				Logins:  testCase.logins,
			})
			if err := service.reloadConfiguration(context.Background()); err != nil {
				testingObject.Fatalf("reload invalidating proxy configuration: %v", err)
			}
			if _, err := reader.ReadByte(); !errors.Is(err, io.EOF) {
				testingObject.Fatalf("invalidated tunnel read = %v, want EOF", err)
			}
			_ = clientConnection.Close()
		})
	}
}

// TestHTTP10ResponseDoesNotUseChunkedFraming preserves legacy client compatibility.
//
// A chunked HTTP/1.1 upstream body is decoded and sent to an HTTP/1.0 client as an
// EOF-delimited response without a Transfer-Encoding field.
func TestHTTP10ResponseDoesNotUseChunkedFraming(testingObject *testing.T) {
	service := newProtocolTestService(testingObject)
	service.rawDialContext = func(context.Context, string, string) (net.Conn, error) {
		transportConnection, upstreamConnection := net.Pipe()
		go func() {
			defer upstreamConnection.Close()
			reader := bufio.NewReader(upstreamConnection)
			for {
				line, err := reader.ReadString('\n')
				if err != nil {
					return
				}
				if line == "\r\n" {
					break
				}
			}
			_, _ = io.WriteString(
				upstreamConnection,
				"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n2\r\nok\r\n0\r\n\r\n",
			)
		}()

		return transportConnection, nil
	}

	clientConnection, serverConnection := net.Pipe()
	completed := make(chan struct{})
	go func() {
		service.handleConnection(context.Background(), serverConnection)
		_ = serverConnection.Close()
		close(completed)
	}()
	defer clientConnection.Close()
	if err := clientConnection.SetDeadline(time.Now().Add(2 * time.Second)); err != nil {
		testingObject.Fatalf("set HTTP/1.0 client deadline: %v", err)
	}

	authorization := basicProxyAuthorization(testProxyUsername, testProxyPassword)
	if _, err := io.WriteString(
		clientConnection,
		"GET http://1.1.1.1/ HTTP/1.0\r\nHost: x\r\nProxy-Authorization: "+authorization+"\r\n\r\n",
	); err != nil {
		testingObject.Fatalf("write HTTP/1.0 request: %v", err)
	}
	reader := bufio.NewReader(clientConnection)
	statusLine, err := reader.ReadString('\n')
	if err != nil || !strings.HasPrefix(statusLine, "HTTP/1.0 200 ") {
		testingObject.Fatalf("HTTP/1.0 status line = %q, %v", statusLine, err)
	}
	for {
		line, readError := reader.ReadString('\n')
		if readError != nil {
			testingObject.Fatalf("read HTTP/1.0 headers: %v", readError)
		}
		if strings.HasPrefix(strings.ToLower(line), "transfer-encoding:") {
			testingObject.Fatalf("HTTP/1.0 response used transfer encoding: %q", line)
		}
		if line == "\r\n" {
			break
		}
	}
	body, err := io.ReadAll(reader)
	if err != nil || !bytes.Equal(body, []byte("ok")) {
		testingObject.Fatalf("HTTP/1.0 body = %q, %v", body, err)
	}
	select {
	case <-completed:
	case <-time.After(time.Second):
		testingObject.Fatal("HTTP/1.0 handler did not close")
	}
}

// TestSOCKS5DNSFailureReportsHostUnreachable maps name lookup failures to RFC 1928.
//
// DNS resolution failure identifies an unreachable host, not a refused destination
// connection, so clients receive reply code 0x04.
func TestSOCKS5DNSFailureReportsHostUnreachable(testingObject *testing.T) {
	dnsError := &net.DNSError{Err: "no such host", Name: "missing.example", IsNotFound: true}
	reply := socksReplyForError(fmt.Errorf("resolve destination: %w", dnsError))
	if reply != socksReplyHostUnreachable {
		testingObject.Fatalf("DNS failure SOCKS5 reply = %#x", reply)
	}
}

// TestSOCKS5SlowDialRenewsClientDeadlineBeforeReply separates timeout phases.
//
// A destination dial may outlast the handshake interval and still return a success
// reply because the dial owns its timeout and the client deadline is renewed afterward.
func TestSOCKS5SlowDialRenewsClientDeadlineBeforeReply(testingObject *testing.T) {
	service := newProtocolTestService(testingObject)
	service.socksTimeout = 50 * time.Millisecond
	var destinationPeer net.Conn
	service.rawDialContext = func(context.Context, string, string) (net.Conn, error) {
		time.Sleep(100 * time.Millisecond)
		destinationConnection, peerConnection := net.Pipe()
		destinationPeer = peerConnection

		return destinationConnection, nil
	}
	defer func() {
		if destinationPeer != nil {
			_ = destinationPeer.Close()
		}
	}()

	withProxyConnection(testingObject, service, func(connection net.Conn, reader *bufio.Reader) {
		performSOCKSAuthentication(testingObject, connection, reader)
		request := []byte{
			socksVersion,
			socksCommandConnect,
			0x00,
			socksAddressIPv4,
			1,
			1,
			1,
			1,
			0,
			80,
		}
		if _, err := connection.Write(request); err != nil {
			testingObject.Fatalf("write slow-dial SOCKS5 request: %v", err)
		}
		reply := make([]byte, 10)
		if _, err := io.ReadFull(reader, reply); err != nil {
			testingObject.Fatalf("read slow-dial SOCKS5 reply: %v", err)
		}
		if reply[1] != socksReplySucceeded {
			testingObject.Fatalf("slow-dial SOCKS5 reply = %v", reply)
		}
	})
}
