package api

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

const (
	totpIssuer             = "Transmission VPN"
	totpEnrollmentLifetime = 10 * time.Minute
	signInChallengeLife    = 5 * time.Minute
	signInChallengeTries   = 5
	recoveryCodeCount      = 10
)

// totpSecretKey binds the encrypted authenticator secret to its purpose so the
// ciphertext cannot be swapped with another encrypted value.
func totpSecretKey(administratorID int64, pending bool) string {
	if pending {
		return "totp-enrollment:" + formatInt(administratorID)
	}

	return "totp:" + formatInt(administratorID)
}

// handleAccountSecurity reports the administrator's sign-in methods for the
// security page: authenticator state, recovery codes left and passkeys.
func (server *Server) handleAccountSecurity(responseWriter http.ResponseWriter, request *http.Request) {
	requestPrincipal := principalFromContext(request.Context())

	accountSecurity, err := server.store.AccountSecurity(request.Context(), requestPrincipal.AdministratorID)
	if err != nil {
		server.logInternalError("read account security", err)
		writeInternalError(responseWriter)

		return
	}

	passkeys, err := server.store.ListPasskeys(request.Context(), requestPrincipal.AdministratorID, "")
	if err != nil {
		server.logInternalError("list passkeys", err)
		writeInternalError(responseWriter)

		return
	}

	passkeyViews := make([]passkeyView, 0, len(passkeys))
	for _, passkey := range passkeys {
		passkeyViews = append(passkeyViews, newPasskeyView(passkey))
	}

	writeJSON(responseWriter, http.StatusOK, map[string]any{
		"username":               requestPrincipal.Username,
		"totpEnabled":            accountSecurity.TOTPEnabled,
		"recoveryCodesRemaining": accountSecurity.RecoveryCodesRemaining,
		"passkeys":               passkeyViews,
		"passkeysAvailable":      passkeysAvailable(request),
		"hostname":               requestHostname(request),
	})
}

// handleChangePassword replaces the password after checking the current one and
// signs out every other browser session.
func (server *Server) handleChangePassword(responseWriter http.ResponseWriter, request *http.Request) {
	var input struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}

	issues := []validationIssue{}
	if input.CurrentPassword == "" {
		issues = append(issues, newFieldIssue("currentPassword", "Enter your current password."))
	}
	if message := validateAdministratorPassword(input.NewPassword); message != "" {
		issues = append(issues, newFieldIssue("newPassword", message))
	}
	if len(issues) > 0 {
		writeIssues(responseWriter, issues)

		return
	}

	requestPrincipal := principalFromContext(request.Context())
	if !server.verifyCurrentPassword(responseWriter, request, requestPrincipal.AdministratorID, input.CurrentPassword, "currentPassword") {
		return
	}

	passwordHash, err := security.HashPassword(input.NewPassword)
	if err != nil {
		server.logInternalError("hash new password", err)
		writeInternalError(responseWriter)

		return
	}

	if err := server.store.UpdateAdministratorPassword(
		request.Context(),
		requestPrincipal.AdministratorID,
		passwordHash,
		requestPrincipal.Identifier,
	); err != nil {
		server.logInternalError("change password", err)
		writeInternalError(responseWriter)

		return
	}

	responseWriter.WriteHeader(http.StatusNoContent)
}

// handleChangeUsername renames the administrator after re-checking the password.
// Signed-in sessions stay signed in and show the new name on their next request.
func (server *Server) handleChangeUsername(responseWriter http.ResponseWriter, request *http.Request) {
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
	if input.Password == "" {
		issues = append(issues, newFieldIssue("password", "Enter your password."))
	}
	if message := validateAdministratorUsername(input.Username); message != "" {
		issues = append(issues, newFieldIssue("username", message))
	}
	if len(issues) > 0 {
		writeIssues(responseWriter, issues)

		return
	}

	requestPrincipal := principalFromContext(request.Context())
	if !server.verifyCurrentPassword(responseWriter, request, requestPrincipal.AdministratorID, input.Password, "password") {
		return
	}

	administrator, err := server.store.UpdateAdministratorUsername(request.Context(), requestPrincipal.AdministratorID, input.Username)
	if errors.Is(err, storage.ErrUsernameTaken) {
		writeFieldError(responseWriter, http.StatusConflict, "username_taken", "username", "That username is already in use.")

		return
	}

	if errors.Is(err, storage.ErrNotFound) {
		writeError(responseWriter, http.StatusUnauthorized, "authentication_required", "Sign in to continue.")

		return
	}

	if err != nil {
		server.logInternalError("change username", err)
		writeInternalError(responseWriter)

		return
	}

	writeJSON(responseWriter, http.StatusOK, map[string]any{
		"administrator": map[string]any{
			"id":       administrator.ID,
			"username": administrator.Username,
		},
	})
}

