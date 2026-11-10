package main

import (
	"archive/zip"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/x509"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/blocklist"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionconfig"
)

// blocklistTestRPC returns one configurable live session snapshot.
//
// Reload tests use it to verify settings preservation without opening a native
// Transmission listener or weakening the production loopback client validation.
//
// Since: 2.0.0
type blocklistTestRPC struct {
	LiveSettings map[string]json.RawMessage
	Error        error
	Calls        atomic.Int32
}

// Call implements the runner's narrow Transmission RPC consumer contract.
//
// Only session-get is accepted, making an accidental native blocklist-update or other
// method visible as a focused test failure.
//
// Since: 2.0.0
func (client *blocklistTestRPC) Call(
	_ context.Context,
	method string,
	_ any,
	result any,
) error {
	if method != "session-get" {
		return fmt.Errorf("unexpected RPC method %s", method)
	}
	client.Calls.Add(1)
	if client.Error != nil {
		return client.Error
	}
	content, err := json.Marshal(client.LiveSettings)
	if err != nil {
		return err
	}

	return json.Unmarshal(content, result)
}

// TestBlocklistMergerDownloadsFormatsAndArchives verifies the complete source pipeline.
//
// Plain, gzip, and zip responses exercise P2P, DAT, CIDR, IPv4, IPv6, and invalid-line
// filtering while the bound dial seam proves the tunnel source address is selected.
//
// Since: 2.0.0
func TestBlocklistMergerDownloadsFormatsAndArchives(testingObject *testing.T) {
	plain := []byte(strings.Join([]string{
		"p2p:1.2.3.4-1.2.3.5",
		"1.2.4.0/24",
		"1.2.5.1 - 1.2.5.2 , 000 , dat",
		"2001:db8::/126",
		"not an address range",
		"10.0.0.2-10.0.0.1",
	}, "\n"))
	gzipContent := gzipTestContent(testingObject, []byte("gzip:2.2.2.2-2.2.2.3\n"))
	zipContent := zipTestContent(testingObject, []byte("3.3.3.0/30\n"))

	server := newBlocklistTLSServer(testingObject, http.HandlerFunc(func(
		responseWriter http.ResponseWriter,
		request *http.Request,
	) {
		switch request.URL.Path {
		case "/plain":
			_, _ = responseWriter.Write(plain)
		case "/gzip":
			_, _ = responseWriter.Write(gzipContent)
		case "/zip":
			_, _ = responseWriter.Write(zipContent)
		default:
			http.NotFound(responseWriter, request)
		}
	}))
	dnsPort := newBlocklistDNSServer(testingObject, net.IPv4(127, 0, 0, 1))
	_, sourcePort, err := net.SplitHostPort(strings.TrimPrefix(server.URL, "https://"))
	if err != nil {
		testingObject.Fatalf("parse TLS fixture address: %v", err)
	}
	hostname := "example.com"
	if len(server.Certificate().DNSNames) > 0 {
		hostname = server.Certificate().DNSNames[0]
	}
	hostSource := "https://" + net.JoinHostPort(hostname, sourcePort) + "/plain"
	sources := []string{hostSource, server.URL + "/gzip", server.URL + "/zip"}
	merger, runtimeDirectory, configRoot, entry := prepareBlocklistMergerTest(testingObject, sources, "protected")
	trustBlocklistServer(testingObject, merger, server)
	merger.dnsPort = dnsPort
	writeBlocklistVPNStatusForTest(
		testingObject,
		runtimeDirectory,
		entry,
		"protected",
		[]string{"127.0.0.1"},
	)

	productionDial := merger.dialContext
	var httpsBoundAddress string
	var dnsBoundAddress string
	merger.dialContext = func(
		dialer *net.Dialer,
		ctx context.Context,
		network string,
		address string,
	) (net.Conn, error) {
		if tcpAddress, ok := dialer.LocalAddr.(*net.TCPAddr); ok {
			httpsBoundAddress = tcpAddress.IP.String()
		}
		if udpAddress, ok := dialer.LocalAddr.(*net.UDPAddr); ok {
			dnsBoundAddress = udpAddress.IP.String()
		}

		return productionDial(dialer, ctx, network, address)
	}

	if err := merger.reconcile(context.Background()); err != nil {
		testingObject.Fatalf("reconcile blocklists: %v", err)
	}
	if httpsBoundAddress != "127.0.0.1" {
		testingObject.Fatalf("HTTPS local address = %q, want 127.0.0.1", httpsBoundAddress)
	}
	if dnsBoundAddress != "127.0.0.1" {
		testingObject.Fatalf("DNS local address = %q, want 127.0.0.1", dnsBoundAddress)
	}
	status := readBlocklistStatusForTest(testingObject, merger)
	if status.State != "idle" || status.TotalRanges != 6 {
		testingObject.Fatalf("blocklist status = %#v", status)
	}
	for index, wantedRanges := range []int{4, 1, 1} {
		if status.Sources[index].State != "ok" || status.Sources[index].Ranges != wantedRanges {
			testingObject.Fatalf("source %d status = %#v", index, status.Sources[index])
		}
	}

	plainPath := filepath.Join(
		configRoot,
		entry.ConnectionID,
		"blocklists",
		blocklist.SourceFileName(sources[0]),
	)
	content, err := os.ReadFile(plainPath)
	if err != nil {
		testingObject.Fatalf("read normalized blocklist: %v", err)
	}
	wantedLines := []string{
		"tvpn:1.2.3.4-1.2.3.5",
		"tvpn:1.2.4.0-1.2.4.255",
		"tvpn:1.2.5.1-1.2.5.2",
		"tvpn:2001:db8::-2001:db8::3",
	}
	if actual := strings.Split(strings.TrimSpace(string(content)), "\n"); !slices.Equal(actual, wantedLines) {
		testingObject.Fatalf("normalized lines = %#v, want %#v", actual, wantedLines)
	}
}

// TestBlocklistMergerKeepsLastGoodCopy verifies isolated source failure behavior.
//
// A second response with no valid ranges must report an error and CopyFrom while the
// exact normalized bytes from the successful first attempt remain installed.
//
// Since: 2.0.0
func TestBlocklistMergerKeepsLastGoodCopy(testingObject *testing.T) {
	var invalid atomic.Bool
	server := newBlocklistTLSServer(testingObject, http.HandlerFunc(func(
		responseWriter http.ResponseWriter,
		_ *http.Request,
	) {
		if invalid.Load() {
			_, _ = io.WriteString(responseWriter, "not a list\nstill invalid\n")

			return
		}
		_, _ = io.WriteString(responseWriter, "copy:4.4.4.4-4.4.4.5\n")
	}))
	sources := []string{server.URL}
	merger, runtimeDirectory, configRoot, entry := prepareBlocklistMergerTest(
		testingObject,
		sources,
		"protected",
	)
	trustBlocklistServer(testingObject, merger, server)
	now := time.Date(2026, 11, 5, 14, 0, 0, 0, time.UTC)
	merger.clock = func() time.Time { return now }
	if err := merger.reconcile(context.Background()); err != nil {
		testingObject.Fatalf("first update: %v", err)
	}
	path := filepath.Join(
		configRoot,
		entry.ConnectionID,
		"blocklists",
		blocklist.SourceFileName(server.URL),
	)
	firstContent, err := os.ReadFile(path)
	if err != nil {
		testingObject.Fatalf("read first copy: %v", err)
	}

	invalid.Store(true)
	now = now.Add(time.Minute)
	requestedAt := now
	writeBlocklistConfigurationForTest(testingObject, runtimeDirectory, blocklist.Configuration{
		Enabled: true, Sources: sources, UpdateIntervalHours: 24, UpdateRequestedAt: &requestedAt,
	})
	if err := merger.reconcile(context.Background()); err != nil {
		testingObject.Fatalf("failed-source update: %v", err)
	}
	secondContent, err := os.ReadFile(path)
	if err != nil {
		testingObject.Fatalf("read retained copy: %v", err)
	}
	if !bytes.Equal(firstContent, secondContent) {
		testingObject.Fatalf("failed update replaced last-good content: %q", secondContent)
	}
	status := readBlocklistStatusForTest(testingObject, merger)
	sourceStatus := status.Sources[0]
	if sourceStatus.State != "error" ||
		sourceStatus.Error != "No address ranges found in this list." ||
		sourceStatus.CopyFrom == nil ||
		!sourceStatus.CopyFrom.Equal(time.Date(2026, 11, 5, 14, 0, 0, 0, time.UTC)) {
		testingObject.Fatalf("retained source status = %#v", sourceStatus)
	}
}

