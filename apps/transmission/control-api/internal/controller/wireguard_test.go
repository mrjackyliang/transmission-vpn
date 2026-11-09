package controller

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/netip"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type fakeWireGuardSystem struct {
	mutex         sync.Mutex
	commands      []string
	failures      map[string]string
	interfaceName string
	linkExists    bool
	socketReady   bool
	kernelModule  bool
	handshake     int64
	setconf       string
	setconfMode   os.FileMode
	probeCalls    int
	probeAddress  string
	probeError    error
	clock         atomic.Int64
}

func newFakeWireGuardSystem(interfaceName string) *fakeWireGuardSystem {
	system := &fakeWireGuardSystem{
		failures:      map[string]string{},
		interfaceName: interfaceName,
		kernelModule:  true,
		handshake:     1_799_999_999,
	}
	system.clock.Store(time.Unix(1_800_000_000, 0).UnixNano())

	return system
}

func (system *fakeWireGuardSystem) run(
	_ context.Context,
	name string,
	arguments ...string,
) ([]byte, error) {
	command := filepath.Base(name) + " " + strings.Join(arguments, " ")
	system.mutex.Lock()
	defer system.mutex.Unlock()
	system.commands = append(system.commands, command)
	for prefix, output := range system.failures {
		if strings.HasPrefix(command, prefix) {
			return []byte(output), errors.New("exit status 2")
		}
	}

	switch {
	case strings.HasPrefix(command, "ip -4 route get "):
		return []byte(arguments[3] + " via 172.17.0.1 dev eth0 src 172.17.0.2\n"), nil
	case command == "ip link add dev "+system.interfaceName+" type wireguard":
		system.linkExists = true
	case strings.HasPrefix(command, "wg setconf "+system.interfaceName+" "):
		content, err := os.ReadFile(arguments[2])
		if err != nil {
			return []byte(err.Error()), err
		}
		information, _ := os.Stat(arguments[2])
		system.setconf = string(content)
		system.setconfMode = information.Mode().Perm()
	case command == "wg show "+system.interfaceName+" latest-handshakes":
		if !system.linkExists {
			return []byte("Unable to access interface: No such device\n"), errors.New("exit status 1")
		}

		return []byte(fmt.Sprintf("%s\t%d\n", testWireGuardPublicKey, system.handshake)), nil
	case command == "ip -4 route del default dev "+system.interfaceName+" metric 0 table "+routingTableForInterface(system.interfaceName):
		return []byte("RTNETLINK answers: No such process"), errors.New("exit status 2")
	case command == "ip link delete dev "+system.interfaceName:
		system.linkExists = false
	}

	return nil, nil
}

func routingTableForInterface(interfaceName string) string {
	slot, _ := strconv.Atoi(strings.TrimPrefix(interfaceName, "wg"))

	return strconv.Itoa(firstRoutingTable + slot)
}

func (system *fakeWireGuardSystem) pathExists(path string) bool {
	system.mutex.Lock()
	defer system.mutex.Unlock()

	switch path {
	case filepath.Join("/sys/class/net", system.interfaceName):
		return system.linkExists
	case "/sys/module/wireguard":
		return system.kernelModule
	case wireGuardSocketPath(system.interfaceName):
		return system.socketReady
	}

	return false
}

func (system *fakeWireGuardSystem) probe(_ context.Context, address string) error {
	system.mutex.Lock()
	defer system.mutex.Unlock()
	system.probeCalls++
	system.probeAddress = address

	return system.probeError
}

func (system *fakeWireGuardSystem) now() time.Time {
	return time.Unix(0, system.clock.Load())
}

func (system *fakeWireGuardSystem) advance(duration time.Duration) {
	system.clock.Add(int64(duration))
}

func (system *fakeWireGuardSystem) commandLog() []string {
	system.mutex.Lock()
	defer system.mutex.Unlock()

	return append([]string(nil), system.commands...)
}

func newTestWireGuardDriver(
	testingObject *testing.T,
	system *fakeWireGuardSystem,
	slot int,
) *wireGuardDriver {
	testingObject.Helper()

	return &wireGuardDriver{
		directory:       testingObject.TempDir(),
		ipPath:          "/sbin/ip",
		wgPath:          "/usr/bin/wg",
		wireGuardGoPath: "/usr/bin/wireguard-go",
		implementation:  "auto",
		interfaceName:   system.interfaceName,
		slot:            slot,
		logger:          slog.New(slog.NewTextHandler(io.Discard, nil)),
		timing: wireGuardTiming{
			linkTimeout:      time.Second,
			handshakeTimeout: time.Second,
			handshakePoll:    5 * time.Millisecond,
			healthInterval:   time.Hour,
			probeInterval:    time.Hour,
			staleHandshake:   180 * time.Second,
			probeFailures:    3,
		},
		lookupIPv4: func(_ context.Context, host string) ([]netip.Addr, error) {
			if host != "se-sto.example.test" {
				return nil, fmt.Errorf("no such host %s", host)
			}

			return []netip.Addr{netip.MustParseAddr("203.0.113.5")}, nil
		},
		run:        system.run,
		startChild: startChildProcess,
		pathExists: system.pathExists,
		readFile: func(path string) ([]byte, error) {
			if path == "/sys/class/net/eth0/mtu" {
				return []byte("1500\n"), nil
			}

			return nil, os.ErrNotExist
		},
		now:   system.now,
		probe: system.probe,
	}
}

