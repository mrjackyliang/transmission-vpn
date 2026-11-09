package storage

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/netip"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	// DefaultVPNPeerPort is used until a connection chooses its incoming peer port.
	//
	// Startup rendering and the existing single-daemon API share this value so a fresh
	// appliance keeps Transmission's established default.
	//
	// Since: UNRELEASED
	DefaultVPNPeerPort = 51413

	maximumVPNConnections = 64
)

var (
	// ErrVPNConnectionNameTaken reports a case-insensitive name collision.
	//
	// Connection names are user-facing identifiers, so callers receive a stable
	// conflict instead of a SQLite constraint error.
	//
	// Since: UNRELEASED
	ErrVPNConnectionNameTaken = errors.New("VPN connection name is already in use")

	// ErrVPNConnectionLimit reports that all connection slots are occupied.
	//
	// Slot allocation happens in the creation transaction, closing races between
	// simultaneous requests for the lowest free slot.
	//
	// Since: UNRELEASED
	ErrVPNConnectionLimit = errors.New("VPN connection limit reached")

	// ErrDefaultVPNConnection reports an attempt to remove the default connection.
	//
	// Later phases move dependent torrents before deletion, but the default itself must
	// always be changed explicitly before it can be removed.
	//
	// Since: UNRELEASED
	ErrDefaultVPNConnection = errors.New("the default VPN connection cannot be deleted")

	// ErrVPNConnectionReference reports a relationship to a missing connection.
	//
	// Profile and proxy-login writers validate the relationship in their own
	// transaction so a concurrent deletion cannot leave a dangling reference.
	//
	// Since: UNRELEASED
	ErrVPNConnectionReference = errors.New("the referenced VPN connection does not exist")

	// ErrVPNConnectionRequired prevents dependent features from being enabled or created
	// before their protected route exists.
	//
	// The shared transactional check keeps API and managed-configuration writes from
	// creating proxy state that cannot be routed through a VPN connection.
	//
	// Since: UNRELEASED
	ErrVPNConnectionRequired = errors.New("a VPN connection is required")
)

// EncryptedVPNConnection is one durable VPN connection and its sealed credentials.
//
// Safe metadata remains readable for status and daemon rendering, while credential
// plaintext exists only during a controller command.
//
// Since: UNRELEASED
type EncryptedVPNConnection struct {
	ID                         string
	Slot                       int
	Name                       string
	IsDefault                  bool
	Enabled                    bool
	ProviderID                 string
	Tunnel                     string
	ProfileIDs                 []string
	EndpointStrategy           string
	CredentialsNonce           []byte
	CredentialsCiphertext      []byte
	CredentialsLegacyProfileID string
	DNSServers                 []string
	RetryIntervalSeconds       int
	PeerPort                   int
	Revision                   int64
	CreatedAt                  time.Time
	UpdatedAt                  time.Time
}

const vpnConnectionColumns = `id, slot, name, is_default, enabled, provider_id,
	tunnel, endpoint_strategy, credentials_nonce, credentials_ciphertext,
	credentials_legacy_profile_id, dns_servers_json, retry_interval_seconds,
	peer_port, revision, created_at, updated_at`

// requireVPNConnection verifies that at least one protected route is configured.
//
// Callers pass their current transaction so the invariant is checked in the same
// SQL scope as the dependent write.
//
// Since: UNRELEASED
func requireVPNConnection(ctx context.Context, querySource queryInterface) error {
	var count int
	if err := querySource.QueryRowContext(
		ctx,
		"SELECT COUNT(*) FROM vpn_connections",
	).Scan(&count); err != nil {
		return fmt.Errorf("count VPN connections: %w", err)
	}
	if count == 0 {
		return ErrVPNConnectionRequired
	}

	return nil
}

// NewVPNConnectionID returns a random identifier such as vpc-0123456789abcdef.
//
// The API needs the identifier before sealing credentials because connection identity
// is authenticated as associated data.
//
// Since: UNRELEASED
func NewVPNConnectionID() (string, error) {
	value := make([]byte, 8)
	if _, err := rand.Read(value); err != nil {
		return "", fmt.Errorf("generate VPN connection identifier: %w", err)
	}

	return "vpc-" + hex.EncodeToString(value), nil
}

