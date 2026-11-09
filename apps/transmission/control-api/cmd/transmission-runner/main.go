package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionrpc"
)

// Keep each daemon's bounded shutdown inside Docker's default 10-second stop
// window so s6 can run dependent firewall teardown before the container exits.
const daemonShutdownTimeout = 5 * time.Second

// options contains the runner's fixed container paths and test timing controls.
type options struct {
	BackoffResetAfter time.Duration
	ConfigDirectory   string
	DaemonPath        string
	ReadinessTimeout  time.Duration
	RestartBackoff    time.Duration
	RuntimeDirectory  string
	WatchInterval     time.Duration
}

// readinessState is the identity returned by a ready Transmission daemon.
type readinessState struct {
	RPCVersion       int    `json:"rpc-version"`
	RPCVersionSemver string `json:"rpc-version-semver"`
	Version          string `json:"version"`
}

// main runs the unprivileged multi-daemon supervisor and reports fatal errors.
func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	if err := run(logger); err != nil {
		logger.Error("Transmission runner stopped", "error", err)
		os.Exit(1)
	}
}

// run watches the API's daemon declaration until s6 asks the runner to stop.
func run(logger *slog.Logger) error {
	configuredOptions := parseOptions()
	if configuredOptions.WatchInterval <= 0 {
		return errors.New("Transmission watch interval must be positive")
	}
	if configuredOptions.RestartBackoff <= 0 {
		return errors.New("Transmission restart backoff must be positive")
	}
	if configuredOptions.BackoffResetAfter <= 0 {
		return errors.New("Transmission backoff reset duration must be positive")
	}

	shutdownContext, stopSignals := signal.NotifyContext(
		context.Background(),
		syscall.SIGINT,
		syscall.SIGTERM,
	)
	defer stopSignals()

	supervisor := newRunner(configuredOptions, logger)
	return supervisor.run(shutdownContext)
}

// parseOptions exposes only container-internal lifecycle paths for testability.
func parseOptions() options {
	configuredOptions := options{}
	flag.DurationVar(
		&configuredOptions.BackoffResetAfter,
		"backoff-reset-after",
		60*time.Second,
		"ready time required before resetting the daemon restart backoff",
	)
	flag.StringVar(
		&configuredOptions.ConfigDirectory,
		"config-directory",
		"/config/transmission",
		"Transmission configuration root directory",
	)
	flag.StringVar(
		&configuredOptions.DaemonPath,
		"daemon",
		"/usr/local/bin/transmission-daemon",
		"Transmission daemon executable",
	)
	flag.DurationVar(
		&configuredOptions.ReadinessTimeout,
		"readiness-timeout",
		30*time.Second,
		"maximum time to wait for each Transmission RPC listener",
	)
	flag.DurationVar(
		&configuredOptions.RestartBackoff,
		"restart-backoff",
		time.Second,
		"initial delay after an unexpected daemon failure",
	)
	flag.StringVar(
		&configuredOptions.RuntimeDirectory,
		"runtime-directory",
		"/run/transmission-vpn",
		"shared runtime state directory",
	)
	flag.DurationVar(
		&configuredOptions.WatchInterval,
		"watch-interval",
		time.Second,
		"daemon-list and VPN-status polling interval",
	)
	flag.Parse()

	return configuredOptions
}

// waitForReadiness polls one loopback adapter until the daemon answers or exits.
func waitForReadiness(
	ctx context.Context,
	client transmissionrpc.Caller,
	exited <-chan error,
	timeout time.Duration,
) (readinessState, error) {
	deadline := time.NewTimer(timeout)
	defer deadline.Stop()
	ticker := time.NewTicker(250 * time.Millisecond)
	defer ticker.Stop()

	for {
		callContext, cancelCall := context.WithTimeout(ctx, 2*time.Second)
		var readiness readinessState
		err := client.Call(callContext, "session-get", map[string]any{
			"fields": []string{"rpc-version", "rpc-version-semver", "version"},
		}, &readiness)
		cancelCall()
		if err == nil && readiness.RPCVersion > 0 && readiness.Version != "" {
			return readiness, nil
		}

		select {
		case <-ctx.Done():
			return readinessState{}, ctx.Err()
		case processError := <-exited:
			if processError == nil {
				processError = errors.New("daemon exited before readiness")
			}

			return readinessState{}, fmt.Errorf(
				"Transmission daemon did not become ready: %w",
				processError,
			)
		case <-deadline.C:
			return readinessState{}, fmt.Errorf(
				"Transmission RPC did not become ready within %s",
				timeout,
			)
		case <-ticker.C:
		}
	}
}

// stopProcessGroup gracefully stops Transmission, then enforces a bounded shutdown.
func stopProcessGroup(processID int, exited <-chan error) {
	if err := syscall.Kill(-processID, syscall.SIGTERM); errors.Is(err, syscall.ESRCH) {
		return
	}

	shutdownTimer := time.NewTimer(daemonShutdownTimeout)
	defer shutdownTimer.Stop()
	select {
	case <-exited:
		return
	case <-shutdownTimer.C:
		_ = syscall.Kill(-processID, syscall.SIGKILL)
		select {
		case <-exited:
		case <-time.After(2 * time.Second):
		}
	}
}
