package api

import (
	"context"
	"crypto/sha1"
	"encoding/base32"
	"encoding/hex"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionrpc"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/vpnhttp"
)

type torrentPreviewRoundTripFunc func(*http.Request) (*http.Response, error)

func (roundTrip torrentPreviewRoundTripFunc) RoundTrip(
	request *http.Request,
) (*http.Response, error) {
	return roundTrip(request)
}

type torrentPreviewZeroReader struct{}

func (torrentPreviewZeroReader) Read(content []byte) (int, error) {
	return len(content), nil
}

// TestTorrentMetainfoPreviewSingleFile verifies the exact v1 info name, size, and hash.
func TestTorrentMetainfoPreviewSingleFile(testingObject *testing.T) {
	const name = "archlinux-2026.11.01-x86_64.iso"
	info := "d" +
		bencodeStringForTorrentPreviewTest("length") + "i1395864371e" +
		bencodeStringForTorrentPreviewTest("name") + bencodeStringForTorrentPreviewTest(name) +
		"e"
	metainfo := []byte(
		"d" +
			bencodeStringForTorrentPreviewTest("announce") +
			bencodeStringForTorrentPreviewTest("https://tracker.example/announce") +
			bencodeStringForTorrentPreviewTest("info") + info +
			"e",
	)

	gotName, gotSize, gotHash, err := torrentMetainfoPreview(metainfo)
	if err != nil {
		testingObject.Fatalf("preview single-file metainfo: %v", err)
	}
	if gotName != name {
		testingObject.Fatalf("name = %q, want %q", gotName, name)
	}
	if gotSize != 1_395_864_371 {
		testingObject.Fatalf("size = %d, want 1395864371", gotSize)
	}
	if gotHash != torrentPreviewInfoHashForTest(info) {
		testingObject.Fatalf("hash = %q, want %q", gotHash, torrentPreviewInfoHashForTest(info))
	}
}

// TestTorrentMetainfoPreviewMultiFile verifies every v1 file length is summed once.
func TestTorrentMetainfoPreviewMultiFile(testingObject *testing.T) {
	const name = "Example release"
	firstFile := torrentPreviewFileForTest("disc-one.iso", 700)
	secondFile := torrentPreviewFileForTest("disc-two.iso", 624)
	info := "d" +
		bencodeStringForTorrentPreviewTest("files") + "l" + firstFile + secondFile + "e" +
		bencodeStringForTorrentPreviewTest("name") + bencodeStringForTorrentPreviewTest(name) +
		"e"
	metainfo := []byte("d" + bencodeStringForTorrentPreviewTest("info") + info + "e")

	gotName, gotSize, gotHash, err := torrentMetainfoPreview(metainfo)
	if err != nil {
		testingObject.Fatalf("preview multi-file metainfo: %v", err)
	}
	if gotName != name || gotSize != 1_324 || gotHash != torrentPreviewInfoHashForTest(info) {
		testingObject.Fatalf(
			"preview = name %q, size %d, hash %q",
			gotName,
			gotSize,
			gotHash,
		)
	}
}

// TestTorrentMagnetPreviewUsesDisplayNameAndHash verifies local-only magnet parsing.
func TestTorrentMagnetPreviewUsesDisplayNameAndHash(testingObject *testing.T) {
	expectedBytes := []byte("01234567890123456789")
	expectedHash := hex.EncodeToString(expectedBytes)
	base32Hash := base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(expectedBytes)
	link := "magnet:?xt=urn%3Abtih%3A" + strings.ToLower(base32Hash) +
		"&dn=Archlinux%202026.11.01"

	preview, ok := torrentMagnetPreview(link, 7)
	if !ok {
		testingObject.Fatal("valid magnet did not produce a preview")
	}
	if preview.Index != 7 || preview.Name != "Archlinux 2026.11.01" ||
		preview.Hash != expectedHash || preview.TotalSize != nil {
		testingObject.Fatalf("magnet preview = %#v", preview)
	}

	server := &Server{
		torrentPreviewClient: func(vpnhttp.Route) *http.Client {
			testingObject.Fatal("magnet preview attempted to create a network client")

			return nil
		},
	}
	request := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/torrents/preview",
		strings.NewReader(`{"links":["`+link+`"]}`),
	)
	response := httptest.NewRecorder()
	server.handlePreviewTorrentLinks(response, request)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), expectedHash) {
		testingObject.Fatalf("magnet handler status %d: %s", response.Code, response.Body.String())
	}
}

