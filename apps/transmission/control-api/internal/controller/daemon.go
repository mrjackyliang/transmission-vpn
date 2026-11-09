package controller

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math/rand"
	"net"
	"net/netip"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/provider"
)

// socketExchangeTimeout bounds reading one request and writing its response. The
// command in between runs under its own limits.
const socketExchangeTimeout = 15 * time.Second

// protectedResolverHeader marks resolver content owned by the default connection.
const protectedResolverHeader = "# Protected DNS from the transmission-vpn VPN controller\n"

// bootstrapResolverFile is the durable runtime copy of the container resolver.
const bootstrapResolverFile = "bootstrap-resolv.conf"

var (
	// errReplaced ends one connection's older command when a newer command arrives.
	errReplaced = errors.New("a newer VPN command replaced this one")

	// errConnectDeadline ends a bounded candidate-pool attempt.
	errConnectDeadline = errors.New("the VPN connect time limit passed")
)

// DaemonConfig defines privileged executable and runtime paths.
//
// Production uses fixed image paths, while tests provide harmless fakes without
// expanding the deployment configuration surface.
type DaemonConfig struct {
	SocketPath              string
	RuntimeDirectory        string
	OpenVPNPath             string
	WireGuardPath           string
	WireGuardGoPath         string
	WireGuardImplementation string
	IPPath                  string
	FirewallBlockPath       string
	FirewallProtectPath     string
	ResolverPath            string
	ControlGroup            string
	ConnectTimeout          time.Duration
	Logger                  *slog.Logger
}

// connectionState owns one connection's desired configuration and command ordering.
//
// Its operation lock may be held through tunnel startup without delaying commands for
// another connection. Attempt cancellation and newest-wins are local to this value.
type connectionState struct {
	id             string
	slot           int
	operationMutex sync.Mutex
	stateMutex     sync.RWMutex
	attemptMutex   sync.Mutex
	latestArrival  uint64
	generation     uint64
	cancelAttempt  context.CancelCauseFunc
	desired        *Connection
	session        tunnelSession
	status         Status
}

// Daemon owns every privileged tunnel while keeping long operations independent.
//
// The shared mutex covers only resolver and firewall artifacts. Connection-local
// locks protect sessions, status, generations, and attempt cancellation.
type Daemon struct {
	config           DaemonConfig
	driverFactory    func(tunnel string, slot int) tunnelDriver
	verify           func(ctx context.Context, interfaceName string, address string, dnsServers []string, verifyResolverPins bool) error
	runIP            func(ctx context.Context, arguments ...string) ([]byte, error)
	connectDeadline  time.Duration
	connectionsMutex sync.RWMutex
	connections      map[string]*connectionState
	latestArrivals   map[string]uint64
	defaultMutex     sync.Mutex
	defaultID        string
	latestDefault    uint64
	projectionMutex  sync.Mutex
	sharedMutex      sync.Mutex
	arrivals         atomic.Uint64
	originalDNS      []byte
}

// NewDaemon validates dependencies and captures bootstrap resolver state.
func NewDaemon(config DaemonConfig) (*Daemon, error) {
	if config.SocketPath == "" || config.RuntimeDirectory == "" ||
		config.OpenVPNPath == "" || config.WireGuardPath == "" || config.WireGuardGoPath == "" ||
		config.IPPath == "" || config.FirewallBlockPath == "" || config.FirewallProtectPath == "" ||
		config.ResolverPath == "" || config.ControlGroup == "" {
		return nil, errors.New("VPN controller paths and control group are required")
	}

	if config.WireGuardImplementation == "" {
		config.WireGuardImplementation = "auto"
	}
	if config.WireGuardImplementation != "auto" &&
		config.WireGuardImplementation != wireGuardImplementationKernel &&
		config.WireGuardImplementation != wireGuardImplementationUserspace {
		return nil, errors.New("the WireGuard implementation must be auto, kernel, or userspace")
	}
	if config.ConnectTimeout <= 0 {
		config.ConnectTimeout = 60 * time.Second
	}
	if config.Logger == nil {
		config.Logger = slog.Default()
	}

	originalDNS, err := loadBootstrapResolver(config)
	if err != nil {
		return nil, err
	}

	daemon := &Daemon{
		config:          config,
		connectDeadline: maximumConnectDuration,
		connections:     map[string]*connectionState{},
		latestArrivals:  map[string]uint64{},
		originalDNS:     originalDNS,
	}
	daemon.driverFactory = func(tunnel string, slot int) tunnelDriver {
		if tunnel == provider.TunnelWireGuard {
			return newWireGuardDriver(config, bootstrapNameservers(originalDNS), slot)
		}

		return newOpenVPNDriver(config, bootstrapNameservers(originalDNS), slot)
	}
	daemon.runIP = func(ctx context.Context, arguments ...string) ([]byte, error) {
		return exec.CommandContext(ctx, config.IPPath, arguments...).CombinedOutput()
	}
	daemon.verify = daemon.verifyTunnel

	return daemon, nil
}

