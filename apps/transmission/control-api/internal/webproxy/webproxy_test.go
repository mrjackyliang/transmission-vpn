package webproxy

import (
	"bufio"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"os"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

const (
	testProxyUsername = "living-room"
	testProxyPassword = "a secure proxy password"
)

// TestHTTPAuthenticationRequiresValidCredentials verifies both Basic challenge paths.
func TestHTTPAuthenticationRequiresValidCredentials(testingObject *testing.T) {
	service := newProtocolTestService(testingObject)

	for _, testCase := range []struct {
		name          string
		authorization string
	}{
		{name: "missing credentials"},
		{
			name:          "wrong credentials",
			authorization: basicProxyAuthorization(testProxyUsername, "the wrong password"),
		},
	} {
		testingObject.Run(testCase.name, func(testingObject *testing.T) {
			request := "GET http://1.1.1.1/ HTTP/1.1\r\nHost: 1.1.1.1\r\nConnection: close\r\n"
			if testCase.authorization != "" {
				request += "Proxy-Authorization: " + testCase.authorization + "\r\n"
			}
			request += "\r\n"

			response := runHTTPProxyRequest(testingObject, service, request)
			if response.StatusCode != http.StatusProxyAuthRequired ||
				response.Header.Get("Proxy-Authenticate") != proxyRealm {
				testingObject.Fatalf("response = %d, headers %+v", response.StatusCode, response.Header)
			}
			_ = response.Body.Close()
		})
	}
}

// TestZeroLoginHTTPAuthenticationMatchesWrongPassword verifies fail-closed access.
//
// An enabled proxy with no configured logins returns the same challenge as a bad
// password, so no supplied username and password can reach a destination.
//
// Since: 2.0.0
func TestZeroLoginHTTPAuthenticationMatchesWrongPassword(testingObject *testing.T) {
	service := newProtocolTestService(testingObject)
	requestPrefix := "GET http://1.1.1.1/ HTTP/1.1\r\nHost: 1.1.1.1\r\nConnection: close\r\nProxy-Authorization: "
	requestSuffix := "\r\n\r\n"

	wrongPasswordResponse := runHTTPProxyRequest(
		testingObject,
		service,
		requestPrefix+basicProxyAuthorization(testProxyUsername, "the wrong password")+requestSuffix,
	)
	defer func() { _ = wrongPasswordResponse.Body.Close() }()

	service.authenticator.setLogins(nil)
	zeroLoginResponse := runHTTPProxyRequest(
		testingObject,
		service,
		requestPrefix+basicProxyAuthorization(testProxyUsername, testProxyPassword)+requestSuffix,
	)
	defer func() { _ = zeroLoginResponse.Body.Close() }()

	if zeroLoginResponse.StatusCode != wrongPasswordResponse.StatusCode ||
		zeroLoginResponse.Header.Get("Proxy-Authenticate") != wrongPasswordResponse.Header.Get("Proxy-Authenticate") {
		testingObject.Fatalf(
			"zero-login response = %d, headers %+v; wrong-password response = %d, headers %+v",
			zeroLoginResponse.StatusCode,
			zeroLoginResponse.Header,
			wrongPasswordResponse.StatusCode,
			wrongPasswordResponse.Header,
		)
	}
}

// TestSOCKS5AuthenticationRefusesNoAuthAndWrongCredentials covers RFC 1929 enforcement.
func TestSOCKS5AuthenticationRefusesNoAuthAndWrongCredentials(testingObject *testing.T) {
	service := newProtocolTestService(testingObject)

	testingObject.Run("no authentication", func(testingObject *testing.T) {
		withProxyConnection(testingObject, service, func(connection net.Conn, _ *bufio.Reader) {
			if _, err := connection.Write([]byte{socksVersion, 0x01, 0x00}); err != nil {
				testingObject.Fatalf("write greeting: %v", err)
			}

			response := make([]byte, 2)
			if _, err := io.ReadFull(connection, response); err != nil {
				testingObject.Fatalf("read greeting response: %v", err)
			}
			if response[0] != socksVersion || response[1] != socksNoAcceptedMethod {
				testingObject.Fatalf("no-auth response = %v", response)
			}
		})
	})

	testingObject.Run("wrong credentials", func(testingObject *testing.T) {
		withProxyConnection(testingObject, service, func(connection net.Conn, reader *bufio.Reader) {
			performSOCKSGreeting(testingObject, connection, reader)
			writeSOCKSCredentials(testingObject, connection, testProxyUsername, "the wrong password")

			response := make([]byte, 2)
			if _, err := io.ReadFull(reader, response); err != nil {
				testingObject.Fatalf("read authentication response: %v", err)
			}
			if response[0] != 0x01 || response[1] == 0x00 {
				testingObject.Fatalf("wrong-password response = %v", response)
			}
		})
	})
}

// TestClientAllowlist checks every accepted private family and representative refusals.
func TestClientAllowlist(testingObject *testing.T) {
	testCases := []struct {
		address string
		allowed bool
	}{
		{address: "10.1.2.3", allowed: true},
		{address: "172.16.0.1", allowed: true},
		{address: "172.31.255.254", allowed: true},
		{address: "192.168.1.10", allowed: true},
		{address: "fc00::1234", allowed: true},
		{address: "fe80::1", allowed: true},
		{address: "::ffff:192.168.1.20", allowed: true},
		{address: "127.0.0.1", allowed: false},
		{address: "172.32.0.1", allowed: false},
		{address: "8.8.8.8", allowed: false},
		{address: "2001:4860:4860::8888", allowed: false},
	}

	for _, testCase := range testCases {
		testingObject.Run(testCase.address, func(testingObject *testing.T) {
			address := net.ParseIP(testCase.address)
			allowed := isAllowedClient(&net.TCPAddr{IP: address, Port: 45678})
			if allowed != testCase.allowed {
				testingObject.Fatalf("isAllowedClient(%s) = %t, want %t", testCase.address, allowed, testCase.allowed)
			}
		})
	}
}

// TestDestinationFilter rejects all private and reserved ranges and every IPv6 address.
func TestDestinationFilter(testingObject *testing.T) {
	testCases := []struct {
		address string
		allowed bool
	}{
		{address: "1.1.1.1", allowed: true},
		{address: "8.8.8.8", allowed: true},
		{address: "0.1.2.3", allowed: false},
		{address: "10.0.0.1", allowed: false},
		{address: "100.64.0.1", allowed: false},
		{address: "127.0.0.1", allowed: false},
		{address: "169.254.1.1", allowed: false},
		{address: "172.16.0.1", allowed: false},
		{address: "192.0.0.8", allowed: false},
		{address: "192.0.2.1", allowed: false},
		{address: "192.168.0.1", allowed: false},
		{address: "198.18.0.1", allowed: false},
		{address: "198.51.100.1", allowed: false},
		{address: "203.0.113.1", allowed: false},
		{address: "224.0.0.1", allowed: false},
		{address: "240.0.0.1", allowed: false},
		{address: "255.255.255.255", allowed: false},
		{address: "::ffff:10.0.0.1", allowed: false},
		{address: "2001:4860:4860::8888", allowed: false},
	}

	for _, testCase := range testCases {
		testingObject.Run(testCase.address, func(testingObject *testing.T) {
			allowed := isAllowedDestination(net.ParseIP(testCase.address))
			if allowed != testCase.allowed {
				testingObject.Fatalf("isAllowedDestination(%s) = %t, want %t", testCase.address, allowed, testCase.allowed)
			}
		})
	}
}

// TestHostnameResolvingToPrivateAddressIsRefused proves DNS cannot bypass the filter.
func TestHostnameResolvingToPrivateAddressIsRefused(testingObject *testing.T) {
	service := newProtocolTestService(testingObject)
	service.destinationAllowed = isAllowedDestination
	service.resolver = staticResolver{addresses: []netip.Addr{netip.MustParseAddr("192.168.1.20")}}
	var dialed atomic.Bool
	service.rawDialContext = func(context.Context, string, string) (net.Conn, error) {
		dialed.Store(true)

		return nil, errors.New("unexpected dial")
	}

	_, err := service.dialGuarded(context.Background(), "tcp", "private.example:80")
	if !errors.Is(err, errDestinationNotAllowed) || dialed.Load() {
		testingObject.Fatalf("private hostname dial = %v, dialed = %t", err, dialed.Load())
	}

	_, err = service.resolveDestination(context.Background(), "fe80::1%eth0")
	if !errors.Is(err, errDestinationNotAllowed) {
		testingObject.Fatalf("zoned IPv6 destination error = %v", err)
	}
}

// TestGuardedDialBindsTheDefaultSlotAddress proves proxy traffic selects its table.
func TestGuardedDialBindsTheDefaultSlotAddress(testingObject *testing.T) {
	service := newProtocolTestService(testingObject)
	service.vpnAddress = func() string { return "198.18.0.1" }
	service.rawDialContext = nil
	var localAddress string
	service.dialContext = func(
		dialer *net.Dialer,
		_ context.Context,
		_ string,
		_ string,
	) (net.Conn, error) {
		if tcpAddress, ok := dialer.LocalAddr.(*net.TCPAddr); ok {
			localAddress = tcpAddress.IP.String()
		}

		return nil, errors.New("test dial stopped")
	}

	_, err := service.dialGuarded(context.Background(), "tcp", "1.1.1.1:443")
	if err == nil || localAddress != "198.18.0.1" {
		testingObject.Fatalf("guarded dial error/address = %v/%q", err, localAddress)
	}
}

// TestPerLoginRoutingUsesSelectedSlotAndDNS verifies both outbound socket bindings.
func TestPerLoginRoutingUsesSelectedSlotAndDNS(testingObject *testing.T) {
	service := newProtocolTestService(testingObject)
	statusDirectory := filepath.Join(testingObject.TempDir(), "vpn.status.d")
	if err := os.MkdirAll(statusDirectory, 0o755); err != nil {
		testingObject.Fatalf("create VPN status directory: %v", err)
	}
	connectionID := "vpc-2000000000000002"
	if err := os.WriteFile(
		filepath.Join(statusDirectory, connectionID+".json"),
		[]byte(`{"connectionId":"`+connectionID+`","state":"protected","slot":2,"address":"10.8.2.6","dnsServers":["9.9.9.9","1.1.1.1"]}`),
		0o644,
	); err != nil {
		testingObject.Fatalf("write selected VPN status: %v", err)
	}
	service.vpnState = &vpnStateCache{
		directory: statusDirectory,
		clock:     time.Now,
		entries:   map[string]cachedVPNState{},
	}

	var targetLocalAddress string
	var resolverLocalAddress string
	var resolverDestinations []string
	service.rawDialContext = nil
	service.dialContext = func(
		dialer *net.Dialer,
		_ context.Context,
		network string,
		address string,
	) (net.Conn, error) {
		switch localAddress := dialer.LocalAddr.(type) {
		case *net.TCPAddr:
			targetLocalAddress = localAddress.IP.String()
		case *net.UDPAddr:
			resolverLocalAddress = localAddress.IP.String()
			resolverDestinations = append(resolverDestinations, address)
		}

		return nil, errors.New("test dial stopped on " + network)
	}
	login := Login{ConnectionID: connectionID}
	_, err := service.dialGuardedForLogin(
		context.Background(),
		login,
		"tcp",
		"8.8.8.8:443",
	)
	if err == nil || targetLocalAddress != "198.18.2.1" {
		testingObject.Fatalf("selected target dial = %v from %q", err, targetLocalAddress)
	}

	route, protected := service.routeForLogin(login)
	resolver, validResolver := route.resolver.(*net.Resolver)
	if !protected || !validResolver || resolver.Dial == nil {
		testingObject.Fatalf("selected route = %+v, protected %t", route, protected)
	}
	_, err = resolver.Dial(context.Background(), "udp", "ignored:53")
	if err == nil || resolverLocalAddress != "198.18.2.1" ||
		!reflect.DeepEqual(resolverDestinations, []string{"9.9.9.9:53", "1.1.1.1:53"}) {
		testingObject.Fatalf(
			"selected DNS dial = %v from %q to %v",
			err,
			resolverLocalAddress,
			resolverDestinations,
		)
	}
}

// TestPerConnectionResolverRotatesDNSAttempts ensures a resolver retry does not
// reconnect to the same silent UDP server before trying the connection's next one.
func TestPerConnectionResolverRotatesDNSAttempts(testingObject *testing.T) {
	service := newProtocolTestService(testingObject)
	service.rawDialContext = nil
	destinations := []string{}
	peerConnections := []net.Conn{}
	service.dialContext = func(
		_ *net.Dialer,
		_ context.Context,
		_ string,
		address string,
	) (net.Conn, error) {
		client, peer := net.Pipe()
		destinations = append(destinations, address)
		peerConnections = append(peerConnections, peer)

		return client, nil
	}
	defer func() {
		for _, connection := range peerConnections {
			_ = connection.Close()
		}
	}()

	resolver, valid := service.connectionResolver(
		net.ParseIP("198.18.2.1"),
		[]string{"9.9.9.9", "1.1.1.1"},
	).(*net.Resolver)
	if !valid {
		testingObject.Fatal("connection resolver has an unexpected implementation")
	}
	for attempt := 0; attempt < 2; attempt++ {
		connection, err := resolver.Dial(context.Background(), "udp", "ignored:53")
		if err != nil {
			testingObject.Fatalf("DNS attempt %d: %v", attempt, err)
		}
		_ = connection.Close()
	}
	if !reflect.DeepEqual(destinations, []string{"9.9.9.9:53", "1.1.1.1:53"}) {
		testingObject.Fatalf("rotated DNS destinations = %v", destinations)
	}
}

// TestPerLoginRoutingRefusesOnlyTheUnprotectedConnection keeps routes independent.
func TestPerLoginRoutingRefusesOnlyTheUnprotectedConnection(testingObject *testing.T) {
	service := newProtocolTestService(testingObject)
	statusDirectory := filepath.Join(testingObject.TempDir(), "vpn.status.d")
	if err := os.MkdirAll(statusDirectory, 0o755); err != nil {
		testingObject.Fatalf("create VPN status directory: %v", err)
	}
	protectedID := "vpc-1000000000000001"
	unprotectedID := "vpc-2000000000000002"
	statuses := map[string]string{
		protectedID:   `{"state":"protected","slot":1,"address":"10.8.1.6","dnsServers":["9.9.9.9"]}`,
		unprotectedID: `{"state":"blocked","slot":2,"address":"","dnsServers":["1.1.1.1"]}`,
	}
	for connectionID, status := range statuses {
		if err := os.WriteFile(
			filepath.Join(statusDirectory, connectionID+".json"),
			[]byte(status),
			0o644,
		); err != nil {
			testingObject.Fatalf("write %s status: %v", connectionID, err)
		}
	}
	service.vpnState = &vpnStateCache{
		directory: statusDirectory,
		clock:     time.Now,
		entries:   map[string]cachedVPNState{},
	}
	var dialCount atomic.Int32
	service.rawDialContext = nil
	service.dialContext = func(
		*net.Dialer,
		context.Context,
		string,
		string,
	) (net.Conn, error) {
		dialCount.Add(1)

		return nil, errors.New("test dial stopped")
	}

	_, err := service.dialGuardedForLogin(
		context.Background(),
		Login{ConnectionID: unprotectedID},
		"tcp",
		"8.8.8.8:443",
	)
	if !errors.Is(err, errVPNNotProtected) || dialCount.Load() != 0 {
		testingObject.Fatalf("unprotected selected dial = %v, count %d", err, dialCount.Load())
	}
	_, err = service.dialGuardedForLogin(
		context.Background(),
		Login{ConnectionID: protectedID},
		"tcp",
		"8.8.8.8:443",
	)
	if err == nil || errors.Is(err, errVPNNotProtected) || dialCount.Load() != 1 {
		testingObject.Fatalf("protected selected dial = %v, count %d", err, dialCount.Load())
	}
}

// TestProxyStatusListensWhileAnyLoginIsProtected covers aggregate runtime state.
func TestProxyStatusListensWhileAnyLoginIsProtected(testingObject *testing.T) {
	service := newProtocolTestService(testingObject)
	statusDirectory := filepath.Join(testingObject.TempDir(), "vpn.status.d")
	if err := os.MkdirAll(statusDirectory, 0o755); err != nil {
		testingObject.Fatalf("create VPN status directory: %v", err)
	}
	protectedID := "vpc-1000000000000001"
	blockedID := "vpc-2000000000000002"
	protectedPath := filepath.Join(statusDirectory, protectedID+".json")
	blockedPath := filepath.Join(statusDirectory, blockedID+".json")
	if err := os.WriteFile(
		protectedPath,
		[]byte(`{"state":"protected","slot":0,"dnsServers":["9.9.9.9"]}`),
		0o644,
	); err != nil {
		testingObject.Fatalf("write protected VPN status: %v", err)
	}
	if err := os.WriteFile(
		blockedPath,
		[]byte(`{"state":"blocked","slot":1,"dnsServers":["1.1.1.1"]}`),
		0o644,
	); err != nil {
		testingObject.Fatalf("write blocked VPN status: %v", err)
	}
	now := time.Now()
	service.vpnState = &vpnStateCache{
		directory: statusDirectory,
		clock:     func() time.Time { return now },
		entries:   map[string]cachedVPNState{},
	}
	service.mutex.Lock()
	service.runtimeConfig = RuntimeConfig{
		Enabled: true,
		Logins: []Login{
			{ID: "wpl-0000000000000001", ConnectionID: protectedID},
			{ID: "wpl-0000000000000002", ConnectionID: blockedID},
		},
	}
	service.listener = newBlockingListener()
	service.mutex.Unlock()
	defer service.shutdown()
	if err := service.publishStatus(); err != nil {
		testingObject.Fatalf("publish protected proxy status: %v", err)
	}
	if status := readTestStatus(testingObject, service.config.StatusPath); status.State != "listening" {
		testingObject.Fatalf("partially protected proxy status = %+v", status)
	}

	if err := os.WriteFile(
		protectedPath,
		[]byte(`{"state":"blocked","slot":0,"dnsServers":["9.9.9.9"]}`),
		0o644,
	); err != nil {
		testingObject.Fatalf("block protected VPN status: %v", err)
	}
	now = now.Add(2 * time.Second)
	if err := service.publishStatus(); err != nil {
		testingObject.Fatalf("publish blocked proxy status: %v", err)
	}
	if status := readTestStatus(testingObject, service.config.StatusPath); status.State != "waiting-for-vpn" {
		testingObject.Fatalf("fully blocked proxy status = %+v", status)
	}
}

// TestVPNStateCacheUsesSlotAddress keeps provider addresses out of proxy sockets.
func TestVPNStateCacheUsesSlotAddress(testingObject *testing.T) {
	statusPath := filepath.Join(testingObject.TempDir(), "vpn.status")
	if err := os.WriteFile(
		statusPath,
		[]byte(`{"state":"protected","slot":3,"address":"10.8.0.6"}`),
		0o644,
	); err != nil {
		testingObject.Fatalf("write VPN status: %v", err)
	}
	cache := &vpnStateCache{path: statusPath, clock: time.Now}
	if !cache.protected() || cache.address() != "198.18.3.1" {
		testingObject.Fatalf(
			"cached VPN state protected/address = %t/%q",
			cache.protected(),
			cache.address(),
		)
	}
}

// TestVPNNotProtectedResponses verifies HTTP 503 and SOCKS5 general failure behavior.
func TestVPNNotProtectedResponses(testingObject *testing.T) {
	service := newProtocolTestService(testingObject)
	service.vpnProtected = func() bool { return false }

	authorization := basicProxyAuthorization(testProxyUsername, testProxyPassword)
	response := runHTTPProxyRequest(
		testingObject,
		service,
		"GET http://1.1.1.1/ HTTP/1.1\r\nHost: 1.1.1.1\r\nProxy-Authorization: "+authorization+"\r\nConnection: close\r\n\r\n",
	)
	body, _ := io.ReadAll(response.Body)
	_ = response.Body.Close()
	if response.StatusCode != http.StatusServiceUnavailable || !strings.Contains(string(body), "VPN isn't connected") {
		testingObject.Fatalf("HTTP VPN response = %d %q", response.StatusCode, body)
	}

	withProxyConnection(testingObject, service, func(connection net.Conn, reader *bufio.Reader) {
		performSOCKSAuthentication(testingObject, connection, reader)
		request := []byte{socksVersion, socksCommandConnect, 0x00, socksAddressIPv4, 1, 1, 1, 1, 0, 80}
		if _, err := connection.Write(request); err != nil {
			testingObject.Fatalf("write SOCKS request: %v", err)
		}
		reply := make([]byte, 10)
		if _, err := io.ReadFull(reader, reply); err != nil {
			testingObject.Fatalf("read SOCKS reply: %v", err)
		}
		if reply[1] != socksReplyGeneralFailure {
			testingObject.Fatalf("SOCKS VPN reply = %v", reply)
		}
	})
}

// TestHTTPHeadersArrivingInThreeWrites covers lengths that crossed old Peek doublings.
func TestHTTPHeadersArrivingInThreeWrites(testingObject *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(
		responseWriter http.ResponseWriter,
		_ *http.Request,
	) {
		_, _ = responseWriter.Write([]byte("ok"))
	}))
	defer upstream.Close()

	testCases := []struct {
		name           string
		headerLength   int
		vpnProtected   bool
		expectedStatus int
	}{
		{name: "150 bytes while VPN is down", headerLength: 150, expectedStatus: http.StatusServiceUnavailable},
		{name: "150 bytes while VPN is up", headerLength: 150, vpnProtected: true, expectedStatus: http.StatusOK},
		{name: "255 bytes", headerLength: 255, expectedStatus: http.StatusServiceUnavailable},
		{name: "256 bytes", headerLength: 256, expectedStatus: http.StatusServiceUnavailable},
		{name: "257 bytes", headerLength: 257, expectedStatus: http.StatusServiceUnavailable},
		{name: "511 bytes", headerLength: 511, expectedStatus: http.StatusServiceUnavailable},
		{name: "512 bytes", headerLength: 512, expectedStatus: http.StatusServiceUnavailable},
		{name: "513 bytes", headerLength: 513, expectedStatus: http.StatusServiceUnavailable},
	}

	for _, testCase := range testCases {
		testingObject.Run(testCase.name, func(testingObject *testing.T) {
			service := newProtocolTestService(testingObject)
			service.vpnProtected = func() bool { return testCase.vpnProtected }
			if testCase.vpnProtected {
				dialer := &net.Dialer{}
				upstreamAddress := upstream.Listener.Addr().String()
				service.rawDialContext = func(
					ctx context.Context,
					network string,
					_ string,
				) (net.Conn, error) {
					return dialer.DialContext(ctx, network, upstreamAddress)
				}
			}

			requestText := httpProxyRequestWithLength(testingObject, testCase.headerLength)
			response := runHTTPProxyRequestParts(
				testingObject,
				service,
				splitHTTPHeaderWrites(testingObject, requestText),
			)
			if response.StatusCode != testCase.expectedStatus {
				testingObject.Fatalf(
					"response status = %d, want %d",
					response.StatusCode,
					testCase.expectedStatus,
				)
			}
			_ = response.Body.Close()
		})
	}
}

