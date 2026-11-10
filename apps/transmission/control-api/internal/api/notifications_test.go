package api

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/controller"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/notifications"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

// recordedSend is one notification a test destination received.
type recordedSend struct {
	Target       notifications.Target
	Notification notifications.Notification
}

// fakeSender records every send and answers each one with result, so no test reaches
// the network.
type fakeSender struct {
	mutex  sync.Mutex
	result notifications.Result
	sends  []recordedSend
}

// send records one notification and returns the canned result.
func (sender *fakeSender) send(
	_ context.Context,
	_ notifications.App,
	target notifications.Target,
	notification notifications.Notification,
) notifications.Result {
	sender.mutex.Lock()
	defer sender.mutex.Unlock()

	sender.sends = append(sender.sends, recordedSend{Target: target, Notification: notification})

	return sender.result
}

// recorded returns the sends so far.
func (sender *fakeSender) recorded() []recordedSend {
	sender.mutex.Lock()
	defer sender.mutex.Unlock()

	return slices.Clone(sender.sends)
}

// byEvent sorts sends by event so a test can check sends that ran at the same time.
func byEvent(sends []recordedSend) []recordedSend {
	slices.SortStableFunc(sends, func(left recordedSend, right recordedSend) int {
		return strings.Compare(left.Notification.Event, right.Notification.Event)
	})

	return sends
}

// setResult changes what later sends answer.
func (sender *fakeSender) setResult(result notifications.Result) {
	sender.mutex.Lock()
	defer sender.mutex.Unlock()

	sender.result = result
}

// newFakeSender installs a fake sender on a test server's notifier.
func newFakeSender(server *Server) *fakeSender {
	sender := &fakeSender{result: notifications.Result{Delivered: true}}
	server.notifier.send = sender.send

	return sender
}

// createTestNotification adds a destination the way the dialog does and returns it.
func createTestNotification(t *testing.T, server *Server, cookies []*http.Cookie, csrfToken string, body string) notificationResponse {
	t.Helper()

	response := performRequest(t, server, http.MethodPost, "/api/v1/notifications", body, cookies, csrfToken)
	if response.Code != http.StatusCreated {
		t.Fatalf("create notification %s: %d %s", body, response.Code, response.Body.String())
	}

	var created notificationResponse
	decodeBody(t, response, &created)

	return created
}

