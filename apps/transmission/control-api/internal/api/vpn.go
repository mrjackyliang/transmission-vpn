package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"maps"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strings"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/controller"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/provider"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

// catalogLookupAttempts is how many times one catalog source is tried when its host
// lookup fails.
//
// Container DNS can drop out for a few seconds, and the provider hosts are fixed and
// known to exist, so a failed lookup is worth repeating before a refresh gives up.
const catalogLookupAttempts = 3

// catalogLookupRetryDelay is the pause before the first repeated lookup; each later
// pause doubles.
//
// Tests set it to zero so retries run without waiting.
var catalogLookupRetryDelay = time.Second

// tunnelView combines one tunnel's capabilities with its optional catalog state.
//
// The UI renders setup choices and freshness without hard-coding provider
// branches or making a separate request for each catalog.
type tunnelView struct {
	provider.TunnelDefinition
	Catalog *storage.VPNCatalogStatus `json:"catalog,omitempty"`
}

// providerView lists a provider's tunnels, each with its own catalog state.
//
// The outer Tunnels field replaces the embedded definition's list in JSON.
type providerView struct {
	provider.Definition
	Tunnels []tunnelView `json:"tunnels"`
}

// customVPNProfileUploadResponse preserves the first-profile fields for older clients
// while exposing the complete ordered endpoint pool to the current console.
type customVPNProfileUploadResponse struct {
	storage.VPNProfileMetadata
	Profiles []storage.VPNProfileMetadata `json:"profiles"`
}

// handleVPNProviders returns supported data-oriented adapter definitions.
//
// Credential values are never included; definitions describe only required fields and
// capabilities.
func (server *Server) handleVPNProviders(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	definitions := provider.Definitions()
	providers := make([]providerView, 0, len(definitions))
	for _, definition := range definitions {
		view := providerView{
			Definition: definition,
			Tunnels:    make([]tunnelView, 0, len(definition.Tunnels)),
		}
		for _, tunnel := range definition.Tunnels {
			tunnelState := tunnelView{TunnelDefinition: tunnel}
			catalogStatus, err := server.store.VPNCatalogStatusFor(
				request.Context(),
				definition.ID,
				tunnel.ID,
			)
			if err == nil {
				tunnelState.Catalog = &catalogStatus
			} else if !errors.Is(err, storage.ErrNotFound) {
				server.logInternalError("read VPN provider catalog status", err)
				writeError(responseWriter, http.StatusInternalServerError, "providers_unavailable", "VPN providers are unavailable.")

				return
			}
			view.Tunnels = append(view.Tunnels, tunnelState)
		}

		providers = append(providers, view)
	}

	writeJSON(responseWriter, http.StatusOK, map[string]any{"items": providers})
}

// handleVPNProfiles lists current safe endpoint metadata for one provider.
//
// An optional tunnel narrows the list. Profile configuration and embedded key material
// remain encrypted and are loaded only for an explicit connection candidate.
func (server *Server) handleVPNProfiles(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	providerID := request.URL.Query().Get("provider")
	definition, found := provider.DefinitionByID(providerID)
	if !found {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "provider", "The VPN provider is unsupported.")

		return
	}
	tunnelID := request.URL.Query().Get("tunnel")
	if _, found := definition.Tunnel(tunnelID); tunnelID != "" && !found {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "tunnel", "The VPN provider does not offer this tunnel.")

		return
	}

	profiles, err := server.store.ListVPNProfiles(request.Context(), providerID, tunnelID)
	if err != nil {
		server.logInternalError("list VPN profiles", err)
		writeError(responseWriter, http.StatusInternalServerError, "profiles_unavailable", "VPN profiles are unavailable.")

		return
	}

	writeJSON(responseWriter, http.StatusOK, map[string]any{"items": profiles})
}

// handleCustomVPNProfile validates, normalizes, encrypts, and stores one upload.
//
// The request is treated strictly as profile data and cannot add executable hooks,
// proxies, arbitrary paths, or protection-weakening routes. The tunnel picks the
// format; an omitted tunnel means OpenVPN.
func (server *Server) handleCustomVPNProfile(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	var input struct {
		Tunnel      string `json:"tunnel"`
		ProfileName string `json:"profileName"`
		Profile     string `json:"profile"`
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}
	if input.Tunnel == "" {
		input.Tunnel = provider.TunnelOpenVPN
	}

	profiles, err := normalizeCustomProfiles(
		input.Tunnel,
		strings.TrimSpace(input.ProfileName),
		[]byte(input.Profile),
	)
	switch {
	case errors.Is(err, errUnsupportedTunnel):
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "tunnel", "Custom profiles use the OpenVPN or WireGuard tunnel.")

		return
	case errors.Is(err, errWireGuardFileAsOpenVPN):
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "profile", "This is a WireGuard file. Choose the WireGuard tunnel to upload it.")

		return
	case errors.Is(err, errOpenVPNFileAsWireGuard):
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "profile", "This is not a WireGuard file because it has no [Interface] section. For an OpenVPN profile, choose the OpenVPN tunnel.")

		return
	case err != nil:
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "profile", err.Error())

		return
	}

	defer func() {
		for index := range profiles {
			clear(profiles[index].Configuration)
		}
	}()
	encryptedProfiles := make([]storage.EncryptedVPNProfile, 0, len(profiles))
	for _, profile := range profiles {
		encryptedProfile, encryptionError := server.encryptVPNProfile(profile, "upload")
		if encryptionError != nil {
			server.logInternalError("encrypt custom VPN profile", encryptionError)
			writeError(responseWriter, http.StatusInternalServerError, "profile_failed", "The VPN profile could not be stored.")

			return
		}
		encryptedProfiles = append(encryptedProfiles, encryptedProfile)
	}

	if err := server.store.UpsertCustomVPNProfiles(request.Context(), encryptedProfiles); err != nil {
		server.logInternalError("store custom VPN profile", err)
		writeError(responseWriter, http.StatusInternalServerError, "profile_failed", "The VPN profile could not be stored.")

		return
	}

	storedProfiles := make([]storage.VPNProfileMetadata, 0, len(encryptedProfiles))
	for _, encryptedProfile := range encryptedProfiles {
		storedProfile, readError := server.store.FindVPNProfile(request.Context(), encryptedProfile.ID)
		if readError != nil {
			server.logInternalError("read stored custom VPN profile", readError)
			writeError(responseWriter, http.StatusInternalServerError, "profile_failed", "The stored VPN profile is unavailable.")

			return
		}
		storedProfiles = append(storedProfiles, storedProfile.VPNProfileMetadata)
	}

	writeJSON(responseWriter, http.StatusCreated, customVPNProfileUploadResponse{
		VPNProfileMetadata: storedProfiles[0],
		Profiles:           storedProfiles,
	})
}

