package api

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/provider"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionrpc"
)

type backupImportConfigurationResult struct {
	ProfileIDs    map[string]string
	ConnectionIDs map[string]string
	MergeResult   storage.BackupMergeResult
	Warnings      []string
}

type backupImportVerificationTorrent struct {
	HashString      string  `json:"hashString"`
	Status          int64   `json:"status"`
	RecheckProgress float64 `json:"recheckProgress"`
	PercentDone     float64 `json:"percentDone"`
	Error           int64   `json:"error"`
	ErrorString     string  `json:"errorString"`
}

func (server *Server) resumeBackupImports() {
	jobs, err := server.store.ResumableBackupImportJobs(server.backupImportContext)
	if err != nil {
		server.logInternalError("resume backup imports", err)

		return
	}
	for _, job := range jobs {
		server.startBackupImport(job.ID)
	}
}

func (server *Server) startBackupImport(jobID string) {
	server.backupImportMutex.Lock()
	if _, running := server.backupImportRunning[jobID]; running {
		server.backupImportMutex.Unlock()

		return
	}
	server.backupImportRunning[jobID] = struct{}{}
	server.backupImportWait.Add(1)
	server.backupImportMutex.Unlock()

	go func() {
		defer server.backupImportWait.Done()
		defer func() {
			server.backupImportMutex.Lock()
			delete(server.backupImportRunning, jobID)
			server.backupImportMutex.Unlock()
		}()
		server.runBackupImport(server.backupImportContext, jobID)
	}()
}

func (server *Server) runBackupImport(ctx context.Context, jobID string) {
	job, err := server.store.BackupImportJobByID(ctx, jobID)
	if err != nil {
		if !errors.Is(err, context.Canceled) {
			server.logInternalError("read backup import payload", err)
		}

		return
	}
	if err := server.store.StartBackupImportJob(ctx, jobID); err != nil {
		if !errors.Is(err, context.Canceled) {
			server.logInternalError("start backup import job", err)
		}

		return
	}
	payloadJSON, err := security.DecryptSecret(
		server.installationKey,
		"backup/import/"+job.ID,
		job.PayloadNonce,
		job.PayloadCiphertext,
	)
	if err != nil {
		server.failBackupImport(jobID, "The encrypted import could not be opened.", err)

		return
	}
	var payload backupImportPayload
	err = json.Unmarshal(payloadJSON, &payload)
	clear(payloadJSON)
	if err != nil {
		server.failBackupImport(jobID, "The saved import plan is invalid.", err)

		return
	}
	if err := validateBackupDocument(payload.Document); err != nil {
		server.failBackupImport(jobID, "The saved export is invalid.", err)

		return
	}

	configurationResult, err := server.applyBackupConfiguration(ctx, payload)
	if err != nil {
		if errors.Is(err, context.Canceled) {
			return
		}
		server.failBackupImport(jobID, "Settings and connections could not be imported.", err)

		return
	}
	if payload.Document.Torrents != nil {
		for position := range *payload.Document.Torrents {
			if ctx.Err() != nil {
				return
			}
			item := job.Items[position]
			if backupImportItemTerminal(item.State) {
				continue
			}
			torrent := (*payload.Document.Torrents)[position]
			server.importBackupTorrent(
				ctx,
				jobID,
				position,
				torrent,
				payload.FolderMappings,
				configurationResult,
				item.State,
			)
		}
	}
	if ctx.Err() != nil {
		return
	}
	latest, err := server.store.BackupImportJobByID(ctx, jobID)
	if err != nil {
		server.failBackupImport(jobID, "Import progress could not be finalized.", err)

		return
	}
	failed := 0
	dataMissing := 0
	alreadyAdded := 0
	for _, item := range latest.Items {
		switch item.State {
		case "failed":
			failed++
		case "data-missing":
			dataMissing++
		case "already-added":
			alreadyAdded++
		}
	}
	summary := latest.Summary
	if summary == nil {
		summary = map[string]any{}
	}
	summary["actions"] = backupImportActionLines(configurationResult.MergeResult)
	summary["sections"] = backupDocumentSectionNames(payload.Document)
	summary["warnings"] = configurationResult.Warnings
	summary["failed"] = failed
	summary["dataMissing"] = dataMissing
	summary["alreadyAdded"] = alreadyAdded
	if err := server.store.FinishBackupImportJob(ctx, jobID, "completed", summary, ""); err != nil {
		server.logInternalError("finish backup import", err)
	}
}

