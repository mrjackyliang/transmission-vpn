package storage

import (
	"context"
	"fmt"
	"path/filepath"
	"testing"
)

// TestEnsureTorrentLabelsStopsAtCap verifies the automatic label cap.
//
// Automatically saved labels stay within what the Edit dialog can send back, so a
// full list never locks the dialog.
func TestEnsureTorrentLabelsStopsAtCap(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	labels := make([]string, 0, MaximumTorrentLabels+5)
	for index := 0; index < MaximumTorrentLabels+5; index++ {
		labels = append(labels, fmt.Sprintf("label-%04d", index))
	}
	organization, err := store.EnsureTorrentLabels(ctx, labels)
	if err != nil {
		testingObject.Fatalf("ensure labels: %v", err)
	}
	if len(organization.Labels) != MaximumTorrentLabels {
		testingObject.Fatalf("saved %d labels, want %d", len(organization.Labels), MaximumTorrentLabels)
	}
}
