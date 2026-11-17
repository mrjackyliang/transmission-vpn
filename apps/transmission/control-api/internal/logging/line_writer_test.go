package logging

import (
	"bytes"
	"log/slog"
	"strings"
	"testing"
)

// TestLineWriterEmitsCompleteAndPartialLines verifies child-process chunks cannot
// bypass the appliance logger or merge separate facts into one physical line.
//
// Since: 2.4.0
func TestLineWriterEmitsCompleteAndPartialLines(testingObject *testing.T) {
	var output bytes.Buffer
	writer := NewLineWriter(
		New(&output, "transmission-runner", slog.LevelInfo),
		slog.LevelInfo,
		"transmission-daemon",
	)

	if _, err := writer.Write([]byte("first line\nsecond")); err != nil {
		testingObject.Fatalf("write first chunk: %v", err)
	}
	if _, err := writer.Write([]byte(" line\r\npartial")); err != nil {
		testingObject.Fatalf("write second chunk: %v", err)
	}
	writer.Flush()

	lines := strings.Split(strings.TrimSpace(output.String()), "\n")
	if len(lines) != 3 {
		testingObject.Fatalf("log lines = %d, want 3: %q", len(lines), output.String())
	}
	wantedOutputs := []string{
		"transmission-daemon output=\"first line\"",
		"transmission-daemon output=\"second line\"",
		"transmission-daemon output=partial",
	}
	for index, wantedOutput := range wantedOutputs {
		if !strings.Contains(lines[index], wantedOutput) {
			testingObject.Fatalf("log line %d = %q, want substring %q", index, lines[index], wantedOutput)
		}
	}
}
