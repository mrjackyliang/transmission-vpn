package provider

import (
	"strings"
	"testing"
)

// The keys below are the examples printed in the wg(8) manual, not real credentials.
const (
	testWireGuardPrivateKey   = "yAnz5TF+lXXJte14tji3zlMNq+hd2rYUIgJBgB3fBmk="
	testWireGuardPublicKey    = "xTIBA5rboUvnH4htodjb6e697QjLERt1NAB4mZqp8Dg="
	testWireGuardPresharedKey = "/UwcSPg38hW/D9Y3tcS1FOV0K1wuURMbS0sesJEP5ak="
)

// validWireGuardConfiguration is a minimal complete client file.
const validWireGuardConfiguration = `[Interface]
PrivateKey = ` + testWireGuardPrivateKey + `
Address = 10.68.12.34/32
DNS = 10.64.0.1

[Peer]
PublicKey = ` + testWireGuardPublicKey + `
Endpoint = 185.213.154.68:51820
AllowedIPs = 0.0.0.0/0
`

// canonicalWireGuardConfiguration is validWireGuardConfiguration after normalization.
const canonicalWireGuardConfiguration = `[Interface]
PrivateKey = ` + testWireGuardPrivateKey + `
Address = 10.68.12.34/32
DNS = 10.64.0.1

[Peer]
PublicKey = ` + testWireGuardPublicKey + `
Endpoint = 185.213.154.68:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
`

// TestNormalizeWireGuardProfile rewrites accepted files into the one canonical form.
func TestNormalizeWireGuardProfile(testingObject *testing.T) {
	tests := []struct {
		name    string
		content string
		want    string
	}{
		{
			name:    "a minimal file",
			content: validWireGuardConfiguration,
			want:    canonicalWireGuardConfiguration,
		},
		{
			name: "mixed-case keys, CRLF, comments, IPv6 and a provider keepalive",
			content: strings.ReplaceAll(`# Mullvad Stockholm
[interface]
privatekey = `+testWireGuardPrivateKey+`
Address = 10.68.12.34/32, fc00:bbbb:bbbb:bb01::5:1/128
DNS = 10.64.0.1, fc00:bbbb:bbbb:bb01::1, example.lan

[PEER]
PublicKey = `+testWireGuardPublicKey+` # server key
PresharedKey = `+testWireGuardPresharedKey+`
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = 185.213.154.68:51820
PersistentKeepalive = 21
`, "\n", "\r\n"),
			want: `[Interface]
PrivateKey = ` + testWireGuardPrivateKey + `
Address = 10.68.12.34/32
DNS = 10.64.0.1

[Peer]
PublicKey = ` + testWireGuardPublicKey + `
PresharedKey = ` + testWireGuardPresharedKey + `
Endpoint = 185.213.154.68:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
`,
		},
		{
			name: "a bare address, an MTU, a hostname endpoint and dropped settings",
			content: `[Interface]
PrivateKey = ` + testWireGuardPrivateKey + `
Address = 172.20.12.34
ListenPort = 51820
SaveConfig = true
MTU = 1380

[Peer]
PublicKey = ` + testWireGuardPublicKey + `
Endpoint = US-TX1.wg.ivpn.net:2049
AllowedIPs = 0.0.0.0/1, 128.0.0.0/1
`,
			want: `[Interface]
PrivateKey = ` + testWireGuardPrivateKey + `
Address = 172.20.12.34/32
MTU = 1380

[Peer]
PublicKey = ` + testWireGuardPublicKey + `
Endpoint = us-tx1.wg.ivpn.net:2049
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
`,
		},
	}

	for _, test := range tests {
		testingObject.Run(test.name, func(testingObject *testing.T) {
			profile, err := NormalizeWireGuardProfile("custom", "mullvad-se.conf", []byte(test.content))
			if err != nil {
				testingObject.Fatalf("normalize WireGuard configuration: %v", err)
			}
			if string(profile.Configuration) != test.want {
				testingObject.Fatalf("configuration =\n%s\nwant\n%s", profile.Configuration, test.want)
			}
			if profile.Tunnel != TunnelWireGuard || profile.Protocol != "udp" ||
				!strings.HasPrefix(profile.ID, "custom:wg-mullvad-se:") {
				testingObject.Fatalf("unexpected profile metadata: %+v", profile)
			}
		})
	}
}

