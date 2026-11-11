package api

import (
	"slices"
	"testing"
	"time"
)

// liveTorrentIDs lists a snapshot's torrent IDs in order.
func liveTorrentIDs(snapshot liveSnapshot) []int64 {
	identifiers := make([]int64, 0, len(snapshot.Torrents))
	for _, torrent := range snapshot.Torrents {
		identifier, _ := torrent["id"].(int64)
		identifiers = append(identifiers, identifier)
	}
	slices.Sort(identifiers)

	return identifiers
}

// liveTorrent is one torrent row as mergedTorrents returns it.
func liveTorrent(identifier int64, connectionID string) map[string]any {
	return map[string]any{
		"id":           identifier,
		"connectionId": connectionID,
	}
}

// TestLiveSnapshotMemoryRepeatsMissedParts keeps the live view steady through a missed
// refresh.
//
// A refresh that misses the status, the VPN, one daemon's numbers and torrents, and
// the organization repeats the last answers, keeps its error codes, and stops
// repeating once those answers are older than liveMemoryLimit.
func TestLiveSnapshotMemoryRepeatsMissedParts(testingObject *testing.T) {
	start := time.Date(2026, time.November, 11, 8, 0, 0, 0, time.UTC)
	connections := []liveConnectionStatus{
		{ConnectionID: "vpc-a", Enabled: true, State: "protected"},
		{ConnectionID: "vpc-b", Enabled: true, State: "protected"},
	}
	protection := protectionStatus{State: "protected", ProtectedCount: 2, EnabledCount: 2}
	status := &applianceStatus{
		ProtectionState: "protected",
		Protection:      protection,
		Connections:     connections,
	}
	vpn := &liveVPNStatus{}
	misses := []string{
		"status-unavailable",
		"torrent-organization-unavailable",
		"torrents-unavailable:vpc-a",
		"transmission-statistics-unavailable:vpc-a",
		"vpn-status-unavailable",
	}
	missedSnapshot := func(capturedAt time.Time) liveSnapshot {
		return liveSnapshot{
			CapturedAt:  capturedAt,
			Connections: []liveConnectionStatus{},
			Protection:  protectionStatus{State: "setup-required"},
			Statistics:  map[string]any{"downloadSpeed": 40},
			Torrents:    []map[string]any{liveTorrent(3, "vpc-b")},
			Errors:      slices.Clone(misses),
		}
	}
	memory := liveSnapshotMemory{}

	loaded := memory.fill(liveSnapshot{
		CapturedAt:           start,
		Status:               status,
		VPN:                  vpn,
		Connections:          connections,
		Protection:           protection,
		Statistics:           map[string]any{"downloadSpeed": 140},
		Torrents:             []map[string]any{liveTorrent(1, "vpc-a"), liveTorrent(2, "vpc-a"), liveTorrent(3, "vpc-b")},
		OrganizationRevision: 7,
		Errors:               []string{},
	})
	if !slices.Equal(liveTorrentIDs(loaded), []int64{1, 2, 3}) || loaded.Status != status {
		testingObject.Fatalf("a refresh that loaded changed = %+v", loaded)
	}

	repeated := memory.fill(missedSnapshot(start.Add(2 * time.Second)))
	if repeated.Status != status ||
		repeated.VPN != vpn ||
		len(repeated.Connections) != 2 ||
		repeated.Protection != protection ||
		repeated.Statistics["downloadSpeed"] != 140 ||
		repeated.OrganizationRevision != 7 {
		testingObject.Fatalf("missed parts = %+v, want the last answers", repeated)
	}
	if !slices.Equal(liveTorrentIDs(repeated), []int64{1, 2, 3}) {
		testingObject.Fatalf("torrents after vpc-a missed = %v, want [1 2 3]", liveTorrentIDs(repeated))
	}
	if !slices.Equal(repeated.Errors, misses) {
		testingObject.Fatalf("errors = %v, want %v", repeated.Errors, misses)
	}

	stale := memory.fill(missedSnapshot(start.Add(liveMemoryLimit + time.Second)))
	if stale.Status != nil ||
		stale.VPN != nil ||
		len(stale.Connections) != 0 ||
		stale.Protection.State != "setup-required" ||
		stale.Statistics["downloadSpeed"] != 40 ||
		stale.OrganizationRevision != 0 {
		testingObject.Fatalf("parts missed for longer than the limit = %+v, want the new answers", stale)
	}
	if !slices.Equal(liveTorrentIDs(stale), []int64{3}) {
		testingObject.Fatalf("torrents after vpc-a missed for too long = %v, want [3]", liveTorrentIDs(stale))
	}
}

// TestLiveSnapshotMemoryKeepsRemovalsAndEmptyLists repeats only what the last refresh
// that loaded showed.
//
// A torrent removed in a refresh that loaded doesn't return when the next refresh
// misses, and a connection that loaded with no torrents repeats none.
func TestLiveSnapshotMemoryKeepsRemovalsAndEmptyLists(testingObject *testing.T) {
	start := time.Date(2026, time.November, 11, 8, 0, 0, 0, time.UTC)
	memory := liveSnapshotMemory{}

	memory.fill(liveSnapshot{
		CapturedAt: start,
		Torrents:   []map[string]any{liveTorrent(1, "vpc-a"), liveTorrent(2, "vpc-a"), liveTorrent(5, "vpc-b")},
		Errors:     []string{},
	})
	memory.fill(liveSnapshot{
		CapturedAt: start.Add(2 * time.Second),
		Torrents:   []map[string]any{liveTorrent(2, "vpc-a")},
		Errors:     []string{},
	})

	missed := memory.fill(liveSnapshot{
		CapturedAt: start.Add(4 * time.Second),
		Torrents:   []map[string]any{},
		Errors:     []string{"torrents-unavailable:vpc-a", "torrents-unavailable:vpc-b"},
	})
	if !slices.Equal(liveTorrentIDs(missed), []int64{2}) {
		testingObject.Fatalf("torrents after a removal and a miss = %v, want [2]", liveTorrentIDs(missed))
	}
}
