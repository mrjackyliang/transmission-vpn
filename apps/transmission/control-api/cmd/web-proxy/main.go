package main

import (
	"context"
	"flag"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/webproxy"
)

// options contains the proxy's fixed runtime paths and shared listen address.
//
// Flags exist for isolated tests and image evolution; persisted settings continue to
// arrive only through the control API's permission-restricted configuration file.
type options struct {
	ListenAddress      string
	ConfigPath         string
	StatusPath         string
	VPNStatusDirectory string
	ReadyPath          string
}

// main runs the unprivileged proxy until s6 sends a shutdown signal.
//
// The service closes its listener and active tunnels before returning so the firewall
// can remain installed until all protected application traffic has stopped.
func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	if err := run(logger); err != nil {
		logger.Error("web proxy stopped", "error", err)
		os.Exit(1)
	}
}

// run creates the service and binds its lifetime to SIGINT and SIGTERM.
func run(logger *slog.Logger) error {
	configuredOptions := parseOptions()
	service, err := webproxy.New(webproxy.Config{
		ListenAddress:      configuredOptions.ListenAddress,
		ConfigPath:         configuredOptions.ConfigPath,
		StatusPath:         configuredOptions.StatusPath,
		VPNStatusDirectory: configuredOptions.VPNStatusDirectory,
		ReadyPath:          configuredOptions.ReadyPath,
		Logger:             logger,
	})
	if err != nil {
		return err
	}

	signalContext, cancelSignals := signal.NotifyContext(
		context.Background(),
		syscall.SIGINT,
		syscall.SIGTERM,
	)
	defer cancelSignals()

	return service.Run(signalContext)
}

// parseOptions reads internal process flags with the immutable image defaults.
func parseOptions() options {
	configuredOptions := options{}
	flag.StringVar(
		&configuredOptions.ListenAddress,
		"listen",
		":22605",
		"HTTP and SOCKS5 proxy listen address",
	)
	flag.StringVar(
		&configuredOptions.ConfigPath,
		"config",
		"/run/transmission-vpn/web-proxy/config.json",
		"control API proxy configuration path",
	)
	flag.StringVar(
		&configuredOptions.StatusPath,
		"status",
		"/run/transmission-vpn/web-proxy-state/status.json",
		"proxy runtime status path",
	)
	flag.StringVar(
		&configuredOptions.VPNStatusDirectory,
		"vpn-status-directory",
		"/run/transmission-vpn/vpn.status.d",
		"per-connection VPN controller status directory",
	)
	flag.StringVar(
		&configuredOptions.ReadyPath,
		"ready",
		"/run/transmission-vpn/services/web-proxy.ready",
		"service readiness marker path",
	)
	flag.Parse()

	return configuredOptions
}