// TestBlocklistMergerEnforcesDownloadAndUnpackedCaps verifies both byte boundaries.
//
// Small injected caps avoid allocating production-sized fixtures while exercising the
// same sentinel-byte readers used for the 64 MiB and 512 MiB limits.
//
// Since: 2.0.0
func TestBlocklistMergerEnforcesDownloadAndUnpackedCaps(testingObject *testing.T) {
	var body atomic.Value
	body.Store([]byte("12345678901"))
	server := newBlocklistTLSServer(testingObject, http.HandlerFunc(func(
		responseWriter http.ResponseWriter,
		_ *http.Request,
	) {
		_, _ = responseWriter.Write(body.Load().([]byte))
	}))
	merger, _, _, _ := prepareBlocklistMergerTest(testingObject, []string{server.URL}, "protected")
	trustBlocklistServer(testingObject, merger, server)
	route := blocklistRoute{SourceIP: net.ParseIP("127.0.0.1").To4()}
	merger.maximumDownloadBytes = 10
	if _, err := merger.downloadAndNormalize(context.Background(), server.URL, route, time.Now()); !errors.Is(
		err,
		errBlocklistDownloadTooLarge,
	) {
		testingObject.Fatalf("download cap error = %v", err)
	}

	body.Store(gzipTestContent(testingObject, []byte("12345678901")))
	merger.maximumDownloadBytes = 1024
	merger.maximumUnpackedBytes = 10
	if _, err := merger.downloadAndNormalize(context.Background(), server.URL, route, time.Now()); !errors.Is(
		err,
		errBlocklistUnpackedTooLarge,
	) {
		testingObject.Fatalf("unpacked cap error = %v", err)
	}
}

// TestBlocklistMergerEnforcesNormalizedRangeAndAggregateCaps covers output limits.
//
// Small boundaries prove canonical bytes and accepted ranges fail with the
// approved message per source and across the complete merged set.
//
// Since: 2.0.0
func TestBlocklistMergerEnforcesNormalizedRangeAndAggregateCaps(testingObject *testing.T) {
	server := newBlocklistTLSServer(testingObject, http.HandlerFunc(func(
		responseWriter http.ResponseWriter,
		request *http.Request,
	) {
		switch request.URL.Path {
		case "/one":
			_, _ = io.WriteString(responseWriter, "one:8.8.8.1-8.8.8.1\n")
		case "/two":
			_, _ = io.WriteString(responseWriter, "two:9.9.9.1-9.9.9.1\n")
		default:
			http.NotFound(responseWriter, request)
		}
	}))
	sources := []string{server.URL + "/one", server.URL + "/two"}
	merger, _, _, _ := prepareBlocklistMergerTest(testingObject, sources, "protected")
	trustBlocklistServer(testingObject, merger, server)

	merger.maximumNormalizedBytes = 1
	if _, err := merger.normalizeToTemporary(
		context.Background(),
		strings.NewReader("::/0\n"),
		time.Now(),
	); !errors.Is(err, errBlocklistTooLarge) {
		testingObject.Fatalf("normalized byte cap error = %v", err)
	}
	merger.maximumNormalizedBytes = 1024
	merger.maximumRanges = 1
	if _, err := merger.normalizeToTemporary(
		context.Background(),
		strings.NewReader("1.1.1.1/32\n2.2.2.2/32\n"),
		time.Now(),
	); !errors.Is(err, errBlocklistTooLarge) {
		testingObject.Fatalf("range cap error = %v", err)
	}

	merger.maximumRanges = blocklistMaximumRanges
	merger.maximumTotalBytes = int64(len("tvpn:8.8.8.1-8.8.8.1\n"))
	if err := merger.reconcile(context.Background()); err != nil {
		testingObject.Fatalf("aggregate-cap update: %v", err)
	}
	status := readBlocklistStatusForTest(testingObject, merger)
	if status.TotalRanges != 1 || len(status.Sources) != 2 ||
		status.Sources[0].State != "ok" || status.Sources[0].Ranges != 1 ||
		status.Sources[1].State != "error" ||
		status.Sources[1].Error != errBlocklistTooLarge.Error() {
		testingObject.Fatalf("aggregate-cap status = %#v", status)
	}

	rangeMerger, _, _, _ := prepareBlocklistMergerTest(
		testingObject,
		sources,
		"protected",
	)
	trustBlocklistServer(testingObject, rangeMerger, server)
	rangeMerger.maximumTotalRanges = 1
	if err := rangeMerger.reconcile(context.Background()); err != nil {
		testingObject.Fatalf("aggregate-range-cap update: %v", err)
	}
	rangeStatus := readBlocklistStatusForTest(testingObject, rangeMerger)
	if rangeStatus.TotalRanges != 1 || len(rangeStatus.Sources) != 2 ||
		rangeStatus.Sources[0].State != "ok" || rangeStatus.Sources[0].Ranges != 1 ||
		rangeStatus.Sources[1].State != "error" ||
		rangeStatus.Sources[1].Error != errBlocklistTooLarge.Error() {
		testingObject.Fatalf("aggregate-range-cap status = %#v", rangeStatus)
	}
}

// TestBlocklistMergerRejectsOversizedZipMetadata covers both archive metadata caps.
//
// Entry and central-directory limits are checked before archive/zip can materialize
// member objects, while ordinary source download and TLS validation remain exercised.
//
// Since: 2.0.0
func TestBlocklistMergerRejectsOversizedZipMetadata(testingObject *testing.T) {
	body := zipTestEntries(testingObject, 3)
	endRecordOffset := len(body) - 22
	binary.LittleEndian.PutUint16(body[endRecordOffset+8:endRecordOffset+10], 1)
	binary.LittleEndian.PutUint16(body[endRecordOffset+10:endRecordOffset+12], 1)
	server := newBlocklistTLSServer(testingObject, http.HandlerFunc(func(
		responseWriter http.ResponseWriter,
		_ *http.Request,
	) {
		_, _ = responseWriter.Write(body)
	}))
	merger, _, _, _ := prepareBlocklistMergerTest(testingObject, []string{server.URL}, "protected")
	trustBlocklistServer(testingObject, merger, server)
	route := blocklistRoute{SourceIP: net.ParseIP("127.0.0.1").To4()}

	merger.maximumZipEntries = 2
	if _, err := merger.downloadAndNormalize(
		context.Background(),
		server.URL,
		route,
		time.Now(),
	); !errors.Is(err, errBlocklistTooLarge) {
		testingObject.Fatalf("zip entry cap error = %v", err)
	}

	body = zipTestEntries(testingObject, 1)
	merger.maximumZipEntries = blocklistMaximumZipEntries
	merger.maximumZipDirectoryBytes = 1
	if _, err := merger.downloadAndNormalize(
		context.Background(),
		server.URL,
		route,
		time.Now(),
	); !errors.Is(err, errBlocklistTooLarge) {
		testingObject.Fatalf("zip directory cap error = %v", err)
	}
}

// TestBlocklistMergerRejectsAmbiguousZipEndRecords covers parser disagreement.
//
// A visible one-entry directory must not hide a zip64 directory that archive/zip
// would select and allocate before the runner's metadata cap can run.
//
// Since: 2.0.0
func TestBlocklistMergerRejectsAmbiguousZipEndRecords(testingObject *testing.T) {
	const hiddenEntries = 200_000
	putUint16 := func(destination []byte, value uint16) {
		binary.LittleEndian.PutUint16(destination, value)
	}
	putUint32 := func(destination []byte, value uint32) {
		binary.LittleEndian.PutUint32(destination, value)
	}
	putUint64 := func(destination []byte, value uint64) {
		binary.LittleEndian.PutUint64(destination, value)
	}
	centralEntry := func() []byte {
		header := make([]byte, 48)
		putUint32(header, 0x02014b50)
		putUint16(header[4:], 0x0314)
		putUint16(header[6:], 20)
		putUint16(header[28:], 2)
		putUint32(header[38:], 0x41ed0010)
		copy(header[46:], "a/")

		return header
	}

	var archive bytes.Buffer
	localHeader := make([]byte, 32)
	putUint32(localHeader, 0x04034b50)
	putUint16(localHeader[4:], 20)
	putUint16(localHeader[26:], 2)
	copy(localHeader[30:], "a/")
	archive.Write(localHeader)
	hiddenOffset := archive.Len()
	for range hiddenEntries {
		archive.Write(centralEntry())
	}
	hiddenSize := archive.Len() - hiddenOffset
	zip64Offset := archive.Len()
	zip64Record := make([]byte, 56)
	putUint32(zip64Record, 0x06064b50)
	putUint64(zip64Record[4:], 44)
	putUint16(zip64Record[12:], 45)
	putUint16(zip64Record[14:], 45)
	putUint64(zip64Record[24:], hiddenEntries)
	putUint64(zip64Record[32:], hiddenEntries)
	putUint64(zip64Record[40:], uint64(hiddenSize))
	putUint64(zip64Record[48:], uint64(hiddenOffset))
	archive.Write(zip64Record)

	visibleOffset := archive.Len()
	archive.Write(centralEntry())
	firstEndRecord := make([]byte, 22)
	putUint32(firstEndRecord, 0x06054b50)
	putUint16(firstEndRecord[8:], 1)
	putUint16(firstEndRecord[10:], 1)
	putUint32(firstEndRecord[12:], 48)
	putUint32(firstEndRecord[16:], uint32(visibleOffset))
	putUint16(firstEndRecord[20:], 44)
	archive.Write(firstEndRecord)
	locator := make([]byte, 20)
	putUint32(locator, 0x07064b50)
	putUint64(locator[8:], uint64(zip64Offset))
	putUint32(locator[16:], 1)
	archive.Write(locator)
	secondEndRecord := make([]byte, 22)
	putUint32(secondEndRecord, 0x06054b50)
	for index := 8; index < 20; index++ {
		secondEndRecord[index] = 0xff
	}
	archive.Write(secondEndRecord)
	archive.Write([]byte("xx"))

	merger, runtimeDirectory, _, _ := prepareBlocklistMergerTest(
		testingObject,
		[]string{},
		"protected",
	)
	downloaded, err := createUnlinkedBlocklistFile(
		filepath.Join(runtimeDirectory, "transmission-state"),
		".ambiguous-zip-*",
	)
	if err != nil {
		testingObject.Fatalf("create ambiguous zip fixture: %v", err)
	}
	defer downloaded.Close()
	if _, err := downloaded.Write(archive.Bytes()); err != nil {
		testingObject.Fatalf("write ambiguous zip fixture: %v", err)
	}
	if _, err := merger.openDownloadedBlocklist(
		downloaded,
		int64(archive.Len()),
	); !errors.Is(err, errBlocklistZipUnsupported) {
		testingObject.Fatalf("ambiguous zip error = %v", err)
	}
}

