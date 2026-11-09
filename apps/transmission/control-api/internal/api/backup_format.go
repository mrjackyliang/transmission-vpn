package api

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

const (
	backupFormatName       = "transmission-vpn-export"
	backupFormatVersion    = 1
	maximumBackupBodyBytes = 128 * 1024 * 1024
	maximumBackupTorrents  = 10000
)

// backupDocument is the strict transmission-vpn export schema, version 1.
//
// The six optional section keys correspond one-to-one with the export choices. A
// selected secret-bearing section contains plaintext secrets; digest-only credentials
// retain their base64-encoded digest so they can be restored without changing them.
type backupDocument struct {
	Format              string                            `json:"format"`
	Version             int                               `json:"version"`
	ExportedAt          time.Time                         `json:"exportedAt"`
	AppVersion          string                            `json:"appVersion"`
	SettingsAndProfiles *backupSettingsAndProfilesSection `json:"settingsAndProfiles,omitempty"`
	Labels              *[]string                         `json:"labels,omitempty"`
	Notifications       *[]backupNotification             `json:"notifications,omitempty"`
	Torrents            *[]backupTorrent                  `json:"torrents,omitempty"`
	VPNConnections      *backupVPNSection                 `json:"vpnConnections,omitempty"`
	RemoteAccess        *backupRemoteAccessSection        `json:"remoteAccess,omitempty"`
}

type backupSetting struct {
	Key   string          `json:"key"`
	Value json.RawMessage `json:"value"`
}

type backupSettingsAndProfilesSection struct {
	Settings       []backupSetting          `json:"settings"`
	DefaultProfile backupDefaultProfile     `json:"defaultProfile"`
	Profiles       []storage.TorrentProfile `json:"profiles"`
}

type backupDefaultProfile struct {
	Name              string                        `json:"name"`
	DownloadDirectory string                        `json:"downloadDirectory"`
	Labels            []string                      `json:"labels"`
	StartPaused       bool                          `json:"startPaused"`
	Options           storage.TorrentProfileOptions `json:"options"`
}

type backupNotification struct {
	ID       string            `json:"id"`
	Name     string            `json:"name"`
	Service  string            `json:"service"`
	Events   []string          `json:"events"`
	Settings map[string]string `json:"settings"`
	Secrets  map[string]string `json:"secrets"`
}

type backupTorrentLimits struct {
	BandwidthPriority   int64   `json:"bandwidthPriority"`
	DownloadLimit       int64   `json:"downloadLimit"`
	DownloadLimited     bool    `json:"downloadLimited"`
	HonorsSessionLimits bool    `json:"honorsSessionLimits"`
	PeerLimit           int64   `json:"peerLimit"`
	SeedIdleLimit       int64   `json:"seedIdleLimit"`
	SeedIdleMode        int64   `json:"seedIdleMode"`
	SeedRatioLimit      float64 `json:"seedRatioLimit"`
	SeedRatioMode       int64   `json:"seedRatioMode"`
	UploadLimit         int64   `json:"uploadLimit"`
	UploadLimited       bool    `json:"uploadLimited"`
}

type backupTorrent struct {
	Hash              string              `json:"hash"`
	Name              string              `json:"name"`
	Metainfo          string              `json:"metainfo"`
	ProfileID         *string             `json:"profileId"`
	ProfileName       string              `json:"profileName"`
	DownloadDirectory string              `json:"downloadDirectory"`
	ConnectionID      string              `json:"connectionId"`
	Labels            []string            `json:"labels"`
	Paused            bool                `json:"paused"`
	PercentDone       float64             `json:"percentDone"`
	AddedDate         int64               `json:"addedDate,omitempty"`
	Limits            backupTorrentLimits `json:"limits"`
}

type backupVPNProfile struct {
	ID            string `json:"id"`
	ProviderID    string `json:"providerId"`
	Tunnel        string `json:"tunnel"`
	DisplayName   string `json:"displayName"`
	CountryCode   string `json:"countryCode"`
	Country       string `json:"country"`
	City          string `json:"city"`
	Continent     string `json:"continent"`
	Protocol      string `json:"protocol"`
	RemoteHost    string `json:"remoteHost"`
	RemotePort    int    `json:"remotePort"`
	Fingerprint   string `json:"fingerprint"`
	Source        string `json:"source"`
	Configuration string `json:"configuration"`
}

