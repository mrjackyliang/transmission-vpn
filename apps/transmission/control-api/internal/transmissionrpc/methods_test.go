package transmissionrpc

import (
	"context"
	"encoding/json"
	"reflect"
	"testing"
)

// adapterTestCaller records the exact native request and supplies one JSON response.
//
// It exercises the typed boundary without opening a loopback listener.
//
// Since: 2.4.1
type adapterTestCaller struct {
	response any
	request  []byte
}

// Call implements Caller without opening a native Transmission listener.
//
// Since: 2.4.1
func (caller *adapterTestCaller) Call(
	_ context.Context,
	method string,
	arguments any,
	result any,
) error {
	request, err := json.Marshal(struct {
		Method    string `json:"method"`
		Arguments any    `json:"arguments,omitempty"`
	}{
		Method:    method,
		Arguments: arguments,
	})
	if err != nil {
		return err
	}
	caller.request = request
	if result == nil || caller.response == nil {
		return nil
	}

	response, err := json.Marshal(caller.response)
	if err != nil {
		return err
	}

	return json.Unmarshal(response, result)
}

// TestAdapterMethods verifies every typed operation's native request and decoded response.
//
// Since: 2.4.1
func TestAdapterMethods(testingObject *testing.T) {
	downloadDirectory := "/data/downloads"
	filename := "https://example.test/release.torrent"
	labels := []string{"Linux", "Archive"}
	metainfo := "ZDE6YWVl"
	paused := true

	tests := []struct {
		name            string
		response        any
		expectedRequest string
		expectedResult  any
		call            func(context.Context, *Adapter) (any, error)
	}{
		{
			name: "list torrents",
			response: map[string]any{
				ResponseTorrents: []map[string]any{{
					string(TorrentFieldID):   7,
					string(TorrentFieldName): "Release",
				}},
				ResponseRemoved: []int64{3},
			},
			expectedRequest: `{"method":"torrent-get","arguments":{"fields":["id","name"],"ids":[7]}}`,
			expectedResult: ListTorrentsResponse{
				Torrents: []Torrent{{
					string(TorrentFieldID):   float64(7),
					string(TorrentFieldName): "Release",
				}},
				Removed: []int64{3},
			},
			call: func(ctx context.Context, adapter *Adapter) (any, error) {
				return adapter.ListTorrents(ctx, ListTorrentsRequest{
					Fields: []TorrentField{TorrentFieldID, TorrentFieldName},
					IDs:    []int64{7},
				})
			},
		},
		{
			name:            "get complete session",
			response:        map[string]any{string(SessionFieldVersion): "4.0.6"},
			expectedRequest: `{"method":"session-get"}`,
			expectedResult:  "4.0.6",
			call: func(ctx context.Context, adapter *Adapter) (any, error) {
				session, err := adapter.GetSession(ctx, GetSessionRequest{})
				if err != nil {
					return nil, err
				}
				var version string
				if err := session.DecodeValue(SessionFieldVersion, &version); err != nil {
					return nil, err
				}

				return version, nil
			},
		},
		{
			name:            "get session fields",
			response:        map[string]any{string(SessionFieldStartAddedTorrents): true},
			expectedRequest: `{"method":"session-get","arguments":{"fields":["start-added-torrents","version"]}}`,
			expectedResult:  true,
			call: func(ctx context.Context, adapter *Adapter) (any, error) {
				session, err := adapter.GetSession(ctx, GetSessionRequest{Fields: []SessionField{
					SessionFieldStartAddedTorrents,
					SessionFieldVersion,
				}})
				if err != nil {
					return nil, err
				}
				var startAdded bool
				if err := session.DecodeValue(SessionFieldStartAddedTorrents, &startAdded); err != nil {
					return nil, err
				}

				return startAdded, nil
			},
		},
		{
			name:            "set session",
			expectedRequest: `{"method":"session-set","arguments":{"download-dir":"/data/downloads","start-added-torrents":true}}`,
			call: func(ctx context.Context, adapter *Adapter) (any, error) {
				return nil, adapter.SetSession(ctx, SetSessionRequest{Values: SessionValues{
					SessionFieldDownloadDirectory:  "/data/downloads",
					SessionFieldStartAddedTorrents: true,
				}})
			},
		},
		{
			name:            "close session",
			expectedRequest: `{"method":"session-close"}`,
			call: func(ctx context.Context, adapter *Adapter) (any, error) {
				return nil, adapter.CloseSession(ctx)
			},
		},
		{
			name:            "get free space",
			response:        map[string]any{"size-bytes": 4096},
			expectedRequest: `{"method":"free-space","arguments":{"path":"/data"}}`,
			expectedResult:  FreeSpace{"size-bytes": float64(4096)},
			call: func(ctx context.Context, adapter *Adapter) (any, error) {
				return adapter.GetFreeSpace(ctx, FreeSpaceRequest{Path: "/data"})
			},
		},
		{
			name: "add torrent from URL",
			response: map[string]any{ResponseTorrentAdded: map[string]any{
				string(TorrentFieldID):         9,
				string(TorrentFieldHashString): "ABCDEF",
				string(TorrentFieldName):       "Release",
			}},
			expectedRequest: `{"method":"torrent-add","arguments":{"download-dir":"/data/downloads","filename":"https://example.test/release.torrent","labels":["Linux","Archive"],"paused":true}}`,
			expectedResult: AddTorrentResponse{Added: &AddedTorrent{
				ID: 9, HashString: "ABCDEF", Name: "Release",
			}},
			call: func(ctx context.Context, adapter *Adapter) (any, error) {
				return adapter.AddTorrent(ctx, AddTorrentRequest{
					DownloadDirectory: &downloadDirectory,
					Filename:          &filename,
					Labels:            &labels,
					Paused:            &paused,
				})
			},
		},
		{
			name: "add torrent from metainfo",
			response: map[string]any{ResponseTorrentDuplicate: map[string]any{
				string(TorrentFieldID):         11,
				string(TorrentFieldHashString): "FEDCBA",
				string(TorrentFieldName):       "Duplicate",
			}},
			expectedRequest: `{"method":"torrent-add","arguments":{"metainfo":"ZDE6YWVl"}}`,
			expectedResult: AddTorrentResponse{Duplicate: &AddedTorrent{
				ID: 11, HashString: "FEDCBA", Name: "Duplicate",
			}},
			call: func(ctx context.Context, adapter *Adapter) (any, error) {
				return adapter.AddTorrent(ctx, AddTorrentRequest{Metainfo: &metainfo})
			},
		},
		{
			name:            "set torrents",
			expectedRequest: `{"method":"torrent-set","arguments":{"downloadLimit":1024,"ids":[5],"labels":["Linux"]}}`,
			call: func(ctx context.Context, adapter *Adapter) (any, error) {
				return nil, adapter.SetTorrents(ctx, SetTorrentsRequest{
					IDs: []int64{5},
					Changes: map[TorrentArgument]any{
						TorrentArgumentDownloadLimit: int64(1024),
						TorrentArgumentLabels:        []string{"Linux"},
					},
				})
			},
		},
		{
			name:            "set torrent labels",
			expectedRequest: `{"method":"torrent-set","arguments":{"ids":[5],"labels":["Linux","Archive"]}}`,
			call: func(ctx context.Context, adapter *Adapter) (any, error) {
				return nil, adapter.SetTorrentLabels(ctx, SetTorrentLabelsRequest{
					IDs:    []int64{5},
					Labels: []string{"Linux", "Archive"},
				})
			},
		},
		{
			name:            "remove torrents",
			expectedRequest: `{"method":"torrent-remove","arguments":{"delete-local-data":true,"ids":[5]}}`,
			call: func(ctx context.Context, adapter *Adapter) (any, error) {
				return nil, adapter.RemoveTorrents(ctx, RemoveTorrentsRequest{
					IDs:             []int64{5},
					DeleteLocalData: true,
				})
			},
		},
		{
			name:            "set location",
			expectedRequest: `{"method":"torrent-set-location","arguments":{"ids":[5],"location":"/data/moved","move":true}}`,
			call: func(ctx context.Context, adapter *Adapter) (any, error) {
				return nil, adapter.SetLocation(ctx, SetLocationRequest{
					IDs: []int64{5}, Location: "/data/moved", Move: true,
				})
			},
		},
		{
			name:            "rename torrent path",
			response:        map[string]any{string(TorrentFieldID): 5, ArgumentName: "renamed"},
			expectedRequest: `{"method":"torrent-rename-path","arguments":{"ids":[5],"name":"renamed","path":"old"}}`,
			expectedResult: RenameTorrentPathResponse{
				string(TorrentFieldID): float64(5), ArgumentName: "renamed",
			},
			call: func(ctx context.Context, adapter *Adapter) (any, error) {
				return adapter.RenameTorrentPath(ctx, RenameTorrentPathRequest{
					IDs: []int64{5}, Name: "renamed", Path: "old",
				})
			},
		},
		{
			name:            "start torrents",
			expectedRequest: `{"method":"torrent-start","arguments":{"ids":[5]}}`,
			call: func(ctx context.Context, adapter *Adapter) (any, error) {
				return nil, adapter.StartTorrents(ctx, TorrentSelectionRequest{IDs: []int64{5}})
			},
		},
		{
			name:            "start torrents now",
			expectedRequest: `{"method":"torrent-start-now","arguments":{"ids":[5]}}`,
			call: func(ctx context.Context, adapter *Adapter) (any, error) {
				return nil, adapter.StartTorrentsNow(ctx, TorrentSelectionRequest{IDs: []int64{5}})
			},
		},
		{
			name:            "stop torrents",
			expectedRequest: `{"method":"torrent-stop","arguments":{"ids":[5]}}`,
			call: func(ctx context.Context, adapter *Adapter) (any, error) {
				return nil, adapter.StopTorrents(ctx, TorrentSelectionRequest{IDs: []int64{5}})
			},
		},
		{
			name:            "verify torrents",
			expectedRequest: `{"method":"torrent-verify","arguments":{"ids":[5]}}`,
			call: func(ctx context.Context, adapter *Adapter) (any, error) {
				return nil, adapter.VerifyTorrents(ctx, TorrentSelectionRequest{IDs: []int64{5}})
			},
		},
		{
			name:            "reannounce torrents",
			expectedRequest: `{"method":"torrent-reannounce","arguments":{"ids":[5]}}`,
			call: func(ctx context.Context, adapter *Adapter) (any, error) {
				return nil, adapter.ReannounceTorrents(ctx, TorrentSelectionRequest{IDs: []int64{5}})
			},
		},
		{
			name:            "move torrents to queue top",
			expectedRequest: `{"method":"queue-move-top","arguments":{"ids":[5]}}`,
			call: func(ctx context.Context, adapter *Adapter) (any, error) {
				return nil, adapter.MoveTorrentsToQueueTop(ctx, TorrentSelectionRequest{IDs: []int64{5}})
			},
		},
		{
			name:            "move torrents up",
			expectedRequest: `{"method":"queue-move-up","arguments":{"ids":[5]}}`,
			call: func(ctx context.Context, adapter *Adapter) (any, error) {
				return nil, adapter.MoveTorrentsUp(ctx, TorrentSelectionRequest{IDs: []int64{5}})
			},
		},
		{
			name:            "move torrents down",
			expectedRequest: `{"method":"queue-move-down","arguments":{"ids":[5]}}`,
			call: func(ctx context.Context, adapter *Adapter) (any, error) {
				return nil, adapter.MoveTorrentsDown(ctx, TorrentSelectionRequest{IDs: []int64{5}})
			},
		},
		{
			name:            "move torrents to queue bottom",
			expectedRequest: `{"method":"queue-move-bottom","arguments":{"ids":[5]}}`,
			call: func(ctx context.Context, adapter *Adapter) (any, error) {
				return nil, adapter.MoveTorrentsToQueueBottom(ctx, TorrentSelectionRequest{IDs: []int64{5}})
			},
		},
		{
			name: "get session statistics",
			response: map[string]any{
				"downloadSpeed": 2048,
				"torrentCount":  4,
			},
			expectedRequest: `{"method":"session-stats"}`,
			expectedResult: SessionStatistics{
				"downloadSpeed": float64(2048),
				"torrentCount":  float64(4),
			},
			call: func(ctx context.Context, adapter *Adapter) (any, error) {
				return adapter.GetSessionStatistics(ctx)
			},
		},
	}

	for _, test := range tests {
		testingObject.Run(test.name, func(testingObject *testing.T) {
			caller := &adapterTestCaller{response: test.response}
			actualResult, err := test.call(context.Background(), NewAdapter(caller))
			if err != nil {
				testingObject.Fatalf("call typed adapter: %v", err)
			}
			if string(caller.request) != test.expectedRequest {
				testingObject.Fatalf("request = %s, want %s", caller.request, test.expectedRequest)
			}
			if !reflect.DeepEqual(actualResult, test.expectedResult) {
				testingObject.Fatalf("result = %#v, want %#v", actualResult, test.expectedResult)
			}
		})
	}
}