// TestHTTPHeaderLimit keeps the accepted request-header boundary at 64 KiB.
func TestHTTPHeaderLimit(testingObject *testing.T) {
	service := newProtocolTestService(testingObject)
	service.vpnProtected = func() bool { return false }

	testCases := []struct {
		name           string
		headerLength   int
		expectedStatus int
	}{
		{name: "at limit", headerLength: maximumHeaderBytes, expectedStatus: http.StatusServiceUnavailable},
		{name: "over limit", headerLength: maximumHeaderBytes + 1, expectedStatus: http.StatusRequestHeaderFieldsTooLarge},
	}

	for _, testCase := range testCases {
		testingObject.Run(testCase.name, func(testingObject *testing.T) {
			requestText := httpProxyRequestWithLength(testingObject, testCase.headerLength)
			response := runHTTPProxyRequestParts(
				testingObject,
				service,
				splitHTTPHeaderWrites(testingObject, requestText),
			)
			if response.StatusCode != testCase.expectedStatus {
				testingObject.Fatalf(
					"response status = %d, want %d",
					response.StatusCode,
					testCase.expectedStatus,
				)
			}
			_ = response.Body.Close()
		})
	}
}

// TestHTTPHeaderDeadlineClosesStalledClients covers one-byte and partial headers.
func TestHTTPHeaderDeadlineClosesStalledClients(testingObject *testing.T) {
	for _, testCase := range []struct {
		name    string
		content string
	}{
		{name: "one byte", content: "G"},
		{name: "partial header", content: "GET http://1.1.1.1/ HTTP/1.1\r\nHost: 1.1.1.1\r\n"},
	} {
		testingObject.Run(testCase.name, func(testingObject *testing.T) {
			service := newProtocolTestService(testingObject)
			service.headerTimeout = 75 * time.Millisecond

			withProxyConnection(testingObject, service, func(connection net.Conn, reader *bufio.Reader) {
				if _, err := io.WriteString(connection, testCase.content); err != nil {
					testingObject.Fatalf("write partial HTTP header: %v", err)
				}

				startedAt := time.Now()
				_, err := reader.ReadByte()
				if !errors.Is(err, io.EOF) {
					testingObject.Fatalf("stalled HTTP read error = %v, want EOF", err)
				}
				if elapsed := time.Since(startedAt); elapsed > time.Second {
					testingObject.Fatalf("stalled HTTP connection closed after %s", elapsed)
				}
			})
		})
	}
}