func (server *Server) failBackupImport(jobID string, message string, err error) {
	server.logInternalError("run backup import", err)
	if finishError := server.store.FinishBackupImportJob(
		context.Background(),
		jobID,
		"failed",
		map[string]any{"warnings": []string{}},
		message,
	); finishError != nil {
		server.logInternalError("record failed backup import", finishError)
	}
}

func (server *Server) applyBackupConfiguration(
	ctx context.Context,
	payload backupImportPayload,
) (backupImportConfigurationResult, error) {
	result := backupImportConfigurationResult{
		ProfileIDs:    map[string]string{},
		ConnectionIDs: map[string]string{},
		Warnings:      []string{},
	}
	if payload.Document.VPNConnections != nil {
		warnings, connectionIDs, err := server.importBackupVPNConnections(
			ctx,
			*payload.Document.VPNConnections,
		)
		if err != nil {
			return result, err
		}
		result.Warnings = append(result.Warnings, warnings...)
		result.ConnectionIDs = connectionIDs
	}
	if payload.Document.SettingsAndProfiles != nil {
		if err := server.importBackupSettings(
			ctx,
			*payload.Document.SettingsAndProfiles,
			payload.FolderMappings,
		); err != nil {
			return result, err
		}
		profileIDs, err := server.importBackupProfiles(
			ctx,
			*payload.Document.SettingsAndProfiles,
			payload.FolderMappings,
			payload.ProfileActions,
			result.ConnectionIDs,
		)
		if err != nil {
			return result, err
		}
		result.ProfileIDs = profileIDs
	}
	if payload.Document.Labels != nil {
		if _, err := server.store.EnsureTorrentLabels(ctx, *payload.Document.Labels); err != nil {
			return result, fmt.Errorf("restore labels: %w", err)
		}
	}
	if payload.Document.Notifications != nil {
		mergeResult, err := server.importBackupNotifications(ctx, *payload.Document.Notifications)
		if err != nil {
			return result, err
		}
		addBackupMergeResult(&result.MergeResult, mergeResult)
	}
	if payload.Document.RemoteAccess != nil {
		mergeResult, err := server.importBackupRemoteAccess(
			ctx,
			payload.AdministratorID,
			*payload.Document.RemoteAccess,
		)
		if err != nil {
			return result, err
		}
		addBackupMergeResult(&result.MergeResult, mergeResult)
	}
	if err := server.publishTransmissionConfiguration(ctx); err != nil {
		return result, fmt.Errorf("publish imported Transmission configuration: %w", err)
	}

	return result, nil
}