// TestNormalizeWireGuardProfileIsStable gives the same file the same identifier.
func TestNormalizeWireGuardProfileIsStable(testingObject *testing.T) {
	first, err := NormalizeWireGuardProfile("custom", "home.conf", []byte(validWireGuardConfiguration))
	if err != nil {
		testingObject.Fatalf("normalize: %v", err)
	}
	second, err := NormalizeWireGuardProfile("custom", "home.conf", []byte(validWireGuardConfiguration))
	if err != nil {
		testingObject.Fatalf("normalize again: %v", err)
	}
	if first.ID != second.ID || first.Fingerprint != second.Fingerprint ||
		first.RemoteHost != "185.213.154.68" || first.RemotePort != 51820 {
		testingObject.Fatalf("profiles differ or lack the endpoint: %+v %+v", first, second)
	}
}

// TestNormalizeWireGuardProfileBoundsLongIdentifiers keeps uploaded names connectable.
//
// Names that exceed the shared identifier limit retain a readable prefix and append a
// hash of the complete name, so equal configurations with different names stay apart.
func TestNormalizeWireGuardProfileBoundsLongIdentifiers(testingObject *testing.T) {
	namePrefix := strings.Repeat("long-profile-name-", 10)
	firstName := namePrefix + "first"
	secondName := namePrefix + "second"

	first, err := NormalizeWireGuardProfile("custom", firstName+".conf", []byte(validWireGuardConfiguration))
	if err != nil {
		testingObject.Fatalf("normalize first profile: %v", err)
	}
	second, err := NormalizeWireGuardProfile("custom", secondName+".conf", []byte(validWireGuardConfiguration))
	if err != nil {
		testingObject.Fatalf("normalize second profile: %v", err)
	}

	if len(first.ID) > 160 || len(second.ID) > 160 {
		testingObject.Fatalf("long profile identifiers have lengths %d and %d", len(first.ID), len(second.ID))
	}
	if first.ID == second.ID {
		testingObject.Fatalf("different long profile names share identifier %q", first.ID)
	}
	if first.DisplayName != firstName || second.DisplayName != secondName {
		testingObject.Fatalf("display names were shortened: %q and %q", first.DisplayName, second.DisplayName)
	}
}

