// Package clientinfo normalizes client addresses shared by authentication boundaries.
//
// Browser sign-in and the standalone web proxy use the same IPv4 and IPv6 network
// identity so switching addresses inside one delegated IPv6 prefix cannot reset limits.
package clientinfo

import "net/netip"

// ipv6LimitPrefixLength is how much of an IPv6 address identifies one visitor.
//
// A /56 covers the networks a home or small office usually receives from its provider
// while IPv4 visitors continue to count by their individual normalized address.
const ipv6LimitPrefixLength = 56

// LimitKey returns the normalized address used for authentication failure limits.
//
// IPv4-mapped addresses become plain IPv4, IPv6 zones are removed, and native IPv6
// addresses are grouped by /56. Unparseable input is returned unchanged.
//
// Since: UNRELEASED
func LimitKey(address string) string {
	parsed, err := netip.ParseAddr(address)
	if err != nil {
		return address
	}

	parsed = parsed.Unmap()
	if parsed.Is4() {
		return parsed.String()
	}

	network, err := parsed.WithZone("").Prefix(ipv6LimitPrefixLength)
	if err != nil {
		return address
	}

	return network.String()
}