func (server *Server) importBackupSettings(
	ctx context.Context,
	section backupSettingsAndProfilesSection,
	folderMappings map[string]string,
) error {
	snapshot, err := server.store.EffectiveConfiguration(ctx, server.registry)
	if err != nil {
		return err
	}
	currentByKey := make(map[string]storage.EffectiveSetting, len(snapshot.Settings))
	for _, setting := range snapshot.Settings {
		currentByKey[setting.Key] = setting
	}
	changes := storage.SettingChanges{}
	for _, importedSetting := range section.Settings {
		current, found := currentByKey[importedSetting.Key]
		if !found || current.Locked {
			continue
		}
		value := append(json.RawMessage(nil), importedSetting.Value...)
		if importedSetting.Key == "transmission.downloadDirectory" {
			value, _ = json.Marshal(mappedBackupFolder(
				folderMappings,
				section.DefaultProfile.DownloadDirectory,
			))
		} else if importedSetting.Key == "transmission.incompleteDirectory" {
			var sourcePath string
			if json.Unmarshal(importedSetting.Value, &sourcePath) == nil {
				value, _ = json.Marshal(mappedBackupFolder(folderMappings, sourcePath))
			}
		}
		if _, validationError := server.registry.Validate(importedSetting.Key, value); validationError != nil {
			continue
		}
		changes[importedSetting.Key] = value
	}
	server.transmissionSettingsMutex.Lock()
	defer server.transmissionSettingsMutex.Unlock()
	if _, err := server.store.UpdateSettings(
		ctx,
		server.registry,
		snapshot.Revision,
		changes,
		"backup-import",
	); err != nil {
		return fmt.Errorf("restore settings: %w", err)
	}
	server.rememberTransmissionRestartKeys(ctx, changes)
	updated, err := server.store.EffectiveConfiguration(ctx, server.registry)
	if err != nil {
		return err
	}
	compatibilityAllowed, err := rpcCompatibilitySetting(updated)
	if err != nil {
		return err
	}
	server.rpcCompatibilityAllowed.Store(compatibilityAllowed)
	debugLogging, err := debugLoggingSetting(updated)
	if err != nil {
		return err
	}
	server.applyDebugLogging(debugLogging)
	server.ensureConfiguredStorageDirectories(ctx, updated)

	return nil
}

func (server *Server) importBackupProfiles(
	ctx context.Context,
	section backupSettingsAndProfilesSection,
	folderMappings map[string]string,
	profileActions map[string]string,
	connectionIDs map[string]string,
) (map[string]string, error) {
	if _, err := server.store.UpdateDefaultTorrentProfile(ctx, storage.DefaultTorrentProfile{
		Name:        section.DefaultProfile.Name,
		Labels:      append([]string{}, section.DefaultProfile.Labels...),
		StartPaused: section.DefaultProfile.StartPaused,
		Options:     section.DefaultProfile.Options,
	}); err != nil {
		return nil, fmt.Errorf("restore Default profile: %w", err)
	}

	currentProfiles, err := server.store.ListTorrentProfiles(ctx)
	if err != nil {
		return nil, err
	}
	profileIDs := map[string]string{}
	for _, importedProfile := range section.Profiles {
		var existing *storage.TorrentProfile
		for index := range currentProfiles {
			if strings.EqualFold(currentProfiles[index].Name, importedProfile.Name) {
				existing = &currentProfiles[index]

				break
			}
		}
		if existing != nil && profileActions[importedProfile.ID] == "keep" {
			profileIDs[importedProfile.ID] = existing.ID

			continue
		}
		profile := importedProfile
		profile.DownloadDirectory = mappedBackupFolder(
			folderMappings,
			importedProfile.DownloadDirectory,
		)
		profile.ConnectionID = mappedBackupConnectionID(
			ctx,
			server.store,
			connectionIDs,
			importedProfile.ConnectionID,
		)
		if existing != nil {
			profile.ID = existing.ID
			if _, err := server.store.UpdateTorrentProfile(ctx, existing.ID, profile); err != nil {
				return nil, fmt.Errorf("replace profile %s: %w", importedProfile.Name, err)
			}
			profileIDs[importedProfile.ID] = existing.ID

			continue
		}
		if !validTorrentProfileID(profile.ID) {
			profile.ID = newTorrentProfileID()
		}
		if _, err := server.store.CreateTorrentProfile(ctx, profile); err != nil {
			if errors.Is(err, storage.ErrTorrentProfileNameTaken) {
				return nil, fmt.Errorf("profile %s changed while the import was prepared", importedProfile.Name)
			}
			profile.ID = newTorrentProfileID()
			if _, retryError := server.store.CreateTorrentProfile(ctx, profile); retryError != nil {
				return nil, fmt.Errorf("create profile %s: %w", importedProfile.Name, retryError)
			}
		}
		profileIDs[importedProfile.ID] = profile.ID
		currentProfiles = append(currentProfiles, profile)
	}

	return profileIDs, nil
}

func mappedBackupConnectionID(
	ctx context.Context,
	store *storage.Store,
	connectionIDs map[string]string,
	importedID *string,
) *string {
	if importedID == nil {
		return nil
	}
	if mappedID, found := connectionIDs[*importedID]; found && mappedID != "" {
		return &mappedID
	}
	if _, err := store.VPNConnectionByID(ctx, *importedID); err == nil {
		copyID := *importedID

		return &copyID
	}

	return nil
}