// TestBlocklistMergerRejectsZipComments covers the unambiguous ending contract.
//
// Even one ordinary end record is unsupported when its variable comment would let
// archive parsers search a different suffix than the runner's fixed preflight.
//
// Since: 2.0.0
func TestBlocklistMergerRejectsZipComments(testingObject *testing.T) {
	var archive bytes.Buffer
	writer := zip.NewWriter(&archive)
	if err := writer.SetComment("comment"); err != nil {
		testingObject.Fatalf("set zip comment: %v", err)
	}
	member, err := writer.Create("list.txt")
	if err != nil {
		testingObject.Fatalf("create commented zip member: %v", err)
	}
	if _, err := io.WriteString(member, "range:1.1.1.1-1.1.1.1\n"); err != nil {
		testingObject.Fatalf("write commented zip member: %v", err)
	}
	if err := writer.Close(); err != nil {
		testingObject.Fatalf("close commented zip: %v", err)
	}

	content := archive.Bytes()
	if _, err := inspectBlocklistZipDirectory(
		bytes.NewReader(content),
		int64(len(content)),
		blocklistMaximumZipEntries,
		blocklistMaximumZipDirectoryBytes,
	); !errors.Is(err, errBlocklistZipUnsupported) {
		testingObject.Fatalf("commented zip error = %v", err)
	}
}

// TestBlocklistMergerRejectsInsecureURLsAndRedirects verifies HTTPS-only behavior.
//
// Initial HTTP sources fail before a request is built, and an HTTPS response cannot
// redirect the pinned client to a cleartext destination.
//
// Since: 2.0.0
func TestBlocklistMergerRejectsInsecureURLsAndRedirects(testingObject *testing.T) {
	merger, _, _, _ := prepareBlocklistMergerTest(testingObject, []string{}, "protected")
	route := blocklistRoute{SourceIP: net.ParseIP("127.0.0.1").To4()}
	if _, err := merger.downloadAndNormalize(
		context.Background(),
		"http://example.test/list",
		route,
		time.Now(),
	); err == nil || !strings.Contains(err.Error(), "Only HTTPS") {
		testingObject.Fatalf("HTTP source error = %v", err)
	}

	server := newBlocklistTLSServer(testingObject, http.HandlerFunc(func(
		responseWriter http.ResponseWriter,
		request *http.Request,
	) {
		http.Redirect(responseWriter, request, "http://example.test/list", http.StatusFound)
	}))
	trustBlocklistServer(testingObject, merger, server)
	if _, err := merger.downloadAndNormalize(
		context.Background(),
		server.URL,
		route,
		time.Now(),
	); err == nil || !strings.Contains(err.Error(), "Only HTTPS") {
		testingObject.Fatalf("HTTP redirect error = %v", err)
	}
}

// TestBlocklistMergerWaitsForProtectedVPN verifies fail-closed scheduling.
//
// A due source remains pending and the HTTPS handler is never reached while the
// default controller status is anything other than protected. Stale removed-source
// files are still cleaned without opening a network socket.
//
// Since: 2.0.0
func TestBlocklistMergerWaitsForProtectedVPN(testingObject *testing.T) {
	var requests atomic.Int32
	server := newBlocklistTLSServer(testingObject, http.HandlerFunc(func(
		responseWriter http.ResponseWriter,
		_ *http.Request,
	) {
		requests.Add(1)
		_, _ = io.WriteString(responseWriter, "range:5.5.5.5-5.5.5.5\n")
	}))
	merger, _, configRoot, entry := prepareBlocklistMergerTest(
		testingObject,
		[]string{server.URL},
		"reconnecting",
	)
	trustBlocklistServer(testingObject, merger, server)
	directory := filepath.Join(configRoot, entry.ConnectionID, "blocklists")
	if err := os.MkdirAll(directory, 0o750); err != nil {
		testingObject.Fatalf("create waiting blocklist directory: %v", err)
	}
	for _, name := range []string{
		blocklist.SourceFileName("https://removed.example/list"),
		"blocklist.bin",
	} {
		if err := os.WriteFile(filepath.Join(directory, name), []byte("stale"), 0o640); err != nil {
			testingObject.Fatalf("seed waiting stale file %s: %v", name, err)
		}
	}
	if err := merger.reconcile(context.Background()); err != nil {
		testingObject.Fatalf("waiting reconcile: %v", err)
	}
	status := readBlocklistStatusForTest(testingObject, merger)
	if status.State != "waiting-for-vpn" || requests.Load() != 0 {
		testingObject.Fatalf("waiting status = %#v; requests = %d", status, requests.Load())
	}
	entries, err := os.ReadDir(directory)
	if err != nil {
		testingObject.Fatalf("read waiting blocklist directory: %v", err)
	}
	if len(entries) != 0 {
		testingObject.Fatalf("waiting cleanup left entries = %#v", entries)
	}
}

// TestBlocklistMergerCachesWaitingCopiesAndSkipsUnchangedStatusWrites covers quiet polls.
//
// The first due poll loads and installs one saved copy; later VPN-down polls keep the
// in-memory descriptor and leave the atomically published status inode untouched.
//
// Since: 2.0.0
func TestBlocklistMergerCachesWaitingCopiesAndSkipsUnchangedStatusWrites(testingObject *testing.T) {
	source := "https://127.0.0.1/list"
	merger, _, configRoot, entry := prepareBlocklistMergerTest(
		testingObject,
		[]string{source},
		"blocked",
	)
	directory := filepath.Join(configRoot, entry.ConnectionID, "blocklists")
	if err := os.MkdirAll(directory, 0o750); err != nil {
		testingObject.Fatalf("create cached blocklist directory: %v", err)
	}
	copyPath := filepath.Join(directory, blocklist.SourceFileName(source))
	if err := os.WriteFile(copyPath, []byte("tvpn:10.0.0.1-10.0.0.1\n"), 0o640); err != nil {
		testingObject.Fatalf("seed cached blocklist: %v", err)
	}
	now := time.Date(2026, 11, 5, 15, 0, 0, 0, time.UTC)
	old := now.Add(-25 * time.Hour)
	if err := blocklist.WriteJSON(merger.statusPath(), blocklist.Status{
		State:         "idle",
		LastAttemptAt: &old,
		LastSuccessAt: &old,
		Sources: []blocklist.SourceStatus{{
			URL: source, State: "ok", Ranges: 1, UpdatedAt: &old,
		}},
		TotalRanges: 1,
	}, 0o640); err != nil {
		testingObject.Fatalf("seed cached blocklist status: %v", err)
	}
	merger.clock = func() time.Time { return now }
	if err := merger.reconcile(context.Background()); err != nil {
		testingObject.Fatalf("first waiting reconcile: %v", err)
	}
	before, err := os.Stat(merger.statusPath())
	if err != nil {
		testingObject.Fatalf("stat first waiting status: %v", err)
	}
	if err := os.WriteFile(copyPath, []byte("not a list\n"), 0o640); err != nil {
		testingObject.Fatalf("replace installed copy after cache load: %v", err)
	}

	now = now.Add(time.Second)
	if err := merger.reconcile(context.Background()); err != nil {
		testingObject.Fatalf("second waiting reconcile: %v", err)
	}
	after, err := os.Stat(merger.statusPath())
	if err != nil {
		testingObject.Fatalf("stat second waiting status: %v", err)
	}
	status := readBlocklistStatusForTest(testingObject, merger)
	if status.State != "waiting-for-vpn" || status.TotalRanges != 1 ||
		len(status.Sources) != 1 || status.Sources[0].Ranges != 1 {
		testingObject.Fatalf("cached waiting status = %#v", status)
	}
	if !os.SameFile(before, after) {
		testingObject.Fatal("unchanged waiting status was rewritten")
	}
	if _, found := merger.copies[source]; !found {
		testingObject.Fatal("saved source was not retained in the merger cache")
	}
}

