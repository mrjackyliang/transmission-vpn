package controller

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"os"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/provider"
)

const (
	testWireGuardPrivateKey = "yAnz5TF+lXXJte14tji3zlMNq+hd2rYUIgJBgB3fBmk="
	testWireGuardPublicKey  = "xTIBA5rboUvnH4htodjb6e697QjLERt1NAB4mZqp8Dg="
)

// TestControllerSocketStatus verifies that protocol v4 returns a connection list.
func TestControllerSocketStatus(testingObject *testing.T) {
	if os.Geteuid() != 0 {
		testingObject.Skip("needs root to assign the controller socket group")
	}

	daemon := newTestDaemon(testingObject)
	currentUser, err := user.Current()
	if err != nil {
		testingObject.Fatalf("read current user: %v", err)
	}
	currentGroup, err := user.LookupGroupId(currentUser.Gid)
	if err != nil {
		testingObject.Fatalf("read current group: %v", err)
	}
	daemon.config.ControlGroup = currentGroup.Name
	daemon.runIP = func(context.Context, ...string) ([]byte, error) { return nil, nil }
	daemon.driverFactory = func(string, int) tunnelDriver { return inertTunnelDriver{} }

	serveContext, cancelServe := context.WithCancel(context.Background())
	serveErrors := make(chan error, 1)
	go func() { serveErrors <- daemon.Serve(serveContext) }()
	waitForSocket(testingObject, daemon.config.SocketPath, serveErrors)

	client := NewClient(daemon.config.SocketPath, 2*time.Second)
	statuses, err := client.Status(context.Background())
	if err != nil {
		testingObject.Fatalf("read controller status: %v", err)
	}
	if len(statuses) != 0 {
		testingObject.Fatalf("initial status list = %+v, want empty", statuses)
	}

	cancelServe()
	select {
	case err := <-serveErrors:
		if err != nil {
			testingObject.Fatalf("controller shutdown: %v", err)
		}
	case <-time.After(3 * time.Second):
		testingObject.Fatal("controller did not stop after cancellation")
	}
}

// TestPrepareNetworkOrdersPermanentPolicyCleanupAndFirewallBlock closes restart gaps.
func TestPrepareNetworkOrdersPermanentPolicyCleanupAndFirewallBlock(testingObject *testing.T) {
	daemon := newTestDaemon(testingObject)
	cleanupReadyPath := filepath.Join(testingObject.TempDir(), "cleanup-ready")
	blockPath := filepath.Join(testingObject.TempDir(), "firewall-block")
	if err := os.WriteFile(
		blockPath,
		[]byte(fmt.Sprintf("#!/bin/sh\ntest -f %q\n", cleanupReadyPath)),
		0o700,
	); err != nil {
		testingObject.Fatalf("write startup block helper: %v", err)
	}
	daemon.config.FirewallBlockPath = blockPath

	addressCount := 0
	ruleCount := 0
	unreachableCount := 0
	daemon.runIP = func(_ context.Context, arguments ...string) ([]byte, error) {
		command := strings.Join(arguments, " ")
		switch {
		case strings.Contains(command, "address replace 198.18."):
			addressCount++
		case strings.Contains(command, "rule add from 198.18."):
			ruleCount++
		case strings.Contains(command, "route replace unreachable default"):
			unreachableCount++
		}

		return nil, nil
	}
	cleanupCount := 0
	daemon.driverFactory = func(string, int) tunnelDriver {
		return startupTunnelDriver{cleanup: func() error {
			if addressCount != 64 || ruleCount != 64 || unreachableCount != 64 {
				return fmt.Errorf(
					"cleanup began before permanent policies: addresses=%d rules=%d unreachable=%d",
					addressCount,
					ruleCount,
					unreachableCount,
				)
			}
			cleanupCount++
			if cleanupCount == 128 {
				return os.WriteFile(cleanupReadyPath, []byte("ready\n"), 0o600)
			}

			return nil
		}}
	}

	if err := daemon.prepareNetwork(context.Background()); err != nil {
		testingObject.Fatalf("prepare startup network: %v", err)
	}
	if cleanupCount != 128 {
		testingObject.Fatalf("stale cleanup calls = %d, want 128", cleanupCount)
	}
}

