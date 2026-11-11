package api

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math"
	"net"
	"net/http"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/capacity"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/controller"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/directorybrowser"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/jsonbody"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/provider"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionrpc"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/vpnhttp"
)

const maximumRequestBytes int64 = 1024 * 1024

// Sign-in limit shared by transmission-vpn, pfsense-actions and discord-stonker-bot:
// 10 failed attempts per visitor IP in 15 minutes, counting passwords, second-factor
// codes, recovery codes and passkeys together.
const (
	signInAttemptLimit  = 10
	signInAttemptWindow = 15 * time.Minute
)

// Compatible RPC failures have their own shorter window so they cannot consume the
// administrator browser sign-in budget.
const (
	rpcSignInAttemptLimit  = 10
	rpcSignInAttemptWindow = 5 * time.Minute
)

const maximumTrackedAttemptClients = 4096

type contextKey string

const principalContextKey contextKey = "principal"

// DirectoryBrowser defines the storage operations available to the HTTP boundary.
//
// Production crosses a permission-restricted Unix socket, while the interface keeps
// API tests independent from host filesystem permissions.
//
// Since: 2.0.0
type DirectoryBrowser interface {
	List(context.Context, string) (directorybrowser.Directory, error)
	Create(context.Context, string, string) (directorybrowser.Directory, error)
	Delete(context.Context, string) error
	ReadTorrent(context.Context, string) ([]byte, error)
}

// CapacityReader returns the cached container figures used to admit connections.
//
// Production supplies the cgroup detector while tests may provide fixed fixture
// snapshots without depending on the host that runs the API suite.
//
// Since: 2.0.0
type CapacityReader interface {
	// Current returns the cached environmental snapshot.
	Current() (capacity.Snapshot, error)
}

// resilientCapacityReader keeps capacity inspection advisory rather than fatal.
//
// A detector refresh can fail when a NAS exposes a partial cgroup layout. The API
// keeps the last usable snapshot, or a conservative two-connection fallback until
// the detector succeeds for the first time.
type resilientCapacityReader struct {
	reader CapacityReader
	logger *slog.Logger

	mutex sync.Mutex
	last  capacity.Snapshot
}

func newResilientCapacityReader(reader CapacityReader, logger *slog.Logger) *resilientCapacityReader {
	return &resilientCapacityReader{
		reader: reader,
		logger: logger,
		last: capacity.Snapshot{
			Limit:  2,
			CPUs:   float64(runtime.NumCPU()),
			Source: "fallback",
		},
	}
}

func (reader *resilientCapacityReader) Current() (capacity.Snapshot, error) {
	reader.mutex.Lock()
	defer reader.mutex.Unlock()

	snapshot, err := reader.reader.Current()
	if err != nil {
		reader.logger.Warn("VPN connection capacity refresh failed; using the last snapshot", "error", err)

		return reader.last, nil
	}
	reader.last = snapshot

	return snapshot, nil
}

// Config supplies the control API's unprivileged runtime dependencies.
//
// Privileged VPN operations are intentionally absent and will cross a restricted Unix
// socket rather than receiving capabilities inside this process.
type Config struct {
	Store               *storage.Store
	Registry            settings.Registry
	InstallationKey     []byte
	Controller          *controller.Client
	Capacity            CapacityReader
	DirectoryBrowser    DirectoryBrowser
	Transmission        transmissionrpc.Caller
	TransmissionClients *transmissionrpc.ClientSet
	RuntimeDirectory    string
	WebDirectory        string
	Logger              *slog.Logger
	Version             string
	MountedSetupCode    bool

	// LogLevel is the level Logger's handler checks. The debug logging setting moves it
	// between Info and Debug while the API runs; nil leaves the level alone.
	LogLevel *slog.LevelVar

	// DirectDial opens connections outside the VPN, for VPN provider catalogs and
	// notifications. Production passes the VPN controller's direct socket, because the
	// firewall drops the console's own connections outside the VPN.
	DirectDial func(ctx context.Context, network string, address string) (net.Conn, error)
}

