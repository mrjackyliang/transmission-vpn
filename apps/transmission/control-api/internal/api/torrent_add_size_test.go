package api

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/directorybrowser"
)

// TestTorrentAddRequestCapFitsLargestFile keeps the add body cap above a 16 MiB
// file in base64 plus room for the rest of the request.
func TestTorrentAddRequestCapFitsLargestFile(testingObject *testing.T) {
	encodedLength := int64(base64.StdEncoding.EncodedLen(int(directorybrowser.MaximumTorrentMetainfoBytes)))
	if encodedLength+maximumRequestBytes > maximumTorrentAddRequestBytes {
		testingObject.Fatalf(
			"add body cap %d does not fit %d base64 bytes plus %d bytes of JSON",
			maximumTorrentAddRequestBytes,
			encodedLength,
			maximumRequestBytes,
		)
	}
	if maximumRPCRequestBytes != maximumTorrentAddRequestBytes {
		testingObject.Fatalf("RPC body cap = %d, want %d", maximumRPCRequestBytes, maximumTorrentAddRequestBytes)
	}
}

// TestAddTorrentFileSizeLimit accepts a 16 MiB .torrent file and refuses one byte
// more, and refuses a body over the route's own cap with the same file message.
func TestAddTorrentFileSizeLimit(testingObject *testing.T) {
	fixture := newSizedTorrentAddFixture(testingObject)

	tests := []struct {
		name        string
		metainfo    string
		wantStatus  int
		wantCode    string
		wantMessage string
		wantAdded   bool
	}{
		{
			name:       "exactly 16 MiB",
			metainfo:   base64.StdEncoding.EncodeToString(sizedTestMetainfo(testingObject, int(directorybrowser.MaximumTorrentMetainfoBytes))),
			wantStatus: http.StatusCreated,
			wantAdded:  true,
		},
		{
			name:        "one byte over 16 MiB",
			metainfo:    base64.StdEncoding.EncodeToString(sizedTestMetainfo(testingObject, int(directorybrowser.MaximumTorrentMetainfoBytes)+1)),
			wantStatus:  http.StatusRequestEntityTooLarge,
			wantCode:    "torrent_metainfo_too_large",
			wantMessage: "The .torrent file is larger than 16 MiB.",
		},
		{
			name:        "body over the route cap",
			metainfo:    strings.Repeat("A", int(maximumTorrentAddRequestBytes)),
			wantStatus:  http.StatusRequestEntityTooLarge,
			wantCode:    "payload_too_large",
			wantMessage: "The .torrent file is larger than 16 MiB.",
		},
	}

	for _, test := range tests {
		testingObject.Run(test.name, func(testingObject *testing.T) {
			callsBefore := len(fixture.firstFake.recordedCalls())
			body, err := json.Marshal(map[string]any{"metainfo": test.metainfo})
			if err != nil {
				testingObject.Fatalf("encode add body: %v", err)
			}
			response := performRequest(
				testingObject,
				fixture.server,
				http.MethodPost,
				"/api/v1/torrents",
				string(body),
				fixture.cookies,
				fixture.csrfToken,
			)
			if response.Code != test.wantStatus {
				testingObject.Fatalf("add status %d, want %d: %.300s", response.Code, test.wantStatus, response.Body.String())
			}
			if test.wantCode != "" {
				expectError(testingObject, response, test.wantStatus, test.wantCode, test.wantMessage)
			}

			added := containsTransmissionMethod(fixture.firstFake.recordedCalls()[callsBefore:], "torrent-add")
			if added != test.wantAdded {
				testingObject.Fatalf("torrent-add reached the daemon = %t, want %t", added, test.wantAdded)
			}
		})
	}
}

// TestOtherRoutesKeepOneMiBBodyLimit keeps the larger add cap off every other route.
func TestOtherRoutesKeepOneMiBBodyLimit(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)

	response := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/torrents/preview",
		`{"links":["`+strings.Repeat("a", int(maximumRequestBytes))+`"]}`,
		cookies,
		csrfToken,
	)
	expectError(
		testingObject,
		response,
		http.StatusRequestEntityTooLarge,
		"payload_too_large",
		"The request body is larger than 1 MB.",
	)
}

