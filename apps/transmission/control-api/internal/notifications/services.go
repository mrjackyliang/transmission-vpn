// Package notifications sends alerts to ntfy, Telegram, email, and the other services a
// destination can use.
//
// The services, their fields and messages, the events every app shares, and the JSON
// payload match pfsense-actions, discord-stonker-bot, and Outpost, so one
// ntfy-reverse-proxy interpreter per app can read what each of them sends.
package notifications

import (
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"
)

// Field is one setting of a service.
//
// Secret fields are sealed with the installation key and never returned by the API, and
// Missing is the message shown when a required field is left blank.
type Field struct {
	Key      string
	Kind     string
	Maximum  int
	Missing  string
	Required bool
	Secret   bool
}

// Service is one place a destination can send alerts to.
type Service struct {
	Label  string
	Fields []Field
}

// Issue is one request field that failed a check, named the way the web dialog looks it
// up, such as "settings.url".
type Issue struct {
	Field   string
	Message string
}

// Services lists the fields each service needs and which of them are secret.
//
// The keys, limits, and messages are the same in all four apps.
var Services = map[string]Service{
	"apprise": {
		Label: "Apprise",
		Fields: []Field{
			{Key: "url", Kind: "http-url", Maximum: 2048, Missing: "Enter the Apprise URL.", Required: true, Secret: true},
			{Key: "urls", Kind: "text", Maximum: 4096, Secret: true},
		},
	},
	"discord": {
		Label: "Discord",
		Fields: []Field{
			{Key: "webhookUrl", Kind: "discord-webhook", Maximum: 2048, Missing: "Enter the webhook URL.", Required: true, Secret: true},
		},
	},
	"email": {
		Label: "Email",
		Fields: []Field{
			{Key: "host", Kind: "text", Maximum: 255, Missing: "Enter the SMTP server.", Required: true},
			{Key: "port", Kind: "port", Maximum: 5, Missing: "Enter a port number.", Required: true},
			{Key: "security", Kind: "security", Maximum: 8, Missing: "Choose STARTTLS, TLS, or none.", Required: true},
			{Key: "username", Kind: "text", Maximum: 255},
			{Key: "password", Kind: "text", Maximum: 1024, Secret: true},
			{Key: "from", Kind: "email", Maximum: 255, Missing: "Enter the address to send from.", Required: true},
			{Key: "to", Kind: "emails", Maximum: 1024, Missing: "Enter the address to send to.", Required: true},
		},
	},
	"gotify": {
		Label: "Gotify",
		Fields: []Field{
			{Key: "url", Kind: "http-url", Maximum: 2048, Missing: "Enter the server URL.", Required: true},
			{Key: "token", Kind: "text", Maximum: 1024, Missing: "Enter the app token.", Required: true, Secret: true},
		},
	},
	"matrix": {
		Label: "Matrix",
		Fields: []Field{
			{Key: "homeserverUrl", Kind: "https-url", Maximum: 2048, Missing: "Enter the homeserver URL.", Required: true},
			{Key: "roomId", Kind: "matrix-room", Maximum: 255, Missing: "Enter the room ID.", Required: true},
			{Key: "accessToken", Kind: "text", Maximum: 1024, Missing: "Enter the access token.", Required: true, Secret: true},
		},
	},
	"ntfy": {
		Label: "ntfy",
		Fields: []Field{
			{Key: "url", Kind: "ntfy-topic-url", Maximum: 2048, Missing: "Enter the topic URL.", Required: true},
			{Key: "token", Kind: "text", Maximum: 1024, Secret: true},
		},
	},
	"ntfy-reverse-proxy": {
		Label: "Reverse Proxy for ntfy",
		Fields: []Field{
			{Key: "url", Kind: "https-url", Maximum: 2048, Missing: "Enter the context URL.", Required: true},
			{Key: "token", Kind: "text", Maximum: 1024, Secret: true},
		},
	},
	"pushover": {
		Label: "Pushover",
		Fields: []Field{
			{Key: "userKey", Kind: "text", Maximum: 255, Missing: "Enter the user key.", Required: true, Secret: true},
			{Key: "appToken", Kind: "text", Maximum: 255, Missing: "Enter the app token.", Required: true, Secret: true},
		},
	},
	"slack": {
		Label: "Slack",
		Fields: []Field{
			{Key: "webhookUrl", Kind: "slack-webhook", Maximum: 2048, Missing: "Enter the webhook URL.", Required: true, Secret: true},
		},
	},
	"telegram": {
		Label: "Telegram",
		Fields: []Field{
			{Key: "botToken", Kind: "text", Maximum: 255, Missing: "Enter the bot token.", Required: true, Secret: true},
			{Key: "chatId", Kind: "text", Maximum: 255, Missing: "Enter the chat ID.", Required: true},
		},
	},
	"webhook": {
		Label: "Webhook",
		Fields: []Field{
			{Key: "url", Kind: "http-url", Maximum: 2048, Missing: "Enter the URL.", Required: true, Secret: true},
			{Key: "token", Kind: "text", Maximum: 1024, Secret: true},
		},
	},
}

