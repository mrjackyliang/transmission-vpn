package security

import (
	"bytes"
	"context"
	"encoding/hex"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// TestPasswordHashRoundTrip verifies correct and incorrect administrator passwords.
//
// The persisted verifier must authenticate the original password without accepting a
// nearby value or exposing deterministic hashes.
func TestPasswordHashRoundTrip(testingObject *testing.T) {
	encodedHash, err := HashPassword("this is a sufficiently long password")
	if err != nil {
		testingObject.Fatalf("hash password: %v", err)
	}

	valid, err := VerifyPassword("this is a sufficiently long password", encodedHash)
	if err != nil {
		testingObject.Fatalf("verify password: %v", err)
	}
	if !valid {
		testingObject.Fatal("correct password was rejected")
	}

	valid, err = VerifyPassword("this is a different long password", encodedHash)
	if err != nil {
		testingObject.Fatalf("verify incorrect password: %v", err)
	}
	if valid {
		testingObject.Fatal("incorrect password was accepted")
	}
}

// TestPasswordVerificationLimitHonorsCancellation bounds queued Argon2id checks.
//
// Both process slots are occupied deliberately so a third request must stop at its
// context deadline without starting another memory-intensive derivation.
func TestPasswordVerificationLimitHonorsCancellation(testingObject *testing.T) {
	if len(passwordVerificationSlots) != 0 {
		testingObject.Fatalf("password verification slots already occupied = %d", len(passwordVerificationSlots))
	}

	for range maximumConcurrentPasswordVerifications {
		passwordVerificationSlots <- struct{}{}
	}
	testingObject.Cleanup(func() {
		for range maximumConcurrentPasswordVerifications {
			<-passwordVerificationSlots
		}
	})

	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Millisecond)
	defer cancel()

	startedAt := time.Now()
	valid, err := VerifyPasswordContext(ctx, "password", "unused while waiting")
	if valid || !errors.Is(err, context.DeadlineExceeded) {
		testingObject.Fatalf("queued verification = %t, %v", valid, err)
	}
	if elapsed := time.Since(startedAt); elapsed > 500*time.Millisecond {
		testingObject.Fatalf("queued verification canceled after %s", elapsed)
	}
	if occupied := len(passwordVerificationSlots); occupied != maximumConcurrentPasswordVerifications {
		testingObject.Fatalf("occupied verification slots = %d", occupied)
	}
}

// TestSecretEncryptionBindsLogicalKey verifies authenticated secret storage.
//
// Associated data prevents valid ciphertext for one provider field from being moved
// to another field and decrypted under the wrong meaning.
func TestSecretEncryptionBindsLogicalKey(testingObject *testing.T) {
	installationKey := bytes.Repeat([]byte{0x42}, installationKeyBytes)
	plaintext := []byte("provider-password")

	nonce, ciphertext, err := EncryptSecret(
		installationKey,
		"providers/purevpn/password",
		plaintext,
	)
	if err != nil {
		testingObject.Fatalf("encrypt secret: %v", err)
	}

	decryptedValue, err := DecryptSecret(
		installationKey,
		"providers/purevpn/password",
		nonce,
		ciphertext,
	)
	if err != nil {
		testingObject.Fatalf("decrypt secret: %v", err)
	}
	if !bytes.Equal(decryptedValue, plaintext) {
		testingObject.Fatalf("decrypted value differs: %q", decryptedValue)
	}

	if _, err := DecryptSecret(
		installationKey,
		"providers/purevpn/username",
		nonce,
		ciphertext,
	); err == nil {
		testingObject.Fatal("ciphertext decrypted under a different logical key")
	}
}

// TestInstallationKeyPersists verifies generated key reuse across restarts.
//
// Losing or silently replacing this key would make encrypted provider credentials
// unrecoverable even though the application database remained intact.
func TestInstallationKeyPersists(testingObject *testing.T) {
	keyDirectory := filepath.Join(testingObject.TempDir(), "keys")
	path := filepath.Join(keyDirectory, "installation.key")
	if _, found, err := LoadInstallationKey(path); err != nil || found {
		testingObject.Fatalf("missing key = found %v, error %v", found, err)
	}

	firstKey, err := GenerateInstallationKey()
	if err != nil {
		testingObject.Fatalf("generate installation key: %v", err)
	}

	if err := SaveInstallationKey(path, firstKey); err != nil {
		testingObject.Fatalf("save installation key: %v", err)
	}

	secondKey, found, err := LoadInstallationKey(path)
	if err != nil || !found {
		testingObject.Fatalf("reload installation key: found %v, error %v", found, err)
	}

	if !bytes.Equal(firstKey, secondKey) {
		testingObject.Fatal("installation key changed between loads")
	}

	if err := SaveInstallationKey(path, firstKey); err == nil {
		testingObject.Fatal("saving a key replaced an existing key file")
	}

	info, err := os.Stat(path)
	if err != nil {
		testingObject.Fatalf("inspect installation key: %v", err)
	}

	if info.Mode().Perm() != installationKeyMode {
		testingObject.Fatalf("installation key mode = %v", info.Mode().Perm())
	}

	directoryInfo, err := os.Stat(keyDirectory)
	if err != nil {
		testingObject.Fatalf("inspect installation key directory: %v", err)
	}
	if directoryInfo.Mode().Perm() != installationKeyFolderMode {
		testingObject.Fatalf("installation key directory mode = %v", directoryInfo.Mode().Perm())
	}

	encodedKey, err := os.ReadFile(path)
	if err != nil {
		testingObject.Fatalf("read encoded installation key: %v", err)
	}
	wantedEncoding := hex.EncodeToString(firstKey) + "\n"
	if string(encodedKey) != wantedEncoding {
		testingObject.Fatalf("installation key encoding = %q, want %q", encodedKey, wantedEncoding)
	}
}