// TestRPCFacadeTorrentAddFileSizeLimit lets remote apps add a 16 MiB .torrent file
// and names the limit when a file or a request body goes over it.
func TestRPCFacadeTorrentAddFileSizeLimit(testingObject *testing.T) {
	fixture := newSizedTorrentAddFixture(testingObject)

	tests := []struct {
		name       string
		metainfo   string
		wantResult string
		wantAdded  bool
	}{
		{
			name:       "exactly 16 MiB",
			metainfo:   base64.StdEncoding.EncodeToString(sizedTestMetainfo(testingObject, int(directorybrowser.MaximumTorrentMetainfoBytes))),
			wantResult: "success",
			wantAdded:  true,
		},
		{
			name:       "one byte over 16 MiB",
			metainfo:   base64.StdEncoding.EncodeToString(sizedTestMetainfo(testingObject, int(directorybrowser.MaximumTorrentMetainfoBytes)+1)),
			wantResult: "The .torrent file is larger than 16 MiB.",
		},
		{
			name:       "body over the facade cap",
			metainfo:   strings.Repeat("A", int(maximumRPCRequestBytes)),
			wantResult: "The request is larger than 23 MiB. A .torrent file can be up to 16 MiB.",
		},
	}

	for _, test := range tests {
		testingObject.Run(test.name, func(testingObject *testing.T) {
			callsBefore := len(fixture.firstFake.recordedCalls())
			body, err := json.Marshal(map[string]any{
				"method":    "torrent-add",
				"arguments": map[string]any{"metainfo": test.metainfo},
				"tag":       7,
			})
			if err != nil {
				testingObject.Fatalf("encode RPC body: %v", err)
			}
			request := httptest.NewRequest(http.MethodPost, "/transmission/rpc", strings.NewReader(string(body)))
			recorder := httptest.NewRecorder()
			fixture.server.serveRPCFacade(recorder, request)

			var response struct {
				Result string `json:"result"`
			}
			if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
				testingObject.Fatalf("decode RPC response %q: %v", recorder.Body.String(), err)
			}
			if response.Result != test.wantResult {
				testingObject.Fatalf("torrent-add result = %q, want %q", response.Result, test.wantResult)
			}

			added := containsTransmissionMethod(fixture.firstFake.recordedCalls()[callsBefore:], "torrent-add")
			if added != test.wantAdded {
				testingObject.Fatalf("torrent-add reached the daemon = %t, want %t", added, test.wantAdded)
			}
		})
	}
}

// newSizedTorrentAddFixture answers every torrent-add with the hash it was sent.
func newSizedTorrentAddFixture(testingObject *testing.T) multiTransmissionFixture {
	testingObject.Helper()

	return newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			switch call.Method {
			case "torrent-get":
				return map[string]any{"torrents": []map[string]any{}}
			case "torrent-add":
				encoded, _ := call.Arguments["metainfo"].(string)
				metainfo, _ := base64.StdEncoding.DecodeString(encoded)
				hash, _, _ := torrentSourceHash("", metainfo)

				return map[string]any{"torrent-added": map[string]any{
					"hashString": hash,
					"id":         5,
					"name":       "test",
				}}
			}

			return map[string]any{}
		},
		func(recordedTransmissionCall) any {
			return map[string]any{"torrents": []map[string]any{}}
		},
	)
}

// sizedTestMetainfo builds a valid single-file .torrent of exactly size bytes by
// padding a top-level string after the info dictionary.
func sizedTestMetainfo(testingObject *testing.T, size int) []byte {
	testingObject.Helper()

	head := "d4:infod6:lengthi1e4:name4:teste7:padding"
	for digits := 1; digits <= 10; digits++ {
		paddingLength := size - len(head) - digits - 2
		if paddingLength < 0 || len(strconv.Itoa(paddingLength)) != digits {
			continue
		}

		var builder strings.Builder
		builder.Grow(size)
		builder.WriteString(head)
		builder.WriteString(strconv.Itoa(paddingLength))
		builder.WriteString(":")
		builder.WriteString(strings.Repeat("x", paddingLength))
		builder.WriteString("e")
		metainfo := []byte(builder.String())
		if len(metainfo) != size {
			testingObject.Fatalf("built metainfo of %d bytes, want %d", len(metainfo), size)
		}
		if _, known, err := torrentSourceHash("", metainfo); err != nil || !known {
			testingObject.Fatalf("sized metainfo hash known %t, error %v", known, err)
		}

		return metainfo
	}
	testingObject.Fatalf("cannot build metainfo of %d bytes", size)

	return nil
}
