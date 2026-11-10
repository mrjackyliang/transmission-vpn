package provider

import (
	"encoding/base64"
	"errors"
	"fmt"
	"net/netip"
	"strings"
)

const (
	maximumTextCredentialLength     = 512
	maximumPasswordCredentialLength = 2048
)

// credentialValidationError keeps one provider field attached to its safe message.
//
// API callers use the field key for validation issues without parsing messages or
// exposing the submitted credential value.
//
// Since: 2.0.0
type credentialValidationError struct {
	field   string
	message string
}

// Error returns the safe credential validation message.
//
// Since: 2.0.0
func (validationError *credentialValidationError) Error() string {
	return validationError.message
}

// CredentialErrorField returns the provider field named by a validation error.
//
// HTTP boundaries use this metadata to place safe credential messages beside the
// matching input while unrelated provider failures remain form-level errors.
//
// Since: 2.0.0
func CredentialErrorField(err error) (string, bool) {
	var validationError *credentialValidationError
	if !errors.As(err, &validationError) {
		return "", false
	}

	return validationError.field, true
}

// ValidateCredentials checks submitted credential values against one tunnel's fields.
//
// Unknown keys are rejected because JSON decoding can't, and error messages name the
// field without ever repeating the value, which may be a password or private key.
//
// Since: 2.0.0
func ValidateCredentials(tunnel TunnelDefinition, values map[string]string) error {
	fields := make(map[string]CredentialField, len(tunnel.CredentialFields))
	for _, field := range tunnel.CredentialFields {
		fields[field.Key] = field
	}
	for key := range values {
		if _, known := fields[key]; !known {
			return fmt.Errorf("the %s tunnel doesn't use the credential %q", tunnel.ID, credentialKeyForMessage(key))
		}
	}

	for _, field := range tunnel.CredentialFields {
		value := values[field.Key]
		if value == "" {
			if field.Required {
				return &credentialValidationError{
					field:   field.Key,
					message: fmt.Sprintf("%s is required.", field.Label),
				}
			}

			continue
		}
		if err := validateCredentialValue(field, value); err != nil {
			return &credentialValidationError{
				field:   field.Key,
				message: err.Error(),
			}
		}
	}

	return nil
}

// validateCredentialValue applies the rules for one field kind.
//
// Every kind rejects line breaks and NUL bytes, which could split the OpenVPN auth file
// or a WireGuard configuration line.
func validateCredentialValue(field CredentialField, value string) error {
	if strings.ContainsAny(value, "\r\n\x00") {
		return fmt.Errorf("%s contains unsupported characters", field.Label)
	}

	switch field.Kind {
	case CredentialKindText:
		if len(value) > maximumTextCredentialLength {
			return fmt.Errorf("%s must be at most %d characters", field.Label, maximumTextCredentialLength)
		}
	case CredentialKindPassword:
		if len(value) > maximumPasswordCredentialLength {
			return fmt.Errorf("%s must be at most %d characters", field.Label, maximumPasswordCredentialLength)
		}
	case CredentialKindWireGuardKey:
		if !validWireGuardKey(value) {
			return fmt.Errorf("%s must be a WireGuard key: 44 characters of base64 ending in =", field.Label)
		}
	case CredentialKindIPv4Address:
		if _, err := parseIPv4Prefix(value); err != nil {
			return fmt.Errorf("%s must be an IPv4 address such as 10.68.12.34/32", field.Label)
		}
	default:
		return fmt.Errorf("%s has an unsupported credential kind", field.Label)
	}

	return nil
}

// validWireGuardKey reports whether a value is a standard base64 32-byte key.
//
// WireGuard public, private, and preshared keys all share this encoding.
func validWireGuardKey(value string) bool {
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(value))
	if err != nil {
		return false
	}

	return len(decoded) == 32
}

// parseIPv4Prefix reads an IPv4 address with an optional prefix length.
//
// A bare address becomes a /32 host prefix, which is how WireGuard providers hand out
// tunnel addresses.
func parseIPv4Prefix(value string) (netip.Prefix, error) {
	value = strings.TrimSpace(value)
	if !strings.Contains(value, "/") {
		address, err := netip.ParseAddr(value)
		if err != nil || !address.Is4() {
			return netip.Prefix{}, errors.New("not an IPv4 address")
		}

		return netip.PrefixFrom(address, 32), nil
	}

	prefix, err := netip.ParsePrefix(value)
	if err != nil || !prefix.Addr().Is4() {
		return netip.Prefix{}, errors.New("not an IPv4 prefix")
	}

	return prefix, nil
}

// credentialKeyForMessage keeps an unknown key short and printable in an error.
//
// The key comes from the request body, so it is bounded before it reaches a message.
func credentialKeyForMessage(key string) string {
	if len(key) > 40 {
		return key[:40] + "…"
	}

	return key
}
