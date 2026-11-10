package notifications

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"
)

// testApp is the app every request test sends as.
var testApp = App{Key: "transmission-vpn", Name: "Transmission VPN"}

// capturedRequest is one request a fake transport received.
type capturedRequest struct {
	Method  string
	URL     string
	Headers http.Header
	Body    map[string]any
}

// fakeTransport answers every request with one status and body and remembers what it
// was sent, so no request leaves the machine.
type fakeTransport struct {
	status   int
	body     string
	err      error
	requests []capturedRequest
}

// RoundTrip records the request and returns the canned answer.
func (transport *fakeTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	captured := capturedRequest{Method: request.Method, URL: request.URL.String(), Headers: request.Header.Clone()}
	if request.Body != nil {
		content, _ := io.ReadAll(request.Body)
		_ = json.Unmarshal(content, &captured.Body)
	}
	transport.requests = append(transport.requests, captured)

	if transport.err != nil {
		return nil, transport.err
	}

	return &http.Response{
		StatusCode: transport.status,
		Body:       io.NopCloser(strings.NewReader(transport.body)),
		Header:     http.Header{},
		Request:    request,
	}, nil
}

// newTestSender returns a sender whose requests go to transport.
func newTestSender(transport *fakeTransport) *Sender {
	return &Sender{
		Client: &http.Client{Transport: transport},
		SendMail: func(context.Context, Mail) error {
			return errors.New("mail is not expected in this test")
		},
	}
}

// testNotification is a high-priority alert used by the request tests.
func testNotification() Notification {
	return Notification{
		Event:      "vpn-dropped",
		Title:      "VPN dropped",
		Message:    "The VPN went down & <stayed> down.",
		Priority:   "high",
		Tags:       []string{"warning"},
		OccurredAt: time.Date(2026, 10, 26, 12, 0, 0, 500_000_000, time.UTC),
		Details:    map[string]any{"lastError": "timeout"},
	}
}

// TestReadSettingsMessages checks the field messages, which match the other three apps.
func TestReadSettingsMessages(t *testing.T) {
	cases := []struct {
		service string
		body    string
		saved   []string
		issues  string
	}{
		{"ntfy", `{}`, nil, "settings.url=Enter the topic URL."},
		{"ntfy", `{"url":"https://ntfy.sh/"}`, nil, "settings.url=Use the full topic URL, like https://ntfy.sh/my-alerts."},
		{"ntfy", `{"url":"ftp://ntfy.sh/alerts"}`, nil, "settings.url=Use the full topic URL, like https://ntfy.sh/my-alerts."},
		{"ntfy", `{"url":"https://ntfy.sh/alerts","extra":"x"}`, nil, "settings.extra=This field isn't accepted."},
		{"ntfy", `"https://ntfy.sh/alerts"`, nil, "settings=Fill in the service settings."},
		{"ntfy", `{"url":42}`, nil, "settings.url=Enter the topic URL."},
		{"ntfy", `{"url":"https://ntfy.sh/alerts","token":7}`, nil, "settings.token=Check this value."},
		{"ntfy-reverse-proxy", `{"url":"http://alerts.example.com"}`, nil, "settings.url=Use an https:// URL."},
		{"discord", `{"webhookUrl":"https://example.com/hook"}`, nil, "settings.webhookUrl=Use a Discord webhook URL. It starts with https://discord.com/api/webhooks/."},
		{"slack", `{"webhookUrl":"https://hooks.example.com/x"}`, nil, "settings.webhookUrl=Use a Slack webhook URL. It starts with https://hooks.slack.com/."},
		{"matrix", `{"homeserverUrl":"https://matrix.org","roomId":"room:example.com","accessToken":"x"}`, nil, "settings.roomId=Use a room ID like !room:example.com; aliases starting with # aren't accepted."},
		{"matrix", `{"homeserverUrl":"https://matrix.org","roomId":"#room:example.com","accessToken":"x"}`, nil, "settings.roomId=Use a room ID like !room:example.com; aliases starting with # aren't accepted."},
		{"matrix", `{"homeserverUrl":"https://matrix.org","roomId":"!:example.com","accessToken":"x"}`, nil, "settings.roomId=Use a room ID like !room:example.com; aliases starting with # aren't accepted."},
		{"telegram", `{"chatId":"12345"}`, nil, "settings.botToken=Enter the bot token."},
		{"telegram", `{"chatId":"12345"}`, []string{"botToken"}, ""},
		{"telegram", `{"botToken":"","chatId":"12345"}`, []string{"botToken"}, ""},
		{"email", `{"host":"smtp.example.com","port":"0587","security":"starttls","from":"alerts@example.com","to":"me@example.com"}`, nil, "settings.port=Use a port from 1 to 65535."},
		{"email", `{"host":"smtp.example.com","port":"587","security":"ssl","from":"alerts@example.com","to":"me@example.com"}`, nil, "settings.security=Choose STARTTLS, TLS, or none."},
		{"email", `{"host":"smtp.example.com","port":"587","security":"tls","from":".alerts@example.com","to":"me@example.com, you@example"}`, nil, "settings.from=Use an email address, like alerts@example.com.|settings.to=Use email addresses separated by commas."},
		{"email", `{"host":"smtp.example.com","port":"123456","security":"tls","from":"alerts@example.com","to":"me@example.com"}`, nil, "settings.port=Use 5 characters or fewer."},
		{"gotify", `{"url":"https://push.example.com"}`, nil, "settings.token=Enter the app token."},
	}

	for _, testCase := range cases {
		_, _, issues := ReadSettings(testCase.service, json.RawMessage(testCase.body), testCase.saved)
		got := []string{}
		for _, issue := range issues {
			got = append(got, issue.Field+"="+issue.Message)
		}

		if strings.Join(got, "|") != testCase.issues {
			t.Errorf("%s %s: issues %q, want %q", testCase.service, testCase.body, strings.Join(got, "|"), testCase.issues)
		}
	}
}

