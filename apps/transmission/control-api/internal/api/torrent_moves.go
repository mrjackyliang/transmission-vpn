package api

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionrpc"
)

// torrentMoveResult is one public per-torrent move outcome.
type torrentMoveResult struct {
	Hash     string   `json:"hash"`
	ID       int64    `json:"id,omitempty"`
	Name     string   `json:"name"`
	Result   string   `json:"result"`
	Error    string   `json:"error,omitempty"`
	Warnings []string `json:"warnings,omitempty"`
	runState *torrentMoveRunState
}

// torrentMoveCandidate identifies one torrent and its current connection.
type torrentMoveCandidate struct {
	Hash              string
	FacadeID          int64
	Name              string
	ConnectionID      string
	DownloadDirectory string
	Labels            []string
	Status            int64
	PercentDone       float64
	DeferRunState     bool
}

// torrentMoveRunState preserves whether a moved torrent was active or paused.
type torrentMoveRunState struct {
	Status      int64
	PercentDone float64
}

// torrentMoveFileState is one file's wanted and priority state from Transmission.
type torrentMoveFileState struct {
	Wanted   bool  `json:"wanted"`
	Priority int64 `json:"priority"`
}

// torrentMoveFile is one current path reported from the source resume state.
type torrentMoveFile struct {
	Name string `json:"name"`
}

// torrentMoveSnapshot contains every daemon-owned value restored by a move.
type torrentMoveSnapshot struct {
	ID                      int64                  `json:"id"`
	Name                    string                 `json:"name"`
	HashString              string                 `json:"hashString"`
	DownloadDirectory       string                 `json:"downloadDir"`
	Labels                  []string               `json:"labels"`
	Files                   []torrentMoveFile      `json:"files"`
	FileStats               []torrentMoveFileState `json:"fileStats"`
	Group                   string                 `json:"group"`
	DownloadLimit           int64                  `json:"downloadLimit"`
	DownloadLimited         bool                   `json:"downloadLimited"`
	UploadLimit             int64                  `json:"uploadLimit"`
	UploadLimited           bool                   `json:"uploadLimited"`
	HonorsSessionLimits     bool                   `json:"honorsSessionLimits"`
	BandwidthPriority       int64                  `json:"bandwidthPriority"`
	SeedRatioLimit          float64                `json:"seedRatioLimit"`
	SeedRatioMode           int64                  `json:"seedRatioMode"`
	SeedIdleLimit           int64                  `json:"seedIdleLimit"`
	SeedIdleMode            int64                  `json:"seedIdleMode"`
	PeerLimit               int64                  `json:"peer-limit"`
	Status                  int64                  `json:"status"`
	PercentDone             float64                `json:"percentDone"`
	MagnetLink              string                 `json:"magnetLink"`
	MetadataPercentComplete float64                `json:"metadataPercentComplete"`
}

var torrentMoveFields = []string{
	"bandwidthPriority",
	"downloadDir",
	"downloadLimit",
	"downloadLimited",
	"files",
	"fileStats",
	"group",
	"hashString",
	"honorsSessionLimits",
	"id",
	"labels",
	"magnetLink",
	"metadataPercentComplete",
	"name",
	"peer-limit",
	"percentDone",
	"seedIdleLimit",
	"seedIdleMode",
	"seedRatioLimit",
	"seedRatioMode",
	"status",
	"uploadLimit",
	"uploadLimited",
}

// moveTorrent transfers one torrent between two daemon connections.
//
// A per-hash lock and the global add lock serialize every competing placement of the
// torrent. Its live source is rediscovered under both locks before any mutation.
func (server *Server) moveTorrent(
	ctx context.Context,
	hash string,
	requestedSourceConnectionID string,
	targetConnectionID string,
) (torrentMoveResult, error) {
	normalizedHashes, err := normalizeTorrentHashes([]string{hash})
	if err != nil {
		return failedTorrentMove(hash, "", err), err
	}
	hash = normalizedHashes[0]
	hashLock := server.torrentMoveHashLock(hash)
	hashLock.Lock()
	defer hashLock.Unlock()

	result, err := server.moveTorrentBetweenConnectionsLocked(
		ctx,
		hash,
		requestedSourceConnectionID,
		targetConnectionID,
	)
	if err != nil || result.runState == nil {
		return result, err
	}
	result.Warnings = append(
		result.Warnings,
		server.restoreMovedTorrentState(
			ctx,
			targetConnectionID,
			result.Hash,
			*result.runState,
			false,
		)...,
	)

	return result, nil
}

