package api

import (
	"context"
	"net/http"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/controller"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/runtimeinfo"
)

// handleLiveness verifies the control store and fail-closed runtime boundary.
//
// A setup-required or reconnecting appliance stays live when its firewall is safely
// blocking traffic; liveness does not claim that downloads are ready.
func (server *Server) handleLiveness(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	checkContext, cancel := context.WithTimeout(request.Context(), 2*time.Second)
	defer cancel()

	if err := server.store.Ping(checkContext); err != nil {
		server.logInternalError("control database liveness failed", err)
		writeJSON(responseWriter, http.StatusServiceUnavailable, map[string]any{
			"status": "unhealthy",
		})

		return
	}

	runtimeSnapshot, err := runtimeinfo.ReadSnapshot(server.runtimeDirectory)
	if err != nil || !runtimeSnapshot.ConfigurationReady || !runtimeSnapshot.Firewall.Ready {
		if err != nil {
			server.logInternalError("runtime liveness failed", err)
		}
		writeJSON(responseWriter, http.StatusServiceUnavailable, map[string]any{
			"status": "unhealthy",
		})

		return
	}

	writeJSON(responseWriter, http.StatusOK, map[string]any{
		"status": "live",
	})
}

// handleReadiness reports whether Transmission may perform protected work.
//
// Readiness remains unavailable through setup and blocked reconnect states even though
// the control plane itself is live and reachable.
func (server *Server) handleReadiness(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	status, err := server.buildStatus(request.Context())
	if err != nil {
		server.logInternalError("build readiness status", err)
		writeJSON(responseWriter, http.StatusServiceUnavailable, map[string]any{
			"status": "unavailable",
		})

		return
	}

	statusCode := http.StatusOK
	readiness := "ready"
	defaultReady := false
	defaultProtected := false
	for _, connection := range status.Connections {
		if connection.Default {
			defaultReady = connection.Daemon.State == "ready"
			defaultProtected = connection.State == "protected"

			break
		}
	}
	if !defaultProtected || !defaultReady {
		statusCode = http.StatusServiceUnavailable
		readiness = "not-ready"
	}

	writeJSON(responseWriter, statusCode, map[string]any{
		"status":          readiness,
		"protectionState": status.ProtectionState,
	})
}

// applianceStatus combines configuration, schema, claim, and supervised state.
//
// This normalized contract is the stable status input for the first-party UI and external
// diagnostics, independent of provider-specific process details.
type applianceStatus struct {
	Version               string                 `json:"version"`
	SchemaVersion         int                    `json:"schemaVersion"`
	ConfigurationRevision int64                  `json:"configurationRevision"`
	Claimed               bool                   `json:"claimed"`
	ProtectionState       string                 `json:"protectionState"`
	Protection            protectionStatus       `json:"protection"`
	Connections           []liveConnectionStatus `json:"connections"`
	Runtime               runtimeinfo.Snapshot   `json:"runtime"`
}

// protectionStatus summarizes enabled connection safety for the console.
type protectionStatus struct {
	State          string `json:"state"`
	ProtectedCount int    `json:"protectedCount"`
	EnabledCount   int    `json:"enabledCount"`
}

// liveConnectionStatus joins durable identity, controller runtime, and daemon state.
type liveConnectionStatus struct {
	Status           controller.Status `json:"-"`
	ConnectionID     string            `json:"connectionId"`
	Name             string            `json:"name"`
	Default          bool              `json:"default"`
	Enabled          bool              `json:"enabled"`
	State            string            `json:"state"`
	ProviderID       string            `json:"providerId,omitempty"`
	Tunnel           string            `json:"tunnel,omitempty"`
	ProfileID        string            `json:"profileId,omitempty"`
	EndpointPosition int               `json:"endpointPosition,omitempty"`
	EndpointCount    int               `json:"endpointCount,omitempty"`
	EndpointStrategy string            `json:"endpointStrategy,omitempty"`
	Interface        string            `json:"interface,omitempty"`
	Implementation   string            `json:"implementation,omitempty"`
	RemoteHost       string            `json:"remoteHost,omitempty"`
	RemotePort       int               `json:"remotePort,omitempty"`
	Address          string            `json:"address"`
	LastHandshakeAt  *time.Time        `json:"lastHandshakeAt,omitempty"`
	Attempt          int               `json:"attempt"`
	LastError        string            `json:"lastError,omitempty"`
	TransitionedAt   time.Time         `json:"transitionedAt"`
	Daemon           liveDaemonStatus  `json:"daemon"`
}

// liveDaemonStatus is the public subset of the runner-owned state document.
type liveDaemonStatus struct {
	State       string `json:"state"`
	RPCPort     int    `json:"rpcPort"`
	BindAddress string `json:"bindAddress"`
	PeerPort    int    `json:"peerPort"`
}