// TestBlocklistMergerKeepsInterruptedAttemptsWaiting covers mid-update VPN loss.
//
// A source response drops protection during the request; the old attempt timestamps
// remain unchanged and the next poll stays waiting without claiming success or retrying.
//
// Since: 2.0.0
func TestBlocklistMergerKeepsInterruptedAttemptsWaiting(testingObject *testing.T) {
	var runtimeDirectory string
	var entry daemonEntry
	var requests atomic.Int32
	server := newBlocklistTLSServer(testingObject, http.HandlerFunc(func(
		responseWriter http.ResponseWriter,
		_ *http.Request,
	) {
		requests.Add(1)
		writeVPNStatusForTest(testingObject, runtimeDirectory, entry, "blocked", "")
		_, _ = io.WriteString(responseWriter, "range:10.1.0.1-10.1.0.1\n")
	}))
	sources := []string{server.URL + "/one"}
	merger, runtimePath, _, daemon := prepareBlocklistMergerTest(
		testingObject,
		sources,
		"protected",
	)
	runtimeDirectory = runtimePath
	entry = daemon
	trustBlocklistServer(testingObject, merger, server)
	requestedAt := time.Date(2026, 11, 5, 16, 0, 0, 0, time.UTC)
	oldAttempt := requestedAt.Add(-time.Hour)
	if err := blocklist.WriteJSON(merger.statusPath(), blocklist.Status{
		State: "idle", LastAttemptAt: &oldAttempt, LastSuccessAt: &oldAttempt,
		Sources: []blocklist.SourceStatus{},
	}, 0o640); err != nil {
		testingObject.Fatalf("seed interrupted status: %v", err)
	}
	writeBlocklistConfigurationForTest(testingObject, runtimeDirectory, blocklist.Configuration{
		Enabled: true, Sources: sources, UpdateIntervalHours: 24,
		UpdateRequestedAt: &requestedAt,
	})
	now := requestedAt.Add(time.Second)
	merger.clock = func() time.Time { return now }
	if err := merger.reconcile(context.Background()); err != nil {
		testingObject.Fatalf("interrupted reconcile: %v", err)
	}
	first := readBlocklistStatusForTest(testingObject, merger)
	if first.State != "waiting-for-vpn" || first.LastAttemptAt == nil ||
		!first.LastAttemptAt.Equal(oldAttempt) || first.NextUpdateAt != nil ||
		first.UpdateRequestedAt == nil || !first.UpdateRequestedAt.Equal(requestedAt) {
		testingObject.Fatalf("interrupted status = %#v", first)
	}

	now = now.Add(time.Second)
	if err := merger.reconcile(context.Background()); err != nil {
		testingObject.Fatalf("post-interruption reconcile: %v", err)
	}
	second := readBlocklistStatusForTest(testingObject, merger)
	if second.State != "waiting-for-vpn" || second.LastAttemptAt == nil ||
		!second.LastAttemptAt.Equal(oldAttempt) || second.NextUpdateAt != nil ||
		requests.Load() != 1 {
		testingObject.Fatalf("post-interruption status = %#v; requests = %d", second, requests.Load())
	}
}

// TestBlocklistMergerBacksOffAfterReloadFailure covers completed install failures.
//
// A session-get timeout makes the SIGHUP path fail after downloading; status records
// the attempt and retries only that reload after a durable fifteen-minute backoff.
//
// Since: 2.0.0
func TestBlocklistMergerBacksOffAfterReloadFailure(testingObject *testing.T) {
	var requests atomic.Int32
	server := newBlocklistTLSServer(testingObject, http.HandlerFunc(func(
		responseWriter http.ResponseWriter,
		_ *http.Request,
	) {
		requests.Add(1)
		_, _ = io.WriteString(responseWriter, "range:11.0.0.1-11.0.0.1\n")
	}))
	merger, _, _, entry := prepareBlocklistMergerTest(
		testingObject,
		[]string{server.URL},
		"protected",
	)
	trustBlocklistServer(testingObject, merger, server)
	client := &blocklistTestRPC{
		LiveSettings: map[string]json.RawMessage{},
		Error:        errors.New("session-get timed out"),
	}
	merger.runner.processes[entry.ConnectionID] = &daemonProcess{
		Entry: entry, ProcessID: 101, PeerPort: entry.PeerPort, Client: client, Ready: true,
	}
	var signals atomic.Int32
	merger.runner.signalProcess = func(int) error {
		signals.Add(1)

		return nil
	}
	now := time.Date(2026, 11, 5, 17, 0, 0, 0, time.UTC)
	attemptedAt := now
	merger.clock = func() time.Time { return now }
	if err := merger.reconcile(context.Background()); err == nil {
		testingObject.Fatal("reload failure update unexpectedly succeeded")
	}
	status := readBlocklistStatusForTest(testingObject, merger)
	wantedRetry := now.Add(15 * time.Minute)
	if status.State != "idle" || status.LastAttemptAt == nil ||
		!status.LastAttemptAt.Equal(now) || status.NextUpdateAt == nil ||
		!status.NextUpdateAt.Equal(wantedRetry) || status.Error == "" ||
		!strings.Contains(status.Error, entry.ConnectionID) {
		testingObject.Fatalf("reload failure status = %#v", status)
	}

	now = now.Add(time.Second)
	if err := merger.reconcile(context.Background()); err != nil {
		testingObject.Fatalf("backoff reconcile: %v", err)
	}
	if requests.Load() != 1 || client.Calls.Load() != 1 || signals.Load() != 0 {
		testingObject.Fatalf(
			"backoff work: requests=%d RPC=%d signals=%d",
			requests.Load(),
			client.Calls.Load(),
			signals.Load(),
		)
	}

	client.Error = nil
	now = wantedRetry
	if err := merger.reconcile(context.Background()); err != nil {
		testingObject.Fatalf("retry daemon reload: %v", err)
	}
	status = readBlocklistStatusForTest(testingObject, merger)
	wantedNextUpdate := attemptedAt.Add(24 * time.Hour)
	if requests.Load() != 1 || client.Calls.Load() != 2 || signals.Load() != 1 ||
		status.Error != "" || status.LastSuccessAt == nil ||
		!status.LastSuccessAt.Equal(attemptedAt) || status.NextUpdateAt == nil ||
		!status.NextUpdateAt.Equal(wantedNextUpdate) {
		testingObject.Fatalf(
			"reload retry: status=%#v requests=%d RPC=%d signals=%d",
			status,
			requests.Load(),
			client.Calls.Load(),
			signals.Load(),
		)
	}
}

// TestBlocklistMergerConfinesDaemonFilesystemWork covers descriptor-relative safety.
//
// A symlinked blocklists path is rejected without touching its target, non-regular
// entries survive cleanup, and a missing daemon config directory is never created.
//
// Since: 2.0.0
func TestBlocklistMergerConfinesDaemonFilesystemWork(testingObject *testing.T) {
	source := "https://127.0.0.1/list"
	merger, _, configRoot, entry := prepareBlocklistMergerTest(
		testingObject,
		[]string{source},
		"protected",
	)
	copy, err := merger.normalizeToTemporary(
		context.Background(),
		strings.NewReader("12.0.0.1/32\n"),
		time.Now(),
	)
	if err != nil {
		testingObject.Fatalf("create filesystem copy fixture: %v", err)
	}
	defer copy.File.Close()
	copies := map[string]*blocklistCopy{source: copy}

	victim := filepath.Join(testingObject.TempDir(), "victim")
	if err := os.MkdirAll(filepath.Join(victim, "photos"), 0o750); err != nil {
		testingObject.Fatalf("create symlink victim: %v", err)
	}
	preciousPath := filepath.Join(victim, "precious.txt")
	if err := os.WriteFile(preciousPath, []byte("keep me"), 0o640); err != nil {
		testingObject.Fatalf("seed symlink victim: %v", err)
	}
	blocklistsPath := filepath.Join(configRoot, entry.ConnectionID, "blocklists")
	if err := os.Symlink(victim, blocklistsPath); err != nil {
		testingObject.Fatalf("link blocklists fixture: %v", err)
	}
	if err := merger.synchronizeDaemon(entry, []string{source}, copies); !errors.Is(
		err,
		errBlocklistDirectoryUnsafe,
	) {
		testingObject.Fatalf("symlinked blocklists error = %v", err)
	}
	content, err := os.ReadFile(preciousPath)
	if err != nil || string(content) != "keep me" {
		testingObject.Fatalf("symlink target changed: content=%q error=%v", content, err)
	}

	if err := os.Remove(blocklistsPath); err != nil {
		testingObject.Fatalf("remove symlink fixture: %v", err)
	}
	if err := os.Mkdir(blocklistsPath, 0o750); err != nil {
		testingObject.Fatalf("create real blocklists fixture: %v", err)
	}
	nestedPath := filepath.Join(blocklistsPath, "nested")
	if err := os.Mkdir(nestedPath, 0o750); err != nil {
		testingObject.Fatalf("create nested fixture: %v", err)
	}
	if err := os.WriteFile(filepath.Join(nestedPath, "keep.txt"), []byte("keep"), 0o640); err != nil {
		testingObject.Fatalf("seed nested fixture: %v", err)
	}
	if err := os.WriteFile(filepath.Join(blocklistsPath, "stale.txt"), []byte("stale"), 0o640); err != nil {
		testingObject.Fatalf("seed regular stale fixture: %v", err)
	}
	if err := merger.synchronizeDaemon(entry, []string{source}, copies); err != nil {
		testingObject.Fatalf("synchronize safe blocklists directory: %v", err)
	}
	if _, err := os.Stat(filepath.Join(nestedPath, "keep.txt")); err != nil {
		testingObject.Fatalf("non-regular entry was removed: %v", err)
	}
	if _, err := os.Stat(filepath.Join(blocklistsPath, "stale.txt")); !errors.Is(err, os.ErrNotExist) {
		testingObject.Fatalf("regular stale file still exists: %v", err)
	}

	missing := daemonEntry{ConnectionID: "vpc-0000000000000099", Slot: 98, PeerPort: 51511}
	if err := merger.synchronizeDaemon(missing, []string{source}, copies); !errors.Is(
		err,
		errBlocklistDaemonNotPrepared,
	) {
		testingObject.Fatalf("missing daemon synchronization error = %v", err)
	}
	if _, err := os.Stat(filepath.Join(configRoot, missing.ConnectionID)); !errors.Is(err, os.ErrNotExist) {
		testingObject.Fatalf("missing daemon config directory was created: %v", err)
	}
}