// Server implements the versioned local appliance HTTP boundary.
//
// It owns authentication, request validation, and safe response shaping while durable
// transactions remain in storage and privileged networking remains out of process.
//
// Since: 2.0.0
type Server struct {
	store                       *storage.Store
	registry                    settings.Registry
	installationKey             []byte
	controller                  *controller.Client
	capacity                    CapacityReader
	vpnCommands                 vpnCommandGate
	directoryBrowser            DirectoryBrowser
	transmission                transmissionrpc.Caller
	transmissionClients         *transmissionrpc.ClientSet
	downloadCatalog             func(context.Context, provider.CatalogSource) ([]byte, error)
	runtimeDirectory            string
	webProxyConfigPath          string
	webProxyStatusPath          string
	logger                      *slog.Logger
	logLevel                    *slog.LevelVar
	version                     string
	dummyPasswordHash           string
	mountedSetupCode            bool
	attempts                    *attemptLimiter
	rpcAttempts                 *attemptLimiter
	rpcCompatibilityAllowed     atomic.Bool
	events                      *eventHub
	notifier                    *notifier
	watcher                     *notificationWatcher
	rpcSessionSecret            []byte
	webHandler                  http.Handler
	handler                     http.Handler
	webProxyMutex               sync.Mutex
	webProxyConfigPublisher     func(string, webProxyRuntimeConfig) error
	webProxyRetryInterval       time.Duration
	webProxyRetryMutex          sync.Mutex
	webProxyRetryCancel         context.CancelFunc
	webProxyRetryGeneration     uint64
	webProxyFailureLogged       bool
	webProxyRetryWait           sync.WaitGroup
	torrentProfileAssignments   *torrentProfileAssignmentCache
	torrentAddMutex             sync.Mutex
	torrentMoveMutex            sync.Mutex
	torrentMoveLocks            map[string]*sync.Mutex
	vpnConnectionReferenceGate  sync.RWMutex
	vpnConnectionRemovalMutex   sync.RWMutex
	vpnConnectionsRemoving      map[string]string
	torrentHashMutex            sync.RWMutex
	torrentHashIndex            map[string]torrentLocation
	torrentHashSets             map[string]map[string]torrentLocation
	torrentPreviewClient        func(vpnhttp.Route) *http.Client
	transmissionConfigMutex     sync.Mutex
	transmissionConfigPublisher func(
		context.Context,
		*storage.Store,
		settings.Registry,
		string,
	) ([]transmissionrpc.DaemonConfig, error)
	transmissionConfigRetryInterval   time.Duration
	transmissionConfigRetryMutex      sync.Mutex
	transmissionConfigRetryCancel     context.CancelFunc
	transmissionConfigRetryGeneration uint64
	transmissionConfigFailureLogged   bool
	transmissionConfigRetryWait       sync.WaitGroup
	blocklistClock                    func() time.Time
	blocklistPollInterval             time.Duration
	blocklistUpdateTimeout            time.Duration
	transmissionSettingsMutex         sync.Mutex
	pendingRestartMutex               sync.RWMutex
	pendingRestartKeys                map[string]struct{}
	backupClock                       func() time.Time
	backupGrantMutex                  sync.Mutex
	backupGrants                      map[string]backupReauthenticationGrant
	backupPasskeyMutex                sync.Mutex
	backupPasskeyCeremonies           map[string]backupPasskeyCeremony
	backupImportContext               context.Context
	backupImportCancel                context.CancelFunc
	backupImportMutex                 sync.Mutex
	backupImportRunning               map[string]struct{}
	backupImportWait                  sync.WaitGroup
	backupImportPollInterval          time.Duration
	dataRootPath                      string
	contentDownloadMutex              sync.Mutex
	contentDownloads                  map[string]contentDownload
}

// principal records the authenticated request identity and authorization method.
//
// Session principals receive administrator capabilities with CSRF enforcement, while
// API-token principals are restricted to their persisted scopes.
type principal struct {
	Kind              string
	Identifier        string
	AdministratorID   int64
	Username          string
	TokenName         string
	Scopes            map[string]struct{}
	SessionCSRFDigest []byte
}

// NewServer validates dependencies and constructs all versioned routes.
//
// A precomputed dummy password verifier keeps unknown-user login attempts comparable
// to real password checks; blocklist timing defaults remain injectable for API tests.
//
// Since: 2.0.0
func NewServer(config Config) (*Server, error) {
	if config.Store == nil {
		return nil, errors.New("control API store is required")
	}

	if config.RuntimeDirectory == "" {
		return nil, errors.New("control API runtime directory is required")
	}

	if len(config.InstallationKey) != 32 {
		return nil, errors.New("a 32-byte installation key is required")
	}

	if config.Logger == nil {
		config.Logger = slog.Default()
	}
	if config.Capacity == nil {
		if runtime.GOOS == "linux" {
			config.Capacity = capacity.NewDetector(capacity.DefaultPaths(), time.Minute)
		} else {
			config.Capacity = fixedCapacityReader{snapshot: capacity.Snapshot{
				Limit:       64,
				MemoryBytes: math.MaxUint64,
				CPUs:        float64(runtime.NumCPU()),
				Source:      "meminfo",
			}}
		}
	}
	config.Capacity = newResilientCapacityReader(config.Capacity, config.Logger)

	dummyPasswordHash, err := security.HashPassword("not-a-real-administrator-password")
	if err != nil {
		return nil, fmt.Errorf("prepare login verifier: %w", err)
	}
	profileAssignments, err := config.Store.ListTorrentProfileAssignments(context.Background())
	if err != nil {
		return nil, fmt.Errorf("load torrent profile assignments: %w", err)
	}
	profileNeeds, err := config.Store.ListTorrentNeedsProfiles(context.Background())
	if err != nil {
		return nil, fmt.Errorf("load pending torrent profile choices: %w", err)
	}
	configurationSnapshot, err := config.Store.EffectiveConfiguration(
		context.Background(),
		config.Registry,
	)
	if err != nil {
		return nil, fmt.Errorf("load compatible RPC setting: %w", err)
	}
	rpcCompatibilityAllowed, err := rpcCompatibilitySetting(configurationSnapshot)
	if err != nil {
		return nil, fmt.Errorf("load compatible RPC setting: %w", err)
	}
	debugLogging, err := debugLoggingSetting(configurationSnapshot)
	if err != nil {
		return nil, fmt.Errorf("load debug logging setting: %w", err)
	}
	rpcSessionSecret := make([]byte, 32)
	if _, err := rand.Read(rpcSessionSecret); err != nil {
		return nil, fmt.Errorf("generate compatible RPC session secret: %w", err)
	}
	directDial := config.DirectDial
	if directDial == nil {
		var plainDialer net.Dialer
		directDial = plainDialer.DialContext
	}
	downloadCatalog := func(ctx context.Context, source provider.CatalogSource) ([]byte, error) {
		return downloadVPNCatalogSource(ctx, source, directDial)
	}

	server := &Server{
		store:                           config.Store,
		registry:                        config.Registry,
		installationKey:                 append([]byte(nil), config.InstallationKey...),
		controller:                      config.Controller,
		capacity:                        config.Capacity,
		directoryBrowser:                config.DirectoryBrowser,
		transmission:                    config.Transmission,
		transmissionClients:             config.TransmissionClients,
		downloadCatalog:                 downloadCatalog,
		runtimeDirectory:                config.RuntimeDirectory,
		webProxyConfigPath:              filepath.Join(config.RuntimeDirectory, "web-proxy", "config.json"),
		webProxyStatusPath:              filepath.Join(config.RuntimeDirectory, "web-proxy-state", "status.json"),
		logger:                          config.Logger,
		logLevel:                        config.LogLevel,
		version:                         config.Version,
		dummyPasswordHash:               dummyPasswordHash,
		mountedSetupCode:                config.MountedSetupCode,
		attempts:                        newAttemptLimiter(signInAttemptLimit, signInAttemptWindow),
		rpcAttempts:                     newAttemptLimiter(rpcSignInAttemptLimit, rpcSignInAttemptWindow),
		rpcSessionSecret:                rpcSessionSecret,
		webProxyConfigPublisher:         publishWebProxyConfig,
		webProxyRetryInterval:           webProxyConfigRetryInterval,
		torrentProfileAssignments:       newTorrentProfileAssignmentCache(profileAssignments, profileNeeds),
		torrentMoveLocks:                map[string]*sync.Mutex{},
		vpnConnectionsRemoving:          map[string]string{},
		torrentHashIndex:                map[string]torrentLocation{},
		torrentHashSets:                 map[string]map[string]torrentLocation{},
		torrentPreviewClient:            newTorrentPreviewHTTPClient,
		transmissionConfigPublisher:     PublishTransmissionConfiguration,
		transmissionConfigRetryInterval: transmissionConfigurationRetryInterval,
		blocklistClock:                  time.Now,
		blocklistPollInterval:           250 * time.Millisecond,
		blocklistUpdateTimeout:          time.Minute,
		pendingRestartKeys:              map[string]struct{}{},
		backupClock:                     time.Now,
		backupGrants:                    map[string]backupReauthenticationGrant{},
		backupPasskeyCeremonies:         map[string]backupPasskeyCeremony{},
		backupImportRunning:             map[string]struct{}{},
		backupImportPollInterval:        time.Second,
		dataRootPath:                    "/data",
		contentDownloads:                map[string]contentDownload{},
	}
	server.backupImportContext, server.backupImportCancel = context.WithCancel(context.Background())
	server.rpcCompatibilityAllowed.Store(rpcCompatibilityAllowed)
	server.applyDebugLogging(debugLogging)
	if server.transmission == nil && server.transmissionClients != nil {
		server.transmission = server.transmissionClients
	}
	server.ensureConfiguredStorageDirectories(context.Background(), configurationSnapshot)
	server.ensureSavedTorrentProfileDirectories(context.Background())
	if err := server.publishTransmissionConfiguration(context.Background()); err != nil {
		return nil, fmt.Errorf("publish initial Transmission configuration: %w", err)
	}
	server.webHandler, err = newWebHandler(config.WebDirectory)
	if err != nil {
		return nil, err
	}
	if err := server.writeWebProxyConfig(context.Background()); err != nil {
		return nil, fmt.Errorf("publish initial web proxy configuration: %w", err)
	}
	server.events = newEventHub(server)
	server.notifier = newNotifier(server.store, server.installationKey, server.logger, directDial)
	server.attempts.onLimitReached = server.notifier.notifySignInLimit
	server.watcher = newNotificationWatcher(server)
	server.handler = server.routes()
	server.resumeBackupImports()

	return server, nil
}