// handleRefreshVPNCatalog downloads and atomically publishes one tunnel's official catalog.
//
// The fixed HTTPS source, redirect policy, download bound, archive or list checks,
// profile normalization, and encryption all complete before the prior catalog of the
// same tunnel is retired; the provider's other tunnel is untouched.
func (server *Server) handleRefreshVPNCatalog(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	providerID := request.PathValue("providerID")
	tunnelID := request.PathValue("tunnel")
	catalogDefinition, found := provider.CatalogDefinitionFor(providerID, tunnelID)
	if !found {
		writeError(responseWriter, http.StatusNotFound, "catalog_unavailable", "This VPN provider does not expose a refreshable catalog for this tunnel.")

		return
	}

	downloadContext, cancelDownload := context.WithTimeout(request.Context(), catalogDefinition.RefreshDeadline())
	defer cancelDownload()

	sourceContents := make([][]byte, 0, len(catalogDefinition.Sources))
	for _, source := range catalogDefinition.Sources {
		content, err := server.downloadCatalogSourceWithRetries(downloadContext, source)
		if err != nil {
			for _, downloadedContent := range sourceContents {
				clear(downloadedContent)
			}
			server.logInternalError("download VPN provider catalog", err)
			writeCatalogDownloadError(responseWriter, source.URL, err)

			return
		}
		sourceContents = append(sourceContents, content)
	}

	profiles, err := provider.ParseCatalog(providerID, tunnelID, sourceContents)
	for _, content := range sourceContents {
		clear(content)
	}
	if err != nil {
		server.logInternalError("validate VPN provider catalog", err)
		writeError(responseWriter, http.StatusBadGateway, "catalog_invalid", "The downloaded VPN provider catalog did not pass validation.")

		return
	}

	encryptedProfiles := make([]storage.EncryptedVPNProfile, 0, len(profiles))
	for index := range profiles {
		encryptedProfile, encryptionError := server.encryptVPNProfile(
			profiles[index],
			"official-catalog",
		)
		clear(profiles[index].Configuration)
		if encryptionError != nil {
			server.logInternalError("encrypt VPN provider profile", encryptionError)
			writeError(responseWriter, http.StatusInternalServerError, "catalog_failed", "The VPN provider catalog could not be stored.")

			return
		}
		encryptedProfiles = append(encryptedProfiles, encryptedProfile)
	}

	if err := server.store.ReplaceVPNCatalog(
		request.Context(),
		providerID,
		tunnelID,
		catalogDefinition.Sources[0].URL,
		encryptedProfiles,
	); err != nil {
		server.logInternalError("store VPN provider catalog", err)
		writeError(responseWriter, http.StatusInternalServerError, "catalog_failed", "The VPN provider catalog could not be stored.")

		return
	}

	catalogStatus, err := server.store.VPNCatalogStatusFor(
		request.Context(),
		providerID,
		tunnelID,
	)
	if err != nil {
		server.logInternalError("read refreshed VPN provider catalog", err)
		writeError(responseWriter, http.StatusInternalServerError, "catalog_failed", "The refreshed VPN provider catalog is unavailable.")

		return
	}

	writeJSON(responseWriter, http.StatusOK, catalogStatus)
}

// handleVPNStatus reads normalized state through the restricted controller command.
//
// A missing controller is reported as unavailable without changing the independent
// fail-closed firewall state.
func (server *Server) handleVPNStatus(responseWriter http.ResponseWriter, request *http.Request) {
	if server.controller == nil {
		writeError(responseWriter, http.StatusServiceUnavailable, "controller_unavailable", "The VPN controller is unavailable.")

		return
	}

	statuses, err := server.controller.Status(request.Context())
	if err != nil {
		server.logInternalError("read VPN controller status", err)
		writeError(responseWriter, http.StatusServiceUnavailable, "controller_unavailable", "The VPN controller is unavailable.")

		return
	}

	response := map[string]any{
		"runtime":       defaultControllerStatus(statuses),
		"changeRunning": server.vpnCommands.running(),
	}
	activeConfiguration, configurationError := server.store.DefaultVPNConnection(request.Context())
	if configurationError == nil {
		primaryProfileID := ""
		if len(activeConfiguration.ProfileIDs) > 0 {
			primaryProfileID = activeConfiguration.ProfileIDs[0]
		}
		response["configuration"] = map[string]any{
			"connectionId":     activeConfiguration.ID,
			"name":             activeConfiguration.Name,
			"slot":             activeConfiguration.Slot,
			"enabled":          activeConfiguration.Enabled,
			"providerId":       activeConfiguration.ProviderID,
			"tunnel":           activeConfiguration.Tunnel,
			"profileId":        primaryProfileID,
			"profileIds":       activeConfiguration.ProfileIDs,
			"endpointStrategy": activeConfiguration.EndpointStrategy,
			"dnsServers":       activeConfiguration.DNSServers,
			"retrySeconds":     activeConfiguration.RetryIntervalSeconds,
			"peerPort":         activeConfiguration.PeerPort,
			"revision":         activeConfiguration.Revision,
			"updatedAt":        activeConfiguration.UpdatedAt,
		}
	} else if !errors.Is(configurationError, storage.ErrNotFound) {
		server.logInternalError("read active VPN configuration", configurationError)
		writeError(responseWriter, http.StatusInternalServerError, "vpn_state_unavailable", "VPN configuration state is unavailable.")

		return
	}

	writeJSON(responseWriter, http.StatusOK, response)
}