// Serve listens for typed local commands until ctx is canceled.
func (daemon *Daemon) Serve(ctx context.Context) error {
	if err := daemon.prepareRuntimeDirectory(); err != nil {
		return err
	}
	if err := daemon.saveBootstrapResolver(); err != nil {
		daemon.config.Logger.Warn("save a copy of the bootstrap resolver", "error", err)
	}
	if err := daemon.prepareNetwork(ctx); err != nil {
		return err
	}
	daemon.config.Logger.Info("VPN controller blocked all VPN egress at startup")
	if err := daemon.resetRuntimeStatuses(); err != nil {
		return err
	}
	if err := daemon.clearDefaultDNS(); err != nil {
		daemon.config.Logger.Warn("restore the bootstrap resolver", "error", err)
	}

	_ = os.Remove(daemon.config.SocketPath)
	listener, err := net.Listen("unix", daemon.config.SocketPath)
	if err != nil {
		return fmt.Errorf("listen on VPN controller socket: %w", err)
	}
	defer listener.Close()
	defer os.Remove(daemon.config.SocketPath)

	if err := daemon.setSocketPermissions(); err != nil {
		return err
	}

	markerPath := filepath.Join(daemon.config.RuntimeDirectory, "services", "vpn-controller.ready")
	if err := writeAtomicJSON(markerPath, 0o644, map[string]any{
		"service": "vpn-controller",
		"phase":   "controller",
	}); err != nil {
		return err
	}
	defer os.Remove(markerPath)

	acceptErrors := make(chan error, 1)
	go func() {
		for {
			connection, acceptError := listener.Accept()
			if acceptError != nil {
				acceptErrors <- acceptError

				return
			}

			go daemon.handleSocketConnection(connection, daemon.arrivals.Add(1))
		}
	}()

	select {
	case <-ctx.Done():
		_ = listener.Close()
	case acceptError := <-acceptErrors:
		if !errors.Is(acceptError, net.ErrClosed) {
			return fmt.Errorf("accept VPN controller command: %w", acceptError)
		}
	}

	return daemon.shutdown()
}

// prepareNetwork installs permanent slot policy before removing stale sessions.
func (daemon *Daemon) prepareNetwork(ctx context.Context) error {
	for slot := minimumConnectionSlot; slot <= maximumConnectionSlot; slot++ {
		if err := installPermanentSlotRouting(
			ctx,
			func(
				commandContext context.Context,
				_ string,
				arguments ...string,
			) ([]byte, error) {
				return daemon.runIP(commandContext, arguments...)
			},
			daemon.config.IPPath,
			slot,
		); err != nil {
			return err
		}
	}

	var cleanupErrors []error
	for slot := minimumConnectionSlot; slot <= maximumConnectionSlot; slot++ {
		for _, tunnel := range tunnelOrder {
			if err := daemon.driverFactory(tunnel, slot).CleanupStale(ctx); err != nil {
				daemon.config.Logger.Warn(
					"remove stale VPN connection state",
					"slot",
					slot,
					"tunnel",
					tunnel,
					"error",
					err,
				)
				cleanupErrors = append(cleanupErrors, fmt.Errorf(
					"clean stale VPN slot %d %s state: %w",
					slot,
					tunnel,
					err,
				))
			}
		}
	}
	if err := errors.Join(cleanupErrors...); err != nil {
		return err
	}
	if err := daemon.blockAll("controller-startup"); err != nil {
		return err
	}

	return nil
}

// Status returns every known connection in stable slot order.
func (daemon *Daemon) Status() []Status {
	daemon.connectionsMutex.RLock()
	states := make([]*connectionState, 0, len(daemon.connections))
	for _, state := range daemon.connections {
		states = append(states, state)
	}
	daemon.connectionsMutex.RUnlock()

	statuses := make([]Status, 0, len(states))
	for _, state := range states {
		statuses = append(statuses, state.statusSnapshot())
	}
	sort.Slice(statuses, func(left int, right int) bool {
		if statuses[left].Slot == statuses[right].Slot {
			return statuses[left].ConnectionID < statuses[right].ConnectionID
		}

		return statuses[left].Slot < statuses[right].Slot
	})

	return statuses
}

// statusSnapshot returns status plus details from a protected live session.
func (state *connectionState) statusSnapshot() Status {
	state.stateMutex.RLock()
	defer state.stateMutex.RUnlock()

	status := state.status
	status.DNSServers = append([]string{},status.DNSServers...)
	if status.State == "protected" && state.session == nil {
		status.Interface = ""
		status.Address = ""
		status.Implementation = ""
		status.LastHandshakeAt = nil
	} else if state.session != nil && status.State == "protected" {
		details := state.session.Details()
		status.Implementation = details.Implementation
		if !details.LastHandshakeAt.IsZero() {
			lastHandshakeAt := details.LastHandshakeAt.UTC()
			status.LastHandshakeAt = &lastHandshakeAt
		}
	}

	return status
}

