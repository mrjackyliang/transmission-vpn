package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

var errConnectionBeingRemoved = errors.New("VPN connection is being removed")

// readOptionalVPNConnectionID decodes an omitted, null, or concrete relationship.
func readOptionalVPNConnectionID(raw json.RawMessage) (*string, bool) {
	if len(raw) == 0 || bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
		return nil, true
	}

	var connectionID string
	if decodeOneJSONValue(raw, &connectionID) != nil || connectionID == "" {
		return nil, false
	}

	return &connectionID, true
}

// validateVPNConnectionReference checks only concrete IDs; null remains the default.
func (server *Server) validateVPNConnectionReference(
	ctx context.Context,
	connectionID *string,
) error {
	if connectionID == nil {
		return nil
	}
	_, err := server.store.VPNConnectionByID(ctx, *connectionID)

	return err
}

// effectiveVPNConnectionID resolves null through the current durable default.
func (server *Server) effectiveVPNConnectionID(
	ctx context.Context,
	connectionID *string,
) (string, error) {
	if connectionID != nil {
		if err := server.validateVPNConnectionReference(ctx, connectionID); err != nil {
			return "", err
		}

		return *connectionID, nil
	}

	connection, err := server.store.DefaultVPNConnection(ctx)
	if err != nil {
		return "", err
	}

	return connection.ID, nil
}

// sameOptionalString reports whether two nullable connection selections match.
func sameOptionalString(left *string, right *string) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}

	return *left == *right
}

// isMissingVPNConnection reports the stable storage lookup failure used by handlers.
func isMissingVPNConnection(err error) bool {
	return errors.Is(err, storage.ErrNotFound)
}

// markVPNConnectionRemoving publishes one deletion target to concurrent mutations.
//
// The delete handler already owns the global VPN gate. Taking the reference gate
// before the add mutex lets earlier relationship writes and torrent adds finish, then
// makes the marker visible before either class of mutation can resume.
func (server *Server) markVPNConnectionRemoving(connectionID string, targetConnectionID string) {
	server.vpnConnectionReferenceGate.Lock()
	defer server.vpnConnectionReferenceGate.Unlock()
	server.torrentAddMutex.Lock()
	defer server.torrentAddMutex.Unlock()

	server.vpnConnectionRemovalMutex.Lock()
	if server.vpnConnectionsRemoving == nil {
		server.vpnConnectionsRemoving = map[string]string{}
	}
	server.vpnConnectionsRemoving[connectionID] = targetConnectionID
	server.vpnConnectionRemovalMutex.Unlock()
}

// unmarkVPNConnectionRemoving releases a deletion marker on every terminal response.
//
// Successful deletions no longer need the marker once the durable row and daemon have
// disappeared, while failed deletions must allow the retained connection to be used.
func (server *Server) unmarkVPNConnectionRemoving(connectionID string) {
	server.vpnConnectionReferenceGate.Lock()
	defer server.vpnConnectionReferenceGate.Unlock()

	server.vpnConnectionRemovalMutex.Lock()
	delete(server.vpnConnectionsRemoving, connectionID)
	server.vpnConnectionRemovalMutex.Unlock()
}

// holdVPNConnectionReference protects one concrete relationship write from deletion.
//
// A writer that arrives first completes before the removal marker is published. A
// writer that arrives later observes the marker while holding the same gate and is
// refused, closing the validation-to-commit window around storage transactions.
func (server *Server) holdVPNConnectionReference(
	connectionID *string,
) (func(), bool) {
	if connectionID == nil {
		return func() {}, false
	}

	server.vpnConnectionReferenceGate.RLock()
	if _, removing := server.vpnConnectionRemovalTarget(*connectionID); removing {
		server.vpnConnectionReferenceGate.RUnlock()

		return func() {}, true
	}

	return server.vpnConnectionReferenceGate.RUnlock, false
}

// holdVPNConnectionIDReference is the concrete-ID form used by torrent reassignment.
func (server *Server) holdVPNConnectionIDReference(
	connectionID string,
) (func(), bool) {
	return server.holdVPNConnectionReference(&connectionID)
}

// vpnConnectionRemovalTarget returns the moveTo destination for an active deletion.
//
// An empty target means deletion without moveTo; callers must reject rather than
// silently choose a route in that case.
func (server *Server) vpnConnectionRemovalTarget(connectionID string) (string, bool) {
	server.vpnConnectionRemovalMutex.RLock()
	targetConnectionID, removing := server.vpnConnectionsRemoving[connectionID]
	server.vpnConnectionRemovalMutex.RUnlock()

	return targetConnectionID, removing
}

// writeConnectionBeingRemoved returns the stable conflict used by console mutations.
//
// Callers can reload their connection choices while the owning delete request either
// completes or restores the retained connection.
func writeConnectionBeingRemoved(responseWriter http.ResponseWriter) {
	writeError(
		responseWriter,
		http.StatusConflict,
		"connection_being_removed",
		"The selected VPN connection is being removed.",
	)
}
