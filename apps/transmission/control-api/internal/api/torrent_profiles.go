package api

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

const (
	maximumTorrentProfileNameCharacters = 64
	maximumTorrentProfilePatterns       = 64
	maximumTorrentProfilePatternLength  = 128
)

// torrentProfileBody retains raw fields so validation can point at the exact value.
type torrentProfileBody struct {
	Name              json.RawMessage `json:"name"`
	DownloadDirectory json.RawMessage `json:"downloadDirectory"`
	Labels            json.RawMessage `json:"labels"`
	StartPaused       json.RawMessage `json:"startPaused"`
	Options           json.RawMessage `json:"options"`
	MatchPatterns     json.RawMessage `json:"matchPatterns"`
	ConnectionID      json.RawMessage `json:"connectionId"`
	MoveTorrents      json.RawMessage `json:"moveTorrents"`
}

// torrentProfileOverlap identifies one intersecting pattern on another profile.
type torrentProfileOverlap struct {
	ProfileID   string `json:"profileId"`
	ProfileName string `json:"profileName"`
	Pattern     string `json:"pattern"`
	OwnPattern  string `json:"ownPattern"`
}

// torrentProfileSummary adds informational overlaps to one stored profile.
type torrentProfileSummary struct {
	storage.TorrentProfile
	Overlaps []torrentProfileOverlap `json:"overlaps"`
}

// torrentProfileUpdateResponse adds the outcomes of connection-changing moves.
type torrentProfileUpdateResponse struct {
	torrentProfileSummary
	Moved []torrentMoveResult `json:"moved"`
}

// torrentProfileDeleteBody retains the optional move confirmation field.
type torrentProfileDeleteBody struct {
	MoveTorrents json.RawMessage `json:"moveTorrents"`
}

// torrentProfileDeleteResponse reports every confirmed Default profile move.
type torrentProfileDeleteResponse struct {
	Moved []torrentMoveResult `json:"moved"`
}

// defaultTorrentProfileBody retains the editable Default profile fields.
type defaultTorrentProfileBody struct {
	Name              json.RawMessage `json:"name"`
	DownloadDirectory json.RawMessage `json:"downloadDirectory"`
	Labels            json.RawMessage `json:"labels"`
	StartPaused       json.RawMessage `json:"startPaused"`
	Options           json.RawMessage `json:"options"`
	MoveTorrents      json.RawMessage `json:"moveTorrents"`
}

// defaultTorrentProfileSummary exposes the complete effective Default profile.
type defaultTorrentProfileSummary struct {
	Name                    string                        `json:"name"`
	DownloadDirectory       string                        `json:"downloadDirectory"`
	DownloadDirectoryLocked bool                          `json:"downloadDirectoryLocked"`
	Labels                  []string                      `json:"labels"`
	StartPaused             bool                          `json:"startPaused"`
	Options                 storage.TorrentProfileOptions `json:"options"`
}

// defaultTorrentProfileUpdateResponse reports every confirmed torrent move.
type defaultTorrentProfileUpdateResponse struct {
	defaultTorrentProfileSummary
	Moved []torrentMoveResult `json:"moved"`
}

// torrentProfilesResponse keeps the Default profile beside alphabetical named profiles.
type torrentProfilesResponse struct {
	DefaultProfile defaultTorrentProfileSummary  `json:"defaultProfile"`
	Profiles       []torrentProfileSummary       `json:"profiles"`
	FolderOverlaps []torrentProfileFolderOverlap `json:"folderOverlaps"`
}

// torrentProfileFolderOverlap names one saved profile whose folder breaks the one-folder rule.
//
// Setups saved before the rule existed, or seeded by managed configuration, can hold a
// profile folder inside another profile's folder. Each one is listed until it is fixed.
type torrentProfileFolderOverlap struct {
	ProfileID   string `json:"profileId"`
	ProfileName string `json:"profileName"`
	Message     string `json:"message"`
}

// torrentProfileOptionsBody is the strict JSON shape nested beneath options.
type torrentProfileOptionsBody struct {
	Seeding           json.RawMessage `json:"seeding"`
	DownloadLimitKBps json.RawMessage `json:"downloadLimitKBps"`
	UploadLimitKBps   json.RawMessage `json:"uploadLimitKBps"`
	BandwidthPriority json.RawMessage `json:"bandwidthPriority"`
	PeerLimit         json.RawMessage `json:"peerLimit"`
	Queue             json.RawMessage `json:"queue"`
}

// torrentProfileSeedingBody is the strict JSON shape nested beneath options.seeding.
type torrentProfileSeedingBody struct {
	Mode        json.RawMessage `json:"mode"`
	Ratio       json.RawMessage `json:"ratio"`
	IdleMinutes json.RawMessage `json:"idleMinutes"`
}

// handleListTorrentProfiles returns named profiles in alphabetical order.
func (server *Server) handleListTorrentProfiles(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	profiles, err := server.store.ListTorrentProfiles(request.Context())
	if err != nil {
		server.logInternalError("list torrent profiles", err)
		writeError(responseWriter, http.StatusInternalServerError, "torrent_profiles_unavailable", "Torrent profiles are unavailable.")

		return
	}

	server.writeTorrentProfilesResponse(responseWriter, request, profiles)
}

// writeTorrentProfilesResponse adds the effective Default profile without another request.
func (server *Server) writeTorrentProfilesResponse(
	responseWriter http.ResponseWriter,
	request *http.Request,
	profiles []storage.TorrentProfile,
) {
	defaultProfile, err := server.defaultTorrentProfileSummary(request.Context())
	if err != nil {
		server.logInternalError("read Default torrent profile", err)
		writeInternalError(responseWriter)

		return
	}

	overlaps, err := server.torrentProfileFolderOverlaps(request.Context(), profiles)
	if err != nil {
		server.logInternalError("check torrent profile folders", err)
		writeInternalError(responseWriter)

		return
	}

	writeJSON(responseWriter, http.StatusOK, torrentProfilesResponse{
		DefaultProfile: defaultProfile,
		Profiles:       torrentProfileSummaries(profiles),
		FolderOverlaps: overlaps,
	})
}

