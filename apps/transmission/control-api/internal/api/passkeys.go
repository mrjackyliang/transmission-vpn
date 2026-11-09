package api

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

const (
	passkeyCeremonyLifetime = 5 * time.Minute
	passkeyRelyingPartyName = "Transmission VPN"
)

// passkeyView is the safe description of one passkey for the security page.
type passkeyView struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	Hostname   string     `json:"hostname"`
	CreatedAt  time.Time  `json:"createdAt"`
	LastUsedAt *time.Time `json:"lastUsedAt"`
}

// newPasskeyView strips the stored credential down to what the page shows.
func newPasskeyView(passkey storage.Passkey) passkeyView {
	return passkeyView{
		ID:         passkey.ID,
		Name:       passkey.Name,
		Hostname:   passkey.RPID,
		CreatedAt:  passkey.CreatedAt,
		LastUsedAt: passkey.LastUsedAt,
	}
}

// passkeyUser adapts the administrator to the go-webauthn User interface.
type passkeyUser struct {
	administrator storage.Administrator
	userID        []byte
	credentials   []webauthn.Credential
}

func (user passkeyUser) WebAuthnID() []byte                         { return user.userID }
func (user passkeyUser) WebAuthnName() string                       { return user.administrator.Username }
func (user passkeyUser) WebAuthnDisplayName() string                { return user.administrator.Username }
func (user passkeyUser) WebAuthnCredentials() []webauthn.Credential { return user.credentials }

// relyingParty builds the WebAuthn configuration for the hostname of this request.
//
// Passkeys are bound to the hostname the browser shows, and the app has no fixed
// public URL, so the relying party is derived per request (through a trusted proxy's
// forwarded headers when present).
func relyingParty(request *http.Request) (*webauthn.WebAuthn, error) {
	return webauthn.New(&webauthn.Config{
		RPID:          requestHostname(request),
		RPDisplayName: passkeyRelyingPartyName,
		RPOrigins:     []string{requestOrigin(request)},
	})
}

// loadPasskeyUser returns the administrator with the passkeys made on this hostname.
func (server *Server) loadPasskeyUser(
	request *http.Request,
	administrator storage.Administrator,
) (passkeyUser, []storage.Passkey, error) {
	userID, err := server.store.EnsureWebAuthnUserID(request.Context(), administrator.ID)
	if err != nil {
		return passkeyUser{}, nil, err
	}

	passkeys, err := server.store.ListPasskeys(request.Context(), administrator.ID, requestHostname(request))
	if err != nil {
		return passkeyUser{}, nil, err
	}

	credentials := make([]webauthn.Credential, 0, len(passkeys))
	for _, passkey := range passkeys {
		var credential webauthn.Credential
		if err := json.Unmarshal([]byte(passkey.CredentialJSON), &credential); err != nil {
			return passkeyUser{}, nil, err
		}

		credentials = append(credentials, credential)
	}

	return passkeyUser{
		administrator: administrator,
		userID:        userID,
		credentials:   credentials,
	}, passkeys, nil
}

// requirePasskeyHost rejects ceremonies where browsers would refuse passkeys anyway,
// such as a bare IP address or plain http on anything but localhost.
func requirePasskeyHost(responseWriter http.ResponseWriter, request *http.Request) bool {
	if passkeysAvailable(request) {
		return true
	}

	writeError(
		responseWriter,
		http.StatusConflict,
		"passkeys_unavailable",
		"Passkeys need https and a domain name. Open this page at its domain, or use your password.",
	)

	return false
}

