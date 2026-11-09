package api

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

type backupImportSourceRequest struct {
	Source         string            `json:"source"`
	Document       json.RawMessage   `json:"document,omitempty"`
	ConfigPath     string            `json:"configPath,omitempty"`
	FolderMappings map[string]string `json:"folderMappings,omitempty"`
	ProfileActions map[string]string `json:"profileActions,omitempty"`
}

type backupImportRequest struct {
	Grant              string             `json:"grant"`
	Source             string             `json:"source"`
	Document           json.RawMessage    `json:"document,omitempty"`
	ConfigPath         string             `json:"configPath,omitempty"`
	FolderMappings     map[string]string  `json:"folderMappings"`
	ProfileActions     map[string]string  `json:"profileActions"`
	ProfileNames       map[string]string  `json:"profileNames,omitempty"`
	ProfileConnections map[string]*string `json:"profileConnections,omitempty"`
	ProfileIncluded    map[string]bool    `json:"profileIncluded,omitempty"`
}

type backupImportPayload struct {
	AdministratorID int64             `json:"administratorId"`
	Document        backupDocument    `json:"document"`
	FolderMappings  map[string]string `json:"folderMappings"`
	ProfileActions  map[string]string `json:"profileActions"`
}

type backupImportFolderPreview struct {
	SourcePath      string `json:"sourcePath"`
	Kind            string `json:"kind,omitempty"`
	Description     string `json:"description,omitempty"`
	MappedPath      string `json:"mappedPath,omitempty"`
	TorrentCount    int    `json:"torrentCount,omitempty"`
	DataFound       bool   `json:"dataFound"`
	DataFoundCount  int    `json:"dataFoundCount,omitempty"`
	DataTotal       int    `json:"dataTotal,omitempty"`
	DataFoundStatus string `json:"dataFoundStatus,omitempty"`
	Conflict        string `json:"conflict,omitempty"`
}

type backupImportProfilePreview struct {
	ID              string  `json:"id"`
	Name            string  `json:"name"`
	Default         bool    `json:"default"`
	ExistingID      *string `json:"existingId"`
	ExistingName    *string `json:"existingName"`
	SuggestedAction string  `json:"suggestedAction"`
	SourcePath      string  `json:"sourcePath,omitempty"`
	ConnectionID    *string `json:"connectionId,omitempty"`
	Empty           bool    `json:"empty,omitempty"`
	Included        bool    `json:"included"`
	Note            string  `json:"note,omitempty"`
}

type backupImportSettingPreview struct {
	Key        string          `json:"key"`
	Title      string          `json:"title"`
	FileValue  json.RawMessage `json:"fileValue"`
	HereValue  json.RawMessage `json:"hereValue,omitempty"`
	WillImport bool            `json:"willImport"`
	Reason     string          `json:"reason,omitempty"`
}

type backupImportConnectionPreview struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Default bool   `json:"default"`
}

type backupImportSourcePreview struct {
	Version       int    `json:"version"`
	SettingsFile  string `json:"settingsFile"`
	TorrentCount  int    `json:"torrentCount"`
	ReadOnly      bool   `json:"readOnly"`
	IncompleteDir string `json:"incompleteDirectory,omitempty"`
}

type backupImportPreview struct {
	ExportedAt      time.Time                       `json:"exportedAt"`
	AppVersion      string                          `json:"appVersion"`
	Actions         []string                        `json:"actions"`
	Folders         []backupImportFolderPreview     `json:"folders"`
	Profiles        []backupImportProfilePreview    `json:"profiles"`
	Settings        []backupImportSettingPreview    `json:"settings"`
	Sections        []string                        `json:"sections"`
	TorrentCount    int                             `json:"torrentCount"`
	HasRemoteLogins bool                            `json:"hasRemoteLogins"`
	TotalSizeBytes  int64                           `json:"totalSizeBytes"`
	RunningCount    int                             `json:"runningTorrentCount"`
	DataMissing     int                             `json:"dataMissingCount,omitempty"`
	DataFoundBytes  int64                           `json:"dataFoundBytes,omitempty"`
	AlreadyPresent  int                             `json:"alreadyPresentCount,omitempty"`
	Connections     []backupImportConnectionPreview `json:"connections"`
	SourceDetails   *backupImportSourcePreview      `json:"sourceDetails,omitempty"`
}

