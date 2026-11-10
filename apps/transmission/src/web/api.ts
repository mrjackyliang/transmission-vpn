import { z } from 'zod';

import {
  formatConsoleError,
  parseAddTorrentInput,
  parseClaimInput,
  parseCreateDirectoryInput,
  parseCreateVpnConnectionInput,
  parseCustomProfileInput,
  parseDataPath,
  parseDeleteVpnConnectionInput,
  parseLoginInput,
  parseProviderID,
  parseRemoveTorrentsInput,
  parseRenameTorrentPathInput,
  parseRPCLoginInput,
  parseSetDefaultVpnConnectionInput,
  parseSetTorrentProfileInput,
  parseTokenID,
  parseTorrentActionInput,
  parseTorrentProfileInput,
  parseUpdateDefaultTorrentProfileInput,
  parseUpdateRPCLoginInput,
  parseUpdateSettingsInput,
  parseUpdateTorrentOrganizationInput,
  parseUpdateTorrentProfileInput,
  parseUpdateTorrentsInput,
  parseUpdateVpnConnectionInput,
  parseUpdateWebProxyLoginInput,
  parseWebProxyLoginInput,
} from '@/web/form-validation.ts';
import {
  createPasskey,
  getPasskey,
} from '@/web/passkeys.ts';

import type {
  Web_Api_AccountSecurity,
  Web_Api_AddTorrentInput,
  Web_Api_Administrator,
  Web_Api_AuthenticationResponse,
  Web_Api_BlocklistSourceStatus,
  Web_Api_BlocklistStatus,
  Web_Api_ClaimInput,
  Web_Api_ConnectLiveEvents_OnSnapshot,
  Web_Api_ConnectLiveEvents_Returns,
  Web_Api_CreateDirectoryInput,
  Web_Api_CreatedToken,
  Web_Api_CreateTokenInput,
  Web_Api_CreateVpnConnectionInput,
  Web_Api_CustomProfileInput,
  Web_Api_CustomProfileResponse,
  Web_Api_DefaultTorrentProfile,
  Web_Api_DefaultTorrentProfileInput,
  Web_Api_DeleteTorrentProfileInput,
  Web_Api_DeleteTorrentProfileResponse,
  Web_Api_DeleteVpnConnectionInput,
  Web_Api_DeleteVpnConnectionResponse,
  Web_Api_Directory,
  Web_Api_DirectoryPurpose,
  Web_Api_ErrorEnvelope,
  Web_Api_ErrorIssue,
  Web_Api_JsonValue,
  Web_Api_LiveSnapshot,
  Web_Api_LoginInput,
  Web_Api_LoginResult,
  Web_Api_MovedTorrent,
  Web_Api_Passkey,
  Web_Api_PasskeyCeremony,
  Web_Api_Provider,
  Web_Api_RecoveryCodes,
  Web_Api_RemovedSecret,
  Web_Api_RemoveTorrentsInput,
  Web_Api_RenameTorrentPathInput,
  Web_Api_Request_Options,
  Web_Api_RPCCredential,
  Web_Api_RPCLogin,
  Web_Api_RPCLoginInput,
  Web_Api_Schema,
  Web_Api_Scope,
  Web_Api_SetDefaultVpnConnectionInput,
  Web_Api_SettingsSnapshot,
  Web_Api_SetTorrentProfileInput,
  Web_Api_SetTorrentProfileResponse,
  Web_Api_SetupStatus,
  Web_Api_Token,
  Web_Api_Torrent,
  Web_Api_TorrentAction,
  Web_Api_TorrentActionInput,
  Web_Api_TorrentAddResult,
  Web_Api_TorrentChanges,
  Web_Api_TorrentDetail,
  Web_Api_TorrentLinkPreview,
  Web_Api_TorrentLinkPreviewResponse,
  Web_Api_TorrentListResponse,
  Web_Api_TorrentOrganization,
  Web_Api_TorrentProfile,
  Web_Api_TorrentProfileInput,
  Web_Api_TorrentProfilesResponse,
  Web_Api_TotpSetup,
  Web_Api_TransmissionFreeSpace,
  Web_Api_TransmissionRestartResponse,
  Web_Api_UpdateDefaultTorrentProfileInput,
  Web_Api_UpdateDefaultTorrentProfileResponse,
  Web_Api_UpdateRPCLoginInput,
  Web_Api_UpdateSettingsInput,
  Web_Api_UpdateTokenInput,
  Web_Api_UpdateTorrentOrganizationInput,
  Web_Api_UpdateTorrentOrganizationResponse,
  Web_Api_UpdateTorrentProfileInput,
  Web_Api_UpdateTorrentProfileResponse,
  Web_Api_UpdateTorrentsInput,
  Web_Api_UpdateVpnConnectionInput,
  Web_Api_UpdateWebProxyLoginInput,
  Web_Api_VpnConnection,
  Web_Api_VpnConnectionResponse,
  Web_Api_VpnConnectionsResponse,
  Web_Api_VpnDefaultResponse,
  Web_Api_VpnProfile,
  Web_Api_VpnTunnel,
  Web_Api_WebProxy,
  Web_Api_WebProxyCredential,
  Web_Api_WebProxyLogin,
  Web_Api_WebProxyLoginInput,
} from '@/types/web/api.d.ts';
import type {
  Web_Backup_Document,
  Web_Backup_ExportSections,
  Web_Backup_Grant,
  Web_Backup_ImportJob,
  Web_Backup_ImportPlan,
  Web_Backup_ImportPreview,
  Web_Backup_Purpose,
  Web_Backup_SourceDirectory,
} from '@/types/web/backup.d.ts';
import type {
  Web_Notifications_CreateInput,
  Web_Notifications_Event,
  Web_Notifications_Target,
  Web_Notifications_TestResult,
  Web_Notifications_UpdateInput,
} from '@/types/web/notifications.d.ts';

/**
 * API - Response array schema.
 *
 * Treats a legacy or unexpected null response list as empty while retaining the
 * element schema. Request parsers remain strict in form-validation.ts.
 *
 * @since 2.0.0
 */
const responseArraySchema = <Value>(
  elementSchema: Web_Api_Schema<Value>,
): Web_Api_Schema<Value[]> => z.preprocess(
  (value: unknown): unknown => (value === null) ? [] : value,
  z.array(elementSchema),
);

/**
 * API - JSON value schema.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const jsonValueSchema: Web_Api_Schema<Web_Api_JsonValue> = z.lazy(() => z.union([
  z.boolean(),
  z.number(),
  z.string(),
  z.null(),
  z.array(jsonValueSchema),
  z.record(z.string(), jsonValueSchema),
]));

/**
 * API - Service state schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const serviceStateSchema = z.object({
  ready: z.boolean(),
  phase: z.string().optional(),
});

/**
 * API - VPN tunnel schema.
 *
 * Stores the two tunnel implementations accepted and returned by the API.
 * Request and response schemas reuse this closed vocabulary.
 *
 * @since 2.0.0
 */
const vpnTunnelSchema = z.enum([
  'openvpn',
  'wireguard',
]);

/**
 * API - VPN runtime state schema.
 *
 * Matches every controller transition exposed by stored and live connection
 * responses.
 *
 * @since 2.0.0
 */
const vpnRuntimeStateSchema = z.enum([
  'blocked',
  'connecting',
  'protected',
  'reconnecting',
]);

/**
 * API - VPN endpoint strategy schema.
 *
 * Shares the controller's closed endpoint selection vocabulary.
 * Stored configuration and runtime state use the same three values.
 *
 * @since 2.0.0
 */
const vpnEndpointStrategySchema = z.enum([
  'sticky',
  'ordered',
  'randomized',
]);

/**
 * API - VPN implementation schema.
 *
 * WireGuard reports whether the kernel or userspace engine is active.
 * OpenVPN omits this field.
 *
 * @since 2.0.0
 */
const vpnImplementationSchema = z.enum([
  'kernel',
  'userspace',
]);

/**
 * API - VPN daemon schema.
 *
 * Validates the per-connection Transmission process state returned with every
 * stored connection and live snapshot entry.
 *
 * @since 2.0.0
 */
const vpnDaemonSchema = z.object({
  state: z.enum([
    'starting',
    'ready',
    'exited',
    'missing',
  ]),
  rpcPort: z.number(),
  bindAddress: z.string(),
  peerPort: z.number(),
});

/**
 * API - VPN protection schema.
 *
 * Keeps the aggregate protection contract shared by status and live events in
 * one schema.
 *
 * @since 2.0.0
 */
const vpnProtectionSchema = z.object({
  state: z.enum([
    'protected',
    'partial',
    'blocked',
    'setup-required',
    'error',
  ]),
  protectedCount: z.number(),
  enabledCount: z.number(),
});

/**
 * API - Stored VPN runtime schema.
 *
 * The stored connection handler deliberately returns empty required fields for
 * unavailable controller values. Only implementation and handshake time are
 * omitted by the Go response type.
 *
 * @since 2.0.0
 */
const vpnConnectionRuntimeSchema = z.object({
  state: vpnRuntimeStateSchema,
  providerId: z.string(),
  tunnel: vpnTunnelSchema,
  profileId: z.string(),
  endpointPosition: z.number(),
  endpointCount: z.number(),
  endpointStrategy: vpnEndpointStrategySchema,
  interface: z.string(),
  implementation: vpnImplementationSchema.optional(),
  remoteHost: z.string(),
  remotePort: z.number(),
  address: z.string(),
  lastHandshakeAt: z.string().optional(),
  attempt: z.number(),
  lastError: z.string(),
  transitionedAt: z.string(),
});

/**
 * API - Live VPN connection schema.
 *
 * Status and event snapshots omit unavailable controller details but always
 * include durable identity, address, timing, and daemon state.
 *
 * @since 2.0.0
 */
const liveVpnConnectionSchema = z.object({
  connectionId: z.string(),
  name: z.string(),
  default: z.boolean(),
  enabled: z.boolean(),
  state: vpnRuntimeStateSchema,
  providerId: z.string().optional(),
  tunnel: vpnTunnelSchema.optional(),
  profileId: z.string().optional(),
  endpointPosition: z.number().optional(),
  endpointCount: z.number().optional(),
  endpointStrategy: vpnEndpointStrategySchema.optional(),
  interface: z.string().optional(),
  implementation: vpnImplementationSchema.optional(),
  remoteHost: z.string().optional(),
  remotePort: z.number().optional(),
  address: z.string(),
  lastHandshakeAt: z.string().optional(),
  attempt: z.number(),
  lastError: z.string().optional(),
  transitionedAt: z.string(),
  daemon: vpnDaemonSchema,
});

/**
 * API - Status schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const statusSchema = z.object({
  version: z.string(),
  schemaVersion: z.number(),
  configurationRevision: z.number(),
  claimed: z.boolean(),
  protectionState: z.enum([
    'protected',
    'partial',
    'blocked',
    'setup-required',
    'error',
  ]),
  protection: vpnProtectionSchema,
  connections: responseArraySchema(liveVpnConnectionSchema),
  runtime: z.object({
    configurationReady: z.boolean(),
    firewall: z.object({
      ready: z.boolean(),
      state: z.string(),
      interfaces: responseArraySchema(z.object({
        interface: z.string(),
        address: z.string(),
      })),
      backend: z.string().optional(),
      userId: z.number().optional(),
    }),
    services: z.record(z.string(), serviceStateSchema),
  }),
});

/**
 * API - VPN status schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const vpnStatusSchema = z.object({
  connectionId: z.string(),
  slot: z.number(),
  default: z.boolean(),
  state: vpnRuntimeStateSchema,
  providerId: z.string().optional(),
  tunnel: vpnTunnelSchema.optional(),
  profileId: z.string().optional(),
  endpointPosition: z.number().optional(),
  endpointCount: z.number().optional(),
  endpointStrategy: vpnEndpointStrategySchema.optional(),
  interface: z.string().optional(),
  implementation: vpnImplementationSchema.optional(),
  remoteHost: z.string().optional(),
  remotePort: z.number().optional(),
  address: z.string(),
  dnsServers: responseArraySchema(z.string()),
  lastHandshakeAt: z.string().optional(),
  attempt: z.number(),
  lastError: z.string().optional(),
  transitionedAt: z.string(),
  changeRunning: z.boolean(),
});

/**
 * API - Torrent schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const torrentSchema = z.object({
  activityDate: z.number(),
  addedDate: z.number(),
  connectionId: z.string(),
  downloadDir: z.string(),
  downloadedEver: z.number(),
  error: z.number(),
  errorString: z.string(),
  eta: z.number(),
  hashString: z.string(),
  id: z.number(),
  isFinished: z.boolean(),
  isPrivate: z.boolean(),
  isStalled: z.boolean(),
  labels: responseArraySchema(z.string()),
  leftUntilDone: z.number(),
  metadataPercentComplete: z.number(),
  name: z.string(),
  needsProfile: z.object({
    profileIds: responseArraySchema(z.string()),
  }).nullable(),
  peersConnected: z.number(),
  peersGettingFromUs: z.number(),
  peersSendingToUs: z.number(),
  percentDone: z.number(),
  profileId: z.string().nullable(),
  queuePosition: z.number(),
  rateDownload: z.number(),
  rateUpload: z.number(),
  recheckProgress: z.number(),
  sizeWhenDone: z.number(),
  status: z.number(),
  totalSize: z.number(),
  uploadedEver: z.number(),
  uploadRatio: z.number(),
}).loose();

/**
 * API - Torrent profile options response schema.
 *
 * Validates the complete application-owned profile returned by the control API.
 * The same schema is reused for list, create, and update responses.
 *
 * @since 2.0.0
 */
