package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/controller"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/runtimeinfo"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

// TestWriteJSONEncodesEveryResponseListAsAnArray covers all public response layers.
//
// Storage, API, runtime, status, and compatible RPC values share writeJSON. Keeping
// representative nil slices here catches any regression at that final boundary.
func TestWriteJSONEncodesEveryResponseListAsAnArray(testingObject *testing.T) {
	responseWriter := httptest.NewRecorder()
	writeJSON(responseWriter, http.StatusOK, struct {
		Organization storage.TorrentOrganization   `json:"organization"`
		Settings     storage.ConfigurationSnapshot `json:"settings"`
		Runtime      runtimeinfo.Snapshot          `json:"runtime"`
		Status       controller.Status             `json:"status"`
		API          settingsRuntimeApply          `json:"api"`
		RPC          map[string]any                `json:"rpc"`
	}{
		RPC: map[string]any{
			"removed":  []int64(nil),
			"torrents": []map[string]any(nil),
		},
	})

	if responseWriter.Code != http.StatusOK {
		testingObject.Fatalf("status = %d, want 200: %s", responseWriter.Code, responseWriter.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(responseWriter.Body.Bytes(), &body); err != nil {
		testingObject.Fatalf("decode response: %v", err)
	}

	assertJSONArray(testingObject, body, "organization", "labels")
	assertJSONArray(testingObject, body, "settings", "settings")
	assertJSONArray(testingObject, body, "runtime", "firewall", "interfaces")
	assertJSONArray(testingObject, body, "status", "dnsServers")
	assertJSONArray(testingObject, body, "api", "appliedKeys")
	assertJSONArray(testingObject, body, "api", "pendingKeys")
	assertJSONArray(testingObject, body, "api", "connections")
	assertJSONArray(testingObject, body, "rpc", "removed")
	assertJSONArray(testingObject, body, "rpc", "torrents")
}

// assertJSONArray requires one nested JSON field to be a non-null array.
func assertJSONArray(testingObject *testing.T, root map[string]any, path ...string) {
	testingObject.Helper()

	var current any = root
	for _, component := range path {
		object, valid := current.(map[string]any)
		if !valid {
			testingObject.Fatalf("JSON path %v reaches %T before %q", path, current, component)
		}
		current = object[component]
	}
	if _, valid := current.([]any); !valid {
		testingObject.Fatalf("JSON path %v = %#v, want array", path, current)
	}
}