func (server *Server) handleBackupImportPreview(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	var input backupImportSourceRequest
	if err := decodeBackupJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}
	var preview backupImportPreview
	var err error
	switch input.Source {
	case "transmission-vpn-export":
		var document backupDocument
		document, err = decodeBackupDocument(input.Document)
		if err == nil {
			preview, err = server.buildBackupImportPreview(request.Context(), document, input.FolderMappings, input.ProfileActions)
		}
	case backupAnotherTransmissionSource:
		var inspection anotherTransmissionInspection
		inspection, err = server.inspectAnotherTransmission(request.Context(), input.ConfigPath)
		if err == nil {
			preview, err = server.buildAnotherTransmissionPreview(
				request.Context(),
				inspection,
				input.FolderMappings,
			)
		}
	default:
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "source_invalid", "source", "Choose a supported import source.")

		return
	}
	if err != nil {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "import_source_invalid", "source", err.Error())

		return
	}
	if preview.Actions == nil {
		preview.Actions = []string{}
	}
	writeJSON(responseWriter, http.StatusOK, map[string]any{"preview": preview})
}

func (server *Server) buildBackupImportPreview(
	ctx context.Context,
	document backupDocument,
	folderMappings map[string]string,
	profileActions map[string]string,
) (backupImportPreview, error) {
	preview := backupImportPreview{
		ExportedAt:  document.ExportedAt,
		AppVersion:  document.AppVersion,
		Actions:     []string{},
		Folders:     []backupImportFolderPreview{},
		Profiles:    []backupImportProfilePreview{},
		Settings:    []backupImportSettingPreview{},
		Sections:    backupDocumentSectionNames(document),
		Connections: []backupImportConnectionPreview{},
	}
	if document.Torrents != nil {
		preview.TorrentCount = len(*document.Torrents)
		presentTorrents, _ := server.refreshTorrentHashIndex(ctx)
		for _, torrent := range *document.Torrents {
			if _, present := presentTorrents[strings.ToLower(torrent.Hash)]; present {
				preview.AlreadyPresent++

				continue
			}
			if !torrent.Paused {
				preview.RunningCount++
			}
			metainfo, decodeError := base64.StdEncoding.DecodeString(torrent.Metainfo)
			if decodeError != nil {
				continue
			}
			_, _, sizeBytes, detailsError := anotherTransmissionMetainfoDetails(metainfo)
			if detailsError == nil {
				preview.TotalSizeBytes += sizeBytes
			}
		}
	}
	if document.RemoteAccess != nil {
		preview.HasRemoteLogins = len(document.RemoteAccess.RPCLogins) > 0 ||
			len(document.RemoteAccess.APITokens) > 0
	}
	connections, err := server.store.ListVPNConnections(ctx)
	if err != nil {
		return backupImportPreview{}, err
	}
	for _, connection := range connections {
		preview.Connections = append(preview.Connections, backupImportConnectionPreview{
			ID:      connection.ID,
			Name:    connection.Name,
			Default: connection.IsDefault,
		})
	}
	mergeResult, err := server.planBackupImportMerges(ctx, document)
	if err != nil {
		return backupImportPreview{}, err
	}
	preview.Actions = backupImportActionLines(mergeResult)
	if document.SettingsAndProfiles == nil {
		return preview, nil
	}

	currentProfiles, err := server.store.ListTorrentProfiles(ctx)
	if err != nil {
		return backupImportPreview{}, err
	}
	currentDefault, err := server.store.DefaultTorrentProfile(ctx)
	if err != nil {
		return backupImportPreview{}, err
	}
	defaultID := "default"
	defaultName := currentDefault.Name
	preview.Profiles = append(preview.Profiles, backupImportProfilePreview{
		ID:              "default",
		Name:            document.SettingsAndProfiles.DefaultProfile.Name,
		Default:         true,
		ExistingID:      &defaultID,
		ExistingName:    &defaultName,
		SuggestedAction: "replace",
		Included:        true,
	})
	for _, importedProfile := range document.SettingsAndProfiles.Profiles {
		profilePreview := backupImportProfilePreview{
			ID:              importedProfile.ID,
			Name:            importedProfile.Name,
			SuggestedAction: "replace",
			Included:        true,
		}
		for _, currentProfile := range currentProfiles {
			if strings.EqualFold(currentProfile.Name, importedProfile.Name) {
				existingID := currentProfile.ID
				existingName := currentProfile.Name
				profilePreview.ExistingID = &existingID
				profilePreview.ExistingName = &existingName

				break
			}
		}
		preview.Profiles = append(preview.Profiles, profilePreview)
	}

	paths := backupProfileFolders(*document.SettingsAndProfiles)
	folderConflicts := backupExportFolderConflicts(*document.SettingsAndProfiles, folderMappings, profileActions, currentProfiles)
	for _, path := range paths {
		dataFound := false
		if server.directoryBrowser != nil {
			_, listError := server.directoryBrowser.List(ctx, path)
			dataFound = listError == nil
		}
		// A folder that overlaps another profile's folder is listed even when it exists,
		// so it can be mapped to a folder of its own.
		if !dataFound || folderConflicts[path] != "" || strings.TrimSpace(folderMappings[path]) != "" {
			preview.Folders = append(preview.Folders, backupImportFolderPreview{
				SourcePath: path,
				MappedPath: strings.TrimSpace(folderMappings[path]),
				DataFound:  dataFound,
				Conflict:   folderConflicts[path],
			})
		}
	}

	currentSettings, err := server.store.EffectiveConfiguration(ctx, server.registry)
	if err != nil {
		return backupImportPreview{}, err
	}
	currentByKey := make(map[string]storage.EffectiveSetting, len(currentSettings.Settings))
	for _, setting := range currentSettings.Settings {
		currentByKey[setting.Key] = setting
	}
	for _, importedSetting := range document.SettingsAndProfiles.Settings {
		settingPreview := backupImportSettingPreview{
			Key:        importedSetting.Key,
			Title:      importedSetting.Key,
			FileValue:  append(json.RawMessage(nil), importedSetting.Value...),
			WillImport: true,
		}
		currentSetting, found := currentByKey[importedSetting.Key]
		if !found {
			settingPreview.WillImport = false
			settingPreview.Reason = "This version does not have that setting."
		} else {
			settingPreview.Title = currentSetting.Title
			settingPreview.HereValue = append(json.RawMessage(nil), currentSetting.Value...)
			if currentSetting.Locked {
				settingPreview.WillImport = false
				settingPreview.Reason = "Managed configuration locks this setting."
			} else if _, validationError := server.registry.Validate(
				importedSetting.Key,
				importedSetting.Value,
			); validationError != nil {
				settingPreview.WillImport = false
				settingPreview.Reason = "The saved value is not valid in this version."
			}
		}
		preview.Settings = append(preview.Settings, settingPreview)
	}

	return preview, nil
}

