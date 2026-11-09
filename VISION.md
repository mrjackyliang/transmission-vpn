# VISION.md

## Purpose

### Problem Statement

The original Transmission VPN project is a Synology-specific script that connects
Transmission through a host-managed VPN. That approach is tied to one NAS environment
and is not a suitable foundation for a modern, portable product.

The replacement will be a purpose-built Docker image that combines Transmission with
VPN routing and leak protection. Existing combined Transmission and VPN images prove
the need, but they can expose a large configuration surface and an interface that feels
more operational than approachable.

The project also needs a maintained web experience. `transmission-web-control` provides
useful day-to-day functionality but is deprecated, so it should be treated only as a
functional reference rather than reused or carried forward.

### Target Audience

- **Self-hosters** - People who want Transmission traffic isolated behind a VPN without
  assembling and supervising several containers themselves.
- **Home-server and NAS users** - People moving beyond appliance-specific scripts who
  still want a straightforward deployment and familiar torrent-management workflow.
- **Security-conscious Transmission users** - People who value fail-closed networking
  and understandable status information more than a long list of optional features.

### Value Proposition

Transmission VPN provides one focused container for several isolated Transmission and
OpenVPN or WireGuard connections, with one modern web interface. It combines safe
defaults and familiar workflows with the operational depth experienced users expect,
organizing advanced capabilities instead of removing them for visual simplicity.

## Product Direction

### Principles

- **Familiar first** - Core navigation and torrent actions should feel immediately
  recognizable to current Transmission users without copying an outdated theme.
- **Professional depth** - The interface should preserve complete torrent, session, and
  diagnostic workflows instead of equating modern design with fewer capabilities.
- **Calm by default** - The main interface should emphasize torrent state, transfer
  progress, VPN health, and the actions people use most often without hiding deeper
  controls.
- **Advanced without disorder** - Advanced controls should remain available through
  purposeful grouping, contextual help, and progressive disclosure.
- **Safety should be visible** - VPN connection and leak-protection state should be easy
  to understand without requiring users to read logs.
- **Functionality before novelty** - The modern theme should preserve the useful daily
  capabilities currently supplied by `transmission-web-control`, then improve their
  presentation rather than adding novelty for its own sake.

### Scope

- A portable Docker image rather than a Synology-specific host script.
- One or more VPN connections at once, each with its own Transmission, OpenVPN or
  WireGuard tunnel, and fail-closed traffic path.
- s6-overlay supervision for container initialization, services, and shutdown.
- A bundled, maintained web interface with a modern but familiar visual language.
- UI-managed Transmission, provider, endpoint, and health configuration.
- PureVPN, Private Internet Access, IPVanish, NordVPN, Surfshark, IVPN, Mullvad, and
  custom provider paths, over OpenVPN or WireGuard as each provider supports.
- Persistent configuration and download storage suitable for self-hosted deployments.
- Clear combined and per-connection VPN and Transmission health reporting.
- Alerts to services such as ntfy, Telegram, Discord, and email when a VPN connection
  drops or recovers and when torrents finish or fail.
- An opt-in HTTP and SOCKS5 web proxy, behind its own usernames and passwords, that lets
  each login use a selected VPN connection under the same fail-closed rules as
  Transmission.
- Torrent profiles: every torrent belongs to one profile that owns its VPN connection and
  download folder and supplies labels, paused state, seeding, speed, priority, peer, and
  queue options; named profiles match torrent names, while the Default profile catches
  everything unmatched.
- Multi-architecture image publishing for common home-server platforms.

### Explicit Non-Goals

- Preserving the implementation or assumptions of the legacy Synology script.
- Matching every feature exposed by larger competing Transmission and VPN images.
- Carrying forward or forking the deprecated `transmission-web-control` codebase.
- Flattening every advanced control onto the primary torrent-management screen.
- Shipping a tunnel type before it passes the same fail-closed verification as OpenVPN.

## Product Design

### Core Capabilities

The product combines per-connection Transmission daemons, VPN routing and leak
protection, supervised container services, a control API, persistent validated
configuration, a maintained first-party web interface, and alert notifications.

### User Experience

Common torrent actions and VPN protection state stay visible, while complete settings
and diagnostic workflows remain available through clear grouping and progressive
disclosure.

## Positioning

### Alternatives

