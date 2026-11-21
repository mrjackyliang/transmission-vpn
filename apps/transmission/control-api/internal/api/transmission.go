package api

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionconfig"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionrpc"
)

const torrentProfileApplyTimeout = 30 * time.Second

// transmissionRestartResult describes one independently attempted daemon restart.
type transmissionRestartResult struct {
	ConnectionID string `json:"connectionId"`
	Status       string `json:"status"`
	Error        string `json:"error,omitempty"`
}

var torrentSummaryFields = transmissionrpc.SummaryTorrentFields()

var torrentDetailFields = transmissionrpc.DetailTorrentFields()

type torrentAddRPCItem = transmissionrpc.AddedTorrent

type torrentAddRPCResult = transmissionrpc.AddTorrentResponse

// torrentAddResponse is the stable application-facing result for every add attempt.
type torrentAddResponse struct {
	ID             int64  `json:"id"`
	Hash           string `json:"hash"`
	Name           string `json:"name"`
	Duplicate      bool   `json:"duplicate"`
	ProfileName    string `json:"profileName"`
	ConnectionName string `json:"connectionName"`
}

// torrentListResponse carries partial results and stable per-connection errors.
type torrentListResponse struct {
	Items  []map[string]any `json:"items"`
	Errors []string         `json:"errors"`
}

// handleTransmissionSession returns the daemon's supported session contract.
func (server *Server) handleTransmissionSession(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	var session transmissionrpc.Session
	if !server.callTransmissionOperation(
		responseWriter,
		transmissionrpc.MethodSessionGet,
		func(client *transmissionrpc.Adapter) error {
			var err error
			session, err = client.GetSession(
				request.Context(),
				transmissionrpc.GetSessionRequest{},
			)

			return err
		},
		http.StatusBadGateway,
	) {
		return
	}

	writeJSON(responseWriter, http.StatusOK, session)
}

// handleTransmissionStatistics returns aggregate and lifetime transfer statistics.
func (server *Server) handleTransmissionStatistics(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	statistics, errorCodes := server.summedTransmissionStatistics(request.Context())
	if len(statistics) == 0 && len(errorCodes) > 0 {
		writeError(
			responseWriter,
			http.StatusServiceUnavailable,
			"transmission_unavailable",
			"Transmission is unavailable.",
		)

		return
	}
	if len(errorCodes) > 0 {
		statistics["errors"] = errorCodes
	}

	writeJSON(responseWriter, http.StatusOK, statistics)
}

// handleTransmissionFreeSpace reports capacity only for an approved data path.
func (server *Server) handleTransmissionFreeSpace(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	path := strings.TrimSpace(request.URL.Query().Get("path"))
	normalizedPath, err := transmissionconfig.NormalizeDataPath(path)
	if err != nil {
		writeError(
			responseWriter,
			http.StatusUnprocessableEntity,
			"path_invalid",
			"path must be an absolute path beneath /data.",
		)

		return
	}

	var freeSpace transmissionrpc.FreeSpace
	if !server.callTransmissionOperation(
		responseWriter,
		transmissionrpc.MethodFreeSpace,
		func(client *transmissionrpc.Adapter) error {
			var err error
			freeSpace, err = client.GetFreeSpace(
				request.Context(),
				transmissionrpc.FreeSpaceRequest{Path: normalizedPath},
			)

			return err
		},
		http.StatusUnprocessableEntity,
	) {
		return
	}

	writeJSON(responseWriter, http.StatusOK, freeSpace)
}

// handleTransmissionRestart applies the accepted snapshot and requests graceful exit.
//
// s6 restarts the unprivileged runner automatically. Requiring an explicit confirmation
// keeps settings transactions from interrupting active work without administrator intent.
//
// Since: 2.0.0
func (server *Server) handleTransmissionRestart(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	var input struct {
		Confirm bool `json:"confirm"`
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}
	if !input.Confirm {
		writeError(
			responseWriter,
			http.StatusUnprocessableEntity,
			"restart_confirmation_required",
			"A controlled Transmission restart requires explicit confirmation.",
		)

		return
	}
	server.transmissionSettingsMutex.Lock()
	defer server.transmissionSettingsMutex.Unlock()
	daemons := server.transmissionDaemons(request.Context())
	if len(daemons) == 0 {
		server.clearAllTransmissionRestartKeys()
		writeError(
			responseWriter,
			http.StatusConflict,
			"transmission_not_running",
			"Transmission isn't running. Saved settings apply when it starts.",
		)

		return
	}

	snapshot, err := server.store.EffectiveConfiguration(request.Context(), server.registry)
	if err != nil {
		server.logInternalError("read settings for Transmission restart", err)
		writeError(
			responseWriter,
			http.StatusInternalServerError,
			"settings_unavailable",
			"Settings are unavailable.",
		)

		return
	}
	pendingRestartKeys := server.transmissionRestartKeys(request.Context())
	if err := server.publishTransmissionConfiguration(request.Context()); err != nil {
		server.logInternalError("publish Transmission settings before restart", err)
		writeError(
			responseWriter,
			http.StatusInternalServerError,
			"settings_unavailable",
			"Settings could not be published for restart.",
		)

		return
	}
	arguments, err := transmissionconfig.RuntimeSessionArguments(snapshot)
	if err != nil {
		server.logInternalError("map Transmission settings for restart", err)
		writeInternalError(responseWriter)

		return
	}
	sort.Slice(daemons, func(left int, right int) bool {
		return daemons[left].Slot < daemons[right].Slot
	})
	results := make([]transmissionRestartResult, len(daemons))
	var waitGroup sync.WaitGroup
	for index, daemon := range daemons {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			result := transmissionRestartResult{
				ConnectionID: daemon.ConnectionID,
				Status:       "restarting",
			}
			if callError := daemon.Client.SetSession(
				request.Context(),
				transmissionrpc.SetSessionRequest{
					Values: transmissionrpc.SessionValuesFromNative(arguments),
				},
			); callError == nil {
				callError = daemon.Client.CloseSession(request.Context())
				if callError == nil {
					results[index] = result

					return
				}
				result.Error = "Transmission could not restart this connection."
				server.logger.Warn(
					"Transmission restart failed",
					"connectionId",
					daemon.ConnectionID,
					"error",
					callError,
				)
			} else {
				result.Error = "Transmission is unavailable for this connection."
				server.logger.Warn(
					"Transmission restart settings failed",
					"connectionId",
					daemon.ConnectionID,
					"error",
					callError,
				)
			}
			result.Status = "failed"
			results[index] = result
		}()
	}
	waitGroup.Wait()
	status := "restarting"
	allRestarted := true
	for _, result := range results {
		if result.Status == "failed" {
			status = "partial"
			allRestarted = false
		}
	}
	if allRestarted {
		server.clearTransmissionRestartKeys(pendingRestartKeys)
	}

	writeJSON(responseWriter, http.StatusAccepted, map[string]any{
		"status":                status,
		"configurationRevision": snapshot.Revision,
		"connections":           results,
	})
}

// handleListTorrents returns stable summary or detail fields for a validated selection.
func (server *Server) handleListTorrents(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	listStartedAt := time.Now()
	selection, err := parseTorrentSelection(request.URL.Query().Get("ids"), true)
	if err != nil {
		writeError(responseWriter, http.StatusUnprocessableEntity, "torrent_ids_invalid", err.Error())

		return
	}

	fields := torrentSummaryFields
	view := request.URL.Query().Get("view")
	if view == "details" {
		fields = torrentDetailFields
	} else if view != "" && view != "summary" {
		writeError(
			responseWriter,
			http.StatusUnprocessableEntity,
			"torrent_view_invalid",
			"view must be summary or details.",
		)

		return
	}

	result := server.mergedTorrents(request.Context(), fields, selection)
	server.addTorrentProfileAssignments(
		request.Context(),
		result.Torrents,
		selection == nil && result.Complete,
		listStartedAt,
	)
	if _, err := server.saveTorrentLabelsFromTorrents(
		request.Context(),
		result.Torrents,
	); err != nil {
		server.logInternalError("save labels observed while listing torrents", err)
	}

	writeJSON(responseWriter, http.StatusOK, torrentListResponse{
		Items:  result.Torrents,
		Errors: result.Errors,
	})
}

