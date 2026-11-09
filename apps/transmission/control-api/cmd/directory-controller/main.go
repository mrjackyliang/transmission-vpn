package main

import (
	"context"
	"flag"
	"log/slog"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/directorybrowser"
)

// options contains the immutable directory-controller runtime boundaries.
//
// Flags support isolated tests and future image-layout changes without turning the
// storage root into routine deployment configuration.
type options struct {
	RootPath             string
	TransmissionRootPath string
	RuntimeDirectory     string
}

// main starts the unprivileged directory controller and reports fatal failures.
//
// s6 supervises this process under the Transmission identity so new folders inherit
// the same ownership used by downloaded data.
func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	if err := run(logger); err != nil {
		logger.Error("directory controller stopped", "error", err)
		os.Exit(1)
	}
}

// run constructs the fixed local service and blocks until a shutdown signal arrives.
//
// Readiness is published by the server only after its permission-restricted socket is
// accepting requests.
func run(logger *slog.Logger) error {
	configuredOptions := parseOptions()
	server, err := directorybrowser.NewServer(directorybrowser.ServerConfig{
		RootPath:             configuredOptions.RootPath,
		TransmissionRootPath: configuredOptions.TransmissionRootPath,
		SocketPath: filepath.Join(
			configuredOptions.RuntimeDirectory,
			"directories",
			"controller.sock",
		),
		MarkerPath: filepath.Join(
			configuredOptions.RuntimeDirectory,
			"services",
			"directory-controller.ready",
		),
		Logger: logger,
	})
	if err != nil {
		return err
	}

	serveContext, stopSignals := signal.NotifyContext(
		context.Background(),
		syscall.SIGINT,
		syscall.SIGTERM,
	)
	defer stopSignals()

	logger.Info("directory controller is starting", "root", configuredOptions.RootPath)

	return server.Serve(serveContext)
}

// parseOptions reads the intentionally internal process flags.
//
// Production uses the fixed /data and shared-runtime defaults defined by the image.
func parseOptions() options {
	configuredOptions := options{}
	flag.StringVar(
		&configuredOptions.RootPath,
		"root",
		"/data",
		"approved directory browser root",
	)
	flag.StringVar(
		&configuredOptions.TransmissionRootPath,
		"transmission-root",
		"/config/transmission",
		"Transmission daemon state root",
	)
	flag.StringVar(
		&configuredOptions.RuntimeDirectory,
		"runtime-directory",
		"/run/transmission-vpn",
		"shared runtime state directory",
	)
	flag.Parse()

	return configuredOptions
}
