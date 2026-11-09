package notifications

import (
	"strings"
	"time"
)

// payloadTimeLayout writes times the way JavaScript's toISOString does, so payloads from
// all four apps read the same.
const payloadTimeLayout = "2006-01-02T15:04:05.000Z"

// App names the app that sends a notification.
//
// People see the name before each title, and the key tells ntfy-reverse-proxy which
// interpreter reads the payload.
type App struct {
	Key  string
	Name string
}

// Event is one kind of alert a destination can choose.
//
// The label becomes the notification's title, and the priority and tags come with it.
type Event struct {
	Key            string
	Label          string
	Description    string
	Priority       string
	Tags           []string
	DefaultEnabled bool
}

// Notification is one alert ready to send to every destination that chose its event.
type Notification struct {
	Event      string
	Title      string
	Message    string
	Priority   string
	Tags       []string
	OccurredAt time.Time
	Details    map[string]any
}

// Payload is the JSON body webhooks and ntfy-reverse-proxy receive from every app.
//
// The fields are in the same order as the other apps write them.
type Payload struct {
	App        string         `json:"app"`
	Details    map[string]any `json:"details"`
	Event      string         `json:"event"`
	Message    string         `json:"message"`
	OccurredAt string         `json:"occurredAt"`
	Priority   int            `json:"priority"`
	Tags       []string       `json:"tags"`
	Title      string         `json:"title"`
	Version    int            `json:"version"`
}

// CommonEvents lists the events every app sends, before its own.
//
// Each app adds these to its catalog so the same alerts work everywhere.
var CommonEvents = []Event{
	{
		Key:            "secrets-removed",
		Label:          "Saved secrets were removed",
		Description:    "The app started without its key and removed what it locked.",
		Priority:       "high",
		Tags:           []string{"key", "warning"},
		DefaultEnabled: true,
	},
	{
		Key:            "sign-in-locked",
		Label:          "Sign-in locked",
		Description:    "Ten failed sign-ins from one address paused sign-in from it.",
		Priority:       "high",
		Tags:           []string{"lock"},
		DefaultEnabled: true,
	},
}

// priorityNumbers maps a priority to the 1-to-5 scale ntfy and the payload use.
var priorityNumbers = map[string]int{
	"low":     2,
	"default": 3,
	"high":    4,
}

// BuildEventNotification turns an event from an app's catalog into a notification with
// its message and details.
//
// The label becomes the title, and the event sets the priority and tags.
func BuildEventNotification(event Event, message string, details map[string]any, occurredAt time.Time) Notification {
	if details == nil {
		details = map[string]any{}
	}

	return Notification{
		Event:      event.Key,
		Title:      event.Label,
		Message:    message,
		Priority:   event.Priority,
		Tags:       append([]string{}, event.Tags...),
		OccurredAt: occurredAt,
		Details:    details,
	}
}

// BuildSecretsRemovedNotification describes the secrets a lost key removed, in the same
// words as the log line.
//
// Destinations that needed a removed secret are skipped, so only the others get it.
func BuildSecretsRemovedNotification(app App, keyTerm string, items []string) Notification {
	return BuildEventNotification(
		CommonEvents[0],
		app.Name+" started without its "+keyTerm+", so it made a new one. Enter these again: "+strings.Join(items, ", ")+".",
		map[string]any{"items": append([]string{}, items...)},
		time.Now(),
	)
}

// BuildSignInLockedNotification reports the address that reached the failed sign-in
// limit.
//
// The caller reports each address once per 15-minute window.
func BuildSignInLockedNotification(address string) Notification {
	return BuildEventNotification(
		CommonEvents[1],
		"Ten failed sign-ins from "+address+". Sign-in from it is paused for 15 minutes.",
		map[string]any{"address": address},
		time.Now(),
	)
}

// BuildTestNotification builds the message the Send test button delivers to one
// destination.
//
// It isn't an event, so destinations can't subscribe to it.
func BuildTestNotification(app App) Notification {
	return Notification{
		Event:      "test",
		Title:      "Test notification",
		Message:    "This is a test from " + app.Name + ". Alerts for the events you chose will look like this.",
		Priority:   "default",
		Tags:       []string{"bell"},
		OccurredAt: time.Now(),
		Details:    map[string]any{},
	}
}

// BuildPayload builds the JSON body that webhooks and ntfy-reverse-proxy receive.
//
// The shape is the same in all four apps so one interpreter per app can read it.
func BuildPayload(app App, notification Notification) Payload {
	details := notification.Details
	if details == nil {
		details = map[string]any{}
	}

	tags := notification.Tags
	if tags == nil {
		tags = []string{}
	}

	return Payload{
		App:        app.Key,
		Details:    details,
		Event:      notification.Event,
		Message:    notification.Message,
		OccurredAt: formatPayloadTime(notification.OccurredAt),
		Priority:   priorityNumbers[notification.Priority],
		Tags:       tags,
		Title:      notification.Title,
		Version:    1,
	}
}

// formatPayloadTime writes a time in UTC with milliseconds, like the other apps.
func formatPayloadTime(value time.Time) string {
	return value.UTC().Format(payloadTimeLayout)
}