// handleTorrentDetails returns the complete supported detail inventory for one torrent.
func (server *Server) handleTorrentDetails(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	torrentID, err := strconv.ParseInt(request.PathValue("torrentID"), 10, 64)
	if err != nil || torrentID <= 0 {
		writeError(
			responseWriter,
			http.StatusUnprocessableEntity,
			"torrent_id_invalid",
			"The torrent identifier must be a positive integer.",
		)

		return
	}

	result := server.mergedTorrents(
		request.Context(),
		torrentDetailFields,
		[]int64{torrentID},
	)

	if len(result.Torrents) == 0 {
		if len(result.Errors) > 0 {
			writeError(
				responseWriter,
				http.StatusServiceUnavailable,
				"transmission_unavailable",
				"Transmission is unavailable for this torrent.",
			)

			return
		}
		writeError(
			responseWriter,
			http.StatusNotFound,
			"torrent_not_found",
			"The torrent was not found.",
		)

		return
	}
	server.addTorrentProfileAssignments(request.Context(), result.Torrents, false, time.Time{})
	if _, err := server.saveTorrentLabelsFromTorrents(
		request.Context(),
		result.Torrents,
	); err != nil {
		server.logInternalError("save labels observed in torrent details", err)
	}

	writeJSON(responseWriter, http.StatusOK, result.Torrents[0])
}

