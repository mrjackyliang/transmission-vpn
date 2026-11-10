package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

const installationKeyBytes = 32

// LoadInstallationKey reads the appliance-local encryption key.
//
// A missing file is reported instead of created, so the caller can first remove what
// an old key sealed and only then save a new key with SaveInstallationKey.
func LoadInstallationKey(path string) ([]byte, bool, error) {
	key, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, false, nil
	}

	if err != nil {
		return nil, false, fmt.Errorf("read installation key: %w", err)
	}

	validatedKey, err := validateInstallationKey(key)
	if err != nil {
		return nil, false, err
	}

	return validatedKey, true, nil
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
// The file is created with mode 0660 for the PUID:PGID group the console shares, and it
// never replaces an existing key, so a key that appeared in the meantime stops startup
// instead of being overwritten.
func SaveInstallationKey(path string, key []byte) error {
	if _, err := validateInstallationKey(key); err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o770); err != nil {
		return fmt.Errorf("create installation key directory: %w", err)
	}

	keyFile, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o660)
	if err != nil {
		return fmt.Errorf("create installation key: %w", err)
	}

	if err := keyFile.Chmod(0o660); err != nil {
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

	if _, err := keyFile.Write(key); err != nil {
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
