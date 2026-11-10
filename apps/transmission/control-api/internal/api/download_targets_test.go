package api

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

// TestDownloadTargetsRejectDataRoot covers every control API destination surface.
//
// Settings and profiles return the same field guidance before a /data destination
// can reach Transmission or storage.
//
// Since: 2.0.0
func TestDownloadTargetsRejectDataRoot(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)

	testCases := []struct {
		name   string
		method string
		path   string
		body   string
		field  string
	}{
		{
			name:   "settings write",
			method: http.MethodPut,
			path:   "/api/v1/settings",
			body:   `{"expectedRevision":0,"changes":{"transmission.downloadDirectory":"/data"}}`,
			field:  "changes.transmission.downloadDirectory",
		},
		{
			name:   "profile",
			method: http.MethodPost,
			path:   "/api/v1/torrent-profiles",
			body:   testTorrentProfileRequest("Root profile", "/data", "normal"),
			field:  "downloadDirectory",
		},
	}

	for _, testCase := range testCases {
		testingObject.Run(testCase.name, func(testingObject *testing.T) {
			response := performRequest(
				testingObject,
				server,
				testCase.method,
				testCase.path,
				testCase.body,
				cookies,
				csrfToken,
			)
			if response.Code != http.StatusUnprocessableEntity {
				testingObject.Fatalf("status = %d: %s", response.Code, response.Body.String())
			}

			var envelope errorEnvelope
			decodeBody(testingObject, response, &envelope)
			if envelope.Error.Message != "Choose a folder inside /data, not /data itself." {
				testingObject.Fatalf("message = %q", envelope.Error.Message)
			}
			if len(envelope.Error.Issues) != 1 ||
				envelope.Error.Issues[0].Field != testCase.field ||
				envelope.Error.Issues[0].Message != "Choose a folder inside /data, not /data itself." {
				testingObject.Fatalf("issues = %+v", envelope.Error.Issues)
			}
		})
	}
}

// TestDownloadTargetsRejectIncompleteDirectory covers every first-party target.
//
// The effective setting, rather than a conventional folder name, reserves both the
// incomplete folder itself and every descendant while leaving prefixed siblings free.
//
// Since: 2.0.0
func TestDownloadTargetsRejectIncompleteDirectory(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)

	testCases := []struct {
		name   string
		method string
		path   string
		body   string
		field  string
	}{
		{
			name:   "settings write while incomplete folder is disabled",
			method: http.MethodPut,
			path:   "/api/v1/settings",
			body:   `{"expectedRevision":0,"changes":{"transmission.incompleteDirectoryEnabled":false,"transmission.downloadDirectory":"/data/incomplete/settings"}}`,
			field:  "changes.transmission.downloadDirectory",
		},
		{
			name:   "profile",
			method: http.MethodPost,
			path:   "/api/v1/torrent-profiles",
			body:   testTorrentProfileRequest("Incomplete profile", "/data/incomplete/profile", "normal"),
			field:  "downloadDirectory",
		},
	}

	for _, testCase := range testCases {
		testingObject.Run(testCase.name, func(testingObject *testing.T) {
			response := performRequest(
				testingObject,
				server,
				testCase.method,
				testCase.path,
				testCase.body,
				cookies,
				csrfToken,
			)
			if response.Code != http.StatusUnprocessableEntity {
				testingObject.Fatalf("status = %d: %s", response.Code, response.Body.String())
			}

			var envelope errorEnvelope
			decodeBody(testingObject, response, &envelope)
			const message = "Choose a folder outside the incomplete folder, /data/incomplete."
			if envelope.Error.Message != message {
				testingObject.Fatalf("message = %q", envelope.Error.Message)
			}
			if len(envelope.Error.Issues) != 1 ||
				envelope.Error.Issues[0].Field != testCase.field ||
				envelope.Error.Issues[0].Message != message {
				testingObject.Fatalf("issues = %+v", envelope.Error.Issues)
			}
		})
	}
}