// TestPrepareNetworkKeepsFirewallWhenCleanupFails preserves stale-link protection.
func TestPrepareNetworkKeepsFirewallWhenCleanupFails(testingObject *testing.T) {
	daemon := newTestDaemon(testingObject)
	blockMarkerPath := filepath.Join(testingObject.TempDir(), "block-called")
	blockPath := filepath.Join(testingObject.TempDir(), "firewall-block")
	if err := os.WriteFile(
		blockPath,
		[]byte(fmt.Sprintf("#!/bin/sh\nprintf called > %q\n", blockMarkerPath)),
		0o700,
	); err != nil {
		testingObject.Fatalf("write failed-cleanup block helper: %v", err)
	}
	daemon.config.FirewallBlockPath = blockPath
	daemon.runIP = func(context.Context, ...string) ([]byte, error) { return nil, nil }
	cleanupCount := 0
	daemon.driverFactory = func(string, int) tunnelDriver {
		return startupTunnelDriver{cleanup: func() error {
			cleanupCount++
			if cleanupCount == 1 {
				return errors.New("stale link remains")
			}

			return nil
		}}
	}

	err := daemon.prepareNetwork(context.Background())
	if err == nil || !strings.Contains(err.Error(), "stale link remains") {
		testingObject.Fatalf("failed startup cleanup error = %v", err)
	}
	if _, err := os.Stat(blockMarkerPath); !errors.Is(err, os.ErrNotExist) {
		testingObject.Fatalf("startup firewall block ran after failed cleanup: %v", err)
	}
}

// TestCommandsForTwoConnectionsAreIndependent proves long work is connection-local.
func TestCommandsForTwoConnectionsAreIndependent(testingObject *testing.T) {
	daemon := newTestDaemon(testingObject)
	firstStarted := make(chan struct{})
	releaseFirst := make(chan struct{})
	daemon.driverFactory = func(_ string, slot int) tunnelDriver {
		return testTunnelDriver{start: func(ctx context.Context, _ Connection, _ Endpoint) (tunnelSession, error) {
			if slot == 0 {
				select {
				case <-firstStarted:
				default:
					close(firstStarted)
				}
				select {
				case <-releaseFirst:
				case <-ctx.Done():
					return nil, ctx.Err()
				}
			}

			return newTestTunnelSession(slot), nil
		}}
	}

	firstResult := make(chan error, 1)
	go func() {
		_, err := daemon.Connect(
			"vpc-0000000000000001",
			0,
			true,
			testWireGuardConnection(testingObject, "first", "192.0.2.1", "10.64.0.1"),
		)
		firstResult <- err
	}()
	<-firstStarted

	secondStatus, err := daemon.Connect(
		"vpc-0000000000000002",
		3,
		false,
		testWireGuardConnection(testingObject, "second", "192.0.2.2", "10.64.0.2"),
	)
	if err != nil || secondStatus.State != "protected" || secondStatus.Interface != "wg3" {
		testingObject.Fatalf("second connection = %+v, %v", secondStatus, err)
	}
	select {
	case err := <-firstResult:
		testingObject.Fatalf("first connection ended while its own start was held: %v", err)
	default:
	}

	close(releaseFirst)
	if err := <-firstResult; err != nil {
		testingObject.Fatalf("finish first connection: %v", err)
	}
	statuses := daemon.Status()
	if len(statuses) != 2 || statuses[0].ConnectionID != "vpc-0000000000000001" ||
		statuses[1].ConnectionID != "vpc-0000000000000002" {
		testingObject.Fatalf("connection statuses = %+v", statuses)
	}
}

// TestProtectedStatusWithoutSessionHidesLiveFields makes API restore actionable.
func TestProtectedStatusWithoutSessionHidesLiveFields(testingObject *testing.T) {
	state := &connectionState{status: Status{
		State:     "protected",
		Interface: "wg0",
		Address:   "10.68.0.2",
	}}
	status := state.statusSnapshot()
	if status.Interface != "" || status.Address != "" {
		testingObject.Fatalf("sessionless protected status retained live fields: %+v", status)
	}
}

// TestProtectUsesSlotAndProviderAddresses keeps firewall routing identities separate.
func TestProtectUsesSlotAndProviderAddresses(testingObject *testing.T) {
	daemon := newTestDaemon(testingObject)
	argumentsPath := filepath.Join(testingObject.TempDir(), "protect-arguments")
	protectPath := filepath.Join(testingObject.TempDir(), "firewall-protect")
	if err := os.WriteFile(
		protectPath,
		[]byte(fmt.Sprintf("#!/bin/sh\nprintf '%%s\\n' \"$*\" > %q\n", argumentsPath)),
		0o700,
	); err != nil {
		testingObject.Fatalf("write protect helper: %v", err)
	}
	daemon.config.FirewallProtectPath = protectPath
	daemon.driverFactory = func(_ string, slot int) tunnelDriver {
		return testTunnelDriver{start: func(context.Context, Connection, Endpoint) (tunnelSession, error) {
			return newTestTunnelSession(slot), nil
		}}
	}

	if _, err := daemon.Connect(
		"vpc-0000000000000016",
		4,
		false,
		testWireGuardConnection(testingObject, "firewall-identities", "192.0.2.60", "10.64.0.1"),
	); err != nil {
		testingObject.Fatalf("connect with captured firewall helper: %v", err)
	}
	arguments, err := os.ReadFile(argumentsPath)
	if err != nil {
		testingObject.Fatalf("read protect arguments: %v", err)
	}
	if strings.TrimSpace(string(arguments)) != "wg4 198.18.4.1 10.68.4.2" {
		testingObject.Fatalf("protect arguments = %q", arguments)
	}
}

