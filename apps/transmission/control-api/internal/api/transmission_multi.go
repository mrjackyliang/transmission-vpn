package api

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionrpc"
)

// torrentLocation records where one globally unique info hash currently lives.
type torrentLocation struct {
	ConnectionID string
	FacadeID     int64
	Name         string
}

// mergedTorrentResult is one partial-tolerant fan-out result.
type mergedTorrentResult struct {
	Torrents              []map[string]any
	Removed               []int64
	Errors                []string
	Complete              bool
	HashLocations         map[string]torrentLocation
	UnansweredConnections []string
}

// daemonTorrentResult owns one indexed parallel RPC result.
type daemonTorrentResult struct {
	Daemon   transmissionrpc.Daemon
	Torrents []map[string]any
	Removed  []int64
	Error    error
}

var (
	errTorrentSelectionNotFound      = errors.New("torrent selection was not found")
	errTorrentSelectionUnavailable   = errors.New("torrent selection is unavailable")
	errTransmissionDaemonUnavailable = errors.New("Transmission daemon is unavailable")
	errVPNConnectionRequired         = errors.New("a VPN connection is required")
)

// torrentOperationFailure maps one daemon failure back to every requested torrent.
type torrentOperationFailure struct {
	Index      int
	Identifier string
	Error      error
}

// torrentCallGroup is one daemon's normalized local IDs or stable hashes.
type torrentCallGroup struct {
	Daemon      transmissionrpc.Daemon
	Identifiers any
	Indexes     []int
	Labels      []string
}

// transmissionDaemons returns the current multi-client set or the legacy test client.
func (server *Server) transmissionDaemons(ctx context.Context) []transmissionrpc.Daemon {
	if server.transmissionClients != nil {
		return server.transmissionClients.Snapshot()
	}
	if server.transmission == nil {
		return []transmissionrpc.Daemon{}
	}

	daemon := transmissionrpc.Daemon{
		Slot:     0,
		PeerPort: storage.DefaultVPNPeerPort,
		Default:  true,
		Client:   server.transmission,
	}
	connection, err := server.store.DefaultVPNConnection(ctx)
	if err == nil {
		daemon.ConnectionID = connection.ID
		daemon.PeerPort = connection.PeerPort
	}

	return []transmissionrpc.Daemon{daemon}
}

