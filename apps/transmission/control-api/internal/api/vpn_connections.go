package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/capacity"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/controller"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/provider"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/runtimeinfo"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

// fixedCapacityReader keeps non-Linux unit tests independent of Linux virtual files.
type fixedCapacityReader struct {
	snapshot capacity.Snapshot
}

func (reader fixedCapacityReader) Current() (capacity.Snapshot, error) {
	return reader.snapshot, nil
}

// vpnConfigurationInput is the shared connection candidate accepted by create/update.
type vpnConfigurationInput struct {
	ProviderID           string            `json:"providerId"`
	Tunnel               string            `json:"tunnel"`
	ProfileIDs           []string          `json:"profileIds"`
	EndpointStrategy     string            `json:"endpointStrategy"`
	Credentials          map[string]string `json:"credentials"`
	DNSServers           []string          `json:"dnsServers"`
	RetryIntervalSeconds int               `json:"retryIntervalSeconds"`
}

// vpnConnectionRuntimeResponse is the controller projection nested in a connection.
type vpnConnectionRuntimeResponse struct {
	State            string     `json:"state"`
	ProviderID       string     `json:"providerId"`
	Tunnel           string     `json:"tunnel"`
	ProfileID        string     `json:"profileId"`
	EndpointPosition int        `json:"endpointPosition"`
	EndpointCount    int        `json:"endpointCount"`
	EndpointStrategy string     `json:"endpointStrategy"`
	Interface        string     `json:"interface"`
	Implementation   string     `json:"implementation,omitempty"`
	RemoteHost       string     `json:"remoteHost"`
	RemotePort       int        `json:"remotePort"`
	Address          string     `json:"address"`
	LastHandshakeAt  *time.Time `json:"lastHandshakeAt,omitempty"`
	Attempt          int        `json:"attempt"`
	LastError        string     `json:"lastError"`
	TransitionedAt   time.Time  `json:"transitionedAt"`
}

// vpnConnectionDaemonResponse is the runner projection nested in a connection.
type vpnConnectionDaemonResponse struct {
	State       string `json:"state"`
	RPCPort     int    `json:"rpcPort"`
	BindAddress string `json:"bindAddress"`
	PeerPort    int    `json:"peerPort"`
}

// vpnConnectionResponse is the exact credential-free control API connection object.
type vpnConnectionResponse struct {
	ID                   string                       `json:"id"`
	Name                 string                       `json:"name"`
	Slot                 int                          `json:"slot"`
	Default              bool                         `json:"default"`
	Enabled              bool                         `json:"enabled"`
	ProviderID           string                       `json:"providerId"`
	Tunnel               string                       `json:"tunnel"`
	EndpointStrategy     string                       `json:"endpointStrategy"`
	ProfileIDs           []string                     `json:"profileIds"`
	DNSServers           []string                     `json:"dnsServers"`
	RetryIntervalSeconds int                          `json:"retryIntervalSeconds"`
	SavedCredentials     []string                     `json:"savedCredentials"`
	PeerPort             int                          `json:"peerPort"`
	Revision             int64                        `json:"revision"`
	CreatedAt            time.Time                    `json:"createdAt"`
	UpdatedAt            time.Time                    `json:"updatedAt"`
	Runtime              vpnConnectionRuntimeResponse `json:"runtime"`
	Daemon               vpnConnectionDaemonResponse  `json:"daemon"`
	TorrentCount         int                          `json:"torrentCount"`
	ChangeRunning        bool                         `json:"changeRunning"`
	NeedsSetup           bool                         `json:"needsSetup"`
}

// vpnDefaultMoveConnection identifies one side of a required Default-profile move.
type vpnDefaultMoveConnection struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// vpnDefaultMoveDetails describes the torrents and connections in a confirmation conflict.
type vpnDefaultMoveDetails struct {
	Torrents                 int                      `json:"torrents"`
	DefaultProfileTorrents   int                      `json:"defaultProfileTorrents"`
	FollowingProfileTorrents int                      `json:"followingProfileTorrents"`
	FromConnection           vpnDefaultMoveConnection `json:"fromConnection"`
	ToConnection             vpnDefaultMoveConnection `json:"toConnection"`
}

// handleListVPNConnections returns stored, controller, daemon, torrent, and capacity state.
func (server *Server) handleListVPNConnections(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	connections, err := server.readVPNConnectionViews(request.Context(), false)
	if err != nil {
		server.writeVPNConnectionReadError(responseWriter, err)

		return
	}
	snapshot, err := server.capacity.Current()
	if err != nil {
		server.logInternalError("read VPN connection capacity", err)
		writeError(responseWriter, http.StatusInternalServerError, "capacity_unavailable", "VPN connection capacity is unavailable.")

		return
	}
	snapshot.Used = len(connections)

	writeJSON(responseWriter, http.StatusOK, map[string]any{
		"connections":   connections,
		"capacity":      snapshot,
		"changeRunning": server.vpnCommands.running(),
	})
}

