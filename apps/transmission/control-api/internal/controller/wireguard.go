package controller

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/netip"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/provider"
)

const (
	// wireGuardFirewallMark marks each WireGuard interface's encrypted packets.
	//
	// Kernel WireGuard sends them with the sender's socket attached, so Transmission's
	// owner firewall would drop them on eth0; firewall-common.sh accepts only UDP with
	// this mark, which Transmission can't set itself.
	wireGuardFirewallMark = "0xca6c"

	// wireGuardImplementationKernel and wireGuardImplementationUserspace name the engines.
	wireGuardImplementationKernel    = "kernel"
	wireGuardImplementationUserspace = "userspace"
)

// wireGuardSocketPath returns wireguard-go's slot-specific control socket.
func wireGuardSocketPath(interfaceName string) string {
	return filepath.Join("/var/run/wireguard", interfaceName+".sock")
}

// wireGuardTiming holds the driver's waits and health thresholds.
//
// Production uses defaultWireGuardTiming; tests shorten every value.
type wireGuardTiming struct {
	linkTimeout      time.Duration
	handshakeTimeout time.Duration
	handshakePoll    time.Duration
	healthInterval   time.Duration
	probeInterval    time.Duration
	staleHandshake   time.Duration
	probeFailures    int
}

// defaultWireGuardTiming notices a dead server in about 90 seconds.
//
// The handshake age is read every 10 seconds; WireGuard re-handshakes at least every
// two minutes on a live tunnel, so 180 seconds without one means the server is gone.
// A TCP check through the tunnel every 30 seconds catches a server that keeps
// handshaking but no longer forwards traffic: three failures in a row end the session.
var defaultWireGuardTiming = wireGuardTiming{
	linkTimeout:      5 * time.Second,
	handshakeTimeout: 30 * time.Second,
	handshakePoll:    500 * time.Millisecond,
	healthInterval:   10 * time.Second,
	probeInterval:    30 * time.Second,
	staleHandshake:   180 * time.Second,
	probeFailures:    3,
}

// wireGuardDriver creates one slot-specific link with the kernel module or wireguard-go.
//
// It configures the link with wg(8) only; wg-quick is never used, so no file can run
// a command, change a firewall, or set a routing mark.
type wireGuardDriver struct {
	directory       string
	ipPath          string
	wgPath          string
	wireGuardGoPath string
	implementation  string
	interfaceName   string
	slot            int
	logger          *slog.Logger
	timing          wireGuardTiming
	lookupIPv4      func(ctx context.Context, host string) ([]netip.Addr, error)
	run             func(ctx context.Context, name string, arguments ...string) ([]byte, error)
	startChild      func(command *exec.Cmd) (*childProcess, error)
	pathExists      func(path string) bool
	readFile        func(path string) ([]byte, error)
	now             func() time.Time
	probe           func(ctx context.Context, address string) error
}

// wireGuardSession is one configured slot-specific link and its health watch.
//
// Done closes when the watch finds the tunnel dead or when Stop runs; the link and
// session route stay until Stop, which removes them before the firewall projection.
type wireGuardSession struct {
	driver         *wireGuardDriver
	implementation string
	secrets        []string
	dnsServers     []string
	child          *childProcess
	done           chan struct{}
	doneOnce       sync.Once
	stopping       chan struct{}
	stopOnce       sync.Once
	mutex          sync.Mutex
	err            error
	lastHandshake  time.Time
	address        string
}

// routeInfo is the gateway and device "ip route" chose for a destination.
type routeInfo struct {
	gateway string
	device  string
}

// newWireGuardDriver wires the driver to the real system.
//
// Hostname endpoints resolve against the bootstrap nameservers captured before any
// tunnel existed, never against a tunnel resolver.
func newWireGuardDriver(
	config DaemonConfig,
	bootstrapNameservers []string,
	slot int,
) *wireGuardDriver {
	return &wireGuardDriver{
		directory:       filepath.Join(config.RuntimeDirectory, provider.TunnelWireGuard, strconv.Itoa(slot)),
		ipPath:          config.IPPath,
		wgPath:          config.WireGuardPath,
		wireGuardGoPath: config.WireGuardGoPath,
		implementation:  config.WireGuardImplementation,
		interfaceName:   tunnelInterfaceName(provider.TunnelWireGuard, slot),
		slot:            slot,
		logger:          config.Logger,
		timing:          defaultWireGuardTiming,
		lookupIPv4:      bootstrapLookup(bootstrapNameservers),
		run: func(ctx context.Context, name string, arguments ...string) ([]byte, error) {
			return exec.CommandContext(ctx, name, arguments...).CombinedOutput()
		},
		startChild: startChildProcess,
		pathExists: func(path string) bool {
			_, err := os.Stat(path)

			return err == nil
		},
		readFile: os.ReadFile,
		now:      time.Now,
		probe:    probeEgress,
	}
}