// handlePasskeyRegistrationOptions starts adding a passkey for the signed-in
// administrator on the current hostname, after checking its name and re-checking
// the password, so both fail before the browser asks for the device.
func (server *Server) handlePasskeyRegistrationOptions(responseWriter http.ResponseWriter, request *http.Request) {
	var input struct {
		Name     string `json:"name"`
		Password string `json:"password"`
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}

	input.Name = strings.TrimSpace(input.Name)

	issues := []validationIssue{}
	if message := validatePasskeyName(input.Name); message != "" {
		issues = append(issues, newFieldIssue("name", message))
	}
	if input.Password == "" {
		issues = append(issues, newFieldIssue("password", "Enter your password."))
	}
	if len(issues) > 0 {
		writeIssues(responseWriter, issues)

		return
	}

	if !requirePasskeyHost(responseWriter, request) {
		return
	}

	requestPrincipal := principalFromContext(request.Context())
	if !server.verifyCurrentPassword(responseWriter, request, requestPrincipal.AdministratorID, input.Password, "password") {
		return
	}

	administrator, err := server.store.FindAdministratorByID(request.Context(), requestPrincipal.AdministratorID)
	if err != nil {
		server.logInternalError("find administrator for passkey", err)
		writeInternalError(responseWriter)

		return
	}

	user, _, err := server.loadPasskeyUser(request, administrator)
	if err != nil {
		server.logInternalError("load passkey user", err)
		writeInternalError(responseWriter)

		return
	}

	relyingPartyConfig, err := relyingParty(request)
	if err != nil {
		server.logInternalError("configure passkey relying party", err)
		writeInternalError(responseWriter)

		return
	}

	exclusions := make([]protocol.CredentialDescriptor, 0, len(user.credentials))
	for _, credential := range user.credentials {
		exclusions = append(exclusions, credential.Descriptor())
	}

	creation, session, err := relyingPartyConfig.BeginRegistration(
		user,
		webauthn.WithResidentKeyRequirement(protocol.ResidentKeyRequirementRequired),
		webauthn.WithExclusions(exclusions),
	)
	if err != nil {
		server.logInternalError("begin passkey registration", err)
		writeInternalError(responseWriter)

		return
	}

	ceremonyID, ok := server.storeCeremony(responseWriter, request, "registration", &administrator.ID, session)
	if !ok {
		return
	}

	writeJSON(responseWriter, http.StatusOK, map[string]any{
		"ceremonyId": ceremonyID,
		"options":    creation.Response,
	})
}

// handlePasskeyRegistrationVerify checks the browser's new credential and saves it.
func (server *Server) handlePasskeyRegistrationVerify(responseWriter http.ResponseWriter, request *http.Request) {
	var input struct {
		CeremonyID string          `json:"ceremonyId"`
		Name       string          `json:"name"`
		Credential json.RawMessage `json:"credential"`
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}

	input.Name = strings.TrimSpace(input.Name)
	if message := validatePasskeyName(input.Name); message != "" {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "name", message)

		return
	}

	requestPrincipal := principalFromContext(request.Context())
	ceremonyAdministrator, session, ok := server.takeCeremony(responseWriter, request, input.CeremonyID, "registration")
	if !ok {
		return
	}

	if ceremonyAdministrator == nil || *ceremonyAdministrator != requestPrincipal.AdministratorID {
		writeError(responseWriter, http.StatusConflict, "passkey_ceremony_invalid", "That passkey request expired. Try again.")

		return
	}

	administrator, err := server.store.FindAdministratorByID(request.Context(), requestPrincipal.AdministratorID)
	if err != nil {
		server.logInternalError("find administrator for passkey", err)
		writeInternalError(responseWriter)

		return
	}

	user, _, err := server.loadPasskeyUser(request, administrator)
	if err != nil {
		server.logInternalError("load passkey user", err)
		writeInternalError(responseWriter)

		return
	}

	parsedCredential, err := protocol.ParseCredentialCreationResponseBytes(input.Credential)
	if err != nil {
		writeError(responseWriter, http.StatusUnprocessableEntity, "passkey_invalid", "The passkey couldn't be verified. Try again.")

		return
	}

	relyingPartyConfig, err := relyingParty(request)
	if err != nil {
		server.logInternalError("configure passkey relying party", err)
		writeInternalError(responseWriter)

		return
	}

	credential, err := relyingPartyConfig.CreateCredential(user, session, parsedCredential)
	if err != nil {
		writeError(responseWriter, http.StatusUnprocessableEntity, "passkey_invalid", "The passkey couldn't be verified. Try again.")

		return
	}

	credentialJSON, err := json.Marshal(credential)
	if err != nil {
		server.logInternalError("encode passkey", err)
		writeInternalError(responseWriter)

		return
	}

	passkey := storage.Passkey{
		ID:              base64.RawURLEncoding.EncodeToString(credential.ID),
		AdministratorID: administrator.ID,
		Name:            input.Name,
		RPID:            requestHostname(request),
		CredentialJSON:  string(credentialJSON),
		CreatedAt:       time.Now().UTC(),
	}
	if err := server.store.CreatePasskey(request.Context(), passkey); err != nil {
		server.logInternalError("store passkey", err)
		writeInternalError(responseWriter)

		return
	}

	writeJSON(responseWriter, http.StatusCreated, newPasskeyView(passkey))
}