const torrentProfileOptionsResponseSchema = z.object({
  bandwidthPriority: z.union([
    z.literal(-1),
    z.literal(0),
    z.literal(1),
  ]),
  downloadLimitKBps: z.number().nullable(),
  peerLimit: z.number(),
  queue: z.enum([
    'normal',
    'top',
  ]),
  seeding: z.object({
    idleMinutes: z.number().nullable(),
    mode: z.enum([
      'limit',
      'never',
    ]),
    ratio: z.number().nullable(),
  }),
  uploadLimitKBps: z.number().nullable(),
});

/**
 * API - Torrent profile schema.
 *
 * Validates the complete application-owned named profile returned by the API.
 * Profile list, create, and update responses reuse this contract.
 *
 * @since 2.0.0
 */
const torrentProfileSchema: Web_Api_Schema<Web_Api_TorrentProfile> = z.object({
  connectionId: z.string().nullable(),
  createdAt: z.string(),
  downloadDirectory: z.string(),
  id: z.string(),
  labels: responseArraySchema(z.string()),
  matchPatterns: responseArraySchema(z.string()),
  name: z.string(),
  options: torrentProfileOptionsResponseSchema,
  overlaps: responseArraySchema(z.object({
    ownPattern: z.string(),
    pattern: z.string(),
    profileId: z.string(),
    profileName: z.string(),
  })),
  startPaused: z.boolean(),
  updatedAt: z.string(),
});

/**
 * API - Default torrent profile schema.
 *
 * Validates the complete Default profile returned with profile configuration.
 * Its folder lock and option defaults remain available to every profile screen.
 *
 * @since 2.0.0
 */
const defaultTorrentProfileSchema: Web_Api_Schema<Web_Api_DefaultTorrentProfile> = z.object({
  downloadDirectory: z.string().min(1),
  downloadDirectoryLocked: z.boolean(),
  labels: responseArraySchema(z.string()),
  name: z.string(),
  options: torrentProfileOptionsResponseSchema,
  startPaused: z.boolean(),
});

/**
 * API - Torrent profiles response schema.
 *
 * Validates the profile list envelope.
 * Nested profiles reuse the full response schemas above.
 *
 * @since 2.0.0
 */
const torrentProfilesResponseSchema = z.object({
  defaultProfile: defaultTorrentProfileSchema,
  profiles: responseArraySchema(torrentProfileSchema),
  folderOverlaps: responseArraySchema(z.object({
    profileId: z.string(),
    profileName: z.string(),
    message: z.string(),
  })).optional(),
});

/**
 * API - Torrent add result schema.
 *
 * Captures both newly-added and duplicate results from Transmission.
 * Callers use the duplicate flag to label each processed source.
 *
 * @since 2.0.0
 */
const torrentAddResultSchema: Web_Api_Schema<Web_Api_TorrentAddResult> = z.object({
  connectionName: z.string(),
  duplicate: z.boolean(),
  hash: z.string(),
  id: z.number(),
  name: z.string(),
  profileName: z.string(),
});

/**
 * API - Torrent link preview schema.
 *
 * Validates the metainfo fields resolved through the protected default route.
 * Magnet previews omit total size because their URI does not carry it.
 *
 * @since 2.0.0
 */
const torrentLinkPreviewSchema: Web_Api_Schema<Web_Api_TorrentLinkPreview> = z.object({
  hash: z.string().regex(/^[0-9a-f]{40}$/u),
  index: z.number().int().nonnegative(),
  name: z.string().min(1),
  totalSize: z.number().nonnegative().optional(),
});

/**
 * API - Torrent link preview response schema.
 *
 * Missing indexes intentionally represent quiet preview failures and retain the
 * console's URL-derived fallback name.
 *
 * @since 2.0.0
 */
const torrentLinkPreviewResponseSchema: Web_Api_Schema<Web_Api_TorrentLinkPreviewResponse> = z.object({
  items: responseArraySchema(torrentLinkPreviewSchema),
});

/**
 * API - Torrent list response schema.
 *
 * Validates an explicit torrent refresh used after organization-wide label
 * mutations.
 *
 * @since 2.0.0
 */
const torrentListResponseSchema: Web_Api_Schema<Web_Api_TorrentListResponse> = z.object({
  errors: responseArraySchema(z.string()),
  items: responseArraySchema(torrentSchema),
});

/**
 * API - Transmission free-space schema.
 *
 * Mirrors Transmission's free-space response without renaming its stable key.
 * The wrapper converts the byte value for display after parsing.
 *
 * @since 2.0.0
 */
const transmissionFreeSpaceSchema: Web_Api_Schema<Web_Api_TransmissionFreeSpace> = z.object({
  'size-bytes': z.number().nonnegative(),
});

/**
 * API - Torrent file schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const torrentFileSchema = z.object({
  bytesCompleted: z.number(),
  length: z.number(),
  name: z.string(),
});

/**
 * API - Torrent file stats schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const torrentFileStatsSchema = z.object({
  bytesCompleted: z.number(),
  priority: z.union([
    z.literal(-1),
    z.literal(0),
    z.literal(1),
  ]),
  wanted: z.boolean(),
});

/**
 * API - Torrent peer schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const torrentPeerSchema = z.object({
  address: z.string(),
  clientName: z.string(),
  flagStr: z.string(),
  isEncrypted: z.boolean(),
  isIncoming: z.boolean(),
  port: z.number(),
  progress: z.number(),
  rateToClient: z.number(),
  rateToPeer: z.number(),
}).loose();

/**
 * API - Torrent tracker schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const torrentTrackerSchema = z.object({
  announce: z.string(),
  id: z.number(),
  scrape: z.string(),
  sitename: z.string().optional(),
  tier: z.number(),
}).loose();

/**
 * API - Torrent tracker stats schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const torrentTrackerStatsSchema = z.object({
  announce: z.string(),
  downloadCount: z.number(),
  host: z.string(),
  id: z.number(),
  lastAnnounceResult: z.string(),
  lastAnnounceSucceeded: z.boolean(),
  leecherCount: z.number(),
  nextAnnounceTime: z.number(),
  seederCount: z.number(),
  sitename: z.string().optional(),
  tier: z.number(),
}).loose();

/**
 * API - Torrent detail schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const torrentDetailSchema = torrentSchema.extend({
  'availability': responseArraySchema(z.number()).optional(),
  'bandwidthPriority': z.union([
    z.literal(-1),
    z.literal(0),
    z.literal(1),
  ]).optional(),
  'comment': z.string().optional(),
  'creator': z.string().optional(),
  'dateCreated': z.number().optional(),
  'doneDate': z.number().optional(),
  'downloadLimit': z.number().optional(),
  'downloadLimited': z.boolean().optional(),
  'files': responseArraySchema(torrentFileSchema).optional(),
  'fileStats': responseArraySchema(torrentFileStatsSchema).optional(),
  'honorsSessionLimits': z.boolean().optional(),
  'magnetLink': z.string().optional(),
  'manualAnnounceTime': z.number().optional(),
  'maxConnectedPeers': z.number().optional(),
  'peer-limit': z.number().optional(),
  'peers': responseArraySchema(torrentPeerSchema).optional(),
  'peersFrom': z.record(z.string(), z.number()).optional(),
  'pieceCount': z.number().optional(),
  'pieceSize': z.number().optional(),
  'pieces': z.string().optional(),
  'priorities': responseArraySchema(z.union([
    z.literal(-1),
    z.literal(0),
    z.literal(1),
  ])).optional(),
  'secondsDownloading': z.number().optional(),
  'secondsSeeding': z.number().optional(),
  'seedIdleLimit': z.number().optional(),
  'seedIdleMode': z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
  ]).optional(),
  'seedRatioLimit': z.number().optional(),
  'seedRatioMode': z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
  ]).optional(),
  'startDate': z.number().optional(),
  'trackerList': z.string().optional(),
  'trackers': responseArraySchema(torrentTrackerSchema).optional(),
  'trackerStats': responseArraySchema(torrentTrackerStatsSchema).optional(),
  'uploadLimit': z.number().optional(),
  'uploadLimited': z.boolean().optional(),

  // Transmission sends wanted as 1 and 0 rather than true and false, so read either form.
  'wanted': responseArraySchema(z.union([
    z.boolean(),
    z.literal(0),
    z.literal(1),
  ]).transform((value: boolean | 0 | 1): boolean => value === true || value === 1)).optional(),
  'webseeds': responseArraySchema(z.string()).optional(),
}).loose();

/**
 * API - Statistics period schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const statisticsPeriodSchema = z.object({
  downloadedBytes: z.number(),
  filesAdded: z.number(),
  secondsActive: z.number(),
  sessionCount: z.number(),
  uploadedBytes: z.number(),
});

/**
 * API - Statistics schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const statisticsSchema = z.object({
  'activeTorrentCount': z.number(),
  'cumulative-stats': statisticsPeriodSchema,
  'current-stats': statisticsPeriodSchema,
  'downloadSpeed': z.number(),
  'pausedTorrentCount': z.number(),
  'torrentCount': z.number(),
  'uploadSpeed': z.number(),
}).loose();

/**
 * API - Blocklist source status schema.
 *
 * Validates one saved source's current result and optional last-good copy.
 * The parent status schema preserves the saved source order for the console.
 *
 * @since 2.0.0
 */
const blocklistSourceStatusSchema: Web_Api_Schema<Web_Api_BlocklistSourceStatus> = z.object({
  copyFrom: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  ranges: z.number().nonnegative(),
  state: z.enum([
    'ok',
    'error',
    'pending',
  ]),
  updatedAt: z.string().nullable().optional(),
  url: z.string(),
});

/**
 * API - Blocklist status schema.
 *
 * Validates the merger state displayed beside the global blocklist settings.
 * Null source lists are normalized like every other API response collection.
 *
 * @since 2.0.0
 */
const blocklistStatusSchema: Web_Api_Schema<Web_Api_BlocklistStatus> = z.object({
  lastAttemptAt: z.string().nullable().optional(),
  lastSuccessAt: z.string().nullable().optional(),
  nextUpdateAt: z.string().nullable().optional(),
  sources: responseArraySchema(blocklistSourceStatusSchema),
  state: z.enum([
    'idle',
    'updating',
    'waiting-for-vpn',
    'disabled',
    'no-sources',
  ]),
  totalRanges: z.number().nonnegative(),
});

/**
 * API - Setting schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const settingSchema = z.object({
  key: z.string(),
  category: z.string(),
  title: z.string(),
  description: z.string(),
  value: jsonValueSchema,
  defaultValue: jsonValueSchema,
  source: z.string(),
  locked: z.boolean(),
  valid: z.boolean(),
  applyImpact: z.enum([
    'live',
    'transmission-restart',
  ]),
});

/**
 * API - Settings schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const settingsSchema = z.object({
  revision: z.number(),
  settings: responseArraySchema(settingSchema),
  pendingRestartKeys: responseArraySchema(z.string()),
  runtimeApply: z.object({
    status: z.enum([
      'applied',
      'restart-required',
      'deferred',
      'partial',
    ]),
    appliedKeys: responseArraySchema(z.string()),
    pendingKeys: responseArraySchema(z.string()),
    connections: responseArraySchema(z.object({
      connectionId: z.string(),
      status: z.enum([
        'applied',
        'restart-required',
        'deferred',
      ]),
      appliedKeys: responseArraySchema(z.string()),
      pendingKeys: responseArraySchema(z.string()),
      error: z.string().optional(),
    })),
  }).optional(),
});

/**
 * API - Torrent organization schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const torrentOrganizationSchema = z.object({
  revision: z.number(),
  labels: responseArraySchema(z.string()),
});

/**
 * API - Torrent organization update response schema.
 *
 * Retains the changed-torrent count returned after label removals and renames.
 * The saved revision and normalized labels share the ordinary organization shape.
 *
 * @since 2.0.0
 */
