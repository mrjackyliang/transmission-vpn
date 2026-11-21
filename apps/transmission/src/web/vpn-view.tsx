import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ApiError,
  connectionBeingRemovedMessage,
  issueFor,
  summaryFor,
} from '@/web/api.ts';
import { ConfirmDialog } from '@/web/confirm-dialog.tsx';
import { FieldLabel } from '@/web/field-label.tsx';
import {
  formatConsoleError,
  parseVPNConnectionInput,
  providerRequiredMessage,
  validateProviderCredentials,
} from '@/web/form-validation.ts';
import { formatDate } from '@/web/format.ts';
import {
  Button,
  Icon,
  passwordManagerIgnore,
} from '@/web/primitives.tsx';
import { showToast } from '@/web/toast.ts';
import {
  formatBytes,
  formatElapsed,
} from '@/web/torrent-format.ts';
import { torrentMoveResultLabel } from '@/web/torrent-move-result.ts';
import {
  placeListedID,
  useDragReorder,
} from '@/web/use-drag-reorder.ts';
import { defaultVPNMoveConfirmation } from '@/web/vpn-default-change.ts';
import {
  credentialInput,
  describeTunnel,
  keptCredentials,
  pickTunnel,
  profileFile,
  shouldInitializeConnectionEditor,
  submittedCredentials,
  tunnelLabel,
} from '@/web/vpn-tunnels.ts';

import type {
  Web_VpnView_ConnectionEditor_ActionsRenameOnlyClass,
  Web_VpnView_ConnectionEditor_ActiveProfile,
  Web_VpnView_ConnectionEditor_ActiveProvider,
  Web_VpnView_ConnectionEditor_ActiveProviderID,
  Web_VpnView_ConnectionEditor_ActiveProviderName,
  Web_VpnView_ConnectionEditor_BuildConfiguration,
  Web_VpnView_ConnectionEditor_BuildConfiguration_Returns,
  Web_VpnView_ConnectionEditor_BusyAction,
  Web_VpnView_ConnectionEditor_BusyActionState,
  Web_VpnView_ConnectionEditor_ChangeRunning,
  Web_VpnView_ConnectionEditor_ConfigurationDirty,
  Web_VpnView_ConnectionEditor_Connection,
  Web_VpnView_ConnectionEditor_ConnectionProviderID,
  Web_VpnView_ConnectionEditor_Continent,
  Web_VpnView_ConnectionEditor_Continents,
  Web_VpnView_ConnectionEditor_ContinentState,
  Web_VpnView_ConnectionEditor_CredentialFields,
  Web_VpnView_ConnectionEditor_CredentialHelp,
  Web_VpnView_ConnectionEditor_Credentials,
  Web_VpnView_ConnectionEditor_CredentialsDirty,
  Web_VpnView_ConnectionEditor_CredentialsState,
  Web_VpnView_ConnectionEditor_CustomDNS,
  Web_VpnView_ConnectionEditor_CustomDNSState,
  Web_VpnView_ConnectionEditor_CustomFile,
  Web_VpnView_ConnectionEditor_CustomFileState,
  Web_VpnView_ConnectionEditor_DefaultPeerPort,
  Web_VpnView_ConnectionEditor_Description,
  Web_VpnView_ConnectionEditor_DnsHint,
  Web_VpnView_ConnectionEditor_DnsMode,
  Web_VpnView_ConnectionEditor_DnsModeState,
  Web_VpnView_ConnectionEditor_EndpointLabel,
  Web_VpnView_ConnectionEditor_EndpointStrategy,
  Web_VpnView_ConnectionEditor_EndpointStrategyState,
  Web_VpnView_ConnectionEditor_Error,
  Web_VpnView_ConnectionEditor_ErrorState,
  Web_VpnView_ConnectionEditor_FieldError,
  Web_VpnView_ConnectionEditor_FieldErrorState,
  Web_VpnView_ConnectionEditor_FieldIssue,
  Web_VpnView_ConnectionEditor_FilteredProfiles,
  Web_VpnView_ConnectionEditor_Firewall,
  Web_VpnView_ConnectionEditor_FirewallLabel,
  Web_VpnView_ConnectionEditor_HandleCustomFile,
  Web_VpnView_ConnectionEditor_HandleCustomFile_Event,
  Web_VpnView_ConnectionEditor_HandleCustomFile_File,
  Web_VpnView_ConnectionEditor_HandleCustomFile_Files,
  Web_VpnView_ConnectionEditor_HandleCustomFile_Returns,
  Web_VpnView_ConnectionEditor_HandshakeLabel,
  Web_VpnView_ConnectionEditor_InitializedSessionID,
  Web_VpnView_ConnectionEditor_InitializedSessionIDRef,
  Web_VpnView_ConnectionEditor_Input,
  Web_VpnView_ConnectionEditor_InterfaceLabel,
  Web_VpnView_ConnectionEditor_IsWireGuard,
  Web_VpnView_ConnectionEditor_MetadataDirty,
  Web_VpnView_ConnectionEditor_Name,
  Web_VpnView_ConnectionEditor_NameIssue,
  Web_VpnView_ConnectionEditor_NameState,
  Web_VpnView_ConnectionEditor_NextPickedTunnel,
  Web_VpnView_ConnectionEditor_NextPickedTunnelID,
  Web_VpnView_ConnectionEditor_NextProvider,
  Web_VpnView_ConnectionEditor_NextProviderID,
  Web_VpnView_ConnectionEditor_NextTunnel,
  Web_VpnView_ConnectionEditor_NextValue,
  Web_VpnView_ConnectionEditor_NormalizedDNS,
  Web_VpnView_ConnectionEditor_NormalizedSearch,
  Web_VpnView_ConnectionEditor_OnBack,
  Web_VpnView_ConnectionEditor_OnCreate,
  Web_VpnView_ConnectionEditor_OnDisconnect,
  Web_VpnView_ConnectionEditor_OnMakeDefault,
  Web_VpnView_ConnectionEditor_OnReconnect,
  Web_VpnView_ConnectionEditor_OnRefreshCatalog,
  Web_VpnView_ConnectionEditor_OnUpdate,
  Web_VpnView_ConnectionEditor_OnUploadProfile,
  Web_VpnView_ConnectionEditor_PeerPort,
  Web_VpnView_ConnectionEditor_PeerPortIssue,
  Web_VpnView_ConnectionEditor_PeerPortState,
  Web_VpnView_ConnectionEditor_PoolLabel,
  Web_VpnView_ConnectionEditor_PoolList,
  Web_VpnView_ConnectionEditor_PoolListRef,
  Web_VpnView_ConnectionEditor_PoolReorder,
  Web_VpnView_ConnectionEditor_PrimaryButtonLabel,
  Web_VpnView_ConnectionEditor_ProfileByID,
  Web_VpnView_ConnectionEditor_ProfileCountNoun,
  Web_VpnView_ConnectionEditor_ProfileEntries,
  Web_VpnView_ConnectionEditor_ProfileIDs,
  Web_VpnView_ConnectionEditor_ProfileIDsState,
  Web_VpnView_ConnectionEditor_Profiles,
  Web_VpnView_ConnectionEditor_Props,
  Web_VpnView_ConnectionEditor_Protocol,
  Web_VpnView_ConnectionEditor_ProtocolState,
  Web_VpnView_ConnectionEditor_ProtocolSuffix,
  Web_VpnView_ConnectionEditor_ProviderID,
  Web_VpnView_ConnectionEditor_ProviderIDState,
  Web_VpnView_ConnectionEditor_ProviderIssue,
  Web_VpnView_ConnectionEditor_ProviderLabel,
  Web_VpnView_ConnectionEditor_ProviderProfiles,
  Web_VpnView_ConnectionEditor_Providers,
  Web_VpnView_ConnectionEditor_ProviderSubmissionAttempted,
  Web_VpnView_ConnectionEditor_ProviderSubmissionAttemptedState,
  Web_VpnView_ConnectionEditor_RemotePort,
  Web_VpnView_ConnectionEditor_RenameOnly,
  Web_VpnView_ConnectionEditor_ReorderHintID,
  Web_VpnView_ConnectionEditor_ResetSelection,
  Web_VpnView_ConnectionEditor_ResetSelection_Returns,
  Web_VpnView_ConnectionEditor_RetryInterval,
  Web_VpnView_ConnectionEditor_RetryIntervalState,
  Web_VpnView_ConnectionEditor_Returns,
  Web_VpnView_ConnectionEditor_RunConnectionAction,
  Web_VpnView_ConnectionEditor_RunConnectionAction_Action,
  Web_VpnView_ConnectionEditor_RunConnectionAction_Returns,
  Web_VpnView_ConnectionEditor_Runtime,
  Web_VpnView_ConnectionEditor_RuntimeEndpointCount,
  Web_VpnView_ConnectionEditor_RuntimeEndpointPosition,
  Web_VpnView_ConnectionEditor_RuntimeEndpointStrategy,
  Web_VpnView_ConnectionEditor_RuntimeInterface,
  Web_VpnView_ConnectionEditor_RuntimeLabel,
  Web_VpnView_ConnectionEditor_RuntimeLastError,
  Web_VpnView_ConnectionEditor_RuntimeLastHandshakeAt,
  Web_VpnView_ConnectionEditor_RuntimeProfileID,
  Web_VpnView_ConnectionEditor_RuntimeProviderID,
  Web_VpnView_ConnectionEditor_RuntimeRemoteHost,
  Web_VpnView_ConnectionEditor_RuntimeRemotePort,
  Web_VpnView_ConnectionEditor_RuntimeState,
  Web_VpnView_ConnectionEditor_RuntimeTone,
  Web_VpnView_ConnectionEditor_RuntimeTunnel,
  Web_VpnView_ConnectionEditor_Saved,
  Web_VpnView_ConnectionEditor_SavedCredentials,
  Web_VpnView_ConnectionEditor_Search,
  Web_VpnView_ConnectionEditor_SearchState,
  Web_VpnView_ConnectionEditor_Selected,
  Web_VpnView_ConnectionEditor_SelectedP2P,
  Web_VpnView_ConnectionEditor_SelectedProfile,
  Web_VpnView_ConnectionEditor_SelectedProfiles,
  Web_VpnView_ConnectionEditor_SelectedProvider,
  Web_VpnView_ConnectionEditor_SelectedProviderName,
  Web_VpnView_ConnectionEditor_SelectedTunnel,
  Web_VpnView_ConnectionEditor_Separator,
  Web_VpnView_ConnectionEditor_SessionID,
  Web_VpnView_ConnectionEditor_SetBusyAction,
  Web_VpnView_ConnectionEditor_SetContinent,
  Web_VpnView_ConnectionEditor_SetCredentials,
  Web_VpnView_ConnectionEditor_SetCustomDNS,
  Web_VpnView_ConnectionEditor_SetCustomFile,
  Web_VpnView_ConnectionEditor_SetDNSMode,
  Web_VpnView_ConnectionEditor_SetEndpointStrategy,
  Web_VpnView_ConnectionEditor_SetError,
  Web_VpnView_ConnectionEditor_SetFieldError,
  Web_VpnView_ConnectionEditor_SetName,
  Web_VpnView_ConnectionEditor_SetPeerPort,
  Web_VpnView_ConnectionEditor_SetProfileIDs,
  Web_VpnView_ConnectionEditor_SetProtocol,
  Web_VpnView_ConnectionEditor_SetProviderID,
  Web_VpnView_ConnectionEditor_SetProviderSubmissionAttempted,
  Web_VpnView_ConnectionEditor_SetRetryInterval,
  Web_VpnView_ConnectionEditor_SetSearch,
  Web_VpnView_ConnectionEditor_SetTunnelChoice,
  Web_VpnView_ConnectionEditor_SetVisibleProfileCount,
  Web_VpnView_ConnectionEditor_Snapshot,
  Web_VpnView_ConnectionEditor_StatusIsProtected,
  Web_VpnView_ConnectionEditor_StatusIsWireGuard,
  Web_VpnView_ConnectionEditor_StrategySuffix,
  Web_VpnView_ConnectionEditor_Submit,
  Web_VpnView_ConnectionEditor_Submit_CreateInput,
  Web_VpnView_ConnectionEditor_Submit_Event,
  Web_VpnView_ConnectionEditor_Submit_Returns,
  Web_VpnView_ConnectionEditor_Submit_ShownFields,
  Web_VpnView_ConnectionEditor_Submit_UpdateInput,
  Web_VpnView_ConnectionEditor_SubmitDisabled,
  Web_VpnView_ConnectionEditor_ToggleProfile,
  Web_VpnView_ConnectionEditor_ToggleProfile_ProfileID,
  Web_VpnView_ConnectionEditor_ToggleProfile_Returns,
  Web_VpnView_ConnectionEditor_TunnelChoice,
  Web_VpnView_ConnectionEditor_TunnelChoiceState,
  Web_VpnView_ConnectionEditor_TunnelControl,
  Web_VpnView_ConnectionEditor_TunnelID,
  Web_VpnView_ConnectionEditor_TunnelLabelID,
  Web_VpnView_ConnectionEditor_UploadFile,
  Web_VpnView_ConnectionEditor_UploadHintID,
  Web_VpnView_ConnectionEditor_UploadProfile,
  Web_VpnView_ConnectionEditor_UploadProfile_FirstUploadedProfile,
  Web_VpnView_ConnectionEditor_UploadProfile_ProfileContent,
  Web_VpnView_ConnectionEditor_UploadProfile_Returns,
  Web_VpnView_ConnectionEditor_UploadProfile_UploadedNoun,
  Web_VpnView_ConnectionEditor_UploadProfile_UploadedProfiles,
  Web_VpnView_ConnectionEditor_VisibleProfileCount,
  Web_VpnView_ConnectionEditor_VisibleProfileCountState,
  Web_VpnView_ConnectionEditor_VisibleProfiles,
  Web_VpnView_ConnectionState_Connection,
  Web_VpnView_ConnectionState_LiveConnection,
  Web_VpnView_ConnectionState_Returns,
  Web_VpnView_ConnectionState_Snapshot,
  Web_VpnView_EndpointStrategy,
  Web_VpnView_EndpointStrategyDescriptions,
  Web_VpnView_MaximumCustomProfileBytes,
  Web_VpnView_MovedTorrents_Details,
  Web_VpnView_MovedTorrents_Moved,
  Web_VpnView_MovedTorrents_Returns,
  Web_VpnView_ParseDependencies_Details,
  Web_VpnView_ParseDependencies_Logins,
  Web_VpnView_ParseDependencies_Profiles,
  Web_VpnView_ParseDependencies_Returns,
  Web_VpnView_StateLabels,
  Web_VpnView_StatusReason_Returns,
  Web_VpnView_StatusReason_Runtime,
  Web_VpnView_StatusTone_Returns,
  Web_VpnView_StatusTone_State,
  Web_VpnView_VpnView_AtCapacity,
  Web_VpnView_VpnView_Capacity,
  Web_VpnView_VpnView_CapacityCpuNoun,
  Web_VpnView_VpnView_CapacityCpus,
  Web_VpnView_VpnView_CapacityDescription,
  Web_VpnView_VpnView_CapacityLimit,
  Web_VpnView_VpnView_CapacityMemoryGigabytes,
  Web_VpnView_VpnView_CloseDefaultChange,
  Web_VpnView_VpnView_CloseDefaultChange_Returns,
  Web_VpnView_VpnView_CloseMenusOnEscape,
  Web_VpnView_VpnView_CloseMenusOnEscape_Event,
  Web_VpnView_VpnView_CloseMenusOnEscape_Returns,
  Web_VpnView_VpnView_CloseMenusOutside,
  Web_VpnView_VpnView_CloseMenusOutside_Event,
  Web_VpnView_VpnView_CloseMenusOutside_Returns,
  Web_VpnView_VpnView_ConfirmDefaultChange,
  Web_VpnView_VpnView_ConfirmDefaultChange_Results,
  Web_VpnView_VpnView_ConfirmDefaultChange_Returns,
  Web_VpnView_VpnView_ConnectionExists,
  Web_VpnView_VpnView_ConnectionProvider,
  Web_VpnView_VpnView_Connections,
  Web_VpnView_VpnView_DefaultChangeBusy,
  Web_VpnView_VpnView_DefaultChangeBusyState,
  Web_VpnView_VpnView_DefaultChangeComplete,
  Web_VpnView_VpnView_DefaultChangeCompleteState,
  Web_VpnView_VpnView_DefaultChangeDialog,
  Web_VpnView_VpnView_DefaultChangeError,
  Web_VpnView_VpnView_DefaultChangeErrorState,
  Web_VpnView_VpnView_DefaultChangeHasFailures,
  Web_VpnView_VpnView_DefaultChangeMessage,
  Web_VpnView_VpnView_DefaultChangeState,
  Web_VpnView_VpnView_DefaultChangeStateState,
  Web_VpnView_VpnView_DefaultMoveResults,
  Web_VpnView_VpnView_DefaultMoveResultsState,
  Web_VpnView_VpnView_DefaultPeerPort,
  Web_VpnView_VpnView_DefaultProfile,
  Web_VpnView_VpnView_Endpoint,
  Web_VpnView_VpnView_HandledNavigationSequence,
  Web_VpnView_VpnView_HandledNavigationSequenceRef,
  Web_VpnView_VpnView_Menu,
  Web_VpnView_VpnView_MoveAndRemove,
  Web_VpnView_VpnView_MoveAndRemove_HasWarnings,
  Web_VpnView_VpnView_MoveAndRemove_Result,
  Web_VpnView_VpnView_MoveAndRemove_Returns,
  Web_VpnView_VpnView_MoveAndRemove_TargetConnection,
  Web_VpnView_VpnView_MoveAndRemove_TargetConnectionName,
  Web_VpnView_VpnView_MoveAndRemove_Warnings,
  Web_VpnView_VpnView_MoveResults,
  Web_VpnView_VpnView_MoveResultsState,
  Web_VpnView_VpnView_MoveTo,
  Web_VpnView_VpnView_MoveToState,
  Web_VpnView_VpnView_NavigationSequence,
  Web_VpnView_VpnView_NavigationTarget,
  Web_VpnView_VpnView_OnCreate,
  Web_VpnView_VpnView_OnDelete,
  Web_VpnView_VpnView_OnDisconnect,
  Web_VpnView_VpnView_OnMakeDefault,
  Web_VpnView_VpnView_OnNavigate,
  Web_VpnView_VpnView_OnOpenTorrents,
  Web_VpnView_VpnView_OnReconnect,
  Web_VpnView_VpnView_OnRefreshCatalog,
  Web_VpnView_VpnView_OnUpdate,
  Web_VpnView_VpnView_OnUploadProfile,
  Web_VpnView_VpnView_OpenNavigationTarget,
  Web_VpnView_VpnView_OpenNavigationTarget_Replace,
  Web_VpnView_VpnView_OpenNavigationTarget_Returns,
  Web_VpnView_VpnView_OpenNavigationTarget_Target,
  Web_VpnView_VpnView_Profiles,
  Web_VpnView_VpnView_Props,
  Web_VpnView_VpnView_ProviderName,
  Web_VpnView_VpnView_Providers,
  Web_VpnView_VpnView_RemovalComplete,
  Web_VpnView_VpnView_RemovalCompleteState,
  Web_VpnView_VpnView_RemoveError,
  Web_VpnView_VpnView_RemoveErrorState,
  Web_VpnView_VpnView_RemoveLoginNoun,
  Web_VpnView_VpnView_RemoveProfileNoun,
  Web_VpnView_VpnView_RemoveState,
  Web_VpnView_VpnView_RemoveStateState,
  Web_VpnView_VpnView_RemoveTorrentNoun,
  Web_VpnView_VpnView_Removing,
  Web_VpnView_VpnView_RemovingState,
  Web_VpnView_VpnView_RequestDefaultChange,
  Web_VpnView_VpnView_RequestDefaultChange_Connection,
  Web_VpnView_VpnView_RequestDefaultChange_ConnectionId,
  Web_VpnView_VpnView_RequestDefaultChange_DefaultProfileTorrentCount,
  Web_VpnView_VpnView_RequestDefaultChange_FollowingProfileTorrentCount,
  Web_VpnView_VpnView_RequestDefaultChange_Results,
  Web_VpnView_VpnView_RequestDefaultChange_Returns,
  Web_VpnView_VpnView_RequestDefaultChange_TorrentCount,
  Web_VpnView_VpnView_RequestRemove,
  Web_VpnView_VpnView_RequestRemove_Connection,
  Web_VpnView_VpnView_RequestRemove_DefaultCandidate,
  Web_VpnView_VpnView_RequestRemove_Dependencies,
  Web_VpnView_VpnView_RequestRemove_Returns,
  Web_VpnView_VpnView_Response,
  Web_VpnView_VpnView_Returns,
  Web_VpnView_VpnView_Runtime,
  Web_VpnView_VpnView_SelectedConnection,
  Web_VpnView_VpnView_SelectedID,
  Web_VpnView_VpnView_SelectedIDState,
  Web_VpnView_VpnView_SetDefaultChangeBusy,
  Web_VpnView_VpnView_SetDefaultChangeComplete,
  Web_VpnView_VpnView_SetDefaultChangeError,
  Web_VpnView_VpnView_SetDefaultChangeState,
  Web_VpnView_VpnView_SetDefaultMoveResults,
  Web_VpnView_VpnView_SetMoveResults,
  Web_VpnView_VpnView_SetMoveTo,
  Web_VpnView_VpnView_SetRemovalComplete,
  Web_VpnView_VpnView_SetRemoveError,
  Web_VpnView_VpnView_SetRemoveState,
  Web_VpnView_VpnView_SetRemoving,
  Web_VpnView_VpnView_SetSelectedID,
  Web_VpnView_VpnView_Snapshot,
  Web_VpnView_VpnView_TorrentNoun,
  Web_VpnView_VpnView_UsedPeerPorts,
} from '@/types/web/vpn-view.d.ts';

