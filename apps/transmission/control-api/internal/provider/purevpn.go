package provider

import (
	"archive/zip"
	"bytes"
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"sort"
	"strings"
)

// PureVPNCatalogURL is the official recommended OpenVPN profile bundle.
//
// Refreshes are administrator-initiated, HTTPS-only, size-bounded, and fully validated
// before any profile replaces the last known catalog.
const PureVPNCatalogURL = "https://d11a57lttb2ffq.cloudfront.net/heartbleed/router/Recommended-CA2.zip"

const (
	maximumPureVPNArchiveBytes      = 32 * 1024 * 1024
	maximumPureVPNArchiveEntries    = 1000
	maximumPureVPNUncompressedBytes = 128 * 1024 * 1024
)

// ParsePureVPNCatalog validates the official ZIP bundle into normalized endpoints.
//
// Path traversal, archive bombs, non-profile content, and unsafe OpenVPN directives are
// rejected before the catalog can be persisted or activated.
func ParsePureVPNCatalog(content []byte) ([]Profile, error) {
	if len(content) == 0 {
		return nil, errors.New("PureVPN catalog is empty")
	}

	if len(content) > maximumPureVPNArchiveBytes {
		return nil, fmt.Errorf("PureVPN catalog exceeds %d bytes", maximumPureVPNArchiveBytes)
	}

	archiveReader, err := zip.NewReader(bytes.NewReader(content), int64(len(content)))
	if err != nil {
		return nil, fmt.Errorf("open PureVPN catalog: %w", err)
	}

	if len(archiveReader.File) > maximumPureVPNArchiveEntries {
		return nil, fmt.Errorf("PureVPN catalog contains more than %d entries", maximumPureVPNArchiveEntries)
	}

	profiles := []Profile{}
	totalUncompressedBytes := uint64(0)
	for _, archiveFile := range archiveReader.File {
		totalUncompressedBytes += archiveFile.UncompressedSize64
		if totalUncompressedBytes > maximumPureVPNUncompressedBytes {
			return nil, errors.New("PureVPN catalog expands beyond the allowed size")
		}

		cleanedName := filepath.ToSlash(filepath.Clean(archiveFile.Name))
		if strings.HasPrefix(cleanedName, "../") || strings.HasPrefix(cleanedName, "/") {
			return nil, fmt.Errorf("PureVPN catalog contains an unsafe path: %s", archiveFile.Name)
		}

		if archiveFile.FileInfo().IsDir() ||
			!strings.HasSuffix(strings.ToLower(cleanedName), ".ovpn") {
			continue
		}

		if archiveFile.UncompressedSize64 > maximumProfileBytes {
			return nil, fmt.Errorf("PureVPN profile is too large: %s", archiveFile.Name)
		}

		profileContent, err := readZIPFile(archiveFile)
		if err != nil {
			return nil, err
		}

		profile, err := NormalizeOpenVPNProfile(
			"purevpn",
			filepath.Base(cleanedName),
			profileContent,
		)
		if err != nil {
			return nil, fmt.Errorf("validate PureVPN profile %s: %w", archiveFile.Name, err)
		}
		decoratePureVPNProfile(&profile, filepath.Base(cleanedName))

		profiles = append(profiles, profile)
	}

	if len(profiles) == 0 {
		return nil, errors.New("PureVPN catalog does not contain OpenVPN profiles")
	}

	sort.Slice(profiles, func(leftIndex int, rightIndex int) bool {
		return profiles[leftIndex].DisplayName < profiles[rightIndex].DisplayName
	})

	return profiles, nil
}

// decoratePureVPNProfile resolves the leading country code in a server filename.
//
// PureVPN names profiles with a country code and numbered endpoint before transport
// details, which provides stable country filtering even when no city is published.
func decoratePureVPNProfile(profile *Profile, profileName string) {
	baseName := strings.TrimSuffix(filepath.Base(profileName), filepath.Ext(profileName))
	serverName, _, _ := strings.Cut(baseName, "-")
	countryCodeEnd := 0
	for countryCodeEnd < len(serverName) {
		character := serverName[countryCodeEnd]
		if (character < 'a' || character > 'z') && (character < 'A' || character > 'Z') {
			break
		}
		countryCodeEnd++
	}
	if countryCodeEnd == 0 {
		return
	}

	location, found := locationByCode(serverName[:countryCodeEnd])
	if !found {
		return
	}
	applyLocation(profile, location, "", strings.ToUpper(serverName))
}

// readZIPFile reads one profile through a second hard size limit.
//
// Metadata sizes are not trusted by themselves, so a limited reader prevents a crafted
// entry from returning more bytes than advertised during decompression.
func readZIPFile(archiveFile *zip.File) ([]byte, error) {
	reader, err := archiveFile.Open()
	if err != nil {
		return nil, fmt.Errorf("open catalog entry %s: %w", archiveFile.Name, err)
	}
	defer reader.Close()

	limitedReader := io.LimitReader(reader, maximumProfileBytes+1)
	content, err := io.ReadAll(limitedReader)
	if err != nil {
		return nil, fmt.Errorf("read catalog entry %s: %w", archiveFile.Name, err)
	}

	if len(content) > maximumProfileBytes {
		return nil, fmt.Errorf("catalog entry exceeds profile limit: %s", archiveFile.Name)
	}

	return content, nil
}
