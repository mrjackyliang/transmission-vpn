package api

import (
	"context"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/directorybrowser"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

const (
	// storageDirectoryPurposeDownload selects completed-download policy.
	//
	// The default picker mode uses this value so existing callers keep the stricter
	// completed-data rules when they omit an explicit purpose.
	//
	// Since: UNRELEASED
	storageDirectoryPurposeDownload = "download"

	// storageDirectoryPurposeIncomplete selects incomplete-folder policy.
	//
	// Settings uses this value when choosing the one folder reserved for unfinished
	// data, which has different selection rules from completed downloads.
	//
	// Since: UNRELEASED
	storageDirectoryPurposeIncomplete = "incomplete"

	// storageDirectoryPurposeProfile selects one profile-owned download folder.
	storageDirectoryPurposeProfile = "profile"

	// torrentLocationsUnavailableMessage explains a fail-closed delete decision.
	//
	// Entries that do not match a higher-priority assignment use this stable text
	// when torrent RPC results cannot prove that their folders are unassigned.
	//
	// Since: UNRELEASED
	torrentLocationsUnavailableMessage = "Torrent locations can't be checked right now, so folders can't be deleted. Try again in a moment."
)

// storageDirectoryEntry is one controller entry decorated for the folder picker.
//
// Filesystem facts come from the Transmission-user controller while assignment,
// selection, and purpose rules remain inside the authenticated control API.
//
// Since: UNRELEASED
type storageDirectoryEntry struct {
	Name                    string   `json:"name"`
	Path                    string   `json:"path"`
	Empty                   bool     `json:"empty"`
	HasSubfolders           bool     `json:"hasSubfolders"`
	Browsable               bool     `json:"browsable"`
	Selectable              bool     `json:"selectable"`
	Usable                  bool     `json:"usable"`
	UnusableReason          string   `json:"unusableReason,omitempty"`
	Deletable               bool     `json:"deletable"`
	DeleteUnavailableReason string   `json:"deleteUnavailableReason,omitempty"`
	Tags                    []string `json:"tags"`
}

// storageDirectoryResponse adds purpose-aware policy to a browsable folder.
//
// The envelope retains the existing download-selection fields while every child is
// decorated from one request-scoped assignment snapshot.
//
// Since: UNRELEASED
type storageDirectoryResponse struct {
	Path                      string                  `json:"path"`
	ParentPath                string                  `json:"parentPath,omitempty"`
	DownloadAllowed           bool                    `json:"downloadAllowed"`
	DownloadUnavailableReason string                  `json:"downloadUnavailableReason,omitempty"`
	Directories               []storageDirectoryEntry `json:"directories"`
}

// storageDirectoryRules is one consistent view of every folder assignment source.
//
// Reading these sources once per request keeps entry precedence deterministic and
// prevents one directory listing from issuing a torrent RPC call per child.
//
// Since: UNRELEASED
type storageDirectoryRules struct {
	downloadPolicy             downloadPathPolicy
	defaultProfileName         string
	profiles                   []storage.TorrentProfile
	downloadPathsForIncomplete []settings.IncompleteDirectoryDestination
	torrentDirectories         map[string]struct{}
	torrentLocationsAvailable  bool
	selectedProfileID          string
}

// storageDirectoryInspector reads metadata for exactly one requested folder.
//
// DELETE requires this narrower controller capability so its policy preflight never
// scans siblings through the broader listing operation.
//
// Since: UNRELEASED
type storageDirectoryInspector interface {
	// Inspect returns controller metadata for one exact folder.
	//
	// Implementations walk to the parent and inspect only the named child so DELETE
	// policy never depends on a potentially expensive sibling listing.
	//
	// Since: UNRELEASED
	Inspect(context.Context, string) (directorybrowser.DirectoryEntry, error)
}

// storageDirectoryDeleteState classifies one policy rejection for HTTP mapping.
//
// The handler distinguishes assignment conflicts from nonempty folders while the
// listing reduces both states to one advisory deletable flag and reason.
//
// Since: UNRELEASED
type storageDirectoryDeleteState int

const (
	// storageDirectoryDeleteAllowed permits one controller deletion attempt.
	//
	// The state is returned only after assignment, mount, readability, and emptiness
	// rules prove that the API may ask the controller for non-recursive removal.
	//
	// Since: UNRELEASED
	storageDirectoryDeleteAllowed storageDirectoryDeleteState = iota

	// storageDirectoryDeleteInUse rejects an assigned or inaccessible folder.
	//
	// The public API maps this state to directory_in_use so the picker can present
	// the first stable policy reason without attempting a filesystem mutation.
	//
	// Since: UNRELEASED
	storageDirectoryDeleteInUse

	// storageDirectoryDeleteTorrentLocationsUnavailable rejects uncertain RPC state.
	//
	// DELETE maps this fail-closed state to a retryable service-unavailable response
	// while listings expose the same advisory reason as an ordinary disabled action.
	//
	// Since: UNRELEASED
	storageDirectoryDeleteTorrentLocationsUnavailable

	// storageDirectoryDeleteNotEmpty rejects a readable folder with contents.
	//
	// Keeping this state separate gives the public API its dedicated conflict code
	// and the non-recursive cleanup guidance used by the first-party picker.
	//
	// Since: UNRELEASED
	storageDirectoryDeleteNotEmpty
)

// handleListStorageDirectories returns one safe /data directory snapshot.
//
// The HTTP layer validates the public storage boundary before the dedicated
// Transmission-user controller performs filesystem and symlink checks.
//
// Since: UNRELEASED
func (server *Server) handleListStorageDirectories(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	purpose, valid := storageDirectoryPurpose(request.URL.Query().Get("purpose"))
	if !valid {
		writeFieldError(
			responseWriter,
			http.StatusUnprocessableEntity,
			"invalid_request",
			"purpose",
			"purpose must be download, incomplete, or profile.",
		)

		return
	}

	path := request.URL.Query().Get("path")
	if path == "" {
		path = "/data"
	}
	if err := settings.ValidateDataPath(path); err != nil {
		writeError(
			responseWriter,
			http.StatusUnprocessableEntity,
			"directory_path_invalid",
			"path must be a normalized absolute path beneath /data.",
		)

		return
	}
	if server.directoryBrowser == nil {
		writeDirectoryBrowserUnavailable(responseWriter)

		return
	}

	directory, err := server.directoryBrowser.List(request.Context(), path)
	if err != nil {
		server.writeDirectoryBrowserError(responseWriter, err)

		return
	}
	rules, err := server.readStorageDirectoryRules(request.Context())
	if err != nil {
		server.logInternalError("read folder-picker rules", err)
		writeInternalError(responseWriter)

		return
	}
	if !setStorageDirectoryProfilePurpose(
		responseWriter,
		request,
		purpose,
		&rules,
	) {
		return
	}

	writeJSON(
		responseWriter,
		http.StatusOK,
		decorateStorageDirectory(directory, purpose, rules),
	)
}

// handleCreateStorageDirectory creates one folder beneath a selected /data parent.
//
// CSRF and torrents:write authorization are applied by routing middleware before
// this handler delegates to the Transmission-user controller.
//
// Since: UNRELEASED
func (server *Server) handleCreateStorageDirectory(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	purpose, valid := storageDirectoryPurpose(request.URL.Query().Get("purpose"))
	if !valid {
		writeFieldError(
			responseWriter,
			http.StatusUnprocessableEntity,
			"invalid_request",
			"purpose",
			"purpose must be download, incomplete, or profile.",
		)

		return
	}
	var input struct {
		ParentPath string `json:"parentPath"`
		Name       string `json:"name"`
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}
	if err := settings.ValidateDataPath(input.ParentPath); err != nil {
		writeError(
			responseWriter,
			http.StatusUnprocessableEntity,
			"directory_parent_invalid",
			"parentPath must be a normalized absolute path beneath /data.",
		)

		return
	}
	if server.directoryBrowser == nil {
		writeDirectoryBrowserUnavailable(responseWriter)

		return
	}
	rules, err := server.readStorageDirectoryRules(request.Context())
	if err != nil {
		server.logInternalError("read folder-picker rules for directory creation", err)
		writeInternalError(responseWriter)

		return
	}
	if !setStorageDirectoryProfilePurpose(
		responseWriter,
		request,
		purpose,
		&rules,
	) {
		return
	}

	directory, err := server.directoryBrowser.Create(
		request.Context(),
		input.ParentPath,
		input.Name,
	)
	if err != nil {
		server.writeDirectoryBrowserError(responseWriter, err)

		return
	}

	writeJSON(
		responseWriter,
		http.StatusCreated,
		decorateStorageDirectory(directory, purpose, rules),
	)
}

// handleDeleteStorageDirectory removes one empty, unassigned folder.
//
// The listing is advisory: this handler reloads every assignment source, checks the
// controller's current entry facts, and only then requests non-recursive deletion.
//
// Since: UNRELEASED
func (server *Server) handleDeleteStorageDirectory(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	purpose, valid := storageDirectoryPurpose(request.URL.Query().Get("purpose"))
	if !valid {
		writeFieldError(
			responseWriter,
			http.StatusUnprocessableEntity,
			"invalid_request",
			"purpose",
			"purpose must be download, incomplete, or profile.",
		)

		return
	}

	path := request.URL.Query().Get("path")
	if err := settings.ValidateDataPath(path); err != nil || path == "/data" {
		writeError(
			responseWriter,
			http.StatusUnprocessableEntity,
			"directory_path_invalid",
			"path must name a normalized folder beneath /data, not /data itself.",
		)

		return
	}
	if server.directoryBrowser == nil {
		writeDirectoryBrowserUnavailable(responseWriter)

		return
	}

	inspector, available := server.directoryBrowser.(storageDirectoryInspector)
	if !available {
		writeDirectoryBrowserUnavailable(responseWriter)

		return
	}
	entry, err := inspector.Inspect(request.Context(), path)
	if err != nil {
		server.writeDirectoryBrowserError(responseWriter, err)

		return
	}

	rules, err := server.readStorageDirectoryRules(request.Context())
	if err != nil {
		server.logInternalError("read folder-picker rules for directory deletion", err)
		writeInternalError(responseWriter)

		return
	}
	if !setStorageDirectoryProfilePurpose(
		responseWriter,
		request,
		purpose,
		&rules,
	) {
		return
	}
	deleteState, unavailableReason := rules.deleteAvailability(entry)
	switch deleteState {
	case storageDirectoryDeleteInUse:
		writeError(
			responseWriter,
			http.StatusConflict,
			"directory_in_use",
			unavailableReason,
		)

		return
	case storageDirectoryDeleteTorrentLocationsUnavailable:
		writeError(
			responseWriter,
			http.StatusServiceUnavailable,
			"torrent_locations_unavailable",
			unavailableReason,
		)

		return
	case storageDirectoryDeleteNotEmpty:
		writeError(
			responseWriter,
			http.StatusConflict,
			"directory_not_empty",
			unavailableReason,
		)

		return
	}

	if err := server.directoryBrowser.Delete(request.Context(), path); err != nil {
		server.writeDirectoryDeleteError(responseWriter, entry.Name, err)

		return
	}

	responseWriter.WriteHeader(http.StatusNoContent)
}

// storageDirectoryPurpose validates and defaults one picker purpose.
//
// The empty value preserves the download picker default, while explicit validation
// keeps unknown modes from bypassing purpose-specific selection policy.
//
// Since: UNRELEASED
func storageDirectoryPurpose(value string) (string, bool) {
	if value == "" {
		return storageDirectoryPurposeDownload, true
	}
	if value == storageDirectoryPurposeDownload ||
		value == storageDirectoryPurposeIncomplete ||
		value == storageDirectoryPurposeProfile {
		return value, true
	}

	return "", false
}

// readStorageDirectoryRules loads every assigned-folder source once.
//
// The shared snapshot keeps one list or delete decision internally consistent and
// avoids issuing torrent RPC work once for every visible directory entry.
//
// Since: UNRELEASED
func (server *Server) readStorageDirectoryRules(
	ctx context.Context,
) (storageDirectoryRules, error) {
	downloadPolicy, err := server.effectiveDownloadPathPolicy(ctx)
	if err != nil {
		return storageDirectoryRules{}, err
	}
	profiles, err := server.store.ListTorrentProfiles(ctx)
	if err != nil {
		return storageDirectoryRules{}, fmt.Errorf("list torrent profiles for folder picker: %w", err)
	}
	defaultProfile, err := server.store.DefaultTorrentProfile(ctx)
	if err != nil {
		return storageDirectoryRules{}, fmt.Errorf("read Default torrent profile for folder picker: %w", err)
	}
	downloadPaths := make([]settings.IncompleteDirectoryDestination, 0, 1+len(profiles))
	downloadPaths = append(downloadPaths, settings.IncompleteDirectoryDestination{
		Path:        downloadPolicy.downloadDirectory,
		ProfileName: defaultProfile.Name,
	})
	for _, profile := range profiles {
		downloadPaths = append(downloadPaths, settings.IncompleteDirectoryDestination{
			Path:        profile.DownloadDirectory,
			ProfileName: profile.Name + " profile",
		})
	}
	torrentResult := server.mergedTorrents(ctx, []string{"id", "downloadDir"}, nil)
	torrentDirectories := make(map[string]struct{}, len(torrentResult.Torrents))
	torrentLocationsAvailable := torrentResult.Complete
	if torrentLocationsAvailable {
		for _, torrent := range torrentResult.Torrents {
			downloadDirectory, valid := torrent["downloadDir"].(string)
			if !valid || downloadDirectory == "" {
				torrentLocationsAvailable = false
				break
			}
			normalizedDownloadDirectory, normalizeError := settings.NormalizeDataPath(
				downloadDirectory,
			)
			if normalizeError != nil {
				continue
			}
			torrentDirectories[strings.ToLower(normalizedDownloadDirectory)] = struct{}{}
		}
	}

	return storageDirectoryRules{
		downloadPolicy:             downloadPolicy,
		defaultProfileName:         defaultProfile.Name,
		profiles:                   profiles,
		downloadPathsForIncomplete: downloadPaths,
		torrentDirectories:         torrentDirectories,
		torrentLocationsAvailable:  torrentLocationsAvailable,
	}, nil
}

// decorateStorageDirectory applies one rule snapshot to a controller listing.
//
// Central decoration keeps purpose, assignment, and deletion precedence identical
// for list, create, and delete responses returned by the folder picker API.
//
// Since: UNRELEASED
func decorateStorageDirectory(
	directory directorybrowser.Directory,
	purpose string,
	rules storageDirectoryRules,
) storageDirectoryResponse {
	directories := make([]storageDirectoryEntry, 0, len(directory.Directories))
	for _, entry := range directory.Directories {
		usable, unusableReason := rules.usableForPurpose(entry.Path, purpose)
		deleteState, deleteUnavailableReason := rules.deleteAvailability(entry)

		directories = append(directories, storageDirectoryEntry{
			Name:                    entry.Name,
			Path:                    entry.Path,
			Empty:                   entry.Empty,
			HasSubfolders:           entry.HasSubfolders,
			Browsable:               entry.Readable,
			Selectable:              usable,
			Usable:                  usable,
			UnusableReason:          unusableReason,
			Deletable:               deleteState == storageDirectoryDeleteAllowed,
			DeleteUnavailableReason: deleteUnavailableReason,
			Tags:                    rules.tags(entry.Path),
		})
	}

	downloadAllowed, downloadUnavailableReason := rules.usableForPurpose(
		directory.Path,
		purpose,
	)

	return storageDirectoryResponse{
		Path:                      directory.Path,
		ParentPath:                directory.ParentPath,
		DownloadAllowed:           downloadAllowed,
		DownloadUnavailableReason: downloadUnavailableReason,
		Directories:               directories,
	}
}

// usableForPurpose checks whether the picker action may choose one entry.
//
// Download destinations exclude incomplete storage, while incomplete selection
// rejects any folder that would contain an existing completed-data assignment.
//
// Since: UNRELEASED
func (rules storageDirectoryRules) usableForPurpose(
	path string,
	purpose string,
) (bool, string) {
	if purpose == storageDirectoryPurposeDownload {
		return rules.downloadPolicy.downloadSelection(path)
	}
	if purpose == storageDirectoryPurposeProfile {
		if usable, reason := rules.downloadPolicy.downloadSelection(path); !usable {
			return false, reason
		}
		if rules.selectedProfileID != "default" {
			switch storage.TorrentProfileFolderRelation(path, rules.downloadPolicy.downloadDirectory) {
			case "same":
				return false, fmt.Sprintf(
					"“%s” is already the %s's folder.",
					filepath.Base(path),
					rules.defaultProfileLabel(),
				)
			case "inside":
				return false, fmt.Sprintf(
					"This folder is inside the %s's folder.",
					rules.defaultProfileLabel(),
				)
			case "contains":
				return false, fmt.Sprintf(
					"This folder contains the %s's folder.",
					rules.defaultProfileLabel(),
				)
			}
		}
		for _, profile := range rules.profiles {
			if profile.ID == rules.selectedProfileID {
				continue
			}
			switch storage.TorrentProfileFolderRelation(path, profile.DownloadDirectory) {
			case "same":
				return false, torrentProfileFolderTakenMessage(path, profile.Name)
			case "inside":
				return false, fmt.Sprintf("This folder is inside the %s profile's folder.", profile.Name)
			case "contains":
				return false, fmt.Sprintf("This folder contains the %s profile's folder.", profile.Name)
			}
		}

		return true, ""
	}
	if path == rules.downloadPolicy.incompleteDirectory {
		return true, ""
	}
	for _, downloadPath := range rules.downloadPathsForIncomplete {
		if settings.DataPathContains(path, downloadPath.Path) {
			return false, settings.IncompleteDirectoryClashMessage(path, downloadPath)
		}
	}

	return true, ""
}

// tags returns picker labels in their stable contract order.
//
// The incomplete marker leads the setting-backed Default profile, followed by named
// profile labels, so callers never need to reconstruct assignment context.
//
// Since: UNRELEASED
func (rules storageDirectoryRules) tags(path string) []string {
	tags := make([]string, 0, 2+len(rules.profiles))
	if path == rules.downloadPolicy.incompleteDirectory {
		tags = append(tags, "Incomplete folder")
	}
	if path == rules.downloadPolicy.downloadDirectory {
		tags = append(tags, rules.defaultProfileLabel())
	}
	for _, profile := range rules.profiles {
		if profile.DownloadDirectory == path {
			tags = append(tags, profile.Name+" profile")
		}
	}

	return tags
}

// deleteAvailability applies the first matching folder-deletion rule.
//
// Assignment rules precede uncertain torrent state and filesystem facts so every
// entry exposes the most specific stable reason that currently prevents deletion.
//
// Since: UNRELEASED
func (rules storageDirectoryRules) deleteAvailability(
	entry directorybrowser.DirectoryEntry,
) (storageDirectoryDeleteState, string) {
	incompleteDirectory := rules.downloadPolicy.incompleteDirectory
	if !strings.EqualFold(entry.Path, incompleteDirectory) &&
		dataPathContainsFold(incompleteDirectory, entry.Path) {
		return storageDirectoryDeleteInUse,
			"Folders inside the incomplete folder belong to Transmission, so they can't be deleted here."
	}
	if strings.EqualFold(entry.Path, incompleteDirectory) {
		return storageDirectoryDeleteInUse, fmt.Sprintf(
			"“%s” is the Incomplete folder in Settings, so it can't be deleted.",
			entry.Name,
		)
	}
	for _, profile := range rules.profiles {
		if strings.EqualFold(profile.DownloadDirectory, entry.Path) {
			return storageDirectoryDeleteInUse, fmt.Sprintf(
				"“%s” is the %s profile's folder, so it can't be deleted.",
				entry.Name,
				profile.Name,
			)
		}
	}
	if strings.EqualFold(entry.Path, rules.downloadPolicy.downloadDirectory) {
		return storageDirectoryDeleteInUse, fmt.Sprintf(
			"“%s” is the %s's folder, so it can't be deleted.",
			entry.Name,
			rules.defaultProfileLabel(),
		)
	}
	if !rules.torrentLocationsAvailable {
		return storageDirectoryDeleteTorrentLocationsUnavailable,
			torrentLocationsUnavailableMessage
	}
	if _, found := rules.torrentDirectories[strings.ToLower(entry.Path)]; found {
		return storageDirectoryDeleteInUse, torrentDirectoryDeleteMessage(entry.Name)
	}
	if !entry.Checked {
		return storageDirectoryDeleteInUse, fmt.Sprintf(
			"“%s” couldn't be checked in time, so it can't be deleted right now. Try again in a moment.",
			entry.Name,
		)
	}
	if entry.MountPoint {
		return storageDirectoryDeleteInUse, separateMountDeleteMessage(entry.Name)
	}
	if !entry.Readable {
		return storageDirectoryDeleteInUse, fmt.Sprintf(
			"Transmission's account can't open “%s”, so it can't be deleted here.",
			entry.Name,
		)
	}
	if !entry.Empty {
		return storageDirectoryDeleteNotEmpty, notEmptyDeleteMessage(entry.Name)
	}

	return storageDirectoryDeleteAllowed, ""
}

// defaultProfileLabel supplies a safe label for isolated policy tests and corrupt state.
func (rules storageDirectoryRules) defaultProfileLabel() string {
	if strings.TrimSpace(rules.defaultProfileName) == "" {
		return "Default profile"
	}

	return rules.defaultProfileName
}

func setStorageDirectoryProfilePurpose(
	responseWriter http.ResponseWriter,
	request *http.Request,
	purpose string,
	rules *storageDirectoryRules,
) bool {
	if purpose != storageDirectoryPurposeProfile {
		return true
	}

	profileID := request.URL.Query().Get("profileId")
	if profileID == "default" || profileID == "new" {
		rules.selectedProfileID = profileID

		return true
	}
	for _, profile := range rules.profiles {
		if profile.ID == profileID {
			rules.selectedProfileID = profileID

			return true
		}
	}

	writeFieldError(
		responseWriter,
		http.StatusUnprocessableEntity,
		"invalid_request",
		"profileId",
		"profileId must be default, new, or an existing torrent profile ID.",
	)

	return false
}

func torrentProfileFolderTakenMessage(path string, profileName string) string {
	return fmt.Sprintf(
		"“%s” is already the %s profile's folder.",
		filepath.Base(path),
		profileName,
	)
}

// dataPathContainsFold compares normalized storage paths without case sensitivity.
//
// Lowercasing before the segment-aware shared helper protects descendants without
// confusing similarly prefixed siblings such as incomplete and incomplete-old.
//
// Since: UNRELEASED
func dataPathContainsFold(parentPath string, candidatePath string) bool {
	return settings.DataPathContains(
		strings.ToLower(parentPath),
		strings.ToLower(candidatePath),
	)
}

// separateMountDeleteMessage explains the mount-point deletion boundary.
//
// Rule nine uses this text when the controller reports that a child resides on a
// different device from its already opened parent directory.
//
// Since: UNRELEASED
func separateMountDeleteMessage(name string) string {
	return fmt.Sprintf("“%s” is a separate mount, so it can't be deleted.", name)
}

// torrentDirectoryDeleteMessage explains a live torrent-folder conflict.
//
// Policy checks and an EBUSY controller race share this wording because the public
// DELETE contract classifies a busy removal as a torrent location still in use.
//
// Since: UNRELEASED
func torrentDirectoryDeleteMessage(name string) string {
	return fmt.Sprintf("A torrent is saved in “%s”, so it can't be deleted.", name)
}

// notEmptyDeleteMessage explains the non-recursive deletion boundary.
//
// The guidance directs cleanup to the user's filesystem because this API never
// removes contents or performs a recursive operation on Transmission data.
//
// Since: UNRELEASED
func notEmptyDeleteMessage(name string) string {
	return fmt.Sprintf(
		"Only empty folders can be deleted here. Remove what's inside “%s” from your file system first.",
		name,
	)
}

// writeDirectoryDeleteError maps controller races to the public deletion contract.
//
// Filesystem state can change after the advisory check, so stable controller codes
// are translated into the same conflict messages returned by preflight policy.
//
// Since: UNRELEASED
func (server *Server) writeDirectoryDeleteError(
	responseWriter http.ResponseWriter,
	name string,
	err error,
) {
	switch directorybrowser.CodeOf(err) {
	case directorybrowser.ErrorCodeNotEmpty:
		writeError(
			responseWriter,
			http.StatusConflict,
			"directory_not_empty",
			notEmptyDeleteMessage(name),
		)
	case directorybrowser.ErrorCodeBusy:
		writeError(
			responseWriter,
			http.StatusConflict,
			"directory_in_use",
			torrentDirectoryDeleteMessage(name),
		)
	case directorybrowser.ErrorCodeReadOnly:
		writeError(
			responseWriter,
			http.StatusForbidden,
			"directory_permission_denied",
			fmt.Sprintf(
				"The storage under /data is read-only, so “%s” can't be deleted.",
				name,
			),
		)
	case directorybrowser.ErrorCodeInvalidName:
		writeError(
			responseWriter,
			http.StatusUnprocessableEntity,
			"directory_path_invalid",
			err.Error(),
		)
	default:
		server.writeDirectoryBrowserError(responseWriter, err)
	}
}

// writeDirectoryBrowserError maps stable controller failures to the public API.
//
// Transport and unexpected failures are logged internally and returned as a generic
// service-unavailable response without leaking filesystem details.
//
// Since: UNRELEASED
func (server *Server) writeDirectoryBrowserError(
	responseWriter http.ResponseWriter,
	err error,
) {
	switch directorybrowser.CodeOf(err) {
	case directorybrowser.ErrorCodeAlreadyExists:
		writeError(responseWriter, http.StatusConflict, "directory_exists", err.Error())
	case directorybrowser.ErrorCodeInvalidName:
		writeError(responseWriter, http.StatusUnprocessableEntity, "directory_name_invalid", err.Error())
	case directorybrowser.ErrorCodeInvalidPath, directorybrowser.ErrorCodeNotDirectory:
		writeError(responseWriter, http.StatusUnprocessableEntity, "directory_path_invalid", err.Error())
	case directorybrowser.ErrorCodeNotFound:
		writeError(responseWriter, http.StatusNotFound, "directory_not_found", err.Error())
	case directorybrowser.ErrorCodePermissionDenied:
		writeError(responseWriter, http.StatusForbidden, "directory_permission_denied", err.Error())
	default:
		server.logInternalError("directory browser request", err)
		writeDirectoryBrowserUnavailable(responseWriter)
	}
}

// writeDirectoryBrowserUnavailable returns the stable helper-availability error.
//
// A shared response keeps nil clients, transport failures, and consistency races
// indistinguishable to callers while detailed causes remain in internal logs.
//
// Since: UNRELEASED
func writeDirectoryBrowserUnavailable(responseWriter http.ResponseWriter) {
	writeError(
		responseWriter,
		http.StatusServiceUnavailable,
		"directory_browser_unavailable",
		"The directory browser is unavailable.",
	)
}