/**
 * Vpn View - Maximum Custom Profile Bytes.
 *
 * Keeps custom uploads within the same bound as the original VPN page.
 * The browser rejects oversized files before reading them into memory.
 *
 * @since 2.0.0
 */
const maximumCustomProfileBytes: Web_VpnView_MaximumCustomProfileBytes = 900_000;

/**
 * Vpn View - Endpoint Strategy Descriptions.
 *
 * Explains how the ordered pool is used after an endpoint fails.
 * The selected strategy updates the approved helper copy in place.
 *
 * @since 2.0.0
 */
const endpointStrategyDescriptions: Web_VpnView_EndpointStrategyDescriptions = {
  ordered: 'Move to the next endpoint after a connection fails.',
  randomized: 'Shuffle the endpoint order for each failover cycle.',
  sticky: 'Keep using the current endpoint until it stops working.',
};

/**
 * Vpn View - State Labels.
 *
 * Gives controller states the approved sentence-case chip text.
 * Unknown future states still fall back to their server value.
 *
 * @since 2.0.0
 */
const stateLabels: Web_VpnView_StateLabels = {
  'blocked': 'Blocked',
  'connecting': 'Connecting',
  'disconnected': 'Disconnected',
  'error': 'Error',
  'protected': 'Protected',
  'reconnecting': 'Connecting',
  'setup-required': 'Setup required',
};

/**
 * Vpn View - Connection State.
 *
 * Prefers the newest event snapshot while the durable list refresh catches up.
 * Stored runtime remains available before the first event arrives.
 *
 * @param {Web_VpnView_ConnectionState_Connection} connection - Connection.
 * @param {Web_VpnView_ConnectionState_Snapshot}   snapshot   - Snapshot.
 *
 * @returns {Web_VpnView_ConnectionState_Returns}
 *
 * @since 2.0.0
 */
const connectionState = (
  connection: Web_VpnView_ConnectionState_Connection,
  snapshot: Web_VpnView_ConnectionState_Snapshot,
): Web_VpnView_ConnectionState_Returns => {
  const liveConnection: Web_VpnView_ConnectionState_LiveConnection = (snapshot === null) ? undefined : snapshot['connections'].find(
    (candidate) => candidate['connectionId'] === connection['id'],
  );

  return liveConnection ?? connection['runtime'];
};

/**
 * Vpn View - Status Reason.
 *
 * Provides the second line beneath each state chip.
 * Controller errors take precedence over generated activity text.
 *
 * @param {Web_VpnView_StatusReason_Runtime} runtime - Runtime.
 *
 * @returns {Web_VpnView_StatusReason_Returns}
 *
 * @since 2.0.0
 */
const statusReason = (runtime: Web_VpnView_StatusReason_Runtime): Web_VpnView_StatusReason_Returns => {
  if (runtime['lastError'] !== undefined && runtime['lastError'] !== '') {
    return runtime['lastError'];
  }
  if (runtime['state'] === 'protected' && runtime['lastHandshakeAt'] !== undefined) {
    return `Handshake ${formatElapsed(runtime['lastHandshakeAt'])}`;
  }
  if (runtime['state'] === 'connecting' || runtime['state'] === 'reconnecting') {
    return `Attempt ${runtime['attempt']}`;
  }

  // OpenVPN has no handshake time, so a protected OpenVPN row has no second line.
  if (runtime['state'] === 'protected') {
    return '';
  }

  return 'Torrent traffic is blocked';
};

/**
 * Vpn View - Status Tone.
 *
 * Maps all non-protected terminal states to the blocked visual treatment.
 * Connecting states retain their progress treatment instead.
 *
 * @param {Web_VpnView_StatusTone_State} state - State.
 *
 * @returns {Web_VpnView_StatusTone_Returns}
 *
 * @since 2.0.0
 */
const statusTone = (state: Web_VpnView_StatusTone_State): Web_VpnView_StatusTone_Returns => {
  if (state === 'protected') {
    return 'protected';
  }
  if (state === 'connecting' || state === 'reconnecting') {
    return 'connecting';
  }

  return 'blocked';
};

/**
 * Vpn View - Parse Dependencies.
 *
 * Safely narrows optional error details before the remove dialog uses them.
 * Missing groups become empty lists so partial responses remain renderable.
 *
 * @param {Web_VpnView_ParseDependencies_Details} details - Details.
 *
 * @returns {Web_VpnView_ParseDependencies_Returns}
 *
 * @since 2.0.0
 */
const parseDependencies = (details: Web_VpnView_ParseDependencies_Details): Web_VpnView_ParseDependencies_Returns => ({
  logins: (Array.isArray(details['logins']) === true) ? details['logins'] as Web_VpnView_ParseDependencies_Logins : [],
  profiles: (Array.isArray(details['profiles']) === true) ? details['profiles'] as Web_VpnView_ParseDependencies_Profiles : [],
  torrents: (typeof details['torrents'] === 'number') ? details['torrents'] : 0,
});

/**
 * Vpn View - Moved Torrents.
 *
 * Extracts partial move results from a move-failed error response.
 * An absent result list is represented as an empty list.
 *
 * @param {Web_VpnView_MovedTorrents_Details} details - Details.
 *
 * @returns {Web_VpnView_MovedTorrents_Returns}
 *
 * @since 2.0.0
 */
const movedTorrents = (details: Web_VpnView_MovedTorrents_Details): Web_VpnView_MovedTorrents_Returns => (
  (Array.isArray(details['moved']) === true) ? details['moved'] as Web_VpnView_MovedTorrents_Moved : []
);

/**
 * Vpn View - Connection Editor.
 *
 * Creates a connection or updates one existing slot. Configuration changes are
 * tested and connected; name-only and peer-port-only changes save in place.
 *
 * @param {Web_VpnView_ConnectionEditor_Props} props - Props.
 *
 * @returns {Web_VpnView_ConnectionEditor_Returns}
 *
 * @since 2.0.0
 */
