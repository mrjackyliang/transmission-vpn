package api

import (
	"context"
	"net/http"
	"testing"
)

// TestHealthRequiresAConnectionAfterClaiming replaces the retired provider sentinel.
func TestHealthRequiresAConnectionAfterClaiming(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)
	startFakeController(testingObject, server)

	withoutConnection, err := server.buildStatus(context.Background())
	if err != nil {
		testingObject.Fatalf("build status without a connection: %v", err)
	}
	if withoutConnection.ProtectionState != "setup-required" {
		testingObject.Fatalf(
			"protection state without a connection = %q, want setup-required",
			withoutConnection.ProtectionState,
		)
	}

	profileID := uploadTestWireGuardProfile(testingObject, server, cookies, csrfToken)
	connected := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/vpn/connect",
		testConnectBody(profileID),
		cookies,
		csrfToken,
	)
	if connected.Code != http.StatusOK {
		testingObject.Fatalf("connect status %d: %s", connected.Code, connected.Body.String())
	}

	withConnection, err := server.buildStatus(context.Background())
	if err != nil {
		testingObject.Fatalf("build status with a connection: %v", err)
	}
	if withConnection.ProtectionState != "blocked" {
		testingObject.Fatalf(
			"protection state with a connection = %q, want blocked runtime marker",
			withConnection.ProtectionState,
		)
	}
}