// Start creates the slot interface, waits for a handshake, and installs policy routing.
//
// Routes are added only after the server answers, so a dead endpoint never pulls the
// container's traffic into a silent link. Every failure tears down what was built.
func (driver *wireGuardDriver) Start(
	ctx context.Context,
	_ Connection,
	endpoint Endpoint,
) (tunnelSession, error) {
	if err := os.MkdirAll(driver.directory, 0o700); err != nil {
		return nil, fmt.Errorf("create WireGuard runtime directory: %w", err)
	}
	if err := os.Chmod(driver.directory, 0o700); err != nil {
		return nil, fmt.Errorf("secure WireGuard runtime directory: %w", err)
	}

	config, err := provider.ParseNormalizedWireGuardProfile(endpoint.Configuration)
	if err != nil {
		return nil, fmt.Errorf("read the WireGuard configuration: %w", err)
	}

	endpointAddress, err := driver.resolveEndpoint(ctx, config.EndpointHost)
	if err != nil {
		return nil, err
	}
	endpointRoute, err := driver.routeTo(ctx, endpointAddress.String())
	if err != nil {
		return nil, err
	}
	address, err := validProviderAddress(config.Addresses[0].Addr().Unmap().String())
	if err != nil {
		return nil, err
	}

	session := &wireGuardSession{
		driver:   driver,
		address:  address,
		secrets:  []string{config.PrivateKey, config.PresharedKey},
		done:     make(chan struct{}),
		stopping: make(chan struct{}),
	}
	for _, server := range config.DNSServers {
		session.dnsServers = append(session.dnsServers, server.String())
	}

	if err := driver.bringUp(ctx, session, config, endpointAddress, endpointRoute); err != nil {
		driver.teardown(session.child)

		return nil, err
	}
	if err := driver.waitForHandshake(ctx, session); err != nil {
		driver.teardown(session.child)

		return nil, err
	}
	if err := driver.addRoutes(ctx); err != nil {
		driver.teardown(session.child)

		return nil, err
	}

	go session.watch()

	return session, nil
}

// CleanupStale removes one slot's link, table, rule, and wireguard-go after a crash.
func (driver *wireGuardDriver) CleanupStale(context.Context) error {
	processError := stopStaleProcess(
		filepath.Join(driver.directory, "wireguard-go.pid"),
		"wireguard-go",
	)

	return errors.Join(processError, driver.teardown(nil))
}

// bringUp creates and configures the slot interface, which sends the first handshake.
//
// The private key reaches wg(8) through a 0600 file in a root-only directory that is
// removed as soon as wg has read it.
func (driver *wireGuardDriver) bringUp(
	ctx context.Context,
	session *wireGuardSession,
	config provider.WireGuardConfig,
	endpointAddress netip.Addr,
	endpointRoute routeInfo,
) error {
	if driver.pathExists(filepath.Join("/sys/class/net", driver.interfaceName)) {
		return fmt.Errorf("a %s link already exists", driver.interfaceName)
	}
	if err := driver.createLink(ctx, session); err != nil {
		return err
	}

	configurationPath := filepath.Join(driver.directory, driver.interfaceName+".conf")
	if err := writeAtomicFile(configurationPath, 0o600, wireGuardSetconf(config, endpointAddress)); err != nil {
		return fmt.Errorf("write the WireGuard key file: %w", err)
	}
	_, setconfError := driver.runTool(ctx, session.secrets, driver.wgPath, "setconf", driver.interfaceName, configurationPath)
	_ = os.Remove(configurationPath)
	if setconfError != nil {
		return fmt.Errorf("configure WireGuard: %w", setconfError)
	}

	for _, address := range config.Addresses {
		if _, err := driver.runTool(
			ctx,
			nil,
			driver.ipPath,
			"-4",
			"address",
			"add",
			address.String(),
			"dev",
			driver.interfaceName,
			"noprefixroute",
		); err != nil {
			return fmt.Errorf("add the WireGuard tunnel address: %w", err)
		}
	}

	mtu := config.MTU
	if mtu == 0 {
		mtu = driver.endpointMTU(endpointRoute.device)
	}
	if _, err := driver.runTool(
		ctx,
		nil,
		driver.ipPath,
		"link",
		"set",
		"dev",
		driver.interfaceName,
		"mtu",
		strconv.Itoa(mtu),
		"up",
	); err != nil {
		return fmt.Errorf("bring up WireGuard: %w", err)
	}

	return nil
}

