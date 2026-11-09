package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

var rpcLoginUsernamePattern = regexp.MustCompile(`^[A-Za-z0-9._-]{1,64}$`)

// rpcLoginCreateBody is the JSON body for one generated compatible-RPC credential.
type rpcLoginCreateBody struct {
	Username json.RawMessage `json:"username"`
}

// rpcLoginUpdateBody is the JSON body for an RPC login edit.
//
// Raw values distinguish omitted fields from malformed values so partial updates keep
// their existing values while still reporting field-specific issues.
type rpcLoginUpdateBody struct {
	Username           json.RawMessage `json:"username"`
	RegeneratePassword json.RawMessage `json:"regeneratePassword"`
}

// rpcLoginResponse is one compatible-RPC login without its reusable digest.
type rpcLoginResponse struct {
	ID         string     `json:"id"`
	Username   string     `json:"username"`
	CreatedAt  time.Time  `json:"createdAt"`
	LastUsedAt *time.Time `json:"lastUsedAt"`
}

// rpcLoginCredentialResponse returns a generated password exactly once.
type rpcLoginCredentialResponse struct {
	Login    rpcLoginResponse `json:"login"`
	Password *string          `json:"password,omitempty"`
}

// rpcLoginListResponse wraps the RPC login collection under its contract name.
type rpcLoginListResponse struct {
	Logins []rpcLoginResponse `json:"logins"`
}

// handleListRPCLogins returns every compatible-RPC login without reusable secrets.
func (server *Server) handleListRPCLogins(responseWriter http.ResponseWriter, request *http.Request) {
	logins, err := server.store.ListRPCLogins(request.Context())
	if err != nil {
		server.logInternalError("list RPC logins", err)
		writeInternalError(responseWriter)

		return
	}

	items := make([]rpcLoginResponse, 0, len(logins))
	for _, login := range logins {
		items = append(items, newRPCLoginResponse(login))
	}

	writeJSON(responseWriter, http.StatusOK, rpcLoginListResponse{Logins: items})
}

// handleCreateRPCLogin generates and stores one independent compatible-RPC password.
//
// The plaintext is returned only in this response. Storage receives only its digest,
// and later list responses contain metadata alone.
//
// Since: UNRELEASED
func (server *Server) handleCreateRPCLogin(responseWriter http.ResponseWriter, request *http.Request) {
	var body rpcLoginCreateBody
	if err := decodeJSONBody(responseWriter, request, &body); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}

	username, message := readRPCLoginUsername(body.Username)
	if message != "" {
		writeIssues(responseWriter, []validationIssue{newFieldIssue("username", message)})

		return
	}
	connections, err := server.store.ListVPNConnections(request.Context())
	if err != nil {
		server.logInternalError("list VPN connections for RPC login", err)
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

	password, secretDigest, err := newGeneratedLoginPassword()
	if err != nil {
		server.logInternalError("generate RPC login password", err)
		writeInternalError(responseWriter)

		return
	}

	id, err := newRPCLoginID()
	if err != nil {
		server.logInternalError("generate RPC login identifier", err)
		writeInternalError(responseWriter)

		return
	}

	login, err := server.store.CreateRPCLogin(request.Context(), storage.RPCLogin{
		ID:           id,
		Username:     username,
		SecretDigest: secretDigest,
	})
	if errors.Is(err, storage.ErrRPCLoginUsernameTaken) {
		writeRPCLoginUsernameTaken(responseWriter)

		return
	}
	if err != nil {
		server.logInternalError("create RPC login", err)
		writeInternalError(responseWriter)

		return
	}

	writeJSON(responseWriter, http.StatusCreated, rpcLoginCredentialResponse{
		Login:    newRPCLoginResponse(login),
		Password: &password,
	})
}

