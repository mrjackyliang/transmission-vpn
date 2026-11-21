package api

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/clientinfo"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/notifications"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionconfig"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionrpc"
)

const (
	minimumTableFormatRPCVersion = 16
	rpcUnsupportedMethodResult   = "method not supported by transmission-vpn"
)

const (
	// maximumRPCRequestBytes caps one compatible RPC request body.
	//
	// The method is only known after the body is read, so every call shares the cap
	// that fits a torrent-add carrying a 16 MiB .torrent file.
	//
	// Since: 2.3.0
	maximumRPCRequestBytes = maximumTorrentAddRequestBytes

	// rpcRequestTooLargeResult answers a compatible RPC body over the cap.
	//
	// Remote apps show the result string, so it names the .torrent file limit that
	// a person adding a torrent can act on.
	//
	// Since: 2.3.0
	rpcRequestTooLargeResult = "The request is larger than 23 MiB. A .torrent file can be up to 16 MiB."
)

// handleRPCProxy authenticates a dedicated login before serving the RPC facade.
//
// Third-party applications use Basic authentication with an independently revocable
// RPC username and generated password. API tokens are never accepted on this route.
// Any method passes the same login and session checks, so a GET handshake gets the
// 409 session reply, but only POST carries a call, as with Transmission itself.
//
// Since: 2.2.1
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
	if request.Method != http.MethodPost {
		responseWriter.Header().Set("Allow", http.MethodPost)
		writeError(responseWriter, http.StatusMethodNotAllowed, "method_not_allowed", "Transmission RPC calls use POST.")

		return
	}

	server.serveRPCFacade(responseWriter, request)
}

func (server *Server) rpcSessionID(loginID string) string {
	digest := hmac.New(sha256.New, server.rpcSessionSecret)
	_, _ = digest.Write([]byte(loginID))

	return hex.EncodeToString(digest.Sum(nil))
}

