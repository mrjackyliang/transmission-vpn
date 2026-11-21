package notifications

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"os"
	"reflect"
	"strings"
	"testing"
)

// TestRequestsMatchGolden proves every service's request is byte-for-byte unchanged.
//
// testdata/requests.golden was written by the single-file request builder that came
// before the per-service notifiers, from the same targets and notifications.
//
// Since: 2.4.1
func TestRequestsMatchGolden(testingObject *testing.T) {
	want, err := os.ReadFile("testdata/requests.golden")
	if err != nil {
		testingObject.Fatalf("read request golden file: %v", err)
	}

	var got strings.Builder
	for _, notification := range goldenNotifications() {
		for _, target := range goldenTargets() {
			transport := &requestDumpTransport{}
			result := (&Sender{Client: &http.Client{Transport: transport}}).Send(context.Background(), testApp, target, notification)
			fmt.Fprintf(&got, "=== %s %s delivered=%t\n%s\n", target.Service, notification.Event, result.Delivered, strings.Join(transport.lines, "\n"))
		}
	}

	if got.String() != string(want) {
		testingObject.Fatalf("requests changed:\n%s\nwant:\n%s", got.String(), want)
	}
}

// TestHTTPNotifierBuildRequests checks each service's request without a network call.
//
// Since: 2.4.1
func TestHTTPNotifierBuildRequests(testingObject *testing.T) {
	tests := []struct {
		name        string
		target      Target
		wantMethod  string
		wantURL     string
		wantHeaders map[string]string
	}{
		{
			name:        "apprise",
			target:      Target{Service: "apprise", Secrets: map[string]string{"url": "http://apprise:8000/notify/alerts"}},
			wantMethod:  http.MethodPost,
			wantURL:     "http://apprise:8000/notify/alerts",
			wantHeaders: map[string]string{"Content-Type": "application/json"},
		},
		{
			name:        "discord",
			target:      Target{Service: "discord", Secrets: map[string]string{"webhookUrl": "https://discord.com/api/webhooks/1/x"}},
			wantMethod:  http.MethodPost,
			wantURL:     "https://discord.com/api/webhooks/1/x",
			wantHeaders: map[string]string{"Content-Type": "application/json"},
		},
		{
			name:        "gotify",
			target:      Target{Service: "gotify", Settings: map[string]string{"url": "https://push.example.com/"}, Secrets: map[string]string{"token": "gk"}},
			wantMethod:  http.MethodPost,
			wantURL:     "https://push.example.com/message",
			wantHeaders: map[string]string{"Content-Type": "application/json", "X-Gotify-Key": "gk"},
		},
		{
			name:        "ntfy",
			target:      Target{Service: "ntfy", Settings: map[string]string{"url": "https://ntfy.sh/alerts"}, Secrets: map[string]string{"token": "tk"}},
			wantMethod:  http.MethodPost,
			wantURL:     "https://ntfy.sh/",
			wantHeaders: map[string]string{"Authorization": "Bearer tk", "Content-Type": "application/json"},
		},
		{
			name:        "ntfy-reverse-proxy",
			target:      Target{Service: "ntfy-reverse-proxy", Settings: map[string]string{"url": "https://alerts.example.com"}, Secrets: map[string]string{}},
			wantMethod:  http.MethodPost,
			wantURL:     "https://alerts.example.com",
			wantHeaders: map[string]string{"Content-Type": "application/json"},
		},
		{
			name:        "pushover",
			target:      Target{Service: "pushover", Secrets: map[string]string{"userKey": "u1", "appToken": "a1"}},
			wantMethod:  http.MethodPost,
			wantURL:     "https://api.pushover.net/1/messages.json",
			wantHeaders: map[string]string{"Content-Type": "application/json"},
		},
		{
			name:        "slack",
			target:      Target{Service: "slack", Secrets: map[string]string{"webhookUrl": "https://hooks.slack.com/services/x"}},
			wantMethod:  http.MethodPost,
			wantURL:     "https://hooks.slack.com/services/x",
			wantHeaders: map[string]string{"Content-Type": "application/json"},
		},
		{
			name:        "telegram",
			target:      Target{Service: "telegram", Settings: map[string]string{"chatId": "-100"}, Secrets: map[string]string{"botToken": "123:abc"}},
			wantMethod:  http.MethodPost,
			wantURL:     "https://api.telegram.org/bot123:abc/sendMessage",
			wantHeaders: map[string]string{"Content-Type": "application/json"},
		},
		{
			name:        "webhook",
			target:      Target{Service: "webhook", Secrets: map[string]string{"url": "https://hooks.example.com/in", "token": "abc"}},
			wantMethod:  http.MethodPost,
			wantURL:     "https://hooks.example.com/in",
			wantHeaders: map[string]string{"Authorization": "Bearer abc", "Content-Type": "application/json"},
		},
	}

	for _, test := range tests {
		testingObject.Run(test.name, func(testingObject *testing.T) {
			notifier, err := NewHTTPNotifier(test.target)
			if err != nil {
				testingObject.Fatalf("create notifier: %v", err)
			}

			request := notifier.BuildRequest(testApp, testNotification())
			if request.Method != test.wantMethod || request.URL != test.wantURL {
				testingObject.Fatalf("request = %s %s, want %s %s", request.Method, request.URL, test.wantMethod, test.wantURL)
			}
			if !reflect.DeepEqual(request.Headers, test.wantHeaders) {
				testingObject.Fatalf("headers = %v, want %v", request.Headers, test.wantHeaders)
			}
		})
	}
}

