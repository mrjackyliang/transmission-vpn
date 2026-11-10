package api

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

const (
	webProxyPort                = 22605
	webProxyConfigRetryInterval = 5 * time.Second
	webProxyConnectionMessage   = "Choose an existing VPN connection, or set up a default connection first."
)

var webProxyUsernamePattern = regexp.MustCompile(`^[A-Za-z0-9._-]{1,64}$`)

// webProxyBody is the JSON body of the one-row proxy switch.
//
// Raw JSON distinguishes an omitted enabled field from an explicit false value so the
// existing field-issue contract can describe malformed requests precisely.
type webProxyBody struct {
	Enabled json.RawMessage `json:"enabled"`
}

// webProxyLoginCreateBody is the JSON body for one generated proxy credential.
type webProxyLoginCreateBody struct {
	Username     json.RawMessage `json:"username"`
	ConnectionID json.RawMessage `json:"connectionId"`
}

// webProxyLoginUpdateBody is the JSON body for a proxy login edit.
//
// Raw values distinguish omitted fields from malformed values so partial updates keep
// their existing values while still reporting field-specific issues.
type webProxyLoginUpdateBody struct {
	Username           json.RawMessage `json:"username"`
	ConnectionID       json.RawMessage `json:"connectionId"`
	RegeneratePassword json.RawMessage `json:"regeneratePassword"`
}

// webProxyLoginResponse is one proxy login without its Argon2id verifier.
//
// PasswordSet tells the future interface that the credential is usable while keeping
// both the plaintext and persisted hash out of every read response.
type webProxyLoginResponse struct {
	ID                    string  `json:"id"`
	Username              string  `json:"username"`
	PasswordSet           bool    `json:"passwordSet"`
	ConnectionID          *string `json:"connectionId"`
	EffectiveConnectionID string  `json:"effectiveConnectionId"`
}

// webProxyLoginCredentialResponse returns a generated password exactly once.
type webProxyLoginCredentialResponse struct {
	Login    webProxyLoginResponse `json:"login"`
	Password *string               `json:"password,omitempty"`
}

// webProxyResponse combines desired settings, runtime state, and safe login metadata.
type webProxyResponse struct {
	Enabled bool                    `json:"enabled"`
	Port    int                     `json:"port"`
	State   string                  `json:"state"`
	Error   string                  `json:"error,omitempty"`
	Logins  []webProxyLoginResponse `json:"logins"`
}

// webProxyRuntimeStatus is the proxy process's atomic status-file contract.
type webProxyRuntimeStatus struct {
	State string `json:"state"`
	Error string `json:"error,omitempty"`
}

// webProxyRuntimeConfig is the permission-restricted hand-off to the proxy process.
type webProxyRuntimeConfig struct {
	Enabled bool                         `json:"enabled"`
	Logins  []webProxyRuntimeConfigLogin `json:"logins"`
}

// webProxyRuntimeConfigLogin carries one verifier to the unprivileged proxy process.
type webProxyRuntimeConfigLogin struct {
	ID           string `json:"id"`
	Username     string `json:"username"`
	PasswordHash string `json:"passwordHash"`
	ConnectionID string `json:"connectionId"`
}

// handleGetWebProxy returns the proxy switch, observed state, and safe login list.
func (server *Server) handleGetWebProxy(responseWriter http.ResponseWriter, request *http.Request) {
	response, err := server.readWebProxyResponse(request)
	if err != nil {
		server.logInternalError("read web proxy", err)
		writeInternalError(responseWriter)

		return
	}

	writeJSON(responseWriter, http.StatusOK, response)
}

