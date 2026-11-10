package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/directorybrowser"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

// folderPickerTestBrowser provides mutable directory snapshots to API tests.
//
// It embeds the shared create and metainfo behavior while recording every requested
// list, inspect, and delete operation against its deterministic in-memory entries.
//
// Since: 2.0.0
type folderPickerTestBrowser struct {
	testDirectoryBrowser
	directories map[string]directorybrowser.Directory
	listed      []string
	inspected   []string
	deleted     []string
	deleteError error
}

// List returns one configured directory snapshot and records the path.
//
// Delete tests assert this broader operation is never used for a one-folder
// preflight after the inspect action becomes available.
//
// Since: 2.0.0
func (browser *folderPickerTestBrowser) List(
	_ context.Context,
	path string,
) (directorybrowser.Directory, error) {
	browser.listed = append(browser.listed, path)
	directory, found := browser.directories[path]
	if !found {
		return directorybrowser.Directory{}, &directorybrowser.OperationError{
			Code:    directorybrowser.ErrorCodeNotFound,
			Message: "That folder no longer exists.",
		}
	}
	directory.Directories = append([]directorybrowser.DirectoryEntry{}, directory.Directories...)

	return directory, nil
}

// Inspect returns one configured child without listing its siblings.
//
// The fake records the exact target so handler tests can distinguish the narrow
// controller action from a parent listing or target re-list.
//
// Since: 2.0.0
func (browser *folderPickerTestBrowser) Inspect(
	_ context.Context,
	path string,
) (directorybrowser.DirectoryEntry, error) {
	browser.inspected = append(browser.inspected, path)
	parent, found := browser.directories[filepath.Dir(path)]
	if found {
		for _, entry := range parent.Directories {
			if entry.Path == path {
				return entry, nil
			}
		}
	}

	return directorybrowser.DirectoryEntry{}, &directorybrowser.OperationError{
		Code:    directorybrowser.ErrorCodeNotFound,
		Message: "That folder no longer exists.",
	}
}

// Delete records and applies one configured folder removal.
//
// A configured controller error leaves every in-memory entry intact so response
// mapping tests can exercise races after a successful inspect.
//
// Since: 2.0.0
func (browser *folderPickerTestBrowser) Delete(_ context.Context, path string) error {
	browser.deleted = append(browser.deleted, path)
	if browser.deleteError != nil {
		return browser.deleteError
	}

	parentPath := filepath.Dir(path)
	parent := browser.directories[parentPath]
	directories := make([]directorybrowser.DirectoryEntry, 0, len(parent.Directories))
	for _, entry := range parent.Directories {
		if entry.Path != path {
			directories = append(directories, entry)
		}
	}
	parent.Directories = directories
	browser.directories[parentPath] = parent
	delete(browser.directories, path)

	return nil
}

// TestStorageDirectoryDownloadSelectionDecoratesEveryListing checks browser policy.
//
// Reserved folders remain browsable, but the API tells the console exactly when
// the current folder cannot be selected as a completed-download destination.
//
// Since: 2.0.0
func TestStorageDirectoryDownloadSelectionDecoratesEveryListing(testingObject *testing.T) {
	server, cookies, _ := newClaimedTestServer(testingObject)
	testCases := []struct {
		path    string
		allowed bool
		reason  string
	}{
		{
			path:    "/data",
			allowed: false,
			reason:  "Open or create a folder inside /data. Torrents can't be saved in /data itself.",
		},
		{
			path:    "/data/incomplete",
			allowed: false,
			reason:  "This is in the incomplete folder, /data/incomplete, which only holds unfinished downloads. Pick a folder outside it.",
		},
		{
			path:    "/data/incomplete/child",
			allowed: false,
			reason:  "This is in the incomplete folder, /data/incomplete, which only holds unfinished downloads. Pick a folder outside it.",
		},
		{
			path:    "/data/incomplete-old",
			allowed: true,
		},
	}

	for _, testCase := range testCases {
		testingObject.Run(testCase.path, func(testingObject *testing.T) {
			response := performRequest(
				testingObject,
				server,
				http.MethodGet,
				"/api/v1/storage/directories?path="+url.QueryEscape(testCase.path),
				"",
				cookies,
				"",
			)
			if response.Code != http.StatusOK {
				testingObject.Fatalf("status = %d: %s", response.Code, response.Body.String())
			}

			var directory storageDirectoryResponse
			decodeBody(testingObject, response, &directory)
			if directory.Path != testCase.path ||
				directory.DownloadAllowed != testCase.allowed ||
				directory.DownloadUnavailableReason != testCase.reason {
				testingObject.Fatalf("directory = %+v", directory)
			}
		})
	}
}

