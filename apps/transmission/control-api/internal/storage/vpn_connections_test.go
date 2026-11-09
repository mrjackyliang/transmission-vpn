package storage

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"path/filepath"
	"slices"
	"testing"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
)

// TestVPNConnectionsMigrationMovesTheActiveConfiguration upgrades a populated v12 store.
//
// The singleton becomes the slot-zero default without changing endpoint order or
// ciphertext, while settings that moved onto the connection disappear everywhere.
func TestVPNConnectionsMigrationMovesTheActiveConfiguration(testingObject *testing.T) {
	ctx := context.Background()
	store := openVersion12Store(testingObject)
	defer store.Close()

	now := formatTime(time.Now())
	firstProfileID := "pia:us-east-udp:111111111111"
	secondProfileID := "pia:us-west-udp:222222222222"
	for _, profileID := range []string{firstProfileID, secondProfileID} {
		if _, err := store.databaseHandle().ExecContext(
			ctx,
			`INSERT INTO vpn_profiles (
			   id, provider_id, tunnel, display_name, country_code, country_name,
			   city, continent, protocol, remote_host, remote_port, fingerprint,
			   source, current, nonce, ciphertext, created_at, updated_at
			 ) VALUES (?, 'pia', 'openvpn', ?, 'US', 'United States', '',
			   'North America', 'udp', 'vpn.example.test', 1198, ?,
			   'official-catalog', 1, x'01', x'02', ?, ?)`,
			profileID,
			profileID,
			profileID,
			now,
			now,
		); err != nil {
			testingObject.Fatalf("seed VPN profile %s: %v", profileID, err)
		}
	}

	key := bytes.Repeat([]byte{0x42}, 32)
	nonce, ciphertext, err := security.EncryptSecret(
		key,
		"vpn/configuration/"+firstProfileID,
		[]byte(`{"username":"alice","password":"secret"}`),
	)
	if err != nil {
		testingObject.Fatalf("seal legacy credentials: %v", err)
	}
	if _, err := store.databaseHandle().ExecContext(
		ctx,
		`INSERT INTO vpn_active_configuration (
		   id, enabled, provider_id, profile_id, credentials_nonce,
		   credentials_ciphertext, dns_servers_json, retry_interval_seconds,
		   updated_at, endpoint_strategy, tunnel
		 ) VALUES (1, 1, 'pia', ?, ?, ?, '["9.9.9.9","2001:db8::53","1.1.1.1"]', 17, ?, 'ordered', 'openvpn')`,
		firstProfileID,
		nonce,
		ciphertext,
		now,
	); err != nil {
		testingObject.Fatalf("seed active configuration: %v", err)
	}
	for position, profileID := range []string{firstProfileID, secondProfileID} {
		if _, err := store.databaseHandle().ExecContext(
			ctx,
			"INSERT INTO vpn_active_endpoints (configuration_id, position, profile_id) VALUES (1, ?, ?)",
			position,
			profileID,
		); err != nil {
			testingObject.Fatalf("seed active endpoint: %v", err)
		}
	}

	retiredValues := map[string]string{
		"vpn.provider":             `"pia"`,
		"vpn.tunnel":               `"openvpn"`,
		"vpn.endpointStrategy":     `"ordered"`,
		"vpn.endpointIdentifiers":  `[]`,
		"vpn.retryIntervalSeconds": `17`,
		"vpn.dnsMode":              `"custom"`,
		"vpn.customDNSServers":     `["9.9.9.9"]`,
		"transmission.peerPort":    `42370`,
	}
	for key, value := range retiredValues {
		if _, err := store.databaseHandle().ExecContext(
			ctx,
			`INSERT INTO settings (key, value_json, source, locked, revision, updated_at)
			 VALUES (?, ?, 'user', 0, 1, ?)`,
			key,
			value,
			now,
		); err != nil {
			testingObject.Fatalf("seed retired setting %s: %v", key, err)
		}
		managedValue := value
		if key == "transmission.peerPort" {
			managedValue = `43123`
		}
		if _, err := store.databaseHandle().ExecContext(
			ctx,
			`INSERT INTO managed_settings (key, mode, value_json, applied_at)
			 VALUES (?, 'lock', ?, ?)`,
			key,
			managedValue,
			now,
		); err != nil {
			testingObject.Fatalf("seed retired managed setting %s: %v", key, err)
		}
	}
	if _, err := store.databaseHandle().ExecContext(
		ctx,
		`INSERT INTO configuration_revisions (revision, actor, changes_json, created_at)
		 VALUES (1, 'test', '{"vpn.provider":{"after":"pia"}}', ?)`,
		now,
	); err != nil {
		testingObject.Fatalf("seed retired setting history: %v", err)
	}
	if _, err := store.databaseHandle().ExecContext(
		ctx,
		`INSERT INTO configuration_revisions (revision, actor, changes_json, created_at)
		 VALUES (2, 'test', '{"transmission.downloadQueueSize":{"after":7},"transmission.peerPort":{"after":42370}}', ?)`,
		now,
	); err != nil {
		testingObject.Fatalf("seed mixed setting history: %v", err)
	}

	if err := store.applyMigration(ctx, "013_vpn_connections.sql"); err != nil {
		testingObject.Fatalf("apply migration 13: %v", err)
	}

	connection, err := store.DefaultVPNConnection(ctx)
	if err != nil {
		testingObject.Fatalf("read migrated connection: %v", err)
	}
	if connection.Slot != 0 || !connection.IsDefault || !connection.Enabled ||
		connection.Name != "Private Internet Access" || connection.ProviderID != "pia" ||
		connection.Tunnel != "openvpn" || connection.EndpointStrategy != "ordered" ||
		connection.RetryIntervalSeconds != 17 || connection.PeerPort != 43123 ||
		connection.Revision != 1 || connection.CredentialsLegacyProfileID != firstProfileID {
		testingObject.Fatalf("migrated connection = %+v", connection)
	}
	if len(connection.ProfileIDs) != 2 || connection.ProfileIDs[0] != firstProfileID ||
		connection.ProfileIDs[1] != secondProfileID {
		testingObject.Fatalf("migrated endpoint pool = %v", connection.ProfileIDs)
	}
	if !bytes.Equal(connection.CredentialsNonce, nonce) ||
		!bytes.Equal(connection.CredentialsCiphertext, ciphertext) {
		testingObject.Fatal("migration changed sealed credentials")
	}
	if !slices.Equal(connection.DNSServers, []string{"9.9.9.9", "1.1.1.1"}) {
		testingObject.Fatalf("migrated DNS servers = %v", connection.DNSServers)
	}

	for _, table := range []string{"vpn_active_configuration", "vpn_active_endpoints"} {
		var count int
		if err := store.databaseHandle().QueryRowContext(
			ctx,
			"SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?",
			table,
		).Scan(&count); err != nil || count != 0 {
			testingObject.Fatalf("retired table %s count = %d, %v", table, count, err)
		}
	}
	for _, index := range []string{
		"vpn_connections_default_unique_index",
		"vpn_connection_endpoints_profile_index",
		"torrent_profiles_connection_index",
		"web_proxy_logins_connection_index",
	} {
		var count int
		if err := store.databaseHandle().QueryRowContext(
			ctx,
			"SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = ?",
			index,
		).Scan(&count); err != nil || count != 1 {
			testingObject.Fatalf("migration index %s count = %d, %v", index, count, err)
		}
	}
	for _, table := range []string{"settings", "managed_settings"} {
		var count int
		if err := store.databaseHandle().QueryRowContext(
			ctx,
			"SELECT COUNT(*) FROM "+table,
		).Scan(&count); err != nil || count != 0 {
			testingObject.Fatalf("retired rows in %s = %d, %v", table, count, err)
		}
	}
	var historyJSON string
	if err := store.databaseHandle().QueryRowContext(
		ctx,
		"SELECT changes_json FROM configuration_revisions",
	).Scan(&historyJSON); err != nil {
		testingObject.Fatalf("read preserved setting history: %v", err)
	}
	var history map[string]json.RawMessage
	if err := json.Unmarshal([]byte(historyJSON), &history); err != nil {
		testingObject.Fatalf("decode preserved setting history: %v", err)
	}
	if len(history) != 1 || history["transmission.downloadQueueSize"] == nil {
		testingObject.Fatalf("preserved setting history = %s", historyJSON)
	}
}

