package controller

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

// egressProbeAddresses are public TCP services that prove a working tunnel.
var egressProbeAddresses = []string{"1.1.1.1:443", "9.9.9.9:443"}

// childProcess tracks one supervised child and its shared exit result.
type childProcess struct {
	command   *exec.Cmd
	exited    chan struct{}
	mutex     sync.RWMutex
	exitError error
}

// establishLocked starts and verifies one endpoint without affecting other tunnels.
//
// The caller holds this connection's operation mutex. The firewall helper is invoked
// for only the slot interface, and resolver state changes only when this connection is
// the current default.
func (daemon *Daemon) establishLocked(
	ctx context.Context,
	state *connectionState,
	connection Connection,
	endpoint Endpoint,
	attempt int,
) (tunnelSession, []string, error) {
	interfaceName := tunnelInterfaceName(connection.Tunnel, state.slot)
	if err := daemon.blockConnection("vpn-connecting", interfaceName); err != nil {
		return nil, nil, err
	}

	driver := daemon.driverFactory(connection.Tunnel, state.slot)
	if driver == nil {
		return nil, nil, errors.New("the VPN tunnel type is unsupported")
	}

	startContext, cancelStart := context.WithTimeout(ctx, daemon.config.ConnectTimeout)
	session, err := driver.Start(startContext, connection, endpoint)
	cancelStart()
	if err != nil && ctx.Err() != nil {
		return nil, nil, errors.Join(
			context.Cause(ctx),
			daemon.blockStoppedConnection("connection-stopped", interfaceName),
		)
	}
	if errors.Is(err, context.DeadlineExceeded) {
		readinessError := fmt.Errorf(
			"%s did not become ready within %s on attempt %d",
			tunnelLabel(connection.Tunnel),
			daemon.config.ConnectTimeout,
			attempt,
		)

		return nil, nil, errors.Join(
			readinessError,
			daemon.blockStoppedConnection("connection-timeout", interfaceName),
		)
	}
	if err != nil {
		return nil, nil, errors.Join(
			err,
			daemon.blockStoppedConnection(connection.Tunnel+"-exited", interfaceName),
		)
	}
	providerAddress, err := validProviderAddress(session.Address())
	if err != nil {
		session.Stop()

		return nil, nil, errors.Join(
			err,
			daemon.blockStoppedConnection("address-failure", interfaceName),
		)
	}
	localAddress := connectionLocalAddress(state.slot)

	dnsServers := append([]string{},connection.DNSServers...)
	if len(dnsServers) == 0 {
		dnsServers = append(dnsServers, session.ProviderDNSServers()...)
	}
	if len(dnsServers) == 0 {
		dnsServers = []string{"1.1.1.1", "9.9.9.9"}
	}

	verificationContext, cancelVerification := context.WithTimeout(ctx, 20*time.Second)
	defer cancelVerification()

	protectError := daemon.protectConnection(
		session.InterfaceName(),
		localAddress,
		providerAddress,
	)
	if protectError != nil {
		session.Stop()

		return nil, nil, errors.Join(
			protectError,
			daemon.blockStoppedConnection("firewall-failure", interfaceName),
		)
	}

	verifyResolverPins, err := daemon.prepareDefaultDNS(
		state,
		session.InterfaceName(),
		dnsServers,
	)
	if err != nil {
		session.Stop()

		return nil, nil, errors.Join(
			err,
			daemon.blockStoppedConnection("resolver-failure", interfaceName),
		)
	}

	if err := daemon.verify(
		verificationContext,
		session.InterfaceName(),
		localAddress,
		dnsServers,
		verifyResolverPins,
	); err != nil {
		session.Stop()
		_ = daemon.clearDNSForConnection(state.id)

		return nil, nil, errors.Join(
			err,
			daemon.blockStoppedConnection("verification-failure", interfaceName),
		)
	}

	if ctx.Err() != nil {
		session.Stop()
		_ = daemon.clearDNSForConnection(state.id)

		return nil, nil, errors.Join(
			context.Cause(ctx),
			daemon.blockStoppedConnection("connection-stopped", interfaceName),
		)
	}
	return session, dnsServers, nil
}

