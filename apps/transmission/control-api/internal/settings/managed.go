package settings

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
)

// ManagedMode selects how a host-owned setting affects persisted UI state.
//
// Seeds initialize an unset value once, while locks remain authoritative and are
// exposed as read-only through the application API.
type ManagedMode string

const (
	// ManagedModeSeed initializes a value only when no persisted value exists.
	ManagedModeSeed ManagedMode = "seed"

	// ManagedModeLock makes the managed value authoritative while it is mounted.
	ManagedModeLock ManagedMode = "lock"
)

// ManagedValue describes one host-owned setting entry.
//
// Raw JSON is retained until the shared setting registry validates and canonicalizes
// it using the same rules as interactive API changes.
type ManagedValue struct {
	Mode  ManagedMode     `json:"mode"`
	Value json.RawMessage `json:"value"`
}

// ManagedDocument is the versioned declarative configuration contract.
//
// The first version intentionally carries only non-secret settings; secret material
// is referenced through permission-restricted files in provider-specific flows.
type ManagedDocument struct {
	Version  int                     `json:"version"`
	Settings map[string]ManagedValue `json:"settings"`
}

// ReadManagedDocument reads and validates an optional managed JSON document.
//
// A missing file means the deployment is UI-managed. Any present but invalid file
// fails startup so an operator cannot mistake ignored policy for active policy.
func ReadManagedDocument(path string, registry Registry) (*ManagedDocument, error) {
	content, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}

	if err != nil {
		return nil, fmt.Errorf("read managed configuration: %w", err)
	}

	decoder := json.NewDecoder(bytes.NewReader(content))
	decoder.DisallowUnknownFields()

	var document ManagedDocument
	if err := decoder.Decode(&document); err != nil {
		return nil, fmt.Errorf("decode managed configuration: %w", err)
	}

	var trailingValue any
	if err := decoder.Decode(&trailingValue); !errors.Is(err, io.EOF) {
		return nil, errors.New("decode managed configuration: trailing JSON data")
	}

	if document.Version != 1 {
		return nil, fmt.Errorf("unsupported managed configuration version: %d", document.Version)
	}

	if document.Settings == nil {
		document.Settings = map[string]ManagedValue{}
	}

	for key, managedValue := range document.Settings {
		if managedValue.Mode != ManagedModeSeed && managedValue.Mode != ManagedModeLock {
			return nil, fmt.Errorf("setting %s has unsupported mode %q", key, managedValue.Mode)
		}

		canonicalValue, validationError := registry.Validate(key, managedValue.Value)
		if validationError != nil {
			return nil, fmt.Errorf("setting %s: %w", key, validationError)
		}

		managedValue.Value = canonicalValue
		document.Settings[key] = managedValue
	}

	return &document, nil
}