// createLink makes the slot interface with the kernel module, or wireguard-go when it
// has no WireGuard.
//
// In auto mode a loaded module always wins and its errors are returned as they are;
// wireguard-go is used only when the module is missing and cannot be loaded on demand.
func (driver *wireGuardDriver) createLink(ctx context.Context, session *wireGuardSession) error {
	switch driver.implementation {
	case wireGuardImplementationKernel:
		return driver.createKernelLink(ctx, session)
	case wireGuardImplementationUserspace:
		return driver.createUserspaceLink(ctx, session)
	}

	if driver.pathExists("/sys/module/wireguard") {
		return driver.createKernelLink(ctx, session)
	}
	if err := driver.createKernelLink(ctx, session); err == nil {
		return nil
	}

	return driver.createUserspaceLink(ctx, session)
}

// createKernelLink adds the slot-specific kernel WireGuard device.
func (driver *wireGuardDriver) createKernelLink(ctx context.Context, session *wireGuardSession) error {
	if _, err := driver.runTool(ctx, nil, driver.ipPath, "link", "add", "dev", driver.interfaceName, "type", "wireguard"); err != nil {
		return fmt.Errorf("create the kernel WireGuard link: %w", err)
	}
	session.implementation = wireGuardImplementationKernel

	return nil
}

// createUserspaceLink starts wireguard-go in the foreground and waits for its socket.
//
// The child's PID is recorded so a restarted controller can stop it.
func (driver *wireGuardDriver) createUserspaceLink(ctx context.Context, session *wireGuardSession) error {
	socketPath := wireGuardSocketPath(driver.interfaceName)
	_ = os.Remove(socketPath)

	command := exec.Command(driver.wireGuardGoPath, "-f", driver.interfaceName)
	command.Env = append(os.Environ(), "WG_PROCESS_FOREGROUND=1")
	output := &childLogWriter{logger: driver.logger, name: "wireguard-go", redactions: session.secrets}
	command.Stdout = output
	command.Stderr = output

	child, err := driver.startChild(command)
	if err != nil {
		return fmt.Errorf("start wireguard-go: %w", err)
	}
	session.child = child
	session.implementation = wireGuardImplementationUserspace
	if child.command.Process != nil {
		_ = writeAtomicFile(
			filepath.Join(driver.directory, "wireguard-go.pid"),
			0o600,
			[]byte(strconv.Itoa(child.command.Process.Pid)+"\n"),
		)
	}

	linkTimer := time.NewTimer(driver.timing.linkTimeout)
	defer linkTimer.Stop()
	for !driver.pathExists(socketPath) {
		select {
		case <-child.exited:
			return fmt.Errorf("wireguard-go exited before creating %s", driver.interfaceName)
		case <-ctx.Done():
			return ctx.Err()
		case <-linkTimer.C:
			return fmt.Errorf("wireguard-go did not create %s within %s", driver.interfaceName, driver.timing.linkTimeout)
		case <-time.After(driver.timing.handshakePoll / 5):
		}
	}

	return nil
}

// waitForHandshake polls wg(8) until the server answers.
//
// Setting the link up sends a keepalive, which starts the handshake; the kernel and
// wireguard-go retry it every five seconds on their own.
func (driver *wireGuardDriver) waitForHandshake(ctx context.Context, session *wireGuardSession) error {
	handshakeTimer := time.NewTimer(driver.timing.handshakeTimeout)
	defer handshakeTimer.Stop()
	for {
		handshake, err := driver.latestHandshake(ctx, session.secrets)
		if err != nil {
			return err
		}
		if !handshake.IsZero() {
			session.recordHandshake(handshake)

			return nil
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-handshakeTimer.C:
			return fmt.Errorf(
				"the WireGuard server did not answer a handshake within %s; check the private key and that the server is online",
				driver.timing.handshakeTimeout,
			)
		case <-time.After(driver.timing.handshakePoll):
		}
	}
}

