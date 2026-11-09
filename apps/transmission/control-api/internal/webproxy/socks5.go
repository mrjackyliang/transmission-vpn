package webproxy

import (
	"bufio"
	"context"
	"encoding/binary"
	"errors"
	"io"
	"net"
	"strconv"
	"time"
)

const (
	socksVersion          = 0x05
	socksUsernamePassword = 0x02
	socksNoAcceptedMethod = 0xff

	socksCommandConnect       = 0x01
	socksReplySucceeded       = 0x00
	socksReplyGeneralFailure  = 0x01
	socksReplyNotAllowed      = 0x02
	socksReplyNetworkDown     = 0x03
	socksReplyHostUnreachable = 0x04
	socksReplyRefused         = 0x05
	socksReplyUnsupported     = 0x07
	socksReplyAddressType     = 0x08

	socksAddressIPv4   = 0x01
	socksAddressDomain = 0x03
	socksAddressIPv6   = 0x04
)

// handleSOCKS5 performs username/password negotiation and serves one CONNECT request.
func (service *Service) handleSOCKS5(
	ctx context.Context,
	connection net.Conn,
	reader *bufio.Reader,
	clientKey string,
	handshakeDeadline time.Time,
) {
	methods, err := readSOCKSMethods(reader)
	if err != nil {
		return
	}

	supportsAuthentication := false
	for _, method := range methods {
		if method == socksUsernamePassword {
			supportsAuthentication = true

			break
		}
	}
	if !supportsAuthentication {
		_, _ = connection.Write([]byte{socksVersion, socksNoAcceptedMethod})

		return
	}
	if _, err := connection.Write([]byte{socksVersion, socksUsernamePassword}); err != nil {
		return
	}

	username, password, err := readSOCKSCredentials(reader)
	if err != nil {
		writeSOCKSAuthenticationReply(connection, false)

		return
	}
	if service.authenticator.blocked(clientKey) {
		writeSOCKSAuthenticationReply(connection, false)

		return
	}
	authenticationContext, cancelAuthentication := context.WithDeadline(ctx, handshakeDeadline)
	authentication, login := service.authenticator.authenticate(
		authenticationContext,
		username,
		password,
		clientKey,
	)
	cancelAuthentication()
	if authentication != authenticationAllowed {
		writeSOCKSAuthenticationReply(connection, false)

		return
	}
	if !service.linkConnection(connection, login) {
		return
	}
	if !writeSOCKSAuthenticationReply(connection, true) {
		return
	}

	command, addressType, err := readSOCKSRequestHeader(reader)
	if err != nil {
		return
	}
	if command != socksCommandConnect {
		writeSOCKSReply(connection, socksReplyUnsupported, nil)

		return
	}
	if addressType == socksAddressIPv6 {
		writeSOCKSReply(connection, socksReplyAddressType, nil)

		return
	}
	if addressType != socksAddressIPv4 && addressType != socksAddressDomain {
		writeSOCKSReply(connection, socksReplyAddressType, nil)

		return
	}

	host, port, err := readSOCKSDestination(reader, addressType)
	if err != nil {
		writeSOCKSReply(connection, socksReplyGeneralFailure, nil)

		return
	}

	if err := connection.SetDeadline(time.Time{}); err != nil {
		return
	}
	destination, err := service.dialGuardedForLogin(
		ctx,
		login,
		"tcp",
		net.JoinHostPort(host, strconv.Itoa(port)),
	)
	if deadlineError := connection.SetDeadline(service.clock().Add(service.socksTimeout)); deadlineError != nil {
		if destination != nil {
			_ = destination.Close()
		}

		return
	}
	if err != nil {
		writeSOCKSReply(connection, socksReplyForError(err), nil)

		return
	}
	if !writeSOCKSReply(connection, socksReplySucceeded, destination.LocalAddr()) {
		_ = destination.Close()

		return
	}
	if err := connection.SetDeadline(time.Time{}); err != nil {
		_ = destination.Close()

		return
	}

	client := &bufferedConnection{Conn: connection, reader: reader}
	copyTunnel(client, destination)
}

// readSOCKSMethods reads the RFC 1928 greeting.
func readSOCKSMethods(reader io.Reader) ([]byte, error) {
	header := make([]byte, 2)
	if _, err := io.ReadFull(reader, header); err != nil {
		return nil, err
	}
	if header[0] != socksVersion || header[1] == 0 {
		return nil, errors.New("invalid SOCKS5 greeting")
	}

	methods := make([]byte, int(header[1]))
	if _, err := io.ReadFull(reader, methods); err != nil {
		return nil, err
	}

	return methods, nil
}