// mergedTorrents queries the selected daemons in parallel and applies facade IDs.
func (server *Server) mergedTorrents(
	ctx context.Context,
	fields []string,
	selection any,
) mergedTorrentResult {
	daemons := server.transmissionDaemons(ctx)
	argumentsByConnection := make(map[string]map[string]any, len(daemons))
	selectedDaemons := make([]transmissionrpc.Daemon, 0, len(daemons))
	result := mergedTorrentResult{
		Torrents:      []map[string]any{},
		Removed:       []int64{},
		Errors:        []string{},
		Complete:      true,
		HashLocations: map[string]torrentLocation{},
	}

	switch identifiers := selection.(type) {
	case []int64:
		localIDsBySlot := map[int][]int64{}
		for _, facadeID := range identifiers {
			slot, daemonID, err := transmissionrpc.SplitFacadeID(facadeID)
			if err != nil {
				result.Errors = append(result.Errors, "torrent-id-invalid:"+strconv.FormatInt(facadeID, 10))
				result.Complete = false

				continue
			}
			localIDsBySlot[slot] = append(localIDsBySlot[slot], daemonID)
		}
		for _, daemon := range daemons {
			localIDs, found := localIDsBySlot[daemon.Slot]
			if !found {
				continue
			}
			selectedDaemons = append(selectedDaemons, daemon)
			argumentsByConnection[daemon.ConnectionID] = map[string]any{
				"fields": fields,
				"ids":    localIDs,
			}
			delete(localIDsBySlot, daemon.Slot)
		}
		for slot, localIDs := range localIDsBySlot {
			for _, localID := range localIDs {
				facadeID, _ := transmissionrpc.FacadeID(slot, localID)
				result.Errors = append(result.Errors, "torrent-connection-missing:"+strconv.FormatInt(facadeID, 10))
				result.Complete = false
			}
		}
	case []string:
		selectedDaemons = append(selectedDaemons, daemons...)
		for _, daemon := range selectedDaemons {
			argumentsByConnection[daemon.ConnectionID] = map[string]any{
				"fields": fields,
				"ids":    identifiers,
			}
		}
	case string:
		selectedDaemons = append(selectedDaemons, daemons...)
		for _, daemon := range selectedDaemons {
			argumentsByConnection[daemon.ConnectionID] = map[string]any{
				"fields": fields,
				"ids":    identifiers,
			}
		}
	default:
		selectedDaemons = append(selectedDaemons, daemons...)
		for _, daemon := range selectedDaemons {
			argumentsByConnection[daemon.ConnectionID] = map[string]any{"fields": fields}
		}
	}

	results := make([]daemonTorrentResult, len(selectedDaemons))
	var waitGroup sync.WaitGroup
	for index, daemon := range selectedDaemons {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()

			var response struct {
				Torrents []map[string]any `json:"torrents"`
				Removed  []int64          `json:"removed"`
			}
			err := daemon.Client.Call(
				ctx,
				"torrent-get",
				argumentsByConnection[daemon.ConnectionID],
				&response,
			)
			results[index] = daemonTorrentResult{
				Daemon:   daemon,
				Torrents: response.Torrents,
				Removed:  response.Removed,
				Error:    err,
			}
		}()
	}
	waitGroup.Wait()

	locationsByConnection := map[string]map[string]torrentLocation{}
	connectionsByHash := map[string]map[string]struct{}{}
	for _, daemonResult := range results {
		if daemonResult.Error != nil {
			server.logInternalError(
				"list Transmission torrents for connection "+daemonResult.Daemon.ConnectionID,
				daemonResult.Error,
			)
			result.Errors = append(
				result.Errors,
				"torrents-unavailable:"+daemonResult.Daemon.ConnectionID,
			)
			result.Complete = false

			continue
		}

		converted := make([]map[string]any, 0, len(daemonResult.Torrents))
		daemonLocations := make(map[string]torrentLocation, len(daemonResult.Torrents))
		conversionFailed := false
		for _, torrent := range daemonResult.Torrents {
			daemonID, valid := integerValue(torrent["id"])
			if !valid {
				server.logger.Error(
					"Transmission returned an invalid torrent ID",
					"connectionId",
					daemonResult.Daemon.ConnectionID,
				)
				conversionFailed = true

				break
			}
			facadeID, err := transmissionrpc.FacadeID(daemonResult.Daemon.Slot, daemonID)
			if err != nil {
				server.logger.Error(
					"Transmission daemon ID exceeds the facade limit",
					"connectionId",
					daemonResult.Daemon.ConnectionID,
					"daemonId",
					daemonID,
					"error",
					err,
				)
				conversionFailed = true

				break
			}

			torrent["id"] = facadeID
			torrent["connectionId"] = daemonResult.Daemon.ConnectionID
			converted = append(converted, torrent)
			hash, _ := torrent["hashString"].(string)
			if hash != "" {
				hash = strings.ToLower(hash)
				name, _ := torrent["name"].(string)
				location := torrentLocation{
					ConnectionID: daemonResult.Daemon.ConnectionID,
					FacadeID:     facadeID,
					Name:         name,
				}
				daemonLocations[hash] = location
				if connectionsByHash[hash] == nil {
					connectionsByHash[hash] = map[string]struct{}{}
				}
				connectionsByHash[hash][daemonResult.Daemon.ConnectionID] = struct{}{}
			}
		}
		if conversionFailed {
			result.Errors = append(
				result.Errors,
				"torrents-invalid:"+daemonResult.Daemon.ConnectionID,
			)
			result.Complete = false

			continue
		}
		locationsByConnection[daemonResult.Daemon.ConnectionID] = daemonLocations
		result.Torrents = append(result.Torrents, converted...)
		for _, daemonID := range daemonResult.Removed {
			facadeID, err := transmissionrpc.FacadeID(daemonResult.Daemon.Slot, daemonID)
			if err != nil {
				result.Errors = append(result.Errors, "removed-torrent-invalid:"+daemonResult.Daemon.ConnectionID)
				result.Complete = false

				continue
			}
			result.Removed = append(result.Removed, facadeID)
		}
	}
	sort.Slice(result.Removed, func(left int, right int) bool {
		return result.Removed[left] < result.Removed[right]
	})
	for hash, connectionSet := range connectionsByHash {
		if len(connectionSet) < 2 {
			continue
		}
		result.Errors = append(
			result.Errors,
			"duplicate-torrent:"+hash,
		)
	}
	sort.Strings(result.Errors)

	if selection == nil {
		result.HashLocations, result.UnansweredConnections = server.updateTorrentHashIndex(
			daemons,
			locationsByConnection,
		)
	}

	return result
}