// ListVPNConnections returns every connection in stable slot order.
//
// Endpoint order is loaded after the base rows are closed so the store's single SQLite
// connection never needs a nested active result set.
//
// Since: UNRELEASED
func (store *Store) ListVPNConnections(ctx context.Context) ([]EncryptedVPNConnection, error) {
	rows, err := store.databaseHandle().QueryContext(
		ctx,
		"SELECT "+vpnConnectionColumns+" FROM vpn_connections ORDER BY slot",
	)
	if err != nil {
		return nil, fmt.Errorf("list VPN connections: %w", err)
	}

	connections := []EncryptedVPNConnection{}
	for rows.Next() {
		connection, scanError := scanVPNConnection(rows)
		if scanError != nil {
			_ = rows.Close()

			return nil, scanError
		}
		connections = append(connections, connection)
	}
	if err := rows.Close(); err != nil {
		return nil, fmt.Errorf("close VPN connections: %w", err)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate VPN connections: %w", err)
	}

	for index := range connections {
		profileIDs, endpointError := readVPNConnectionEndpoints(
			ctx,
			store.databaseHandle(),
			connections[index].ID,
		)
		if endpointError != nil {
			return nil, endpointError
		}
		connections[index].ProfileIDs = profileIDs
	}

	return connections, nil
}

// VPNConnectionByID returns one connection by its stable identifier.
//
// Callers use this lookup for future per-connection routes without depending on a
// mutable slot or display name.
//
// Since: UNRELEASED
func (store *Store) VPNConnectionByID(
	ctx context.Context,
	connectionID string,
) (EncryptedVPNConnection, error) {
	return readVPNConnection(
		ctx,
		store.databaseHandle(),
		"SELECT "+vpnConnectionColumns+" FROM vpn_connections WHERE id = ?",
		connectionID,
	)
}

// DefaultVPNConnection returns the connection used by today's single-daemon runtime.
//
// E1 keeps all existing VPN commands on this row; later phases use the same flag for
// DNS, unprofiled torrents, and default proxy routing.
//
// Since: UNRELEASED
func (store *Store) DefaultVPNConnection(ctx context.Context) (EncryptedVPNConnection, error) {
	return readVPNConnection(
		ctx,
		store.databaseHandle(),
		"SELECT "+vpnConnectionColumns+" FROM vpn_connections WHERE is_default = 1",
	)
}

// CreateVPNConnection stores a connection in the lowest free slot.
//
// The first row becomes the default in the same transaction. Name uniqueness and slot
// allocation are checked before any endpoint rows are published.
//
// Since: UNRELEASED
func (store *Store) CreateVPNConnection(
	ctx context.Context,
	connection EncryptedVPNConnection,
) (EncryptedVPNConnection, error) {
	return store.createVPNConnection(ctx, connection, nil)
}

// CreateVPNConnectionInSlot stores a pretested connection in its reserved slot.
//
// The API's global command gate selects the lowest free slot before asking the
// controller to test it. The transaction verifies that the same slot is still free.
//
// Since: UNRELEASED
func (store *Store) CreateVPNConnectionInSlot(
	ctx context.Context,
	connection EncryptedVPNConnection,
	slot int,
) (EncryptedVPNConnection, error) {
	if slot < 0 || slot >= maximumVPNConnections {
		return EncryptedVPNConnection{}, errors.New("VPN connection slot is invalid")
	}

	return store.createVPNConnection(ctx, connection, &slot)
}