// TestTorrentPreviewRefusesUnsafeAddresses covers every forbidden destination class.
func TestTorrentPreviewRefusesUnsafeAddresses(testingObject *testing.T) {
	testCases := []struct {
		name    string
		address string
		want    string
	}{
		{name: "IPv4 loopback", address: "127.0.0.1", want: "loopback"},
		{name: "IPv6 loopback", address: "::1", want: "loopback"},
		{name: "IPv4 private ten", address: "10.0.0.1", want: "private"},
		{name: "IPv4 private seventeen", address: "172.16.0.1", want: "private"},
		{name: "IPv4 private nineteen", address: "192.168.0.1", want: "private"},
		{name: "IPv6 private", address: "fd00::1", want: "private"},
		{name: "IPv4 link local", address: "169.254.1.1", want: "link-local"},
		{name: "IPv6 link local", address: "fe80::1", want: "link-local"},
		{name: "Tailscale metadata", address: "100.100.100.200", want: "metadata"},
		{name: "instance metadata", address: "169.254.169.254", want: "metadata"},
		{name: "container metadata", address: "169.254.170.2", want: "metadata"},
		{name: "shared address space", address: "100.64.0.1", want: "not public unicast"},
		{name: "slot benchmark network", address: "198.18.0.2", want: "not public unicast"},
		{name: "documentation network", address: "203.0.113.1", want: "not public unicast"},
		{name: "reserved network", address: "240.0.0.1", want: "not public unicast"},
		{name: "unspecified", address: "0.0.0.0", want: "not public unicast"},
		{name: "multicast", address: "225.0.0.1", want: "not public unicast"},
	}

	for _, testCase := range testCases {
		testingObject.Run(testCase.name, func(testingObject *testing.T) {
			address := netip.MustParseAddr(testCase.address)
			err := validateTorrentPreviewAddress(address)
			if err == nil || !strings.Contains(err.Error(), testCase.want) {
				testingObject.Fatalf("validate %s error = %v, want %q", address, err, testCase.want)
			}
		})
	}

	if err := validateTorrentPreviewAddress(netip.MustParseAddr("8.8.8.8")); err != nil {
		testingObject.Fatalf("public address was refused: %v", err)
	}
}

// TestTorrentPreviewRefusesPrivateRedirect verifies redirects repeat the URL policy.
func TestTorrentPreviewRefusesPrivateRedirect(testingObject *testing.T) {
	client := newTorrentPreviewHTTPClient(vpnhttp.Route{
		SourceIP:   net.ParseIP("198.18.0.1").To4(),
		DNSServers: []string{"1.1.1.1"},
	})
	initialRequest, err := http.NewRequest(
		http.MethodGet,
		"https://downloads.example/release.torrent",
		nil,
	)
	if err != nil {
		testingObject.Fatalf("create initial request: %v", err)
	}
	redirectRequest, err := http.NewRequest(
		http.MethodGet,
		"http://192.168.1.10/release.torrent",
		nil,
	)
	if err != nil {
		testingObject.Fatalf("create redirect request: %v", err)
	}

	err = client.CheckRedirect(redirectRequest, []*http.Request{initialRequest})
	if err == nil || !strings.Contains(err.Error(), "private") {
		testingObject.Fatalf("private redirect error = %v", err)
	}

	publicRedirect, _ := http.NewRequest(
		http.MethodGet,
		"https://cdn.example/release.torrent",
		nil,
	)
	err = client.CheckRedirect(publicRedirect, []*http.Request{
		initialRequest,
		publicRedirect,
		publicRedirect,
		publicRedirect,
	})
	if err == nil || !strings.Contains(err.Error(), "more than 3 redirects") {
		testingObject.Fatalf("fourth redirect error = %v", err)
	}
}

// TestTorrentPreviewURLValidationRefusesCredentials verifies textual URL safety.
func TestTorrentPreviewURLValidationRefusesCredentials(testingObject *testing.T) {
	for _, rawURL := range []string{
		"ftp://downloads.example/release.torrent",
		"https://user:secret@downloads.example/release.torrent",
		"https://127.0.0.1/release.torrent",
	} {
		if _, err := validateTorrentPreviewURL(rawURL); err == nil {
			testingObject.Fatalf("unsafe URL %q was accepted", rawURL)
		}
	}
}