// TestHTTPKeepAliveIdleTimeoutClosesConnection bounds the wait for another request.
func TestHTTPKeepAliveIdleTimeoutClosesConnection(testingObject *testing.T) {
	service := newProtocolTestService(testingObject)
	service.keepAliveTimeout = 75 * time.Millisecond
	upstream := httptest.NewServer(http.HandlerFunc(func(
		responseWriter http.ResponseWriter,
		_ *http.Request,
	) {
		_, _ = responseWriter.Write([]byte("ok"))
	}))
	defer upstream.Close()

	withProxyConnection(testingObject, service, func(connection net.Conn, reader *bufio.Reader) {
		authorization := basicProxyAuthorization(testProxyUsername, testProxyPassword)
		requestText := "GET " + upstream.URL + "/ HTTP/1.1\r\nHost: origin.test\r\n" +
			"Proxy-Authorization: " + authorization + "\r\n\r\n"
		if _, err := io.WriteString(connection, requestText); err != nil {
			testingObject.Fatalf("write keep-alive request: %v", err)
		}

		response, err := http.ReadResponse(reader, &http.Request{Method: http.MethodGet})
		if err != nil {
			testingObject.Fatalf("read keep-alive response: %v", err)
		}
		body, err := io.ReadAll(response.Body)
		_ = response.Body.Close()
		if err != nil || response.StatusCode != http.StatusOK || string(body) != "ok" {
			testingObject.Fatalf("keep-alive response = %d %q, %v", response.StatusCode, body, err)
		}

		_, err = reader.ReadByte()
		if !errors.Is(err, io.EOF) {
			testingObject.Fatalf("idle keep-alive read error = %v, want EOF", err)
		}
	})
}