// moveTorrentBetweenConnectionsLocked transfers without finalizing torrent state.
//
// Profile moves may still need to change the download directory, so verification and
// the original run state are deliberately restored by the lock-owning caller last.
func (server *Server) moveTorrentBetweenConnectionsLocked(
	ctx context.Context,
	hash string,
	requestedSourceConnectionID string,
	targetConnectionID string,
) (torrentMoveResult, error) {
	server.torrentAddMutex.Lock()
	addLocked := true
	defer func() {
		if addLocked {
			server.torrentAddMutex.Unlock()
		}
	}()

	if _, removing := server.vpnConnectionRemovalTarget(targetConnectionID); removing {
		return server.logFailedTorrentMove(
			hash,
			"",
			requestedSourceConnectionID,
			targetConnectionID,
			errConnectionBeingRemoved,
		)
	}

	currentLocation, err := server.torrentLocationForMove(ctx, hash)
	if err != nil {
		return server.logFailedTorrentMove(
			hash,
			"",
			requestedSourceConnectionID,
			targetConnectionID,
			err,
		)
	}
	targetName := server.vpnConnectionName(ctx, targetConnectionID)
	if currentLocation.ConnectionID == targetConnectionID {
		warning := "Torrent is already on " + targetName + "."

		return torrentMoveResult{
			Hash:     hash,
			ID:       currentLocation.FacadeID,
			Name:     currentLocation.Name,
			Result:   "moved",
			Warnings: []string{warning},
		}, nil
	}

	sourceConnectionID := currentLocation.ConnectionID
	source, sourceFound := server.transmissionDaemonForConnection(ctx, sourceConnectionID)
	target, targetFound := server.transmissionDaemonForConnection(ctx, targetConnectionID)
	if !sourceFound || !targetFound {
		err := errors.New("a Transmission daemon for the move is unavailable")

		return failedTorrentMove(hash, "", err), err
	}

	server.logger.Info(
		"moving Transmission torrent",
		"hash", hash,
		"sourceConnectionId", sourceConnectionID,
		"requestedSourceConnectionId", requestedSourceConnectionID,
		"targetConnectionId", targetConnectionID,
	)

	snapshot, err := readTorrentMoveSnapshot(ctx, source, hash)
	if err != nil {
		return server.logFailedTorrentMove(hash, "", sourceConnectionID, targetConnectionID, err)
	}
	name := snapshot.Name
	downloadPolicy, policyError := server.effectiveDownloadPathPolicy(ctx)
	if policyError != nil {
		return server.logFailedTorrentMove(hash, name, sourceConnectionID, targetConnectionID, policyError)
	}
	normalizedDownloadDirectory, validationError := downloadPolicy.normalizeDownloadDirectory(
		snapshot.DownloadDirectory,
	)
	if validationError != nil {
		return server.logFailedTorrentMove(hash, name, sourceConnectionID, targetConnectionID, validationError)
	}

	addArguments := map[string]any{
		"download-dir": normalizedDownloadDirectory,
		"labels":       nonNilStrings(snapshot.Labels),
		"paused":       true,
	}
	var metainfo []byte
	if snapshot.MetadataPercentComplete < 1 {
		if strings.TrimSpace(snapshot.MagnetLink) == "" {
			err = errors.New("torrent has no metadata or magnet link")

			return server.logFailedTorrentMove(hash, name, sourceConnectionID, targetConnectionID, err)
		}
		addArguments["filename"] = snapshot.MagnetLink
	} else {
		if server.directoryBrowser == nil {
			err = errors.New("directory controller is unavailable")

			return server.logFailedTorrentMove(hash, name, sourceConnectionID, targetConnectionID, err)
		}
		metainfoPath := filepath.Join(
			"/config/transmission",
			sourceConnectionID,
			"torrents",
			hash+".torrent",
		)
		var readError error
		metainfo, readError = server.directoryBrowser.ReadTorrent(ctx, metainfoPath)
		if readError != nil {
			err = fmt.Errorf("read torrent metainfo: %w", readError)

			return server.logFailedTorrentMove(hash, name, sourceConnectionID, targetConnectionID, err)
		}
		addArguments["metainfo"] = base64.StdEncoding.EncodeToString(metainfo)
	}

	var addResult torrentAddRPCResult
	err = target.Client.Call(ctx, "torrent-add", addArguments, &addResult)
	if err != nil {
		err = fmt.Errorf("add torrent to target connection: %w", err)

		return server.logFailedTorrentMove(hash, name, sourceConnectionID, targetConnectionID, err)
	}
	if addResult.Added == nil || addResult.Duplicate != nil {
		err = errors.New("target connection did not add a new torrent")

		return server.logFailedTorrentMove(hash, name, sourceConnectionID, targetConnectionID, err)
	}
	targetID := addResult.Added.ID
	if !strings.EqualFold(addResult.Added.HashString, hash) {
		rollbackHash := strings.ToLower(strings.TrimSpace(addResult.Added.HashString))
		if rollbackHash == "" {
			rollbackHash = hash
		}
		rollbackError := removeMovedTorrent(ctx, target, rollbackHash)
		err = torrentMoveRollbackError(
			"target connection added a different torrent",
			errors.New("the target hash did not match the source hash"),
			rollbackError,
			targetName,
		)

		return server.logFailedTorrentMove(hash, name, sourceConnectionID, targetConnectionID, err)
	}
	if name == "" {
		name = addResult.Added.Name
	}

	if err = target.Client.Call(
		ctx,
		"torrent-set",
		torrentMoveSetArguments(snapshot, hash),
		nil,
	); err != nil {
		rollbackError := removeMovedTorrent(ctx, target, hash)
		err = torrentMoveRollbackError(
			"restore torrent state on target connection",
			err,
			rollbackError,
			targetName,
		)

		return server.logFailedTorrentMove(hash, name, sourceConnectionID, targetConnectionID, err)
	}
	if len(snapshot.Files) > 0 && snapshot.MetadataPercentComplete >= 1 {
		renames, renameError := torrentMoveRenameOperations(metainfo, snapshot.Files)
		if renameError != nil {
			rollbackError := removeMovedTorrent(ctx, target, hash)
			err = torrentMoveRollbackError(
				"restore renamed torrent paths on target connection",
				renameError,
				rollbackError,
				targetName,
			)

			return server.logFailedTorrentMove(hash, name, sourceConnectionID, targetConnectionID, err)
		}
		for _, rename := range renames {
			if err := target.Client.Call(ctx, "torrent-rename-path", map[string]any{
				"ids":  []string{hash},
				"name": rename.Name,
				"path": rename.Path,
			}, nil); err != nil {
				rollbackError := removeMovedTorrent(ctx, target, hash)
				err = torrentMoveRollbackError(
					"restore renamed torrent paths on target connection",
					err,
					rollbackError,
					targetName,
				)

				return server.logFailedTorrentMove(hash, name, sourceConnectionID, targetConnectionID, err)
			}
		}
	}

	err = source.Client.Call(ctx, "torrent-remove", map[string]any{
		"delete-local-data": false,
		"ids":               []string{hash},
	}, nil)
	warnings := []string{}
	if err != nil {
		var resultError *transmissionrpc.ResultError
		if errors.As(err, &resultError) {
			rollbackError := removeMovedTorrent(ctx, target, hash)
			err = torrentMoveRollbackError(
				"remove torrent from source connection",
				err,
				rollbackError,
				targetName,
			)

			return server.logFailedTorrentMove(hash, name, sourceConnectionID, targetConnectionID, err)
		}

		sourceStillHasTorrent, queryError := torrentExistsByHash(ctx, source, hash)
		if queryError != nil {
			err = fmt.Errorf(
				"remove torrent from source connection: %w; source state could not be confirmed: %v; A paused copy is still on %s",
				err,
				queryError,
				targetName,
			)

			return server.logFailedTorrentMove(hash, name, sourceConnectionID, targetConnectionID, err)
		}
		if sourceStillHasTorrent {
			rollbackError := removeMovedTorrent(ctx, target, hash)
			err = torrentMoveRollbackError(
				"remove torrent from source connection",
				err,
				rollbackError,
				targetName,
			)

			return server.logFailedTorrentMove(hash, name, sourceConnectionID, targetConnectionID, err)
		}

		warnings = append(
			warnings,
			"Transmission returned an error after removing the source copy; its absence was confirmed.",
		)
	}
	server.torrentAddMutex.Unlock()
	addLocked = false

	facadeID, err := transmissionrpc.FacadeID(target.Slot, targetID)
	if err != nil {
		warnings = append(warnings, "The moved torrent's display identifier could not be refreshed.")
	} else {
		server.replaceTorrentLocation(hash, sourceConnectionID, torrentLocation{
			ConnectionID: targetConnectionID,
			FacadeID:     facadeID,
			Name:         name,
		})
	}

	server.logger.Info(
		"moved Transmission torrent",
		"hash", hash,
		"name", name,
		"sourceConnectionId", sourceConnectionID,
		"targetConnectionId", targetConnectionID,
		"warnings", warnings,
	)

	return torrentMoveResult{
		Hash:     hash,
		ID:       facadeID,
		Name:     name,
		Result:   "moved",
		Warnings: warnings,
		runState: &torrentMoveRunState{
			Status:      snapshot.Status,
			PercentDone: snapshot.PercentDone,
		},
	}, nil
}