func (server *Server) handleCreateBackupImport(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	var input backupImportRequest
	if err := decodeBackupJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}
	if input.FolderMappings == nil {
		input.FolderMappings = map[string]string{}
	}
	if input.ProfileActions == nil {
		input.ProfileActions = map[string]string{}
	}
	var document backupDocument
	var err error
	settingCount := 0
	profileCount := 0
	totalSizeBytes := int64(0)
	switch input.Source {
	case "transmission-vpn-export":
		document, err = decodeBackupDocument(input.Document)
	case backupAnotherTransmissionSource:
		var inspection anotherTransmissionInspection
		inspection, err = server.inspectAnotherTransmission(request.Context(), input.ConfigPath)
		if err == nil {
			document, err = server.buildAnotherTransmissionDocument(request.Context(), inspection, input)
		}
		if err == nil {
			mapAnotherTransmissionIncompleteFolder(inspection.SettingPreview, inspection, input.FolderMappings)
			for _, setting := range inspection.SettingPreview {
				// Count only the settings Review lists as changing.
				if setting.WillImport && !sameJSONValue(setting.FileValue, setting.HereValue) {
					settingCount++
				}
			}
			profileCount = 1 + len(document.SettingsAndProfiles.Profiles)
			totalSizeBytes = inspection.TotalSizeBytes
		}
	default:
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "source_invalid", "source", "Choose a supported import source.")

		return
	}
	if err != nil {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "import_source_invalid", "source", err.Error())

		return
	}
	if document.SettingsAndProfiles != nil && input.Source != backupAnotherTransmissionSource && settingCount == 0 {
		settingCount = len(document.SettingsAndProfiles.Settings)
		profileCount = 1 + len(document.SettingsAndProfiles.Profiles)
	}
	if err := server.validateBackupImportPlan(
		request.Context(),
		document,
		input.FolderMappings,
		input.ProfileActions,
	); err != nil {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "import_plan_invalid", "document", err.Error())

		return
	}
	mergeResult, err := server.planBackupImportMerges(request.Context(), document)
	if err != nil {
		server.logInternalError("plan backup merge", err)
		writeInternalError(responseWriter)

		return
	}
	if !server.consumeBackupGrant(responseWriter, request, input.Grant, "import") {
		return
	}

	jobID, err := security.NewIdentifier()
	if err != nil {
		server.logInternalError("generate backup import identifier", err)
		writeInternalError(responseWriter)

		return
	}
	payload := backupImportPayload{
		AdministratorID: principalFromContext(request.Context()).AdministratorID,
		Document:        document,
		FolderMappings:  input.FolderMappings,
		ProfileActions:  input.ProfileActions,
	}
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		server.logInternalError("encode backup import payload", err)
		writeInternalError(responseWriter)

		return
	}
	nonce, ciphertext, err := security.EncryptSecret(
		server.installationKey,
		"backup/import/"+jobID,
		payloadJSON,
	)
	clear(payloadJSON)
	if err != nil {
		server.logInternalError("encrypt backup import payload", err)
		writeInternalError(responseWriter)

		return
	}
	items := []storage.BackupImportItem{}
	if document.Torrents != nil {
		items = make([]storage.BackupImportItem, 0, len(*document.Torrents))
		for _, torrent := range *document.Torrents {
			items = append(items, storage.BackupImportItem{
				Hash:        strings.ToLower(torrent.Hash),
				Name:        torrent.Name,
				ProfileName: torrent.ProfileName,
				Folder:      mappedBackupFolder(input.FolderMappings, torrent.DownloadDirectory),
			})
		}
	}
	job, err := server.store.CreateBackupImportJob(request.Context(), storage.BackupImportJob{
		ID:                jobID,
		Source:            input.Source,
		PayloadNonce:      nonce,
		PayloadCiphertext: ciphertext,
		Summary: map[string]any{
			"actions":        backupImportActionLines(mergeResult),
			"sections":       backupDocumentSectionNames(document),
			"warnings":       []string{},
			"profileCount":   profileCount,
			"settingCount":   settingCount,
			"totalSizeBytes": totalSizeBytes,
		},
		Items: items,
	})
	if err != nil {
		if strings.Contains(err.Error(), "backup_import_jobs_active_index") ||
			strings.Contains(err.Error(), "UNIQUE constraint failed") {
			writeError(responseWriter, http.StatusConflict, "import_running", "Another import is already running.")

			return
		}
		server.logInternalError("create backup import", err)
		writeInternalError(responseWriter)

		return
	}
	server.startBackupImport(job.ID)
	writeJSON(responseWriter, http.StatusAccepted, map[string]any{"job": backupImportJobResponse(job)})
}

