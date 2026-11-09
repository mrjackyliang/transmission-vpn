package storage

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"reflect"
	"testing"
	"time"
)

// TestTorrentProfilesCRUDAndOrdering exercises the complete durable profile lifecycle.
//
// Profiles remain alphabetized by name while their own values are edited.
func TestTorrentProfilesCRUDAndOrdering(t *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(t.TempDir(), "state.sqlite3"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer store.Close()

	first, err := store.CreateTorrentProfile(ctx, testTorrentProfile(
		"tpr-0000000000000001",
		"Movies",
		"/data/downloads/movies",
	))
	if err != nil {
		t.Fatalf("create first profile: %v", err)
	}
	second, err := store.CreateTorrentProfile(ctx, testTorrentProfile(
		"tpr-0000000000000002",
		"Series",
		"/data/downloads/series",
	))
	if err != nil {
		t.Fatalf("create second profile: %v", err)
	}
	if first.CreatedAt.IsZero() || first.UpdatedAt.IsZero() {
		t.Fatalf("created profiles = %+v, %+v", first, second)
	}

	listed, err := store.ListTorrentProfiles(ctx)
	if err != nil || len(listed) != 2 || listed[0].ID != first.ID || listed[1].ID != second.ID {
		t.Fatalf("initial list = %+v, %v", listed, err)
	}

	updatedInput := testTorrentProfile(first.ID, "Feature films", "/data/library/films")
	updatedInput.Labels = []string{"Movie", "Archive"}
	updatedInput.StartPaused = true
	updatedInput.MatchPatterns = []string{"*.mkv", "*2160p*"}
	updatedInput.Options.PeerLimit = 80
	updated, err := store.UpdateTorrentProfile(ctx, first.ID, updatedInput)
	if err != nil {
		t.Fatalf("update profile: %v", err)
	}
	if updated.Name != "Feature films" || !updated.StartPaused ||
		updated.Options.PeerLimit != 80 || !reflect.DeepEqual(updated.Labels, updatedInput.Labels) ||
		!reflect.DeepEqual(updated.MatchPatterns, updatedInput.MatchPatterns) {
		t.Fatalf("updated profile = %+v", updated)
	}

	listed, err = store.ListTorrentProfiles(ctx)
	if err != nil || len(listed) != 2 || listed[0].ID != first.ID || listed[1].ID != second.ID {
		t.Fatalf("alphabetical list = %+v, %v", listed, err)
	}

	found, err := store.FindTorrentProfile(ctx, second.ID)
	if err != nil || found.Name != second.Name {
		t.Fatalf("find second profile = %+v, %v", found, err)
	}
	if err := store.DeleteTorrentProfile(ctx, second.ID); err != nil {
		t.Fatalf("delete second profile: %v", err)
	}
	if _, err := store.FindTorrentProfile(ctx, second.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("find deleted profile error = %v, want ErrNotFound", err)
	}
}

// TestTorrentProfileNamesIgnoreCase verifies the same uniqueness rule in SQLite and Go.
func TestTorrentProfileNamesIgnoreCase(t *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(t.TempDir(), "state.sqlite3"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer store.Close()
	if _, err := store.CreateTorrentProfile(ctx, testTorrentProfile(
		"tpr-0000000000000010",
		"DEFAULT PROFILE",
		"/data/default-name",
	)); !errors.Is(err, ErrTorrentProfileNameTaken) {
		t.Fatalf("Default-name create error = %v, want ErrTorrentProfileNameTaken", err)
	}

	profile, err := store.CreateTorrentProfile(ctx, testTorrentProfile(
		"tpr-0000000000000011",
		"Movies",
		"/data/movies",
	))
	if err != nil {
		t.Fatalf("create profile: %v", err)
	}
	if _, err := store.CreateTorrentProfile(ctx, testTorrentProfile(
		"tpr-0000000000000012",
		"MOVIES",
		"/data/other",
	)); !errors.Is(err, ErrTorrentProfileNameTaken) {
		t.Fatalf("case-insensitive create error = %v, want ErrTorrentProfileNameTaken", err)
	}

	profile.Name = "MOVIES"
	if _, err := store.UpdateTorrentProfile(ctx, profile.ID, profile); err != nil {
		t.Fatalf("change the profile's own name case: %v", err)
	}
	defaultProfile, err := store.DefaultTorrentProfile(ctx)
	if err != nil {
		t.Fatalf("read Default profile: %v", err)
	}
	defaultProfile.Name = "movies"
	if _, err := store.UpdateDefaultTorrentProfile(ctx, defaultProfile); !errors.Is(err, ErrTorrentProfileNameTaken) {
		t.Fatalf("named-profile Default rename error = %v, want ErrTorrentProfileNameTaken", err)
	}
}

// TestDefaultTorrentProfileStartsWithExplicitDefaults verifies migration 011.
func TestDefaultTorrentProfileStartsWithExplicitDefaults(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	profile, err := store.DefaultTorrentProfile(ctx)
	if err != nil {
		testingObject.Fatalf("read Default profile: %v", err)
	}
	if profile.Name != "Default profile" || len(profile.Labels) != 0 || profile.StartPaused ||
		profile.Options.Seeding.Mode != "never" ||
		profile.Options.DownloadLimitKBps != nil ||
		profile.Options.UploadLimitKBps != nil ||
		profile.Options.BandwidthPriority != 0 ||
		profile.Options.PeerLimit != 50 ||
		profile.Options.Queue != "normal" || profile.UpdatedAt.IsZero() {
		testingObject.Fatalf("Default profile = %+v", profile)
	}

	var removedTableCount int
	if err := store.databaseHandle().QueryRowContext(
		ctx,
		`SELECT COUNT(*) FROM sqlite_master
		 WHERE type = 'table' AND name = 'torrent_download_locations'`,
	).Scan(&removedTableCount); err != nil || removedTableCount != 0 {
		testingObject.Fatalf(
			"torrent_download_locations table count = %d, %v",
			removedTableCount,
			err,
		)
	}

	profile.Labels = []string{"Default", "Archive"}
	profile.Name = "Home"
	profile.StartPaused = true
	profile.Options.PeerLimit = 75
	updated, err := store.UpdateDefaultTorrentProfile(ctx, profile)
	if err != nil {
		testingObject.Fatalf("update Default profile: %v", err)
	}
	if updated.Name != "Home" || !reflect.DeepEqual(updated.Labels, profile.Labels) ||
		!updated.StartPaused || updated.Options.PeerLimit != 75 {
		testingObject.Fatalf("updated Default profile = %+v", updated)
	}
}

// TestTorrentProfileFoldersIgnoreCase enforces one named owner per folder.
func TestTorrentProfileFoldersIgnoreCase(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	first, err := store.CreateTorrentProfile(ctx, testTorrentProfile(
		"tpr-0000000000000091",
		"Movies",
		"/data/Movies",
	))
	if err != nil {
		testingObject.Fatalf("create profile: %v", err)
	}
	_, err = store.CreateTorrentProfile(ctx, testTorrentProfile(
		"tpr-0000000000000092",
		"Archive",
		"/data/movies",
	))
	var conflict *TorrentProfileFolderConflict
	if !errors.As(err, &conflict) || conflict.ProfileName != "Movies" {
		testingObject.Fatalf("create folder conflict = %#v, %v", conflict, err)
	}

	first.DownloadDirectory = "/data/MOVIES"
	if _, err := store.UpdateTorrentProfile(ctx, first.ID, first); err != nil {
		testingObject.Fatalf("change own folder case: %v", err)
	}
}

// TestTorrentProfileFoldersNeverNest rejects a named profile inside or around another.
func TestTorrentProfileFoldersNeverNest(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	if _, err := store.CreateTorrentProfile(ctx, testTorrentProfile(
		"tpr-0000000000000093",
		"Media",
		"/data/media",
	)); err != nil {
		testingObject.Fatalf("create profile: %v", err)
	}
	for _, testCase := range []struct {
		id       string
		folder   string
		relation string
	}{
		{"tpr-0000000000000094", "/data/Media/tv", "inside"},
		{"tpr-0000000000000095", "/data", "contains"},
	} {
		_, err := store.CreateTorrentProfile(ctx, testTorrentProfile(testCase.id, "Nested "+testCase.relation, testCase.folder))
		var conflict *TorrentProfileFolderConflict
		if !errors.As(err, &conflict) || conflict.ProfileName != "Media" || conflict.Relation != testCase.relation {
			testingObject.Fatalf("%s conflict = %#v, %v", testCase.folder, conflict, err)
		}
	}
	if _, err := store.CreateTorrentProfile(ctx, testTorrentProfile(
		"tpr-0000000000000096",
		"Sibling",
		"/data/media-archive",
	)); err != nil {
		testingObject.Fatalf("a similarly named sibling was treated as nested: %v", err)
	}
}

// TestTorrentProfileConnectionReferencesAreTransactional rejects missing routes on
// both creation and replacement at the durable write boundary.
func TestTorrentProfileConnectionReferencesAreTransactional(t *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(t.TempDir(), "state.sqlite3"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer store.Close()

	missingConnectionID := "vpc-ffffffffffffffff"
	profile := testTorrentProfile(
		"tpr-0000000000000013",
		"Missing connection",
		"/data/missing",
	)
	profile.ConnectionID = &missingConnectionID
	if _, err := store.CreateTorrentProfile(ctx, profile); !errors.Is(
		err,
		ErrVPNConnectionReference,
	) {
		t.Fatalf("create with missing connection error = %v", err)
	}

	profile.ConnectionID = nil
	created, err := store.CreateTorrentProfile(ctx, profile)
	if err != nil {
		t.Fatalf("create default profile: %v", err)
	}
	created.ConnectionID = &missingConnectionID
	if _, err := store.UpdateTorrentProfile(ctx, created.ID, created); !errors.Is(
		err,
		ErrVPNConnectionReference,
	) {
		t.Fatalf("update with missing connection error = %v", err)
	}
}

// TestTorrentProfileLimit keeps the collection bounded at one hundred presets.
func TestTorrentProfileLimit(t *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(t.TempDir(), "state.sqlite3"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer store.Close()

	for index := 0; index < maximumTorrentProfiles; index++ {
		_, err := store.CreateTorrentProfile(ctx, testTorrentProfile(
			fmt.Sprintf("tpr-%016x", index),
			fmt.Sprintf("Profile %d", index),
			fmt.Sprintf("/data/profile-%d", index),
		))
		if err != nil {
			t.Fatalf("create profile %d: %v", index, err)
		}
	}
	if _, err := store.CreateTorrentProfile(ctx, testTorrentProfile(
		"tpr-ffffffffffffffff",
		"One too many",
		"/data/too-many",
	)); !errors.Is(err, ErrTorrentProfileLimit) {
		t.Fatalf("profile 101 error = %v, want ErrTorrentProfileLimit", err)
	}
}

// TestTorrentProfileAssignmentsCascade verifies hashes follow profile deletion.
func TestTorrentProfileAssignmentsCascade(t *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(t.TempDir(), "state.sqlite3"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer store.Close()

	profile, err := store.CreateTorrentProfile(ctx, testTorrentProfile(
		"tpr-0000000000000021",
		"Linux",
		"/data/linux",
	))
	if err != nil {
		t.Fatalf("create profile: %v", err)
	}
	if err := store.ReplaceTorrentProfileAssignments(
		ctx,
		[]string{"ABCDEF0123456789"},
		&profile.ID,
	); err != nil {
		t.Fatalf("assign torrent: %v", err)
	}

	assignments, err := store.ListTorrentProfileAssignments(ctx)
	if err != nil || assignments["abcdef0123456789"] != profile.ID {
		t.Fatalf("assignments = %+v, %v", assignments, err)
	}
	if err := store.DeleteTorrentProfile(ctx, profile.ID); err != nil {
		t.Fatalf("delete profile: %v", err)
	}
	assignments, err = store.ListTorrentProfileAssignments(ctx)
	if err != nil || len(assignments) != 0 {
		t.Fatalf("assignments after cascade = %+v, %v", assignments, err)
	}
}

// TestDeleteTorrentProfileKeepsPendingChoice preserves explicit owner resolution.
//
// Deleting matching profiles removes their identifiers without clearing the marker,
// including after no original choice remains.
func TestDeleteTorrentProfileKeepsPendingChoice(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	first, err := store.CreateTorrentProfile(ctx, testTorrentProfile(
		"tpr-0000000000000031",
		"First",
		"/data/first",
	))
	if err != nil {
		testingObject.Fatalf("create first profile: %v", err)
	}
	second, err := store.CreateTorrentProfile(ctx, testTorrentProfile(
		"tpr-0000000000000032",
		"Second",
		"/data/second",
	))
	if err != nil {
		testingObject.Fatalf("create second profile: %v", err)
	}
	const hash = "3333333333333333333333333333333333333333"
	if err := store.ReplaceTorrentNeedsProfile(ctx, hash, []string{first.ID, second.ID}); err != nil {
		testingObject.Fatalf("store pending profile choice: %v", err)
	}
	if err := store.DeleteTorrentProfile(ctx, first.ID); err != nil {
		testingObject.Fatalf("delete first profile: %v", err)
	}
	choices, err := store.ListTorrentNeedsProfiles(ctx)
	if err != nil || !reflect.DeepEqual(choices[hash], []string{second.ID}) {
		testingObject.Fatalf("choices after first deletion = %#v, %v", choices, err)
	}
	if err := store.DeleteTorrentProfile(ctx, second.ID); err != nil {
		testingObject.Fatalf("delete second profile: %v", err)
	}
	choices, err = store.ListTorrentNeedsProfiles(ctx)
	if err != nil || choices[hash] == nil || len(choices[hash]) != 0 {
		testingObject.Fatalf("choices after every deletion = %#v, %v", choices, err)
	}
}

// TestDeleteStaleTorrentProfileAssignmentsPreservesFreshAssignments closes the list race.
//
// An assignment committed after a daemon list starts cannot be inferred stale from
// that older response, while assignments predating the request remain eligible.
func TestDeleteStaleTorrentProfileAssignmentsPreservesFreshAssignments(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	profile, err := store.CreateTorrentProfile(ctx, testTorrentProfile(
		"tpr-0000000000000022",
		"Race",
		"/data/race",
	))
	if err != nil {
		testingObject.Fatalf("create profile: %v", err)
	}
	const oldHash = "1111111111111111111111111111111111111111"
	const freshHash = "2222222222222222222222222222222222222222"
	if err := store.ReplaceTorrentProfileAssignments(ctx, []string{oldHash}, &profile.ID); err != nil {
		testingObject.Fatalf("store old assignment: %v", err)
	}
	listStartedAt := time.Now()
	if err := store.ReplaceTorrentProfileAssignments(ctx, []string{freshHash}, &profile.ID); err != nil {
		testingObject.Fatalf("store fresh assignment: %v", err)
	}

	if err := store.DeleteStaleTorrentProfileAssignments(
		ctx,
		map[string]struct{}{},
		listStartedAt,
	); err != nil {
		testingObject.Fatalf("delete stale assignments: %v", err)
	}
	assignments, err := store.ListTorrentProfileAssignments(ctx)
	if err != nil {
		testingObject.Fatalf("list assignments: %v", err)
	}
	if len(assignments) != 1 || assignments[freshHash] != profile.ID {
		testingObject.Fatalf("assignments after prune = %+v", assignments)
	}
}

// TestTorrentProfileLabelsBecomeSavedLabels verifies the profile write invariant.
//
// New labels advance the organization revision in the profile transaction, while a
// case-insensitive duplicate keeps the first saved spelling and does not advance it.
func TestTorrentProfileLabelsBecomeSavedLabels(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	profileInput := testTorrentProfile(
		"tpr-0000000000000041",
		"Labeled",
		"/data/labeled",
	)
	profileInput.Labels = []string{"First"}
	profile, err := store.CreateTorrentProfile(ctx, profileInput)
	if err != nil {
		testingObject.Fatalf("create labeled profile: %v", err)
	}
	organization, err := store.TorrentOrganization(ctx)
	if err != nil {
		testingObject.Fatalf("read organization after create: %v", err)
	}
	if organization.Revision != 1 || !reflect.DeepEqual(organization.Labels, []string{"First"}) {
		testingObject.Fatalf("organization after create = %+v", organization)
	}

	profile.Labels = []string{"first"}
	profile, err = store.UpdateTorrentProfile(ctx, profile.ID, profile)
	if err != nil {
		testingObject.Fatalf("update profile with duplicate spelling: %v", err)
	}
	organization, err = store.TorrentOrganization(ctx)
	if err != nil {
		testingObject.Fatalf("read organization after duplicate: %v", err)
	}
	if organization.Revision != 1 || !reflect.DeepEqual(organization.Labels, []string{"First"}) {
		testingObject.Fatalf("organization after duplicate = %+v", organization)
	}

	profile.Labels = []string{"first", "Second"}
	if _, err := store.UpdateTorrentProfile(ctx, profile.ID, profile); err != nil {
		testingObject.Fatalf("update profile with new label: %v", err)
	}
	organization, err = store.TorrentOrganization(ctx)
	if err != nil {
		testingObject.Fatalf("read organization after profile edit: %v", err)
	}
	if organization.Revision != 2 || !reflect.DeepEqual(
		organization.Labels,
		[]string{"First", "Second"},
	) {
		testingObject.Fatalf("organization after profile edit = %+v", organization)
	}

	defaultProfile, err := store.DefaultTorrentProfile(ctx)
	if err != nil {
		testingObject.Fatalf("read Default profile: %v", err)
	}
	defaultProfile.Labels = []string{"Default"}
	if _, err := store.UpdateDefaultTorrentProfile(ctx, defaultProfile); err != nil {
		testingObject.Fatalf("update Default profile labels: %v", err)
	}
	organization, err = store.TorrentOrganization(ctx)
	if err != nil {
		testingObject.Fatalf("read organization after Default profile: %v", err)
	}
	if organization.Revision != 3 || !reflect.DeepEqual(
		organization.Labels,
		[]string{"Default", "First", "Second"},
	) {
		testingObject.Fatalf("organization after Default profile = %+v", organization)
	}
}

func testTorrentProfile(id string, name string, directory string) TorrentProfile {
	return TorrentProfile{
		ID:                id,
		Name:              name,
		DownloadDirectory: directory,
		Labels:            []string{},
		Options: TorrentProfileOptions{
			Seeding: TorrentProfileSeeding{
				Mode: "never",
			},
			BandwidthPriority: 0,
			PeerLimit:         50,
			Queue:             "normal",
		},
		MatchPatterns: []string{},
	}
}
