# transmission-vpn-app-transmission

## 2.1.0 - 2026-11-10

### FIXED
- After the container starts, the VPN reconnects as soon as the VPN controller is up, instead of up to 10 seconds later with a warning that the controller couldn't be reached.
- Requests the browser cancels, such as when you close the console while a page is loading, no longer show up in the logs as errors.
- The import wizard says on its first step when the import has torrents but there is no default VPN connection, instead of stopping you at the last step.
- The import wizard's Back and Next buttons stay visible on every step, however short the window. A long step now scrolls instead of pushing them out of the dialog.
- In the folder picker, giving New folder the name of a folder that's already there opens and selects that folder, instead of only saying it already exists.
- The console no longer goes blank when you rename a profile in the import wizard. Changing a profile's VPN connection or whether it's created, a torrent file's download box or priority, and the export dialog's section boxes had the same fault.
- The control API reports the version it shipped in. Every image so far said 2.0.0 in its startup log, health check, and backup exports.
- While a torrent is being verified, its progress bar and percentage follow the check, so they match the Verifying label instead of showing how much is downloaded.

### ADDED
- Debug logging on the Settings page. While it's on, the container log names slow database work and what asked for it, each VPN reconnect, and requests the browser canceled.

## 2.0.3 - 2026-11-10

### FIXED
- Startup no longer stops with `iptables: No chain/target/match by that name` on NAS kernels that leave out iptables' owner match, such as Synology's. The firewall now drops every new connection the container opens outside a VPN tunnel, whichever service opens it, and lets only the VPN controller's own traffic out. The control plane downloads provider catalogs and sends notifications through the controller, so they still work while every VPN connection is down.

## 2.0.2 - 2026-11-10

### FIXED
- A dropped VPN connection no longer skips its retry interval and its **Reconnecting** state. While the VPN controller removed the old tunnel, the console's 10-second check could read the connection as lost and start a fresh connect in its place.
- Startup no longer stops with `/config/app is not writable by control` on Synology shared folders, which let only the owner of a folder write to it. The control plane now runs as `PUID`, so it owns its database and installation key like Transmission owns its files, and it keeps its own group, which the firewall uses to keep its traffic out of Transmission's rules.

## 2.0.1 - 2026-11-10

### FIXED
- Startup no longer stops with `/config/app is not writable by control` when the host gives every file in `/config` to the `PUID:PGID` account, for example through a scheduled `chown -R`. Everything in `/config` now belongs to `PUID:PGID`, and the control plane reaches its database and installation key through that group while keeping its own user for the firewall.

## 2.0.0 - 2026-11-01

### UPDATED
- A Docker image that runs its own Transmission and OpenVPN or WireGuard connection replaces the Synology DSM script, set up in the web interface instead of DSM's VPN client and the Synology Transmission package. Nothing carries over from the script, so settings, VPN connections, and the torrent list start fresh, and the migration guide maps each old variable to its replacement.

