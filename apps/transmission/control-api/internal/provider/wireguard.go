package provider

import (
	"bufio"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"net/netip"
	"path/filepath"
	"strconv"
	"strings"
)

const (
	maximumWireGuardProfileBytes = 64 * 1024
	maximumWireGuardAddresses    = 8
	maximumWireGuardDNSServers   = 8
	minimumWireGuardMTU          = 1280
	maximumWireGuardMTU          = 1500
	maximumProfileIdentifierSize = 160
	wireGuardNameHashSize        = 8

	// WireGuardKeepaliveSeconds is forced on every peer.
	//
	// WireGuard only re-handshakes while it sends, so without a keepalive an idle but
	// healthy tunnel would look stale to the controller's health check.
	WireGuardKeepaliveSeconds = 25
)

// WireGuardConfig is one parsed WireGuard client configuration.
//
// Only the fields the controller applies are kept; everything else in a file is either
// rewritten to a fixed value or rejected while parsing.
type WireGuardConfig struct {
	PrivateKey    string
	Addresses     []netip.Prefix
	DNSServers    []netip.Addr
	MTU           int
	PeerPublicKey string
	PresharedKey  string
	EndpointHost  string
	EndpointPort  int
}

// NormalizeWireGuardProfile validates and rewrites an uploaded WireGuard configuration.
//
// Uploads must be complete, with their own private key and tunnel address. Commands,
// routing-table overrides, and IPv6 are removed or refused so a file can't run a
// program or widen what leaves the tunnel.
func NormalizeWireGuardProfile(
	providerID string,
	profileName string,
	content []byte,
) (Profile, error) {
	baseName := filepath.Base(profileName)
	if baseName == "." || baseName == "" || baseName != profileName {
		return Profile{}, errors.New("WireGuard configuration name must be a plain filename")
	}

	config, err := parseWireGuardConfig(content)
	if err != nil {
		return Profile{}, err
	}
	if err := config.requireComplete(); err != nil {
		return Profile{}, err
	}

	return newWireGuardProfile(providerID, strings.TrimSuffix(baseName, filepath.Ext(baseName)), config), nil
}

// newWireGuardTemplateProfile builds a catalog entry without any user key.
//
// Catalogs only know the server side; the user's private key, and the address when the
// provider assigns one per key, are merged in by MergeWireGuardCredentials at connect.
func newWireGuardTemplateProfile(providerID string, name string, template WireGuardConfig) (Profile, error) {
	if template.PrivateKey != "" {
		return Profile{}, errors.New("a WireGuard catalog entry can't carry a private key")
	}
	if err := template.validatePeer(); err != nil {
		return Profile{}, err
	}

	return newWireGuardProfile(providerID, name, template), nil
}

// newWireGuardProfile wraps a parsed configuration in the shared profile shape.
//
// Identifiers carry a wg- marker so a provider's OpenVPN and WireGuard entries for the
// same location never collide.
func newWireGuardProfile(providerID string, name string, config WireGuardConfig) Profile {
	configuration := config.Canonical()
	fingerprintBytes := sha256.Sum256(configuration)
	fingerprint := hex.EncodeToString(fingerprintBytes[:])
	identifierName := normalizeIdentifier(name)
	if identifierName == "" {
		identifierName = "endpoint"
	}
	identifierPrefix := providerID + ":wg-"
	identifierSuffix := ":" + fingerprint[0:12]
	maximumNameSize := maximumProfileIdentifierSize - len(identifierPrefix) - len(identifierSuffix)
	if len(identifierName) > maximumNameSize {
		nameHashBytes := sha256.Sum256([]byte(name))
		nameHash := hex.EncodeToString(nameHashBytes[:])[0:wireGuardNameHashSize]
		identifierName = identifierName[0:maximumNameSize-wireGuardNameHashSize-1] + "-" + nameHash
	}

	return Profile{
		ID:            identifierPrefix + identifierName + identifierSuffix,
		ProviderID:    providerID,
		Tunnel:        TunnelWireGuard,
		DisplayName:   name,
		Protocol:      "udp",
		RemoteHost:    config.EndpointHost,
		RemotePort:    config.EndpointPort,
		Fingerprint:   fingerprint,
		Configuration: configuration,
	}
}