func (store *Store) createVPNConnection(
	ctx context.Context,
	connection EncryptedVPNConnection,
	requestedSlot *int,
) (EncryptedVPNConnection, error) {
	connection, err := normalizeVPNConnection(connection)
	if err != nil {
		return EncryptedVPNConnection{}, err
	}
	if connection.ID == "" {
		connection.ID, err = NewVPNConnectionID()
		if err != nil {
			return EncryptedVPNConnection{}, err
		}
	}
	if !validVPNConnectionID(connection.ID) {
		return EncryptedVPNConnection{}, errors.New("VPN connection identifier is invalid")
	}

	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return EncryptedVPNConnection{}, fmt.Errorf("begin VPN connection creation: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	if err := checkVPNConnectionName(ctx, transaction, connection.Name, connection.ID); err != nil {
		return EncryptedVPNConnection{}, err
	}

	var count int
	if err := transaction.QueryRowContext(ctx, "SELECT COUNT(*) FROM vpn_connections").Scan(&count); err != nil {
		return EncryptedVPNConnection{}, fmt.Errorf("count VPN connections: %w", err)
	}
	if count >= maximumVPNConnections {
		return EncryptedVPNConnection{}, ErrVPNConnectionLimit
	}

	slots := make(map[int]struct{}, count)
	rows, err := transaction.QueryContext(ctx, "SELECT slot FROM vpn_connections")
	if err != nil {
		return EncryptedVPNConnection{}, fmt.Errorf("list occupied VPN connection slots: %w", err)
	}
	for rows.Next() {
		var slot int
		if err := rows.Scan(&slot); err != nil {
			_ = rows.Close()

			return EncryptedVPNConnection{}, fmt.Errorf("read occupied VPN connection slot: %w", err)
		}
		slots[slot] = struct{}{}
	}
	if err := rows.Close(); err != nil {
		return EncryptedVPNConnection{}, fmt.Errorf("close occupied VPN connection slots: %w", err)
	}
	if err := rows.Err(); err != nil {
		return EncryptedVPNConnection{}, fmt.Errorf("iterate occupied VPN connection slots: %w", err)
	}

	if requestedSlot != nil {
		if _, occupied := slots[*requestedSlot]; occupied {
			return EncryptedVPNConnection{}, ErrVPNConnectionLimit
		}
		connection.Slot = *requestedSlot
	} else {
		connection.Slot = -1
		for slot := 0; slot < maximumVPNConnections; slot++ {
			if _, occupied := slots[slot]; !occupied {
				connection.Slot = slot

				break
			}
		}
	}
	if connection.Slot < 0 {
		return EncryptedVPNConnection{}, ErrVPNConnectionLimit
	}
	connection.IsDefault = count == 0

	if err := verifyVPNConnectionProfiles(ctx, transaction, connection); err != nil {
		return EncryptedVPNConnection{}, err
	}

	dnsJSON, err := json.Marshal(connection.DNSServers)
	if err != nil {
		return EncryptedVPNConnection{}, fmt.Errorf("encode VPN connection DNS servers: %w", err)
	}
	now := time.Now().UTC()
	connection.Revision = 1
	connection.CreatedAt = now
	connection.UpdatedAt = now
	if _, err := transaction.ExecContext(
		ctx,
		`INSERT INTO vpn_connections (
		   id, slot, name, is_default, enabled, provider_id, tunnel,
		   endpoint_strategy, credentials_nonce, credentials_ciphertext,
		   credentials_legacy_profile_id, dns_servers_json,
		   retry_interval_seconds, peer_port, revision, created_at, updated_at
		 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 1, ?, ?)`,
		connection.ID,
		connection.Slot,
		connection.Name,
		boolInteger(connection.IsDefault),
		boolInteger(connection.Enabled),
		connection.ProviderID,
		connection.Tunnel,
		connection.EndpointStrategy,
		nullableBytes(connection.CredentialsNonce),
		nullableBytes(connection.CredentialsCiphertext),
		string(dnsJSON),
		connection.RetryIntervalSeconds,
		connection.PeerPort,
		formatTime(now),
		formatTime(now),
	); err != nil {
		return EncryptedVPNConnection{}, fmt.Errorf("create VPN connection: %w", err)
	}

	if err := replaceVPNConnectionEndpoints(ctx, transaction, connection.ID, connection.ProfileIDs); err != nil {
		return EncryptedVPNConnection{}, err
	}
	if _, err := transaction.ExecContext(ctx, "DELETE FROM removed_secrets WHERE kind = 'vpn'"); err != nil {
		return EncryptedVPNConnection{}, fmt.Errorf("clear removed VPN notice: %w", err)
	}

	if err := transaction.Commit(); err != nil {
		return EncryptedVPNConnection{}, fmt.Errorf("commit VPN connection creation: %w", err)
	}

	return connection, nil
}