// handleUpdateWebProxy enables or disables the proxy after validating its VPN route.
//
// Since: 2.0.0
func (server *Server) handleUpdateWebProxy(responseWriter http.ResponseWriter, request *http.Request) {
	var body webProxyBody
	if err := decodeJSONBody(responseWriter, request, &body); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}

	var enabled bool
	if len(body.Enabled) == 0 || json.Unmarshal(body.Enabled, &enabled) != nil {
		writeIssues(responseWriter, []validationIssue{
			newFieldIssue("enabled", "Choose whether the web proxy is on."),
		})

		return
	}
	if enabled {
		connections, err := server.store.ListVPNConnections(request.Context())
		if err != nil {
			server.logInternalError("list VPN connections for web proxy", err)
			writeInternalError(responseWriter)

			return
		}
		if len(connections) == 0 {
			writeError(
				responseWriter,
				http.StatusConflict,
				"vpn_connection_required",
				"Add a VPN connection before turning on the web proxy.",
			)

			return
		}
	}

	server.webProxyMutex.Lock()
	defer server.webProxyMutex.Unlock()

	if _, err := server.store.SetWebProxyEnabled(request.Context(), enabled); errors.Is(err, storage.ErrVPNConnectionRequired) {
		writeError(
			responseWriter,
			http.StatusConflict,
			"vpn_connection_required",
			"Add a VPN connection before turning on the web proxy.",
		)

		return
	} else if err != nil {
		server.logInternalError("update web proxy", err)
		writeInternalError(responseWriter)

		return
	}

	if err := server.publishWebProxyConfigAfterSave(
		context.WithoutCancel(request.Context()),
	); err != nil {
		writeWebProxyPublishDeferred(responseWriter)

		return
	}

	response, err := server.readWebProxyResponse(request)
	if err != nil {
		server.logInternalError("read updated web proxy", err)
		writeInternalError(responseWriter)

		return
	}

	writeJSON(responseWriter, http.StatusOK, response)
}

// handleCreateWebProxyLogin generates and stores one proxy credential.
//
// The plaintext is returned only in this response. Storage and the runtime hand-off
// receive only the existing Argon2id verifier.
//
// Since: 2.0.0
func (server *Server) handleCreateWebProxyLogin(responseWriter http.ResponseWriter, request *http.Request) {
	var body webProxyLoginCreateBody
	if err := decodeJSONBody(responseWriter, request, &body); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}

	username, usernameIssue := readWebProxyUsername(body.Username)
	connectionID, validConnectionID := readOptionalVPNConnectionID(body.ConnectionID)
	issues := []validationIssue{}
	if usernameIssue != "" {
		issues = append(issues, newFieldIssue("username", usernameIssue))
	}
	if !validConnectionID {
		issues = append(issues, newFieldIssue("connectionId", webProxyConnectionMessage))
	}
	if len(issues) > 0 {
		writeIssues(responseWriter, issues)

		return
	}
	connections, err := server.store.ListVPNConnections(request.Context())
	if err != nil {
		server.logInternalError("list VPN connections for web proxy login", err)
		writeInternalError(responseWriter)

		return
	}
	if len(connections) == 0 {
		writeError(
			responseWriter,
			http.StatusConflict,
			"vpn_connection_required",
			"Add a VPN connection before adding a login.",
		)

		return
	}

	password, _, err := newGeneratedLoginPassword()
	if err != nil {
		server.logInternalError("generate web proxy login password", err)
		writeInternalError(responseWriter)

		return
	}

	passwordHash, err := security.HashPassword(password)
	if err != nil {
		server.logInternalError("hash web proxy password", err)
		writeInternalError(responseWriter)

		return
	}

	id, err := newWebProxyLoginID()
	if err != nil {
		server.logInternalError("generate web proxy login identifier", err)
		writeInternalError(responseWriter)

		return
	}

	server.webProxyMutex.Lock()
	defer server.webProxyMutex.Unlock()

	releaseConnectionReference, removing := server.holdVPNConnectionReference(connectionID)
	if removing {
		writeConnectionBeingRemoved(responseWriter)

		return
	}
	defer releaseConnectionReference()
	effectiveConnectionID, err := server.effectiveVPNConnectionID(request.Context(), connectionID)
	if err != nil {
		if isMissingVPNConnection(err) {
			writeFieldError(responseWriter, http.StatusUnprocessableEntity, "web_proxy_connection_invalid", "connectionId", webProxyConnectionMessage)
		} else {
			server.logInternalError("validate web proxy login connection", err)
			writeInternalError(responseWriter)
		}

		return
	}

	login, err := server.store.CreateWebProxyLogin(request.Context(), storage.WebProxyLogin{
		ID:           id,
		Username:     username,
		PasswordHash: passwordHash,
		ConnectionID: connectionID,
	})
	if errors.Is(err, storage.ErrWebProxyUsernameTaken) {
		writeWebProxyUsernameTaken(responseWriter)

		return
	}
	if errors.Is(err, storage.ErrVPNConnectionReference) {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "web_proxy_connection_invalid", "connectionId", webProxyConnectionMessage)

		return
	}
	if err != nil {
		server.logInternalError("create web proxy login", err)
		writeInternalError(responseWriter)

		return
	}

	if err := server.publishWebProxyConfigAfterSave(
		context.WithoutCancel(request.Context()),
	); err != nil {
		writeWebProxyPublishDeferred(responseWriter)

		return
	}

	writeJSON(responseWriter, http.StatusCreated, webProxyLoginCredentialResponse{
		Login:    newWebProxyLoginResponse(login, effectiveConnectionID),
		Password: &password,
	})
}

