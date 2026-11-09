package controller

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"time"
)

const maximumControllerMessageBytes = 16 * 1024 * 1024

// Client sends typed commands to the privileged controller over a Unix socket.
//
// The unprivileged API owns this client but never receives operating-system network
// capabilities or a generic process-execution primitive.
type Client struct {
	socketPath string
	timeout    time.Duration
}

// NewClient creates a controller client for the fixed runtime socket.
//
// The timeout bounds status and disconnect commands. A connect waits for the
// controller's own connect limit plus a margin instead, so the controller always
// answers before the client gives up, however long the pool is.
func NewClient(socketPath string, timeout time.Duration) *Client {
	return &Client{
		socketPath: socketPath,
		timeout:    timeout,
	}
}

// Status reads every current normalized controller state.
//
// This operation carries no secrets and is suitable for authenticated status APIs.
func (client *Client) Status(ctx context.Context) ([]Status, error) {
	response, err := client.send(ctx, Request{
		Version: ProtocolVersion,
		Action:  "status",
	})
	if err != nil {
		return nil, err
	}

	if response.Statuses == nil {
		return []Status{}, nil
	}

	return response.Statuses, nil
}

// Connect stages and verifies one normalized endpoint pool.
//
// Success means tunnel checks and the protected firewall transition completed; failure
// leaves Transmission blocked and returns a secret-free reason.
func (client *Client) Connect(
	ctx context.Context,
	connectionID string,
	slot int,
	isDefault bool,
	connection Connection,
) (Status, error) {
	response, err := client.send(ctx, Request{
		Version:      ProtocolVersion,
		Action:       "connect",
		ConnectionID: connectionID,
		Slot:         slot,
		Default:      isDefault,
		Connection:   &connection,
	})
	if err != nil {
		return Status{}, err
	}

	return responseStatus(response)
}

// Restore reconnects the saved endpoint pool after a restart.
//
// It is a connect without the time limit, because nobody waits for it: the controller
// tries every endpoint once, and only ctx ends the wait. A newer command replaces it.
func (client *Client) Restore(
	ctx context.Context,
	connectionID string,
	slot int,
	isDefault bool,
	connection Connection,
) (Status, error) {
	response, err := client.send(ctx, Request{
		Version:      ProtocolVersion,
		Action:       "restore",
		ConnectionID: connectionID,
		Slot:         slot,
		Default:      isDefault,
		Connection:   &connection,
	})
	if err != nil {
		return Status{}, err
	}

	return responseStatus(response)
}

// Disconnect returns the controller to an explicitly blocked state.
//
// Disabling VPN never grants unprotected Transmission access; the firewall block is
// applied before the tunnel and resolver state are torn down.
func (client *Client) Disconnect(ctx context.Context, connectionID string) (Status, error) {
	response, err := client.send(ctx, Request{
		Version:      ProtocolVersion,
		Action:       "disconnect",
		ConnectionID: connectionID,
	})
	if err != nil {
		return Status{}, err
	}

	return responseStatus(response)
}

// SetDefault moves resolver ownership and the legacy status projection.
//
// The target must already be known to the controller. Moving the default never stops
// either tunnel; only resolver pins and status metadata change.
func (client *Client) SetDefault(ctx context.Context, connectionID string) (Status, error) {
	response, err := client.send(ctx, Request{
		Version:      ProtocolVersion,
		Action:       "set-default",
		ConnectionID: connectionID,
	})
	if err != nil {
		return Status{}, err
	}

	return responseStatus(response)
}

// responseStatus extracts the target state returned by a mutating command.
//
// A successful command without its typed status indicates mismatched controller
// binaries and must fail rather than inventing a privileged operation result.
func responseStatus(response Response) (Status, error) {
	if response.Status == nil {
		return Status{}, errors.New("VPN controller response has no connection status")
	}

	return *response.Status, nil
}

// send performs one request-response exchange over a fresh local connection.
//
// Fresh connections keep framing simple, bound each command independently, and avoid
// stale privileged sessions after controller restarts.
func (client *Client) send(ctx context.Context, request Request) (Response, error) {
	timeout := client.timeout
	switch request.Action {
	case "connect":
		timeout = maximumConnectDuration + connectResponseMargin
	case "restore":
		timeout = 0
	}

	requestContext := ctx
	if timeout > 0 {
		var cancel context.CancelFunc
		requestContext, cancel = context.WithTimeout(ctx, timeout)
		defer cancel()
	}

	dialer := net.Dialer{}
	connection, err := dialer.DialContext(requestContext, "unix", client.socketPath)
	if err != nil {
		return Response{}, fmt.Errorf("connect to VPN controller: %w", err)
	}
	defer connection.Close()

	// Only the context ends the exchange, so a timeout and a canceled caller both stop
	// waiting at once and the error says which one it was. The controller finishes
	// the command unless a newer command replaces it.
	stopInterrupt := context.AfterFunc(requestContext, func() {
		_ = connection.SetDeadline(time.Now())
	})
	defer stopInterrupt()

	if err := json.NewEncoder(connection).Encode(request); err != nil {
		return Response{}, fmt.Errorf("send VPN controller command: %w", err)
	}

	limitedReader := bufio.NewReaderSize(
		&limitedConnectionReader{
			connection: connection,
			remaining:  maximumControllerMessageBytes,
		},
		64*1024,
	)
	decoder := json.NewDecoder(limitedReader)
	decoder.DisallowUnknownFields()

	var response Response
	if err := decoder.Decode(&response); err != nil {
		if contextError := requestContext.Err(); contextError != nil {
			return Response{}, fmt.Errorf("read VPN controller response: %w", contextError)
		}

		return Response{}, fmt.Errorf("read VPN controller response: %w", err)
	}

	if !response.OK {
		if response.Error == "" {
			response.Error = "VPN controller rejected the command"
		}

		return Response{}, errors.New(response.Error)
	}

	return response, nil
}

// limitedConnectionReader bounds a controller response without buffering it all first.
//
// The controller status contract is small; exceeding this limit indicates malformed or
// mismatched local components and fails the request.
type limitedConnectionReader struct {
	connection net.Conn
	remaining  int
}

// Read implements the bounded response reader.
//
// It returns an explicit error once the fixed message budget is consumed.
func (reader *limitedConnectionReader) Read(buffer []byte) (int, error) {
	if reader.remaining <= 0 {
		return 0, errors.New("VPN controller response exceeds the size limit")
	}

	if len(buffer) > reader.remaining {
		buffer = buffer[:reader.remaining]
	}

	readBytes, err := reader.connection.Read(buffer)
	reader.remaining -= readBytes

	return readBytes, err
}