// TestHTTPKeepAliveNextHeaderUsesHeaderDeadline resets timing after the first byte.
func TestHTTPKeepAliveNextHeaderUsesHeaderDeadline(testingObject *testing.T) {
	service := newProtocolTestService(testingObject)
	service.headerTimeout = 75 * time.Millisecond
	service.keepAliveTimeout = time.Second
	upstream := httptest.NewServer(http.HandlerFunc(func(
		responseWriter http.ResponseWriter,
		_ *http.Request,
	) {
		_, _ = responseWriter.Write([]byte("ok"))
	}))
	defer upstream.Close()

	withProxyConnection(testingObject, service, func(connection net.Conn, reader *bufio.Reader) {
		authorization := basicProxyAuthorization(testProxyUsername, testProxyPassword)
		requestText := "GET " + upstream.URL + "/ HTTP/1.1\r\nHost: origin.test\r\n" +
			"Proxy-Authorization: " + authorization + "\r\n\r\n"
		if _, err := io.WriteString(connection, requestText); err != nil {
			testingObject.Fatalf("write first keep-alive request: %v", err)
		}

		response, err := http.ReadResponse(reader, &http.Request{Method: http.MethodGet})
		if err != nil {
			testingObject.Fatalf("read first keep-alive response: %v", err)
		}
		if _, err := io.ReadAll(response.Body); err != nil {
			testingObject.Fatalf("read first keep-alive response body: %v", err)
		}
		_ = response.Body.Close()

		if _, err := io.WriteString(connection, "G"); err != nil {
			testingObject.Fatalf("write next partial header: %v", err)
		}
		startedAt := time.Now()
		_, err = reader.ReadByte()
		if !errors.Is(err, io.EOF) {
			testingObject.Fatalf("partial keep-alive header read error = %v, want EOF", err)
		}
		if elapsed := time.Since(startedAt); elapsed > 500*time.Millisecond {
			testingObject.Fatalf("partial keep-alive header closed after %s", elapsed)
		}
	})
}