func (server *Server) importBackupNotifications(
	ctx context.Context,
	notifications []backupNotification,
) (storage.BackupMergeResult, error) {
	currentTargets, err := server.store.ListNotificationTargets(ctx)
	if err != nil {
		return storage.BackupMergeResult{}, err
	}
	usedIDs := make(map[string]string, len(currentTargets)+len(notifications))
	for _, target := range currentTargets {
		usedIDs[target.ID] = target.Name
	}
	targets := make([]storage.NotificationTarget, 0, len(notifications))
	for _, notification := range notifications {
		targetID := notification.ID
		replacedID := ""
		for _, target := range currentTargets {
			if strings.EqualFold(target.Name, notification.Name) {
				replacedID = target.ID

				break
			}
		}
		if _, found := usedIDs[targetID]; found && targetID != replacedID {
			for {
				targetID = newNotificationID()
				if _, exists := usedIDs[targetID]; !exists {
					break
				}
			}
		}
		usedIDs[targetID] = notification.Name
		nonce, ciphertext, fields, err := sealNotificationSecrets(
			server.installationKey,
			targetID,
			notification.Secrets,
		)
		clearStringMap(notification.Secrets)
		if err != nil {
			return storage.BackupMergeResult{}, fmt.Errorf("seal notification %s: %w", notification.Name, err)
		}
		targets = append(targets, storage.NotificationTarget{
			ID:                targetID,
			Name:              notification.Name,
			Service:           notification.Service,
			Events:            append([]string{}, notification.Events...),
			Settings:          cloneStringMap(notification.Settings),
			SecretFields:      fields,
			SecretsNonce:      nonce,
			SecretsCiphertext: ciphertext,
		})
	}
	result, err := server.store.MergeBackupNotifications(ctx, targets)
	if err != nil {
		return storage.BackupMergeResult{}, fmt.Errorf("restore notifications: %w", err)
	}

	return result, nil
}

func (server *Server) importBackupRemoteAccess(
	ctx context.Context,
	administratorID int64,
	section backupRemoteAccessSection,
) (storage.BackupMergeResult, error) {
	backup, err := backupRemoteAccessFromSection(section)
	if err != nil {
		return storage.BackupMergeResult{}, err
	}
	currentLogins, err := server.store.ListRPCLogins(ctx)
	if err != nil {
		return storage.BackupMergeResult{}, err
	}
	usedIDs := make(map[string]string, len(currentLogins)+len(backup.RPCLogins))
	for _, login := range currentLogins {
		usedIDs[login.ID] = login.Username
	}
	for index := range backup.RPCLogins {
		login := &backup.RPCLogins[index]
		replacedID := ""
		for _, currentLogin := range currentLogins {
			if strings.EqualFold(currentLogin.Username, login.Username) {
				replacedID = currentLogin.ID

				break
			}
		}
		if _, found := usedIDs[login.ID]; found && login.ID != replacedID {
			for {
				login.ID, err = newRPCLoginID()
				if err != nil {
					return storage.BackupMergeResult{}, err
				}
				if _, exists := usedIDs[login.ID]; !exists {
					break
				}
			}
		}
		usedIDs[login.ID] = login.Username
	}
	result, err := server.store.MergeBackupRemoteAccess(ctx, administratorID, backup)
	if err != nil {
		return storage.BackupMergeResult{}, fmt.Errorf("restore remote access: %w", err)
	}

	return result, nil
}