// Connect verifies and activates one connection independently from every other one.
func (daemon *Daemon) Connect(
	connectionID string,
	slot int,
	isDefault bool,
	connection Connection,
) (Status, error) {
	return daemon.connect(
		connectionID,
		slot,
		isDefault,
		connection,
		daemon.arrivals.Add(1),
		daemon.connectDeadline,
	)
}

// connect runs one connection-local command in its accepted arrival position.
func (daemon *Daemon) connect(
	connectionID string,
	slot int,
	isDefault bool,
	connection Connection,
	arrival uint64,
	limit time.Duration,
) (Status, error) {
	if err := validateConnectionIdentity(connectionID, slot); err != nil {
		return Status{}, err
	}
	if err := validateConnection(connection); err != nil {
		return Status{}, err
	}

	state, created, generation, err := daemon.claimConnectionState(
		connectionID,
		slot,
		arrival,
	)
	if err != nil {
		return Status{}, err
	}

	state.operationMutex.Lock()
	defer state.operationMutex.Unlock()
	if !state.isCurrent(generation) {
		return state.statusSnapshot(), errReplaced
	}
	if isDefault {
		if _, err := daemon.setDefault(connectionID, arrival); err != nil {
			if created {
				daemon.removeConnectionStateIfCurrent(state, generation)
			}

			return state.statusSnapshot(), err
		}
	}

	if err := daemon.stopLocked(state, "configuration-change"); err != nil {
		status := blockedStatus(state.statusSnapshot(), err)
		transitionError := daemon.transition(state, status)

		return state.statusSnapshot(), errors.Join(err, transitionError)
	}

	connectionCopy := connection
	state.desired = &connectionCopy
	if err := daemon.transition(state, connectionStatus(
		state,
		connection,
		connection.Endpoints[0],
		0,
		"connecting",
		1,
		"",
		nil,
		"",
	)); err != nil {
		state.desired = nil

		return state.statusSnapshot(), err
	}

	attemptContext, endAttempt := state.beginAttempt(generation, limit)
	session, endpointIndex, dnsServers, err := daemon.establishPoolLocked(
		attemptContext,
		state,
		connection,
		-1,
		false,
		1,
	)
	endAttempt()
	if err != nil {
		state.desired = nil
		if !errors.Is(err, errReplaced) {
			_ = daemon.transition(state, connectionStatus(
				state,
				connection,
				connection.Endpoints[0],
				0,
				"blocked",
				1,
				err.Error(),
				nil,
				"",
			))
		}

		return state.statusSnapshot(), err
	}

	state.setSession(session)
	if err := daemon.transition(state, connectionStatus(
		state,
		connection,
		connection.Endpoints[endpointIndex],
		endpointIndex,
		"protected",
		1,
		"",
		dnsServers,
		session.Address(),
	)); err != nil {
		stopError := daemon.stopLocked(state, "status-failure")
		if stopError == nil {
			state.desired = nil
		}
		combinedError := errors.Join(err, stopError)
		transitionError := daemon.transition(
			state,
			blockedStatus(state.statusSnapshot(), combinedError),
		)

		return state.statusSnapshot(), errors.Join(combinedError, transitionError)
	}
	if err := daemon.reconcileDefaultDNS(state); err != nil {
		stopError := daemon.stopLocked(state, "resolver-failure")
		if stopError == nil {
			state.desired = nil
		}
		combinedError := errors.Join(err, stopError)
		transitionError := daemon.transition(
			state,
			blockedStatus(state.statusSnapshot(), combinedError),
		)

		return state.statusSnapshot(), errors.Join(combinedError, transitionError)
	}

	go daemon.monitor(state, generation, connection, session, endpointIndex, 1)

	return state.statusSnapshot(), nil
}

// Disconnect blocks and forgets only the named connection.
func (daemon *Daemon) Disconnect(connectionID string, reason string) (Status, error) {
	return daemon.disconnect(connectionID, reason, daemon.arrivals.Add(1))
}

// disconnect applies one connection-local blocked transition before forgetting it.
func (daemon *Daemon) disconnect(
	connectionID string,
	reason string,
	arrival uint64,
) (Status, error) {
	if !validConnectionID(connectionID) {
		return Status{}, errors.New("the VPN connection identifier is invalid")
	}
	state, generation, found, err := daemon.claimExistingConnectionState(
		connectionID,
		arrival,
	)
	if err != nil {
		return Status{}, err
	}
	if !found {
		return Status{
			ConnectionID:   connectionID,
			State:          "blocked",
			DNSServers:     []string{},
			TransitionedAt: time.Now().UTC(),
		}, nil
	}

	state.operationMutex.Lock()
	defer state.operationMutex.Unlock()
	if !state.isCurrent(generation) {
		return state.statusSnapshot(), errReplaced
	}

	stopError := daemon.stopLocked(state, reason)
	if stopError == nil {
		state.desired = nil
	}
	if !state.isCurrent(generation) {
		return state.statusSnapshot(), errReplaced
	}
	status := blockedStatus(state.statusSnapshot(), stopError)
	if err := daemon.transition(state, status); err != nil {
		return state.statusSnapshot(), errors.Join(stopError, err)
	}
	status = state.statusSnapshot()
	if stopError != nil {
		return status, stopError
	}

	if !daemon.forgetConnectionIfCurrent(state, generation) {
		return state.statusSnapshot(), errReplaced
	}

	return status, nil
}

