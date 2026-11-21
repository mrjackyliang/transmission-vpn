import {
  createHash,
  randomBytes,
} from 'node:crypto';
import { crc32 } from 'node:zlib';

import {
  administratorUsernamePattern,
  backupImportPathPattern,
  connectionRefusedPattern,
  contentDownloadPathPattern,
  edgeHyphensPattern,
  edgeSpacesAndDotsPattern,
  fileExtensionPattern,
  headerQuoteCharactersPattern,
  isoTimestampPattern,
  loginUsernamePattern,
  lookupHostPattern,
  magnetInfoHashPattern,
  nonSlugCharactersPattern,
  notificationPathPattern,
  openVpnRemotePattern,
  openVpnTcpPattern,
  printableAsciiPattern,
  profileExtensionPattern,
  rpcLoginPathPattern,
  separatorsPattern,
  sixDigitCodePattern,
  timeoutPattern,
  tlsErrorPattern,
  torrentDetailPathPattern,
  torrentExtensionPattern,
  torrentProfileIdPattern,
  torrentProfilePathPattern,
  trailingSlashesPattern,
  transportHostPattern,
  unknownHostPattern,
  vpnCatalogRefreshPathPattern,
  vpnConnectionPathPattern,
  webProxyLoginPathPattern,
  wireGuardEndpointPattern,
  wireGuardInterfacePattern,
} from './src/web/regex.js';

import type {
  MockApi_Account,
  MockApi_AddedTorrentName_FallbackId,
  MockApi_AddedTorrentName_Filename,
  MockApi_AddedTorrentName_LastSegment,
  MockApi_AddedTorrentName_Returns,
  MockApi_AddedTorrentName_SourceURL,
  MockApi_ApplianceStatus_Protection,
  MockApi_ApplianceStatus_Returns,
  MockApi_ApplyAction_Action,
  MockApi_ApplyAction_Ids,
  MockApi_ApplyAction_Returns,
  MockApi_ApplySavedLabelEdits_Labels,
  MockApi_ApplySavedLabelEdits_NextLabel,
  MockApi_ApplySavedLabelEdits_NextLabels,
  MockApi_ApplySavedLabelEdits_RemovedLabels,
  MockApi_ApplySavedLabelEdits_Rename,
  MockApi_ApplySavedLabelEdits_RenamedLabels,
  MockApi_ApplySavedLabelEdits_Returns,
  MockApi_ApplyTorrentProfileOptions_Profile,
  MockApi_ApplyTorrentProfileOptions_Returns,
  MockApi_ApplyTorrentProfileOptions_Torrent,
  MockApi_ApplyTorrentProfileSeeding_Profile,
  MockApi_ApplyTorrentProfileSeeding_Returns,
  MockApi_ApplyTorrentProfileSeeding_Torrent,
  MockApi_AttachmentDisposition_FileName,
  MockApi_AttachmentDisposition_Returns,
  MockApi_BackupGrants,
  MockApi_BackupImportJob,
  MockApi_BlocklistStatus,
  MockApi_ConnectionBeingRemovedId,
  MockApi_ConsumeMockBackupGrant_Confirmation,
  MockApi_ConsumeMockBackupGrant_Grant,
  MockApi_ConsumeMockBackupGrant_Purpose,
  MockApi_ConsumeMockBackupGrant_Returns,
  MockApi_ConsumeMockBackupGrant_Value,
  MockApi_ContosoConnectionId,
  MockApi_CreateTorrents_AddedDate,
  MockApi_CreateTorrents_ConnectionId,
  MockApi_CreateTorrents_DoneDate,
  MockApi_CreateTorrents_Downloaded,
  MockApi_CreateTorrents_Now,
  MockApi_CreateTorrents_Returns,
  MockApi_CreateTorrents_SecondsDownloading,
  MockApi_CreateTorrents_Torrent,
  MockApi_CreateTorrents_Uploaded,
  MockApi_DataPathContains_Candidate,
  MockApi_DataPathContains_CandidatePath,
  MockApi_DataPathContains_Parent,
  MockApi_DataPathContains_ParentPath,
  MockApi_DataPathContains_Returns,
  MockApi_DataPathContainsIgnoringCase_CandidatePath,
  MockApi_DataPathContainsIgnoringCase_ParentPath,
  MockApi_DataPathContainsIgnoringCase_Returns,
  MockApi_DataPathsEqualIgnoringCase_FirstPath,
  MockApi_DataPathsEqualIgnoringCase_Returns,
  MockApi_DataPathsEqualIgnoringCase_SecondPath,
  MockApi_DefaultTorrentProfile,
  MockApi_DefaultTorrentProfileResponse_Returns,
  MockApi_DefaultVPNConnection_Returns,
  MockApi_DefaultVPNStatus_Connection,
  MockApi_DefaultVPNStatus_Returns,
  MockApi_DefaultVPNStatus_Runtime,
  MockApi_Directories,
  MockApi_DirectoryChildren_DirectoryPath,
  MockApi_DirectoryChildren_Returns,
  MockApi_DirectoryDeletionPolicy_AssignedProfile,
  MockApi_DirectoryDeletionPolicy_DirectoryPath,
  MockApi_DirectoryDeletionPolicy_FolderName,
  MockApi_DirectoryDeletionPolicy_IncompleteDirectory,
  MockApi_DirectoryDeletionPolicy_Metadata,
  MockApi_DirectoryDeletionPolicy_ProfileFolder,
  MockApi_DirectoryDeletionPolicy_Returns,
  MockApi_DirectorySelection_DirectoryPath,
  MockApi_DirectorySelection_ProfileID,
  MockApi_DirectorySelection_Purpose,
  MockApi_DirectorySelection_Returns,
  MockApi_DirectoryTags_DirectoryPath,
  MockApi_DirectoryTags_Returns,
  MockApi_DirectoryTags_Tags,
  MockApi_DownloadDataPathRootMessage,
  MockApi_DownloadFolderIssue_IncompleteDirectory,
  MockApi_DownloadFolderIssue_Returns,
  MockApi_DownloadFolderIssue_Value,
  MockApi_DownloadSelection_DirectoryPath,
  MockApi_DownloadSelection_IncompleteDirectory,
  MockApi_DownloadSelection_Returns,
  MockApi_DuplicateTorrentEnabled,
  MockApi_EffectiveStringSetting_Key,
  MockApi_EffectiveStringSetting_MatchedSetting,
  MockApi_EffectiveStringSetting_Returns,
  MockApi_EffectiveWebProxyConnectionId_Login,
  MockApi_EffectiveWebProxyConnectionId_Returns,
  MockApi_EffectiveWebProxyLogin_Login,
  MockApi_EffectiveWebProxyLogin_Returns,
  MockApi_EnsureConfiguredDirectories_IncompleteEnabled,
  MockApi_EnsureConfiguredDirectories_IncompleteSetting,
  MockApi_EnsureConfiguredDirectories_Returns,
  MockApi_EnsureDirectory_CurrentPath,
  MockApi_EnsureDirectory_DirectoryPath,
  MockApi_EnsureDirectory_Returns,
  MockApi_ExpandScopes_Expanded,
  MockApi_ExpandScopes_Returns,
  MockApi_ExpandScopes_Scopes,
  MockApi_FabrikamConnectionId,
  MockApi_FormatRecoveryCode_Code,
  MockApi_FormatRecoveryCode_Returns,
  MockApi_Gibibyte,
  MockApi_HandleRequest_Action,
  MockApi_HandleRequest_AlreadyThere,
  MockApi_HandleRequest_AppliedKeys,
  MockApi_HandleRequest_BackupImportMatch,
  MockApi_HandleRequest_BackupPurpose,
  MockApi_HandleRequest_BandwidthPriority,
  MockApi_HandleRequest_Body,
  MockApi_HandleRequest_Catalog,
  MockApi_HandleRequest_ChangedTorrents,
  MockApi_HandleRequest_Changes,
  MockApi_HandleRequest_ClaimCode,
  MockApi_HandleRequest_Clash,
  MockApi_HandleRequest_ClashDestination,
  MockApi_HandleRequest_Code,
  MockApi_HandleRequest_CompletedAt,
  MockApi_HandleRequest_Configuration,
  MockApi_HandleRequest_ConfiguredSources,
  MockApi_HandleRequest_Connection,
  MockApi_HandleRequest_ConnectionChanged,
  MockApi_HandleRequest_ConnectionId,
  MockApi_HandleRequest_Content,
  MockApi_HandleRequest_ContentDownloadMatch,
  MockApi_HandleRequest_Created,
  MockApi_HandleRequest_CreatedAt,
  MockApi_HandleRequest_Credentials,
  MockApi_HandleRequest_CustomProfileContent,
  MockApi_HandleRequest_CustomProfileName,
  MockApi_HandleRequest_CustomTunnel,
  MockApi_HandleRequest_DefaultProfileTorrents,
  MockApi_HandleRequest_DeletionPolicy,
  MockApi_HandleRequest_DependentLogins,
  MockApi_HandleRequest_DependentProfiles,
  MockApi_HandleRequest_DependentTorrents,
  MockApi_HandleRequest_DetailMatch,
  MockApi_HandleRequest_DetailTorrent,
  MockApi_HandleRequest_DirectoryPath,
  MockApi_HandleRequest_DisplayName,
  MockApi_HandleRequest_Document,
  MockApi_HandleRequest_DocumentRecord,
  MockApi_HandleRequest_Download,
  MockApi_HandleRequest_DownloadDirectory,
  MockApi_HandleRequest_DownloadHeaders,
  MockApi_HandleRequest_DownloadIssue,
  MockApi_HandleRequest_DownloadToken,
  MockApi_HandleRequest_DuplicateTorrent,
  MockApi_HandleRequest_Enabled,
  MockApi_HandleRequest_EndpointMatches,
  MockApi_HandleRequest_EndpointStrategy,
  MockApi_HandleRequest_ExactFolder,
  MockApi_HandleRequest_ExistingLabels,
  MockApi_HandleRequest_ExistingTorrentProfile,
  MockApi_HandleRequest_Failed,
  MockApi_HandleRequest_Fields,
  MockApi_HandleRequest_FileName,
  MockApi_HandleRequest_FirstTorrent,
  MockApi_HandleRequest_FolderChanged,
  MockApi_HandleRequest_FolderMappings,
  MockApi_HandleRequest_FolderOwner,
  MockApi_HandleRequest_FollowingProfileIDs,
  MockApi_HandleRequest_FollowingProfileTorrents,
  MockApi_HandleRequest_FoundNotification,
  MockApi_HandleRequest_FoundRpcLogin,
  MockApi_HandleRequest_FoundWebProxyLogin,
  MockApi_HandleRequest_GeneratedPassword,
  MockApi_HandleRequest_Hash,
  MockApi_HandleRequest_Identifiers,
  MockApi_HandleRequest_IdPrefix,
  MockApi_HandleRequest_IdSuffix,
  MockApi_HandleRequest_Index,
  MockApi_HandleRequest_Input,
  MockApi_HandleRequest_Issue,
  MockApi_HandleRequest_Issues,
  MockApi_HandleRequest_Job,
  MockApi_HandleRequest_JobResponse,
  MockApi_HandleRequest_LooksLikeWireGuard,
  MockApi_HandleRequest_Message,
  MockApi_HandleRequest_Method,
  MockApi_HandleRequest_Missing,
  MockApi_HandleRequest_MissingCredential,
  MockApi_HandleRequest_Moved,
  MockApi_HandleRequest_MovedTorrents,
  MockApi_HandleRequest_MoveResult,
  MockApi_HandleRequest_MoveTo,
  MockApi_HandleRequest_MutatingConnectionRoute,
  MockApi_HandleRequest_Name,
  MockApi_HandleRequest_NewConnection,
  MockApi_HandleRequest_NewToken,
  MockApi_HandleRequest_NewTorrent,
  MockApi_HandleRequest_NextDefault,
  MockApi_HandleRequest_NextDownloadDirectory,
  MockApi_HandleRequest_NextId,
  MockApi_HandleRequest_NextIncompleteDirectory,
  MockApi_HandleRequest_NextLabels,
  MockApi_HandleRequest_NextProfileSequence,
  MockApi_HandleRequest_Normalized,
  MockApi_HandleRequest_Notification,
  MockApi_HandleRequest_NotificationInput,
  MockApi_HandleRequest_NotificationInput_Body,
  MockApi_HandleRequest_NotificationInput_Clearable,
  MockApi_HandleRequest_NotificationInput_ClearSecretKeys,
  MockApi_HandleRequest_NotificationInput_ClearSecrets,
  MockApi_HandleRequest_NotificationInput_Events,
  MockApi_HandleRequest_NotificationInput_Existing,
  MockApi_HandleRequest_NotificationInput_InvalidIndex,
  MockApi_HandleRequest_NotificationInput_Key,
  MockApi_HandleRequest_NotificationInput_Missing,
  MockApi_HandleRequest_NotificationInput_Name,
  MockApi_HandleRequest_NotificationInput_PlainSettings,
  MockApi_HandleRequest_NotificationInput_Replaced,
  MockApi_HandleRequest_NotificationInput_Required,
  MockApi_HandleRequest_NotificationInput_Returns,
  MockApi_HandleRequest_NotificationInput_Saved,
  MockApi_HandleRequest_NotificationInput_Secret,
  MockApi_HandleRequest_NotificationInput_Secrets,
  MockApi_HandleRequest_NotificationInput_Service,
  MockApi_HandleRequest_NotificationInput_Value,
  MockApi_HandleRequest_NotificationInput_Values,
  MockApi_HandleRequest_NotificationMatch,
  MockApi_HandleRequest_Now,
  MockApi_HandleRequest_NowSeconds,
  MockApi_HandleRequest_OptionalPassword,
  MockApi_HandleRequest_Overlap,
  MockApi_HandleRequest_Passkey,
  MockApi_HandleRequest_PasskeyId,
  MockApi_HandleRequest_Password,
  MockApi_HandleRequest_Path,
  MockApi_HandleRequest_Paused,
  MockApi_HandleRequest_PeerPort,
  MockApi_HandleRequest_PendingKeys,
  MockApi_HandleRequest_Plaintext,
  MockApi_HandleRequest_Preview,
  MockApi_HandleRequest_PreviewItems,
  MockApi_HandleRequest_PreviousDefault,
  MockApi_HandleRequest_ProfileData,
  MockApi_HandleRequest_ProfileId,
  MockApi_HandleRequest_ProfileID,
  MockApi_HandleRequest_ProfileIds,
  MockApi_HandleRequest_ProfileIndex,
  MockApi_HandleRequest_ProfileLabel,
  MockApi_HandleRequest_ProfileName,
  MockApi_HandleRequest_ProfileTorrents,
  MockApi_HandleRequest_ProviderId,
  MockApi_HandleRequest_Purpose,
  MockApi_HandleRequest_PurposeText,
  MockApi_HandleRequest_PurposeValue,
  MockApi_HandleRequest_RecoveryIndex,
  MockApi_HandleRequest_RefreshCatalogMatch,
  MockApi_HandleRequest_RefreshedCatalog,
  MockApi_HandleRequest_RegeneratePassword,
  MockApi_HandleRequest_RemoteProtocol,
  MockApi_HandleRequest_RemovedLabels,
  MockApi_HandleRequest_RenamedLabelRecord,
  MockApi_HandleRequest_RenamedLabels,
  MockApi_HandleRequest_RenamedLabelValue,
  MockApi_HandleRequest_RenamedTorrent,
  MockApi_HandleRequest_Request,
  MockApi_HandleRequest_RequestedConnectionId,
  MockApi_HandleRequest_RequestedCount,
  MockApi_HandleRequest_RequestedEnabled,
  MockApi_HandleRequest_ResolvingProfile,
  MockApi_HandleRequest_ResolvingSelection,
  MockApi_HandleRequest_Response,
  MockApi_HandleRequest_Returns,
  MockApi_HandleRequest_RootDownloadSetting,
  MockApi_HandleRequest_RpcLogin,
  MockApi_HandleRequest_RpcLoginMatch,
  MockApi_HandleRequest_RuntimeApply,
  MockApi_HandleRequest_SeedIdleMode,
  MockApi_HandleRequest_SeedRatioMode,
  MockApi_HandleRequest_Selected,
  MockApi_HandleRequest_SelectedProfile,
  MockApi_HandleRequest_SelectedTunnelDefinition,
  MockApi_HandleRequest_SelectionParam,
  MockApi_HandleRequest_Send,
  MockApi_HandleRequest_Send_Returns,
  MockApi_HandleRequest_Setting,
  MockApi_HandleRequest_SettingKey,
  MockApi_HandleRequest_Slot,
  MockApi_HandleRequest_Slug,
  MockApi_HandleRequest_SourceDirectory,
  MockApi_HandleRequest_SourceValue,
  MockApi_HandleRequest_Status,
  MockApi_HandleRequest_StoredMoveTo,
  MockApi_HandleRequest_SubmittedCredentials,
  MockApi_HandleRequest_TargetConnection,
  MockApi_HandleRequest_TargetConnectionId,
  MockApi_HandleRequest_TargetConnectionName,
  MockApi_HandleRequest_TargetDirectory,
  MockApi_HandleRequest_Tcp,
  MockApi_HandleRequest_Timer,
  MockApi_HandleRequest_Token,
  MockApi_HandleRequest_TokenId,
  MockApi_HandleRequest_TorrentItems,
  MockApi_HandleRequest_TorrentProfile,
  MockApi_HandleRequest_TorrentProfileMatch,
  MockApi_HandleRequest_TorrentSelection,
  MockApi_HandleRequest_TotalSize,
  MockApi_HandleRequest_TransitionSequence,
  MockApi_HandleRequest_Tunnel,
  MockApi_HandleRequest_TunnelCandidate,
  MockApi_HandleRequest_TunnelCandidateMatches,
  MockApi_HandleRequest_TunnelDefinition,
  MockApi_HandleRequest_TunnelFilter,
  MockApi_HandleRequest_TunnelLabel,
  MockApi_HandleRequest_TunnelName,
  MockApi_HandleRequest_UpdatedDefaultProfile,
  MockApi_HandleRequest_UpdateRequestedAt,
  MockApi_HandleRequest_UploadedProfiles,
  MockApi_HandleRequest_Url,
  MockApi_HandleRequest_Username,
  MockApi_HandleRequest_UsernameMessage,
  MockApi_HandleRequest_VpnConnectionMatch,
  MockApi_HandleRequest_WebProxyLogin,
  MockApi_HandleRequest_WebProxyLoginMatch,
  MockApi_HandleRequest_ZipFile,
  MockApi_IncompleteSelection_Clash,
  MockApi_IncompleteSelection_Destination,
  MockApi_IncompleteSelection_DirectoryPath,
  MockApi_IncompleteSelection_ExactFolder,
  MockApi_IncompleteSelection_Returns,
  MockApi_IsConnectionBeingRemoved_ConnectionId,
  MockApi_IsConnectionBeingRemoved_Returns,
  MockApi_IsDownloadDataRoot_Returns,
  MockApi_IsDownloadDataRoot_Value,
  MockApi_IssueMockBackupGrant_ExpiresAt,
  MockApi_IssueMockBackupGrant_Grant,
  MockApi_IssueMockBackupGrant_Purpose,
  MockApi_IssueMockBackupGrant_Returns,
  MockApi_KeyReplaced,
  MockApi_ListDirectory_ChildDirectories,
  MockApi_ListDirectory_DeletionPolicy,
  MockApi_ListDirectory_Directory,
  MockApi_ListDirectory_DirectoryPath,
  MockApi_ListDirectory_Metadata,
  MockApi_ListDirectory_ProfileID,
  MockApi_ListDirectory_Purpose,
  MockApi_ListDirectory_PurposeSelection,
  MockApi_ListDirectory_Returns,
  MockApi_ListDirectory_Selection,
  MockApi_LiveVPNConnections_Connections,
  MockApi_LiveVPNConnections_Returns,
  MockApi_LiveVPNConnections_Runtime,
  MockApi_MaximumBackupAPITokens,
  MockApi_MaximumBackupNotificationDestinations,
  MockApi_MaximumBackupRPCLogins,
  MockApi_MergedMockVPNCredentials_Connection,
  MockApi_MergedMockVPNCredentials_Credentials,
  MockApi_MergedMockVPNCredentials_ProviderId,
  MockApi_MergedMockVPNCredentials_Returns,
  MockApi_MergedMockVPNCredentials_SavedCredentials,
  MockApi_MergedMockVPNCredentials_SubmittedCredentials,
  MockApi_MergedMockVPNCredentials_Tunnel,
  MockApi_MergeMockBackupAccess_Apply,
  MockApi_MergeMockBackupAccess_Digest,
  MockApi_MergeMockBackupAccess_Document,
  MockApi_MergeMockBackupAccess_Duplicate,
  MockApi_MergeMockBackupAccess_Event,
  MockApi_MergeMockBackupAccess_Id,
  MockApi_MergeMockBackupAccess_ImportedLogins,
  MockApi_MergeMockBackupAccess_ImportedNotifications,
  MockApi_MergeMockBackupAccess_ImportedRecord,
  MockApi_MergeMockBackupAccess_ImportedTokens,
  MockApi_MergeMockBackupAccess_Login,
  MockApi_MergeMockBackupAccess_MergedNotifications,
  MockApi_MergeMockBackupAccess_MergedRPCLoginDigests,
  MockApi_MergeMockBackupAccess_MergedRPCLogins,
  MockApi_MergeMockBackupAccess_MergedTokenDigests,
  MockApi_MergeMockBackupAccess_MergedTokens,
  MockApi_MergeMockBackupAccess_Name,
  MockApi_MergeMockBackupAccess_Notification,
  MockApi_MergeMockBackupAccess_Now,
  MockApi_MergeMockBackupAccess_RemoteAccess,
  MockApi_MergeMockBackupAccess_ReplacedLogin,
  MockApi_MergeMockBackupAccess_ReplaceIndex,
  MockApi_MergeMockBackupAccess_Result,
  MockApi_MergeMockBackupAccess_Returns,
  MockApi_MergeMockBackupAccess_Scope,
  MockApi_MergeMockBackupAccess_SecretFields,
  MockApi_MergeMockBackupAccess_SecretValues,
  MockApi_MergeMockBackupAccess_Service,
  MockApi_MergeMockBackupAccess_Username,
  MockApi_MergeTorrentLabels_Existing,
  MockApi_MergeTorrentLabels_Merged,
  MockApi_MergeTorrentLabels_ProfileLabels,
  MockApi_MergeTorrentLabels_Returns,
  MockApi_MergeTorrentLabels_Seen,
  MockApi_MissingMockVPNCredential_Credentials,
  MockApi_MissingMockVPNCredential_ProviderId,
  MockApi_MissingMockVPNCredential_Returns,
  MockApi_MissingMockVPNCredential_Tunnel,
  MockApi_MissingWebProxyConnectionId,
  MockApi_MockAnotherTransmissionPreview_DataFoundStatus,
  MockApi_MockAnotherTransmissionPreview_FolderFixtures,
  MockApi_MockAnotherTransmissionPreview_FolderMappings,
  MockApi_MockAnotherTransmissionPreview_Folders,
  MockApi_MockAnotherTransmissionPreview_Found,
  MockApi_MockAnotherTransmissionPreview_ImportProfiles,
  MockApi_MockAnotherTransmissionPreview_MappedPath,
  MockApi_MockAnotherTransmissionPreview_MappedSettings,
  MockApi_MockAnotherTransmissionPreview_Returns,
  MockApi_MockAnotherTransmissionPreview_SkippedSettings,
  MockApi_MockAnotherTransmissionPreview_Total,
  MockApi_MockApi_Next,
  MockApi_MockApi_Request,
  MockApi_MockApi_Response,
  MockApi_MockApi_Returns,
  MockApi_MockBackupActionLines_Actions,
  MockApi_MockBackupActionLines_Result,
  MockApi_MockBackupActionLines_Returns,
  MockApi_MockBackupActionLines_Verb,
  MockApi_MockBackupCountLabel_Count,
  MockApi_MockBackupCountLabel_Noun,
  MockApi_MockBackupCountLabel_Plural,
  MockApi_MockBackupCountLabel_Returns,
  MockApi_MockBackupCountLabel_Singular,
  MockApi_MockBackupDocument_Document,
  MockApi_MockBackupDocument_Metainfo,
  MockApi_MockBackupDocument_Returns,
  MockApi_MockBackupDocument_SecretEntry,
  MockApi_MockBackupDocument_Selected,
  MockApi_MockBackupDocument_SelectedConnections,
  MockApi_MockBackupDocument_SelectedProfileIDs,
  MockApi_MockBackupDocument_SourceProfile,
  MockApi_MockBackupDocument_SourceTorrent,
  MockApi_MockBackupIDIsUsed_AllowedIndex,
  MockApi_MockBackupIDIsUsed_Id,
  MockApi_MockBackupIDIsUsed_Items,
  MockApi_MockBackupIDIsUsed_Returns,
  MockApi_MockBackupImportResponse_Complete,
  MockApi_MockBackupImportResponse_CompletedTorrents,
  MockApi_MockBackupImportResponse_Detail,
  MockApi_MockBackupImportResponse_ElapsedSeconds,
  MockApi_MockBackupImportResponse_EmptyJobComplete,
  MockApi_MockBackupImportResponse_Items,
  MockApi_MockBackupImportResponse_ItemSeconds,
  MockApi_MockBackupImportResponse_Job,
  MockApi_MockBackupImportResponse_Now,
  MockApi_MockBackupImportResponse_Progress,
  MockApi_MockBackupImportResponse_Returns,
  MockApi_MockBackupImportResponse_SecondsPerItem,
  MockApi_MockBackupImportResponse_State,
  MockApi_MockBackupImportResponse_Status,
  MockApi_MockBackupMetainfo_Info,
  MockApi_MockBackupMetainfo_Metainfo,
  MockApi_MockBackupMetainfo_Returns,
  MockApi_MockBackupPreview_CurrentSetting,
  MockApi_MockBackupPreview_Document,
  MockApi_MockBackupPreview_Existing,
  MockApi_MockBackupPreview_FolderPaths,
  MockApi_MockBackupPreview_ImportedDefault,
  MockApi_MockBackupPreview_ImportedProfiles,
  MockApi_MockBackupPreview_ImportedRecord,
  MockApi_MockBackupPreview_ImportedSettings,
  MockApi_MockBackupPreview_ProfilePreview,
  MockApi_MockBackupPreview_RemoteAccess,
  MockApi_MockBackupPreview_Returns,
  MockApi_MockBackupPreview_SectionNames,
  MockApi_MockBackupPreview_SettingsAndProfiles,
  MockApi_MockBackupStringMap_EntryValue,
  MockApi_MockBackupStringMap_Returns,
  MockApi_MockBackupStringMap_Value,
  MockApi_MockBackupStringMap_Values,
  MockApi_MockContentDownloads,
  MockApi_MockFinishedFiles_Returns,
  MockApi_MockFinishedFiles_Torrent,
  MockApi_MockImportSourceDirectory_ChildPath,
  MockApi_MockImportSourceDirectory_Children,
  MockApi_MockImportSourceDirectory_Path,
  MockApi_MockImportSourceDirectory_Returns,
  MockApi_MockImportSourceDirectory_Tree,
  MockApi_MockNotificationTransportFailure_LookupHost,
  MockApi_MockNotificationTransportFailure_LookupMatch,
  MockApi_MockNotificationTransportFailure_Raw,
  MockApi_MockNotificationTransportFailure_Returns,
  MockApi_MockNotificationTransportFailure_TransportHost,
  MockApi_MockNotificationTransportFailure_TransportMatch,
  MockApi_MockPieces_Bytes,
  MockApi_MockPieces_End,
  MockApi_MockPieces_Filled,
  MockApi_MockPieces_Have,
  MockApi_MockPieces_PieceCount,
  MockApi_MockPieces_PieceSize,
  MockApi_MockPieces_Random,
  MockApi_MockPieces_Random_Returns,
  MockApi_MockPieces_Returns,
  MockApi_MockPieces_Seed,
  MockApi_MockPieces_Start,
  MockApi_MockPieces_Target,
  MockApi_MockPieces_Torrent,
  MockApi_MockQrCode_Path,
  MockApi_MockQrCode_Returns,
  MockApi_MockQrCode_Row,
  MockApi_MockQrCode_Size,
  MockApi_MockQrCode_Svg,
  MockApi_MockQrRows,
  MockApi_MockTorrentFile_Announce,
  MockApi_MockTorrentFile_Name,
  MockApi_MockTorrentFile_Returns,
  MockApi_MockTorrentFile_Torrent,
  MockApi_MockTotpUri,
  MockApi_MockVPNCredentialFields_ProviderDefinition,
  MockApi_MockVPNCredentialFields_ProviderId,
  MockApi_MockVPNCredentialFields_Returns,
  MockApi_MockVPNCredentialFields_Tunnel,
  MockApi_MockVPNCredentialFields_TunnelDefinition,
  MockApi_MockVPNCredentialFields_TunnelDefinitions,
  MockApi_MockVPNTestFailureMessage,
  MockApi_MoveTorrentsToQueueTop_OrderedTorrents,
  MockApi_MoveTorrentsToQueueTop_Returns,
  MockApi_MoveTorrentsToQueueTop_SelectedIDs,
  MockApi_MoveTorrentsToQueueTop_SelectedTorrents,
  MockApi_NeedsProfileTorrent,
  MockApi_NewRecoveryCodes_Alphabet,
  MockApi_NewRecoveryCodes_Code,
  MockApi_NewRecoveryCodes_Returns,
  MockApi_NorthwindConnectionId,
  MockApi_NotificationEvents,
  MockApi_NotificationFields,
  MockApi_NotificationMinute,
  MockApi_Notifications,
  MockApi_NotificationsStartedAt,
  MockApi_NotificationTransportError,
  MockApi_NoVPNConnections,
  MockApi_OrganizationRevision,
  MockApi_PasswordIssue_Password,
  MockApi_PasswordIssue_Returns,
  MockApi_PendingPasskeyName,
  MockApi_PendingRestartKeys,
  MockApi_PreviewTorrentLink_DisplayName,
  MockApi_PreviewTorrentLink_EncodedName,
  MockApi_PreviewTorrentLink_ExactTopic,
  MockApi_PreviewTorrentLink_Index,
  MockApi_PreviewTorrentLink_Link,
  MockApi_PreviewTorrentLink_Name,
  MockApi_PreviewTorrentLink_ParsedLink,
  MockApi_PreviewTorrentLink_PathSegments,
  MockApi_PreviewTorrentLink_Returns,
  MockApi_PreviewTorrentLink_TotalSize,
  MockApi_Profile,
  MockApi_ProfileFolderOverlaps_DefaultOwner,
  MockApi_ProfileFolderOverlaps_Overlaps,
  MockApi_ProfileFolderOverlaps_Owner,
  MockApi_ProfileFolderOverlaps_Returns,
  MockApi_ProfileFolderOwner_DefaultRelation,
  MockApi_ProfileFolderOwner_DirectoryPath,
  MockApi_ProfileFolderOwner_ExcludedProfileID,
  MockApi_ProfileFolderOwner_RelationTo,
  MockApi_ProfileFolderOwner_RelationTo_OwnerPath,
  MockApi_ProfileFolderOwner_RelationTo_Returns,
  MockApi_ProfileFolderOwner_RelationValue,
  MockApi_ProfileFolderOwner_Returns,
  MockApi_ProfileFolderTakenMessage_DirectoryPath,
  MockApi_ProfileFolderTakenMessage_FolderName,
  MockApi_ProfileFolderTakenMessage_OwnerName,
  MockApi_ProfileFolderTakenMessage_Relation,
  MockApi_ProfileFolderTakenMessage_Returns,
  MockApi_Profiles,
  MockApi_ProfileSelection_DirectoryPath,
  MockApi_ProfileSelection_DownloadPolicy,
  MockApi_ProfileSelection_Owner,
  MockApi_ProfileSelection_ProfileID,
  MockApi_ProfileSelection_Returns,
  MockApi_ProtectedVPNRuntime_EndpointStrategy,
  MockApi_ProtectedVPNRuntime_Profile,
  MockApi_ProtectedVPNRuntime_ProfileIds,
  MockApi_ProtectedVPNRuntime_ProviderId,
  MockApi_ProtectedVPNRuntime_Returns,
  MockApi_ProtectedVPNRuntime_Slot,
  MockApi_ProtectedVPNRuntime_Tunnel,
  MockApi_Providers,
  MockApi_RawNotificationTransportError,
  MockApi_ReadBody_Chunks,
  MockApi_ReadBody_Request,
  MockApi_ReadBody_Returns,
  MockApi_ReadBody_Text,
  MockApi_ReadDefaultTorrentProfile_Body,
  MockApi_ReadDefaultTorrentProfile_NormalizedProfile,
  MockApi_ReadDefaultTorrentProfile_Returns,
  MockApi_ReadIDs_Body,
  MockApi_ReadIDs_Id,
  MockApi_ReadIDs_Ids,
  MockApi_ReadIDs_Returns,
  MockApi_ReadTokenFields_Body,
  MockApi_ReadTokenFields_ExpiresAt,
  MockApi_ReadTokenFields_Issues,
  MockApi_ReadTokenFields_Name,
  MockApi_ReadTokenFields_Request,
  MockApi_ReadTokenFields_Response,
  MockApi_ReadTokenFields_Returns,
  MockApi_ReadTokenFields_Scopes,
  MockApi_ReadTokenFields_TokenId,
  MockApi_ReadTokenFields_UnknownField,
  MockApi_ReadTorrentProfile_BandwidthPriority,
  MockApi_ReadTorrentProfile_Body,
  MockApi_ReadTorrentProfile_CreatedAt,
  MockApi_ReadTorrentProfile_Id,
  MockApi_ReadTorrentProfile_Options,
  MockApi_ReadTorrentProfile_Returns,
  MockApi_ReadTorrentProfile_Seeding,
  MockApi_ReadTorrentProfile_UpdatedAt,
  MockApi_ReadTorrentSelection_Body,
  MockApi_ReadTorrentSelection_Hashes,
  MockApi_ReadTorrentSelection_HexadecimalCharacters,
  MockApi_ReadTorrentSelection_Ids,
  MockApi_ReadTorrentSelection_Items,
  MockApi_ReadTorrentSelection_RequestedHashes,
  MockApi_ReadTorrentSelection_Response,
  MockApi_ReadTorrentSelection_Returns,
  MockApi_ReadTorrentSelection_Starting,
  MockApi_ReadTorrentSelection_Valid,
  MockApi_RefreshTorrentProfilePresentation_Overlaps,
  MockApi_RefreshTorrentProfilePresentation_Returns,
  MockApi_RemoteUsernameIssue_Returns,
  MockApi_RemoteUsernameIssue_Username,
  MockApi_RemovedSecrets,
  MockApi_RpcLoginDigests,
  MockApi_RpcLoginDigests_Entry,
  MockApi_RpcLogins,
  MockApi_RpcLoginSequence,
  MockApi_SavedLabels,
  MockApi_SavedMockVPNCredentialKeys_Credentials,
  MockApi_SavedMockVPNCredentialKeys_ProviderId,
  MockApi_SavedMockVPNCredentialKeys_Returns,
  MockApi_SavedMockVPNCredentialKeys_Tunnel,
  MockApi_SaveUsedLabels_AdvanceRevision,
  MockApi_SaveUsedLabels_Changed,
  MockApi_SaveUsedLabels_Key,
  MockApi_SaveUsedLabels_Labels,
  MockApi_SaveUsedLabels_Returns,
  MockApi_SaveUsedLabels_SavedKeys,
  MockApi_SecretKeys,
  MockApi_SendConnectionBeingRemoved_Response,
  MockApi_SendConnectionBeingRemoved_Returns,
  MockApi_SendError_Code,
  MockApi_SendError_Details,
  MockApi_SendError_Message,
  MockApi_SendError_Response,
  MockApi_SendError_Returns,
  MockApi_SendError_Status,
  MockApi_SendFieldError_Code,
  MockApi_SendFieldError_Field,
  MockApi_SendFieldError_Message,
  MockApi_SendFieldError_Response,
  MockApi_SendFieldError_Returns,
  MockApi_SendFieldError_Status,
  MockApi_SendIssues_FirstIssue,
  MockApi_SendIssues_Issues,
  MockApi_SendIssues_Response,
  MockApi_SendIssues_Returns,
  MockApi_SendJSON_Body,
  MockApi_SendJSON_Response,
  MockApi_SendJSON_Returns,
  MockApi_SendJSON_Status,
  MockApi_SendMockVPNCredentialError_Field,
  MockApi_SendMockVPNCredentialError_FieldName,
  MockApi_SendMockVPNCredentialError_Message,
  MockApi_SendMockVPNCredentialError_Prefix,
  MockApi_SendMockVPNCredentialError_Response,
  MockApi_SendMockVPNCredentialError_Returns,
  MockApi_Sequence,
  MockApi_Settings,
  MockApi_SettingsRevision,
  MockApi_SetupRequired,
  MockApi_SetupStartedAt,
  MockApi_SignedIn,
  MockApi_Snapshot_ActiveTorrentCount,
  MockApi_Snapshot_DownloadSpeed,
  MockApi_Snapshot_Protection,
  MockApi_Snapshot_Returns,
  MockApi_Snapshot_UploadSpeed,
  MockApi_StartMockAnotherTransmissionImport_Body,
  MockApi_StartMockAnotherTransmissionImport_FolderMappings,
  MockApi_StartMockAnotherTransmissionImport_Job,
  MockApi_StartMockAnotherTransmissionImport_ProfileIncluded,
  MockApi_StartMockAnotherTransmissionImport_ProfileNames,
  MockApi_StartMockAnotherTransmissionImport_Returns,
  MockApi_StartMockAnotherTransmissionImport_SourceItems,
  MockApi_StartMockBackupImport_Document,
  MockApi_StartMockBackupImport_FolderMappings,
  MockApi_StartMockBackupImport_Hash,
  MockApi_StartMockBackupImport_ImportedRecord,
  MockApi_StartMockBackupImport_ImportedTorrents,
  MockApi_StartMockBackupImport_Job,
  MockApi_StartMockBackupImport_Returns,
  MockApi_StartMockBackupImport_SourceFolder,
  MockApi_StartMockBackupImport_UnknownList,
  MockApi_StartSession_Response,
  MockApi_StartSession_Returns,
  MockApi_StoredZip_BaseName,
  MockApi_StoredZip_Central,
  MockApi_StoredZip_CentralFileSignature,
  MockApi_StoredZip_CentralParts,
  MockApi_StoredZip_CentralSize,
  MockApi_StoredZip_Checksum,
  MockApi_StoredZip_End,
  MockApi_StoredZip_EndSignature,
  MockApi_StoredZip_EntryName,
  MockApi_StoredZip_Extension,
  MockApi_StoredZip_ExtensionMatch,
  MockApi_StoredZip_Files,
  MockApi_StoredZip_FirstDosDate,
  MockApi_StoredZip_Local,
  MockApi_StoredZip_LocalFileSignature,
  MockApi_StoredZip_LocalParts,
  MockApi_StoredZip_NameBytes,
  MockApi_StoredZip_Offset,
  MockApi_StoredZip_Returns,
  MockApi_StoredZip_UsedNames,
  MockApi_StoredZip_Utf8NamesFlag,
  MockApi_SubmittedMockVPNCredentials_Credentials,
  MockApi_SubmittedMockVPNCredentials_CredentialValue,
  MockApi_SubmittedMockVPNCredentials_Key,
  MockApi_SubmittedMockVPNCredentials_Returns,
  MockApi_SubmittedMockVPNCredentials_Value,
  MockApi_Tick_Downloading,
  MockApi_Tick_Returns,
  MockApi_Tick_Seeding,
  MockApi_Tick_Step,
  MockApi_TokenDigests,
  MockApi_TokenDigests_Entry,
  MockApi_TokenDigests_TokenID,
  MockApi_Tokens,
  MockApi_TokenScopes,
  MockApi_TokenSequence,
  MockApi_TokenValues,
  MockApi_TorrentAddAttempt,
  MockApi_TorrentAddOutcome,
  MockApi_TorrentDownloadName_Cleaned,
  MockApi_TorrentDownloadName_FileStem,
  MockApi_TorrentDownloadName_Returns,
  MockApi_TorrentDownloadName_Torrent,
  MockApi_TorrentErrors_Returns,
  MockApi_TorrentMoveWarnings,
  MockApi_TorrentMutationResponse_Returns,
  MockApi_TorrentMutationResponse_Selection,
  MockApi_TorrentPatternsOverlap_LeftCharacter,
  MockApi_TorrentPatternsOverlap_LeftCharacters,
  MockApi_TorrentPatternsOverlap_LeftIndex,
  MockApi_TorrentPatternsOverlap_LeftPattern,
  MockApi_TorrentPatternsOverlap_LeftStar,
  MockApi_TorrentPatternsOverlap_NextState,
  MockApi_TorrentPatternsOverlap_Queue,
  MockApi_TorrentPatternsOverlap_Returns,
  MockApi_TorrentPatternsOverlap_RightCharacter,
  MockApi_TorrentPatternsOverlap_RightCharacters,
  MockApi_TorrentPatternsOverlap_RightIndex,
  MockApi_TorrentPatternsOverlap_RightPattern,
  MockApi_TorrentPatternsOverlap_RightStar,
  MockApi_TorrentPatternsOverlap_State,
  MockApi_TorrentPatternsOverlap_StateKey,
  MockApi_TorrentPatternsOverlap_Visited,
  MockApi_TorrentProfileNameTaken_ExcludedProfileID,
  MockApi_TorrentProfileNameTaken_Name,
  MockApi_TorrentProfileNameTaken_Returns,
  MockApi_TorrentProfiles,
  MockApi_TorrentProfileSequence,
  MockApi_Torrents,
  MockApi_TorrentSeeds,
  MockApi_TorrentSummary_Entry,
  MockApi_TorrentSummary_Returns,
  MockApi_TorrentSummary_Torrent,
  MockApi_TorrentSummaryFields,
  MockApi_UsernameIssue_Returns,
  MockApi_UsernameIssue_Username,
  MockApi_VpnCapacitySource,
  MockApi_VpnChangeRunning,
  MockApi_VpnConnectionResponse_Connection,
  MockApi_VpnConnectionResponse_Returns,
  MockApi_VpnConnections,
  MockApi_VpnConnectionSequence,
  MockApi_VpnConnectionsResponse_Returns,
  MockApi_VpnCredentialValues,
  MockApi_VpnProtection_Enabled,
  MockApi_VpnProtection_ProtectedCount,
  MockApi_VpnProtection_Returns,
  MockApi_VpnProtection_State,
  MockApi_WebProxyEnabled,
  MockApi_WebProxyLogins,
  MockApi_WebProxyLoginSequence,
  MockApi_WebProxyResponse_Available,
  MockApi_WebProxyResponse_EffectiveConnection,
  MockApi_WebProxyResponse_Logins,
  MockApi_WebProxyResponse_Returns,
  MockApi_WebProxyResponse_State,
  MockApi_WebProxyRuntimeEnabled,
  MockApi_WebProxyTransitionSequence,
} from './src/types/mock-api.d.ts';

