package provider

import (
	"bufio"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"path/filepath"
	"strconv"
	"strings"
	"unicode"
)

const maximumProfileBytes = 2 * 1024 * 1024

// Profile is one validated, normalized endpoint configuration for either tunnel.
//
// Profile content may contain private key material and must be encrypted before it is
// persisted or copied outside the provider validation boundary. Protocol is the
// transport (udp or tcp); Tunnel says whether the content is OpenVPN or WireGuard.
type Profile struct {
	ID            string `json:"id"`
	ProviderID    string `json:"providerId"`
	Tunnel        string `json:"tunnel"`
	DisplayName   string `json:"displayName"`
	CountryCode   string `json:"countryCode,omitempty"`
	Country       string `json:"country,omitempty"`
	City          string `json:"city,omitempty"`
	Continent     string `json:"continent,omitempty"`
	Protocol      string `json:"protocol"`
	RemoteHost    string `json:"remoteHost"`
	RemotePort    int    `json:"remotePort"`
	Fingerprint   string `json:"fingerprint"`
	Configuration []byte `json:"-"`
}

// NormalizedProfileMetadata contains controller-relevant data recovered from a profile.
//
// The privileged controller revalidates normalized content and compares this metadata
// with the typed command before invoking OpenVPN.
type NormalizedProfileMetadata struct {
	RemoteHost string
	RemotePort int
}

