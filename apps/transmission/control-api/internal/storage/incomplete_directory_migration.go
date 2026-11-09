package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
)

// cleanupIncompleteDownloadTargets repairs destinations reserved by migration 014.
//
// The migration resolves the effective incomplete folder from stored precedence,
// rewrites reusable targets only, and never moves existing torrent data.
func cleanupIncompleteDownloadTargets(ctx context.Context, transaction *sql.Tx) error {
	registry := settings.NewRegistry()
	incompleteDirectory, err := effectiveStringSettingFrom(
		ctx,
		transaction,
		registry,
		"transmission.incompleteDirectory",
	)
	if err != nil {
		return err
	}
	downloadDirectory, err := effectiveStringSettingFrom(
		ctx,
		transaction,
		registry,
		"transmission.downloadDirectory",
	)
	if err != nil {
		return err
	}

	downloadDefinition, found := registry.Definition("transmission.downloadDirectory")
	if !found {
		return errors.New("download directory setting is not registered")
	}
	var defaultDownloadDirectory string
	if err := json.Unmarshal(
		downloadDefinition.DefaultValue,
		&defaultDownloadDirectory,
	); err != nil {
		return fmt.Errorf("decode default download directory: %w", err)
	}

	if settings.DataPathContains(incompleteDirectory, downloadDirectory) {
		if settings.DataPathContains(incompleteDirectory, defaultDownloadDirectory) {
			slog.Warn(
				"download directory remains inside the incomplete folder because its default also clashes",
				"downloadDirectory", downloadDirectory,
				"incompleteDirectory", incompleteDirectory,
			)
		} else {
			if _, err := transaction.ExecContext(
				ctx,
				"DELETE FROM settings WHERE key = 'transmission.downloadDirectory'",
			); err != nil {
				return fmt.Errorf("reset download directory setting: %w", err)
			}
			if _, err := transaction.ExecContext(
				ctx,
				"DELETE FROM managed_settings WHERE key = 'transmission.downloadDirectory'",
			); err != nil {
				return fmt.Errorf("reset managed download directory setting: %w", err)
			}
			downloadDirectory, err = effectiveStringSettingFrom(
				ctx,
				transaction,
				registry,
				"transmission.downloadDirectory",
			)
			if err != nil {
				return err
			}
		}
	}

	profileRows, err := transaction.QueryContext(
		ctx,
		"SELECT id, download_directory FROM torrent_profiles ORDER BY id",
	)
	if err != nil {
		return fmt.Errorf("read profile directories for cleanup: %w", err)
	}
	profileIDs := []string{}
	for profileRows.Next() {
		var profileID string
		var profileDownloadDirectory string
		if err := profileRows.Scan(&profileID, &profileDownloadDirectory); err != nil {
			_ = profileRows.Close()

			return fmt.Errorf("scan profile directory for cleanup: %w", err)
		}
		if settings.DataPathContains(incompleteDirectory, profileDownloadDirectory) {
			profileIDs = append(profileIDs, profileID)
		}
	}
	if err := profileRows.Err(); err != nil {
		_ = profileRows.Close()

		return fmt.Errorf("iterate profile directories for cleanup: %w", err)
	}
	if err := profileRows.Close(); err != nil {
		return fmt.Errorf("close profile directories for cleanup: %w", err)
	}
	for _, profileID := range profileIDs {
		if _, err := transaction.ExecContext(
			ctx,
			"UPDATE torrent_profiles SET download_directory = ? WHERE id = ?",
			downloadDirectory,
			profileID,
		); err != nil {
			return fmt.Errorf("reset torrent profile %s directory: %w", profileID, err)
		}
	}

	return nil
}
