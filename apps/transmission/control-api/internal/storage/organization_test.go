package storage

import (
	"context"
	"encoding/json"
	"errors"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

// TestTorrentOrganizationTransactions verifies durable atomic preset replacement.
//
// Empty defaults, sorted reads, replacement, and stale revision rejection protect the
// UI's full-list editor from silently discarding concurrent organization work.
func TestTorrentOrganizationTransactions(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	initial, err := store.TorrentOrganization(ctx)
	if err != nil {
		testingObject.Fatalf("read initial organization: %v", err)
	}
	if initial.Revision != 0 ||
		len(initial.Labels) != 0 {
		testingObject.Fatalf("unexpected initial organization: %+v", initial)
	}

	updated, err := store.UpdateTorrentOrganization(
		ctx,
		0,
		[]string{"Weekly", "Archive"},
		nil,
		nil,
	)
	if err != nil {
		testingObject.Fatalf("update organization: %v", err)
	}
	if updated.Revision != 1 {
		testingObject.Fatalf("organization revision = %d, want 1", updated.Revision)
	}
	if !reflect.DeepEqual(updated.Labels, []string{"Archive", "Weekly"}) {
		testingObject.Fatalf("unexpected labels: %+v", updated.Labels)
	}

	if _, err := store.UpdateTorrentOrganization(
		ctx,
		0,
		[]string{"Stale"},
		nil,
		nil,
	); !errors.Is(err, ErrTorrentOrganizationRevisionConflict) {
		testingObject.Fatalf("stale organization error = %v, want revision conflict", err)
	}

	persisted, err := store.TorrentOrganization(ctx)
	if err != nil {
		testingObject.Fatalf("read persisted organization: %v", err)
	}
	if !reflect.DeepEqual(persisted, updated) {
		testingObject.Fatalf("persisted organization = %+v, want %+v", persisted, updated)
	}
}

// TestTorrentOrganizationUpdateEncodesEmptyListsAsArrays keeps empty lists out of null.
//
// The console refuses a null list, so a save that clears every label must still
// answer with an empty array and the new revision.
func TestTorrentOrganizationUpdateEncodesEmptyListsAsArrays(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	updated, err := store.UpdateTorrentOrganization(ctx, 0, []string{}, nil, nil)
	if err != nil {
		testingObject.Fatalf("update organization: %v", err)
	}
	encoded, err := json.Marshal(updated)
	if err != nil {
		testingObject.Fatalf("encode organization: %v", err)
	}
	if !strings.Contains(string(encoded), `"labels":[]`) || strings.Contains(string(encoded), "null") {
		testingObject.Fatalf("encoded organization = %s, want an empty labels array", encoded)
	}
}