// handleVPNConnect stages, verifies, and atomically commits one tunnel candidate.
//
// A failed candidate or connection revision conflict restores the prior verified configuration;
// Transmission stays blocked throughout every transition. This compatibility alias
// claims the default connection (or the global creation gate when none exists) and
// runs to its commit or rollback even when the browser leaves.
func (server *Server) handleVPNConnect(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	if server.controller == nil {
		writeError(responseWriter, http.StatusServiceUnavailable, "controller_unavailable", "The VPN controller is unavailable.")

		return
	}

	var input struct {
		ExpectedRevision     *int64            `json:"expectedRevision"`
		ProviderID           string            `json:"providerId"`
		Tunnel               string            `json:"tunnel"`
		ProfileID            string            `json:"profileId"`
		ProfileIDs           []string          `json:"profileIds"`
		EndpointStrategy     string            `json:"endpointStrategy"`
		Credentials          map[string]string `json:"credentials"`
		DNSServers           []string          `json:"dnsServers"`
		RetryIntervalSeconds int               `json:"retryIntervalSeconds"`
		PeerPort             *int              `json:"peerPort"`
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}

	if input.ExpectedRevision == nil || *input.ExpectedRevision < 0 {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "expectedRevision", "expectedRevision must be a non-negative integer.")

		return
	}
	if input.PeerPort != nil && (*input.PeerPort < 1024 || *input.PeerPort > 65535) {
		writeFieldError(responseWriter, http.StatusUnprocessableEntity, "invalid_request", "peerPort", "peerPort must be between 1024 and 65535.")

		return
	}
	if input.RetryIntervalSeconds == 0 {
		input.RetryIntervalSeconds = 10
	}
	if len(input.ProfileIDs) == 0 && input.ProfileID != "" {
		input.ProfileIDs = []string{input.ProfileID}
	}
	if input.EndpointStrategy == "" {
		input.EndpointStrategy = "sticky"
	}
	if input.DNSServers == nil {
		input.DNSServers = []string{}
	}

	ctx := context.WithoutCancel(request.Context())
	previousConfiguration, previousError := server.store.DefaultVPNConnection(ctx)
	if previousError != nil && !errors.Is(previousError, storage.ErrNotFound) {
		server.logInternalError("read prior VPN configuration", previousError)
		writeError(responseWriter, http.StatusInternalServerError, "vpn_state_unavailable", "The prior VPN configuration is unavailable.")

		return
	}

	var release func()
	var claimed bool
	if errors.Is(previousError, storage.ErrNotFound) {
		release, claimed = server.vpnCommands.beginGlobal()
	} else {
		release, claimed = server.vpnCommands.beginConnection(previousConfiguration.ID)
	}
	if !claimed {
		writeError(responseWriter, http.StatusConflict, "vpn_change_running", "Another VPN change is still running. Try again when it finishes.")

		return
	}
	defer release()

	if input.Credentials == nil {
		input.Credentials = map[string]string{}
	}
	if previousError == nil {
		if mergeError := server.mergeSavedVPNConnectionCredentials(
			previousConfiguration,
			input.ProviderID,
			input.Tunnel,
			input.Credentials,
		); mergeError != nil {
			server.logInternalError("decrypt saved VPN credentials before connect", mergeError)
			writeInternalError(responseWriter)

			return
		}
	}

	connection, profiles, err := server.connectionFromInput(
		ctx,
		input.ProviderID,
		input.Tunnel,
		input.ProfileIDs,
		input.EndpointStrategy,
		input.Credentials,
		input.DNSServers,
		input.RetryIntervalSeconds,
	)
	if errors.Is(err, storage.ErrNotFound) {
		writeError(responseWriter, http.StatusNotFound, "profile_not_found", "The selected VPN profile was not found.")

		return
	}
	if err != nil {
		if writeVPNCredentialIssue(responseWriter, "credentials", err) {
			return
		}
		writeError(responseWriter, http.StatusUnprocessableEntity, "vpn_candidate_invalid", err.Error())

		return
	}
	defer clearConnectionProfiles(&connection)

	connectionID := previousConfiguration.ID
	connectionSlot := previousConfiguration.Slot
	connectionName := previousConfiguration.Name
	peerPort := previousConfiguration.PeerPort
	if errors.Is(previousError, storage.ErrNotFound) {
		connectionSlot = 0
		connectionID, err = storage.NewVPNConnectionID()
		if err != nil {
			server.logInternalError("generate VPN connection identifier", err)
			writeError(responseWriter, http.StatusInternalServerError, "vpn_commit_failed", "The verified VPN configuration could not be saved.")

			return
		}
		definition, _ := provider.DefinitionByID(input.ProviderID)
		connectionName = definition.DisplayName
		peerPort = storage.DefaultVPNPeerPort
	}
	if input.PeerPort != nil {
		peerPort = *input.PeerPort
	}

	status, err := server.controller.Connect(ctx, connectionID, connectionSlot, true, connection)
	if err != nil {
		server.restorePreviousVPN(connectionID, previousConfiguration, previousError)
		writeError(responseWriter, http.StatusUnprocessableEntity, "vpn_connection_failed", publicVPNConnectionFailure(err, connection.Endpoints))

		return
	}

	credentialNonce, credentialCiphertext, err := server.sealVPNConnectionCredentials(
		connectionID,
		input.Credentials,
	)
	clear(input.Credentials)
	if err != nil {
		server.restorePreviousVPN(connectionID, previousConfiguration, previousError)
		server.logInternalError("seal VPN credentials", err)
		writeError(responseWriter, http.StatusInternalServerError, "vpn_commit_failed", "The verified VPN configuration could not be saved.")

		return
	}

	storedConfiguration := storage.EncryptedVPNConnection{
		ID:                    connectionID,
		Name:                  connectionName,
		Enabled:               true,
		ProviderID:            profiles[0].ProviderID,
		Tunnel:                connection.Tunnel,
		ProfileIDs:            append([]string{}, input.ProfileIDs...),
		EndpointStrategy:      input.EndpointStrategy,
		CredentialsNonce:      credentialNonce,
		CredentialsCiphertext: credentialCiphertext,
		DNSServers:            input.DNSServers,
		RetryIntervalSeconds:  input.RetryIntervalSeconds,
		PeerPort:              peerPort,
	}
	revision := int64(0)
	if errors.Is(previousError, storage.ErrNotFound) {
		if *input.ExpectedRevision != 0 {
			err = storage.ErrRevisionConflict
		} else {
			var created storage.EncryptedVPNConnection
			created, err = server.store.CreateVPNConnection(ctx, storedConfiguration)
			revision = created.Revision
		}
	} else {
		revision, err = server.store.UpdateVPNConnection(
			ctx,
			connectionID,
			*input.ExpectedRevision,
			storedConfiguration,
		)
	}
	if errors.Is(err, storage.ErrRevisionConflict) {
		server.restorePreviousVPN(connectionID, previousConfiguration, previousError)
		writeError(responseWriter, http.StatusConflict, "vpn_commit_conflict", "The VPN connection changed while the candidate was tested. The prior configuration was restored.")

		return
	}
	if err != nil {
		server.restorePreviousVPN(connectionID, previousConfiguration, previousError)
		server.logInternalError("commit verified VPN configuration", err)
		writeError(responseWriter, http.StatusInternalServerError, "vpn_commit_failed", "The verified VPN configuration could not be saved. The prior configuration was restored.")

		return
	}
	if err := server.publishTransmissionConfiguration(ctx); err != nil {
		server.logInternalError("publish Transmission configuration after VPN save", err)
		writeError(responseWriter, http.StatusInternalServerError, "vpn_runtime_update_deferred", "The VPN connection was saved, but its Transmission daemon update could not be published.")

		return
	}

	writeJSON(responseWriter, http.StatusOK, map[string]any{
		"revision": revision,
		"status":   status,
	})
}