// TestNormalizeWireGuardProfileRejects refuses unsafe or incomplete files without
// repeating any key in the error.
func TestNormalizeWireGuardProfileRejects(testingObject *testing.T) {
	replace := func(old string, new string) string {
		return strings.Replace(validWireGuardConfiguration, old, new, 1)
	}
	tests := []struct {
		name    string
		content string
		want    string
	}{
		{name: "a PostUp hook", content: replace("DNS = 10.64.0.1", "DNS = 10.64.0.1\nPostUp = iptables -I OUTPUT"), want: "PostUp is not allowed"},
		{name: "a PreDown hook", content: replace("DNS = 10.64.0.1", "DNS = 10.64.0.1\nPreDown = true"), want: "kill switch"},
		{name: "a routing table", content: replace("DNS = 10.64.0.1", "DNS = 10.64.0.1\nTable = off"), want: "Table is not allowed"},
		{name: "a firewall mark", content: replace("DNS = 10.64.0.1", "DNS = 10.64.0.1\nFwMark = 51820"), want: "FwMark is not allowed"},
		{name: "two peers", content: validWireGuardConfiguration + "\n[Peer]\nPublicKey = " + testWireGuardPublicKey + "\nEndpoint = 192.0.2.1:51820\n", want: "exactly one [Peer]"},
		{name: "no peer", content: "[Interface]\nPrivateKey = " + testWireGuardPrivateKey + "\nAddress = 10.0.0.2/32\n", want: "exactly one [Peer]"},
		{name: "no private key", content: replace("PrivateKey = "+testWireGuardPrivateKey+"\n", ""), want: "does not contain a PrivateKey"},
		{name: "only IPv6 addresses", content: replace("Address = 10.68.12.34/32", "Address = fd00::2/128"), want: "IPv4 Address"},
		{name: "a malformed key", content: replace(testWireGuardPublicKey, "not-a-key="), want: "PublicKey is not a valid WireGuard key"},
		{name: "an IPv6 endpoint", content: replace("185.213.154.68:51820", "[2001:db8::1]:51820"), want: "IPv6 isn't supported"},
		{name: "a bad port", content: replace("185.213.154.68:51820", "185.213.154.68:70000"), want: "port must be between"},
		{name: "an unknown section", content: validWireGuardConfiguration + "[Extra]\n", want: "only [Interface] and [Peer]"},
		{name: "an unknown setting", content: replace("DNS = 10.64.0.1", "DNS = 10.64.0.1\nJc = 4"), want: "unsupported [Interface] setting"},
		{name: "a repeated private key", content: replace("Address = ", "PrivateKey = "+testWireGuardPrivateKey+"\nAddress = "), want: "more than once"},
		{name: "a missing endpoint", content: replace("Endpoint = 185.213.154.68:51820\n", ""), want: "valid peer Endpoint"},
		{name: "an MTU out of range", content: replace("DNS = 10.64.0.1", "DNS = 10.64.0.1\nMTU = 9000"), want: "MTU must be between"},
		{name: "a setting outside a section", content: "PrivateKey = " + testWireGuardPrivateKey + "\n" + validWireGuardConfiguration, want: "inside [Interface] or [Peer]"},
		{name: "an oversized file", content: validWireGuardConfiguration + strings.Repeat("# padding\n", 8000), want: "exceeds"},
	}

	for _, test := range tests {
		testingObject.Run(test.name, func(testingObject *testing.T) {
			_, err := NormalizeWireGuardProfile("custom", "test.conf", []byte(test.content))
			if err == nil || !strings.Contains(err.Error(), test.want) {
				testingObject.Fatalf("error = %v, want one containing %q", err, test.want)
			}
			if strings.Contains(err.Error(), testWireGuardPrivateKey) || strings.Contains(err.Error(), testWireGuardPublicKey) {
				testingObject.Fatalf("error repeats a key: %v", err)
			}
		})
	}

	if _, err := NormalizeWireGuardProfile("custom", "../escape.conf", []byte(validWireGuardConfiguration)); err == nil {
		testingObject.Fatal("a name with a path was accepted")
	}
}

// TestValidateNormalizedWireGuardProfile accepts only canonical complete content.
func TestValidateNormalizedWireGuardProfile(testingObject *testing.T) {
	metadata, err := ValidateNormalizedWireGuardProfile([]byte(canonicalWireGuardConfiguration))
	if err != nil || metadata.RemoteHost != "185.213.154.68" || metadata.RemotePort != 51820 {
		testingObject.Fatalf("canonical content: %+v, %v", metadata, err)
	}

	tampered := map[string]string{
		"an added hook":       strings.Replace(canonicalWireGuardConfiguration, "DNS = 10.64.0.1", "DNS = 10.64.0.1\nPostUp = true", 1),
		"split routes":        strings.Replace(canonicalWireGuardConfiguration, "AllowedIPs = 0.0.0.0/0", "AllowedIPs = 10.0.0.0/8", 1),
		"another keepalive":   strings.Replace(canonicalWireGuardConfiguration, "PersistentKeepalive = 25", "PersistentKeepalive = 5", 1),
		"no private key":      strings.Replace(canonicalWireGuardConfiguration, "PrivateKey = "+testWireGuardPrivateKey+"\n", "", 1),
		"reordered settings":  strings.Replace(canonicalWireGuardConfiguration, "Address = 10.68.12.34/32\nDNS = 10.64.0.1", "DNS = 10.64.0.1\nAddress = 10.68.12.34/32", 1),
		"a second peer":       canonicalWireGuardConfiguration + "\n[Peer]\nPublicKey = " + testWireGuardPublicKey + "\nEndpoint = 192.0.2.1:51820\n",
		"a trailing comment":  canonicalWireGuardConfiguration + "# note\n",
		"a lowercase section": strings.Replace(canonicalWireGuardConfiguration, "[Peer]", "[peer]", 1),
	}
	for name, content := range tampered {
		if _, err := ValidateNormalizedWireGuardProfile([]byte(content)); err == nil {
			testingObject.Fatalf("%s was accepted", name)
		}
	}
}