/**
 * Mock API - Gibibyte.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const gibibyte: MockApi_Gibibyte = 1024 * 1024 * 1024;

/**
 * Mock API - Download Data Path Root Message.
 *
 * Keeps mock destination failures aligned with the control API and console.
 * Every affected mock route reuses this exact corrective guidance.
 *
 * @since 2.0.0
 */
const downloadDataPathRootMessage: MockApi_DownloadDataPathRootMessage = 'Choose a folder inside /data, not /data itself.';

/**
 * Mock API - Is Download Data Root.
 *
 * Treats trailing slashes like the control API's path normalization does.
 * Non-string values remain available to the mock's existing validation flow.
 *
 * @returns {MockApi_IsDownloadDataRoot_Returns}
 *
 * @since 2.0.0
 */
const isDownloadDataRoot = (value: MockApi_IsDownloadDataRoot_Value): MockApi_IsDownloadDataRoot_Returns => (
  typeof value === 'string' && value.replace(new RegExp(trailingSlashesPattern, 'u'), '') === '/data'
);

/**
 * Mock API - Data Path Contains.
 *
 * A slash boundary mirrors the control API's path-segment comparison and keeps
 * similarly prefixed sibling folders independent.
 *
 * @returns {MockApi_DataPathContains_Returns}
 *
 * @since 2.0.0
 */
const dataPathContains = (parentPath: MockApi_DataPathContains_ParentPath, candidatePath: MockApi_DataPathContains_CandidatePath): MockApi_DataPathContains_Returns => {
  const parent: MockApi_DataPathContains_Parent = parentPath.replace(new RegExp(trailingSlashesPattern, 'u'), '');
  const candidate: MockApi_DataPathContains_Candidate = candidatePath.replace(new RegExp(trailingSlashesPattern, 'u'), '');

  return candidate === parent || candidate.startsWith(`${parent}/`);
};

/**
 * Mock API - Data Path Contains Ignoring Case.
 *
 * Deletion protects assigned paths on case-insensitive storage without changing
 * the case-sensitive navigation behavior of the in-memory directory map.
 *
 * @returns {MockApi_DataPathContainsIgnoringCase_Returns}
 *
 * @since 2.0.0
 */
const dataPathContainsIgnoringCase = (parentPath: MockApi_DataPathContainsIgnoringCase_ParentPath, candidatePath: MockApi_DataPathContainsIgnoringCase_CandidatePath): MockApi_DataPathContainsIgnoringCase_Returns => dataPathContains(
  parentPath.toLocaleLowerCase('en-US'),
  candidatePath.toLocaleLowerCase('en-US'),
);

/**
 * Mock API - Data Paths Equal Ignoring Case.
 *
 * The first seven deletion rules share the production contract's case-folded
 * comparisons while later controller facts continue to use exact paths.
 *
 * @returns {MockApi_DataPathsEqualIgnoringCase_Returns}
 *
 * @since 2.0.0
 */
const dataPathsEqualIgnoringCase = (firstPath: MockApi_DataPathsEqualIgnoringCase_FirstPath, secondPath: MockApi_DataPathsEqualIgnoringCase_SecondPath): MockApi_DataPathsEqualIgnoringCase_Returns => (
  firstPath.toLocaleLowerCase('en-US') === secondPath.toLocaleLowerCase('en-US')
);

/**
 * Mock API - Duplicate Torrent Enabled.
 *
 * Adds the same hash on two VPN connections so the console's quiet duplicate
 * notice can be exercised without changing the normal screenshot fixtures.
 *
 * @since 2.0.0
 */
const duplicateTorrentEnabled: MockApi_DuplicateTorrentEnabled = process.env['MOCK_DUPLICATE_TORRENT'] === 'true';

/**
 * Mock API - No Vpn Connections.
 *
 * Produces the first-run torrent and web-proxy states without changing the normal
 * screenshot fixture.
 *
 * @since 2.0.0
 */
const noVPNConnections: MockApi_NoVPNConnections = process.env['MOCK_NO_VPN_CONNECTIONS'] === 'true';

/**
 * Mock API - Torrent Add Outcome.
 *
 * Supports failed and alternating mixed batches for dialog result checks. The normal
 * fixture continues to add every valid source.
 *
 * @since 2.0.0
 */
const torrentAddOutcome: MockApi_TorrentAddOutcome = process.env['MOCK_TORRENT_ADD_OUTCOME'] ?? 'success';

/**
 * Mock API - Torrent Add Attempt.
 *
 * Counts requests so the mixed outcome alternates deterministically.
 * The counter starts fresh with each mock process.
 *
 * @since 2.0.0
 */
let torrentAddAttempt: MockApi_TorrentAddAttempt = 0;

/**
 * Mock API - Notification Transport Error.
 *
 * Produces a refused connection with safe wording and expandable raw diagnostics.
 * The normal fixture keeps its existing HTTP failure.
 *
 * @since 2.0.0
 */
const notificationTransportError: MockApi_NotificationTransportError = process.env['MOCK_NOTIFICATION_TRANSPORT_ERROR'] === 'true';

/**
 * Mock API - Raw Notification Transport Error.
 *
 * Matches the diagnostic returned by a refused local TCP connection.
 * The public fixture keeps it separate from the plain-language message.
 *
 * @since 2.0.0
 */
const rawNotificationTransportError: MockApi_RawNotificationTransportError = 'dial tcp 127.0.0.1:9: connect: connection refused';

/**
 * Mock API - Mock Vpn Test Failure Message.
 *
 * Mirrors the control API's secret-free fallback for an unclassified failure.
 * The mock never returns its internal controller diagnostic to the console.
 *
 * @since 2.0.0
 */
const mockVPNTestFailureMessage: MockApi_MockVPNTestFailureMessage = 'The VPN connection couldn\'t be verified. Check its endpoints and credentials, then try again.';

/**
 * Mock API - Mock Notification Transport Failure.
 *
 * Mirrors the control API's host-specific wording for common delivery errors.
 * It falls back to the original already-public sender message when unclassified.
 *
 * @returns {MockApi_MockNotificationTransportFailure_Returns}
 *
 * @since 2.0.0
 */
const mockNotificationTransportFailure = (raw: MockApi_MockNotificationTransportFailure_Raw): MockApi_MockNotificationTransportFailure_Returns => {
  const lookupMatch: MockApi_MockNotificationTransportFailure_LookupMatch = raw.match(new RegExp(lookupHostPattern, 'iu'));
  const lookupHost: MockApi_MockNotificationTransportFailure_LookupHost = (lookupMatch !== null) ? lookupMatch[1] : undefined;

  if (lookupHost !== undefined && new RegExp(unknownHostPattern, 'iu').test(raw) === true) {
    return `Couldn't find ${lookupHost}. Check the address.`;
  }

  const transportMatch: MockApi_MockNotificationTransportFailure_TransportMatch = raw.match(new RegExp(transportHostPattern, 'iu'));
  const transportHost: MockApi_MockNotificationTransportFailure_TransportHost = (transportMatch !== null) ? transportMatch[1] : undefined;

  if (new RegExp(connectionRefusedPattern, 'iu').test(raw) === true) {
    return (transportHost === undefined) ? 'The destination refused the connection.' : `${transportHost} refused the connection. Check the address.`;
  }

  if (new RegExp(timeoutPattern, 'iu').test(raw) === true) {
    return (transportHost === undefined) ? 'The destination timed out.' : `No reply from ${transportHost}. Check the address.`;
  }

  if (new RegExp(tlsErrorPattern, 'iu').test(raw) === true) {
    return (transportHost === undefined) ? 'The secure connection to the destination failed.' : `The secure connection to ${transportHost} failed. Check its certificate.`;
  }

  return raw;
};

/**
 * Mock API - Northwind Connection ID.
 *
 * Keeps fixture relationships stable across torrents, profiles, and logins.
 * The hexadecimal suffix follows the production identifier format.
 *
 * @since 2.0.0
 */
const northwindConnectionId: MockApi_NorthwindConnectionId = 'vpc-0000000000000000';

/**
 * Mock API - Fabrikam Connection ID.
 *
 * Keeps fixture relationships stable across torrents, profiles, and logins.
 * The hexadecimal suffix follows the production identifier format.
 *
 * @since 2.0.0
 */
const fabrikamConnectionId: MockApi_FabrikamConnectionId = 'vpc-0000000000000001';

/**
 * Mock API - Contoso Connection ID.
 *
 * Keeps fixture relationships stable across torrents, profiles, and logins.
 * The hexadecimal suffix follows the production identifier format.
 *
 * @since 2.0.0
 */
const contosoConnectionId: MockApi_ContosoConnectionId = 'vpc-0000000000000002';

/**
 * Mock API - Connection Being Removed ID.
 *
 * Lets browser checks reproduce the stable conflict while targeting Fabrikam.
 * The normal mock remains fully mutable when the environment flag is absent.
 *
 * @since 2.0.0
 */
const connectionBeingRemovedId: MockApi_ConnectionBeingRemovedId = (process.env['MOCK_CONNECTION_BEING_REMOVED'] === 'true') ? fabrikamConnectionId : null;

/**
 * Mock API - Torrent Move Warnings.
 *
 * Adds a successful post-move warning to every move result for browser checks.
 * The result remains moved, matching the backend's final-placement contract.
 *
 * @since 2.0.0
 */
const torrentMoveWarnings: MockApi_TorrentMoveWarnings = (process.env['MOCK_VPN_MOVE_WARNING'] === 'true') ? ['The torrent moved, but the mock restart check could not confirm that it resumed.'] : [];

/**
 * Mock API - Missing Web Proxy Connection ID.
 *
 * Reproduces a durable login whose former explicit connection was removed.
 * The public response safely resolves it through the current default.
 *
 * @since 2.0.0
 */
const missingWebProxyConnectionId: MockApi_MissingWebProxyConnectionId = 'vpc-ffffffffffffffff';

/**
 * Mock API - Torrent Seeds.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const torrentSeeds: MockApi_TorrentSeeds = [
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
 * Mock API - Create Torrents.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {MockApi_CreateTorrents_Returns}
 *
 * @since 2.0.0
 */