// TestNewestCommandWinsPerConnection cancels only the older command for one identity.
func TestNewestCommandWinsPerConnection(testingObject *testing.T) {
	daemon := newTestDaemon(testingObject)
	firstStarted := make(chan struct{})
	var starts int
	var startsMutex sync.Mutex
	daemon.driverFactory = func(_ string, slot int) tunnelDriver {
		return testTunnelDriver{start: func(ctx context.Context, _ Connection, _ Endpoint) (tunnelSession, error) {
			startsMutex.Lock()
			starts++
			startNumber := starts
			startsMutex.Unlock()
			if startNumber == 1 {
				close(firstStarted)
				<-ctx.Done()

				return nil, ctx.Err()
			}

			return newTestTunnelSession(slot), nil
		}}
	}
	connection := testWireGuardConnection(testingObject, "newest", "192.0.2.10", "10.64.0.1")
	firstResult := make(chan error, 1)
	go func() {
		_, err := daemon.Connect("vpc-0000000000000003", 0, true, connection)
		firstResult <- err
	}()
	<-firstStarted

	secondStatus, secondError := daemon.Connect("vpc-0000000000000003", 0, true, connection)
	if !errors.Is(<-firstResult, errReplaced) {
		testingObject.Fatal("the older command was not replaced")
	}
	if secondError != nil || secondStatus.State != "protected" {
		testingObject.Fatalf("newest command = %+v, %v", secondStatus, secondError)
	}
}

// TestNewerUnknownDisconnectRejectsAnOlderConnect preserves accept-order semantics.
func TestNewerUnknownDisconnectRejectsAnOlderConnect(testingObject *testing.T) {
	daemon := newTestDaemon(testingObject)
	daemon.driverFactory = func(_ string, slot int) tunnelDriver {
		return testTunnelDriver{start: func(context.Context, Connection, Endpoint) (tunnelSession, error) {
			return newTestTunnelSession(slot), nil
		}}
	}
	connectionID := "vpc-0000000000000009"
	connection := testWireGuardConnection(
		testingObject,
		"arrival-order",
		"192.0.2.12",
		"10.64.0.1",
	)
	if _, err := daemon.disconnect(connectionID, "test", 2); err != nil {
		testingObject.Fatalf("record newer disconnect: %v", err)
	}
	if _, err := daemon.connect(
		connectionID,
		0,
		true,
		connection,
		1,
		time.Second,
	); !errors.Is(err, errReplaced) {
		testingObject.Fatalf("older connect error = %v", err)
	}
	if len(daemon.Status()) != 0 {
		testingObject.Fatalf("older connect created state: %+v", daemon.Status())
	}
	status, err := daemon.connect(
		connectionID,
		0,
		true,
		connection,
		3,
		time.Second,
	)
	if err != nil || status.State != "protected" {
		testingObject.Fatalf("newer connect = %+v, %v", status, err)
	}
}