// torrentProfileFolderOverlaps lists every saved profile whose folder overlaps another.
func (server *Server) torrentProfileFolderOverlaps(
	ctx context.Context,
	profiles []storage.TorrentProfile,
) ([]torrentProfileFolderOverlap, error) {
	overlaps := []torrentProfileFolderOverlap{}
	defaultProfile, err := server.defaultTorrentProfile(ctx)
	if err != nil {
		return nil, err
	}
	if message, err := server.torrentProfileOverlapMessage(ctx, defaultProfile, true); err != nil {
		return nil, err
	} else if message != "" {
		overlaps = append(overlaps, torrentProfileFolderOverlap{ProfileID: "default", ProfileName: defaultProfile.Name, Message: message})
	}
	for _, profile := range profiles {
		message, err := server.torrentProfileOverlapMessage(ctx, profile, false)
		if err != nil {
			return nil, err
		}
		if message != "" {
			overlaps = append(overlaps, torrentProfileFolderOverlap{ProfileID: profile.ID, ProfileName: profile.Name, Message: message})
		}
	}

	return overlaps, nil
}

// torrentProfileOverlapMessage explains why one saved profile's folder must be changed.
//
// It returns an empty string when the folder follows the one-folder rule.
func (server *Server) torrentProfileOverlapMessage(
	ctx context.Context,
	profile storage.TorrentProfile,
	defaultProfile bool,
) (string, error) {
	excludedID := profile.ID
	if defaultProfile {
		excludedID = ""
	}
	conflict, err := server.torrentProfileFolderConflict(ctx, profile.DownloadDirectory, excludedID, defaultProfile)
	if err != nil || conflict == nil {
		return "", err
	}

	return torrentProfileFolderConflictMessage(conflict), nil
}

// torrentProfileAddBlockedMessage refuses new torrents for a profile whose folder overlaps another.
func (server *Server) torrentProfileAddBlockedMessage(
	ctx context.Context,
	profile storage.TorrentProfile,
	defaultProfile bool,
) (string, error) {
	message, err := server.torrentProfileOverlapMessage(ctx, profile, defaultProfile)
	if err != nil || message == "" {
		return "", err
	}
	profileLabel := profile.Name
	if !defaultProfile {
		profileLabel += " profile"
	}

	return fmt.Sprintf("Change the %s's folder before adding torrents to it. %s", profileLabel, message), nil
}

