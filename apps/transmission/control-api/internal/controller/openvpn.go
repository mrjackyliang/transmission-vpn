package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/netip"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// openVPNDriver runs one OpenVPN child per session.
//
// The profile and credentials live in a root-only runtime directory for exactly as
// long as the child runs.
type openVPNDriver struct {
	directory     string
	openVPNPath   string
	ipPath        string
	interfaceName string
	slot          int
	logger        *slog.Logger
	lookupIPv4    func(ctx context.Context, host string) ([]netip.Addr, error)
	run           networkCommandRunner
	pathExists    func(string) bool
}

// openVPNSession is one running OpenVPN child.
//
// Done is the child's exit, so a crash or an internal restart both end the session and
// hand recovery back to the daemon.
type openVPNSession struct {
	driver  *openVPNDriver
	process *childProcess
	output  *openVPNOutput
	address string
}

// newOpenVPNDriver creates the slot-specific OpenVPN runtime and routing owner.
func newOpenVPNDriver(
	config DaemonConfig,
	bootstrapNameservers []string,
	slot int,
) *openVPNDriver {
	return &openVPNDriver{
		directory:     filepath.Join(config.RuntimeDirectory, "openvpn", fmt.Sprintf("%d", slot)),
		openVPNPath:   config.OpenVPNPath,
		ipPath:        config.IPPath,
		interfaceName: tunnelInterfaceName("openvpn", slot),
		slot:          slot,
		logger:        config.Logger,
		lookupIPv4:    bootstrapLookup(bootstrapNameservers),
		run: func(ctx context.Context, name string, arguments ...string) ([]byte, error) {
			return exec.CommandContext(ctx, name, arguments...).CombinedOutput()
		},
		pathExists: func(path string) bool {
			_, err := os.Stat(path)

			return err == nil
		},
	}
}

// openVPNOutput assembles concurrent child output into sanitized diagnostic lines.
//
// Readiness and pushed DNS options are observed without enabling an OpenVPN script or
// public management listener.
type openVPNOutput struct {
	logger     *slog.Logger
	redactions []string
	mutex      sync.Mutex
	buffer     bytes.Buffer
	ready      chan struct{}
	readyOnce  sync.Once
	dnsServers []string
	failure    string
}

// Start writes the runtime files, launches OpenVPN, and waits for initialization.
//
// Every failure removes the profile and credential files before returning.
func (driver *openVPNDriver) Start(
	ctx context.Context,
	connection Connection,
	endpoint Endpoint,
) (tunnelSession, error) {
	if err := os.MkdirAll(driver.directory, 0o700); err != nil {
		return nil, fmt.Errorf("create OpenVPN runtime directory: %w", err)
	}
	if err := os.Chmod(driver.directory, 0o700); err != nil {
		return nil, fmt.Errorf("secure OpenVPN runtime directory: %w", err)
	}

	remoteAddress, err := driver.resolveEndpoint(ctx, endpoint.RemoteHost)
	if err != nil {
		return nil, err
	}

	if err := driver.writeConnectionFiles(connection, endpoint, remoteAddress.String()); err != nil {
		return nil, err
	}

	session, err := driver.startOpenVPN(connection)
	if err != nil {
		driver.cleanupConnectionFiles()

		return nil, err
	}

	select {
	case <-session.output.ready:
		address, err := driver.interfaceAddress(ctx)
		if err != nil {
			session.Stop()

			return nil, err
		}
		if err := driver.removeMainConnectedRoute(ctx); err != nil {
			session.Stop()

			return nil, err
		}
		if err := installSessionRoute(
			ctx,
			driver.run,
			driver.ipPath,
			driver.interfaceName,
			driver.slot,
		); err != nil {
			session.Stop()

			return nil, err
		}
		session.address = address

		return session, nil
	case <-session.process.exited:
		if failure := session.output.Failure(); failure != "" {
			driver.cleanupConnectionFiles()

			return nil, errors.New(failure)
		}
		exitError := session.process.Error()
		if exitError == nil {
			exitError = errors.New("OpenVPN exited before tunnel initialization")
		}
		driver.cleanupConnectionFiles()

		return nil, exitError
	case <-ctx.Done():
		session.Stop()

		return nil, ctx.Err()
	}
}