// NormalizeOpenVPNProfile validates and rewrites an uploaded OpenVPN profile.
//
// Only data-oriented client directives are retained. Executable hooks, proxies,
// route-bypass controls, external file paths, and management listeners fail closed.
func NormalizeOpenVPNProfile(
	providerID string,
	profileName string,
	content []byte,
) (Profile, error) {
	if len(content) == 0 {
		return Profile{}, errors.New("OpenVPN profile is empty")
	}

	if len(content) > maximumProfileBytes {
		return Profile{}, fmt.Errorf("OpenVPN profile exceeds %d bytes", maximumProfileBytes)
	}

	baseName := filepath.Base(profileName)
	if baseName == "." || baseName == "" || baseName != profileName {
		return Profile{}, errors.New("OpenVPN profile name must be a plain filename")
	}

	profileContent := strings.ReplaceAll(string(content), "\r\n", "\n")
	profileContent = strings.ReplaceAll(profileContent, "\r", "\n")
	scanner := bufio.NewScanner(strings.NewReader(profileContent))
	scanner.Buffer(make([]byte, 64*1024), maximumProfileBytes)

	retainedLines := []string{}
	inlineBlocks := []string{}
	currentBlockName := ""
	currentBlockLines := []string{}
	remoteHost := ""
	remotePort := 0
	protocol := "udp"
	hasTrustAnchor := false
	lineNumber := 0

	for scanner.Scan() {
		lineNumber++
		line := strings.TrimSpace(scanner.Text())

		if currentBlockName != "" {
			currentBlockLines = append(currentBlockLines, line)
			if line == "</"+currentBlockName+">" {
				inlineBlocks = append(inlineBlocks, strings.Join(currentBlockLines, "\n"))
				if currentBlockName == "ca" || currentBlockName == "tls-crypt" ||
					currentBlockName == "tls-auth" {
					hasTrustAnchor = true
				}
				currentBlockName = ""
				currentBlockLines = nil
			}
			continue
		}

		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, ";") {
			continue
		}

		if strings.HasPrefix(line, "<") && strings.HasSuffix(line, ">") &&
			!strings.HasPrefix(line, "</") {
			blockName := strings.TrimSuffix(strings.TrimPrefix(line, "<"), ">")
			if !allowedInlineBlock(blockName) {
				return Profile{}, fmt.Errorf("line %d: inline block %s is not allowed", lineNumber, blockName)
			}
			currentBlockName = blockName
			currentBlockLines = []string{line}
			continue
		}

		tokens, err := splitOpenVPNLine(line)
		if err != nil {
			return Profile{}, fmt.Errorf("line %d: %w", lineNumber, err)
		}
		if len(tokens) == 0 {
			continue
		}

		directive := strings.TrimPrefix(strings.ToLower(tokens[0]), "--")
		arguments := tokens[1:]
		if ignoredProviderDirective(providerID, directive, arguments) {
			continue
		}
		if reason, forbidden := forbiddenDirectiveReason(directive); forbidden {
			return Profile{}, fmt.Errorf("line %d: %s is not allowed: %s", lineNumber, directive, reason)
		}

		switch directive {
		case "client", "auth-nocache", "nobind", "persist-key", "persist-tun", "verb":
			continue
		case "auth-user-pass":
			if len(arguments) > 1 {
				return Profile{}, fmt.Errorf("line %d: auth-user-pass has too many arguments", lineNumber)
			}
			continue
		case "dev":
			if len(arguments) != 1 || (arguments[0] != "tun" && arguments[0] != "tun0") {
				return Profile{}, fmt.Errorf("line %d: only a tun device is supported", lineNumber)
			}
			continue
		case "compress", "comp-lzo", "allow-compression", "block-outside-dns":
			continue
		case "proto":
			if len(arguments) != 1 || !allowedProtocol(arguments[0]) {
				return Profile{}, fmt.Errorf("line %d: unsupported OpenVPN protocol", lineNumber)
			}
			protocol = normalizeProtocol(arguments[0])
			retainedLines = append(retainedLines, canonicalDirective(directive, arguments))
		case "remote":
			validatedHost, validatedPort, validationError := validateRemote(arguments)
			if validationError != nil {
				return Profile{}, fmt.Errorf("line %d: %w", lineNumber, validationError)
			}
			if remoteHost == "" {
				remoteHost = validatedHost
				remotePort = validatedPort
			}
			retainedLines = append(retainedLines, canonicalDirective(directive, arguments))
		case "ca", "cert", "key", "pkcs12", "tls-auth", "tls-crypt", "tls-crypt-v2":
			return Profile{}, fmt.Errorf(
				"line %d: external file directive %s is not supported; use an inline block",
				lineNumber,
				directive,
			)
		case "peer-fingerprint":
			hasTrustAnchor = true
			retainedLines = append(retainedLines, canonicalDirective(directive, arguments))
		default:
			if !allowedDataDirective(directive) {
				return Profile{}, fmt.Errorf("line %d: unsupported directive %s", lineNumber, directive)
			}
			retainedLines = append(retainedLines, canonicalDirective(directive, arguments))
		}
	}

	if err := scanner.Err(); err != nil {
		return Profile{}, fmt.Errorf("read OpenVPN profile: %w", err)
	}

	if currentBlockName != "" {
		return Profile{}, fmt.Errorf("inline block %s is not closed", currentBlockName)
	}

	if remoteHost == "" {
		return Profile{}, errors.New("OpenVPN profile does not contain a remote endpoint")
	}

	if !hasTrustAnchor {
		return Profile{}, errors.New("OpenVPN profile does not contain a trusted CA or peer fingerprint")
	}

	normalizedLines := []string{
		"client",
		"dev tun0",
		"auth-user-pass /run/transmission-vpn/openvpn/auth",
		"auth-nocache",
		"nobind",
		"persist-key",
		"persist-tun",
		"allow-compression no",
		"verb 3",
	}
	normalizedLines = append(normalizedLines, retainedLines...)
	normalizedLines = append(normalizedLines, inlineBlocks...)
	normalizedContent := []byte(strings.Join(normalizedLines, "\n") + "\n")
	fingerprintBytes := sha256.Sum256(normalizedContent)
	fingerprint := hex.EncodeToString(fingerprintBytes[:])
	identifierName := strings.TrimSuffix(baseName, filepath.Ext(baseName))
	identifierName = normalizeIdentifier(identifierName)
	if identifierName == "" {
		identifierName = "endpoint"
	}

	return Profile{
		ID:            providerID + ":" + identifierName + ":" + fingerprint[0:12],
		ProviderID:    providerID,
		Tunnel:        TunnelOpenVPN,
		DisplayName:   strings.TrimSuffix(baseName, filepath.Ext(baseName)),
		Protocol:      protocol,
		RemoteHost:    remoteHost,
		RemotePort:    remotePort,
		Fingerprint:   fingerprint,
		Configuration: normalizedContent,
	}, nil
}