// TestNotificationRoutes adds, lists, edits, tests, and removes destinations, with the
// same codes and words as the other three apps.
func TestNotificationRoutes(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)
	sender := newFakeSender(server)

	events := performRequest(t, server, http.MethodGet, "/api/v1/notifications/events", "", cookies, "")
	var eventsBody listResponse[notificationEventResponse]
	decodeBody(t, events, &eventsBody)
	keys := []string{}
	for _, event := range eventsBody.Items {
		keys = append(keys, event.Key)
	}
	if strings.Join(keys, ",") != "secrets-removed,sign-in-locked,vpn-dropped,vpn-restored,torrent-finished,torrent-error,profile-choice-needed" ||
		!eventsBody.Items[2].DefaultEnabled || !eventsBody.Items[6].DefaultEnabled {
		t.Fatalf("events = %s", events.Body.String())
	}

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/notifications",
		`{"name":"","events":[],"settings":{}}`, cookies, csrfToken),
		http.StatusUnprocessableEntity, "invalid_request", "Choose a service.", "service")

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/notifications",
		`{"name":"","service":"telegram","events":["vpn-dropped"],"settings":{"chatId":"-100"}}`, cookies, csrfToken),
		http.StatusUnprocessableEntity, "invalid_request", "Name this notification.", "name", "settings.botToken")

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/notifications",
		`{"name":"Chat","service":"telegram","events":["vpn-dropped"],"settings":{"chatId":"-100"},"color":"blue"}`, cookies, csrfToken),
		http.StatusUnprocessableEntity, "invalid_request", "This field isn't accepted.", "color")

	chat := createTestNotification(t, server, cookies, csrfToken,
		`{"name":" Homelab chat ","service":"telegram","events":["vpn-dropped","torrent-error"],"settings":{"botToken":"123:fixture","chatId":"-100"}}`)
	if chat.Name != "Homelab chat" || !chat.Secrets["botToken"] || chat.Settings["chatId"] != "-100" || len(chat.SecretsMissing) != 0 || !validNotificationID(chat.ID) {
		t.Fatalf("created = %+v", chat)
	}

	expectError(t, performRequest(t, server, http.MethodPost, "/api/v1/notifications",
		`{"name":"HOMELAB CHAT","service":"ntfy","events":["vpn-dropped"],"settings":{"url":"https://ntfy.sh/tvpn"}}`, cookies, csrfToken),
		http.StatusConflict, "notification_exists", "A notification with this name already exists.", "name")

	list := performRequest(t, server, http.MethodGet, "/api/v1/notifications", "", cookies, "")
	if list.Code != http.StatusOK || strings.Contains(list.Body.String(), "123:fixture") || !strings.Contains(list.Body.String(), `"secrets":{"botToken":true}`) {
		t.Fatalf("list = %d %s", list.Code, list.Body.String())
	}

	edited := performRequest(t, server, http.MethodPut, "/api/v1/notifications/"+chat.ID,
		`{"name":"Chat","events":["vpn-restored"],"settings":{"botToken":"","chatId":"-200"}}`, cookies, csrfToken)
	var editedBody notificationResponse
	decodeBody(t, edited, &editedBody)
	if edited.Code != http.StatusOK || editedBody.Name != "Chat" || !editedBody.Secrets["botToken"] || editedBody.Settings["chatId"] != "-200" {
		t.Fatalf("edit = %d %s", edited.Code, edited.Body.String())
	}

	expectError(t, performRequest(t, server, http.MethodPut, "/api/v1/notifications/"+chat.ID,
		`{"name":"Chat","service":"slack","events":["vpn-restored"],"settings":{"chatId":"-200"}}`, cookies, csrfToken),
		http.StatusUnprocessableEntity, "invalid_request", "The service can't be changed.", "service")

	test := performRequest(t, server, http.MethodPost, "/api/v1/notifications/"+chat.ID+"/test", "", cookies, csrfToken)
	if test.Code != http.StatusOK || strings.TrimSpace(test.Body.String()) != `{"delivered":true}` {
		t.Fatalf("test = %d %s", test.Code, test.Body.String())
	}

	sends := sender.recorded()
	if len(sends) != 1 || sends[0].Target.Secrets["botToken"] != "123:fixture" || sends[0].Target.Settings["chatId"] != "-200" || sends[0].Notification.Event != "test" {
		t.Fatalf("the test send = %+v", sends)
	}

	sender.setResult(notifications.Result{Message: "HTTP 401: Unauthorized"})
	failedTest := performRequest(t, server, http.MethodPost, "/api/v1/notifications/"+chat.ID+"/test", "", cookies, csrfToken)
	if strings.TrimSpace(failedTest.Body.String()) != `{"delivered":false,"message":"HTTP 401: Unauthorized"}` {
		t.Fatalf("failed test = %s", failedTest.Body.String())
	}

	afterTest := performRequest(t, server, http.MethodGet, "/api/v1/notifications", "", cookies, "")
	if !strings.Contains(afterTest.Body.String(), `"lastError":"HTTP 401: Unauthorized"`) {
		t.Fatalf("the failed test wasn't recorded: %s", afterTest.Body.String())
	}

	rawTransportError := "dial tcp 127.0.0.1:9: connect: connection refused"
	sender.setResult(notifications.Result{Message: rawTransportError})
	transportTest := performRequest(t, server, http.MethodPost, "/api/v1/notifications/"+chat.ID+"/test", "", cookies, csrfToken)
	if strings.TrimSpace(transportTest.Body.String()) != `{"delivered":false,"message":"127.0.0.1 refused the connection. Check the address.","details":"dial tcp 127.0.0.1:9: connect: connection refused"}` {
		t.Fatalf("transport test = %s", transportTest.Body.String())
	}

	afterTransportTest := performRequest(t, server, http.MethodGet, "/api/v1/notifications", "", cookies, "")
	if !strings.Contains(afterTransportTest.Body.String(), `"lastError":"127.0.0.1 refused the connection. Check the address."`) ||
		!strings.Contains(afterTransportTest.Body.String(), `"lastErrorDetails":"`+rawTransportError+`"`) {
		t.Fatalf("the transport detail wasn't preserved: %s", afterTransportTest.Body.String())
	}

	if response := performRequest(t, server, http.MethodPost, "/api/v1/notifications/"+chat.ID+"/test", "", cookies, ""); response.Code != http.StatusForbidden {
		t.Fatalf("a test without CSRF status %d", response.Code)
	}

	_, tokenValue := createTestToken(t, server, cookies, csrfToken, `{"name":"Status board","scopes":["settings:write"]}`)
	expectError(t, bearerRequest(server, http.MethodGet, "/api/v1/notifications", tokenValue),
		http.StatusForbidden, "session_required", "An administrator browser session is required.")

	if response := performRequest(t, server, http.MethodDelete, "/api/v1/notifications/"+chat.ID, "", cookies, csrfToken); response.Code != http.StatusNoContent {
		t.Fatalf("delete status %d: %s", response.Code, response.Body.String())
	}

	for _, request := range []struct {
		method string
		path   string
		body   string
	}{
		{http.MethodDelete, "/api/v1/notifications/" + chat.ID, ""},
		{http.MethodPut, "/api/v1/notifications/" + chat.ID, `{"name":"Chat","events":["vpn-restored"],"settings":{}}`},
		{http.MethodPost, "/api/v1/notifications/" + chat.ID + "/test", ""},
		{http.MethodDelete, "/api/v1/notifications/not-a-destination", ""},
	} {
		expectError(t, performRequest(t, server, request.method, request.path, request.body, cookies, csrfToken),
			http.StatusNotFound, "notification_not_found", "That notification no longer exists.")
	}
}