### ADDED
- Portable Export and Import under Settings > Backup covers selected settings and profiles, labels, notifications, torrents, VPN connections, RPC logins, and API tokens. Exports require a fresh password and authenticator-code check or a passkey, and imports show folder, profile, setting, and replacement choices before applying them.
- An **Another Transmission** import source reads Transmission 3 and 4 configs mounted read-only. It maps download and incomplete folders, turns download and empty sibling folders into profiles, brings over supported settings and the torrent list, re-checks each torrent whose files are found and restores its saved paused or running state, and keeps a torrent whose files are missing paused as **Data missing**. Values outside this app's limits are listed under **Not brought over**, and torrents already here are skipped.
- System, Light, and Dark appearance modes are saved and apply across the whole interface. System mode follows live operating-system color-scheme changes.
- The Notifications page sends **VPN dropped**, **VPN back up**, **Torrent finished**, **Torrent error**, **Sign-in locked**, **Saved secrets were removed**, and **Profile choice needed** alerts to ntfy, Reverse Proxy for ntfy, Telegram, Discord, Slack, Gotify, Pushover, Matrix, email, Apprise, or a webhook, and each destination has a **Send test** button. All seven events are selected for a new destination. Common delivery errors identify the destination host and whether it refused the connection, could not be found, did not reply, failed its certificate check, or was unreachable, with the original diagnostic under **Details**. Secret fields are sealed with the installation key and never shown again.
- An authenticated Go control plane runs the appliance, with versioned SQLite state, managed settings, and health APIs.
- A responsive folder tree offers lazy expansion, keyboard navigation, inline folder creation, profile-aware ownership reasons, and deletion of empty, unassigned folders for profile and incomplete-folder workflows. Clicking a folder that cannot be selected opens or closes it when it has subfolders, and its reason is the row's title. Settings and pickers use **Use incomplete folder**, **Incomplete folder**, and **Choose incomplete folder**, and folder tags, warnings, and API messages use incomplete-folder wording. Incomplete-folder conflicts identify the exact folder relationship. Storage operations stay confined to real directories beneath `/data` through a dedicated Transmission-user controller that rejects traversal and symbolic-link escapes and never deletes files or folders recursively.
- When the installation key is missing, the container makes a new one and removes only what the old key locked: the VPN profiles and login, and the authenticator app. The log and a notice in the web interface list them so they can be set up again, and everything else stays. A key file from another database stops startup with a message that says how to fix it.
- A strength meter sits under every field that sets a password. It rates the password from Weak to Strong and points out common words, runs such as 1234, repeated characters, years, and the username. Any password of 12 or more characters is still accepted.
- The container is built on s6-overlay, with non-recursive persistent storage initialization, privilege-separated services, a fail-closed firewall boundary, and integration coverage for blocked Transmission egress.
- A responsive React interface handles torrent operations, live VPN safety, provider setup, transactional settings, and first-run access. The interface, versioned API, and authenticated event stream are served on port 22602, and the opt-in Transmission-compatible RPC route on Transmission's usual port 9091, while every native Transmission RPC listener stays private on container loopback. Each console page had its own address, so Back, Forward, refresh, bookmarks, and a return to the requested page after sign-in shared the same route table. The RPC route combined torrents from every connection and routed supported actions to the owning daemon. Each remote app used its own RPC login with a generated password shown once, password regeneration, deletion, and last-used state; either proxy could be turned on or off whatever its logins, refusing every sign-in while it had none. Without a VPN connection, only the note below each proxy heading linked **Add VPN connection**, and both **Logins** sections read `Logins can be added once there's a VPN connection.` Copy rows put their label above an address that wraps after `://` and `/`, and API tokens authenticated only the versioned API.
- Several VPN connections can run at once. Each connection ran its own Transmission and isolated OpenVPN or WireGuard tunnel, while one default connection handled Default-profile torrents, unmatched and unresolved remote-app adds, and Transmission DNS. The VPN page summarizes usage as **N of M connections**, places the memory and CPU calculation behind **?**, and identifies the default connection as the route for Default-profile torrents and tracker lookups. Capacity was calculated from container memory and CPUs, with a two-connection fallback when memory could not be read. Profiles and torrent assignments moved torrents between connections while keeping their files and per-torrent options, and connection removal moved its torrents, profiles, and proxy logins to a chosen connection. The compatible RPC route presented every daemon as one Transmission, and each web proxy login selected a connection or followed the default.
- The Compose network has IPv6, so the web interface sees each IPv6 visitor's own address.
- A responsive torrent-library sidebar lists Status, Profiles, and Labels, with torrent counts, profile actions, and label editing. Its bottom edge fades while more rows remain below and clears when the final row is visible. Phones get a matching Torrents sheet, removable active-filter pills at every width, and a four-tab phone bar for Torrents, VPN, Apps, and More, with Settings and Notifications in the More sheet.
- Torrent profiles each own one unique download folder and one effective VPN connection. No profile's folder may sit inside another profile's folder or hold one, the Default profile's included; a setup or export saved before that rule shows which folders overlap and refuses new torrents for those profiles until each has its own folder. Profiles also have labels, paused state, seeding, speed, priority, peer, and queue defaults. The Default role is listed first with an editable name, the `transmission.downloadDirectory` folder, and a read-only default VPN connection; named profiles are listed alphabetically and have no saved order. Adding a torrent reads each web link's real torrent name and size through the default VPN connection before adding, so profile matching and duplicate notices use the real name. Name patterns are edited one per row with **Add pattern**, a **How to write a pattern** guide with examples, and a **Try a name** box that shows which patterns match. Overlapping name patterns save with an explanatory note. Web-interface adds that match several patterns require a profile choice, while remote-app ties are added paused with the Default folder and connection and marked **Needs a profile** in a banner, Status row, torrent tag, and resolution dialog. Resolving moves the torrent, adds the selected profile's labels to the app's own, applies its limits, and starts it unless that profile starts paused. Profiles can be assigned from details or the **Change profile** selection action, optional one-time label and limit application, **Save and move** confirmation when an edited profile's folder or connection affected assigned torrents, and **Delete and move** when deleting a profile that owns torrents. Labels are free tags that are saved the first time any profile, add, torrent edit, or remote app uses them, up to 1,024, and whose saved names could be changed or deleted across every torrent and profile that used them, with revision-safe editing and Profile, Default profile, and Label library filters.
- Each connection has its own Transmission daemon, run by an unprivileged s6-supervised runner with generated native configuration, loopback-only RPC adapters, and authenticated torrent APIs. A torrent runs on one connection only: an add whose info hash is already on another connection returns that torrent so the interface can identify its existing profile and connection, and a torrent added by link stays paused until that check passes. Restarts are controlled, settings apply live, and end-to-end checks cover daemon identity, RPC isolation, and dynamic fail-closed firewall transitions. The Settings page kept global incomplete-folder, queue, peer, randomized-port, and blocklist controls in one list, kept each peer port and VPN setup on its connection page, kept the RPC proxy switch on Remote apps, and showed a pending notice with a **Restart Transmission** action. The fixed save bar left room below the last setting, notifications sat above it, and **Blocklist sources** stacked below its label on narrower windows. The Default profile editor owned its name, the live **Download folder** setting, a read-only default connection, and the default ratio, peer, and other per-torrent options.
- A runner-owned blocklist merger combines several sources. It downloads every HTTPS source only through the protected default VPN connection, applies strict redirect, time, download, and unpacked limits, accepts Transmission's P2P, DAT, and CIDR formats, keeps each source's last-good copy on failure, replaces every daemon's normalized blocklist files, and reloads running daemons. Blocklist sources and the new 1–168 hour update interval apply without a restart; the authenticated API exposes merger status and manual updates, and compatible RPC `blocklist-update` waits for the merger instead of contacting native daemons.
- WireGuard sits next to OpenVPN. Mullvad is a WireGuard-only provider, NordVPN, Surfshark, and IVPN offer both tunnels with their official WireGuard server lists, and Custom accepts a WireGuard `.conf` file as well as an OpenVPN profile. Every `remote` line in a custom OpenVPN upload becomes a separate selected endpoint, with **Fallback order** following the file's order. Providers with both tunnels open on OpenVPN. The WireGuard sign-in asks for the private key and, where the provider needs it, the tunnel address, and the key is sealed with the installation key. The container uses the host's kernel WireGuard or falls back to `wireguard-go`, sends traffic into the tunnel only after a handshake and the same checks as OpenVPN, and notices a dead WireGuard server in about 90 seconds.
- Official OpenVPN catalogs cover Private Internet Access, IPVanish, NordVPN, Surfshark, IVPN, and PureVPN. Endpoints are searchable by country, city, continent, and protocol in a responsive endpoint browser, and pools hold several endpoints with sticky, ordered, or randomized failover, each pool confined to one provider. The endpoint browser shows each provider's note on which servers allow P2P traffic, with a link to its page. A saved connection keeps its sign-in when those fields are left empty, until its provider or tunnel changes. **New connection** shows no status card before its first successful save. Failed tests identify the endpoint and whether its address could not be found, it did not reply, its sign-in was refused, or its certificate check failed, with a safe fallback for an unclassified cause. Testing a pool or reconnecting from the VPN page stops after 15 minutes and finishes even if the page is closed, and either one, like a disconnect, takes over at once from an automatic reconnect. While automatic reconnects are on, a VPN left blocked, for example by a restart of the VPN controller or a reconnect that failed, reconnects in the background.
- The runtime is a pinned Debian 13 slim image with the newest Transmission 4.1 release built from its checksummed upstream source, a build check that refuses series older than 4.1 because trackers ban Transmission 4.0.6, a weekly check that reports when a newer Transmission series is out, and a bounded daemon shutdown so s6 can finish the firewall teardown inside Docker's normal stop window.
- The torrent workspace has sortable transfer statistics, pagination, range selection, queue and context actions, drag-and-drop add, editable files and trackers, peer details, a piece map with per-piece peer availability, profile-driven file and connection moves, path rename, and per-torrent transfer options. The **#** queue column appears only when one VPN connection exists or the list is filtered to one connection.
- Personal access tokens live on the Remote apps page. **Create token** asks for a name, the scopes the token gets, and an optional expiry, then shows **Token for** followed by the token's name, a copy button, and **Done** as the second step of the same dialog. `torrents:write` reads `Add, start, stop, and remove torrents, and change their profiles.` **Edit** changes the name, scopes, or expiry later without changing the token's value (API clients use `PUT /api/v1/auth/tokens/{id}`). The token list refreshes last-used times every three seconds while the page is open and visible. Revoking a token deletes it at once, and an expired token stays listed until it's revoked or given a new expiry.
- Sign-in and security holds a username change, the authenticator app with recovery codes, and passkeys. Setting up or turning off the authenticator app, making new recovery codes, and adding or removing a passkey ask for the password again. Usernames match without regard to letter case, and generated setup codes are accepted in any letter case, while mounted setup secrets must match exactly.
- Setup, sign-in, account security, and tokens use the same error format as pfsense-actions: `invalid_request` with field issues for every validation error, and `Retry-After` on rate limits.
- An opt-in HTTP and SOCKS5 web proxy on port 22605 serves private-network devices and containers, with separate editable logins that selected a VPN connection or followed the default, public-IPv4-only destinations, DNS through the selected connection, failed-sign-in limits, HTTP CONNECT and plain HTTP support, and fail-closed traffic through the selected tunnel.
- Transmission couldn't reach Docker's resolver while the default connection was down. Each connection used the provider's DNS servers or up to eight custom IPv4 servers routed through its tunnel, while every Transmission sent DNS through the default connection. Retry intervals ranged from 3 to 600 seconds, and connection actions were held while another VPN change ran. The web interface and compatible RPC routes stayed reachable from the private LAN while connected, and OpenVPN's own restarts went through endpoint failover and full tunnel verification.

