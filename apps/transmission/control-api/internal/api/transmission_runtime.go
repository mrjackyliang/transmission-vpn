package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/blocklist"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionconfig"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionrpc"
)

const transmissionConfigurationRetryInterval = 5 * time.Second

// transmissionDaemonConfiguration is one runner-owned daemon declaration.
//
// Every durable connection is included even while disabled so its torrents remain
// locally visible and manageable with fail-closed loopback source binding.
type transmissionDaemonConfiguration struct {
	ConnectionID string `json:"connectionId"`
	Slot         int    `json:"slot"`
	PeerPort     int    `json:"peerPort"`
	Default      bool   `json:"default"`
}

// PublishTransmissionConfiguration writes the complete runner hand-off atomically.
//
// Initialization and the serving API share this function so first boot, settings
// saves, restarts, and connection changes render byte-for-byte equivalent files.
//
// Since: 2.0.0
func PublishTransmissionConfiguration(
	ctx context.Context,
	store *storage.Store,
	registry settings.Registry,
	runtimeDirectory string,
) ([]transmissionrpc.DaemonConfig, error) {
	connections, err := store.ListVPNConnections(ctx)
	if err != nil {
		return nil, fmt.Errorf("list Transmission daemon connections: %w", err)
	}

	snapshot, err := store.EffectiveConfiguration(ctx, registry)
	if err != nil {
		return nil, fmt.Errorf("read Transmission base settings: %w", err)
	}
	baseSettings, err := transmissionconfig.Render(snapshot)
	if err != nil {
		return nil, fmt.Errorf("render Transmission base settings: %w", err)
	}
	blocklistConfiguration, err := blocklistConfigurationFromSnapshot(snapshot)
	if err != nil {
		return nil, fmt.Errorf("render blocklist configuration: %w", err)
	}

	daemons := make([]transmissionDaemonConfiguration, 0, len(connections))
	clientConfigurations := make([]transmissionrpc.DaemonConfig, 0, len(connections))
	for _, connection := range connections {
		daemons = append(daemons, transmissionDaemonConfiguration{
			ConnectionID: connection.ID,
			Slot:         connection.Slot,
			PeerPort:     connection.PeerPort,
			Default:      connection.IsDefault,
		})
		clientConfigurations = append(clientConfigurations, transmissionrpc.DaemonConfig{
			ConnectionID: connection.ID,
			Slot:         connection.Slot,
			PeerPort:     connection.PeerPort,
			Default:      connection.IsDefault,
		})
	}

	configurationDirectory := filepath.Join(runtimeDirectory, "transmission-config")
	blocklistConfigurationPath := filepath.Join(
		configurationDirectory,
		blocklist.ConfigurationFileName,
	)
	existingBlocklistConfiguration, readError := blocklist.ReadConfiguration(
		blocklistConfigurationPath,
	)
	if readError == nil {
		blocklistConfiguration.UpdateRequestedAt = existingBlocklistConfiguration.UpdateRequestedAt
	} else if !errors.Is(readError, os.ErrNotExist) {
		return nil, readError
	}
	if err := blocklist.WriteJSON(blocklistConfigurationPath, blocklistConfiguration, 0o640); err != nil {
		return nil, err
	}
	if err := transmissionconfig.WriteShared(
		filepath.Join(configurationDirectory, "settings-base.json"),
		baseSettings,
	); err != nil {
		return nil, err
	}
	if err := writeTransmissionDaemons(
		filepath.Join(configurationDirectory, "daemons.json"),
		daemons,
	); err != nil {
		return nil, err
	}

	return clientConfigurations, nil
}

// publishTransmissionConfiguration refreshes files and the in-process RPC clients.
func (server *Server) publishTransmissionConfiguration(ctx context.Context) error {
	server.transmissionConfigMutex.Lock()
	defer server.transmissionConfigMutex.Unlock()

	publisher := server.transmissionConfigPublisher
	if publisher == nil {
		publisher = PublishTransmissionConfiguration
	}
	clientConfigurations, err := publisher(
		ctx,
		server.store,
		server.registry,
		server.runtimeDirectory,
	)
	if err != nil {
		return err
	}
	if server.transmissionClients != nil {
		if err := server.transmissionClients.Replace(clientConfigurations); err != nil {
			return err
		}
	}

	return nil
}

// publishTransmissionConfigurationAfterSave publishes or starts one retry owner.
//
// Default switches and deletions are already durable when this runs, so a failed
// hand-off must keep retrying the latest database snapshot without blocking proxy work.
func (server *Server) publishTransmissionConfigurationAfterSave(ctx context.Context) error {
	err := server.publishTransmissionConfiguration(ctx)
	if err != nil {
		server.startTransmissionConfigRetry(err)

		return err
	}

	server.markTransmissionConfigPublished()

	return nil
}