// handleVPNReconnect activates the encrypted last-known-good configuration.
//
// Credentials are decrypted only for the local controller call and are never returned
// by this or any read API. The alias claims only the default connection and finishes
// even when the browser leaves.
func (server *Server) handleVPNReconnect(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	if server.controller == nil {
		writeError(responseWriter, http.StatusServiceUnavailable, "controller_unavailable", "The VPN controller is unavailable.")

		return
	}
	if server.vpnCommands.globalRunning() {
		writeError(responseWriter, http.StatusConflict, "vpn_change_running", "Another VPN change is still running. Try again when it finishes.")

		return
	}

	ctx := context.WithoutCancel(request.Context())

	activeConfiguration, err := server.store.DefaultVPNConnection(ctx)
	if errors.Is(err, storage.ErrNotFound) {
		writeError(responseWriter, http.StatusConflict, "vpn_not_configured", "No verified VPN configuration is available.")

		return
	}
	if err != nil {
		server.logInternalError("read active VPN configuration", err)
		writeError(responseWriter, http.StatusInternalServerError, "vpn_state_unavailable", "The VPN configuration is unavailable.")

		return
	}
	release, claimed := server.vpnCommands.beginConnection(activeConfiguration.ID)
	if !claimed {
		writeError(responseWriter, http.StatusConflict, "vpn_change_running", "Another VPN change is still running. Try again when it finishes.")

		return
	}
	defer release()
	if len(activeConfiguration.ProfileIDs) == 0 {
		writeError(responseWriter, http.StatusConflict, "vpn_not_configured", "Enter the VPN connection details again first.")

		return
	}

	status, err := server.connectStoredVPN(ctx, activeConfiguration)
	if err != nil {
		writeError(responseWriter, http.StatusUnprocessableEntity, "vpn_connection_failed", server.publicStoredVPNConnectionFailure(ctx, err, activeConfiguration.ProfileIDs))

		return
	}
	if err := server.store.SetVPNConnectionEnabled(ctx, activeConfiguration.ID, true); err != nil {
		_, _ = server.controller.Disconnect(context.Background(), activeConfiguration.ID)
		server.logInternalError("enable active VPN configuration", err)
		writeError(responseWriter, http.StatusInternalServerError, "vpn_commit_failed", "The VPN connection could not be enabled persistently.")

		return
	}
	if err := server.publishTransmissionConfiguration(ctx); err != nil {
		server.logInternalError("publish Transmission configuration after VPN enable", err)
		writeError(responseWriter, http.StatusInternalServerError, "vpn_runtime_update_deferred", "The VPN connection was enabled, but its Transmission daemon update could not be published.")

		return
	}

	writeJSON(responseWriter, http.StatusOK, status)
}

// handleVPNDisconnect blocks networking and turns automatic reconnects off.
//
// Automatic reconnects are turned off before the controller blocks, so the background
// restore can never reconnect what an administrator just blocked. The encrypted
// last-known-good snapshot remains available for a later explicit reconnect, but
// Transmission never receives a direct-network fallback. The alias claims the default
// connection and finishes even when the browser leaves.
func (server *Server) handleVPNDisconnect(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	if server.controller == nil {
		writeError(responseWriter, http.StatusServiceUnavailable, "controller_unavailable", "The VPN controller is unavailable.")

		return
	}

	ctx := context.WithoutCancel(request.Context())
	activeConfiguration, configurationError := server.store.DefaultVPNConnection(ctx)

	var release func()
	var claimed bool
	if errors.Is(configurationError, storage.ErrNotFound) {
		release, claimed = server.vpnCommands.beginGlobal()
	} else if configurationError == nil {
		release, claimed = server.vpnCommands.beginConnection(activeConfiguration.ID)
	} else {
		server.logInternalError("read default VPN connection", configurationError)
		writeError(responseWriter, http.StatusInternalServerError, "vpn_commit_failed", "Automatic reconnects could not be turned off, so the VPN was left as it was.")

		return
	}
	if !claimed {
		writeError(responseWriter, http.StatusConflict, "vpn_change_running", "Another VPN change is still running. Try again when it finishes.")

		return
	}
	defer release()
	if configurationError == nil {
		if err := server.store.SetVPNConnectionEnabled(ctx, activeConfiguration.ID, false); err != nil {
			server.logInternalError("disable default VPN connection", err)
			writeError(responseWriter, http.StatusInternalServerError, "vpn_commit_failed", "Automatic reconnects could not be turned off, so the VPN was left as it was.")

			return
		}
	}
	if configurationError == nil {
		if err := server.publishTransmissionConfiguration(ctx); err != nil {
			server.logInternalError("publish Transmission configuration after VPN disable", err)
			writeError(responseWriter, http.StatusInternalServerError, "vpn_runtime_update_deferred", "The VPN connection was disabled, but its Transmission daemon update could not be published.")

			return
		}
	}
	connectionID := ""
	if configurationError == nil {
		connectionID = activeConfiguration.ID
	} else {
		statuses, statusError := server.controller.Status(ctx)
		if statusError != nil {
			writeError(responseWriter, http.StatusServiceUnavailable, "vpn_disconnect_failed", "The VPN controller could not confirm the blocked state.")

			return
		}
		connectionID = defaultControllerStatus(statuses).ConnectionID
	}
	if connectionID == "" {
		writeJSON(responseWriter, http.StatusOK, controller.Status{
			State:      "blocked",
			DNSServers: []string{},
		})

		return
	}
	status, err := server.controller.Disconnect(ctx, connectionID)
	if err != nil {
		writeError(responseWriter, http.StatusServiceUnavailable, "vpn_disconnect_failed", "The VPN controller could not confirm the blocked state.")

		return
	}

	writeJSON(responseWriter, http.StatusOK, status)
}