// TestMatrixNotifierUsesNewTransactionIDs keeps a retried send from being dropped as a
// duplicate while every other part of the request stays the same.
//
// Since: 2.4.1
func TestMatrixNotifierUsesNewTransactionIDs(testingObject *testing.T) {
	notifier, err := NewHTTPNotifier(Target{
		Service:  "matrix",
		Settings: map[string]string{"homeserverUrl": "https://matrix.example.com", "roomId": "!room:example.com"},
		Secrets:  map[string]string{"accessToken": "mx"},
	})
	if err != nil {
		testingObject.Fatalf("create notifier: %v", err)
	}

	first := notifier.BuildRequest(testApp, testNotification())
	second := notifier.BuildRequest(testApp, testNotification())
	prefix := "https://matrix.example.com/_matrix/client/v3/rooms/!room%3Aexample.com/send/m.room.message/"
	if first.Method != http.MethodPut || !strings.HasPrefix(first.URL, prefix) || !strings.HasPrefix(second.URL, prefix) {
		testingObject.Fatalf("matrix requests = %s %s and %s", first.Method, first.URL, second.URL)
	}
	if first.URL == second.URL {
		testingObject.Fatalf("two sends reused transaction ID %s", first.URL)
	}
	if first.Headers["Authorization"] != "Bearer mx" {
		testingObject.Fatalf("matrix headers = %v", first.Headers)
	}
}

// TestEmailNotifierBuildsAndSendsMail checks the email defaults and hand-off.
//
// Since: 2.4.1
func TestEmailNotifierBuildsAndSendsMail(testingObject *testing.T) {
	tests := []struct {
		name     string
		settings map[string]string
		want     Mail
	}{
		{
			name: "defaults",
			settings: map[string]string{
				"host": "smtp.example.com",
				"from": "alerts@example.com",
				"to":   " me@example.com, ,you@example.com ",
			},
			want: Mail{
				Host:     "smtp.example.com",
				Port:     587,
				Security: "starttls",
				Password: "hunter2",
				From:     "alerts@example.com",
				To:       []string{"me@example.com", "you@example.com"},
				Subject:  "Transmission VPN: VPN dropped",
				Text:     "The VPN went down & <stayed> down.",
			},
		},
		{
			name: "explicit server",
			settings: map[string]string{
				"host":     "mail.example.com",
				"port":     "465",
				"security": "tls",
				"username": "alerts",
				"from":     "alerts@example.com",
				"to":       "me@example.com",
			},
			want: Mail{
				Host:     "mail.example.com",
				Port:     465,
				Security: "tls",
				Username: "alerts",
				Password: "hunter2",
				From:     "alerts@example.com",
				To:       []string{"me@example.com"},
				Subject:  "Transmission VPN: VPN dropped",
				Text:     "The VPN went down & <stayed> down.",
			},
		},
	}

	for _, test := range tests {
		testingObject.Run(test.name, func(testingObject *testing.T) {
			target := Target{Service: "email", Settings: test.settings, Secrets: map[string]string{"password": "hunter2"}}
			var sent []Mail
			sender := &Sender{
				Client: &http.Client{Transport: &fakeTransport{err: errors.New("HTTP is not expected for email")}},
				SendMail: func(_ context.Context, mail Mail) error {
					sent = append(sent, mail)

					return nil
				},
			}

			result := sender.Send(context.Background(), testApp, target, testNotification())
			if !result.Delivered || len(sent) != 1 {
				testingObject.Fatalf("result = %+v after %d mails", result, len(sent))
			}
			if !reflect.DeepEqual(sent[0], test.want) {
				testingObject.Fatalf("mail = %+v, want %+v", sent[0], test.want)
			}
		})
	}

	failing := &Sender{SendMail: func(context.Context, Mail) error {
		return errors.New("550 mailbox unavailable")
	}}
	result := failing.Send(context.Background(), testApp, Target{Service: "email", Settings: map[string]string{}}, testNotification())
	if result.Delivered || result.Message != "550 mailbox unavailable" || result.Details != "550 mailbox unavailable" {
		testingObject.Fatalf("failed mail result = %+v", result)
	}
}