// callTransmissionBySelection routes IDs or hashes and invokes one RPC per daemon.
func (server *Server) callTransmissionBySelection(
	ctx context.Context,
	method string,
	arguments map[string]any,
	identifiers []int64,
	hashes []string,
) ([]torrentOperationFailure, error) {
	groups, err := server.resolveTorrentCallGroups(ctx, identifiers, hashes)
	if err != nil {
		return nil, err
	}

	failures := []torrentOperationFailure{}
	var failureMutex sync.Mutex
	var waitGroup sync.WaitGroup
	for _, group := range groups {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()

			localArguments := make(map[string]any, len(arguments)+1)
			for key, value := range arguments {
				localArguments[key] = value
			}
			localArguments["ids"] = group.Identifiers
			callError := group.Daemon.Client.Call(ctx, method, localArguments, nil)
			if callError == nil {
				return
			}

			failureMutex.Lock()
			for index, selectionIndex := range group.Indexes {
				failures = append(failures, torrentOperationFailure{
					Index:      selectionIndex,
					Identifier: group.Labels[index],
					Error:      callError,
				})
			}
			failureMutex.Unlock()
		}()
	}
	waitGroup.Wait()
	sort.Slice(failures, func(left int, right int) bool {
		return failures[left].Index < failures[right].Index
	})

	return failures, nil
}

// resolveRPCFacadeIDGroups routes valid facade IDs and skips stale client selections.
func (server *Server) resolveRPCFacadeIDGroups(
	ctx context.Context,
	method string,
	identifiers []int64,
) []torrentCallGroup {
	result := server.mergedTorrents(ctx, []string{"hashString", "id"}, identifiers)
	for _, errorCode := range result.Errors {
		server.logger.Warn(
			"compatible RPC skipped unavailable torrent selection",
			"method", method,
			"torrent", errorCode,
		)
	}
	daemonsByConnection := map[string]transmissionrpc.Daemon{}
	for _, daemon := range server.transmissionDaemons(ctx) {
		daemonsByConnection[daemon.ConnectionID] = daemon
	}
	type facadeGroup struct {
		group    torrentCallGroup
		localIDs []int64
		seen     map[int64]struct{}
	}
	groupsByConnection := map[string]*facadeGroup{}
	found := map[int64]struct{}{}
	for _, torrent := range result.Torrents {
		facadeID, valid := integerValue(torrent["id"])
		connectionID, _ := torrent["connectionId"].(string)
		daemon, daemonFound := daemonsByConnection[connectionID]
		if !valid || !daemonFound {
			continue
		}
		_, daemonID, err := transmissionrpc.SplitFacadeID(facadeID)
		if err != nil {
			continue
		}
		found[facadeID] = struct{}{}
		group := groupsByConnection[connectionID]
		if group == nil {
			group = &facadeGroup{
				group: torrentCallGroup{Daemon: daemon},
				seen:  map[int64]struct{}{},
			}
			groupsByConnection[connectionID] = group
		}
		if _, duplicate := group.seen[facadeID]; duplicate {
			continue
		}
		group.seen[facadeID] = struct{}{}
		group.localIDs = append(group.localIDs, daemonID)
	}
	for _, facadeID := range identifiers {
		if _, exists := found[facadeID]; !exists {
			server.logger.Warn(
				"compatible RPC skipped unknown torrent",
				"method", method,
				"torrent", strconv.FormatInt(facadeID, 10),
			)
		}
	}
	groups := make([]torrentCallGroup, 0, len(groupsByConnection))
	for _, group := range groupsByConnection {
		group.group.Identifiers = group.localIDs
		groups = append(groups, group.group)
	}
	sort.Slice(groups, func(left int, right int) bool {
		return groups[left].Daemon.Slot < groups[right].Daemon.Slot
	})

	return groups
}

