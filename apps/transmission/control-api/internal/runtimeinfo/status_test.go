package runtimeinfo

import (
	"os"
	"path/filepath"
	"testing"
)

// TestReadSnapshotDecodesProtectedInterfaces verifies the multi-connection marker.
func TestReadSnapshotDecodesProtectedInterfaces(testingObject *testing.T) {
	runtimeDirectory := testingObject.TempDir()
	if err := os.WriteFile(
		filepath.Join(runtimeDirectory, "firewall.ready"),
		[]byte(`{"state":"protected","interfaces":[{"interface":"wg0","address":"10.68.0.2"},{"interface":"tun3","address":"10.68.3.2"}],"backend":"nft","uid":1000}`),
		0o644,
	); err != nil {
		testingObject.Fatalf("write firewall marker: %v", err)
	}

	snapshot, err := ReadSnapshot(runtimeDirectory)
	if err != nil {
		testingObject.Fatalf("read runtime snapshot: %v", err)
	}
	if !snapshot.Firewall.Ready || snapshot.Firewall.State != "protected" ||
		len(snapshot.Firewall.Interfaces) != 2 ||
		snapshot.Firewall.Interfaces[0].Interface != "wg0" ||
		snapshot.Firewall.Interfaces[1].Address != "10.68.3.2" {
		testingObject.Fatalf("firewall snapshot = %+v", snapshot.Firewall)
	}
}
