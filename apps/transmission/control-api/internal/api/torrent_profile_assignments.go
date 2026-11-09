package api

import (
	"context"
	"strings"
	"sync"
	"time"
)

const torrentProfileAssignmentPruneInterval = time.Minute

// torrentProfileAssignmentCache keeps list enrichment independent from SQLite reads.
//
// Every assignment mutation reloads this map. Complete daemon lists also claim the
// rate-limited stale cleanup through the same lock.
type torrentProfileAssignmentCache struct {
	mutex       sync.RWMutex
	assignments map[string]string
	needs       map[string][]string
	lastPruned  time.Time
}

// newTorrentProfileAssignmentCache copies the initial durable assignment snapshot.
func newTorrentProfileAssignmentCache(
	assignments map[string]string,
	needs map[string][]string,
) *torrentProfileAssignmentCache {
	cache := &torrentProfileAssignmentCache{}
	cache.replace(assignments, needs)

	return cache
}

// replace atomically publishes lowercase copies of all durable profile records.
func (cache *torrentProfileAssignmentCache) replace(
	assignments map[string]string,
	needs map[string][]string,
) {
	replacement := make(map[string]string, len(assignments))
	for hash, profileID := range assignments {
		replacement[strings.ToLower(hash)] = profileID
	}

	needsReplacement := make(map[string][]string, len(needs))
	for hash, profileIDs := range needs {
		needsReplacement[strings.ToLower(hash)] = append([]string(nil), profileIDs...)
	}

	cache.mutex.Lock()
	cache.assignments = replacement
	cache.needs = needsReplacement
	cache.mutex.Unlock()
}

// needsProfileIDs reads one unresolved choice without exposing the cached slice.
func (cache *torrentProfileAssignmentCache) needsProfileIDs(hash string) ([]string, bool) {
	cache.mutex.RLock()
	defer cache.mutex.RUnlock()

	profileIDs, found := cache.needs[strings.ToLower(hash)]

	return append([]string(nil), profileIDs...), found
}

// profileID reads one assignment without blocking other list readers.
func (cache *torrentProfileAssignmentCache) profileID(hash string) (string, bool) {
	cache.mutex.RLock()
	defer cache.mutex.RUnlock()

	profileID, found := cache.assignments[strings.ToLower(hash)]

	return profileID, found
}

// hasProfile reports whether any durable assignment names one profile.
func (cache *torrentProfileAssignmentCache) hasProfile(profileID string) bool {
	cache.mutex.RLock()
	defer cache.mutex.RUnlock()

	for _, assignedProfileID := range cache.assignments {
		if assignedProfileID == profileID {
			return true
		}
	}

	return false
}

// claimPrune permits at most one complete-list cleanup per interval.
func (cache *torrentProfileAssignmentCache) claimPrune(now time.Time) bool {
	cache.mutex.Lock()
	defer cache.mutex.Unlock()

	if !cache.lastPruned.IsZero() && now.Sub(cache.lastPruned) < torrentProfileAssignmentPruneInterval {
		return false
	}
	cache.lastPruned = now

	return true
}

// refreshTorrentProfileAssignments reloads the cache after a durable mutation.
func (server *Server) refreshTorrentProfileAssignments(ctx context.Context) error {
	assignments, err := server.store.ListTorrentProfileAssignments(ctx)
	if err != nil {
		return err
	}

	needs, err := server.store.ListTorrentNeedsProfiles(ctx)
	if err != nil {
		return err
	}

	server.torrentProfileAssignments.replace(assignments, needs)

	return nil
}

// addTorrentProfileAssignments decorates daemon torrents and cleans a complete list.
//
// Selected and detail queries never prune because their missing hashes do not mean a
// torrent left Transmission.
func (server *Server) addTorrentProfileAssignments(
	ctx context.Context,
	torrents []map[string]any,
	completeList bool,
	listStartedAt time.Time,
) {
	activeHashes := make(map[string]struct{}, len(torrents))
	for _, torrent := range torrents {
		hash, _ := torrent["hashString"].(string)
		if hash != "" {
			activeHashes[strings.ToLower(hash)] = struct{}{}
		}
	}

	if completeList && server.torrentProfileAssignments.claimPrune(time.Now()) {
		if err := server.store.DeleteStaleTorrentProfileAssignments(
			ctx,
			activeHashes,
			listStartedAt,
		); err != nil {
			server.logInternalError("delete stale torrent profile assignments", err)
		} else if err := server.refreshTorrentProfileAssignments(ctx); err != nil {
			server.logInternalError("refresh torrent profile assignments after cleanup", err)
		}
	}

	for _, torrent := range torrents {
		torrent["profileId"] = nil
		torrent["needsProfile"] = nil
		hash, _ := torrent["hashString"].(string)
		if profileID, found := server.torrentProfileAssignments.profileID(hash); found {
			torrent["profileId"] = profileID
		}
		if profileIDs, found := server.torrentProfileAssignments.needsProfileIDs(hash); found {
			torrent["needsProfile"] = map[string]any{"profileIds": profileIDs}
		}
	}
}
