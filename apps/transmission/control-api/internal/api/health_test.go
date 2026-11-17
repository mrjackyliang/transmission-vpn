package api

import (
	"context"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestLivenessEndpointAnswersNovaHealthcheck verifies the generated Docker probe gets
// HTTP 200 only while the database and fail-closed runtime markers are available.
//
// Since: 2.4.0
func TestLivenessEndpointAnswersNovaHealthcheck(testingObject *testing.T) {
	server, _, _ := newClaimedTestServer(testingObject)

	liveResponse := performRequest(
		testingObject,
		server,
		http.MethodGet,
		"/api/v1/health/live",
		"",
		nil,
		"",
	)
	if liveResponse.Code != http.StatusOK || !strings.Contains(liveResponse.Body.String(), `"status":"live"`) {
		testingObject.Fatalf("live health response %d: %s", liveResponse.Code, liveResponse.Body.String())
	}

	if err := os.Remove(filepath.Join(server.runtimeDirectory, "firewall.ready")); err != nil {
		testingObject.Fatalf("remove firewall readiness marker: %v", err)
	}
	unhealthyResponse := performRequest(
		testingObject,
		server,
		http.MethodGet,
		"/api/v1/health/live",
		"",
		nil,
		"",
	)
	if unhealthyResponse.Code != http.StatusServiceUnavailable ||
		!strings.Contains(unhealthyResponse.Body.String(), `"status":"unhealthy"`) {
		testingObject.Fatalf(
			"unhealthy health response %d: %s",
			unhealthyResponse.Code,
			unhealthyResponse.Body.String(),
		)
	}
}

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
