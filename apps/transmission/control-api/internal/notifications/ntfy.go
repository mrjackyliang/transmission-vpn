package notifications

import (
	"context"
	"net/http"
)

// ntfyNotifier publishes JSON to the topic's server with an optional bearer token.
//
// Publishing as JSON to the server root, with the topic in the body, keeps
// non-English titles intact.
//
// Since: 2.4.1
type ntfyNotifier struct {
	topicURL string
	secrets  map[string]string
}

// newNtfyNotifier keeps the destination's topic URL and optional token.
func newNtfyNotifier(target Target) *ntfyNotifier {
	return &ntfyNotifier{topicURL: target.Settings["url"], secrets: target.Secrets}
}

// BuildRequest builds the ntfy JSON publish request for one notification.
//
// Since: 2.4.1
func (notifier *ntfyNotifier) BuildRequest(app App, notification Notification) Request {
	server, topic := ntfyTopic(notifier.topicURL)
	tags := notification.Tags
	if tags == nil {
		tags = []string{}
	}
	headers := jsonHeaders()
	addBearer(headers, notifier.secrets)

	return Request{
		Method:  http.MethodPost,
		URL:     server,
		Headers: headers,
		Body: map[string]any{
			"message":  notification.Message,
			"priority": priorityNumbers[notification.Priority],
			"tags":     tags,
			"title":    displayTitle(app, notification),
			"topic":    topic,
		},
	}
}

// Send delivers one notification to ntfy through the shared HTTP delivery.
//
// Since: 2.4.1
func (notifier *ntfyNotifier) Send(ctx context.Context, delivery Delivery, app App, notification Notification) error {
	return sendHTTPRequest(ctx, delivery.Client, notifier.BuildRequest(app, notification))
}