func (server *Server) importBackupVPNConnections(
	ctx context.Context,
	section backupVPNSection,
) ([]string, map[string]string, error) {
	warnings := []string{}
	profiles := make([]storage.EncryptedVPNProfile, 0, len(section.Profiles))
	validProfiles := map[string]struct{}{}
	for _, importedProfile := range section.Profiles {
		definition, found := provider.DefinitionByID(importedProfile.ProviderID)
		if !found {
			warnings = append(warnings, fmt.Sprintf(
				"VPN endpoint %s was skipped because provider %s is unavailable.",
				importedProfile.DisplayName,
				importedProfile.ProviderID,
			))

			continue
		}
		if _, found := definition.Tunnel(importedProfile.Tunnel); !found {
			warnings = append(warnings, fmt.Sprintf(
				"VPN endpoint %s was skipped because its tunnel is unavailable.",
				importedProfile.DisplayName,
			))

			continue
		}
		nonce, ciphertext, err := security.EncryptSecret(
			server.installationKey,
			"vpn/profile/"+importedProfile.ID,
			[]byte(importedProfile.Configuration),
		)
		if err != nil {
			return nil, nil, err
		}
		profiles = append(profiles, storage.EncryptedVPNProfile{
			ID:          importedProfile.ID,
			ProviderID:  importedProfile.ProviderID,
			Tunnel:      importedProfile.Tunnel,
			DisplayName: importedProfile.DisplayName,
			CountryCode: importedProfile.CountryCode,
			Country:     importedProfile.Country,
			City:        importedProfile.City,
			Continent:   importedProfile.Continent,
			Protocol:    importedProfile.Protocol,
			RemoteHost:  importedProfile.RemoteHost,
			RemotePort:  importedProfile.RemotePort,
			Fingerprint: importedProfile.Fingerprint,
			Source:      importedProfile.Source,
			Nonce:       nonce,
			Ciphertext:  ciphertext,
		})
		validProfiles[importedProfile.ID] = struct{}{}
	}
	if err := server.store.UpsertBackupVPNProfiles(ctx, profiles); err != nil {
		return nil, nil, err
	}

	existingConnections, err := server.store.ListVPNConnections(ctx)
	if err != nil {
		return nil, nil, err
	}
	connectionIDs := map[string]string{}
	connections := append([]backupVPNConnection{}, section.Connections...)
	sort.SliceStable(connections, func(left int, right int) bool {
		return connections[left].Slot < connections[right].Slot
	})
	for _, importedConnection := range connections {
		definition, found := provider.DefinitionByID(importedConnection.ProviderID)
		if !found {
			warnings = append(warnings, fmt.Sprintf(
				"VPN connection %s was not added because provider %s is unavailable.",
				importedConnection.Name,
				importedConnection.ProviderID,
			))

			continue
		}
		tunnel, found := definition.Tunnel(importedConnection.Tunnel)
		if !found || provider.ValidateCredentials(tunnel, importedConnection.Credentials) != nil {
			warnings = append(warnings, fmt.Sprintf(
				"VPN connection %s was not added because its provider sign-in is not valid here.",
				importedConnection.Name,
			))

			continue
		}
		endpointsValid := len(importedConnection.ProfileIDs) > 0
		for _, profileID := range importedConnection.ProfileIDs {
			if _, found := validProfiles[profileID]; !found {
				endpointsValid = false
			}
		}
		if !endpointsValid {
			warnings = append(warnings, fmt.Sprintf(
				"VPN connection %s was not added because one or more endpoints are unavailable.",
				importedConnection.Name,
			))

			continue
		}
		matchedExisting := false
		for _, existing := range existingConnections {
			if strings.EqualFold(existing.Name, importedConnection.Name) {
				connectionIDs[importedConnection.ID] = existing.ID
				warnings = append(warnings, fmt.Sprintf(
					"VPN connection %s already exists and was kept.",
					importedConnection.Name,
				))
				matchedExisting = true

				break
			}
		}
		if matchedExisting {
			continue
		}
		nonce, ciphertext, err := server.sealVPNConnectionCredentials(
			importedConnection.ID,
			importedConnection.Credentials,
		)
		clearStringMap(importedConnection.Credentials)
		if err != nil {
			return nil, nil, err
		}
		created, err := server.store.CreateVPNConnectionInSlot(ctx, storage.EncryptedVPNConnection{
			ID:                    importedConnection.ID,
			Name:                  importedConnection.Name,
			Enabled:               importedConnection.Enabled,
			ProviderID:            importedConnection.ProviderID,
			Tunnel:                importedConnection.Tunnel,
			ProfileIDs:            append([]string{}, importedConnection.ProfileIDs...),
			EndpointStrategy:      importedConnection.EndpointStrategy,
			CredentialsNonce:      nonce,
			CredentialsCiphertext: ciphertext,
			DNSServers:            append([]string{}, importedConnection.DNSServers...),
			RetryIntervalSeconds:  importedConnection.RetryIntervalSeconds,
			PeerPort:              importedConnection.PeerPort,
		}, importedConnection.Slot)
		if err != nil {
			warnings = append(warnings, fmt.Sprintf(
				"VPN connection %s was not added because slot %d is unavailable.",
				importedConnection.Name,
				importedConnection.Slot,
			))

			continue
		}
		connectionIDs[importedConnection.ID] = created.ID
		existingConnections = append(existingConnections, created)
	}

	return warnings, connectionIDs, nil
}