// resolveRPCFacadeHashGroups acts on hashes found by every daemon that answered.
func (server *Server) resolveRPCFacadeHashGroups(
	ctx context.Context,
	method string,
	hashes []string,
) []torrentCallGroup {
	result := server.mergedTorrents(ctx, []string{"hashString", "id"}, hashes)
	for _, errorCode := range result.Errors {
		server.logger.Warn(
			"compatible RPC skipped unavailable torrent selection",
			"method", method,
			"torrent", errorCode,
		)
	}
	daemonsByConnection := map[string]transmissionrpc.Daemon{}
	for _, daemon := range server.transmissionDaemons(ctx) {
		daemonsByConnection[daemon.ConnectionID] = daemon
	}
	requested := make(map[string]struct{}, len(hashes))
	for _, hash := range hashes {
		requested[hash] = struct{}{}
	}
	type hashGroup struct {
		group  torrentCallGroup
		hashes []string
		seen   map[string]struct{}
	}
	groupsByConnection := map[string]*hashGroup{}
	found := map[string]struct{}{}
	for _, torrent := range result.Torrents {
		hash, _ := torrent["hashString"].(string)
		hash = strings.ToLower(hash)
		_, wasRequested := requested[hash]
		connectionID, _ := torrent["connectionId"].(string)
		daemon, daemonFound := daemonsByConnection[connectionID]
		if !wasRequested || !daemonFound {
			continue
		}
		found[hash] = struct{}{}
		group := groupsByConnection[connectionID]
		if group == nil {
			group = &hashGroup{
				group: torrentCallGroup{Daemon: daemon},
				seen:  map[string]struct{}{},
			}
			groupsByConnection[connectionID] = group
		}
		if _, duplicate := group.seen[hash]; duplicate {
			continue
		}
		group.seen[hash] = struct{}{}
		group.hashes = append(group.hashes, hash)
	}
	for _, hash := range hashes {
		if _, exists := found[hash]; !exists {
			server.logger.Warn("compatible RPC skipped unknown torrent", "method", method, "torrent", hash)
		}
	}
	groups := make([]torrentCallGroup, 0, len(groupsByConnection))
	for _, group := range groupsByConnection {
		group.group.Identifiers = group.hashes
		groups = append(groups, group.group)
	}
	sort.Slice(groups, func(left int, right int) bool {
		return groups[left].Daemon.Slot < groups[right].Daemon.Slot
	})

	return groups
}

// resolveTorrentCallGroups validates every target before any mutation is sent.
func (server *Server) resolveTorrentCallGroups(
	ctx context.Context,
	identifiers []int64,
	hashes []string,
) ([]torrentCallGroup, error) {
	if hashes != nil {
		return server.resolveTorrentHashGroups(ctx, hashes)
	}

	daemons := server.transmissionDaemons(ctx)
	daemonsBySlot := make(map[int]transmissionrpc.Daemon, len(daemons))
	for _, daemon := range daemons {
		daemonsBySlot[daemon.Slot] = daemon
	}

	type facadeGroup struct {
		group    torrentCallGroup
		localIDs []int64
	}
	groupsBySlot := map[int]*facadeGroup{}
	for index, facadeID := range identifiers {
		slot, daemonID, err := transmissionrpc.SplitFacadeID(facadeID)
		if err != nil {
			return nil, errTorrentSelectionNotFound
		}
		daemon, found := daemonsBySlot[slot]
		if !found {
			return nil, errTorrentSelectionNotFound
		}
		group := groupsBySlot[slot]
		if group == nil {
			group = &facadeGroup{group: torrentCallGroup{Daemon: daemon}}
			groupsBySlot[slot] = group
		}
		group.group.Indexes = append(group.group.Indexes, index)
		group.group.Labels = append(group.group.Labels, strconv.FormatInt(facadeID, 10))
		group.localIDs = append(group.localIDs, daemonID)
	}

	groups := make([]torrentCallGroup, 0, len(groupsBySlot))
	for _, group := range groupsBySlot {
		group.group.Identifiers = group.localIDs
		groups = append(groups, group.group)
	}
	sort.Slice(groups, func(left int, right int) bool {
		return groups[left].Daemon.Slot < groups[right].Daemon.Slot
	})

	return groups, nil
}