// TestWireGuardDriverUsesOnlyItsPolicyTable checks the slot-zero command sequence.
func TestWireGuardDriverUsesOnlyItsPolicyTable(testingObject *testing.T) {
	system := newFakeWireGuardSystem("wg0")
	driver := newTestWireGuardDriver(testingObject, system, 0)
	endpoint := testWireGuardConnection(testingObject, "home", "se-sto.example.test", "10.64.0.1").Endpoints[0]
	session, err := driver.Start(context.Background(), Connection{}, endpoint)
	if err != nil {
		testingObject.Fatalf("start WireGuard: %v", err)
	}

	log := strings.Join(system.commandLog(), "\n")
	for _, expected := range []string{
		"ip -4 address add 10.68.12.34/32 dev wg0 noprefixroute",
		"ip -4 route replace default dev wg0 metric 0 table 1000",
	} {
		if !strings.Contains(log, expected) {
			testingObject.Errorf("commands do not contain %q:\n%s", expected, log)
		}
	}
	for _, forbidden := range []string{"0.0.0.0/1", "128.0.0.0/1", "proto 210", "route show default"} {
		if strings.Contains(log, forbidden) {
			testingObject.Errorf("commands contain %q:\n%s", forbidden, log)
		}
	}
	if session.Address() != "10.68.12.34" || session.InterfaceName() != "wg0" {
		testingObject.Fatalf("session address/interface = %s/%s", session.Address(), session.InterfaceName())
	}
	if system.setconfMode != 0o600 || !strings.Contains(system.setconf, "FwMark = 0xca6c") {
		testingObject.Fatalf("setconf mode %o:\n%s", system.setconfMode, system.setconf)
	}

	session.Stop()
	log = strings.Join(system.commandLog(), "\n")
	if !strings.Contains(log, "ip -4 route del default dev wg0 metric 0 table 1000") ||
		!strings.Contains(log, "ip link delete dev wg0") {
		testingObject.Fatalf("teardown commands:\n%s", log)
	}
}

// TestWireGuardSlotThreeTeardownTouchesOnlyItsTable guards multi-connection ownership.
func TestWireGuardSlotThreeTeardownTouchesOnlyItsTable(testingObject *testing.T) {
	system := newFakeWireGuardSystem("wg3")
	system.linkExists = true
	driver := newTestWireGuardDriver(testingObject, system, 3)
	if err := driver.teardown(nil); err != nil {
		testingObject.Fatalf("teardown slot three: %v", err)
	}
	log := strings.Join(system.commandLog(), "\n")
	if !strings.Contains(log, "ip -4 route del default dev wg3 metric 0 table 1003") ||
		strings.Contains(log, "table 1000") || strings.Contains(log, "proto 210") {
		testingObject.Fatalf("slot-three teardown:\n%s", log)
	}
	linkDelete := strings.Index(log, "ip link delete dev wg3")
	routeDelete := strings.Index(log, "ip -4 route del default dev wg3 metric 0 table 1003")
	if linkDelete < 0 || routeDelete < 0 || linkDelete >= routeDelete {
		testingObject.Fatalf("session route was removed before wg3:\n%s", log)
	}
}

// TestWireGuardLinkDeleteFailureKeepsSessionRoute retains the safe tunnel default.
func TestWireGuardLinkDeleteFailureKeepsSessionRoute(testingObject *testing.T) {
	system := newFakeWireGuardSystem("wg3")
	system.linkExists = true
	system.failures["ip link delete dev wg3"] = "RTNETLINK answers: operation not permitted\n"
	driver := newTestWireGuardDriver(testingObject, system, 3)
	if err := driver.teardown(nil); err == nil {
		testingObject.Fatal("link deletion failure was ignored")
	}
	log := strings.Join(system.commandLog(), "\n")
	if strings.Contains(log, "ip -4 route del default dev wg3 metric 0 table 1003") {
		testingObject.Fatalf("failed link teardown removed the session route:\n%s", log)
	}
}

// TestWireGuardFailedStartCleansItsOwnTable and link when no handshake arrives.
func TestWireGuardFailedStartCleansItsOwnTable(testingObject *testing.T) {
	system := newFakeWireGuardSystem("wg0")
	system.handshake = 0
	driver := newTestWireGuardDriver(testingObject, system, 0)
	driver.timing.handshakeTimeout = 30 * time.Millisecond
	endpoint := testWireGuardConnection(testingObject, "silent", "192.0.2.10", "10.64.0.1").Endpoints[0]
	_, err := driver.Start(context.Background(), Connection{}, endpoint)
	if err == nil || !strings.Contains(err.Error(), "did not answer a handshake") {
		testingObject.Fatalf("start error = %v", err)
	}
	log := strings.Join(system.commandLog(), "\n")
	if !strings.Contains(log, "ip -4 route del default dev wg0 metric 0 table 1000") ||
		!strings.Contains(log, "ip link delete dev wg0") {
		testingObject.Fatalf("failed-start teardown:\n%s", log)
	}
}