// serveRPCFacade reads one bounded compatible RPC call and answers it.
//
// A body over the cap gets a result string naming the limit instead of the generic
// invalid-request answer, because remote apps show that string to the person.
//
// Since: 2.3.0
func (server *Server) serveRPCFacade(responseWriter http.ResponseWriter, request *http.Request) {
	request.Body = http.MaxBytesReader(responseWriter, request.Body, maximumRPCRequestBytes)
	decoder := json.NewDecoder(request.Body)
	decoder.UseNumber()
	var envelope transmissionrpc.LegacyRequest
	if err := decoder.Decode(&envelope); err != nil {
		server.writeRPCFacadeResponse(responseWriter, map[string]any{}, rpcDecodeResult(err), nil)

		return
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		server.writeRPCFacadeResponse(responseWriter, map[string]any{}, rpcDecodeResult(err), envelope.Tag)

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

// rpcDecodeResult names why a compatible RPC body couldn't be read.
//
// An oversized body names the size limit; anything else, including a nil error for
// a second JSON value, keeps the generic invalid-request result.
//
// Since: 2.3.0
func rpcDecodeResult(err error) string {
	var maximumBytesError *http.MaxBytesError
	if errors.As(err, &maximumBytesError) {
		return rpcRequestTooLargeResult
	}

	return "invalid Transmission RPC request"
}

func (server *Server) writeRPCFacadeResponse(
	responseWriter http.ResponseWriter,
	arguments any,
	result string,
	tag json.RawMessage,
) {
	response := map[string]any{
		transmissionrpc.ResponseArguments: arguments,
		transmissionrpc.ResponseResult:    result,
	}
	if len(tag) > 0 {
		var decodedTag any
		decoder := json.NewDecoder(strings.NewReader(string(tag)))
		decoder.UseNumber()
		if decoder.Decode(&decodedTag) == nil {
			response[transmissionrpc.ResponseTag] = decodedTag
		}
	}
	writeJSON(responseWriter, http.StatusOK, response)
}

// callRPCFacade dispatches one compatible RPC call to application-owned behavior.
//
// Torrent methods retain connection routing, while blocklist-update is intercepted
// for the merger and never reaches a native daemon.
//
// Since: 2.0.0
func (server *Server) callRPCFacade(
	ctx context.Context,
	method string,
	arguments map[string]any,
) (any, string) {
	nativeMethod := transmissionrpc.Method(method)
	if nativeMethod == transmissionrpc.MethodTorrentSetLocation {
		return map[string]any{}, "Change the torrent's profile in the console to move it."
	}
	normalizedArguments, validationResult := normalizeRPCFacadeArguments(method, arguments)
	if validationResult != "success" {
		return map[string]any{}, validationResult
	}
	arguments = normalizedArguments
	if nativeMethod == transmissionrpc.MethodTorrentSet {
		if labelsValue, found := arguments[transmissionrpc.ArgumentLabels]; found {
			labels, valid := rpcStringList(labelsValue)
			if !valid {
				return map[string]any{}, "labels must be an array of strings"
			}
			if err := validateLabels(labels); err != nil {
				return map[string]any{}, err.Error()
			}
			arguments[transmissionrpc.ArgumentLabels] = labels
		}
	}
	if validationResult := server.validateRPCFacadeDownloadPaths(
		ctx,
		method,
		arguments,
	); validationResult != "success" {
		return map[string]any{}, validationResult
	}

	switch nativeMethod {
	case transmissionrpc.MethodTorrentGet:
		return server.rpcFacadeTorrentGet(ctx, arguments)
	case transmissionrpc.MethodTorrentAdd:
		return server.rpcFacadeTorrentAdd(ctx, arguments)
	case transmissionrpc.MethodTorrentRemove:
		return server.rpcFacadeTorrentRemove(ctx, arguments)
	case transmissionrpc.MethodTorrentSet,
		transmissionrpc.MethodTorrentStart,
		transmissionrpc.MethodTorrentStartNow,
		transmissionrpc.MethodTorrentStop,
		transmissionrpc.MethodTorrentVerify,
		transmissionrpc.MethodTorrentReannounce,
		transmissionrpc.MethodTorrentRenamePath,
		transmissionrpc.MethodQueueMoveTop,
		transmissionrpc.MethodQueueMoveUp,
		transmissionrpc.MethodQueueMoveDown,
		transmissionrpc.MethodQueueMoveBottom:
		return server.rpcFacadeRoutedCall(ctx, method, arguments)
	case transmissionrpc.MethodSessionStatistics:
		statistics, errorCodes := server.summedTransmissionStatistics(ctx)
		if len(errorCodes) > 0 {
			return map[string]any{}, "Transmission is unavailable for one or more connections"
		}

		return statistics, "success"
	case transmissionrpc.MethodSessionGet,
		transmissionrpc.MethodFreeSpace,
		transmissionrpc.MethodPortTest,
		transmissionrpc.MethodGroupGet:
		return server.rpcFacadeDefaultCall(ctx, method, arguments)
	case transmissionrpc.MethodSessionSet, transmissionrpc.MethodGroupSet:
		return server.rpcFacadeEveryCall(ctx, method, arguments)
	case transmissionrpc.MethodBlocklistUpdate:
		return server.rpcFacadeBlocklistUpdate(ctx)
	case transmissionrpc.MethodSessionClose:
		return map[string]any{}, transmissionrpc.MethodSessionClose.String() + " is not supported by transmission-vpn"
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
	selectionValue, selectionPresent := arguments[transmissionrpc.ArgumentIDs]
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
		result := server.mergedTorrents(ctx, []transmissionrpc.TorrentField{
			transmissionrpc.TorrentFieldHashString,
			transmissionrpc.TorrentFieldID,
		}, nil)
		if rpcFacadeTorrentResultUnavailable(result.Errors) {
			return map[string]any{}, "Transmission is unavailable for one or more connections"
		}
		for _, torrent := range result.Torrents {
			if hash, valid := torrent[string(transmissionrpc.TorrentFieldHashString)].(string); valid && hash != "" {
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
				resolved := server.mergedTorrents(ctx, []transmissionrpc.TorrentField{
					transmissionrpc.TorrentFieldHashString,
					transmissionrpc.TorrentFieldID,
				}, selected)
				if rpcFacadeTorrentResultUnavailable(resolved.Errors) {
					return map[string]any{}, "Transmission is unavailable for one or more connections"
				}
				for _, torrent := range resolved.Torrents {
					if hash, valid := torrent[string(transmissionrpc.TorrentFieldHashString)].(string); valid && hash != "" {
						appendHash(hash)
					}
				}
			}
		}
	}

	response, result := server.rpcFacadeRoutedCall(ctx, transmissionrpc.MethodTorrentRemove.String(), arguments)
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
		canonicalKey := transmissionrpc.CanonicalArgumentKey(key)
		if _, duplicate := canonicalKeys[canonicalKey]; duplicate {
			return nil, "duplicate Transmission RPC argument " + canonicalKey
		}
		canonicalKeys[canonicalKey] = key
	}

	pathKeys := []string{}
	switch transmissionrpc.Method(method) {
	case transmissionrpc.MethodSessionSet:
		normalized = make(map[string]any, len(arguments))
		for canonicalKey, originalKey := range canonicalKeys {
			upstreamKey, allowed := transmissionrpc.SessionSetArgumentKey(canonicalKey)
			if !allowed {
				return nil, canonicalKey + " is not supported for " + transmissionrpc.MethodSessionSet.String() + " by transmission-vpn"
			}
			normalized[upstreamKey] = arguments[originalKey]
		}
		pathKeys = []string{transmissionrpc.ArgumentDownloadDirectory, transmissionrpc.ArgumentIncompleteDirectory}
	case transmissionrpc.MethodTorrentAdd:
		if originalKey, found := canonicalKeys[transmissionrpc.ArgumentDownloadDirectory]; found && originalKey != transmissionrpc.ArgumentDownloadDirectory {
			normalized[transmissionrpc.ArgumentDownloadDirectory] = normalized[originalKey]
			delete(normalized, originalKey)
		}
	case transmissionrpc.MethodTorrentSet, transmissionrpc.MethodTorrentSetLocation:
		if originalKey, found := canonicalKeys[transmissionrpc.ArgumentLocation]; found && originalKey != transmissionrpc.ArgumentLocation {
			normalized[transmissionrpc.ArgumentLocation] = normalized[originalKey]
			delete(normalized, originalKey)
		}
		pathKeys = []string{transmissionrpc.ArgumentLocation}
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

func (server *Server) rpcFacadeTorrentGet(
	ctx context.Context,
	arguments map[string]any,
) (any, string) {
	fields, valid := rpcStringList(arguments[transmissionrpc.ArgumentFields])
	if !valid || len(fields) == 0 {
		return map[string]any{}, transmissionrpc.MethodTorrentGet.String() + " requires a fields array"
	}
	format := "objects"
	if value, found := arguments[transmissionrpc.ArgumentFormat]; found {
		format, valid = value.(string)
		if !valid || format != "objects" && format != "table" {
			return map[string]any{}, transmissionrpc.MethodTorrentGet.String() + " format must be objects or table"
		}
	}
	if format == "table" {
		if supported, result := server.rpcTableFormatSupported(ctx); !supported {
			return map[string]any{}, result
		}
	}

	selections, recentlyActive, result := rpcTorrentSelections(arguments[transmissionrpc.ArgumentIDs])
	if result != "success" {
		return map[string]any{}, result
	}
	requestedID := stringInSlice(fields, string(transmissionrpc.TorrentFieldID))
	requestedHash := stringInSlice(fields, string(transmissionrpc.TorrentFieldHashString))
	upstreamFields := append([]string(nil), fields...)
	if !requestedID {
		upstreamFields = append(upstreamFields, string(transmissionrpc.TorrentFieldID))
	}
	if !requestedHash {
		upstreamFields = append(upstreamFields, string(transmissionrpc.TorrentFieldHashString))
	}

	merged := mergedTorrentResult{Torrents: []map[string]any{}, Removed: []int64{}, Complete: true}
	seen := map[int64]struct{}{}
	for _, selection := range selections {
		partial := server.mergedTorrents(ctx, transmissionrpc.TorrentFields(upstreamFields), selection)
		if rpcFacadeTorrentResultUnavailable(partial.Errors) {
			return map[string]any{}, "Transmission is unavailable for one or more connections"
		}
		for _, skipped := range partial.Errors {
			server.logger.Warn(
				"compatible RPC skipped unknown torrent",
				"method",
				transmissionrpc.MethodTorrentGet.String(),
				"torrent",
				skipped,
			)
		}
		for _, torrent := range partial.Torrents {
			identifier, identifierValid := integerValue(torrent[string(transmissionrpc.TorrentFieldID)])
			if identifierValid {
				if _, duplicate := seen[identifier]; duplicate {
					continue
				}
				seen[identifier] = struct{}{}
			}
			delete(torrent, "connectionId")
			if !requestedID {
				delete(torrent, string(transmissionrpc.TorrentFieldID))
			}
			if !requestedHash {
				delete(torrent, string(transmissionrpc.TorrentFieldHashString))
			}
			merged.Torrents = append(merged.Torrents, torrent)
		}
		merged.Removed = append(merged.Removed, partial.Removed...)
	}
	sort.SliceStable(merged.Torrents, func(left int, right int) bool {
		leftID, leftValid := integerValue(merged.Torrents[left][string(transmissionrpc.TorrentFieldID)])
		rightID, rightValid := integerValue(merged.Torrents[right][string(transmissionrpc.TorrentFieldID)])

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
		response[transmissionrpc.ResponseTorrents] = table
	} else {
		response[transmissionrpc.ResponseTorrents] = merged.Torrents
	}
	if recentlyActive {
		sort.Slice(merged.Removed, func(left int, right int) bool {
			return merged.Removed[left] < merged.Removed[right]
		})
		response[transmissionrpc.ResponseRemoved] = merged.Removed
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

		return nil, false, transmissionrpc.MethodTorrentGet.String() + " ids contains an unsupported value"
	}
	if identifier, valid := rpcPositiveInteger(value); valid {
		return []any{[]int64{identifier}}, false, "success"
	}
	values, ok := value.([]any)
	if !ok {
		return nil, false, transmissionrpc.MethodTorrentGet.String() + " ids must be an integer, hash, array, or recently-active"
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
			return nil, false, transmissionrpc.MethodTorrentGet.String() + " ids contains an invalid torrent identifier"
		}
		normalized, err := normalizeTorrentHashes([]string{hash})
		if err != nil {
			return nil, false, transmissionrpc.MethodTorrentGet.String() + " ids contains an invalid torrent hash"
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
		session, err := daemon.Client.GetSession(ctx, transmissionrpc.GetSessionRequest{})
		if err != nil {
			return false, "Transmission is unavailable while checking table support"
		}
		var version int64
		if err := session.DecodeValue(transmissionrpc.SessionFieldRPCVersion, &version); err != nil ||
			version < minimumTableFormatRPCVersion {
			return false, transmissionrpc.MethodTorrentGet.String() + " table format is not supported by every Transmission daemon"
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
	selectionValue, selectionPresent := baseArguments[transmissionrpc.ArgumentIDs]
	delete(baseArguments, transmissionrpc.ArgumentIDs)

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
				callArguments[transmissionrpc.ArgumentIDs] = call.identifiers
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
	if transmissionrpc.Method(method) == transmissionrpc.MethodTorrentSet && successfulCalls > 0 {
		if labels, changed := baseArguments[transmissionrpc.ArgumentLabels].([]string); changed {
			if _, err := server.saveTorrentLabels(ctx, labels); err != nil {
				server.logInternalError(
					"save labels used by compatible RPC "+transmissionrpc.MethodTorrentSet.String(),
					err,
				)

				return map[string]any{}, "The torrent labels could not be saved"
			}
		}
	}

	merged := map[string]any{}
	for index, err := range errorsByCall {
		if err != nil {
			return map[string]any{}, server.rpcFacadeCallError(method, calls[index].daemon.ConnectionID, err)
		}
		if transmissionrpc.Method(method) == transmissionrpc.MethodTorrentRenamePath {
			if daemonID, valid := integerValue(results[index][string(transmissionrpc.TorrentFieldID)]); valid {
				facadeID, facadeError := transmissionrpc.FacadeID(calls[index].daemon.Slot, daemonID)
				if facadeError != nil {
					return map[string]any{}, "Transmission returned an invalid torrent identifier"
				}
				results[index][string(transmissionrpc.TorrentFieldID)] = facadeID
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
// Since: 2.0.0
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
	if transmissionrpc.Method(method) == transmissionrpc.MethodSessionSet {
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
// Since: 2.0.0
func (server *Server) rpcFacadeBlocklistUpdate(ctx context.Context) (any, string) {
	requestedAt, err := server.requestBlocklistUpdate(ctx)
	if err != nil {
		return map[string]any{}, "blocklist update failed: " + err.Error()
	}

	totalRanges, err := server.waitForBlocklistUpdate(ctx, requestedAt)
	if err != nil {
		return map[string]any{}, "blocklist update failed: " + err.Error()
	}

	return map[string]any{transmissionrpc.ResponseBlocklistSize: totalRanges}, "success"
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
	filename, hasFilename := addArguments[transmissionrpc.ArgumentFilename].(string)
	metainfo, hasMetainfo := addArguments[transmissionrpc.ArgumentMetainfo].(string)
	if hasFilename == hasMetainfo || hasFilename && strings.TrimSpace(filename) == "" ||
		hasMetainfo && strings.TrimSpace(metainfo) == "" {
		return map[string]any{}, transmissionrpc.MethodTorrentAdd.String() + " requires exactly one filename or metainfo"
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
		if torrentMetainfoTooLarge(decodedMetainfo) {
			return map[string]any{}, torrentFileTooLargeMessage
		}
	}
	if labelsValue, found := addArguments[transmissionrpc.ArgumentLabels]; found {
		labels, valid := rpcStringList(labelsValue)
		if !valid {
			return map[string]any{}, "labels must be an array of strings"
		}
		if err := validateLabels(labels); err != nil {
			return map[string]any{}, err.Error()
		}
		addArguments[transmissionrpc.ArgumentLabels] = labels
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
	normalizedDownloadDirectory, err := downloadPolicy.normalizeDownloadDirectory(
		profile.DownloadDirectory,
	)
	if err != nil {
		return map[string]any{}, err.Error()
	}
	addArguments[transmissionrpc.ArgumentDownloadDirectory] = normalizedDownloadDirectory
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
	if _, found := addArguments[transmissionrpc.ArgumentLabels]; found {
		requestedLabels, _ = rpcStringList(addArguments[transmissionrpc.ArgumentLabels])
	}
	mergedLabels, err := mergeTorrentLabels(requestedLabels, profile.Labels)
	if err != nil {
		return map[string]any{}, err.Error()
	}
	addArguments[transmissionrpc.ArgumentLabels] = nonNilStrings(mergedLabels)
	if _, found := addArguments[transmissionrpc.ArgumentPaused]; !found {
		addArguments[transmissionrpc.ArgumentPaused] = profile.StartPaused
	}
	if needsProfile {
		addArguments[transmissionrpc.ArgumentPaused] = true
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
			return map[string]any{
				transmissionrpc.ResponseTorrentDuplicate: rpcTorrentAddItem(
					existing.FacadeID,
					sourceHash,
					existing.Name,
				),
			}, "success"
		}
	}
	if !hashKnown {
		if pausedValue, found := addArguments[transmissionrpc.ArgumentPaused]; found {
			if _, valid := pausedValue.(bool); !valid {
				return map[string]any{}, "paused must be a boolean"
			}
		}
	}
	startAfterDuplicateCheck := false
	if !hashKnown {
		if pausedValue, found := addArguments[transmissionrpc.ArgumentPaused]; found {
			startAfterDuplicateCheck = !pausedValue.(bool)
		} else {
			session, sessionError := target.Client.GetSession(
				ctx,
				transmissionrpc.GetSessionRequest{Fields: []transmissionrpc.SessionField{
					transmissionrpc.SessionFieldStartAddedTorrents,
				}},
			)
			if sessionError != nil {
				return map[string]any{}, server.rpcFacadeCallError(
					transmissionrpc.MethodSessionGet.String(),
					target.ConnectionID,
					fmt.Errorf("read Transmission start-added-torrents: %w", sessionError),
				)
			}
			if decodeError := session.DecodeValue(
				transmissionrpc.SessionFieldStartAddedTorrents,
				&startAfterDuplicateCheck,
			); decodeError != nil {
				return map[string]any{}, server.rpcFacadeCallError(
					transmissionrpc.MethodSessionGet.String(),
					target.ConnectionID,
					fmt.Errorf("decode Transmission start-added-torrents: %w", decodeError),
				)
			}
		}
		addArguments[transmissionrpc.ArgumentPaused] = true
	}

	var result torrentAddRPCResult
	if err := target.Client.Call(ctx, transmissionrpc.MethodTorrentAdd.String(), addArguments, &result); err != nil {
		return map[string]any{}, server.rpcFacadeCallError(
			transmissionrpc.MethodTorrentAdd.String(),
			target.ConnectionID,
			err,
		)
	}
	if result.Added == nil && result.Duplicate == nil || result.Added != nil && result.Duplicate != nil {
		return map[string]any{}, "Transmission returned an invalid " + transmissionrpc.MethodTorrentAdd.String() + " response"
	}
	added := result.Added
	duplicate := false
	responseKey := transmissionrpc.ResponseTorrentAdded
	if result.Duplicate != nil {
		added = result.Duplicate
		duplicate = true
		responseKey = transmissionrpc.ResponseTorrentDuplicate
	}
	if added.ID <= 0 || strings.TrimSpace(added.HashString) == "" {
		return map[string]any{}, "Transmission returned an invalid " + transmissionrpc.MethodTorrentAdd.String() + " response"
	}
	added.HashString = strings.ToLower(added.HashString)
	facadeID, err := transmissionrpc.FacadeID(target.Slot, added.ID)
	if err != nil {
		return map[string]any{}, "Transmission returned an invalid torrent identifier"
	}
	if existing, found := refreshedLocations[added.HashString]; found && existing.ConnectionID != target.ConnectionID {
		removeError := target.Client.RemoveTorrents(ctx, transmissionrpc.RemoveTorrentsRequest{
			IDs:             []int64{added.ID},
			DeleteLocalData: false,
		})
		if removeError != nil {
			return map[string]any{}, "The cross-connection duplicate could not be removed"
		}

		return map[string]any{
			transmissionrpc.ResponseTorrentDuplicate: rpcTorrentAddItem(
				existing.FacadeID,
				added.HashString,
				existing.Name,
			),
		}, "success"
	}
	if !duplicate {
		labels, _ := rpcStringList(addArguments[transmissionrpc.ArgumentLabels])
		if _, err := server.saveTorrentLabels(ctx, labels); err != nil {
			server.logInternalError(
				"save labels used by compatible RPC "+transmissionrpc.MethodTorrentAdd.String(),
				err,
			)

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
					transmissionrpc.MethodTorrentGet.String(),
					target.ConnectionID,
					labelError,
				)
			}
			duplicateLabels, labelError = mergeTorrentLabels(existingLabels, mergedLabels)
			if labelError != nil {
				return map[string]any{}, labelError.Error()
			}
			profileArguments.Changes[transmissionrpc.TorrentArgumentLabels] = duplicateLabels
		}
		if err := target.Client.SetTorrents(profileContext, profileArguments); err != nil {
			return map[string]any{}, server.rpcFacadeCallError(
				transmissionrpc.MethodTorrentSet.String(),
				target.ConnectionID,
				err,
			)
		}
		if duplicate {
			if _, err := server.saveTorrentLabels(profileContext, duplicateLabels); err != nil {
				server.logInternalError("save profile labels used by compatible RPC duplicate", err)

				return map[string]any{}, "The torrent labels could not be saved"
			}
		}
		if profile.Options.Queue == "top" {
			if err := target.Client.MoveTorrentsToQueueTop(
				profileContext,
				transmissionrpc.TorrentSelectionRequest{IDs: []int64{added.ID}},
			); err != nil {
				return map[string]any{}, server.rpcFacadeCallError(
					transmissionrpc.MethodQueueMoveTop.String(),
					target.ConnectionID,
					err,
				)
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
		if err := target.Client.StartTorrents(
			startContext,
			transmissionrpc.TorrentSelectionRequest{IDs: []int64{added.ID}},
		); err != nil {
			return map[string]any{}, server.rpcFacadeCallError(
				transmissionrpc.MethodTorrentStart.String(),
				target.ConnectionID,
				err,
			)
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
	return map[string]any{
		string(transmissionrpc.TorrentFieldID):         identifier,
		string(transmissionrpc.TorrentFieldHashString): hash,
		string(transmissionrpc.TorrentFieldName):       name,
	}
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
	if requestedDirectory, valid := arguments[transmissionrpc.ArgumentDownloadDirectory].(string); valid {
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

	if requestedLabels, valid := rpcStringList(arguments[transmissionrpc.ArgumentLabels]); valid {
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
	response, err := daemon.Client.ListTorrents(ctx, transmissionrpc.ListTorrentsRequest{
		Fields: []transmissionrpc.TorrentField{transmissionrpc.TorrentFieldLabels},
		IDs:    []int64{id},
	})
	if err != nil {
		return nil, err
	}
	if len(response.Torrents) != 1 {
		return nil, errors.New("duplicate torrent labels are unavailable")
	}

	var labels []string
	if err := response.Torrents[0].DecodeValue(transmissionrpc.TorrentFieldLabels, &labels); err != nil {
		return nil, err
	}

	return labels, nil
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
