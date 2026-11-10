package directdial

import (
	"bufio"
	"context"
	"errors"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

// startServer serves direct requests on a fresh socket and returns its path.
//
// The directory comes from os.MkdirTemp because macOS limits socket paths to 104 bytes
// and a test's own temporary directory can pass that.
func startServer(testingObject *testing.T, dial func(context.Context, string) (net.Conn, error)) string {
	testingObject.Helper()

	directory, err := os.MkdirTemp("", "dd")
	if err != nil {
		testingObject.Fatalf("create socket directory: %v", err)
	}
	testingObject.Cleanup(func() { _ = os.RemoveAll(directory) })

	socketPath := filepath.Join(directory, "s")
	listener, err := net.ListenUnix("unix", &net.UnixAddr{Name: socketPath, Net: "unix"})
	if err != nil {
		testingObject.Fatalf("listen on direct socket: %v", err)
	}
	testingObject.Cleanup(func() { _ = listener.Close() })

	server := &Server{Dial: dial}
	go func() { _ = server.Serve(listener) }()

	return socketPath
}

// startEchoListener answers every line it receives with the same line.
func startEchoListener(testingObject *testing.T) string {
	testingObject.Helper()

	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		testingObject.Fatalf("listen for echo: %v", err)
	}
	testingObject.Cleanup(func() { _ = listener.Close() })

	go func() {
		for {
			connection, err := listener.Accept()
			if err != nil {
				return
			}

			go func() {
				defer connection.Close()
				line, err := bufio.NewReader(connection).ReadString('\n')
				if err == nil {
					_, _ = connection.Write([]byte(line))
				}
			}()
		}
	}()

	return listener.Addr().String()
}

// plainDial stands in for the controller's marked dial.
func plainDial(ctx context.Context, address string) (net.Conn, error) {
	var dialer net.Dialer

	return dialer.DialContext(ctx, "tcp", address)
}

// TestDialHandsOverAConnection proves the console can use the controller's socket.
func TestDialHandsOverAConnection(testingObject *testing.T) {
	echoAddress := startEchoListener(testingObject)
	socketPath := startServer(testingObject, plainDial)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	connection, err := NewStrictClient(socketPath).DialContext(ctx, "tcp", echoAddress)
	if err != nil {
		testingObject.Fatalf("dial through the controller: %v", err)
	}
	defer connection.Close()

	if _, err := connection.Write([]byte("hello\n")); err != nil {
		testingObject.Fatalf("write through the handed-over connection: %v", err)
	}
	line, err := bufio.NewReader(connection).ReadString('\n')
	if err != nil {
		testingObject.Fatalf("read through the handed-over connection: %v", err)
	}
	if line != "hello\n" {
		testingObject.Fatalf("echo = %q, want %q", line, "hello\n")
	}
}

// TestLookupFailureBecomesDNSError keeps resolver failures recognizable to callers.
func TestLookupFailureBecomesDNSError(testingObject *testing.T) {
	socketPath := startServer(testingObject, func(context.Context, string) (net.Conn, error) {
		return nil, &net.DNSError{Err: "no such host", Name: "catalog.example"}
	})

	_, err := NewStrictClient(socketPath).DialContext(context.Background(), "tcp", "catalog.example:443")

	var lookupError *net.DNSError
	if !errors.As(err, &lookupError) {
		testingObject.Fatalf("error = %v, want a *net.DNSError", err)
	}
	if lookupError.Name != "catalog.example" {
		testingObject.Fatalf("lookup name = %q, want catalog.example", lookupError.Name)
	}
}

// TestDialFailureKeepsItsReason passes the controller's reason through unchanged.
func TestDialFailureKeepsItsReason(testingObject *testing.T) {
	socketPath := startServer(testingObject, func(context.Context, string) (net.Conn, error) {
		return nil, errors.New("connection refused by 192.0.2.10")
	})

	_, err := NewStrictClient(socketPath).DialContext(context.Background(), "tcp", "192.0.2.10:443")
	if err == nil || !strings.Contains(err.Error(), "connection refused by 192.0.2.10") {
		testingObject.Fatalf("error = %v, want the controller's reason", err)
	}

	var lookupError *net.DNSError
	if errors.As(err, &lookupError) {
		testingObject.Fatalf("error = %v, want no *net.DNSError", err)
	}
}

// TestMissingSocketDialsOnItsOwnOnlyWhenAllowed covers first-run setup.
func TestMissingSocketDialsOnItsOwnOnlyWhenAllowed(testingObject *testing.T) {
	echoAddress := startEchoListener(testingObject)
	missingPath := filepath.Join(testingObject.TempDir(), "missing.sock")

	connection, err := NewClient(missingPath).DialContext(context.Background(), "tcp", echoAddress)
	if err != nil {
		testingObject.Fatalf("dial without a controller socket: %v", err)
	}
	_ = connection.Close()

	if _, err := NewStrictClient(missingPath).DialContext(context.Background(), "tcp", echoAddress); err == nil {
		testingObject.Fatal("strict client dialed without the controller socket")
	}
}

// TestClientRefusesOtherNetworks keeps UDP and Unix requests off the controller.
func TestClientRefusesOtherNetworks(testingObject *testing.T) {
	socketPath := startServer(testingObject, plainDial)

	for _, network := range []string{"udp", "unix"} {
		if _, err := NewStrictClient(socketPath).DialContext(context.Background(), network, "192.0.2.10:53"); err == nil {
			testingObject.Fatalf("%s request was accepted", network)
		}
	}
}

// TestServerRejectsMalformedRequests answers bad requests without dialing.
func TestServerRejectsMalformedRequests(testingObject *testing.T) {
	var dialed atomic.Bool
	socketPath := startServer(testingObject, func(ctx context.Context, address string) (net.Conn, error) {
		dialed.Store(true)

		return plainDial(ctx, address)
	})

	requests := []string{
		"not json\n",
		`{"network":"udp","address":"192.0.2.10:53"}` + "\n",
		`{"network":"tcp","address":"no-port"}` + "\n",
		`{"network":"tcp","address":"192.0.2.10:0"}` + "\n",
		`{"network":"tcp","address":":443"}` + "\n",
	}
	for _, rawRequest := range requests {
		connection, err := net.Dial("unix", socketPath)
		if err != nil {
			testingObject.Fatalf("connect to direct socket: %v", err)
		}
		if _, err := connection.Write([]byte(rawRequest)); err != nil {
			testingObject.Fatalf("write request: %v", err)
		}
		answer, descriptors, err := readAnswer(connection.(*net.UnixConn))
		_ = connection.Close()
		closeDescriptors(descriptors)
		if err != nil {
			testingObject.Fatalf("read answer to %q: %v", rawRequest, err)
		}
		if answer.Error == "" || len(descriptors) != 0 {
			testingObject.Fatalf("request %q was not refused: %+v", rawRequest, answer)
		}
	}

	if dialed.Load() {
		testingObject.Fatal("a malformed request reached the dialer")
	}
}