// TestIncompleteDirectoryRejectsDownloadTargets checks Settings in the reverse direction.
//
// The first effective Download setting or profile clash is named, while nesting the
// incomplete folder beneath the Download setting remains valid.
//
// Since: 2.0.0
func TestIncompleteDirectoryRejectsDownloadTargets(testingObject *testing.T) {
	testCases := []struct {
		name           string
		prepare        func(*testing.T, *Server)
		incompletePath string
		status         int
		wantMessage    string
	}{
		{
			name:           "Download setting",
			incompletePath: "/data/downloads",
			status:         http.StatusUnprocessableEntity,
			wantMessage:    "“downloads” is the Default profile's folder, so it can't be the incomplete folder.",
		},
		{
			name: "torrent profile",
			prepare: func(testingObject *testing.T, server *Server) {
				_, err := server.store.CreateTorrentProfile(context.Background(), storage.TorrentProfile{
					ID:                newTorrentProfileID(),
					Name:              "Films",
					DownloadDirectory: "/data/media/films",
					Labels:            []string{},
					Options: storage.TorrentProfileOptions{
						Seeding:   storage.TorrentProfileSeeding{Mode: "never"},
						PeerLimit: 50,
						Queue:     "normal",
					},
					MatchPatterns: []string{},
				})
				if err != nil {
					testingObject.Fatalf("create profile: %v", err)
				}
			},
			incompletePath: "/data/media",
			status:         http.StatusUnprocessableEntity,
			wantMessage:    "Use a folder outside /data/media/films. Torrents in the Films profile finish there.",
		},
		{
			name:           "nested beneath Download setting",
			incompletePath: "/data/downloads/incomplete",
			status:         http.StatusOK,
		},
	}

	for _, testCase := range testCases {
		testingObject.Run(testCase.name, func(testingObject *testing.T) {
			server, cookies, csrfToken := newClaimedTestServer(testingObject)
			if testCase.prepare != nil {
				testCase.prepare(testingObject, server)
			}
			body, _ := json.Marshal(map[string]any{
				"expectedRevision": 0,
				"changes": map[string]any{
					"transmission.incompleteDirectory": testCase.incompletePath,
				},
			})
			response := performRequest(
				testingObject,
				server,
				http.MethodPut,
				"/api/v1/settings",
				string(body),
				cookies,
				csrfToken,
			)
			if response.Code != testCase.status {
				testingObject.Fatalf("status = %d: %s", response.Code, response.Body.String())
			}
			if testCase.status == http.StatusOK {
				return
			}

			var envelope errorEnvelope
			decodeBody(testingObject, response, &envelope)
			if len(envelope.Error.Issues) != 1 ||
				envelope.Error.Issues[0].Field != "changes.transmission.incompleteDirectory" ||
				envelope.Error.Issues[0].Message != testCase.wantMessage {
				testingObject.Fatalf("issues = %+v", envelope.Error.Issues)
			}
		})
	}
}

// TestDownloadDirectorySettingRejectsEmptyValue keeps the Default profile concrete.
//
// Since: 2.0.0
func TestDownloadDirectorySettingRejectsEmptyValue(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)
	response := performRequest(
		testingObject,
		server,
		http.MethodPut,
		"/api/v1/settings",
		`{"expectedRevision":0,"changes":{"transmission.downloadDirectory":""}}`,
		cookies,
		csrfToken,
	)
	if response.Code != http.StatusUnprocessableEntity {
		testingObject.Fatalf("status = %d: %s", response.Code, response.Body.String())
	}
	var envelope errorEnvelope
	decodeBody(testingObject, response, &envelope)
	if len(envelope.Error.Issues) != 1 ||
		envelope.Error.Issues[0].Field != "changes.transmission.downloadDirectory" {
		testingObject.Fatalf("issues = %+v", envelope.Error.Issues)
	}
}