// MergeWireGuardCredentials completes a catalog template with the user's key.
//
// The address from the credentials replaces the template's fixed one when given. The
// result is a canonical, complete configuration ready for the controller.
func MergeWireGuardCredentials(template []byte, credentials map[string]string) ([]byte, error) {
	config, err := parseWireGuardConfig(template)
	if err != nil {
		return nil, fmt.Errorf("read the WireGuard catalog entry: %w", err)
	}
	if config.PrivateKey != "" {
		return nil, errors.New("the WireGuard catalog entry already has a private key")
	}

	privateKey := strings.TrimSpace(credentials["privateKey"])
	if !validWireGuardKey(privateKey) {
		return nil, errors.New("the WireGuard private key is invalid")
	}
	config.PrivateKey = privateKey

	if address := strings.TrimSpace(credentials["address"]); address != "" {
		prefix, err := parseIPv4Prefix(address)
		if err != nil {
			return nil, errors.New("the WireGuard tunnel address must be an IPv4 address")
		}
		config.Addresses = []netip.Prefix{prefix}
	}
	if err := config.requireComplete(); err != nil {
		return nil, err
	}

	return config.Canonical(), nil
}

// ValidateNormalizedWireGuardProfile rechecks the exact controller input contract.
//
// The content must already be in canonical form, which proves the full tunnel, the
// forced keepalive, and the absence of every rejected setting.
func ValidateNormalizedWireGuardProfile(content []byte) (NormalizedProfileMetadata, error) {
	config, err := ParseNormalizedWireGuardProfile(content)
	if err != nil {
		return NormalizedProfileMetadata{}, err
	}

	return NormalizedProfileMetadata{
		RemoteHost: config.EndpointHost,
		RemotePort: config.EndpointPort,
	}, nil
}

// ParseNormalizedWireGuardProfile reads a complete canonical configuration for the driver.
//
// Anything that isn't byte-for-byte canonical is refused, so the controller never
// applies a setting the normalizer didn't produce.
func ParseNormalizedWireGuardProfile(content []byte) (WireGuardConfig, error) {
	config, err := parseWireGuardConfig(content)
	if err != nil {
		return WireGuardConfig{}, err
	}
	if err := config.requireComplete(); err != nil {
		return WireGuardConfig{}, err
	}
	if !bytes.Equal(config.Canonical(), content) {
		return WireGuardConfig{}, errors.New("normalized WireGuard configuration is not in canonical form")
	}

	return config, nil
}

// LooksLikeWireGuardConfiguration reports whether content has a WireGuard section header.
//
// The upload endpoint uses it to explain a file chosen for the wrong tunnel instead of
// returning a parser error about an unexpected directive.
func LooksLikeWireGuardConfiguration(content []byte) bool {
	for _, line := range strings.Split(strings.ReplaceAll(string(content), "\r", "\n"), "\n") {
		line = stripWireGuardComment(line)
		if strings.EqualFold(strings.TrimSpace(line), "[interface]") {
			return true
		}
	}

	return false
}

// Canonical serializes the configuration in the one form the controller accepts.
//
// AllowedIPs and PersistentKeepalive are always written with their fixed values, so a
// file's own routes or timers never reach the tunnel.
func (config WireGuardConfig) Canonical() []byte {
	lines := []string{"[Interface]"}
	if config.PrivateKey != "" {
		lines = append(lines, "PrivateKey = "+config.PrivateKey)
	}
	if len(config.Addresses) > 0 {
		addresses := make([]string, 0, len(config.Addresses))
		for _, address := range config.Addresses {
			addresses = append(addresses, address.String())
		}
		lines = append(lines, "Address = "+strings.Join(addresses, ", "))
	}
	if len(config.DNSServers) > 0 {
		servers := make([]string, 0, len(config.DNSServers))
		for _, server := range config.DNSServers {
			servers = append(servers, server.String())
		}
		lines = append(lines, "DNS = "+strings.Join(servers, ", "))
	}
	if config.MTU > 0 {
		lines = append(lines, "MTU = "+strconv.Itoa(config.MTU))
	}

	lines = append(lines, "", "[Peer]", "PublicKey = "+config.PeerPublicKey)
	if config.PresharedKey != "" {
		lines = append(lines, "PresharedKey = "+config.PresharedKey)
	}
	lines = append(
		lines,
		"Endpoint = "+net.JoinHostPort(config.EndpointHost, strconv.Itoa(config.EndpointPort)),
		"AllowedIPs = 0.0.0.0/0",
		"PersistentKeepalive = "+strconv.Itoa(WireGuardKeepaliveSeconds),
	)

	return []byte(strings.Join(lines, "\n") + "\n")
}

