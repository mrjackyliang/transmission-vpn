package api

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/controller"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/jsonbody"
)

const liveEventInterval = 2 * time.Second

// liveSnapshot is the browser's normalized, replaceable view of appliance activity.
//
// Partial upstream failures are represented as stable error codes so VPN safety state
// can remain visible even while Transmission is restarting or not configured.
type liveSnapshot struct {
	Sequence             uint64                 `json:"sequence"`
	CapturedAt           time.Time              `json:"capturedAt"`
	Status               *applianceStatus       `json:"status,omitempty"`
	VPN                  *liveVPNStatus         `json:"vpn,omitempty"`
	Connections          []liveConnectionStatus `json:"connections"`
	Protection           protectionStatus       `json:"protection"`
	Statistics           map[string]any         `json:"statistics,omitempty"`
	Torrents             []map[string]any       `json:"torrents"`
	OrganizationRevision int64                  `json:"organizationRevision"`
	Errors               []string               `json:"errors"`
}

// liveVPNStatus combines controller state with the API's administrator command gate.
type liveVPNStatus struct {
	controller.Status
	ChangeRunning bool `json:"changeRunning"`
}

// eventHub owns one refresh loop shared by every connected browser.
type eventHub struct {
	server      *Server
	ctx         context.Context
	cancel      context.CancelFunc
	startOnce   sync.Once
	mutex       sync.Mutex
	subscribers map[chan []byte]struct{}
	wake        chan struct{}
	sequence    atomic.Uint64
	memory      liveSnapshotMemory
}

// newEventHub prepares a lazily started live-state broadcaster.
func newEventHub(server *Server) *eventHub {
	hubContext, cancel := context.WithCancel(context.Background())

	return &eventHub{
		server:      server,
		ctx:         hubContext,
		cancel:      cancel,
		subscribers: map[chan []byte]struct{}{},
		wake:        make(chan struct{}, 1),
	}
}

// Close stops refresh work and releases connected clients.
func (hub *eventHub) Close() {
	hub.cancel()
}

// Subscribe registers one browser and requests an immediate snapshot.
func (hub *eventHub) Subscribe() (<-chan []byte, func()) {
	hub.startOnce.Do(func() {
		go hub.run()
	})

	subscriber := make(chan []byte, 1)
	hub.mutex.Lock()
	hub.subscribers[subscriber] = struct{}{}
	hub.mutex.Unlock()

	select {
	case hub.wake <- struct{}{}:
	default:
	}

	unsubscribe := func() {
		hub.mutex.Lock()
		delete(hub.subscribers, subscriber)
		hub.mutex.Unlock()
	}

	return subscriber, unsubscribe
}

// run refreshes immediately for new clients and periodically while clients exist.
func (hub *eventHub) run() {
	ticker := time.NewTicker(liveEventInterval)
	defer ticker.Stop()

	for {
		select {
		case <-hub.ctx.Done():
			hub.closeSubscribers()

			return
		case <-hub.wake:
			hub.refresh()
		case <-ticker.C:
			hub.refresh()
		}
	}
}

// refresh builds one shared snapshot only when at least one browser is listening.
//
// A part that misses this refresh repeats its last answer for a short while, so a slow
// disk or a busy daemon doesn't blank it in every browser. Only run calls refresh.
func (hub *eventHub) refresh() {
	if !hub.hasSubscribers() {
		return
	}

	snapshot := hub.memory.fill(hub.server.buildLiveSnapshot(
		hub.ctx,
		hub.sequence.Add(1),
	))
	payload, err := json.Marshal(jsonbody.Normalize(snapshot))
	if err != nil {
		hub.server.logInternalError("encode live event snapshot", err)

		return
	}

	hub.mutex.Lock()
	defer hub.mutex.Unlock()
	for subscriber := range hub.subscribers {
		select {
		case subscriber <- payload:
		default:
			select {
			case <-subscriber:
			default:
			}
			subscriber <- payload
		}
	}
}

// hasSubscribers avoids upstream work when no interface is open.
func (hub *eventHub) hasSubscribers() bool {
	hub.mutex.Lock()
	defer hub.mutex.Unlock()

	return len(hub.subscribers) > 0
}

// closeSubscribers releases every handler after shutdown.
func (hub *eventHub) closeSubscribers() {
	hub.mutex.Lock()
	defer hub.mutex.Unlock()

	for subscriber := range hub.subscribers {
		close(subscriber)
		delete(hub.subscribers, subscriber)
	}
}