const ConnectionEditor = (props: Web_VpnView_ConnectionEditor_Props): Web_VpnView_ConnectionEditor_Returns => {
  const connection: Web_VpnView_ConnectionEditor_Connection = props['connection'];
  const defaultPeerPort: Web_VpnView_ConnectionEditor_DefaultPeerPort = props['defaultPeerPort'];
  const onBack: Web_VpnView_ConnectionEditor_OnBack = props['onBack'];
  const onCreate: Web_VpnView_ConnectionEditor_OnCreate = props['onCreate'];
  const onDisconnect: Web_VpnView_ConnectionEditor_OnDisconnect = props['onDisconnect'];
  const onMakeDefault: Web_VpnView_ConnectionEditor_OnMakeDefault = props['onMakeDefault'];
  const onReconnect: Web_VpnView_ConnectionEditor_OnReconnect = props['onReconnect'];
  const onRefreshCatalog: Web_VpnView_ConnectionEditor_OnRefreshCatalog = props['onRefreshCatalog'];
  const onUpdate: Web_VpnView_ConnectionEditor_OnUpdate = props['onUpdate'];
  const onUploadProfile: Web_VpnView_ConnectionEditor_OnUploadProfile = props['onUploadProfile'];
  const profiles: Web_VpnView_ConnectionEditor_Profiles = props['profiles'];
  const providers: Web_VpnView_ConnectionEditor_Providers = props['providers'];
  const snapshot: Web_VpnView_ConnectionEditor_Snapshot = props['snapshot'];
  const nameState: Web_VpnView_ConnectionEditor_NameState = useState<Web_VpnView_ConnectionEditor_Name>('');
  const name: Web_VpnView_ConnectionEditor_Name = nameState[0];
  const setName: Web_VpnView_ConnectionEditor_SetName = nameState[1];
  const peerPortState: Web_VpnView_ConnectionEditor_PeerPortState = useState<Web_VpnView_ConnectionEditor_PeerPort>('51413');
  const peerPort: Web_VpnView_ConnectionEditor_PeerPort = peerPortState[0];
  const setPeerPort: Web_VpnView_ConnectionEditor_SetPeerPort = peerPortState[1];
  const providerIDState: Web_VpnView_ConnectionEditor_ProviderIDState = useState<Web_VpnView_ConnectionEditor_ProviderID>('');
  const providerID: Web_VpnView_ConnectionEditor_ProviderID = providerIDState[0];
  const setProviderID: Web_VpnView_ConnectionEditor_SetProviderID = providerIDState[1];
  const providerSubmissionAttemptedState: Web_VpnView_ConnectionEditor_ProviderSubmissionAttemptedState = useState<Web_VpnView_ConnectionEditor_ProviderSubmissionAttempted>(false);
  const providerSubmissionAttempted: Web_VpnView_ConnectionEditor_ProviderSubmissionAttempted = providerSubmissionAttemptedState[0];
  const setProviderSubmissionAttempted: Web_VpnView_ConnectionEditor_SetProviderSubmissionAttempted = providerSubmissionAttemptedState[1];
  const tunnelChoiceState: Web_VpnView_ConnectionEditor_TunnelChoiceState = useState<Web_VpnView_ConnectionEditor_TunnelChoice>('openvpn');
  const tunnelChoice: Web_VpnView_ConnectionEditor_TunnelChoice = tunnelChoiceState[0];
  const setTunnelChoice: Web_VpnView_ConnectionEditor_SetTunnelChoice = tunnelChoiceState[1];
  const profileIDsState: Web_VpnView_ConnectionEditor_ProfileIDsState = useState<Web_VpnView_ConnectionEditor_ProfileIDs>([]);
  const profileIDs: Web_VpnView_ConnectionEditor_ProfileIDs = profileIDsState[0];
  const setProfileIDs: Web_VpnView_ConnectionEditor_SetProfileIDs = profileIDsState[1];
  const endpointStrategyState: Web_VpnView_ConnectionEditor_EndpointStrategyState = useState<Web_VpnView_ConnectionEditor_EndpointStrategy>('sticky');
  const endpointStrategy: Web_VpnView_ConnectionEditor_EndpointStrategy = endpointStrategyState[0];
  const setEndpointStrategy: Web_VpnView_ConnectionEditor_SetEndpointStrategy = endpointStrategyState[1];
  const searchState: Web_VpnView_ConnectionEditor_SearchState = useState<Web_VpnView_ConnectionEditor_Search>('');
  const search: Web_VpnView_ConnectionEditor_Search = searchState[0];
  const setSearch: Web_VpnView_ConnectionEditor_SetSearch = searchState[1];
  const continentState: Web_VpnView_ConnectionEditor_ContinentState = useState<Web_VpnView_ConnectionEditor_Continent>('all');
  const continent: Web_VpnView_ConnectionEditor_Continent = continentState[0];
  const setContinent: Web_VpnView_ConnectionEditor_SetContinent = continentState[1];
  const protocolState: Web_VpnView_ConnectionEditor_ProtocolState = useState<Web_VpnView_ConnectionEditor_Protocol>('all');
  const protocol: Web_VpnView_ConnectionEditor_Protocol = protocolState[0];
  const setProtocol: Web_VpnView_ConnectionEditor_SetProtocol = protocolState[1];
  const visibleProfileCountState: Web_VpnView_ConnectionEditor_VisibleProfileCountState = useState<Web_VpnView_ConnectionEditor_VisibleProfileCount>(100);
  const visibleProfileCount: Web_VpnView_ConnectionEditor_VisibleProfileCount = visibleProfileCountState[0];
  const setVisibleProfileCount: Web_VpnView_ConnectionEditor_SetVisibleProfileCount = visibleProfileCountState[1];
  const credentialsState: Web_VpnView_ConnectionEditor_CredentialsState = useState<Web_VpnView_ConnectionEditor_Credentials>({});
  const credentials: Web_VpnView_ConnectionEditor_Credentials = credentialsState[0];
  const setCredentials: Web_VpnView_ConnectionEditor_SetCredentials = credentialsState[1];
  const dnsModeState: Web_VpnView_ConnectionEditor_DnsModeState = useState<Web_VpnView_ConnectionEditor_DnsMode>('provider');
  const dnsMode: Web_VpnView_ConnectionEditor_DnsMode = dnsModeState[0];
  const setDNSMode: Web_VpnView_ConnectionEditor_SetDNSMode = dnsModeState[1];
  const customDNSState: Web_VpnView_ConnectionEditor_CustomDNSState = useState<Web_VpnView_ConnectionEditor_CustomDNS>('');
  const customDNS: Web_VpnView_ConnectionEditor_CustomDNS = customDNSState[0];
  const setCustomDNS: Web_VpnView_ConnectionEditor_SetCustomDNS = customDNSState[1];
  const retryIntervalState: Web_VpnView_ConnectionEditor_RetryIntervalState = useState<Web_VpnView_ConnectionEditor_RetryInterval>('10');
  const retryInterval: Web_VpnView_ConnectionEditor_RetryInterval = retryIntervalState[0];
  const setRetryInterval: Web_VpnView_ConnectionEditor_SetRetryInterval = retryIntervalState[1];
  const busyActionState: Web_VpnView_ConnectionEditor_BusyActionState = useState<Web_VpnView_ConnectionEditor_BusyAction>('');
  const busyAction: Web_VpnView_ConnectionEditor_BusyAction = busyActionState[0];
  const setBusyAction: Web_VpnView_ConnectionEditor_SetBusyAction = busyActionState[1];
  const errorState: Web_VpnView_ConnectionEditor_ErrorState = useState<Web_VpnView_ConnectionEditor_Error>('');
  const error: Web_VpnView_ConnectionEditor_Error = errorState[0];
  const setError: Web_VpnView_ConnectionEditor_SetError = errorState[1];
  const fieldErrorState: Web_VpnView_ConnectionEditor_FieldErrorState = useState<Web_VpnView_ConnectionEditor_FieldError>(null);
  const fieldError: Web_VpnView_ConnectionEditor_FieldError = fieldErrorState[0];
  const setFieldError: Web_VpnView_ConnectionEditor_SetFieldError = fieldErrorState[1];
  const customFileState: Web_VpnView_ConnectionEditor_CustomFileState = useState<Web_VpnView_ConnectionEditor_CustomFile>(null);
  const customFile: Web_VpnView_ConnectionEditor_CustomFile = customFileState[0];
  const setCustomFile: Web_VpnView_ConnectionEditor_SetCustomFile = customFileState[1];
  const tunnelLabelID: Web_VpnView_ConnectionEditor_TunnelLabelID = useId();
  const uploadHintID: Web_VpnView_ConnectionEditor_UploadHintID = useId();
  const reorderHintID: Web_VpnView_ConnectionEditor_ReorderHintID = useId();
  const initializedSessionIDRef: Web_VpnView_ConnectionEditor_InitializedSessionIDRef = useRef<Web_VpnView_ConnectionEditor_InitializedSessionID>(null);
  const poolListRef: Web_VpnView_ConnectionEditor_PoolListRef = useRef<Web_VpnView_ConnectionEditor_PoolList>(null);

  useEffect(() => {
    const sessionID: Web_VpnView_ConnectionEditor_SessionID = (connection === null) ? 'new' : connection['id'];
    if (shouldInitializeConnectionEditor(
      initializedSessionIDRef.current,
      sessionID,
      providers.length > 0,
    ) === false) {
      return;
    }
    initializedSessionIDRef.current = sessionID;

    // A new connection starts on "— Select one —", so no provider is preferred.
    const nextProviderID: Web_VpnView_ConnectionEditor_NextProviderID = (connection === null) ? '' : connection['providerId'];
    const nextProvider: Web_VpnView_ConnectionEditor_NextProvider = providers.find((provider) => provider['id'] === nextProviderID);
    const nextPickedTunnel: Web_VpnView_ConnectionEditor_NextPickedTunnel = (connection === null) ? pickTunnel(nextProvider, 'openvpn') : undefined;
    const nextPickedTunnelID: Web_VpnView_ConnectionEditor_NextPickedTunnelID = (nextPickedTunnel === undefined) ? 'openvpn' : nextPickedTunnel['id'];
    const nextTunnel: Web_VpnView_ConnectionEditor_NextTunnel = (connection === null) ? nextPickedTunnelID : connection['tunnel'];

    setName((connection === null) ? '' : connection['name']);
    setPeerPort(String((connection === null) ? defaultPeerPort : connection['peerPort']));
    setProviderID(nextProviderID);
    setProviderSubmissionAttempted(false);
    setTunnelChoice(nextTunnel);
    setProfileIDs((connection === null) ? [] : connection['profileIds']);
    setEndpointStrategy((connection === null) ? 'sticky' : connection['endpointStrategy']);
    setSearch('');
    setContinent('all');
    setProtocol('all');
    setVisibleProfileCount(100);
    setCredentials({});
    setCustomFile(null);
    setDNSMode((connection === null || connection['dnsServers'].length === 0) ? 'provider' : 'custom');
    setCustomDNS((connection === null) ? '' : connection['dnsServers'].join('\n'));
    setRetryInterval(String((connection === null) ? 10 : connection['retryIntervalSeconds']));
    setError('');
    setFieldError(null);
    setBusyAction('');

    return;
  }, [
    connection,
    defaultPeerPort,
    providers,
  ]);

  const selectedProvider: Web_VpnView_ConnectionEditor_SelectedProvider = providers.find(
    (provider) => provider['id'] === providerID,
  );
  const selectedP2P: Web_VpnView_ConnectionEditor_SelectedP2P = (selectedProvider === undefined) ? null : selectedProvider['p2p'];
  const selectedTunnel: Web_VpnView_ConnectionEditor_SelectedTunnel = pickTunnel(selectedProvider, tunnelChoice);
  const tunnelID: Web_VpnView_ConnectionEditor_TunnelID = (selectedTunnel === undefined) ? 'openvpn' : selectedTunnel['id'];
  const isWireGuard: Web_VpnView_ConnectionEditor_IsWireGuard = tunnelID === 'wireguard';
  const uploadFile: Web_VpnView_ConnectionEditor_UploadFile = profileFile(tunnelID);
  const providerProfiles: Web_VpnView_ConnectionEditor_ProviderProfiles = useMemo(() => (
    profiles.filter((profile) => profile['providerId'] === providerID && profile['tunnel'] === tunnelID)
  ), [
    profiles,
    providerID,
    tunnelID,
  ]);
  const profileByID: Web_VpnView_ConnectionEditor_ProfileByID = useMemo(() => {
    const profileEntries: Web_VpnView_ConnectionEditor_ProfileEntries = providerProfiles.map((profile) => [
      profile['id'],
      profile,
    ]);

    return new Map(profileEntries);
  }, [providerProfiles]);
  const selectedProfiles: Web_VpnView_ConnectionEditor_SelectedProfiles = profileIDs.flatMap(
    (profileID) => {
      const selectedProfile: Web_VpnView_ConnectionEditor_SelectedProfile = profileByID.get(profileID);

      return (selectedProfile === undefined) ? [] : [selectedProfile];
    },
  );

  // The fallback order is part of the form, so each move only changes the draft.
  const poolReorder: Web_VpnView_ConnectionEditor_PoolReorder = useDragReorder(poolListRef, (profileID, destinationIndex) => {
    setProfileIDs((currentProfileIDs) => placeListedID(currentProfileIDs, profileByID, profileID, destinationIndex));

    return;
  });
  const continents: Web_VpnView_ConnectionEditor_Continents = useMemo(() => {
    return [...new Set(providerProfiles
      .map((profile) => profile['continent'])
      .filter((value) => value !== ''))]
      .sort((left, right) => left.localeCompare(right));
  }, [providerProfiles]);
  const filteredProfiles: Web_VpnView_ConnectionEditor_FilteredProfiles = useMemo(() => {
    const normalizedSearch: Web_VpnView_ConnectionEditor_NormalizedSearch = search.trim().toLocaleLowerCase();

    return providerProfiles.filter((profile) => {
      if (continent !== 'all' && profile['continent'] !== continent) {
        return false;
      }
      if (protocol !== 'all' && profile['protocol'] !== protocol) {
        return false;
      }
      if (normalizedSearch === '') {
        return true;
      }

      return [
        profile['displayName'],
        profile['country'],
        profile['city'],
        profile['remoteHost'],
      ].some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
    });
  }, [
    continent,
    protocol,
    providerProfiles,
    search,
  ]);
  const visibleProfiles: Web_VpnView_ConnectionEditor_VisibleProfiles = filteredProfiles.slice(0, visibleProfileCount);
  const credentialFields: Web_VpnView_ConnectionEditor_CredentialFields = (selectedTunnel === undefined) ? [] : selectedTunnel['credentialFields'];
  let savedCredentials: Web_VpnView_ConnectionEditor_SavedCredentials = [];
  if (
    connection !== null
    && providerID === connection['providerId']
    && tunnelID === connection['tunnel']
  ) {
    savedCredentials = connection['savedCredentials'];
  }
  const nameIssue: Web_VpnView_ConnectionEditor_NameIssue = issueFor(fieldError, 'name');
  const peerPortIssue: Web_VpnView_ConnectionEditor_PeerPortIssue = issueFor(fieldError, 'peerPort');
  let providerIssue: Web_VpnView_ConnectionEditor_ProviderIssue = issueFor(fieldError, 'providerId');
  if (providerIssue === '') {
    providerIssue = issueFor(fieldError, 'configuration.providerId');
  }
  if (
    providerIssue === ''
    && providerSubmissionAttempted === true
    && providerID === ''
  ) {
    providerIssue = providerRequiredMessage;
  }
  const runtime: Web_VpnView_ConnectionEditor_Runtime = (connection === null) ? undefined : connectionState(connection, snapshot);
  const runtimeState: Web_VpnView_ConnectionEditor_RuntimeState = (runtime === undefined) ? undefined : runtime['state'];
  const runtimeProviderID: Web_VpnView_ConnectionEditor_RuntimeProviderID = (runtime === undefined) ? undefined : runtime['providerId'];
  const runtimeProfileID: Web_VpnView_ConnectionEditor_RuntimeProfileID = (runtime === undefined) ? undefined : runtime['profileId'];
  const runtimeTunnel: Web_VpnView_ConnectionEditor_RuntimeTunnel = (runtime === undefined) ? undefined : runtime['tunnel'];
  const runtimeInterface: Web_VpnView_ConnectionEditor_RuntimeInterface = (runtime === undefined) ? undefined : runtime['interface'];
  const runtimeLastHandshakeAt: Web_VpnView_ConnectionEditor_RuntimeLastHandshakeAt = (runtime === undefined) ? undefined : runtime['lastHandshakeAt'];
  const runtimeRemoteHost: Web_VpnView_ConnectionEditor_RuntimeRemoteHost = (runtime === undefined) ? undefined : runtime['remoteHost'];
  const runtimeRemotePort: Web_VpnView_ConnectionEditor_RuntimeRemotePort = (runtime === undefined) ? undefined : runtime['remotePort'];
  const runtimeEndpointStrategy: Web_VpnView_ConnectionEditor_RuntimeEndpointStrategy = (runtime === undefined) ? undefined : runtime['endpointStrategy'];
  const runtimeEndpointCount: Web_VpnView_ConnectionEditor_RuntimeEndpointCount = (runtime === undefined) ? undefined : runtime['endpointCount'];
  const runtimeEndpointPosition: Web_VpnView_ConnectionEditor_RuntimeEndpointPosition = (runtime === undefined) ? undefined : runtime['endpointPosition'];
  const runtimeLastError: Web_VpnView_ConnectionEditor_RuntimeLastError = (runtime === undefined) ? undefined : runtime['lastError'];
  const connectionProviderID: Web_VpnView_ConnectionEditor_ConnectionProviderID = (connection === null) ? undefined : connection['providerId'];
  const activeProviderID: Web_VpnView_ConnectionEditor_ActiveProviderID = runtimeProviderID ?? connectionProviderID;
  const activeProvider: Web_VpnView_ConnectionEditor_ActiveProvider = providers.find(
    (provider) => provider['id'] === activeProviderID,
  );
  const activeProfile: Web_VpnView_ConnectionEditor_ActiveProfile = profiles.find(
    (profile) => profile['id'] === runtimeProfileID,
  );
  const activeProviderName: Web_VpnView_ConnectionEditor_ActiveProviderName = (activeProvider === undefined) ? undefined : activeProvider['displayName'];
  const selectedProviderName: Web_VpnView_ConnectionEditor_SelectedProviderName = (selectedProvider === undefined) ? undefined : selectedProvider['displayName'];
  const providerLabel: Web_VpnView_ConnectionEditor_ProviderLabel = (
    activeProviderName
    ?? selectedProviderName
    ?? '—'
  );
  const firewall: Web_VpnView_ConnectionEditor_Firewall = (snapshot === null || snapshot['status'] === undefined) ? undefined : snapshot['status']['runtime']['firewall'];
  const runtimeTone: Web_VpnView_ConnectionEditor_RuntimeTone = (runtime === undefined) ? 'blocked' : statusTone(runtime['state']);
  const runtimeLabel: Web_VpnView_ConnectionEditor_RuntimeLabel = (runtime === undefined) ? 'Not connected' : stateLabels[runtime['state']] ?? runtime['state'];
  const statusIsProtected: Web_VpnView_ConnectionEditor_StatusIsProtected = runtimeState === 'protected';
  const statusIsWireGuard: Web_VpnView_ConnectionEditor_StatusIsWireGuard = (runtimeTunnel ?? tunnelID) === 'wireguard';
  const interfaceLabel: Web_VpnView_ConnectionEditor_InterfaceLabel = (statusIsProtected === true) ? runtimeInterface ?? '—' : '—';
  const handshakeLabel: Web_VpnView_ConnectionEditor_HandshakeLabel = (statusIsProtected === true && runtimeLastHandshakeAt !== undefined) ? formatElapsed(runtimeLastHandshakeAt) : '—';
  const remotePort: Web_VpnView_ConnectionEditor_RemotePort = (runtimeRemotePort === undefined) ? '' : `:${runtimeRemotePort}`;
  const protocolSuffix: Web_VpnView_ConnectionEditor_ProtocolSuffix = (activeProfile === undefined || statusIsWireGuard === true) ? '' : ` (${activeProfile['protocol']})`;
  let endpointLabel: Web_VpnView_ConnectionEditor_EndpointLabel = '—';
  if (connection === null) {
    endpointLabel = 'Not tested';
  }
  if (runtimeRemoteHost !== undefined) {
    endpointLabel = `${runtimeRemoteHost}${remotePort}${protocolSuffix}`;
  }
  const strategySuffix: Web_VpnView_ConnectionEditor_StrategySuffix = (runtimeEndpointStrategy === undefined) ? '' : `, ${runtimeEndpointStrategy}`;
  const profileCountNoun: Web_VpnView_ConnectionEditor_ProfileCountNoun = (profileIDs.length === 1) ? 'endpoint' : 'endpoints';
  const poolLabel: Web_VpnView_ConnectionEditor_PoolLabel = (runtimeEndpointCount === undefined) ? `${profileIDs.length} ${profileCountNoun}` : `${runtimeEndpointPosition ?? 1} of ${runtimeEndpointCount}${strategySuffix}`;
  let firewallLabel: Web_VpnView_ConnectionEditor_FirewallLabel = '—';
  if (connection === null) {
    firewallLabel = 'Ready';
  } else if (firewall !== undefined) {
    // Plain words for the firewall's two states. Its iptables variant stays in the health API.
    firewallLabel = (firewall['state'] === 'protected') ? 'Tunnel only' : 'Blocked';
  }
  let normalizedDNS: Web_VpnView_ConnectionEditor_NormalizedDNS = [];
  if (dnsMode === 'custom') {
    normalizedDNS = customDNS
      .split('\n')
      .map((server) => server.trim())
      .filter((server) => server !== '');
  }
  const credentialsDirty: Web_VpnView_ConnectionEditor_CredentialsDirty = Object.values(credentials).some((value) => value.trim() !== '');
  const configurationDirty: Web_VpnView_ConnectionEditor_ConfigurationDirty = connection === null
    || providerID !== connection['providerId']
    || tunnelID !== connection['tunnel']
    || endpointStrategy !== connection['endpointStrategy']
    || retryInterval !== String(connection['retryIntervalSeconds'])
    || normalizedDNS.join('\n') !== connection['dnsServers'].join('\n')
    || profileIDs.join('|') !== connection['profileIds'].join('|')
    || credentialsDirty;
  const metadataDirty: Web_VpnView_ConnectionEditor_MetadataDirty = (
    connection !== null
    && (
      name.trim() !== connection['name']
      || Number(peerPort) !== connection['peerPort']
    )
  );
  const renameOnly: Web_VpnView_ConnectionEditor_RenameOnly = (
    connection !== null
    && metadataDirty === true
    && configurationDirty === false
  );
  const changeRunning: Web_VpnView_ConnectionEditor_ChangeRunning = connection !== null && connection['changeRunning'] === true;

  // Every Transmission looks trackers up through the default connection, so say whose DNS answers.
  let dnsHint: Web_VpnView_ConnectionEditor_DnsHint = 'Web proxy logins on this connection use these servers. Tracker lookups for every connection use the default connection\'s DNS.';
  if (connection !== null && connection['default'] === true) {
    dnsHint = 'This is the default connection, so these servers answer the tracker lookups of every connection, plus this connection\'s web proxy logins.';
  } else if (connection !== null) {
    dnsHint = 'Only this connection\'s web proxy logins use these servers. Tracker lookups for every connection use the default connection\'s DNS.';
  }

  /**
   * Vpn View - Reset Selection.
   *
   * Clears endpoint-specific state after a provider or tunnel change.
   * Filters and credentials cannot carry across different catalogs.
   *
   * @returns {Web_VpnView_ConnectionEditor_ResetSelection_Returns}
   *
   * @since 2.0.0
   */
  const resetSelection: Web_VpnView_ConnectionEditor_ResetSelection = (): Web_VpnView_ConnectionEditor_ResetSelection_Returns => {
    setProfileIDs([]);
    setSearch('');
    setContinent('all');
    setProtocol('all');
    setVisibleProfileCount(100);
    setCredentials({});
    setCustomFile(null);
    setError('');
    setFieldError(null);
    setProviderSubmissionAttempted(false);

    return;
  };

  /**
   * Vpn View - Toggle Profile.
   *
   * Adds or removes one endpoint while preserving the pool order.
   * The same handler serves the browser and fallback list controls.
   *
   * @param {Web_VpnView_ConnectionEditor_ToggleProfile_ProfileID} profileID - Profile i d.
   *
   * @returns {Web_VpnView_ConnectionEditor_ToggleProfile_Returns}
   *
   * @since 2.0.0
   */
  const toggleProfile: Web_VpnView_ConnectionEditor_ToggleProfile = (profileID: Web_VpnView_ConnectionEditor_ToggleProfile_ProfileID): Web_VpnView_ConnectionEditor_ToggleProfile_Returns => {
    if (profileIDs.includes(profileID) === false && profileIDs.length >= 128) {
      showToast('An endpoint pool can contain up to 128 profiles.', false);

      return;
    }

    setProfileIDs((currentProfileIDs) => (
      (currentProfileIDs.includes(profileID) === true) ? currentProfileIDs.filter((currentProfileID) => currentProfileID !== profileID) : [
        ...currentProfileIDs,
        profileID,
      ]
    ));

    return;
  };

  /**
   * Vpn View - Build Configuration.
   *
   * Normalizes the form into the exact create/update configuration body.
   * Metadata remains outside this object for rename-only saves.
   *
   * @returns {Web_VpnView_ConnectionEditor_BuildConfiguration_Returns}
   *
   * @since 2.0.0
   */
  const buildConfiguration: Web_VpnView_ConnectionEditor_BuildConfiguration = (): Web_VpnView_ConnectionEditor_BuildConfiguration_Returns => ({
    credentials: submittedCredentials(credentialFields, credentials),
    ...parseVPNConnectionInput({
      dnsServers: normalizedDNS,
      retryIntervalSeconds: Number(retryInterval),
    }),
    endpointStrategy,
    profileIds: profileIDs,
    providerId: providerID,
    tunnel: tunnelID,
  });

  /**
   * Vpn View - Submit.
   *
   * Omits configuration for metadata-only saves so the VPN stays connected.
   * New and configuration-changing submissions retain the test workflow.
   *
   * @param {Web_VpnView_ConnectionEditor_Submit_Event} event - Event.
   *
   * @returns {Web_VpnView_ConnectionEditor_Submit_Returns}
   *
   * @since 2.0.0
   */
  const submit: Web_VpnView_ConnectionEditor_Submit = async (event: Web_VpnView_ConnectionEditor_Submit_Event): Web_VpnView_ConnectionEditor_Submit_Returns => {
    event.preventDefault();

    setProviderSubmissionAttempted(true);
    if (providerID === '') {
      setError('');
      setFieldError(null);

      return;
    }
    setBusyAction('save');
    setError('');
    setFieldError(null);
    try {
      if (renameOnly === false) {
        validateProviderCredentials(selectedTunnel, credentials, savedCredentials);
      }

      if (connection === null) {
        const createInput: Web_VpnView_ConnectionEditor_Submit_CreateInput = {
          ...buildConfiguration(),
          name: name.trim(),
          peerPort: Number(peerPort),
        };

        await onCreate(createInput);
      } else {
        const updateInput: Web_VpnView_ConnectionEditor_Submit_UpdateInput = {
          expectedRevision: connection['revision'],
          ...((name.trim() === connection['name']) ? {} : { name: name.trim() }),
          ...((Number(peerPort) === connection['peerPort']) ? {} : { peerPort: Number(peerPort) }),
          ...((renameOnly === true) ? {} : { configuration: buildConfiguration() }),
        };

        await onUpdate(connection['id'], updateInput);
      }

      setCredentials((currentCredentials) => keptCredentials(credentialFields, currentCredentials));
      showToast((renameOnly === true) ? 'Connection saved.' : 'VPN connected.', true);
      onBack();
    } catch (caughtError) {
      const shownFields: Web_VpnView_ConnectionEditor_Submit_ShownFields = [
        'name',
        'peerPort',
        'providerId',
        'configuration.providerId',
      ];

      for (const field of credentialFields) {
        shownFields.push(`credentials.${field['key']}`);
        shownFields.push(`configuration.credentials.${field['key']}`);
      }

      setFieldError((caughtError instanceof ApiError) ? caughtError : null);
      setError(summaryFor(caughtError, shownFields, 'The connection could not be saved.'));
    } finally {
      setBusyAction('');
    }

    return;
  };

  /**
   * Vpn View - Run Connection Action.
   *
   * Shares busy and error handling across the three row-level mutations.
   * Each action remains scoped to the open connection identifier.
   *
   * @param {Web_VpnView_ConnectionEditor_RunConnectionAction_Action} action - Action.
   *
   * @returns {Web_VpnView_ConnectionEditor_RunConnectionAction_Returns}
   *
   * @since 2.0.0
   */
  const runConnectionAction: Web_VpnView_ConnectionEditor_RunConnectionAction = async (action: Web_VpnView_ConnectionEditor_RunConnectionAction_Action): Web_VpnView_ConnectionEditor_RunConnectionAction_Returns => {
    if (connection === null) {
      return;
    }
    setBusyAction(action);
    setError('');
    setFieldError(null);
    try {
      if (action === 'default') {
        await onMakeDefault(connection['id']);
      } else if (action === 'disconnect') {
        await onDisconnect(connection['id']);
        showToast('VPN disconnected. Torrent traffic is blocked.', true);
      } else {
        await onReconnect(connection['id']);
        showToast('VPN reconnect started.', true);
      }
    } catch (caughtError) {
      setError((caughtError instanceof Error) ? caughtError.message : 'The VPN action could not be completed.');
    } finally {
      setBusyAction('');
    }

    return;
  };

  /**
   * Vpn View - Handle Custom File.
   *
   * Stores the selected profile until the user uploads it.
   * File content remains local until the explicit upload action.
   *
   * @param {Web_VpnView_ConnectionEditor_HandleCustomFile_Event} event - Event.
   *
   * @returns {Web_VpnView_ConnectionEditor_HandleCustomFile_Returns}
   *
   * @since 2.0.0
   */
  const handleCustomFile: Web_VpnView_ConnectionEditor_HandleCustomFile = (event: Web_VpnView_ConnectionEditor_HandleCustomFile_Event): Web_VpnView_ConnectionEditor_HandleCustomFile_Returns => {
    const files: Web_VpnView_ConnectionEditor_HandleCustomFile_Files = event.currentTarget.files;
    const file: Web_VpnView_ConnectionEditor_HandleCustomFile_File = (files === null) ? undefined : files[0];

    setCustomFile(file ?? null);

    return;
  };

  /**
   * Vpn View - Upload Profile.
   *
   * Validates the browser-side size bound before reading the file.
   * A successful upload becomes the only selected custom endpoint.
   *
   * @returns {Web_VpnView_ConnectionEditor_UploadProfile_Returns}
   *
   * @since 2.0.0
   */
  const uploadProfile: Web_VpnView_ConnectionEditor_UploadProfile = async (): Web_VpnView_ConnectionEditor_UploadProfile_Returns => {
    if (customFile === null) {
      showToast(`Choose a ${uploadFile['label']} first.`, false);

      return;
    }
    if (customFile.size === 0 || customFile.size > maximumCustomProfileBytes) {
      showToast(`Choose a non-empty ${uploadFile['label']} smaller than 900 KB.`, false);

      return;
    }

    setBusyAction('upload');
    try {
      const profileContent: Web_VpnView_ConnectionEditor_UploadProfile_ProfileContent = await customFile.text();
      const uploadedProfiles: Web_VpnView_ConnectionEditor_UploadProfile_UploadedProfiles = await onUploadProfile(tunnelID, customFile.name, profileContent);
      const firstUploadedProfile: Web_VpnView_ConnectionEditor_UploadProfile_FirstUploadedProfile = uploadedProfiles[0];
      const uploadedNoun: Web_VpnView_ConnectionEditor_UploadProfile_UploadedNoun = (uploadedProfiles.length === 1) ? 'endpoint' : 'endpoints';

      setProviderID('custom');
      setTunnelChoice((firstUploadedProfile === undefined) ? tunnelID : firstUploadedProfile['tunnel']);
      setProfileIDs(uploadedProfiles.map((profile) => profile['id']));
      setCustomFile(null);
      showToast(`${String(uploadedProfiles.length)} VPN ${uploadedNoun} uploaded.`, true);
    } catch (caughtError) {
      setError((caughtError instanceof Error) ? caughtError.message : 'The profile could not be uploaded.');
    } finally {
      setBusyAction('');
    }

    return;
  };

  let tunnelControl: Web_VpnView_ConnectionEditor_TunnelControl = null;
  if (selectedProvider !== undefined && selectedProvider['tunnels'].length > 1) {
    tunnelControl = (
      <div aria-labelledby={tunnelLabelID} className="field tunnel-field" role="group">
        <span id={tunnelLabelID}>Tunnel</span>
        <div className="segmented">
          {selectedProvider['tunnels'].map((tunnel) => (
            <button
              aria-pressed={tunnel['id'] === tunnelID}
              key={tunnel['id']}
              onClick={() => {
                if (tunnel['id'] === tunnelID) {
                  return;
                }

                setTunnelChoice(tunnel['id']);
                resetSelection();

                return;
              }}
              type="button"
            >
              {tunnelLabel(tunnel['id'])}
            </button>
          ))}
        </div>
      </div>
    );
  } else if (selectedTunnel !== undefined) {
    tunnelControl = (
      <div className="field tunnel-field">
        <span>Tunnel</span>
        <p className="tunnel-fixed">{tunnelLabel(tunnelID)}</p>
      </div>
    );
  }

  let primaryButtonLabel: Web_VpnView_ConnectionEditor_PrimaryButtonLabel = (renameOnly === true) ? 'Save' : 'Test and connect';
  if (busyAction === 'save') {
    primaryButtonLabel = (renameOnly === true) ? 'Saving…' : 'Testing…';
  }

  const actionsRenameOnlyClass: Web_VpnView_ConnectionEditor_ActionsRenameOnlyClass = (renameOnly === true) ? ' vpn-actions-rename-only' : '';
  const submitDisabled: Web_VpnView_ConnectionEditor_SubmitDisabled = (
    busyAction !== ''
    || changeRunning
    || name.trim() === ''
    || providerID === ''
    || profileIDs.length === 0
  );

  return (
    <section className="workspace-section vpn-workspace vpn-editor-page">
      <button className="vpn-back-link" onClick={onBack} type="button">
        <Icon name="chevron" size={15} />
        All connections
      </button>
      <header className="vpn-editor-heading">
        <span className="vpn-title-line">
          <h1>{(connection === null) ? 'New connection' : connection['name']}</h1>
          {(connection !== null && connection['default'] === true) ? <span className="tag vpn-default-tag">Default</span> : null}
        </span>
        {(connection === null || connection['default'] === true) ? null : (
          <Button
            disabled={busyAction !== ''}
            icon="shield"
            onClick={() => {
              void runConnectionAction('default');

              return;
            }}
          >
            Make default
          </Button>
        )}
      </header>

      {(connection === null) ? null : (
        <dl aria-label="Connection details" className="details">
          <div>
            <dt>Status</dt>
            <dd className={`details-status-${runtimeTone}`}>
              <span className="status-dot" />
              {runtimeLabel}
            </dd>
          </div>
          <div>
            <dt>Tunnel</dt>
            <dd>{(runtime === undefined) ? tunnelLabel(tunnelID) : describeTunnel(runtime)}</dd>
          </div>
          <div>
            <dt>Interface</dt>
            <dd>{interfaceLabel}</dd>
          </div>
          <div>
            <dt>Provider</dt>
            <dd>{providerLabel}</dd>
          </div>
          <div>
            <dt>Endpoint</dt>
            <dd title={endpointLabel}>{endpointLabel}</dd>
          </div>
          {(statusIsWireGuard === true) ? (
            <div>
              <dt>Last handshake</dt>
              <dd>{handshakeLabel}</dd>
            </div>
          ) : null}
          <div>
            <dt>Pool</dt>
            <dd>{poolLabel}</dd>
          </div>
          <div>
            <dt>Firewall</dt>
            <dd>{firewallLabel}</dd>
          </div>
          <div>
            <dt>State since</dt>
            <dd>{(runtime === undefined) ? '—' : formatDate(runtime['transitionedAt'])}</dd>
          </div>
          {(runtime !== undefined && runtime['attempt'] > 1) ? (
            <div>
              <dt>Attempt</dt>
              <dd>{runtime['attempt']}</dd>
            </div>
          ) : null}
        </dl>
      )}

      {(
        connection === null
        || runtimeLastError === undefined
        || runtimeLastError === ''
      ) ? null : (
          <div className="form-error">
            <strong>Connection error</strong>
            {formatConsoleError(runtimeLastError)}
          </div>
        )}

      <form className="panel vpn-connection-form" noValidate onSubmit={submit}>
        <section className="form-section">
          <div className="form-section-head">
            <h2>Provider</h2>
            <span>{`${profileIDs.length} ${profileCountNoun} selected`}</span>
          </div>
          <div className="field-row">
            <FieldLabel>
              <span>Provider</span>
              <select
                aria-invalid={providerIssue !== ''}
                onChange={(event) => {
                  const nextProviderID: Web_VpnView_ConnectionEditor_NextProviderID = event.currentTarget.value;
                  const nextProvider: Web_VpnView_ConnectionEditor_NextProvider = providers.find((provider) => provider['id'] === nextProviderID);
                  const nextPickedTunnel: Web_VpnView_ConnectionEditor_NextPickedTunnel = pickTunnel(nextProvider, 'openvpn');

                  setProviderID(nextProviderID);
                  setTunnelChoice((nextPickedTunnel === undefined) ? 'openvpn' : nextPickedTunnel['id']);
                  resetSelection();

                  return;
                }}
                value={providerID}
              >
                <option className="select-placeholder" value="">— Select one —</option>
                {providers.map((provider) => (
                  <option key={provider['id']} value={provider['id']}>{provider['displayName']}</option>
                ))}
              </select>
              {(providerIssue === '') ? null : <small className="field-error">{providerIssue}</small>}
            </FieldLabel>

            {tunnelControl}
          </div>

          {(selectedTunnel !== undefined && selectedTunnel['supportsCatalogRefresh'] === true) ? (
            <div className="inline-meta">
              <span>{(selectedTunnel['catalog'] === undefined) ? 'Endpoint list not downloaded yet' : `${selectedTunnel['catalog']['endpointCount']} endpoints · updated ${formatDate(selectedTunnel['catalog']['refreshedAt'])}`}</span>
              <button
                className="text-button"
                disabled={busyAction !== ''}
                onClick={() => {
                  setBusyAction('catalog refresh');
                  void onRefreshCatalog(providerID, tunnelID).then(() => {
                    showToast('Endpoint list refreshed.', true);

                    return;
                  }).catch((caughtError) => {
                    setError((caughtError instanceof Error) ? caughtError.message : 'The endpoint list could not be refreshed.');

                    return;
                  }).finally(() => setBusyAction(''));

                  return;
                }}
                type="button"
              >
                {(busyAction === 'catalog refresh') ? 'Refreshing…' : 'Refresh list'}
              </button>
            </div>
          ) : null}

          {(selectedTunnel !== undefined && selectedTunnel['supportsProfileUpload'] === true) ? (
            <div className="upload-row">
              <label className="file-drop file-drop-compact">
                <Icon name="upload" size={20} />
                <strong>{(customFile === null) ? uploadFile['prompt'] : customFile.name}</strong>
                <span>{(customFile === null) ? 'or drop it here' : formatBytes(customFile.size)}</span>
                <input accept={uploadFile['accept']} aria-describedby={(isWireGuard === true) ? uploadHintID : undefined} onChange={handleCustomFile} type="file" />
              </label>
              {(isWireGuard === true) ? (
                <p className="form-section-note" id={uploadHintID}>The file must include its private key, one peer, and no PostUp/PreDown lines.</p>
              ) : null}
              <Button
                disabled={busyAction !== '' || customFile === null}
                onClick={() => {
                  void uploadProfile();

                  return;
                }}
              >
                Upload profile
              </Button>
            </div>
          ) : null}
        </section>

        <section className="form-section" hidden={providerID === ''}>
          <div className="form-section-head">
            <h2>Endpoints</h2>
            <span>{`${profileIDs.length} selected · ${filteredProfiles.length} shown`}</span>
          </div>

          {(selectedP2P === null) ? null : (
            <p className={(selectedP2P['restricted'] === true) ? 'p2p-note p2p-note-restricted' : 'p2p-note'}>
              <Icon name={(selectedP2P['restricted'] === true) ? 'warning' : 'torrent'} size={15} />
              <span>
                {selectedP2P['note']}
                {' '}
                <a href={selectedP2P['url']} rel="noreferrer" target="_blank">{selectedP2P['linkLabel']}</a>
              </span>
            </p>
          )}

          <div className={(isWireGuard === true) ? 'endpoint-filters endpoint-filters-no-protocol' : 'endpoint-filters'}>
            <label className="search-field">
              <Icon name="search" size={16} />
              <span className="visually-hidden">Search endpoints</span>
              <input
                onChange={(event) => {
                  setSearch(event.currentTarget.value);
                  setVisibleProfileCount(100);

                  return;
                }}
                placeholder="Search city, country or server"
                type="search"
                value={search}
              />
            </label>
            <select
              aria-label="Filter endpoints by continent"
              className="select-control"
              onChange={(event) => {
                setContinent(event.currentTarget.value);
                setVisibleProfileCount(100);

                return;
              }}
              value={continent}
            >
              <option value="all">All continents</option>
              {continents.map((continentName) => (
                <option key={continentName} value={continentName}>{continentName}</option>
              ))}
            </select>
            {(isWireGuard === true) ? null : (
              <select
                aria-label="Filter endpoints by protocol"
                className="select-control"
                onChange={(event) => {
                  setProtocol(event.currentTarget.value);
                  setVisibleProfileCount(100);

                  return;
                }}
                value={protocol}
              >
                <option value="all">UDP and TCP</option>
                <option value="udp">UDP</option>
                <option value="tcp">TCP</option>
              </select>
            )}
          </div>

          <div className="select-list">
            {(visibleProfiles.length === 0) ? (
              <p className="select-list-empty">No endpoints match these filters.</p>
            ) : visibleProfiles.map((profile) => {
              const selected: Web_VpnView_ConnectionEditor_Selected = profileIDs.includes(profile['id']);

              return (
                <label className="select-list-row" key={profile['id']}>
                  <input checked={selected} onChange={() => toggleProfile(profile['id'])} type="checkbox" />
                  <span className="select-list-main">
                    <span>{profile['displayName']}</span>
                    <small className="mono">{`${profile['remoteHost']}:${profile['remotePort']}`}</small>
                  </span>
                  <span className="tag">{(isWireGuard === true) ? 'WireGuard' : profile['protocol'].toUpperCase()}</span>
                </label>
              );
            })}
          </div>
          {(visibleProfiles.length >= filteredProfiles.length) ? null : (
            <button className="text-button" onClick={() => setVisibleProfileCount((count) => count + 100)} type="button">Show 100 more</button>
          )}
        </section>

        <section className="form-section" hidden={providerID === ''}>
          <div className="form-section-head">
            <h2>Fallback order</h2>
            <select
              aria-label="Fallback strategy"
              className="select-control"
              onChange={(event) => setEndpointStrategy(event.currentTarget.value as Web_VpnView_EndpointStrategy)}
              value={endpointStrategy}
            >
              <option value="sticky">Sticky</option>
              <option value="ordered">Ordered</option>
              <option value="randomized">Randomized</option>
            </select>
          </div>
          <p className="form-section-note">{endpointStrategyDescriptions[endpointStrategy]}</p>
          {(selectedProfiles.length === 0) ? (
            <p className="select-list-empty select-list">Pick endpoints above. The first one is used first.</p>
          ) : (
            <>
              <ol className={(poolReorder['draggingID'] === null) ? 'select-list pool-list' : 'select-list pool-list reordering'} ref={poolListRef}>
                {selectedProfiles.map((profile, profileIndex) => (
                  <li className={(poolReorder['draggingID'] === profile['id']) ? 'select-list-row reorder-dragging' : 'select-list-row'} data-reorder-id={profile['id']} key={profile['id']}>
                    <button
                      aria-describedby={reorderHintID}
                      aria-label={`Reorder ${profile['displayName']}`}
                      className="icon-button reorder-handle"
                      onKeyDown={(event) => poolReorder.handleKeyDown(event, profile['id'], profileIndex, selectedProfiles.length, profile['displayName'])}
                      onPointerDown={(event) => poolReorder.handlePointerDown(event, profile['id'])}
                      title="Drag to reorder"
                      type="button"
                    >
                      <Icon name="grip" size={15} />
                    </button>
                    <span className="pool-position">{profileIndex + 1}</span>
                    <span className="select-list-main">
                      <span>{profile['displayName']}</span>
                      <small className="mono">{(isWireGuard === true) ? `${profile['remoteHost']}:${profile['remotePort']}` : `${profile['remoteHost']}:${profile['remotePort']} · ${profile['protocol'].toUpperCase()}`}</small>
                    </span>
                    <span className="pool-actions">
                      <button aria-label={`Remove ${profile['displayName']}`} className="icon-button" onClick={() => toggleProfile(profile['id'])} title="Remove" type="button"><Icon name="x" size={15} /></button>
                    </span>
                  </li>
                ))}
              </ol>
              <span className="visually-hidden" id={reorderHintID}>Drag, or press the up and down arrow keys, to change the order.</span>
              <p aria-live="polite" className="visually-hidden">{poolReorder['announcement']}</p>
            </>
          )}
        </section>

        <div className="vpn-lower-grid" hidden={providerID === ''}>
          <section className="form-section">
            <div className="form-section-head"><h2>Sign-in</h2></div>
            {(credentialFields.length === 0) ? (
              <p className="form-section-note">{(isWireGuard === true) ? 'This file includes its own key.' : 'This profile includes its own credentials.'}</p>
            ) : (
              <div className="field-row">
                {credentialFields.map((field) => {
                  const saved: Web_VpnView_ConnectionEditor_Saved = savedCredentials.includes(field['key']);
                  const input: Web_VpnView_ConnectionEditor_Input = credentialInput(field, saved);
                  let description: Web_VpnView_ConnectionEditor_Description = field['description'];
                  if (saved === true) {
                    const separator: Web_VpnView_ConnectionEditor_Separator = (description === '') ? '' : ' ';

                    description = `${description}${separator}Saved. Leave empty to keep it.`;
                  }
                  let fieldIssue: Web_VpnView_ConnectionEditor_FieldIssue = issueFor(fieldError, `configuration.credentials.${field['key']}`);
                  if (fieldIssue === '') {
                    fieldIssue = issueFor(fieldError, `credentials.${field['key']}`);
                  }
                  let credentialHelp: Web_VpnView_ConnectionEditor_CredentialHelp = null;
                  if (fieldIssue !== '') {
                    credentialHelp = <small className="field-error">{fieldIssue}</small>;
                  } else if (description !== '') {
                    credentialHelp = <small>{description}</small>;
                  }

                  return (
                    <FieldLabel key={field['key']}>
                      <span>{field['label']}</span>
                      <input
                        {...passwordManagerIgnore}
                        aria-invalid={fieldIssue !== ''}
                        autoComplete={input['autoComplete']}
                        className={input['className']}
                        onChange={(event) => {
                          const nextValue: Web_VpnView_ConnectionEditor_NextValue = event.currentTarget.value;

                          setCredentials((currentCredentials) => ({
                            ...currentCredentials,
                            [field['key']]: nextValue,
                          }));

                          return;
                        }}
                        placeholder={input['placeholder']}
                        spellCheck={false}
                        type={input['type']}
                        value={credentials[field['key']] ?? ''}
                      />
                      {credentialHelp}
                    </FieldLabel>
                  );
                })}
              </div>
            )}
          </section>

          <section className="form-section vpn-connection-section">
            <div className="form-section-head"><h2>Connection</h2></div>
            <div className="field-row">
              <FieldLabel>
                <span>Name</span>
                <input aria-invalid={nameIssue !== ''} onChange={(event) => setName(event.currentTarget.value)} placeholder="Connection name" type="text" value={name} />
                {(nameIssue === '') ? null : <small className="field-error">{nameIssue}</small>}
              </FieldLabel>
              <FieldLabel>
                <span>Peer port</span>
                <input aria-invalid={peerPortIssue !== ''} max="65535" min="1024" onChange={(event) => setPeerPort(event.currentTarget.value)} type="number" value={peerPort} />
                {(peerPortIssue === '') ? null : <small className="field-error">{peerPortIssue}</small>}
              </FieldLabel>
            </div>
            <div className="field">
              <span>DNS</span>
              <div className="segmented dns-choice">
                <button aria-pressed={dnsMode === 'provider'} onClick={() => setDNSMode('provider')} type="button">Provider&apos;s servers</button>
                <button aria-pressed={dnsMode === 'custom'} onClick={() => setDNSMode('custom')} type="button">Custom</button>
              </div>
              <small>{dnsHint}</small>
            </div>
            {(dnsMode === 'custom') ? (
              <FieldLabel className="field dns-custom-field">
                <span>IPv4 addresses</span>
                <textarea onChange={(event) => setCustomDNS(event.currentTarget.value)} rows={4} value={customDNS} />
                <small>Up to 8 addresses, one per line.</small>
              </FieldLabel>
            ) : null}
            <FieldLabel>
              <span>Retry interval</span>
              <span className="input-suffix">
                <input max="600" min="3" onChange={(event) => setRetryInterval(event.currentTarget.value)} type="number" value={retryInterval} />
                <span>seconds</span>
              </span>
              <small>From 3 to 600 seconds.</small>
            </FieldLabel>
          </section>
        </div>

        {(error === '') ? null : (
          <div className="form-error vpn-form-error" role="alert">
            <Icon name="warning" size={16} />
            {error}
          </div>
        )}

        {(changeRunning === true) ? (
          <p className="vpn-change-notice" role="status">
            <Icon name="activity" size={16} />
            A VPN change is running.
          </p>
        ) : null}

        <footer className={`form-actions vpn-actions${actionsRenameOnlyClass}`} hidden={providerID === ''}>
          {(connection === null) ? (
            <Button disabled={busyAction !== ''} onClick={onBack}>Cancel</Button>
          ) : (
            <Button
              disabled={busyAction !== '' || changeRunning}
              icon="pause"
              onClick={() => {
                void runConnectionAction('disconnect');

                return;
              }}
              variant="danger"
            >
              Disconnect and block
            </Button>
          )}
          <span className="form-actions-spacer" />
          {(connection === null) ? null : (
            <Button
              disabled={busyAction !== '' || changeRunning}
              icon="refresh"
              onClick={() => {
                void runConnectionAction('reconnect');

                return;
              }}
            >
              Reconnect
            </Button>
          )}
          {(renameOnly === true) ? (
            <Button disabled={submitDisabled} type="submit" variant="primary">{primaryButtonLabel}</Button>
          ) : (
            <Button disabled={submitDisabled} icon="shield" type="submit" variant="primary">{primaryButtonLabel}</Button>
          )}
          {(renameOnly === true) ? <small className="vpn-save-hint">Saves without reconnecting the VPN.</small> : null}
        </footer>
      </form>
    </section>
  );
};

