package runtimeinfo

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/controller"
)

// Snapshot is the control plane's normalized view of supervised runtime state.
//
// Files are written atomically by the privileged lifecycle components, allowing the
// unprivileged API to observe safety state without receiving network capabilities.
type Snapshot struct {
	ConfigurationReady bool                    `json:"configurationReady"`
	Firewall           FirewallState           `json:"firewall"`
	Services           map[string]ServiceState `json:"services"`
}

// FirewallState describes the independently enforced Transmission safety boundary.
//
// The API reports this evidence but cannot create or remove firewall rules itself.
type FirewallState struct {
	Ready      bool                 `json:"ready"`
	State      string               `json:"state"`
	Interfaces []ProtectedInterface `json:"interfaces"`
	Backend    string               `json:"backend,omitempty"`
	UserID     int64                `json:"userId,omitempty"`
}

// ProtectedInterface is one source-bound firewall path owned by the controller.
type ProtectedInterface struct {
	Interface string `json:"interface"`
	Address   string `json:"address"`
}

// ServiceState reports whether one s6-supervised process published readiness.
//
// Marker presence is diagnostic context rather than a substitute for service-specific
// health checks or verified VPN protection.
type ServiceState struct {
	Ready bool   `json:"ready"`
	Phase string `json:"phase,omitempty"`
}

// TransmissionDaemonState is one runner-owned connection daemon snapshot.
//
// Missing files resolve to State "missing" so live status remains available while
// the runner reconciles a newly published connection list.
//
// Since: 2.0.0
type TransmissionDaemonState struct {
	ConnectionID string    `json:"connectionId"`
	State        string    `json:"state"`
	RPCPort      int       `json:"rpcPort"`
	BindAddress  string    `json:"bindAddress"`
	PeerPort     int       `json:"peerPort"`
	Version      string    `json:"version,omitempty"`
	RPCVersion   int       `json:"rpcVersion,omitempty"`
	UpdatedAt    time.Time `json:"updatedAt,omitempty"`
}

