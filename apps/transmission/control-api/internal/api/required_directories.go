package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/directorybrowser"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

// storageDirectories are the effective folders Transmission depends on.
type storageDirectories struct {
	download          string
	incomplete        string
	incompleteEnabled bool
}

// storageDirectorySettingsChanged reports whether one save can change required paths.
func storageDirectorySettingsChanged(changes storage.SettingChanges) bool {
	for _, key := range []string{
		"transmission.downloadDirectory",
		"transmission.incompleteDirectory",
		"transmission.incompleteDirectoryEnabled",
	} {
		if _, changed := changes[key]; changed {
			return true
		}
	}

	return false
}

// configuredStorageDirectories decodes the three settings that own daemon folders.
func configuredStorageDirectories(
	snapshot storage.ConfigurationSnapshot,
) (storageDirectories, error) {
	downloadDirectory, err := configurationStringSetting(
		snapshot,
		"transmission.downloadDirectory",
	)
	if err != nil {
		return storageDirectories{}, err
	}
	incompleteDirectory, err := configurationStringSetting(
		snapshot,
		"transmission.incompleteDirectory",
	)
	if err != nil {
		return storageDirectories{}, err
	}
	incompleteEnabled, err := configurationBooleanSetting(
		snapshot,
		"transmission.incompleteDirectoryEnabled",
	)
	if err != nil {
		return storageDirectories{}, err
	}

	return storageDirectories{
		download:          downloadDirectory,
		incomplete:        incompleteDirectory,
		incompleteEnabled: incompleteEnabled,
	}, nil
}

// configurationBooleanSetting reads one required boolean from an effective snapshot.
func configurationBooleanSetting(
	snapshot storage.ConfigurationSnapshot,
	key string,
) (bool, error) {
	for _, effectiveSetting := range snapshot.Settings {
		if effectiveSetting.Key != key {
			continue
		}

		var value bool
		if err := json.Unmarshal(effectiveSetting.Value, &value); err != nil {
			return false, fmt.Errorf("decode effective setting %s: %w", key, err)
		}

		return value, nil
	}

	return false, fmt.Errorf("effective setting %s is missing", key)
}

// ensureConfiguredStorageDirectories creates folders required by one effective snapshot.
func (server *Server) ensureConfiguredStorageDirectories(
	ctx context.Context,
	snapshot storage.ConfigurationSnapshot,
) {
	directories, err := configuredStorageDirectories(snapshot)
	if err != nil {
		server.logInternalError("read required storage directories", err)

		return
	}

	server.ensureRequiredDirectory(ctx, directories.download)
	if directories.incompleteEnabled {
		server.ensureRequiredDirectory(ctx, directories.incomplete)
	}
}

// ensureSavedTorrentProfileDirectories creates folders for profiles loaded at startup.
//
// Migration 014 can reset a profile folder before the API starts, so this pass runs
// after storage migrations and uses the final durable values.
func (server *Server) ensureSavedTorrentProfileDirectories(ctx context.Context) {
	profiles, err := server.store.ListTorrentProfiles(ctx)
	if err != nil {
		server.logInternalError("read required torrent profile directories", err)

		return
	}
	for _, profile := range profiles {
		server.ensureRequiredDirectory(ctx, profile.DownloadDirectory)
	}
}

// ensureRPCSessionDirectories overlays one successful session-set on effective settings.
func (server *Server) ensureRPCSessionDirectories(
	ctx context.Context,
	arguments map[string]any,
) {
	_, downloadChanged := arguments["download-dir"]
	_, incompleteChanged := arguments["incomplete-dir"]
	_, incompleteEnabledChanged := arguments["incomplete-dir-enabled"]
	if !downloadChanged && !incompleteChanged && !incompleteEnabledChanged {
		return
	}

	snapshot, err := server.store.EffectiveConfiguration(ctx, server.registry)
	if err != nil {
		server.logInternalError("read required storage directories after session-set", err)

		return
	}
	directories, err := configuredStorageDirectories(snapshot)
	if err != nil {
		server.logInternalError("decode required storage directories after session-set", err)

		return
	}
	if value, found := arguments["download-dir"].(string); found {
		directories.download = value
	}
	if value, found := arguments["incomplete-dir"].(string); found {
		directories.incomplete = value
	}
	if value, found := arguments["incomplete-dir-enabled"].(bool); found {
		directories.incompleteEnabled = value
	}

	server.ensureRequiredDirectory(ctx, directories.download)
	if directories.incompleteEnabled {
		server.ensureRequiredDirectory(ctx, directories.incomplete)
	}
}

// ensureRequiredDirectory creates one missing /data path through the controller.
//
// Each missing parent is created directly beneath its existing parent so the same
// PUID:PGID ownership, mode 0775, symlink rejection, and mount boundary used by the
// folder browser remain authoritative.
func (server *Server) ensureRequiredDirectory(ctx context.Context, path string) {
	if err := server.createRequiredDirectory(ctx, path); err != nil {
		server.logger.Warn(
			"required storage directory could not be created",
			"path",
			path,
			"error",
			err,
		)
	}
}

// createRequiredDirectory performs one best-effort folder walk beneath /data.
func (server *Server) createRequiredDirectory(ctx context.Context, path string) error {
	if err := settings.ValidateDownloadDataPath(path); err != nil {
		return err
	}
	if server.directoryBrowser == nil {
		return errors.New("the directory controller is unavailable")
	}

	currentPath := "/data"
	for _, name := range strings.Split(strings.TrimPrefix(path, "/data/"), "/") {
		nextPath := filepath.Join(currentPath, name)
		if _, err := server.directoryBrowser.List(ctx, nextPath); err == nil {
			currentPath = nextPath

			continue
		} else if directorybrowser.CodeOf(err) != directorybrowser.ErrorCodeNotFound {
			return fmt.Errorf("inspect %s: %w", nextPath, err)
		}

		if _, err := server.directoryBrowser.Create(ctx, currentPath, name); err != nil {
			if directorybrowser.CodeOf(err) != directorybrowser.ErrorCodeAlreadyExists {
				return fmt.Errorf("create %s: %w", nextPath, err)
			}
			if _, listError := server.directoryBrowser.List(ctx, nextPath); listError != nil {
				return fmt.Errorf("inspect concurrently created %s: %w", nextPath, listError)
			}
		}
		currentPath = nextPath
	}

	return nil
}
