package api

import (
	"net"
	"net/http"
	"strings"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/clientinfo"
)

// isTrustedProxy reports whether a peer may supply X-Forwarded-* headers.
//
// Any loopback or private address counts, which covers a reverse proxy on the same
// Docker network or LAN without a setting. Requests arriving straight from a public
// address keep their socket address, so internet clients cannot spoof their IP.
func isTrustedProxy(address net.IP) bool {
	return address != nil && (address.IsLoopback() || address.IsPrivate())
}

// remoteIP parses the socket peer address of one request.
//
// A malformed RemoteAddr yields nil, which is treated as untrusted everywhere.
func remoteIP(request *http.Request) net.IP {
	host, _, err := net.SplitHostPort(request.RemoteAddr)
	if err != nil {
		host = request.RemoteAddr
	}

	return net.ParseIP(strings.Trim(host, "[]"))
}

// clientAddress returns the visitor's IP for rate limits and logs.
//
// Behind a trusted proxy, X-Forwarded-For is walked from the right and the first
// address that is not itself a trusted proxy is the client. When every hop is private
// (a LAN visitor through a LAN proxy) the leftmost address is used.
func clientAddress(request *http.Request) string {
	peer := remoteIP(request)
	if peer == nil {
		return request.RemoteAddr
	}

	if !isTrustedProxy(peer) {
		return peer.String()
	}

	forwardedFor := request.Header.Values("X-Forwarded-For")
	if len(forwardedFor) == 0 {
		return peer.String()
	}

	hops := []net.IP{}
	for _, headerValue := range forwardedFor {
		for _, part := range strings.Split(headerValue, ",") {
			address := net.ParseIP(strings.Trim(strings.TrimSpace(part), "[]"))
			if address != nil {
				hops = append(hops, address)
			}
		}
	}

	if len(hops) == 0 {
		return peer.String()
	}

	for index := len(hops) - 1; index >= 0; index-- {
		if !isTrustedProxy(hops[index]) {
			return hops[index].String()
		}
	}

	return hops[0].String()
}

// clientLimitKey returns the address that sign-in and setup limits count a visitor by.
//
// IPv4 addresses are used as they are, and IPv6 visitors count by their /56 network, so
// logs and alerts that read the key name the network that reached the limit.
func clientLimitKey(request *http.Request) string {
	return clientinfo.LimitKey(clientAddress(request))
}

// requestScheme reports whether the visitor reached the app over https.
//
// TLS on the socket wins; otherwise a trusted proxy's X-Forwarded-Proto is honored so
// cookies can be marked Secure when the proxy terminates TLS.
func requestScheme(request *http.Request) string {
	if request.TLS != nil {
		return "https"
	}

	if isTrustedProxy(remoteIP(request)) {
		forwardedProto := strings.ToLower(firstHeaderValue(request, "X-Forwarded-Proto"))
		if forwardedProto == "https" || forwardedProto == "http" {
			return forwardedProto
		}
	}

	return "http"
}

// requestHost returns the host and port the visitor typed, as the browser sees it.
//
// A trusted proxy's X-Forwarded-Host replaces Host. The value is used for passkey
// origins, so anything that is not a plain host[:port] falls back to Host.
func requestHost(request *http.Request) string {
	if isTrustedProxy(remoteIP(request)) {
		forwardedHost := firstHeaderValue(request, "X-Forwarded-Host")
		if validHostValue(forwardedHost) {
			return strings.ToLower(forwardedHost)
		}
	}

	return strings.ToLower(request.Host)
}

// requestHostname strips any port from requestHost.
//
// Passkeys are bound to this name (the WebAuthn relying party ID).
func requestHostname(request *http.Request) string {
	host := requestHost(request)
	if hostname, _, err := net.SplitHostPort(host); err == nil {
		return strings.Trim(hostname, "[]")
	}

	return strings.Trim(host, "[]")
}

// requestOrigin is the browser origin for this request, such as https://torrents.example.com.
func requestOrigin(request *http.Request) string {
	return requestScheme(request) + "://" + requestHost(request)
}

// passkeysAvailable reports whether browsers will allow passkeys on this hostname.
//
// WebAuthn needs a secure context (https, or localhost) and a domain name; bare IP
// addresses are never valid relying party IDs.
func passkeysAvailable(request *http.Request) bool {
	hostname := requestHostname(request)
	if hostname == "" || net.ParseIP(hostname) != nil {
		return false
	}

	if hostname == "localhost" || strings.HasSuffix(hostname, ".localhost") {
		return true
	}

	return requestScheme(request) == "https"
}

// firstHeaderValue returns the first comma-separated value of a header.
//
// Proxies append to X-Forwarded-* headers, and the first entry is the one the
// outermost proxy set from the visitor's request.
func firstHeaderValue(request *http.Request, name string) string {
	value := request.Header.Get(name)
	if before, _, found := strings.Cut(value, ","); found {
		value = before
	}

	return strings.TrimSpace(value)
}

// validHostValue accepts host, host:port and [ipv6]:port with conservative characters.
func validHostValue(value string) bool {
	if value == "" || len(value) > 255 {
		return false
	}

	for _, character := range value {
		switch {
		case character >= 'a' && character <= 'z',
			character >= 'A' && character <= 'Z',
			character >= '0' && character <= '9',
			character == '.', character == '-', character == ':',
			character == '[', character == ']':
			continue
		default:
			return false
		}
	}

	return true
}
