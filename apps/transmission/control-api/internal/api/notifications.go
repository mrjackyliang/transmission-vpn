package api

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"net"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/notifications"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

// notificationApp names Transmission VPN in every notification and payload.
//
// The key matches the transmission-vpn interpreter in ntfy-reverse-proxy.
var notificationApp = notifications.App{
	Key:  "transmission-vpn",
	Name: "Transmission VPN",
}

// notificationEvents lists the events a destination can choose, the shared ones first.
//
// The dialog shows them in this order.
var notificationEvents = append(slices.Clone(notifications.CommonEvents), []notifications.Event{
	{
		Key:            "vpn-dropped",
		Label:          "VPN dropped",
		Description:    "The tunnel went down and Transmission's traffic is blocked.",
		Priority:       "high",
		Tags:           []string{"warning"},
		DefaultEnabled: true,
	},
	{
		Key:            "vpn-restored",
		Label:          "VPN back up",
		Description:    "The tunnel is up again after a drop.",
		Priority:       "default",
		Tags:           []string{"white_check_mark"},
		DefaultEnabled: true,
	},
	{
		Key:            "torrent-finished",
		Label:          "Torrent finished",
		Description:    "A torrent finished downloading.",
		Priority:       "default",
		Tags:           []string{"white_check_mark"},
		DefaultEnabled: true,
	},
	{
		Key:            "torrent-error",
		Label:          "Torrent error",
		Description:    "Transmission reported an error for a torrent.",
		Priority:       "high",
		Tags:           []string{"x"},
		DefaultEnabled: true,
	},
	{
		Key:            "profile-choice-needed",
		Label:          "Profile choice needed",
		Description:    "A remote app added a torrent that matches more than one profile.",
		Priority:       "default",
		Tags:           []string{"question"},
		DefaultEnabled: true,
	},
}...)

// errNotificationSecretsMissing reports a destination that waits for secrets a lost
// installation key removed, so it can't be sent to.
var errNotificationSecretsMissing = errors.New("notification secrets were removed with a lost installation key")

// notificationEvent returns one event from the catalog by its key.
func notificationEvent(key string) notifications.Event {
	index := slices.IndexFunc(notificationEvents, func(event notifications.Event) bool { return event.Key == key })

	return notificationEvents[index]
}

// notifier sends alerts to the destinations that chose each event.
//
// Sends run in the background with their own 10-second limit, and each result is stored
// on the destination so the Notifications page can show it.
type notifier struct {
	store           *storage.Store
	installationKey []byte
	logger          *slog.Logger
	send            func(context.Context, notifications.App, notifications.Target, notifications.Notification) notifications.Result
	sends           sync.WaitGroup
	lockMutex       sync.Mutex
	lockedAddresses map[string]time.Time
}

// newNotifier prepares a notifier that sends over connections opened with dial.
func newNotifier(store *storage.Store, installationKey []byte, logger *slog.Logger, dial notifications.DialFunc) *notifier {
	return &notifier{
		store:           store,
		installationKey: installationKey,
		logger:          logger,
		send:            notifications.NewSender(dial).Send,
		lockedAddresses: map[string]time.Time{},
	}
}

// NotifySecretsRemoved tells the destinations that chose it which secrets a lost
// installation key removed, and waits until the sends finish.
//
// The container's first run replaces a lost key and exits right after, so it waits
// instead of leaving the sends behind. Nothing is sent when nothing was removed.
func NotifySecretsRemoved(store *storage.Store, installationKey []byte, logger *slog.Logger, items []string, dial notifications.DialFunc) {
	if len(items) == 0 {
		return
	}

	alerts := newNotifier(store, installationKey, logger, dial)
	alerts.deliver(notifications.BuildSecretsRemovedNotification(notificationApp, "installation key", items))
	alerts.sends.Wait()
}

