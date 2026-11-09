package api

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"path"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/clientinfo"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/notifications"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionconfig"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionrpc"
)

const (
	maximumRPCRequestBytes       int64 = 4 * 1024 * 1024
	minimumTableFormatRPCVersion       = 16
	rpcUnsupportedMethodResult         = "method not supported by transmission-vpn"
)

// rpcFacadeRequest is the legacy Transmission envelope accepted on port 9091.
type rpcFacadeRequest struct {
	Method    string          `json:"method"`
	Arguments json.RawMessage `json:"arguments"`
	Tag       json.RawMessage `json:"tag"`
	JSONRPC   json.RawMessage `json:"jsonrpc"`
}

// handleRPCProxy authenticates a dedicated login before serving the RPC facade.
//
// Third-party applications use Basic authentication with an independently revocable
// RPC username and generated password. API tokens are never accepted on this route.
func (server *Server) handleRPCProxy(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	authorization := request.Header.Get("Authorization")
	if authorization == "" {
		writeRPCAuthenticationRequired(responseWriter)

		return
	}
	attemptKey := rpcSignInAttemptKey(request)
	if !server.rpcAttempts.Allowed(attemptKey) {
		server.writeRPCRateLimited(responseWriter, attemptKey)

		return
	}
	username, password, credentialsFound := request.BasicAuth()
	if !credentialsFound || username == "" || password == "" {
		server.rpcAttempts.Failed(attemptKey)
		writeRPCAuthenticationRequired(responseWriter)

		return
	}

	login, findError := server.store.FindRPCLoginByUsername(request.Context(), username)
	expectedDigest := security.Digest("invalid-compatible-RPC-password")
	if findError == nil {
		expectedDigest = login.SecretDigest
	}
	passwordMatches := security.DigestsEqual(security.Digest(password), expectedDigest)
	if findError != nil && !errors.Is(findError, storage.ErrNotFound) {
		server.logInternalError("find RPC login", findError)
		writeError(responseWriter, http.StatusInternalServerError, "rpc_state_unavailable", "Compatible RPC access is temporarily unavailable.")

		return
	}
	if findError != nil || !passwordMatches {
		server.rpcAttempts.Failed(attemptKey)
		writeRPCAuthenticationRequired(responseWriter)

		return
	}
	if err := server.store.RecordRPCLoginUsed(request.Context(), login.ID); errors.Is(err, storage.ErrNotFound) {
		server.rpcAttempts.Failed(attemptKey)
		writeRPCAuthenticationRequired(responseWriter)

		return
	} else if err != nil {
		server.logInternalError("record RPC login use", err)
		writeError(responseWriter, http.StatusInternalServerError, "rpc_state_unavailable", "Compatible RPC access is temporarily unavailable.")

		return
	}
	server.rpcAttempts.Succeeded(attemptKey)
	if !server.rpcCompatibilityAllowed.Load() {
		writeError(responseWriter, http.StatusForbidden, "rpc_disabled", "Compatible RPC access is disabled.")

		return
	}

	sessionID := server.rpcSessionID(login.ID)
	if !hmac.Equal([]byte(request.Header.Get("X-Transmission-Session-Id")), []byte(sessionID)) {
		responseWriter.Header().Set("X-Transmission-Session-Id", sessionID)
		responseWriter.WriteHeader(http.StatusConflict)

		return
	}
	request.Body = http.MaxBytesReader(responseWriter, request.Body, maximumRPCRequestBytes)
	server.serveRPCFacade(responseWriter, request)
}

func (server *Server) rpcSessionID(loginID string) string {
	digest := hmac.New(sha256.New, server.rpcSessionSecret)
	_, _ = digest.Write([]byte(loginID))

	return hex.EncodeToString(digest.Sum(nil))
}

func (server *Server) serveRPCFacade(responseWriter http.ResponseWriter, request *http.Request) {
	decoder := json.NewDecoder(request.Body)
	decoder.UseNumber()
	var envelope rpcFacadeRequest
	if err := decoder.Decode(&envelope); err != nil {
		server.writeRPCFacadeResponse(responseWriter, map[string]any{}, "invalid Transmission RPC request", nil)

		return
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		server.writeRPCFacadeResponse(responseWriter, map[string]any{}, "invalid Transmission RPC request", envelope.Tag)

		return
	}
	if len(envelope.JSONRPC) > 0 {
		server.writeRPCFacadeResponse(
			responseWriter,
			map[string]any{},
			"JSON-RPC 2.0 is not supported by transmission-vpn; use legacy Transmission RPC",
			envelope.Tag,
		)

		return
	}
	arguments := map[string]any{}
	if len(envelope.Arguments) > 0 && string(envelope.Arguments) != "null" {
		argumentsDecoder := json.NewDecoder(strings.NewReader(string(envelope.Arguments)))
		argumentsDecoder.UseNumber()
		if err := argumentsDecoder.Decode(&arguments); err != nil {
			server.writeRPCFacadeResponse(responseWriter, map[string]any{}, "invalid Transmission RPC arguments", envelope.Tag)

			return
		}
	}

	responseArguments, result := server.callRPCFacade(request.Context(), envelope.Method, arguments)
	server.writeRPCFacadeResponse(responseWriter, responseArguments, result, envelope.Tag)
}

func (server *Server) writeRPCFacadeResponse(
	responseWriter http.ResponseWriter,
	arguments any,
	result string,
	tag json.RawMessage,
) {
	response := map[string]any{
		"arguments": arguments,
		"result":    result,
	}
	if len(tag) > 0 {
		var decodedTag any
		decoder := json.NewDecoder(strings.NewReader(string(tag)))
		decoder.UseNumber()
		if decoder.Decode(&decodedTag) == nil {
			response["tag"] = decodedTag
		}
	}
	writeJSON(responseWriter, http.StatusOK, response)
}