// TestReadSettingsSplitsSecrets checks that values are trimmed, blank optional fields are
// left out, and secret fields are kept apart from plain ones.
func TestReadSettingsSplitsSecrets(t *testing.T) {
	settings, secrets, issues := ReadSettings("email", json.RawMessage(`{
		"host":" smtp.example.com ","port":"587","security":"starttls","username":"",
		"password":"hunter2","from":"alerts@example.com","to":"me@example.com, you@example.com"
	}`), nil)
	if len(issues) > 0 {
		t.Fatalf("issues: %+v", issues)
	}

	if settings["host"] != "smtp.example.com" || settings["to"] != "me@example.com, you@example.com" {
		t.Fatalf("settings = %+v", settings)
	}

	if _, found := settings["username"]; found {
		t.Fatalf("a blank optional field was kept: %+v", settings)
	}

	if len(secrets) != 1 || secrets["password"] != "hunter2" {
		t.Fatalf("secrets = %+v", secrets)
	}

	if keys := SecretKeys("webhook"); strings.Join(keys, ",") != "url,token" {
		t.Fatalf("webhook secret keys = %v", keys)
	}
}

// TestReadNameEventsAndService checks the other add and edit fields.
func TestReadNameEventsAndService(t *testing.T) {
	if _, message := ReadName(json.RawMessage(`"   "`)); message != "Name this notification." {
		t.Fatalf("blank name message %q", message)
	}

	if _, message := ReadName(json.RawMessage(`"` + strings.Repeat("é", 81) + `"`)); message != "Use 80 characters or fewer." {
		t.Fatalf("long name message %q", message)
	}

	if name, message := ReadName(json.RawMessage(`"  My phone "`)); name != "My phone" || message != "" {
		t.Fatalf("name %q, message %q", name, message)
	}

	if _, message := ReadService(json.RawMessage(`"carrier-pigeon"`)); message != "Choose a service." {
		t.Fatalf("unknown service message %q", message)
	}

	keys := []string{"vpn-dropped", "torrent-finished"}
	for body, want := range map[string]string{
		`null`:                               "events=Choose at least one event.",
		`[]`:                                 "events=Choose at least one event.",
		`["vpn-dropped","vpn-dropped"]`:      "events=Choose each event only once.",
		`["vpn-dropped","test"]`:             "events.1=Choose events from the list.",
		`[3]`:                                "events.0=Choose events from the list.",
		`["torrent-finished","vpn-dropped"]`: "",
	} {
		_, issues := ReadEvents(json.RawMessage(body), keys)
		got := []string{}
		for _, issue := range issues {
			got = append(got, issue.Field+"="+issue.Message)
		}

		if strings.Join(got, "|") != want {
			t.Errorf("events %s: issues %q, want %q", body, strings.Join(got, "|"), want)
		}
	}

	for body, want := range map[string]string{
		`null`:                   "clearSecrets=Choose an optional saved secret.",
		`["token","token"]`:      "clearSecrets=Choose each secret only once.",
		`["url"]`:                "clearSecrets.0=Choose an optional saved secret.",
		`["token"]`:              "",
		`[7]`:                    "clearSecrets.0=Choose an optional saved secret.",
		`["token","unexpected"]`: "clearSecrets.1=Choose an optional saved secret.",
	} {
		_, issues := ReadClearSecrets("webhook", json.RawMessage(body), []string{"token"})
		got := []string{}
		for _, issue := range issues {
			got = append(got, issue.Field+"="+issue.Message)
		}

		if strings.Join(got, "|") != want {
			t.Errorf("clear secrets %s: issues %q, want %q", body, strings.Join(got, "|"), want)
		}
	}

	// A token that was never saved, or that a lost key didn't remove, has nothing to clear.
	if _, issues := ReadClearSecrets("webhook", json.RawMessage(`["token"]`), nil); len(issues) != 1 || issues[0].Message != "Choose an optional saved secret." {
		t.Errorf("clear an unsaved token: issues %+v", issues)
	}
}