// TestPublicNotificationFailure maps transport errors and keeps already-plain messages.
func TestPublicNotificationFailure(t *testing.T) {
	testCases := []struct {
		raw     string
		message string
		details bool
	}{
		{"dial tcp: connect: connection refused", "The destination refused the connection.", true},
		{"dial tcp: lookup hooks.example.test: no such host", "Couldn't find hooks.example.test. Check the address.", true},
		{"dial tcp 192.0.2.20:443: connect: connection refused", "192.0.2.20 refused the connection. Check the address.", true},
		{"read tcp: i/o timeout", "The destination timed out.", true},
		{"tls: failed to verify certificate: x509: unknown authority", "The secure connection to the destination failed.", true},
		{"dial tcp: network is unreachable", "The destination is unreachable.", true},
		{"HTTP 401: Unauthorized", "HTTP 401: Unauthorized", false},
		{"No answer within 10 seconds.", "No answer within 10 seconds.", false},
	}

	for _, testCase := range testCases {
		message, details := publicNotificationFailure(testCase.raw)
		if message != testCase.message || (details != nil) != testCase.details {
			t.Errorf("publicNotificationFailure(%q) = %q, %v", testCase.raw, message, details)
		}
		if details != nil && *details != testCase.raw {
			t.Errorf("details = %q, want %q", *details, testCase.raw)
		}
	}
}

