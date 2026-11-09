package controller

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/netip"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestOpenVPNOutputCapturesPushedDNS verifies comma-delimited provider options.
func TestOpenVPNOutputCapturesPushedDNS(testingObject *testing.T) {
	output := &openVPNOutput{
		logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		ready:  make(chan struct{}),
	}
	output.observeLine(
		"PUSH_REPLY,redirect-gateway def1,dhcp-option DNS 135.136.7.35," +
			"dhcp-option DNS 135.136.7.37,ping-restart 120",
	)

	if got := strings.Join(output.DNSServers(), ","); got != "135.136.7.35,135.136.7.37" {
		testingObject.Fatalf("pushed DNS servers = %s", got)
	}
}

// TestOpenVPNOutputCapturesPublicFailure keeps child diagnostics secret-free.
func TestOpenVPNOutputCapturesPublicFailure(testingObject *testing.T) {
	output := &openVPNOutput{
		logger:     slog.New(slog.NewTextHandler(io.Discard, nil)),
		ready:      make(chan struct{}),
		redactions: []string{"secret-password"},
	}
	output.observeLine("AUTH_FAILED secret-password")

	if failure := output.Failure(); failure != "OpenVPN authentication failed" || strings.Contains(failure, "secret-password") {
		testingObject.Fatalf("public OpenVPN failure = %q", failure)
	}
}

// TestOpenVPNRuntimeConfigurationOwnsRoutesAndSlot verifies the ephemeral rewrite.
func TestOpenVPNRuntimeConfigurationOwnsRoutesAndSlot(testingObject *testing.T) {
	stored := []byte("client\ndev tun0\nauth-user-pass /run/transmission-vpn/openvpn/auth\nremote vpn.example.test 1194\n")
	runtime := string(runtimeOpenVPNConfiguration(
		stored,
		"tun3",
		"/run/transmission-vpn/openvpn/3/auth",
		"203.0.113.8",
	))
	for _, expected := range []string{
		"dev tun3",
		"auth-user-pass /run/transmission-vpn/openvpn/3/auth",
		"remote 203.0.113.8 1194",
		"route-noexec",
	} {
		if !strings.Contains(runtime, expected) {
			testingObject.Errorf("runtime profile does not contain %q:\n%s", expected, runtime)
		}
	}
	for _, forbidden := range []string{"dev tun0", "remote vpn.example.test", "redirect-gateway", "net_gateway"} {
		if strings.Contains(runtime, forbidden) {
			testingObject.Errorf("runtime profile contains %q:\n%s", forbidden, runtime)
		}
	}
}

// TestWriteConnectionFilesUsesTheSlotDirectory keeps stored and runtime data separate.
func TestWriteConnectionFilesUsesTheSlotDirectory(testingObject *testing.T) {
	driver := &openVPNDriver{
		directory:     filepath.Join(testingObject.TempDir(), "openvpn", "3"),
		interfaceName: "tun3",
	}
	if err := os.MkdirAll(driver.directory, 0o700); err != nil {
		testingObject.Fatalf("create runtime directory: %v", err)
	}
	if err := driver.writeConnectionFiles(
		Connection{Username: "test-user", Password: "test-password"},
		Endpoint{Configuration: []byte("client\ndev tun0\nauth-user-pass /run/transmission-vpn/openvpn/auth\n")},
		"203.0.113.8",
	); err != nil {
		testingObject.Fatalf("write connection files: %v", err)
	}
	content, err := os.ReadFile(filepath.Join(driver.directory, "active.ovpn"))
	if err != nil {
		testingObject.Fatalf("read runtime profile: %v", err)
	}
	if !strings.Contains(string(content), "dev tun3") || !strings.Contains(string(content), "route-noexec") {
		testingObject.Fatalf("runtime profile:\n%s", content)
	}
}

// TestOpenVPNInterfaceAddressReadsLocalJSON rejects net30 and p2p peer addresses.
func TestOpenVPNInterfaceAddressReadsLocalJSON(testingObject *testing.T) {
	testCases := []struct {
		name   string
		output string
		want   string
	}{
		{
			name:   "net30",
			output: `[{"ifname":"tun0","addr_info":[{"family":"inet","local":"10.8.0.6","peer":"10.8.0.5","prefixlen":32,"scope":"global"}]}]`,
			want:   "10.8.0.6",
		},
		{
			name:   "p2p",
			output: `[{"ifname":"tun0","addr_info":[{"family":"inet","local":"10.9.0.10","peer":"10.9.0.1","prefixlen":32,"scope":"global"}]}]`,
			want:   "10.9.0.10",
		},
		{
			name:   "subnet",
			output: `[{"ifname":"tun0","addr_info":[{"family":"inet","local":"10.10.0.22","prefixlen":24,"scope":"global"}]}]`,
			want:   "10.10.0.22",
		},
	}

	for _, testCase := range testCases {
		testingObject.Run(testCase.name, func(testingObject *testing.T) {
			driver := &openVPNDriver{
				ipPath:        "/sbin/ip",
				interfaceName: "tun0",
				run: func(_ context.Context, _ string, arguments ...string) ([]byte, error) {
					if strings.Join(arguments, " ") != "-j -4 address show dev tun0" {
						testingObject.Fatalf("address command = %v", arguments)
					}

					return []byte(testCase.output), nil
				},
			}
			address, err := driver.interfaceAddress(context.Background())
			if err != nil || address != testCase.want {
				testingObject.Fatalf("interface address = %q, %v; want %q", address, err, testCase.want)
			}
		})
	}
}

