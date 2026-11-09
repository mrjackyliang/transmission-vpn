package api

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"slices"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionrpc"
)

type backupTestDirectoryBrowser struct {
	testDirectoryBrowser
	metainfo []byte
}

func (browser backupTestDirectoryBrowser) ReadTorrent(
	_ context.Context,
	_ string,
) ([]byte, error) {
	return bytes.Clone(browser.metainfo), nil
}

func requestBackupTestGrant(
	t *testing.T,
	server *Server,
	cookies []*http.Cookie,
	csrfToken string,
	purpose string,
	password string,
	code string,
) (string, int) {
	t.Helper()

	body, err := json.Marshal(map[string]string{
		"purpose":  purpose,
		"password": password,
		"code":     code,
	})
	if err != nil {
		t.Fatal(err)
	}
	response := performRequest(
		t,
		server,
		http.MethodPost,
		"/api/v1/backup/confirmation",
		string(body),
		cookies,
		csrfToken,
	)
	if response.Code != http.StatusOK {
		return "", response.Code
	}
	var result struct {
		Grant string `json:"grant"`
	}
	decodeBody(t, response, &result)

	return result.Grant, response.Code
}

func useBackupTestGrant(
	t *testing.T,
	server *Server,
	cookies []*http.Cookie,
	csrfToken string,
	grant string,
) int {
	t.Helper()

	body, err := json.Marshal(map[string]any{
		"grant": grant,
		"sections": map[string]bool{
			"labels": true,
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	return performRequest(
		t,
		server,
		http.MethodPost,
		"/api/v1/backup/export",
		string(body),
		cookies,
		csrfToken,
	).Code
}

// TestBackupConfirmationGrants verifies every password confirmation constraint.
func TestBackupConfirmationGrants(t *testing.T) {
	t.Run("password only and single use", func(t *testing.T) {
		server, cookies, csrfToken := newClaimedTestServer(t)
		grant, status := requestBackupTestGrant(
			t,
			server,
			cookies,
			csrfToken,
			"export",
			testPassword,
			"",
		)
		if status != http.StatusOK || grant == "" {
			t.Fatalf("password confirmation = %d, grant %q", status, grant)
		}
		if status := useBackupTestGrant(t, server, cookies, csrfToken, grant); status != http.StatusOK {
			t.Fatalf("first grant use = %d, want 200", status)
		}
		if status := useBackupTestGrant(t, server, cookies, csrfToken, grant); status != http.StatusUnauthorized {
			t.Fatalf("second grant use = %d, want 401", status)
		}
	})

	t.Run("password and TOTP", func(t *testing.T) {
		server, cookies, csrfToken := newClaimedTestServer(t)
		setup := performRequest(
			t,
			server,
			http.MethodPost,
			"/api/v1/auth/totp/setup",
			`{"password":"`+testPassword+`"}`,
			cookies,
			csrfToken,
		)
		var setupBody struct {
			Secret string `json:"secret"`
		}
		decodeBody(t, setup, &setupBody)
		step := security.TOTPStep(time.Now())
		enableCode, err := security.TOTPCode(setupBody.Secret, step)
		if err != nil {
			t.Fatal(err)
		}
		enabled := performRequest(
			t,
			server,
			http.MethodPost,
			"/api/v1/auth/totp/enable",
			`{"code":"`+enableCode+`"}`,
			cookies,
			csrfToken,
		)
		if enabled.Code != http.StatusOK {
			t.Fatalf("enable TOTP = %d: %s", enabled.Code, enabled.Body.String())
		}

		wrongCode := "000000"
		validCode, err := security.TOTPCode(setupBody.Secret, step+1)
		if err != nil {
			t.Fatal(err)
		}
		if wrongCode == enableCode || wrongCode == validCode {
			wrongCode = "111111"
		}
		if grant, status := requestBackupTestGrant(
			t,
			server,
			cookies,
			csrfToken,
			"export",
			testPassword,
			wrongCode,
		); status != http.StatusUnprocessableEntity || grant != "" {
			t.Fatalf("wrong TOTP confirmation = %d, grant %q", status, grant)
		}
		grant, status := requestBackupTestGrant(
			t,
			server,
			cookies,
			csrfToken,
			"export",
			testPassword,
			validCode,
		)
		if status != http.StatusOK || grant == "" {
			t.Fatalf("TOTP confirmation = %d, grant %q", status, grant)
		}
	})

	t.Run("expiry", func(t *testing.T) {
		server, cookies, csrfToken := newClaimedTestServer(t)
		now := time.Date(2026, time.November, 8, 12, 0, 0, 0, time.UTC)
		server.backupClock = func() time.Time { return now }
		grant, status := requestBackupTestGrant(
			t,
			server,
			cookies,
			csrfToken,
			"export",
			testPassword,
			"",
		)
		if status != http.StatusOK {
			t.Fatalf("confirmation = %d", status)
		}
		now = now.Add(backupReauthenticationLifetime + time.Nanosecond)
		if status := useBackupTestGrant(t, server, cookies, csrfToken, grant); status != http.StatusUnauthorized {
			t.Fatalf("expired grant use = %d, want 401", status)
		}
	})

	t.Run("other session", func(t *testing.T) {
		server, cookies, csrfToken := newClaimedTestServer(t)
		grant, status := requestBackupTestGrant(
			t,
			server,
			cookies,
			csrfToken,
			"export",
			testPassword,
			"",
		)
		if status != http.StatusOK {
			t.Fatalf("confirmation = %d", status)
		}
		other := performRequest(
			t,
			server,
			http.MethodPost,
			"/api/v1/auth/login",
			`{"username":"administrator","password":"`+testPassword+`"}`,
			nil,
			"",
		)
		otherCookies := other.Result().Cookies()
		otherCSRF := cookieValue(t, otherCookies, "tvpn_csrf")
		if status := useBackupTestGrant(t, server, otherCookies, otherCSRF, grant); status != http.StatusUnauthorized {
			t.Fatalf("other-session grant use = %d, want 401", status)
		}
		if status := useBackupTestGrant(t, server, cookies, csrfToken, grant); status != http.StatusOK {
			t.Fatalf("bound session grant use = %d, want 200", status)
		}
	})
}

func backupTestMetainfo(t *testing.T) ([]byte, string) {
	t.Helper()

	info := bytes.Join([][]byte{
		[]byte("d6:lengthi1e4:name11:backup-file12:piece lengthi16384e6:pieces20:"),
		bytes.Repeat([]byte{'x'}, 20),
		[]byte("e"),
	}, nil)
	metainfo := bytes.Join([][]byte{
		[]byte("d4:info"),
		info,
		[]byte("e"),
	}, nil)
	hash, known, err := torrentSourceHash("", metainfo)
	if err != nil || !known {
		t.Fatalf("build test metainfo: %v, known %t", err, known)
	}

	return metainfo, hash
}

// TestBackupExportIncludesSelectedSectionsAndPlaintextSecrets covers the v1 payload.
func TestBackupExportIncludesSelectedSectionsAndPlaintextSecrets(t *testing.T) {
	metainfo, hash := backupTestMetainfo(t)
	fixture := newMultiTransmissionFixture(
		t,
		func(call recordedTransmissionCall) any {
			if call.Method != "torrent-get" {
				return map[string]any{}
			}

			return map[string]any{"torrents": []map[string]any{{
				"bandwidthPriority":       1,
				"downloadDir":             "/data/backups",
				"downloadLimit":           900,
				"downloadLimited":         true,
				"files":                   []map[string]any{{"name": "backup-file"}},
				"fileStats":               []map[string]any{{"wanted": true, "priority": 1}},
				"group":                   "",
				"hashString":              hash,
				"honorsSessionLimits":     false,
				"id":                      31,
				"labels":                  []string{"Portable"},
				"magnetLink":              "",
				"metadataPercentComplete": 1,
				"name":                    "Backup fixture",
				"peer-limit":              70,
				"percentDone":             0.75,
				"seedIdleLimit":           20,
				"seedIdleMode":            1,
				"seedRatioLimit":          2.5,
				"seedRatioMode":           1,
				"status":                  4,
				"uploadLimit":             400,
				"uploadLimited":           true,
			}}}
		},
		func(recordedTransmissionCall) any {
			return map[string]any{"torrents": []map[string]any{}}
		},
	)
	server := fixture.server
	server.directoryBrowser = backupTestDirectoryBrowser{
		testDirectoryBrowser: testDirectoryBrowser{},
		metainfo:             metainfo,
	}
	if _, err := server.store.EnsureTorrentLabels(context.Background(), []string{"Portable"}); err != nil {
		t.Fatal(err)
	}
	if _, err := server.store.CreateTorrentProfile(context.Background(), storage.TorrentProfile{
		ID:                newTorrentProfileID(),
		Name:              "Backup profile",
		DownloadDirectory: "/data/backup-profile",
		Labels:            []string{"Portable"},
		Options: storage.TorrentProfileOptions{
			Seeding:   storage.TorrentProfileSeeding{Mode: "never"},
			PeerLimit: 50,
			Queue:     "normal",
		},
		MatchPatterns: []string{"*backup*"},
		ConnectionID:  &fixture.first.ID,
	}); err != nil {
		t.Fatal(err)
	}
	notificationSecrets := map[string]string{"token": "plain-notification-secret"}
	nonce, ciphertext, secretFields, err := sealNotificationSecrets(
		server.installationKey,
		"ntf-1111111111111111",
		notificationSecrets,
	)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := server.store.CreateNotificationTarget(context.Background(), storage.NotificationTarget{
		ID:                "ntf-1111111111111111",
		Name:              "Backup destination",
		Service:           "ntfy",
		Events:            []string{"torrent-finished"},
		Settings:          map[string]string{"url": "https://notify.example.test"},
		SecretFields:      secretFields,
		SecretsNonce:      nonce,
		SecretsCiphertext: ciphertext,
	}); err != nil {
		t.Fatal(err)
	}
	rpcDigest := []byte("restorable RPC digest")
	if _, err := server.store.CreateRPCLogin(context.Background(), storage.RPCLogin{
		ID:           "rpl-1111111111111111",
		Username:     "backup-client",
		SecretDigest: rpcDigest,
	}); err != nil {
		t.Fatal(err)
	}
	tokenDigest := []byte("restorable token digest")
	if _, err := server.store.CreateAPIToken(
		context.Background(),
		"tok-1111111111111111",
		1,
		"Backup token",
		tokenDigest,
		[]string{"settings:read"},
		nil,
	); err != nil {
		t.Fatal(err)
	}

	document, err := server.buildBackupDocument(context.Background(), backupExportSelection{
		SettingsAndProfiles: true,
		Labels:              true,
		Notifications:       true,
		Torrents:            true,
		VPNConnections:      true,
		RemoteAccess:        true,
	})
	if err != nil {
		t.Fatalf("build export: %v", err)
	}
	if document.SettingsAndProfiles == nil || len(document.SettingsAndProfiles.Settings) == 0 ||
		len(document.SettingsAndProfiles.Profiles) != 1 {
		t.Fatalf("settings and profiles = %#v", document.SettingsAndProfiles)
	}
	if document.Labels == nil || !slices.Contains(*document.Labels, "Portable") {
		t.Fatalf("labels = %#v", document.Labels)
	}
	if document.Notifications == nil || len(*document.Notifications) != 1 ||
		(*document.Notifications)[0].Secrets["token"] != "plain-notification-secret" {
		t.Fatalf("notification export = %#v", document.Notifications)
	}
	if document.Torrents == nil || len(*document.Torrents) != 1 ||
		(*document.Torrents)[0].Metainfo != base64.StdEncoding.EncodeToString(metainfo) ||
		(*document.Torrents)[0].Hash != hash || (*document.Torrents)[0].Paused {
		t.Fatalf("torrent export = %#v", document.Torrents)
	}
	if document.VPNConnections == nil || len(document.VPNConnections.Connections) != 2 ||
		len(document.VPNConnections.Profiles) != 1 ||
		!strings.Contains(document.VPNConnections.Profiles[0].Configuration, testWireGuardPrivateKey) {
		t.Fatalf("VPN export = %#v", document.VPNConnections)
	}
	if document.RemoteAccess == nil || len(document.RemoteAccess.RPCLogins) != 1 ||
		len(document.RemoteAccess.APITokens) != 1 ||
		document.RemoteAccess.RPCLogins[0].SecretDigest != base64.StdEncoding.EncodeToString(rpcDigest) ||
		document.RemoteAccess.APITokens[0].TokenDigest != base64.StdEncoding.EncodeToString(tokenDigest) {
		t.Fatalf("remote access export = %#v", document.RemoteAccess)
	}
	if err := validateBackupDocument(document); err != nil {
		t.Fatalf("export did not validate: %v", err)
	}
}

// TestBackupDocumentValidationRejectsWrongAndIncompleteFormats protects strict import.
func TestBackupDocumentValidationRejectsWrongAndIncompleteFormats(t *testing.T) {
	valid := `{"format":"transmission-vpn-export","version":1,"exportedAt":"2026-11-08T12:00:00Z","appVersion":"2.0.0","labels":[]}`
	if _, err := decodeBackupDocument(json.RawMessage(valid)); err != nil {
		t.Fatalf("valid document: %v", err)
	}
	tests := map[string]string{
		"bad format":      strings.Replace(valid, "transmission-vpn-export", "other-export", 1),
		"bad version":     strings.Replace(valid, `"version":1`, `"version":2`, 1),
		"missing version": strings.Replace(valid, `"version":1,`, "", 1),
		"missing app":     strings.Replace(valid, `"appVersion":"2.0.0",`, "", 1),
		"missing section fields": `{"format":"transmission-vpn-export","version":1,` +
			`"exportedAt":"2026-11-08T12:00:00Z","appVersion":"2.0.0","settingsAndProfiles":{}}`,
		"missing torrent scalar": `{"format":"transmission-vpn-export","version":1,` +
			`"exportedAt":"2026-11-08T12:00:00Z","appVersion":"2.0.0","torrents":[{` +
			`"hash":"1111111111111111111111111111111111111111","name":"Missing paused",` +
			`"metainfo":"dGVzdA==","profileId":null,"profileName":"Default profile",` +
			`"downloadDirectory":"/data/downloads","connectionId":"vpc-test","labels":[],` +
			`"percentDone":0,"limits":{"bandwidthPriority":0,"downloadLimit":0,` +
			`"downloadLimited":false,"honorsSessionLimits":true,"peerLimit":50,` +
			`"seedIdleLimit":0,"seedIdleMode":0,"seedRatioLimit":0,"seedRatioMode":0,` +
			`"uploadLimit":0,"uploadLimited":false}}]}`,
		"null torrent scalar": `{"format":"transmission-vpn-export","version":1,` +
			`"exportedAt":"2026-11-08T12:00:00Z","appVersion":"2.0.0","torrents":[{` +
			`"hash":"1111111111111111111111111111111111111111","name":"Null paused",` +
			`"metainfo":"dGVzdA==","profileId":null,"profileName":"Default profile",` +
			`"downloadDirectory":"/data/downloads","connectionId":"vpc-test","labels":[],` +
			`"paused":null,"percentDone":0,"limits":{"bandwidthPriority":0,"downloadLimit":0,` +
			`"downloadLimited":false,"honorsSessionLimits":true,"peerLimit":50,` +
			`"seedIdleLimit":0,"seedIdleMode":0,"seedRatioLimit":0,"seedRatioMode":0,` +
			`"uploadLimit":0,"uploadLimited":false}}]}`,
		"unknown field": strings.Replace(valid, `"labels":[]`, `"labels":[],"unexpected":true`, 1),
	}
	for name, rawDocument := range tests {
		t.Run(name, func(t *testing.T) {
			if _, err := decodeBackupDocument(json.RawMessage(rawDocument)); err == nil {
				t.Fatalf("invalid document was accepted: %s", rawDocument)
			}
		})
	}
}

// TestBackupProfileConflictActions verifies Replace, Keep, and Default in-place updates.
func TestBackupProfileConflictActions(t *testing.T) {
	for _, testCase := range []struct {
		action        string
		wantDirectory string
	}{
		{action: "replace", wantDirectory: "/data/imported-movies"},
		{action: "keep", wantDirectory: "/data/current-movies"},
	} {
		t.Run(testCase.action, func(t *testing.T) {
			server, _, _ := newClaimedTestServer(t)
			existing, err := server.store.CreateTorrentProfile(context.Background(), storage.TorrentProfile{
				ID:                newTorrentProfileID(),
				Name:              "Movies",
				DownloadDirectory: "/data/current-movies",
				Labels:            []string{"current"},
				Options: storage.TorrentProfileOptions{
					Seeding:   storage.TorrentProfileSeeding{Mode: "never"},
					PeerLimit: 50,
					Queue:     "normal",
				},
				MatchPatterns: []string{"*movie*"},
			})
			if err != nil {
				t.Fatal(err)
			}
			importedID := newTorrentProfileID()
			profileIDs, err := server.importBackupProfiles(
				context.Background(),
				backupSettingsAndProfilesSection{
					DefaultProfile: backupDefaultProfile{
						Name:        "Imported Default",
						Labels:      []string{"default-imported"},
						StartPaused: true,
						Options: storage.TorrentProfileOptions{
							Seeding:   storage.TorrentProfileSeeding{Mode: "never"},
							PeerLimit: 60,
							Queue:     "normal",
						},
					},
					Profiles: []storage.TorrentProfile{{
						ID:                importedID,
						Name:              "Movies",
						DownloadDirectory: "/data/imported-movies",
						Labels:            []string{"imported"},
						Options: storage.TorrentProfileOptions{
							Seeding:   storage.TorrentProfileSeeding{Mode: "never"},
							PeerLimit: 80,
							Queue:     "normal",
						},
						MatchPatterns: []string{"*feature*"},
					}},
				},
				map[string]string{},
				map[string]string{importedID: testCase.action},
				map[string]string{},
			)
			if err != nil {
				t.Fatalf("import profiles: %v", err)
			}
			if profileIDs[importedID] != existing.ID {
				t.Fatalf("mapped profile = %q, want %q", profileIDs[importedID], existing.ID)
			}
			stored, err := server.store.FindTorrentProfile(context.Background(), existing.ID)
			if err != nil {
				t.Fatal(err)
			}
			if stored.DownloadDirectory != testCase.wantDirectory {
				t.Fatalf("stored directory = %q, want %q", stored.DownloadDirectory, testCase.wantDirectory)
			}
			defaultProfile, err := server.store.DefaultTorrentProfile(context.Background())
			if err != nil {
				t.Fatal(err)
			}
			if defaultProfile.Name != "Imported Default" || !defaultProfile.StartPaused {
				t.Fatalf("Default profile = %+v", defaultProfile)
			}
		})
	}
}

func createBackupTorrentTestJob(
	t *testing.T,
	server *Server,
	hash string,
	name string,
) string {
	t.Helper()

	jobID := "backup-torrent-test"
	if _, err := server.store.CreateBackupImportJob(context.Background(), storage.BackupImportJob{
		ID:                jobID,
		Source:            "transmission-vpn-export",
		PayloadNonce:      []byte("nonce"),
		PayloadCiphertext: []byte("ciphertext"),
		Summary:           map[string]any{},
		Items: []storage.BackupImportItem{{
			Hash:        hash,
			Name:        name,
			ProfileName: "Default profile",
			Folder:      "/data/downloads",
		}},
	}); err != nil {
		t.Fatal(err)
	}

	return jobID
}

// TestBackupImportReportsDuplicateTorrent verifies duplicate detection precedes add.
func TestBackupImportReportsDuplicateTorrent(t *testing.T) {
	fixture := newMultiTransmissionFixture(
		t,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{{
					"hashString": firstTestHash,
					"id":         7,
					"name":       "Already here",
				}}}
			}

			return map[string]any{}
		},
		func(recordedTransmissionCall) any {
			return map[string]any{"torrents": []map[string]any{}}
		},
	)
	jobID := createBackupTorrentTestJob(t, fixture.server, firstTestHash, "Already here")
	fixture.server.importBackupTorrent(
		context.Background(),
		jobID,
		0,
		backupTorrent{
			Hash:              firstTestHash,
			Name:              "Already here",
			Metainfo:          base64.StdEncoding.EncodeToString([]byte("unused")),
			ProfileName:       "Default profile",
			DownloadDirectory: "/data/downloads",
			ConnectionID:      fixture.first.ID,
			Labels:            []string{},
		},
		map[string]string{},
		backupImportConfigurationResult{
			ProfileIDs:    map[string]string{},
			ConnectionIDs: map[string]string{},
		},
		"queued",
	)
	job, err := fixture.server.store.BackupImportJobByID(context.Background(), jobID)
	if err != nil {
		t.Fatal(err)
	}
	if job.Items[0].State != "already-added" || job.CompletedTorrents != 1 {
		t.Fatalf("duplicate progress = %+v", job)
	}
	if containsTransmissionMethod(fixture.firstFake.recordedCalls(), "torrent-add") {
		t.Fatalf("duplicate was added: %#v", fixture.firstFake.recordedCalls())
	}
}