### REMOVED
- L2TP and PPTP connections are gone. OpenVPN and WireGuard are the supported protocols.
- The script's port-forwarding check (`PORT_FWD`) and external IP check (`IP_CHECK`) are gone. Tunnel verification runs on every connect instead.

## 1.3.2 - 2020-11-08

### UPDATED
- The project is now named transmission-vpn instead of transmissionVPN, with the files renamed to `transmission-vpn.sh` and `port-forwarding.php`.

### REMOVED
- The Patreon link is gone from the README and the funding file.

## 1.3.1 - 2020-07-15

### UPDATED
- The port forwarding check is now `portforwarding.php` instead of `transmissionvpn_portfwd.php`.
- The README was reworded, and new issues must use one of the issue templates.

## 1.3.0 - 2020-02-22

### UPDATED
- The script works with Transmission v2.94-16.
- `transmissionvpn.sh` moved to the repository root, and the port forwarding check is now `transmissionvpn_portfwd.php`.

### ADDED
- The project has an ISC license, plus GitHub issue templates for bug reports and feature requests.

### REMOVED
- The README's Maintainer Change Fix section is gone, since the new defaults already match the current Transmission package.

## 1.2.2 - 2019-10-30

### ADDED
- The README covers troubleshooting for the `ppp0: error fetching interface information` error, with steps to find the right `VPN_INTERFACE`.
- The README explains port forwarding behind NAT, where `PORT_FWD` must stay blank.