// handleAddTorrent accepts a protected URL/magnet or base64 metainfo payload.
func (server *Server) handleAddTorrent(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	var input struct {
		DownloadDirectory *string         `json:"downloadDirectory"`
		Filename          string          `json:"filename"`
		Labels            json.RawMessage `json:"labels"`
		Metainfo          string          `json:"metainfo"`
		Paused            *bool           `json:"paused"`
		ProfileID         *string         `json:"profileId"`
	}
	if err := decodeLimitedJSONBody(
		responseWriter,
		request,
		&input,
		maximumTorrentAddRequestBytes,
	); err != nil {
		var maximumBytesError *http.MaxBytesError
		if errors.As(err, &maximumBytesError) {
			writeError(responseWriter, http.StatusRequestEntityTooLarge, "payload_too_large", torrentFileTooLargeMessage)

			return
		}
		writeDecodeError(responseWriter, err)

		return
	}

	input.Filename = strings.TrimSpace(input.Filename)
	input.Metainfo = strings.TrimSpace(input.Metainfo)
	if (input.Filename == "") == (input.Metainfo == "") {
		writeError(
			responseWriter,
			http.StatusUnprocessableEntity,
			"torrent_source_invalid",
			"Provide exactly one filename or metainfo value.",
		)

		return
	}

	addRequest := transmissionrpc.AddTorrentRequest{}
	var decodedMetainfo []byte
	var err error
	if input.Filename != "" {
		if err := validateTorrentURL(input.Filename); err != nil {
			writeError(responseWriter, http.StatusUnprocessableEntity, "torrent_url_invalid", err.Error())

			return
		}
		addRequest.Filename = &input.Filename
	} else {
		decodedMetainfo, err = base64.StdEncoding.DecodeString(input.Metainfo)
		if err != nil || len(decodedMetainfo) == 0 {
			writeError(
				responseWriter,
				http.StatusUnprocessableEntity,
				"torrent_metainfo_invalid",
				"metainfo must be non-empty standard base64.",
			)

			return
		}
		if torrentMetainfoTooLarge(decodedMetainfo) {
			writeError(
				responseWriter,
				http.StatusRequestEntityTooLarge,
				"torrent_metainfo_too_large",
				torrentFileTooLargeMessage,
			)

			return
		}
		addRequest.Metainfo = &input.Metainfo
	}
	sourceHash, hashKnown, err := torrentSourceHash(input.Filename, decodedMetainfo)
	if err != nil {
		writeError(
			responseWriter,
			http.StatusUnprocessableEntity,
			"torrent_metainfo_invalid",
			err.Error(),
		)

		return
	}

	clientLabels := len(input.Labels) > 0
	requestedLabels := []string{}
	if clientLabels {
		if string(bytes.TrimSpace(input.Labels)) == "null" ||
			decodeOneJSONValue(input.Labels, &requestedLabels) != nil ||
			requestedLabels == nil {
			writeFieldError(responseWriter, http.StatusUnprocessableEntity, "labels_invalid", "labels", "labels must be an array of strings.")

			return
		}
		if err := validateLabels(requestedLabels); err != nil {
			writeError(responseWriter, http.StatusUnprocessableEntity, "labels_invalid", err.Error())

			return
		}
	}

	defaultProfile, err := server.defaultTorrentProfile(request.Context())
	if err != nil {
		server.logInternalError("read Default torrent profile for add", err)
		writeInternalError(responseWriter)

		return
	}
	profile := defaultProfile
	var namedProfile *storage.TorrentProfile
	if input.ProfileID != nil {
		if !validTorrentProfileID(*input.ProfileID) {
			writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "profileId", "profileId must name an existing torrent profile.")

			return
		}
		storedProfile, err := server.store.FindTorrentProfile(request.Context(), *input.ProfileID)
		if errors.Is(err, storage.ErrNotFound) {
			writeTorrentProfileNotFound(responseWriter)

			return
		}
		if err != nil {
			server.logInternalError("read torrent profile for add", err)
			writeInternalError(responseWriter)

			return
		}
		profile = storedProfile
		namedProfile = &profile
	}
	blocked, err := server.torrentProfileAddBlockedMessage(request.Context(), profile, namedProfile == nil)
	if err != nil {
		server.logInternalError("check torrent profile folder for add", err)
		writeInternalError(responseWriter)

		return
	}
	if blocked != "" {
		writeError(responseWriter, http.StatusConflict, "profile_folder_overlap", blocked)

		return
	}
	downloadPolicy, err := server.effectiveDownloadPathPolicy(request.Context())
	if err != nil {
		server.logInternalError("read download paths for torrent add", err)
		writeInternalError(responseWriter)

		return
	}
	if input.DownloadDirectory != nil && !torrentAddDownloadDirectoryMatches(
		*input.DownloadDirectory,
		profile.DownloadDirectory,
	) {
		writeFieldError(
			responseWriter,
			http.StatusUnprocessableEntity,
			"invalid_request",
			"downloadDirectory",
			"The download folder comes from the profile.",
		)

		return
	}
	if err := prepareTorrentAddDownloadDirectory(
		&addRequest,
		profile,
		downloadPolicy,
	); err != nil {
		server.logInternalError("prepare torrent profile download folder", err)
		writeInternalError(responseWriter)

		return
	}
	if clientLabels {
		addRequest.Labels = &requestedLabels
	} else {
		labels := nonNilStrings(profile.Labels)
		addRequest.Labels = &labels
	}
	if input.Paused != nil {
		addRequest.Paused = input.Paused
	} else {
		paused := profile.StartPaused
		addRequest.Paused = &paused
	}

	targetDaemon, err := server.defaultTransmissionDaemon(request.Context())
	if profile.ConnectionID != nil && server.transmissionClients != nil {
		var found bool
		targetDaemon, found = server.transmissionClients.ByConnectionID(*profile.ConnectionID)
		if !found {
			err = errors.New("the profile's Transmission daemon is unavailable")
		}
	}
	if err != nil {
		if errors.Is(err, errVPNConnectionRequired) {
			writeError(
				responseWriter,
				http.StatusServiceUnavailable,
				"vpn_connection_required",
				"Add a VPN connection before adding torrents.",
			)

			return
		}
		writeError(
			responseWriter,
			http.StatusServiceUnavailable,
			"transmission_unavailable",
			"Transmission is unavailable for the selected connection.",
		)

		return
	}
	server.torrentAddMutex.Lock()
	defer server.torrentAddMutex.Unlock()
	if _, removing := server.vpnConnectionRemovalTarget(targetDaemon.ConnectionID); removing {
		writeConnectionBeingRemoved(responseWriter)

		return
	}
	refreshedLocations := map[string]torrentLocation{}
	if server.transmissionClients != nil {
		var unansweredConnections []string
		refreshedLocations, unansweredConnections = server.refreshTorrentHashIndex(request.Context())
		if name, starting := server.startingTransmissionConnectionName(request.Context(), unansweredConnections); starting {
			writeError(
				responseWriter,
				http.StatusServiceUnavailable,
				"transmission_unavailable",
				"Transmission for "+name+" is still starting.",
			)

			return
		}
	}
	if hashKnown {
		if existing, found := refreshedLocations[sourceHash]; found &&
			existing.ConnectionID != targetDaemon.ConnectionID {
			profileName, profileError := server.torrentAddProfileName(request.Context(), sourceHash, defaultProfile.Name)
			if profileError != nil {
				server.logInternalError("read duplicate torrent profile", profileError)
				writeInternalError(responseWriter)

				return
			}
			writeJSON(responseWriter, http.StatusCreated, torrentAddResponse{
				ID:             existing.FacadeID,
				Hash:           sourceHash,
				Name:           existing.Name,
				Duplicate:      true,
				ProfileName:    profileName,
				ConnectionName: server.vpnConnectionName(request.Context(), existing.ConnectionID),
			})

			return
		}
	}
	startAfterDuplicateCheck, err := prepareTorrentAddStart(
		request.Context(),
		targetDaemon.Client,
		&addRequest,
		hashKnown,
	)
	if err != nil {
		server.logInternalError("prepare Transmission torrent add", err)
		writeError(
			responseWriter,
			http.StatusServiceUnavailable,
			"transmission_unavailable",
			"Transmission is unavailable.",
		)

		return
	}

	var result transmissionrpc.AddTorrentResponse
	if !server.callTransmissionClientOperation(
		responseWriter,
		targetDaemon.Client,
		transmissionrpc.MethodTorrentAdd,
		func(client *transmissionrpc.Adapter) error {
			var callError error
			result, callError = client.AddTorrent(request.Context(), addRequest)

			return callError
		},
		http.StatusUnprocessableEntity,
	) {
		return
	}

	if result.Added == nil && result.Duplicate == nil || result.Added != nil && result.Duplicate != nil {
		server.logInternalError(
			"decode Transmission "+transmissionrpc.MethodTorrentAdd.String()+" result",
			errors.New(transmissionrpc.MethodTorrentAdd.String()+" returned neither or both result variants"),
		)
		writeError(
			responseWriter,
			http.StatusBadGateway,
			"transmission_invalid_response",
			"Transmission returned an invalid "+transmissionrpc.MethodTorrentAdd.String()+" response.",
		)

		return
	}

	added := result.Added
	duplicate := false
	if result.Duplicate != nil {
		added = result.Duplicate
		duplicate = true
	}
	if added.ID <= 0 || strings.TrimSpace(added.HashString) == "" {
		server.logInternalError(
			"decode Transmission "+transmissionrpc.MethodTorrentAdd.String()+" result",
			errors.New(transmissionrpc.MethodTorrentAdd.String()+" omitted the torrent identifier or hash"),
		)
		writeError(
			responseWriter,
			http.StatusBadGateway,
			"transmission_invalid_response",
			"Transmission returned an invalid "+transmissionrpc.MethodTorrentAdd.String()+" response.",
		)

		return
	}
	added.HashString = strings.ToLower(added.HashString)
	facadeID, err := transmissionrpc.FacadeID(targetDaemon.Slot, added.ID)
	if err != nil {
		server.logger.Error(
			"Transmission daemon ID exceeds the facade limit",
			"connectionId",
			targetDaemon.ConnectionID,
			"daemonId",
			added.ID,
			"error",
			err,
		)
		writeError(
			responseWriter,
			http.StatusBadGateway,
			"transmission_invalid_response",
			"Transmission returned an invalid torrent identifier.",
		)

		return
	}

	if existing, found := refreshedLocations[added.HashString]; found &&
		existing.ConnectionID != targetDaemon.ConnectionID {
		removeError := targetDaemon.Client.RemoveTorrents(
			request.Context(),
			transmissionrpc.RemoveTorrentsRequest{
				IDs:             []int64{added.ID},
				DeleteLocalData: false,
			},
		)
		if removeError != nil {
			server.logInternalError("remove cross-daemon duplicate torrent", removeError)
			writeError(
				responseWriter,
				http.StatusBadGateway,
				"duplicate_cleanup_failed",
				"The duplicate torrent could not be removed from the selected connection.",
			)

			return
		}

		profileName, profileError := server.torrentAddProfileName(request.Context(), added.HashString, defaultProfile.Name)
		if profileError != nil {
			server.logInternalError("read cross-daemon duplicate torrent profile", profileError)
			writeInternalError(responseWriter)

			return
		}
		writeJSON(responseWriter, http.StatusCreated, torrentAddResponse{
			ID:             existing.FacadeID,
			Hash:           added.HashString,
			Name:           existing.Name,
			Duplicate:      true,
			ProfileName:    profileName,
			ConnectionName: server.vpnConnectionName(request.Context(), existing.ConnectionID),
		})

		return
	}
	if !duplicate {
		labels := []string{}
		if addRequest.Labels != nil {
			labels = *addRequest.Labels
		}
		if _, err := server.saveTorrentLabels(request.Context(), labels); err != nil {
			server.logInternalError("save labels used by torrent add", err)
			writeInternalError(responseWriter)

			return
		}
	}

	applyProfile := !duplicate
	if duplicate {
		_, assigned := server.torrentProfileAssignments.profileID(added.HashString)
		applyProfile = !assigned
	}
	startRequest := request
	if applyProfile {
		profileContext, cancelProfile := detachedTorrentProfileContext(request.Context())
		defer cancelProfile()
		profileRequest := request.Clone(profileContext)
		startRequest = profileRequest

		if !server.callTransmissionClientOperation(
			responseWriter,
			targetDaemon.Client,
			transmissionrpc.MethodTorrentSet,
			func(client *transmissionrpc.Adapter) error {
				return client.SetTorrents(
					profileContext,
					torrentProfileSetArguments(
						profile,
						[]int64{added.ID},
						duplicate && !clientLabels,
					),
				)
			},
			http.StatusUnprocessableEntity,
		) {
			return
		}
		if duplicate && !clientLabels {
			if _, err := server.saveTorrentLabels(profileContext, profile.Labels); err != nil {
				server.logInternalError("save profile labels used by duplicate torrent", err)
				writeInternalError(responseWriter)

				return
			}
		}
		if profile.Options.Queue == "top" && !server.callTransmissionClientOperation(
			responseWriter,
			targetDaemon.Client,
			transmissionrpc.MethodQueueMoveTop,
			func(client *transmissionrpc.Adapter) error {
				return client.MoveTorrentsToQueueTop(
					profileContext,
					transmissionrpc.TorrentSelectionRequest{IDs: []int64{added.ID}},
				)
			},
			http.StatusUnprocessableEntity,
		) {
			return
		}

		var assignmentProfileID *string
		if namedProfile != nil {
			assignmentProfileID = &profile.ID
		}
		if err := server.store.ReplaceTorrentProfileAssignments(
			profileContext,
			[]string{added.HashString},
			assignmentProfileID,
		); err != nil {
			server.logInternalError("record torrent profile assignment", err)
			writeInternalError(responseWriter)

			return
		}
		if err := server.refreshTorrentProfileAssignments(profileContext); err != nil {
			server.logInternalError("refresh torrent profile assignments after add", err)
			writeInternalError(responseWriter)

			return
		}
	}
	if startAfterDuplicateCheck && !duplicate && !server.callTransmissionClientOperation(
		responseWriter,
		targetDaemon.Client,
		transmissionrpc.MethodTorrentStart,
		func(client *transmissionrpc.Adapter) error {
			return client.StartTorrents(
				startRequest.Context(),
				transmissionrpc.TorrentSelectionRequest{IDs: []int64{added.ID}},
			)
		},
		http.StatusUnprocessableEntity,
	) {
		return
	}
	server.rememberTorrentLocation(added.HashString, torrentLocation{
		ConnectionID: targetDaemon.ConnectionID,
		FacadeID:     facadeID,
		Name:         added.Name,
	})
	profileName, err := server.torrentAddProfileName(request.Context(), added.HashString, profile.Name)
	if err != nil {
		server.logInternalError("read added torrent profile", err)
		writeInternalError(responseWriter)

		return
	}

	writeJSON(responseWriter, http.StatusCreated, torrentAddResponse{
		ID:             facadeID,
		Hash:           added.HashString,
		Name:           added.Name,
		Duplicate:      duplicate,
		ProfileName:    profileName,
		ConnectionName: server.vpnConnectionName(request.Context(), targetDaemon.ConnectionID),
	})
}