// TestWireGuardHealthProbeBindsTheTunnelAddress verifies source-bound health checks.
func TestWireGuardHealthProbeBindsTheTunnelAddress(testingObject *testing.T) {
	system := newFakeWireGuardSystem("wg0")
	system.probeError = errors.New("timeout")
	driver := newTestWireGuardDriver(testingObject, system, 0)
	driver.timing.healthInterval = 5 * time.Millisecond
	driver.timing.probeInterval = 0
	endpoint := testWireGuardConnection(testingObject, "health", "192.0.2.10", "10.64.0.1").Endpoints[0]
	session, err := driver.Start(context.Background(), Connection{}, endpoint)
	if err != nil {
		testingObject.Fatalf("start WireGuard: %v", err)
	}
	defer session.Stop()
	select {
	case <-session.Done():
	case <-time.After(2 * time.Second):
		testingObject.Fatal("health checks did not end the session")
	}
	system.mutex.Lock()
	probeCalls := system.probeCalls
	probeAddress := system.probeAddress
	system.mutex.Unlock()
	if probeCalls != 3 || probeAddress != "198.18.0.1" {
		testingObject.Fatalf("probe calls/address = %d/%q", probeCalls, probeAddress)
	}
}

// TestWireGuardFallsBackToSlotSpecificUserspace verifies wireguard-go naming.
func TestWireGuardFallsBackToSlotSpecificUserspace(testingObject *testing.T) {
	system := newFakeWireGuardSystem("wg3")
	system.kernelModule = false
	system.failures["ip link add"] = "Error: Unknown device type.\n"
	driver := newTestWireGuardDriver(testingObject, system, 3)
	fakeWireGuardGo := filepath.Join(testingObject.TempDir(), "wireguard-go")
	if err := os.WriteFile(fakeWireGuardGo, []byte("#!/bin/sh\nexec sleep 60\n"), 0o700); err != nil {
		testingObject.Fatalf("write fake wireguard-go: %v", err)
	}
	driver.wireGuardGoPath = fakeWireGuardGo
	var startedCommand *exec.Cmd
	driver.startChild = func(command *exec.Cmd) (*childProcess, error) {
		startedCommand = command
		process, err := startChildProcess(command)
		if err == nil {
			system.mutex.Lock()
			system.linkExists = true
			system.socketReady = true
			system.mutex.Unlock()
		}

		return process, err
	}
	endpoint := testWireGuardConnection(testingObject, "userspace", "192.0.2.10", "10.64.0.1").Endpoints[0]
	session, err := driver.Start(context.Background(), Connection{}, endpoint)
	if err != nil {
		testingObject.Fatalf("start userspace WireGuard: %v", err)
	}
	if strings.Join(startedCommand.Args[1:], " ") != "-f wg3" ||
		!containsString(startedCommand.Env, "WG_PROCESS_FOREGROUND=1") {
		testingObject.Fatalf("wireguard-go command = %v", startedCommand.Args)
	}
	if _, err := os.Stat(filepath.Join(driver.directory, "wireguard-go.pid")); err != nil {
		testingObject.Fatalf("wireguard-go PID file: %v", err)
	}
	session.Stop()
}

// TestWireGuardStaleHandshakeEndsSession notices a dead peer without tearing down early.
func TestWireGuardStaleHandshakeEndsSession(testingObject *testing.T) {
	system := newFakeWireGuardSystem("wg0")
	driver := newTestWireGuardDriver(testingObject, system, 0)
	driver.timing.healthInterval = 5 * time.Millisecond
	endpoint := testWireGuardConnection(testingObject, "stale", "192.0.2.10", "10.64.0.1").Endpoints[0]
	session, err := driver.Start(context.Background(), Connection{}, endpoint)
	if err != nil {
		testingObject.Fatalf("start WireGuard: %v", err)
	}
	defer session.Stop()
	system.advance(181 * time.Second)
	select {
	case <-session.Done():
	case <-time.After(2 * time.Second):
		testingObject.Fatal("stale handshake did not end session")
	}
	if !strings.Contains(session.Err().Error(), "has not answered a handshake") {
		testingObject.Fatalf("session error = %v", session.Err())
	}
}

// TestBootstrapNameservers reads only valid nameserver lines.
func TestBootstrapNameservers(testingObject *testing.T) {
	nameservers := bootstrapNameservers([]byte("# Docker\nnameserver 127.0.0.11\nsearch lan\nnameserver bad\nnameserver 192.168.1.1\n"))
	if strings.Join(nameservers, ",") != "127.0.0.11,192.168.1.1" {
		testingObject.Fatalf("nameservers = %v", nameservers)
	}
}