// TestTorrentPreviewDownloadCap verifies a streaming response cannot exceed 10 MiB.
func TestTorrentPreviewDownloadCap(testingObject *testing.T) {
	client := &http.Client{Transport: torrentPreviewRoundTripFunc(
		func(request *http.Request) (*http.Response, error) {
			return &http.Response{
				Body: io.NopCloser(io.LimitReader(
					torrentPreviewZeroReader{},
					maximumTorrentPreviewBytes+1,
				)),
				ContentLength: -1,
				Header:        make(http.Header),
				Request:       request,
				StatusCode:    http.StatusOK,
			}, nil
		},
	)}
	parsedURL, err := url.Parse("https://downloads.example/release.torrent")
	if err != nil {
		testingObject.Fatalf("parse fixture URL: %v", err)
	}

	_, err = previewTorrentURL(context.Background(), client, parsedURL, 0)
	if err == nil || !strings.Contains(err.Error(), "too large") {
		testingObject.Fatalf("oversized preview error = %v", err)
	}
}

// TestTorrentPreviewUsesProtectedDefaultRoute verifies handler-to-client routing.
func TestTorrentPreviewUsesProtectedDefaultRoute(testingObject *testing.T) {
	const connectionID = "vpc-preview000000001"
	const name = "archlinux-2026.11.01-x86_64.iso"
	info := "d" +
		bencodeStringForTorrentPreviewTest("length") + "i1395864371e" +
		bencodeStringForTorrentPreviewTest("name") + bencodeStringForTorrentPreviewTest(name) +
		"e"
	metainfo := []byte("d" + bencodeStringForTorrentPreviewTest("info") + info + "e")

	clients := transmissionrpc.NewClientSet(time.Second)
	if err := clients.Replace([]transmissionrpc.DaemonConfig{{
		ConnectionID: connectionID,
		Default:      true,
		PeerPort:     51413,
		Slot:         0,
	}}); err != nil {
		testingObject.Fatalf("configure preview daemon: %v", err)
	}
	runtimeDirectory := testingObject.TempDir()
	writeJSONForTest(
		testingObject,
		filepath.Join(runtimeDirectory, "vpn.status.d", connectionID+".json"),
		map[string]any{
			"connectionId": connectionID,
			"dnsServers":   []string{"10.8.0.1"},
			"slot":         0,
			"state":        "protected",
		},
	)

	server := &Server{
		runtimeDirectory:    runtimeDirectory,
		transmissionClients: clients,
		torrentPreviewClient: func(route vpnhttp.Route) *http.Client {
			if got := route.SourceIP.String(); got != "198.18.0.1" {
				testingObject.Fatalf("preview source IP = %q", got)
			}
			if len(route.DNSServers) != 1 || route.DNSServers[0] != "10.8.0.1" {
				testingObject.Fatalf("preview DNS servers = %#v", route.DNSServers)
			}

			return &http.Client{Transport: torrentPreviewRoundTripFunc(
				func(request *http.Request) (*http.Response, error) {
					return &http.Response{
						Body:          io.NopCloser(strings.NewReader(string(metainfo))),
						ContentLength: int64(len(metainfo)),
						Header:        make(http.Header),
						Request:       request,
						StatusCode:    http.StatusOK,
					}, nil
				},
			)}
		},
	}
	request := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/torrents/preview",
		strings.NewReader(`{"links":["https://archlinux.org/releng/releases/2026.11.01/torrent/?token=secret"]}`),
	)
	response := httptest.NewRecorder()
	server.handlePreviewTorrentLinks(response, request)

	if response.Code != http.StatusOK ||
		!strings.Contains(response.Body.String(), name) ||
		!strings.Contains(response.Body.String(), torrentPreviewInfoHashForTest(info)) ||
		strings.Contains(response.Body.String(), "token") {
		testingObject.Fatalf("protected preview status %d: %s", response.Code, response.Body.String())
	}
}

// TestTorrentPreviewFallsBackWhenVPNIsUnprotected verifies fail-closed behavior.
func TestTorrentPreviewFallsBackWhenVPNIsUnprotected(testingObject *testing.T) {
	clients := transmissionrpc.NewClientSet(time.Second)
	if err := clients.Replace([]transmissionrpc.DaemonConfig{{
		ConnectionID: "vpc-preview000000001",
		Default:      true,
		PeerPort:     51413,
		Slot:         0,
	}}); err != nil {
		testingObject.Fatalf("configure preview daemon: %v", err)
	}

	var clientCreations atomic.Int32
	server := &Server{
		runtimeDirectory:    testingObject.TempDir(),
		transmissionClients: clients,
		torrentPreviewClient: func(vpnhttp.Route) *http.Client {
			clientCreations.Add(1)

			return &http.Client{}
		},
	}
	request := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/torrents/preview",
		strings.NewReader(`{"links":["https://downloads.example/release.torrent"]}`),
	)
	response := httptest.NewRecorder()
	server.handlePreviewTorrentLinks(response, request)

	if response.Code != http.StatusOK || response.Body.String() != "{\"items\":[]}\n" {
		testingObject.Fatalf("unprotected preview status %d: %s", response.Code, response.Body.String())
	}
	if clientCreations.Load() != 0 {
		testingObject.Fatalf("unprotected preview created %d clients", clientCreations.Load())
	}
}