// TestMergeWireGuardCredentials completes catalog templates with the user's key.
func TestMergeWireGuardCredentials(testingObject *testing.T) {
	mullvadTemplate := WireGuardConfig{
		DNSServers:    mustWireGuardDNS("10.64.0.1"),
		PeerPublicKey: testWireGuardPublicKey,
		EndpointHost:  "185.213.154.68",
		EndpointPort:  51820,
	}
	nordTemplate := mullvadTemplate
	nordTemplate.Addresses = mustWireGuardAddresses("10.5.0.2/32")

	merged, err := MergeWireGuardCredentials(mullvadTemplate.Canonical(), map[string]string{
		"privateKey": testWireGuardPrivateKey,
		"address":    "10.68.12.34",
	})
	if err != nil || string(merged) != canonicalWireGuardConfiguration {
		testingObject.Fatalf("merged Mullvad template =\n%s\n%v", merged, err)
	}
	if _, err := ValidateNormalizedWireGuardProfile(merged); err != nil {
		testingObject.Fatalf("merged content does not validate: %v", err)
	}

	merged, err = MergeWireGuardCredentials(nordTemplate.Canonical(), map[string]string{"privateKey": testWireGuardPrivateKey})
	if err != nil || !strings.Contains(string(merged), "Address = 10.5.0.2/32") {
		testingObject.Fatalf("merged NordVPN template =\n%s\n%v", merged, err)
	}

	merged, err = MergeWireGuardCredentials(nordTemplate.Canonical(), map[string]string{
		"privateKey": testWireGuardPrivateKey,
		"address":    "10.14.0.9/16",
	})
	if err != nil || !strings.Contains(string(merged), "Address = 10.14.0.9/16\n") {
		testingObject.Fatalf("an address override was not applied:\n%s\n%v", merged, err)
	}

	failures := map[string]struct {
		template    []byte
		credentials map[string]string
	}{
		"a bad key":             {mullvadTemplate.Canonical(), map[string]string{"privateKey": "short", "address": "10.68.12.34/32"}},
		"no address":            {mullvadTemplate.Canonical(), map[string]string{"privateKey": testWireGuardPrivateKey}},
		"an IPv6 address":       {mullvadTemplate.Canonical(), map[string]string{"privateKey": testWireGuardPrivateKey, "address": "fd00::2/128"}},
		"a template with a key": {[]byte(canonicalWireGuardConfiguration), map[string]string{"privateKey": testWireGuardPrivateKey}},
	}
	for name, failure := range failures {
		if _, err := MergeWireGuardCredentials(failure.template, failure.credentials); err == nil {
			testingObject.Fatalf("%s was accepted", name)
		} else if strings.Contains(err.Error(), testWireGuardPrivateKey) {
			testingObject.Fatalf("%s error repeats the key: %v", name, err)
		}
	}
}

// TestLooksLikeWireGuardConfiguration tells WireGuard files from OpenVPN profiles.
func TestLooksLikeWireGuardConfiguration(testingObject *testing.T) {
	if !LooksLikeWireGuardConfiguration([]byte(strings.ReplaceAll(validWireGuardConfiguration, "\n", "\r\n"))) {
		testingObject.Fatal("a WireGuard file was not recognized")
	}
	for _, marker := range []string{"#", ";"} {
		commented := strings.Replace(validWireGuardConfiguration, "[Interface]", "[Interface] "+marker+" home", 1)
		commented = strings.Replace(commented, "[Peer]", "[Peer] "+marker+" server", 1)
		if !LooksLikeWireGuardConfiguration([]byte(commented)) {
			testingObject.Fatalf("a WireGuard file with %q section comments was not recognized", marker)
		}
		if _, err := NormalizeWireGuardProfile("custom", "commented.conf", []byte(commented)); err != nil {
			testingObject.Fatalf("a WireGuard file with %q section comments was rejected: %v", marker, err)
		}
	}
	if LooksLikeWireGuardConfiguration([]byte(validProfile)) {
		testingObject.Fatal("an OpenVPN profile was taken for WireGuard")
	}
}