// buildLiveSnapshot combines safety, VPN, transfer, and torrent state.
func (server *Server) buildLiveSnapshot(ctx context.Context, sequence uint64) liveSnapshot {
	snapshot := liveSnapshot{
		Sequence:    sequence,
		CapturedAt:  time.Now().UTC(),
		Connections: []liveConnectionStatus{},
		Protection:  protectionStatus{State: "setup-required"},
		Torrents:    []map[string]any{},
		Errors:      []string{},
	}
	organization, organizationError := server.store.TorrentOrganization(ctx)
	if organizationError == nil {
		snapshot.OrganizationRevision = organization.Revision
	} else {
		snapshot.Errors = append(snapshot.Errors, "torrent-organization-unavailable")
	}

	statusContext, cancelStatus := context.WithTimeout(ctx, 2*time.Second)
	status, err := server.buildStatus(statusContext)
	cancelStatus()
	if err == nil {
		snapshot.Status = &status
		snapshot.Connections = status.Connections
		snapshot.Protection = status.Protection
		for _, connection := range status.Connections {
			if connection.Default {
				snapshot.VPN = &liveVPNStatus{
					Status:        connection.Status,
					ChangeRunning: server.vpnCommands.running(),
				}

				break
			}
		}
	} else {
		snapshot.Errors = append(snapshot.Errors, "status-unavailable")
	}

	if snapshot.VPN == nil && server.controller != nil {
		vpnContext, cancelVPN := context.WithTimeout(ctx, 2*time.Second)
		vpnStatuses, vpnError := server.controller.Status(vpnContext)
		cancelVPN()
		if vpnError == nil {
			snapshot.VPN = &liveVPNStatus{
				Status:        defaultControllerStatus(vpnStatuses),
				ChangeRunning: server.vpnCommands.running(),
			}
		} else {
			snapshot.Errors = append(snapshot.Errors, "vpn-status-unavailable")
		}
	}

	if len(server.transmissionDaemons(ctx)) == 0 {
		snapshot.Errors = append(snapshot.Errors, "transmission-unavailable")

		return snapshot
	}

	statisticsContext, cancelStatistics := context.WithTimeout(ctx, 2*time.Second)
	statistics, statisticsErrors := server.summedTransmissionStatistics(statisticsContext)
	cancelStatistics()
	if len(statistics) > 0 {
		snapshot.Statistics = statistics
	}
	snapshot.Errors = append(snapshot.Errors, statisticsErrors...)

	torrentListStartedAt := time.Now()
	torrentsContext, cancelTorrents := context.WithTimeout(ctx, 2*time.Second)
	torrentResult := server.mergedTorrents(torrentsContext, torrentSummaryFields, nil)
	cancelTorrents()
	if len(torrentResult.Torrents) > 0 || torrentResult.Complete {
		server.addTorrentProfileAssignments(
			ctx,
			torrentResult.Torrents,
			torrentResult.Complete,
			torrentListStartedAt,
		)
		snapshot.Torrents = torrentResult.Torrents
	}
	if len(torrentResult.Torrents) > 0 {
		organization, labelError := server.saveTorrentLabelsFromTorrents(
			ctx,
			torrentResult.Torrents,
		)
		if labelError == nil {
			snapshot.OrganizationRevision = organization.Revision
		} else {
			server.logInternalError("save labels observed in live torrent snapshot", labelError)
			if organizationError == nil {
				snapshot.Errors = append(snapshot.Errors, "torrent-organization-unavailable")
			}
		}
	}
	snapshot.Errors = append(snapshot.Errors, torrentResult.Errors...)

	return snapshot
}

// handleEvents streams replaceable snapshots over one authenticated origin.
func (server *Server) handleEvents(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	flusher, supported := responseWriter.(http.Flusher)
	if !supported {
		writeError(
			responseWriter,
			http.StatusInternalServerError,
			"streaming_unavailable",
			"Live updates are unavailable for this connection.",
		)

		return
	}

	responseWriter.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	responseWriter.Header().Set("Cache-Control", "no-store")
	responseWriter.Header().Set("Connection", "keep-alive")
	_, _ = responseWriter.Write([]byte("retry: 2000\n\n"))
	flusher.Flush()

	snapshots, unsubscribe := server.events.Subscribe()
	defer unsubscribe()

	for {
		select {
		case <-request.Context().Done():
			return
		case payload, open := <-snapshots:
			if !open {
				return
			}
			if _, err := responseWriter.Write([]byte("event: snapshot\ndata: ")); err != nil {
				return
			}
			if _, err := responseWriter.Write(payload); err != nil {
				return
			}
			if _, err := responseWriter.Write([]byte("\n\n")); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}
