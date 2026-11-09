package api

import (
	"context"
	"fmt"
	"strings"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/controller"
)

const genericVPNConnectionFailure = "The VPN connection couldn't be verified. Check its endpoints and credentials, then try again."

// publicVPNConnectionFailure turns controller diagnostics into secret-free guidance.
//
// The endpoint is safe profile metadata. Raw controller text is used only for
// classification and endpoint matching; it never crosses the API boundary.
func publicVPNConnectionFailure(cause error, endpoints []controller.Endpoint) string {
	if cause == nil {
		return genericVPNConnectionFailure
	}

	normalized := strings.ToLower(cause.Error())
	host := vpnFailureHost(normalized, endpoints)
	if host == "" {
		return genericVPNConnectionFailure
	}

	switch {
	case strings.Contains(normalized, "no such host"),
		strings.Contains(normalized, "name or service not known"),
		strings.Contains(normalized, "temporary failure in name resolution"),
		strings.Contains(normalized, "nodename nor servname provided"),
		strings.Contains(normalized, "has no ipv4 address"):
		return fmt.Sprintf("Couldn't find %s. Check the address in the profile.", host)
	case strings.Contains(normalized, "auth_failed"),
		strings.Contains(normalized, "authentication failed"),
		strings.Contains(normalized, "credentials were rejected"),
		strings.Contains(normalized, "sign-in was refused"):
		return fmt.Sprintf("Sign-in was refused by %s. Check the VPN username and password.", host)
	case strings.Contains(normalized, "certificate"),
		strings.Contains(normalized, "x509"),
		strings.Contains(normalized, "tls error"),
		strings.Contains(normalized, "tls handshake"),
		strings.Contains(normalized, "verify error"),
		strings.Contains(normalized, "verification failed"):
		return fmt.Sprintf("The certificate or TLS check for %s failed. Check the profile's certificate settings.", host)
	case strings.Contains(normalized, "context deadline exceeded"),
		strings.Contains(normalized, "i/o timeout"),
		strings.Contains(normalized, "timed out"),
		strings.Contains(normalized, "timeout"),
		strings.Contains(normalized, "did not answer"),
		strings.Contains(normalized, "has not answered"),
		strings.Contains(normalized, "did not become ready"),
		strings.Contains(normalized, "no vpn endpoint connected"),
		strings.Contains(normalized, "did not reply"):
		return fmt.Sprintf("No reply from %s. Check that the address and server are reachable.", host)
	default:
		return genericVPNConnectionFailure
	}
}

// vpnFailureHost selects the endpoint named by the controller's pool error.
func vpnFailureHost(normalizedFailure string, endpoints []controller.Endpoint) string {
	for _, endpoint := range endpoints {
		if (endpoint.ProfileID != "" && strings.Contains(normalizedFailure, strings.ToLower(endpoint.ProfileID))) ||
			(endpoint.RemoteHost != "" && strings.Contains(normalizedFailure, strings.ToLower(endpoint.RemoteHost))) {
			return endpoint.RemoteHost
		}
	}
	if len(endpoints) > 0 {
		return endpoints[0].RemoteHost
	}

	return ""
}

// publicStoredVPNConnectionFailure reads only safe endpoint metadata for a reconnect.
func (server *Server) publicStoredVPNConnectionFailure(
	ctx context.Context,
	cause error,
	profileIDs []string,
) string {
	endpoints := make([]controller.Endpoint, 0, len(profileIDs))
	for _, profileID := range profileIDs {
		profile, err := server.store.FindVPNProfile(ctx, profileID)
		if err != nil {
			continue
		}
		endpoints = append(endpoints, controller.Endpoint{
			ProfileID:  profileID,
			RemoteHost: profile.RemoteHost,
		})
	}

	return publicVPNConnectionFailure(cause, endpoints)
}