// UpdateVPNConnection replaces one connection at an expected row revision.
//
// Name, peer port, endpoint policy, endpoints, and sealed credentials move together so
// a tested controller candidate can never be mixed with stale persisted fields.
//
// Since: UNRELEASED
func (store *Store) UpdateVPNConnection(
	ctx context.Context,
	connectionID string,
	expectedRevision int64,
	connection EncryptedVPNConnection,
) (int64, error) {
	connection.ID = connectionID
	connection, err := normalizeVPNConnection(connection)
	if err != nil {
		return 0, err
	}
	if !validVPNConnectionID(connectionID) {
		return 0, errors.New("VPN connection identifier is invalid")
	}

	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return 0, fmt.Errorf("begin VPN connection update: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	var currentRevision int64
	if err := transaction.QueryRowContext(
		ctx,
		"SELECT revision FROM vpn_connections WHERE id = ?",
		connectionID,
	).Scan(&currentRevision); errors.Is(err, sql.ErrNoRows) {
		return 0, ErrNotFound
	} else if err != nil {
		return 0, fmt.Errorf("read VPN connection revision: %w", err)
	}
	if currentRevision != expectedRevision {
		return 0, ErrRevisionConflict
	}

	if err := checkVPNConnectionName(ctx, transaction, connection.Name, connectionID); err != nil {
		return 0, err
	}
	if err := verifyVPNConnectionProfiles(ctx, transaction, connection); err != nil {
		return 0, err
	}

	dnsJSON, err := json.Marshal(connection.DNSServers)
	if err != nil {
		return 0, fmt.Errorf("encode VPN connection DNS servers: %w", err)
	}
	newRevision := currentRevision + 1
	if _, err := transaction.ExecContext(
		ctx,
		`UPDATE vpn_connections
		 SET name = ?, enabled = ?, provider_id = ?, tunnel = ?,
		     endpoint_strategy = ?, credentials_nonce = ?,
		     credentials_ciphertext = ?, credentials_legacy_profile_id = NULL,
		     dns_servers_json = ?, retry_interval_seconds = ?, peer_port = ?,
		     revision = ?, updated_at = ?
		 WHERE id = ?`,
		connection.Name,
		boolInteger(connection.Enabled),
		connection.ProviderID,
		connection.Tunnel,
		connection.EndpointStrategy,
		nullableBytes(connection.CredentialsNonce),
		nullableBytes(connection.CredentialsCiphertext),
		string(dnsJSON),
		connection.RetryIntervalSeconds,
		connection.PeerPort,
		newRevision,
		formatTime(time.Now()),
		connectionID,
	); err != nil {
		return 0, fmt.Errorf("update VPN connection: %w", err)
	}

	if _, err := transaction.ExecContext(
		ctx,
		"DELETE FROM vpn_connection_endpoints WHERE connection_id = ?",
		connectionID,
	); err != nil {
		return 0, fmt.Errorf("replace VPN connection endpoints: %w", err)
	}
	if err := replaceVPNConnectionEndpoints(ctx, transaction, connectionID, connection.ProfileIDs); err != nil {
		return 0, err
	}
	if _, err := transaction.ExecContext(ctx, "DELETE FROM removed_secrets WHERE kind = 'vpn'"); err != nil {
		return 0, fmt.Errorf("clear removed VPN notice: %w", err)
	}

	if err := transaction.Commit(); err != nil {
		return 0, fmt.Errorf("commit VPN connection update: %w", err)
	}

	return newRevision, nil
}

// SetVPNConnectionEnabled changes automatic reconnect behavior without editing config.
//
// Disconnect and reconnect routes do not require a configuration form revision, so
// this flag intentionally leaves the row revision unchanged.
//
// Since: UNRELEASED
func (store *Store) SetVPNConnectionEnabled(
	ctx context.Context,
	connectionID string,
	enabled bool,
) error {
	result, err := store.databaseHandle().ExecContext(
		ctx,
		"UPDATE vpn_connections SET enabled = ?, updated_at = ? WHERE id = ?",
		boolInteger(enabled),
		formatTime(time.Now()),
		connectionID,
	)
	if err != nil {
		return fmt.Errorf("update VPN connection enabled state: %w", err)
	}

	affectedRows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("inspect VPN connection enabled update: %w", err)
	}
	if affectedRows == 0 {
		return ErrNotFound
	}

	return nil
}

// SetDefaultVPNConnection moves the default flag atomically.
//
// Clearing the old flag and setting the new one happen in one transaction, so readers
// observe either complete default selection and the partial unique index stays valid.
//
// Since: UNRELEASED
func (store *Store) SetDefaultVPNConnection(ctx context.Context, connectionID string) error {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin default VPN connection update: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	var exists int
	if err := transaction.QueryRowContext(
		ctx,
		"SELECT COUNT(*) FROM vpn_connections WHERE id = ?",
		connectionID,
	).Scan(&exists); err != nil {
		return fmt.Errorf("find default VPN connection: %w", err)
	}
	if exists == 0 {
		return ErrNotFound
	}

	if _, err := transaction.ExecContext(ctx, "UPDATE vpn_connections SET is_default = 0 WHERE is_default = 1"); err != nil {
		return fmt.Errorf("clear default VPN connection: %w", err)
	}
	if _, err := transaction.ExecContext(
		ctx,
		"UPDATE vpn_connections SET is_default = 1, updated_at = ? WHERE id = ?",
		formatTime(time.Now()),
		connectionID,
	); err != nil {
		return fmt.Errorf("set default VPN connection: %w", err)
	}

	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit default VPN connection update: %w", err)
	}

	return nil
}

