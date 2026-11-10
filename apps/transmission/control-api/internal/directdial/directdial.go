// Package directdial lets the console open connections outside the VPN.
//
// The firewall drops every new connection the container opens over its own network
// unless its packets carry the controller's mark, and only a process with
// CAP_NET_ADMIN can mark a socket. The console therefore asks the VPN controller, which
// dials with the mark and hands the connected socket back over a Unix socket that only
// the console's group can open.
//
// Since: 2.0.3
package directdial

import "time"

// Mark is the firewall mark on everything the controller sends outside the VPN.
//
// WireGuard and OpenVPN tunnel packets, the controller's own DNS lookups, and the
// connections it opens for the console all carry it. The firewall lets only marked
// packets leave over the container's own network.
//
// Since: 2.0.3
const Mark = 0xca6c

// maximumMessageBytes bounds one request or answer line, which only names a network and
// an address, or the reason a connection wasn't made.
const maximumMessageBytes = 1024

// exchangeTimeout limits how long one request may take, from either side.
const exchangeTimeout = 20 * time.Second

// dialTimeout limits how long the controller tries one destination.
const dialTimeout = 15 * time.Second

// request asks the controller for one connection.
type request struct {
	Network string `json:"network"`
	Address string `json:"address"`
}

// response is the controller's answer.
//
// A made connection arrives as a descriptor next to an empty answer. Otherwise the
// answer says why, and whether the host lookup was what failed.
type response struct {
	Error         string `json:"error,omitempty"`
	LookupFailure bool   `json:"lookupFailure,omitempty"`
}
