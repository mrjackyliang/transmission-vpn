package main

import (
	"archive/zip"
	"compress/gzip"
	"context"
	"crypto/x509"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/blocklist"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionconfig"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/vpnhttp"
)

const (
	// blocklistConnectTimeout bounds DNS and TCP connection establishment.
	//
	// The per-source deadline remains longer so slow but progressing HTTPS bodies can
	// finish without weakening the fail-closed route selection.
	//
	// Since: 2.0.0
	blocklistConnectTimeout = 30 * time.Second

	// blocklistSourceTimeout bounds one source including redirects and decompression.
	//
	// Sources are processed sequentially so this also bounds how long one bad endpoint
	// can delay the remaining saved list.
	//
	// Since: 2.0.0
	blocklistSourceTimeout = 5 * time.Minute

	// blocklistMaximumDownloadBytes bounds one compressed or plain HTTP response.
	//
	// The runner reads one sentinel byte past this value so an exact-limit response is
	// accepted while every larger response is rejected.
	//
	// Since: 2.0.0
	blocklistMaximumDownloadBytes = 64 << 20

	// blocklistMaximumUnpackedBytes bounds the validated source text.
	//
	// This separate limit prevents a small gzip or zip response from expanding without
	// bound inside the long-running runner process.
	//
	// Since: 2.0.0
	blocklistMaximumUnpackedBytes = 512 << 20

	// blocklistMaximumNormalizedBytes bounds one source's canonical output.
	//
	// Normalized IPv6 ranges can be much longer than their input CIDRs, so this disk
	// limit is enforced independently while each accepted line is streamed.
	//
	// Since: 2.0.0
	blocklistMaximumNormalizedBytes = 128 << 20

	// blocklistMaximumRanges bounds the accepted lines in one source.
	//
	// The count limit complements the byte limit for very short IPv4 ranges and keeps
	// Transmission's later index construction within a predictable workload.
	//
	// Since: 2.0.0
	blocklistMaximumRanges = 2_000_000

	// blocklistMaximumTotalBytes bounds all normalized sources in one merged set.
	//
	// The logical set is capped before it is streamed into daemon folders, preventing
	// many individually valid sources from exhausting persistent storage together.
	//
	// Since: 2.0.0
	blocklistMaximumTotalBytes = 256 << 20

	// blocklistMaximumTotalRanges bounds all accepted ranges in one merged set.
	//
	// The aggregate limit constrains the per-daemon in-memory index even when several
	// individually valid sources are configured together.
	//
	// Since: 2.0.0
	blocklistMaximumTotalRanges = 3_000_000

	// blocklistMaximumZipEntries bounds archive metadata before archive/zip runs.
	//
	// The central directory is inspected from fixed-size end records so an entry bomb
	// is rejected before Go allocates one File value per member.
	//
	// Since: 2.0.0
	blocklistMaximumZipEntries = 1_000

	// blocklistMaximumZipDirectoryBytes bounds archive metadata read by archive/zip.
	//
	// Eight MiB leaves ample room for one thousand descriptive filenames while keeping
	// a small downloaded archive from expanding into an unbounded directory table.
	//
	// Since: 2.0.0
	blocklistMaximumZipDirectoryBytes = 8 << 20

	// blocklistSynchronizationRetryDelay backs off failed daemon installations.
	//
	// The configured source interval may shorten this delay, while ordinary one-second
	// runner polls never redownload immediately after a persistent filesystem failure.
	//
	// Since: 2.0.0
	blocklistSynchronizationRetryDelay = 15 * time.Minute
)

var (
	// errBlocklistWaitingForVPN marks a due update whose default route is not protected.
	//
	// It is a state transition rather than a source failure, so existing copies stay in
	// use and the manager retries immediately after protection returns.
	//
	// Since: 2.0.0
	errBlocklistWaitingForVPN = errors.New("default VPN connection is not protected")

	// errBlocklistDownloadTooLarge identifies a response above the compressed cap.
	//
	// The stable error keeps status display-safe and lets focused tests distinguish the
	// downloaded and unpacked boundaries.
	//
	// Since: 2.0.0
	errBlocklistDownloadTooLarge = errors.New("The downloaded list is larger than 64 MiB.")

	// errBlocklistUnpackedTooLarge identifies content above the decompressed cap.
	//
	// It applies to gzip, zip, and plain data through the same bounded reader helper.
	//
	// Since: 2.0.0
	errBlocklistUnpackedTooLarge = errors.New("The unpacked list is larger than 512 MiB.")

	// errBlocklistTooLarge is the approved normalized, range, aggregate, and zip error.
	//
	// One stable display-safe message prevents implementation-specific size details
	// from leaking through per-source status or the compatible RPC facade.
	//
	// Since: 2.0.0
	errBlocklistTooLarge = errors.New("This list is too large.")

	// errBlocklistDaemonNotPrepared marks a config directory not yet owned by a child.
	//
	// Periodic synchronization skips this transient state so the merger never creates
	// a directory ahead of legacy migration or normal daemon preparation.
	//
	// Since: 2.0.0
	errBlocklistDaemonNotPrepared = errors.New("daemon configuration is not prepared")

	// errBlocklistDirectoryUnsafe identifies a linked or non-directory blocklists path.
	//
	// The stable message is safe to publish with the daemon identifier and guarantees
	// no cleanup is attempted through an attacker-controlled filesystem entry.
	//
	// Since: 2.0.0
	errBlocklistDirectoryUnsafe = errors.New("the blocklists path is not a directory")

	// blocklistURLPattern locates URL-shaped text in otherwise untyped errors.
	//
	// url.Error values are unwrapped first; this fallback scrubs third-party or system
	// errors that embed an address despite not exposing url.Error themselves.
	//
	// Since: 2.0.0
	blocklistURLPattern = regexp.MustCompile(`(?i)\b[a-z][a-z0-9+.-]*://[^\s"'<>]+`)

	// blocklistQueryPattern locates query fragments left outside a complete URL.
	//
	// Replacing the fragment rather than parsing it keeps malformed error text from
	// exposing token values after a question mark.
	//
	// Since: 2.0.0
	blocklistQueryPattern = regexp.MustCompile(`\?[^\s"'<>]*`)
)

// blocklistRoute contains one protected default connection's outbound parameters.
//
// The alias keeps runner call sites readable while both blocklists and torrent
// previews share vpnhttp's source-bound transport contract.
//
// Since: 2.0.0
type blocklistRoute = vpnhttp.Route

// blocklistVPNStatus is the persisted controller projection used by runner tests.
//
// Route validation now lives in vpnhttp, but retaining this local JSON contract
// keeps the blocklist fixture aligned with the status file that package consumes.
//
// Since: 2.0.0
type blocklistVPNStatus struct {
	ConnectionID string   `json:"connectionId"`
	Slot         int      `json:"slot"`
	State        string   `json:"state"`
	DNSServers   []string `json:"dnsServers"`
}

// blocklistCopy is one disk-backed normalized source currently safe to install.
//
// File remains open and unlinked for stable streaming into later daemon folders;
// metadata records its bounded size, ranges, and last successful download.
//
// Since: 2.0.0
type blocklistCopy struct {
	File      *os.File
	Ranges    int
	Size      int64
	UpdatedAt time.Time
}