// invalidMessages gives each field kind the message shown when a value has the wrong
// form. The same words appear in all four apps.
var invalidMessages = map[string]string{
	"discord-webhook": "Use a Discord webhook URL. It starts with https://discord.com/api/webhooks/.",
	"email":           "Use an email address, like alerts@example.com.",
	"emails":          "Use email addresses separated by commas.",
	"http-url":        "Use an http:// or https:// URL.",
	"https-url":       "Use an https:// URL.",
	"matrix-room":     "Use a room ID like !room:example.com; aliases starting with # aren't accepted.",
	"ntfy-topic-url":  "Use the full topic URL, like https://ntfy.sh/my-alerts.",
	"port":            "Use a port from 1 to 65535.",
	"security":        "Choose STARTTLS, TLS, or none.",
	"slack-webhook":   "Use a Slack webhook URL. It starts with https://hooks.slack.com/.",
	"text":            "Check this value.",
}

// emailAddressPattern is the address check the other apps get from zod, without its two
// look-aheads, which isEmailAddress checks separately.
var emailAddressPattern = regexp.MustCompile(`^[A-Za-z0-9_'+\-.]*[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$`)

// SecretKeys lists the secret fields of a service, which a lost installation key removes.
//
// Plain fields such as URLs and chat IDs stay when the key is lost.
func SecretKeys(service string) []string {
	keys := []string{}
	for _, field := range Services[service].Fields {
		if field.Secret {
			keys = append(keys, field.Key)
		}
	}

	return keys
}

// ReadName trims a destination name and checks it. A missing, null, or non-text name
// counts as empty.
//
// Names are up to 80 characters; the store keeps them unique without regard to case.
func ReadName(raw json.RawMessage) (string, string) {
	var name string
	if len(raw) > 0 && json.Unmarshal(raw, &name) != nil {
		name = ""
	}

	name = strings.TrimSpace(name)
	if name == "" {
		return "", "Name this notification."
	}

	if utf8.RuneCountInString(name) > 80 {
		return "", "Use 80 characters or fewer."
	}

	return name, ""
}

// ReadService reads the service a new destination uses.
//
// An unknown service is reported on the service field, and the other fields aren't
// checked until it is known.
func ReadService(raw json.RawMessage) (string, string) {
	var service string
	if len(raw) == 0 || json.Unmarshal(raw, &service) != nil {
		return "", "Choose a service."
	}

	if _, found := Services[service]; !found {
		return "", "Choose a service."
	}

	return service, ""
}

// ReadEvents checks the events a destination listens to against the app's catalog.
//
// At least one event is required, and each can appear only once. An entry that isn't in
// the catalog is reported on its position, such as "events.2".
func ReadEvents(raw json.RawMessage, keys []string) ([]string, []Issue) {
	var values []json.RawMessage
	if len(raw) == 0 || json.Unmarshal(raw, &values) != nil || values == nil {
		return nil, []Issue{{Field: "events", Message: "Choose at least one event."}}
	}

	events := make([]string, 0, len(values))
	issues := []Issue{}
	for index, value := range values {
		var event string
		if json.Unmarshal(value, &event) != nil || !slices.Contains(keys, event) {
			issues = append(issues, Issue{Field: "events." + strconv.Itoa(index), Message: "Choose events from the list."})

			continue
		}

		events = append(events, event)
	}

	if len(issues) > 0 {
		return nil, issues
	}

	if len(events) == 0 {
		return nil, []Issue{{Field: "events", Message: "Choose at least one event."}}
	}

	unique := map[string]struct{}{}
	for _, event := range events {
		unique[event] = struct{}{}
	}

	if len(unique) != len(events) {
		return nil, []Issue{{Field: "events", Message: "Choose each event only once."}}
	}

	return events, nil
}