// DeleteVPNConnection removes a non-default connection after callers check dependents.
//
// The API moves torrents and reassigns references explicitly before calling this
// method; storage never silently reroutes them.
//
// Since: UNRELEASED
func (store *Store) DeleteVPNConnection(ctx context.Context, connectionID string) error {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin VPN connection deletion: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	var isDefault int
	if err := transaction.QueryRowContext(
		ctx,
		"SELECT is_default FROM vpn_connections WHERE id = ?",
		connectionID,
	).Scan(&isDefault); errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	} else if err != nil {
		return fmt.Errorf("read VPN connection before deletion: %w", err)
	}
	if isDefault == 1 {
		return ErrDefaultVPNConnection
	}

	if _, err := transaction.ExecContext(
		ctx,
		"DELETE FROM vpn_connections WHERE id = ?",
		connectionID,
	); err != nil {
		return fmt.Errorf("delete VPN connection: %w", err)
	}

	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit VPN connection deletion: %w", err)
	}

	return nil
}

// ReassignVPNConnectionDependents moves profile and proxy-login references together.
//
// A nil target stores the dynamic default selection. Connection removal stages this
// reassignment before draining the daemon, then repeats it in the delete transaction.
//
// Since: UNRELEASED
func (store *Store) ReassignVPNConnectionDependents(
	ctx context.Context,
	sourceConnectionID string,
	targetConnectionID *string,
) (int, int, error) {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return 0, 0, fmt.Errorf("begin VPN dependent reassignment: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	if err := verifyOptionalVPNConnectionReference(
		ctx,
		transaction,
		targetConnectionID,
	); err != nil {
		if errors.Is(err, ErrVPNConnectionReference) {
			return 0, 0, ErrNotFound
		}

		return 0, 0, err
	}

	profileCount, loginCount, err := reassignVPNConnectionDependents(
		ctx,
		transaction,
		sourceConnectionID,
		targetConnectionID,
	)
	if err != nil {
		return 0, 0, err
	}

	if err := transaction.Commit(); err != nil {
		return 0, 0, fmt.Errorf("commit VPN dependent reassignment: %w", err)
	}

	return profileCount, loginCount, nil
}

func reassignVPNConnectionDependents(
	ctx context.Context,
	transaction *sql.Tx,
	sourceConnectionID string,
	targetConnectionID *string,
) (int, int, error) {
	now := formatTime(time.Now())
	profileResult, err := transaction.ExecContext(
		ctx,
		"UPDATE torrent_profiles SET connection_id = ?, updated_at = ? WHERE connection_id = ?",
		optionalString(targetConnectionID),
		now,
		sourceConnectionID,
	)
	if err != nil {
		return 0, 0, fmt.Errorf("reassign torrent profile connections: %w", err)
	}
	profileCount, err := profileResult.RowsAffected()
	if err != nil {
		return 0, 0, fmt.Errorf("inspect torrent profile reassignment: %w", err)
	}

	loginResult, err := transaction.ExecContext(
		ctx,
		"UPDATE web_proxy_logins SET connection_id = ?, updated_at = ? WHERE connection_id = ?",
		optionalString(targetConnectionID),
		now,
		sourceConnectionID,
	)
	if err != nil {
		return 0, 0, fmt.Errorf("reassign web proxy login connections: %w", err)
	}
	loginCount, err := loginResult.RowsAffected()
	if err != nil {
		return 0, 0, fmt.Errorf("inspect web proxy login reassignment: %w", err)
	}

	return int(profileCount), int(loginCount), nil
}