// Close releases background resources owned by the HTTP boundary.
//
// The API process calls this before shutting down its listener so live-update
// subscribers are released without waiting for their next refresh interval, and the
// notification watcher stops.
func (server *Server) Close() {
	server.backupImportCancel()
	server.backupImportWait.Wait()
	server.stopTransmissionConfigRetry()
	server.stopWebProxyConfigRetry()
	server.events.Close()
	server.watcher.stop()
}

// ServeHTTP dispatches one request through recovery and security middleware.
//
// Implementing http.Handler lets production and tests use the same complete request
// pipeline without binding a real socket.
func (server *Server) ServeHTTP(responseWriter http.ResponseWriter, request *http.Request) {
	server.handler.ServeHTTP(responseWriter, request)
}

// RPCHandler serves the compatible RPC route on its own port.
//
// Remote apps keep Transmission's usual port and path, while the web interface and API
// answer only on the control port.
func (server *Server) RPCHandler() http.Handler {
	multiplexer := http.NewServeMux()
	multiplexer.HandleFunc("POST /transmission/rpc", server.handleRPCProxy)
	multiplexer.HandleFunc("/", func(responseWriter http.ResponseWriter, request *http.Request) {
		writeError(responseWriter, http.StatusNotFound, "not_found", "No route matches this request.")
	})

	return server.recoverPanics(server.addSecurityHeaders(multiplexer))
}

