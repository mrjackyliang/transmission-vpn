package notifications

import (
	"errors"
)

// errUnsupportedService reports a destination whose service has no notifier.
//
// Storage only accepts the services in Services, so this guards a corrupt row rather
// than anything a person can choose.
var errUnsupportedService = errors.New("the destination's service isn't supported")

// NewNotifier returns the notifier for a destination's service, email included.
//
// Sender only ever calls the returned notifier's Send, so no service's URL, headers,
// or body appear outside that service's own file.
//
// Since: 2.4.1
func NewNotifier(target Target) (Notifier, error) {
	if target.Service == "email" {
		return newEmailNotifier(target), nil
	}

	return NewHTTPNotifier(target)
}

// NewHTTPNotifier returns the notifier for a service reached over HTTP.
//
// It can also show the request it would send, which the per-service tests check.
//
// Since: 2.4.1
func NewHTTPNotifier(target Target) (HTTPNotifier, error) {
	switch target.Service {
	case "apprise":
		return newAppriseNotifier(target), nil
	case "discord":
		return newDiscordNotifier(target), nil
	case "gotify":
		return newGotifyNotifier(target), nil
	case "matrix":
		return newMatrixNotifier(target), nil
	case "ntfy":
		return newNtfyNotifier(target), nil
	case "ntfy-reverse-proxy":
		return newNtfyReverseProxyNotifier(target), nil
	case "pushover":
		return newPushoverNotifier(target), nil
	case "slack":
		return newSlackNotifier(target), nil
	case "telegram":
		return newTelegramNotifier(target), nil
	case "webhook":
		return newWebhookNotifier(target), nil
	default:
		return nil, errUnsupportedService
	}
}