// handleUpdateWebProxyLogin edits a login and optionally regenerates its password.
//
// Omitted fields retain their existing values. A generated password appears only when
// regeneration was explicitly requested and the complete update succeeds.
//
// Since: 2.0.0
func (server *Server) handleUpdateWebProxyLogin(responseWriter http.ResponseWriter, request *http.Request) {
	id := request.PathValue("loginID")
	if !validWebProxyLoginID(id) {
		writeWebProxyLoginNotFound(responseWriter)

		return
	}

	existing, err := server.store.FindWebProxyLogin(request.Context(), id)
	if errors.Is(err, storage.ErrNotFound) {
		writeWebProxyLoginNotFound(responseWriter)

		return
	}
	if err != nil {
		server.logInternalError("read web proxy login", err)
		writeInternalError(responseWriter)

		return
	}

	var body webProxyLoginUpdateBody
	if err := decodeJSONBody(responseWriter, request, &body); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}

	username := existing.Username
	usernameProvided := len(body.Username) > 0
	connectionID := existing.ConnectionID
	connectionIDSet := len(body.ConnectionID) > 0
	issues := []validationIssue{}
	if usernameProvided {
		var usernameIssue string
		username, usernameIssue = readWebProxyUsername(body.Username)
		if usernameIssue != "" {
			issues = append(issues, newFieldIssue("username", usernameIssue))
		}
	}
	if connectionIDSet {
		var validConnectionID bool
		connectionID, validConnectionID = readOptionalVPNConnectionID(body.ConnectionID)
		if !validConnectionID {
			issues = append(issues, newFieldIssue("connectionId", webProxyConnectionMessage))
		}
	}

	regeneratePassword := false
	if len(body.RegeneratePassword) > 0 && json.Unmarshal(body.RegeneratePassword, &regeneratePassword) != nil {
		issues = append(issues, newFieldIssue(
			"regeneratePassword",
			"Choose whether to regenerate the password.",
		))
	}
	if len(issues) == 0 && !usernameProvided && !connectionIDSet && !regeneratePassword {
		issues = append(issues, newFieldIssue(
			"regeneratePassword",
			"Change the username, VPN connection, or regenerate the password.",
		))
	}
	if len(issues) > 0 {
		writeIssues(responseWriter, issues)

		return
	}

	var password *string
	var passwordHash *string
	if regeneratePassword {
		generatedPassword, _, err := newGeneratedLoginPassword()
		if err != nil {
			server.logInternalError("regenerate web proxy login password", err)
			writeInternalError(responseWriter)

			return
		}

		hash, err := security.HashPassword(generatedPassword)
		if err != nil {
			server.logInternalError("hash regenerated web proxy password", err)
			writeInternalError(responseWriter)

			return
		}
		password = &generatedPassword
		passwordHash = &hash
	}

	server.webProxyMutex.Lock()
	defer server.webProxyMutex.Unlock()

	if connectionIDSet {
		releaseConnectionReference, removing := server.holdVPNConnectionReference(
			connectionID,
		)
		if removing {
			writeConnectionBeingRemoved(responseWriter)

			return
		}
		defer releaseConnectionReference()
		if _, err := server.effectiveVPNConnectionID(request.Context(), connectionID); err != nil {
			if isMissingVPNConnection(err) {
				writeFieldError(responseWriter, http.StatusUnprocessableEntity, "web_proxy_connection_invalid", "connectionId", webProxyConnectionMessage)
			} else {
				server.logInternalError("validate updated web proxy login connection", err)
				writeInternalError(responseWriter)
			}

			return
		}
	}

	login, err := server.store.UpdateWebProxyLogin(request.Context(), id, storage.WebProxyLoginChanges{
		Username:        username,
		PasswordHash:    passwordHash,
		ConnectionID:    connectionID,
		ConnectionIDSet: connectionIDSet,
	})
	if errors.Is(err, storage.ErrNotFound) {
		writeWebProxyLoginNotFound(responseWriter)

		return
	}
	if errors.Is(err, storage.ErrWebProxyUsernameTaken) {
		writeWebProxyUsernameTaken(responseWriter)

		return
	}
	if errors.Is(err, storage.ErrVPNConnectionReference) {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "web_proxy_connection_invalid", "connectionId", webProxyConnectionMessage)

		return
	}
	if err != nil {
		server.logInternalError("update web proxy login", err)
		writeInternalError(responseWriter)

		return
	}

	if err := server.publishWebProxyConfigAfterSave(
		context.WithoutCancel(request.Context()),
	); err != nil {
		writeWebProxyPublishDeferred(responseWriter)

		return
	}

	effectiveConnectionIDs, err := server.effectiveWebProxyLoginConnectionIDs(
		request.Context(),
		[]storage.WebProxyLogin{login},
	)
	if err != nil {
		server.logInternalError("resolve updated web proxy login connection", err)
		writeInternalError(responseWriter)

		return
	}

	writeJSON(responseWriter, http.StatusOK, webProxyLoginCredentialResponse{
		Login:    newWebProxyLoginResponse(login, effectiveConnectionIDs[0]),
		Password: password,
	})
}