// TestBuildRequests checks the request each service gets, which matches the other apps.
func TestBuildRequests(t *testing.T) {
	cases := []struct {
		target Target
		check  func(t *testing.T, request capturedRequest)
	}{
		{
			Target{Service: "ntfy", Settings: map[string]string{"url": "https://ntfy.example.com/sub/my%20alerts"}, Secrets: map[string]string{"token": "tk_1"}},
			func(t *testing.T, request capturedRequest) {
				if request.URL != "https://ntfy.example.com/sub" || request.Headers.Get("Authorization") != "Bearer tk_1" {
					t.Fatalf("ntfy request %+v", request)
				}
				if request.Body["topic"] != "my alerts" || request.Body["title"] != "Transmission VPN: VPN dropped" || request.Body["priority"] != float64(4) {
					t.Fatalf("ntfy body %+v", request.Body)
				}
			},
		},
		{
			Target{Service: "ntfy-reverse-proxy", Settings: map[string]string{"url": "https://alerts.example.com"}, Secrets: map[string]string{}},
			func(t *testing.T, request capturedRequest) {
				if request.URL != "https://alerts.example.com" || request.Headers.Get("Authorization") != "" {
					t.Fatalf("ntfy-reverse-proxy request %+v", request)
				}
				if request.Body["version"] != float64(1) || request.Body["app"] != "transmission-vpn" || request.Body["event"] != "vpn-dropped" ||
					request.Body["title"] != "VPN dropped" || request.Body["occurredAt"] != "2026-10-26T12:00:00.500Z" || request.Body["priority"] != float64(4) {
					t.Fatalf("payload %+v", request.Body)
				}
			},
		},
		{
			Target{Service: "webhook", Settings: map[string]string{}, Secrets: map[string]string{"url": "https://hooks.example.com/in", "token": "abc"}},
			func(t *testing.T, request capturedRequest) {
				if request.URL != "https://hooks.example.com/in" || request.Headers.Get("Authorization") != "Bearer abc" || request.Body["app"] != "transmission-vpn" {
					t.Fatalf("webhook request %+v", request)
				}
			},
		},
		{
			Target{Service: "telegram", Settings: map[string]string{"chatId": "-100"}, Secrets: map[string]string{"botToken": "123:abc"}},
			func(t *testing.T, request capturedRequest) {
				if request.URL != "https://api.telegram.org/bot123:abc/sendMessage" || request.Body["chat_id"] != "-100" ||
					request.Body["text"] != "Transmission VPN: VPN dropped\n\nThe VPN went down & <stayed> down." || request.Body["disable_web_page_preview"] != true {
					t.Fatalf("telegram request %+v", request)
				}
			},
		},
		{
			Target{Service: "discord", Settings: map[string]string{}, Secrets: map[string]string{"webhookUrl": "https://discord.com/api/webhooks/1/x"}},
			func(t *testing.T, request capturedRequest) {
				embeds, _ := request.Body["embeds"].([]any)
				embed, _ := embeds[0].(map[string]any)
				if embed["color"] != float64(0xd04437) || embed["description"] != "The VPN went down & <stayed> down." || embed["timestamp"] != "2026-10-26T12:00:00.500Z" {
					t.Fatalf("discord embed %+v", embed)
				}
			},
		},
		{
			Target{Service: "slack", Settings: map[string]string{}, Secrets: map[string]string{"webhookUrl": "https://hooks.slack.com/services/x"}},
			func(t *testing.T, request capturedRequest) {
				if request.Body["text"] != "*Transmission VPN: VPN dropped*\nThe VPN went down &amp; &lt;stayed&gt; down." {
					t.Fatalf("slack text %q", request.Body["text"])
				}
			},
		},
		{
			Target{Service: "gotify", Settings: map[string]string{"url": "https://push.example.com//"}, Secrets: map[string]string{"token": "gk"}},
			func(t *testing.T, request capturedRequest) {
				if request.URL != "https://push.example.com/message" || request.Headers.Get("X-Gotify-Key") != "gk" || request.Body["priority"] != float64(8) {
					t.Fatalf("gotify request %+v", request)
				}
			},
		},
		{
			Target{Service: "pushover", Settings: map[string]string{}, Secrets: map[string]string{"userKey": "u1", "appToken": "a1"}},
			func(t *testing.T, request capturedRequest) {
				if request.URL != "https://api.pushover.net/1/messages.json" || request.Body["user"] != "u1" || request.Body["token"] != "a1" || request.Body["priority"] != float64(1) {
					t.Fatalf("pushover request %+v", request)
				}
			},
		},
		{
			Target{Service: "matrix", Settings: map[string]string{"homeserverUrl": "https://matrix.example.com/", "roomId": "!room:example.com"}, Secrets: map[string]string{"accessToken": "mx"}},
			func(t *testing.T, request capturedRequest) {
				prefix := "https://matrix.example.com/_matrix/client/v3/rooms/!room%3Aexample.com/send/m.room.message/"
				if request.Method != http.MethodPut || !strings.HasPrefix(request.URL, prefix) || len(strings.TrimPrefix(request.URL, prefix)) != 36 {
					t.Fatalf("matrix request %s %s", request.Method, request.URL)
				}
				if request.Headers.Get("Authorization") != "Bearer mx" || request.Body["body"] != "Transmission VPN: VPN dropped\nThe VPN went down & <stayed> down." {
					t.Fatalf("matrix request %+v", request)
				}
			},
		},
		{
			Target{Service: "apprise", Settings: map[string]string{}, Secrets: map[string]string{"url": "http://apprise:8000/notify/alerts", "urls": "tgram://x"}},
			func(t *testing.T, request capturedRequest) {
				if request.URL != "http://apprise:8000/notify/alerts" || request.Body["type"] != "warning" || request.Body["urls"] != "tgram://x" || request.Body["body"] != "The VPN went down & <stayed> down." {
					t.Fatalf("apprise request %+v", request)
				}
			},
		},
	}

	for _, testCase := range cases {
		transport := &fakeTransport{status: http.StatusOK}
		result := newTestSender(transport).Send(context.Background(), testApp, testCase.target, testNotification())
		if !result.Delivered || len(transport.requests) != 1 {
			t.Fatalf("%s: result %+v after %d requests", testCase.target.Service, result, len(transport.requests))
		}

		if transport.requests[0].Headers.Get("Content-Type") != "application/json" {
			t.Fatalf("%s: content type %q", testCase.target.Service, transport.requests[0].Headers.Get("Content-Type"))
		}

		testCase.check(t, transport.requests[0])
	}
}