// TestStorageDirectoryDeleteRulesUseContractPriority covers every advisory rule.
//
// Each case also satisfies every lower-priority rule so a precedence regression
// changes the exact message and fails at the first incorrect branch.
//
// Since: 2.0.0
func TestStorageDirectoryDeleteRulesUseContractPriority(testingObject *testing.T) {
	baseEntry := directorybrowser.DirectoryEntry{
		Name:       "folder",
		MountPoint: true,
		Readable:   false,
		Empty:      false,
		Checked:    true,
	}
	torrentLocationsUnavailableRules := deletionRulesForPath(
		"/data/torrent-unavailable",
		false,
		false,
	)
	torrentLocationsUnavailableRules.torrentLocationsAvailable = false
	testCases := []struct {
		name       string
		entry      directorybrowser.DirectoryEntry
		rules      storageDirectoryRules
		wantState  storageDirectoryDeleteState
		wantReason string
	}{
		{
			name:       "inside incomplete precedes every assignment",
			entry:      withDirectoryEntryPath(baseEntry, "/data/incomplete/child"),
			rules:      deletionRulesForPath("/data/incomplete/child", true, true),
			wantState:  storageDirectoryDeleteInUse,
			wantReason: "Folders inside the incomplete folder belong to Transmission, so they can't be deleted here.",
		},
		{
			name:       "incomplete precedes profile",
			entry:      withDirectoryEntryPath(baseEntry, "/data/incomplete"),
			rules:      deletionRulesForPath("/data/incomplete", true, true),
			wantState:  storageDirectoryDeleteInUse,
			wantReason: "“folder” is the Incomplete folder in Settings, so it can't be deleted.",
		},
		{
			name:       "profile precedes Download setting",
			entry:      withDirectoryEntryPath(baseEntry, "/data/profile"),
			rules:      deletionRulesForPath("/data/profile", true, true),
			wantState:  storageDirectoryDeleteInUse,
			wantReason: "“folder” is the First profile's folder, so it can't be deleted.",
		},
		{
			name:       "Download setting precedes torrent location",
			entry:      withDirectoryEntryPath(baseEntry, "/data/downloads"),
			rules:      deletionRulesForPath("/data/downloads", false, true),
			wantState:  storageDirectoryDeleteInUse,
			wantReason: "“folder” is the Default profile's folder, so it can't be deleted.",
		},
		{
			name:       "unavailable torrent locations precede torrent",
			entry:      withDirectoryEntryPath(baseEntry, "/data/torrent-unavailable"),
			rules:      torrentLocationsUnavailableRules,
			wantState:  storageDirectoryDeleteTorrentLocationsUnavailable,
			wantReason: torrentLocationsUnavailableMessage,
		},
		{
			name:       "torrent precedes mount",
			entry:      withDirectoryEntryPath(baseEntry, "/data/torrent"),
			rules:      deletionRulesForPath("/data/torrent", false, false),
			wantState:  storageDirectoryDeleteInUse,
			wantReason: "A torrent is saved in “folder”, so it can't be deleted.",
		},
		{
			name: "unchecked precedes mount",
			entry: withDirectoryEntryPath(directorybrowser.DirectoryEntry{
				Name: "folder", Empty: false, HasSubfolders: true, Checked: false,
			}, "/data/unchecked"),
			rules:      deletionRulesForPath("/data/other", false, false),
			wantState:  storageDirectoryDeleteInUse,
			wantReason: "“folder” couldn't be checked in time, so it can't be deleted right now. Try again in a moment.",
		},
		{
			name:       "mount precedes unreadable",
			entry:      withDirectoryEntryPath(baseEntry, "/data/mount"),
			rules:      deletionRulesForPath("/data/other", false, false),
			wantState:  storageDirectoryDeleteInUse,
			wantReason: "“folder” is a separate mount, so it can't be deleted.",
		},
		{
			name: "unreadable precedes not empty",
			entry: withDirectoryEntryPath(directorybrowser.DirectoryEntry{
				Name: "folder", Readable: false, Empty: false, Checked: true,
			}, "/data/private"),
			rules:      deletionRulesForPath("/data/other", false, false),
			wantState:  storageDirectoryDeleteInUse,
			wantReason: "Transmission's account can't open “folder”, so it can't be deleted here.",
		},
		{
			name: "not empty",
			entry: withDirectoryEntryPath(directorybrowser.DirectoryEntry{
				Name: "folder", Readable: true, Empty: false, Checked: true,
			}, "/data/not-empty"),
			rules:      deletionRulesForPath("/data/other", false, false),
			wantState:  storageDirectoryDeleteNotEmpty,
			wantReason: "Only empty folders can be deleted here. Remove what's inside “folder” from your file system first.",
		},
		{
			name: "empty and unassigned",
			entry: withDirectoryEntryPath(directorybrowser.DirectoryEntry{
				Name: "folder", Readable: true, Empty: true, Checked: true,
			}, "/data/free"),
			rules:     deletionRulesForPath("/data/other", false, false),
			wantState: storageDirectoryDeleteAllowed,
		},
	}

	for _, testCase := range testCases {
		testingObject.Run(testCase.name, func(testingObject *testing.T) {
			state, reason := testCase.rules.deleteAvailability(testCase.entry)
			if state != testCase.wantState || reason != testCase.wantReason {
				testingObject.Fatalf("deleteAvailability() = %d, %q, want %d, %q", state, reason, testCase.wantState, testCase.wantReason)
			}
		})
	}
}

