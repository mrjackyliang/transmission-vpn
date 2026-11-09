package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

const dataRootDownloadSelectionMessage = "Open or create a folder inside /data. Torrents can't be saved in /data itself."

// downloadPathPolicy holds the effective application-owned storage folders.
//
// Request handlers resolve this policy once, then use it for destination validation,
// Default profile fallbacks, and folder-browser selection guidance.
type downloadPathPolicy struct {
	downloadDirectory   string
	incompleteDirectory string
	incompleteEnabled   bool
}

// effectiveDownloadPathPolicy resolves both folders through managed precedence.
//
// Stored relationships remain readable; strict relationship checks are applied only
// when a request tries to use or change one of the paths.
func (server *Server) effectiveDownloadPathPolicy(
	ctx context.Context,
) (downloadPathPolicy, error) {
	snapshot, err := server.store.EffectiveConfiguration(ctx, server.registry)
	if err != nil {
		return downloadPathPolicy{}, fmt.Errorf("read effective download paths: %w", err)
	}

	downloadDirectory, err := configurationStringSetting(
		snapshot,
		"transmission.downloadDirectory",
	)
	if err != nil {
		return downloadPathPolicy{}, err
	}
	incompleteDirectory, err := configurationStringSetting(
		snapshot,
		"transmission.incompleteDirectory",
	)
	if err != nil {
		return downloadPathPolicy{}, err
	}
	incompleteEnabled, err := configurationBooleanSetting(
		snapshot,
		"transmission.incompleteDirectoryEnabled",
	)
	if err != nil {
		return downloadPathPolicy{}, err
	}

	return downloadPathPolicy{
		downloadDirectory:   downloadDirectory,
		incompleteDirectory: incompleteDirectory,
		incompleteEnabled:   incompleteEnabled,
	}, nil
}

// configurationStringSetting reads one required string from an effective snapshot.
//
// A missing or wrongly typed registry value is an internal contract failure rather
// than an invalid request, so callers keep it out of field-level error responses.
func configurationStringSetting(
	snapshot storage.ConfigurationSnapshot,
	key string,
) (string, error) {
	for _, effectiveSetting := range snapshot.Settings {
		if effectiveSetting.Key != key {
			continue
		}

		var value string
		if err := json.Unmarshal(effectiveSetting.Value, &value); err != nil {
			return "", fmt.Errorf("decode effective setting %s: %w", key, err)
		}

		return value, nil
	}

	return "", fmt.Errorf("effective setting %s is missing", key)
}

// normalizeDownloadDirectory validates one torrent destination against the policy.
//
// Trailing slashes are canonicalized before the mount-root and incomplete-folder
// checks so every downstream RPC receives a stable path.
func (policy downloadPathPolicy) normalizeDownloadDirectory(value string) (string, error) {
	normalizedValue, err := settings.NormalizeDataPath(value)
	if err != nil {
		return "", errors.New("must be a normalized absolute path beneath /data")
	}
	if err := settings.ValidateDownloadDataPathOutsideIncomplete(
		normalizedValue,
		policy.incompleteDirectory,
	); err != nil {
		return "", err
	}

	return normalizedValue, nil
}

// downloadPathsForIncomplete returns every durable completed-download destination.
//
// The effective Download directory is first, followed by alphabetical profiles and
// saved locations, matching the first-clash rule used by Settings and compatible RPC.
func (server *Server) downloadPathsForIncomplete(
	ctx context.Context,
	downloadDirectory string,
) ([]settings.IncompleteDirectoryDestination, error) {
	defaultProfile, err := server.store.DefaultTorrentProfile(ctx)
	if err != nil {
		return nil, fmt.Errorf("read Default torrent profile for incomplete folder: %w", err)
	}
	profiles, err := server.store.ListTorrentProfiles(ctx)
	if err != nil {
		return nil, fmt.Errorf("list torrent profiles for incomplete folder: %w", err)
	}
	downloadPaths := make([]settings.IncompleteDirectoryDestination, 0, 1+len(profiles))
	downloadPaths = append(downloadPaths, settings.IncompleteDirectoryDestination{
		Path:        downloadDirectory,
		ProfileName: defaultProfile.Name,
	})
	for _, profile := range profiles {
		downloadPaths = append(downloadPaths, settings.IncompleteDirectoryDestination{
			Path:        profile.DownloadDirectory,
			ProfileName: profile.Name + " profile",
		})
	}

	return downloadPaths, nil
}

// normalizeIncompleteDirectory validates a candidate against all download destinations.
//
// An incomplete folder may be nested inside a download folder, but it cannot equal
// or contain the Download setting or a profile folder.
func (server *Server) normalizeIncompleteDirectory(
	ctx context.Context,
	value string,
	downloadDirectory string,
) (string, error) {
	normalizedValue, err := settings.NormalizeDataPath(value)
	if err != nil {
		return "", errors.New("must be a normalized absolute path beneath /data")
	}
	downloadPaths, err := server.downloadPathsForIncomplete(ctx, downloadDirectory)
	if err != nil {
		return "", err
	}
	if err := settings.ValidateIncompleteDataPath(normalizedValue, downloadPaths); err != nil {
		return "", err
	}

	return normalizedValue, nil
}

// downloadSelection describes whether the browser's current folder is selectable.
//
// Navigation and creation remain available for reserved folders; only the final
// download-destination action uses these fields.
func (policy downloadPathPolicy) downloadSelection(path string) (bool, string) {
	if path == "/data" {
		return false, dataRootDownloadSelectionMessage
	}
	if settings.DataPathContains(policy.incompleteDirectory, path) {
		return false, fmt.Sprintf(
			"This is in the incomplete folder, %s, which only holds unfinished downloads. Pick a folder outside it.",
			policy.incompleteDirectory,
		)
	}

	return true, ""
}

// validateRPCFacadeDownloadPaths applies effective storage policy before daemon calls.
//
// Torrent adds use their shared profile-aware preparation; session and torrent
// mutations reach this method after compatible key and slash normalization.
func (server *Server) validateRPCFacadeDownloadPaths(
	ctx context.Context,
	method string,
	arguments map[string]any,
) string {
	if method != "session-set" && method != "torrent-set" && method != "torrent-set-location" {
		return "success"
	}

	policy, err := server.effectiveDownloadPathPolicy(ctx)
	if err != nil {
		server.logInternalError("read download paths for compatible RPC", err)

		return "Settings are unavailable"
	}

	switch method {
	case "session-set":
		downloadDirectory := policy.downloadDirectory
		if requestedDownloadDirectory, found := arguments["download-dir"]; found {
			downloadDirectory = requestedDownloadDirectory.(string)
		}
		if requestedIncompleteDirectory, found := arguments["incomplete-dir"]; found {
			_, validationError := server.normalizeIncompleteDirectory(
				ctx,
				requestedIncompleteDirectory.(string),
				downloadDirectory,
			)
			if validationError != nil {
				return validationError.Error()
			}

			return "success"
		}
		if _, found := arguments["download-dir"]; found {
			_, validationError := policy.normalizeDownloadDirectory(downloadDirectory)
			if validationError != nil {
				return validationError.Error()
			}
		}
	case "torrent-set", "torrent-set-location":
		requestedLocation, found := arguments["location"]
		if found {
			_, validationError := policy.normalizeDownloadDirectory(
				requestedLocation.(string),
			)
			if validationError != nil {
				return validationError.Error()
			}
		}
	}

	return "success"
}