// startTransmissionConfigRetry starts at most one background publication loop.
//
// The first failure in a streak is logged. The active loop always renders current
// durable state, so several committed changes collapse into one eventual snapshot.
func (server *Server) startTransmissionConfigRetry(publishError error) {
	server.transmissionConfigRetryMutex.Lock()
	logFailure := !server.transmissionConfigFailureLogged
	server.transmissionConfigFailureLogged = true
	if server.transmissionConfigRetryCancel != nil {
		server.transmissionConfigRetryMutex.Unlock()
		if logFailure {
			server.logInternalError("publish Transmission configuration; retrying", publishError)
		}

		return
	}

	retryContext, cancelRetry := context.WithCancel(context.Background())
	server.transmissionConfigRetryGeneration++
	retryGeneration := server.transmissionConfigRetryGeneration
	server.transmissionConfigRetryCancel = cancelRetry
	retryInterval := server.transmissionConfigRetryInterval
	if retryInterval <= 0 {
		retryInterval = transmissionConfigurationRetryInterval
	}
	server.transmissionConfigRetryWait.Add(1)
	server.transmissionConfigRetryMutex.Unlock()

	if logFailure {
		server.logInternalError("publish Transmission configuration; retrying", publishError)
	}

	go server.retryTransmissionConfig(retryContext, retryGeneration, retryInterval)
}

// retryTransmissionConfig republishes the latest durable snapshot until it succeeds.
//
// The generation check prevents an older loop from clearing state owned by a newer
// direct publication or retry sequence.
func (server *Server) retryTransmissionConfig(
	ctx context.Context,
	retryGeneration uint64,
	retryInterval time.Duration,
) {
	defer server.transmissionConfigRetryWait.Done()

	ticker := time.NewTicker(retryInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := server.publishTransmissionConfiguration(ctx); err != nil {
				continue
			}

			server.transmissionConfigRetryMutex.Lock()
			if server.transmissionConfigRetryGeneration == retryGeneration {
				server.transmissionConfigRetryCancel = nil
				server.transmissionConfigFailureLogged = false
			}
			server.transmissionConfigRetryMutex.Unlock()

			return
		}
	}
}

// markTransmissionConfigPublished cancels stale retry work after a direct success.
//
// Resetting the failure streak lets a later independent outage log its first failure
// without allowing the cancelled loop to change the new generation.
func (server *Server) markTransmissionConfigPublished() {
	server.transmissionConfigRetryMutex.Lock()
	server.transmissionConfigRetryGeneration++
	cancelRetry := server.transmissionConfigRetryCancel
	server.transmissionConfigRetryCancel = nil
	server.transmissionConfigFailureLogged = false
	server.transmissionConfigRetryMutex.Unlock()

	if cancelRetry != nil {
		cancelRetry()
	}
}

// stopTransmissionConfigRetry releases the retry goroutine during server shutdown.
//
// Waiting after cancellation keeps tests and process shutdown from retaining a
// publisher that still owns the server's storage or client set.
func (server *Server) stopTransmissionConfigRetry() {
	server.transmissionConfigRetryMutex.Lock()
	server.transmissionConfigRetryGeneration++
	cancelRetry := server.transmissionConfigRetryCancel
	server.transmissionConfigRetryCancel = nil
	server.transmissionConfigRetryMutex.Unlock()

	if cancelRetry != nil {
		cancelRetry()
	}
	server.transmissionConfigRetryWait.Wait()
}

// writeTransmissionDaemons publishes the runner list with group-readable mode 0640.
func writeTransmissionDaemons(path string, daemons []transmissionDaemonConfiguration) error {
	temporaryFile, err := os.CreateTemp(filepath.Dir(path), ".transmission-daemons-*")
	if err != nil {
		return fmt.Errorf("create Transmission daemon list: %w", err)
	}

	temporaryPath := temporaryFile.Name()
	committed := false
	defer func() {
		_ = temporaryFile.Close()
		if !committed {
			_ = os.Remove(temporaryPath)
		}
	}()

	if err := temporaryFile.Chmod(0o640); err != nil {
		return fmt.Errorf("set Transmission daemon list permissions: %w", err)
	}
	if err := json.NewEncoder(temporaryFile).Encode(daemons); err != nil {
		return fmt.Errorf("encode Transmission daemon list: %w", err)
	}
	if err := temporaryFile.Sync(); err != nil {
		return fmt.Errorf("sync Transmission daemon list: %w", err)
	}
	if err := temporaryFile.Close(); err != nil {
		return fmt.Errorf("close Transmission daemon list: %w", err)
	}
	if err := os.Rename(temporaryPath, path); err != nil {
		return fmt.Errorf("publish Transmission daemon list: %w", err)
	}

	committed = true

	return nil
}