// handlePasskeyLoginOptions starts a username-less passkey sign-in.
func (server *Server) handlePasskeyLoginOptions(responseWriter http.ResponseWriter, request *http.Request) {
	if !requirePasskeyHost(responseWriter, request) {
		return
	}

	attemptKey := signInAttemptKey(request)
	if !server.attempts.Allowed(attemptKey) {
		server.writeRateLimited(responseWriter, attemptKey, "Too many sign-in attempts. Try again in 15 minutes.")

		return
	}

	relyingPartyConfig, err := relyingParty(request)
	if err != nil {
		server.logInternalError("configure passkey relying party", err)
		writeInternalError(responseWriter)

		return
	}

	assertion, session, err := relyingPartyConfig.BeginDiscoverableLogin(
		webauthn.WithUserVerification(protocol.VerificationRequired),
	)
	if err != nil {
		server.logInternalError("begin passkey sign-in", err)
		writeInternalError(responseWriter)

		return
	}

	ceremonyID, ok := server.storeCeremony(responseWriter, request, "authentication", nil, session)
	if !ok {
		return
	}

	writeJSON(responseWriter, http.StatusOK, map[string]any{
		"ceremonyId": ceremonyID,
		"options":    assertion.Response,
	})
}

// handlePasskeyLoginVerify checks the passkey assertion and signs the administrator
// in. A passkey already proves possession and user verification, so no
// authenticator code is asked for afterward.
func (server *Server) handlePasskeyLoginVerify(responseWriter http.ResponseWriter, request *http.Request) {
	attemptKey := signInAttemptKey(request)
	if !server.attempts.Allowed(attemptKey) {
		server.writeRateLimited(responseWriter, attemptKey, "Too many sign-in attempts. Try again in 15 minutes.")

		return
	}

	var input struct {
		CeremonyID string          `json:"ceremonyId"`
		Credential json.RawMessage `json:"credential"`
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}

	_, session, ok := server.takeCeremony(responseWriter, request, input.CeremonyID, "authentication")
	if !ok {
		return
	}

	parsedAssertion, err := protocol.ParseCredentialRequestResponseBytes(input.Credential)
	if err != nil {
		server.attempts.Failed(attemptKey)
		writeError(responseWriter, http.StatusUnauthorized, "passkey_rejected", "That passkey wasn't accepted.")

		return
	}

	relyingPartyConfig, err := relyingParty(request)
	if err != nil {
		server.logInternalError("configure passkey relying party", err)
		writeInternalError(responseWriter)

		return
	}

	var signedInPasskeys []storage.Passkey
	findUser := func(_ []byte, userHandle []byte) (webauthn.User, error) {
		administrator, findError := server.store.FindAdministratorByWebAuthnUserID(request.Context(), userHandle)
		if findError != nil {
			return nil, findError
		}

		user, passkeys, loadError := server.loadPasskeyUser(request, administrator)
		signedInPasskeys = passkeys

		return user, loadError
	}

	user, credential, err := relyingPartyConfig.ValidatePasskeyLogin(findUser, session, parsedAssertion)
	if err != nil {
		server.attempts.Failed(attemptKey)
		writeError(responseWriter, http.StatusUnauthorized, "passkey_rejected", "That passkey wasn't accepted. It may belong to a different address for this app.")

		return
	}

	if credentialJSON, encodeError := json.Marshal(credential); encodeError == nil {
		credentialID := base64.RawURLEncoding.EncodeToString(credential.ID)
		for _, passkey := range signedInPasskeys {
			if passkey.ID == credentialID {
				if updateError := server.store.UpdatePasskeyUse(request.Context(), passkey.ID, string(credentialJSON)); updateError != nil {
					server.logInternalError("record passkey use", updateError)
				}
			}
		}
	}

	administrator := user.(passkeyUser).administrator
	server.attempts.Succeeded(attemptKey)
	server.issueSession(responseWriter, request, administrator, http.StatusOK)
}