// handleDeleteWebProxyLogin removes one proxy credential and republishes the list.
func (server *Server) handleDeleteWebProxyLogin(responseWriter http.ResponseWriter, request *http.Request) {
	id := request.PathValue("loginID")
	if !validWebProxyLoginID(id) {
		writeWebProxyLoginNotFound(responseWriter)

		return
	}

	server.webProxyMutex.Lock()
	defer server.webProxyMutex.Unlock()

	err := server.store.DeleteWebProxyLogin(request.Context(), id)
	if errors.Is(err, storage.ErrNotFound) {
		writeWebProxyLoginNotFound(responseWriter)

		return
	}
	if err != nil {
		server.logInternalError("delete web proxy login", err)
		writeInternalError(responseWriter)

		return
	}

	if err := server.publishWebProxyConfigAfterSave(
		context.WithoutCancel(request.Context()),
	); err != nil {
		writeWebProxyPublishDeferred(responseWriter)

		return
	}

	responseWriter.WriteHeader(http.StatusNoContent)
}

// readWebProxyResponse combines durable proxy configuration with its runtime state.
func (server *Server) readWebProxyResponse(request *http.Request) (webProxyResponse, error) {
	proxy, logins, err := server.store.WebProxyConfiguration(request.Context())
	if err != nil {
		return webProxyResponse{}, err
	}

	status, err := readWebProxyRuntimeStatus(server.webProxyStatusPath)
	if err != nil {
		return webProxyResponse{}, err
	}

	effectiveConnectionIDs, err := server.effectiveWebProxyLoginConnectionIDs(request.Context(), logins)
	if err != nil {
		return webProxyResponse{}, err
	}
	loginResponses := make([]webProxyLoginResponse, 0, len(logins))
	for index, login := range logins {
		loginResponses = append(
			loginResponses,
			newWebProxyLoginResponse(login, effectiveConnectionIDs[index]),
		)
	}

	return webProxyResponse{
		Enabled: proxy.Enabled,
		Port:    webProxyPort,
		State:   status.State,
		Error:   status.Error,
		Logins:  loginResponses,
	}, nil
}

