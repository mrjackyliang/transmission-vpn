package security

import (
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1" //nolint:gosec // RFC 6238 TOTP is defined over HMAC-SHA1 and every authenticator app expects it.
	"encoding/base32"
	"encoding/base64"
	"encoding/binary"
	"fmt"
	"net/url"
	"strings"
	"time"

	"rsc.io/qr"
)

const (
	totpPeriod      = 30 * time.Second
	totpDigits      = 6
	totpSecretBytes = 20
)

var totpEncoding = base32.StdEncoding.WithPadding(base32.NoPadding)

// NewTOTPSecret generates a 160-bit authenticator secret as unpadded base32.
//
// Base32 is the encoding authenticator apps accept when the secret is typed by hand.
func NewTOTPSecret() (string, error) {
	secret := make([]byte, totpSecretBytes)
	if _, err := rand.Read(secret); err != nil {
		return "", fmt.Errorf("generate authenticator secret: %w", err)
	}

	return totpEncoding.EncodeToString(secret), nil
}

// TOTPStep returns the 30-second time step containing an instant.
func TOTPStep(instant time.Time) int64 {
	return instant.Unix() / int64(totpPeriod.Seconds())
}

// TOTPCode computes the 6-digit code for one time step (RFC 6238 with HMAC-SHA1).
func TOTPCode(secret string, step int64) (string, error) {
	key, err := totpEncoding.DecodeString(strings.ToUpper(secret))
	if err != nil {
		return "", fmt.Errorf("decode authenticator secret: %w", err)
	}

	counter := make([]byte, 8)
	binary.BigEndian.PutUint64(counter, uint64(step))

	mac := hmac.New(sha1.New, key)
	_, _ = mac.Write(counter)
	sum := mac.Sum(nil)

	offset := sum[len(sum)-1] & 0x0f
	value := binary.BigEndian.Uint32(sum[offset:offset+4]) & 0x7fffffff

	return fmt.Sprintf("%0*d", totpDigits, value%1000000), nil
}

// VerifyTOTP checks a code against the current step and one step either side.
//
// It returns the matching step so callers can reject any code at or before the last
// accepted step, which stops a captured code from being replayed.
func VerifyTOTP(secret string, code string, now time.Time, lastAcceptedStep int64) (int64, bool) {
	code = strings.TrimSpace(code)
	if len(code) != totpDigits {
		return 0, false
	}

	current := TOTPStep(now)
	for _, step := range []int64{current - 1, current, current + 1} {
		if step <= lastAcceptedStep {
			continue
		}

		expected, err := TOTPCode(secret, step)
		if err != nil {
			return 0, false
		}

		if hmac.Equal([]byte(expected), []byte(code)) {
			return step, true
		}
	}

	return 0, false
}

// TOTPURI builds the otpauth:// URI that authenticator apps import from a QR code.
func TOTPURI(issuer string, account string, secret string) string {
	label := url.PathEscape(issuer) + ":" + url.PathEscape(account)
	query := url.Values{}
	query.Set("secret", secret)
	query.Set("issuer", issuer)
	query.Set("algorithm", "SHA1")
	query.Set("digits", fmt.Sprint(totpDigits))
	query.Set("period", fmt.Sprint(int(totpPeriod.Seconds())))

	return "otpauth://totp/" + label + "?" + query.Encode()
}

// QRCodeDataURI renders text as a QR code SVG data URI.
//
// The page's content security policy allows data: images, so the code renders with no
// client-side QR library and the secret never leaves this response.
func QRCodeDataURI(text string) (string, error) {
	code, err := qr.Encode(text, qr.M)
	if err != nil {
		return "", fmt.Errorf("encode QR code: %w", err)
	}

	const quietZone = 4
	size := code.Size + quietZone*2

	var path bytes.Buffer
	for y := 0; y < code.Size; y++ {
		for x := 0; x < code.Size; x++ {
			if code.Black(x, y) {
				fmt.Fprintf(&path, "M%d %dh1v1h-1z", x+quietZone, y+quietZone)
			}
		}
	}

	svg := fmt.Sprintf(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" shape-rendering="crispEdges"><rect width="100%%" height="100%%" fill="#fff"/><path fill="#000" d="%s"/></svg>`,
		size,
		size,
		path.String(),
	)

	return "data:image/svg+xml;base64," + base64.StdEncoding.EncodeToString([]byte(svg)), nil
}

// NewRecoveryCodes generates single-use recovery codes such as K7Q2M-XR9TD.
//
// The alphabet skips look-alike characters so codes copied from paper still work.
func NewRecoveryCodes(count int) ([]string, error) {
	const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

	codes := make([]string, 0, count)
	for len(codes) < count {
		randomBytes := make([]byte, 10)
		if _, err := rand.Read(randomBytes); err != nil {
			return nil, fmt.Errorf("generate recovery code: %w", err)
		}

		characters := make([]byte, len(randomBytes))
		for index, randomByte := range randomBytes {
			characters[index] = alphabet[int(randomByte)%len(alphabet)]
		}

		codes = append(codes, string(characters[0:5])+"-"+string(characters[5:10]))
	}

	return codes, nil
}

// NormalizeRecoveryCode upper-cases a typed recovery code and drops spaces and dashes,
// so "k7q2m xr9td" matches K7Q2M-XR9TD before hashing.
func NormalizeRecoveryCode(code string) string {
	var normalized strings.Builder
	for _, character := range strings.ToUpper(code) {
		if character == ' ' || character == '-' {
			continue
		}

		normalized.WriteRune(character)
	}

	return normalized.String()
}