// handleUpdateDefaultTorrentProfile saves the real setting-backed Default profile.
//
// Folder changes retain the Settings transaction's revision, publication, directory,
// and restart behavior before confirmed torrents are moved to their new owner folder.
func (server *Server) handleUpdateDefaultTorrentProfile(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	var body defaultTorrentProfileBody
	if err := decodeJSONBody(responseWriter, request, &body); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}
	profile, issues := readDefaultTorrentProfile(body)
	if len(issues) > 0 {
		writeIssues(responseWriter, issues)

		return
	}
	namedProfiles, err := server.store.ListTorrentProfiles(request.Context())
	if err != nil {
		server.logInternalError("check Default torrent profile name", err)
		writeInternalError(responseWriter)

		return
	}
	for _, namedProfile := range namedProfiles {
		if strings.EqualFold(namedProfile.Name, profile.Name) {
			writeFieldError(responseWriter, http.StatusConflict, "torrent_profile_exists", "name", "A torrent profile with this name already exists.")

			return
		}
	}
	moveTorrents := false
	if len(body.MoveTorrents) > 0 &&
		(string(bytes.TrimSpace(body.MoveTorrents)) == "null" ||
			decodeOneJSONValue(body.MoveTorrents, &moveTorrents) != nil) {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "moveTorrents", "moveTorrents must be a boolean.")

		return
	}

	policy, err := server.effectiveDownloadPathPolicy(request.Context())
	if err != nil {
		server.logInternalError("read download paths for Default torrent profile", err)
		writeInternalError(responseWriter)

		return
	}
	if _, err := policy.normalizeDownloadDirectory(profile.DownloadDirectory); err != nil {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "downloadDirectory", err.Error())

		return
	}
	if conflict, err := server.torrentProfileFolderConflict(
		request.Context(),
		profile.DownloadDirectory,
		"",
		true,
	); err != nil {
		server.logInternalError("check Default torrent profile folder", err)
		writeInternalError(responseWriter)

		return
	} else if conflict != nil {
		writeTorrentProfileFolderConflict(responseWriter, conflict)

		return
	}

	currentSummary, err := server.defaultTorrentProfileSummary(request.Context())
	if err != nil {
		server.logInternalError("read current Default torrent profile", err)
		writeInternalError(responseWriter)

		return
	}
	folderChanged := !strings.EqualFold(
		currentSummary.DownloadDirectory,
		profile.DownloadDirectory,
	)
	if folderChanged && currentSummary.DownloadDirectoryLocked {
		writeFieldError(
			responseWriter,
			http.StatusConflict,
			"setting_locked",
			"downloadDirectory",
			"The Download directory is locked by managed configuration.",
		)

		return
	}

	moves := []torrentMoveCandidate{}
	targetConnectionID := ""
	if folderChanged {
		defaultTorrents, listError := server.torrentsForProfile(request.Context(), nil)
		if listError != nil {
			server.logInternalError("find Default torrent profile moves", listError)
			writeError(responseWriter, http.StatusServiceUnavailable, "transmission_unavailable", "Every Transmission daemon must answer before changing "+currentSummary.Name+"'s folder.")

			return
		}
		if len(defaultTorrents) > 0 {
			targetConnectionID, err = server.effectiveVPNConnectionID(
				request.Context(),
				nil,
			)
			if err != nil {
				writeError(responseWriter, http.StatusServiceUnavailable, "transmission_unavailable", "The default Transmission daemon is unavailable.")

				return
			}
			for _, candidate := range defaultTorrents {
				if candidate.ConnectionID != targetConnectionID ||
					!sameTorrentProfileFolder(
						candidate.DownloadDirectory,
						profile.DownloadDirectory,
					) {
					moves = append(moves, candidate)
				}
			}
		}
		if len(moves) > 0 && !moveTorrents {
			writeErrorDetails(
				responseWriter,
				http.StatusConflict,
				"torrents_must_move",
				currentSummary.Name+"'s torrents must move to its download folder.",
				map[string]any{
					"torrents":          len(moves),
					"downloadDirectory": profile.DownloadDirectory,
				},
			)

			return
		}
	}

	server.transmissionSettingsMutex.Lock()
	settingsLocked := true
	defer func() {
		if settingsLocked {
			server.transmissionSettingsMutex.Unlock()
		}
	}()
	if folderChanged {
		snapshot, snapshotError := server.store.EffectiveConfiguration(
			request.Context(),
			server.registry,
		)
		if snapshotError != nil {
			server.logInternalError("read settings for Default torrent profile", snapshotError)
			writeInternalError(responseWriter)

			return
		}
		changes := storage.SettingChanges{
			"transmission.downloadDirectory": json.RawMessage(
				strconv.Quote(profile.DownloadDirectory),
			),
		}
		requestPrincipal := principalFromContext(request.Context())
		actor := requestPrincipal.Kind + ":" + requestPrincipal.Identifier
		if _, err := server.store.UpdateSettings(
			request.Context(),
			server.registry,
			snapshot.Revision,
			changes,
			actor,
		); err != nil {
			if errors.Is(err, storage.ErrSettingLocked) {
				writeFieldError(responseWriter, http.StatusConflict, "setting_locked", "downloadDirectory", "The Download directory is locked by managed configuration.")

				return
			}
			var folderConflict *storage.TorrentProfileFolderConflict
			if errors.As(err, &folderConflict) {
				writeTorrentProfileFolderConflict(responseWriter, folderConflict)

				return
			}
			server.logInternalError("update Default torrent profile folder", err)
			writeError(responseWriter, http.StatusInternalServerError, "torrent_profiles_failed", "The Default torrent profile could not be changed.")

			return
		}
		server.rememberTransmissionRestartKeys(request.Context(), changes)
	}

	if _, err := server.store.UpdateDefaultTorrentProfile(
		request.Context(),
		storage.DefaultTorrentProfile{
			Name:        profile.Name,
			Labels:      profile.Labels,
			StartPaused: profile.StartPaused,
			Options:     profile.Options,
		},
	); err != nil {
		if errors.Is(err, storage.ErrTorrentProfileNameTaken) {
			writeFieldError(responseWriter, http.StatusConflict, "torrent_profile_exists", "name", "A torrent profile with this name already exists.")

			return
		}
		server.logInternalError("update Default torrent profile defaults", err)
		writeError(responseWriter, http.StatusInternalServerError, "torrent_profiles_failed", "The Default torrent profile could not be changed.")

		return
	}

	if folderChanged {
		snapshot, snapshotError := server.store.EffectiveConfiguration(
			request.Context(),
			server.registry,
		)
		if snapshotError != nil {
			server.logInternalError("read updated Default torrent profile settings", snapshotError)
			writeInternalError(responseWriter)

			return
		}
		server.ensureConfiguredStorageDirectories(
			context.WithoutCancel(request.Context()),
			snapshot,
		)
		if err := server.publishTransmissionConfiguration(request.Context()); err != nil {
			server.logInternalError("publish Transmission configuration after Default profile save", err)
			writeError(responseWriter, http.StatusInternalServerError, "settings_update_deferred", profile.Name+" was saved, but the Transmission runtime update could not be published.")

			return
		}
		server.applyLiveTransmissionSettings(request, storage.SettingChanges{
			"transmission.downloadDirectory": json.RawMessage(
				strconv.Quote(profile.DownloadDirectory),
			),
		})
	}
	server.transmissionSettingsMutex.Unlock()
	settingsLocked = false
	server.ensureRequiredDirectory(
		context.WithoutCancel(request.Context()),
		profile.DownloadDirectory,
	)

	moved := make([]torrentMoveResult, 0, len(moves))
	for _, candidate := range moves {
		result, _ := server.moveTorrentToProfile(
			context.WithoutCancel(request.Context()),
			candidate,
			targetConnectionID,
			profile.DownloadDirectory,
		)
		moved = append(moved, result)
	}

	updatedSummary, err := server.defaultTorrentProfileSummary(request.Context())
	if err != nil {
		server.logInternalError("read updated Default torrent profile", err)
		writeInternalError(responseWriter)

		return
	}
	writeJSON(responseWriter, http.StatusOK, defaultTorrentProfileUpdateResponse{
		defaultTorrentProfileSummary: updatedSummary,
		Moved:                        moved,
	})
}

