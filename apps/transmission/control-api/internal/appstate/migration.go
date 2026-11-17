package appstate

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
)

// legacyMove describes one old-layout file and its Nova-contract destination.
//
// Preflight validates every move before any rename, which keeps a conflict from
// leaving the key and database split across layouts.
//
// Since: 2.4.0
type legacyMove struct {
	source      string
	destination string
	description string
}

// MigrateLegacyLayout moves the former app key and SQLite files into Nova's layout.
//
// Existing destinations are never overwritten. Every planned rename is checked
// before changes begin, and a later failure rolls completed renames back.
//
// Since: 2.4.0
func MigrateLegacyLayout(logger *slog.Logger) error {
	stateDirectory := StateDirectory()
	legacyApplicationDirectory := filepath.Join(stateDirectory, "app")
	legacyDatabaseFile := filepath.Join(legacyApplicationDirectory, "state.sqlite3")
	legacyInstallationKeyFile := filepath.Join(
		legacyApplicationDirectory,
		"keys",
		"installation.key",
	)

	moves := []legacyMove{}
	keyMove, keyFound, err := prepareLegacyMove(
		legacyInstallationKeyFile,
		InstallationKeyFile(),
		"installation key",
	)
	if err != nil {
		return err
	}
	if keyFound {
		moves = append(moves, keyMove)
	}

	databaseMoves, err := prepareDatabaseMoves(legacyDatabaseFile)
	if err != nil {
		return err
	}
	moves = append(moves, databaseMoves...)

	if len(moves) == 0 {
		return nil
	}

	for _, move := range moves {
		if err := os.MkdirAll(filepath.Dir(move.destination), 0o700); err != nil {
			return fmt.Errorf("create %s destination: %w", move.description, err)
		}
	}

	completedMoves := make([]legacyMove, 0, len(moves))
	for _, move := range moves {
		if err := os.Rename(move.source, move.destination); err != nil {
			rollbackError := rollbackLegacyMoves(completedMoves)
			moveError := fmt.Errorf(
				"move legacy %s from %s to %s: %w",
				move.description,
				move.source,
				move.destination,
				err,
			)
			if rollbackError != nil {
				return errors.Join(moveError, rollbackError)
			}

			return moveError
		}
		completedMoves = append(completedMoves, move)
	}

	if logger == nil {
		logger = slog.Default()
	}
	for _, move := range completedMoves {
		logger.Info(
			"moved legacy app state",
			"item",
			move.description,
			"source",
			move.source,
			"destination",
			move.destination,
		)
	}

	_ = os.Remove(filepath.Join(legacyApplicationDirectory, "keys"))
	_ = os.Remove(legacyApplicationDirectory)

	return nil
}

// prepareDatabaseMoves validates the legacy SQLite set before returning its moves.
//
// A main database is required whenever a legacy sidecar exists, and the new
// database directory must be empty before the old set can be published there.
//
// Since: 2.4.0
func prepareDatabaseMoves(legacyDatabaseFile string) ([]legacyMove, error) {
	legacyMainExists, err := regularFileExists(legacyDatabaseFile)
	if err != nil {
		return nil, err
	}

	legacyPaths := []string{
		legacyDatabaseFile,
		legacyDatabaseFile + "-shm",
		legacyDatabaseFile + "-wal",
	}
	legacyExistingPaths := []string{}
	for _, legacyPath := range legacyPaths {
		exists, pathError := regularFileExists(legacyPath)
		if pathError != nil {
			return nil, pathError
		}
		if exists {
			legacyExistingPaths = append(legacyExistingPaths, legacyPath)
		}
	}

	if !legacyMainExists {
		if len(legacyExistingPaths) > 0 {
			return nil, fmt.Errorf(
				"legacy SQLite sidecar exists without %s",
				legacyDatabaseFile,
			)
		}

		return nil, nil
	}

	databaseDirectory := DatabaseDirectory()
	entries, err := os.ReadDir(databaseDirectory)
	if errors.Is(err, os.ErrNotExist) {
		entries = nil
	} else if err != nil {
		return nil, fmt.Errorf("read database destination %s: %w", databaseDirectory, err)
	}
	if len(entries) > 0 {
		return nil, fmt.Errorf(
			"refusing to move legacy database because %s is not empty",
			databaseDirectory,
		)
	}

	moves := make([]legacyMove, 0, len(legacyExistingPaths))
	for _, legacyPath := range legacyExistingPaths {
		destination := filepath.Join(databaseDirectory, filepath.Base(legacyPath))
		move, found, moveError := prepareLegacyMove(
			legacyPath,
			destination,
			"database file "+filepath.Base(legacyPath),
		)
		if moveError != nil {
			return nil, moveError
		}
		if found {
			moves = append(moves, move)
		}
	}

	return moves, nil
}

// prepareLegacyMove rejects non-regular sources and occupied destinations.
//
// The caller receives found=false for an absent source so optional SQLite
// sidecars do not need separate migration branches.
//
// Since: 2.4.0
func prepareLegacyMove(
	source string,
	destination string,
	description string,
) (legacyMove, bool, error) {
	sourceExists, err := regularFileExists(source)
	if err != nil {
		return legacyMove{}, false, err
	}
	if !sourceExists {
		return legacyMove{}, false, nil
	}

	_, err = os.Lstat(destination)
	if err == nil {
		return legacyMove{}, false, fmt.Errorf(
			"refusing to overwrite existing %s at %s",
			description,
			destination,
		)
	}
	if !errors.Is(err, os.ErrNotExist) {
		return legacyMove{}, false, fmt.Errorf(
			"inspect %s destination %s: %w",
			description,
			destination,
			err,
		)
	}

	return legacyMove{
		source:      source,
		destination: destination,
		description: description,
	}, true, nil
}

// regularFileExists reports whether a migration source is a regular file.
//
// Symbolic links and directories fail closed so startup never moves an
// attacker-selected path into the key or database contract.
//
// Since: 2.4.0
func regularFileExists(path string) (bool, error) {
	fileInfo, err := os.Lstat(path)
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("inspect legacy state path %s: %w", path, err)
	}
	if !fileInfo.Mode().IsRegular() {
		return false, fmt.Errorf("legacy state path %s is not a regular file", path)
	}

	return true, nil
}

// rollbackLegacyMoves restores every rename completed by the current attempt.
//
// A rollback error is returned with the original move error so startup stops
// instead of opening a database whose key may still be in the other layout.
//
// Since: 2.4.0
func rollbackLegacyMoves(completedMoves []legacyMove) error {
	rollbackErrors := []error{}
	for moveIndex := len(completedMoves) - 1; moveIndex >= 0; moveIndex-- {
		move := completedMoves[moveIndex]
		if err := os.Rename(move.destination, move.source); err != nil {
			rollbackErrors = append(rollbackErrors, fmt.Errorf(
				"restore legacy %s from %s to %s: %w",
				move.description,
				move.destination,
				move.source,
				err,
			))
		}
	}

	return errors.Join(rollbackErrors...)
}