// TestSOCKS5HandshakeDeadlineClosesConnection bounds every negotiation phase together.
func TestSOCKS5HandshakeDeadlineClosesConnection(testingObject *testing.T) {
	service := newProtocolTestService(testingObject)
	service.socksTimeout = 75 * time.Millisecond

	withProxyConnection(testingObject, service, func(connection net.Conn, reader *bufio.Reader) {
		performSOCKSAuthentication(testingObject, connection, reader)

		_, err := reader.ReadByte()
		if !errors.Is(err, io.EOF) {
			testingObject.Fatalf("stalled SOCKS5 read error = %v, want EOF", err)
		}
	})
}

// TestHTTPConnectOutlivesHeaderDeadline verifies the tunnel clears request timing.
func TestHTTPConnectOutlivesHeaderDeadline(testingObject *testing.T) {
	service := newProtocolTestService(testingObject)
	service.headerTimeout = 75 * time.Millisecond
	payload := []byte("still open")
	target := startEchoServer(testingObject, len(payload))

	withProxyConnection(testingObject, service, func(connection net.Conn, reader *bufio.Reader) {
		authorization := basicProxyAuthorization(testProxyUsername, testProxyPassword)
		requestText := "CONNECT " + target + " HTTP/1.1\r\nHost: " + target + "\r\n" +
			"Proxy-Authorization: " + authorization + "\r\n\r\n"
		if _, err := io.WriteString(connection, requestText); err != nil {
			testingObject.Fatalf("write CONNECT request: %v", err)
		}

		statusLine, err := reader.ReadString('\n')
		if err != nil || !strings.Contains(statusLine, " 200 ") {
			testingObject.Fatalf("CONNECT status = %q, %v", statusLine, err)
		}
		for {
			line, readError := reader.ReadString('\n')
			if readError != nil {
				testingObject.Fatalf("read CONNECT headers: %v", readError)
			}
			if line == "\r\n" {
				break
			}
		}

		time.Sleep(2 * service.headerTimeout)
		if _, err := connection.Write(payload); err != nil {
			testingObject.Fatalf("write delayed tunnel payload: %v", err)
		}
		echoed := make([]byte, len(payload))
		if _, err := io.ReadFull(reader, echoed); err != nil || !bytes.Equal(echoed, payload) {
			testingObject.Fatalf("delayed tunnel echo = %q, %v", echoed, err)
		}
	})
}

// TestHTTPConnectAndAbsoluteForwarding verifies both HTTP proxy modes against test peers.
func TestHTTPConnectAndAbsoluteForwarding(testingObject *testing.T) {
	testingObject.Run("absolute form", func(testingObject *testing.T) {
		service := newProtocolTestService(testingObject)
		upstreamRequest := make(chan *http.Request, 1)
		upstream := httptest.NewServer(http.HandlerFunc(func(
			responseWriter http.ResponseWriter,
			request *http.Request,
		) {
			upstreamRequest <- request.Clone(request.Context())
			_, _ = responseWriter.Write([]byte("ok"))
		}))
		defer upstream.Close()

		authorization := basicProxyAuthorization(testProxyUsername, testProxyPassword)
		response := runHTTPProxyRequest(
			testingObject,
			service,
			"GET "+upstream.URL+"/resource HTTP/1.1\r\nHost: origin.example\r\n"+
				"Proxy-Authorization: "+authorization+"\r\nProxy-Connection: keep-alive\r\n"+
				"Connection: close, X-Hop\r\nX-Hop: remove-me\r\n\r\n",
		)
		body, _ := io.ReadAll(response.Body)
		_ = response.Body.Close()
		if response.StatusCode != http.StatusOK || string(body) != "ok" {
			testingObject.Fatalf("absolute response = %d %q", response.StatusCode, body)
		}

		select {
		case request := <-upstreamRequest:
			if request.Close ||
				request.URL.Path != "/resource" ||
				request.Header.Get("Proxy-Authorization") != "" ||
				request.Header.Get("Proxy-Connection") != "" ||
				request.Header.Get("X-Hop") != "" {
				testingObject.Fatalf("forwarded request = %+v headers %+v", request.URL, request.Header)
			}
		case <-time.After(time.Second):
			testingObject.Fatal("upstream request was not received")
		}
	})

	testingObject.Run("CONNECT", func(testingObject *testing.T) {
		service := newProtocolTestService(testingObject)
		target := startEchoServer(testingObject, 5)

		withProxyConnection(testingObject, service, func(connection net.Conn, reader *bufio.Reader) {
			authorization := basicProxyAuthorization(testProxyUsername, testProxyPassword)
			request := "CONNECT " + target + " HTTP/1.1\r\nHost: " + target + "\r\n" +
				"Proxy-Authorization: " + authorization + "\r\n\r\n"
			if _, err := io.WriteString(connection, request); err != nil {
				testingObject.Fatalf("write CONNECT: %v", err)
			}
			statusLine, err := reader.ReadString('\n')
			if err != nil || !strings.Contains(statusLine, " 200 ") {
				testingObject.Fatalf("CONNECT status = %q, %v", statusLine, err)
			}
			for {
				line, readError := reader.ReadString('\n')
				if readError != nil {
					testingObject.Fatalf("read CONNECT headers: %v", readError)
				}
				if line == "\r\n" {
					break
				}
			}

			if _, err := connection.Write([]byte("hello")); err != nil {
				testingObject.Fatalf("write tunnel: %v", err)
			}
			echoed := make([]byte, 5)
			if _, err := io.ReadFull(reader, echoed); err != nil || string(echoed) != "hello" {
				testingObject.Fatalf("tunnel echo = %q, %v", echoed, err)
			}
		})
	})
}