type backupVPNConnection struct {
	ID                   string            `json:"id"`
	Slot                 int               `json:"slot"`
	Name                 string            `json:"name"`
	Default              bool              `json:"default"`
	Enabled              bool              `json:"enabled"`
	ProviderID           string            `json:"providerId"`
	Tunnel               string            `json:"tunnel"`
	ProfileIDs           []string          `json:"profileIds"`
	EndpointStrategy     string            `json:"endpointStrategy"`
	Credentials          map[string]string `json:"credentials"`
	DNSServers           []string          `json:"dnsServers"`
	RetryIntervalSeconds int               `json:"retryIntervalSeconds"`
	PeerPort             int               `json:"peerPort"`
}

type backupVPNSection struct {
	Profiles    []backupVPNProfile    `json:"profiles"`
	Connections []backupVPNConnection `json:"connections"`
}

type backupRPCLogin struct {
	ID           string     `json:"id"`
	Username     string     `json:"username"`
	SecretDigest string     `json:"secretDigest"`
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`
	LastUsedAt   *time.Time `json:"lastUsedAt"`
}

type backupAPIToken struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	TokenDigest string     `json:"tokenDigest"`
	Scopes      []string   `json:"scopes"`
	ExpiresAt   *time.Time `json:"expiresAt"`
	CreatedAt   time.Time  `json:"createdAt"`
	LastUsedAt  *time.Time `json:"lastUsedAt"`
}

type backupRemoteAccessSection struct {
	RPCLogins []backupRPCLogin `json:"rpcLogins"`
	APITokens []backupAPIToken `json:"apiTokens"`
}

func decodeBackupJSONBody(
	responseWriter http.ResponseWriter,
	request *http.Request,
	target any,
) error {
	request.Body = http.MaxBytesReader(responseWriter, request.Body, maximumBackupBodyBytes)
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	var trailingValue any
	if err := decoder.Decode(&trailingValue); !errors.Is(err, io.EOF) {
		if err == nil {
			return errors.New("request body contains multiple JSON values")
		}

		return err
	}

	return nil
}

func decodeBackupDocument(rawDocument json.RawMessage) (backupDocument, error) {
	if err := validateBackupRequiredFields(rawDocument); err != nil {
		return backupDocument{}, err
	}
	var document backupDocument
	decoder := json.NewDecoder(bytes.NewReader(rawDocument))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&document); err != nil {
		return backupDocument{}, fmt.Errorf("decode export: %w", err)
	}
	var trailingValue any
	if err := decoder.Decode(&trailingValue); !errors.Is(err, io.EOF) {
		return backupDocument{}, errors.New("export contains more than one JSON value")
	}
	if err := validateBackupDocument(document); err != nil {
		return backupDocument{}, err
	}

	return document, nil
}

func validateBackupDocument(document backupDocument) error {
	if document.Format != backupFormatName {
		return fmt.Errorf("format must be %q", backupFormatName)
	}
	if document.Version != backupFormatVersion {
		return fmt.Errorf("version must be %d", backupFormatVersion)
	}
	if document.ExportedAt.IsZero() {
		return errors.New("exportedAt is required")
	}
	if strings.TrimSpace(document.AppVersion) == "" || utf8.RuneCountInString(document.AppVersion) > 128 {
		return errors.New("appVersion is invalid")
	}
	if document.SettingsAndProfiles == nil && document.Labels == nil &&
		document.Notifications == nil && document.Torrents == nil &&
		document.VPNConnections == nil && document.RemoteAccess == nil {
		return errors.New("export has no sections")
	}

	if document.SettingsAndProfiles != nil {
		if err := validateBackupProfiles(*document.SettingsAndProfiles); err != nil {
			return err
		}
	}
	if document.Labels != nil {
		if len(*document.Labels) > storage.MaximumTorrentLabels {
			return errors.New("labels contains too many values")
		}
		if err := validateLabels(*document.Labels); err != nil {
			return fmt.Errorf("labels: %w", err)
		}
	}
	if document.Notifications != nil {
		if len(*document.Notifications) > 256 {
			return errors.New("notifications contains too many values")
		}
		for index, notification := range *document.Notifications {
			if strings.TrimSpace(notification.ID) == "" || strings.TrimSpace(notification.Name) == "" ||
				strings.TrimSpace(notification.Service) == "" || notification.Events == nil ||
				notification.Settings == nil || notification.Secrets == nil {
				return fmt.Errorf("notifications[%d] is incomplete", index)
			}
		}
	}
	if document.Torrents != nil {
		if len(*document.Torrents) > maximumBackupTorrents {
			return errors.New("torrents contains too many values")
		}
		seenHashes := map[string]struct{}{}
		for index, torrent := range *document.Torrents {
			normalized, err := normalizeTorrentHashes([]string{torrent.Hash})
			if err != nil {
				return fmt.Errorf("torrents[%d].hash is invalid", index)
			}
			if _, found := seenHashes[normalized[0]]; found {
				return fmt.Errorf("torrents[%d].hash is duplicated", index)
			}
			seenHashes[normalized[0]] = struct{}{}
			metainfo, err := base64.StdEncoding.DecodeString(torrent.Metainfo)
			if err != nil || len(metainfo) == 0 {
				return fmt.Errorf("torrents[%d].metainfo is invalid", index)
			}
			metainfoHash, known, err := torrentSourceHash("", metainfo)
			if err != nil || !known || !strings.EqualFold(metainfoHash, torrent.Hash) {
				return fmt.Errorf("torrents[%d].metainfo does not match its hash", index)
			}
			if strings.TrimSpace(torrent.Name) == "" || strings.TrimSpace(torrent.ProfileName) == "" ||
				strings.TrimSpace(torrent.ConnectionID) == "" {
				return fmt.Errorf("torrents[%d] is incomplete", index)
			}
			if _, err := settings.NormalizeDataPath(torrent.DownloadDirectory); err != nil {
				return fmt.Errorf("torrents[%d].downloadDirectory is invalid", index)
			}
			if torrent.PercentDone < 0 || torrent.PercentDone > 1 {
				return fmt.Errorf("torrents[%d].percentDone is invalid", index)
			}
			if err := validateLabels(torrent.Labels); err != nil {
				return fmt.Errorf("torrents[%d].labels: %w", index, err)
			}
		}
	}
	if document.VPNConnections != nil {
		if err := validateBackupVPN(*document.VPNConnections); err != nil {
			return err
		}
	}
	if document.RemoteAccess != nil {
		if err := validateBackupRemoteAccess(*document.RemoteAccess); err != nil {
			return err
		}
	}

	return nil
}

func validateBackupProfiles(section backupSettingsAndProfilesSection) error {
	if section.Settings == nil || section.Profiles == nil {
		return errors.New("settingsAndProfiles is incomplete")
	}
	if len(section.Profiles) > 100 {
		return errors.New("settingsAndProfiles.profiles contains too many values")
	}
	if strings.TrimSpace(section.DefaultProfile.Name) == "" {
		return errors.New("settingsAndProfiles.defaultProfile.name is required")
	}
	if _, err := settings.NormalizeDataPath(section.DefaultProfile.DownloadDirectory); err != nil {
		return errors.New("settingsAndProfiles.defaultProfile.downloadDirectory is invalid")
	}
	if err := validateLabels(section.DefaultProfile.Labels); err != nil {
		return fmt.Errorf("settingsAndProfiles.defaultProfile.labels: %w", err)
	}
	seenSettings := map[string]struct{}{}
	for index, setting := range section.Settings {
		if strings.TrimSpace(setting.Key) == "" || len(setting.Value) == 0 || !json.Valid(setting.Value) {
			return fmt.Errorf("settingsAndProfiles.settings[%d] is invalid", index)
		}
		if _, found := seenSettings[setting.Key]; found {
			return fmt.Errorf("settingsAndProfiles.settings[%d].key is duplicated", index)
		}
		seenSettings[setting.Key] = struct{}{}
	}
	seenProfileIDs := map[string]struct{}{}
	seenProfileNames := []string{strings.ToLower(section.DefaultProfile.Name)}
	for index, profile := range section.Profiles {
		if strings.TrimSpace(profile.ID) == "" || strings.TrimSpace(profile.Name) == "" {
			return fmt.Errorf("settingsAndProfiles.profiles[%d] is incomplete", index)
		}
		if _, found := seenProfileIDs[profile.ID]; found {
			return fmt.Errorf("settingsAndProfiles.profiles[%d].id is duplicated", index)
		}
		seenProfileIDs[profile.ID] = struct{}{}
		lowerName := strings.ToLower(profile.Name)
		if slices.Contains(seenProfileNames, lowerName) {
			return fmt.Errorf("settingsAndProfiles.profiles[%d].name is duplicated", index)
		}
		seenProfileNames = append(seenProfileNames, lowerName)
		if _, err := settings.NormalizeDataPath(profile.DownloadDirectory); err != nil {
			return fmt.Errorf("settingsAndProfiles.profiles[%d].downloadDirectory is invalid", index)
		}
		if err := validateLabels(profile.Labels); err != nil {
			return fmt.Errorf("settingsAndProfiles.profiles[%d].labels: %w", index, err)
		}
	}

	return nil
}

func validateBackupVPN(section backupVPNSection) error {
	if section.Profiles == nil || section.Connections == nil || len(section.Connections) > 64 {
		return errors.New("vpnConnections is invalid")
	}
	profileIDs := map[string]backupVPNProfile{}
	for index, profile := range section.Profiles {
		if strings.TrimSpace(profile.ID) == "" || strings.TrimSpace(profile.ProviderID) == "" ||
			(profile.Tunnel != "openvpn" && profile.Tunnel != "wireguard") ||
			profile.RemotePort < 1 || profile.RemotePort > 65535 || profile.Configuration == "" {
			return fmt.Errorf("vpnConnections.profiles[%d] is invalid", index)
		}
		if _, found := profileIDs[profile.ID]; found {
			return fmt.Errorf("vpnConnections.profiles[%d].id is duplicated", index)
		}
		profileIDs[profile.ID] = profile
	}
	seenSlots := map[int]struct{}{}
	for index, connection := range section.Connections {
		if strings.TrimSpace(connection.ID) == "" || strings.TrimSpace(connection.Name) == "" ||
			strings.TrimSpace(connection.ProviderID) == "" || connection.Slot < 0 || connection.Slot > 63 ||
			(connection.Tunnel != "openvpn" && connection.Tunnel != "wireguard") ||
			connection.Credentials == nil || connection.DNSServers == nil || connection.ProfileIDs == nil ||
			connection.RetryIntervalSeconds < 3 || connection.RetryIntervalSeconds > 600 ||
			connection.PeerPort < 1024 || connection.PeerPort > 65535 {
			return fmt.Errorf("vpnConnections.connections[%d] is invalid", index)
		}
		if _, found := seenSlots[connection.Slot]; found {
			return fmt.Errorf("vpnConnections.connections[%d].slot is duplicated", index)
		}
		seenSlots[connection.Slot] = struct{}{}
		if connection.EndpointStrategy != "sticky" && connection.EndpointStrategy != "ordered" &&
			connection.EndpointStrategy != "randomized" {
			return fmt.Errorf("vpnConnections.connections[%d].endpointStrategy is invalid", index)
		}
		for _, profileID := range connection.ProfileIDs {
			profile, found := profileIDs[profileID]
			if !found || profile.ProviderID != connection.ProviderID || profile.Tunnel != connection.Tunnel {
				return fmt.Errorf("vpnConnections.connections[%d].profileIds is invalid", index)
			}
		}
	}

	return nil
}

func validateBackupRemoteAccess(section backupRemoteAccessSection) error {
	if section.RPCLogins == nil || section.APITokens == nil {
		return errors.New("remoteAccess is incomplete")
	}
	for index, login := range section.RPCLogins {
		if strings.TrimSpace(login.ID) == "" || strings.TrimSpace(login.Username) == "" ||
			login.CreatedAt.IsZero() || login.UpdatedAt.IsZero() {
			return fmt.Errorf("remoteAccess.rpcLogins[%d] is incomplete", index)
		}
		if _, err := base64.StdEncoding.DecodeString(login.SecretDigest); err != nil {
			return fmt.Errorf("remoteAccess.rpcLogins[%d].secretDigest is invalid", index)
		}
	}
	for index, token := range section.APITokens {
		if strings.TrimSpace(token.ID) == "" || strings.TrimSpace(token.Name) == "" ||
			token.Scopes == nil || token.CreatedAt.IsZero() {
			return fmt.Errorf("remoteAccess.apiTokens[%d] is incomplete", index)
		}
		if _, err := base64.StdEncoding.DecodeString(token.TokenDigest); err != nil {
			return fmt.Errorf("remoteAccess.apiTokens[%d].tokenDigest is invalid", index)
		}
	}

	return nil
}