// TestBlocklistMergerPreparesDaemonFromCache verifies starts never fetch sources.
//
// A scheduled update populates the disk-backed cache once; preparing a later daemon
// streams that copy without another request or signaling a running sibling.
//
// Since: 2.0.0
func TestBlocklistMergerPreparesDaemonFromCache(testingObject *testing.T) {
	var requests atomic.Int32
	server := newBlocklistTLSServer(testingObject, http.HandlerFunc(func(
		responseWriter http.ResponseWriter,
		_ *http.Request,
	) {
		requests.Add(1)
		_, _ = io.WriteString(responseWriter, "range:5.5.6.0-5.5.6.1\n")
	}))
	sources := []string{server.URL}
	merger, runtimeDirectory, configRoot, entry := prepareBlocklistMergerTest(
		testingObject,
		sources,
		"protected",
	)
	trustBlocklistServer(testingObject, merger, server)
	if err := merger.reconcile(context.Background()); err != nil {
		testingObject.Fatalf("populate cached blocklist: %v", err)
	}

	secondEntry := daemonEntry{
		ConnectionID: "vpc-0000000000000002", Slot: 1, PeerPort: 51414,
	}
	prepareDaemonConfigForTest(testingObject, configRoot, secondEntry)
	writeDaemonEntriesForTest(testingObject, runtimeDirectory, []daemonEntry{entry, secondEntry})

	if _, err := merger.prepareDaemon(
		context.Background(),
		secondEntry,
		secondEntry.PeerPort,
	); err != nil {
		testingObject.Fatalf("prepare later daemon: %v", err)
	}
	path := filepath.Join(
		configRoot,
		secondEntry.ConnectionID,
		"blocklists",
		blocklist.SourceFileName(server.URL),
	)
	content, err := os.ReadFile(path)
	if err != nil {
		testingObject.Fatalf("read prepared blocklist: %v", err)
	}
	if string(content) != "tvpn:5.5.6.0-5.5.6.1\n" {
		testingObject.Fatalf("prepared blocklist = %q", content)
	}
	if requests.Load() != 1 {
		testingObject.Fatalf("source requests after daemon preparation = %d, want 1", requests.Load())
	}
}

// TestBlocklistMergerAllowsDaemonPreparationDuringDownload covers lock scope.
//
// A hanging source keeps the pass active while daemon preparation uses the last
// complete cache immediately instead of waiting for the source deadline.
//
// Since: 2.0.0
func TestBlocklistMergerAllowsDaemonPreparationDuringDownload(testingObject *testing.T) {
	downloadStarted := make(chan struct{})
	releaseDownload := make(chan struct{})
	var startOnce sync.Once
	var releaseOnce sync.Once
	release := func() {
		releaseOnce.Do(func() {
			close(releaseDownload)
		})
	}
	testingObject.Cleanup(release)
	server := newBlocklistTLSServer(testingObject, http.HandlerFunc(func(
		responseWriter http.ResponseWriter,
		request *http.Request,
	) {
		startOnce.Do(func() {
			close(downloadStarted)
		})
		select {
		case <-releaseDownload:
			_, _ = io.WriteString(responseWriter, "range:5.5.7.0-5.5.7.1\n")
		case <-request.Context().Done():
		}
	}))
	merger, _, _, entry := prepareBlocklistMergerTest(
		testingObject,
		[]string{server.URL},
		"protected",
	)
	trustBlocklistServer(testingObject, merger, server)
	reconcileResult := make(chan error, 1)
	go func() {
		reconcileResult <- merger.reconcile(context.Background())
	}()

	select {
	case <-downloadStarted:
	case <-time.After(5 * time.Second):
		testingObject.Fatal("blocklist download did not start")
	}
	prepareContext, cancelPrepare := context.WithTimeout(context.Background(), time.Second)
	defer cancelPrepare()
	if _, err := merger.prepareDaemon(prepareContext, entry, entry.PeerPort); err != nil {
		testingObject.Fatalf("prepare daemon during download: %v", err)
	}

	release()
	if err := <-reconcileResult; err != nil {
		testingObject.Fatalf("complete blocklist update: %v", err)
	}
}

// TestBlocklistMergerCleansOwnedFoldersAndSignalsEveryDaemon verifies installation.
//
// Removed-source files, native .bin indexes, and the legacy primary file are deleted;
// a fake signal seam observes one SIGHUP request for every registered child.
//
// Since: 2.0.0
func TestBlocklistMergerCleansOwnedFoldersAndSignalsEveryDaemon(testingObject *testing.T) {
	server := newBlocklistTLSServer(testingObject, http.HandlerFunc(func(
		responseWriter http.ResponseWriter,
		_ *http.Request,
	) {
		_, _ = io.WriteString(responseWriter, "range:6.6.6.6-6.6.6.7\n")
	}))
	merger, runtimeDirectory, configRoot, entry := prepareBlocklistMergerTest(testingObject, []string{server.URL}, "protected")
	trustBlocklistServer(testingObject, merger, server)
	secondEntry := daemonEntry{
		ConnectionID: "vpc-0000000000000002", Slot: 1, PeerPort: 51414,
	}
	prepareDaemonConfigForTest(testingObject, configRoot, secondEntry)
	writeDaemonEntriesForTest(testingObject, runtimeDirectory, []daemonEntry{entry, secondEntry})
	directory := filepath.Join(configRoot, entry.ConnectionID, "blocklists")
	if err := os.MkdirAll(directory, 0o750); err != nil {
		testingObject.Fatalf("create blocklist directory: %v", err)
	}
	for _, name := range []string{
		blocklist.SourceFileName("https://removed.example/list"),
		"tvpn-stale.txt.bin",
		"blocklist.bin",
		"unmanaged.txt",
	} {
		if err := os.WriteFile(filepath.Join(directory, name), []byte("stale"), 0o640); err != nil {
			testingObject.Fatalf("seed stale file %s: %v", name, err)
		}
	}

	liveValue, _ := json.Marshal(250)
	firstClient := &blocklistTestRPC{LiveSettings: map[string]json.RawMessage{
		"speed-limit-down": liveValue,
	}}
	secondClient := &blocklistTestRPC{LiveSettings: map[string]json.RawMessage{
		"speed-limit-down": liveValue,
	}}
	merger.runner.processes = map[string]*daemonProcess{
		entry.ConnectionID: {
			Entry: entry, ProcessID: 101, PeerPort: entry.PeerPort,
			Client: firstClient, Ready: true,
		},
		secondEntry.ConnectionID: {
			Entry: secondEntry, ProcessID: 202, PeerPort: secondEntry.PeerPort,
			Client: secondClient, Ready: true,
		},
	}
	var signalMutex sync.Mutex
	signaled := []int{}
	merger.runner.signalProcess = func(processID int) error {
		signalMutex.Lock()
		signaled = append(signaled, processID)
		signalMutex.Unlock()

		return nil
	}
	if err := merger.reconcile(context.Background()); err != nil {
		testingObject.Fatalf("cleaning update: %v", err)
	}
	entries, err := os.ReadDir(directory)
	if err != nil {
		testingObject.Fatalf("list cleaned folder: %v", err)
	}
	if len(entries) != 1 || entries[0].Name() != blocklist.SourceFileName(server.URL) {
		testingObject.Fatalf("cleaned folder entries = %#v", entries)
	}
	if !slices.Equal(signaled, []int{101, 202}) {
		testingObject.Fatalf("signaled process IDs = %#v", signaled)
	}
}

