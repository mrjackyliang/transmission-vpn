package controller

import (
	"context"
	"fmt"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/provider"
)

// tunnelOrder lists the drivers in a fixed order for startup cleanup.
var tunnelOrder = []string{provider.TunnelOpenVPN, provider.TunnelWireGuard}

// tunnelDriver starts sessions of one tunnel type.
//
// Drivers own only their link, its routes, and any child process. The daemon keeps
// blocking, DNS choice, the resolver, verification, the firewall, and the generation
// guard, so both tunnels pass through the same fail-closed path.
type tunnelDriver interface {
	// Start brings one endpoint up and returns once the tunnel is ready to verify.
	//
	// A failed start leaves nothing behind. When ctx expires first, the returned error
	// wraps ctx.Err() so the daemon can report a timeout.
	Start(ctx context.Context, connection Connection, endpoint Endpoint) (tunnelSession, error)

	// CleanupStale removes links, routes, children, and files a crashed controller left.
	CleanupStale(ctx context.Context) error
}

// tunnelSession is one running tunnel created by a driver.
//
// Stop is idempotent and always closes Done. Done also closes on its own when the
// tunnel dies, and Err then explains why.
type tunnelSession interface {
	// InterfaceName is the device the firewall and verification use.
	InterfaceName() string

	// ProviderDNSServers returns resolvers the provider offered for this tunnel.
	ProviderDNSServers() []string

	// Address is the tunnel's IPv4 source address after policy routing is installed.
	Address() string

	// Details returns live status fields for a protected tunnel.
	Details() sessionDetails

	// Done closes when the tunnel stops or dies.
	Done() <-chan struct{}

	// Err explains why Done closed.
	Err() error

	// Stop tears the tunnel down.
	Stop()
}

// sessionDetails are the live, secret-free facts a session adds to status.
type sessionDetails struct {
	Implementation  string
	LastHandshakeAt time.Time
}

// tunnelInterfaceName returns the slot-specific device a tunnel type uses.
func tunnelInterfaceName(tunnel string, slot int) string {
	if tunnel == provider.TunnelWireGuard {
		return fmt.Sprintf("wg%d", slot)
	}

	return fmt.Sprintf("tun%d", slot)
}

// tunnelLabel returns the display name of a tunnel type for error messages.
func tunnelLabel(tunnel string) string {
	if tunnel == provider.TunnelWireGuard {
		return "WireGuard"
	}

	return "OpenVPN"
}