// deliver sends one notification to every destination that chose its event and isn't
// waiting for a removed secret.
//
// It returns at once; the sends run in the background.
func (notifier *notifier) deliver(notification notifications.Notification) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	targets, err := notifier.store.ListNotificationTargets(ctx)
	cancel()
	if err != nil {
		notifier.logger.Error("list notifications", "error", err)

		return
	}

	for _, target := range targets {
		if !slices.Contains(target.Events, notification.Event) || len(target.MissingSecrets) > 0 {
			continue
		}

		secrets, err := openNotificationSecrets(notifier.installationKey, target)
		if err != nil {
			notifier.logger.Error("open notification secrets", "notification", target.Name, "error", err)

			continue
		}

		notifier.sends.Add(1)
		go func() {
			defer notifier.sends.Done()

			result := notifier.send(context.Background(), notificationApp, notifications.Target{
				Service:  target.Service,
				Settings: target.Settings,
				Secrets:  secrets,
			}, notification)
			notifier.record(target.ID, result)
		}()
	}
}

// record stores the result of one send on its destination.
func (notifier *notifier) record(id string, result notifications.Result) {
	var errorMessage *string
	if !result.Delivered {
		details := result.Message
		if result.Details != "" {
			details = result.Details
		}
		errorMessage = &details
		notifier.logger.Warn(
			"notification delivery failed",
			"notificationId",
			id,
			"error",
			details,
		)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := notifier.store.RecordNotificationAttempt(ctx, id, errorMessage); err != nil {
		notifier.logger.Error("record notification attempt", "error", err)
	}
}

// wantedEvents lists the events at least one destination listens to and can be sent to.
//
// The watcher asks the VPN controller and Transmission only for events someone wants.
func (notifier *notifier) wantedEvents(ctx context.Context) (map[string]bool, error) {
	targets, err := notifier.store.ListNotificationTargets(ctx)
	if err != nil {
		return nil, err
	}

	wanted := map[string]bool{}
	for _, target := range targets {
		if len(target.MissingSecrets) > 0 {
			continue
		}

		for _, event := range target.Events {
			wanted[event] = true
		}
	}

	return wanted, nil
}

// sendTest sends the test message to one destination and stores the result.
//
// A destination that doesn't exist returns storage.ErrNotFound, and one waiting for a
// removed secret returns errNotificationSecretsMissing without sending.
func (notifier *notifier) sendTest(ctx context.Context, id string) (notifications.Result, error) {
	target, err := notifier.store.FindNotificationTarget(ctx, id)
	if err != nil {
		return notifications.Result{}, err
	}

	if len(target.MissingSecrets) > 0 {
		return notifications.Result{}, errNotificationSecretsMissing
	}

	secrets, err := openNotificationSecrets(notifier.installationKey, target)
	if err != nil {
		return notifications.Result{}, err
	}

	result := notifier.send(ctx, notificationApp, notifications.Target{
		Service:  target.Service,
		Settings: target.Settings,
		Secrets:  secrets,
	}, notifications.BuildTestNotification(notificationApp))
	notifier.record(id, result)

	return result, nil
}

// notifySignInLimit reports an address that reached the failed sign-in limit, once per
// 15-minute window.
//
// Only sign-in keys count; a setup code guessed wrong ten times isn't reported.
func (notifier *notifier) notifySignInLimit(key string) {
	address, found := strings.CutPrefix(key, "sign-in:")
	if !found {
		return
	}

	now := time.Now()
	notifier.lockMutex.Lock()
	for lockedAddress, lockedAt := range notifier.lockedAddresses {
		if now.Sub(lockedAt) >= signInAttemptWindow {
			delete(notifier.lockedAddresses, lockedAddress)
		}
	}

	if _, locked := notifier.lockedAddresses[address]; locked {
		notifier.lockMutex.Unlock()

		return
	}

	notifier.lockedAddresses[address] = now
	notifier.lockMutex.Unlock()

	notifier.deliver(notifications.BuildSignInLockedNotification(address))
}

// notificationSecretKey names a destination's sealed secrets as associated data, so they
// can't be moved to another destination.
func notificationSecretKey(id string) string {
	return "notification/" + id
}

// sealNotificationSecrets seals a destination's secret fields together and lists them.
//
// A destination without secrets stores nothing sealed.
func sealNotificationSecrets(installationKey []byte, id string, secrets map[string]string) ([]byte, []byte, []string, error) {
	fields := slices.Sorted(maps.Keys(secrets))
	if len(fields) == 0 {
		return nil, nil, []string{}, nil
	}

	plaintext, err := json.Marshal(secrets)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("encode notification secrets: %w", err)
	}
	defer clear(plaintext)

	nonce, ciphertext, err := security.EncryptSecret(installationKey, notificationSecretKey(id), plaintext)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("seal notification secrets: %w", err)
	}

	return nonce, ciphertext, fields, nil
}