// blockedStatus clears live session fields and records a teardown failure.
func blockedStatus(status Status, stopError error) Status {
	status.State = "blocked"
	status.Interface = ""
	status.Address = ""
	status.DNSServers = []string{}
	status.Implementation = ""
	status.LastHandshakeAt = nil
	status.LastError = ""
	if stopError != nil {
		status.LastError = stopError.Error()
	}

	return status
}

// SetDefault moves resolver ownership without stopping any tunnel.
func (daemon *Daemon) SetDefault(connectionID string) (Status, error) {
	if !validConnectionID(connectionID) {
		return Status{}, errors.New("the VPN connection identifier is invalid")
	}

	return daemon.setDefault(connectionID, daemon.arrivals.Add(1))
}

// shutdown stops every connection before removing the global firewall projection.
func (daemon *Daemon) shutdown() error {
	daemon.connectionsMutex.RLock()
	connectionIDs := make([]string, 0, len(daemon.connections))
	for connectionID := range daemon.connections {
		connectionIDs = append(connectionIDs, connectionID)
	}
	daemon.connectionsMutex.RUnlock()
	sort.Strings(connectionIDs)

	var shutdownErrors []error
	for _, connectionID := range connectionIDs {
		if _, err := daemon.disconnect(connectionID, "controller-shutdown", daemon.arrivals.Add(1)); err != nil {
			shutdownErrors = append(shutdownErrors, err)
		}
	}
	if err := daemon.blockAll("controller-shutdown"); err != nil {
		shutdownErrors = append(shutdownErrors, err)
	}
	if err := daemon.clearDefaultDNS(); err != nil {
		shutdownErrors = append(shutdownErrors, err)
	}

	return errors.Join(shutdownErrors...)
}

// handleSocketConnection decodes one bounded command and writes one response.
func (daemon *Daemon) handleSocketConnection(connection net.Conn, arrival uint64) {
	defer connection.Close()
	_ = connection.SetReadDeadline(time.Now().Add(socketExchangeTimeout))

	limitedReader := io.LimitReader(connection, maximumControllerMessageBytes+1)
	bufferedReader := bufio.NewReaderSize(limitedReader, 64*1024)
	payload, err := bufferedReader.ReadBytes('\n')
	if err != nil && !errors.Is(err, io.EOF) {
		daemon.writeSocketResponse(connection, Response{OK: false, Error: "The VPN controller command is invalid."})

		return
	}
	if len(payload) == 0 || len(payload) > maximumControllerMessageBytes {
		daemon.writeSocketResponse(connection, Response{OK: false, Error: "The VPN controller command exceeds the size limit."})

		return
	}

	decoder := json.NewDecoder(bytes.NewReader(payload))
	decoder.DisallowUnknownFields()
	var request Request
	if err := decoder.Decode(&request); err != nil {
		daemon.writeSocketResponse(connection, Response{OK: false, Error: "The VPN controller command is invalid."})

		return
	}
	var trailingValue any
	if err := decoder.Decode(&trailingValue); !errors.Is(err, io.EOF) {
		daemon.writeSocketResponse(connection, Response{OK: false, Error: "The VPN controller command contains trailing data."})

		return
	}
	if request.Version != ProtocolVersion {
		daemon.writeSocketResponse(connection, Response{OK: false, Error: "The VPN controller protocol version is unsupported."})

		return
	}

	response := Response{OK: true}
	var commandError error
	switch request.Action {
	case "status":
		response.Statuses = daemon.Status()
	case "connect", "restore":
		if request.Connection == nil {
			commandError = errors.New("a connection candidate is required")

			break
		}
		limit := daemon.connectDeadline
		if request.Action == "restore" {
			limit = 0
		}
		status, err := daemon.connect(
			request.ConnectionID,
			request.Slot,
			request.Default,
			*request.Connection,
			arrival,
			limit,
		)
		response.Status = &status
		commandError = err
	case "disconnect":
		status, err := daemon.disconnect(request.ConnectionID, "administrator-request", arrival)
		response.Status = &status
		commandError = err
	case "set-default":
		if !validConnectionID(request.ConnectionID) {
			commandError = errors.New("the VPN connection identifier is invalid")

			break
		}
		status, err := daemon.setDefault(request.ConnectionID, arrival)
		response.Status = &status
		commandError = err
	default:
		commandError = errors.New("the VPN controller action is unsupported")
	}
	if commandError != nil {
		response.OK = false
		response.Error = commandError.Error()
	}

	daemon.writeSocketResponse(connection, response)
}