// callRPCFacade dispatches one compatible RPC call to application-owned behavior.
//
// Torrent methods retain connection routing, while blocklist-update is intercepted
// for the merger and never reaches a native daemon.
//
// Since: UNRELEASED
func (server *Server) callRPCFacade(
	ctx context.Context,
	method string,
	arguments map[string]any,
) (any, string) {
	if method == "torrent-set-location" {
		return map[string]any{}, "Change the torrent's profile in the console to move it."
	}
	normalizedArguments, validationResult := normalizeRPCFacadeArguments(method, arguments)
	if validationResult != "success" {
		return map[string]any{}, validationResult
	}
	arguments = normalizedArguments
	if method == "torrent-set" {
		if labelsValue, found := arguments["labels"]; found {
			labels, valid := rpcStringList(labelsValue)
			if !valid {
				return map[string]any{}, "labels must be an array of strings"
			}
			if err := validateLabels(labels); err != nil {
				return map[string]any{}, err.Error()
			}
			arguments["labels"] = labels
		}
	}
	if validationResult := server.validateRPCFacadeDownloadPaths(
		ctx,
		method,
		arguments,
	); validationResult != "success" {
		return map[string]any{}, validationResult
	}

	switch method {
	case "torrent-get":
		return server.rpcFacadeTorrentGet(ctx, arguments)
	case "torrent-add":
		return server.rpcFacadeTorrentAdd(ctx, arguments)
	case "torrent-remove":
		return server.rpcFacadeTorrentRemove(ctx, arguments)
	case "torrent-set", "torrent-start", "torrent-start-now", "torrent-stop",
		"torrent-verify", "torrent-reannounce",
		"torrent-rename-path", "queue-move-top",
		"queue-move-up", "queue-move-down", "queue-move-bottom":
		return server.rpcFacadeRoutedCall(ctx, method, arguments)
	case "session-stats":
		statistics, errorCodes := server.summedTransmissionStatistics(ctx)
		if len(errorCodes) > 0 {
			return map[string]any{}, "Transmission is unavailable for one or more connections"
		}

		return statistics, "success"
	case "session-get", "free-space", "port-test", "group-get":
		return server.rpcFacadeDefaultCall(ctx, method, arguments)
	case "session-set", "group-set":
		return server.rpcFacadeEveryCall(ctx, method, arguments)
	case "blocklist-update":
		return server.rpcFacadeBlocklistUpdate(ctx)
	case "session-close":
		return map[string]any{}, "session-close is not supported by transmission-vpn"
	default:
		return map[string]any{}, rpcUnsupportedMethodResult
	}
}

// rpcFacadeTorrentRemove clears every control-plane profile record only after the
// selected Transmission daemons accept the removal.
func (server *Server) rpcFacadeTorrentRemove(
	ctx context.Context,
	arguments map[string]any,
) (any, string) {
	selectionValue, selectionPresent := arguments["ids"]
	hashes := []string{}
	seen := map[string]struct{}{}
	appendHash := func(hash string) {
		normalized := strings.ToLower(hash)
		if _, duplicate := seen[normalized]; duplicate {
			return
		}
		seen[normalized] = struct{}{}
		hashes = append(hashes, normalized)
	}

	if !selectionPresent {
		result := server.mergedTorrents(ctx, []string{"hashString", "id"}, nil)
		if rpcFacadeTorrentResultUnavailable(result.Errors) {
			return map[string]any{}, "Transmission is unavailable for one or more connections"
		}
		for _, torrent := range result.Torrents {
			if hash, valid := torrent["hashString"].(string); valid && hash != "" {
				appendHash(hash)
			}
		}
	} else {
		selections, _, result := rpcTorrentSelections(selectionValue)
		if result != "success" {
			return map[string]any{}, result
		}
		for _, selection := range selections {
			switch selected := selection.(type) {
			case []string:
				for _, hash := range selected {
					appendHash(hash)
				}
			case []int64:
				resolved := server.mergedTorrents(ctx, []string{"hashString", "id"}, selected)
				if rpcFacadeTorrentResultUnavailable(resolved.Errors) {
					return map[string]any{}, "Transmission is unavailable for one or more connections"
				}
				for _, torrent := range resolved.Torrents {
					if hash, valid := torrent["hashString"].(string); valid && hash != "" {
						appendHash(hash)
					}
				}
			}
		}
	}

	response, result := server.rpcFacadeRoutedCall(ctx, "torrent-remove", arguments)
	if result != "success" || len(hashes) == 0 {
		return response, result
	}
	if err := server.store.DeleteTorrentProfileRecords(ctx, hashes); err != nil {
		server.logInternalError("delete compatible RPC torrent profile records", err)

		return map[string]any{}, "The removed torrent profile state could not be cleared"
	}
	if err := server.refreshTorrentProfileAssignments(ctx); err != nil {
		server.logInternalError("refresh compatible RPC torrent profile records", err)

		return map[string]any{}, "The removed torrent profile state could not be refreshed"
	}

	return response, result
}