// blocklistMerger owns scheduling, protected downloads, and every daemon copy.
//
// Its reconcile mutex keeps scheduled decisions ordered, while the ownership
// mutex protects cache swaps and synchronization without covering downloads.
//
// Since: 2.0.0
type blocklistMerger struct {
	runner                    *runner
	logger                    *slog.Logger
	clock                     func() time.Time
	bindAddressForSlot        func(int) (string, error)
	dialContext               func(*net.Dialer, context.Context, string, string) (net.Conn, error)
	dnsPort                   string
	rootCAs                   *x509.CertPool
	connectTimeout            time.Duration
	sourceTimeout             time.Duration
	maximumDownloadBytes      int64
	maximumUnpackedBytes      int64
	maximumNormalizedBytes    int64
	maximumRanges             int
	maximumTotalBytes         int64
	maximumTotalRanges        int
	maximumZipEntries         int
	maximumZipDirectoryBytes  int64
	synchronizationRetryDelay time.Duration

	reconcileMutex     sync.Mutex
	mutex              sync.Mutex
	loadedStatus       bool
	status             blocklist.Status
	publishedStatus    blocklist.Status
	hasPublishedStatus bool
	lastConfiguration  blocklist.Configuration
	hasConfiguration   bool
	waitingForVPN      bool
	reloadPending      bool
	copies             map[string]*blocklistCopy
	copiesLoaded       bool
}

// newBlocklistMerger constructs the runner's application-owned blocklist service.
//
// Network and certificate seams default to production behavior but remain directly
// injectable by TLS tests without environment variables.
//
// Since: 2.0.0
func newBlocklistMerger(owner *runner, logger *slog.Logger) *blocklistMerger {
	return &blocklistMerger{
		runner:             owner,
		logger:             logger,
		clock:              time.Now,
		bindAddressForSlot: transmissionconfig.SlotBindAddressIPv4,
		dialContext: func(dialer *net.Dialer, ctx context.Context, network string, address string) (net.Conn, error) {
			return dialer.DialContext(ctx, network, address)
		},
		dnsPort:                   "53",
		connectTimeout:            blocklistConnectTimeout,
		sourceTimeout:             blocklistSourceTimeout,
		maximumDownloadBytes:      blocklistMaximumDownloadBytes,
		maximumUnpackedBytes:      blocklistMaximumUnpackedBytes,
		maximumNormalizedBytes:    blocklistMaximumNormalizedBytes,
		maximumRanges:             blocklistMaximumRanges,
		maximumTotalBytes:         blocklistMaximumTotalBytes,
		maximumTotalRanges:        blocklistMaximumTotalRanges,
		maximumZipEntries:         blocklistMaximumZipEntries,
		maximumZipDirectoryBytes:  blocklistMaximumZipDirectoryBytes,
		synchronizationRetryDelay: blocklistSynchronizationRetryDelay,
		copies:                    map[string]*blocklistCopy{},
		status: blocklist.Status{
			State:   "idle",
			Sources: []blocklist.SourceStatus{},
		},
	}
}

