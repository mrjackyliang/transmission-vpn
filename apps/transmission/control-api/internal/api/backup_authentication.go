package api

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
)

const backupReauthenticationLifetime = 5 * time.Minute

type backupReauthenticationGrant struct {
	SessionID string
	Purpose   string
	ExpiresAt time.Time
}

type backupPasskeyCeremony struct {
	SessionID string
	Purpose   string
	ExpiresAt time.Time
}

func validBackupPurpose(purpose string) bool {
	return purpose == "export" || purpose == "import"
}

// handleBackupConfirmation re-checks the password and, when configured, TOTP.
//
// It returns a five-minute session-bound token. Only the matching backup operation can
// consume the token, and the plaintext value is never persisted or logged.
func (server *Server) handleBackupConfirmation(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	var input struct {
		Purpose  string `json:"purpose"`
		Password string `json:"password"`
		Code     string `json:"code"`
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}
	if !validBackupPurpose(input.Purpose) {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "purpose", "Choose a valid confirmation purpose.")

		return
	}

	requestPrincipal := principalFromContext(request.Context())
	if !server.verifyCurrentPassword(
		responseWriter,
		request,
		requestPrincipal.AdministratorID,
		input.Password,
		"password",
	) {
		return
	}

	accountSecurity, err := server.store.AccountSecurity(
		request.Context(),
		requestPrincipal.AdministratorID,
	)
	if err != nil {
		server.logInternalError("read account security for backup confirmation", err)
		writeInternalError(responseWriter)

		return
	}
	if accountSecurity.TOTPEnabled {
		if strings.TrimSpace(input.Code) == "" {
			writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "code", "Enter the code from your authenticator app.")

			return
		}
		verified, verifyError := server.verifySecondFactor(
			request,
			requestPrincipal.AdministratorID,
			input.Code,
		)
		if verifyError != nil {
			server.logInternalError("verify backup confirmation code", verifyError)
			writeInternalError(responseWriter)

			return
		}
		if !verified {
			server.attempts.Failed(signInAttemptKey(request))
			writeFieldError(responseWriter, http.StatusUnprocessableEntity, "code_invalid", "code", "That code doesn't match. Try the current code.")

			return
		}
	}

	server.attempts.Succeeded(signInAttemptKey(request))
	server.issueBackupGrant(responseWriter, requestPrincipal.Identifier, input.Purpose)
}

// handleBackupPasskeyOptions starts a user-verifying ceremony for the current account.
func (server *Server) handleBackupPasskeyOptions(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	var input struct {
		Purpose string `json:"purpose"`
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}
	if !validBackupPurpose(input.Purpose) {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "purpose", "Choose a valid confirmation purpose.")

		return
	}
	if !requirePasskeyHost(responseWriter, request) {
		return
	}
	attemptKey := signInAttemptKey(request)
	if !server.attempts.Allowed(attemptKey) {
		server.writeRateLimited(responseWriter, attemptKey, "Too many attempts. Try again in 15 minutes.")

		return
	}

	requestPrincipal := principalFromContext(request.Context())
	administrator, err := server.store.FindAdministratorByID(
		request.Context(),
		requestPrincipal.AdministratorID,
	)
	if err != nil {
		server.logInternalError("find administrator for backup passkey", err)
		writeInternalError(responseWriter)

		return
	}
	user, _, err := server.loadPasskeyUser(request, administrator)
	if err != nil {
		server.logInternalError("load backup passkey user", err)
		writeInternalError(responseWriter)

		return
	}
	if len(user.credentials) == 0 {
		writeError(responseWriter, http.StatusConflict, "passkey_unavailable", "No passkey for this address is available.")

		return
	}
	relyingPartyConfig, err := relyingParty(request)
	if err != nil {
		server.logInternalError("configure backup passkey relying party", err)
		writeInternalError(responseWriter)

		return
	}
	assertion, session, err := relyingPartyConfig.BeginLogin(
		user,
		webauthn.WithUserVerification(protocol.VerificationRequired),
	)
	if err != nil {
		server.logInternalError("begin backup passkey confirmation", err)
		writeInternalError(responseWriter)

		return
	}
	ceremonyID, ok := server.storeCeremony(
		responseWriter,
		request,
		"authentication",
		&administrator.ID,
		session,
	)
	if !ok {
		return
	}

	server.backupPasskeyMutex.Lock()
	server.backupPasskeyCeremonies[ceremonyID] = backupPasskeyCeremony{
		SessionID: requestPrincipal.Identifier,
		Purpose:   input.Purpose,
		ExpiresAt: server.backupClock().Add(passkeyCeremonyLifetime),
	}
	server.backupPasskeyMutex.Unlock()
	writeJSON(responseWriter, http.StatusOK, map[string]any{
		"ceremonyId": ceremonyID,
		"options":    assertion.Response,
	})
}