// torrentAddProfileName resolves the durable owner of a duplicate or completed add.
func (server *Server) torrentAddProfileName(
	ctx context.Context,
	hash string,
	fallbackName string,
) (string, error) {
	profileID, assigned := server.torrentProfileAssignments.profileID(hash)
	if !assigned {
		return fallbackName, nil
	}
	profile, err := server.store.FindTorrentProfile(ctx, profileID)
	if err != nil {
		return "", err
	}

	return profile.Name, nil
}

// detachedTorrentProfileContext lets committed torrent additions finish their profile.
//
// A browser disconnect no longer cancels the follow-up RPC and assignment work, while
// the timeout bounds a daemon or database that stops answering.
func detachedTorrentProfileContext(ctx context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.WithoutCancel(ctx), torrentProfileApplyTimeout)
}

// handleSetTorrentProfile assigns or clears profiles for existing torrents.
//
// Hashes are resolved from Transmission first. Applying options changes labels and
// per-torrent options; selecting a profile on another connection also moves the
// torrent, while queue position remains untouched.
func (server *Server) handleSetTorrentProfile(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	var input struct {
		IDs          []int64         `json:"ids"`
		Hashes       *[]string       `json:"hashes"`
		ProfileID    json.RawMessage `json:"profileId"`
		ApplyOptions bool            `json:"applyOptions"`
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}
	normalizedHashes, selectionField, err := normalizeTorrentMutationSelection(input.IDs, input.Hashes)
	if err != nil {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "torrent_selection_invalid", selectionField, err.Error())

		return
	}
	if len(input.ProfileID) == 0 {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "profileId", "profileId must be a torrent profile identifier or null.")

		return
	}

	profile, err := server.defaultTorrentProfile(request.Context())
	if err != nil {
		server.logInternalError("read Default torrent profile for reassignment", err)
		writeInternalError(responseWriter)

		return
	}
	var profileID *string
	if string(bytes.TrimSpace(input.ProfileID)) != "null" {
		var id string
		if decodeOneJSONValue(input.ProfileID, &id) != nil || !validTorrentProfileID(id) {
			writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "profileId", "profileId must be a torrent profile identifier or null.")

			return
		}
		storedProfile, err := server.store.FindTorrentProfile(request.Context(), id)
		if errors.Is(err, storage.ErrNotFound) {
			writeTorrentProfileNotFound(responseWriter)

			return
		}
		if err != nil {
			server.logInternalError("read torrent profile for reassignment", err)
			writeInternalError(responseWriter)

			return
		}
		profile = storedProfile
		profileID = &storedProfile.ID
	}

	resolvedHashes, err := server.torrentHashesForSelection(
		request.Context(),
		input.IDs,
		normalizedHashes,
	)
	if err != nil {
		writeTorrentSelectionResolutionError(responseWriter, err)

		return
	}
	resolutionHashes := map[string]struct{}{}
	for _, hash := range resolvedHashes {
		if _, found := server.torrentProfileAssignments.needsProfileIDs(hash); found {
			resolutionHashes[strings.ToLower(hash)] = struct{}{}
		}
	}
	if len(resolutionHashes) > 0 {
		input.ApplyOptions = true
	}
	targetConnectionID, err := server.effectiveVPNConnectionID(
		request.Context(),
		profile.ConnectionID,
	)
	if err != nil {
		server.logInternalError("resolve reassigned torrent profile connection", err)
		writeError(responseWriter, http.StatusServiceUnavailable, "transmission_unavailable", "Transmission is unavailable for the selected connection.")

		return
	}
	releaseConnectionReference, removing := server.holdVPNConnectionIDReference(
		targetConnectionID,
	)
	if removing {
		writeConnectionBeingRemoved(responseWriter)

		return
	}
	defer releaseConnectionReference()
	locations, err := server.torrentLocations(request.Context(), resolvedHashes)
	if err != nil {
		writeTorrentSelectionResolutionError(responseWriter, err)

		return
	}

	if input.ApplyOptions {
		preserveExistingLabels := len(resolutionHashes) > 0
		arguments := torrentProfileSetArguments(profile, nil, !preserveExistingLabels)
		failures, callError := server.callTransmissionBySelection(
			request.Context(),
			torrentSetSelectionOperation(request.Context(), arguments.Changes),
			input.IDs,
			normalizedHashes,
		)
		if callError != nil {
			writeTorrentSelectionResolutionError(responseWriter, callError)

			return
		}
		if server.writeTorrentOperationFailures(
			responseWriter,
			transmissionrpc.MethodTorrentSet,
			selectionField,
			failures,
		) {
			return
		}
		labelsToSave := profile.Labels
		if preserveExistingLabels {
			labelsToSave = []string{}
			normalHashes := []string{}
			for _, hash := range resolvedHashes {
				if _, resolving := resolutionHashes[hash]; !resolving {
					normalHashes = append(normalHashes, hash)

					continue
				}
				labels, mergeError := mergeTorrentLabels(locations[hash].Labels, profile.Labels)
				if mergeError != nil {
					writeError(
						responseWriter,
						http.StatusUnprocessableEntity,
						"torrent_labels_invalid",
						mergeError.Error(),
					)

					return
				}
				failures, callError = server.callTransmissionBySelection(
					request.Context(),
					torrentLabelSelectionOperation(request.Context(), labels),
					nil,
					[]string{hash},
				)
				if callError != nil {
					writeTorrentSelectionResolutionError(responseWriter, callError)

					return
				}
				if server.writeTorrentOperationFailures(
					responseWriter,
					transmissionrpc.MethodTorrentSet,
					selectionField,
					failures,
				) {
					return
				}
				labelsToSave, err = mergeTorrentLabels(labelsToSave, labels)
				if err != nil {
					server.logInternalError("collect labels used by torrent profile", err)
					writeInternalError(responseWriter)

					return
				}
			}
			if len(normalHashes) > 0 {
				failures, callError = server.callTransmissionBySelection(
					request.Context(),
					torrentLabelSelectionOperation(request.Context(), profile.Labels),
					nil,
					normalHashes,
				)
				if callError != nil {
					writeTorrentSelectionResolutionError(responseWriter, callError)

					return
				}
				if server.writeTorrentOperationFailures(
					responseWriter,
					transmissionrpc.MethodTorrentSet,
					selectionField,
					failures,
				) {
					return
				}
				labelsToSave, err = mergeTorrentLabels(labelsToSave, profile.Labels)
				if err != nil {
					server.logInternalError("collect labels used by torrent profile", err)
					writeInternalError(responseWriter)

					return
				}
			}
		}
		if _, err := server.saveTorrentLabels(request.Context(), labelsToSave); err != nil {
			server.logInternalError("save labels used by torrent profile", err)
			writeInternalError(responseWriter)

			return
		}
		if profile.Options.Queue == "top" {
			failures, callError = server.callTransmissionBySelection(
				request.Context(),
				torrentActionSelectionOperation(
					request.Context(),
					transmissionrpc.MethodQueueMoveTop,
				),
				input.IDs,
				normalizedHashes,
			)
			if callError != nil {
				writeTorrentSelectionResolutionError(responseWriter, callError)

				return
			}
			if server.writeTorrentOperationFailures(
				responseWriter,
				transmissionrpc.MethodQueueMoveTop,
				selectionField,
				failures,
			) {
				return
			}
		}
	}

	if err := server.store.ReplaceTorrentProfileAssignments(request.Context(), resolvedHashes, profileID); err != nil {
		server.logInternalError("replace torrent profile assignments", err)
		writeInternalError(responseWriter)

		return
	}
	if err := server.refreshTorrentProfileAssignments(request.Context()); err != nil {
		server.logInternalError("refresh torrent profile assignments after reassignment", err)
		writeInternalError(responseWriter)

		return
	}

	moved := []torrentMoveResult{}
	moveContext := context.WithoutCancel(request.Context())
	for _, hash := range resolvedHashes {
		location := locations[hash]
		_, location.DeferRunState = resolutionHashes[strings.ToLower(hash)]
		result, _ := server.moveTorrentToProfile(
			moveContext,
			location,
			targetConnectionID,
			profile.DownloadDirectory,
		)
		moved = append(moved, result)
	}
	if len(resolutionHashes) > 0 {
		stateHashes := make([]string, 0, len(resolutionHashes))
		for _, result := range moved {
			if _, resolving := resolutionHashes[strings.ToLower(result.Hash)]; resolving && result.Result != "failed" {
				stateHashes = append(stateHashes, result.Hash)
			}
		}
		if len(stateHashes) > 0 {
			operation := "start resolved torrent profiles"
			if profile.StartPaused {
				operation = "pause resolved torrent profiles"
			}
			// A folder move or verification can briefly hide the torrent from a fresh
			// selection lookup, but every resolved torrent now belongs to this daemon.
			target, found := server.transmissionDaemonForConnection(moveContext, targetConnectionID)
			if !found {
				server.logInternalError(operation, errors.New("the selected profile's Transmission daemon is unavailable"))
			} else {
				var stateError error
				if profile.StartPaused {
					stateError = target.Client.StopTorrents(
						moveContext,
						transmissionrpc.TorrentSelectionRequest{IDs: stateHashes},
					)
				} else {
					stateError = target.Client.StartTorrents(
						moveContext,
						transmissionrpc.TorrentSelectionRequest{IDs: stateHashes},
					)
				}
				if stateError != nil {
					server.logInternalError(operation, stateError)
				}
			}
		}
	}

	response := torrentMutationResponse(input.IDs, normalizedHashes)
	response["profileId"] = profileID
	response["applyOptions"] = input.ApplyOptions
	response["moved"] = moved
	writeJSON(responseWriter, http.StatusOK, response)
}

