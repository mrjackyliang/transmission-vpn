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
import {
  bareFilenamePattern,
  contentDispositionFilenamePattern,
  encodedFilenamePattern,
  escapedCharacterPattern,
  infoHashPattern,
  quotedFilenamePattern,
} from '@/web/regex.js';

import type {
  Web_Api_AccountSecuritySchema,
  Web_Api_AddPasskey_Credential,
  Web_Api_AddPasskey_Name,
  Web_Api_AddPasskey_Password,
  Web_Api_AddPasskey_Returns,
  Web_Api_AddTorrent_Returns,
  Web_Api_AddTorrentInput,
  Web_Api_AdministratorSchema,
  Web_Api_ApiError_Code,
  Web_Api_ApiError_Constructor_Code,
  Web_Api_ApiError_Constructor_Details,
  Web_Api_ApiError_Constructor_Issues,
  Web_Api_ApiError_Constructor_Message,
  Web_Api_ApiError_Constructor_Status,
  Web_Api_ApiError_Details,
  Web_Api_ApiError_Issues,
  Web_Api_ApiError_Status,
  Web_Api_AuthenticationResponseSchema,
  Web_Api_BackupGrantSchema,
  Web_Api_BackupImportJobSchema,
  Web_Api_BackupImportPreviewSchema,
  Web_Api_BackupSourceDirectorySchema,
  Web_Api_BlocklistSourceStatusSchema,
  Web_Api_BlocklistStatusSchema,
  Web_Api_ChangePassword_CurrentPassword,
  Web_Api_ChangePassword_NewPassword,
  Web_Api_ChangePassword_Returns,
  Web_Api_ChangeUsername_Password,
  Web_Api_ChangeUsername_Returns,
  Web_Api_ChangeUsername_Username,
  Web_Api_ClaimInput,
  Web_Api_ClaimInstallation_Returns,
  Web_Api_ConfirmBackupOperation_Code,
  Web_Api_ConfirmBackupOperation_Password,
  Web_Api_ConfirmBackupOperation_Returns,
  Web_Api_ConfirmBackupOperationWithPasskey_Credential,
  Web_Api_ConfirmBackupOperationWithPasskey_Returns,
  Web_Api_ConnectionBeingRemovedMessage_CaughtError,
  Web_Api_ConnectionBeingRemovedMessage_ConnectionName,
  Web_Api_ConnectionBeingRemovedMessage_Returns,
  Web_Api_ConnectLiveEvents_OnSnapshot,
  Web_Api_ConnectLiveEvents_ParsedSnapshot,
  Web_Api_ConnectLiveEvents_Returns,
  Web_Api_ConnectLiveEvents_Value,
  Web_Api_CreateBackupImport_Grant,
  Web_Api_CreateBackupImport_Response,
  Web_Api_CreateBackupImport_Returns,
  Web_Api_CreateDirectory_ProfileId,
  Web_Api_CreateDirectory_Returns,
  Web_Api_CreateDirectoryInput,
  Web_Api_CreatedTokenSchema,
  Web_Api_CreateNotification_Returns,
  Web_Api_CreateRpcLogin_Returns,
  Web_Api_CreateToken_Returns,
  Web_Api_CreateTokenInput,
  Web_Api_CreateTorrentProfile_IncompleteDirectory,
  Web_Api_CreateTorrentProfile_Returns,
  Web_Api_CreateVpnConnection_Returns,
  Web_Api_CreateVpnConnectionInput,
  Web_Api_CreateWebProxyLogin_Returns,
  Web_Api_CustomProfileInput,
  Web_Api_CustomProfileResponse,
  Web_Api_CustomProfileResponseSchema,
  Web_Api_DefaultTorrentProfileInput,
  Web_Api_DefaultTorrentProfileSchema,
  Web_Api_DefaultTorrentProfileUpdateResponseSchema,
  Web_Api_DeleteDirectory_Path,
  Web_Api_DeleteDirectory_ProfileId,
  Web_Api_DeleteDirectory_Query,
  Web_Api_DeleteDirectory_Returns,
  Web_Api_DeleteDirectory_ValidatedPath,
  Web_Api_DeleteRpcLogin_LoginId,
  Web_Api_DeleteRpcLogin_Returns,
  Web_Api_DeleteRpcLogin_ValidatedLoginId,
  Web_Api_DeleteTorrentProfile_MoveTorrents,
  Web_Api_DeleteTorrentProfile_Path,
  Web_Api_DeleteTorrentProfile_ProfileId,
  Web_Api_DeleteTorrentProfile_Returns,
  Web_Api_DeleteTorrentProfileInput,
  Web_Api_DeleteTorrentProfileResponseSchema,
  Web_Api_DeleteVpnConnection_ConnectionId,
  Web_Api_DeleteVpnConnection_Returns,
  Web_Api_DeleteVpnConnection_ValidatedConnectionId,
  Web_Api_DeleteVpnConnectionInput,
  Web_Api_DeleteVpnConnectionResponseSchema,
  Web_Api_DeleteWebProxyLogin_LoginId,
  Web_Api_DeleteWebProxyLogin_Returns,
  Web_Api_DeleteWebProxyLogin_ValidatedLoginId,
  Web_Api_DirectoryPurpose,
  Web_Api_DirectorySchema,
  Web_Api_DisableTotp_Password,
  Web_Api_DisableTotp_Returns,
  Web_Api_DisconnectVpnConnection_ConnectionId,
  Web_Api_DisconnectVpnConnection_Returns,
  Web_Api_DisconnectVpnConnection_ValidatedConnectionId,
  Web_Api_DismissRemovedSecrets_Returns,
  Web_Api_DispositionFileName_BareMatch,
  Web_Api_DispositionFileName_BareName,
  Web_Api_DispositionFileName_Disposition,
  Web_Api_DispositionFileName_EncodedMatch,
  Web_Api_DispositionFileName_EncodedName,
  Web_Api_DispositionFileName_Fallback,
  Web_Api_DispositionFileName_QuotedMatch,
  Web_Api_DispositionFileName_QuotedName,
  Web_Api_DispositionFileName_Returns,
  Web_Api_DownloadBackupExport_CsrfToken,
  Web_Api_DownloadBackupExport_Disposition,
  Web_Api_DownloadBackupExport_Filename,
  Web_Api_DownloadBackupExport_FilenameMatch,
  Web_Api_DownloadBackupExport_Grant,
  Web_Api_DownloadBackupExport_MatchedFilename,
  Web_Api_DownloadBackupExport_Returns,
  Web_Api_DownloadBackupExport_Url,
  Web_Api_DownloadFinishedFiles_Hashes,
  Web_Api_DownloadFinishedFiles_Returns,
  Web_Api_DownloadTorrentFiles_CsrfToken,
  Web_Api_DownloadTorrentFiles_FallbackName,
  Web_Api_DownloadTorrentFiles_Filename,
  Web_Api_DownloadTorrentFiles_Hashes,
  Web_Api_DownloadTorrentFiles_Returns,
  Web_Api_DownloadTorrentFiles_Url,
  Web_Api_EnableTotp_Code,
  Web_Api_EnableTotp_Returns,
  Web_Api_ErrorEnvelopeSchema,
  Web_Api_GetAccountSecurity_Returns,
  Web_Api_GetBackupImport_ImportId,
  Web_Api_GetBackupImport_Response,
  Web_Api_GetBackupImport_Returns,
  Web_Api_GetBackupSourceDirectory_Path,
  Web_Api_GetBackupSourceDirectory_Response,
  Web_Api_GetBackupSourceDirectory_Returns,
  Web_Api_GetBlocklistStatus_Returns,
  Web_Api_GetCurrentAdministrator_ResponseValue,
  Web_Api_GetCurrentAdministrator_Returns,
  Web_Api_GetCurrentBackupImport_Response,
  Web_Api_GetCurrentBackupImport_Returns,
  Web_Api_GetDirectory_Path,
  Web_Api_GetDirectory_ProfileId,
  Web_Api_GetDirectory_Query,
  Web_Api_GetDirectory_Returns,
  Web_Api_GetDirectory_ValidatedPath,
  Web_Api_GetNotificationEvents_Response,
  Web_Api_GetNotificationEvents_Returns,
  Web_Api_GetNotifications_Response,
  Web_Api_GetNotifications_Returns,
  Web_Api_GetProfiles_ProviderId,
  Web_Api_GetProfiles_Query,
  Web_Api_GetProfiles_Response,
  Web_Api_GetProfiles_Returns,
  Web_Api_GetProfiles_ValidatedProviderId,
  Web_Api_GetProviders_Response,
  Web_Api_GetProviders_Returns,
  Web_Api_GetRpcLogins_Response,
  Web_Api_GetRpcLogins_Returns,
  Web_Api_GetSettings_Returns,
  Web_Api_GetSetupStatus_Returns,
  Web_Api_GetTokens_Response,
  Web_Api_GetTokens_Returns,
  Web_Api_GetTorrentDetail_Returns,
  Web_Api_GetTorrentDetail_TorrentId,
  Web_Api_GetTorrentOrganization_Returns,
  Web_Api_GetTorrentProfiles_Returns,
  Web_Api_GetTorrents_Returns,
  Web_Api_GetTransmissionFreeSpace_Path,
  Web_Api_GetTransmissionFreeSpace_Query,
  Web_Api_GetTransmissionFreeSpace_Returns,
  Web_Api_GetTransmissionFreeSpace_ValidatedPath,
  Web_Api_GetVpnConnection_ConnectionId,
  Web_Api_GetVpnConnection_Returns,
  Web_Api_GetVpnConnection_ValidatedConnectionId,
  Web_Api_GetVpnConnections_Returns,
  Web_Api_GetWebProxy_Returns,
  Web_Api_IssueFor_CaughtError,
  Web_Api_IssueFor_Field,
  Web_Api_IssueFor_Issue,
  Web_Api_IssueFor_Returns,
  Web_Api_IsVpnConnectionRequiredError_CaughtError,
  Web_Api_IsVpnConnectionRequiredError_Returns,
  Web_Api_JsonValueSchema,
  Web_Api_LiveSnapshotSchema,
  Web_Api_Login_Returns,
  Web_Api_LoginInput,
  Web_Api_LoginResultSchema,
  Web_Api_Logout_Returns,
  Web_Api_MessageForApiError_Code,
  Web_Api_MessageForApiError_Details,
  Web_Api_MessageForApiError_Limit,
  Web_Api_MessageForApiError_Message,
  Web_Api_MessageForApiError_NormalizedMessage,
  Web_Api_MessageForApiError_Returns,
  Web_Api_MessageForApiError_Status,
  Web_Api_MovedTorrentSchema,
  Web_Api_NotificationTargetSchema,
  Web_Api_NotificationTestSchema,
  Web_Api_PasskeyCeremony,
  Web_Api_PasskeyCeremonySchema,
  Web_Api_PasskeySchema,
  Web_Api_PreviewAnotherTransmissionImport_ConfigPath,
  Web_Api_PreviewAnotherTransmissionImport_FolderMappings,
  Web_Api_PreviewAnotherTransmissionImport_Response,
  Web_Api_PreviewAnotherTransmissionImport_Returns,
  Web_Api_PreviewBackupImport_FolderMappings,
  Web_Api_PreviewBackupImport_ProfileActions,
  Web_Api_PreviewBackupImport_Response,
  Web_Api_PreviewBackupImport_Returns,
  Web_Api_PreviewTorrentLinks_Links,
  Web_Api_PreviewTorrentLinks_Returns,
  Web_Api_ReadCookie_MatchingPart,
  Web_Api_ReadCookie_Name,
  Web_Api_ReadCookie_Parts,
  Web_Api_ReadCookie_Prefix,
  Web_Api_ReadCookie_Returns,
  Web_Api_ReconnectVpnConnection_ConnectionId,
  Web_Api_ReconnectVpnConnection_Returns,
  Web_Api_ReconnectVpnConnection_ValidatedConnectionId,
  Web_Api_RecoveryCodesSchema,
  Web_Api_RefreshVpnCatalog_ProviderId,
  Web_Api_RefreshVpnCatalog_Returns,
  Web_Api_RefreshVpnCatalog_ValidatedProviderId,
  Web_Api_RegenerateRecoveryCodes_Password,
  Web_Api_RegenerateRecoveryCodes_Returns,
  Web_Api_RemovedSecretSchema,
  Web_Api_RemoveNotification_NotificationId,
  Web_Api_RemoveNotification_Returns,
  Web_Api_RemovePasskey_PasskeyId,
  Web_Api_RemovePasskey_Password,
  Web_Api_RemovePasskey_Returns,
  Web_Api_RemoveTorrents_DeleteLocalData,
  Web_Api_RemoveTorrents_Hashes,
  Web_Api_RemoveTorrents_Returns,
  Web_Api_RemoveTorrentsInput,
  Web_Api_RenameTorrentPath_Returns,
  Web_Api_RenameTorrentPathInput,
  Web_Api_Request_Options,
  Web_Api_RequestBlocklistUpdate_Returns,
  Web_Api_RequestJson_BaseOptions,
  Web_Api_RequestJson_CsrfToken,
  Web_Api_RequestJson_ParsedResponse,
  Web_Api_RequestJson_Path,
  Web_Api_RequestJson_RequestBody,
  Web_Api_RequestJson_ResponseValue,
  Web_Api_RequestVoid_BaseOptions,
  Web_Api_RequestVoid_CsrfToken,
  Web_Api_RequestVoid_Path,
  Web_Api_RequestVoid_RequestBody,
  Web_Api_RequestVoid_Returns,
  Web_Api_ResponseArraySchema_Returns,
  Web_Api_ResponseError_Details,
  Web_Api_ResponseError_ParsedError,
  Web_Api_ResponseError_ResponseValue,
  Web_Api_ResponseError_Returns,
  Web_Api_RestartTransmission_Returns,
  Web_Api_RevokeToken_Returns,
  Web_Api_RevokeToken_TokenId,
  Web_Api_RevokeToken_ValidatedTokenId,
  Web_Api_RpcCredentialSchema,
  Web_Api_RPCLoginInput,
  Web_Api_RpcLoginSchema,
  Web_Api_RunTorrentAction_Hashes,
  Web_Api_RunTorrentAction_Returns,
  Web_Api_Schema,
  Web_Api_ScopeSchema,
  Web_Api_SetDefaultVpnConnection_Returns,
  Web_Api_SetDefaultVpnConnectionInput,
  Web_Api_SetTorrentProfile_Returns,
  Web_Api_SetTorrentProfileInput,
  Web_Api_SetupStatusSchema,
  Web_Api_SignInWithPasskey_Credential,
  Web_Api_SignInWithPasskey_Returns,
  Web_Api_StartTotpSetup_Password,
  Web_Api_StartTotpSetup_Returns,
  Web_Api_SubmitSecondFactor_Challenge,
  Web_Api_SubmitSecondFactor_Code,
  Web_Api_SubmitSecondFactor_Returns,
  Web_Api_SummaryFor_CaughtError,
  Web_Api_SummaryFor_Fallback,
  Web_Api_SummaryFor_Returns,
  Web_Api_SummaryFor_ShownFields,
  Web_Api_TestNotification_NotificationId,
  Web_Api_TestNotification_Returns,
  Web_Api_TokenSchema,
  Web_Api_Torrent,
  Web_Api_TorrentAction,
  Web_Api_TorrentActionInput,
  Web_Api_TorrentAddResultSchema,
  Web_Api_TorrentChanges,
  Web_Api_TorrentContentsDownload,
  Web_Api_TorrentContentsDownloadSchema,
  Web_Api_TorrentLinkPreviewResponseSchema,
  Web_Api_TorrentLinkPreviewSchema,
  Web_Api_TorrentListResponseSchema,
  Web_Api_TorrentProfileAssignmentResponseSchema,
  Web_Api_TorrentProfileInput,
  Web_Api_TorrentProfileSchema,
  Web_Api_TorrentProfileUpdateResponseSchema,
  Web_Api_TotpSetupSchema,
  Web_Api_TransmissionFreeSpace,
  Web_Api_TransmissionFreeSpaceSchema,
  Web_Api_TransmissionRestartResponseSchema,
  Web_Api_UpdateDefaultTorrentProfile_IncompleteDirectory,
  Web_Api_UpdateDefaultTorrentProfile_MoveTorrents,
  Web_Api_UpdateDefaultTorrentProfile_Returns,
  Web_Api_UpdateDefaultTorrentProfileInput,
  Web_Api_UpdateNotification_NotificationId,
  Web_Api_UpdateNotification_Returns,
  Web_Api_UpdateRpcLogin_LoginId,
  Web_Api_UpdateRpcLogin_Returns,
  Web_Api_UpdateRpcLogin_ValidatedLoginId,
  Web_Api_UpdateRPCLoginInput,
  Web_Api_UpdateSettings_IncompleteDirectory,
  Web_Api_UpdateSettings_Returns,
  Web_Api_UpdateSettingsInput,
  Web_Api_UpdateToken_Returns,
  Web_Api_UpdateToken_TokenId,
  Web_Api_UpdateToken_ValidatedTokenId,
  Web_Api_UpdateTokenInput,
  Web_Api_UpdateTorrentOrganization_Returns,
  Web_Api_UpdateTorrentOrganizationInput,
  Web_Api_UpdateTorrentOrganizationResponseSchema,
  Web_Api_UpdateTorrentProfile_IncompleteDirectory,
  Web_Api_UpdateTorrentProfile_MoveTorrents,
  Web_Api_UpdateTorrentProfile_ProfileId,
  Web_Api_UpdateTorrentProfile_Returns,
  Web_Api_UpdateTorrentProfileInput,
  Web_Api_UpdateTorrents_Hashes,
  Web_Api_UpdateTorrents_Returns,
  Web_Api_UpdateTorrentsInput,
  Web_Api_UpdateVpnConnection_ConnectionId,
  Web_Api_UpdateVpnConnection_Returns,
  Web_Api_UpdateVpnConnection_ValidatedConnectionId,
  Web_Api_UpdateVpnConnectionInput,
  Web_Api_UpdateWebProxy_Enabled,
  Web_Api_UpdateWebProxy_Returns,
  Web_Api_UpdateWebProxyLogin_LoginId,
  Web_Api_UpdateWebProxyLogin_Returns,
  Web_Api_UpdateWebProxyLogin_ValidatedLoginId,
  Web_Api_UpdateWebProxyLoginInput,
  Web_Api_UploadCustomProfile_Profile,
  Web_Api_UploadCustomProfile_ProfileName,
  Web_Api_UploadCustomProfile_Returns,
  Web_Api_VpnConnectionResponse,
  Web_Api_VpnConnectionResponseSchema,
  Web_Api_VpnConnectionSchema,
  Web_Api_VpnConnectionsResponseSchema,
  Web_Api_VpnDefaultResponseSchema,
  Web_Api_VpnTunnel,
  Web_Api_WebProxyCredentialSchema,
  Web_Api_WebProxyLoginInput,
  Web_Api_WebProxyLoginSchema,
  Web_Api_WebProxySchema,
} from '@/types/web/api.d.ts';
import type {
  Web_Backup_Document,
  Web_Backup_ExportSections,
  Web_Backup_Grant,
  Web_Backup_ImportPlan,
  Web_Backup_Purpose,
} from '@/types/web/backup.d.ts';
import type {
  Web_Notifications_CreateInput,
  Web_Notifications_UpdateInput,
} from '@/types/web/notifications.d.ts';