// TestNotificationOptionalSecretClearing removes an optional saved token without
// rebuilding the destination and lets a deliberately omitted lost token resume sends.
func TestNotificationOptionalSecretClearing(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)
	sender := newFakeSender(server)

	phone := createTestNotification(t, server, cookies, csrfToken,
		`{"name":"Phone","service":"ntfy","events":["vpn-dropped"],"settings":{"url":"https://ntfy.sh/tvpn","token":"saved-token"}}`)

	expectError(t, performRequest(t, server, http.MethodPut, "/api/v1/notifications/"+phone.ID,
		`{"name":"Phone","events":["vpn-dropped"],"settings":{"url":"https://ntfy.sh/tvpn","token":"new-token"},"clearSecrets":["token"]}`, cookies, csrfToken),
		http.StatusUnprocessableEntity, "invalid_request", "Enter a new value or clear this field, not both.", "settings.token")

	cleared := performRequest(t, server, http.MethodPut, "/api/v1/notifications/"+phone.ID,
		`{"name":"Phone","events":["vpn-dropped"],"settings":{"url":"https://ntfy.sh/tvpn"},"clearSecrets":["token"]}`, cookies, csrfToken)
	var clearedBody notificationResponse
	decodeBody(t, cleared, &clearedBody)
	if cleared.Code != http.StatusOK || len(clearedBody.Secrets) != 0 || len(clearedBody.SecretsMissing) != 0 {
		t.Fatalf("clear saved token = %d %s", cleared.Code, cleared.Body.String())
	}

	test := performRequest(t, server, http.MethodPost, "/api/v1/notifications/"+phone.ID+"/test", "", cookies, csrfToken)
	if test.Code != http.StatusOK {
		t.Fatalf("test after clearing token = %d %s", test.Code, test.Body.String())
	}

	sends := sender.recorded()
	if len(sends) != 1 || len(sends[0].Target.Secrets) != 0 {
		t.Fatalf("send after clearing token = %+v", sends)
	}

	expectError(t, performRequest(t, server, http.MethodPut, "/api/v1/notifications/"+phone.ID,
		`{"name":"Phone","events":["vpn-dropped"],"settings":{"url":"https://ntfy.sh/tvpn"},"clearSecrets":["url"]}`, cookies, csrfToken),
		http.StatusUnprocessableEntity, "invalid_request", "Choose an optional saved secret.", "clearSecrets.0")
}

// TestSignInLimitNotification checks that ten failed sign-ins from one address send
// one alert to the destinations that chose it, once per window.
func TestSignInLimitNotification(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)
	sender := newFakeSender(server)

	createTestNotification(t, server, cookies, csrfToken,
		`{"name":"Phone","service":"ntfy","events":["sign-in-locked"],"settings":{"url":"https://ntfy.sh/tvpn"}}`)
	createTestNotification(t, server, cookies, csrfToken,
		`{"name":"Torrents only","service":"ntfy","events":["torrent-finished"],"settings":{"url":"https://ntfy.sh/torrents"}}`)

	for range signInAttemptLimit + 1 {
		performRequest(t, server, http.MethodPost, "/api/v1/auth/login", `{"username":"administrator","password":"wrong password"}`, nil, "")
	}

	server.notifier.notifySignInLimit("sign-in:192.0.2.1")
	server.notifier.notifySignInLimit("claim:192.0.2.1")
	server.notifier.sends.Wait()

	sends := sender.recorded()
	if len(sends) != 1 || sends[0].Target.Settings["url"] != "https://ntfy.sh/tvpn" ||
		sends[0].Notification.Message != "Ten failed sign-ins from 192.0.2.1. Sign-in from it is paused for 15 minutes." {
		t.Fatalf("sends = %+v", sends)
	}
}

