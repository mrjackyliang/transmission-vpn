package notifications

import (
	"context"
	"net/http"
)

// discordNotifier posts one embed to a Discord webhook.
//
// High-priority alerts get a red embed and the rest a blue one.
//
// Since: 2.4.1
type discordNotifier struct {
	webhookURL string
}

// newDiscordNotifier keeps the destination's webhook URL for every message it sends.
func newDiscordNotifier(target Target) *discordNotifier {
	return &discordNotifier{webhookURL: target.Secrets["webhookUrl"]}
}

// BuildRequest builds the Discord webhook request for one notification.
//
// Since: 2.4.1
func (notifier *discordNotifier) BuildRequest(app App, notification Notification) Request {
	color := 0x2f81f7
	if notification.Priority == "high" {
		color = 0xd04437
	}

	return Request{
		Method:  http.MethodPost,
		URL:     notifier.webhookURL,
		Headers: jsonHeaders(),
		Body: map[string]any{
			"embeds": []map[string]any{{
				"color":       color,
				"description": notification.Message,
				"timestamp":   formatPayloadTime(notification.OccurredAt),
				"title":       displayTitle(app, notification),
			}},
		},
	}
}

// Send delivers one notification to Discord through the shared HTTP delivery.
//
// Since: 2.4.1
func (notifier *discordNotifier) Send(ctx context.Context, delivery Delivery, app App, notification Notification) error {
	return sendHTTPRequest(ctx, delivery.Client, notifier.BuildRequest(app, notification))
}