// TestStorageDirectoryPurposesControlSelectionAndUse covers both picker modes.
//
// The incomplete folder is hidden from browsing in either mode, selectable and usable
// only for incomplete selection, and completed-download destinations clash there.
//
// Since: 2.0.0
func TestStorageDirectoryPurposesControlSelectionAndUse(testingObject *testing.T) {
	rules := storageDirectoryRules{
		downloadPolicy: downloadPathPolicy{
			downloadDirectory:   "/data/downloads",
			incompleteDirectory: "/data/incomplete",
		},
		defaultProfileName: "Default profile",
		downloadPathsForIncomplete: []settings.IncompleteDirectoryDestination{
			{Path: "/data/downloads", ProfileName: "Default profile"},
			{Path: "/data/profile", ProfileName: "Profile profile"},
			{Path: "/data/saved", ProfileName: "Saved profile"},
		},
		torrentDirectories:        map[string]struct{}{},
		torrentLocationsAvailable: true,
	}
	directory := directorybrowser.Directory{
		Path: "/data",
		Directories: []directorybrowser.DirectoryEntry{
			{Name: "downloads", Path: "/data/downloads", Empty: true, Readable: true, Checked: true},
			{Name: "incomplete", Path: "/data/incomplete", Empty: true, Readable: true, Checked: true},
			{Name: "free", Path: "/data/free", Empty: true, Readable: true, Checked: true},
		},
	}

	download := decorateStorageDirectory(directory, storageDirectoryPurposeDownload, rules)
	incompleteDownloadEntry := findDecoratedDirectoryEntry(testingObject, download, "/data/incomplete")
	if !incompleteDownloadEntry.Browsable || incompleteDownloadEntry.Selectable ||
		incompleteDownloadEntry.Usable || incompleteDownloadEntry.UnusableReason == "" {
		testingObject.Fatalf("download-purpose incomplete entry = %+v", incompleteDownloadEntry)
	}
	downloadFreeEntry := findDecoratedDirectoryEntry(testingObject, download, "/data/free")
	if !downloadFreeEntry.Browsable || !downloadFreeEntry.Selectable ||
		!downloadFreeEntry.Usable || downloadFreeEntry.UnusableReason != "" {
		testingObject.Fatalf("download-purpose free entry = %+v", downloadFreeEntry)
	}

	incomplete := decorateStorageDirectory(directory, storageDirectoryPurposeIncomplete, rules)
	incompleteEntry := findDecoratedDirectoryEntry(testingObject, incomplete, "/data/incomplete")
	if !incompleteEntry.Browsable || !incompleteEntry.Selectable || !incompleteEntry.Usable ||
		incompleteEntry.UnusableReason != "" {
		testingObject.Fatalf("incomplete-purpose current folder = %+v", incompleteEntry)
	}
	downloadEntry := findDecoratedDirectoryEntry(testingObject, incomplete, "/data/downloads")
	wantClash := settings.IncompleteDirectoryClashMessage("/data/downloads", settings.IncompleteDirectoryDestination{
		Path: "/data/downloads", ProfileName: "Default profile",
	})
	if !downloadEntry.Browsable || downloadEntry.Selectable || downloadEntry.Usable ||
		downloadEntry.UnusableReason != wantClash {
		testingObject.Fatalf("incomplete-purpose download entry = %+v, want clash %q", downloadEntry, wantClash)
	}
	freeEntry := findDecoratedDirectoryEntry(testingObject, incomplete, "/data/free")
	if !freeEntry.Browsable || !freeEntry.Selectable || !freeEntry.Usable {
		testingObject.Fatalf("incomplete-purpose free entry = %+v", freeEntry)
	}
}

// TestStorageDirectoryProfilePurposeNamesOtherFolderOwners keeps them browsable.
func TestStorageDirectoryProfilePurposeNamesOtherFolderOwners(testingObject *testing.T) {
	rules := storageDirectoryRules{
		downloadPolicy: downloadPathPolicy{
			downloadDirectory:   "/data/Downloads",
			incompleteDirectory: "/data/incomplete",
		},
		profiles: []storage.TorrentProfile{{
			ID:                "tpr-0000000000000001",
			Name:              "Movies",
			DownloadDirectory: "/data/Movies",
		}},
		selectedProfileID:         "new",
		torrentDirectories:        map[string]struct{}{},
		torrentLocationsAvailable: true,
	}
	directory := directorybrowser.Directory{
		Path: "/data",
		Directories: []directorybrowser.DirectoryEntry{
			{Name: "downloads", Path: "/data/downloads", Checked: true, Readable: true},
			{Name: "movies", Path: "/data/movies", Checked: true, Readable: true},
			{Name: "free", Path: "/data/free", Checked: true, Readable: true},
		},
	}

	decorated := decorateStorageDirectory(directory, storageDirectoryPurposeProfile, rules)
	for path, reason := range map[string]string{
		"/data/downloads": "“downloads” is already the Default profile's folder.",
		"/data/movies":    "“movies” is already the Movies profile's folder.",
	} {
		entry := findDecoratedDirectoryEntry(testingObject, decorated, path)
		if !entry.Browsable || entry.Selectable || entry.Usable ||
			entry.UnusableReason != reason {
			testingObject.Fatalf("profile-purpose entry %s = %+v", path, entry)
		}
	}
	free := findDecoratedDirectoryEntry(testingObject, decorated, "/data/free")
	if !free.Browsable || !free.Selectable || !free.Usable {
		testingObject.Fatalf("free profile-purpose entry = %+v", free)
	}

	rules.selectedProfileID = "tpr-0000000000000001"
	decorated = decorateStorageDirectory(directory, storageDirectoryPurposeProfile, rules)
	if own := findDecoratedDirectoryEntry(testingObject, decorated, "/data/movies"); !own.Usable {
		testingObject.Fatalf("profile's own folder = %+v", own)
	}
	rules.selectedProfileID = "default"
	decorated = decorateStorageDirectory(directory, storageDirectoryPurposeProfile, rules)
	if own := findDecoratedDirectoryEntry(testingObject, decorated, "/data/downloads"); !own.Usable {
		testingObject.Fatalf("Default profile's own folder = %+v", own)
	}
}

// TestStorageDirectoryProfilePurposeRequiresAProfile identifies the picker owner.
func TestStorageDirectoryProfilePurposeRequiresAProfile(testingObject *testing.T) {
	server, cookies, _ := newClaimedTestServer(testingObject)
	server.directoryBrowser = newFolderPickerTestBrowser()
	response := performRequest(
		testingObject,
		server,
		http.MethodGet,
		"/api/v1/storage/directories?path=%2Fdata&purpose=profile",
		"",
		cookies,
		"",
	)
	if response.Code != http.StatusUnprocessableEntity ||
		!strings.Contains(response.Body.String(), `"field":"profileId"`) {
		testingObject.Fatalf("missing profileId = %d: %s", response.Code, response.Body.String())
	}
}