// handleTOTPSetup starts authenticator enrollment after re-checking the password and
// returns the secret, its otpauth:// URI and a QR code. Nothing changes until the
// first code is confirmed.
func (server *Server) handleTOTPSetup(responseWriter http.ResponseWriter, request *http.Request) {
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

	accountSecurity, err := server.store.AccountSecurity(request.Context(), requestPrincipal.AdministratorID)
	if err != nil {
		server.logInternalError("read account security", err)
		writeInternalError(responseWriter)

		return
	}

	if accountSecurity.TOTPEnabled {
		writeError(responseWriter, http.StatusConflict, "totp_enabled", "The authenticator app is already on.")

		return
	}

	secret, err := security.NewTOTPSecret()
	if err != nil {
		server.logInternalError("generate authenticator secret", err)
		writeInternalError(responseWriter)

		return
	}

	nonce, ciphertext, err := security.EncryptSecret(
		server.installationKey,
		totpSecretKey(requestPrincipal.AdministratorID, true),
		[]byte(secret),
	)
	if err != nil {
		server.logInternalError("encrypt authenticator enrollment", err)
		writeInternalError(responseWriter)

		return
	}

	if err := server.store.SaveTOTPEnrollment(
		request.Context(),
		requestPrincipal.AdministratorID,
		nonce,
		ciphertext,
		time.Now().Add(totpEnrollmentLifetime),
	); err != nil {
		server.logInternalError("store authenticator enrollment", err)
		writeInternalError(responseWriter)

		return
	}

	uri := security.TOTPURI(totpIssuer, requestPrincipal.Username, secret)
	qrCode, err := security.QRCodeDataURI(uri)
	if err != nil {
		server.logInternalError("render authenticator QR code", err)
		writeInternalError(responseWriter)

		return
	}

	writeJSON(responseWriter, http.StatusOK, map[string]any{
		"secret": secret,
		"uri":    uri,
		"qrCode": qrCode,
	})
}

// handleTOTPEnable confirms enrollment with a first code, turns the authenticator on
// and returns 10 recovery codes, shown once.
func (server *Server) handleTOTPEnable(responseWriter http.ResponseWriter, request *http.Request) {
	var input struct {
		Code string `json:"code"`
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}

	input.Code = strings.TrimSpace(input.Code)
	if len(input.Code) != 6 || strings.Trim(input.Code, "0123456789") != "" {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "code", "Enter the 6-digit code from your app.")

		return
	}

	requestPrincipal := principalFromContext(request.Context())
	nonce, ciphertext, err := server.store.TOTPEnrollment(request.Context(), requestPrincipal.AdministratorID)
	if errors.Is(err, storage.ErrNotFound) {
		writeError(responseWriter, http.StatusConflict, "totp_setup_expired", "Authenticator setup expired. Start again.")

		return
	}

	if err != nil {
		server.logInternalError("read authenticator enrollment", err)
		writeInternalError(responseWriter)

		return
	}

	secret, err := security.DecryptSecret(
		server.installationKey,
		totpSecretKey(requestPrincipal.AdministratorID, true),
		nonce,
		ciphertext,
	)
	if err != nil {
		server.logInternalError("decrypt authenticator enrollment", err)
		writeInternalError(responseWriter)

		return
	}

	step, valid := security.VerifyTOTP(string(secret), input.Code, time.Now(), 0)
	if !valid {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "code_invalid", "code", "That code doesn't match. Check the time on your device and try again.")

		return
	}

	activeNonce, activeCiphertext, err := security.EncryptSecret(
		server.installationKey,
		totpSecretKey(requestPrincipal.AdministratorID, false),
		secret,
	)
	if err != nil {
		server.logInternalError("encrypt authenticator secret", err)
		writeInternalError(responseWriter)

		return
	}

	recoveryCodes, digests, err := newRecoveryCodeSet()
	if err != nil {
		server.logInternalError("generate recovery codes", err)
		writeInternalError(responseWriter)

		return
	}

	if err := server.store.EnableTOTP(
		request.Context(),
		requestPrincipal.AdministratorID,
		activeNonce,
		activeCiphertext,
		step,
		digests,
	); err != nil {
		server.logInternalError("enable authenticator", err)
		writeInternalError(responseWriter)

		return
	}

	writeJSON(responseWriter, http.StatusOK, map[string]any{"recoveryCodes": recoveryCodes})
}

