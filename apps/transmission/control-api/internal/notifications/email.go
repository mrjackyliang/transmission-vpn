package notifications

import (
	"bytes"
	"context"
	"crypto/tls"
	"errors"
	"mime"
	"mime/quotedprintable"
	"net"
	"net/smtp"
	"os"
	"strconv"
	"strings"
	"time"
)

// emailNotifier sends one plain-text email through the destination's SMTP server.
//
// It never builds an HTTP request; Delivery's mail function owns the connection so
// tests and the controller dial reach the server the same way.
//
// Since: 2.4.1
type emailNotifier struct {
	settings map[string]string
	secrets  map[string]string
}

// newEmailNotifier keeps the destination's server settings and password.
func newEmailNotifier(target Target) *emailNotifier {
	return &emailNotifier{settings: target.Settings, secrets: target.Secrets}
}

// BuildMail builds the email for one notification.
//
// Blank recipients are dropped, and the port and security fall back to 587 and
// STARTTLS when they aren't set.
//
// Since: 2.4.1
func (notifier *emailNotifier) BuildMail(app App, notification Notification) Mail {
	recipients := []string{}
	for _, address := range strings.Split(notifier.settings["to"], ",") {
		if address = strings.TrimSpace(address); address != "" {
			recipients = append(recipients, address)
		}
	}

	port, _ := strconv.Atoi(valueOr(notifier.settings["port"], "587"))

	return Mail{
		Host:     notifier.settings["host"],
		Port:     port,
		Security: valueOr(notifier.settings["security"], "starttls"),
		Username: notifier.settings["username"],
		Password: notifier.secrets["password"],
		From:     notifier.settings["from"],
		To:       recipients,
		Subject:  displayTitle(app, notification),
		Text:     notification.Message,
	}
}

// Send hands one email to Delivery's mail function.
//
// Since: 2.4.1
func (notifier *emailNotifier) Send(ctx context.Context, delivery Delivery, app App, notification Notification) error {
	return delivery.SendMail(ctx, notifier.BuildMail(app, notification))
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