func (server *Server) validateBackupImportPlan(
	ctx context.Context,
	document backupDocument,
	folderMappings map[string]string,
	profileActions map[string]string,
) error {
	if document.SettingsAndProfiles != nil {
		for _, sourcePath := range backupProfileFolders(*document.SettingsAndProfiles) {
			if server.directoryBrowser != nil && strings.TrimSpace(folderMappings[sourcePath]) == "" {
				if _, err := server.directoryBrowser.List(ctx, sourcePath); err == nil {
					continue
				}
			}
			targetPath := strings.TrimSpace(folderMappings[sourcePath])
			normalizedPath, err := settings.NormalizeDataPath(targetPath)
			if err != nil || normalizedPath != targetPath {
				return fmt.Errorf("choose an existing folder under /data for %s", sourcePath)
			}
			if server.directoryBrowser == nil {
				return errors.New("the folder picker is unavailable")
			}
			if _, err := server.directoryBrowser.List(ctx, targetPath); err != nil {
				return fmt.Errorf("the mapped folder for %s does not exist", sourcePath)
			}
		}

		currentProfiles, err := server.store.ListTorrentProfiles(ctx)
		if err != nil {
			return err
		}
		folderConflicts := backupExportFolderConflicts(*document.SettingsAndProfiles, folderMappings, profileActions, currentProfiles)
		for _, sourcePath := range backupProfileFolders(*document.SettingsAndProfiles) {
			if message := folderConflicts[sourcePath]; message != "" {
				return fmt.Errorf("%s: %s", sourcePath, message)
			}
		}
		for _, profile := range document.SettingsAndProfiles.Profiles {
			conflict := false
			for _, current := range currentProfiles {
				if strings.EqualFold(current.Name, profile.Name) {
					conflict = true

					break
				}
			}
			action := profileActions[profile.ID]
			if conflict && action != "replace" && action != "keep" {
				return fmt.Errorf("choose Replace or Keep this one for %s", profile.Name)
			}
			if !conflict && action != "" && action != "replace" {
				return fmt.Errorf("profile action for %s is invalid", profile.Name)
			}
		}
	}

	return nil
}