// CleanupStale stops an OpenVPN child a crashed controller left and removes its files.
//
// The child's PID file identifies it, and the process name is checked first so a
// reused PID is never signaled.
func (driver *openVPNDriver) CleanupStale(ctx context.Context) error {
	if err := stopStaleProcess(filepath.Join(driver.directory, "openvpn.pid"), "openvpn"); err != nil {
		return err
	}
	if driver.pathExists(filepath.Join("/sys/class/net", driver.interfaceName)) {
		output, err := driver.run(ctx, driver.ipPath, "link", "delete", "dev", driver.interfaceName)
		if err != nil {
			return fmt.Errorf(
				"delete stale OpenVPN interface %s: %w: %s",
				driver.interfaceName,
				err,
				strings.TrimSpace(string(output)),
			)
		}
	}
	routingError := removeSessionRoute(
		ctx,
		driver.run,
		driver.ipPath,
		driver.interfaceName,
		driver.slot,
	)
	driver.cleanupConnectionFiles()

	return routingError
}

// startOpenVPN launches the child with a generated root-only profile and status files.
//
// Arguments are passed directly without a shell, and all provider-supplied content has
// already crossed both normalization and controller validation.
func (driver *openVPNDriver) startOpenVPN(connection Connection) (*openVPNSession, error) {
	profilePath := filepath.Join(driver.directory, "active.ovpn")
	statusPath := filepath.Join(driver.directory, "status.txt")
	processIDPath := filepath.Join(driver.directory, "openvpn.pid")

	command := exec.Command(
		driver.openVPNPath,
		"--config",
		profilePath,
		"--script-security",
		"1",
		"--remap-usr1",
		"SIGTERM",
		"--status",
		statusPath,
		"2",
		"--status-version",
		"3",
		"--writepid",
		processIDPath,
	)
	output := &openVPNOutput{
		logger:     driver.logger,
		redactions: []string{connection.Username, connection.Password},
		ready:      make(chan struct{}),
	}
	command.Stdout = output
	command.Stderr = output

	process, err := startChildProcess(command)
	if err != nil {
		return nil, fmt.Errorf("start OpenVPN: %w", err)
	}

	return &openVPNSession{
		driver:  driver,
		process: process,
		output:  output,
	}, nil
}

// writeConnectionFiles publishes normalized profile and credentials with mode 0600.
//
// Credential values are never placed in command arguments, environment variables, or
// persistent configuration storage.
func (driver *openVPNDriver) writeConnectionFiles(
	connection Connection,
	endpoint Endpoint,
	remoteAddress string,
) error {
	profilePath := filepath.Join(driver.directory, "active.ovpn")
	authenticationPath := filepath.Join(driver.directory, "auth")

	runtimeConfiguration := runtimeOpenVPNConfiguration(
		endpoint.Configuration,
		driver.interfaceName,
		authenticationPath,
		remoteAddress,
	)

	if err := writeAtomicFile(profilePath, 0o600, runtimeConfiguration); err != nil {
		return fmt.Errorf("write active OpenVPN profile: %w", err)
	}

	authenticationContent := []byte(connection.Username + "\n" + connection.Password + "\n")
	if err := writeAtomicFile(authenticationPath, 0o600, authenticationContent); err != nil {
		_ = os.Remove(profilePath)

		return fmt.Errorf("write OpenVPN credentials: %w", err)
	}

	return nil
}

// runtimeOpenVPNConfiguration applies slot-owned paths without changing stored data.
//
// The controller also prevents OpenVPN from executing pushed or profile routes; policy
// routing is installed only after the tunnel reports readiness and has an IPv4 address.
func runtimeOpenVPNConfiguration(
	configuration []byte,
	interfaceName string,
	authenticationPath string,
	remoteAddress string,
) []byte {
	lines := strings.Split(strings.ReplaceAll(string(configuration), "\r\n", "\n"), "\n")
	runtimeLines := make([]string, 0, len(lines)+1)
	for _, line := range lines {
		trimmedLine := strings.TrimSpace(line)
		switch {
		case strings.HasPrefix(trimmedLine, "dev "):
			runtimeLines = append(runtimeLines, "dev "+interfaceName)
		case strings.HasPrefix(trimmedLine, "auth-user-pass "):
			runtimeLines = append(runtimeLines, "auth-user-pass "+authenticationPath)
		case strings.HasPrefix(trimmedLine, "remote "):
			fields := strings.Fields(trimmedLine)
			if len(fields) >= 2 {
				fields[1] = remoteAddress
				runtimeLines = append(runtimeLines, strings.Join(fields, " "))
			}
		case trimmedLine == "":
		default:
			runtimeLines = append(runtimeLines, line)
		}
	}
	runtimeLines = append(runtimeLines, "route-noexec")

	return []byte(strings.Join(runtimeLines, "\n") + "\n")
}