// handleUpdateRPCLogin renames a login and optionally regenerates its password.
//
// Omitted fields retain their existing values. A generated password appears only when
// regeneration was explicitly requested and the complete update succeeds.
func (server *Server) handleUpdateRPCLogin(responseWriter http.ResponseWriter, request *http.Request) {
	id := request.PathValue("loginID")
	if !validRPCLoginID(id) {
		writeRPCLoginNotFound(responseWriter)

		return
	}

	existing, err := server.store.FindRPCLogin(request.Context(), id)
	if errors.Is(err, storage.ErrNotFound) {
		writeRPCLoginNotFound(responseWriter)

		return
	}
	if err != nil {
		server.logInternalError("read RPC login", err)
		writeInternalError(responseWriter)

		return
	}

	var body rpcLoginUpdateBody
	if err := decodeJSONBody(responseWriter, request, &body); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}

	username := existing.Username
	issues := []validationIssue{}
	usernameProvided := len(body.Username) > 0
	if usernameProvided {
		var message string
		username, message = readRPCLoginUsername(body.Username)
		if message != "" {
			issues = append(issues, newFieldIssue("username", message))
		}
	}

	regeneratePassword := false
	if len(body.RegeneratePassword) > 0 && json.Unmarshal(body.RegeneratePassword, &regeneratePassword) != nil {
		issues = append(issues, newFieldIssue(
			"regeneratePassword",
			"Choose whether to regenerate the password.",
		))
	}
	if len(issues) == 0 && !usernameProvided && !regeneratePassword {
		issues = append(issues, newFieldIssue(
			"regeneratePassword",
			"Change the username or regenerate the password.",
		))
	}
	if len(issues) > 0 {
		writeIssues(responseWriter, issues)

		return
	}

	var password *string
	var secretDigest []byte
	if regeneratePassword {
		generatedPassword, generatedDigest, err := newGeneratedLoginPassword()
		if err != nil {
			server.logInternalError("regenerate RPC login password", err)
			writeInternalError(responseWriter)

			return
		}
		password = &generatedPassword
		secretDigest = generatedDigest
	}

	login, err := server.store.UpdateRPCLogin(request.Context(), id, storage.RPCLoginChanges{
		Username:     username,
		SecretDigest: secretDigest,
	})
	if errors.Is(err, storage.ErrNotFound) {
		writeRPCLoginNotFound(responseWriter)

		return
	}
	if errors.Is(err, storage.ErrRPCLoginUsernameTaken) {
		writeRPCLoginUsernameTaken(responseWriter)

		return
	}
	if err != nil {
		server.logInternalError("update RPC login", err)
		writeInternalError(responseWriter)

		return
	}

	writeJSON(responseWriter, http.StatusOK, rpcLoginCredentialResponse{
		Login:    newRPCLoginResponse(login),
		Password: password,
	})
}

// handleDeleteRPCLogin revokes one compatible-RPC credential immediately.
func (server *Server) handleDeleteRPCLogin(responseWriter http.ResponseWriter, request *http.Request) {
	id := request.PathValue("loginID")
	if !validRPCLoginID(id) {
		writeRPCLoginNotFound(responseWriter)

		return
	}

	err := server.store.DeleteRPCLogin(request.Context(), id)
	if errors.Is(err, storage.ErrNotFound) {
		writeRPCLoginNotFound(responseWriter)

		return
	}
	if err != nil {
		server.logInternalError("delete RPC login", err)
		writeInternalError(responseWriter)

		return
	}

	responseWriter.WriteHeader(http.StatusNoContent)
}

// newRPCLoginResponse removes the stored password digest from one login.
func newRPCLoginResponse(login storage.RPCLogin) rpcLoginResponse {
	return rpcLoginResponse{
		ID:         login.ID,
		Username:   login.Username,
		CreatedAt:  login.CreatedAt,
		LastUsedAt: login.LastUsedAt,
	}
}

// readRPCLoginUsername validates one exact compatible-RPC username.
func readRPCLoginUsername(value json.RawMessage) (string, string) {
	var username string
	if len(value) == 0 || json.Unmarshal(value, &username) != nil || username == "" {
		return "", "Enter a username."
	}
	if !rpcLoginUsernamePattern.MatchString(username) {
		return "", "Use 1 to 64 letters, numbers, periods, underscores, or hyphens."
	}

	return username, ""
}

// newGeneratedLoginPassword returns the shared RPC and web-proxy password format.
func newGeneratedLoginPassword() (string, []byte, error) {
	return security.NewOpaqueToken("", 32)
}

// newRPCLoginID returns a random identifier such as rpl-0123456789abcdef.
func newRPCLoginID() (string, error) {
	value := make([]byte, 8)
	if _, err := rand.Read(value); err != nil {
		return "", fmt.Errorf("generate random identifier: %w", err)
	}

	return "rpl-" + hex.EncodeToString(value), nil
}

// validRPCLoginID reports whether a path value could name a compatible-RPC login.
func validRPCLoginID(id string) bool {
	hexadecimal, found := strings.CutPrefix(id, "rpl-")
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

// writeRPCLoginNotFound answers a login that does not exist or was removed.
func writeRPCLoginNotFound(responseWriter http.ResponseWriter) {
	writeError(responseWriter, http.StatusNotFound, "rpc_login_not_found", "That RPC login no longer exists.")
}

// writeRPCLoginUsernameTaken answers a username already used by another login.
func writeRPCLoginUsernameTaken(responseWriter http.ResponseWriter) {
	writeFieldError(
		responseWriter,
		http.StatusConflict,
		"rpc_login_exists",
		"username",
		"An RPC login with this username already exists.",
	)
}