// TestVPNConnectionsMigrationHandlesAnUnconfiguredStore upgrades an empty v12 store.
func TestVPNConnectionsMigrationHandlesAnUnconfiguredStore(testingObject *testing.T) {
	ctx := context.Background()
	store := openVersion12Store(testingObject)
	defer store.Close()

	if err := store.applyMigration(ctx, "013_vpn_connections.sql"); err != nil {
		testingObject.Fatalf("apply migration 13: %v", err)
	}
	if connections, err := store.ListVPNConnections(ctx); err != nil || len(connections) != 0 {
		testingObject.Fatalf("migrated connections = %+v, %v", connections, err)
	}
	if _, err := store.DefaultVPNConnection(ctx); !errors.Is(err, ErrNotFound) {
		testingObject.Fatalf("empty default error = %v", err)
	}
}

// TestVPNConnectionsMigrationUsesProviderDNSWhenOnlyIPv6WasSaved checks an empty result.
//
// Connections accept IPv4 DNS servers only after migration 13, so an old all-IPv6
// custom list becomes the empty list that selects the provider's DNS servers.
func TestVPNConnectionsMigrationUsesProviderDNSWhenOnlyIPv6WasSaved(testingObject *testing.T) {
	ctx := context.Background()
	store := openVersion12Store(testingObject)
	defer store.Close()

	now := formatTime(time.Now())
	const profileID = "custom:ipv6-only:333333333333"
	if _, err := store.databaseHandle().ExecContext(
		ctx,
		`INSERT INTO vpn_profiles (
		   id, provider_id, tunnel, display_name, country_code, country_name,
		   city, continent, protocol, remote_host, remote_port, fingerprint,
		   source, current, nonce, ciphertext, created_at, updated_at
		 ) VALUES (?, 'custom', 'openvpn', 'IPv6 only', '', '', '', '', 'udp',
		   'vpn.example.test', 1194, ?, 'upload', 1, x'01', x'02', ?, ?)`,
		profileID,
		profileID,
		now,
		now,
	); err != nil {
		testingObject.Fatalf("seed VPN profile: %v", err)
	}
	if _, err := store.databaseHandle().ExecContext(
		ctx,
		`INSERT INTO vpn_active_configuration (
		   id, enabled, provider_id, profile_id, credentials_nonce,
		   credentials_ciphertext, dns_servers_json, retry_interval_seconds,
		   updated_at, endpoint_strategy, tunnel
		 ) VALUES (1, 1, 'custom', ?, x'03', x'04',
		   '["2001:db8::53","fd00::53"]', 10, ?, 'sticky', 'openvpn')`,
		profileID,
		now,
	); err != nil {
		testingObject.Fatalf("seed active configuration: %v", err)
	}

	if err := store.applyMigration(ctx, "013_vpn_connections.sql"); err != nil {
		testingObject.Fatalf("apply migration 13: %v", err)
	}
	connection, err := store.DefaultVPNConnection(ctx)
	if err != nil {
		testingObject.Fatalf("read migrated connection: %v", err)
	}
	if len(connection.DNSServers) != 0 {
		testingObject.Fatalf("migrated DNS servers = %v", connection.DNSServers)
	}
}

