package transmissionrpc

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"sync"
	"time"
)

const (
	maximumConnectionSlot = 63
	maximumDaemonID       = int64(1 << 24)
	firstDaemonRPCPort    = 9092
)

// Caller is the RPC operation used by the multi-daemon control plane.
//
// The interface belongs to the API consumer so focused tests can substitute a
// loopback fake without weakening Client's endpoint validation.
//
// Since: 2.0.0
type Caller interface {
	Call(context.Context, string, any, any) error
}

// DaemonConfig identifies one connection's loopback Transmission endpoint.
//
// Endpoint is normally empty and derived from Slot. Tests may provide another
// loopback URL so several fake daemons can use operating-system-assigned ports.
//
// Since: 2.0.0
type DaemonConfig struct {
	ConnectionID string
	Slot         int
	PeerPort     int
	Default      bool
	Endpoint     string
}

// Daemon is one immutable client snapshot returned by ClientSet.
//
// Callers can fan out without holding the set's lock while replacements reuse
// unchanged clients and their negotiated Transmission session identifiers.
//
// Since: 2.0.0
type Daemon struct {
	ConnectionID string
	Slot         int
	PeerPort     int
	Default      bool
	Client       Caller
	endpoint     string
}

// ClientSet keeps one RPC client per durable VPN connection.
//
// Replacing the complete set is atomic, so API requests observe either the old
// connection list or the new one and never a partially updated routing table.
//
// Since: 2.0.0
type ClientSet struct {
	mutex   sync.RWMutex
	timeout time.Duration
	byID    map[string]Daemon
}

// NewClientSet creates an initially empty multi-daemon client set.
//
// The caller publishes a complete connection snapshot with Replace after the
// database transaction that changed it has committed.
//
// Since: 2.0.0
func NewClientSet(timeout time.Duration) *ClientSet {
	if timeout <= 0 {
		timeout = 30 * time.Second
	}

	return &ClientSet{
		timeout: timeout,
		byID:    map[string]Daemon{},
	}
}

// Replace validates and atomically installs a complete connection snapshot.
//
// Existing clients are retained when their connection and endpoint are unchanged,
// preserving negotiated RPC session identifiers across unrelated connection edits.
//
// Since: 2.0.0
func (clients *ClientSet) Replace(configurations []DaemonConfig) error {
	clients.mutex.RLock()
	current := make(map[string]Daemon, len(clients.byID))
	for connectionID, daemon := range clients.byID {
		current[connectionID] = daemon
	}
	clients.mutex.RUnlock()

	replacement := make(map[string]Daemon, len(configurations))
	occupiedSlots := make(map[int]string, len(configurations))
	defaultCount := 0
	for _, configuration := range configurations {
		if configuration.ConnectionID == "" {
			return errors.New("Transmission connection identifier is required")
		}
		if configuration.Slot < 0 || configuration.Slot > maximumConnectionSlot {
			return fmt.Errorf("Transmission connection %s has invalid slot %d", configuration.ConnectionID, configuration.Slot)
		}
		if configuration.PeerPort < 1024 || configuration.PeerPort > 65535 {
			return fmt.Errorf("Transmission connection %s has invalid peer port %d", configuration.ConnectionID, configuration.PeerPort)
		}
		if _, found := replacement[configuration.ConnectionID]; found {
			return fmt.Errorf("duplicate Transmission connection %s", configuration.ConnectionID)
		}
		if occupiedBy, found := occupiedSlots[configuration.Slot]; found {
			return fmt.Errorf("Transmission connections %s and %s share slot %d", occupiedBy, configuration.ConnectionID, configuration.Slot)
		}
		occupiedSlots[configuration.Slot] = configuration.ConnectionID
		if configuration.Default {
			defaultCount++
		}

		endpoint := configuration.Endpoint
		if endpoint == "" {
			if existing, found := current[configuration.ConnectionID]; found &&
				existing.Slot == configuration.Slot && existing.endpoint != "" {
				endpoint = existing.endpoint
			} else {
				endpoint = fmt.Sprintf(
					"http://127.0.0.1:%d/transmission/rpc",
					firstDaemonRPCPort+configuration.Slot,
				)
			}
		}

		daemon := current[configuration.ConnectionID]
		if daemon.Client == nil || daemon.Slot != configuration.Slot || daemon.endpoint != endpoint {
			client, err := NewClient(endpoint, clients.timeout)
			if err != nil {
				return fmt.Errorf("create Transmission client for %s: %w", configuration.ConnectionID, err)
			}
			daemon.Client = client
		}
		daemon.ConnectionID = configuration.ConnectionID
		daemon.Slot = configuration.Slot
		daemon.PeerPort = configuration.PeerPort
		daemon.Default = configuration.Default
		daemon.endpoint = endpoint
		replacement[configuration.ConnectionID] = daemon
	}
	if len(configurations) > 0 && defaultCount != 1 {
		return fmt.Errorf("Transmission client set requires one default connection, found %d", defaultCount)
	}

	clients.mutex.Lock()
	clients.byID = replacement
	clients.mutex.Unlock()

	return nil
}

