package api

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"testing"
)

type transmissionSourceTestFixture struct {
	ConfigPath          string
	DefaultDirectory    string
	EmptySibling        string
	Hash                string
	IncompleteDirectory string
	Metainfo            []byte
	UsedDirectory       string
}

// TestParseBoundedBencodeLimitsAndMalformedInput covers structural parser bounds.
func TestParseBoundedBencodeLimitsAndMalformedInput(testingObject *testing.T) {
	testingObject.Run("valid", func(testingObject *testing.T) {
		value, err := parseBoundedBencode([]byte("d4:listli1e3:twoee"), 32)
		if err != nil {
			testingObject.Fatalf("parse valid value: %v", err)
		}
		dictionary, ok := bencodeDictionary(value)
		if !ok || dictionary["list"] == nil {
			testingObject.Fatalf("decoded value = %#v", value)
		}
	})

	for name, input := range map[string]string{
		"leading zero integer": "i03e",
		"missing list end":     "li1e",
		"trailing data":        "i1ei2e",
		"duplicate key":        "d1:ai1e1:ai2ee",
	} {
		testingObject.Run(name, func(testingObject *testing.T) {
			if _, err := parseBoundedBencode([]byte(input), 32); err == nil {
				testingObject.Fatalf("parse %q unexpectedly succeeded", input)
			}
		})
	}

	testingObject.Run("depth", func(testingObject *testing.T) {
		input := strings.Repeat("l", maximumImportBencodeDepth+2) + "i1e" +
			strings.Repeat("e", maximumImportBencodeDepth+2)
		if _, err := parseBoundedBencode([]byte(input), 32); err == nil ||
			!strings.Contains(err.Error(), "nested too deeply") {
			testingObject.Fatalf("depth error = %v", err)
		}
	})

	testingObject.Run("string length", func(testingObject *testing.T) {
		if _, err := parseBoundedBencode([]byte("5:abcde"), 4); err == nil ||
			!strings.Contains(err.Error(), "too large") {
			testingObject.Fatalf("string limit error = %v", err)
		}
	})
}

// TestAnotherTransmissionLayoutsAndHashMatching covers both filename layouts.
func TestAnotherTransmissionLayoutsAndHashMatching(testingObject *testing.T) {
	for _, version := range []int{3, 4} {
		testingObject.Run(fmt.Sprintf("Transmission %d", version), func(testingObject *testing.T) {
			fixture := newTransmissionSourceTestFixture(testingObject, version, true)
			server := newUnclaimedTestServer(testingObject, "ABCDE-23456-FGHIJ", false)
			inspection, err := server.inspectAnotherTransmission(context.Background(), fixture.ConfigPath)
			if err != nil {
				testingObject.Fatalf("inspect source: %v", err)
			}
			if inspection.Version != version || len(inspection.Torrents) != 1 {
				testingObject.Fatalf("inspection = version %d, torrents %d", inspection.Version, len(inspection.Torrents))
			}
			torrent := inspection.Torrents[0]
			if torrent.Hash != fixture.Hash || torrent.DownloadDirectory != fixture.UsedDirectory {
				testingObject.Fatalf("torrent = %+v", torrent)
			}
			if torrent.Paused || torrent.AddedDate != 1_700_000_000 ||
				torrent.Limits.PeerLimit != 77 || torrent.Limits.BandwidthPriority != 1 {
				testingObject.Fatalf("resume fields = %+v", torrent)
			}
			if !reflect.DeepEqual(torrent.Labels, []string{"linux", "archive"}) {
				testingObject.Fatalf("labels = %#v", torrent.Labels)
			}
		})
	}

	testingObject.Run("mismatched filename hash", func(testingObject *testing.T) {
		fixture := newTransmissionSourceTestFixture(testingObject, 4, true)
		entries, err := os.ReadDir(filepath.Join(fixture.ConfigPath, "torrents"))
		if err != nil || len(entries) != 1 {
			testingObject.Fatalf("read torrent fixture: %v", err)
		}
		oldPath := filepath.Join(fixture.ConfigPath, "torrents", entries[0].Name())
		newPath := filepath.Join(fixture.ConfigPath, "torrents", strings.Repeat("0", 40)+".torrent")
		if err := os.Rename(oldPath, newPath); err != nil {
			testingObject.Fatalf("rename fixture: %v", err)
		}
		server := newUnclaimedTestServer(testingObject, "ABCDE-23456-FGHIJ", false)
		if _, err := server.inspectAnotherTransmission(context.Background(), fixture.ConfigPath); err == nil ||
			!strings.Contains(err.Error(), "does not match") {
			testingObject.Fatalf("hash mismatch error = %v", err)
		}
	})
}