// openNotificationSecrets opens a destination's sealed secrets for sending or editing.
func openNotificationSecrets(installationKey []byte, target storage.NotificationTarget) (map[string]string, error) {
	secrets := map[string]string{}
	if target.SecretsCiphertext == nil {
		return secrets, nil
	}

	plaintext, err := security.DecryptSecret(
		installationKey,
		notificationSecretKey(target.ID),
		target.SecretsNonce,
		target.SecretsCiphertext,
	)
	if err != nil {
		return nil, fmt.Errorf("open notification secrets: %w", err)
	}
	defer clear(plaintext)

	if err := json.Unmarshal(plaintext, &secrets); err != nil {
		return nil, fmt.Errorf("decode notification secrets: %w", err)
	}

	return secrets, nil
}

// notificationBody is the JSON body of a destination add or edit.
//
// Raw fields let a wrong type be reported on the field that has it.
type notificationBody struct {
	Name         json.RawMessage `json:"name"`
	Service      json.RawMessage `json:"service"`
	Events       json.RawMessage `json:"events"`
	Settings     json.RawMessage `json:"settings"`
	ClearSecrets json.RawMessage `json:"clearSecrets"`
}

// notificationInput is a checked destination add or edit.
type notificationInput struct {
	Name         string
	Events       []string
	Settings     map[string]string
	Secrets      map[string]string
	ClearSecrets []string
}

// notificationResponse is one destination as the API shows it, without any secret value.
//
// Saved secret fields are named so the dialog can offer to keep them, and the fields a
// lost key removed are listed so the page can ask for them again.
type notificationResponse struct {
	ID               string            `json:"id"`
	Name             string            `json:"name"`
	Service          string            `json:"service"`
	Events           []string          `json:"events"`
	Settings         map[string]string `json:"settings"`
	Secrets          map[string]bool   `json:"secrets"`
	SecretsMissing   []string          `json:"secretsMissing"`
	CreatedAt        time.Time         `json:"createdAt"`
	UpdatedAt        time.Time         `json:"updatedAt"`
	LastAttemptAt    *time.Time        `json:"lastAttemptAt"`
	LastError        *string           `json:"lastError"`
	LastErrorDetails *string           `json:"lastErrorDetails"`
}

// notificationTestResponse is a test result with safe wording and optional diagnostics.
type notificationTestResponse struct {
	Delivered bool   `json:"delivered"`
	Message   string `json:"message,omitempty"`
	Details   string `json:"details,omitempty"`
}

// notificationEventResponse is one event a destination can choose.
type notificationEventResponse struct {
	Key            string `json:"key"`
	Label          string `json:"label"`
	Description    string `json:"description"`
	DefaultEnabled bool   `json:"defaultEnabled"`
}

