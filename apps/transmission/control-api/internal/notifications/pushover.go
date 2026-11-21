package notifications

import (
	"context"
	"net/http"
)

// pushoverAPIURL is Pushover's fixed message endpoint.
const pushoverAPIURL = "https://api.pushover.net/1/messages.json"

// pushoverNotifier posts a message to Pushover with the user key and app token in the
// body.
//
// Pushover's -2-to-2 scale gets -1, 0, or 1 for low, default, and high.
//
// Since: 2.4.1
type pushoverNotifier struct {
	userKey  string
	appToken string
}

// newPushoverNotifier keeps the destination's user key and app token.
func newPushoverNotifier(target Target) *pushoverNotifier {
	return &pushoverNotifier{userKey: target.Secrets["userKey"], appToken: target.Secrets["appToken"]}
}

// BuildRequest builds the Pushover message request for one notification.
//
// Since: 2.4.1
func (notifier *pushoverNotifier) BuildRequest(app App, notification Notification) Request {
	return Request{
		Method:  http.MethodPost,
		URL:     pushoverAPIURL,
		Headers: jsonHeaders(),
		Body: map[string]any{
			"message":  notification.Message,
			"priority": map[string]int{"default": 0, "high": 1, "low": -1}[notification.Priority],
			"title":    displayTitle(app, notification),
			"token":    notifier.appToken,
			"user":     notifier.userKey,
		},
	}
}

// Send delivers one notification to Pushover through the shared HTTP delivery.
//
// Since: 2.4.1
func (notifier *pushoverNotifier) Send(ctx context.Context, delivery Delivery, app App, notification Notification) error {
	return sendHTTPRequest(ctx, delivery.Client, notifier.BuildRequest(app, notification))
}