// TestAnotherTransmissionMissingResumeUsesSafeDefaults verifies the fallback contract.
func TestAnotherTransmissionMissingResumeUsesSafeDefaults(testingObject *testing.T) {
	fixture := newTransmissionSourceTestFixture(testingObject, 4, false)
	server := newUnclaimedTestServer(testingObject, "ABCDE-23456-FGHIJ", false)
	inspection, err := server.inspectAnotherTransmission(context.Background(), fixture.ConfigPath)
	if err != nil {
		testingObject.Fatalf("inspect source: %v", err)
	}
	if len(inspection.Torrents) != 1 {
		testingObject.Fatalf("torrent count = %d", len(inspection.Torrents))
	}
	torrent := inspection.Torrents[0]
	if torrent.HasResume || !torrent.Paused || torrent.DownloadDirectory != fixture.DefaultDirectory {
		testingObject.Fatalf("missing-resume fallback = %+v", torrent)
	}
}

// TestAnotherTransmissionFolderDiscoveryAndDataCounting covers empty siblings and incomplete data.
func TestAnotherTransmissionFolderDiscoveryAndDataCounting(testingObject *testing.T) {
	fixture := newTransmissionSourceTestFixture(testingObject, 4, true)
	server := newUnclaimedTestServer(testingObject, "ABCDE-23456-FGHIJ", false)
	inspection, err := server.inspectAnotherTransmission(context.Background(), fixture.ConfigPath)
	if err != nil {
		testingObject.Fatalf("inspect source: %v", err)
	}
	foldersByPath := map[string]anotherTransmissionFolder{}
	for _, folder := range inspection.Folders {
		foldersByPath[folder.Path] = folder
	}
	if foldersByPath[fixture.DefaultDirectory].Kind != "default" {
		testingObject.Fatalf("default folder = %+v", foldersByPath[fixture.DefaultDirectory])
	}
	if foldersByPath[fixture.IncompleteDirectory].Kind != "incomplete" {
		testingObject.Fatalf("incomplete folder = %+v", foldersByPath[fixture.IncompleteDirectory])
	}
	if foldersByPath[fixture.EmptySibling].Kind != "empty" {
		testingObject.Fatalf("empty sibling = %+v", foldersByPath[fixture.EmptySibling])
	}
	mappings := map[string]string{}
	for _, folder := range inspection.Folders {
		mappings[folder.Path] = folder.Path
	}
	counts := anotherTransmissionDataCounts(inspection, mappings)
	if count := counts[fixture.IncompleteDirectory]; count.Found != 1 || count.Total != 1 || count.FoundBytes <= 0 {
		testingObject.Fatalf("incomplete data count = %+v", counts[fixture.IncompleteDirectory])
	}
	if counts[fixture.UsedDirectory].Total != 0 {
		testingObject.Fatalf("unfinished torrent counted in completed folder: %+v", counts[fixture.UsedDirectory])
	}
}