// DeleteVPNConnectionAndReassignDependents removes a connection and catches late references.
//
// Connection deletion uses this after daemon-owned torrents have moved. Repeating
// the dependent reassignment in the delete transaction closes the final save race.
//
// Since: UNRELEASED
func (store *Store) DeleteVPNConnectionAndReassignDependents(
	ctx context.Context,
	sourceConnectionID string,
	targetConnectionID *string,
) (int, int, error) {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return 0, 0, fmt.Errorf("begin VPN connection deletion with reassignment: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	var isDefault int
	if err := transaction.QueryRowContext(
		ctx,
		"SELECT is_default FROM vpn_connections WHERE id = ?",
		sourceConnectionID,
	).Scan(&isDefault); errors.Is(err, sql.ErrNoRows) {
		return 0, 0, ErrNotFound
	} else if err != nil {
		return 0, 0, fmt.Errorf("read VPN connection before deletion: %w", err)
	}
	if isDefault == 1 {
		return 0, 0, ErrDefaultVPNConnection
	}
	if err := verifyOptionalVPNConnectionReference(
		ctx,
		transaction,
		targetConnectionID,
	); err != nil {
		return 0, 0, err
	}

	profileCount, loginCount, err := reassignVPNConnectionDependents(
		ctx,
		transaction,
		sourceConnectionID,
		targetConnectionID,
	)
	if err != nil {
		return 0, 0, err
	}
	if _, err := transaction.ExecContext(
		ctx,
		"DELETE FROM vpn_connections WHERE id = ?",
		sourceConnectionID,
	); err != nil {
		return 0, 0, fmt.Errorf("delete VPN connection: %w", err)
	}

	if err := transaction.Commit(); err != nil {
		return 0, 0, fmt.Errorf("commit VPN connection deletion with reassignment: %w", err)
	}

	return profileCount, loginCount, nil
}

// ResealLegacyVPNCredentials moves migrated credentials to connection associated data.
//
// A callback keeps cryptography outside storage. Authentication failures clear only the
// affected credentials, disable that row, and create the existing VPN secret notice.
//
// Since: UNRELEASED
func (store *Store) ResealLegacyVPNCredentials(
	ctx context.Context,
	reseal func(string, string, []byte, []byte) ([]byte, []byte, error),
) error {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin legacy VPN credential resealing: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()

	type legacyCredentials struct {
		ConnectionID string
		ProfileID    string
		Nonce        []byte
		Ciphertext   []byte
	}

	rows, err := transaction.QueryContext(
		ctx,
		`SELECT id, credentials_legacy_profile_id, credentials_nonce,
		        credentials_ciphertext
		 FROM vpn_connections
		 WHERE credentials_legacy_profile_id IS NOT NULL
		 ORDER BY slot`,
	)
	if err != nil {
		return fmt.Errorf("list legacy VPN credentials: %w", err)
	}
	legacyRows := []legacyCredentials{}
	for rows.Next() {
		var credentials legacyCredentials
		if err := rows.Scan(
			&credentials.ConnectionID,
			&credentials.ProfileID,
			&credentials.Nonce,
			&credentials.Ciphertext,
		); err != nil {
			_ = rows.Close()

			return fmt.Errorf("read legacy VPN credentials: %w", err)
		}
		legacyRows = append(legacyRows, credentials)
	}
	if err := rows.Close(); err != nil {
		return fmt.Errorf("close legacy VPN credentials: %w", err)
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate legacy VPN credentials: %w", err)
	}

	removed := false
	for _, credentials := range legacyRows {
		nonce, ciphertext, resealError := reseal(
			credentials.ConnectionID,
			credentials.ProfileID,
			credentials.Nonce,
			credentials.Ciphertext,
		)
		if resealError != nil || len(nonce) == 0 || len(ciphertext) == 0 {
			if _, err := transaction.ExecContext(
				ctx,
				`UPDATE vpn_connections
				 SET enabled = 0, credentials_nonce = NULL,
				     credentials_ciphertext = NULL,
				     credentials_legacy_profile_id = NULL, updated_at = ?
				 WHERE id = ?`,
				formatTime(time.Now()),
				credentials.ConnectionID,
			); err != nil {
				return fmt.Errorf("clear unreadable VPN credentials: %w", err)
			}
			removed = true

			continue
		}

		if _, err := transaction.ExecContext(
			ctx,
			`UPDATE vpn_connections
			 SET credentials_nonce = ?, credentials_ciphertext = ?,
			     credentials_legacy_profile_id = NULL
			 WHERE id = ?`,
			nonce,
			ciphertext,
			credentials.ConnectionID,
		); err != nil {
			return fmt.Errorf("store resealed VPN credentials: %w", err)
		}
	}

	if removed {
		if _, err := transaction.ExecContext(ctx, "DELETE FROM removed_secrets WHERE kind = 'vpn'"); err != nil {
			return fmt.Errorf("replace removed VPN notice: %w", err)
		}
		if _, err := transaction.ExecContext(
			ctx,
			"INSERT INTO removed_secrets (kind, administrator_id, removed_at) VALUES ('vpn', NULL, ?)",
			formatTime(time.Now()),
		); err != nil {
			return fmt.Errorf("record unreadable VPN credentials: %w", err)
		}
	}

	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit legacy VPN credential resealing: %w", err)
	}

	return nil
}