// TestDeleteVPNConnectionLeavesDependentsForExplicitMoves rejects the default and
// never silently reroutes references that the API must check or move first.
func TestDeleteVPNConnectionLeavesDependentsForExplicitMoves(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	profile := storeTestVPNProfile(testingObject, store)
	first, err := store.CreateVPNConnection(ctx, testVPNConnection("Default", profile.ID))
	if err != nil {
		testingObject.Fatalf("create default connection: %v", err)
	}
	second, err := store.CreateVPNConnection(ctx, testVPNConnection("Disposable", profile.ID))
	if err != nil {
		testingObject.Fatalf("create disposable connection: %v", err)
	}
	now := formatTime(time.Now())
	if _, err := store.databaseHandle().ExecContext(
		ctx,
		`INSERT INTO torrent_profiles (
		   id, name, download_directory, labels_json, start_paused,
		   options_json, match_patterns_json, connection_id, created_at, updated_at
		 ) VALUES ('profile-1', 'Profile 1', '/data/downloads', '[]', 0,
		   '{}', '[]', ?, ?, ?)`,
		second.ID,
		now,
		now,
	); err != nil {
		testingObject.Fatalf("seed torrent profile reference: %v", err)
	}
	if _, err := store.databaseHandle().ExecContext(
		ctx,
		`INSERT INTO web_proxy_logins (
		   id, username, password_hash, connection_id, created_at, updated_at
		 ) VALUES ('login-1', 'proxy-user', 'hash', ?, ?, ?)`,
		second.ID,
		now,
		now,
	); err != nil {
		testingObject.Fatalf("seed proxy login reference: %v", err)
	}

	if err := store.DeleteVPNConnection(ctx, first.ID); !errors.Is(err, ErrDefaultVPNConnection) {
		testingObject.Fatalf("delete default error = %v", err)
	}
	if err := store.DeleteVPNConnection(ctx, second.ID); err != nil {
		testingObject.Fatalf("delete non-default: %v", err)
	}
	for table, rowID := range map[string]string{
		"torrent_profiles": "profile-1",
		"web_proxy_logins": "login-1",
	} {
		var connectionID sql.NullString
		if err := store.databaseHandle().QueryRowContext(
			ctx,
			"SELECT connection_id FROM "+table+" WHERE id = ?",
			rowID,
		).Scan(&connectionID); err != nil || !connectionID.Valid || connectionID.String != second.ID {
			testingObject.Fatalf("%s connection reference = %+v, %v", table, connectionID, err)
		}
	}
}