// TestSendFailures checks the reasons a failed send reports, which never repeat a URL
// that can hold a token.
func TestSendFailures(t *testing.T) {
	target := Target{Service: "telegram", Settings: map[string]string{"chatId": "1"}, Secrets: map[string]string{"botToken": "123:secret"}}

	for body, want := range map[string]string{
		`{"ok":false,"error_code":401,"description":"Unauthorized"}`: "HTTP 401: Unauthorized",
		`{"message":"Unknown Webhook"}`:                              "HTTP 401: Unknown Webhook",
		`{"errcode":"M_FORBIDDEN","error":"Not in room"}`:            "HTTP 401: Not in room",
		"invalid_token\nmore detail":                                 "HTTP 401: invalid_token",
		`{"status":0}`:                                               "HTTP 401",
		``:                                                           "HTTP 401",
	} {
		result := newTestSender(&fakeTransport{status: http.StatusUnauthorized, body: body}).Send(context.Background(), testApp, target, testNotification())
		if result.Delivered || result.Message != want {
			t.Errorf("body %q: result %+v, want %q", body, result, want)
		}
	}

	mismatchReason := "This context reads Transmission VPN alerts, but the payload came from discord-stonker-bot. Set the context's interpreter to discord-stonker-bot."
	mismatchBody, err := json.Marshal(map[string]string{"message": mismatchReason})
	if err != nil {
		t.Fatalf("encode mismatch response: %v", err)
	}
	mismatch := newTestSender(&fakeTransport{status: http.StatusBadRequest, body: string(mismatchBody)}).Send(context.Background(), testApp, target, testNotification())
	if mismatch.Message != "HTTP 400: "+mismatchReason {
		t.Fatalf("the ntfy-reverse-proxy mismatch reason was cut off: %q", mismatch.Message)
	}

	refused := newTestSender(&fakeTransport{err: errors.New("dial tcp: connection refused")}).Send(context.Background(), testApp, target, testNotification())
	if refused.Delivered || strings.Contains(refused.Message, "secret") || !strings.Contains(refused.Message, "connection refused") || refused.Details != refused.Message {
		t.Fatalf("a refused connection reported %q", refused.Message)
	}

	timedOut := newTestSender(&fakeTransport{err: context.DeadlineExceeded}).Send(context.Background(), testApp, target, testNotification())
	if timedOut.Message != "No answer within 10 seconds." || timedOut.Details != context.DeadlineExceeded.Error() {
		t.Fatalf("a timeout reported %q", timedOut.Message)
	}

	var urlError error = &url.Error{Op: "Post", URL: "https://api.telegram.org/bot123:secret/sendMessage", Err: errors.New("EOF")}
	if message := describeError(urlError); message != "EOF" {
		t.Fatalf("a URL error reported %q", message)
	}
	if details := transportErrorDetails(urlError); details != "EOF" {
		t.Fatalf("URL error details = %q", details)
	}
}

