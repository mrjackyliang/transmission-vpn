package provider

import (
	"errors"
	"fmt"
	"path/filepath"
	"strings"
)

const (
	maximumPIAArchiveBytes      = 16 * 1024 * 1024
	maximumPIAArchiveEntries    = 500
	maximumPIAUncompressedBytes = 64 * 1024 * 1024
)

// ParsePIACatalog validates and merges PIA's strong UDP and TCP archives.
//
// Both sources are required so the published generation provides transport fallback
// and never silently drops half of a previously complete endpoint catalog.
func ParsePIACatalog(sourceContents [][]byte) ([]Profile, error) {
	if len(sourceContents) != 2 {
		return nil, errors.New("PIA catalog requires UDP and TCP archives")
	}

	profiles := []Profile{}
	for index, content := range sourceContents {
		catalogName := "PIA UDP"
		if index == 1 {
			catalogName = "PIA TCP"
		}
		archiveProfiles, err := parseZIPProfiles(
			"pia",
			catalogName,
			content,
			maximumPIAArchiveBytes,
			maximumPIAArchiveEntries,
			maximumPIAUncompressedBytes,
			decoratePIAProfile,
		)
		if err != nil {
			return nil, err
		}
		profiles = append(profiles, archiveProfiles...)
	}

	identifiers := map[string]struct{}{}
	for _, profile := range profiles {
		if _, found := identifiers[profile.ID]; found {
			return nil, fmt.Errorf("PIA catalog contains duplicate profile %s", profile.ID)
		}
		identifiers[profile.ID] = struct{}{}
	}

	return profiles, nil
}

// decoratePIAProfile derives country and city metadata from a catalog filename.
//
// PIA uses either a country slug or a two-letter prefix followed by a city or region;
// streaming variants retain a concise suffix without becoming a separate geography.
func decoratePIAProfile(profile *Profile, profileName string) {
	baseName := strings.TrimSuffix(filepath.Base(profileName), filepath.Ext(profileName))
	streamingOptimized := strings.HasSuffix(baseName, "_streaming_optimized")
	baseName = strings.TrimSuffix(baseName, "_streaming_optimized")
	parts := strings.Split(baseName, "_")

	var location locationMetadata
	var found bool
	city := ""
	if len(parts) > 0 {
		location, found = locationByCode(parts[0])
		if found && len(parts) > 1 {
			city = titleLocationPart(strings.Join(parts[1:], "_"))
			if normalizeLocationText(city) == normalizeLocationText(location.Country) {
				city = ""
			}
		}
	}
	if !found {
		location, found = locationByCountrySlug(baseName)
	}
	if !found {
		profile.DisplayName = titleLocationPart(baseName)

		return
	}

	suffix := ""
	if streamingOptimized {
		suffix = "Streaming"
	}
	applyLocation(profile, location, city, suffix)
}