// TestAnotherTransmissionSettingsMappingAndSkipList covers supported and rejected keys.
func TestAnotherTransmissionSettingsMappingAndSkipList(testingObject *testing.T) {
	fixture := newTransmissionSourceTestFixture(testingObject, 4, true)
	server := newUnclaimedTestServer(testingObject, "ABCDE-23456-FGHIJ", false)
	inspection, err := server.inspectAnotherTransmission(context.Background(), fixture.ConfigPath)
	if err != nil {
		testingObject.Fatalf("inspect source: %v", err)
	}
	mappedKeys := map[string]struct{}{}
	for _, setting := range inspection.MappedSettings {
		mappedKeys[setting.Key] = struct{}{}
	}
	for _, key := range []string{
		"transmission.blocklistEnabled",
		"transmission.blocklistSources",
		"transmission.downloadDirectory",
		"transmission.downloadQueueEnabled",
		"transmission.downloadQueueSize",
		"transmission.incompleteDirectory",
		"transmission.incompleteDirectoryEnabled",
		"transmission.peerLimitGlobal",
	} {
		if _, found := mappedKeys[key]; !found {
			testingObject.Errorf("mapped setting %s is missing", key)
		}
	}
	skipped := map[string]string{}
	for _, setting := range inspection.SettingPreview {
		if !setting.WillImport {
			skipped[strings.TrimPrefix(setting.Key, "old.")] = setting.Reason
		}
	}
	for key, reasonPart := range map[string]string{
		"bind-address-ipv4": "VPN",
		"peer-port":         "VPN connection",
		"rpc-port":          "RPC logins",
		"watch-dir":         "not supported",
	} {
		if !strings.Contains(skipped[key], reasonPart) {
			testingObject.Errorf("skip %s = %q, want %q", key, skipped[key], reasonPart)
		}
	}
	if inspection.DefaultOptions.PeerLimit != 50 || inspection.DefaultOptions.Seeding.Ratio == nil ||
		*inspection.DefaultOptions.Seeding.Ratio != 2 || inspection.DefaultStartPaused {
		testingObject.Fatalf("default profile mapping = %+v, paused %t", inspection.DefaultOptions, inspection.DefaultStartPaused)
	}
}

// TestAnotherTransmissionOutOfRangeValuesStayHere proves values this app cannot store are reported, not imported.
func TestAnotherTransmissionOutOfRangeValuesStayHere(testingObject *testing.T) {
	fixture := newTransmissionSourceTestFixture(testingObject, 4, true)
	settingsPath := filepath.Join(fixture.ConfigPath, "settings.json")
	content, err := os.ReadFile(settingsPath)
	if err != nil {
		testingObject.Fatal(err)
	}
	values := map[string]any{}
	if err := json.Unmarshal(content, &values); err != nil {
		testingObject.Fatal(err)
	}
	values["peer-limit-global"] = 1_000_000
	values["peer-limit-per-torrent"] = 1_000_000
	values["rpc-socket-mode"] = "0750"
	values["watch-dir-force-generic"] = false
	content, err = json.Marshal(values)
	if err != nil {
		testingObject.Fatal(err)
	}
	if err := os.WriteFile(settingsPath, content, 0o600); err != nil {
		testingObject.Fatal(err)
	}
	server := newUnclaimedTestServer(testingObject, "ABCDE-23456-FGHIJ", false)
	inspection, err := server.inspectAnotherTransmission(context.Background(), fixture.ConfigPath)
	if err != nil {
		testingObject.Fatalf("inspect source: %v", err)
	}
	for _, setting := range inspection.MappedSettings {
		if setting.Key == "transmission.peerLimitGlobal" {
			testingObject.Fatalf("out-of-range global peer limit was mapped: %s", setting.Value)
		}
	}
	if inspection.DefaultOptions.PeerLimit != 50 {
		testingObject.Fatalf("default peer limit = %d, want the current 50", inspection.DefaultOptions.PeerLimit)
	}
	rows := map[string]backupImportSettingPreview{}
	for _, setting := range inspection.SettingPreview {
		rows[setting.Key] = setting
	}
	for key, reasonPart := range map[string]string{
		"transmission.peerLimitGlobal": "1,000,000 is outside what this app allows (1 to 100,000)",
		"profile.default.peerLimit":    "1,000,000 is outside what this app allows (1 to 10,000)",
		"old.rpc-socket-mode":          "RPC logins",
		"old.watch-dir-force-generic":  "Watch folders",
	} {
		row, found := rows[key]
		if !found || row.WillImport || !strings.Contains(row.Reason, reasonPart) {
			testingObject.Errorf("row %s = %+v, want skipped with %q", key, row, reasonPart)
		}
	}
}