// TestSOCKS5ConnectWithDomain verifies proxy-side resolution and domain CONNECT.
func TestSOCKS5ConnectWithDomain(testingObject *testing.T) {
	service := newProtocolTestService(testingObject)
	service.resolver = staticResolver{addresses: []netip.Addr{netip.MustParseAddr("127.0.0.1")}}
	target := startEchoServer(testingObject, 4)
	_, portText, err := net.SplitHostPort(target)
	if err != nil {
		testingObject.Fatalf("split echo address: %v", err)
	}
	port, err := strconv.Atoi(portText)
	if err != nil {
		testingObject.Fatalf("parse echo port: %v", err)
	}

	withProxyConnection(testingObject, service, func(connection net.Conn, reader *bufio.Reader) {
		performSOCKSAuthentication(testingObject, connection, reader)
		domain := "origin.test"
		request := []byte{socksVersion, socksCommandConnect, 0x00, socksAddressDomain, byte(len(domain))}
		request = append(request, []byte(domain)...)
		portBytes := make([]byte, 2)
		binary.BigEndian.PutUint16(portBytes, uint16(port))
		request = append(request, portBytes...)
		if _, err := connection.Write(request); err != nil {
			testingObject.Fatalf("write domain CONNECT: %v", err)
		}

		reply := make([]byte, 10)
		if _, err := io.ReadFull(reader, reply); err != nil || reply[1] != socksReplySucceeded {
			testingObject.Fatalf("domain CONNECT reply = %v, %v", reply, err)
		}
		if _, err := connection.Write([]byte("ping")); err != nil {
			testingObject.Fatalf("write domain tunnel: %v", err)
		}
		echoed := make([]byte, 4)
		if _, err := io.ReadFull(reader, echoed); err != nil || string(echoed) != "ping" {
			testingObject.Fatalf("domain tunnel echo = %q, %v", echoed, err)
		}
	})
}

// startEchoServer opens one local TCP peer and echoes a fixed-size tunnel payload.
func startEchoServer(testingObject *testing.T, payloadSize int) string {
	testingObject.Helper()

	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		testingObject.Fatalf("listen for echo server: %v", err)
	}
	testingObject.Cleanup(func() { _ = listener.Close() })

	go func() {
		connection, acceptError := listener.Accept()
		if acceptError != nil {
			return
		}
		defer connection.Close()

		content := make([]byte, payloadSize)
		if _, readError := io.ReadFull(connection, content); readError == nil {
			_, _ = connection.Write(content)
		}
	}()

	return listener.Addr().String()
}

// TestFailedLoginLimiter blocks ten failures for five minutes and then recovers.
func TestFailedLoginLimiter(testingObject *testing.T) {
	now := time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC)
	authentication := newAuthenticator(
		[]byte("01234567890123456789012345678901"),
		"dummy-hash",
		func(context.Context, string, string) (bool, error) { return false, nil },
		func() time.Time { return now },
	)
	authentication.setLogins([]Login{{Username: testProxyUsername, PasswordHash: "hash"}})

	for attempt := 1; attempt < loginFailureLimit; attempt++ {
		if result := authenticateForTest(authentication, testProxyUsername, "wrong", "client"); result != authenticationInvalid {
			testingObject.Fatalf("failure %d result = %v", attempt, result)
		}
	}
	if result := authenticateForTest(authentication, testProxyUsername, "wrong", "client"); result != authenticationBlocked {
		testingObject.Fatalf("threshold result = %v", result)
	}
	if !authentication.blocked("client") {
		testingObject.Fatal("client was not blocked")
	}

	now = now.Add(loginBlockDuration)
	if authentication.blocked("client") {
		testingObject.Fatal("client stayed blocked after five minutes")
	}

	testingObject.Run("protocol responses", func(testingObject *testing.T) {
		service := newProtocolTestService(testingObject)
		authorization := basicProxyAuthorization(testProxyUsername, "the wrong password")
		request := "GET http://1.1.1.1/ HTTP/1.1\r\nHost: 1.1.1.1\r\n" +
			"Proxy-Authorization: " + authorization + "\r\nConnection: close\r\n\r\n"

		for attempt := 1; attempt <= loginFailureLimit; attempt++ {
			response := runHTTPProxyRequest(testingObject, service, request)
			_ = response.Body.Close()
			expectedStatus := http.StatusProxyAuthRequired
			if attempt == loginFailureLimit {
				expectedStatus = http.StatusTooManyRequests
			}
			if response.StatusCode != expectedStatus {
				testingObject.Fatalf(
					"failure %d HTTP status = %d, want %d",
					attempt,
					response.StatusCode,
					expectedStatus,
				)
			}
		}

		withProxyConnection(testingObject, service, func(connection net.Conn, reader *bufio.Reader) {
			performSOCKSGreeting(testingObject, connection, reader)
			writeSOCKSCredentials(testingObject, connection, testProxyUsername, testProxyPassword)
			response := make([]byte, 2)
			if _, err := io.ReadFull(reader, response); err != nil {
				testingObject.Fatalf("read blocked SOCKS authentication: %v", err)
			}
			if response[0] != 0x01 || response[1] == 0x00 {
				testingObject.Fatalf("blocked SOCKS authentication response = %v", response)
			}
		})
	})
}

// TestSuccessfulLoginCache bounds entries and avoids repeated password verification.
func TestSuccessfulLoginCache(testingObject *testing.T) {
	now := time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC)
	verificationCount := 0
	authentication := newAuthenticator(
		[]byte("01234567890123456789012345678901"),
		"dummy-hash",
		func(context.Context, string, string) (bool, error) {
			verificationCount++

			return true, nil
		},
		func() time.Time { return now },
	)
	authentication.setLogins([]Login{{Username: testProxyUsername, PasswordHash: "hash"}})

	if authenticateForTest(authentication, testProxyUsername, testProxyPassword, "client") != authenticationAllowed ||
		authenticateForTest(authentication, testProxyUsername, testProxyPassword, "client") != authenticationAllowed ||
		verificationCount != 1 {
		testingObject.Fatalf("cache verification count = %d", verificationCount)
	}

	for index := 0; index < maximumAuthenticationCache+50; index++ {
		password := testProxyPassword + string(rune(index+1000))
		if authenticateForTest(authentication, testProxyUsername, password, "client") != authenticationAllowed {
			testingObject.Fatalf("cache fill %d was refused", index)
		}
	}
	if len(authentication.cache) > maximumAuthenticationCache {
		testingObject.Fatalf("cache size = %d", len(authentication.cache))
	}

	now = now.Add(authenticationCacheLifetime)
	beforeExpiryCheck := verificationCount
	if authenticateForTest(authentication, testProxyUsername, testProxyPassword, "client") != authenticationAllowed ||
		verificationCount != beforeExpiryCheck+1 {
		testingObject.Fatal("expired cache entry did not run password verification")
	}
}