// TestNewConnectSupersedesDisconnectTeardown keeps the claimed state in the map.
func TestNewConnectSupersedesDisconnectTeardown(testingObject *testing.T) {
	daemon := newTestDaemon(testingObject)
	stopStarted := make(chan struct{})
	releaseStop := make(chan struct{})
	var starts int
	var startsMutex sync.Mutex
	daemon.driverFactory = func(_ string, slot int) tunnelDriver {
		return testTunnelDriver{start: func(context.Context, Connection, Endpoint) (tunnelSession, error) {
			startsMutex.Lock()
			starts++
			startNumber := starts
			startsMutex.Unlock()
			if startNumber == 1 {
				return &blockingStopTunnelSession{
					testTunnelSession: newTestTunnelSession(slot),
					stopStarted:       stopStarted,
					releaseStop:       releaseStop,
				}, nil
			}

			return newTestTunnelSession(slot), nil
		}}
	}
	connectionID := "vpc-0000000000000008"
	connection := testWireGuardConnection(
		testingObject,
		"disconnect-race",
		"192.0.2.11",
		"10.64.0.1",
	)
	if _, err := daemon.Connect(connectionID, 0, true, connection); err != nil {
		testingObject.Fatalf("connect initial tunnel: %v", err)
	}

	disconnectResult := make(chan error, 1)
	go func() {
		_, err := daemon.Disconnect(connectionID, "test")
		disconnectResult <- err
	}()
	<-stopStarted

	connectResult := make(chan error, 1)
	go func() {
		_, err := daemon.Connect(connectionID, 0, true, connection)
		connectResult <- err
	}()
	state, found := daemon.lookupConnectionState(connectionID)
	if !found {
		testingObject.Fatal("connection state disappeared before the newer claim")
	}
	deadline := time.Now().Add(time.Second)
	for {
		state.attemptMutex.Lock()
		generation := state.generation
		state.attemptMutex.Unlock()
		if generation >= 3 {
			break
		}
		if time.Now().After(deadline) {
			testingObject.Fatal("new connect did not claim the connection")
		}
		time.Sleep(time.Millisecond)
	}
	close(releaseStop)

	if err := <-disconnectResult; !errors.Is(err, errReplaced) {
		testingObject.Fatalf("superseded disconnect error = %v", err)
	}
	if err := <-connectResult; err != nil {
		testingObject.Fatalf("new connect: %v", err)
	}
	statuses := daemon.Status()
	if len(statuses) != 1 || statuses[0].ConnectionID != connectionID ||
		statuses[0].State != "protected" {
		testingObject.Fatalf("statuses after superseded disconnect = %+v", statuses)
	}
}

// TestSetDefaultMovesDNSPins keeps tunnels alive while resolver ownership changes.
func TestSetDefaultMovesDNSPins(testingObject *testing.T) {
	daemon := newTestDaemon(testingObject)
	var sessionsMutex sync.Mutex
	sessions := map[int]*testTunnelSession{}
	daemon.driverFactory = func(_ string, slot int) tunnelDriver {
		return testTunnelDriver{start: func(context.Context, Connection, Endpoint) (tunnelSession, error) {
			session := newTestTunnelSession(slot)
			sessionsMutex.Lock()
			sessions[slot] = session
			sessionsMutex.Unlock()

			return session, nil
		}}
	}

	var commandsMutex sync.Mutex
	commands := []string{}
	daemon.runIP = func(_ context.Context, arguments ...string) ([]byte, error) {
		commandsMutex.Lock()
		commands = append(commands, strings.Join(arguments, " "))
		commandsMutex.Unlock()

		return nil, nil
	}
	if _, err := daemon.Connect(
		"vpc-0000000000000004",
		0,
		true,
		testWireGuardConnection(testingObject, "default-a", "192.0.2.20", "10.64.0.1"),
	); err != nil {
		testingObject.Fatalf("connect first default: %v", err)
	}
	if _, err := daemon.Connect(
		"vpc-0000000000000005",
		3,
		false,
		testWireGuardConnection(testingObject, "default-b", "192.0.2.21", "10.64.0.2"),
	); err != nil {
		testingObject.Fatalf("connect second tunnel: %v", err)
	}

	commandsMutex.Lock()
	commands = nil
	commandsMutex.Unlock()
	status, err := daemon.SetDefault("vpc-0000000000000005")
	if err != nil {
		testingObject.Fatalf("move default: %v", err)
	}
	if !status.Default || status.Interface != "wg3" || status.Address != "10.68.3.2" {
		testingObject.Fatalf("new default status = %+v", status)
	}
	commandsMutex.Lock()
	commandText := strings.Join(commands, "\n")
	commandsMutex.Unlock()
	if !strings.Contains(commandText, "-4 route flush table main proto 211") ||
		!strings.Contains(commandText, "-4 route add 10.64.0.2/32 dev wg3 src 198.18.3.1 proto 211") {
		testingObject.Fatalf("DNS move commands:\n%s", commandText)
	}
	resolverContent, err := os.ReadFile(daemon.config.ResolverPath)
	if err != nil || !strings.Contains(string(resolverContent), "nameserver 10.64.0.2") ||
		strings.Contains(string(resolverContent), "nameserver 10.64.0.1") {
		testingObject.Fatalf("moved resolver = %q, %v", resolverContent, err)
	}
	sessionsMutex.Lock()
	defer sessionsMutex.Unlock()
	if sessions[0].isStopped() || sessions[3].isStopped() {
		testingObject.Fatal("set-default stopped a tunnel")
	}
}

