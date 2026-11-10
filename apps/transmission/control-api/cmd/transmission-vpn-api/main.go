package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/api"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/capacity"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/controller"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/directorybrowser"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionrpc"
)

var version = "development"

// options contains filesystem and socket boundaries owned by the container layout.
//
// Flags keep the production defaults explicit while allowing isolated integration
// tests without creating a broad environment-variable configuration surface.
type options struct {
	DatabasePath        string
	InitializeOnly      bool
	InstallationKeyPath string
	ListenAddress       string
	ManagedConfigPath   string
	RPCListenAddress    string
	RuntimeDirectory    string
	SetupClaimPath      string
	WebDirectory        string
}

// main starts the unprivileged control plane and reports fatal startup failures.
//
// s6 supervises this process and applies restart policy when initialization or runtime
// serving cannot continue safely.
func main() {
	// State under /config is shared with the PUID:PGID group, so new files stay
	// group-writable when the host gives every persistent file to PUID:PGID.
	syscall.Umask(0o007)

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	if err := run(logger); err != nil {
		logger.Error("control API stopped", "error", err)
		os.Exit(1)
	}
}

// run initializes durable state, setup access, HTTP serving, and graceful shutdown.
//
// Dependencies are prepared before the readiness marker is published so s6 and Docker
// health checks cannot observe a partially initialized control plane.
func run(logger *slog.Logger) error {
	configuredOptions := parseOptions()
	ctx := context.Background()

	registry := settings.NewRegistry()
	store, err := storage.Open(ctx, configuredOptions.DatabasePath)
	if err != nil {
		return err
	}
	defer store.Close()

	keyResult, err := api.PrepareInstallationKey(ctx, store, configuredOptions.InstallationKeyPath)
	if err != nil {
		return err
	}
	installationKey := keyResult.Key
	if len(keyResult.Removed) > 0 {
		logger.Warn(fmt.Sprintf(
			"No installation key was found at %s, so Transmission VPN made a new one. These saved secrets were locked with the old key and were removed: %s. Enter them again in the web interface.",
			configuredOptions.InstallationKeyPath,
			strings.Join(keyResult.Removed, ", "),
		))
	}
	api.NotifySecretsRemoved(store, installationKey, logger, keyResult.Removed)

	managedDocument, err := settings.ReadManagedDocument(
		configuredOptions.ManagedConfigPath,
		registry,
	)
	if err != nil {
		return err
	}

	configurationRevision, err := store.ApplyManagedConfiguration(ctx, registry, managedDocument)
	if err != nil {
		return err
	}

	if err := store.CleanupExpiredAuthentication(ctx); err != nil {
		return err
	}

	if configuredOptions.InitializeOnly {
		if _, err := api.PublishTransmissionConfiguration(
			ctx,
			store,
			registry,
			configuredOptions.RuntimeDirectory,
		); err != nil {
			return err
		}
		logger.Info(
			"control state initialization is complete",
			"configurationRevision",
			configurationRevision,
		)

		return nil
	}

	mountedSetupCode, err := prepareSetupClaim(ctx, store, configuredOptions.SetupClaimPath, logger)
	if err != nil {
		return err
	}

	transmissionClients := transmissionrpc.NewClientSet(30 * time.Second)

	controlServer, err := api.NewServer(api.Config{
		Store:           store,
		Registry:        registry,
		InstallationKey: installationKey,
		Capacity:        capacity.NewDetector(capacity.DefaultPaths(), time.Minute),
		Controller: controller.NewClient(
			filepath.Join(configuredOptions.RuntimeDirectory, "controller.sock"),
			75*time.Second,
		),
		DirectoryBrowser: directorybrowser.NewClient(
			filepath.Join(
				configuredOptions.RuntimeDirectory,
				"directories",
				"controller.sock",
			),
			5*time.Second,
		),
		Transmission:        transmissionClients,
		TransmissionClients: transmissionClients,
		RuntimeDirectory:    configuredOptions.RuntimeDirectory,
		WebDirectory:        configuredOptions.WebDirectory,
		Logger:              logger,
		Version:             version,
		MountedSetupCode:    mountedSetupCode,
	})
	if err != nil {
		return err
	}
	defer controlServer.Close()
	controlServer.WatchNotifications()

	listener, err := net.Listen("tcp", configuredOptions.ListenAddress)
	if err != nil {
		return fmt.Errorf("listen on %s: %w", configuredOptions.ListenAddress, err)
	}
	defer listener.Close()

	rpcListener, err := net.Listen("tcp", configuredOptions.RPCListenAddress)
	if err != nil {
		return fmt.Errorf("listen on %s: %w", configuredOptions.RPCListenAddress, err)
	}
	defer rpcListener.Close()

	markerPath := filepath.Join(
		configuredOptions.RuntimeDirectory,
		"services",
		"control-api.ready",
	)
	if err := writeReadinessMarker(markerPath, configurationRevision); err != nil {
		return err
	}
	defer os.Remove(markerPath)

	httpServer := &http.Server{
		Handler:           controlServer,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      0,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    32 * 1024,
	}
	rpcServer := &http.Server{
		Handler:           controlServer.RPCHandler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      0,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    32 * 1024,
	}

	serveErrors := make(chan error, 2)
	go func() {
		serveErrors <- httpServer.Serve(listener)
	}()
	go func() {
		serveErrors <- rpcServer.Serve(rpcListener)
	}()

	restoreContext, cancelRestore := context.WithCancel(context.Background())
	defer cancelRestore()
	go keepVPNRestored(restoreContext, controlServer, logger)

	logger.Info(
		"control API is ready",
		"address",
		configuredOptions.ListenAddress,
		"rpcAddress",
		configuredOptions.RPCListenAddress,
		"version",
		version,
		"configurationRevision",
		configurationRevision,
	)

	shutdownSignals := make(chan os.Signal, 1)
	signal.Notify(shutdownSignals, syscall.SIGINT, syscall.SIGTERM)
	defer signal.Stop(shutdownSignals)

	select {
	case receivedSignal := <-shutdownSignals:
		logger.Info("control API is stopping", "signal", receivedSignal.String())
	case serveError := <-serveErrors:
		if !errors.Is(serveError, http.ErrServerClosed) {
			return fmt.Errorf("serve control API: %w", serveError)
		}
	}

	shutdownContext, cancelShutdown := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancelShutdown()
	if err := httpServer.Shutdown(shutdownContext); err != nil {
		return fmt.Errorf("shut down control API: %w", err)
	}
	if err := rpcServer.Shutdown(shutdownContext); err != nil {
		return fmt.Errorf("shut down compatible RPC: %w", err)
	}

	return nil
}

