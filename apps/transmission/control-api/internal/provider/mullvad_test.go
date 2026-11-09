package provider

import (
	"os"
	"strings"
	"testing"
)

// mullvadRelayFixture is a trimmed copy of Mullvad's relay list shape.
const mullvadRelayFixture = `[
  {"hostname": "se-sto-wg-001", "country_code": "se", "country_name": "Sweden", "city_name": "Stockholm",
   "active": true, "type": "wireguard", "ipv4_addr_in": "185.213.154.68", "pubkey": "` + testWireGuardPublicKey + `"},
  {"hostname": "gb-lon-wg-002", "country_code": "gb", "country_name": "UK", "city_name": "London",
   "active": true, "type": "wireguard", "ipv4_addr_in": "141.98.252.130", "pubkey": "` + testWireGuardPublicKey + `"},
  {"hostname": "se-sto-wg-009", "country_code": "se", "country_name": "Sweden", "city_name": "Stockholm",
   "active": false, "type": "wireguard", "ipv4_addr_in": "185.213.154.99", "pubkey": "` + testWireGuardPublicKey + `"},
  {"hostname": "se-got-br-001", "country_code": "se", "country_name": "Sweden", "city_name": "Gothenburg",
   "active": true, "type": "bridge", "ipv4_addr_in": "185.213.152.1", "pubkey": ""}
]`

// TestParseMullvadWireGuardCatalog keeps active WireGuard relays as keyless templates.
func TestParseMullvadWireGuardCatalog(testingObject *testing.T) {
	profiles, err := ParseMullvadWireGuardCatalog([]byte(mullvadRelayFixture))
	if err != nil {
		testingObject.Fatalf("parse Mullvad relays: %v", err)
	}
	if len(profiles) != 2 {
		testingObject.Fatalf("got %d profiles, want 2 active WireGuard relays: %+v", len(profiles), profiles)
	}

	stockholm := profiles[0]
	if stockholm.DisplayName != "Sweden — Stockholm · SE-STO-WG-001" || stockholm.Tunnel != TunnelWireGuard ||
		stockholm.RemoteHost != "185.213.154.68" || stockholm.RemotePort != 51820 ||
		!strings.HasPrefix(stockholm.ID, "mullvad:wg-se-sto-wg-001:") || stockholm.Continent != "Europe" {
		testingObject.Fatalf("unexpected Stockholm profile: %+v", stockholm)
	}
	if strings.Contains(string(stockholm.Configuration), "PrivateKey") ||
		!strings.Contains(string(stockholm.Configuration), "DNS = 10.64.0.1") ||
		strings.Contains(string(stockholm.Configuration), "Address") {
		testingObject.Fatalf("unexpected template:\n%s", stockholm.Configuration)
	}
	if profiles[1].CountryCode != "GB" || profiles[1].Country != "United Kingdom" {
		testingObject.Fatalf("GB relay was not labeled as the United Kingdom: %+v", profiles[1])
	}

	for name, content := range map[string]string{
		"empty":     "",
		"malformed": "{",
		"no relays": "[]",
		"a bad key": strings.Replace(mullvadRelayFixture, testWireGuardPublicKey, "bad", 1),
	} {
		if _, err := ParseMullvadWireGuardCatalog([]byte(content)); err == nil {
			testingObject.Fatalf("%s list was accepted", name)
		}
	}
}

// TestOfficialMullvadWireGuardCatalog validates an explicitly supplied current relay list.
//
// Normal test runs skip it; release verification supplies the downloaded list to catch
// upstream format changes.
func TestOfficialMullvadWireGuardCatalog(testingObject *testing.T) {
	assertOfficialWireGuardCatalog(testingObject, "MULLVAD_WIREGUARD_CATALOG_TEST_PATH", 400, ParseMullvadWireGuardCatalog)
}

// assertOfficialWireGuardCatalog parses a downloaded list and checks every template.
func assertOfficialWireGuardCatalog(
	testingObject *testing.T,
	environmentName string,
	minimumProfiles int,
	parse func([]byte) ([]Profile, error),
) {
	testingObject.Helper()

	catalogPath := os.Getenv(environmentName)
	if catalogPath == "" {
		testingObject.Skip(environmentName + " is not set")
	}
	content, err := os.ReadFile(catalogPath)
	if err != nil {
		testingObject.Fatalf("read official server list: %v", err)
	}
	profiles, err := parse(content)
	if err != nil {
		testingObject.Fatalf("parse official server list: %v", err)
	}
	if len(profiles) < minimumProfiles {
		testingObject.Fatalf("official server list has only %d WireGuard templates", len(profiles))
	}
	for _, profile := range profiles {
		if profile.Country == "" || profile.Continent == "" {
			testingObject.Fatalf("WireGuard template lacks location metadata: %+v", profile)
		}
		if _, err := parseWireGuardConfig(profile.Configuration); err != nil {
			testingObject.Fatalf("WireGuard template %s does not parse: %v", profile.ID, err)
		}
	}
}