// TestBackupImportJobResumesAfterRunnerRestart verifies durable queued work is resumed.
func TestBackupImportJobResumesAfterRunnerRestart(t *testing.T) {
	server, _, _ := newClaimedTestServer(t)
	server.transmissionConfigPublisher = func(
		context.Context,
		*storage.Store,
		settings.Registry,
		string,
	) ([]transmissionrpc.DaemonConfig, error) {
		return []transmissionrpc.DaemonConfig{}, nil
	}
	labels := []string{"Resumed import"}
	payload, err := json.Marshal(backupImportPayload{
		AdministratorID: 1,
		Document: backupDocument{
			Format:     backupFormatName,
			Version:    backupFormatVersion,
			ExportedAt: time.Now().UTC(),
			AppVersion: "test",
			Labels:     &labels,
		},
		FolderMappings: map[string]string{},
		ProfileActions: map[string]string{},
	})
	if err != nil {
		t.Fatal(err)
	}
	const jobID = "backup-resume-test"
	nonce, ciphertext, err := security.EncryptSecret(
		server.installationKey,
		"backup/import/"+jobID,
		payload,
	)
	if err != nil {
		t.Fatal(err)
	}
	clear(payload)
	if _, err := server.store.CreateBackupImportJob(context.Background(), storage.BackupImportJob{
		ID:                jobID,
		Source:            "transmission-vpn-export",
		PayloadNonce:      nonce,
		PayloadCiphertext: ciphertext,
		Summary:           map[string]any{},
		Items:             []storage.BackupImportItem{},
	}); err != nil {
		t.Fatal(err)
	}

	server.backupImportCancel()
	server.backupImportWait.Wait()
	server.backupImportContext, server.backupImportCancel = context.WithCancel(context.Background())
	server.resumeBackupImports()
	deadline := time.Now().Add(3 * time.Second)
	for {
		job, readError := server.store.BackupImportJobByID(context.Background(), jobID)
		if readError != nil {
			t.Fatal(readError)
		}
		if job.Status == "completed" {
			if len(job.PayloadNonce) != 0 || len(job.PayloadCiphertext) != 0 {
				t.Fatal("completed job retained its encrypted source payload")
			}

			break
		}
		if job.Status == "failed" {
			t.Fatalf("resumed job failed: %s", job.Error)
		}
		if time.Now().After(deadline) {
			t.Fatalf("resumed job remained %s", job.Status)
		}
		time.Sleep(10 * time.Millisecond)
	}
	organization, err := server.store.TorrentOrganization(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Contains(organization.Labels, "Resumed import") {
		t.Fatalf("resumed labels = %#v", organization.Labels)
	}
}

// TestBackupTorrentRechecksBeforeRestoringRunState verifies paused-first import order.
func TestBackupTorrentRechecksBeforeRestoringRunState(t *testing.T) {
	for _, testCase := range []struct {
		name        string
		paused      bool
		finalMethod string
		finalState  string
	}{
		{name: "running", finalMethod: "torrent-start", finalState: "downloading"},
		{name: "paused", paused: true, finalMethod: "torrent-stop", finalState: "paused"},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			var torrentGets atomic.Int64
			fixture := newMultiTransmissionFixture(
				t,
				func(call recordedTransmissionCall) any {
					switch call.Method {
					case "torrent-get":
						switch torrentGets.Add(1) {
						case 1:
							return map[string]any{"torrents": []map[string]any{}}
						case 2:
							return map[string]any{"torrents": []map[string]any{{
								"error":           0,
								"errorString":     "",
								"hashString":      firstTestHash,
								"percentDone":     0.4,
								"recheckProgress": 0.5,
								"status":          2,
							}}}
						default:
							return map[string]any{"torrents": []map[string]any{{
								"error":           0,
								"errorString":     "",
								"hashString":      firstTestHash,
								"percentDone":     0.4,
								"recheckProgress": 1,
								"status":          4,
							}}}
						}
					case "torrent-add":
						return map[string]any{"torrent-added": map[string]any{
							"hashString": firstTestHash,
							"id":         41,
							"name":       "Imported fixture",
						}}
					default:
						return map[string]any{}
					}
				},
				func(recordedTransmissionCall) any {
					return map[string]any{"torrents": []map[string]any{}}
				},
			)
			fixture.server.backupImportPollInterval = time.Millisecond
			jobID := createBackupTorrentTestJob(t, fixture.server, firstTestHash, "Imported fixture")
			fixture.server.importBackupTorrent(
				context.Background(),
				jobID,
				0,
				backupTorrent{
					Hash:              firstTestHash,
					Name:              "Imported fixture",
					Metainfo:          base64.StdEncoding.EncodeToString([]byte("fixture metainfo")),
					ProfileName:       "Default profile",
					DownloadDirectory: "/data/downloads",
					ConnectionID:      fixture.first.ID,
					Labels:            []string{"Imported"},
					Paused:            testCase.paused,
					PercentDone:       0.4,
					Limits: backupTorrentLimits{
						PeerLimit: 50,
					},
				},
				map[string]string{},
				backupImportConfigurationResult{
					ProfileIDs:    map[string]string{},
					ConnectionIDs: map[string]string{},
				},
				"queued",
			)

			job, err := fixture.server.store.BackupImportJobByID(context.Background(), jobID)
			if err != nil {
				t.Fatal(err)
			}
			if job.Items[0].State != testCase.finalState || job.CompletedTorrents != 1 {
				t.Fatalf("final progress = %+v", job)
			}
			calls := fixture.firstFake.recordedCalls()
			methods := make([]string, 0, len(calls))
			for _, call := range calls {
				methods = append(methods, call.Method)
			}
			addIndex := slices.Index(methods, "torrent-add")
			verifyIndex := slices.Index(methods, "torrent-verify")
			finalIndex := slices.Index(methods, testCase.finalMethod)
			if addIndex < 0 || verifyIndex <= addIndex || finalIndex <= verifyIndex {
				t.Fatalf("RPC order = %#v", methods)
			}
			addCall := calls[addIndex]
			if addCall.Arguments["paused"] != true {
				t.Fatalf("torrent-add paused = %#v", addCall.Arguments["paused"])
			}
		})
	}
}