func normalizeRPCFacadeArguments(method string, arguments map[string]any) (map[string]any, string) {
	normalized := copyRPCArguments(arguments)
	canonicalKeys := make(map[string]string, len(arguments))
	for key := range arguments {
		canonicalKey := canonicalRPCFacadeArgumentKey(key)
		if _, duplicate := canonicalKeys[canonicalKey]; duplicate {
			return nil, "duplicate Transmission RPC argument " + canonicalKey
		}
		canonicalKeys[canonicalKey] = key
	}

	pathKeys := []string{}
	switch method {
	case "session-set":
		normalized = make(map[string]any, len(arguments))
		for canonicalKey, originalKey := range canonicalKeys {
			upstreamKey, allowed := rpcFacadeSessionSetArgumentKey(canonicalKey)
			if !allowed {
				return nil, canonicalKey + " is not supported for session-set by transmission-vpn"
			}
			normalized[upstreamKey] = arguments[originalKey]
		}
		pathKeys = []string{"download-dir", "incomplete-dir"}
	case "torrent-add":
		if originalKey, found := canonicalKeys["download-dir"]; found && originalKey != "download-dir" {
			normalized["download-dir"] = normalized[originalKey]
			delete(normalized, originalKey)
		}
	case "torrent-set", "torrent-set-location":
		if originalKey, found := canonicalKeys["location"]; found && originalKey != "location" {
			normalized["location"] = normalized[originalKey]
			delete(normalized, originalKey)
		}
		pathKeys = []string{"location"}
	}
	for _, key := range pathKeys {
		value, found := normalized[key]
		if !found {
			continue
		}
		pathValue, valid := value.(string)
		if !valid {
			return nil, key + " must be an absolute path beneath /data"
		}
		normalizedPath, err := transmissionconfig.NormalizeDataPath(pathValue)
		if err != nil {
			return nil, key + " must be an absolute path beneath /data"
		}
		if err := settings.ValidateDownloadDataPath(normalizedPath); err != nil {
			return nil, err.Error()
		}
		normalized[key] = normalizedPath
	}

	return normalized, "success"
}

// canonicalRPCFacadeArgumentKey normalizes aliases for facade security checks.
//
// Comparing legacy and current Transmission spellings in one namespace keeps
// alternate separators and casing from bypassing allowlists or path checks.
//
// Since: UNRELEASED
func canonicalRPCFacadeArgumentKey(key string) string {
	var canonical strings.Builder
	canonical.Grow(len(key))
	var previous rune
	for index, character := range key {
		originalCharacter := character
		if character == '_' {
			character = '-'
		}
		if unicode.IsUpper(character) {
			if index > 0 && previous != '-' && previous != '_' && !unicode.IsUpper(previous) {
				canonical.WriteByte('-')
			}
			character = unicode.ToLower(character)
		}
		canonical.WriteRune(character)
		previous = originalCharacter
	}

	switch canonical.String() {
	case "cache-size-mib":
		return "cache-size-mb"
	case "peer-socket-tos":
		return "peer-socket-diffserv"
	case "remote-session-requres-authentication":
		return "remote-session-requires-authentication"
	default:
		return strings.ToLower(canonical.String())
	}
}

// rpcFacadeSessionSetArgumentKey returns the safe upstream session-set key.
//
// Remote applications receive only user-owned tuning settings; process,
// scripting, listener, and port-forwarding controls remain appliance-owned.
//
// Since: UNRELEASED
func rpcFacadeSessionSetArgumentKey(canonicalKey string) (string, bool) {
	switch canonicalKey {
	case "alt-speed-down", "alt-speed-enabled", "alt-speed-time-begin",
		"alt-speed-time-day", "alt-speed-time-enabled", "alt-speed-time-end",
		"alt-speed-up", "blocklist-enabled", "cache-size-mb", "dht-enabled",
		"download-dir", "download-queue-enabled", "download-queue-size",
		"encryption", "idle-seeding-limit", "idle-seeding-limit-enabled",
		"incomplete-dir", "incomplete-dir-enabled", "lpd-enabled",
		"peer-limit-global", "peer-limit-per-torrent", "pex-enabled",
		"queue-stalled-enabled", "queue-stalled-minutes", "rename-partial-files",
		"seed-queue-enabled", "seed-queue-size", "speed-limit-down",
		"speed-limit-down-enabled", "speed-limit-up", "speed-limit-up-enabled",
		"start-added-torrents", "trash-original-torrent-files", "utp-enabled":
		return canonicalKey, true
	case "seed-ratio-limit":
		return "seed_ratio_limit", true
	case "seed-ratio-limited":
		return "seed_ratio_limited", true
	default:
		return "", false
	}
}

