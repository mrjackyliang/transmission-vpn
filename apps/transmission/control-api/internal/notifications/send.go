package notifications

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/url"
	"time"
)

// sendTimeout limits every send, so one slow service can't hold up the others.
const sendTimeout = 10 * time.Second

// Target is a destination's service with its settings and opened secrets, ready to send.
type Target struct {
	Service  string
	Settings map[string]string
	Secrets  map[string]string
}

// Result reports whether one send arrived and, when it didn't, why.
type Result struct {
	Delivered bool   `json:"delivered"`
	Message   string `json:"message,omitempty"`
	Details   string `json:"details,omitempty"`
}

// Mail is one plain-text email for the email service.
type Mail struct {
	Host     string
	Port     int
	Security string
	Username string
	Password string
	From     string
	To       []string
	Subject  string
	Text     string
}

// Sender delivers notifications over HTTP and SMTP.
//
// Tests replace the HTTP client and the mail function so nothing leaves the machine.
type Sender struct {
	Client   *http.Client
	SendMail func(context.Context, Mail) error
}

// DialFunc opens one connection for a send.
type DialFunc func(ctx context.Context, network string, address string) (net.Conn, error)

// NewSender returns a sender that opens its connections with dial.
//
// The firewall only lets the VPN controller's connections leave outside the VPN, so
// the console passes a dial that asks the controller. Alerts then still arrive while
// every VPN connection is down.
func NewSender(dial DialFunc) *Sender {
	if dial == nil {
		var plainDialer net.Dialer
		dial = plainDialer.DialContext
	}

	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.DialContext = dial

	return &Sender{
		Client: &http.Client{
			Timeout:   sendTimeout,
			Transport: transport,
		},
		SendMail: func(ctx context.Context, mail Mail) error {
			return sendMail(ctx, mail, dial)
		},
	}
}

// Send delivers one notification to one destination and reports what happened.
//
// The registry picks the destination's notifier, so this never builds a service's
// request itself. Every send has a 10-second limit, and a failure is returned as a
// result instead of an error, with a short reason that never includes the
// destination's secrets.
//
// Since: 2.4.1
func (sender *Sender) Send(ctx context.Context, app App, target Target, notification Notification) Result {
	sendContext, cancel := context.WithTimeout(ctx, sendTimeout)
	defer cancel()

	notifier, err := NewNotifier(target)
	if err != nil {
		return failedResult(err)
	}

	err = notifier.Send(sendContext, Delivery{
		Client:   sender.Client,
		SendMail: sender.SendMail,
	}, app, notification)
	if err == nil {
		return Result{Delivered: true}
	}

	var refused *RefusedError
	if errors.As(err, &refused) {
		return Result{Message: refused.Reason}
	}

	return failedResult(err)
}

// describeError turns a network or mail error into the short reason shown on the
// destination.
//
// A send that took longer than 10 seconds says so in plain words. URL errors are
// unwrapped first because their text repeats the URL, which can hold a token.
func describeError(err error) string {
	if errors.Is(err, context.DeadlineExceeded) {
		return "No answer within 10 seconds."
	}

	var networkError net.Error
	if errors.As(err, &networkError) && networkError.Timeout() {
		return "No answer within 10 seconds."
	}

	var urlError *url.Error
	if errors.As(err, &urlError) {
		err = urlError.Err
	}

	return truncate(err.Error(), 200)
}

// failedResult keeps a sanitized transport diagnostic beside the plain sender reason.
func failedResult(err error) Result {
	return Result{
		Details: transportErrorDetails(err),
		Message: describeError(err),
	}
}

// transportErrorDetails removes a URL wrapper before retaining bounded diagnostics.
func transportErrorDetails(err error) string {
	var urlError *url.Error
	if errors.As(err, &urlError) {
		err = urlError.Err
	}

	return truncate(err.Error(), maximumResponseReasonCharacters)
}

// truncate shortens a reason to a number of characters without splitting one.
func truncate(value string, maximum int) string {
	characters := []rune(value)
	if len(characters) <= maximum {
		return value
	}

	return string(characters[:maximum])
}

// valueOr returns a setting, or a fallback when it isn't set.
func valueOr(value string, fallback string) string {
	if value == "" {
		return fallback
	}

	return value
}
