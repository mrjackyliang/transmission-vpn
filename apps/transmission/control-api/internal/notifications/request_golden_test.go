package notifications

import (
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"
)

// goldenTargets covers every HTTP service, with and without its optional secrets.
//
// The request golden file was written from these targets by the single-file request
// builder this package used before the per-service notifiers, so a match proves the
// requests stayed byte-for-byte the same.
//
// Since: 2.4.1
func goldenTargets() []Target {
	return []Target{
		{Service: "apprise", Settings: map[string]string{}, Secrets: map[string]string{"url": "http://apprise:8000/notify/alerts", "urls": "tgram://x"}},
		{Service: "apprise", Settings: map[string]string{}, Secrets: map[string]string{"url": "https://apprise.example.com/notify"}},
		{Service: "discord", Settings: map[string]string{}, Secrets: map[string]string{"webhookUrl": "https://discord.com/api/webhooks/1/x"}},
		{Service: "gotify", Settings: map[string]string{"url": "https://push.example.com//"}, Secrets: map[string]string{"token": "gk"}},
		{Service: "matrix", Settings: map[string]string{"homeserverUrl": "https://matrix.example.com/", "roomId": "!room:example.com"}, Secrets: map[string]string{"accessToken": "mx"}},
		{Service: "ntfy", Settings: map[string]string{"url": "https://ntfy.example.com/sub/my%20alerts"}, Secrets: map[string]string{"token": "tk_1"}},
		{Service: "ntfy", Settings: map[string]string{"url": "https://ntfy.sh/alerts?x=1#frag"}, Secrets: map[string]string{}},
		{Service: "ntfy-reverse-proxy", Settings: map[string]string{"url": "https://alerts.example.com"}, Secrets: map[string]string{}},
		{Service: "ntfy-reverse-proxy", Settings: map[string]string{"url": "https://alerts.example.com/ctx"}, Secrets: map[string]string{"token": "rp"}},
		{Service: "pushover", Settings: map[string]string{}, Secrets: map[string]string{"userKey": "u1", "appToken": "a1"}},
		{Service: "slack", Settings: map[string]string{}, Secrets: map[string]string{"webhookUrl": "https://hooks.slack.com/services/x"}},
		{Service: "telegram", Settings: map[string]string{"chatId": "-100"}, Secrets: map[string]string{"botToken": "123:abc"}},
		{Service: "webhook", Settings: map[string]string{}, Secrets: map[string]string{"url": "https://hooks.example.com/in", "token": "abc"}},
		{Service: "webhook", Settings: map[string]string{}, Secrets: map[string]string{"url": "https://hooks.example.com/plain"}},
	}
}

// goldenNotifications covers each priority, missing tags and details, and text that
// JSON or Slack would escape.
//
// Since: 2.4.1
func goldenNotifications() []Notification {
	return []Notification{
		{
			Event:      "vpn-dropped",
			Title:      "VPN dropped",
			Message:    "The VPN went down & <stayed> down.",
			Priority:   "high",
			Tags:       []string{"warning"},
			OccurredAt: time.Date(2026, 10, 26, 12, 0, 0, 500_000_000, time.UTC),
			Details:    map[string]any{"lastError": "timeout", "items": []string(nil)},
		},
		{
			Event:      "torrent-finished",
			Title:      "Torrent finished",
			Message:    "Ubuntu 26.04 finished downloading.",
			Priority:   "default",
			OccurredAt: time.Date(2026, 11, 1, 8, 30, 15, 0, time.FixedZone("UTC+8", 8*60*60)),
		},
		{
			Event:      "test",
			Title:      "Tést \"quoted\"",
			Message:    "Línea uno\nline two\ttabbed\r end",
			Priority:   "low",
			Tags:       []string{},
			OccurredAt: time.Date(2026, 1, 2, 3, 4, 5, 6_000_000, time.UTC),
			Details:    map[string]any{},
		},
	}
}

// requestDumpTransport records each request's method, URL, headers, and raw body.
//
// Matrix's random transaction ID is masked so the dump is stable.
//
// Since: 2.4.1
type requestDumpTransport struct {
	lines []string
}

// RoundTrip records the request and answers 200 without leaving the machine.
//
// Since: 2.4.1
func (transport *requestDumpTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	body, _ := io.ReadAll(request.Body)
	names := []string{}
	for name := range request.Header {
		names = append(names, name)
	}
	sort.Strings(names)
	headers := []string{}
	for _, name := range names {
		headers = append(headers, name+"="+strings.Join(request.Header[name], ","))
	}
	address := request.URL.String()
	if strings.Contains(address, "/send/m.room.message/") {
		address = address[:strings.LastIndex(address, "/")+1] + "<txn>"
	}
	transport.lines = append(transport.lines, fmt.Sprintf("%s %s\n%s\n%s", request.Method, address, strings.Join(headers, "|"), body))

	return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader("")), Header: http.Header{}, Request: request}, nil
}