// TestRegistryPicksEachService maps every stored service to its own notifier.
//
// Since: 2.4.1
func TestRegistryPicksEachService(testingObject *testing.T) {
	tests := []struct {
		service string
		want    any
	}{
		{service: "apprise", want: &appriseNotifier{}},
		{service: "discord", want: &discordNotifier{}},
		{service: "email", want: &emailNotifier{}},
		{service: "gotify", want: &gotifyNotifier{}},
		{service: "matrix", want: &matrixNotifier{}},
		{service: "ntfy", want: &ntfyNotifier{}},
		{service: "ntfy-reverse-proxy", want: &ntfyReverseProxyNotifier{}},
		{service: "pushover", want: &pushoverNotifier{}},
		{service: "slack", want: &slackNotifier{}},
		{service: "telegram", want: &telegramNotifier{}},
		{service: "webhook", want: &webhookNotifier{}},
	}

	if len(tests) != len(Services) {
		testingObject.Fatalf("registry test covers %d services, catalog has %d", len(tests), len(Services))
	}
	for _, test := range tests {
		testingObject.Run(test.service, func(testingObject *testing.T) {
			if _, found := Services[test.service]; !found {
				testingObject.Fatalf("%s is not in the service catalog", test.service)
			}

			notifier, err := NewNotifier(Target{Service: test.service})
			if err != nil {
				testingObject.Fatalf("create notifier: %v", err)
			}
			if reflect.TypeOf(notifier) != reflect.TypeOf(test.want) {
				testingObject.Fatalf("notifier = %T, want %T", notifier, test.want)
			}

			_, httpError := NewHTTPNotifier(Target{Service: test.service})
			if (test.service == "email") != errors.Is(httpError, errUnsupportedService) {
				testingObject.Fatalf("HTTP notifier error for %s = %v", test.service, httpError)
			}
		})
	}
}

// TestRegistryRejectsUnknownService keeps an unknown service from sending anywhere.
//
// Since: 2.4.1
func TestRegistryRejectsUnknownService(testingObject *testing.T) {
	if _, err := NewNotifier(Target{Service: "carrier-pigeon"}); !errors.Is(err, errUnsupportedService) {
		testingObject.Fatalf("unknown service error = %v", err)
	}

	transport := &fakeTransport{status: http.StatusOK}
	result := newTestSender(transport).Send(context.Background(), testApp, Target{Service: "carrier-pigeon"}, testNotification())
	if result.Delivered || result.Message != errUnsupportedService.Error() || len(transport.requests) != 0 {
		testingObject.Fatalf("unknown service result = %+v after %d requests", result, len(transport.requests))
	}
}

// TestSharedHTTPDeliveryErrors keeps one error wording for every HTTP notifier.
//
// Since: 2.4.1
func TestSharedHTTPDeliveryErrors(testingObject *testing.T) {
	refused := newTestSender(&fakeTransport{status: http.StatusForbidden, body: `{"message":"Bad token"}`}).Send(
		context.Background(),
		testApp,
		Target{Service: "webhook", Secrets: map[string]string{"url": "https://hooks.example.com/in"}},
		testNotification(),
	)
	if refused.Delivered || refused.Message != "HTTP 403: Bad token" || refused.Details != "" {
		testingObject.Fatalf("refused send = %+v", refused)
	}

	badURL := newTestSender(&fakeTransport{status: http.StatusOK}).Send(
		context.Background(),
		testApp,
		Target{Service: "webhook", Secrets: map[string]string{"url": "https://hooks.example.com/%zz?token=secret"}},
		testNotification(),
	)
	if badURL.Delivered || badURL.Message != "the destination's URL can't be used" ||
		badURL.Details != badURL.Message || strings.Contains(badURL.Message+badURL.Details, "secret") {
		testingObject.Fatalf("bad URL send = %+v", badURL)
	}

	// Inputs that fail while the request is being built still come back as a failed
	// result, never a panic or an error that skips Sender's result path.
	unencodable := testNotification()
	unencodable.Details = map[string]any{"ratio": math.NaN()}
	buildFailures := []struct {
		name         string
		target       Target
		notification Notification
		wantMessage  string
	}{
		{
			name:         "payload that can't be encoded",
			target:       Target{Service: "webhook", Secrets: map[string]string{"url": "https://hooks.example.com/in"}},
			notification: unencodable,
			wantMessage:  "encode notification: json: unsupported value: NaN",
		},
		{
			name: "matrix homeserver and room that can't form a URL",
			target: Target{
				Service:  "matrix",
				Settings: map[string]string{"homeserverUrl": "https://matrix.example.com\x7f", "roomId": "!r\xff\x00:example.com"},
				Secrets:  map[string]string{"accessToken": "secret-token"},
			},
			notification: testNotification(),
			wantMessage:  "the destination's URL can't be used",
		},
	}
	for _, failure := range buildFailures {
		transport := &fakeTransport{status: http.StatusOK}
		result := newTestSender(transport).Send(context.Background(), testApp, failure.target, failure.notification)
		if result.Delivered || result.Message != failure.wantMessage || result.Details != failure.wantMessage ||
			strings.Contains(result.Message, "secret") || len(transport.requests) != 0 {
			testingObject.Fatalf("%s: result = %+v after %d requests", failure.name, result, len(transport.requests))
		}
	}

	var refusedError error = &RefusedError{Reason: "HTTP 500"}
	if refusedError.Error() != "HTTP 500" {
		testingObject.Fatalf("refused error = %q", refusedError.Error())
	}
}