// Snapshot returns every daemon in stable slot order.
//
// The copied descriptors remain safe to use while another goroutine publishes a
// connection change because each Client is independently concurrency-safe.
//
// Since: 2.0.0
func (clients *ClientSet) Snapshot() []Daemon {
	clients.mutex.RLock()
	daemons := make([]Daemon, 0, len(clients.byID))
	for _, daemon := range clients.byID {
		daemons = append(daemons, daemon)
	}
	clients.mutex.RUnlock()

	sort.Slice(daemons, func(left int, right int) bool {
		return daemons[left].Slot < daemons[right].Slot
	})

	return daemons
}

// Default returns the daemon selected for unprofiled and session-wide work.
//
// A missing default is possible only before the first VPN connection is created.
//
// Since: 2.0.0
func (clients *ClientSet) Default() (Daemon, bool) {
	clients.mutex.RLock()
	defer clients.mutex.RUnlock()

	for _, daemon := range clients.byID {
		if daemon.Default {
			return daemon, true
		}
	}

	return Daemon{}, false
}

// ByConnectionID resolves one durable connection to its daemon client.
//
// Profile routing uses this lookup after resolving null to the default connection.
//
// Since: 2.0.0
func (clients *ClientSet) ByConnectionID(connectionID string) (Daemon, bool) {
	clients.mutex.RLock()
	defer clients.mutex.RUnlock()

	daemon, found := clients.byID[connectionID]

	return daemon, found
}

// BySlot resolves a facade identifier's stable slot to its daemon client.
//
// Slots are never reused while a connection exists, making them the routing bits in
// every application-facing torrent identifier.
//
// Since: 2.0.0
func (clients *ClientSet) BySlot(slot int) (Daemon, bool) {
	clients.mutex.RLock()
	defer clients.mutex.RUnlock()

	for _, daemon := range clients.byID {
		if daemon.Slot == slot {
			return daemon, true
		}
	}

	return Daemon{}, false
}

// Call sends a session-wide method to the current default daemon.
//
// This preserves the single-client consumer contract for session-get, free-space,
// and the E3-compatible RPC proxy while torrent operations use explicit fan-out.
//
// Since: 2.0.0
func (clients *ClientSet) Call(
	ctx context.Context,
	method string,
	arguments any,
	result any,
) error {
	daemon, found := clients.Default()
	if !found {
		return errors.New("default Transmission daemon is unavailable")
	}

	return daemon.Client.Call(ctx, method, arguments, result)
}

// FacadeID combines a stable connection slot with one daemon-local torrent ID.
//
// Slot zero intentionally leaves identifiers unchanged for existing single-connection
// installations. IDs at or above 2^24 are refused to prevent slot collisions.
//
// Since: 2.0.0
func FacadeID(slot int, daemonID int64) (int64, error) {
	if slot < 0 || slot > maximumConnectionSlot {
		return 0, fmt.Errorf("Transmission slot must be between 0 and %d", maximumConnectionSlot)
	}
	if daemonID <= 0 || daemonID >= maximumDaemonID {
		return 0, fmt.Errorf("Transmission daemon ID must be between 1 and %d", maximumDaemonID-1)
	}

	return int64(slot)<<24 | daemonID, nil
}

// SplitFacadeID returns the connection slot and daemon-local torrent ID.
//
// Only identifiers that FacadeID could have produced are accepted, keeping malformed
// high bits from being routed to an unrelated daemon.
//
// Since: 2.0.0
func SplitFacadeID(facadeID int64) (int, int64, error) {
	if facadeID <= 0 {
		return 0, 0, errors.New("Transmission facade ID must be positive")
	}

	slot := int(facadeID >> 24)
	daemonID := facadeID & (maximumDaemonID - 1)
	if slot < 0 || slot > maximumConnectionSlot || daemonID <= 0 {
		return 0, 0, errors.New("Transmission facade ID is invalid")
	}

	return slot, daemonID, nil
}
