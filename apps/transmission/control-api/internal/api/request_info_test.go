package api

import (
	"crypto/tls"
	"net/http/httptest"
	"testing"
)

func TestClientLimitKeyGroupsIPv6ByNetwork(t *testing.T) {
	cases := []struct {
		name         string
		remoteAddr   string
		forwardedFor string
		want         string
	}{
		{"ipv4 visitor", "198.51.100.9:5000", "", "198.51.100.9"},
		{"ipv4-mapped visitor", "[::ffff:198.51.100.9]:5000", "", "198.51.100.9"},
		{"ipv6 visitor", "[2001:db8:1234:5678::1]:5000", "", "2001:db8:1234:5600::/56"},
		{"same /56 through a proxy", "127.0.0.1:5000", "2001:db8:1234:56ff::2", "2001:db8:1234:5600::/56"},
		{"next /56", "[2001:db8:1234:5700::1]:5000", "", "2001:db8:1234:5700::/56"},
		{"ipv6 loopback", "[::1]:5000", "", "::/56"},
		{"unparsed remote address", "not-an-address", "", "not-an-address"},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			request := httptest.NewRequest("GET", "/", nil)
			request.RemoteAddr = testCase.remoteAddr
			if testCase.forwardedFor != "" {
				request.Header.Set("X-Forwarded-For", testCase.forwardedFor)
			}

			if got := clientLimitKey(request); got != testCase.want {
				t.Fatalf("clientLimitKey = %q, want %q", got, testCase.want)
			}
			if got := signInAttemptKey(request); got != "sign-in:"+testCase.want {
				t.Fatalf("signInAttemptKey = %q, want %q", got, "sign-in:"+testCase.want)
			}
		})
	}
}

func TestClientAddressHonorsOnlyTrustedProxies(t *testing.T) {
	cases := []struct {
		name         string
		remoteAddr   string
		forwardedFor string
		want         string
	}{
		{"direct public client", "198.51.100.9:5000", "", "198.51.100.9"},
		{"public client cannot spoof", "198.51.100.9:5000", "1.2.3.4", "198.51.100.9"},
		{"proxy on docker network", "172.18.0.5:5000", "203.0.113.7", "203.0.113.7"},
		{"chained proxies", "10.0.0.2:5000", "203.0.113.7, 10.0.0.9", "203.0.113.7"},
		{"spoofed left entry is skipped", "127.0.0.1:5000", "6.6.6.6, 203.0.113.7", "203.0.113.7"},
		{"lan visitor through lan proxy", "192.168.1.2:5000", "192.168.1.50", "192.168.1.50"},
		{"ipv6 loopback proxy", "[::1]:5000", "2001:db8::1", "2001:db8::1"},
		{"garbage header", "127.0.0.1:5000", "not-an-ip", "127.0.0.1"},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			request := httptest.NewRequest("GET", "/", nil)
			request.RemoteAddr = testCase.remoteAddr
			if testCase.forwardedFor != "" {
				request.Header.Set("X-Forwarded-For", testCase.forwardedFor)
			}

			if got := clientAddress(request); got != testCase.want {
				t.Fatalf("clientAddress = %q, want %q", got, testCase.want)
			}
		})
	}
}

func TestRequestSchemeAndHost(t *testing.T) {
	proxied := httptest.NewRequest("GET", "http://internal:22602/", nil)
	proxied.RemoteAddr = "172.18.0.5:5000"
	proxied.Header.Set("X-Forwarded-Proto", "https")
	proxied.Header.Set("X-Forwarded-Host", "Torrents.Example.com")

	if got := requestScheme(proxied); got != "https" {
		t.Fatalf("proxied scheme = %q", got)
	}
	if got := requestOrigin(proxied); got != "https://torrents.example.com" {
		t.Fatalf("proxied origin = %q", got)
	}
	if !passkeysAvailable(proxied) {
		t.Fatal("passkeys should be available on an https domain")
	}

	public := httptest.NewRequest("GET", "http://192.0.2.10:22602/", nil)
	public.RemoteAddr = "198.51.100.9:5000"
	public.Header.Set("X-Forwarded-Proto", "https")
	public.Header.Set("X-Forwarded-Host", "evil.example")

	if got := requestScheme(public); got != "http" {
		t.Fatalf("untrusted forwarded proto was honored: %q", got)
	}
	if got := requestHostname(public); got != "192.0.2.10" {
		t.Fatalf("untrusted forwarded host was honored: %q", got)
	}
	if passkeysAvailable(public) {
		t.Fatal("passkeys must not be offered on a bare IP address")
	}

	local := httptest.NewRequest("GET", "http://localhost:5173/", nil)
	local.RemoteAddr = "127.0.0.1:5000"
	if !passkeysAvailable(local) {
		t.Fatal("passkeys should be available on localhost over http")
	}

	tlsRequest := httptest.NewRequest("GET", "https://torrents.example.com/", nil)
	tlsRequest.TLS = &tls.ConnectionState{}
	if got := requestScheme(tlsRequest); got != "https" {
		t.Fatalf("TLS scheme = %q", got)
	}

	malformed := httptest.NewRequest("GET", "http://torrents.example.com/", nil)
	malformed.RemoteAddr = "127.0.0.1:5000"
	malformed.Header.Set("X-Forwarded-Host", "evil.example/path")
	if got := requestHostname(malformed); got != "torrents.example.com" {
		t.Fatalf("malformed forwarded host was honored: %q", got)
	}
}