func (server *Server) importBackupTorrent(
	ctx context.Context,
	jobID string,
	position int,
	torrent backupTorrent,
	folderMappings map[string]string,
	configuration backupImportConfigurationResult,
	priorState string,
) {
	folder := mappedBackupFolder(folderMappings, torrent.DownloadDirectory)
	daemon, profileID, err := server.backupTorrentTarget(ctx, torrent, configuration)
	if err != nil {
		server.updateBackupImportItem(ctx, jobID, position, "failed", 1, err.Error())

		return
	}
	if priorState != "rechecking" {
		locations, _ := server.refreshTorrentHashIndex(ctx)
		if _, duplicate := locations[strings.ToLower(torrent.Hash)]; duplicate {
			server.updateBackupImportItem(ctx, jobID, position, "already-added", 1, "")

			return
		}
		policy, err := server.effectiveDownloadPathPolicy(ctx)
		if err != nil {
			server.updateBackupImportItem(ctx, jobID, position, "failed", 1, "The download folder could not be checked.")

			return
		}
		normalizedFolder, err := policy.normalizeDownloadDirectory(folder)
		if err != nil {
			server.updateBackupImportItem(ctx, jobID, position, "failed", 1, "The selected download folder is not allowed.")

			return
		}
		server.torrentAddMutex.Lock()
		var addResult torrentAddRPCResult
		err = daemon.Client.Call(ctx, "torrent-add", map[string]any{
			"download-dir": normalizedFolder,
			"labels":       append([]string{}, torrent.Labels...),
			"metainfo":     torrent.Metainfo,
			"paused":       true,
		}, &addResult)
		server.torrentAddMutex.Unlock()
		if err != nil {
			server.updateBackupImportItem(ctx, jobID, position, "failed", 1, "Transmission could not add this torrent.")

			return
		}
		if addResult.Duplicate != nil {
			server.updateBackupImportItem(ctx, jobID, position, "already-added", 1, "")

			return
		}
		if addResult.Added == nil || !strings.EqualFold(addResult.Added.HashString, torrent.Hash) {
			server.updateBackupImportItem(ctx, jobID, position, "failed", 1, "Transmission returned a different torrent.")

			return
		}
		if err := daemon.Client.Call(ctx, "torrent-set", backupTorrentSetArguments(torrent), nil); err != nil {
			server.updateBackupImportItem(ctx, jobID, position, "failed", 1, "Transmission could not restore this torrent's limits.")

			return
		}
		if _, err := server.store.EnsureTorrentLabels(ctx, torrent.Labels); err != nil {
			server.updateBackupImportItem(ctx, jobID, position, "failed", 1, "The torrent labels could not be saved.")

			return
		}
		if err := server.store.ReplaceTorrentProfileAssignments(
			ctx,
			[]string{torrent.Hash},
			profileID,
		); err != nil {
			server.updateBackupImportItem(ctx, jobID, position, "failed", 1, "The torrent profile could not be saved.")

			return
		}
		_ = server.refreshTorrentProfileAssignments(ctx)
		facadeID, _ := transmissionrpc.FacadeID(daemon.Slot, addResult.Added.ID)
		server.rememberTorrentLocation(torrent.Hash, torrentLocation{
			ConnectionID: daemon.ConnectionID,
			FacadeID:     facadeID,
			Name:         torrent.Name,
		})
	}

	// Transmission reports absent files as 0% without an error, which would start a full
	// download. A torrent whose top-level file or folder is absent stays paused instead.
	if !server.backupTorrentDataPresent(ctx, torrent, folder) {
		server.updateBackupImportItem(ctx, jobID, position, "data-missing", 1, folder)

		return
	}
	server.updateBackupImportItem(ctx, jobID, position, "rechecking", 0, "")
	if err := daemon.Client.Call(ctx, "torrent-verify", map[string]any{
		"ids": []string{torrent.Hash},
	}, nil); err != nil {
		server.updateBackupImportItem(ctx, jobID, position, "failed", 1, "Transmission could not start the data check.")

		return
	}
	verification, err := server.waitForBackupTorrentVerification(
		ctx,
		jobID,
		position,
		daemon,
		torrent.Hash,
	)
	if err != nil {
		if errors.Is(err, context.Canceled) {
			return
		}
		server.updateBackupImportItem(ctx, jobID, position, "failed", 1, "Transmission could not finish the data check.")

		return
	}
	if verification.Error != 0 && backupTorrentDataMissing(verification.ErrorString) {
		server.updateBackupImportItem(ctx, jobID, position, "data-missing", 1, folder)

		return
	}
	if torrent.Paused {
		if err := daemon.Client.Call(ctx, "torrent-stop", map[string]any{
			"ids": []string{torrent.Hash},
		}, nil); err != nil {
			server.updateBackupImportItem(ctx, jobID, position, "failed", 1, "The torrent could not be paused after checking.")

			return
		}
		server.updateBackupImportItem(ctx, jobID, position, "paused", 1, "")

		return
	}
	if err := daemon.Client.Call(ctx, "torrent-start", map[string]any{
		"ids": []string{torrent.Hash},
	}, nil); err != nil {
		server.updateBackupImportItem(ctx, jobID, position, "failed", 1, "The torrent could not be started after checking.")

		return
	}
	state := "downloading"
	if verification.PercentDone >= 1 || torrent.PercentDone >= 1 {
		state = "seeding"
	}
	server.updateBackupImportItem(ctx, jobID, position, state, 1, "")
}