// establishPoolLocked tries candidates in strategy order for one connection.
func (daemon *Daemon) establishPoolLocked(
	ctx context.Context,
	state *connectionState,
	connection Connection,
	activeIndex int,
	reconnect bool,
	attempt int,
) (tunnelSession, int, []string, error) {
	var candidateErrors []string
	for _, endpointIndex := range candidateIndexes(connection, activeIndex, reconnect) {
		if ctx.Err() != nil {
			break
		}

		endpoint := connection.Endpoints[endpointIndex]
		if err := daemon.transition(state, connectionStatus(
			state,
			connection,
			endpoint,
			endpointIndex,
			"connecting",
			attempt,
			"",
			nil,
			"",
		)); err != nil {
			return nil, -1, nil, err
		}

		session, dnsServers, err := daemon.establishLocked(ctx, state, connection, endpoint, attempt)
		if err == nil {
			return session, endpointIndex, dnsServers, nil
		}
		if ctx.Err() != nil {
			break
		}
		candidateErrors = append(candidateErrors, fmt.Sprintf("%s: %v", endpoint.ProfileID, err))
	}

	cause := context.Cause(ctx)
	if errors.Is(cause, errReplaced) {
		return nil, -1, nil, errReplaced
	}
	if errors.Is(cause, errConnectDeadline) {
		message := fmt.Sprintf("no VPN endpoint connected within %s", daemon.connectDeadline)
		if len(candidateErrors) > 0 {
			message += fmt.Sprintf(
				"; %d of %d endpoints failed in that time: %s",
				len(candidateErrors),
				len(connection.Endpoints),
				strings.Join(candidateErrors, "; "),
			)
		}

		return nil, -1, nil, errors.New(message)
	}
	if len(candidateErrors) == 0 {
		return nil, -1, nil, errors.New("the VPN connection attempt stopped")
	}

	return nil, -1, nil, fmt.Errorf("all VPN endpoints failed: %s", strings.Join(candidateErrors, "; "))
}

// startChildProcess launches a command and records its exit for every waiter.
func startChildProcess(command *exec.Cmd) (*childProcess, error) {
	process := &childProcess{
		command: command,
		exited:  make(chan struct{}),
	}
	if err := command.Start(); err != nil {
		return nil, err
	}

	go func() {
		exitError := command.Wait()
		process.mutex.Lock()
		process.exitError = exitError
		process.mutex.Unlock()
		close(process.exited)
	}()

	return process, nil
}

// Error returns the child exit result after the exited channel closes.
func (process *childProcess) Error() error {
	process.mutex.RLock()
	defer process.mutex.RUnlock()

	return process.exitError
}

// stop requests graceful child shutdown before enforcing a short kill timeout.
func (process *childProcess) stop() {
	select {
	case <-process.exited:
		return
	default:
	}

	_ = process.command.Process.Signal(syscall.SIGTERM)
	select {
	case <-process.exited:
		return
	case <-time.After(10 * time.Second):
		_ = process.command.Process.Kill()
		<-process.exited
	}
}

// stopStaleProcess ends a child that a crashed controller left running.
func stopStaleProcess(processIDPath string, processName string) error {
	content, err := os.ReadFile(processIDPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}

		return fmt.Errorf("read stale %s PID: %w", processName, err)
	}
	processID, err := strconv.Atoi(strings.TrimSpace(string(content)))
	if err != nil || processID <= 1 {
		return nil
	}
	processDirectory := filepath.Join("/proc", strconv.Itoa(processID))
	commandName, err := os.ReadFile(filepath.Join(processDirectory, "comm"))
	if err != nil || strings.TrimSpace(string(commandName)) != processName {
		return nil
	}

	if err := syscall.Kill(processID, syscall.SIGTERM); err != nil && !errors.Is(err, syscall.ESRCH) {
		return fmt.Errorf("stop stale %s process %d: %w", processName, processID, err)
	}
	for attempt := 0; attempt < 100; attempt++ {
		if _, statError := os.Stat(processDirectory); errors.Is(statError, os.ErrNotExist) {
			return nil
		} else if statError != nil {
			return fmt.Errorf("inspect stale %s process %d: %w", processName, processID, statError)
		}
		time.Sleep(100 * time.Millisecond)
	}
	if err := syscall.Kill(processID, syscall.SIGKILL); err != nil && !errors.Is(err, syscall.ESRCH) {
		return fmt.Errorf("kill stale %s process %d: %w", processName, processID, err)
	}
	for attempt := 0; attempt < 50; attempt++ {
		if _, statError := os.Stat(processDirectory); errors.Is(statError, os.ErrNotExist) {
			return nil
		} else if statError != nil {
			return fmt.Errorf("inspect killed %s process %d: %w", processName, processID, statError)
		}
		time.Sleep(100 * time.Millisecond)
	}

	return fmt.Errorf("stale %s process %d did not exit", processName, processID)
}

