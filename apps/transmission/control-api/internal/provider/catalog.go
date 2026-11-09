package provider

import (
	"archive/zip"
	"bytes"
	"errors"
	"fmt"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const (
	// PIAStrongUDPCatalogURL is PIA's public strong-encryption UDP bundle.
	//
	// The provider publishes one profile per location and refreshes the archive in
	// place, allowing an authenticated administrator to update it atomically.
	PIAStrongUDPCatalogURL = "https://www.privateinternetaccess.com/openvpn/openvpn-strong.zip"

	// PIAStrongTCPCatalogURL is PIA's public strong-encryption TCP bundle.
	//
	// It is merged with the UDP bundle so one provider selection can fall back across
	// transports without weakening the one-provider configuration invariant.
	PIAStrongTCPCatalogURL = "https://www.privateinternetaccess.com/openvpn/openvpn-strong-tcp.zip"

	// IPVanishCatalogURL is IPVanish's public OpenVPN 2.6 catalog archive.
	//
	// Its filenames include country, city, and server identity used by the adapter to
	// build searchable metadata without a separate geolocation service.
	IPVanishCatalogURL = "https://configs.ipvanish.com/openvpn/v2.6.0-0/configs.zip"

	// NordVPNCatalogURL is NordVPN's public archive of every server's OpenVPN profiles.
	//
	// NordVPN regenerates it in place every day. It holds UDP and TCP profiles for
	// OpenVPN 2.6 and for older clients, and the adapter keeps only the 2.6 ones.
	NordVPNCatalogURL = "https://downloads.nordcdn.com/configs/archives/servers/ovpn.zip"

	// SurfsharkCatalogURL is Surfshark's public archive of OpenVPN profiles per location.
	//
	// Each location has one UDP and one TCP profile whose remote is the location's
	// load-balanced host, so the archive stays small as servers come and go.
	SurfsharkCatalogURL = "https://my.surfshark.com/vpn/api/v1/server/configurations"
)

const (
	// MullvadWireGuardCatalogURL is Mullvad's public list of every relay.
	//
	// Each WireGuard relay carries its public key, entry address, and location, which is
	// everything a template needs; the user adds their own key and address.
	MullvadWireGuardCatalogURL = "https://api.mullvad.net/www/relays/all/"

	// NordVPNWireGuardCatalogURL is NordVPN's public server list.
	//
	// Servers that offer WireGuard list technology 35 with the server's public key; the
	// whole list is about 8 MB, so its source sets its own limits.
	NordVPNWireGuardCatalogURL = "https://api.nordvpn.com/v2/servers?limit=0"

	// SurfsharkWireGuardCatalogURL is Surfshark's public list of its location clusters.
	//
	// It is the same list the OpenVPN city table was built from, with each cluster's
	// WireGuard public key.
	SurfsharkWireGuardCatalogURL = "https://api.surfshark.com/v4/server/clusters/generic"

	// IVPNWireGuardCatalogURL is IVPN's public server list with WireGuard hosts and keys.
	IVPNWireGuardCatalogURL = "https://api.ivpn.net/v4/servers/stats"
)

const (
	// DefaultCatalogDownloadBytes caps one catalog download unless its source sets a cap.
	DefaultCatalogDownloadBytes int64 = 32 * 1024 * 1024

	// DefaultCatalogDownloadTimeout bounds one catalog download unless its source sets one.
	DefaultCatalogDownloadTimeout = 40 * time.Second

	// DefaultCatalogAccept is the Accept header for archive downloads.
	DefaultCatalogAccept = "application/zip, application/octet-stream"

	// minimumCatalogRefreshDeadline is the shortest time a whole refresh is allowed.
	minimumCatalogRefreshDeadline = 90 * time.Second

	// catalogRefreshMargin covers lookup retries on top of the sources' own time limits.
	catalogRefreshMargin = 10 * time.Second
)

// CatalogSource is one fixed provider-owned catalog download.
//
// URLs are compiled into trusted adapters and never accepted from an HTTP request,
// preventing the refresh endpoint from becoming a general server-side fetcher.
type CatalogSource struct {
	URL string

	// MaximumBytes caps this download. Zero uses DefaultCatalogDownloadBytes.
	MaximumBytes int64

	// Timeout bounds this download. Zero uses DefaultCatalogDownloadTimeout.
	Timeout time.Duration

	// Accept is the Accept header to send. Empty uses DefaultCatalogAccept.
	Accept string
}

// DownloadLimits returns the size cap and time limit for this source.
//
// Most provider archives fit the shared defaults, so only a large catalog such as
// NordVPN's sets its own.
func (source CatalogSource) DownloadLimits() (int64, time.Duration) {
	maximumBytes := source.MaximumBytes
	if maximumBytes <= 0 {
		maximumBytes = DefaultCatalogDownloadBytes
	}
	timeout := source.Timeout
	if timeout <= 0 {
		timeout = DefaultCatalogDownloadTimeout
	}

	return maximumBytes, timeout
}

// AcceptHeader returns the Accept header for this source.
//
// Archive downloads keep the shared default, while the WireGuard server lists ask for
// JSON.
func (source CatalogSource) AcceptHeader() string {
	if source.Accept == "" {
		return DefaultCatalogAccept
	}

	return source.Accept
}

// CatalogDefinition describes the complete atomic input for one provider tunnel.
//
// A provider may publish multiple transport archives; every source must validate
// before the merged generation replaces that tunnel's last-known-good catalog.
type CatalogDefinition struct {
	ProviderID string
	Tunnel     string
	Sources    []CatalogSource
}

// RefreshDeadline bounds a whole refresh of this catalog.
//
// It adds up the sources' own time limits plus a margin for lookup retries, and never
// drops below the 90 seconds every refresh had before sources set their own limits.
func (definition CatalogDefinition) RefreshDeadline() time.Duration {
	deadline := catalogRefreshMargin
	for _, source := range definition.Sources {
		_, timeout := source.DownloadLimits()
		deadline += timeout
	}

	return max(deadline, minimumCatalogRefreshDeadline)
}

// CatalogDefinitionFor returns a refreshable provider tunnel's fixed source definition.
//
// The API uses the boolean result to reject custom uploads, unknown providers, and
// tunnels a provider doesn't publish before performing any network request.
func CatalogDefinitionFor(providerID string, tunnelID string) (CatalogDefinition, bool) {
	sources, found := catalogSources(providerID, tunnelID)
	if !found {
		return CatalogDefinition{}, false
	}

	return CatalogDefinition{
		ProviderID: providerID,
		Tunnel:     tunnelID,
		Sources:    sources,
	}, true
}

// catalogSources lists the fixed downloads for one provider tunnel.
//
// Sources stay in this one table so the URL set, limits, and Accept headers can be
// reviewed together.
func catalogSources(providerID string, tunnelID string) ([]CatalogSource, bool) {
	jsonSource := func(url string) CatalogSource {
		return CatalogSource{URL: url, Accept: "application/json"}
	}

	switch providerID + "/" + tunnelID {
	case "purevpn/" + TunnelOpenVPN:
		return []CatalogSource{{URL: PureVPNCatalogURL}}, true
	case "pia/" + TunnelOpenVPN:
		return []CatalogSource{{URL: PIAStrongUDPCatalogURL}, {URL: PIAStrongTCPCatalogURL}}, true
	case "ipvanish/" + TunnelOpenVPN:
		return []CatalogSource{{URL: IPVanishCatalogURL}}, true
	case "nordvpn/" + TunnelOpenVPN:
		return []CatalogSource{{
			URL:          NordVPNCatalogURL,
			MaximumBytes: maximumNordVPNArchiveBytes,
			Timeout:      nordVPNCatalogTimeout,
		}}, true
	case "nordvpn/" + TunnelWireGuard:
		return []CatalogSource{{
			URL:          NordVPNWireGuardCatalogURL,
			MaximumBytes: maximumNordVPNServerListBytes,
			Timeout:      nordVPNServerListTimeout,
			Accept:       "application/json",
		}}, true
	case "surfshark/" + TunnelOpenVPN:
		return []CatalogSource{{URL: SurfsharkCatalogURL}}, true
	case "surfshark/" + TunnelWireGuard:
		return []CatalogSource{jsonSource(SurfsharkWireGuardCatalogURL)}, true
	case "ivpn/" + TunnelOpenVPN:
		return []CatalogSource{{URL: IVPNUDPCatalogURL}, {URL: IVPNTCPCatalogURL}}, true
	case "ivpn/" + TunnelWireGuard:
		return []CatalogSource{jsonSource(IVPNWireGuardCatalogURL)}, true
	case "mullvad/" + TunnelWireGuard:
		return []CatalogSource{jsonSource(MullvadWireGuardCatalogURL)}, true
	default:
		return nil, false
	}
}

// ParseCatalog validates every downloaded source through its provider tunnel adapter.
//
// Source order is part of the catalog definition, making multi-archive parsing
// deterministic and preventing incomplete refreshes from being published.
func ParseCatalog(providerID string, tunnelID string, sourceContents [][]byte) ([]Profile, error) {
	catalog, found := CatalogDefinitionFor(providerID, tunnelID)
	if !found {
		return nil, errors.New("the VPN provider does not expose a refreshable catalog for this tunnel")
	}
	if len(sourceContents) != len(catalog.Sources) {
		return nil, errors.New("the VPN catalog source set is incomplete")
	}

	switch providerID + "/" + tunnelID {
	case "purevpn/" + TunnelOpenVPN:
		return ParsePureVPNCatalog(sourceContents[0])
	case "pia/" + TunnelOpenVPN:
		return ParsePIACatalog(sourceContents)
	case "ipvanish/" + TunnelOpenVPN:
		return ParseIPVanishCatalog(sourceContents[0])
	case "nordvpn/" + TunnelOpenVPN:
		return ParseNordVPNCatalog(sourceContents[0])
	case "nordvpn/" + TunnelWireGuard:
		return ParseNordVPNWireGuardCatalog(sourceContents[0])
	case "surfshark/" + TunnelOpenVPN:
		return ParseSurfsharkCatalog(sourceContents[0])
	case "surfshark/" + TunnelWireGuard:
		return ParseSurfsharkWireGuardCatalog(sourceContents[0])
	case "ivpn/" + TunnelOpenVPN:
		return ParseIVPNCatalog(sourceContents)
	case "ivpn/" + TunnelWireGuard:
		return ParseIVPNWireGuardCatalog(sourceContents[0])
	case "mullvad/" + TunnelWireGuard:
		return ParseMullvadWireGuardCatalog(sourceContents[0])
	default:
		return nil, errors.New("the VPN catalog adapter is unavailable")
	}
}

// parseZIPProfiles validates one bounded provider archive into normalized profiles.
//
// Callers supply provider-specific resource limits and metadata decoration while path,
// decompression, profile validation, and deterministic sorting remain shared.
func parseZIPProfiles(
	providerID string,
	catalogName string,
	content []byte,
	maximumArchiveBytes int,
	maximumEntries int,
	maximumUncompressedBytes uint64,
	decorate func(*Profile, string),
) ([]Profile, error) {
	return parseMatchingZIPProfiles(
		providerID,
		catalogName,
		content,
		maximumArchiveBytes,
		maximumEntries,
		maximumUncompressedBytes,
		nil,
		decorate,
	)
}

// parseMatchingZIPProfiles validates the profiles an adapter selects from one archive.
//
// An archive can carry variants a provider keeps for older clients; include skips them
// by path before they are read, while every entry still counts toward the limits.
func parseMatchingZIPProfiles(
	providerID string,
	catalogName string,
	content []byte,
	maximumArchiveBytes int,
	maximumEntries int,
	maximumUncompressedBytes uint64,
	include func(string) bool,
	decorate func(*Profile, string),
) ([]Profile, error) {
	if len(content) == 0 {
		return nil, fmt.Errorf("%s catalog is empty", catalogName)
	}
	if len(content) > maximumArchiveBytes {
		return nil, fmt.Errorf("%s catalog exceeds %d bytes", catalogName, maximumArchiveBytes)
	}

	archiveReader, err := zip.NewReader(bytes.NewReader(content), int64(len(content)))
	if err != nil {
		return nil, fmt.Errorf("open %s catalog: %w", catalogName, err)
	}
	if len(archiveReader.File) > maximumEntries {
		return nil, fmt.Errorf("%s catalog contains more than %d entries", catalogName, maximumEntries)
	}

	profiles := []Profile{}
	totalUncompressedBytes := uint64(0)
	for _, archiveFile := range archiveReader.File {
		totalUncompressedBytes += archiveFile.UncompressedSize64
		if totalUncompressedBytes > maximumUncompressedBytes {
			return nil, fmt.Errorf("%s catalog expands beyond the allowed size", catalogName)
		}

		cleanedName := filepath.ToSlash(filepath.Clean(archiveFile.Name))
		if strings.HasPrefix(cleanedName, "../") || strings.HasPrefix(cleanedName, "/") {
			return nil, fmt.Errorf("%s catalog contains an unsafe path: %s", catalogName, archiveFile.Name)
		}
		if archiveFile.FileInfo().IsDir() ||
			!strings.HasSuffix(strings.ToLower(cleanedName), ".ovpn") {
			continue
		}
		if include != nil && !include(cleanedName) {
			continue
		}
		if archiveFile.UncompressedSize64 > maximumProfileBytes {
			return nil, fmt.Errorf("%s profile is too large: %s", catalogName, archiveFile.Name)
		}

		profileContent, err := readZIPFile(archiveFile)
		if err != nil {
			return nil, err
		}
		profileName := filepath.Base(cleanedName)
		profile, err := NormalizeOpenVPNProfile(providerID, profileName, profileContent)
		clear(profileContent)
		if err != nil {
			return nil, fmt.Errorf("validate %s profile %s: %w", catalogName, archiveFile.Name, err)
		}
		decorate(&profile, profileName)
		profiles = append(profiles, profile)
	}

	if len(profiles) == 0 {
		return nil, fmt.Errorf("%s catalog does not contain OpenVPN profiles", catalogName)
	}

	sort.Slice(profiles, func(leftIndex int, rightIndex int) bool {
		if profiles[leftIndex].DisplayName == profiles[rightIndex].DisplayName {
			if profiles[leftIndex].Protocol == profiles[rightIndex].Protocol {
				return profiles[leftIndex].ID < profiles[rightIndex].ID
			}

			return profiles[leftIndex].Protocol < profiles[rightIndex].Protocol
		}

		return profiles[leftIndex].DisplayName < profiles[rightIndex].DisplayName
	})

	return profiles, nil
}