// addRoutes installs only the usable default above the permanent slot fallback.
func (driver *wireGuardDriver) addRoutes(ctx context.Context) error {
	return installSessionRoute(
		ctx,
		driver.run,
		driver.ipPath,
		driver.interfaceName,
		driver.slot,
	)
}

// teardown removes the link, wireguard-go, session route, and runtime files.
//
// It runs on a fresh context because the caller's may already have expired, and it
// keeps going after a failed step so one leftover never hides another. Permanent slot
// policy remains installed, and the session route is removed only after the link is gone.
func (driver *wireGuardDriver) teardown(child *childProcess) error {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	var teardownErrors []error
	if child != nil {
		child.stop()
	}
	linkRemoved := true
	if driver.pathExists(filepath.Join("/sys/class/net", driver.interfaceName)) {
		if _, err := driver.runTool(ctx, nil, driver.ipPath, "link", "delete", "dev", driver.interfaceName); err != nil {
			teardownErrors = append(teardownErrors, fmt.Errorf("delete %s: %w", driver.interfaceName, err))
			linkRemoved = false
		}
	}
	if linkRemoved {
		if err := removeSessionRoute(
			ctx,
			driver.run,
			driver.ipPath,
			driver.interfaceName,
			driver.slot,
		); err != nil {
			teardownErrors = append(teardownErrors, err)
		}
	}
	for _, name := range []string{driver.interfaceName + ".conf", "wireguard-go.pid"} {
		_ = os.Remove(filepath.Join(driver.directory, name))
	}

	return errors.Join(teardownErrors...)
}

// resolveEndpoint returns the endpoint's IPv4 address.
//
// wg(8) would otherwise resolve the name itself and could pick an IPv6 address, which
// the tunnel never uses.
func (driver *wireGuardDriver) resolveEndpoint(ctx context.Context, host string) (netip.Addr, error) {
	if address, err := netip.ParseAddr(host); err == nil {
		if !address.Is4() {
			return netip.Addr{}, errors.New("the WireGuard endpoint must be an IPv4 address")
		}

		return address, nil
	}

	addresses, err := driver.lookupIPv4(ctx, host)
	if err != nil {
		return netip.Addr{}, fmt.Errorf("resolve the WireGuard endpoint %s: %w", host, err)
	}
	for _, address := range addresses {
		if address.Is4() {
			return address.Unmap(), nil
		}
	}

	return netip.Addr{}, fmt.Errorf("the WireGuard endpoint %s has no IPv4 address", host)
}

// routeTo asks the kernel how it reaches one address before any tunnel route exists.
func (driver *wireGuardDriver) routeTo(ctx context.Context, address string) (routeInfo, error) {
	output, err := driver.runTool(ctx, nil, driver.ipPath, "-4", "route", "get", address)
	if err != nil {
		return routeInfo{}, fmt.Errorf("find the route to the WireGuard endpoint: %w", err)
	}

	route := parseRouteFields(strings.Fields(output))
	if route.device == "" {
		return routeInfo{}, fmt.Errorf("the route to the WireGuard endpoint has no device: %s", strings.TrimSpace(output))
	}

	return route, nil
}

// endpointMTU derives the tunnel MTU from the device carrying encrypted packets.
//
// WireGuard adds 80 bytes of overhead; the result stays between 1280 and 1420, the
// value wg-quick uses on a 1500-byte network.
func (driver *wireGuardDriver) endpointMTU(device string) int {
	content, err := driver.readFile(filepath.Join("/sys/class/net", device, "mtu"))
	if err != nil {
		return 1420
	}
	deviceMTU, err := strconv.Atoi(strings.TrimSpace(string(content)))
	if err != nil {
		return 1420
	}

	return min(max(deviceMTU-80, 1280), 1420)
}

// latestHandshake reads this link's most recent handshake time; zero means none yet.
func (driver *wireGuardDriver) latestHandshake(ctx context.Context, secrets []string) (time.Time, error) {
	output, err := driver.runTool(ctx, secrets, driver.wgPath, "show", driver.interfaceName, "latest-handshakes")
	if err != nil {
		return time.Time{}, fmt.Errorf("read the WireGuard handshake: %w", err)
	}

	fields := strings.Fields(output)
	if len(fields) != 2 {
		return time.Time{}, fmt.Errorf("%s does not have exactly one peer", driver.interfaceName)
	}
	seconds, err := strconv.ParseInt(fields[1], 10, 64)
	if err != nil || seconds < 0 {
		return time.Time{}, errors.New("wg reported an unreadable handshake time")
	}
	if seconds == 0 {
		return time.Time{}, nil
	}

	return time.Unix(seconds, 0), nil
}