// routes declares the stable public and authenticated API surface.
//
// Go's method-aware standard ServeMux keeps routing explicit without adding a web
// framework dependency, including the merger's read and CSRF-protected update routes.
//
// Since: 2.0.0
func (server *Server) routes() http.Handler {
	multiplexer := http.NewServeMux()

	multiplexer.HandleFunc("GET /api/v1/health/live", server.handleLiveness)
	multiplexer.HandleFunc("GET /api/v1/health/ready", server.handleReadiness)
	multiplexer.HandleFunc("GET /api/v1/setup/status", server.handleSetupStatus)
	multiplexer.HandleFunc("POST /api/v1/setup/claim", server.handleClaim)
	multiplexer.HandleFunc("POST /api/v1/auth/login", server.handleLogin)
	multiplexer.HandleFunc("POST /api/v1/auth/login/second-factor", server.handleSecondFactor)
	multiplexer.HandleFunc("POST /api/v1/auth/passkeys/login/options", server.handlePasskeyLoginOptions)
	multiplexer.HandleFunc("POST /api/v1/auth/passkeys/login/verify", server.handlePasskeyLoginVerify)
	multiplexer.HandleFunc(
		"GET /api/v1/auth/security",
		server.requireSession(false, server.handleAccountSecurity),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/auth/password",
		server.requireSession(true, server.handleChangePassword),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/auth/username",
		server.requireSession(true, server.handleChangeUsername),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/auth/totp/setup",
		server.requireSession(true, server.handleTOTPSetup),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/auth/totp/enable",
		server.requireSession(true, server.handleTOTPEnable),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/auth/totp/disable",
		server.requireSession(true, server.handleTOTPDisable),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/auth/recovery-codes",
		server.requireSession(true, server.handleRegenerateRecoveryCodes),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/auth/passkeys/register/options",
		server.requireSession(true, server.handlePasskeyRegistrationOptions),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/auth/passkeys/register/verify",
		server.requireSession(true, server.handlePasskeyRegistrationVerify),
	)
	multiplexer.HandleFunc(
		"DELETE /api/v1/auth/passkeys/{passkeyID}",
		server.requireSession(true, server.handleDeletePasskey),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/auth/logout",
		server.requireAuthentication("", true, server.handleLogout),
	)
	multiplexer.HandleFunc(
		"GET /api/v1/auth/me",
		server.requireAuthentication("", false, server.handleCurrentAdministrator),
	)
	multiplexer.HandleFunc(
		"DELETE /api/v1/auth/removed-secrets",
		server.requireSession(true, server.handleDismissRemovedSecrets),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/backup/confirmation",
		server.requireSession(true, server.handleBackupConfirmation),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/backup/confirmation/passkey/options",
		server.requireSession(true, server.handleBackupPasskeyOptions),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/backup/confirmation/passkey/verify",
		server.requireSession(true, server.handleBackupPasskeyVerify),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/backup/export",
		server.requireSession(true, server.handleBackupExport),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/backup/imports/preview",
		server.requireSession(true, server.handleBackupImportPreview),
	)
	multiplexer.HandleFunc(
		"GET /api/v1/backup/imports/source-directories",
		server.requireSession(true, server.handleListImportSourceDirectories),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/backup/imports",
		server.requireSession(true, server.handleCreateBackupImport),
	)
	multiplexer.HandleFunc(
		"GET /api/v1/backup/imports/current",
		server.requireSession(false, server.handleCurrentBackupImport),
	)
	multiplexer.HandleFunc(
		"GET /api/v1/backup/imports/{importID}",
		server.requireSession(false, server.handleGetBackupImport),
	)
	multiplexer.HandleFunc(
		"GET /api/v1/auth/tokens",
		server.requireSession(false, server.handleListTokens),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/auth/tokens",
		server.requireSession(true, server.handleCreateToken),
	)
	multiplexer.HandleFunc(
		"PUT /api/v1/auth/tokens/{tokenID}",
		server.requireSession(true, server.handleUpdateToken),
	)
	multiplexer.HandleFunc(
		"DELETE /api/v1/auth/tokens/{tokenID}",
		server.requireSession(true, server.handleDeleteToken),
	)
	multiplexer.HandleFunc(
		"GET /api/v1/rpc/logins",
		server.requireSession(false, server.handleListRPCLogins),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/rpc/logins",
		server.requireSession(true, server.handleCreateRPCLogin),
	)
	multiplexer.HandleFunc(
		"PUT /api/v1/rpc/logins/{loginID}",
		server.requireSession(true, server.handleUpdateRPCLogin),
	)
	multiplexer.HandleFunc(
		"DELETE /api/v1/rpc/logins/{loginID}",
		server.requireSession(true, server.handleDeleteRPCLogin),
	)
	multiplexer.HandleFunc(
		"GET /api/v1/notifications",
		server.requireSession(false, server.handleListNotifications),
	)
	multiplexer.HandleFunc(
		"GET /api/v1/notifications/events",
		server.requireSession(false, server.handleNotificationEvents),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/notifications",
		server.requireSession(true, server.handleCreateNotification),
	)
	multiplexer.HandleFunc(
		"PUT /api/v1/notifications/{notificationID}",
		server.requireSession(true, server.handleUpdateNotification),
	)
	multiplexer.HandleFunc(
		"DELETE /api/v1/notifications/{notificationID}",
		server.requireSession(true, server.handleDeleteNotification),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/notifications/{notificationID}/test",
		server.requireSession(true, server.handleTestNotification),
	)
	multiplexer.HandleFunc(
		"GET /api/v1/web-proxy",
		server.requireSession(false, server.handleGetWebProxy),
	)
	multiplexer.HandleFunc(
		"PUT /api/v1/web-proxy",
		server.requireSession(true, server.handleUpdateWebProxy),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/web-proxy/logins",
		server.requireSession(true, server.handleCreateWebProxyLogin),
	)
	multiplexer.HandleFunc(
		"PUT /api/v1/web-proxy/logins/{loginID}",
		server.requireSession(true, server.handleUpdateWebProxyLogin),
	)
	multiplexer.HandleFunc(
		"DELETE /api/v1/web-proxy/logins/{loginID}",
		server.requireSession(true, server.handleDeleteWebProxyLogin),
	)
	multiplexer.HandleFunc(
		"GET /api/v1/status",
		server.requireAuthentication("vpn:read", false, server.handleStatus),
	)
	multiplexer.HandleFunc(
		"GET /api/v1/events",
		server.requireAuthentication("torrents:read", false, server.handleEvents),
	)
	multiplexer.HandleFunc(
		"GET /api/v1/settings",
		server.requireAuthentication("settings:read", false, server.handleGetSettings),
	)
	multiplexer.HandleFunc(
		"PUT /api/v1/settings",
		server.requireAuthentication("settings:write", true, server.handleUpdateSettings),
	)
	multiplexer.HandleFunc(
		"GET /api/v1/torrent-organization",
		server.requireAuthentication("torrents:read", false, server.handleGetTorrentOrganization),
	)
	multiplexer.HandleFunc(
		"PUT /api/v1/torrent-organization",
		server.requireAuthentication("torrents:write", true, server.handleUpdateTorrentOrganization),
	)
	multiplexer.HandleFunc(
		"GET /api/v1/torrent-profiles",
		server.requireAuthentication("torrents:read", false, server.handleListTorrentProfiles),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/torrent-profiles",
		server.requireAuthentication("torrents:write", true, server.handleCreateTorrentProfile),
	)
	multiplexer.HandleFunc(
		"PUT /api/v1/torrent-profiles/default",
		server.requireAuthentication("torrents:write", true, server.handleUpdateDefaultTorrentProfile),
	)
	multiplexer.HandleFunc(
		"PUT /api/v1/torrent-profiles/{torrentProfileID}",
		server.requireAuthentication("torrents:write", true, server.handleUpdateTorrentProfile),
	)
	multiplexer.HandleFunc(
		"DELETE /api/v1/torrent-profiles/{torrentProfileID}",
		server.requireAuthentication("torrents:write", true, server.handleDeleteTorrentProfile),
	)
	multiplexer.HandleFunc(
		"GET /api/v1/storage/directories",
		server.requireAuthentication("torrents:read", false, server.handleListStorageDirectories),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/storage/directories",
		server.requireAuthentication("torrents:write", true, server.handleCreateStorageDirectory),
	)
	multiplexer.HandleFunc(
		"DELETE /api/v1/storage/directories",
		server.requireAuthentication("torrents:write", true, server.handleDeleteStorageDirectory),
	)
	multiplexer.HandleFunc(
		"GET /api/v1/transmission/session",
		server.requireAuthentication("torrents:read", false, server.handleTransmissionSession),
	)
	multiplexer.HandleFunc(
		"GET /api/v1/transmission/statistics",
		server.requireAuthentication("torrents:read", false, server.handleTransmissionStatistics),
	)
	multiplexer.HandleFunc(
		"GET /api/v1/transmission/free-space",
		server.requireAuthentication("torrents:read", false, server.handleTransmissionFreeSpace),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/transmission/restart",
		server.requireAuthentication("torrents:write", true, server.handleTransmissionRestart),
	)
	multiplexer.HandleFunc(
		"GET /api/v1/blocklists",
		server.requireAuthentication("settings:read", false, server.handleGetBlocklists),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/blocklists/update",
		server.requireSession(true, server.handleUpdateBlocklists),
	)
	multiplexer.HandleFunc(
		"GET /api/v1/torrents",
		server.requireAuthentication("torrents:read", false, server.handleListTorrents),
	)
	multiplexer.HandleFunc(
		"GET /api/v1/torrents/{torrentID}",
		server.requireAuthentication("torrents:read", false, server.handleTorrentDetails),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/torrents",
		server.requireAuthentication("torrents:write", true, server.handleAddTorrent),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/torrents/preview",
		server.requireAuthentication("torrents:write", true, server.handlePreviewTorrentLinks),
	)
	multiplexer.HandleFunc(
		"PATCH /api/v1/torrents",
		server.requireAuthentication("torrents:write", true, server.handleUpdateTorrents),
	)
	multiplexer.HandleFunc(
		"PUT /api/v1/torrents/profile",
		server.requireAuthentication("torrents:write", true, server.handleSetTorrentProfile),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/torrents/actions",
		server.requireAuthentication("torrents:write", true, server.handleTorrentAction),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/torrents/remove",
		server.requireAuthentication("torrents:write", true, server.handleRemoveTorrents),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/torrents/torrent-files",
		server.requireAuthentication("torrents:read", true, server.handleDownloadTorrentFiles),
	)
	// Finished files download only in a signed-in browser, so no API token gains them.
	multiplexer.HandleFunc(
		"POST /api/v1/torrents/contents",
		server.requireSession(true, server.handlePrepareTorrentContents),
	)
	multiplexer.HandleFunc(
		"GET /api/v1/torrents/contents/{download}",
		server.requireSession(false, server.handleDownloadTorrentContents),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/torrents/rename",
		server.requireAuthentication("torrents:write", true, server.handleRenameTorrentPath),
	)
	multiplexer.HandleFunc(
		"GET /api/v1/vpn/providers",
		server.requireAuthentication("vpn:read", false, server.handleVPNProviders),
	)
	multiplexer.HandleFunc(
		"GET /api/v1/vpn/profiles",
		server.requireAuthentication("vpn:read", false, server.handleVPNProfiles),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/vpn/profiles/custom",
		server.requireAuthentication("vpn:write", true, server.handleCustomVPNProfile),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/vpn/providers/{providerID}/tunnels/{tunnel}/catalog/refresh",
		server.requireAuthentication("vpn:write", true, server.handleRefreshVPNCatalog),
	)
	multiplexer.HandleFunc(
		"GET /api/v1/vpn/connections",
		server.requireAuthentication("vpn:read", false, server.handleListVPNConnections),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/vpn/connections",
		server.requireAuthentication("vpn:write", true, server.handleCreateVPNConnection),
	)
	multiplexer.HandleFunc(
		"GET /api/v1/vpn/connections/{id}",
		server.requireAuthentication("vpn:read", false, server.handleGetVPNConnection),
	)
	multiplexer.HandleFunc(
		"PUT /api/v1/vpn/connections/{id}",
		server.requireAuthentication("vpn:write", true, server.handleUpdateVPNConnection),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/vpn/connections/{id}/reconnect",
		server.requireAuthentication("vpn:write", true, server.handleReconnectVPNConnection),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/vpn/connections/{id}/disconnect",
		server.requireAuthentication("vpn:write", true, server.handleDisconnectVPNConnection),
	)
	multiplexer.HandleFunc(
		"DELETE /api/v1/vpn/connections/{id}",
		server.requireAuthentication("vpn:write", true, server.handleDeleteVPNConnection),
	)
	multiplexer.HandleFunc(
		"PUT /api/v1/vpn/default",
		server.requireAuthentication("vpn:write", true, server.handleSetDefaultVPNConnection),
	)
	// TODO(E6): Remove the four default-connection aliases below after the console moves.
	multiplexer.HandleFunc(
		"GET /api/v1/vpn/status",
		server.requireAuthentication("vpn:read", false, server.handleVPNStatus),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/vpn/connect",
		server.requireAuthentication("vpn:write", true, server.handleVPNConnect),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/vpn/reconnect",
		server.requireAuthentication("vpn:write", true, server.handleVPNReconnect),
	)
	multiplexer.HandleFunc(
		"POST /api/v1/vpn/disconnect",
		server.requireAuthentication("vpn:write", true, server.handleVPNDisconnect),
	)
	multiplexer.HandleFunc("GET /", server.handleWeb)

	return server.recoverPanics(server.addSecurityHeaders(multiplexer))
}