// TestSetDefaultRecordsAnUnknownConnection keeps durable default changes ahead of restore.
func TestSetDefaultRecordsAnUnknownConnection(testingObject *testing.T) {
	daemon := newTestDaemon(testingObject)
	oldID := "vpc-0000000000000020"
	state, _, _, err := daemon.claimConnectionState(oldID, 0, 1)
	if err != nil {
		testingObject.Fatalf("create old default state: %v", err)
	}
	state.status = Status{
		ConnectionID: oldID,
		Slot:         0,
		Default:      true,
		State:        "protected",
		Interface:    "wg0",
		Address:      "10.68.0.2",
		DNSServers:   []string{"10.64.0.1"},
	}
	daemon.defaultID = oldID
	if err := os.WriteFile(daemon.config.ResolverPath, []byte("nameserver 10.64.0.1\n"), 0o644); err != nil {
		testingObject.Fatalf("write protected resolver: %v", err)
	}

	newID := "vpc-0000000000000021"
	status, err := daemon.SetDefault(newID)
	if err != nil {
		testingObject.Fatalf("set unknown default: %v", err)
	}
	if daemon.defaultID != newID || status.ConnectionID != newID ||
		!status.Default || status.State != "blocked" {
		testingObject.Fatalf("unknown default status = %+v, default ID = %q", status, daemon.defaultID)
	}
	if state.statusSnapshot().Default {
		testingObject.Fatal("previous controller state remained the default")
	}
	resolver, err := os.ReadFile(daemon.config.ResolverPath)
	if err != nil || string(resolver) != "nameserver 127.0.0.1\n" {
		testingObject.Fatalf("bootstrap resolver = %q, %v", resolver, err)
	}
	content, err := os.ReadFile(filepath.Join(daemon.config.RuntimeDirectory, "vpn.status"))
	if err != nil {
		testingObject.Fatalf("read default status projection: %v", err)
	}
	var projected Status
	if err := json.Unmarshal(content, &projected); err != nil {
		testingObject.Fatalf("decode default status projection: %v", err)
	}
	if projected.ConnectionID != newID || projected.State != "blocked" || !projected.Default {
		testingObject.Fatalf("default status projection = %+v", projected)
	}
}

// TestStaleSetDefaultCannotReplaceNewerArrival verifies global newest-wins ordering.
func TestStaleSetDefaultCannotReplaceNewerArrival(testingObject *testing.T) {
	daemon := newTestDaemon(testingObject)
	for index, slot := range []int{0, 3} {
		connectionID := []string{"vpc-0000000000000010", "vpc-0000000000000011"}[index]
		state, _, _, err := daemon.claimConnectionState(connectionID, slot, uint64(index+1))
		if err != nil {
			testingObject.Fatalf("create connection state: %v", err)
		}
		state.status = Status{
			ConnectionID: connectionID,
			Slot:         slot,
			State:        "protected",
			Interface:    "wg" + strconv.Itoa(slot),
			Address:      "10.68." + strconv.Itoa(slot) + ".2",
			DNSServers:   []string{"10.64.0.1"},
		}
	}

	newID := "vpc-0000000000000011"
	oldID := "vpc-0000000000000010"
	if _, err := daemon.setDefault(newID, 20); err != nil {
		testingObject.Fatalf("set newer default: %v", err)
	}
	if _, err := daemon.setDefault(oldID, 19); !errors.Is(err, errReplaced) {
		testingObject.Fatalf("stale set-default error = %v", err)
	}
	if daemon.defaultID != newID {
		testingObject.Fatalf("default ID = %q, want %q", daemon.defaultID, newID)
	}
	oldState, _ := daemon.lookupConnectionState(oldID)
	newState, _ := daemon.lookupConnectionState(newID)
	if oldState.statusSnapshot().Default || !newState.statusSnapshot().Default {
		testingObject.Fatalf(
			"default flags old/new = %t/%t",
			oldState.statusSnapshot().Default,
			newState.statusSnapshot().Default,
		)
	}
}

// TestSetDefaultDoesNotWaitForTunnelOperation keeps resolver ownership independent.
func TestSetDefaultDoesNotWaitForTunnelOperation(testingObject *testing.T) {
	daemon := newTestDaemon(testingObject)
	connectionID := "vpc-0000000000000013"
	state, _, _, err := daemon.claimConnectionState(connectionID, 2, 1)
	if err != nil {
		testingObject.Fatalf("create connection state: %v", err)
	}
	state.status = Status{
		ConnectionID: connectionID,
		Slot:         2,
		State:        "protected",
		Interface:    "wg2",
		Address:      "10.68.2.2",
		DNSServers:   []string{"10.64.0.1"},
	}

	state.operationMutex.Lock()
	defer state.operationMutex.Unlock()
	completed := make(chan error, 1)
	go func() {
		_, setError := daemon.SetDefault(connectionID)
		completed <- setError
	}()

	select {
	case setError := <-completed:
		if setError != nil {
			testingObject.Fatalf("set default while tunnel operation is held: %v", setError)
		}
	case <-time.After(time.Second):
		testingObject.Fatal("set-default waited for the target tunnel operation lock")
	}
}