// handleStatus returns authenticated normalized appliance state.
//
// Provider identity, endpoint failures, and Transmission details can extend this
// versioned envelope without exposing raw lifecycle files to clients.
func (server *Server) handleStatus(responseWriter http.ResponseWriter, request *http.Request) {
	status, err := server.buildStatus(request.Context())
	if err != nil {
		server.logInternalError("build appliance status", err)
		writeError(responseWriter, http.StatusInternalServerError, "status_unavailable", "Appliance status is unavailable.")

		return
	}

	writeJSON(responseWriter, http.StatusOK, status)
}

// buildStatus resolves the initial protection state from authoritative components.
//
// The controller will later publish connecting and protected transitions; until then,
// a configured but unverified tunnel is safely represented as blocked.
func (server *Server) buildStatus(ctx context.Context) (applianceStatus, error) {
	schemaVersion, err := server.store.SchemaVersion(ctx)
	if err != nil {
		return applianceStatus{}, err
	}

	configurationRevision, err := server.store.CurrentConfigurationRevision(ctx)
	if err != nil {
		return applianceStatus{}, err
	}

	claimed, err := server.store.IsClaimed(ctx)
	if err != nil {
		return applianceStatus{}, err
	}

	runtimeSnapshot, err := runtimeinfo.ReadSnapshot(server.runtimeDirectory)
	if err != nil {
		return applianceStatus{}, err
	}

	connections, err := server.store.ListVPNConnections(ctx)
	if err != nil {
		return applianceStatus{}, err
	}
	runtimeStatuses, err := runtimeinfo.ReadVPNStatuses(server.runtimeDirectory)
	if err != nil {
		return applianceStatus{}, err
	}
	statusByConnection := make(map[string]controller.Status, len(runtimeStatuses))
	for _, status := range runtimeStatuses {
		statusByConnection[status.ConnectionID] = status
	}

	liveConnections := make([]liveConnectionStatus, 0, len(connections))
	protectedCount := 0
	enabledCount := 0
	for _, connection := range connections {
		status, found := statusByConnection[connection.ID]
		if !found {
			status = controller.Status{
				ConnectionID: connection.ID,
				Slot:         connection.Slot,
				Default:      connection.IsDefault,
				State:        "blocked",
				Address:      "",
				DNSServers:   []string{},
			}
		}
		status.ConnectionID = connection.ID
		status.Slot = connection.Slot
		status.Default = connection.IsDefault
		if status.DNSServers == nil {
			status.DNSServers = []string{}
		}

		daemonState, daemonError := runtimeinfo.ReadTransmissionDaemonState(
			server.runtimeDirectory,
			connection.ID,
		)
		if daemonError != nil {
			return applianceStatus{}, daemonError
		}
		if daemonState.State == "missing" {
			daemonState.RPCPort = 9092 + connection.Slot
			daemonState.BindAddress = "127.0.0.1"
			daemonState.PeerPort = connection.PeerPort
		}

		liveConnections = append(liveConnections, liveConnectionStatus{
			Status:           status,
			ConnectionID:     connection.ID,
			Name:             connection.Name,
			Default:          connection.IsDefault,
			Enabled:          connection.Enabled,
			State:            status.State,
			ProviderID:       status.ProviderID,
			Tunnel:           status.Tunnel,
			ProfileID:        status.ProfileID,
			EndpointPosition: status.EndpointPosition,
			EndpointCount:    status.EndpointCount,
			EndpointStrategy: status.EndpointStrategy,
			Interface:        status.Interface,
			Implementation:   status.Implementation,
			RemoteHost:       status.RemoteHost,
			RemotePort:       status.RemotePort,
			Address:          status.Address,
			LastHandshakeAt:  status.LastHandshakeAt,
			Attempt:          status.Attempt,
			LastError:        status.LastError,
			TransitionedAt:   status.TransitionedAt,
			Daemon: liveDaemonStatus{
				State:       daemonState.State,
				RPCPort:     daemonState.RPCPort,
				BindAddress: daemonState.BindAddress,
				PeerPort:    daemonState.PeerPort,
			},
		})
		if connection.Enabled {
			enabledCount++
			if status.State == "protected" {
				protectedCount++
			}
		}
	}

	protectionState := "blocked"
	setupRequired := len(connections) == 0
	for _, connection := range connections {
		if connection.IsDefault && (len(connection.ProfileIDs) == 0 ||
			len(connection.CredentialsNonce) == 0 ||
			len(connection.CredentialsCiphertext) == 0) {
			setupRequired = true

			break
		}
	}
	switch {
	case !claimed || setupRequired:
		protectionState = "setup-required"
	case !runtimeSnapshot.Firewall.Ready:
		protectionState = "error"
	case enabledCount > 0 && protectedCount == enabledCount:
		protectionState = "protected"
	case protectedCount > 0:
		protectionState = "partial"
	default:
		protectionState = "blocked"
	}
	protection := protectionStatus{
		State:          protectionState,
		ProtectedCount: protectedCount,
		EnabledCount:   enabledCount,
	}

	return applianceStatus{
		Version:               server.version,
		SchemaVersion:         schemaVersion,
		ConfigurationRevision: configurationRevision,
		Claimed:               claimed,
		ProtectionState:       protectionState,
		Protection:            protection,
		Connections:           liveConnections,
		Runtime:               runtimeSnapshot,
	}, nil
}