// run polls desired state alongside the runner's existing daemon reconciliation loop.
//
// Individual read or update failures are logged and retried; they never terminate
// healthy Transmission supervisors or weaken their existing bind addresses.
//
// Since: 2.0.0
func (merger *blocklistMerger) run(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	lastError := ""
	for {
		err := merger.reconcile(ctx)
		if err != nil {
			if err.Error() != lastError {
				merger.logger.Error("Blocklist merger reconciliation failed", "error", err)
				lastError = err.Error()
			}
		} else {
			lastError = ""
		}

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

// reconcile evaluates configuration changes and serialized scheduling decisions.
//
// A due update proves the default VPN is protected, then releases the ownership
// lock for downloads while keeping disabled and empty-source work local.
//
// Since: 2.0.0
func (merger *blocklistMerger) reconcile(ctx context.Context) error {
	merger.reconcileMutex.Lock()
	defer merger.reconcileMutex.Unlock()

	merger.mutex.Lock()
	mutexLocked := true
	defer func() {
		if mutexLocked {
			merger.mutex.Unlock()
		}
	}()

	configuration, err := blocklist.ReadConfiguration(merger.configurationPath())
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}
	merger.loadStatus()
	entries, err := readDaemonEntries(merger.daemonConfigurationPath())
	if err != nil {
		return err
	}
	merger.ensureCopiesLoaded(ctx, entries, configuration.Sources)

	firstConfiguration := !merger.hasConfiguration
	changed := configuration.Enabled != merger.lastConfiguration.Enabled ||
		!slices.Equal(configuration.Sources, merger.lastConfiguration.Sources)
	requested := !sameOptionalTime(
		configuration.UpdateRequestedAt,
		merger.lastConfiguration.UpdateRequestedAt,
	)
	if firstConfiguration {
		statusSources := make([]string, 0, len(merger.status.Sources))
		for _, sourceStatus := range merger.status.Sources {
			statusSources = append(statusSources, sourceStatus.URL)
		}
		changed = !slices.Equal(configuration.Sources, statusSources) ||
			!configuration.Enabled && merger.status.State != "disabled" ||
			configuration.Enabled && merger.status.State == "disabled"
		requested = configuration.UpdateRequestedAt != nil &&
			(merger.status.LastAttemptAt == nil ||
				configuration.UpdateRequestedAt.After(*merger.status.LastAttemptAt))
	}
	merger.lastConfiguration = configuration
	merger.hasConfiguration = true

	if !configuration.Enabled {
		merger.reloadPending = false
		if changed || firstConfiguration {
			if err := merger.runner.requestDaemonReloads(ctx, entries, false); err != nil {
				merger.status.Error = displaySafeBlocklistError(err)
				_ = merger.writeStatus()

				return err
			}
		}
		merger.waitingForVPN = false
		merger.status.State = "disabled"
		merger.status.Error = ""
		merger.status.Sources = merger.statusesForSources(configuration.Sources)
		merger.status.TotalRanges = 0
		merger.status.NextUpdateAt = nil

		return merger.writeStatus()
	}
	if len(configuration.Sources) == 0 {
		merger.reloadPending = false
		copies := map[string]*blocklistCopy{}
		if changed || firstConfiguration {
			if err := merger.synchronizeDaemons(entries, configuration.Sources, copies); err != nil {
				merger.status.Error = displaySafeBlocklistError(err)
				_ = merger.writeStatus()

				return err
			}
			merger.replaceCopies(copies)
			if err := merger.runner.requestDaemonReloads(ctx, entries, false); err != nil {
				merger.status.Error = displaySafeBlocklistError(err)
				_ = merger.writeStatus()

				return err
			}
		}
		merger.waitingForVPN = false
		merger.status.State = "no-sources"
		merger.status.Error = ""
		merger.status.TotalRanges = 0
		merger.status.Sources = []blocklist.SourceStatus{}
		merger.status.NextUpdateAt = nil

		return merger.writeStatus()
	}

	now := merger.clock().UTC()
	due := changed || requested
	if !due && merger.status.NextUpdateAt != nil {
		due = !now.Before(*merger.status.NextUpdateAt)
	} else if !due {
		lastScheduledAt := merger.status.LastAttemptAt
		if firstConfiguration && merger.status.LastSuccessAt != nil {
			lastScheduledAt = merger.status.LastSuccessAt
		}
		if lastScheduledAt == nil {
			due = true
		} else {
			dueAt := lastScheduledAt.Add(
				time.Duration(configuration.UpdateIntervalHours) * time.Hour,
			)
			due = !now.Before(dueAt)
		}
	}
	if merger.waitingForVPN {
		due = true
	}
	if !due {
		if firstConfiguration {
			copies := merger.copiesForSources(configuration.Sources)
			if err := merger.synchronizeDaemons(entries, configuration.Sources, copies); err != nil {
				return err
			}
			if err := merger.runner.requestDaemonReloads(ctx, entries, true); err != nil {
				return err
			}
		}
		merger.status.State = "idle"
		merger.status.Sources = merger.statusesForSources(configuration.Sources)
		merger.status.TotalRanges = totalBlocklistRanges(configuration.Sources, merger.copies)
		if merger.status.Error == "" {
			merger.setNextUpdate(configuration)
		}

		return merger.writeStatus()
	}
	if merger.reloadPending && !changed && !requested {
		readyProcesses := merger.runner.scheduleDaemonReloads(entries, true)
		merger.mutex.Unlock()
		mutexLocked = false

		return merger.retryDaemonReload(ctx, configuration, readyProcesses, now)
	}

	if _, err := merger.protectedDefaultRoute(entries); err != nil {
		if !errors.Is(err, errBlocklistWaitingForVPN) {
			return err
		}
		copies := merger.copiesForSources(configuration.Sources)
		if changed || firstConfiguration {
			if err := merger.synchronizeDaemons(
				entries,
				configuration.Sources,
				copies,
			); err != nil {
				return err
			}
			if err := merger.runner.requestDaemonReloads(ctx, entries, true); err != nil {
				return err
			}
		}
		merger.waitingForVPN = true
		merger.status.State = "waiting-for-vpn"
		merger.status.Error = ""
		if requested {
			merger.status.UpdateRequestedAt = configuration.UpdateRequestedAt
		}
		merger.status.Sources = statusesFromCopies(configuration.Sources, copies)
		merger.status.TotalRanges = totalBlocklistRanges(configuration.Sources, copies)
		merger.status.NextUpdateAt = nil

		return merger.writeStatus()
	}

	merger.waitingForVPN = false
	merger.reloadPending = false
	merger.status.State = "updating"
	merger.status.Error = ""
	merger.status.UpdateRequestedAt = configuration.UpdateRequestedAt
	merger.status.Sources = merger.statusesForSources(configuration.Sources)
	if err := merger.writeStatus(); err != nil {
		return err
	}
	previousCopies := merger.copiesForSources(configuration.Sources)
	merger.mutex.Unlock()
	mutexLocked = false

	return merger.update(ctx, configuration, entries, previousCopies, now)
}

// update downloads every source, preserving a usable copy for individual failures.
//
// Network and normalization work run without the ownership mutex; completed
// files are swapped under it before ready children rebuild their indexes.
//
// Since: 2.0.0
func (merger *blocklistMerger) update(
	ctx context.Context,
	configuration blocklist.Configuration,
	entries []daemonEntry,
	previousCopies map[string]*blocklistCopy,
	now time.Time,
) error {
	copies := make(map[string]*blocklistCopy, len(configuration.Sources))
	statuses := make([]blocklist.SourceStatus, 0, len(configuration.Sources))
	stagedCopies := make(map[string]*blocklistCopy, len(configuration.Sources))
	totalBytes := int64(0)
	totalRanges := 0
	remainingPreviousBytes := int64(0)
	remainingPreviousRanges := 0
	countedPrevious := make(map[string]struct{}, len(previousCopies))
	for _, sourceURL := range configuration.Sources {
		if _, counted := countedPrevious[sourceURL]; counted {
			continue
		}
		countedPrevious[sourceURL] = struct{}{}
		if previousCopy, found := previousCopies[sourceURL]; found {
			remainingPreviousBytes += previousCopy.Size
			remainingPreviousRanges += previousCopy.Ranges
		}
	}
	finishWaitingForVPN := func() error {
		closeBlocklistCopies(stagedCopies, previousCopies)
		merger.mutex.Lock()
		defer merger.mutex.Unlock()

		merger.waitingForVPN = true
		availableCopies := merger.copiesForSources(configuration.Sources)

		return merger.finishInterruptedUpdate(configuration, availableCopies)
	}
	processedSources := make(map[string]struct{}, len(configuration.Sources))
	processedStatuses := make(map[string]blocklist.SourceStatus, len(configuration.Sources))
	allSucceeded := true
	for _, sourceURL := range configuration.Sources {
		if _, duplicate := processedSources[sourceURL]; duplicate {
			statuses = append(statuses, processedStatuses[sourceURL])

			continue
		}
		processedSources[sourceURL] = struct{}{}
		previousCopy, hadPreviousCopy := previousCopies[sourceURL]
		if hadPreviousCopy {
			remainingPreviousBytes -= previousCopy.Size
			remainingPreviousRanges -= previousCopy.Ranges
		}
		route, routeError := merger.protectedDefaultRoute(entries)
		if routeError != nil {
			if errors.Is(routeError, errBlocklistWaitingForVPN) {
				return finishWaitingForVPN()
			}
			closeBlocklistCopies(stagedCopies, previousCopies)

			return routeError
		}

		copy, downloadError := merger.downloadAndNormalize(ctx, sourceURL, route, now)
		if downloadError == nil &&
			(totalBytes+copy.Size+remainingPreviousBytes > merger.maximumTotalBytes ||
				totalRanges+copy.Ranges+remainingPreviousRanges > merger.maximumTotalRanges) {
			_ = copy.File.Close()
			copy = nil
			downloadError = errBlocklistTooLarge
		}
		if downloadError == nil {
			copies[sourceURL] = copy
			stagedCopies[sourceURL] = copy
			totalBytes += copy.Size
			totalRanges += copy.Ranges
			updatedAt := now
			sourceStatus := blocklist.SourceStatus{
				URL: sourceURL, State: "ok", Ranges: copy.Ranges, UpdatedAt: &updatedAt,
			}
			processedStatuses[sourceURL] = sourceStatus
			statuses = append(statuses, sourceStatus)

			continue
		}
		if _, routeError := merger.protectedDefaultRoute(entries); errors.Is(
			routeError,
			errBlocklistWaitingForVPN,
		) {
			return finishWaitingForVPN()
		}

		allSucceeded = false
		sourceStatus := blocklist.SourceStatus{
			URL: sourceURL, State: "error", Error: displaySafeBlocklistError(downloadError),
		}
		if hadPreviousCopy &&
			totalBytes+previousCopy.Size+remainingPreviousBytes <= merger.maximumTotalBytes &&
			totalRanges+previousCopy.Ranges+remainingPreviousRanges <= merger.maximumTotalRanges {
			copies[sourceURL] = previousCopy
			totalBytes += previousCopy.Size
			totalRanges += previousCopy.Ranges
			copyFrom := previousCopy.UpdatedAt
			sourceStatus.Ranges = previousCopy.Ranges
			sourceStatus.UpdatedAt = &copyFrom
			sourceStatus.CopyFrom = &copyFrom
		}
		processedStatuses[sourceURL] = sourceStatus
		statuses = append(statuses, sourceStatus)
	}
	if _, routeError := merger.protectedDefaultRoute(entries); routeError != nil {
		if errors.Is(routeError, errBlocklistWaitingForVPN) {
			return finishWaitingForVPN()
		}
		closeBlocklistCopies(stagedCopies, previousCopies)

		return routeError
	}

	merger.mutex.Lock()
	availableCopies := merger.copiesForSources(configuration.Sources)
	for _, sourceURL := range configuration.Sources {
		if _, selected := copies[sourceURL]; selected {
			continue
		}
		if _, knownBeforeDownload := previousCopies[sourceURL]; knownBeforeDownload {
			continue
		}
		availableCopy, available := availableCopies[sourceURL]
		if !available {
			continue
		}
		sourceStatus, processed := processedStatuses[sourceURL]
		if !processed || sourceStatus.State != "error" ||
			totalBytes+availableCopy.Size > merger.maximumTotalBytes ||
			totalRanges+availableCopy.Ranges > merger.maximumTotalRanges {
			continue
		}
		copies[sourceURL] = availableCopy
		totalBytes += availableCopy.Size
		totalRanges += availableCopy.Ranges
		copyFrom := availableCopy.UpdatedAt
		sourceStatus.Ranges = availableCopy.Ranges
		sourceStatus.UpdatedAt = &copyFrom
		sourceStatus.CopyFrom = &copyFrom
		processedStatuses[sourceURL] = sourceStatus
		for index := range statuses {
			if statuses[index].URL == sourceURL {
				statuses[index] = sourceStatus
			}
		}
	}
	if err := merger.synchronizeDaemons(entries, configuration.Sources, copies); err != nil {
		closeBlocklistCopies(stagedCopies, previousCopies)
		finishError := merger.finishSynchronizationFailure(
			configuration,
			previousCopies,
			statusesFromCopies(configuration.Sources, previousCopies),
			now,
			err,
		)
		merger.mutex.Unlock()

		return finishError
	}
	merger.replaceCopies(copies)
	readyProcesses := merger.runner.scheduleDaemonReloads(entries, true)
	merger.mutex.Unlock()

	reloadError := merger.runner.reloadDaemons(ctx, readyProcesses)
	merger.mutex.Lock()
	defer merger.mutex.Unlock()

	merger.status.State = "idle"
	merger.status.LastAttemptAt = timePointer(now)
	merger.status.Sources = statuses
	merger.status.TotalRanges = totalBlocklistRanges(configuration.Sources, copies)
	if reloadError != nil {
		return merger.finishReloadFailure(configuration, now, reloadError)
	}

	merger.reloadPending = false
	merger.status.Error = ""
	if allSucceeded {
		merger.status.LastSuccessAt = timePointer(now)
	}
	merger.setNextUpdate(configuration)

	return merger.writeStatus()
}

// retryDaemonReload retries only a previously synchronized generation.
//
// Downloaded copies remain installed during backoff, so a transient session-get
// failure never causes every protected source to be fetched again.
//
// Since: 2.0.0
func (merger *blocklistMerger) retryDaemonReload(
	ctx context.Context,
	configuration blocklist.Configuration,
	readyProcesses []daemonProcess,
	now time.Time,
) error {
	reloadError := merger.runner.reloadDaemons(ctx, readyProcesses)

	merger.mutex.Lock()
	defer merger.mutex.Unlock()

	copies := merger.copiesForSources(configuration.Sources)
	merger.status.State = "idle"
	merger.status.Sources = merger.statusesForSources(configuration.Sources)
	merger.status.TotalRanges = totalBlocklistRanges(configuration.Sources, copies)
	if reloadError != nil {
		return merger.finishReloadFailure(configuration, now, reloadError)
	}

	merger.reloadPending = false
	merger.status.Error = ""
	allSucceeded := true
	for _, sourceStatus := range merger.status.Sources {
		if sourceStatus.State != "ok" {
			allSucceeded = false

			break
		}
	}
	if allSucceeded && merger.status.LastAttemptAt != nil {
		merger.status.LastSuccessAt = timePointer(*merger.status.LastAttemptAt)
	}
	merger.setNextUpdate(configuration)

	return merger.writeStatus()
}

// finishInterruptedUpdate records VPN loss without replacing any last-good file.
//
// The due attempt remains waiting and retries on protection recovery, while source
// statuses continue to describe copies that are actually present on disk.
//
// Since: 2.0.0
func (merger *blocklistMerger) finishInterruptedUpdate(
	configuration blocklist.Configuration,
	copies map[string]*blocklistCopy,
) error {
	merger.status.State = "waiting-for-vpn"
	merger.status.Error = ""
	merger.status.UpdateRequestedAt = configuration.UpdateRequestedAt
	merger.status.NextUpdateAt = nil
	merger.status.TotalRanges = totalBlocklistRanges(configuration.Sources, copies)
	merger.status.Sources = statusesFromCopies(configuration.Sources, copies)

	return merger.writeStatus()
}

// finishSynchronizationFailure publishes one completed but uninstalled attempt.
//
// The attempt timestamp prevents tight retries, while the earlier of fifteen minutes
// and the configured interval becomes the durable retry schedule.
//
// Since: 2.0.0
func (merger *blocklistMerger) finishSynchronizationFailure(
	configuration blocklist.Configuration,
	copies map[string]*blocklistCopy,
	statuses []blocklist.SourceStatus,
	now time.Time,
	synchronizationError error,
) error {
	merger.reloadPending = false
	merger.status.State = "idle"
	merger.status.LastAttemptAt = timePointer(now)
	merger.status.Error = displaySafeBlocklistError(synchronizationError)
	merger.status.Sources = statuses
	merger.status.TotalRanges = totalBlocklistRanges(configuration.Sources, copies)
	retryDelay := merger.synchronizationRetryDelay
	interval := time.Duration(configuration.UpdateIntervalHours) * time.Hour
	if interval < retryDelay {
		retryDelay = interval
	}
	retryAt := now.Add(retryDelay)
	merger.status.NextUpdateAt = &retryAt
	if err := merger.writeStatus(); err != nil {
		return errors.Join(synchronizationError, err)
	}

	return synchronizationError
}

// finishReloadFailure schedules another signal attempt without replacing copies.
//
// LastAttemptAt continues to describe the completed source pass, while
// NextUpdateAt records a retry for only the remaining live reload work.
//
// Since: 2.0.0
func (merger *blocklistMerger) finishReloadFailure(
	configuration blocklist.Configuration,
	now time.Time,
	reloadError error,
) error {
	merger.reloadPending = true
	merger.status.State = "idle"
	merger.status.Error = displaySafeBlocklistError(reloadError)
	retryDelay := merger.synchronizationRetryDelay
	interval := time.Duration(configuration.UpdateIntervalHours) * time.Hour
	if interval < retryDelay {
		retryDelay = interval
	}
	retryAt := now.Add(retryDelay)
	merger.status.NextUpdateAt = &retryAt
	if err := merger.writeStatus(); err != nil {
		return errors.Join(reloadError, err)
	}

	return reloadError
}

// prepareDaemon installs current runner-owned files before a newly added child starts.
//
// Existing cached copies are installed without network access or sibling signaling.
// The scheduled merger remains the only owner of source downloads and update timing.
//
// Since: 2.0.0
func (merger *blocklistMerger) prepareDaemon(
	ctx context.Context,
	entry daemonEntry,
	peerPort int,
) (uint64, error) {
	for !merger.mutex.TryLock() {
		select {
		case <-ctx.Done():
			return 0, ctx.Err()
		case <-time.After(10 * time.Millisecond):
		}
	}
	defer merger.mutex.Unlock()

	configuration, err := blocklist.ReadConfiguration(merger.configurationPath())
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return merger.runner.currentReloadRevision(), nil
		}
		return 0, err
	}
	entries, err := readDaemonEntries(merger.daemonConfigurationPath())
	if err != nil {
		return 0, err
	}
	merger.loadStatus()
	merger.ensureCopiesLoaded(ctx, entries, configuration.Sources)
	copies := merger.copiesForSources(configuration.Sources)
	effectiveEnabled := configuration.Enabled && len(configuration.Sources) > 0
	if configuration.Enabled {
		if err := merger.synchronizeDaemon(entry, configuration.Sources, copies); err != nil {
			return 0, err
		}
	}
	if err := merger.runner.writePreparedDaemonSettings(entry, peerPort, effectiveEnabled); err != nil {
		return 0, err
	}

	return merger.runner.currentReloadRevision(), nil
}