func (server *Server) rpcFacadeTorrentGet(
	ctx context.Context,
	arguments map[string]any,
) (any, string) {
	fields, valid := rpcStringList(arguments["fields"])
	if !valid || len(fields) == 0 {
		return map[string]any{}, "torrent-get requires a fields array"
	}
	format := "objects"
	if value, found := arguments["format"]; found {
		format, valid = value.(string)
		if !valid || format != "objects" && format != "table" {
			return map[string]any{}, "torrent-get format must be objects or table"
		}
	}
	if format == "table" {
		if supported, result := server.rpcTableFormatSupported(ctx); !supported {
			return map[string]any{}, result
		}
	}

	selections, recentlyActive, result := rpcTorrentSelections(arguments["ids"])
	if result != "success" {
		return map[string]any{}, result
	}
	requestedID := stringInSlice(fields, "id")
	requestedHash := stringInSlice(fields, "hashString")
	upstreamFields := append([]string(nil), fields...)
	if !requestedID {
		upstreamFields = append(upstreamFields, "id")
	}
	if !requestedHash {
		upstreamFields = append(upstreamFields, "hashString")
	}

	merged := mergedTorrentResult{Torrents: []map[string]any{}, Removed: []int64{}, Complete: true}
	seen := map[int64]struct{}{}
	for _, selection := range selections {
		partial := server.mergedTorrents(ctx, upstreamFields, selection)
		if rpcFacadeTorrentResultUnavailable(partial.Errors) {
			return map[string]any{}, "Transmission is unavailable for one or more connections"
		}
		for _, skipped := range partial.Errors {
			server.logger.Warn("compatible RPC skipped unknown torrent", "method", "torrent-get", "torrent", skipped)
		}
		for _, torrent := range partial.Torrents {
			identifier, identifierValid := integerValue(torrent["id"])
			if identifierValid {
				if _, duplicate := seen[identifier]; duplicate {
					continue
				}
				seen[identifier] = struct{}{}
			}
			delete(torrent, "connectionId")
			if !requestedID {
				delete(torrent, "id")
			}
			if !requestedHash {
				delete(torrent, "hashString")
			}
			merged.Torrents = append(merged.Torrents, torrent)
		}
		merged.Removed = append(merged.Removed, partial.Removed...)
	}
	sort.SliceStable(merged.Torrents, func(left int, right int) bool {
		leftID, leftValid := integerValue(merged.Torrents[left]["id"])
		rightID, rightValid := integerValue(merged.Torrents[right]["id"])

		return leftValid && rightValid && leftID < rightID
	})
	response := map[string]any{}
	if format == "table" {
		table := make([][]any, 0, len(merged.Torrents)+1)
		header := make([]any, len(fields))
		for index, field := range fields {
			header[index] = field
		}
		table = append(table, header)
		for _, torrent := range merged.Torrents {
			row := make([]any, len(fields))
			for index, field := range fields {
				row[index] = torrent[field]
			}
			table = append(table, row)
		}
		response["torrents"] = table
	} else {
		response["torrents"] = merged.Torrents
	}
	if recentlyActive {
		sort.Slice(merged.Removed, func(left int, right int) bool {
			return merged.Removed[left] < merged.Removed[right]
		})
		response["removed"] = merged.Removed
	}

	return response, "success"
}

func rpcFacadeTorrentResultUnavailable(errorCodes []string) bool {
	for _, code := range errorCodes {
		if strings.HasPrefix(code, "torrents-unavailable:") ||
			strings.HasPrefix(code, "torrents-invalid:") ||
			strings.HasPrefix(code, "removed-torrent-invalid:") {
			return true
		}
	}

	return false
}

func rpcTorrentSelections(value any) ([]any, bool, string) {
	if value == nil {
		return []any{nil}, false, "success"
	}
	if text, ok := value.(string); ok {
		if text == "recently-active" {
			return []any{text}, true, "success"
		}
		normalized, err := normalizeTorrentHashes([]string{text})
		if err == nil {
			return []any{normalized}, false, "success"
		}

		return nil, false, "torrent-get ids contains an unsupported value"
	}
	if identifier, valid := rpcPositiveInteger(value); valid {
		return []any{[]int64{identifier}}, false, "success"
	}
	values, ok := value.([]any)
	if !ok {
		return nil, false, "torrent-get ids must be an integer, hash, array, or recently-active"
	}
	identifiers := []int64{}
	hashes := []string{}
	for _, item := range values {
		if identifier, valid := rpcPositiveInteger(item); valid {
			identifiers = append(identifiers, identifier)

			continue
		}
		hash, valid := item.(string)
		if !valid {
			return nil, false, "torrent-get ids contains an invalid torrent identifier"
		}
		normalized, err := normalizeTorrentHashes([]string{hash})
		if err != nil {
			return nil, false, "torrent-get ids contains an invalid torrent hash"
		}
		hashes = append(hashes, normalized[0])
	}
	selections := []any{}
	if len(identifiers) > 0 {
		selections = append(selections, identifiers)
	}
	if len(hashes) > 0 {
		selections = append(selections, hashes)
	}
	if len(selections) == 0 {
		selections = append(selections, []int64{})
	}

	return selections, false, "success"
}

func (server *Server) rpcTableFormatSupported(ctx context.Context) (bool, string) {
	for _, daemon := range server.transmissionDaemons(ctx) {
		var session map[string]any
		if err := daemon.Client.Call(ctx, "session-get", nil, &session); err != nil {
			return false, "Transmission is unavailable while checking table support"
		}
		version, valid := integerValue(session["rpc-version"])
		if !valid || version < minimumTableFormatRPCVersion {
			return false, "torrent-get table format is not supported by every Transmission daemon"
		}
	}

	return true, "success"
}

func (server *Server) rpcFacadeRoutedCall(
	ctx context.Context,
	method string,
	arguments map[string]any,
) (any, string) {
	baseArguments := copyRPCArguments(arguments)
	selectionValue, selectionPresent := baseArguments["ids"]
	delete(baseArguments, "ids")

	type routedCall struct {
		daemon      transmissionrpc.Daemon
		identifiers any
	}
	calls := []routedCall{}
	if !selectionPresent {
		for _, daemon := range server.transmissionDaemons(ctx) {
			calls = append(calls, routedCall{daemon: daemon})
		}
	} else {
		selections, _, result := rpcTorrentSelections(selectionValue)
		if result != "success" {
			return map[string]any{}, result
		}
		for _, selection := range selections {
			switch selected := selection.(type) {
			case []int64:
				groups := server.resolveRPCFacadeIDGroups(ctx, method, selected)
				for _, group := range groups {
					calls = append(calls, routedCall{daemon: group.Daemon, identifiers: group.Identifiers})
				}
			case []string:
				groups := server.resolveRPCFacadeHashGroups(ctx, method, selected)
				for _, group := range groups {
					calls = append(calls, routedCall{daemon: group.Daemon, identifiers: group.Identifiers})
				}
			default:
				return map[string]any{}, "recently-active cannot be used with this method"
			}
		}
	}

	results := make([]map[string]any, len(calls))
	errorsByCall := make([]error, len(calls))
	var waitGroup sync.WaitGroup
	for index, call := range calls {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			callArguments := copyRPCArguments(baseArguments)
			if selectionPresent {
				callArguments["ids"] = call.identifiers
			}
			errorsByCall[index] = call.daemon.Client.Call(ctx, method, callArguments, &results[index])
		}()
	}
	waitGroup.Wait()
	successfulCalls := 0
	for _, err := range errorsByCall {
		if err == nil {
			successfulCalls++
		}
	}
	if method == "torrent-set" && successfulCalls > 0 {
		if labels, changed := baseArguments["labels"].([]string); changed {
			if _, err := server.saveTorrentLabels(ctx, labels); err != nil {
				server.logInternalError("save labels used by compatible RPC torrent-set", err)

				return map[string]any{}, "The torrent labels could not be saved"
			}
		}
	}

	merged := map[string]any{}
	for index, err := range errorsByCall {
		if err != nil {
			return map[string]any{}, server.rpcFacadeCallError(method, calls[index].daemon.ConnectionID, err)
		}
		if method == "torrent-rename-path" {
			if daemonID, valid := integerValue(results[index]["id"]); valid {
				facadeID, facadeError := transmissionrpc.FacadeID(calls[index].daemon.Slot, daemonID)
				if facadeError != nil {
					return map[string]any{}, "Transmission returned an invalid torrent identifier"
				}
				results[index]["id"] = facadeID
			}
		}
		for key, value := range results[index] {
			if _, found := merged[key]; !found {
				merged[key] = value
			}
		}
	}

	return merged, "success"
}