// TestSetDefaultSerializesWithTransition prevents a stale old-default status file.
func TestSetDefaultSerializesWithTransition(testingObject *testing.T) {
	daemon := newTestDaemon(testingObject)
	oldID := "vpc-0000000000000014"
	newID := "vpc-0000000000000015"
	oldState, _, _, err := daemon.claimConnectionState(oldID, 0, 1)
	if err != nil {
		testingObject.Fatalf("create old default: %v", err)
	}
	newState, _, _, err := daemon.claimConnectionState(newID, 1, 2)
	if err != nil {
		testingObject.Fatalf("create new default: %v", err)
	}
	oldState.status = Status{ConnectionID: oldID, Slot: 0, Default: true, State: "protected"}
	newState.status = Status{ConnectionID: newID, Slot: 1, State: "protected"}
	daemon.defaultID = oldID

	daemon.projectionMutex.Lock()
	projectionUnlocked := false
	defer func() {
		if !projectionUnlocked {
			daemon.projectionMutex.Unlock()
		}
	}()
	transitioned := make(chan error, 1)
	defaulted := make(chan error, 1)
	go func() {
		transitioned <- daemon.transition(oldState, Status{State: "protected"})
	}()
	go func() {
		_, setError := daemon.setDefault(newID, 10)
		defaulted <- setError
	}()
	select {
	case operationError := <-transitioned:
		testingObject.Fatalf("transition bypassed status projection lock: %v", operationError)
	case operationError := <-defaulted:
		testingObject.Fatalf("set-default bypassed status projection lock: %v", operationError)
	case <-time.After(50 * time.Millisecond):
	}
	daemon.projectionMutex.Unlock()
	projectionUnlocked = true

	if err := <-transitioned; err != nil {
		testingObject.Fatalf("transition old default: %v", err)
	}
	if err := <-defaulted; err != nil {
		testingObject.Fatalf("set new default: %v", err)
	}
	content, err := os.ReadFile(daemon.connectionStatusPath(oldID))
	if err != nil {
		testingObject.Fatalf("read old default status: %v", err)
	}
	var status Status
	if err := json.Unmarshal(content, &status); err != nil {
		testingObject.Fatalf("decode old default status: %v", err)
	}
	if status.Default {
		testingObject.Fatalf("old default status stayed true: %s", content)
	}
}

// TestFailedFirewallBlockStillPublishesBlocked retries and records the failure.
func TestFailedFirewallBlockStillPublishesBlocked(testingObject *testing.T) {
	daemon := newTestDaemon(testingObject)
	daemon.driverFactory = func(_ string, slot int) tunnelDriver {
		return testTunnelDriver{start: func(context.Context, Connection, Endpoint) (tunnelSession, error) {
			return newTestTunnelSession(slot), nil
		}}
	}
	connectionID := "vpc-0000000000000012"
	connection := testWireGuardConnection(
		testingObject,
		"block-failure",
		"192.0.2.50",
		"10.64.0.1",
	)
	if _, err := daemon.Connect(connectionID, 0, true, connection); err != nil {
		testingObject.Fatalf("connect before block failure: %v", err)
	}
	blockAttemptsPath := filepath.Join(testingObject.TempDir(), "block-attempts")
	if err := os.WriteFile(
		daemon.config.FirewallBlockPath,
		[]byte(fmt.Sprintf(
			"#!/bin/sh\nprintf x >> %q\nprintf 'blocked helper failure\\n' >&2\nexit 1\n",
			blockAttemptsPath,
		)),
		0o700,
	); err != nil {
		testingObject.Fatalf("replace firewall helper: %v", err)
	}
	status, err := daemon.Disconnect(connectionID, "test")
	if err == nil || status.State != "blocked" || status.Interface != "" || status.Address != "" ||
		!strings.Contains(status.LastError, "blocked helper failure") {
		testingObject.Fatalf("failed-block status/error = %+v, %v", status, err)
	}
	content, readError := os.ReadFile(daemon.connectionStatusPath(connectionID))
	if readError != nil || !strings.Contains(string(content), `"state":"blocked"`) {
		testingObject.Fatalf("published blocked status = %q, %v", content, readError)
	}
	attempts, readError := os.ReadFile(blockAttemptsPath)
	if readError != nil || string(attempts) != "xx" {
		testingObject.Fatalf("firewall block attempts = %q, %v, want two", attempts, readError)
	}
}

