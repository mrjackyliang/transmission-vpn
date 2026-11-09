package api

import (
	"testing"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/provider"
)

// TestFormValidationHelpers verifies API-side rules independently from browser code.
//
// These cases cover values that previously reached deeper storage or controller
// layers before being rejected.
func TestFormValidationHelpers(testingObject *testing.T) {
	if _, message := validateAdministratorCredentials("administrator", "a secure local password"); message != "" {
		testingObject.Fatalf("valid administrator rejected: %s", message)
	}
	if field, message := validateAdministratorCredentials("_administrator", "a secure local password"); message == "" || field != "username" {
		testingObject.Fatal("invalid administrator username was accepted")
	}
	if field, message := validateAdministratorCredentials("administrator", "short"); message == "" || field != "password" {
		testingObject.Fatal("short administrator password was accepted")
	}

	if err := validateLabels([]string{"Movies", "movies"}); err == nil {
		testingObject.Fatal("duplicate labels were accepted")
	}
	if err := validateLabels([]string{"tv,hd"}); err == nil || err.Error() != "Labels can't contain commas." {
		testingObject.Fatalf("comma label error = %v", err)
	}

	definition, found := provider.DefinitionByID("purevpn")
	if !found {
		testingObject.Fatal("PureVPN provider definition is unavailable")
	}
	tunnel, found := definition.Tunnel(provider.TunnelOpenVPN)
	if !found {
		testingObject.Fatal("PureVPN has no OpenVPN tunnel")
	}
	signIn := map[string]string{"username": "username", "password": "password"}
	if err := validateVPNConnectionFields(
		tunnel,
		signIn,
		[]string{"9.9.9.9"},
		10,
	); err != nil {
		testingObject.Fatalf("valid VPN connection fields rejected: %v", err)
	}
	if err := validateVPNConnectionFields(tunnel, map[string]string{"password": "password"}, nil, 10); err == nil {
		testingObject.Fatal("missing required VPN username was accepted")
	}
	if err := validateVPNConnectionFields(
		tunnel,
		map[string]string{"username": "username", "password": "password", "privateKey": "x"},
		nil,
		10,
	); err == nil {
		testingObject.Fatal("a credential the tunnel does not use was accepted")
	}
	if err := validateVPNConnectionFields(
		tunnel,
		signIn,
		[]string{"dns.example.test"},
		10,
	); err == nil {
		testingObject.Fatal("hostname DNS server was accepted")
	}
	for _, serverAddress := range []string{"2001:db8::1", "::ffff:1.2.3.4"} {
		err := validateVPNConnectionFields(tunnel, signIn, []string{serverAddress}, 10)
		if err == nil || err.Error() != "DNS server is not an IPv4 address: "+serverAddress {
			testingObject.Fatalf("non-IPv4 DNS server %q returned %v", serverAddress, err)
		}
	}
	if err := validateVPNConnectionFields(tunnel, signIn, nil, 1); err == nil {
		testingObject.Fatal("out-of-range VPN retry interval was accepted")
	}

	if !validVPNIdentifier("purevpn:example-profile") {
		testingObject.Fatal("valid VPN profile identifier was rejected")
	}
	if validVPNIdentifier("purevpn:bad/profile") {
		testingObject.Fatal("unsafe VPN profile identifier was accepted")
	}
}