func (server *Server) handleCurrentBackupImport(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	job, err := server.store.ActiveBackupImportJob(request.Context())
	if errors.Is(err, storage.ErrNotFound) {
		writeJSON(responseWriter, http.StatusOK, map[string]any{"job": nil})

		return
	}
	if err != nil {
		server.logInternalError("read active backup import", err)
		writeInternalError(responseWriter)

		return
	}
	writeJSON(responseWriter, http.StatusOK, map[string]any{"job": backupImportJobResponse(job)})
}

func (server *Server) handleGetBackupImport(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	job, err := server.store.BackupImportJobByID(request.Context(), request.PathValue("importID"))
	if errors.Is(err, storage.ErrNotFound) {
		writeError(responseWriter, http.StatusNotFound, "import_not_found", "That import no longer exists.")

		return
	}
	if err != nil {
		server.logInternalError("read backup import", err)
		writeInternalError(responseWriter)

		return
	}
	writeJSON(responseWriter, http.StatusOK, map[string]any{"job": backupImportJobResponse(job)})
}

func backupImportJobResponse(job storage.BackupImportJob) map[string]any {
	items := make([]map[string]any, 0, len(job.Items))
	for _, item := range job.Items {
		items = append(items, map[string]any{
			"hash":        item.Hash,
			"name":        item.Name,
			"profileName": item.ProfileName,
			"folder":      item.Folder,
			"state":       item.State,
			"progress":    item.Progress,
			"detail":      item.Detail,
		})
	}
	return map[string]any{
		"id":                job.ID,
		"source":            job.Source,
		"status":            job.Status,
		"totalTorrents":     job.TotalTorrents,
		"completedTorrents": job.CompletedTorrents,
		"summary":           job.Summary,
		"error":             job.Error,
		"createdAt":         job.CreatedAt,
		"updatedAt":         job.UpdatedAt,
		"startedAt":         job.StartedAt,
		"completedAt":       job.CompletedAt,
		"items":             items,
	}
}

func backupProfileFolders(section backupSettingsAndProfilesSection) []string {
	folders := []string{section.DefaultProfile.DownloadDirectory}
	for _, profile := range section.Profiles {
		folders = append(folders, profile.DownloadDirectory)
	}
	sort.SliceStable(folders, func(left int, right int) bool {
		return strings.ToLower(folders[left]) < strings.ToLower(folders[right])
	})
	unique := folders[:0]
	for _, folder := range folders {
		if len(unique) == 0 || !strings.EqualFold(unique[len(unique)-1], folder) {
			unique = append(unique, folder)
		}
	}

	return unique
}

// backupExportFolderConflicts explains export-file profile folders that would overlap.
//
// The folders are compared as they would be after the import: the file's Default and
// named profiles at their mapped folders, plus every profile here that the file does
// not replace. Exports saved before the one-folder rule can hold nested folders, and
// each one must be mapped to a folder of its own before the import can run.
func backupExportFolderConflicts(
	section backupSettingsAndProfilesSection,
	folderMappings map[string]string,
	profileActions map[string]string,
	currentProfiles []storage.TorrentProfile,
) map[string]string {
	type finalFolder struct {
		source string
		target string
		label  string
	}
	folders := []finalFolder{{
		source: section.DefaultProfile.DownloadDirectory,
		target: mappedBackupFolder(folderMappings, section.DefaultProfile.DownloadDirectory),
		label:  "Default profile",
	}}
	replaced := map[string]struct{}{}
	for _, profile := range section.Profiles {
		kept := false
		for _, current := range currentProfiles {
			if !strings.EqualFold(current.Name, profile.Name) {
				continue
			}
			if profileActions[profile.ID] == "keep" {
				kept = true
			} else {
				replaced[current.ID] = struct{}{}
			}
		}
		if kept {
			continue
		}
		folders = append(folders, finalFolder{
			source: profile.DownloadDirectory,
			target: mappedBackupFolder(folderMappings, profile.DownloadDirectory),
			label:  profile.Name + " profile",
		})
	}
	for _, current := range currentProfiles {
		if _, found := replaced[current.ID]; found {
			continue
		}
		folders = append(folders, finalFolder{target: current.DownloadDirectory, label: current.Name + " profile"})
	}

	conflicts := map[string]string{}
	for index, folder := range folders {
		if folder.source == "" || conflicts[folder.source] != "" {
			continue
		}
		for otherIndex, other := range folders {
			if otherIndex == index || strings.EqualFold(other.source, folder.source) && other.source != "" {
				continue
			}
			switch storage.TorrentProfileFolderRelation(folder.target, other.target) {
			case "same":
				conflicts[folder.source] = fmt.Sprintf("This folder is also the %s's folder.", other.label)
			case "inside":
				conflicts[folder.source] = fmt.Sprintf("This folder is inside the %s's folder.", other.label)
			case "contains":
				conflicts[folder.source] = fmt.Sprintf("This folder contains the %s's folder.", other.label)
			}
			if conflicts[folder.source] != "" {
				break
			}
		}
	}

	return conflicts
}

