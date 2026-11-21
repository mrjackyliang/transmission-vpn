package notifications

import (
	"context"
	"net/http"
	"strings"
)

// slackNotifier posts one bold-titled text message to a Slack webhook.
//
// Text is escaped so Slack shows &, <, and > instead of reading them as markup.
//
// Since: 2.4.1
type slackNotifier struct {
	webhookURL string
}

// newSlackNotifier keeps the destination's webhook URL for every message it sends.
func newSlackNotifier(target Target) *slackNotifier {
	return &slackNotifier{webhookURL: target.Secrets["webhookUrl"]}
}

// BuildRequest builds the Slack webhook request for one notification.
//
// Since: 2.4.1
func (notifier *slackNotifier) BuildRequest(app App, notification Notification) Request {
	return Request{
		Method:  http.MethodPost,
		URL:     notifier.webhookURL,
		Headers: jsonHeaders(),
		Body: map[string]any{
			"text": "*" + escapeSlack(displayTitle(app, notification)) + "*\n" + escapeSlack(notification.Message),
		},
	}
}

// Send delivers one notification to Slack through the shared HTTP delivery.
//
// Since: 2.4.1
func (notifier *slackNotifier) Send(ctx context.Context, delivery Delivery, app App, notification Notification) error {
	return sendHTTPRequest(ctx, delivery.Client, notifier.BuildRequest(app, notification))
}

// escapeSlack escapes the three characters Slack treats as markup in message text.
func escapeSlack(value string) string {
	return strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;").Replace(value)
}