// TestLostKeyNotification checks that a lost key lists a destination's removed secrets
// in the notice, alerts the destinations that can still be sent to, and that entering
// the secrets again clears the notice entry.
func TestLostKeyNotification(t *testing.T) {
	received := make(chan map[string]any, 2)
	ntfyServer := httptest.NewServer(http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
		var body map[string]any
		_ = json.NewDecoder(request.Body).Decode(&body)
		received <- body
	}))
	defer ntfyServer.Close()

	ctx := context.Background()
	temporaryDirectory := t.TempDir()
	keyPath := filepath.Join(temporaryDirectory, "keys", "installation.key")
	store, err := storage.Open(ctx, filepath.Join(temporaryDirectory, "state.sqlite3"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(func() { _ = store.Close() })

	first, err := PrepareInstallationKey(ctx, store, keyPath)
	if err != nil {
		t.Fatalf("first start: %v", err)
	}

	server, cookies, csrfToken := claimKeyTestServer(t, store, first.Key)
	chat := createTestNotification(t, server, cookies, csrfToken,
		`{"name":"Homelab chat","service":"telegram","events":["secrets-removed"],"settings":{"botToken":"123:fixture","chatId":"-100"}}`)
	optional := createTestNotification(t, server, cookies, csrfToken,
		`{"name":"Optional token","service":"ntfy","events":["vpn-dropped"],"settings":{"url":"`+ntfyServer.URL+`/optional","token":"fixture-token"}}`)
	createTestNotification(t, server, cookies, csrfToken,
		`{"name":"Phone","service":"ntfy","events":["secrets-removed"],"settings":{"url":"`+ntfyServer.URL+`/tvpn-alerts"}}`)

	if err := os.Remove(keyPath); err != nil {
		t.Fatalf("remove installation key: %v", err)
	}

	replaced, err := PrepareInstallationKey(ctx, store, keyPath)
	if err != nil || strings.Join(replaced.Removed, "|") != "the Homelab chat notification|the Optional token notification" {
		t.Fatalf("replace key = %+v, %v", replaced, err)
	}

	NotifySecretsRemoved(store, replaced.Key, slog.New(slog.NewTextHandler(io.Discard, nil)), replaced.Removed, nil)

	select {
	case body := <-received:
		if body["topic"] != "tvpn-alerts" || body["title"] != "Transmission VPN: Saved secrets were removed" ||
			body["message"] != "Transmission VPN started without its installation key, so it made a new one. Enter these again: the Homelab chat notification, the Optional token notification." {
			t.Fatalf("ntfy received %+v", body)
		}
	default:
		t.Fatal("the destination without secrets got no alert")
	}

	if len(received) != 0 {
		t.Fatal("the destination whose secret was removed got an alert")
	}

	restarted := newKeyTestServer(t, store, replaced.Key)
	me := performRequest(t, restarted, http.MethodGet, "/api/v1/auth/me", "", cookies, "")
	if !strings.Contains(me.Body.String(), `"kind":"notification","name":"Homelab chat","notificationId":"`+chat.ID+`"`) {
		t.Fatalf("me = %s", me.Body.String())
	}

	test := performRequest(t, restarted, http.MethodPost, "/api/v1/notifications/"+chat.ID+"/test", "", cookies, csrfToken)
	if strings.TrimSpace(test.Body.String()) != `{"delivered":false,"message":"Enter the removed secrets again first."}` {
		t.Fatalf("test before the secret is back = %s", test.Body.String())
	}

	clearedOptional := performRequest(t, restarted, http.MethodPut, "/api/v1/notifications/"+optional.ID,
		`{"name":"Optional token","events":["vpn-dropped"],"settings":{"url":"`+ntfyServer.URL+`/optional"},"clearSecrets":["token"]}`, cookies, csrfToken)
	if clearedOptional.Code != http.StatusOK || !strings.Contains(clearedOptional.Body.String(), `"secretsMissing":[]`) {
		t.Fatalf("continue without the optional token = %d %s", clearedOptional.Code, clearedOptional.Body.String())
	}

	optionalTest := performRequest(t, restarted, http.MethodPost, "/api/v1/notifications/"+optional.ID+"/test", "", cookies, csrfToken)
	if optionalTest.Code != http.StatusOK {
		t.Fatalf("test after dropping optional token = %d %s", optionalTest.Code, optionalTest.Body.String())
	}
	select {
	case body := <-received:
		if body["topic"] != "optional" || body["title"] != "Transmission VPN: Test notification" {
			t.Fatalf("optional destination received %+v", body)
		}
	default:
		t.Fatal("the destination did not resume after its optional token was dropped")
	}

	afterOptional := performRequest(t, restarted, http.MethodGet, "/api/v1/auth/me", "", cookies, "")
	if strings.Contains(afterOptional.Body.String(), `"name":"Optional token"`) {
		t.Fatalf("the notice still lists the optional token destination: %s", afterOptional.Body.String())
	}

	expectError(t, performRequest(t, restarted, http.MethodPut, "/api/v1/notifications/"+chat.ID,
		`{"name":"Homelab chat","events":["secrets-removed"],"settings":{"chatId":"-100"}}`, cookies, csrfToken),
		http.StatusUnprocessableEntity, "invalid_request", "Enter the bot token.", "settings.botToken")

	entered := performRequest(t, restarted, http.MethodPut, "/api/v1/notifications/"+chat.ID,
		`{"name":"Homelab chat","events":["secrets-removed"],"settings":{"botToken":"123:new","chatId":"-100"}}`, cookies, csrfToken)
	if entered.Code != http.StatusOK || !strings.Contains(entered.Body.String(), `"secretsMissing":[]`) {
		t.Fatalf("enter the bot token again = %d %s", entered.Code, entered.Body.String())
	}

	afterEntry := performRequest(t, restarted, http.MethodGet, "/api/v1/auth/me", "", cookies, "")
	if strings.Contains(afterEntry.Body.String(), `"kind":"notification"`) {
		t.Fatalf("the notice still lists the destination: %s", afterEntry.Body.String())
	}
}

// claimKeyTestServer builds a server on store with key and signs in its first
// administrator.
func claimKeyTestServer(t *testing.T, store *storage.Store, key []byte) (*Server, []*http.Cookie, string) {
	t.Helper()

	if err := store.ReplaceSetupClaim(context.Background(), security.Digest("ABCDE-23456-FGHIJ"), time.Now().Add(time.Hour)); err != nil {
		t.Fatalf("store setup claim: %v", err)
	}

	server := newKeyTestServer(t, store, key)
	claim := performRequest(t, server, http.MethodPost, "/api/v1/setup/claim",
		`{"claimCode":"ABCDE-23456-FGHIJ","username":"administrator","password":"`+testPassword+`"}`, nil, "")
	if claim.Code != http.StatusCreated {
		t.Fatalf("claim status %d: %s", claim.Code, claim.Body.String())
	}

	cookies := claim.Result().Cookies()

	return server, cookies, cookieValue(t, cookies, "tvpn_csrf")
}

// newWatcherTest returns a watcher with a fake sender and a destination that hears
// about every VPN and torrent event.
func newWatcherTest(t *testing.T) (*notificationWatcher, *fakeSender) {
	t.Helper()

	server, cookies, csrfToken := newClaimedTestServer(t)
	sender := newFakeSender(server)
	createTestNotification(t, server, cookies, csrfToken,
		`{"name":"Phone","service":"ntfy","events":["vpn-dropped","vpn-restored","torrent-finished","torrent-error"],"settings":{"url":"https://ntfy.sh/tvpn"}}`)

	return &notificationWatcher{
		notifier:       server.notifier,
		torrentDone:    map[string]int64{},
		torrentFailing: map[string]bool{},
	}, sender
}

// TestWatcherReportsVPNOutages checks that only an outage past the grace period is
// reported, once, and that its end is reported with how long it lasted.
func TestWatcherReportsVPNOutages(t *testing.T) {
	watcher, sender := newWatcherTest(t)
	start := time.Date(2026, 10, 26, 12, 0, 0, 0, time.UTC)

	for _, step := range []struct {
		offset time.Duration
		status controller.Status
	}{
		{0, controller.Status{State: "protected"}},
		{10 * time.Second, controller.Status{State: "reconnecting", LastError: "OpenVPN exited"}},
		{40 * time.Second, controller.Status{State: "connecting"}},
		{50 * time.Second, controller.Status{State: "reconnecting", LastError: "all VPN endpoints failed"}},
		{70 * time.Second, controller.Status{State: "reconnecting"}},
		{80 * time.Second, controller.Status{State: "reconnecting"}},
		{190 * time.Second, controller.Status{State: "protected", RemoteHost: "us1.vpn.example.com"}},
		{200 * time.Second, controller.Status{State: "reconnecting", LastError: "OpenVPN exited"}},
		{210 * time.Second, controller.Status{State: "protected"}},
		{220 * time.Second, controller.Status{State: "blocked"}},
		{400 * time.Second, controller.Status{State: "blocked"}},
	} {
		watcher.observeVPN(step.status, start.Add(step.offset))
		watcher.notifier.sends.Wait()
	}

	sends := sender.recorded()
	if len(sends) != 2 {
		t.Fatalf("sends = %+v", sends)
	}

	if sends[0].Notification.Event != "vpn-dropped" || sends[0].Notification.Priority != "high" ||
		sends[0].Notification.Message != "The VPN went down and hasn't come back after a minute. Transmission's traffic is blocked until it does. Last error: all VPN endpoints failed" {
		t.Fatalf("drop = %+v", sends[0].Notification)
	}

	if sends[1].Notification.Event != "vpn-restored" || sends[1].Notification.Message != "The VPN is back up after 3 minutes down." ||
		sends[1].Notification.Details["remoteHost"] != "us1.vpn.example.com" {
		t.Fatalf("restore = %+v", sends[1].Notification)
	}

	if formatOutage(61*time.Minute) != "1 hour 1 minute" || formatOutage(20*time.Second) != "1 minute" || formatOutage(120*time.Minute) != "2 hours" {
		t.Fatal("outage lengths are written differently from discord-stonker-bot")
	}
}

// TestWatcherTracksVPNOutagesPerConnection verifies independent grace and names.
func TestWatcherTracksVPNOutagesPerConnection(testingObject *testing.T) {
	watcher, sender := newWatcherTest(testingObject)
	startedAt := time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC)
	first := controller.Status{
		ConnectionID: "vpc-1000000000000001",
		State:        "reconnecting",
		LastError:    "first tunnel exited",
	}
	second := controller.Status{
		ConnectionID: "vpc-2000000000000002",
		State:        "reconnecting",
		LastError:    "second tunnel exited",
	}

	watcher.observeVPNConnection(first, "Primary", startedAt)
	watcher.observeVPNConnection(second, "Secondary", startedAt.Add(30*time.Second))
	watcher.observeVPNConnection(first, "Primary", startedAt.Add(61*time.Second))
	watcher.observeVPNConnection(second, "Secondary", startedAt.Add(91*time.Second))
	watcher.notifier.sends.Wait()

	sends := sender.recorded()
	if len(sends) != 2 {
		testingObject.Fatalf("per-connection drop sends = %#v", sends)
	}
	detailsByConnection := map[string]map[string]any{}
	for _, send := range sends {
		connectionID, _ := send.Notification.Details["connectionId"].(string)
		detailsByConnection[connectionID] = send.Notification.Details
	}
	if detailsByConnection[first.ConnectionID]["connectionName"] != "Primary" ||
		detailsByConnection[second.ConnectionID]["connectionName"] != "Secondary" {
		testingObject.Fatalf("per-connection notification details = %#v", detailsByConnection)
	}

	first.State = "protected"
	first.LastError = ""
	watcher.observeVPNConnection(first, "Primary", startedAt.Add(2*time.Minute))
	watcher.notifier.sends.Wait()
	sends = sender.recorded()
	if len(sends) != 3 || sends[2].Notification.Event != "vpn-restored" ||
		sends[2].Notification.Details["connectionName"] != "Primary" {
		testingObject.Fatalf("per-connection restore send = %#v", sends)
	}
}

