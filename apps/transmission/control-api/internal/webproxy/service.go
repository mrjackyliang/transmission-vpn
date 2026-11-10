// Package webproxy provides the authenticated, fail-closed HTTP and SOCKS5 proxy.
//
// The service owns no durable settings. It watches a permission-restricted hand-off
// from the control API and opens its listener whenever the feature is enabled.
package webproxy

import (
	"bufio"
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/netip"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"sync"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/controller"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionconfig"
)

const (
	defaultListenAddress      = ":22605"
	defaultConfigPath         = "/run/transmission-vpn/web-proxy/config.json"
	defaultStatusPath         = "/run/transmission-vpn/web-proxy-state/status.json"
	defaultVPNStatusDirectory = "/run/transmission-vpn/vpn.status.d"
	defaultReadyPath          = "/run/transmission-vpn/services/web-proxy.ready"

	configPollInterval       = 2 * time.Second
	statusPollInterval       = time.Second
	peekTimeout              = 10 * time.Second
	httpHeaderTimeout        = 30 * time.Second
	httpKeepAliveTimeout     = 60 * time.Second
	httpResponseTimeout      = 60 * time.Second
	httpWriteTimeout         = 60 * time.Second
	httpIdleTimeout          = 90 * time.Second
	socksHandshakeTimeout    = 30 * time.Second
	maximumConnections       = 1024
	maximumClientConnections = 256
)

// preparedDummyPasswordHash caches the process-wide unknown-user verifier.
//
// A proxy process needs one dummy hash regardless of how often tests or callers create
// service values, avoiding repeated 64 MiB startup derivations.
var preparedDummyPasswordHash struct {
	sync.Once
	value string
	err   error
}

// Config identifies the fixed runtime paths and listen address of the proxy process.
//
// Production uses the container defaults, while flags supply isolated paths to tests
// without expanding the end-user environment-variable contract.
//
// Since: 2.0.0
type Config struct {
	ListenAddress      string
	ConfigPath         string
	StatusPath         string
	VPNStatusDirectory string
	VPNStatusPath      string
	ReadyPath          string
	Logger             *slog.Logger
}

// Login is one Argon2id credential supplied by the control API.
//
// ConnectionID selects the protected tunnel used by this credential.
//
// Since: 2.0.0
type Login struct {
	ID           string `json:"id"`
	Username     string `json:"username"`
	PasswordHash string `json:"passwordHash"`
	ConnectionID string `json:"connectionId"`
}

// RuntimeConfig is the complete permission-restricted API-to-proxy hand-off.
//
// An enabled configuration may have no logins. The listener still opens, while the
// authenticator refuses every credential until a login is added.
//
// Since: 2.0.0
type RuntimeConfig struct {
	Enabled bool    `json:"enabled"`
	Logins  []Login `json:"logins"`
}

