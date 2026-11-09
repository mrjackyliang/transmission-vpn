package provider

import "strings"

// mullvadWireGuardDefaults holds the interface settings every Mullvad relay shares.
//
// Mullvad's in-tunnel resolver is 10.64.0.1. Mullvad assigns each key its own tunnel
// address, so the user supplies it with the key.
var mullvadWireGuardDefaults = wireGuardDefaults{
	dnsServers: mustWireGuardDNS("10.64.0.1"),
}

// ParseMullvadWireGuardCatalog validates Mullvad's relay list into WireGuard templates.
//
// Only active WireGuard relays are kept; bridge relays are skipped. Each template
// connects to the relay's IPv4 entry address on port 51820.
func ParseMullvadWireGuardCatalog(content []byte) ([]Profile, error) {
	var relays []struct {
		Hostname    string `json:"hostname"`
		CountryCode string `json:"country_code"`
		CountryName string `json:"country_name"`
		CityName    string `json:"city_name"`
		Active      bool   `json:"active"`
		Type        string `json:"type"`
		IPv4AddrIn  string `json:"ipv4_addr_in"`
		PublicKey   string `json:"pubkey"`
	}
	if err := decodeWireGuardCatalog("Mullvad", content, &relays); err != nil {
		return nil, err
	}

	servers := make([]wireGuardServer, 0, len(relays))
	for _, relay := range relays {
		if relay.Type != "wireguard" || !relay.Active {
			continue
		}
		servers = append(servers, wireGuardServer{
			name:         relay.Hostname,
			countryCode:  relay.CountryCode,
			countryName:  relay.CountryName,
			city:         relay.CityName,
			label:        strings.ToUpper(relay.Hostname),
			publicKey:    relay.PublicKey,
			endpointHost: relay.IPv4AddrIn,
			endpointPort: wireGuardDefaultPort,
		})
	}

	return buildWireGuardCatalog("mullvad", "Mullvad", servers, mullvadWireGuardDefaults)
}