// newNotificationResponse shapes a stored destination for the API.
func newNotificationResponse(target storage.NotificationTarget) notificationResponse {
	secrets := map[string]bool{}
	for _, field := range target.SecretFields {
		secrets[field] = true
	}

	lastError := target.LastError
	var lastErrorDetails *string
	if target.LastError != nil {
		message, details := publicNotificationFailure(*target.LastError)
		lastError = &message
		lastErrorDetails = details
	}

	return notificationResponse{
		ID:               target.ID,
		Name:             target.Name,
		Service:          target.Service,
		Events:           target.Events,
		Settings:         target.Settings,
		Secrets:          secrets,
		SecretsMissing:   target.MissingSecrets,
		CreatedAt:        target.CreatedAt,
		UpdatedAt:        target.UpdatedAt,
		LastAttemptAt:    target.LastAttemptAt,
		LastError:        lastError,
		LastErrorDetails: lastErrorDetails,
	}
}

// publicNotificationFailure replaces common transport diagnostics with plain words.
// The raw value is returned separately only when it was replaced.
func publicNotificationFailure(raw string) (string, *string) {
	normalized := strings.ToLower(raw)
	host := notificationFailureHost(raw)
	message := ""
	switch {
	case strings.Contains(normalized, "connection refused"):
		if host == "" {
			message = "The destination refused the connection."
		} else {
			message = fmt.Sprintf("%s refused the connection. Check the address.", host)
		}
	case strings.Contains(normalized, "no such host"),
		strings.Contains(normalized, "name or service not known"),
		strings.Contains(normalized, "temporary failure in name resolution"):
		if host == "" {
			message = "The destination name could not be found."
		} else {
			message = fmt.Sprintf("Couldn't find %s. Check the address.", host)
		}
	case strings.Contains(normalized, "context deadline exceeded"),
		strings.Contains(normalized, "i/o timeout"),
		strings.Contains(normalized, "timed out"):
		if host == "" {
			message = "The destination timed out."
		} else {
			message = fmt.Sprintf("No reply from %s. Check the address.", host)
		}
	case strings.Contains(normalized, "tls:"),
		strings.Contains(normalized, "x509:"),
		strings.Contains(normalized, "certificate"):
		if host == "" {
			message = "The secure connection to the destination failed."
		} else {
			message = fmt.Sprintf("The secure connection to %s failed. Check its certificate.", host)
		}
	case strings.Contains(normalized, "network is unreachable"),
		strings.Contains(normalized, "host is unreachable"),
		strings.Contains(normalized, "no route to host"):
		if host == "" {
			message = "The destination is unreachable."
		} else {
			message = fmt.Sprintf("Couldn't reach %s. Check the address and network.", host)
		}
	default:
		return raw, nil
	}

	details := raw

	return message, &details
}

// notificationFailureHost extracts only a conservative host or IP from transport text.
func notificationFailureHost(raw string) string {
	normalized := strings.ToLower(raw)
	for _, marker := range []string{"lookup ", "->", "dial tcp ", "read tcp ", "connect to "} {
		markerIndex := strings.Index(normalized, marker)
		if markerIndex < 0 {
			continue
		}
		candidate := strings.Fields(raw[markerIndex+len(marker):])
		if len(candidate) == 0 {
			continue
		}
		if host := safeNotificationFailureHost(candidate[0]); host != "" {
			return host
		}
	}

	return ""
}

// safeNotificationFailureHost rejects URLs, user information, and punctuation.
func safeNotificationFailureHost(candidate string) string {
	candidate = strings.Trim(candidate, "(),")
	candidate = strings.TrimSuffix(candidate, ":")
	if host, _, err := net.SplitHostPort(candidate); err == nil {
		candidate = strings.Trim(host, "[]")
	} else {
		candidate = strings.Trim(candidate, "[]")
	}
	if net.ParseIP(candidate) != nil {
		return candidate
	}
	if candidate == "" || len(candidate) > 253 || strings.ContainsAny(candidate, "/@?#") {
		return ""
	}
	for _, label := range strings.Split(candidate, ".") {
		if label == "" || len(label) > 63 || strings.HasPrefix(label, "-") || strings.HasSuffix(label, "-") {
			return ""
		}
		for _, character := range label {
			if (character < 'a' || character > 'z') && (character < 'A' || character > 'Z') &&
				(character < '0' || character > '9') && character != '-' {
				return ""
			}
		}
	}

	return candidate
}