// NormalizeOpenVPNProfiles turns every remote directive into an ordered endpoint.
//
// A one-remote profile retains its existing identifier and normalized bytes. A
// multi-remote upload receives one self-contained profile per fallback candidate,
// so the controller can resolve and test each server independently.
func NormalizeOpenVPNProfiles(
	providerID string,
	profileName string,
	content []byte,
) ([]Profile, error) {
	profile, err := NormalizeOpenVPNProfile(providerID, profileName, content)
	if err != nil {
		return nil, err
	}

	type remote struct {
		host     string
		port     int
		protocol string
	}

	lines := strings.Split(strings.TrimSuffix(string(profile.Configuration), "\n"), "\n")
	remotes := []remote{}
	for _, line := range lines {
		tokens, splitError := splitOpenVPNLine(strings.TrimSpace(line))
		if splitError != nil || len(tokens) == 0 || strings.TrimPrefix(strings.ToLower(tokens[0]), "--") != "remote" {
			continue
		}
		host, port, validationError := validateRemote(tokens[1:])
		if validationError != nil {
			return nil, validationError
		}
		protocol := profile.Protocol
		if len(tokens) == 4 {
			protocol = normalizeProtocol(tokens[3])
		}
		remotes = append(remotes, remote{host: host, port: port, protocol: protocol})
	}
	if len(remotes) <= 1 {
		return []Profile{profile}, nil
	}

	baseName := filepath.Base(profileName)
	identifierName := normalizeIdentifier(strings.TrimSuffix(baseName, filepath.Ext(baseName)))
	if identifierName == "" {
		identifierName = "endpoint"
	}

	profiles := make([]Profile, 0, len(remotes))
	for selectedRemote, endpoint := range remotes {
		remoteIndex := 0
		selectedLines := make([]string, 0, len(lines)-len(remotes)+1)
		for _, line := range lines {
			tokens, splitError := splitOpenVPNLine(strings.TrimSpace(line))
			isRemote := splitError == nil && len(tokens) > 0 &&
				strings.TrimPrefix(strings.ToLower(tokens[0]), "--") == "remote"
			if !isRemote {
				selectedLines = append(selectedLines, line)
				continue
			}
			if remoteIndex == selectedRemote {
				selectedLines = append(selectedLines, line)
			}
			remoteIndex++
		}

		normalizedContent := []byte(strings.Join(selectedLines, "\n") + "\n")
		fingerprintBytes := sha256.Sum256(normalizedContent)
		fingerprint := hex.EncodeToString(fingerprintBytes[:])
		profiles = append(profiles, Profile{
			ID:            fmt.Sprintf("%s:%s-%d:%s", providerID, identifierName, selectedRemote+1, fingerprint[0:12]),
			ProviderID:    providerID,
			Tunnel:        TunnelOpenVPN,
			DisplayName:   fmt.Sprintf("%s (%d)", profile.DisplayName, selectedRemote+1),
			Protocol:      endpoint.protocol,
			RemoteHost:    endpoint.host,
			RemotePort:    endpoint.port,
			Fingerprint:   fingerprint,
			Configuration: normalizedContent,
		})
	}
	clear(profile.Configuration)

	return profiles, nil
}

// ignoredProviderDirective identifies catalog-only options the controller replaces.
//
// Exceptions remain scoped to a provider and exact directive shape so custom uploads
// retain the strict generic boundary and cannot smuggle executable behavior.
func ignoredProviderDirective(
	providerID string,
	directive string,
	arguments []string,
) bool {
	switch providerID {
	case "purevpn":
		switch directive {
		case "route", "route-delay", "route-method", "script-security":
			return true
		}
	case "pia":
		return directive == "disable-occ" && len(arguments) == 0
	case "ipvanish":
		return directive == "setenv" && len(arguments) == 2 &&
			strings.EqualFold(arguments[0], "CLIENT_CERT") && arguments[1] == "0"
	case "nordvpn":
		return directive == "ping-timer-rem" && len(arguments) == 0
	}

	return false
}