// TestDisconnectForgetsOnlyOneStatusFile preserves other protected connections.
func TestDisconnectForgetsOnlyOneStatusFile(testingObject *testing.T) {
	daemon := newTestDaemon(testingObject)
	daemon.driverFactory = func(_ string, slot int) tunnelDriver {
		return testTunnelDriver{start: func(context.Context, Connection, Endpoint) (tunnelSession, error) {
			return newTestTunnelSession(slot), nil
		}}
	}
	for index, slot := range []int{0, 3} {
		connectionID := []string{"vpc-0000000000000006", "vpc-0000000000000007"}[index]
		if _, err := daemon.Connect(
			connectionID,
			slot,
			index == 0,
			testWireGuardConnection(testingObject, connectionID, "192.0.2.30", "10.64.0.1"),
		); err != nil {
			testingObject.Fatalf("connect slot %d: %v", slot, err)
		}
	}
	if _, err := daemon.Disconnect("vpc-0000000000000007", "test"); err != nil {
		testingObject.Fatalf("disconnect second connection: %v", err)
	}
	if _, err := os.Stat(daemon.connectionStatusPath("vpc-0000000000000007")); !errors.Is(err, os.ErrNotExist) {
		testingObject.Fatalf("disconnected status file remains: %v", err)
	}
	statuses := daemon.Status()
	if len(statuses) != 1 || statuses[0].ConnectionID != "vpc-0000000000000006" ||
		statuses[0].State != "protected" {
		testingObject.Fatalf("remaining statuses = %+v", statuses)
	}
}

// TestValidateConnectionRejectsMismatchedEndpoint verifies metadata defense-in-depth.
func TestValidateConnectionRejectsMismatchedEndpoint(testingObject *testing.T) {
	connection := testWireGuardConnection(testingObject, "metadata", "192.0.2.40", "10.64.0.1")
	connection.Endpoints[0].RemoteHost = "different.example.test"
	if err := validateConnection(connection); err == nil {
		testingObject.Fatal("mismatched endpoint metadata was accepted")
	}
}

// TestCandidateIndexes verifies ordered and sticky failover behavior.
func TestCandidateIndexes(testingObject *testing.T) {
	connection := Connection{
		EndpointStrategy: "ordered",
		Endpoints: []Endpoint{
			{ProfileID: "custom:first"},
			{ProfileID: "custom:second"},
			{ProfileID: "custom:third"},
		},
	}
	if got := candidateIndexes(connection, 1, true); len(got) != 3 || got[0] != 2 || got[1] != 0 || got[2] != 1 {
		testingObject.Fatalf("ordered failover indexes = %v", got)
	}
	connection.EndpointStrategy = "sticky"
	if got := candidateIndexes(connection, 1, true); len(got) != 3 || got[0] != 1 || got[1] != 2 || got[2] != 0 {
		testingObject.Fatalf("sticky failover indexes = %v", got)
	}
}

func newTestDaemon(testingObject *testing.T) *Daemon {
	testingObject.Helper()
	temporaryDirectory := testingObject.TempDir()
	resolverPath := filepath.Join(temporaryDirectory, "resolv.conf")
	if err := os.WriteFile(resolverPath, []byte("nameserver 127.0.0.1\n"), 0o644); err != nil {
		testingObject.Fatalf("write resolver: %v", err)
	}
	helperPath := filepath.Join(temporaryDirectory, "firewall-helper")
	if err := os.WriteFile(helperPath, []byte("#!/bin/sh\nexit 0\n"), 0o700); err != nil {
		testingObject.Fatalf("write firewall helper: %v", err)
	}
	if err := os.MkdirAll(filepath.Join(temporaryDirectory, "runtime", "services"), 0o777); err != nil {
		testingObject.Fatalf("create services directory: %v", err)
	}

	daemon, err := NewDaemon(DaemonConfig{
		SocketPath:          filepath.Join(temporaryDirectory, "controller.sock"),
		RuntimeDirectory:    filepath.Join(temporaryDirectory, "runtime"),
		OpenVPNPath:         filepath.Join(temporaryDirectory, "openvpn"),
		WireGuardPath:       filepath.Join(temporaryDirectory, "wg"),
		WireGuardGoPath:     filepath.Join(temporaryDirectory, "wireguard-go"),
		IPPath:              filepath.Join(temporaryDirectory, "ip"),
		FirewallBlockPath:   helperPath,
		FirewallProtectPath: helperPath,
		ResolverPath:        resolverPath,
		ControlGroup:        "root",
		ConnectTimeout:      2 * time.Second,
		Logger:              slog.New(slog.NewTextHandler(io.Discard, nil)),
	})
	if err != nil {
		testingObject.Fatalf("create daemon: %v", err)
	}
	daemon.verify = func(context.Context, string, string, []string, bool) error { return nil }
	daemon.runIP = func(context.Context, ...string) ([]byte, error) { return nil, nil }

	return daemon
}