// moveTorrentToProfile enforces both connection and folder ownership for one torrent.
//
// Cross-daemon moves preserve the source folder first, then the target daemon moves
// files only when that folder differs from the selected profile's destination.
func (server *Server) moveTorrentToProfile(
	ctx context.Context,
	candidate torrentMoveCandidate,
	targetConnectionID string,
	targetDownloadDirectory string,
) (torrentMoveResult, error) {
	normalizedHashes, err := normalizeTorrentHashes([]string{candidate.Hash})
	if err != nil {
		return failedTorrentMove(candidate.Hash, candidate.Name, err), err
	}
	candidate.Hash = normalizedHashes[0]
	hashLock := server.torrentMoveHashLock(candidate.Hash)
	hashLock.Lock()
	defer hashLock.Unlock()

	result := torrentMoveResult{
		Hash:   candidate.Hash,
		ID:     candidate.FacadeID,
		Name:   candidate.Name,
		Result: "already-there",
	}
	folderMoved := !sameTorrentProfileFolder(
		candidate.DownloadDirectory,
		targetDownloadDirectory,
	)
	downloadPolicy := downloadPathPolicy{}
	if folderMoved {
		downloadPolicy, err = server.effectiveDownloadPathPolicy(ctx)
		if err != nil {
			return failedTorrentMove(candidate.Hash, candidate.Name, err), err
		}
	}
	connectionMoved := false
	runState := torrentMoveRunState{
		Status:      candidate.Status,
		PercentDone: candidate.PercentDone,
	}
	if candidate.ConnectionID != targetConnectionID {
		movedResult, err := server.moveTorrentBetweenConnectionsLocked(
			ctx,
			candidate.Hash,
			candidate.ConnectionID,
			targetConnectionID,
		)
		if err != nil {
			return movedResult, err
		}
		result = movedResult
		if movedResult.runState != nil {
			runState = *movedResult.runState
		}
		connectionMoved = true
	}

	if !folderMoved {
		if connectionMoved {
			result.Warnings = append(
				result.Warnings,
				server.restoreMovedTorrentState(
					ctx,
					targetConnectionID,
					candidate.Hash,
					runState,
					candidate.DeferRunState,
				)...,
			)
		}

		return result, nil
	}

	target, found := server.transmissionDaemonForConnection(ctx, targetConnectionID)
	if !found {
		err := errors.New("the target Transmission daemon is unavailable")

		return failedTorrentMove(candidate.Hash, candidate.Name, err), err
	}
	moveFiles := !downloadPolicy.incompleteEnabled || runState.PercentDone >= 1
	if err := target.Client.Call(ctx, "torrent-set-location", map[string]any{
		"ids":      []string{candidate.Hash},
		"location": targetDownloadDirectory,
		"move":     moveFiles,
	}, nil); err != nil {
		err = fmt.Errorf("move torrent files to the profile folder: %w", err)
		if connectionMoved {
			result.Warnings = append(
				result.Warnings,
				server.restoreMovedTorrentState(
					ctx,
					targetConnectionID,
					candidate.Hash,
					runState,
					false,
				)...,
			)
		}

		failed := failedTorrentMove(candidate.Hash, candidate.Name, err)
		failed.Warnings = result.Warnings

		return failed, err
	}
	result.Warnings = append(
		result.Warnings,
		server.restoreMovedTorrentState(
			ctx,
			targetConnectionID,
			candidate.Hash,
			runState,
			candidate.DeferRunState,
		)...,
	)

	result.Result = "moved"

	return result, nil
}

