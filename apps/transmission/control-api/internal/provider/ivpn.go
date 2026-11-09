package provider

import (
	"errors"
	"fmt"
	"path/filepath"
	"strings"
)

const (
	// IVPNUDPCatalogURL is the UDP archive IVPN's own setup pages offer, one profile per
	// location on IVPN's default UDP port.
	IVPNUDPCatalogURL = "https://api.ivpn.net/v5/config/ivpn-openvpn-config.zip?proto=udp&port=2049"

	// IVPNTCPCatalogURL is the matching TCP archive on port 443, which gets through
	// networks that only allow web traffic.
	IVPNTCPCatalogURL = "https://api.ivpn.net/v5/config/ivpn-openvpn-config.zip?proto=tcp&port=443"
)

const (
	maximumIVPNArchiveBytes      = 8 * 1024 * 1024
	maximumIVPNArchiveEntries    = 1000
	maximumIVPNUncompressedBytes = 32 * 1024 * 1024
)

// ParseIVPNCatalog validates and merges IVPN's UDP and TCP archives.
//
// Both are required, like PIA's, so a refresh never keeps one transport's locations
// while silently losing the other's.
func ParseIVPNCatalog(sourceContents [][]byte) ([]Profile, error) {
	if len(sourceContents) != 2 {
		return nil, errors.New("IVPN catalog requires UDP and TCP archives")
	}

	profiles := []Profile{}
	for index, content := range sourceContents {
		catalogName := "IVPN UDP"
		if index == 1 {
			catalogName = "IVPN TCP"
		}
		archiveProfiles, err := parseZIPProfiles(
			"ivpn",
			catalogName,
			content,
			maximumIVPNArchiveBytes,
			maximumIVPNArchiveEntries,
			maximumIVPNUncompressedBytes,
			decorateIVPNProfile,
		)
		if err != nil {
			return nil, err
		}
		profiles = append(profiles, archiveProfiles...)
	}

	identifiers := map[string]struct{}{}
	for _, profile := range profiles {
		if _, found := identifiers[profile.ID]; found {
			return nil, fmt.Errorf("IVPN catalog contains duplicate profile %s", profile.ID)
		}
		identifiers[profile.ID] = struct{}{}
	}

	return profiles, nil
}

// decorateIVPNProfile derives the country and city from a profile filename.
//
// IVPN names profiles Country-City, with underscores for spaces and -TCP on the TCP
// copies; it writes the United States as USA, and repeats a city-state's name as its city.
func decorateIVPNProfile(profile *Profile, profileName string) {
	baseName := strings.TrimSuffix(filepath.Base(profileName), filepath.Ext(profileName))
	baseName = strings.TrimSuffix(baseName, "-TCP")
	countryName, cityName, found := strings.Cut(baseName, "-")
	if !found {
		return
	}

	location, found := locationByCountrySlug(countryName)
	if !found && strings.EqualFold(countryName, "USA") {
		location, found = locationByCode("US")
	}
	if !found {
		return
	}

	city := titleLocationPart(cityName)
	if normalizeLocationText(city) == normalizeLocationText(location.Country) {
		city = ""
	}
	applyLocation(profile, location, city, "")
}

// ivpnWireGuardPort is the port IVPN's own WireGuard setup guides use.
const ivpnWireGuardPort = 2049

// ivpnWireGuardDefaults holds the interface settings every IVPN server shares.
//
// IVPN's in-tunnel resolver is 172.16.0.1. IVPN assigns each key its own tunnel
// address, so the user supplies it with the key.
var ivpnWireGuardDefaults = wireGuardDefaults{
	dnsServers: mustWireGuardDNS("172.16.0.1"),
}

// ParseIVPNWireGuardCatalog validates IVPN's server list into WireGuard templates.
//
// Active servers outside maintenance that publish a WireGuard host and key are kept.
// Each template connects to that host on port 2049.
func ParseIVPNWireGuardCatalog(content []byte) ([]Profile, error) {
	var list struct {
		Servers []struct {
			CountryCode   string `json:"country_code"`
			Country       string `json:"country"`
			City          string `json:"city"`
			IsActive      bool   `json:"is_active"`
			InMaintenance bool   `json:"in_maintenance"`
			PublicKey     string `json:"wg_public_key"`
			Hostnames     struct {
				WireGuard string `json:"wireguard"`
			} `json:"hostnames"`
		} `json:"servers"`
	}
	if err := decodeWireGuardCatalog("IVPN", content, &list); err != nil {
		return nil, err
	}

	servers := make([]wireGuardServer, 0, len(list.Servers))
	for _, server := range list.Servers {
		if !server.IsActive || server.InMaintenance ||
			strings.TrimSpace(server.PublicKey) == "" || server.Hostnames.WireGuard == "" {
			continue
		}
		serverName, _, _ := strings.Cut(strings.ToLower(server.Hostnames.WireGuard), ".")
		servers = append(servers, wireGuardServer{
			name:         server.Hostnames.WireGuard,
			countryCode:  server.CountryCode,
			countryName:  server.Country,
			city:         server.City,
			label:        strings.ToUpper(serverName),
			publicKey:    server.PublicKey,
			endpointHost: server.Hostnames.WireGuard,
			endpointPort: ivpnWireGuardPort,
		})
	}

	return buildWireGuardCatalog("ivpn", "IVPN", servers, ivpnWireGuardDefaults)
}