// requireAuthentication authenticates a session or scoped API token.
//
// Mutating browser requests must also prove the per-session CSRF token; bearer tokens
// rely on their explicit scope and are not authenticated by ambient cookies.
func (server *Server) requireAuthentication(
	requiredScope string,
	mutation bool,
	next http.HandlerFunc,
) http.HandlerFunc {
	return server.requirePrincipal(requiredScope, mutation, "Sign in, or send a valid API token.", next)
}

// requirePrincipal is the shared authentication middleware. The 401 message depends
// on what the route accepts, so session-only routes simply ask the visitor to sign in.
func (server *Server) requirePrincipal(
	requiredScope string,
	mutation bool,
	unauthenticatedMessage string,
	next http.HandlerFunc,
) http.HandlerFunc {
	return func(responseWriter http.ResponseWriter, request *http.Request) {
		requestPrincipal, err := server.authenticate(request)
		if err != nil {
			writeError(
				responseWriter,
				http.StatusUnauthorized,
				"authentication_required",
				unauthenticatedMessage,
			)

			return
		}

		if requiredScope != "" && requestPrincipal.Kind == "token" {
			if _, found := requestPrincipal.Scopes[requiredScope]; !found {
				writeError(
					responseWriter,
					http.StatusForbidden,
					"scope_required",
					"This token doesn't have the "+requiredScope+" scope.",
				)

				return
			}
		}

		if mutation && requestPrincipal.Kind == "session" &&
			!server.validCSRF(request, requestPrincipal.SessionCSRFDigest) {
			writeError(
				responseWriter,
				http.StatusForbidden,
				"csrf_invalid",
				"The request CSRF token is missing or invalid.",
			)

			return
		}

		contextWithPrincipal := context.WithValue(
			request.Context(),
			principalContextKey,
			requestPrincipal,
		)
		next(responseWriter, request.WithContext(contextWithPrincipal))
	}
}