// writeSocketResponse serializes one bounded response to a local client.
func (daemon *Daemon) writeSocketResponse(connection net.Conn, response Response) {
	_ = connection.SetWriteDeadline(time.Now().Add(socketExchangeTimeout))
	if err := json.NewEncoder(connection).Encode(response); err != nil {
		daemon.config.Logger.Warn("write VPN controller response", "error", err)
	}
}

// prepareRuntimeDirectory creates shared roots without preallocating every slot.
func (daemon *Daemon) prepareRuntimeDirectory() error {
	paths := []struct {
		path        string
		permissions os.FileMode
	}{
		{path: filepath.Join(daemon.config.RuntimeDirectory, provider.TunnelOpenVPN), permissions: 0o700},
		{path: filepath.Join(daemon.config.RuntimeDirectory, provider.TunnelWireGuard), permissions: 0o700},
		{path: filepath.Join(daemon.config.RuntimeDirectory, "vpn.status.d"), permissions: 0o755},
	}
	for _, path := range paths {
		if err := os.MkdirAll(path.path, path.permissions); err != nil {
			return fmt.Errorf("create VPN controller runtime directory: %w", err)
		}
		if err := os.Chmod(path.path, path.permissions); err != nil {
			return fmt.Errorf("set VPN controller runtime permissions: %w", err)
		}
	}

	return nil
}

// claimConnectionState returns or creates and claims a state atomically.
//
// Holding the map lock through claim prevents a disconnect from forgetting a state
// after a newer command has selected it but before that command advances its
// generation.
func (daemon *Daemon) claimConnectionState(
	connectionID string,
	slot int,
	arrival uint64,
) (*connectionState, bool, uint64, error) {
	daemon.connectionsMutex.Lock()
	defer daemon.connectionsMutex.Unlock()
	if arrival < daemon.latestArrivals[connectionID] {
		return nil, false, 0, errReplaced
	}
	daemon.latestArrivals[connectionID] = arrival
	if state, found := daemon.connections[connectionID]; found {
		if state.slot != slot {
			return nil, false, 0, errors.New("the VPN connection slot changed")
		}

		generation, err := state.claim(arrival)

		return state, false, generation, err
	}
	for _, state := range daemon.connections {
		if state.slot == slot {
			return nil, false, 0, fmt.Errorf("VPN connection slot %d is already active", slot)
		}
	}

	state := &connectionState{
		id:     connectionID,
		slot:   slot,
		status: newStatus(connectionID, slot, "blocked"),
	}
	daemon.connections[connectionID] = state
	generation, err := state.claim(arrival)
	if err != nil {
		delete(daemon.connections, connectionID)

		return nil, false, 0, err
	}

	return state, true, generation, nil
}

// claimExistingConnectionState finds and claims a named state atomically.
func (daemon *Daemon) claimExistingConnectionState(
	connectionID string,
	arrival uint64,
) (*connectionState, uint64, bool, error) {
	daemon.connectionsMutex.Lock()
	defer daemon.connectionsMutex.Unlock()
	if arrival < daemon.latestArrivals[connectionID] {
		return nil, 0, false, errReplaced
	}
	daemon.latestArrivals[connectionID] = arrival

	state, found := daemon.connections[connectionID]
	if !found {
		return nil, 0, false, nil
	}
	generation, err := state.claim(arrival)

	return state, generation, true, err
}

// lookupConnectionState reads one named connection without holding its operation lock.
func (daemon *Daemon) lookupConnectionState(connectionID string) (*connectionState, bool) {
	daemon.connectionsMutex.RLock()
	defer daemon.connectionsMutex.RUnlock()

	state, found := daemon.connections[connectionID]

	return state, found
}

// removeConnectionStateIfCurrent removes an unused state unless a newer command owns it.
func (daemon *Daemon) removeConnectionStateIfCurrent(
	state *connectionState,
	generation uint64,
) bool {
	daemon.connectionsMutex.Lock()
	defer daemon.connectionsMutex.Unlock()

	state.attemptMutex.Lock()
	defer state.attemptMutex.Unlock()
	if daemon.connections[state.id] != state || state.generation != generation {
		return false
	}
	delete(daemon.connections, state.id)

	return true
}

// forgetConnectionIfCurrent removes a disconnected state file and map entry.
func (daemon *Daemon) forgetConnectionIfCurrent(
	state *connectionState,
	generation uint64,
) bool {
	if !daemon.removeConnectionStateIfCurrent(state, generation) {
		return false
	}
	_ = os.Remove(daemon.connectionStatusPath(state.id))

	daemon.defaultMutex.Lock()
	if daemon.defaultID == state.id {
		daemon.defaultID = ""
	}
	daemon.defaultMutex.Unlock()

	return true
}

// setSession updates the live session visible to status readers.
func (state *connectionState) setSession(session tunnelSession) {
	state.stateMutex.Lock()
	state.session = session
	state.stateMutex.Unlock()
}

