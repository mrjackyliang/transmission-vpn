package provider

import (
	"os"
	"strings"
	"testing"
)

// TestParseSurfsharkCatalog names each location's city, or shows its airport code
// when the location is newer than the city table.
func TestParseSurfsharkCatalog(testingObject *testing.T) {
	archive := catalogFixtureEntries(testingObject, map[string]string{
		"es-mad.prod.surfshark.com_udp.ovpn": validProfile,
		"es-xyz.prod.surfshark.com_udp.ovpn": validProfile,
	})

	profiles, err := ParseSurfsharkCatalog(archive)
	if err != nil {
		testingObject.Fatalf("parse Surfshark catalog: %v", err)
	}
	if len(profiles) != 2 ||
		profiles[0].DisplayName != "Spain — Madrid" || profiles[0].City != "Madrid" ||
		profiles[1].DisplayName != "Spain — XYZ" || profiles[1].Continent != "Europe" {
		testingObject.Fatalf("unexpected Surfshark profiles: %+v", profiles)
	}
}

// TestOfficialSurfsharkCatalog validates an explicitly supplied current provider archive.
func TestOfficialSurfsharkCatalog(testingObject *testing.T) {
	catalogPath := os.Getenv("SURFSHARK_CATALOG_TEST_PATH")
	if catalogPath == "" {
		testingObject.Skip("SURFSHARK_CATALOG_TEST_PATH is not set")
	}

	content, err := os.ReadFile(catalogPath)
	if err != nil {
		testingObject.Fatalf("read official Surfshark catalog: %v", err)
	}
	profiles, err := ParseSurfsharkCatalog(content)
	if err != nil {
		testingObject.Fatalf("parse official Surfshark catalog: %v", err)
	}
	if len(profiles) < 200 {
		testingObject.Fatalf("official Surfshark catalog contains only %d profiles", len(profiles))
	}
	for _, profile := range profiles {
		if profile.Country == "" || profile.Continent == "" || profile.City == "" {
			testingObject.Fatalf("Surfshark profile lacks location metadata: %+v", profile)
		}
	}
}

// surfsharkClusterFixture is a trimmed copy of Surfshark's cluster list shape.
const surfsharkClusterFixture = `[
  {"connectionName": "es-mad.prod.surfshark.com", "countryCode": "ES", "country": "Spain", "location": "Madrid",
   "pubKey": "` + testWireGuardPublicKey + `", "type": "generic"},
  {"connectionName": "uk-lon.prod.surfshark.com", "countryCode": "GB", "country": "United Kingdom", "location": "London",
   "pubKey": "` + testWireGuardPublicKey + `", "type": "generic"},
  {"connectionName": "xx-new.prod.surfshark.com", "countryCode": "ES", "country": "Spain", "location": "Valencia",
   "pubKey": "", "type": "generic"}
]`

// TestParseSurfsharkWireGuardCatalog keeps clusters with a key, on Surfshark's fixed address.
func TestParseSurfsharkWireGuardCatalog(testingObject *testing.T) {
	profiles, err := ParseSurfsharkWireGuardCatalog([]byte(surfsharkClusterFixture))
	if err != nil {
		testingObject.Fatalf("parse Surfshark clusters: %v", err)
	}
	if len(profiles) != 2 || profiles[0].DisplayName != "Spain — Madrid" ||
		profiles[0].RemoteHost != "es-mad.prod.surfshark.com" || profiles[1].Country != "United Kingdom" {
		testingObject.Fatalf("unexpected Surfshark profiles: %+v", profiles)
	}
	if !strings.Contains(string(profiles[0].Configuration), "Address = 10.14.0.2/16") {
		testingObject.Fatalf("template lacks Surfshark's address:\n%s", profiles[0].Configuration)
	}
}

// TestOfficialSurfsharkWireGuardCatalog validates an explicitly supplied current cluster list.
func TestOfficialSurfsharkWireGuardCatalog(testingObject *testing.T) {
	assertOfficialWireGuardCatalog(testingObject, "SURFSHARK_WIREGUARD_CATALOG_TEST_PATH", 100, ParseSurfsharkWireGuardCatalog)
}