const updateTorrentOrganizationResponseSchema: Web_Api_Schema<Web_Api_UpdateTorrentOrganizationResponse> = torrentOrganizationSchema.extend({
  changedTorrents: z.number().int().nonnegative(),
});

/**
 * API - Directory entry schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const directoryEntrySchema = z.object({
  browsable: z.boolean(),
  deletable: z.boolean(),
  deleteUnavailableReason: z.string().optional(),
  empty: z.boolean(),
  hasSubfolders: z.boolean(),
  name: z.string(),
  path: z.string(),
  selectable: z.boolean(),
  tags: responseArraySchema(z.string()),
  usable: z.boolean(),
  unusableReason: z.string().optional(),
});

/**
 * API - Directory schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const directorySchema: Web_Api_Schema<Web_Api_Directory> = z.object({
  downloadAllowed: z.boolean(),
  downloadUnavailableReason: z.string().optional(),
  path: z.string(),
  parentPath: z.string().optional(),
  directories: responseArraySchema(directoryEntrySchema),
});

/**
 * API - VPN connection schema.
 *
 * Covers the complete stored, runtime, daemon, and usage contract for one
 * independently managed connection.
 *
 * @since 2.0.0
 */
const vpnConnectionSchema: Web_Api_Schema<Web_Api_VpnConnection> = z.object({
  id: z.string(),
  name: z.string(),
  slot: z.number(),
  default: z.boolean(),
  enabled: z.boolean(),
  providerId: z.string(),
  tunnel: vpnTunnelSchema,
  profileIds: responseArraySchema(z.string()),
  endpointStrategy: vpnEndpointStrategySchema,
  dnsServers: responseArraySchema(z.string()),
  retryIntervalSeconds: z.number(),
  savedCredentials: responseArraySchema(z.string()),
  peerPort: z.number(),
  revision: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  runtime: vpnConnectionRuntimeSchema,
  daemon: vpnDaemonSchema,
  torrentCount: z.number(),
  changeRunning: z.boolean(),
  needsSetup: z.boolean(),
});

/**
 * API - VPN connections response schema.
 *
 * Validates the sorted collection and its resource-derived capacity metadata.
 * The global change flag gates create, delete, and default actions.
 *
 * @since 2.0.0
 */
const vpnConnectionsResponseSchema: Web_Api_Schema<Web_Api_VpnConnectionsResponse> = z.object({
  connections: responseArraySchema(vpnConnectionSchema),
  capacity: z.object({
    limit: z.number(),
    used: z.number(),
    memoryBytes: z.number(),
    cpus: z.number(),
    source: z.enum([
      'cgroup-v2',
      'cgroup-v1',
      'meminfo',
      'fallback',
    ]),
  }),
  changeRunning: z.boolean(),
});

/**
 * API - VPN connection response schema.
 *
 * Wraps create, read, update, reconnect, and disconnect responses exactly as
 * the connection routes return them.
 *
 * @since 2.0.0
 */
const vpnConnectionResponseSchema: Web_Api_Schema<Web_Api_VpnConnectionResponse> = z.object({
  connection: vpnConnectionSchema,
});

/**
 * API - Moved torrent schema.
 *
 * Describes both successful and failed moves shared by connection removal,
 * profile updates, and torrent reassignment responses.
 *
 * @since 2.0.0
 */
const movedTorrentSchema: Web_Api_Schema<Web_Api_MovedTorrent> = z.object({
  hash: z.string(),
  id: z.number().optional(),
  name: z.string(),
  result: z.enum([
    'moved',
    'already-there',
    'failed',
  ]),
  error: z.string().optional(),
  warnings: responseArraySchema(z.string()).optional(),
});

/**
 * API - VPN default response schema.
 *
 * Validates the updated connection list and every attempted Default-profile
 * torrent move returned after the default changes.
 *
 * @since 2.0.0
 */
const vpnDefaultResponseSchema: Web_Api_Schema<Web_Api_VpnDefaultResponse> = z.object({
  connections: responseArraySchema(vpnConnectionSchema),
  moved: responseArraySchema(movedTorrentSchema),
});

/**
 * API - Delete torrent profile response schema.
 *
 * Validates each move attempted after a named profile becomes Default.
 * Failed moves remain visible without treating the completed deletion as failed.
 *
 * @since 2.0.0
 */
const deleteTorrentProfileResponseSchema: Web_Api_Schema<Web_Api_DeleteTorrentProfileResponse> = z.object({
  moved: responseArraySchema(movedTorrentSchema),
});

/**
 * API - Delete VPN connection response schema.
 *
 * Validates the move results and the profile/login totals returned when a
 * non-default connection is removed.
 *
 * @since 2.0.0
 */
const deleteVpnConnectionResponseSchema: Web_Api_Schema<Web_Api_DeleteVpnConnectionResponse> = z.object({
  moved: responseArraySchema(movedTorrentSchema),
  profiles: z.number(),
  logins: z.number(),
});

/**
 * API - Torrent profile update response schema.
 *
 * Keeps the regular profile response while validating move results returned
 * after an owner confirms a cross-connection profile change.
 *
 * @since 2.0.0
 */
const torrentProfileUpdateResponseSchema: Web_Api_Schema<Web_Api_UpdateTorrentProfileResponse> = z.intersection(
  torrentProfileSchema,
  z.object({ moved: responseArraySchema(movedTorrentSchema) }),
);

/**
 * API - Default torrent profile update response schema.
 *
 * Adds per-torrent move results to the saved Default profile fields.
 * Callers can refresh profile state and render movement outcomes from one reply.
 *
 * @since 2.0.0
 */
const defaultTorrentProfileUpdateResponseSchema: Web_Api_Schema<Web_Api_UpdateDefaultTorrentProfileResponse> = z.intersection(
  defaultTorrentProfileSchema,
  z.object({ moved: responseArraySchema(movedTorrentSchema) }),
);

/**
 * API - Torrent profile assignment response schema.
 *
 * Validates identifiers and any cross-connection torrent moves produced by the
 * detail drawer's profile assignment action.
 *
 * @since 2.0.0
 */
const torrentProfileAssignmentResponseSchema: Web_Api_Schema<Web_Api_SetTorrentProfileResponse> = z.object({
  hashes: responseArraySchema(z.string()).optional(),
  ids: responseArraySchema(z.number()).optional(),
  profileId: z.string().nullable(),
  applyOptions: z.boolean(),
  moved: responseArraySchema(movedTorrentSchema),
});

/**
 * API - Transmission restart response schema.
 *
 * A restart is accepted per daemon, so the aggregate status and every
 * connection result are retained even when only part of the fleet restarts.
 *
 * @since 2.0.0
 */
const transmissionRestartResponseSchema: Web_Api_Schema<Web_Api_TransmissionRestartResponse> = z.object({
  status: z.enum([
    'restarting',
    'partial',
  ]),
  configurationRevision: z.number(),
  connections: responseArraySchema(z.object({
    connectionId: z.string(),
    status: z.enum([
      'restarting',
      'failed',
    ]),
    error: z.string().optional(),
  })),
});

/**
 * API - VPN catalog schema.
 *
 * Validates the catalog status nested beneath provider tunnels and returned by
 * a successful refresh.
 *
 * @since 2.0.0
 */
const vpnCatalogSchema = z.object({
  providerId: z.string(),
  tunnel: vpnTunnelSchema,
  sourceUrl: z.string(),
  endpointCount: z.number(),
  refreshedAt: z.string(),
});

/**
 * API - Provider tunnel schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const providerTunnelSchema = z.object({
  id: vpnTunnelSchema,
  description: z.string(),
  catalogSource: z.string(),
  supportsProfileUpload: z.boolean(),
  supportsCatalogRefresh: z.boolean(),
  credentialFields: responseArraySchema(z.object({
    key: z.string(),
    label: z.string(),
    kind: z.enum([
      'text',
      'password',
      'wireguard-key',
      'ipv4-address',
    ]),
    secret: z.boolean(),
    required: z.boolean(),
    description: z.string(),
  })),
  catalog: vpnCatalogSchema.optional(),
});

/**
 * API - Provider P2P schema.
 *
 * Reads a provider's note about which servers allow P2P traffic.
 * Only HTTPS links pass, since the console renders them as links.
 *
 * @since 2.0.0
 */
const providerP2PSchema = z.object({
  restricted: z.boolean(),
  note: z.string(),
  linkLabel: z.string(),
  url: z.string().startsWith('https://'),
});

/**
 * API - Provider schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const providerSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  description: z.string(),
  supportsPortForwarding: z.boolean(),
  p2p: providerP2PSchema.nullable(),
  tunnels: responseArraySchema(providerTunnelSchema),
});

/**
 * API - VPN profile schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const vpnProfileSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  tunnel: vpnTunnelSchema,
  displayName: z.string(),
  countryCode: z.string(),
  country: z.string(),
  city: z.string(),
  continent: z.string(),
  protocol: z.string(),
  remoteHost: z.string(),
  remotePort: z.number(),
  fingerprint: z.string(),
  source: z.string(),
  updatedAt: z.string(),
});

/**
 * API - Custom profile response schema.
 *
 * Keeps the first endpoint flattened for compatibility and validates the full
 * ordered pool selected by the current console.
 *
 * @since 2.0.0
 */
const customProfileResponseSchema: Web_Api_Schema<Web_Api_CustomProfileResponse> = vpnProfileSchema.extend({
  profiles: responseArraySchema(vpnProfileSchema),
});

/**
 * API - Scope schema.
 *
 * Encapsulates the related behavior behind one reusable interface.
 * Callers share the same lifecycle and state management.
 *
 * @since 2.0.0
 */
const scopeSchema: Web_Api_Schema<Web_Api_Scope> = z.enum([
  'settings:read',
  'settings:write',
  'torrents:read',
  'torrents:write',
  'vpn:read',
  'vpn:write',
]);

/**
 * API - Token schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const tokenSchema: Web_Api_Schema<Web_Api_Token> = z.object({
  id: z.string(),
  name: z.string(),
  scopes: responseArraySchema(scopeSchema),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
});

/**
 * API - Error envelope schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const errorEnvelopeSchema: Web_Api_Schema<Web_Api_ErrorEnvelope> = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
    issues: responseArraySchema(z.object({
      field: z.string(),
      path: responseArraySchema(z.string()),
      message: z.string(),
    })).optional(),
  }),
});

/**
 * API - Setup status schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const setupStatusSchema: Web_Api_Schema<Web_Api_SetupStatus> = z.object({
  claimRequired: z.boolean(),
  claimExpiresAt: z.string().optional(),
});

/**
 * API - Removed secret schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const removedSecretSchema: Web_Api_Schema<Web_Api_RemovedSecret> = z.object({
  kind: z.enum([
    'authenticator',
    'notification',
    'vpn',
  ]),
  name: z.string().optional(),
  notificationId: z.string().optional(),
  removedAt: z.string(),
});

/**
 * API - Administrator schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const administratorSchema: Web_Api_Schema<Web_Api_Administrator> = z.object({
  authenticationType: z.enum([
    'session',
    'token',
  ]),
  id: z.string(),
  administratorId: z.number().optional(),
  username: z.string().optional(),
  name: z.string().optional(),
  scopes: responseArraySchema(z.string()).optional(),
  removedSecrets: responseArraySchema(removedSecretSchema).optional(),
});

/**
 * API - Authentication response schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const authenticationResponseSchema: Web_Api_Schema<Web_Api_AuthenticationResponse> = z.object({
  status: z.literal('authenticated'),
  administrator: z.object({
    id: z.number(),
    username: z.string(),
  }),
  csrfToken: z.string(),
  expiresAt: z.string(),
});

/**
 * API - Login result schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const loginResultSchema: Web_Api_Schema<Web_Api_LoginResult> = z.union([
  authenticationResponseSchema,
  z.object({
    status: z.literal('second_factor_required'),
    challenge: z.string(),
    expiresAt: z.string(),
  }),
]);

/**
 * API - Passkey schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const passkeySchema: Web_Api_Schema<Web_Api_Passkey> = z.object({
  id: z.string(),
  name: z.string(),
  hostname: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
});

/**
 * API - Account security schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const accountSecuritySchema: Web_Api_Schema<Web_Api_AccountSecurity> = z.object({
  username: z.string(),
  totpEnabled: z.boolean(),
  recoveryCodesRemaining: z.number(),
  passkeys: responseArraySchema(passkeySchema),
  passkeysAvailable: z.boolean(),
  hostname: z.string(),
});

/**
 * API - TOTP setup schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const totpSetupSchema: Web_Api_Schema<Web_Api_TotpSetup> = z.object({
  secret: z.string(),
  uri: z.string(),
  qrCode: z.string(),
});

/**
 * API - Recovery codes schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const recoveryCodesSchema: Web_Api_Schema<Web_Api_RecoveryCodes> = z.object({
  recoveryCodes: responseArraySchema(z.string()),
});

/**
 * API - Passkey ceremony schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const passkeyCeremonySchema: Web_Api_Schema<Web_Api_PasskeyCeremony> = z.object({
  ceremonyId: z.string(),
  options: z.record(z.string(), z.unknown()),
});

/**
 * API - Live snapshot schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const liveSnapshotSchema: Web_Api_Schema<Web_Api_LiveSnapshot> = z.object({
  sequence: z.number(),
  capturedAt: z.string(),
  status: statusSchema.optional(),
  vpn: vpnStatusSchema.optional(),
  connections: responseArraySchema(liveVpnConnectionSchema),
  protection: vpnProtectionSchema,
  statistics: statisticsSchema.optional(),
  torrents: responseArraySchema(torrentSchema),
  organizationRevision: z.number(),
  errors: responseArraySchema(z.string()),
});

/**
 * API - Providers response schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const providersResponseSchema = z.object({
  items: responseArraySchema(providerSchema),
});

/**
 * API - Profiles response schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const profilesResponseSchema = z.object({
  items: responseArraySchema(vpnProfileSchema),
});

/**
 * API - Tokens response schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const tokensResponseSchema = z.object({
  items: responseArraySchema(tokenSchema),
});

/**
 * API - Created token schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const createdTokenSchema: Web_Api_Schema<Web_Api_CreatedToken> = z.object({
  token: tokenSchema,
  plaintext: z.string(),
});

/**
 * API - RPC login schema.
 *
 * Describes one independently revocable Transmission-compatible RPC login.
 * Password material is intentionally absent from list responses.
 *
 * @since 2.0.0
 */