const createTorrents = (): MockApi_CreateTorrents_Returns => torrentSeeds.map((seed, index): MockApi_CreateTorrents_Torrent => {
  const now: MockApi_CreateTorrents_Now = Math.floor(Date.now() / 1000);
  const downloaded: MockApi_CreateTorrents_Downloaded = Math.round(seed['size'] * seed['percent']);
  const uploaded: MockApi_CreateTorrents_Uploaded = Math.round(downloaded * (((index % 4) * 0.45) + 0.2));
  const addedDate: MockApi_CreateTorrents_AddedDate = now - ((index + 2) * 86400) - (((index * 5) % 12) * 3600);
  const secondsDownloading: MockApi_CreateTorrents_SecondsDownloading = Math.round(downloaded / (1.5 * 1024 * 1024));
  const doneDate: MockApi_CreateTorrents_DoneDate = (seed['percent'] >= 1) ? addedDate + secondsDownloading : 0;
  let connectionId: MockApi_CreateTorrents_ConnectionId = northwindConnectionId;
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
 * Mock API - Mock Pieces.
 *
 * Builds the piece map for a torrent's details from its progress. Pieces arrive in runs,
 * and the stalled torrent keeps a stretch near the end that no connected peer has.
 *
 * @returns {MockApi_MockPieces_Returns}
 *
 * @since 2.0.0
 */
const mockPieces = (torrent: MockApi_MockPieces_Torrent): MockApi_MockPieces_Returns => {
  const pieceSize: MockApi_MockPieces_PieceSize = (torrent['sizeWhenDone'] > 8 * gibibyte) ? 8 * 1024 * 1024 : 2 * 1024 * 1024;
  const pieceCount: MockApi_MockPieces_PieceCount = Math.max(1, Math.ceil(torrent['sizeWhenDone'] / pieceSize));
  const target: MockApi_MockPieces_Target = Math.round(pieceCount * torrent['percentDone']);
  const have: MockApi_MockPieces_Have = Array.from({ length: pieceCount }, () => torrent['percentDone'] >= 1);
  let seed: MockApi_MockPieces_Seed = torrent['id'] * 7919;
  let filled: MockApi_MockPieces_Filled = have.filter(Boolean).length;

  /**
   * Mock API - Random.
   *
   * Repeats the same pieces for a torrent every time the mock starts.
   * A plain linear congruential generator is enough for sample data.
   *
   * @returns {MockApi_MockPieces_Random_Returns}
   *
   * @since 2.0.0
   */
  const random: MockApi_MockPieces_Random = (): MockApi_MockPieces_Random_Returns => {
    seed = ((seed * 1103515245) + 12345) % 2147483648;

    return seed / 2147483648;
  };

  while (filled < target) {
    const start: MockApi_MockPieces_Start = Math.floor(random() * pieceCount);
    const end: MockApi_MockPieces_End = Math.min(pieceCount, start + 6 + Math.floor(random() * 42));

    for (let index = start; index < end && filled < target; index += 1) {
      if (have[index] === false) {
        Reflect.set(have, index, true);

        filled += 1;
      }
    }
  }

  const bytes: MockApi_MockPieces_Bytes = Array.from({ length: Math.ceil(pieceCount / 8) }, () => 0);

  have.forEach((owned, index) => {
    if (owned === true) {
      Reflect.set(bytes, Math.floor(index / 8), (bytes[Math.floor(index / 8)] ?? 0) + (2 ** (7 - (index % 8))));
    }

    return;
  });

  return {
    availability: have.map((owned, index) => {
      if (owned === true) {
        return -1;
      }

      return (
        torrent['isStalled'] === true
        && index > pieceCount * 0.86
        && index < pieceCount * 0.9
      ) ? 0 : 1 + Math.floor(random() * 12);
    }),
    pieceCount,
    pieceSize,
    pieces: Buffer.from(bytes).toString('base64'),
  };
};

/**
 * Mock API - Torrent Profiles.
 *
 * Provides representative automatic matching and profile-assignment state.
 * Named profiles are returned alphabetically and overlapping patterns are allowed.
 *
 * @since 2.0.0
 */
const torrentProfiles: MockApi_TorrentProfiles = [
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
 * Mock API - Torrent Patterns Overlap.
 *
 * Mirrors the control API's memoized product walk for `*`, `?`, and literal
 * characters so mock overlap notes follow the production language exactly.
 *
 * @returns {MockApi_TorrentPatternsOverlap_Returns}
 *
 * @since 2.0.0
 */
const torrentPatternsOverlap = (leftPattern: MockApi_TorrentPatternsOverlap_LeftPattern, rightPattern: MockApi_TorrentPatternsOverlap_RightPattern): MockApi_TorrentPatternsOverlap_Returns => {
  const leftCharacters: MockApi_TorrentPatternsOverlap_LeftCharacters = [...leftPattern];
  const rightCharacters: MockApi_TorrentPatternsOverlap_RightCharacters = [...rightPattern];
  const queue: MockApi_TorrentPatternsOverlap_Queue = [[
    0,
    0,
  ]];
  const visited: MockApi_TorrentPatternsOverlap_Visited = new Set<string>();

  while (queue.length > 0) {
    const state: MockApi_TorrentPatternsOverlap_State = queue.shift();
    if (state === undefined) {
      continue;
    }
    const leftIndex: MockApi_TorrentPatternsOverlap_LeftIndex = state[0];
    const rightIndex: MockApi_TorrentPatternsOverlap_RightIndex = state[1];
    const stateKey: MockApi_TorrentPatternsOverlap_StateKey = `${leftIndex}:${rightIndex}`;
    if (visited.has(stateKey) === true) {
      continue;
    }
    visited.add(stateKey);
    if (leftIndex === leftCharacters.length && rightIndex === rightCharacters.length) {
      return true;
    }
    const leftCharacter: MockApi_TorrentPatternsOverlap_LeftCharacter = leftCharacters[leftIndex];
    const rightCharacter: MockApi_TorrentPatternsOverlap_RightCharacter = rightCharacters[rightIndex];
    const leftStar: MockApi_TorrentPatternsOverlap_LeftStar = leftCharacter === '*';
    const rightStar: MockApi_TorrentPatternsOverlap_RightStar = rightCharacter === '*';
    if (leftStar === true) {
      queue.push([
        leftIndex + 1,
        rightIndex,
      ]);
    }
    if (rightStar === true) {
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
    const nextState: MockApi_TorrentPatternsOverlap_NextState = [
      (leftStar === true) ? leftIndex : leftIndex + 1,
      (rightStar === true) ? rightIndex : rightIndex + 1,
    ];
    if (nextState[0] !== leftIndex || nextState[1] !== rightIndex) {
      queue.push(nextState);
    }
  }

  return false;
};

/**
 * Mock API - Refresh Torrent Profile Presentation.
 *
 * Keeps named profiles alphabetized and rebuilds informational overlap pairs after
 * every in-memory create, edit, or delete.
 *
 * @returns {MockApi_RefreshTorrentProfilePresentation_Returns}
 *
 * @since 2.0.0
 */
const refreshTorrentProfilePresentation = (): MockApi_RefreshTorrentProfilePresentation_Returns => {
  torrentProfiles.sort((leftProfile, rightProfile) => (
    leftProfile['name'].localeCompare(rightProfile['name'], undefined, { sensitivity: 'base' })
    || leftProfile['name'].localeCompare(rightProfile['name'])
  ));

  for (const profile of torrentProfiles) {
    profile.overlaps = torrentProfiles.flatMap((otherProfile): MockApi_RefreshTorrentProfilePresentation_Overlaps => {
      if (otherProfile['id'] === profile['id']) {
        return [];
      }

      return profile['matchPatterns'].flatMap((ownPattern): MockApi_RefreshTorrentProfilePresentation_Overlaps => (
        otherProfile['matchPatterns'].flatMap((otherPattern): MockApi_RefreshTorrentProfilePresentation_Overlaps => (
          (torrentPatternsOverlap(ownPattern, otherPattern) === true) ? [{
            ownPattern,
            pattern: otherPattern,
            profileId: otherProfile['id'],
            profileName: otherProfile['name'],
          }] : []
        ))
      ));
    });
  }

  return;
};

refreshTorrentProfilePresentation();

/**
 * Mock API - Default Torrent Profile.
 *
 * Mirrors the real Default profile that owns the Download directory and always
 * follows the default VPN connection.
 *
 * @since 2.0.0
 */
const defaultTorrentProfile: MockApi_DefaultTorrentProfile = {
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
 * Mock API - Profile Folder Owner.
 *
 * Finds the Default or named profile that owns a case-insensitively equal
 * folder, excluding the profile currently being edited.
 *
 * @returns {MockApi_ProfileFolderOwner_Returns}
 *
 * @since 2.0.0
 */
const profileFolderOwner = (
  directoryPath: MockApi_ProfileFolderOwner_DirectoryPath,
  excludedProfileID: MockApi_ProfileFolderOwner_ExcludedProfileID = '',
): MockApi_ProfileFolderOwner_Returns => {
  /**
   * Mock API - Relation To.
   *
   * Compares the requested folder with one owner folder, ignoring case.
   * Returns same, inside, contains, or undefined when they are unrelated.
   *
   * @returns {MockApi_ProfileFolderOwner_RelationTo_Returns}
   *
   * @since 2.0.0
   */
  const relationTo: MockApi_ProfileFolderOwner_RelationTo = (ownerPath: MockApi_ProfileFolderOwner_RelationTo_OwnerPath): MockApi_ProfileFolderOwner_RelationTo_Returns => {
    if (dataPathsEqualIgnoringCase(ownerPath, directoryPath) === true) {
      return 'same';
    }
    if (dataPathContainsIgnoringCase(ownerPath, directoryPath) === true) {
      return 'inside';
    }
    if (dataPathContainsIgnoringCase(directoryPath, ownerPath) === true) {
      return 'contains';
    }

    return undefined;
  };
  if (excludedProfileID !== 'default') {
    // No profile folder may sit inside another profile's folder or contain one.
    const defaultRelation: MockApi_ProfileFolderOwner_DefaultRelation = relationTo(defaultTorrentProfile['downloadDirectory']);
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
    const relation: MockApi_ProfileFolderOwner_RelationValue = relationTo(candidate['downloadDirectory']);
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
 * Mock API - Profile Folder Taken Message.
 *
 * Matches the backend's field error and curly-quoted folder name exactly.
 * Profile editors render this actionable text beside the folder field.
 *
 * @returns {MockApi_ProfileFolderTakenMessage_Returns}
 *
 * @since 2.0.0
 */
const profileFolderTakenMessage = (
  directoryPath: MockApi_ProfileFolderTakenMessage_DirectoryPath,
  ownerName: MockApi_ProfileFolderTakenMessage_OwnerName,
  relation: MockApi_ProfileFolderTakenMessage_Relation = 'same',
): MockApi_ProfileFolderTakenMessage_Returns => {
  const folderName: MockApi_ProfileFolderTakenMessage_FolderName = directoryPath.slice(directoryPath.lastIndexOf('/') + 1);
  if (relation === 'inside') {
    return `This folder is inside the ${ownerName}'s folder.`;
  }
  if (relation === 'contains') {
    return `This folder contains the ${ownerName}'s folder.`;
  }

  return `“${folderName}” is already the ${ownerName}'s folder.`;
};

/**
 * Mock API - Profile Folder Overlaps.
 *
 * Lists every saved profile whose folder sits inside or around another profile's
 * folder, matching the control API's folderOverlaps list.
 *
 * @returns {MockApi_ProfileFolderOverlaps_Returns}
 *
 * @since 2.0.0
 */
const profileFolderOverlaps = (): MockApi_ProfileFolderOverlaps_Returns => {
  const overlaps: MockApi_ProfileFolderOverlaps_Overlaps = [];
  const defaultOwner: MockApi_ProfileFolderOverlaps_DefaultOwner = profileFolderOwner(defaultTorrentProfile['downloadDirectory'], 'default');
  if (defaultOwner !== undefined) {
    overlaps.push({
      message: profileFolderTakenMessage(defaultTorrentProfile['downloadDirectory'], defaultOwner['name'], defaultOwner['relation']),
      profileId: 'default',
      profileName: defaultTorrentProfile['name'],
    });
  }

  for (const profile of torrentProfiles) {
    const owner: MockApi_ProfileFolderOverlaps_Owner = profileFolderOwner(profile['downloadDirectory'], profile['id']);
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
 * Mock API - Torrent Profile Name Taken.
 *
 * Mirrors the database's cross-table, case-insensitive uniqueness rule.
 * The excluded identity lets either editor retain its current spelling.
 *
 * @returns {MockApi_TorrentProfileNameTaken_Returns}
 *
 * @since 2.0.0
 */
const torrentProfileNameTaken = (name: MockApi_TorrentProfileNameTaken_Name, excludedProfileID: MockApi_TorrentProfileNameTaken_ExcludedProfileID = ''): MockApi_TorrentProfileNameTaken_Returns => (
  (
    excludedProfileID !== 'default'
    && defaultTorrentProfile['name'].toLowerCase() === name.toLowerCase()
  )
  || torrentProfiles.some((profile) => (
    profile['id'] !== excludedProfileID && profile['name'].toLowerCase() === name.toLowerCase()
  ))
);

/**
 * Mock API - Default Torrent Profile Response.
 *
 * Returns a detached response so move results can be added without mutating the
 * stored profile.
 *
 * @returns {MockApi_DefaultTorrentProfileResponse_Returns}
 *
 * @since 2.0.0
 */
const defaultTorrentProfileResponse = (): MockApi_DefaultTorrentProfileResponse_Returns => ({
  ...defaultTorrentProfile,
  labels: [...defaultTorrentProfile['labels']],
  options: {
    ...defaultTorrentProfile['options'],
    seeding: { ...defaultTorrentProfile['options']['seeding'] },
  },
});

/**
 * Mock API - Torrent Profile Sequence.
 *
 * Produces stable server-shaped identifiers for newly-created profiles.
 * The hexadecimal suffix matches the production identifier validator.
 *
 * @since 2.0.0
 */
let torrentProfileSequence: MockApi_TorrentProfileSequence = torrentProfiles.length;

/**
 * Mock API - Apply Torrent Profile Seeding.
 *
 * Converts profile stop rules to Transmission's per-torrent mode values.
 * Seed fixtures and option assignment share this exact mapping.
 *
 * @returns {MockApi_ApplyTorrentProfileSeeding_Returns}
 *
 * @since 2.0.0
 */
const applyTorrentProfileSeeding = (
  torrent: MockApi_ApplyTorrentProfileSeeding_Torrent,
  profile: MockApi_ApplyTorrentProfileSeeding_Profile,
): MockApi_ApplyTorrentProfileSeeding_Returns => {
  if (profile['options']['seeding']['mode'] === 'never') {
    Reflect.set(torrent, 'seedRatioMode', 2);
    Reflect.set(torrent, 'seedIdleMode', 2);
  } else {
    Reflect.set(torrent, 'seedRatioMode', (profile['options']['seeding']['ratio'] === null) ? 2 : 1);
    Reflect.set(torrent, 'seedRatioLimit', profile['options']['seeding']['ratio'] ?? torrent['seedRatioLimit']);
    Reflect.set(torrent, 'seedIdleMode', (profile['options']['seeding']['idleMinutes'] === null) ? 2 : 1);
    Reflect.set(torrent, 'seedIdleLimit', profile['options']['seeding']['idleMinutes'] ?? torrent['seedIdleLimit']);
  }

  return;
};

/**
 * Mock API - Merge Torrent Labels.
 *
 * Preserves remote-app labels and appends profile labels once, ignoring case.
 * Profile resolution and automatic add behavior share this rule.
 *
 * @returns {MockApi_MergeTorrentLabels_Returns}
 *
 * @since 2.0.0
 */
const mergeTorrentLabels = (existing: MockApi_MergeTorrentLabels_Existing, profileLabels: MockApi_MergeTorrentLabels_ProfileLabels): MockApi_MergeTorrentLabels_Returns => {
  const merged: MockApi_MergeTorrentLabels_Merged = [...existing];
  const seen: MockApi_MergeTorrentLabels_Seen = new Set(existing.map((label) => label.toLowerCase()));

  for (const label of profileLabels) {
    if (seen.has(label.toLowerCase()) === false) {
      merged.push(label);

      seen.add(label.toLowerCase());
    }
  }

  return merged;
};

/**
 * Mock API - Apply Torrent Profile Options.
 *
 * Copies the labels and per-torrent Transmission limits used by add and profile
 * assignment. Folder, VPN, paused state, and queue order are handled by callers.
 *
 * @returns {MockApi_ApplyTorrentProfileOptions_Returns}
 *
 * @since 2.0.0
 */
const applyTorrentProfileOptions = (
  torrent: MockApi_ApplyTorrentProfileOptions_Torrent,
  profile: MockApi_ApplyTorrentProfileOptions_Profile,
): MockApi_ApplyTorrentProfileOptions_Returns => {
  Reflect.set(torrent, 'labels', [...profile['labels']]);
  Reflect.set(torrent, 'bandwidthPriority', profile['options']['bandwidthPriority']);
  Reflect.set(torrent, 'peer-limit', profile['options']['peerLimit']);
  Reflect.set(torrent, 'downloadLimited', profile['options']['downloadLimitKBps'] !== null);
  Reflect.set(torrent, 'downloadLimit', profile['options']['downloadLimitKBps'] ?? 0);
  Reflect.set(torrent, 'uploadLimited', profile['options']['uploadLimitKBps'] !== null);
  Reflect.set(torrent, 'uploadLimit', profile['options']['uploadLimitKBps'] ?? 0);

  applyTorrentProfileSeeding(torrent, profile);

  return;
};

/**
 * Mock API - Torrents.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const torrents: MockApi_Torrents = createTorrents();

if (duplicateTorrentEnabled === true && torrents[0] !== undefined) {
  torrents.push({
    ...torrents[0],
    connectionId: northwindConnectionId,
    id: 16_777_217,
    queuePosition: torrents.length,
  });
}

for (const torrent of torrents) {
  const profile: MockApi_Profile = torrentProfiles.find(
    (candidate) => candidate['downloadDirectory'] === torrent['downloadDir'],
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
 * Mock API - Needs Profile Torrent.
 *
 * Selects the seeded pattern tie so the banner, filter, tag, and resolver are
 * available immediately in the standalone mock.
 *
 * @since 2.0.0
 */
const needsProfileTorrent: MockApi_NeedsProfileTorrent = torrents.find(
  (torrent) => torrent['name'] === 'Example.Show.S01E04.2160p',
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
 * Mock API - Move Torrents To Queue Top.
 *
 * Preserves the selected torrents' relative order and compacts every queue
 * position. Profile assignment uses it when requested options choose Top.
 *
 * @returns {MockApi_MoveTorrentsToQueueTop_Returns}
 *
 * @since 2.0.0
 */
const moveTorrentsToQueueTop = (selectedTorrents: MockApi_MoveTorrentsToQueueTop_SelectedTorrents): MockApi_MoveTorrentsToQueueTop_Returns => {
  const selectedIDs: MockApi_MoveTorrentsToQueueTop_SelectedIDs = new Set(selectedTorrents.map(
    (torrent) => torrent['id'],
  ));
  const orderedTorrents: MockApi_MoveTorrentsToQueueTop_OrderedTorrents = [
    ...selectedTorrents,
    ...torrents.filter((torrent) => selectedIDs.has(torrent['id']) === false),
  ];

  orderedTorrents.forEach((torrent, index) => {
    Reflect.set(torrent, 'queuePosition', index);

    return;
  });

  return;
};

/**
 * Mock API - Sequence.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
let sequence: MockApi_Sequence = 0;

/**
 * Mock API - Signed In.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
let signedIn: MockApi_SignedIn = false;

// MOCK_SETUP_REQUIRED=true starts before setup, to show "Set up your account". The setup code is K7Q2M-XR9TD-P4W8N.

/**
 * Mock API - Setup Required.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
let setupRequired: MockApi_SetupRequired = process.env['MOCK_SETUP_REQUIRED'] === 'true';

/**
 * Mock API - Setup Started At.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const setupStartedAt: MockApi_SetupStartedAt = Date.now();

// MOCK_KEY_REPLACED=true starts as if the installation key had been lost, to show the notice.

/**
 * Mock API - Key Replaced.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const keyReplaced: MockApi_KeyReplaced = process.env['MOCK_KEY_REPLACED'] === 'true';

/**
 * Mock API - Removed Secrets.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
let removedSecrets: MockApi_RemovedSecrets = (keyReplaced === true) ? [
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
 * Mock API - Notification Fields.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const notificationFields: MockApi_NotificationFields = {
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
 * Mock API - Notification Events.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const notificationEvents: MockApi_NotificationEvents = [
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
 * Mock API - Notifications Started At.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const notificationsStartedAt: MockApi_NotificationsStartedAt = Date.now();

/**
 * Mock API - Notification Minute.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const notificationMinute: MockApi_NotificationMinute = 60 * 1000;

/**
 * Mock API - Notifications.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const notifications: MockApi_Notifications = [
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
    lastError: (notificationTransportError === true) ? mockNotificationTransportFailure(rawNotificationTransportError) : 'HTTP 502: Bad Gateway',
    lastErrorDetails: (notificationTransportError === true) ? rawNotificationTransportError : null,
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
if (keyReplaced === true) {
  for (const notification of [...notifications].sort((left, right) => left['name'].localeCompare(right['name']))) {
    const secretKeys: MockApi_SecretKeys = Object.keys(notification['secrets']).sort();

    if (secretKeys.length === 0) {
      continue;
    }

    notification.secrets = {};
    notification.secretsMissing = secretKeys;
    removedSecrets.push({
      kind: 'notification',
      name: notification['name'],
      notificationId: notification['id'],
      removedAt: new Date().toISOString(),
    });
  }
}

// The name typed for the passkey being added; the browser's answer doesn't carry it.

/**
 * Mock API - Pending Passkey Name.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
let pendingPasskeyName: MockApi_PendingPasskeyName = 'Passkey';

// Mock account state for the sign-in and security screens.

/**
 * Mock API - Account.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const account: MockApi_Account = {
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
 * Mock API - New Recovery Codes.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {MockApi_NewRecoveryCodes_Returns}
 *
 * @since 2.0.0
 */
const newRecoveryCodes = (): MockApi_NewRecoveryCodes_Returns => Array.from({ length: 10 }, () => {
  const alphabet: MockApi_NewRecoveryCodes_Alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code: MockApi_NewRecoveryCodes_Code = '';

  for (let index = 0; index < 10; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return code;
});

/**
 * Mock API - Format Recovery Code.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {MockApi_FormatRecoveryCode_Returns}
 *
 * @since 2.0.0
 */
const formatRecoveryCode = (code: MockApi_FormatRecoveryCode_Code): MockApi_FormatRecoveryCode_Returns => `${code.slice(0, 5)}-${code.slice(5)}`;

// Write scopes include their read scope, matching the real API.

/**
 * Mock API - Expand Scopes.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {MockApi_ExpandScopes_Returns}
 *
 * @since 2.0.0
 */
const expandScopes = (scopes: MockApi_ExpandScopes_Scopes): MockApi_ExpandScopes_Returns => {
  const expanded: MockApi_ExpandScopes_Expanded = new Set(scopes);

  for (const scope of scopes) {
    if (scope.endsWith(':write') === true) {
      expanded.add(scope.replace(':write', ':read'));
    }
  }

  return [...expanded].sort();
};

// The modules of the QR code the Go server draws for mockTotpUri, made once with rsc.io/qr at
// level M like security.QRCodeDataURI. Remake them if the URI changes.

/**
 * Mock API - Mock Qr Rows.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const mockQrRows: MockApi_MockQrRows = [
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
 * Mock API - Mock Totp URI.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const mockTotpUri: MockApi_MockTotpUri = 'otpauth://totp/Transmission%20VPN:admin?algorithm=SHA1&digits=6&issuer=Transmission+VPN&period=30&secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

// mockQrCode draws mockQrRows the way security.QRCodeDataURI does, with a four-module quiet zone.

/**
 * Mock API - Mock Qr Code.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {MockApi_MockQrCode_Returns}
 *
 * @since 2.0.0
 */
const mockQrCode = (): MockApi_MockQrCode_Returns => {
  const size: MockApi_MockQrCode_Size = mockQrRows.length;
  let path: MockApi_MockQrCode_Path = '';

  for (let y = 0; y < size; y += 1) {
    const row: MockApi_MockQrCode_Row = mockQrRows[y];

    for (let x = 0; x < size; x += 1) {
      if (row !== undefined && row[x] === '1') {
        path += `M${x + 4} ${y + 4}h1v1h-1z`;
      }
    }
  }

  const svg: MockApi_MockQrCode_Svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size + 8} ${size + 8}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path fill="#000" d="${path}"/></svg>`;

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
const directories: MockApi_Directories = new Map([
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
 * Mock API - Saved Labels.
 *
 * Keeps the label presets that an organization save replaces.
 * The dialogs and the sidebar then show what was saved.
 *
 * @since 2.0.0
 */
const savedLabels: MockApi_SavedLabels = [
  'arm',
  'linux',
  'music',
  'public-domain',
  'research',
];

/**
 * Mock API - Organization Revision.
 *
 * Counts organization saves, like the API's stored revision.
 * A save from a dialog opened on an older revision gets the API's conflict.
 *
 * @since 2.0.0
 */
let organizationRevision: MockApi_OrganizationRevision = 1;

/**
 * Mock API - Save Used Labels.
 *
 * Preserves the first case-insensitive spelling and advances the organization
 * revision once when a write introduces one or more new labels.
 *
 * @returns {MockApi_SaveUsedLabels_Returns}
 *
 * @since 2.0.0
 */
const saveUsedLabels = (
  labels: MockApi_SaveUsedLabels_Labels,
  advanceRevision: MockApi_SaveUsedLabels_AdvanceRevision = true,
): MockApi_SaveUsedLabels_Returns => {
  const savedKeys: MockApi_SaveUsedLabels_SavedKeys = new Set<string>(savedLabels.map(
    (label) => label.toLowerCase(),
  ));
  let changed: MockApi_SaveUsedLabels_Changed = false;

  for (const label of labels) {
    const key: MockApi_SaveUsedLabels_Key = label.toLowerCase();

    if (label === '' || savedKeys.has(key) === true) {
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

  if (changed === false) {
    return;
  }

  savedLabels.sort((leftLabel, rightLabel) => (
    leftLabel.localeCompare(rightLabel, undefined, { sensitivity: 'base' })
    || leftLabel.localeCompare(rightLabel)
  ));

  if (advanceRevision === true) {
    organizationRevision += 1;
  }

  return;
};

/**
 * Mock API - Apply Saved Label Edits.
 *
 * Uses the same case-insensitive deletion, rename, and de-duplication behavior for
 * torrents and profiles.
 *
 * @returns {MockApi_ApplySavedLabelEdits_Returns}
 *
 * @since 2.0.0
 */
const applySavedLabelEdits = (
  labels: MockApi_ApplySavedLabelEdits_Labels,
  removedLabels: MockApi_ApplySavedLabelEdits_RemovedLabels,
  renamedLabels: MockApi_ApplySavedLabelEdits_RenamedLabels,
): MockApi_ApplySavedLabelEdits_Returns => {
  const nextLabels: MockApi_ApplySavedLabelEdits_NextLabels = [];

  for (const label of labels) {
    if (removedLabels.some(
      (removedLabel) => removedLabel.toLowerCase() === label.toLowerCase(),
    ) === true) {
      continue;
    }

    const rename: MockApi_ApplySavedLabelEdits_Rename = renamedLabels.find(
      (candidate) => candidate['from'].toLowerCase() === label.toLowerCase(),
    );
    const nextLabel: MockApi_ApplySavedLabelEdits_NextLabel = ((rename !== undefined) ? rename['to'] : undefined) ?? label;

    if (nextLabels.some(
      (existingLabel) => existingLabel.toLowerCase() === nextLabel.toLowerCase(),
    ) === false) {
      nextLabels.push(nextLabel);
    }
  }

  return nextLabels;
};

saveUsedLabels([
  ...defaultTorrentProfile['labels'],
  ...torrentProfiles.flatMap((profile) => profile['labels']),
  ...torrents.flatMap((torrent) => torrent['labels']),
], false);

/**
 * Mock API - Settings.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const settings: MockApi_Settings = [
  {
    'key': 'transmission.downloadDirectory',
    'category': 'transmission.storage',
    'title': 'Download directory',
    'description': 'Completed downloads are written beneath the approved /data mount.',
    'value': '/data/downloads',
    'defaultValue': '/data/downloads',
    'source': (defaultTorrentProfile['downloadDirectoryLocked'] === true) ? 'managed' : 'default',
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
    'value': noVPNConnections === false,
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
    'value': noVPNConnections === false,
    'defaultValue': false,
    'source': (noVPNConnections === true) ? 'default' : 'user',
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
 * Mock API - Effective String Setting.
 *
 * Resolves mutable mock settings for Default-profile and storage-policy responses.
 * Route handlers therefore observe Settings changes without duplicated state.
 *
 * @returns {MockApi_EffectiveStringSetting_Returns}
 *
 * @since 2.0.0
 */
const effectiveStringSetting = (key: MockApi_EffectiveStringSetting_Key): MockApi_EffectiveStringSetting_Returns => {
  const matchedSetting: MockApi_EffectiveStringSetting_MatchedSetting = settings.find((setting) => setting['key'] === key);

  return String(((matchedSetting !== undefined) ? matchedSetting['value'] : undefined) ?? '');
};

/**
 * Mock API - Ensure Directory.
 *
 * Adds every missing parent beneath /data so the in-memory folder browser follows
 * the control API's controller-backed creation behavior.
 *
 * @returns {MockApi_EnsureDirectory_Returns}
 *
 * @since 2.0.0
 */
const ensureDirectory = (directoryPath: MockApi_EnsureDirectory_DirectoryPath): MockApi_EnsureDirectory_Returns => {
  if (directoryPath.startsWith('/data/') === false || directoryPath.includes('/../') === true) {
    return;
  }

  let currentPath: MockApi_EnsureDirectory_CurrentPath = '/data';

  for (const component of directoryPath.slice('/data/'.length).split('/')) {
    currentPath = `${currentPath}/${component}`;

    if (directories.has(currentPath) === false) {
      directories.set(currentPath, {
        files: 0,
        mountPoint: false,
        readable: true,
      });
    }
  }

  return;
};

/**
 * Mock API - Ensure Configured Directories.
 *
 * Keeps the Default profile and enabled incomplete folder visible after Settings
 * changes, matching the production startup and save behavior.
 *
 * @returns {MockApi_EnsureConfiguredDirectories_Returns}
 *
 * @since 2.0.0
 */
const ensureConfiguredDirectories = (): MockApi_EnsureConfiguredDirectories_Returns => {
  ensureDirectory(effectiveStringSetting('transmission.downloadDirectory'));

  const incompleteSetting: MockApi_EnsureConfiguredDirectories_IncompleteSetting = settings.find(
    (setting) => setting['key'] === 'transmission.incompleteDirectoryEnabled',
  );
  const incompleteEnabled: MockApi_EnsureConfiguredDirectories_IncompleteEnabled = incompleteSetting !== undefined && incompleteSetting['value'] === true;

  if (incompleteEnabled === true) {
    ensureDirectory(effectiveStringSetting('transmission.incompleteDirectory'));
  }

  return;
};

ensureConfiguredDirectories();

for (const profile of torrentProfiles) {
  ensureDirectory(profile['downloadDirectory']);
}

/**
 * Mock API - Download Selection.
 *
 * Returns the listing fields supplied by the real storage-directory endpoint.
 * Navigation remains available even when final selection is unavailable.
 *
 * @returns {MockApi_DownloadSelection_Returns}
 *
 * @since 2.0.0
 */
const downloadSelection = (directoryPath: MockApi_DownloadSelection_DirectoryPath): MockApi_DownloadSelection_Returns => {
  if (directoryPath === '/data') {
    return {
      allowed: false,
      reason: 'Open or create a folder inside /data. Torrents can\'t be saved in /data itself.',
    };
  }

  const incompleteDirectory: MockApi_DownloadSelection_IncompleteDirectory = effectiveStringSetting('transmission.incompleteDirectory');

  if (dataPathContains(incompleteDirectory, directoryPath) === true) {
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
 * Mock API - Directory Children.
 *
 * Lists immediate real subfolders in the same lexical order as the controller.
 * Deeper descendants are excluded until their own level is requested.
 *
 * @returns {MockApi_DirectoryChildren_Returns}
 *
 * @since 2.0.0
 */
const directoryChildren = (directoryPath: MockApi_DirectoryChildren_DirectoryPath): MockApi_DirectoryChildren_Returns => [...directories.keys()].filter(
  (candidate) => (
    candidate.startsWith(`${directoryPath}/`) === true
    && candidate.slice(directoryPath.length + 1).includes('/') === false
  ),
).sort();

/**
 * Mock API - Incomplete Selection.
 *
 * Applies the reverse-containment policy used by the Incomplete directory field.
 * The current incomplete folder remains usable even when assignments sit elsewhere.
 *
 * @returns {MockApi_IncompleteSelection_Returns}
 *
 * @since 2.0.0
 */
const incompleteSelection = (directoryPath: MockApi_IncompleteSelection_DirectoryPath): MockApi_IncompleteSelection_Returns => {
  if (directoryPath === effectiveStringSetting('transmission.incompleteDirectory')) {
    return {
      allowed: true,
      reason: '',
    };
  }

  const clash: MockApi_IncompleteSelection_Clash = [
    {
      path: effectiveStringSetting('transmission.downloadDirectory'),
      profileName: defaultTorrentProfile['name'],
    },
    ...torrentProfiles.map((profile): MockApi_IncompleteSelection_Destination => ({
      path: profile['downloadDirectory'],
      profileName: `${profile['name']} profile`,
    })),
  ].find((destination) => dataPathContains(directoryPath, destination['path']));

  if (clash === undefined) {
    return {
      allowed: true,
      reason: '',
    };
  }

  const exactFolder: MockApi_IncompleteSelection_ExactFolder = dataPathsEqualIgnoringCase(directoryPath, clash['path']);

  return {
    allowed: false,
    reason: (exactFolder === true) ? `“${clash['path'].slice(clash['path'].lastIndexOf('/') + 1)}” is the ${clash['profileName']}'s folder, so it can't be the incomplete folder.` : `Use a folder outside ${clash['path']}. Torrents in the ${clash['profileName']} finish there.`,
  };
};

/**
 * Mock API - Profile Selection.
 *
 * Applies ordinary download-folder safety and reserves every other profile's
 * folder for its current owner.
 *
 * @returns {MockApi_ProfileSelection_Returns}
 *
 * @since 2.0.0
 */
const profileSelection = (directoryPath: MockApi_ProfileSelection_DirectoryPath, profileID: MockApi_ProfileSelection_ProfileID): MockApi_ProfileSelection_Returns => {
  const downloadPolicy: MockApi_ProfileSelection_DownloadPolicy = downloadSelection(directoryPath);

  if (downloadPolicy['allowed'] === false) {
    return downloadPolicy;
  }

  const owner: MockApi_ProfileSelection_Owner = profileFolderOwner(directoryPath, profileID);

  if (owner === undefined) {
    return downloadPolicy;
  }

  return {
    allowed: false,
    reason: profileFolderTakenMessage(directoryPath, owner['name'], owner['relation']),
  };
};

/**
 * Mock API - Directory Tags.
 *
 * Builds the contract's stable tag order from effective Settings and profile state.
 * The Download directory leads named profile tags as the setting-backed Default.
 *
 * @returns {MockApi_DirectoryTags_Returns}
 *
 * @since 2.0.0
 */
const directoryTags = (directoryPath: MockApi_DirectoryTags_DirectoryPath): MockApi_DirectoryTags_Returns => {
  const tags: MockApi_DirectoryTags_Tags = [];

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
 * Mock API - Directory Deletion Policy.
 *
 * Evaluates the contract's ordered advisory rules and returns the first match.
 * DELETE repeats this function so a listing never authorizes a stale mutation.
 *
 * @returns {MockApi_DirectoryDeletionPolicy_Returns}
 *
 * @since 2.0.0
 */
const directoryDeletionPolicy = (directoryPath: MockApi_DirectoryDeletionPolicy_DirectoryPath): MockApi_DirectoryDeletionPolicy_Returns => {
  const folderName: MockApi_DirectoryDeletionPolicy_FolderName = directoryPath.slice(directoryPath.lastIndexOf('/') + 1);
  const incompleteDirectory: MockApi_DirectoryDeletionPolicy_IncompleteDirectory = effectiveStringSetting('transmission.incompleteDirectory');

  if (
    dataPathsEqualIgnoringCase(directoryPath, incompleteDirectory) === false
    && dataPathContainsIgnoringCase(incompleteDirectory, directoryPath) === true
  ) {
    return {
      code: 'directory_in_use',
      message: 'Folders inside the incomplete folder belong to Transmission, so they can\'t be deleted here.',
    };
  }

  if (dataPathsEqualIgnoringCase(directoryPath, incompleteDirectory) === true) {
    return {
      code: 'directory_in_use',
      message: `“${folderName}” is the Incomplete folder in Settings, so it can't be deleted.`,
    };
  }

  const assignedProfile: MockApi_DirectoryDeletionPolicy_AssignedProfile = torrentProfiles.map((profile): MockApi_DirectoryDeletionPolicy_ProfileFolder => ({
    name: profile['name'],
    path: profile['downloadDirectory'],
  })).find((profile) => dataPathsEqualIgnoringCase(profile['path'], directoryPath));

  if (assignedProfile !== undefined) {
    return {
      code: 'directory_in_use',
      message: `“${folderName}” is the ${assignedProfile['name']} profile's folder, so it can't be deleted.`,
    };
  }

  if (dataPathsEqualIgnoringCase(directoryPath, effectiveStringSetting('transmission.downloadDirectory')) === true) {
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
    (torrent) => dataPathsEqualIgnoringCase(torrent['downloadDir'], directoryPath),
  ) === true) {
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

  const metadata: MockApi_DirectoryDeletionPolicy_Metadata = directories.get(directoryPath);

  if (metadata !== undefined && metadata['mountPoint'] === true) {
    return {
      code: 'directory_in_use',
      message: `“${folderName}” is a separate mount, so it can't be deleted.`,
    };
  }

  if (metadata !== undefined && metadata['readable'] === false) {
    return {
      code: 'directory_in_use',
      message: `Transmission's account can't open “${folderName}”, so it can't be deleted here.`,
    };
  }

  if ((((metadata !== undefined) ? metadata['files'] : undefined) ?? 0) > 0 || directoryChildren(directoryPath).length > 0) {
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
 * Mock API - Directory Selection.
 *
 * Selects the purpose-specific usability rule for one directory. Profile
 * checks also receive the current owner identifier so its folder stays usable.
 *
 * @returns {MockApi_DirectorySelection_Returns}
 *
 * @since 2.0.0
 */
const directorySelection = (
  directoryPath: MockApi_DirectorySelection_DirectoryPath,
  purpose: MockApi_DirectorySelection_Purpose,
  profileID: MockApi_DirectorySelection_ProfileID,
): MockApi_DirectorySelection_Returns => {
  if (purpose === 'download') {
    return downloadSelection(directoryPath);
  }

  if (purpose === 'incomplete') {
    return incompleteSelection(directoryPath);
  }

  return profileSelection(directoryPath, profileID);
};

/**
 * Mock API - List Directory.
 *
 * Returns one purpose-aware tree level using the full console contract.
 * The envelope's legacy download fields continue to describe the listed folder.
 *
 * @returns {MockApi_ListDirectory_Returns}
 *
 * @since 2.0.0
 */
const listDirectory = (
  directoryPath: MockApi_ListDirectory_DirectoryPath,
  purpose: MockApi_ListDirectory_Purpose,
  profileID: MockApi_ListDirectory_ProfileID = '',
): MockApi_ListDirectory_Returns => {
  const selection: MockApi_ListDirectory_Selection = directorySelection(directoryPath, purpose, profileID);

  return {
    downloadAllowed: selection['allowed'],
    ...((selection['reason'] === '') ? {} : {
      downloadUnavailableReason: selection['reason'],
    }),
    path: directoryPath,
    ...((directoryPath === '/data') ? {} : {
      parentPath: directoryPath.slice(0, directoryPath.lastIndexOf('/')),
    }),
    directories: directoryChildren(directoryPath).map((child): MockApi_ListDirectory_Directory => {
      const metadata: MockApi_ListDirectory_Metadata = directories.get(child) ?? {
        files: 0,
        mountPoint: false,
        readable: true,
      };
      const childDirectories: MockApi_ListDirectory_ChildDirectories = directoryChildren(child);
      const purposeSelection: MockApi_ListDirectory_PurposeSelection = directorySelection(child, purpose, profileID);
      const deletionPolicy: MockApi_ListDirectory_DeletionPolicy = directoryDeletionPolicy(child);

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
 * Mock API - Download Folder Issue.
 *
 * Reuses effective incomplete-folder state across every mock destination route.
 * An empty result means the candidate passes both reserved-folder checks.
 *
 * @returns {MockApi_DownloadFolderIssue_Returns}
 *
 * @since 2.0.0
 */
const downloadFolderIssue = (value: MockApi_DownloadFolderIssue_Value): MockApi_DownloadFolderIssue_Returns => {
  if (isDownloadDataRoot(value) === true) {
    return downloadDataPathRootMessage;
  }

  if (typeof value !== 'string' || value === '') {
    return 'Choose a normalized folder beneath /data.';
  }

  const incompleteDirectory: MockApi_DownloadFolderIssue_IncompleteDirectory = effectiveStringSetting('transmission.incompleteDirectory');

  if (dataPathContains(incompleteDirectory, value) === true) {
    return `Choose a folder outside the incomplete folder, ${incompleteDirectory}.`;
  }

  return '';
};

/**
 * Mock API - Settings Revision.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
let settingsRevision: MockApi_SettingsRevision = 3;

/**
 * Mock API - Pending Restart Keys.
 *
 * Starts with the approved screenshot state and changes as settings are saved or applied.
 * Lets the restart notice exercise both its initial and cleared states.
 *
 * @since 2.0.0
 */
let pendingRestartKeys: MockApi_PendingRestartKeys = (noVPNConnections === true) ? [] : ['transmission.peerPortRandomOnStart'];

/**
 * Mock API - Blocklist Status.
 *
 * Starts with three representative source outcomes and changes briefly to updating
 * when the mock Update now endpoint is called.
 *
 * @since 2.0.0
 */
let blocklistStatus: MockApi_BlocklistStatus = {
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
const providers: MockApi_Providers = [
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
const profiles: MockApi_Profiles = [
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
const tokens: MockApi_Tokens = [
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
 * Mock API - Token Values.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const tokenValues: MockApi_TokenValues = new Map([
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
 * Mock API - Token Digests.
 *
 * Retains the non-reusable digest needed to model backup duplicate detection.
 * Ordinary token routes continue returning only the safe metadata in `tokens`.
 *
 * @since 2.0.0
 */
const tokenDigests: MockApi_TokenDigests = new Map(tokens.map(
  (token): MockApi_TokenDigests_Entry => {
    const tokenID: MockApi_TokenDigests_TokenID = String(token['id']);

    return [
      tokenID,
      createHash('sha256').update(tokenID).digest('base64'),
    ];
  },
));

/**
 * Mock API - Token Sequence.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
let tokenSequence: MockApi_TokenSequence = tokens.length;

/**
 * Mock API - Rpc Logins.
 *
 * Provides the stateful compatible-client credentials used by the Remote apps page.
 * Seed data covers both used and never-used timestamps.
 *
 * @since 2.0.0
 */
const rpcLogins: MockApi_RpcLogins = (noVPNConnections === true) ? [] : [
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
 * Mock API - Rpc Login Digests.
 *
 * Retains the non-reusable digest exported and restored with each compatible-client
 * login while the ordinary management routes continue returning safe metadata.
 *
 * @since 2.0.0
 */
const rpcLoginDigests: MockApi_RpcLoginDigests = new Map(rpcLogins.map(
  (login): MockApi_RpcLoginDigests_Entry => [
    login['id'],
    createHash('sha256').update(login['id']).digest('base64'),
  ],
));

/**
 * Mock API - Rpc Login Sequence.
 *
 * Generates stable identifiers for newly added mock credentials.
 * The sequence advances with every successful create request.
 *
 * @since 2.0.0
 */
let rpcLoginSequence: MockApi_RpcLoginSequence = rpcLogins.length;

/**
 * Mock API - Web Proxy Logins.
 *
 * Provides independently editable and revocable proxy credentials.
 * Seed data keeps the list state visible in documentation screenshots.
 *
 * @since 2.0.0
 */
const webProxyLogins: MockApi_WebProxyLogins = (noVPNConnections === true) ? [] : [
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
 * Mock API - Web Proxy Enabled.
 *
 * Tracks the desired switch independently from observed VPN readiness.
 * This mirrors the control API's enabled and runtime state split.
 *
 * @since 2.0.0
 */
let webProxyEnabled: MockApi_WebProxyEnabled = noVPNConnections === false;

/**
 * Mock API - Web Proxy Runtime Enabled.
 *
 * Lags behind the desired switch so the Remote apps transition state can be
 * exercised against the same delayed observation as the real proxy process.
 *
 * @since 2.0.0
 */
let webProxyRuntimeEnabled: MockApi_WebProxyRuntimeEnabled = noVPNConnections === false;

/**
 * Mock API - Web Proxy Transition Sequence.
 *
 * Invalidates older delayed writes when the desired switch changes again.
 * Only the most recent mock transition may update observed runtime state.
 *
 * @since 2.0.0
 */
let webProxyTransitionSequence: MockApi_WebProxyTransitionSequence = 0;

/**
 * Mock API - Web Proxy Login Sequence.
 *
 * Generates stable identifiers for newly added web proxy credentials.
 * The sequence advances after each successful create request.
 *
 * @since 2.0.0
 */
let webProxyLoginSequence: MockApi_WebProxyLoginSequence = webProxyLogins.length;

/**
 * Mock API - Vpn Change Running.
 *
 * The environment flag reproduces the reload-during-change state for click tests.
 * The value is shared by snapshots and the VPN status response.
 *
 * @since 2.0.0
 */
const vpnChangeRunning: MockApi_VpnChangeRunning = process.env['MOCK_VPN_CHANGE_RUNNING'] === 'true';

/**
 * Mock API - Vpn Capacity Source.
 *
 * The fallback mode mirrors containers whose memory files cannot be read.
 * Other values retain the representative cgroup-v2 fixture.
 *
 * @since 2.0.0
 */
const vpnCapacitySource: MockApi_VpnCapacitySource = (process.env['MOCK_CAPACITY_SOURCE'] === 'fallback') ? 'fallback' : 'cgroup-v2';

/**
 * Mock API - Vpn Connections.
 *
 * Starts with the three connections approved for the documentation mockups.
 * Mutating routes update this collection for the lifetime of the mock server.
 *
 * @since 2.0.0
 */
const vpnConnections: MockApi_VpnConnections = [
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
 * Mock API - Vpn Credential Values.
 *
 * Mirrors sealed server state without placing credential values on connection rows.
 * Public mock responses therefore expose only the corresponding saved field keys.
 *
 * @since 2.0.0
 */
const vpnCredentialValues: MockApi_VpnCredentialValues = new Map([
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
 * Mock API - Mock Vpn Credential Fields.
 *
 * Reads the chosen provider tunnel's field metadata from the same mock payload the
 * console consumes, keeping required-field behavior aligned with the real API.
 *
 * @returns {MockApi_MockVPNCredentialFields_Returns}
 *
 * @since 2.0.0
 */
const mockVPNCredentialFields = (
  providerId: MockApi_MockVPNCredentialFields_ProviderId,
  tunnel: MockApi_MockVPNCredentialFields_Tunnel,
): MockApi_MockVPNCredentialFields_Returns => {
  const providerDefinition: MockApi_MockVPNCredentialFields_ProviderDefinition = providers.find(
    (candidate) => candidate['id'] === providerId,
  );
  const tunnelDefinitions: MockApi_MockVPNCredentialFields_TunnelDefinitions = (
    providerDefinition !== undefined && Array.isArray(providerDefinition['tunnels']) === true
  ) ? providerDefinition['tunnels'] as MockApi_MockVPNCredentialFields_TunnelDefinitions : [];
  const tunnelDefinition: MockApi_MockVPNCredentialFields_TunnelDefinition = tunnelDefinitions.find(
    (candidate) => candidate['id'] === tunnel,
  );

  return (
    tunnelDefinition !== undefined && Array.isArray(tunnelDefinition['credentialFields']) === true
  ) ? tunnelDefinition['credentialFields'] as MockApi_MockVPNCredentialFields_Returns : [];
};

/**
 * Mock API - Submitted Mock Vpn Credentials.
 *
 * Keeps only non-empty string fields, matching the console and server treatment of an
 * omitted or blank saved credential.
 *
 * @returns {MockApi_SubmittedMockVPNCredentials_Returns}
 *
 * @since 2.0.0
 */
const submittedMockVPNCredentials = (value: MockApi_SubmittedMockVPNCredentials_Value): MockApi_SubmittedMockVPNCredentials_Returns => {
  const credentials: MockApi_SubmittedMockVPNCredentials_Credentials = {};

  if (
    typeof value !== 'object'
    || value === null
    || Array.isArray(value) === true
  ) {
    return credentials;
  }

  for (const entry of Object.entries(value)) {
    const key: MockApi_SubmittedMockVPNCredentials_Key = entry[0];
    const credentialValue: MockApi_SubmittedMockVPNCredentials_CredentialValue = entry[1];

    if (typeof credentialValue === 'string' && credentialValue.trim() !== '') {
      Reflect.set(credentials, key, credentialValue);
    }
  }

  return credentials;
};

/**
 * Mock API - Merged Mock Vpn Credentials.
 *
 * Preserves saved values only while provider and tunnel still match, then overlays
 * every non-empty submitted replacement.
 *
 * @returns {MockApi_MergedMockVPNCredentials_Returns}
 *
 * @since 2.0.0
 */
const mergedMockVPNCredentials = (
  connection: MockApi_MergedMockVPNCredentials_Connection,
  providerId: MockApi_MergedMockVPNCredentials_ProviderId,
  tunnel: MockApi_MergedMockVPNCredentials_Tunnel,
  submittedCredentials: MockApi_MergedMockVPNCredentials_SubmittedCredentials,
): MockApi_MergedMockVPNCredentials_Returns => {
  const savedCredentials: MockApi_MergedMockVPNCredentials_SavedCredentials = vpnCredentialValues.get(connection['id']) ?? {};
  const credentials: MockApi_MergedMockVPNCredentials_Credentials = (
    providerId === connection['providerId'] && tunnel === connection['tunnel']
  ) ? { ...savedCredentials } : {};

  for (const entry of Object.entries(submittedCredentials)) {
    Reflect.set(credentials, entry[0], entry[1]);
  }

  return credentials;
};

/**
 * Mock API - Saved Mock Vpn Credential Keys.
 *
 * Projects configured fields in provider order so mock reads expose stable metadata
 * without returning their values.
 *
 * @returns {MockApi_SavedMockVPNCredentialKeys_Returns}
 *
 * @since 2.0.0
 */
const savedMockVPNCredentialKeys = (
  providerId: MockApi_SavedMockVPNCredentialKeys_ProviderId,
  tunnel: MockApi_SavedMockVPNCredentialKeys_Tunnel,
  credentials: MockApi_SavedMockVPNCredentialKeys_Credentials,
): MockApi_SavedMockVPNCredentialKeys_Returns => {
  return mockVPNCredentialFields(providerId, tunnel)
    .filter((field) => (credentials[field['key']] ?? '') !== '')
    .map((field) => field['key']);
};

/**
 * Mock API - Missing Mock Vpn Credential.
 *
 * Returns the first required provider field that the candidate cannot satisfy.
 * The caller uses its safe label and key in the shared field-error envelope.
 *
 * @returns {MockApi_MissingMockVPNCredential_Returns}
 *
 * @since 2.0.0
 */
const missingMockVPNCredential = (
  providerId: MockApi_MissingMockVPNCredential_ProviderId,
  tunnel: MockApi_MissingMockVPNCredential_Tunnel,
  credentials: MockApi_MissingMockVPNCredential_Credentials,
): MockApi_MissingMockVPNCredential_Returns => mockVPNCredentialFields(providerId, tunnel).find(
  (field) => field['required'] && (credentials[field['key']] ?? '') === '',
);

/**
 * Mock API - Send JSON.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {MockApi_SendJSON_Returns}
 *
 * @since 2.0.0
 */
const sendJSON = (response: MockApi_SendJSON_Response, status: MockApi_SendJSON_Status, body: MockApi_SendJSON_Body): MockApi_SendJSON_Returns => {
  response.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));

  return;
};

/**
 * Mock API - Send Mock Vpn Credential Error.
 *
 * Mirrors the real API's dotted field name and segmented path for a missing sign-in
 * value while keeping the message free of credential contents.
 *
 * @returns {MockApi_SendMockVPNCredentialError_Returns}
 *
 * @since 2.0.0
 */
const sendMockVPNCredentialError = (
  response: MockApi_SendMockVPNCredentialError_Response,
  prefix: MockApi_SendMockVPNCredentialError_Prefix,
  field: MockApi_SendMockVPNCredentialError_Field,
): MockApi_SendMockVPNCredentialError_Returns => {
  const fieldName: MockApi_SendMockVPNCredentialError_FieldName = `${prefix}.${field['key']}`;
  const message: MockApi_SendMockVPNCredentialError_Message = `${field['label']} is required.`;

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

  return;
};

/**
 * Mock API - Vpn Connection Sequence.
 *
 * Produces stable server-shaped identifiers for connections added in the UI.
 * The counter advances only after a successful create request.
 *
 * @since 2.0.0
 */
let vpnConnectionSequence: MockApi_VpnConnectionSequence = vpnConnections.length;

/**
 * Mock API - Token Scopes.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const tokenScopes: MockApi_TokenScopes = [
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
 * @returns {MockApi_Tick_Returns}
 *
 * @since 2.0.0
 */
const tick = (): MockApi_Tick_Returns => {
  sequence += 1;

  for (const torrent of torrents) {
    const downloading: MockApi_Tick_Downloading = (
      torrent['status'] === 4
      && torrent['error'] === 0
      && torrent['isStalled'] === false
    );
    const seeding: MockApi_Tick_Seeding = torrent['status'] === 6;

    torrent.rateDownload = (downloading === true) ? Math.round((1.5 + (Math.random() * 9)) * 1024 * 1024) : 0;
    torrent.rateUpload = (downloading === true || seeding === true) ? Math.round(Math.random() * 1.8 * 1024 * 1024) : 0;
    torrent.peersSendingToUs = (downloading === true) ? 8 + Math.floor(Math.random() * 30) : 0;
    torrent.peersGettingFromUs = (torrent['rateUpload'] > 0) ? 1 + Math.floor(Math.random() * 6) : 0;
    torrent.peersConnected = torrent['peersSendingToUs'] + torrent['peersGettingFromUs'];

    if (downloading === true) {
      const step: MockApi_Tick_Step = Math.min(torrent['leftUntilDone'], torrent['rateDownload'] * 2);

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

  return;
};

/**
 * Mock API - Torrent Summary Fields.
 *
 * Mirrors the exact field inventory requested by the control API for lists and
 * live snapshots. Detail-only fixture fields stay private until the detail route.
 *
 * @since 2.0.0
 */
const torrentSummaryFields: MockApi_TorrentSummaryFields = [
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
 * Mock API - Torrent Summary.
 *
 * Projects one stateful mock row into the public summary contract.
 * The projection prevents detail-only fields from leaking into list events.
 *
 * @returns {MockApi_TorrentSummary_Returns}
 *
 * @since 2.0.0
 */
const torrentSummary = (torrent: MockApi_TorrentSummary_Torrent): MockApi_TorrentSummary_Returns => Object.fromEntries(
  torrentSummaryFields.map((field): MockApi_TorrentSummary_Entry => [
    field,
    torrent[field],
  ]),
);

/**
 * Mock API - Preview Torrent Link.
 *
 * Supplies deterministic metainfo-like names without making network requests.
 * The Arch release fixture reproduces the directory-style URL that prompted the
 * protected preview workflow.
 *
 * @returns {MockApi_PreviewTorrentLink_Returns}
 *
 * @since 2.0.0
 */
const previewTorrentLink = (link: MockApi_PreviewTorrentLink_Link, index: MockApi_PreviewTorrentLink_Index): MockApi_PreviewTorrentLink_Returns => {
  let parsedLink: MockApi_PreviewTorrentLink_ParsedLink = undefined;
  try {
    parsedLink = new URL(link);
  } catch {
    return null;
  }

  if (parsedLink.username !== '' || parsedLink.password !== '') {
    return null;
  }
  if (parsedLink.protocol === 'magnet:') {
    const displayName: MockApi_PreviewTorrentLink_DisplayName = parsedLink.searchParams.get('dn');
    const name: MockApi_PreviewTorrentLink_Name = ((displayName !== null) ? displayName.trim() : undefined) ?? '';
    const exactTopic: MockApi_PreviewTorrentLink_ExactTopic = parsedLink.searchParams.getAll('xt').find(
      (candidate) => new RegExp(magnetInfoHashPattern, 'iu').test(candidate),
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

  let name: MockApi_PreviewTorrentLink_Name = '';
  let totalSize: MockApi_PreviewTorrentLink_TotalSize = 0;
  if (
    parsedLink.hostname === 'archlinux.org'
    && parsedLink.pathname === '/releng/releases/2026.11.01/torrent/'
  ) {
    name = 'archlinux-2026.11.01-x86_64.iso';
    totalSize = Math.round(1.3 * gibibyte);
  } else {
    const pathSegments: MockApi_PreviewTorrentLink_PathSegments = parsedLink.pathname.split('/').filter(Boolean);
    const encodedName: MockApi_PreviewTorrentLink_EncodedName = pathSegments.at(-1) ?? parsedLink.hostname;
    try {
      name = decodeURIComponent(encodedName);
    } catch {
      name = encodedName;
    }
    name = name.replace(new RegExp(torrentExtensionPattern, 'iu'), '');
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
 * Mock API - Default Vpn Connection.
 *
 * Resolves the one slot used by the legacy-compatible snapshot vpn field.
 * Mutating the default only changes flags, so callers always resolve it fresh.
 *
 * @returns {MockApi_DefaultVPNConnection_Returns}
 *
 * @since 2.0.0
 */
const defaultVPNConnection = (): MockApi_DefaultVPNConnection_Returns => vpnConnections.find(
  (connection) => connection['default'],
) ?? vpnConnections[0] as MockApi_DefaultVPNConnection_Returns;

/**
 * Mock API - Is Connection Being Removed.
 *
 * Reports whether a mutation targets the environment-selected removal marker.
 * Nullable default relationships do not name the marked non-default connection.
 *
 * @returns {MockApi_IsConnectionBeingRemoved_Returns}
 *
 * @since 2.0.0
 */
const isConnectionBeingRemoved = (connectionId: MockApi_IsConnectionBeingRemoved_ConnectionId): MockApi_IsConnectionBeingRemoved_Returns => (
  connectionId !== null
  && connectionId !== undefined
  && connectionId === connectionBeingRemovedId
);

/**
 * Mock API - Vpn Protection.
 *
 * Counts enabled connections only and derives the aggregate protection state.
 * This matches the sidebar and mobile chip contract.
 *
 * @returns {MockApi_VpnProtection_Returns}
 *
 * @since 2.0.0
 */
const vpnProtection = (): MockApi_VpnProtection_Returns => {
  const enabled: MockApi_VpnProtection_Enabled = (noVPNConnections === true) ? [] : vpnConnections.filter((connection) => connection['enabled']);
  const protectedCount: MockApi_VpnProtection_ProtectedCount = enabled.filter((connection) => connection['runtime']['state'] === 'protected').length;
  let state: MockApi_VpnProtection_State = 'blocked';
  if (protectedCount === enabled.length && enabled.length > 0) {
    state = 'protected';
  } else if (protectedCount > 0) {
    state = 'partial';
  } else if (enabled.some((connection) => connection['needsSetup']) === true) {
    state = 'setup-required';
  }

  return {
    enabledCount: enabled.length,
    protectedCount,
    state,
  };
};

/**
 * Mock API - Live Vpn Connections.
 *
 * Combines durable identity with runtime and daemon state for event snapshots.
 * The list remains in stable slot order.
 *
 * @returns {MockApi_LiveVPNConnections_Returns}
 *
 * @since 2.0.0
 */
const liveVPNConnections = (): MockApi_LiveVPNConnections_Returns => {
  const connections: MockApi_LiveVPNConnections_Connections = (noVPNConnections === true) ? [] : [...vpnConnections];

  return connections
    .sort((left, right) => left['slot'] - right['slot'])
    .map((connection) => {
      const runtime: MockApi_LiveVPNConnections_Runtime = { ...connection['runtime'] };

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
};

/**
 * Mock API - Vpn Connection Response.
 *
 * Derives the displayed count from the torrent collection inspected during
 * removal, so connection rows and dependency dialogs cannot drift apart.
 *
 * @param {MockApi_VpnConnectionResponse_Connection} connection - Connection.
 *
 * @returns {MockApi_VpnConnectionResponse_Returns}
 *
 * @since 2.0.0
 */
const vpnConnectionResponse = (connection: MockApi_VpnConnectionResponse_Connection): MockApi_VpnConnectionResponse_Returns => ({
  ...connection,
  torrentCount: torrents.filter((torrent) => torrent['connectionId'] === connection['id']).length,
});

/**
 * Mock API - Vpn Connections Response.
 *
 * Returns the stateful list with the capacity facts shown by the console.
 * A fresh object keeps route mutations visible to later requests.
 *
 * @returns {MockApi_VpnConnectionsResponse_Returns}
 *
 * @since 2.0.0
 */
const vpnConnectionsResponse = (): MockApi_VpnConnectionsResponse_Returns => {
  return {
    capacity: {
      cpus: 4,
      limit: 8,
      memoryBytes: (vpnCapacitySource === 'fallback') ? 0 : 4 * gibibyte,
      source: vpnCapacitySource,
      used: (noVPNConnections === true) ? 0 : vpnConnections.length,
    },
    changeRunning: noVPNConnections === false && vpnConnections.some((connection) => connection['changeRunning']),
    connections: (noVPNConnections === true) ? [] : [...vpnConnections]
      .sort((left, right) => left['slot'] - right['slot'])
      .map(vpnConnectionResponse),
  };
};

/**
 * Mock API - Protected Vpn Runtime.
 *
 * Builds controller state from the first selected endpoint after a successful test.
 * This keeps create, update, and reconnect responses consistent.
 *
 * @returns {MockApi_ProtectedVPNRuntime_Returns}
 *
 * @since 2.0.0
 */
const protectedVPNRuntime = (
  providerId: MockApi_ProtectedVPNRuntime_ProviderId,
  tunnel: MockApi_ProtectedVPNRuntime_Tunnel,
  profileIds: MockApi_ProtectedVPNRuntime_ProfileIds,
  endpointStrategy: MockApi_ProtectedVPNRuntime_EndpointStrategy,
  slot: MockApi_ProtectedVPNRuntime_Slot,
): MockApi_ProtectedVPNRuntime_Returns => {
  const profile: MockApi_ProtectedVPNRuntime_Profile = profiles.find(
    (candidate) => candidate['id'] === profileIds[0],
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
    remoteHost: ((profile !== undefined) ? profile['remoteHost'] : undefined) ?? 'vpn.example.com',
    remotePort: ((profile !== undefined) ? profile['remotePort'] : undefined) ?? ((tunnel === 'wireguard') ? 51820 : 1194),
    state: 'protected',
    transitionedAt: new Date().toISOString(),
    tunnel,
  };
};

/**
 * Mock API - Default Vpn Status.
 *
 * Expands the default connection's stored runtime into the controller status
 * embedded by live events.
 *
 * @returns {MockApi_DefaultVPNStatus_Returns}
 *
 * @since 2.0.0
 */
const defaultVPNStatus = (): MockApi_DefaultVPNStatus_Returns => {
  const connection: MockApi_DefaultVPNStatus_Connection = defaultVPNConnection();
  const runtime: MockApi_DefaultVPNStatus_Runtime = { ...connection['runtime'] };

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
 * Mock API - Appliance Status.
 *
 * Matches the authenticated status route and the optional status object in a
 * live snapshot.
 *
 * @returns {MockApi_ApplianceStatus_Returns}
 *
 * @since 2.0.0
 */
const applianceStatus = (): MockApi_ApplianceStatus_Returns => {
  const protection: MockApi_ApplianceStatus_Protection = vpnProtection();

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
        interfaces: ((noVPNConnections === true) ? [] : vpnConnections).filter(
          (connection) => connection['runtime']['state'] === 'protected',
        ).map((connection) => ({
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
 * Mock API - Torrent Errors.
 *
 * Emits one stable duplicate code even though both rows remain in the list.
 * Normal fixtures return an empty error collection.
 *
 * @returns {MockApi_TorrentErrors_Returns}
 *
 * @since 2.0.0
 */
const torrentErrors = (): MockApi_TorrentErrors_Returns => {
  if (duplicateTorrentEnabled === false || torrents[0] === undefined) {
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
 * @returns {MockApi_Snapshot_Returns}
 *
 * @since 2.0.0
 */
const snapshot = (): MockApi_Snapshot_Returns => {
  const downloadSpeed: MockApi_Snapshot_DownloadSpeed = torrents.reduce((total, torrent) => total + torrent['rateDownload'], 0);
  const uploadSpeed: MockApi_Snapshot_UploadSpeed = torrents.reduce((total, torrent) => total + torrent['rateUpload'], 0);
  const activeTorrentCount: MockApi_Snapshot_ActiveTorrentCount = torrents.filter((torrent) => torrent['rateDownload'] > 0 || torrent['rateUpload'] > 0).length;

  const protection: MockApi_Snapshot_Protection = vpnProtection();

  return {
    sequence,
    capturedAt: new Date().toISOString(),
    status: applianceStatus(),
    connections: liveVPNConnections(),
    protection,
    ...((noVPNConnections === true) ? {} : { vpn: defaultVPNStatus() }),
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
      'pausedTorrentCount': torrents.filter((torrent) => torrent['status'] === 0).length,
      'torrentCount': torrents.length,
      uploadSpeed,
    },
    torrents: torrents.map(torrentSummary),
    organizationRevision,
    errors: torrentErrors(),
  };
};

/**
 * Mock API - Send Error.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {MockApi_SendError_Returns}
 *
 * @since 2.0.0
 */
const sendError = (
  response: MockApi_SendError_Response,
  status: MockApi_SendError_Status,
  code: MockApi_SendError_Code,
  message: MockApi_SendError_Message,
  details?: MockApi_SendError_Details,
): MockApi_SendError_Returns => {
  sendJSON(response, status, {
    error: {
      code,
      message,
      ...((details === undefined) ? {} : { details }),
    },
  });

  return;
};

/**
 * Mock API - Send Connection Being Removed.
 *
 * Reuses the backend's status, code, and intentionally generic message.
 * The console supplies the visible connection name at the mutation surface.
 *
 * @returns {MockApi_SendConnectionBeingRemoved_Returns}
 *
 * @since 2.0.0
 */
const sendConnectionBeingRemoved = (response: MockApi_SendConnectionBeingRemoved_Response): MockApi_SendConnectionBeingRemoved_Returns => {
  sendError(response, 409, 'connection_being_removed', 'The selected VPN connection is being removed.');

  return;
};

// Reports every field that failed validation, like the control API's invalid_request.

/**
 * Mock API - Send Issues.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @returns {MockApi_SendIssues_Returns}
 *
 * @since 2.0.0
 */
const sendIssues = (response: MockApi_SendIssues_Response, issues: MockApi_SendIssues_Issues): MockApi_SendIssues_Returns => {
  const firstIssue: MockApi_SendIssues_FirstIssue = issues[0];

  sendJSON(response, 422, {
    error: {
      code: 'invalid_request',
      message: ((firstIssue !== undefined) ? firstIssue['message'] : undefined) ?? 'Check the highlighted fields.',
      issues: issues.map((issue) => ({
        field: issue['field'],
        path: [issue['field']],
        message: issue['message'],
      })),
    },
  });

  return;
};

/**
 * Mock API - Password Issue.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {MockApi_PasswordIssue_Returns}
 *
 * @since 2.0.0
 */
const passwordIssue = (password: MockApi_PasswordIssue_Password): MockApi_PasswordIssue_Returns => {
  if (password.length < 12) {
    return 'Use at least 12 characters.';
  }

  return (password.length > 1024) ? 'Use 1024 characters or fewer.' : '';
};

/**
 * Mock API - Username Issue.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {MockApi_UsernameIssue_Returns}
 *
 * @since 2.0.0
 */
const usernameIssue = (username: MockApi_UsernameIssue_Username): MockApi_UsernameIssue_Returns => {
  if (username === '') {
    return 'Enter a username.';
  }

  return (new RegExp(administratorUsernamePattern, 'u').test(username) === true) ? '' : 'Use 3 to 64 letters, numbers, periods, underscores, or hyphens, starting with a letter or number.';
};

/**
 * Mock API - Remote Username Issue.
 *
 * Validates the broader username contract shared by the RPC and web proxies.
 * Returns an empty string when the candidate is valid.
 *
 * @returns {MockApi_RemoteUsernameIssue_Returns}
 *
 * @since 2.0.0
 */
const remoteUsernameIssue = (username: MockApi_RemoteUsernameIssue_Username): MockApi_RemoteUsernameIssue_Returns => {
  if (username === '') {
    return 'Enter a username.';
  }

  return (new RegExp(loginUsernamePattern, 'u').test(username) === true) ? '' : 'Use 1 to 64 letters, numbers, periods, underscores, or hyphens.';
};

/**
 * Mock API - Effective Web Proxy Connection ID.
 *
 * Keeps a stored explicit relationship when its connection still exists.
 * Missing and nullable relationships safely resolve through the default.
 *
 * @returns {MockApi_EffectiveWebProxyConnectionId_Returns}
 *
 * @since 2.0.0
 */
const effectiveWebProxyConnectionId = (login: MockApi_EffectiveWebProxyConnectionId_Login): MockApi_EffectiveWebProxyConnectionId_Returns => {
  if (noVPNConnections === true) {
    return '';
  }
  if (login['connectionId'] !== null && vpnConnections.some(
    (connection) => connection['id'] === login['connectionId'],
  ) === true) {
    return login['connectionId'];
  }

  return defaultVPNConnection()['id'];
};

/**
 * Mock API - Web Proxy Response.
 *
 * Combines the desired switch, VPN readiness, and safe login metadata.
 * Every web proxy route uses this canonical response shape.
 *
 * @returns {MockApi_WebProxyResponse_Returns}
 *
 * @since 2.0.0
 */
const webProxyResponse = (): MockApi_WebProxyResponse_Returns => {
  if (noVPNConnections === true) {
    return {
      enabled: false,
      port: 22605,
      state: 'off',
      logins: [],
    };
  }

  const logins: MockApi_WebProxyResponse_Logins = webProxyLogins.map((login) => ({
    ...login,
    effectiveConnectionId: effectiveWebProxyConnectionId(login),
  }));
  let state: MockApi_WebProxyResponse_State = 'off';
  if (webProxyRuntimeEnabled === true) {
    const available: MockApi_WebProxyResponse_Available = logins.some((login) => {
      const effectiveConnection: MockApi_WebProxyResponse_EffectiveConnection = vpnConnections.find(
        (connection) => connection['id'] === login['effectiveConnectionId'],
      );

      return ((effectiveConnection !== undefined) ? effectiveConnection['runtime']['state'] : undefined) === 'protected';
    });
    state = (logins.length === 0 || available === true) ? 'listening' : 'waiting-for-vpn';
  }

  return {
    enabled: webProxyEnabled,
    port: 22605,
    state,
    logins,
  };
};

/**
 * Mock API - Effective Web Proxy Login.
 *
 * Adds the resolved default identifier without changing the stored nullable choice.
 * Mutation responses and list responses share this exact public shape.
 *
 * @returns {MockApi_EffectiveWebProxyLogin_Returns}
 *
 * @since 2.0.0
 */
const effectiveWebProxyLogin = (login: MockApi_EffectiveWebProxyLogin_Login): MockApi_EffectiveWebProxyLogin_Returns => ({
  ...login,
  effectiveConnectionId: effectiveWebProxyConnectionId(login),
});

/**
 * Mock API - Send Field Error.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {MockApi_SendFieldError_Returns}
 *
 * @since 2.0.0
 */
const sendFieldError = (response: MockApi_SendFieldError_Response, code: MockApi_SendFieldError_Code, field: MockApi_SendFieldError_Field, message: MockApi_SendFieldError_Message, status: MockApi_SendFieldError_Status = 422): MockApi_SendFieldError_Returns => {
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

  return;
};

// Marks the mock signed in and answers like the real session response.

/**
 * Mock API - Start Session.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {MockApi_StartSession_Returns}
 *
 * @since 2.0.0
 */
const startSession = (response: MockApi_StartSession_Response): MockApi_StartSession_Returns => {
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

  return;
};

/**
 * Mock API - Read Body.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {MockApi_ReadBody_Returns}
 *
 * @since 2.0.0
 */
const readBody = async (request: MockApi_ReadBody_Request): MockApi_ReadBody_Returns => {
  const chunks: MockApi_ReadBody_Chunks = [];

  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }

  const text: MockApi_ReadBody_Text = Buffer.concat(chunks).toString('utf-8');

  if (text === '') {
    return {};
  }

  return JSON.parse(text);
};

// Checks a token create or edit body with the same rules and words as the control API.
// It answers the request itself and returns undefined when the body can't be used.

/**
 * Mock API - Read Token Fields.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {MockApi_ReadTokenFields_Returns}
 *
 * @since 2.0.0
 */
const readTokenFields = async (request: MockApi_ReadTokenFields_Request, response: MockApi_ReadTokenFields_Response, tokenId: MockApi_ReadTokenFields_TokenId): MockApi_ReadTokenFields_Returns => {
  const body: MockApi_ReadTokenFields_Body = await readBody(request);
  const unknownField: MockApi_ReadTokenFields_UnknownField = Object.keys(body).find((field) => [
    'name',
    'scopes',
    'expiresAt',
  ].includes(field) === false);

  if (unknownField !== undefined) {
    sendIssues(response, [{
      field: unknownField,
      message: 'This field isn\'t accepted.',
    }]);

    return undefined;
  }

  const issues: MockApi_ReadTokenFields_Issues = [];
  const name: MockApi_ReadTokenFields_Name = (typeof body['name'] === 'string') ? body['name'].trim() : '';

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

  const scopes: MockApi_ReadTokenFields_Scopes = (Array.isArray(body['scopes']) === true) ? body['scopes'] : [];

  if (scopes.length === 0) {
    issues.push({
      field: 'scopes',
      message: 'Choose at least one scope.',
    });
  } else if (scopes.some((scope) => typeof scope !== 'string' || tokenScopes.includes(scope) === false) === true) {
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

  const expiresAt: MockApi_ReadTokenFields_ExpiresAt = body['expiresAt'];

  if (expiresAt !== undefined && expiresAt !== null) {
    if (
      typeof expiresAt !== 'string'
      || new RegExp(isoTimestampPattern, 'u').test(expiresAt) === false
      || Number.isNaN(Date.parse(expiresAt)) === true
    ) {
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

  if (tokens.some((token) => token['id'] !== tokenId && String(token['name']).toLowerCase() === name.toLowerCase()) === true) {
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
 * Mock API - Read I Ds.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {MockApi_ReadIDs_Returns}
 *
 * @since 2.0.0
 */
const readIDs = (body: MockApi_ReadIDs_Body): MockApi_ReadIDs_Returns => {
  const ids: MockApi_ReadIDs_Ids = body['ids'];

  return (Array.isArray(ids) === true) ? ids.filter((id): id is MockApi_ReadIDs_Id => typeof id === 'number') : [];
};

/**
 * Mock API - Mock Content Downloads.
 *
 * Prepared downloads of finished files by the token in their link.
 * They last until the mock restarts.
 *
 * @since 2.2.0
 */
const mockContentDownloads: MockApi_MockContentDownloads = new Map();

/**
 * Mock API - Mock Finished Files.
 *
 * The three files the detail panel lists for a torrent, each holding one line of
 * text, so a zip of them unpacks into the torrent's folder.
 *
 * @returns {MockApi_MockFinishedFiles_Returns}
 *
 * @since 2.2.0
 */
const mockFinishedFiles = (torrent: MockApi_MockFinishedFiles_Torrent): MockApi_MockFinishedFiles_Returns => [
  'main.bin',
  'extras.zip',
  'README.txt',
].map((fileName) => ({
  content: Buffer.from(`Mock contents of ${torrent['name']}/${fileName}\n`, 'utf8'),
  name: `${torrent['name']}/${fileName}`,
}));

/**
 * Mock API - Mock Torrent File.
 *
 * Builds a small bencoded metainfo file from one mock torrent's name and size.
 * The pieces are zeros, since it only has to look like a .torrent once downloaded.
 *
 * @returns {MockApi_MockTorrentFile_Returns}
 *
 * @since 2.2.0
 */
const mockTorrentFile = (torrent: MockApi_MockTorrentFile_Torrent): MockApi_MockTorrentFile_Returns => {
  const name: MockApi_MockTorrentFile_Name = Buffer.from(torrent['name'], 'utf8');
  const announce: MockApi_MockTorrentFile_Announce = 'https://tracker.example.com/announce';

  return Buffer.concat([
    Buffer.from(`d8:announce${announce.length}:${announce}4:infod6:lengthi${torrent['totalSize']}e4:name${name.length}:`),
    name,
    Buffer.from('12:piece lengthi262144e6:pieces20:'),
    Buffer.alloc(20),
    Buffer.from('ee'),
  ]);
};

/**
 * Mock API - Torrent Download Name.
 *
 * Matches the control API: path separators and characters Windows forbids become
 * underscores, control characters are dropped, and an empty name uses the hash.
 *
 * @returns {MockApi_TorrentDownloadName_Returns}
 *
 * @since 2.2.0
 */
const torrentDownloadName = (torrent: MockApi_TorrentDownloadName_Torrent): MockApi_TorrentDownloadName_Returns => {
  const cleaned: MockApi_TorrentDownloadName_Cleaned = [...torrent['name']]
    .filter((character) => character >= ' ' && character !== '\u007f')
    .map((character) => (('/\\:*?"<>|'.includes(character) === true) ? '_' : character))
    .join('')
    .replace(new RegExp(edgeSpacesAndDotsPattern, 'gu'), '');
  const fileStem: MockApi_TorrentDownloadName_FileStem = (cleaned === '') ? torrent['hashString'] : cleaned;

  return `${fileStem}.torrent`;
};

/**
 * Mock API - Attachment Disposition.
 *
 * Quotes a plain ASCII file name and encodes any other one as filename*, the two
 * forms Go's mime.FormatMediaType writes for the control API.
 *
 * @returns {MockApi_AttachmentDisposition_Returns}
 *
 * @since 2.2.0
 */
const attachmentDisposition = (fileName: MockApi_AttachmentDisposition_FileName): MockApi_AttachmentDisposition_Returns => {
  if (new RegExp(printableAsciiPattern, 'u').test(fileName) === true) {
    return `attachment; filename="${fileName.replace(new RegExp(headerQuoteCharactersPattern, 'gu'), '\\$&')}"`;
  }

  return `attachment; filename*=utf-8''${encodeURIComponent(fileName)}`;
};

/**
 * Mock API - Stored Zip.
 *
 * Writes files into one zip without compression and with UTF-8 names, like the
 * control API's torrent file download. Repeated names get " (2)", " (3)", and so on.
 *
 * @returns {MockApi_StoredZip_Returns}
 *
 * @since 2.2.0
 */
const storedZip = (files: MockApi_StoredZip_Files): MockApi_StoredZip_Returns => {
  const localFileSignature: MockApi_StoredZip_LocalFileSignature = parseInt('04034b50', 16);
  const centralFileSignature: MockApi_StoredZip_CentralFileSignature = parseInt('02014b50', 16);
  const endSignature: MockApi_StoredZip_EndSignature = parseInt('06054b50', 16);
  const utf8NamesFlag: MockApi_StoredZip_Utf8NamesFlag = parseInt('0800', 16);
  const firstDosDate: MockApi_StoredZip_FirstDosDate = parseInt('21', 16);
  const localParts: MockApi_StoredZip_LocalParts = [];
  const centralParts: MockApi_StoredZip_CentralParts = [];
  const usedNames: MockApi_StoredZip_UsedNames = new Set();
  let offset: MockApi_StoredZip_Offset = 0;

  for (const file of files) {
    const extensionMatch: MockApi_StoredZip_ExtensionMatch = new RegExp(fileExtensionPattern, 'u').exec(file['name']);
    const extension: MockApi_StoredZip_Extension = ((extensionMatch !== null) ? extensionMatch[0] : undefined) ?? '';
    const baseName: MockApi_StoredZip_BaseName = file['name'].slice(0, file['name'].length - extension.length);
    let entryName: MockApi_StoredZip_EntryName = file['name'];

    for (let number = 2; usedNames.has(entryName.toLowerCase()) === true; number += 1) {
      entryName = `${baseName} (${number})${extension}`;
    }
    usedNames.add(entryName.toLowerCase());

    const nameBytes: MockApi_StoredZip_NameBytes = Buffer.from(entryName, 'utf8');
    const checksum: MockApi_StoredZip_Checksum = crc32(file['content']);
    const local: MockApi_StoredZip_Local = Buffer.alloc(30);

    local.writeUInt32LE(localFileSignature, 0);

    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(utf8NamesFlag, 6);
    local.writeUInt16LE(firstDosDate, 12);

    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(file['content'].length, 18);
    local.writeUInt32LE(file['content'].length, 22);

    local.writeUInt16LE(nameBytes.length, 26);

    localParts.push(local, nameBytes, file['content']);

    const central: MockApi_StoredZip_Central = Buffer.alloc(46);

    central.writeUInt32LE(centralFileSignature, 0);

    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(utf8NamesFlag, 8);
    central.writeUInt16LE(firstDosDate, 14);

    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(file['content'].length, 20);
    central.writeUInt32LE(file['content'].length, 24);

    central.writeUInt16LE(nameBytes.length, 28);

    central.writeUInt32LE(offset, 42);

    centralParts.push(central, nameBytes);

    offset += local.length + nameBytes.length + file['content'].length;
  }

  const centralSize: MockApi_StoredZip_CentralSize = centralParts.reduce((size, part) => size + part.length, 0);
  const end: MockApi_StoredZip_End = Buffer.alloc(22);

  end.writeUInt32LE(endSignature, 0);

  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);

  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([
    ...localParts,
    ...centralParts,
    end,
  ]);
};

/**
 * Mock API - Read Torrent Selection.
 *
 * Gives a present hash array precedence over facade IDs, just like the Go
 * mutation handlers. Missing hashes return the stable not-found error.
 *
 * @returns {MockApi_ReadTorrentSelection_Returns}
 *
 * @since 2.0.0
 */
const readTorrentSelection = (
  body: MockApi_ReadTorrentSelection_Body,
  response: MockApi_ReadTorrentSelection_Response,
): MockApi_ReadTorrentSelection_Returns => {
  if (process.env['MOCK_DAEMON_UNAVAILABLE'] === 'true') {
    const starting: MockApi_ReadTorrentSelection_Starting = process.env['MOCK_DAEMON_STARTING'] === 'true';

    sendError(
      response,
      503,
      'daemon_unavailable',
      (starting === true) ? 'Northwind Toronto\'s Transmission is still starting.' : 'Transmission is unavailable for the selected connection.',
    );

    return undefined;
  }
  if (process.env['MOCK_TORRENT_NOT_FOUND'] === 'true') {
    sendError(response, 404, 'torrent_not_found', 'One or more torrents were not found.');

    return undefined;
  }

  if (Array.isArray(body['hashes']) === true) {
    const requestedHashes: MockApi_ReadTorrentSelection_RequestedHashes = body['hashes'];
    const hexadecimalCharacters: MockApi_ReadTorrentSelection_HexadecimalCharacters = '0123456789abcdefABCDEF';
    const valid: MockApi_ReadTorrentSelection_Valid = requestedHashes.length >= 1
      && requestedHashes.length <= 1000
      && requestedHashes.every((hash) => (
        typeof hash === 'string'
        && (
          hash.length === 40
          || hash.length === 64
        )
        && [...hash].every((character) => hexadecimalCharacters.includes(character))
      ));
    const hashes: MockApi_ReadTorrentSelection_Hashes = requestedHashes.map(String).map((hash) => hash.toLowerCase());
    if (valid === false || new Set(hashes).size !== hashes.length) {
      sendFieldError(response, 'torrent_selection_invalid', 'hashes', 'Torrent hashes must be unique 40 or 64 character hexadecimal values.');

      return undefined;
    }
    if (hashes.some((hash) => torrents.some(
      (torrent) => torrent['hashString'].toLowerCase() === hash,
    ) === false) === true) {
      sendError(response, 404, 'torrent_not_found', 'One or more torrents were not found.');

      return undefined;
    }
    const items: MockApi_ReadTorrentSelection_Items = torrents.filter(
      (torrent) => hashes.includes(torrent['hashString'].toLowerCase()),
    );

    return {
      field: 'hashes',
      hashes,
      ids: items.map((torrent) => torrent['id']),
      items,
    };
  }

  const ids: MockApi_ReadTorrentSelection_Ids = readIDs(body);
  if (
    ids.length < 1
    || ids.length > 1000
    || new Set(ids).size !== ids.length
  ) {
    sendFieldError(response, 'torrent_selection_invalid', 'ids', 'Select between 1 and 1,000 torrents without duplicates.');

    return undefined;
  }
  const items: MockApi_ReadTorrentSelection_Items = torrents.filter((torrent) => ids.includes(torrent['id']));
  if (items.length !== ids.length) {
    sendError(response, 404, 'torrent_not_found', 'One or more torrents were not found.');

    return undefined;
  }

  return {
    field: 'ids',
    hashes: items.map((torrent) => torrent['hashString']),
    ids,
    items,
  };
};

/**
 * Mock API - Torrent Mutation Response.
 *
 * Mirrors the backend's selection-key echo without exposing both identifier
 * systems in one response.
 *
 * @returns {MockApi_TorrentMutationResponse_Returns}
 *
 * @since 2.0.0
 */
const torrentMutationResponse = (selection: MockApi_TorrentMutationResponse_Selection): MockApi_TorrentMutationResponse_Returns => (
  (selection['field'] === 'hashes') ? { hashes: selection['hashes'] } : { ids: selection['ids'] }
);

/**
 * Mock API - Read Torrent Profile.
 *
 * Converts one already client-validated profile body into durable mock state.
 * Existing identity and creation metadata are supplied by the route handler.
 *
 * @returns {MockApi_ReadTorrentProfile_Returns}
 *
 * @since 2.0.0
 */
const readTorrentProfile = (
  body: MockApi_ReadTorrentProfile_Body,
  id: MockApi_ReadTorrentProfile_Id,
  createdAt: MockApi_ReadTorrentProfile_CreatedAt,
): MockApi_ReadTorrentProfile_Returns => {
  const options: MockApi_ReadTorrentProfile_Options = (typeof body['options'] === 'object' && body['options'] !== null) ? body['options'] as MockApi_ReadTorrentProfile_Options : {};
  const seeding: MockApi_ReadTorrentProfile_Seeding = (typeof options['seeding'] === 'object' && options['seeding'] !== null) ? options['seeding'] as MockApi_ReadTorrentProfile_Seeding : {};
  const updatedAt: MockApi_ReadTorrentProfile_UpdatedAt = new Date().toISOString();

  return {
    connectionId: (typeof body['connectionId'] === 'string') ? body['connectionId'] : null,
    createdAt,
    downloadDirectory: String(body['downloadDirectory'] ?? '/data'),
    id,
    labels: (Array.isArray(body['labels']) === true) ? body['labels'].map(String) : [],
    matchPatterns: (Array.isArray(body['matchPatterns']) === true) ? body['matchPatterns'].map(String) : [],
    name: String(body['name'] ?? '').trim(),
    overlaps: [],
    options: {
      bandwidthPriority: Number(options['bandwidthPriority'] ?? 0) as MockApi_ReadTorrentProfile_BandwidthPriority,
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
 * Mock API - Read Default Torrent Profile.
 *
 * Reuses named-profile option normalization while omitting fields the Default
 * editor cannot change.
 *
 * @returns {MockApi_ReadDefaultTorrentProfile_Returns}
 *
 * @since 2.0.0
 */
const readDefaultTorrentProfile = (body: MockApi_ReadDefaultTorrentProfile_Body): MockApi_ReadDefaultTorrentProfile_Returns => {
  const normalizedProfile: MockApi_ReadDefaultTorrentProfile_NormalizedProfile = readTorrentProfile(
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
 * Mock API - Apply Action.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {MockApi_ApplyAction_Returns}
 *
 * @since 2.0.0
 */
const applyAction = (action: MockApi_ApplyAction_Action, ids: MockApi_ApplyAction_Ids): MockApi_ApplyAction_Returns => {
  for (const torrent of torrents) {
    if (ids.includes(torrent['id']) === false) {
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

  return;
};

/**
 * Mock API - Added Torrent Name.
 *
 * Derives a useful name from magnet display names and remote URL paths.
 * Metainfo bytes have no filename in the request, so they use a stable fallback.
 *
 * @returns {MockApi_AddedTorrentName_Returns}
 *
 * @since 2.0.0
 */
const addedTorrentName = (filename: MockApi_AddedTorrentName_Filename, fallbackId: MockApi_AddedTorrentName_FallbackId): MockApi_AddedTorrentName_Returns => {
  if (typeof filename !== 'string') {
    return `Added torrent ${fallbackId}`;
  }

  try {
    const sourceURL: MockApi_AddedTorrentName_SourceURL = new URL(filename);
    if (sourceURL.protocol === 'magnet:') {
      return sourceURL.searchParams.get('dn') ?? `Magnet torrent ${fallbackId}`;
    }
    const lastSegment: MockApi_AddedTorrentName_LastSegment = sourceURL.pathname.split('/').filter(Boolean).at(-1) ?? `Remote torrent ${fallbackId}`;

    return decodeURIComponent(lastSegment).replace(new RegExp(torrentExtensionPattern, 'iu'), '');
  } catch {
    return `Added torrent ${fallbackId}`;
  }
};

/**
 * Mock API - Backup Grants.
 *
 * Models purpose-bound, short-lived and single-use confirmation grants in memory.
 * The mock stores only opaque values and never stores submitted passwords or codes.
 *
 * @since 2.0.0
 */
const backupGrants: MockApi_BackupGrants = new Map();

/**
 * Mock API - Backup Import Job.
 *
 * Retains the active simulated job while Vite remains running.
 * Poll responses derive progress from its original start time.
 *
 * @since 2.0.0
 */
let backupImportJob: MockApi_BackupImportJob = null;

/**
 * Mock API - Maximum Backup Notification Destinations.
 *
 * Mirrors the control API cap used when an import adds destinations.
 * Replacements remain available when the list is full.
 *
 * @since 2.0.0
 */
const maximumBackupNotificationDestinations: MockApi_MaximumBackupNotificationDestinations = 256;

/**
 * Mock API - Maximum Backup Rpc Logins.
 *
 * Mirrors the control API cap used when an import adds compatible-client logins.
 * Replacements remain available when the list is full.
 *
 * @since 2.0.0
 */
const maximumBackupRPCLogins: MockApi_MaximumBackupRPCLogins = 256;

/**
 * Mock API - Maximum Backup API Tokens.
 *
 * Mirrors the control API cap used after duplicate imported tokens are skipped.
 * Existing and duplicate token records never consume new capacity.
 *
 * @since 2.0.0
 */
const maximumBackupAPITokens: MockApi_MaximumBackupAPITokens = 256;

/**
 * Mock API - Issue Mock Backup Grant.
 *
 * Creates the same five-minute confirmation window exposed by the control API.
 * A matching export or import request removes the grant on first use.
 *
 * @param {MockApi_IssueMockBackupGrant_Purpose} purpose - Purpose.
 *
 * @returns {MockApi_IssueMockBackupGrant_Returns}
 *
 * @since 2.0.0
 */
const issueMockBackupGrant = (purpose: MockApi_IssueMockBackupGrant_Purpose): MockApi_IssueMockBackupGrant_Returns => {
  const grant: MockApi_IssueMockBackupGrant_Grant = randomBytes(24).toString('base64url');
  const expiresAt: MockApi_IssueMockBackupGrant_ExpiresAt = Date.now() + (5 * 60 * 1000);

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
 * Mock API - Consume Mock Backup Grant.
 *
 * Accepts only an unexpired grant issued for the requested sensitive operation.
 * Successful validation deletes it before the operation begins.
 *
 * @param {MockApi_ConsumeMockBackupGrant_Value}   value   - Value.
 * @param {MockApi_ConsumeMockBackupGrant_Purpose} purpose - Purpose.
 *
 * @returns {MockApi_ConsumeMockBackupGrant_Returns}
 *
 * @since 2.0.0
 */
const consumeMockBackupGrant = (value: MockApi_ConsumeMockBackupGrant_Value, purpose: MockApi_ConsumeMockBackupGrant_Purpose): MockApi_ConsumeMockBackupGrant_Returns => {
  const grant: MockApi_ConsumeMockBackupGrant_Grant = String(value ?? '');
  const confirmation: MockApi_ConsumeMockBackupGrant_Confirmation = backupGrants.get(grant);
  if (
    confirmation === undefined
    || confirmation['purpose'] !== purpose
    || confirmation['expiresAt'] <= Date.now()
  ) {
    return false;
  }
  backupGrants.delete(grant);

  return true;
};

/**
 * Mock API - Mock Backup Metainfo.
 *
 * Builds one valid single-file torrent and computes the hash over its info dictionary.
 * Mock exports can therefore be accepted by the real strict Go importer too.
 *
 * @returns {MockApi_MockBackupMetainfo_Returns}
 *
 * @since 2.0.0
 */
const mockBackupMetainfo = (): MockApi_MockBackupMetainfo_Returns => {
  const info: MockApi_MockBackupMetainfo_Info = Buffer.concat([
    Buffer.from('d6:lengthi3994028672e4:name29:debian-13.1.0-amd64-DVD-1.iso12:piece lengthi16384e6:pieces20:'),
    Buffer.alloc(20),
    Buffer.from('e'),
  ]);
  const metainfo: MockApi_MockBackupMetainfo_Metainfo = Buffer.concat([
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
 * Mock API - Mock Backup Document.
 *
 * Projects current mock settings into the strict version-one portable contract.
 * Secret fields use obvious mock plaintext while digest-only credentials stay digests.
 *
 * @param {MockApi_MockBackupDocument_Selected} selected - Selected.
 *
 * @returns {MockApi_MockBackupDocument_Returns}
 *
 * @since 2.0.0
 */
const mockBackupDocument = (selected: MockApi_MockBackupDocument_Selected): MockApi_MockBackupDocument_Returns => {
  const document: MockApi_MockBackupDocument_Document = {
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
      profiles: torrentProfiles.map((profile) => ({
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
      settings: settings.slice(0, 8).map((setting) => ({
        key: setting['key'],
        value: setting['value'],
      })),
    });
  }
  if (selected['labels'] === true) {
    Reflect.set(document, 'labels', [...savedLabels]);
  }
  if (selected['notifications'] === true) {
    Reflect.set(document, 'notifications', notifications.map((notification) => ({
      events: [...notification['events']],
      id: notification['id'],
      name: notification['name'],
      secrets: Object.fromEntries(Object.keys(notification['secrets']).map((key): MockApi_MockBackupDocument_SecretEntry => [
        key,
        `mock-${key}-secret`,
      ])),
      service: notification['service'],
      settings: { ...notification['settings'] },
    })));
  }
  if (selected['torrents'] === true) {
    const sourceTorrent: MockApi_MockBackupDocument_SourceTorrent = torrents[0];
    const metainfo: MockApi_MockBackupDocument_Metainfo = mockBackupMetainfo();
    const sourceProfile: MockApi_MockBackupDocument_SourceProfile = torrentProfiles.find(
      (profile) => profile['id'] === ((sourceTorrent !== undefined) ? sourceTorrent['profileId'] : undefined),
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
      profileName: ((sourceProfile !== undefined) ? sourceProfile['name'] : undefined) ?? defaultTorrentProfile['name'],
    }]);
  }
  if (selected['vpnConnections'] === true) {
    const selectedConnections: MockApi_MockBackupDocument_SelectedConnections = vpnConnections.slice(0, 1);
    const selectedProfileIDs: MockApi_MockBackupDocument_SelectedProfileIDs = new Set(selectedConnections.flatMap(
      (connection) => connection['profileIds'],
    ));

    Reflect.set(document, 'vpnConnections', {
      connections: selectedConnections.map((connection) => ({
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
      profiles: profiles.filter((profile) => selectedProfileIDs.has(String(profile['id']))).map(
        (profile) => ({
          city: String(profile['city'] ?? ''),
          configuration: [
            'client',
            `remote ${String(profile['remoteHost'])} ${String(profile['remotePort'])}`,
            '',
          ].join('\n'),
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
      apiTokens: tokens.map((token) => ({
        createdAt: token['createdAt'],
        expiresAt: token['expiresAt'],
        id: token['id'],
        lastUsedAt: token['lastUsedAt'],
        name: token['name'],
        scopes: token['scopes'],
        tokenDigest: tokenDigests.get(String(token['id'])) ?? createHash('sha256').update(String(token['id'])).digest('base64'),
      })),
      rpcLogins: rpcLogins.map((login) => ({
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
 * Mock API - Mock Backup Count Label.
 *
 * Formats one merge count with the same singular and plural wording as the API.
 * Review and progress summaries reuse the returned action sentences unchanged.
 *
 * @param {MockApi_MockBackupCountLabel_Count}    count    - Count.
 * @param {MockApi_MockBackupCountLabel_Singular} singular - Singular.
 * @param {MockApi_MockBackupCountLabel_Plural}   plural   - Plural.
 *
 * @returns {MockApi_MockBackupCountLabel_Returns}
 *
 * @since 2.0.0
 */
const mockBackupCountLabel = (count: MockApi_MockBackupCountLabel_Count, singular: MockApi_MockBackupCountLabel_Singular, plural: MockApi_MockBackupCountLabel_Plural): MockApi_MockBackupCountLabel_Returns => {
  const noun: MockApi_MockBackupCountLabel_Noun = (count === 1) ? singular : plural;

  return `${count} ${noun}`;
};

/**
 * Mock API - Mock Backup Action Lines.
 *
 * Produces the exact merge explanations returned by the control API preview.
 * Zero-count operations stay omitted so the wizard lists only observable changes.
 *
 * @param {MockApi_MockBackupActionLines_Result} result - Result.
 *
 * @returns {MockApi_MockBackupActionLines_Returns}
 *
 * @since 2.0.0
 */
const mockBackupActionLines = (result: MockApi_MockBackupActionLines_Result): MockApi_MockBackupActionLines_Returns => {
  const actions: MockApi_MockBackupActionLines_Actions = [];
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
    const verb: MockApi_MockBackupActionLines_Verb = (result['apiTokenDuplicateSkips'] === 1) ? 'is' : 'are';

    actions.push(`Skip ${mockBackupCountLabel(result['apiTokenDuplicateSkips'], 'API token', 'API tokens')} that ${verb} already here`);
  }
  if (result['apiTokenMaximumSkips'] > 0) {
    actions.push(`Skip ${mockBackupCountLabel(result['apiTokenMaximumSkips'], 'API token', 'API tokens')} because this app allows at most ${maximumBackupAPITokens} API tokens`);
  }

  return actions;
};

/**
 * Mock API - Mock Backup String Map.
 *
 * Keeps only string-valued properties from one imported settings or secrets object.
 * The strict real importer already guarantees this shape before merge planning.
 *
 * @param {MockApi_MockBackupStringMap_Value} value - Value.
 *
 * @returns {MockApi_MockBackupStringMap_Returns}
 *
 * @since 2.0.0
 */
const mockBackupStringMap = (value: MockApi_MockBackupStringMap_Value): MockApi_MockBackupStringMap_Returns => {
  const values: MockApi_MockBackupStringMap_Values = {};
  if (
    typeof value !== 'object'
    || value === null
    || Array.isArray(value) === true
  ) {
    return values;
  }

  for (const entry of Object.entries(value)) {
    const entryValue: MockApi_MockBackupStringMap_EntryValue = entry[1];
    if (typeof entryValue === 'string') {
      Reflect.set(values, entry[0], entryValue);
    }
  }

  return values;
};

/**
 * Mock API - Mock Backup ID Is Used.
 *
 * Lets a replacement retain the identifier of the row it replaces while rejecting
 * collisions with every other retained row.
 *
 * @param {MockApi_MockBackupIDIsUsed_Items}        items        - Items.
 * @param {MockApi_MockBackupIDIsUsed_Id}           id           - Id.
 * @param {MockApi_MockBackupIDIsUsed_AllowedIndex} allowedIndex - Allowed index.
 *
 * @returns {MockApi_MockBackupIDIsUsed_Returns}
 *
 * @since 2.0.0
 */
const mockBackupIDIsUsed = (
  items: MockApi_MockBackupIDIsUsed_Items,
  id: MockApi_MockBackupIDIsUsed_Id,
  allowedIndex: MockApi_MockBackupIDIsUsed_AllowedIndex,
): MockApi_MockBackupIDIsUsed_Returns => items.some((item, index) => (
  index !== allowedIndex && item['id'] === id
));

/**
 * Mock API - Merge Mock Backup Access.
 *
 * Simulates the server merge against copies for preview and commits those copies for
 * import. Unlisted rows therefore remain identical in both modes.
 *
 * @param {MockApi_MergeMockBackupAccess_Document} document - Document.
 * @param {MockApi_MergeMockBackupAccess_Apply}    apply    - Apply.
 *
 * @returns {MockApi_MergeMockBackupAccess_Returns}
 *
 * @since 2.0.0
 */
const mergeMockBackupAccess = (document: MockApi_MergeMockBackupAccess_Document, apply: MockApi_MergeMockBackupAccess_Apply): MockApi_MergeMockBackupAccess_Returns => {
  const mergedNotifications: MockApi_MergeMockBackupAccess_MergedNotifications = notifications.map(
    (notification) => structuredClone(notification),
  );
  const mergedRPCLogins: MockApi_MergeMockBackupAccess_MergedRPCLogins = rpcLogins.map(
    (login) => ({ ...login }),
  );
  const mergedRPCLoginDigests: MockApi_MergeMockBackupAccess_MergedRPCLoginDigests = new Map(rpcLoginDigests);
  const mergedTokens: MockApi_MergeMockBackupAccess_MergedTokens = tokens.map(
    (token) => structuredClone(token),
  );
  const mergedTokenDigests: MockApi_MergeMockBackupAccess_MergedTokenDigests = new Map(tokenDigests);
  const result: MockApi_MergeMockBackupAccess_Result = {
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
  const importedNotifications: MockApi_MergeMockBackupAccess_ImportedNotifications = (Array.isArray(document['notifications']) === true) ? document['notifications'].filter(
    (notification): notification is MockApi_MergeMockBackupAccess_ImportedRecord => typeof notification === 'object' && notification !== null,
  ) : [];

  for (const importedNotification of importedNotifications) {
    const name: MockApi_MergeMockBackupAccess_Name = String(importedNotification['name']);
    const replaceIndex: MockApi_MergeMockBackupAccess_ReplaceIndex = mergedNotifications.findIndex(
      (notification) => notification['name'].toLowerCase() === name.toLowerCase(),
    );
    if (replaceIndex < 0 && mergedNotifications.length >= maximumBackupNotificationDestinations) {
      Reflect.set(result, 'notificationMaximumSkips', result['notificationMaximumSkips'] + 1);

      continue;
    }
    if (replaceIndex >= 0) {
      Reflect.set(result, 'notificationReplacements', result['notificationReplacements'] + 1);
    } else {
      Reflect.set(result, 'notificationAdditions', result['notificationAdditions'] + 1);
    }

    let id: MockApi_MergeMockBackupAccess_Id = String(importedNotification['id']);

    while (mockBackupIDIsUsed(mergedNotifications, id, replaceIndex) === true) {
      id = `ntf-${randomBytes(8).toString('hex')}`;
    }
    const secretValues: MockApi_MergeMockBackupAccess_SecretValues = mockBackupStringMap(importedNotification['secrets']);
    const secretFields: MockApi_MergeMockBackupAccess_SecretFields = {};

    for (const secretKey of Object.keys(secretValues)) {
      Reflect.set(secretFields, secretKey, true);
    }
    const now: MockApi_MergeMockBackupAccess_Now = new Date().toISOString();
    const notification: MockApi_MergeMockBackupAccess_Notification = {
      createdAt: now,
      events: (Array.isArray(importedNotification['events']) === true) ? importedNotification['events'].filter(
        (event): event is MockApi_MergeMockBackupAccess_Event => typeof event === 'string',
      ) : [],
      id,
      lastAttemptAt: null,
      lastError: null,
      lastErrorDetails: null,
      name,
      secrets: secretFields,
      secretsMissing: [],
      service: importedNotification['service'] as MockApi_MergeMockBackupAccess_Service,
      settings: mockBackupStringMap(importedNotification['settings']),
      updatedAt: now,
    };
    if (replaceIndex >= 0) {
      mergedNotifications.splice(replaceIndex, 1, notification);
    } else {
      mergedNotifications.push(notification);
    }
  }

  const remoteAccess: MockApi_MergeMockBackupAccess_RemoteAccess = (
    typeof document['remoteAccess'] === 'object' && document['remoteAccess'] !== null
  ) ? document['remoteAccess'] as MockApi_MergeMockBackupAccess_ImportedRecord : undefined;
  const importedLogins: MockApi_MergeMockBackupAccess_ImportedLogins = (remoteAccess !== undefined && Array.isArray(remoteAccess['rpcLogins']) === true) ? remoteAccess['rpcLogins'].filter(
    (login): login is MockApi_MergeMockBackupAccess_ImportedRecord => typeof login === 'object' && login !== null,
  ) : [];

  for (const importedLogin of importedLogins) {
    const username: MockApi_MergeMockBackupAccess_Username = String(importedLogin['username']);
    const replaceIndex: MockApi_MergeMockBackupAccess_ReplaceIndex = mergedRPCLogins.findIndex(
      (login) => login['username'].toLowerCase() === username.toLowerCase(),
    );
    if (replaceIndex < 0 && mergedRPCLogins.length >= maximumBackupRPCLogins) {
      Reflect.set(result, 'rpcLoginMaximumSkips', result['rpcLoginMaximumSkips'] + 1);

      continue;
    }
    if (replaceIndex >= 0) {
      Reflect.set(result, 'rpcLoginReplacements', result['rpcLoginReplacements'] + 1);
    } else {
      Reflect.set(result, 'rpcLoginAdditions', result['rpcLoginAdditions'] + 1);
    }

    let id: MockApi_MergeMockBackupAccess_Id = String(importedLogin['id']);

    while (mockBackupIDIsUsed(mergedRPCLogins, id, replaceIndex) === true) {
      id = `rpl-${randomBytes(8).toString('hex')}`;
    }
    const login: MockApi_MergeMockBackupAccess_Login = {
      createdAt: String(importedLogin['createdAt']),
      id,
      lastUsedAt: (typeof importedLogin['lastUsedAt'] === 'string') ? importedLogin['lastUsedAt'] : null,
      username,
    };
    if (replaceIndex >= 0) {
      const replacedLogin: MockApi_MergeMockBackupAccess_ReplacedLogin = mergedRPCLogins[replaceIndex];
      if (replacedLogin !== undefined) {
        mergedRPCLoginDigests.delete(replacedLogin['id']);
      }
      mergedRPCLogins.splice(replaceIndex, 1, login);
    } else {
      mergedRPCLogins.push(login);
    }
    mergedRPCLoginDigests.set(id, String(importedLogin['secretDigest']));
  }

  const importedTokens: MockApi_MergeMockBackupAccess_ImportedTokens = (remoteAccess !== undefined && Array.isArray(remoteAccess['apiTokens']) === true) ? remoteAccess['apiTokens'].filter(
    (token): token is MockApi_MergeMockBackupAccess_ImportedRecord => typeof token === 'object' && token !== null,
  ) : [];

  for (const importedToken of importedTokens) {
    const id: MockApi_MergeMockBackupAccess_Id = String(importedToken['id']);
    const name: MockApi_MergeMockBackupAccess_Name = String(importedToken['name']);
    const digest: MockApi_MergeMockBackupAccess_Digest = String(importedToken['tokenDigest']);
    const duplicate: MockApi_MergeMockBackupAccess_Duplicate = mergedTokens.some((token) => (
      String(token['id']) === id
      || String(token['name']).toLowerCase() === name.toLowerCase()
      || mergedTokenDigests.get(String(token['id'])) === digest
    ));
    if (duplicate === true) {
      Reflect.set(result, 'apiTokenDuplicateSkips', result['apiTokenDuplicateSkips'] + 1);

      continue;
    }
    if (mergedTokens.length >= maximumBackupAPITokens) {
      Reflect.set(result, 'apiTokenMaximumSkips', result['apiTokenMaximumSkips'] + 1);

      continue;
    }

    Reflect.set(result, 'apiTokenAdditions', result['apiTokenAdditions'] + 1);

    mergedTokens.push({
      createdAt: importedToken['createdAt'],
      expiresAt: importedToken['expiresAt'],
      id,
      lastUsedAt: importedToken['lastUsedAt'],
      name,
      scopes: (Array.isArray(importedToken['scopes']) === true) ? importedToken['scopes'].filter(
        (scope): scope is MockApi_MergeMockBackupAccess_Scope => typeof scope === 'string',
      ) : [],
    });

    mergedTokenDigests.set(id, digest);
  }

  if (apply === true) {
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
 * Mock API - Mock Backup Preview.
 *
 * Finds missing folders and profile name conflicts against current mock state.
 * The result mirrors the safe projection consumed by the import wizard.
 *
 * @param {MockApi_MockBackupPreview_Document} document - Document.
 *
 * @returns {MockApi_MockBackupPreview_Returns}
 *
 * @since 2.0.0
 */
const mockBackupPreview = (document: MockApi_MockBackupPreview_Document): MockApi_MockBackupPreview_Returns => {
  const settingsAndProfiles: MockApi_MockBackupPreview_SettingsAndProfiles = (
    typeof document['settingsAndProfiles'] === 'object' && document['settingsAndProfiles'] !== null
  ) ? document['settingsAndProfiles'] as MockApi_MockBackupPreview_ImportedRecord : undefined;
  const importedDefault: MockApi_MockBackupPreview_ImportedDefault = (
    settingsAndProfiles !== undefined
    && typeof settingsAndProfiles['defaultProfile'] === 'object'
    && settingsAndProfiles['defaultProfile'] !== null
  ) ? settingsAndProfiles['defaultProfile'] as MockApi_MockBackupPreview_ImportedRecord : undefined;
  const importedProfiles: MockApi_MockBackupPreview_ImportedProfiles = (settingsAndProfiles !== undefined && Array.isArray(settingsAndProfiles['profiles']) === true) ? settingsAndProfiles['profiles'].filter((profile): profile is MockApi_MockBackupPreview_ImportedRecord => typeof profile === 'object' && profile !== null) : [];
  const folderPaths: MockApi_MockBackupPreview_FolderPaths = new Set([
    ...((importedDefault === undefined) ? [] : [String(importedDefault['downloadDirectory'])]),
    ...importedProfiles.map((profile) => String(profile['downloadDirectory'])),
  ]);
  const profilePreview: MockApi_MockBackupPreview_ProfilePreview = [];
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
    const existing: MockApi_MockBackupPreview_Existing = torrentProfiles.find(
      (profile) => profile['name'].toLowerCase() === String(importedProfile['name']).toLowerCase(),
    );

    profilePreview.push({
      default: false,
      existingId: ((existing !== undefined) ? existing['id'] : undefined) ?? null,
      existingName: ((existing !== undefined) ? existing['name'] : undefined) ?? null,
      id: String(importedProfile['id']),
      included: true,
      name: String(importedProfile['name']),
      suggestedAction: 'replace',
    });
  }
  const importedSettings: MockApi_MockBackupPreview_ImportedSettings = (settingsAndProfiles !== undefined && Array.isArray(settingsAndProfiles['settings']) === true) ? settingsAndProfiles['settings'].filter((setting): setting is MockApi_MockBackupPreview_ImportedRecord => typeof setting === 'object' && setting !== null) : [];
  const sectionNames: MockApi_MockBackupPreview_SectionNames = [
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
  const remoteAccess: MockApi_MockBackupPreview_RemoteAccess = (
    typeof document['remoteAccess'] === 'object' && document['remoteAccess'] !== null
  ) ? document['remoteAccess'] as MockApi_MockBackupPreview_ImportedRecord : undefined;

  return {
    actions: mergeMockBackupAccess(document, false),
    appVersion: String(document['appVersion']),
    connections: ((noVPNConnections === true) ? [] : vpnConnections).map((connection) => ({
      default: connection['default'],
      id: connection['id'],
      name: connection['name'],
    })),
    exportedAt: String(document['exportedAt']),
    folders: [...folderPaths].filter((folderPath) => directories.has(folderPath) === false).map(
      (folderPath) => ({
        dataFound: false,
        sourcePath: folderPath,
      }),
    ),
    hasRemoteLogins: (
      (
        remoteAccess !== undefined
        && Array.isArray(remoteAccess['rpcLogins']) === true
        && remoteAccess['rpcLogins'].length > 0
      )
      || (
        remoteAccess !== undefined
        && Array.isArray(remoteAccess['apiTokens']) === true
        && remoteAccess['apiTokens'].length > 0
      )
    ),
    profiles: profilePreview,
    sections: sectionNames.filter((entry) => Object.hasOwn(document, entry[0])).map(
      (entry) => entry[1],
    ),
    settings: importedSettings.map((importedSetting) => {
      const currentSetting: MockApi_MockBackupPreview_CurrentSetting = settings.find(
        (setting) => setting['key'] === importedSetting['key'],
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
    totalSizeBytes: (Array.isArray(document['torrents']) === true) ? document['torrents'].length * 3994028672 : 0,
    torrentCount: (Array.isArray(document['torrents']) === true) ? document['torrents'].length : 0,
  };
};

/**
 * Mock API - Mock Another Transmission Preview.
 *
 * Supplies a generic mounted config with used, incomplete, and empty sibling folders.
 * Every migration screen can be exercised without a Docker bind mount.
 *
 * @param {MockApi_MockAnotherTransmissionPreview_FolderMappings} folderMappings - Folder mappings.
 *
 * @returns {MockApi_MockAnotherTransmissionPreview_Returns}
 *
 * @since 2.0.0
 */
const mockAnotherTransmissionPreview = (folderMappings: MockApi_MockAnotherTransmissionPreview_FolderMappings): MockApi_MockAnotherTransmissionPreview_Returns => {
  const folderFixtures: MockApi_MockAnotherTransmissionPreview_FolderFixtures = [
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
  const folders: MockApi_MockAnotherTransmissionPreview_Folders = folderFixtures.map((fixture) => {
    const mappedPath: MockApi_MockAnotherTransmissionPreview_MappedPath = String(folderMappings[fixture['path']] ?? fixture['path']);
    const found: MockApi_MockAnotherTransmissionPreview_Found = (mappedPath.startsWith('/data/') === true) ? fixture['total'] : 0;
    let dataFoundStatus: MockApi_MockAnotherTransmissionPreview_DataFoundStatus = 'not-found';
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
  const importProfiles: MockApi_MockAnotherTransmissionPreview_ImportProfiles = [
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
    ].map((profile) => ({
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
  const mappedSettings: MockApi_MockAnotherTransmissionPreview_MappedSettings = [
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
  const skippedSettings: MockApi_MockAnotherTransmissionPreview_SkippedSettings = [
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
  ].map((setting) => ({
    fileValue: 'Saved value',
    key: `old.${String(setting[0])}`,
    reason: setting[1],
    title: setting[0],
    willImport: false,
  }));

  return {
    actions: [],
    appVersion: 'Transmission 4',
    connections: (noVPNConnections === true) ? [] : [
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
    dataMissingCount: folders.reduce((missing, folder) => {
      const total: MockApi_MockAnotherTransmissionPreview_Total = (typeof folder['dataTotal'] === 'number') ? folder['dataTotal'] : 0;
      const found: MockApi_MockAnotherTransmissionPreview_Found = (typeof folder['dataFoundCount'] === 'number') ? folder['dataFoundCount'] : 0;

      return missing + total - found;
    }, 0),
    dataFoundBytes: Math.round(1.2 * gibibyte),
    runningTorrentCount: 9,
    torrentCount: 15,
    totalSizeBytes: Math.round(1.2 * gibibyte),
  };
};

/**
 * Mock API - Start Mock Backup Import.
 *
 * Converts imported torrents into a compact source list for changing job responses.
 * Folder mappings are applied before the simulated re-check starts.
 *
 * @param {MockApi_StartMockBackupImport_Document}       document       - Document.
 * @param {MockApi_StartMockBackupImport_FolderMappings} folderMappings - Folder mappings.
 *
 * @returns {MockApi_StartMockBackupImport_Returns}
 *
 * @since 2.0.0
 */
const startMockBackupImport = (
  document: MockApi_StartMockBackupImport_Document,
  folderMappings: MockApi_StartMockBackupImport_FolderMappings,
): MockApi_StartMockBackupImport_Returns => {
  const importedTorrents: MockApi_StartMockBackupImport_ImportedTorrents = (Array.isArray(document['torrents']) === true) ? document['torrents'].filter((torrent): torrent is MockApi_StartMockBackupImport_ImportedRecord => typeof torrent === 'object' && torrent !== null) : [];
  const job: MockApi_StartMockBackupImport_Job = {
    actions: mergeMockBackupAccess(document, true),
    createdAt: new Date().toISOString(),
    id: `imp-${randomBytes(8).toString('hex')}`,
    items: importedTorrents.map((torrent) => {
      const sourceFolder: MockApi_StartMockBackupImport_SourceFolder = String(torrent['downloadDirectory']);
      const hash: MockApi_StartMockBackupImport_Hash = String(torrent['hash']).toLowerCase();

      return {
        complete: Number(torrent['percentDone'] ?? 0) >= 1,
        duplicate: torrents.some((currentTorrent) => currentTorrent['hashString'].toLowerCase() === hash),
        folder: String(folderMappings[sourceFolder] ?? sourceFolder),
        hash,
        missing: false,
        name: String(torrent['name']),
        paused: torrent['paused'] === true,
        profileName: String(torrent['profileName']),
      };
    }),
    profileCount: (typeof document['settingsAndProfiles'] === 'object' && document['settingsAndProfiles'] !== null) ? 1 + ((Array.isArray((document['settingsAndProfiles'] as MockApi_StartMockBackupImport_ImportedRecord)['profiles']) === true) ? ((document['settingsAndProfiles'] as MockApi_StartMockBackupImport_ImportedRecord)['profiles'] as MockApi_StartMockBackupImport_UnknownList).length : 0) : 0,
    settingCount: (
      typeof document['settingsAndProfiles'] === 'object'
      && document['settingsAndProfiles'] !== null
      && Array.isArray((document['settingsAndProfiles'] as MockApi_StartMockBackupImport_ImportedRecord)['settings']) === true
    ) ? ((document['settingsAndProfiles'] as MockApi_StartMockBackupImport_ImportedRecord)['settings'] as MockApi_StartMockBackupImport_UnknownList).length : 0,
    source: 'transmission-vpn-export',
    startedAtMilliseconds: Date.now(),
    totalSizeBytes: importedTorrents.length * 3994028672,
  };
  backupImportJob = job;

  return job;
};

/**
 * Mock API - Start Mock Another Transmission Import.
 *
 * Creates fifteen generic torrents across the fake mounted folders.
 * Early duplicate and missing rows make every progress pill observable.
 *
 * @param {MockApi_StartMockAnotherTransmissionImport_Body} body - Body.
 *
 * @returns {MockApi_StartMockAnotherTransmissionImport_Returns}
 *
 * @since 2.0.0
 */
const startMockAnotherTransmissionImport = (body: MockApi_StartMockAnotherTransmissionImport_Body): MockApi_StartMockAnotherTransmissionImport_Returns => {
  const folderMappings: MockApi_StartMockAnotherTransmissionImport_FolderMappings = (
    typeof body['folderMappings'] === 'object' && body['folderMappings'] !== null
  ) ? body['folderMappings'] as MockApi_StartMockAnotherTransmissionImport_FolderMappings : {};
  const profileNames: MockApi_StartMockAnotherTransmissionImport_ProfileNames = (
    typeof body['profileNames'] === 'object' && body['profileNames'] !== null
  ) ? body['profileNames'] as MockApi_StartMockAnotherTransmissionImport_ProfileNames : {};
  const profileIncluded: MockApi_StartMockAnotherTransmissionImport_ProfileIncluded = (
    typeof body['profileIncluded'] === 'object' && body['profileIncluded'] !== null
  ) ? body['profileIncluded'] as MockApi_StartMockAnotherTransmissionImport_ProfileIncluded : {};
  const sourceItems: MockApi_StartMockAnotherTransmissionImport_SourceItems = [
    ...Array.from({ length: 12 }, (unusedValue, index) => {
      void unusedValue;

      return {
        folder: '/data/downloads/linux-isos',
        name: `Linux image ${index + 1}`,
        profileName: String(profileNames['/data/downloads/linux-isos'] ?? 'Linux isos'),
      };
    }),
    ...Array.from({ length: 3 }, (unusedValue, index) => {
      void unusedValue;

      return {
        folder: '/data/downloads/music',
        name: `Music collection ${index + 1}`,
        profileName: String(profileNames['/data/downloads/music'] ?? 'Music'),
      };
    }),
  ];
  const job: MockApi_StartMockAnotherTransmissionImport_Job = {
    actions: [],
    createdAt: new Date().toISOString(),
    id: `imp-${randomBytes(8).toString('hex')}`,
    items: sourceItems.map((item, index) => ({
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
 * Mock API - Mock Backup Import Response.
 *
 * Advances queued torrents through re-checking to their saved final run state.
 * Duplicate and missing-data outcomes use the same durable state names as the API.
 *
 * @param {MockApi_MockBackupImportResponse_Job} job - Job.
 *
 * @returns {MockApi_MockBackupImportResponse_Returns}
 *
 * @since 2.0.0
 */
const mockBackupImportResponse = (job: MockApi_MockBackupImportResponse_Job): MockApi_MockBackupImportResponse_Returns => {
  const elapsedSeconds: MockApi_MockBackupImportResponse_ElapsedSeconds = Math.max(0, (Date.now() - job['startedAtMilliseconds']) / 1000);
  const secondsPerItem: MockApi_MockBackupImportResponse_SecondsPerItem = 2.5;
  const items: MockApi_MockBackupImportResponse_Items = job['items'].map((item, index) => {
    const itemSeconds: MockApi_MockBackupImportResponse_ItemSeconds = elapsedSeconds - 0.5 - (index * secondsPerItem);
    let state: MockApi_MockBackupImportResponse_State = 'queued';
    let progress: MockApi_MockBackupImportResponse_Progress = 0;
    let detail: MockApi_MockBackupImportResponse_Detail = '';
    if (itemSeconds > 0 && item['duplicate'] === true) {
      state = 'already-added';
      progress = 1;
      detail = 'This torrent is already in the library.';
    } else if (itemSeconds > 1 && item['missing'] === true) {
      state = 'data-missing';
      progress = 1;
      detail = `No data was found in ${item['folder']}.`;
    } else if (itemSeconds >= 2) {
      state = 'downloading';
      if (item['paused'] === true) {
        state = 'paused';
      } else if (item['complete'] === true) {
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
  const completedTorrents: MockApi_MockBackupImportResponse_CompletedTorrents = items.filter(
    (item) => item['state'] !== 'queued' && item['state'] !== 'rechecking',
  ).length;
  const emptyJobComplete: MockApi_MockBackupImportResponse_EmptyJobComplete = job['items'].length === 0 && elapsedSeconds >= 1;
  const complete: MockApi_MockBackupImportResponse_Complete = (
    emptyJobComplete === true
    || (
      job['items'].length > 0
      && completedTorrents === job['items'].length
    )
  );
  let status: MockApi_MockBackupImportResponse_Status = 'running';
  if (complete === true) {
    status = 'completed';
  } else if (elapsedSeconds < 0.5) {
    status = 'queued';
  }
  const now: MockApi_MockBackupImportResponse_Now = new Date().toISOString();

  return {
    completedAt: (complete === true) ? now : null,
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
      alreadyAdded: items.filter((item) => item['state'] === 'already-added').length,
      dataMissing: items.filter((item) => item['state'] === 'data-missing').length,
      imported: items.filter((item) => [
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
 * Mock API - Mock Import Source Directory.
 *
 * Provides a small generic tree for the read-only mounted-folder picker.
 * Virtual system folders are absent just as they are from the real endpoint.
 *
 * @param {MockApi_MockImportSourceDirectory_Path} path - Path.
 *
 * @returns {MockApi_MockImportSourceDirectory_Returns}
 *
 * @since 2.0.0
 */
const mockImportSourceDirectory = (path: MockApi_MockImportSourceDirectory_Path): MockApi_MockImportSourceDirectory_Returns => {
  const tree: MockApi_MockImportSourceDirectory_Tree = {
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
  const children: MockApi_MockImportSourceDirectory_Children = tree[path];
  if (children === undefined) {
    return null;
  }

  return {
    directories: children.map((name) => {
      const childPath: MockApi_MockImportSourceDirectory_ChildPath = (path === '/') ? `/${name}` : `${path}/${name}`;
      const grandchildren: MockApi_MockImportSourceDirectory_Children = tree[childPath];

      return {
        hasSubfolders: (((grandchildren !== undefined) ? grandchildren.length : undefined) ?? 0) > 0,
        name,
        path: childPath,
      };
    }),
    ...((path === '/') ? {} : { parentPath: path.slice(0, path.lastIndexOf('/')) || '/' }),
    path,
  };
};

/**
 * Mock API - Handle Request.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {MockApi_HandleRequest_Returns}
 *
 * @since 2.0.0
 */
const handleRequest = async (request: MockApi_HandleRequest_Request, response: MockApi_HandleRequest_Response): MockApi_HandleRequest_Returns => {
  // The Host header gives the address the page was opened at, like the real server sees it.
  const url: MockApi_HandleRequest_Url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  const path: MockApi_HandleRequest_Path = url.pathname;
  const method: MockApi_HandleRequest_Method = request.method ?? 'GET';

  if (path.startsWith('/api/v1/') === false) {
    return false;
  }

  if (path === '/api/v1/setup/status') {
    sendJSON(response, 200, (setupRequired === true) ? {
      claimRequired: true,
      claimExpiresAt: new Date(setupStartedAt + (30 * 60 * 1000)).toISOString(),
    } : { claimRequired: false });

    return true;
  }

  // Claims work like the real server: any letter case, with or without spaces and dashes.
  if (path === '/api/v1/setup/claim' && method === 'POST') {
    if (setupRequired === false) {
      sendError(response, 409, 'claim_unavailable', 'Setup is already complete. Sign in instead.');

      return true;
    }

    const body: MockApi_HandleRequest_Body = await readBody(request);
    const claimCode: MockApi_HandleRequest_ClaimCode = String(body['claimCode'] ?? '').trim();
    const username: MockApi_HandleRequest_Username = String(body['username'] ?? '').trim();
    const password: MockApi_HandleRequest_Password = String(body['password'] ?? '');
    const issues: MockApi_HandleRequest_Issues = [];

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

    if (claimCode.toUpperCase().replace(new RegExp(separatorsPattern, 'gu'), '') !== 'K7Q2MXR9TDP4W8N') {
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
    const body: MockApi_HandleRequest_Body = await readBody(request);
    const username: MockApi_HandleRequest_Username = String(body['username'] ?? '').trim();
    const password: MockApi_HandleRequest_Password = String(body['password'] ?? '');
    const missing: MockApi_HandleRequest_Missing = [];

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

    if (
      setupRequired === true
      || username.toLowerCase() !== account['username'].toLowerCase()
      || password !== account['password']
    ) {
      sendError(response, 401, 'credentials_invalid', 'The username or password is incorrect.');

      return true;
    }

    if (account['totpEnabled'] === true) {
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
    const body: MockApi_HandleRequest_Body = await readBody(request);
    const code: MockApi_HandleRequest_Code = String(body['code'] ?? '').trim().toUpperCase();
    const recoveryIndex: MockApi_HandleRequest_RecoveryIndex = account['recoveryCodes'].indexOf(code);

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

  if (path === '/api/v1/auth/me' && (request.headers['authorization'] ?? '').startsWith('Bearer ') === true) {
    const tokenId: MockApi_HandleRequest_TokenId = tokenValues.get((request.headers['authorization'] ?? '').slice('Bearer '.length).trim());
    const token: MockApi_HandleRequest_Token = tokens.find((candidate) => candidate['id'] === tokenId);

    if (
      token === undefined
      || (
        typeof token['expiresAt'] === 'string'
        && Date.parse(token['expiresAt']) <= Date.now()
      )
    ) {
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
    if (signedIn === false) {
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

  if (signedIn === false) {
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
    const body: MockApi_HandleRequest_Body = await readBody(request);
    const purpose: MockApi_HandleRequest_BackupPurpose = (body['purpose'] === 'export' || body['purpose'] === 'import') ? body['purpose'] : undefined;
    if (purpose === undefined) {
      sendFieldError(response, 'purpose_invalid', 'purpose', 'Choose export or import.');

      return true;
    }
    if (String(body['password'] ?? '') !== account['password']) {
      sendFieldError(response, 'password_incorrect', 'password', 'That password is incorrect.', 401);

      return true;
    }
    if (account['totpEnabled'] === true && String(body['code'] ?? '').trim() !== '123456') {
      sendFieldError(response, 'code_invalid', 'code', 'That code doesn\'t match. Check the time on your device and try again.', 401);

      return true;
    }
    sendJSON(response, 200, issueMockBackupGrant(purpose));

    return true;
  }

  if (path === '/api/v1/backup/confirmation/passkey/options' && method === 'POST') {
    const body: MockApi_HandleRequest_Body = await readBody(request);
    const purpose: MockApi_HandleRequest_PurposeText = String(body['purpose'] ?? '');
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
    const body: MockApi_HandleRequest_Body = await readBody(request);
    const purpose: MockApi_HandleRequest_BackupPurpose = (body['purpose'] === 'export' || body['purpose'] === 'import') ? body['purpose'] : undefined;
    if (purpose === undefined || body['ceremonyId'] !== `mock-backup-${purpose}`) {
      sendError(response, 401, 'passkey_invalid', 'The passkey confirmation expired. Try again.');

      return true;
    }
    sendJSON(response, 200, issueMockBackupGrant(purpose));

    return true;
  }

  if (path === '/api/v1/backup/export' && method === 'POST') {
    const body: MockApi_HandleRequest_Body = await readBody(request);
    if (consumeMockBackupGrant(body['grant'], 'export') === false) {
      sendError(response, 401, 'backup_confirmation_required', 'Confirm it\'s you again before exporting.');

      return true;
    }
    const selected: MockApi_HandleRequest_Selected = (
      typeof body['sections'] === 'object' && body['sections'] !== null
    ) ? body['sections'] as MockApi_HandleRequest_Selected : {};

    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="transmission-vpn-export-${new Date().toISOString().slice(0, 10)}.json"`,
      'Content-Type': 'application/json',
    }).end(JSON.stringify(mockBackupDocument(selected)));

    return true;
  }

  if (path === '/api/v1/backup/imports/source-directories' && method === 'GET') {
    const directory: MockApi_HandleRequest_SourceDirectory = mockImportSourceDirectory(url.searchParams.get('path') ?? '/');
    if (directory === null) {
      sendFieldError(response, 'source_directory_invalid', 'path', 'That folder cannot be read.');

      return true;
    }
    sendJSON(response, 200, { directory });

    return true;
  }

  if (path === '/api/v1/backup/imports/preview' && method === 'POST') {
    const body: MockApi_HandleRequest_Body = await readBody(request);
    if (body['source'] === 'another-transmission') {
      if (body['configPath'] !== '/import') {
        sendFieldError(response, 'import_source_invalid', 'source', 'No settings.json was found in that folder.');

        return true;
      }
      const folderMappings: MockApi_HandleRequest_FolderMappings = (
        typeof body['folderMappings'] === 'object' && body['folderMappings'] !== null
      ) ? body['folderMappings'] as MockApi_HandleRequest_FolderMappings : {};

      sendJSON(response, 200, { preview: mockAnotherTransmissionPreview(folderMappings) });

      return true;
    }
    const document: MockApi_HandleRequest_Document = (
      typeof body['document'] === 'object' && body['document'] !== null
    ) ? body['document'] as MockApi_HandleRequest_DocumentRecord : undefined;
    if (
      body['source'] !== 'transmission-vpn-export'
      || document === undefined
      || document['format'] !== 'transmission-vpn-export'
      || document['version'] !== 1
    ) {
      sendFieldError(response, 'export_invalid', 'document', 'Choose a valid transmission-vpn version 1 export.');

      return true;
    }
    sendJSON(response, 200, { preview: mockBackupPreview(document) });

    return true;
  }

  if (path === '/api/v1/backup/imports' && method === 'POST') {
    const body: MockApi_HandleRequest_Body = await readBody(request);
    if (body['source'] === 'another-transmission') {
      if (body['configPath'] !== '/import') {
        sendFieldError(response, 'import_source_invalid', 'source', 'No settings.json was found in that folder.');

        return true;
      }
      if (consumeMockBackupGrant(body['grant'], 'import') === false) {
        sendError(response, 401, 'backup_confirmation_required', 'Confirm it\'s you again before importing.');

        return true;
      }
      const job: MockApi_HandleRequest_Job = startMockAnotherTransmissionImport(body);

      sendJSON(response, 202, { job: mockBackupImportResponse(job) });

      return true;
    }
    const document: MockApi_HandleRequest_Document = (
      typeof body['document'] === 'object' && body['document'] !== null
    ) ? body['document'] as MockApi_HandleRequest_DocumentRecord : undefined;
    if (
      body['source'] !== 'transmission-vpn-export'
      || document === undefined
      || document['format'] !== 'transmission-vpn-export'
      || document['version'] !== 1
    ) {
      sendFieldError(response, 'export_invalid', 'document', 'Choose a valid transmission-vpn version 1 export.');

      return true;
    }
    if (consumeMockBackupGrant(body['grant'], 'import') === false) {
      sendError(response, 401, 'backup_confirmation_required', 'Confirm it\'s you again before importing.');

      return true;
    }
    const folderMappings: MockApi_HandleRequest_FolderMappings = (
      typeof body['folderMappings'] === 'object' && body['folderMappings'] !== null
    ) ? body['folderMappings'] as MockApi_HandleRequest_FolderMappings : {};
    const job: MockApi_HandleRequest_Job = startMockBackupImport(document, folderMappings);

    sendJSON(response, 202, { job: mockBackupImportResponse(job) });

    return true;
  }

  if (path === '/api/v1/backup/imports/current' && method === 'GET') {
    const job: MockApi_HandleRequest_JobResponse = (backupImportJob === null) ? null : mockBackupImportResponse(backupImportJob);

    sendJSON(response, 200, {
      job: (
        job !== null
        && (
          job['status'] === 'queued'
          || job['status'] === 'running'
        )
      ) ? job : null,
    });

    return true;
  }

  const backupImportMatch: MockApi_HandleRequest_BackupImportMatch = path.match(new RegExp(backupImportPathPattern, 'u'));
  if (backupImportMatch !== null && method === 'GET') {
    if (backupImportJob === null || backupImportJob['id'] !== backupImportMatch[1]) {
      sendError(response, 404, 'backup_import_not_found', 'That import job was not found.');

      return true;
    }
    sendJSON(response, 200, { job: mockBackupImportResponse(backupImportJob) });

    return true;
  }

  if (path === '/api/v1/auth/password' && method === 'POST') {
    const body: MockApi_HandleRequest_Body = await readBody(request);
    const issues: MockApi_HandleRequest_Issues = [];

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
    const body: MockApi_HandleRequest_Body = await readBody(request);
    const username: MockApi_HandleRequest_Username = String(body['username'] ?? '').trim();
    const issues: MockApi_HandleRequest_Issues = [];

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
    const body: MockApi_HandleRequest_Body = await readBody(request);

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

    if (account['totpEnabled'] === true) {
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
    const body: MockApi_HandleRequest_Body = await readBody(request);

    if (new RegExp(sixDigitCodePattern, 'u').test(String(body['code'] ?? '').trim()) === false) {
      sendIssues(response, [{
        field: 'code',
        message: 'Enter the 6-digit code from your app.',
      }]);

      return true;
    }

    if (account['totpSetupPending'] === false) {
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
    removedSecrets = removedSecrets.filter((removedSecret) => removedSecret['kind'] !== 'authenticator');
    sendJSON(response, 200, { recoveryCodes: account['recoveryCodes'].map(formatRecoveryCode) });

    return true;
  }

  if (
    (
      path === '/api/v1/auth/totp/disable'
      || path === '/api/v1/auth/recovery-codes'
    )
    && method === 'POST'
  ) {
    const body: MockApi_HandleRequest_Body = await readBody(request);

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

    if (account['totpEnabled'] === false) {
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
    const body: MockApi_HandleRequest_Body = await readBody(request);
    const name: MockApi_HandleRequest_Name = String(body['name'] ?? '').trim();
    const issues: MockApi_HandleRequest_Issues = [];

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

    const passkey: MockApi_HandleRequest_Passkey = {
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

  if (path.startsWith('/api/v1/auth/passkeys/') === true && method === 'DELETE') {
    const body: MockApi_HandleRequest_Body = await readBody(request);
    const passkeyId: MockApi_HandleRequest_PasskeyId = decodeURIComponent(path.slice('/api/v1/auth/passkeys/'.length));

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

    if (account['passkeys'].some((passkey) => passkey['id'] === passkeyId) === false) {
      sendError(response, 404, 'passkey_not_found', 'That passkey no longer exists.');

      return true;
    }

    account.passkeys = account['passkeys'].filter((passkey) => passkey['id'] !== passkeyId);
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
     * @returns {MockApi_HandleRequest_Send_Returns}
     *
     * @since 2.0.0
     */
    const send: MockApi_HandleRequest_Send = (): MockApi_HandleRequest_Send_Returns => {
      tick();

      response.write([
        'event: snapshot',
        `data: ${JSON.stringify(snapshot())}`,
        '',
        '',
      ].join('\n'));

      return;
    };

    send();

    const timer: MockApi_HandleRequest_Timer = setInterval(send, 2000);

    request.on('close', () => clearInterval(timer));

    return true;
  }

  if (path === '/api/v1/rpc/logins') {
    if (method === 'POST') {
      const body: MockApi_HandleRequest_Body = await readBody(request);
      const username: MockApi_HandleRequest_Username = String(body['username'] ?? '').trim();
      const issue: MockApi_HandleRequest_Issue = remoteUsernameIssue(username);
      if (issue !== '') {
        sendFieldError(response, 'invalid_request', 'username', issue);

        return true;
      }
      if (noVPNConnections === true) {
        sendError(response, 409, 'vpn_connection_required', 'Add a VPN connection before adding a login.');

        return true;
      }
      if (rpcLogins.some((login) => login['username'].toLowerCase() === username.toLowerCase()) === true) {
        sendFieldError(response, 'rpc_login_exists', 'username', 'An RPC login with this username already exists.', 409);

        return true;
      }

      rpcLoginSequence += 1;
      const login: MockApi_HandleRequest_RpcLogin = {
        createdAt: new Date().toISOString(),
        id: `rpl-${rpcLoginSequence.toString(16).padStart(16, '0')}`,
        lastUsedAt: null,
        username,
      };
      const password: MockApi_HandleRequest_GeneratedPassword = `rpc_${randomBytes(18).toString('base64url')}`;

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

  const rpcLoginMatch: MockApi_HandleRequest_RpcLoginMatch = path.match(new RegExp(rpcLoginPathPattern, 'u'));
  if (rpcLoginMatch !== null) {
    const login: MockApi_HandleRequest_FoundRpcLogin = rpcLogins.find(
      (candidate) => candidate['id'] === decodeURIComponent(rpcLoginMatch[1] ?? ''),
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
      const body: MockApi_HandleRequest_Body = await readBody(request);
      if (body['username'] !== undefined) {
        const username: MockApi_HandleRequest_Username = String(body['username']).trim();
        const issue: MockApi_HandleRequest_Issue = remoteUsernameIssue(username);
        if (issue !== '') {
          sendFieldError(response, 'invalid_request', 'username', issue);

          return true;
        }
        if (rpcLogins.some((candidate) => candidate !== login && candidate['username'].toLowerCase() === username.toLowerCase()) === true) {
          sendFieldError(response, 'rpc_login_exists', 'username', 'An RPC login with this username already exists.', 409);

          return true;
        }
        login.username = username;
      }

      const regeneratePassword: MockApi_HandleRequest_RegeneratePassword = body['regeneratePassword'] === true;
      if (body['username'] === undefined && regeneratePassword === false) {
        sendFieldError(response, 'invalid_request', 'regeneratePassword', 'Change the username or regenerate the password.');

        return true;
      }
      const password: MockApi_HandleRequest_OptionalPassword = (regeneratePassword === true) ? `rpc_${randomBytes(18).toString('base64url')}` : undefined;
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
      const body: MockApi_HandleRequest_Body = await readBody(request);
      if (typeof body['enabled'] !== 'boolean') {
        sendFieldError(response, 'invalid_request', 'enabled', 'Choose whether the web proxy is on.');

        return true;
      }
      if (body['enabled'] === true && noVPNConnections === true) {
        sendError(response, 409, 'vpn_connection_required', 'Add a VPN connection before turning on the web proxy.');

        return true;
      }
      const requestedEnabled: MockApi_HandleRequest_RequestedEnabled = body['enabled'];
      webProxyEnabled = requestedEnabled;
      webProxyTransitionSequence += 1;
      const transitionSequence: MockApi_HandleRequest_TransitionSequence = webProxyTransitionSequence;

      setTimeout(() => {
        if (transitionSequence === webProxyTransitionSequence) {
          webProxyRuntimeEnabled = requestedEnabled;
        }

        return;
      }, 2000);
    }

    sendJSON(response, 200, webProxyResponse());

    return true;
  }

  if (path === '/api/v1/web-proxy/logins' && method === 'POST') {
    const body: MockApi_HandleRequest_Body = await readBody(request);
    if (body['password'] !== undefined) {
      sendFieldError(response, 'invalid_request', 'password', 'This field isn\'t accepted.');

      return true;
    }

    const username: MockApi_HandleRequest_Username = String(body['username'] ?? '').trim();
    const issues: MockApi_HandleRequest_Issues = [];
    const usernameMessage: MockApi_HandleRequest_UsernameMessage = remoteUsernameIssue(username);
    if (usernameMessage !== '') {
      issues.push({
        field: 'username',
        message: usernameMessage,
      });
    }
    const requestedConnectionId: MockApi_HandleRequest_RequestedConnectionId = body['connectionId'];
    if (
      requestedConnectionId !== undefined
      && requestedConnectionId !== null
      && (
        typeof requestedConnectionId !== 'string'
        || requestedConnectionId === ''
      )
    ) {
      issues.push({
        field: 'connectionId',
        message: 'Choose an existing VPN connection, or set up a default connection first.',
      });
    }
    if (issues.length > 0) {
      sendIssues(response, issues);

      return true;
    }
    if (typeof requestedConnectionId === 'string' && vpnConnections.some(
      (connection) => connection['id'] === requestedConnectionId,
    ) === false) {
      sendFieldError(
        response,
        'web_proxy_connection_invalid',
        'connectionId',
        'Choose an existing VPN connection, or set up a default connection first.',
      );

      return true;
    }
    if (noVPNConnections === true) {
      sendError(response, 409, 'vpn_connection_required', 'Add a VPN connection before adding a login.');

      return true;
    }
    if (typeof requestedConnectionId === 'string' && isConnectionBeingRemoved(requestedConnectionId) === true) {
      sendConnectionBeingRemoved(response);

      return true;
    }
    if (webProxyLogins.some((login) => login['username'].toLowerCase() === username.toLowerCase()) === true) {
      sendFieldError(response, 'web_proxy_login_exists', 'username', 'A web proxy login with this username already exists.', 409);

      return true;
    }

    webProxyLoginSequence += 1;
    const login: MockApi_HandleRequest_WebProxyLogin = {
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

  const webProxyLoginMatch: MockApi_HandleRequest_WebProxyLoginMatch = path.match(new RegExp(webProxyLoginPathPattern, 'u'));
  if (webProxyLoginMatch !== null) {
    const login: MockApi_HandleRequest_FoundWebProxyLogin = webProxyLogins.find(
      (candidate) => candidate['id'] === decodeURIComponent(webProxyLoginMatch[1] ?? ''),
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
      const body: MockApi_HandleRequest_Body = await readBody(request);
      if (body['password'] !== undefined) {
        sendFieldError(response, 'invalid_request', 'password', 'This field isn\'t accepted.');

        return true;
      }

      const regeneratePassword: MockApi_HandleRequest_RegeneratePassword = body['regeneratePassword'] === true;
      if (body['regeneratePassword'] !== undefined && typeof body['regeneratePassword'] !== 'boolean') {
        sendFieldError(response, 'invalid_request', 'regeneratePassword', 'Choose whether to regenerate the password.');

        return true;
      }
      if (
        body['username'] === undefined
        && body['connectionId'] === undefined
        && regeneratePassword === false
      ) {
        sendFieldError(response, 'invalid_request', 'regeneratePassword', 'Change the username, VPN connection, or regenerate the password.');

        return true;
      }
      if (body['username'] !== undefined) {
        const username: MockApi_HandleRequest_Username = String(body['username']).trim();
        const issue: MockApi_HandleRequest_Issue = remoteUsernameIssue(username);
        if (issue !== '') {
          sendFieldError(response, 'invalid_request', 'username', issue);

          return true;
        }
        if (webProxyLogins.some((candidate) => candidate !== login && candidate['username'].toLowerCase() === username.toLowerCase()) === true) {
          sendFieldError(response, 'web_proxy_login_exists', 'username', 'A web proxy login with this username already exists.', 409);

          return true;
        }
        login.username = username;
      }
      if (
        body['connectionId'] !== undefined
        && body['connectionId'] !== null
        && (
          typeof body['connectionId'] !== 'string'
          || vpnConnections.some((connection) => connection['id'] === body['connectionId']) === false
        )
      ) {
        sendFieldError(
          response,
          'invalid_request',
          'connectionId',
          'Choose an existing VPN connection, or set up a default connection first.',
        );

        return true;
      }
      if (typeof body['connectionId'] === 'string' && isConnectionBeingRemoved(body['connectionId']) === true) {
        sendConnectionBeingRemoved(response);

        return true;
      }
      if (body['connectionId'] !== undefined) {
        login.connectionId = (typeof body['connectionId'] === 'string') ? body['connectionId'] : null;
      }
      sendJSON(response, 200, {
        login: effectiveWebProxyLogin(login),
        ...((regeneratePassword === true) ? { password: `proxy_${randomBytes(18).toString('base64url')}` } : {}),
      });

      return true;
    }
  }

  if (path === '/api/v1/vpn/connections') {
    if (method === 'POST') {
      const body: MockApi_HandleRequest_Body = await readBody(request);
      const name: MockApi_HandleRequest_Name = String(body['name'] ?? '').trim();
      const peerPort: MockApi_HandleRequest_PeerPort = Number(body['peerPort'] ?? (51_413 + vpnConnections.length));
      const profileIds: MockApi_HandleRequest_ProfileIds = (Array.isArray(body['profileIds']) === true) ? body['profileIds'].map(String) : [];
      const providerId: MockApi_HandleRequest_ProviderId = String(body['providerId'] ?? '');
      const tunnel: MockApi_HandleRequest_Tunnel = (body['tunnel'] === 'wireguard') ? 'wireguard' : 'openvpn';
      const credentials: MockApi_HandleRequest_Credentials = submittedMockVPNCredentials(body['credentials']);
      if (vpnConnections.some((connection) => connection['changeRunning']) === true) {
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
      if (vpnConnections.some((connection) => connection['name'].toLowerCase() === name.toLowerCase()) === true) {
        sendError(response, 409, 'name_taken', 'A VPN connection already uses that name.');

        return true;
      }
      if (
        name === ''
        || profileIds.length === 0
        || Number.isInteger(peerPort) === false
        || peerPort < 1024
        || peerPort > 65_535
      ) {
        sendError(response, 422, 'invalid_request', 'Enter a name, endpoint, and valid peer port.');

        return true;
      }
      const missingCredential: MockApi_HandleRequest_MissingCredential = missingMockVPNCredential(
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
      const now: MockApi_HandleRequest_Now = new Date().toISOString();
      const slot: MockApi_HandleRequest_Slot = Math.max(-1, ...vpnConnections.map((connection) => connection['slot'])) + 1;
      const endpointStrategy: MockApi_HandleRequest_EndpointStrategy = (body['endpointStrategy'] === 'ordered' || body['endpointStrategy'] === 'randomized') ? body['endpointStrategy'] : 'sticky';
      const connectionId: MockApi_HandleRequest_ConnectionId = `vpc-${vpnConnectionSequence.toString(16).padStart(16, '0')}`;
      const connection: MockApi_HandleRequest_NewConnection = {
        changeRunning: false,
        createdAt: now,
        daemon: {
          bindAddress: `10.64.${String(slot)}.2`,
          peerPort,
          rpcPort: 9092 + slot,
          state: 'ready',
        },
        default: false,
        dnsServers: (Array.isArray(body['dnsServers']) === true) ? body['dnsServers'].map(String) : [],
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
    const body: MockApi_HandleRequest_Body = await readBody(request);
    if ('moveTorrents' in body && typeof body['moveTorrents'] !== 'boolean') {
      sendFieldError(response, 'invalid_request', 'moveTorrents', 'moveTorrents must be a boolean.');

      return true;
    }
    if (vpnConnections.some((connection) => connection['changeRunning']) === true) {
      sendError(response, 409, 'change_running', 'Another change for this VPN connection is still running.');

      return true;
    }
    const nextDefault: MockApi_HandleRequest_NextDefault = vpnConnections.find(
      (connection) => connection['id'] === body['connectionId'],
    );
    if (nextDefault === undefined) {
      sendError(response, 404, 'connection_not_found', 'That VPN connection no longer exists.');

      return true;
    }
    const previousDefault: MockApi_HandleRequest_PreviousDefault = defaultVPNConnection();
    const followingProfileIDs: MockApi_HandleRequest_FollowingProfileIDs = new Set(torrentProfiles.filter(
      (profile) => profile['connectionId'] === null,
    ).map((profile) => profile['id']));
    const profileTorrents: MockApi_HandleRequest_ProfileTorrents = torrents.filter((torrent) => (
      (
        torrent['profileId'] === null
        || followingProfileIDs.has(torrent['profileId']) === true
      )
      && torrent['connectionId'] !== nextDefault['id']
    ));
    const defaultProfileTorrents: MockApi_HandleRequest_DefaultProfileTorrents = profileTorrents.filter(
      (torrent) => torrent['profileId'] === null,
    ).length;
    const followingProfileTorrents: MockApi_HandleRequest_FollowingProfileTorrents = profileTorrents.length - defaultProfileTorrents;
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
    const moved: MockApi_HandleRequest_Moved = profileTorrents.map(
      (torrent, index) => {
        const failed: MockApi_HandleRequest_Failed = process.env['MOCK_VPN_MOVE_FAILURE'] === 'true' && index === 0;
        if (failed === false) {
          Reflect.set(torrent, 'id', Math.max(0, ...torrents.map((candidate) => candidate['id'])) + 1);
          Reflect.set(torrent, 'connectionId', nextDefault['id']);
        }

        return {
          ...((failed === true) ? { error: 'The mock torrent move failed before its source was changed.' } : {}),
          hash: torrent['hashString'],
          ...((failed === true) ? {} : { id: torrent['id'] }),
          name: torrent['name'],
          result: (failed === true) ? 'failed' : 'moved',
          ...((failed === true || torrentMoveWarnings.length === 0) ? {} : { warnings: torrentMoveWarnings }),
        };
      },
    );

    sendJSON(response, 200, {
      connections: vpnConnectionsResponse()['connections'],
      moved,
    });

    return true;
  }

  const vpnConnectionMatch: MockApi_HandleRequest_VpnConnectionMatch = path.match(new RegExp(vpnConnectionPathPattern, 'u'));
  if (vpnConnectionMatch !== null) {
    const connection: MockApi_HandleRequest_Connection = vpnConnections.find(
      (candidate) => candidate['id'] === decodeURIComponent(vpnConnectionMatch[1] ?? ''),
    );
    if (connection === undefined) {
      sendError(response, 404, 'connection_not_found', 'That VPN connection no longer exists.');

      return true;
    }
    const action: MockApi_HandleRequest_Action = vpnConnectionMatch[2];
    const mutatingConnectionRoute: MockApi_HandleRequest_MutatingConnectionRoute = (
      (
        action !== undefined
        && method === 'POST'
      )
      || (
        action === undefined
        && (
          method === 'PUT'
          || method === 'DELETE'
        )
      )
    );
    if (
      mutatingConnectionRoute === true
      && vpnConnections.some((candidate) => candidate['changeRunning'] === true) === true
    ) {
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
      const body: MockApi_HandleRequest_Body = await readBody(request);
      if (Number(body['expectedRevision']) !== connection['revision']) {
        sendError(response, 409, 'revision_conflict', 'The VPN connection changed while it was being edited.');

        return true;
      }
      const name: MockApi_HandleRequest_Name = (body['name'] === undefined) ? connection['name'] : String(body['name']).trim();
      if (vpnConnections.some((candidate) => candidate !== connection && candidate['name'].toLowerCase() === name.toLowerCase()) === true) {
        sendError(response, 409, 'name_taken', 'A VPN connection already uses that name.');

        return true;
      }
      connection.name = name;
      if (body['peerPort'] !== undefined) {
        connection.peerPort = Number(body['peerPort']);
        connection['daemon'].peerPort = connection['peerPort'];
      }
      if (typeof body['configuration'] === 'object' && body['configuration'] !== null) {
        const configuration: MockApi_HandleRequest_Configuration = body['configuration'] as MockApi_HandleRequest_Configuration;
        const profileIds: MockApi_HandleRequest_ProfileIds = (Array.isArray(configuration['profileIds']) === true) ? configuration['profileIds'].map(String) : [];
        const providerId: MockApi_HandleRequest_ProviderId = String(configuration['providerId'] ?? '');
        const tunnel: MockApi_HandleRequest_Tunnel = (configuration['tunnel'] === 'wireguard') ? 'wireguard' : 'openvpn';
        const submittedCredentials: MockApi_HandleRequest_SubmittedCredentials = submittedMockVPNCredentials(configuration['credentials']);
        const credentials: MockApi_HandleRequest_Credentials = mergedMockVPNCredentials(
          connection,
          providerId,
          tunnel,
          submittedCredentials,
        );
        const missingCredential: MockApi_HandleRequest_MissingCredential = missingMockVPNCredential(
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
        const endpointStrategy: MockApi_HandleRequest_EndpointStrategy = (configuration['endpointStrategy'] === 'ordered' || configuration['endpointStrategy'] === 'randomized') ? configuration['endpointStrategy'] : 'sticky';
        connection.providerId = providerId;
        connection.tunnel = tunnel;
        connection.profileIds = profileIds;
        connection.endpointStrategy = endpointStrategy;
        connection.dnsServers = (Array.isArray(configuration['dnsServers']) === true) ? configuration['dnsServers'].map(String) : [];
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
      if (connection['default'] === true) {
        sendError(response, 409, 'default_connection', 'Change the default VPN connection before deleting this one.');

        return true;
      }
      const body: MockApi_HandleRequest_Body = await readBody(request);
      const dependentTorrents: MockApi_HandleRequest_DependentTorrents = torrents.filter((torrent) => torrent['connectionId'] === connection['id']);
      const dependentProfiles: MockApi_HandleRequest_DependentProfiles = torrentProfiles.filter((profile) => profile['connectionId'] === connection['id']);
      const dependentLogins: MockApi_HandleRequest_DependentLogins = webProxyLogins.filter((login) => login['connectionId'] === connection['id']);
      if (
        body['moveTo'] === undefined
        && (
          dependentTorrents.length > 0
          || dependentProfiles.length > 0
          || dependentLogins.length > 0
        )
      ) {
        sendError(response, 409, 'connection_in_use', 'Move the items that use this connection before removing it.', {
          logins: dependentLogins.map((login) => ({
            id: login['id'],
            username: login['username'],
          })),
          profiles: dependentProfiles.map((profile) => ({
            id: profile['id'],
            name: profile['name'],
          })),
          torrents: dependentTorrents.length,
        });

        return true;
      }
      const moveTo: MockApi_HandleRequest_MoveTo = (typeof body['moveTo'] === 'string') ? body['moveTo'] : undefined;
      if (moveTo !== undefined && vpnConnections.some((candidate) => candidate['id'] === moveTo && candidate !== connection) === false) {
        sendError(response, 422, 'invalid_request', 'Choose another VPN connection.');

        return true;
      }
      if (isConnectionBeingRemoved(moveTo) === true) {
        sendConnectionBeingRemoved(response);

        return true;
      }
      const targetConnection: MockApi_HandleRequest_TargetConnection = vpnConnections.find(
        (candidate) => candidate['id'] === moveTo,
      );
      const targetConnectionName: MockApi_HandleRequest_TargetConnectionName = (targetConnection !== undefined) ? targetConnection['name'] : 'the target connection';
      const moved: MockApi_HandleRequest_Moved = dependentTorrents.map((torrent, index) => {
        const failed: MockApi_HandleRequest_Failed = process.env['MOCK_VPN_MOVE_FAILURE'] === 'true' && index === 0;
        if (failed === false && moveTo !== undefined) {
          Reflect.set(torrent, 'id', Math.max(0, ...torrents.map((candidate) => candidate['id'])) + 1);
          Reflect.set(torrent, 'connectionId', moveTo);
        }

        return {
          ...((failed === true) ? { error: `A paused copy is still on ${targetConnectionName}` } : {}),
          hash: torrent['hashString'],
          ...((failed === true) ? {} : { id: torrent['id'] }),
          name: torrent['name'],
          result: (failed === true) ? 'failed' : 'moved',
          ...((failed === true || torrentMoveWarnings.length === 0) ? {} : { warnings: torrentMoveWarnings }),
        };
      });
      if (moved.some((result) => result['result'] === 'failed') === true) {
        sendError(response, 409, 'move_failed', 'Some torrents could not be moved.', { moved });

        return true;
      }
      if (moveTo !== undefined) {
        const moveToConnection: MockApi_HandleRequest_TargetConnection = vpnConnections.find(
          (candidate) => candidate['id'] === moveTo,
        );
        const storedMoveTo: MockApi_HandleRequest_StoredMoveTo = (moveToConnection !== undefined && moveToConnection['default'] === true) ? null : moveTo;

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

  const refreshCatalogMatch: MockApi_HandleRequest_RefreshCatalogMatch = path.match(
    new RegExp(vpnCatalogRefreshPathPattern, 'u'),
  );
  if (refreshCatalogMatch !== null && method === 'POST') {
    const providerId: MockApi_HandleRequest_ProviderId = decodeURIComponent(refreshCatalogMatch[1] ?? '');
    const tunnel: MockApi_HandleRequest_TunnelName = refreshCatalogMatch[2] ?? '';
    const catalogProvider: MockApi_HandleRequest_Setting = providers.find(
      (provider) => provider['id'] === providerId,
    );
    const tunnelDefinition: MockApi_HandleRequest_TunnelDefinition = (catalogProvider !== undefined) ? catalogProvider['tunnels'] : undefined;
    const selectedTunnelDefinition: MockApi_HandleRequest_SelectedTunnelDefinition = (Array.isArray(tunnelDefinition) === true) ? tunnelDefinition.find(
      (candidate: MockApi_HandleRequest_TunnelCandidate): MockApi_HandleRequest_TunnelCandidateMatches => candidate['id'] === tunnel,
    ) : undefined;
    const catalog: MockApi_HandleRequest_Catalog = (selectedTunnelDefinition !== undefined) ? selectedTunnelDefinition['catalog'] : undefined;
    if (typeof catalog !== 'object' || catalog === null) {
      sendError(response, 404, 'catalog_unavailable', 'This VPN provider does not expose a refreshable catalog for this tunnel.');

      return true;
    }
    const refreshedCatalog: MockApi_HandleRequest_RefreshedCatalog = {
      ...catalog as MockApi_HandleRequest_RefreshedCatalog,
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

    const enabledSetting: MockApi_HandleRequest_Setting = settings.find(
      (setting) => setting['key'] === 'transmission.blocklistEnabled',
    );
    const enabled: MockApi_HandleRequest_Enabled = enabledSetting !== undefined && enabledSetting['value'] === true;
    const sourcesSetting: MockApi_HandleRequest_Setting = settings.find(
      (setting) => setting['key'] === 'transmission.blocklistSources',
    );
    const configuredSources: MockApi_HandleRequest_ConfiguredSources = (sourcesSetting !== undefined) ? sourcesSetting['value'] : undefined;
    if (enabled === false) {
      sendError(response, 409, 'blocklists_disabled', 'Turn on blocklists before updating them.');

      return true;
    }
    if (Array.isArray(configuredSources) === false || configuredSources.length === 0) {
      sendError(response, 409, 'blocklist_sources_empty', 'Add a blocklist source before updating.');

      return true;
    }

    const updateRequestedAt: MockApi_HandleRequest_UpdateRequestedAt = new Date().toISOString();
    blocklistStatus = {
      ...blocklistStatus,
      state: 'updating',
    };
    setTimeout(() => {
      const completedAt: MockApi_HandleRequest_CompletedAt = new Date().toISOString();
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

      return;
    }, 750);
    sendJSON(response, 202, { updateRequestedAt });

    return true;
  }

  if (path === '/api/v1/settings') {
    let runtimeApply: MockApi_HandleRequest_RuntimeApply = undefined;
    if (method === 'PUT') {
      const body: MockApi_HandleRequest_Body = await readBody(request);
      const changes: MockApi_HandleRequest_Changes = (typeof body['changes'] === 'object' && body['changes'] !== null) ? body['changes'] as MockApi_HandleRequest_Changes : {};
      if (changes['rpc.compatibilityEnabled'] === true && noVPNConnections === true) {
        sendError(response, 409, 'vpn_connection_required', 'Add a VPN connection before turning on the RPC proxy.');

        return true;
      }
      if (Number(body['expectedRevision']) !== settingsRevision) {
        sendError(response, 409, 'revision_conflict', 'Settings changed since this revision. Refresh and try again.');

        return true;
      }
      const rootDownloadSetting: MockApi_HandleRequest_RootDownloadSetting = [
        'transmission.downloadDirectory',
        'transmission.incompleteDirectory',
      ].find((key) => isDownloadDataRoot(changes[key]) === true);
      if (rootDownloadSetting !== undefined) {
        sendFieldError(response, 'invalid_request', `changes.${rootDownloadSetting}`, downloadDataPathRootMessage);

        return true;
      }
      const nextDownloadDirectory: MockApi_HandleRequest_NextDownloadDirectory = String(
        changes['transmission.downloadDirectory']
        ?? effectiveStringSetting('transmission.downloadDirectory'),
      );
      const nextIncompleteDirectory: MockApi_HandleRequest_NextIncompleteDirectory = String(
        changes['transmission.incompleteDirectory']
        ?? effectiveStringSetting('transmission.incompleteDirectory'),
      );
      if (
        'transmission.downloadDirectory' in changes
        && defaultTorrentProfile['downloadDirectoryLocked'] === true
      ) {
        sendError(response, 409, 'setting_locked', 'A changed setting is locked by managed configuration.');

        return true;
      }
      if ('transmission.downloadDirectory' in changes) {
        const folderOwner: MockApi_HandleRequest_FolderOwner = profileFolderOwner(nextDownloadDirectory, 'default');
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
        const clash: MockApi_HandleRequest_Clash = [
          {
            path: nextDownloadDirectory,
            profileName: defaultTorrentProfile['name'],
          },
          ...torrentProfiles.map((profile): MockApi_HandleRequest_ClashDestination => ({
            path: profile['downloadDirectory'],
            profileName: `${profile['name']} profile`,
          })),
        ].find((destination) => dataPathContains(
          nextIncompleteDirectory,
          destination['path'],
        ));
        if (clash !== undefined) {
          const exactFolder: MockApi_HandleRequest_ExactFolder = dataPathsEqualIgnoringCase(nextIncompleteDirectory, clash['path']);
          const message: MockApi_HandleRequest_Message = (exactFolder === true) ? `“${clash['path'].slice(clash['path'].lastIndexOf('/') + 1)}” is the ${clash['profileName']}'s folder, so it can't be the incomplete folder.` : `Use a folder outside ${clash['path']}. Torrents in the ${clash['profileName']} finish there.`;

          sendFieldError(
            response,
            'invalid_request',
            'changes.transmission.incompleteDirectory',
            message,
          );

          return true;
        }
      } else if ('transmission.downloadDirectory' in changes) {
        const issue: MockApi_HandleRequest_Issue = downloadFolderIssue(nextDownloadDirectory);
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
      const appliedKeys: MockApi_HandleRequest_AppliedKeys = [];
      const pendingKeys: MockApi_HandleRequest_PendingKeys = [];

      for (const setting of settings) {
        const settingKey: MockApi_HandleRequest_SettingKey = String(setting['key']);

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
      ].some((key) => key in changes) === true) {
        ensureConfiguredDirectories();
      }

      pendingRestartKeys = (noVPNConnections === true) ? [] : [...new Set([
        ...pendingRestartKeys,
        ...pendingKeys,
      ])].sort();
      runtimeApply = {
        status: (pendingKeys.length === 0) ? 'applied' : 'restart-required',
        appliedKeys: appliedKeys.sort(),
        pendingKeys: pendingKeys.sort(),
        connections: ((noVPNConnections === true) ? [] : vpnConnections).map((connection) => ({
          appliedKeys,
          connectionId: connection['id'],
          pendingKeys,
          status: (pendingKeys.length === 0) ? 'applied' : 'restart-required',
        })),
      };
      settingsRevision += 1;
    }

    if (noVPNConnections === true) {
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
    const body: MockApi_HandleRequest_Body = await readBody(request);
    if (body['confirm'] !== true) {
      sendError(response, 422, 'restart_confirmation_required', 'A controlled Transmission restart requires explicit confirmation.');

      return true;
    }

    pendingRestartKeys = [];
    if (noVPNConnections === true) {
      sendError(response, 409, 'transmission_not_running', 'Transmission isn\'t running. Saved settings apply when it starts.');

      return true;
    }
    sendJSON(response, 202, {
      status: 'restarting',
      configurationRevision: settingsRevision,
      connections: vpnConnections.map((connection) => ({
        connectionId: connection['id'],
        status: 'restarting',
      })),
    });

    return true;
  }

  if (path === '/api/v1/storage/directories') {
    const purposeValue: MockApi_HandleRequest_PurposeValue = url.searchParams.get('purpose') ?? 'download';
    if (
      purposeValue !== 'download'
      && purposeValue !== 'incomplete'
      && purposeValue !== 'profile'
    ) {
      sendFieldError(response, 'invalid_request', 'purpose', 'purpose must be download, incomplete, or profile.');

      return true;
    }
    const purpose: MockApi_HandleRequest_Purpose = purposeValue;
    const profileID: MockApi_HandleRequest_ProfileID = url.searchParams.get('profileId') ?? '';
    if (
      purpose === 'profile'
      && profileID !== 'default'
      && profileID !== 'new'
      && torrentProfiles.some((profile) => profile['id'] === profileID) === false
    ) {
      sendFieldError(response, 'invalid_request', 'profileId', 'profileId must be default, new, or an existing torrent profile ID.');

      return true;
    }

    if (method === 'POST') {
      const body: MockApi_HandleRequest_Body = await readBody(request);
      const created: MockApi_HandleRequest_Created = `${String(body['parentPath'] ?? '/data')}/${String(body['name'] ?? 'New folder')}`;

      if (directories.has(created) === true) {
        sendError(response, 409, 'directory_exists', 'A folder with that name already exists.');

        return true;
      }

      ensureDirectory(created);
      sendJSON(response, 201, listDirectory(created, purpose, profileID));

      return true;
    }

    const directoryPath: MockApi_HandleRequest_DirectoryPath = url.searchParams.get('path') ?? '/data';
    const normalized: MockApi_HandleRequest_Normalized = (
      directoryPath === '/data'
      || (
        directoryPath.startsWith('/data/') === true
        && directoryPath.endsWith('/') === false
        && directoryPath.split('/').every((component, index) => (
          index < 2
          || (
            component !== ''
            && component !== '.'
            && component !== '..'
          )
        )) === true
      )
    );
    if (
      normalized === false
      || (
        method === 'DELETE'
        && directoryPath === '/data'
      )
    ) {
      sendError(response, 422, 'directory_path_invalid', 'Choose a normalized folder inside /data.');

      return true;
    }
    if (directoryPath !== '/data' && directories.has(directoryPath) === false) {
      sendError(response, 404, 'directory_not_found', 'That folder no longer exists.');

      return true;
    }

    if (method === 'DELETE') {
      const deletionPolicy: MockApi_HandleRequest_DeletionPolicy = directoryDeletionPolicy(directoryPath);
      if (deletionPolicy['code'] !== '') {
        const status: MockApi_HandleRequest_Status = (
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
      const body: MockApi_HandleRequest_Body = await readBody(request);
      if (body['expectedRevision'] !== organizationRevision) {
        sendError(response, 409, 'revision_conflict', 'Torrent organization changed since this revision. Refresh and try again.');

        return true;
      }
      if (
        Array.isArray(body['labels']) === false
        || Array.isArray(body['removedLabels']) === false
        || Array.isArray(body['renamedLabels']) === false
      ) {
        sendError(response, 422, 'invalid_request', 'labels, removedLabels, and renamedLabels are required.');

        return true;
      }
      const removedLabels: MockApi_HandleRequest_RemovedLabels = body['removedLabels'].map(String);
      const renamedLabels: MockApi_HandleRequest_RenamedLabels = body['renamedLabels'].flatMap((value: MockApi_HandleRequest_RenamedLabelValue): MockApi_HandleRequest_RenamedLabels => (
        (typeof value === 'object' && value !== null) ? [{
          from: String((value as MockApi_HandleRequest_RenamedLabelRecord)['from'] ?? ''),
          to: String((value as MockApi_HandleRequest_RenamedLabelRecord)['to'] ?? ''),
        }] : []
      ));
      let changedTorrents: MockApi_HandleRequest_ChangedTorrents = 0;

      for (const torrent of torrents) {
        const nextLabels: MockApi_HandleRequest_NextLabels = applySavedLabelEdits(
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
        (leftLabel, rightLabel) => leftLabel.localeCompare(rightLabel, undefined, { sensitivity: 'base' }),
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
      const body: MockApi_HandleRequest_Body = await readBody(request);
      const profileName: MockApi_HandleRequest_ProfileName = String(body['name'] ?? '').trim();
      if (torrentProfileNameTaken(profileName, 'new') === true) {
        sendFieldError(response, 'torrent_profile_exists', 'name', 'A torrent profile with this name already exists.', 409);

        return true;
      }
      const issue: MockApi_HandleRequest_Issue = downloadFolderIssue(body['downloadDirectory']);
      if (issue !== '') {
        sendFieldError(response, 'invalid_request', 'downloadDirectory', issue);

        return true;
      }
      const folderOwner: MockApi_HandleRequest_FolderOwner = profileFolderOwner(String(body['downloadDirectory'] ?? ''), 'new');
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
      const nextProfileSequence: MockApi_HandleRequest_NextProfileSequence = torrentProfileSequence + 1;
      const profileId: MockApi_HandleRequest_ProfileId = `tpr-${nextProfileSequence.toString(16).padStart(16, '0')}`;
      const createdAt: MockApi_HandleRequest_CreatedAt = new Date().toISOString();
      const profile: MockApi_HandleRequest_TorrentProfile = readTorrentProfile(
        body,
        profileId,
        createdAt,
      );
      if (isConnectionBeingRemoved(profile['connectionId']) === true) {
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
    const body: MockApi_HandleRequest_Body = await readBody(request);
    const profileName: MockApi_HandleRequest_ProfileName = String(body['name'] ?? '').trim();
    if (torrentProfileNameTaken(profileName, 'default') === true) {
      sendFieldError(response, 'torrent_profile_exists', 'name', 'A torrent profile with this name already exists.', 409);

      return true;
    }
    const issue: MockApi_HandleRequest_Issue = downloadFolderIssue(body['downloadDirectory']);
    if (issue !== '') {
      sendFieldError(response, 'invalid_request', 'downloadDirectory', issue);

      return true;
    }
    const folderOwner: MockApi_HandleRequest_FolderOwner = profileFolderOwner(String(body['downloadDirectory'] ?? ''), 'default');
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

    const updatedProfile: MockApi_HandleRequest_UpdatedDefaultProfile = readDefaultTorrentProfile(body);
    const folderChanged: MockApi_HandleRequest_FolderChanged = dataPathsEqualIgnoringCase(
      updatedProfile['downloadDirectory'],
      defaultTorrentProfile['downloadDirectory'],
    ) === false;
    if (folderChanged === true && defaultTorrentProfile['downloadDirectoryLocked'] === true) {
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
      noVPNConnections === true
      && folderChanged === true
      && torrents.some((torrent) => torrent['profileId'] === null) === true
    ) {
      sendError(response, 503, 'transmission_unavailable', 'The default Transmission daemon is unavailable.');

      return true;
    }

    const targetConnectionID: MockApi_HandleRequest_ConnectionId = defaultVPNConnection()['id'];
    const profileTorrents: MockApi_HandleRequest_ProfileTorrents = torrents.filter((torrent) => (
      folderChanged === true
      && torrent['profileId'] === null
      && (
        torrent['connectionId'] !== targetConnectionID
        || dataPathsEqualIgnoringCase(torrent['downloadDir'], updatedProfile['downloadDirectory']) === false
      )
    ));
    if (profileTorrents.length > 0 && body['moveTorrents'] !== true) {
      sendError(response, 409, 'torrents_must_move', `${defaultTorrentProfile['name']}'s torrents must move to its download folder.`, {
        downloadDirectory: updatedProfile['downloadDirectory'],
        torrents: profileTorrents.length,
      });

      return true;
    }

    const moved: MockApi_HandleRequest_Moved = profileTorrents.map((torrent) => {
      const connectionChanged: MockApi_HandleRequest_ConnectionChanged = torrent['connectionId'] !== targetConnectionID;

      Reflect.set(torrent, 'connectionId', targetConnectionID);
      Reflect.set(torrent, 'downloadDir', updatedProfile['downloadDirectory']);
      if (connectionChanged === true) {
        Reflect.set(torrent, 'id', Math.max(0, ...torrents.map((candidate) => candidate['id'])) + 1);
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
    const downloadSetting: MockApi_HandleRequest_Setting = settings.find(
      (setting) => setting['key'] === 'transmission.downloadDirectory',
    );
    if (downloadSetting !== undefined) {
      Reflect.set(downloadSetting, 'value', updatedProfile['downloadDirectory']);
      Reflect.set(downloadSetting, 'source', 'user');
    }
    if (folderChanged === true) {
      settingsRevision += 1;
    }
    ensureDirectory(updatedProfile['downloadDirectory']);
    sendJSON(response, 200, {
      ...defaultTorrentProfileResponse(),
      moved,
    });

    return true;
  }

  const torrentProfileMatch: MockApi_HandleRequest_TorrentProfileMatch = path.match(new RegExp(torrentProfilePathPattern, 'u'));
  if (torrentProfileMatch !== null) {
    const profileId: MockApi_HandleRequest_ProfileId = decodeURIComponent(torrentProfileMatch[1] ?? '');
    const profileIndex: MockApi_HandleRequest_ProfileIndex = torrentProfiles.findIndex(
      (profile) => profile['id'] === profileId,
    );
    const profile: MockApi_HandleRequest_ExistingTorrentProfile = torrentProfiles[profileIndex];
    if (profile === undefined) {
      sendError(response, 404, 'torrent_profile_not_found', 'That torrent profile no longer exists.');

      return true;
    }

    if (method === 'DELETE') {
      const body: MockApi_HandleRequest_Body = await readBody(request);
      if ('moveTorrents' in body && typeof body['moveTorrents'] !== 'boolean') {
        sendFieldError(response, 'invalid_request', 'moveTorrents', 'moveTorrents must be a boolean.');

        return true;
      }
      const profileTorrents: MockApi_HandleRequest_ProfileTorrents = torrents.filter(
        (torrent) => torrent['profileId'] === profileId,
      );
      if (profileTorrents.length > 0 && noVPNConnections === true) {
        sendError(response, 503, 'transmission_unavailable', 'The default Transmission daemon is unavailable.');

        return true;
      }
      const targetConnectionId: MockApi_HandleRequest_ConnectionId = defaultVPNConnection()['id'];
      const targetDirectory: MockApi_HandleRequest_TargetDirectory = defaultTorrentProfile['downloadDirectory'];
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

      const moved: MockApi_HandleRequest_Moved = profileTorrents.map(
        (torrent, index) => {
          const alreadyThere: MockApi_HandleRequest_AlreadyThere = torrent['connectionId'] === targetConnectionId
            && dataPathsEqualIgnoringCase(torrent['downloadDir'], targetDirectory);
          const failed: MockApi_HandleRequest_Failed = process.env['MOCK_VPN_MOVE_FAILURE'] === 'true' && index === 0;
          let moveResult: MockApi_HandleRequest_MoveResult = 'moved';
          if (failed === true) {
            moveResult = 'failed';
          } else if (alreadyThere === true) {
            moveResult = 'already-there';
          }
          Reflect.set(torrent, 'profileId', null);
          if (failed === false) {
            if (torrent['connectionId'] !== targetConnectionId) {
              Reflect.set(torrent, 'id', Math.max(0, ...torrents.map((candidate) => candidate['id'])) + 1);
            }
            Reflect.set(torrent, 'connectionId', targetConnectionId);
            Reflect.set(torrent, 'downloadDir', targetDirectory);
          }

          return {
            hash: torrent['hashString'],
            ...((failed === true) ? {} : { id: torrent['id'] }),
            name: torrent['name'],
            result: moveResult,
            ...((failed === true) ? { error: 'The mock torrent move failed before its source was changed.' } : {}),
            ...((
              failed === true
              || alreadyThere === true
              || torrentMoveWarnings.length === 0
            ) ? {} : { warnings: torrentMoveWarnings }),
          };
        },
      );

      torrentProfiles.splice(profileIndex, 1);

      for (const torrent of torrents) {
        if (torrent['needsProfile'] !== null) {
          torrent['needsProfile'].profileIds = torrent['needsProfile']['profileIds'].filter(
            (matchingProfileId) => matchingProfileId !== profileId,
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
      const body: MockApi_HandleRequest_Body = await readBody(request);
      const profileName: MockApi_HandleRequest_ProfileName = String(body['name'] ?? '').trim();
      if (torrentProfileNameTaken(profileName, profile['id']) === true) {
        sendFieldError(response, 'torrent_profile_exists', 'name', 'A torrent profile with this name already exists.', 409);

        return true;
      }
      const issue: MockApi_HandleRequest_Issue = downloadFolderIssue(body['downloadDirectory']);
      if (issue !== '') {
        sendFieldError(response, 'invalid_request', 'downloadDirectory', issue);

        return true;
      }
      const folderOwner: MockApi_HandleRequest_FolderOwner = profileFolderOwner(String(body['downloadDirectory'] ?? ''), profile['id']);
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
      const updatedProfile: MockApi_HandleRequest_TorrentProfile = readTorrentProfile(
        body,
        profile['id'],
        profile['createdAt'],
      );
      const targetConnectionId: MockApi_HandleRequest_ConnectionId = updatedProfile['connectionId'] ?? defaultVPNConnection()['id'];
      if (isConnectionBeingRemoved(updatedProfile['connectionId']) === true) {
        sendConnectionBeingRemoved(response);

        return true;
      }
      const connectionChanged: MockApi_HandleRequest_ConnectionChanged = updatedProfile['connectionId'] !== profile['connectionId'];
      const folderChanged: MockApi_HandleRequest_FolderChanged = dataPathsEqualIgnoringCase(
        updatedProfile['downloadDirectory'],
        profile['downloadDirectory'],
      ) === false;
      const profileTorrents: MockApi_HandleRequest_ProfileTorrents = torrents.filter(
        (torrent) => (
          torrent['profileId'] === profile['id']
          && (
            (
              connectionChanged === true
              && torrent['connectionId'] !== targetConnectionId
            )
            || (
              folderChanged === true
              && dataPathsEqualIgnoringCase(torrent['downloadDir'], updatedProfile['downloadDirectory']) === false
            )
          )
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
      const moved: MockApi_HandleRequest_Moved = profileTorrents.map((torrent) => {
        const torrentConnectionChanged: MockApi_HandleRequest_ConnectionChanged = torrent['connectionId'] !== targetConnectionId;

        Reflect.set(torrent, 'connectionId', targetConnectionId);
        Reflect.set(torrent, 'downloadDir', updatedProfile['downloadDirectory']);
        if (torrentConnectionChanged === true) {
          Reflect.set(torrent, 'id', Math.max(0, ...torrents.map((candidate) => candidate['id'])) + 1);
        }

        return {
          hash: torrent['hashString'],
          id: torrent['id'],
          name: torrent['name'],
          result: 'moved',
          ...((torrentMoveWarnings.length === 0) ? {} : { warnings: torrentMoveWarnings }),
        };
      });

      Reflect.set(torrentProfiles, profileIndex, updatedProfile);

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
    const tunnel: MockApi_HandleRequest_TunnelFilter = url.searchParams.get('tunnel');

    sendJSON(response, 200, {
      items: profiles.filter((profile) => (
        profile['providerId'] === url.searchParams.get('provider')
        && (
          tunnel === null
          || tunnel === ''
          || profile['tunnel'] === tunnel
        )
      )),
    });

    return true;
  }

  if (path === '/api/v1/vpn/profiles/custom' && method === 'POST') {
    const body: MockApi_HandleRequest_Body = await readBody(request);
    const tunnel: MockApi_HandleRequest_CustomTunnel = body['tunnel'] ?? 'openvpn';
    const profileName: MockApi_HandleRequest_CustomProfileName = body['profileName'];
    const profileContent: MockApi_HandleRequest_CustomProfileContent = body['profile'];

    if (
      (
        tunnel !== 'openvpn'
        && tunnel !== 'wireguard'
      )
      || typeof profileName !== 'string'
      || typeof profileContent !== 'string'
      || profileName.trim() === ''
      || profileContent === ''
    ) {
      sendError(response, 422, 'invalid_request', 'Choose a profile file.');

      return true;
    }

    const looksLikeWireGuard: MockApi_HandleRequest_LooksLikeWireGuard = new RegExp(wireGuardInterfacePattern, 'im').test(profileContent);

    if (tunnel === 'openvpn' && looksLikeWireGuard === true) {
      sendError(response, 422, 'invalid_request', 'This is a WireGuard file. Choose the WireGuard tunnel to upload it.');

      return true;
    }

    if (tunnel === 'wireguard' && looksLikeWireGuard === false) {
      sendError(response, 422, 'invalid_request', 'This is not a WireGuard file because it has no [Interface] section. For an OpenVPN profile, choose the OpenVPN tunnel.');

      return true;
    }

    let endpointMatches: MockApi_HandleRequest_EndpointMatches = [];
    if (tunnel === 'wireguard') {
      endpointMatches = [profileContent.match(new RegExp(wireGuardEndpointPattern, 'imu'))].filter((match): match is RegExpMatchArray => match !== null);
    } else {
      endpointMatches = [...profileContent.matchAll(new RegExp(openVpnRemotePattern, 'gimu'))];
    }
    if (endpointMatches.length === 0) {
      const tunnelLabel: MockApi_HandleRequest_TunnelLabel = (tunnel === 'wireguard') ? 'WireGuard' : 'OpenVPN';

      sendError(response, 422, 'invalid_request', `The ${tunnelLabel} profile does not contain a remote endpoint.`);

      return true;
    }
    const displayName: MockApi_HandleRequest_DisplayName = profileName.trim().replace(new RegExp(profileExtensionPattern, 'i'), '');
    const slug: MockApi_HandleRequest_Slug = displayName.toLowerCase().replace(new RegExp(nonSlugCharactersPattern, 'g'), '-').replace(new RegExp(edgeHyphensPattern, 'g'), '') || 'endpoint';
    const uploadedProfiles: MockApi_HandleRequest_UploadedProfiles = endpointMatches.map((endpointMatch, index) => {
      const remoteProtocol: MockApi_HandleRequest_RemoteProtocol = endpointMatch[3];
      let tcp: MockApi_HandleRequest_Tcp = false;
      if (tunnel === 'openvpn') {
        tcp = new RegExp(openVpnTcpPattern, 'imu').test(profileContent);
        if (remoteProtocol !== undefined) {
          tcp = remoteProtocol.toLowerCase().startsWith('tcp');
        }
      }

      const idPrefix: MockApi_HandleRequest_IdPrefix = (tunnel === 'wireguard') ? 'wg-' : '';
      const idSuffix: MockApi_HandleRequest_IdSuffix = (endpointMatches.length > 1) ? `-${String(index + 1)}` : '';

      return {
        'id': `custom:${idPrefix}${slug}${idSuffix}:${randomBytes(6).toString('hex')}`,
        'providerId': 'custom',
        tunnel,
        'displayName': (endpointMatches.length > 1) ? `${displayName} (${String(index + 1)})` : displayName,
        'countryCode': '',
        'country': '',
        'city': '',
        'continent': '',
        'protocol': (tcp === true) ? 'tcp' : 'udp',
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
    sendJSON(response, 200, { items: [...notifications].sort((left, right) => right['createdAt'].localeCompare(left['createdAt'])) });

    return true;
  }

  // notificationInput checks a create or edit body like the control API, sending the first problem.

  /**
   * Mock API - Notification Input.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @returns {MockApi_HandleRequest_NotificationInput_Returns}
   *
   * @since 2.0.0
   */
  const notificationInput: MockApi_HandleRequest_NotificationInput = (body: MockApi_HandleRequest_NotificationInput_Body, existing: MockApi_HandleRequest_NotificationInput_Existing): MockApi_HandleRequest_NotificationInput_Returns => {
    const service: MockApi_HandleRequest_NotificationInput_Service = (existing !== null) ? existing['service'] : body['service'] as MockApi_HandleRequest_NotificationInput_Service;
    const name: MockApi_HandleRequest_NotificationInput_Name = (typeof body['name'] === 'string') ? body['name'].trim() : '';
    const events: MockApi_HandleRequest_NotificationInput_Events = (Array.isArray(body['events']) === true) ? body['events'] as MockApi_HandleRequest_NotificationInput_Events : [];
    const values: MockApi_HandleRequest_NotificationInput_Values = (typeof body['settings'] === 'object' && body['settings'] !== null) ? body['settings'] as MockApi_HandleRequest_NotificationInput_Values : {};

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

    const plainSettings: MockApi_HandleRequest_NotificationInput_PlainSettings = {};
    const secrets: MockApi_HandleRequest_NotificationInput_Secrets = { ...((existing !== null) ? existing['secrets'] : {}) };

    for (const field of notificationFields[service]) {
      const key: MockApi_HandleRequest_NotificationInput_Key = field[0];
      const missing: MockApi_HandleRequest_NotificationInput_Missing = field[1];
      const secret: MockApi_HandleRequest_NotificationInput_Secret = field[2];
      const required: MockApi_HandleRequest_NotificationInput_Required = field[3];
      const value: MockApi_HandleRequest_NotificationInput_Value = (typeof values[key] === 'string') ? (values[key]).trim() : '';
      const saved: MockApi_HandleRequest_NotificationInput_Saved = (
        secret === true
        && existing !== null
        && existing['secrets'][key] === true
      );

      if (
        value === ''
        && required === true
        && saved === false
      ) {
        sendFieldError(response, 'invalid_request', `settings.${key}`, missing);

        return null;
      }

      if (value !== '' && secret === true) {
        Reflect.set(secrets, key, true);
      } else if (value !== '') {
        Reflect.set(plainSettings, key, value);
      }
    }

    // Optional secrets that are saved, or missing after a lost key, can be cleared once each, never alongside a new value.
    const clearable: MockApi_HandleRequest_NotificationInput_Clearable = notificationFields[service]
      .filter((field) => (
        field[2] === true
        && field[3] === false
        && existing !== null
        && (
          existing['secrets'][field[0]] === true
          || existing['secretsMissing'].includes(field[0]) === true
        )
      ))
      .map((field) => field[0]);
    const clearSecrets: MockApi_HandleRequest_NotificationInput_ClearSecrets = (Array.isArray(body['clearSecrets']) === true) ? body['clearSecrets'] : [];
    const invalidIndex: MockApi_HandleRequest_NotificationInput_InvalidIndex = clearSecrets.findIndex((key) => typeof key !== 'string' || clearable.includes(key) === false);

    if (body['clearSecrets'] !== undefined && Array.isArray(body['clearSecrets']) === false) {
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

    const replaced: MockApi_HandleRequest_NotificationInput_Replaced = (clearSecrets as MockApi_HandleRequest_NotificationInput_ClearSecretKeys).find((key) => typeof values[key] === 'string' && (values[key]).trim() !== '');

    if (replaced !== undefined) {
      sendFieldError(response, 'invalid_request', `settings.${replaced}`, 'Enter a new value or clear this field, not both.');

      return null;
    }

    for (const key of clearSecrets as MockApi_HandleRequest_NotificationInput_ClearSecretKeys) {
      Reflect.deleteProperty(secrets, key);
    }

    if (notifications.some((notification) => notification['id'] !== ((existing !== null) ? existing['id'] : undefined) && notification['name'].toLowerCase() === name.toLowerCase()) === true) {
      sendFieldError(response, 'notification_exists', 'name', 'A notification with this name already exists.', 409);

      return null;
    }

    return {
      clearSecrets: clearSecrets as MockApi_HandleRequest_NotificationInput_ClearSecretKeys,
      events,
      name,
      secrets,
      service,
      settings: plainSettings,
    };
  };

  if (method === 'POST' && path === '/api/v1/notifications') {
    const input: MockApi_HandleRequest_Input = notificationInput(await readBody(request), null);

    if (input === null) {
      return true;
    }

    const notification: MockApi_HandleRequest_Notification = {
      events: input['events'],
      name: input['name'],
      secrets: input['secrets'],
      service: input['service'],
      settings: input['settings'],
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

  const notificationMatch: MockApi_HandleRequest_NotificationMatch = path.match(new RegExp(notificationPathPattern, 'u'));

  if (notificationMatch !== null) {
    const index: MockApi_HandleRequest_Index = notifications.findIndex((notification) => notification['id'] === notificationMatch[1]);
    const notification: MockApi_HandleRequest_FoundNotification = notifications[index];

    if (notification === undefined) {
      sendError(response, 404, 'notification_not_found', 'That notification no longer exists.');

      return true;
    }

    if (method === 'POST' && notificationMatch[2] === '/test') {
      if (notification['secretsMissing'].length > 0) {
        sendJSON(response, 200, {
          delivered: false,
          message: 'Enter the removed secrets again first.',
        });

        return true;
      }

      if (notificationTransportError === true) {
        notification.lastAttemptAt = new Date().toISOString();
        notification.lastError = mockNotificationTransportFailure(rawNotificationTransportError);
        notification.lastErrorDetails = rawNotificationTransportError;
        sendJSON(response, 200, {
          delivered: false,
          details: rawNotificationTransportError,
          message: notification['lastError'],
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
      removedSecrets = removedSecrets.filter((removedSecret) => removedSecret['notificationId'] !== notification['id']);
      response.writeHead(204).end();

      return true;
    }

    if (method === 'PUT') {
      const input: MockApi_HandleRequest_Input = notificationInput(await readBody(request), notification);

      if (input === null) {
        return true;
      }

      notification.events = input['events'];
      notification.name = input['name'];
      notification.secrets = input['secrets'];

      // A missing secret is settled by entering it again or, when optional, by clearing it.
      notification.secretsMissing = notification['secretsMissing'].filter((key) => input['secrets'][key] !== true && input['clearSecrets'].includes(key) === false);
      notification.settings = input['settings'];
      notification.updatedAt = new Date().toISOString();

      if (notification['secretsMissing'].length === 0) {
        removedSecrets = removedSecrets.filter((removedSecret) => removedSecret['notificationId'] !== notification['id']);
      }

      sendJSON(response, 200, notification);

      return true;
    }
  }

  if (path === '/api/v1/auth/tokens') {
    if (method === 'POST') {
      const fields: MockApi_HandleRequest_Fields = await readTokenFields(request, response, '');

      if (fields === undefined) {
        return true;
      }

      tokenSequence += 1;

      const token: MockApi_HandleRequest_NewToken = {
        id: `tok-${tokenSequence}`,
        name: fields['name'],
        scopes: fields['scopes'],
        expiresAt: fields['expiresAt'] ?? null,
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
      };
      const plaintext: MockApi_HandleRequest_Plaintext = `tvpn_${randomBytes(32).toString('base64url')}`;

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

  if (
    path.startsWith('/api/v1/auth/tokens/') === true
    && (
      method === 'PUT'
      || method === 'DELETE'
    )
  ) {
    const tokenId: MockApi_HandleRequest_TokenId = decodeURIComponent(path.slice('/api/v1/auth/tokens/'.length));
    const token: MockApi_HandleRequest_Token = tokens.find((candidate) => candidate['id'] === tokenId);

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

    const fields: MockApi_HandleRequest_Fields = await readTokenFields(request, response, tokenId);

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
    const selection: MockApi_HandleRequest_SelectionParam = url.searchParams.get('ids');
    const identifiers: MockApi_HandleRequest_Identifiers = (
      selection === null
      || selection === ''
      || selection === 'recently-active'
    ) ? null : selection.split(',').map((identifier) => Number(identifier.trim()));
    const items: MockApi_HandleRequest_TorrentItems = (identifiers === null) ? torrents : torrents.filter((torrent) => identifiers.includes(torrent['id']));

    sendJSON(response, 200, {
      errors: torrentErrors(),
      items: items.map(torrentSummary),
    });

    return true;
  }

  if (path === '/api/v1/torrents/preview' && method === 'POST') {
    const body: MockApi_HandleRequest_Body = await readBody(request);
    if (Array.isArray(body['links']) === false || body['links'].length > 20) {
      sendError(
        response,
        422,
        'torrent_preview_links_invalid',
        'Preview at most 20 torrent links at a time.',
      );

      return true;
    }

    const items: MockApi_HandleRequest_PreviewItems = [];

    body['links'].forEach((link, index) => {
      if (typeof link !== 'string') {
        return;
      }
      const preview: MockApi_HandleRequest_Preview = previewTorrentLink(link.trim(), index);
      if (preview !== null) {
        items.push(preview);
      }

      return;
    });

    sendJSON(response, 200, { items });

    return true;
  }

  if (path === '/api/v1/torrents' && method === 'POST') {
    const body: MockApi_HandleRequest_Body = await readBody(request);
    if (
      body['profileId'] !== undefined
      && body['profileId'] !== null
      && (
        typeof body['profileId'] !== 'string'
        || new RegExp(torrentProfileIdPattern, 'u').test(body['profileId']) === false
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
    const profile: MockApi_HandleRequest_SelectedProfile = torrentProfiles.find(
      (candidate) => candidate['id'] === body['profileId'],
    );
    if (typeof body['profileId'] === 'string' && profile === undefined) {
      sendError(response, 404, 'torrent_profile_not_found', 'That torrent profile no longer exists.');

      return true;
    }
    const profileData: MockApi_HandleRequest_ProfileData = profile ?? defaultTorrentProfile;
    const overlap: MockApi_HandleRequest_Overlap = profileFolderOverlaps().find((candidate) => candidate['profileId'] === ((profile === undefined) ? 'default' : profile['id']));
    if (overlap !== undefined) {
      const profileLabel: MockApi_HandleRequest_ProfileLabel = (profile === undefined) ? defaultTorrentProfile['name'] : `${profileData['name']} profile`;

      sendError(response, 409, 'profile_folder_overlap', `Change the ${profileLabel}'s folder before adding torrents to it. ${overlap['message']}`);

      return true;
    }
    const downloadDirectory: MockApi_HandleRequest_DownloadDirectory = profileData['downloadDirectory'];
    if (
      typeof body['downloadDirectory'] === 'string'
      && dataPathsEqualIgnoringCase(body['downloadDirectory'], downloadDirectory) === false
    ) {
      sendFieldError(response, 'invalid_request', 'downloadDirectory', 'The download folder comes from the profile.');

      return true;
    }
    const downloadIssue: MockApi_HandleRequest_DownloadIssue = downloadFolderIssue(downloadDirectory);
    if (downloadIssue !== '') {
      sendFieldError(response, 'download_directory_invalid', 'downloadDirectory', downloadIssue);

      return true;
    }
    torrentAddAttempt += 1;
    if (noVPNConnections === true) {
      sendError(response, 503, 'vpn_connection_required', 'Add a VPN connection before adding torrents.');

      return true;
    }
    if (
      torrentAddOutcome === 'failed'
      || (
        torrentAddOutcome === 'mixed'
        && torrentAddAttempt % 2 === 0
      )
    ) {
      sendError(response, 422, 'transmission_rejected', 'Transmission rejected the requested operation.');

      return true;
    }
    const nextId: MockApi_HandleRequest_NextId = Math.max(0, ...torrents.map((torrent) => torrent['id'])) + 1;
    const sourceValue: MockApi_HandleRequest_SourceValue = String((
      body['filename']
      ?? body['metainfo']
      ?? nextId
    ));
    const hash: MockApi_HandleRequest_Hash = createHash('sha1').update(sourceValue).digest('hex');
    const targetConnectionId: MockApi_HandleRequest_TargetConnectionId = (
      'connectionId' in profileData && profileData['connectionId'] !== null
    ) ? profileData['connectionId'] : defaultVPNConnection()['id'];
    if (isConnectionBeingRemoved(targetConnectionId) === true) {
      sendConnectionBeingRemoved(response);

      return true;
    }
    const duplicateTorrent: MockApi_HandleRequest_DuplicateTorrent = torrents.find(
      (torrent) => torrent['hashString'] === hash,
    );
    if (duplicateTorrent !== undefined) {
      const duplicateProfile: MockApi_HandleRequest_SelectedProfile = torrentProfiles.find(
        (candidate) => candidate['id'] === duplicateTorrent['profileId'],
      );
      const duplicateConnection: MockApi_HandleRequest_Connection = vpnConnections.find(
        (connection) => connection['id'] === duplicateTorrent['connectionId'],
      );

      sendJSON(response, 201, {
        connectionName: ((duplicateConnection !== undefined) ? duplicateConnection['name'] : undefined) ?? duplicateTorrent['connectionId'],
        duplicate: true,
        hash: duplicateTorrent['hashString'],
        id: duplicateTorrent['id'],
        name: duplicateTorrent['name'],
        profileName: ((duplicateProfile !== undefined) ? duplicateProfile['name'] : undefined) ?? defaultTorrentProfile['name'],
      });

      return true;
    }
    const now: MockApi_HandleRequest_NowSeconds = Math.floor(Date.now() / 1000);
    const paused: MockApi_HandleRequest_Paused = (body['paused'] === undefined) ? profileData['startPaused'] : body['paused'] === true;
    const totalSize: MockApi_HandleRequest_TotalSize = Math.round(1.4 * gibibyte);
    if (profileData['options']['queue'] === 'top') {
      for (const torrent of torrents) {
        torrent.queuePosition += 1;
      }
    }
    const torrent: MockApi_HandleRequest_NewTorrent = {
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
        (Array.isArray(body['labels']) === true) ? body['labels'].map(String) : [],
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
      'profileId': ((profile !== undefined) ? profile['id'] : undefined) ?? null,
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
      'status': (paused === true) ? 0 : 4,
      totalSize,
      'uploadedEver': 0,
      'uploadLimit': 0,
      'uploadLimited': false,
      'uploadRatio': -1,
    };

    applyTorrentProfileOptions(torrent, profileData);
    torrent.labels = mergeTorrentLabels(
      (Array.isArray(body['labels']) === true) ? body['labels'].map(String) : [],
      profileData['labels'],
    );
    saveUsedLabels(torrent['labels']);

    torrents.push(torrent);

    const torrentConnection: MockApi_HandleRequest_Connection = vpnConnections.find(
      (connection) => connection['id'] === torrent['connectionId'],
    );

    sendJSON(response, 201, {
      connectionName: ((torrentConnection !== undefined) ? torrentConnection['name'] : undefined) ?? torrent['connectionId'],
      duplicate: false,
      hash,
      id: torrent['id'],
      name: torrent['name'],
      profileName: profileData['name'],
    });

    return true;
  }

  if (path === '/api/v1/torrents' && method === 'PATCH') {
    const body: MockApi_HandleRequest_Body = await readBody(request);
    const selection: MockApi_HandleRequest_TorrentSelection = readTorrentSelection(body, response);
    if (selection === undefined) {
      return true;
    }
    const changes: MockApi_HandleRequest_Changes = (typeof body['changes'] === 'object' && body['changes'] !== null) ? body['changes'] as MockApi_HandleRequest_Changes : {};

    for (const torrent of selection['items']) {
      if (changes['bandwidthPriority'] !== undefined) {
        torrent.bandwidthPriority = Number(changes['bandwidthPriority']) as MockApi_HandleRequest_BandwidthPriority;
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
      if (Array.isArray(changes['labels']) === true) {
        torrent.labels = changes['labels'].map(String);
      }
      if (changes['peerLimit'] !== undefined) {
        Reflect.set(torrent, 'peer-limit', Number(changes['peerLimit']));
      }
      if (changes['seedIdleLimit'] !== undefined) {
        torrent.seedIdleLimit = Number(changes['seedIdleLimit']);
      }
      if (changes['seedIdleMode'] !== undefined) {
        torrent.seedIdleMode = Number(changes['seedIdleMode']) as MockApi_HandleRequest_SeedIdleMode;
      }
      if (changes['seedRatioLimit'] !== undefined) {
        torrent.seedRatioLimit = Number(changes['seedRatioLimit']);
      }
      if (changes['seedRatioMode'] !== undefined) {
        torrent.seedRatioMode = Number(changes['seedRatioMode']) as MockApi_HandleRequest_SeedRatioMode;
      }
      if (changes['uploadLimit'] !== undefined) {
        torrent.uploadLimit = Number(changes['uploadLimit']);
      }
      if (changes['uploadLimited'] !== undefined) {
        torrent.uploadLimited = changes['uploadLimited'] === true;
      }
    }
    if (Array.isArray(changes['labels']) === true) {
      saveUsedLabels(changes['labels'].map(String));
    }
    sendJSON(response, 200, torrentMutationResponse(selection));

    return true;
  }

  if (path === '/api/v1/torrents/profile' && method === 'PUT') {
    const body: MockApi_HandleRequest_Body = await readBody(request);
    const selection: MockApi_HandleRequest_TorrentSelection = readTorrentSelection(body, response);
    if (selection === undefined) {
      return true;
    }
    if (
      ('profileId' in body) === false
      || (
        body['profileId'] !== null
        && (
          typeof body['profileId'] !== 'string'
          || new RegExp(torrentProfileIdPattern, 'u').test(body['profileId']) === false
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
    const profile: MockApi_HandleRequest_SelectedProfile = torrentProfiles.find(
      (candidate) => candidate['id'] === body['profileId'],
    );
    if (typeof body['profileId'] === 'string' && profile === undefined) {
      sendError(response, 404, 'torrent_profile_not_found', 'That torrent profile no longer exists.');

      return true;
    }
    const profileData: MockApi_HandleRequest_ProfileData = profile ?? defaultTorrentProfile;
    const moved: MockApi_HandleRequest_MovedTorrents = [];
    if (noVPNConnections === true) {
      sendError(response, 503, 'transmission_unavailable', 'Transmission is unavailable for the selected connection.');

      return true;
    }
    const targetConnectionId: MockApi_HandleRequest_TargetConnectionId = (
      'connectionId' in profileData && profileData['connectionId'] !== null
    ) ? profileData['connectionId'] : defaultVPNConnection()['id'];
    const targetDirectory: MockApi_HandleRequest_TargetDirectory = profileData['downloadDirectory'];
    if (isConnectionBeingRemoved(targetConnectionId) === true) {
      sendConnectionBeingRemoved(response);

      return true;
    }
    const resolvingSelection: MockApi_HandleRequest_ResolvingSelection = selection['items'].some(
      (torrent) => torrent['needsProfile'] !== null,
    );

    for (const torrent of selection['items']) {
      const resolvingProfile: MockApi_HandleRequest_ResolvingProfile = torrent['needsProfile'] !== null;
      const existingLabels: MockApi_HandleRequest_ExistingLabels = [...torrent['labels']];
      const alreadyThere: MockApi_HandleRequest_AlreadyThere = torrent['connectionId'] === targetConnectionId
        && dataPathsEqualIgnoringCase(torrent['downloadDir'], targetDirectory);
      const connectionChanged: MockApi_HandleRequest_ConnectionChanged = torrent['connectionId'] !== targetConnectionId;
      torrent.profileId = ((profile !== undefined) ? profile['id'] : undefined) ?? null;
      torrent.needsProfile = null;
      torrent.connectionId = targetConnectionId;
      torrent.downloadDir = targetDirectory;
      if (connectionChanged === true) {
        torrent.id = Math.max(0, ...torrents.map((candidate) => candidate['id'])) + 1;
      }
      moved.push({
        hash: torrent['hashString'],
        id: torrent['id'],
        name: torrent['name'],
        result: (alreadyThere === true) ? 'already-there' : 'moved',
        ...((alreadyThere === true || torrentMoveWarnings.length === 0) ? {} : { warnings: torrentMoveWarnings }),
      });
      if (body['applyOptions'] === true || resolvingProfile === true) {
        applyTorrentProfileOptions(torrent, profileData);
        if (resolvingProfile === true) {
          torrent.labels = mergeTorrentLabels(existingLabels, profileData['labels']);
        }
      }
      if (resolvingProfile === true) {
        if (profileData['startPaused'] === true) {
          torrent.status = 0;
        } else if (torrent['percentDone'] >= 1) {
          torrent.status = 6;
        } else {
          torrent.status = 4;
        }
      }
    }
    if (
      (
        body['applyOptions'] === true
        || resolvingSelection === true
      )
      && profileData['options']['queue'] === 'top'
    ) {
      moveTorrentsToQueueTop(selection['items']);
    }
    if (body['applyOptions'] === true || resolvingSelection === true) {
      saveUsedLabels(selection['items'].flatMap((torrent) => torrent['labels']));
    }
    sendJSON(response, 200, {
      ...torrentMutationResponse(selection),
      applyOptions: body['applyOptions'] === true || resolvingSelection === true,
      moved,
      profileId: ((profile !== undefined) ? profile['id'] : undefined) ?? null,
    });

    return true;
  }

  if (path === '/api/v1/torrents/actions' && method === 'POST') {
    const body: MockApi_HandleRequest_Body = await readBody(request);
    const selection: MockApi_HandleRequest_TorrentSelection = readTorrentSelection(body, response);
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
    const body: MockApi_HandleRequest_Body = await readBody(request);
    const selection: MockApi_HandleRequest_TorrentSelection = readTorrentSelection(body, response);
    if (selection === undefined) {
      return true;
    }

    for (const selectedTorrent of selection['items']) {
      const index: MockApi_HandleRequest_Index = torrents.indexOf(selectedTorrent);

      if (index >= 0) {
        torrents.splice(index, 1);
      }
    }

    response.writeHead(204).end();

    return true;
  }

  if (path === '/api/v1/torrents/torrent-files' && method === 'POST') {
    const body: MockApi_HandleRequest_Body = await readBody(request);
    const selection: MockApi_HandleRequest_TorrentSelection = readTorrentSelection(body, response);
    if (selection === undefined) {
      return true;
    }
    const downloadable: MockApi_HandleRequest_TorrentItems = selection['items'].filter(
      (torrent) => torrent['metadataPercentComplete'] >= 1,
    );
    const requestedCount: MockApi_HandleRequest_RequestedCount = (selection['field'] === 'hashes') ? selection['hashes'].length : selection['ids'].length;
    const firstTorrent: MockApi_HandleRequest_FirstTorrent = downloadable[0];
    if (firstTorrent === undefined) {
      sendError(response, 409, 'torrent_file_unavailable', 'There\'s no .torrent file yet. Transmission saves one once a torrent has its metadata.');

      return true;
    }
    const downloadHeaders: MockApi_HandleRequest_DownloadHeaders = {
      'Cache-Control': 'no-store',
      'X-Torrent-Files-Skipped': String(requestedCount - downloadable.length),
    };
    if (requestedCount === 1) {
      response.writeHead(200, {
        ...downloadHeaders,
        'Content-Disposition': attachmentDisposition(torrentDownloadName(firstTorrent)),
        'Content-Type': 'application/x-bittorrent',
      }).end(mockTorrentFile(firstTorrent));

      return true;
    }
    response.writeHead(200, {
      ...downloadHeaders,
      'Content-Disposition': attachmentDisposition(`transmission-vpn-torrents-${new Date().toISOString().slice(0, 10)}.zip`),
      'Content-Type': 'application/zip',
    }).end(storedZip(downloadable.map((torrent): MockApi_HandleRequest_ZipFile => ({
      content: mockTorrentFile(torrent),
      name: torrentDownloadName(torrent),
    }))));

    return true;
  }

  if (path === '/api/v1/torrents/contents' && method === 'POST') {
    const body: MockApi_HandleRequest_Body = await readBody(request);
    const selection: MockApi_HandleRequest_TorrentSelection = readTorrentSelection(body, response);
    if (selection === undefined) {
      return true;
    }
    const finished: MockApi_HandleRequest_TorrentItems = selection['items'].filter(
      (torrent) => (
        torrent['metadataPercentComplete'] >= 1
        && torrent['leftUntilDone'] === 0
        && torrent['sizeWhenDone'] > 0
      ),
    );
    const firstTorrent: MockApi_HandleRequest_FirstTorrent = finished[0];
    if (firstTorrent === undefined) {
      sendError(response, 409, 'torrent_contents_unfinished', 'These torrents haven\'t finished downloading yet.');

      return true;
    }
    const requestedCount: MockApi_HandleRequest_RequestedCount = (selection['field'] === 'hashes') ? selection['hashes'].length : selection['ids'].length;
    let fileName: MockApi_HandleRequest_FileName = `transmission-vpn-downloads-${new Date().toISOString().slice(0, 10)}.zip`;
    if (requestedCount === 1) {
      fileName = torrentDownloadName(firstTorrent).replace(new RegExp(torrentExtensionPattern, 'u'), '.zip');
    }
    const content: MockApi_HandleRequest_Content = storedZip(finished.flatMap(mockFinishedFiles));
    const token: MockApi_HandleRequest_DownloadToken = `tvdl_mock${String(mockContentDownloads.size + 1)}`;

    mockContentDownloads.set(token, {
      content,
      fileName,
    });

    sendJSON(response, 201, {
      fileName,
      path: `/api/v1/torrents/contents/${token}`,
      size: content.length,
      unavailable: 0,
      unfinished: requestedCount - finished.length,
    });

    return true;
  }

  const contentDownloadMatch: MockApi_HandleRequest_ContentDownloadMatch = new RegExp(contentDownloadPathPattern, 'u').exec(path);
  if (contentDownloadMatch !== null && method === 'GET') {
    const download: MockApi_HandleRequest_Download = mockContentDownloads.get(contentDownloadMatch[1] ?? '');
    if (download === undefined) {
      sendError(response, 404, 'download_expired', 'This download has expired. Start it again from the torrent\'s menu.');

      return true;
    }
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Disposition': attachmentDisposition(download['fileName']),
      'Content-Length': String(download['content'].length),
      'Content-Type': 'application/zip',
    }).end(download['content']);

    return true;
  }

  if (path === '/api/v1/torrents/rename' && method === 'POST') {
    const body: MockApi_HandleRequest_Body = await readBody(request);
    const selection: MockApi_HandleRequest_TorrentSelection = readTorrentSelection(body, response);
    if (selection === undefined) {
      return true;
    }
    if (selection['items'].length !== 1) {
      sendError(response, 404, 'torrent_not_found', 'One or more torrents were not found.');

      return true;
    }
    const torrent: MockApi_HandleRequest_RenamedTorrent = selection['items'][0] as MockApi_HandleRequest_RenamedTorrent;
    if (String(body['path'] ?? '') === torrent['name']) {
      torrent.name = String(body['name'] ?? torrent['name']);
    }
    sendJSON(response, 200, {
      ...torrentMutationResponse(selection),
      path: torrent['name'],
    });

    return true;
  }

  const detailMatch: MockApi_HandleRequest_DetailMatch = path.match(new RegExp(torrentDetailPathPattern));

  if (detailMatch !== null) {
    const torrent: MockApi_HandleRequest_DetailTorrent = torrents.find((candidate) => candidate['id'] === Number(detailMatch[1]));

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
      ].map((fileIndex) => ({
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
      ].map((fileIndex) => ({
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
      peers: Array.from({ length: Math.min(torrent['peersConnected'], 6) }, (_unused, peerIndex) => ({
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
      trackerList: [
        'udp://tracker.opentrackr.org:1337/announce',
        '',
        'https://tracker.example.org/announce',
      ].join('\n'),
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
 * @returns {MockApi_MockApi_Returns}
 *
 * @since 2.0.0
 */
export const mockApi = (): MockApi_MockApi_Returns => ({
  name: 'transmission-vpn-mock-api',
  configureServer: (server) => {
    server.middlewares.use((request: MockApi_MockApi_Request, response: MockApi_MockApi_Response, next: MockApi_MockApi_Next) => {
      void handleRequest(request, response).then((handled) => {
        if (handled === false) {
          next();
        }

        return;
      });

      return;
    });

    return;
  },
});