// TestStorageDirectoryTagsKeepContractOrder checks every assignment label.
//
// Incomplete leads the setting-backed Default profile and exact named-profile matches,
// while an untagged entry keeps an empty array.
//
// Since: 2.0.0
func TestStorageDirectoryTagsKeepContractOrder(testingObject *testing.T) {
	rules := storageDirectoryRules{
		downloadPolicy: downloadPathPolicy{
			downloadDirectory:   "/data/shared",
			incompleteDirectory: "/data/shared",
		},
		profiles: []storage.TorrentProfile{
			{Name: "First", DownloadDirectory: "/data/shared"},
			{Name: "Second", DownloadDirectory: "/data/shared"},
		},
	}
	want := []string{"Incomplete folder", "Default profile", "First profile", "Second profile"}
	if got := rules.tags("/data/shared"); !reflect.DeepEqual(got, want) {
		testingObject.Fatalf("tags = %#v, want %#v", got, want)
	}
	if got := rules.tags("/data/untagged"); got == nil || len(got) != 0 {
		testingObject.Fatalf("untagged tags = %#v, want empty array", got)
	}
	if got := rules.tags("/data/Shared"); got == nil || len(got) != 0 {
		testingObject.Fatalf("case-variant tags = %#v, want exact-match empty array", got)
	}
	usable, reason := rules.usableForPurpose("/data/Shared", storageDirectoryPurposeDownload)
	if !usable || reason != "" {
		testingObject.Fatalf("case-variant usable = %t, %q, want exact-match true", usable, reason)
	}
}

// TestStorageDirectoryDeleteProtectionIgnoresAssignedPathCase covers rules one to seven.
//
// Assigned paths protect case variants on case-insensitive storage, while profile
// order and each rule's existing message remain unchanged.
//
// Since: 2.0.0
func TestStorageDirectoryDeleteProtectionIgnoresAssignedPathCase(testingObject *testing.T) {
	testCases := []struct {
		name       string
		entry      directorybrowser.DirectoryEntry
		rules      storageDirectoryRules
		wantReason string
	}{
		{
			name: "inside incomplete folder",
			entry: directorybrowser.DirectoryEntry{
				Name: "child", Path: "/data/incomplete/child", Checked: true,
			},
			rules: storageDirectoryRules{
				downloadPolicy:            downloadPathPolicy{incompleteDirectory: "/data/INCOMPLETE"},
				torrentDirectories:        map[string]struct{}{},
				torrentLocationsAvailable: true,
			},
			wantReason: "Folders inside the incomplete folder belong to Transmission, so they can't be deleted here.",
		},
		{
			name: "incomplete folder",
			entry: directorybrowser.DirectoryEntry{
				Name: "incomplete", Path: "/data/incomplete", Checked: true,
			},
			rules: storageDirectoryRules{
				downloadPolicy:            downloadPathPolicy{incompleteDirectory: "/data/INCOMPLETE"},
				torrentDirectories:        map[string]struct{}{},
				torrentLocationsAvailable: true,
			},
			wantReason: "“incomplete” is the Incomplete folder in Settings, so it can't be deleted.",
		},
		{
			name: "profile folder",
			entry: directorybrowser.DirectoryEntry{
				Name: "movies", Path: "/data/movies", Checked: true,
			},
			rules: storageDirectoryRules{
				downloadPolicy: downloadPathPolicy{incompleteDirectory: "/data/incomplete"},
				profiles: []storage.TorrentProfile{
					{Name: "Movies", DownloadDirectory: "/data/Movies"},
				},
				torrentDirectories:        map[string]struct{}{},
				torrentLocationsAvailable: true,
			},
			wantReason: "“movies” is the Movies profile's folder, so it can't be deleted.",
		},
		{
			name: "Download directory",
			entry: directorybrowser.DirectoryEntry{
				Name: "downloads", Path: "/data/downloads", Checked: true,
			},
			rules: storageDirectoryRules{
				downloadPolicy: downloadPathPolicy{
					downloadDirectory:   "/data/Downloads",
					incompleteDirectory: "/data/incomplete",
				},
				torrentDirectories:        map[string]struct{}{},
				torrentLocationsAvailable: true,
			},
			wantReason: "“downloads” is the Default profile's folder, so it can't be deleted.",
		},
		{
			name: "torrent folder",
			entry: directorybrowser.DirectoryEntry{
				Name: "iso", Path: "/data/iso", Checked: true,
			},
			rules: storageDirectoryRules{
				downloadPolicy:            downloadPathPolicy{incompleteDirectory: "/data/incomplete"},
				torrentDirectories:        map[string]struct{}{strings.ToLower("/data/ISO"): {}},
				torrentLocationsAvailable: true,
			},
			wantReason: "A torrent is saved in “iso”, so it can't be deleted.",
		},
	}

	for _, testCase := range testCases {
		testingObject.Run(testCase.name, func(testingObject *testing.T) {
			state, reason := testCase.rules.deleteAvailability(testCase.entry)
			if state != storageDirectoryDeleteInUse || reason != testCase.wantReason {
				testingObject.Fatalf(
					"deleteAvailability() = %d, %q, want in-use and %q",
					state,
					reason,
					testCase.wantReason,
				)
			}
		})
	}
}