const rpcLoginSchema: Web_Api_Schema<Web_Api_RPCLogin> = z.object({
  id: z.string(),
  username: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
});

/**
 * API - RPC credential schema.
 *
 * A generated password is present only in the create or regenerate response.
 * The surrounding login metadata always uses the safe schema above.
 *
 * @since 2.0.0
 */
const rpcCredentialSchema: Web_Api_Schema<Web_Api_RPCCredential> = z.object({
  login: rpcLoginSchema,
  password: z.string().optional(),
});

/**
 * API - RPC logins response schema.
 *
 * Wraps the login list using the backend response contract.
 * Keeping the wrapper explicit prevents response-shape drift.
 *
 * @since 2.0.0
 */
const rpcLoginsResponseSchema = z.object({
  logins: responseArraySchema(rpcLoginSchema),
});

/**
 * API - Web proxy login schema.
 *
 * Describes a login without returning its stored password verifier.
 * PasswordSet communicates usability without exposing a secret.
 *
 * @since 2.0.0
 */
const webProxyLoginSchema: Web_Api_Schema<Web_Api_WebProxyLogin> = z.object({
  id: z.string(),
  username: z.string(),
  passwordSet: z.boolean(),
  connectionId: z.string().nullable(),
  effectiveConnectionId: z.string(),
});

/**
 * API - Web proxy credential schema.
 *
 * A generated password is present only in the create or regenerate response.
 * The surrounding login metadata always uses the safe schema above.
 *
 * @since 2.0.0
 */
const webProxyCredentialSchema: Web_Api_Schema<Web_Api_WebProxyCredential> = z.object({
  login: webProxyLoginSchema,
  password: z.string().optional(),
});

/**
 * API - Web proxy schema.
 *
 * Combines desired state, observed runtime state, and login metadata.
 * The state enum matches every value emitted by the proxy process.
 *
 * @since 2.0.0
 */
const webProxySchema: Web_Api_Schema<Web_Api_WebProxy> = z.object({
  enabled: z.boolean(),
  port: z.number(),
  state: z.enum([
    'off',
    'listening',
    'waiting-for-vpn',
    'error',
  ]),
  error: z.string().optional(),
  logins: responseArraySchema(webProxyLoginSchema),
});

/**
 * API - Notification target schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const notificationTargetSchema: Web_Api_Schema<Web_Notifications_Target> = z.object({
  createdAt: z.string(),
  events: responseArraySchema(z.string()),
  id: z.string(),
  lastAttemptAt: z.string().nullable(),
  lastError: z.string().nullable(),
  lastErrorDetails: z.string().nullable(),
  name: z.string(),
  secrets: z.record(z.string(), z.literal(true)),
  secretsMissing: responseArraySchema(z.string()),
  service: z.enum([
    'apprise',
    'discord',
    'email',
    'gotify',
    'matrix',
    'ntfy',
    'ntfy-reverse-proxy',
    'pushover',
    'slack',
    'telegram',
    'webhook',
  ]),
  settings: z.record(z.string(), z.string()),
  updatedAt: z.string(),
});

/**
 * API - Notification targets response schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const notificationTargetsResponseSchema = z.object({
  items: responseArraySchema(notificationTargetSchema),
});

/**
 * API - Notification events response schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const notificationEventsResponseSchema = z.object({
  items: responseArraySchema(z.object({
    defaultEnabled: z.boolean(),
    description: z.string(),
    key: z.string(),
    label: z.string(),
  })),
});

/**
 * API - Notification test schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const notificationTestSchema: Web_Api_Schema<Web_Notifications_TestResult> = z.object({
  delivered: z.boolean(),
  details: z.string().optional(),
  message: z.string().optional(),
});

// requestJSON performs one same-origin request and validates its response contract.

/**
 * API - Request JSON.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const requestJSON = async <ResponseValue>(
  path: string,
  schema: Web_Api_Schema<ResponseValue>,
  options: Web_Api_Request_Options = {},
): Promise<ResponseValue> => {
  const { body: requestBody, ...baseOptions } = options;
  const headers: Headers = new Headers(options.headers);
  if (requestBody !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.method !== undefined && options.method !== 'GET' && options.method !== 'HEAD') {
    const csrfToken: string | undefined = readCookie('tvpn_csrf');
    if (csrfToken !== undefined) {
      headers.set('X-CSRF-Token', csrfToken);
    }
  }

  const requestOptions: RequestInit = {
    ...baseOptions,
    credentials: 'same-origin',
    headers,
  };
  if (requestBody !== undefined) {
    requestOptions.body = JSON.stringify(requestBody);
  }
  const response: Response = await fetch(path, requestOptions);
  if (!response.ok) {
    throw await responseError(response);
  }

  const responseValue: unknown = await response.json();
  const parsedResponse = schema.safeParse(responseValue);

  // A request can succeed even when its reply doesn't match, so point to a reload rather than a retry.
  if (!parsedResponse.success) {
    throw new ApiError('The server\'s reply couldn\'t be read. Reload the page to see the latest state.', 'invalid_response', response.status, []);
  }

  return parsedResponse.data;
};

// requestVoid performs one mutation whose successful response has no body.

/**
 * API - Request void.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const requestVoid = async (
  path: string,
  options: Web_Api_Request_Options,
): Promise<void> => {
  const { body: requestBody, ...baseOptions } = options;
  const headers: Headers = new Headers(options.headers);
  const csrfToken: string | undefined = readCookie('tvpn_csrf');
  if (csrfToken !== undefined) {
    headers.set('X-CSRF-Token', csrfToken);
  }
  if (requestBody !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const requestOptions: RequestInit = {
    ...baseOptions,
    credentials: 'same-origin',
    headers,
  };
  if (requestBody !== undefined) {
    requestOptions.body = JSON.stringify(requestBody);
  }

  const response: Response = await fetch(path, requestOptions);
  if (!response.ok) {
    throw await responseError(response);
  }
};

/**
 * API.
 *
 * Keeps the machine-readable code and field issues from the shared error envelope so
 * screens can react to specific failures and highlight the right field.
 *
 * @since 2.0.0
 */
export class ApiError extends Error {
  /**
   * API - Code.
   *
   * Stores this module-level value in one named location.
   * Related code reuses it instead of duplicating the definition.
   *
   * @since 2.0.0
   */
  public readonly code: string;

  /**
   * API - Status.
   *
   * Stores this module-level value in one named location.
   * Related code reuses it instead of duplicating the definition.
   *
   * @since 2.0.0
   */
  public readonly status: number;

  /**
   * API - Issues.
   *
   * Stores this module-level value in one named location.
   * Related code reuses it instead of duplicating the definition.
   *
   * @since 2.0.0
   */
  public readonly issues: Web_Api_ErrorIssue[];

  /**
   * API - Details.
   *
   * Preserves route-specific conflict metadata used by move confirmations and
   * partial-failure summaries without weakening the stable error envelope.
   *
   * @since 2.0.0
   */
  public readonly details: Record<string, unknown>;

  /**
   * API - Constructor.
   *
   * Stores this module-level value in one named location.
   * Related code reuses it instead of duplicating the definition.
   *
   * @since 2.0.0
   */
  public constructor(
    message: string,
    code: string,
    status: number,
    issues: Web_Api_ErrorIssue[],
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.issues = issues;
    this.details = details;
  }
}

/**
 * API - Is VPN connection required error.
 *
 * Lets add surfaces pair first-run guidance with navigation to the VPN page.
 * Other API failures remain ordinary errors.
 *
 * @since 2.0.0
 */
export const isVPNConnectionRequiredError = (caughtError: unknown): boolean => (
  caughtError instanceof ApiError && caughtError['code'] === 'vpn_connection_required'
);

// issueFor returns the message the API attached to one form field, if any.

/**
 * API - Issue for.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const issueFor = (caughtError: unknown, field: string): string => {
  if (!(caughtError instanceof ApiError)) {
    return '';
  }

  const issue: Web_Api_ErrorIssue | undefined = caughtError.issues.find(
    (candidate: Web_Api_ErrorIssue): boolean => candidate['field'] === field,
  );

  return (issue === undefined) ? '' : formatConsoleError(issue['message']);
};

// summaryFor returns the banner text for an error, or nothing when a shown field already carries it.

/**
 * API - Summary for.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const summaryFor = (caughtError: unknown, shownFields: string[], fallback: string): string => {
  if (caughtError === null || caughtError === undefined) {
    return '';
  }

  if (caughtError instanceof ApiError && caughtError.issues.some(
    (issue: Web_Api_ErrorIssue): boolean => shownFields.includes(issue['field']),
  )) {
    return '';
  }

  if (caughtError instanceof DOMException && caughtError.name === 'NotAllowedError') {
    return 'The passkey prompt was closed before it finished.';
  }

  if (caughtError instanceof DOMException && caughtError.name === 'InvalidStateError') {
    return 'This device already has a passkey for this account.';
  }

  return (caughtError instanceof Error) ? formatConsoleError(caughtError.message) : fallback;
};

/**
 * API - Message for API error.
 *
 * Converts stable machine codes into console wording that names the field or
 * choice the owner can correct. Controller diagnostics and resource IDs never
 * become user-visible text.
 *
 * @since 2.0.0
 */
export const messageForAPIError = (
  code: string,
  status: number,
  message: string,
  details: Record<string, unknown> = {},
): string => {
  const normalizedMessage: string = message.toLowerCase();
  if (status === 503 && normalizedMessage.includes('transmission') && normalizedMessage.includes('still starting')) {
    return formatConsoleError(message);
  }

  switch (code) {
    case 'capacity_reached': {
      const limit: unknown = details['limit'];
      if (typeof limit === 'number' && Number.isFinite(limit)) {
        return `This container allows up to ${String(limit)} VPN connections. Remove one before adding another.`;
      }

      return 'This container has reached its VPN connection limit. Remove one before adding another.';
    }
    case 'name_taken': {
      return 'Enter a different connection name. That name is already in use.';
    }
    case 'vpn_test_failed': {
      return formatConsoleError(message);
    }
    case 'revision_conflict': {
      return 'This page is out of date. Reload it, then try again.';
    }
    case 'change_running': {
      return 'Wait for the current VPN connection change to finish, then try again.';
    }
    case 'default_connection': {
      return 'Choose a different default VPN connection before removing this one.';
    }
    case 'connection_in_use': {
      return 'Choose where to move this connection\'s torrents, profiles, and proxy logins before removing it.';
    }
    case 'connection_being_removed': {
      return 'The selected connection is being removed. Pick another connection.';
    }
    case 'move_failed': {
      return 'One or more torrents couldn\'t be moved. The VPN connection was kept.';
    }
    case 'torrents_must_move': {
      if (
        message.endsWith('\'s torrents must move to its download folder.')
        || message.endsWith('\'s torrents must move to the new default VPN connection.')
        || (
          message.startsWith('The profile\'s torrents must move to ')
          && message.endsWith(' before it can be deleted.')
        )
        || message === 'The profile\'s torrents must move to its selected VPN connection and download folder.'
      ) {
        return message;
      }

      return 'Confirm moving this profile\'s torrents to its selected VPN connection.';
    }
    case 'torrent_not_found': {
      return 'One or more selected torrents are no longer available. Refresh the list and try again.';
    }
    case 'daemon_unavailable': {
      return 'Transmission isn\'t ready for the selected VPN connection. Wait a moment and try again.';
    }
    case 'vpn_connection_required': {
      return 'Add a VPN connection before adding torrents.';
    }
    case 'web_proxy_connection_invalid': {
      return 'Choose an existing VPN connection, or set up a default connection first.';
    }
    default: {
      return formatConsoleError(message);
    }
  }
};