// torrentProfileSetArguments maps one profile to per-torrent Transmission fields.
func torrentProfileSetArguments(
	profile storage.TorrentProfile,
	ids []int64,
	includeLabels bool,
) transmissionrpc.SetTorrentsRequest {
	changes := map[transmissionrpc.TorrentArgument]any{
		transmissionrpc.TorrentArgumentBandwidthPriority: profile.Options.BandwidthPriority,
		transmissionrpc.TorrentArgumentPeerLimit:         profile.Options.PeerLimit,
	}
	if includeLabels {
		changes[transmissionrpc.TorrentArgumentLabels] = profile.Labels
	}

	if profile.Options.Seeding.Mode == "limit" {
		if profile.Options.Seeding.Ratio != nil {
			changes[transmissionrpc.TorrentArgumentSeedRatioMode] = 1
			changes[transmissionrpc.TorrentArgumentSeedRatioLimit] = *profile.Options.Seeding.Ratio
		} else {
			changes[transmissionrpc.TorrentArgumentSeedRatioMode] = 2
		}
		if profile.Options.Seeding.IdleMinutes != nil {
			changes[transmissionrpc.TorrentArgumentSeedIdleMode] = 1
			changes[transmissionrpc.TorrentArgumentSeedIdleLimit] = *profile.Options.Seeding.IdleMinutes
		} else {
			changes[transmissionrpc.TorrentArgumentSeedIdleMode] = 2
		}
	} else {
		changes[transmissionrpc.TorrentArgumentSeedRatioMode] = 2
		changes[transmissionrpc.TorrentArgumentSeedIdleMode] = 2
	}

	changes[transmissionrpc.TorrentArgumentDownloadLimited] = profile.Options.DownloadLimitKBps != nil
	if profile.Options.DownloadLimitKBps != nil {
		changes[transmissionrpc.TorrentArgumentDownloadLimit] = *profile.Options.DownloadLimitKBps
	}
	changes[transmissionrpc.TorrentArgumentUploadLimited] = profile.Options.UploadLimitKBps != nil
	if profile.Options.UploadLimitKBps != nil {
		changes[transmissionrpc.TorrentArgumentUploadLimit] = *profile.Options.UploadLimitKBps
	}

	return transmissionrpc.SetTorrentsRequest{
		IDs:     ids,
		Changes: changes,
	}
}

// handleTorrentAction maps a closed action vocabulary to Transmission RPC methods.
func (server *Server) handleTorrentAction(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	var input struct {
		Action string    `json:"action"`
		Hashes *[]string `json:"hashes"`
		IDs    []int64   `json:"ids"`
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}
	normalizedHashes, selectionField, err := normalizeTorrentMutationSelection(input.IDs, input.Hashes)
	if err != nil {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "torrent_selection_invalid", selectionField, err.Error())

		return
	}

	methods := map[string]transmissionrpc.Method{
		"queue-bottom": transmissionrpc.MethodQueueMoveBottom,
		"queue-down":   transmissionrpc.MethodQueueMoveDown,
		"queue-top":    transmissionrpc.MethodQueueMoveTop,
		"queue-up":     transmissionrpc.MethodQueueMoveUp,
		"reannounce":   transmissionrpc.MethodTorrentReannounce,
		"start":        transmissionrpc.MethodTorrentStart,
		"start-now":    transmissionrpc.MethodTorrentStartNow,
		"stop":         transmissionrpc.MethodTorrentStop,
		"verify":       transmissionrpc.MethodTorrentVerify,
	}
	method, found := methods[input.Action]
	if !found {
		writeError(
			responseWriter,
			http.StatusUnprocessableEntity,
			"torrent_action_invalid",
			"The requested torrent action is unsupported.",
		)

		return
	}
	failures, err := server.callTransmissionBySelection(
		request.Context(),
		torrentActionSelectionOperation(request.Context(), method),
		input.IDs,
		normalizedHashes,
	)
	if err != nil {
		writeTorrentSelectionResolutionError(responseWriter, err)

		return
	}
	if server.writeTorrentOperationFailures(responseWriter, method, selectionField, failures) {
		return
	}

	response := torrentMutationResponse(input.IDs, normalizedHashes)
	response["action"] = input.Action
	writeJSON(responseWriter, http.StatusOK, response)
}