// claim advances newest-wins for only this connection.
func (state *connectionState) claim(arrival uint64) (uint64, error) {
	state.attemptMutex.Lock()
	defer state.attemptMutex.Unlock()
	if arrival < state.latestArrival {
		return 0, errReplaced
	}
	state.latestArrival = arrival
	state.generation++
	if state.cancelAttempt != nil {
		state.cancelAttempt(errReplaced)
		state.cancelAttempt = nil
	}

	return state.generation, nil
}

// beginAttempt starts one cancelable pool attempt for this connection.
func (state *connectionState) beginAttempt(
	generation uint64,
	limit time.Duration,
) (context.Context, func()) {
	state.attemptMutex.Lock()
	defer state.attemptMutex.Unlock()

	attemptContext, cancel := context.WithCancelCause(context.Background())
	end := func() { cancel(nil) }
	if limit > 0 {
		var cancelLimit context.CancelFunc
		attemptContext, cancelLimit = context.WithTimeoutCause(attemptContext, limit, errConnectDeadline)
		end = func() {
			cancelLimit()
			cancel(nil)
		}
	}
	if generation != state.generation {
		cancel(errReplaced)
	} else {
		state.cancelAttempt = cancel
	}

	return attemptContext, end
}

// isCurrent reports whether generation still owns this connection.
func (state *connectionState) isCurrent(generation uint64) bool {
	state.attemptMutex.Lock()
	defer state.attemptMutex.Unlock()

	return generation == state.generation
}

// transition records and atomically publishes one connection state.
func (daemon *Daemon) transition(state *connectionState, status Status) error {
	daemon.projectionMutex.Lock()
	defer daemon.projectionMutex.Unlock()

	if err := daemon.ensureStatusDirectories(); err != nil {
		return err
	}
	status.ConnectionID = state.id
	status.Slot = state.slot
	status.TransitionedAt = time.Now().UTC()
	if status.DNSServers == nil {
		status.DNSServers = []string{}
	}

	state.stateMutex.Lock()
	status.Default = state.status.Default
	state.status = status
	state.stateMutex.Unlock()

	if err := writeAtomicJSON(daemon.connectionStatusPath(state.id), 0o644, status); err != nil {
		return fmt.Errorf("write VPN connection status: %w", err)
	}

	daemon.defaultMutex.Lock()
	if daemon.defaultID == state.id {
		status.Default = true
		daemon.sharedMutex.Lock()
		err := writeAtomicJSON(filepath.Join(daemon.config.RuntimeDirectory, "vpn.status"), 0o644, status)
		daemon.sharedMutex.Unlock()
		if err != nil {
			daemon.defaultMutex.Unlock()

			return fmt.Errorf("write default VPN status: %w", err)
		}
	}
	daemon.defaultMutex.Unlock()

	daemon.config.Logger.Info(
		"VPN state changed",
		"connectionId",
		status.ConnectionID,
		"slot",
		status.Slot,
		"state",
		status.State,
		"provider",
		status.ProviderID,
		"tunnel",
		status.Tunnel,
		"profile",
		status.ProfileID,
		"attempt",
		status.Attempt,
		"error",
		status.LastError,
	)

	return nil
}

// ensureStatusDirectories supports direct controller use in tests as well as Serve.
func (daemon *Daemon) ensureStatusDirectories() error {
	if err := os.MkdirAll(filepath.Join(daemon.config.RuntimeDirectory, "vpn.status.d"), 0o755); err != nil {
		return fmt.Errorf("create VPN status directory: %w", err)
	}

	return nil
}

// resetRuntimeStatuses removes crash leftovers before any restored connection starts.
func (daemon *Daemon) resetRuntimeStatuses() error {
	statusDirectory := filepath.Join(daemon.config.RuntimeDirectory, "vpn.status.d")
	if err := os.RemoveAll(statusDirectory); err != nil {
		return fmt.Errorf("remove stale VPN statuses: %w", err)
	}
	if err := daemon.ensureStatusDirectories(); err != nil {
		return err
	}

	daemon.sharedMutex.Lock()
	defer daemon.sharedMutex.Unlock()
	if err := writeAtomicJSON(
		filepath.Join(daemon.config.RuntimeDirectory, "vpn.status"),
		0o644,
		newStatus("", 0, "blocked"),
	); err != nil {
		return fmt.Errorf("write blocked default VPN status: %w", err)
	}

	return nil
}

// connectionStatusPath returns the per-connection atomic status artifact.
func (daemon *Daemon) connectionStatusPath(connectionID string) string {
	return filepath.Join(daemon.config.RuntimeDirectory, "vpn.status.d", connectionID+".json")
}

// loadBootstrapResolver returns the container's own resolver configuration.
func loadBootstrapResolver(config DaemonConfig) ([]byte, error) {
	current, err := os.ReadFile(config.ResolverPath)
	if err != nil {
		return nil, fmt.Errorf("read original resolver configuration: %w", err)
	}
	if validBootstrapResolver(current) {
		return current, nil
	}

	saved, err := os.ReadFile(filepath.Join(config.RuntimeDirectory, bootstrapResolverFile))
	if err != nil {
		config.Logger.Warn("the resolver is incomplete and no bootstrap copy is left", "error", err)

		return current, nil
	}

	return saved, nil
}