/**
 * API - Connection being removed message.
 *
 * Adds the console's visible connection name to the backend's stable conflict.
 * Mutation screens use it without exposing the machine-readable error code.
 *
 * @param {unknown} caughtError    - Caught error.
 * @param {string}  connectionName - Connection name.
 *
 * @returns {string | null}
 *
 * @since 2.0.0
 */
export const connectionBeingRemovedMessage = (
  caughtError: unknown,
  connectionName: string,
): string | null => {
  if (!(caughtError instanceof ApiError) || caughtError['code'] !== 'connection_being_removed') {
    return null;
  }

  return `${connectionName} is being removed. Pick another connection.`;
};

// responseError converts the stable API error envelope into an ApiError.

/**
 * API - Response error.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const responseError = async (response: Response): Promise<ApiError> => {
  const responseValue: unknown = await response.json().catch(() => undefined);
  const parsedError = errorEnvelopeSchema.safeParse(responseValue);
  if (parsedError.success) {
    const details: Record<string, unknown> = parsedError.data['error']['details'] ?? {};
    return new ApiError(
      messageForAPIError(
        parsedError.data['error']['code'],
        response.status,
        parsedError.data['error']['message'],
        details,
      ),
      parsedError.data['error']['code'],
      response.status,
      parsedError.data['error']['issues'] ?? [],
      details,
    );
  }

  return new ApiError(`Request failed with status ${response.status}.`, 'request_failed', response.status, []);
};

// readCookie returns one non-HTTP-only same-origin cookie.

/**
 * API - Reads cookie.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const readCookie = (name: string): string | undefined => {
  const prefix: string = `${name}=`;
  const parts: string[] = document.cookie.split(';');
  const matchingPart: string | undefined = parts
    .map((part: string): string => part.trim())
    .find((part: string): boolean => part.startsWith(prefix));

  return (matchingPart === undefined) ? undefined : decodeURIComponent(matchingPart.slice(prefix.length));
};

/**
 * API - Gets setup status.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const getSetupStatus = async (): Promise<Web_Api_SetupStatus> => requestJSON(
  '/api/v1/setup/status',
  setupStatusSchema,
);

/**
 * API - Gets current administrator.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const getCurrentAdministrator = async (): Promise<Web_Api_Administrator | null> => {
  const response: Response = await fetch('/api/v1/auth/me', {
    credentials: 'same-origin',
  });
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw await responseError(response);
  }

  const responseValue: unknown = await response.json();

  return administratorSchema.parse(responseValue);
};

/**
 * API - Claim installation.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const claimInstallation = async (
  input: Web_Api_ClaimInput,
): Promise<Web_Api_AuthenticationResponse> => {
  const validatedInput: Web_Api_ClaimInput = parseClaimInput(input);

  return requestJSON(
    '/api/v1/setup/claim',
    authenticationResponseSchema,
    {
      method: 'POST',
      body: validatedInput,
    },
  );
};

/**
 * API - Login.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const login = async (
  input: Web_Api_LoginInput,
): Promise<Web_Api_LoginResult> => {
  const validatedInput: Web_Api_LoginInput = parseLoginInput(input);

  return requestJSON(
    '/api/v1/auth/login',
    loginResultSchema,
    {
      method: 'POST',
      body: validatedInput,
    },
  );
};

/**
 * API - Logout.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const logout = async (): Promise<void> => requestVoid(
  '/api/v1/auth/logout',
  { method: 'POST' },
);

/**
 * API - Dismiss removed secrets.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const dismissRemovedSecrets = async (): Promise<void> => requestVoid(
  '/api/v1/auth/removed-secrets',
  { method: 'DELETE' },
);

/**
 * API - Gets blocklist status.
 *
 * Reads the merger's aggregate and per-source state for the Settings page.
 * Response parsing keeps unexpected null source lists safe for rendering.
 *
 * @returns {Promise<Web_Api_BlocklistStatus>}
 *
 * @since 2.0.0
 */
export const getBlocklistStatus = async (): Promise<Web_Api_BlocklistStatus> => requestJSON(
  '/api/v1/blocklists',
  blocklistStatusSchema,
);

/**
 * API - Requests blocklist update.
 *
 * Queues one merger run and accepts the endpoint's empty 202 response.
 * The Settings page polls status until the requested run is observed.
 *
 * @returns {Promise<void>}
 *
 * @since 2.0.0
 */
export const requestBlocklistUpdate = async (): Promise<void> => requestVoid(
  '/api/v1/blocklists/update',
  { method: 'POST' },
);

/**
 * API - Gets settings.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const getSettings = async (): Promise<Web_Api_SettingsSnapshot> => requestJSON(
  '/api/v1/settings',
  settingsSchema,
);

/**
 * API - Update settings.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const updateSettings = async (
  input: Web_Api_UpdateSettingsInput,
  incompleteDirectory?: string,
): Promise<Web_Api_SettingsSnapshot> => {
  const validatedInput: Web_Api_UpdateSettingsInput = parseUpdateSettingsInput(
    input,
    incompleteDirectory,
  );

  return requestJSON(
    '/api/v1/settings',
    settingsSchema,
    {
      method: 'PUT',
      body: validatedInput,
    },
  );
};

/**
 * API - Restarts Transmission.
 *
 * Applies pending restart settings after an explicit confirmation from the settings view.
 * The caller refreshes settings after the accepted restart request.
 *
 * @since 2.0.0
 */
export const restartTransmission = async (): Promise<void> => {
  await requestJSON(
    '/api/v1/transmission/restart',
    transmissionRestartResponseSchema,
    {
      method: 'POST',
      body: { confirm: true },
    },
  );
};

/**
 * API - Gets torrent organization.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const getTorrentOrganization = async (): Promise<Web_Api_TorrentOrganization> => requestJSON(
  '/api/v1/torrent-organization',
  torrentOrganizationSchema,
);

/**
 * API - Update torrent organization.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const updateTorrentOrganization = async (
  input: Web_Api_UpdateTorrentOrganizationInput,
): Promise<Web_Api_UpdateTorrentOrganizationResponse> => {
  const validatedInput: Web_Api_UpdateTorrentOrganizationInput = parseUpdateTorrentOrganizationInput(input);

  return requestJSON(
    '/api/v1/torrent-organization',
    updateTorrentOrganizationResponseSchema,
    {
      method: 'PUT',
      body: validatedInput,
    },
  );
};

/**
 * API - Gets torrent profiles.
 *
 * Returns the effective Default profile and alphabetically sorted named profiles.
 * Pattern matching can therefore report every match without using display order.
 *
 * @since 2.0.0
 */
export const getTorrentProfiles = async (): Promise<Web_Api_TorrentProfilesResponse> => requestJSON(
  '/api/v1/torrent-profiles',
  torrentProfilesResponseSchema,
);

/**
 * API - Creates torrent profile.
 *
 * Validates editor values before creating a server-owned profile.
 * The returned profile includes its generated identity and pattern overlaps.
 *
 * @since 2.0.0
 */
export const createTorrentProfile = async (
  input: Web_Api_TorrentProfileInput,
  incompleteDirectory?: string,
): Promise<Web_Api_TorrentProfile> => {
  const validatedInput: Web_Api_TorrentProfileInput = parseTorrentProfileInput(
    input,
    incompleteDirectory,
  );

  return requestJSON(
    '/api/v1/torrent-profiles',
    torrentProfileSchema,
    {
      body: validatedInput,
      method: 'POST',
    },
  );
};

/**
 * API - Updates torrent profile.
 *
 * Replaces the editable values of one existing profile.
 * Identity remains controlled by the server; named profiles display alphabetically.
 *
 * @since 2.0.0
 */
export const updateTorrentProfile = async (
  profileId: string,
  input: Web_Api_TorrentProfileInput,
  moveTorrents: boolean = false,
  incompleteDirectory?: string,
): Promise<Web_Api_UpdateTorrentProfileResponse> => {
  const updateInput: Web_Api_UpdateTorrentProfileInput = {
    ...input,
    ...((moveTorrents) ? { moveTorrents: true as const } : {}),
  };
  const validatedInput: Web_Api_UpdateTorrentProfileInput = parseUpdateTorrentProfileInput(
    updateInput,
    incompleteDirectory,
  );

  return requestJSON(
    `/api/v1/torrent-profiles/${encodeURIComponent(profileId)}`,
    torrentProfileUpdateResponseSchema,
    {
      body: validatedInput,
      method: 'PUT',
    },
  );
};

/**
 * API - Updates the Default torrent profile.
 *
 * Saves the Default profile fields and optionally confirms moving its assigned
 * torrents when the download directory changes.
 *
 * @since 2.0.0
 */
export const updateDefaultTorrentProfile = async (
  input: Web_Api_DefaultTorrentProfileInput,
  moveTorrents: boolean = false,
  incompleteDirectory?: string,
): Promise<Web_Api_UpdateDefaultTorrentProfileResponse> => {
  const updateInput: Web_Api_UpdateDefaultTorrentProfileInput = {
    ...input,
    ...((moveTorrents) ? { moveTorrents: true as const } : {}),
  };
  const validatedInput: Web_Api_UpdateDefaultTorrentProfileInput = parseUpdateDefaultTorrentProfileInput(
    updateInput,
    incompleteDirectory,
  );

  return requestJSON(
    '/api/v1/torrent-profiles/default',
    defaultTorrentProfileUpdateResponseSchema,
    {
      body: validatedInput,
      method: 'PUT',
    },
  );
};

/**
 * API - Deletes torrent profile.
 *
 * Confirms moving assigned torrents through the Default profile's existing
 * folder and connection path without applying its labels or limits.
 *
 * @since 2.0.0
 */
export const deleteTorrentProfile = async (
  profileId: string,
  moveTorrents: boolean = false,
): Promise<Web_Api_DeleteTorrentProfileResponse> => {
  const path: string = `/api/v1/torrent-profiles/${encodeURIComponent(profileId)}`;
  if (!moveTorrents) {
    await requestVoid(path, { method: 'DELETE' });

    return { moved: [] };
  }

  const input: Web_Api_DeleteTorrentProfileInput = { moveTorrents: true };

  return requestJSON(
    path,
    deleteTorrentProfileResponseSchema,
    {
      body: input,
      method: 'DELETE',
    },
  );
};

/**
 * API - Gets directory.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const getDirectory = async (
  path: string,
  purpose: Web_Api_DirectoryPurpose = 'download',
  profileId?: string,
): Promise<Web_Api_Directory> => {
  const validatedPath: string = parseDataPath(path);
  const query: string = new URLSearchParams({
    path: validatedPath,
    purpose,
  }).toString();
  const searchParameters: URLSearchParams = new URLSearchParams(query);
  if (profileId !== undefined) {
    searchParameters.set('profileId', profileId);
  }

  return requestJSON(`/api/v1/storage/directories?${searchParameters.toString()}`, directorySchema);
};

/**
 * API - Deletes directory.
 *
 * Removes one empty, unassigned folder after the server repeats every safety
 * check. Success has no response body, so callers refresh the parent listing.
 *
 * @param {string}                   path    - Path.
 * @param {Web_Api_DirectoryPurpose} purpose - Purpose.
 *
 * @returns {Promise<void>}
 *
 * @since 2.0.0
 */
export const deleteDirectory = async (
  path: string,
  purpose: Web_Api_DirectoryPurpose = 'download',
  profileId?: string,
): Promise<void> => {
  const validatedPath: string = parseDataPath(path);
  const query: string = new URLSearchParams({
    path: validatedPath,
    purpose,
  }).toString();
  const searchParameters: URLSearchParams = new URLSearchParams(query);
  if (profileId !== undefined) {
    searchParameters.set('profileId', profileId);
  }

  return requestVoid(
    `/api/v1/storage/directories?${searchParameters.toString()}`,
    { method: 'DELETE' },
  );
};

