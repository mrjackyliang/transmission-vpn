package notifications

import (
	"context"
	"net/http"
)

// gotifyNotifier posts a message to a Gotify server with the app token in a header.
//
// Gotify's own 0-to-10 scale gets 2, 5, or 8 for low, default, and high.
//
// Since: 2.4.1
type gotifyNotifier struct {
	serverURL string
	token     string
}

// newGotifyNotifier keeps the destination's server and token for every message it sends.
func newGotifyNotifier(target Target) *gotifyNotifier {
	return &gotifyNotifier{serverURL: target.Settings["url"], token: target.Secrets["token"]}
}

// BuildRequest builds the Gotify message request for one notification.
//
// Since: 2.4.1
func (notifier *gotifyNotifier) BuildRequest(app App, notification Notification) Request {
	headers := jsonHeaders()
	headers["X-Gotify-Key"] = notifier.token

	return Request{
		Method:  http.MethodPost,
		URL:     trimTrailingSlashes(notifier.serverURL) + "/message",
		Headers: headers,
		Body: map[string]any{
			"message":  notification.Message,
			"priority": map[string]int{"default": 5, "high": 8, "low": 2}[notification.Priority],
			"title":    displayTitle(app, notification),
		},
	}
}

// Send delivers one notification to Gotify through the shared HTTP delivery.
//
// Since: 2.4.1
func (notifier *gotifyNotifier) Send(ctx context.Context, delivery Delivery, app App, notification Notification) error {
	return sendHTTPRequest(ctx, delivery.Client, notifier.BuildRequest(app, notification))
}
