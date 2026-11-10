package security

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"golang.org/x/crypto/argon2"
)

const (
	passwordMemoryKiB                      uint32 = 64 * 1024
	passwordPasses                         uint32 = 3
	passwordThreads                        uint8  = 2
	passwordSaltBytes                             = 16
	passwordHashBytes                             = 32
	maximumConcurrentPasswordVerifications        = 2
)

// passwordVerificationSlots bounds the process-wide Argon2id working set.
//
// Administrator and web-proxy authentication share these slots so concurrent
// requests cannot multiply the 64 MiB verification cost without limit.
var passwordVerificationSlots = make(chan struct{}, maximumConcurrentPasswordVerifications)

// NewOpaqueToken generates a URL-safe credential and its one-way digest.
//
// Callers return the plaintext once and persist only the digest, limiting the impact
// of a copied application database.
func NewOpaqueToken(prefix string, byteLength int) (string, []byte, error) {
	if byteLength < 16 {
		return "", nil, errors.New("opaque tokens require at least 16 random bytes")
	}

	randomBytes := make([]byte, byteLength)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", nil, fmt.Errorf("generate random credential: %w", err)
	}

	plaintext := prefix + base64.RawURLEncoding.EncodeToString(randomBytes)

	return plaintext, Digest(plaintext), nil
}

// NewIdentifier generates a short non-secret stable identifier.
//
// Session and API-token records use identifiers for revocation and logs while their
// independent plaintext credentials remain unrecorded.
func NewIdentifier() (string, error) {
	randomBytes := make([]byte, 12)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", fmt.Errorf("generate identifier: %w", err)
	}

	return base64.RawURLEncoding.EncodeToString(randomBytes), nil
}

// claimAlphabet leaves out characters that are easy to confuse, such as 0 and O.
const claimAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

// NewClaimCode generates a readable one-time installation claim code.
//
// Ambiguous characters are omitted so copying the code from container logs is less
// error-prone without reducing it below a strong random setup credential.
func NewClaimCode() (string, error) {
	const alphabet = claimAlphabet

	randomBytes := make([]byte, 15)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", fmt.Errorf("generate setup claim: %w", err)
	}

	characters := make([]byte, len(randomBytes))
	for index, randomByte := range randomBytes {
		characters[index] = alphabet[int(randomByte)%len(alphabet)]
	}

	return string(characters[0:5]) + "-" +
		string(characters[5:10]) + "-" +
		string(characters[10:15]), nil
}

// NormalizeClaimCode accepts a generated claim code typed in any letter case, with
// spaces, or without its dashes, and returns the printed XXXXX-XXXXX-XXXXX form.
// Anything else, such as a mounted claim secret, comes back unchanged.
func NormalizeClaimCode(input string) string {
	cleaned := strings.ToUpper(strings.ReplaceAll(strings.Join(strings.Fields(input), ""), "-", ""))
	if len(cleaned) != 15 || strings.Trim(cleaned, claimAlphabet) != "" {
		return input
	}

	return cleaned[0:5] + "-" + cleaned[5:10] + "-" + cleaned[10:15]
}

// Digest creates the fixed-size one-way representation used for credentials.
//
// Random high-entropy session and token values do not require password hashing, while
// SHA-256 enables indexed lookup without storing a reusable credential.
func Digest(plaintext string) []byte {
	digest := sha256.Sum256([]byte(plaintext))

	return digest[:]
}

// DigestsEqual performs constant-time comparison of two credential digests.
//
// Authentication paths use this helper where a digest has already been retrieved by
// a non-secret record identifier.
func DigestsEqual(leftDigest []byte, rightDigest []byte) bool {
	return subtle.ConstantTimeCompare(leftDigest, rightDigest) == 1
}

// HashPassword derives an Argon2id password verifier with fresh random salt.
//
// The encoded parameters travel with each verifier so future upgrades can recognize
// older costs without storing plaintext administrator passwords.
func HashPassword(password string) (string, error) {
	salt := make([]byte, passwordSaltBytes)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("generate password salt: %w", err)
	}

	hash := argon2.IDKey(
		[]byte(password),
		salt,
		passwordPasses,
		passwordMemoryKiB,
		passwordThreads,
		passwordHashBytes,
	)

	return fmt.Sprintf(
		"$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version,
		passwordMemoryKiB,
		passwordPasses,
		passwordThreads,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(hash),
	), nil
}

// VerifyPassword compares a password with an encoded Argon2id verifier.
//
// Callers without a cancellation boundary still share the process-wide verification
// limit. Request handlers should use VerifyPasswordContext while they wait for a slot.
//
// Since: 2.0.0
func VerifyPassword(password string, encodedHash string) (bool, error) {
	return VerifyPasswordContext(context.Background(), password, encodedHash)
}

// VerifyPasswordContext compares a password after reserving one Argon2id work slot.
//
// A canceled request stops waiting before it allocates the verifier's working memory,
// while an admitted derivation runs to completion and releases its slot.
//
// Since: 2.0.0
func VerifyPasswordContext(
	ctx context.Context,
	password string,
	encodedHash string,
) (bool, error) {
	select {
	case passwordVerificationSlots <- struct{}{}:
		defer func() { <-passwordVerificationSlots }()
	case <-ctx.Done():
		return false, ctx.Err()
	}

	return verifyPassword(password, encodedHash)
}

// verifyPassword performs one admitted Argon2id comparison.
//
// Keeping parsing and derivation behind VerifyPasswordContext ensures every public
// password check observes the same process-wide memory bound.
func verifyPassword(password string, encodedHash string) (bool, error) {
	parts := strings.Split(encodedHash, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return false, errors.New("password hash has an unsupported format")
	}

	versionText, found := strings.CutPrefix(parts[2], "v=")
	if !found {
		return false, errors.New("password hash is missing its version")
	}

	version, err := strconv.ParseInt(versionText, 10, 32)
	if err != nil || version != int64(argon2.Version) {
		return false, errors.New("password hash uses an unsupported Argon2 version")
	}

	var memory uint32
	var passes uint32
	var threads uint8
	if _, err := fmt.Sscanf(
		parts[3],
		"m=%d,t=%d,p=%d",
		&memory,
		&passes,
		&threads,
	); err != nil {
		return false, errors.New("password hash has invalid parameters")
	}

	if memory < 8*1024 || memory > 1024*1024 || passes < 1 || passes > 20 ||
		threads < 1 || threads > 32 {
		return false, errors.New("password hash parameters are outside safe bounds")
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil || len(salt) < 16 || len(salt) > 64 {
		return false, errors.New("password hash has an invalid salt")
	}

	expectedHash, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil || len(expectedHash) < 16 || len(expectedHash) > 64 {
		return false, errors.New("password hash has an invalid verifier")
	}

	actualHash := argon2.IDKey(
		[]byte(password),
		salt,
		passes,
		memory,
		threads,
		uint32(len(expectedHash)),
	)

	return subtle.ConstantTimeCompare(actualHash, expectedHash) == 1, nil
}