// resolveTorrentHashGroups locates every stable hash from current daemon answers.
func (server *Server) resolveTorrentHashGroups(
	ctx context.Context,
	hashes []string,
) ([]torrentCallGroup, error) {
	result := server.mergedTorrents(ctx, []string{"hashString", "id"}, hashes)
	if !result.Complete {
		return nil, errTorrentSelectionUnavailable
	}

	daemonsByConnection := map[string]transmissionrpc.Daemon{}
	for _, daemon := range server.transmissionDaemons(ctx) {
		daemonsByConnection[daemon.ConnectionID] = daemon
	}
	requestedIndexes := make(map[string]int, len(hashes))
	for index, hash := range hashes {
		requestedIndexes[hash] = index
	}

	type hashGroup struct {
		group  torrentCallGroup
		hashes []string
		seen   map[string]struct{}
	}
	groupsByConnection := map[string]*hashGroup{}
	found := make(map[string]struct{}, len(hashes))
	for _, torrent := range result.Torrents {
		hash, _ := torrent["hashString"].(string)
		hash = strings.ToLower(hash)
		index, requested := requestedIndexes[hash]
		connectionID, _ := torrent["connectionId"].(string)
		daemon, daemonFound := daemonsByConnection[connectionID]
		if !requested || !daemonFound {
			continue
		}
		found[hash] = struct{}{}
		group := groupsByConnection[connectionID]
		if group == nil {
			group = &hashGroup{
				group: torrentCallGroup{Daemon: daemon},
				seen:  map[string]struct{}{},
			}
			groupsByConnection[connectionID] = group
		}
		if _, duplicate := group.seen[hash]; duplicate {
			continue
		}
		group.seen[hash] = struct{}{}
		group.hashes = append(group.hashes, hash)
		group.group.Indexes = append(group.group.Indexes, index)
		group.group.Labels = append(group.group.Labels, hash)
	}
	if len(found) != len(hashes) {
		return nil, errTorrentSelectionNotFound
	}

	groups := make([]torrentCallGroup, 0, len(groupsByConnection))
	for _, group := range groupsByConnection {
		group.group.Identifiers = group.hashes
		groups = append(groups, group.group)
	}
	sort.Slice(groups, func(left int, right int) bool {
		return groups[left].Daemon.Slot < groups[right].Daemon.Slot
	})

	return groups, nil
}

// torrentHashesForSelection resolves current facade IDs or stable hashes without
// allowing an invalid target to fall through to a mutating Transmission call.
func (server *Server) torrentHashesForSelection(
	ctx context.Context,
	identifiers []int64,
	hashes []string,
) ([]string, error) {
	selection := any(identifiers)
	if hashes != nil {
		selection = hashes
	} else if _, err := server.resolveTorrentCallGroups(ctx, identifiers, nil); err != nil {
		return nil, err
	}

	result := server.mergedTorrents(ctx, []string{"hashString", "id"}, selection)
	if !result.Complete {
		return nil, errTorrentSelectionUnavailable
	}

	if hashes != nil {
		found := make(map[string]struct{}, len(result.Torrents))
		for _, torrent := range result.Torrents {
			hash, _ := torrent["hashString"].(string)
			if hash != "" {
				found[strings.ToLower(hash)] = struct{}{}
			}
		}
		for _, hash := range hashes {
			if _, exists := found[hash]; !exists {
				return nil, errTorrentSelectionNotFound
			}
		}

		return append([]string(nil), hashes...), nil
	}

	hashesByID := make(map[int64]string, len(result.Torrents))
	for _, torrent := range result.Torrents {
		identifier, identifierValid := integerValue(torrent["id"])
		hash, _ := torrent["hashString"].(string)
		if identifierValid && hash != "" {
			hashesByID[identifier] = strings.ToLower(hash)
		}
	}
	resolved := make([]string, 0, len(identifiers))
	for _, identifier := range identifiers {
		hash, exists := hashesByID[identifier]
		if !exists {
			return nil, errTorrentSelectionNotFound
		}
		resolved = append(resolved, hash)
	}

	return resolved, nil
}