// TestBlocklistMergerPreservesLiveSettingsBeforeSIGHUP covers the shared reload path.
//
// A fake session-get supplies a live RPC change; the saved file keeps that value while
// runner-owned network, peer, RPC, and blocklist keys override conflicting live data.
//
// Since: 2.0.0
func TestBlocklistMergerPreservesLiveSettingsBeforeSIGHUP(testingObject *testing.T) {
	merger, _, configRoot, entry := prepareBlocklistMergerTest(
		testingObject,
		[]string{"https://127.0.0.1/list"},
		"protected",
	)
	client := &blocklistTestRPC{LiveSettings: map[string]json.RawMessage{
		"speed-limit-down":  json.RawMessage("250"),
		"bind-address-ipv4": json.RawMessage(`"203.0.113.10"`),
		"peer-port":         json.RawMessage("1"),
		"rpc-port":          json.RawMessage("1"),
		"blocklist-enabled": json.RawMessage("false"),
		"blocklist-url":     json.RawMessage(`"https://example.test/?token=secret"`),
	}}
	merger.runner.processes[entry.ConnectionID] = &daemonProcess{
		Entry: entry, ProcessID: 303, PeerPort: entry.PeerPort, Client: client, Ready: true,
	}
	var signals atomic.Int32
	merger.runner.signalProcess = func(processID int) error {
		if processID != 303 {
			testingObject.Fatalf("signal process ID = %d, want 303", processID)
		}
		signals.Add(1)

		return nil
	}
	if err := merger.runner.requestDaemonReloads(
		context.Background(),
		[]daemonEntry{entry},
		true,
	); err != nil {
		testingObject.Fatalf("reload daemon with live state: %v", err)
	}

	content, err := os.ReadFile(filepath.Join(configRoot, entry.ConnectionID, "settings.json"))
	if err != nil {
		testingObject.Fatalf("read reloaded daemon settings: %v", err)
	}
	settings := map[string]any{}
	if err := json.Unmarshal(content, &settings); err != nil {
		testingObject.Fatalf("decode reloaded daemon settings: %v", err)
	}
	wantedBind, err := transmissionconfig.SlotBindAddressIPv4(entry.Slot)
	if err != nil {
		testingObject.Fatalf("derive wanted bind address: %v", err)
	}
	if settings["speed-limit-down"] != float64(250) ||
		settings["bind-address-ipv4"] != wantedBind ||
		settings["peer-port"] != float64(entry.PeerPort) ||
		settings["rpc-port"] != float64(firstDaemonRPCPort+entry.Slot) ||
		settings["blocklist-enabled"] != true || settings["blocklist-url"] != "" ||
		client.Calls.Load() != 1 || signals.Load() != 1 {
		testingObject.Fatalf(
			"reloaded settings = %#v; RPC=%d signals=%d",
			settings,
			client.Calls.Load(),
			signals.Load(),
		)
	}
}

// TestBlocklistMergerMapsRenamedAndConvertedLiveSettings covers 4.1 compatibility.
//
// Encryption strings are written through the native settings.json format before
// each SIGHUP.
//
// Since: 2.0.0
func TestBlocklistMergerMapsRenamedAndConvertedLiveSettings(testingObject *testing.T) {
	tests := []struct {
		name        string
		rpcKey      string
		settingsKey string
		initial     json.RawMessage
		live        json.RawMessage
		want        json.RawMessage
	}{
		{
			name:        "encryption tolerated",
			rpcKey:      "encryption",
			settingsKey: "encryption",
			initial:     json.RawMessage("1"),
			live:        json.RawMessage(`"tolerated"`),
			want:        json.RawMessage("0"),
		},
		{
			name:        "encryption preferred",
			rpcKey:      "encryption",
			settingsKey: "encryption",
			initial:     json.RawMessage("0"),
			live:        json.RawMessage(`"preferred"`),
			want:        json.RawMessage("1"),
		},
		{
			name:        "encryption required",
			rpcKey:      "encryption",
			settingsKey: "encryption",
			initial:     json.RawMessage("0"),
			live:        json.RawMessage(`"required"`),
			want:        json.RawMessage("2"),
		},
	}

	for _, test := range tests {
		testingObject.Run(test.name, func(testingObject *testing.T) {
			merger, _, configRoot, entry := prepareBlocklistMergerTest(
				testingObject,
				[]string{"https://127.0.0.1/list"},
				"protected",
			)
			settingsPath := filepath.Join(configRoot, entry.ConnectionID, "settings.json")
			content, err := json.Marshal(map[string]json.RawMessage{
				test.settingsKey: test.initial,
			})
			if err != nil {
				testingObject.Fatalf("encode initial settings: %v", err)
			}
			if err := os.WriteFile(settingsPath, content, 0o640); err != nil {
				testingObject.Fatalf("write initial settings: %v", err)
			}
			client := &blocklistTestRPC{LiveSettings: map[string]json.RawMessage{
				test.rpcKey: test.live,
			}}
			merger.runner.processes[entry.ConnectionID] = &daemonProcess{
				Entry: entry, ProcessID: 303, PeerPort: entry.PeerPort, Client: client, Ready: true,
			}
			merger.runner.signalProcess = func(int) error {
				return nil
			}
			if err := merger.runner.requestDaemonReloads(
				context.Background(),
				[]daemonEntry{entry},
				true,
			); err != nil {
				testingObject.Fatalf("reload daemon: %v", err)
			}

			content, err = os.ReadFile(settingsPath)
			if err != nil {
				testingObject.Fatalf("read reloaded settings: %v", err)
			}
			settings := map[string]json.RawMessage{}
			if err := json.Unmarshal(content, &settings); err != nil {
				testingObject.Fatalf("decode reloaded settings: %v", err)
			}
			if !bytes.Equal(settings[test.settingsKey], test.want) {
				testingObject.Fatalf(
					"setting %s = %s, want %s",
					test.settingsKey,
					settings[test.settingsKey],
					test.want,
				)
			}
		})
	}
}

// TestBlocklistMergerDoesNotPersistUnmappedLiveSettings covers the allowlist edge.
//
// Read-only and unknown session-get fields cannot replace an existing native
// value or add a new settings.json key during a runner-owned reload.
//
// Since: 2.0.0
func TestBlocklistMergerDoesNotPersistUnmappedLiveSettings(testingObject *testing.T) {
	merger, _, configRoot, entry := prepareBlocklistMergerTest(
		testingObject,
		[]string{"https://127.0.0.1/list"},
		"protected",
	)
	settingsPath := filepath.Join(configRoot, entry.ConnectionID, "settings.json")
	if err := os.WriteFile(
		settingsPath,
		[]byte(`{"rpc-version":17,"speed-limit-down":100}`),
		0o640,
	); err != nil {
		testingObject.Fatalf("write initial settings: %v", err)
	}
	client := &blocklistTestRPC{LiveSettings: map[string]json.RawMessage{
		"blocklist-size":   json.RawMessage("1234"),
		"rpc-version":      json.RawMessage("99"),
		"speed-limit-down": json.RawMessage("300"),
	}}
	merger.runner.processes[entry.ConnectionID] = &daemonProcess{
		Entry: entry, ProcessID: 303, PeerPort: entry.PeerPort, Client: client, Ready: true,
	}
	merger.runner.signalProcess = func(int) error {
		return nil
	}
	if err := merger.runner.requestDaemonReloads(
		context.Background(),
		[]daemonEntry{entry},
		true,
	); err != nil {
		testingObject.Fatalf("reload daemon: %v", err)
	}

	content, err := os.ReadFile(settingsPath)
	if err != nil {
		testingObject.Fatalf("read reloaded settings: %v", err)
	}
	settings := map[string]json.RawMessage{}
	if err := json.Unmarshal(content, &settings); err != nil {
		testingObject.Fatalf("decode reloaded settings: %v", err)
	}
	if !bytes.Equal(settings["rpc-version"], json.RawMessage("17")) {
		testingObject.Fatalf("read-only rpc-version = %s, want 17", settings["rpc-version"])
	}
	if _, found := settings["blocklist-size"]; found {
		testingObject.Fatalf("read-only blocklist-size was written: %s", settings["blocklist-size"])
	}
	if !bytes.Equal(settings["speed-limit-down"], json.RawMessage("300")) {
		testingObject.Fatalf("mapped speed limit = %s, want 300", settings["speed-limit-down"])
	}
}