// restoreMovedTorrentState verifies shared data, then optionally restores the prior state.
func (server *Server) restoreMovedTorrentState(
	ctx context.Context,
	targetConnectionID string,
	hash string,
	runState torrentMoveRunState,
	deferRunState bool,
) []string {
	target, found := server.transmissionDaemonForConnection(ctx, targetConnectionID)
	if !found {
		return []string{"The moved torrent's run state could not be restored because its Transmission daemon is unavailable."}
	}
	warnings := []string{}
	if err := target.Client.Call(ctx, "torrent-verify", map[string]any{
		"ids": []string{hash},
	}, nil); err != nil {
		warnings = append(warnings, "The moved torrent could not be started for verification: "+err.Error())
	}
	if deferRunState {
		return warnings
	}
	method := "torrent-start"
	warning := "The moved torrent could not be restarted: "
	if runState.Status == 0 {
		method = "torrent-stop"
		warning = "The moved torrent could not be paused again: "
	}
	if err := target.Client.Call(ctx, method, map[string]any{
		"ids": []string{hash},
	}, nil); err != nil {
		warnings = append(warnings, warning+err.Error())
	}

	return warnings
}

// sameTorrentProfileFolder compares normalized folders without case sensitivity.
func sameTorrentProfileFolder(leftDirectory string, rightDirectory string) bool {
	leftDirectory, leftError := settings.NormalizeDataPath(leftDirectory)
	rightDirectory, rightError := settings.NormalizeDataPath(rightDirectory)
	if leftError != nil || rightError != nil {
		return false
	}

	return strings.EqualFold(leftDirectory, rightDirectory)
}