// TestAnotherTransmissionSourceRemainsUnchanged proves the started import is read-only.
func TestAnotherTransmissionSourceRemainsUnchanged(testingObject *testing.T) {
	fixture := newTransmissionSourceTestFixture(testingObject, 4, true)
	before := transmissionSourceTreeDigest(testingObject, fixture.ConfigPath)
	server, cookies, csrfToken := newClaimedTestServer(testingObject)
	profileID := uploadTestWireGuardProfile(testingObject, server, cookies, csrfToken)
	createVPNConnectionForMultiTest(
		testingObject,
		server,
		firstTestConnectionID,
		"Import default",
		profileID,
		51413,
	)
	inspection, err := server.inspectAnotherTransmission(context.Background(), fixture.ConfigPath)
	if err != nil {
		testingObject.Fatalf("inspect source: %v", err)
	}
	folderMappings := map[string]string{}
	profileActions := map[string]string{"default": "replace"}
	profileNames := map[string]string{}
	profileNumber := 0
	for index, folder := range inspection.Folders {
		folderMappings[folder.Path] = fmt.Sprintf("/data/import-read-only/%d", index)
		if folder.Kind != "default" && folder.Kind != "incomplete" {
			profileNumber++
			profileNames[folder.Path] = fmt.Sprintf("Imported profile %d", profileNumber)
		}
	}
	grant, status := requestBackupTestGrant(
		testingObject,
		server,
		cookies,
		csrfToken,
		"import",
		testPassword,
		"",
	)
	if status != http.StatusOK {
		testingObject.Fatalf("request import grant status = %d", status)
	}
	requestBody, err := json.Marshal(map[string]any{
		"configPath":     fixture.ConfigPath,
		"folderMappings": folderMappings,
		"grant":          grant,
		"profileActions": profileActions,
		"profileNames":   profileNames,
		"source":         backupAnotherTransmissionSource,
	})
	if err != nil {
		testingObject.Fatal(err)
	}
	response := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/backup/imports",
		string(requestBody),
		cookies,
		csrfToken,
	)
	if response.Code != http.StatusAccepted {
		testingObject.Fatalf("start import status %d: %s", response.Code, response.Body.String())
	}
	after := transmissionSourceTreeDigest(testingObject, fixture.ConfigPath)
	if !reflect.DeepEqual(before, after) {
		testingObject.Fatalf("source changed:\nbefore %#v\nafter  %#v", before, after)
	}
}

// TestTransmissionImportFileLimits rejects oversized settings and resume files.
func TestTransmissionImportFileLimits(testingObject *testing.T) {
	rootPath := testingObject.TempDir()
	root, err := os.OpenRoot(rootPath)
	if err != nil {
		testingObject.Fatal(err)
	}
	defer root.Close()
	for name, maximum := range map[string]int64{
		"oversized.resume":  maximumTransmissionResumeBytes,
		"oversized.torrent": maximumTransmissionTorrentBytes,
		"settings.json":     maximumTransmissionSettingsBytes,
	} {
		content := bytes.Repeat([]byte{'x'}, int(maximum+1))
		if err := os.WriteFile(filepath.Join(rootPath, name), content, 0o600); err != nil {
			testingObject.Fatal(err)
		}
		if _, err := readTransmissionImportFile(root, name, maximum); err == nil ||
			!strings.Contains(err.Error(), "exceeds") {
			testingObject.Errorf("limit for %s = %v", name, err)
		}
	}
}