## 1.2.1 - 2019-10-30

### UPDATED
- `TRANS_USER` and `TRANS_GROUP` default to `sc-transmission` and `transmission` to match the current SynoCommunity Transmission package.
- `VPN_RETRY` and `VPN_INTERVAL` default to 10 retries and 30 seconds again.

## 1.2.0 - 2018-03-03

### UPDATED
- The script works with Transmission v2.93-13.
- Transmission stops and starts through `synopkg` instead of the package's `start-stop-status` script, so `TRANS_SSSS` is no longer used.
- The repair output labels the looked-up address as the API query IP instead of ipinfo.io.

### ADDED
- The README has steps for the SynoCommunity maintainer change, which moved Transmission to a new user and group.

## 1.1.5 - 2017-10-03

### UPDATED
- The port forwarding check script was reformatted and documented.

### ADDED
- The README has steps for turning on Multiple Gateways when Transmission can't reach the internet.

## 1.1.4 - 2016-04-19

### REMOVED
- The leftover commented-out port forwarding check after a reconnect is gone.

## 1.1.3 - 2016-04-18

### REMOVED
- The second port forwarding check after a reconnect is gone. Repair now confirms only the VPN address once it reconnects.

## 1.1.2 - 2016-02-05

### UPDATED
- The usage example reads `sh transmissionvpn.sh start`, and the port forwarding check has a header comment.