// handleUpdateTorrents applies a validated set of supported per-torrent properties.
func (server *Server) handleUpdateTorrents(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	var input struct {
		Changes map[string]json.RawMessage `json:"changes"`
		Hashes  *[]string                  `json:"hashes"`
		IDs     []int64                    `json:"ids"`
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}
	normalizedHashes, selectionField, err := normalizeTorrentMutationSelection(input.IDs, input.Hashes)
	if err != nil {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "torrent_selection_invalid", selectionField, err.Error())

		return
	}
	if len(input.Changes) == 0 {
		writeError(
			responseWriter,
			http.StatusUnprocessableEntity,
			"torrent_changes_required",
			"changes must contain at least one supported property.",
		)

		return
	}

	arguments := map[transmissionrpc.TorrentArgument]any{}
	for key, value := range input.Changes {
		rpcKey, decodedValue, err := validateTorrentChange(key, value)
		if err != nil {
			writeError(responseWriter, http.StatusUnprocessableEntity, "torrent_change_invalid", err.Error())

			return
		}
		arguments[rpcKey] = decodedValue
	}

	failures, err := server.callTransmissionBySelection(
		request.Context(),
		torrentSetSelectionOperation(request.Context(), arguments),
		input.IDs,
		normalizedHashes,
	)
	if err != nil {
		writeTorrentSelectionResolutionError(responseWriter, err)

		return
	}
	selectionCount := len(input.IDs)
	if normalizedHashes != nil {
		selectionCount = len(normalizedHashes)
	}
	if labels, changed := arguments[transmissionrpc.TorrentArgumentLabels].([]string); changed &&
		len(failures) < selectionCount {
		if _, err := server.saveTorrentLabels(request.Context(), labels); err != nil {
			server.logInternalError("save labels used by torrent update", err)
			writeInternalError(responseWriter)

			return
		}
	}
	if server.writeTorrentOperationFailures(
		responseWriter,
		transmissionrpc.MethodTorrentSet,
		selectionField,
		failures,
	) {
		return
	}

	writeJSON(responseWriter, http.StatusOK, torrentMutationResponse(input.IDs, normalizedHashes))
}

// handleRemoveTorrents requires explicit IDs and explicit local-data intent.
func (server *Server) handleRemoveTorrents(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	var input struct {
		DeleteLocalData bool      `json:"deleteLocalData"`
		Hashes          *[]string `json:"hashes"`
		IDs             []int64   `json:"ids"`
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}
	normalizedHashes, selectionField, err := normalizeTorrentMutationSelection(input.IDs, input.Hashes)
	if err != nil {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "torrent_selection_invalid", selectionField, err.Error())

		return
	}
	resolvedHashes, err := server.torrentHashesForSelection(
		request.Context(),
		input.IDs,
		normalizedHashes,
	)
	if err != nil {
		writeTorrentSelectionResolutionError(responseWriter, err)

		return
	}

	failures, err := server.callTransmissionBySelection(
		request.Context(),
		torrentRemoveSelectionOperation(request.Context(), input.DeleteLocalData),
		input.IDs,
		normalizedHashes,
	)
	if err != nil {
		writeTorrentSelectionResolutionError(responseWriter, err)

		return
	}
	if server.writeTorrentOperationFailures(
		responseWriter,
		transmissionrpc.MethodTorrentRemove,
		selectionField,
		failures,
	) {
		return
	}
	if err := server.store.DeleteTorrentProfileRecords(request.Context(), resolvedHashes); err != nil {
		server.logInternalError("delete removed torrent profile records", err)
		writeInternalError(responseWriter)

		return
	}
	if err := server.refreshTorrentProfileAssignments(request.Context()); err != nil {
		server.logInternalError("refresh torrent profile records after removal", err)
		writeInternalError(responseWriter)

		return
	}

	responseWriter.WriteHeader(http.StatusNoContent)
}

// handleRenameTorrentPath renames one relative path without allowing mount traversal.
func (server *Server) handleRenameTorrentPath(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	var input struct {
		Hashes *[]string `json:"hashes"`
		ID     int64     `json:"id"`
		Name   string    `json:"name"`
		Path   string    `json:"path"`
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}
	identifiers := []int64{input.ID}
	normalizedHashes, selectionField, err := normalizeTorrentMutationSelection(identifiers, input.Hashes)
	if err != nil || (normalizedHashes != nil && len(normalizedHashes) != 1) ||
		!validRelativeTorrentPath(input.Path) || !validTorrentName(input.Name) {
		writeError(
			responseWriter,
			http.StatusUnprocessableEntity,
			"torrent_rename_invalid",
			"id, path, or name is invalid.",
		)

		return
	}

	groups, err := server.resolveTorrentCallGroups(request.Context(), identifiers, normalizedHashes)
	if err != nil {
		writeTorrentSelectionResolutionError(responseWriter, err)

		return
	}
	if len(groups) != 1 || len(groups[0].Indexes) != 1 {
		writeTorrentSelectionResolutionError(responseWriter, errTorrentSelectionNotFound)

		return
	}
	group := groups[0]
	result, err := group.Daemon.Client.RenameTorrentPath(
		request.Context(),
		transmissionrpc.RenameTorrentPathRequest{
			IDs:  group.Identifiers,
			Name: input.Name,
			Path: input.Path,
		},
	)
	if err != nil {
		var resultError *transmissionrpc.ResultError
		if errors.As(err, &resultError) {
			writeError(
				responseWriter,
				http.StatusUnprocessableEntity,
				"transmission_rejected",
				"Transmission rejected the requested operation.",
			)
		} else {
			server.logInternalError("rename Transmission torrent path", err)
			writeError(
				responseWriter,
				http.StatusServiceUnavailable,
				"transmission_unavailable",
				"Transmission is unavailable for this torrent.",
			)
		}

		return
	}

	if result == nil {
		result = map[string]any{}
	}
	if normalizedHashes != nil {
		result[selectionField] = normalizedHashes
	} else {
		result[selectionField] = identifiers
	}
	writeJSON(responseWriter, http.StatusOK, result)
}

// callTransmissionOperation centralizes daemon availability and safe error translation.
func (server *Server) callTransmissionOperation(
	responseWriter http.ResponseWriter,
	method transmissionrpc.Method,
	operation func(*transmissionrpc.Adapter) error,
	rejectionStatus int,
) bool {
	if server.transmission == nil {
		writeError(
			responseWriter,
			http.StatusServiceUnavailable,
			"transmission_unavailable",
			"Transmission is unavailable.",
		)

		return false
	}

	return server.callTransmissionClientOperation(
		responseWriter,
		server.transmission,
		method,
		operation,
		rejectionStatus,
	)
}

// callTransmissionClientOperation translates one explicitly routed daemon operation.
func (server *Server) callTransmissionClientOperation(
	responseWriter http.ResponseWriter,
	client *transmissionrpc.Adapter,
	method transmissionrpc.Method,
	operation func(*transmissionrpc.Adapter) error,
	rejectionStatus int,
) bool {
	err := operation(client)
	if err == nil {
		return true
	}

	var resultError *transmissionrpc.ResultError
	if errors.As(err, &resultError) {
		server.logger.Warn("Transmission rejected an RPC operation", "method", method.String())
		writeError(
			responseWriter,
			rejectionStatus,
			"transmission_rejected",
			"Transmission rejected the requested operation.",
		)

		return false
	}

	server.logInternalError("call Transmission RPC method "+method.String(), err)
	writeError(
		responseWriter,
		http.StatusServiceUnavailable,
		"transmission_unavailable",
		"Transmission is unavailable.",
	)

	return false
}