// runTool runs ip or wg and returns its output with every secret removed.
//
// A failure's error carries the redacted output, so status and logs can explain it
// without ever repeating a key.
func (driver *wireGuardDriver) runTool(
	ctx context.Context,
	secrets []string,
	name string,
	arguments ...string,
) (string, error) {
	output, err := driver.run(ctx, name, arguments...)
	text := redactSecrets(string(output), secrets)
	if err != nil {
		return text, fmt.Errorf("%s %s: %w: %s", filepath.Base(name), strings.Join(arguments, " "), err, strings.TrimSpace(text))
	}

	return text, nil
}

// InterfaceName returns the session's slot-specific device.
func (session *wireGuardSession) InterfaceName() string {
	return session.driver.interfaceName
}

// ProviderDNSServers returns the DNS line of the configuration.
func (session *wireGuardSession) ProviderDNSServers() []string {
	return append([]string{}, session.dnsServers...)
}

// Address returns the source address that selects this connection's routing table.
func (session *wireGuardSession) Address() string {
	return session.address
}

// Details returns the engine and the last handshake the watch saw.
func (session *wireGuardSession) Details() sessionDetails {
	session.mutex.Lock()
	defer session.mutex.Unlock()

	return sessionDetails{
		Implementation:  session.implementation,
		LastHandshakeAt: session.lastHandshake,
	}
}

// Done closes when the tunnel dies or stops.
func (session *wireGuardSession) Done() <-chan struct{} {
	return session.done
}

// Err explains why Done closed.
func (session *wireGuardSession) Err() error {
	session.mutex.Lock()
	defer session.mutex.Unlock()

	if session.err == nil {
		return errors.New("WireGuard stopped")
	}

	return session.err
}

// Stop ends the watch and removes the link, its routes, and wireguard-go.
func (session *wireGuardSession) Stop() {
	session.stopOnce.Do(func() {
		close(session.stopping)
		if err := session.driver.teardown(session.child); err != nil {
			session.driver.logger.Warn("remove WireGuard", "error", err)
		}
		session.finish(errors.New("WireGuard stopped"))
	})
}

// watch ends the session when the handshake goes stale, the tunnel stops carrying
// traffic, the link disappears, or wireguard-go exits.
func (session *wireGuardSession) watch() {
	timing := session.driver.timing
	healthTicker := time.NewTicker(timing.healthInterval)
	defer healthTicker.Stop()

	var childExited <-chan struct{}
	if session.child != nil {
		childExited = session.child.exited
	}
	lastProbe := session.driver.now()
	probeFailures := 0
	for {
		select {
		case <-session.stopping:
			return
		case <-childExited:
			session.finish(errors.New("wireguard-go exited"))

			return
		case <-healthTicker.C:
		}

		checkContext, cancelCheck := context.WithTimeout(context.Background(), 15*time.Second)
		handshake, err := session.driver.latestHandshake(checkContext, session.secrets)
		if session.isStopping() {
			cancelCheck()

			return
		}
		if err != nil {
			cancelCheck()
			session.finish(fmt.Errorf("WireGuard stopped answering: %w", err))

			return
		}
		session.recordHandshake(handshake)
		now := session.driver.now()
		if handshake.IsZero() || now.Sub(handshake) > timing.staleHandshake {
			cancelCheck()
			session.finish(fmt.Errorf(
				"the WireGuard server has not answered a handshake for over %s",
				timing.staleHandshake,
			))

			return
		}

		if now.Sub(lastProbe) >= timing.probeInterval {
			lastProbe = now
			if err := session.driver.probe(
				checkContext,
				connectionLocalAddress(session.driver.slot),
			); err != nil {
				probeFailures++
				if probeFailures >= timing.probeFailures {
					cancelCheck()
					session.finish(fmt.Errorf("%d tunnel checks in a row failed: %w", probeFailures, err))

					return
				}
			} else {
				probeFailures = 0
			}
		}
		cancelCheck()
	}
}

// isStopping reports whether Stop has begun, so the watch never blames a deliberate
// teardown on the tunnel.
func (session *wireGuardSession) isStopping() bool {
	select {
	case <-session.stopping:
		return true
	default:
		return false
	}
}

// recordHandshake keeps the newest handshake for status.
func (session *wireGuardSession) recordHandshake(handshake time.Time) {
	session.mutex.Lock()
	defer session.mutex.Unlock()

	if handshake.After(session.lastHandshake) {
		session.lastHandshake = handshake
	}
}