// TestConfigReloadOpensAndClosesListener verifies the opt-in port lifecycle.
//
// Enabling opens the listener even with no logins so authentication can refuse every
// attempt, while disabling still closes the listener and its active connections.
//
// Since: 2.0.0
func TestConfigReloadOpensAndClosesListener(testingObject *testing.T) {
	service := newProtocolTestService(testingObject)
	service.vpnProtected = func() bool { return false }
	listener := newBlockingListener()
	service.listen = func(string, string) (net.Listener, error) {
		return listener, nil
	}

	configuration := RuntimeConfig{
		Enabled: true,
		Logins:  []Login{},
	}
	writeRuntimeConfig(testingObject, service.config.ConfigPath, configuration)
	if err := service.reloadConfiguration(context.Background()); err != nil {
		testingObject.Fatalf("enable reload: %v", err)
	}
	service.mutex.Lock()
	opened := service.listener == listener
	service.mutex.Unlock()
	if !opened {
		testingObject.Fatal("enabled config did not open the listener")
	}
	if status := readTestStatus(testingObject, service.config.StatusPath); status.State != "listening" {
		testingObject.Fatalf("enabled status = %+v", status)
	}

	configuration.Enabled = false
	writeRuntimeConfig(testingObject, service.config.ConfigPath, configuration)
	if err := service.reloadConfiguration(context.Background()); err != nil {
		testingObject.Fatalf("disable reload: %v", err)
	}
	service.mutex.Lock()
	closed := service.listener == nil
	service.mutex.Unlock()
	if !closed || !listener.isClosed() {
		testingObject.Fatal("disabled config did not close the listener")
	}
	if status := readTestStatus(testingObject, service.config.StatusPath); status.State != "off" {
		testingObject.Fatalf("disabled status = %+v", status)
	}
	service.shutdown()
}

// TestRunPublishesReadinessAndShutsDown verifies the supervised process lifecycle.
func TestRunPublishesReadinessAndShutsDown(testingObject *testing.T) {
	service := newProtocolTestService(testingObject)
	service.configInterval = time.Hour
	service.statusInterval = time.Hour

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	completed := make(chan error, 1)
	go func() { completed <- service.Run(ctx) }()

	deadline := time.Now().Add(time.Second)
	for {
		information, err := os.Stat(service.config.ReadyPath)
		if err == nil {
			if permissions := information.Mode().Perm(); permissions != 0o644 {
				testingObject.Fatalf("readiness permissions = %o", permissions)
			}
			content, readError := os.ReadFile(service.config.ReadyPath)
			if readError != nil ||
				!strings.Contains(string(content), `"service":"web-proxy"`) ||
				!strings.Contains(string(content), `"phase":"proxy"`) {
				testingObject.Fatalf("readiness marker = %q, %v", content, readError)
			}

			break
		}
		if !errors.Is(err, os.ErrNotExist) {
			testingObject.Fatalf("inspect readiness marker: %v", err)
		}
		if time.Now().After(deadline) {
			testingObject.Fatal("proxy readiness marker was not published")
		}

		time.Sleep(10 * time.Millisecond)
	}

	cancel()
	select {
	case err := <-completed:
		if err != nil {
			testingObject.Fatalf("run proxy: %v", err)
		}
	case <-time.After(time.Second):
		testingObject.Fatal("proxy did not shut down after cancellation")
	}
	if _, err := os.Stat(service.config.ReadyPath); !errors.Is(err, os.ErrNotExist) {
		testingObject.Fatalf("readiness marker survived shutdown: %v", err)
	}
}

// readTestStatus decodes one status artifact written during a configuration transition.
func readTestStatus(testingObject *testing.T, path string) Status {
	testingObject.Helper()

	content, err := os.ReadFile(path)
	if err != nil {
		testingObject.Fatalf("read proxy status: %v", err)
	}
	information, err := os.Stat(path)
	if err != nil {
		testingObject.Fatalf("stat proxy status: %v", err)
	}
	if permissions := information.Mode().Perm(); permissions != 0o640 {
		testingObject.Fatalf("proxy status permissions = %o", permissions)
	}

	var status Status
	if err := json.Unmarshal(content, &status); err != nil {
		testingObject.Fatalf("decode proxy status: %v", err)
	}
	if status.UpdatedAt.IsZero() {
		testingObject.Fatal("proxy status has no update time")
	}

	return status
}

// staticResolver returns a deterministic set of addresses without using host DNS.
type staticResolver struct {
	addresses []netip.Addr
	err       error
}

// LookupNetIP implements addressResolver.
func (resolver staticResolver) LookupNetIP(
	context.Context,
	string,
	string,
) ([]netip.Addr, error) {
	return resolver.addresses, resolver.err
}

// blockingListener exposes open and closed state without binding a host socket.
type blockingListener struct {
	closed    chan struct{}
	closeOnce sync.Once
}

// newBlockingListener creates a listener whose Accept waits until Close.
func newBlockingListener() *blockingListener {
	return &blockingListener{closed: make(chan struct{})}
}

// Accept blocks until the test closes the listener.
func (listener *blockingListener) Accept() (net.Conn, error) {
	<-listener.closed

	return nil, net.ErrClosed
}

// Close releases Accept exactly once.
func (listener *blockingListener) Close() error {
	listener.closeOnce.Do(func() { close(listener.closed) })

	return nil
}

// Addr returns a stable diagnostic address.
func (listener *blockingListener) Addr() net.Addr {
	return testAddress("proxy-listener")
}

// isClosed reports whether Close released the listener.
func (listener *blockingListener) isClosed() bool {
	select {
	case <-listener.closed:
		return true
	default:
		return false
	}
}

// testAddress implements net.Addr for in-memory test connections and listeners.
type testAddress string

// Network identifies the in-memory address family.
func (address testAddress) Network() string { return "test" }

// String returns the stable test address.
func (address testAddress) String() string { return string(address) }

// newProtocolTestService creates an enabled service with deterministic credentials.
func newProtocolTestService(testingObject *testing.T) *Service {
	testingObject.Helper()

	temporaryDirectory := testingObject.TempDir()
	configDirectory := filepath.Join(temporaryDirectory, "config")
	statusDirectory := filepath.Join(temporaryDirectory, "status")
	readyDirectory := filepath.Join(temporaryDirectory, "services")
	for _, directory := range []string{configDirectory, statusDirectory, readyDirectory} {
		if err := os.MkdirAll(directory, 0o755); err != nil {
			testingObject.Fatalf("create test runtime directory: %v", err)
		}
	}

	service, err := New(Config{
		ListenAddress: "test",
		ConfigPath:    filepath.Join(configDirectory, "config.json"),
		StatusPath:    filepath.Join(statusDirectory, "status.json"),
		VPNStatusPath: filepath.Join(temporaryDirectory, "vpn.status"),
		ReadyPath:     filepath.Join(readyDirectory, "web-proxy.ready"),
		Logger:        slog.New(slog.NewTextHandler(io.Discard, nil)),
	})
	if err != nil {
		testingObject.Fatalf("create web proxy: %v", err)
	}

	service.clientAllowed = func(net.Addr) bool { return true }
	service.destinationAllowed = func(net.IP) bool { return true }
	service.vpnProtected = func() bool { return true }
	service.vpnAddress = func() string { return "127.0.0.1" }
	service.authenticator = newAuthenticator(
		[]byte("01234567890123456789012345678901"),
		"dummy-hash",
		func(_ context.Context, password string, _ string) (bool, error) {
			return password == testProxyPassword, nil
		},
		time.Now,
	)
	service.authenticator.setLogins([]Login{
		{ID: "wpl-0000000000000001", Username: testProxyUsername, PasswordHash: "test-hash"},
	})

	return service
}