- [s6-overlay](https://github.com/just-containers/s6-overlay) provides the process
  supervision and lifecycle model.
- [Transmission RPC specification](https://github.com/transmission/transmission/blob/main/docs/rpc-spec.md)
  defines the daemon control surface.
- [Transmission Web Control](https://github.com/ronggang/transmission-web-control/wiki)
  is a functional reference only.

### Differentiators

| This project                                                    | Alternatives                                                   |
|-----------------------------------------------------------------|----------------------------------------------------------------|
| Familiar, full-capability interface with deliberate hierarchy   | Minimal clients that omit advanced Transmission workflows      |
| UI-managed settings with clear live and restart behavior        | Large environment-variable surfaces reapplied on every startup |
| VPN safety and status treated as part of the user experience    | VPN state primarily communicated through container logs        |
| Provider adapters separated from the OpenVPN and firewall core  | Provider-specific scripts intertwined with container startup   |
| Portable container design without Synology-specific assumptions | Host scripts coupled to one NAS platform                       |

## Risks and Future

### Open Questions

Do not treat these items as decided until their dedicated planning session. Later
product sessions should decide:

- Managed-document serialization beyond the initial versioned JSON contract.
- Compatibility exceptions required by specific third-party Transmission clients.
- Which additional OpenVPN or WireGuard providers ship next, how provider catalogs are
  distributed and updated over time, and the automatic provider catalog refresh
  cadence.
- Which automatic provider-specific forwarded-port integrations ship first.
- Container registry targets beyond the initial Nova publishing choice.
- Which remaining advanced workflows in the roadmap below enter each release.
- The exact browser support range, localization strategy, and plugin or extension model.

These choices must preserve the accepted boundaries in `PROJECT_RULES.md`. Resolving
one should update this file and `PROJECT_RULES.md` before implementation depends on it.

### Roadmap

#### Delivery Sequence

1. Establish the s6 service skeleton, storage layout, and fail-closed network tests.
2. Implement the versioned configuration contract and control API boundary.
3. Add custom OpenVPN profiles, maintained provider catalogs, and endpoint pools.
4. Integrate Transmission and its version-aware RPC adapter.
5. Maintain the functional UI inventory as production screens are implemented.
6. Build and verify the React interface against the real control API contracts.
7. Complete reconnect, migration, security, and multi-architecture release testing.

#### Interface Depth Still to Add

These workflows remain part of the product boundary but are not represented as complete
controls in the first production interface slice:

- Large-list virtualization and saved compound filters.
- Alternate speed controls and direct peer-management actions beyond peer telemetry.
- Full session capability negotiation and any advanced Transmission setting not yet in
  the application registry.
- Blocklist merge history.
- Storage capacity validation, configuration export and backup, migration preview,
  rollback history, and guided recovery actions.
- Deeper VPN health and DNS diagnostics, endpoint-pool policy editing, and future
  provider capability screens.
- Browser compatibility certification, localization, keyboard shortcuts, and extension
  points.

## Marketing Copy

### Tagline

A familiar Transmission experience, secured behind a VPN.

### Elevator Pitch

Transmission VPN is a focused Docker image that runs several isolated Transmission and
VPN connections and makes their health easy to understand. It pairs leak-conscious
networking with a modern web interface that keeps familiar torrent workflows close at
hand. The project chooses clear defaults and thoughtful progressive disclosure instead
of competing on the number of switches it can expose.

### Key Features

- **Several VPN connections** - Runs one Transmission and isolated fail-closed tunnel
  per connection, with a default for **Default profile** and unmatched adds plus shared DNS.
- **Modern familiar interface** - Reimagines the useful workflows associated with
  `transmission-web-control` in a maintained, full-capability interface that still feels
  like Transmission.
- **Visible connection health** - Surfaces combined and per-connection VPN and
  torrent-service state so users can see what is protected, partial, or blocked.
- **Alerts when it matters** - Sends a notification when a VPN connection drops or
  comes back and when a torrent finishes or fails, through ntfy, Telegram, Discord,
  email, and other services.
- **Torrent profiles** - Gives every torrent one profile that owns its VPN connection and
  unique folder, plus reusable label, seeding, speed, priority, peer, and queue settings.
- **Private-network web proxy** - Lets each authenticated HTTP or SOCKS5 login select a
  VPN connection or follow the default.
- **Separate remote app logins** - Gives each Transmission-compatible app its own RPC
  username and password and one combined torrent view across connections.
- **UI-owned configuration** - Moves routine Transmission, VPN, and provider settings out
  of long environment-variable lists and into validated, persistent controls.
- **Portable container delivery** - Replaces host-specific scripting with a repeatable,
  multi-architecture Docker image.

## Glossary

| Term                     | Definition                                                                                                      |
|--------------------------|-----------------------------------------------------------------------------------------------------------------|
| Familiar interface       | An interface that preserves recognizable Transmission concepts and workflows without copying an existing theme. |
| Modern theme             | The maintained React and custom-CSS visual layer bundled with the project.                                      |
| Progressive disclosure   | Presenting common actions first and revealing advanced controls only when users request them.                   |
| Fail-closed              | Preventing a Transmission's traffic from leaving through a non-VPN route when its connection is unavailable.    |
| Control plane            | The API and UI that manage Transmission, VPN configuration, health, and recovery.                               |
| Provider adapter         | A bounded integration that supplies OpenVPN or WireGuard profiles, endpoints, credentials, and capabilities.    |
| VPN connection           | One isolated tunnel, Transmission daemon, peer port, and torrent owner inside the container.                    |
| Default connection       | The connection used for **Default profile** and unmatched adds and DNS for every Transmission.                  |
| Web proxy                | The authenticated HTTP and SOCKS5 service that routes each login through its selected VPN connection.           |
| Torrent profile          | One torrent's VPN connection, unique folder, labels, limits, and library organization.                          |
| Default profile          | The fixed first profile that receives unmatched torrents and uses the default connection.                       |
| Label                    | A free-form torrent tag that can change without changing its profile, folder, or VPN connection.                |
| RPC login                | A remote app's username and generated password, accepted only by the compatible RPC route.                      |
| Notification destination | One place alerts go, such as an ntfy topic, a Telegram chat, or an email inbox, with the events it receives.    |
| Legacy project           | The current Synology-oriented script implementation retained only as behavioral and historical reference.       |

## Additional Vision Notes

### Current Context

> The runtime architecture and maintained feature inventory are defined in
> `PROJECT_RULES.md`. The responsive first-party interface uses React and TypeScript
> with a custom visual system.