// saveBootstrapResolver keeps the original resolver across controller restarts.
func (daemon *Daemon) saveBootstrapResolver() error {
	if !validBootstrapResolver(daemon.originalDNS) {
		return nil
	}

	return writeAtomicFile(
		filepath.Join(daemon.config.RuntimeDirectory, bootstrapResolverFile),
		0o600,
		daemon.originalDNS,
	)
}

// validBootstrapResolver rejects protected or incomplete resolver content.
func validBootstrapResolver(content []byte) bool {
	headerLine := strings.TrimSpace(protectedResolverHeader)
	foundNameserver := false
	for _, line := range strings.Split(string(content), "\n") {
		trimmedLine := strings.TrimSpace(line)
		if trimmedLine == "" {
			continue
		}
		if strings.HasPrefix(trimmedLine, headerLine) {
			return false
		}
		fields := strings.Fields(trimmedLine)
		if len(fields) >= 2 && fields[0] == "nameserver" {
			foundNameserver = true
		}
	}

	return foundNameserver
}

// setSocketPermissions grants only root and the control API group access.
func (daemon *Daemon) setSocketPermissions() error {
	controlGroup, err := user.LookupGroup(daemon.config.ControlGroup)
	if err != nil {
		return fmt.Errorf("find control group: %w", err)
	}
	groupID, err := strconv.Atoi(controlGroup.Gid)
	if err != nil {
		return fmt.Errorf("parse control group identifier: %w", err)
	}
	if err := os.Chown(daemon.config.SocketPath, 0, groupID); err != nil {
		return fmt.Errorf("set VPN controller socket ownership: %w", err)
	}
	if err := os.Chmod(daemon.config.SocketPath, 0o660); err != nil {
		return fmt.Errorf("set VPN controller socket permissions: %w", err)
	}

	return nil
}

// validateConnectionIdentity checks the closed connection and slot namespaces.
func validateConnectionIdentity(connectionID string, slot int) error {
	if !validConnectionID(connectionID) {
		return errors.New("the VPN connection identifier is invalid")
	}
	if slot < minimumConnectionSlot || slot > maximumConnectionSlot {
		return fmt.Errorf("VPN connection slot must be between %d and %d", minimumConnectionSlot, maximumConnectionSlot)
	}

	return nil
}

// validConnectionID accepts exactly vpc- followed by sixteen lowercase hex digits.
func validConnectionID(connectionID string) bool {
	if len(connectionID) != len("vpc-")+16 || !strings.HasPrefix(connectionID, "vpc-") {
		return false
	}
	for _, character := range connectionID[len("vpc-"):] {
		if !((character >= '0' && character <= '9') || (character >= 'a' && character <= 'f')) {
			return false
		}
	}

	return true
}

// validateConnection rechecks normalized profiles and typed configuration.
func validateConnection(connection Connection) error {
	definition, found := provider.DefinitionByID(connection.ProviderID)
	if !found {
		return errors.New("the VPN provider is unsupported")
	}
	tunnel, found := definition.Tunnel(connection.Tunnel)
	if !found {
		return errors.New("the VPN provider does not offer this tunnel")
	}
	if len(connection.Endpoints) == 0 || len(connection.Endpoints) > 128 {
		return errors.New("the VPN endpoint pool must contain between 1 and 128 endpoints")
	}
	if connection.EndpointStrategy != "sticky" && connection.EndpointStrategy != "ordered" &&
		connection.EndpointStrategy != "randomized" {
		return errors.New("the VPN endpoint strategy is invalid")
	}

	seenProfileIDs := make(map[string]struct{}, len(connection.Endpoints))
	totalConfigurationBytes := 0
	for _, endpoint := range connection.Endpoints {
		if endpoint.ProfileID == "" || len(endpoint.ProfileID) > 240 ||
			!strings.HasPrefix(endpoint.ProfileID, connection.ProviderID+":") {
			return errors.New("the VPN profile identifier is invalid")
		}
		if _, duplicate := seenProfileIDs[endpoint.ProfileID]; duplicate {
			return errors.New("the VPN endpoint pool contains duplicates")
		}
		seenProfileIDs[endpoint.ProfileID] = struct{}{}
		totalConfigurationBytes += len(endpoint.Configuration)
		if totalConfigurationBytes > 12*1024*1024 {
			return errors.New("the VPN endpoint pool exceeds the configuration size limit")
		}

		metadata, err := validateEndpointConfiguration(connection.Tunnel, endpoint.Configuration)
		if err != nil {
			return err
		}
		if metadata.RemoteHost != endpoint.RemoteHost || metadata.RemotePort != endpoint.RemotePort {
			return errors.New("the VPN endpoint metadata does not match the profile")
		}
	}
	if err := validateConnectionCredentials(tunnel, connection); err != nil {
		return err
	}
	if len(connection.DNSServers) > 8 {
		return errors.New("no more than eight DNS servers may be configured")
	}
	for _, serverAddress := range connection.DNSServers {
		address, err := netip.ParseAddr(serverAddress)
		if err != nil || !address.Is4() {
			return fmt.Errorf("DNS server is not an IPv4 address: %s", serverAddress)
		}
	}
	if connection.RetryIntervalSeconds < 3 || connection.RetryIntervalSeconds > 600 {
		return errors.New("VPN retry interval must be between 3 and 600 seconds")
	}

	return nil
}