// TestDeleteStorageDirectoryUsesInspectAndReturnsNoContent covers mutation behavior.
//
// A successful delete inspects only its target, never lists either sibling, and
// returns the empty 204 response that lets the console refresh the parent itself.
//
// Since: 2.0.0
func TestDeleteStorageDirectoryUsesInspectAndReturnsNoContent(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)
	browser := newFolderPickerTestBrowser(
		directorybrowser.DirectoryEntry{Name: "remove", Path: "/data/remove", Empty: true, Readable: true},
		directorybrowser.DirectoryEntry{Name: "survivor", Path: "/data/survivor", Empty: true, Readable: true},
	)
	server.directoryBrowser = browser

	response := performRequest(
		testingObject,
		server,
		http.MethodDelete,
		"/api/v1/storage/directories?path=%2Fdata%2Fremove",
		"",
		cookies,
		csrfToken,
	)
	if response.Code != http.StatusNoContent || response.Body.Len() != 0 {
		testingObject.Fatalf("delete status = %d: %s", response.Code, response.Body.String())
	}
	if len(browser.listed) != 0 {
		testingObject.Fatalf("DELETE listed sibling directories: %#v", browser.listed)
	}
	if !reflect.DeepEqual(browser.inspected, []string{"/data/remove"}) {
		testingObject.Fatalf("inspected paths = %#v", browser.inspected)
	}
	if len(browser.deleted) != 1 || browser.deleted[0] != "/data/remove" {
		testingObject.Fatalf("deleted paths = %#v", browser.deleted)
	}

	browser = newFolderPickerTestBrowser(
		directorybrowser.DirectoryEntry{Name: "downloads", Path: "/data/downloads", Empty: true, Readable: true},
	)
	server.directoryBrowser = browser
	assigned := performRequest(
		testingObject,
		server,
		http.MethodDelete,
		"/api/v1/storage/directories?path=%2Fdata%2Fdownloads",
		"",
		cookies,
		csrfToken,
	)
	if assigned.Code != http.StatusConflict ||
		!strings.Contains(assigned.Body.String(), `"code":"directory_in_use"`) ||
		!strings.Contains(assigned.Body.String(), "Default profile's folder") ||
		len(browser.deleted) != 0 || len(browser.listed) != 0 ||
		!reflect.DeepEqual(browser.inspected, []string{"/data/downloads"}) {
		testingObject.Fatalf("assigned delete = %d %s, calls %#v", assigned.Code, assigned.Body.String(), browser.deleted)
	}
}

// TestDeleteStorageDirectoryRejectsNonemptyAndRequiresCSRF covers two hard gates.
//
// Nonempty metadata maps to the dedicated conflict before the controller mutation,
// and browser sessions cannot reach that check without their CSRF token.
//
// Since: 2.0.0
func TestDeleteStorageDirectoryRejectsNonemptyAndRequiresCSRF(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)
	browser := newFolderPickerTestBrowser(
		directorybrowser.DirectoryEntry{Name: "films", Path: "/data/films", Empty: false, Readable: true},
	)
	server.directoryBrowser = browser

	withoutCSRF := performRequest(
		testingObject,
		server,
		http.MethodDelete,
		"/api/v1/storage/directories?path=%2Fdata%2Ffilms",
		"",
		cookies,
		"",
	)
	if withoutCSRF.Code != http.StatusForbidden ||
		!strings.Contains(withoutCSRF.Body.String(), `"code":"csrf_invalid"`) {
		testingObject.Fatalf("DELETE without CSRF = %d: %s", withoutCSRF.Code, withoutCSRF.Body.String())
	}

	nonempty := performRequest(
		testingObject,
		server,
		http.MethodDelete,
		"/api/v1/storage/directories?path=%2Fdata%2Ffilms",
		"",
		cookies,
		csrfToken,
	)
	if nonempty.Code != http.StatusConflict ||
		!strings.Contains(nonempty.Body.String(), `"code":"directory_not_empty"`) ||
		!strings.Contains(nonempty.Body.String(), "Remove what's inside") ||
		len(browser.deleted) != 0 {
		testingObject.Fatalf("nonempty delete = %d %s, calls %#v", nonempty.Code, nonempty.Body.String(), browser.deleted)
	}
}

// TestDeleteStorageDirectoryReportsUnavailableTorrentLocations checks rule six.
//
// An incomplete cross-daemon torrent snapshot fails closed with the contract's
// retryable 503 response before the controller receives a delete request.
//
// Since: 2.0.0
func TestDeleteStorageDirectoryReportsUnavailableTorrentLocations(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)
	_, client := newFakeTransmissionDaemon(testingObject, func(recordedTransmissionCall) any {
		return fakeTransmissionResponse{Status: http.StatusServiceUnavailable}
	})
	server.transmission = client
	server.transmissionClients = nil
	browser := newFolderPickerTestBrowser(
		directorybrowser.DirectoryEntry{
			Name: "free", Path: "/data/free", Empty: true, Readable: true,
		},
	)
	server.directoryBrowser = browser

	response := performRequest(
		testingObject,
		server,
		http.MethodDelete,
		"/api/v1/storage/directories?path=%2Fdata%2Ffree",
		"",
		cookies,
		csrfToken,
	)
	if response.Code != http.StatusServiceUnavailable ||
		!strings.Contains(response.Body.String(), `"code":"torrent_locations_unavailable"`) ||
		!strings.Contains(response.Body.String(), torrentLocationsUnavailableMessage) ||
		len(browser.deleted) != 0 {
		testingObject.Fatalf(
			"unavailable torrent locations = %d %s, deletes %#v",
			response.Code,
			response.Body.String(),
			browser.deleted,
		)
	}
}

// TestDeleteStorageDirectoryMapsReadOnlyControllerError checks EROFS handling.
//
// The fake controller returns the stable read_only code after a successful inspect,
// and the API supplies the folder-specific permission message required by DELETE.
//
// Since: 2.0.0
func TestDeleteStorageDirectoryMapsReadOnlyControllerError(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)
	browser := newFolderPickerTestBrowser(
		directorybrowser.DirectoryEntry{
			Name: "media", Path: "/data/media", Empty: true, Readable: true,
		},
	)
	browser.deleteError = &directorybrowser.OperationError{
		Code:    directorybrowser.ErrorCodeReadOnly,
		Message: "controller read-only rejection",
	}
	server.directoryBrowser = browser

	response := performRequest(
		testingObject,
		server,
		http.MethodDelete,
		"/api/v1/storage/directories?path=%2Fdata%2Fmedia",
		"",
		cookies,
		csrfToken,
	)
	wantReason := "The storage under /data is read-only, so “media” can't be deleted."
	if response.Code != http.StatusForbidden ||
		!strings.Contains(response.Body.String(), `"code":"directory_permission_denied"`) ||
		!strings.Contains(response.Body.String(), wantReason) ||
		!reflect.DeepEqual(browser.deleted, []string{"/data/media"}) {
		testingObject.Fatalf(
			"read-only delete = %d %s, calls %#v",
			response.Code,
			response.Body.String(),
			browser.deleted,
		)
	}
}