func testWireGuardConnection(
	testingObject *testing.T,
	name string,
	endpointHost string,
	dnsServer string,
) Connection {
	testingObject.Helper()
	profile, err := provider.NormalizeWireGuardProfile("custom", name+".conf", []byte(`[Interface]
PrivateKey = `+testWireGuardPrivateKey+`
Address = 10.68.12.34/32
DNS = `+dnsServer+`

[Peer]
PublicKey = `+testWireGuardPublicKey+`
Endpoint = `+endpointHost+`:51820
AllowedIPs = 0.0.0.0/0
`))
	if err != nil {
		testingObject.Fatalf("normalize WireGuard profile: %v", err)
	}

	return Connection{
		ProviderID:       "custom",
		Tunnel:           provider.TunnelWireGuard,
		EndpointStrategy: "sticky",
		Endpoints: []Endpoint{{
			ProfileID:     profile.ID,
			Configuration: profile.Configuration,
			RemoteHost:    profile.RemoteHost,
			RemotePort:    profile.RemotePort,
		}},
		DNSServers:           []string{dnsServer},
		RetryIntervalSeconds: 3,
	}
}

type testTunnelDriver struct {
	start func(context.Context, Connection, Endpoint) (tunnelSession, error)
}

type startupTunnelDriver struct {
	cleanup func() error
}

func (startupTunnelDriver) Start(
	context.Context,
	Connection,
	Endpoint,
) (tunnelSession, error) {
	return nil, errors.New("startup test driver cannot start")
}

func (driver startupTunnelDriver) CleanupStale(context.Context) error {
	return driver.cleanup()
}

func (driver testTunnelDriver) Start(
	ctx context.Context,
	connection Connection,
	endpoint Endpoint,
) (tunnelSession, error) {
	return driver.start(ctx, connection, endpoint)
}

func (testTunnelDriver) CleanupStale(context.Context) error { return nil }

type inertTunnelDriver struct{}

func (inertTunnelDriver) Start(context.Context, Connection, Endpoint) (tunnelSession, error) {
	return nil, errors.New("unused")
}
func (inertTunnelDriver) CleanupStale(context.Context) error { return nil }

type testTunnelSession struct {
	interfaceName string
	address       string
	done          chan struct{}
	stopOnce      sync.Once
	mutex         sync.Mutex
	stopped       bool
}

type blockingStopTunnelSession struct {
	*testTunnelSession
	stopStarted chan struct{}
	releaseStop chan struct{}
	stopOnce    sync.Once
}

func (session *blockingStopTunnelSession) Stop() {
	session.stopOnce.Do(func() {
		close(session.stopStarted)
		<-session.releaseStop
		session.testTunnelSession.Stop()
	})
}

func newTestTunnelSession(slot int) *testTunnelSession {
	return &testTunnelSession{
		interfaceName: tunnelInterfaceName(provider.TunnelWireGuard, slot),
		address:       "10.68." + strconv.Itoa(slot) + ".2",
		done:          make(chan struct{}),
	}
}

func (session *testTunnelSession) InterfaceName() string { return session.interfaceName }
func (session *testTunnelSession) Address() string       { return session.address }
func (*testTunnelSession) ProviderDNSServers() []string  { return nil }
func (*testTunnelSession) Details() sessionDetails       { return sessionDetails{Implementation: "kernel"} }
func (session *testTunnelSession) Done() <-chan struct{} { return session.done }
func (*testTunnelSession) Err() error                    { return errors.New("test tunnel stopped") }
func (session *testTunnelSession) Stop() {
	session.mutex.Lock()
	session.stopped = true
	session.mutex.Unlock()
	session.stopOnce.Do(func() { close(session.done) })
}
func (session *testTunnelSession) isStopped() bool {
	session.mutex.Lock()
	defer session.mutex.Unlock()

	return session.stopped
}

func waitForSocket(testingObject *testing.T, socketPath string, serveErrors <-chan error) {
	testingObject.Helper()
	for attempt := 0; attempt < 100; attempt++ {
		if connection, err := net.Dial("unix", socketPath); err == nil {
			_ = connection.Close()

			return
		}
		select {
		case err := <-serveErrors:
			testingObject.Fatalf("controller stopped before creating its socket: %v", err)
		default:
		}
		time.Sleep(10 * time.Millisecond)
	}
	testingObject.Fatalf("controller socket was not created: %s", socketPath)
}