// handleCreateTorrentProfile validates and creates one independent preset.
func (server *Server) handleCreateTorrentProfile(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	var body torrentProfileBody
	if err := decodeJSONBody(responseWriter, request, &body); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}

	profile, issues := readTorrentProfile(body)
	if len(issues) > 0 {
		writeIssues(responseWriter, issues)

		return
	}
	policy, err := server.effectiveDownloadPathPolicy(request.Context())
	if err != nil {
		server.logInternalError("read download paths for torrent profile", err)
		writeInternalError(responseWriter)

		return
	}
	if _, err := policy.normalizeDownloadDirectory(profile.DownloadDirectory); err != nil {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "downloadDirectory", err.Error())

		return
	}
	if conflict, err := server.torrentProfileFolderConflict(
		request.Context(),
		profile.DownloadDirectory,
		"",
		false,
	); err != nil {
		server.logInternalError("check torrent profile folder", err)
		writeInternalError(responseWriter)

		return
	} else if conflict != nil {
		writeTorrentProfileFolderConflict(responseWriter, conflict)

		return
	}
	releaseConnectionReference, removing := server.holdVPNConnectionReference(
		profile.ConnectionID,
	)
	if removing {
		writeConnectionBeingRemoved(responseWriter)

		return
	}
	defer releaseConnectionReference()
	if err := server.validateVPNConnectionReference(request.Context(), profile.ConnectionID); err != nil {
		if isMissingVPNConnection(err) {
			writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "connectionId", "connectionId must name an existing VPN connection or be null.")
		} else {
			server.logInternalError("validate torrent profile connection", err)
			writeInternalError(responseWriter)
		}

		return
	}
	profile.ID = newTorrentProfileID()

	created, err := server.store.CreateTorrentProfile(request.Context(), profile)
	if writeTorrentProfileStoreError(responseWriter, server, err, "create") {
		return
	}
	server.ensureRequiredDirectory(context.WithoutCancel(request.Context()), created.DownloadDirectory)

	profiles, err := server.store.ListTorrentProfiles(request.Context())
	if err != nil {
		server.logInternalError("list torrent profile overlaps after create", err)
		writeInternalError(responseWriter)

		return
	}
	writeJSON(
		responseWriter,
		http.StatusCreated,
		torrentProfileSummaryFor(created, profiles),
	)
}

// handleUpdateTorrentProfile replaces one preset.
func (server *Server) handleUpdateTorrentProfile(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	id := request.PathValue("torrentProfileID")
	if !validTorrentProfileID(id) {
		writeTorrentProfileNotFound(responseWriter)

		return
	}

	var body torrentProfileBody
	if err := decodeJSONBody(responseWriter, request, &body); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}
	profile, issues := readTorrentProfile(body)
	if len(issues) > 0 {
		writeIssues(responseWriter, issues)

		return
	}
	policy, err := server.effectiveDownloadPathPolicy(request.Context())
	if err != nil {
		server.logInternalError("read download paths for torrent profile", err)
		writeInternalError(responseWriter)

		return
	}
	if _, err := policy.normalizeDownloadDirectory(profile.DownloadDirectory); err != nil {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "downloadDirectory", err.Error())

		return
	}
	if conflict, err := server.torrentProfileFolderConflict(
		request.Context(),
		profile.DownloadDirectory,
		id,
		false,
	); err != nil {
		server.logInternalError("check updated torrent profile folder", err)
		writeInternalError(responseWriter)

		return
	} else if conflict != nil {
		writeTorrentProfileFolderConflict(responseWriter, conflict)

		return
	}
	releaseConnectionReference, removing := server.holdVPNConnectionReference(
		profile.ConnectionID,
	)
	if removing {
		writeConnectionBeingRemoved(responseWriter)

		return
	}
	defer releaseConnectionReference()
	moveTorrents := false
	if len(body.MoveTorrents) > 0 && (string(bytes.TrimSpace(body.MoveTorrents)) == "null" ||
		decodeOneJSONValue(body.MoveTorrents, &moveTorrents) != nil) {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "moveTorrents", "moveTorrents must be a boolean.")

		return
	}
	if err := server.validateVPNConnectionReference(request.Context(), profile.ConnectionID); err != nil {
		if isMissingVPNConnection(err) {
			writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "connectionId", "connectionId must name an existing VPN connection or be null.")
		} else {
			server.logInternalError("validate torrent profile connection", err)
			writeInternalError(responseWriter)
		}

		return
	}

	existing, err := server.store.FindTorrentProfile(request.Context(), id)
	if writeTorrentProfileStoreError(responseWriter, server, err, "read before update") {
		return
	}
	moves := []torrentMoveCandidate{}
	connectionChanged := !sameOptionalString(existing.ConnectionID, profile.ConnectionID)
	folderChanged := !strings.EqualFold(
		existing.DownloadDirectory,
		profile.DownloadDirectory,
	)
	var targetConnectionID string
	if (connectionChanged || folderChanged) &&
		server.torrentProfileAssignments.hasProfile(id) {
		var effectiveError error
		targetConnectionID, effectiveError = server.effectiveVPNConnectionID(
			request.Context(),
			profile.ConnectionID,
		)
		if effectiveError != nil {
			if isMissingVPNConnection(effectiveError) {
				writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "connectionId", "A default VPN connection is required when connectionId is null.")
			} else {
				server.logInternalError("resolve torrent profile connection", effectiveError)
				writeInternalError(responseWriter)
			}

			return
		}
		profileTorrents, listError := server.torrentsForProfile(
			request.Context(),
			&id,
		)
		if listError != nil {
			server.logInternalError("find torrent profile moves", listError)
			writeError(responseWriter, http.StatusServiceUnavailable, "transmission_unavailable", "Every Transmission daemon must answer before changing this profile's connection or folder.")

			return
		}
		for _, candidate := range profileTorrents {
			if candidate.ConnectionID != targetConnectionID ||
				!sameTorrentProfileFolder(
					candidate.DownloadDirectory,
					profile.DownloadDirectory,
				) {
				moves = append(moves, candidate)
			}
		}
		if len(moves) > 0 && !moveTorrents {
			writeErrorDetails(
				responseWriter,
				http.StatusConflict,
				"torrents_must_move",
				"The profile's torrents must move to its selected VPN connection and download folder.",
				map[string]any{
					"torrents":          len(moves),
					"connectionId":      targetConnectionID,
					"downloadDirectory": profile.DownloadDirectory,
				},
			)

			return
		}
	}

	updated, err := server.store.UpdateTorrentProfile(request.Context(), id, profile)
	if writeTorrentProfileStoreError(responseWriter, server, err, "update") {
		return
	}
	server.ensureRequiredDirectory(context.WithoutCancel(request.Context()), updated.DownloadDirectory)

	moved := make([]torrentMoveResult, 0, len(moves))
	if len(moves) > 0 {
		for _, candidate := range moves {
			result, _ := server.moveTorrentToProfile(
				context.WithoutCancel(request.Context()),
				candidate,
				targetConnectionID,
				updated.DownloadDirectory,
			)
			moved = append(moved, result)
		}
	}

	profiles, err := server.store.ListTorrentProfiles(request.Context())
	if err != nil {
		server.logInternalError("list torrent profile overlaps after update", err)
		writeInternalError(responseWriter)

		return
	}
	writeJSON(responseWriter, http.StatusOK, torrentProfileUpdateResponse{
		torrentProfileSummary: torrentProfileSummaryFor(updated, profiles),
		Moved:                 moved,
	})
}