// Status is the proxy process's atomic runtime report for the control API.
//
// UpdatedAt changes only when the observed state or error changes, avoiding continuous
// writes while still recording the latest transition.
//
// Since: 2.0.0
type Status struct {
	State     string    `json:"state"`
	Error     string    `json:"error,omitempty"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// connectionState ties one accepted socket to its client and authenticated login.
//
// Configuration reloads use the saved verifier identity to close tunnels whose login
// was removed or received a replacement password hash.
type connectionState struct {
	cancel       context.CancelFunc
	clientKey    string
	loginID      string
	passwordHash string
	connectionID string
}

// Service watches configuration, owns the listener, and serves proxy connections.
//
// All outbound connections pass through connection-specific guarded dialers, while
// the firewall remains the independent hard boundary if process state becomes stale.
//
// Since: 2.0.0
type Service struct {
	config Config
	logger *slog.Logger

	mutex                 sync.Mutex
	runtimeConfig         RuntimeConfig
	listener              net.Listener
	listenerError         string
	activeConnections     map[net.Conn]*connectionState
	connectionsByClient   map[string]int
	connectionSlots       chan struct{}
	clientConnectionLimit int
	connectionGroup       sync.WaitGroup
	listenerGroup         sync.WaitGroup

	statusMutex sync.Mutex
	lastStatus  Status

	authenticator  *authenticator
	vpnState       *vpnStateCache
	transport      *http.Transport
	transportMutex sync.Mutex
	transports     map[string]*http.Transport

	clock              func() time.Time
	listen             func(string, string) (net.Listener, error)
	rawDialContext     func(context.Context, string, string) (net.Conn, error)
	dialContext        func(*net.Dialer, context.Context, string, string) (net.Conn, error)
	resolver           addressResolver
	clientAllowed      func(net.Addr) bool
	destinationAllowed func(net.IP) bool
	vpnProtected       func() bool
	vpnAddress         func() string
	configInterval     time.Duration
	statusInterval     time.Duration
	headerTimeout      time.Duration
	keepAliveTimeout   time.Duration
	writeTimeout       time.Duration
	socksTimeout       time.Duration
}

// New creates a proxy service with fail-closed production defaults.
//
// The per-process authentication cache key is generated before any listener can open;
// failure to obtain secure randomness prevents startup.
//
// Since: 2.0.0
func New(config Config) (*Service, error) {
	if config.ListenAddress == "" {
		config.ListenAddress = defaultListenAddress
	}
	if config.ConfigPath == "" {
		config.ConfigPath = defaultConfigPath
	}
	if config.StatusPath == "" {
		config.StatusPath = defaultStatusPath
	}
	if config.VPNStatusDirectory == "" && config.VPNStatusPath == "" {
		config.VPNStatusDirectory = defaultVPNStatusDirectory
	}
	if config.ReadyPath == "" {
		config.ReadyPath = defaultReadyPath
	}
	if config.Logger == nil {
		config.Logger = slog.Default()
	}

	cacheKey := make([]byte, 32)
	if _, err := rand.Read(cacheKey); err != nil {
		return nil, fmt.Errorf("generate authentication cache key: %w", err)
	}
	dummyPasswordHash, err := webProxyDummyPasswordHash()
	if err != nil {
		return nil, fmt.Errorf("prepare web proxy login verifier: %w", err)
	}

	clock := time.Now
	service := &Service{
		config:                config,
		logger:                config.Logger,
		activeConnections:     map[net.Conn]*connectionState{},
		connectionsByClient:   map[string]int{},
		connectionSlots:       make(chan struct{}, maximumConnections),
		clientConnectionLimit: maximumClientConnections,
		transports:            map[string]*http.Transport{},
		clock:                 clock,
		listen:                net.Listen,
		dialContext: func(
			dialer *net.Dialer,
			ctx context.Context,
			network string,
			address string,
		) (net.Conn, error) {
			return dialer.DialContext(ctx, network, address)
		},
		resolver:      &net.Resolver{PreferGo: true},
		clientAllowed: isAllowedClient,
		destinationAllowed: func(address net.IP) bool {
			return isAllowedDestination(address)
		},
		configInterval:   configPollInterval,
		statusInterval:   statusPollInterval,
		headerTimeout:    httpHeaderTimeout,
		keepAliveTimeout: httpKeepAliveTimeout,
		writeTimeout:     httpWriteTimeout,
		socksTimeout:     socksHandshakeTimeout,
	}
	service.authenticator = newAuthenticator(
		cacheKey,
		dummyPasswordHash,
		security.VerifyPasswordContext,
		clock,
	)
	service.vpnState = &vpnStateCache{
		directory: config.VPNStatusDirectory,
		path:      config.VPNStatusPath,
		clock:     clock,
		entries:   map[string]cachedVPNState{},
	}
	service.vpnProtected = service.vpnState.protected
	service.vpnAddress = service.vpnState.address
	service.transport = &http.Transport{
		Proxy:                  nil,
		DialContext:            service.dialHTTPGuarded,
		DisableCompression:     true,
		ForceAttemptHTTP2:      false,
		MaxIdleConns:           128,
		MaxIdleConnsPerHost:    16,
		IdleConnTimeout:        httpIdleTimeout,
		MaxResponseHeaderBytes: maximumHeaderBytes,
		ResponseHeaderTimeout:  httpResponseTimeout,
	}

	return service, nil
}

// webProxyDummyPasswordHash returns the shared unknown-user verifier.
//
// sync.Once preserves startup error reporting while deriving the expensive hash no
// more than once in the standalone proxy process.
func webProxyDummyPasswordHash() (string, error) {
	preparedDummyPasswordHash.Do(func() {
		preparedDummyPasswordHash.value, preparedDummyPasswordHash.err = security.HashPassword(
			"not-a-real-web-proxy-password",
		)
	})

	return preparedDummyPasswordHash.value, preparedDummyPasswordHash.err
}

// Run publishes readiness, watches configuration, and stops cleanly with ctx.
//
// Invalid or missing configuration is an off state rather than a process failure, so
// the optional service stays ready while its port remains closed.
//
// Since: 2.0.0
func (service *Service) Run(ctx context.Context) error {
	if err := service.reloadConfiguration(ctx); err != nil {
		return err
	}
	if err := writeAtomicJSON(service.config.ReadyPath, 0o644, map[string]string{
		"service": "web-proxy",
		"phase":   "proxy",
	}); err != nil {
		service.shutdown()

		return fmt.Errorf("write web proxy readiness: %w", err)
	}
	defer func() {
		service.shutdown()
		_ = os.Remove(service.config.ReadyPath)
	}()

	configTicker := time.NewTicker(service.configInterval)
	defer configTicker.Stop()
	statusTicker := time.NewTicker(service.statusInterval)
	defer statusTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-configTicker.C:
			if err := service.reloadConfiguration(ctx); err != nil {
				return err
			}
		case <-statusTicker.C:
			if err := service.publishStatus(); err != nil {
				return err
			}
		}
	}
}

// reloadConfiguration applies the current hand-off and opens or closes the listener.
func (service *Service) reloadConfiguration(ctx context.Context) error {
	configuration, _ := readRuntimeConfig(service.config.ConfigPath)
	shouldListen := configuration.Enabled

	service.mutex.Lock()
	changed := !reflect.DeepEqual(service.runtimeConfig, configuration)
	service.runtimeConfig = configuration
	connectionsToClose := map[net.Conn]*connectionState{}
	if changed {
		service.authenticator.setLogins(configuration.Logins)
		connectionsToClose = service.connectionsWithInvalidLoginsLocked(configuration.Logins)
	}

	if !shouldListen {
		listener := service.listener
		service.listener = nil
		service.listenerError = ""
		service.mutex.Unlock()

		if listener != nil {
			_ = listener.Close()
		}
		service.listenerGroup.Wait()

		service.mutex.Lock()
		connections := service.takeConnectionsLocked()
		service.mutex.Unlock()
		closeConnections(connections)
		service.closeIdleTransports()

		return service.publishStatus()
	}

	if service.listener != nil {
		service.mutex.Unlock()
		closeConnections(connectionsToClose)

		return service.publishStatus()
	}
	service.mutex.Unlock()
	closeConnections(connectionsToClose)

	listener, err := service.listen("tcp", service.config.ListenAddress)
	if err != nil {
		service.mutex.Lock()
		service.listenerError = err.Error()
		service.mutex.Unlock()

		return service.publishStatus()
	}

	service.mutex.Lock()
	if service.listener != nil || !service.runtimeConfig.Enabled {
		service.mutex.Unlock()
		_ = listener.Close()

		return service.publishStatus()
	}
	service.listener = listener
	service.listenerError = ""
	service.mutex.Unlock()

	service.listenerGroup.Add(1)
	go func() {
		defer service.listenerGroup.Done()
		service.acceptLoop(ctx, listener)
	}()
	service.logger.Info("web proxy listener opened", "address", listener.Addr().String())

	return service.publishStatus()
}

// acceptLoop owns accepted connection lifetimes for one listener generation.
func (service *Service) acceptLoop(ctx context.Context, listener net.Listener) {
	for {
		connection, err := listener.Accept()
		if err != nil {
			if errors.Is(err, net.ErrClosed) {
				return
			}
			_ = listener.Close()

			service.mutex.Lock()
			if service.listener == listener {
				service.listener = nil
				service.listenerError = err.Error()
			}
			service.mutex.Unlock()
			_ = service.publishStatus()

			return
		}
		select {
		case service.connectionSlots <- struct{}{}:
		default:
			_ = connection.Close()

			continue
		}

		clientKey := clientLimitKey(connection.RemoteAddr())
		connectionContext, cancelConnection := context.WithCancel(ctx)
		service.mutex.Lock()
		if service.connectionsByClient[clientKey] >= service.clientConnectionLimit {
			service.mutex.Unlock()
			cancelConnection()
			<-service.connectionSlots
			_ = connection.Close()

			continue
		}
		state := &connectionState{
			cancel:    cancelConnection,
			clientKey: clientKey,
		}
		service.activeConnections[connection] = state
		service.connectionsByClient[clientKey]++
		service.connectionGroup.Add(1)
		service.mutex.Unlock()

		go func() {
			defer func() {
				if recovered := recover(); recovered != nil {
					service.logger.Error(
						"web proxy connection panicked",
						"remoteAddress",
						fmt.Sprint(connection.RemoteAddr()),
						"panic",
						recovered,
					)
				}
				cancelConnection()
				_ = connection.Close()
				<-service.connectionSlots

				service.mutex.Lock()
				delete(service.activeConnections, connection)
				if service.connectionsByClient[clientKey] <= 1 {
					delete(service.connectionsByClient, clientKey)
				} else {
					service.connectionsByClient[clientKey]--
				}
				service.mutex.Unlock()
				service.connectionGroup.Done()
			}()

			service.handleConnection(connectionContext, connection)
		}()
	}
}

// linkConnection records the login that authenticated one active socket.
//
// A concurrent configuration reload wins the race: a removed or re-keyed login cannot
// attach after the reload has already invalidated it.
func (service *Service) linkConnection(connection net.Conn, login Login) bool {
	service.mutex.Lock()
	defer service.mutex.Unlock()

	state, tracked := service.activeConnections[connection]
	if !tracked {
		return true
	}
	for _, configuredLogin := range service.runtimeConfig.Logins {
		if configuredLogin.ID == login.ID && configuredLogin.PasswordHash == login.PasswordHash &&
			configuredLogin.ConnectionID == login.ConnectionID {
			state.loginID = login.ID
			state.passwordHash = login.PasswordHash
			state.connectionID = login.ConnectionID

			return true
		}
	}

	return false
}

// connectionsWithInvalidLoginsLocked selects tunnels invalidated by new credentials.
//
// Unauthenticated sockets keep their bounded handshake deadline and will consult the
// replacement login set before they can open a destination connection.
func (service *Service) connectionsWithInvalidLoginsLocked(
	logins []Login,
) map[net.Conn]*connectionState {
	type validLogin struct {
		passwordHash string
		connectionID string
	}
	validLogins := make(map[string]validLogin, len(logins))
	for _, login := range logins {
		validLogins[login.ID] = validLogin{
			passwordHash: login.PasswordHash,
			connectionID: login.ConnectionID,
		}
	}

	connections := map[net.Conn]*connectionState{}
	for connection, state := range service.activeConnections {
		if state.loginID == "" {
			continue
		}
		login, found := validLogins[state.loginID]
		if !found || login.passwordHash != state.passwordHash || login.connectionID != state.connectionID {
			connections[connection] = state
		}
	}

	return connections
}

// handleConnection checks the client network and dispatches HTTP or SOCKS5 by byte one.
func (service *Service) handleConnection(ctx context.Context, connection net.Conn) {
	if !service.clientAllowed(connection.RemoteAddr()) {
		return
	}

	if err := connection.SetReadDeadline(service.clock().Add(peekTimeout)); err != nil {
		return
	}
	reader := bufio.NewReaderSize(connection, maximumHeaderBytes+1)
	firstByte, err := reader.Peek(1)
	if err != nil {
		return
	}
	clientKey := clientLimitKey(connection.RemoteAddr())
	if firstByte[0] == socksVersion {
		handshakeDeadline := service.clock().Add(service.socksTimeout)
		if err := connection.SetDeadline(handshakeDeadline); err != nil {
			return
		}
		service.handleSOCKS5(ctx, connection, reader, clientKey, handshakeDeadline)

		return
	}

	service.handleHTTP(ctx, connection, reader, clientKey)
}

// takeConnectionsLocked removes every active connection while service.mutex is held.
func (service *Service) takeConnectionsLocked() map[net.Conn]*connectionState {
	connections := service.activeConnections
	service.activeConnections = map[net.Conn]*connectionState{}

	return connections
}

// shutdown closes the listener, cancels clients, and drains owned goroutines.
func (service *Service) shutdown() {
	service.mutex.Lock()
	listener := service.listener
	service.listener = nil
	service.mutex.Unlock()

	if listener != nil {
		_ = listener.Close()
	}
	service.listenerGroup.Wait()

	service.mutex.Lock()
	connections := service.takeConnectionsLocked()
	service.mutex.Unlock()
	closeConnections(connections)
	service.closeIdleTransports()
	service.connectionGroup.Wait()
}

// transportForLogin isolates upstream keep-alive pools by selected connection.
func (service *Service) transportForLogin(login Login) *http.Transport {
	if login.ConnectionID == "" {
		return service.transport
	}

	service.transportMutex.Lock()
	defer service.transportMutex.Unlock()
	if transport := service.transports[login.ConnectionID]; transport != nil {
		return transport
	}

	connectionID := login.ConnectionID
	transport := service.transport.Clone()
	transport.DialContext = func(
		ctx context.Context,
		network string,
		address string,
	) (net.Conn, error) {
		return service.dialGuardedForLogin(
			ctx,
			Login{ConnectionID: connectionID},
			network,
			address,
		)
	}
	service.transports[connectionID] = transport

	return transport
}

// closeIdleTransports releases every route-specific upstream connection pool.
func (service *Service) closeIdleTransports() {
	service.transport.CloseIdleConnections()
	service.transportMutex.Lock()
	defer service.transportMutex.Unlock()
	for _, transport := range service.transports {
		transport.CloseIdleConnections()
	}
}

// closeConnections cancels and closes a detached active-connection set.
func closeConnections(connections map[net.Conn]*connectionState) {
	for connection, state := range connections {
		state.cancel()
		_ = connection.Close()
	}
}

// readRuntimeConfig decodes one complete hand-off or returns an effective off state.
func readRuntimeConfig(path string) (RuntimeConfig, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return RuntimeConfig{}, err
	}

	decoder := json.NewDecoder(bytes.NewReader(content))
	decoder.DisallowUnknownFields()
	var configuration RuntimeConfig
	if err := decoder.Decode(&configuration); err != nil {
		return RuntimeConfig{}, err
	}
	var trailingValue any
	if err := decoder.Decode(&trailingValue); !errors.Is(err, io.EOF) {
		return RuntimeConfig{}, errors.New("web proxy configuration has trailing data")
	}

	usernames := map[string]struct{}{}
	for _, login := range configuration.Logins {
		username := strings.ToLower(login.Username)
		if login.ID == "" || login.Username == "" || login.PasswordHash == "" {
			return RuntimeConfig{}, errors.New("web proxy configuration has an incomplete login")
		}
		if _, duplicate := usernames[username]; duplicate {
			return RuntimeConfig{}, errors.New("web proxy configuration has duplicate usernames")
		}
		usernames[username] = struct{}{}
	}

	return configuration, nil
}

// cachedVPNState is one connection's controller state and one-second read window.
type cachedVPNState struct {
	lastRead      time.Time
	protected     bool
	sourceAddress string
	dnsServers    []string
}

// vpnStateCache bounds each connection's controller status reads to once per second.
type vpnStateCache struct {
	mutex     sync.Mutex
	directory string
	path      string
	clock     func() time.Time
	entries   map[string]cachedVPNState
}

// protected preserves the single-status behavior used by isolated service tests.
func (cache *vpnStateCache) protected() bool {
	return cache.connection("").protected
}

// address returns the cached default connection's permanent slot source address.
func (cache *vpnStateCache) address() string {
	return cache.connection("").sourceAddress
}

// connection returns one status snapshot, refreshing only after its cache expires.
func (cache *vpnStateCache) connection(connectionID string) cachedVPNState {
	cache.mutex.Lock()
	defer cache.mutex.Unlock()

	if cache.entries == nil {
		cache.entries = map[string]cachedVPNState{}
	}
	entry := cache.entries[connectionID]
	now := cache.clock()
	if !entry.lastRead.IsZero() && now.Sub(entry.lastRead) < time.Second {
		return entry
	}
	entry = cachedVPNState{lastRead: now}

	statusPath := cache.path
	if connectionID != "" || statusPath == "" {
		if !validRuntimeConnectionID(connectionID) {
			cache.entries[connectionID] = entry

			return entry
		}
		statusPath = filepath.Join(cache.directory, connectionID+".json")
	}
	content, err := os.ReadFile(statusPath)
	if err != nil {
		cache.entries[connectionID] = entry

		return entry
	}

	var status controller.Status
	if err := json.Unmarshal(content, &status); err != nil || status.State != "protected" {
		cache.entries[connectionID] = entry

		return entry
	}
	sourceAddress, err := transmissionconfig.SlotBindAddressIPv4(status.Slot)
	if err != nil {
		cache.entries[connectionID] = entry

		return entry
	}
	entry.protected = true
	entry.sourceAddress = sourceAddress
	for _, dnsServer := range status.DNSServers {
		if normalized := validVPNAddress(dnsServer); normalized != "" {
			entry.dnsServers = append(entry.dnsServers, normalized)
		}
	}
	cache.entries[connectionID] = entry

	return entry
}

// validVPNAddress normalizes an IPv4 address accepted from controller status.
func validVPNAddress(address string) string {
	parsedAddress, err := netip.ParseAddr(address)
	if err != nil || !parsedAddress.Is4() {
		return ""
	}

	return parsedAddress.Unmap().String()
}

// validRuntimeConnectionID accepts the storage identifier form used in status names.
func validRuntimeConnectionID(connectionID string) bool {
	hexadecimal, found := strings.CutPrefix(connectionID, "vpc-")
	if !found || len(hexadecimal) != 16 {
		return false
	}
	for _, character := range hexadecimal {
		if !strings.ContainsRune("0123456789abcdef", character) {
			return false
		}
	}

	return true
}

// publishStatus writes a transition only when state or error changed.
func (service *Service) publishStatus() error {
	service.mutex.Lock()
	enabled := service.runtimeConfig.Enabled
	hasLogins := len(service.runtimeConfig.Logins) > 0
	listening := service.listener != nil
	listenerError := service.listenerError
	service.mutex.Unlock()

	status := Status{State: "off"}
	if enabled && listenerError != "" {
		status.State = "error"
		status.Error = listenerError
	} else if enabled && listening {
		if !hasLogins || service.anyLoginProtected() {
			status.State = "listening"
		} else {
			status.State = "waiting-for-vpn"
		}
	}

	service.statusMutex.Lock()
	defer service.statusMutex.Unlock()
	if status.State == service.lastStatus.State && status.Error == service.lastStatus.Error {
		return nil
	}
	status.UpdatedAt = service.clock().UTC()

	if err := writeAtomicJSON(service.config.StatusPath, 0o640, status); err != nil {
		return fmt.Errorf("write web proxy status: %w", err)
	}
	service.lastStatus = status

	return nil
}

// writeAtomicJSON publishes one complete JSON runtime artifact with fixed permissions.
func writeAtomicJSON(path string, permissions os.FileMode, value any) error {
	temporaryFile, err := os.CreateTemp(filepath.Dir(path), ".web-proxy-state-*")
	if err != nil {
		return fmt.Errorf("create temporary runtime file: %w", err)
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
		return fmt.Errorf("set runtime file permissions: %w", err)
	}
	if err := json.NewEncoder(temporaryFile).Encode(value); err != nil {
		return fmt.Errorf("encode runtime file: %w", err)
	}
	if err := temporaryFile.Sync(); err != nil {
		return fmt.Errorf("sync runtime file: %w", err)
	}
	if err := temporaryFile.Close(); err != nil {
		return fmt.Errorf("close runtime file: %w", err)
	}
	if err := os.Rename(temporaryPath, path); err != nil {
		return fmt.Errorf("publish runtime file: %w", err)
	}

	committed = true

	return nil
}
