package notifications

import (
	"context"
	"net/http"
)

// webhookNotifier posts the shared JSON payload to a secret URL with an optional
// bearer token.
//
// The URL is a secret because webhook endpoints often carry their own token.
//
// Since: 2.4.1
type webhookNotifier struct {
	secrets map[string]string
}

// newWebhookNotifier keeps the destination's URL and optional token.
func newWebhookNotifier(target Target) *webhookNotifier {
	return &webhookNotifier{secrets: target.Secrets}
}

// BuildRequest builds the payload request for one notification.
//
// Since: 2.4.1
func (notifier *webhookNotifier) BuildRequest(app App, notification Notification) Request {
	headers := jsonHeaders()
	addBearer(headers, notifier.secrets)

	return Request{
		Method:  http.MethodPost,
		URL:     notifier.secrets["url"],
		Headers: headers,
		Body:    BuildPayload(app, notification),
	}
}

// Send delivers one notification to the webhook through the shared HTTP delivery.
//
// Since: 2.4.1
func (notifier *webhookNotifier) Send(ctx context.Context, delivery Delivery, app App, notification Notification) error {
	return sendHTTPRequest(ctx, delivery.Client, notifier.BuildRequest(app, notification))
}
