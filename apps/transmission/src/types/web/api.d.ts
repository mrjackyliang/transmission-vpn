import type {
  ZodSafeParseResult,
  ZodType,
} from 'zod';

import type {
  Web_Backup_Grant,
  Web_Backup_ImportJob,
  Web_Backup_ImportPreview,
  Web_Backup_SourceDirectory,
} from '@/types/web/backup.d.ts';
import type {
  Web_Notifications_Event,
  Web_Notifications_Target,
  Web_Notifications_TestResult,
} from '@/types/web/notifications.d.ts';

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_JsonPrimitive = boolean | number | string | null;
export type Web_Api_JsonValue =
  | Web_Api_JsonPrimitive
  | Web_Api_JsonValue[]
  | {
    [key: string]: Web_Api_JsonValue;
  };

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_Request_Options = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_SetupStatus = {
  claimRequired: boolean;
  claimExpiresAt?: string | undefined;
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_RemovedSecret = {
  kind: 'authenticator' | 'notification' | 'vpn';
  name?: string | undefined;
  notificationId?: string | undefined;
  removedAt: string;
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_Administrator = {
  authenticationType: 'session' | 'token';
  id: string;
  administratorId?: number | undefined;
  username?: string | undefined;
  name?: string | undefined;
  scopes?: string[] | undefined;
  removedSecrets?: Web_Api_RemovedSecret[] | undefined;
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_AuthenticationResponse = {
  status: 'authenticated';
  administrator: {
    id: number;
    username: string;
  };
  csrfToken: string;
  expiresAt: string;
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_SecondFactorChallenge = {
  status: 'second_factor_required';
  challenge: string;
  expiresAt: string;
};
export type Web_Api_LoginResult = Web_Api_AuthenticationResponse | Web_Api_SecondFactorChallenge;

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_Passkey = {
  id: string;
  name: string;
  hostname: string;
  createdAt: string;
  lastUsedAt: string | null;
};
export type Web_Api_AccountSecurity = {
  hostname: string;
  passkeys: Web_Api_Passkey[];
  passkeysAvailable: boolean;
  recoveryCodesRemaining: number;
  role?: string;
  totpEnabled: boolean;
  username: string;
};
export type Web_Api_TotpSetup = {
  secret: string;
  uri: string;
  qrCode: string;
};
export type Web_Api_RecoveryCodes = {
  recoveryCodes: string[];
};
export type Web_Api_PasskeyCeremony = {
  ceremonyId: string;
  options: Record<string, unknown>;
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_ServiceState = {
  ready: boolean;
  phase?: string | undefined;
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_Status = {
  version: string;
  schemaVersion: number;
  configurationRevision: number;
  claimed: boolean;
  protectionState: Web_Api_VpnProtection['state'];
  protection: Web_Api_VpnProtection;
  connections: Web_Api_LiveVpnConnection[];
  runtime: {
    configurationReady: boolean;
    firewall: {
      ready: boolean;
      state: string;
      interfaces: {
        interface: string;
        address: string;
      }[];
      backend?: string | undefined;
      userId?: number | undefined;
    };
    services: Record<string, Web_Api_ServiceState>;
  };
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_VpnStatus = {
  connectionId: string;
  slot: number;
  default: boolean;
  state: Web_Api_VpnRuntimeState;
  providerId?: string | undefined;
  tunnel?: Web_Api_VpnTunnel | undefined;
  profileId?: string | undefined;
  endpointPosition?: number | undefined;
  endpointCount?: number | undefined;
  endpointStrategy?: 'sticky' | 'ordered' | 'randomized' | undefined;
  interface?: string | undefined;
  implementation?: 'kernel' | 'userspace' | undefined;
  remoteHost?: string | undefined;
  remotePort?: number | undefined;
  address: string;
  dnsServers: string[];
  lastHandshakeAt?: string | undefined;
  attempt: number;
  lastError?: string | undefined;
  transitionedAt: string;
  changeRunning: boolean;
};
export type Web_Api_VpnConnectionRuntime = {
  state: Web_Api_VpnRuntimeState;
  providerId: string;
  tunnel: Web_Api_VpnTunnel;
  profileId: string;
  endpointPosition: number;
  endpointCount: number;
  endpointStrategy: 'sticky' | 'ordered' | 'randomized';
  interface: string;
  implementation?: 'kernel' | 'userspace' | undefined;
  remoteHost: string;
  remotePort: number;
  address: string;
  lastHandshakeAt?: string | undefined;
  attempt: number;
  lastError: string;
  transitionedAt: string;
};
export type Web_Api_VpnDaemon = {
  state: 'starting' | 'ready' | 'exited' | 'missing';
  rpcPort: number;
  bindAddress: string;
  peerPort: number;
};
export type Web_Api_VpnConnection = {
  id: string;
  name: string;
  slot: number;
  default: boolean;
  enabled: boolean;
  providerId: string;
  tunnel: Web_Api_VpnTunnel;
  profileIds: string[];
  endpointStrategy: 'sticky' | 'ordered' | 'randomized';
  dnsServers: string[];
  retryIntervalSeconds: number;
  savedCredentials: string[];
  peerPort: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
  runtime: Web_Api_VpnConnectionRuntime;
  daemon: Web_Api_VpnDaemon;
  torrentCount: number;
  changeRunning: boolean;
  needsSetup: boolean;
};
export type Web_Api_VpnCapacity = {
  limit: number;
  used: number;
  memoryBytes: number;
  cpus: number;
  source: 'cgroup-v2' | 'cgroup-v1' | 'meminfo' | 'fallback';
};
export type Web_Api_VpnConnectionsResponse = {
  connections: Web_Api_VpnConnection[];
  capacity: Web_Api_VpnCapacity;
  changeRunning: boolean;
};
export type Web_Api_VpnConnectionResponse = {
  connection: Web_Api_VpnConnection;
};
export type Web_Api_VpnDefaultResponse = {
  connections: Web_Api_VpnConnection[];
  moved: Web_Api_MovedTorrent[];
};
export type Web_Api_VpnProtection = {
  state: 'protected' | 'partial' | 'blocked' | 'setup-required' | 'error';
  protectedCount: number;
  enabledCount: number;
};
export type Web_Api_LiveVpnConnection = {
  connectionId: string;
  name: string;
  default: boolean;
  enabled: boolean;
  state: Web_Api_VpnRuntimeState;
  providerId?: string | undefined;
  tunnel?: Web_Api_VpnTunnel | undefined;
  profileId?: string | undefined;
  endpointPosition?: number | undefined;
  endpointCount?: number | undefined;
  endpointStrategy?: 'sticky' | 'ordered' | 'randomized' | undefined;
  interface?: string | undefined;
  implementation?: 'kernel' | 'userspace' | undefined;
  remoteHost?: string | undefined;
  remotePort?: number | undefined;
  address: string;
  lastHandshakeAt?: string | undefined;
  attempt: number;
  lastError?: string | undefined;
  transitionedAt: string;
  daemon: Web_Api_VpnDaemon;
};
export type Web_Api_VpnRuntime = Web_Api_VpnConnectionRuntime | Web_Api_LiveVpnConnection;
export type Web_Api_VpnRuntimeState = 'blocked' | 'connecting' | 'protected' | 'reconnecting';

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_Torrent = {
  activityDate: number;
  addedDate: number;
  connectionId: string;
  downloadDir: string;
  downloadedEver: number;
  error: number;
  errorString: string;
  eta: number;
  hashString: string;
  id: number;
  isFinished: boolean;
  isPrivate: boolean;
  isStalled: boolean;
  labels: string[];
  leftUntilDone: number;
  metadataPercentComplete: number;
  name: string;
  needsProfile: Web_Api_TorrentNeedsProfile | null;
  peersConnected: number;
  peersGettingFromUs: number;
  peersSendingToUs: number;
  percentDone: number;
  profileId: string | null;
  queuePosition: number;
  rateDownload: number;
  rateUpload: number;
  recheckProgress: number;
  sizeWhenDone: number;
  status: number;
  totalSize: number;
  uploadedEver: number;
  uploadRatio: number;
  [key: string]: unknown;
};
export type Web_Api_TorrentNeedsProfile = {
  profileIds: string[];
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_TorrentProfileSeeding = {
  idleMinutes: number | null;
  mode: 'limit' | 'never';
  ratio: number | null;
};
export type Web_Api_TorrentProfileOptions = {
  bandwidthPriority: -1 | 0 | 1;
  downloadLimitKBps: number | null;
  peerLimit: number;
  queue: 'normal' | 'top';
  seeding: Web_Api_TorrentProfileSeeding;
  uploadLimitKBps: number | null;
};
export type Web_Api_TorrentProfileInput = {
  connectionId: string | null;
  downloadDirectory: string;
  labels: string[];
  matchPatterns: string[];
  name: string;
  options: Web_Api_TorrentProfileOptions;
  startPaused: boolean;
};
export type Web_Api_DefaultTorrentProfileInput = {
  downloadDirectory: string;
  labels: string[];
  name: string;
  options: Web_Api_TorrentProfileOptions;
  startPaused: boolean;
};
export type Web_Api_UpdateTorrentProfileInput = Web_Api_TorrentProfileInput & {
  moveTorrents?: true | undefined;
};
export type Web_Api_UpdateDefaultTorrentProfileInput = Web_Api_DefaultTorrentProfileInput & {
  moveTorrents?: true | undefined;
};
export type Web_Api_TorrentProfile = Omit<Web_Api_TorrentProfileInput, 'connectionId'> & {
  connectionId: string | null;
  createdAt: string;
  id: string;
  overlaps: Web_Api_TorrentProfileOverlap[];
  updatedAt: string;
};
export type Web_Api_TorrentProfileOverlap = {
  ownPattern: string;
  pattern: string;
  profileId: string;
  profileName: string;
};
export type Web_Api_DefaultTorrentProfile = Web_Api_DefaultTorrentProfileInput & {
  downloadDirectoryLocked: boolean;
};
export type Web_Api_TorrentProfileFolderOverlap = {
  message: string;
  profileId: string;
  profileName: string;
};
export type Web_Api_TorrentProfilesResponse = {
  defaultProfile: Web_Api_DefaultTorrentProfile;
  folderOverlaps?: Web_Api_TorrentProfileFolderOverlap[] | undefined;
  profiles: Web_Api_TorrentProfile[];
};
export type Web_Api_TorrentAddResult = {
  connectionName: string;
  duplicate: boolean;
  hash: string;
  id: number;
  name: string;
  profileName: string;
};
export type Web_Api_TorrentContentsDownload = {
  fileName: string;
  path: string;
  size: number;
  unavailable: number;
  unfinished: number;
};
export type Web_Api_TorrentLinkPreview = {
  hash: string;
  index: number;
  name: string;
  totalSize?: number | undefined;
};
export type Web_Api_TorrentLinkPreviewResponse = {
  items: Web_Api_TorrentLinkPreview[];
};
export type Web_Api_TorrentListResponse = {
  items: Web_Api_Torrent[];
  errors: string[];
};
export type Web_Api_TransmissionFreeSpace = {
  'size-bytes': number;
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_TorrentFile = {
  bytesCompleted: number;
  length: number;
  name: string;
};
export type Web_Api_TorrentFileStats = {
  bytesCompleted: number;
  priority: -1 | 0 | 1;
  wanted: boolean;
};
export type Web_Api_TorrentPeer = {
  address: string;
  clientName: string;
  flagStr: string;
  isEncrypted: boolean;
  isIncoming: boolean;
  port: number;
  progress: number;
  rateToClient: number;
  rateToPeer: number;
};
export type Web_Api_TorrentTracker = {
  announce: string;
  id: number;
  scrape: string;
  sitename?: string | undefined;
  tier: number;
};
export type Web_Api_TorrentTrackerStats = {
  announce: string;
  downloadCount: number;
  host: string;
  id: number;
  lastAnnounceResult: string;
  lastAnnounceSucceeded: boolean;
  leecherCount: number;
  nextAnnounceTime: number;
  seederCount: number;
  sitename?: string | undefined;
  tier: number;
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_TorrentDetail = Web_Api_Torrent & {
  'availability'?: number[] | undefined;
  'bandwidthPriority'?: -1 | 0 | 1 | undefined;
  'comment'?: string | undefined;
  'creator'?: string | undefined;
  'dateCreated'?: number | undefined;
  'doneDate'?: number | undefined;
  'downloadLimit'?: number | undefined;
  'downloadLimited'?: boolean | undefined;
  'files'?: Web_Api_TorrentFile[] | undefined;
  'fileStats'?: Web_Api_TorrentFileStats[] | undefined;
  'honorsSessionLimits'?: boolean | undefined;
  'magnetLink'?: string | undefined;
  'manualAnnounceTime'?: number | undefined;
  'maxConnectedPeers'?: number | undefined;
  'peer-limit'?: number | undefined;
  'peers'?: Web_Api_TorrentPeer[] | undefined;
  'peersFrom'?: Record<string, number> | undefined;
  'pieceCount'?: number | undefined;
  'pieceSize'?: number | undefined;
  'pieces'?: string | undefined;
  'priorities'?: Array<-1 | 0 | 1> | undefined;
  'secondsDownloading'?: number | undefined;
  'secondsSeeding'?: number | undefined;
  'seedIdleLimit'?: number | undefined;
  'seedIdleMode'?: 0 | 1 | 2 | undefined;
  'seedRatioLimit'?: number | undefined;
  'seedRatioMode'?: 0 | 1 | 2 | undefined;
  'startDate'?: number | undefined;
  'trackerList'?: string | undefined;
  'trackers'?: Web_Api_TorrentTracker[] | undefined;
  'trackerStats'?: Web_Api_TorrentTrackerStats[] | undefined;
  'uploadLimit'?: number | undefined;
  'uploadLimited'?: boolean | undefined;
  'wanted'?: boolean[] | undefined;
  'webseeds'?: string[] | undefined;
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_StatisticsPeriod = {
  downloadedBytes: number;
  filesAdded: number;
  secondsActive: number;
  sessionCount: number;
  uploadedBytes: number;
};
export type Web_Api_Statistics = {
  'activeTorrentCount': number;
  'cumulative-stats': Web_Api_StatisticsPeriod;
  'current-stats': Web_Api_StatisticsPeriod;
  'downloadSpeed': number;
  'pausedTorrentCount': number;
  'torrentCount': number;
  'uploadSpeed': number;
  [key: string]: unknown;
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_LiveSnapshot = {
  sequence: number;
  capturedAt: string;
  status?: Web_Api_Status | undefined;
  vpn?: Web_Api_VpnStatus | undefined;
  connections: Web_Api_LiveVpnConnection[];
  protection: Web_Api_VpnProtection;
  statistics?: Web_Api_Statistics | undefined;
  torrents: Web_Api_Torrent[];
  organizationRevision: number;
  errors: string[];
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_BlocklistState = 'idle' | 'updating' | 'waiting-for-vpn' | 'disabled' | 'no-sources';
export type Web_Api_BlocklistSourceState = 'ok' | 'error' | 'pending';
export type Web_Api_BlocklistSourceStatus = {
  url: string;
  state: Web_Api_BlocklistSourceState;
  ranges: number;
  updatedAt?: string | null | undefined;
  error?: string | null | undefined;
  copyFrom?: string | null | undefined;
};
export type Web_Api_BlocklistStatus = {
  state: Web_Api_BlocklistState;
  lastAttemptAt?: string | null | undefined;
  lastSuccessAt?: string | null | undefined;
  nextUpdateAt?: string | null | undefined;
  totalRanges: number;
  sources: Web_Api_BlocklistSourceStatus[];
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_Setting = {
  key: string;
  category: string;
  title: string;
  description: string;
  value: Web_Api_JsonValue;
  defaultValue: Web_Api_JsonValue;
  source: string;
  locked: boolean;
  valid: boolean;
  applyImpact: 'live' | 'transmission-restart';
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_SettingsSnapshot = {
  revision: number;
  settings: Web_Api_Setting[];
  pendingRestartKeys: string[];
  runtimeApply?: {
    status: 'applied' | 'restart-required' | 'deferred' | 'partial';
    appliedKeys: string[];
    pendingKeys: string[];
    connections: Web_Api_SettingsConnectionApply[];
  } | undefined;
};
export type Web_Api_SettingsConnectionApply = {
  connectionId: string;
  status: 'applied' | 'restart-required' | 'deferred';
  appliedKeys: string[];
  pendingKeys: string[];
  error?: string | undefined;
};
export type Web_Api_TransmissionRestartResponse = {
  status: 'restarting' | 'partial';
  configurationRevision: number;
  connections: {
    connectionId: string;
    status: 'restarting' | 'failed';
    error?: string | undefined;
  }[];
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_TorrentOrganization = {
  revision: number;
  labels: string[];
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_DirectoryEntry = {
  name: string;
  path: string;
  empty: boolean;
  hasSubfolders: boolean;
  browsable: boolean;
  selectable: boolean;
  usable: boolean;
  unusableReason?: string | undefined;
  deletable: boolean;
  deleteUnavailableReason?: string | undefined;
  tags: string[];
};
export type Web_Api_DirectoryPurpose = 'download' | 'incomplete' | 'profile';
export type Web_Api_Directory = {
  downloadAllowed: boolean;
  downloadUnavailableReason?: string | undefined;
  path: string;
  parentPath?: string | undefined;
  directories: Web_Api_DirectoryEntry[];
};
export type Web_Api_CreateDirectoryInput = {
  parentPath: string;
  name: string;
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_ProviderCredentialField = {
  key: string;
  label: string;
  kind: 'text' | 'password' | 'wireguard-key' | 'ipv4-address';
  secret: boolean;
  required: boolean;
  description: string;
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_VpnTunnel = 'openvpn' | 'wireguard';

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_ProviderTunnel = {
  id: Web_Api_VpnTunnel;
  description: string;
  catalogSource: string;
  supportsProfileUpload: boolean;
  supportsCatalogRefresh: boolean;
  credentialFields: Web_Api_ProviderCredentialField[];
  catalog?: {
    providerId: string;
    tunnel: Web_Api_VpnTunnel;
    sourceUrl: string;
    endpointCount: number;
    refreshedAt: string;
  } | undefined;
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_ProviderP2P = {
  restricted: boolean;
  note: string;
  linkLabel: string;
  url: string;
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_Provider = {
  id: string;
  displayName: string;
  description: string;
  supportsPortForwarding: boolean;
  p2p: Web_Api_ProviderP2P | null;
  tunnels: Web_Api_ProviderTunnel[];
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_VpnProfile = {
  id: string;
  providerId: string;
  tunnel: Web_Api_VpnTunnel;
  displayName: string;
  countryCode: string;
  country: string;
  city: string;
  continent: string;
  protocol: string;
  remoteHost: string;
  remotePort: number;
  fingerprint: string;
  source: string;
  updatedAt: string;
};
export type Web_Api_CustomProfileResponse = Web_Api_VpnProfile & {
  profiles: Web_Api_VpnProfile[];
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_Scope = 'settings:read' | 'settings:write' | 'torrents:read' | 'torrents:write' | 'vpn:read' | 'vpn:write';

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_Token = {
  id: string;
  name: string;
  scopes: Web_Api_Scope[];
  expiresAt: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_CreatedToken = {
  token: Web_Api_Token;
  plaintext: string;
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_RPCLogin = {
  id: string;
  username: string;
  createdAt: string;
  lastUsedAt: string | null;
};
export type Web_Api_RPCCredential = {
  login: Web_Api_RPCLogin;
  password?: string | undefined;
};
export type Web_Api_RPCLoginInput = {
  username: string;
};
export type Web_Api_UpdateRPCLoginInput = {
  username?: string | undefined;
  regeneratePassword?: boolean | undefined;
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_WebProxyState = 'off' | 'listening' | 'waiting-for-vpn' | 'error';
export type Web_Api_WebProxyLogin = {
  id: string;
  username: string;
  passwordSet: boolean;
  connectionId: string | null;
  effectiveConnectionId: string;
};
export type Web_Api_WebProxyCredential = {
  login: Web_Api_WebProxyLogin;
  password?: string | undefined;
};
export type Web_Api_WebProxy = {
  enabled: boolean;
  port: number;
  state: Web_Api_WebProxyState;
  error?: string | undefined;
  logins: Web_Api_WebProxyLogin[];
};
export type Web_Api_WebProxyLoginInput = {
  connectionId: string | null;
  username: string;
};
export type Web_Api_UpdateWebProxyLoginInput = {
  connectionId?: string | null | undefined;
  regeneratePassword?: boolean | undefined;
  username?: string | undefined;
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_ErrorIssue = {
  field: string;
  path: string[];
  message: string;
};
export type Web_Api_ErrorEnvelope = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown> | undefined;
    issues?: Web_Api_ErrorIssue[] | undefined;
  };
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_Schema<T> = ZodType<T>;

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_ConnectLiveEvents_OnSnapshot = (
  snapshot: Web_Api_LiveSnapshot,
) => void;
export type Web_Api_ConnectLiveEvents_Returns = () => void;

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_TorrentAction =
  | 'queue-bottom'
  | 'queue-down'
  | 'queue-top'
  | 'queue-up'
  | 'reannounce'
  | 'start'
  | 'start-now'
  | 'stop'
  | 'verify';

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_AddTorrentInput = {
  filename?: string | undefined;
  labels?: string[] | undefined;
  metainfo?: string | undefined;
  paused?: boolean | undefined;
  profileId?: string | undefined;
};
export type Web_Api_TorrentActionInput = {
  action: Web_Api_TorrentAction;
  hashes: string[];
};
export type Web_Api_RemoveTorrentsInput = {
  deleteLocalData: boolean;
  hashes: string[];
};
export type Web_Api_UpdateTorrentsInput = {
  changes: Web_Api_TorrentChanges;
  hashes: string[];
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_TorrentChanges = {
  bandwidthPriority?: -1 | 0 | 1 | undefined;
  downloadLimit?: number | undefined;
  downloadLimited?: boolean | undefined;
  filesUnwanted?: number[] | undefined;
  filesWanted?: number[] | undefined;
  honorsSessionLimits?: boolean | undefined;
  labels?: string[] | undefined;
  peerLimit?: number | undefined;
  priorityHigh?: number[] | undefined;
  priorityLow?: number[] | undefined;
  priorityNormal?: number[] | undefined;
  queuePosition?: number | undefined;
  seedIdleLimit?: number | undefined;
  seedIdleMode?: 0 | 1 | 2 | undefined;
  seedRatioLimit?: number | undefined;
  seedRatioMode?: 0 | 1 | 2 | undefined;
  trackerList?: string | undefined;
  uploadLimit?: number | undefined;
  uploadLimited?: boolean | undefined;
};
export type Web_Api_RenameTorrentPathInput = {
  hashes: string[];
  name: string;
  path: string;
};
export type Web_Api_SetTorrentProfileInput = {
  applyOptions: boolean;
  hashes: string[];
  profileId: string | null;
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_VpnConfigurationInput = {
  providerId: string;
  tunnel: Web_Api_VpnTunnel;
  profileIds: string[];
  endpointStrategy: 'sticky' | 'ordered' | 'randomized';
  credentials: Record<string, string>;
  dnsServers: string[];
  retryIntervalSeconds: number;
};
export type Web_Api_CreateVpnConnectionInput = Web_Api_VpnConfigurationInput & {
  name: string;
  peerPort?: number | undefined;
};
export type Web_Api_UpdateVpnConnectionInput = {
  expectedRevision: number;
  name?: string | undefined;
  peerPort?: number | undefined;
  configuration?: Web_Api_VpnConfigurationInput | undefined;
};
export type Web_Api_SetDefaultVpnConnectionInput = {
  connectionId: string;
  moveTorrents?: true | undefined;
};
export type Web_Api_MovedTorrent = {
  hash: string;
  id?: number | undefined;
  name: string;
  result: 'moved' | 'already-there' | 'failed';
  error?: string | undefined;
  warnings?: string[] | undefined;
};
export type Web_Api_DeleteTorrentProfileInput = {
  moveTorrents?: true | undefined;
};
export type Web_Api_DeleteTorrentProfileResponse = {
  moved: Web_Api_MovedTorrent[];
};
export type Web_Api_DeleteVpnConnectionInput = {
  moveTo?: string | undefined;
};
export type Web_Api_DeleteVpnConnectionResponse = {
  moved: Web_Api_MovedTorrent[];
  profiles: number;
  logins: number;
};
export type Web_Api_SetTorrentProfileResponse = {
  hashes?: string[] | undefined;
  ids?: number[] | undefined;
  profileId: string | null;
  applyOptions: boolean;
  moved: Web_Api_MovedTorrent[];
};
export type Web_Api_UpdateTorrentProfileResponse = Web_Api_TorrentProfile & {
  moved: Web_Api_MovedTorrent[];
};
export type Web_Api_UpdateDefaultTorrentProfileResponse = Web_Api_DefaultTorrentProfile & {
  moved: Web_Api_MovedTorrent[];
};
export type Web_Api_VpnConnectionInput = {
  dnsServers: string[];
  retryIntervalSeconds: number;
};
export type Web_Api_CustomProfileInput = {
  tunnel: Web_Api_VpnTunnel;
  profileName: string;
  profile: string;
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_ClaimInput = {
  claimCode: string;
  username: string;
  password: string;
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_LoginInput = {
  username: string;
  password: string;
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_UpdateSettingsInput = {
  expectedRevision: number;
  changes: Record<string, Web_Api_JsonValue>;
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_UpdateTorrentOrganizationInput = {
  expectedRevision: number;
  labels: string[];
  removedLabels: string[];
  renamedLabels: {
    from: string;
    to: string;
  }[];
};
export type Web_Api_UpdateTorrentOrganizationResponse = Web_Api_TorrentOrganization & {
  changedTorrents: number;
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_CreateTokenInput = {
  name: string;
  scopes: Web_Api_Scope[];
  expiresAt?: string | undefined;
};

/**
 * API.
 *
 * @since 2.0.0
 */
export type Web_Api_UpdateTokenInput = {
  name: string;
  scopes: Web_Api_Scope[];
  expiresAt?: string | null | undefined;
};

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_AccountSecuritySchema = Web_Api_Schema<Web_Api_AccountSecurity>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_AddPasskey_Name = string;
export type Web_Api_AddPasskey_Password = string;
export type Web_Api_AddPasskey_Returns = Promise<Web_Api_Passkey>;
export type Web_Api_AddPasskey_Credential = Record<string, unknown>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_AddTorrent_Returns = Promise<Web_Api_TorrentAddResult>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_AdministratorSchema = Web_Api_Schema<Web_Api_Administrator>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_ApiError_Code = string;
export type Web_Api_ApiError_Status = number;
export type Web_Api_ApiError_Issues = Web_Api_ErrorIssue[];
export type Web_Api_ApiError_Details = Record<string, unknown>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_ApiError_Constructor_Message = string;
export type Web_Api_ApiError_Constructor_Code = string;
export type Web_Api_ApiError_Constructor_Status = number;
export type Web_Api_ApiError_Constructor_Issues = Web_Api_ErrorIssue[];
export type Web_Api_ApiError_Constructor_Details = Record<string, unknown>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_AuthenticationResponseSchema = Web_Api_Schema<Web_Api_AuthenticationResponse>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_BackupGrantSchema = Web_Api_Schema<Web_Backup_Grant>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_BackupImportJobSchema = Web_Api_Schema<Web_Backup_ImportJob>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_BackupImportPreviewSchema = Web_Api_Schema<Web_Backup_ImportPreview>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_BackupSourceDirectorySchema = Web_Api_Schema<Web_Backup_SourceDirectory>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_BlocklistSourceStatusSchema = Web_Api_Schema<Web_Api_BlocklistSourceStatus>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_BlocklistStatusSchema = Web_Api_Schema<Web_Api_BlocklistStatus>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_ChangePassword_CurrentPassword = string;
export type Web_Api_ChangePassword_NewPassword = string;
export type Web_Api_ChangePassword_Returns = Promise<void>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_ChangeUsername_Username = string;
export type Web_Api_ChangeUsername_Password = string;
export type Web_Api_ChangeUsername_Returns = Promise<void>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_ClaimInstallation_Returns = Promise<Web_Api_AuthenticationResponse>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_ConfirmBackupOperation_Password = string;
export type Web_Api_ConfirmBackupOperation_Code = string;
export type Web_Api_ConfirmBackupOperation_Returns = Promise<string>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_ConfirmBackupOperationWithPasskey_Returns = Promise<string>;
export type Web_Api_ConfirmBackupOperationWithPasskey_Credential = Record<string, unknown>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_ConnectionBeingRemovedMessage_CaughtError = unknown;
export type Web_Api_ConnectionBeingRemovedMessage_ConnectionName = string;
export type Web_Api_ConnectionBeingRemovedMessage_Returns = string | null;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_ConnectLiveEvents_Value = unknown;
export type Web_Api_ConnectLiveEvents_ParsedSnapshot = ZodSafeParseResult<Web_Api_LiveSnapshot>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_CreateBackupImport_Grant = string;
export type Web_Api_CreateBackupImport_Returns = Promise<Web_Backup_ImportJob>;
export type Web_Api_CreateBackupImport_Response = {
  job: Web_Backup_ImportJob;
};

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_CreateDirectory_ProfileId = string;
export type Web_Api_CreateDirectory_Returns = Promise<Web_Api_Directory>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_CreatedTokenSchema = Web_Api_Schema<Web_Api_CreatedToken>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_CreateNotification_Returns = Promise<Web_Notifications_Target>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_CreateRpcLogin_Returns = Promise<Web_Api_RPCCredential>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_CreateToken_Returns = Promise<Web_Api_CreatedToken>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_CreateTorrentProfile_IncompleteDirectory = string;
export type Web_Api_CreateTorrentProfile_Returns = Promise<Web_Api_TorrentProfile>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_CreateVpnConnection_Returns = Promise<Web_Api_VpnConnection>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_CreateWebProxyLogin_Returns = Promise<Web_Api_WebProxyCredential>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_CustomProfileResponseSchema = Web_Api_Schema<Web_Api_CustomProfileResponse>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_DefaultTorrentProfileSchema = Web_Api_Schema<Web_Api_DefaultTorrentProfile>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_DefaultTorrentProfileUpdateResponseSchema = Web_Api_Schema<Web_Api_UpdateDefaultTorrentProfileResponse>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_DeleteDirectory_Path = string;
export type Web_Api_DeleteDirectory_ProfileId = string;
export type Web_Api_DeleteDirectory_Returns = Promise<void>;
export type Web_Api_DeleteDirectory_ValidatedPath = string;
export type Web_Api_DeleteDirectory_Query = string;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_DeleteRpcLogin_LoginId = string;
export type Web_Api_DeleteRpcLogin_Returns = Promise<void>;
export type Web_Api_DeleteRpcLogin_ValidatedLoginId = string;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_DeleteTorrentProfile_ProfileId = string;
export type Web_Api_DeleteTorrentProfile_MoveTorrents = boolean;
export type Web_Api_DeleteTorrentProfile_Returns = Promise<Web_Api_DeleteTorrentProfileResponse>;
export type Web_Api_DeleteTorrentProfile_Path = string;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_DeleteTorrentProfileResponseSchema = Web_Api_Schema<Web_Api_DeleteTorrentProfileResponse>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_DeleteVpnConnection_ConnectionId = string;
export type Web_Api_DeleteVpnConnection_Returns = Promise<Web_Api_DeleteVpnConnectionResponse>;
export type Web_Api_DeleteVpnConnection_ValidatedConnectionId = string;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_DeleteVpnConnectionResponseSchema = Web_Api_Schema<Web_Api_DeleteVpnConnectionResponse>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_DeleteWebProxyLogin_LoginId = string;
export type Web_Api_DeleteWebProxyLogin_Returns = Promise<void>;
export type Web_Api_DeleteWebProxyLogin_ValidatedLoginId = string;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_DirectorySchema = Web_Api_Schema<Web_Api_Directory>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_DisableTotp_Password = string;
export type Web_Api_DisableTotp_Returns = Promise<void>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_DisconnectVpnConnection_ConnectionId = string;
export type Web_Api_DisconnectVpnConnection_Returns = Promise<Web_Api_VpnConnection>;
export type Web_Api_DisconnectVpnConnection_ValidatedConnectionId = string;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_DismissRemovedSecrets_Returns = Promise<void>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_DispositionFileName_Disposition = string;
export type Web_Api_DispositionFileName_Fallback = string;
export type Web_Api_DispositionFileName_Returns = string;
export type Web_Api_DispositionFileName_EncodedMatch = RegExpExecArray | null;
export type Web_Api_DispositionFileName_EncodedName = string | undefined;
export type Web_Api_DispositionFileName_QuotedMatch = RegExpExecArray | null;
export type Web_Api_DispositionFileName_QuotedName = string | undefined;
export type Web_Api_DispositionFileName_BareMatch = RegExpExecArray | null;
export type Web_Api_DispositionFileName_BareName = string | undefined;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_DownloadBackupExport_Grant = string;
export type Web_Api_DownloadBackupExport_Returns = Promise<void>;
export type Web_Api_DownloadBackupExport_CsrfToken = string | undefined;
export type Web_Api_DownloadBackupExport_Disposition = string;
export type Web_Api_DownloadBackupExport_FilenameMatch = RegExpExecArray | null;
export type Web_Api_DownloadBackupExport_MatchedFilename = string | undefined;
export type Web_Api_DownloadBackupExport_Filename = string;
export type Web_Api_DownloadBackupExport_Url = string;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_DownloadFinishedFiles_Hashes = string[];
export type Web_Api_DownloadFinishedFiles_Returns = Promise<Web_Api_TorrentContentsDownload>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_DownloadTorrentFiles_Hashes = string[];
export type Web_Api_DownloadTorrentFiles_Returns = Promise<number>;
export type Web_Api_DownloadTorrentFiles_CsrfToken = string | undefined;
export type Web_Api_DownloadTorrentFiles_FallbackName = string;
export type Web_Api_DownloadTorrentFiles_Filename = string;
export type Web_Api_DownloadTorrentFiles_Url = string;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_EnableTotp_Code = string;
export type Web_Api_EnableTotp_Returns = Promise<Web_Api_RecoveryCodes>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_ErrorEnvelopeSchema = Web_Api_Schema<Web_Api_ErrorEnvelope>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_GetAccountSecurity_Returns = Promise<Web_Api_AccountSecurity>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_GetBackupImport_ImportId = string;
export type Web_Api_GetBackupImport_Returns = Promise<Web_Backup_ImportJob>;
export type Web_Api_GetBackupImport_Response = {
  job: Web_Backup_ImportJob;
};

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_GetBackupSourceDirectory_Path = string;
export type Web_Api_GetBackupSourceDirectory_Returns = Promise<Web_Backup_SourceDirectory>;
export type Web_Api_GetBackupSourceDirectory_Response = {
  directory: Web_Backup_SourceDirectory;
};

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_GetBlocklistStatus_Returns = Promise<Web_Api_BlocklistStatus>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_GetCurrentAdministrator_Returns = Promise<Web_Api_Administrator | null>;
export type Web_Api_GetCurrentAdministrator_ResponseValue = unknown;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_GetCurrentBackupImport_Returns = Promise<Web_Backup_ImportJob | null>;
export type Web_Api_GetCurrentBackupImport_Response = {
  job: Web_Backup_ImportJob | null;
};

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_GetDirectory_Path = string;
export type Web_Api_GetDirectory_ProfileId = string;
export type Web_Api_GetDirectory_Returns = Promise<Web_Api_Directory>;
export type Web_Api_GetDirectory_ValidatedPath = string;
export type Web_Api_GetDirectory_Query = string;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_GetNotificationEvents_Returns = Promise<Web_Notifications_Event[]>;
export type Web_Api_GetNotificationEvents_Response = {
  items: Web_Notifications_Event[];
};

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_GetNotifications_Returns = Promise<Web_Notifications_Target[]>;
export type Web_Api_GetNotifications_Response = {
  items: Web_Notifications_Target[];
};

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_GetProfiles_ProviderId = string;
export type Web_Api_GetProfiles_Returns = Promise<Web_Api_VpnProfile[]>;
export type Web_Api_GetProfiles_ValidatedProviderId = string;
export type Web_Api_GetProfiles_Query = string;
export type Web_Api_GetProfiles_Response = {
  items: Web_Api_VpnProfile[];
};

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_GetProviders_Returns = Promise<Web_Api_Provider[]>;
export type Web_Api_GetProviders_Response = {
  items: Web_Api_Provider[];
};

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_GetRpcLogins_Returns = Promise<Web_Api_RPCLogin[]>;
export type Web_Api_GetRpcLogins_Response = {
  logins: Web_Api_RPCLogin[];
};

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_GetSettings_Returns = Promise<Web_Api_SettingsSnapshot>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_GetSetupStatus_Returns = Promise<Web_Api_SetupStatus>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_GetTokens_Returns = Promise<Web_Api_Token[]>;
export type Web_Api_GetTokens_Response = {
  items: Web_Api_Token[];
};

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_GetTorrentDetail_TorrentId = number;
export type Web_Api_GetTorrentDetail_Returns = Promise<Web_Api_TorrentDetail>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_GetTorrentOrganization_Returns = Promise<Web_Api_TorrentOrganization>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_GetTorrentProfiles_Returns = Promise<Web_Api_TorrentProfilesResponse>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_GetTorrents_Returns = Promise<Web_Api_TorrentListResponse>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_GetTransmissionFreeSpace_Path = string;
export type Web_Api_GetTransmissionFreeSpace_Returns = Promise<number>;
export type Web_Api_GetTransmissionFreeSpace_ValidatedPath = string;
export type Web_Api_GetTransmissionFreeSpace_Query = string;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_GetVpnConnection_ConnectionId = string;
export type Web_Api_GetVpnConnection_Returns = Promise<Web_Api_VpnConnection>;
export type Web_Api_GetVpnConnection_ValidatedConnectionId = string;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_GetVpnConnections_Returns = Promise<Web_Api_VpnConnectionsResponse>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_GetWebProxy_Returns = Promise<Web_Api_WebProxy>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_IssueFor_CaughtError = unknown;
export type Web_Api_IssueFor_Field = string;
export type Web_Api_IssueFor_Returns = string;
export type Web_Api_IssueFor_Issue = Web_Api_ErrorIssue | undefined;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_IsVpnConnectionRequiredError_CaughtError = unknown;
export type Web_Api_IsVpnConnectionRequiredError_Returns = boolean;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_JsonValueSchema = Web_Api_Schema<Web_Api_JsonValue>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_LiveSnapshotSchema = Web_Api_Schema<Web_Api_LiveSnapshot>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_Login_Returns = Promise<Web_Api_LoginResult>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_LoginResultSchema = Web_Api_Schema<Web_Api_LoginResult>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_Logout_Returns = Promise<void>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_MessageForApiError_Code = string;
export type Web_Api_MessageForApiError_Status = number;
export type Web_Api_MessageForApiError_Message = string;
export type Web_Api_MessageForApiError_Details = Record<string, unknown>;
export type Web_Api_MessageForApiError_Returns = string;
export type Web_Api_MessageForApiError_NormalizedMessage = string;
export type Web_Api_MessageForApiError_Limit = unknown;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_MovedTorrentSchema = Web_Api_Schema<Web_Api_MovedTorrent>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_NotificationTargetSchema = Web_Api_Schema<Web_Notifications_Target>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_NotificationTestSchema = Web_Api_Schema<Web_Notifications_TestResult>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_PasskeyCeremonySchema = Web_Api_Schema<Web_Api_PasskeyCeremony>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_PasskeySchema = Web_Api_Schema<Web_Api_Passkey>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_PreviewAnotherTransmissionImport_ConfigPath = string;
export type Web_Api_PreviewAnotherTransmissionImport_FolderMappings = Record<string, string>;
export type Web_Api_PreviewAnotherTransmissionImport_Returns = Promise<Web_Backup_ImportPreview>;
export type Web_Api_PreviewAnotherTransmissionImport_Response = {
  preview: Web_Backup_ImportPreview;
};

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_PreviewBackupImport_FolderMappings = Record<string, string>;
export type Web_Api_PreviewBackupImport_ProfileActions = Record<string, string>;
export type Web_Api_PreviewBackupImport_Returns = Promise<Web_Backup_ImportPreview>;
export type Web_Api_PreviewBackupImport_Response = {
  preview: Web_Backup_ImportPreview;
};

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_PreviewTorrentLinks_Links = string[];
export type Web_Api_PreviewTorrentLinks_Returns = Promise<Web_Api_TorrentLinkPreviewResponse>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_ReadCookie_Name = string;
export type Web_Api_ReadCookie_Returns = string | undefined;
export type Web_Api_ReadCookie_Prefix = string;
export type Web_Api_ReadCookie_Parts = string[];
export type Web_Api_ReadCookie_MatchingPart = string | undefined;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_ReconnectVpnConnection_ConnectionId = string;
export type Web_Api_ReconnectVpnConnection_Returns = Promise<Web_Api_VpnConnection>;
export type Web_Api_ReconnectVpnConnection_ValidatedConnectionId = string;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_RecoveryCodesSchema = Web_Api_Schema<Web_Api_RecoveryCodes>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_RefreshVpnCatalog_ProviderId = string;
export type Web_Api_RefreshVpnCatalog_Returns = Promise<void>;
export type Web_Api_RefreshVpnCatalog_ValidatedProviderId = string;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_RegenerateRecoveryCodes_Password = string;
export type Web_Api_RegenerateRecoveryCodes_Returns = Promise<Web_Api_RecoveryCodes>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_RemovedSecretSchema = Web_Api_Schema<Web_Api_RemovedSecret>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_RemoveNotification_NotificationId = string;
export type Web_Api_RemoveNotification_Returns = Promise<void>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_RemovePasskey_PasskeyId = string;
export type Web_Api_RemovePasskey_Password = string;
export type Web_Api_RemovePasskey_Returns = Promise<void>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_RemoveTorrents_Hashes = string[];
export type Web_Api_RemoveTorrents_DeleteLocalData = boolean;
export type Web_Api_RemoveTorrents_Returns = Promise<void>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_RenameTorrentPath_Returns = Promise<void>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_RequestBlocklistUpdate_Returns = Promise<void>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_RequestJson_Path = string;
export type Web_Api_RequestJson_RequestBody = unknown;
export type Web_Api_RequestJson_BaseOptions = Omit<Web_Api_Request_Options, 'body'>;
export type Web_Api_RequestJson_CsrfToken = string | undefined;
export type Web_Api_RequestJson_ResponseValue = unknown;
export type Web_Api_RequestJson_ParsedResponse<ResponseValue> = ZodSafeParseResult<ResponseValue>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_RequestVoid_Path = string;
export type Web_Api_RequestVoid_Returns = Promise<void>;
export type Web_Api_RequestVoid_RequestBody = unknown;
export type Web_Api_RequestVoid_BaseOptions = Omit<Web_Api_Request_Options, 'body'>;
export type Web_Api_RequestVoid_CsrfToken = string | undefined;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_ResponseArraySchema_Returns<Value> = Web_Api_Schema<Value[]>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_ResponseError_Returns = Promise<Web_Api_ResponseError_ApiError>;
export type Web_Api_ResponseError_ApiError = Error & {
  code: string;
  status: number;
  issues: Web_Api_ErrorIssue[];
  details: Record<string, unknown>;
};
export type Web_Api_ResponseError_ResponseValue = unknown;
export type Web_Api_ResponseError_ParsedError = ZodSafeParseResult<Web_Api_ErrorEnvelope>;
export type Web_Api_ResponseError_Details = Record<string, unknown>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_RestartTransmission_Returns = Promise<void>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_RevokeToken_TokenId = string;
export type Web_Api_RevokeToken_Returns = Promise<void>;
export type Web_Api_RevokeToken_ValidatedTokenId = string;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_RpcCredentialSchema = Web_Api_Schema<Web_Api_RPCCredential>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_RpcLoginSchema = Web_Api_Schema<Web_Api_RPCLogin>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_RunTorrentAction_Hashes = string[];
export type Web_Api_RunTorrentAction_Returns = Promise<void>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_ScopeSchema = Web_Api_Schema<Web_Api_Scope>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_SetDefaultVpnConnection_Returns = Promise<Web_Api_VpnDefaultResponse>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_SetTorrentProfile_Returns = Promise<Web_Api_SetTorrentProfileResponse>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_SetupStatusSchema = Web_Api_Schema<Web_Api_SetupStatus>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_SignInWithPasskey_Returns = Promise<Web_Api_AuthenticationResponse>;
export type Web_Api_SignInWithPasskey_Credential = Record<string, unknown>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_StartTotpSetup_Password = string;
export type Web_Api_StartTotpSetup_Returns = Promise<Web_Api_TotpSetup>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_SubmitSecondFactor_Challenge = string;
export type Web_Api_SubmitSecondFactor_Code = string;
export type Web_Api_SubmitSecondFactor_Returns = Promise<Web_Api_AuthenticationResponse>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_SummaryFor_CaughtError = unknown;
export type Web_Api_SummaryFor_ShownFields = string[];
export type Web_Api_SummaryFor_Fallback = string;
export type Web_Api_SummaryFor_Returns = string;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_TestNotification_NotificationId = string;
export type Web_Api_TestNotification_Returns = Promise<Web_Notifications_TestResult>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_TokenSchema = Web_Api_Schema<Web_Api_Token>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_TorrentAddResultSchema = Web_Api_Schema<Web_Api_TorrentAddResult>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_TorrentContentsDownloadSchema = Web_Api_Schema<Web_Api_TorrentContentsDownload>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_TorrentLinkPreviewResponseSchema = Web_Api_Schema<Web_Api_TorrentLinkPreviewResponse>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_TorrentLinkPreviewSchema = Web_Api_Schema<Web_Api_TorrentLinkPreview>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_TorrentListResponseSchema = Web_Api_Schema<Web_Api_TorrentListResponse>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_TorrentProfileAssignmentResponseSchema = Web_Api_Schema<Web_Api_SetTorrentProfileResponse>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_TorrentProfileSchema = Web_Api_Schema<Web_Api_TorrentProfile>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_TorrentProfileUpdateResponseSchema = Web_Api_Schema<Web_Api_UpdateTorrentProfileResponse>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_TotpSetupSchema = Web_Api_Schema<Web_Api_TotpSetup>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_TransmissionFreeSpaceSchema = Web_Api_Schema<Web_Api_TransmissionFreeSpace>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_TransmissionRestartResponseSchema = Web_Api_Schema<Web_Api_TransmissionRestartResponse>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_UpdateDefaultTorrentProfile_MoveTorrents = boolean;
export type Web_Api_UpdateDefaultTorrentProfile_IncompleteDirectory = string;
export type Web_Api_UpdateDefaultTorrentProfile_Returns = Promise<Web_Api_UpdateDefaultTorrentProfileResponse>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_UpdateNotification_NotificationId = string;
export type Web_Api_UpdateNotification_Returns = Promise<Web_Notifications_Target>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_UpdateRpcLogin_LoginId = string;
export type Web_Api_UpdateRpcLogin_Returns = Promise<Web_Api_RPCCredential>;
export type Web_Api_UpdateRpcLogin_ValidatedLoginId = string;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_UpdateSettings_IncompleteDirectory = string;
export type Web_Api_UpdateSettings_Returns = Promise<Web_Api_SettingsSnapshot>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_UpdateToken_TokenId = string;
export type Web_Api_UpdateToken_Returns = Promise<Web_Api_Token>;
export type Web_Api_UpdateToken_ValidatedTokenId = string;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_UpdateTorrentOrganization_Returns = Promise<Web_Api_UpdateTorrentOrganizationResponse>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_UpdateTorrentOrganizationResponseSchema = Web_Api_Schema<Web_Api_UpdateTorrentOrganizationResponse>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_UpdateTorrentProfile_ProfileId = string;
export type Web_Api_UpdateTorrentProfile_MoveTorrents = boolean;
export type Web_Api_UpdateTorrentProfile_IncompleteDirectory = string;
export type Web_Api_UpdateTorrentProfile_Returns = Promise<Web_Api_UpdateTorrentProfileResponse>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_UpdateTorrents_Hashes = string[];
export type Web_Api_UpdateTorrents_Returns = Promise<void>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_UpdateVpnConnection_ConnectionId = string;
export type Web_Api_UpdateVpnConnection_Returns = Promise<Web_Api_VpnConnection>;
export type Web_Api_UpdateVpnConnection_ValidatedConnectionId = string;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_UpdateWebProxy_Enabled = boolean;
export type Web_Api_UpdateWebProxy_Returns = Promise<Web_Api_WebProxy>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_UpdateWebProxyLogin_LoginId = string;
export type Web_Api_UpdateWebProxyLogin_Returns = Promise<Web_Api_WebProxyCredential>;
export type Web_Api_UpdateWebProxyLogin_ValidatedLoginId = string;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_UploadCustomProfile_ProfileName = string;
export type Web_Api_UploadCustomProfile_Profile = string;
export type Web_Api_UploadCustomProfile_Returns = Promise<Web_Api_VpnProfile[]>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_VpnConnectionResponseSchema = Web_Api_Schema<Web_Api_VpnConnectionResponse>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_VpnConnectionSchema = Web_Api_Schema<Web_Api_VpnConnection>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_VpnConnectionsResponseSchema = Web_Api_Schema<Web_Api_VpnConnectionsResponse>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_VpnDefaultResponseSchema = Web_Api_Schema<Web_Api_VpnDefaultResponse>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_WebProxyCredentialSchema = Web_Api_Schema<Web_Api_WebProxyCredential>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_WebProxyLoginSchema = Web_Api_Schema<Web_Api_WebProxyLogin>;

/**
 * API.
 *
 * @since 2.4.1
 */
export type Web_Api_WebProxySchema = Web_Api_Schema<Web_Api_WebProxy>;