// TestDeleteVPNConnectionAndReassignDependentsIsAtomic catches references saved
// after an earlier reassignment pass and removes no relationship with its target.
func TestDeleteVPNConnectionAndReassignDependentsIsAtomic(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	profile := storeTestVPNProfile(testingObject, store)
	defaultConnection, err := store.CreateVPNConnection(
		ctx,
		testVPNConnection("Default", profile.ID),
	)
	if err != nil {
		testingObject.Fatalf("create default connection: %v", err)
	}
	removedConnection, err := store.CreateVPNConnection(
		ctx,
		testVPNConnection("Removed", profile.ID),
	)
	if err != nil {
		testingObject.Fatalf("create removed connection: %v", err)
	}

	lateProfile := testTorrentProfile(
		"tpr-0000000000000088",
		"Late profile",
		"/data/late",
	)
	lateProfile.ConnectionID = &removedConnection.ID
	if _, err := store.CreateTorrentProfile(ctx, lateProfile); err != nil {
		testingObject.Fatalf("create late profile: %v", err)
	}
	if _, err := store.CreateWebProxyLogin(ctx, WebProxyLogin{
		ID:           "wpl-0000000000000088",
		Username:     "late-login",
		PasswordHash: "test-hash",
		ConnectionID: &removedConnection.ID,
	}); err != nil {
		testingObject.Fatalf("create late login: %v", err)
	}

	profiles, logins, err := store.DeleteVPNConnectionAndReassignDependents(
		ctx,
		removedConnection.ID,
		&defaultConnection.ID,
	)
	if err != nil || profiles != 1 || logins != 1 {
		testingObject.Fatalf("delete and reassign = %d, %d, %v", profiles, logins, err)
	}
	storedProfile, err := store.FindTorrentProfile(ctx, lateProfile.ID)
	if err != nil || storedProfile.ConnectionID == nil ||
		*storedProfile.ConnectionID != defaultConnection.ID {
		testingObject.Fatalf("late profile = %+v, %v", storedProfile, err)
	}
	_, storedLogins, err := store.WebProxyConfiguration(ctx)
	if err != nil || len(storedLogins) != 1 || storedLogins[0].ConnectionID == nil ||
		*storedLogins[0].ConnectionID != defaultConnection.ID {
		testingObject.Fatalf("late logins = %+v, %v", storedLogins, err)
	}
}