// TestStorageDirectoryPreservesTrailingSpaceNames checks existing odd folders.
//
// GET forwards a trailing-space path unchanged, and DELETE uses the minimal existing
// name validation so the same empty folder remains removable through inspect.
//
// Since: 2.0.0
func TestStorageDirectoryPreservesTrailingSpaceNames(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)
	path := "/data/Season 1 "
	browser := newFolderPickerTestBrowser(
		directorybrowser.DirectoryEntry{
			Name: "Season 1 ", Path: path, Empty: true, Readable: true,
		},
	)
	browser.directories[path] = directorybrowser.Directory{
		Path:        path,
		ParentPath:  "/data",
		Directories: []directorybrowser.DirectoryEntry{},
	}
	server.directoryBrowser = browser

	listing := performRequest(
		testingObject,
		server,
		http.MethodGet,
		"/api/v1/storage/directories?path="+url.QueryEscape(path),
		"",
		cookies,
		"",
	)
	if listing.Code != http.StatusOK {
		testingObject.Fatalf("trailing-space listing = %d: %s", listing.Code, listing.Body.String())
	}
	var directory storageDirectoryResponse
	decodeBody(testingObject, listing, &directory)
	if directory.Path != path {
		testingObject.Fatalf("listed path = %q, want %q", directory.Path, path)
	}

	browser.listed = nil
	deletion := performRequest(
		testingObject,
		server,
		http.MethodDelete,
		"/api/v1/storage/directories?path="+url.QueryEscape(path),
		"",
		cookies,
		csrfToken,
	)
	if deletion.Code != http.StatusNoContent || deletion.Body.Len() != 0 ||
		len(browser.listed) != 0 ||
		!reflect.DeepEqual(browser.inspected, []string{path}) ||
		!reflect.DeepEqual(browser.deleted, []string{path}) {
		testingObject.Fatalf(
			"trailing-space delete = %d %s, listed %#v, inspected %#v, deleted %#v",
			deletion.Code,
			deletion.Body.String(),
			browser.listed,
			browser.inspected,
			browser.deleted,
		)
	}
}

// TestStorageDirectoryDeleteControllerErrorsUsePublicContract covers mutation races.
//
// The controller remains authoritative after the advisory check, so its stable codes
// must retain the DELETE route's public statuses and assignment-aware messages.
//
// Since: 2.0.0
func TestStorageDirectoryDeleteControllerErrorsUsePublicContract(testingObject *testing.T) {
	server, _, _ := newClaimedTestServer(testingObject)
	testCases := []struct {
		name       string
		controller string
		status     int
		public     string
		reason     string
	}{
		{
			name:       "not empty",
			controller: directorybrowser.ErrorCodeNotEmpty,
			status:     http.StatusConflict,
			public:     "directory_not_empty",
			reason:     notEmptyDeleteMessage("media"),
		},
		{
			name:       "busy",
			controller: directorybrowser.ErrorCodeBusy,
			status:     http.StatusConflict,
			public:     "directory_in_use",
			reason:     torrentDirectoryDeleteMessage("media"),
		},
		{
			name:       "read only",
			controller: directorybrowser.ErrorCodeReadOnly,
			status:     http.StatusForbidden,
			public:     "directory_permission_denied",
			reason:     "The storage under /data is read-only, so “media” can't be deleted.",
		},
		{
			name:       "invalid final name",
			controller: directorybrowser.ErrorCodeInvalidName,
			status:     http.StatusUnprocessableEntity,
			public:     "directory_path_invalid",
			reason:     "controller rejection",
		},
		{
			name:       "not a directory",
			controller: directorybrowser.ErrorCodeNotDirectory,
			status:     http.StatusUnprocessableEntity,
			public:     "directory_path_invalid",
			reason:     "controller rejection",
		},
		{
			name:       "not found",
			controller: directorybrowser.ErrorCodeNotFound,
			status:     http.StatusNotFound,
			public:     "directory_not_found",
			reason:     "controller rejection",
		},
		{
			name:       "permission denied",
			controller: directorybrowser.ErrorCodePermissionDenied,
			status:     http.StatusForbidden,
			public:     "directory_permission_denied",
			reason:     "controller rejection",
		},
	}

	for _, testCase := range testCases {
		testingObject.Run(testCase.name, func(testingObject *testing.T) {
			response := httptest.NewRecorder()
			server.writeDirectoryDeleteError(
				response,
				"media",
				&directorybrowser.OperationError{
					Code:    testCase.controller,
					Message: "controller rejection",
				},
			)
			body := response.Body.String()
			if response.Code != testCase.status ||
				!strings.Contains(body, `"code":"`+testCase.public+`"`) ||
				!strings.Contains(body, testCase.reason) {
				testingObject.Fatalf(
					"mapping = %d %s, want %d %s containing %q",
					response.Code,
					body,
					testCase.status,
					testCase.public,
					testCase.reason,
				)
			}
		})
	}
}

// TestStorageDirectoryPurposeValidationReturnsFieldIssues covers both public methods.
//
// Invalid values keep the same field issue across listing and mutation routes.
//
// Since: 2.0.0
func TestStorageDirectoryPurposeValidationReturnsFieldIssues(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)
	for _, method := range []string{http.MethodGet, http.MethodDelete} {
		response := performRequest(
			testingObject,
			server,
			method,
			"/api/v1/storage/directories?path=%2Fdata%2Ffolder&purpose=archive",
			"",
			cookies,
			csrfToken,
		)
		if response.Code != http.StatusUnprocessableEntity ||
			!strings.Contains(response.Body.String(), `"code":"invalid_request"`) ||
			!strings.Contains(response.Body.String(), `"field":"purpose"`) {
			testingObject.Fatalf("%s invalid purpose = %d: %s", method, response.Code, response.Body.String())
		}
	}
}