// handleCreateVPNConnection tests a new slot before committing its durable row.
func (server *Server) handleCreateVPNConnection(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	if server.controller == nil {
		writeError(responseWriter, http.StatusServiceUnavailable, "controller_unavailable", "The VPN controller is unavailable.")

		return
	}
	var input struct {
		Name     string `json:"name"`
		PeerPort *int   `json:"peerPort"`
		vpnConfigurationInput
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}
	if message := validateVPNConnectionName(input.Name); message != "" {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "name", message)

		return
	}
	if input.PeerPort != nil && !validVPNPeerPort(*input.PeerPort) {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "peerPort", "peerPort must be between 1024 and 65535.")

		return
	}
	input.vpnConfigurationInput.applyDefaults()

	release, claimed := server.vpnCommands.beginGlobal()
	if !claimed {
		writeVPNChangeRunning(responseWriter)

		return
	}
	releasePending := true
	defer func() {
		if releasePending {
			release()
		}
	}()
	ctx := context.WithoutCancel(request.Context())

	connections, err := server.store.ListVPNConnections(ctx)
	if err != nil {
		server.logInternalError("list VPN connections before create", err)
		writeError(responseWriter, http.StatusInternalServerError, "vpn_state_unavailable", "VPN configuration state is unavailable.")

		return
	}
	for _, connection := range connections {
		if strings.EqualFold(connection.Name, input.Name) {
			writeError(responseWriter, http.StatusConflict, "name_taken", "A VPN connection already uses that name.")

			return
		}
	}
	snapshot, err := server.capacity.Current()
	if err != nil {
		server.logInternalError("read VPN capacity before create", err)
		writeError(responseWriter, http.StatusInternalServerError, "capacity_unavailable", "VPN connection capacity is unavailable.")

		return
	}
	if len(connections) >= snapshot.Limit {
		writeErrorDetails(responseWriter, http.StatusConflict, "capacity_reached", "This container has reached its VPN connection capacity.", map[string]any{
			"limit": snapshot.Limit,
			"used":  len(connections),
		})

		return
	}

	slot := lowestFreeVPNSlot(connections)
	if slot < 0 {
		writeErrorDetails(responseWriter, http.StatusConflict, "capacity_reached", "This container has reached its VPN connection capacity.", map[string]any{
			"limit": snapshot.Limit,
			"used":  len(connections),
		})

		return
	}
	peerPort := lowestFreeVPNPeerPort(connections)
	if input.PeerPort != nil {
		peerPort = *input.PeerPort
	}
	connectionID, err := storage.NewVPNConnectionID()
	if err != nil {
		server.logInternalError("generate VPN connection identifier", err)
		writeInternalError(responseWriter)

		return
	}
	candidate, _, err := server.controllerConnectionFromInput(ctx, input.vpnConfigurationInput)
	if err != nil {
		server.writeVPNCandidateError(responseWriter, err, "credentials")

		return
	}
	defer clearConnectionProfiles(&candidate)

	status, err := server.controller.Connect(ctx, connectionID, slot, len(connections) == 0, candidate)
	if err != nil {
		_, _ = server.controller.Disconnect(context.Background(), connectionID)
		writeError(responseWriter, http.StatusBadGateway, "vpn_test_failed", publicVPNConnectionFailure(err, candidate.Endpoints))

		return
	}
	nonce, ciphertext, err := server.sealVPNConnectionCredentials(connectionID, input.Credentials)
	clear(input.Credentials)
	if err != nil {
		_, _ = server.controller.Disconnect(context.Background(), connectionID)
		server.logInternalError("seal VPN connection credentials", err)
		writeInternalError(responseWriter)

		return
	}
	stored, err := server.store.CreateVPNConnectionInSlot(ctx, storage.EncryptedVPNConnection{
		ID:                    connectionID,
		Name:                  input.Name,
		Enabled:               true,
		ProviderID:            input.ProviderID,
		Tunnel:                input.Tunnel,
		ProfileIDs:            append([]string{}, input.ProfileIDs...),
		EndpointStrategy:      input.EndpointStrategy,
		CredentialsNonce:      nonce,
		CredentialsCiphertext: ciphertext,
		DNSServers:            append([]string{}, input.DNSServers...),
		RetryIntervalSeconds:  input.RetryIntervalSeconds,
		PeerPort:              peerPort,
	}, slot)
	if err != nil {
		_, _ = server.controller.Disconnect(context.Background(), connectionID)
		server.writeVPNConnectionStoreError(responseWriter, err)

		return
	}
	if err := server.publishTransmissionConfiguration(ctx); err != nil {
		server.logInternalError("publish Transmission configuration after VPN create", err)
		writeError(responseWriter, http.StatusInternalServerError, "vpn_runtime_update_deferred", "The VPN connection was saved, but its Transmission daemon update could not be published.")

		return
	}
	release()
	releasePending = false
	view, err := server.vpnConnectionView(ctx, stored, status, 0)
	if err != nil {
		server.logInternalError("read created VPN connection runtime", err)
		writeInternalError(responseWriter)

		return
	}

	writeJSON(responseWriter, http.StatusCreated, map[string]any{"connection": view})
}

// handleGetVPNConnection returns one complete credential-free connection object.
func (server *Server) handleGetVPNConnection(responseWriter http.ResponseWriter, request *http.Request) {
	connection, err := server.findVPNConnectionView(request.Context(), request.PathValue("id"))
	if err != nil {
		server.writeVPNConnectionReadError(responseWriter, err)

		return
	}

	writeJSON(responseWriter, http.StatusOK, map[string]any{"connection": connection})
}