// RestoreActiveVPN asks the controller to recover every enabled last-known-good tunnel.
//
// Main calls this every 10 seconds for as long as the API runs, so a controller that
// restarted without any connection statuses, or a failed connection that stayed
// blocked, gets every enabled tunnel back. API availability never depends on provider
// health or controller startup ordering. An administrator's VPN change takes over from
// it at once, and it returns ErrVPNRestoreDeferred so the loop tries again afterward.
// Connections that are already connecting, reconnecting, or protected with a complete
// session are left alone. At most four independent pools are tested at once.
func (server *Server) RestoreActiveVPN(ctx context.Context) error {
	if server.controller == nil {
		return errors.New("VPN controller client is unavailable")
	}

	configurations, err := server.store.ListVPNConnections(ctx)
	if err != nil {
		return err
	}
	restorableConfigurations := make([]storage.EncryptedVPNConnection, 0, len(configurations))
	for _, configuration := range configurations {
		if configuration.Enabled && len(configuration.ProfileIDs) > 0 {
			restorableConfigurations = append(restorableConfigurations, configuration)
		}
	}
	if len(restorableConfigurations) == 0 {
		return nil
	}

	semaphore := make(chan struct{}, 4)
	results := make(chan error, len(restorableConfigurations))
	for _, configuration := range restorableConfigurations {
		configuration := configuration
		go func() {
			select {
			case semaphore <- struct{}{}:
				defer func() { <-semaphore }()
			case <-ctx.Done():
				results <- ctx.Err()

				return
			}
			results <- server.restoreActiveVPNConnection(ctx, configuration)
		}()
	}

	var restoreErrors []error
	deferred := false
	for range restorableConfigurations {
		result := <-results
		if errors.Is(result, ErrVPNRestoreDeferred) {
			deferred = true

			continue
		}
		if result != nil {
			restoreErrors = append(restoreErrors, result)
		}
	}
	if deferred && ctx.Err() == nil {
		restoreErrors = append(restoreErrors, ErrVPNRestoreDeferred)
	}

	return errors.Join(restoreErrors...)
}

func (server *Server) restoreActiveVPNConnection(
	ctx context.Context,
	snapshot storage.EncryptedVPNConnection,
) error {
	restoreContext, release, claimed := server.vpnCommands.beginConnectionRestore(ctx, snapshot.ID)
	if !claimed {
		return ErrVPNRestoreDeferred
	}
	defer release()

	configuration, err := server.store.VPNConnectionByID(restoreContext, snapshot.ID)
	if errors.Is(err, storage.ErrNotFound) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("re-read VPN connection %q before restore: %w", snapshot.ID, err)
	}
	if !configuration.Enabled || len(configuration.ProfileIDs) == 0 ||
		configuration.Revision != snapshot.Revision {
		return nil
	}

	statuses, err := server.controller.Status(restoreContext)
	if err != nil {
		if restoreContext.Err() != nil {
			return ErrVPNRestoreDeferred
		}

		return fmt.Errorf("read VPN controller status before restoring %q: %w", snapshot.ID, err)
	}
	status, found := controllerStatusForConnection(statuses, configuration.ID)
	protectedWithoutSession := found && status.State == "protected" &&
		(status.Interface == "" || status.Address == "")
	if found && status.State != "blocked" && !protectedWithoutSession {
		return nil
	}

	connection, err := server.storedVPNConnection(restoreContext, configuration)
	if err != nil {
		if restoreContext.Err() != nil {
			return ErrVPNRestoreDeferred
		}

		return fmt.Errorf("restore VPN connection %q: %w", configuration.ID, err)
	}
	defer clearConnectionProfiles(&connection)
	_, err = server.controller.Restore(
		restoreContext,
		configuration.ID,
		configuration.Slot,
		configuration.IsDefault,
		connection,
	)
	if err != nil {
		if restoreContext.Err() != nil {
			return ErrVPNRestoreDeferred
		}

		return fmt.Errorf("restore VPN connection %q: %w", configuration.ID, err)
	}

	return nil
}

