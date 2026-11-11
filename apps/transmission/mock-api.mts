import {
  createHash,
  randomBytes,
} from 'node:crypto';

import type {
  IncomingMessage,
  ServerResponse,
} from 'node:http';

import type { Plugin } from 'vite';

/**
 * Mock API - Mock notification service.
 *
 * Names this local contract so fixtures and handlers agree.
 * Keeping one shape prevents the surrounding workflow from drifting.
 *
 * @since 2.0.0
 */
type MockNotificationService = 'apprise' | 'discord' | 'email' | 'gotify' | 'matrix' | 'ntfy' | 'ntfy-reverse-proxy' | 'pushover' | 'slack' | 'telegram' | 'webhook';

/**
 * Mock API - Mock notification.
 *
 * Names this local contract so fixtures and handlers agree.
 * Keeping one shape prevents the surrounding workflow from drifting.
 *
 * @since 2.0.0
 */
type MockNotification = {
  createdAt: string
  events: string[]
  id: string
  lastAttemptAt: string | null
  lastError: string | null
  lastErrorDetails: string | null
  name: string
  secrets: Record<string, true>
  secretsMissing: string[]
  service: MockNotificationService
  settings: Record<string, string>
  updatedAt: string
};

// MockNotificationField is one service field: [key, message when missing, secret, required].

/**
 * Mock API - Mock notification field.
 *
 * Names this local contract so fixtures and handlers agree.
 * Keeping one shape prevents the surrounding workflow from drifting.
 *
 * @since 2.0.0
 */
type MockNotificationField = [string, string, boolean, boolean];

// MockNotificationInput is a checked create or edit body, with the optional secrets to clear.

/**
 * Mock API - Mock notification input.
 *
 * Names this local contract so fixtures and handlers agree.
 * Keeping one shape prevents the surrounding workflow from drifting.
 *
 * @since 2.0.0
 */
type MockNotificationInput = Pick<MockNotification, 'events' | 'name' | 'secrets' | 'service' | 'settings'> & {
  clearSecrets: string[]
};

/**
 * Mock API - Mock RPC login.
 *
 * Stores safe RPC login metadata without retaining generated plaintext passwords.
 * Matches the public fields returned by the control API.
 *
 * @since 2.0.0
 */
type MockRPCLogin = {
  createdAt: string
  id: string
  lastUsedAt: string | null
  username: string
};

/**
 * Mock API - Blocklist source status.
 *
 * Mirrors the runner-owned per-source observation exposed by the versioned API.
 * Failed sources may retain ranges and identify the last-good copy still in use.
 *
 * @since 2.0.0
 */
type MockBlocklistSourceStatus = {
  copyFrom?: string
  error?: string
  ranges: number
  state: 'error' | 'ok' | 'pending'
  updatedAt?: string
  url: string
};

/**
 * Mock API - Blocklist status.
 *
 * Provides realistic aggregate scheduling data for the backend contract without
 * describing or implementing the console presentation that still awaits approval.
 *
 * @since 2.0.0
 */
type MockBlocklistStatus = {
  lastAttemptAt?: string
  lastSuccessAt?: string
  nextUpdateAt?: string
  sources: MockBlocklistSourceStatus[]
  state: 'disabled' | 'idle' | 'no-sources' | 'updating' | 'waiting-for-vpn'
  totalRanges: number
};

/**
 * Mock API - Mock web proxy login.
 *
 * Mirrors the safe login view returned by the control API.
 * Generated passwords appear only in create and regenerate responses.
 *
 * @since 2.0.0
 */
type MockWebProxyLogin = {
  connectionId: string | null
  id: string
  passwordSet: boolean
  username: string
};

/**
 * Mock API - Backup import source item.
 *
 * Keeps the saved torrent intent needed to derive changing public job progress.
 * The source document itself is not retained after the mock job is created.
 *
 * @since 2.0.0
 */
type MockBackupImportSourceItem = {
  complete: boolean
  duplicate: boolean
  folder: string
  hash: string
  missing: boolean
  name: string
  paused: boolean
  profileName: string
};

/**
 * Mock API - Backup import.
 *
 * Stores the minimum durable-job simulation state for the standalone console mock.
 * Public responses are recomputed from elapsed time so polling visibly advances.
 *
 * @since 2.0.0
 */
type MockBackupImport = {
  actions: string[]
  createdAt: string
  id: string
  items: MockBackupImportSourceItem[]
  profileCount: number
  settingCount: number
  source: 'another-transmission' | 'transmission-vpn-export'
  startedAtMilliseconds: number
  totalSizeBytes: number
};

/**
 * Mock API - Backup merge result.
 *
 * Keeps preview and apply counts in one shape so both surfaces use identical copy.
 * Capacity and duplicate skips remain separate because they explain different causes.
 *
 * @since 2.0.0
 */
type MockBackupMergeResult = {
  apiTokenAdditions: number
  apiTokenDuplicateSkips: number
  apiTokenMaximumSkips: number
  notificationAdditions: number
  notificationMaximumSkips: number
  notificationReplacements: number
  rpcLoginAdditions: number
  rpcLoginMaximumSkips: number
  rpcLoginReplacements: number
};

/**
 * Mock API - Mock VPN connection.
 *
 * Stores one durable connection and its controller and daemon state.
 * The shape follows the multi-connection API contract used by the console.
 *
 * @since 2.0.0
 */
type MockVPNConnection = {
  changeRunning: boolean
  createdAt: string
  daemon: {
    bindAddress: string
    peerPort: number
    rpcPort: number
    state: 'exited' | 'missing' | 'ready' | 'starting'
  }
  default: boolean
  dnsServers: string[]
  enabled: boolean
  endpointStrategy: 'ordered' | 'randomized' | 'sticky'
  id: string
  name: string
  needsSetup: boolean
  peerPort: number
  profileIds: string[]
  providerId: string
  revision: number
  retryIntervalSeconds: number
  savedCredentials: string[]
  runtime: Record<string, unknown>
  slot: number
  tunnel: 'openvpn' | 'wireguard'
  updatedAt: string
};

/**
 * Mock API - Mock VPN credential field.
 *
 * Keeps the provider metadata needed to validate required mock sign-in fields.
 * Credential values remain in a separate private map and never enter responses.
 *
 * @since 2.0.0
 */
type MockVPNCredentialField = {
  key: string
  label: string
  required: boolean
};

/**
 * Mock API - Mock torrent.
 *
 * Names this local contract so fixtures and handlers agree.
 * Keeping one shape prevents the surrounding workflow from drifting.
 *
 * @since 2.0.0
 */
type MockTorrent = {
  'activityDate': number
  'addedDate': number
  'bandwidthPriority': -1 | 0 | 1
  'comment': string
  'connectionId': string
  'doneDate': number
  'downloadDir': string
  'downloadLimit': number
  'downloadLimited': boolean
  'downloadedEver': number
  'error': number
  'errorString': string
  'eta': number
  'hashString': string
  'honorsSessionLimits': boolean
  'id': number
  'isFinished': boolean
  'isPrivate': boolean
  'isStalled': boolean
  'labels': string[]
  'leftUntilDone': number
  'metadataPercentComplete': number
  'name': string
  'needsProfile': {
    profileIds: string[]
  } | null
  'peersConnected': number
  'peersGettingFromUs': number
  'peersSendingToUs': number
  'percentDone': number
  'peer-limit': number
  'profileId': string | null
  'queuePosition': number
  'rateDownload': number
  'rateUpload': number
  'recheckProgress': number
  'secondsDownloading': number
  'secondsSeeding': number
  'seedIdleLimit': number
  'seedIdleMode': 0 | 1 | 2
  'seedRatioLimit': number
  'seedRatioMode': 0 | 1 | 2
  'sizeWhenDone': number
  'status': number
  'totalSize': number
  'uploadedEver': number
  'uploadLimit': number
  'uploadLimited': boolean
  'uploadRatio': number
};

/**
 * Mock API - Mock torrent profile.
 *
 * Mirrors the application-owned profile returned by the control API.
 * The in-memory collection supports CRUD, overlaps, and torrent assignment.
 *
 * @since 2.0.0
 */
type MockTorrentProfile = {
  connectionId: string | null
  createdAt: string
  downloadDirectory: string
  id: string
  labels: string[]
  matchPatterns: string[]
  name: string
  overlaps: {
    ownPattern: string
    pattern: string
    profileId: string
    profileName: string
  }[]
  options: {
    bandwidthPriority: -1 | 0 | 1
    downloadLimitKBps: number | null
    peerLimit: number
    queue: 'normal' | 'top'
    seeding: {
      idleMinutes: number | null
      mode: 'limit' | 'never'
      ratio: number | null
    }
    uploadLimitKBps: number | null
  }
  startPaused: boolean
  updatedAt: string
};

/**
 * Mock API - Mock Default torrent profile.
 *
 * Stores the editable Default profile fields and its managed-folder state.
 * Named-profile identity and matching fields are intentionally absent.
 *
 * @since 2.0.0
 */
type MockDefaultTorrentProfile = Pick<MockTorrentProfile, 'downloadDirectory' | 'labels' | 'name' | 'options' | 'startPaused'> & {
  downloadDirectoryLocked: boolean
};

/**
 * Mock API - Mock directory metadata.
 *
 * Records the controller facts that are not derivable from the folder path alone.
 * Child relationships remain implicit in the keyed in-memory tree.
 *
 * @since 2.0.0
 */
type MockDirectoryMetadata = {
  files: number
  mountPoint: boolean
  readable: boolean
};

/**
 * Mock API - Mock directory purpose.
 *
 * Keeps purpose validation and policy evaluation on the contract's closed vocabulary.
 * Both GET and DELETE share this exact type.
 *
 * @since 2.0.0
 */
type MockDirectoryPurpose = 'download' | 'incomplete' | 'profile';

/**
 * Mock API - Mock directory deletion policy.
 *
 * Carries the first matching advisory rule into listing and delete responses.
 * The code distinguishes assigned-folder conflicts from non-empty folders.
 *
 * @since 2.0.0
 */
type MockDirectoryDeletionPolicy = {
  code: 'directory_browser_unavailable' | 'directory_in_use' | 'directory_not_empty' | 'torrent_locations_unavailable' | ''
  message: string
};

/**
 * Mock API - Mock torrent link preview.
 *
 * Mirrors the protected preview route fields used by the Add torrent dialog.
 * Magnet links omit total size in the same way as the control API.
 *
 * @since 2.0.0
 */
type MockTorrentLinkPreview = {
  hash: string
  index: number
  name: string
  totalSize?: number
};

/**
 * Mock API - Mock torrent seed.
 *
 * Names this local contract so fixtures and handlers agree.
 * Keeping one shape prevents the surrounding workflow from drifting.
 *
 * @since 2.0.0
 */
type MockTorrentSeed = {
  comment?: string
  dir: string
  error?: string
  labels: string[]
  name: string
  percent: number
  privateTracker?: boolean
  size: number
  status: number
};

/**
 * Mock API - Gibibyte.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const gibibyte: number = 1024 * 1024 * 1024;

/**
 * Mock API - Download data path root message.
 *
 * Keeps mock destination failures aligned with the control API and console.
 * Every affected mock route reuses this exact corrective guidance.
 *
 * @since 2.0.0
 */
const downloadDataPathRootMessage: string = 'Choose a folder inside /data, not /data itself.';

/**
 * Mock API - Checks download data root.
 *
 * Treats trailing slashes like the control API's path normalization does.
 * Non-string values remain available to the mock's existing validation flow.
 *
 * @since 2.0.0
 */
const isDownloadDataRoot = (value: unknown): boolean => (
  typeof value === 'string' && value.replace(/\/+$/u, '') === '/data'
);

/**
 * Mock API - Checks path containment.
 *
 * A slash boundary mirrors the control API's path-segment comparison and keeps
 * similarly prefixed sibling folders independent.
 *
 * @since 2.0.0
 */
const dataPathContains = (parentPath: string, candidatePath: string): boolean => {
  const parent: string = parentPath.replace(/\/+$/u, '');
  const candidate: string = candidatePath.replace(/\/+$/u, '');

  return candidate === parent || candidate.startsWith(`${parent}/`);
};

/**
 * Mock API - Checks path containment ignoring case.
 *
 * Deletion protects assigned paths on case-insensitive storage without changing
 * the case-sensitive navigation behavior of the in-memory directory map.
 *
 * @since 2.0.0
 */
const dataPathContainsIgnoringCase = (parentPath: string, candidatePath: string): boolean => dataPathContains(
  parentPath.toLocaleLowerCase('en-US'),
  candidatePath.toLocaleLowerCase('en-US'),
);

/**
 * Mock API - Checks path equality ignoring case.
 *
 * The first seven deletion rules share the production contract's case-folded
 * comparisons while later controller facts continue to use exact paths.
 *
 * @since 2.0.0
 */
const dataPathsEqualIgnoringCase = (firstPath: string, secondPath: string): boolean => (
  firstPath.toLocaleLowerCase('en-US') === secondPath.toLocaleLowerCase('en-US')
);

/**
 * Mock API - Duplicate torrent enabled.
 *
 * Adds the same hash on two VPN connections so the console's quiet duplicate
 * notice can be exercised without changing the normal screenshot fixtures.
 *
 * @since 2.0.0
 */
const duplicateTorrentEnabled: boolean = process.env['MOCK_DUPLICATE_TORRENT'] === 'true';

/**
 * Mock API - No VPN connections.
 *
 * Produces the first-run torrent and web-proxy states without changing the normal
 * screenshot fixture.
 *
 * @since 2.0.0
 */
const noVPNConnections: boolean = process.env['MOCK_NO_VPN_CONNECTIONS'] === 'true';

/**
 * Mock API - Torrent add outcome.
 *
 * Supports failed and alternating mixed batches for dialog result checks. The normal
 * fixture continues to add every valid source.
 *
 * @since 2.0.0
 */
const torrentAddOutcome: string = process.env['MOCK_TORRENT_ADD_OUTCOME'] ?? 'success';

/**
 * Mock API - Torrent add attempt.
 *
 * Counts requests so the mixed outcome alternates deterministically.
 * The counter starts fresh with each mock process.
 *
 * @since 2.0.0
 */
let torrentAddAttempt: number = 0;

/**
 * Mock API - Notification transport error.
 *
 * Produces a refused connection with safe wording and expandable raw diagnostics.
 * The normal fixture keeps its existing HTTP failure.
 *
 * @since 2.0.0
 */
const notificationTransportError: boolean = process.env['MOCK_NOTIFICATION_TRANSPORT_ERROR'] === 'true';

/**
 * Mock API - Raw notification transport error.
 *
 * Matches the diagnostic returned by a refused local TCP connection.
 * The public fixture keeps it separate from the plain-language message.
 *
 * @since 2.0.0
 */
const rawNotificationTransportError: string = 'dial tcp 127.0.0.1:9: connect: connection refused';

/**
 * Mock API - VPN test failure message.
 *
 * Mirrors the control API's secret-free fallback for an unclassified failure.
 * The mock never returns its internal controller diagnostic to the console.
 *
 * @since 2.0.0
 */
const mockVPNTestFailureMessage: string = 'The VPN connection couldn\'t be verified. Check its endpoints and credentials, then try again.';

/**
 * Mock API - Notification transport failure.
 *
 * Mirrors the control API's host-specific wording for common delivery errors.
 * It falls back to the original already-public sender message when unclassified.
 *
 * @since 2.0.0
 */
const mockNotificationTransportFailure = (raw: string): string => {
  const lookupHost: string | undefined = raw.match(/lookup\s+([^\s:]+)/iu)?.[1];
  if (lookupHost !== undefined && /no such host|name or service not known|temporary failure in name resolution/iu.test(raw)) {
    return `Couldn't find ${lookupHost}. Check the address.`;
  }

  const transportHost: string | undefined = raw.match(/(?:dial|read) tcp\s+\[?([^\]\s:]+)\]?(?::\d+)?/iu)?.[1];
  if (/connection refused/iu.test(raw)) {
    return (transportHost === undefined) ? 'The destination refused the connection.' : `${transportHost} refused the connection. Check the address.`;
  }
  if (/context deadline exceeded|i\/o timeout|timed out/iu.test(raw)) {
    return (transportHost === undefined) ? 'The destination timed out.' : `No reply from ${transportHost}. Check the address.`;
  }
  if (/tls:|x509:|certificate/iu.test(raw)) {
    return (transportHost === undefined) ? 'The secure connection to the destination failed.' : `The secure connection to ${transportHost} failed. Check its certificate.`;
  }

  return raw;
};

/**
 * Mock API - Northwind connection identifier.
 *
 * Keeps fixture relationships stable across torrents, profiles, and logins.
 * The hexadecimal suffix follows the production identifier format.
 *
 * @since 2.0.0
 */
const northwindConnectionId: string = 'vpc-0000000000000000';

/**
 * Mock API - Fabrikam connection identifier.
 *
 * Keeps fixture relationships stable across torrents, profiles, and logins.
 * The hexadecimal suffix follows the production identifier format.
 *
 * @since 2.0.0
 */
const fabrikamConnectionId: string = 'vpc-0000000000000001';

/**
 * Mock API - Contoso connection identifier.
 *
 * Keeps fixture relationships stable across torrents, profiles, and logins.
 * The hexadecimal suffix follows the production identifier format.
 *
 * @since 2.0.0
 */
const contosoConnectionId: string = 'vpc-0000000000000002';

/**
 * Mock API - Connection being removed identifier.
 *
 * Lets browser checks reproduce the stable conflict while targeting Fabrikam.
 * The normal mock remains fully mutable when the environment flag is absent.
 *
 * @since 2.0.0
 */
const connectionBeingRemovedId: string | null = (process.env['MOCK_CONNECTION_BEING_REMOVED'] === 'true') ? fabrikamConnectionId : null;

/**
 * Mock API - Torrent move warnings.
 *
 * Adds a successful post-move warning to every move result for browser checks.
 * The result remains moved, matching the backend's final-placement contract.
 *
 * @since 2.0.0
 */
const torrentMoveWarnings: string[] = (process.env['MOCK_VPN_MOVE_WARNING'] === 'true') ? ['The torrent moved, but the mock restart check could not confirm that it resumed.'] : [];

/**
 * Mock API - Missing web proxy connection identifier.
 *
 * Reproduces a durable login whose former explicit connection was removed.
 * The public response safely resolves it through the current default.
 *
 * @since 2.0.0
 */
const missingWebProxyConnectionId: string = 'vpc-ffffffffffffffff';

/**
 * Mock API - Torrent seeds.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const torrentSeeds: MockTorrentSeed[] = [
  {
    comment: 'Ubuntu CD releases.ubuntu.com',
    dir: '/data/linux',
    labels: ['linux'],
    name: 'ubuntu-24.04.2-desktop-amd64.iso',
    percent: 0.62,
    size: Math.round(6.1 * gibibyte),
    status: 4,
  },
  {
    comment: 'Debian CD from cdimage.debian.org',
    dir: '/data/linux',
    labels: ['linux'],
    name: 'debian-13.1.0-amd64-DVD-1.iso',
    percent: 1,
    size: Math.round(3.9 * gibibyte),
    status: 6,
  },
  {
    dir: '/data/linux',
    labels: [
      'linux',
      'arm',
    ],
    name: 'Fedora-Workstation-Live-aarch64-42-1.1.iso',
    percent: 0.18,
    size: Math.round(2.4 * gibibyte),
    status: 4,
  },
  {
    dir: '/data/movies',
    labels: ['public-domain'],
    name: 'Night of the Living Dead (1968) [Restored 4K]',
    percent: 1,
    size: Math.round(18.2 * gibibyte),
    status: 6,
  },
  {
    dir: '/data/movies',
    labels: ['public-domain'],
    name: 'Big Buck Bunny (2008) 2160p 60fps',
    percent: 1,
    size: Math.round(0.85 * gibibyte),
    status: 0,
  },
  {
    dir: '/data/audio',
    labels: ['music'],
    name: 'Kevin MacLeod - Royalty Free Collection Vol. 3 (FLAC)',
    percent: 0.94,
    size: Math.round(1.3 * gibibyte),
    status: 4,
  },
  {
    comment: 'Arch Linux 2026.10.01 <https://archlinux.org>',
    dir: '/data/downloads',
    labels: [],
    name: 'archlinux-2026.10.01-x86_64.iso',
    percent: 0,
    size: Math.round(1.2 * gibibyte),
    status: 3,
  },
  {
    dir: '/data/datasets',
    labels: ['research'],
    name: 'wikipedia-en-all-maxi-2026-09.zim',
    percent: 0.41,
    privateTracker: true,
    size: Math.round(102 * gibibyte),
    status: 4,
  },
  {
    dir: '/data/datasets',
    error: 'torrent not registered with this tracker',
    labels: ['research'],
    name: 'OpenStreetMap planet-260928.osm.pbf',
    percent: 0.07,
    privateTracker: true,
    size: Math.round(84 * gibibyte),
    status: 0,
  },
  {
    dir: '/data/movies',
    labels: ['public-domain'],
    name: 'Sintel (2010) 4K Open Movie',
    percent: 1,
    size: Math.round(4.7 * gibibyte),
    status: 6,
  },
  {
    dir: '/data/linux',
    labels: ['linux'],
    name: 'linuxmint-22.2-cinnamon-64bit.iso',
    percent: 1,
    size: Math.round(2.9 * gibibyte),
    status: 2,
  },
  {
    dir: '/data/audio',
    labels: ['music'],
    name: 'Internet Archive - 78rpm Jazz Transfers (Lossless)',
    percent: 0.33,
    size: Math.round(6.6 * gibibyte),
    status: 0,
  },
  {
    dir: '/data/downloads',
    labels: [],
    name: 'Example.Show.S01E04.2160p',
    percent: 0.12,
    size: Math.round(2.1 * gibibyte),
    status: 0,
  },
];

// Each torrent was added a few days ago and downloaded at about 1.5 MiB/s; finished ones have
// seeded since. Hashes are SHA-1s of the names, so they look like real info hashes.

/**
 * Mock API - Creates torrents.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const createTorrents = (): MockTorrent[] => torrentSeeds.map((seed: MockTorrentSeed, index: number): MockTorrent => {
  const now: number = Math.floor(Date.now() / 1000);
  const downloaded: number = Math.round(seed['size'] * seed['percent']);
  const uploaded: number = Math.round(downloaded * (((index % 4) * 0.45) + 0.2));
  const addedDate: number = now - ((index + 2) * 86400) - (((index * 5) % 12) * 3600);
  const secondsDownloading: number = Math.round(downloaded / (1.5 * 1024 * 1024));
  const doneDate: number = (seed['percent'] >= 1) ? addedDate + secondsDownloading : 0;
  let connectionId: string = northwindConnectionId;
  if (index < 3) {
    connectionId = contosoConnectionId;
  } else if (index < 7) {
    connectionId = fabrikamConnectionId;
  }

  return {
    'activityDate': now - (index * 600),
    addedDate,
    'bandwidthPriority': 0,
    'comment': seed['comment'] ?? '',
    connectionId,
    doneDate,
    'downloadDir': seed['dir'],
    'downloadLimit': 0,
    'downloadLimited': false,
    'downloadedEver': downloaded,
    'error': (seed['error'] === undefined) ? 0 : 2,
    'errorString': seed['error'] ?? '',
    'eta': -1,
    'hashString': createHash('sha1').update(seed['name']).digest('hex'),
    'honorsSessionLimits': true,
    'id': index + 1,
    'isFinished': seed['percent'] >= 1 && seed['status'] === 0,
    'isPrivate': seed['privateTracker'] === true,
    'isStalled': seed['status'] === 4 && index === 5,
    'labels': seed['labels'],
    'leftUntilDone': seed['size'] - downloaded,
    'metadataPercentComplete': 1,
    'name': seed['name'],
    'needsProfile': null,
    'peersConnected': 0,
    'peersGettingFromUs': 0,
    'peersSendingToUs': 0,
    'percentDone': seed['percent'],
    'peer-limit': 50,
    'profileId': null,
    'queuePosition': index,
    'rateDownload': 0,
    'rateUpload': 0,
    'recheckProgress': (seed['status'] === 2) ? 0.55 : 0,
    secondsDownloading,
    'secondsSeeding': (doneDate === 0) ? 0 : now - doneDate,
    'seedIdleLimit': 30,
    'seedIdleMode': 0,
    'seedRatioLimit': 2,
    'seedRatioMode': 0,
    'sizeWhenDone': seed['size'],
    'status': seed['status'],
    'totalSize': seed['size'],
    'uploadedEver': uploaded,
    'uploadLimit': 0,
    'uploadLimited': false,
    'uploadRatio': (downloaded === 0) ? -1 : uploaded / downloaded,
  };
});

/**
 * Mock API - Pieces.
 *
 * Builds the piece map for a torrent's details from its progress. Pieces arrive in runs,
 * and the stalled torrent keeps a stretch near the end that no connected peer has.
 *
 * @since 2.0.0
 */
const mockPieces = (torrent: MockTorrent): Record<string, unknown> => {
  const pieceSize: number = (torrent['sizeWhenDone'] > 8 * gibibyte) ? 8 * 1024 * 1024 : 2 * 1024 * 1024;
  const pieceCount: number = Math.max(1, Math.ceil(torrent['sizeWhenDone'] / pieceSize));
  const target: number = Math.round(pieceCount * torrent['percentDone']);
  const have: boolean[] = Array.from({ length: pieceCount }, (): boolean => torrent['percentDone'] >= 1);
  let seed: number = torrent['id'] * 7919;
  let filled: number = have.filter(Boolean).length;

  /**
   * Mock API - Pieces random.
   *
   * Repeats the same pieces for a torrent every time the mock starts.
   * A plain linear congruential generator is enough for sample data.
   *
   * @since 2.0.0
   */
  const random = (): number => {
    seed = ((seed * 1103515245) + 12345) % 2147483648;

    return seed / 2147483648;
  };

  while (filled < target) {
    const start: number = Math.floor(random() * pieceCount);
    const end: number = Math.min(pieceCount, start + 6 + Math.floor(random() * 42));

    for (let index = start; index < end && filled < target; index += 1) {
      if (have[index] === false) {
        have[index] = true;
        filled += 1;
      }
    }
  }

  const bytes: number[] = Array.from({ length: Math.ceil(pieceCount / 8) }, (): number => 0);

  have.forEach((owned: boolean, index: number): void => {
    if (owned) {
      bytes[Math.floor(index / 8)] = (bytes[Math.floor(index / 8)] ?? 0) + (2 ** (7 - (index % 8)));
    }
  });

  return {
    availability: have.map((owned: boolean, index: number): number => {
      if (owned) {
        return -1;
      }

      return (torrent['isStalled'] && index > pieceCount * 0.86 && index < pieceCount * 0.9) ? 0 : 1 + Math.floor(random() * 12);
    }),
    pieceCount,
    pieceSize,
    pieces: Buffer.from(bytes).toString('base64'),
  };
};

/**
 * Mock API - Torrent profiles.
 *
 * Provides representative automatic matching and profile-assignment state.
 * Named profiles are returned alphabetically and overlapping patterns are allowed.
 *
 * @since 2.0.0
 */
const torrentProfiles: MockTorrentProfile[] = [
  {
    connectionId: fabrikamConnectionId,
    createdAt: '2026-10-01T12:00:00Z',
    downloadDirectory: '/data/media/shows',
    id: 'tpr-0000000000000001',
    labels: ['TV'],
    matchPatterns: [
      '*S??E??*',
      '*season*',
    ],
    name: 'TV',
    overlaps: [],
    options: {
      bandwidthPriority: 1,
      downloadLimitKBps: 2500,
      peerLimit: 50,
      queue: 'top',
      seeding: {
        idleMinutes: 30,
        mode: 'limit',
        ratio: 2,
      },
      uploadLimitKBps: 500,
    },
    startPaused: true,
    updatedAt: '2026-10-01T12:00:00Z',
  },
  {
    connectionId: fabrikamConnectionId,
    createdAt: '2026-10-01T12:01:00Z',
    downloadDirectory: '/data/movies',
    id: 'tpr-0000000000000002',
    labels: ['Movies'],
    matchPatterns: [
      '*2160p*',
      '*movie*',
      '*S01E*',
    ],
    name: 'Movies',
    overlaps: [],
    options: {
      bandwidthPriority: 0,
      downloadLimitKBps: null,
      peerLimit: 80,
      queue: 'normal',
      seeding: {
        idleMinutes: null,
        mode: 'limit',
        ratio: 2,
      },
      uploadLimitKBps: 750,
    },
    startPaused: false,
    updatedAt: '2026-10-01T12:01:00Z',
  },
  {
    connectionId: contosoConnectionId,
    createdAt: '2026-10-01T12:02:00Z',
    downloadDirectory: '/data/linux',
    id: 'tpr-0000000000000003',
    labels: ['linux'],
    matchPatterns: [
      '*ubuntu*',
      '*debian*',
      '*linux*',
      '*fedora*',
    ],
    name: 'Linux ISOs',
    overlaps: [],
    options: {
      bandwidthPriority: 0,
      downloadLimitKBps: null,
      peerLimit: 50,
      queue: 'normal',
      seeding: {
        idleMinutes: null,
        mode: 'never',
        ratio: null,
      },
      uploadLimitKBps: null,
    },
    startPaused: false,
    updatedAt: '2026-10-01T12:02:00Z',
  },
  {
    connectionId: fabrikamConnectionId,
    createdAt: '2026-10-01T12:03:00Z',
    downloadDirectory: '/data/audio',
    id: 'tpr-0000000000000004',
    labels: ['music'],
    matchPatterns: ['*FLAC*'],
    name: 'Music',
    overlaps: [],
    options: {
      bandwidthPriority: 0,
      downloadLimitKBps: null,
      peerLimit: 60,
      queue: 'normal',
      seeding: {
        idleMinutes: 60,
        mode: 'limit',
        ratio: null,
      },
      uploadLimitKBps: 500,
    },
    startPaused: false,
    updatedAt: '2026-10-01T12:03:00Z',
  },
  {
    connectionId: null,
    createdAt: '2026-10-01T12:04:00Z',
    downloadDirectory: '/data/datasets',
    id: 'tpr-0000000000000005',
    labels: ['research'],
    matchPatterns: [
      '*wikipedia*',
      '*OpenStreetMap*',
    ],
    name: 'Datasets',
    overlaps: [],
    options: {
      bandwidthPriority: -1,
      downloadLimitKBps: null,
      peerLimit: 40,
      queue: 'normal',
      seeding: {
        idleMinutes: null,
        mode: 'never',
        ratio: null,
      },
      uploadLimitKBps: 250,
    },
    startPaused: true,
    updatedAt: '2026-10-01T12:04:00Z',
  },
];

// MOCK_NESTED_PROFILE seeds a profile saved before the one-folder rule, inside the
// Default profile's folder, so the fix-it banner and refused adds can be exercised.
if (process.env['MOCK_NESTED_PROFILE'] === 'true') {
  torrentProfiles.push({
    connectionId: null,
    createdAt: '2026-10-01T12:05:00Z',
    downloadDirectory: '/data/downloads/archive',
    id: 'tpr-0000000000000006',
    labels: [],
    matchPatterns: [],
    name: 'Archive',
    overlaps: [],
    options: {
      bandwidthPriority: 0,
      downloadLimitKBps: null,
      peerLimit: 50,
      queue: 'normal',
      seeding: {
        idleMinutes: null,
        mode: 'never',
        ratio: null,
      },
      uploadLimitKBps: null,
    },
    startPaused: false,
    updatedAt: '2026-10-01T12:05:00Z',
  });
}

/**
 * Mock API - Checks torrent profile pattern overlap.
 *
 * Mirrors the control API's memoized product walk for `*`, `?`, and literal
 * characters so mock overlap notes follow the production language exactly.
 *
 * @since 2.0.0
 */
const torrentPatternsOverlap = (leftPattern: string, rightPattern: string): boolean => {
  const leftCharacters: string[] = [...leftPattern];
  const rightCharacters: string[] = [...rightPattern];
  const queue: [number, number][] = [[
    0,
    0,
  ]];
  const visited: Set<string> = new Set<string>();

  while (queue.length > 0) {
    const state: [number, number] | undefined = queue.shift();
    if (state === undefined) {
      continue;
    }
    const [
      leftIndex,
      rightIndex,
    ] = state;
    const stateKey: string = `${leftIndex}:${rightIndex}`;
    if (visited.has(stateKey)) {
      continue;
    }
    visited.add(stateKey);
    if (leftIndex === leftCharacters.length && rightIndex === rightCharacters.length) {
      return true;
    }
    const leftCharacter: string | undefined = leftCharacters[leftIndex];
    const rightCharacter: string | undefined = rightCharacters[rightIndex];
    const leftStar: boolean = leftCharacter === '*';
    const rightStar: boolean = rightCharacter === '*';
    if (leftStar) {
      queue.push([
        leftIndex + 1,
        rightIndex,
      ]);
    }
    if (rightStar) {
      queue.push([
        leftIndex,
        rightIndex + 1,
      ]);
    }
    if (leftCharacter === undefined || rightCharacter === undefined) {
      continue;
    }
    if (
      leftCharacter !== '*'
      && leftCharacter !== '?'
      && rightCharacter !== '*'
      && rightCharacter !== '?'
      && leftCharacter.toLocaleLowerCase() !== rightCharacter.toLocaleLowerCase()
    ) {
      continue;
    }
    const nextState: [number, number] = [
      (leftStar) ? leftIndex : leftIndex + 1,
      (rightStar) ? rightIndex : rightIndex + 1,
    ];
    if (nextState[0] !== leftIndex || nextState[1] !== rightIndex) {
      queue.push(nextState);
    }
  }

  return false;
};

/**
 * Mock API - Refreshes torrent profile presentation.
 *
 * Keeps named profiles alphabetized and rebuilds informational overlap pairs after
 * every in-memory create, edit, or delete.
 *
 * @since 2.0.0
 */
const refreshTorrentProfilePresentation = (): void => {
  torrentProfiles.sort((leftProfile: MockTorrentProfile, rightProfile: MockTorrentProfile): number => (
    leftProfile['name'].localeCompare(rightProfile['name'], undefined, { sensitivity: 'base' })
    || leftProfile['name'].localeCompare(rightProfile['name'])
  ));
  for (const profile of torrentProfiles) {
    profile.overlaps = torrentProfiles.flatMap((otherProfile: MockTorrentProfile): MockTorrentProfile['overlaps'] => {
      if (otherProfile['id'] === profile['id']) {
        return [];
      }

      return profile['matchPatterns'].flatMap((ownPattern: string): MockTorrentProfile['overlaps'] => (
        otherProfile['matchPatterns'].flatMap((otherPattern: string): MockTorrentProfile['overlaps'] => (
          (torrentPatternsOverlap(ownPattern, otherPattern)) ? [{
            ownPattern,
            pattern: otherPattern,
            profileId: otherProfile['id'],
            profileName: otherProfile['name'],
          }] : []
        ))
      ));
    });
  }
};

refreshTorrentProfilePresentation();

/**
 * Mock API - Default torrent profile.
 *
 * Mirrors the real Default profile that owns the Download directory and always
 * follows the default VPN connection.
 *
 * @since 2.0.0
 */
const defaultTorrentProfile: MockDefaultTorrentProfile = {
  downloadDirectory: '/data/downloads',
  downloadDirectoryLocked: process.env['MOCK_MANAGED_DOWNLOAD_DIRECTORY'] === 'true',
  labels: [],
  name: 'Default profile',
  options: {
    bandwidthPriority: 0,
    downloadLimitKBps: null,
    peerLimit: 50,
    queue: 'normal',
    seeding: {
      idleMinutes: null,
      mode: 'never',
      ratio: null,
    },
    uploadLimitKBps: null,
  },
  startPaused: false,
};

/**
 * Mock API - Profile folder owner.
 *
 * Finds the Default or named profile that owns a case-insensitively equal
 * folder, excluding the profile currently being edited.
 *
 * @since 2.0.0
 */
const profileFolderOwner = (
  directoryPath: string,
  excludedProfileID: string = '',
): {
  id: string
  name: string
  relation: 'contains' | 'inside' | 'same'
} | undefined => {
  /**
   * Mock API - Profile folder owner - Relation to.
   *
   * Compares the requested folder with one owner folder, ignoring case.
   * Returns same, inside, contains, or undefined when they are unrelated.
   *
   * @since 2.0.0
   */
  const relationTo = (ownerPath: string): 'contains' | 'inside' | 'same' | undefined => {
    if (dataPathsEqualIgnoringCase(ownerPath, directoryPath)) {
      return 'same';
    }
    if (dataPathContainsIgnoringCase(ownerPath, directoryPath)) {
      return 'inside';
    }
    if (dataPathContainsIgnoringCase(directoryPath, ownerPath)) {
      return 'contains';
    }

    return undefined;
  };
  if (excludedProfileID !== 'default') {
    // No profile folder may sit inside another profile's folder or contain one.
    const defaultRelation = relationTo(defaultTorrentProfile['downloadDirectory']);
    if (defaultRelation !== undefined) {
      return {
        id: 'default',
        name: defaultTorrentProfile['name'],
        relation: defaultRelation,
      };
    }
  }

  for (const candidate of torrentProfiles) {
    if (candidate['id'] === excludedProfileID) {
      continue;
    }
    const relation = relationTo(candidate['downloadDirectory']);
    if (relation === undefined) {
      continue;
    }

    return {
      id: candidate['id'],
      name: `${candidate['name']} profile`,
      relation,
    };
  }

  return undefined;
};

/**
 * Mock API - Profile folder overlaps.
 *
 * Lists every saved profile whose folder sits inside or around another profile's
 * folder, matching the control API's folderOverlaps list.
 *
 * @since 2.0.0
 */
const profileFolderOverlaps = (): {
  message: string
  profileId: string
  profileName: string
}[] => {
  const overlaps: {
    message: string
    profileId: string
    profileName: string
  }[] = [];
  const defaultOwner = profileFolderOwner(defaultTorrentProfile['downloadDirectory'], 'default');
  if (defaultOwner !== undefined) {
    overlaps.push({
      message: profileFolderTakenMessage(defaultTorrentProfile['downloadDirectory'], defaultOwner['name'], defaultOwner['relation']),
      profileId: 'default',
      profileName: defaultTorrentProfile['name'],
    });
  }
  for (const profile of torrentProfiles) {
    const owner = profileFolderOwner(profile['downloadDirectory'], profile['id']);
    if (owner !== undefined) {
      overlaps.push({
        message: profileFolderTakenMessage(profile['downloadDirectory'], owner['name'], owner['relation']),
        profileId: profile['id'],
        profileName: profile['name'],
      });
    }
  }

  return overlaps;
};

/**
 * Mock API - Profile folder taken message.
 *
 * Matches the backend's field error and curly-quoted folder name exactly.
 * Profile editors render this actionable text beside the folder field.
 *
 * @since 2.0.0
 */
const profileFolderTakenMessage = (
  directoryPath: string,
  ownerName: string,
  relation: 'contains' | 'inside' | 'same' = 'same',
): string => {
  const folderName: string = directoryPath.slice(directoryPath.lastIndexOf('/') + 1);
  if (relation === 'inside') {
    return `This folder is inside the ${ownerName}'s folder.`;
  }
  if (relation === 'contains') {
    return `This folder contains the ${ownerName}'s folder.`;
  }

  return `“${folderName}” is already the ${ownerName}'s folder.`;
};

/**
 * Mock API - Checks profile-name ownership.
 *
 * Mirrors the database's cross-table, case-insensitive uniqueness rule.
 * The excluded identity lets either editor retain its current spelling.
 *
 * @since 2.0.0
 */
const torrentProfileNameTaken = (name: string, excludedProfileID: string = ''): boolean => (
  (excludedProfileID !== 'default' && defaultTorrentProfile['name'].toLowerCase() === name.toLowerCase())
  || torrentProfiles.some((profile: MockTorrentProfile): boolean => (
    profile['id'] !== excludedProfileID && profile['name'].toLowerCase() === name.toLowerCase()
  ))
);

/**
 * Mock API - Default torrent profile response.
 *
 * Returns a detached response so move results can be added without mutating the
 * stored profile.
 *
 * @since 2.0.0
 */
const defaultTorrentProfileResponse = (): MockDefaultTorrentProfile => ({
  ...defaultTorrentProfile,
  labels: [...defaultTorrentProfile['labels']],
  options: {
    ...defaultTorrentProfile['options'],
    seeding: { ...defaultTorrentProfile['options']['seeding'] },
  },
});

/**
 * Mock API - Torrent profile sequence.
 *
 * Produces stable server-shaped identifiers for newly-created profiles.
 * The hexadecimal suffix matches the production identifier validator.
 *
 * @since 2.0.0
 */
let torrentProfileSequence: number = torrentProfiles.length;

/**
 * Mock API - Applies torrent profile seeding.
 *
 * Converts profile stop rules to Transmission's per-torrent mode values.
 * Seed fixtures and option assignment share this exact mapping.
 *
 * @since 2.0.0
 */
const applyTorrentProfileSeeding = (
  torrent: MockTorrent,
  profile: MockDefaultTorrentProfile | MockTorrentProfile,
): void => {
  if (profile['options']['seeding']['mode'] === 'never') {
    Reflect.set(torrent, 'seedRatioMode', 2);
    Reflect.set(torrent, 'seedIdleMode', 2);
  } else {
    Reflect.set(torrent, 'seedRatioMode', (profile['options']['seeding']['ratio'] === null) ? 2 : 1);
    Reflect.set(torrent, 'seedRatioLimit', profile['options']['seeding']['ratio'] ?? torrent.seedRatioLimit);
    Reflect.set(torrent, 'seedIdleMode', (profile['options']['seeding']['idleMinutes'] === null) ? 2 : 1);
    Reflect.set(torrent, 'seedIdleLimit', profile['options']['seeding']['idleMinutes'] ?? torrent.seedIdleLimit);
  }
};

/**
 * Mock API - Merges torrent labels.
 *
 * Preserves remote-app labels and appends profile labels once, ignoring case.
 * Profile resolution and automatic add behavior share this rule.
 *
 * @since 2.0.0
 */
const mergeTorrentLabels = (existing: string[], profileLabels: string[]): string[] => {
  const merged: string[] = [...existing];
  const seen: Set<string> = new Set(existing.map((label: string): string => label.toLowerCase()));
  for (const label of profileLabels) {
    if (!seen.has(label.toLowerCase())) {
      merged.push(label);
      seen.add(label.toLowerCase());
    }
  }

  return merged;
};

/**
 * Mock API - Applies torrent profile options.
 *
 * Copies the labels and per-torrent Transmission limits used by add and profile
 * assignment. Folder, VPN, paused state, and queue order are handled by callers.
 *
 * @since 2.0.0
 */
const applyTorrentProfileOptions = (
  torrent: MockTorrent,
  profile: MockDefaultTorrentProfile | MockTorrentProfile,
): void => {
  Reflect.set(torrent, 'labels', [...profile['labels']]);
  Reflect.set(torrent, 'bandwidthPriority', profile['options']['bandwidthPriority']);
  Reflect.set(torrent, 'peer-limit', profile['options']['peerLimit']);
  Reflect.set(torrent, 'downloadLimited', profile['options']['downloadLimitKBps'] !== null);
  Reflect.set(torrent, 'downloadLimit', profile['options']['downloadLimitKBps'] ?? 0);
  Reflect.set(torrent, 'uploadLimited', profile['options']['uploadLimitKBps'] !== null);
  Reflect.set(torrent, 'uploadLimit', profile['options']['uploadLimitKBps'] ?? 0);
  applyTorrentProfileSeeding(torrent, profile);
};

/**
 * Mock API - Torrents.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const torrents: MockTorrent[] = createTorrents();

if (duplicateTorrentEnabled && torrents[0] !== undefined) {
  torrents.push({
    ...torrents[0],
    connectionId: northwindConnectionId,
    id: 16_777_217,
    queuePosition: torrents.length,
  });
}

for (const torrent of torrents) {
  const profile: MockTorrentProfile | undefined = torrentProfiles.find(
    (candidate: MockTorrentProfile): boolean => candidate['downloadDirectory'] === torrent['downloadDir'],
  );
  if (profile !== undefined) {
    torrent.profileId = profile['id'];
    torrent.connectionId = profile['connectionId'] ?? northwindConnectionId;
    applyTorrentProfileSeeding(torrent, profile);
  } else {
    torrent.downloadDir = defaultTorrentProfile['downloadDirectory'];
    torrent.connectionId = northwindConnectionId;
    applyTorrentProfileSeeding(torrent, defaultTorrentProfile);
  }
}

/**
 * Mock API - Torrent needing a profile.
 *
 * Selects the seeded pattern tie so the banner, filter, tag, and resolver are
 * available immediately in the standalone mock.
 *
 * @since 2.0.0
 */
const needsProfileTorrent: MockTorrent | undefined = torrents.find(
  (torrent: MockTorrent): boolean => torrent['name'] === 'Example.Show.S01E04.2160p',
);
if (needsProfileTorrent !== undefined) {
  needsProfileTorrent.connectionId = northwindConnectionId;
  needsProfileTorrent.downloadDir = defaultTorrentProfile['downloadDirectory'];
  needsProfileTorrent.labels = mergeTorrentLabels(['remote-test'], defaultTorrentProfile['labels']);
  needsProfileTorrent.needsProfile = {
    profileIds: [
      'tpr-0000000000000002',
      'tpr-0000000000000001',
    ],
  };
  needsProfileTorrent.profileId = null;
  needsProfileTorrent.status = 0;
  applyTorrentProfileSeeding(needsProfileTorrent, defaultTorrentProfile);
}

/**
 * Mock API - Moves torrents to queue top.
 *
 * Preserves the selected torrents' relative order and compacts every queue
 * position. Profile assignment uses it when requested options choose Top.
 *
 * @since 2.0.0
 */
const moveTorrentsToQueueTop = (selectedTorrents: MockTorrent[]): void => {
  const selectedIDs: Set<number> = new Set(selectedTorrents.map(
    (torrent: MockTorrent): number => torrent['id'],
  ));
  const orderedTorrents: MockTorrent[] = [
    ...selectedTorrents,
    ...torrents.filter((torrent: MockTorrent): boolean => !selectedIDs.has(torrent['id'])),
  ];
  orderedTorrents.forEach((torrent: MockTorrent, index: number): void => {
    Reflect.set(torrent, 'queuePosition', index);
  });
};

/**
 * Mock API - Sequence.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
let sequence: number = 0;

/**
 * Mock API - Signed in.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
let signedIn: boolean = false;

// MOCK_SETUP_REQUIRED=true starts before setup, to show "Set up your account". The setup code is K7Q2M-XR9TD-P4W8N.

/**
 * Mock API - Setup required.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
let setupRequired: boolean = process.env['MOCK_SETUP_REQUIRED'] === 'true';

/**
 * Mock API - Setup started at.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const setupStartedAt: number = Date.now();

// MOCK_KEY_REPLACED=true starts as if the installation key had been lost, to show the notice.

/**
 * Mock API - Key replaced.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const keyReplaced: boolean = process.env['MOCK_KEY_REPLACED'] === 'true';

/**
 * Mock API - Removed secrets.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
let removedSecrets: {
  kind: 'authenticator' | 'notification' | 'vpn'
  name?: string
  notificationId?: string
  removedAt: string
}[] = (keyReplaced) ? [
  {
    kind: 'authenticator',
    removedAt: new Date().toISOString(),
  },
  {
    kind: 'vpn',
    removedAt: new Date().toISOString(),
  },
] : [];

// Each service's fields: [key, message when missing, secret, required].

/**
 * Mock API - Notification fields.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const notificationFields: Record<MockNotificationService, [string, string, boolean, boolean][]> = {
  'apprise': [
    [
      'url',
      'Enter the Apprise URL.',
      true,
      true,
    ],
    [
      'urls',
      '',
      true,
      false,
    ],
  ],
  'discord': [[
    'webhookUrl',
    'Enter the webhook URL.',
    true,
    true,
  ]],
  'email': [
    [
      'host',
      'Enter the SMTP server.',
      false,
      true,
    ],
    [
      'port',
      'Enter a port number.',
      false,
      true,
    ],
    [
      'security',
      'Choose STARTTLS, TLS, or none.',
      false,
      true,
    ],
    [
      'username',
      '',
      false,
      false,
    ],
    [
      'password',
      '',
      true,
      false,
    ],
    [
      'from',
      'Enter the address to send from.',
      false,
      true,
    ],
    [
      'to',
      'Enter the address to send to.',
      false,
      true,
    ],
  ],
  'gotify': [
    [
      'url',
      'Enter the server URL.',
      false,
      true,
    ],
    [
      'token',
      'Enter the app token.',
      true,
      true,
    ],
  ],
  'matrix': [
    [
      'homeserverUrl',
      'Enter the homeserver URL.',
      false,
      true,
    ],
    [
      'roomId',
      'Enter the room ID.',
      false,
      true,
    ],
    [
      'accessToken',
      'Enter the access token.',
      true,
      true,
    ],
  ],
  'ntfy': [
    [
      'url',
      'Enter the topic URL.',
      false,
      true,
    ],
    [
      'token',
      '',
      true,
      false,
    ],
  ],
  'ntfy-reverse-proxy': [
    [
      'url',
      'Enter the context URL.',
      false,
      true,
    ],
    [
      'token',
      '',
      true,
      false,
    ],
  ],
  'pushover': [
    [
      'userKey',
      'Enter the user key.',
      true,
      true,
    ],
    [
      'appToken',
      'Enter the app token.',
      true,
      true,
    ],
  ],
  'slack': [[
    'webhookUrl',
    'Enter the webhook URL.',
    true,
    true,
  ]],
  'telegram': [
    [
      'botToken',
      'Enter the bot token.',
      true,
      true,
    ],
    [
      'chatId',
      'Enter the chat ID.',
      false,
      true,
    ],
  ],
  'webhook': [
    [
      'url',
      'Enter the URL.',
      true,
      true,
    ],
    [
      'token',
      '',
      true,
      false,
    ],
  ],
};

/**
 * Mock API - Notification events.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const notificationEvents: {
  defaultEnabled: boolean
  description: string
  key: string
  label: string
}[] = [
  {
    defaultEnabled: true,
    description: 'The app started without its key and removed what it locked.',
    key: 'secrets-removed',
    label: 'Saved secrets were removed',
  },
  {
    defaultEnabled: true,
    description: 'Ten failed sign-ins from one address paused sign-in from it.',
    key: 'sign-in-locked',
    label: 'Sign-in locked',
  },
  {
    defaultEnabled: true,
    description: 'The tunnel went down and Transmission\'s traffic is blocked.',
    key: 'vpn-dropped',
    label: 'VPN dropped',
  },
  {
    defaultEnabled: true,
    description: 'The tunnel is up again after a drop.',
    key: 'vpn-restored',
    label: 'VPN back up',
  },
  {
    defaultEnabled: true,
    description: 'A torrent finished downloading.',
    key: 'torrent-finished',
    label: 'Torrent finished',
  },
  {
    defaultEnabled: true,
    description: 'Transmission reported an error for a torrent.',
    key: 'torrent-error',
    label: 'Torrent error',
  },
  {
    defaultEnabled: true,
    description: 'A remote app added a torrent that matches more than one profile.',
    key: 'profile-choice-needed',
    label: 'Profile choice needed',
  },
];

/**
 * Mock API - Notifications started at.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const notificationsStartedAt: number = Date.now();

/**
 * Mock API - Notification minute.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const notificationMinute: number = 60 * 1000;

/**
 * Mock API - Notifications.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const notifications: MockNotification[] = [
  {
    createdAt: new Date(notificationsStartedAt - (30 * 24 * 60 * notificationMinute)).toISOString(),
    events: [
      'secrets-removed',
      'sign-in-locked',
      'vpn-dropped',
      'vpn-restored',
      'torrent-error',
    ],
    id: 'ntf-2a4c6e8a0b2d4f60',
    lastAttemptAt: new Date(notificationsStartedAt - (2 * 60 * notificationMinute)).toISOString(),
    lastError: null,
    lastErrorDetails: null,
    name: 'My phone',
    secrets: {},
    secretsMissing: [],
    service: 'ntfy',
    settings: { url: 'https://ntfy.sh/transmission-alerts' },
    updatedAt: new Date(notificationsStartedAt - (30 * 24 * 60 * notificationMinute)).toISOString(),
  },
  {
    createdAt: new Date(notificationsStartedAt - (9 * 24 * 60 * notificationMinute)).toISOString(),
    events: [
      'vpn-dropped',
      'vpn-restored',
      'torrent-finished',
    ],
    id: 'ntf-5c7e9a1b3d5f7a90',
    lastAttemptAt: new Date(notificationsStartedAt - (26 * notificationMinute)).toISOString(),
    lastError: null,
    lastErrorDetails: null,
    name: 'Homelab chat',
    secrets: { botToken: true },
    secretsMissing: [],
    service: 'telegram',
    settings: { chatId: '-1001234567890' },
    updatedAt: new Date(notificationsStartedAt - (9 * 24 * 60 * notificationMinute)).toISOString(),
  },
  {
    createdAt: new Date(notificationsStartedAt - (3 * 24 * 60 * notificationMinute)).toISOString(),
    events: ['torrent-finished'],
    id: 'ntf-8e0a2c4e6a8c0e12',
    lastAttemptAt: new Date(notificationsStartedAt - (47 * notificationMinute)).toISOString(),
    lastError: (notificationTransportError) ? mockNotificationTransportFailure(rawNotificationTransportError) : 'HTTP 502: Bad Gateway',
    lastErrorDetails: (notificationTransportError) ? rawNotificationTransportError : null,
    name: 'Downloads feed',
    secrets: { token: true },
    secretsMissing: [],
    service: 'ntfy-reverse-proxy',
    settings: { url: 'https://alerts.ntfy.example.com' },
    updatedAt: new Date(notificationsStartedAt - (3 * 24 * 60 * notificationMinute)).toISOString(),
  },
];

// A lost key removes every destination's saved secrets, as the server does, and pauses
// those destinations until the secrets are entered again.
if (keyReplaced) {
  for (const notification of [...notifications].sort((left: MockNotification, right: MockNotification): number => left.name.localeCompare(right.name))) {
    const secretKeys: string[] = Object.keys(notification.secrets).sort();

    if (secretKeys.length === 0) {
      continue;
    }

    notification.secrets = {};
    notification.secretsMissing = secretKeys;
    removedSecrets.push({
      kind: 'notification',
      name: notification.name,
      notificationId: notification.id,
      removedAt: new Date().toISOString(),
    });
  }
}

// The name typed for the passkey being added; the browser's answer doesn't carry it.

/**
 * Mock API - Pending passkey name.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
let pendingPasskeyName: string = 'Passkey';

// Mock account state for the sign-in and security screens.

/**
 * Mock API - Account.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const account: {
  password: string
  passkeys: Record<string, unknown>[]
  recoveryCodes: string[]
  totpEnabled: boolean
  totpSetupPending: boolean
  username: string
} = {
  password: 'transmission',
  passkeys: [
    {
      id: 'pk-1',
      name: 'MacBook Pro',
      hostname: 'torrents.example.com',
      createdAt: '2026-09-14T17:02:00Z',
      lastUsedAt: '2026-10-23T21:40:00Z',
    },
    {
      id: 'pk-2',
      name: 'iPhone',
      hostname: 'torrents.example.com',
      createdAt: '2026-10-08T12:26:00Z',
      lastUsedAt: '2026-10-21T07:55:00Z',
    },
  ],
  recoveryCodes: [],
  totpEnabled: false,
  totpSetupPending: false,
  username: 'admin',
};

/**
 * Mock API - New recovery codes.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const newRecoveryCodes = (): string[] => Array.from({ length: 10 }, (): string => {
  const alphabet: string = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code: string = '';

  for (let index: number = 0; index < 10; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return code;
});

/**
 * Mock API - Formats recovery code.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const formatRecoveryCode = (code: string): string => `${code.slice(0, 5)}-${code.slice(5)}`;

// Write scopes include their read scope, matching the real API.

/**
 * Mock API - Expands scopes.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const expandScopes = (scopes: string[]): string[] => {
  const expanded: Set<string> = new Set(scopes);

  for (const scope of scopes) {
    if (scope.endsWith(':write')) {
      expanded.add(scope.replace(':write', ':read'));
    }
  }

  return [...expanded].sort();
};

// The modules of the QR code the Go server draws for mockTotpUri, made once with rsc.io/qr at
// level M like security.QRCodeDataURI. Remake them if the URI changes.

/**
 * Mock API - Mock QR rows.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const mockQrRows: string[] = [
  '1111111000000001110101101100011011111100101111111',
  '1000001011000011111011010100100111000011101000001',
  '1011101000010001001010101111000001100001101011101',
  '1011101000011111101101101000000101000001001011101',
  '1011101011000101110100111111111011100100001011101',
  '1000001000000110100111100010001100110010001000001',
  '1111111010101010101010101010101010101010101111111',
  '0000000000010110000010100010100011001110100000000',
  '1010101001101111110011111111101111101011100010010',
  '1110100111001011001001011100000001000000000100101',
  '1111111100100100110011010100010000001001011001101',
  '1010100010001110100100000101100111100101000110011',
  '0001111101101110001111111100100111111011101110010',
  '1111010111110111001101011001100000001000000001001',
  '0101111100011101001111101101010100010010000000111',
  '1001110111111111110101001000010001110000001110001',
  '1110101011101111111111111010101110111100010110110',
  '0010100000001000110000100100010100010000000010000',
  '1010001111100010101010011100101011101110110110111',
  '1100100001100010100001000101110011001000001010010',
  '1001011100001000110001011111110010011010010111000',
  '0011100010011101100000111101100010000001000000111',
  '0000111110100011100110111110110010011001111111011',
  '0000100011011000111100100011110110010010100010001',
  '0110101011011001110000101011110110011111101010001',
  '1100100011011010110000100011110010010100100011111',
  '0110111111100000111010111111110110000101111111111',
  '1101110010011110001001100001110110111011111000000',
  '0000001011110011001011011011110111001000101111000',
  '0010000000011011010011110110100010010100010001111',
  '0100101100011010001000011011000010001000011011011',
  '1000000101111000111010110011001001000111110101000',
  '0110001010001011000011001011000110111110000001000',
  '0111000010001000101000000011101010010100010001010',
  '1110101011100110011100000111001010111101001100111',
  '1010000000010001000100011010110011011010101100000',
  '1010011111000111110001100101110011111100001000011',
  '1110100110111100110001000000100000010001011001001',
  '0100011001101100001001011110100100001101111011111',
  '0111000001000111111101000101101110010010011010011',
  '1110001111001010100001111110111110111110111110010',
  '0000000011010000111001100011110000001001100011011',
  '1111111001100100011110101011110000001111101011011',
  '1000001000100011000101100011100010001001100010000',
  '1011101011110110010111111111111110111001111111010',
  '1011101001010110101100100010000111010001001011010',
  '1011101010001001100110011000000101011101100111000',
  '1000001001100111011100010010010011110101110000010',
  '1111111011001100110100101010111011011100000011111',
];

// The authenticator URI for the mock's fixed secret, in the form security.TOTPURI builds.

/**
 * Mock API - Mock TOTP URI.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const mockTotpUri: string = 'otpauth://totp/Transmission%20VPN:admin?algorithm=SHA1&digits=6&issuer=Transmission+VPN&period=30&secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

// mockQrCode draws mockQrRows the way security.QRCodeDataURI does, with a four-module quiet zone.

/**
 * Mock API - Mock QR code.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const mockQrCode = (): string => {
  const size: number = mockQrRows.length;
  let path: string = '';

  for (let y: number = 0; y < size; y += 1) {
    for (let x: number = 0; x < size; x += 1) {
      if (mockQrRows[y]?.[x] === '1') {
        path += `M${x + 4} ${y + 4}h1v1h-1z`;
      }
    }
  }

  const svg: string = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size + 8} ${size + 8}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path fill="#000" d="${path}"/></svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};

/**
 * Mock API - Directories.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const directories: Map<string, MockDirectoryMetadata> = new Map([
  [
    '/data/downloads',
    {
      files: 1,
      mountPoint: false,
      readable: true,
    },
  ],
  [
    '/data/audio',
    {
      files: 2,
      mountPoint: false,
      readable: true,
    },
  ],
  [
    '/data/downloads/audit-location',
    {
      files: 0,
      mountPoint: false,
      readable: true,
    },
  ],
  [
    '/data/datasets',
    {
      files: 2,
      mountPoint: false,
      readable: true,
    },
  ],
  [
    '/data/linux',
    {
      files: 3,
      mountPoint: false,
      readable: true,
    },
  ],
  [
    '/data/movies',
    {
      files: 3,
      mountPoint: false,
      readable: true,
    },
  ],
  [
    '/data/downloads/private',
    {
      files: 0,
      mountPoint: false,
      readable: false,
    },
  ],
  [
    '/data/incomplete',
    {
      files: 0,
      mountPoint: false,
      readable: true,
    },
  ],
  [
    '/data/incomplete/pieces',
    {
      files: 0,
      mountPoint: false,
      readable: true,
    },
  ],
  [
    '/data/iso',
    {
      files: 1,
      mountPoint: false,
      readable: true,
    },
  ],
  [
    '/data/media',
    {
      files: 0,
      mountPoint: true,
      readable: true,
    },
  ],
  [
    '/data/media/audio',
    {
      files: 0,
      mountPoint: false,
      readable: true,
    },
  ],
  [
    '/data/media/films',
    {
      files: 2,
      mountPoint: false,
      readable: true,
    },
  ],
  [
    '/data/media/films/classics',
    {
      files: 1,
      mountPoint: false,
      readable: true,
    },
  ],
  [
    '/data/media/shows',
    {
      files: 1,
      mountPoint: false,
      readable: true,
    },
  ],
  [
    '/data/media/shows/archive',
    {
      files: 1,
      mountPoint: false,
      readable: true,
    },
  ],
  [
    '/data/old-stuff',
    {
      files: 0,
      mountPoint: false,
      readable: true,
    },
  ],
]);
if (process.env['MOCK_NESTED_PROFILE'] === 'true') {
  directories.set('/data/downloads/archive', {
    files: 0,
    mountPoint: false,
    readable: true,
  });
}

/**
 * Mock API - Saved labels.
 *
 * Keeps the label presets that an organization save replaces.
 * The dialogs and the sidebar then show what was saved.
 *
 * @since 2.0.0
 */
const savedLabels: string[] = [
  'arm',
  'linux',
  'music',
  'public-domain',
  'research',
];

/**
 * Mock API - Organization revision.
 *
 * Counts organization saves, like the API's stored revision.
 * A save from a dialog opened on an older revision gets the API's conflict.
 *
 * @since 2.0.0
 */
let organizationRevision: number = 1;

/**
 * Mock API - Save used labels.
 *
 * Preserves the first case-insensitive spelling and advances the organization
 * revision once when a write introduces one or more new labels.
 *
 * @since 2.0.0
 */
const saveUsedLabels = (
  labels: string[],
  advanceRevision: boolean = true,
): void => {
  const savedKeys: Set<string> = new Set<string>(savedLabels.map(
    (label: string): string => label.toLowerCase(),
  ));
  let changed: boolean = false;
  for (const label of labels) {
    const key: string = label.toLowerCase();
    if (label === '' || savedKeys.has(key)) {
      continue;
    }
    // A full list stays as it is, matching the API's 1,024-label cap.
    if (savedLabels.length >= 1024) {
      break;
    }
    savedKeys.add(key);
    savedLabels.push(label);
    changed = true;
  }
  if (!changed) {
    return;
  }
  savedLabels.sort((leftLabel: string, rightLabel: string): number => (
    leftLabel.localeCompare(rightLabel, undefined, { sensitivity: 'base' })
    || leftLabel.localeCompare(rightLabel)
  ));
  if (advanceRevision) {
    organizationRevision += 1;
  }
};

/**
 * Mock API - Apply saved label edits.
 *
 * Uses the same case-insensitive deletion, rename, and de-duplication behavior for
 * torrents and profiles.
 *
 * @since 2.0.0
 */
const applySavedLabelEdits = (
  labels: string[],
  removedLabels: string[],
  renamedLabels: {
    from: string
    to: string
  }[],
): string[] => {
  const nextLabels: string[] = [];
  for (const label of labels) {
    if (removedLabels.some(
      (removedLabel: string): boolean => removedLabel.toLowerCase() === label.toLowerCase(),
    )) {
      continue;
    }
    const rename = renamedLabels.find(
      (candidate): boolean => candidate['from'].toLowerCase() === label.toLowerCase(),
    );
    const nextLabel: string = rename?.['to'] ?? label;
    if (!nextLabels.some(
      (existingLabel: string): boolean => existingLabel.toLowerCase() === nextLabel.toLowerCase(),
    )) {
      nextLabels.push(nextLabel);
    }
  }

  return nextLabels;
};

saveUsedLabels([
  ...defaultTorrentProfile['labels'],
  ...torrentProfiles.flatMap((profile: MockTorrentProfile): string[] => profile['labels']),
  ...torrents.flatMap((torrent: MockTorrent): string[] => torrent['labels']),
], false);

/**
 * Mock API - Settings.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const settings: Record<string, unknown>[] = [
  {
    'key': 'transmission.downloadDirectory',
    'category': 'transmission.storage',
    'title': 'Download directory',
    'description': 'Completed downloads are written beneath the approved /data mount.',
    'value': '/data/downloads',
    'defaultValue': '/data/downloads',
    'source': (defaultTorrentProfile['downloadDirectoryLocked']) ? 'managed' : 'default',
    'locked': defaultTorrentProfile['downloadDirectoryLocked'],
    'valid': true,
    'applyImpact': 'live',
  },
  {
    'key': 'transmission.incompleteDirectory',
    'category': 'transmission.storage',
    'title': 'Incomplete folder',
    'description': 'Partial downloads are kept separately beneath the /data mount.',
    'value': '/data/incomplete',
    'defaultValue': '/data/incomplete',
    'source': 'default',
    'locked': false,
    'valid': true,
    'applyImpact': 'transmission-restart',
  },
  {
    'key': 'transmission.incompleteDirectoryEnabled',
    'category': 'transmission.storage',
    'title': 'Use incomplete folder',
    'description': 'Transmission moves completed data out of the incomplete folder.',
    'value': true,
    'defaultValue': true,
    'source': 'default',
    'locked': false,
    'valid': true,
    'applyImpact': 'live',
  },
  {
    'key': 'transmission.downloadQueueEnabled',
    'category': 'transmission.queue',
    'title': 'Enable download queue',
    'description': 'The daemon limits how many downloading torrents run at once.',
    'value': true,
    'defaultValue': true,
    'source': 'default',
    'locked': false,
    'valid': true,
    'applyImpact': 'live',
  },
  {
    'key': 'transmission.downloadQueueSize',
    'category': 'transmission.queue',
    'title': 'Download queue size',
    'description': 'The maximum number of actively downloading torrents.',
    'value': 5,
    'defaultValue': 5,
    'source': 'default',
    'locked': false,
    'valid': true,
    'applyImpact': 'live',
  },
  {
    'key': 'transmission.peerLimitGlobal',
    'category': 'transmission.peers',
    'title': 'Global peer limit',
    'description': 'The maximum aggregate peer count across all torrents.',
    'value': 200,
    'defaultValue': 200,
    'source': 'default',
    'locked': false,
    'valid': true,
    'applyImpact': 'live',
  },
  {
    'key': 'transmission.peerPortRandomOnStart',
    'category': 'transmission.network',
    'title': 'Randomize peer port',
    'description': 'Transmission selects a new peer port when the daemon starts.',
    'value': false,
    'defaultValue': false,
    'source': 'default',
    'locked': false,
    'valid': true,
    'applyImpact': 'transmission-restart',
  },
  {
    'key': 'transmission.peerPortRandomLow',
    'category': 'transmission.network',
    'title': 'Random port low',
    'description': 'The lowest port Transmission may select when peer port randomization is enabled.',
    'value': 49152,
    'defaultValue': 49152,
    'source': 'default',
    'locked': false,
    'valid': true,
    'applyImpact': 'transmission-restart',
  },
  {
    'key': 'transmission.peerPortRandomHigh',
    'category': 'transmission.network',
    'title': 'Random port high',
    'description': 'The highest port Transmission may select when peer port randomization is enabled.',
    'value': 65535,
    'defaultValue': 65535,
    'source': 'default',
    'locked': false,
    'valid': true,
    'applyImpact': 'transmission-restart',
  },
  {
    'key': 'transmission.blocklistEnabled',
    'category': 'transmission.blocklists',
    'title': 'Enable blocklists',
    'description': 'Transmission rejects peers listed in any blocklist source.',
    'value': !noVPNConnections,
    'defaultValue': false,
    'source': 'default',
    'locked': false,
    'valid': true,
    'applyImpact': 'live',
  },
  {
    'key': 'transmission.blocklistSources',
    'category': 'transmission.blocklists',
    'title': 'Blocklist sources',
    'description': 'Each HTTPS source is downloaded through the VPN and combined into Transmission\'s blocklist.',
    'value': [
      'https://lists.example.net/level1.txt',
      'https://blocklists.example.net/peer-guard.dat.gz',
      'https://cdn.example.net/abuse-cidrs.zip',
    ],
    'defaultValue': [],
    'source': 'default',
    'locked': false,
    'valid': true,
    'applyImpact': 'live',
  },
  {
    'key': 'transmission.blocklistUpdateIntervalHours',
    'category': 'transmission.blocklists',
    'title': 'Update every',
    'description': 'How often each source is downloaded again.',
    'value': 24,
    'defaultValue': 24,
    'source': 'default',
    'locked': false,
    'valid': true,
    'applyImpact': 'live',
  },
  {
    'key': 'rpc.compatibilityEnabled',
    'category': 'access.rpc',
    'title': 'Transmission-compatible RPC',
    'description': 'Allow third-party Transmission clients through the authenticated control port.',
    'value': !noVPNConnections,
    'defaultValue': false,
    'source': (noVPNConnections) ? 'default' : 'user',
    'locked': false,
    'valid': true,
    'applyImpact': 'live',
  },
  {
    'key': 'diagnostics.debugLogging',
    'category': 'diagnostics',
    'title': 'Debug logging',
    'description': 'Writes extra detail to the container log, such as slow database work and each VPN reconnect.',
    'value': false,
    'defaultValue': false,
    'source': 'default',
    'locked': false,
    'valid': true,
    'applyImpact': 'live',
  },
];

/**
 * Mock API - Effective string setting.
 *
 * Resolves mutable mock settings for Default-profile and storage-policy responses.
 * Route handlers therefore observe Settings changes without duplicated state.
 *
 * @since 2.0.0
 */
const effectiveStringSetting = (key: string): string => String(
  settings.find((setting: Record<string, unknown>): boolean => setting['key'] === key)?.['value'] ?? '',
);

/**
 * Mock API - Ensure directory.
 *
 * Adds every missing parent beneath /data so the in-memory folder browser follows
 * the control API's controller-backed creation behavior.
 *
 * @since 2.0.0
 */
const ensureDirectory = (directoryPath: string): void => {
  if (!directoryPath.startsWith('/data/') || directoryPath.includes('/../')) {
    return;
  }

  let currentPath: string = '/data';
  for (const component of directoryPath.slice('/data/'.length).split('/')) {
    currentPath = `${currentPath}/${component}`;
    if (!directories.has(currentPath)) {
      directories.set(currentPath, {
        files: 0,
        mountPoint: false,
        readable: true,
      });
    }
  }
};

/**
 * Mock API - Ensure configured directories.
 *
 * Keeps the Default profile and enabled incomplete folder visible after Settings
 * changes, matching the production startup and save behavior.
 *
 * @since 2.0.0
 */
const ensureConfiguredDirectories = (): void => {
  ensureDirectory(effectiveStringSetting('transmission.downloadDirectory'));
  const incompleteEnabled: boolean = settings.find(
    (setting: Record<string, unknown>): boolean => setting['key'] === 'transmission.incompleteDirectoryEnabled',
  )?.['value'] === true;
  if (incompleteEnabled) {
    ensureDirectory(effectiveStringSetting('transmission.incompleteDirectory'));
  }
};

ensureConfiguredDirectories();
for (const profile of torrentProfiles) {
  ensureDirectory(profile['downloadDirectory']);
}

/**
 * Mock API - Download selection.
 *
 * Returns the listing fields supplied by the real storage-directory endpoint.
 * Navigation remains available even when final selection is unavailable.
 *
 * @since 2.0.0
 */
const downloadSelection = (directoryPath: string): {
  allowed: boolean
  reason: string
} => {
  if (directoryPath === '/data') {
    return {
      allowed: false,
      reason: 'Open or create a folder inside /data. Torrents can\'t be saved in /data itself.',
    };
  }
  const incompleteDirectory: string = effectiveStringSetting('transmission.incompleteDirectory');
  if (dataPathContains(incompleteDirectory, directoryPath)) {
    return {
      allowed: false,
      reason: `This is in the incomplete folder, ${incompleteDirectory}, which only holds unfinished downloads. Pick a folder outside it.`,
    };
  }

  return {
    allowed: true,
    reason: '',
  };
};

/**
 * Mock API - Directory children.
 *
 * Lists immediate real subfolders in the same lexical order as the controller.
 * Deeper descendants are excluded until their own level is requested.
 *
 * @since 2.0.0
 */
const directoryChildren = (directoryPath: string): string[] => [...directories.keys()].filter(
  (candidate: string): boolean => (
    candidate.startsWith(`${directoryPath}/`)
    && !candidate.slice(directoryPath.length + 1).includes('/')
  ),
).sort();

/**
 * Mock API - Incomplete selection.
 *
 * Applies the reverse-containment policy used by the Incomplete directory field.
 * The current incomplete folder remains usable even when assignments sit elsewhere.
 *
 * @since 2.0.0
 */
const incompleteSelection = (directoryPath: string): {
  allowed: boolean
  reason: string
} => {
  if (directoryPath === effectiveStringSetting('transmission.incompleteDirectory')) {
    return {
      allowed: true,
      reason: '',
    };
  }

  const clash: {
    path: string
    profileName: string
  } | undefined = [
    {
      path: effectiveStringSetting('transmission.downloadDirectory'),
      profileName: defaultTorrentProfile['name'],
    },
    ...torrentProfiles.map((profile: MockTorrentProfile): {
      path: string
      profileName: string
    } => ({
      path: profile['downloadDirectory'],
      profileName: `${profile['name']} profile`,
    })),
  ].find((destination): boolean => dataPathContains(directoryPath, destination['path']));

  if (clash === undefined) {
    return {
      allowed: true,
      reason: '',
    };
  }
  const exactFolder: boolean = dataPathsEqualIgnoringCase(directoryPath, clash['path']);

  return {
    allowed: false,
    reason: (exactFolder) ? `“${clash['path'].slice(clash['path'].lastIndexOf('/') + 1)}” is the ${clash['profileName']}'s folder, so it can't be the incomplete folder.` : `Use a folder outside ${clash['path']}. Torrents in the ${clash['profileName']} finish there.`,
  };
};

/**
 * Mock API - Profile selection.
 *
 * Applies ordinary download-folder safety and reserves every other profile's
 * folder for its current owner.
 *
 * @since 2.0.0
 */
const profileSelection = (directoryPath: string, profileID: string): {
  allowed: boolean
  reason: string
} => {
  const downloadPolicy: {
    allowed: boolean
    reason: string
  } = downloadSelection(directoryPath);
  if (!downloadPolicy['allowed']) {
    return downloadPolicy;
  }

  const owner = profileFolderOwner(directoryPath, profileID);
  if (owner === undefined) {
    return downloadPolicy;
  }

  return {
    allowed: false,
    reason: profileFolderTakenMessage(directoryPath, owner['name'], owner['relation']),
  };
};

/**
 * Mock API - Directory tags.
 *
 * Builds the contract's stable tag order from effective Settings and profile state.
 * The Download directory leads named profile tags as the setting-backed Default.
 *
 * @since 2.0.0
 */
const directoryTags = (directoryPath: string): string[] => {
  const tags: string[] = [];
  if (directoryPath === effectiveStringSetting('transmission.incompleteDirectory')) {
    tags.push('Incomplete folder');
  }
  if (directoryPath === effectiveStringSetting('transmission.downloadDirectory')) {
    tags.push(defaultTorrentProfile['name']);
  }
  for (const profile of torrentProfiles) {
    if (directoryPath === profile['downloadDirectory']) {
      tags.push(`${profile['name']} profile`);
    }
  }

  return tags;
};

/**
 * Mock API - Directory deletion policy.
 *
 * Evaluates the contract's ordered advisory rules and returns the first match.
 * DELETE repeats this function so a listing never authorizes a stale mutation.
 *
 * @since 2.0.0
 */
const directoryDeletionPolicy = (directoryPath: string): MockDirectoryDeletionPolicy => {
  const folderName: string = directoryPath.slice(directoryPath.lastIndexOf('/') + 1);
  const incompleteDirectory: string = effectiveStringSetting('transmission.incompleteDirectory');
  if (
    !dataPathsEqualIgnoringCase(directoryPath, incompleteDirectory)
    && dataPathContainsIgnoringCase(incompleteDirectory, directoryPath)
  ) {
    return {
      code: 'directory_in_use',
      message: 'Folders inside the incomplete folder belong to Transmission, so they can\'t be deleted here.',
    };
  }
  if (dataPathsEqualIgnoringCase(directoryPath, incompleteDirectory)) {
    return {
      code: 'directory_in_use',
      message: `“${folderName}” is the Incomplete folder in Settings, so it can't be deleted.`,
    };
  }

  const assignedProfile: {
    name: string
    path: string
  } | undefined = torrentProfiles.map((profile: MockTorrentProfile): {
    name: string
    path: string
  } => ({
    name: profile['name'],
    path: profile['downloadDirectory'],
  })).find((profile: {
    name: string
    path: string
  }): boolean => dataPathsEqualIgnoringCase(profile['path'], directoryPath));
  if (assignedProfile !== undefined) {
    return {
      code: 'directory_in_use',
      message: `“${folderName}” is the ${assignedProfile['name']} profile's folder, so it can't be deleted.`,
    };
  }
  if (dataPathsEqualIgnoringCase(directoryPath, effectiveStringSetting('transmission.downloadDirectory'))) {
    return {
      code: 'directory_in_use',
      message: `“${folderName}” is the ${defaultTorrentProfile['name']}'s folder, so it can't be deleted.`,
    };
  }
  if (process.env['MOCK_TORRENT_LOCATIONS_UNAVAILABLE'] === 'true') {
    return {
      code: 'torrent_locations_unavailable',
      message: 'Torrent locations can\'t be checked right now, so folders can\'t be deleted. Try again in a moment.',
    };
  }
  if (torrents.some(
    (torrent: MockTorrent): boolean => dataPathsEqualIgnoringCase(torrent['downloadDir'], directoryPath),
  )) {
    return {
      code: 'directory_in_use',
      message: `A torrent is saved in “${folderName}”, so it can't be deleted.`,
    };
  }
  if (process.env['MOCK_DIRECTORY_CHECK_TIMEOUT'] === 'true') {
    return {
      code: 'directory_browser_unavailable',
      message: `“${folderName}” couldn't be checked in time, so it can't be deleted right now. Try again in a moment.`,
    };
  }

  const metadata: MockDirectoryMetadata | undefined = directories.get(directoryPath);
  if (metadata?.['mountPoint'] === true) {
    return {
      code: 'directory_in_use',
      message: `“${folderName}” is a separate mount, so it can't be deleted.`,
    };
  }
  if (metadata?.['readable'] === false) {
    return {
      code: 'directory_in_use',
      message: `Transmission's account can't open “${folderName}”, so it can't be deleted here.`,
    };
  }
  if ((metadata?.['files'] ?? 0) > 0 || directoryChildren(directoryPath).length > 0) {
    return {
      code: 'directory_not_empty',
      message: `Only empty folders can be deleted here. Remove what's inside “${folderName}” from your file system first.`,
    };
  }

  return {
    code: '',
    message: '',
  };
};

/**
 * Mock API - Directory selection policy.
 *
 * Selects the purpose-specific usability rule for one directory. Profile
 * checks also receive the current owner identifier so its folder stays usable.
 *
 * @since 2.0.0
 */
const directorySelection = (
  directoryPath: string,
  purpose: MockDirectoryPurpose,
  profileID: string,
): {
  allowed: boolean
  reason: string
} => {
  if (purpose === 'download') {
    return downloadSelection(directoryPath);
  }
  if (purpose === 'incomplete') {
    return incompleteSelection(directoryPath);
  }

  return profileSelection(directoryPath, profileID);
};

/**
 * Mock API - List directory.
 *
 * Returns one purpose-aware tree level using the full console contract.
 * The envelope's legacy download fields continue to describe the listed folder.
 *
 * @since 2.0.0
 */
const listDirectory = (
  directoryPath: string,
  purpose: MockDirectoryPurpose,
  profileID: string = '',
): Record<string, unknown> => {
  const selection: {
    allowed: boolean
    reason: string
  } = directorySelection(directoryPath, purpose, profileID);

  return {
    downloadAllowed: selection['allowed'],
    ...((selection['reason'] === '') ? {} : {
      downloadUnavailableReason: selection['reason'],
    }),
    path: directoryPath,
    ...((directoryPath === '/data') ? {} : {
      parentPath: directoryPath.slice(0, directoryPath.lastIndexOf('/')),
    }),
    directories: directoryChildren(directoryPath).map((child: string): Record<string, unknown> => {
      const metadata: MockDirectoryMetadata = directories.get(child) ?? {
        files: 0,
        mountPoint: false,
        readable: true,
      };
      const childDirectories: string[] = directoryChildren(child);
      const purposeSelection: {
        allowed: boolean
        reason: string
      } = directorySelection(child, purpose, profileID);
      const deletionPolicy: MockDirectoryDeletionPolicy = directoryDeletionPolicy(child);

      return {
        name: child.slice(child.lastIndexOf('/') + 1),
        path: child,
        empty: metadata['files'] === 0 && childDirectories.length === 0,
        hasSubfolders: childDirectories.length > 0,
        browsable: metadata['readable'],
        selectable: purposeSelection['allowed'],
        usable: purposeSelection['allowed'],
        ...((purposeSelection['reason'] === '') ? {} : {
          unusableReason: purposeSelection['reason'],
        }),
        deletable: deletionPolicy['code'] === '',
        ...((deletionPolicy['message'] === '') ? {} : {
          deleteUnavailableReason: deletionPolicy['message'],
        }),
        tags: directoryTags(child),
      };
    }),
  };
};

/**
 * Mock API - Download folder issue.
 *
 * Reuses effective incomplete-folder state across every mock destination route.
 * An empty result means the candidate passes both reserved-folder checks.
 *
 * @since 2.0.0
 */
const downloadFolderIssue = (value: unknown): string => {
  if (isDownloadDataRoot(value)) {
    return downloadDataPathRootMessage;
  }
  if (typeof value !== 'string' || value === '') {
    return 'Choose a normalized folder beneath /data.';
  }
  const incompleteDirectory: string = effectiveStringSetting('transmission.incompleteDirectory');
  if (dataPathContains(incompleteDirectory, value)) {
    return `Choose a folder outside the incomplete folder, ${incompleteDirectory}.`;
  }

  return '';
};

/**
 * Mock API - Settings revision.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
let settingsRevision: number = 3;

/**
 * Mock API - Pending Transmission restart keys.
 *
 * Starts with the approved screenshot state and changes as settings are saved or applied.
 * Lets the restart notice exercise both its initial and cleared states.
 *
 * @since 2.0.0
 */
let pendingRestartKeys: string[] = (noVPNConnections) ? [] : ['transmission.peerPortRandomOnStart'];

/**
 * Mock API - Blocklist status.
 *
 * Starts with three representative source outcomes and changes briefly to updating
 * when the mock Update now endpoint is called.
 *
 * @since 2.0.0
 */
let blocklistStatus: MockBlocklistStatus = {
  state: 'idle',
  lastAttemptAt: '2026-11-05T16:15:00Z',
  lastSuccessAt: '2026-11-05T16:15:00Z',
  nextUpdateAt: '2026-11-06T16:15:00Z',
  totalRanges: 152_486,
  sources: [
    {
      url: 'https://lists.example.net/level1.txt',
      state: 'ok',
      ranges: 93_214,
      updatedAt: '2026-11-05T16:15:00Z',
    },
    {
      url: 'https://blocklists.example.net/peer-guard.dat.gz',
      state: 'error',
      ranges: 48_213,
      updatedAt: '2026-11-04T14:30:00Z',
      copyFrom: '2026-11-04T14:30:00Z',
      error: 'The server answered 503.',
    },
    {
      url: 'https://cdn.example.net/abuse-cidrs.zip',
      state: 'ok',
      ranges: 11_059,
      updatedAt: '2026-11-05T16:15:00Z',
    },
  ],
};

// The first eight definitions mirror the real server's order and words (control-api/internal/provider/provider.go).
// PIA and Mullvad keep their downloaded catalog fixtures; three mock-only screenshot providers follow.

/**
 * Mock API - Providers.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const providers: Record<string, unknown>[] = [
  {
    'id': 'custom',
    'displayName': 'Custom',
    'description': 'Import a validated OpenVPN or WireGuard file from any compatible provider.',
    'supportsPortForwarding': false,
    'p2p': null,
    'tunnels': [
      {
        'id': 'openvpn',
        'description': 'Import a validated OpenVPN profile from any compatible provider.',
        'catalogSource': 'upload',
        'supportsProfileUpload': true,
        'supportsCatalogRefresh': false,
        'credentialFields': [
          {
            'key': 'username',
            'label': 'Username',
            'kind': 'text',
            'secret': false,
            'required': false,
            'description': 'The OpenVPN service username when the profile uses password authentication.',
          },
          {
            'key': 'password',
            'label': 'Password',
            'kind': 'password',
            'secret': true,
            'required': false,
            'description': 'The OpenVPN service password when the profile uses password authentication.',
          },
        ],
      },
      {
        'id': 'wireguard',
        'description': 'Import a validated WireGuard configuration that includes its own private key.',
        'catalogSource': 'upload',
        'supportsProfileUpload': true,
        'supportsCatalogRefresh': false,
        'credentialFields': [],
      },
    ],
  },
  {
    'id': 'purevpn',
    'displayName': 'PureVPN',
    'description': 'Use PureVPN\'s official recommended OpenVPN profile catalog.',
    'supportsPortForwarding': false,
    'p2p': {
      'restricted': true,
      'note': 'PureVPN allows P2P only on servers in the countries it lists.',
      'linkLabel': 'See PureVPN\'s P2P countries',
      'url': 'https://support.purevpn.com/en_US/about-purevpn/p2p-file-sharing',
    },
    'tunnels': [{
      'id': 'openvpn',
      'description': 'Use PureVPN\'s official recommended OpenVPN profile catalog.',
      'catalogSource': 'https://d11a57lttb2ffq.cloudfront.net/heartbleed/router/Recommended-CA2.zip',
      'supportsProfileUpload': false,
      'supportsCatalogRefresh': true,
      'credentialFields': [
        {
          'key': 'username',
          'label': 'VPN username',
          'kind': 'text',
          'secret': false,
          'required': true,
          'description': 'The generated manual-connection username from the PureVPN member area.',
        },
        {
          'key': 'password',
          'label': 'VPN password',
          'kind': 'password',
          'secret': true,
          'required': true,
          'description': 'The generated manual-connection password from the PureVPN member area.',
        },
      ],
    }],
  },
  {
    'id': 'pia',
    'displayName': 'Private Internet Access',
    'description': 'Use PIA\'s official strong UDP and TCP location catalogs.',
    'supportsPortForwarding': false,
    'p2p': {
      'restricted': false,
      'note': 'Private Internet Access allows P2P on every server.',
      'linkLabel': 'See PIA\'s server list',
      'url': 'https://www.privateinternetaccess.com/vpn-server',
    },
    'tunnels': [{
      'id': 'openvpn',
      'description': 'Use PIA\'s official strong UDP and TCP location catalogs.',
      'catalogSource': 'https://www.privateinternetaccess.com/openvpn/openvpn-strong.zip',
      'supportsProfileUpload': false,
      'supportsCatalogRefresh': true,
      'credentialFields': [
        {
          'key': 'username',
          'label': 'VPN username',
          'kind': 'text',
          'secret': false,
          'required': true,
          'description': 'The PIA service username used for manual OpenVPN connections.',
        },
        {
          'key': 'password',
          'label': 'VPN password',
          'kind': 'password',
          'secret': true,
          'required': true,
          'description': 'The PIA service password used for manual OpenVPN connections.',
        },
      ],
      'catalog': {
        'providerId': 'pia',
        'tunnel': 'openvpn',
        'sourceUrl': 'https://www.privateinternetaccess.com/openvpn/openvpn-strong.zip',
        'endpointCount': 14,
        'refreshedAt': '2026-10-20T09:14:00Z',
      },
    }],
  },
  {
    'id': 'ipvanish',
    'displayName': 'IPVanish',
    'description': 'Use IPVanish\'s official OpenVPN 2.6 server catalog.',
    'supportsPortForwarding': false,
    'p2p': null,
    'tunnels': [{
      'id': 'openvpn',
      'description': 'Use IPVanish\'s official OpenVPN 2.6 server catalog.',
      'catalogSource': 'https://configs.ipvanish.com/openvpn/v2.6.0-0/configs.zip',
      'supportsProfileUpload': false,
      'supportsCatalogRefresh': true,
      'credentialFields': [
        {
          'key': 'username',
          'label': 'VPN username',
          'kind': 'text',
          'secret': false,
          'required': true,
          'description': 'The username associated with the IPVanish subscription.',
        },
        {
          'key': 'password',
          'label': 'VPN password',
          'kind': 'password',
          'secret': true,
          'required': true,
          'description': 'The password associated with the IPVanish subscription.',
        },
      ],
    }],
  },
  {
    'id': 'nordvpn',
    'displayName': 'NordVPN',
    'description': 'Use NordVPN\'s official OpenVPN and WireGuard server catalogs.',
    'supportsPortForwarding': false,
    'p2p': {
      'restricted': false,
      'note': 'NordVPN allows P2P on all of its standard servers.',
      'linkLabel': 'Read NordVPN\'s P2P answer',
      'url': 'https://support.nordvpn.com/hc/en-us/articles/45840292778897-I-can-t-find-NordVPN-P2P-servers',
    },
    'tunnels': [
      {
        'id': 'openvpn',
        'description': 'Use NordVPN\'s official OpenVPN 2.6 server catalog.',
        'catalogSource': 'https://downloads.nordcdn.com/configs/archives/servers/ovpn.zip',
        'supportsProfileUpload': false,
        'supportsCatalogRefresh': true,
        'credentialFields': [
          {
            'key': 'username',
            'label': 'VPN username',
            'kind': 'text',
            'secret': false,
            'required': true,
            'description': 'The service username from the manual setup section of your Nord Account.',
          },
          {
            'key': 'password',
            'label': 'VPN password',
            'kind': 'password',
            'secret': true,
            'required': true,
            'description': 'The service password from the manual setup section of your Nord Account.',
          },
        ],
      },
      {
        'id': 'wireguard',
        'description': 'Use NordVPN\'s official WireGuard server list.',
        'catalogSource': 'https://api.nordvpn.com/v2/servers?limit=0',
        'supportsProfileUpload': false,
        'supportsCatalogRefresh': true,
        'credentialFields': [{
          'key': 'privateKey',
          'label': 'Private key',
          'kind': 'wireguard-key',
          'secret': true,
          'required': true,
          'description': 'The PrivateKey line from a WireGuard file downloaded in your Nord Account under Set up NordVPN manually.',
        }],
      },
    ],
  },
  {
    'id': 'surfshark',
    'displayName': 'Surfshark',
    'description': 'Use Surfshark\'s official OpenVPN and WireGuard location catalogs.',
    'supportsPortForwarding': false,
    'p2p': {
      'restricted': true,
      'note': 'Surfshark\'s server list marks which locations allow P2P.',
      'linkLabel': 'See Surfshark\'s server list',
      'url': 'https://surfshark.com/servers',
    },
    'tunnels': [
      {
        'id': 'openvpn',
        'description': 'Use Surfshark\'s official OpenVPN location catalog.',
        'catalogSource': 'https://my.surfshark.com/vpn/api/v1/server/configurations',
        'supportsProfileUpload': false,
        'supportsCatalogRefresh': true,
        'credentialFields': [
          {
            'key': 'username',
            'label': 'VPN username',
            'kind': 'text',
            'secret': false,
            'required': true,
            'description': 'The service username from the manual setup page of your Surfshark account.',
          },
          {
            'key': 'password',
            'label': 'VPN password',
            'kind': 'password',
            'secret': true,
            'required': true,
            'description': 'The service password from the manual setup page of your Surfshark account.',
          },
        ],
      },
      {
        'id': 'wireguard',
        'description': 'Use Surfshark\'s official WireGuard location list.',
        'catalogSource': 'https://api.surfshark.com/v4/server/clusters/generic',
        'supportsProfileUpload': false,
        'supportsCatalogRefresh': true,
        'credentialFields': [
          {
            'key': 'privateKey',
            'label': 'Private key',
            'kind': 'wireguard-key',
            'secret': true,
            'required': true,
            'description': 'The private key of a WireGuard key pair from the manual setup page of your Surfshark account.',
          },
          {
            'key': 'address',
            'label': 'Tunnel address',
            'kind': 'ipv4-address',
            'secret': false,
            'required': false,
            'description': 'Leave empty to use 10.14.0.2/16, the address in Surfshark\'s WireGuard files.',
          },
        ],
      },
    ],
  },
  {
    'id': 'ivpn',
    'displayName': 'IVPN',
    'description': 'Use IVPN\'s official OpenVPN and WireGuard location catalogs.',
    'supportsPortForwarding': false,
    'p2p': {
      'restricted': true,
      'note': 'IVPN asks P2P users to avoid its US servers.',
      'linkLabel': 'Read IVPN\'s P2P answer',
      'url': 'https://www.ivpn.net/knowledgebase/general/do-you-allow-p2p-or-bittorrent-or-torrents-downloading/',
    },
    'tunnels': [
      {
        'id': 'openvpn',
        'description': 'Use IVPN\'s official OpenVPN UDP and TCP location catalogs.',
        'catalogSource': 'https://api.ivpn.net/v5/config/ivpn-openvpn-config.zip?proto=udp&port=2049',
        'supportsProfileUpload': false,
        'supportsCatalogRefresh': true,
        'credentialFields': [
          {
            'key': 'username',
            'label': 'Account ID',
            'kind': 'text',
            'secret': false,
            'required': true,
            'description': 'Your IVPN account ID, such as i-XXXX-XXXX-XXXX.',
          },
          {
            'key': 'password',
            'label': 'VPN password',
            'kind': 'password',
            'secret': true,
            'required': true,
            'description': 'IVPN doesn\'t check it. Enter any value, such as ivpn.',
          },
        ],
      },
      {
        'id': 'wireguard',
        'description': 'Use IVPN\'s official WireGuard server list.',
        'catalogSource': 'https://api.ivpn.net/v4/servers/stats',
        'supportsProfileUpload': false,
        'supportsCatalogRefresh': true,
        'credentialFields': [
          {
            'key': 'privateKey',
            'label': 'Private key',
            'kind': 'wireguard-key',
            'secret': true,
            'required': true,
            'description': 'The private key of the WireGuard key you added under WireGuard in your IVPN account.',
          },
          {
            'key': 'address',
            'label': 'Tunnel address',
            'kind': 'ipv4-address',
            'secret': false,
            'required': true,
            'description': 'The IP address IVPN assigned to that key, such as 172.20.12.34/32.',
          },
        ],
      },
    ],
  },
  {
    'id': 'mullvad',
    'displayName': 'Mullvad',
    'description': 'Use Mullvad\'s official WireGuard relay list.',
    'supportsPortForwarding': false,
    'p2p': null,
    'tunnels': [{
      'id': 'wireguard',
      'description': 'Use Mullvad\'s official WireGuard relay list.',
      'catalogSource': 'https://api.mullvad.net/www/relays/all/',
      'supportsProfileUpload': false,
      'supportsCatalogRefresh': true,
      'credentialFields': [
        {
          'key': 'privateKey',
          'label': 'Private key',
          'kind': 'wireguard-key',
          'secret': true,
          'required': true,
          'description': 'The PrivateKey line from a WireGuard file generated in your Mullvad account.',
        },
        {
          'key': 'address',
          'label': 'Tunnel address',
          'kind': 'ipv4-address',
          'secret': false,
          'required': true,
          'description': 'The IPv4 Address line from that file, such as 10.68.12.34/32.',
        },
      ],
      'catalog': {
        'providerId': 'mullvad',
        'tunnel': 'wireguard',
        'sourceUrl': 'https://api.mullvad.net/www/relays/all/',
        'endpointCount': 6,
        'refreshedAt': '2026-10-28T16:40:00Z',
      },
    }],
  },
  {
    'id': 'northwind',
    'displayName': 'Northwind VPN',
    'description': 'Use Northwind\'s UDP and TCP OpenVPN location catalog.',
    'supportsPortForwarding': false,
    'p2p': {
      'restricted': false,
      'note': 'Northwind VPN allows P2P on every server.',
      'linkLabel': 'See Northwind\'s server list',
      'url': 'https://northwind.example/servers',
    },
    'tunnels': [{
      'id': 'openvpn',
      'description': 'Use Northwind\'s UDP and TCP OpenVPN location catalog.',
      'catalogSource': 'https://northwind.example/openvpn/catalog.zip',
      'supportsProfileUpload': false,
      'supportsCatalogRefresh': true,
      'credentialFields': [
        {
          'key': 'username',
          'label': 'VPN username',
          'kind': 'text',
          'secret': false,
          'required': true,
          'description': 'The Northwind service username used for manual OpenVPN connections.',
        },
        {
          'key': 'password',
          'label': 'VPN password',
          'kind': 'password',
          'secret': true,
          'required': true,
          'description': 'The Northwind service password used for manual OpenVPN connections.',
        },
      ],
      'catalog': {
        'providerId': 'northwind',
        'tunnel': 'openvpn',
        'sourceUrl': 'https://northwind.example/openvpn/catalog.zip',
        'endpointCount': 14,
        'refreshedAt': '2026-10-20T09:14:00Z',
      },
    }],
  },
  {
    'id': 'fabrikam',
    'displayName': 'Fabrikam VPN',
    'description': 'Use Fabrikam\'s WireGuard relay list.',
    'supportsPortForwarding': false,
    'p2p': null,
    'tunnels': [{
      'id': 'wireguard',
      'description': 'Use Fabrikam\'s WireGuard relay list.',
      'catalogSource': 'https://fabrikam.example/wireguard/relays',
      'supportsProfileUpload': false,
      'supportsCatalogRefresh': true,
      'credentialFields': [
        {
          'key': 'privateKey',
          'label': 'Private key',
          'kind': 'wireguard-key',
          'secret': true,
          'required': true,
          'description': 'The PrivateKey line from a WireGuard file generated in your Fabrikam account.',
        },
        {
          'key': 'address',
          'label': 'Tunnel address',
          'kind': 'ipv4-address',
          'secret': false,
          'required': true,
          'description': 'The IPv4 Address line from that file, such as 10.68.12.34/32.',
        },
      ],
      'catalog': {
        'providerId': 'fabrikam',
        'tunnel': 'wireguard',
        'sourceUrl': 'https://fabrikam.example/wireguard/relays',
        'endpointCount': 6,
        'refreshedAt': '2026-10-28T16:40:00Z',
      },
    }],
  },
  {
    'id': 'contoso',
    'displayName': 'Contoso VPN',
    'description': 'Use Contoso\'s OpenVPN and WireGuard location catalogs.',
    'supportsPortForwarding': false,
    'p2p': {
      'restricted': true,
      'note': 'Contoso VPN allows P2P only on the servers it marks for P2P.',
      'linkLabel': 'See Contoso\'s P2P servers',
      'url': 'https://contoso.example/p2p',
    },
    'tunnels': [
      {
        'id': 'openvpn',
        'description': 'Use Contoso\'s OpenVPN UDP and TCP location catalogs.',
        'catalogSource': 'https://contoso.example/openvpn/catalog.zip',
        'supportsProfileUpload': false,
        'supportsCatalogRefresh': true,
        'credentialFields': [
          {
            'key': 'username',
            'label': 'Account ID',
            'kind': 'text',
            'secret': false,
            'required': true,
            'description': 'Your Contoso account ID, such as c-XXXX-XXXX-XXXX.',
          },
          {
            'key': 'password',
            'label': 'VPN password',
            'kind': 'password',
            'secret': true,
            'required': true,
            'description': 'Contoso doesn\'t check it. Enter any value, such as contoso.',
          },
        ],
        'catalog': {
          'providerId': 'contoso',
          'tunnel': 'openvpn',
          'sourceUrl': 'https://contoso.example/openvpn/catalog.zip',
          'endpointCount': 1,
          'refreshedAt': '2026-10-30T12:00:00Z',
        },
      },
      {
        'id': 'wireguard',
        'description': 'Use Contoso\'s WireGuard server list.',
        'catalogSource': 'https://contoso.example/wireguard/servers',
        'supportsProfileUpload': false,
        'supportsCatalogRefresh': true,
        'credentialFields': [
          {
            'key': 'privateKey',
            'label': 'Private key',
            'kind': 'wireguard-key',
            'secret': true,
            'required': true,
            'description': 'The private key of the WireGuard key you added under WireGuard in your Contoso account.',
          },
          {
            'key': 'address',
            'label': 'Tunnel address',
            'kind': 'ipv4-address',
            'secret': false,
            'required': true,
            'description': 'The IP address Contoso assigned to that key, such as 172.20.12.34/32.',
          },
        ],
      },
    ],
  },
];

/**
 * Mock API - Profiles.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const profiles: Record<string, unknown>[] = [
  {
    'id': 'pia-ca-toronto-udp',
    'providerId': 'pia',
    'tunnel': 'openvpn',
    'displayName': 'Toronto, Canada',
    'countryCode': 'CA',
    'country': 'Canada',
    'city': 'Toronto',
    'continent': 'North America',
    'protocol': 'udp',
    'remoteHost': 'ca-toronto.privacy.network',
    'remotePort': 1198,
    'fingerprint': 'sha256:ab12ab12ab12ab12ab12ab12ab12ab12',
    'source': 'catalog',
    'updatedAt': '2026-10-20T09:14:00Z',
  },
  {
    'id': 'pia-ca-toronto-tcp',
    'providerId': 'pia',
    'tunnel': 'openvpn',
    'displayName': 'Toronto, Canada',
    'countryCode': 'CA',
    'country': 'Canada',
    'city': 'Toronto',
    'continent': 'North America',
    'protocol': 'tcp',
    'remoteHost': 'ca-toronto.privacy.network',
    'remotePort': 502,
    'fingerprint': 'sha256:ab12ab12ab12ab12ab12ab12ab12ab12',
    'source': 'catalog',
    'updatedAt': '2026-10-20T09:14:00Z',
  },
  {
    'id': 'pia-ca-montreal-udp',
    'providerId': 'pia',
    'tunnel': 'openvpn',
    'displayName': 'Montreal, Canada',
    'countryCode': 'CA',
    'country': 'Canada',
    'city': 'Montreal',
    'continent': 'North America',
    'protocol': 'udp',
    'remoteHost': 'ca-montreal.privacy.network',
    'remotePort': 1198,
    'fingerprint': 'sha256:ab12ab12ab12ab12ab12ab12ab12ab12',
    'source': 'catalog',
    'updatedAt': '2026-10-20T09:14:00Z',
  },
  {
    'id': 'pia-ca-montreal-tcp',
    'providerId': 'pia',
    'tunnel': 'openvpn',
    'displayName': 'Montreal, Canada',
    'countryCode': 'CA',
    'country': 'Canada',
    'city': 'Montreal',
    'continent': 'North America',
    'protocol': 'tcp',
    'remoteHost': 'ca-montreal.privacy.network',
    'remotePort': 502,
    'fingerprint': 'sha256:ab12ab12ab12ab12ab12ab12ab12ab12',
    'source': 'catalog',
    'updatedAt': '2026-10-20T09:14:00Z',
  },
  {
    'id': 'pia-ca-vancouver-udp',
    'providerId': 'pia',
    'tunnel': 'openvpn',
    'displayName': 'Vancouver, Canada',
    'countryCode': 'CA',
    'country': 'Canada',
    'city': 'Vancouver',
    'continent': 'North America',
    'protocol': 'udp',
    'remoteHost': 'ca-vancouver.privacy.network',
    'remotePort': 1198,
    'fingerprint': 'sha256:ab12ab12ab12ab12ab12ab12ab12ab12',
    'source': 'catalog',
    'updatedAt': '2026-10-20T09:14:00Z',
  },
  {
    'id': 'pia-ca-vancouver-tcp',
    'providerId': 'pia',
    'tunnel': 'openvpn',
    'displayName': 'Vancouver, Canada',
    'countryCode': 'CA',
    'country': 'Canada',
    'city': 'Vancouver',
    'continent': 'North America',
    'protocol': 'tcp',
    'remoteHost': 'ca-vancouver.privacy.network',
    'remotePort': 502,
    'fingerprint': 'sha256:ab12ab12ab12ab12ab12ab12ab12ab12',
    'source': 'catalog',
    'updatedAt': '2026-10-20T09:14:00Z',
  },
  {
    'id': 'pia-us-newyork-udp',
    'providerId': 'pia',
    'tunnel': 'openvpn',
    'displayName': 'New York, United States',
    'countryCode': 'US',
    'country': 'United States',
    'city': 'New York',
    'continent': 'North America',
    'protocol': 'udp',
    'remoteHost': 'us-newyork.privacy.network',
    'remotePort': 1198,
    'fingerprint': 'sha256:ab12ab12ab12ab12ab12ab12ab12ab12',
    'source': 'catalog',
    'updatedAt': '2026-10-20T09:14:00Z',
  },
  {
    'id': 'pia-us-newyork-tcp',
    'providerId': 'pia',
    'tunnel': 'openvpn',
    'displayName': 'New York, United States',
    'countryCode': 'US',
    'country': 'United States',
    'city': 'New York',
    'continent': 'North America',
    'protocol': 'tcp',
    'remoteHost': 'us-newyork.privacy.network',
    'remotePort': 502,
    'fingerprint': 'sha256:ab12ab12ab12ab12ab12ab12ab12ab12',
    'source': 'catalog',
    'updatedAt': '2026-10-20T09:14:00Z',
  },
  {
    'id': 'pia-nl-amsterdam-udp',
    'providerId': 'pia',
    'tunnel': 'openvpn',
    'displayName': 'Amsterdam, Netherlands',
    'countryCode': 'NL',
    'country': 'Netherlands',
    'city': 'Amsterdam',
    'continent': 'Europe',
    'protocol': 'udp',
    'remoteHost': 'nl-amsterdam.privacy.network',
    'remotePort': 1198,
    'fingerprint': 'sha256:ab12ab12ab12ab12ab12ab12ab12ab12',
    'source': 'catalog',
    'updatedAt': '2026-10-20T09:14:00Z',
  },
  {
    'id': 'pia-nl-amsterdam-tcp',
    'providerId': 'pia',
    'tunnel': 'openvpn',
    'displayName': 'Amsterdam, Netherlands',
    'countryCode': 'NL',
    'country': 'Netherlands',
    'city': 'Amsterdam',
    'continent': 'Europe',
    'protocol': 'tcp',
    'remoteHost': 'nl-amsterdam.privacy.network',
    'remotePort': 502,
    'fingerprint': 'sha256:ab12ab12ab12ab12ab12ab12ab12ab12',
    'source': 'catalog',
    'updatedAt': '2026-10-20T09:14:00Z',
  },
  {
    'id': 'pia-de-frankfurt-udp',
    'providerId': 'pia',
    'tunnel': 'openvpn',
    'displayName': 'Frankfurt, Germany',
    'countryCode': 'DE',
    'country': 'Germany',
    'city': 'Frankfurt',
    'continent': 'Europe',
    'protocol': 'udp',
    'remoteHost': 'de-frankfurt.privacy.network',
    'remotePort': 1198,
    'fingerprint': 'sha256:ab12ab12ab12ab12ab12ab12ab12ab12',
    'source': 'catalog',
    'updatedAt': '2026-10-20T09:14:00Z',
  },
  {
    'id': 'pia-de-frankfurt-tcp',
    'providerId': 'pia',
    'tunnel': 'openvpn',
    'displayName': 'Frankfurt, Germany',
    'countryCode': 'DE',
    'country': 'Germany',
    'city': 'Frankfurt',
    'continent': 'Europe',
    'protocol': 'tcp',
    'remoteHost': 'de-frankfurt.privacy.network',
    'remotePort': 502,
    'fingerprint': 'sha256:ab12ab12ab12ab12ab12ab12ab12ab12',
    'source': 'catalog',
    'updatedAt': '2026-10-20T09:14:00Z',
  },
  {
    'id': 'pia-jp-tokyo-udp',
    'providerId': 'pia',
    'tunnel': 'openvpn',
    'displayName': 'Tokyo, Japan',
    'countryCode': 'JP',
    'country': 'Japan',
    'city': 'Tokyo',
    'continent': 'Asia',
    'protocol': 'udp',
    'remoteHost': 'jp-tokyo.privacy.network',
    'remotePort': 1198,
    'fingerprint': 'sha256:ab12ab12ab12ab12ab12ab12ab12ab12',
    'source': 'catalog',
    'updatedAt': '2026-10-20T09:14:00Z',
  },
  {
    'id': 'pia-jp-tokyo-tcp',
    'providerId': 'pia',
    'tunnel': 'openvpn',
    'displayName': 'Tokyo, Japan',
    'countryCode': 'JP',
    'country': 'Japan',
    'city': 'Tokyo',
    'continent': 'Asia',
    'protocol': 'tcp',
    'remoteHost': 'jp-tokyo.privacy.network',
    'remotePort': 502,
    'fingerprint': 'sha256:ab12ab12ab12ab12ab12ab12ab12ab12',
    'source': 'catalog',
    'updatedAt': '2026-10-20T09:14:00Z',
  },
  {
    'id': 'mullvad:wg-se-sto-wg-001:000000000001',
    'providerId': 'mullvad',
    'tunnel': 'wireguard',
    'displayName': 'Sweden — Stockholm · SE-STO-WG-001',
    'countryCode': 'SE',
    'country': 'Sweden',
    'city': 'Stockholm',
    'continent': 'Europe',
    'protocol': 'udp',
    'remoteHost': '185.213.154.68',
    'remotePort': 51820,
    'fingerprint': 'sha256:cd34cd34cd34cd34cd34cd34cd34cd34',
    'source': 'catalog',
    'updatedAt': '2026-10-28T16:40:00Z',
  },
  {
    'id': 'mullvad:wg-se-got-wg-101:000000000002',
    'providerId': 'mullvad',
    'tunnel': 'wireguard',
    'displayName': 'Sweden — Gothenburg · SE-GOT-WG-101',
    'countryCode': 'SE',
    'country': 'Sweden',
    'city': 'Gothenburg',
    'continent': 'Europe',
    'protocol': 'udp',
    'remoteHost': '185.213.154.131',
    'remotePort': 51820,
    'fingerprint': 'sha256:cd34cd34cd34cd34cd34cd34cd34cd34',
    'source': 'catalog',
    'updatedAt': '2026-10-28T16:40:00Z',
  },
  {
    'id': 'mullvad:wg-gb-lon-wg-002:000000000003',
    'providerId': 'mullvad',
    'tunnel': 'wireguard',
    'displayName': 'United Kingdom — London · GB-LON-WG-002',
    'countryCode': 'GB',
    'country': 'United Kingdom',
    'city': 'London',
    'continent': 'Europe',
    'protocol': 'udp',
    'remoteHost': '141.98.252.130',
    'remotePort': 51820,
    'fingerprint': 'sha256:cd34cd34cd34cd34cd34cd34cd34cd34',
    'source': 'catalog',
    'updatedAt': '2026-10-28T16:40:00Z',
  },
  {
    'id': 'mullvad:wg-de-fra-wg-005:000000000004',
    'providerId': 'mullvad',
    'tunnel': 'wireguard',
    'displayName': 'Germany — Frankfurt · DE-FRA-WG-005',
    'countryCode': 'DE',
    'country': 'Germany',
    'city': 'Frankfurt',
    'continent': 'Europe',
    'protocol': 'udp',
    'remoteHost': '193.27.14.18',
    'remotePort': 51820,
    'fingerprint': 'sha256:cd34cd34cd34cd34cd34cd34cd34cd34',
    'source': 'catalog',
    'updatedAt': '2026-10-28T16:40:00Z',
  },
  {
    'id': 'mullvad:wg-us-nyc-wg-301:000000000005',
    'providerId': 'mullvad',
    'tunnel': 'wireguard',
    'displayName': 'United States — New York, NY · US-NYC-WG-301',
    'countryCode': 'US',
    'country': 'United States',
    'city': 'New York, NY',
    'continent': 'North America',
    'protocol': 'udp',
    'remoteHost': '143.244.47.65',
    'remotePort': 51820,
    'fingerprint': 'sha256:cd34cd34cd34cd34cd34cd34cd34cd34',
    'source': 'catalog',
    'updatedAt': '2026-10-28T16:40:00Z',
  },
  {
    'id': 'mullvad:wg-jp-tyo-wg-201:000000000006',
    'providerId': 'mullvad',
    'tunnel': 'wireguard',
    'displayName': 'Japan — Tokyo · JP-TYO-WG-201',
    'countryCode': 'JP',
    'country': 'Japan',
    'city': 'Tokyo',
    'continent': 'Asia',
    'protocol': 'udp',
    'remoteHost': '138.199.21.239',
    'remotePort': 51820,
    'fingerprint': 'sha256:cd34cd34cd34cd34cd34cd34cd34cd34',
    'source': 'catalog',
    'updatedAt': '2026-10-28T16:40:00Z',
  },
  {
    'id': 'ivpn:ovpn-de-fra-001:000000000007',
    'providerId': 'ivpn',
    'tunnel': 'openvpn',
    'displayName': 'Frankfurt, Germany',
    'countryCode': 'DE',
    'country': 'Germany',
    'city': 'Frankfurt',
    'continent': 'Europe',
    'protocol': 'udp',
    'remoteHost': 'de1.gw.ivpn.net',
    'remotePort': 2049,
    'fingerprint': 'sha256:ef56ef56ef56ef56ef56ef56ef56ef56',
    'source': 'catalog',
    'updatedAt': '2026-10-30T12:00:00Z',
  },
  {
    'id': 'northwind-ca-toronto-udp',
    'providerId': 'northwind',
    'tunnel': 'openvpn',
    'displayName': 'Toronto, Canada',
    'countryCode': 'CA',
    'country': 'Canada',
    'city': 'Toronto',
    'continent': 'North America',
    'protocol': 'udp',
    'remoteHost': 'toronto.northwind.example',
    'remotePort': 1194,
    'fingerprint': 'sha256:ab12ab12ab12ab12ab12ab12ab12ab12',
    'source': 'catalog',
    'updatedAt': '2026-10-20T09:14:00Z',
  },
  {
    'id': 'northwind-ca-toronto-tcp',
    'providerId': 'northwind',
    'tunnel': 'openvpn',
    'displayName': 'Toronto, Canada',
    'countryCode': 'CA',
    'country': 'Canada',
    'city': 'Toronto',
    'continent': 'North America',
    'protocol': 'tcp',
    'remoteHost': 'toronto.northwind.example',
    'remotePort': 443,
    'fingerprint': 'sha256:ab12ab12ab12ab12ab12ab12ab12ab12',
    'source': 'catalog',
    'updatedAt': '2026-10-20T09:14:00Z',
  },
  {
    'id': 'northwind-ca-montreal-udp',
    'providerId': 'northwind',
    'tunnel': 'openvpn',
    'displayName': 'Montreal, Canada',
    'countryCode': 'CA',
    'country': 'Canada',
    'city': 'Montreal',
    'continent': 'North America',
    'protocol': 'udp',
    'remoteHost': 'montreal.northwind.example',
    'remotePort': 1194,
    'fingerprint': 'sha256:ab12ab12ab12ab12ab12ab12ab12ab12',
    'source': 'catalog',
    'updatedAt': '2026-10-20T09:14:00Z',
  },
  {
    'id': 'northwind-ca-montreal-tcp',
    'providerId': 'northwind',
    'tunnel': 'openvpn',
    'displayName': 'Montreal, Canada',
    'countryCode': 'CA',
    'country': 'Canada',
    'city': 'Montreal',
    'continent': 'North America',
    'protocol': 'tcp',
    'remoteHost': 'montreal.northwind.example',
    'remotePort': 443,
    'fingerprint': 'sha256:ab12ab12ab12ab12ab12ab12ab12ab12',
    'source': 'catalog',
    'updatedAt': '2026-10-20T09:14:00Z',
  },
  {
    'id': 'northwind-ca-vancouver-udp',
    'providerId': 'northwind',
    'tunnel': 'openvpn',
    'displayName': 'Vancouver, Canada',
    'countryCode': 'CA',
    'country': 'Canada',
    'city': 'Vancouver',
    'continent': 'North America',
    'protocol': 'udp',
    'remoteHost': 'vancouver.northwind.example',
    'remotePort': 1194,
    'fingerprint': 'sha256:ab12ab12ab12ab12ab12ab12ab12ab12',
    'source': 'catalog',
    'updatedAt': '2026-10-20T09:14:00Z',
  },
  {
    'id': 'northwind-ca-vancouver-tcp',
    'providerId': 'northwind',
    'tunnel': 'openvpn',
    'displayName': 'Vancouver, Canada',
    'countryCode': 'CA',
    'country': 'Canada',
    'city': 'Vancouver',
    'continent': 'North America',
    'protocol': 'tcp',
    'remoteHost': 'vancouver.northwind.example',
    'remotePort': 443,
    'fingerprint': 'sha256:ab12ab12ab12ab12ab12ab12ab12ab12',
    'source': 'catalog',
    'updatedAt': '2026-10-20T09:14:00Z',
  },
  {
    'id': 'northwind-us-new-york-udp',
    'providerId': 'northwind',
    'tunnel': 'openvpn',
    'displayName': 'New York, United States',
    'countryCode': 'US',
    'country': 'United States',
    'city': 'New York',
    'continent': 'North America',
    'protocol': 'udp',
    'remoteHost': 'new-york.northwind.example',
    'remotePort': 1194,
    'fingerprint': 'sha256:ab12ab12ab12ab12ab12ab12ab12ab12',
    'source': 'catalog',
    'updatedAt': '2026-10-20T09:14:00Z',
  },
  {
    'id': 'northwind-us-new-york-tcp',
    'providerId': 'northwind',
    'tunnel': 'openvpn',
    'displayName': 'New York, United States',
    'countryCode': 'US',
    'country': 'United States',
    'city': 'New York',
    'continent': 'North America',
    'protocol': 'tcp',
    'remoteHost': 'new-york.northwind.example',
    'remotePort': 443,
    'fingerprint': 'sha256:ab12ab12ab12ab12ab12ab12ab12ab12',
    'source': 'catalog',
    'updatedAt': '2026-10-20T09:14:00Z',
  },
  {
    'id': 'northwind-nl-amsterdam-udp',
    'providerId': 'northwind',
    'tunnel': 'openvpn',
    'displayName': 'Amsterdam, Netherlands',
    'countryCode': 'NL',
    'country': 'Netherlands',
    'city': 'Amsterdam',
    'continent': 'Europe',
    'protocol': 'udp',
    'remoteHost': 'amsterdam.northwind.example',
    'remotePort': 1194,
    'fingerprint': 'sha256:ab12ab12ab12ab12ab12ab12ab12ab12',
    'source': 'catalog',
    'updatedAt': '2026-10-20T09:14:00Z',
  },
  {
    'id': 'northwind-nl-amsterdam-tcp',
    'providerId': 'northwind',
    'tunnel': 'openvpn',
    'displayName': 'Amsterdam, Netherlands',
    'countryCode': 'NL',
    'country': 'Netherlands',
    'city': 'Amsterdam',
    'continent': 'Europe',
    'protocol': 'tcp',
    'remoteHost': 'amsterdam.northwind.example',
    'remotePort': 443,
    'fingerprint': 'sha256:ab12ab12ab12ab12ab12ab12ab12ab12',
    'source': 'catalog',
    'updatedAt': '2026-10-20T09:14:00Z',
  },
  {
    'id': 'northwind-de-frankfurt-udp',
    'providerId': 'northwind',
    'tunnel': 'openvpn',
    'displayName': 'Frankfurt, Germany',
    'countryCode': 'DE',
    'country': 'Germany',
    'city': 'Frankfurt',
    'continent': 'Europe',
    'protocol': 'udp',
    'remoteHost': 'frankfurt.northwind.example',
    'remotePort': 1194,
    'fingerprint': 'sha256:ab12ab12ab12ab12ab12ab12ab12ab12',
    'source': 'catalog',
    'updatedAt': '2026-10-20T09:14:00Z',
  },
  {
    'id': 'northwind-de-frankfurt-tcp',
    'providerId': 'northwind',
    'tunnel': 'openvpn',
    'displayName': 'Frankfurt, Germany',
    'countryCode': 'DE',
    'country': 'Germany',
    'city': 'Frankfurt',
    'continent': 'Europe',
    'protocol': 'tcp',
    'remoteHost': 'frankfurt.northwind.example',
    'remotePort': 443,
    'fingerprint': 'sha256:ab12ab12ab12ab12ab12ab12ab12ab12',
    'source': 'catalog',
    'updatedAt': '2026-10-20T09:14:00Z',
  },
  {
    'id': 'northwind-jp-tokyo-udp',
    'providerId': 'northwind',
    'tunnel': 'openvpn',
    'displayName': 'Tokyo, Japan',
    'countryCode': 'JP',
    'country': 'Japan',
    'city': 'Tokyo',
    'continent': 'Asia',
    'protocol': 'udp',
    'remoteHost': 'tokyo.northwind.example',
    'remotePort': 1194,
    'fingerprint': 'sha256:ab12ab12ab12ab12ab12ab12ab12ab12',
    'source': 'catalog',
    'updatedAt': '2026-10-20T09:14:00Z',
  },
  {
    'id': 'northwind-jp-tokyo-tcp',
    'providerId': 'northwind',
    'tunnel': 'openvpn',
    'displayName': 'Tokyo, Japan',
    'countryCode': 'JP',
    'country': 'Japan',
    'city': 'Tokyo',
    'continent': 'Asia',
    'protocol': 'tcp',
    'remoteHost': 'tokyo.northwind.example',
    'remotePort': 443,
    'fingerprint': 'sha256:ab12ab12ab12ab12ab12ab12ab12ab12',
    'source': 'catalog',
    'updatedAt': '2026-10-20T09:14:00Z',
  },
  {
    'id': 'fabrikam:wg-se-sto-wg-001:000000000001',
    'providerId': 'fabrikam',
    'tunnel': 'wireguard',
    'displayName': 'Sweden — Stockholm · SE-STO-WG-001',
    'countryCode': 'SE',
    'country': 'Sweden',
    'city': 'Stockholm',
    'continent': 'Europe',
    'protocol': 'udp',
    'remoteHost': 'se-sto-wg-001.fabrikam.example',
    'remotePort': 51820,
    'fingerprint': 'sha256:cd34cd34cd34cd34cd34cd34cd34cd34',
    'source': 'catalog',
    'updatedAt': '2026-10-28T16:40:00Z',
  },
  {
    'id': 'fabrikam:wg-se-got-wg-101:000000000002',
    'providerId': 'fabrikam',
    'tunnel': 'wireguard',
    'displayName': 'Sweden — Gothenburg · SE-GOT-WG-101',
    'countryCode': 'SE',
    'country': 'Sweden',
    'city': 'Gothenburg',
    'continent': 'Europe',
    'protocol': 'udp',
    'remoteHost': 'se-got-wg-101.fabrikam.example',
    'remotePort': 51820,
    'fingerprint': 'sha256:cd34cd34cd34cd34cd34cd34cd34cd34',
    'source': 'catalog',
    'updatedAt': '2026-10-28T16:40:00Z',
  },
  {
    'id': 'fabrikam:wg-gb-lon-wg-002:000000000003',
    'providerId': 'fabrikam',
    'tunnel': 'wireguard',
    'displayName': 'United Kingdom — London · GB-LON-WG-002',
    'countryCode': 'GB',
    'country': 'United Kingdom',
    'city': 'London',
    'continent': 'Europe',
    'protocol': 'udp',
    'remoteHost': 'gb-lon-wg-002.fabrikam.example',
    'remotePort': 51820,
    'fingerprint': 'sha256:cd34cd34cd34cd34cd34cd34cd34cd34',
    'source': 'catalog',
    'updatedAt': '2026-10-28T16:40:00Z',
  },
  {
    'id': 'fabrikam:wg-de-fra-wg-005:000000000004',
    'providerId': 'fabrikam',
    'tunnel': 'wireguard',
    'displayName': 'Germany — Frankfurt · DE-FRA-WG-005',
    'countryCode': 'DE',
    'country': 'Germany',
    'city': 'Frankfurt',
    'continent': 'Europe',
    'protocol': 'udp',
    'remoteHost': 'de-fra-wg-005.fabrikam.example',
    'remotePort': 51820,
    'fingerprint': 'sha256:cd34cd34cd34cd34cd34cd34cd34cd34',
    'source': 'catalog',
    'updatedAt': '2026-10-28T16:40:00Z',
  },
  {
    'id': 'fabrikam:wg-us-nyc-wg-001:000000000005',
    'providerId': 'fabrikam',
    'tunnel': 'wireguard',
    'displayName': 'United States — New York, NY · US-NYC-WG-001',
    'countryCode': 'US',
    'country': 'United States',
    'city': 'New York, NY',
    'continent': 'North America',
    'protocol': 'udp',
    'remoteHost': 'us-nyc-wg-001.fabrikam.example',
    'remotePort': 51820,
    'fingerprint': 'sha256:cd34cd34cd34cd34cd34cd34cd34cd34',
    'source': 'catalog',
    'updatedAt': '2026-10-28T16:40:00Z',
  },
  {
    'id': 'fabrikam:wg-jp-tyo-wg-201:000000000006',
    'providerId': 'fabrikam',
    'tunnel': 'wireguard',
    'displayName': 'Japan — Tokyo · JP-TYO-WG-201',
    'countryCode': 'JP',
    'country': 'Japan',
    'city': 'Tokyo',
    'continent': 'Asia',
    'protocol': 'udp',
    'remoteHost': 'jp-tyo-wg-201.fabrikam.example',
    'remotePort': 51820,
    'fingerprint': 'sha256:cd34cd34cd34cd34cd34cd34cd34cd34',
    'source': 'catalog',
    'updatedAt': '2026-10-28T16:40:00Z',
  },
  {
    'id': 'contoso:ovpn-de-fra-001:000000000007',
    'providerId': 'contoso',
    'tunnel': 'openvpn',
    'displayName': 'Frankfurt, Germany',
    'countryCode': 'DE',
    'country': 'Germany',
    'city': 'Frankfurt',
    'continent': 'Europe',
    'protocol': 'udp',
    'remoteHost': 'de-fra-1.contoso.example',
    'remotePort': 2049,
    'fingerprint': 'sha256:ef56ef56ef56ef56ef56ef56ef56ef56',
    'source': 'catalog',
    'updatedAt': '2026-10-30T12:00:00Z',
  },
];

/**
 * Mock API - Tokens.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const tokens: Record<string, unknown>[] = [
  {
    id: 'tok-3',
    name: 'Backup script',
    scopes: ['settings:read'],
    expiresAt: '2026-10-01T00:00:00Z',
    createdAt: '2026-09-20T07:45:00Z',
    lastUsedAt: null,
  },
  {
    id: 'tok-2',
    name: 'Home dashboard',
    scopes: [
      'torrents:read',
      'vpn:read',
    ],
    expiresAt: '2027-01-15T00:00:00Z',
    createdAt: '2026-09-12T16:05:00Z',
    lastUsedAt: '2026-10-23T21:40:00Z',
  },
  {
    id: 'tok-1',
    name: 'Transmission Remote on iPhone',
    scopes: [
      'torrents:read',
      'torrents:write',
    ],
    expiresAt: null,
    createdAt: '2026-09-02T18:21:00Z',
    lastUsedAt: '2026-10-24T08:02:00Z',
  },
];

// Each seeded token's value, so a client can try one as a bearer token.

/**
 * Mock API - Token values.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const tokenValues: Map<string, string> = new Map([
  [
    'tvpn_mock_backup_script',
    'tok-3',
  ],
  [
    'tvpn_mock_home_dashboard',
    'tok-2',
  ],
  [
    'tvpn_mock_transmission_remote',
    'tok-1',
  ],
]);

/**
 * Mock API - Token digests.
 *
 * Retains the non-reusable digest needed to model backup duplicate detection.
 * Ordinary token routes continue returning only the safe metadata in `tokens`.
 *
 * @since 2.0.0
 */
const tokenDigests: Map<string, string> = new Map(tokens.map(
  (token: Record<string, unknown>): [string, string] => {
    const tokenID: string = String(token['id']);

    return [
      tokenID,
      createHash('sha256').update(tokenID).digest('base64'),
    ];
  },
));

/**
 * Mock API - Token sequence.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
let tokenSequence: number = tokens.length;

/**
 * Mock API - RPC logins.
 *
 * Provides the stateful compatible-client credentials used by the Remote apps page.
 * Seed data covers both used and never-used timestamps.
 *
 * @since 2.0.0
 */
const rpcLogins: MockRPCLogin[] = (noVPNConnections) ? [] : [
  {
    createdAt: '2026-10-20T12:00:00Z',
    id: 'rpl-0000000000000001',
    lastUsedAt: new Date(Date.now() - (8 * 60 * 1000)).toISOString(),
    username: 'sonarr',
  },
  {
    createdAt: '2026-10-22T12:00:00Z',
    id: 'rpl-0000000000000002',
    lastUsedAt: null,
    username: 'phone',
  },
];

/**
 * Mock API - RPC login digests.
 *
 * Retains the non-reusable digest exported and restored with each compatible-client
 * login while the ordinary management routes continue returning safe metadata.
 *
 * @since 2.0.0
 */
const rpcLoginDigests: Map<string, string> = new Map(rpcLogins.map(
  (login: MockRPCLogin): [string, string] => [
    login['id'],
    createHash('sha256').update(login['id']).digest('base64'),
  ],
));

/**
 * Mock API - RPC login sequence.
 *
 * Generates stable identifiers for newly added mock credentials.
 * The sequence advances with every successful create request.
 *
 * @since 2.0.0
 */
let rpcLoginSequence: number = rpcLogins.length;

/**
 * Mock API - Web proxy logins.
 *
 * Provides independently editable and revocable proxy credentials.
 * Seed data keeps the list state visible in documentation screenshots.
 *
 * @since 2.0.0
 */
const webProxyLogins: MockWebProxyLogin[] = (noVPNConnections) ? [] : [
  {
    connectionId: null,
    id: 'wpl-0000000000000001',
    passwordSet: true,
    username: 'living-room-tv',
  },
  {
    connectionId: (process.env['MOCK_MISSING_WEB_PROXY_CONNECTION'] === 'true') ? missingWebProxyConnectionId : contosoConnectionId,
    id: 'wpl-0000000000000002',
    passwordSet: true,
    username: 'laptop',
  },
];

/**
 * Mock API - Web proxy state.
 *
 * Tracks the desired switch independently from observed VPN readiness.
 * This mirrors the control API's enabled and runtime state split.
 *
 * @since 2.0.0
 */
let webProxyEnabled: boolean = !noVPNConnections;

/**
 * Mock API - Web proxy runtime enabled.
 *
 * Lags behind the desired switch so the Remote apps transition state can be
 * exercised against the same delayed observation as the real proxy process.
 *
 * @since 2.0.0
 */
let webProxyRuntimeEnabled: boolean = !noVPNConnections;

/**
 * Mock API - Web proxy transition sequence.
 *
 * Invalidates older delayed writes when the desired switch changes again.
 * Only the most recent mock transition may update observed runtime state.
 *
 * @since 2.0.0
 */
let webProxyTransitionSequence: number = 0;

/**
 * Mock API - Web proxy login sequence.
 *
 * Generates stable identifiers for newly added web proxy credentials.
 * The sequence advances after each successful create request.
 *
 * @since 2.0.0
 */
let webProxyLoginSequence: number = webProxyLogins.length;

/**
 * Mock API - VPN change state.
 *
 * The environment flag reproduces the reload-during-change state for click tests.
 * The value is shared by snapshots and the VPN status response.
 *
 * @since 2.0.0
 */
const vpnChangeRunning: boolean = process.env['MOCK_VPN_CHANGE_RUNNING'] === 'true';

/**
 * Mock API - VPN capacity source.
 *
 * The fallback mode mirrors containers whose memory files cannot be read.
 * Other values retain the representative cgroup-v2 fixture.
 *
 * @since 2.0.0
 */
const vpnCapacitySource: 'cgroup-v2' | 'fallback' = (process.env['MOCK_CAPACITY_SOURCE'] === 'fallback') ? 'fallback' : 'cgroup-v2';

/**
 * Mock API - VPN connections.
 *
 * Starts with the three connections approved for the documentation mockups.
 * Mutating routes update this collection for the lifetime of the mock server.
 *
 * @since 2.0.0
 */
const vpnConnections: MockVPNConnection[] = [
  {
    changeRunning: vpnChangeRunning,
    createdAt: '2026-10-01T12:00:00Z',
    daemon: {
      bindAddress: '10.64.0.2',
      peerPort: 51413,
      rpcPort: 9092,
      state: 'ready',
    },
    default: true,
    dnsServers: [],
    enabled: true,
    endpointStrategy: 'ordered',
    id: northwindConnectionId,
    name: 'Northwind Toronto',
    needsSetup: false,
    peerPort: 51413,
    profileIds: [
      'northwind-ca-toronto-udp',
      'northwind-ca-montreal-udp',
      'northwind-us-new-york-udp',
    ],
    providerId: 'northwind',
    retryIntervalSeconds: 10,
    revision: 3,
    savedCredentials: [
      'username',
      'password',
    ],
    runtime: {
      address: '10.31.112.8',
      attempt: 1,
      endpointCount: 3,
      endpointPosition: 1,
      endpointStrategy: 'ordered',
      interface: 'tun0',
      lastError: '',
      profileId: 'northwind-ca-toronto-udp',
      providerId: 'northwind',
      remoteHost: 'toronto.northwind.example',
      remotePort: 1194,
      state: 'protected',
      transitionedAt: new Date(Date.now() - (3 * 3600 * 1000)).toISOString(),
      tunnel: 'openvpn',
    },
    slot: 0,
    tunnel: 'openvpn',
    updatedAt: '2026-11-03T14:00:00Z',
  },
  {
    changeRunning: false,
    createdAt: '2026-10-15T12:00:00Z',
    daemon: {
      bindAddress: '10.64.1.2',
      peerPort: 51414,
      rpcPort: 9093,
      state: 'ready',
    },
    default: false,
    dnsServers: ['10.64.0.1'],
    enabled: true,
    endpointStrategy: 'sticky',
    id: fabrikamConnectionId,
    name: 'Fabrikam New York',
    needsSetup: false,
    peerPort: 51414,
    profileIds: ['fabrikam:wg-us-nyc-wg-001:000000000005'],
    providerId: 'fabrikam',
    retryIntervalSeconds: 10,
    revision: 2,
    savedCredentials: [
      'privateKey',
      'address',
    ],
    runtime: {
      address: '10.68.12.34',
      attempt: 1,
      endpointCount: 1,
      endpointPosition: 1,
      endpointStrategy: 'sticky',
      implementation: 'kernel',
      interface: 'wg1',
      lastHandshakeAt: new Date(Date.now() - 14_000).toISOString(),
      lastError: '',
      profileId: 'fabrikam:wg-us-nyc-wg-001:000000000005',
      providerId: 'fabrikam',
      remoteHost: 'us-nyc-wg-001.fabrikam.example',
      remotePort: 51820,
      state: 'protected',
      transitionedAt: new Date(Date.now() - (90 * 60 * 1000)).toISOString(),
      tunnel: 'wireguard',
    },
    slot: 1,
    tunnel: 'wireguard',
    updatedAt: '2026-11-03T15:00:00Z',
  },
  {
    changeRunning: false,
    createdAt: '2026-10-20T12:00:00Z',
    daemon: {
      bindAddress: '10.64.2.2',
      peerPort: 51415,
      rpcPort: 9094,
      state: 'ready',
    },
    default: false,
    dnsServers: [],
    enabled: true,
    endpointStrategy: 'sticky',
    id: contosoConnectionId,
    name: 'Contoso Frankfurt',
    needsSetup: false,
    peerPort: 51415,
    profileIds: ['contoso:ovpn-de-fra-001:000000000007'],
    providerId: 'contoso',
    retryIntervalSeconds: 10,
    revision: 1,
    savedCredentials: [
      'username',
      'password',
    ],
    runtime: {
      address: '',
      attempt: 3,
      endpointCount: 1,
      endpointPosition: 1,
      endpointStrategy: 'sticky',
      interface: 'tun2',
      lastError: 'Authentication failed',
      profileId: 'contoso:ovpn-de-fra-001:000000000007',
      providerId: 'contoso',
      remoteHost: 'de-fra-1.contoso.example',
      remotePort: 2049,
      state: 'blocked',
      transitionedAt: new Date(Date.now() - (8 * 60 * 1000)).toISOString(),
      tunnel: 'openvpn',
    },
    slot: 2,
    tunnel: 'openvpn',
    updatedAt: '2026-11-03T16:00:00Z',
  },
];

/**
 * Mock API - VPN credential values.
 *
 * Mirrors sealed server state without placing credential values on connection rows.
 * Public mock responses therefore expose only the corresponding saved field keys.
 *
 * @since 2.0.0
 */
const vpnCredentialValues: Map<string, Record<string, string>> = new Map([
  [
    northwindConnectionId,
    {
      password: 'saved-northwind-password',
      username: 'saved-northwind-username',
    },
  ],
  [
    fabrikamConnectionId,
    {
      address: '10.68.12.34/32',
      privateKey: 'saved-fabrikam-private-key',
    },
  ],
  [
    contosoConnectionId,
    {
      password: 'saved-contoso-password',
      username: 'saved-contoso-account',
    },
  ],
]);

/**
 * Mock API - VPN credential fields.
 *
 * Reads the chosen provider tunnel's field metadata from the same mock payload the
 * console consumes, keeping required-field behavior aligned with the real API.
 *
 * @since 2.0.0
 */
const mockVPNCredentialFields = (
  providerId: string,
  tunnel: 'openvpn' | 'wireguard',
): MockVPNCredentialField[] => {
  const providerDefinition: Record<string, unknown> | undefined = providers.find(
    (candidate: Record<string, unknown>): boolean => candidate['id'] === providerId,
  );
  const tunnelDefinitions: Record<string, unknown>[] = (
    providerDefinition !== undefined && Array.isArray(providerDefinition['tunnels'])
  ) ? providerDefinition['tunnels'] as Record<string, unknown>[] : [];
  const tunnelDefinition: Record<string, unknown> | undefined = tunnelDefinitions.find(
    (candidate: Record<string, unknown>): boolean => candidate['id'] === tunnel,
  );

  return (
    tunnelDefinition !== undefined && Array.isArray(tunnelDefinition['credentialFields'])
  ) ? tunnelDefinition['credentialFields'] as MockVPNCredentialField[] : [];
};

/**
 * Mock API - Submitted VPN credentials.
 *
 * Keeps only non-empty string fields, matching the console and server treatment of an
 * omitted or blank saved credential.
 *
 * @since 2.0.0
 */
const submittedMockVPNCredentials = (value: unknown): Record<string, string> => {
  const credentials: Record<string, string> = {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return credentials;
  }

  for (const entry of Object.entries(value)) {
    const key: string = entry[0];
    const credentialValue: unknown = entry[1];
    if (typeof credentialValue === 'string' && credentialValue.trim() !== '') {
      Reflect.set(credentials, key, credentialValue);
    }
  }

  return credentials;
};

/**
 * Mock API - Merged VPN credentials.
 *
 * Preserves saved values only while provider and tunnel still match, then overlays
 * every non-empty submitted replacement.
 *
 * @since 2.0.0
 */
const mergedMockVPNCredentials = (
  connection: MockVPNConnection,
  providerId: string,
  tunnel: 'openvpn' | 'wireguard',
  submittedCredentials: Record<string, string>,
): Record<string, string> => {
  const savedCredentials: Record<string, string> = vpnCredentialValues.get(connection['id']) ?? {};
  const credentials: Record<string, string> = (
    providerId === connection['providerId'] && tunnel === connection['tunnel']
  ) ? { ...savedCredentials } : {};

  for (const entry of Object.entries(submittedCredentials)) {
    Reflect.set(credentials, entry[0], entry[1]);
  }

  return credentials;
};

/**
 * Mock API - Saved VPN credential keys.
 *
 * Projects configured fields in provider order so mock reads expose stable metadata
 * without returning their values.
 *
 * @since 2.0.0
 */
const savedMockVPNCredentialKeys = (
  providerId: string,
  tunnel: 'openvpn' | 'wireguard',
  credentials: Record<string, string>,
): string[] => mockVPNCredentialFields(providerId, tunnel)
  .filter((field: MockVPNCredentialField): boolean => (credentials[field['key']] ?? '') !== '')
  .map((field: MockVPNCredentialField): string => field['key']);

/**
 * Mock API - Missing VPN credential.
 *
 * Returns the first required provider field that the candidate cannot satisfy.
 * The caller uses its safe label and key in the shared field-error envelope.
 *
 * @since 2.0.0
 */
const missingMockVPNCredential = (
  providerId: string,
  tunnel: 'openvpn' | 'wireguard',
  credentials: Record<string, string>,
): MockVPNCredentialField | undefined => mockVPNCredentialFields(providerId, tunnel).find(
  (field: MockVPNCredentialField): boolean => field['required'] && (credentials[field['key']] ?? '') === '',
);

/**
 * Mock API - Sends VPN credential error.
 *
 * Mirrors the real API's dotted field name and segmented path for a missing sign-in
 * value while keeping the message free of credential contents.
 *
 * @since 2.0.0
 */
const sendMockVPNCredentialError = (
  response: ServerResponse,
  prefix: string,
  field: MockVPNCredentialField,
): void => {
  const fieldName: string = `${prefix}.${field['key']}`;
  const message: string = `${field['label']} is required.`;

  sendJSON(response, 422, {
    error: {
      code: 'invalid_request',
      message,
      issues: [{
        field: fieldName,
        path: fieldName.split('.'),
        message,
      }],
    },
  });
};

/**
 * Mock API - VPN connection sequence.
 *
 * Produces stable server-shaped identifiers for connections added in the UI.
 * The counter advances only after a successful create request.
 *
 * @since 2.0.0
 */
let vpnConnectionSequence: number = vpnConnections.length;

/**
 * Mock API - Token scopes.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const tokenScopes: string[] = [
  'torrents:read',
  'torrents:write',
  'vpn:read',
  'vpn:write',
  'settings:read',
  'settings:write',
];

// Advances transfer state so the interface shows live, moving numbers.

/**
 * Mock API - Tick.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const tick = (): void => {
  sequence += 1;

  for (const torrent of torrents) {
    const downloading: boolean = torrent['status'] === 4 && torrent['error'] === 0 && !torrent['isStalled'];
    const seeding: boolean = torrent['status'] === 6;

    torrent.rateDownload = (downloading) ? Math.round((1.5 + (Math.random() * 9)) * 1024 * 1024) : 0;
    torrent.rateUpload = (downloading || seeding) ? Math.round(Math.random() * 1.8 * 1024 * 1024) : 0;
    torrent.peersSendingToUs = (downloading) ? 8 + Math.floor(Math.random() * 30) : 0;
    torrent.peersGettingFromUs = (torrent['rateUpload'] > 0) ? 1 + Math.floor(Math.random() * 6) : 0;
    torrent.peersConnected = torrent['peersSendingToUs'] + torrent['peersGettingFromUs'];

    if (downloading) {
      const step: number = Math.min(torrent['leftUntilDone'], torrent['rateDownload'] * 2);

      torrent.downloadedEver += step;
      torrent.leftUntilDone -= step;
      torrent.percentDone = 1 - (torrent['leftUntilDone'] / torrent['sizeWhenDone']);
      torrent.eta = (torrent['rateDownload'] > 0) ? Math.round(torrent['leftUntilDone'] / torrent['rateDownload']) : -1;

      if (torrent['leftUntilDone'] === 0) {
        torrent.status = 6;
        torrent.eta = -1;
      }
    } else {
      torrent.eta = -1;
    }

    torrent.uploadedEver += torrent['rateUpload'] * 2;
    torrent.uploadRatio = (torrent['downloadedEver'] === 0) ? -1 : torrent['uploadedEver'] / torrent['downloadedEver'];
  }
};

/**
 * Mock API - Torrent summary fields.
 *
 * Mirrors the exact field inventory requested by the control API for lists and
 * live snapshots. Detail-only fixture fields stay private until the detail route.
 *
 * @since 2.0.0
 */
const torrentSummaryFields: (keyof MockTorrent)[] = [
  'activityDate',
  'addedDate',
  'connectionId',
  'downloadDir',
  'downloadedEver',
  'error',
  'errorString',
  'eta',
  'hashString',
  'id',
  'isFinished',
  'isPrivate',
  'isStalled',
  'labels',
  'leftUntilDone',
  'metadataPercentComplete',
  'name',
  'needsProfile',
  'peersConnected',
  'peersGettingFromUs',
  'peersSendingToUs',
  'percentDone',
  'profileId',
  'queuePosition',
  'rateDownload',
  'rateUpload',
  'recheckProgress',
  'sizeWhenDone',
  'status',
  'totalSize',
  'uploadedEver',
  'uploadRatio',
];

/**
 * Mock API - Torrent summary.
 *
 * Projects one stateful mock row into the public summary contract.
 * The projection prevents detail-only fields from leaking into list events.
 *
 * @since 2.0.0
 */
const torrentSummary = (torrent: MockTorrent): Record<string, unknown> => Object.fromEntries(
  torrentSummaryFields.map((field: keyof MockTorrent): [string, MockTorrent[keyof MockTorrent]] => [
    field,
    torrent[field],
  ]),
);

/**
 * Mock API - Previews torrent link.
 *
 * Supplies deterministic metainfo-like names without making network requests.
 * The Arch release fixture reproduces the directory-style URL that prompted the
 * protected preview workflow.
 *
 * @since 2.0.0
 */
const previewTorrentLink = (link: string, index: number): MockTorrentLinkPreview | null => {
  let parsedLink: URL | undefined = undefined;
  try {
    parsedLink = new URL(link);
  } catch {
    return null;
  }

  if (parsedLink.username !== '' || parsedLink.password !== '') {
    return null;
  }
  if (parsedLink.protocol === 'magnet:') {
    const name: string = parsedLink.searchParams.get('dn')?.trim() ?? '';
    const exactTopic: string | undefined = parsedLink.searchParams.getAll('xt').find(
      (candidate: string): boolean => /^urn:btih:[0-9a-f]{40}$/iu.test(candidate),
    );
    if (name === '' || exactTopic === undefined) {
      return null;
    }

    return {
      hash: exactTopic.slice('urn:btih:'.length).toLowerCase(),
      index,
      name,
    };
  }
  if (parsedLink.protocol !== 'http:' && parsedLink.protocol !== 'https:') {
    return null;
  }

  let name: string = '';
  let totalSize: number = 0;
  if (
    parsedLink.hostname === 'archlinux.org'
    && parsedLink.pathname === '/releng/releases/2026.11.01/torrent/'
  ) {
    name = 'archlinux-2026.11.01-x86_64.iso';
    totalSize = Math.round(1.3 * gibibyte);
  } else {
    const pathSegments: string[] = parsedLink.pathname.split('/').filter(Boolean);
    const encodedName: string = pathSegments.at(-1) ?? parsedLink.hostname;
    try {
      name = decodeURIComponent(encodedName);
    } catch {
      name = encodedName;
    }
    name = name.replace(/\.torrent$/iu, '');
    totalSize = Math.round(2.4 * gibibyte);
  }

  return {
    hash: createHash('sha1').update(name).digest('hex'),
    index,
    name,
    totalSize,
  };
};

/**
 * Mock API - Default VPN connection.
 *
 * Resolves the one slot used by the legacy-compatible snapshot vpn field.
 * Mutating the default only changes flags, so callers always resolve it fresh.
 *
 * @since 2.0.0
 */
const defaultVPNConnection = (): MockVPNConnection => vpnConnections.find(
  (connection: MockVPNConnection): boolean => connection['default'],
) ?? vpnConnections[0] as MockVPNConnection;

/**
 * Mock API - Is connection being removed.
 *
 * Reports whether a mutation targets the environment-selected removal marker.
 * Nullable default relationships do not name the marked non-default connection.
 *
 * @since 2.0.0
 */
const isConnectionBeingRemoved = (connectionId: string | null | undefined): boolean => (
  connectionId !== null
  && connectionId !== undefined
  && connectionId === connectionBeingRemovedId
);

/**
 * Mock API - VPN protection.
 *
 * Counts enabled connections only and derives the aggregate protection state.
 * This matches the sidebar and mobile chip contract.
 *
 * @since 2.0.0
 */
const vpnProtection = (): Record<string, unknown> => {
  const enabled: MockVPNConnection[] = (noVPNConnections) ? [] : vpnConnections.filter((connection: MockVPNConnection): boolean => connection['enabled']);
  const protectedCount: number = enabled.filter((connection: MockVPNConnection): boolean => connection['runtime']['state'] === 'protected').length;
  let state: string = 'blocked';
  if (protectedCount === enabled.length && enabled.length > 0) {
    state = 'protected';
  } else if (protectedCount > 0) {
    state = 'partial';
  } else if (enabled.some((connection: MockVPNConnection): boolean => connection['needsSetup'])) {
    state = 'setup-required';
  }

  return {
    enabledCount: enabled.length,
    protectedCount,
    state,
  };
};

/**
 * Mock API - Live VPN connections.
 *
 * Combines durable identity with runtime and daemon state for event snapshots.
 * The list remains in stable slot order.
 *
 * @since 2.0.0
 */
const liveVPNConnections = (): Record<string, unknown>[] => ((noVPNConnections) ? [] : [...vpnConnections])
  .sort((left: MockVPNConnection, right: MockVPNConnection): number => left['slot'] - right['slot'])
  .map((connection: MockVPNConnection): Record<string, unknown> => {
    const runtime: Record<string, unknown> = { ...connection['runtime'] };

    if (runtime['lastError'] === '') {
      Reflect.deleteProperty(runtime, 'lastError');
    }

    return {
      ...runtime,
      connectionId: connection['id'],
      daemon: connection['daemon'],
      default: connection['default'],
      enabled: connection['enabled'],
      name: connection['name'],
    };
  });

/**
 * Mock API - VPN connection response.
 *
 * Derives the displayed count from the torrent collection inspected during
 * removal, so connection rows and dependency dialogs cannot drift apart.
 *
 * @param {MockVPNConnection} connection - Connection.
 *
 * @returns {Record<string, unknown>}
 *
 * @since 2.0.0
 */
const vpnConnectionResponse = (connection: MockVPNConnection): Record<string, unknown> => ({
  ...connection,
  torrentCount: torrents.filter((torrent: MockTorrent): boolean => torrent['connectionId'] === connection['id']).length,
});

/**
 * Mock API - VPN connection response.
 *
 * Returns the stateful list with the capacity facts shown by the console.
 * A fresh object keeps route mutations visible to later requests.
 *
 * @since 2.0.0
 */
const vpnConnectionsResponse = (): Record<string, unknown> => ({
  capacity: {
    cpus: 4,
    limit: 8,
    memoryBytes: (vpnCapacitySource === 'fallback') ? 0 : 4 * gibibyte,
    source: vpnCapacitySource,
    used: (noVPNConnections) ? 0 : vpnConnections.length,
  },
  changeRunning: !noVPNConnections && vpnConnections.some((connection: MockVPNConnection): boolean => connection['changeRunning']),
  connections: (noVPNConnections) ? [] : [...vpnConnections]
    .sort((left: MockVPNConnection, right: MockVPNConnection): number => left['slot'] - right['slot'])
    .map(vpnConnectionResponse),
});

/**
 * Mock API - Protected runtime.
 *
 * Builds controller state from the first selected endpoint after a successful test.
 * This keeps create, update, and reconnect responses consistent.
 *
 * @since 2.0.0
 */
const protectedVPNRuntime = (
  providerId: string,
  tunnel: 'openvpn' | 'wireguard',
  profileIds: string[],
  endpointStrategy: string,
  slot: number,
): Record<string, unknown> => {
  const profile: Record<string, unknown> | undefined = profiles.find(
    (candidate: Record<string, unknown>): boolean => candidate['id'] === profileIds[0],
  );

  return {
    address: (tunnel === 'wireguard') ? `10.68.${String(slot + 10)}.2` : `10.31.${String(slot + 110)}.8`,
    attempt: 1,
    endpointCount: profileIds.length,
    endpointPosition: 1,
    endpointStrategy,
    ...((tunnel === 'wireguard') ? {
      implementation: 'kernel',
      lastHandshakeAt: new Date().toISOString(),
    } : {}),
    interface: (tunnel === 'wireguard') ? `wg${String(slot)}` : `tun${String(slot)}`,
    lastError: '',
    profileId: profileIds[0],
    providerId,
    remoteHost: profile?.['remoteHost'] ?? 'vpn.example.com',
    remotePort: profile?.['remotePort'] ?? ((tunnel === 'wireguard') ? 51820 : 1194),
    state: 'protected',
    transitionedAt: new Date().toISOString(),
    tunnel,
  };
};

/**
 * Mock API - Default VPN status.
 *
 * Expands the default connection's stored runtime into the controller status
 * embedded by live events.
 *
 * @since 2.0.0
 */
const defaultVPNStatus = (): Record<string, unknown> => {
  const connection: MockVPNConnection = defaultVPNConnection();
  const runtime: Record<string, unknown> = { ...connection['runtime'] };

  if (runtime['lastError'] === '') {
    Reflect.deleteProperty(runtime, 'lastError');
  }

  return {
    ...runtime,
    changeRunning: connection['changeRunning'],
    connectionId: connection['id'],
    default: true,
    dnsServers: connection['dnsServers'],
    slot: connection['slot'],
  };
};

/**
 * Mock API - Appliance status.
 *
 * Matches the authenticated status route and the optional status object in a
 * live snapshot.
 *
 * @since 2.0.0
 */
const applianceStatus = (): Record<string, unknown> => {
  const protection: Record<string, unknown> = vpnProtection();

  return {
    claimed: true,
    configurationRevision: settingsRevision,
    connections: liveVPNConnections(),
    protection,
    protectionState: protection['state'],
    runtime: {
      configurationReady: true,
      firewall: {
        backend: 'nftables',
        interfaces: ((noVPNConnections) ? [] : vpnConnections).filter(
          (connection: MockVPNConnection): boolean => connection['runtime']['state'] === 'protected',
        ).map((connection: MockVPNConnection): Record<string, unknown> => ({
          address: connection['runtime']['address'],
          interface: connection['runtime']['interface'],
        })),
        ready: true,
        state: 'protected',
        userId: 1000,
      },
      services: {
        'control-api': { ready: true },
        'directory-controller': { ready: true },
        'transmission': { ready: true },
        'vpn-controller': {
          phase: 'connected',
          ready: true,
        },
        'web-proxy': { ready: true },
      },
    },
    schemaVersion: 4,
    version: '2.0.0-dev',
  };
};

/**
 * Mock API - Torrent errors.
 *
 * Emits one stable duplicate code even though both rows remain in the list.
 * Normal fixtures return an empty error collection.
 *
 * @since 2.0.0
 */
const torrentErrors = (): string[] => {
  if (!duplicateTorrentEnabled || torrents[0] === undefined) {
    return [];
  }

  return [`duplicate-torrent:${torrents[0]['hashString']}`];
};

/**
 * Mock API - Snapshot.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const snapshot = (): Record<string, unknown> => {
  const downloadSpeed: number = torrents.reduce((total: number, torrent: MockTorrent): number => total + torrent['rateDownload'], 0);
  const uploadSpeed: number = torrents.reduce((total: number, torrent: MockTorrent): number => total + torrent['rateUpload'], 0);
  const activeTorrentCount: number = torrents.filter((torrent: MockTorrent): boolean => torrent['rateDownload'] > 0 || torrent['rateUpload'] > 0).length;

  const protection: Record<string, unknown> = vpnProtection();

  return {
    sequence,
    capturedAt: new Date().toISOString(),
    status: applianceStatus(),
    connections: liveVPNConnections(),
    protection,
    ...((noVPNConnections) ? {} : { vpn: defaultVPNStatus() }),
    statistics: {
      activeTorrentCount,
      'cumulative-stats': {
        downloadedBytes: 1.8 * 1024 * gibibyte,
        filesAdded: 214,
        secondsActive: 86 * 86400,
        sessionCount: 41,
        uploadedBytes: 2.6 * 1024 * gibibyte,
      },
      'current-stats': {
        downloadedBytes: 48 * gibibyte,
        filesAdded: 3,
        secondsActive: 3 * 3600,
        sessionCount: 1,
        uploadedBytes: 31 * gibibyte,
      },
      downloadSpeed,
      'pausedTorrentCount': torrents.filter((torrent: MockTorrent): boolean => torrent['status'] === 0).length,
      'torrentCount': torrents.length,
      uploadSpeed,
    },
    torrents: torrents.map(torrentSummary),
    organizationRevision,
    errors: torrentErrors(),
  };
};

/**
 * Mock API - Sends JSON.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const sendJSON = (response: ServerResponse, status: number, body: unknown): void => {
  response.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
};

/**
 * Mock API - Sends error.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const sendError = (
  response: ServerResponse,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): void => {
  sendJSON(response, status, {
    error: {
      code,
      message,
      ...((details === undefined) ? {} : { details }),
    },
  });
};

/**
 * Mock API - Sends connection being removed.
 *
 * Reuses the backend's status, code, and intentionally generic message.
 * The console supplies the visible connection name at the mutation surface.
 *
 * @since 2.0.0
 */
const sendConnectionBeingRemoved = (response: ServerResponse): void => {
  sendError(response, 409, 'connection_being_removed', 'The selected VPN connection is being removed.');
};

// Reports every field that failed validation, like the control API's invalid_request.

/**
 * Mock API - Send issues.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const sendIssues = (response: ServerResponse, issues: {
  field: string
  message: string
}[]): void => {
  sendJSON(response, 422, {
    error: {
      code: 'invalid_request',
      message: issues[0]?.message ?? 'Check the highlighted fields.',
      issues: issues.map((issue: {
        field: string
        message: string
      }): Record<string, unknown> => ({
        field: issue['field'],
        path: [issue['field']],
        message: issue['message'],
      })),
    },
  });
};

/**
 * Mock API - Password issue.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const passwordIssue = (password: string): string => {
  if (password.length < 12) {
    return 'Use at least 12 characters.';
  }

  return (password.length > 1024) ? 'Use 1024 characters or fewer.' : '';
};

/**
 * Mock API - Username issue.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const usernameIssue = (username: string): string => {
  if (username === '') {
    return 'Enter a username.';
  }

  return (/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/u.test(username)) ? '' : 'Use 3 to 64 letters, numbers, periods, underscores, or hyphens, starting with a letter or number.';
};

/**
 * Mock API - Remote username issue.
 *
 * Validates the broader username contract shared by the RPC and web proxies.
 * Returns an empty string when the candidate is valid.
 *
 * @since 2.0.0
 */
const remoteUsernameIssue = (username: string): string => {
  if (username === '') {
    return 'Enter a username.';
  }

  return (/^[A-Za-z0-9._-]{1,64}$/u.test(username)) ? '' : 'Use 1 to 64 letters, numbers, periods, underscores, or hyphens.';
};

/**
 * Mock API - Effective web proxy connection identifier.
 *
 * Keeps a stored explicit relationship when its connection still exists.
 * Missing and nullable relationships safely resolve through the default.
 *
 * @since 2.0.0
 */
const effectiveWebProxyConnectionId = (login: MockWebProxyLogin): string => {
  if (noVPNConnections) {
    return '';
  }
  if (login['connectionId'] !== null && vpnConnections.some(
    (connection: MockVPNConnection): boolean => connection['id'] === login['connectionId'],
  )) {
    return login['connectionId'];
  }

  return defaultVPNConnection()['id'];
};

/**
 * Mock API - Web proxy response.
 *
 * Combines the desired switch, VPN readiness, and safe login metadata.
 * Every web proxy route uses this canonical response shape.
 *
 * @since 2.0.0
 */
const webProxyResponse = (): Record<string, unknown> => {
  if (noVPNConnections) {
    return {
      enabled: false,
      port: 22605,
      state: 'off',
      logins: [],
    };
  }

  const logins: Record<string, unknown>[] = webProxyLogins.map((login: MockWebProxyLogin): Record<string, unknown> => ({
    ...login,
    effectiveConnectionId: effectiveWebProxyConnectionId(login),
  }));
  let state: string = 'off';
  if (webProxyRuntimeEnabled) {
    const available: boolean = logins.some((login: Record<string, unknown>): boolean => vpnConnections.find(
      (connection: MockVPNConnection): boolean => connection['id'] === login['effectiveConnectionId'],
    )?.['runtime']['state'] === 'protected');
    state = (logins.length === 0 || available) ? 'listening' : 'waiting-for-vpn';
  }

  return {
    enabled: webProxyEnabled,
    port: 22605,
    state,
    logins,
  };
};

/**
 * Mock API - Effective web proxy login.
 *
 * Adds the resolved default identifier without changing the stored nullable choice.
 * Mutation responses and list responses share this exact public shape.
 *
 * @since 2.0.0
 */
const effectiveWebProxyLogin = (login: MockWebProxyLogin): Record<string, unknown> => ({
  ...login,
  effectiveConnectionId: effectiveWebProxyConnectionId(login),
});

/**
 * Mock API - Sends field error.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const sendFieldError = (response: ServerResponse, code: string, field: string, message: string, status: number = 422): void => {
  sendJSON(response, status, {
    error: {
      code,
      message,
      issues: [{
        field,
        path: [field],
        message,
      }],
    },
  });
};

// Marks the mock signed in and answers like the real session response.

/**
 * Mock API - Starts session.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const startSession = (response: ServerResponse): void => {
  signedIn = true;
  response.setHeader('Set-Cookie', 'tvpn_csrf=mock-csrf-token; Path=/; SameSite=Strict');
  sendJSON(response, 200, {
    status: 'authenticated',
    administrator: {
      id: 1,
      username: account['username'],
    },
    csrfToken: 'mock-csrf-token',
    expiresAt: new Date(Date.now() + (12 * 3600 * 1000)).toISOString(),
  });
};

/**
 * Mock API - Reads body.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const readBody = async (request: IncomingMessage): Promise<Record<string, unknown>> => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }

  const text: string = Buffer.concat(chunks).toString('utf-8');

  if (text === '') {
    return {};
  }

  return JSON.parse(text);
};

// Checks a token create or edit body with the same rules and words as the control API.
// It answers the request itself and returns undefined when the body can't be used.

/**
 * Mock API - Reads token fields.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const readTokenFields = async (request: IncomingMessage, response: ServerResponse, tokenId: string): Promise<Record<string, unknown> | undefined> => {
  const body: Record<string, unknown> = await readBody(request);
  const unknownField: string | undefined = Object.keys(body).find((field: string): boolean => ![
    'name',
    'scopes',
    'expiresAt',
  ].includes(field));

  if (unknownField !== undefined) {
    sendIssues(response, [{
      field: unknownField,
      message: 'This field isn\'t accepted.',
    }]);

    return undefined;
  }

  const issues: {
    field: string
    message: string
  }[] = [];
  const name: string = (typeof body['name'] === 'string') ? body['name'].trim() : '';

  if (name === '') {
    issues.push({
      field: 'name',
      message: 'Name this token.',
    });
  } else if ([...name].length > 80) {
    issues.push({
      field: 'name',
      message: 'Use 80 characters or fewer.',
    });
  }

  const scopes: unknown[] = (Array.isArray(body['scopes'])) ? body['scopes'] : [];

  if (scopes.length === 0) {
    issues.push({
      field: 'scopes',
      message: 'Choose at least one scope.',
    });
  } else if (scopes.some((scope: unknown): boolean => typeof scope !== 'string' || !tokenScopes.includes(scope))) {
    issues.push({
      field: 'scopes',
      message: `Choose from: ${tokenScopes.join(', ')}.`,
    });
  } else if (new Set(scopes).size !== scopes.length) {
    issues.push({
      field: 'scopes',
      message: 'Choose each scope only once.',
    });
  }

  const expiresAt: unknown = body['expiresAt'];

  if (expiresAt !== undefined && expiresAt !== null) {
    if (typeof expiresAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/u.test(expiresAt) || Number.isNaN(Date.parse(expiresAt))) {
      issues.push({
        field: 'expiresAt',
        message: 'Use an ISO 8601 date and time with a time zone, like 2030-01-01T00:00:00Z.',
      });
    } else if (Date.parse(expiresAt) <= Date.now()) {
      issues.push({
        field: 'expiresAt',
        message: 'Choose an expiration date in the future.',
      });
    }
  }

  if (issues.length > 0) {
    sendIssues(response, issues);

    return undefined;
  }

  if (tokens.some((token: Record<string, unknown>): boolean => token['id'] !== tokenId && String(token['name']).toLowerCase() === name.toLowerCase())) {
    sendFieldError(response, 'token_exists', 'name', 'A token with this name already exists.', 409);

    return undefined;
  }

  return {
    name,
    scopes: expandScopes(scopes.map(String)),
    expiresAt: (typeof expiresAt === 'string') ? new Date(expiresAt).toISOString() : expiresAt,
  };
};

/**
 * Mock API - Reads IDs.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const readIDs = (body: Record<string, unknown>): number[] => {
  const ids: unknown = body['ids'];

  return (Array.isArray(ids)) ? ids.filter((id: unknown): id is number => typeof id === 'number') : [];
};

/**
 * Mock API - Mock torrent selection.
 *
 * Retains the response field selected by the request while resolving every
 * matching mock row, including the same hash on multiple connections.
 *
 * @since 2.0.0
 */
type MockTorrentSelection = {
  field: 'hashes' | 'ids'
  hashes: string[]
  ids: number[]
  items: MockTorrent[]
};

/**
 * Mock API - Reads torrent selection.
 *
 * Gives a present hash array precedence over facade IDs, just like the Go
 * mutation handlers. Missing hashes return the stable not-found error.
 *
 * @since 2.0.0
 */
const readTorrentSelection = (
  body: Record<string, unknown>,
  response: ServerResponse,
): MockTorrentSelection | undefined => {
  if (process.env['MOCK_DAEMON_UNAVAILABLE'] === 'true') {
    const starting: boolean = process.env['MOCK_DAEMON_STARTING'] === 'true';
    sendError(
      response,
      503,
      'daemon_unavailable',
      (starting) ? 'Northwind Toronto\'s Transmission is still starting.' : 'Transmission is unavailable for the selected connection.',
    );

    return undefined;
  }
  if (process.env['MOCK_TORRENT_NOT_FOUND'] === 'true') {
    sendError(response, 404, 'torrent_not_found', 'One or more torrents were not found.');

    return undefined;
  }

  if (Array.isArray(body['hashes'])) {
    const requestedHashes: unknown[] = body['hashes'];
    const hexadecimalCharacters: string = '0123456789abcdefABCDEF';
    const valid: boolean = requestedHashes.length >= 1
      && requestedHashes.length <= 1000
      && requestedHashes.every((hash: unknown): boolean => (
        typeof hash === 'string'
        && (hash.length === 40 || hash.length === 64)
        && [...hash].every((character: string): boolean => hexadecimalCharacters.includes(character))
      ));
    const hashes: string[] = requestedHashes.map(String).map((hash: string): string => hash.toLowerCase());
    if (!valid || new Set(hashes).size !== hashes.length) {
      sendFieldError(response, 'torrent_selection_invalid', 'hashes', 'Torrent hashes must be unique 40 or 64 character hexadecimal values.');

      return undefined;
    }
    if (hashes.some((hash: string): boolean => !torrents.some(
      (torrent: MockTorrent): boolean => torrent['hashString'].toLowerCase() === hash,
    ))) {
      sendError(response, 404, 'torrent_not_found', 'One or more torrents were not found.');

      return undefined;
    }
    const items: MockTorrent[] = torrents.filter(
      (torrent: MockTorrent): boolean => hashes.includes(torrent['hashString'].toLowerCase()),
    );

    return {
      field: 'hashes',
      hashes,
      ids: items.map((torrent: MockTorrent): number => torrent['id']),
      items,
    };
  }

  const ids: number[] = readIDs(body);
  if (ids.length < 1 || ids.length > 1000 || new Set(ids).size !== ids.length) {
    sendFieldError(response, 'torrent_selection_invalid', 'ids', 'Select between 1 and 1,000 torrents without duplicates.');

    return undefined;
  }
  const items: MockTorrent[] = torrents.filter((torrent: MockTorrent): boolean => ids.includes(torrent['id']));
  if (items.length !== ids.length) {
    sendError(response, 404, 'torrent_not_found', 'One or more torrents were not found.');

    return undefined;
  }

  return {
    field: 'ids',
    hashes: items.map((torrent: MockTorrent): string => torrent['hashString']),
    ids,
    items,
  };
};

/**
 * Mock API - Torrent mutation response.
 *
 * Mirrors the backend's selection-key echo without exposing both identifier
 * systems in one response.
 *
 * @since 2.0.0
 */
const torrentMutationResponse = (selection: MockTorrentSelection): Record<string, unknown> => (
  (selection['field'] === 'hashes') ? { hashes: selection['hashes'] } : { ids: selection['ids'] }
);

/**
 * Mock API - Reads torrent profile.
 *
 * Converts one already client-validated profile body into durable mock state.
 * Existing identity and creation metadata are supplied by the route handler.
 *
 * @since 2.0.0
 */
const readTorrentProfile = (
  body: Record<string, unknown>,
  id: string,
  createdAt: string,
): MockTorrentProfile => {
  const options: Record<string, unknown> = (typeof body['options'] === 'object' && body['options'] !== null) ? body['options'] as Record<string, unknown> : {};
  const seeding: Record<string, unknown> = (typeof options['seeding'] === 'object' && options['seeding'] !== null) ? options['seeding'] as Record<string, unknown> : {};
  const updatedAt: string = new Date().toISOString();

  return {
    connectionId: (typeof body['connectionId'] === 'string') ? body['connectionId'] : null,
    createdAt,
    downloadDirectory: String(body['downloadDirectory'] ?? '/data'),
    id,
    labels: (Array.isArray(body['labels'])) ? body['labels'].map(String) : [],
    matchPatterns: (Array.isArray(body['matchPatterns'])) ? body['matchPatterns'].map(String) : [],
    name: String(body['name'] ?? '').trim(),
    overlaps: [],
    options: {
      bandwidthPriority: Number(options['bandwidthPriority'] ?? 0) as -1 | 0 | 1,
      downloadLimitKBps: (options['downloadLimitKBps'] === null) ? null : Number(options['downloadLimitKBps']),
      peerLimit: Number(options['peerLimit'] ?? 50),
      queue: (options['queue'] === 'top') ? 'top' : 'normal',
      seeding: {
        idleMinutes: (seeding['idleMinutes'] === null) ? null : Number(seeding['idleMinutes']),
        mode: (seeding['mode'] === 'limit') ? 'limit' : 'never',
        ratio: (seeding['ratio'] === null) ? null : Number(seeding['ratio']),
      },
      uploadLimitKBps: (options['uploadLimitKBps'] === null) ? null : Number(options['uploadLimitKBps']),
    },
    startPaused: body['startPaused'] === true,
    updatedAt,
  };
};

/**
 * Mock API - Reads Default torrent profile.
 *
 * Reuses named-profile option normalization while omitting fields the Default
 * editor cannot change.
 *
 * @since 2.0.0
 */
const readDefaultTorrentProfile = (body: Record<string, unknown>): MockDefaultTorrentProfile => {
  const normalizedProfile: MockTorrentProfile = readTorrentProfile(
    {
      ...body,
      connectionId: null,
      matchPatterns: [],
      name: body['name'],
    },
    'default',
    '',
  );

  return {
    downloadDirectory: normalizedProfile['downloadDirectory'],
    downloadDirectoryLocked: defaultTorrentProfile['downloadDirectoryLocked'],
    labels: normalizedProfile['labels'],
    name: normalizedProfile['name'],
    options: normalizedProfile['options'],
    startPaused: normalizedProfile['startPaused'],
  };
};

// Applies one torrent action from the selection toolbar or context menu.

/**
 * Mock API - Applies action.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const applyAction = (action: string, ids: number[]): void => {
  for (const torrent of torrents) {
    if (!ids.includes(torrent['id'])) {
      continue;
    }

    switch (action) {
      case 'start':
      case 'start-now': {
        torrent.status = (torrent['percentDone'] >= 1) ? 6 : 4;
        torrent.error = 0;
        torrent.errorString = '';
        break;
      }

      case 'stop': {
        torrent.status = 0;
        break;
      }

      case 'verify': {
        torrent.status = 2;
        torrent.recheckProgress = 0.1;
        break;
      }

      default: {
        break;
      }
    }
  }
};

/**
 * Mock API - Gets added torrent name.
 *
 * Derives a useful name from magnet display names and remote URL paths.
 * Metainfo bytes have no filename in the request, so they use a stable fallback.
 *
 * @since 2.0.0
 */
const addedTorrentName = (filename: unknown, fallbackId: number): string => {
  if (typeof filename !== 'string') {
    return `Added torrent ${fallbackId}`;
  }

  try {
    const sourceURL: URL = new URL(filename);
    if (sourceURL.protocol === 'magnet:') {
      return sourceURL.searchParams.get('dn') ?? `Magnet torrent ${fallbackId}`;
    }
    const lastSegment: string = sourceURL.pathname.split('/').filter(Boolean).at(-1) ?? `Remote torrent ${fallbackId}`;

    return decodeURIComponent(lastSegment).replace(/\.torrent$/iu, '');
  } catch {
    return `Added torrent ${fallbackId}`;
  }
};

/**
 * Mock API - Backup grants.
 *
 * Models purpose-bound, short-lived and single-use confirmation grants in memory.
 * The mock stores only opaque values and never stores submitted passwords or codes.
 *
 * @since 2.0.0
 */
const backupGrants: Map<string, {
  expiresAt: number
  purpose: 'export' | 'import'
}> = new Map();

/**
 * Mock API - Backup import job.
 *
 * Retains the active simulated job while Vite remains running.
 * Poll responses derive progress from its original start time.
 *
 * @since 2.0.0
 */
let backupImportJob: MockBackupImport | null = null;

/**
 * Mock API - Maximum backup notification destinations.
 *
 * Mirrors the control API cap used when an import adds destinations.
 * Replacements remain available when the list is full.
 *
 * @since 2.0.0
 */
const maximumBackupNotificationDestinations: number = 256;

/**
 * Mock API - Maximum backup RPC logins.
 *
 * Mirrors the control API cap used when an import adds compatible-client logins.
 * Replacements remain available when the list is full.
 *
 * @since 2.0.0
 */
const maximumBackupRPCLogins: number = 256;

/**
 * Mock API - Maximum backup API tokens.
 *
 * Mirrors the control API cap used after duplicate imported tokens are skipped.
 * Existing and duplicate token records never consume new capacity.
 *
 * @since 2.0.0
 */
const maximumBackupAPITokens: number = 256;

/**
 * Mock API - Issues backup grant.
 *
 * Creates the same five-minute confirmation window exposed by the control API.
 * A matching export or import request removes the grant on first use.
 *
 * @param {'export' | 'import'} purpose - Purpose.
 *
 * @returns {Record<string, string>}
 *
 * @since 2.0.0
 */
const issueMockBackupGrant = (purpose: 'export' | 'import'): Record<string, string> => {
  const grant: string = randomBytes(24).toString('base64url');
  const expiresAt: number = Date.now() + (5 * 60 * 1000);
  backupGrants.set(grant, {
    expiresAt,
    purpose,
  });

  return {
    expiresAt: new Date(expiresAt).toISOString(),
    grant,
  };
};

/**
 * Mock API - Consumes backup grant.
 *
 * Accepts only an unexpired grant issued for the requested sensitive operation.
 * Successful validation deletes it before the operation begins.
 *
 * @param {unknown}             value   - Value.
 * @param {'export' | 'import'} purpose - Purpose.
 *
 * @returns {boolean}
 *
 * @since 2.0.0
 */
const consumeMockBackupGrant = (value: unknown, purpose: 'export' | 'import'): boolean => {
  const grant: string = String(value ?? '');
  const confirmation = backupGrants.get(grant);
  if (confirmation === undefined || confirmation['purpose'] !== purpose || confirmation['expiresAt'] <= Date.now()) {
    return false;
  }
  backupGrants.delete(grant);

  return true;
};

/**
 * Mock API - Creates portable metainfo.
 *
 * Builds one valid single-file torrent and computes the hash over its info dictionary.
 * Mock exports can therefore be accepted by the real strict Go importer too.
 *
 * @returns {{ hash: string, metainfo: string }}
 *
 * @since 2.0.0
 */
const mockBackupMetainfo = (): {
  hash: string
  metainfo: string
} => {
  const info: Buffer = Buffer.concat([
    Buffer.from('d6:lengthi3994028672e4:name29:debian-13.1.0-amd64-DVD-1.iso12:piece lengthi16384e6:pieces20:'),
    Buffer.alloc(20),
    Buffer.from('e'),
  ]);
  const metainfo: Buffer = Buffer.concat([
    Buffer.from('d4:info'),
    info,
    Buffer.from('e'),
  ]);

  return {
    hash: createHash('sha1').update(info).digest('hex'),
    metainfo: metainfo.toString('base64'),
  };
};

/**
 * Mock API - Builds backup document.
 *
 * Projects current mock settings into the strict version-one portable contract.
 * Secret fields use obvious mock plaintext while digest-only credentials stay digests.
 *
 * @param {Record<string, unknown>} selected - Selected.
 *
 * @returns {Record<string, unknown>}
 *
 * @since 2.0.0
 */
const mockBackupDocument = (selected: Record<string, unknown>): Record<string, unknown> => {
  const document: Record<string, unknown> = {
    appVersion: '2.0.0-dev',
    exportedAt: new Date().toISOString(),
    format: 'transmission-vpn-export',
    version: 1,
  };
  if (selected['settingsAndProfiles'] === true) {
    Reflect.set(document, 'settingsAndProfiles', {
      defaultProfile: {
        downloadDirectory: defaultTorrentProfile['downloadDirectory'],
        labels: [...defaultTorrentProfile['labels']],
        name: defaultTorrentProfile['name'],
        options: structuredClone(defaultTorrentProfile['options']),
        startPaused: defaultTorrentProfile['startPaused'],
      },
      profiles: torrentProfiles.map((profile: MockTorrentProfile): Record<string, unknown> => ({
        connectionId: profile['connectionId'],
        createdAt: profile['createdAt'],
        downloadDirectory: profile['downloadDirectory'],
        id: profile['id'],
        labels: [...profile['labels']],
        matchPatterns: [...profile['matchPatterns']],
        name: profile['name'],
        options: structuredClone(profile['options']),
        startPaused: profile['startPaused'],
        updatedAt: profile['updatedAt'],
      })),
      settings: settings.slice(0, 8).map((setting: Record<string, unknown>): Record<string, unknown> => ({
        key: setting['key'],
        value: setting['value'],
      })),
    });
  }
  if (selected['labels'] === true) {
    Reflect.set(document, 'labels', [...savedLabels]);
  }
  if (selected['notifications'] === true) {
    Reflect.set(document, 'notifications', notifications.map((notification: MockNotification): Record<string, unknown> => ({
      events: [...notification['events']],
      id: notification['id'],
      name: notification['name'],
      secrets: Object.fromEntries(Object.keys(notification['secrets']).map((key: string): [string, string] => [
        key,
        `mock-${key}-secret`,
      ])),
      service: notification['service'],
      settings: { ...notification['settings'] },
    })));
  }
  if (selected['torrents'] === true) {
    const sourceTorrent: MockTorrent | undefined = torrents[0];
    const metainfo = mockBackupMetainfo();
    const sourceProfile: MockTorrentProfile | undefined = torrentProfiles.find(
      (profile: MockTorrentProfile): boolean => profile['id'] === sourceTorrent?.['profileId'],
    );
    Reflect.set(document, 'torrents', (sourceTorrent === undefined) ? [] : [{
      connectionId: sourceTorrent['connectionId'],
      downloadDirectory: sourceTorrent['downloadDir'],
      hash: metainfo['hash'],
      labels: [...sourceTorrent['labels']],
      limits: {
        bandwidthPriority: sourceTorrent['bandwidthPriority'],
        downloadLimit: sourceTorrent['downloadLimit'],
        downloadLimited: sourceTorrent['downloadLimited'],
        honorsSessionLimits: sourceTorrent['honorsSessionLimits'],
        peerLimit: sourceTorrent['peer-limit'],
        seedIdleLimit: sourceTorrent['seedIdleLimit'],
        seedIdleMode: sourceTorrent['seedIdleMode'],
        seedRatioLimit: sourceTorrent['seedRatioLimit'],
        seedRatioMode: sourceTorrent['seedRatioMode'],
        uploadLimit: sourceTorrent['uploadLimit'],
        uploadLimited: sourceTorrent['uploadLimited'],
      },
      metainfo: metainfo['metainfo'],
      name: 'debian-13.1.0-amd64-DVD-1.iso',
      paused: sourceTorrent['status'] === 0,
      percentDone: sourceTorrent['percentDone'],
      profileId: sourceTorrent['profileId'],
      profileName: sourceProfile?.['name'] ?? defaultTorrentProfile['name'],
    }]);
  }
  if (selected['vpnConnections'] === true) {
    const selectedConnections: MockVPNConnection[] = vpnConnections.slice(0, 1);
    const selectedProfileIDs: Set<string> = new Set(selectedConnections.flatMap(
      (connection: MockVPNConnection): string[] => connection['profileIds'],
    ));
    Reflect.set(document, 'vpnConnections', {
      connections: selectedConnections.map((connection: MockVPNConnection): Record<string, unknown> => ({
        credentials: { ...(vpnCredentialValues.get(connection['id']) ?? {}) },
        default: connection['default'],
        dnsServers: [...connection['dnsServers']],
        enabled: connection['enabled'],
        endpointStrategy: connection['endpointStrategy'],
        id: connection['id'],
        name: connection['name'],
        peerPort: connection['peerPort'],
        profileIds: [...connection['profileIds']],
        providerId: connection['providerId'],
        retryIntervalSeconds: connection['retryIntervalSeconds'],
        slot: connection['slot'],
        tunnel: connection['tunnel'],
      })),
      profiles: profiles.filter((profile: Record<string, unknown>): boolean => selectedProfileIDs.has(String(profile['id']))).map(
        (profile: Record<string, unknown>): Record<string, unknown> => ({
          city: String(profile['city'] ?? ''),
          configuration: `client\nremote ${String(profile['remoteHost'])} ${String(profile['remotePort'])}\n`,
          continent: String(profile['continent'] ?? ''),
          country: String(profile['country'] ?? ''),
          countryCode: String(profile['countryCode'] ?? ''),
          displayName: String(profile['displayName'] ?? ''),
          fingerprint: String(profile['fingerprint'] ?? ''),
          id: String(profile['id']),
          protocol: String(profile['protocol'] ?? ''),
          providerId: String(profile['providerId']),
          remoteHost: String(profile['remoteHost']),
          remotePort: Number(profile['remotePort']),
          source: String(profile['source'] ?? 'catalog'),
          tunnel: profile['tunnel'],
        }),
      ),
    });
  }
  if (selected['remoteAccess'] === true) {
    Reflect.set(document, 'remoteAccess', {
      apiTokens: tokens.map((token: Record<string, unknown>): Record<string, unknown> => ({
        createdAt: token['createdAt'],
        expiresAt: token['expiresAt'],
        id: token['id'],
        lastUsedAt: token['lastUsedAt'],
        name: token['name'],
        scopes: token['scopes'],
        tokenDigest: tokenDigests.get(String(token['id'])) ?? createHash('sha256').update(String(token['id'])).digest('base64'),
      })),
      rpcLogins: rpcLogins.map((login: MockRPCLogin): Record<string, unknown> => ({
        createdAt: login['createdAt'],
        id: login['id'],
        lastUsedAt: login['lastUsedAt'],
        secretDigest: rpcLoginDigests.get(login['id']) ?? createHash('sha256').update(login['id']).digest('base64'),
        updatedAt: login['createdAt'],
        username: login['username'],
      })),
    });
  }

  return document;
};

/**
 * Mock API - Backup count label.
 *
 * Formats one merge count with the same singular and plural wording as the API.
 * Review and progress summaries reuse the returned action sentences unchanged.
 *
 * @param {number} count    - Count.
 * @param {string} singular - Singular.
 * @param {string} plural   - Plural.
 *
 * @returns {string}
 *
 * @since 2.0.0
 */
const mockBackupCountLabel = (count: number, singular: string, plural: string): string => (
  `${count} ${(count === 1) ? singular : plural}`
);

/**
 * Mock API - Backup action lines.
 *
 * Produces the exact merge explanations returned by the control API preview.
 * Zero-count operations stay omitted so the wizard lists only observable changes.
 *
 * @param {MockBackupMergeResult} result - Result.
 *
 * @returns {string[]}
 *
 * @since 2.0.0
 */
const mockBackupActionLines = (result: MockBackupMergeResult): string[] => {
  const actions: string[] = [];
  if (result['notificationReplacements'] > 0) {
    actions.push(`Replace ${mockBackupCountLabel(result['notificationReplacements'], 'notification destination', 'notification destinations')} with the same name`);
  }
  if (result['notificationAdditions'] > 0) {
    actions.push(`Add ${mockBackupCountLabel(result['notificationAdditions'], 'notification destination', 'notification destinations')}`);
  }
  if (result['notificationMaximumSkips'] > 0) {
    actions.push(`Skip ${mockBackupCountLabel(result['notificationMaximumSkips'], 'notification destination', 'notification destinations')} because this app allows at most ${maximumBackupNotificationDestinations} notification destinations`);
  }
  if (result['rpcLoginReplacements'] > 0) {
    actions.push(`Replace ${mockBackupCountLabel(result['rpcLoginReplacements'], 'RPC login', 'RPC logins')} with the same username`);
  }
  if (result['rpcLoginAdditions'] > 0) {
    actions.push(`Add ${mockBackupCountLabel(result['rpcLoginAdditions'], 'RPC login', 'RPC logins')}`);
  }
  if (result['rpcLoginMaximumSkips'] > 0) {
    actions.push(`Skip ${mockBackupCountLabel(result['rpcLoginMaximumSkips'], 'RPC login', 'RPC logins')} because this app allows at most ${maximumBackupRPCLogins} RPC logins`);
  }
  if (result['apiTokenAdditions'] > 0) {
    actions.push(`Add ${mockBackupCountLabel(result['apiTokenAdditions'], 'API token', 'API tokens')}`);
  }
  if (result['apiTokenDuplicateSkips'] > 0) {
    const verb: string = (result['apiTokenDuplicateSkips'] === 1) ? 'is' : 'are';

    actions.push(`Skip ${mockBackupCountLabel(result['apiTokenDuplicateSkips'], 'API token', 'API tokens')} that ${verb} already here`);
  }
  if (result['apiTokenMaximumSkips'] > 0) {
    actions.push(`Skip ${mockBackupCountLabel(result['apiTokenMaximumSkips'], 'API token', 'API tokens')} because this app allows at most ${maximumBackupAPITokens} API tokens`);
  }

  return actions;
};

/**
 * Mock API - Backup string map.
 *
 * Keeps only string-valued properties from one imported settings or secrets object.
 * The strict real importer already guarantees this shape before merge planning.
 *
 * @param {unknown} value - Value.
 *
 * @returns {Record<string, string>}
 *
 * @since 2.0.0
 */
const mockBackupStringMap = (value: unknown): Record<string, string> => {
  const values: Record<string, string> = {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return values;
  }
  for (const entry of Object.entries(value)) {
    const entryValue: unknown = entry[1];
    if (typeof entryValue === 'string') {
      Reflect.set(values, entry[0], entryValue);
    }
  }

  return values;
};

/**
 * Mock API - Checks a backup identifier.
 *
 * Lets a replacement retain the identifier of the row it replaces while rejecting
 * collisions with every other retained row.
 *
 * @param {readonly { id: string }[]} items        - Items.
 * @param {string}                    id           - Id.
 * @param {number}                    allowedIndex - Allowed index.
 *
 * @returns {boolean}
 *
 * @since 2.0.0
 */
const mockBackupIDIsUsed = (
  items: readonly {
    id: string
  }[],
  id: string,
  allowedIndex: number,
): boolean => items.some((item: {
  id: string
}, index: number): boolean => (
  index !== allowedIndex && item['id'] === id
));

/**
 * Mock API - Merges backup access lists.
 *
 * Simulates the server merge against copies for preview and commits those copies for
 * import. Unlisted rows therefore remain identical in both modes.
 *
 * @param {Record<string, unknown>} document - Document.
 * @param {boolean}                 apply    - Apply.
 *
 * @returns {string[]}
 *
 * @since 2.0.0
 */
const mergeMockBackupAccess = (document: Record<string, unknown>, apply: boolean): string[] => {
  const mergedNotifications: MockNotification[] = notifications.map(
    (notification: MockNotification): MockNotification => structuredClone(notification),
  );
  const mergedRPCLogins: MockRPCLogin[] = rpcLogins.map(
    (login: MockRPCLogin): MockRPCLogin => ({ ...login }),
  );
  const mergedRPCLoginDigests: Map<string, string> = new Map(rpcLoginDigests);
  const mergedTokens: Record<string, unknown>[] = tokens.map(
    (token: Record<string, unknown>): Record<string, unknown> => structuredClone(token),
  );
  const mergedTokenDigests: Map<string, string> = new Map(tokenDigests);
  const result: MockBackupMergeResult = {
    apiTokenAdditions: 0,
    apiTokenDuplicateSkips: 0,
    apiTokenMaximumSkips: 0,
    notificationAdditions: 0,
    notificationMaximumSkips: 0,
    notificationReplacements: 0,
    rpcLoginAdditions: 0,
    rpcLoginMaximumSkips: 0,
    rpcLoginReplacements: 0,
  };
  const importedNotifications: Record<string, unknown>[] = (Array.isArray(document['notifications'])) ? document['notifications'].filter(
    (notification: unknown): notification is Record<string, unknown> => typeof notification === 'object' && notification !== null,
  ) : [];
  for (const importedNotification of importedNotifications) {
    const name: string = String(importedNotification['name']);
    const replaceIndex: number = mergedNotifications.findIndex(
      (notification: MockNotification): boolean => notification['name'].toLowerCase() === name.toLowerCase(),
    );
    if (replaceIndex < 0 && mergedNotifications.length >= maximumBackupNotificationDestinations) {
      result['notificationMaximumSkips'] += 1;

      continue;
    }
    if (replaceIndex >= 0) {
      result['notificationReplacements'] += 1;
    } else {
      result['notificationAdditions'] += 1;
    }

    let id: string = String(importedNotification['id']);
    while (mockBackupIDIsUsed(mergedNotifications, id, replaceIndex)) {
      id = `ntf-${randomBytes(8).toString('hex')}`;
    }
    const secretValues: Record<string, string> = mockBackupStringMap(importedNotification['secrets']);
    const secretFields: Record<string, true> = {};
    for (const secretKey of Object.keys(secretValues)) {
      Reflect.set(secretFields, secretKey, true);
    }
    const now: string = new Date().toISOString();
    const notification: MockNotification = {
      createdAt: now,
      events: (Array.isArray(importedNotification['events'])) ? importedNotification['events'].filter(
        (event: unknown): event is string => typeof event === 'string',
      ) : [],
      id,
      lastAttemptAt: null,
      lastError: null,
      lastErrorDetails: null,
      name,
      secrets: secretFields,
      secretsMissing: [],
      service: importedNotification['service'] as MockNotificationService,
      settings: mockBackupStringMap(importedNotification['settings']),
      updatedAt: now,
    };
    if (replaceIndex >= 0) {
      mergedNotifications.splice(replaceIndex, 1, notification);
    } else {
      mergedNotifications.push(notification);
    }
  }

  const remoteAccess: Record<string, unknown> | undefined = (
    typeof document['remoteAccess'] === 'object' && document['remoteAccess'] !== null
  ) ? document['remoteAccess'] as Record<string, unknown> : undefined;
  const importedLogins: Record<string, unknown>[] = (Array.isArray(remoteAccess?.['rpcLogins'])) ? remoteAccess['rpcLogins'].filter(
    (login: unknown): login is Record<string, unknown> => typeof login === 'object' && login !== null,
  ) : [];
  for (const importedLogin of importedLogins) {
    const username: string = String(importedLogin['username']);
    const replaceIndex: number = mergedRPCLogins.findIndex(
      (login: MockRPCLogin): boolean => login['username'].toLowerCase() === username.toLowerCase(),
    );
    if (replaceIndex < 0 && mergedRPCLogins.length >= maximumBackupRPCLogins) {
      result['rpcLoginMaximumSkips'] += 1;

      continue;
    }
    if (replaceIndex >= 0) {
      result['rpcLoginReplacements'] += 1;
    } else {
      result['rpcLoginAdditions'] += 1;
    }

    let id: string = String(importedLogin['id']);
    while (mockBackupIDIsUsed(mergedRPCLogins, id, replaceIndex)) {
      id = `rpl-${randomBytes(8).toString('hex')}`;
    }
    const login: MockRPCLogin = {
      createdAt: String(importedLogin['createdAt']),
      id,
      lastUsedAt: (typeof importedLogin['lastUsedAt'] === 'string') ? importedLogin['lastUsedAt'] : null,
      username,
    };
    if (replaceIndex >= 0) {
      const replacedLogin: MockRPCLogin | undefined = mergedRPCLogins[replaceIndex];
      if (replacedLogin !== undefined) {
        mergedRPCLoginDigests.delete(replacedLogin['id']);
      }
      mergedRPCLogins.splice(replaceIndex, 1, login);
    } else {
      mergedRPCLogins.push(login);
    }
    mergedRPCLoginDigests.set(id, String(importedLogin['secretDigest']));
  }

  const importedTokens: Record<string, unknown>[] = (Array.isArray(remoteAccess?.['apiTokens'])) ? remoteAccess['apiTokens'].filter(
    (token: unknown): token is Record<string, unknown> => typeof token === 'object' && token !== null,
  ) : [];
  for (const importedToken of importedTokens) {
    const id: string = String(importedToken['id']);
    const name: string = String(importedToken['name']);
    const digest: string = String(importedToken['tokenDigest']);
    const duplicate: boolean = mergedTokens.some((token: Record<string, unknown>): boolean => (
      String(token['id']) === id
      || String(token['name']).toLowerCase() === name.toLowerCase()
      || mergedTokenDigests.get(String(token['id'])) === digest
    ));
    if (duplicate) {
      result['apiTokenDuplicateSkips'] += 1;

      continue;
    }
    if (mergedTokens.length >= maximumBackupAPITokens) {
      result['apiTokenMaximumSkips'] += 1;

      continue;
    }

    result['apiTokenAdditions'] += 1;
    mergedTokens.push({
      createdAt: importedToken['createdAt'],
      expiresAt: importedToken['expiresAt'],
      id,
      lastUsedAt: importedToken['lastUsedAt'],
      name,
      scopes: (Array.isArray(importedToken['scopes'])) ? importedToken['scopes'].filter(
        (scope: unknown): scope is string => typeof scope === 'string',
      ) : [],
    });
    mergedTokenDigests.set(id, digest);
  }

  if (apply) {
    notifications.splice(0, notifications.length);
    for (const notification of mergedNotifications) {
      notifications.push(notification);
    }
    rpcLogins.splice(0, rpcLogins.length);
    for (const login of mergedRPCLogins) {
      rpcLogins.push(login);
    }
    rpcLoginDigests.clear();
    for (const digestEntry of mergedRPCLoginDigests) {
      rpcLoginDigests.set(digestEntry[0], digestEntry[1]);
    }
    tokens.splice(0, tokens.length);
    for (const token of mergedTokens) {
      tokens.push(token);
    }
    tokenDigests.clear();
    for (const digestEntry of mergedTokenDigests) {
      tokenDigests.set(digestEntry[0], digestEntry[1]);
    }
  }

  return mockBackupActionLines(result);
};

/**
 * Mock API - Builds backup preview.
 *
 * Finds missing folders and profile name conflicts against current mock state.
 * The result mirrors the safe projection consumed by the import wizard.
 *
 * @param {Record<string, unknown>} document - Document.
 *
 * @returns {Record<string, unknown>}
 *
 * @since 2.0.0
 */
const mockBackupPreview = (document: Record<string, unknown>): Record<string, unknown> => {
  const settingsAndProfiles: Record<string, unknown> | undefined = (
    typeof document['settingsAndProfiles'] === 'object' && document['settingsAndProfiles'] !== null
  ) ? document['settingsAndProfiles'] as Record<string, unknown> : undefined;
  const importedDefault: Record<string, unknown> | undefined = (
    typeof settingsAndProfiles?.['defaultProfile'] === 'object' && settingsAndProfiles['defaultProfile'] !== null
  ) ? settingsAndProfiles['defaultProfile'] as Record<string, unknown> : undefined;
  const importedProfiles: Record<string, unknown>[] = (Array.isArray(settingsAndProfiles?.['profiles'])) ? settingsAndProfiles['profiles'].filter((profile: unknown): profile is Record<string, unknown> => typeof profile === 'object' && profile !== null) : [];
  const folderPaths: Set<string> = new Set([
    ...((importedDefault === undefined) ? [] : [String(importedDefault['downloadDirectory'])]),
    ...importedProfiles.map((profile: Record<string, unknown>): string => String(profile['downloadDirectory'])),
  ]);
  const profilePreview: Record<string, unknown>[] = [];
  if (importedDefault !== undefined) {
    profilePreview.push({
      default: true,
      existingId: 'default',
      existingName: defaultTorrentProfile['name'],
      id: 'default',
      included: true,
      name: String(importedDefault['name']),
      suggestedAction: 'replace',
    });
  }
  for (const importedProfile of importedProfiles) {
    const existing: MockTorrentProfile | undefined = torrentProfiles.find(
      (profile: MockTorrentProfile): boolean => profile['name'].toLowerCase() === String(importedProfile['name']).toLowerCase(),
    );
    profilePreview.push({
      default: false,
      existingId: existing?.['id'] ?? null,
      existingName: existing?.['name'] ?? null,
      id: String(importedProfile['id']),
      included: true,
      name: String(importedProfile['name']),
      suggestedAction: 'replace',
    });
  }
  const importedSettings: Record<string, unknown>[] = (Array.isArray(settingsAndProfiles?.['settings'])) ? settingsAndProfiles['settings'].filter((setting: unknown): setting is Record<string, unknown> => typeof setting === 'object' && setting !== null) : [];
  const sectionNames: [string, string][] = [
    [
      'settingsAndProfiles',
      'Settings and profiles',
    ],
    [
      'labels',
      'Labels',
    ],
    [
      'notifications',
      'Notifications',
    ],
    [
      'torrents',
      'Torrent list',
    ],
    [
      'vpnConnections',
      'VPN connections',
    ],
    [
      'remoteAccess',
      'Remote app logins and API tokens',
    ],
  ];
  const remoteAccess: Record<string, unknown> | undefined = (
    typeof document['remoteAccess'] === 'object' && document['remoteAccess'] !== null
  ) ? document['remoteAccess'] as Record<string, unknown> : undefined;

  return {
    actions: mergeMockBackupAccess(document, false),
    appVersion: String(document['appVersion']),
    connections: ((noVPNConnections) ? [] : vpnConnections).map((connection: MockVPNConnection): Record<string, unknown> => ({
      default: connection['default'],
      id: connection['id'],
      name: connection['name'],
    })),
    exportedAt: String(document['exportedAt']),
    folders: [...folderPaths].filter((folderPath: string): boolean => !directories.has(folderPath)).map(
      (folderPath: string): Record<string, unknown> => ({
        dataFound: false,
        sourcePath: folderPath,
      }),
    ),
    hasRemoteLogins: (Array.isArray(remoteAccess?.['rpcLogins']) && remoteAccess['rpcLogins'].length > 0)
      || (Array.isArray(remoteAccess?.['apiTokens']) && remoteAccess['apiTokens'].length > 0),
    profiles: profilePreview,
    sections: sectionNames.filter(([key]: [string, string]): boolean => Object.hasOwn(document, key)).map(
      (entry: [string, string]): string => entry[1],
    ),
    settings: importedSettings.map((importedSetting: Record<string, unknown>): Record<string, unknown> => {
      const currentSetting: Record<string, unknown> | undefined = settings.find(
        (setting: Record<string, unknown>): boolean => setting['key'] === importedSetting['key'],
      );

      return (currentSetting === undefined) ? {
        fileValue: importedSetting['value'],
        key: String(importedSetting['key']),
        reason: 'This version does not have that setting.',
        title: String(importedSetting['key']),
        willImport: false,
      } : {
        fileValue: importedSetting['value'],
        hereValue: currentSetting['value'],
        key: String(importedSetting['key']),
        ...((currentSetting['locked'] === true) ? { reason: 'Managed configuration locks this setting.' } : {}),
        title: String(currentSetting['title']),
        willImport: currentSetting['locked'] !== true,
      };
    }),
    totalSizeBytes: (Array.isArray(document['torrents'])) ? document['torrents'].length * 3994028672 : 0,
    torrentCount: (Array.isArray(document['torrents'])) ? document['torrents'].length : 0,
  };
};

/**
 * Mock API - Builds another Transmission preview.
 *
 * Supplies a generic mounted config with used, incomplete, and empty sibling folders.
 * Every migration screen can be exercised without a Docker bind mount.
 *
 * @param {Record<string, unknown>} folderMappings - Folder mappings.
 *
 * @returns {Record<string, unknown>}
 *
 * @since 2.0.0
 */
const mockAnotherTransmissionPreview = (folderMappings: Record<string, unknown>): Record<string, unknown> => {
  const folderFixtures: Array<{
    description: string
    kind: 'default' | 'download' | 'empty' | 'incomplete'
    path: string
    total: number
  }> = [
    {
      description: 'Old default folder',
      kind: 'default',
      path: '/data/downloads',
      total: 0,
    },
    {
      description: '',
      kind: 'download',
      path: '/data/downloads/linux-isos',
      total: 12,
    },
    {
      description: '',
      kind: 'download',
      path: '/data/downloads/music',
      total: 3,
    },
    {
      description: 'Unfinished downloads',
      kind: 'incomplete',
      path: '/data/incomplete',
      total: 4,
    },
    {
      description: 'No torrents',
      kind: 'empty',
      path: '/data/downloads/podcasts',
      total: 0,
    },
  ];
  const folders: Record<string, unknown>[] = folderFixtures.map((fixture): Record<string, unknown> => {
    const mappedPath: string = String(folderMappings[fixture['path']] ?? fixture['path']);
    const found: number = (mappedPath.startsWith('/data/')) ? fixture['total'] : 0;
    let dataFoundStatus: string = 'not-found';
    if (fixture['total'] === 0) {
      dataFoundStatus = 'empty';
    } else if (found === fixture['total']) {
      dataFoundStatus = 'found';
    } else if (found > 0) {
      dataFoundStatus = 'partial';
    }

    return {
      dataFound: fixture['total'] > 0 && found === fixture['total'],
      dataFoundCount: found,
      dataFoundStatus,
      dataTotal: fixture['total'],
      description: fixture['description'],
      kind: fixture['kind'],
      mappedPath,
      sourcePath: fixture['path'],
      torrentCount: (fixture['kind'] === 'incomplete') ? 4 : fixture['total'],
    };
  });
  const importProfiles: Record<string, unknown>[] = [
    {
      default: true,
      empty: false,
      existingId: 'default',
      existingName: 'Default',
      id: 'default',
      included: true,
      name: 'Default',
      note: '',
      sourcePath: '/data/downloads',
      suggestedAction: 'replace',
    },
    ...[
      [
        'linux-isos',
        'Linux isos',
        false,
      ],
      [
        'music',
        'Music',
        false,
      ],
      [
        'podcasts',
        'Podcasts',
        true,
      ],
    ].map((profile): Record<string, unknown> => ({
      default: false,
      empty: profile[2],
      existingId: null,
      existingName: null,
      id: `tpr-mock-${String(profile[0])}`,
      included: true,
      name: profile[1],
      ...((profile[2] === true) ? { note: 'No torrents · an app may send here' } : {}),
      sourcePath: `/data/downloads/${String(profile[0])}`,
      suggestedAction: 'replace',
    })),
  ];
  const mappedSettings: Record<string, unknown>[] = [
    {
      fileValue: {
        enabled: true,
        size: 5,
      },
      hereValue: {
        enabled: true,
        size: 3,
      },
      key: 'transmission.downloadQueue',
      title: 'Download queue',
      willImport: true,
    },
    {
      fileValue: {
        idleMinutes: null,
        mode: 'limit',
        ratio: 2,
      },
      hereValue: {
        idleMinutes: null,
        mode: 'never',
        ratio: null,
      },
      key: 'profile.default.seeding',
      title: 'Seeding',
      willImport: true,
    },
    {
      fileValue: {
        download: null,
        upload: 500,
      },
      hereValue: {
        download: null,
        upload: null,
      },
      key: 'profile.default.speedLimits',
      title: 'Speed limits',
      willImport: true,
    },
    {
      fileValue: {
        enabled: true,
        source: 'https://example.invalid/blocklist.txt',
      },
      hereValue: {
        enabled: false,
        sources: [],
      },
      key: 'transmission.blocklists',
      title: 'Blocklists',
      willImport: true,
    },
    {
      fileValue: 200,
      hereValue: 100,
      key: 'transmission.peerLimitGlobal',
      title: 'Global peer limit',
      willImport: true,
    },
    {
      fileValue: 50,
      hereValue: 30,
      key: 'profile.default.peerLimit',
      title: 'Peers per torrent',
      willImport: true,
    },
    {
      fileValue: {
        enabled: true,
        path: '/data/incomplete',
      },
      hereValue: {
        enabled: true,
        path: '/data/incomplete',
      },
      key: 'transmission.incompleteFolder',
      title: 'Incomplete folder',
      willImport: true,
    },
    {
      fileValue: true,
      hereValue: false,
      key: 'profile.default.startAddedTorrents',
      title: 'Start added torrents',
      willImport: true,
    },
  ];
  const skippedSettings: Record<string, unknown>[] = [
    [
      'rpc-bind-address',
      'Remote apps sign in with RPC logins here.',
    ],
    [
      'rpc-port',
      'Remote apps sign in with RPC logins here.',
    ],
    [
      'rpc-password',
      'Remote apps sign in with RPC logins here.',
    ],
    [
      'rpc-whitelist',
      'Remote apps sign in with RPC logins here.',
    ],
    [
      'peer-port',
      'Each VPN connection has its own peer port.',
    ],
    [
      'bind-address-ipv4',
      'Traffic always leaves through the VPN.',
    ],
    [
      'watch-dir',
      'Watch folders are not supported.',
    ],
    [
      'script-torrent-done-filename',
      'Scripts are not supported.',
    ],
    [
      'alt-speed-time-enabled',
      'Alternative speed schedules are not supported.',
    ],
    [
      'encryption',
      'Encryption policy is managed by this app.',
    ],
    [
      'dht-enabled',
      'Peer discovery is managed by this app.',
    ],
    [
      'rename-partial-files',
      'Renaming partial files is not supported.',
    ],
  ].map((setting): Record<string, unknown> => ({
    fileValue: 'Saved value',
    key: `old.${String(setting[0])}`,
    reason: setting[1],
    title: setting[0],
    willImport: false,
  }));

  return {
    actions: [],
    appVersion: 'Transmission 4',
    connections: (noVPNConnections) ? [] : [
      {
        default: true,
        id: 'connection-default',
        name: 'Default connection',
      },
      {
        default: false,
        id: 'connection-secondary',
        name: 'Secondary connection',
      },
    ],
    exportedAt: new Date().toISOString(),
    folders,
    hasRemoteLogins: false,
    profiles: importProfiles,
    sections: [
      'Settings and profiles',
      'Labels',
      'Torrent list',
    ],
    settings: [
      ...mappedSettings,
      ...skippedSettings,
    ],
    sourceDetails: {
      incompleteDirectory: '/data/incomplete',
      readOnly: true,
      settingsFile: 'settings.json',
      torrentCount: 15,
      version: 4,
    },
    dataMissingCount: folders.reduce((missing: number, folder: Record<string, unknown>): number => {
      const total: number = (typeof folder['dataTotal'] === 'number') ? folder['dataTotal'] : 0;
      const found: number = (typeof folder['dataFoundCount'] === 'number') ? folder['dataFoundCount'] : 0;

      return missing + total - found;
    }, 0),
    dataFoundBytes: Math.round(1.2 * gibibyte),
    runningTorrentCount: 9,
    torrentCount: 15,
    totalSizeBytes: Math.round(1.2 * gibibyte),
  };
};

/**
 * Mock API - Starts backup import.
 *
 * Converts imported torrents into a compact source list for changing job responses.
 * Folder mappings are applied before the simulated re-check starts.
 *
 * @param {Record<string, unknown>} document       - Document.
 * @param {Record<string, unknown>} folderMappings - Folder mappings.
 *
 * @returns {MockBackupImport}
 *
 * @since 2.0.0
 */
const startMockBackupImport = (
  document: Record<string, unknown>,
  folderMappings: Record<string, unknown>,
): MockBackupImport => {
  const importedTorrents: Record<string, unknown>[] = (Array.isArray(document['torrents'])) ? document['torrents'].filter((torrent: unknown): torrent is Record<string, unknown> => typeof torrent === 'object' && torrent !== null) : [];
  const job: MockBackupImport = {
    actions: mergeMockBackupAccess(document, true),
    createdAt: new Date().toISOString(),
    id: `imp-${randomBytes(8).toString('hex')}`,
    items: importedTorrents.map((torrent: Record<string, unknown>): MockBackupImportSourceItem => {
      const sourceFolder: string = String(torrent['downloadDirectory']);
      const hash: string = String(torrent['hash']).toLowerCase();

      return {
        complete: Number(torrent['percentDone'] ?? 0) >= 1,
        duplicate: torrents.some((currentTorrent: MockTorrent): boolean => currentTorrent['hashString'].toLowerCase() === hash),
        folder: String(folderMappings[sourceFolder] ?? sourceFolder),
        hash,
        missing: false,
        name: String(torrent['name']),
        paused: torrent['paused'] === true,
        profileName: String(torrent['profileName']),
      };
    }),
    profileCount: (typeof document['settingsAndProfiles'] === 'object' && document['settingsAndProfiles'] !== null) ? 1 + ((Array.isArray((document['settingsAndProfiles'] as Record<string, unknown>)['profiles'])) ? ((document['settingsAndProfiles'] as Record<string, unknown>)['profiles'] as unknown[]).length : 0) : 0,
    settingCount: (typeof document['settingsAndProfiles'] === 'object' && document['settingsAndProfiles'] !== null && Array.isArray((document['settingsAndProfiles'] as Record<string, unknown>)['settings'])) ? ((document['settingsAndProfiles'] as Record<string, unknown>)['settings'] as unknown[]).length : 0,
    source: 'transmission-vpn-export',
    startedAtMilliseconds: Date.now(),
    totalSizeBytes: importedTorrents.length * 3994028672,
  };
  backupImportJob = job;

  return job;
};

/**
 * Mock API - Starts another Transmission import.
 *
 * Creates fifteen generic torrents across the fake mounted folders.
 * Early duplicate and missing rows make every progress pill observable.
 *
 * @param {Record<string, unknown>} body - Body.
 *
 * @returns {MockBackupImport}
 *
 * @since 2.0.0
 */
const startMockAnotherTransmissionImport = (body: Record<string, unknown>): MockBackupImport => {
  const folderMappings: Record<string, unknown> = (
    typeof body['folderMappings'] === 'object' && body['folderMappings'] !== null
  ) ? body['folderMappings'] as Record<string, unknown> : {};
  const profileNames: Record<string, unknown> = (
    typeof body['profileNames'] === 'object' && body['profileNames'] !== null
  ) ? body['profileNames'] as Record<string, unknown> : {};
  const profileIncluded: Record<string, unknown> = (
    typeof body['profileIncluded'] === 'object' && body['profileIncluded'] !== null
  ) ? body['profileIncluded'] as Record<string, unknown> : {};
  const sourceItems: Array<{
    folder: string
    name: string
    profileName: string
  }> = [
    ...Array.from({ length: 12 }, (unusedValue: unknown, index: number): {
      folder: string
      name: string
      profileName: string
    } => {
      void unusedValue;

      return {
        folder: '/data/downloads/linux-isos',
        name: `Linux image ${index + 1}`,
        profileName: String(profileNames['/data/downloads/linux-isos'] ?? 'Linux isos'),
      };
    }),
    ...Array.from({ length: 3 }, (unusedValue: unknown, index: number): {
      folder: string
      name: string
      profileName: string
    } => {
      void unusedValue;

      return {
        folder: '/data/downloads/music',
        name: `Music collection ${index + 1}`,
        profileName: String(profileNames['/data/downloads/music'] ?? 'Music'),
      };
    }),
  ];
  const job: MockBackupImport = {
    actions: [],
    createdAt: new Date().toISOString(),
    id: `imp-${randomBytes(8).toString('hex')}`,
    items: sourceItems.map((item, index: number): MockBackupImportSourceItem => ({
      complete: index % 3 !== 0,
      duplicate: index === 0,
      folder: String(folderMappings[item['folder']] ?? item['folder']),
      hash: createHash('sha1').update(`mock-import-${index}`).digest('hex'),
      missing: index === 1,
      name: item['name'],
      paused: index % 4 === 0,
      profileName: item['profileName'],
    })),
    profileCount: 3 + ((profileIncluded['/data/downloads/podcasts'] === false) ? 0 : 1),
    settingCount: 8,
    source: 'another-transmission',
    startedAtMilliseconds: Date.now(),
    totalSizeBytes: Math.round(1.2 * gibibyte),
  };
  backupImportJob = job;

  return job;
};

/**
 * Mock API - Formats backup import.
 *
 * Advances queued torrents through re-checking to their saved final run state.
 * Duplicate and missing-data outcomes use the same durable state names as the API.
 *
 * @param {MockBackupImport} job - Job.
 *
 * @returns {Record<string, unknown>}
 *
 * @since 2.0.0
 */
const mockBackupImportResponse = (job: MockBackupImport): Record<string, unknown> => {
  const elapsedSeconds: number = Math.max(0, (Date.now() - job['startedAtMilliseconds']) / 1000);
  const secondsPerItem: number = 2.5;
  const items: Record<string, unknown>[] = job['items'].map((item: MockBackupImportSourceItem, index: number): Record<string, unknown> => {
    const itemSeconds: number = elapsedSeconds - 0.5 - (index * secondsPerItem);
    let state: string = 'queued';
    let progress: number = 0;
    let detail: string = '';
    if (itemSeconds > 0 && item['duplicate']) {
      state = 'already-added';
      progress = 1;
      detail = 'This torrent is already in the library.';
    } else if (itemSeconds > 1 && item['missing']) {
      state = 'data-missing';
      progress = 1;
      detail = `No data was found in ${item['folder']}.`;
    } else if (itemSeconds >= 2) {
      state = 'downloading';
      if (item['paused']) {
        state = 'paused';
      } else if (item['complete']) {
        state = 'seeding';
      }
      progress = 1;
    } else if (itemSeconds > 0) {
      state = 'rechecking';
      progress = Math.min(0.99, itemSeconds / 2);
    }

    return {
      detail,
      folder: item['folder'],
      hash: item['hash'],
      name: item['name'],
      profileName: item['profileName'],
      progress,
      state,
    };
  });
  const completedTorrents: number = items.filter(
    (item: Record<string, unknown>): boolean => item['state'] !== 'queued' && item['state'] !== 'rechecking',
  ).length;
  const emptyJobComplete: boolean = job['items'].length === 0 && elapsedSeconds >= 1;
  const complete: boolean = emptyJobComplete || (job['items'].length > 0 && completedTorrents === job['items'].length);
  let status: string = 'running';
  if (complete) {
    status = 'completed';
  } else if (elapsedSeconds < 0.5) {
    status = 'queued';
  }
  const now: string = new Date().toISOString();

  return {
    completedAt: (complete) ? now : null,
    completedTorrents,
    createdAt: job['createdAt'],
    error: '',
    id: job['id'],
    items,
    source: job['source'],
    startedAt: new Date(job['startedAtMilliseconds']).toISOString(),
    status,
    summary: {
      actions: job['actions'],
      alreadyAdded: items.filter((item: Record<string, unknown>): boolean => item['state'] === 'already-added').length,
      dataMissing: items.filter((item: Record<string, unknown>): boolean => item['state'] === 'data-missing').length,
      imported: items.filter((item: Record<string, unknown>): boolean => [
        'downloading',
        'paused',
        'seeding',
      ].includes(String(item['state']))).length,
      profileCount: job['profileCount'],
      settingCount: job['settingCount'],
      totalSizeBytes: job['totalSizeBytes'],
    },
    totalTorrents: job['items'].length,
    updatedAt: now,
  };
};

/**
 * Mock API - Lists import source directory.
 *
 * Provides a small generic tree for the read-only mounted-folder picker.
 * Virtual system folders are absent just as they are from the real endpoint.
 *
 * @param {string} path - Path.
 *
 * @returns {Record<string, unknown> | null}
 *
 * @since 2.0.0
 */
const mockImportSourceDirectory = (path: string): Record<string, unknown> | null => {
  const tree: Record<string, string[]> = {
    '/': [
      'data',
      'import',
      'mnt',
    ],
    '/data': [
      'downloads',
      'incomplete',
    ],
    '/data/downloads': [
      'linux-isos',
      'music',
      'podcasts',
    ],
    '/data/downloads/linux-isos': [],
    '/data/downloads/music': [],
    '/data/downloads/podcasts': [],
    '/data/incomplete': [],
    '/import': [],
    '/mnt': ['archive'],
    '/mnt/archive': [],
  };
  const children: string[] | undefined = tree[path];
  if (children === undefined) {
    return null;
  }

  return {
    directories: children.map((name: string): Record<string, unknown> => {
      const childPath: string = (path === '/') ? `/${name}` : `${path}/${name}`;

      return {
        hasSubfolders: (tree[childPath]?.length ?? 0) > 0,
        name,
        path: childPath,
      };
    }),
    ...((path === '/') ? {} : { parentPath: path.slice(0, path.lastIndexOf('/')) || '/' }),
    path,
  };
};

/**
 * Mock API - Handles request.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const handleRequest = async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
  // The Host header gives the address the page was opened at, like the real server sees it.
  const url: URL = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  const path: string = url.pathname;
  const method: string = request.method ?? 'GET';

  if (!path.startsWith('/api/v1/')) {
    return false;
  }

  if (path === '/api/v1/setup/status') {
    sendJSON(response, 200, (setupRequired) ? {
      claimRequired: true,
      claimExpiresAt: new Date(setupStartedAt + (30 * 60 * 1000)).toISOString(),
    } : { claimRequired: false });

    return true;
  }

  // Claims work like the real server: any letter case, with or without spaces and dashes.
  if (path === '/api/v1/setup/claim' && method === 'POST') {
    if (!setupRequired) {
      sendError(response, 409, 'claim_unavailable', 'Setup is already complete. Sign in instead.');

      return true;
    }

    const body: Record<string, unknown> = await readBody(request);
    const claimCode: string = String(body['claimCode'] ?? '').trim();
    const username: string = String(body['username'] ?? '').trim();
    const password: string = String(body['password'] ?? '');
    const issues: {
      field: string
      message: string
    }[] = [];

    if (claimCode === '') {
      issues.push({
        field: 'claimCode',
        message: 'Enter the setup code from the container log.',
      });
    }

    if (usernameIssue(username) !== '') {
      issues.push({
        field: 'username',
        message: usernameIssue(username),
      });
    }

    if (passwordIssue(password) !== '') {
      issues.push({
        field: 'password',
        message: passwordIssue(password),
      });
    }

    if (issues.length > 0) {
      sendIssues(response, issues);

      return true;
    }

    if (claimCode.toUpperCase().replace(/[\s-]/gu, '') !== 'K7Q2MXR9TDP4W8N') {
      sendFieldError(response, 'claim_invalid', 'claimCode', 'That setup code is wrong or expired. Restart the container to print a new one.', 401);

      return true;
    }

    account.username = username;
    account.password = password;
    setupRequired = false;
    startSession(response);

    return true;
  }

  if (path === '/api/v1/auth/login' && method === 'POST') {
    const body: Record<string, unknown> = await readBody(request);
    const username: string = String(body['username'] ?? '').trim();
    const password: string = String(body['password'] ?? '');
    const missing: {
      field: string
      message: string
    }[] = [];

    if (username === '') {
      missing.push({
        field: 'username',
        message: 'Enter your username.',
      });
    }

    if (password === '') {
      missing.push({
        field: 'password',
        message: 'Enter your password.',
      });
    }

    if (missing.length > 0) {
      sendIssues(response, missing);

      return true;
    }

    if (setupRequired || username.toLowerCase() !== account['username'].toLowerCase() || password !== account['password']) {
      sendError(response, 401, 'credentials_invalid', 'The username or password is incorrect.');

      return true;
    }

    if (account['totpEnabled']) {
      sendJSON(response, 200, {
        status: 'second_factor_required',
        challenge: 'mock-challenge',
        expiresAt: new Date(Date.now() + (5 * 60 * 1000)).toISOString(),
      });

      return true;
    }

    startSession(response);

    return true;
  }

  if (path === '/api/v1/auth/login/second-factor' && method === 'POST') {
    const body: Record<string, unknown> = await readBody(request);
    const code: string = String(body['code'] ?? '').trim().toUpperCase();
    const recoveryIndex: number = account['recoveryCodes'].indexOf(code);

    if (code === '') {
      sendIssues(response, [{
        field: 'code',
        message: 'Enter the code from your authenticator app, or a recovery code.',
      }]);

      return true;
    }

    if (code !== '123456' && recoveryIndex < 0) {
      sendJSON(response, 401, {
        error: {
          code: 'code_invalid',
          message: 'That code doesn\'t match. Try the current code, or a recovery code.',
          issues: [{
            field: 'code',
            path: ['code'],
            message: 'That code doesn\'t match. Try the current code, or a recovery code.',
          }],
        },
      });

      return true;
    }

    if (recoveryIndex >= 0) {
      account['recoveryCodes'].splice(recoveryIndex, 1);
    }

    startSession(response);

    return true;
  }

  if (path === '/api/v1/auth/passkeys/login/options' && method === 'POST') {
    sendJSON(response, 200, {
      ceremonyId: 'mock-ceremony',
      options: {
        challenge: 'bW9jay1jaGFsbGVuZ2UtYnl0ZXMtMDEyMzQ1Njc4OQ',
        rpId: url.hostname,
        timeout: 300000,
        userVerification: 'required',
      },
    });

    return true;
  }

  if (path === '/api/v1/auth/passkeys/login/verify' && method === 'POST') {
    startSession(response);

    return true;
  }

  if (path === '/api/v1/auth/me' && (request.headers['authorization'] ?? '').startsWith('Bearer ')) {
    const tokenId: string | undefined = tokenValues.get((request.headers['authorization'] ?? '').slice('Bearer '.length).trim());
    const token: Record<string, unknown> | undefined = tokens.find((candidate: Record<string, unknown>): boolean => candidate['id'] === tokenId);

    if (token === undefined || (typeof token['expiresAt'] === 'string' && Date.parse(token['expiresAt']) <= Date.now())) {
      sendError(response, 401, 'authentication_required', 'Sign in, or send a valid API token.');

      return true;
    }

    Reflect.set(token, 'lastUsedAt', new Date().toISOString());
    sendJSON(response, 200, {
      authenticationType: 'token',
      id: token['id'],
      name: token['name'],
      scopes: token['scopes'],
    });

    return true;
  }

  if (path === '/api/v1/auth/me') {
    if (!signedIn) {
      sendError(response, 401, 'authentication_required', 'Sign in, or send a valid API token.');

      return true;
    }

    sendJSON(response, 200, {
      authenticationType: 'session',
      id: 'session-1',
      administratorId: 1,
      username: account['username'],
      removedSecrets,
    });

    return true;
  }

  if (!signedIn) {
    sendError(response, 401, 'authentication_required', 'Sign in to continue.');

    return true;
  }

  if (path === '/api/v1/auth/removed-secrets' && method === 'DELETE') {
    removedSecrets = [];
    response.writeHead(204).end();

    return true;
  }

  if (path === '/api/v1/auth/logout') {
    signedIn = false;
    response.writeHead(204).end();

    return true;
  }

  if (path === '/api/v1/auth/security') {
    sendJSON(response, 200, {
      username: account['username'],
      totpEnabled: account['totpEnabled'],
      recoveryCodesRemaining: account['recoveryCodes'].length,
      passkeys: account['passkeys'],
      passkeysAvailable: true,
      hostname: url.hostname,
    });

    return true;
  }

  if (path === '/api/v1/backup/confirmation' && method === 'POST') {
    const body: Record<string, unknown> = await readBody(request);
    const purpose: 'export' | 'import' | undefined = (body['purpose'] === 'export' || body['purpose'] === 'import') ? body['purpose'] : undefined;
    if (purpose === undefined) {
      sendFieldError(response, 'purpose_invalid', 'purpose', 'Choose export or import.');

      return true;
    }
    if (String(body['password'] ?? '') !== account['password']) {
      sendFieldError(response, 'password_incorrect', 'password', 'That password is incorrect.', 401);

      return true;
    }
    if (account['totpEnabled'] && String(body['code'] ?? '').trim() !== '123456') {
      sendFieldError(response, 'code_invalid', 'code', 'That code doesn\'t match. Check the time on your device and try again.', 401);

      return true;
    }
    sendJSON(response, 200, issueMockBackupGrant(purpose));

    return true;
  }

  if (path === '/api/v1/backup/confirmation/passkey/options' && method === 'POST') {
    const body: Record<string, unknown> = await readBody(request);
    const purpose: string = String(body['purpose'] ?? '');
    if (purpose !== 'export' && purpose !== 'import') {
      sendFieldError(response, 'purpose_invalid', 'purpose', 'Choose export or import.');

      return true;
    }
    sendJSON(response, 200, {
      ceremonyId: `mock-backup-${purpose}`,
      options: {
        challenge: 'bW9jay1iYWNrdXAtY2hhbGxlbmdlLTAxMjM0NTY3ODk',
        rpId: url.hostname,
        timeout: 300000,
        userVerification: 'required',
      },
    });

    return true;
  }

  if (path === '/api/v1/backup/confirmation/passkey/verify' && method === 'POST') {
    const body: Record<string, unknown> = await readBody(request);
    const purpose: 'export' | 'import' | undefined = (body['purpose'] === 'export' || body['purpose'] === 'import') ? body['purpose'] : undefined;
    if (purpose === undefined || body['ceremonyId'] !== `mock-backup-${purpose}`) {
      sendError(response, 401, 'passkey_invalid', 'The passkey confirmation expired. Try again.');

      return true;
    }
    sendJSON(response, 200, issueMockBackupGrant(purpose));

    return true;
  }

  if (path === '/api/v1/backup/export' && method === 'POST') {
    const body: Record<string, unknown> = await readBody(request);
    if (!consumeMockBackupGrant(body['grant'], 'export')) {
      sendError(response, 401, 'backup_confirmation_required', 'Confirm it\'s you again before exporting.');

      return true;
    }
    const selected: Record<string, unknown> = (
      typeof body['sections'] === 'object' && body['sections'] !== null
    ) ? body['sections'] as Record<string, unknown> : {};
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="transmission-vpn-export-${new Date().toISOString().slice(0, 10)}.json"`,
      'Content-Type': 'application/json',
    }).end(JSON.stringify(mockBackupDocument(selected)));

    return true;
  }

  if (path === '/api/v1/backup/imports/source-directories' && method === 'GET') {
    const directory: Record<string, unknown> | null = mockImportSourceDirectory(url.searchParams.get('path') ?? '/');
    if (directory === null) {
      sendFieldError(response, 'source_directory_invalid', 'path', 'That folder cannot be read.');

      return true;
    }
    sendJSON(response, 200, { directory });

    return true;
  }

  if (path === '/api/v1/backup/imports/preview' && method === 'POST') {
    const body: Record<string, unknown> = await readBody(request);
    if (body['source'] === 'another-transmission') {
      if (body['configPath'] !== '/import') {
        sendFieldError(response, 'import_source_invalid', 'source', 'No settings.json was found in that folder.');

        return true;
      }
      const folderMappings: Record<string, unknown> = (
        typeof body['folderMappings'] === 'object' && body['folderMappings'] !== null
      ) ? body['folderMappings'] as Record<string, unknown> : {};
      sendJSON(response, 200, { preview: mockAnotherTransmissionPreview(folderMappings) });

      return true;
    }
    const document: Record<string, unknown> | undefined = (
      typeof body['document'] === 'object' && body['document'] !== null
    ) ? body['document'] as Record<string, unknown> : undefined;
    if (body['source'] !== 'transmission-vpn-export' || document?.['format'] !== 'transmission-vpn-export' || document['version'] !== 1) {
      sendFieldError(response, 'export_invalid', 'document', 'Choose a valid transmission-vpn version 1 export.');

      return true;
    }
    sendJSON(response, 200, { preview: mockBackupPreview(document) });

    return true;
  }

  if (path === '/api/v1/backup/imports' && method === 'POST') {
    const body: Record<string, unknown> = await readBody(request);
    if (body['source'] === 'another-transmission') {
      if (body['configPath'] !== '/import') {
        sendFieldError(response, 'import_source_invalid', 'source', 'No settings.json was found in that folder.');

        return true;
      }
      if (!consumeMockBackupGrant(body['grant'], 'import')) {
        sendError(response, 401, 'backup_confirmation_required', 'Confirm it\'s you again before importing.');

        return true;
      }
      const job: MockBackupImport = startMockAnotherTransmissionImport(body);
      sendJSON(response, 202, { job: mockBackupImportResponse(job) });

      return true;
    }
    const document: Record<string, unknown> | undefined = (
      typeof body['document'] === 'object' && body['document'] !== null
    ) ? body['document'] as Record<string, unknown> : undefined;
    if (body['source'] !== 'transmission-vpn-export' || document?.['format'] !== 'transmission-vpn-export' || document['version'] !== 1) {
      sendFieldError(response, 'export_invalid', 'document', 'Choose a valid transmission-vpn version 1 export.');

      return true;
    }
    if (!consumeMockBackupGrant(body['grant'], 'import')) {
      sendError(response, 401, 'backup_confirmation_required', 'Confirm it\'s you again before importing.');

      return true;
    }
    const folderMappings: Record<string, unknown> = (
      typeof body['folderMappings'] === 'object' && body['folderMappings'] !== null
    ) ? body['folderMappings'] as Record<string, unknown> : {};
    const job: MockBackupImport = startMockBackupImport(document, folderMappings);
    sendJSON(response, 202, { job: mockBackupImportResponse(job) });

    return true;
  }

  if (path === '/api/v1/backup/imports/current' && method === 'GET') {
    const job: Record<string, unknown> | null = (backupImportJob === null) ? null : mockBackupImportResponse(backupImportJob);
    sendJSON(response, 200, {
      job: (job?.['status'] === 'queued' || job?.['status'] === 'running') ? job : null,
    });

    return true;
  }

  const backupImportMatch: RegExpMatchArray | null = path.match(/^\/api\/v1\/backup\/imports\/([^/]+)$/u);
  if (backupImportMatch !== null && method === 'GET') {
    if (backupImportJob === null || backupImportJob['id'] !== backupImportMatch[1]) {
      sendError(response, 404, 'backup_import_not_found', 'That import job was not found.');

      return true;
    }
    sendJSON(response, 200, { job: mockBackupImportResponse(backupImportJob) });

    return true;
  }

  if (path === '/api/v1/auth/password' && method === 'POST') {
    const body: Record<string, unknown> = await readBody(request);
    const issues: {
      field: string
      message: string
    }[] = [];

    if (String(body['currentPassword'] ?? '') === '') {
      issues.push({
        field: 'currentPassword',
        message: 'Enter your current password.',
      });
    }

    if (passwordIssue(String(body['newPassword'] ?? '')) !== '') {
      issues.push({
        field: 'newPassword',
        message: passwordIssue(String(body['newPassword'] ?? '')),
      });
    }

    if (issues.length > 0) {
      sendIssues(response, issues);

      return true;
    }

    if (body['currentPassword'] !== account['password']) {
      sendFieldError(response, 'password_incorrect', 'currentPassword', 'That password is incorrect.');

      return true;
    }

    account.password = String(body['newPassword']);
    response.writeHead(204).end();

    return true;
  }

  if (path === '/api/v1/auth/username' && method === 'POST') {
    const body: Record<string, unknown> = await readBody(request);
    const username: string = String(body['username'] ?? '').trim();
    const issues: {
      field: string
      message: string
    }[] = [];

    if (String(body['password'] ?? '') === '') {
      issues.push({
        field: 'password',
        message: 'Enter your password.',
      });
    }

    if (usernameIssue(username) !== '') {
      issues.push({
        field: 'username',
        message: usernameIssue(username),
      });
    }

    if (issues.length > 0) {
      sendIssues(response, issues);

      return true;
    }

    if (body['password'] !== account['password']) {
      sendFieldError(response, 'password_incorrect', 'password', 'That password is incorrect.');

      return true;
    }

    account.username = username;
    sendJSON(response, 200, {
      administrator: {
        id: 1,
        username,
      },
    });

    return true;
  }

  if (path === '/api/v1/auth/totp/setup' && method === 'POST') {
    const body: Record<string, unknown> = await readBody(request);

    if (String(body['password'] ?? '') === '') {
      sendIssues(response, [{
        field: 'password',
        message: 'Enter your password.',
      }]);

      return true;
    }

    if (body['password'] !== account['password']) {
      sendFieldError(response, 'password_incorrect', 'password', 'That password is incorrect.');

      return true;
    }

    if (account['totpEnabled']) {
      sendError(response, 409, 'totp_enabled', 'The authenticator app is already on.');

      return true;
    }

    account.totpSetupPending = true;

    sendJSON(response, 200, {
      secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
      uri: mockTotpUri,
      qrCode: mockQrCode(),
    });

    return true;
  }

  if (path === '/api/v1/auth/totp/enable' && method === 'POST') {
    const body: Record<string, unknown> = await readBody(request);

    if (!/^\d{6}$/u.test(String(body['code'] ?? '').trim())) {
      sendIssues(response, [{
        field: 'code',
        message: 'Enter the 6-digit code from your app.',
      }]);

      return true;
    }

    if (!account['totpSetupPending']) {
      sendError(response, 409, 'totp_setup_expired', 'Authenticator setup expired. Start again.');

      return true;
    }

    // The mock's authenticator always shows 123456.
    if (String(body['code']).trim() !== '123456') {
      sendFieldError(response, 'code_invalid', 'code', 'That code doesn\'t match. Check the time on your device and try again.');

      return true;
    }

    account.totpSetupPending = false;
    account.totpEnabled = true;
    account.recoveryCodes = newRecoveryCodes();
    removedSecrets = removedSecrets.filter((removedSecret): boolean => removedSecret.kind !== 'authenticator');
    sendJSON(response, 200, { recoveryCodes: account['recoveryCodes'].map(formatRecoveryCode) });

    return true;
  }

  if ((path === '/api/v1/auth/totp/disable' || path === '/api/v1/auth/recovery-codes') && method === 'POST') {
    const body: Record<string, unknown> = await readBody(request);

    if (String(body['password'] ?? '') === '') {
      sendIssues(response, [{
        field: 'password',
        message: 'Enter your password.',
      }]);

      return true;
    }

    if (body['password'] !== account['password']) {
      sendFieldError(response, 'password_incorrect', 'password', 'That password is incorrect.');

      return true;
    }

    if (!account['totpEnabled']) {
      sendError(response, 409, 'totp_disabled', (path === '/api/v1/auth/totp/disable') ? 'The authenticator app is already off.' : 'Turn on the authenticator app first.');

      return true;
    }

    if (path === '/api/v1/auth/totp/disable') {
      account.totpEnabled = false;
      account.recoveryCodes = [];
      response.writeHead(204).end();

      return true;
    }

    account.recoveryCodes = newRecoveryCodes();
    sendJSON(response, 200, { recoveryCodes: account['recoveryCodes'].map(formatRecoveryCode) });

    return true;
  }

  if (path === '/api/v1/auth/passkeys/register/options' && method === 'POST') {
    const body: Record<string, unknown> = await readBody(request);
    const name: string = String(body['name'] ?? '').trim();
    const issues: {
      field: string
      message: string
    }[] = [];

    if (name === '') {
      issues.push({
        field: 'name',
        message: 'Name this passkey.',
      });
    } else if ([...name].length > 80) {
      issues.push({
        field: 'name',
        message: 'Use 80 characters or fewer.',
      });
    }

    if (String(body['password'] ?? '') === '') {
      issues.push({
        field: 'password',
        message: 'Enter your password.',
      });
    }

    if (issues.length > 0) {
      sendIssues(response, issues);

      return true;
    }

    if (body['password'] !== account['password']) {
      sendFieldError(response, 'password_incorrect', 'password', 'That password is incorrect.');

      return true;
    }

    pendingPasskeyName = name;
    sendJSON(response, 200, {
      ceremonyId: 'mock-registration',
      options: {
        attestation: 'none',
        authenticatorSelection: {
          residentKey: 'required',
          userVerification: 'preferred',
        },
        challenge: 'bW9jay1jaGFsbGVuZ2UtYnl0ZXMtMDEyMzQ1Njc4OQ',
        excludeCredentials: [],
        pubKeyCredParams: [{
          alg: -7,
          type: 'public-key',
        }],
        rp: {
          id: url.hostname,
          name: 'Transmission VPN',
        },
        timeout: 300000,
        user: {
          displayName: 'admin',
          id: 'bW9jay11c2VyLWhhbmRsZQ',
          name: 'admin',
        },
      },
    });

    return true;
  }

  if (path === '/api/v1/auth/passkeys/register/verify' && method === 'POST') {
    await readBody(request);

    const passkey: Record<string, unknown> = {
      id: `pk-${Date.now()}`,
      name: pendingPasskeyName,
      hostname: url.hostname,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
    };

    account['passkeys'].push(passkey);
    sendJSON(response, 201, passkey);

    return true;
  }

  if (path.startsWith('/api/v1/auth/passkeys/') && method === 'DELETE') {
    const body: Record<string, unknown> = await readBody(request);
    const passkeyId: string = decodeURIComponent(path.slice('/api/v1/auth/passkeys/'.length));

    if (String(body['password'] ?? '') === '') {
      sendIssues(response, [{
        field: 'password',
        message: 'Enter your password.',
      }]);

      return true;
    }

    if (body['password'] !== account['password']) {
      sendFieldError(response, 'password_incorrect', 'password', 'That password is incorrect.');

      return true;
    }

    if (!account['passkeys'].some((passkey: Record<string, unknown>): boolean => passkey['id'] === passkeyId)) {
      sendError(response, 404, 'passkey_not_found', 'That passkey no longer exists.');

      return true;
    }

    account.passkeys = account['passkeys'].filter((passkey: Record<string, unknown>): boolean => passkey['id'] !== passkeyId);
    response.writeHead(204).end();

    return true;
  }

  if (path === '/api/v1/status' && method === 'GET') {
    sendJSON(response, 200, applianceStatus());

    return true;
  }

  if (path === '/api/v1/events') {
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/event-stream',
    });

    /**
     * Mock API - Send.
     *
     * Centralizes this operation for the surrounding workflow.
     * Callers reuse one implementation instead of repeating the behavior.
     *
     * @since 2.0.0
     */
    const send = (): void => {
      tick();
      response.write(`event: snapshot\ndata: ${JSON.stringify(snapshot())}\n\n`);
    };

    send();

    const timer: NodeJS.Timeout = setInterval(send, 2000);

    request.on('close', (): void => clearInterval(timer));

    return true;
  }

  if (path === '/api/v1/rpc/logins') {
    if (method === 'POST') {
      const body: Record<string, unknown> = await readBody(request);
      const username: string = String(body['username'] ?? '').trim();
      const issue: string = remoteUsernameIssue(username);
      if (issue !== '') {
        sendFieldError(response, 'invalid_request', 'username', issue);

        return true;
      }
      if (noVPNConnections) {
        sendError(response, 409, 'vpn_connection_required', 'Add a VPN connection before adding a login.');

        return true;
      }
      if (rpcLogins.some((login: MockRPCLogin): boolean => login.username.toLowerCase() === username.toLowerCase())) {
        sendFieldError(response, 'rpc_login_exists', 'username', 'An RPC login with this username already exists.', 409);

        return true;
      }

      rpcLoginSequence += 1;
      const login: MockRPCLogin = {
        createdAt: new Date().toISOString(),
        id: `rpl-${rpcLoginSequence.toString(16).padStart(16, '0')}`,
        lastUsedAt: null,
        username,
      };
      const password: string = `rpc_${randomBytes(18).toString('base64url')}`;
      rpcLogins.push(login);
      rpcLoginDigests.set(login['id'], createHash('sha256').update(password).digest('base64'));
      sendJSON(response, 201, {
        login,
        password,
      });

      return true;
    }

    sendJSON(response, 200, { logins: rpcLogins });

    return true;
  }

  const rpcLoginMatch: RegExpMatchArray | null = path.match(/^\/api\/v1\/rpc\/logins\/([^/]+)$/u);
  if (rpcLoginMatch !== null) {
    const login: MockRPCLogin | undefined = rpcLogins.find(
      (candidate: MockRPCLogin): boolean => candidate.id === decodeURIComponent(rpcLoginMatch[1] ?? ''),
    );
    if (login === undefined) {
      sendError(response, 404, 'rpc_login_not_found', 'That RPC login no longer exists.');

      return true;
    }
    if (method === 'DELETE') {
      rpcLogins.splice(rpcLogins.indexOf(login), 1);
      rpcLoginDigests.delete(login['id']);
      response.writeHead(204).end();

      return true;
    }
    if (method === 'PUT') {
      const body: Record<string, unknown> = await readBody(request);
      if (body['username'] !== undefined) {
        const username: string = String(body['username']).trim();
        const issue: string = remoteUsernameIssue(username);
        if (issue !== '') {
          sendFieldError(response, 'invalid_request', 'username', issue);

          return true;
        }
        if (rpcLogins.some((candidate: MockRPCLogin): boolean => candidate !== login && candidate.username.toLowerCase() === username.toLowerCase())) {
          sendFieldError(response, 'rpc_login_exists', 'username', 'An RPC login with this username already exists.', 409);

          return true;
        }
        login.username = username;
      }

      const regeneratePassword: boolean = body['regeneratePassword'] === true;
      if (body['username'] === undefined && !regeneratePassword) {
        sendFieldError(response, 'invalid_request', 'regeneratePassword', 'Change the username or regenerate the password.');

        return true;
      }
      const password: string | undefined = (regeneratePassword) ? `rpc_${randomBytes(18).toString('base64url')}` : undefined;
      if (password !== undefined) {
        rpcLoginDigests.set(login['id'], createHash('sha256').update(password).digest('base64'));
      }
      sendJSON(response, 200, {
        login,
        ...((password === undefined) ? {} : { password }),
      });

      return true;
    }
  }

  if (path === '/api/v1/web-proxy') {
    if (method === 'PUT') {
      const body: Record<string, unknown> = await readBody(request);
      if (typeof body['enabled'] !== 'boolean') {
        sendFieldError(response, 'invalid_request', 'enabled', 'Choose whether the web proxy is on.');

        return true;
      }
      if (body['enabled'] && noVPNConnections) {
        sendError(response, 409, 'vpn_connection_required', 'Add a VPN connection before turning on the web proxy.');

        return true;
      }
      const requestedEnabled: boolean = body['enabled'];
      webProxyEnabled = requestedEnabled;
      webProxyTransitionSequence += 1;
      const transitionSequence: number = webProxyTransitionSequence;
      setTimeout((): void => {
        if (transitionSequence === webProxyTransitionSequence) {
          webProxyRuntimeEnabled = requestedEnabled;
        }
      }, 2000);
    }

    sendJSON(response, 200, webProxyResponse());

    return true;
  }

  if (path === '/api/v1/web-proxy/logins' && method === 'POST') {
    const body: Record<string, unknown> = await readBody(request);
    if (body['password'] !== undefined) {
      sendFieldError(response, 'invalid_request', 'password', 'This field isn\'t accepted.');

      return true;
    }

    const username: string = String(body['username'] ?? '').trim();
    const issues: {
      field: string
      message: string
    }[] = [];
    const usernameMessage: string = remoteUsernameIssue(username);
    if (usernameMessage !== '') {
      issues.push({
        field: 'username',
        message: usernameMessage,
      });
    }
    const requestedConnectionId: unknown = body['connectionId'];
    if (requestedConnectionId !== undefined && requestedConnectionId !== null && (
      typeof requestedConnectionId !== 'string' || requestedConnectionId === ''
    )) {
      issues.push({
        field: 'connectionId',
        message: 'Choose an existing VPN connection, or set up a default connection first.',
      });
    }
    if (issues.length > 0) {
      sendIssues(response, issues);

      return true;
    }
    if (typeof requestedConnectionId === 'string' && !vpnConnections.some(
      (connection: MockVPNConnection): boolean => connection['id'] === requestedConnectionId,
    )) {
      sendFieldError(
        response,
        'web_proxy_connection_invalid',
        'connectionId',
        'Choose an existing VPN connection, or set up a default connection first.',
      );

      return true;
    }
    if (noVPNConnections) {
      sendError(response, 409, 'vpn_connection_required', 'Add a VPN connection before adding a login.');

      return true;
    }
    if (typeof requestedConnectionId === 'string' && isConnectionBeingRemoved(requestedConnectionId)) {
      sendConnectionBeingRemoved(response);

      return true;
    }
    if (webProxyLogins.some((login: MockWebProxyLogin): boolean => login.username.toLowerCase() === username.toLowerCase())) {
      sendFieldError(response, 'web_proxy_login_exists', 'username', 'A web proxy login with this username already exists.', 409);

      return true;
    }

    webProxyLoginSequence += 1;
    const login: MockWebProxyLogin = {
      connectionId: (typeof body['connectionId'] === 'string') ? body['connectionId'] : null,
      id: `wpl-${webProxyLoginSequence.toString(16).padStart(16, '0')}`,
      passwordSet: true,
      username,
    };
    webProxyLogins.push(login);
    sendJSON(response, 201, {
      login: effectiveWebProxyLogin(login),
      password: `proxy_${randomBytes(18).toString('base64url')}`,
    });

    return true;
  }

  const webProxyLoginMatch: RegExpMatchArray | null = path.match(/^\/api\/v1\/web-proxy\/logins\/([^/]+)$/u);
  if (webProxyLoginMatch !== null) {
    const login: MockWebProxyLogin | undefined = webProxyLogins.find(
      (candidate: MockWebProxyLogin): boolean => candidate.id === decodeURIComponent(webProxyLoginMatch[1] ?? ''),
    );
    if (login === undefined) {
      sendError(response, 404, 'web_proxy_login_not_found', 'That web proxy login no longer exists.');

      return true;
    }
    if (method === 'DELETE') {
      webProxyLogins.splice(webProxyLogins.indexOf(login), 1);
      response.writeHead(204).end();

      return true;
    }
    if (method === 'PUT') {
      const body: Record<string, unknown> = await readBody(request);
      if (body['password'] !== undefined) {
        sendFieldError(response, 'invalid_request', 'password', 'This field isn\'t accepted.');

        return true;
      }

      const regeneratePassword: boolean = body['regeneratePassword'] === true;
      if (body['regeneratePassword'] !== undefined && typeof body['regeneratePassword'] !== 'boolean') {
        sendFieldError(response, 'invalid_request', 'regeneratePassword', 'Choose whether to regenerate the password.');

        return true;
      }
      if (body['username'] === undefined && body['connectionId'] === undefined && !regeneratePassword) {
        sendFieldError(response, 'invalid_request', 'regeneratePassword', 'Change the username, VPN connection, or regenerate the password.');

        return true;
      }
      if (body['username'] !== undefined) {
        const username: string = String(body['username']).trim();
        const issue: string = remoteUsernameIssue(username);
        if (issue !== '') {
          sendFieldError(response, 'invalid_request', 'username', issue);

          return true;
        }
        if (webProxyLogins.some((candidate: MockWebProxyLogin): boolean => candidate !== login && candidate.username.toLowerCase() === username.toLowerCase())) {
          sendFieldError(response, 'web_proxy_login_exists', 'username', 'A web proxy login with this username already exists.', 409);

          return true;
        }
        login.username = username;
      }
      if (body['connectionId'] !== undefined && body['connectionId'] !== null && (
        typeof body['connectionId'] !== 'string'
        || !vpnConnections.some((connection: MockVPNConnection): boolean => connection['id'] === body['connectionId'])
      )) {
        sendFieldError(
          response,
          'invalid_request',
          'connectionId',
          'Choose an existing VPN connection, or set up a default connection first.',
        );

        return true;
      }
      if (typeof body['connectionId'] === 'string' && isConnectionBeingRemoved(body['connectionId'])) {
        sendConnectionBeingRemoved(response);

        return true;
      }
      if (body['connectionId'] !== undefined) {
        login.connectionId = (typeof body['connectionId'] === 'string') ? body['connectionId'] : null;
      }
      sendJSON(response, 200, {
        login: effectiveWebProxyLogin(login),
        ...((regeneratePassword) ? { password: `proxy_${randomBytes(18).toString('base64url')}` } : {}),
      });

      return true;
    }
  }

  if (path === '/api/v1/vpn/connections') {
    if (method === 'POST') {
      const body: Record<string, unknown> = await readBody(request);
      const name: string = String(body['name'] ?? '').trim();
      const peerPort: number = Number(body['peerPort'] ?? (51_413 + vpnConnections.length));
      const profileIds: string[] = (Array.isArray(body['profileIds'])) ? body['profileIds'].map(String) : [];
      const providerId: string = String(body['providerId'] ?? '');
      const tunnel: 'openvpn' | 'wireguard' = (body['tunnel'] === 'wireguard') ? 'wireguard' : 'openvpn';
      const credentials: Record<string, string> = submittedMockVPNCredentials(body['credentials']);
      if (vpnConnections.some((connection: MockVPNConnection): boolean => connection['changeRunning'])) {
        sendError(response, 409, 'change_running', 'Another change for this VPN connection is still running.');

        return true;
      }
      if (vpnConnections.length >= 8) {
        sendError(response, 409, 'capacity_reached', 'The appliance is at its VPN connection limit.', {
          limit: 8,
          used: vpnConnections.length,
        });

        return true;
      }
      if (vpnConnections.some((connection: MockVPNConnection): boolean => connection['name'].toLowerCase() === name.toLowerCase())) {
        sendError(response, 409, 'name_taken', 'A VPN connection already uses that name.');

        return true;
      }
      if (name === '' || profileIds.length === 0 || !Number.isInteger(peerPort) || peerPort < 1024 || peerPort > 65_535) {
        sendError(response, 422, 'invalid_request', 'Enter a name, endpoint, and valid peer port.');

        return true;
      }
      const missingCredential: MockVPNCredentialField | undefined = missingMockVPNCredential(
        providerId,
        tunnel,
        credentials,
      );
      if (missingCredential !== undefined) {
        sendMockVPNCredentialError(response, 'credentials', missingCredential);

        return true;
      }
      if (process.env['MOCK_VPN_TEST_FAILURE'] === 'true') {
        sendError(response, 502, 'vpn_test_failed', mockVPNTestFailureMessage);

        return true;
      }
      vpnConnectionSequence += 1;
      const now: string = new Date().toISOString();
      const slot: number = Math.max(-1, ...vpnConnections.map((connection: MockVPNConnection): number => connection['slot'])) + 1;
      const endpointStrategy: 'ordered' | 'randomized' | 'sticky' = (body['endpointStrategy'] === 'ordered' || body['endpointStrategy'] === 'randomized') ? body['endpointStrategy'] : 'sticky';
      const connectionId: string = `vpc-${vpnConnectionSequence.toString(16).padStart(16, '0')}`;
      const connection: MockVPNConnection = {
        changeRunning: false,
        createdAt: now,
        daemon: {
          bindAddress: `10.64.${String(slot)}.2`,
          peerPort,
          rpcPort: 9092 + slot,
          state: 'ready',
        },
        default: false,
        dnsServers: (Array.isArray(body['dnsServers'])) ? body['dnsServers'].map(String) : [],
        enabled: true,
        endpointStrategy,
        id: connectionId,
        name,
        needsSetup: false,
        peerPort,
        profileIds,
        providerId,
        retryIntervalSeconds: Number(body['retryIntervalSeconds'] ?? 10),
        revision: 1,
        savedCredentials: savedMockVPNCredentialKeys(providerId, tunnel, credentials),
        runtime: protectedVPNRuntime(providerId, tunnel, profileIds, endpointStrategy, slot),
        slot,
        tunnel,
        updatedAt: now,
      };
      vpnCredentialValues.set(connectionId, credentials);
      vpnConnections.push(connection);
      sendJSON(response, 201, { connection: vpnConnectionResponse(connection) });

      return true;
    }

    sendJSON(response, 200, vpnConnectionsResponse());

    return true;
  }

  if (path === '/api/v1/vpn/default' && method === 'PUT') {
    const body: Record<string, unknown> = await readBody(request);
    if ('moveTorrents' in body && typeof body['moveTorrents'] !== 'boolean') {
      sendFieldError(response, 'invalid_request', 'moveTorrents', 'moveTorrents must be a boolean.');

      return true;
    }
    if (vpnConnections.some((connection: MockVPNConnection): boolean => connection['changeRunning'])) {
      sendError(response, 409, 'change_running', 'Another change for this VPN connection is still running.');

      return true;
    }
    const nextDefault: MockVPNConnection | undefined = vpnConnections.find(
      (connection: MockVPNConnection): boolean => connection['id'] === body['connectionId'],
    );
    if (nextDefault === undefined) {
      sendError(response, 404, 'connection_not_found', 'That VPN connection no longer exists.');

      return true;
    }
    const previousDefault: MockVPNConnection = defaultVPNConnection();
    const followingProfileIDs: Set<string> = new Set(torrentProfiles.filter(
      (profile: MockTorrentProfile): boolean => profile['connectionId'] === null,
    ).map((profile: MockTorrentProfile): string => profile['id']));
    const profileTorrents: MockTorrent[] = torrents.filter((torrent: MockTorrent): boolean => (
      (torrent['profileId'] === null || followingProfileIDs.has(torrent['profileId']))
      && torrent['connectionId'] !== nextDefault['id']
    ));
    const defaultProfileTorrents: number = profileTorrents.filter(
      (torrent: MockTorrent): boolean => torrent['profileId'] === null,
    ).length;
    const followingProfileTorrents: number = profileTorrents.length - defaultProfileTorrents;
    if (profileTorrents.length > 0 && body['moveTorrents'] !== true) {
      sendError(
        response,
        409,
        'torrents_must_move',
        'Torrents that follow the default VPN connection must move to the new default VPN connection.',
        {
          defaultProfileTorrents,
          followingProfileTorrents,
          fromConnection: {
            id: previousDefault['id'],
            name: previousDefault['name'],
          },
          toConnection: {
            id: nextDefault['id'],
            name: nextDefault['name'],
          },
          torrents: profileTorrents.length,
        },
      );

      return true;
    }
    for (const connection of vpnConnections) {
      connection.default = connection === nextDefault;
      connection.updatedAt = new Date().toISOString();
    }
    const moved: Record<string, unknown>[] = profileTorrents.map(
      (torrent: MockTorrent, index: number): Record<string, unknown> => {
        const failed: boolean = process.env['MOCK_VPN_MOVE_FAILURE'] === 'true' && index === 0;
        if (!failed) {
          Reflect.set(torrent, 'id', Math.max(0, ...torrents.map((candidate: MockTorrent): number => candidate['id'])) + 1);
          Reflect.set(torrent, 'connectionId', nextDefault['id']);
        }

        return {
          ...((failed) ? { error: 'The mock torrent move failed before its source was changed.' } : {}),
          hash: torrent['hashString'],
          ...((failed) ? {} : { id: torrent['id'] }),
          name: torrent['name'],
          result: (failed) ? 'failed' : 'moved',
          ...((failed || torrentMoveWarnings.length === 0) ? {} : { warnings: torrentMoveWarnings }),
        };
      },
    );
    sendJSON(response, 200, {
      connections: vpnConnectionsResponse()['connections'],
      moved,
    });

    return true;
  }

  const vpnConnectionMatch: RegExpMatchArray | null = path.match(/^\/api\/v1\/vpn\/connections\/([^/]+)(?:\/(reconnect|disconnect))?$/u);
  if (vpnConnectionMatch !== null) {
    const connection: MockVPNConnection | undefined = vpnConnections.find(
      (candidate: MockVPNConnection): boolean => candidate['id'] === decodeURIComponent(vpnConnectionMatch[1] ?? ''),
    );
    if (connection === undefined) {
      sendError(response, 404, 'connection_not_found', 'That VPN connection no longer exists.');

      return true;
    }
    const action: string | undefined = vpnConnectionMatch[2];
    const mutatingConnectionRoute: boolean = (
      (action !== undefined && method === 'POST')
      || (action === undefined && (method === 'PUT' || method === 'DELETE'))
    );
    if (mutatingConnectionRoute
      && vpnConnections.some((candidate: MockVPNConnection): boolean => candidate['changeRunning'])) {
      sendError(response, 409, 'change_running', 'Another change for this VPN connection is still running.');

      return true;
    }
    if (action !== undefined && method === 'POST') {
      if (action === 'reconnect' && process.env['MOCK_VPN_TEST_FAILURE'] === 'true') {
        sendError(response, 502, 'vpn_test_failed', mockVPNTestFailureMessage);

        return true;
      }
      connection.runtime = (action === 'disconnect') ? {
        address: '',
        attempt: 1,
        endpointCount: connection['profileIds'].length,
        endpointPosition: 1,
        endpointStrategy: connection['endpointStrategy'],
        interface: '',
        lastError: 'Disconnected by an administrator',
        profileId: connection['profileIds'][0],
        providerId: connection['providerId'],
        remoteHost: '',
        remotePort: 0,
        state: 'blocked',
        transitionedAt: new Date().toISOString(),
        tunnel: connection['tunnel'],
      } : protectedVPNRuntime(connection['providerId'], connection['tunnel'], connection['profileIds'], connection['endpointStrategy'], connection['slot']);
      connection.enabled = action !== 'disconnect';
      connection.updatedAt = new Date().toISOString();
      sendJSON(response, 200, { connection: vpnConnectionResponse(connection) });

      return true;
    }
    if (method === 'GET') {
      sendJSON(response, 200, { connection: vpnConnectionResponse(connection) });

      return true;
    }
    if (method === 'PUT') {
      const body: Record<string, unknown> = await readBody(request);
      if (Number(body['expectedRevision']) !== connection['revision']) {
        sendError(response, 409, 'revision_conflict', 'The VPN connection changed while it was being edited.');

        return true;
      }
      const name: string = (body['name'] === undefined) ? connection['name'] : String(body['name']).trim();
      if (vpnConnections.some((candidate: MockVPNConnection): boolean => candidate !== connection && candidate['name'].toLowerCase() === name.toLowerCase())) {
        sendError(response, 409, 'name_taken', 'A VPN connection already uses that name.');

        return true;
      }
      connection.name = name;
      if (body['peerPort'] !== undefined) {
        connection.peerPort = Number(body['peerPort']);
        connection.daemon.peerPort = connection.peerPort;
      }
      if (typeof body['configuration'] === 'object' && body['configuration'] !== null) {
        const configuration: Record<string, unknown> = body['configuration'] as Record<string, unknown>;
        const profileIds: string[] = (Array.isArray(configuration['profileIds'])) ? configuration['profileIds'].map(String) : [];
        const providerId: string = String(configuration['providerId'] ?? '');
        const tunnel: 'openvpn' | 'wireguard' = (configuration['tunnel'] === 'wireguard') ? 'wireguard' : 'openvpn';
        const submittedCredentials: Record<string, string> = submittedMockVPNCredentials(configuration['credentials']);
        const credentials: Record<string, string> = mergedMockVPNCredentials(
          connection,
          providerId,
          tunnel,
          submittedCredentials,
        );
        const missingCredential: MockVPNCredentialField | undefined = missingMockVPNCredential(
          providerId,
          tunnel,
          credentials,
        );
        if (missingCredential !== undefined) {
          sendMockVPNCredentialError(response, 'configuration.credentials', missingCredential);

          return true;
        }
        if (process.env['MOCK_VPN_TEST_FAILURE'] === 'true') {
          sendError(response, 502, 'vpn_test_failed', mockVPNTestFailureMessage);

          return true;
        }
        const endpointStrategy: 'ordered' | 'randomized' | 'sticky' = (configuration['endpointStrategy'] === 'ordered' || configuration['endpointStrategy'] === 'randomized') ? configuration['endpointStrategy'] : 'sticky';
        connection.providerId = providerId;
        connection.tunnel = tunnel;
        connection.profileIds = profileIds;
        connection.endpointStrategy = endpointStrategy;
        connection.dnsServers = (Array.isArray(configuration['dnsServers'])) ? configuration['dnsServers'].map(String) : [];
        connection.retryIntervalSeconds = Number(configuration['retryIntervalSeconds'] ?? 10);
        connection.savedCredentials = savedMockVPNCredentialKeys(providerId, tunnel, credentials);
        connection.runtime = protectedVPNRuntime(connection['providerId'], tunnel, profileIds, endpointStrategy, connection['slot']);
        connection.enabled = true;
        connection.needsSetup = false;
        vpnCredentialValues.set(connection['id'], credentials);
      }
      connection.revision += 1;
      connection.updatedAt = new Date().toISOString();
      sendJSON(response, 200, { connection: vpnConnectionResponse(connection) });

      return true;
    }
    if (method === 'DELETE') {
      if (connection['default']) {
        sendError(response, 409, 'default_connection', 'Change the default VPN connection before deleting this one.');

        return true;
      }
      const body: Record<string, unknown> = await readBody(request);
      const dependentTorrents: MockTorrent[] = torrents.filter((torrent: MockTorrent): boolean => torrent['connectionId'] === connection['id']);
      const dependentProfiles: MockTorrentProfile[] = torrentProfiles.filter((profile: MockTorrentProfile): boolean => profile['connectionId'] === connection['id']);
      const dependentLogins: MockWebProxyLogin[] = webProxyLogins.filter((login: MockWebProxyLogin): boolean => login['connectionId'] === connection['id']);
      if (body['moveTo'] === undefined && (dependentTorrents.length > 0 || dependentProfiles.length > 0 || dependentLogins.length > 0)) {
        sendError(response, 409, 'connection_in_use', 'Move the items that use this connection before removing it.', {
          logins: dependentLogins.map((login: MockWebProxyLogin): Record<string, unknown> => ({
            id: login['id'],
            username: login['username'],
          })),
          profiles: dependentProfiles.map((profile: MockTorrentProfile): Record<string, unknown> => ({
            id: profile['id'],
            name: profile['name'],
          })),
          torrents: dependentTorrents.length,
        });

        return true;
      }
      const moveTo: string | undefined = (typeof body['moveTo'] === 'string') ? body['moveTo'] : undefined;
      if (moveTo !== undefined && !vpnConnections.some((candidate: MockVPNConnection): boolean => candidate['id'] === moveTo && candidate !== connection)) {
        sendError(response, 422, 'invalid_request', 'Choose another VPN connection.');

        return true;
      }
      if (isConnectionBeingRemoved(moveTo)) {
        sendConnectionBeingRemoved(response);

        return true;
      }
      const targetConnectionName: string = vpnConnections.find(
        (candidate: MockVPNConnection): boolean => candidate['id'] === moveTo,
      )?.['name'] ?? 'the target connection';
      const moved: Record<string, unknown>[] = dependentTorrents.map((torrent: MockTorrent, index: number): Record<string, unknown> => {
        const failed: boolean = process.env['MOCK_VPN_MOVE_FAILURE'] === 'true' && index === 0;
        if (!failed && moveTo !== undefined) {
          Reflect.set(torrent, 'id', Math.max(0, ...torrents.map((candidate: MockTorrent): number => candidate['id'])) + 1);
          Reflect.set(torrent, 'connectionId', moveTo);
        }

        return {
          ...((failed) ? { error: `A paused copy is still on ${targetConnectionName}` } : {}),
          hash: torrent['hashString'],
          ...((failed) ? {} : { id: torrent['id'] }),
          name: torrent['name'],
          result: (failed) ? 'failed' : 'moved',
          ...((failed || torrentMoveWarnings.length === 0) ? {} : { warnings: torrentMoveWarnings }),
        };
      });
      if (moved.some((result: Record<string, unknown>): boolean => result['result'] === 'failed')) {
        sendError(response, 409, 'move_failed', 'Some torrents could not be moved.', { moved });

        return true;
      }
      if (moveTo !== undefined) {
        const storedMoveTo: string | null = (vpnConnections.find(
          (candidate: MockVPNConnection): boolean => candidate['id'] === moveTo,
        )?.['default'] === true) ? null : moveTo;
        for (const profile of dependentProfiles) {
          profile.connectionId = storedMoveTo;
        }
        for (const login of dependentLogins) {
          login.connectionId = storedMoveTo;
        }
      }
      vpnCredentialValues.delete(connection['id']);
      vpnConnections.splice(vpnConnections.indexOf(connection), 1);
      sendJSON(response, 200, {
        logins: dependentLogins.length,
        moved,
        profiles: dependentProfiles.length,
      });

      return true;
    }
  }

  const refreshCatalogMatch: RegExpMatchArray | null = path.match(
    /^\/api\/v1\/vpn\/providers\/([^/]+)\/tunnels\/(openvpn|wireguard)\/catalog\/refresh$/u,
  );
  if (refreshCatalogMatch !== null && method === 'POST') {
    const providerId: string = decodeURIComponent(refreshCatalogMatch[1] ?? '');
    const tunnel: string = refreshCatalogMatch[2] ?? '';
    const tunnelDefinition = providers.find(
      (provider: Record<string, unknown>): boolean => provider['id'] === providerId,
    )?.['tunnels'];
    const selectedTunnelDefinition: Record<string, unknown> | undefined = (Array.isArray(tunnelDefinition)) ? tunnelDefinition.find(
      (candidate: Record<string, unknown>): boolean => candidate['id'] === tunnel,
    ) : undefined;
    const catalog: unknown = selectedTunnelDefinition?.['catalog'];
    if (typeof catalog !== 'object' || catalog === null) {
      sendError(response, 404, 'catalog_unavailable', 'This VPN provider does not expose a refreshable catalog for this tunnel.');

      return true;
    }
    const refreshedCatalog: Record<string, unknown> = {
      ...catalog as Record<string, unknown>,
      refreshedAt: new Date().toISOString(),
    };
    Reflect.set(
      selectedTunnelDefinition ?? {},
      'catalog',
      refreshedCatalog,
    );
    sendJSON(response, 200, refreshedCatalog);

    return true;
  }

  if (path === '/api/v1/blocklists' && method === 'GET') {
    sendJSON(response, 200, blocklistStatus);

    return true;
  }

  if (path === '/api/v1/blocklists/update' && method === 'POST') {
    await readBody(request);
    const enabled: boolean = settings.find(
      (setting: Record<string, unknown>): boolean => setting['key'] === 'transmission.blocklistEnabled',
    )?.['value'] === true;
    const configuredSources: unknown = settings.find(
      (setting: Record<string, unknown>): boolean => setting['key'] === 'transmission.blocklistSources',
    )?.['value'];
    if (!enabled) {
      sendError(response, 409, 'blocklists_disabled', 'Turn on blocklists before updating them.');

      return true;
    }
    if (!Array.isArray(configuredSources) || configuredSources.length === 0) {
      sendError(response, 409, 'blocklist_sources_empty', 'Add a blocklist source before updating.');

      return true;
    }

    const updateRequestedAt: string = new Date().toISOString();
    blocklistStatus = {
      ...blocklistStatus,
      state: 'updating',
    };
    setTimeout((): void => {
      const completedAt: string = new Date().toISOString();
      blocklistStatus = {
        state: 'idle',
        lastAttemptAt: completedAt,
        lastSuccessAt: completedAt,
        nextUpdateAt: new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString(),
        totalRanges: 155_804,
        sources: [
          {
            url: 'https://lists.example.net/level1.txt',
            state: 'ok',
            ranges: 94_102,
            updatedAt: completedAt,
          },
          {
            url: 'https://blocklists.example.net/peer-guard.dat.gz',
            state: 'ok',
            ranges: 50_231,
            updatedAt: completedAt,
          },
          {
            url: 'https://cdn.example.net/abuse-cidrs.zip',
            state: 'ok',
            ranges: 11_471,
            updatedAt: completedAt,
          },
        ],
      };
    }, 750);
    sendJSON(response, 202, { updateRequestedAt });

    return true;
  }

  if (path === '/api/v1/settings') {
    let runtimeApply: Record<string, unknown> | undefined = undefined;
    if (method === 'PUT') {
      const body: Record<string, unknown> = await readBody(request);
      const changes: Record<string, unknown> = (typeof body['changes'] === 'object' && body['changes'] !== null) ? body['changes'] as Record<string, unknown> : {};
      if (changes['rpc.compatibilityEnabled'] === true && noVPNConnections) {
        sendError(response, 409, 'vpn_connection_required', 'Add a VPN connection before turning on the RPC proxy.');

        return true;
      }
      if (Number(body['expectedRevision']) !== settingsRevision) {
        sendError(response, 409, 'revision_conflict', 'Settings changed since this revision. Refresh and try again.');

        return true;
      }
      const rootDownloadSetting: string | undefined = [
        'transmission.downloadDirectory',
        'transmission.incompleteDirectory',
      ].find((key: string): boolean => isDownloadDataRoot(changes[key]));
      if (rootDownloadSetting !== undefined) {
        sendFieldError(response, 'invalid_request', `changes.${rootDownloadSetting}`, downloadDataPathRootMessage);

        return true;
      }
      const nextDownloadDirectory: string = String(
        changes['transmission.downloadDirectory']
        ?? effectiveStringSetting('transmission.downloadDirectory'),
      );
      const nextIncompleteDirectory: string = String(
        changes['transmission.incompleteDirectory']
        ?? effectiveStringSetting('transmission.incompleteDirectory'),
      );
      if (
        'transmission.downloadDirectory' in changes
        && defaultTorrentProfile['downloadDirectoryLocked']
      ) {
        sendError(response, 409, 'setting_locked', 'A changed setting is locked by managed configuration.');

        return true;
      }
      if ('transmission.downloadDirectory' in changes) {
        const folderOwner = profileFolderOwner(nextDownloadDirectory, 'default');
        if (folderOwner !== undefined) {
          sendFieldError(
            response,
            'profile_folder_taken',
            'changes.transmission.downloadDirectory',
            profileFolderTakenMessage(nextDownloadDirectory, folderOwner['name'], folderOwner['relation']),
            409,
          );

          return true;
        }
      }
      if ('transmission.incompleteDirectory' in changes) {
        const clash: {
          path: string
          profileName: string
        } | undefined = [
          {
            path: nextDownloadDirectory,
            profileName: defaultTorrentProfile['name'],
          },
          ...torrentProfiles.map((profile: MockTorrentProfile): {
            path: string
            profileName: string
          } => ({
            path: profile['downloadDirectory'],
            profileName: `${profile['name']} profile`,
          })),
        ].find((destination): boolean => dataPathContains(
          nextIncompleteDirectory,
          destination['path'],
        ));
        if (clash !== undefined) {
          const exactFolder: boolean = dataPathsEqualIgnoringCase(nextIncompleteDirectory, clash['path']);
          const message: string = (exactFolder) ? `“${clash['path'].slice(clash['path'].lastIndexOf('/') + 1)}” is the ${clash['profileName']}'s folder, so it can't be the incomplete folder.` : `Use a folder outside ${clash['path']}. Torrents in the ${clash['profileName']} finish there.`;
          sendFieldError(
            response,
            'invalid_request',
            'changes.transmission.incompleteDirectory',
            message,
          );

          return true;
        }
      } else if ('transmission.downloadDirectory' in changes) {
        const issue: string = downloadFolderIssue(nextDownloadDirectory);
        if (issue !== '') {
          sendFieldError(
            response,
            'invalid_request',
            'changes.transmission.downloadDirectory',
            issue,
          );

          return true;
        }
      }
      const appliedKeys: string[] = [];
      const pendingKeys: string[] = [];

      for (const setting of settings) {
        const settingKey: string = String(setting['key']);

        if (settingKey in changes) {
          Reflect.set(setting, 'value', changes[settingKey]);
          Reflect.set(setting, 'source', 'user');
          if (setting['applyImpact'] === 'transmission-restart') {
            pendingKeys.push(settingKey);
          } else {
            appliedKeys.push(settingKey);
          }
        }
      }

      if (typeof changes['transmission.downloadDirectory'] === 'string') {
        defaultTorrentProfile.downloadDirectory = changes['transmission.downloadDirectory'];
      }

      if ([
        'transmission.downloadDirectory',
        'transmission.incompleteDirectory',
        'transmission.incompleteDirectoryEnabled',
      ].some((key: string): boolean => key in changes)) {
        ensureConfiguredDirectories();
      }

      pendingRestartKeys = (noVPNConnections) ? [] : [...new Set([
        ...pendingRestartKeys,
        ...pendingKeys,
      ])].sort();
      runtimeApply = {
        status: (pendingKeys.length === 0) ? 'applied' : 'restart-required',
        appliedKeys: appliedKeys.sort(),
        pendingKeys: pendingKeys.sort(),
        connections: ((noVPNConnections) ? [] : vpnConnections).map((connection: MockVPNConnection): Record<string, unknown> => ({
          appliedKeys,
          connectionId: connection['id'],
          pendingKeys,
          status: (pendingKeys.length === 0) ? 'applied' : 'restart-required',
        })),
      };
      settingsRevision += 1;
    }

    if (noVPNConnections) {
      pendingRestartKeys = [];
    }
    sendJSON(response, 200, {
      revision: settingsRevision,
      settings,
      pendingRestartKeys,
      ...((runtimeApply === undefined) ? {} : { runtimeApply }),
    });

    return true;
  }

  if (path === '/api/v1/transmission/restart' && method === 'POST') {
    const body: Record<string, unknown> = await readBody(request);
    if (body['confirm'] !== true) {
      sendError(response, 422, 'restart_confirmation_required', 'A controlled Transmission restart requires explicit confirmation.');

      return true;
    }

    pendingRestartKeys = [];
    if (noVPNConnections) {
      sendError(response, 409, 'transmission_not_running', 'Transmission isn\'t running. Saved settings apply when it starts.');

      return true;
    }
    sendJSON(response, 202, {
      status: 'restarting',
      configurationRevision: settingsRevision,
      connections: vpnConnections.map((connection: MockVPNConnection): Record<string, unknown> => ({
        connectionId: connection['id'],
        status: 'restarting',
      })),
    });

    return true;
  }

  if (path === '/api/v1/storage/directories') {
    const purposeValue: string = url.searchParams.get('purpose') ?? 'download';
    if (purposeValue !== 'download' && purposeValue !== 'incomplete' && purposeValue !== 'profile') {
      sendFieldError(response, 'invalid_request', 'purpose', 'purpose must be download, incomplete, or profile.');

      return true;
    }
    const purpose: MockDirectoryPurpose = purposeValue;
    const profileID: string = url.searchParams.get('profileId') ?? '';
    if (
      purpose === 'profile'
      && profileID !== 'default'
      && profileID !== 'new'
      && !torrentProfiles.some((profile: MockTorrentProfile): boolean => profile['id'] === profileID)
    ) {
      sendFieldError(response, 'invalid_request', 'profileId', 'profileId must be default, new, or an existing torrent profile ID.');

      return true;
    }

    if (method === 'POST') {
      const body: Record<string, unknown> = await readBody(request);
      const created: string = `${String(body['parentPath'] ?? '/data')}/${String(body['name'] ?? 'New folder')}`;

      if (directories.has(created)) {
        sendError(response, 409, 'directory_exists', 'A folder with that name already exists.');

        return true;
      }

      ensureDirectory(created);
      sendJSON(response, 201, listDirectory(created, purpose, profileID));

      return true;
    }

    const directoryPath: string = url.searchParams.get('path') ?? '/data';
    const normalized: boolean = (
      directoryPath === '/data'
      || (
        directoryPath.startsWith('/data/')
        && !directoryPath.endsWith('/')
        && directoryPath.split('/').every((component: string, index: number): boolean => (
          index < 2 || (component !== '' && component !== '.' && component !== '..')
        ))
      )
    );
    if (!normalized || (method === 'DELETE' && directoryPath === '/data')) {
      sendError(response, 422, 'directory_path_invalid', 'Choose a normalized folder inside /data.');

      return true;
    }
    if (directoryPath !== '/data' && !directories.has(directoryPath)) {
      sendError(response, 404, 'directory_not_found', 'That folder no longer exists.');

      return true;
    }

    if (method === 'DELETE') {
      const deletionPolicy: MockDirectoryDeletionPolicy = directoryDeletionPolicy(directoryPath);
      if (deletionPolicy['code'] !== '') {
        const status: number = (
          deletionPolicy['code'] === 'directory_browser_unavailable'
          || deletionPolicy['code'] === 'torrent_locations_unavailable'
        ) ? 503 : 409;
        sendError(response, status, deletionPolicy['code'], deletionPolicy['message']);

        return true;
      }

      directories.delete(directoryPath);
      response.writeHead(204).end();

      return true;
    }

    sendJSON(response, 200, listDirectory(directoryPath, purpose, profileID));

    return true;
  }

  if (path === '/api/v1/torrent-organization') {
    if (method === 'PUT') {
      const body: Record<string, unknown> = await readBody(request);
      if (body['expectedRevision'] !== organizationRevision) {
        sendError(response, 409, 'revision_conflict', 'Torrent organization changed since this revision. Refresh and try again.');

        return true;
      }
      if (!Array.isArray(body['labels']) || !Array.isArray(body['removedLabels']) || !Array.isArray(body['renamedLabels'])) {
        sendError(response, 422, 'invalid_request', 'labels, removedLabels, and renamedLabels are required.');

        return true;
      }
      const removedLabels: string[] = body['removedLabels'].map(String);
      const renamedLabels: {
        from: string
        to: string
      }[] = body['renamedLabels'].flatMap((value: unknown): {
        from: string
        to: string
      }[] => (
        (typeof value === 'object' && value !== null) ? [{
          from: String((value as Record<string, unknown>)['from'] ?? ''),
          to: String((value as Record<string, unknown>)['to'] ?? ''),
        }] : []
      ));
      let changedTorrents: number = 0;
      for (const torrent of torrents) {
        const nextLabels: string[] = applySavedLabelEdits(
          torrent['labels'],
          removedLabels,
          renamedLabels,
        );
        if (nextLabels.join('\n') !== torrent['labels'].join('\n')) {
          torrent.labels = nextLabels;
          changedTorrents += 1;
        }
      }
      for (const profile of torrentProfiles) {
        profile.labels = applySavedLabelEdits(
          profile['labels'],
          removedLabels,
          renamedLabels,
        );
      }
      defaultTorrentProfile.labels = applySavedLabelEdits(
        defaultTorrentProfile['labels'],
        removedLabels,
        renamedLabels,
      );
      savedLabels.splice(0, savedLabels.length, ...body['labels'].map(String).sort(
        (leftLabel: string, rightLabel: string): number => leftLabel.localeCompare(rightLabel, undefined, { sensitivity: 'base' }),
      ));
      organizationRevision += 1;
      sendJSON(response, 200, {
        changedTorrents,
        labels: savedLabels,
        revision: organizationRevision,
      });

      return true;
    }
    sendJSON(response, 200, {
      revision: organizationRevision,
      labels: savedLabels,
    });

    return true;
  }

  if (path === '/api/v1/transmission/free-space' && method === 'GET') {
    sendJSON(response, 200, { 'size-bytes': Math.round(1.2 * 1000 * 1000 * 1000 * 1000) });

    return true;
  }

  if (path === '/api/v1/torrent-profiles') {
    if (method === 'POST') {
      const body: Record<string, unknown> = await readBody(request);
      const profileName: string = String(body['name'] ?? '').trim();
      if (torrentProfileNameTaken(profileName, 'new')) {
        sendFieldError(response, 'torrent_profile_exists', 'name', 'A torrent profile with this name already exists.', 409);

        return true;
      }
      const issue: string = downloadFolderIssue(body['downloadDirectory']);
      if (issue !== '') {
        sendFieldError(response, 'invalid_request', 'downloadDirectory', issue);

        return true;
      }
      const folderOwner = profileFolderOwner(String(body['downloadDirectory'] ?? ''), 'new');
      if (folderOwner !== undefined) {
        sendFieldError(
          response,
          'profile_folder_taken',
          'downloadDirectory',
          profileFolderTakenMessage(String(body['downloadDirectory']), folderOwner['name'], folderOwner['relation']),
          409,
        );

        return true;
      }
      const nextProfileSequence: number = torrentProfileSequence + 1;
      const profileId: string = `tpr-${nextProfileSequence.toString(16).padStart(16, '0')}`;
      const createdAt: string = new Date().toISOString();
      const profile: MockTorrentProfile = readTorrentProfile(
        body,
        profileId,
        createdAt,
      );
      if (isConnectionBeingRemoved(profile['connectionId'])) {
        sendConnectionBeingRemoved(response);

        return true;
      }
      torrentProfileSequence = nextProfileSequence;
      torrentProfiles.push(profile);
      saveUsedLabels(profile['labels']);
      refreshTorrentProfilePresentation();
      ensureDirectory(profile['downloadDirectory']);
      sendJSON(response, 201, profile);

      return true;
    }

    sendJSON(response, 200, {
      defaultProfile: defaultTorrentProfileResponse(),
      folderOverlaps: profileFolderOverlaps(),
      profiles: torrentProfiles,
    });

    return true;
  }

  if (path === '/api/v1/torrent-profiles/default' && method === 'PUT') {
    const body: Record<string, unknown> = await readBody(request);
    const profileName: string = String(body['name'] ?? '').trim();
    if (torrentProfileNameTaken(profileName, 'default')) {
      sendFieldError(response, 'torrent_profile_exists', 'name', 'A torrent profile with this name already exists.', 409);

      return true;
    }
    const issue: string = downloadFolderIssue(body['downloadDirectory']);
    if (issue !== '') {
      sendFieldError(response, 'invalid_request', 'downloadDirectory', issue);

      return true;
    }
    const folderOwner = profileFolderOwner(String(body['downloadDirectory'] ?? ''), 'default');
    if (folderOwner !== undefined) {
      sendFieldError(
        response,
        'profile_folder_taken',
        'downloadDirectory',
        profileFolderTakenMessage(String(body['downloadDirectory']), folderOwner['name'], folderOwner['relation']),
        409,
      );

      return true;
    }

    const updatedProfile: MockDefaultTorrentProfile = readDefaultTorrentProfile(body);
    const folderChanged: boolean = !dataPathsEqualIgnoringCase(
      updatedProfile['downloadDirectory'],
      defaultTorrentProfile['downloadDirectory'],
    );
    if (folderChanged && defaultTorrentProfile['downloadDirectoryLocked']) {
      sendFieldError(
        response,
        'setting_locked',
        'downloadDirectory',
        'The Download directory is locked by managed configuration.',
        409,
      );

      return true;
    }
    if (
      noVPNConnections
      && folderChanged
      && torrents.some((torrent: MockTorrent): boolean => torrent['profileId'] === null)
    ) {
      sendError(response, 503, 'transmission_unavailable', 'The default Transmission daemon is unavailable.');

      return true;
    }

    const targetConnectionID: string = defaultVPNConnection()['id'];
    const profileTorrents: MockTorrent[] = torrents.filter((torrent: MockTorrent): boolean => (
      folderChanged
      && torrent['profileId'] === null
      && (
        torrent['connectionId'] !== targetConnectionID
        || !dataPathsEqualIgnoringCase(torrent['downloadDir'], updatedProfile['downloadDirectory'])
      )
    ));
    if (profileTorrents.length > 0 && body['moveTorrents'] !== true) {
      sendError(response, 409, 'torrents_must_move', `${defaultTorrentProfile['name']}'s torrents must move to its download folder.`, {
        downloadDirectory: updatedProfile['downloadDirectory'],
        torrents: profileTorrents.length,
      });

      return true;
    }

    const moved: Record<string, unknown>[] = profileTorrents.map((torrent: MockTorrent): Record<string, unknown> => {
      const connectionChanged: boolean = torrent['connectionId'] !== targetConnectionID;
      Reflect.set(torrent, 'connectionId', targetConnectionID);
      Reflect.set(torrent, 'downloadDir', updatedProfile['downloadDirectory']);
      if (connectionChanged) {
        Reflect.set(torrent, 'id', Math.max(0, ...torrents.map((candidate: MockTorrent): number => candidate['id'])) + 1);
      }

      return {
        hash: torrent['hashString'],
        id: torrent['id'],
        name: torrent['name'],
        result: 'moved',
        ...((torrentMoveWarnings.length === 0) ? {} : { warnings: torrentMoveWarnings }),
      };
    });
    Object.assign(defaultTorrentProfile, updatedProfile);
    saveUsedLabels(updatedProfile['labels']);
    const downloadSetting: Record<string, unknown> | undefined = settings.find(
      (setting: Record<string, unknown>): boolean => setting['key'] === 'transmission.downloadDirectory',
    );
    if (downloadSetting !== undefined) {
      Reflect.set(downloadSetting, 'value', updatedProfile['downloadDirectory']);
      Reflect.set(downloadSetting, 'source', 'user');
    }
    if (folderChanged) {
      settingsRevision += 1;
    }
    ensureDirectory(updatedProfile['downloadDirectory']);
    sendJSON(response, 200, {
      ...defaultTorrentProfileResponse(),
      moved,
    });

    return true;
  }

  const torrentProfileMatch: RegExpMatchArray | null = path.match(/^\/api\/v1\/torrent-profiles\/([^/]+)$/u);
  if (torrentProfileMatch !== null) {
    const profileId: string = decodeURIComponent(torrentProfileMatch[1] ?? '');
    const profileIndex: number = torrentProfiles.findIndex(
      (profile: MockTorrentProfile): boolean => profile['id'] === profileId,
    );
    const profile: MockTorrentProfile | undefined = torrentProfiles[profileIndex];
    if (profile === undefined) {
      sendError(response, 404, 'torrent_profile_not_found', 'That torrent profile no longer exists.');

      return true;
    }

    if (method === 'DELETE') {
      const body: Record<string, unknown> = await readBody(request);
      if ('moveTorrents' in body && typeof body['moveTorrents'] !== 'boolean') {
        sendFieldError(response, 'invalid_request', 'moveTorrents', 'moveTorrents must be a boolean.');

        return true;
      }
      const profileTorrents: MockTorrent[] = torrents.filter(
        (torrent: MockTorrent): boolean => torrent['profileId'] === profileId,
      );
      if (profileTorrents.length > 0 && noVPNConnections) {
        sendError(response, 503, 'transmission_unavailable', 'The default Transmission daemon is unavailable.');

        return true;
      }
      const targetConnectionId: string = defaultVPNConnection()['id'];
      const targetDirectory: string = defaultTorrentProfile['downloadDirectory'];
      if (profileTorrents.length > 0 && body['moveTorrents'] !== true) {
        sendError(
          response,
          409,
          'torrents_must_move',
          `The profile's torrents must move to ${defaultTorrentProfile['name']} before it can be deleted.`,
          {
            connectionId: targetConnectionId,
            downloadDirectory: targetDirectory,
            torrents: profileTorrents.length,
          },
        );

        return true;
      }

      const moved: Record<string, unknown>[] = profileTorrents.map(
        (torrent: MockTorrent, index: number): Record<string, unknown> => {
          const alreadyThere: boolean = torrent['connectionId'] === targetConnectionId
            && dataPathsEqualIgnoringCase(torrent['downloadDir'], targetDirectory);
          const failed: boolean = process.env['MOCK_VPN_MOVE_FAILURE'] === 'true' && index === 0;
          let moveResult: string = 'moved';
          if (failed === true) {
            moveResult = 'failed';
          } else if (alreadyThere === true) {
            moveResult = 'already-there';
          }
          Reflect.set(torrent, 'profileId', null);
          if (failed === false) {
            if (torrent['connectionId'] !== targetConnectionId) {
              Reflect.set(torrent, 'id', Math.max(0, ...torrents.map((candidate: MockTorrent): number => candidate['id'])) + 1);
            }
            Reflect.set(torrent, 'connectionId', targetConnectionId);
            Reflect.set(torrent, 'downloadDir', targetDirectory);
          }

          return {
            hash: torrent['hashString'],
            ...((failed) ? {} : { id: torrent['id'] }),
            name: torrent['name'],
            result: moveResult,
            ...((failed) ? { error: 'The mock torrent move failed before its source was changed.' } : {}),
            ...((failed || alreadyThere || torrentMoveWarnings.length === 0) ? {} : { warnings: torrentMoveWarnings }),
          };
        },
      );
      torrentProfiles.splice(profileIndex, 1);
      for (const torrent of torrents) {
        if (torrent['needsProfile'] !== null) {
          torrent.needsProfile.profileIds = torrent['needsProfile']['profileIds'].filter(
            (matchingProfileId: string): boolean => matchingProfileId !== profileId,
          );
        }
      }
      refreshTorrentProfilePresentation();
      if (body['moveTorrents'] === true) {
        sendJSON(response, 200, { moved });

        return true;
      }
      response.writeHead(204).end();

      return true;
    }
    if (method === 'PUT') {
      const body: Record<string, unknown> = await readBody(request);
      const profileName: string = String(body['name'] ?? '').trim();
      if (torrentProfileNameTaken(profileName, profile['id'])) {
        sendFieldError(response, 'torrent_profile_exists', 'name', 'A torrent profile with this name already exists.', 409);

        return true;
      }
      const issue: string = downloadFolderIssue(body['downloadDirectory']);
      if (issue !== '') {
        sendFieldError(response, 'invalid_request', 'downloadDirectory', issue);

        return true;
      }
      const folderOwner = profileFolderOwner(String(body['downloadDirectory'] ?? ''), profile['id']);
      if (folderOwner !== undefined) {
        sendFieldError(
          response,
          'profile_folder_taken',
          'downloadDirectory',
          profileFolderTakenMessage(String(body['downloadDirectory']), folderOwner['name'], folderOwner['relation']),
          409,
        );

        return true;
      }
      const updatedProfile: MockTorrentProfile = readTorrentProfile(
        body,
        profile['id'],
        profile['createdAt'],
      );
      const targetConnectionId: string = updatedProfile['connectionId'] ?? defaultVPNConnection()['id'];
      if (isConnectionBeingRemoved(updatedProfile['connectionId'])) {
        sendConnectionBeingRemoved(response);

        return true;
      }
      const connectionChanged: boolean = updatedProfile['connectionId'] !== profile['connectionId'];
      const folderChanged: boolean = !dataPathsEqualIgnoringCase(
        updatedProfile['downloadDirectory'],
        profile['downloadDirectory'],
      );
      const profileTorrents: MockTorrent[] = torrents.filter(
        (torrent: MockTorrent): boolean => torrent['profileId'] === profile['id'] && (
          (connectionChanged && torrent['connectionId'] !== targetConnectionId)
          || (folderChanged && !dataPathsEqualIgnoringCase(torrent['downloadDir'], updatedProfile['downloadDirectory']))
        ),
      );
      if (profileTorrents.length > 0 && body['moveTorrents'] !== true) {
        sendError(response, 409, 'torrents_must_move', 'The profile\'s torrents must move to its selected VPN connection and download folder.', {
          connectionId: targetConnectionId,
          downloadDirectory: updatedProfile['downloadDirectory'],
          torrents: profileTorrents.length,
        });

        return true;
      }
      const moved: Record<string, unknown>[] = profileTorrents.map((torrent: MockTorrent): Record<string, unknown> => {
        const torrentConnectionChanged: boolean = torrent['connectionId'] !== targetConnectionId;
        Reflect.set(torrent, 'connectionId', targetConnectionId);
        Reflect.set(torrent, 'downloadDir', updatedProfile['downloadDirectory']);
        if (torrentConnectionChanged) {
          Reflect.set(torrent, 'id', Math.max(0, ...torrents.map((candidate: MockTorrent): number => candidate['id'])) + 1);
        }

        return {
          hash: torrent['hashString'],
          id: torrent['id'],
          name: torrent['name'],
          result: 'moved',
          ...((torrentMoveWarnings.length === 0) ? {} : { warnings: torrentMoveWarnings }),
        };
      });
      torrentProfiles[profileIndex] = updatedProfile;
      saveUsedLabels(updatedProfile['labels']);
      refreshTorrentProfilePresentation();
      ensureDirectory(updatedProfile['downloadDirectory']);
      sendJSON(response, 200, {
        ...updatedProfile,
        moved,
      });

      return true;
    }
  }

  if (path === '/api/v1/vpn/providers') {
    sendJSON(response, 200, { items: providers });

    return true;
  }

  if (path === '/api/v1/vpn/profiles') {
    const tunnel: string | null = url.searchParams.get('tunnel');

    sendJSON(response, 200, {
      items: profiles.filter((profile: Record<string, unknown>): boolean => (
        profile['providerId'] === url.searchParams.get('provider')
        && (tunnel === null || tunnel === '' || profile['tunnel'] === tunnel)
      )),
    });

    return true;
  }

  if (path === '/api/v1/vpn/profiles/custom' && method === 'POST') {
    const body: Record<string, unknown> = await readBody(request);
    const tunnel: unknown = body['tunnel'] ?? 'openvpn';
    const profileName: unknown = body['profileName'];
    const profileContent: unknown = body['profile'];

    if ((tunnel !== 'openvpn' && tunnel !== 'wireguard') || typeof profileName !== 'string' || typeof profileContent !== 'string' || profileName.trim() === '' || profileContent === '') {
      sendError(response, 422, 'invalid_request', 'Choose a profile file.');

      return true;
    }

    const looksLikeWireGuard: boolean = /^\s*\[interface\]\s*$/im.test(profileContent);

    if (tunnel === 'openvpn' && looksLikeWireGuard) {
      sendError(response, 422, 'invalid_request', 'This is a WireGuard file. Choose the WireGuard tunnel to upload it.');

      return true;
    }

    if (tunnel === 'wireguard' && !looksLikeWireGuard) {
      sendError(response, 422, 'invalid_request', 'This is not a WireGuard file because it has no [Interface] section. For an OpenVPN profile, choose the OpenVPN tunnel.');

      return true;
    }

    let endpointMatches: RegExpMatchArray[] = [];
    if (tunnel === 'wireguard') {
      endpointMatches = [profileContent.match(/^\s*endpoint\s*=\s*([^\s:]+):(\d+)/imu)].filter((match): match is RegExpMatchArray => match !== null);
    } else {
      endpointMatches = [...profileContent.matchAll(/^\s*remote\s+(\S+)(?:\s+(\d+))?(?:\s+(\S+))?\s*$/gimu)];
    }
    if (endpointMatches.length === 0) {
      sendError(response, 422, 'invalid_request', `The ${(tunnel === 'wireguard') ? 'WireGuard' : 'OpenVPN'} profile does not contain a remote endpoint.`);

      return true;
    }
    const displayName: string = profileName.trim().replace(/\.(conf|ovpn)$/i, '');
    const slug: string = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'endpoint';
    const uploadedProfiles: Record<string, unknown>[] = endpointMatches.map((endpointMatch: RegExpMatchArray, index: number): Record<string, unknown> => {
      const remoteProtocol: string | undefined = endpointMatch[3];
      let tcp: boolean = false;
      if (tunnel === 'openvpn') {
        tcp = /^\s*proto\s+tcp/imu.test(profileContent);
        if (remoteProtocol !== undefined) {
          tcp = remoteProtocol.toLowerCase().startsWith('tcp');
        }
      }

      return {
        'id': `custom:${(tunnel === 'wireguard') ? 'wg-' : ''}${slug}${(endpointMatches.length > 1) ? `-${String(index + 1)}` : ''}:${randomBytes(6).toString('hex')}`,
        'providerId': 'custom',
        tunnel,
        'displayName': (endpointMatches.length > 1) ? `${displayName} (${String(index + 1)})` : displayName,
        'countryCode': '',
        'country': '',
        'city': '',
        'continent': '',
        'protocol': (tcp) ? 'tcp' : 'udp',
        'remoteHost': endpointMatch[1] ?? 'vpn.example.com',
        'remotePort': Number(endpointMatch[2] ?? ((tunnel === 'wireguard') ? 51820 : 1194)),
        'fingerprint': `sha256:${randomBytes(16).toString('hex')}`,
        'source': 'upload',
        'updatedAt': new Date().toISOString(),
      };
    });

    profiles.push(...uploadedProfiles);
    sendJSON(response, 201, {
      ...uploadedProfiles[0],
      profiles: uploadedProfiles,
    });

    return true;
  }

  if (method === 'GET' && path === '/api/v1/notifications/events') {
    sendJSON(response, 200, { items: notificationEvents });

    return true;
  }

  if (method === 'GET' && path === '/api/v1/notifications') {
    sendJSON(response, 200, { items: [...notifications].sort((left: MockNotification, right: MockNotification): number => right.createdAt.localeCompare(left.createdAt)) });

    return true;
  }

  // notificationInput checks a create or edit body like the control API, sending the first problem.

  /**
   * Mock API - Notification input.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const notificationInput = (body: Record<string, unknown>, existing: MockNotification | null): MockNotificationInput | null => {
    const service: MockNotificationService = existing?.service ?? body['service'] as MockNotificationService;
    const name: string = (typeof body['name'] === 'string') ? body['name'].trim() : '';
    const events: string[] = (Array.isArray(body['events'])) ? body['events'] as string[] : [];
    const values: Record<string, unknown> = (typeof body['settings'] === 'object' && body['settings'] !== null) ? body['settings'] as Record<string, unknown> : {};

    if (notificationFields[service] === undefined) {
      sendFieldError(response, 'invalid_request', 'service', 'Choose a service.');

      return null;
    }

    if (name === '') {
      sendFieldError(response, 'invalid_request', 'name', 'Name this notification.');

      return null;
    }

    if (events.length === 0) {
      sendFieldError(response, 'invalid_request', 'events', 'Choose at least one event.');

      return null;
    }

    const plainSettings: Record<string, string> = {};
    const secrets: Record<string, true> = { ...(existing?.secrets ?? {}) };

    for (const [
      key,
      missing,
      secret,
      required,
    ] of notificationFields[service]) {
      const value: string = (typeof values[key] === 'string') ? (values[key]).trim() : '';
      const saved: boolean = secret && existing !== null && existing.secrets[key] === true;

      if (value === '' && required && !saved) {
        sendFieldError(response, 'invalid_request', `settings.${key}`, missing);

        return null;
      }

      if (value !== '' && secret) {
        secrets[key] = true;
      } else if (value !== '') {
        plainSettings[key] = value;
      }
    }

    // Optional secrets that are saved, or missing after a lost key, can be cleared once each, never alongside a new value.
    const clearable: string[] = notificationFields[service]
      .filter((field: MockNotificationField): boolean => field[2] && !field[3] && existing !== null && (existing.secrets[field[0]] === true || existing.secretsMissing.includes(field[0])))
      .map((field: MockNotificationField): string => field[0]);
    const clearSecrets: unknown[] = (Array.isArray(body['clearSecrets'])) ? body['clearSecrets'] : [];
    const invalidIndex: number = clearSecrets.findIndex((key: unknown): boolean => typeof key !== 'string' || !clearable.includes(key));

    if (body['clearSecrets'] !== undefined && !Array.isArray(body['clearSecrets'])) {
      sendFieldError(response, 'invalid_request', 'clearSecrets', 'Choose an optional saved secret.');

      return null;
    }

    if (invalidIndex !== -1) {
      sendFieldError(response, 'invalid_request', `clearSecrets.${invalidIndex}`, 'Choose an optional saved secret.');

      return null;
    }

    if (new Set(clearSecrets).size !== clearSecrets.length) {
      sendFieldError(response, 'invalid_request', 'clearSecrets', 'Choose each secret only once.');

      return null;
    }

    const replaced: string | undefined = (clearSecrets as string[]).find((key: string): boolean => typeof values[key] === 'string' && (values[key]).trim() !== '');

    if (replaced !== undefined) {
      sendFieldError(response, 'invalid_request', `settings.${replaced}`, 'Enter a new value or clear this field, not both.');

      return null;
    }

    for (const key of clearSecrets as string[]) {
      Reflect.deleteProperty(secrets, key);
    }

    if (notifications.some((notification: MockNotification): boolean => notification.id !== existing?.id && notification.name.toLowerCase() === name.toLowerCase())) {
      sendFieldError(response, 'notification_exists', 'name', 'A notification with this name already exists.', 409);

      return null;
    }

    return {
      clearSecrets: clearSecrets as string[],
      events,
      name,
      secrets,
      service,
      settings: plainSettings,
    };
  };

  if (method === 'POST' && path === '/api/v1/notifications') {
    const input: MockNotificationInput | null = notificationInput(await readBody(request), null);

    if (input === null) {
      return true;
    }

    const notification: MockNotification = {
      events: input.events,
      name: input.name,
      secrets: input.secrets,
      service: input.service,
      settings: input.settings,
      createdAt: new Date().toISOString(),
      id: `ntf-${randomBytes(8).toString('hex')}`,
      lastAttemptAt: null,
      lastError: null,
      lastErrorDetails: null,
      secretsMissing: [],
      updatedAt: new Date().toISOString(),
    };

    notifications.push(notification);
    sendJSON(response, 201, notification);

    return true;
  }

  const notificationMatch: RegExpMatchArray | null = path.match(/^\/api\/v1\/notifications\/(ntf-[0-9a-f]{16})(\/test)?$/u);

  if (notificationMatch !== null) {
    const index: number = notifications.findIndex((notification: MockNotification): boolean => notification.id === notificationMatch[1]);
    const notification: MockNotification | undefined = notifications[index];

    if (notification === undefined) {
      sendError(response, 404, 'notification_not_found', 'That notification no longer exists.');

      return true;
    }

    if (method === 'POST' && notificationMatch[2] === '/test') {
      if (notification.secretsMissing.length > 0) {
        sendJSON(response, 200, {
          delivered: false,
          message: 'Enter the removed secrets again first.',
        });

        return true;
      }

      if (notificationTransportError) {
        notification.lastAttemptAt = new Date().toISOString();
        notification.lastError = mockNotificationTransportFailure(rawNotificationTransportError);
        notification.lastErrorDetails = rawNotificationTransportError;
        sendJSON(response, 200, {
          delivered: false,
          details: rawNotificationTransportError,
          message: notification.lastError,
        });

        return true;
      }

      notification.lastAttemptAt = new Date().toISOString();
      notification.lastError = null;
      notification.lastErrorDetails = null;
      sendJSON(response, 200, { delivered: true });

      return true;
    }

    if (method === 'DELETE') {
      notifications.splice(index, 1);
      removedSecrets = removedSecrets.filter((removedSecret): boolean => removedSecret.notificationId !== notification.id);
      response.writeHead(204).end();

      return true;
    }

    if (method === 'PUT') {
      const input: MockNotificationInput | null = notificationInput(await readBody(request), notification);

      if (input === null) {
        return true;
      }

      notification.events = input.events;
      notification.name = input.name;
      notification.secrets = input.secrets;
      // A missing secret is settled by entering it again or, when optional, by clearing it.
      notification.secretsMissing = notification.secretsMissing.filter((key: string): boolean => input.secrets[key] !== true && !input.clearSecrets.includes(key));
      notification.settings = input.settings;
      notification.updatedAt = new Date().toISOString();

      if (notification.secretsMissing.length === 0) {
        removedSecrets = removedSecrets.filter((removedSecret): boolean => removedSecret.notificationId !== notification.id);
      }

      sendJSON(response, 200, notification);

      return true;
    }
  }

  if (path === '/api/v1/auth/tokens') {
    if (method === 'POST') {
      const fields: Record<string, unknown> | undefined = await readTokenFields(request, response, '');

      if (fields === undefined) {
        return true;
      }

      tokenSequence += 1;

      const token: Record<string, unknown> = {
        id: `tok-${tokenSequence}`,
        name: fields['name'],
        scopes: fields['scopes'],
        expiresAt: fields['expiresAt'] ?? null,
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
      };
      const plaintext: string = `tvpn_${randomBytes(32).toString('base64url')}`;

      tokens.unshift(token);
      tokenValues.set(plaintext, String(token['id']));
      tokenDigests.set(String(token['id']), createHash('sha256').update(plaintext).digest('base64'));
      sendJSON(response, 201, {
        token,
        plaintext,
      });

      return true;
    }

    sendJSON(response, 200, { items: tokens });

    return true;
  }

  if (path.startsWith('/api/v1/auth/tokens/') && (method === 'PUT' || method === 'DELETE')) {
    const tokenId: string = decodeURIComponent(path.slice('/api/v1/auth/tokens/'.length));
    const token: Record<string, unknown> | undefined = tokens.find((candidate: Record<string, unknown>): boolean => candidate['id'] === tokenId);

    if (token === undefined) {
      sendError(response, 404, 'token_not_found', 'That token no longer exists.');

      return true;
    }

    if (method === 'DELETE') {
      tokens.splice(tokens.indexOf(token), 1);
      tokenDigests.delete(String(token['id']));
      response.writeHead(204).end();

      return true;
    }

    const fields: Record<string, unknown> | undefined = await readTokenFields(request, response, tokenId);

    if (fields === undefined) {
      return true;
    }

    Reflect.set(token, 'name', fields['name']);
    Reflect.set(token, 'scopes', fields['scopes']);

    if (fields['expiresAt'] !== undefined) {
      Reflect.set(token, 'expiresAt', fields['expiresAt']);
    }

    sendJSON(response, 200, token);

    return true;
  }

  if (path === '/api/v1/torrents' && method === 'GET') {
    const selection: string | null = url.searchParams.get('ids');
    const identifiers: number[] | null = (selection === null || selection === '' || selection === 'recently-active') ? null : selection.split(',').map((identifier: string): number => Number(identifier.trim()));
    const items: MockTorrent[] = (identifiers === null) ? torrents : torrents.filter((torrent: MockTorrent): boolean => identifiers.includes(torrent['id']));
    sendJSON(response, 200, {
      errors: torrentErrors(),
      items: items.map(torrentSummary),
    });

    return true;
  }

  if (path === '/api/v1/torrents/preview' && method === 'POST') {
    const body: Record<string, unknown> = await readBody(request);
    if (!Array.isArray(body['links']) || body['links'].length > 20) {
      sendError(
        response,
        422,
        'torrent_preview_links_invalid',
        'Preview at most 20 torrent links at a time.',
      );

      return true;
    }

    const items: MockTorrentLinkPreview[] = [];
    body['links'].forEach((link: unknown, index: number): void => {
      if (typeof link !== 'string') {
        return;
      }
      const preview: MockTorrentLinkPreview | null = previewTorrentLink(link.trim(), index);
      if (preview !== null) {
        items.push(preview);
      }
    });
    sendJSON(response, 200, { items });

    return true;
  }

  if (path === '/api/v1/torrents' && method === 'POST') {
    const body: Record<string, unknown> = await readBody(request);
    if (
      body['profileId'] !== undefined
      && body['profileId'] !== null
      && (
        typeof body['profileId'] !== 'string'
        || !/^tpr-[0-9a-f]{16}$/u.test(body['profileId'])
      )
    ) {
      sendFieldError(
        response,
        'invalid_request',
        'profileId',
        'profileId must name an existing torrent profile.',
      );

      return true;
    }
    const profile: MockTorrentProfile | undefined = torrentProfiles.find(
      (candidate: MockTorrentProfile): boolean => candidate['id'] === body['profileId'],
    );
    if (typeof body['profileId'] === 'string' && profile === undefined) {
      sendError(response, 404, 'torrent_profile_not_found', 'That torrent profile no longer exists.');

      return true;
    }
    const profileData: MockDefaultTorrentProfile | MockTorrentProfile = profile ?? defaultTorrentProfile;
    const overlap = profileFolderOverlaps().find((candidate): boolean => candidate['profileId'] === ((profile === undefined) ? 'default' : profile['id']));
    if (overlap !== undefined) {
      const profileLabel: string = (profile === undefined) ? defaultTorrentProfile['name'] : `${profileData['name']} profile`;
      sendError(response, 409, 'profile_folder_overlap', `Change the ${profileLabel}'s folder before adding torrents to it. ${overlap['message']}`);

      return true;
    }
    const downloadDirectory: string = profileData['downloadDirectory'];
    if (
      typeof body['downloadDirectory'] === 'string'
      && !dataPathsEqualIgnoringCase(body['downloadDirectory'], downloadDirectory)
    ) {
      sendFieldError(response, 'invalid_request', 'downloadDirectory', 'The download folder comes from the profile.');

      return true;
    }
    const downloadIssue: string = downloadFolderIssue(downloadDirectory);
    if (downloadIssue !== '') {
      sendFieldError(response, 'download_directory_invalid', 'downloadDirectory', downloadIssue);

      return true;
    }
    torrentAddAttempt += 1;
    if (noVPNConnections) {
      sendError(response, 503, 'vpn_connection_required', 'Add a VPN connection before adding torrents.');

      return true;
    }
    if (torrentAddOutcome === 'failed' || (torrentAddOutcome === 'mixed' && torrentAddAttempt % 2 === 0)) {
      sendError(response, 422, 'torrent_add_failed', 'The mock rejected this torrent source.');

      return true;
    }
    const nextId: number = Math.max(0, ...torrents.map((torrent: MockTorrent): number => torrent['id'])) + 1;
    const sourceValue: string = String(body['filename'] ?? body['metainfo'] ?? nextId);
    const hash: string = createHash('sha1').update(sourceValue).digest('hex');
    const targetConnectionId: string = (
      'connectionId' in profileData && profileData['connectionId'] !== null
    ) ? profileData['connectionId'] : defaultVPNConnection()['id'];
    if (isConnectionBeingRemoved(targetConnectionId)) {
      sendConnectionBeingRemoved(response);

      return true;
    }
    const duplicateTorrent: MockTorrent | undefined = torrents.find(
      (torrent: MockTorrent): boolean => torrent['hashString'] === hash,
    );
    if (duplicateTorrent !== undefined) {
      const duplicateProfile: MockTorrentProfile | undefined = torrentProfiles.find(
        (candidate: MockTorrentProfile): boolean => candidate['id'] === duplicateTorrent['profileId'],
      );
      const duplicateConnection: MockVPNConnection | undefined = vpnConnections.find(
        (connection: MockVPNConnection): boolean => connection['id'] === duplicateTorrent['connectionId'],
      );
      sendJSON(response, 201, {
        connectionName: duplicateConnection?.['name'] ?? duplicateTorrent['connectionId'],
        duplicate: true,
        hash: duplicateTorrent['hashString'],
        id: duplicateTorrent['id'],
        name: duplicateTorrent['name'],
        profileName: duplicateProfile?.['name'] ?? defaultTorrentProfile['name'],
      });

      return true;
    }
    const now: number = Math.floor(Date.now() / 1000);
    const paused: boolean = (body['paused'] === undefined) ? profileData['startPaused'] : body['paused'] === true;
    const totalSize: number = Math.round(1.4 * gibibyte);
    if (profileData['options']['queue'] === 'top') {
      for (const torrent of torrents) {
        torrent.queuePosition += 1;
      }
    }
    const torrent: MockTorrent = {
      'activityDate': now,
      'addedDate': now,
      'bandwidthPriority': 0,
      'comment': '',
      'connectionId': targetConnectionId,
      'doneDate': 0,
      'downloadDir': downloadDirectory,
      'downloadLimit': 0,
      'downloadLimited': false,
      'downloadedEver': 0,
      'error': 0,
      'errorString': '',
      'eta': -1,
      'hashString': hash,
      'honorsSessionLimits': true,
      'id': nextId,
      'isFinished': false,
      'isPrivate': false,
      'isStalled': false,
      'labels': mergeTorrentLabels(
        (Array.isArray(body['labels'])) ? body['labels'].map(String) : [],
        profileData['labels'],
      ),
      'leftUntilDone': totalSize,
      'metadataPercentComplete': 1,
      'name': addedTorrentName(body['filename'], nextId),
      'needsProfile': null,
      'peer-limit': 50,
      'peersConnected': 0,
      'peersGettingFromUs': 0,
      'peersSendingToUs': 0,
      'percentDone': 0,
      'profileId': profile?.['id'] ?? null,
      'queuePosition': (profileData['options']['queue'] === 'top') ? 0 : torrents.length,
      'rateDownload': 0,
      'rateUpload': 0,
      'recheckProgress': 0,
      'secondsDownloading': 0,
      'secondsSeeding': 0,
      'seedIdleLimit': 30,
      'seedIdleMode': 0,
      'seedRatioLimit': 2,
      'seedRatioMode': 0,
      'sizeWhenDone': totalSize,
      'status': (paused) ? 0 : 4,
      totalSize,
      'uploadedEver': 0,
      'uploadLimit': 0,
      'uploadLimited': false,
      'uploadRatio': -1,
    };
    applyTorrentProfileOptions(torrent, profileData);
    torrent.labels = mergeTorrentLabels(
      (Array.isArray(body['labels'])) ? body['labels'].map(String) : [],
      profileData['labels'],
    );
    saveUsedLabels(torrent['labels']);
    torrents.push(torrent);
    sendJSON(response, 201, {
      connectionName: vpnConnections.find(
        (connection: MockVPNConnection): boolean => connection['id'] === torrent['connectionId'],
      )?.['name'] ?? torrent['connectionId'],
      duplicate: false,
      hash,
      id: torrent['id'],
      name: torrent['name'],
      profileName: profileData['name'],
    });

    return true;
  }

  if (path === '/api/v1/torrents' && method === 'PATCH') {
    const body: Record<string, unknown> = await readBody(request);
    const selection: MockTorrentSelection | undefined = readTorrentSelection(body, response);
    if (selection === undefined) {
      return true;
    }
    const changes: Record<string, unknown> = (typeof body['changes'] === 'object' && body['changes'] !== null) ? body['changes'] as Record<string, unknown> : {};
    for (const torrent of selection['items']) {
      if (changes['bandwidthPriority'] !== undefined) {
        torrent.bandwidthPriority = Number(changes['bandwidthPriority']) as -1 | 0 | 1;
      }
      if (changes['downloadLimit'] !== undefined) {
        torrent.downloadLimit = Number(changes['downloadLimit']);
      }
      if (changes['downloadLimited'] !== undefined) {
        torrent.downloadLimited = changes['downloadLimited'] === true;
      }
      if (changes['honorsSessionLimits'] !== undefined) {
        torrent.honorsSessionLimits = changes['honorsSessionLimits'] === true;
      }
      if (Array.isArray(changes['labels'])) {
        torrent.labels = changes['labels'].map(String);
      }
      if (changes['peerLimit'] !== undefined) {
        torrent['peer-limit'] = Number(changes['peerLimit']);
      }
      if (changes['seedIdleLimit'] !== undefined) {
        torrent.seedIdleLimit = Number(changes['seedIdleLimit']);
      }
      if (changes['seedIdleMode'] !== undefined) {
        torrent.seedIdleMode = Number(changes['seedIdleMode']) as 0 | 1 | 2;
      }
      if (changes['seedRatioLimit'] !== undefined) {
        torrent.seedRatioLimit = Number(changes['seedRatioLimit']);
      }
      if (changes['seedRatioMode'] !== undefined) {
        torrent.seedRatioMode = Number(changes['seedRatioMode']) as 0 | 1 | 2;
      }
      if (changes['uploadLimit'] !== undefined) {
        torrent.uploadLimit = Number(changes['uploadLimit']);
      }
      if (changes['uploadLimited'] !== undefined) {
        torrent.uploadLimited = changes['uploadLimited'] === true;
      }
    }
    if (Array.isArray(changes['labels'])) {
      saveUsedLabels(changes['labels'].map(String));
    }
    sendJSON(response, 200, torrentMutationResponse(selection));

    return true;
  }

  if (path === '/api/v1/torrents/profile' && method === 'PUT') {
    const body: Record<string, unknown> = await readBody(request);
    const selection: MockTorrentSelection | undefined = readTorrentSelection(body, response);
    if (selection === undefined) {
      return true;
    }
    if (
      !('profileId' in body)
      || (
        body['profileId'] !== null
        && (
          typeof body['profileId'] !== 'string'
          || !/^tpr-[0-9a-f]{16}$/u.test(body['profileId'])
        )
      )
    ) {
      sendFieldError(
        response,
        'invalid_request',
        'profileId',
        'profileId must be a torrent profile identifier or null.',
      );

      return true;
    }
    const profile: MockTorrentProfile | undefined = torrentProfiles.find(
      (candidate: MockTorrentProfile): boolean => candidate['id'] === body['profileId'],
    );
    if (typeof body['profileId'] === 'string' && profile === undefined) {
      sendError(response, 404, 'torrent_profile_not_found', 'That torrent profile no longer exists.');

      return true;
    }
    const profileData: MockDefaultTorrentProfile | MockTorrentProfile = profile ?? defaultTorrentProfile;
    const moved: Record<string, unknown>[] = [];
    if (noVPNConnections) {
      sendError(response, 503, 'transmission_unavailable', 'Transmission is unavailable for the selected connection.');

      return true;
    }
    const targetConnectionId: string = (
      'connectionId' in profileData && profileData['connectionId'] !== null
    ) ? profileData['connectionId'] : defaultVPNConnection()['id'];
    const targetDirectory: string = profileData['downloadDirectory'];
    if (isConnectionBeingRemoved(targetConnectionId)) {
      sendConnectionBeingRemoved(response);

      return true;
    }
    const resolvingSelection: boolean = selection['items'].some(
      (torrent: MockTorrent): boolean => torrent['needsProfile'] !== null,
    );
    for (const torrent of selection['items']) {
      const resolvingProfile: boolean = torrent['needsProfile'] !== null;
      const existingLabels: string[] = [...torrent['labels']];
      const alreadyThere: boolean = torrent['connectionId'] === targetConnectionId
        && dataPathsEqualIgnoringCase(torrent['downloadDir'], targetDirectory);
      const connectionChanged: boolean = torrent['connectionId'] !== targetConnectionId;
      torrent.profileId = profile?.['id'] ?? null;
      torrent.needsProfile = null;
      torrent.connectionId = targetConnectionId;
      torrent.downloadDir = targetDirectory;
      if (connectionChanged) {
        torrent.id = Math.max(0, ...torrents.map((candidate: MockTorrent): number => candidate['id'])) + 1;
      }
      moved.push({
        hash: torrent['hashString'],
        id: torrent['id'],
        name: torrent['name'],
        result: (alreadyThere) ? 'already-there' : 'moved',
        ...((alreadyThere || torrentMoveWarnings.length === 0) ? {} : { warnings: torrentMoveWarnings }),
      });
      if (body['applyOptions'] === true || resolvingProfile) {
        applyTorrentProfileOptions(torrent, profileData);
        if (resolvingProfile) {
          torrent.labels = mergeTorrentLabels(existingLabels, profileData['labels']);
        }
      }
      if (resolvingProfile) {
        if (profileData['startPaused']) {
          torrent.status = 0;
        } else if (torrent['percentDone'] >= 1) {
          torrent.status = 6;
        } else {
          torrent.status = 4;
        }
      }
    }
    if (
      (body['applyOptions'] === true || resolvingSelection)
      && profileData['options']['queue'] === 'top'
    ) {
      moveTorrentsToQueueTop(selection['items']);
    }
    if (body['applyOptions'] === true || resolvingSelection) {
      saveUsedLabels(selection['items'].flatMap((torrent: MockTorrent): string[] => torrent['labels']));
    }
    sendJSON(response, 200, {
      ...torrentMutationResponse(selection),
      applyOptions: body['applyOptions'] === true || resolvingSelection,
      moved,
      profileId: profile?.['id'] ?? null,
    });

    return true;
  }

  if (path === '/api/v1/torrents/actions' && method === 'POST') {
    const body: Record<string, unknown> = await readBody(request);
    const selection: MockTorrentSelection | undefined = readTorrentSelection(body, response);
    if (selection === undefined) {
      return true;
    }

    applyAction(String(body['action']), selection['ids']);
    sendJSON(response, 200, {
      ...torrentMutationResponse(selection),
      action: String(body['action']),
    });

    return true;
  }

  if (path === '/api/v1/torrents/remove' && method === 'POST') {
    const body: Record<string, unknown> = await readBody(request);
    const selection: MockTorrentSelection | undefined = readTorrentSelection(body, response);
    if (selection === undefined) {
      return true;
    }

    for (const selectedTorrent of selection['items']) {
      const index: number = torrents.indexOf(selectedTorrent);

      if (index >= 0) {
        torrents.splice(index, 1);
      }
    }

    response.writeHead(204).end();

    return true;
  }

  if (path === '/api/v1/torrents/rename' && method === 'POST') {
    const body: Record<string, unknown> = await readBody(request);
    const selection: MockTorrentSelection | undefined = readTorrentSelection(body, response);
    if (selection === undefined) {
      return true;
    }
    if (selection['items'].length !== 1) {
      sendError(response, 404, 'torrent_not_found', 'One or more torrents were not found.');

      return true;
    }
    const torrent: MockTorrent = selection['items'][0] as MockTorrent;
    if (String(body['path'] ?? '') === torrent['name']) {
      torrent.name = String(body['name'] ?? torrent['name']);
    }
    sendJSON(response, 200, {
      ...torrentMutationResponse(selection),
      path: torrent['name'],
    });

    return true;
  }

  const detailMatch: RegExpMatchArray | null = path.match(/^\/api\/v1\/torrents\/(\d+)$/);

  if (detailMatch !== null) {
    const torrent: MockTorrent | undefined = torrents.find((candidate: MockTorrent): boolean => candidate['id'] === Number(detailMatch[1]));

    if (torrent === undefined) {
      sendError(response, 404, 'torrent_not_found', 'That torrent no longer exists.');

      return true;
    }

    sendJSON(response, 200, {
      ...torrent,
      ...mockPieces(torrent),
      creator: 'mktorrent 1.1',
      dateCreated: torrent['addedDate'] - 86400,
      files: [
        0,
        1,
        2,
      ].map((fileIndex: number): Record<string, unknown> => ({
        bytesCompleted: Math.round(torrent['downloadedEver'] * ([
          0.8,
          0.15,
          0.05,
        ][fileIndex] ?? 0)),
        length: Math.round(torrent['sizeWhenDone'] * ([
          0.8,
          0.15,
          0.05,
        ][fileIndex] ?? 0)),
        name: `${torrent['name']}/${([
          'main',
          'extras',
          'README',
        ][fileIndex] ?? 'file')}${([
          '.bin',
          '.zip',
          '.txt',
        ][fileIndex] ?? '')}`,
      })),
      fileStats: [
        0,
        1,
        2,
      ].map((fileIndex: number): Record<string, unknown> => ({
        bytesCompleted: Math.round(torrent['downloadedEver'] * ([
          0.8,
          0.15,
          0.05,
        ][fileIndex] ?? 0)),
        priority: (fileIndex === 0) ? 1 : 0,
        wanted: fileIndex !== 1,
      })),
      magnetLink: `magnet:?xt=urn:btih:${torrent['hashString']}&dn=${encodeURIComponent(torrent['name'])}`,
      manualAnnounceTime: Math.floor(Date.now() / 1000) - 60,
      maxConnectedPeers: torrent['peer-limit'],
      peers: Array.from({ length: Math.min(torrent['peersConnected'], 6) }, (_unused: unknown, peerIndex: number): Record<string, unknown> => ({
        address: `203.0.113.${20 + (peerIndex * 7)}`,
        clientName: [
          'qBittorrent 5.0.1',
          'Transmission 4.1.4',
          'Deluge 2.1.1',
          'libtorrent 2.0.10',
        ][peerIndex % 4],
        flagStr: [
          'DE',
          'UEI',
          'dE',
          'TUH',
        ][peerIndex % 4],
        isEncrypted: peerIndex % 2 === 0,
        isIncoming: peerIndex % 3 === 0,
        port: 51413 + peerIndex,
        progress: Math.min(1, 0.3 + (peerIndex * 0.15)),
        rateToClient: Math.round(torrent['rateDownload'] / Math.max(1, torrent['peersSendingToUs'])),
        rateToPeer: Math.round(torrent['rateUpload'] / Math.max(1, torrent['peersGettingFromUs'])),
      })),
      peersFrom: {
        fromCache: 0,
        fromDht: Math.max(0, torrent['peersConnected'] - 2),
        fromIncoming: Math.min(1, torrent['peersConnected']),
        fromLpd: 0,
        fromLtep: 0,
        fromPex: Math.min(1, torrent['peersConnected']),
        fromTracker: Math.min(2, torrent['peersConnected']),
      },
      priorities: [
        1,
        0,
        0,
      ],
      startDate: torrent['addedDate'],
      trackerList: 'udp://tracker.opentrackr.org:1337/announce\n\nhttps://tracker.example.org/announce',
      trackerStats: [
        {
          announce: 'udp://tracker.opentrackr.org:1337/announce',
          downloadCount: 1840,
          host: 'tracker.opentrackr.org',
          id: 0,
          lastAnnounceResult: (torrent['error'] === 0) ? 'Success' : torrent['errorString'],
          lastAnnounceSucceeded: torrent['error'] === 0,
          leecherCount: 37,
          nextAnnounceTime: Math.floor(Date.now() / 1000) + 1500,
          seederCount: 412,
          sitename: 'opentrackr',
          tier: 0,
        },
        {
          announce: 'https://tracker.example.org/announce',
          downloadCount: 96,
          host: 'tracker.example.org',
          id: 1,
          lastAnnounceResult: 'Success',
          lastAnnounceSucceeded: true,
          leecherCount: 4,
          nextAnnounceTime: Math.floor(Date.now() / 1000) + 2700,
          seederCount: 58,
          sitename: 'example',
          tier: 1,
        },
      ],
      trackers: [
        {
          announce: 'udp://tracker.opentrackr.org:1337/announce',
          id: 0,
          scrape: 'udp://tracker.opentrackr.org:1337/scrape',
          tier: 0,
        },
        {
          announce: 'https://tracker.example.org/announce',
          id: 1,
          scrape: 'https://tracker.example.org/scrape',
          tier: 1,
        },
      ],
      wanted: [
        true,
        false,
        true,
      ],
      webseeds: [],
    });

    return true;
  }

  sendJSON(response, 200, {});

  return true;
};

/**
 * Mock API - Mock API.
 *
 * Serves an in-memory stand-in for the Go control API so the interface can be
 * reviewed with `vite --mode mock`, without a VPN or a running appliance. Sign in as
 * `admin` with the password `transmission`; the authenticator code is always 123456.
 *
 * @returns {Plugin}
 *
 * @since 2.0.0
 */
export const mockApi = (): Plugin => ({
  name: 'transmission-vpn-mock-api',
  configureServer: (server): void => {
    server.middlewares.use((request: IncomingMessage, response: ServerResponse, next: () => void): void => {
      void handleRequest(request, response).then((handled: boolean): void => {
        if (!handled) {
          next();
        }
      });
    });
  },
});
