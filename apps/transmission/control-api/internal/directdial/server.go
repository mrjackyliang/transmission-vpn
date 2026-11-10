package directdial

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"os"
	"strconv"
	"syscall"
	"time"
)

// Server answers the console's requests for connections outside the VPN.
//
// It runs inside the VPN controller, and Dial must mark every socket it opens, or the
// firewall drops the connection.
//
// Since: 2.0.3
type Server struct {
	Dial   func(ctx context.Context, address string) (net.Conn, error)
	Logger *slog.Logger
}

// Serve answers requests until the listener closes.
//
// Since: 2.0.3
func (server *Server) Serve(listener *net.UnixListener) error {
	for {
		connection, err := listener.AcceptUnix()
		if err != nil {
			if errors.Is(err, net.ErrClosed) {
				return nil
			}

			return fmt.Errorf("accept a direct connection request: %w", err)
		}

		go server.handle(connection)
	}
}

// handle opens one connection and hands its descriptor back, or says why it couldn't.
func (server *Server) handle(connection *net.UnixConn) {
	defer connection.Close()
	_ = connection.SetDeadline(time.Now().Add(exchangeTimeout))

	line, err := bufio.NewReader(io.LimitReader(connection, maximumMessageBytes)).ReadBytes('\n')
	if err != nil {
		server.answer(connection, response{Error: "the request could not be read"}, nil)

		return
	}

	var incoming request
	if err := json.Unmarshal(line, &incoming); err != nil {
		server.answer(connection, response{Error: "the request is not valid JSON"}, nil)

		return
	}
	if err := validateRequest(incoming); err != nil {
		server.answer(connection, response{Error: err.Error()}, nil)

		return
	}

	dialContext, cancel := context.WithTimeout(context.Background(), dialTimeout)
	defer cancel()

	opened, err := server.Dial(dialContext, incoming.Address)
	if err != nil {
		var lookupError *net.DNSError
		server.answer(connection, response{
			Error:         err.Error(),
			LookupFailure: errors.As(err, &lookupError),
		}, nil)

		return
	}
	defer opened.Close()

	fileConnection, ok := opened.(interface{ File() (*os.File, error) })
	if !ok {
		server.answer(connection, response{Error: "the connection has no descriptor to hand over"}, nil)

		return
	}
	file, err := fileConnection.File()
	if err != nil {
		server.answer(connection, response{Error: "the connection could not be handed over"}, nil)

		return
	}
	defer file.Close()

	server.answer(connection, response{}, file)
}

// answer sends one answer line, with the connection's descriptor when there is one.
func (server *Server) answer(connection *net.UnixConn, answer response, file *os.File) {
	payload, err := json.Marshal(answer)
	if err != nil {
		return
	}
	payload = append(payload, '\n')

	var rights []byte
	if file != nil {
		rights = syscall.UnixRights(int(file.Fd()))
	}

	if _, _, err := connection.WriteMsgUnix(payload, rights, nil); err != nil && server.Logger != nil {
		server.Logger.Warn("answer a direct connection request", "error", err)
	}
}

// validateRequest accepts one TCP host and port.
//
// The controller does its own destination checks after the lookup, so this only keeps
// malformed requests away from the resolver.
func validateRequest(incoming request) error {
	if incoming.Network != "tcp" && incoming.Network != "tcp4" && incoming.Network != "tcp6" {
		return errors.New("only TCP connections can be opened outside the VPN")
	}

	host, port, err := net.SplitHostPort(incoming.Address)
	if err != nil {
		return errors.New("the address must be a host and a port")
	}
	if host == "" || len(host) > 253 {
		return errors.New("the host is missing or too long")
	}

	portNumber, err := strconv.Atoi(port)
	if err != nil || portNumber < 1 || portNumber > 65535 {
		return errors.New("the port must be between 1 and 65535")
	}

	return nil
}
