package provider

import (
	"path/filepath"
	"strings"
)

const (
	maximumIPVanishArchiveBytes      = 16 * 1024 * 1024
	maximumIPVanishArchiveEntries    = 5000
	maximumIPVanishUncompressedBytes = 96 * 1024 * 1024
)

// ParseIPVanishCatalog validates the provider's public OpenVPN 2.6 archive.
//
// The current catalog contains one self-contained UDP profile per physical server;
// archive and expansion limits leave bounded headroom for ordinary provider growth.
func ParseIPVanishCatalog(content []byte) ([]Profile, error) {
	return parseZIPProfiles(
		"ipvanish",
		"IPVanish",
		content,
		maximumIPVanishArchiveBytes,
		maximumIPVanishArchiveEntries,
		maximumIPVanishUncompressedBytes,
		decorateIPVanishProfile,
	)
}

// decorateIPVanishProfile extracts country, city, virtual status, and server identity.
//
// Parsing works from the right-hand airport and host tokens so multi-word city names
// remain intact and virtual locations can be labeled without changing filter metadata.
func decorateIPVanishProfile(profile *Profile, profileName string) {
	baseName := strings.TrimSuffix(filepath.Base(profileName), filepath.Ext(profileName))
	parts := strings.Split(baseName, "-")
	compactedParts := make([]string, 0, len(parts))
	for _, part := range parts {
		if part != "" {
			compactedParts = append(compactedParts, part)
		}
	}
	if len(compactedParts) < 5 || !strings.EqualFold(compactedParts[0], "ipvanish") {
		return
	}

	location, found := locationByCode(compactedParts[1])
	if !found {
		return
	}
	serverParts := compactedParts[len(compactedParts)-2:]
	locationParts := compactedParts[2 : len(compactedParts)-2]
	virtual := false
	cityParts := make([]string, 0, len(locationParts))
	for _, part := range locationParts {
		if strings.EqualFold(part, "virtual") {
			virtual = true
			continue
		}
		cityParts = append(cityParts, part)
	}

	city := titleLocationPart(strings.Join(cityParts, "-"))
	serverName := strings.ToUpper(strings.Join(serverParts, "-"))
	if virtual {
		serverName = "Virtual · " + serverName
	}
	applyLocation(profile, location, city, serverName)
}