// protectedDefaultRoute returns only a currently protected default connection route.
//
// It derives the local address from the fixed daemon slot instead of the provider
// address and accepts DNS servers only from the matching controller status file.
//
// Since: 2.0.0
func (merger *blocklistMerger) protectedDefaultRoute(
	entries []daemonEntry,
) (blocklistRoute, error) {
	var defaultEntry *daemonEntry
	for index := range entries {
		if entries[index].Default {
			defaultEntry = &entries[index]

			break
		}
	}
	if defaultEntry == nil {
		return blocklistRoute{}, errBlocklistWaitingForVPN
	}

	route, err := vpnhttp.ProtectedRoute(
		merger.runner.options.RuntimeDirectory,
		defaultEntry.ConnectionID,
		defaultEntry.Slot,
		merger.bindAddressForSlot,
	)
	if errors.Is(err, vpnhttp.ErrNotProtected) {
		return blocklistRoute{}, errBlocklistWaitingForVPN
	}

	return route, err
}

// downloadAndNormalize fetches and streams one source into a normalized temp file.
//
// Download, unpacked, normalized-byte, and range caps are enforced independently;
// only the small HTTP body buffer and one bounded source line reside in memory.
//
// Since: 2.0.0
func (merger *blocklistMerger) downloadAndNormalize(
	ctx context.Context,
	sourceURL string,
	route blocklistRoute,
	updatedAt time.Time,
) (*blocklistCopy, error) {
	parsedURL, err := validateBlocklistURL(sourceURL)
	if err != nil {
		return nil, err
	}
	sourceContext, cancel := context.WithTimeout(ctx, merger.sourceTimeout)
	defer cancel()
	request, err := http.NewRequestWithContext(sourceContext, http.MethodGet, parsedURL.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("prepare request: %w", err)
	}
	request.Header.Set("Accept-Encoding", "identity")

	client := merger.httpClient(route)
	defer client.CloseIdleConnections()
	response, err := client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("download failed: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode > 299 {
		return nil, fmt.Errorf("The server answered %d.", response.StatusCode)
	}

	directory := filepath.Join(merger.runner.options.RuntimeDirectory, "transmission-state")
	downloadedFile, err := createUnlinkedBlocklistFile(directory, ".blocklist-download-*")
	if err != nil {
		return nil, fmt.Errorf("create blocklist download file: %w", err)
	}
	defer downloadedFile.Close()
	downloadedBytes, err := copyBlocklistDownload(
		sourceContext,
		downloadedFile,
		response.Body,
		merger.maximumDownloadBytes,
	)
	if err != nil {
		return nil, err
	}
	reader, err := merger.openDownloadedBlocklist(downloadedFile, downloadedBytes)
	if err != nil {
		return nil, err
	}
	copy, normalizeError := merger.normalizeToTemporary(sourceContext, reader, updatedAt)
	closeError := reader.Close()
	if normalizeError != nil {
		return nil, normalizeError
	}
	if closeError != nil {
		_ = copy.File.Close()

		return nil, fmt.Errorf("close unpacked blocklist: %w", closeError)
	}

	return copy, nil
}

