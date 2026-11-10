package api

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionrpc"
)

// prepareTorrentAddDownloadDirectory forces one validated profile destination.
//
// First-party and compatible adds both discard caller folder preference after profile
// selection so every torrent starts in its owning profile's folder.
//
// Since: 2.0.0
func prepareTorrentAddDownloadDirectory(
	arguments map[string]any,
	profile storage.TorrentProfile,
	policy downloadPathPolicy,
) error {
	normalizedDownloadDirectory, err := policy.normalizeDownloadDirectory(
		profile.DownloadDirectory,
	)
	if err != nil {
		return err
	}
	arguments["download-dir"] = normalizedDownloadDirectory

	return nil
}

// torrentAddDownloadDirectoryMatches compares a request folder with its profile.
func torrentAddDownloadDirectoryMatches(
	requestedDownloadDirectory string,
	profileDownloadDirectory string,
) bool {
	normalizedRequestedDirectory, err := settings.NormalizeDataPath(
		requestedDownloadDirectory,
	)
	if err != nil {
		return false
	}
	normalizedProfileDirectory, err := settings.NormalizeDataPath(
		profileDownloadDirectory,
	)
	if err != nil {
		return false
	}

	return strings.EqualFold(
		normalizedRequestedDirectory,
		normalizedProfileDirectory,
	)
}

// prepareTorrentAddStart pauses an unknown-hash add until duplicate checks finish.
//
// URL adds preserve the caller's intended start behavior while magnets and uploaded
// metainfo keep their original arguments and avoid the session lookup.
//
// Since: 2.0.0
func prepareTorrentAddStart(
	ctx context.Context,
	client transmissionrpc.Caller,
	arguments map[string]any,
	hashKnown bool,
) (bool, error) {
	if hashKnown {
		return false, nil
	}

	startAfterDuplicateCheck := false
	pausedValue, pausedSet := arguments["paused"]
	if pausedSet {
		paused, valid := pausedValue.(bool)
		if !valid {
			return false, errors.New("paused must be a boolean")
		}
		startAfterDuplicateCheck = !paused
	} else {
		var session struct {
			StartAddedTorrents bool `json:"start-added-torrents"`
		}
		if err := client.Call(
			ctx,
			"session-get",
			map[string]any{"fields": []string{"start-added-torrents"}},
			&session,
		); err != nil {
			return false, fmt.Errorf("read Transmission start-added-torrents: %w", err)
		}
		startAfterDuplicateCheck = session.StartAddedTorrents
	}

	arguments["paused"] = true

	return startAfterDuplicateCheck, nil
}
