package storage

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// EncryptedVPNProfile is one normalized profile ready for durable storage.
//
// API code encrypts potentially private profile content before it crosses this storage
// boundary; metadata remains searchable for endpoint selection.
type EncryptedVPNProfile struct {
	ID          string
	ProviderID  string
	Tunnel      string
	DisplayName string
	CountryCode string
	Country     string
	City        string
	Continent   string
	Protocol    string
	RemoteHost  string
	RemotePort  int
	Fingerprint string
	Source      string
	Nonce       []byte
	Ciphertext  []byte
}

// VPNProfileMetadata is the safe list view of a stored endpoint.
//
// Encrypted profile bytes and nonces are intentionally absent from API-facing
// metadata.
type VPNProfileMetadata struct {
	ID          string    `json:"id"`
	ProviderID  string    `json:"providerId"`
	Tunnel      string    `json:"tunnel"`
	DisplayName string    `json:"displayName"`
	CountryCode string    `json:"countryCode"`
	Country     string    `json:"country"`
	City        string    `json:"city"`
	Continent   string    `json:"continent"`
	Protocol    string    `json:"protocol"`
	RemoteHost  string    `json:"remoteHost"`
	RemotePort  int       `json:"remotePort"`
	Fingerprint string    `json:"fingerprint"`
	Source      string    `json:"source"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// StoredVPNProfile contains metadata and encrypted content for activation.
//
// Only the authenticated VPN configuration flow loads this internal record and passes
// its decrypted normalized content to the local controller.
type StoredVPNProfile struct {
	VPNProfileMetadata
	Nonce      []byte
	Ciphertext []byte
}

// VPNCatalogStatus reports the last atomic refresh of one provider tunnel's catalog.
//
// The UI can distinguish an empty catalog from a stale one without inspecting profile
// files or provider download internals.
type VPNCatalogStatus struct {
	ProviderID    string    `json:"providerId"`
	Tunnel        string    `json:"tunnel"`
	SourceURL     string    `json:"sourceUrl"`
	EndpointCount int       `json:"endpointCount"`
	RefreshedAt   time.Time `json:"refreshedAt"`
}

// ReplaceVPNCatalog atomically publishes one complete endpoint generation for a tunnel.
//
// Prior profiles of the same tunnel become non-current but remain available to an
// active configuration, preserving last-known-good behavior across catalog changes.
// The provider's other tunnel is never touched.
func (store *Store) ReplaceVPNCatalog(
	ctx context.Context,
	providerID string,
	tunnel string,
	sourceURL string,
	profiles []EncryptedVPNProfile,
) error {
	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin VPN catalog replacement: %w", err)
	}

	committed := false
	defer func() {
		if !committed {
			_ = transaction.Rollback()
		}
	}()

	if _, err := transaction.ExecContext(
		ctx,
		"UPDATE vpn_profiles SET current = 0 WHERE provider_id = ? AND tunnel = ? AND source = 'official-catalog'",
		providerID,
		tunnel,
	); err != nil {
		return fmt.Errorf("retire prior VPN catalog: %w", err)
	}

	now := formatTime(time.Now())
	for _, profile := range profiles {
		if profile.ProviderID != providerID || profile.Tunnel != tunnel || profile.Source != "official-catalog" {
			return errors.New("VPN catalog profile metadata is inconsistent")
		}

		if _, err := transaction.ExecContext(
			ctx,
			`INSERT INTO vpn_profiles (
			   id, provider_id, tunnel, display_name, country_code, country_name, city,
			   continent, protocol, remote_host, remote_port,
			   fingerprint, source, current, nonce, ciphertext, created_at, updated_at
			 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
			 ON CONFLICT(id) DO UPDATE SET
			   tunnel = excluded.tunnel,
			   display_name = excluded.display_name,
			   country_code = excluded.country_code,
			   country_name = excluded.country_name,
			   city = excluded.city,
			   continent = excluded.continent,
			   protocol = excluded.protocol,
			   remote_host = excluded.remote_host,
			   remote_port = excluded.remote_port,
			   fingerprint = excluded.fingerprint,
			   source = excluded.source,
			   current = 1,
			   nonce = excluded.nonce,
			   ciphertext = excluded.ciphertext,
			   updated_at = excluded.updated_at`,
			profile.ID,
			profile.ProviderID,
			profile.Tunnel,
			profile.DisplayName,
			profile.CountryCode,
			profile.Country,
			profile.City,
			profile.Continent,
			profile.Protocol,
			profile.RemoteHost,
			profile.RemotePort,
			profile.Fingerprint,
			profile.Source,
			profile.Nonce,
			profile.Ciphertext,
			now,
			now,
		); err != nil {
			return fmt.Errorf("store VPN catalog profile %s: %w", profile.ID, err)
		}
	}

	if _, err := transaction.ExecContext(
		ctx,
		`INSERT INTO vpn_catalogs (provider_id, tunnel, source_url, endpoint_count, refreshed_at)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(provider_id, tunnel) DO UPDATE SET
		   source_url = excluded.source_url,
		   endpoint_count = excluded.endpoint_count,
		   refreshed_at = excluded.refreshed_at`,
		providerID,
		tunnel,
		sourceURL,
		len(profiles),
		now,
	); err != nil {
		return fmt.Errorf("store VPN catalog status: %w", err)
	}

	if _, err := transaction.ExecContext(
		ctx,
		`DELETE FROM vpn_profiles
		 WHERE provider_id = ?
		   AND tunnel = ?
		   AND source = 'official-catalog'
		   AND current = 0
		   AND id NOT IN (
		     SELECT profile_id FROM vpn_connection_endpoints
		   )`,
		providerID,
		tunnel,
	); err != nil {
		return fmt.Errorf("remove retired VPN catalog profiles: %w", err)
	}

	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit VPN catalog replacement: %w", err)
	}
	committed = true

	return nil
}

// UpsertCustomVPNProfile stores one validated custom endpoint as current.
//
// A fingerprint-derived identifier makes repeated uploads idempotent while preserving
// older active profiles when their content changes.
func (store *Store) UpsertCustomVPNProfile(
	ctx context.Context,
	profile EncryptedVPNProfile,
) error {
	return store.UpsertCustomVPNProfiles(ctx, []EncryptedVPNProfile{profile})
}

// UpsertCustomVPNProfiles stores one uploaded endpoint pool atomically.
func (store *Store) UpsertCustomVPNProfiles(
	ctx context.Context,
	profiles []EncryptedVPNProfile,
) error {
	if len(profiles) == 0 {
		return errors.New("custom VPN profile list is empty")
	}
	for _, profile := range profiles {
		if profile.ProviderID != "custom" || profile.Source != "upload" || !validVPNTunnel(profile.Tunnel) {
			return errors.New("custom VPN profile metadata is inconsistent")
		}
	}

	transaction, err := store.databaseHandle().BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin custom VPN profile upload: %w", err)
	}
	committed := false
	defer func() {
		if !committed {
			_ = transaction.Rollback()
		}
	}()

	now := formatTime(time.Now())
	for _, profile := range profiles {
		if _, err := transaction.ExecContext(
			ctx,
			`INSERT INTO vpn_profiles (
		   id, provider_id, tunnel, display_name, country_code, country_name, city,
		   continent, protocol, remote_host, remote_port,
		   fingerprint, source, current, nonce, ciphertext, created_at, updated_at
		 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET
		   tunnel = excluded.tunnel,
		   display_name = excluded.display_name,
		   country_code = excluded.country_code,
		   country_name = excluded.country_name,
		   city = excluded.city,
		   continent = excluded.continent,
		   protocol = excluded.protocol,
		   remote_host = excluded.remote_host,
		   remote_port = excluded.remote_port,
		   current = 1,
		   nonce = excluded.nonce,
		   ciphertext = excluded.ciphertext,
		   updated_at = excluded.updated_at`,
			profile.ID,
			profile.ProviderID,
			profile.Tunnel,
			profile.DisplayName,
			profile.CountryCode,
			profile.Country,
			profile.City,
			profile.Continent,
			profile.Protocol,
			profile.RemoteHost,
			profile.RemotePort,
			profile.Fingerprint,
			profile.Source,
			profile.Nonce,
			profile.Ciphertext,
			now,
			now,
		); err != nil {
			return fmt.Errorf("store custom VPN profile: %w", err)
		}
	}
	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit custom VPN profile upload: %w", err)
	}
	committed = true

	return nil
}

// ListVPNProfiles returns current safe endpoint metadata for one provider.
//
// An empty tunnel lists both tunnels; otherwise only that tunnel's endpoints are
// returned. The encrypted profile body is loaded only by a specific activation request.
func (store *Store) ListVPNProfiles(
	ctx context.Context,
	providerID string,
	tunnel string,
) ([]VPNProfileMetadata, error) {
	rows, err := store.databaseHandle().QueryContext(
		ctx,
		`SELECT id, provider_id, tunnel, display_name, country_code, country_name, city,
		        continent, protocol, remote_host, remote_port,
		        fingerprint, source, updated_at
		 FROM vpn_profiles
		 WHERE provider_id = ? AND (? = '' OR tunnel = ?) AND current = 1
		 ORDER BY display_name`,
		providerID,
		tunnel,
		tunnel,
	)
	if err != nil {
		return nil, fmt.Errorf("list VPN profiles: %w", err)
	}
	defer rows.Close()

	profiles := []VPNProfileMetadata{}
	for rows.Next() {
		profile, scanError := scanVPNProfileMetadata(rows)
		if scanError != nil {
			return nil, scanError
		}
		profiles = append(profiles, profile)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate VPN profiles: %w", err)
	}

	return profiles, nil
}

// FindVPNProfile loads one encrypted profile by stable identifier.
//
// Retired profiles remain addressable only when explicitly selected by an active
// last-known-good configuration.
func (store *Store) FindVPNProfile(ctx context.Context, profileID string) (StoredVPNProfile, error) {
	var profile StoredVPNProfile
	var updatedAtText string
	err := store.databaseHandle().QueryRowContext(
		ctx,
		`SELECT id, provider_id, tunnel, display_name, country_code, country_name, city,
		        continent, protocol, remote_host, remote_port,
		        fingerprint, source, updated_at, nonce, ciphertext
		 FROM vpn_profiles
		 WHERE id = ?`,
		profileID,
	).Scan(
		&profile.ID,
		&profile.ProviderID,
		&profile.Tunnel,
		&profile.DisplayName,
		&profile.CountryCode,
		&profile.Country,
		&profile.City,
		&profile.Continent,
		&profile.Protocol,
		&profile.RemoteHost,
		&profile.RemotePort,
		&profile.Fingerprint,
		&profile.Source,
		&updatedAtText,
		&profile.Nonce,
		&profile.Ciphertext,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return StoredVPNProfile{}, ErrNotFound
	}
	if err != nil {
		return StoredVPNProfile{}, fmt.Errorf("find VPN profile: %w", err)
	}

	profile.UpdatedAt, err = parseTime(updatedAtText)
	if err != nil {
		return StoredVPNProfile{}, err
	}

	return profile, nil
}

// VPNCatalogStatusFor returns the most recent official refresh of one provider tunnel.
//
// Tunnels without a refreshable catalog, or never refreshed, return ErrNotFound.
func (store *Store) VPNCatalogStatusFor(
	ctx context.Context,
	providerID string,
	tunnel string,
) (VPNCatalogStatus, error) {
	var status VPNCatalogStatus
	var refreshedAtText string
	err := store.databaseHandle().QueryRowContext(
		ctx,
		`SELECT provider_id, tunnel, source_url, endpoint_count, refreshed_at
		 FROM vpn_catalogs
		 WHERE provider_id = ? AND tunnel = ?`,
		providerID,
		tunnel,
	).Scan(
		&status.ProviderID,
		&status.Tunnel,
		&status.SourceURL,
		&status.EndpointCount,
		&refreshedAtText,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return VPNCatalogStatus{}, ErrNotFound
	}
	if err != nil {
		return VPNCatalogStatus{}, fmt.Errorf("read VPN catalog status: %w", err)
	}

	status.RefreshedAt, err = parseTime(refreshedAtText)
	if err != nil {
		return VPNCatalogStatus{}, err
	}

	return status, nil
}

// scanVPNProfileMetadata decodes one safe endpoint metadata row.
//
// Shared scanning keeps list and future filtered queries consistent.
func scanVPNProfileMetadata(scanner rowScanner) (VPNProfileMetadata, error) {
	var profile VPNProfileMetadata
	var updatedAtText string
	if err := scanner.Scan(
		&profile.ID,
		&profile.ProviderID,
		&profile.Tunnel,
		&profile.DisplayName,
		&profile.CountryCode,
		&profile.Country,
		&profile.City,
		&profile.Continent,
		&profile.Protocol,
		&profile.RemoteHost,
		&profile.RemotePort,
		&profile.Fingerprint,
		&profile.Source,
		&updatedAtText,
	); err != nil {
		return VPNProfileMetadata{}, fmt.Errorf("scan VPN profile metadata: %w", err)
	}

	updatedAt, err := parseTime(updatedAtText)
	if err != nil {
		return VPNProfileMetadata{}, err
	}
	profile.UpdatedAt = updatedAt

	return profile, nil
}

// validVPNTunnel reports whether a value is one of the two supported tunnels.
//
// The schema enforces the same pair with CHECK constraints; checking here returns a
// clear error before a transaction starts.
func validVPNTunnel(tunnel string) bool {
	return tunnel == "openvpn" || tunnel == "wireguard"
}