// copyBlocklistDownload streams one response through the compressed byte limit.
//
// Context checks complement the request cancellation and prevent a custom or stalled
// reader in tests from bypassing the source deadline between fixed-size writes.
//
// Since: 2.0.0
func copyBlocklistDownload(
	ctx context.Context,
	destination io.Writer,
	source io.Reader,
	maximumBytes int64,
) (int64, error) {
	limitedReader := &io.LimitedReader{R: source, N: maximumBytes + 1}
	buffer := make([]byte, 64*1024)
	writtenBytes := int64(0)
	for {
		if err := ctx.Err(); err != nil {
			return 0, err
		}
		readBytes, readError := limitedReader.Read(buffer)
		if readBytes > 0 {
			writtenBytes += int64(readBytes)
			if writtenBytes > maximumBytes {
				return 0, errBlocklistDownloadTooLarge
			}
			if _, err := destination.Write(buffer[:readBytes]); err != nil {
				return 0, err
			}
		}
		if errors.Is(readError, io.EOF) {
			return writtenBytes, nil
		}
		if readError != nil {
			return 0, readError
		}
	}
}

// httpClient builds one source-address- and resolver-pinned HTTPS client.
//
// The transport never invokes the host resolver: hostnames are resolved by a Go
// resolver whose UDP and TCP sockets use the same protected slot address.
//
// Since: 2.0.0
func (merger *blocklistMerger) httpClient(route blocklistRoute) *http.Client {
	return vpnhttp.NewClient(vpnhttp.ClientOptions{
		Route:                 route,
		ConnectTimeout:        merger.connectTimeout,
		ResponseHeaderTimeout: merger.sourceTimeout,
		MaximumRedirects:      5,
		RootCAs:               merger.rootCAs,
		DNSPort:               merger.dnsPort,
		DialContext:           merger.dialContext,
		ValidateURL: func(requestURL *url.URL) error {
			_, err := validateBlocklistURL(requestURL.String())

			return err
		},
	})
}

// connectionResolver sends DNS through the protected connection's own resolver list.
//
// Both UDP fallback and TCP retries bind the slot source address, matching the web
// proxy route selection and preventing resolver traffic from using container eth0.
//
// Since: 2.0.0
func (merger *blocklistMerger) connectionResolver(route blocklistRoute) *net.Resolver {
	return vpnhttp.NewResolver(
		route,
		merger.connectTimeout,
		merger.dnsPort,
		merger.dialContext,
	)
}