// TestOpenVPNRemovesMainConnectedRoute leaves provider subnets out of main.
func TestOpenVPNRemovesMainConnectedRoute(testingObject *testing.T) {
	var command string
	driver := &openVPNDriver{
		ipPath:        "/sbin/ip",
		interfaceName: "tun3",
		run: func(_ context.Context, _ string, arguments ...string) ([]byte, error) {
			command = strings.Join(arguments, " ")

			return nil, nil
		},
	}
	if err := driver.removeMainConnectedRoute(context.Background()); err != nil {
		testingObject.Fatalf("remove connected route: %v", err)
	}
	if command != "-4 route flush table main dev tun3 proto kernel" {
		testingObject.Fatalf("connected-route command = %q", command)
	}
}

// TestOpenVPNEndpointUsesBootstrapDNS verifies the runtime copy receives an IPv4 literal.
func TestOpenVPNEndpointUsesBootstrapDNS(testingObject *testing.T) {
	driver := &openVPNDriver{
		directory:     testingObject.TempDir(),
		interfaceName: "tun0",
		lookupIPv4: func(_ context.Context, host string) ([]netip.Addr, error) {
			if host != "vpn.example.test" {
				testingObject.Fatalf("resolved host = %q", host)
			}

			return []netip.Addr{netip.MustParseAddr("203.0.113.44")}, nil
		},
	}
	address, err := driver.resolveEndpoint(context.Background(), "vpn.example.test")
	if err != nil {
		testingObject.Fatalf("resolve OpenVPN endpoint: %v", err)
	}
	configuration := []byte("client\ndev tun0\nremote vpn.example.test 1194\nverify-x509-name vpn.example.test name\n")
	if err := driver.writeConnectionFiles(
		Connection{Username: "user", Password: "password"},
		Endpoint{Configuration: configuration},
		address.String(),
	); err != nil {
		testingObject.Fatalf("write resolved OpenVPN profile: %v", err)
	}
	content, err := os.ReadFile(filepath.Join(driver.directory, "active.ovpn"))
	if err != nil {
		testingObject.Fatalf("read resolved OpenVPN profile: %v", err)
	}
	runtime := string(content)
	if !strings.Contains(runtime, "remote 203.0.113.44 1194") ||
		!strings.Contains(runtime, "verify-x509-name vpn.example.test name") ||
		strings.Contains(runtime, "remote vpn.example.test") {
		testingObject.Fatalf("resolved runtime profile:\n%s", runtime)
	}
}

// TestStartOpenVPNRemapsInternalRestartsToExit verifies supervisor ownership.
func TestStartOpenVPNRemapsInternalRestartsToExit(testingObject *testing.T) {
	driver := fakeOpenVPNProcessDriver(testingObject)
	session, err := driver.startOpenVPN(Connection{})
	if err != nil {
		testingObject.Fatalf("start fake OpenVPN: %v", err)
	}
	defer session.process.stop()

	found := false
	for index := 0; index+1 < len(session.process.command.Args); index++ {
		if session.process.command.Args[index] == "--remap-usr1" &&
			session.process.command.Args[index+1] == "SIGTERM" {
			found = true
		}
	}
	if !found {
		testingObject.Fatalf("OpenVPN arguments = %v", session.process.command.Args)
	}
}

// TestOpenVPNSessionStopRemovesOnlyItsPolicyTable verifies slot-owned teardown.
func TestOpenVPNSessionStopRemovesOnlyItsPolicyTable(testingObject *testing.T) {
	driver := fakeOpenVPNProcessDriver(testingObject)
	commands := []string{}
	var session *openVPNSession
	var err error
	driver.slot = 3
	driver.interfaceName = "tun3"
	driver.run = func(_ context.Context, _ string, arguments ...string) ([]byte, error) {
		if session != nil {
			select {
			case <-session.process.exited:
			default:
				testingObject.Fatal("OpenVPN session route was removed before the child exited")
			}
		}
		commands = append(commands, strings.Join(arguments, " "))
		if strings.Contains(strings.Join(arguments, " "), "rule del") {
			return []byte("RTNETLINK answers: No such file or directory"), errors.New("exit status 2")
		}

		return nil, nil
	}
	if err := driver.writeConnectionFiles(
		Connection{Username: "test-user", Password: "test-password"},
		Endpoint{Configuration: []byte("client\ndev tun0\n")},
		"203.0.113.8",
	); err != nil {
		testingObject.Fatalf("write connection files: %v", err)
	}
	session, err = driver.startOpenVPN(Connection{})
	if err != nil {
		testingObject.Fatalf("start fake OpenVPN: %v", err)
	}
	session.Stop()

	joined := strings.Join(commands, "\n")
	if !strings.Contains(joined, "-4 route del default dev tun3 metric 0 table 1003") ||
		strings.Contains(joined, "rule del") || strings.Contains(joined, "route flush table 1003") {
		testingObject.Fatalf("teardown commands:\n%s", joined)
	}
}

func fakeOpenVPNProcessDriver(testingObject *testing.T) *openVPNDriver {
	testingObject.Helper()
	directory := testingObject.TempDir()
	path := filepath.Join(directory, "fake-openvpn")
	if err := os.WriteFile(path, []byte("#!/bin/sh\nexec sleep 60\n"), 0o700); err != nil {
		testingObject.Fatalf("write fake OpenVPN: %v", err)
	}

	return &openVPNDriver{
		directory:     directory,
		openVPNPath:   path,
		ipPath:        "/sbin/ip",
		interfaceName: "tun0",
		slot:          0,
		logger:        slog.New(slog.NewTextHandler(io.Discard, nil)),
		run: func(context.Context, string, ...string) ([]byte, error) {
			return []byte("RTNETLINK answers: No such file or directory"), errors.New("exit status 2")
		},
	}
}