// readWebProxyRuntimeStatus reads the proxy process's latest atomic status.
func readWebProxyRuntimeStatus(path string) (webProxyRuntimeStatus, error) {
	content, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return webProxyRuntimeStatus{State: "off"}, nil
	}
	if err != nil {
		return webProxyRuntimeStatus{}, fmt.Errorf("read web proxy runtime status: %w", err)
	}

	var status webProxyRuntimeStatus
	if err := json.Unmarshal(content, &status); err != nil {
		return webProxyRuntimeStatus{}, fmt.Errorf("decode web proxy runtime status: %w", err)
	}

	switch status.State {
	case "off", "listening", "waiting-for-vpn", "error":
		return status, nil
	default:
		return webProxyRuntimeStatus{}, fmt.Errorf("web proxy runtime status has invalid state %q", status.State)
	}
}

// writeWebProxyConfig atomically publishes the complete proxy runtime hand-off.
//
// Mutation handlers detach client cancellation after their database commit so every
// accepted change still reaches the proxy when a browser closes its request early.
func (server *Server) writeWebProxyConfig(ctx context.Context) error {
	proxy, logins, err := server.store.WebProxyConfiguration(ctx)
	if err != nil {
		return err
	}

	configuration := webProxyRuntimeConfig{
		Enabled: proxy.Enabled,
		Logins:  make([]webProxyRuntimeConfigLogin, 0, len(logins)),
	}
	effectiveConnectionIDs, err := server.effectiveWebProxyLoginConnectionIDs(ctx, logins)
	if err != nil {
		return err
	}
	for index, login := range logins {
		configuration.Logins = append(configuration.Logins, webProxyRuntimeConfigLogin{
			ID:           login.ID,
			Username:     login.Username,
			PasswordHash: login.PasswordHash,
			ConnectionID: effectiveConnectionIDs[index],
		})
	}

	publisher := server.webProxyConfigPublisher
	if publisher == nil {
		publisher = publishWebProxyConfig
	}

	return publisher(server.webProxyConfigPath, configuration)
}

// publishWebProxyConfigAfterSave publishes a committed change or starts one retry loop.
//
// Mutation responses can report the durable success separately from the runtime lag,
// while one background owner keeps retrying the latest database snapshot.
func (server *Server) publishWebProxyConfigAfterSave(ctx context.Context) error {
	err := server.writeWebProxyConfig(ctx)
	if err != nil {
		server.startWebProxyConfigRetry(err)

		return err
	}

	server.markWebProxyConfigPublished()

	return nil
}

// startWebProxyConfigRetry starts at most one five-second publish loop.
//
// The first failure in a streak is logged; later failures stay quiet until a publish
// succeeds and resets the streak for a future change.
func (server *Server) startWebProxyConfigRetry(publishError error) {
	server.webProxyRetryMutex.Lock()
	logFailure := !server.webProxyFailureLogged
	server.webProxyFailureLogged = true
	if server.webProxyRetryCancel != nil {
		server.webProxyRetryMutex.Unlock()
		if logFailure {
			server.logInternalError("publish web proxy configuration; retrying", publishError)
		}

		return
	}

	retryContext, cancelRetry := context.WithCancel(context.Background())
	server.webProxyRetryGeneration++
	retryGeneration := server.webProxyRetryGeneration
	server.webProxyRetryCancel = cancelRetry
	retryInterval := server.webProxyRetryInterval
	if retryInterval <= 0 {
		retryInterval = webProxyConfigRetryInterval
	}
	server.webProxyRetryWait.Add(1)
	server.webProxyRetryMutex.Unlock()

	if logFailure {
		server.logInternalError("publish web proxy configuration; retrying", publishError)
	}

	go server.retryWebProxyConfig(retryContext, retryGeneration, retryInterval)
}