func (server *Server) rpcFacadeDefaultCall(
	ctx context.Context,
	method string,
	arguments map[string]any,
) (any, string) {
	daemon, err := server.defaultTransmissionDaemon(ctx)
	if err != nil {
		return map[string]any{}, "The default Transmission daemon is unavailable"
	}
	result := map[string]any{}
	if err := daemon.Client.Call(ctx, method, arguments, &result); err != nil {
		return map[string]any{}, server.rpcFacadeCallError(method, daemon.ConnectionID, err)
	}

	return result, "success"
}

// rpcFacadeEveryCall broadcasts only native methods that every daemon must apply.
//
// Results are checked per connection, while application-owned blocklist updates use
// their dedicated runner-backed facade path instead.
//
// Since: UNRELEASED
func (server *Server) rpcFacadeEveryCall(
	ctx context.Context,
	method string,
	arguments map[string]any,
) (any, string) {
	daemons := server.transmissionDaemons(ctx)
	results := make([]map[string]any, len(daemons))
	errorsByDaemon := make([]error, len(daemons))
	var waitGroup sync.WaitGroup
	for index, daemon := range daemons {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			errorsByDaemon[index] = daemon.Client.Call(ctx, method, arguments, &results[index])
		}()
	}
	waitGroup.Wait()
	if method == "session-set" {
		server.ensureRPCSessionDirectories(context.WithoutCancel(ctx), arguments)
	}

	response := map[string]any{}
	for index, err := range errorsByDaemon {
		if err != nil {
			return map[string]any{}, server.rpcFacadeCallError(method, daemons[index].ConnectionID, err)
		}
	}

	return response, "success"
}

// rpcFacadeBlocklistUpdate delegates the compatible method to the runner merger.
//
// No native daemon receives the call; the facade waits for one complete merged
// attempt and reports the same in-use range count across every daemon.
//
// Since: UNRELEASED
func (server *Server) rpcFacadeBlocklistUpdate(ctx context.Context) (any, string) {
	requestedAt, err := server.requestBlocklistUpdate(ctx)
	if err != nil {
		return map[string]any{}, "blocklist update failed: " + err.Error()
	}

	totalRanges, err := server.waitForBlocklistUpdate(ctx, requestedAt)
	if err != nil {
		return map[string]any{}, "blocklist update failed: " + err.Error()
	}

	return map[string]any{"blocklist-size": totalRanges}, "success"
}

func (server *Server) rpcFacadeCallError(method string, connectionID string, err error) string {
	var resultError *transmissionrpc.ResultError
	if errors.As(err, &resultError) {
		return resultError.Result
	}
	server.logger.Warn(
		"compatible RPC daemon call failed",
		"method",
		method,
		"connectionId",
		connectionID,
		"error",
		err,
	)

	return "Transmission is unavailable for one or more connections"
}