func readVPNConnection(
	ctx context.Context,
	querySource queryInterface,
	query string,
	arguments ...any,
) (EncryptedVPNConnection, error) {
	connection, err := scanVPNConnection(querySource.QueryRowContext(ctx, query, arguments...))
	if errors.Is(err, sql.ErrNoRows) {
		return EncryptedVPNConnection{}, ErrNotFound
	}
	if err != nil {
		return EncryptedVPNConnection{}, err
	}

	connection.ProfileIDs, err = readVPNConnectionEndpoints(ctx, querySource, connection.ID)
	if err != nil {
		return EncryptedVPNConnection{}, err
	}

	return connection, nil
}

func scanVPNConnection(scanner rowScanner) (EncryptedVPNConnection, error) {
	var connection EncryptedVPNConnection
	var isDefault int
	var enabled int
	var legacyProfileID sql.NullString
	var dnsJSON string
	var createdAtText string
	var updatedAtText string
	if err := scanner.Scan(
		&connection.ID,
		&connection.Slot,
		&connection.Name,
		&isDefault,
		&enabled,
		&connection.ProviderID,
		&connection.Tunnel,
		&connection.EndpointStrategy,
		&connection.CredentialsNonce,
		&connection.CredentialsCiphertext,
		&legacyProfileID,
		&dnsJSON,
		&connection.RetryIntervalSeconds,
		&connection.PeerPort,
		&connection.Revision,
		&createdAtText,
		&updatedAtText,
	); err != nil {
		return EncryptedVPNConnection{}, err
	}

	connection.IsDefault = isDefault == 1
	connection.Enabled = enabled == 1
	if legacyProfileID.Valid {
		connection.CredentialsLegacyProfileID = legacyProfileID.String
	}
	if err := json.Unmarshal([]byte(dnsJSON), &connection.DNSServers); err != nil {
		return EncryptedVPNConnection{}, fmt.Errorf("decode VPN connection DNS servers: %w", err)
	}
	if connection.DNSServers == nil {
		connection.DNSServers = []string{}
	}

	createdAt, err := parseTime(createdAtText)
	if err != nil {
		return EncryptedVPNConnection{}, err
	}
	connection.CreatedAt = createdAt
	updatedAt, err := parseTime(updatedAtText)
	if err != nil {
		return EncryptedVPNConnection{}, err
	}
	connection.UpdatedAt = updatedAt

	return connection, nil
}

func readVPNConnectionEndpoints(
	ctx context.Context,
	querySource queryInterface,
	connectionID string,
) ([]string, error) {
	rows, err := querySource.QueryContext(
		ctx,
		`SELECT profile_id FROM vpn_connection_endpoints
		 WHERE connection_id = ?
		 ORDER BY position`,
		connectionID,
	)
	if err != nil {
		return nil, fmt.Errorf("read VPN connection endpoints: %w", err)
	}
	defer rows.Close()

	profileIDs := []string{}
	for rows.Next() {
		var profileID string
		if err := rows.Scan(&profileID); err != nil {
			return nil, fmt.Errorf("scan VPN connection endpoint: %w", err)
		}
		profileIDs = append(profileIDs, profileID)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate VPN connection endpoints: %w", err)
	}

	return profileIDs, nil
}