// ReadSnapshot reads the current lifecycle markers from the runtime directory.
//
// Missing markers are represented as not ready so status remains available during
// setup, reconnect, and orderly shutdown transitions.
func ReadSnapshot(runtimeDirectory string) (Snapshot, error) {
	snapshot := Snapshot{
		Firewall: FirewallState{Interfaces: []ProtectedInterface{}},
		Services: map[string]ServiceState{},
	}

	if _, err := os.Stat(filepath.Join(runtimeDirectory, "config.ready")); err == nil {
		snapshot.ConfigurationReady = true
	} else if !errors.Is(err, os.ErrNotExist) {
		return Snapshot{}, fmt.Errorf("inspect configuration readiness: %w", err)
	}

	firewallPath := filepath.Join(runtimeDirectory, "firewall.ready")
	firewallContent, err := os.ReadFile(firewallPath)
	if err == nil {
		var firewallRecord struct {
			State      string               `json:"state"`
			Interfaces []ProtectedInterface `json:"interfaces"`
			Backend    string               `json:"backend"`
			UserID     int64                `json:"uid"`
		}
		if err := json.Unmarshal(firewallContent, &firewallRecord); err != nil {
			return Snapshot{}, fmt.Errorf("decode firewall readiness: %w", err)
		}

		snapshot.Firewall = FirewallState{
			Ready:      true,
			State:      firewallRecord.State,
			Interfaces: firewallRecord.Interfaces,
			Backend:    firewallRecord.Backend,
			UserID:     firewallRecord.UserID,
		}
		if snapshot.Firewall.Interfaces == nil {
			snapshot.Firewall.Interfaces = []ProtectedInterface{}
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return Snapshot{}, fmt.Errorf("read firewall readiness: %w", err)
	}

	serviceNames := []string{
		"control-api",
		"directory-controller",
		"transmission",
		"vpn-controller",
		"web-proxy",
	}
	for _, serviceName := range serviceNames {
		serviceState, readError := readServiceState(runtimeDirectory, serviceName)
		if readError != nil {
			return Snapshot{}, readError
		}

		snapshot.Services[serviceName] = serviceState
	}

	return snapshot, nil
}

// readServiceState decodes one service marker when present.
//
// The marker schema is intentionally small so placeholder and production services can
// share status reporting during incremental implementation.
func readServiceState(runtimeDirectory string, serviceName string) (ServiceState, error) {
	markerPath := filepath.Join(runtimeDirectory, "services", serviceName+".ready")
	content, err := os.ReadFile(markerPath)
	if errors.Is(err, os.ErrNotExist) {
		return ServiceState{Ready: false}, nil
	}

	if err != nil {
		return ServiceState{}, fmt.Errorf("read %s readiness: %w", serviceName, err)
	}

	var record struct {
		Phase string `json:"phase"`
	}
	if err := json.Unmarshal(content, &record); err != nil {
		return ServiceState{}, fmt.Errorf("decode %s readiness: %w", serviceName, err)
	}

	return ServiceState{
		Ready: true,
		Phase: record.Phase,
	}, nil
}

// ReadTransmissionDaemonState reads one connection's runner lifecycle file.
//
// The caller supplies the durable connection ID, which is also checked against the
// document so a stale or misplaced state file cannot be attributed incorrectly.
//
// Since: 2.0.0
func ReadTransmissionDaemonState(
	runtimeDirectory string,
	connectionID string,
) (TransmissionDaemonState, error) {
	path := filepath.Join(runtimeDirectory, "transmission-state", connectionID+".json")
	content, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return TransmissionDaemonState{
			ConnectionID: connectionID,
			State:        "missing",
		}, nil
	}
	if err != nil {
		return TransmissionDaemonState{}, fmt.Errorf("read Transmission daemon state: %w", err)
	}

	var state TransmissionDaemonState
	if err := json.Unmarshal(content, &state); err != nil {
		return TransmissionDaemonState{}, fmt.Errorf("decode Transmission daemon state: %w", err)
	}
	if state.ConnectionID != connectionID {
		return TransmissionDaemonState{}, errors.New("Transmission daemon state connection does not match its file")
	}
	if state.State != "starting" && state.State != "ready" && state.State != "exited" {
		return TransmissionDaemonState{}, fmt.Errorf("Transmission daemon state %q is invalid", state.State)
	}

	return state, nil
}

// ReadVPNStatuses reads every E2 per-connection controller status projection.
//
// Atomic writers make each file independently safe to decode; the stable slot order
// matches storage and daemon list ordering in live API snapshots.
//
// Since: 2.0.0
func ReadVPNStatuses(runtimeDirectory string) ([]controller.Status, error) {
	directory := filepath.Join(runtimeDirectory, "vpn.status.d")
	entries, err := os.ReadDir(directory)
	if errors.Is(err, os.ErrNotExist) {
		return []controller.Status{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("list VPN connection statuses: %w", err)
	}

	statuses := make([]controller.Status, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		content, readError := os.ReadFile(filepath.Join(directory, entry.Name()))
		if readError != nil {
			return nil, fmt.Errorf("read VPN connection status %q: %w", entry.Name(), readError)
		}
		var status controller.Status
		if decodeError := json.Unmarshal(content, &status); decodeError != nil {
			return nil, fmt.Errorf("decode VPN connection status %q: %w", entry.Name(), decodeError)
		}
		if status.ConnectionID == "" || entry.Name() != status.ConnectionID+".json" {
			return nil, fmt.Errorf("VPN connection status %q has a mismatched identifier", entry.Name())
		}
		if status.DNSServers == nil {
			status.DNSServers = []string{}
		}
		statuses = append(statuses, status)
	}
	sort.Slice(statuses, func(left int, right int) bool {
		return statuses[left].Slot < statuses[right].Slot
	})

	return statuses, nil
}