func torrentSetSelectionOperation(
	ctx context.Context,
	changes map[transmissionrpc.TorrentArgument]any,
) torrentSelectionOperation {
	return torrentSelectionOperation{
		Method: transmissionrpc.MethodTorrentSet,
		Run: func(client *transmissionrpc.Adapter, ids any) error {
			return client.SetTorrents(ctx, transmissionrpc.SetTorrentsRequest{
				IDs:     ids,
				Changes: changes,
			})
		},
	}
}

func torrentLabelSelectionOperation(
	ctx context.Context,
	labels []string,
) torrentSelectionOperation {
	return torrentSelectionOperation{
		Method: transmissionrpc.MethodTorrentSet,
		Run: func(client *transmissionrpc.Adapter, ids any) error {
			return client.SetTorrentLabels(ctx, transmissionrpc.SetTorrentLabelsRequest{
				IDs:    ids,
				Labels: labels,
			})
		},
	}
}

func torrentRemoveSelectionOperation(
	ctx context.Context,
	deleteLocalData bool,
) torrentSelectionOperation {
	return torrentSelectionOperation{
		Method: transmissionrpc.MethodTorrentRemove,
		Run: func(client *transmissionrpc.Adapter, ids any) error {
			return client.RemoveTorrents(ctx, transmissionrpc.RemoveTorrentsRequest{
				IDs:             ids,
				DeleteLocalData: deleteLocalData,
			})
		},
	}
}

func torrentActionSelectionOperation(
	ctx context.Context,
	method transmissionrpc.Method,
) torrentSelectionOperation {
	return torrentSelectionOperation{
		Method: method,
		Run: func(client *transmissionrpc.Adapter, ids any) error {
			request := transmissionrpc.TorrentSelectionRequest{IDs: ids}
			switch method {
			case transmissionrpc.MethodQueueMoveBottom:
				return client.MoveTorrentsToQueueBottom(ctx, request)
			case transmissionrpc.MethodQueueMoveDown:
				return client.MoveTorrentsDown(ctx, request)
			case transmissionrpc.MethodQueueMoveTop:
				return client.MoveTorrentsToQueueTop(ctx, request)
			case transmissionrpc.MethodQueueMoveUp:
				return client.MoveTorrentsUp(ctx, request)
			case transmissionrpc.MethodTorrentReannounce:
				return client.ReannounceTorrents(ctx, request)
			case transmissionrpc.MethodTorrentStart:
				return client.StartTorrents(ctx, request)
			case transmissionrpc.MethodTorrentStartNow:
				return client.StartTorrentsNow(ctx, request)
			case transmissionrpc.MethodTorrentStop:
				return client.StopTorrents(ctx, request)
			case transmissionrpc.MethodTorrentVerify:
				return client.VerifyTorrents(ctx, request)
			default:
				return errors.New("unsupported typed torrent action")
			}
		},
	}
}

func parseTorrentSelection(value string, allowRecentlyActive bool) (any, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}
	if allowRecentlyActive && value == "recently-active" {
		return value, nil
	}

	parts := strings.Split(value, ",")
	identifiers := make([]int64, 0, len(parts))
	for _, part := range parts {
		identifier, err := strconv.ParseInt(strings.TrimSpace(part), 10, 64)
		if err != nil || identifier <= 0 {
			return nil, errors.New("ids must be comma-separated positive integers")
		}
		identifiers = append(identifiers, identifier)
	}

	if err := validateTorrentIDs(identifiers); err != nil {
		return nil, err
	}

	return identifiers, nil
}

func validateTorrentIDs(identifiers []int64) error {
	if len(identifiers) == 0 || len(identifiers) > 1000 {
		return errors.New("ids must contain between 1 and 1000 torrent identifiers")
	}

	seen := make(map[int64]struct{}, len(identifiers))
	for _, identifier := range identifiers {
		if identifier <= 0 {
			return errors.New("torrent identifiers must be positive integers")
		}
		if _, found := seen[identifier]; found {
			return errors.New("torrent identifiers must not contain duplicates")
		}
		seen[identifier] = struct{}{}
	}

	return nil
}

// normalizeTorrentMutationSelection gives present hashes precedence over facade IDs.
func normalizeTorrentMutationSelection(
	identifiers []int64,
	hashes *[]string,
) ([]string, string, error) {
	if hashes != nil {
		normalized, err := normalizeTorrentHashes(*hashes)

		return normalized, "hashes", err
	}
	if len(identifiers) == 0 || len(identifiers) > 1000 {
		return nil, "ids", errors.New("ids must contain between 1 and 1000 torrent identifiers")
	}

	seen := make(map[int64]struct{}, len(identifiers))
	for _, identifier := range identifiers {
		if _, found := seen[identifier]; found {
			return nil, "ids", errors.New("torrent identifiers must not contain duplicates")
		}
		seen[identifier] = struct{}{}
	}

	return nil, "ids", nil
}

// writeTorrentSelectionResolutionError maps stable target lookup failures.
func writeTorrentSelectionResolutionError(responseWriter http.ResponseWriter, err error) {
	if errors.Is(err, errTorrentSelectionNotFound) {
		writeError(
			responseWriter,
			http.StatusNotFound,
			"torrent_not_found",
			"One or more torrents were not found.",
		)

		return
	}

	writeError(
		responseWriter,
		http.StatusServiceUnavailable,
		"transmission_unavailable",
		"Transmission is unavailable for one or more torrents.",
	)
}

// torrentMutationResponse identifies the selection form that the server used.
func torrentMutationResponse(identifiers []int64, hashes []string) map[string]any {
	if hashes != nil {
		return map[string]any{"hashes": hashes}
	}

	return map[string]any{"ids": identifiers}
}

func validateTorrentURL(value string) error {
	parsedURL, err := url.Parse(value)
	if err != nil || parsedURL.Scheme == "" {
		return errors.New("filename must be an HTTP, HTTPS, or magnet URL")
	}

	switch strings.ToLower(parsedURL.Scheme) {
	case "http", "https":
		if parsedURL.Hostname() == "" || parsedURL.User != nil {
			return errors.New("torrent URLs require a host and cannot embed credentials")
		}
	case "magnet":
		if parsedURL.Query().Get("xt") == "" {
			return errors.New("magnet URLs must contain an xt identifier")
		}
	default:
		return errors.New("filename must be an HTTP, HTTPS, or magnet URL")
	}

	return nil
}

func validateLabels(labels []string) error {
	if len(labels) > 64 {
		return errors.New("labels must contain no more than 64 values")
	}

	seenLabels := make(map[string]struct{}, len(labels))
	for _, label := range labels {
		if strings.TrimSpace(label) != label || label == "" || len(label) > 128 {
			return errors.New("each label must contain between 1 and 128 trimmed characters")
		}
		if strings.Contains(label, ",") {
			return errors.New("Labels can't contain commas.")
		}
		normalizedLabel := strings.ToLower(label)
		if _, found := seenLabels[normalizedLabel]; found {
			return errors.New("labels must not contain duplicates")
		}
		seenLabels[normalizedLabel] = struct{}{}
	}

	return nil
}

// mergeTorrentLabels preserves existing labels and appends missing profile labels.
func mergeTorrentLabels(existing []string, profileLabels []string) ([]string, error) {
	merged := append([]string{}, existing...)
	seen := make(map[string]struct{}, len(existing)+len(profileLabels))
	for _, label := range existing {
		seen[strings.ToLower(label)] = struct{}{}
	}
	for _, label := range profileLabels {
		if _, found := seen[strings.ToLower(label)]; found {
			continue
		}
		merged = append(merged, label)
		seen[strings.ToLower(label)] = struct{}{}
	}
	if err := validateLabels(merged); err != nil {
		return nil, err
	}

	return merged, nil
}