// normalizeTorrentHashes validates and canonicalizes v1 and v2 info hashes.
func normalizeTorrentHashes(hashes []string) ([]string, error) {
	if len(hashes) == 0 || len(hashes) > 1000 {
		return nil, errors.New("hashes must contain between 1 and 1000 torrent hashes")
	}

	normalized := make([]string, 0, len(hashes))
	seen := make(map[string]struct{}, len(hashes))
	for _, hash := range hashes {
		if len(hash) != 40 && len(hash) != 64 {
			return nil, errors.New("torrent hashes must contain 40 or 64 hexadecimal characters")
		}
		if _, err := hex.DecodeString(hash); err != nil {
			return nil, errors.New("torrent hashes must contain 40 or 64 hexadecimal characters")
		}
		hash = strings.ToLower(hash)
		if _, found := seen[hash]; found {
			return nil, errors.New("torrent hashes must not contain duplicates")
		}
		seen[hash] = struct{}{}
		normalized = append(normalized, hash)
	}

	return normalized, nil
}

// writeTorrentOperationFailures emits one issue for every target that failed.
func (server *Server) writeTorrentOperationFailures(
	responseWriter http.ResponseWriter,
	method string,
	field string,
	failures []torrentOperationFailure,
) bool {
	if len(failures) == 0 {
		return false
	}

	issues := make([]validationIssue, 0, len(failures))
	statusCode := http.StatusServiceUnavailable
	for _, failure := range failures {
		message := "Transmission is unavailable for this torrent."
		var resultError *transmissionrpc.ResultError
		if errors.As(failure.Error, &resultError) {
			message = "Transmission rejected the requested operation for this torrent."
			statusCode = http.StatusUnprocessableEntity
		}
		issues = append(issues, validationIssue{
			Field:   field + "." + strconv.Itoa(failure.Index),
			Path:    []string{field, strconv.Itoa(failure.Index)},
			Message: message,
		})
		server.logger.Warn(
			"Transmission torrent operation failed",
			"method",
			method,
			"torrent",
			failure.Identifier,
			"error",
			failure.Error,
		)
	}

	writeJSON(responseWriter, statusCode, errorEnvelope{
		Error: errorBody{
			Code:    "transmission_partial_failure",
			Message: "Transmission could not apply the operation to one or more torrents.",
			Issues:  issues,
		},
	})

	return true
}

// callEveryTransmission invokes one session-wide method on all current daemons.
func (server *Server) callEveryTransmission(
	ctx context.Context,
	method string,
	arguments func(transmissionrpc.Daemon) (any, error),
) map[string]error {
	daemons := server.transmissionDaemons(ctx)
	failures := map[string]error{}
	var failureMutex sync.Mutex
	var waitGroup sync.WaitGroup
	for _, daemon := range daemons {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()

			callArguments, err := arguments(daemon)
			if err == nil {
				err = daemon.Client.Call(ctx, method, callArguments, nil)
			}
			if err != nil {
				failureMutex.Lock()
				failures[daemon.ConnectionID] = err
				failureMutex.Unlock()
			}
		}()
	}
	waitGroup.Wait()

	return failures
}

// writeTransmissionDaemonFailures reports one session-wide failure per connection.
func (server *Server) writeTransmissionDaemonFailures(
	responseWriter http.ResponseWriter,
	method string,
	failures map[string]error,
) bool {
	if len(failures) == 0 {
		return false
	}

	connectionIDs := make([]string, 0, len(failures))
	for connectionID := range failures {
		connectionIDs = append(connectionIDs, connectionID)
	}
	sort.Strings(connectionIDs)
	issues := make([]validationIssue, 0, len(connectionIDs))
	statusCode := http.StatusServiceUnavailable
	for _, connectionID := range connectionIDs {
		err := failures[connectionID]
		message := "Transmission is unavailable for this connection."
		var resultError *transmissionrpc.ResultError
		if errors.As(err, &resultError) {
			message = "Transmission rejected the requested operation for this connection."
			statusCode = http.StatusUnprocessableEntity
		}
		issues = append(issues, validationIssue{
			Field:   "connections." + connectionID,
			Path:    []string{"connections", connectionID},
			Message: message,
		})
		server.logger.Warn(
			"Transmission session operation failed",
			"method",
			method,
			"connectionId",
			connectionID,
			"error",
			err,
		)
	}

	writeJSON(responseWriter, statusCode, errorEnvelope{
		Error: errorBody{
			Code:    "transmission_partial_failure",
			Message: "Transmission could not apply the operation to one or more connections.",
			Issues:  issues,
		},
	})

	return true
}