// handleUpdateVPNConnection edits metadata or tests and replaces one configuration.
func (server *Server) handleUpdateVPNConnection(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	if server.controller == nil {
		writeError(responseWriter, http.StatusServiceUnavailable, "controller_unavailable", "The VPN controller is unavailable.")

		return
	}
	var input struct {
		ExpectedRevision *int64                 `json:"expectedRevision"`
		Name             *string                `json:"name"`
		PeerPort         *int                   `json:"peerPort"`
		Configuration    *vpnConfigurationInput `json:"configuration"`
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}
	if input.ExpectedRevision == nil || *input.ExpectedRevision < 1 {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "expectedRevision", "expectedRevision must be a positive integer.")

		return
	}
	if input.Name == nil && input.PeerPort == nil && input.Configuration == nil {
		writeError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "Change at least one connection field.")

		return
	}
	if input.Name != nil {
		if message := validateVPNConnectionName(*input.Name); message != "" {
			writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "name", message)

			return
		}
	}
	if input.PeerPort != nil && !validVPNPeerPort(*input.PeerPort) {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "peerPort", "peerPort must be between 1024 and 65535.")

		return
	}
	if input.Configuration != nil {
		input.Configuration.applyDefaults()
	}

	connectionID := request.PathValue("id")
	release, claimed := server.vpnCommands.beginConnection(connectionID)
	if !claimed {
		writeVPNChangeRunning(responseWriter)

		return
	}
	releasePending := true
	defer func() {
		if releasePending {
			release()
		}
	}()
	ctx := context.WithoutCancel(request.Context())

	previous, err := server.store.VPNConnectionByID(ctx, connectionID)
	if errors.Is(err, storage.ErrNotFound) {
		writeVPNConnectionNotFound(responseWriter)

		return
	}
	if err != nil {
		server.logInternalError("read VPN connection before update", err)
		writeInternalError(responseWriter)

		return
	}
	if previous.Revision != *input.ExpectedRevision {
		server.writeVPNConnectionStoreError(responseWriter, storage.ErrRevisionConflict)

		return
	}
	if input.Name != nil && !strings.EqualFold(previous.Name, *input.Name) {
		connections, listError := server.store.ListVPNConnections(ctx)
		if listError != nil {
			server.logInternalError("list VPN connections before update", listError)
			writeInternalError(responseWriter)

			return
		}
		for _, connection := range connections {
			if connection.ID != connectionID && strings.EqualFold(connection.Name, *input.Name) {
				server.writeVPNConnectionStoreError(responseWriter, storage.ErrVPNConnectionNameTaken)

				return
			}
		}
	}
	updated := previous
	if input.Name != nil {
		updated.Name = *input.Name
	}
	if input.PeerPort != nil {
		updated.PeerPort = *input.PeerPort
	}
	status := controller.Status{}
	if input.Configuration != nil {
		if mergeError := server.mergeSavedVPNConnectionCredentials(
			previous,
			input.Configuration.ProviderID,
			input.Configuration.Tunnel,
			input.Configuration.Credentials,
		); mergeError != nil {
			server.logInternalError("decrypt saved VPN credentials before update", mergeError)
			writeInternalError(responseWriter)

			return
		}
		candidate, _, candidateError := server.controllerConnectionFromInput(ctx, *input.Configuration)
		if candidateError != nil {
			server.writeVPNCandidateError(responseWriter, candidateError, "configuration.credentials")

			return
		}
		defer clearConnectionProfiles(&candidate)
		nonce, ciphertext, sealError := server.sealVPNConnectionCredentials(connectionID, input.Configuration.Credentials)
		clear(input.Configuration.Credentials)
		if sealError != nil {
			server.logInternalError("seal updated VPN credentials", sealError)
			writeInternalError(responseWriter)

			return
		}
		status, err = server.controller.Connect(ctx, previous.ID, previous.Slot, previous.IsDefault, candidate)
		if err != nil {
			server.restorePreviousVPN(previous.ID, previous, nil)
			writeError(responseWriter, http.StatusBadGateway, "vpn_test_failed", publicVPNConnectionFailure(err, candidate.Endpoints))

			return
		}
		updated.Enabled = true
		updated.ProviderID = input.Configuration.ProviderID
		updated.Tunnel = input.Configuration.Tunnel
		updated.ProfileIDs = append([]string{}, input.Configuration.ProfileIDs...)
		updated.EndpointStrategy = input.Configuration.EndpointStrategy
		updated.CredentialsNonce = nonce
		updated.CredentialsCiphertext = ciphertext
		updated.DNSServers = append([]string{}, input.Configuration.DNSServers...)
		updated.RetryIntervalSeconds = input.Configuration.RetryIntervalSeconds
	}

	revision, err := server.store.UpdateVPNConnection(ctx, connectionID, *input.ExpectedRevision, updated)
	if err != nil {
		if input.Configuration != nil {
			server.restorePreviousVPN(previous.ID, previous, nil)
		}
		server.writeVPNConnectionStoreError(responseWriter, err)

		return
	}
	updated.Revision = revision
	if input.PeerPort != nil && previous.PeerPort != updated.PeerPort {
		if err := server.publishTransmissionConfiguration(ctx); err != nil {
			server.logInternalError("publish Transmission configuration after peer port update", err)
			writeError(responseWriter, http.StatusInternalServerError, "vpn_runtime_update_deferred", "The VPN connection was saved, but its Transmission daemon update could not be published.")

			return
		}
	}
	if input.Configuration == nil {
		statuses, statusError := server.controller.Status(ctx)
		if statusError != nil {
			server.logInternalError("read controller status after VPN update", statusError)
			writeError(responseWriter, http.StatusServiceUnavailable, "controller_unavailable", "The VPN controller is unavailable.")

			return
		}
		status, _ = controllerStatusForConnection(statuses, connectionID)
	}
	updated, err = server.store.VPNConnectionByID(ctx, connectionID)
	if err != nil {
		server.logInternalError("read stored VPN connection after update", err)
		writeInternalError(responseWriter)

		return
	}
	release()
	releasePending = false
	view, err := server.vpnConnectionView(ctx, updated, status, server.torrentCountForConnection(ctx, connectionID))
	if err != nil {
		server.logInternalError("read updated VPN connection runtime", err)
		writeInternalError(responseWriter)

		return
	}

	writeJSON(responseWriter, http.StatusOK, map[string]any{"connection": view})
}

