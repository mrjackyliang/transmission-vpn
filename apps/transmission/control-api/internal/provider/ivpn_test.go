package provider

import (
	"os"
	"strings"
	"testing"
)

// TestParseIVPNCatalog reads country and city names across both transport archives.
func TestParseIVPNCatalog(testingObject *testing.T) {
	tcpProfile := strings.Replace(validProfile, "proto udp", "proto tcp", 1)
	profiles, err := ParseIVPNCatalog([][]byte{
		catalogFixtureEntries(testingObject, map[string]string{
			"USA-Salt_Lake_City.ovpn":    validProfile,
			"Hong_Kong-Hong_Kong.ovpn":   validProfile,
			"Czech_Republic-Prague.ovpn": validProfile,
		}),
		catalogFixture(testingObject, "USA-Salt_Lake_City-TCP.ovpn", tcpProfile),
	})
	if err != nil {
		testingObject.Fatalf("parse IVPN catalog: %v", err)
	}

	got := []string{}
	for _, profile := range profiles {
		got = append(got, profile.DisplayName+" "+profile.Protocol+" "+profile.Continent)
	}
	want := "Czech Republic — Prague udp Europe|Hong Kong udp Asia|United States — Salt Lake City udp North America|United States — Salt Lake City tcp North America"
	if strings.Join(got, "|") != want {
		testingObject.Fatalf("IVPN profiles = %q, want %q", strings.Join(got, "|"), want)
	}
}

// TestOfficialIVPNCatalog validates explicitly supplied current UDP and TCP archives.
func TestOfficialIVPNCatalog(testingObject *testing.T) {
	udpPath := os.Getenv("IVPN_UDP_CATALOG_TEST_PATH")
	tcpPath := os.Getenv("IVPN_TCP_CATALOG_TEST_PATH")
	if udpPath == "" || tcpPath == "" {
		testingObject.Skip("IVPN catalog test paths are not set")
	}

	udpContent, err := os.ReadFile(udpPath)
	if err != nil {
		testingObject.Fatalf("read official IVPN UDP catalog: %v", err)
	}
	tcpContent, err := os.ReadFile(tcpPath)
	if err != nil {
		testingObject.Fatalf("read official IVPN TCP catalog: %v", err)
	}
	profiles, err := ParseIVPNCatalog([][]byte{udpContent, tcpContent})
	if err != nil {
		testingObject.Fatalf("parse official IVPN catalog: %v", err)
	}
	if len(profiles) < 80 {
		testingObject.Fatalf("official IVPN catalog contains only %d profiles", len(profiles))
	}
	for _, profile := range profiles {
		if profile.Country == "" || profile.Continent == "" {
			testingObject.Fatalf("IVPN profile lacks location metadata: %+v", profile)
		}
	}
}

// ivpnServerFixture is a trimmed copy of IVPN's server list shape.
const ivpnServerFixture = `{"servers": [
  {"gateway": "us-tx1.gw.ivpn.net", "country_code": "US", "country": "United States", "city": "Dallas, TX",
   "is_active": true, "in_maintenance": false, "wg_public_key": "` + testWireGuardPublicKey + `",
   "hostnames": {"openvpn": "us-tx1.gw.ivpn.net", "wireguard": "us-tx1.wg.ivpn.net"}},
  {"gateway": "gb1.gw.ivpn.net", "country_code": "GB", "country": "United Kingdom", "city": "London",
   "is_active": true, "in_maintenance": true, "wg_public_key": "` + testWireGuardPublicKey + `",
   "hostnames": {"openvpn": "gb1.gw.ivpn.net", "wireguard": "gb1.wg.ivpn.net"}}
]}`

// TestParseIVPNWireGuardCatalog keeps active servers outside maintenance, on port 2049.
func TestParseIVPNWireGuardCatalog(testingObject *testing.T) {
	profiles, err := ParseIVPNWireGuardCatalog([]byte(ivpnServerFixture))
	if err != nil {
		testingObject.Fatalf("parse IVPN servers: %v", err)
	}
	if len(profiles) != 1 || profiles[0].RemoteHost != "us-tx1.wg.ivpn.net" || profiles[0].RemotePort != 2049 ||
		profiles[0].DisplayName != "United States — Dallas, TX · US-TX1" {
		testingObject.Fatalf("unexpected IVPN profiles: %+v", profiles)
	}
	if !strings.Contains(string(profiles[0].Configuration), "DNS = 172.16.0.1") {
		testingObject.Fatalf("template lacks IVPN's DNS:\n%s", profiles[0].Configuration)
	}
}

// TestOfficialIVPNWireGuardCatalog validates an explicitly supplied current server list.
func TestOfficialIVPNWireGuardCatalog(testingObject *testing.T) {
	assertOfficialWireGuardCatalog(testingObject, "IVPN_WIREGUARD_CATALOG_TEST_PATH", 60, ParseIVPNWireGuardCatalog)
}
