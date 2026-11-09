package controller

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// listenOnTestSocket serves each controller connection with answer.
//
// Unix socket paths are short on macOS, so the socket skips the long test directory.
func listenOnTestSocket(testingObject *testing.T, answer func(net.Conn)) string {
	testingObject.Helper()

	directory, err := os.MkdirTemp("", "tvpn-")
	if err != nil {
		testingObject.Fatalf("create socket directory: %v", err)
	}
	testingObject.Cleanup(func() { _ = os.RemoveAll(directory) })

	socketPath := filepath.Join(directory, "controller.sock")
	listener, err := net.Listen("unix", socketPath)
	if err != nil {
		testingObject.Fatalf("listen on test socket: %v", err)
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
				answer(connection)
			}()
		}
	}()

	return socketPath
}

// TestClientWaitsForTheConnectAnswer outlasts the client timeout only for a connect.
//
// The timeout bounds status and disconnect. A connect waits for the controller's own
// limit, so the client never gives up on a long pool test first.
func TestClientWaitsForTheConnectAnswer(testingObject *testing.T) {
	socketPath := listenOnTestSocket(testingObject, func(connection net.Conn) {
		var request Request
		if err := json.NewDecoder(connection).Decode(&request); err != nil {
			return
		}
		time.Sleep(300 * time.Millisecond)
		status := Status{State: "protected"}
		_ = json.NewEncoder(connection).Encode(Response{OK: true, Status: &status})
	})
	client := NewClient(socketPath, 100*time.Millisecond)

	if _, err := client.Status(context.Background()); !errors.Is(err, context.DeadlineExceeded) {
		testingObject.Fatalf("a slow status = %v, want a timeout", err)
	}
	status, err := client.Connect(
		context.Background(),
		"vpc-0000000000000001",
		0,
		true,
		Connection{},
	)
	if err != nil || status.State != "protected" {
		testingObject.Fatalf("a slow connect = %+v, %v", status, err)
	}
}

// TestClientStopsWaitingWhenCanceled returns at once when its caller gives up.
//
// The startup restore relies on this to step aside for an administrator's change.
func TestClientStopsWaitingWhenCanceled(testingObject *testing.T) {
	release := make(chan struct{})
	testingObject.Cleanup(func() { close(release) })
	socketPath := listenOnTestSocket(testingObject, func(net.Conn) {
		<-release
	})
	client := NewClient(socketPath, time.Minute)

	ctx, cancel := context.WithCancel(context.Background())
	time.AfterFunc(100*time.Millisecond, cancel)
	started := time.Now()
	if _, err := client.Connect(
		ctx,
		"vpc-0000000000000001",
		0,
		true,
		Connection{},
	); !errors.Is(err, context.Canceled) {
		testingObject.Fatalf("a canceled connect = %v, want context.Canceled", err)
	}
	if elapsed := time.Since(started); elapsed > 5*time.Second {
		testingObject.Fatalf("the client waited %s after its caller gave up", elapsed)
	}
}