// handleReconnectVPNConnection activates one connection's last-known-good configuration.
func (server *Server) handleReconnectVPNConnection(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	server.handleVPNConnectionCommand(responseWriter, request, true)
}

// handleDisconnectVPNConnection blocks only the selected connection.
func (server *Server) handleDisconnectVPNConnection(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	server.handleVPNConnectionCommand(responseWriter, request, false)
}

func (server *Server) handleVPNConnectionCommand(
	responseWriter http.ResponseWriter,
	request *http.Request,
	reconnect bool,
) {
	if server.controller == nil {
		writeError(responseWriter, http.StatusServiceUnavailable, "controller_unavailable", "The VPN controller is unavailable.")

		return
	}
	connectionID := request.PathValue("id")
	release, claimed := server.vpnCommands.beginConnection(connectionID)
	if !claimed {
		writeVPNChangeRunning(responseWriter)

		return
	}
	releasePending := true
	defer func() {
		if releasePending {
			release()
		}
	}()
	ctx := context.WithoutCancel(request.Context())
	connection, err := server.store.VPNConnectionByID(ctx, connectionID)
	if errors.Is(err, storage.ErrNotFound) {
		writeVPNConnectionNotFound(responseWriter)

		return
	}
	if err != nil {
		server.logInternalError("read VPN connection for command", err)
		writeInternalError(responseWriter)

		return
	}

	var status controller.Status
	if reconnect {
		if len(connection.ProfileIDs) == 0 || len(connection.CredentialsCiphertext) == 0 {
			writeError(responseWriter, http.StatusConflict, "vpn_not_configured", "Enter the VPN connection details again first.")

			return
		}
		status, err = server.connectStoredVPN(ctx, connection)
		if err == nil {
			err = server.store.SetVPNConnectionEnabled(ctx, connectionID, true)
			connection.Enabled = true
		}
	} else {
		err = server.store.SetVPNConnectionEnabled(ctx, connectionID, false)
		if err == nil {
			connection.Enabled = false
			status, err = server.controller.Disconnect(ctx, connectionID)
		}
	}
	if err != nil {
		code := "vpn_test_failed"
		statusCode := http.StatusBadGateway
		message := server.publicStoredVPNConnectionFailure(ctx, err, connection.ProfileIDs)
		if !reconnect {
			code = "vpn_disconnect_failed"
			statusCode = http.StatusServiceUnavailable
			message = err.Error()
		}
		writeError(responseWriter, statusCode, code, message)

		return
	}
	if err := server.publishTransmissionConfiguration(ctx); err != nil {
		server.logInternalError("publish Transmission configuration after VPN command", err)
		writeError(responseWriter, http.StatusInternalServerError, "vpn_runtime_update_deferred", "The VPN connection changed, but its Transmission daemon update could not be published.")

		return
	}
	connection, err = server.store.VPNConnectionByID(ctx, connectionID)
	if err != nil {
		server.logInternalError("read stored VPN connection after command", err)
		writeInternalError(responseWriter)

		return
	}
	release()
	releasePending = false
	view, err := server.vpnConnectionView(ctx, connection, status, server.torrentCountForConnection(ctx, connectionID))
	if err != nil {
		server.logInternalError("read VPN connection after command", err)
		writeInternalError(responseWriter)

		return
	}

	writeJSON(responseWriter, http.StatusOK, map[string]any{"connection": view})
}

