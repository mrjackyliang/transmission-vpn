package api

import (
	"strings"
	"time"
)

// liveMemoryLimit is how long a part of the live view that failed to load keeps
// showing its last answer.
//
// A busy NAS disk, or a Transmission daemon deleting a removed torrent's files, can
// miss a two-second refresh now and then. Repeating the last answer keeps the torrent
// list, its checks, and the VPN badge steady through that. A gap longer than this is
// real, so the browser sees it.
//
// Since: 2.2.0
const liveMemoryLimit = 30 * time.Second

// liveSnapshotMemory remembers the last answer of each part of the live view that can
// fail on its own.
//
// Only the event hub's refresh loop uses it, so it needs no lock.
//
// Since: 2.2.0
type liveSnapshotMemory struct {
	status               liveRemembered[liveStatusPart]
	vpn                  liveRemembered[*liveVPNStatus]
	statistics           liveRemembered[map[string]any]
	organizationRevision liveRemembered[int64]
	torrents             map[string]liveRemembered[[]map[string]any]
}

// liveRemembered is one remembered answer and when it loaded.
//
// Since: 2.2.0
type liveRemembered[Value any] struct {
	loadedAt time.Time
	value    Value
}

// liveStatusPart is the part of a live snapshot that the appliance status fills.
//
// Since: 2.2.0
type liveStatusPart struct {
	status      *applianceStatus
	connections []liveConnectionStatus
	protection  protectionStatus
}

// liveMissed lists the parts a live snapshot's error codes say did not load.
//
// Since: 2.2.0
type liveMissed struct {
	status       bool
	vpn          bool
	statistics   bool
	organization bool
	torrents     []string
}

// recentAt reports whether a remembered answer is young enough to repeat.
//
// Since: 2.2.0
func (remembered liveRemembered[Value]) recentAt(now time.Time) bool {
	return !remembered.loadedAt.IsZero() && now.Sub(remembered.loadedAt) <= liveMemoryLimit
}

// liveMissedParts reads which parts missed from a snapshot's error codes.
//
// Since: 2.2.0
func liveMissedParts(codes []string) liveMissed {
	missed := liveMissed{}
	for _, code := range codes {
		switch {
		case code == "status-unavailable":
			missed.status = true
		case code == "vpn-status-unavailable":
			missed.vpn = true
		case code == "torrent-organization-unavailable":
			missed.organization = true
		case strings.HasPrefix(code, "transmission-statistics-unavailable:"):
			missed.statistics = true
		case strings.HasPrefix(code, "torrents-unavailable:"):
			missed.torrents = append(missed.torrents, strings.TrimPrefix(code, "torrents-unavailable:"))
		}
	}

	return missed
}

// fill repeats the remembered answer of each part this snapshot missed, when that
// answer is recent, and remembers each part that loaded.
//
// The error codes stay in the snapshot. Torrents are remembered per VPN connection,
// so a torrent removed in a refresh that loaded stays gone when a later one misses.
//
// Since: 2.2.0
func (memory *liveSnapshotMemory) fill(snapshot liveSnapshot) liveSnapshot {
	now := snapshot.CapturedAt
	missed := liveMissedParts(snapshot.Errors)

	if !missed.status {
		memory.status = liveRemembered[liveStatusPart]{
			loadedAt: now,
			value: liveStatusPart{
				status:      snapshot.Status,
				connections: snapshot.Connections,
				protection:  snapshot.Protection,
			},
		}
	} else if memory.status.recentAt(now) {
		snapshot.Status = memory.status.value.status
		snapshot.Connections = memory.status.value.connections
		snapshot.Protection = memory.status.value.protection
	}

	// When the status misses, the VPN controller answers for the VPN on its own.
	if snapshot.VPN != nil || (!missed.status && !missed.vpn) {
		memory.vpn = liveRemembered[*liveVPNStatus]{loadedAt: now, value: snapshot.VPN}
	} else if memory.vpn.recentAt(now) {
		snapshot.VPN = memory.vpn.value
	}

	// One daemon missing leaves only the others' numbers, so the whole sum is repeated.
	if !missed.statistics {
		memory.statistics = liveRemembered[map[string]any]{loadedAt: now, value: snapshot.Statistics}
	} else if memory.statistics.recentAt(now) {
		snapshot.Statistics = memory.statistics.value
	}

	// A label save can fail after the organization loaded, which keeps its revision.
	if !missed.organization || snapshot.OrganizationRevision != 0 {
		memory.organizationRevision = liveRemembered[int64]{
			loadedAt: now,
			value:    snapshot.OrganizationRevision,
		}
	} else if memory.organizationRevision.recentAt(now) {
		snapshot.OrganizationRevision = memory.organizationRevision.value
	}

	loadedTorrents := map[string]liveRemembered[[]map[string]any]{}
	for _, torrent := range snapshot.Torrents {
		connectionID, _ := torrent["connectionId"].(string)
		remembered := loadedTorrents[connectionID]
		remembered.loadedAt = now
		remembered.value = append(remembered.value, torrent)
		loadedTorrents[connectionID] = remembered
	}
	for _, connectionID := range missed.torrents {
		remembered, found := memory.torrents[connectionID]
		if !found || !remembered.recentAt(now) {
			continue
		}
		snapshot.Torrents = append(snapshot.Torrents, remembered.value...)
		loadedTorrents[connectionID] = remembered
	}
	memory.torrents = loadedTorrents

	return snapshot
}