func (server *Server) rpcFacadeTorrentAdd(
	ctx context.Context,
	arguments map[string]any,
) (any, string) {
	addArguments := copyRPCArguments(arguments)
	filename, hasFilename := addArguments["filename"].(string)
	metainfo, hasMetainfo := addArguments["metainfo"].(string)
	if hasFilename == hasMetainfo || hasFilename && strings.TrimSpace(filename) == "" ||
		hasMetainfo && strings.TrimSpace(metainfo) == "" {
		return map[string]any{}, "torrent-add requires exactly one filename or metainfo"
	}
	var decodedMetainfo []byte
	var err error
	if hasFilename {
		if err := validateTorrentURL(filename); err != nil {
			return map[string]any{}, err.Error()
		}
	} else {
		decodedMetainfo, err = base64.StdEncoding.DecodeString(metainfo)
		if err != nil || len(decodedMetainfo) == 0 {
			return map[string]any{}, "metainfo must be non-empty standard base64"
		}
	}
	if labelsValue, found := addArguments["labels"]; found {
		labels, valid := rpcStringList(labelsValue)
		if !valid {
			return map[string]any{}, "labels must be an array of strings"
		}
		if err := validateLabels(labels); err != nil {
			return map[string]any{}, err.Error()
		}
		addArguments["labels"] = labels
	}

	name, err := torrentSourceName(filename, decodedMetainfo)
	if err != nil {
		return map[string]any{}, err.Error()
	}
	profiles, err := server.store.ListTorrentProfiles(ctx)
	if err != nil {
		server.logInternalError("list torrent profiles for compatible RPC add", err)
		return map[string]any{}, "Torrent profiles are unavailable"
	}
	defaultProfile, err := server.defaultTorrentProfile(ctx)
	if err != nil {
		server.logInternalError("read Default torrent profile for compatible RPC add", err)
		return map[string]any{}, "Torrent profiles are unavailable"
	}
	profileSelection := rpcTorrentAddProfile(
		addArguments,
		name,
		profiles,
		defaultProfile,
	)
	profile := profileSelection.Profile
	namedProfile := profileSelection.Named
	needsProfile := len(profileSelection.PatternMatches) > 1
	if blocked, blockError := server.torrentProfileAddBlockedMessage(ctx, profile, !namedProfile); blockError != nil {
		server.logInternalError("check torrent profile folder for compatible RPC add", blockError)

		return map[string]any{}, "Torrent profiles are unavailable"
	} else if blocked != "" {
		return map[string]any{}, blocked
	}
	downloadPolicy, err := server.effectiveDownloadPathPolicy(ctx)
	if err != nil {
		server.logInternalError("read download paths for compatible RPC add", err)

		return map[string]any{}, "Settings are unavailable"
	}
	if err := prepareTorrentAddDownloadDirectory(
		addArguments,
		profile,
		downloadPolicy,
	); err != nil {
		return map[string]any{}, err.Error()
	}
	target, err := server.defaultTransmissionDaemon(ctx)
	if profile.ConnectionID != nil && server.transmissionClients != nil {
		var found bool
		target, found = server.transmissionClients.ByConnectionID(*profile.ConnectionID)
		if !found {
			err = errors.New("the profile's Transmission daemon is unavailable")
		}
	}
	if err != nil {
		if errors.Is(err, errVPNConnectionRequired) {
			return map[string]any{}, "Add a VPN connection before adding torrents."
		}
		return map[string]any{}, "Transmission is unavailable for the selected connection"
	}
	requestedLabels := []string{}
	if _, found := addArguments["labels"]; found {
		requestedLabels, _ = rpcStringList(addArguments["labels"])
	}
	mergedLabels, err := mergeTorrentLabels(requestedLabels, profile.Labels)
	if err != nil {
		return map[string]any{}, err.Error()
	}
	addArguments["labels"] = nonNilStrings(mergedLabels)
	if _, found := addArguments["paused"]; !found {
		addArguments["paused"] = profile.StartPaused
	}
	if needsProfile {
		addArguments["paused"] = true
	}
	sourceHash, hashKnown, err := torrentSourceHash(filename, decodedMetainfo)
	if err != nil {
		return map[string]any{}, err.Error()
	}

	server.torrentAddMutex.Lock()
	defer server.torrentAddMutex.Unlock()
	if namedProfile {
		if redirectConnectionID, removing := server.vpnConnectionRemovalTarget(
			target.ConnectionID,
		); removing {
			if redirectConnectionID == "" || server.transmissionClients == nil {
				return map[string]any{}, "The selected VPN connection is being removed"
			}
			redirectedTarget, found := server.transmissionClients.ByConnectionID(
				redirectConnectionID,
			)
			if !found {
				return map[string]any{}, "Transmission is unavailable for the selected connection"
			}
			target = redirectedTarget
		}
	}
	refreshedLocations := map[string]torrentLocation{}
	if server.transmissionClients != nil {
		var unanswered []string
		refreshedLocations, unanswered = server.refreshTorrentHashIndex(ctx)
		if name, starting := server.startingTransmissionConnectionName(ctx, unanswered); starting {
			return map[string]any{}, "Transmission for " + name + " is still starting"
		}
	}
	if hashKnown {
		if existing, found := refreshedLocations[sourceHash]; found &&
			existing.ConnectionID != target.ConnectionID {
			return map[string]any{"torrent-duplicate": rpcTorrentAddItem(existing.FacadeID, sourceHash, existing.Name)}, "success"
		}
	}
	if !hashKnown {
		if pausedValue, found := addArguments["paused"]; found {
			if _, valid := pausedValue.(bool); !valid {
				return map[string]any{}, "paused must be a boolean"
			}
		}
	}
	startAfterDuplicateCheck, err := prepareTorrentAddStart(
		ctx,
		target.Client,
		addArguments,
		hashKnown,
	)
	if err != nil {
		return map[string]any{}, server.rpcFacadeCallError("session-get", target.ConnectionID, err)
	}

	var result torrentAddRPCResult
	if err := target.Client.Call(ctx, "torrent-add", addArguments, &result); err != nil {
		return map[string]any{}, server.rpcFacadeCallError("torrent-add", target.ConnectionID, err)
	}
	if result.Added == nil && result.Duplicate == nil || result.Added != nil && result.Duplicate != nil {
		return map[string]any{}, "Transmission returned an invalid torrent-add response"
	}
	added := result.Added
	duplicate := false
	responseKey := "torrent-added"
	if result.Duplicate != nil {
		added = result.Duplicate
		duplicate = true
		responseKey = "torrent-duplicate"
	}
	if added.ID <= 0 || strings.TrimSpace(added.HashString) == "" {
		return map[string]any{}, "Transmission returned an invalid torrent-add response"
	}
	added.HashString = strings.ToLower(added.HashString)
	facadeID, err := transmissionrpc.FacadeID(target.Slot, added.ID)
	if err != nil {
		return map[string]any{}, "Transmission returned an invalid torrent identifier"
	}
	if existing, found := refreshedLocations[added.HashString]; found && existing.ConnectionID != target.ConnectionID {
		removeError := target.Client.Call(ctx, "torrent-remove", map[string]any{
			"ids": []int64{added.ID}, "delete-local-data": false,
		}, nil)
		if removeError != nil {
			return map[string]any{}, "The cross-connection duplicate could not be removed"
		}

		return map[string]any{"torrent-duplicate": rpcTorrentAddItem(existing.FacadeID, added.HashString, existing.Name)}, "success"
	}
	if !duplicate {
		labels, _ := rpcStringList(addArguments["labels"])
		if _, err := server.saveTorrentLabels(ctx, labels); err != nil {
			server.logInternalError("save labels used by compatible RPC torrent-add", err)

			return map[string]any{}, "The torrent labels could not be saved"
		}
	}

	applyProfile := !duplicate
	if duplicate {
		_, assigned := server.torrentProfileAssignments.profileID(added.HashString)
		applyProfile = !assigned
	}
	startContext := ctx
	if applyProfile {
		profileContext, cancel := detachedTorrentProfileContext(ctx)
		defer cancel()
		startContext = profileContext
		profileArguments := torrentProfileSetArguments(profile, []int64{added.ID}, false)
		duplicateLabels := []string{}
		if duplicate {
			existingLabels, labelError := readRPCTorrentLabels(
				profileContext,
				target,
				added.ID,
			)
			if labelError != nil {
				return map[string]any{}, server.rpcFacadeCallError(
					"torrent-get",
					target.ConnectionID,
					labelError,
				)
			}
			duplicateLabels, labelError = mergeTorrentLabels(existingLabels, mergedLabels)
			if labelError != nil {
				return map[string]any{}, labelError.Error()
			}
			profileArguments["labels"] = duplicateLabels
		}
		if err := target.Client.Call(profileContext, "torrent-set", profileArguments, nil); err != nil {
			return map[string]any{}, server.rpcFacadeCallError("torrent-set", target.ConnectionID, err)
		}
		if duplicate {
			if _, err := server.saveTorrentLabels(profileContext, duplicateLabels); err != nil {
				server.logInternalError("save profile labels used by compatible RPC duplicate", err)

				return map[string]any{}, "The torrent labels could not be saved"
			}
		}
		if profile.Options.Queue == "top" {
			if err := target.Client.Call(profileContext, "queue-move-top", map[string]any{"ids": []int64{added.ID}}, nil); err != nil {
				return map[string]any{}, server.rpcFacadeCallError("queue-move-top", target.ConnectionID, err)
			}
		}
		if namedProfile {
			if err := server.store.ReplaceTorrentProfileAssignments(profileContext, []string{added.HashString}, &profile.ID); err != nil {
				server.logInternalError("record compatible RPC torrent profile", err)
				return map[string]any{}, "The torrent profile assignment could not be saved"
			}
		} else if needsProfile {
			profileIDs := make([]string, 0, len(profileSelection.PatternMatches))
			for _, matchingProfile := range profileSelection.PatternMatches {
				profileIDs = append(profileIDs, matchingProfile.ID)
			}
			if err := server.store.ReplaceTorrentNeedsProfile(
				profileContext,
				added.HashString,
				profileIDs,
			); err != nil {
				server.logInternalError("record pending compatible RPC torrent profile choice", err)
				return map[string]any{}, "The torrent profile choice could not be saved"
			}
		} else if err := server.store.ReplaceTorrentProfileAssignments(
			profileContext,
			[]string{added.HashString},
			nil,
		); err != nil {
			server.logInternalError("record compatible RPC Default torrent profile", err)
			return map[string]any{}, "The torrent profile assignment could not be saved"
		}
		if err := server.refreshTorrentProfileAssignments(profileContext); err != nil {
			server.logInternalError("refresh compatible RPC torrent profiles", err)
			return map[string]any{}, "The torrent profile assignment could not be refreshed"
		}
	}
	if startAfterDuplicateCheck && !duplicate {
		if err := target.Client.Call(
			startContext,
			"torrent-start",
			map[string]any{"ids": []int64{added.ID}},
			nil,
		); err != nil {
			return map[string]any{}, server.rpcFacadeCallError("torrent-start", target.ConnectionID, err)
		}
	}
	server.rememberTorrentLocation(added.HashString, torrentLocation{
		ConnectionID: target.ConnectionID,
		FacadeID:     facadeID,
		Name:         added.Name,
	})
	if needsProfile && !duplicate {
		server.notifyProfileChoiceNeeded(added.Name, profileSelection.PatternMatches)
	}

	return map[string]any{responseKey: rpcTorrentAddItem(facadeID, added.HashString, added.Name)}, "success"
}