func mappedBackupFolder(mappings map[string]string, sourcePath string) string {
	if mappedPath := strings.TrimSpace(mappings[sourcePath]); mappedPath != "" {
		return mappedPath
	}

	return sourcePath
}

func (server *Server) planBackupImportMerges(
	ctx context.Context,
	document backupDocument,
) (storage.BackupMergeResult, error) {
	result := storage.BackupMergeResult{}
	if document.Notifications != nil {
		targets := make([]storage.NotificationTarget, 0, len(*document.Notifications))
		for _, notification := range *document.Notifications {
			targets = append(targets, storage.NotificationTarget{
				ID:   notification.ID,
				Name: notification.Name,
			})
		}
		notificationResult, err := server.store.PlanBackupNotifications(ctx, targets)
		if err != nil {
			return storage.BackupMergeResult{}, err
		}
		addBackupMergeResult(&result, notificationResult)
	}
	if document.RemoteAccess != nil {
		backup, err := backupRemoteAccessFromSection(*document.RemoteAccess)
		if err != nil {
			return storage.BackupMergeResult{}, err
		}
		remoteResult, err := server.store.PlanBackupRemoteAccess(ctx, backup)
		if err != nil {
			return storage.BackupMergeResult{}, err
		}
		addBackupMergeResult(&result, remoteResult)
	}

	return result, nil
}

func backupRemoteAccessFromSection(
	section backupRemoteAccessSection,
) (storage.BackupRemoteAccess, error) {
	backup := storage.BackupRemoteAccess{
		RPCLogins: make([]storage.RPCLogin, 0, len(section.RPCLogins)),
		APITokens: make([]storage.BackupAPIToken, 0, len(section.APITokens)),
	}
	for _, login := range section.RPCLogins {
		digest, err := base64.StdEncoding.DecodeString(login.SecretDigest)
		if err != nil {
			return storage.BackupRemoteAccess{}, err
		}
		backup.RPCLogins = append(backup.RPCLogins, storage.RPCLogin{
			ID:           login.ID,
			Username:     login.Username,
			SecretDigest: digest,
			CreatedAt:    login.CreatedAt,
			UpdatedAt:    login.UpdatedAt,
			LastUsedAt:   login.LastUsedAt,
		})
	}
	for _, token := range section.APITokens {
		digest, err := base64.StdEncoding.DecodeString(token.TokenDigest)
		if err != nil {
			return storage.BackupRemoteAccess{}, err
		}
		backup.APITokens = append(backup.APITokens, storage.BackupAPIToken{
			APIToken: storage.APIToken{
				ID:         token.ID,
				Name:       token.Name,
				Scopes:     append([]string{}, token.Scopes...),
				ExpiresAt:  token.ExpiresAt,
				CreatedAt:  token.CreatedAt,
				LastUsedAt: token.LastUsedAt,
			},
			Digest: digest,
		})
	}

	return backup, nil
}