// handleDeleteTorrentProfile moves assigned torrents to Default before removing a preset.
func (server *Server) handleDeleteTorrentProfile(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	id := request.PathValue("torrentProfileID")
	if !validTorrentProfileID(id) {
		writeTorrentProfileNotFound(responseWriter)

		return
	}

	var body torrentProfileDeleteBody
	if request.ContentLength != 0 {
		if err := decodeJSONBody(responseWriter, request, &body); err != nil {
			writeDecodeError(responseWriter, err)

			return
		}
	}

	moveTorrents := false
	if len(body.MoveTorrents) > 0 &&
		(string(bytes.TrimSpace(body.MoveTorrents)) == "null" ||
			decodeOneJSONValue(body.MoveTorrents, &moveTorrents) != nil) {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "moveTorrents", "moveTorrents must be a boolean.")

		return
	}

	moves := []torrentMoveCandidate{}
	targetConnectionID := ""
	targetDownloadDirectory := ""
	if server.torrentProfileAssignments.hasProfile(id) {
		profileTorrents, err := server.torrentsForProfile(request.Context(), &id)
		if err != nil {
			server.logInternalError("find deleted torrent profile moves", err)
			writeError(responseWriter, http.StatusServiceUnavailable, "transmission_unavailable", "Every Transmission daemon must answer before deleting this profile.")

			return
		}
		moves = profileTorrents
		if len(moves) > 0 {
			defaultProfile, err := server.defaultTorrentProfile(request.Context())
			if err != nil {
				server.logInternalError("read Default torrent profile before deletion", err)
				writeInternalError(responseWriter)

				return
			}
			targetDownloadDirectory = defaultProfile.DownloadDirectory
			targetConnectionID, err = server.effectiveVPNConnectionID(
				request.Context(),
				nil,
			)
			if err != nil {
				writeError(responseWriter, http.StatusServiceUnavailable, "transmission_unavailable", "The default Transmission daemon is unavailable.")

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

			if !moveTorrents {
				writeErrorDetails(
					responseWriter,
					http.StatusConflict,
					"torrents_must_move",
					"The profile's torrents must move to "+defaultProfile.Name+" before it can be deleted.",
					map[string]any{
						"torrents":          len(moves),
						"connectionId":      targetConnectionID,
						"downloadDirectory": targetDownloadDirectory,
					},
				)

				return
			}
		}
	}

	err := server.store.DeleteTorrentProfile(request.Context(), id)
	if writeTorrentProfileStoreError(responseWriter, server, err, "delete") {
		return
	}
	if err := server.refreshTorrentProfileAssignments(request.Context()); err != nil {
		server.logInternalError("refresh torrent profile assignments after deletion", err)
		writeInternalError(responseWriter)

		return
	}
	if moveTorrents {
		moved := make([]torrentMoveResult, 0, len(moves))
		for _, candidate := range moves {
			result, _ := server.moveTorrentToProfile(
				context.WithoutCancel(request.Context()),
				candidate,
				targetConnectionID,
				targetDownloadDirectory,
			)
			moved = append(moved, result)
		}
		writeJSON(responseWriter, http.StatusOK, torrentProfileDeleteResponse{
			Moved: moved,
		})

		return
	}

	responseWriter.WriteHeader(http.StatusNoContent)
}

// torrentProfileSummaries decorates every profile with exact pattern intersections.
func torrentProfileSummaries(profiles []storage.TorrentProfile) []torrentProfileSummary {
	summaries := make([]torrentProfileSummary, 0, len(profiles))
	for _, profile := range profiles {
		summaries = append(summaries, torrentProfileSummaryFor(profile, profiles))
	}

	return summaries
}

// torrentProfileSummaryFor finds every pattern pair sharing at least one name.
func torrentProfileSummaryFor(
	profile storage.TorrentProfile,
	profiles []storage.TorrentProfile,
) torrentProfileSummary {
	overlaps := []torrentProfileOverlap{}
	for _, otherProfile := range profiles {
		if otherProfile.ID == profile.ID {
			continue
		}
		for _, ownPattern := range profile.MatchPatterns {
			for _, otherPattern := range otherProfile.MatchPatterns {
				if torrentPatternLanguagesOverlap(ownPattern, otherPattern) {
					overlaps = append(overlaps, torrentProfileOverlap{
						ProfileID:   otherProfile.ID,
						ProfileName: otherProfile.Name,
						Pattern:     otherPattern,
						OwnPattern:  ownPattern,
					})
				}
			}
		}
	}

	return torrentProfileSummary{TorrentProfile: profile, Overlaps: overlaps}
}

