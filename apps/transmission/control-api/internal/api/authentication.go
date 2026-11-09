package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

const sessionLifetime = 24 * time.Hour

// tokenScopeChoices and tokenExpirationFormat are the token field messages shared with
// pfsense-actions for an unknown scope and an unreadable expiry.
const (
	tokenScopeChoices     = "Choose from: torrents:read, torrents:write, vpn:read, vpn:write, settings:read, settings:write."
	tokenExpirationFormat = "Use an ISO 8601 date and time with a time zone, like 2030-01-01T00:00:00Z."
)

var administratorUsernamePattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$`)

// handleSetupStatus reports whether the installation still needs its first owner.
//
// This public response contains no claim value or account details and is safe for the
// future first-run UI to request before authentication.
func (server *Server) handleSetupStatus(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	status, err := server.store.SetupClaimStatus(request.Context())
	if err != nil {
		server.logInternalError("read setup status", err)
		writeInternalError(responseWriter)

		return
	}

	response := map[string]any{
		"claimRequired": status.Required,
	}
	if !status.ExpiresAt.IsZero() {
		response["claimExpiresAt"] = status.ExpiresAt
	}

	writeJSON(responseWriter, http.StatusOK, response)
}

// handleClaim consumes the one-time setup credential and creates the administrator.
//
// Successful claims immediately receive a browser session, and the transaction makes
// every subsequent claim attempt invalid.
func (server *Server) handleClaim(responseWriter http.ResponseWriter, request *http.Request) {
	attemptKey := "claim:" + clientLimitKey(request)
	if !server.attempts.Allowed(attemptKey) {
		server.writeRateLimited(responseWriter, attemptKey, "Too many setup attempts. Try again in 15 minutes.")

		return
	}

	claimed, err := server.store.IsClaimed(request.Context())
	if err != nil {
		server.logInternalError("read setup state", err)
		writeInternalError(responseWriter)

		return
	}

	if claimed {
		writeError(responseWriter, http.StatusConflict, "claim_unavailable", "Setup is already complete. Sign in instead.")

		return
	}

	var input struct {
		ClaimCode string `json:"claimCode"`
		Username  string `json:"username"`
		Password  string `json:"password"`
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}

	input.ClaimCode = strings.TrimSpace(input.ClaimCode)
	input.Username = strings.TrimSpace(input.Username)

	issues := []validationIssue{}
	if input.ClaimCode == "" {
		issues = append(issues, newFieldIssue("claimCode", "Enter the setup code from the container log."))
	} else if len(input.ClaimCode) > 256 {
		issues = append(issues, newFieldIssue("claimCode", "The setup code is too long."))
	}
	if message := validateAdministratorUsername(input.Username); message != "" {
		issues = append(issues, newFieldIssue("username", message))
	}
	if message := validateAdministratorPassword(input.Password); message != "" {
		issues = append(issues, newFieldIssue("password", message))
	}
	if len(issues) > 0 {
		writeIssues(responseWriter, issues)

		return
	}

	passwordHash, err := security.HashPassword(input.Password)
	if err != nil {
		server.logInternalError("hash administrator password", err)
		writeInternalError(responseWriter)

		return
	}

	// Generated codes forgive letter case, spaces, and dashes, but a mounted secret
	// must match exactly.
	claimCode := input.ClaimCode
	if !server.mountedSetupCode {
		claimCode = security.NormalizeClaimCode(claimCode)
	}

	administrator, err := server.store.ClaimInstallation(
		request.Context(),
		security.Digest(claimCode),
		input.Username,
		passwordHash,
	)
	if errors.Is(err, storage.ErrClaimInvalid) {
		server.attempts.Failed(attemptKey)
		writeFieldError(
			responseWriter,
			http.StatusUnauthorized,
			"claim_invalid",
			"claimCode",
			"That setup code is wrong or expired. Restart the container to print a new one.",
		)

		return
	}

	if err != nil {
		// Another request may have finished setup first.
		if claimed, claimedError := server.store.IsClaimed(request.Context()); claimedError == nil && claimed {
			writeError(responseWriter, http.StatusConflict, "claim_unavailable", "Setup is already complete. Sign in instead.")

			return
		}

		server.logInternalError("claim installation", err)
		writeInternalError(responseWriter)

		return
	}

	server.attempts.Succeeded(attemptKey)
	server.issueSession(responseWriter, request, administrator, http.StatusCreated)
}

// handleLogin authenticates the local administrator and creates a browser session.
//
// Unknown users perform the same Argon2 work as a real user and receive the same error
// response as an incorrect password.
func (server *Server) handleLogin(responseWriter http.ResponseWriter, request *http.Request) {
	attemptKey := signInAttemptKey(request)
	if !server.attempts.Allowed(attemptKey) {
		server.writeRateLimited(responseWriter, attemptKey, "Too many sign-in attempts. Try again in 15 minutes.")

		return
	}

	var input struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}

	input.Username = strings.TrimSpace(input.Username)

	issues := []validationIssue{}
	if input.Username == "" {
		issues = append(issues, newFieldIssue("username", "Enter your username."))
	}
	if input.Password == "" {
		issues = append(issues, newFieldIssue("password", "Enter your password."))
	}
	if len(issues) > 0 {
		writeIssues(responseWriter, issues)

		return
	}

	if len(input.Username) > 64 || len(input.Password) > 1024 {
		server.attempts.Failed(attemptKey)
		writeError(responseWriter, http.StatusUnauthorized, "credentials_invalid", "The username or password is incorrect.")

		return
	}
	administrator, findError := server.store.FindAdministratorByUsername(
		request.Context(),
		input.Username,
	)
	passwordHash := server.dummyPasswordHash
	if findError == nil {
		passwordHash = administrator.PasswordHash
	} else if !errors.Is(findError, storage.ErrNotFound) {
		server.logInternalError("find administrator", findError)
		writeInternalError(responseWriter)

		return
	}

	passwordValid, verifyError := security.VerifyPasswordContext(
		request.Context(),
		input.Password,
		passwordHash,
	)
	if verifyError != nil {
		server.logInternalError("verify administrator password", verifyError)
	}

	if findError != nil || verifyError != nil || !passwordValid {
		server.attempts.Failed(attemptKey)
		writeError(responseWriter, http.StatusUnauthorized, "credentials_invalid", "The username or password is incorrect.")

		return
	}

	accountSecurity, err := server.store.AccountSecurity(request.Context(), administrator.ID)
	if err != nil {
		server.logInternalError("read account security", err)
		writeInternalError(responseWriter)

		return
	}

	// The failure count is kept until the second factor also passes, so knowing the
	// password does not reset the limit on guessing codes.
	if accountSecurity.TOTPEnabled {
		server.startSecondFactor(responseWriter, request, administrator)

		return
	}

	server.attempts.Succeeded(attemptKey)
	server.issueSession(responseWriter, request, administrator, http.StatusOK)
}

// signInAttemptKey groups every sign-in method under one limit per visitor network.
//
// Password, second-factor, recovery-code and passkey failures share the key so an
// attacker cannot get extra guesses by switching methods.
func signInAttemptKey(request *http.Request) string {
	return "sign-in:" + clientLimitKey(request)
}

// issueSession generates independent session and CSRF credentials and sets cookies.
//
// The session cookie is HTTP-only, while the strict-same-site CSRF cookie is readable
// by the same-origin frontend so it can echo the required request header.
func (server *Server) issueSession(
	responseWriter http.ResponseWriter,
	request *http.Request,
	administrator storage.Administrator,
	statusCode int,
) {
	sessionID, err := security.NewIdentifier()
	if err != nil {
		server.logInternalError("generate session identifier", err)
		writeInternalError(responseWriter)

		return
	}

	sessionToken, sessionDigest, err := security.NewOpaqueToken("tvs_", 32)
	if err != nil {
		server.logInternalError("generate session token", err)
		writeInternalError(responseWriter)

		return
	}

	csrfToken, csrfDigest, err := security.NewOpaqueToken("tvc_", 24)
	if err != nil {
		server.logInternalError("generate CSRF token", err)
		writeInternalError(responseWriter)

		return
	}

	expiresAt := time.Now().Add(sessionLifetime)
	if err := server.store.CreateSession(
		request.Context(),
		sessionID,
		administrator.ID,
		sessionDigest,
		csrfDigest,
		expiresAt,
	); err != nil {
		server.logInternalError("store browser session", err)
		writeInternalError(responseWriter)

		return
	}

	secureCookie := requestScheme(request) == "https"
	http.SetCookie(responseWriter, &http.Cookie{
		Name:     "tvpn_session",
		Value:    sessionToken,
		Path:     "/",
		Expires:  expiresAt,
		MaxAge:   int(sessionLifetime.Seconds()),
		HttpOnly: true,
		Secure:   secureCookie,
		SameSite: http.SameSiteStrictMode,
	})
	http.SetCookie(responseWriter, &http.Cookie{
		Name:     "tvpn_csrf",
		Value:    csrfToken,
		Path:     "/",
		Expires:  expiresAt,
		MaxAge:   int(sessionLifetime.Seconds()),
		HttpOnly: false,
		Secure:   secureCookie,
		SameSite: http.SameSiteStrictMode,
	})

	writeJSON(responseWriter, statusCode, map[string]any{
		"status": "authenticated",
		"administrator": map[string]any{
			"id":       administrator.ID,
			"username": administrator.Username,
		},
		"csrfToken": csrfToken,
		"expiresAt": expiresAt,
	})
}

// handleLogout revokes the current browser session and expires both cookies.
//
// Bearer tokens may call the endpoint but have no browser session to revoke, keeping
// the operation harmless and idempotent.
func (server *Server) handleLogout(responseWriter http.ResponseWriter, request *http.Request) {
	requestPrincipal := principalFromContext(request.Context())
	if requestPrincipal.Kind == "session" {
		if err := server.store.DeleteSession(request.Context(), requestPrincipal.Identifier); err != nil {
			server.logInternalError("delete browser session", err)
			writeInternalError(responseWriter)

			return
		}
	}

	expireAuthenticationCookie(responseWriter, "tvpn_session", true)
	expireAuthenticationCookie(responseWriter, "tvpn_csrf", false)
	responseWriter.WriteHeader(http.StatusNoContent)
}

// handleCurrentAdministrator returns the active principal's safe identity metadata.
//
// Token callers receive their token identifier, name, and scopes without impersonating
// an interactive browser session. Sessions also get the secrets a lost installation key
// removed, so the web interface can ask for them again.
func (server *Server) handleCurrentAdministrator(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	requestPrincipal := principalFromContext(request.Context())
	response := map[string]any{
		"authenticationType": requestPrincipal.Kind,
		"id":                 requestPrincipal.Identifier,
	}
	if requestPrincipal.Kind == "session" {
		removedSecrets, err := server.store.RemovedSecrets(request.Context(), requestPrincipal.AdministratorID)
		if err != nil {
			server.logInternalError("list removed secrets", err)
			writeInternalError(responseWriter)

			return
		}

		removedSecretItems := make([]removedSecretResponse, 0, len(removedSecrets))
		for _, removedSecret := range removedSecrets {
			removedSecretItems = append(removedSecretItems, removedSecretResponse{
				Kind:           removedSecret.Kind,
				Name:           removedSecret.Name,
				NotificationID: removedSecret.NotificationID,
				RemovedAt:      removedSecret.RemovedAt,
			})
		}

		response["administratorId"] = requestPrincipal.AdministratorID
		response["removedSecrets"] = removedSecretItems
		response["username"] = requestPrincipal.Username
	} else {
		response["name"] = requestPrincipal.TokenName

		scopes := make([]string, 0, len(requestPrincipal.Scopes))
		for scope := range requestPrincipal.Scopes {
			scopes = append(scopes, scope)
		}
		sort.Strings(scopes)
		response["scopes"] = scopes
	}

	writeJSON(responseWriter, http.StatusOK, response)
}

// handleDismissRemovedSecrets hides the notice about secrets a lost installation key took.
//
// Only an interactive administrator session protected by CSRF validation can dismiss
// it, and anything not entered again stays removed.
func (server *Server) handleDismissRemovedSecrets(responseWriter http.ResponseWriter, request *http.Request) {
	requestPrincipal := principalFromContext(request.Context())
	if err := server.store.DismissRemovedSecrets(request.Context(), requestPrincipal.AdministratorID); err != nil {
		server.logInternalError("dismiss removed secrets", err)
		writeInternalError(responseWriter)

		return
	}

	responseWriter.WriteHeader(http.StatusNoContent)
}

// handleListTokens returns non-secret metadata for administrator-created API tokens.
//
// Tokens are listed newest first, and token digests and plaintext credentials never
// leave storage.
func (server *Server) handleListTokens(responseWriter http.ResponseWriter, request *http.Request) {
	tokens, err := server.store.ListAPITokens(request.Context())
	if err != nil {
		server.logInternalError("list API tokens", err)
		writeInternalError(responseWriter)

		return
	}

	writeJSON(responseWriter, http.StatusOK, listResponse[storage.APIToken]{Items: tokens})
}

// handleCreateToken creates a scoped token and returns its plaintext exactly once.
//
// Allowed scopes are deliberately closed so future privileged operations cannot be
// acquired by sending an arbitrary string before that capability is designed.
func (server *Server) handleCreateToken(responseWriter http.ResponseWriter, request *http.Request) {
	fields, valid := readTokenFields(responseWriter, request)
	if !valid {
		return
	}

	tokenID, err := security.NewIdentifier()
	if err != nil {
		server.logInternalError("generate API token identifier", err)
		writeInternalError(responseWriter)

		return
	}

	plaintextToken, tokenDigest, err := security.NewOpaqueToken("tvpn_", 32)
	if err != nil {
		server.logInternalError("generate API token", err)
		writeInternalError(responseWriter)

		return
	}

	requestPrincipal := principalFromContext(request.Context())
	token, err := server.store.CreateAPIToken(
		request.Context(),
		tokenID,
		requestPrincipal.AdministratorID,
		fields.Name,
		tokenDigest,
		fields.Scopes,
		fields.ExpiresAt,
	)
	if errors.Is(err, storage.ErrTokenNameTaken) {
		writeTokenNameTaken(responseWriter)

		return
	}

	if err != nil {
		server.logInternalError("store API token", err)
		writeInternalError(responseWriter)

		return
	}

	writeJSON(responseWriter, http.StatusCreated, map[string]any{
		"token":     token,
		"plaintext": plaintextToken,
	})
}

// handleUpdateToken renames a token and changes its scopes and expiry.
//
// The token's value stays the same, so apps that use it pick up the new scopes on
// their next request without being reconfigured.
func (server *Server) handleUpdateToken(responseWriter http.ResponseWriter, request *http.Request) {
	tokenID := request.PathValue("tokenID")
	if !validTokenID(tokenID) {
		writeTokenNotFound(responseWriter)

		return
	}

	fields, valid := readTokenFields(responseWriter, request)
	if !valid {
		return
	}

	token, err := server.store.UpdateAPIToken(request.Context(), tokenID, storage.APITokenChanges{
		Name:           fields.Name,
		Scopes:         fields.Scopes,
		ExpiresAt:      fields.ExpiresAt,
		KeepExpiration: fields.KeepExpiration,
	})
	if errors.Is(err, storage.ErrNotFound) {
		writeTokenNotFound(responseWriter)

		return
	}

	if errors.Is(err, storage.ErrTokenNameTaken) {
		writeTokenNameTaken(responseWriter)

		return
	}

	if err != nil {
		server.logInternalError("update API token", err)
		writeInternalError(responseWriter)

		return
	}

	writeJSON(responseWriter, http.StatusOK, token)
}

// handleDeleteToken revokes one token by deleting it.
//
// The route never accepts plaintext token material and is limited to an interactive
// administrator session protected by CSRF validation.
func (server *Server) handleDeleteToken(responseWriter http.ResponseWriter, request *http.Request) {
	tokenID := request.PathValue("tokenID")
	if !validTokenID(tokenID) {
		writeTokenNotFound(responseWriter)

		return
	}

	err := server.store.DeleteAPIToken(request.Context(), tokenID)
	if errors.Is(err, storage.ErrNotFound) {
		writeTokenNotFound(responseWriter)

		return
	}

	if err != nil {
		server.logInternalError("delete API token", err)
		writeInternalError(responseWriter)

		return
	}

	responseWriter.WriteHeader(http.StatusNoContent)
}

// tokenBody is the JSON body of a token create or edit.
//
// Raw fields let a wrong type be reported on the field that has it, and let an
// omitted expiresAt be told apart from null.
type tokenBody struct {
	Name      json.RawMessage `json:"name"`
	Scopes    json.RawMessage `json:"scopes"`
	ExpiresAt json.RawMessage `json:"expiresAt"`
}

// tokenFields is a checked token create or edit. KeepExpiration is set when the body
// left out expiresAt, which keeps an edited token's expiry and means never for a new one.
type tokenFields struct {
	Name           string
	Scopes         []string
	ExpiresAt      *time.Time
	KeepExpiration bool
}

// readTokenFields decodes and checks a token create or edit body, answering the
// request itself when the body can't be used.
//
// Every field is checked at once so the console can mark each one, with the same
// words pfsense-actions uses.
func readTokenFields(responseWriter http.ResponseWriter, request *http.Request) (tokenFields, bool) {
	var body tokenBody
	if err := decodeJSONBody(responseWriter, request, &body); err != nil {
		writeDecodeError(responseWriter, err)

		return tokenFields{}, false
	}

	fields := tokenFields{}
	issues := []validationIssue{}

	name, message := readTokenName(body.Name)
	if message != "" {
		issues = append(issues, newFieldIssue("name", message))
	}
	fields.Name = name

	scopes, message := readTokenScopes(body.Scopes)
	if message != "" {
		issues = append(issues, newFieldIssue("scopes", message))
	}
	fields.Scopes = scopes

	expiresAt, keepExpiration, message := readTokenExpiration(body.ExpiresAt)
	if message != "" {
		issues = append(issues, newFieldIssue("expiresAt", message))
	}
	fields.ExpiresAt = expiresAt
	fields.KeepExpiration = keepExpiration

	if len(issues) > 0 {
		writeIssues(responseWriter, issues)

		return tokenFields{}, false
	}

	return fields, true
}

// readTokenName trims a token name. A missing, null, or non-text name counts as empty.
func readTokenName(raw json.RawMessage) (string, string) {
	var name string
	if len(raw) > 0 && json.Unmarshal(raw, &name) != nil {
		name = ""
	}

	name = strings.TrimSpace(name)

	return name, validateTokenName(name)
}

// validateTokenName applies the token name rule shared with pfsense-actions, the same
// limits as a passkey name.
func validateTokenName(name string) string {
	if name == "" {
		return "Name this token."
	}

	if utf8.RuneCountInString(name) > 80 {
		return "Use 80 characters or fewer."
	}

	return ""
}

// readTokenScopes reads the scope list. Anything that isn't a list counts as no scopes,
// and an entry that isn't text counts as an unknown scope.
func readTokenScopes(raw json.RawMessage) ([]string, string) {
	var values []json.RawMessage
	if len(raw) == 0 || json.Unmarshal(raw, &values) != nil {
		return nil, "Choose at least one scope."
	}

	scopes := make([]string, 0, len(values))
	for _, value := range values {
		var scope string
		if json.Unmarshal(value, &scope) != nil {
			return nil, tokenScopeChoices
		}

		scopes = append(scopes, scope)
	}

	return validateTokenScopes(scopes)
}

// readTokenExpiration reads expiresAt: omitted keeps the current expiry, null removes
// it, and anything else must be a future ISO 8601 time with a time zone.
func readTokenExpiration(raw json.RawMessage) (*time.Time, bool, string) {
	if len(raw) == 0 {
		return nil, true, ""
	}

	if string(raw) == "null" {
		return nil, false, ""
	}

	var text string
	if json.Unmarshal(raw, &text) != nil {
		return nil, false, tokenExpirationFormat
	}

	expiresAt, err := time.Parse(time.RFC3339, text)
	if err != nil {
		return nil, false, tokenExpirationFormat
	}

	if !expiresAt.After(time.Now()) {
		return nil, false, "Choose an expiration date in the future."
	}

	expiresAt = expiresAt.UTC()

	return &expiresAt, false, ""
}

// validTokenID rejects identifiers no token could have before storage is asked.
func validTokenID(tokenID string) bool {
	return tokenID != "" && len(tokenID) <= 64
}

// writeTokenNotFound answers a request for a token that doesn't exist, including one
// that was just revoked.
func writeTokenNotFound(responseWriter http.ResponseWriter) {
	writeError(responseWriter, http.StatusNotFound, "token_not_found", "That token no longer exists.")
}

// writeTokenNameTaken answers a create or edit that reuses another token's name.
func writeTokenNameTaken(responseWriter http.ResponseWriter) {
	writeFieldError(responseWriter, http.StatusConflict, "token_exists", "name", "A token with this name already exists.")
}

// validateAdministratorCredentials enforces the initial local-account policy.
//
// The UI can explain these stable rules before submission and the API remains the
// authoritative boundary for non-browser clients.
func validateAdministratorCredentials(username string, password string) (string, string) {
	if message := validateAdministratorUsername(username); message != "" {
		return "username", message
	}

	if message := validateAdministratorPassword(password); message != "" {
		return "password", message
	}

	return "", ""
}

// validateAdministratorUsername applies the username rule shared with
// pfsense-actions: 3 to 64 characters, starting with a letter or number.
func validateAdministratorUsername(username string) string {
	if username == "" {
		return "Enter a username."
	}

	if !administratorUsernamePattern.MatchString(username) {
		return "Use 3 to 64 letters, numbers, periods, underscores, or hyphens, starting with a letter or number."
	}

	return ""
}

// validateAdministratorPassword enforces the password length policy on its own so
// setup and password changes share the exact rule and wording.
func validateAdministratorPassword(password string) string {
	if len(password) < 12 {
		return "Use at least 12 characters."
	}

	if len(password) > 1024 {
		return "Use 1024 characters or fewer."
	}

	return ""
}

// validateTokenScopes normalizes and validates the automation authorization set.
//
// Scopes are area:verb, a write scope adds its matching read scope, and the result is
// sorted before persistence so authorization responses remain deterministic.
func validateTokenScopes(scopes []string) ([]string, string) {
	allowedScopes := map[string]struct{}{
		"settings:read":  {},
		"settings:write": {},
		"torrents:read":  {},
		"torrents:write": {},
		"vpn:read":       {},
		"vpn:write":      {},
	}

	requestedScopes := map[string]struct{}{}
	uniqueScopes := map[string]struct{}{}
	for _, scope := range scopes {
		if _, found := allowedScopes[scope]; !found {
			return nil, tokenScopeChoices
		}

		if _, repeated := requestedScopes[scope]; repeated {
			return nil, "Choose each scope only once."
		}
		requestedScopes[scope] = struct{}{}
		uniqueScopes[scope] = struct{}{}

		// Writing implies reading the same area.
		if area, isWrite := strings.CutSuffix(scope, ":write"); isWrite {
			uniqueScopes[area+":read"] = struct{}{}
		}
	}

	if len(uniqueScopes) == 0 {
		return nil, "Choose at least one scope."
	}

	validatedScopes := make([]string, 0, len(uniqueScopes))
	for scope := range uniqueScopes {
		validatedScopes = append(validatedScopes, scope)
	}
	sort.Strings(validatedScopes)

	return validatedScopes, ""
}

// expireAuthenticationCookie removes one browser authentication cookie immediately.
//
// Matching the original cookie path ensures browsers replace the correct cookie even
// when logout is called after the server-side session already expired.
func expireAuthenticationCookie(
	responseWriter http.ResponseWriter,
	name string,
	httpOnly bool,
) {
	http.SetCookie(responseWriter, &http.Cookie{
		Name:     name,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		Expires:  time.Unix(1, 0),
		HttpOnly: httpOnly,
		SameSite: http.SameSiteStrictMode,
	})
}

// logInternalError records server-side detail without exposing it to API clients.
//
// Credentials and request bodies are never passed to this helper, preserving the
// project's secret-free logging invariant.
func (server *Server) logInternalError(message string, err error) {
	server.logger.Error(message, "error", err)
}
