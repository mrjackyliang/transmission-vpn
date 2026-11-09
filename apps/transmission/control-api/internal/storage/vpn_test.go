package storage

import (
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// TestVPNConnectionLifecycle verifies names, slots, defaults, and row revisions.
//
// Slots are durable runtime identities, while a connection revision protects a tested
// candidate from replacing a row edited by another request.
func TestVPNConnectionLifecycle(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

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
	if err := store.UpsertCustomVPNProfile(ctx, profile); err != nil {
		testingObject.Fatalf("store profile: %v", err)
	}

	first, err := store.CreateVPNConnection(ctx, testVPNConnection("First", profile.ID))
	if err != nil {
		testingObject.Fatalf("create first connection: %v", err)
	}
	if first.Slot != 0 || !first.IsDefault || first.Revision != 1 {
		testingObject.Fatalf("first connection = %+v", first)
	}

	second, err := store.CreateVPNConnection(ctx, testVPNConnection("Second", profile.ID))
	if err != nil {
		testingObject.Fatalf("create second connection: %v", err)
	}
	if second.Slot != 1 || second.IsDefault {
		testingObject.Fatalf("second connection = %+v", second)
	}

	duplicate := testVPNConnection("first", profile.ID)
	if _, err := store.CreateVPNConnection(ctx, duplicate); !errors.Is(err, ErrVPNConnectionNameTaken) {
		testingObject.Fatalf("duplicate name error = %v", err)
	}

	updated := first
	updated.Name = "Primary"
	updated.PeerPort = 42370
	updated.EndpointStrategy = "ordered"
	if _, err := store.UpdateVPNConnection(ctx, first.ID, 0, updated); !errors.Is(err, ErrRevisionConflict) {
		testingObject.Fatalf("stale update error = %v", err)
	}
	revision, err := store.UpdateVPNConnection(ctx, first.ID, first.Revision, updated)
	if err != nil {
		testingObject.Fatalf("update first connection: %v", err)
	}
	if revision != 2 {
		testingObject.Fatalf("updated revision = %d, want 2", revision)
	}

	if err := store.SetDefaultVPNConnection(ctx, second.ID); err != nil {
		testingObject.Fatalf("move default: %v", err)
	}
	defaultConnection, err := store.DefaultVPNConnection(ctx)
	if err != nil || defaultConnection.ID != second.ID {
		testingObject.Fatalf("default connection = %+v, %v", defaultConnection, err)
	}
	listed, err := store.ListVPNConnections(ctx)
	if err != nil || len(listed) != 2 || listed[0].Slot != 0 || listed[1].Slot != 1 {
		testingObject.Fatalf("listed connections = %+v, %v", listed, err)
	}

	if err := store.DeleteVPNConnection(ctx, first.ID); err != nil {
		testingObject.Fatalf("delete first connection: %v", err)
	}
	reused, err := store.CreateVPNConnection(ctx, testVPNConnection("Reused slot", profile.ID))
	if err != nil || reused.Slot != 0 {
		testingObject.Fatalf("reused slot connection = %+v, %v", reused, err)
	}
	if err := store.DeleteVPNConnection(ctx, second.ID); !errors.Is(err, ErrDefaultVPNConnection) {
		testingObject.Fatalf("delete default error = %v", err)
	}
}

// TestVPNCatalogsStayWithinTheirTunnel keeps one provider's two catalogs apart.
//
// A WireGuard refresh must never retire OpenVPN endpoints, and a pool can only hold
// endpoints of the tunnel it names.
func TestVPNCatalogsStayWithinTheirTunnel(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	catalogProfile := func(id string, tunnel string) EncryptedVPNProfile {
		return EncryptedVPNProfile{
			ID:          id,
			ProviderID:  "nordvpn",
			Tunnel:      tunnel,
			DisplayName: id,
			Protocol:    "udp",
			RemoteHost:  "192.0.2.10",
			RemotePort:  51820,
			Fingerprint: "123456789abcdef",
			Source:      "official-catalog",
			Nonce:       []byte("nonce-value"),
			Ciphertext:  []byte("encrypted-profile"),
		}
	}
	openVPNProfile := catalogProfile("nordvpn:us1234-udp:111111111111", "openvpn")
	firstWireGuardProfile := catalogProfile("nordvpn:wg-us1234-nordvpn-com:222222222222", "wireguard")
	secondWireGuardProfile := catalogProfile("nordvpn:wg-uk765-nordvpn-com:333333333333", "wireguard")

	if err := store.ReplaceVPNCatalog(ctx, "nordvpn", "openvpn", "https://example.test/ovpn.zip",
		[]EncryptedVPNProfile{openVPNProfile}); err != nil {
		testingObject.Fatalf("store OpenVPN catalog: %v", err)
	}
	if err := store.ReplaceVPNCatalog(ctx, "nordvpn", "wireguard", "https://example.test/servers",
		[]EncryptedVPNProfile{firstWireGuardProfile}); err != nil {
		testingObject.Fatalf("store WireGuard catalog: %v", err)
	}
	if err := store.ReplaceVPNCatalog(ctx, "nordvpn", "wireguard", "https://example.test/servers",
		[]EncryptedVPNProfile{openVPNProfile}); err == nil {
		testingObject.Fatal("a WireGuard refresh accepted an OpenVPN endpoint")
	}

	// A second WireGuard generation replaces the first and leaves OpenVPN alone.
	if err := store.ReplaceVPNCatalog(ctx, "nordvpn", "wireguard", "https://example.test/servers",
		[]EncryptedVPNProfile{secondWireGuardProfile}); err != nil {
		testingObject.Fatalf("refresh WireGuard catalog: %v", err)
	}

	listedIDs := func(tunnel string) string {
		profiles, err := store.ListVPNProfiles(ctx, "nordvpn", tunnel)
		if err != nil {
			testingObject.Fatalf("list %q profiles: %v", tunnel, err)
		}
		identifiers := make([]string, 0, len(profiles))
		for _, profile := range profiles {
			identifiers = append(identifiers, profile.Tunnel+"="+profile.ID)
		}

		return strings.Join(identifiers, ",")
	}
	if got := listedIDs("openvpn"); got != "openvpn="+openVPNProfile.ID {
		testingObject.Fatalf("OpenVPN profiles = %s", got)
	}
	if got := listedIDs("wireguard"); got != "wireguard="+secondWireGuardProfile.ID {
		testingObject.Fatalf("WireGuard profiles = %s", got)
	}
	if got := listedIDs(""); strings.Count(got, "=") != 2 {
		testingObject.Fatalf("all profiles = %s", got)
	}
	if _, err := store.FindVPNProfile(ctx, firstWireGuardProfile.ID); !errors.Is(err, ErrNotFound) {
		testingObject.Fatalf("the retired WireGuard endpoint was kept: %v", err)
	}

	for _, tunnel := range []string{"openvpn", "wireguard"} {
		status, err := store.VPNCatalogStatusFor(ctx, "nordvpn", tunnel)
		if err != nil {
			testingObject.Fatalf("read %s catalog status: %v", tunnel, err)
		}
		if status.Tunnel != tunnel || status.EndpointCount != 1 {
			testingObject.Fatalf("unexpected %s catalog status: %+v", tunnel, status)
		}
	}
	if _, err := store.VPNCatalogStatusFor(ctx, "mullvad", "wireguard"); !errors.Is(err, ErrNotFound) {
		testingObject.Fatalf("an unrefreshed catalog status = %v, want not found", err)
	}

	configuration := testVPNConnection("NordVPN WireGuard", secondWireGuardProfile.ID)
	configuration.ProviderID = "nordvpn"
	configuration.Tunnel = "wireguard"
	configuration.ProfileIDs = []string{secondWireGuardProfile.ID, openVPNProfile.ID}
	configuration.EndpointStrategy = "ordered"
	if _, err := store.CreateVPNConnection(ctx, configuration); err == nil ||
		!strings.Contains(err.Error(), "does not belong to the tunnel") {
		testingObject.Fatalf("a mixed pool create error = %v", err)
	}

	configuration.ProfileIDs = []string{secondWireGuardProfile.ID}
	created, err := store.CreateVPNConnection(ctx, configuration)
	if err != nil {
		testingObject.Fatalf("create WireGuard pool: %v", err)
	}
	defaultConnection, err := store.DefaultVPNConnection(ctx)
	if err != nil {
		testingObject.Fatalf("read default VPN connection: %v", err)
	}
	if defaultConnection.ID != created.ID || defaultConnection.Tunnel != "wireguard" {
		testingObject.Fatalf("default VPN connection = %+v", defaultConnection)
	}

	// Every referenced endpoint survives the next refresh even after leaving its list.
	if err := store.ReplaceVPNCatalog(ctx, "nordvpn", "wireguard", "https://example.test/servers",
		[]EncryptedVPNProfile{firstWireGuardProfile}); err != nil {
		testingObject.Fatalf("refresh WireGuard catalog again: %v", err)
	}
	if _, err := store.FindVPNProfile(ctx, secondWireGuardProfile.ID); err != nil {
		testingObject.Fatalf("the referenced WireGuard endpoint was removed: %v", err)
	}
}

func testVPNConnection(name string, profileID string) EncryptedVPNConnection {
	return EncryptedVPNConnection{
		Name:                  name,
		Enabled:               true,
		ProviderID:            "custom",
		Tunnel:                "openvpn",
		ProfileIDs:            []string{profileID},
		EndpointStrategy:      "sticky",
		CredentialsNonce:      []byte("credentials-nonce"),
		CredentialsCiphertext: []byte("encrypted-credentials"),
		DNSServers:            []string{"9.9.9.9"},
		RetryIntervalSeconds:  10,
		PeerPort:              DefaultVPNPeerPort,
	}
}

// TestTunnelMigrationKeepsOpenVPNRows upgrades a version 8 database through migration 9.
//
// Every endpoint, catalog, and pool stored before WireGuard existed is OpenVPN, so the
// upgrade must label them that way without losing a row.
func TestTunnelMigrationKeepsOpenVPNRows(testingObject *testing.T) {
	ctx := context.Background()
	database, err := sql.Open("sqlite", "file:"+filepath.ToSlash(filepath.Join(testingObject.TempDir(), "state.sqlite3")))
	if err != nil {
		testingObject.Fatalf("open database: %v", err)
	}
	database.SetMaxOpenConns(1)
	store := &Store{database: database}
	defer store.Close()

	if _, err := database.ExecContext(ctx, "PRAGMA foreign_keys = ON"); err != nil {
		testingObject.Fatalf("enable foreign keys: %v", err)
	}
	if _, err := database.ExecContext(ctx, `CREATE TABLE schema_migrations (
	  version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL
	) STRICT`); err != nil {
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
	} {
		if err := store.applyMigration(ctx, name); err != nil {
			testingObject.Fatalf("apply %s: %v", name, err)
		}
	}

	now := formatTime(time.Now())
	for _, statement := range []string{
		`INSERT INTO vpn_profiles (id, provider_id, display_name, protocol, remote_host, remote_port,
		   fingerprint, source, current, nonce, ciphertext, created_at, updated_at)
		 VALUES ('pia:us-udp:111111111111', 'pia', 'US', 'udp', 'us.example.test', 1198,
		   'fingerprint', 'official-catalog', 1, x'00', x'00', '` + now + `', '` + now + `')`,
		`INSERT INTO vpn_catalogs (provider_id, source_url, endpoint_count, refreshed_at)
		 VALUES ('pia', 'https://example.test/pia.zip', 1, '` + now + `')`,
		`INSERT INTO vpn_active_configuration (id, enabled, provider_id, profile_id, credentials_nonce,
		   credentials_ciphertext, dns_servers_json, retry_interval_seconds, updated_at)
		 VALUES (1, 1, 'pia', 'pia:us-udp:111111111111', x'00', x'00', '[]', 10, '` + now + `')`,
		`INSERT INTO vpn_active_endpoints (configuration_id, position, profile_id)
		 VALUES (1, 0, 'pia:us-udp:111111111111')`,
	} {
		if _, err := database.ExecContext(ctx, statement); err != nil {
			testingObject.Fatalf("seed version 8 rows: %v", err)
		}
	}

	if err := store.applyMigration(ctx, "009_vpn_tunnels.sql"); err != nil {
		testingObject.Fatalf("apply migration 9: %v", err)
	}

	profiles, err := store.ListVPNProfiles(ctx, "pia", "openvpn")
	if err != nil || len(profiles) != 1 || profiles[0].Tunnel != "openvpn" {
		testingObject.Fatalf("upgraded profiles = %+v, %v", profiles, err)
	}
	status, err := store.VPNCatalogStatusFor(ctx, "pia", "openvpn")
	if err != nil || status.EndpointCount != 1 || status.SourceURL != "https://example.test/pia.zip" {
		testingObject.Fatalf("upgraded catalog status = %+v, %v", status, err)
	}
	var activeTunnel string
	var endpointCount int
	if err := database.QueryRowContext(
		ctx,
		`SELECT vpn_active_configuration.tunnel, COUNT(vpn_active_endpoints.profile_id)
		 FROM vpn_active_configuration
		 LEFT JOIN vpn_active_endpoints
		   ON vpn_active_endpoints.configuration_id = vpn_active_configuration.id
		 GROUP BY vpn_active_configuration.id`,
	).Scan(&activeTunnel, &endpointCount); err != nil || activeTunnel != "openvpn" || endpointCount != 1 {
		testingObject.Fatalf("upgraded active configuration = %q, %d, %v", activeTunnel, endpointCount, err)
	}
	if _, err := database.ExecContext(ctx, "UPDATE vpn_profiles SET tunnel = 'ipsec'"); err == nil {
		testingObject.Fatal("the tunnel column accepted an unknown tunnel")
	}
}