/**
 * API - Gets Transmission free space.
 *
 * Returns the available byte count for one validated data path.
 * A caller may hide this optional information if the request fails.
 *
 * @since 2.0.0
 */
export const getTransmissionFreeSpace = async (path: string): Promise<number> => {
  const validatedPath: string = parseDataPath(path);
  const query: string = new URLSearchParams({ path: validatedPath }).toString();
  const response: Web_Api_TransmissionFreeSpace = await requestJSON(
    `/api/v1/transmission/free-space?${query}`,
    transmissionFreeSpaceSchema,
  );

  return response['size-bytes'];
};

/**
 * API - Create directory.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const createDirectory = async (
  input: Web_Api_CreateDirectoryInput,
  purpose: Web_Api_DirectoryPurpose = 'download',
  profileId?: string,
): Promise<Web_Api_Directory> => {
  const validatedInput: Web_Api_CreateDirectoryInput = parseCreateDirectoryInput(input);
  const searchParameters: URLSearchParams = new URLSearchParams({ purpose });
  if (profileId !== undefined) {
    searchParameters.set('profileId', profileId);
  }

  return requestJSON(
    `/api/v1/storage/directories?${searchParameters.toString()}`,
    directorySchema,
    {
      method: 'POST',
      body: validatedInput,
    },
  );
};

/**
 * API - Gets providers.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const getProviders = async (): Promise<Web_Api_Provider[]> => {
  const response = await requestJSON('/api/v1/vpn/providers', providersResponseSchema);

  return response['items'];
};

/**
 * API - Gets VPN connections.
 *
 * Reads every stored connection with runtime, daemon, usage, and capacity state.
 * The server returns rows in slot order for a stable list.
 *
 * @since 2.0.0
 */
export const getVPNConnections = async (): Promise<Web_Api_VpnConnectionsResponse> => requestJSON(
  '/api/v1/vpn/connections',
  vpnConnectionsResponseSchema,
);

/**
 * API - Gets VPN connection.
 *
 * Reads one connection when a direct editor refresh needs the latest revision.
 * The collection remains the source for capacity and list ordering.
 *
 * @since 2.0.0
 */
export const getVPNConnection = async (connectionId: string): Promise<Web_Api_VpnConnection> => {
  const validatedConnectionID: string = parseProviderID(connectionId);
  const response: Web_Api_VpnConnectionResponse = await requestJSON(
    `/api/v1/vpn/connections/${encodeURIComponent(validatedConnectionID)}`,
    vpnConnectionResponseSchema,
  );

  return response['connection'];
};

/**
 * API - Gets profiles.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const getProfiles = async (providerId: string): Promise<Web_Api_VpnProfile[]> => {
  const validatedProviderID: string = parseProviderID(providerId);
  const query: string = new URLSearchParams({ provider: validatedProviderID }).toString();
  const response = await requestJSON(`/api/v1/vpn/profiles?${query}`, profilesResponseSchema);

  return response['items'];
};

/**
 * API - Upload custom profile.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const uploadCustomProfile = async (
  tunnel: Web_Api_VpnTunnel,
  profileName: string,
  profile: string,
): Promise<Web_Api_VpnProfile[]> => {
  const validatedInput: Web_Api_CustomProfileInput = parseCustomProfileInput({
    tunnel,
    profileName,
    profile,
  });

  const response: Web_Api_CustomProfileResponse = await requestJSON(
    '/api/v1/vpn/profiles/custom',
    customProfileResponseSchema,
    {
      method: 'POST',
      body: validatedInput,
    },
  );

  return response['profiles'];
};

/**
 * API - Refresh VPN catalog.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const refreshVPNCatalog = async (providerId: string, tunnel: Web_Api_VpnTunnel): Promise<void> => {
  const validatedProviderID: string = parseProviderID(providerId);
  const validatedTunnel: Web_Api_VpnTunnel = vpnTunnelSchema.parse(tunnel);

  await requestJSON(
    `/api/v1/vpn/providers/${encodeURIComponent(validatedProviderID)}/tunnels/${validatedTunnel}/catalog/refresh`,
    vpnCatalogSchema,
    { method: 'POST' },
  );
};

/**
 * API - Creates VPN connection.
 *
 * Tests and connects a named candidate before the server commits it.
 * The returned connection includes its assigned slot and initial revision.
 *
 * @since 2.0.0
 */
export const createVPNConnection = async (
  input: Web_Api_CreateVpnConnectionInput,
): Promise<Web_Api_VpnConnection> => {
  const validatedInput: Web_Api_CreateVpnConnectionInput = parseCreateVpnConnectionInput(input);
  const response: Web_Api_VpnConnectionResponse = await requestJSON(
    '/api/v1/vpn/connections',
    vpnConnectionResponseSchema,
    {
      body: validatedInput,
      method: 'POST',
    },
  );

  return response['connection'];
};

/**
 * API - Updates VPN connection.
 *
 * Sends rename-only fields without configuration so the tunnel stays up.
 * Configuration changes use the server's test-and-connect transaction.
 *
 * @since 2.0.0
 */
export const updateVPNConnection = async (
  connectionId: string,
  input: Web_Api_UpdateVpnConnectionInput,
): Promise<Web_Api_VpnConnection> => {
  const validatedConnectionID: string = parseProviderID(connectionId);
  const validatedInput: Web_Api_UpdateVpnConnectionInput = parseUpdateVpnConnectionInput(input);
  const response: Web_Api_VpnConnectionResponse = await requestJSON(
    `/api/v1/vpn/connections/${encodeURIComponent(validatedConnectionID)}`,
    vpnConnectionResponseSchema,
    {
      body: validatedInput,
      method: 'PUT',
    },
  );

  return response['connection'];
};

/**
 * API - Reconnects VPN connection.
 *
 * Restarts only the named connection and returns its latest runtime state.
 * Other tunnels and Transmission daemons remain untouched.
 *
 * @since 2.0.0
 */
export const reconnectVPNConnection = async (connectionId: string): Promise<Web_Api_VpnConnection> => {
  const validatedConnectionID: string = parseProviderID(connectionId);
  const response: Web_Api_VpnConnectionResponse = await requestJSON(
    `/api/v1/vpn/connections/${encodeURIComponent(validatedConnectionID)}/reconnect`,
    vpnConnectionResponseSchema,
    { method: 'POST' },
  );

  return response['connection'];
};

/**
 * API - Disconnects VPN connection.
 *
 * Blocks only the named connection while preserving its torrent list.
 * The returned row supplies the new disabled and runtime state.
 *
 * @since 2.0.0
 */
export const disconnectVPNConnection = async (connectionId: string): Promise<Web_Api_VpnConnection> => {
  const validatedConnectionID: string = parseProviderID(connectionId);
  const response: Web_Api_VpnConnectionResponse = await requestJSON(
    `/api/v1/vpn/connections/${encodeURIComponent(validatedConnectionID)}/disconnect`,
    vpnConnectionResponseSchema,
    { method: 'POST' },
  );

  return response['connection'];
};

/**
 * API - Sets default VPN connection.
 *
 * Switches DNS and Default-profile ownership after any required confirmation.
 * The response includes both changed rows and one result per attempted move.
 *
 * @since 2.0.0
 */
export const setDefaultVPNConnection = async (
  input: Web_Api_SetDefaultVpnConnectionInput,
): Promise<Web_Api_VpnDefaultResponse> => {
  const validatedInput: Web_Api_SetDefaultVpnConnectionInput = parseSetDefaultVpnConnectionInput(input);

  return requestJSON(
    '/api/v1/vpn/default',
    vpnDefaultResponseSchema,
    {
      body: validatedInput,
      method: 'PUT',
    },
  );
};

/**
 * API - Deletes VPN connection.
 *
 * An omitted destination probes dependency usage; a supplied destination moves
 * torrents, profiles, and logins before removing the connection.
 *
 * @since 2.0.0
 */
export const deleteVPNConnection = async (
  connectionId: string,
  input: Web_Api_DeleteVpnConnectionInput,
): Promise<Web_Api_DeleteVpnConnectionResponse> => {
  const validatedConnectionID: string = parseProviderID(connectionId);
  const validatedInput: Web_Api_DeleteVpnConnectionInput = parseDeleteVpnConnectionInput(input);

  return requestJSON(
    `/api/v1/vpn/connections/${encodeURIComponent(validatedConnectionID)}`,
    deleteVpnConnectionResponseSchema,
    {
      body: validatedInput,
      method: 'DELETE',
    },
  );
};

/**
 * API - Gets torrent detail.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const getTorrentDetail = async (torrentId: number): Promise<Web_Api_TorrentDetail> => requestJSON(
  `/api/v1/torrents/${torrentId}`,
  torrentDetailSchema,
);

/**
 * API - Gets torrents.
 *
 * Refreshes the complete torrent list outside the live-event cadence.
 * Organization saves use it to display renamed or removed labels immediately.
 *
 * @since 2.0.0
 */
export const getTorrents = async (): Promise<Web_Api_TorrentListResponse> => requestJSON(
  '/api/v1/torrents',
  torrentListResponseSchema,
);

/**
 * API - Adds torrent.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const addTorrent = async (
  input: Web_Api_AddTorrentInput,
): Promise<Web_Api_TorrentAddResult> => {
  const validatedInput: Web_Api_AddTorrentInput = parseAddTorrentInput(input);

  return requestJSON(
    '/api/v1/torrents',
    torrentAddResultSchema,
    {
      method: 'POST',
      body: validatedInput,
    },
  );
};

/**
 * API - Previews torrent links.
 *
 * Resolves up to twenty links through the server's fail-closed protected route.
 * The console batches larger pastes and treats omitted items as quiet fallbacks.
 *
 * @since 2.0.0
 */
export const previewTorrentLinks = async (
  links: string[],
): Promise<Web_Api_TorrentLinkPreviewResponse> => requestJSON(
  '/api/v1/torrents/preview',
  torrentLinkPreviewResponseSchema,
  {
    body: { links },
    method: 'POST',
  },
);

/**
 * API - Run torrent action.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const runTorrentAction = async (
  action: Web_Api_TorrentAction,
  hashes: string[],
): Promise<void> => {
  const validatedInput: Web_Api_TorrentActionInput = parseTorrentActionInput({
    action,
    hashes,
  });

  await requestJSON(
    '/api/v1/torrents/actions',
    z.object({
      action: z.string(),
      hashes: responseArraySchema(z.string()),
    }),
    {
      method: 'POST',
      body: validatedInput,
    },
  );
};

/**
 * API - Remove torrents.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const removeTorrents = async (
  hashes: string[],
  deleteLocalData: boolean,
): Promise<void> => {
  const validatedInput: Web_Api_RemoveTorrentsInput = parseRemoveTorrentsInput({
    deleteLocalData,
    hashes,
  });

  return requestVoid(
    '/api/v1/torrents/remove',
    {
      method: 'POST',
      body: validatedInput,
    },
  );
};

/**
 * API - Update torrents.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const updateTorrents = async (
  hashes: string[],
  changes: Web_Api_TorrentChanges,
): Promise<void> => {
  const validatedInput: Web_Api_UpdateTorrentsInput = parseUpdateTorrentsInput({
    changes,
    hashes,
  });

  await requestJSON(
    '/api/v1/torrents',
    z.object({ hashes: responseArraySchema(z.string()) }),
    {
      method: 'PATCH',
      body: validatedInput,
    },
  );
};

/**
 * API - Sets torrent profile.
 *
 * Assigns or clears a profile and optionally applies its labels and limits.
 * The selected torrent identifiers are returned only as mutation confirmation.
 *
 * @since 2.0.0
 */
export const setTorrentProfile = async (
  input: Web_Api_SetTorrentProfileInput,
): Promise<Web_Api_SetTorrentProfileResponse> => {
  const validatedInput: Web_Api_SetTorrentProfileInput = parseSetTorrentProfileInput(input);

  return requestJSON(
    '/api/v1/torrents/profile',
    torrentProfileAssignmentResponseSchema,
    {
      body: validatedInput,
      method: 'PUT',
    },
  );
};

/**
 * API - Rename torrent path.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const renameTorrentPath = async (
  input: Web_Api_RenameTorrentPathInput,
): Promise<void> => {
  const validatedInput: Web_Api_RenameTorrentPathInput = parseRenameTorrentPathInput(input);

  await requestJSON(
    '/api/v1/torrents/rename',
    z.object({ hashes: responseArraySchema(z.string()) }).loose(),
    {
      method: 'POST',
      body: validatedInput,
    },
  );
};

/**
 * API - Gets RPC logins.
 *
 * Returns login metadata without reusable passwords.
 * The response is safe to retain in application state.
 *
 * @since 2.0.0
 */