// requireComplete checks the fields a configuration needs before it can connect.
//
// Templates may lack a key and address; anything sent to the controller may not.
func (config WireGuardConfig) requireComplete() error {
	if config.PrivateKey == "" {
		return errors.New("WireGuard configuration does not contain a PrivateKey")
	}
	if len(config.Addresses) == 0 {
		return errors.New("WireGuard configuration does not contain an IPv4 Address")
	}

	return config.validatePeer()
}

// validatePeer checks the server side shared by templates and complete configurations.
//
// Keys are checked for shape only; the handshake proves they belong together.
func (config WireGuardConfig) validatePeer() error {
	if !validWireGuardKey(config.PeerPublicKey) {
		return errors.New("WireGuard configuration does not contain a valid peer PublicKey")
	}
	if config.PresharedKey != "" && !validWireGuardKey(config.PresharedKey) {
		return errors.New("WireGuard peer PresharedKey is invalid")
	}
	if config.EndpointHost == "" || !validRemoteHost(config.EndpointHost) ||
		config.EndpointPort < 1 || config.EndpointPort > 65535 {
		return errors.New("WireGuard configuration does not contain a valid peer Endpoint")
	}
	if len(config.Addresses) > maximumWireGuardAddresses {
		return fmt.Errorf("WireGuard configuration has more than %d IPv4 addresses", maximumWireGuardAddresses)
	}
	if len(config.DNSServers) > maximumWireGuardDNSServers {
		return fmt.Errorf("WireGuard configuration has more than %d IPv4 DNS servers", maximumWireGuardDNSServers)
	}
	if config.MTU != 0 && (config.MTU < minimumWireGuardMTU || config.MTU > maximumWireGuardMTU) {
		return fmt.Errorf("WireGuard MTU must be between %d and %d", minimumWireGuardMTU, maximumWireGuardMTU)
	}

	return nil
}