// retryWebProxyConfig republishes the latest durable snapshot until it succeeds.
func (server *Server) retryWebProxyConfig(
	ctx context.Context,
	retryGeneration uint64,
	retryInterval time.Duration,
) {
	defer server.webProxyRetryWait.Done()

	ticker := time.NewTicker(retryInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			server.webProxyMutex.Lock()
			err := server.writeWebProxyConfig(ctx)
			if err != nil {
				server.webProxyMutex.Unlock()

				continue
			}

			server.webProxyRetryMutex.Lock()
			if server.webProxyRetryGeneration == retryGeneration {
				server.webProxyRetryCancel = nil
				server.webProxyFailureLogged = false
			}
			server.webProxyRetryMutex.Unlock()
			server.webProxyMutex.Unlock()

			return
		}
	}
}

// markWebProxyConfigPublished ends any older retry and resets failure logging.
func (server *Server) markWebProxyConfigPublished() {
	server.webProxyRetryMutex.Lock()
	server.webProxyRetryGeneration++
	cancelRetry := server.webProxyRetryCancel
	server.webProxyRetryCancel = nil
	server.webProxyFailureLogged = false
	server.webProxyRetryMutex.Unlock()

	if cancelRetry != nil {
		cancelRetry()
	}
}

// stopWebProxyConfigRetry releases the background retry owned by the server.
func (server *Server) stopWebProxyConfigRetry() {
	server.webProxyRetryMutex.Lock()
	server.webProxyRetryGeneration++
	cancelRetry := server.webProxyRetryCancel
	server.webProxyRetryCancel = nil
	server.webProxyRetryMutex.Unlock()

	if cancelRetry != nil {
		cancelRetry()
	}
	server.webProxyRetryWait.Wait()
}

// newWebProxyLoginResponse removes the password verifier from one stored login.
func newWebProxyLoginResponse(
	login storage.WebProxyLogin,
	effectiveConnectionID string,
) webProxyLoginResponse {
	return webProxyLoginResponse{
		ID:                    login.ID,
		Username:              login.Username,
		PasswordSet:           true,
		ConnectionID:          login.ConnectionID,
		EffectiveConnectionID: effectiveConnectionID,
	}
}

// effectiveWebProxyLoginConnectionIDs resolves every null login through one default.
//
// Legacy logins can predate the first VPN connection. They remain manageable with an
// empty effective route, which keeps the disabled proxy fail-closed until setup.
//
// Since: 2.0.0
func (server *Server) effectiveWebProxyLoginConnectionIDs(
	ctx context.Context,
	logins []storage.WebProxyLogin,
) ([]string, error) {
	effectiveConnectionIDs := make([]string, len(logins))
	defaultConnectionID := ""
	readDefaultConnectionID := func() (string, error) {
		if defaultConnectionID != "" {
			return defaultConnectionID, nil
		}

		connection, err := server.store.DefaultVPNConnection(ctx)
		if errors.Is(err, storage.ErrNotFound) {
			return "", nil
		}
		if err != nil {
			return "", err
		}
		defaultConnectionID = connection.ID

		return defaultConnectionID, nil
	}
	for index, login := range logins {
		if login.ConnectionID != nil {
			if err := server.validateVPNConnectionReference(ctx, login.ConnectionID); err != nil {
				if !isMissingVPNConnection(err) {
					return nil, err
				}

				fallbackConnectionID, fallbackError := readDefaultConnectionID()
				if fallbackError != nil {
					return nil, fallbackError
				}
				server.logger.Warn(
					"web proxy login references a missing VPN connection; using the default",
					"loginId", login.ID,
					"connectionId", *login.ConnectionID,
					"defaultConnectionId", fallbackConnectionID,
				)
				effectiveConnectionIDs[index] = fallbackConnectionID

				continue
			}
			effectiveConnectionIDs[index] = *login.ConnectionID

			continue
		}
		connectionID, err := readDefaultConnectionID()
		if err != nil {
			return nil, err
		}
		effectiveConnectionIDs[index] = connectionID
	}

	return effectiveConnectionIDs, nil
}