// openDownloadedBlocklist opens plain, gzip, or the first regular zip member.
//
// Zip end records are bounded and validated before archive/zip reads the central
// directory, while actual expansion stays streaming for the normalizer.
//
// Since: 2.0.0
func (merger *blocklistMerger) openDownloadedBlocklist(
	downloaded *os.File,
	downloadedBytes int64,
) (io.ReadCloser, error) {
	magic := make([]byte, 4)
	readMagic, err := downloaded.ReadAt(magic, 0)
	if err != nil && !errors.Is(err, io.EOF) {
		return nil, fmt.Errorf("read blocklist signature: %w", err)
	}
	section := io.NewSectionReader(downloaded, 0, downloadedBytes)
	switch {
	case readMagic >= 2 && magic[0] == 0x1f && magic[1] == 0x8b:
		reader, err := gzip.NewReader(section)
		if err != nil {
			return nil, fmt.Errorf("open gzip list: %w", err)
		}

		return reader, nil
	case readMagic == 4 && magic[0] == 'P' && magic[1] == 'K' &&
		magic[2] == 0x03 && magic[3] == 0x04:
		directory, err := inspectBlocklistZipDirectory(
			downloaded,
			downloadedBytes,
			merger.maximumZipEntries,
			merger.maximumZipDirectoryBytes,
		)
		if err != nil {
			return nil, err
		}
		if err := validateBlocklistZipEntries(
			downloaded,
			directory,
			merger.maximumZipEntries,
		); err != nil {
			return nil, err
		}
		archive, err := zip.NewReader(downloaded, downloadedBytes)
		if err != nil {
			return nil, fmt.Errorf("open zip list: %w", err)
		}
		if len(archive.File) != directory.Entries || len(archive.File) > merger.maximumZipEntries {
			return nil, errBlocklistTooLarge
		}
		for _, file := range archive.File {
			if file.FileInfo().IsDir() || !file.Mode().IsRegular() {
				continue
			}
			if file.UncompressedSize64 > uint64(merger.maximumUnpackedBytes) {
				return nil, errBlocklistUnpackedTooLarge
			}
			reader, err := file.Open()
			if err != nil {
				return nil, fmt.Errorf("open zip member: %w", err)
			}

			return reader, nil
		}

		return nil, errors.New("The zip list has no regular file.")
	default:
		return io.NopCloser(section), nil
	}
}

// normalizeToTemporary streams one unpacked source into an unlinked normalized file.
//
// The returned descriptor is rewound and retained by the merger cache, allowing every
// daemon copy to use io.Copy without materializing any normalized source in memory.
//
// Since: 2.0.0
func (merger *blocklistMerger) normalizeToTemporary(
	ctx context.Context,
	reader io.Reader,
	updatedAt time.Time,
) (*blocklistCopy, error) {
	directory := filepath.Join(merger.runner.options.RuntimeDirectory, "transmission-state")
	normalizedFile, err := createUnlinkedBlocklistFile(directory, ".blocklist-normalized-*")
	if err != nil {
		return nil, fmt.Errorf("create normalized blocklist file: %w", err)
	}
	committed := false
	defer func() {
		if !committed {
			_ = normalizedFile.Close()
		}
	}()

	ranges, size, err := normalizeBlocklistReader(
		ctx,
		reader,
		normalizedFile,
		merger.maximumUnpackedBytes,
		merger.maximumNormalizedBytes,
		merger.maximumRanges,
	)
	if err != nil {
		return nil, err
	}
	if err := normalizedFile.Sync(); err != nil {
		return nil, fmt.Errorf("sync normalized blocklist file: %w", err)
	}
	if _, err := normalizedFile.Seek(0, io.SeekStart); err != nil {
		return nil, fmt.Errorf("rewind normalized blocklist file: %w", err)
	}
	committed = true

	return &blocklistCopy{
		File: normalizedFile, Ranges: ranges, Size: size, UpdatedAt: updatedAt.UTC(),
	}, nil
}

// synchronizeDaemons replaces runner-owned files for every configured daemon.
//
// Each folder is independently atomic at the file level; stale native indexes and
// former source files are removed only inside the runner-owned blocklists directory.
//
// Since: 2.0.0
func (merger *blocklistMerger) synchronizeDaemons(
	entries []daemonEntry,
	sources []string,
	copies map[string]*blocklistCopy,
) error {
	for _, entry := range entries {
		if err := merger.synchronizeDaemon(entry, sources, copies); err != nil {
			if errors.Is(err, errBlocklistDaemonNotPrepared) {
				continue
			}

			return err
		}
	}

	return nil
}

// synchronizeDaemon installs expected copies and removes every other folder entry.
//
// Temporary files are renamed only after syncing, and cleanup includes stale .bin
// indexes plus the legacy primary blocklist.bin file.
//
// Since: 2.0.0
func (merger *blocklistMerger) synchronizeDaemon(
	entry daemonEntry,
	sources []string,
	copies map[string]*blocklistCopy,
) error {
	directory, err := openDaemonBlocklistDirectory(
		merger.runner.options.ConfigDirectory,
		entry,
		true,
	)
	if err != nil {
		return err
	}
	defer directory.Close()

	expected := make(map[string]struct{}, len(copies))
	for _, sourceURL := range sources {
		copy, found := copies[sourceURL]
		if !found {
			continue
		}
		name := blocklist.SourceFileName(sourceURL)
		if err := writeBlocklistCopyAt(directory, name, copy); err != nil {
			return fmt.Errorf("write blocklist for daemon %s: %w", entry.ConnectionID, err)
		}
		expected[name] = struct{}{}
	}
	if err := removeStaleBlocklistFiles(directory, expected); err != nil {
		return fmt.Errorf("clean blocklists for daemon %s: %w", entry.ConnectionID, err)
	}
	if err := directory.Sync(); err != nil {
		return fmt.Errorf("sync blocklists for daemon %s: %w", entry.ConnectionID, err)
	}

	return nil
}

// ensureCopiesLoaded streams the first usable daemon copy into the runner cache once.
//
// The cache is deferred until a prepared config directory exists, preventing the
// blocklist loop from creating paths before slot-zero legacy migration completes.
//
// Since: 2.0.0
func (merger *blocklistMerger) ensureCopiesLoaded(
	ctx context.Context,
	entries []daemonEntry,
	sources []string,
) {
	if merger.copiesLoaded {
		return
	}
	statusByURL := make(map[string]blocklist.SourceStatus, len(merger.status.Sources))
	for _, sourceStatus := range merger.status.Sources {
		statusByURL[sourceStatus.URL] = sourceStatus
	}
	copies := make(map[string]*blocklistCopy, len(sources))
	preparedDirectoryFound := false
	totalBytes := int64(0)
	totalRanges := 0
	for _, sourceURL := range sources {
		name := blocklist.SourceFileName(sourceURL)
		for _, entry := range entries {
			directory, err := openDaemonBlocklistDirectory(
				merger.runner.options.ConfigDirectory,
				entry,
				false,
			)
			if err != nil {
				if !errors.Is(err, errBlocklistDaemonNotPrepared) {
					preparedDirectoryFound = true
				}

				continue
			}
			preparedDirectoryFound = true
			file, err := openRegularBlocklistFile(directory, name)
			_ = directory.Close()
			if err != nil {
				continue
			}
			updatedAt := time.Time{}
			if sourceStatus := statusByURL[sourceURL]; sourceStatus.UpdatedAt != nil {
				updatedAt = sourceStatus.UpdatedAt.UTC()
			} else if fileInfo, statError := file.Stat(); statError == nil {
				updatedAt = fileInfo.ModTime().UTC()
			}
			copy, normalizeError := merger.normalizeToTemporary(ctx, file, updatedAt)
			_ = file.Close()
			if normalizeError != nil {
				continue
			}
			if totalBytes+copy.Size > merger.maximumTotalBytes ||
				totalRanges+copy.Ranges > merger.maximumTotalRanges {
				_ = copy.File.Close()

				break
			}
			copies[sourceURL] = copy
			totalBytes += copy.Size
			totalRanges += copy.Ranges

			break
		}
	}
	if ctx.Err() != nil || !preparedDirectoryFound {
		closeBlocklistCopies(copies, nil)

		return
	}
	merger.replaceCopies(copies)
}

