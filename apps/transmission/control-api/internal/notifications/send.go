package notifications

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/quotedprintable"
	"net"
	"net/http"
	"net/smtp"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/jsonbody"
)

// sendTimeout limits every send, so one slow service can't hold up the others.
const sendTimeout = 10 * time.Second

// maximumResponseBytes bounds how much of a refused send's answer is read for its reason.
const maximumResponseBytes = 64 * 1024

// maximumResponseReasonCharacters keeps a service's useful explanation without letting
// an arbitrary response fill the destination row.
const maximumResponseReasonCharacters = 200

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
// Every send has a 10-second limit, and a failure is returned as a result instead of an
// error, with a short reason that never includes the destination's secrets.
func (sender *Sender) Send(ctx context.Context, app App, target Target, notification Notification) Result {
	sendContext, cancel := context.WithTimeout(ctx, sendTimeout)
	defer cancel()

	if target.Service == "email" {
		recipients := []string{}
		for _, address := range strings.Split(target.Settings["to"], ",") {
			if address = strings.TrimSpace(address); address != "" {
				recipients = append(recipients, address)
			}
		}

		port, _ := strconv.Atoi(valueOr(target.Settings["port"], "587"))
		if err := sender.SendMail(sendContext, Mail{
			Host:     target.Settings["host"],
			Port:     port,
			Security: valueOr(target.Settings["security"], "starttls"),
			Username: target.Settings["username"],
			Password: target.Secrets["password"],
			From:     target.Settings["from"],
			To:       recipients,
			Subject:  app.Name + ": " + notification.Title,
			Text:     notification.Message,
		}); err != nil {
			return failedResult(err)
		}

		return Result{Delivered: true}
	}

	request, err := buildRequest(sendContext, app, target, notification)
	if err != nil {
		return failedResult(err)
	}

	response, err := sender.Client.Do(request)
	if err != nil {
		return failedResult(err)
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode > 299 {
		return Result{Message: describeResponse(response)}
	}

	_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, maximumResponseBytes))

	return Result{Delivered: true}
}

// buildRequest builds the HTTP request each service expects, from the notification.
//
// People see the app name before the title, except in the shared JSON payload.
func buildRequest(ctx context.Context, app App, target Target, notification Notification) (*http.Request, error) {
	title := app.Name + ": " + notification.Title
	settings := target.Settings
	secrets := target.Secrets
	tags := notification.Tags
	if tags == nil {
		tags = []string{}
	}

	method := http.MethodPost
	headers := map[string]string{"Content-Type": "application/json"}
	address := ""
	var body any

	switch target.Service {
	case "apprise":
		values := map[string]any{
			"body":  notification.Message,
			"title": title,
			"type":  "info",
		}
		if notification.Priority == "high" {
			values["type"] = "warning"
		}
		if urls, found := secrets["urls"]; found {
			values["urls"] = urls
		}

		body = values
		address = secrets["url"]
	case "discord":
		color := 0x2f81f7
		if notification.Priority == "high" {
			color = 0xd04437
		}

		body = map[string]any{
			"embeds": []map[string]any{{
				"color":       color,
				"description": notification.Message,
				"timestamp":   formatPayloadTime(notification.OccurredAt),
				"title":       title,
			}},
		}
		address = secrets["webhookUrl"]
	case "gotify":
		body = map[string]any{
			"message":  notification.Message,
			"priority": map[string]int{"default": 5, "high": 8, "low": 2}[notification.Priority],
			"title":    title,
		}
		headers["X-Gotify-Key"] = secrets["token"]
		address = strings.TrimRight(settings["url"], "/") + "/message"
	case "matrix":
		method = http.MethodPut
		body = map[string]any{
			"body":    title + "\n" + notification.Message,
			"msgtype": "m.text",
		}
		headers["Authorization"] = "Bearer " + secrets["accessToken"]
		address = strings.TrimRight(settings["homeserverUrl"], "/") +
			"/_matrix/client/v3/rooms/" + encodeURIComponent(settings["roomId"]) +
			"/send/m.room.message/" + newTransactionID()
	case "ntfy":
		server, topic := ntfyTopic(settings["url"])
		body = map[string]any{
			"message":  notification.Message,
			"priority": priorityNumbers[notification.Priority],
			"tags":     tags,
			"title":    title,
			"topic":    topic,
		}
		addBearer(headers, secrets)
		address = server
	case "pushover":
		body = map[string]any{
			"message":  notification.Message,
			"priority": map[string]int{"default": 0, "high": 1, "low": -1}[notification.Priority],
			"title":    title,
			"token":    secrets["appToken"],
			"user":     secrets["userKey"],
		}
		address = "https://api.pushover.net/1/messages.json"
	case "slack":
		body = map[string]any{
			"text": "*" + escapeSlack(title) + "*\n" + escapeSlack(notification.Message),
		}
		address = secrets["webhookUrl"]
	case "telegram":
		body = map[string]any{
			"chat_id":                  settings["chatId"],
			"disable_web_page_preview": true,
			"text":                     title + "\n\n" + notification.Message,
		}
		address = "https://api.telegram.org/bot" + secrets["botToken"] + "/sendMessage"
	default:
		body = BuildPayload(app, notification)
		addBearer(headers, secrets)
		address = settings["url"]
		if target.Service == "webhook" {
			address = secrets["url"]
		}
	}

	encoded, err := encodeJSON(body)
	if err != nil {
		return nil, err
	}

	request, err := http.NewRequestWithContext(ctx, method, address, bytes.NewReader(encoded))
	if err != nil {
		// The parse error repeats the URL, which can hold a token.
		return nil, errors.New("the destination's URL can't be used")
	}

	for name, value := range headers {
		request.Header.Set(name, value)
	}

	return request, nil
}

