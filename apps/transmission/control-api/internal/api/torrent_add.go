package api

import (
	"context"
	"fmt"
	"strings"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/directorybrowser"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionrpc"
)

const (
	// maximumTorrentAddRequestBytes caps one torrent add request body.
	//
	// A 16 MiB file is about 21.3 MiB in base64; the rest leaves room for labels, a
	// profile, and the JSON around them on the console route and the RPC facade.
	//
	// Since: 2.3.0
	maximumTorrentAddRequestBytes int64 = 23 * 1024 * 1024

	// torrentFileTooLargeMessage answers a .torrent file over the 16 MiB limit.
	//
	// The console route and the RPC facade's torrent-add both use it, so a person
	// sees the file limit whether the request body or the decoded file went over.
	//
	// Since: 2.3.0
	torrentFileTooLargeMessage = "The .torrent file is larger than 16 MiB."
)

// torrentMetainfoTooLarge reports whether one decoded .torrent file is over 16 MiB.
//
// The limit matches what the directory controller reads back, so every added torrent
// can later be downloaded as a file or included in a backup.
//
// Since: 2.3.0
func torrentMetainfoTooLarge(metainfo []byte) bool {
	return int64(len(metainfo)) > directorybrowser.MaximumTorrentMetainfoBytes
}

// prepareTorrentAddDownloadDirectory forces one validated profile destination.
//
// First-party and compatible adds both discard caller folder preference after profile
// selection so every torrent starts in its owning profile's folder.
//
// Since: 2.0.0
func prepareTorrentAddDownloadDirectory(
	request *transmissionrpc.AddTorrentRequest,
	profile storage.TorrentProfile,
	policy downloadPathPolicy,
) error {
	normalizedDownloadDirectory, err := policy.normalizeDownloadDirectory(
		profile.DownloadDirectory,
	)
	if err != nil {
		return err
	}
	request.DownloadDirectory = &normalizedDownloadDirectory

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
	client *transmissionrpc.Adapter,
	request *transmissionrpc.AddTorrentRequest,
	hashKnown bool,
) (bool, error) {
	if hashKnown {
		return false, nil
	}

	startAfterDuplicateCheck := false
	if request.Paused != nil {
		startAfterDuplicateCheck = !*request.Paused
	} else {
		session, err := client.GetSession(
			ctx,
			transmissionrpc.GetSessionRequest{Fields: []transmissionrpc.SessionField{
				transmissionrpc.SessionFieldStartAddedTorrents,
			}},
		)
		if err != nil {
			return false, fmt.Errorf("read Transmission start-added-torrents: %w", err)
		}
		if err := session.DecodeValue(
			transmissionrpc.SessionFieldStartAddedTorrents,
			&startAfterDuplicateCheck,
		); err != nil {
			return false, fmt.Errorf("decode Transmission start-added-torrents: %w", err)
		}
	}

	paused := true
	request.Paused = &paused

	return startAfterDuplicateCheck, nil
}