// appendOutputLines buffers child output and hands each complete line to observe.
func appendOutputLines(buffer *bytes.Buffer, content []byte, observe func(string)) {
	_, _ = buffer.Write(content)
	for {
		line, err := buffer.ReadString('\n')
		if errors.Is(err, io.EOF) {
			buffer.WriteString(line)
			break
		}

		observe(strings.TrimSpace(line))
	}

	if buffer.Len() > 128*1024 {
		observe(buffer.String()[0:128*1024] + " [truncated]")
		buffer.Reset()
	}
}

// stopLocked removes one tunnel before its firewall and resolver projection.
//
// Permanent slot policy keeps traffic unreachable while teardown runs. The firewall
// projection remains until the process or link is gone, and a failed block is retried.
func (daemon *Daemon) stopLocked(state *connectionState, reason string) error {
	status := state.statusSnapshot()
	interfaceName := status.Interface
	if interfaceName == "" && state.desired != nil {
		interfaceName = tunnelInterfaceName(state.desired.Tunnel, state.slot)
	}

	var stopErrors []error
	state.stateMutex.Lock()
	session := state.session
	state.session = nil
	state.stateMutex.Unlock()
	if session != nil {
		session.Stop()
	}
	if interfaceName != "" {
		if err := daemon.blockStoppedConnection(reason, interfaceName); err != nil {
			stopErrors = append(stopErrors, err)
		}
	}
	if err := daemon.clearDNSForConnection(state.id); err != nil {
		stopErrors = append(stopErrors, err)
	}

	return errors.Join(stopErrors...)
}

// blockStoppedConnection removes firewall state only after the tunnel is gone.
func (daemon *Daemon) blockStoppedConnection(reason string, interfaceName string) error {
	if err := waitForTunnelInterfaceGone(interfaceName, time.Second); err != nil {
		return err
	}

	return daemon.blockConnection(reason, interfaceName)
}

// waitForTunnelInterfaceGone keeps its firewall projection until teardown completes.
func waitForTunnelInterfaceGone(interfaceName string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	interfacePath := filepath.Join("/sys/class/net", interfaceName)
	for {
		_, err := os.Stat(interfacePath)
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("inspect stopped VPN interface %s: %w", interfaceName, err)
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("VPN interface %s still exists after tunnel stop", interfaceName)
		}

		time.Sleep(25 * time.Millisecond)
	}
}

// monitor reconnects one failed connection without taking another's operation lock.
func (daemon *Daemon) monitor(
	state *connectionState,
	generation uint64,
	connection Connection,
	session tunnelSession,
	endpointIndex int,
	attempt int,
) {
	lastError := ""
	for {
		if session != nil {
			<-session.Done()
			if err := session.Err(); err != nil {
				lastError = err.Error()
			} else {
				lastError = "the VPN tunnel stopped"
			}
		}

		state.operationMutex.Lock()
		if !state.isCurrent(generation) || state.desired == nil {
			state.operationMutex.Unlock()

			return
		}

		blockError := daemon.stopLocked(state, connection.Tunnel+"-exited")
		if blockError != nil {
			lastError = blockError.Error()
		}
		_ = daemon.transition(state, connectionStatus(
			state,
			connection,
			connection.Endpoints[endpointIndex],
			endpointIndex,
			"reconnecting",
			attempt,
			lastError,
			nil,
			"",
		))
		state.operationMutex.Unlock()

		timer := time.NewTimer(time.Duration(connection.RetryIntervalSeconds) * time.Second)
		<-timer.C

		state.operationMutex.Lock()
		if !state.isCurrent(generation) || state.desired == nil {
			state.operationMutex.Unlock()

			return
		}

		attempt++
		attemptContext, endAttempt := state.beginAttempt(generation, 0)
		newSession, newEndpointIndex, dnsServers, err := daemon.establishPoolLocked(
			attemptContext,
			state,
			connection,
			endpointIndex,
			true,
			attempt,
		)
		endAttempt()
		if errors.Is(err, errReplaced) {
			state.operationMutex.Unlock()

			return
		}
		if err != nil {
			lastError = err.Error()
			_ = daemon.transition(state, connectionStatus(
				state,
				connection,
				connection.Endpoints[endpointIndex],
				endpointIndex,
				"reconnecting",
				attempt,
				lastError,
				nil,
				"",
			))
			state.operationMutex.Unlock()
			session = nil
			continue
		}

		state.setSession(newSession)
		endpointIndex = newEndpointIndex
		transitionError := daemon.transition(state, connectionStatus(
			state,
			connection,
			connection.Endpoints[endpointIndex],
			endpointIndex,
			"protected",
			attempt,
			"",
			dnsServers,
			newSession.Address(),
		))
		if transitionError == nil {
			transitionError = daemon.reconcileDefaultDNS(state)
		}
		if transitionError != nil {
			stopError := daemon.stopLocked(state, "reconnect-projection-failure")
			lastError = errors.Join(transitionError, stopError).Error()
			_ = daemon.transition(state, connectionStatus(
				state,
				connection,
				connection.Endpoints[endpointIndex],
				endpointIndex,
				"reconnecting",
				attempt,
				lastError,
				nil,
				"",
			))
			state.operationMutex.Unlock()
			session = nil
			continue
		}
		state.operationMutex.Unlock()
		session = newSession
		lastError = ""
	}
}