// TestWatcherReportsTorrents checks that the first look reports nothing, that later
// finishes and errors are reported once per look, and that an error is reported again
// only after it clears.
func TestWatcherReportsTorrents(t *testing.T) {
	watcher, sender := newWatcherTest(t)
	start := time.Date(2026, 10, 26, 12, 0, 0, 0, time.UTC)
	look := func(offset time.Duration, torrents ...watchedTorrent) []recordedSend {
		t.Helper()

		before := len(sender.recorded())
		watcher.observeTorrents(torrents, start.Add(offset))
		watcher.notifier.sends.Wait()

		return byEvent(sender.recorded()[before:])
	}

	if sends := look(0,
		watchedTorrent{HashString: "a", Name: "Seeding", DoneDate: start.Add(-time.Hour).Unix()},
		watchedTorrent{HashString: "b", Name: "Ubuntu 24.04", DoneDate: 0},
		watchedTorrent{HashString: "c", Name: "Old error", Error: 3, ErrorString: "No data found!"},
	); len(sends) != 0 {
		t.Fatalf("the first look reported %+v", sends)
	}

	sends := look(10*time.Second,
		watchedTorrent{HashString: "a", Name: "Seeding", DoneDate: start.Add(-time.Hour).Unix(), Error: 1, ErrorString: "Tracker gave HTTP response code 0"},
		watchedTorrent{HashString: "b", Name: "Ubuntu 24.04", DoneDate: start.Add(5 * time.Second).Unix()},
		watchedTorrent{HashString: "c", Name: "Old error", Error: 3, ErrorString: "No data found!"},
		watchedTorrent{HashString: "d", Name: "Private", Error: 2, ErrorString: "Unregistered torrent"},
	)
	if len(sends) != 2 || sends[0].Notification.Message != "Transmission reported an error for Private: Unregistered torrent" ||
		sends[1].Notification.Message != "Ubuntu 24.04 finished downloading." {
		t.Fatalf("the second look reported %+v", sends)
	}

	if sends := look(20*time.Second,
		watchedTorrent{HashString: "c", Name: "Old error"},
		watchedTorrent{HashString: "d", Name: "Private", Error: 2, ErrorString: "Unregistered torrent"},
	); len(sends) != 0 {
		t.Fatalf("an error that didn't change was reported again: %+v", sends)
	}

	if sends := look(30*time.Second,
		watchedTorrent{HashString: "c", Name: "Old error", Error: 3, ErrorString: "No space left on device"},
	); len(sends) != 1 || sends[0].Notification.Message != "Transmission reported an error for Old error: No space left on device" {
		t.Fatalf("an error after it cleared = %+v", sends)
	}

	batch := []watchedTorrent{}
	for _, name := range []string{"One", "Two", "Three", "Four", "Five", "Six", "Seven"} {
		batch = append(batch, watchedTorrent{HashString: "new-" + name, Name: name, DoneDate: start.Add(35 * time.Second).Unix()})
	}
	sends = look(40*time.Second, batch...)
	torrents, _ := sends[0].Notification.Details["torrents"].([]map[string]any)
	if len(sends) != 1 || sends[0].Notification.Message != "7 torrents finished downloading: One, Two, Three, Four, Five, and 2 more." || len(torrents) != 7 {
		t.Fatalf("a batch of finished torrents = %+v", sends)
	}
}

