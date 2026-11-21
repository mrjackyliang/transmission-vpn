package notifications

import (
	"context"
	"net/http"
)

// Notifier delivers one notification through one service's own API.
//
// Sender gets a Notifier from the registry and never builds a service's URL,
// headers, or body itself, so every third-party API stays behind one adapter.
//
// Since: 2.4.1
type Notifier interface {
	Send(ctx context.Context, delivery Delivery, app App, notification Notification) error
}

// HTTPNotifier is a Notifier for a service reached over HTTP.
//
// BuildRequest returns the request it would send, so tests can check each service's
// request without a network call.
//
// Since: 2.4.1
type HTTPNotifier interface {
	Notifier
	BuildRequest(app App, notification Notification) Request
}

// Delivery carries the connections a notifier sends through.
//
// Sender fills it from its own HTTP client and mail function, so tests and the
// controller dial reach every service the same way.
//
// Since: 2.4.1
type Delivery struct {
	Client   *http.Client
	SendMail func(context.Context, Mail) error
}

// Request is one service's HTTP request before the shared delivery encodes and sends it.
//
// The body is encoded as JSON without HTML escaping, and Headers are set exactly as
// given, so the request on the wire comes only from the service's notifier.
//
// Since: 2.4.1
type Request struct {
	Method  string
	URL     string
	Headers map[string]string
	Body    any
}

// displayTitle puts the app name before the title, as people see it in every service.
//
// Only the shared JSON payload keeps the bare title, because it carries the app key.
func displayTitle(app App, notification Notification) string {
	return app.Name + ": " + notification.Title
}

// jsonHeaders returns the content type every HTTP notifier sends.
func jsonHeaders() map[string]string {
	return map[string]string{"Content-Type": "application/json"}
}

// addBearer sends the destination's optional token as a bearer token.
func addBearer(headers map[string]string, secrets map[string]string) {
	if token, found := secrets["token"]; found {
		headers["Authorization"] = "Bearer " + token
	}
}