// readTorrentProfile applies defaults and reports every invalid profile field.
func readTorrentProfile(body torrentProfileBody) (storage.TorrentProfile, []validationIssue) {
	profile := storage.TorrentProfile{
		Labels:        []string{},
		MatchPatterns: []string{},
	}
	issues := []validationIssue{}

	if len(body.Name) == 0 || decodeOneJSONValue(body.Name, &profile.Name) != nil {
		issues = append(issues, newFieldIssue("name", "name must contain between 1 and 64 characters."))
	} else {
		profile.Name = strings.TrimSpace(profile.Name)
		nameLength := utf8.RuneCountInString(profile.Name)
		if nameLength < 1 || nameLength > maximumTorrentProfileNameCharacters {
			issues = append(issues, newFieldIssue("name", "name must contain between 1 and 64 characters."))
		}
	}

	if len(body.DownloadDirectory) == 0 || decodeOneJSONValue(body.DownloadDirectory, &profile.DownloadDirectory) != nil {
		issues = append(issues, newFieldIssue("downloadDirectory", "downloadDirectory must be an absolute path beneath /data."))
	} else if normalizedDirectory, err := settings.NormalizeDataPath(profile.DownloadDirectory); err != nil {
		issues = append(issues, newFieldIssue("downloadDirectory", "downloadDirectory must be an absolute path beneath /data."))
	} else if err := settings.ValidateDownloadDataPath(normalizedDirectory); err != nil {
		issues = append(issues, newFieldIssue("downloadDirectory", err.Error()))
	} else {
		profile.DownloadDirectory = normalizedDirectory
	}

	if len(body.Labels) > 0 {
		if decodeOneJSONValue(body.Labels, &profile.Labels) != nil || profile.Labels == nil {
			issues = append(issues, newFieldIssue("labels", "labels must be an array of strings."))
			profile.Labels = []string{}
		} else if err := validateLabels(profile.Labels); err != nil {
			issues = append(issues, newFieldIssue("labels", err.Error()))
		}
	}

	if len(body.StartPaused) > 0 && (string(bytes.TrimSpace(body.StartPaused)) == "null" ||
		decodeOneJSONValue(body.StartPaused, &profile.StartPaused) != nil) {
		issues = append(issues, newFieldIssue("startPaused", "startPaused must be a boolean."))
	}

	if len(body.MatchPatterns) > 0 {
		if decodeOneJSONValue(body.MatchPatterns, &profile.MatchPatterns) != nil || profile.MatchPatterns == nil {
			issues = append(issues, newFieldIssue("matchPatterns", "matchPatterns must be an array of strings."))
			profile.MatchPatterns = []string{}
		} else {
			issues = append(issues, torrentProfilePatternIssues(profile.MatchPatterns)...)
		}
	}

	connectionID, validConnectionID := readOptionalVPNConnectionID(body.ConnectionID)
	if !validConnectionID {
		issues = append(issues, newFieldIssue("connectionId", "connectionId must name an existing VPN connection or be null."))
	} else {
		profile.ConnectionID = connectionID
	}

	options, optionIssues := readTorrentProfileOptions(body.Options)
	profile.Options = options
	issues = append(issues, optionIssues...)

	return profile, issues
}

// readDefaultTorrentProfile validates the Default profile through the named shape.
func readDefaultTorrentProfile(
	body defaultTorrentProfileBody,
) (storage.TorrentProfile, []validationIssue) {
	return readTorrentProfile(torrentProfileBody{
		Name:              body.Name,
		DownloadDirectory: body.DownloadDirectory,
		Labels:            body.Labels,
		StartPaused:       body.StartPaused,
		Options:           body.Options,
		MatchPatterns:     json.RawMessage(`[]`),
		ConnectionID:      json.RawMessage(`null`),
	})
}

// defaultTorrentProfile resolves the Default profile's setting-backed folder.
func (server *Server) defaultTorrentProfile(
	ctx context.Context,
) (storage.TorrentProfile, error) {
	storedProfile, err := server.store.DefaultTorrentProfile(ctx)
	if err != nil {
		return storage.TorrentProfile{}, err
	}
	policy, err := server.effectiveDownloadPathPolicy(ctx)
	if err != nil {
		return storage.TorrentProfile{}, err
	}

	return storage.TorrentProfile{
		Name:              storedProfile.Name,
		DownloadDirectory: policy.downloadDirectory,
		Labels:            nonNilStrings(storedProfile.Labels),
		StartPaused:       storedProfile.StartPaused,
		Options:           storedProfile.Options,
		MatchPatterns:     []string{},
	}, nil
}

// defaultTorrentProfileSummary combines stored defaults with managed lock state.
func (server *Server) defaultTorrentProfileSummary(
	ctx context.Context,
) (defaultTorrentProfileSummary, error) {
	profile, err := server.defaultTorrentProfile(ctx)
	if err != nil {
		return defaultTorrentProfileSummary{}, err
	}
	snapshot, err := server.store.EffectiveConfiguration(ctx, server.registry)
	if err != nil {
		return defaultTorrentProfileSummary{}, err
	}
	locked := false
	for _, effectiveSetting := range snapshot.Settings {
		if effectiveSetting.Key == "transmission.downloadDirectory" {
			locked = effectiveSetting.Locked
			break
		}
	}

	return defaultTorrentProfileSummary{
		Name:                    profile.Name,
		DownloadDirectory:       profile.DownloadDirectory,
		DownloadDirectoryLocked: locked,
		Labels:                  profile.Labels,
		StartPaused:             profile.StartPaused,
		Options:                 profile.Options,
	}, nil
}