// connectionFromInput decrypts an ordered same-provider, same-tunnel endpoint pool.
//
// Provider, tunnel, and endpoint metadata are checked before plaintext profile content
// crosses the restricted local controller socket. WireGuard catalog entries are
// templates without a key, so the user's key and address are merged into a fresh
// buffer here; clearConnectionProfiles wipes it after the command.
func (server *Server) connectionFromInput(
	ctx context.Context,
	providerID string,
	tunnelID string,
	profileIDs []string,
	endpointStrategy string,
	credentials map[string]string,
	dnsServers []string,
	retryIntervalSeconds int,
) (controller.Connection, []storage.StoredVPNProfile, error) {
	definition, found := provider.DefinitionByID(providerID)
	if !found {
		return controller.Connection{}, nil, errors.New("the VPN provider is unsupported")
	}
	tunnel, found := definition.Tunnel(tunnelID)
	if !found {
		return controller.Connection{}, nil, errors.New("the VPN provider does not offer this tunnel")
	}
	if len(profileIDs) == 0 || len(profileIDs) > 128 {
		return controller.Connection{}, nil, errors.New("select between 1 and 128 VPN endpoints")
	}
	if endpointStrategy != "sticky" && endpointStrategy != "ordered" && endpointStrategy != "randomized" {
		return controller.Connection{}, nil, errors.New("the VPN endpoint strategy is invalid")
	}
	if err := validateVPNConnectionFields(
		tunnel,
		credentials,
		dnsServers,
		retryIntervalSeconds,
	); err != nil {
		return controller.Connection{}, nil, err
	}

	connection := controller.Connection{
		ProviderID:           providerID,
		Tunnel:               tunnel.ID,
		EndpointStrategy:     endpointStrategy,
		DNSServers:           append([]string{}, dnsServers...),
		RetryIntervalSeconds: retryIntervalSeconds,
	}
	if tunnel.ID == provider.TunnelOpenVPN {
		connection.Username = credentials["username"]
		connection.Password = credentials["password"]
	}
	profiles := make([]storage.StoredVPNProfile, 0, len(profileIDs))
	seenProfileIDs := make(map[string]struct{}, len(profileIDs))
	for _, profileID := range profileIDs {
		if !validVPNIdentifier(profileID) {
			clearConnectionProfiles(&connection)

			return controller.Connection{}, nil, errors.New("the VPN profile identifier is invalid")
		}
		if _, duplicate := seenProfileIDs[profileID]; duplicate {
			clearConnectionProfiles(&connection)

			return controller.Connection{}, nil, errors.New("the VPN endpoint pool contains duplicates")
		}
		seenProfileIDs[profileID] = struct{}{}

		profile, err := server.store.FindVPNProfile(ctx, profileID)
		if err != nil {
			clearConnectionProfiles(&connection)

			return controller.Connection{}, nil, err
		}
		if profile.ProviderID != providerID {
			clearConnectionProfiles(&connection)

			return controller.Connection{}, nil, errors.New("every VPN endpoint must belong to the selected provider")
		}
		if profile.Tunnel != tunnel.ID {
			clearConnectionProfiles(&connection)

			return controller.Connection{}, nil, errors.New("every VPN endpoint must use the selected tunnel")
		}

		configuration, err := security.DecryptSecret(
			server.installationKey,
			"vpn/profile/"+profile.ID,
			profile.Nonce,
			profile.Ciphertext,
		)
		if err != nil {
			clearConnectionProfiles(&connection)

			return controller.Connection{}, nil, fmt.Errorf("decrypt VPN profile: %w", err)
		}
		if tunnel.ID == provider.TunnelWireGuard && profile.Source == "official-catalog" {
			mergedConfiguration, mergeError := provider.MergeWireGuardCredentials(configuration, credentials)
			clear(configuration)
			if mergeError != nil {
				clearConnectionProfiles(&connection)

				return controller.Connection{}, nil, mergeError
			}
			configuration = mergedConfiguration
		}
		connection.Endpoints = append(connection.Endpoints, controller.Endpoint{
			ProfileID:     profile.ID,
			Configuration: configuration,
			RemoteHost:    profile.RemoteHost,
			RemotePort:    profile.RemotePort,
		})
		profiles = append(profiles, profile)
	}

	return connection, profiles, nil
}

// validateVPNConnectionFields rejects unsafe credentials and network policy values.
//
// The HTTP boundary applies the same constraints as the privileged controller before
// any profile decryption or tunnel attempt begins. Credentials are checked against the
// tunnel's own fields, so a key the tunnel does not use is refused.
func validateVPNConnectionFields(
	tunnel provider.TunnelDefinition,
	credentials map[string]string,
	dnsServers []string,
	retryIntervalSeconds int,
) error {
	if err := provider.ValidateCredentials(tunnel, credentials); err != nil {
		return err
	}

	if len(dnsServers) > 8 {
		return errors.New("no more than eight DNS servers may be configured")
	}
	for _, serverAddress := range dnsServers {
		address, err := netip.ParseAddr(serverAddress)
		if err != nil || !address.Is4() {
			return fmt.Errorf("DNS server is not an IPv4 address: %s", serverAddress)
		}
	}

	if retryIntervalSeconds < 3 || retryIntervalSeconds > 600 {
		return errors.New("VPN retry interval must be between 3 and 600 seconds")
	}

	return nil
}

// validVPNIdentifier confines endpoint identifiers before database lookup.
//
// Provider adapters use an opaque but closed character set so malformed identifiers
// cannot enter logs, storage queries, or controller commands.
func validVPNIdentifier(value string) bool {
	if value == "" || len(value) > 160 {
		return false
	}

	for _, character := range value {
		if !(character >= 'a' && character <= 'z') &&
			!(character >= 'A' && character <= 'Z') &&
			!(character >= '0' && character <= '9') &&
			!strings.ContainsRune("._:-", character) {
			return false
		}
	}

	return true
}

// connectStoredVPN decrypts and activates one previously verified configuration.
//
// Profile and credential plaintext are cleared from mutable byte slices immediately
// after the synchronous controller command returns.
func (server *Server) connectStoredVPN(
	ctx context.Context,
	configuration storage.EncryptedVPNConnection,
) (controller.Status, error) {
	connection, err := server.storedVPNConnection(ctx, configuration)
	if err != nil {
		return controller.Status{}, err
	}
	defer clearConnectionProfiles(&connection)

	return server.controller.Connect(
		ctx,
		configuration.ID,
		configuration.Slot,
		configuration.IsDefault,
		connection,
	)
}

