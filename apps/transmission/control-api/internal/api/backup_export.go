package api

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"sort"
	"strings"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
)

type backupExportSelection struct {
	SettingsAndProfiles bool `json:"settingsAndProfiles"`
	Labels              bool `json:"labels"`
	Notifications       bool `json:"notifications"`
	Torrents            bool `json:"torrents"`
	VPNConnections      bool `json:"vpnConnections"`
	RemoteAccess        bool `json:"remoteAccess"`
}

func (selection backupExportSelection) empty() bool {
	return !selection.SettingsAndProfiles && !selection.Labels && !selection.Notifications &&
		!selection.Torrents && !selection.VPNConnections && !selection.RemoteAccess
}

func (server *Server) handleBackupExport(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	var input struct {
		Grant    string                `json:"grant"`
		Sections backupExportSelection `json:"sections"`
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}
	if input.Sections.empty() {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "sections", "Choose at least one section.")

		return
	}
	if !server.consumeBackupGrant(responseWriter, request, input.Grant, "export") {
		return
	}

	document, err := server.buildBackupDocument(request.Context(), input.Sections)
	if err != nil {
		server.logInternalError("build backup export", err)
		writeError(responseWriter, http.StatusInternalServerError, "export_failed", "The export could not be created.")

		return
	}
	fileDate := server.backupClock().UTC().Format("2006-01-02")
	responseWriter.Header().Set(
		"Content-Disposition",
		fmt.Sprintf(`attachment; filename="transmission-vpn-export-%s.json"`, fileDate),
	)
	writeJSON(responseWriter, http.StatusOK, document)
}

func (server *Server) buildBackupDocument(
	ctx context.Context,
	selection backupExportSelection,
) (backupDocument, error) {
	document := backupDocument{
		Format:     backupFormatName,
		Version:    backupFormatVersion,
		ExportedAt: server.backupClock().UTC(),
		AppVersion: server.version,
	}
	if selection.SettingsAndProfiles {
		section, err := server.exportSettingsAndProfiles(ctx)
		if err != nil {
			return backupDocument{}, err
		}
		document.SettingsAndProfiles = &section
	}
	if selection.Labels {
		organization, err := server.store.TorrentOrganization(ctx)
		if err != nil {
			return backupDocument{}, fmt.Errorf("read labels: %w", err)
		}
		labels := append([]string{}, organization.Labels...)
		document.Labels = &labels
	}
	if selection.Notifications {
		notifications, err := server.exportNotifications(ctx)
		if err != nil {
			return backupDocument{}, err
		}
		document.Notifications = &notifications
	}
	if selection.Torrents {
		torrents, err := server.exportTorrents(ctx)
		if err != nil {
			return backupDocument{}, err
		}
		document.Torrents = &torrents
	}
	if selection.VPNConnections {
		section, err := server.exportVPNConnections(ctx)
		if err != nil {
			return backupDocument{}, err
		}
		document.VPNConnections = &section
	}
	if selection.RemoteAccess {
		section, err := server.exportRemoteAccess(ctx)
		if err != nil {
			return backupDocument{}, err
		}
		document.RemoteAccess = &section
	}

	return document, nil
}

func (server *Server) exportSettingsAndProfiles(
	ctx context.Context,
) (backupSettingsAndProfilesSection, error) {
	snapshot, err := server.store.EffectiveConfiguration(ctx, server.registry)
	if err != nil {
		return backupSettingsAndProfilesSection{}, fmt.Errorf("read settings: %w", err)
	}
	settingsValues := make([]backupSetting, 0, len(snapshot.Settings))
	for _, setting := range snapshot.Settings {
		settingsValues = append(settingsValues, backupSetting{
			Key:   setting.Key,
			Value: append(json.RawMessage(nil), setting.Value...),
		})
	}
	defaultProfile, err := server.defaultTorrentProfile(ctx)
	if err != nil {
		return backupSettingsAndProfilesSection{}, fmt.Errorf("read Default profile: %w", err)
	}
	profiles, err := server.store.ListTorrentProfiles(ctx)
	if err != nil {
		return backupSettingsAndProfilesSection{}, fmt.Errorf("read torrent profiles: %w", err)
	}

	return backupSettingsAndProfilesSection{
		Settings: settingsValues,
		DefaultProfile: backupDefaultProfile{
			Name:              defaultProfile.Name,
			DownloadDirectory: defaultProfile.DownloadDirectory,
			Labels:            append([]string{}, defaultProfile.Labels...),
			StartPaused:       defaultProfile.StartPaused,
			Options:           defaultProfile.Options,
		},
		Profiles: profiles,
	}, nil
}

