package api

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/netip"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionconfig"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/vpnhttp"
)

const (
	// maximumTorrentPreviewLinks bounds one preview request's fan-out.
	//
	// The console batches larger pastes so one authenticated request cannot open an
	// unbounded number of remote connections or retain an unbounded response.
	//
	// Since: UNRELEASED
	maximumTorrentPreviewLinks = 20

	// maximumTorrentPreviewBytes bounds one downloaded metainfo response.
	//
	// A sentinel byte distinguishes an exact-limit torrent from an oversized body
	// before the bencode parser receives the in-memory content.
	//
	// Since: UNRELEASED
	maximumTorrentPreviewBytes = 10 << 20

	// torrentPreviewTimeout bounds DNS, redirects, headers, and body reads.
	//
	// Every URL in a batch shares the request deadline, keeping a pasted list from
	// multiplying the maximum wait by its number of links.
	//
	// Since: UNRELEASED
	torrentPreviewTimeout = 15 * time.Second
)

var torrentPreviewMetadataPrefixes = []netip.Prefix{
	netip.MustParsePrefix("100.100.100.200/32"),
	netip.MustParsePrefix("169.254.169.254/32"),
	netip.MustParsePrefix("169.254.170.2/32"),
}

var torrentPreviewNonPublicPrefixes = []netip.Prefix{
	netip.MustParsePrefix("0.0.0.0/8"),
	netip.MustParsePrefix("100.64.0.0/10"),
	netip.MustParsePrefix("192.0.0.0/24"),
	netip.MustParsePrefix("192.0.2.0/24"),
	netip.MustParsePrefix("192.88.99.0/24"),
	netip.MustParsePrefix("198.18.0.0/15"),
	netip.MustParsePrefix("198.51.100.0/24"),
	netip.MustParsePrefix("203.0.113.0/24"),
	netip.MustParsePrefix("240.0.0.0/4"),
}

// torrentLinkPreview is one successfully resolved source in input order.
//
// Index avoids echoing credential-like query values while allowing the browser to
// associate a preview with the exact row it submitted.
type torrentLinkPreview struct {
	Index     int    `json:"index"`
	Name      string `json:"name"`
	Hash      string `json:"hash"`
	TotalSize *int64 `json:"totalSize,omitempty"`
}

// torrentLinkPreviewResponse keeps failed or unavailable previews quiet.
//
// Items is always an array; omitted indexes continue using the console's local URL
// guess without turning a transient VPN or remote-server failure into an alert.
type torrentLinkPreviewResponse struct {
	Items []torrentLinkPreview `json:"items"`
}

// handlePreviewTorrentLinks resolves magnets locally and remote metainfo through VPN.
//
// Remote failures are intentionally omitted from the result. The route never logs a
// submitted URL, so query strings cannot escape through routine diagnostics.
//
// Since: UNRELEASED
func (server *Server) handlePreviewTorrentLinks(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	var input struct {
		Links []string `json:"links"`
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}
	if len(input.Links) > maximumTorrentPreviewLinks {
		writeError(
			responseWriter,
			http.StatusUnprocessableEntity,
			"torrent_preview_links_invalid",
			"Preview at most 20 torrent links at a time.",
		)

		return
	}

	itemsByIndex := make([]*torrentLinkPreview, len(input.Links))
	remoteURLs := make(map[int]*url.URL, len(input.Links))
	for index, link := range input.Links {
		link = strings.TrimSpace(link)
		if preview, ok := torrentMagnetPreview(link, index); ok {
			itemsByIndex[index] = &preview

			continue
		}

		parsedURL, err := validateTorrentPreviewURL(link)
		if err == nil {
			remoteURLs[index] = parsedURL
		}
	}

	if len(remoteURLs) > 0 {
		route, err := server.torrentPreviewRoute(request.Context())
		if err == nil {
			clientFactory := server.torrentPreviewClient
			if clientFactory == nil {
				clientFactory = newTorrentPreviewHTTPClient
			}
			client := clientFactory(route)
			previewContext, cancelPreview := context.WithTimeout(
				request.Context(),
				torrentPreviewTimeout,
			)

			var waitGroup sync.WaitGroup
			for index, parsedURL := range remoteURLs {
				waitGroup.Add(1)
				go func() {
					defer waitGroup.Done()

					preview, previewError := previewTorrentURL(
						previewContext,
						client,
						parsedURL,
						index,
					)
					if previewError == nil {
						itemsByIndex[index] = &preview
					}
				}()
			}
			waitGroup.Wait()
			cancelPreview()
			client.CloseIdleConnections()
		}
	}

	items := make([]torrentLinkPreview, 0, len(itemsByIndex))
	for _, item := range itemsByIndex {
		if item != nil {
			items = append(items, *item)
		}
	}

	writeJSON(responseWriter, http.StatusOK, torrentLinkPreviewResponse{Items: items})
}

// torrentPreviewRoute returns the protected default connection's shared route.
//
// The in-process daemon set supplies durable identity and slot data, while vpnhttp
// verifies those values against the controller's current protected status file.
func (server *Server) torrentPreviewRoute(ctx context.Context) (vpnhttp.Route, error) {
	for _, daemon := range server.transmissionDaemons(ctx) {
		if daemon.Default {
			return vpnhttp.ProtectedRoute(
				server.runtimeDirectory,
				daemon.ConnectionID,
				daemon.Slot,
				transmissionconfig.SlotBindAddressIPv4,
			)
		}
	}

	return vpnhttp.Route{}, vpnhttp.ErrNotProtected
}