func newTransmissionSourceTestFixture(
	testingObject *testing.T,
	version int,
	withResume bool,
) transmissionSourceTestFixture {
	testingObject.Helper()

	rootPath := testingObject.TempDir()
	configPath := filepath.Join(rootPath, "config")
	defaultDirectory := filepath.Join(rootPath, "downloads", "default")
	usedDirectory := filepath.Join(rootPath, "downloads", "music")
	emptySibling := filepath.Join(rootPath, "downloads", "podcasts")
	incompleteDirectory := filepath.Join(rootPath, "incomplete")
	for _, path := range []string{
		filepath.Join(configPath, "resume"),
		filepath.Join(configPath, "torrents"),
		defaultDirectory,
		usedDirectory,
		emptySibling,
		incompleteDirectory,
	} {
		if err := os.MkdirAll(path, 0o700); err != nil {
			testingObject.Fatal(err)
		}
	}
	settingsContent, err := json.Marshal(map[string]any{
		"alt-speed-time-enabled":     true,
		"bind-address-ipv4":          "0.0.0.0",
		"blocklist-enabled":          true,
		"blocklist-url":              "https://example.invalid/blocklist.txt",
		"download-dir":               defaultDirectory,
		"download-queue-enabled":     true,
		"download-queue-size":        5,
		"idle-seeding-limit":         30,
		"idle-seeding-limit-enabled": false,
		"incomplete-dir":             incompleteDirectory,
		"incomplete-dir-enabled":     true,
		"peer-limit-global":          200,
		"peer-limit-per-torrent":     50,
		"peer-port":                  51413,
		"ratio-limit":                2.0,
		"ratio-limit-enabled":        true,
		"rpc-port":                   9091,
		"speed-limit-down":           100,
		"speed-limit-down-enabled":   false,
		"speed-limit-up":             500,
		"speed-limit-up-enabled":     true,
		"start-added-torrents":       true,
		"watch-dir":                  filepath.Join(rootPath, "watch"),
		"watch-dir-enabled":          true,
	})
	if err != nil {
		testingObject.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(configPath, "settings.json"), settingsContent, 0o600); err != nil {
		testingObject.Fatal(err)
	}
	metainfo, hash := backupTestMetainfo(testingObject)
	baseName := hash
	if version == 3 {
		baseName = "backup-file." + hash[:16]
	}
	if err := os.WriteFile(filepath.Join(configPath, "torrents", baseName+".torrent"), metainfo, 0o600); err != nil {
		testingObject.Fatal(err)
	}
	if withResume {
		resume := transmissionSourceTestBencodeDictionary(map[string]string{
			"added-date":               transmissionSourceTestBencodeInteger(1_700_000_000),
			"bandwidth-priority":       transmissionSourceTestBencodeInteger(1),
			"destination":              transmissionSourceTestBencodeString(usedDirectory),
			"done-date":                transmissionSourceTestBencodeInteger(0),
			"idle-limit":               transmissionSourceTestBencodeInteger(30),
			"idle-mode":                transmissionSourceTestBencodeInteger(1),
			"incomplete-dir":           transmissionSourceTestBencodeString(incompleteDirectory),
			"labels":                   "l" + transmissionSourceTestBencodeString("linux") + transmissionSourceTestBencodeString("archive") + "e",
			"max-peers":                transmissionSourceTestBencodeInteger(77),
			"paused":                   transmissionSourceTestBencodeInteger(0),
			"ratio-limit":              transmissionSourceTestBencodeString("2.0"),
			"ratio-mode":               transmissionSourceTestBencodeInteger(1),
			"speed-limit-down":         transmissionSourceTestBencodeInteger(100),
			"speed-limit-down-enabled": transmissionSourceTestBencodeInteger(0),
			"speed-limit-up":           transmissionSourceTestBencodeInteger(500),
			"speed-limit-up-enabled":   transmissionSourceTestBencodeInteger(1),
		})
		if err := os.WriteFile(filepath.Join(configPath, "resume", baseName+".resume"), []byte(resume), 0o600); err != nil {
			testingObject.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(incompleteDirectory, "backup-file"), []byte("partial"), 0o600); err != nil {
			testingObject.Fatal(err)
		}
	}

	return transmissionSourceTestFixture{
		ConfigPath:          configPath,
		DefaultDirectory:    defaultDirectory,
		EmptySibling:        emptySibling,
		Hash:                hash,
		IncompleteDirectory: incompleteDirectory,
		Metainfo:            metainfo,
		UsedDirectory:       usedDirectory,
	}
}

func transmissionSourceTestBencodeDictionary(values map[string]string) string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	var builder strings.Builder
	builder.WriteByte('d')
	for _, key := range keys {
		builder.WriteString(transmissionSourceTestBencodeString(key))
		builder.WriteString(values[key])
	}
	builder.WriteByte('e')

	return builder.String()
}

func transmissionSourceTestBencodeString(value string) string {
	return strconv.Itoa(len(value)) + ":" + value
}

func transmissionSourceTestBencodeInteger(value int64) string {
	return "i" + strconv.FormatInt(value, 10) + "e"
}

func transmissionSourceTreeDigest(testingObject *testing.T, rootPath string) map[string]string {
	testingObject.Helper()
	digest := map[string]string{}
	if err := filepath.WalkDir(rootPath, func(path string, entry os.DirEntry, walkError error) error {
		if walkError != nil {
			return walkError
		}
		relativePath, err := filepath.Rel(rootPath, path)
		if err != nil {
			return err
		}
		if entry.IsDir() {
			digest[relativePath] = "directory"

			return nil
		}
		content, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		sum := sha256.Sum256(content)
		digest[relativePath] = hex.EncodeToString(sum[:])

		return nil
	}); err != nil {
		testingObject.Fatal(err)
	}

	return digest
}