// TestBuildPayloadShape checks the JSON body webhooks and ntfy-reverse-proxy get.
func TestBuildPayloadShape(t *testing.T) {
	encoded, err := encodeJSON(BuildPayload(testApp, BuildSignInLockedNotification("203.0.113.5")))
	if err != nil {
		t.Fatalf("encode payload: %v", err)
	}

	var payload map[string]any
	if err := json.Unmarshal(encoded, &payload); err != nil {
		t.Fatalf("decode payload %s: %v", encoded, err)
	}

	if payload["version"] != float64(1) || payload["event"] != "sign-in-locked" || payload["priority"] != float64(4) ||
		payload["message"] != "Ten failed sign-ins from 203.0.113.5. Sign-in from it is paused for 15 minutes." {
		t.Fatalf("payload %s", encoded)
	}

	details, _ := payload["details"].(map[string]any)
	tags, _ := payload["tags"].([]any)
	if details["address"] != "203.0.113.5" || len(tags) != 1 || tags[0] != "lock" {
		t.Fatalf("payload %s", encoded)
	}

	removed := BuildSecretsRemovedNotification(testApp, "installation key", []string{"the VPN profiles and login", "the Phone notification"})
	if removed.Message != "Transmission VPN started without its installation key, so it made a new one. Enter these again: the VPN profiles and login, the Phone notification." {
		t.Fatalf("secrets removed message %q", removed.Message)
	}

	test := BuildTestNotification(testApp)
	if test.Event != "test" || test.Message != "This is a test from Transmission VPN. Alerts for the events you chose will look like this." {
		t.Fatalf("test notification %+v", test)
	}
}

