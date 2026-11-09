package provider

import (
	"archive/zip"
	"bytes"
	"os"
	"strings"
	"testing"
)

// TestParseNordVPNCatalog keeps the 2.6 profiles and labels each kind of server.
//
// Legacy copies would fail validation on tun-mtu-extra, so parsing the fixture also
// proves they are skipped before they are read.
func TestParseNordVPNCatalog(testingObject *testing.T) {
	currentProfile := strings.Replace(validProfile, "dev tun", "dev tun\nping-timer-rem", 1)
	legacyProfile := strings.Replace(validProfile, "dev tun", "dev tun\ntun-mtu-extra 32", 1)
	archive := catalogFixtureEntries(testingObject, map[string]string{
		"ovpn_udp/us1234.nordvpn.com.udp_2.6.ovpn":    currentProfile,
		"ovpn_tcp/us1234.nordvpn.com.tcp_2.6.ovpn":    strings.Replace(currentProfile, "proto udp", "proto tcp", 1),
		"ovpn_udp/us1234.nordvpn.com.udp.ovpn":        legacyProfile,
		"ovpn_udp/uk-nl10.nordvpn.com.udp_2.6.ovpn":   currentProfile,
		"ovpn_udp/nl-onion1.nordvpn.com.udp_2.6.ovpn": currentProfile,
	})

	profiles, err := ParseNordVPNCatalog(archive)
	if err != nil {
		testingObject.Fatalf("parse NordVPN catalog: %v", err)
	}

	got := map[string]string{}
	for _, profile := range profiles {
		got[profile.DisplayName+" "+profile.Protocol] = profile.Country
		if strings.Contains(string(profile.Configuration), "ping-timer-rem") {
			testingObject.Fatalf("ping-timer-rem was kept in %s", profile.DisplayName)
		}
	}
	want := map[string]string{
		"Netherlands · Double VPN via United Kingdom · UK-NL10 udp": "Netherlands",
		"Netherlands · Onion over VPN · NL-ONION1 udp":              "Netherlands",
		"United States · US1234 tcp":                                "United States",
		"United States · US1234 udp":                                "United States",
	}
	if len(got) != len(want) {
		testingObject.Fatalf("NordVPN profiles = %v, want %v", got, want)
	}
	for name, country := range want {
		if got[name] != country {
			testingObject.Fatalf("NordVPN profiles = %v, want %v", got, want)
		}
	}
}

// TestOfficialNordVPNCatalog validates an explicitly supplied current provider archive.
//
// Normal test runs skip it; release verification supplies the downloaded archive to
// catch upstream format or directive changes.
func TestOfficialNordVPNCatalog(testingObject *testing.T) {
	catalogPath := os.Getenv("NORDVPN_CATALOG_TEST_PATH")
	if catalogPath == "" {
		testingObject.Skip("NORDVPN_CATALOG_TEST_PATH is not set")
	}

	content, err := os.ReadFile(catalogPath)
	if err != nil {
		testingObject.Fatalf("read official NordVPN catalog: %v", err)
	}
	profiles, err := ParseNordVPNCatalog(content)
	if err != nil {
		testingObject.Fatalf("parse official NordVPN catalog: %v", err)
	}
	if len(profiles) < 5000 {
		testingObject.Fatalf("official NordVPN catalog contains only %d profiles", len(profiles))
	}
	for _, profile := range profiles {
		if profile.Country == "" || profile.Continent == "" {
			testingObject.Fatalf("NordVPN profile lacks location metadata: %+v", profile)
		}
	}
}

// catalogFixtureEntries creates one ZIP catalog holding several files.
func catalogFixtureEntries(testingObject *testing.T, entries map[string]string) []byte {
	testingObject.Helper()

	var archive bytes.Buffer
	archiveWriter := zip.NewWriter(&archive)
	for name, content := range entries {
		entryWriter, err := archiveWriter.Create(name)
		if err != nil {
			testingObject.Fatalf("create catalog entry: %v", err)
		}
		if _, err := entryWriter.Write([]byte(content)); err != nil {
			testingObject.Fatalf("write catalog entry: %v", err)
		}
	}
	if err := archiveWriter.Close(); err != nil {
		testingObject.Fatalf("close catalog: %v", err)
	}

	return archive.Bytes()
}

// nordVPNServerListFixture is a trimmed copy of NordVPN's v2 server list shape.
const nordVPNServerListFixture = `{
  "servers": [
    {"hostname": "uk765.nordvpn.com", "station": "89.35.28.131", "status": "online", "location_ids": [1],
     "technologies": [{"id": 3, "status": "online"}, {"id": 35, "status": "online",
       "metadata": [{"name": "public_key", "value": "` + testWireGuardPublicKey + `"}]}]},
    {"hostname": "us1234.nordvpn.com", "station": "192.0.2.10", "status": "online", "location_ids": [2],
     "technologies": [{"id": 3, "status": "online"}]},
    {"hostname": "us1235.nordvpn.com", "station": "192.0.2.11", "status": "maintenance", "location_ids": [2],
     "technologies": [{"id": 35, "status": "online", "metadata": [{"name": "public_key", "value": "` + testWireGuardPublicKey + `"}]}]}
  ],
  "locations": [
    {"id": 1, "country": {"code": "GB", "name": "United Kingdom", "city": {"name": "London"}}},
    {"id": 2, "country": {"code": "US", "name": "United States", "city": {"name": "New York"}}}
  ],
  "groups": [], "services": [], "technologies": []
}`

// TestParseNordVPNWireGuardCatalog keeps online servers that publish a WireGuard key.
func TestParseNordVPNWireGuardCatalog(testingObject *testing.T) {
	profiles, err := ParseNordVPNWireGuardCatalog([]byte(nordVPNServerListFixture))
	if err != nil {
		testingObject.Fatalf("parse NordVPN server list: %v", err)
	}
	if len(profiles) != 1 {
		testingObject.Fatalf("got %d profiles, want 1: %+v", len(profiles), profiles)
	}

	london := profiles[0]
	if london.DisplayName != "United Kingdom — London · UK765" || london.RemoteHost != "89.35.28.131" ||
		london.RemotePort != 51820 || !strings.HasPrefix(london.ID, "nordvpn:wg-uk765-nordvpn-com:") {
		testingObject.Fatalf("unexpected London profile: %+v", london)
	}
	configuration := string(london.Configuration)
	if !strings.Contains(configuration, "Address = 10.5.0.2/32") ||
		!strings.Contains(configuration, "DNS = 103.86.96.100, 103.86.99.100") ||
		strings.Contains(configuration, "PrivateKey") {
		testingObject.Fatalf("unexpected template:\n%s", configuration)
	}

	if _, err := ParseNordVPNWireGuardCatalog([]byte(`{"servers": [], "locations": []}`)); err == nil {
		testingObject.Fatal("an empty server list was accepted")
	}
}

// TestOfficialNordVPNWireGuardCatalog validates an explicitly supplied current server list.
func TestOfficialNordVPNWireGuardCatalog(testingObject *testing.T) {
	assertOfficialWireGuardCatalog(testingObject, "NORDVPN_WIREGUARD_CATALOG_TEST_PATH", 5000, ParseNordVPNWireGuardCatalog)
}
