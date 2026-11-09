package api

import (
	"errors"
	"testing"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/controller"
)

// TestPublicVPNConnectionFailure maps common causes without exposing diagnostics.
func TestPublicVPNConnectionFailure(t *testing.T) {
	endpoints := []controller.Endpoint{
		{ProfileID: "custom:toronto:first", RemoteHost: "vpn-toronto.example.test"},
		{ProfileID: "custom:montreal:second", RemoteHost: "vpn-montreal.example.test"},
	}
	tests := []struct {
		name    string
		failure string
		want    string
	}{
		{
			name:    "address not found",
			failure: "custom:toronto:first: resolve the OpenVPN endpoint vpn-toronto.example.test: lookup vpn-toronto.example.test: no such host",
			want:    "Couldn't find vpn-toronto.example.test. Check the address in the profile.",
		},
		{
			name:    "later endpoint timeout",
			failure: "custom:montreal:second: the WireGuard server did not answer a handshake within 30s",
			want:    "No reply from vpn-montreal.example.test. Check that the address and server are reachable.",
		},
		{
			name:    "authentication refused",
			failure: "custom:toronto:first: AUTH_FAILED password=do-not-return-this",
			want:    "Sign-in was refused by vpn-toronto.example.test. Check the VPN username and password.",
		},
		{
			name:    "certificate failure",
			failure: "custom:toronto:first: VERIFY ERROR: certificate has expired",
			want:    "The certificate or TLS check for vpn-toronto.example.test failed. Check the profile's certificate settings.",
		},
		{
			name:    "fallback",
			failure: "custom:toronto:first: internal controller detail",
			want:    genericVPNConnectionFailure,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := publicVPNConnectionFailure(errors.New(test.failure), endpoints); got != test.want {
				t.Fatalf("message = %q, want %q", got, test.want)
			}
		})
	}
}