// handleTOTPDisable turns the authenticator off after re-checking the password.
func (server *Server) handleTOTPDisable(responseWriter http.ResponseWriter, request *http.Request) {
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

	accountSecurity, err := server.store.AccountSecurity(request.Context(), requestPrincipal.AdministratorID)
	if err != nil {
		server.logInternalError("read account security", err)
		writeInternalError(responseWriter)

		return
	}

	if !accountSecurity.TOTPEnabled {
		writeError(responseWriter, http.StatusConflict, "totp_disabled", "The authenticator app is already off.")

		return
	}

	if err := server.store.DisableTOTP(request.Context(), requestPrincipal.AdministratorID); err != nil {
		server.logInternalError("disable authenticator", err)
		writeInternalError(responseWriter)

		return
	}

	responseWriter.WriteHeader(http.StatusNoContent)
}

// handleRegenerateRecoveryCodes replaces every recovery code after re-checking the
// password; the old codes stop working immediately.
func (server *Server) handleRegenerateRecoveryCodes(responseWriter http.ResponseWriter, request *http.Request) {
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

	accountSecurity, err := server.store.AccountSecurity(request.Context(), requestPrincipal.AdministratorID)
	if err != nil {
		server.logInternalError("read account security", err)
		writeInternalError(responseWriter)

		return
	}

	if !accountSecurity.TOTPEnabled {
		writeError(responseWriter, http.StatusConflict, "totp_disabled", "Turn on the authenticator app first.")

		return
	}

	recoveryCodes, digests, err := newRecoveryCodeSet()
	if err == nil {
		err = server.store.ReplaceRecoveryCodes(request.Context(), requestPrincipal.AdministratorID, digests)
	}

	if err != nil {
		server.logInternalError("replace recovery codes", err)
		writeInternalError(responseWriter)

		return
	}

	writeJSON(responseWriter, http.StatusOK, map[string]any{"recoveryCodes": recoveryCodes})
}

// handleSecondFactor finishes a password sign-in with an authenticator code or a
// recovery code. Failures count toward the shared sign-in limit, and each challenge
// allows only a few tries before the password must be entered again.
func (server *Server) handleSecondFactor(responseWriter http.ResponseWriter, request *http.Request) {
	attemptKey := signInAttemptKey(request)
	if !server.attempts.Allowed(attemptKey) {
		server.writeRateLimited(responseWriter, attemptKey, "Too many sign-in attempts. Try again in 15 minutes.")

		return
	}

	var input struct {
		Challenge string `json:"challenge"`
		Code      string `json:"code"`
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}

	if strings.TrimSpace(input.Code) == "" {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "code", "Enter the code from your authenticator app, or a recovery code.")

		return
	}

	challenge, err := server.store.FindSignInChallenge(request.Context(), security.Digest(input.Challenge))
	if err != nil {
		if !errors.Is(err, storage.ErrNotFound) {
			server.logInternalError("find sign-in challenge", err)
		}

		writeError(responseWriter, http.StatusUnauthorized, "challenge_expired", "Your sign-in timed out. Enter your password again.")

		return
	}

	verified, err := server.verifySecondFactor(request, challenge.AdministratorID, input.Code)
	if err != nil {
		server.logInternalError("verify second factor", err)
		writeInternalError(responseWriter)

		return
	}

	if !verified {
		server.attempts.Failed(attemptKey)

		failures, failureError := server.store.RecordSignInChallengeFailure(request.Context(), challenge.ID)
		if failureError == nil && failures >= signInChallengeTries {
			_ = server.store.DeleteSignInChallenge(request.Context(), challenge.ID)
			writeError(responseWriter, http.StatusUnauthorized, "challenge_expired", "Too many wrong codes. Enter your password again.")

			return
		}

		writeFieldError(responseWriter, http.StatusUnauthorized, "code_invalid", "code", "That code doesn't match. Try the current code, or a recovery code.")

		return
	}

	_ = server.store.DeleteSignInChallenge(request.Context(), challenge.ID)

	administrator, err := server.store.FindAdministratorByID(request.Context(), challenge.AdministratorID)
	if err != nil {
		server.logInternalError("find administrator for second factor", err)
		writeInternalError(responseWriter)

		return
	}

	server.attempts.Succeeded(attemptKey)
	server.issueSession(responseWriter, request, administrator, http.StatusOK)
}