// requireSession restricts sensitive token administration to an interactive session.
//
// API tokens cannot mint or revoke other API tokens even if their scopes are later
// expanded, preserving a clear local-administrator ownership boundary.
func (server *Server) requireSession(
	mutation bool,
	next http.HandlerFunc,
) http.HandlerFunc {
	return server.requirePrincipal("", mutation, "Sign in to continue.", func(
		responseWriter http.ResponseWriter,
		request *http.Request,
	) {
		requestPrincipal := principalFromContext(request.Context())
		if requestPrincipal.Kind != "session" {
			writeError(
				responseWriter,
				http.StatusForbidden,
				"session_required",
				"An administrator browser session is required.",
			)

			return
		}

		next(responseWriter, request)
	})
}

// authenticate resolves an explicit bearer token before considering session cookies.
//
// This precedence prevents a restricted automation request from inheriting broader
// browser authority when both credential types are accidentally present.
func (server *Server) authenticate(request *http.Request) (principal, error) {
	authorization := request.Header.Get("Authorization")
	if authorization != "" {
		const bearerPrefix = "Bearer "
		if !strings.HasPrefix(authorization, bearerPrefix) {
			return principal{}, errors.New("unsupported authorization scheme")
		}

		plaintextToken := strings.TrimSpace(strings.TrimPrefix(authorization, bearerPrefix))
		if plaintextToken == "" {
			return principal{}, errors.New("empty bearer token")
		}

		token, err := server.store.FindAPIToken(
			request.Context(),
			security.Digest(plaintextToken),
		)
		if err != nil {
			return principal{}, err
		}

		scopes := make(map[string]struct{}, len(token.Scopes))
		for _, scope := range token.Scopes {
			scopes[scope] = struct{}{}
		}

		return principal{
			Kind:       "token",
			Identifier: token.ID,
			TokenName:  token.Name,
			Scopes:     scopes,
		}, nil
	}

	sessionCookie, err := request.Cookie("tvpn_session")
	if err != nil || sessionCookie.Value == "" {
		return principal{}, errors.New("session cookie is missing")
	}

	session, err := server.store.FindSession(
		request.Context(),
		security.Digest(sessionCookie.Value),
	)
	if err != nil {
		return principal{}, err
	}

	return principal{
		Kind:              "session",
		Identifier:        session.ID,
		AdministratorID:   session.AdministratorID,
		Username:          session.Username,
		SessionCSRFDigest: session.CSRFDigest,
	}, nil
}

// validCSRF verifies the double-submit cookie and persisted per-session digest.
//
// SameSite cookies reduce cross-origin exposure, while this explicit token prevents a
// browser from performing state changes with ambient session authority alone.
func (server *Server) validCSRF(request *http.Request, expectedDigest []byte) bool {
	headerValue := request.Header.Get("X-CSRF-Token")
	cookie, err := request.Cookie("tvpn_csrf")
	if err != nil || headerValue == "" || cookie.Value == "" || headerValue != cookie.Value {
		return false
	}

	return security.DigestsEqual(security.Digest(headerValue), expectedDigest)
}