// TestStorageDirectoryTorrentReadFailureDisablesEveryDelete checks fail-closed RPC.
//
// The API requests only facade-required fields; durable rules one through five keep
// their own reasons while every lower-priority entry fails closed uniformly.
//
// Since: 2.0.0
func TestStorageDirectoryTorrentReadFailureDisablesEveryDelete(testingObject *testing.T) {
	server, cookies, _ := newClaimedTestServer(testingObject)
	if _, err := server.store.CreateTorrentProfile(
		context.Background(),
		storage.TorrentProfile{
			ID:                newTorrentProfileID(),
			Name:              "Review",
			DownloadDirectory: "/data/profile",
			Labels:            []string{},
			Options: storage.TorrentProfileOptions{
				Seeding:   storage.TorrentProfileSeeding{Mode: "never"},
				PeerLimit: 50,
				Queue:     "normal",
			},
			MatchPatterns: []string{},
		},
	); err != nil {
		testingObject.Fatalf("create profile: %v", err)
	}
	fake, client := newFakeTransmissionDaemon(testingObject, func(call recordedTransmissionCall) any {
		return fakeTransmissionResponse{Status: http.StatusServiceUnavailable}
	})
	server.transmission = client
	server.transmissionClients = nil
	server.directoryBrowser = newFolderPickerTestBrowser(
		directorybrowser.DirectoryEntry{
			Name: "incomplete-child", Path: "/data/incomplete/child", Empty: true, Readable: true,
		},
		directorybrowser.DirectoryEntry{
			Name: "incomplete", Path: "/data/incomplete", Empty: true, Readable: true,
		},
		directorybrowser.DirectoryEntry{
			Name: "profile", Path: "/data/profile", Empty: true, Readable: true,
		},
		directorybrowser.DirectoryEntry{
			Name: "downloads", Path: "/data/downloads", Empty: true, Readable: true,
		},
		directorybrowser.DirectoryEntry{
			Name: "saved", Path: "/data/saved", Empty: true, Readable: true,
		},
		directorybrowser.DirectoryEntry{
			Name: "mount", Path: "/data/mount", Empty: true, Readable: true, MountPoint: true,
		},
		directorybrowser.DirectoryEntry{
			Name: "private", Path: "/data/private", Empty: true, Readable: false,
		},
		directorybrowser.DirectoryEntry{
			Name: "not-empty", Path: "/data/not-empty", Empty: false, Readable: true,
		},
		directorybrowser.DirectoryEntry{Name: "free", Path: "/data/free", Empty: true, Readable: true},
	)

	response := performRequest(
		testingObject,
		server,
		http.MethodGet,
		"/api/v1/storage/directories?path=%2Fdata",
		"",
		cookies,
		"",
	)
	if response.Code != http.StatusOK {
		testingObject.Fatalf("failed torrent read listing = %d: %s", response.Code, response.Body.String())
	}
	var directory storageDirectoryResponse
	decodeBody(testingObject, response, &directory)
	wantReasons := map[string]string{
		"/data/incomplete/child": "Folders inside the incomplete folder belong to Transmission, so they can't be deleted here.",
		"/data/incomplete":       "“incomplete” is the Incomplete folder in Settings, so it can't be deleted.",
		"/data/profile":          "“profile” is the Review profile's folder, so it can't be deleted.",
		"/data/downloads":        "“downloads” is the Default profile's folder, so it can't be deleted.",
		"/data/saved":            torrentLocationsUnavailableMessage,
		"/data/mount":            torrentLocationsUnavailableMessage,
		"/data/private":          torrentLocationsUnavailableMessage,
		"/data/not-empty":        torrentLocationsUnavailableMessage,
		"/data/free":             torrentLocationsUnavailableMessage,
	}
	if len(directory.Directories) != len(wantReasons) {
		testingObject.Fatalf("failed torrent read entry = %+v", directory.Directories)
	}
	for path, wantReason := range wantReasons {
		entry := findDecoratedDirectoryEntry(testingObject, directory, path)
		if entry.Deletable || entry.DeleteUnavailableReason != wantReason {
			testingObject.Fatalf(
				"failed torrent read entry %s = %+v, want reason %q",
				path,
				entry,
				wantReason,
			)
		}
	}
	calls := fake.recordedCalls()
	if len(calls) != 1 || calls[0].Method != "torrent-get" ||
		!reflect.DeepEqual(calls[0].Arguments["fields"], []any{"id", "downloadDir"}) {
		testingObject.Fatalf("torrent folder calls = %#v", calls)
	}
}

// TestStorageDirectoryNormalizesLiveTorrentDirectories checks picker matching.
//
// A harmless trailing slash still protects the exact picker folder, while a path
// outside /data is skipped without making every torrent location unavailable.
//
// Since: 2.0.0
func TestStorageDirectoryNormalizesLiveTorrentDirectories(testingObject *testing.T) {
	server, cookies, _ := newClaimedTestServer(testingObject)
	_, client := newFakeTransmissionDaemon(testingObject, func(call recordedTransmissionCall) any {
		return map[string]any{"torrents": []map[string]any{
			{"id": 1, "downloadDir": "/data/ISO/"},
			{"id": 2, "downloadDir": "/outside"},
		}}
	})
	server.transmission = client
	server.transmissionClients = nil
	server.directoryBrowser = newFolderPickerTestBrowser(
		directorybrowser.DirectoryEntry{Name: "iso", Path: "/data/iso", Empty: true, Readable: true},
		directorybrowser.DirectoryEntry{Name: "free", Path: "/data/free", Empty: true, Readable: true},
	)

	response := performRequest(
		testingObject,
		server,
		http.MethodGet,
		"/api/v1/storage/directories?path=%2Fdata",
		"",
		cookies,
		"",
	)
	if response.Code != http.StatusOK {
		testingObject.Fatalf("normalized torrent listing = %d: %s", response.Code, response.Body.String())
	}

	var directory storageDirectoryResponse
	decodeBody(testingObject, response, &directory)
	isoEntry := findDecoratedDirectoryEntry(testingObject, directory, "/data/iso")
	if isoEntry.Deletable ||
		isoEntry.DeleteUnavailableReason != "A torrent is saved in “iso”, so it can't be deleted." {
		testingObject.Fatalf("normalized torrent entry = %+v", isoEntry)
	}
	freeEntry := findDecoratedDirectoryEntry(testingObject, directory, "/data/free")
	if !freeEntry.Deletable || freeEntry.DeleteUnavailableReason != "" {
		testingObject.Fatalf("outside-data torrent entry = %+v", freeEntry)
	}
}