// interfaceAddress reads OpenVPN's assigned local IPv4 address after initialization.
func (driver *openVPNDriver) interfaceAddress(ctx context.Context) (string, error) {
	output, err := driver.run(
		ctx,
		driver.ipPath,
		"-j",
		"-4",
		"address",
		"show",
		"dev",
		driver.interfaceName,
	)
	if err != nil {
		return "", fmt.Errorf("read OpenVPN tunnel address: %w: %s", err, strings.TrimSpace(string(output)))
	}

	var links []struct {
		Addresses []struct {
			Family string `json:"family"`
			Local  string `json:"local"`
			Scope  string `json:"scope"`
		} `json:"addr_info"`
	}
	if err := json.Unmarshal(output, &links); err != nil {
		return "", fmt.Errorf("decode OpenVPN tunnel addresses: %w", err)
	}
	for _, link := range links {
		for _, address := range link.Addresses {
			if address.Family != "inet" || address.Scope != "global" {
				continue
			}
			parsedAddress, parseError := validProviderAddress(address.Local)
			if parseError == nil {
				return parsedAddress, nil
			}
		}
	}

	return "", fmt.Errorf("OpenVPN interface %s has no IPv4 address", driver.interfaceName)
}

// removeMainConnectedRoute deletes only OpenVPN's kernel-created main-table route.
//
// route-noexec suppresses profile and pushed routes, but the kernel still installs a
// connected subnet or peer route when OpenVPN assigns the interface address.
func (driver *openVPNDriver) removeMainConnectedRoute(ctx context.Context) error {
	output, err := driver.run(
		ctx,
		driver.ipPath,
		"-4",
		"route",
		"flush",
		"table",
		"main",
		"dev",
		driver.interfaceName,
		"proto",
		"kernel",
	)
	if err != nil && !missingNetworkState(output, err) {
		return fmt.Errorf(
			"remove OpenVPN connected route: %w: %s",
			err,
			strings.TrimSpace(string(output)),
		)
	}

	return nil
}

// resolveEndpoint resolves an OpenVPN remote through the captured bootstrap DNS.
//
// The runtime profile receives the selected IPv4 literal while certificate identity
// remains enforced by the profile's unchanged verify-x509-name directive.
func (driver *openVPNDriver) resolveEndpoint(ctx context.Context, host string) (netip.Addr, error) {
	if address, err := netip.ParseAddr(host); err == nil {
		if !address.Is4() {
			return netip.Addr{}, errors.New("the OpenVPN endpoint must be an IPv4 address")
		}

		return address.Unmap(), nil
	}

	addresses, err := driver.lookupIPv4(ctx, host)
	if err != nil {
		return netip.Addr{}, fmt.Errorf("resolve the OpenVPN endpoint %s: %w", host, err)
	}
	for _, address := range addresses {
		if address.Is4() {
			return address.Unmap(), nil
		}
	}

	return netip.Addr{}, fmt.Errorf("the OpenVPN endpoint %s has no IPv4 address", host)
}

// cleanupConnectionFiles removes ephemeral profile, credential, PID, and status files.
//
// It is idempotent and intentionally leaves no plaintext candidate material after a
// failed or stopped connection.
func (driver *openVPNDriver) cleanupConnectionFiles() {
	paths := []string{
		filepath.Join(driver.directory, "active.ovpn"),
		filepath.Join(driver.directory, "auth"),
		filepath.Join(driver.directory, "openvpn.pid"),
		filepath.Join(driver.directory, "status.txt"),
	}
	for _, path := range paths {
		_ = os.Remove(path)
	}
}

// InterfaceName returns OpenVPN's slot-specific device.
func (session *openVPNSession) InterfaceName() string {
	return session.driver.interfaceName
}

