package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

const (
	installationKeyBytes      = 32
	installationKeyFileBytes  = installationKeyBytes*2 + 1
	installationKeyFolderMode = 0o700
	installationKeyMode       = 0o600
)

// LoadInstallationKey reads the appliance-local encryption key.
//
// A missing file is reported instead of created, so the caller can first remove what
// an old key sealed and only then save a new key with SaveInstallationKey.
//
// Since: 2.4.0
func LoadInstallationKey(path string) ([]byte, bool, error) {
	encodedKey, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, false, nil
	}

	if err != nil {
		return nil, false, fmt.Errorf("read installation key: %w", err)
	}

	if len(encodedKey) == installationKeyBytes {
		legacyKey, validationError := validateInstallationKey(encodedKey)
		if validationError != nil {
			return nil, false, validationError
		}
		if rewriteError := rewriteLegacyInstallationKey(path, legacyKey); rewriteError != nil {
			return nil, false, rewriteError
		}

		return legacyKey, true, nil
	}

	key, err := decodeInstallationKey(encodedKey)
	if err != nil {
		return nil, false, err
	}
	if err := protectInstallationKey(path); err != nil {
		return nil, false, err
	}

	return key, true, nil
}

// GenerateInstallationKey returns a new random AES-256 installation key.
func GenerateInstallationKey() ([]byte, error) {
	generatedKey := make([]byte, installationKeyBytes)
	if _, err := rand.Read(generatedKey); err != nil {
		return nil, fmt.Errorf("generate installation key: %w", err)
	}

	return generatedKey, nil
}

// SaveInstallationKey writes a new installation key beside application state.
//
// The file contains 64 lowercase hexadecimal characters plus a newline, uses mode 0600
// inside a 0700 folder, and never replaces an existing key.
//
// Since: 2.4.0
func SaveInstallationKey(path string, key []byte) error {
	if _, err := validateInstallationKey(key); err != nil {
		return err
	}

	if err := prepareInstallationKeyDirectory(filepath.Dir(path)); err != nil {
		return fmt.Errorf("create installation key directory: %w", err)
	}

	keyFile, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, installationKeyMode)
	if err != nil {
		return fmt.Errorf("create installation key: %w", err)
	}

	if err := keyFile.Chmod(installationKeyMode); err != nil {
		_ = keyFile.Close()
		_ = os.Remove(path)

		return fmt.Errorf("set installation key permissions: %w", err)
	}

	writeSucceeded := false
	defer func() {
		_ = keyFile.Close()
		if !writeSucceeded {
			_ = os.Remove(path)
		}
	}()

	if _, err := keyFile.Write(encodeInstallationKey(key)); err != nil {
		return fmt.Errorf("write installation key: %w", err)
	}

	if err := keyFile.Sync(); err != nil {
		return fmt.Errorf("sync installation key: %w", err)
	}

	if err := keyFile.Close(); err != nil {
		return fmt.Errorf("close installation key: %w", err)
	}

	writeSucceeded = true

	return nil
}

// decodeInstallationKey validates and decodes Nova's on-disk installation-key format.
//
// Since: 2.4.0
func decodeInstallationKey(encodedKey []byte) ([]byte, error) {
	if len(encodedKey) != installationKeyFileBytes || encodedKey[len(encodedKey)-1] != '\n' {
		return nil, fmt.Errorf(
			"installation key must contain exactly %d lowercase hexadecimal characters and a newline",
			installationKeyBytes*2,
		)
	}

	for _, character := range encodedKey[:len(encodedKey)-1] {
		if (character < '0' || character > '9') && (character < 'a' || character > 'f') {
			return nil, errors.New("installation key must contain only lowercase hexadecimal characters")
		}
	}

	key := make([]byte, installationKeyBytes)
	if _, err := hex.Decode(key, encodedKey[:len(encodedKey)-1]); err != nil {
		return nil, fmt.Errorf("decode installation key: %w", err)
	}

	return key, nil
}

// encodeInstallationKey serializes key bytes in Nova's portable text format.
//
// Since: 2.4.0
func encodeInstallationKey(key []byte) []byte {
	encodedKey := make([]byte, hex.EncodedLen(len(key))+1)
	hex.Encode(encodedKey, key)
	encodedKey[len(encodedKey)-1] = '\n'

	return encodedKey
}

// prepareInstallationKeyDirectory creates and protects the key folder.
//
// Since: 2.4.0
func prepareInstallationKeyDirectory(path string) error {
	if err := os.MkdirAll(path, installationKeyFolderMode); err != nil {
		return err
	}
	if err := os.Chmod(path, installationKeyFolderMode); err != nil {
		return fmt.Errorf("set installation key directory permissions: %w", err)
	}

	return nil
}