// TestReplaceInstallationKeyPreservesVPNConnectionRelationships keeps durable routing.
//
// Losing sealed material disables each connection and removes its endpoints, but its
// stable identity and dependent torrent profiles and proxy logins must survive.
func TestReplaceInstallationKeyPreservesVPNConnectionRelationships(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	profile := storeTestVPNProfile(testingObject, store)
	firstInput := testVPNConnection("Default preserved", profile.ID)
	firstInput.DNSServers = []string{"1.1.1.1"}
	firstInput.RetryIntervalSeconds = 23
	firstInput.PeerPort = 42001
	first, err := store.CreateVPNConnection(ctx, firstInput)
	if err != nil {
		testingObject.Fatalf("create first connection: %v", err)
	}
	secondInput := testVPNConnection("Second preserved", profile.ID)
	secondInput.DNSServers = []string{"9.9.9.9"}
	secondInput.RetryIntervalSeconds = 31
	secondInput.PeerPort = 42002
	second, err := store.CreateVPNConnection(ctx, secondInput)
	if err != nil {
		testingObject.Fatalf("create second connection: %v", err)
	}

	torrentProfileInput := testTorrentProfile(
		"tpr-0000000000000099",
		"Preserved route",
		"/data/preserved",
	)
	torrentProfileInput.ConnectionID = &second.ID
	if _, err := store.CreateTorrentProfile(ctx, torrentProfileInput); err != nil {
		testingObject.Fatalf("create dependent torrent profile: %v", err)
	}
	if _, err := store.CreateWebProxyLogin(ctx, WebProxyLogin{
		ID:           "wpl-0000000000000099",
		Username:     "preserved-proxy",
		PasswordHash: "saved-password-hash",
		ConnectionID: &first.ID,
	}); err != nil {
		testingObject.Fatalf("create dependent web proxy login: %v", err)
	}

	report, err := store.ReplaceInstallationKey(
		ctx,
		[]byte("replacement-check-nonce"),
		[]byte("replacement-check-ciphertext"),
	)
	if err != nil {
		testingObject.Fatalf("replace installation key: %v", err)
	}
	if !report.VPN {
		testingObject.Fatal("VPN details were not reported as removed")
	}

	connections, err := store.ListVPNConnections(ctx)
	if err != nil || len(connections) != 2 {
		testingObject.Fatalf("preserved connections = %+v, %v", connections, err)
	}
	wantConnections := []EncryptedVPNConnection{first, second}
	for index, connection := range connections {
		want := wantConnections[index]
		if connection.ID != want.ID || connection.Slot != want.Slot ||
			connection.Name != want.Name || connection.IsDefault != want.IsDefault ||
			connection.PeerPort != want.PeerPort ||
			!slices.Equal(connection.DNSServers, want.DNSServers) ||
			connection.RetryIntervalSeconds != want.RetryIntervalSeconds ||
			connection.Enabled || len(connection.ProfileIDs) != 0 ||
			len(connection.CredentialsNonce) != 0 ||
			len(connection.CredentialsCiphertext) != 0 {
			testingObject.Fatalf("preserved connection %d = %+v, want metadata from %+v", index, connection, want)
		}
	}

	storedTorrentProfile, err := store.FindTorrentProfile(ctx, torrentProfileInput.ID)
	if err != nil || storedTorrentProfile.ConnectionID == nil ||
		*storedTorrentProfile.ConnectionID != second.ID {
		testingObject.Fatalf("preserved torrent profile = %+v, %v", storedTorrentProfile, err)
	}
	_, logins, err := store.WebProxyConfiguration(ctx)
	if err != nil || len(logins) != 1 || logins[0].ConnectionID == nil ||
		*logins[0].ConnectionID != first.ID {
		testingObject.Fatalf("preserved web proxy logins = %+v, %v", logins, err)
	}
}

