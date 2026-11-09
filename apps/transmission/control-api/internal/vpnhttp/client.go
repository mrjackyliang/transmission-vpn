// Package vpnhttp builds HTTP clients pinned to one protected VPN connection.
//
// The Transmission runner and control API share this transport so remote data
// never falls back to the container resolver or an unprotected source address.
package vpnhttp

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"time"
)

// ErrNotProtected marks a connection that cannot safely carry remote traffic.
//
// Callers treat this as a quiet wait or fallback state instead of attempting a
// request through the container's ordinary network path.
//
// Since: UNRELEASED
var ErrNotProtected = errors.New("default VPN connection is not protected")

// Route contains one protected connection's outbound network parameters.
//
// SourceIP pins DNS and HTTP sockets to the slot address, while DNSServers come
// only from the matching protected controller status.
//
// Since: UNRELEASED
type Route struct {
	SourceIP   net.IP
	DNSServers []string
}

// ClientOptions configures one source-bound HTTP client.
//
// Production callers supply their URL and destination policies while sharing
// the same resolver, source binding, redirect handling, and TLS floor.
//
// Since: UNRELEASED
type ClientOptions struct {
	Route                 Route
	ConnectTimeout        time.Duration
	ResponseHeaderTimeout time.Duration
	RequestTimeout        time.Duration
	MaximumRedirects      int
	RootCAs               *x509.CertPool
	DNSPort               string
	DialContext           func(*net.Dialer, context.Context, string, string) (net.Conn, error)
	ValidateURL           func(*url.URL) error
	ValidateAddress       func(netip.Addr) error
}

// vpnStatus is the controller projection needed for protected downloads.
//
// Keeping this contract local avoids coupling unprivileged HTTP consumers to
// the privileged controller implementation package.
type vpnStatus struct {
	ConnectionID string   `json:"connectionId"`
	Slot         int      `json:"slot"`
	State        string   `json:"state"`
	DNSServers   []string `json:"dnsServers"`
}

// ProtectedRoute returns the route for one currently protected connection.
//
// The status identity and slot must match the caller's durable connection
// selection before its fixed source address and VPN DNS servers are exposed.
//
// Since: UNRELEASED
func ProtectedRoute(
	runtimeDirectory string,
	connectionID string,
	slot int,
	bindAddressForSlot func(int) (string, error),
) (Route, error) {
	if connectionID == "" || slot < 0 {
		return Route{}, ErrNotProtected
	}

	statusPath := filepath.Join(
		runtimeDirectory,
		"vpn.status.d",
		connectionID+".json",
	)
	content, err := os.ReadFile(statusPath)
	if err != nil {
		return Route{}, ErrNotProtected
	}

	var status vpnStatus
	if err := json.Unmarshal(content, &status); err != nil ||
		status.State != "protected" ||
		status.ConnectionID != connectionID ||
		status.Slot != slot {
		return Route{}, ErrNotProtected
	}

	bindAddress, err := bindAddressForSlot(slot)
	if err != nil {
		return Route{}, err
	}
	sourceIP := net.ParseIP(bindAddress).To4()
	if sourceIP == nil {
		return Route{}, errors.New("protected source bind address is not IPv4")
	}

	dnsServers := make([]string, 0, len(status.DNSServers))
	for _, server := range status.DNSServers {
		address, parseError := netip.ParseAddr(server)
		if parseError == nil && address.Unmap().Is4() {
			dnsServers = append(dnsServers, address.Unmap().String())
		}
	}

	return Route{
		SourceIP:   sourceIP,
		DNSServers: dnsServers,
	}, nil
}