// finish records the first reason the session ended and closes Done once.
func (session *wireGuardSession) finish(err error) {
	session.mutex.Lock()
	if session.err == nil {
		session.err = err
	}
	session.mutex.Unlock()
	session.doneOnce.Do(func() {
		close(session.done)
	})
}

// childLogWriter logs a child's output line by line with secrets removed.
type childLogWriter struct {
	logger     *slog.Logger
	name       string
	redactions []string
	mutex      sync.Mutex
	buffer     bytes.Buffer
}

// Write implements concurrent-safe child output logging.
func (writer *childLogWriter) Write(content []byte) (int, error) {
	writer.mutex.Lock()
	defer writer.mutex.Unlock()

	appendOutputLines(&writer.buffer, content, func(line string) {
		if line != "" {
			writer.logger.Info(writer.name, "message", redactSecrets(line, writer.redactions))
		}
	})

	return len(content), nil
}

// wireGuardSetconf writes the wg(8) form of a configuration.
//
// Address, DNS, and MTU are wg-quick keys that wg(8) rejects; the driver applies them
// with ip instead. The endpoint is the resolved IPv4 address, and the firewall mark
// lets the encrypted packets past Transmission's owner firewall.
func wireGuardSetconf(config provider.WireGuardConfig, endpointAddress netip.Addr) []byte {
	lines := []string{
		"[Interface]",
		"PrivateKey = " + config.PrivateKey,
		"FwMark = " + wireGuardFirewallMark,
		"",
		"[Peer]",
		"PublicKey = " + config.PeerPublicKey,
	}
	if config.PresharedKey != "" {
		lines = append(lines, "PresharedKey = "+config.PresharedKey)
	}
	lines = append(
		lines,
		"Endpoint = "+netip.AddrPortFrom(endpointAddress, uint16(config.EndpointPort)).String(),
		"AllowedIPs = 0.0.0.0/0",
		"PersistentKeepalive = "+strconv.Itoa(provider.WireGuardKeepaliveSeconds),
	)

	return []byte(strings.Join(lines, "\n") + "\n")
}

// parseRouteFields reads the gateway and device from "ip route" output fields.
func parseRouteFields(fields []string) routeInfo {
	var route routeInfo
	for index := 0; index+1 < len(fields); index++ {
		switch fields[index] {
		case "via":
			route.gateway = fields[index+1]
		case "dev":
			route.device = fields[index+1]
		}
	}

	return route
}

// redactSecrets replaces each non-empty secret in text.
func redactSecrets(text string, secrets []string) string {
	for _, secret := range secrets {
		if secret != "" {
			text = strings.ReplaceAll(text, secret, "[redacted]")
		}
	}

	return text
}

// bootstrapNameservers reads the nameserver lines of the original resolver file.
func bootstrapNameservers(resolverContent []byte) []string {
	var nameservers []string
	for _, line := range strings.Split(string(resolverContent), "\n") {
		fields := strings.Fields(line)
		if len(fields) >= 2 && fields[0] == "nameserver" && net.ParseIP(fields[1]) != nil {
			nameservers = append(nameservers, fields[1])
		}
	}

	return nameservers
}

// bootstrapLookup resolves IPv4 addresses against fixed nameservers.
//
// Go caches resolv.conf for a few seconds, and the controller rewrites that file on
// every transition, so lookups dial the captured bootstrap servers directly.
func bootstrapLookup(nameservers []string) func(ctx context.Context, host string) ([]netip.Addr, error) {
	return func(ctx context.Context, host string) ([]netip.Addr, error) {
		if len(nameservers) == 0 {
			return nil, errors.New("the container has no bootstrap nameserver")
		}

		var lookupErrors []string
		for _, nameserver := range nameservers {
			resolver := net.Resolver{
				PreferGo: true,
				Dial: func(dialContext context.Context, network string, _ string) (net.Conn, error) {
					dialer := net.Dialer{Timeout: 5 * time.Second}

					return dialer.DialContext(dialContext, network, net.JoinHostPort(nameserver, "53"))
				},
			}
			addresses, err := resolver.LookupNetIP(ctx, "ip4", host)
			if err == nil && len(addresses) > 0 {
				return addresses, nil
			}
			if err != nil {
				lookupErrors = append(lookupErrors, err.Error())
			}
		}

		return nil, errors.New(strings.Join(lookupErrors, "; "))
	}
}