// TestResealLegacyVPNCredentials authenticates old AAD and stores connection AAD.
func TestResealLegacyVPNCredentials(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	profile := storeTestVPNProfile(testingObject, store)
	key := bytes.Repeat([]byte{0x24}, 32)
	plaintext := []byte(`{"username":"alice","password":"secret"}`)
	nonce, ciphertext, err := security.EncryptSecret(
		key,
		"vpn/configuration/"+profile.ID,
		plaintext,
	)
	if err != nil {
		testingObject.Fatalf("seal legacy credentials: %v", err)
	}
	connection := testVPNConnection("Legacy", profile.ID)
	connection.CredentialsNonce = nonce
	connection.CredentialsCiphertext = ciphertext
	created, err := store.CreateVPNConnection(ctx, connection)
	if err != nil {
		testingObject.Fatalf("create legacy connection: %v", err)
	}
	if _, err := store.databaseHandle().ExecContext(
		ctx,
		"UPDATE vpn_connections SET credentials_legacy_profile_id = ? WHERE id = ?",
		profile.ID,
		created.ID,
	); err != nil {
		testingObject.Fatalf("mark legacy credentials: %v", err)
	}

	if err := store.ResealLegacyVPNCredentials(
		ctx,
		func(connectionID string, profileID string, oldNonce []byte, oldCiphertext []byte) ([]byte, []byte, error) {
			decrypted, decryptError := security.DecryptSecret(
				key,
				"vpn/configuration/"+profileID,
				oldNonce,
				oldCiphertext,
			)
			if decryptError != nil {
				return nil, nil, decryptError
			}
			defer clear(decrypted)

			return security.EncryptSecret(key, "vpn/connection/"+connectionID, decrypted)
		},
	); err != nil {
		testingObject.Fatalf("re-seal credentials: %v", err)
	}

	resealed, err := store.VPNConnectionByID(ctx, created.ID)
	if err != nil {
		testingObject.Fatalf("read re-sealed connection: %v", err)
	}
	if resealed.CredentialsLegacyProfileID != "" || !resealed.Enabled {
		testingObject.Fatalf("re-sealed connection = %+v", resealed)
	}
	gotPlaintext, err := security.DecryptSecret(
		key,
		"vpn/connection/"+created.ID,
		resealed.CredentialsNonce,
		resealed.CredentialsCiphertext,
	)
	if err != nil || !bytes.Equal(gotPlaintext, plaintext) {
		testingObject.Fatalf("re-sealed plaintext = %q, %v", gotPlaintext, err)
	}
	clear(gotPlaintext)
}

