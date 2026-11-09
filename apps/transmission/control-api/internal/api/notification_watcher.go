package api

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/controller"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/notifications"
)

// notificationWatchInterval is how often the watcher looks at the VPN and the torrents
// while a destination listens for their events.
const notificationWatchInterval = 10 * time.Second

// vpnDropGrace is how long the tunnel can be down before it counts as dropped, so a
// quick reconnect doesn't send an alert.
const vpnDropGrace = time.Minute

// maximumListedTorrents caps how many torrents one alert names, so a full disk that
// stops every torrent still fits in a Pushover message.
const maximumListedTorrents = 5

// watchedTorrent is the part of a torrent the watcher needs from Transmission.
type watchedTorrent struct {
	HashString   string `json:"hashString"`
	Name         string `json:"name"`
	DoneDate     int64  `json:"doneDate"`
	Error        int    `json:"error"`
	ErrorString  string `json:"errorString"`
	DownloadDir  string `json:"downloadDir"`
	TotalSize    int64  `json:"totalSize"`
	ConnectionID string `json:"connectionId"`
}

// watchedTorrentResult keeps one daemon's answer independent from its siblings.
type watchedTorrentResult struct {
	ConnectionID string
	Torrents     []watchedTorrent
	Error        error
}

// namedVPNStatus pairs controller runtime with the durable display name.
type namedVPNStatus struct {
	controller.Status
	Name string
}

// vpnNotificationState keeps outage grace and delivery state per connection.
type vpnNotificationState struct {
	DownSince time.Time
	Reported  bool
	LastError string
}

// notificationWatcher turns VPN drops and torrent results into alerts.
//
// It runs only in the serving process and asks the VPN controller and Transmission only
// for events a destination wants. Its first look at the torrents records what is there,
// so a restart doesn't report torrents that finished or failed before it.
type notificationWatcher struct {
	notifier    *notifier
	vpnStatuses func(context.Context) ([]namedVPNStatus, error)
	torrents    func(context.Context) []watchedTorrentResult
	cancel      context.CancelFunc
	done        chan struct{}
	startOnce   sync.Once

	vpnStates       map[string]*vpnNotificationState
	torrentSeededAt map[string]time.Time
	torrentDone     map[string]int64
	torrentFailing  map[string]bool
}

// newNotificationWatcher prepares a watcher for the server's VPN controller and
// Transmission. Either may be missing, in tests or before setup.
func newNotificationWatcher(server *Server) *notificationWatcher {
	watcher := &notificationWatcher{
		notifier:        server.notifier,
		done:            make(chan struct{}),
		torrentSeededAt: map[string]time.Time{},
		torrentDone:     map[string]int64{},
		torrentFailing:  map[string]bool{},
		vpnStates:       map[string]*vpnNotificationState{},
	}

	if server.controller != nil {
		watcher.vpnStatuses = func(ctx context.Context) ([]namedVPNStatus, error) {
			statuses, err := server.controller.Status(ctx)
			if err != nil {
				return nil, err
			}
			connections, err := server.store.ListVPNConnections(ctx)
			if err != nil {
				return nil, err
			}
			names := make(map[string]string, len(connections))
			for _, connection := range connections {
				names[connection.ID] = connection.Name
			}

			namedStatuses := make([]namedVPNStatus, 0, len(statuses))
			for _, status := range statuses {
				namedStatuses = append(namedStatuses, namedVPNStatus{
					Status: status,
					Name:   names[status.ConnectionID],
				})
			}

			return namedStatuses, nil
		}
	}

	if server.transmission != nil || server.transmissionClients != nil {
		watcher.torrents = func(ctx context.Context) []watchedTorrentResult {
			daemons := server.transmissionDaemons(ctx)
			results := make([]watchedTorrentResult, len(daemons))
			var waitGroup sync.WaitGroup
			for index, daemon := range daemons {
				waitGroup.Add(1)
				go func() {
					defer waitGroup.Done()
					var response struct {
						Torrents []watchedTorrent `json:"torrents"`
					}
					err := daemon.Client.Call(ctx, "torrent-get", map[string]any{
						"fields": []string{
							"doneDate",
							"downloadDir",
							"error",
							"errorString",
							"hashString",
							"name",
							"totalSize",
						},
					}, &response)
					for torrentIndex := range response.Torrents {
						response.Torrents[torrentIndex].ConnectionID = daemon.ConnectionID
					}
					results[index] = watchedTorrentResult{
						ConnectionID: daemon.ConnectionID,
						Torrents:     response.Torrents,
						Error:        err,
					}
				}()
			}
			waitGroup.Wait()

			return results
		}
	}

	return watcher
}