// readTorrentMoveSnapshot loads one exact torrent from its source daemon.
func readTorrentMoveSnapshot(
	ctx context.Context,
	source transmissionrpc.Daemon,
	hash string,
) (torrentMoveSnapshot, error) {
	var response struct {
		Torrents []torrentMoveSnapshot `json:"torrents"`
	}
	if err := source.Client.Call(ctx, "torrent-get", map[string]any{
		"fields": torrentMoveFields,
		"ids":    []string{hash},
	}, &response); err != nil {
		return torrentMoveSnapshot{}, fmt.Errorf("read source torrent: %w", err)
	}
	if len(response.Torrents) != 1 ||
		!strings.EqualFold(response.Torrents[0].HashString, hash) {
		return torrentMoveSnapshot{}, errors.New("source torrent is no longer available")
	}

	return response.Torrents[0], nil
}

// torrentMoveSetArguments restores file choices and every requested per-torrent option.
func torrentMoveSetArguments(snapshot torrentMoveSnapshot, hash string) map[string]any {
	filesWanted := []int{}
	filesUnwanted := []int{}
	priorityHigh := []int{}
	priorityNormal := []int{}
	priorityLow := []int{}
	for index, file := range snapshot.FileStats {
		if file.Wanted {
			filesWanted = append(filesWanted, index)
		} else {
			filesUnwanted = append(filesUnwanted, index)
		}
		switch file.Priority {
		case 1:
			priorityHigh = append(priorityHigh, index)
		case -1:
			priorityLow = append(priorityLow, index)
		default:
			priorityNormal = append(priorityNormal, index)
		}
	}

	arguments := map[string]any{
		"bandwidthPriority":   snapshot.BandwidthPriority,
		"downloadLimit":       snapshot.DownloadLimit,
		"downloadLimited":     snapshot.DownloadLimited,
		"group":               snapshot.Group,
		"honorsSessionLimits": snapshot.HonorsSessionLimits,
		"ids":                 []string{hash},
		"peer-limit":          snapshot.PeerLimit,
		"seedIdleLimit":       snapshot.SeedIdleLimit,
		"seedIdleMode":        snapshot.SeedIdleMode,
		"seedRatioLimit":      snapshot.SeedRatioLimit,
		"seedRatioMode":       snapshot.SeedRatioMode,
		"uploadLimit":         snapshot.UploadLimit,
		"uploadLimited":       snapshot.UploadLimited,
	}
	if len(filesUnwanted) > 0 {
		arguments["files-unwanted"] = filesUnwanted
	}
	if len(filesWanted) > 0 {
		arguments["files-wanted"] = filesWanted
	}
	if len(priorityHigh) > 0 {
		arguments["priority-high"] = priorityHigh
	}
	if len(priorityLow) > 0 {
		arguments["priority-low"] = priorityLow
	}
	if len(priorityNormal) > 0 {
		arguments["priority-normal"] = priorityNormal
	}

	return arguments
}

