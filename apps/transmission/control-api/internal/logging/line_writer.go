package logging

import (
	"bytes"
	"context"
	"log/slog"
	"sync"
)

// LineWriter converts a child process's byte stream into complete log records.
//
// Transmission writes directly to stdout and stderr, so its output passes through
// this writer to retain Nova's timestamp, level, and component contract.
//
// Since: 2.4.0
type LineWriter struct {
	logger  *slog.Logger
	level   slog.Level
	message string
	buffer  bytes.Buffer
	mutex   sync.Mutex
}

// NewLineWriter prepares a writer that labels each child-process line with message.
//
// Callers must flush the writer after the child exits so a final unterminated line
// is not lost.
//
// Since: 2.4.0
func NewLineWriter(logger *slog.Logger, level slog.Level, message string) *LineWriter {
	return &LineWriter{
		logger:  logger,
		level:   level,
		message: message,
	}
}

// Write buffers incomplete input and emits every complete physical line once.
//
// Since: 2.4.0
func (writer *LineWriter) Write(contents []byte) (int, error) {
	writer.mutex.Lock()
	defer writer.mutex.Unlock()

	writtenLength := len(contents)
	_, _ = writer.buffer.Write(contents)
	writer.emitCompleteLines()

	return writtenLength, nil
}

// Flush emits a final unterminated line after the child process closes its streams.
//
// Since: 2.4.0
func (writer *LineWriter) Flush() {
	writer.mutex.Lock()
	defer writer.mutex.Unlock()

	if writer.buffer.Len() == 0 {
		return
	}

	writer.emit(writer.buffer.String())
	writer.buffer.Reset()
}

// emitCompleteLines drains newline-terminated records while retaining a partial tail.
//
// Since: 2.4.0
func (writer *LineWriter) emitCompleteLines() {
	for {
		contents := writer.buffer.Bytes()
		newlineIndex := bytes.IndexByte(contents, '\n')
		if newlineIndex < 0 {
			return
		}

		line := string(contents[:newlineIndex])
		writer.buffer.Next(newlineIndex + 1)
		writer.emit(line)
	}
}

// emit removes a carriage return from CRLF input before logging one fact.
//
// Since: 2.4.0
func (writer *LineWriter) emit(line string) {
	line = string(bytes.TrimSuffix([]byte(line), []byte{'\r'}))
	writer.logger.Log(context.Background(), writer.level, writer.message, "output", line)
}