// authenticateForTest runs one authentication attempt without a cancellation deadline.
func authenticateForTest(
	authentication *authenticator,
	username string,
	password string,
	clientKey string,
) authenticationResult {
	result, _ := authentication.authenticate(context.Background(), username, password, clientKey)

	return result
}

// withProxyConnection runs one protocol exchange over an in-memory full-duplex socket.
func withProxyConnection(
	testingObject *testing.T,
	service *Service,
	client func(net.Conn, *bufio.Reader),
) {
	testingObject.Helper()

	clientConnection, serverConnection := net.Pipe()
	if err := clientConnection.SetDeadline(time.Now().Add(5 * time.Second)); err != nil {
		testingObject.Fatalf("set client deadline: %v", err)
	}
	completed := make(chan struct{})
	go func() {
		service.handleConnection(context.Background(), serverConnection)
		_ = serverConnection.Close()
		close(completed)
	}()

	client(clientConnection, bufio.NewReader(clientConnection))
	_ = clientConnection.Close()

	select {
	case <-completed:
	case <-time.After(5 * time.Second):
		testingObject.Fatal("proxy connection did not finish")
	}
}

// runHTTPProxyRequest performs one request and returns its parsed proxy response.
func runHTTPProxyRequest(
	testingObject *testing.T,
	service *Service,
	requestText string,
) *http.Response {
	testingObject.Helper()

	return runHTTPProxyRequestParts(testingObject, service, []string{requestText})
}

// runHTTPProxyRequestParts sends request fragments before parsing one proxy response.
func runHTTPProxyRequestParts(
	testingObject *testing.T,
	service *Service,
	requestParts []string,
) *http.Response {
	testingObject.Helper()

	var response *http.Response
	withProxyConnection(testingObject, service, func(connection net.Conn, reader *bufio.Reader) {
		for requestIndex, requestPart := range requestParts {
			if _, err := io.WriteString(connection, requestPart); err != nil {
				testingObject.Fatalf("write HTTP proxy request part %d: %v", requestIndex+1, err)
			}
			if requestIndex+1 < len(requestParts) {
				time.Sleep(5 * time.Millisecond)
			}
		}
		if err := connection.SetReadDeadline(time.Now().Add(time.Second)); err != nil {
			testingObject.Fatalf("set HTTP proxy response deadline: %v", err)
		}

		request := &http.Request{Method: http.MethodGet}
		parsed, err := http.ReadResponse(reader, request)
		if err != nil {
			testingObject.Fatalf("read HTTP proxy response: %v", err)
		}
		body, err := io.ReadAll(parsed.Body)
		if err != nil {
			testingObject.Fatalf("read HTTP proxy response body: %v", err)
		}
		_ = parsed.Body.Close()
		parsed.Body = io.NopCloser(bytes.NewReader(body))
		response = parsed
	})

	return response
}

// httpProxyRequestWithLength builds one authenticated header with an exact byte count.
func httpProxyRequestWithLength(testingObject *testing.T, headerLength int) string {
	testingObject.Helper()

	authorization := basicProxyAuthorization(testProxyUsername, testProxyPassword)
	prefix := "GET http://1.1.1.1/ HTTP/1.1\r\nHost: x\r\n" +
		"Proxy-Authorization: " + authorization + "\r\nX-Padding: "
	suffix := "\r\n\r\n"
	paddingLength := headerLength - len(prefix) - len(suffix)
	if paddingLength < 0 {
		testingObject.Fatalf("header length %d is smaller than minimum %d", headerLength, len(prefix)+len(suffix))
	}

	requestText := prefix + strings.Repeat("x", paddingLength) + suffix
	if len(requestText) != headerLength {
		testingObject.Fatalf("HTTP header length = %d, want %d", len(requestText), headerLength)
	}

	return requestText
}

// splitHTTPHeaderWrites separates the request line, remaining fields, and final CRLF.
func splitHTTPHeaderWrites(testingObject *testing.T, requestText string) []string {
	testingObject.Helper()

	firstLineEnd := strings.Index(requestText, "\r\n") + 2
	lastWriteStart := len(requestText) - 2
	if firstLineEnd < 2 || firstLineEnd >= lastWriteStart || !strings.HasSuffix(requestText, "\r\n\r\n") {
		testingObject.Fatal("HTTP test request cannot be split into three header writes")
	}

	return []string{
		requestText[:firstLineEnd],
		requestText[firstLineEnd:lastWriteStart],
		requestText[lastWriteStart:],
	}
}

// basicProxyAuthorization returns one Basic Proxy-Authorization field value.
func basicProxyAuthorization(username string, password string) string {
	encoded := base64.StdEncoding.EncodeToString([]byte(username + ":" + password))

	return "Basic " + encoded
}

// performSOCKSGreeting negotiates mandatory username/password authentication.
func performSOCKSGreeting(
	testingObject *testing.T,
	connection net.Conn,
	reader *bufio.Reader,
) {
	testingObject.Helper()

	if _, err := connection.Write([]byte{socksVersion, 0x01, socksUsernamePassword}); err != nil {
		testingObject.Fatalf("write SOCKS greeting: %v", err)
	}
	response := make([]byte, 2)
	if _, err := io.ReadFull(reader, response); err != nil {
		testingObject.Fatalf("read SOCKS greeting: %v", err)
	}
	if response[0] != socksVersion || response[1] != socksUsernamePassword {
		testingObject.Fatalf("SOCKS method response = %v", response)
	}
}

// performSOCKSAuthentication completes a successful RFC 1929 exchange.
func performSOCKSAuthentication(
	testingObject *testing.T,
	connection net.Conn,
	reader *bufio.Reader,
) {
	testingObject.Helper()

	performSOCKSGreeting(testingObject, connection, reader)
	writeSOCKSCredentials(testingObject, connection, testProxyUsername, testProxyPassword)
	response := make([]byte, 2)
	if _, err := io.ReadFull(reader, response); err != nil {
		testingObject.Fatalf("read SOCKS authentication: %v", err)
	}
	if response[0] != 0x01 || response[1] != 0x00 {
		testingObject.Fatalf("SOCKS authentication response = %v", response)
	}
}

// writeSOCKSCredentials sends one RFC 1929 username and password request.
func writeSOCKSCredentials(
	testingObject *testing.T,
	connection net.Conn,
	username string,
	password string,
) {
	testingObject.Helper()

	request := []byte{0x01, byte(len(username))}
	request = append(request, []byte(username)...)
	request = append(request, byte(len(password)))
	request = append(request, []byte(password)...)
	if _, err := connection.Write(request); err != nil {
		testingObject.Fatalf("write SOCKS credentials: %v", err)
	}
}

// writeRuntimeConfig publishes a complete test configuration.
func writeRuntimeConfig(
	testingObject *testing.T,
	path string,
	configuration RuntimeConfig,
) {
	testingObject.Helper()

	content, err := json.Marshal(configuration)
	if err != nil {
		testingObject.Fatalf("encode runtime config: %v", err)
	}
	if err := os.WriteFile(path, content, 0o640); err != nil {
		testingObject.Fatalf("write runtime config: %v", err)
	}
}