// readSOCKSCredentials reads the RFC 1929 username and password subnegotiation.
func readSOCKSCredentials(reader io.Reader) (string, string, error) {
	header := make([]byte, 2)
	if _, err := io.ReadFull(reader, header); err != nil {
		return "", "", err
	}
	if header[0] != 0x01 || header[1] == 0 {
		return "", "", errors.New("invalid SOCKS5 username")
	}

	username := make([]byte, int(header[1]))
	if _, err := io.ReadFull(reader, username); err != nil {
		return "", "", err
	}
	passwordLength := []byte{0}
	if _, err := io.ReadFull(reader, passwordLength); err != nil {
		return "", "", err
	}
	if passwordLength[0] == 0 {
		return "", "", errors.New("invalid SOCKS5 password")
	}

	password := make([]byte, int(passwordLength[0]))
	if _, err := io.ReadFull(reader, password); err != nil {
		return "", "", err
	}

	return string(username), string(password), nil
}

// writeSOCKSAuthenticationReply returns the RFC 1929 success or failure status.
func writeSOCKSAuthenticationReply(connection io.Writer, allowed bool) bool {
	status := byte(0x01)
	if allowed {
		status = 0x00
	}

	_, err := connection.Write([]byte{0x01, status})

	return err == nil
}

// readSOCKSRequestHeader reads the fixed RFC 1928 request prefix.
func readSOCKSRequestHeader(reader io.Reader) (byte, byte, error) {
	header := make([]byte, 4)
	if _, err := io.ReadFull(reader, header); err != nil {
		return 0, 0, err
	}
	if header[0] != socksVersion || header[2] != 0x00 {
		return 0, 0, errors.New("invalid SOCKS5 request")
	}

	return header[1], header[3], nil
}

// readSOCKSDestination reads an accepted IPv4 or domain destination and its port.
func readSOCKSDestination(reader io.Reader, addressType byte) (string, int, error) {
	var host string
	switch addressType {
	case socksAddressIPv4:
		address := make([]byte, net.IPv4len)
		if _, err := io.ReadFull(reader, address); err != nil {
			return "", 0, err
		}
		host = net.IP(address).String()
	case socksAddressDomain:
		length := []byte{0}
		if _, err := io.ReadFull(reader, length); err != nil {
			return "", 0, err
		}
		if length[0] == 0 {
			return "", 0, errors.New("empty SOCKS5 domain")
		}
		domain := make([]byte, int(length[0]))
		if _, err := io.ReadFull(reader, domain); err != nil {
			return "", 0, err
		}
		host = string(domain)
	default:
		return "", 0, errUnsupportedAddress
	}

	portBytes := make([]byte, 2)
	if _, err := io.ReadFull(reader, portBytes); err != nil {
		return "", 0, err
	}
	port := int(binary.BigEndian.Uint16(portBytes))
	if port == 0 {
		return "", 0, errors.New("invalid SOCKS5 port")
	}

	return host, port, nil
}

// socksReplyForError maps guarded-dial and common socket failures to RFC 1928 replies.
func socksReplyForError(err error) byte {
	switch {
	case errors.Is(err, errDestinationNotAllowed):
		return socksReplyNotAllowed
	case errors.Is(err, errUnsupportedAddress):
		return socksReplyAddressType
	case errors.Is(err, errVPNNotProtected):
		return socksReplyGeneralFailure
	}

	var operationError *net.OpError
	if errors.As(err, &operationError) {
		if operationError.Timeout() {
			return socksReplyHostUnreachable
		}
	}
	var dnsError *net.DNSError
	if errors.As(err, &dnsError) {
		return socksReplyHostUnreachable
	}

	return socksReplyRefused
}

// writeSOCKSReply writes an IPv4 bound address or the all-zero failure address.
func writeSOCKSReply(connection io.Writer, reply byte, localAddress net.Addr) bool {
	address := net.IPv4zero
	port := 0
	if tcpAddress, ok := localAddress.(*net.TCPAddr); ok {
		if ipv4 := tcpAddress.IP.To4(); ipv4 != nil {
			address = ipv4
		}
		port = tcpAddress.Port
	}

	response := make([]byte, 10)
	response[0] = socksVersion
	response[1] = reply
	response[2] = 0x00
	response[3] = socksAddressIPv4
	copy(response[4:8], address.To4())
	binary.BigEndian.PutUint16(response[8:10], uint16(port))

	_, err := connection.Write(response)

	return err == nil
}