// summedTransmissionStatistics adds numeric fields from every answering daemon.
func (server *Server) summedTransmissionStatistics(ctx context.Context) (map[string]any, []string) {
	daemons := server.transmissionDaemons(ctx)
	statisticsByDaemon := make([]map[string]any, len(daemons))
	errorsByDaemon := make([]error, len(daemons))
	var waitGroup sync.WaitGroup
	for index, daemon := range daemons {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			errorsByDaemon[index] = daemon.Client.Call(
				ctx,
				"session-stats",
				nil,
				&statisticsByDaemon[index],
			)
		}()
	}
	waitGroup.Wait()

	summed := map[string]any{}
	errorCodes := []string{}
	for index, daemon := range daemons {
		if errorsByDaemon[index] != nil {
			server.logInternalError(
				"read Transmission statistics for connection "+daemon.ConnectionID,
				errorsByDaemon[index],
			)
			errorCodes = append(errorCodes, "transmission-statistics-unavailable:"+daemon.ConnectionID)

			continue
		}
		mergeNumericMaps(summed, statisticsByDaemon[index])
	}
	sort.Strings(errorCodes)

	return summed, errorCodes
}

// mergeNumericMaps sums counters while retaining daemon-lifetime maxima.
func mergeNumericMaps(destination map[string]any, source map[string]any) {
	for key, sourceValue := range source {
		sourceMap, sourceIsMap := sourceValue.(map[string]any)
		if sourceIsMap {
			destinationMap, destinationIsMap := destination[key].(map[string]any)
			if !destinationIsMap {
				destinationMap = map[string]any{}
				destination[key] = destinationMap
			}
			mergeNumericMaps(destinationMap, sourceMap)

			continue
		}

		sourceNumber, sourceIsNumber := numericValue(sourceValue)
		if sourceIsNumber {
			destinationNumber, _ := numericValue(destination[key])
			if key == "secondsActive" || key == "sessionCount" {
				destination[key] = math.Max(destinationNumber, sourceNumber)
			} else {
				destination[key] = destinationNumber + sourceNumber
			}

			continue
		}
		if _, found := destination[key]; !found {
			destination[key] = sourceValue
		}
	}
}

// numericValue normalizes JSON number representations for aggregation.
func numericValue(value any) (float64, bool) {
	switch number := value.(type) {
	case float64:
		return number, true
	case float32:
		return float64(number), true
	case int:
		return float64(number), true
	case int64:
		return float64(number), true
	case json.Number:
		decoded, err := number.Float64()

		return decoded, err == nil
	default:
		return 0, false
	}
}

// integerValue accepts only exact positive integers from decoded RPC JSON.
func integerValue(value any) (int64, bool) {
	number, valid := numericValue(value)
	if !valid || number <= 0 || number > math.MaxInt64 || math.Trunc(number) != number {
		return 0, false
	}

	return int64(number), true
}