// TestLoadInstallationKeyConvertsLegacyBytes preserves the exact encryption key while
// upgrading an old raw file to Nova's lowercase hexadecimal format and modes.
//
// Since: 2.4.0
func TestLoadInstallationKeyConvertsLegacyBytes(testingObject *testing.T) {
	keyDirectory := filepath.Join(testingObject.TempDir(), "keys")
	path := filepath.Join(keyDirectory, "installation.key")
	if err := os.MkdirAll(keyDirectory, 0o770); err != nil {
		testingObject.Fatalf("create legacy key directory: %v", err)
	}
	legacyKey := bytes.Repeat([]byte{0x5c}, installationKeyBytes)
	if err := os.WriteFile(path, legacyKey, 0o660); err != nil {
		testingObject.Fatalf("write legacy installation key: %v", err)
	}

	loadedKey, found, err := LoadInstallationKey(path)
	if err != nil || !found {
		testingObject.Fatalf("load legacy installation key: found %v, error %v", found, err)
	}
	if !bytes.Equal(loadedKey, legacyKey) {
		testingObject.Fatal("legacy installation key bytes changed during conversion")
	}

	encodedKey, err := os.ReadFile(path)
	if err != nil {
		testingObject.Fatalf("read converted installation key: %v", err)
	}
	if string(encodedKey) != hex.EncodeToString(legacyKey)+"\n" {
		testingObject.Fatalf("converted installation key = %q", encodedKey)
	}

	keyInfo, err := os.Stat(path)
	if err != nil {
		testingObject.Fatalf("inspect converted installation key: %v", err)
	}
	directoryInfo, err := os.Stat(keyDirectory)
	if err != nil {
		testingObject.Fatalf("inspect converted key directory: %v", err)
	}
	if keyInfo.Mode().Perm() != installationKeyMode || directoryInfo.Mode().Perm() != installationKeyFolderMode {
		testingObject.Fatalf(
			"converted key modes = %v and %v",
			keyInfo.Mode().Perm(),
			directoryInfo.Mode().Perm(),
		)
	}
}

// TestLoadInstallationKeyRejectsInvalidText fails closed on uppercase and malformed keys.
//
// Since: 2.4.0
func TestLoadInstallationKeyRejectsInvalidText(testingObject *testing.T) {
	for _, content := range []string{
		strings.Repeat("A", installationKeyBytes*2) + "\n",
		strings.Repeat("a", installationKeyBytes*2),
		strings.Repeat("g", installationKeyBytes*2) + "\n",
	} {
		testingObject.Run(content[:1], func(testingObject *testing.T) {
			path := filepath.Join(testingObject.TempDir(), "installation.key")
			if err := os.WriteFile(path, []byte(content), installationKeyMode); err != nil {
				testingObject.Fatalf("write invalid installation key: %v", err)
			}
			if _, _, err := LoadInstallationKey(path); err == nil {
				testingObject.Fatal("invalid installation key was accepted")
			}
		})
	}
}

// TestNormalizeClaimCode accepts a generated code typed loosely and leaves anything
// else, such as a mounted claim secret, exactly as entered.
func TestNormalizeClaimCode(testingObject *testing.T) {
	for _, typed := range []string{"ABCDE-FGHJK-LMNPQ", "abcde-fghjk-lmnpq", " abcde fghjk lmnpq ", "ABCDEFGHJKLMNPQ"} {
		if normalized := NormalizeClaimCode(typed); normalized != "ABCDE-FGHJK-LMNPQ" {
			testingObject.Fatalf("NormalizeClaimCode(%q) = %q", typed, normalized)
		}
	}

	for _, secret := range []string{"a-mounted-claim-secret", "ABCDE-23456-FGHIJ", "abcde-fghjk-lmnp"} {
		if normalized := NormalizeClaimCode(secret); normalized != secret {
			testingObject.Fatalf("NormalizeClaimCode(%q) changed it to %q", secret, normalized)
		}
	}
}