// decryptVPNConnectionCredentials opens one connection's sealed credential map.
//
// Callers clear the returned map after deriving safe metadata, merging a submitted
// candidate, or constructing the controller request.
//
// Since: 2.0.0
func (server *Server) decryptVPNConnectionCredentials(
	configuration storage.EncryptedVPNConnection,
) (map[string]string, error) {
	credentials := map[string]string{}
	if len(configuration.CredentialsNonce) == 0 && len(configuration.CredentialsCiphertext) == 0 {
		return credentials, nil
	}

	credentialJSON, err := security.DecryptSecret(
		server.installationKey,
		"vpn/connection/"+configuration.ID,
		configuration.CredentialsNonce,
		configuration.CredentialsCiphertext,
	)
	if err != nil {
		return nil, fmt.Errorf("decrypt VPN credentials: %w", err)
	}
	defer clear(credentialJSON)

	if err := json.Unmarshal(credentialJSON, &credentials); err != nil {
		return nil, fmt.Errorf("decode VPN credentials: %w", err)
	}
	if credentials == nil {
		credentials = map[string]string{}
	}
	maps.DeleteFunc(credentials, func(_ string, value string) bool {
		return value == ""
	})

	return credentials, nil
}

// mergeSavedVPNConnectionCredentials fills empty same-tunnel fields from storage.
//
// A provider or tunnel change deliberately skips the merge so its candidate must
// supply every required credential before validation reaches the controller.
//
// Since: 2.0.0
func (server *Server) mergeSavedVPNConnectionCredentials(
	configuration storage.EncryptedVPNConnection,
	providerID string,
	tunnelID string,
	credentials map[string]string,
) error {
	if providerID != configuration.ProviderID || tunnelID != configuration.Tunnel {
		return nil
	}

	savedCredentials, err := server.decryptVPNConnectionCredentials(configuration)
	if err != nil {
		return err
	}
	defer clear(savedCredentials)

	definition, found := provider.DefinitionByID(providerID)
	if !found {
		return nil
	}
	tunnel, found := definition.Tunnel(tunnelID)
	if !found {
		return nil
	}
	for _, field := range tunnel.CredentialFields {
		if credentials[field.Key] == "" && savedCredentials[field.Key] != "" {
			credentials[field.Key] = savedCredentials[field.Key]
		}
	}

	return nil
}

// savedVPNConnectionCredentialKeys returns only configured field names for a read.
//
// Provider order keeps the payload deterministic, and plaintext values are cleared
// without crossing the response boundary.
//
// Since: 2.0.0
func (server *Server) savedVPNConnectionCredentialKeys(
	configuration storage.EncryptedVPNConnection,
) ([]string, error) {
	credentials, err := server.decryptVPNConnectionCredentials(configuration)
	if err != nil {
		return nil, err
	}
	defer clear(credentials)

	keys := []string{}
	definition, found := provider.DefinitionByID(configuration.ProviderID)
	if !found {
		return keys, nil
	}
	tunnel, found := definition.Tunnel(configuration.Tunnel)
	if !found {
		return keys, nil
	}
	for _, field := range tunnel.CredentialFields {
		if credentials[field.Key] != "" {
			keys = append(keys, field.Key)
		}
	}

	return keys, nil
}

// storedVPNConnection decrypts one previously verified configuration for the controller.
//
// The caller clears the returned profiles with clearConnectionProfiles once its
// controller command returns.
func (server *Server) storedVPNConnection(
	ctx context.Context,
	configuration storage.EncryptedVPNConnection,
) (controller.Connection, error) {
	if len(configuration.ProfileIDs) == 0 {
		return controller.Connection{}, errors.New("stored VPN configuration has no endpoints")
	}
	credentials, err := server.decryptVPNConnectionCredentials(configuration)
	if err != nil {
		return controller.Connection{}, err
	}
	defer clear(credentials)

	connection, _, err := server.connectionFromInput(
		ctx,
		configuration.ProviderID,
		configuration.Tunnel,
		configuration.ProfileIDs,
		configuration.EndpointStrategy,
		credentials,
		configuration.DNSServers,
		configuration.RetryIntervalSeconds,
	)
	if err != nil {
		return controller.Connection{}, err
	}

	return connection, nil
}

// restorePreviousVPN reactivates the prior verified configuration after candidate failure.
//
// Rollback uses an independent context so a disconnected HTTP client cannot cancel the
// safety recovery it triggered; the controller client bounds each command.
func (server *Server) restorePreviousVPN(
	candidateConnectionID string,
	previousConfiguration storage.EncryptedVPNConnection,
	previousError error,
) {
	rollbackContext := context.Background()

	if errors.Is(previousError, storage.ErrNotFound) || !previousConfiguration.Enabled {
		if _, err := server.controller.Disconnect(rollbackContext, candidateConnectionID); err != nil {
			server.logInternalError("restore blocked VPN state", err)
		}

		return
	}

	if _, err := server.connectStoredVPN(rollbackContext, previousConfiguration); err != nil {
		server.logInternalError("restore prior VPN configuration", err)
	}
}

// defaultControllerStatus selects the v4 controller's default projection.
func defaultControllerStatus(statuses []controller.Status) controller.Status {
	for _, status := range statuses {
		if status.Default {
			return status
		}
	}

	return controller.Status{State: "blocked", DNSServers: []string{}}
}

// controllerStatusForConnection finds the durable identity in a v4 status list.
func controllerStatusForConnection(
	statuses []controller.Status,
	connectionID string,
) (controller.Status, bool) {
	for _, status := range statuses {
		if status.ConnectionID == connectionID {
			return status, true
		}
	}

	return controller.Status{}, false
}

// encryptVPNProfile protects normalized content with profile identity as associated data.
//
// Moving ciphertext between endpoint records therefore fails authentication even when
// both records were encrypted by the same installation key.
func (server *Server) encryptVPNProfile(
	profile provider.Profile,
	source string,
) (storage.EncryptedVPNProfile, error) {
	nonce, ciphertext, err := security.EncryptSecret(
		server.installationKey,
		"vpn/profile/"+profile.ID,
		profile.Configuration,
	)
	if err != nil {
		return storage.EncryptedVPNProfile{}, err
	}

	return storage.EncryptedVPNProfile{
		ID:          profile.ID,
		ProviderID:  profile.ProviderID,
		Tunnel:      profile.Tunnel,
		DisplayName: profile.DisplayName,
		CountryCode: profile.CountryCode,
		Country:     profile.Country,
		City:        profile.City,
		Continent:   profile.Continent,
		Protocol:    profile.Protocol,
		RemoteHost:  profile.RemoteHost,
		RemotePort:  profile.RemotePort,
		Fingerprint: profile.Fingerprint,
		Source:      source,
		Nonce:       nonce,
		Ciphertext:  ciphertext,
	}, nil
}

