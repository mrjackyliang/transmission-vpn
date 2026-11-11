package api

import (
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"strings"
	"testing"
)

// TestLogInternalErrorKeepsCanceledRequestsForDebug keeps a closed browser request out
// of the error log, shows it as a debug line in debug mode, and still records a
// request that ran out of time as an error.
func TestLogInternalErrorKeepsCanceledRequestsForDebug(testingObject *testing.T) {
	canceled := fmt.Errorf("read torrent organization revision: %w", context.Canceled)
	timedOut := fmt.Errorf("read torrent organization revision: %w", context.DeadlineExceeded)

	var infoOutput bytes.Buffer
	server := &Server{logger: slog.New(slog.NewTextHandler(&infoOutput, nil))}
	server.logInternalError("read torrent organization", canceled)
	if infoOutput.Len() != 0 {
		testingObject.Fatalf("logged a canceled request without debug logging: %s", infoOutput.String())
	}
	server.logInternalError("read torrent organization", timedOut)
	if !strings.Contains(infoOutput.String(), "level=ERROR") {
		testingObject.Fatalf("did not log a request that timed out as an error: %q", infoOutput.String())
	}

	var debugOutput bytes.Buffer
	server.logger = slog.New(slog.NewTextHandler(&debugOutput, &slog.HandlerOptions{Level: slog.LevelDebug}))
	server.logInternalError("read torrent organization", canceled)
	if !strings.Contains(debugOutput.String(), "level=DEBUG") {
		testingObject.Fatalf("did not show a canceled request in debug mode: %q", debugOutput.String())
	}
}