func (server *Server) exportNotifications(ctx context.Context) ([]backupNotification, error) {
	targets, err := server.store.ListNotificationTargets(ctx)
	if err != nil {
		return nil, fmt.Errorf("read notifications: %w", err)
	}
	notifications := make([]backupNotification, 0, len(targets))
	for _, target := range targets {
		secrets, err := openNotificationSecrets(server.installationKey, target)
		if err != nil {
			return nil, err
		}
		notifications = append(notifications, backupNotification{
			ID:       target.ID,
			Name:     target.Name,
			Service:  target.Service,
			Events:   append([]string{}, target.Events...),
			Settings: cloneStringMap(target.Settings),
			Secrets:  cloneStringMap(secrets),
		})
		clearStringMap(secrets)
	}

	return notifications, nil
}

func (server *Server) exportTorrents(ctx context.Context) ([]backupTorrent, error) {
	if server.directoryBrowser == nil {
		return nil, errors.New("directory controller is unavailable")
	}
	result := server.mergedTorrents(ctx, torrentMoveFields, nil)
	if !result.Complete {
		return nil, errors.New("one or more Transmission daemons are unavailable")
	}
	profiles, err := server.store.ListTorrentProfiles(ctx)
	if err != nil {
		return nil, fmt.Errorf("read torrent profiles: %w", err)
	}
	defaultProfile, err := server.store.DefaultTorrentProfile(ctx)
	if err != nil {
		return nil, fmt.Errorf("read Default torrent profile: %w", err)
	}
	profileNames := map[string]string{}
	for _, profile := range profiles {
		profileNames[profile.ID] = profile.Name
	}
	torrents := make([]backupTorrent, 0, len(result.Torrents))
	for _, item := range result.Torrents {
		encodedSnapshot, err := json.Marshal(item)
		if err != nil {
			return nil, fmt.Errorf("encode torrent snapshot: %w", err)
		}
		var snapshot torrentMoveSnapshot
		if err := json.Unmarshal(encodedSnapshot, &snapshot); err != nil {
			return nil, fmt.Errorf("decode torrent snapshot: %w", err)
		}
		hash := strings.ToLower(snapshot.HashString)
		connectionID, _ := item["connectionId"].(string)
		if hash == "" || connectionID == "" || snapshot.MetadataPercentComplete < 1 {
			return nil, fmt.Errorf("torrent %q has no complete metainfo", snapshot.Name)
		}
		metainfo, err := server.directoryBrowser.ReadTorrent(
			ctx,
			filepath.Join("/config/transmission", connectionID, "torrents", hash+".torrent"),
		)
		if err != nil {
			return nil, fmt.Errorf("read metainfo for %s: %w", snapshot.Name, err)
		}
		profileName := defaultProfile.Name
		var profileID *string
		if assignedProfileID, found := server.torrentProfileAssignments.profileID(hash); found {
			assignedProfileIDCopy := assignedProfileID
			profileID = &assignedProfileIDCopy
			if name, exists := profileNames[assignedProfileID]; exists {
				profileName = name
			}
		}
		torrents = append(torrents, backupTorrent{
			Hash:              hash,
			Name:              snapshot.Name,
			Metainfo:          base64.StdEncoding.EncodeToString(metainfo),
			ProfileID:         profileID,
			ProfileName:       profileName,
			DownloadDirectory: snapshot.DownloadDirectory,
			ConnectionID:      connectionID,
			Labels:            append([]string{}, snapshot.Labels...),
			Paused:            snapshot.Status == 0,
			PercentDone:       snapshot.PercentDone,
			Limits: backupTorrentLimits{
				BandwidthPriority:   snapshot.BandwidthPriority,
				DownloadLimit:       snapshot.DownloadLimit,
				DownloadLimited:     snapshot.DownloadLimited,
				HonorsSessionLimits: snapshot.HonorsSessionLimits,
				PeerLimit:           snapshot.PeerLimit,
				SeedIdleLimit:       snapshot.SeedIdleLimit,
				SeedIdleMode:        snapshot.SeedIdleMode,
				SeedRatioLimit:      snapshot.SeedRatioLimit,
				SeedRatioMode:       snapshot.SeedRatioMode,
				UploadLimit:         snapshot.UploadLimit,
				UploadLimited:       snapshot.UploadLimited,
			},
		})
	}
	sort.Slice(torrents, func(left int, right int) bool {
		return strings.ToLower(torrents[left].Name) < strings.ToLower(torrents[right].Name)
	})

	return torrents, nil
}