// torrentProfileFolderConflict returns the first other owner of one folder.
func (server *Server) torrentProfileFolderConflict(
	ctx context.Context,
	downloadDirectory string,
	excludedProfileID string,
	defaultProfile bool,
) (*storage.TorrentProfileFolderConflict, error) {
	if !defaultProfile {
		policy, err := server.effectiveDownloadPathPolicy(ctx)
		if err != nil {
			return nil, err
		}
		// No profile folder may sit inside another profile's folder or contain one.
		relation := storage.TorrentProfileFolderRelation(downloadDirectory, policy.downloadDirectory)
		if relation != "" {
			defaultProfile, profileError := server.store.DefaultTorrentProfile(ctx)
			if profileError != nil {
				return nil, profileError
			}
			conflict := &storage.TorrentProfileFolderConflict{
				DownloadDirectory: policy.downloadDirectory,
				ProfileName:       defaultProfile.Name,
				DefaultProfile:    true,
			}
			if relation != "same" {
				conflict.Relation = relation
			}

			return conflict, nil
		}
	}

	profiles, err := server.store.ListTorrentProfiles(ctx)
	if err != nil {
		return nil, err
	}
	for _, profile := range profiles {
		if profile.ID == excludedProfileID {
			continue
		}
		relation := storage.TorrentProfileFolderRelation(downloadDirectory, profile.DownloadDirectory)
		if relation == "" {
			continue
		}
		conflict := &storage.TorrentProfileFolderConflict{
			DownloadDirectory: profile.DownloadDirectory,
			ProfileName:       profile.Name,
		}
		if relation != "same" {
			conflict.Relation = relation
		}

		return conflict, nil
	}

	return nil, nil
}

// torrentProfileFolderConflictMessage names the current folder owner.
func torrentProfileFolderConflictMessage(
	conflict *storage.TorrentProfileFolderConflict,
) string {
	profileName := conflict.ProfileName + " profile"
	if conflict.DefaultProfile {
		profileName = conflict.ProfileName
	}
	switch conflict.Relation {
	case "inside":
		return fmt.Sprintf("This folder is inside the %s's folder, “%s”.", profileName, filepath.Base(conflict.DownloadDirectory))
	case "contains":
		return fmt.Sprintf("This folder contains the %s's folder, “%s”.", profileName, filepath.Base(conflict.DownloadDirectory))
	}

	return fmt.Sprintf(
		"“%s” is already the %s's folder.",
		filepath.Base(conflict.DownloadDirectory),
		profileName,
	)
}

// writeTorrentProfileFolderConflict emits the shared one-folder rule.
func writeTorrentProfileFolderConflict(
	responseWriter http.ResponseWriter,
	conflict *storage.TorrentProfileFolderConflict,
) {
	message := torrentProfileFolderConflictMessage(conflict)
	writeFieldError(
		responseWriter,
		http.StatusConflict,
		"profile_folder_taken",
		"downloadDirectory",
		message,
	)
}

// torrentProfilePatternIssues checks count and Unicode character length only.
func torrentProfilePatternIssues(patterns []string) []validationIssue {
	if len(patterns) > maximumTorrentProfilePatterns {
		return []validationIssue{newFieldIssue("matchPatterns", "matchPatterns must contain no more than 64 values.")}
	}

	issues := []validationIssue{}
	for index, pattern := range patterns {
		length := utf8.RuneCountInString(pattern)
		if length < 1 || length > maximumTorrentProfilePatternLength {
			field := fmt.Sprintf("matchPatterns.%d", index)
			issues = append(issues, validationIssue{
				Field:   field,
				Path:    []string{"matchPatterns", fmt.Sprintf("%d", index)},
				Message: "each match pattern must contain between 1 and 128 characters.",
			})
		}
	}

	return issues
}

// readTorrentProfileOptions applies independent defaults and validates nested values.
func readTorrentProfileOptions(raw json.RawMessage) (storage.TorrentProfileOptions, []validationIssue) {
	options := storage.TorrentProfileOptions{
		Seeding: storage.TorrentProfileSeeding{
			Mode: "never",
		},
		BandwidthPriority: 0,
		PeerLimit:         50,
		Queue:             "normal",
	}
	if len(raw) == 0 {
		return options, nil
	}

	var body torrentProfileOptionsBody
	if string(bytes.TrimSpace(raw)) == "null" || decodeStrictJSONValue(raw, &body) != nil {
		return options, []validationIssue{newFieldIssue("options", "options must be an object with supported fields.")}
	}

	issues := []validationIssue{}
	seeding, seedingIssues := readTorrentProfileSeeding(body.Seeding)
	options.Seeding = seeding
	issues = append(issues, seedingIssues...)

	var issue *validationIssue
	options.DownloadLimitKBps, issue = readNullableTorrentProfileInteger(
		body.DownloadLimitKBps,
		"options.downloadLimitKBps",
		1,
		1_000_000_000,
	)
	if issue != nil {
		issues = append(issues, *issue)
	}
	options.UploadLimitKBps, issue = readNullableTorrentProfileInteger(
		body.UploadLimitKBps,
		"options.uploadLimitKBps",
		1,
		1_000_000_000,
	)
	if issue != nil {
		issues = append(issues, *issue)
	}

	if len(body.BandwidthPriority) > 0 {
		value, err := decodeRawInteger(body.BandwidthPriority, -1, 1)
		if err != nil {
			issues = append(issues, nestedTorrentProfileIssue("options.bandwidthPriority", "bandwidthPriority must be -1, 0, or 1."))
		} else {
			options.BandwidthPriority = value
		}
	}
	if len(body.PeerLimit) > 0 {
		value, err := decodeRawInteger(body.PeerLimit, 1, 10000)
		if err != nil {
			issues = append(issues, nestedTorrentProfileIssue("options.peerLimit", "peerLimit must be an integer between 1 and 10000."))
		} else {
			options.PeerLimit = value
		}
	}
	if len(body.Queue) > 0 {
		if string(bytes.TrimSpace(body.Queue)) == "null" || decodeOneJSONValue(body.Queue, &options.Queue) != nil ||
			(options.Queue != "normal" && options.Queue != "top") {
			issues = append(issues, nestedTorrentProfileIssue("options.queue", "queue must be normal or top."))
		}
	}

	return options, issues
}