## 1.1.1 - 2016-02-05

### FIXED
- `ERROR 1002` now says the forwarded port may be closed, not only that the VPN can't reach the internet.

## 1.1.0 - 2016-02-05

### UPDATED
- The README's steps for finding the Configuration ID are clearer.

### ADDED
- A port forwarding check (`portforward.php`) for the `PORT_FWD` port. Repair reconnects when the port is closed.
- An `IP_CHECK` variable that sets the service used to look up the VPN's public address.

## 1.0.3 - 2015-11-25

### UPDATED
- `VPN_RETRY` and `VPN_INTERVAL` default to 5 retries and 10 seconds.

### FIXED
- Repair no longer breaks when the interface or ipinfo.io returns no address. It shows `unknown` and `not found` and reconnects.

## 1.0.2 - 2015-11-25

### UPDATED
- Repair prints both the interface address and the ipinfo.io address, and uninstall reports binding the default address.
- The README's setup steps were reworded.

## 1.0.1 - 2015-11-22

### UPDATED
- `stop` binds Transmission to 127.0.0.1 before disconnecting the VPN.

### ADDED
- A `repair` command that compares the VPN interface address with ipinfo.io, reconnects when they differ, and keeps Transmission on 127.0.0.1 while the VPN is down.
- `install` and `uninstall` commands that bind Transmission to 127.0.0.1 or back to 0.0.0.0.
- `VPN_TYPE`, `VPN_INTERFACE`, `VPN_RETRY`, and `VPN_INTERVAL` variables, so OpenVPN (`tun0`) works alongside L2TP and PPTP (`ppp0`).
- The README has setup steps for every variable and the Configuration ID.

## 1.0.0 - 2015-11-20

### ADDED
- The initial Synology DSM script that connects a DSM VPN profile and binds Transmission's `bind-address-ipv4` to the VPN address on `start`, and to 127.0.0.1 on `stop`.