// ValidateNormalizedOpenVPNProfile rechecks the exact controller input contract.
//
// This defense-in-depth pass accepts only directives the normalizer can emit, verifies
// forced safety options, and returns the first remote endpoint for command comparison.
func ValidateNormalizedOpenVPNProfile(content []byte) (NormalizedProfileMetadata, error) {
	if len(content) == 0 || len(content) > maximumProfileBytes {
		return NormalizedProfileMetadata{}, errors.New("normalized OpenVPN profile has an invalid size")
	}

	scanner := bufio.NewScanner(bytes.NewReader(content))
	scanner.Buffer(make([]byte, 64*1024), maximumProfileBytes)
	currentBlockName := ""
	hasDevice := false
	hasAuthenticationPath := false
	hasCompressionBlock := false
	hasTrustAnchor := false
	metadata := NormalizedProfileMetadata{}
	lineNumber := 0

	for scanner.Scan() {
		lineNumber++
		line := strings.TrimSpace(scanner.Text())
		if currentBlockName != "" {
			if line == "</"+currentBlockName+">" {
				currentBlockName = ""
			}
			continue
		}

		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, ";") {
			continue
		}

		if strings.HasPrefix(line, "<") && strings.HasSuffix(line, ">") &&
			!strings.HasPrefix(line, "</") {
			blockName := strings.TrimSuffix(strings.TrimPrefix(line, "<"), ">")
			if !allowedInlineBlock(blockName) {
				return NormalizedProfileMetadata{}, fmt.Errorf(
					"line %d: inline block %s is not allowed",
					lineNumber,
					blockName,
				)
			}
			if blockName == "ca" || blockName == "tls-auth" || blockName == "tls-crypt" {
				hasTrustAnchor = true
			}
			currentBlockName = blockName
			continue
		}

		tokens, err := splitOpenVPNLine(line)
		if err != nil || len(tokens) == 0 {
			return NormalizedProfileMetadata{}, fmt.Errorf("line %d: normalized directive is invalid", lineNumber)
		}

		directive := strings.TrimPrefix(strings.ToLower(tokens[0]), "--")
		arguments := tokens[1:]
		if _, forbidden := forbiddenDirectiveReason(directive); forbidden {
			return NormalizedProfileMetadata{}, fmt.Errorf("line %d: directive %s is forbidden", lineNumber, directive)
		}

		switch directive {
		case "client", "auth-nocache", "nobind", "persist-key", "persist-tun", "verb":
		case "dev":
			hasDevice = len(arguments) == 1 && arguments[0] == "tun0"
			if !hasDevice {
				return NormalizedProfileMetadata{}, errors.New("normalized profile must use dev tun0")
			}
		case "auth-user-pass":
			hasAuthenticationPath = len(arguments) == 1 &&
				arguments[0] == "/run/transmission-vpn/openvpn/auth"
			if !hasAuthenticationPath {
				return NormalizedProfileMetadata{}, errors.New("normalized profile has an invalid authentication path")
			}
		case "allow-compression":
			hasCompressionBlock = len(arguments) == 1 && arguments[0] == "no"
			if !hasCompressionBlock {
				return NormalizedProfileMetadata{}, errors.New("normalized profile must disable compression")
			}
		case "remote":
			remoteHost, remotePort, validationError := validateRemote(arguments)
			if validationError != nil {
				return NormalizedProfileMetadata{}, validationError
			}
			if metadata.RemoteHost == "" {
				metadata.RemoteHost = remoteHost
				metadata.RemotePort = remotePort
			}
		case "proto", "peer-fingerprint":
			if directive == "peer-fingerprint" {
				hasTrustAnchor = true
			}
		case "ca", "cert", "key", "pkcs12", "tls-auth", "tls-crypt", "tls-crypt-v2":
			return NormalizedProfileMetadata{}, errors.New("normalized profile contains an external file path")
		default:
			if !allowedDataDirective(directive) {
				return NormalizedProfileMetadata{}, fmt.Errorf("line %d: unsupported directive %s", lineNumber, directive)
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return NormalizedProfileMetadata{}, fmt.Errorf("read normalized profile: %w", err)
	}

	if currentBlockName != "" || !hasDevice || !hasAuthenticationPath ||
		!hasCompressionBlock || !hasTrustAnchor || metadata.RemoteHost == "" {
		return NormalizedProfileMetadata{}, errors.New("normalized profile is missing required safety controls")
	}

	return metadata, nil
}

// allowedInlineBlock reports whether inline certificate material is data-only.
//
// Executable and arbitrary block names are rejected even though OpenVPN may ignore
// them, preventing hidden content from crossing the provider boundary.
func allowedInlineBlock(blockName string) bool {
	allowedBlocks := map[string]struct{}{
		"ca":           {},
		"cert":         {},
		"key":          {},
		"tls-auth":     {},
		"tls-crypt":    {},
		"tls-crypt-v2": {},
	}
	_, found := allowedBlocks[blockName]

	return found
}

// allowedDataDirective reports whether a directive is safe to preserve as data.
//
// The allowlist is intentionally narrower than OpenVPN's full option set and grows
// only when a provider profile demonstrates a safe need.
func allowedDataDirective(directive string) bool {
	allowedDirectives := map[string]struct{}{
		"auth":                   {},
		"auth-retry":             {},
		"cipher":                 {},
		"connect-retry":          {},
		"connect-retry-max":      {},
		"connect-timeout":        {},
		"data-ciphers":           {},
		"data-ciphers-fallback":  {},
		"explicit-exit-notify":   {},
		"fast-io":                {},
		"float":                  {},
		"fragment":               {},
		"hand-window":            {},
		"key-direction":          {},
		"link-mtu":               {},
		"mssfix":                 {},
		"mute-replay-warnings":   {},
		"peer-fingerprint":       {},
		"ping":                   {},
		"ping-exit":              {},
		"ping-restart":           {},
		"persist-remote-ip":      {},
		"pull":                   {},
		"rcvbuf":                 {},
		"redirect-gateway":       {},
		"remote-cert-tls":        {},
		"remote-random":          {},
		"remote-random-hostname": {},
		"reneg-sec":              {},
		"replay-window":          {},
		"resolv-retry":           {},
		"server-poll-timeout":    {},
		"sndbuf":                 {},
		"tls-cipher":             {},
		"tls-ciphersuites":       {},
		"tls-client":             {},
		"tls-version-min":        {},
		"tran-window":            {},
		"tun-mtu":                {},
		"verify-x509-name":       {},
	}
	_, found := allowedDirectives[directive]

	return found
}

// forbiddenDirectiveReason identifies options that cross a security boundary.
//
// Explicit reasons make profile validation errors actionable without encouraging users
// to weaken the global fail-closed policy.
func forbiddenDirectiveReason(directive string) (string, bool) {
	reasons := map[string]string{
		"auth-user-pass-verify": "credential verification hooks may execute programs",
		"daemon":                "s6 owns process supervision",
		"down":                  "provider profiles may not execute lifecycle programs",
		"down-pre":              "provider profiles may not execute lifecycle programs",
		"http-proxy":            "the appliance does not provide proxy routing",
		"ipchange":              "provider profiles may not execute lifecycle programs",
		"learn-address":         "provider profiles may not execute lifecycle programs",
		"log":                   "s6 owns service logging",
		"log-append":            "s6 owns service logging",
		"management":            "the controller owns the private management boundary",
		"plugin":                "provider profiles may not load executable plugins",
		"pull-filter":           "profiles may not remove protected routing directives",
		"route-noexec":          "profiles may not disable protected route installation",
		"route-nopull":          "profiles may not disable protected route installation",
		"route-up":              "provider profiles may not execute lifecycle programs",
		"script-security":       "provider profiles may not enable executable hooks",
		"setenv":                "provider profiles may not mutate the process environment",
		"socks-proxy":           "the appliance does not provide proxy routing",
		"status":                "the controller owns status output",
		"up":                    "provider profiles may not execute lifecycle programs",
		"up-restart":            "provider profiles may not execute lifecycle programs",
		"writepid":              "s6 owns process supervision",
	}
	reason, found := reasons[directive]

	return reason, found
}

// splitOpenVPNLine tokenizes one non-block profile line with quote awareness.
//
// It supports OpenVPN's common single quotes, double quotes, escapes, and comments
// without invoking a shell or interpreting substitutions.
func splitOpenVPNLine(line string) ([]string, error) {
	tokens := []string{}
	var currentToken strings.Builder
	quote := rune(0)
	escaped := false
	tokenStarted := false

	for _, character := range line {
		if escaped {
			currentToken.WriteRune(character)
			escaped = false
			tokenStarted = true
			continue
		}

		if character == '\\' {
			escaped = true
			tokenStarted = true
			continue
		}

		if quote != 0 {
			if character == quote {
				quote = 0
			} else {
				currentToken.WriteRune(character)
			}
			continue
		}

		if character == '\'' || character == '"' {
			quote = character
			tokenStarted = true
			continue
		}

		if (character == '#' || character == ';') && !tokenStarted {
			break
		}

		if unicode.IsSpace(character) {
			if tokenStarted {
				tokens = append(tokens, currentToken.String())
				currentToken.Reset()
				tokenStarted = false
			}
			continue
		}

		currentToken.WriteRune(character)
		tokenStarted = true
	}

	if escaped || quote != 0 {
		return nil, errors.New("unterminated escape or quote")
	}

	if tokenStarted {
		tokens = append(tokens, currentToken.String())
	}

	return tokens, nil
}

// allowedProtocol checks the tunnel transports supported by the initial controller.
//
// IPv6-only transports remain unavailable until equivalent IPv6 leak protection is
// implemented and verified.
func allowedProtocol(protocol string) bool {
	switch strings.ToLower(protocol) {
	case "udp", "udp4", "tcp", "tcp-client", "tcp4-client":
		return true
	default:
		return false
	}
}

// normalizeProtocol reduces OpenVPN aliases to the UI's stable protocol vocabulary.
//
// The original safe directive stays in the normalized profile while metadata uses only
// udp or tcp for filtering.
func normalizeProtocol(protocol string) string {
	if strings.HasPrefix(strings.ToLower(protocol), "tcp") {
		return "tcp"
	}

	return "udp"
}

// validateRemote validates one OpenVPN endpoint without performing DNS resolution.
//
// Resolution belongs to the controller immediately before connection so firewall and
// diagnostics use current addresses rather than stale catalog data.
func validateRemote(arguments []string) (string, int, error) {
	if len(arguments) < 2 || len(arguments) > 3 {
		return "", 0, errors.New("remote requires a host, port, and optional protocol")
	}

	host := strings.TrimSpace(arguments[0])
	if len(host) == 0 || len(host) > 253 || !validRemoteHost(host) {
		return "", 0, errors.New("remote host is invalid")
	}

	port, err := strconv.Atoi(arguments[1])
	if err != nil || port < 1 || port > 65535 {
		return "", 0, errors.New("remote port must be between 1 and 65535")
	}

	if len(arguments) == 3 && !allowedProtocol(arguments[2]) {
		return "", 0, errors.New("remote protocol is unsupported")
	}

	return host, port, nil
}

// validRemoteHost accepts an IP address or conservative DNS hostname.
//
// URL syntax, whitespace, and shell punctuation are rejected before OpenVPN sees the
// normalized configuration.
func validRemoteHost(host string) bool {
	if net.ParseIP(host) != nil {
		return true
	}

	labels := strings.Split(host, ".")
	for _, label := range labels {
		if label == "" || len(label) > 63 || strings.HasPrefix(label, "-") ||
			strings.HasSuffix(label, "-") {
			return false
		}

		for _, character := range label {
			if !(character >= 'a' && character <= 'z') &&
				!(character >= 'A' && character <= 'Z') &&
				!(character >= '0' && character <= '9') && character != '-' {
				return false
			}
		}
	}

	return true
}

// canonicalDirective serializes validated tokens without executable interpretation.
//
// Tokens containing whitespace are quoted and escaped using OpenVPN-compatible double
// quotes so normalization retains their data value.
func canonicalDirective(directive string, arguments []string) string {
	serializedArguments := make([]string, 0, len(arguments))
	for _, argument := range arguments {
		if strings.IndexFunc(argument, unicode.IsSpace) >= 0 || strings.ContainsAny(argument, `"'\\`) {
			escapedArgument := strings.ReplaceAll(argument, `\`, `\\`)
			escapedArgument = strings.ReplaceAll(escapedArgument, `"`, `\"`)
			serializedArguments = append(serializedArguments, `"`+escapedArgument+`"`)
		} else {
			serializedArguments = append(serializedArguments, argument)
		}
	}

	if len(serializedArguments) == 0 {
		return directive
	}

	return directive + " " + strings.Join(serializedArguments, " ")
}

// normalizeIdentifier converts a profile filename into a stable safe identifier.
//
// Provider IDs remain searchable while punctuation outside the shared adapter contract
// is collapsed instead of entering paths or socket commands.
func normalizeIdentifier(value string) string {
	var normalized strings.Builder
	lastWasSeparator := false
	for _, character := range strings.ToLower(value) {
		if (character >= 'a' && character <= 'z') ||
			(character >= '0' && character <= '9') {
			normalized.WriteRune(character)
			lastWasSeparator = false
		} else if !lastWasSeparator {
			normalized.WriteRune('-')
			lastWasSeparator = true
		}
	}

	return strings.Trim(normalized.String(), "-")
}