// TestResealLegacyVPNCredentialsDisablesUnreadableRows preserves fail-closed startup.
func TestResealLegacyVPNCredentialsDisablesUnreadableRows(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	profile := storeTestVPNProfile(testingObject, store)
	connection := testVPNConnection("Unreadable", profile.ID)
	created, err := store.CreateVPNConnection(ctx, connection)
	if err != nil {
		testingObject.Fatalf("create connection: %v", err)
	}
	if _, err := store.databaseHandle().ExecContext(
		ctx,
		`UPDATE vpn_connections
		 SET credentials_nonce = x'00', credentials_ciphertext = x'01',
		     credentials_legacy_profile_id = ?
		 WHERE id = ?`,
		profile.ID,
		created.ID,
	); err != nil {
		testingObject.Fatalf("corrupt legacy credentials: %v", err)
	}

	if err := store.ResealLegacyVPNCredentials(
		ctx,
		func(string, string, []byte, []byte) ([]byte, []byte, error) {
			return nil, nil, errors.New("cannot authenticate credentials")
		},
	); err != nil {
		testingObject.Fatalf("handle unreadable credentials: %v", err)
	}
	cleared, err := store.VPNConnectionByID(ctx, created.ID)
	if err != nil {
		testingObject.Fatalf("read cleared connection: %v", err)
	}
	if cleared.Enabled || cleared.CredentialsLegacyProfileID != "" ||
		len(cleared.CredentialsNonce) != 0 || len(cleared.CredentialsCiphertext) != 0 {
		testingObject.Fatalf("unreadable connection = %+v", cleared)
	}
	removed, err := store.RemovedSecrets(ctx, 1)
	if err != nil || len(removed) != 1 || removed[0].Kind != "vpn" {
		testingObject.Fatalf("removed secrets = %+v, %v", removed, err)
	}
}

func openVersion12Store(testingObject *testing.T) *Store {
	testingObject.Helper()

	ctx := context.Background()
	database, err := sql.Open(
		"sqlite",
		"file:"+filepath.ToSlash(filepath.Join(testingObject.TempDir(), "state.sqlite3")),
	)
	if err != nil {
		testingObject.Fatalf("open database: %v", err)
	}
	database.SetMaxOpenConns(1)
	database.SetMaxIdleConns(1)
	store := &Store{database: database}
	if _, err := database.ExecContext(ctx, "PRAGMA foreign_keys = ON"); err != nil {
		_ = store.Close()
		testingObject.Fatalf("enable foreign keys: %v", err)
	}
	if _, err := database.ExecContext(ctx, `CREATE TABLE schema_migrations (
	  version INTEGER PRIMARY KEY,
	  name TEXT NOT NULL,
	  applied_at TEXT NOT NULL
	) STRICT`); err != nil {
		_ = store.Close()
		testingObject.Fatalf("create migration ledger: %v", err)
	}
	for _, name := range []string{
		"001_initial.sql",
		"002_vpn_profiles.sql",
		"003_torrent_organization.sql",
		"004_vpn_endpoint_pools.sql",
		"005_account_security.sql",
		"006_named_tokens.sql",
		"007_removed_secrets.sql",
		"008_notifications.sql",
		"009_vpn_tunnels.sql",
		"010_web_proxy.sql",
		"011_torrent_profiles.sql",
		"012_rpc_logins.sql",
	} {
		if err := store.applyMigration(ctx, name); err != nil {
			_ = store.Close()
			testingObject.Fatalf("apply %s: %v", name, err)
		}
	}

	return store
}

func storeTestVPNProfile(testingObject *testing.T, store *Store) EncryptedVPNProfile {
	testingObject.Helper()

	profile := EncryptedVPNProfile{
		ID:          "custom:test:123456789abc",
		ProviderID:  "custom",
		Tunnel:      "openvpn",
		DisplayName: "Test",
		Protocol:    "udp",
		RemoteHost:  "vpn.example.test",
		RemotePort:  1194,
		Fingerprint: "123456789abcdef",
		Source:      "upload",
		Nonce:       []byte("nonce-value"),
		Ciphertext:  []byte("encrypted-profile"),
	}
	if err := store.UpsertCustomVPNProfile(context.Background(), profile); err != nil {
		testingObject.Fatalf("store test VPN profile: %v", err)
	}

	return profile
}
