package notifications

import (
	"context"
	"net/http"
)

// telegramAPIURL is the Bot API base the bot token is appended to.
const telegramAPIURL = "https://api.telegram.org/bot"

// telegramNotifier sends a text message to one chat through the Telegram Bot API.
//
// Link previews are turned off so an alert stays one short message.
//
// Since: 2.4.1
type telegramNotifier struct {
	botToken string
	chatID   string
}

// newTelegramNotifier keeps the destination's bot token and chat ID.
func newTelegramNotifier(target Target) *telegramNotifier {
	return &telegramNotifier{botToken: target.Secrets["botToken"], chatID: target.Settings["chatId"]}
}

// BuildRequest builds the Telegram sendMessage request for one notification.
//
// Since: 2.4.1
func (notifier *telegramNotifier) BuildRequest(app App, notification Notification) Request {
	return Request{
		Method:  http.MethodPost,
		URL:     telegramAPIURL + notifier.botToken + "/sendMessage",
		Headers: jsonHeaders(),
		Body: map[string]any{
			"chat_id":                  notifier.chatID,
			"disable_web_page_preview": true,
			"text":                     displayTitle(app, notification) + "\n\n" + notification.Message,
		},
	}
}

// Send delivers one notification to Telegram through the shared HTTP delivery.
//
// Since: 2.4.1
func (notifier *telegramNotifier) Send(ctx context.Context, delivery Delivery, app App, notification Notification) error {
	return sendHTTPRequest(ctx, delivery.Client, notifier.BuildRequest(app, notification))
}