// removeMovedTorrent rolls back one paused target copy without deleting shared data.
func removeMovedTorrent(ctx context.Context, target transmissionrpc.Daemon, hash string) error {
	return target.Client.Call(ctx, "torrent-remove", map[string]any{
		"delete-local-data": false,
		"ids":               []string{hash},
	}, nil)
}

// torrentMoveRollbackError keeps the primary failure and reports failed cleanup.
func torrentMoveRollbackError(
	operation string,
	err error,
	rollbackError error,
	targetName string,
) error {
	if rollbackError != nil {
		return fmt.Errorf(
			"%s: %w; remove target rollback: %v; A paused copy is still on %s",
			operation,
			err,
			rollbackError,
			targetName,
		)
	}

	return fmt.Errorf("%s: %w", operation, err)
}

// torrentMoveHashLock returns the stable lock for one normalized info hash.
func (server *Server) torrentMoveHashLock(hash string) *sync.Mutex {
	server.torrentMoveMutex.Lock()
	defer server.torrentMoveMutex.Unlock()
	if server.torrentMoveLocks == nil {
		server.torrentMoveLocks = map[string]*sync.Mutex{}
	}
	moveLock := server.torrentMoveLocks[hash]
	if moveLock == nil {
		moveLock = &sync.Mutex{}
		server.torrentMoveLocks[hash] = moveLock
	}

	return moveLock
}

// torrentExistsByHash confirms whether one daemon still owns the selected torrent.
//
// Move rollback decisions use this only after an ambiguous remove transport failure;
// a query failure therefore remains unknown rather than being treated as absence.
func torrentExistsByHash(
	ctx context.Context,
	daemon transmissionrpc.Daemon,
	hash string,
) (bool, error) {
	var response struct {
		Torrents []struct {
			HashString string `json:"hashString"`
		} `json:"torrents"`
	}
	if err := daemon.Client.Call(ctx, "torrent-get", map[string]any{
		"fields": []string{"hashString", "id"},
		"ids":    []string{hash},
	}, &response); err != nil {
		return false, fmt.Errorf("query source torrent after remove: %w", err)
	}
	if len(response.Torrents) == 0 {
		return false, nil
	}
	if len(response.Torrents) != 1 ||
		!strings.EqualFold(response.Torrents[0].HashString, hash) {
		return false, errors.New("source returned an invalid torrent selection")
	}

	return true, nil
}

// torrentLocationForMove discovers the one live daemon that owns a hash.
//
// Every configured daemon must answer. Duplicate ownership stays an explicit failure
// so the existing merged-torrent duplicate report remains the recovery surface.
func (server *Server) torrentLocationForMove(
	ctx context.Context,
	hash string,
) (torrentMoveCandidate, error) {
	result := server.mergedTorrents(ctx, []string{"hashString", "id", "name"}, []string{hash})
	if !result.Complete {
		return torrentMoveCandidate{}, errTorrentSelectionUnavailable
	}

	matches := []torrentMoveCandidate{}
	for _, torrent := range result.Torrents {
		torrentHash, _ := torrent["hashString"].(string)
		if !strings.EqualFold(torrentHash, hash) {
			continue
		}
		connectionID, _ := torrent["connectionId"].(string)
		name, _ := torrent["name"].(string)
		facadeID, validID := integerValue(torrent["id"])
		if connectionID == "" || !validID {
			return torrentMoveCandidate{}, errors.New("Transmission omitted the torrent connection")
		}
		matches = append(matches, torrentMoveCandidate{
			Hash:         hash,
			FacadeID:     facadeID,
			Name:         name,
			ConnectionID: connectionID,
		})
	}
	if len(matches) == 0 {
		return torrentMoveCandidate{}, errTorrentSelectionNotFound
	}
	if len(matches) != 1 {
		return torrentMoveCandidate{}, errors.New("torrent exists on more than one connection")
	}

	return matches[0], nil
}

// vpnConnectionName returns the user-facing name for move diagnostics.
//
// A concurrent storage failure falls back to the durable identifier so rollback
// warnings still identify where the paused target copy remains.
func (server *Server) vpnConnectionName(ctx context.Context, connectionID string) string {
	connection, err := server.store.VPNConnectionByID(ctx, connectionID)
	if err == nil && connection.Name != "" {
		return connection.Name
	}

	return connectionID
}