// copiesForSources returns cached copies limited to the current saved source set.
//
// The returned map shares immutable copy descriptors; replacement closes only entries
// that are no longer referenced by the merger's next complete set.
//
// Since: 2.0.0
func (merger *blocklistMerger) copiesForSources(
	sources []string,
) map[string]*blocklistCopy {
	copies := make(map[string]*blocklistCopy, len(sources))
	for _, sourceURL := range sources {
		if copy, found := merger.copies[sourceURL]; found {
			copies[sourceURL] = copy
		}
	}

	return copies
}

// replaceCopies installs one complete cache and closes every unreferenced descriptor.
//
// Retained last-good pointers survive individual source failures, while removed or
// superseded temp files release their disk space immediately.
//
// Since: 2.0.0
func (merger *blocklistMerger) replaceCopies(copies map[string]*blocklistCopy) {
	closeBlocklistCopies(merger.copies, copies)
	merger.copies = copies
	merger.copiesLoaded = true
}

// closeBlocklistCopies closes descriptors absent from a retained copy map.
//
// Pointer de-duplication handles repeated source values without closing a shared file
// twice, and a nil retained map closes the complete supplied set.
//
// Since: 2.0.0
func closeBlocklistCopies(
	copies map[string]*blocklistCopy,
	retained map[string]*blocklistCopy,
) {
	retainedCopies := make(map[*blocklistCopy]struct{}, len(retained))
	for _, copy := range retained {
		retainedCopies[copy] = struct{}{}
	}
	closed := map[*blocklistCopy]struct{}{}
	for _, copy := range copies {
		if copy == nil {
			continue
		}
		if _, keep := retainedCopies[copy]; keep {
			continue
		}
		if _, alreadyClosed := closed[copy]; alreadyClosed {
			continue
		}
		closed[copy] = struct{}{}
		_ = copy.File.Close()
	}
}

// statusesForSources keeps observations for saved URLs and marks unseen ones pending.
//
// This runner-side ordering mirrors the API translation and keeps the persisted status
// useful for compatible RPC callers that do not pass through the versioned endpoint.
//
// Since: 2.0.0
func (merger *blocklistMerger) statusesForSources(sources []string) []blocklist.SourceStatus {
	byURL := make(map[string]blocklist.SourceStatus, len(merger.status.Sources))
	for _, sourceStatus := range merger.status.Sources {
		byURL[sourceStatus.URL] = sourceStatus
	}
	statuses := make([]blocklist.SourceStatus, 0, len(sources))
	for _, sourceURL := range sources {
		status, found := byURL[sourceURL]
		if !found {
			status = blocklist.SourceStatus{URL: sourceURL, State: "pending"}
		}
		statuses = append(statuses, status)
	}

	return statuses
}

// setNextUpdate derives the next interval from the latest attempt or success.
//
// A restored pre-merger status may have only a success timestamp; later failed source
// attempts still schedule normally without a tight polling loop.
//
// Since: 2.0.0
func (merger *blocklistMerger) setNextUpdate(configuration blocklist.Configuration) {
	lastScheduledAt := merger.status.LastAttemptAt
	if lastScheduledAt == nil {
		lastScheduledAt = merger.status.LastSuccessAt
	}
	if lastScheduledAt == nil {
		merger.status.NextUpdateAt = nil

		return
	}
	next := lastScheduledAt.Add(
		time.Duration(configuration.UpdateIntervalHours) * time.Hour,
	)
	merger.status.NextUpdateAt = &next
}

// loadStatus restores scheduling and retained-copy metadata once after runner startup.
//
// Missing or invalid state is treated as a fresh merger so desired configuration can
// still trigger a safe protected update and replace the artifact.
//
// Since: 2.0.0
func (merger *blocklistMerger) loadStatus() {
	if merger.loadedStatus {
		return
	}
	merger.loadedStatus = true
	status, err := blocklist.ReadStatus(merger.statusPath())
	if err == nil {
		merger.status = status
		merger.publishedStatus = cloneBlocklistStatus(status)
		merger.hasPublishedStatus = true
		merger.waitingForVPN = status.State == "waiting-for-vpn"
	}
}

// writeStatus atomically publishes runner observations for API and RPC readers.
//
// The existing Transmission state directory is owned by the same unprivileged user,
// and group-read mode gives the control API access without making status public;
// identical snapshots skip replacement and its file sync entirely.
//
// Since: 2.0.0
func (merger *blocklistMerger) writeStatus() error {
	if merger.hasPublishedStatus && reflect.DeepEqual(merger.status, merger.publishedStatus) {
		return nil
	}
	if err := blocklist.WriteJSON(merger.statusPath(), merger.status, 0o640); err != nil {
		return err
	}
	merger.publishedStatus = cloneBlocklistStatus(merger.status)
	merger.hasPublishedStatus = true

	return nil
}

// cloneBlocklistStatus copies mutable slices before retaining a comparison snapshot.
//
// Timestamp pointers are immutable UTC values, while source ordering may be replaced
// on every reconcile and therefore receives its own backing array.
//
// Since: 2.0.0
func cloneBlocklistStatus(status blocklist.Status) blocklist.Status {
	cloned := status
	cloned.Sources = append([]blocklist.SourceStatus(nil), status.Sources...)

	return cloned
}

// configurationPath returns the API-to-runner blocklist artifact path.
//
// It stays beside settings-base.json and daemons.json under the existing setgid
// hand-off directory.
//
// Since: 2.0.0
func (merger *blocklistMerger) configurationPath() string {
	return filepath.Join(
		merger.runner.options.RuntimeDirectory,
		"transmission-config",
		blocklist.ConfigurationFileName,
	)
}

// daemonConfigurationPath returns the complete desired daemon-list path.
//
// Reading the published list avoids racing the supervisor's mutable map and preserves
// the API's stable slot order for file synchronization.
//
// Since: 2.0.0
func (merger *blocklistMerger) daemonConfigurationPath() string {
	return filepath.Join(
		merger.runner.options.RuntimeDirectory,
		"transmission-config",
		"daemons.json",
	)
}