// parseWireGuardConfig reads the wg-quick INI subset that providers export.
//
// Keys are case-insensitive and # or ; starts a comment. Errors name the line and
// setting but never repeat a value, because values include private keys.
func parseWireGuardConfig(content []byte) (WireGuardConfig, error) {
	if len(content) == 0 {
		return WireGuardConfig{}, errors.New("WireGuard configuration is empty")
	}
	if len(content) > maximumWireGuardProfileBytes {
		return WireGuardConfig{}, fmt.Errorf("WireGuard configuration exceeds %d bytes", maximumWireGuardProfileBytes)
	}

	text := strings.ReplaceAll(string(content), "\r\n", "\n")
	text = strings.ReplaceAll(text, "\r", "\n")
	scanner := bufio.NewScanner(strings.NewReader(text))
	scanner.Buffer(make([]byte, 4096), maximumWireGuardProfileBytes)

	config := WireGuardConfig{}
	section := ""
	interfaceSections := 0
	peerSections := 0
	seen := map[string]bool{}
	lineNumber := 0

	for scanner.Scan() {
		lineNumber++
		line := stripWireGuardComment(scanner.Text())
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			switch strings.ToLower(strings.TrimSpace(line[1 : len(line)-1])) {
			case "interface":
				section = "interface"
				interfaceSections++
			case "peer":
				section = "peer"
				peerSections++
			default:
				return WireGuardConfig{}, fmt.Errorf("line %d: only [Interface] and [Peer] sections are supported", lineNumber)
			}
			if interfaceSections > 1 {
				return WireGuardConfig{}, fmt.Errorf("line %d: a configuration has one [Interface] section", lineNumber)
			}
			if peerSections > 1 {
				return WireGuardConfig{}, fmt.Errorf("line %d: a configuration must have exactly one [Peer]", lineNumber)
			}

			continue
		}

		key, value, found := strings.Cut(line, "=")
		if !found {
			return WireGuardConfig{}, fmt.Errorf("line %d: expected a Key = Value setting", lineNumber)
		}
		key = strings.ToLower(strings.TrimSpace(key))
		value = strings.TrimSpace(value)
		if section == "" {
			return WireGuardConfig{}, fmt.Errorf("line %d: settings must be inside [Interface] or [Peer]", lineNumber)
		}

		var err error
		if section == "interface" {
			err = applyWireGuardInterfaceSetting(&config, key, value, seen)
		} else {
			err = applyWireGuardPeerSetting(&config, key, value, seen)
		}
		if err != nil {
			return WireGuardConfig{}, fmt.Errorf("line %d: %w", lineNumber, err)
		}
	}
	if err := scanner.Err(); err != nil {
		return WireGuardConfig{}, fmt.Errorf("read WireGuard configuration: %w", err)
	}

	if interfaceSections != 1 {
		return WireGuardConfig{}, errors.New("WireGuard configuration must have one [Interface] section")
	}
	if peerSections != 1 {
		return WireGuardConfig{}, errors.New("WireGuard configuration must have exactly one [Peer]")
	}
	if err := config.validatePeer(); err != nil {
		return WireGuardConfig{}, err
	}

	return config, nil
}

// stripWireGuardComment removes wg-quick's hash or semicolon comment suffix.
//
// Detection and parsing share this boundary so a recognized upload cannot fail only
// because its section header carries an ordinary inline comment.
func stripWireGuardComment(line string) string {
	if commentStart := strings.IndexAny(line, "#;"); commentStart >= 0 {
		return line[:commentStart]
	}

	return line
}

// applyWireGuardInterfaceSetting reads one [Interface] setting.
//
// Command hooks and routing-table settings are refused with a reason; listen ports and
// SaveConfig are dropped because they don't affect a client tunnel.
func applyWireGuardInterfaceSetting(config *WireGuardConfig, key string, value string, seen map[string]bool) error {
	switch key {
	case "privatekey":
		if seen["privatekey"] {
			return errors.New("PrivateKey appears more than once")
		}
		seen["privatekey"] = true
		if !validWireGuardKey(value) {
			return errors.New("PrivateKey is not a valid WireGuard key")
		}
		config.PrivateKey = strings.TrimSpace(value)
	case "address":
		for _, entry := range splitWireGuardList(value) {
			prefix, isIPv4, err := parseWireGuardAddress(entry)
			if err != nil {
				return errors.New("Address must list IP addresses")
			}
			if isIPv4 {
				config.Addresses = append(config.Addresses, prefix)
			}
		}
	case "dns":
		for _, entry := range splitWireGuardList(value) {
			address, err := netip.ParseAddr(entry)
			if err != nil {
				continue
			}
			if address.Is4() {
				config.DNSServers = append(config.DNSServers, address)
			}
		}
	case "mtu":
		if seen["mtu"] {
			return errors.New("MTU appears more than once")
		}
		seen["mtu"] = true
		mtu, err := strconv.Atoi(value)
		if err != nil {
			return errors.New("MTU must be a number")
		}
		config.MTU = mtu
	case "listenport", "saveconfig":
		return nil
	case "table", "fwmark":
		return fmt.Errorf("%s is not allowed: the container manages routing itself", wireGuardKeyName(key))
	case "preup", "postup", "predown", "postdown":
		return fmt.Errorf(
			"%s is not allowed: configurations can't run commands. If the file came from Mullvad, download it again with the kill switch option turned off",
			wireGuardKeyName(key),
		)
	default:
		return errors.New("unsupported [Interface] setting")
	}

	return nil
}