// TestTorrentPreviewRouteRequiresWriteAuthentication verifies the public route guard.
func TestTorrentPreviewRouteRequiresWriteAuthentication(testingObject *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(testingObject)
	const body = `{"links":["magnet:?xt=urn:btih:1111111111111111111111111111111111111111&dn=Example"]}`

	unauthenticated := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/torrents/preview",
		body,
		nil,
		"",
	)
	if unauthenticated.Code != http.StatusUnauthorized {
		testingObject.Fatalf("unauthenticated status = %d", unauthenticated.Code)
	}

	missingCSRF := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/torrents/preview",
		body,
		cookies,
		"",
	)
	if missingCSRF.Code != http.StatusForbidden {
		testingObject.Fatalf("missing CSRF status = %d", missingCSRF.Code)
	}

	_, readToken := createTestToken(
		testingObject,
		server,
		cookies,
		csrfToken,
		`{"name":"Preview reader","scopes":["torrents:read"]}`,
	)
	readRequest := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/torrents/preview",
		strings.NewReader(body),
	)
	readRequest.Header.Set("Authorization", "Bearer "+readToken)
	readRequest.Header.Set("Content-Type", "application/json")
	readResponse := httptest.NewRecorder()
	server.ServeHTTP(readResponse, readRequest)
	if readResponse.Code != http.StatusForbidden ||
		!strings.Contains(readResponse.Body.String(), "torrents:write") {
		testingObject.Fatalf(
			"read-scope status %d: %s",
			readResponse.Code,
			readResponse.Body.String(),
		)
	}

	_, writeToken := createTestToken(
		testingObject,
		server,
		cookies,
		csrfToken,
		`{"name":"Preview writer","scopes":["torrents:write"]}`,
	)
	writeRequest := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/torrents/preview",
		strings.NewReader(body),
	)
	writeRequest.Header.Set("Authorization", "Bearer "+writeToken)
	writeRequest.Header.Set("Content-Type", "application/json")
	writeResponse := httptest.NewRecorder()
	server.ServeHTTP(writeResponse, writeRequest)
	if writeResponse.Code != http.StatusOK {
		testingObject.Fatalf(
			"write-scope status %d: %s",
			writeResponse.Code,
			writeResponse.Body.String(),
		)
	}

	authorized := performRequest(
		testingObject,
		server,
		http.MethodPost,
		"/api/v1/torrents/preview",
		body,
		cookies,
		csrfToken,
	)
	if authorized.Code != http.StatusOK {
		testingObject.Fatalf("authorized status %d: %s", authorized.Code, authorized.Body.String())
	}
	var response torrentLinkPreviewResponse
	if err := json.Unmarshal(authorized.Body.Bytes(), &response); err != nil || len(response.Items) != 1 {
		testingObject.Fatalf("authorized response = %#v, error %v", response, err)
	}
}

// TestTorrentPreviewRequestLimit verifies no request can fan out above twenty links.
func TestTorrentPreviewRequestLimit(testingObject *testing.T) {
	links := make([]string, maximumTorrentPreviewLinks+1)
	for index := range links {
		links[index] = "https://downloads.example/" + strconv.Itoa(index) + ".torrent"
	}
	content, err := json.Marshal(map[string]any{"links": links})
	if err != nil {
		testingObject.Fatalf("encode request: %v", err)
	}
	request := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/torrents/preview",
		strings.NewReader(string(content)),
	)
	response := httptest.NewRecorder()
	(&Server{}).handlePreviewTorrentLinks(response, request)

	if response.Code != http.StatusUnprocessableEntity {
		testingObject.Fatalf("request limit status %d: %s", response.Code, response.Body.String())
	}
}

func bencodeStringForTorrentPreviewTest(value string) string {
	return strconv.Itoa(len(value)) + ":" + value
}

func torrentPreviewFileForTest(name string, length int64) string {
	return "d" +
		bencodeStringForTorrentPreviewTest("length") + "i" + strconv.FormatInt(length, 10) + "e" +
		bencodeStringForTorrentPreviewTest("path") + "l" + bencodeStringForTorrentPreviewTest(name) + "e" +
		"e"
}

func torrentPreviewInfoHashForTest(info string) string {
	digest := sha1.Sum([]byte(info))

	return hex.EncodeToString(digest[:])
}