/**
 * API - Response Array Schema.
 *
 * Treats a legacy or unexpected null response list as empty while retaining the
 * element schema. Request parsers remain strict in form-validation.ts.
 *
 * @param {Web_Api_Schema<Value>} elementSchema - Element schema.
 *
 * @returns {Web_Api_ResponseArraySchema_Returns<Value>}
 *
 * @since 2.0.0
 */
const responseArraySchema = <Value>(
  elementSchema: Web_Api_Schema<Value>,
): Web_Api_ResponseArraySchema_Returns<Value> => z.preprocess(
  (value) => (value === null) ? [] : value,
  z.array(elementSchema),
);

/**
 * API - JSON Value Schema.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const jsonValueSchema: Web_Api_JsonValueSchema = z.lazy(() => z.union([
  z.boolean(),
  z.number(),
  z.string(),
  z.null(),
  z.array(jsonValueSchema),
  z.record(z.string(), jsonValueSchema),
]));

/**
 * API - Service State Schema.
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
 * API - Vpn Tunnel Schema.
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
 * API - Vpn Runtime State Schema.
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
 * API - Vpn Endpoint Strategy Schema.
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
 * API - Vpn Implementation Schema.
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
 * API - Vpn Daemon Schema.
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
 * API - Vpn Protection Schema.
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
 * API - Vpn Connection Runtime Schema.
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
 * API - Live Vpn Connection Schema.
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
 * API - Status Schema.
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
 * API - Vpn Status Schema.
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
 * API - Torrent Schema.
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
 * API - Torrent Profile Options Response Schema.
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
 * API - Torrent Profile Schema.
 *
 * Validates the complete application-owned named profile returned by the API.
 * Profile list, create, and update responses reuse this contract.
 *
 * @since 2.0.0
 */