// handleSetDefaultVPNConnection changes the default and moves Default-profile torrents.
//
// The global VPN mutation lock remains held through every attempted transfer so
// no connection mutation can overlap the daemon ownership change.
//
// Since: 2.0.0
func (server *Server) handleSetDefaultVPNConnection(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	if server.controller == nil {
		writeError(responseWriter, http.StatusServiceUnavailable, "controller_unavailable", "The VPN controller is unavailable.")

		return
	}
	var input struct {
		ConnectionID string `json:"connectionId"`
		MoveTorrents bool   `json:"moveTorrents"`
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}
	if input.ConnectionID == "" {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "connectionId", "connectionId must name an existing VPN connection.")

		return
	}
	release, claimed := server.vpnCommands.beginGlobal()
	if !claimed {
		writeVPNChangeRunning(responseWriter)

		return
	}
	releasePending := true
	defer func() {
		if releasePending {
			release()
		}
	}()
	ctx := context.WithoutCancel(request.Context())
	previous, err := server.store.DefaultVPNConnection(ctx)
	if err != nil {
		server.writeVPNConnectionReadError(responseWriter, err)

		return
	}
	target, err := server.store.VPNConnectionByID(ctx, input.ConnectionID)
	if errors.Is(err, storage.ErrNotFound) {
		writeVPNConnectionNotFound(responseWriter)

		return
	}
	if err != nil {
		server.writeVPNConnectionReadError(responseWriter, err)

		return
	}
	defaultTorrents, listError := server.torrentsFollowingDefaultConnection(ctx)
	if listError != nil {
		server.logInternalError("find Default torrent profile moves before changing default VPN connection", listError)
		writeError(
			responseWriter,
			http.StatusServiceUnavailable,
			"transmission_unavailable",
			"Every Transmission daemon must answer before changing the default VPN connection.",
		)

		return
	}
	torrentsToMove := make([]torrentMoveCandidate, 0, len(defaultTorrents))
	defaultProfileTorrents := 0
	followingProfileTorrents := 0
	for _, candidate := range defaultTorrents {
		if candidate.ConnectionID != target.ID {
			torrentsToMove = append(torrentsToMove, candidate)
			if _, assigned := server.torrentProfileAssignments.profileID(candidate.Hash); assigned {
				followingProfileTorrents++
			} else {
				defaultProfileTorrents++
			}
		}
	}
	if len(torrentsToMove) > 0 && !input.MoveTorrents {
		writeErrorDetails(
			responseWriter,
			http.StatusConflict,
			"torrents_must_move",
			"Torrents that follow the default VPN connection must move to the new default VPN connection.",
			vpnDefaultMoveDetails{
				Torrents:                 len(torrentsToMove),
				DefaultProfileTorrents:   defaultProfileTorrents,
				FollowingProfileTorrents: followingProfileTorrents,
				FromConnection: vpnDefaultMoveConnection{
					ID:   previous.ID,
					Name: previous.Name,
				},
				ToConnection: vpnDefaultMoveConnection{
					ID:   target.ID,
					Name: target.Name,
				},
			},
		)

		return
	}
	if err := server.store.SetDefaultVPNConnection(ctx, input.ConnectionID); errors.Is(err, storage.ErrNotFound) {
		writeVPNConnectionNotFound(responseWriter)

		return
	} else if err != nil {
		server.logInternalError("save default VPN connection", err)
		writeInternalError(responseWriter)

		return
	}
	if _, err := server.controller.SetDefault(ctx, input.ConnectionID); err != nil {
		_ = server.store.SetDefaultVPNConnection(context.Background(), previous.ID)
		writeError(responseWriter, http.StatusBadGateway, "vpn_default_failed", err.Error())

		return
	}
	moved := make([]torrentMoveResult, 0, len(torrentsToMove))
	for _, candidate := range torrentsToMove {
		result, _ := server.moveTorrent(
			ctx,
			candidate.Hash,
			candidate.ConnectionID,
			target.ID,
		)
		moved = append(moved, result)
	}
	transmissionError := server.publishTransmissionConfigurationAfterSave(ctx)
	server.webProxyMutex.Lock()
	webProxyError := server.publishWebProxyConfigAfterSave(ctx)
	server.webProxyMutex.Unlock()
	if transmissionError != nil {
		writeError(responseWriter, http.StatusInternalServerError, "vpn_runtime_update_deferred", "The default changed, but its Transmission daemon update could not be published.")

		return
	}
	if webProxyError != nil {
		writeWebProxyPublishDeferred(responseWriter)

		return
	}
	release()
	releasePending = false
	connections, err := server.readVPNConnectionViews(ctx, false)
	if err != nil {
		server.writeVPNConnectionReadError(responseWriter, err)

		return
	}

	writeJSON(responseWriter, http.StatusOK, map[string]any{
		"connections": connections,
		"moved":       moved,
	})
}