func (server *Server) backupTorrentTarget(
	ctx context.Context,
	torrent backupTorrent,
	configuration backupImportConfigurationResult,
) (transmissionrpc.Daemon, *string, error) {
	var profileID *string
	if torrent.ProfileID != nil {
		mappedID := configuration.ProfileIDs[*torrent.ProfileID]
		if mappedID == "" {
			profiles, err := server.store.ListTorrentProfiles(ctx)
			if err != nil {
				return transmissionrpc.Daemon{}, nil, err
			}
			for _, profile := range profiles {
				if strings.EqualFold(profile.Name, torrent.ProfileName) {
					mappedID = profile.ID

					break
				}
			}
		}
		if mappedID == "" {
			return transmissionrpc.Daemon{}, nil, errors.New("The selected profile is unavailable.")
		}
		profileID = &mappedID
		profile, err := server.store.FindTorrentProfile(ctx, mappedID)
		if err != nil {
			return transmissionrpc.Daemon{}, nil, err
		}
		if profile.ConnectionID != nil {
			if daemon, found := server.transmissionDaemonForConnection(ctx, *profile.ConnectionID); found {
				return daemon, profileID, nil
			}
		}
	}
	daemon, err := server.defaultTransmissionDaemon(ctx)

	return daemon, profileID, err
}