export const getRPCLogins = async (): Promise<Web_Api_RPCLogin[]> => {
  const response = await requestJSON('/api/v1/rpc/logins', rpcLoginsResponseSchema);

  return response['logins'];
};

/**
 * API - Creates an RPC login.
 *
 * Returns the generated password exactly once with the created login.
 * Later list responses contain only login metadata.
 *
 * @since 2.0.0
 */
export const createRPCLogin = async (
  input: Web_Api_RPCLoginInput,
): Promise<Web_Api_RPCCredential> => {
  const validatedInput: Web_Api_RPCLoginInput = parseRPCLoginInput(input);

  return requestJSON(
    '/api/v1/rpc/logins',
    rpcCredentialSchema,
    {
      method: 'POST',
      body: validatedInput,
    },
  );
};

/**
 * API - Updates an RPC login.
 *
 * Edits its username and optionally returns one regenerated password.
 * Omitting regeneration retains the saved verifier.
 *
 * @since 2.0.0
 */
export const updateRPCLogin = async (
  loginId: string,
  input: Web_Api_UpdateRPCLoginInput,
): Promise<Web_Api_RPCCredential> => {
  const validatedLoginID: string = parseTokenID(loginId);
  const validatedInput: Web_Api_UpdateRPCLoginInput = parseUpdateRPCLoginInput(input);

  return requestJSON(
    `/api/v1/rpc/logins/${encodeURIComponent(validatedLoginID)}`,
    rpcCredentialSchema,
    {
      method: 'PUT',
      body: validatedInput,
    },
  );
};

/**
 * API - Deletes an RPC login.
 *
 * Revokes one compatible-RPC login immediately.
 * Remote clients using it stop authenticating at once.
 *
 * @since 2.0.0
 */
export const deleteRPCLogin = async (loginId: string): Promise<void> => {
  const validatedLoginID: string = parseTokenID(loginId);

  return requestVoid(
    `/api/v1/rpc/logins/${encodeURIComponent(validatedLoginID)}`,
    { method: 'DELETE' },
  );
};

/**
 * API - Gets web proxy.
 *
 * Returns its desired state, observed state, and safe login metadata.
 * Runtime errors remain human-readable for the state card.
 *
 * @since 2.0.0
 */
export const getWebProxy = async (): Promise<Web_Api_WebProxy> => requestJSON(
  '/api/v1/web-proxy',
  webProxySchema,
);

/**
 * API - Updates web proxy state.
 *
 * Enables or disables the proxy while preserving its login collection.
 * An enabled proxy with no logins refuses every authentication attempt.
 *
 * @since 2.0.0
 */
export const updateWebProxy = async (enabled: boolean): Promise<Web_Api_WebProxy> => requestJSON(
  '/api/v1/web-proxy',
  webProxySchema,
  {
    method: 'PUT',
    body: { enabled },
  },
);

/**
 * API - Creates a web proxy login.
 *
 * Returns the generated password exactly once with the created login.
 * Later web proxy reads contain only login metadata.
 *
 * @since 2.0.0
 */
export const createWebProxyLogin = async (
  input: Web_Api_WebProxyLoginInput,
): Promise<Web_Api_WebProxyCredential> => {
  const validatedInput: Web_Api_WebProxyLoginInput = parseWebProxyLoginInput(input);

  return requestJSON(
    '/api/v1/web-proxy/logins',
    webProxyCredentialSchema,
    {
      method: 'POST',
      body: validatedInput,
    },
  );
};

/**
 * API - Updates a web proxy login.
 *
 * Edits its metadata and optionally returns one regenerated password.
 * Omitting regeneration retains the saved verifier.
 *
 * @since 2.0.0
 */
export const updateWebProxyLogin = async (
  loginId: string,
  input: Web_Api_UpdateWebProxyLoginInput,
): Promise<Web_Api_WebProxyCredential> => {
  const validatedLoginID: string = parseTokenID(loginId);
  const validatedInput: Web_Api_UpdateWebProxyLoginInput = parseUpdateWebProxyLoginInput(input);

  return requestJSON(
    `/api/v1/web-proxy/logins/${encodeURIComponent(validatedLoginID)}`,
    webProxyCredentialSchema,
    {
      method: 'PUT',
      body: validatedInput,
    },
  );
};

/**
 * API - Deletes a web proxy login.
 *
 * Revokes one login and returns after the proxy configuration is republished.
 * Removing the final login leaves the proxy switch unchanged.
 *
 * @since 2.0.0
 */
export const deleteWebProxyLogin = async (loginId: string): Promise<void> => {
  const validatedLoginID: string = parseTokenID(loginId);

  return requestVoid(
    `/api/v1/web-proxy/logins/${encodeURIComponent(validatedLoginID)}`,
    { method: 'DELETE' },
  );
};

/**
 * API - Gets tokens.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const getTokens = async (): Promise<Web_Api_Token[]> => {
  const response = await requestJSON('/api/v1/auth/tokens', tokensResponseSchema);

  return response['items'];
};

/**
 * API - Create token.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const createToken = async (
  input: Web_Api_CreateTokenInput,
): Promise<Web_Api_CreatedToken> => requestJSON(
  '/api/v1/auth/tokens',
  createdTokenSchema,
  {
    method: 'POST',
    body: {
      name: input['name'].trim(),
      scopes: input['scopes'],
      ...((input['expiresAt'] === undefined) ? {} : { expiresAt: input['expiresAt'] }),
    },
  },
);

/**
 * API - Update token.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const updateToken = async (
  tokenId: string,
  input: Web_Api_UpdateTokenInput,
): Promise<Web_Api_Token> => {
  const validatedTokenID: string = parseTokenID(tokenId);

  return requestJSON(
    `/api/v1/auth/tokens/${encodeURIComponent(validatedTokenID)}`,
    tokenSchema,
    {
      method: 'PUT',
      body: {
        name: input['name'].trim(),
        scopes: input['scopes'],
        ...((input['expiresAt'] === undefined) ? {} : { expiresAt: input['expiresAt'] }),
      },
    },
  );
};

/**
 * API - Revoke token.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const revokeToken = async (tokenId: string): Promise<void> => {
  const validatedTokenID: string = parseTokenID(tokenId);

  return requestVoid(
    `/api/v1/auth/tokens/${encodeURIComponent(validatedTokenID)}`,
    { method: 'DELETE' },
  );
};

/**
 * API - Gets notifications.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const getNotifications = async (): Promise<Web_Notifications_Target[]> => {
  const response = await requestJSON('/api/v1/notifications', notificationTargetsResponseSchema);

  return response['items'];
};

/**
 * API - Gets notification events.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const getNotificationEvents = async (): Promise<Web_Notifications_Event[]> => {
  const response = await requestJSON('/api/v1/notifications/events', notificationEventsResponseSchema);

  return response['items'];
};

/**
 * API - Create notification.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const createNotification = async (
  input: Web_Notifications_CreateInput,
): Promise<Web_Notifications_Target> => requestJSON(
  '/api/v1/notifications',
  notificationTargetSchema,
  {
    method: 'POST',
    body: {
      events: input['events'],
      name: input['name'].trim(),
      service: input['service'],
      settings: input['settings'],
    },
  },
);

/**
 * API - Update notification.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const updateNotification = async (
  notificationId: string,
  input: Web_Notifications_UpdateInput,
): Promise<Web_Notifications_Target> => requestJSON(
  `/api/v1/notifications/${encodeURIComponent(notificationId)}`,
  notificationTargetSchema,
  {
    method: 'PUT',
    body: {
      clearSecrets: input['clearSecrets'],
      events: input['events'],
      name: input['name'].trim(),
      settings: input['settings'],
    },
  },
);

/**
 * API - Removes notification.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const removeNotification = async (notificationId: string): Promise<void> => requestVoid(
  `/api/v1/notifications/${encodeURIComponent(notificationId)}`,
  { method: 'DELETE' },
);

/**
 * API - Test notification.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const testNotification = async (notificationId: string): Promise<Web_Notifications_TestResult> => requestJSON(
  `/api/v1/notifications/${encodeURIComponent(notificationId)}/test`,
  notificationTestSchema,
  { method: 'POST' },
);

/**
 * API - Submit second factor.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const submitSecondFactor = async (
  challenge: string,
  code: string,
): Promise<Web_Api_AuthenticationResponse> => requestJSON(
  '/api/v1/auth/login/second-factor',
  authenticationResponseSchema,
  {
    method: 'POST',
    body: {
      challenge,
      code: code.trim(),
    },
  },
);

/**
 * API - Sign in with passkey.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const signInWithPasskey = async (): Promise<Web_Api_AuthenticationResponse> => {
  const ceremony: Web_Api_PasskeyCeremony = await requestJSON(
    '/api/v1/auth/passkeys/login/options',
    passkeyCeremonySchema,
    { method: 'POST' },
  );
  const credential: Record<string, unknown> = await getPasskey(ceremony['options']);

  return requestJSON(
    '/api/v1/auth/passkeys/login/verify',
    authenticationResponseSchema,
    {
      method: 'POST',
      body: {
        ceremonyId: ceremony['ceremonyId'],
        credential,
      },
    },
  );
};

/**
 * API - Gets account security.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const getAccountSecurity = async (): Promise<Web_Api_AccountSecurity> => requestJSON(
  '/api/v1/auth/security',
  accountSecuritySchema,
);

/**
 * API - Change password.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const changePassword = async (
  currentPassword: string,
  newPassword: string,
): Promise<void> => requestVoid(
  '/api/v1/auth/password',
  {
    method: 'POST',
    body: {
      currentPassword,
      newPassword,
    },
  },
);

/**
 * API - Change username.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const changeUsername = async (
  username: string,
  password: string,
): Promise<void> => {
  await requestJSON(
    '/api/v1/auth/username',
    z.object({
      administrator: z.object({
        id: z.number(),
        username: z.string(),
      }),
    }),
    {
      method: 'POST',
      body: {
        password,
        username: username.trim(),
      },
    },
  );
};

/**
 * API - Starts TOTP setup.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const startTotpSetup = async (password: string): Promise<Web_Api_TotpSetup> => requestJSON(
  '/api/v1/auth/totp/setup',
  totpSetupSchema,
  {
    method: 'POST',
    body: { password },
  },
);

/**
 * API - Enable TOTP.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const enableTotp = async (code: string): Promise<Web_Api_RecoveryCodes> => requestJSON(
  '/api/v1/auth/totp/enable',
  recoveryCodesSchema,
  {
    method: 'POST',
    body: { code: code.trim() },
  },
);

/**
 * API - Disable TOTP.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const disableTotp = async (password: string): Promise<void> => requestVoid(
  '/api/v1/auth/totp/disable',
  {
    method: 'POST',
    body: { password },
  },
);

/**
 * API - Regenerate recovery codes.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const regenerateRecoveryCodes = async (password: string): Promise<Web_Api_RecoveryCodes> => requestJSON(
  '/api/v1/auth/recovery-codes',
  recoveryCodesSchema,
  {
    method: 'POST',
    body: { password },
  },
);

/**
 * API - Adds passkey.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const addPasskey = async (name: string, password: string): Promise<Web_Api_Passkey> => {
  const ceremony: Web_Api_PasskeyCeremony = await requestJSON(
    '/api/v1/auth/passkeys/register/options',
    passkeyCeremonySchema,
    {
      method: 'POST',
      body: {
        name: name.trim(),
        password,
      },
    },
  );
  const credential: Record<string, unknown> = await createPasskey(ceremony['options']);

  return requestJSON(
    '/api/v1/auth/passkeys/register/verify',
    passkeySchema,
    {
      method: 'POST',
      body: {
        ceremonyId: ceremony['ceremonyId'],
        credential,
        name: name.trim(),
      },
    },
  );
};

/**
 * API - Removes passkey.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const removePasskey = async (passkeyId: string, password: string): Promise<void> => requestVoid(
  `/api/v1/auth/passkeys/${encodeURIComponent(passkeyId)}`,
  {
    method: 'DELETE',
    body: { password },
  },
);

/**
 * API - Backup grant schema.
 *
 * Validates the short-lived confirmation returned by either ceremony.
 * The plaintext grant exists only until its matching mutation consumes it.
 *
 * @since 2.0.0
 */
const backupGrantSchema: Web_Api_Schema<Web_Backup_Grant> = z.object({
  grant: z.string(),
  expiresAt: z.string(),
});

/**
 * API - Backup import item schema.
 *
 * Validates persisted torrent progress used by both the dialog and Settings panel.
 * Stable state names keep reloads consistent with the running server job.
 *
 * @since 2.0.0
 */