// prepareDefaultDNS installs pins before verification when state owns the resolver.
func (daemon *Daemon) prepareDefaultDNS(
	state *connectionState,
	interfaceName string,
	dnsServers []string,
) (bool, error) {
	daemon.defaultMutex.Lock()
	defer daemon.defaultMutex.Unlock()
	if daemon.defaultID != state.id {
		return false, nil
	}

	status := Status{
		ConnectionID: state.id,
		Slot:         state.slot,
		Default:      true,
		State:        "protected",
		Interface:    interfaceName,
		Address:      state.statusSnapshot().Address,
		DNSServers:   append([]string{},dnsServers...),
	}
	daemon.sharedMutex.Lock()
	defer daemon.sharedMutex.Unlock()

	return true, daemon.replaceDefaultDNSLocked(status)
}

// reconcileDefaultDNS projects a protected default status into routes and resolv.conf.
func (daemon *Daemon) reconcileDefaultDNS(state *connectionState) error {
	daemon.defaultMutex.Lock()
	defer daemon.defaultMutex.Unlock()
	if daemon.defaultID != state.id {
		return nil
	}

	status := state.statusSnapshot()
	daemon.sharedMutex.Lock()
	defer daemon.sharedMutex.Unlock()

	return daemon.replaceDefaultDNSLocked(status)
}

// clearDNSForConnection restores bootstrap DNS only for the current default.
func (daemon *Daemon) clearDNSForConnection(connectionID string) error {
	daemon.defaultMutex.Lock()
	defer daemon.defaultMutex.Unlock()
	if daemon.defaultID != connectionID {
		return nil
	}

	daemon.sharedMutex.Lock()
	defer daemon.sharedMutex.Unlock()

	return daemon.clearDefaultDNSLocked()
}