func addBackupMergeResult(target *storage.BackupMergeResult, addition storage.BackupMergeResult) {
	target.NotificationReplacements += addition.NotificationReplacements
	target.NotificationAdditions += addition.NotificationAdditions
	target.NotificationMaximumSkips += addition.NotificationMaximumSkips
	target.RPCLoginReplacements += addition.RPCLoginReplacements
	target.RPCLoginAdditions += addition.RPCLoginAdditions
	target.RPCLoginMaximumSkips += addition.RPCLoginMaximumSkips
	target.APITokenAdditions += addition.APITokenAdditions
	target.APITokenDuplicateSkips += addition.APITokenDuplicateSkips
	target.APITokenMaximumSkips += addition.APITokenMaximumSkips
}

func backupImportActionLines(result storage.BackupMergeResult) []string {
	actions := []string{}
	if result.NotificationReplacements > 0 {
		actions = append(actions, fmt.Sprintf(
			"Replace %s with the same name",
			backupImportCountLabel(
				result.NotificationReplacements,
				"notification destination",
				"notification destinations",
			),
		))
	}
	if result.NotificationAdditions > 0 {
		actions = append(actions, "Add "+backupImportCountLabel(
			result.NotificationAdditions,
			"notification destination",
			"notification destinations",
		))
	}
	if result.NotificationMaximumSkips > 0 {
		actions = append(actions, fmt.Sprintf(
			"Skip %s because this app allows at most %d notification destinations",
			backupImportCountLabel(
				result.NotificationMaximumSkips,
				"notification destination",
				"notification destinations",
			),
			storage.MaximumBackupNotificationDestinations,
		))
	}
	if result.RPCLoginReplacements > 0 {
		actions = append(actions, fmt.Sprintf(
			"Replace %s with the same username",
			backupImportCountLabel(result.RPCLoginReplacements, "RPC login", "RPC logins"),
		))
	}
	if result.RPCLoginAdditions > 0 {
		actions = append(actions, "Add "+backupImportCountLabel(
			result.RPCLoginAdditions,
			"RPC login",
			"RPC logins",
		))
	}
	if result.RPCLoginMaximumSkips > 0 {
		actions = append(actions, fmt.Sprintf(
			"Skip %s because this app allows at most %d RPC logins",
			backupImportCountLabel(result.RPCLoginMaximumSkips, "RPC login", "RPC logins"),
			storage.MaximumBackupRPCLogins,
		))
	}
	if result.APITokenAdditions > 0 {
		actions = append(actions, "Add "+backupImportCountLabel(
			result.APITokenAdditions,
			"API token",
			"API tokens",
		))
	}
	if result.APITokenDuplicateSkips > 0 {
		verb := "are"
		if result.APITokenDuplicateSkips == 1 {
			verb = "is"
		}
		actions = append(actions, fmt.Sprintf(
			"Skip %s that %s already here",
			backupImportCountLabel(result.APITokenDuplicateSkips, "API token", "API tokens"),
			verb,
		))
	}
	if result.APITokenMaximumSkips > 0 {
		actions = append(actions, fmt.Sprintf(
			"Skip %s because this app allows at most %d API tokens",
			backupImportCountLabel(result.APITokenMaximumSkips, "API token", "API tokens"),
			storage.MaximumBackupAPITokens,
		))
	}

	return actions
}

func backupImportCountLabel(count int, singular string, plural string) string {
	label := plural
	if count == 1 {
		label = singular
	}

	return fmt.Sprintf("%d %s", count, label)
}

func backupDocumentSectionNames(document backupDocument) []string {
	sections := []string{}
	if document.SettingsAndProfiles != nil {
		sections = append(sections, "Settings and profiles")
	}
	if document.Labels != nil {
		sections = append(sections, "Labels")
	}
	if document.Notifications != nil {
		sections = append(sections, "Notifications")
	}
	if document.Torrents != nil {
		sections = append(sections, "Torrent list")
	}
	if document.VPNConnections != nil {
		sections = append(sections, "VPN connections")
	}
	if document.RemoteAccess != nil {
		sections = append(sections, "Remote app logins and API tokens")
	}

	return sections
}

// sameJSONValue reports whether two JSON documents hold the same value.
func sameJSONValue(left json.RawMessage, right json.RawMessage) bool {
	var leftValue any
	var rightValue any
	if json.Unmarshal(left, &leftValue) != nil || json.Unmarshal(right, &rightValue) != nil {
		return bytes.Equal(left, right)
	}
	leftEncoded, leftError := json.Marshal(leftValue)
	rightEncoded, rightError := json.Marshal(rightValue)

	return leftError == nil && rightError == nil && bytes.Equal(leftEncoded, rightEncoded)
}