const torrentProfileSchema: Web_Api_TorrentProfileSchema = z.object({
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
 * API - Default Torrent Profile Schema.
 *
 * Validates the complete Default profile returned with profile configuration.
 * Its folder lock and option defaults remain available to every profile screen.
 *
 * @since 2.0.0
 */
const defaultTorrentProfileSchema: Web_Api_DefaultTorrentProfileSchema = z.object({
  downloadDirectory: z.string().min(1),
  downloadDirectoryLocked: z.boolean(),
  labels: responseArraySchema(z.string()),
  name: z.string(),
  options: torrentProfileOptionsResponseSchema,
  startPaused: z.boolean(),
});

/**
 * API - Torrent Profiles Response Schema.
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
 * API - Torrent Add Result Schema.
 *
 * Captures both newly-added and duplicate results from Transmission.
 * Callers use the duplicate flag to label each processed source.
 *
 * @since 2.0.0
 */
const torrentAddResultSchema: Web_Api_TorrentAddResultSchema = z.object({
  connectionName: z.string(),
  duplicate: z.boolean(),
  hash: z.string(),
  id: z.number(),
  name: z.string(),
  profileName: z.string(),
});

/**
 * API - Torrent Link Preview Schema.
 *
 * Validates the metainfo fields resolved through the protected default route.
 * Magnet previews omit total size because their URI does not carry it.
 *
 * @since 2.0.0
 */
const torrentLinkPreviewSchema: Web_Api_TorrentLinkPreviewSchema = z.object({
  hash: z.string().regex(new RegExp(infoHashPattern, 'u')),
  index: z.number().int().nonnegative(),
  name: z.string().min(1),
  totalSize: z.number().nonnegative().optional(),
});

/**
 * API - Torrent Link Preview Response Schema.
 *
 * Missing indexes intentionally represent quiet preview failures and retain the
 * console's URL-derived fallback name.
 *
 * @since 2.0.0
 */
const torrentLinkPreviewResponseSchema: Web_Api_TorrentLinkPreviewResponseSchema = z.object({
  items: responseArraySchema(torrentLinkPreviewSchema),
});

/**
 * API - Torrent List Response Schema.
 *
 * Validates an explicit torrent refresh used after organization-wide label
 * mutations.
 *
 * @since 2.0.0
 */
const torrentListResponseSchema: Web_Api_TorrentListResponseSchema = z.object({
  errors: responseArraySchema(z.string()),
  items: responseArraySchema(torrentSchema),
});

/**
 * API - Transmission Free Space Schema.
 *
 * Mirrors Transmission's free-space response without renaming its stable key.
 * The wrapper converts the byte value for display after parsing.
 *
 * @since 2.0.0
 */
const transmissionFreeSpaceSchema: Web_Api_TransmissionFreeSpaceSchema = z.object({
  'size-bytes': z.number().nonnegative(),
});

/**
 * API - Torrent File Schema.
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
 * API - Torrent File Stats Schema.
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
 * API - Torrent Peer Schema.
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
 * API - Torrent Tracker Schema.
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
 * API - Torrent Tracker Stats Schema.
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
 * API - Torrent Detail Schema.
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
  ]).transform((value) => value === true || value === 1)).optional(),
  'webseeds': responseArraySchema(z.string()).optional(),
}).loose();

/**
 * API - Statistics Period Schema.
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
 * API - Statistics Schema.
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
 * API - Blocklist Source Status Schema.
 *
 * Validates one saved source's current result and optional last-good copy.
 * The parent status schema preserves the saved source order for the console.
 *
 * @since 2.0.0
 */
const blocklistSourceStatusSchema: Web_Api_BlocklistSourceStatusSchema = z.object({
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
 * API - Blocklist Status Schema.
 *
 * Validates the merger state displayed beside the global blocklist settings.
 * Null source lists are normalized like every other API response collection.
 *
 * @since 2.0.0
 */
const blocklistStatusSchema: Web_Api_BlocklistStatusSchema = z.object({
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
 * API - Setting Schema.
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
 * API - Settings Schema.
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
 * API - Torrent Organization Schema.
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
 * API - Update Torrent Organization Response Schema.
 *
 * Retains the changed-torrent count returned after label removals and renames.
 * The saved revision and normalized labels share the ordinary organization shape.
 *
 * @since 2.0.0
 */
const updateTorrentOrganizationResponseSchema: Web_Api_UpdateTorrentOrganizationResponseSchema = torrentOrganizationSchema.extend({
  changedTorrents: z.number().int().nonnegative(),
});

/**
 * API - Directory Entry Schema.
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
 * API - Directory Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const directorySchema: Web_Api_DirectorySchema = z.object({
  downloadAllowed: z.boolean(),
  downloadUnavailableReason: z.string().optional(),
  path: z.string(),
  parentPath: z.string().optional(),
  directories: responseArraySchema(directoryEntrySchema),
});

/**
 * API - Vpn Connection Schema.
 *
 * Covers the complete stored, runtime, daemon, and usage contract for one
 * independently managed connection.
 *
 * @since 2.0.0
 */
const vpnConnectionSchema: Web_Api_VpnConnectionSchema = z.object({
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
 * API - Vpn Connections Response Schema.
 *
 * Validates the sorted collection and its resource-derived capacity metadata.
 * The global change flag gates create, delete, and default actions.
 *
 * @since 2.0.0
 */
const vpnConnectionsResponseSchema: Web_Api_VpnConnectionsResponseSchema = z.object({
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
 * API - Vpn Connection Response Schema.
 *
 * Wraps create, read, update, reconnect, and disconnect responses exactly as
 * the connection routes return them.
 *
 * @since 2.0.0
 */
const vpnConnectionResponseSchema: Web_Api_VpnConnectionResponseSchema = z.object({
  connection: vpnConnectionSchema,
});

/**
 * API - Moved Torrent Schema.
 *
 * Describes both successful and failed moves shared by connection removal,
 * profile updates, and torrent reassignment responses.
 *
 * @since 2.0.0
 */
const movedTorrentSchema: Web_Api_MovedTorrentSchema = z.object({
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
 * API - Vpn Default Response Schema.
 *
 * Validates the updated connection list and every attempted Default-profile
 * torrent move returned after the default changes.
 *
 * @since 2.0.0
 */
const vpnDefaultResponseSchema: Web_Api_VpnDefaultResponseSchema = z.object({
  connections: responseArraySchema(vpnConnectionSchema),
  moved: responseArraySchema(movedTorrentSchema),
});

/**
 * API - Delete Torrent Profile Response Schema.
 *
 * Validates each move attempted after a named profile becomes Default.
 * Failed moves remain visible without treating the completed deletion as failed.
 *
 * @since 2.0.0
 */
const deleteTorrentProfileResponseSchema: Web_Api_DeleteTorrentProfileResponseSchema = z.object({
  moved: responseArraySchema(movedTorrentSchema),
});

/**
 * API - Delete Vpn Connection Response Schema.
 *
 * Validates the move results and the profile/login totals returned when a
 * non-default connection is removed.
 *
 * @since 2.0.0
 */
const deleteVpnConnectionResponseSchema: Web_Api_DeleteVpnConnectionResponseSchema = z.object({
  moved: responseArraySchema(movedTorrentSchema),
  profiles: z.number(),
  logins: z.number(),
});

/**
 * API - Torrent Profile Update Response Schema.
 *
 * Keeps the regular profile response while validating move results returned
 * after an owner confirms a cross-connection profile change.
 *
 * @since 2.0.0
 */
const torrentProfileUpdateResponseSchema: Web_Api_TorrentProfileUpdateResponseSchema = z.intersection(
  torrentProfileSchema,
  z.object({ moved: responseArraySchema(movedTorrentSchema) }),
);

/**
 * API - Default Torrent Profile Update Response Schema.
 *
 * Adds per-torrent move results to the saved Default profile fields.
 * Callers can refresh profile state and render movement outcomes from one reply.
 *
 * @since 2.0.0
 */
const defaultTorrentProfileUpdateResponseSchema: Web_Api_DefaultTorrentProfileUpdateResponseSchema = z.intersection(
  defaultTorrentProfileSchema,
  z.object({ moved: responseArraySchema(movedTorrentSchema) }),
);

/**
 * API - Torrent Profile Assignment Response Schema.
 *
 * Validates identifiers and any cross-connection torrent moves produced by the
 * detail drawer's profile assignment action.
 *
 * @since 2.0.0
 */
const torrentProfileAssignmentResponseSchema: Web_Api_TorrentProfileAssignmentResponseSchema = z.object({
  hashes: responseArraySchema(z.string()).optional(),
  ids: responseArraySchema(z.number()).optional(),
  profileId: z.string().nullable(),
  applyOptions: z.boolean(),
  moved: responseArraySchema(movedTorrentSchema),
});

/**
 * API - Transmission Restart Response Schema.
 *
 * A restart is accepted per daemon, so the aggregate status and every
 * connection result are retained even when only part of the fleet restarts.
 *
 * @since 2.0.0
 */
const transmissionRestartResponseSchema: Web_Api_TransmissionRestartResponseSchema = z.object({
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
 * API - Vpn Catalog Schema.
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
 * API - Provider Tunnel Schema.
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
 * API - Provider P2 P Schema.
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
 * API - Provider Schema.
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
 * API - Vpn Profile Schema.
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
 * API - Custom Profile Response Schema.
 *
 * Keeps the first endpoint flattened for compatibility and validates the full
 * ordered pool selected by the current console.
 *
 * @since 2.0.0
 */
const customProfileResponseSchema: Web_Api_CustomProfileResponseSchema = vpnProfileSchema.extend({
  profiles: responseArraySchema(vpnProfileSchema),
});

/**
 * API - Scope Schema.
 *
 * Encapsulates the related behavior behind one reusable interface.
 * Callers share the same lifecycle and state management.
 *
 * @since 2.0.0
 */
const scopeSchema: Web_Api_ScopeSchema = z.enum([
  'settings:read',
  'settings:write',
  'torrents:read',
  'torrents:write',
  'vpn:read',
  'vpn:write',
]);

/**
 * API - Token Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const tokenSchema: Web_Api_TokenSchema = z.object({
  id: z.string(),
  name: z.string(),
  scopes: responseArraySchema(scopeSchema),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
});

/**
 * API - Error Envelope Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const errorEnvelopeSchema: Web_Api_ErrorEnvelopeSchema = z.object({
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
 * API - Setup Status Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const setupStatusSchema: Web_Api_SetupStatusSchema = z.object({
  claimRequired: z.boolean(),
  claimExpiresAt: z.string().optional(),
});

/**
 * API - Removed Secret Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const removedSecretSchema: Web_Api_RemovedSecretSchema = z.object({
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
 * API - Administrator Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const administratorSchema: Web_Api_AdministratorSchema = z.object({
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
 * API - Authentication Response Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const authenticationResponseSchema: Web_Api_AuthenticationResponseSchema = z.object({
  status: z.literal('authenticated'),
  administrator: z.object({
    id: z.number(),
    username: z.string(),
  }),
  csrfToken: z.string(),
  expiresAt: z.string(),
});

/**
 * API - Login Result Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const loginResultSchema: Web_Api_LoginResultSchema = z.union([
  authenticationResponseSchema,
  z.object({
    status: z.literal('second_factor_required'),
    challenge: z.string(),
    expiresAt: z.string(),
  }),
]);

/**
 * API - Passkey Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const passkeySchema: Web_Api_PasskeySchema = z.object({
  id: z.string(),
  name: z.string(),
  hostname: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
});

/**
 * API - Account Security Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const accountSecuritySchema: Web_Api_AccountSecuritySchema = z.object({
  username: z.string(),
  totpEnabled: z.boolean(),
  recoveryCodesRemaining: z.number(),
  passkeys: responseArraySchema(passkeySchema),
  passkeysAvailable: z.boolean(),
  hostname: z.string(),
});

/**
 * API - Totp Setup Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const totpSetupSchema: Web_Api_TotpSetupSchema = z.object({
  secret: z.string(),
  uri: z.string(),
  qrCode: z.string(),
});

/**
 * API - Recovery Codes Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const recoveryCodesSchema: Web_Api_RecoveryCodesSchema = z.object({
  recoveryCodes: responseArraySchema(z.string()),
});

/**
 * API - Passkey Ceremony Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const passkeyCeremonySchema: Web_Api_PasskeyCeremonySchema = z.object({
  ceremonyId: z.string(),
  options: z.record(z.string(), z.unknown()),
});

/**
 * API - Live Snapshot Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const liveSnapshotSchema: Web_Api_LiveSnapshotSchema = z.object({
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
 * API - Providers Response Schema.
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
 * API - Profiles Response Schema.
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
 * API - Tokens Response Schema.
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
 * API - Created Token Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const createdTokenSchema: Web_Api_CreatedTokenSchema = z.object({
  token: tokenSchema,
  plaintext: z.string(),
});

/**
 * API - Rpc Login Schema.
 *
 * Describes one independently revocable Transmission-compatible RPC login.
 * Password material is intentionally absent from list responses.
 *
 * @since 2.0.0
 */
const rpcLoginSchema: Web_Api_RpcLoginSchema = z.object({
  id: z.string(),
  username: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
});

/**
 * API - Rpc Credential Schema.
 *
 * A generated password is present only in the create or regenerate response.
 * The surrounding login metadata always uses the safe schema above.
 *
 * @since 2.0.0
 */
const rpcCredentialSchema: Web_Api_RpcCredentialSchema = z.object({
  login: rpcLoginSchema,
  password: z.string().optional(),
});

/**
 * API - Rpc Logins Response Schema.
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
 * API - Web Proxy Login Schema.
 *
 * Describes a login without returning its stored password verifier.
 * PasswordSet communicates usability without exposing a secret.
 *
 * @since 2.0.0
 */
const webProxyLoginSchema: Web_Api_WebProxyLoginSchema = z.object({
  id: z.string(),
  username: z.string(),
  passwordSet: z.boolean(),
  connectionId: z.string().nullable(),
  effectiveConnectionId: z.string(),
});

/**
 * API - Web Proxy Credential Schema.
 *
 * A generated password is present only in the create or regenerate response.
 * The surrounding login metadata always uses the safe schema above.
 *
 * @since 2.0.0
 */
const webProxyCredentialSchema: Web_Api_WebProxyCredentialSchema = z.object({
  login: webProxyLoginSchema,
  password: z.string().optional(),
});

/**
 * API - Web Proxy Schema.
 *
 * Combines desired state, observed runtime state, and login metadata.
 * The state enum matches every value emitted by the proxy process.
 *
 * @since 2.0.0
 */
const webProxySchema: Web_Api_WebProxySchema = z.object({
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
 * API - Notification Target Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const notificationTargetSchema: Web_Api_NotificationTargetSchema = z.object({
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
 * API - Notification Targets Response Schema.
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
 * API - Notification Events Response Schema.
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
 * API - Notification Test Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const notificationTestSchema: Web_Api_NotificationTestSchema = z.object({
  delivered: z.boolean(),
  details: z.string().optional(),
  message: z.string().optional(),
});

/**
 * API - Torrent Contents Download Schema.
 *
 * Reads the link a prepared download of finished files is fetched from, and how many
 * selected torrents it left out.
 *
 * @since 2.2.0
 */
const torrentContentsDownloadSchema: Web_Api_TorrentContentsDownloadSchema = z.object({
  fileName: z.string(),
  path: z.string().startsWith('/api/v1/torrents/contents/'),
  size: z.number(),
  unavailable: z.number(),
  unfinished: z.number(),
});

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
  public readonly code: Web_Api_ApiError_Code;

  /**
   * API - Status.
   *
   * Stores this module-level value in one named location.
   * Related code reuses it instead of duplicating the definition.
   *
   * @since 2.0.0
   */
  public readonly status: Web_Api_ApiError_Status;

  /**
   * API - Issues.
   *
   * Stores this module-level value in one named location.
   * Related code reuses it instead of duplicating the definition.
   *
   * @since 2.0.0
   */
  public readonly issues: Web_Api_ApiError_Issues;

  /**
   * API - Details.
   *
   * Preserves route-specific conflict metadata used by move confirmations and
   * partial-failure summaries without weakening the stable error envelope.
   *
   * @since 2.0.0
   */
  public readonly details: Web_Api_ApiError_Details;

  /**
   * API - Constructor.
   *
   * Stores this module-level value in one named location.
   * Related code reuses it instead of duplicating the definition.
   *
   * @since 2.0.0
   */
  public constructor(
    message: Web_Api_ApiError_Constructor_Message,
    code: Web_Api_ApiError_Constructor_Code,
    status: Web_Api_ApiError_Constructor_Status,
    issues: Web_Api_ApiError_Constructor_Issues,
    details: Web_Api_ApiError_Constructor_Details = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.issues = issues;
    this.details = details;

    return;
  }
}

/**
 * API - Is Vpn Connection Required Error.
 *
 * Lets add surfaces pair first-run guidance with navigation to the VPN page.
 * Other API failures remain ordinary errors.
 *
 * @param {Web_Api_IsVpnConnectionRequiredError_CaughtError} caughtError - Caught error.
 *
 * @returns {Web_Api_IsVpnConnectionRequiredError_Returns}
 *
 * @since 2.0.0
 */
export const isVPNConnectionRequiredError = (caughtError: Web_Api_IsVpnConnectionRequiredError_CaughtError): Web_Api_IsVpnConnectionRequiredError_Returns => (
  caughtError instanceof ApiError && caughtError['code'] === 'vpn_connection_required'
);

// issueFor returns the message the API attached to one form field, if any.

/**
 * API - Issue For.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_Api_IssueFor_CaughtError} caughtError - Caught error.
 * @param {Web_Api_IssueFor_Field}       field       - Field.
 *
 * @returns {Web_Api_IssueFor_Returns}
 *
 * @since 2.0.0
 */
export const issueFor = (caughtError: Web_Api_IssueFor_CaughtError, field: Web_Api_IssueFor_Field): Web_Api_IssueFor_Returns => {
  if (!(caughtError instanceof ApiError)) {
    return '';
  }

  const issue: Web_Api_IssueFor_Issue = caughtError.issues.find(
    (candidate) => candidate['field'] === field,
  );

  return (issue === undefined) ? '' : formatConsoleError(issue['message']);
};

// summaryFor returns the banner text for an error, or nothing when a shown field already carries it.

/**
 * API - Summary For.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_Api_SummaryFor_CaughtError} caughtError - Caught error.
 * @param {Web_Api_SummaryFor_ShownFields} shownFields - Shown fields.
 * @param {Web_Api_SummaryFor_Fallback}    fallback    - Fallback.
 *
 * @returns {Web_Api_SummaryFor_Returns}
 *
 * @since 2.0.0
 */
export const summaryFor = (caughtError: Web_Api_SummaryFor_CaughtError, shownFields: Web_Api_SummaryFor_ShownFields, fallback: Web_Api_SummaryFor_Fallback): Web_Api_SummaryFor_Returns => {
  if (caughtError === null || caughtError === undefined) {
    return '';
  }

  if (
    caughtError instanceof ApiError
    && caughtError.issues.some(
      (issue) => shownFields.includes(issue['field']),
    ) === true
  ) {
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
 * API - Message For API Error.
 *
 * Converts stable machine codes into console wording that names the field or
 * choice the owner can correct. Controller diagnostics and resource IDs never
 * become user-visible text.
 *
 * @param {Web_Api_MessageForApiError_Code}    code      - Code.
 * @param {Web_Api_MessageForApiError_Status}  status    - Status.
 * @param {Web_Api_MessageForApiError_Message} message   - Message.
 * @param {Web_Api_MessageForApiError_Details} [details] - Details.
 *
 * @returns {Web_Api_MessageForApiError_Returns}
 *
 * @since 2.0.0
 */
export const messageForAPIError = (
  code: Web_Api_MessageForApiError_Code,
  status: Web_Api_MessageForApiError_Status,
  message: Web_Api_MessageForApiError_Message,
  details: Web_Api_MessageForApiError_Details = {},
): Web_Api_MessageForApiError_Returns => {
  const normalizedMessage: Web_Api_MessageForApiError_NormalizedMessage = message.toLowerCase();

  if (
    status === 503
    && normalizedMessage.includes('transmission') === true
    && normalizedMessage.includes('still starting') === true
  ) {
    return formatConsoleError(message);
  }

  switch (code) {
    case 'capacity_reached': {
      const limit: Web_Api_MessageForApiError_Limit = details['limit'];

      if (typeof limit === 'number' && Number.isFinite(limit) === true) {
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
        message.endsWith('\'s torrents must move to its download folder.') === true
        || message.endsWith('\'s torrents must move to the new default VPN connection.') === true
        || (
          message.startsWith('The profile\'s torrents must move to ') === true
          && message.endsWith(' before it can be deleted.') === true
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
 * API - Connection Being Removed Message.
 *
 * Adds the console's visible connection name to the backend's stable conflict.
 * Mutation screens use it without exposing the machine-readable error code.
 *
 * @param {Web_Api_ConnectionBeingRemovedMessage_CaughtError}    caughtError    - Caught error.
 * @param {Web_Api_ConnectionBeingRemovedMessage_ConnectionName} connectionName - Connection name.
 *
 * @returns {Web_Api_ConnectionBeingRemovedMessage_Returns}
 *
 * @since 2.0.0
 */
export const connectionBeingRemovedMessage = (
  caughtError: Web_Api_ConnectionBeingRemovedMessage_CaughtError,
  connectionName: Web_Api_ConnectionBeingRemovedMessage_ConnectionName,
): Web_Api_ConnectionBeingRemovedMessage_Returns => {
  if (!(caughtError instanceof ApiError) || caughtError['code'] !== 'connection_being_removed') {
    return null;
  }

  return `${connectionName} is being removed. Pick another connection.`;
};

// responseError converts the stable API error envelope into an ApiError.

/**
 * API - Response Error.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Response} response - Response.
 *
 * @returns {Web_Api_ResponseError_Returns}
 *
 * @since 2.0.0
 */
const responseError = async (response: Response): Web_Api_ResponseError_Returns => {
  const responseValue: Web_Api_ResponseError_ResponseValue = await response.json().catch(() => undefined);
  const parsedError: Web_Api_ResponseError_ParsedError = errorEnvelopeSchema.safeParse(responseValue);

  if (parsedError.success === true) {
    const details: Web_Api_ResponseError_Details = parsedError.data['error']['details'] ?? {};

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
 * API - Read Cookie.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_Api_ReadCookie_Name} name - Name.
 *
 * @returns {Web_Api_ReadCookie_Returns}
 *
 * @since 2.0.0
 */
const readCookie = (name: Web_Api_ReadCookie_Name): Web_Api_ReadCookie_Returns => {
  const prefix: Web_Api_ReadCookie_Prefix = `${name}=`;
  const parts: Web_Api_ReadCookie_Parts = document.cookie.split(';');
  const matchingPart: Web_Api_ReadCookie_MatchingPart = parts
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return (matchingPart === undefined) ? undefined : decodeURIComponent(matchingPart.slice(prefix.length));
};

// requestJSON performs one same-origin request and validates its response contract.

/**
 * API - Request JSON.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_Api_RequestJson_Path}      path      - Path.
 * @param {Web_Api_Schema<ResponseValue>} schema    - Schema.
 * @param {Web_Api_Request_Options}       [options] - Options.
 *
 * @returns {Promise<ResponseValue>}
 *
 * @since 2.0.0
 */
const requestJSON = async <ResponseValue>(
  path: Web_Api_RequestJson_Path,
  schema: Web_Api_Schema<ResponseValue>,
  options: Web_Api_Request_Options = {},
): Promise<ResponseValue> => {
  const requestBody: Web_Api_RequestJson_RequestBody = options['body'];
  const baseOptions: Web_Api_RequestJson_BaseOptions = { ...options };

  Reflect.deleteProperty(baseOptions, 'body');

  const headers: Headers = new Headers(options.headers);

  if (requestBody !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  if (
    options.method !== undefined
    && options.method !== 'GET'
    && options.method !== 'HEAD'
  ) {
    const csrfToken: Web_Api_RequestJson_CsrfToken = readCookie('tvpn_csrf');

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

  if (response.ok === false) {
    throw await responseError(response);
  }

  const responseValue: Web_Api_RequestJson_ResponseValue = await response.json();
  const parsedResponse: Web_Api_RequestJson_ParsedResponse<ResponseValue> = schema.safeParse(responseValue);

  // A request can succeed even when its reply doesn't match, so point to a reload rather than a retry.
  if (parsedResponse.success === false) {
    throw new ApiError('The server\'s reply couldn\'t be read. Reload the page to see the latest state.', 'invalid_response', response.status, []);
  }

  return parsedResponse.data;
};

// requestVoid performs one mutation whose successful response has no body.

/**
 * API - Request Void.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_Api_RequestVoid_Path} path    - Path.
 * @param {Web_Api_Request_Options}  options - Options.
 *
 * @returns {Web_Api_RequestVoid_Returns}
 *
 * @since 2.0.0
 */
const requestVoid = async (
  path: Web_Api_RequestVoid_Path,
  options: Web_Api_Request_Options,
): Web_Api_RequestVoid_Returns => {
  const requestBody: Web_Api_RequestVoid_RequestBody = options['body'];
  const baseOptions: Web_Api_RequestVoid_BaseOptions = { ...options };

  Reflect.deleteProperty(baseOptions, 'body');

  const headers: Headers = new Headers(options.headers);
  const csrfToken: Web_Api_RequestVoid_CsrfToken = readCookie('tvpn_csrf');

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

  if (response.ok === false) {
    throw await responseError(response);
  }

  return;
};

/**
 * API - Get Setup Status.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {Web_Api_GetSetupStatus_Returns}
 *
 * @since 2.0.0
 */
export const getSetupStatus = async (): Web_Api_GetSetupStatus_Returns => requestJSON(
  '/api/v1/setup/status',
  setupStatusSchema,
);

/**
 * API - Get Current Administrator.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {Web_Api_GetCurrentAdministrator_Returns}
 *
 * @since 2.0.0
 */
export const getCurrentAdministrator = async (): Web_Api_GetCurrentAdministrator_Returns => {
  const response: Response = await fetch('/api/v1/auth/me', {
    credentials: 'same-origin',
  });

  if (response.status === 401) {
    return null;
  }

  if (response.ok === false) {
    throw await responseError(response);
  }

  const responseValue: Web_Api_GetCurrentAdministrator_ResponseValue = await response.json();

  return administratorSchema.parse(responseValue);
};

/**
 * API - Claim Installation.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_Api_ClaimInput} input - Input.
 *
 * @returns {Web_Api_ClaimInstallation_Returns}
 *
 * @since 2.0.0
 */
export const claimInstallation = async (
  input: Web_Api_ClaimInput,
): Web_Api_ClaimInstallation_Returns => {
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
 * @param {Web_Api_LoginInput} input - Input.
 *
 * @returns {Web_Api_Login_Returns}
 *
 * @since 2.0.0
 */
export const login = async (
  input: Web_Api_LoginInput,
): Web_Api_Login_Returns => {
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
 * @returns {Web_Api_Logout_Returns}
 *
 * @since 2.0.0
 */
export const logout = async (): Web_Api_Logout_Returns => requestVoid(
  '/api/v1/auth/logout',
  { method: 'POST' },
);

/**
 * API - Dismiss Removed Secrets.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {Web_Api_DismissRemovedSecrets_Returns}
 *
 * @since 2.0.0
 */
export const dismissRemovedSecrets = async (): Web_Api_DismissRemovedSecrets_Returns => requestVoid(
  '/api/v1/auth/removed-secrets',
  { method: 'DELETE' },
);

/**
 * API - Get Blocklist Status.
 *
 * Reads the merger's aggregate and per-source state for the Settings page.
 * Response parsing keeps unexpected null source lists safe for rendering.
 *
 * @returns {Web_Api_GetBlocklistStatus_Returns}
 *
 * @since 2.0.0
 */
export const getBlocklistStatus = async (): Web_Api_GetBlocklistStatus_Returns => requestJSON(
  '/api/v1/blocklists',
  blocklistStatusSchema,
);

/**
 * API - Request Blocklist Update.
 *
 * Queues one merger run and accepts the endpoint's empty 202 response.
 * The Settings page polls status until the requested run is observed.
 *
 * @returns {Web_Api_RequestBlocklistUpdate_Returns}
 *
 * @since 2.0.0
 */
export const requestBlocklistUpdate = async (): Web_Api_RequestBlocklistUpdate_Returns => requestVoid(
  '/api/v1/blocklists/update',
  { method: 'POST' },
);

/**
 * API - Get Settings.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {Web_Api_GetSettings_Returns}
 *
 * @since 2.0.0
 */
export const getSettings = async (): Web_Api_GetSettings_Returns => requestJSON(
  '/api/v1/settings',
  settingsSchema,
);

/**
 * API - Update Settings.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_Api_UpdateSettingsInput}                input                 - Input.
 * @param {Web_Api_UpdateSettings_IncompleteDirectory} [incompleteDirectory] - Incomplete directory.
 *
 * @returns {Web_Api_UpdateSettings_Returns}
 *
 * @since 2.0.0
 */
export const updateSettings = async (
  input: Web_Api_UpdateSettingsInput,
  incompleteDirectory?: Web_Api_UpdateSettings_IncompleteDirectory,
): Web_Api_UpdateSettings_Returns => {
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
 * API - Restart Transmission.
 *
 * Applies pending restart settings after an explicit confirmation from the settings view.
 * The caller refreshes settings after the accepted restart request.
 *
 * @returns {Web_Api_RestartTransmission_Returns}
 *
 * @since 2.0.0
 */
export const restartTransmission = async (): Web_Api_RestartTransmission_Returns => {
  await requestJSON(
    '/api/v1/transmission/restart',
    transmissionRestartResponseSchema,
    {
      method: 'POST',
      body: { confirm: true },
    },
  );

  return;
};

/**
 * API - Get Torrent Organization.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {Web_Api_GetTorrentOrganization_Returns}
 *
 * @since 2.0.0
 */
export const getTorrentOrganization = async (): Web_Api_GetTorrentOrganization_Returns => requestJSON(
  '/api/v1/torrent-organization',
  torrentOrganizationSchema,
);

/**
 * API - Update Torrent Organization.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @returns {Web_Api_UpdateTorrentOrganization_Returns}
 *
 * @since 2.0.0
 */
export const updateTorrentOrganization = async (
  input: Web_Api_UpdateTorrentOrganizationInput,
): Web_Api_UpdateTorrentOrganization_Returns => {
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
 * API - Get Torrent Profiles.
 *
 * Returns the effective Default profile and alphabetically sorted named profiles.
 * Pattern matching can therefore report every match without using display order.
 *
 * @returns {Web_Api_GetTorrentProfiles_Returns}
 *
 * @since 2.0.0
 */
export const getTorrentProfiles = async (): Web_Api_GetTorrentProfiles_Returns => requestJSON(
  '/api/v1/torrent-profiles',
  torrentProfilesResponseSchema,
);

/**
 * API - Create Torrent Profile.
 *
 * Validates editor values before creating a server-owned profile.
 * The returned profile includes its generated identity and pattern overlaps.
 *
 * @returns {Web_Api_CreateTorrentProfile_Returns}
 *
 * @since 2.0.0
 */
export const createTorrentProfile = async (
  input: Web_Api_TorrentProfileInput,
  incompleteDirectory?: Web_Api_CreateTorrentProfile_IncompleteDirectory,
): Web_Api_CreateTorrentProfile_Returns => {
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
 * API - Update Torrent Profile.
 *
 * Replaces the editable values of one existing profile.
 * Identity remains controlled by the server; named profiles display alphabetically.
 *
 * @returns {Web_Api_UpdateTorrentProfile_Returns}
 *
 * @since 2.0.0
 */
export const updateTorrentProfile = async (
  profileId: Web_Api_UpdateTorrentProfile_ProfileId,
  input: Web_Api_TorrentProfileInput,
  moveTorrents: Web_Api_UpdateTorrentProfile_MoveTorrents = false,
  incompleteDirectory?: Web_Api_UpdateTorrentProfile_IncompleteDirectory,
): Web_Api_UpdateTorrentProfile_Returns => {
  const updateInput: Web_Api_UpdateTorrentProfileInput = {
    ...input,
    ...((moveTorrents === true) ? { moveTorrents: true as const } : {}),
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
 * API - Update Default Torrent Profile.
 *
 * Saves the Default profile fields and optionally confirms moving its assigned
 * torrents when the download directory changes.
 *
 * @returns {Web_Api_UpdateDefaultTorrentProfile_Returns}
 *
 * @since 2.0.0
 */
export const updateDefaultTorrentProfile = async (
  input: Web_Api_DefaultTorrentProfileInput,
  moveTorrents: Web_Api_UpdateDefaultTorrentProfile_MoveTorrents = false,
  incompleteDirectory?: Web_Api_UpdateDefaultTorrentProfile_IncompleteDirectory,
): Web_Api_UpdateDefaultTorrentProfile_Returns => {
  const updateInput: Web_Api_UpdateDefaultTorrentProfileInput = {
    ...input,
    ...((moveTorrents === true) ? { moveTorrents: true as const } : {}),
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
 * API - Delete Torrent Profile.
 *
 * Confirms moving assigned torrents through the Default profile's existing
 * folder and connection path without applying its labels or limits.
 *
 * @returns {Web_Api_DeleteTorrentProfile_Returns}
 *
 * @since 2.0.0
 */
export const deleteTorrentProfile = async (
  profileId: Web_Api_DeleteTorrentProfile_ProfileId,
  moveTorrents: Web_Api_DeleteTorrentProfile_MoveTorrents = false,
): Web_Api_DeleteTorrentProfile_Returns => {
  const path: Web_Api_DeleteTorrentProfile_Path = `/api/v1/torrent-profiles/${encodeURIComponent(profileId)}`;

  if (moveTorrents === false) {
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
 * API - Get Directory.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {Web_Api_GetDirectory_Returns}
 *
 * @since 2.0.0
 */
export const getDirectory = async (
  path: Web_Api_GetDirectory_Path,
  purpose: Web_Api_DirectoryPurpose = 'download',
  profileId?: Web_Api_GetDirectory_ProfileId,
): Web_Api_GetDirectory_Returns => {
  const validatedPath: Web_Api_GetDirectory_ValidatedPath = parseDataPath(path);
  const query: Web_Api_GetDirectory_Query = new URLSearchParams({
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
 * API - Delete Directory.
 *
 * Removes one empty, unassigned folder after the server repeats every safety
 * check. Success has no response body, so callers refresh the parent listing.
 *
 * @param {Web_Api_DeleteDirectory_Path} path    - Path.
 * @param {Web_Api_DirectoryPurpose}     purpose - Purpose.
 *
 * @returns {Web_Api_DeleteDirectory_Returns}
 *
 * @since 2.0.0
 */
export const deleteDirectory = async (
  path: Web_Api_DeleteDirectory_Path,
  purpose: Web_Api_DirectoryPurpose = 'download',
  profileId?: Web_Api_DeleteDirectory_ProfileId,
): Web_Api_DeleteDirectory_Returns => {
  const validatedPath: Web_Api_DeleteDirectory_ValidatedPath = parseDataPath(path);
  const query: Web_Api_DeleteDirectory_Query = new URLSearchParams({
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
 * API - Get Transmission Free Space.
 *
 * Returns the available byte count for one validated data path.
 * A caller may hide this optional information if the request fails.
 *
 * @returns {Web_Api_GetTransmissionFreeSpace_Returns}
 *
 * @since 2.0.0
 */
export const getTransmissionFreeSpace = async (path: Web_Api_GetTransmissionFreeSpace_Path): Web_Api_GetTransmissionFreeSpace_Returns => {
  const validatedPath: Web_Api_GetTransmissionFreeSpace_ValidatedPath = parseDataPath(path);
  const query: Web_Api_GetTransmissionFreeSpace_Query = new URLSearchParams({ path: validatedPath }).toString();
  const response: Web_Api_TransmissionFreeSpace = await requestJSON(
    `/api/v1/transmission/free-space?${query}`,
    transmissionFreeSpaceSchema,
  );

  return response['size-bytes'];
};

/**
 * API - Create Directory.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @returns {Web_Api_CreateDirectory_Returns}
 *
 * @since 2.0.0
 */
export const createDirectory = async (
  input: Web_Api_CreateDirectoryInput,
  purpose: Web_Api_DirectoryPurpose = 'download',
  profileId?: Web_Api_CreateDirectory_ProfileId,
): Web_Api_CreateDirectory_Returns => {
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
 * API - Get Providers.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {Web_Api_GetProviders_Returns}
 *
 * @since 2.0.0
 */
export const getProviders = async (): Web_Api_GetProviders_Returns => {
  const response: Web_Api_GetProviders_Response = await requestJSON('/api/v1/vpn/providers', providersResponseSchema);

  return response['items'];
};

/**
 * API - Get Vpn Connections.
 *
 * Reads every stored connection with runtime, daemon, usage, and capacity state.
 * The server returns rows in slot order for a stable list.
 *
 * @returns {Web_Api_GetVpnConnections_Returns}
 *
 * @since 2.0.0
 */
export const getVPNConnections = async (): Web_Api_GetVpnConnections_Returns => requestJSON(
  '/api/v1/vpn/connections',
  vpnConnectionsResponseSchema,
);

/**
 * API - Get Vpn Connection.
 *
 * Reads one connection when a direct editor refresh needs the latest revision.
 * The collection remains the source for capacity and list ordering.
 *
 * @returns {Web_Api_GetVpnConnection_Returns}
 *
 * @since 2.0.0
 */
export const getVPNConnection = async (connectionId: Web_Api_GetVpnConnection_ConnectionId): Web_Api_GetVpnConnection_Returns => {
  const validatedConnectionID: Web_Api_GetVpnConnection_ValidatedConnectionId = parseProviderID(connectionId);
  const response: Web_Api_VpnConnectionResponse = await requestJSON(
    `/api/v1/vpn/connections/${encodeURIComponent(validatedConnectionID)}`,
    vpnConnectionResponseSchema,
  );

  return response['connection'];
};

/**
 * API - Get Profiles.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {Web_Api_GetProfiles_Returns}
 *
 * @since 2.0.0
 */
export const getProfiles = async (providerId: Web_Api_GetProfiles_ProviderId): Web_Api_GetProfiles_Returns => {
  const validatedProviderID: Web_Api_GetProfiles_ValidatedProviderId = parseProviderID(providerId);
  const query: Web_Api_GetProfiles_Query = new URLSearchParams({ provider: validatedProviderID }).toString();
  const response: Web_Api_GetProfiles_Response = await requestJSON(`/api/v1/vpn/profiles?${query}`, profilesResponseSchema);

  return response['items'];
};

/**
 * API - Upload Custom Profile.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @returns {Web_Api_UploadCustomProfile_Returns}
 *
 * @since 2.0.0
 */
export const uploadCustomProfile = async (
  tunnel: Web_Api_VpnTunnel,
  profileName: Web_Api_UploadCustomProfile_ProfileName,
  profile: Web_Api_UploadCustomProfile_Profile,
): Web_Api_UploadCustomProfile_Returns => {
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
 * API - Refresh Vpn Catalog.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {Web_Api_RefreshVpnCatalog_Returns}
 *
 * @since 2.0.0
 */
export const refreshVPNCatalog = async (providerId: Web_Api_RefreshVpnCatalog_ProviderId, tunnel: Web_Api_VpnTunnel): Web_Api_RefreshVpnCatalog_Returns => {
  const validatedProviderID: Web_Api_RefreshVpnCatalog_ValidatedProviderId = parseProviderID(providerId);
  const validatedTunnel: Web_Api_VpnTunnel = vpnTunnelSchema.parse(tunnel);

  await requestJSON(
    `/api/v1/vpn/providers/${encodeURIComponent(validatedProviderID)}/tunnels/${validatedTunnel}/catalog/refresh`,
    vpnCatalogSchema,
    { method: 'POST' },
  );

  return;
};

/**
 * API - Create Vpn Connection.
 *
 * Tests and connects a named candidate before the server commits it.
 * The returned connection includes its assigned slot and initial revision.
 *
 * @returns {Web_Api_CreateVpnConnection_Returns}
 *
 * @since 2.0.0
 */
export const createVPNConnection = async (
  input: Web_Api_CreateVpnConnectionInput,
): Web_Api_CreateVpnConnection_Returns => {
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
 * API - Update Vpn Connection.
 *
 * Sends rename-only fields without configuration so the tunnel stays up.
 * Configuration changes use the server's test-and-connect transaction.
 *
 * @returns {Web_Api_UpdateVpnConnection_Returns}
 *
 * @since 2.0.0
 */
export const updateVPNConnection = async (
  connectionId: Web_Api_UpdateVpnConnection_ConnectionId,
  input: Web_Api_UpdateVpnConnectionInput,
): Web_Api_UpdateVpnConnection_Returns => {
  const validatedConnectionID: Web_Api_UpdateVpnConnection_ValidatedConnectionId = parseProviderID(connectionId);
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
 * API - Reconnect Vpn Connection.
 *
 * Restarts only the named connection and returns its latest runtime state.
 * Other tunnels and Transmission daemons remain untouched.
 *
 * @returns {Web_Api_ReconnectVpnConnection_Returns}
 *
 * @since 2.0.0
 */
export const reconnectVPNConnection = async (connectionId: Web_Api_ReconnectVpnConnection_ConnectionId): Web_Api_ReconnectVpnConnection_Returns => {
  const validatedConnectionID: Web_Api_ReconnectVpnConnection_ValidatedConnectionId = parseProviderID(connectionId);
  const response: Web_Api_VpnConnectionResponse = await requestJSON(
    `/api/v1/vpn/connections/${encodeURIComponent(validatedConnectionID)}/reconnect`,
    vpnConnectionResponseSchema,
    { method: 'POST' },
  );

  return response['connection'];
};

/**
 * API - Disconnect Vpn Connection.
 *
 * Blocks only the named connection while preserving its torrent list.
 * The returned row supplies the new disabled and runtime state.
 *
 * @returns {Web_Api_DisconnectVpnConnection_Returns}
 *
 * @since 2.0.0
 */
export const disconnectVPNConnection = async (connectionId: Web_Api_DisconnectVpnConnection_ConnectionId): Web_Api_DisconnectVpnConnection_Returns => {
  const validatedConnectionID: Web_Api_DisconnectVpnConnection_ValidatedConnectionId = parseProviderID(connectionId);
  const response: Web_Api_VpnConnectionResponse = await requestJSON(
    `/api/v1/vpn/connections/${encodeURIComponent(validatedConnectionID)}/disconnect`,
    vpnConnectionResponseSchema,
    { method: 'POST' },
  );

  return response['connection'];
};

/**
 * API - Set Default Vpn Connection.
 *
 * Switches DNS and Default-profile ownership after any required confirmation.
 * The response includes both changed rows and one result per attempted move.
 *
 * @returns {Web_Api_SetDefaultVpnConnection_Returns}
 *
 * @since 2.0.0
 */
export const setDefaultVPNConnection = async (
  input: Web_Api_SetDefaultVpnConnectionInput,
): Web_Api_SetDefaultVpnConnection_Returns => {
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
 * API - Delete Vpn Connection.
 *
 * An omitted destination probes dependency usage; a supplied destination moves
 * torrents, profiles, and logins before removing the connection.
 *
 * @returns {Web_Api_DeleteVpnConnection_Returns}
 *
 * @since 2.0.0
 */
export const deleteVPNConnection = async (
  connectionId: Web_Api_DeleteVpnConnection_ConnectionId,
  input: Web_Api_DeleteVpnConnectionInput,
): Web_Api_DeleteVpnConnection_Returns => {
  const validatedConnectionID: Web_Api_DeleteVpnConnection_ValidatedConnectionId = parseProviderID(connectionId);
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
 * API - Get Torrent Detail.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {Web_Api_GetTorrentDetail_Returns}
 *
 * @since 2.0.0
 */
export const getTorrentDetail = async (torrentId: Web_Api_GetTorrentDetail_TorrentId): Web_Api_GetTorrentDetail_Returns => requestJSON(
  `/api/v1/torrents/${torrentId}`,
  torrentDetailSchema,
);

/**
 * API - Get Torrents.
 *
 * Refreshes the complete torrent list outside the live-event cadence.
 * Organization saves use it to display renamed or removed labels immediately.
 *
 * @returns {Web_Api_GetTorrents_Returns}
 *
 * @since 2.0.0
 */
export const getTorrents = async (): Web_Api_GetTorrents_Returns => requestJSON(
  '/api/v1/torrents',
  torrentListResponseSchema,
);

/**
 * API - Add Torrent.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {Web_Api_AddTorrent_Returns}
 *
 * @since 2.0.0
 */
export const addTorrent = async (
  input: Web_Api_AddTorrentInput,
): Web_Api_AddTorrent_Returns => {
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
 * API - Preview Torrent Links.
 *
 * Resolves up to twenty links through the server's fail-closed protected route.
 * The console batches larger pastes and treats omitted items as quiet fallbacks.
 *
 * @returns {Web_Api_PreviewTorrentLinks_Returns}
 *
 * @since 2.0.0
 */
export const previewTorrentLinks = async (
  links: Web_Api_PreviewTorrentLinks_Links,
): Web_Api_PreviewTorrentLinks_Returns => requestJSON(
  '/api/v1/torrents/preview',
  torrentLinkPreviewResponseSchema,
  {
    body: { links },
    method: 'POST',
  },
);

/**
 * API - Run Torrent Action.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @returns {Web_Api_RunTorrentAction_Returns}
 *
 * @since 2.0.0
 */
export const runTorrentAction = async (
  action: Web_Api_TorrentAction,
  hashes: Web_Api_RunTorrentAction_Hashes,
): Web_Api_RunTorrentAction_Returns => {
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

  return;
};

/**
 * API - Remove Torrents.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @returns {Web_Api_RemoveTorrents_Returns}
 *
 * @since 2.0.0
 */
export const removeTorrents = async (
  hashes: Web_Api_RemoveTorrents_Hashes,
  deleteLocalData: Web_Api_RemoveTorrents_DeleteLocalData,
): Web_Api_RemoveTorrents_Returns => {
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
 * API - Update Torrents.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @returns {Web_Api_UpdateTorrents_Returns}
 *
 * @since 2.0.0
 */
export const updateTorrents = async (
  hashes: Web_Api_UpdateTorrents_Hashes,
  changes: Web_Api_TorrentChanges,
): Web_Api_UpdateTorrents_Returns => {
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

  return;
};

/**
 * API - Set Torrent Profile.
 *
 * Assigns or clears a profile and optionally applies its labels and limits.
 * The selected torrent identifiers are returned only as mutation confirmation.
 *
 * @returns {Web_Api_SetTorrentProfile_Returns}
 *
 * @since 2.0.0
 */
export const setTorrentProfile = async (
  input: Web_Api_SetTorrentProfileInput,
): Web_Api_SetTorrentProfile_Returns => {
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
 * API - Rename Torrent Path.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @returns {Web_Api_RenameTorrentPath_Returns}
 *
 * @since 2.0.0
 */
export const renameTorrentPath = async (
  input: Web_Api_RenameTorrentPathInput,
): Web_Api_RenameTorrentPath_Returns => {
  const validatedInput: Web_Api_RenameTorrentPathInput = parseRenameTorrentPathInput(input);

  await requestJSON(
    '/api/v1/torrents/rename',
    z.object({ hashes: responseArraySchema(z.string()) }).loose(),
    {
      method: 'POST',
      body: validatedInput,
    },
  );

  return;
};

/**
 * API - Get Rpc Logins.
 *
 * Returns login metadata without reusable passwords.
 * The response is safe to retain in application state.
 *
 * @returns {Web_Api_GetRpcLogins_Returns}
 *
 * @since 2.0.0
 */
export const getRPCLogins = async (): Web_Api_GetRpcLogins_Returns => {
  const response: Web_Api_GetRpcLogins_Response = await requestJSON('/api/v1/rpc/logins', rpcLoginsResponseSchema);

  return response['logins'];
};

/**
 * API - Create Rpc Login.
 *
 * Returns the generated password exactly once with the created login.
 * Later list responses contain only login metadata.
 *
 * @returns {Web_Api_CreateRpcLogin_Returns}
 *
 * @since 2.0.0
 */
export const createRPCLogin = async (
  input: Web_Api_RPCLoginInput,
): Web_Api_CreateRpcLogin_Returns => {
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
 * API - Update Rpc Login.
 *
 * Edits its username and optionally returns one regenerated password.
 * Omitting regeneration retains the saved verifier.
 *
 * @returns {Web_Api_UpdateRpcLogin_Returns}
 *
 * @since 2.0.0
 */
export const updateRPCLogin = async (
  loginId: Web_Api_UpdateRpcLogin_LoginId,
  input: Web_Api_UpdateRPCLoginInput,
): Web_Api_UpdateRpcLogin_Returns => {
  const validatedLoginID: Web_Api_UpdateRpcLogin_ValidatedLoginId = parseTokenID(loginId);
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
 * API - Delete Rpc Login.
 *
 * Revokes one compatible-RPC login immediately.
 * Remote clients using it stop authenticating at once.
 *
 * @returns {Web_Api_DeleteRpcLogin_Returns}
 *
 * @since 2.0.0
 */
export const deleteRPCLogin = async (loginId: Web_Api_DeleteRpcLogin_LoginId): Web_Api_DeleteRpcLogin_Returns => {
  const validatedLoginID: Web_Api_DeleteRpcLogin_ValidatedLoginId = parseTokenID(loginId);

  return requestVoid(
    `/api/v1/rpc/logins/${encodeURIComponent(validatedLoginID)}`,
    { method: 'DELETE' },
  );
};

/**
 * API - Get Web Proxy.
 *
 * Returns its desired state, observed state, and safe login metadata.
 * Runtime errors remain human-readable for the state card.
 *
 * @returns {Web_Api_GetWebProxy_Returns}
 *
 * @since 2.0.0
 */
export const getWebProxy = async (): Web_Api_GetWebProxy_Returns => requestJSON(
  '/api/v1/web-proxy',
  webProxySchema,
);

/**
 * API - Update Web Proxy.
 *
 * Enables or disables the proxy while preserving its login collection.
 * An enabled proxy with no logins refuses every authentication attempt.
 *
 * @returns {Web_Api_UpdateWebProxy_Returns}
 *
 * @since 2.0.0
 */
export const updateWebProxy = async (enabled: Web_Api_UpdateWebProxy_Enabled): Web_Api_UpdateWebProxy_Returns => requestJSON(
  '/api/v1/web-proxy',
  webProxySchema,
  {
    method: 'PUT',
    body: { enabled },
  },
);

/**
 * API - Create Web Proxy Login.
 *
 * Returns the generated password exactly once with the created login.
 * Later web proxy reads contain only login metadata.
 *
 * @returns {Web_Api_CreateWebProxyLogin_Returns}
 *
 * @since 2.0.0
 */
export const createWebProxyLogin = async (
  input: Web_Api_WebProxyLoginInput,
): Web_Api_CreateWebProxyLogin_Returns => {
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
 * API - Update Web Proxy Login.
 *
 * Edits its metadata and optionally returns one regenerated password.
 * Omitting regeneration retains the saved verifier.
 *
 * @returns {Web_Api_UpdateWebProxyLogin_Returns}
 *
 * @since 2.0.0
 */
export const updateWebProxyLogin = async (
  loginId: Web_Api_UpdateWebProxyLogin_LoginId,
  input: Web_Api_UpdateWebProxyLoginInput,
): Web_Api_UpdateWebProxyLogin_Returns => {
  const validatedLoginID: Web_Api_UpdateWebProxyLogin_ValidatedLoginId = parseTokenID(loginId);
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
 * API - Delete Web Proxy Login.
 *
 * Revokes one login and returns after the proxy configuration is republished.
 * Removing the final login leaves the proxy switch unchanged.
 *
 * @returns {Web_Api_DeleteWebProxyLogin_Returns}
 *
 * @since 2.0.0
 */
export const deleteWebProxyLogin = async (loginId: Web_Api_DeleteWebProxyLogin_LoginId): Web_Api_DeleteWebProxyLogin_Returns => {
  const validatedLoginID: Web_Api_DeleteWebProxyLogin_ValidatedLoginId = parseTokenID(loginId);

  return requestVoid(
    `/api/v1/web-proxy/logins/${encodeURIComponent(validatedLoginID)}`,
    { method: 'DELETE' },
  );
};

/**
 * API - Get Tokens.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {Web_Api_GetTokens_Returns}
 *
 * @since 2.0.0
 */
export const getTokens = async (): Web_Api_GetTokens_Returns => {
  const response: Web_Api_GetTokens_Response = await requestJSON('/api/v1/auth/tokens', tokensResponseSchema);

  return response['items'];
};

/**
 * API - Create Token.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @returns {Web_Api_CreateToken_Returns}
 *
 * @since 2.0.0
 */
export const createToken = async (
  input: Web_Api_CreateTokenInput,
): Web_Api_CreateToken_Returns => requestJSON(
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
 * API - Update Token.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @returns {Web_Api_UpdateToken_Returns}
 *
 * @since 2.0.0
 */
export const updateToken = async (
  tokenId: Web_Api_UpdateToken_TokenId,
  input: Web_Api_UpdateTokenInput,
): Web_Api_UpdateToken_Returns => {
  const validatedTokenID: Web_Api_UpdateToken_ValidatedTokenId = parseTokenID(tokenId);

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
 * API - Revoke Token.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {Web_Api_RevokeToken_Returns}
 *
 * @since 2.0.0
 */
export const revokeToken = async (tokenId: Web_Api_RevokeToken_TokenId): Web_Api_RevokeToken_Returns => {
  const validatedTokenID: Web_Api_RevokeToken_ValidatedTokenId = parseTokenID(tokenId);

  return requestVoid(
    `/api/v1/auth/tokens/${encodeURIComponent(validatedTokenID)}`,
    { method: 'DELETE' },
  );
};

/**
 * API - Get Notifications.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {Web_Api_GetNotifications_Returns}
 *
 * @since 2.0.0
 */
export const getNotifications = async (): Web_Api_GetNotifications_Returns => {
  const response: Web_Api_GetNotifications_Response = await requestJSON('/api/v1/notifications', notificationTargetsResponseSchema);

  return response['items'];
};

/**
 * API - Get Notification Events.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {Web_Api_GetNotificationEvents_Returns}
 *
 * @since 2.0.0
 */
export const getNotificationEvents = async (): Web_Api_GetNotificationEvents_Returns => {
  const response: Web_Api_GetNotificationEvents_Response = await requestJSON('/api/v1/notifications/events', notificationEventsResponseSchema);

  return response['items'];
};

/**
 * API - Create Notification.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @returns {Web_Api_CreateNotification_Returns}
 *
 * @since 2.0.0
 */
export const createNotification = async (
  input: Web_Notifications_CreateInput,
): Web_Api_CreateNotification_Returns => requestJSON(
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
 * API - Update Notification.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @returns {Web_Api_UpdateNotification_Returns}
 *
 * @since 2.0.0
 */
export const updateNotification = async (
  notificationId: Web_Api_UpdateNotification_NotificationId,
  input: Web_Notifications_UpdateInput,
): Web_Api_UpdateNotification_Returns => requestJSON(
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
 * API - Remove Notification.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {Web_Api_RemoveNotification_Returns}
 *
 * @since 2.0.0
 */
export const removeNotification = async (notificationId: Web_Api_RemoveNotification_NotificationId): Web_Api_RemoveNotification_Returns => requestVoid(
  `/api/v1/notifications/${encodeURIComponent(notificationId)}`,
  { method: 'DELETE' },
);

/**
 * API - Test Notification.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {Web_Api_TestNotification_Returns}
 *
 * @since 2.0.0
 */
export const testNotification = async (notificationId: Web_Api_TestNotification_NotificationId): Web_Api_TestNotification_Returns => requestJSON(
  `/api/v1/notifications/${encodeURIComponent(notificationId)}/test`,
  notificationTestSchema,
  { method: 'POST' },
);

/**
 * API - Submit Second Factor.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @returns {Web_Api_SubmitSecondFactor_Returns}
 *
 * @since 2.0.0
 */
export const submitSecondFactor = async (
  challenge: Web_Api_SubmitSecondFactor_Challenge,
  code: Web_Api_SubmitSecondFactor_Code,
): Web_Api_SubmitSecondFactor_Returns => requestJSON(
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
 * API - Sign In With Passkey.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {Web_Api_SignInWithPasskey_Returns}
 *
 * @since 2.0.0
 */
export const signInWithPasskey = async (): Web_Api_SignInWithPasskey_Returns => {
  const ceremony: Web_Api_PasskeyCeremony = await requestJSON(
    '/api/v1/auth/passkeys/login/options',
    passkeyCeremonySchema,
    { method: 'POST' },
  );
  const credential: Web_Api_SignInWithPasskey_Credential = await getPasskey(ceremony['options']);

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
 * API - Get Account Security.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {Web_Api_GetAccountSecurity_Returns}
 *
 * @since 2.0.0
 */
export const getAccountSecurity = async (): Web_Api_GetAccountSecurity_Returns => requestJSON(
  '/api/v1/auth/security',
  accountSecuritySchema,
);

/**
 * API - Change Password.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @returns {Web_Api_ChangePassword_Returns}
 *
 * @since 2.0.0
 */
export const changePassword = async (
  currentPassword: Web_Api_ChangePassword_CurrentPassword,
  newPassword: Web_Api_ChangePassword_NewPassword,
): Web_Api_ChangePassword_Returns => requestVoid(
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
 * API - Change Username.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @returns {Web_Api_ChangeUsername_Returns}
 *
 * @since 2.0.0
 */
export const changeUsername = async (
  username: Web_Api_ChangeUsername_Username,
  password: Web_Api_ChangeUsername_Password,
): Web_Api_ChangeUsername_Returns => {
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

  return;
};

/**
 * API - Start Totp Setup.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {Web_Api_StartTotpSetup_Returns}
 *
 * @since 2.0.0
 */
export const startTotpSetup = async (password: Web_Api_StartTotpSetup_Password): Web_Api_StartTotpSetup_Returns => requestJSON(
  '/api/v1/auth/totp/setup',
  totpSetupSchema,
  {
    method: 'POST',
    body: { password },
  },
);

/**
 * API - Enable Totp.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {Web_Api_EnableTotp_Returns}
 *
 * @since 2.0.0
 */
export const enableTotp = async (code: Web_Api_EnableTotp_Code): Web_Api_EnableTotp_Returns => requestJSON(
  '/api/v1/auth/totp/enable',
  recoveryCodesSchema,
  {
    method: 'POST',
    body: { code: code.trim() },
  },
);

/**
 * API - Disable Totp.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {Web_Api_DisableTotp_Returns}
 *
 * @since 2.0.0
 */
export const disableTotp = async (password: Web_Api_DisableTotp_Password): Web_Api_DisableTotp_Returns => requestVoid(
  '/api/v1/auth/totp/disable',
  {
    method: 'POST',
    body: { password },
  },
);

/**
 * API - Regenerate Recovery Codes.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {Web_Api_RegenerateRecoveryCodes_Returns}
 *
 * @since 2.0.0
 */
export const regenerateRecoveryCodes = async (password: Web_Api_RegenerateRecoveryCodes_Password): Web_Api_RegenerateRecoveryCodes_Returns => requestJSON(
  '/api/v1/auth/recovery-codes',
  recoveryCodesSchema,
  {
    method: 'POST',
    body: { password },
  },
);

/**
 * API - Add Passkey.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {Web_Api_AddPasskey_Returns}
 *
 * @since 2.0.0
 */
export const addPasskey = async (name: Web_Api_AddPasskey_Name, password: Web_Api_AddPasskey_Password): Web_Api_AddPasskey_Returns => {
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
  const credential: Web_Api_AddPasskey_Credential = await createPasskey(ceremony['options']);

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
 * API - Remove Passkey.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {Web_Api_RemovePasskey_Returns}
 *
 * @since 2.0.0
 */
export const removePasskey = async (passkeyId: Web_Api_RemovePasskey_PasskeyId, password: Web_Api_RemovePasskey_Password): Web_Api_RemovePasskey_Returns => requestVoid(
  `/api/v1/auth/passkeys/${encodeURIComponent(passkeyId)}`,
  {
    method: 'DELETE',
    body: { password },
  },
);

/**
 * API - Backup Grant Schema.
 *
 * Validates the short-lived confirmation returned by either ceremony.
 * The plaintext grant exists only until its matching mutation consumes it.
 *
 * @since 2.0.0
 */
const backupGrantSchema: Web_Api_BackupGrantSchema = z.object({
  grant: z.string(),
  expiresAt: z.string(),
});

/**
 * API - Backup Import Item Schema.
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
 * API - Backup Import Job Schema.
 *
 * Validates the durable progress envelope returned on create and subsequent polls.
 * Secret source material is intentionally absent from this response.
 *
 * @since 2.0.0
 */
const backupImportJobSchema: Web_Api_BackupImportJobSchema = z.object({
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
 * API - Backup Import Preview Schema.
 *
 * Validates every mapping choice prepared before re-authentication is requested.
 * The console uses this safe projection instead of interpreting server state itself.
 *
 * @since 2.0.0
 */
const backupImportPreviewSchema: Web_Api_BackupImportPreviewSchema = z.object({
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
 * API - Backup Source Directory Schema.
 *
 * Validates the read-only directory listing used by the mounted-source picker.
 * Only directory metadata crosses this boundary; source file contents never do.
 *
 * @since 2.0.0
 */
const backupSourceDirectorySchema: Web_Api_BackupSourceDirectorySchema = z.object({
  path: z.string(),
  parentPath: z.string().optional(),
  directories: responseArraySchema(z.object({
    name: z.string(),
    path: z.string(),
    hasSubfolders: z.boolean(),
  })),
});

/**
 * API - Confirm Backup Operation.
 *
 * Exchanges current account proof for a short-lived, single-use grant.
 * The caller keeps the grant only long enough to submit its export or import.
 *
 * @param {Web_Backup_Purpose}                      purpose  - Purpose.
 * @param {Web_Api_ConfirmBackupOperation_Password} password - Password.
 * @param {Web_Api_ConfirmBackupOperation_Code}     code     - Code.
 *
 * @returns {Web_Api_ConfirmBackupOperation_Returns}
 *
 * @since 2.0.0
 */
export const confirmBackupOperation = async (
  purpose: Web_Backup_Purpose,
  password: Web_Api_ConfirmBackupOperation_Password,
  code: Web_Api_ConfirmBackupOperation_Code,
): Web_Api_ConfirmBackupOperation_Returns => {
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
 * API - Confirm Backup Operation With Passkey.
 *
 * Runs the existing browser passkey ceremony for the current signed-in account.
 * Successful user verification yields the same scoped grant as password confirmation.
 *
 * @param {Web_Backup_Purpose} purpose - Purpose.
 *
 * @returns {Web_Api_ConfirmBackupOperationWithPasskey_Returns}
 *
 * @since 2.0.0
 */
export const confirmBackupOperationWithPasskey = async (
  purpose: Web_Backup_Purpose,
): Web_Api_ConfirmBackupOperationWithPasskey_Returns => {
  const ceremony: Web_Api_PasskeyCeremony = await requestJSON(
    '/api/v1/backup/confirmation/passkey/options',
    passkeyCeremonySchema,
    {
      cache: 'no-store',
      method: 'POST',
      body: { purpose },
    },
  );
  const credential: Web_Api_ConfirmBackupOperationWithPasskey_Credential = await getPasskey(ceremony['options']);
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
 * API - Download Backup Export.
 *
 * Streams the secret-bearing response into a local download without parsing its body.
 * No export contents are written to browser storage or application state.
 *
 * @param {Web_Backup_ExportSections}          sections - Sections.
 * @param {Web_Api_DownloadBackupExport_Grant} grant    - Grant.
 *
 * @returns {Web_Api_DownloadBackupExport_Returns}
 *
 * @since 2.0.0
 */
export const downloadBackupExport = async (
  sections: Web_Backup_ExportSections,
  grant: Web_Api_DownloadBackupExport_Grant,
): Web_Api_DownloadBackupExport_Returns => {
  const headers: Headers = new Headers({ 'Content-Type': 'application/json' });
  const csrfToken: Web_Api_DownloadBackupExport_CsrfToken = readCookie('tvpn_csrf');

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

  if (response.ok === false) {
    throw await responseError(response);
  }

  const disposition: Web_Api_DownloadBackupExport_Disposition = response.headers.get('Content-Disposition') ?? '';
  const filenameMatch: Web_Api_DownloadBackupExport_FilenameMatch = new RegExp(contentDispositionFilenamePattern, 'u').exec(disposition);
  const matchedFilename: Web_Api_DownloadBackupExport_MatchedFilename = (filenameMatch !== null) ? filenameMatch[1] : undefined;
  const filename: Web_Api_DownloadBackupExport_Filename = matchedFilename ?? `transmission-vpn-export-${new Date().toISOString().slice(0, 10)}.json`;
  const url: Web_Api_DownloadBackupExport_Url = URL.createObjectURL(await response.blob());
  const link: HTMLAnchorElement = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);

  return;
};

/**
 * API - Disposition File Name.
 *
 * Prefers the encoded filename* form, which carries names outside ASCII, then the plain
 * filename form, quoted or not, and otherwise uses the fallback.
 *
 * @param {Web_Api_DispositionFileName_Disposition} disposition - Disposition.
 * @param {Web_Api_DispositionFileName_Fallback}    fallback    - Fallback.
 *
 * @returns {Web_Api_DispositionFileName_Returns}
 *
 * @since 2.2.0
 */
export const dispositionFileName = (disposition: Web_Api_DispositionFileName_Disposition, fallback: Web_Api_DispositionFileName_Fallback): Web_Api_DispositionFileName_Returns => {
  const encodedMatch: Web_Api_DispositionFileName_EncodedMatch = new RegExp(encodedFilenamePattern, 'iu').exec(disposition);
  const encodedName: Web_Api_DispositionFileName_EncodedName = (encodedMatch !== null) ? encodedMatch[1] : undefined;

  if (encodedName !== undefined) {
    try {
      return decodeURIComponent(encodedName.trim());
    } catch {
      // A malformed encoding falls through to the plain form.
    }
  }

  const quotedMatch: Web_Api_DispositionFileName_QuotedMatch = new RegExp(quotedFilenamePattern, 'u').exec(disposition);
  const quotedName: Web_Api_DispositionFileName_QuotedName = (quotedMatch !== null) ? quotedMatch[1] : undefined;

  if (quotedName !== undefined) {
    return quotedName.replace(new RegExp(escapedCharacterPattern, 'gu'), '$1');
  }

  const bareMatch: Web_Api_DispositionFileName_BareMatch = new RegExp(bareFilenamePattern, 'u').exec(disposition);
  const bareName: Web_Api_DispositionFileName_BareName = (bareMatch !== null) ? bareMatch[1] : undefined;

  if (bareName !== undefined) {
    return bareName.trim();
  }

  return fallback;
};

/**
 * API - Download Torrent Files.
 *
 * Saves one torrent's .torrent file, or a zip of several. Torrents still fetching their
 * metadata have no file yet; the result is how many were left out for that reason.
 *
 * @param {Web_Api_DownloadTorrentFiles_Hashes} hashes - Hashes.
 *
 * @returns {Web_Api_DownloadTorrentFiles_Returns}
 *
 * @since 2.2.0
 */
export const downloadTorrentFiles = async (hashes: Web_Api_DownloadTorrentFiles_Hashes): Web_Api_DownloadTorrentFiles_Returns => {
  const headers: Headers = new Headers({ 'Content-Type': 'application/json' });
  const csrfToken: Web_Api_DownloadTorrentFiles_CsrfToken = readCookie('tvpn_csrf');

  if (csrfToken !== undefined) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  const response: Response = await fetch('/api/v1/torrents/torrent-files', {
    body: JSON.stringify({ hashes }),
    cache: 'no-store',
    credentials: 'same-origin',
    headers,
    method: 'POST',
  });

  if (response.ok === false) {
    throw await responseError(response);
  }

  const fallbackName: Web_Api_DownloadTorrentFiles_FallbackName = (hashes.length === 1) ? `${hashes[0]}.torrent` : 'transmission-vpn-torrents.zip';
  const filename: Web_Api_DownloadTorrentFiles_Filename = dispositionFileName(response.headers.get('Content-Disposition') ?? '', fallbackName);
  const url: Web_Api_DownloadTorrentFiles_Url = URL.createObjectURL(await response.blob());
  const link: HTMLAnchorElement = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);

  return Number(response.headers.get('X-Torrent-Files-Skipped') ?? '0') || 0;
};

/**
 * API - Download Finished Files.
 *
 * Has the server get the torrents' finished files ready, then lets the browser download
 * the link it answers with, so even a large download goes straight to disk with the
 * browser's own progress and can resume. The result counts the torrents left out.
 *
 * @param {Web_Api_DownloadFinishedFiles_Hashes} hashes - Hashes.
 *
 * @returns {Web_Api_DownloadFinishedFiles_Returns}
 *
 * @since 2.2.0
 */
export const downloadFinishedFiles = async (hashes: Web_Api_DownloadFinishedFiles_Hashes): Web_Api_DownloadFinishedFiles_Returns => {
  const prepared: Web_Api_TorrentContentsDownload = await requestJSON(
    '/api/v1/torrents/contents',
    torrentContentsDownloadSchema,
    {
      method: 'POST',
      body: { hashes },
    },
  );
  const link: HTMLAnchorElement = document.createElement('a');
  link.href = prepared['path'];
  link.download = prepared['fileName'];
  link.click();

  return prepared;
};

/**
 * API - Preview Backup Import.
 *
 * Sends a locally validated document for environment-specific folder and conflict checks.
 * The returned projection contains only the choices the wizard needs to display.
 *
 * @param {Web_Backup_Document} document - Document.
 *
 * @returns {Web_Api_PreviewBackupImport_Returns}
 *
 * @since 2.0.0
 */
export const previewBackupImport = async (
  document: Web_Backup_Document,
  folderMappings: Web_Api_PreviewBackupImport_FolderMappings = {},
  profileActions: Web_Api_PreviewBackupImport_ProfileActions = {},
): Web_Api_PreviewBackupImport_Returns => {
  const response: Web_Api_PreviewBackupImport_Response = await requestJSON(
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
 * API - Preview Another Transmission Import.
 *
 * Inspects a mounted read-only source and returns only the migration choices.
 * Folder mappings may be supplied again to refresh data-found counts.
 *
 * @param {Web_Api_PreviewAnotherTransmissionImport_ConfigPath}     configPath     - Config path.
 * @param {Web_Api_PreviewAnotherTransmissionImport_FolderMappings} folderMappings - Folder mappings.
 *
 * @returns {Web_Api_PreviewAnotherTransmissionImport_Returns}
 *
 * @since 2.0.0
 */
export const previewAnotherTransmissionImport = async (
  configPath: Web_Api_PreviewAnotherTransmissionImport_ConfigPath,
  folderMappings: Web_Api_PreviewAnotherTransmissionImport_FolderMappings = {},
): Web_Api_PreviewAnotherTransmissionImport_Returns => {
  const response: Web_Api_PreviewAnotherTransmissionImport_Response = await requestJSON(
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
 * API - Get Backup Source Directory.
 *
 * Keeps mounted-source browsing behind the authenticated API and its path policy.
 * The picker receives only safe child-folder names and navigation metadata.
 *
 * @param {Web_Api_GetBackupSourceDirectory_Path} path - Path.
 *
 * @returns {Web_Api_GetBackupSourceDirectory_Returns}
 *
 * @since 2.0.0
 */
export const getBackupSourceDirectory = async (path: Web_Api_GetBackupSourceDirectory_Path): Web_Api_GetBackupSourceDirectory_Returns => {
  const response: Web_Api_GetBackupSourceDirectory_Response = await requestJSON(
    `/api/v1/backup/imports/source-directories?path=${encodeURIComponent(path)}`,
    z.object({ directory: backupSourceDirectorySchema }),
    { cache: 'no-store' },
  );

  return response['directory'];
};

/**
 * API - Create Backup Import.
 *
 * Submits the reviewed mappings together with a single-use confirmation grant.
 * The durable server job continues if the dialog closes or the page reloads.
 *
 * @param {Web_Backup_ImportPlan}            plan  - Plan.
 * @param {Web_Api_CreateBackupImport_Grant} grant - Grant.
 *
 * @returns {Web_Api_CreateBackupImport_Returns}
 *
 * @since 2.0.0
 */
export const createBackupImport = async (
  plan: Web_Backup_ImportPlan,
  grant: Web_Api_CreateBackupImport_Grant,
): Web_Api_CreateBackupImport_Returns => {
  const response: Web_Api_CreateBackupImport_Response = await requestJSON(
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
 * API - Get Current Backup Import.
 *
 * Restores background progress when the Settings page first mounts.
 * A null response means no queued or running import exists.
 *
 * @returns {Web_Api_GetCurrentBackupImport_Returns}
 *
 * @since 2.0.0
 */
export const getCurrentBackupImport = async (): Web_Api_GetCurrentBackupImport_Returns => {
  const response: Web_Api_GetCurrentBackupImport_Response = await requestJSON(
    '/api/v1/backup/imports/current',
    z.object({ job: backupImportJobSchema.nullable() }),
    { cache: 'no-store' },
  );

  return response['job'];
};

/**
 * API - Get Backup Import.
 *
 * Polls a known durable job while its progress dialog is open or backgrounded.
 * Completed item outcomes remain available through the job-specific route.
 *
 * @param {Web_Api_GetBackupImport_ImportId} importId - Import id.
 *
 * @returns {Web_Api_GetBackupImport_Returns}
 *
 * @since 2.0.0
 */
export const getBackupImport = async (importId: Web_Api_GetBackupImport_ImportId): Web_Api_GetBackupImport_Returns => {
  const response: Web_Api_GetBackupImport_Response = await requestJSON(
    `/api/v1/backup/imports/${encodeURIComponent(importId)}`,
    z.object({ job: backupImportJobSchema }),
    { cache: 'no-store' },
  );

  return response['job'];
};

/**
 * API - Connect Live Events.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_Api_ConnectLiveEvents_OnSnapshot} onSnapshot - On snapshot.
 *
 * @returns {Web_Api_ConnectLiveEvents_Returns}
 *
 * @since 2.0.0
 */
export const connectLiveEvents = (
  onSnapshot: Web_Api_ConnectLiveEvents_OnSnapshot,
): Web_Api_ConnectLiveEvents_Returns => {
  const source: EventSource = new EventSource('/api/v1/events');

  source.addEventListener('snapshot', (event) => {
    const value: Web_Api_ConnectLiveEvents_Value = JSON.parse(event.data);
    const parsedSnapshot: Web_Api_ConnectLiveEvents_ParsedSnapshot = liveSnapshotSchema.safeParse(value);

    if (parsedSnapshot.success === true) {
      onSnapshot(parsedSnapshot.data);
    }

    return;
  });

  return () => {
    source.close();

    return;
  };
};

export type {
  Web_Api_Torrent,
};