// TestBackupTorrentDataPresentNeedsTopLevelEntry proves absent data keeps a torrent from starting.
func TestBackupTorrentDataPresentNeedsTopLevelEntry(testingObject *testing.T) {
	server := newUnclaimedTestServer(testingObject, "ABCDE-23456-FGHIJ", false)
	metainfo, hash := backupTestMetainfo(testingObject)
	_, topLevelName, _, err := anotherTransmissionMetainfoDetails(metainfo)
	if err != nil {
		testingObject.Fatal(err)
	}
	folder := testingObject.TempDir()
	torrent := backupTorrent{Hash: hash, Metainfo: base64.StdEncoding.EncodeToString(metainfo)}
	if server.backupTorrentDataPresent(context.Background(), torrent, folder) {
		testingObject.Fatal("an empty folder was treated as holding the torrent's data")
	}
	if err := os.WriteFile(filepath.Join(folder, topLevelName+".part"), []byte("x"), 0o600); err != nil {
		testingObject.Fatal(err)
	}
	if !server.backupTorrentDataPresent(context.Background(), torrent, folder) {
		testingObject.Fatal("a partial file was not treated as the torrent's data")
	}
}

// TestAnotherTransmissionSiblingsNeedTheOldFoldersHere proves siblings come from the old layout only.
//
// When the old download folders are not mounted here at the same path, nothing beside them is
// offered, even if this container has folders at those paths' parents.
func TestAnotherTransmissionSiblingsNeedTheOldFoldersHere(testingObject *testing.T) {
	fixture := newTransmissionSourceTestFixture(testingObject, 4, true)
	for _, path := range []string{fixture.DefaultDirectory, fixture.UsedDirectory} {
		if err := os.RemoveAll(path); err != nil {
			testingObject.Fatal(err)
		}
	}
	server := newUnclaimedTestServer(testingObject, "ABCDE-23456-FGHIJ", false)
	inspection, err := server.inspectAnotherTransmission(context.Background(), fixture.ConfigPath)
	if err != nil {
		testingObject.Fatalf("inspect source: %v", err)
	}
	for _, folder := range inspection.Folders {
		if folder.Empty {
			testingObject.Fatalf("sibling %s was offered although the old folders are not here", folder.Path)
		}
	}
}

// TestAnotherTransmissionProfileNameFollowsFolderOwner proves a mapped folder keeps its profile.
func TestAnotherTransmissionProfileNameFollowsFolderOwner(testingObject *testing.T) {
	owned := map[string]string{
		"/data/downloads/films": "Films",
		"/data/downloads":       "",
	}
	usedNames := map[string]int{}
	if name := anotherTransmissionProfileName("/old/movies", "/data/downloads/Films/", owned, usedNames); name != "Films" {
		testingObject.Fatalf("owned folder name = %q, want Films", name)
	}
	if name := anotherTransmissionProfileName("/old/linux-isos", "/data/downloads", owned, usedNames); name != "Linux isos" {
		testingObject.Fatalf("default folder name = %q, want the folder's own name", name)
	}
	if name := anotherTransmissionProfileName("/other/linux-isos", "", owned, usedNames); name != "Linux isos 2" {
		testingObject.Fatalf("repeated name = %q, want a numbered name", name)
	}
}