// handleDeletePasskey removes one of the signed-in administrator's passkeys after
// re-checking the password.
func (server *Server) handleDeletePasskey(responseWriter http.ResponseWriter, request *http.Request) {
	passkeyID := request.PathValue("passkeyID")
	if passkeyID == "" || len(passkeyID) > 512 {
		writeError(responseWriter, http.StatusNotFound, "passkey_not_found", "That passkey no longer exists.")

		return
	}

	var input struct {
		Password string `json:"password"`
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}

	requestPrincipal := principalFromContext(request.Context())
	if !server.verifyCurrentPassword(responseWriter, request, requestPrincipal.AdministratorID, input.Password, "password") {
		return
	}

	err := server.store.DeletePasskey(request.Context(), requestPrincipal.AdministratorID, passkeyID)
	if errors.Is(err, storage.ErrNotFound) {
		writeError(responseWriter, http.StatusNotFound, "passkey_not_found", "That passkey no longer exists.")

		return
	}

	if err != nil {
		server.logInternalError("delete passkey", err)
		writeInternalError(responseWriter)

		return
	}

	responseWriter.WriteHeader(http.StatusNoContent)
}

// validatePasskeyName applies the passkey name rule shared with pfsense-actions.
func validatePasskeyName(name string) string {
	if name == "" {
		return "Name this passkey."
	}

	if utf8.RuneCountInString(name) > 80 {
		return "Use 80 characters or fewer."
	}

	return ""
}

// storeCeremony saves the server half of a passkey ceremony and returns its ID.
func (server *Server) storeCeremony(
	responseWriter http.ResponseWriter,
	request *http.Request,
	kind string,
	administratorID *int64,
	session *webauthn.SessionData,
) (string, bool) {
	ceremonyID, err := security.NewIdentifier()
	if err != nil {
		server.logInternalError("generate passkey ceremony identifier", err)
		writeInternalError(responseWriter)

		return "", false
	}

	sessionJSON, err := json.Marshal(session)
	if err != nil {
		server.logInternalError("encode passkey ceremony", err)
		writeInternalError(responseWriter)

		return "", false
	}

	if err := server.store.CreateWebAuthnCeremony(
		request.Context(),
		ceremonyID,
		kind,
		administratorID,
		string(sessionJSON),
		time.Now().Add(passkeyCeremonyLifetime),
	); err != nil {
		server.logInternalError("store passkey ceremony", err)
		writeInternalError(responseWriter)

		return "", false
	}

	return ceremonyID, true
}

// takeCeremony loads and consumes a passkey ceremony.
func (server *Server) takeCeremony(
	responseWriter http.ResponseWriter,
	request *http.Request,
	ceremonyID string,
	kind string,
) (*int64, webauthn.SessionData, bool) {
	if ceremonyID == "" || len(ceremonyID) > 64 {
		writeError(responseWriter, http.StatusConflict, "passkey_ceremony_invalid", "That passkey request expired. Try again.")

		return nil, webauthn.SessionData{}, false
	}

	administratorID, sessionJSON, err := server.store.TakeWebAuthnCeremony(request.Context(), ceremonyID, kind)
	if err != nil {
		if !errors.Is(err, storage.ErrNotFound) {
			server.logInternalError("take passkey ceremony", err)
		}

		writeError(responseWriter, http.StatusConflict, "passkey_ceremony_invalid", "That passkey request expired. Try again.")

		return nil, webauthn.SessionData{}, false
	}

	var session webauthn.SessionData
	if err := json.Unmarshal([]byte(sessionJSON), &session); err != nil {
		server.logInternalError("decode passkey ceremony", err)
		writeInternalError(responseWriter)

		return nil, webauthn.SessionData{}, false
	}

	return administratorID, session, true
}