func backupTorrentSetArguments(torrent backupTorrent) map[string]any {
	arguments := map[string]any{
		"bandwidthPriority":   torrent.Limits.BandwidthPriority,
		"downloadLimit":       torrent.Limits.DownloadLimit,
		"downloadLimited":     torrent.Limits.DownloadLimited,
		"honorsSessionLimits": torrent.Limits.HonorsSessionLimits,
		"ids":                 []string{torrent.Hash},
		"peer-limit":          torrent.Limits.PeerLimit,
		"seedIdleLimit":       torrent.Limits.SeedIdleLimit,
		"seedIdleMode":        torrent.Limits.SeedIdleMode,
		"seedRatioLimit":      torrent.Limits.SeedRatioLimit,
		"seedRatioMode":       torrent.Limits.SeedRatioMode,
		"uploadLimit":         torrent.Limits.UploadLimit,
		"uploadLimited":       torrent.Limits.UploadLimited,
	}
	if torrent.AddedDate > 0 {
		arguments["addedDate"] = torrent.AddedDate
	}

	return arguments
}

func (server *Server) waitForBackupTorrentVerification(
	ctx context.Context,
	jobID string,
	position int,
	daemon transmissionrpc.Daemon,
	hash string,
) (backupImportVerificationTorrent, error) {
	for {
		var response struct {
			Torrents []backupImportVerificationTorrent `json:"torrents"`
		}
		if err := daemon.Client.Call(ctx, "torrent-get", map[string]any{
			"fields": []string{
				"error",
				"errorString",
				"hashString",
				"percentDone",
				"recheckProgress",
				"status",
			},
			"ids": []string{hash},
		}, &response); err != nil {
			return backupImportVerificationTorrent{}, err
		}
		if len(response.Torrents) != 1 || !strings.EqualFold(response.Torrents[0].HashString, hash) {
			return backupImportVerificationTorrent{}, errors.New("torrent disappeared during verification")
		}
		torrent := response.Torrents[0]
		progress := torrent.RecheckProgress
		if progress < 0 {
			progress = 0
		}
		if progress > 1 {
			progress = 1
		}
		server.updateBackupImportItem(ctx, jobID, position, "rechecking", progress, "")
		if torrent.Status != 1 && torrent.Status != 2 {
			return torrent, nil
		}
		timer := time.NewTimer(server.backupImportPollInterval)
		select {
		case <-ctx.Done():
			timer.Stop()

			return backupImportVerificationTorrent{}, ctx.Err()
		case <-timer.C:
		}
	}
}

func (server *Server) updateBackupImportItem(
	ctx context.Context,
	jobID string,
	position int,
	state string,
	progress float64,
	detail string,
) {
	if err := server.store.UpdateBackupImportItem(
		ctx,
		jobID,
		position,
		state,
		progress,
		detail,
	); err != nil && !errors.Is(err, context.Canceled) {
		server.logInternalError("update backup import progress", err)
	}
}

// backupTorrentDataPresent reports whether the torrent's top-level file or folder exists.
//
// The mapped download folder is checked first, then the incomplete folder when it is on.
// Undecodable metainfo is left to Transmission's own check.
func (server *Server) backupTorrentDataPresent(ctx context.Context, torrent backupTorrent, folder string) bool {
	metainfo, err := base64.StdEncoding.DecodeString(torrent.Metainfo)
	if err != nil {
		return true
	}
	_, topLevelName, _, err := anotherTransmissionMetainfoDetails(metainfo)
	if err != nil {
		return true
	}
	folders := []string{folder}
	if policy, policyError := server.effectiveDownloadPathPolicy(ctx); policyError == nil &&
		policy.incompleteEnabled && policy.incompleteDirectory != "" {
		folders = append(folders, policy.incompleteDirectory)
	}
	for _, candidate := range folders {
		if candidate == "" {
			continue
		}
		if safeTopLevelEntryExists(candidate, topLevelName) || safeTopLevelEntryExists(candidate, topLevelName+".part") {
			return true
		}
	}

	return false
}

func backupTorrentDataMissing(message string) bool {
	lowerMessage := strings.ToLower(message)
	return strings.Contains(lowerMessage, "missing") ||
		strings.Contains(lowerMessage, "no such file") ||
		strings.Contains(lowerMessage, "not found")
}

func backupImportItemTerminal(state string) bool {
	switch state {
	case "seeding", "downloading", "paused", "data-missing", "already-added", "failed":
		return true
	default:
		return false
	}
}