const backupImportItemSchema = z.object({
  hash: z.string(),
  name: z.string(),
  profileName: z.string(),
  folder: z.string(),
  state: z.enum([
    'queued',
    'rechecking',
    'seeding',
    'downloading',
    'paused',
    'data-missing',
    'already-added',
    'failed',
  ]),
  progress: z.number(),
  detail: z.string(),
});

/**
 * API - Backup import job schema.
 *
 * Validates the durable progress envelope returned on create and subsequent polls.
 * Secret source material is intentionally absent from this response.
 *
 * @since 2.0.0
 */
const backupImportJobSchema: Web_Api_Schema<Web_Backup_ImportJob> = z.object({
  id: z.string(),
  source: z.enum([
    'another-transmission',
    'transmission-vpn-export',
  ]),
  status: z.enum([
    'queued',
    'running',
    'completed',
    'failed',
  ]),
  totalTorrents: z.number(),
  completedTorrents: z.number(),
  summary: z.record(z.string(), z.unknown()),
  error: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  items: responseArraySchema(backupImportItemSchema),
});

/**
 * API - Backup import preview schema.
 *
 * Validates every mapping choice prepared before re-authentication is requested.
 * The console uses this safe projection instead of interpreting server state itself.
 *
 * @since 2.0.0
 */
const backupImportPreviewSchema: Web_Api_Schema<Web_Backup_ImportPreview> = z.object({
  exportedAt: z.string(),
  appVersion: z.string(),
  actions: responseArraySchema(z.string()),
  folders: responseArraySchema(z.object({
    sourcePath: z.string(),
    dataFound: z.boolean(),
    kind: z.enum([
      'default',
      'download',
      'empty',
      'incomplete',
    ]).optional(),
    description: z.string().optional(),
    mappedPath: z.string().optional(),
    torrentCount: z.number().optional(),
    dataFoundCount: z.number().optional(),
    dataTotal: z.number().optional(),
    dataFoundStatus: z.enum([
      'empty',
      'found',
      'not-found',
      'partial',
    ]).optional(),
    conflict: z.string().optional(),
  })),
  profiles: responseArraySchema(z.object({
    id: z.string(),
    name: z.string(),
    default: z.boolean(),
    existingId: z.string().nullable(),
    existingName: z.string().nullable(),
    suggestedAction: z.literal('replace'),
    sourcePath: z.string().optional(),
    connectionId: z.string().nullable().optional(),
    empty: z.boolean().optional(),
    included: z.boolean(),
    note: z.string().optional(),
  })),
  settings: responseArraySchema(z.object({
    key: z.string(),
    title: z.string(),
    fileValue: z.unknown(),
    hereValue: z.unknown().optional(),
    willImport: z.boolean(),
    reason: z.string().optional(),
  })),
  sections: responseArraySchema(z.string()),
  torrentCount: z.number(),
  hasRemoteLogins: z.boolean(),
  totalSizeBytes: z.number(),
  runningTorrentCount: z.number().optional(),
  dataMissingCount: z.number().optional(),
  dataFoundBytes: z.number().optional(),
  alreadyPresentCount: z.number().optional(),
  connections: responseArraySchema(z.object({
    id: z.string(),
    name: z.string(),
    default: z.boolean(),
  })),
  sourceDetails: z.object({
    version: z.number(),
    settingsFile: z.string(),
    torrentCount: z.number(),
    readOnly: z.boolean(),
    incompleteDirectory: z.string().optional(),
  }).optional(),
});

/**
 * API - Backup source directory schema.
 *
 * Validates the read-only directory listing used by the mounted-source picker.
 * Only directory metadata crosses this boundary; source file contents never do.
 *
 * @since 2.0.0
 */
const backupSourceDirectorySchema: Web_Api_Schema<Web_Backup_SourceDirectory> = z.object({
  path: z.string(),
  parentPath: z.string().optional(),
  directories: responseArraySchema(z.object({
    name: z.string(),
    path: z.string(),
    hasSubfolders: z.boolean(),
  })),
});

/**
 * API - Confirms a sensitive backup operation.
 *
 * Exchanges current account proof for a short-lived, single-use grant.
 * The caller keeps the grant only long enough to submit its export or import.
 *
 * @param {Web_Backup_Purpose} purpose  - Purpose.
 * @param {string}             password - Password.
 * @param {string}             code     - Code.
 *
 * @returns {Promise<string>}
 *
 * @since 2.0.0
 */
export const confirmBackupOperation = async (
  purpose: Web_Backup_Purpose,
  password: string,
  code: string,
): Promise<string> => {
  const confirmation: Web_Backup_Grant = await requestJSON(
    '/api/v1/backup/confirmation',
    backupGrantSchema,
    {
      cache: 'no-store',
      method: 'POST',
      body: {
        purpose,
        password,
        ...((code.trim() === '') ? {} : { code: code.trim() }),
      },
    },
  );

  return confirmation['grant'];
};

/**
 * API - Confirms a backup operation with a passkey.
 *
 * Runs the existing browser passkey ceremony for the current signed-in account.
 * Successful user verification yields the same scoped grant as password confirmation.
 *
 * @param {Web_Backup_Purpose} purpose - Purpose.
 *
 * @returns {Promise<string>}
 *
 * @since 2.0.0
 */
export const confirmBackupOperationWithPasskey = async (
  purpose: Web_Backup_Purpose,
): Promise<string> => {
  const ceremony: Web_Api_PasskeyCeremony = await requestJSON(
    '/api/v1/backup/confirmation/passkey/options',
    passkeyCeremonySchema,
    {
      cache: 'no-store',
      method: 'POST',
      body: { purpose },
    },
  );
  const credential: Record<string, unknown> = await getPasskey(ceremony['options']);
  const confirmation: Web_Backup_Grant = await requestJSON(
    '/api/v1/backup/confirmation/passkey/verify',
    backupGrantSchema,
    {
      cache: 'no-store',
      method: 'POST',
      body: {
        ceremonyId: ceremony['ceremonyId'],
        credential,
        purpose,
      },
    },
  );

  return confirmation['grant'];
};

/**
 * API - Downloads an export.
 *
 * Streams the secret-bearing response into a local download without parsing its body.
 * No export contents are written to browser storage or application state.
 *
 * @param {Web_Backup_ExportSections} sections - Sections.
 * @param {string}                    grant    - Grant.
 *
 * @returns {Promise<void>}
 *
 * @since 2.0.0
 */
export const downloadBackupExport = async (
  sections: Web_Backup_ExportSections,
  grant: string,
): Promise<void> => {
  const headers: Headers = new Headers({ 'Content-Type': 'application/json' });
  const csrfToken: string | undefined = readCookie('tvpn_csrf');
  if (csrfToken !== undefined) {
    headers.set('X-CSRF-Token', csrfToken);
  }
  const response: Response = await fetch('/api/v1/backup/export', {
    body: JSON.stringify({
      grant,
      sections,
    }),
    cache: 'no-store',
    credentials: 'same-origin',
    headers,
    method: 'POST',
  });
  if (!response.ok) {
    throw await responseError(response);
  }
  const disposition: string = response.headers.get('Content-Disposition') ?? '';
  const filename: string = /filename="([^"]+)"/u.exec(disposition)?.[1] ?? `transmission-vpn-export-${new Date().toISOString().slice(0, 10)}.json`;
  const url: string = URL.createObjectURL(await response.blob());
  const link: HTMLAnchorElement = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * API - Previews an export import.
 *
 * Sends a locally validated document for environment-specific folder and conflict checks.
 * The returned projection contains only the choices the wizard needs to display.
 *
 * @param {Web_Backup_Document} document - Document.
 *
 * @returns {Promise<Web_Backup_ImportPreview>}
 *
 * @since 2.0.0
 */
export const previewBackupImport = async (
  document: Web_Backup_Document,
  folderMappings: Record<string, string> = {},
  profileActions: Record<string, string> = {},
): Promise<Web_Backup_ImportPreview> => {
  const response: {
    preview: Web_Backup_ImportPreview
  } = await requestJSON(
    '/api/v1/backup/imports/preview',
    z.object({ preview: backupImportPreviewSchema }),
    {
      cache: 'no-store',
      method: 'POST',
      body: {
        document,
        folderMappings,
        profileActions,
        source: 'transmission-vpn-export',
      },
    },
  );

  return response['preview'];
};

/**
 * API - Previews another Transmission config folder.
 *
 * Inspects a mounted read-only source and returns only the migration choices.
 * Folder mappings may be supplied again to refresh data-found counts.
 *
 * @param {string}                 configPath     - Config path.
 * @param {Record<string, string>} folderMappings - Folder mappings.
 *
 * @returns {Promise<Web_Backup_ImportPreview>}
 *
 * @since 2.0.0
 */
export const previewAnotherTransmissionImport = async (
  configPath: string,
  folderMappings: Record<string, string> = {},
): Promise<Web_Backup_ImportPreview> => {
  const response: {
    preview: Web_Backup_ImportPreview
  } = await requestJSON(
    '/api/v1/backup/imports/preview',
    z.object({ preview: backupImportPreviewSchema }),
    {
      cache: 'no-store',
      method: 'POST',
      body: {
        configPath,
        folderMappings,
        source: 'another-transmission',
      },
    },
  );

  return response['preview'];
};

/**
 * API - Lists read-only import source folders.
 *
 * Keeps mounted-source browsing behind the authenticated API and its path policy.
 * The picker receives only safe child-folder names and navigation metadata.
 *
 * @param {string} path - Path.
 *
 * @returns {Promise<Web_Backup_SourceDirectory>}
 *
 * @since 2.0.0
 */
export const getBackupSourceDirectory = async (path: string): Promise<Web_Backup_SourceDirectory> => {
  const response: {
    directory: Web_Backup_SourceDirectory
  } = await requestJSON(
    `/api/v1/backup/imports/source-directories?path=${encodeURIComponent(path)}`,
    z.object({ directory: backupSourceDirectorySchema }),
    { cache: 'no-store' },
  );

  return response['directory'];
};

/**
 * API - Starts an import job.
 *
 * Submits the reviewed mappings together with a single-use confirmation grant.
 * The durable server job continues if the dialog closes or the page reloads.
 *
 * @param {Web_Backup_ImportPlan} plan  - Plan.
 * @param {string}                grant - Grant.
 *
 * @returns {Promise<Web_Backup_ImportJob>}
 *
 * @since 2.0.0
 */
export const createBackupImport = async (
  plan: Web_Backup_ImportPlan,
  grant: string,
): Promise<Web_Backup_ImportJob> => {
  const response: {
    job: Web_Backup_ImportJob
  } = await requestJSON(
    '/api/v1/backup/imports',
    z.object({ job: backupImportJobSchema }),
    {
      cache: 'no-store',
      method: 'POST',
      body: {
        ...plan,
        grant,
      },
    },
  );

  return response['job'];
};

/**
 * API - Gets the running import, if any.
 *
 * Restores background progress when the Settings page first mounts.
 * A null response means no queued or running import exists.
 *
 * @returns {Promise<Web_Backup_ImportJob | null>}
 *
 * @since 2.0.0
 */
export const getCurrentBackupImport = async (): Promise<Web_Backup_ImportJob | null> => {
  const response: {
    job: Web_Backup_ImportJob | null
  } = await requestJSON(
    '/api/v1/backup/imports/current',
    z.object({ job: backupImportJobSchema.nullable() }),
    { cache: 'no-store' },
  );

  return response['job'];
};

/**
 * API - Gets one import job.
 *
 * Polls a known durable job while its progress dialog is open or backgrounded.
 * Completed item outcomes remain available through the job-specific route.
 *
 * @param {string} importId - Import id.
 *
 * @returns {Promise<Web_Backup_ImportJob>}
 *
 * @since 2.0.0
 */
export const getBackupImport = async (importId: string): Promise<Web_Backup_ImportJob> => {
  const response: {
    job: Web_Backup_ImportJob
  } = await requestJSON(
    `/api/v1/backup/imports/${encodeURIComponent(importId)}`,
    z.object({ job: backupImportJobSchema }),
    { cache: 'no-store' },
  );

  return response['job'];
};

/**
 * API - Connect live events.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const connectLiveEvents = (
  onSnapshot: Web_Api_ConnectLiveEvents_OnSnapshot,
): Web_Api_ConnectLiveEvents_Returns => {
  const source: EventSource = new EventSource('/api/v1/events');
  source.addEventListener('snapshot', (event: MessageEvent<string>): void => {
    const value: unknown = JSON.parse(event.data);
    const parsedSnapshot = liveSnapshotSchema.safeParse(value);
    if (parsedSnapshot.success) {
      onSnapshot(parsedSnapshot.data);
    }
  });

  return (): void => {
    source.close();
  };
};

export type {
  Web_Api_Torrent,
};