func validateTorrentChange(
	key string,
	value json.RawMessage,
) (transmissionrpc.TorrentArgument, any, error) {
	switch key {
	case "bandwidthPriority":
		return integerTorrentChange(
			key,
			transmissionrpc.TorrentArgumentBandwidthPriority,
			value,
			-1,
			1,
		)
	case "downloadLimit":
		return integerTorrentChange(key, transmissionrpc.TorrentArgumentDownloadLimit, value, 0, 1_000_000_000)
	case "uploadLimit":
		return integerTorrentChange(key, transmissionrpc.TorrentArgumentUploadLimit, value, 0, 1_000_000_000)
	case "peerLimit":
		return integerTorrentChange(key, transmissionrpc.TorrentArgumentPeerLimit, value, 1, 10000)
	case "queuePosition":
		return integerTorrentChange(key, transmissionrpc.TorrentArgumentQueuePosition, value, 0, 1_000_000)
	case "seedIdleLimit":
		return integerTorrentChange(key, transmissionrpc.TorrentArgumentSeedIdleLimit, value, 1, 525600)
	case "seedIdleMode":
		return integerTorrentChange(key, transmissionrpc.TorrentArgumentSeedIdleMode, value, 0, 2)
	case "seedRatioMode":
		return integerTorrentChange(key, transmissionrpc.TorrentArgumentSeedRatioMode, value, 0, 2)
	case "downloadLimited":
		decoded, err := decodeRawBoolean(value)
		return transmissionrpc.TorrentArgumentDownloadLimited, decoded, wrapTorrentChangeError(key, err)
	case "honorsSessionLimits":
		decoded, err := decodeRawBoolean(value)
		return transmissionrpc.TorrentArgumentHonorsSessionLimits, decoded, wrapTorrentChangeError(key, err)
	case "uploadLimited":
		decoded, err := decodeRawBoolean(value)
		return transmissionrpc.TorrentArgumentUploadLimited, decoded, wrapTorrentChangeError(key, err)
	case "seedRatioLimit":
		decoded, err := decodeRawNumber(value, 0, 10000)
		return transmissionrpc.TorrentArgumentSeedRatioLimit, decoded, wrapTorrentChangeError(key, err)
	case "labels":
		decoded, err := decodeRawStringList(value)
		if err == nil {
			err = validateLabels(decoded)
		}
		return transmissionrpc.TorrentArgumentLabels, decoded, wrapTorrentChangeError(key, err)
	case "trackerList":
		decoded, err := decodeRawString(value)
		if err == nil && len(decoded) > 256*1024 {
			err = errors.New("must not exceed 256 KiB")
		}
		return transmissionrpc.TorrentArgumentTrackerList, decoded, wrapTorrentChangeError(key, err)
	case "filesWanted", "filesUnwanted", "priorityHigh", "priorityLow", "priorityNormal":
		rpcKeys := map[string]transmissionrpc.TorrentArgument{
			"filesWanted":    transmissionrpc.TorrentArgumentFilesWanted,
			"filesUnwanted":  transmissionrpc.TorrentArgumentFilesUnwanted,
			"priorityHigh":   transmissionrpc.TorrentArgumentPriorityHigh,
			"priorityLow":    transmissionrpc.TorrentArgumentPriorityLow,
			"priorityNormal": transmissionrpc.TorrentArgumentPriorityNormal,
		}
		decoded, err := decodeRawIndices(value)
		return rpcKeys[key], decoded, wrapTorrentChangeError(key, err)
	default:
		return "", nil, fmt.Errorf("unsupported torrent property: %s", key)
	}
}

func integerTorrentChange(
	key string,
	rpcKey transmissionrpc.TorrentArgument,
	value json.RawMessage,
	minimum int64,
	maximum int64,
) (transmissionrpc.TorrentArgument, any, error) {
	decoded, err := decodeRawInteger(value, minimum, maximum)

	return rpcKey, decoded, wrapTorrentChangeError(key, err)
}

func wrapTorrentChangeError(key string, err error) error {
	if err == nil {
		return nil
	}

	return fmt.Errorf("%s %w", key, err)
}

func decodeRawBoolean(value json.RawMessage) (bool, error) {
	var decoded bool
	if err := decodeOneJSONValue(value, &decoded); err != nil {
		return false, errors.New("must be a boolean")
	}

	return decoded, nil
}

func decodeRawInteger(value json.RawMessage, minimum int64, maximum int64) (int64, error) {
	var decoded json.Number
	if err := decodeOneJSONNumber(value, &decoded); err != nil {
		return 0, errors.New("must be an integer")
	}

	integer, err := decoded.Int64()
	if err != nil {
		return 0, errors.New("must be an integer")
	}
	if integer < minimum || integer > maximum {
		return 0, fmt.Errorf("must be between %d and %d", minimum, maximum)
	}

	return integer, nil
}

func decodeRawNumber(value json.RawMessage, minimum float64, maximum float64) (float64, error) {
	var decoded json.Number
	if err := decodeOneJSONNumber(value, &decoded); err != nil {
		return 0, errors.New("must be a number")
	}

	number, err := decoded.Float64()
	if err != nil || number < minimum || number > maximum {
		return 0, fmt.Errorf("must be between %g and %g", minimum, maximum)
	}

	return number, nil
}

func decodeRawString(value json.RawMessage) (string, error) {
	var decoded string
	if err := decodeOneJSONValue(value, &decoded); err != nil {
		return "", errors.New("must be a string")
	}

	return decoded, nil
}

func decodeRawStringList(value json.RawMessage) ([]string, error) {
	var decoded []string
	if err := decodeOneJSONValue(value, &decoded); err != nil || decoded == nil {
		return nil, errors.New("must be an array of strings")
	}

	return decoded, nil
}

func decodeRawIndices(value json.RawMessage) ([]int64, error) {
	var decoded []int64
	if err := decodeOneJSONValue(value, &decoded); err != nil || decoded == nil {
		return nil, errors.New("must be an array of file indices")
	}
	if len(decoded) > 100000 {
		return nil, errors.New("must contain no more than 100000 file indices")
	}

	seen := make(map[int64]struct{}, len(decoded))
	for _, index := range decoded {
		if index < 0 {
			return nil, errors.New("file indices must not be negative")
		}
		if _, found := seen[index]; found {
			return nil, errors.New("file indices must not contain duplicates")
		}
		seen[index] = struct{}{}
	}

	return decoded, nil
}

func decodeOneJSONValue(value json.RawMessage, target any) error {
	decoder := json.NewDecoder(bytes.NewReader(value))
	if err := decoder.Decode(target); err != nil {
		return err
	}

	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		return errors.New("contains trailing JSON data")
	}

	return nil
}

func decodeOneJSONNumber(value json.RawMessage, target *json.Number) error {
	decoder := json.NewDecoder(bytes.NewReader(value))
	decoder.UseNumber()
	if err := decoder.Decode(target); err != nil {
		return err
	}

	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		return errors.New("contains trailing JSON data")
	}

	return nil
}

func validRelativeTorrentPath(value string) bool {
	return value != "" && len(value) <= 4096 && !filepath.IsAbs(value) &&
		filepath.Clean(value) == value && value != "." && value != ".." &&
		!strings.HasPrefix(value, "../")
}

func validTorrentName(value string) bool {
	return value != "" && len(value) <= 255 && value != "." && value != ".." &&
		!strings.ContainsAny(value, "/\\")
}