// ReadClearSecrets checks which optional secrets an edit deliberately clears.
//
// Only an optional secret that is saved, or missing after a lost key, can be cleared:
// a required one would leave a destination that can never send, and an unsaved one has
// nothing to clear. Unknown, non-secret, and repeated field names are rejected explicitly.
func ReadClearSecrets(service string, raw json.RawMessage, savedOrMissingKeys []string) ([]string, []Issue) {
	var values []json.RawMessage
	if len(raw) == 0 {
		return []string{}, nil
	}
	if json.Unmarshal(raw, &values) != nil || values == nil {
		return nil, []Issue{{Field: "clearSecrets", Message: "Choose an optional saved secret."}}
	}

	optionalSecretKeys := []string{}
	for _, field := range Services[service].Fields {
		if field.Secret && !field.Required && slices.Contains(savedOrMissingKeys, field.Key) {
			optionalSecretKeys = append(optionalSecretKeys, field.Key)
		}
	}

	clearSecrets := make([]string, 0, len(values))
	issues := []Issue{}
	for index, value := range values {
		var key string
		if json.Unmarshal(value, &key) != nil || !slices.Contains(optionalSecretKeys, key) {
			issues = append(issues, Issue{
				Field:   "clearSecrets." + strconv.Itoa(index),
				Message: "Choose an optional saved secret.",
			})

			continue
		}

		clearSecrets = append(clearSecrets, key)
	}

	if len(issues) > 0 {
		return nil, issues
	}

	unique := map[string]struct{}{}
	for _, key := range clearSecrets {
		unique[key] = struct{}{}
	}
	if len(unique) != len(clearSecrets) {
		return nil, []Issue{{Field: "clearSecrets", Message: "Choose each secret only once."}}
	}

	return clearSecrets, nil
}

// ReadSettings checks one service's fields and splits them into plain settings and
// secrets to seal.
//
// Unknown fields are rejected, and blank optional fields count as not set. A secret named
// in savedSecretKeys may be left out or blank to keep its saved value.
func ReadSettings(service string, raw json.RawMessage, savedSecretKeys []string) (map[string]string, map[string]string, []Issue) {
	var values map[string]json.RawMessage
	if len(raw) == 0 || json.Unmarshal(raw, &values) != nil || values == nil {
		return nil, nil, []Issue{{Field: "settings", Message: "Fill in the service settings."}}
	}

	definition := Services[service]
	settings := map[string]string{}
	secrets := map[string]string{}
	issues := []Issue{}

	for _, field := range definition.Fields {
		value, message := readField(field, values[field.Key], field.Secret && slices.Contains(savedSecretKeys, field.Key))
		if message != "" {
			issues = append(issues, Issue{Field: "settings." + field.Key, Message: message})

			continue
		}

		if value == "" {
			continue
		}

		if field.Secret {
			secrets[field.Key] = value
		} else {
			settings[field.Key] = value
		}
	}

	unknownKeys := []string{}
	for key := range values {
		if !slices.ContainsFunc(definition.Fields, func(field Field) bool { return field.Key == key }) {
			unknownKeys = append(unknownKeys, key)
		}
	}
	slices.Sort(unknownKeys)
	for _, key := range unknownKeys {
		issues = append(issues, Issue{Field: "settings." + key, Message: "This field isn't accepted."})
	}

	if len(issues) > 0 {
		return nil, nil, issues
	}

	return settings, secrets, nil
}

// readField checks one service field and returns its trimmed value, or the message
// shown under it.
//
// A field that was left out counts as blank unless it is required and not kept. A value
// that isn't text gets the field's missing message, like the other apps.
func readField(field Field, raw json.RawMessage, keep bool) (string, string) {
	missing := field.Missing
	if missing == "" {
		missing = invalidMessages["text"]
	}

	if len(raw) == 0 {
		if field.Required && !keep {
			return "", missing
		}

		return "", ""
	}

	var value string
	if json.Unmarshal(raw, &value) != nil {
		return "", missing
	}

	value = strings.TrimSpace(value)
	if utf8.RuneCountInString(value) > field.Maximum {
		return "", fmt.Sprintf("Use %d characters or fewer.", field.Maximum)
	}

	if value != "" && !isValidField(field.Kind, value) {
		return "", invalidMessages[field.Kind]
	}

	if value == "" && field.Required && !keep {
		return "", missing
	}

	return value, ""
}