// addBearer sends the destination's optional token as a bearer token.
func addBearer(headers map[string]string, secrets map[string]string) {
	if token, found := secrets["token"]; found {
		headers["Authorization"] = "Bearer " + token
	}
}

// encodeJSON writes a request body without escaping <, >, and &, like the other apps.
func encodeJSON(value any) ([]byte, error) {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(jsonbody.Normalize(value)); err != nil {
		return nil, fmt.Errorf("encode notification: %w", err)
	}

	return bytes.TrimSuffix(buffer.Bytes(), []byte("\n")), nil
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

// describeResponse reports a refused send with its status and the service's own reason
// when it gives one.
//
// The reason is bounded so a long error page can't flood the destination row, while
// ntfy-reverse-proxy's interpreter guidance fits in full.
func describeResponse(response *http.Response) string {
	content, _ := io.ReadAll(io.LimitReader(response.Body, maximumResponseBytes))
	body := strings.TrimSpace(string(content))
	detail := ""

	var parsed any
	if err := json.Unmarshal([]byte(body), &parsed); err == nil {
		if values, isObject := parsed.(map[string]any); isObject {
			for _, key := range []string{"description", "message", "error"} {
				if candidate, isText := values[key].(string); isText && candidate != "" {
					detail = candidate

					break
				}
			}
		}
	} else {
		detail, _, _ = strings.Cut(body, "\n")
	}

	status := "HTTP " + strconv.Itoa(response.StatusCode)
	if detail == "" {
		return status
	}

	return status + ": " + truncate(detail, maximumResponseReasonCharacters)
}

// escapeSlack escapes the three characters Slack treats as markup in message text.
func escapeSlack(value string) string {
	return strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;").Replace(value)
}

// encodeURIComponent escapes a value the way JavaScript's encodeURIComponent does, so a
// Matrix room ID goes into the path exactly as the other apps send it.
func encodeURIComponent(value string) string {
	var builder strings.Builder
	for index := 0; index < len(value); index++ {
		character := value[index]
		if 'A' <= character && character <= 'Z' ||
			'a' <= character && character <= 'z' ||
			'0' <= character && character <= '9' ||
			strings.IndexByte("-_.!~*'()", character) >= 0 {
			builder.WriteByte(character)

			continue
		}

		fmt.Fprintf(&builder, "%%%02X", character)
	}

	return builder.String()
}

// newTransactionID returns a random version 4 UUID for a Matrix message, so a retried
// request isn't posted twice.
func newTransactionID() string {
	value := make([]byte, 16)
	_, _ = rand.Read(value)
	value[6] = value[6]&0x0f | 0x40
	value[8] = value[8]&0x3f | 0x80
	encoded := hex.EncodeToString(value)

	return encoded[0:8] + "-" + encoded[8:12] + "-" + encoded[12:16] + "-" + encoded[16:20] + "-" + encoded[20:]
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

// sendMail sends one plain-text email through the destination's SMTP server.
//
// Each step gives up after 10 seconds without an answer. STARTTLS is required when the
// destination asks for it, and the sign-in uses PLAIN, or LOGIN when that's all the
// server offers.
func sendMail(ctx context.Context, mail Mail, dial DialFunc) error {
	address := net.JoinHostPort(mail.Host, strconv.Itoa(mail.Port))
	tlsConfiguration := &tls.Config{ServerName: mail.Host, MinVersion: tls.VersionTLS12}

	connection, err := dial(ctx, "tcp", address)
	if err != nil {
		return err
	}
	if mail.Security == "tls" {
		tlsConnection := tls.Client(connection, tlsConfiguration)
		if err := tlsConnection.HandshakeContext(ctx); err != nil {
			_ = connection.Close()

			return err
		}
		connection = tlsConnection
	}
	defer connection.Close()

	stopClosing := context.AfterFunc(ctx, func() { _ = connection.Close() })
	defer stopClosing()

	extendDeadline := func() {
		_ = connection.SetDeadline(time.Now().Add(sendTimeout))
	}
	extendDeadline()

	client, err := smtp.NewClient(connection, mail.Host)
	if err != nil {
		return err
	}
	defer client.Close()

	if hostname, hostnameError := os.Hostname(); hostnameError == nil && hostname != "" {
		extendDeadline()
		if err := client.Hello(hostname); err != nil {
			return err
		}
	}

	if mail.Security == "starttls" {
		extendDeadline()
		if supported, _ := client.Extension("STARTTLS"); !supported {
			return errors.New("the mail server doesn't offer STARTTLS")
		}

		if err := client.StartTLS(tlsConfiguration); err != nil {
			return err
		}
	}

	if mail.Username != "" {
		extendDeadline()
		_, mechanisms := client.Extension("AUTH")
		mechanism := "PLAIN"
		if !strings.Contains(" "+mechanisms+" ", " PLAIN ") && strings.Contains(" "+mechanisms+" ", " LOGIN ") {
			mechanism = "LOGIN"
		}

		if err := client.Auth(mailAuth{mechanism: mechanism, username: mail.Username, password: mail.Password}); err != nil {
			return err
		}
	}

	extendDeadline()
	if err := client.Mail(mail.From); err != nil {
		return err
	}

	for _, recipient := range mail.To {
		extendDeadline()
		if err := client.Rcpt(recipient); err != nil {
			return err
		}
	}

	extendDeadline()
	writer, err := client.Data()
	if err != nil {
		return err
	}

	if _, err := writer.Write(buildMailMessage(mail)); err != nil {
		return err
	}

	extendDeadline()
	if err := writer.Close(); err != nil {
		return err
	}

	// The server accepted the message once Data closed, so a failed goodbye doesn't count.
	_ = client.Quit()

	return nil
}

// buildMailMessage writes the headers and quoted-printable body of one email.
//
// The subject is encoded when it has characters outside ASCII.
func buildMailMessage(mail Mail) []byte {
	var message bytes.Buffer
	domain := "localhost"
	if _, after, found := strings.Cut(mail.From, "@"); found {
		domain = after
	}

	for _, header := range [][2]string{
		{"From", mail.From},
		{"To", strings.Join(mail.To, ", ")},
		{"Subject", mime.QEncoding.Encode("utf-8", mail.Subject)},
		{"Date", time.Now().Format(time.RFC1123Z)},
		{"Message-ID", "<" + newTransactionID() + "@" + domain + ">"},
		{"MIME-Version", "1.0"},
		{"Content-Type", "text/plain; charset=utf-8"},
		{"Content-Transfer-Encoding", "quoted-printable"},
	} {
		message.WriteString(header[0] + ": " + header[1] + "\r\n")
	}
	message.WriteString("\r\n")

	writer := quotedprintable.NewWriter(&message)
	_, _ = writer.Write([]byte(mail.Text))
	_ = writer.Close()

	return message.Bytes()
}

// mailAuth signs in to an SMTP server with PLAIN or LOGIN.
//
// Unlike net/smtp's PlainAuth it also works without TLS, because a destination set to no
// security asked for exactly that.
type mailAuth struct {
	mechanism string
	username  string
	password  string
}

// Start begins the sign-in with the chosen mechanism.
func (auth mailAuth) Start(_ *smtp.ServerInfo) (string, []byte, error) {
	if auth.mechanism == "LOGIN" {
		return "LOGIN", nil, nil
	}

	return "PLAIN", []byte("\x00" + auth.username + "\x00" + auth.password), nil
}

// Next answers the server's LOGIN prompts for the username and password.
func (auth mailAuth) Next(fromServer []byte, more bool) ([]byte, error) {
	if !more {
		return nil, nil
	}

	if auth.mechanism == "LOGIN" {
		switch strings.ToLower(strings.TrimSpace(string(fromServer))) {
		case "username:":
			return []byte(auth.username), nil
		case "password:":
			return []byte(auth.password), nil
		}
	}

	return nil, errors.New("the mail server asked for something unexpected during sign-in")
}