// handleDeleteVPNConnection removes an unused non-default connection.
func (server *Server) handleDeleteVPNConnection(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	if server.controller == nil {
		writeError(responseWriter, http.StatusServiceUnavailable, "controller_unavailable", "The VPN controller is unavailable.")

		return
	}
	var input struct {
		MoveTo *string `json:"moveTo"`
	}
	if request.ContentLength != 0 {
		if err := decodeJSONBody(responseWriter, request, &input); err != nil {
			writeDecodeError(responseWriter, err)

			return
		}
	}
	connectionID := request.PathValue("id")
	release, claimed := server.vpnCommands.beginGlobal()
	if !claimed {
		writeVPNChangeRunning(responseWriter)

		return
	}
	releasePending := true
	defer func() {
		if releasePending {
			release()
		}
	}()
	ctx := context.WithoutCancel(request.Context())
	connection, err := server.store.VPNConnectionByID(ctx, connectionID)
	if errors.Is(err, storage.ErrNotFound) {
		writeVPNConnectionNotFound(responseWriter)

		return
	}
	if err != nil {
		server.logInternalError("read VPN connection before delete", err)
		writeInternalError(responseWriter)

		return
	}
	if connection.IsDefault {
		writeError(responseWriter, http.StatusConflict, "default_connection", "Change the default VPN connection before deleting this one.")

		return
	}
	var target storage.EncryptedVPNConnection
	if input.MoveTo != nil {
		if *input.MoveTo == "" || *input.MoveTo == connectionID {
			writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "moveTo", "moveTo must name a different existing VPN connection.")

			return
		}
		target, err = server.store.VPNConnectionByID(ctx, *input.MoveTo)
		if errors.Is(err, storage.ErrNotFound) {
			writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "moveTo", "moveTo must name a different existing VPN connection.")

			return
		}
		if err != nil {
			server.logInternalError("read target VPN connection before delete", err)
			writeInternalError(responseWriter)

			return
		}
	}
	removalTargetID := ""
	if input.MoveTo != nil {
		removalTargetID = target.ID
	}
	server.markVPNConnectionRemoving(connectionID, removalTargetID)
	defer server.unmarkVPNConnectionRemoving(connectionID)

	usage, err := server.vpnConnectionUsage(ctx, connectionID)
	if err != nil {
		if errors.Is(err, errTransmissionDaemonUnavailable) {
			writeError(
				responseWriter,
				http.StatusConflict,
				"daemon_unavailable",
				"Transmission for "+connection.Name+" must answer before this VPN connection can be deleted.",
			)

			return
		}
		server.logInternalError("inspect VPN connection usage", err)
		writeError(responseWriter, http.StatusServiceUnavailable, "vpn_state_unavailable", "The VPN connection's current usage could not be verified.")

		return
	}
	if input.MoveTo == nil && (usage.Torrents > 0 || len(usage.Profiles) > 0 || len(usage.Logins) > 0) {
		writeErrorDetails(responseWriter, http.StatusConflict, "connection_in_use", "Move everything that uses this VPN connection before deleting it.", usage)

		return
	}

	moved := []torrentMoveResult{}
	profileCount := 0
	loginCount := 0
	if input.MoveTo != nil {
		if _, targetError := server.torrentsOnConnection(ctx, target.ID); targetError != nil {
			if errors.Is(targetError, errTransmissionDaemonUnavailable) {
				writeError(
					responseWriter,
					http.StatusConflict,
					"daemon_unavailable",
					"Transmission for "+target.Name+" must answer before torrents can be moved to it.",
				)

				return
			}
			server.logInternalError("verify target Transmission daemon before VPN connection move", targetError)
			writeInternalError(responseWriter)

			return
		}
		var storedTargetID *string
		if !target.IsDefault {
			storedTargetID = &target.ID
		}
		profileCount, loginCount, err = server.store.ReassignVPNConnectionDependents(
			ctx,
			connectionID,
			storedTargetID,
		)
		if err != nil {
			server.logInternalError("reassign VPN connection dependents", err)
			writeInternalError(responseWriter)

			return
		}

		for {
			candidates, candidateError := server.torrentsOnConnection(ctx, connectionID)
			if candidateError != nil {
				if errors.Is(candidateError, errTransmissionDaemonUnavailable) {
					writeError(
						responseWriter,
						http.StatusConflict,
						"daemon_unavailable",
						"Transmission for "+connection.Name+" must answer before this VPN connection can be deleted.",
					)

					return
				}
				server.logInternalError("list torrents during VPN connection move", candidateError)
				writeError(responseWriter, http.StatusServiceUnavailable, "vpn_state_unavailable", "The VPN connection's torrents could not be verified while moving them.")

				return
			}
			if len(candidates) == 0 {
				break
			}
			for _, candidate := range candidates {
				result, moveError := server.moveTorrent(
					ctx,
					candidate.Hash,
					connectionID,
					target.ID,
				)
				moved = append(moved, result)
				if moveError != nil {
					writeErrorDetails(
						responseWriter,
						http.StatusConflict,
						"move_failed",
						"A torrent could not be moved, so the VPN connection was kept.",
						map[string]any{"moved": moved},
					)

					return
				}
			}
		}
	} else {
		usage, err = server.vpnConnectionUsage(ctx, connectionID)
		if err != nil {
			server.logInternalError("recheck VPN connection usage before delete", err)
			writeError(responseWriter, http.StatusServiceUnavailable, "vpn_state_unavailable", "The VPN connection's current usage could not be verified.")

			return
		}
		if usage.Torrents > 0 || len(usage.Profiles) > 0 || len(usage.Logins) > 0 {
			writeErrorDetails(responseWriter, http.StatusConflict, "connection_in_use", "Move everything that uses this VPN connection before deleting it.", usage)

			return
		}
	}
	if _, err := server.controller.Disconnect(ctx, connectionID); err != nil {
		writeError(responseWriter, http.StatusServiceUnavailable, "vpn_disconnect_failed", err.Error())

		return
	}
	if input.MoveTo != nil {
		var storedTargetID *string
		if !target.IsDefault {
			storedTargetID = &target.ID
		}
		lateProfileCount, lateLoginCount, deleteError := server.store.DeleteVPNConnectionAndReassignDependents(
			ctx,
			connectionID,
			storedTargetID,
		)
		if deleteError != nil {
			server.writeVPNConnectionStoreError(responseWriter, deleteError)

			return
		}
		profileCount += lateProfileCount
		loginCount += lateLoginCount
	} else if err := server.store.DeleteVPNConnection(ctx, connectionID); err != nil {
		server.writeVPNConnectionStoreError(responseWriter, err)

		return
	}
	transmissionError := server.publishTransmissionConfigurationAfterSave(ctx)
	server.webProxyMutex.Lock()
	webProxyError := server.publishWebProxyConfigAfterSave(ctx)
	server.webProxyMutex.Unlock()
	if transmissionError != nil {
		writeError(responseWriter, http.StatusInternalServerError, "vpn_runtime_update_deferred", "The VPN connection was deleted, but its daemon update could not be published.")

		return
	}
	if webProxyError != nil {
		writeWebProxyPublishDeferred(responseWriter)

		return
	}
	release()
	releasePending = false

	writeJSON(responseWriter, http.StatusOK, map[string]any{
		"moved":    moved,
		"profiles": profileCount,
		"logins":   loginCount,
	})
}

type vpnConnectionUsage struct {
	Torrents int                         `json:"torrents"`
	Profiles []vpnConnectionProfileUsage `json:"profiles"`
	Logins   []vpnConnectionLoginUsage   `json:"logins"`
}

type vpnConnectionProfileUsage struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type vpnConnectionLoginUsage struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}

func (server *Server) vpnConnectionUsage(ctx context.Context, connectionID string) (vpnConnectionUsage, error) {
	usage := vpnConnectionUsage{
		Profiles: []vpnConnectionProfileUsage{},
		Logins:   []vpnConnectionLoginUsage{},
	}
	torrents, err := server.torrentsOnConnection(ctx, connectionID)
	if err != nil {
		return usage, err
	}
	usage.Torrents = len(torrents)
	profiles, err := server.store.ListTorrentProfiles(ctx)
	if err != nil {
		return usage, err
	}
	for _, profile := range profiles {
		if profile.ConnectionID != nil && *profile.ConnectionID == connectionID {
			usage.Profiles = append(usage.Profiles, vpnConnectionProfileUsage{ID: profile.ID, Name: profile.Name})
		}
	}
	_, logins, err := server.store.WebProxyConfiguration(ctx)
	if err != nil {
		return usage, err
	}
	for _, login := range logins {
		if login.ConnectionID != nil && *login.ConnectionID == connectionID {
			usage.Logins = append(usage.Logins, vpnConnectionLoginUsage{ID: login.ID, Username: login.Username})
		}
	}

	return usage, nil
}

