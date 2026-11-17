package logging

import (
	"bytes"
	"context"
	"log/slog"
	"testing"
	"time"
)

// TestHandlerWritesNovaLogShape verifies the shared time, level, component, and
// message layout while ensuring embedded newlines cannot create a second fact.
//
// Since: 2.4.0
func TestHandlerWritesNovaLogShape(testingObject *testing.T) {
	var output bytes.Buffer
	handler := New(&output, "control-api", slog.LevelDebug).Handler()
	record := slog.NewRecord(
		time.Date(2026, time.November, 17, 14, 25, 30, 0, time.FixedZone("test", -5*60*60)),
		slog.LevelWarn,
		"migration\ncompleted",
		0,
	)
	record.Add("source", "/config/database/state.sqlite3", "detail", "one\ntwo")

	if err := handler.Handle(context.Background(), record); err != nil {
		testingObject.Fatalf("write log record: %v", err)
	}

	wanted := "2026-11-17T19:25:30Z WARN control-api: migration\\ncompleted " +
		"source=/config/database/state.sqlite3 detail=one\\ntwo\n"
	if output.String() != wanted {
		testingObject.Fatalf("log output = %q, want %q", output.String(), wanted)
	}
}

// TestHandlerHonorsDynamicLevel verifies the API can enable debug logs at runtime.
//
// Since: 2.4.0
func TestHandlerHonorsDynamicLevel(testingObject *testing.T) {
	var output bytes.Buffer
	level := new(slog.LevelVar)
	level.Set(slog.LevelInfo)
	logger := New(&output, "control-api", level)
	logger.Debug("hidden")
	level.Set(slog.LevelDebug)
	logger.Debug("shown")

	if bytes.Contains(output.Bytes(), []byte("hidden")) || !bytes.Contains(output.Bytes(), []byte("DEBUG control-api: shown")) {
		testingObject.Fatalf("dynamic level output = %q", output.String())
	}
}