// applyWireGuardPeerSetting reads one [Peer] setting.
//
// AllowedIPs and PersistentKeepalive are checked for shape but always replaced by the
// fixed full-tunnel values when the configuration is serialized.
func applyWireGuardPeerSetting(config *WireGuardConfig, key string, value string, seen map[string]bool) error {
	switch key {
	case "publickey":
		if seen["publickey"] {
			return errors.New("PublicKey appears more than once")
		}
		seen["publickey"] = true
		if !validWireGuardKey(value) {
			return errors.New("PublicKey is not a valid WireGuard key")
		}
		config.PeerPublicKey = strings.TrimSpace(value)
	case "presharedkey":
		if seen["presharedkey"] {
			return errors.New("PresharedKey appears more than once")
		}
		seen["presharedkey"] = true
		if !validWireGuardKey(value) {
			return errors.New("PresharedKey is not a valid WireGuard key")
		}
		config.PresharedKey = strings.TrimSpace(value)
	case "endpoint":
		if seen["endpoint"] {
			return errors.New("Endpoint appears more than once")
		}
		seen["endpoint"] = true
		host, port, err := parseWireGuardEndpoint(value)
		if err != nil {
			return err
		}
		config.EndpointHost = host
		config.EndpointPort = port
	case "allowedips":
		for _, entry := range splitWireGuardList(value) {
			if _, err := netip.ParsePrefix(entry); err != nil {
				if _, addressError := netip.ParseAddr(entry); addressError != nil {
					return errors.New("AllowedIPs must list IP ranges")
				}
			}
		}
	case "persistentkeepalive":
		return nil
	default:
		return errors.New("unsupported [Peer] setting")
	}

	return nil
}

// parseWireGuardEndpoint reads host:port for an IPv4 literal or hostname.
//
// IPv6 endpoints are refused because the tunnel and its firewall are IPv4-only.
func parseWireGuardEndpoint(value string) (string, int, error) {
	if strings.HasPrefix(value, "[") {
		return "", 0, errors.New("Endpoint must be IPv4 or a hostname; IPv6 isn't supported")
	}

	host, portText, err := net.SplitHostPort(value)
	if err != nil {
		return "", 0, errors.New("Endpoint must be a host and port")
	}
	if address, parseError := netip.ParseAddr(host); parseError == nil && !address.Is4() {
		return "", 0, errors.New("Endpoint must be IPv4 or a hostname; IPv6 isn't supported")
	}
	if host == "" || len(host) > 253 || !validRemoteHost(host) {
		return "", 0, errors.New("Endpoint host is invalid")
	}

	port, err := strconv.Atoi(portText)
	if err != nil || port < 1 || port > 65535 {
		return "", 0, errors.New("Endpoint port must be between 1 and 65535")
	}

	return strings.ToLower(host), port, nil
}

// parseWireGuardAddress reads one Address entry and reports whether it is IPv4.
//
// A bare address becomes a host prefix, matching how wg-quick reads the same value.
func parseWireGuardAddress(entry string) (netip.Prefix, bool, error) {
	if strings.Contains(entry, "/") {
		prefix, err := netip.ParsePrefix(entry)
		if err != nil {
			return netip.Prefix{}, false, err
		}

		return prefix, prefix.Addr().Is4(), nil
	}

	address, err := netip.ParseAddr(entry)
	if err != nil {
		return netip.Prefix{}, false, err
	}

	return netip.PrefixFrom(address, address.BitLen()), address.Is4(), nil
}

// splitWireGuardList splits a comma-separated setting into trimmed, non-empty entries.
func splitWireGuardList(value string) []string {
	entries := []string{}
	for _, entry := range strings.Split(value, ",") {
		if entry = strings.TrimSpace(entry); entry != "" {
			entries = append(entries, entry)
		}
	}

	return entries
}

// wireGuardKeyName restores the usual spelling of a lowercased setting for messages.
func wireGuardKeyName(key string) string {
	names := map[string]string{
		"fwmark":   "FwMark",
		"postdown": "PostDown",
		"postup":   "PostUp",
		"predown":  "PreDown",
		"preup":    "PreUp",
		"table":    "Table",
	}
	if name, found := names[key]; found {
		return name
	}

	return key
}
