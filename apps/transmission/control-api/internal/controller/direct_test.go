package controller

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/netip"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/directdial"
)

// TestControllerMarksAgree keeps every marked path on the firewall's one mark.
func TestControllerMarksAgree(testingObject *testing.T) {
	if wireGuardFirewallMark != fmt.Sprintf("%#x", directdial.Mark) {
		testingObject.Fatalf(
			"WireGuard mark %s differs from the firewall mark %#x",
			wireGuardFirewallMark,
			directdial.Mark,
		)
	}

	arguments := openVPNArguments("active.ovpn", "status.txt", "openvpn.pid")
	markIndex := slices.Index(arguments, "--mark")
	if markIndex < 0 || markIndex+1 >= len(arguments) ||
		arguments[markIndex+1] != strconv.Itoa(directdial.Mark) {
		testingObject.Fatalf("OpenVPN arguments %q don't mark the tunnel with %d", arguments, directdial.Mark)
	}
}

// TestDirectDestinationAllowed refuses addresses that only reach the container.
func TestDirectDestinationAllowed(testingObject *testing.T) {
	refused := []string{
		"127.0.0.1",
		"::1",
		"0.0.0.0",
		"198.18.0.1",
		"198.18.63.1",
		"198.19.255.254",
		"224.0.0.251",
		"ff02::1",
	}
	for _, address := range refused {
		if directDestinationAllowed(netip.MustParseAddr(address)) {
			testingObject.Errorf("%s was allowed outside the VPN", address)
		}
	}

	allowed := []string{
		"1.1.1.1",
		"192.168.1.10",
		"10.0.0.5",
		"2606:4700:4700::1111",
	}
	for _, address := range allowed {
		if !directDestinationAllowed(netip.MustParseAddr(address)) {
			testingObject.Errorf("%s was refused outside the VPN", address)
		}
	}
}

// TestDirectDialRefusesLoopbackWithoutDialing answers before any socket opens.
func TestDirectDialRefusesLoopbackWithoutDialing(testingObject *testing.T) {
	daemon := newTestDaemon(testingObject)

	_, err := daemon.directDial(context.Background(), "127.0.0.1:22602")
	if err == nil || !strings.Contains(err.Error(), "can't be reached outside the VPN") {
		testingObject.Fatalf("loopback dial error = %v, want a refusal", err)
	}
}

// TestDirectDialReportsLookupFailuresAsDNSErrors keeps the console's lookup retries.
func TestDirectDialReportsLookupFailuresAsDNSErrors(testingObject *testing.T) {
	daemon := newTestDaemon(testingObject)
	daemon.originalDNS = []byte("# no nameserver lines\n")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := daemon.directDial(ctx, "catalog.example:443")

	var lookupError *net.DNSError
	if !errors.As(err, &lookupError) || lookupError.Name != "catalog.example" {
		testingObject.Fatalf("lookup failure = %v, want a *net.DNSError for catalog.example", err)
	}
}
