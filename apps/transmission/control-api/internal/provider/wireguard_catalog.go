package provider

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/netip"
	"sort"
	"strings"
)

const (
	// maximumWireGuardCatalogServers bounds how many servers one list may publish.
	//
	// NordVPN lists about 7,000 today; the cap leaves room to grow while refusing a list
	// that is clearly not a provider's server catalog.
	maximumWireGuardCatalogServers = 30000

	// wireGuardDefaultPort is the port most providers listen on for WireGuard.
	wireGuardDefaultPort = 51820
)

// wireGuardServer is one server read from a provider's public list.
//
// Adapters fill it from their own JSON shape, and buildWireGuardCatalog turns it into a
// keyless template profile with location labels.
type wireGuardServer struct {
	name         string
	countryCode  string
	countryName  string
	city         string
	label        string
	publicKey    string
	endpointHost string
	endpointPort int
}

// wireGuardDefaults are the interface settings a provider uses for every server.
//
// DNS servers are the provider's in-tunnel resolvers. A fixed address is set only for
// providers that give every key the same one.
type wireGuardDefaults struct {
	addresses  []netip.Prefix
	dnsServers []netip.Addr
}

// decodeWireGuardCatalog reads a provider's JSON list into the adapter's own shape.
//
// Unknown fields are ignored because providers add fields over time; only the fields an
// adapter uses are validated afterwards.
func decodeWireGuardCatalog(catalogName string, content []byte, target any) error {
	if len(bytes.TrimSpace(content)) == 0 {
		return fmt.Errorf("%s server list is empty", catalogName)
	}
	if err := json.Unmarshal(content, target); err != nil {
		return fmt.Errorf("read %s server list: %w", catalogName, err)
	}

	return nil
}

// buildWireGuardCatalog turns servers into sorted, deduplicated template profiles.
//
// Every server must yield a valid template, so a list that changed shape fails the
// whole refresh and the previous catalog stays in place.
func buildWireGuardCatalog(
	providerID string,
	catalogName string,
	servers []wireGuardServer,
	defaults wireGuardDefaults,
) ([]Profile, error) {
	if len(servers) > maximumWireGuardCatalogServers {
		return nil, fmt.Errorf("%s server list has more than %d servers", catalogName, maximumWireGuardCatalogServers)
	}

	profiles := make([]Profile, 0, len(servers))
	identifiers := make(map[string]struct{}, len(servers))
	for index, server := range servers {
		template := WireGuardConfig{
			Addresses:     append([]netip.Prefix(nil), defaults.addresses...),
			DNSServers:    append([]netip.Addr(nil), defaults.dnsServers...),
			PeerPublicKey: strings.TrimSpace(server.publicKey),
			EndpointHost:  strings.ToLower(strings.TrimSpace(server.endpointHost)),
			EndpointPort:  server.endpointPort,
		}
		profile, err := newWireGuardTemplateProfile(providerID, server.name, template)
		if err != nil {
			return nil, fmt.Errorf("%s server %d: %w", catalogName, index+1, err)
		}
		if _, duplicate := identifiers[profile.ID]; duplicate {
			continue
		}
		identifiers[profile.ID] = struct{}{}

		applyWireGuardLocation(&profile, server)
		profiles = append(profiles, profile)
	}

	if len(profiles) == 0 {
		return nil, fmt.Errorf("%s server list does not contain WireGuard servers", catalogName)
	}

	sort.Slice(profiles, func(leftIndex int, rightIndex int) bool {
		if profiles[leftIndex].DisplayName == profiles[rightIndex].DisplayName {
			return profiles[leftIndex].ID < profiles[rightIndex].ID
		}

		return profiles[leftIndex].DisplayName < profiles[rightIndex].DisplayName
	})

	return profiles, nil
}

// applyWireGuardLocation labels a template from the server's country and city.
//
// The country table supplies the canonical name and continent; a country it doesn't
// know keeps the provider's own name so the server is still searchable.
func applyWireGuardLocation(profile *Profile, server wireGuardServer) {
	city := strings.TrimSpace(server.city)
	location, found := locationByCode(server.countryCode)
	if !found && server.countryName != "" {
		location, found = locationByCountrySlug(server.countryName)
	}
	if !found {
		country := strings.TrimSpace(server.countryName)
		if country == "" {
			country = strings.ToUpper(strings.TrimSpace(server.countryCode))
		}
		location = locationMetadata{
			Code:    strings.ToUpper(strings.TrimSpace(server.countryCode)),
			Country: country,
		}
	}
	if normalizeLocationText(city) == normalizeLocationText(location.Country) {
		city = ""
	}

	applyLocation(profile, location, city, server.label)
}

// mustWireGuardAddresses parses fixed provider addresses at package start.
//
// The values are constants in this package, so a parse failure is a programming error.
func mustWireGuardAddresses(values ...string) []netip.Prefix {
	prefixes := make([]netip.Prefix, 0, len(values))
	for _, value := range values {
		prefixes = append(prefixes, netip.MustParsePrefix(value))
	}

	return prefixes
}

// mustWireGuardDNS parses fixed provider DNS servers at package start.
func mustWireGuardDNS(values ...string) []netip.Addr {
	addresses := make([]netip.Addr, 0, len(values))
	for _, value := range values {
		addresses = append(addresses, netip.MustParseAddr(value))
	}

	return addresses
}