// transmissionDaemonForConnection resolves one durable connection to its client.
func (server *Server) transmissionDaemonForConnection(
	ctx context.Context,
	connectionID string,
) (transmissionrpc.Daemon, bool) {
	for _, daemon := range server.transmissionDaemons(ctx) {
		if daemon.ConnectionID == connectionID {
			return daemon, true
		}
	}

	return transmissionrpc.Daemon{}, false
}

// replaceTorrentLocation moves one hash in both the fast index and answered sets.
func (server *Server) replaceTorrentLocation(
	hash string,
	sourceConnectionID string,
	target torrentLocation,
) {
	hash = strings.ToLower(hash)
	server.torrentHashMutex.Lock()
	defer server.torrentHashMutex.Unlock()

	delete(server.torrentHashSets[sourceConnectionID], hash)
	if targetLocations, found := server.torrentHashSets[target.ConnectionID]; found {
		if targetLocations == nil {
			targetLocations = map[string]torrentLocation{}
			server.torrentHashSets[target.ConnectionID] = targetLocations
		}
		targetLocations[hash] = target
	}
	server.torrentHashIndex[hash] = target
}

// torrentsOnConnection returns a complete stable list for removal and reassignment.
func (server *Server) torrentsOnConnection(
	ctx context.Context,
	connectionID string,
) ([]torrentMoveCandidate, error) {
	daemon, found := server.transmissionDaemonForConnection(ctx, connectionID)
	if !found {
		return nil, errTransmissionDaemonUnavailable
	}
	var response struct {
		Torrents []map[string]any `json:"torrents"`
	}
	if err := daemon.Client.Call(ctx, "torrent-get", map[string]any{
		"fields": []string{"hashString", "id", "name"},
	}, &response); err != nil {
		return nil, errors.Join(errTransmissionDaemonUnavailable, err)
	}

	candidates := []torrentMoveCandidate{}
	for _, torrent := range response.Torrents {
		hash, _ := torrent["hashString"].(string)
		name, _ := torrent["name"].(string)
		daemonID, validID := integerValue(torrent["id"])
		facadeID, facadeError := transmissionrpc.FacadeID(daemon.Slot, daemonID)
		if hash == "" || !validID || facadeError != nil {
			return nil, errors.New("Transmission omitted a torrent hash")
		}
		candidates = append(candidates, torrentMoveCandidate{
			Hash:         strings.ToLower(hash),
			FacadeID:     facadeID,
			Name:         name,
			ConnectionID: connectionID,
		})
	}
	sortTorrentMoveCandidates(candidates)

	return candidates, nil
}

// torrentsForProfile returns every torrent currently owned by one profile.
//
// A nil identifier selects the Default profile, represented durably by the absence
// of an assignment row.
func (server *Server) torrentsForProfile(
	ctx context.Context,
	profileID *string,
) ([]torrentMoveCandidate, error) {
	profileIDs := map[string]struct{}{}
	includeDefault := profileID == nil
	if profileID != nil {
		profileIDs[*profileID] = struct{}{}
	}

	return server.torrentsForProfileSelection(ctx, includeDefault, profileIDs)
}

// torrentsFollowingDefaultConnection returns Default and following-profile torrents.
func (server *Server) torrentsFollowingDefaultConnection(
	ctx context.Context,
) ([]torrentMoveCandidate, error) {
	profiles, err := server.store.ListTorrentProfiles(ctx)
	if err != nil {
		return nil, fmt.Errorf("list torrent profiles: %w", err)
	}
	profileIDs := map[string]struct{}{}
	for _, profile := range profiles {
		if profile.ConnectionID == nil {
			profileIDs[profile.ID] = struct{}{}
		}
	}

	return server.torrentsForProfileSelection(ctx, true, profileIDs)
}