// newNotificationTestResponse shapes one sender result for the public API.
func newNotificationTestResponse(result notifications.Result) notificationTestResponse {
	response := notificationTestResponse{Delivered: result.Delivered}
	if result.Delivered {
		return response
	}

	raw := result.Message
	if result.Details != "" {
		raw = result.Details
	}
	message, details := publicNotificationFailure(raw)
	if details == nil {
		response.Message = result.Message

		return response
	}
	response.Message = message
	if details != nil {
		response.Details = *details
	}

	return response
}

// handleListNotifications lists every destination with its events and last result, but
// no secret values.
func (server *Server) handleListNotifications(responseWriter http.ResponseWriter, request *http.Request) {
	targets, err := server.store.ListNotificationTargets(request.Context())
	if err != nil {
		server.logInternalError("list notifications", err)
		writeInternalError(responseWriter)

		return
	}

	items := make([]notificationResponse, 0, len(targets))
	for _, target := range targets {
		items = append(items, newNotificationResponse(target))
	}

	writeJSON(responseWriter, http.StatusOK, listResponse[notificationResponse]{Items: items})
}

// handleNotificationEvents lists the events a destination can choose, with the ones
// checked by default.
func (server *Server) handleNotificationEvents(responseWriter http.ResponseWriter, _ *http.Request) {
	items := make([]notificationEventResponse, 0, len(notificationEvents))
	for _, event := range notificationEvents {
		items = append(items, notificationEventResponse{
			Key:            event.Key,
			Label:          event.Label,
			Description:    event.Description,
			DefaultEnabled: event.DefaultEnabled,
		})
	}

	writeJSON(responseWriter, http.StatusOK, listResponse[notificationEventResponse]{Items: items})
}

// handleCreateNotification adds a destination after checking its service, fields, and
// events.
//
// The service is checked first, because the other fields depend on it. A name that is
// already used fails without changing anything.
func (server *Server) handleCreateNotification(responseWriter http.ResponseWriter, request *http.Request) {
	var body notificationBody
	if err := decodeJSONBody(responseWriter, request, &body); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}

	service, message := notifications.ReadService(body.Service)
	if message != "" {
		writeIssues(responseWriter, []validationIssue{newFieldIssue("service", message)})

		return
	}

	input, issues := readNotificationInput(body, service, []string{}, []string{}, false)
	if len(issues) > 0 {
		writeIssues(responseWriter, issues)

		return
	}

	id := newNotificationID()
	nonce, ciphertext, secretFields, err := sealNotificationSecrets(server.installationKey, id, input.Secrets)
	if err != nil {
		server.logInternalError("seal notification secrets", err)
		writeInternalError(responseWriter)

		return
	}

	target, err := server.store.CreateNotificationTarget(request.Context(), storage.NotificationTarget{
		ID:                id,
		Name:              input.Name,
		Service:           service,
		Events:            input.Events,
		Settings:          input.Settings,
		SecretFields:      secretFields,
		SecretsNonce:      nonce,
		SecretsCiphertext: ciphertext,
	})
	if errors.Is(err, storage.ErrNotificationNameTaken) {
		writeNotificationNameTaken(responseWriter)

		return
	}

	if err != nil {
		server.logInternalError("store notification", err)
		writeInternalError(responseWriter)

		return
	}

	writeJSON(responseWriter, http.StatusCreated, newNotificationResponse(target))
}