// startSecondFactor answers a correct password when an authenticator is on: it
// returns a short-lived challenge instead of a session.
func (server *Server) startSecondFactor(
	responseWriter http.ResponseWriter,
	request *http.Request,
	administrator storage.Administrator,
) {
	challengeID, err := security.NewIdentifier()
	if err != nil {
		server.logInternalError("generate sign-in challenge identifier", err)
		writeInternalError(responseWriter)

		return
	}

	challengeToken, challengeDigest, err := security.NewOpaqueToken("tvsc_", 24)
	if err != nil {
		server.logInternalError("generate sign-in challenge", err)
		writeInternalError(responseWriter)

		return
	}

	expiresAt := time.Now().Add(signInChallengeLife)
	if err := server.store.CreateSignInChallenge(
		request.Context(),
		challengeID,
		administrator.ID,
		challengeDigest,
		expiresAt,
	); err != nil {
		server.logInternalError("store sign-in challenge", err)
		writeInternalError(responseWriter)

		return
	}

	writeJSON(responseWriter, http.StatusOK, map[string]any{
		"status":    "second_factor_required",
		"challenge": challengeToken,
		"expiresAt": expiresAt,
	})
}

// verifySecondFactor accepts a 6-digit authenticator code or a recovery code.
func (server *Server) verifySecondFactor(request *http.Request, administratorID int64, code string) (bool, error) {
	accountSecurity, err := server.store.AccountSecurity(request.Context(), administratorID)
	if err != nil {
		return false, err
	}

	if !accountSecurity.TOTPEnabled {
		return false, nil
	}

	trimmedCode := strings.TrimSpace(code)
	if len(trimmedCode) == 6 && strings.Trim(trimmedCode, "0123456789") == "" {
		secret, decryptError := security.DecryptSecret(
			server.installationKey,
			totpSecretKey(administratorID, false),
			accountSecurity.TOTPNonce,
			accountSecurity.TOTPCiphertext,
		)
		if decryptError != nil {
			return false, decryptError
		}

		step, valid := security.VerifyTOTP(string(secret), trimmedCode, time.Now(), accountSecurity.TOTPLastStep)
		if !valid {
			return false, nil
		}

		if err := server.store.RecordTOTPStep(request.Context(), administratorID, step); err != nil {
			if errors.Is(err, storage.ErrReplayed) {
				return false, nil
			}

			return false, err
		}

		return true, nil
	}

	normalized := security.NormalizeRecoveryCode(trimmedCode)
	if len(normalized) != 10 {
		return false, nil
	}

	if err := server.store.ConsumeRecoveryCode(request.Context(), administratorID, security.Digest(normalized)); err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			return false, nil
		}

		return false, err
	}

	return true, nil
}

// verifyCurrentPassword re-checks the password before a sensitive change. Wrong
// passwords count toward the sign-in limit like a failed sign-in.
func (server *Server) verifyCurrentPassword(
	responseWriter http.ResponseWriter,
	request *http.Request,
	administratorID int64,
	password string,
	field string,
) bool {
	if password == "" {
		message := "Enter your password."
		if field == "currentPassword" {
			message = "Enter your current password."
		}

		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", field, message)

		return false
	}

	attemptKey := signInAttemptKey(request)
	if !server.attempts.Allowed(attemptKey) {
		server.writeRateLimited(responseWriter, attemptKey, "Too many attempts. Try again in 15 minutes.")

		return false
	}

	administrator, err := server.store.FindAdministratorByID(request.Context(), administratorID)
	if err != nil {
		server.logInternalError("find administrator for password check", err)
		writeInternalError(responseWriter)

		return false
	}

	valid, err := security.VerifyPasswordContext(
		request.Context(),
		password,
		administrator.PasswordHash,
	)
	if err != nil {
		server.logInternalError("verify current password", err)
	}

	if !valid {
		server.attempts.Failed(attemptKey)
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "password_incorrect", field, "That password is incorrect.")

		return false
	}

	return true
}

// newRecoveryCodeSet makes fresh recovery codes and the digests that get stored.
func newRecoveryCodeSet() ([]string, [][]byte, error) {
	codes, err := security.NewRecoveryCodes(recoveryCodeCount)
	if err != nil {
		return nil, nil, err
	}

	digests := make([][]byte, 0, len(codes))
	for _, code := range codes {
		digests = append(digests, security.Digest(security.NormalizeRecoveryCode(code)))
	}

	return codes, digests, nil
}

// formatInt renders an identifier for secret-binding keys.
func formatInt(value int64) string {
	return strconv.FormatInt(value, 10)
}