// TestBlocklistMergerDefersSignalsUntilRPCReadiness covers the early-SIGHUP race.
//
// Synchronization marks a starting child pending without signaling it; the first RPC
// readiness transition consumes one reload, and repeated readiness does not signal again.
//
// Since: 2.0.0
func TestBlocklistMergerDefersSignalsUntilRPCReadiness(testingObject *testing.T) {
	merger, _, _, entry := prepareBlocklistMergerTest(
		testingObject,
		[]string{"https://127.0.0.1/list"},
		"protected",
	)
	client := &blocklistTestRPC{LiveSettings: map[string]json.RawMessage{
		"speed-limit-down": json.RawMessage("275"),
	}}
	merger.runner.processes[entry.ConnectionID] = &daemonProcess{
		Entry: entry, ProcessID: 404, PeerPort: entry.PeerPort, Client: client,
	}
	var signals atomic.Int32
	merger.runner.signalProcess = func(int) error {
		signals.Add(1)

		return nil
	}
	if err := merger.runner.requestDaemonReloads(
		context.Background(),
		[]daemonEntry{entry},
		true,
	); err != nil {
		testingObject.Fatalf("defer starting-daemon reload: %v", err)
	}
	if signals.Load() != 0 || client.Calls.Load() != 0 ||
		!merger.runner.processes[entry.ConnectionID].ReloadPending {
		testingObject.Fatalf(
			"pre-readiness work: RPC=%d signals=%d process=%#v",
			client.Calls.Load(),
			signals.Load(),
			merger.runner.processes[entry.ConnectionID],
		)
	}
	if err := merger.runner.markDaemonReady(
		context.Background(),
		entry.ConnectionID,
		404,
	); err != nil {
		testingObject.Fatalf("deliver deferred reload: %v", err)
	}
	if err := merger.runner.markDaemonReady(
		context.Background(),
		entry.ConnectionID,
		404,
	); err != nil {
		testingObject.Fatalf("repeat readiness: %v", err)
	}
	if signals.Load() != 1 || client.Calls.Load() != 1 ||
		merger.runner.processes[entry.ConnectionID].ReloadPending {
		testingObject.Fatalf(
			"post-readiness work: RPC=%d signals=%d process=%#v",
			client.Calls.Load(),
			signals.Load(),
			merger.runner.processes[entry.ConnectionID],
		)
	}
}

// TestBlocklistMergerClosesIdleConnections verifies each source transport is retired.
//
// The fixture observes its keep-alive connection close before server cleanup, proving
// completed downloads do not leave per-source transports and goroutines lingering.
//
// Since: 2.0.0
func TestBlocklistMergerClosesIdleConnections(testingObject *testing.T) {
	closed := make(chan struct{})
	var closeOnce sync.Once
	server := newBlocklistTLSServerWithState(
		testingObject,
		http.HandlerFunc(func(responseWriter http.ResponseWriter, _ *http.Request) {
			_, _ = io.WriteString(responseWriter, "range:13.0.0.1-13.0.0.1\n")
		}),
		func(_ net.Conn, state http.ConnState) {
			if state == http.StateClosed {
				closeOnce.Do(func() { close(closed) })
			}
		},
	)
	merger, _, _, _ := prepareBlocklistMergerTest(testingObject, []string{server.URL}, "protected")
	trustBlocklistServer(testingObject, merger, server)
	copy, err := merger.downloadAndNormalize(
		context.Background(),
		server.URL,
		blocklistRoute{SourceIP: net.ParseIP("127.0.0.1").To4()},
		time.Now(),
	)
	if err != nil {
		testingObject.Fatalf("download idle-connection fixture: %v", err)
	}
	_ = copy.File.Close()
	select {
	case <-closed:
	case <-time.After(time.Second):
		testingObject.Fatal("source keep-alive connection remained open")
	}
}

// TestBlocklistMergerScrubsSourceSecretsFromErrors covers typed and generic failures.
//
// url.Error is reduced to its cause, and fallback text loses complete URLs and query
// values before it can reach status, logs, or the compatible RPC facade.
//
// Since: 2.0.0
func TestBlocklistMergerScrubsSourceSecretsFromErrors(testingObject *testing.T) {
	merger, _, _, _ := prepareBlocklistMergerTest(testingObject, []string{}, "protected")
	merger.dialContext = func(
		*net.Dialer,
		context.Context,
		string,
		string,
	) (net.Conn, error) {
		return nil, errors.New("connection refused")
	}
	source := "https://127.0.0.1/list?token=secret&pin=123456"
	_, err := merger.downloadAndNormalize(
		context.Background(),
		source,
		blocklistRoute{SourceIP: net.ParseIP("127.0.0.1").To4()},
		time.Now(),
	)
	if err == nil {
		testingObject.Fatal("secret-bearing source unexpectedly downloaded")
	}
	for label, message := range map[string]string{
		"typed":   displaySafeBlocklistError(err),
		"generic": displaySafeBlocklistError(errors.New("fetch https://example.test/list?token=secret failed ?pin=123456")),
	} {
		if strings.Contains(message, "https://") || strings.Contains(message, "secret") ||
			strings.Contains(message, "123456") || strings.Contains(message, "token=") ||
			strings.Contains(message, "pin=") {
			testingObject.Fatalf("%s safe error leaked source data: %q", label, message)
		}
	}
}

// TestBlocklistMergerSchedulesIntervalsAndRequests verifies every time-based trigger.
//
// Ordinary polls do not redownload, the configured interval does, and a changed manual
// request timestamp bypasses the newly reset interval immediately.
//
// Since: 2.0.0
func TestBlocklistMergerSchedulesIntervalsAndRequests(testingObject *testing.T) {
	var requests atomic.Int32
	server := newBlocklistTLSServer(testingObject, http.HandlerFunc(func(
		responseWriter http.ResponseWriter,
		_ *http.Request,
	) {
		requests.Add(1)
		_, _ = io.WriteString(responseWriter, "range:7.7.7.7-7.7.7.7\n")
	}))
	sources := []string{server.URL}
	merger, runtimeDirectory, _, _ := prepareBlocklistMergerTest(testingObject, sources, "protected")
	trustBlocklistServer(testingObject, merger, server)
	now := time.Date(2026, 11, 5, 16, 0, 0, 0, time.UTC)
	merger.clock = func() time.Time { return now }
	if err := merger.reconcile(context.Background()); err != nil {
		testingObject.Fatalf("initial update: %v", err)
	}
	now = now.Add(23 * time.Hour)
	if err := merger.reconcile(context.Background()); err != nil {
		testingObject.Fatalf("early poll: %v", err)
	}
	if requests.Load() != 1 {
		testingObject.Fatalf("requests before interval = %d, want 1", requests.Load())
	}
	now = now.Add(time.Hour)
	if err := merger.reconcile(context.Background()); err != nil {
		testingObject.Fatalf("interval update: %v", err)
	}
	if requests.Load() != 2 {
		testingObject.Fatalf("requests at interval = %d, want 2", requests.Load())
	}
	now = now.Add(time.Minute)
	requestedAt := now
	writeBlocklistConfigurationForTest(testingObject, runtimeDirectory, blocklist.Configuration{
		Enabled: true, Sources: sources, UpdateIntervalHours: 24, UpdateRequestedAt: &requestedAt,
	})
	if err := merger.reconcile(context.Background()); err != nil {
		testingObject.Fatalf("manual update: %v", err)
	}
	if requests.Load() != 3 {
		testingObject.Fatalf("requests after manual marker = %d, want 3", requests.Load())
	}
}

// prepareBlocklistMergerTest creates one default daemon and desired merger state.
//
// The fixed bind-address seam uses loopback only inside tests; production retains the
// permanent 198.18.<slot>.1 address supplied by transmissionconfig.
//
// Since: 2.0.0
func prepareBlocklistMergerTest(
	testingObject *testing.T,
	sources []string,
	vpnState string,
) (*blocklistMerger, string, string, daemonEntry) {
	testingObject.Helper()
	configuredRunner, runtimeDirectory, configRoot, _ := prepareRunnerTest(testingObject)
	entry := daemonEntry{
		ConnectionID: "vpc-0000000000000001", Slot: 0, PeerPort: 51413, Default: true,
	}
	prepareDaemonConfigForTest(testingObject, configRoot, entry)
	writeDaemonEntriesForTest(testingObject, runtimeDirectory, []daemonEntry{entry})
	writeVPNStatusForTest(testingObject, runtimeDirectory, entry, vpnState, "10.99.0.2")
	writeBlocklistConfigurationForTest(testingObject, runtimeDirectory, blocklist.Configuration{
		Enabled: true, Sources: sources, UpdateIntervalHours: 24,
	})
	configuredRunner.blocklists.bindAddressForSlot = func(int) (string, error) {
		return "127.0.0.1", nil
	}

	return configuredRunner.blocklists, runtimeDirectory, configRoot, entry
}

// prepareDaemonConfigForTest creates a post-migration daemon settings directory.
//
// Merger tests start at the same ownership boundary as superviseDaemon: the config
// directory exists already, while the blocklists child may still need creation.
//
// Since: 2.0.0
func prepareDaemonConfigForTest(
	testingObject *testing.T,
	configRoot string,
	entry daemonEntry,
) {
	testingObject.Helper()
	directory := filepath.Join(configRoot, entry.ConnectionID)
	if err := os.MkdirAll(directory, 0o750); err != nil {
		testingObject.Fatalf("create daemon config fixture: %v", err)
	}
	settings, err := json.Marshal(map[string]any{
		"blocklist-enabled": false,
		"blocklist-url":     "",
		"speed-limit-down":  100,
	})
	if err != nil {
		testingObject.Fatalf("encode daemon settings fixture: %v", err)
	}
	if err := os.WriteFile(filepath.Join(directory, "settings.json"), settings, 0o640); err != nil {
		testingObject.Fatalf("write daemon settings fixture: %v", err)
	}
}