// setDefault applies the newest accepted resolver-owner command without a tunnel lock.
//
// Status projection is serialized with transition, so neither connection can publish a
// stale Default flag while a connect or reconnect transition writes its own status.
func (daemon *Daemon) setDefault(connectionID string, arrival uint64) (Status, error) {
	daemon.projectionMutex.Lock()
	defer daemon.projectionMutex.Unlock()
	daemon.defaultMutex.Lock()
	defer daemon.defaultMutex.Unlock()
	if arrival < daemon.latestDefault {
		return Status{}, errReplaced
	}
	daemon.latestDefault = arrival

	state, found := daemon.lookupConnectionState(connectionID)
	if err := daemon.ensureStatusDirectories(); err != nil {
		if found {
			return state.statusSnapshot(), err
		}

		return Status{}, err
	}

	oldID := daemon.defaultID
	var oldState *connectionState
	if oldID != "" && oldID != connectionID {
		oldState, _ = daemon.lookupConnectionState(oldID)
	}
	daemon.defaultID = connectionID
	if oldState != nil {
		oldState.stateMutex.Lock()
		oldState.status.Default = false
		oldState.stateMutex.Unlock()
	}
	if found {
		state.stateMutex.Lock()
		state.status.Default = true
		state.stateMutex.Unlock()
	}

	if oldState != nil {
		oldStatus := oldState.statusSnapshot()
		if err := writeAtomicJSON(
			daemon.connectionStatusPath(oldState.id),
			0o644,
			oldStatus,
		); err != nil {
			if found {
				return state.statusSnapshot(), fmt.Errorf("write previous default VPN status: %w", err)
			}

			return Status{}, fmt.Errorf("write previous default VPN status: %w", err)
		}
	}
	if !found {
		status := Status{
			ConnectionID:   connectionID,
			Default:        true,
			State:          "blocked",
			DNSServers:     []string{},
			TransitionedAt: time.Now().UTC(),
		}
		daemon.sharedMutex.Lock()
		defer daemon.sharedMutex.Unlock()
		if err := daemon.clearDefaultDNSLocked(); err != nil {
			return status, err
		}
		if err := writeAtomicJSON(
			filepath.Join(daemon.config.RuntimeDirectory, "vpn.status"),
			0o644,
			status,
		); err != nil {
			return status, fmt.Errorf("write default VPN status: %w", err)
		}

		return status, nil
	}
	status := state.statusSnapshot()
	if err := writeAtomicJSON(daemon.connectionStatusPath(state.id), 0o644, status); err != nil {
		return status, fmt.Errorf("write default VPN connection status: %w", err)
	}

	daemon.sharedMutex.Lock()
	defer daemon.sharedMutex.Unlock()
	if err := daemon.replaceDefaultDNSLocked(status); err != nil {
		return status, err
	}
	if err := writeAtomicJSON(
		filepath.Join(daemon.config.RuntimeDirectory, "vpn.status"),
		0o644,
		status,
	); err != nil {
		return status, fmt.Errorf("write default VPN status: %w", err)
	}

	return status, nil
}

// clearDefaultDNS removes only controller-owned resolver pins and restores bootstrap.
func (daemon *Daemon) clearDefaultDNS() error {
	daemon.sharedMutex.Lock()
	defer daemon.sharedMutex.Unlock()

	return daemon.clearDefaultDNSLocked()
}

func (daemon *Daemon) clearDefaultDNSLocked() error {
	var resolverErrors []error
	if output, err := daemon.runIP(
		context.Background(),
		"-4", "route", "flush", "table", "main", "proto", resolverRouteProtocol,
	); err != nil && !missingNetworkState(output, err) {
		resolverErrors = append(resolverErrors, fmt.Errorf(
			"remove protected DNS routes: %w: %s",
			err,
			strings.TrimSpace(string(output)),
		))
	}
	if err := daemon.restoreResolverLocked(); err != nil {
		resolverErrors = append(resolverErrors, err)
	}

	return errors.Join(resolverErrors...)
}

// replaceDefaultDNSLocked atomically moves all resolver pins to one protected tunnel.
func (daemon *Daemon) replaceDefaultDNSLocked(status Status) error {
	if err := daemon.clearDefaultDNSLocked(); err != nil {
		return err
	}
	if status.State != "protected" || status.Interface == "" || len(status.DNSServers) == 0 {
		return nil
	}
	if status.Slot < minimumConnectionSlot || status.Slot > maximumConnectionSlot {
		return fmt.Errorf("default VPN slot %d is invalid", status.Slot)
	}
	localAddress := connectionLocalAddress(status.Slot)

	for _, serverAddress := range status.DNSServers {
		output, err := daemon.runIP(
			context.Background(),
			"-4", "route", "add", serverAddress+"/32",
			"dev", status.Interface,
			"src", localAddress,
			"proto", resolverRouteProtocol,
		)
		if err != nil {
			_ = daemon.clearDefaultDNSLocked()

			return fmt.Errorf(
				"pin DNS server %s through %s: %w: %s",
				serverAddress,
				status.Interface,
				err,
				strings.TrimSpace(string(output)),
			)
		}
	}
	if err := daemon.writeResolverLocked(status.DNSServers); err != nil {
		_ = daemon.clearDefaultDNSLocked()

		return err
	}

	return nil
}

// writeResolver switches resolution to the default connection's pinned servers.
func (daemon *Daemon) writeResolver(dnsServers []string) error {
	daemon.sharedMutex.Lock()
	defer daemon.sharedMutex.Unlock()

	return daemon.writeResolverLocked(dnsServers)
}

