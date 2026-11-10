package main

import (
	"context"
	"flag"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/controller"
)

// options contains fixed privileged runtime dependencies.
//
// These flags support isolated integration tests and image evolution; they are not
// routine deployment settings or provider-controlled values.
type options struct {
	SocketPath              string
	DirectSocketPath        string
	RuntimeDirectory        string
	OpenVPNPath             string
	WireGuardPath           string
	WireGuardGoPath         string
	WireGuardImplementation string
	IPPath                  string
	FirewallBlockPath       string
	FirewallProtectPath     string
	ResolverPath            string
	ControlGroup            string
	ConnectTimeout          time.Duration
}

// main starts the privileged controller under s6 supervision.
//
// Signals cancel the daemon context, which blocks Transmission before stopping its
// tunnel and returning control to s6.
func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	configuredOptions := parseOptions()

	signalContext, cancelSignals := signal.NotifyContext(
		context.Background(),
		syscall.SIGINT,
		syscall.SIGTERM,
	)
	defer cancelSignals()

	daemon, err := controller.NewDaemon(controller.DaemonConfig{
		SocketPath:              configuredOptions.SocketPath,
		DirectSocketPath:        configuredOptions.DirectSocketPath,
		RuntimeDirectory:        configuredOptions.RuntimeDirectory,
		OpenVPNPath:             configuredOptions.OpenVPNPath,
		WireGuardPath:           configuredOptions.WireGuardPath,
		WireGuardGoPath:         configuredOptions.WireGuardGoPath,
		WireGuardImplementation: configuredOptions.WireGuardImplementation,
		IPPath:                  configuredOptions.IPPath,
		FirewallBlockPath:       configuredOptions.FirewallBlockPath,
		FirewallProtectPath:     configuredOptions.FirewallProtectPath,
		ResolverPath:            configuredOptions.ResolverPath,
		ControlGroup:            configuredOptions.ControlGroup,
		ConnectTimeout:          configuredOptions.ConnectTimeout,
		Logger:                  logger,
	})
	if err != nil {
		logger.Error("initialize VPN controller", "error", err)
		os.Exit(1)
	}

	if err := daemon.Serve(signalContext); err != nil {
		logger.Error("VPN controller stopped", "error", err)
		os.Exit(1)
	}
}

// parseOptions reads the controller's internal process configuration.
//
// Production defaults match the immutable image layout and restricted runtime socket
// contract defined by the architecture.
func parseOptions() options {
	configuredOptions := options{}
	flag.StringVar(
		&configuredOptions.SocketPath,
		"socket",
		"/run/transmission-vpn/controller.sock",
		"control API command socket",
	)
	flag.StringVar(
		&configuredOptions.DirectSocketPath,
		"direct-socket",
		"/run/transmission-vpn/direct.sock",
		"socket that opens connections outside the VPN for the control API",
	)
	flag.StringVar(
		&configuredOptions.RuntimeDirectory,
		"runtime-directory",
		"/run/transmission-vpn",
		"shared runtime state directory",
	)
	flag.StringVar(
		&configuredOptions.OpenVPNPath,
		"openvpn",
		"/usr/sbin/openvpn",
		"OpenVPN executable path",
	)
	flag.StringVar(
		&configuredOptions.WireGuardPath,
		"wireguard",
		"/usr/bin/wg",
		"WireGuard wg(8) executable path",
	)
	flag.StringVar(
		&configuredOptions.WireGuardGoPath,
		"wireguard-go",
		"/usr/bin/wireguard-go",
		"userspace WireGuard executable path",
	)
	flag.StringVar(
		&configuredOptions.WireGuardImplementation,
		"wireguard-implementation",
		"auto",
		"WireGuard engine: auto, kernel, or userspace",
	)
	flag.StringVar(
		&configuredOptions.IPPath,
		"ip",
		"/sbin/ip",
		"iproute2 executable path",
	)
	flag.StringVar(
		&configuredOptions.FirewallBlockPath,
		"firewall-block",
		"/usr/local/libexec/transmission-vpn/firewall-block.sh",
		"fail-closed firewall helper",
	)
	flag.StringVar(
		&configuredOptions.FirewallProtectPath,
		"firewall-protect",
		"/usr/local/libexec/transmission-vpn/firewall-protect.sh",
		"verified tunnel firewall helper",
	)
	flag.StringVar(
		&configuredOptions.ResolverPath,
		"resolver",
		"/etc/resolv.conf",
		"container resolver configuration path",
	)
	flag.StringVar(
		&configuredOptions.ControlGroup,
		"control-group",
		"control",
		"unprivileged API socket group",
	)
	flag.DurationVar(
		&configuredOptions.ConnectTimeout,
		"connect-timeout",
		60*time.Second,
		"maximum time for a tunnel to become ready",
	)
	flag.Parse()

	return configuredOptions
}