// downloadVPNCatalogSource retrieves one fixed catalog under a strict redirect policy.
//
// Redirects may remain only on HTTPS and the original CDN host, preventing the fixed
// adapter source from becoming a general server-side request primitive. The source
// sets the size cap and time limit, so a large catalog can't loosen anyone else's.
// Catalogs are how a first VPN connection gets set up, so they download outside the
// VPN through dial.
func downloadVPNCatalogSource(
	ctx context.Context,
	source provider.CatalogSource,
	dial func(ctx context.Context, network string, address string) (net.Conn, error),
) ([]byte, error) {
	sourceURL, err := url.Parse(source.URL)
	if err != nil {
		return nil, fmt.Errorf("parse VPN catalog URL: %w", err)
	}

	transport := http.DefaultTransport.(*http.Transport).Clone()
	if dial != nil {
		transport.DialContext = dial
	}

	maximumBytes, timeout := source.DownloadLimits()
	httpClient := &http.Client{
		Transport: transport,
		Timeout:   timeout,
		CheckRedirect: func(request *http.Request, previousRequests []*http.Request) error {
			if len(previousRequests) >= 3 || request.URL.Scheme != "https" ||
				request.URL.Hostname() != sourceURL.Hostname() {
				return errors.New("VPN catalog redirect left the approved HTTPS source")
			}

			return nil
		},
	}

	downloadRequest, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		source.URL,
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("create VPN catalog request: %w", err)
	}
	downloadRequest.Header.Set("Accept", source.AcceptHeader())
	downloadRequest.Header.Set("User-Agent", "transmission-vpn-control-api")

	response, err := httpClient.Do(downloadRequest)
	if err != nil {
		return nil, fmt.Errorf("download VPN catalog: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("VPN catalog returned HTTP %d", response.StatusCode)
	}
	if response.ContentLength > maximumBytes {
		return nil, errors.New("VPN catalog exceeds the download size limit")
	}

	limitedReader := io.LimitReader(response.Body, maximumBytes+1)
	content, err := io.ReadAll(limitedReader)
	if err != nil {
		return nil, fmt.Errorf("read VPN catalog: %w", err)
	}
	if int64(len(content)) > maximumBytes {
		return nil, errors.New("VPN catalog exceeds the download size limit")
	}

	return content, nil
}

// downloadCatalogSourceWithRetries downloads one catalog source and repeats a failed
// host lookup.
//
// Lookups get catalogLookupAttempts tries with doubling pauses, so a resolver outage of
// a few seconds doesn't fail the refresh. Other failures and a canceled refresh return
// at once.
func (server *Server) downloadCatalogSourceWithRetries(ctx context.Context, source provider.CatalogSource) ([]byte, error) {
	retryDelay := catalogLookupRetryDelay

	for attempt := 1; ; attempt++ {
		content, err := server.downloadCatalog(ctx, source)
		if err == nil {
			return content, nil
		}

		var lookupError *net.DNSError
		if attempt == catalogLookupAttempts || !errors.As(err, &lookupError) || ctx.Err() != nil {
			return nil, err
		}

		retryTimer := time.NewTimer(retryDelay)
		select {
		case <-ctx.Done():
			retryTimer.Stop()

			return nil, err
		case <-retryTimer.C:
		}

		retryDelay *= 2
	}
}

// writeCatalogDownloadError reports a failed catalog download and names the host it
// came from.
//
// A failed host lookup points at the container's DNS instead of the provider, so it gets
// its own code and message.
func writeCatalogDownloadError(responseWriter http.ResponseWriter, source string, err error) {
	host := source
	if sourceURL, parseError := url.Parse(source); parseError == nil && sourceURL.Hostname() != "" {
		host = sourceURL.Hostname()
	}

	var lookupError *net.DNSError
	if errors.As(err, &lookupError) {
		writeError(responseWriter, http.StatusBadGateway, "catalog_lookup_failed", fmt.Sprintf("The container could not look up %s to download the VPN provider catalog.", host))

		return
	}

	writeError(responseWriter, http.StatusBadGateway, "catalog_download_failed", fmt.Sprintf("The official VPN provider catalog could not be downloaded from %s.", host))
}

var (
	// errUnsupportedTunnel marks an upload for a tunnel other than OpenVPN or WireGuard.
	errUnsupportedTunnel = errors.New("unsupported tunnel")

	// errWireGuardFileAsOpenVPN marks a WireGuard file uploaded for the OpenVPN tunnel.
	errWireGuardFileAsOpenVPN = errors.New("a WireGuard file was uploaded for the OpenVPN tunnel")

	// errOpenVPNFileAsWireGuard marks a file without [Interface] uploaded for WireGuard.
	errOpenVPNFileAsWireGuard = errors.New("a file without an [Interface] section was uploaded for the WireGuard tunnel")
)

// normalizeCustomProfiles validates an upload in its tunnel's format.
//
// A file in the other tunnel's format gets an error that names the right tunnel
// instead of a parser message about the first unexpected line.
func normalizeCustomProfiles(tunnel string, profileName string, content []byte) ([]provider.Profile, error) {
	switch tunnel {
	case provider.TunnelOpenVPN:
		if provider.LooksLikeWireGuardConfiguration(content) {
			return nil, errWireGuardFileAsOpenVPN
		}

		return provider.NormalizeOpenVPNProfiles("custom", profileName, content)
	case provider.TunnelWireGuard:
		if !provider.LooksLikeWireGuardConfiguration(content) {
			return nil, errOpenVPNFileAsWireGuard
		}

		profile, err := provider.NormalizeWireGuardProfile("custom", profileName, content)
		if err != nil {
			return nil, err
		}

		return []provider.Profile{profile}, nil
	default:
		return nil, errUnsupportedTunnel
	}
}

// clearConnectionProfiles removes decrypted profile bytes as soon as a command completes.
func clearConnectionProfiles(connection *controller.Connection) {
	for index := range connection.Endpoints {
		clear(connection.Endpoints[index].Configuration)
	}
}