// validateEndpointConfiguration applies the selected tunnel's normalized contract.
func validateEndpointConfiguration(
	tunnel string,
	configuration []byte,
) (provider.NormalizedProfileMetadata, error) {
	if tunnel == provider.TunnelWireGuard {
		metadata, err := provider.ValidateNormalizedWireGuardProfile(configuration)
		if err != nil {
			return provider.NormalizedProfileMetadata{}, fmt.Errorf("the WireGuard configuration is invalid: %w", err)
		}

		return metadata, nil
	}

	metadata, err := provider.ValidateNormalizedOpenVPNProfile(configuration)
	if err != nil {
		return provider.NormalizedProfileMetadata{}, fmt.Errorf("the OpenVPN profile is invalid: %w", err)
	}

	return metadata, nil
}

// validateConnectionCredentials enforces each tunnel's credential shape.
func validateConnectionCredentials(tunnel provider.TunnelDefinition, connection Connection) error {
	if tunnel.ID == provider.TunnelWireGuard {
		if connection.Username != "" || connection.Password != "" {
			return errors.New("a WireGuard connection does not take a username or password")
		}

		return nil
	}

	values := map[string]string{}
	if connection.Username != "" {
		values["username"] = connection.Username
	}
	if connection.Password != "" {
		values["password"] = connection.Password
	}

	return provider.ValidateCredentials(tunnel, values)
}

// newStatus creates a blocked status in one connection namespace.
func newStatus(connectionID string, slot int, state string) Status {
	return Status{
		ConnectionID:   connectionID,
		Slot:           slot,
		State:          state,
		DNSServers:     []string{},
		TransitionedAt: time.Now().UTC(),
	}
}

// connectionStatus creates one secret-free connection transition.
func connectionStatus(
	state *connectionState,
	connection Connection,
	endpoint Endpoint,
	endpointIndex int,
	statusState string,
	attempt int,
	lastError string,
	dnsServers []string,
	address string,
) Status {
	return Status{
		ConnectionID:     state.id,
		Slot:             state.slot,
		State:            statusState,
		ProviderID:       connection.ProviderID,
		Tunnel:           connection.Tunnel,
		ProfileID:        endpoint.ProfileID,
		EndpointPosition: endpointIndex + 1,
		EndpointCount:    len(connection.Endpoints),
		EndpointStrategy: connection.EndpointStrategy,
		Interface:        tunnelInterfaceName(connection.Tunnel, state.slot),
		RemoteHost:       endpoint.RemoteHost,
		RemotePort:       endpoint.RemotePort,
		Address:          address,
		DNSServers:       append([]string{},dnsServers...),
		Attempt:          attempt,
		LastError:        lastError,
	}
}

// candidateIndexes returns failover order without mutating the durable pool.
func candidateIndexes(connection Connection, activeIndex int, reconnect bool) []int {
	endpointCount := len(connection.Endpoints)
	if connection.EndpointStrategy == "randomized" {
		return rand.Perm(endpointCount)
	}

	start := 0
	if reconnect && activeIndex >= 0 {
		start = activeIndex
		if connection.EndpointStrategy == "ordered" {
			start = (activeIndex + 1) % endpointCount
		}
	}

	indexes := make([]int, 0, endpointCount)
	for offset := 0; offset < endpointCount; offset++ {
		indexes = append(indexes, (start+offset)%endpointCount)
	}

	return indexes
}

// writeAtomicJSON publishes a complete runtime JSON artifact.
func writeAtomicJSON(path string, permissions os.FileMode, value any) error {
	temporaryFile, err := os.CreateTemp(filepath.Dir(path), ".state-*")
	if err != nil {
		return fmt.Errorf("create temporary state file: %w", err)
	}
	temporaryPath := temporaryFile.Name()
	committed := false
	defer func() {
		_ = temporaryFile.Close()
		if !committed {
			_ = os.Remove(temporaryPath)
		}
	}()
	if err := temporaryFile.Chmod(permissions); err != nil {
		return fmt.Errorf("set state file permissions: %w", err)
	}
	if err := json.NewEncoder(temporaryFile).Encode(value); err != nil {
		return fmt.Errorf("encode state file: %w", err)
	}
	if err := temporaryFile.Sync(); err != nil {
		return fmt.Errorf("sync state file: %w", err)
	}
	if err := temporaryFile.Close(); err != nil {
		return fmt.Errorf("close state file: %w", err)
	}
	if err := os.Rename(temporaryPath, path); err != nil {
		return fmt.Errorf("publish state file: %w", err)
	}
	committed = true

	return nil
}
