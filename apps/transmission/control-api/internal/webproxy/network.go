package webproxy

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/netip"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const (
	dialTimeout       = 30 * time.Second
	tunnelIdleTimeout = 10 * time.Minute
)

var (
	errVPNNotProtected       = errors.New("VPN is not protected")
	errDestinationNotAllowed = errors.New("destination is not allowed")
	errUnsupportedAddress    = errors.New("address type is not supported")

	allowedClientNetworks = []netip.Prefix{
		netip.MustParsePrefix("10.0.0.0/8"),
		netip.MustParsePrefix("172.16.0.0/12"),
		netip.MustParsePrefix("192.168.0.0/16"),
		netip.MustParsePrefix("fc00::/7"),
		netip.MustParsePrefix("fe80::/10"),
	}

	blockedDestinationNetworks = []netip.Prefix{
		netip.MustParsePrefix("0.0.0.0/8"),
		netip.MustParsePrefix("10.0.0.0/8"),
		netip.MustParsePrefix("100.64.0.0/10"),
		netip.MustParsePrefix("127.0.0.0/8"),
		netip.MustParsePrefix("169.254.0.0/16"),
		netip.MustParsePrefix("172.16.0.0/12"),
		netip.MustParsePrefix("192.0.0.0/24"),
		netip.MustParsePrefix("192.0.2.0/24"),
		netip.MustParsePrefix("192.168.0.0/16"),
		netip.MustParsePrefix("198.18.0.0/15"),
		netip.MustParsePrefix("198.51.100.0/24"),
		netip.MustParsePrefix("203.0.113.0/24"),
		netip.MustParsePrefix("224.0.0.0/4"),
		netip.MustParsePrefix("240.0.0.0/4"),
	}
)

// addressResolver is the standard resolver capability used by the guarded dialer.
type addressResolver interface {
	LookupNetIP(context.Context, string, string) ([]netip.Addr, error)
}

// outboundLoginContextKey carries the credential-selected route into http.Transport.
type outboundLoginContextKey struct{}

// vpnRoute is the protected source address and resolver for one authenticated login.
type vpnRoute struct {
	sourceIP net.IP
	resolver addressResolver
}

// isAllowedClient accepts only the explicitly supported private client networks.
func isAllowedClient(remoteAddress net.Addr) bool {
	address, found := addressFromNetAddress(remoteAddress)
	if !found {
		return false
	}

	for _, network := range allowedClientNetworks {
		if network.Contains(address) {
			return true
		}
	}

	return false
}

// addressFromNetAddress extracts and normalizes an IP from a socket address.
func addressFromNetAddress(remoteAddress net.Addr) (netip.Addr, bool) {
	if remoteAddress == nil {
		return netip.Addr{}, false
	}
	if tcpAddress, ok := remoteAddress.(*net.TCPAddr); ok {
		address, found := netip.AddrFromSlice(tcpAddress.IP)
		if !found {
			return netip.Addr{}, false
		}

		return address.Unmap(), true
	}

	host, _, err := net.SplitHostPort(remoteAddress.String())
	if err != nil {
		host = strings.Trim(remoteAddress.String(), "[]")
	}
	address, err := netip.ParseAddr(host)
	if err != nil {
		return netip.Addr{}, false
	}

	return address.Unmap(), true
}

// clientLimitKey identifies one private-network client by its complete IP address.
func clientLimitKey(remoteAddress net.Addr) string {
	address, found := addressFromNetAddress(remoteAddress)
	if found {
		return address.WithZone("").String()
	}
	if remoteAddress == nil {
		return "unknown"
	}

	return remoteAddress.String()
}

// isAllowedDestination accepts only public IPv4 addresses outside every blocked range.
func isAllowedDestination(address net.IP) bool {
	parsed, found := netip.AddrFromSlice(address)
	if !found {
		return false
	}
	parsed = parsed.Unmap()
	if !parsed.Is4() || !parsed.IsGlobalUnicast() {
		return false
	}

	for _, network := range blockedDestinationNetworks {
		if network.Contains(parsed) {
			return false
		}
	}

	return true
}

