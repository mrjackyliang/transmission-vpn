package notifications

import (
	"context"
	"net/http"
)

// appriseNotifier posts to an Apprise API endpoint, with optional target URLs.
//
// High-priority alerts use Apprise's warning type so its own services can style them.
//
// Since: 2.4.1
type appriseNotifier struct {
	secrets map[string]string
}

// newAppriseNotifier keeps the destination's secrets for every message it sends.
func newAppriseNotifier(target Target) *appriseNotifier {
	return &appriseNotifier{secrets: target.Secrets}
}

// BuildRequest builds the Apprise notify request for one notification.
//
// The urls field is sent only when the destination saved it.
//
// Since: 2.4.1
func (notifier *appriseNotifier) BuildRequest(app App, notification Notification) Request {
	values := map[string]any{
		"body":  notification.Message,
		"title": displayTitle(app, notification),
		"type":  "info",
	}
	if notification.Priority == "high" {
		values["type"] = "warning"
	}
	if urls, found := notifier.secrets["urls"]; found {
		values["urls"] = urls
	}

	return Request{
		Method:  http.MethodPost,
		URL:     notifier.secrets["url"],
		Headers: jsonHeaders(),
		Body:    values,
	}
}

// Send delivers one notification to Apprise through the shared HTTP delivery.
//
// Since: 2.4.1
func (notifier *appriseNotifier) Send(ctx context.Context, delivery Delivery, app App, notification Notification) error {
	return sendHTTPRequest(ctx, delivery.Client, notifier.BuildRequest(app, notification))
}