// TestSendMail sends one email through a fake SMTP server without security, signing in
// with LOGIN because that's all the server offers.
func TestSendMail(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer listener.Close()

	received := make(chan string, 1)
	go func() {
		connection, acceptError := listener.Accept()
		if acceptError != nil {
			received <- "accept failed: " + acceptError.Error()

			return
		}
		defer connection.Close()

		reader := bufio.NewReader(connection)
		write := func(line string) { _, _ = connection.Write([]byte(line + "\r\n")) }
		transcript := strings.Builder{}

		write("220 mail.example.com ready")
		for {
			line, readError := reader.ReadString('\n')
			if readError != nil {
				received <- transcript.String()

				return
			}

			command := strings.TrimRight(line, "\r\n")
			transcript.WriteString(command + "\n")
			switch {
			case strings.HasPrefix(command, "EHLO"):
				write("250-mail.example.com")
				write("250 AUTH LOGIN")
			case command == "AUTH LOGIN":
				write("334 VXNlcm5hbWU6")
			case command == "YWxlcnRz":
				write("334 UGFzc3dvcmQ6")
			case command == "aHVudGVyMg==":
				write("235 2.7.0 Authentication successful")
			case strings.HasPrefix(command, "MAIL FROM"), strings.HasPrefix(command, "RCPT TO"):
				write("250 OK")
			case command == "DATA":
				write("354 Go ahead")
				for {
					dataLine, dataError := reader.ReadString('\n')
					if dataError != nil {
						received <- transcript.String()

						return
					}

					transcript.WriteString(dataLine)
					if dataLine == ".\r\n" {
						break
					}
				}
				write("250 Queued")
			case command == "QUIT":
				write("221 Bye")
				received <- transcript.String()

				return
			default:
				write("502 Not implemented")
			}
		}
	}()

	port, _ := strconv.Atoi(strings.TrimPrefix(listener.Addr().String(), "127.0.0.1:"))
	if err := sendMail(context.Background(), Mail{
		Host:     "127.0.0.1",
		Port:     port,
		Security: "none",
		Username: "alerts",
		Password: "hunter2",
		From:     "alerts@example.com",
		To:       []string{"me@example.com", "you@example.com"},
		Subject:  "Transmission VPN: Torrent finished",
		Text:     "Ubuntu finished downloading.",
	}, (&net.Dialer{}).DialContext); err != nil {
		t.Fatalf("send mail: %v", err)
	}

	transcript := <-received
	for _, want := range []string{
		"AUTH LOGIN\n",
		"MAIL FROM:<alerts@example.com>",
		"RCPT TO:<me@example.com>",
		"RCPT TO:<you@example.com>",
		"Subject: Transmission VPN: Torrent finished\r\n",
		"To: me@example.com, you@example.com\r\n",
		"Content-Type: text/plain; charset=utf-8\r\n",
		"\r\nUbuntu finished downloading.",
	} {
		if !strings.Contains(transcript, want) {
			t.Fatalf("the mail transcript has no %q:\n%s", want, transcript)
		}
	}
}