func (daemon *Daemon) writeResolverLocked(dnsServers []string) error {
	var content strings.Builder
	content.WriteString(protectedResolverHeader)
	for _, serverAddress := range dnsServers {
		if net.ParseIP(serverAddress) == nil {
			return fmt.Errorf("resolver is not an IP address: %s", serverAddress)
		}
		content.WriteString("nameserver ")
		content.WriteString(serverAddress)
		content.WriteByte('\n')
	}
	content.WriteString("options timeout:2 attempts:2\n")

	if err := overwriteFile(daemon.config.ResolverPath, []byte(content.String())); err != nil {
		return fmt.Errorf("activate protected DNS: %w", err)
	}

	return nil
}

// restoreResolver restores the container's bootstrap resolver.
func (daemon *Daemon) restoreResolver() error {
	daemon.sharedMutex.Lock()
	defer daemon.sharedMutex.Unlock()

	return daemon.restoreResolverLocked()
}

func (daemon *Daemon) restoreResolverLocked() error {
	if err := overwriteFile(daemon.config.ResolverPath, daemon.originalDNS); err != nil {
		return fmt.Errorf("restore bootstrap DNS: %w", err)
	}

	return nil
}

// verifyTunnel proves source policy routing, DNS, and bound external TCP behavior.
func (daemon *Daemon) verifyTunnel(
	ctx context.Context,
	interfaceName string,
	address string,
	dnsServers []string,
	verifyResolverPins bool,
) error {
	if _, err := os.Stat(filepath.Join("/sys/class/net", interfaceName)); err != nil {
		return fmt.Errorf("verified tunnel interface is missing: %w", err)
	}

	routeOutput, err := daemon.routeTo(ctx, "1.1.1.1", address)
	if err != nil {
		return fmt.Errorf("inspect protected route: %w", err)
	}
	if !routeUsesDevice(routeOutput, interfaceName) {
		return fmt.Errorf("external route does not use %s: %s", interfaceName, strings.TrimSpace(routeOutput))
	}

	if verifyResolverPins {
		for _, resolverAddress := range dnsServers {
			routeOutput, err := daemon.routeTo(ctx, resolverAddress, "")
			if err != nil {
				return fmt.Errorf("inspect DNS route: %w", err)
			}
			if !routeUsesDevice(routeOutput, interfaceName) {
				return fmt.Errorf(
					"DNS server %s does not route through %s: %s",
					resolverAddress,
					interfaceName,
					strings.TrimSpace(routeOutput),
				)
			}
		}
	}

	if err := verifyProtectedDNS(ctx, dnsServers, address); err != nil {
		return err
	}

	return probeEgress(ctx, address)
}

// routeTo returns the chosen IPv4 route, optionally for a specific source address.
func (daemon *Daemon) routeTo(ctx context.Context, address string, sourceAddress string) (string, error) {
	arguments := []string{"-4", "route", "get", address}
	if sourceAddress != "" {
		arguments = append(arguments, "from", sourceAddress)
	}
	routeOutput, err := daemon.runIP(ctx, arguments...)

	return string(routeOutput), err
}

// routeUsesDevice reports whether ip route get output leaves through a device.
func routeUsesDevice(routeOutput string, interfaceName string) bool {
	fields := strings.Fields(routeOutput)
	for index := 0; index+1 < len(fields); index++ {
		if fields[index] == "dev" && fields[index+1] == interfaceName {
			return true
		}
	}

	return false
}

// verifyProtectedDNS sends direct DNS traffic from the tunnel's local address.
func verifyProtectedDNS(ctx context.Context, dnsServers []string, sourceAddress string) error {
	sourceIP := net.ParseIP(sourceAddress)
	if sourceIP == nil {
		return fmt.Errorf("the tunnel source address is invalid: %s", sourceAddress)
	}

	var lookupErrors []string
	for _, serverAddress := range dnsServers {
		resolver := net.Resolver{
			PreferGo: true,
			Dial: func(dialContext context.Context, network string, address string) (net.Conn, error) {
				dialer := net.Dialer{
					Timeout:   5 * time.Second,
					LocalAddr: &net.UDPAddr{IP: sourceIP},
				}

				return dialer.DialContext(
					dialContext,
					"udp4",
					net.JoinHostPort(serverAddress, "53"),
				)
			},
		}
		if _, err := resolver.LookupHost(ctx, "dns.quad9.net"); err == nil {
			return nil
		} else {
			lookupErrors = append(lookupErrors, err.Error())
		}
	}

	return fmt.Errorf("protected DNS probes failed: %s", strings.Join(lookupErrors, "; "))
}