func (server *Server) readVPNConnectionViews(
	ctx context.Context,
	strictTorrents bool,
) ([]vpnConnectionResponse, error) {
	if server.controller == nil {
		return nil, errors.New("VPN controller is unavailable")
	}
	connections, err := server.store.ListVPNConnections(ctx)
	if err != nil {
		return nil, err
	}
	statuses, err := server.controller.Status(ctx)
	if err != nil {
		return nil, err
	}
	counts := make(map[string]int, len(connections))
	if len(connections) > 0 {
		result := server.mergedTorrents(ctx, []string{"id", "hashString", "name"}, nil)
		if strictTorrents && !result.Complete {
			return nil, errors.New("one or more Transmission daemons did not answer")
		}
		for _, torrent := range result.Torrents {
			connectionID, _ := torrent["connectionId"].(string)
			counts[connectionID]++
		}
	}

	views := make([]vpnConnectionResponse, 0, len(connections))
	for _, connection := range connections {
		status, _ := controllerStatusForConnection(statuses, connection.ID)
		view, viewError := server.vpnConnectionView(ctx, connection, status, counts[connection.ID])
		if viewError != nil {
			return nil, viewError
		}
		views = append(views, view)
	}

	return views, nil
}

func (server *Server) findVPNConnectionView(
	ctx context.Context,
	connectionID string,
) (vpnConnectionResponse, error) {
	connection, err := server.store.VPNConnectionByID(ctx, connectionID)
	if err != nil {
		return vpnConnectionResponse{}, err
	}
	if server.controller == nil {
		return vpnConnectionResponse{}, errors.New("VPN controller is unavailable")
	}
	statuses, err := server.controller.Status(ctx)
	if err != nil {
		return vpnConnectionResponse{}, err
	}
	status, _ := controllerStatusForConnection(statuses, connectionID)

	return server.vpnConnectionView(ctx, connection, status, server.torrentCountForConnection(ctx, connectionID))
}

func (server *Server) vpnConnectionView(
	_ context.Context,
	connection storage.EncryptedVPNConnection,
	status controller.Status,
	torrentCount int,
) (vpnConnectionResponse, error) {
	if status.State == "" {
		status.State = "blocked"
	}
	daemon, err := runtimeinfo.ReadTransmissionDaemonState(server.runtimeDirectory, connection.ID)
	if err != nil {
		return vpnConnectionResponse{}, err
	}
	if daemon.State == "missing" {
		daemon.RPCPort = 9092 + connection.Slot
		daemon.BindAddress = "127.0.0.1"
		daemon.PeerPort = connection.PeerPort
	}
	savedCredentials, err := server.savedVPNConnectionCredentialKeys(connection)
	if err != nil {
		return vpnConnectionResponse{}, err
	}

	return vpnConnectionResponse{
		ID:                   connection.ID,
		Name:                 connection.Name,
		Slot:                 connection.Slot,
		Default:              connection.IsDefault,
		Enabled:              connection.Enabled,
		ProviderID:           connection.ProviderID,
		Tunnel:               connection.Tunnel,
		EndpointStrategy:     connection.EndpointStrategy,
		ProfileIDs:           append([]string{}, connection.ProfileIDs...),
		DNSServers:           append([]string{}, connection.DNSServers...),
		RetryIntervalSeconds: connection.RetryIntervalSeconds,
		SavedCredentials:     savedCredentials,
		PeerPort:             connection.PeerPort,
		Revision:             connection.Revision,
		CreatedAt:            connection.CreatedAt,
		UpdatedAt:            connection.UpdatedAt,
		Runtime: vpnConnectionRuntimeResponse{
			State:            status.State,
			ProviderID:       status.ProviderID,
			Tunnel:           status.Tunnel,
			ProfileID:        status.ProfileID,
			EndpointPosition: status.EndpointPosition,
			EndpointCount:    status.EndpointCount,
			EndpointStrategy: status.EndpointStrategy,
			Interface:        status.Interface,
			Implementation:   status.Implementation,
			RemoteHost:       status.RemoteHost,
			RemotePort:       status.RemotePort,
			Address:          status.Address,
			LastHandshakeAt:  status.LastHandshakeAt,
			Attempt:          status.Attempt,
			LastError:        status.LastError,
			TransitionedAt:   status.TransitionedAt,
		},
		Daemon: vpnConnectionDaemonResponse{
			State:       daemon.State,
			RPCPort:     daemon.RPCPort,
			BindAddress: daemon.BindAddress,
			PeerPort:    daemon.PeerPort,
		},
		TorrentCount:  torrentCount,
		ChangeRunning: server.vpnCommands.connectionRunning(connection.ID),
		NeedsSetup: len(connection.ProfileIDs) == 0 || len(connection.CredentialsNonce) == 0 ||
			len(connection.CredentialsCiphertext) == 0,
	}, nil
}

func (server *Server) torrentCountForConnection(ctx context.Context, connectionID string) int {
	result := server.mergedTorrents(ctx, []string{"id", "hashString", "name"}, nil)
	count := 0
	for _, torrent := range result.Torrents {
		if torrentConnectionID, _ := torrent["connectionId"].(string); torrentConnectionID == connectionID {
			count++
		}
	}

	return count
}