// readWebProxyUsername validates one exact proxy username.
func readWebProxyUsername(value json.RawMessage) (string, string) {
	var username string
	if len(value) == 0 || json.Unmarshal(value, &username) != nil || username == "" {
		return "", "Enter a username."
	}
	if !webProxyUsernamePattern.MatchString(username) {
		return "", "Use 1 to 64 letters, numbers, periods, underscores, or hyphens."
	}

	return username, ""
}

// newWebProxyLoginID returns a random identifier such as wpl-0123456789abcdef.
func newWebProxyLoginID() (string, error) {
	value := make([]byte, 8)
	if _, err := rand.Read(value); err != nil {
		return "", fmt.Errorf("generate random identifier: %w", err)
	}

	return "wpl-" + hex.EncodeToString(value), nil
}

// validWebProxyLoginID reports whether a path value could name a proxy login.
func validWebProxyLoginID(id string) bool {
	hexadecimal, found := strings.CutPrefix(id, "wpl-")
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

// writeWebProxyLoginNotFound answers a login that does not exist or was removed.
func writeWebProxyLoginNotFound(responseWriter http.ResponseWriter) {
	writeError(responseWriter, http.StatusNotFound, "web_proxy_login_not_found", "That web proxy login no longer exists.")
}

// writeWebProxyUsernameTaken answers a username already used by another login.
func writeWebProxyUsernameTaken(responseWriter http.ResponseWriter) {
	writeFieldError(
		responseWriter,
		http.StatusConflict,
		"web_proxy_login_exists",
		"username",
		"A web proxy login with this username already exists.",
	)
}

// writeWebProxyPublishDeferred explains that persistence succeeded before publishing.
func writeWebProxyPublishDeferred(responseWriter http.ResponseWriter) {
	writeError(
		responseWriter,
		http.StatusInternalServerError,
		"web_proxy_update_deferred",
		"The change was saved, and the web proxy update will be retried.",
	)
}

// publishWebProxyConfig writes one complete hand-off with mode 0640 and renames it.
func publishWebProxyConfig(path string, configuration webProxyRuntimeConfig) error {
	temporaryFile, err := os.CreateTemp(filepath.Dir(path), ".web-proxy-config-*")
	if err != nil {
		return fmt.Errorf("create web proxy configuration: %w", err)
	}

	temporaryPath := temporaryFile.Name()
	committed := false
	defer func() {
		_ = temporaryFile.Close()
		if !committed {
			_ = os.Remove(temporaryPath)
		}
	}()

	if err := temporaryFile.Chmod(0o640); err != nil {
		return fmt.Errorf("set web proxy configuration permissions: %w", err)
	}
	if err := json.NewEncoder(temporaryFile).Encode(configuration); err != nil {
		return fmt.Errorf("encode web proxy configuration: %w", err)
	}
	if err := temporaryFile.Sync(); err != nil {
		return fmt.Errorf("sync web proxy configuration: %w", err)
	}
	if err := temporaryFile.Close(); err != nil {
		return fmt.Errorf("close web proxy configuration: %w", err)
	}
	if err := os.Rename(temporaryPath, path); err != nil {
		return fmt.Errorf("publish web proxy configuration: %w", err)
	}

	committed = true

	return nil
}