// keepVPNRestored recovers enabled last-known-good tunnels for as long as the API runs.
//
// Every 10 seconds it reconnects missing, blocked, or sessionless controller states: at
// startup, after s6 restarts a crashed controller without its tunnels, and after a
// failed connect or reconnect. Controller ordering and provider outages never block the
// setup UI, and a check that stepped aside for an administrator change is not logged.
func keepVPNRestored(
	ctx context.Context,
	server *api.Server,
	logger *slog.Logger,
) {
	for {
		if err := server.RestoreActiveVPN(ctx); err != nil &&
			ctx.Err() == nil && !errors.Is(err, api.ErrVPNRestoreDeferred) {
			logger.Warn("restore active VPN configuration", "error", err)
		}

		retryTimer := time.NewTimer(10 * time.Second)
		select {
		case <-ctx.Done():
			retryTimer.Stop()

			return
		case <-retryTimer.C:
		}
	}
}

// parseOptions reads the intentionally internal process flags.
//
// Deployments use fixed container paths; the flags exist for test isolation and future
// s6-owned compatibility rather than as routine user configuration.
func parseOptions() options {
	configuredOptions := options{}
	flag.StringVar(
		&configuredOptions.DatabasePath,
		"database",
		"/config/app/state.sqlite3",
		"SQLite application state path",
	)
	flag.BoolVar(
		&configuredOptions.InitializeOnly,
		"initialize-only",
		false,
		"initialize persistent state and exit",
	)
	flag.StringVar(
		&configuredOptions.InstallationKeyPath,
		"installation-key",
		"/config/app/keys/installation.key",
		"installation encryption key path",
	)
	flag.StringVar(
		&configuredOptions.ListenAddress,
		"listen",
		":22602",
		"control API listen address",
	)
	flag.StringVar(
		&configuredOptions.ManagedConfigPath,
		"managed-config",
		"/config/managed.json",
		"optional managed configuration document",
	)
	flag.StringVar(
		&configuredOptions.RPCListenAddress,
		"rpc-listen",
		":9091",
		"compatible Transmission RPC listen address",
	)
	flag.StringVar(
		&configuredOptions.RuntimeDirectory,
		"runtime-directory",
		"/run/transmission-vpn",
		"shared runtime state directory",
	)
	flag.StringVar(
		&configuredOptions.SetupClaimPath,
		"setup-claim-file",
		"/run/secrets/transmission-vpn-claim",
		"optional mounted one-time setup claim secret",
	)
	flag.StringVar(
		&configuredOptions.WebDirectory,
		"web-directory",
		"/usr/local/share/transmission-vpn/web",
		"compiled web interface directory",
	)
	flag.Parse()

	return configuredOptions
}