// readTorrentProfileSeeding enforces the closed never-or-limit policy.
func readTorrentProfileSeeding(raw json.RawMessage) (storage.TorrentProfileSeeding, []validationIssue) {
	seeding := storage.TorrentProfileSeeding{Mode: "never"}
	if len(raw) == 0 {
		return seeding, nil
	}

	var body torrentProfileSeedingBody
	if string(bytes.TrimSpace(raw)) == "null" || decodeStrictJSONValue(raw, &body) != nil {
		return seeding, []validationIssue{nestedTorrentProfileIssue("options.seeding", "seeding must be an object with supported fields.")}
	}

	issues := []validationIssue{}
	if len(body.Mode) > 0 && (string(bytes.TrimSpace(body.Mode)) == "null" ||
		decodeOneJSONValue(body.Mode, &seeding.Mode) != nil) {
		issues = append(issues, nestedTorrentProfileIssue("options.seeding.mode", "mode must be never or limit."))
	}
	if seeding.Mode != "never" && seeding.Mode != "limit" {
		issues = append(issues, nestedTorrentProfileIssue("options.seeding.mode", "mode must be never or limit."))
	}

	if len(body.Ratio) > 0 && string(bytes.TrimSpace(body.Ratio)) != "null" {
		ratio, err := decodeRawNumber(body.Ratio, 0, 10000)
		if err != nil {
			issues = append(issues, nestedTorrentProfileIssue("options.seeding.ratio", "ratio must be a number between 0 and 10000."))
		} else {
			seeding.Ratio = &ratio
		}
	}
	if len(body.IdleMinutes) > 0 && string(bytes.TrimSpace(body.IdleMinutes)) != "null" {
		idleMinutes, err := decodeRawInteger(body.IdleMinutes, 1, 525600)
		if err != nil {
			issues = append(issues, nestedTorrentProfileIssue("options.seeding.idleMinutes", "idleMinutes must be an integer between 1 and 525600."))
		} else {
			seeding.IdleMinutes = &idleMinutes
		}
	}

	if seeding.Mode == "limit" && seeding.Ratio == nil && seeding.IdleMinutes == nil {
		issues = append(issues, nestedTorrentProfileIssue("options.seeding", "limit seeding requires ratio and/or idleMinutes."))
	}
	if seeding.Mode == "never" && (seeding.Ratio != nil || seeding.IdleMinutes != nil) {
		issues = append(issues, nestedTorrentProfileIssue("options.seeding", "never seeding cannot include ratio or idleMinutes."))
	}

	return seeding, issues
}

// readNullableTorrentProfileInteger accepts unlimited null or one bounded integer.
func readNullableTorrentProfileInteger(
	raw json.RawMessage,
	field string,
	minimum int64,
	maximum int64,
) (*int64, *validationIssue) {
	if len(raw) == 0 || string(bytes.TrimSpace(raw)) == "null" {
		return nil, nil
	}

	value, err := decodeRawInteger(raw, minimum, maximum)
	if err != nil {
		issue := nestedTorrentProfileIssue(
			field,
			fmt.Sprintf("%s must be null or an integer between %d and %d.", field[strings.LastIndex(field, ".")+1:], minimum, maximum),
		)

		return nil, &issue
	}

	return &value, nil
}

// nestedTorrentProfileIssue expands a dotted field into the shared issue path.
func nestedTorrentProfileIssue(field string, message string) validationIssue {
	return validationIssue{
		Field:   field,
		Path:    strings.Split(field, "."),
		Message: message,
	}
}

// decodeStrictJSONValue rejects unknown object fields and trailing JSON values.
func decodeStrictJSONValue(value json.RawMessage, target any) error {
	decoder := json.NewDecoder(bytes.NewReader(value))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}

	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		return errors.New("contains trailing JSON data")
	}

	return nil
}

// newTorrentProfileID returns a random identifier like tpr-0123456789abcdef.
func newTorrentProfileID() string {
	value := make([]byte, 8)
	_, _ = rand.Read(value)

	return "tpr-" + hex.EncodeToString(value)
}

// validTorrentProfileID recognizes only the public identifier shape.
func validTorrentProfileID(id string) bool {
	hexadecimal, found := strings.CutPrefix(id, "tpr-")
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

// writeTorrentProfileStoreError maps stable storage sentinels to the API contract.
func writeTorrentProfileStoreError(
	responseWriter http.ResponseWriter,
	server *Server,
	err error,
	operation string,
) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, storage.ErrNotFound) {
		writeTorrentProfileNotFound(responseWriter)

		return true
	}
	if errors.Is(err, storage.ErrVPNConnectionReference) {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "connectionId", "connectionId must name an existing VPN connection or be null.")

		return true
	}
	if errors.Is(err, storage.ErrTorrentProfileNameTaken) {
		writeFieldError(responseWriter, http.StatusConflict, "torrent_profile_exists", "name", "A torrent profile with this name already exists.")

		return true
	}
	if errors.Is(err, storage.ErrTorrentProfileLimit) {
		writeError(responseWriter, http.StatusConflict, "torrent_profile_limit", "No more than 100 torrent profiles may be saved.")

		return true
	}
	var folderConflict *storage.TorrentProfileFolderConflict
	if errors.As(err, &folderConflict) {
		writeTorrentProfileFolderConflict(responseWriter, folderConflict)

		return true
	}

	server.logInternalError(operation+" torrent profile", err)
	writeError(responseWriter, http.StatusInternalServerError, "torrent_profiles_failed", "Torrent profiles could not be changed.")

	return true
}

// writeTorrentProfileNotFound hides whether an identifier was malformed or removed.
func writeTorrentProfileNotFound(responseWriter http.ResponseWriter) {
	writeError(responseWriter, http.StatusNotFound, "torrent_profile_not_found", "That torrent profile no longer exists.")
}
