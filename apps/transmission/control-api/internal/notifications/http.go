package notifications

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/jsonbody"
)

// maximumResponseBytes bounds how much of a refused send's answer is read for its reason.
const maximumResponseBytes = 64 * 1024

// maximumResponseReasonCharacters keeps a service's useful explanation without letting
// an arbitrary response fill the destination row.
const maximumResponseReasonCharacters = 200

// RefusedError reports a service that answered a send with a non-2xx status.
//
// Reason already holds the status and the service's own short explanation, so Sender
// shows it as is and keeps transport details for real connection failures only.
//
// Since: 2.4.1
type RefusedError struct {
	Reason string
}

// Error returns the refusal reason, which never repeats the destination's URL.
//
// Since: 2.4.1
func (refusedError *RefusedError) Error() string {
	return refusedError.Reason
}

// sendHTTPRequest encodes one notifier's request, sends it, and checks the answer.
//
// Every HTTP notifier delivers through here, so the encoding, the URL error that hides
// tokens, and the refusal wording are the same for every service.
//
// Since: 2.4.1
func sendHTTPRequest(ctx context.Context, client *http.Client, request Request) error {
	encoded, err := encodeJSON(request.Body)
	if err != nil {
		return err
	}

	httpRequest, err := http.NewRequestWithContext(ctx, request.Method, request.URL, bytes.NewReader(encoded))
	if err != nil {
		// The parse error repeats the URL, which can hold a token.
		return errors.New("the destination's URL can't be used")
	}

	for name, value := range request.Headers {
		httpRequest.Header.Set(name, value)
	}

	response, err := client.Do(httpRequest)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode > 299 {
		return &RefusedError{Reason: describeResponse(response)}
	}

	_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, maximumResponseBytes))

	return nil
}

// trimTrailingSlashes removes trailing slashes before a fixed API path is appended.
//
// Since: 2.4.1
func trimTrailingSlashes(value string) string {
	return strings.TrimRight(value, "/")
}

// encodeJSON writes a request body without escaping <, >, and &, like the other apps.
func encodeJSON(value any) ([]byte, error) {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(jsonbody.Normalize(value)); err != nil {
		return nil, fmt.Errorf("encode notification: %w", err)
	}

	return bytes.TrimSuffix(buffer.Bytes(), []byte("\n")), nil
}

// describeResponse reports a refused send with its status and the service's own reason
// when it gives one.
//
// The reason is bounded so a long error page can't flood the destination row, while
// ntfy-reverse-proxy's interpreter guidance fits in full.
func describeResponse(response *http.Response) string {
	content, _ := io.ReadAll(io.LimitReader(response.Body, maximumResponseBytes))
	body := strings.TrimSpace(string(content))
	detail := ""

	var parsed any
	if err := json.Unmarshal([]byte(body), &parsed); err == nil {
		if values, isObject := parsed.(map[string]any); isObject {
			for _, key := range []string{"description", "message", "error"} {
				if candidate, isText := values[key].(string); isText && candidate != "" {
					detail = candidate

					break
				}
			}
		}
	} else {
		detail, _, _ = strings.Cut(body, "\n")
	}

	status := "HTTP " + strconv.Itoa(response.StatusCode)
	if detail == "" {
		return status
	}

	return status + ": " + truncate(detail, maximumResponseReasonCharacters)
}