/**
 * Vpn View - Vpn View.
 *
 * Shows every isolated connection, opens its editor, and coordinates safe
 * dependency moves before a non-default connection is removed.
 *
 * @param {Web_VpnView_VpnView_Props} props - Props.
 *
 * @returns {Web_VpnView_VpnView_Returns}
 *
 * @since 2.0.0
 */
export const VpnView = (props: Web_VpnView_VpnView_Props): Web_VpnView_VpnView_Returns => {
  const response: Web_VpnView_VpnView_Response = props['connections'];
  const defaultProfile: Web_VpnView_VpnView_DefaultProfile = props['defaultProfile'];
  const navigationSequence: Web_VpnView_VpnView_NavigationSequence = props['navigationSequence'];
  const navigationTarget: Web_VpnView_VpnView_NavigationTarget = props['navigationTarget'];
  const onCreate: Web_VpnView_VpnView_OnCreate = props['onCreate'];
  const onDelete: Web_VpnView_VpnView_OnDelete = props['onDelete'];
  const onDisconnect: Web_VpnView_VpnView_OnDisconnect = props['onDisconnect'];
  const onMakeDefault: Web_VpnView_VpnView_OnMakeDefault = props['onMakeDefault'];
  const onNavigate: Web_VpnView_VpnView_OnNavigate = props['onNavigate'];
  const onOpenTorrents: Web_VpnView_VpnView_OnOpenTorrents = props['onOpenTorrents'];
  const onReconnect: Web_VpnView_VpnView_OnReconnect = props['onReconnect'];
  const onRefreshCatalog: Web_VpnView_VpnView_OnRefreshCatalog = props['onRefreshCatalog'];
  const onUpdate: Web_VpnView_VpnView_OnUpdate = props['onUpdate'];
  const onUploadProfile: Web_VpnView_VpnView_OnUploadProfile = props['onUploadProfile'];
  const profiles: Web_VpnView_VpnView_Profiles = props['profiles'];
  const providers: Web_VpnView_VpnView_Providers = props['providers'];
  const snapshot: Web_VpnView_VpnView_Snapshot = props['snapshot'];
  const selectedIDState: Web_VpnView_VpnView_SelectedIDState = useState<Web_VpnView_VpnView_SelectedID>(null);
  const selectedID: Web_VpnView_VpnView_SelectedID = selectedIDState[0];
  const setSelectedID: Web_VpnView_VpnView_SetSelectedID = selectedIDState[1];
  const removeStateState: Web_VpnView_VpnView_RemoveStateState = useState<Web_VpnView_VpnView_RemoveState>(null);
  const removeState: Web_VpnView_VpnView_RemoveState = removeStateState[0];
  const setRemoveState: Web_VpnView_VpnView_SetRemoveState = removeStateState[1];
  const moveToState: Web_VpnView_VpnView_MoveToState = useState<Web_VpnView_VpnView_MoveTo>('');
  const moveTo: Web_VpnView_VpnView_MoveTo = moveToState[0];
  const setMoveTo: Web_VpnView_VpnView_SetMoveTo = moveToState[1];
  const removingState: Web_VpnView_VpnView_RemovingState = useState<Web_VpnView_VpnView_Removing>(false);
  const removing: Web_VpnView_VpnView_Removing = removingState[0];
  const setRemoving: Web_VpnView_VpnView_SetRemoving = removingState[1];
  const removeErrorState: Web_VpnView_VpnView_RemoveErrorState = useState<Web_VpnView_VpnView_RemoveError>('');
  const removeError: Web_VpnView_VpnView_RemoveError = removeErrorState[0];
  const setRemoveError: Web_VpnView_VpnView_SetRemoveError = removeErrorState[1];
  const moveResultsState: Web_VpnView_VpnView_MoveResultsState = useState<Web_VpnView_VpnView_MoveResults>([]);
  const moveResults: Web_VpnView_VpnView_MoveResults = moveResultsState[0];
  const setMoveResults: Web_VpnView_VpnView_SetMoveResults = moveResultsState[1];
  const removalCompleteState: Web_VpnView_VpnView_RemovalCompleteState = useState<Web_VpnView_VpnView_RemovalComplete>(false);
  const removalComplete: Web_VpnView_VpnView_RemovalComplete = removalCompleteState[0];
  const setRemovalComplete: Web_VpnView_VpnView_SetRemovalComplete = removalCompleteState[1];
  const defaultChangeStateState: Web_VpnView_VpnView_DefaultChangeStateState = useState<Web_VpnView_VpnView_DefaultChangeState>(null);
  const defaultChangeState: Web_VpnView_VpnView_DefaultChangeState = defaultChangeStateState[0];
  const setDefaultChangeState: Web_VpnView_VpnView_SetDefaultChangeState = defaultChangeStateState[1];
  const defaultChangeBusyState: Web_VpnView_VpnView_DefaultChangeBusyState = useState<Web_VpnView_VpnView_DefaultChangeBusy>(false);
  const defaultChangeBusy: Web_VpnView_VpnView_DefaultChangeBusy = defaultChangeBusyState[0];
  const setDefaultChangeBusy: Web_VpnView_VpnView_SetDefaultChangeBusy = defaultChangeBusyState[1];
  const defaultChangeErrorState: Web_VpnView_VpnView_DefaultChangeErrorState = useState<Web_VpnView_VpnView_DefaultChangeError>('');
  const defaultChangeError: Web_VpnView_VpnView_DefaultChangeError = defaultChangeErrorState[0];
  const setDefaultChangeError: Web_VpnView_VpnView_SetDefaultChangeError = defaultChangeErrorState[1];
  const defaultMoveResultsState: Web_VpnView_VpnView_DefaultMoveResultsState = useState<Web_VpnView_VpnView_DefaultMoveResults>([]);
  const defaultMoveResults: Web_VpnView_VpnView_DefaultMoveResults = defaultMoveResultsState[0];
  const setDefaultMoveResults: Web_VpnView_VpnView_SetDefaultMoveResults = defaultMoveResultsState[1];
  const defaultChangeCompleteState: Web_VpnView_VpnView_DefaultChangeCompleteState = useState<Web_VpnView_VpnView_DefaultChangeComplete>(false);
  const defaultChangeComplete: Web_VpnView_VpnView_DefaultChangeComplete = defaultChangeCompleteState[0];
  const setDefaultChangeComplete: Web_VpnView_VpnView_SetDefaultChangeComplete = defaultChangeCompleteState[1];
  const handledNavigationSequenceRef: Web_VpnView_VpnView_HandledNavigationSequenceRef = useRef<Web_VpnView_VpnView_HandledNavigationSequence>(-1);

  useEffect(() => {
    /**
     * Vpn View - Close Menus Outside.
     *
     * Closes every open row menu that the press landed outside of. Native menus stay open
     * until toggled, so opening one menu also closes the one left open before it.
     *
     * @param {Web_VpnView_VpnView_CloseMenusOutside_Event} event - Event.
     *
     * @returns {Web_VpnView_VpnView_CloseMenusOutside_Returns}
     *
     * @since 2.0.0
     */
    const closeMenusOutside: Web_VpnView_VpnView_CloseMenusOutside = (event: Web_VpnView_VpnView_CloseMenusOutside_Event): Web_VpnView_VpnView_CloseMenusOutside_Returns => {
      document.querySelectorAll<HTMLDetailsElement>('details.vpn-row-menu[open]').forEach((menu) => {
        if ((event.target instanceof Node) === false || menu.contains(event.target) === false) {
          menu.removeAttribute('open');
        }

        return;
      });

      return;
    };

    /**
     * Vpn View - Close Menus On Escape.
     *
     * Closes every open row menu when Escape is pressed.
     * The app's other menus close the same way.
     *
     * @param {Web_VpnView_VpnView_CloseMenusOnEscape_Event} event - Event.
     *
     * @returns {Web_VpnView_VpnView_CloseMenusOnEscape_Returns}
     *
     * @since 2.0.0
     */
    const closeMenusOnEscape: Web_VpnView_VpnView_CloseMenusOnEscape = (event: Web_VpnView_VpnView_CloseMenusOnEscape_Event): Web_VpnView_VpnView_CloseMenusOnEscape_Returns => {
      if (event.key === 'Escape') {
        document.querySelectorAll<HTMLDetailsElement>('details.vpn-row-menu[open]').forEach((menu) => {
          menu.removeAttribute('open');

          return;
        });
      }

      return;
    };

    document.addEventListener('pointerdown', closeMenusOutside);
    document.addEventListener('keydown', closeMenusOnEscape);

    return () => {
      document.removeEventListener('pointerdown', closeMenusOutside);
      document.removeEventListener('keydown', closeMenusOnEscape);

      return;
    };
  }, []);

  const connections: Web_VpnView_VpnView_Connections = (response === null) ? [] : response['connections'];
  const selectedConnection: Web_VpnView_VpnView_SelectedConnection = (selectedID === null || selectedID === 'new') ? null : connections.find((connection) => connection['id'] === selectedID) ?? null;
  const usedPeerPorts: Web_VpnView_VpnView_UsedPeerPorts = new Set(connections.map((connection) => connection['peerPort']));
  let defaultPeerPort: Web_VpnView_VpnView_DefaultPeerPort = 51_413;

  while (usedPeerPorts.has(defaultPeerPort) === true && defaultPeerPort < 65_535) {
    defaultPeerPort += 1;
  }
  const capacity: Web_VpnView_VpnView_Capacity = (response === null) ? undefined : response['capacity'];
  const atCapacity: Web_VpnView_VpnView_AtCapacity = capacity !== undefined && capacity['used'] >= capacity['limit'];
  const capacityMemoryGigabytes: Web_VpnView_VpnView_CapacityMemoryGigabytes = (capacity === undefined) ? 0 : Math.round(capacity['memoryBytes'] / (1024 * 1024 * 1024));
  const capacityCpus: Web_VpnView_VpnView_CapacityCpus = (capacity === undefined) ? undefined : capacity['cpus'];
  const capacityLimit: Web_VpnView_VpnView_CapacityLimit = (capacity === undefined) ? undefined : capacity['limit'];
  const capacityCpuNoun: Web_VpnView_VpnView_CapacityCpuNoun = (capacityCpus === 1) ? 'CPU' : 'CPUs';
  const capacityDescription: Web_VpnView_VpnView_CapacityDescription = (capacity !== undefined && capacity['source'] === 'fallback') ? `Memory availability could not be read, so up to ${capacity['limit']} connections are allowed` : `${capacityMemoryGigabytes} GB of memory and ${capacityCpus ?? 0} ${capacityCpuNoun} allow ${capacityLimit ?? 0}`;

  /**
   * Vpn View - Open Navigation Target.
   *
   * Updates the editor immediately and delegates the matching browser address
   * to the app. Missing and unavailable deep targets replace instead of push.
   *
   * @param {Web_VpnView_VpnView_OpenNavigationTarget_Target}  target    - Target.
   * @param {Web_VpnView_VpnView_OpenNavigationTarget_Replace} [replace] - Replace.
   *
   * @returns {Web_VpnView_VpnView_OpenNavigationTarget_Returns}
   *
   * @since 2.0.0
   */
  const openNavigationTarget: Web_VpnView_VpnView_OpenNavigationTarget = (
    target: Web_VpnView_VpnView_OpenNavigationTarget_Target,
    replace: Web_VpnView_VpnView_OpenNavigationTarget_Replace = false,
  ): Web_VpnView_VpnView_OpenNavigationTarget_Returns => {
    if (target['kind'] === 'connection') {
      setSelectedID(target['connectionID']);
    } else if (target['kind'] === 'new') {
      setSelectedID('new');
    } else {
      setSelectedID(null);
    }

    onNavigate(target, replace);

    return;
  };

  useEffect(() => {
    if (response === null || handledNavigationSequenceRef.current === navigationSequence) {
      return;
    }

    handledNavigationSequenceRef.current = navigationSequence;
    if (navigationTarget['kind'] === 'connection') {
      const connectionExists: Web_VpnView_VpnView_ConnectionExists = connections.some(
        (connection) => connection['id'] === navigationTarget['connectionID'],
      );
      if (connectionExists === false) {
        openNavigationTarget({ kind: 'list' }, true);

        return;
      }

      setSelectedID(navigationTarget['connectionID']);

      return;
    }

    if (navigationTarget['kind'] === 'new') {
      if (atCapacity === true) {
        openNavigationTarget({ kind: 'list' }, true);

        return;
      }

      setSelectedID('new');

      return;
    }

    setSelectedID(null);

    return;
  }, [
    atCapacity,
    navigationSequence,
    navigationTarget,
    response,
  ]);

  /**
   * Vpn View - Request Remove.
   *
   * Removes an unused row immediately or opens dependency migration on conflict.
   * Other server errors stay visible through the global toast.
   *
   * @param {Web_VpnView_VpnView_RequestRemove_Connection} connection - Connection.
   *
   * @returns {Web_VpnView_VpnView_RequestRemove_Returns}
   *
   * @since 2.0.0
   */
  const requestRemove: Web_VpnView_VpnView_RequestRemove = async (connection: Web_VpnView_VpnView_RequestRemove_Connection): Web_VpnView_VpnView_RequestRemove_Returns => {
    setRemoveError('');
    setMoveResults([]);
    setRemovalComplete(false);
    try {
      await onDelete(connection['id'], {});
      showToast(`${connection['name']} removed.`, true);
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError['code'] === 'connection_in_use') {
        const dependencies: Web_VpnView_VpnView_RequestRemove_Dependencies = parseDependencies(caughtError['details']);
        const defaultCandidate: Web_VpnView_VpnView_RequestRemove_DefaultCandidate = connections.find((candidate) => candidate['id'] !== connection['id'] && candidate['default'] === true);

        setRemoveState({
          connection,
          dependencies,
        });
        setMoveTo((defaultCandidate === undefined) ? '' : defaultCandidate['id']);

        return;
      }
      showToast((caughtError instanceof Error) ? caughtError.message : 'The connection could not be removed.', false);
    }

    return;
  };

  /**
   * Vpn View - Move And Remove.
   *
   * Submits the selected destination and preserves partial results on failure.
   * The dialog stays open so failed torrents can be inspected and retried.
   *
   * @returns {Web_VpnView_VpnView_MoveAndRemove_Returns}
   *
   * @since 2.0.0
   */
  const moveAndRemove: Web_VpnView_VpnView_MoveAndRemove = async (): Web_VpnView_VpnView_MoveAndRemove_Returns => {
    if (removeState === null || moveTo === '') {
      return;
    }
    const targetConnection: Web_VpnView_VpnView_MoveAndRemove_TargetConnection = connections.find(
      (connection) => connection['id'] === moveTo,
    );
    const targetConnectionName: Web_VpnView_VpnView_MoveAndRemove_TargetConnectionName = (targetConnection === undefined) ? 'The selected connection' : targetConnection['name'];

    setRemoving(true);
    setRemoveError('');
    setMoveResults([]);
    try {
      const result: Web_VpnView_VpnView_MoveAndRemove_Result = await onDelete(removeState['connection']['id'], { moveTo });

      setMoveResults(result['moved']);
      showToast(`${removeState['connection']['name']} removed.`, true);

      const hasWarnings: Web_VpnView_VpnView_MoveAndRemove_HasWarnings = result['moved'].some((movedTorrent) => {
        const warnings: Web_VpnView_VpnView_MoveAndRemove_Warnings = movedTorrent['warnings'];

        return warnings !== undefined && warnings.length > 0;
      });

      if (hasWarnings === true) {
        setRemovalComplete(true);
      } else {
        setRemoveState(null);
      }
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError['code'] === 'move_failed') {
        setMoveResults(movedTorrents(caughtError['details']));
      }
      setRemoveError(connectionBeingRemovedMessage(caughtError, targetConnectionName) ?? (
        (caughtError instanceof Error) ? caughtError.message : 'Some torrents could not be moved.'
      ));
    } finally {
      setRemoving(false);
    }

    return;
  };

  /**
   * Vpn View - Request Default Change.
   *
   * Applies a move-free switch immediately and opens confirmation only when the
   * backend reports that Default-profile torrents would change daemon ownership.
   *
   * @param {Web_VpnView_VpnView_RequestDefaultChange_ConnectionId} connectionId - Connection id.
   *
   * @returns {Web_VpnView_VpnView_RequestDefaultChange_Returns}
   *
   * @since 2.0.0
   */
  const requestDefaultChange: Web_VpnView_VpnView_RequestDefaultChange = async (connectionId: Web_VpnView_VpnView_RequestDefaultChange_ConnectionId): Web_VpnView_VpnView_RequestDefaultChange_Returns => {
    const connection: Web_VpnView_VpnView_RequestDefaultChange_Connection = connections.find(
      (candidate) => candidate['id'] === connectionId,
    );
    if (connection === undefined) {
      showToast('The VPN connection could not be found.', false);

      return [];
    }

    try {
      const results: Web_VpnView_VpnView_RequestDefaultChange_Results = await onMakeDefault(connectionId);

      showToast(`${connection['name']} is now the default connection.`, true);

      return results;
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError['code'] === 'torrents_must_move') {
        const torrentCount: Web_VpnView_VpnView_RequestDefaultChange_TorrentCount = caughtError['details']['torrents'];
        const defaultProfileTorrentCount: Web_VpnView_VpnView_RequestDefaultChange_DefaultProfileTorrentCount = caughtError['details']['defaultProfileTorrents'];
        const followingProfileTorrentCount: Web_VpnView_VpnView_RequestDefaultChange_FollowingProfileTorrentCount = caughtError['details']['followingProfileTorrents'];
        if (
          typeof torrentCount === 'number'
          && Number.isInteger(torrentCount) === true
          && torrentCount > 0
          && typeof defaultProfileTorrentCount === 'number'
          && Number.isInteger(defaultProfileTorrentCount) === true
          && defaultProfileTorrentCount >= 0
          && typeof followingProfileTorrentCount === 'number'
          && Number.isInteger(followingProfileTorrentCount) === true
          && followingProfileTorrentCount >= 0
          && defaultProfileTorrentCount + followingProfileTorrentCount === torrentCount
        ) {
          setDefaultChangeState({
            connection,
            defaultProfileTorrents: defaultProfileTorrentCount,
            followingProfileTorrents: followingProfileTorrentCount,
            torrents: torrentCount,
          });
          setDefaultChangeError('');
          setDefaultMoveResults([]);
          setDefaultChangeComplete(false);

          return [];
        }
      }
      showToast((caughtError instanceof Error) ? caughtError.message : 'The default connection could not be changed.', false);

      return [];
    }
  };

  /**
   * Vpn View - Confirm Default Change.
   *
   * Repeats the switch with explicit move consent and keeps every per-torrent
   * outcome visible even when one source remains unchanged after a failure.
   *
   * @returns {Web_VpnView_VpnView_ConfirmDefaultChange_Returns}
   *
   * @since 2.0.0
   */
  const confirmDefaultChange: Web_VpnView_VpnView_ConfirmDefaultChange = async (): Web_VpnView_VpnView_ConfirmDefaultChange_Returns => {
    if (defaultChangeState === null) {
      return;
    }
    if (defaultChangeComplete === true) {
      setDefaultChangeState(null);

      return;
    }

    setDefaultChangeBusy(true);
    setDefaultChangeError('');
    try {
      const results: Web_VpnView_VpnView_ConfirmDefaultChange_Results = await onMakeDefault(
        defaultChangeState['connection']['id'],
        true,
      );

      setDefaultMoveResults(results);
      setDefaultChangeComplete(true);
      showToast(`${defaultChangeState['connection']['name']} is now the default connection.`, true);
    } catch (caughtError) {
      setDefaultChangeError((caughtError instanceof Error) ? caughtError.message : 'The default connection could not be changed.');
    } finally {
      setDefaultChangeBusy(false);
    }

    return;
  };

  /**
   * Vpn View - Close Default Change.
   *
   * Clears confirmation and result state before another connection is selected.
   * A later conflict therefore always opens with a clean confirmation dialog.
   *
   * @returns {Web_VpnView_VpnView_CloseDefaultChange_Returns}
   *
   * @since 2.0.0
   */
  const closeDefaultChange: Web_VpnView_VpnView_CloseDefaultChange = (): Web_VpnView_VpnView_CloseDefaultChange_Returns => {
    setDefaultChangeState(null);
    setDefaultChangeError('');
    setDefaultMoveResults([]);
    setDefaultChangeComplete(false);

    return;
  };
  const defaultChangeHasFailures: Web_VpnView_VpnView_DefaultChangeHasFailures = defaultMoveResults.some(
    (result) => result['result'] === 'failed',
  );
  let defaultChangeMessage: Web_VpnView_VpnView_DefaultChangeMessage = '';
  if (defaultChangeState !== null) {
    if (defaultChangeComplete === true) {
      defaultChangeMessage = (defaultChangeHasFailures === true) ? `${defaultChangeState['connection']['name']} is now the default. Failed torrents stayed on their old connection.` : `${defaultChangeState['connection']['name']} is now the default. Review each torrent move below.`;
    } else {
      defaultChangeMessage = defaultVPNMoveConfirmation(
        defaultChangeState['connection']['name'],
        defaultChangeState['torrents'],
        defaultChangeState['defaultProfileTorrents'],
        defaultChangeState['followingProfileTorrents'],
      );
    }
  }
  const defaultChangeDialog: Web_VpnView_VpnView_DefaultChangeDialog = (defaultChangeComplete === false) ? (
    <ConfirmDialog
      busy={defaultChangeBusy}
      busyLabel="Making default and moving…"
      confirmLabel="Make default and move"
      error={defaultChangeError}
      message={defaultChangeMessage}
      onCancel={closeDefaultChange}
      onConfirm={() => {
        void confirmDefaultChange();

        return;
      }}
      open={defaultChangeState !== null}
      title="Make default connection"
      tone="primary"
    />
  ) : (
    <div className="dialog-backdrop" role="presentation">
      <section aria-describedby="default-change-results-message" aria-labelledby="default-change-results-title" aria-modal="true" className="dialog dialog-small" role="alertdialog">
        <div className="dialog-heading">
          <h2 id="default-change-results-title">Move results</h2>
        </div>
        <p className="dialog-message" id="default-change-results-message">{defaultChangeMessage}</p>
        <div className="torrent-move-results">
          <ul>
            {defaultMoveResults.map((result) => (
              <li className={(result['result'] === 'failed') ? 'move-failed' : 'move-succeeded'} key={result['hash']}>
                <strong>{result['name']}</strong>
                <span className="move-result-copy">
                  <span className="move-result-state">{torrentMoveResultLabel(result)}</span>
                  {(result['warnings'] === undefined) ? undefined : result['warnings'].map((warning) => <small key={`${result['hash']}-${warning}`}>{warning}</small>)}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="dialog-actions">
          <Button onClick={closeDefaultChange} variant="primary">Done</Button>
        </div>
      </section>
    </div>
  );

  if (selectedID !== null) {
    return (
      <>
        <ConnectionEditor
          connection={(selectedID === 'new') ? null : selectedConnection}
          defaultPeerPort={defaultPeerPort}
          onBack={() => openNavigationTarget({ kind: 'list' })}
          onCreate={onCreate}
          onDisconnect={onDisconnect}
          onMakeDefault={requestDefaultChange}
          onReconnect={onReconnect}
          onRefreshCatalog={onRefreshCatalog}
          onUpdate={onUpdate}
          onUploadProfile={onUploadProfile}
          profiles={profiles}
          providers={providers}
          snapshot={snapshot}
        />
        {defaultChangeDialog}
      </>
    );
  }

  const removeTorrentNoun: Web_VpnView_VpnView_RemoveTorrentNoun = (removeState !== null && removeState['dependencies']['torrents'] === 1) ? 'torrent' : 'torrents';
  const removeProfileNoun: Web_VpnView_VpnView_RemoveProfileNoun = (removeState !== null && removeState['dependencies']['profiles'].length === 1) ? 'profile' : 'profiles';
  const removeLoginNoun: Web_VpnView_VpnView_RemoveLoginNoun = (removeState !== null && removeState['dependencies']['logins'].length === 1) ? 'login' : 'logins';

  return (
    <section className="workspace-section vpn-list-page">
      <header className="workspace-heading vpn-list-heading">
        <div>
          <h1>VPN</h1>
          <p>Each connection runs its own Transmission.</p>
        </div>
        <div className="vpn-add-control">
          <Button disabled={atCapacity} icon="add" onClick={() => openNavigationTarget({ kind: 'new' })} variant="primary">Add connection</Button>
          {(atCapacity === true) ? <small>Remove a connection before adding another.</small> : null}
        </div>
      </header>

      {(capacity === undefined) ? null : (
        <div className="vpn-capacity">
          <strong>{`${capacity['used']} of ${capacity['limit']} connections`}</strong>
          <span aria-label={capacityDescription} className="vpn-capacity-info" title={capacityDescription}>?</span>
        </div>
      )}

      {(connections.length === 0) ? <div className="vpn-connection-empty"><p>No connections yet.</p></div> : (
        <div className="vpn-connection-list">
          {connections.map((connection) => {
            const runtime: Web_VpnView_VpnView_Runtime = connectionState(connection, snapshot);
            const endpoint: Web_VpnView_VpnView_Endpoint = (runtime['remoteHost'] === undefined) ? '—' : `${runtime['remoteHost']}:${runtime['remotePort'] ?? ''}`;
            const connectionProvider: Web_VpnView_VpnView_ConnectionProvider = providers.find((provider) => provider['id'] === connection['providerId']);
            const providerName: Web_VpnView_VpnView_ProviderName = (connectionProvider === undefined) ? connection['providerId'] : connectionProvider['displayName'];
            const torrentNoun: Web_VpnView_VpnView_TorrentNoun = (connection['torrentCount'] === 1) ? 'torrent' : 'torrents';

            return (
              <article
                className="vpn-connection-row"
                key={connection['id']}
              >
                <button
                  aria-label={`Open ${connection['name']}`}
                  className="vpn-row-open-button"
                  onClick={() => openNavigationTarget({
                    connectionID: connection['id'],
                    kind: 'connection',
                  })}
                  type="button"
                />
                <div className="vpn-connection-identity">
                  <span className="vpn-title-line">
                    <strong>{connection['name']}</strong>
                    {(connection['default'] === true) ? <span className="tag vpn-default-tag">Default</span> : null}
                  </span>
                  <span>{`${providerName} · ${tunnelLabel(connection['tunnel'])}`}</span>
                  {(connection['default'] === true) ? <small className="vpn-default-note">{`${defaultProfile['name']} torrents and tracker lookups use this connection.`}</small> : null}
                </div>
                <div className="vpn-row-status">
                  <span className={`state-chip ${statusTone(runtime['state'])}`}>
                    <span className={`status-dot status-${statusTone(runtime['state'])}`} />
                    {stateLabels[runtime['state']] ?? runtime['state']}
                  </span>
                  {(statusReason(runtime) !== '') ? <small>{statusReason(runtime)}</small> : null}
                </div>
                <div className="vpn-row-endpoint">
                  <span>Current endpoint</span>
                  <code title={endpoint}>{endpoint}</code>
                  <small>{`Peer port ${connection['peerPort']}`}</small>
                </div>
                <button
                  className="vpn-torrent-link"
                  onClick={() => onOpenTorrents(connection['id'])}
                  type="button"
                >
                  {`${connection['torrentCount']} ${torrentNoun}`}
                </button>
                <details className="vpn-row-menu">
                  <summary aria-label={`Actions for ${connection['name']}`} className="icon-button"><Icon name="more" size={18} /></summary>
                  <div className="menu">
                    <button
                      onClick={() => openNavigationTarget({
                        connectionID: connection['id'],
                        kind: 'connection',
                      })}
                      type="button"
                    >
                      Open
                    </button>
                    <button
                      disabled={connection['default']}
                      onClick={(event) => {
                        const menu: Web_VpnView_VpnView_Menu = event.currentTarget.closest('details');

                        if (menu !== null) {
                          menu.removeAttribute('open');
                        }

                        void requestDefaultChange(connection['id']);

                        return;
                      }}
                      type="button"
                    >
                      Make default
                    </button>
                    {(connection['default'] === true) ? null : (
                      <button
                        className="menu-danger"
                        onClick={(event) => {
                          const menu: Web_VpnView_VpnView_Menu = event.currentTarget.closest('details');

                          if (menu !== null) {
                            menu.removeAttribute('open');
                          }

                          void requestRemove(connection);

                          return;
                        }}
                        type="button"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      )}

      {(removeState === null) ? null : (
        <div className="dialog-backdrop" role="presentation">
          <section aria-labelledby="remove-vpn-title" aria-modal="true" className="dialog remove-vpn-dialog" role="alertdialog">
            <div className="dialog-heading">
              <h2 id="remove-vpn-title">{(removalComplete === true) ? `${removeState['connection']['name']} removed` : `Remove ${removeState['connection']['name']}?`}</h2>
              <button aria-label="Close" className="icon-button" disabled={removing} onClick={() => setRemoveState(null)} type="button"><Icon name="x" /></button>
            </div>
            {(removalComplete === true) ? <p className="dialog-message">Review the warnings from torrents that still moved successfully.</p> : (
              <>
                <p className="dialog-message">This connection is used by:</p>
                <ul className="remove-vpn-dependencies">
                  {(removeState['dependencies']['torrents'] === 0) ? null : <li><strong>{`${removeState['dependencies']['torrents']} ${removeTorrentNoun}`}</strong></li>}
                  {(removeState['dependencies']['profiles'].length === 0) ? null : (
                    <li>
                      <strong>{`${removeState['dependencies']['profiles'].length} ${removeProfileNoun}:`}</strong>
                      {` ${removeState['dependencies']['profiles'].map((profile) => profile['name']).join(', ')}`}
                    </li>
                  )}
                  {(removeState['dependencies']['logins'].length === 0) ? null : (
                    <li>
                      <strong>{`${removeState['dependencies']['logins'].length} web proxy ${removeLoginNoun}:`}</strong>
                      {` ${removeState['dependencies']['logins'].map((login) => login['username']).join(', ')}`}
                    </li>
                  )}
                </ul>
                <FieldLabel>
                  <span>Move them to</span>
                  <select disabled={removing} onChange={(event) => setMoveTo(event.currentTarget.value)} value={moveTo}>{connections.filter((connection) => connection['id'] !== removeState['connection']['id']).map((connection) => <option key={connection['id']} value={connection['id']}>{(connection['default'] === true) ? `Default (${connection['name']})` : connection['name']}</option>)}</select>
                  <small>Torrents keep their files. Each one is checked after it moves.</small>
                </FieldLabel>
              </>
            )}
            {(removing === true) ? (
              <div aria-live="polite" className="vpn-remove-progress">
                <span className="spinner" />
                Moving torrents and removing connection…
              </div>
            ) : null}
            {(moveResults.length === 0) ? null : (
              <div className="torrent-move-results">
                <h3>Move results</h3>
                <ul>
                  {moveResults.map((result) => (
                    <li className={(result['result'] === 'failed') ? 'move-failed' : 'move-succeeded'} key={result['hash']}>
                      <strong>{result['name']}</strong>
                      <span className="move-result-copy">
                        <span className="move-result-state">{(result['result'] === 'moved') ? 'Moved' : result['error'] ?? 'Failed'}</span>
                        {(result['result'] !== 'moved' || result['warnings'] === undefined) ? null : result['warnings'].map((warning) => <small key={warning}>{warning}</small>)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(removeError === '') ? null : (
              <div className="form-error" role="alert">
                <Icon name="warning" size={16} />
                {removeError}
              </div>
            )}
            <div className="dialog-actions">
              {(removalComplete === true) ? (
                <Button onClick={() => setRemoveState(null)} variant="primary">Done</Button>
              ) : (
                <>
                  <Button disabled={removing} onClick={() => setRemoveState(null)}>Cancel</Button>
                  <Button
                    disabled={removing || moveTo === ''}
                    onClick={() => {
                      void moveAndRemove();

                      return;
                    }}
                    variant="danger"
                  >
                    {(removing === true) ? 'Moving…' : 'Move and remove'}
                  </Button>
                </>
              )}
            </div>
          </section>
        </div>
      )}
      {defaultChangeDialog}
    </section>
  );
};