// handleBackupPasskeyVerify completes a passkey ceremony and returns a backup grant.
func (server *Server) handleBackupPasskeyVerify(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	attemptKey := signInAttemptKey(request)
	if !server.attempts.Allowed(attemptKey) {
		server.writeRateLimited(responseWriter, attemptKey, "Too many attempts. Try again in 15 minutes.")

		return
	}
	var input struct {
		Purpose    string          `json:"purpose"`
		CeremonyID string          `json:"ceremonyId"`
		Credential json.RawMessage `json:"credential"`
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}
	if !validBackupPurpose(input.Purpose) {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "purpose", "Choose a valid confirmation purpose.")

		return
	}

	requestPrincipal := principalFromContext(request.Context())
	server.backupPasskeyMutex.Lock()
	binding, found := server.backupPasskeyCeremonies[input.CeremonyID]
	if found {
		delete(server.backupPasskeyCeremonies, input.CeremonyID)
	}
	server.backupPasskeyMutex.Unlock()
	if !found || binding.SessionID != requestPrincipal.Identifier ||
		binding.Purpose != input.Purpose || !server.backupClock().Before(binding.ExpiresAt) {
		writeError(responseWriter, http.StatusConflict, "passkey_ceremony_invalid", "That passkey request expired. Try again.")

		return
	}

	ceremonyAdministrator, session, ok := server.takeCeremony(
		responseWriter,
		request,
		input.CeremonyID,
		"authentication",
	)
	if !ok {
		return
	}
	if ceremonyAdministrator == nil || *ceremonyAdministrator != requestPrincipal.AdministratorID {
		writeError(responseWriter, http.StatusConflict, "passkey_ceremony_invalid", "That passkey request expired. Try again.")

		return
	}
	parsedAssertion, err := protocol.ParseCredentialRequestResponseBytes(input.Credential)
	if err != nil {
		server.attempts.Failed(attemptKey)
		writeError(responseWriter, http.StatusUnauthorized, "passkey_rejected", "That passkey wasn't accepted.")

		return
	}
	administrator, err := server.store.FindAdministratorByID(
		request.Context(),
		requestPrincipal.AdministratorID,
	)
	if err != nil {
		server.logInternalError("find administrator for backup passkey verification", err)
		writeInternalError(responseWriter)

		return
	}
	user, passkeys, err := server.loadPasskeyUser(request, administrator)
	if err != nil {
		server.logInternalError("load backup passkey user for verification", err)
		writeInternalError(responseWriter)

		return
	}
	relyingPartyConfig, err := relyingParty(request)
	if err != nil {
		server.logInternalError("configure backup passkey relying party", err)
		writeInternalError(responseWriter)

		return
	}
	credential, err := relyingPartyConfig.ValidateLogin(user, session, parsedAssertion)
	if err != nil {
		server.attempts.Failed(attemptKey)
		writeError(responseWriter, http.StatusUnauthorized, "passkey_rejected", "That passkey wasn't accepted. It may belong to a different address for this app.")

		return
	}
	if credentialJSON, encodeError := json.Marshal(credential); encodeError == nil {
		credentialID := base64.RawURLEncoding.EncodeToString(credential.ID)
		for _, passkey := range passkeys {
			if passkey.ID == credentialID {
				if updateError := server.store.UpdatePasskeyUse(
					request.Context(),
					passkey.ID,
					string(credentialJSON),
				); updateError != nil {
					server.logInternalError("record backup passkey use", updateError)
				}
			}
		}
	}

	server.attempts.Succeeded(attemptKey)
	server.issueBackupGrant(responseWriter, requestPrincipal.Identifier, input.Purpose)
}

func (server *Server) issueBackupGrant(
	responseWriter http.ResponseWriter,
	sessionID string,
	purpose string,
) {
	token, digest, err := security.NewOpaqueToken("tvbg_", 32)
	if err != nil {
		server.logInternalError("generate backup confirmation grant", err)
		writeInternalError(responseWriter)

		return
	}
	expiresAt := server.backupClock().Add(backupReauthenticationLifetime)
	digestKey := base64.RawURLEncoding.EncodeToString(digest)
	server.backupGrantMutex.Lock()
	for key, grant := range server.backupGrants {
		if !server.backupClock().Before(grant.ExpiresAt) {
			delete(server.backupGrants, key)
		}
	}
	server.backupGrants[digestKey] = backupReauthenticationGrant{
		SessionID: sessionID,
		Purpose:   purpose,
		ExpiresAt: expiresAt,
	}
	server.backupGrantMutex.Unlock()
	writeJSON(responseWriter, http.StatusOK, map[string]any{
		"grant":     token,
		"expiresAt": expiresAt,
	})
}

func (server *Server) consumeBackupGrant(
	responseWriter http.ResponseWriter,
	request *http.Request,
	token string,
	purpose string,
) bool {
	if token == "" || len(token) > 256 {
		writeError(responseWriter, http.StatusUnauthorized, "confirmation_required", "Confirm it's you again to continue.")

		return false
	}
	digestKey := base64.RawURLEncoding.EncodeToString(security.Digest(token))
	requestPrincipal := principalFromContext(request.Context())
	server.backupGrantMutex.Lock()
	grant, found := server.backupGrants[digestKey]
	if found && grant.SessionID == requestPrincipal.Identifier && grant.Purpose == purpose {
		delete(server.backupGrants, digestKey)
	}
	server.backupGrantMutex.Unlock()
	if !found || grant.SessionID != requestPrincipal.Identifier || grant.Purpose != purpose ||
		!server.backupClock().Before(grant.ExpiresAt) {
		if found && !server.backupClock().Before(grant.ExpiresAt) {
			server.backupGrantMutex.Lock()
			delete(server.backupGrants, digestKey)
			server.backupGrantMutex.Unlock()
		}
		writeError(responseWriter, http.StatusUnauthorized, "confirmation_required", "Confirm it's you again to continue.")

		return false
	}

	return true
}