// addSecurityHeaders applies defensive browser and cache policy to every response.
//
// The same-origin interface may load only its compiled assets and open API or event
// connections back to this server; framing, plugins, and cross-origin data stay denied.
func (server *Server) addSecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
		if strings.HasPrefix(request.URL.Path, "/assets/") {
			responseWriter.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			responseWriter.Header().Set("Cache-Control", "no-store")
		}
		responseWriter.Header().Set(
			"Content-Security-Policy",
			"default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'; form-action 'self'",
		)
		responseWriter.Header().Set("Referrer-Policy", "no-referrer")
		responseWriter.Header().Set("X-Content-Type-Options", "nosniff")
		responseWriter.Header().Set("X-Frame-Options", "DENY")

		next.ServeHTTP(responseWriter, request)
	})
}

// recoverPanics prevents one malformed request from terminating the control plane.
//
// Internal details are logged server-side with a request path while clients receive a
// stable generic failure response that does not disclose implementation state.
func (server *Server) recoverPanics(next http.Handler) http.Handler {
	return http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
		defer func() {
			if recoveredValue := recover(); recoveredValue != nil {
				if recoveredValue == http.ErrAbortHandler {
					panic(http.ErrAbortHandler)
				}

				server.logger.Error(
					"control API request panicked",
					"path",
					request.URL.Path,
					"error",
					fmt.Sprint(recoveredValue),
				)
				writeError(
					responseWriter,
					http.StatusInternalServerError,
					"internal_error",
					"Something went wrong. Try again.",
				)
			}
		}()

		next.ServeHTTP(responseWriter, request)
	})
}

// decodeJSONBody reads one bounded, strict JSON request object.
//
// Unknown fields, trailing values, and oversized bodies are rejected so API contract
// mistakes cannot be silently ignored.
func decodeJSONBody(
	responseWriter http.ResponseWriter,
	request *http.Request,
	target any,
) error {
	request.Body = http.MaxBytesReader(responseWriter, request.Body, maximumRequestBytes)
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}

	var trailingValue any
	if err := decoder.Decode(&trailingValue); !errors.Is(err, io.EOF) {
		if err == nil {
			return errors.New("request body contains multiple JSON values")
		}

		return err
	}

	return nil
}

// writeJSON serializes one complete response before committing HTTP headers.
//
// Buffering prevents an encoding failure from leaving clients with a successful status
// and a truncated JSON document.
func writeJSON(responseWriter http.ResponseWriter, statusCode int, value any) {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(true)
	if err := encoder.Encode(jsonbody.Normalize(value)); err != nil {
		http.Error(responseWriter, "response encoding failed", http.StatusInternalServerError)

		return
	}

	responseWriter.Header().Set("Content-Type", "application/json; charset=utf-8")
	responseWriter.WriteHeader(statusCode)
	_, _ = responseWriter.Write(buffer.Bytes())
}

// writeError emits the stable error envelope shared by all API routes.
//
// Machine-readable codes let the frontend provide precise recovery actions while
// messages remain safe to display directly.
func writeError(
	responseWriter http.ResponseWriter,
	statusCode int,
	code string,
	message string,
) {
	writeJSON(responseWriter, statusCode, errorEnvelope{
		Error: errorBody{
			Code:    code,
			Message: message,
		},
	})
}

// writeFieldError emits the error envelope with one field-level issue.
//
// Forms highlight the named field, while other clients can keep reading the top-level
// code and message exactly as they do for every other error.
func writeFieldError(
	responseWriter http.ResponseWriter,
	statusCode int,
	code string,
	field string,
	message string,
) {
	writeJSON(responseWriter, statusCode, errorEnvelope{
		Error: errorBody{
			Code:    code,
			Message: message,
			Issues: []validationIssue{
				{
					Field:   field,
					Path:    []string{field},
					Message: message,
				},
			},
		},
	})
}

// errorEnvelope is the { error: { code, message, issues? } } shape returned on every
// failed request, shared by transmission-vpn, pfsense-actions and discord-stonker-bot.
type errorEnvelope struct {
	Error errorBody `json:"error"`
}

// errorBody carries the machine-readable code, a display-safe message and optional
// field issues.
type errorBody struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Issues  []validationIssue `json:"issues,omitempty"`
	Details any               `json:"details,omitempty"`
}

// validationIssue points at one invalid request field.
type validationIssue struct {
	Field   string   `json:"field"`
	Path    []string `json:"path"`
	Message string   `json:"message"`
}

// newFieldIssue describes one invalid top-level request field.
func newFieldIssue(field string, message string) validationIssue {
	return validationIssue{
		Field:   field,
		Path:    []string{field},
		Message: message,
	}
}

// writeIssues reports every field that failed validation as invalid_request. The
// top-level message repeats the first issue so plain clients still get a sentence.
func writeIssues(responseWriter http.ResponseWriter, issues []validationIssue) {
	writeJSON(responseWriter, http.StatusUnprocessableEntity, errorEnvelope{
		Error: errorBody{
			Code:    "invalid_request",
			Message: issues[0].Message,
			Issues:  issues,
		},
	})
}

// writeDecodeError explains why a JSON body couldn't be read: it was too large, it
// had a field the route doesn't take, or it wasn't JSON at all.
func writeDecodeError(responseWriter http.ResponseWriter, err error) {
	var maximumBytesError *http.MaxBytesError
	if errors.As(err, &maximumBytesError) {
		writeError(responseWriter, http.StatusRequestEntityTooLarge, "payload_too_large", "The request body is larger than 1 MB.")

		return
	}

	// encoding/json reports an unexpected field only through this message.
	if field, found := strings.CutPrefix(err.Error(), "json: unknown field "); found {
		writeIssues(responseWriter, []validationIssue{newFieldIssue(strings.Trim(field, `"`), "This field isn't accepted.")})

		return
	}

	writeError(responseWriter, http.StatusBadRequest, "invalid_json", "The request body is not valid JSON.")
}