// torrentsForProfileSelection loads torrents owned by the requested profile set.
func (server *Server) torrentsForProfileSelection(
	ctx context.Context,
	includeDefault bool,
	profileIDs map[string]struct{},
) ([]torrentMoveCandidate, error) {
	result := server.mergedTorrents(
		ctx,
		[]string{"downloadDir", "hashString", "id", "labels", "name", "percentDone", "status"},
		nil,
	)
	if !result.Complete {
		return nil, errors.New("one or more Transmission daemons did not answer")
	}

	candidates := []torrentMoveCandidate{}
	for _, torrent := range result.Torrents {
		hash, _ := torrent["hashString"].(string)
		assignedProfileID, assigned := server.torrentProfileAssignments.profileID(hash)
		connectionID, _ := torrent["connectionId"].(string)
		_, namedProfileMatches := profileIDs[assignedProfileID]
		matches := includeDefault && !assigned || assigned && namedProfileMatches
		if !matches {
			continue
		}
		name, _ := torrent["name"].(string)
		downloadDirectory, _ := torrent["downloadDir"].(string)
		labels, _ := rpcStringList(torrent["labels"])
		statusNumber, _ := numericValue(torrent["status"])
		percentDone, _ := numericValue(torrent["percentDone"])
		facadeID, validID := integerValue(torrent["id"])
		if hash == "" || connectionID == "" || downloadDirectory == "" || !validID {
			return nil, errors.New("Transmission omitted a torrent profile location")
		}
		candidates = append(candidates, torrentMoveCandidate{
			Hash:              strings.ToLower(hash),
			FacadeID:          facadeID,
			Name:              name,
			ConnectionID:      connectionID,
			DownloadDirectory: downloadDirectory,
			Labels:            labels,
			Status:            int64(statusNumber),
			PercentDone:       percentDone,
		})
	}
	sortTorrentMoveCandidates(candidates)

	return candidates, nil
}

// torrentLocations returns each requested hash's current complete daemon location.
func (server *Server) torrentLocations(
	ctx context.Context,
	hashes []string,
) (map[string]torrentMoveCandidate, error) {
	result := server.mergedTorrents(
		ctx,
		[]string{"downloadDir", "hashString", "id", "labels", "name", "percentDone", "status"},
		hashes,
	)
	if !result.Complete {
		return nil, errTorrentSelectionUnavailable
	}

	locations := make(map[string]torrentMoveCandidate, len(result.Torrents))
	for _, torrent := range result.Torrents {
		hash, _ := torrent["hashString"].(string)
		connectionID, _ := torrent["connectionId"].(string)
		name, _ := torrent["name"].(string)
		downloadDirectory, _ := torrent["downloadDir"].(string)
		labels, _ := rpcStringList(torrent["labels"])
		statusNumber, _ := numericValue(torrent["status"])
		percentDone, _ := numericValue(torrent["percentDone"])
		facadeID, validID := integerValue(torrent["id"])
		if hash != "" && connectionID != "" && downloadDirectory != "" && validID {
			locations[strings.ToLower(hash)] = torrentMoveCandidate{
				Hash:              strings.ToLower(hash),
				FacadeID:          facadeID,
				Name:              name,
				ConnectionID:      connectionID,
				DownloadDirectory: downloadDirectory,
				Labels:            labels,
				Status:            int64(statusNumber),
				PercentDone:       percentDone,
			}
		}
	}
	if len(locations) != len(hashes) {
		return nil, errTorrentSelectionNotFound
	}

	return locations, nil
}

// sortTorrentMoveCandidates keeps move responses deterministic across daemon order.
func sortTorrentMoveCandidates(candidates []torrentMoveCandidate) {
	sort.Slice(candidates, func(left int, right int) bool {
		if candidates[left].Hash == candidates[right].Hash {
			return candidates[left].Name < candidates[right].Name
		}

		return candidates[left].Hash < candidates[right].Hash
	})
}

// failedTorrentMove constructs one serializable failure result.
func failedTorrentMove(hash string, name string, err error) torrentMoveResult {
	return torrentMoveResult{
		Hash:   strings.ToLower(hash),
		Name:   name,
		Result: "failed",
		Error:  err.Error(),
	}
}

// logFailedTorrentMove records and returns one move failure consistently.
func (server *Server) logFailedTorrentMove(
	hash string,
	name string,
	sourceConnectionID string,
	targetConnectionID string,
	err error,
) (torrentMoveResult, error) {
	server.logger.Warn(
		"Transmission torrent move failed",
		"hash", hash,
		"name", name,
		"sourceConnectionId", sourceConnectionID,
		"targetConnectionId", targetConnectionID,
		"error", err,
	)

	return failedTorrentMove(hash, name, err), err
}

// nonNilStrings keeps empty labels encoded as an array in Transmission requests.
func nonNilStrings(values []string) []string {
	if values == nil {
		return []string{}
	}

	return values
}