// newTorrentPreviewHTTPClient creates the remote metainfo transport.
//
// It reuses the blocklist downloader's protected DNS and source-binding client,
// adding preview-specific redirect and public-destination restrictions.
func newTorrentPreviewHTTPClient(route vpnhttp.Route) *http.Client {
	return vpnhttp.NewClient(vpnhttp.ClientOptions{
		Route:                 route,
		ConnectTimeout:        torrentPreviewTimeout,
		ResponseHeaderTimeout: torrentPreviewTimeout,
		RequestTimeout:        torrentPreviewTimeout,
		MaximumRedirects:      3,
		ValidateURL:           validateParsedTorrentPreviewURL,
		ValidateAddress:       validateTorrentPreviewAddress,
	})
}

// previewTorrentURL downloads and parses one bounded metainfo response.
//
// Non-success statuses, oversized bodies, and malformed torrents become quiet row
// fallbacks at the handler boundary rather than user-facing preview errors.
func previewTorrentURL(
	ctx context.Context,
	client *http.Client,
	parsedURL *url.URL,
	index int,
) (torrentLinkPreview, error) {
	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		parsedURL.String(),
		nil,
	)
	if err != nil {
		return torrentLinkPreview{}, errors.New("prepare torrent preview request")
	}
	request.Header.Set("Accept-Encoding", "identity")

	response, err := client.Do(request)
	if err != nil {
		return torrentLinkPreview{}, errors.New("download torrent preview")
	}
	defer response.Body.Close()

	if response.StatusCode < http.StatusOK || response.StatusCode > 299 {
		return torrentLinkPreview{}, errors.New("torrent preview server returned an error")
	}
	if response.ContentLength > maximumTorrentPreviewBytes {
		return torrentLinkPreview{}, errors.New("torrent preview is too large")
	}

	content, err := io.ReadAll(io.LimitReader(
		response.Body,
		maximumTorrentPreviewBytes+1,
	))
	if err != nil || len(content) > maximumTorrentPreviewBytes {
		return torrentLinkPreview{}, errors.New("torrent preview is too large")
	}

	name, totalSize, hash, err := torrentMetainfoPreview(content)
	if err != nil {
		return torrentLinkPreview{}, errors.New("torrent preview metainfo is invalid")
	}

	return torrentLinkPreview{
		Index:     index,
		Name:      name,
		Hash:      hash,
		TotalSize: &totalSize,
	}, nil
}

// torrentMagnetPreview extracts a display name and v1 hash without network access.
//
// A magnet missing either value remains on the console's ordinary guess path; valid
// magnets preview even when no VPN connection is currently protected.
func torrentMagnetPreview(link string, index int) (torrentLinkPreview, bool) {
	parsedURL, err := url.Parse(link)
	if err != nil || !strings.EqualFold(parsedURL.Scheme, "magnet") {
		return torrentLinkPreview{}, false
	}

	name := strings.TrimSpace(parsedURL.Query().Get("dn"))
	hash, known, err := torrentSourceHash(link, nil)
	if err != nil || !known || name == "" {
		return torrentLinkPreview{}, false
	}

	return torrentLinkPreview{
		Index: index,
		Name:  name,
		Hash:  hash,
	}, true
}

// validateTorrentPreviewURL parses one credential-free HTTP or HTTPS URL.
//
// The same policy is applied to initial links and each redirect before a transport
// dial, with resolved destinations checked separately by vpnhttp.
func validateTorrentPreviewURL(rawURL string) (*url.URL, error) {
	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		return nil, errors.New("torrent preview URL is invalid")
	}
	if err := validateParsedTorrentPreviewURL(parsedURL); err != nil {
		return nil, err
	}

	return parsedURL, nil
}

// validateParsedTorrentPreviewURL enforces the redirect-safe textual URL policy.
//
// Literal destinations are checked immediately; hostnames receive the same address
// policy after VPN-bound DNS resolution in the shared transport.
func validateParsedTorrentPreviewURL(parsedURL *url.URL) error {
	if parsedURL == nil ||
		(!strings.EqualFold(parsedURL.Scheme, "http") &&
			!strings.EqualFold(parsedURL.Scheme, "https")) ||
		parsedURL.Host == "" ||
		parsedURL.Hostname() == "" {
		return errors.New("torrent preview URL must use HTTP or HTTPS")
	}
	if parsedURL.User != nil {
		return errors.New("torrent preview URL cannot contain credentials")
	}
	if literal, err := netip.ParseAddr(parsedURL.Hostname()); err == nil {
		return validateTorrentPreviewAddress(literal)
	}

	return nil
}

// validateTorrentPreviewAddress permits only public unicast destinations.
//
// Loopback, private, link-local, metadata, multicast, and unspecified addresses are
// refused after DNS resolution and again for literal redirect targets.
func validateTorrentPreviewAddress(address netip.Addr) error {
	address = address.Unmap()
	if address.IsLoopback() {
		return errors.New("torrent preview destination is loopback")
	}
	if address.IsPrivate() {
		return errors.New("torrent preview destination is private")
	}
	for _, prefix := range torrentPreviewMetadataPrefixes {
		if prefix.Contains(address) {
			return errors.New("torrent preview destination is a metadata service")
		}
	}
	if address.IsLinkLocalUnicast() || address.IsLinkLocalMulticast() {
		return errors.New("torrent preview destination is link-local")
	}
	for _, prefix := range torrentPreviewNonPublicPrefixes {
		if prefix.Contains(address) {
			return errors.New("torrent preview destination is not public unicast")
		}
	}
	if !address.IsGlobalUnicast() || address.IsUnspecified() || address.IsMulticast() {
		return errors.New("torrent preview destination is not public unicast")
	}

	return nil
}