// TestAnotherTransmissionFolderConflictsBlockNesting covers every nesting the import refuses.
func TestAnotherTransmissionFolderConflictsBlockNesting(testingObject *testing.T) {
	inspection := anotherTransmissionInspection{Folders: []anotherTransmissionFolder{
		{Path: "/old/default", Kind: "default"},
		{Path: "/old/films", Kind: "download"},
		{Path: "/old/shows", Kind: "download"},
		{Path: "/old/incomplete", Kind: "incomplete"},
	}}
	existing := []storage.TorrentProfile{{Name: "Music", DownloadDirectory: "/data/media/music"}}
	check := func(mappings map[string]string) map[string]string {
		return anotherTransmissionFolderConflicts(inspection, mappings, nil, existing)
	}

	sideBySide := check(map[string]string{
		"/old/default":    "/data/downloads",
		"/old/films":      "/data/films",
		"/old/shows":      "/data/media/shows",
		"/old/incomplete": "/data/incomplete",
	})
	if len(sideBySide) != 0 {
		testingObject.Fatalf("folders side by side were refused: %v", sideBySide)
	}
	insideDefault := check(map[string]string{
		"/old/default": "/data/downloads",
		"/old/films":   "/data/downloads/films",
		"/old/shows":   "/data/shows",
	})
	if insideDefault["/old/films"] == "" || insideDefault["/old/default"] == "" {
		testingObject.Fatalf("a named folder inside the Default folder was allowed: %v", insideDefault)
	}
	named := check(map[string]string{
		"/old/default": "/data/downloads",
		"/old/films":   "/data/media/films",
		"/old/shows":   "/data/media/films/shows",
	})
	if named["/old/films"] == "" || named["/old/shows"] == "" {
		testingObject.Fatalf("nested named folders were allowed: %v", named)
	}
	aroundDefault := check(map[string]string{
		"/old/default": "/data/downloads/main",
		"/old/films":   "/data/downloads",
		"/old/shows":   "/data/shows",
	})
	if aroundDefault["/old/films"] == "" {
		testingObject.Fatalf("a named folder around the Default folder was allowed: %v", aroundDefault)
	}
	existingProfile := check(map[string]string{
		"/old/default": "/data/downloads",
		"/old/films":   "/data/media/music/films",
		"/old/shows":   "/data/other",
	})
	for key, value := range check(map[string]string{
		"/old/default": "/data/downloads",
		"/old/films":   "/data/films",
		"/old/shows":   "/data/media",
	}) {
		existingProfile[key] = value
	}
	if !strings.Contains(existingProfile["/old/films"], "inside the Music") ||
		!strings.Contains(existingProfile["/old/shows"], "contains the Music") {
		testingObject.Fatalf("nesting with an existing profile was allowed: %v", existingProfile)
	}
	defaultInsideNamed := check(map[string]string{
		"/old/default": "/data/media/music/main",
		"/old/films":   "/data/films",
		"/old/shows":   "/data/shows",
	})
	if !strings.Contains(defaultInsideNamed["/old/default"], "inside the Music") {
		testingObject.Fatalf("the Default folder inside a named profile was allowed: %v", defaultInsideNamed)
	}
}

// TestBackupExportFolderConflictsForceOwnFolders covers exports saved before the one-folder rule.
func TestBackupExportFolderConflictsForceOwnFolders(testingObject *testing.T) {
	section := backupSettingsAndProfilesSection{
		DefaultProfile: backupDefaultProfile{Name: "Default profile", DownloadDirectory: "/data/downloads"},
		Profiles: []storage.TorrentProfile{
			{ID: "tpr-0000000000000a01", Name: "Movies", DownloadDirectory: "/data/downloads/movies"},
			{ID: "tpr-0000000000000a02", Name: "Shows", DownloadDirectory: "/data/shows"},
		},
	}
	existing := []storage.TorrentProfile{{ID: "tpr-0000000000000b01", Name: "Music", DownloadDirectory: "/data/shows/music"}}

	nested := backupExportFolderConflicts(section, nil, nil, existing)
	if !strings.Contains(nested["/data/downloads/movies"], "inside the Default profile") ||
		!strings.Contains(nested["/data/downloads"], "contains the Movies profile") ||
		!strings.Contains(nested["/data/shows"], "contains the Music profile") {
		testingObject.Fatalf("nested export folders were allowed: %v", nested)
	}

	remapped := backupExportFolderConflicts(section, map[string]string{
		"/data/downloads/movies": "/data/movies",
		"/data/shows":            "/data/series",
	}, nil, existing)
	if len(remapped) != 0 {
		testingObject.Fatalf("folders mapped side by side were refused: %v", remapped)
	}

	replacing := backupExportFolderConflicts(section, map[string]string{"/data/downloads/movies": "/data/movies"}, nil, []storage.TorrentProfile{
		{ID: "tpr-0000000000000b02", Name: "Shows", DownloadDirectory: "/data/shows/old"},
	})
	if len(replacing) != 0 {
		testingObject.Fatalf("a profile replaced by name still counted its old folder: %v", replacing)
	}
	keeping := backupExportFolderConflicts(section, map[string]string{"/data/downloads/movies": "/data/movies"}, map[string]string{"tpr-0000000000000a02": "keep"}, []storage.TorrentProfile{
		{ID: "tpr-0000000000000b02", Name: "Shows", DownloadDirectory: "/data/downloads/shows"},
	})
	if !strings.Contains(keeping["/data/downloads"], "contains the Shows profile") {
		testingObject.Fatalf("a kept profile's folder was ignored: %v", keeping)
	}
}