// writeInternalError answers an unexpected failure on a shared account route with
// the same message as pfsense-actions. Callers log the cause first; it never leaves
// the server.
func writeInternalError(responseWriter http.ResponseWriter) {
	writeError(responseWriter, http.StatusInternalServerError, "internal_error", "Something went wrong. Try again.")
}

// writeRateLimited refuses a client that used up its attempts and says when the
// window ends.
func (server *Server) writeRateLimited(responseWriter http.ResponseWriter, attemptKey string, message string) {
	responseWriter.Header().Set("Retry-After", strconv.Itoa(max(server.attempts.RetryAfter(attemptKey), 1)))
	writeError(responseWriter, http.StatusTooManyRequests, "rate_limited", message)
}

// listResponse wraps every collection response as { items }.
type listResponse[Item any] struct {
	Items []Item `json:"items"`
}

// principalFromContext returns the identity installed by authentication middleware.
//
// Handlers are registered only behind the middleware, so a missing value is an
// internal routing error and safely resolves to an empty principal.
func principalFromContext(ctx context.Context) principal {
	requestPrincipal, _ := ctx.Value(principalContextKey).(principal)

	return requestPrincipal
}

// attemptLimiter is a small in-memory fixed-window defense for setup and login routes.
//
// It complements password hashing for a single local account without introducing a
// distributed limiter dependency into the one-container appliance. onLimitReached, when
// set, hears about a client the moment its failures reach the maximum.
type attemptLimiter struct {
	mutex          sync.Mutex
	maximum        int
	window         time.Duration
	attemptsBy     map[string]attemptWindow
	onLimitReached func(string)
}

// attemptWindow records failures for one client during a bounded interval.
//
// Successful authentication clears the record, while stale records are replaced when
// the next request arrives after the window.
type attemptWindow struct {
	Failures  int
	StartedAt time.Time
}

// newAttemptLimiter creates a fixed-window failure limiter.
//
// Configuration is internal because the login surface is intentionally small and does
// not need another deployment setting.
func newAttemptLimiter(maximum int, window time.Duration) *attemptLimiter {
	return &attemptLimiter{
		maximum:    maximum,
		window:     window,
		attemptsBy: map[string]attemptWindow{},
	}
}

// Allowed reports whether one client may attempt authentication now.
//
// Expired windows are removed together so inactive clients cannot accumulate forever.
func (limiter *attemptLimiter) Allowed(key string) bool {
	limiter.mutex.Lock()
	defer limiter.mutex.Unlock()

	now := time.Now()
	limiter.removeExpired(now)
	attempt, found := limiter.attemptsBy[key]
	if !found {
		return true
	}

	return attempt.Failures < limiter.maximum
}

// Failed records one unsuccessful authentication attempt for a client.
//
// The first failure establishes the fixed window and later failures increment its
// bounded counter. The failure that reaches the maximum is reported once per window,
// after the lock is released.
func (limiter *attemptLimiter) Failed(key string) {
	limiter.mutex.Lock()

	now := time.Now()
	limiter.removeExpired(now)
	attempt, found := limiter.attemptsBy[key]
	if !found {
		limiter.removeOldestIfFull()
		attempt = attemptWindow{StartedAt: now}
	}

	attempt.Failures++
	limiter.attemptsBy[key] = attempt
	onLimitReached := limiter.onLimitReached
	reachedLimit := attempt.Failures == limiter.maximum

	limiter.mutex.Unlock()

	if reachedLimit && onLimitReached != nil {
		onLimitReached(key)
	}
}

// RetryAfter returns the whole seconds left before a limited client may try again,
// rounded up so it never retries a moment too early.
func (limiter *attemptLimiter) RetryAfter(key string) int {
	limiter.mutex.Lock()
	defer limiter.mutex.Unlock()

	now := time.Now()
	limiter.removeExpired(now)
	attempt, found := limiter.attemptsBy[key]
	if !found {
		return 0
	}

	remaining := limiter.window - now.Sub(attempt.StartedAt)
	if remaining <= 0 {
		return 0
	}

	return int(math.Ceil(remaining.Seconds()))
}

// Succeeded clears failures after a valid setup claim or administrator login.
//
// A corrected password should not remain penalized by earlier local mistakes.
func (limiter *attemptLimiter) Succeeded(key string) {
	limiter.mutex.Lock()
	defer limiter.mutex.Unlock()

	delete(limiter.attemptsBy, key)
}

// removeExpired drops every client whose fixed window has elapsed.
//
// Sweeping the small bounded map on limiter activity keeps both administrator and RPC
// sign-in state proportional to clients that can still be limited.
func (limiter *attemptLimiter) removeExpired(now time.Time) {
	for key, attempt := range limiter.attemptsBy {
		if now.Sub(attempt.StartedAt) >= limiter.window {
			delete(limiter.attemptsBy, key)
		}
	}
}

// removeOldestIfFull makes room for one new client while preserving the hard cap.
//
// The fixed-window start time gives a deterministic age for eviction without adding
// another unbounded ordering structure beside the map.
func (limiter *attemptLimiter) removeOldestIfFull() {
	if len(limiter.attemptsBy) < maximumTrackedAttemptClients {
		return
	}

	oldestKey := ""
	var oldestStartedAt time.Time
	for key, attempt := range limiter.attemptsBy {
		if oldestKey == "" || attempt.StartedAt.Before(oldestStartedAt) {
			oldestKey = key
			oldestStartedAt = attempt.StartedAt
		}
	}
	delete(limiter.attemptsBy, oldestKey)
}