// notifyProfileChoiceNeeded names a remote add and every matching profile.
func (server *Server) notifyProfileChoiceNeeded(
	torrentName string,
	profiles []storage.TorrentProfile,
) {
	profileNames := make([]string, 0, len(profiles))
	profileDetails := make([]map[string]any, 0, len(profiles))
	for _, profile := range profiles {
		profileNames = append(profileNames, profile.Name)
		profileDetails = append(profileDetails, map[string]any{
			"id":   profile.ID,
			"name": profile.Name,
		})
	}
	server.notifier.deliver(notifications.BuildEventNotification(
		notificationEvent("profile-choice-needed"),
		torrentName+" matches more than one profile: "+strings.Join(profileNames, ", ")+". Resolve it in the web UI.",
		map[string]any{
			"torrent":  map[string]any{"name": torrentName},
			"profiles": profileDetails,
		},
		time.Now(),
	))
}

func rpcTorrentAddItem(identifier int64, hash string, name string) map[string]any {
	return map[string]any{"id": identifier, "hashString": hash, "name": name}
}

// rpcTorrentAddProfileSelection records the winning match and any unresolved tie.
type rpcTorrentAddProfileSelection struct {
	Profile        storage.TorrentProfile
	Named          bool
	PatternMatches []storage.TorrentProfile
}