func (server *Server) exportVPNConnections(ctx context.Context) (backupVPNSection, error) {
	connections, err := server.store.ListVPNConnections(ctx)
	if err != nil {
		return backupVPNSection{}, fmt.Errorf("read VPN connections: %w", err)
	}
	section := backupVPNSection{
		Profiles:    []backupVPNProfile{},
		Connections: make([]backupVPNConnection, 0, len(connections)),
	}
	profileIDs := map[string]struct{}{}
	for _, connection := range connections {
		credentials, err := server.decryptVPNConnectionCredentials(connection)
		if err != nil {
			return backupVPNSection{}, err
		}
		section.Connections = append(section.Connections, backupVPNConnection{
			ID:                   connection.ID,
			Slot:                 connection.Slot,
			Name:                 connection.Name,
			Default:              connection.IsDefault,
			Enabled:              connection.Enabled,
			ProviderID:           connection.ProviderID,
			Tunnel:               connection.Tunnel,
			ProfileIDs:           append([]string{}, connection.ProfileIDs...),
			EndpointStrategy:     connection.EndpointStrategy,
			Credentials:          cloneStringMap(credentials),
			DNSServers:           append([]string{}, connection.DNSServers...),
			RetryIntervalSeconds: connection.RetryIntervalSeconds,
			PeerPort:             connection.PeerPort,
		})
		clearStringMap(credentials)
		for _, profileID := range connection.ProfileIDs {
			profileIDs[profileID] = struct{}{}
		}
	}
	orderedProfileIDs := make([]string, 0, len(profileIDs))
	for profileID := range profileIDs {
		orderedProfileIDs = append(orderedProfileIDs, profileID)
	}
	sort.Strings(orderedProfileIDs)
	for _, profileID := range orderedProfileIDs {
		profile, err := server.store.FindVPNProfile(ctx, profileID)
		if err != nil {
			return backupVPNSection{}, fmt.Errorf("read VPN endpoint %s: %w", profileID, err)
		}
		configuration, err := security.DecryptSecret(
			server.installationKey,
			"vpn/profile/"+profile.ID,
			profile.Nonce,
			profile.Ciphertext,
		)
		if err != nil {
			return backupVPNSection{}, fmt.Errorf("decrypt VPN endpoint %s: %w", profileID, err)
		}
		section.Profiles = append(section.Profiles, backupVPNProfile{
			ID:            profile.ID,
			ProviderID:    profile.ProviderID,
			Tunnel:        profile.Tunnel,
			DisplayName:   profile.DisplayName,
			CountryCode:   profile.CountryCode,
			Country:       profile.Country,
			City:          profile.City,
			Continent:     profile.Continent,
			Protocol:      profile.Protocol,
			RemoteHost:    profile.RemoteHost,
			RemotePort:    profile.RemotePort,
			Fingerprint:   profile.Fingerprint,
			Source:        profile.Source,
			Configuration: string(configuration),
		})
		clear(configuration)
	}

	return section, nil
}

func (server *Server) exportRemoteAccess(
	ctx context.Context,
) (backupRemoteAccessSection, error) {
	logins, err := server.store.ListRPCLogins(ctx)
	if err != nil {
		return backupRemoteAccessSection{}, fmt.Errorf("read RPC logins: %w", err)
	}
	tokens, err := server.store.ListAPITokensForBackup(ctx)
	if err != nil {
		return backupRemoteAccessSection{}, err
	}
	section := backupRemoteAccessSection{
		RPCLogins: make([]backupRPCLogin, 0, len(logins)),
		APITokens: make([]backupAPIToken, 0, len(tokens)),
	}
	for _, login := range logins {
		section.RPCLogins = append(section.RPCLogins, backupRPCLogin{
			ID:           login.ID,
			Username:     login.Username,
			SecretDigest: base64.StdEncoding.EncodeToString(login.SecretDigest),
			CreatedAt:    login.CreatedAt,
			UpdatedAt:    login.UpdatedAt,
			LastUsedAt:   login.LastUsedAt,
		})
	}
	for _, token := range tokens {
		section.APITokens = append(section.APITokens, backupAPIToken{
			ID:          token.ID,
			Name:        token.Name,
			TokenDigest: base64.StdEncoding.EncodeToString(token.Digest),
			Scopes:      append([]string{}, token.Scopes...),
			ExpiresAt:   token.ExpiresAt,
			CreatedAt:   token.CreatedAt,
			LastUsedAt:  token.LastUsedAt,
		})
	}

	return section, nil
}

func cloneStringMap(source map[string]string) map[string]string {
	cloned := make(map[string]string, len(source))
	for key, value := range source {
		cloned[key] = value
	}

	return cloned
}

func clearStringMap(values map[string]string) {
	for key := range values {
		values[key] = ""
		delete(values, key)
	}
}
