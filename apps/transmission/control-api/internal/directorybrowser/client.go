package directorybrowser

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"time"
)

const (
	maximumDirectoryControllerRequestBytes  = 64 * 1024
	maximumDirectoryControllerResponseBytes = 23 * 1024 * 1024
)

// Client sends typed browse, inspect, create, and empty-folder delete requests.
//
// The unprivileged control API owns this client without receiving the Transmission
// user's filesystem permissions or a generic filesystem primitive.
//
// Since: UNRELEASED
type Client struct {
	socketPath string
	timeout    time.Duration
}

// NewClient creates a client for the fixed directory-controller socket.
//
// A bounded timeout prevents an HTTP request from hanging if the local helper becomes
// unavailable while the container is shutting down or restarting.
func NewClient(socketPath string, timeout time.Duration) *Client {
	return &Client{
		socketPath: socketPath,
		timeout:    timeout,
	}
}

// List returns one directory and its immediate browsable children.
//
// The controller validates the requested path against its immutable storage root.
func (client *Client) List(ctx context.Context, path string) (Directory, error) {
	response, err := client.send(ctx, Request{
		Version: ProtocolVersion,
		Action:  "list",
		Path:    path,
	})
	if err != nil {
		return Directory{}, err
	}
	if response.Directory == nil {
		return Directory{}, errors.New("directory controller response omitted the directory")
	}

	return *response.Directory, nil
}

// Create creates one child folder and returns that folder as the current directory.
//
// Returning the created directory lets the picker immediately enter and select it.
func (client *Client) Create(
	ctx context.Context,
	parentPath string,
	name string,
) (Directory, error) {
	response, err := client.send(ctx, Request{
		Version: ProtocolVersion,
		Action:  "create",
		Path:    parentPath,
		Name:    name,
	})
	if err != nil {
		return Directory{}, err
	}
	if response.Directory == nil {
		return Directory{}, errors.New("directory controller response omitted the directory")
	}

	return *response.Directory, nil
}

// Inspect returns current metadata for exactly one folder beneath the root.
//
// Delete preflight uses this narrow action so it never scans or opens the target's
// siblings merely to decide whether one named folder may be removed.
//
// Since: UNRELEASED
func (client *Client) Inspect(ctx context.Context, path string) (DirectoryEntry, error) {
	response, err := client.send(ctx, Request{
		Version: ProtocolVersion,
		Action:  "inspect",
		Path:    path,
	})
	if err != nil {
		return DirectoryEntry{}, err
	}
	if response.Entry == nil {
		return DirectoryEntry{}, errors.New("directory controller response omitted the entry")
	}

	return *response.Entry, nil
}

// Delete removes exactly one empty folder beneath the fixed storage root.
//
// The controller performs descriptor-relative removal without following links or
// exposing recursive deletion to the unprivileged control API.
//
// Since: UNRELEASED
func (client *Client) Delete(ctx context.Context, path string) error {
	_, err := client.send(ctx, Request{
		Version: ProtocolVersion,
		Action:  "delete",
		Path:    path,
	})

	return err
}

// ReadTorrent returns one bounded metainfo file from a connection's daemon state.
//
// The controller validates the complete fixed path and performs the read as the
// Transmission user, so the control API never receives broad filesystem access.
//
// Since: UNRELEASED
func (client *Client) ReadTorrent(ctx context.Context, path string) ([]byte, error) {
	response, err := client.send(ctx, Request{
		Version: ProtocolVersion,
		Action:  "read-torrent",
		Path:    path,
	})
	if err != nil {
		return nil, err
	}
	if response.Torrent == nil {
		return nil, errors.New("directory controller response omitted torrent metainfo")
	}

	return response.Torrent, nil
}

// send performs one bounded request-response exchange over a fresh local connection.
//
// Fresh connections make framing deterministic and avoid stale sessions across helper
// restarts while keeping each operation independently cancelable.
func (client *Client) send(ctx context.Context, request Request) (Response, error) {
	requestContext := ctx
	if client.timeout > 0 {
		var cancel context.CancelFunc
		requestContext, cancel = context.WithTimeout(ctx, client.timeout)
		defer cancel()
	}

	dialer := net.Dialer{}
	connection, err := dialer.DialContext(requestContext, "unix", client.socketPath)
	if err != nil {
		return Response{}, fmt.Errorf("connect to directory controller: %w", err)
	}
	defer connection.Close()

	deadline, found := requestContext.Deadline()
	if found {
		_ = connection.SetDeadline(deadline)
	}

	if err := json.NewEncoder(connection).Encode(request); err != nil {
		return Response{}, fmt.Errorf("send directory controller request: %w", err)
	}

	limitedReader := bufio.NewReaderSize(
		&limitedConnectionReader{
			connection: connection,
			remaining:  maximumDirectoryControllerResponseBytes,
		},
		16*1024,
	)
	decoder := json.NewDecoder(limitedReader)
	decoder.DisallowUnknownFields()

	var response Response
	if err := decoder.Decode(&response); err != nil {
		return Response{}, fmt.Errorf("read directory controller response: %w", err)
	}

	if !response.OK {
		if response.Error == "" {
			response.Error = "The directory controller rejected the request."
		}

		return Response{}, &OperationError{
			Code:    response.ErrorCode,
			Message: response.Error,
		}
	}
	return response, nil
}

// limitedConnectionReader bounds one directory-controller response.
//
// The directory contract is intentionally small; exhausting this budget indicates a
// malformed or mismatched local component and terminates the request.
type limitedConnectionReader struct {
	connection net.Conn
	remaining  int64
}

// Read implements the bounded response reader.
//
// It returns an explicit failure after the fixed local-protocol budget is consumed.
func (reader *limitedConnectionReader) Read(buffer []byte) (int, error) {
	if reader.remaining <= 0 {
		return 0, errors.New("directory controller response exceeds the size limit")
	}

	if int64(len(buffer)) > reader.remaining {
		buffer = buffer[:reader.remaining]
	}

	readBytes, err := reader.connection.Read(buffer)
	reader.remaining -= int64(readBytes)

	return readBytes, err
}