// handleUpdateNotification changes a destination's name, events, and settings; its
// service stays the same.
//
// Secret fields left blank keep their saved values. Optional secrets named in
// clearSecrets are removed, and entering or deliberately clearing a removed optional
// secret clears it from the lost-key notice.
func (server *Server) handleUpdateNotification(responseWriter http.ResponseWriter, request *http.Request) {
	id := request.PathValue("notificationID")
	if !validNotificationID(id) {
		writeNotificationNotFound(responseWriter)

		return
	}

	existing, err := server.store.FindNotificationTarget(request.Context(), id)
	if errors.Is(err, storage.ErrNotFound) {
		writeNotificationNotFound(responseWriter)

		return
	}

	if err != nil {
		server.logInternalError("read notification", err)
		writeInternalError(responseWriter)

		return
	}

	var body notificationBody
	if err := decodeJSONBody(responseWriter, request, &body); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}

	input, issues := readNotificationInput(body, existing.Service, existing.SecretFields, existing.MissingSecrets, true)
	if len(issues) > 0 {
		writeIssues(responseWriter, issues)

		return
	}

	secrets, err := openNotificationSecrets(server.installationKey, existing)
	if err != nil {
		server.logInternalError("open notification secrets", err)
		writeInternalError(responseWriter)

		return
	}
	for _, field := range input.ClearSecrets {
		delete(secrets, field)
	}
	maps.Copy(secrets, input.Secrets)

	missingSecrets := []string{}
	for _, field := range existing.MissingSecrets {
		_, entered := input.Secrets[field]
		if !entered && !slices.Contains(input.ClearSecrets, field) {
			missingSecrets = append(missingSecrets, field)
		}
	}

	nonce, ciphertext, secretFields, err := sealNotificationSecrets(server.installationKey, id, secrets)
	clear(secrets)
	if err != nil {
		server.logInternalError("seal notification secrets", err)
		writeInternalError(responseWriter)

		return
	}

	target, err := server.store.UpdateNotificationTarget(request.Context(), id, storage.NotificationTargetChanges{
		Name:              input.Name,
		Events:            input.Events,
		Settings:          input.Settings,
		SecretFields:      secretFields,
		MissingSecrets:    missingSecrets,
		SecretsNonce:      nonce,
		SecretsCiphertext: ciphertext,
	})
	if errors.Is(err, storage.ErrNotFound) {
		writeNotificationNotFound(responseWriter)

		return
	}

	if errors.Is(err, storage.ErrNotificationNameTaken) {
		writeNotificationNameTaken(responseWriter)

		return
	}

	if err != nil {
		server.logInternalError("update notification", err)
		writeInternalError(responseWriter)

		return
	}

	writeJSON(responseWriter, http.StatusOK, newNotificationResponse(target))
}

// handleDeleteNotification removes one destination so it gets no more alerts.
func (server *Server) handleDeleteNotification(responseWriter http.ResponseWriter, request *http.Request) {
	id := request.PathValue("notificationID")
	if !validNotificationID(id) {
		writeNotificationNotFound(responseWriter)

		return
	}

	err := server.store.DeleteNotificationTarget(request.Context(), id)
	if errors.Is(err, storage.ErrNotFound) {
		writeNotificationNotFound(responseWriter)

		return
	}

	if err != nil {
		server.logInternalError("delete notification", err)
		writeInternalError(responseWriter)

		return
	}

	responseWriter.WriteHeader(http.StatusNoContent)
}

// handleTestNotification sends the test message to one destination and reports whether
// it arrived.
//
// A destination waiting for a removed secret isn't sent to.
func (server *Server) handleTestNotification(responseWriter http.ResponseWriter, request *http.Request) {
	id := request.PathValue("notificationID")
	if !validNotificationID(id) {
		writeNotificationNotFound(responseWriter)

		return
	}

	result, err := server.notifier.sendTest(request.Context(), id)
	if errors.Is(err, storage.ErrNotFound) {
		writeNotificationNotFound(responseWriter)

		return
	}

	if errors.Is(err, errNotificationSecretsMissing) {
		writeJSON(responseWriter, http.StatusOK, newNotificationTestResponse(notifications.Result{
			Message: "Enter the removed secrets again first.",
		}))

		return
	}

	if err != nil {
		server.logInternalError("send test notification", err)
		writeInternalError(responseWriter)

		return
	}

	writeJSON(responseWriter, http.StatusOK, newNotificationTestResponse(result))
}