// TestWatcherPollsTorrentDaemonsIndependently keeps healthy alerts flowing.
func TestWatcherPollsTorrentDaemonsIndependently(testingObject *testing.T) {
	watcher, sender := newWatcherTest(testingObject)
	startedAt := time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC)
	poll := 0
	watcher.torrents = func(context.Context) []watchedTorrentResult {
		poll++
		first := watchedTorrent{
			ConnectionID: firstTestConnectionID,
			HashString:   firstTestHash,
			Name:         "First copy",
			DoneDate:     startedAt.Add(-time.Hour).Unix(),
		}
		second := watchedTorrent{
			ConnectionID: secondTestConnectionID,
			HashString:   firstTestHash,
			Name:         "Second copy",
		}
		if poll > 1 {
			second.DoneDate = startedAt.Add(5 * time.Second).Unix()
		}
		results := []watchedTorrentResult{
			{ConnectionID: firstTestConnectionID, Torrents: []watchedTorrent{first}},
			{ConnectionID: secondTestConnectionID, Torrents: []watchedTorrent{second}},
		}
		if poll == 2 {
			results[0].Torrents = nil
			results[0].Error = context.DeadlineExceeded
		}

		return results
	}

	watcher.check(context.Background(), startedAt)
	watcher.notifier.sends.Wait()
	if sends := sender.recorded(); len(sends) != 0 {
		testingObject.Fatalf("initial per-daemon seed sent notifications: %#v", sends)
	}
	watcher.check(context.Background(), startedAt.Add(10*time.Second))
	watcher.notifier.sends.Wait()
	sends := sender.recorded()
	if len(sends) != 1 || sends[0].Notification.Event != "torrent-finished" {
		testingObject.Fatalf("healthy daemon notification sends = %#v", sends)
	}
	details, _ := sends[0].Notification.Details["torrents"].([]map[string]any)
	if len(details) != 1 || details[0]["connectionId"] != secondTestConnectionID {
		testingObject.Fatalf("healthy daemon notification details = %#v", details)
	}
	watcher.check(context.Background(), startedAt.Add(20*time.Second))
	watcher.notifier.sends.Wait()
	if sends = sender.recorded(); len(sends) != 1 {
		testingObject.Fatalf("duplicate hash re-fired after recovery: %#v", sends)
	}
	if len(watcher.torrentDone) != 2 {
		testingObject.Fatalf("watcher keys = %#v, want one per connection and hash", watcher.torrentDone)
	}
}