func rpcTorrentAddProfile(
	arguments map[string]any,
	name string,
	profiles []storage.TorrentProfile,
	defaultProfile storage.TorrentProfile,
) rpcTorrentAddProfileSelection {
	if requestedDirectory, valid := arguments["download-dir"].(string); valid {
		for _, profile := range profiles {
			if torrentAddDownloadDirectoryMatches(
				requestedDirectory,
				profile.DownloadDirectory,
			) {
				return rpcTorrentAddProfileSelection{Profile: profile, Named: true}
			}
		}
		if torrentAddDownloadDirectoryMatches(
			requestedDirectory,
			defaultProfile.DownloadDirectory,
		) {
			return rpcTorrentAddProfileSelection{Profile: defaultProfile}
		}
	}

	if requestedLabels, valid := rpcStringList(arguments["labels"]); valid {
		for _, profile := range profiles {
			for _, requestedLabel := range requestedLabels {
				if strings.EqualFold(requestedLabel, profile.Name) ||
					containsFold(profile.Labels, requestedLabel) {
					return rpcTorrentAddProfileSelection{Profile: profile, Named: true}
				}
			}
		}
		for _, requestedLabel := range requestedLabels {
			if strings.EqualFold(requestedLabel, defaultProfile.Name) ||
				containsFold(defaultProfile.Labels, requestedLabel) {
				return rpcTorrentAddProfileSelection{Profile: defaultProfile}
			}
		}
	}

	matches := torrentProfilesMatchingName(profiles, name)
	if len(matches) == 1 {
		return rpcTorrentAddProfileSelection{Profile: matches[0], Named: true}
	}
	if len(matches) > 1 {
		return rpcTorrentAddProfileSelection{
			Profile:        defaultProfile,
			PatternMatches: matches,
		}
	}

	return rpcTorrentAddProfileSelection{Profile: defaultProfile}
}

func containsFold(values []string, wanted string) bool {
	for _, value := range values {
		if strings.EqualFold(value, wanted) {
			return true
		}
	}

	return false
}

func torrentSourceName(filename string, metainfo []byte) (string, error) {
	if len(metainfo) > 0 {
		return torrentMetainfoName(metainfo)
	}
	parsed, err := url.Parse(filename)
	if err != nil {
		return "", errors.New("filename is not a valid URL")
	}
	if strings.EqualFold(parsed.Scheme, "magnet") {
		if name := parsed.Query().Get("dn"); name != "" {
			return name, nil
		}

		return "Magnet link", nil
	}
	segment, err := url.PathUnescape(path.Base(parsed.EscapedPath()))
	if err != nil {
		segment = path.Base(parsed.Path)
	}
	if segment == "." || segment == "/" || segment == "" {
		segment = parsed.Hostname()
	}

	return segment, nil
}

func copyRPCArguments(arguments map[string]any) map[string]any {
	copy := make(map[string]any, len(arguments))
	for key, value := range arguments {
		copy[key] = value
	}

	return copy
}

func rpcStringList(value any) ([]string, bool) {
	switch values := value.(type) {
	case []string:
		return append([]string(nil), values...), true
	case []any:
		result := make([]string, len(values))
		for index, value := range values {
			text, valid := value.(string)
			if !valid {
				return nil, false
			}
			result[index] = text
		}

		return result, true
	default:
		return nil, false
	}
}

// readRPCTorrentLabels reads labels before applying a profile to a duplicate add.
func readRPCTorrentLabels(
	ctx context.Context,
	daemon transmissionrpc.Daemon,
	id int64,
) ([]string, error) {
	var response struct {
		Torrents []struct {
			Labels []string `json:"labels"`
		} `json:"torrents"`
	}
	if err := daemon.Client.Call(ctx, "torrent-get", map[string]any{
		"fields": []string{"labels"},
		"ids":    []int64{id},
	}, &response); err != nil {
		return nil, err
	}
	if len(response.Torrents) != 1 {
		return nil, errors.New("duplicate torrent labels are unavailable")
	}

	return response.Torrents[0].Labels, nil
}

func rpcPositiveInteger(value any) (int64, bool) {
	switch number := value.(type) {
	case json.Number:
		integer, err := strconv.ParseInt(string(number), 10, 64)

		return integer, err == nil && integer > 0
	default:
		return integerValue(number)
	}
}

func stringInSlice(values []string, wanted string) bool {
	for _, value := range values {
		if value == wanted {
			return true
		}
	}

	return false
}

// rpcSignInAttemptKey limits compatible-RPC failures by the direct TCP peer only.
func rpcSignInAttemptKey(request *http.Request) string {
	address := request.RemoteAddr
	if peer := remoteIP(request); peer != nil {
		address = peer.String()
	}

	return "rpc-sign-in:" + clientinfo.LimitKey(address)
}

func (server *Server) writeRPCRateLimited(responseWriter http.ResponseWriter, attemptKey string) {
	responseWriter.Header().Set("Retry-After", strconv.Itoa(max(server.rpcAttempts.RetryAfter(attemptKey), 1)))
	writeError(responseWriter, http.StatusTooManyRequests, "rate_limited", "Too many compatible RPC sign-in attempts. Try again in 5 minutes.")
}

func writeRPCAuthenticationRequired(responseWriter http.ResponseWriter) {
	responseWriter.Header().Set("WWW-Authenticate", `Basic realm="Transmission VPN RPC", charset="UTF-8"`)
	writeError(responseWriter, http.StatusUnauthorized, "rpc_authentication_required", "Compatible RPC credentials are required.")
}