// dialHTTPGuarded selects the route attached to one HTTP request.
func (service *Service) dialHTTPGuarded(
	ctx context.Context,
	network string,
	address string,
) (net.Conn, error) {
	login, _ := ctx.Value(outboundLoginContextKey{}).(Login)

	return service.dialGuardedForLogin(ctx, login, network, address)
}

// dialGuarded preserves the default-route entry point used by focused tests.
func (service *Service) dialGuarded(
	ctx context.Context,
	network string,
	address string,
) (net.Conn, error) {
	return service.dialGuardedForLogin(ctx, Login{}, network, address)
}

// dialGuardedForLogin resolves and dials through the login's selected connection.
func (service *Service) dialGuardedForLogin(
	ctx context.Context,
	login Login,
	network string,
	address string,
) (net.Conn, error) {
	if network != "tcp" && network != "tcp4" {
		return nil, errUnsupportedAddress
	}
	route, protected := service.routeForLogin(login)
	if !protected {
		return nil, errVPNNotProtected
	}

	host, portText, err := net.SplitHostPort(address)
	if err != nil {
		return nil, fmt.Errorf("parse destination: %w", err)
	}
	port, err := strconv.Atoi(portText)
	if err != nil || port < 1 || port > 65535 {
		return nil, errUnsupportedAddress
	}

	dialContext, cancel := context.WithTimeout(ctx, dialTimeout)
	defer cancel()

	resolvedAddress, err := service.resolveDestinationWith(
		dialContext,
		host,
		route.resolver,
	)
	if err != nil {
		return nil, err
	}

	exactAddress := net.JoinHostPort(resolvedAddress.String(), portText)
	dialer := &net.Dialer{
		Timeout:   dialTimeout,
		KeepAlive: 30 * time.Second,
		LocalAddr: &net.TCPAddr{IP: route.sourceIP},
	}
	var connection net.Conn
	if service.rawDialContext != nil {
		connection, err = service.rawDialContext(dialContext, "tcp4", exactAddress)
	} else {
		connection, err = service.dialContext(dialer, dialContext, "tcp4", exactAddress)
	}
	if err != nil {
		return nil, err
	}

	return connection, nil
}

// resolveDestination returns the first permitted IPv4 result for a host or literal.
func (service *Service) resolveDestination(ctx context.Context, host string) (net.IP, error) {
	return service.resolveDestinationWith(ctx, host, service.resolver)
}

// resolveDestinationWith applies destination policy to one connection's resolver.
func (service *Service) resolveDestinationWith(
	ctx context.Context,
	host string,
	resolver addressResolver,
) (net.IP, error) {
	if literal, err := netip.ParseAddr(host); err == nil {
		literal = literal.WithZone("").Unmap()
		parsed := net.IP(literal.AsSlice())
		if !service.destinationAllowed(parsed) {
			return nil, errDestinationNotAllowed
		}

		return parsed.To4(), nil
	}

	addresses, err := resolver.LookupNetIP(ctx, "ip4", host)
	if err != nil {
		return nil, fmt.Errorf("resolve destination: %w", err)
	}
	for _, address := range addresses {
		address = address.Unmap()
		if !address.Is4() {
			continue
		}

		parsed := net.IP(address.AsSlice())
		if service.destinationAllowed(parsed) {
			return parsed, nil
		}
	}

	return nil, errDestinationNotAllowed
}

// routeForLogin returns only a currently protected credential-selected route.
func (service *Service) routeForLogin(login Login) (vpnRoute, bool) {
	if login.ConnectionID == "" {
		if !service.vpnProtected() {
			return vpnRoute{}, false
		}
		sourceIP := net.ParseIP(service.vpnAddress()).To4()
		if sourceIP == nil {
			return vpnRoute{}, false
		}

		return vpnRoute{sourceIP: sourceIP, resolver: service.resolver}, true
	}

	state := service.vpnState.connection(login.ConnectionID)
	sourceIP := net.ParseIP(state.sourceAddress).To4()
	if !state.protected || sourceIP == nil {
		return vpnRoute{}, false
	}

	return vpnRoute{
		sourceIP: sourceIP,
		resolver: service.connectionResolver(sourceIP, state.dnsServers),
	}, true
}

