package security

import (
	"strings"
	"testing"
	"time"
)

// TestTOTPMatchesRFC6238Vectors uses the SHA-1 test vectors from RFC 6238 appendix B,
// truncated to the 6 digits authenticator apps display.
func TestTOTPMatchesRFC6238Vectors(t *testing.T) {
	secret := totpEncoding.EncodeToString([]byte("12345678901234567890"))
	vectors := map[int64]string{
		59:          "287082",
		1111111109:  "081804",
		1111111111:  "050471",
		1234567890:  "005924",
		2000000000:  "279037",
		20000000000: "353130",
	}

	for unixTime, want := range vectors {
		got, err := TOTPCode(secret, TOTPStep(time.Unix(unixTime, 0)))
		if err != nil {
			t.Fatalf("TOTPCode(%d) failed: %v", unixTime, err)
		}

		if got != want {
			t.Fatalf("TOTPCode(%d) = %s, want %s", unixTime, got, want)
		}
	}
}

func TestVerifyTOTPAllowsDriftAndRejectsReplay(t *testing.T) {
	secret, err := NewTOTPSecret()
	if err != nil {
		t.Fatal(err)
	}

	now := time.Unix(1_800_000_000, 0)
	previous, _ := TOTPCode(secret, TOTPStep(now)-1)

	step, ok := VerifyTOTP(secret, previous, now, 0)
	if !ok || step != TOTPStep(now)-1 {
		t.Fatal("a code from the previous 30-second step should be accepted")
	}

	if _, ok := VerifyTOTP(secret, previous, now, step); ok {
		t.Fatal("an already-used code must not be accepted again")
	}

	stale, _ := TOTPCode(secret, TOTPStep(now)-3)
	if _, ok := VerifyTOTP(secret, stale, now, 0); ok {
		t.Fatal("a code from 90 seconds ago must be rejected")
	}

	if _, ok := VerifyTOTP(secret, "12345", now, 0); ok {
		t.Fatal("a 5-digit code must be rejected")
	}
}

func TestRecoveryCodesAndQRCode(t *testing.T) {
	codes, err := NewRecoveryCodes(10)
	if err != nil || len(codes) != 10 {
		t.Fatalf("NewRecoveryCodes = %v, %v", codes, err)
	}

	if len(codes[0]) != 11 || codes[0][5] != '-' {
		t.Fatalf("unexpected recovery code format %q", codes[0])
	}

	if NormalizeRecoveryCode(" k7q2m-xr9td ") != "K7Q2MXR9TD" {
		t.Fatal("recovery codes should normalize case, spaces and dashes")
	}

	uri := TOTPURI("Transmission VPN", "admin", "JBSWY3DPEHPK3PXP")
	if !strings.HasPrefix(uri, "otpauth://totp/Transmission%20VPN:admin?") || !strings.Contains(uri, "secret=JBSWY3DPEHPK3PXP") {
		t.Fatalf("unexpected otpauth URI %q", uri)
	}

	image, err := QRCodeDataURI(uri)
	if err != nil || !strings.HasPrefix(image, "data:image/svg+xml;base64,") {
		t.Fatalf("QRCodeDataURI = %.40q, %v", image, err)
	}
}
