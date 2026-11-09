package provider

import (
	"path/filepath"
	"strings"
	"time"
)

const (
	maximumNordVPNArchiveBytes      = 128 * 1024 * 1024
	maximumNordVPNArchiveEntries    = 60000
	maximumNordVPNUncompressedBytes = 256 * 1024 * 1024

	// nordVPNCatalogTimeout lets the archive, about 70 MB, finish over a slow connection.
	nordVPNCatalogTimeout = 3 * time.Minute
)

// ParseNordVPNCatalog validates the OpenVPN 2.6 profiles in NordVPN's public archive.
//
// The archive repeats every server for older OpenVPN clients; only the 2.6 UDP and TCP
// profiles are kept, so each server appears once per transport.
func ParseNordVPNCatalog(content []byte) ([]Profile, error) {
	return parseMatchingZIPProfiles(
		"nordvpn",
		"NordVPN",
		content,
		maximumNordVPNArchiveBytes,
		maximumNordVPNArchiveEntries,
		maximumNordVPNUncompressedBytes,
		isNordVPNCurrentProfile,
		decorateNordVPNProfile,
	)
}

// isNordVPNCurrentProfile keeps the profiles NordVPN publishes for OpenVPN 2.6.
//
// Their names end in _2.6.ovpn in both the UDP and TCP folders; the other copies repeat
// every server with settings meant for clients older than OpenVPN 2.6.
func isNordVPNCurrentProfile(profilePath string) bool {
	return strings.HasSuffix(strings.ToLower(profilePath), "_2.6.ovpn")
}

// decorateNordVPNProfile labels a server by the country in its host name.
//
// Most hosts are a country code and a number, such as us1234. Double VPN hosts name the
// entry country, then the exit country, such as uk-nl10, and are filed under the exit;
// Onion over VPN hosts end in onion and a number, such as nl-onion1.
func decorateNordVPNProfile(profile *Profile, profileName string) {
	hostName, _, found := strings.Cut(strings.ToLower(filepath.Base(profileName)), ".nordvpn.com")
	if !found || hostName == "" {
		return
	}

	serverName := strings.ToUpper(hostName)
	countryCode := leadingLetters(hostName)
	label := serverName
	if entryCode, routeName, hasRoute := strings.Cut(hostName, "-"); hasRoute {
		routeCode := leadingLetters(routeName)
		switch {
		case routeCode == "onion":
			label = "Onion over VPN · " + serverName
		case len(routeCode) == 2:
			if entry, entryFound := locationByCode(entryCode); entryFound {
				countryCode = routeCode
				label = "Double VPN via " + entry.Country + " · " + serverName
			}
		}
	}

	location, found := locationByCode(countryCode)
	if !found {
		return
	}
	applyLocation(profile, location, "", label)
}

// leadingLetters returns the lowercase ASCII letters at the start of a host name.
//
// Provider host names put the country code before a server number or a route, so the
// letters alone identify the location without a pattern per provider.
func leadingLetters(value string) string {
	end := 0
	for end < len(value) && value[end] >= 'a' && value[end] <= 'z' {
		end++
	}

	return value[:end]
}

const (
	// maximumNordVPNServerListBytes caps the NordVPN server list download.
	//
	// The list is about 8 MB today because it describes every server and technology.
	maximumNordVPNServerListBytes = 64 * 1024 * 1024

	// nordVPNServerListTimeout lets the server list finish over a slow connection.
	nordVPNServerListTimeout = 2 * time.Minute

	// nordVPNWireGuardTechnologyID marks NordVPN's WireGuard support on a server.
	nordVPNWireGuardTechnologyID = 35
)

// nordVPNWireGuardDefaults holds the interface settings every NordVPN server shares.
//
// NordVPN gives every key the tunnel address 10.5.0.2, so users only paste their key.
// The DNS servers are NordVPN's own resolvers.
var nordVPNWireGuardDefaults = wireGuardDefaults{
	addresses:  mustWireGuardAddresses("10.5.0.2/32"),
	dnsServers: mustWireGuardDNS("103.86.96.100", "103.86.99.100"),
}

// ParseNordVPNWireGuardCatalog validates NordVPN's server list into WireGuard templates.
//
// Only online servers that list technology 35 with a public key are kept. Each template
// connects to the server's station address on port 51820.
func ParseNordVPNWireGuardCatalog(content []byte) ([]Profile, error) {
	var list struct {
		Servers []struct {
			Hostname     string  `json:"hostname"`
			Station      string  `json:"station"`
			Status       string  `json:"status"`
			LocationIDs  []int64 `json:"location_ids"`
			Technologies []struct {
				ID       int64  `json:"id"`
				Status   string `json:"status"`
				Metadata []struct {
					Name  string `json:"name"`
					Value string `json:"value"`
				} `json:"metadata"`
			} `json:"technologies"`
		} `json:"servers"`
		Locations []struct {
			ID      int64 `json:"id"`
			Country struct {
				Code string `json:"code"`
				Name string `json:"name"`
				City struct {
					Name string `json:"name"`
				} `json:"city"`
			} `json:"country"`
		} `json:"locations"`
	}
	if err := decodeWireGuardCatalog("NordVPN", content, &list); err != nil {
		return nil, err
	}

	type nordVPNLocation struct {
		code    string
		country string
		city    string
	}
	locations := make(map[int64]nordVPNLocation, len(list.Locations))
	for _, location := range list.Locations {
		locations[location.ID] = nordVPNLocation{
			code:    location.Country.Code,
			country: location.Country.Name,
			city:    location.Country.City.Name,
		}
	}

	servers := make([]wireGuardServer, 0, len(list.Servers))
	for _, server := range list.Servers {
		if server.Status != "online" {
			continue
		}

		publicKey := ""
		for _, technology := range server.Technologies {
			if technology.ID != nordVPNWireGuardTechnologyID ||
				(technology.Status != "" && technology.Status != "online") {
				continue
			}
			for _, metadata := range technology.Metadata {
				if metadata.Name == "public_key" {
					publicKey = metadata.Value
				}
			}
		}
		if publicKey == "" {
			continue
		}

		location := nordVPNLocation{}
		if len(server.LocationIDs) > 0 {
			location = locations[server.LocationIDs[0]]
		}
		hostName, _, _ := strings.Cut(strings.ToLower(server.Hostname), ".nordvpn.com")
		servers = append(servers, wireGuardServer{
			name:         server.Hostname,
			countryCode:  location.code,
			countryName:  location.country,
			city:         location.city,
			label:        strings.ToUpper(hostName),
			publicKey:    publicKey,
			endpointHost: server.Station,
			endpointPort: wireGuardDefaultPort,
		})
	}

	return buildWireGuardCatalog("nordvpn", "NordVPN", servers, nordVPNWireGuardDefaults)
}