// updateTorrentHashIndex retains each daemon's last complete successful hash set.
func (server *Server) updateTorrentHashIndex(
	daemons []transmissionrpc.Daemon,
	locationsByConnection map[string]map[string]torrentLocation,
) (map[string]torrentLocation, []string) {
	server.torrentHashMutex.Lock()
	defer server.torrentHashMutex.Unlock()

	configured := make(map[string]struct{}, len(daemons))
	for _, daemon := range daemons {
		configured[daemon.ConnectionID] = struct{}{}
	}
	for connectionID := range server.torrentHashSets {
		if _, found := configured[connectionID]; !found {
			delete(server.torrentHashSets, connectionID)
		}
	}
	for connectionID, locations := range locationsByConnection {
		copied := make(map[string]torrentLocation, len(locations))
		for hash, location := range locations {
			copied[hash] = location
		}
		server.torrentHashSets[connectionID] = copied
	}

	locations := map[string]torrentLocation{}
	unanswered := []string{}
	for _, daemon := range daemons {
		daemonLocations, answered := server.torrentHashSets[daemon.ConnectionID]
		if !answered {
			unanswered = append(unanswered, daemon.ConnectionID)

			continue
		}
		for hash, location := range daemonLocations {
			if _, found := locations[hash]; !found {
				locations[hash] = location
			}
		}
	}
	server.torrentHashIndex = make(map[string]torrentLocation, len(locations))
	for hash, location := range locations {
		server.torrentHashIndex[hash] = location
	}

	return locations, unanswered
}

// startingTransmissionConnectionName returns the first enabled daemon without one
// complete torrent list since API startup.
func (server *Server) startingTransmissionConnectionName(
	ctx context.Context,
	unanswered []string,
) (string, bool) {
	if len(unanswered) == 0 {
		return "", false
	}
	unansweredSet := make(map[string]struct{}, len(unanswered))
	for _, connectionID := range unanswered {
		unansweredSet[connectionID] = struct{}{}
	}
	connections, err := server.store.ListVPNConnections(ctx)
	if err != nil {
		server.logInternalError("read VPN connections while checking Transmission readiness", err)

		return unanswered[0], true
	}
	for _, connection := range connections {
		if _, missing := unansweredSet[connection.ID]; connection.Enabled && missing {
			return connection.Name, true
		}
	}

	return "", false
}

// torrentLocationByHash resolves one normalized info hash from the latest complete list.
func (server *Server) torrentLocationByHash(hash string) (torrentLocation, bool) {
	server.torrentHashMutex.RLock()
	defer server.torrentHashMutex.RUnlock()

	location, found := server.torrentHashIndex[strings.ToLower(hash)]

	return location, found
}

// rememberTorrentLocation adds one successful torrent without waiting for a full list.
func (server *Server) rememberTorrentLocation(hash string, location torrentLocation) {
	server.torrentHashMutex.Lock()
	normalizedHash := strings.ToLower(hash)
	server.torrentHashIndex[normalizedHash] = location
	if daemonLocations, answered := server.torrentHashSets[location.ConnectionID]; answered {
		daemonLocations[normalizedHash] = location
	}
	server.torrentHashMutex.Unlock()
}

// refreshTorrentHashIndex returns the exact live-plus-last-known snapshot it refreshed.
func (server *Server) refreshTorrentHashIndex(
	ctx context.Context,
) (map[string]torrentLocation, []string) {
	result := server.mergedTorrents(ctx, []string{"hashString", "id", "name"}, nil)

	return result.HashLocations, result.UnansweredConnections
}

// defaultTransmissionDaemon returns the effective default or a setup-state error.
func (server *Server) defaultTransmissionDaemon(ctx context.Context) (transmissionrpc.Daemon, error) {
	for _, daemon := range server.transmissionDaemons(ctx) {
		if daemon.Default {
			return daemon, nil
		}
	}
	connections, err := server.store.ListVPNConnections(ctx)
	if err != nil {
		return transmissionrpc.Daemon{}, fmt.Errorf("list VPN connections for default Transmission daemon: %w", err)
	}
	if len(connections) == 0 {
		return transmissionrpc.Daemon{}, errVPNConnectionRequired
	}

	return transmissionrpc.Daemon{}, storage.ErrNotFound
}

// transmissionDaemonForFacade resolves one application ID to a daemon-local ID.
func (server *Server) transmissionDaemonForFacade(
	ctx context.Context,
	facadeID int64,
) (transmissionrpc.Daemon, int64, error) {
	slot, daemonID, err := transmissionrpc.SplitFacadeID(facadeID)
	if err != nil {
		return transmissionrpc.Daemon{}, 0, err
	}
	for _, daemon := range server.transmissionDaemons(ctx) {
		if daemon.Slot == slot {
			return daemon, daemonID, nil
		}
	}

	return transmissionrpc.Daemon{}, 0, errors.New("Transmission daemon is unavailable")
}
