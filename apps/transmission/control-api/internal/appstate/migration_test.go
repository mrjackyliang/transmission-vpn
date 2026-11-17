package appstate

import (
	"bytes"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestMigrateLegacyLayoutMovesOldStateAtEitherResolvedRoot covers both supported
// upgrade shapes: the same host folder remounted at /config and an old /data-only
// run line that Nova keeps active until the owner changes the mount.
//
// Since: 2.4.0
func TestMigrateLegacyLayoutMovesOldStateAtEitherResolvedRoot(testingObject *testing.T) {
	testCases := []struct {
		name string
		root string
	}{
		{name: "same folder mounted at config", root: "config"},
		{name: "old run line using data", root: "data"},
	}

	for _, testCase := range testCases {
		testingObject.Run(testCase.name, func(testingObject *testing.T) {
			stateDirectory := filepath.Join(testingObject.TempDir(), testCase.root)
			testingObject.Setenv(projectStateDirectoryEnvironment, stateDirectory)
			testingObject.Setenv(novaStateDirectoryEnvironment, stateDirectory)
			testingObject.Setenv(databaseDirectoryEnvironment, filepath.Join(stateDirectory, "database"))
			testingObject.Setenv(
				installationKeyFileEnvironment,
				filepath.Join(stateDirectory, "keys", "installation.key"),
			)

			legacyKeyPath := filepath.Join(stateDirectory, "app", "keys", "installation.key")
			legacyDatabasePath := filepath.Join(stateDirectory, "app", "state.sqlite3")
			if err := os.MkdirAll(filepath.Dir(legacyKeyPath), 0o700); err != nil {
				testingObject.Fatalf("create legacy key directory: %v", err)
			}
			if err := os.MkdirAll(DatabaseDirectory(), 0o755); err != nil {
				testingObject.Fatalf("create database directory: %v", err)
			}
			if err := os.MkdirAll(filepath.Dir(InstallationKeyFile()), 0o700); err != nil {
				testingObject.Fatalf("create key directory: %v", err)
			}

			legacyKey := bytes.Repeat([]byte{0x2a}, 32)
			if err := os.WriteFile(legacyKeyPath, legacyKey, 0o600); err != nil {
				testingObject.Fatalf("write legacy key: %v", err)
			}
			if err := os.WriteFile(legacyDatabasePath, []byte("database"), 0o660); err != nil {
				testingObject.Fatalf("write legacy database: %v", err)
			}
			if err := os.WriteFile(legacyDatabasePath+"-wal", []byte("wal"), 0o660); err != nil {
				testingObject.Fatalf("write legacy WAL: %v", err)
			}
			if err := os.WriteFile(legacyDatabasePath+"-shm", []byte("shared memory"), 0o660); err != nil {
				testingObject.Fatalf("write legacy shared memory: %v", err)
			}

			var logOutput bytes.Buffer
			logger := slog.New(slog.NewTextHandler(&logOutput, nil))
			if err := MigrateLegacyLayout(logger); err != nil {
				testingObject.Fatalf("migrate legacy layout: %v", err)
			}

			assertFileContent(testingObject, InstallationKeyFile(), legacyKey)
			assertFileContent(testingObject, DatabaseFile(), []byte("database"))
			assertFileContent(testingObject, DatabaseFile()+"-wal", []byte("wal"))
			assertFileContent(testingObject, DatabaseFile()+"-shm", []byte("shared memory"))
			if _, err := os.Stat(legacyKeyPath); !os.IsNotExist(err) {
				testingObject.Fatalf("legacy key still exists: %v", err)
			}
			if _, err := os.Stat(legacyDatabasePath); !os.IsNotExist(err) {
				testingObject.Fatalf("legacy database still exists: %v", err)
			}
			if strings.Count(logOutput.String(), "moved legacy app state") != 4 {
				testingObject.Fatalf("migration logs = %q", logOutput.String())
			}
		})
	}
}

// TestMigrateLegacyLayoutRefusesAnOccupiedDestination proves existing new-layout
// state wins without any old file being overwritten or partially moved.
//
// Since: 2.4.0
func TestMigrateLegacyLayoutRefusesAnOccupiedDestination(testingObject *testing.T) {
	stateDirectory := testingObject.TempDir()
	testingObject.Setenv(projectStateDirectoryEnvironment, stateDirectory)
	testingObject.Setenv(databaseDirectoryEnvironment, filepath.Join(stateDirectory, "database"))
	testingObject.Setenv(
		installationKeyFileEnvironment,
		filepath.Join(stateDirectory, "keys", "installation.key"),
	)

	legacyKeyPath := filepath.Join(stateDirectory, "app", "keys", "installation.key")
	legacyDatabasePath := filepath.Join(stateDirectory, "app", "state.sqlite3")
	if err := os.MkdirAll(filepath.Dir(legacyKeyPath), 0o700); err != nil {
		testingObject.Fatalf("create legacy key directory: %v", err)
	}
	if err := os.MkdirAll(DatabaseDirectory(), 0o755); err != nil {
		testingObject.Fatalf("create database directory: %v", err)
	}
	if err := os.WriteFile(legacyKeyPath, bytes.Repeat([]byte{0x3b}, 32), 0o600); err != nil {
		testingObject.Fatalf("write legacy key: %v", err)
	}
	if err := os.WriteFile(legacyDatabasePath, []byte("legacy"), 0o660); err != nil {
		testingObject.Fatalf("write legacy database: %v", err)
	}
	if err := os.WriteFile(DatabaseFile(), []byte("current"), 0o660); err != nil {
		testingObject.Fatalf("write current database: %v", err)
	}

	err := MigrateLegacyLayout(slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err == nil || !strings.Contains(err.Error(), "is not empty") {
		testingObject.Fatalf("occupied destination migration error = %v", err)
	}

	assertFileContent(testingObject, legacyKeyPath, bytes.Repeat([]byte{0x3b}, 32))
	assertFileContent(testingObject, legacyDatabasePath, []byte("legacy"))
	assertFileContent(testingObject, DatabaseFile(), []byte("current"))
}

// assertFileContent compares one migration result with its expected bytes.
//
// Keeping the assertion here makes the two supported state roots exercise the
// exact same no-data-loss checks.
//
// Since: 2.4.0
func assertFileContent(testingObject *testing.T, path string, expected []byte) {
	testingObject.Helper()

	content, err := os.ReadFile(path)
	if err != nil {
		testingObject.Fatalf("read %s: %v", path, err)
	}
	if !bytes.Equal(content, expected) {
		testingObject.Fatalf("%s content = %q, want %q", path, content, expected)
	}
}
