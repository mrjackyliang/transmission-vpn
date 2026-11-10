package directdial

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"net"
	"os"
	"syscall"
	"time"
)

// Client opens connections outside the VPN through the controller's direct socket.
//
// Since: 2.0.3
type Client struct {
	socketPath       string
	dialWhenNoSocket bool
}

// NewClient returns a client for the controller's direct socket.
//
// The container's first-run setup runs before the VPN controller and the firewall
// start, so while the socket doesn't exist yet, the client dials on its own. Once the
// firewall is up, a connection opened that way can't leave the container.
//
// Since: 2.0.3
func NewClient(socketPath string) *Client {
	return &Client{
		socketPath:       socketPath,
		dialWhenNoSocket: true,
	}
}

// NewStrictClient returns a client that only dials through the controller.
//
// Since: 2.0.3
func NewStrictClient(socketPath string) *Client {
	return &Client{socketPath: socketPath}
}

// DialContext opens one TCP connection outside the VPN.
//
// A failed host lookup comes back as a *net.DNSError, like one from a plain dial, so
// callers can tell a resolver problem apart from an unreachable destination.
//
// Since: 2.0.3
func (client *Client) DialContext(ctx context.Context, network string, address string) (net.Conn, error) {
	if network != "tcp" && network != "tcp4" && network != "tcp6" {
		return nil, dialError(network, errors.New("only TCP connections can be opened outside the VPN"))
	}

	var socketDialer net.Dialer
	socketConnection, err := socketDialer.DialContext(ctx, "unix", client.socketPath)
	if err != nil {
		if client.dialWhenNoSocket && errors.Is(err, fs.ErrNotExist) {
			var plainDialer net.Dialer

			return plainDialer.DialContext(ctx, network, address)
		}

		return nil, dialError(network, fmt.Errorf("reach the VPN controller: %w", err))
	}
	unixConnection, ok := socketConnection.(*net.UnixConn)
	if !ok {
		_ = socketConnection.Close()

		return nil, dialError(network, errors.New("the VPN controller socket is not a Unix socket"))
	}
	defer unixConnection.Close()

	deadline := time.Now().Add(exchangeTimeout)
	if contextDeadline, hasDeadline := ctx.Deadline(); hasDeadline && contextDeadline.Before(deadline) {
		deadline = contextDeadline
	}
	_ = unixConnection.SetDeadline(deadline)
	stopWatching := context.AfterFunc(ctx, func() {
		_ = unixConnection.SetDeadline(time.Now())
	})
	defer stopWatching()

	payload, err := json.Marshal(request{Network: network, Address: address})
	if err != nil {
		return nil, dialError(network, fmt.Errorf("encode the request: %w", err))
	}
	if _, err := unixConnection.Write(append(payload, '\n')); err != nil {
		return nil, dialError(network, contextError(ctx, fmt.Errorf("send the request: %w", err)))
	}

	answer, descriptors, err := readAnswer(unixConnection)
	if err != nil {
		closeDescriptors(descriptors)

		return nil, dialError(network, contextError(ctx, err))
	}
	if answer.Error != "" {
		closeDescriptors(descriptors)
		if answer.LookupFailure {
			host, _, _ := net.SplitHostPort(address)

			return nil, dialError(network, &net.DNSError{Err: answer.Error, Name: host})
		}

		return nil, dialError(network, errors.New(answer.Error))
	}
	if len(descriptors) != 1 {
		closeDescriptors(descriptors)

		return nil, dialError(network, errors.New("the VPN controller did not hand over a connection"))
	}

	file := os.NewFile(uintptr(descriptors[0]), "direct-connection")
	defer file.Close()

	connection, err := net.FileConn(file)
	if err != nil {
		return nil, dialError(network, fmt.Errorf("use the handed-over connection: %w", err))
	}

	return connection, nil
}

// readAnswer reads one newline-ended answer and any descriptor sent with it.
//
// The descriptor travels with the answer's first bytes, so it is collected from every
// read until the line is complete.
func readAnswer(connection *net.UnixConn) (response, []int, error) {
	var answerBytes []byte
	var descriptors []int
	buffer := make([]byte, 512)
	controlBuffer := make([]byte, syscall.CmsgSpace(4))

	for !bytes.Contains(answerBytes, []byte{'\n'}) {
		if len(answerBytes) > maximumMessageBytes {
			return response{}, descriptors, errors.New("the VPN controller's answer is too long")
		}

		readCount, controlCount, _, _, err := connection.ReadMsgUnix(buffer, controlBuffer)
		if controlCount > 0 {
			received, parseError := parseDescriptors(controlBuffer[:controlCount])
			descriptors = append(descriptors, received...)
			if parseError != nil {
				return response{}, descriptors, parseError
			}
		}
		answerBytes = append(answerBytes, buffer[:readCount]...)

		if err != nil {
			if bytes.Contains(answerBytes, []byte{'\n'}) {
				break
			}

			return response{}, descriptors, fmt.Errorf("read the VPN controller's answer: %w", err)
		}
	}

	var answer response
	line := answerBytes[:bytes.IndexByte(answerBytes, '\n')]
	if err := json.Unmarshal(line, &answer); err != nil {
		return response{}, descriptors, fmt.Errorf("read the VPN controller's answer: %w", err)
	}

	return answer, descriptors, nil
}

// parseDescriptors returns the descriptors in one control message.
func parseDescriptors(control []byte) ([]int, error) {
	messages, err := syscall.ParseSocketControlMessage(control)
	if err != nil {
		return nil, fmt.Errorf("read the handed-over connection: %w", err)
	}

	var descriptors []int
	for index := range messages {
		received, err := syscall.ParseUnixRights(&messages[index])
		if err != nil {
			return descriptors, fmt.Errorf("read the handed-over connection: %w", err)
		}
		descriptors = append(descriptors, received...)
	}

	return descriptors, nil
}

// closeDescriptors releases descriptors that won't become connections.
func closeDescriptors(descriptors []int) {
	for _, descriptor := range descriptors {
		_ = syscall.Close(descriptor)
	}
}

// dialError wraps a failure the way a plain dial does.
func dialError(network string, err error) error {
	return &net.OpError{Op: "dial", Net: network, Err: err}
}

// contextError prefers the caller's cancellation over the I/O error it caused.
func contextError(ctx context.Context, err error) error {
	if contextErr := ctx.Err(); contextErr != nil {
		return contextErr
	}

	return err
}
