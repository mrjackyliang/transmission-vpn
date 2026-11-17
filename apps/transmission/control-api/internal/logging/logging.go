// Package logging formats application output for Nova-managed Docker appliances.
//
// Every process uses the same plain, single-line shape as Nova's shell helper so
// container logs remain readable without a JSON decoder.
package logging

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log/slog"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Handler writes one Nova-compatible application log line per slog record.
//
// Cloned handlers share their write lock, preventing concurrent services inside
// one process from interleaving complete records.
//
// Since: 2.4.0
type Handler struct {
	writer     io.Writer
	component  string
	level      slog.Leveler
	attributes []slog.Attr
	groups     []string
	mutex      *sync.Mutex
}

// New creates a logger that writes plain Nova-compatible lines to writer.
//
// The leveler may be a slog.LevelVar so the control API can keep its existing
// runtime debug-level setting without replacing the handler.
//
// Since: 2.4.0
func New(writer io.Writer, component string, level slog.Leveler) *slog.Logger {
	if level == nil {
		level = slog.LevelInfo
	}

	return slog.New(&Handler{
		writer:    writer,
		component: sanitize(component),
		level:     level,
		mutex:     &sync.Mutex{},
	})
}

// Enabled reports whether level passes the configured runtime threshold.
//
// Since: 2.4.0
func (handler *Handler) Enabled(_ context.Context, level slog.Level) bool {
	return level >= handler.level.Level()
}

// Handle serializes one record as time, level, component, message, and attributes.
//
// Newlines are escaped in messages and values so one event always occupies one
// physical line in Docker's log stream.
//
// Since: 2.4.0
func (handler *Handler) Handle(_ context.Context, record slog.Record) error {
	var output bytes.Buffer
	timestamp := record.Time
	if timestamp.IsZero() {
		timestamp = time.Now()
	}

	output.WriteString(timestamp.UTC().Format(time.RFC3339))
	output.WriteByte(' ')
	output.WriteString(levelName(record.Level))
	output.WriteByte(' ')
	output.WriteString(handler.component)
	output.WriteString(": ")
	output.WriteString(sanitize(record.Message))

	for _, attribute := range handler.attributes {
		handler.appendAttribute(&output, handler.groups, attribute)
	}
	record.Attrs(func(attribute slog.Attr) bool {
		handler.appendAttribute(&output, handler.groups, attribute)

		return true
	})
	output.WriteByte('\n')

	handler.mutex.Lock()
	defer handler.mutex.Unlock()

	_, err := handler.writer.Write(output.Bytes())

	return err
}

// WithAttrs returns a handler that includes the supplied contextual attributes.
//
// Since: 2.4.0
func (handler *Handler) WithAttrs(attributes []slog.Attr) slog.Handler {
	clonedHandler := handler.clone()
	clonedHandler.attributes = append(clonedHandler.attributes, attributes...)

	return clonedHandler
}

// WithGroup returns a handler that prefixes subsequent attribute names with name.
//
// Since: 2.4.0
func (handler *Handler) WithGroup(name string) slog.Handler {
	if name == "" {
		return handler
	}

	clonedHandler := handler.clone()
	clonedHandler.groups = append(clonedHandler.groups, sanitize(name))

	return clonedHandler
}

// appendAttribute renders one resolved attribute, expanding slog groups recursively.
//
// Since: 2.4.0
func (handler *Handler) appendAttribute(
	output *bytes.Buffer,
	groups []string,
	attribute slog.Attr,
) {
	attribute.Value = attribute.Value.Resolve()
	if attribute.Equal(slog.Attr{}) {
		return
	}
	if attribute.Value.Kind() == slog.KindGroup {
		nestedGroups := groups
		if attribute.Key != "" {
			nestedGroups = append(append([]string{}, groups...), sanitize(attribute.Key))
		}
		for _, nestedAttribute := range attribute.Value.Group() {
			handler.appendAttribute(output, nestedGroups, nestedAttribute)
		}

		return
	}

	keyParts := append(append([]string{}, groups...), sanitize(attribute.Key))
	output.WriteByte(' ')
	output.WriteString(strings.Join(keyParts, "."))
	output.WriteByte('=')
	output.WriteString(formatValue(attribute.Value))
}

// clone copies handler context while retaining the shared writer lock.
//
// Since: 2.4.0
func (handler *Handler) clone() *Handler {
	return &Handler{
		writer:     handler.writer,
		component:  handler.component,
		level:      handler.level,
		attributes: append([]slog.Attr{}, handler.attributes...),
		groups:     append([]string{}, handler.groups...),
		mutex:      handler.mutex,
	}
}

// formatValue converts a slog value into a safe single-line token.
//
// Since: 2.4.0
func formatValue(value slog.Value) string {
	var rendered string
	switch value.Kind() {
	case slog.KindString:
		rendered = value.String()
	case slog.KindTime:
		rendered = value.Time().UTC().Format(time.RFC3339)
	case slog.KindDuration:
		rendered = value.Duration().String()
	default:
		rendered = fmt.Sprint(value.Any())
	}

	rendered = sanitize(rendered)
	if strings.ContainsAny(rendered, " \t=\"") || rendered == "" {
		return strconv.Quote(rendered)
	}

	return rendered
}

// levelName normalizes custom slog levels to the four appliance severity names.
//
// Since: 2.4.0
func levelName(level slog.Level) string {
	switch {
	case level < slog.LevelInfo:
		return "DEBUG"
	case level < slog.LevelWarn:
		return "INFO"
	case level < slog.LevelError:
		return "WARN"
	default:
		return "ERROR"
	}
}

// sanitize escapes record separators while preserving the fact's text.
//
// Since: 2.4.0
func sanitize(value string) string {
	return strings.NewReplacer("\r", "\\r", "\n", "\\n").Replace(value)
}