// isValidField checks one non-blank field value against the rule for its kind.
//
// Plain text fields only have a length limit.
func isValidField(kind string, value string) bool {
	switch kind {
	case "discord-webhook":
		return strings.HasPrefix(value, "https://discord.com/api/webhooks/") ||
			strings.HasPrefix(value, "https://discordapp.com/api/webhooks/")
	case "email":
		return isEmailAddress(value)
	case "emails":
		for _, address := range strings.Split(value, ",") {
			if !isEmailAddress(strings.TrimSpace(address)) {
				return false
			}
		}

		return true
	case "http-url":
		return isHTTPURL(value, "http", "https")
	case "https-url":
		return isHTTPURL(value, "https")
	case "matrix-room":
		return isMatrixRoomID(value)
	case "ntfy-topic-url":
		_, topic := ntfyTopic(value)

		return isHTTPURL(value, "http", "https") && topic != ""
	case "port":
		return isPort(value)
	case "security":
		return value == "none" || value == "starttls" || value == "tls"
	case "slack-webhook":
		return strings.HasPrefix(value, "https://hooks.slack.com/")
	default:
		return true
	}
}

// isEmailAddress checks one address for the From and To fields of the email service.
//
// It can't start with a dot or contain two dots in a row, and the rest matches
// emailAddressPattern.
func isEmailAddress(value string) bool {
	return !strings.HasPrefix(value, ".") &&
		!strings.Contains(value, "..") &&
		emailAddressPattern.MatchString(value)
}

// isHTTPURL checks that a value is an absolute URL with one of the allowed schemes.
//
// Credentials in the URL are allowed because some services put tokens there.
func isHTTPURL(value string, schemes ...string) bool {
	parsedURL, err := url.Parse(value)
	if err != nil {
		return false
	}

	return slices.Contains(schemes, strings.ToLower(parsedURL.Scheme)) && parsedURL.Hostname() != ""
}

// isMatrixRoomID checks a room ID like !room:example.com.
//
// Both the part before the colon and the server after it are required, and room IDs
// can't contain spaces. Room aliases start with # and aren't accepted because the send
// endpoint requires a resolved room ID.
func isMatrixRoomID(value string) bool {
	colon := strings.Index(value, ":")

	return strings.HasPrefix(value, "!") &&
		colon > 1 &&
		colon < len(value)-1 &&
		!strings.ContainsFunc(value, unicode.IsSpace)
}

// isPort checks for a whole port number from 1 to 65535, written without extra
// characters. Values like 0587 or 5e2 don't count.
func isPort(value string) bool {
	port, err := strconv.Atoi(value)

	return err == nil && port >= 1 && port <= 65535 && strconv.Itoa(port) == value
}

// ntfyTopic splits a topic URL into the server address and the topic name.
//
// Publishing as JSON to the server keeps non-English titles intact. A URL that can't be
// read gives an empty server and topic.
func ntfyTopic(value string) (string, string) {
	parsedURL, err := url.Parse(value)
	if err != nil {
		return "", ""
	}

	segments := []string{}
	for _, segment := range strings.Split(parsedURL.EscapedPath(), "/") {
		if segment != "" {
			segments = append(segments, segment)
		}
	}

	if len(segments) == 0 {
		return "", ""
	}

	topic, err := url.PathUnescape(segments[len(segments)-1])
	if err != nil {
		return "", ""
	}

	serverPath := "/" + strings.Join(segments[:len(segments)-1], "/")
	parsedURL.Path, err = url.PathUnescape(serverPath)
	if err != nil {
		return "", ""
	}
	parsedURL.RawPath = serverPath
	parsedURL.RawQuery = ""
	parsedURL.ForceQuery = false
	parsedURL.Fragment = ""
	parsedURL.RawFragment = ""

	return parsedURL.String(), topic
}