func (input *vpnConfigurationInput) applyDefaults() {
	if input.EndpointStrategy == "" {
		input.EndpointStrategy = "sticky"
	}
	if input.RetryIntervalSeconds == 0 {
		input.RetryIntervalSeconds = 10
	}
	if input.Credentials == nil {
		input.Credentials = map[string]string{}
	}
	if input.DNSServers == nil {
		input.DNSServers = []string{}
	}
}

func (server *Server) controllerConnectionFromInput(
	ctx context.Context,
	input vpnConfigurationInput,
) (controller.Connection, []storage.StoredVPNProfile, error) {
	return server.connectionFromInput(
		ctx,
		input.ProviderID,
		input.Tunnel,
		input.ProfileIDs,
		input.EndpointStrategy,
		input.Credentials,
		input.DNSServers,
		input.RetryIntervalSeconds,
	)
}

func (server *Server) sealVPNConnectionCredentials(
	connectionID string,
	credentials map[string]string,
) ([]byte, []byte, error) {
	content, err := json.Marshal(credentials)
	if err != nil {
		return nil, nil, err
	}
	defer clear(content)

	return security.EncryptSecret(server.installationKey, "vpn/connection/"+connectionID, content)
}

func (server *Server) writeVPNCandidateError(
	responseWriter http.ResponseWriter,
	err error,
	credentialPrefix string,
) {
	if errors.Is(err, storage.ErrNotFound) {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "profileIds", "One or more VPN profiles no longer exist.")

		return
	}
	if writeVPNCredentialIssue(responseWriter, credentialPrefix, err) {
		return
	}
	writeError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", err.Error())
}

// writeVPNCredentialIssue attaches a provider validation message to its input field.
//
// The typed error exposes only a known field key and safe message, never the submitted
// credential value.
//
// Since: 2.0.0
func writeVPNCredentialIssue(
	responseWriter http.ResponseWriter,
	credentialPrefix string,
	err error,
) bool {
	credentialField, found := provider.CredentialErrorField(err)
	if !found {
		return false
	}
	field := credentialPrefix + "." + credentialField
	writeIssues(responseWriter, []validationIssue{
		{
			Field:   field,
			Path:    strings.Split(field, "."),
			Message: err.Error(),
		},
	})

	return true
}

func (server *Server) writeVPNConnectionStoreError(responseWriter http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, storage.ErrNotFound):
		writeVPNConnectionNotFound(responseWriter)
	case errors.Is(err, storage.ErrRevisionConflict):
		writeError(responseWriter, http.StatusConflict, "revision_conflict", "The VPN connection changed. Reload it and try again.")
	case errors.Is(err, storage.ErrVPNConnectionNameTaken):
		writeError(responseWriter, http.StatusConflict, "name_taken", "A VPN connection already uses that name.")
	case errors.Is(err, storage.ErrDefaultVPNConnection):
		writeError(responseWriter, http.StatusConflict, "default_connection", "Change the default VPN connection before deleting this one.")
	case errors.Is(err, storage.ErrVPNConnectionLimit):
		writeError(responseWriter, http.StatusConflict, "capacity_reached", "This container has reached its VPN connection capacity.")
	default:
		server.logInternalError("save VPN connection", err)
		writeInternalError(responseWriter)
	}
}

func (server *Server) writeVPNConnectionReadError(responseWriter http.ResponseWriter, err error) {
	if errors.Is(err, storage.ErrNotFound) {
		writeVPNConnectionNotFound(responseWriter)

		return
	}
	server.logInternalError("read VPN connections", err)
	writeError(responseWriter, http.StatusServiceUnavailable, "vpn_state_unavailable", "VPN connection state is unavailable.")
}

func writeVPNConnectionNotFound(responseWriter http.ResponseWriter) {
	writeError(responseWriter, http.StatusNotFound, "connection_not_found", "That VPN connection no longer exists.")
}

func writeVPNChangeRunning(responseWriter http.ResponseWriter) {
	writeError(responseWriter, http.StatusConflict, "change_running", "Another change for this VPN connection is still running.")
}

func validateVPNConnectionName(name string) string {
	if strings.TrimSpace(name) != name || utf8.RuneCountInString(name) < 1 || utf8.RuneCountInString(name) > 64 {
		return "name must contain between 1 and 64 trimmed characters."
	}

	return ""
}

func validVPNPeerPort(peerPort int) bool {
	return peerPort >= 1024 && peerPort <= 65535
}

func lowestFreeVPNSlot(connections []storage.EncryptedVPNConnection) int {
	occupied := make(map[int]struct{}, len(connections))
	for _, connection := range connections {
		occupied[connection.Slot] = struct{}{}
	}
	for slot := 0; slot < 64; slot++ {
		if _, found := occupied[slot]; !found {
			return slot
		}
	}

	return -1
}

func lowestFreeVPNPeerPort(connections []storage.EncryptedVPNConnection) int {
	occupied := make(map[int]struct{}, len(connections))
	for _, connection := range connections {
		occupied[connection.PeerPort] = struct{}{}
	}
	for peerPort := storage.DefaultVPNPeerPort; peerPort <= 65535; peerPort++ {
		if _, found := occupied[peerPort]; !found {
			return peerPort
		}
	}

	return storage.DefaultVPNPeerPort
}

func writeErrorDetails(
	responseWriter http.ResponseWriter,
	statusCode int,
	code string,
	message string,
	details any,
) {
	writeJSON(responseWriter, statusCode, errorEnvelope{Error: errorBody{
		Code: code, Message: message, Details: details,
	}})
}
