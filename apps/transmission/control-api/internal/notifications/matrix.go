package notifications

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
)

// matrixNotifier sends a text message to one Matrix room with an access token.
//
// Each request gets a new transaction ID, so a retried request isn't posted twice.
//
// Since: 2.4.1
type matrixNotifier struct {
	homeserverURL string
	roomID        string
	accessToken   string
}

// newMatrixNotifier keeps the destination's homeserver, room, and token.
func newMatrixNotifier(target Target) *matrixNotifier {
	return &matrixNotifier{
		homeserverURL: target.Settings["homeserverUrl"],
		roomID:        target.Settings["roomId"],
		accessToken:   target.Secrets["accessToken"],
	}
}

// BuildRequest builds the Matrix room message request for one notification.
//
// Since: 2.4.1
func (notifier *matrixNotifier) BuildRequest(app App, notification Notification) Request {
	headers := jsonHeaders()
	headers["Authorization"] = "Bearer " + notifier.accessToken

	return Request{
		Method: http.MethodPut,
		URL: trimTrailingSlashes(notifier.homeserverURL) +
			"/_matrix/client/v3/rooms/" + encodeURIComponent(notifier.roomID) +
			"/send/m.room.message/" + newTransactionID(),
		Headers: headers,
		Body: map[string]any{
			"body":    displayTitle(app, notification) + "\n" + notification.Message,
			"msgtype": "m.text",
		},
	}
}

// Send delivers one notification to Matrix through the shared HTTP delivery.
//
// Since: 2.4.1
func (notifier *matrixNotifier) Send(ctx context.Context, delivery Delivery, app App, notification Notification) error {
	return sendHTTPRequest(ctx, delivery.Client, notifier.BuildRequest(app, notification))
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