// probeEgress binds every public probe to the tunnel's local address.
func probeEgress(ctx context.Context, sourceAddress string) error {
	sourceIP := net.ParseIP(sourceAddress)
	if sourceIP == nil {
		return fmt.Errorf("the tunnel source address is invalid: %s", sourceAddress)
	}

	var probeErrors []string
	for _, probeAddress := range egressProbeAddresses {
		dialer := net.Dialer{
			Timeout:   5 * time.Second,
			LocalAddr: &net.TCPAddr{IP: sourceIP},
		}
		connection, probeError := dialer.DialContext(ctx, "tcp4", probeAddress)
		if probeError == nil {
			_ = connection.Close()

			return nil
		}
		probeErrors = append(probeErrors, probeError.Error())
	}

	return fmt.Errorf("protected egress probes failed: %s", strings.Join(probeErrors, "; "))
}

// blockConnection removes one interface's owner, backstop, and SNAT rules.
func (daemon *Daemon) blockConnection(reason string, interfaceName string) error {
	daemon.sharedMutex.Lock()
	defer daemon.sharedMutex.Unlock()

	var blockError error
	for attempt := 0; attempt < 2; attempt++ {
		command := exec.Command(daemon.config.FirewallBlockPath, reason, interfaceName)
		output, err := command.CombinedOutput()
		if err == nil {
			return nil
		}
		blockError = fmt.Errorf(
			"block Transmission egress through %s: %w: %s",
			interfaceName,
			err,
			strings.TrimSpace(string(output)),
		)
	}

	return blockError
}

// blockAll removes all interface-specific owner allow rules.
func (daemon *Daemon) blockAll(reason string) error {
	daemon.sharedMutex.Lock()
	defer daemon.sharedMutex.Unlock()

	command := exec.Command(daemon.config.FirewallBlockPath, reason)
	output, err := command.CombinedOutput()
	if err != nil {
		return fmt.Errorf("block all Transmission egress: %w: %s", err, strings.TrimSpace(string(output)))
	}

	return nil
}

// protectConnection installs one slot's owner, backstop, and SNAT projection.
func (daemon *Daemon) protectConnection(
	interfaceName string,
	localAddress string,
	providerAddress string,
) error {
	daemon.sharedMutex.Lock()
	defer daemon.sharedMutex.Unlock()

	command := exec.Command(
		daemon.config.FirewallProtectPath,
		interfaceName,
		localAddress,
		providerAddress,
	)
	output, err := command.CombinedOutput()
	if err != nil {
		return fmt.Errorf(
			"protect Transmission egress through %s: %w: %s",
			interfaceName,
			err,
			strings.TrimSpace(string(output)),
		)
	}

	return nil
}

// writeAtomicFile publishes one root-only runtime file without a partial state.
func writeAtomicFile(path string, permissions os.FileMode, content []byte) error {
	temporaryFile, err := os.CreateTemp(filepath.Dir(path), ".secret-*")
	if err != nil {
		return err
	}

	temporaryPath := temporaryFile.Name()
	committed := false
	defer func() {
		_ = temporaryFile.Close()
		if !committed {
			_ = os.Remove(temporaryPath)
		}
	}()

	if err := temporaryFile.Chmod(permissions); err != nil {
		return err
	}
	if _, err := temporaryFile.Write(content); err != nil {
		return err
	}
	if err := temporaryFile.Sync(); err != nil {
		return err
	}
	if err := temporaryFile.Close(); err != nil {
		return err
	}
	if err := os.Rename(temporaryPath, path); err != nil {
		return err
	}

	committed = true

	return nil
}

// overwriteFile replaces mounted system state and forces it to storage.
func overwriteFile(path string, content []byte) error {
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_TRUNC, 0)
	if err != nil {
		return err
	}
	defer file.Close()

	if _, err := file.Write(content); err != nil {
		return err
	}

	return file.Sync()
}

// containsString reports whether a small string slice already contains a value.
func containsString(values []string, requestedValue string) bool {
	for _, value := range values {
		if value == requestedValue {
			return true
		}
	}

	return false
}
