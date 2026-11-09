package provider

import (
	"strings"
	"testing"
)

// TestValidateCredentials applies each field kind and refuses unknown keys.
func TestValidateCredentials(testingObject *testing.T) {
	tunnelOf := func(providerID string, tunnelID string) TunnelDefinition {
		definition, found := DefinitionByID(providerID)
		if !found {
			testingObject.Fatalf("no provider %s", providerID)
		}
		tunnel, found := definition.Tunnel(tunnelID)
		if !found {
			testingObject.Fatalf("%s has no %s tunnel", providerID, tunnelID)
		}

		return tunnel
	}
	pureVPN := tunnelOf("purevpn", TunnelOpenVPN)
	customOpenVPN := tunnelOf("custom", TunnelOpenVPN)
	customWireGuard := tunnelOf("custom", TunnelWireGuard)
	mullvad := tunnelOf("mullvad", TunnelWireGuard)
	surfshark := tunnelOf("surfshark", TunnelWireGuard)
	nordVPN := tunnelOf("nordvpn", TunnelWireGuard)

	tests := []struct {
		name   string
		tunnel TunnelDefinition
		values map[string]string
		want   string
	}{
		{name: "OpenVPN sign-in", tunnel: pureVPN, values: map[string]string{"username": "user", "password": "secret"}},
		{name: "a missing username", tunnel: pureVPN, values: map[string]string{"password": "secret"}, want: "VPN username is required"},
		{name: "a line break", tunnel: pureVPN, values: map[string]string{"username": "user\nroot", "password": "secret"}, want: "unsupported characters"},
		{name: "a long password", tunnel: pureVPN, values: map[string]string{"username": "user", "password": strings.Repeat("x", 2049)}, want: "at most 2048"},
		{name: "an unknown key", tunnel: pureVPN, values: map[string]string{"username": "user", "password": "secret", "token": "x"}, want: "doesn't use the credential"},
		{name: "optional custom sign-in", tunnel: customOpenVPN, values: map[string]string{}},
		{name: "custom WireGuard needs nothing", tunnel: customWireGuard, values: map[string]string{}},
		{name: "custom WireGuard refuses a key", tunnel: customWireGuard, values: map[string]string{"privateKey": testWireGuardPrivateKey}, want: "doesn't use the credential"},
		{name: "Mullvad key and address", tunnel: mullvad, values: map[string]string{"privateKey": testWireGuardPrivateKey, "address": "10.68.12.34/32"}},
		{name: "a bad key", tunnel: mullvad, values: map[string]string{"privateKey": "abc", "address": "10.68.12.34/32"}, want: "must be a WireGuard key"},
		{name: "a bad address", tunnel: mullvad, values: map[string]string{"privateKey": testWireGuardPrivateKey, "address": "fd00::2/128"}, want: "IPv4 address"},
		{name: "a missing address", tunnel: mullvad, values: map[string]string{"privateKey": testWireGuardPrivateKey}, want: "Tunnel address is required"},
		{name: "Surfshark's optional address", tunnel: surfshark, values: map[string]string{"privateKey": testWireGuardPrivateKey}},
		{name: "NordVPN has no address field", tunnel: nordVPN, values: map[string]string{"privateKey": testWireGuardPrivateKey, "address": "10.5.0.2/32"}, want: "doesn't use the credential"},
	}

	for _, test := range tests {
		testingObject.Run(test.name, func(testingObject *testing.T) {
			err := ValidateCredentials(test.tunnel, test.values)
			if test.want == "" {
				if err != nil {
					testingObject.Fatalf("ValidateCredentials() = %v", err)
				}

				return
			}
			if err == nil || !strings.Contains(err.Error(), test.want) {
				testingObject.Fatalf("ValidateCredentials() = %v, want %q", err, test.want)
			}
			for _, value := range test.values {
				if len(value) > 8 && strings.Contains(err.Error(), value) {
					testingObject.Fatalf("error repeats a value: %v", err)
				}
			}
		})
	}

	missingUsernameError := ValidateCredentials(
		pureVPN,
		map[string]string{"password": "secret"},
	)
	credentialField, found := CredentialErrorField(missingUsernameError)
	if missingUsernameError == nil || missingUsernameError.Error() != "VPN username is required." ||
		!found || credentialField != "username" {
		testingObject.Fatalf(
			"missing username error = %v, field = %q, found = %t",
			missingUsernameError,
			credentialField,
			found,
		)
	}
}