// writeBlocklistConfigurationForTest atomically publishes one desired test artifact.
//
// Test failures are reported at the caller while production publication remains owned
// by the API's settings and manual-update paths.
//
// Since: 2.0.0
func writeBlocklistConfigurationForTest(
	testingObject *testing.T,
	runtimeDirectory string,
	configuration blocklist.Configuration,
) {
	testingObject.Helper()
	path := filepath.Join(
		runtimeDirectory,
		"transmission-config",
		blocklist.ConfigurationFileName,
	)
	if err := blocklist.WriteJSON(path, configuration, 0o640); err != nil {
		testingObject.Fatalf("write blocklist configuration: %v", err)
	}
}

// readBlocklistStatusForTest decodes the runner status or fails its caller.
//
// The helper keeps assertions focused on merger state rather than repeated artifact
// path construction and error handling.
//
// Since: 2.0.0
func readBlocklistStatusForTest(
	testingObject *testing.T,
	merger *blocklistMerger,
) blocklist.Status {
	testingObject.Helper()
	status, err := blocklist.ReadStatus(merger.statusPath())
	if err != nil {
		testingObject.Fatalf("read blocklist status: %v", err)
	}

	return status
}

// newBlocklistTLSServer creates an IPv4 httptest TLS listener.
//
// Explicit IPv4 matches the runner's protected source-address contract and avoids
// depending on the host's localhost address ordering.
//
// Since: 2.0.0
func newBlocklistTLSServer(
	testingObject *testing.T,
	handler http.Handler,
) *httptest.Server {
	testingObject.Helper()
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		testingObject.Fatalf("listen for TLS blocklist: %v", err)
	}
	server := httptest.NewUnstartedServer(handler)
	server.Listener = listener
	server.StartTLS()
	testingObject.Cleanup(server.Close)

	return server
}

// newBlocklistTLSServerWithState creates an IPv4 TLS fixture with connection hooks.
//
// The separate helper keeps ordinary source tests terse while allowing lifecycle tests
// to observe a transport close before httptest server cleanup runs.
//
// Since: 2.0.0
func newBlocklistTLSServerWithState(
	testingObject *testing.T,
	handler http.Handler,
	connectionState func(net.Conn, http.ConnState),
) *httptest.Server {
	testingObject.Helper()
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		testingObject.Fatalf("listen for stateful TLS blocklist: %v", err)
	}
	server := httptest.NewUnstartedServer(handler)
	server.Listener = listener
	server.Config.ConnState = connectionState
	server.StartTLS()
	testingObject.Cleanup(server.Close)

	return server
}

// trustBlocklistServer injects one httptest certificate through the merger's test seam.
//
// No environment variable or process-global trust store is changed, matching the
// requirement that TLS test trust remain explicit and isolated.
//
// Since: 2.0.0
func trustBlocklistServer(
	testingObject *testing.T,
	merger *blocklistMerger,
	server *httptest.Server,
) {
	testingObject.Helper()
	certificatePool := x509.NewCertPool()
	certificatePool.AddCert(server.Certificate())
	merger.rootCAs = certificatePool
}

// newBlocklistDNSServer serves one minimal A response on an assigned UDP port.
//
// The resolver test injects the returned port while retaining production's pure-Go
// lookup and bound net.Dialer path for the complete hostname connection flow.
//
// Since: 2.0.0
func newBlocklistDNSServer(testingObject *testing.T, address net.IP) string {
	testingObject.Helper()
	connection, err := net.ListenUDP("udp4", &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1)})
	if err != nil {
		testingObject.Fatalf("listen for fake DNS: %v", err)
	}
	stopped := make(chan struct{})
	go func() {
		defer close(stopped)
		buffer := make([]byte, 4096)
		for {
			readBytes, clientAddress, readError := connection.ReadFromUDP(buffer)
			if readError != nil {
				return
			}
			response, responseError := blocklistDNSResponse(buffer[:readBytes], address)
			if responseError == nil {
				_, _ = connection.WriteToUDP(response, clientAddress)
			}
		}
	}()
	testingObject.Cleanup(func() {
		_ = connection.Close()
		<-stopped
	})

	return fmt.Sprintf("%d", connection.LocalAddr().(*net.UDPAddr).Port)
}

// blocklistDNSResponse builds one authoritative IPv4 answer for a test query.
//
// The implementation copies the original encoded question and appends a compressed
// A record, which is sufficient to exercise net.Resolver without a DNS dependency.
//
// Since: 2.0.0
func blocklistDNSResponse(query []byte, address net.IP) ([]byte, error) {
	if len(query) < 17 || binary.BigEndian.Uint16(query[4:6]) != 1 {
		return nil, errors.New("unexpected DNS query")
	}
	questionEnd := 12
	for {
		if questionEnd >= len(query) {
			return nil, errors.New("truncated DNS name")
		}
		labelBytes := int(query[questionEnd])
		questionEnd++
		if labelBytes == 0 {
			break
		}
		questionEnd += labelBytes
	}
	questionEnd += 4
	if questionEnd > len(query) {
		return nil, errors.New("truncated DNS question")
	}

	response := append([]byte(nil), query[:questionEnd]...)
	binary.BigEndian.PutUint16(response[2:4], 0x8180)
	binary.BigEndian.PutUint16(response[6:8], 1)
	binary.BigEndian.PutUint16(response[8:10], 0)
	binary.BigEndian.PutUint16(response[10:12], 0)
	answer := []byte{
		0xc0, 0x0c,
		0x00, 0x01,
		0x00, 0x01,
		0x00, 0x00, 0x00, 0x3c,
		0x00, 0x04,
	}
	response = append(response, answer...)
	response = append(response, address.To4()...)

	return response, nil
}

// writeBlocklistVPNStatusForTest publishes protected route data with DNS servers.
//
// The shared runner helper predates blocklist DNS routing, so this focused helper adds
// only the fields consumed by protectedDefaultRoute.
//
// Since: 2.0.0
func writeBlocklistVPNStatusForTest(
	testingObject *testing.T,
	runtimeDirectory string,
	entry daemonEntry,
	state string,
	dnsServers []string,
) {
	testingObject.Helper()
	content, err := json.Marshal(blocklistVPNStatus{
		ConnectionID: entry.ConnectionID,
		Slot:         entry.Slot,
		State:        state,
		DNSServers:   dnsServers,
	})
	if err != nil {
		testingObject.Fatalf("encode blocklist VPN status: %v", err)
	}
	if err := os.WriteFile(
		filepath.Join(runtimeDirectory, "vpn.status.d", entry.ConnectionID+".json"),
		content,
		0o640,
	); err != nil {
		testingObject.Fatalf("write blocklist VPN status: %v", err)
	}
}

// gzipTestContent compresses one source fixture with a real gzip writer.
//
// Writer closure is checked so corrupt test data cannot accidentally exercise the
// failure path intended for the merger itself.
//
// Since: 2.0.0
func gzipTestContent(testingObject *testing.T, content []byte) []byte {
	testingObject.Helper()
	var buffer bytes.Buffer
	writer := gzip.NewWriter(&buffer)
	if _, err := writer.Write(content); err != nil {
		testingObject.Fatalf("write gzip fixture: %v", err)
	}
	if err := writer.Close(); err != nil {
		testingObject.Fatalf("close gzip fixture: %v", err)
	}

	return buffer.Bytes()
}

// zipTestContent compresses one source fixture after a directory member.
//
// The member ordering proves that the merger selects the first regular file rather
// than assuming the archive's first entry is readable content.
//
// Since: 2.0.0
func zipTestContent(testingObject *testing.T, content []byte) []byte {
	testingObject.Helper()
	var buffer bytes.Buffer
	writer := zip.NewWriter(&buffer)
	if _, err := writer.Create("folder/"); err != nil {
		testingObject.Fatalf("create zip directory fixture: %v", err)
	}
	file, err := writer.Create("folder/list.txt")
	if err != nil {
		testingObject.Fatalf("create zip file fixture: %v", err)
	}
	if _, err := file.Write(content); err != nil {
		testingObject.Fatalf("write zip fixture: %v", err)
	}
	if err := writer.Close(); err != nil {
		testingObject.Fatalf("close zip fixture: %v", err)
	}

	return buffer.Bytes()
}

// zipTestEntries creates a valid archive with the requested regular-file count.
//
// Every member contains one valid range so a limit regression would continue through
// normal parsing instead of failing for unrelated empty or malformed content.
//
// Since: 2.0.0
func zipTestEntries(testingObject *testing.T, entries int) []byte {
	testingObject.Helper()
	var buffer bytes.Buffer
	writer := zip.NewWriter(&buffer)
	for index := range entries {
		file, err := writer.Create(fmt.Sprintf("list-%04d.txt", index))
		if err != nil {
			testingObject.Fatalf("create zip entry fixture: %v", err)
		}
		if _, err := io.WriteString(file, "range:14.0.0.1-14.0.0.1\n"); err != nil {
			testingObject.Fatalf("write zip entry fixture: %v", err)
		}
	}
	if err := writer.Close(); err != nil {
		testingObject.Fatalf("close zip entry fixture: %v", err)
	}

	return buffer.Bytes()
}