// protectInstallationKey restores the contract modes on an existing key and folder.
//
// Since: 2.4.0
func protectInstallationKey(path string) error {
	if err := prepareInstallationKeyDirectory(filepath.Dir(path)); err != nil {
		return err
	}
	if err := os.Chmod(path, installationKeyMode); err != nil {
		return fmt.Errorf("set installation key permissions: %w", err)
	}

	return nil
}

// rewriteLegacyInstallationKey atomically converts a raw 32-byte key without changing it.
//
// Since: 2.4.0
func rewriteLegacyInstallationKey(path string, key []byte) error {
	keyDirectory := filepath.Dir(path)
	if err := prepareInstallationKeyDirectory(keyDirectory); err != nil {
		return err
	}

	temporaryFile, err := os.CreateTemp(keyDirectory, ".installation-key-*")
	if err != nil {
		return fmt.Errorf("create converted installation key: %w", err)
	}
	temporaryPath := temporaryFile.Name()
	committed := false
	defer func() {
		_ = temporaryFile.Close()
		if !committed {
			_ = os.Remove(temporaryPath)
		}
	}()

	if err := temporaryFile.Chmod(installationKeyMode); err != nil {
		return fmt.Errorf("set converted installation key permissions: %w", err)
	}
	if _, err := temporaryFile.Write(encodeInstallationKey(key)); err != nil {
		return fmt.Errorf("write converted installation key: %w", err)
	}
	if err := temporaryFile.Sync(); err != nil {
		return fmt.Errorf("sync converted installation key: %w", err)
	}
	if err := temporaryFile.Close(); err != nil {
		return fmt.Errorf("close converted installation key: %w", err)
	}
	if err := os.Rename(temporaryPath, path); err != nil {
		return fmt.Errorf("publish converted installation key: %w", err)
	}

	committed = true

	return nil
}

// EncryptSecret encrypts one provider secret with authenticated AES-256-GCM.
//
// The logical secret key is included as associated data so ciphertext cannot be moved
// between credential fields without authentication failure.
func EncryptSecret(
	installationKey []byte,
	secretKey string,
	plaintext []byte,
) ([]byte, []byte, error) {
	authenticatedCipher, err := newAuthenticatedCipher(installationKey)
	if err != nil {
		return nil, nil, err
	}

	nonce := make([]byte, authenticatedCipher.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, fmt.Errorf("generate secret nonce: %w", err)
	}

	ciphertext := authenticatedCipher.Seal(nil, nonce, plaintext, []byte(secretKey))

	return nonce, ciphertext, nil
}

// DecryptSecret authenticates and decrypts one provider secret.
//
// Callers keep plaintext in memory only for the shortest provider-operation scope and
// never return it through a read API or log value.
func DecryptSecret(
	installationKey []byte,
	secretKey string,
	nonce []byte,
	ciphertext []byte,
) ([]byte, error) {
	authenticatedCipher, err := newAuthenticatedCipher(installationKey)
	if err != nil {
		return nil, err
	}

	if len(nonce) != authenticatedCipher.NonceSize() {
		return nil, errors.New("encrypted secret has an invalid nonce")
	}

	plaintext, err := authenticatedCipher.Open(
		nil,
		nonce,
		ciphertext,
		[]byte(secretKey),
	)
	if err != nil {
		return nil, errors.New("encrypted secret authentication failed")
	}

	return plaintext, nil
}

// validateInstallationKey enforces the exact AES-256 key size.
//
// Unexpected file contents fail startup rather than silently truncating or stretching
// key material and making existing encrypted state unrecoverable.
func validateInstallationKey(key []byte) ([]byte, error) {
	if len(key) != installationKeyBytes {
		return nil, fmt.Errorf(
			"installation key must contain exactly %d bytes",
			installationKeyBytes,
		)
	}

	return key, nil
}

// newAuthenticatedCipher constructs the AES-GCM primitive used for secret storage.
//
// Central construction keeps key validation and algorithm selection identical for
// encryption, decryption, backup, and future rotation flows.
func newAuthenticatedCipher(installationKey []byte) (cipher.AEAD, error) {
	if _, err := validateInstallationKey(installationKey); err != nil {
		return nil, err
	}

	blockCipher, err := aes.NewCipher(installationKey)
	if err != nil {
		return nil, fmt.Errorf("create secret cipher: %w", err)
	}

	authenticatedCipher, err := cipher.NewGCM(blockCipher)
	if err != nil {
		return nil, fmt.Errorf("create authenticated secret cipher: %w", err)
	}

	return authenticatedCipher, nil
}