// WatchNotifications starts watching the VPN and the torrents for the events
// destinations chose. Close stops it.
func (server *Server) WatchNotifications() {
	server.watcher.start()
}

// start runs the watch loop once, in the background.
func (watcher *notificationWatcher) start() {
	watcher.startOnce.Do(func() {
		ctx, cancel := context.WithCancel(context.Background())
		watcher.cancel = cancel

		go watcher.run(ctx)
	})
}

// stop ends the watch loop and waits for the current look to finish.
func (watcher *notificationWatcher) stop() {
	if watcher.cancel == nil {
		return
	}

	watcher.cancel()
	<-watcher.done
}

// run looks right away, then every notificationWatchInterval.
func (watcher *notificationWatcher) run(ctx context.Context) {
	defer close(watcher.done)

	ticker := time.NewTicker(notificationWatchInterval)
	defer ticker.Stop()

	for {
		watcher.check(ctx, time.Now())

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

// check looks at whatever a destination listens for. A part nobody wants starts fresh
// the next time someone does.
func (watcher *notificationWatcher) check(ctx context.Context, now time.Time) {
	lookContext, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	wanted, err := watcher.notifier.wantedEvents(lookContext)
	if err != nil {
		watcher.notifier.logger.Error("list notifications", "error", err)

		return
	}

	if watcher.vpnStatuses != nil && (wanted["vpn-dropped"] || wanted["vpn-restored"]) {
		// A controller that doesn't answer is restarting; the next look tries again.
		if statuses, err := watcher.vpnStatuses(lookContext); err == nil {
			present := make(map[string]struct{}, len(statuses))
			for _, status := range statuses {
				present[status.ConnectionID] = struct{}{}
				watcher.observeVPNConnection(status.Status, status.Name, now)
			}
			for connectionID := range watcher.vpnStates {
				if _, found := present[connectionID]; !found {
					delete(watcher.vpnStates, connectionID)
				}
			}
		}
	} else {
		clear(watcher.vpnStates)
	}

	if watcher.torrents != nil && (wanted["torrent-finished"] || wanted["torrent-error"]) {
		for _, result := range watcher.torrents(lookContext) {
			if result.Error != nil {
				watcher.notifier.logger.Warn(
					"list torrents for notifications",
					"connectionId",
					result.ConnectionID,
					"error",
					result.Error,
				)

				continue
			}
			watcher.observeTorrentConnection(result.ConnectionID, result.Torrents, now)
		}
	} else {
		clear(watcher.torrentSeededAt)
		clear(watcher.torrentDone)
		clear(watcher.torrentFailing)
	}
}

// observeVPN reports a tunnel that stays down past the grace period, once per outage,
// and reports it again when it is back.
//
// Reconnecting, or a connection that failed with an error, counts as down. Connecting
// keeps the outage as it is, and a tunnel turned off on purpose ends one that wasn't
// reported yet.
func (watcher *notificationWatcher) observeVPN(status controller.Status, now time.Time) {
	watcher.observeVPNConnection(status, "", now)
}

// observeVPNConnection reports one connection independently from every sibling.
func (watcher *notificationWatcher) observeVPNConnection(
	status controller.Status,
	connectionName string,
	now time.Time,
) {
	if watcher.vpnStates == nil {
		watcher.vpnStates = map[string]*vpnNotificationState{}
	}
	connectionID := status.ConnectionID
	if connectionID == "" {
		connectionID = "default"
	}
	state := watcher.vpnStates[connectionID]
	if state == nil {
		state = &vpnNotificationState{}
		watcher.vpnStates[connectionID] = state
	}
	details := map[string]any{
		"connectionId":   status.ConnectionID,
		"connectionName": connectionName,
	}

	switch {
	case status.State == "protected":
		if state.Reported {
			details["downSince"] = state.DownSince.UTC().Format(time.RFC3339)
			details["remoteHost"] = status.RemoteHost
			details["upAt"] = now.UTC().Format(time.RFC3339)
			watcher.notifier.deliver(notifications.BuildEventNotification(
				notificationEvent("vpn-restored"),
				"The VPN is back up after "+formatOutage(now.Sub(state.DownSince))+" down.",
				details,
				now,
			))
		}

		state.DownSince = time.Time{}
		state.Reported = false
		state.LastError = ""
	case status.State == "reconnecting" || (status.State == "blocked" && status.LastError != ""):
		if state.DownSince.IsZero() {
			state.DownSince = now
		}

		if status.LastError != "" {
			state.LastError = status.LastError
		}

		if state.Reported || now.Sub(state.DownSince) < vpnDropGrace {
			return
		}

		message := "The VPN went down and hasn't come back after a minute. Transmission's traffic is blocked until it does."
		if state.LastError != "" {
			message += " Last error: " + truncateReason(state.LastError, 200)
		}
		details["downSince"] = state.DownSince.UTC().Format(time.RFC3339)
		details["lastError"] = state.LastError

		watcher.notifier.deliver(notifications.BuildEventNotification(
			notificationEvent("vpn-dropped"),
			message,
			details,
			now,
		))
		state.Reported = true
	case status.State == "blocked":
		if !state.Reported {
			state.DownSince = time.Time{}
			state.LastError = ""
		}
	}
}

// observeTorrents reports torrents that finished downloading and torrents that started
// failing since the last look, with at most one alert of each kind per look.
//
// Transmission sets a torrent's done date only when it finishes a download, so checking
// existing data never counts. A torrent's error is reported again only after it clears.
// Tracker warnings don't count; tracker errors and local errors do.
func (watcher *notificationWatcher) observeTorrents(torrents []watchedTorrent, now time.Time) {
	byConnection := map[string][]watchedTorrent{}
	for _, torrent := range torrents {
		byConnection[torrent.ConnectionID] = append(byConnection[torrent.ConnectionID], torrent)
	}
	for connectionID, connectionTorrents := range byConnection {
		watcher.observeTorrentConnection(connectionID, connectionTorrents, now)
	}
}

// observeTorrentConnection updates and prunes only one successfully queried daemon.
func (watcher *notificationWatcher) observeTorrentConnection(
	connectionID string,
	torrents []watchedTorrent,
	now time.Time,
) {
	if watcher.torrentSeededAt == nil {
		watcher.torrentSeededAt = map[string]time.Time{}
	}
	if watcher.torrentDone == nil {
		watcher.torrentDone = map[string]int64{}
	}
	if watcher.torrentFailing == nil {
		watcher.torrentFailing = map[string]bool{}
	}
	seededAt, seeded := watcher.torrentSeededAt[connectionID]
	seeding := !seeded
	if seeding {
		seededAt = now
		watcher.torrentSeededAt[connectionID] = seededAt
	}

	finished := []watchedTorrent{}
	failing := []watchedTorrent{}
	present := map[string]bool{}

	for _, torrent := range torrents {
		key := torrentWatchKey(connectionID, torrent.HashString)
		present[key] = true

		previousDoneDate, known := watcher.torrentDone[key]
		newlyDone := torrent.DoneDate > 0 &&
			((known && torrent.DoneDate > previousDoneDate) || (!known && torrent.DoneDate >= seededAt.Unix()))
		if newlyDone && !seeding {
			finished = append(finished, torrent)
		}
		watcher.torrentDone[key] = torrent.DoneDate

		if torrent.Error < 2 {
			delete(watcher.torrentFailing, key)

			continue
		}

		if !watcher.torrentFailing[key] && !seeding {
			failing = append(failing, torrent)
		}
		watcher.torrentFailing[key] = true
	}

	connectionPrefix := connectionID + "\x00"
	for key := range watcher.torrentDone {
		if strings.HasPrefix(key, connectionPrefix) && !present[key] {
			delete(watcher.torrentDone, key)
			delete(watcher.torrentFailing, key)
		}
	}

	if len(finished) > 0 {
		watcher.notifier.deliver(notifications.BuildEventNotification(
			notificationEvent("torrent-finished"),
			describeFinishedTorrents(finished),
			map[string]any{"torrents": torrentDetails(finished)},
			now,
		))
	}

	if len(failing) > 0 {
		watcher.notifier.deliver(notifications.BuildEventNotification(
			notificationEvent("torrent-error"),
			describeFailingTorrents(failing),
			map[string]any{"torrents": torrentDetails(failing)},
			now,
		))
	}
}

// torrentWatchKey separates duplicate hashes that unexpectedly exist in two daemons.
func torrentWatchKey(connectionID string, hash string) string {
	return connectionID + "\x00" + strings.ToLower(hash)
}

// describeFinishedTorrents names the torrents that finished, up to maximumListedTorrents.
func describeFinishedTorrents(torrents []watchedTorrent) string {
	if len(torrents) == 1 {
		return torrents[0].Name + " finished downloading."
	}

	names := make([]string, 0, len(torrents))
	for _, torrent := range torrents {
		names = append(names, torrent.Name)
	}

	return strconv.Itoa(len(torrents)) + " torrents finished downloading: " + listTorrents(names) + "."
}

// describeFailingTorrents names the torrents that started failing and Transmission's
// reason for each, up to maximumListedTorrents.
func describeFailingTorrents(torrents []watchedTorrent) string {
	if len(torrents) == 1 {
		return "Transmission reported an error for " + torrents[0].Name + ": " + truncateReason(torrents[0].ErrorString, 200)
	}

	entries := make([]string, 0, len(torrents))
	for _, torrent := range torrents {
		entries = append(entries, torrent.Name+" ("+truncateReason(torrent.ErrorString, 80)+")")
	}

	return "Transmission reported errors for " + strconv.Itoa(len(torrents)) + " torrents: " + listTorrents(entries) + "."
}

// listTorrents joins names with commas and says how many more there are past the cap.
func listTorrents(entries []string) string {
	if len(entries) <= maximumListedTorrents {
		return strings.Join(entries, ", ")
	}

	return strings.Join(entries[:maximumListedTorrents], ", ") +
		fmt.Sprintf(", and %d more", len(entries)-maximumListedTorrents)
}

// torrentDetails lists every torrent an alert covers for webhooks and
// ntfy-reverse-proxy, past the cap the message uses.
func torrentDetails(torrents []watchedTorrent) []map[string]any {
	details := make([]map[string]any, 0, len(torrents))
	for _, torrent := range torrents {
		detail := map[string]any{
			"connectionId": torrent.ConnectionID,
			"downloadDir":  torrent.DownloadDir,
			"hash":         torrent.HashString,
			"name":         torrent.Name,
			"totalSize":    torrent.TotalSize,
		}
		if torrent.Error >= 2 {
			detail["error"] = torrent.ErrorString
		}

		details = append(details, detail)
	}

	return details
}

// formatOutage writes how long the VPN was down in minutes, or hours and minutes, the way
// discord-stonker-bot writes how long the bot was away. Anything shorter than a minute
// counts as one.
func formatOutage(duration time.Duration) string {
	minutes := max(1, int((duration+30*time.Second)/time.Minute))
	minuteWord := "minutes"
	if minutes == 1 {
		minuteWord = "minute"
	}

	if minutes < 60 {
		return strconv.Itoa(minutes) + " " + minuteWord
	}

	hours := minutes / 60
	hourWord := "hours"
	if hours == 1 {
		hourWord = "hour"
	}

	if minutes%60 == 0 {
		return strconv.Itoa(hours) + " " + hourWord
	}

	return strconv.Itoa(hours) + " " + hourWord + " " + formatOutage(time.Duration(minutes%60)*time.Minute)
}

// truncateReason shortens an error to a number of characters without splitting one.
func truncateReason(value string, maximum int) string {
	characters := []rune(value)
	if len(characters) <= maximum {
		return value
	}

	return string(characters[:maximum])
}