// readNotificationInput checks the name, events, and service settings of a destination
// add or edit, and reports every issue at once.
//
// When editing, the service can't change, and the saved secret fields may be left blank
// to keep them.
func readNotificationInput(
	body notificationBody,
	service string,
	savedSecretKeys []string,
	missingSecretKeys []string,
	editing bool,
) (notificationInput, []validationIssue) {
	input := notificationInput{}
	issues := []validationIssue{}

	eventKeys := make([]string, 0, len(notificationEvents))
	for _, event := range notificationEvents {
		eventKeys = append(eventKeys, event.Key)
	}

	events, eventIssues := notifications.ReadEvents(body.Events, eventKeys)
	issues = append(issues, notificationIssues(eventIssues)...)
	input.Events = events

	name, message := notifications.ReadName(body.Name)
	if message != "" {
		issues = append(issues, newFieldIssue("name", message))
	}
	input.Name = name

	if editing && len(body.Service) > 0 {
		var requestedService string
		if json.Unmarshal(body.Service, &requestedService) != nil || requestedService != service {
			issues = append(issues, newFieldIssue("service", "The service can't be changed."))
		}
	}

	settings, secrets, settingIssues := notifications.ReadSettings(service, body.Settings, savedSecretKeys)
	issues = append(issues, notificationIssues(settingIssues)...)
	input.Settings = settings
	input.Secrets = secrets

	// A new destination has nothing saved, so any secret it names to clear is rejected.
	clearSecrets, clearSecretIssues := notifications.ReadClearSecrets(
		service,
		body.ClearSecrets,
		append(slices.Clone(savedSecretKeys), missingSecretKeys...),
	)
	issues = append(issues, notificationIssues(clearSecretIssues)...)
	input.ClearSecrets = clearSecrets

	for _, field := range clearSecrets {
		if _, entered := secrets[field]; entered {
			issues = append(issues, newFieldIssue(
				"settings."+field,
				"Enter a new value or clear this field, not both.",
			))
		}
	}

	return input, issues
}

// notificationIssues turns field issues from the notifications package into API issues,
// splitting a dotted field such as "settings.url" into its path.
func notificationIssues(issues []notifications.Issue) []validationIssue {
	converted := make([]validationIssue, 0, len(issues))
	for _, issue := range issues {
		converted = append(converted, validationIssue{
			Field:   issue.Field,
			Path:    strings.Split(issue.Field, "."),
			Message: issue.Message,
		})
	}

	return converted
}

// newNotificationID returns a random destination identifier, like ntf-0123456789abcdef.
func newNotificationID() string {
	value := make([]byte, 8)
	_, _ = rand.Read(value)

	return "ntf-" + hex.EncodeToString(value)
}

// validNotificationID reports whether a path value could name a destination, so a
// malformed one gets the same answer as a removed one.
func validNotificationID(id string) bool {
	hexadecimal, found := strings.CutPrefix(id, "ntf-")
	if !found || len(hexadecimal) != 16 {
		return false
	}

	for _, character := range hexadecimal {
		if !strings.ContainsRune("0123456789abcdef", character) {
			return false
		}
	}

	return true
}

// writeNotificationNotFound answers a destination that doesn't exist or was removed.
func writeNotificationNotFound(responseWriter http.ResponseWriter) {
	writeError(responseWriter, http.StatusNotFound, "notification_not_found", "That notification no longer exists.")
}

// writeNotificationNameTaken answers a name another destination already uses. The issue
// points at the name field.
func writeNotificationNameTaken(responseWriter http.ResponseWriter) {
	writeFieldError(
		responseWriter,
		http.StatusConflict,
		"notification_exists",
		"name",
		"A notification with this name already exists.",
	)
}