// NewClient builds one source-address- and resolver-pinned HTTP client.
//
// Hostnames resolve only through NewResolver, and every resulting connection
// is checked by the caller's destination policy before the bound dial occurs.
//
// Since: UNRELEASED
func NewClient(options ClientOptions) *http.Client {
	dialContext := options.DialContext
	if dialContext == nil {
		dialContext = func(
			dialer *net.Dialer,
			ctx context.Context,
			network string,
			address string,
		) (net.Conn, error) {
			return dialer.DialContext(ctx, network, address)
		}
	}

	resolver := NewResolver(
		options.Route,
		options.ConnectTimeout,
		options.DNSPort,
		dialContext,
	)
	transport := &http.Transport{
		Proxy:                 nil,
		DisableCompression:    true,
		ForceAttemptHTTP2:     true,
		TLSHandshakeTimeout:   options.ConnectTimeout,
		ResponseHeaderTimeout: options.ResponseHeaderTimeout,
		TLSClientConfig: &tls.Config{
			MinVersion: tls.VersionTLS12,
			RootCAs:    options.RootCAs,
		},
	}
	transport.DialContext = func(
		ctx context.Context,
		network string,
		address string,
	) (net.Conn, error) {
		if network != "tcp" && network != "tcp4" {
			return nil, fmt.Errorf("unsupported protected HTTP network %s", network)
		}

		host, port, err := net.SplitHostPort(address)
		if err != nil {
			return nil, fmt.Errorf("parse protected HTTP destination: %w", err)
		}
		if err := validatePort(port); err != nil {
			return nil, err
		}

		resolved, err := ResolveIPv4Host(
			ctx,
			host,
			resolver,
			options.ValidateAddress,
		)
		if err != nil {
			return nil, err
		}

		dialer := &net.Dialer{
			Timeout:   options.ConnectTimeout,
			KeepAlive: 30 * time.Second,
			LocalAddr: &net.TCPAddr{IP: options.Route.SourceIP},
		}

		return dialContext(
			dialer,
			ctx,
			"tcp4",
			net.JoinHostPort(resolved, port),
		)
	}

	return &http.Client{
		Transport: transport,
		Timeout:   options.RequestTimeout,
		CheckRedirect: func(request *http.Request, via []*http.Request) error {
			if len(via) > options.MaximumRedirects {
				return fmt.Errorf("more than %d redirects", options.MaximumRedirects)
			}
			if options.ValidateURL == nil {
				return nil
			}

			return options.ValidateURL(request.URL)
		},
	}
}

// NewResolver sends DNS through a protected connection's resolver list.
//
// UDP queries and TCP retries use the same slot source address as the HTTP
// connection, preventing name resolution from escaping through container DNS.
//
// Since: UNRELEASED
func NewResolver(
	route Route,
	connectTimeout time.Duration,
	dnsPort string,
	dialContext func(*net.Dialer, context.Context, string, string) (net.Conn, error),
) *net.Resolver {
	servers := append([]string(nil), route.DNSServers...)
	if dnsPort == "" {
		dnsPort = "53"
	}
	var nextServer atomic.Uint64

	return &net.Resolver{
		PreferGo:     true,
		StrictErrors: true,
		Dial: func(ctx context.Context, network string, _ string) (net.Conn, error) {
			if len(servers) == 0 {
				return nil, errors.New("VPN connection has no DNS servers")
			}

			start := int(nextServer.Add(1)-1) % len(servers)
			var lastError error
			for offset := range servers {
				server := servers[(start+offset)%len(servers)]
				dialer := &net.Dialer{Timeout: connectTimeout}
				dialNetwork := ""
				switch {
				case strings.HasPrefix(network, "udp"):
					dialNetwork = "udp4"
					dialer.LocalAddr = &net.UDPAddr{IP: route.SourceIP}
				case strings.HasPrefix(network, "tcp"):
					dialNetwork = "tcp4"
					dialer.LocalAddr = &net.TCPAddr{IP: route.SourceIP}
				default:
					return nil, fmt.Errorf("unsupported DNS network %s", network)
				}

				connection, err := dialContext(
					dialer,
					ctx,
					dialNetwork,
					net.JoinHostPort(server, dnsPort),
				)
				if err == nil {
					return connection, nil
				}
				lastError = err
			}

			return nil, lastError
		},
	}
}

// ResolveIPv4Host resolves one destination through a protected resolver.
//
// Every returned address is validated before the first one is selected, so a
// mixed public and forbidden DNS answer cannot exploit address ordering.
//
// Since: UNRELEASED
func ResolveIPv4Host(
	ctx context.Context,
	host string,
	resolver *net.Resolver,
	validateAddress func(netip.Addr) error,
) (string, error) {
	if literal, err := netip.ParseAddr(host); err == nil {
		literal = literal.Unmap()
		if !literal.Is4() {
			return "", errors.New("protected HTTP destinations must have an IPv4 address")
		}
		if validateAddress != nil {
			if err := validateAddress(literal); err != nil {
				return "", err
			}
		}

		return literal.String(), nil
	}

	addresses, err := resolver.LookupNetIP(ctx, "ip4", host)
	if err != nil {
		return "", fmt.Errorf("resolve protected HTTP destination: %w", err)
	}
	resolved := ""
	for _, address := range addresses {
		address = address.Unmap()
		if !address.Is4() {
			continue
		}
		if validateAddress != nil {
			if err := validateAddress(address); err != nil {
				return "", err
			}
		}
		if resolved == "" {
			resolved = address.String()
		}
	}
	if resolved == "" {
		return "", errors.New("protected HTTP destination has no IPv4 address")
	}

	return resolved, nil
}

// validatePort accepts one numeric TCP destination port.
//
// Rejecting malformed transport addresses keeps them away from the bound dialer
// even if an upstream URL parser accepted their textual representation.
func validatePort(value string) error {
	port, err := strconv.Atoi(value)
	if err != nil || port < 1 || port > 65535 {
		return errors.New("protected HTTP destination has an invalid port")
	}

	return nil
}