// connectionResolver sends all DNS traffic through the selected slot and DNS list.
func (service *Service) connectionResolver(sourceIP net.IP, dnsServers []string) addressResolver {
	servers := append([]string(nil), dnsServers...)
	var nextServer atomic.Uint64

	return &net.Resolver{
		PreferGo:     true,
		StrictErrors: true,
		Dial: func(ctx context.Context, network string, _ string) (net.Conn, error) {
			if len(servers) == 0 {
				return nil, errors.New("VPN connection has no DNS servers")
			}

			startIndex := int(nextServer.Add(1)-1) % len(servers)
			var lastError error
			for offset := range servers {
				server := servers[(startIndex+offset)%len(servers)]
				dialer := &net.Dialer{Timeout: dialTimeout}
				dialNetwork := ""
				switch {
				case strings.HasPrefix(network, "udp"):
					dialNetwork = "udp4"
					dialer.LocalAddr = &net.UDPAddr{IP: sourceIP}
				case strings.HasPrefix(network, "tcp"):
					dialNetwork = "tcp4"
					dialer.LocalAddr = &net.TCPAddr{IP: sourceIP}
				default:
					return nil, errUnsupportedAddress
				}

				connection, err := service.dialContext(
					dialer,
					ctx,
					dialNetwork,
					net.JoinHostPort(server, "53"),
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

// anyLoginProtected drives the aggregate public status without changing routing.
func (service *Service) anyLoginProtected() bool {
	service.mutex.Lock()
	logins := append([]Login(nil), service.runtimeConfig.Logins...)
	service.mutex.Unlock()

	for _, login := range logins {
		if _, protected := service.routeForLogin(login); protected {
			return true
		}
	}

	return false
}

// bufferedConnection preserves bytes read ahead while exposing the original socket.
type bufferedConnection struct {
	net.Conn
	reader *bufio.Reader
}

// Read consumes buffered protocol bytes before returning to the socket.
func (connection *bufferedConnection) Read(content []byte) (int, error) {
	return connection.reader.Read(content)
}

// tunnelActivity shares one idle deadline across both directions of a tunnel.
type tunnelActivity struct {
	mutex       sync.Mutex
	connections []net.Conn
	timeout     time.Duration
}

// touch extends both sockets whenever either tunnel direction moves data.
func (activity *tunnelActivity) touch() {
	activity.mutex.Lock()
	defer activity.mutex.Unlock()

	deadline := time.Now().Add(activity.timeout)
	for _, connection := range activity.connections {
		_ = connection.SetDeadline(deadline)
	}
}

// activeConnection refreshes a tunnel's shared idle deadline around I/O.
type activeConnection struct {
	net.Conn
	activity *tunnelActivity
}

// Read refreshes the shared tunnel deadline when bytes arrive.
func (connection *activeConnection) Read(content []byte) (int, error) {
	connection.activity.touch()
	count, err := connection.Conn.Read(content)
	if count > 0 {
		connection.activity.touch()
	}

	return count, err
}

// Write refreshes the shared tunnel deadline when bytes leave.
func (connection *activeConnection) Write(content []byte) (int, error) {
	connection.activity.touch()
	count, err := connection.Conn.Write(content)
	if count > 0 {
		connection.activity.touch()
	}

	return count, err
}

// copyTunnel copies both directions until either side closes or stays idle too long.
func copyTunnel(clientConnection net.Conn, destinationConnection net.Conn) {
	activity := &tunnelActivity{
		connections: []net.Conn{clientConnection, destinationConnection},
		timeout:     tunnelIdleTimeout,
	}
	activity.touch()
	client := &activeConnection{Conn: clientConnection, activity: activity}
	destination := &activeConnection{Conn: destinationConnection, activity: activity}

	copyResults := make(chan struct{}, 2)
	copyOneDirection := func(destinationWriter io.Writer, sourceReader io.Reader) {
		_, _ = io.Copy(destinationWriter, sourceReader)
		copyResults <- struct{}{}
	}
	go copyOneDirection(destination, client)
	go copyOneDirection(client, destination)

	<-copyResults
	_ = clientConnection.Close()
	_ = destinationConnection.Close()
	<-copyResults
}