// prepareSetupClaim rotates generated claims or loads the managed claim secret.
//
// Claimed installations remove stale setup rows and never emit another credential;
// unclaimed generated codes expire after thirty minutes. It reports whether the mounted
// secret is in use, because the API compares that one exactly.
func prepareSetupClaim(
	ctx context.Context,
	store *storage.Store,
	claimFilePath string,
	logger *slog.Logger,
) (bool, error) {
	claimed, err := store.IsClaimed(ctx)
	if err != nil {
		return false, err
	}

	if claimed {
		return false, store.ReplaceSetupClaim(ctx, nil, time.Time{})
	}

	claimCode := ""
	claimLifetime := 30 * time.Minute
	claimFileContent, err := os.ReadFile(claimFilePath)
	if err == nil {
		claimCode = strings.TrimSpace(string(claimFileContent))
		if len(claimCode) < 12 || len(claimCode) > 256 {
			return false, errors.New("mounted setup claim must contain between 12 and 256 characters")
		}
		claimLifetime = 24 * time.Hour
	} else if !errors.Is(err, os.ErrNotExist) {
		return false, fmt.Errorf("read mounted setup claim: %w", err)
	} else {
		claimCode, err = security.NewClaimCode()
		if err != nil {
			return false, err
		}
	}

	expiresAt := time.Now().Add(claimLifetime)
	if err := store.ReplaceSetupClaim(ctx, security.Digest(claimCode), expiresAt); err != nil {
		return false, err
	}

	if claimFileContent != nil {
		logger.Warn(
			"No administrator account exists yet. Open the web interface to create it with the mounted setup code.",
			"claimFile",
			claimFilePath,
			"expiresAt",
			expiresAt,
		)
	} else {
		logger.Warn(
			"No administrator account exists yet. Open the web interface to create it with the setup code.",
			"setupCode",
			claimCode,
			"expiresAt",
			expiresAt,
		)
	}

	return claimFileContent != nil, nil
}

// writeReadinessMarker atomically publishes the running control-plane generation.
//
// Writing and renaming in the shared runtime directory prevents health checks from
// reading a partial JSON document during startup.
func writeReadinessMarker(path string, configurationRevision int64) error {
	directory := filepath.Dir(path)
	temporaryFile, err := os.CreateTemp(directory, ".control-api-ready-*")
	if err != nil {
		return fmt.Errorf("create control API readiness marker: %w", err)
	}

	temporaryPath := temporaryFile.Name()
	committed := false
	defer func() {
		_ = temporaryFile.Close()
		if !committed {
			_ = os.Remove(temporaryPath)
		}
	}()

	if err := temporaryFile.Chmod(0o644); err != nil {
		return fmt.Errorf("set control API readiness permissions: %w", err)
	}

	if err := json.NewEncoder(temporaryFile).Encode(map[string]any{
		"service":               "control-api",
		"phase":                 "control-plane",
		"version":               version,
		"configurationRevision": configurationRevision,
	}); err != nil {
		return fmt.Errorf("encode control API readiness marker: %w", err)
	}

	if err := temporaryFile.Sync(); err != nil {
		return fmt.Errorf("sync control API readiness marker: %w", err)
	}

	if err := temporaryFile.Close(); err != nil {
		return fmt.Errorf("close control API readiness marker: %w", err)
	}

	if err := os.Rename(temporaryPath, path); err != nil {
		return fmt.Errorf("publish control API readiness marker: %w", err)
	}

	committed = true

	return nil
}