// ProviderDNSServers returns the resolvers the server pushed.
func (session *openVPNSession) ProviderDNSServers() []string {
	return session.output.DNSServers()
}

// Address returns the provider address used for status and SNAT.
func (session *openVPNSession) Address() string {
	return session.address
}

// Details adds nothing for OpenVPN.
func (session *openVPNSession) Details() sessionDetails {
	return sessionDetails{}
}

// Done closes when the OpenVPN child exits.
func (session *openVPNSession) Done() <-chan struct{} {
	return session.process.exited
}

// Err returns the child's exit result.
func (session *openVPNSession) Err() error {
	if failure := session.output.Failure(); failure != "" {
		return errors.New(failure)
	}
	if exitError := session.process.Error(); exitError != nil {
		return exitError
	}

	return errors.New("OpenVPN exited")
}

// Stop ends the child before removing its session route and runtime files.
func (session *openVPNSession) Stop() {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	session.process.stop()
	if err := removeSessionRoute(
		ctx,
		session.driver.run,
		session.driver.ipPath,
		session.driver.interfaceName,
		session.driver.slot,
	); err != nil {
		session.driver.logger.Warn("remove OpenVPN session route", "error", err)
	}
	session.driver.cleanupConnectionFiles()
}

// Write implements concurrent-safe child output observation.
//
// Complete lines are redacted before logging; readiness and DNS options are extracted
// from the sanitized protocol text without persisting raw credentials.
func (output *openVPNOutput) Write(content []byte) (int, error) {
	output.mutex.Lock()
	defer output.mutex.Unlock()

	appendOutputLines(&output.buffer, content, output.observeLine)

	return len(content), nil
}

// observeLine records readiness, provider DNS, and redacted diagnostic output.
//
// Empty lines are ignored and credential strings are replaced before any logger call.
func (output *openVPNOutput) observeLine(line string) {
	if line == "" {
		return
	}

	for _, redaction := range output.redactions {
		if redaction != "" {
			line = strings.ReplaceAll(line, redaction, "[redacted]")
		}
	}

	if strings.Contains(line, "Initialization Sequence Completed") {
		output.readyOnce.Do(func() {
			close(output.ready)
		})
	}

	normalizedFailure := strings.ToLower(line)
	switch {
	case strings.Contains(normalizedFailure, "auth_failed"),
		strings.Contains(normalizedFailure, "authentication failed"):
		output.failure = "OpenVPN authentication failed"
	case strings.Contains(normalizedFailure, "verify error"),
		strings.Contains(normalizedFailure, "certificate verify failed"),
		strings.Contains(normalizedFailure, "tls error"),
		strings.Contains(normalizedFailure, "tls handshake failed"):
		output.failure = "OpenVPN certificate or TLS verification failed"
	case strings.Contains(normalizedFailure, "server poll timeout"),
		strings.Contains(normalizedFailure, "inactivity timeout"),
		strings.Contains(normalizedFailure, "connection timed out"),
		strings.Contains(normalizedFailure, "tls key negotiation failed to occur within"):
		output.failure = "OpenVPN server did not reply before timeout"
	}

	normalizedLine := strings.NewReplacer(
		",", " ",
		"'", " ",
		"\"", " ",
	).Replace(line)
	fields := strings.Fields(normalizedLine)
	for index, field := range fields {
		if strings.EqualFold(field, "DNS") && index > 0 &&
			strings.EqualFold(fields[index-1], "dhcp-option") && index+1 < len(fields) {
			serverAddress := strings.Trim(fields[index+1], "',\"")
			if net.ParseIP(serverAddress) != nil && !containsString(output.dnsServers, serverAddress) {
				output.dnsServers = append(output.dnsServers, serverAddress)
			}
		}
	}

	output.logger.Info("openvpn", "message", line)
}

// DNSServers returns a stable copy of provider-pushed resolver addresses.
//
// The output lock protects values captured concurrently by OpenVPN logging goroutines.
func (output *openVPNOutput) DNSServers() []string {
	output.mutex.Lock()
	defer output.mutex.Unlock()

	return append([]string{}, output.dnsServers...)
}

// Failure returns the last recognized, secret-free startup failure.
func (output *openVPNOutput) Failure() string {
	output.mutex.Lock()
	defer output.mutex.Unlock()

	return output.failure
}
