package controller

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/netip"
	"strings"
	"time"
)

// directDialTimeout limits each address the controller tries for the console.
const directDialTimeout = 10 * time.Second

// slotAddressPrefix covers the slot addresses and the rest of their benchmark range.
var slotAddressPrefix = netip.MustParsePrefix("198.18.0.0/15")

// directDial opens one TCP connection outside the VPN for the console.
//
// The console uses it for VPN provider catalogs and notifications, which must work
// before any tunnel is up and while every tunnel is down. Hostnames resolve through the
// captured bootstrap nameservers, like tunnel endpoints, and every socket carries the
// controller's mark so the firewall lets it out.
func (daemon *Daemon) directDial(ctx context.Context, address string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return nil, fmt.Errorf("the address must be a host and a port: %w", err)
	}

	candidates := []netip.Addr{}
	if literal, parseError := netip.ParseAddr(host); parseError == nil {
		candidates = append(candidates, literal.Unmap())
	} else {
		addresses, lookupError := daemon.directLookup(ctx, host)
		if lookupError != nil {
			return nil, &net.DNSError{Err: lookupError.Error(), Name: host}
		}
		candidates = addresses
	}

	var dialErrors []string
	for _, candidate := range candidates {
		if !directDestinationAllowed(candidate) {
			dialErrors = append(dialErrors, fmt.Sprintf("%s can't be reached outside the VPN", candidate))

			continue
		}

		dialer := net.Dialer{Timeout: directDialTimeout, Control: markSocket}
		connection, dialError := dialer.DialContext(
			ctx,
			"tcp",
			net.JoinHostPort(candidate.String(), port),
		)
		if dialError == nil {
			return connection, nil
		}
		dialErrors = append(dialErrors, dialError.Error())
	}

	if len(dialErrors) == 0 {
		return nil, &net.DNSError{Err: "no addresses were found", Name: host}
	}

	return nil, errors.New(strings.Join(dialErrors, "; "))
}

// directLookup resolves one host through the bootstrap nameservers.
func (daemon *Daemon) directLookup(ctx context.Context, host string) ([]netip.Addr, error) {
	return bootstrapLookup(bootstrapNameservers(daemon.originalDNS))(ctx, host)
}

// directDestinationAllowed refuses addresses that only make sense inside the container.
//
// Loopback and slot addresses would reach the container's own services, and the
// console has no reason to send outside traffic to them.
func directDestinationAllowed(address netip.Addr) bool {
	if !address.IsValid() || address.IsUnspecified() || address.IsLoopback() ||
		address.IsMulticast() || address.IsInterfaceLocalMulticast() ||
		address.IsLinkLocalMulticast() {
		return false
	}

	return !slotAddressPrefix.Contains(address)
}
