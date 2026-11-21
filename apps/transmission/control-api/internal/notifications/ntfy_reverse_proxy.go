package notifications

import (
	"context"
	"net/http"
)

// ntfyReverseProxyNotifier posts the shared JSON payload to a Reverse Proxy for ntfy
// context.
//
// The proxy's interpreter for this app reads the payload, so it gets the bare title and
// the app key rather than a display title.
//
// Since: 2.4.1
type ntfyReverseProxyNotifier struct {
	contextURL string
	secrets    map[string]string
}

// newNtfyReverseProxyNotifier keeps the destination's context URL and optional token.
func newNtfyReverseProxyNotifier(target Target) *ntfyReverseProxyNotifier {
	return &ntfyReverseProxyNotifier{contextURL: target.Settings["url"], secrets: target.Secrets}
}

// BuildRequest builds the payload request for one notification.
//
// Since: 2.4.1
func (notifier *ntfyReverseProxyNotifier) BuildRequest(app App, notification Notification) Request {
	headers := jsonHeaders()
	addBearer(headers, notifier.secrets)

	return Request{
		Method:  http.MethodPost,
		URL:     notifier.contextURL,
		Headers: headers,
		Body:    BuildPayload(app, notification),
	}
}

// Send delivers one notification to the proxy through the shared HTTP delivery.
//
// Since: 2.4.1
func (notifier *ntfyReverseProxyNotifier) Send(ctx context.Context, delivery Delivery, app App, notification Notification) error {
	return sendHTTPRequest(ctx, delivery.Client, notifier.BuildRequest(app, notification))
}