func normalizeVPNConnection(
	connection EncryptedVPNConnection,
) (EncryptedVPNConnection, error) {
	nameLength := utf8.RuneCountInString(connection.Name)
	if nameLength < 1 || nameLength > 64 || strings.TrimSpace(connection.Name) != connection.Name {
		return EncryptedVPNConnection{}, errors.New("VPN connection name must contain between 1 and 64 trimmed characters")
	}
	if connection.ProviderID == "" {
		return EncryptedVPNConnection{}, errors.New("VPN connection provider is required")
	}
	if !validVPNTunnel(connection.Tunnel) {
		return EncryptedVPNConnection{}, errors.New("VPN connection has an unsupported tunnel")
	}
	if connection.EndpointStrategy != "sticky" && connection.EndpointStrategy != "ordered" &&
		connection.EndpointStrategy != "randomized" {
		return EncryptedVPNConnection{}, errors.New("VPN connection has an unsupported endpoint strategy")
	}
	if len(connection.ProfileIDs) < 1 || len(connection.ProfileIDs) > 128 {
		return EncryptedVPNConnection{}, errors.New("VPN connection requires between 1 and 128 endpoints")
	}

	seenProfileIDs := make(map[string]struct{}, len(connection.ProfileIDs))
	for _, profileID := range connection.ProfileIDs {
		if !validVPNProfileIdentifier(profileID) {
			return EncryptedVPNConnection{}, errors.New("VPN connection endpoint identifier is invalid")
		}
		if _, duplicate := seenProfileIDs[profileID]; duplicate {
			return EncryptedVPNConnection{}, errors.New("VPN connection endpoint pool contains duplicates")
		}
		seenProfileIDs[profileID] = struct{}{}
	}

	if len(connection.DNSServers) > 8 {
		return EncryptedVPNConnection{}, errors.New("VPN connection supports no more than 8 DNS servers")
	}
	for _, serverAddress := range connection.DNSServers {
		address, err := netip.ParseAddr(serverAddress)
		if err != nil || !address.Is4() {
			return EncryptedVPNConnection{}, fmt.Errorf("VPN DNS server is not an IPv4 address: %s", serverAddress)
		}
	}
	if connection.DNSServers == nil {
		connection.DNSServers = []string{}
	}
	if connection.RetryIntervalSeconds < 3 || connection.RetryIntervalSeconds > 600 {
		return EncryptedVPNConnection{}, errors.New("VPN retry interval must be between 3 and 600 seconds")
	}
	if connection.PeerPort < 1024 || connection.PeerPort > 65535 {
		return EncryptedVPNConnection{}, errors.New("VPN connection peer port must be between 1024 and 65535")
	}
	if (len(connection.CredentialsNonce) == 0) != (len(connection.CredentialsCiphertext) == 0) {
		return EncryptedVPNConnection{}, errors.New("VPN connection sealed credentials are incomplete")
	}

	return connection, nil
}

func checkVPNConnectionName(
	ctx context.Context,
	querySource queryInterface,
	name string,
	connectionID string,
) error {
	var exists int
	if err := querySource.QueryRowContext(
		ctx,
		"SELECT COUNT(*) FROM vpn_connections WHERE name = ? COLLATE NOCASE AND id <> ?",
		name,
		connectionID,
	).Scan(&exists); err != nil {
		return fmt.Errorf("check VPN connection name: %w", err)
	}
	if exists > 0 {
		return ErrVPNConnectionNameTaken
	}

	return nil
}

func verifyOptionalVPNConnectionReference(
	ctx context.Context,
	querySource queryInterface,
	connectionID *string,
) error {
	if connectionID == nil {
		return nil
	}

	var exists int
	if err := querySource.QueryRowContext(
		ctx,
		"SELECT COUNT(*) FROM vpn_connections WHERE id = ?",
		*connectionID,
	).Scan(&exists); err != nil {
		return fmt.Errorf("verify VPN connection reference: %w", err)
	}
	if exists == 0 {
		return ErrVPNConnectionReference
	}

	return nil
}

func verifyVPNConnectionProfiles(
	ctx context.Context,
	querySource queryInterface,
	connection EncryptedVPNConnection,
) error {
	for _, profileID := range connection.ProfileIDs {
		var providerID string
		var tunnel string
		if err := querySource.QueryRowContext(
			ctx,
			"SELECT provider_id, tunnel FROM vpn_profiles WHERE id = ?",
			profileID,
		).Scan(&providerID, &tunnel); errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		} else if err != nil {
			return fmt.Errorf("verify VPN connection endpoint: %w", err)
		}
		if providerID != connection.ProviderID {
			return errors.New("VPN connection endpoint does not belong to the provider")
		}
		if tunnel != connection.Tunnel {
			return errors.New("VPN connection endpoint does not belong to the tunnel")
		}
	}

	return nil
}

func replaceVPNConnectionEndpoints(
	ctx context.Context,
	executionTarget executionInterface,
	connectionID string,
	profileIDs []string,
) error {
	for position, profileID := range profileIDs {
		if _, err := executionTarget.ExecContext(
			ctx,
			`INSERT INTO vpn_connection_endpoints (connection_id, position, profile_id)
			 VALUES (?, ?, ?)`,
			connectionID,
			position,
			profileID,
		); err != nil {
			return fmt.Errorf("store VPN connection endpoint pool: %w", err)
		}
	}

	return nil
}

func validVPNConnectionID(value string) bool {
	if len(value) != 20 || !strings.HasPrefix(value, "vpc-") || strings.ToLower(value) != value {
		return false
	}

	decoded, err := hex.DecodeString(strings.TrimPrefix(value, "vpc-"))

	return err == nil && len(decoded) == 8
}

func validVPNProfileIdentifier(value string) bool {
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

func boolInteger(value bool) int {
	if value {
		return 1
	}

	return 0
}

func nullableBytes(value []byte) any {
	if len(value) == 0 {
		return nil
	}

	return value
}