// statusPath returns the runner-to-API blocklist artifact path.
//
// It uses the existing Transmission-owned state directory, so the Docker runtime tree
// needs no new ownership boundary.
//
// Since: 2.0.0
func (merger *blocklistMerger) statusPath() string {
	return filepath.Join(
		merger.runner.options.RuntimeDirectory,
		"transmission-state",
		blocklist.StatusFileName,
	)
}

// validateBlocklistURL accepts only credential-free HTTPS source URLs.
//
// The same validation runs on initial requests and every redirect, closing the common
// HTTPS-to-HTTP downgrade path before a transport dial occurs.
//
// Since: 2.0.0
func validateBlocklistURL(rawURL string) (*url.URL, error) {
	parsedURL, err := url.Parse(rawURL)
	if err != nil || parsedURL.Scheme != "https" || parsedURL.Host == "" {
		return nil, errors.New("Only HTTPS blocklist URLs are allowed.")
	}
	if parsedURL.User != nil {
		return nil, errors.New("Blocklist URLs cannot contain credentials.")
	}

	return parsedURL, nil
}

// resolveBlocklistHost returns one IPv4 literal or connection-resolved address.
//
// IPv6 destinations are deliberately excluded because runner source policy and the
// permanent daemon slot addresses are IPv4-only.
//
// Since: 2.0.0
func resolveBlocklistHost(
	ctx context.Context,
	host string,
	resolver *net.Resolver,
) (string, error) {
	return vpnhttp.ResolveIPv4Host(ctx, host, resolver, nil)
}

// parseBlocklistLine recognizes one Transmission-compatible input line.
//
// CIDR is attempted first, followed by comma-delimited DAT and colon-delimited P2P;
// address parsing supplies the final family and ordering validation.
//
// Since: 2.0.0
func parseBlocklistLine(line string) (netip.Addr, netip.Addr, bool) {
	if line == "" || strings.HasPrefix(line, "#") {
		return netip.Addr{}, netip.Addr{}, false
	}
	if prefix, err := netip.ParsePrefix(line); err == nil {
		prefix = prefix.Masked()

		return prefix.Addr(), lastPrefixAddress(prefix), true
	}

	if comma := strings.IndexByte(line, ','); comma >= 0 {
		rangeText := line[:comma]
		if start, end, valid := parseAddressRange(rangeText); valid {
			return start, end, true
		}
	}

	for colon := strings.IndexByte(line, ':'); colon >= 0; {
		if start, end, valid := parseAddressRange(line[colon+1:]); valid {
			return start, end, true
		}
		next := strings.IndexByte(line[colon+1:], ':')
		if next < 0 {
			break
		}
		colon += next + 1
	}

	return netip.Addr{}, netip.Addr{}, false
}

// parseAddressRange validates one same-family inclusive address range.
//
// Whitespace around DAT separators is ignored, while address comparison rejects
// reversed ranges before they can reach Transmission's parser.
//
// Since: 2.0.0
func parseAddressRange(value string) (netip.Addr, netip.Addr, bool) {
	parts := strings.SplitN(value, "-", 2)
	if len(parts) != 2 {
		return netip.Addr{}, netip.Addr{}, false
	}
	start, startError := netip.ParseAddr(strings.TrimSpace(parts[0]))
	end, endError := netip.ParseAddr(strings.TrimSpace(parts[1]))
	if startError != nil || endError != nil {
		return netip.Addr{}, netip.Addr{}, false
	}
	start = start.Unmap().WithZone("")
	end = end.Unmap().WithZone("")
	if start.BitLen() != end.BitLen() || start.Compare(end) > 0 {
		return netip.Addr{}, netip.Addr{}, false
	}

	return start, end, true
}

// lastPrefixAddress expands a masked prefix into its inclusive final address.
//
// Byte-wise host-bit filling works for both address families without integer
// conversions that could truncate IPv6 values.
//
// Since: 2.0.0
func lastPrefixAddress(prefix netip.Prefix) netip.Addr {
	address := prefix.Masked().Addr()
	bits := address.BitLen()
	bytesValue := append([]byte(nil), address.AsSlice()...)
	for bit := prefix.Bits(); bit < bits; bit++ {
		bytesValue[bit/8] |= 1 << (7 - bit%8)
	}
	last, _ := netip.AddrFromSlice(bytesValue)

	return last.WithZone("")
}

// displaySafeBlocklistError removes controls and bounds one source error for status.
//
// The source URL is already a separate field, so only the concise failure reason is
// retained for console display and compatible RPC results.
//
// Since: 2.0.0
func displaySafeBlocklistError(err error) string {
	for err != nil {
		var urlError *url.Error
		if !errors.As(err, &urlError) || urlError.Err == nil {
			break
		}
		err = urlError.Err
	}
	if err == nil {
		return "The blocklist update failed."
	}
	message := strings.Map(func(character rune) rune {
		if unicode.IsControl(character) {
			return ' '
		}

		return character
	}, err.Error())
	message = blocklistURLPattern.ReplaceAllString(message, "[source]")
	message = blocklistQueryPattern.ReplaceAllString(message, "?[redacted]")
	message = strings.Join(strings.Fields(message), " ")
	if len(message) > 240 {
		message = message[:237] + "..."
	}

	return message
}

// statusesFromCopies describes retained files while an update waits for VPN recovery.
//
// Sources without a copy remain pending; usable copies retain their range count and
// successful timestamp without being mislabeled as a fresh update.
//
// Since: 2.0.0
func statusesFromCopies(
	sources []string,
	copies map[string]*blocklistCopy,
) []blocklist.SourceStatus {
	statuses := make([]blocklist.SourceStatus, 0, len(sources))
	for _, sourceURL := range sources {
		copy, found := copies[sourceURL]
		if !found {
			statuses = append(statuses, blocklist.SourceStatus{URL: sourceURL, State: "pending"})

			continue
		}
		updatedAt := copy.UpdatedAt
		statuses = append(statuses, blocklist.SourceStatus{
			URL: sourceURL, State: "ok", Ranges: copy.Ranges, UpdatedAt: &updatedAt,
		})
	}

	return statuses
}

// totalBlocklistRanges sums only copies actually installed for configured sources.
//
// The source-order iteration intentionally ignores stale map entries that may belong
// to a source removed by the same configuration change.
//
// Since: 2.0.0
func totalBlocklistRanges(sources []string, copies map[string]*blocklistCopy) int {
	total := 0
	counted := make(map[string]struct{}, len(sources))
	for _, sourceURL := range sources {
		if _, duplicate := counted[sourceURL]; duplicate {
			continue
		}
		counted[sourceURL] = struct{}{}
		if copy, found := copies[sourceURL]; found && copy != nil {
			total += copy.Ranges
		}
	}

	return total
}

// sameOptionalTime compares nullable timestamps by value.
//
// It distinguishes the first manual request from no request while avoiding pointer
// identity differences after every JSON decode.
//
// Since: 2.0.0
func sameOptionalTime(left *time.Time, right *time.Time) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}

	return left.Equal(*right)
}

// timePointer returns a stable UTC copy suitable for a JSON status field.
//
// Centralizing this small conversion avoids storing pointers to mutable loop values in
// per-source and aggregate merger state.
//
// Since: 2.0.0
func timePointer(value time.Time) *time.Time {
	utc := value.UTC()

	return &utc
}