// TestStorageDirectoryReadsTorrentLocationsAcrossEveryInstance checks assignment fan-out.
//
// One request asks each configured daemon once, then the shared result protects torrent
// folders from both instances without issuing another RPC for each listed entry.
//
// Since: 2.0.0
func TestStorageDirectoryReadsTorrentLocationsAcrossEveryInstance(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(recordedTransmissionCall) any {
			return map[string]any{"torrents": []map[string]any{
				{"id": 1, "downloadDir": "/data/first-torrent"},
			}}
		},
		func(recordedTransmissionCall) any {
			return map[string]any{"torrents": []map[string]any{
				{"id": 2, "downloadDir": "/data/second-torrent"},
			}}
		},
	)
	fixture.server.directoryBrowser = newFolderPickerTestBrowser(
		directorybrowser.DirectoryEntry{
			Name: "first-torrent", Path: "/data/first-torrent", Empty: true, Readable: true,
		},
		directorybrowser.DirectoryEntry{
			Name: "second-torrent", Path: "/data/second-torrent", Empty: true, Readable: true,
		},
		directorybrowser.DirectoryEntry{
			Name: "free", Path: "/data/free", Empty: true, Readable: true,
		},
	)

	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodGet,
		"/api/v1/storage/directories?path=%2Fdata",
		"",
		fixture.cookies,
		"",
	)
	if response.Code != http.StatusOK {
		testingObject.Fatalf("torrent locations listing = %d: %s", response.Code, response.Body.String())
	}
	var directory storageDirectoryResponse
	decodeBody(testingObject, response, &directory)
	for _, path := range []string{"/data/first-torrent", "/data/second-torrent"} {
		entry := findDecoratedDirectoryEntry(testingObject, directory, path)
		if entry.Deletable || !strings.Contains(entry.DeleteUnavailableReason, "A torrent is saved") {
			testingObject.Fatalf("torrent entry %s = %+v", path, entry)
		}
	}
	if entry := findDecoratedDirectoryEntry(testingObject, directory, "/data/free"); !entry.Deletable {
		testingObject.Fatalf("unassigned entry = %+v", entry)
	}

	for name, fake := range map[string]*fakeTransmissionDaemon{
		"first":  fixture.firstFake,
		"second": fixture.secondFake,
	} {
		calls := fake.recordedCalls()
		if len(calls) != 1 || calls[0].Method != "torrent-get" ||
			!reflect.DeepEqual(calls[0].Arguments["fields"], []any{"id", "downloadDir"}) {
			testingObject.Fatalf("%s daemon calls = %#v", name, calls)
		}
	}
}

// newFolderPickerTestBrowser creates checked root entries for API tests.
//
// Controller listings mark ordinary inspected entries checked; tests that exercise
// the explicit time-budget state construct an unchecked entry directly instead.
//
// Since: 2.0.0
func newFolderPickerTestBrowser(
	entries ...directorybrowser.DirectoryEntry,
) *folderPickerTestBrowser {
	checkedEntries := make([]directorybrowser.DirectoryEntry, 0, len(entries))
	for _, entry := range entries {
		entry.Checked = true
		checkedEntries = append(checkedEntries, entry)
	}

	return &folderPickerTestBrowser{
		directories: map[string]directorybrowser.Directory{
			"/data": {
				Path:        "/data",
				Directories: checkedEntries,
			},
		},
		listed:    []string{},
		inspected: []string{},
		deleted:   []string{},
	}
}

// deletionRulesForPath builds overlapping rule fixtures for precedence tests.
//
// The helper normalizes its simulated torrent-set key exactly as production does so
// case-insensitive lookups remain representative of request-loaded rule snapshots.
//
// Since: 2.0.0
func deletionRulesForPath(
	path string,
	profile bool,
	download bool,
) storageDirectoryRules {
	downloadDirectory := "/data/downloads"
	if download {
		downloadDirectory = path
	}
	rules := storageDirectoryRules{
		downloadPolicy: downloadPathPolicy{
			downloadDirectory:   downloadDirectory,
			incompleteDirectory: "/data/incomplete",
		},
		torrentDirectories: map[string]struct{}{
			strings.ToLower(path): {},
		},
		torrentLocationsAvailable: true,
	}
	if profile {
		rules.profiles = []storage.TorrentProfile{
			{Name: "First", DownloadDirectory: path},
			{Name: "Second", DownloadDirectory: path},
		}
	}
	if path == "/data/other" {
		rules.torrentDirectories = map[string]struct{}{}
	}

	return rules
}

// withDirectoryEntryPath copies one fixture with a path.
func withDirectoryEntryPath(
	entry directorybrowser.DirectoryEntry,
	path string,
) directorybrowser.DirectoryEntry {
	entry.Path = path

	return entry
}

// findDecoratedDirectoryEntry returns one exact API entry or fails the test.
func findDecoratedDirectoryEntry(
	testingObject *testing.T,
	directory storageDirectoryResponse,
	path string,
) storageDirectoryEntry {
	testingObject.Helper()

	for _, entry := range directory.Directories {
		if entry.Path == path {
			return entry
		}
	}

	testingObject.Fatalf("directory %s missing from %+v", path, directory.Directories)

	return storageDirectoryEntry{}
}
