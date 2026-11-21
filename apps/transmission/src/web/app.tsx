import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { AccessView } from '@/web/access-view.tsx';
import { AddTorrentDialog } from '@/web/add-torrent-dialog.tsx';
import {
  addTorrent,
  ApiError,
  connectLiveEvents,
  createRPCLogin,
  createToken,
  createTorrentProfile,
  createVPNConnection,
  createWebProxyLogin,
  deleteRPCLogin,
  deleteTorrentProfile,
  deleteVPNConnection,
  deleteWebProxyLogin,
  disconnectVPNConnection,
  dismissRemovedSecrets,
  getCurrentAdministrator,
  getProfiles,
  getProviders,
  getRPCLogins,
  getSettings,
  getSetupStatus,
  getTokens,
  getTorrentDetail,
  getTorrentOrganization,
  getTorrentProfiles,
  getTorrents,
  getVPNConnections,
  getWebProxy,
  logout,
  reconnectVPNConnection,
  refreshVPNCatalog,
  removeTorrents,
  renameTorrentPath,
  restartTransmission,
  revokeToken,
  runTorrentAction,
  setDefaultVPNConnection,
  setTorrentProfile,
  updateDefaultTorrentProfile,
  updateRPCLogin,
  updateSettings,
  updateToken,
  updateTorrentOrganization,
  updateTorrentProfile,
  updateTorrents,
  updateVPNConnection,
  updateWebProxy,
  updateWebProxyLogin,
  uploadCustomProfile,
} from '@/web/api.ts';
import {
  appRouteForView,
  appRouteForVPNTarget,
  resolveAppNavigationPath,
} from '@/web/app-navigation.ts';
import { AppShell } from '@/web/app-shell.tsx';
import { AuthenticationScreen } from '@/web/auth-screen.tsx';
import { ConfirmDialog } from '@/web/confirm-dialog.tsx';
import { KeyNotice } from '@/web/key-notice.tsx';
import { LibraryNavigation } from '@/web/library-navigation.tsx';
import {
  applyNavigationPath,
  pushNavigationPath,
  replaceNavigationPath,
  startNavigationHistory,
} from '@/web/navigation.ts';
import { NotificationsView } from '@/web/notifications-view.tsx';
import { Button } from '@/web/primitives.tsx';
import { describeProtection } from '@/web/protection-state.ts';
import { SecurityView } from '@/web/security-view.tsx';
import { SettingsView } from '@/web/settings-view.tsx';
import { TorrentDetail } from '@/web/torrent-detail.tsx';
import { torrentMoveResultLabel } from '@/web/torrent-move-result.ts';
import { TorrentOrganizationDialog } from '@/web/torrent-organization-dialog.tsx';
import { mergeTorrentOrganizationUpdate } from '@/web/torrent-organization.ts';
import { TorrentProfileDialog } from '@/web/torrent-profile-dialog.tsx';
import { TorrentWorkspace } from '@/web/torrent-workspace.tsx';
import { VpnView } from '@/web/vpn-view.tsx';

import type {
  Web_App_App_ActiveRoute,
  Web_App_App_ActiveRouteState,
  Web_App_App_ActiveView,
  Web_App_App_AddDialogOpen,
  Web_App_App_AddDialogOpenState,
  Web_App_App_AddTorrentAndRefreshLabels,
  Web_App_App_AddTorrentAndRefreshLabels_Input,
  Web_App_App_AddTorrentAndRefreshLabels_Result,
  Web_App_App_AddTorrentAndRefreshLabels_Returns,
  Web_App_App_AddVPNConnectionDialogOpen,
  Web_App_App_AddVPNConnectionDialogOpenState,
  Web_App_App_Administrator,
  Web_App_App_AdministratorState,
  Web_App_App_ApplyAppRoute,
  Web_App_App_ApplyAppRoute_Returns,
  Web_App_App_ApplyAppRoute_Route,
  Web_App_App_Bootstrap,
  Web_App_App_Bootstrap_Returns,
  Web_App_App_Bootstrap_SetupStatus,
  Web_App_App_Cancelled,
  Web_App_App_ConfirmTorrentProfileDeletion,
  Web_App_App_ConfirmTorrentProfileDeletion_DeleteResponse,
  Web_App_App_ConfirmTorrentProfileDeletion_Returns,
  Web_App_App_ConfirmTorrentProfileDeletion_TorrentCount,
  Web_App_App_Connections,
  Web_App_App_DefaultTorrentProfile,
  Web_App_App_DefaultTorrentProfileState,
  Web_App_App_DeletingTorrentProfile,
  Web_App_App_DeletingTorrentProfileBusy,
  Web_App_App_DeletingTorrentProfileBusyState,
  Web_App_App_DeletingTorrentProfileConfirmLabel,
  Web_App_App_DeletingTorrentProfileDefaultConnection,
  Web_App_App_DeletingTorrentProfileDefaultConnectionName,
  Web_App_App_DeletingTorrentProfileError,
  Web_App_App_DeletingTorrentProfileErrorState,
  Web_App_App_DeletingTorrentProfileHasFailures,
  Web_App_App_DeletingTorrentProfileMessage,
  Web_App_App_DeletingTorrentProfileMoveCount,
  Web_App_App_DeletingTorrentProfileMoveCountState,
  Web_App_App_DeletingTorrentProfileMoveResults,
  Web_App_App_DeletingTorrentProfileMoveResultsState,
  Web_App_App_DeletingTorrentProfileState,
  Web_App_App_EditingTorrentProfile,
  Web_App_App_EditingTorrentProfileState,
  Web_App_App_EffectActive,
  Web_App_App_EnterApplication,
  Web_App_App_EnterApplication_CurrentAdministrator,
  Web_App_App_EnterApplication_Returns,
  Web_App_App_FiltersSheetOpen,
  Web_App_App_FiltersSheetOpenState,
  Web_App_App_HandleWebProxyVisibilityChange,
  Web_App_App_HandleWebProxyVisibilityChange_Returns,
  Web_App_App_IncompleteDirectory,
  Web_App_App_IncompleteDirectorySetting,
  Web_App_App_InitialNavigation,
  Web_App_App_LabelsByKey,
  Web_App_App_LastRemovedSecret,
  Web_App_App_LibraryTorrents,
  Web_App_App_LoadConfiguration,
  Web_App_App_LoadConfiguration_ConfigurationResults,
  Web_App_App_LoadConfiguration_NextOrganization,
  Web_App_App_LoadConfiguration_NextProviders,
  Web_App_App_LoadConfiguration_NextRPCLogins,
  Web_App_App_LoadConfiguration_NextSettings,
  Web_App_App_LoadConfiguration_NextTokens,
  Web_App_App_LoadConfiguration_NextTorrentProfiles,
  Web_App_App_LoadConfiguration_NextVPNConnections,
  Web_App_App_LoadConfiguration_NextWebProxy,
  Web_App_App_LoadConfiguration_ProfileGroups,
  Web_App_App_LoadConfiguration_Returns,
  Web_App_App_LoadRemovedSecrets,
  Web_App_App_LoadRemovedSecrets_CurrentAdministrator,
  Web_App_App_LoadRemovedSecrets_Returns,
  Web_App_App_Notice,
  Web_App_App_NoticeRemovedAt,
  Web_App_App_OnFocus,
  Web_App_App_OnFocus_Returns,
  Web_App_App_OpenDefaultTorrentProfile,
  Web_App_App_OpenDefaultTorrentProfile_Returns,
  Web_App_App_OpenNewTorrentProfile,
  Web_App_App_OpenNewTorrentProfile_Returns,
  Web_App_App_OpenRoute,
  Web_App_App_OpenRoute_Replace,
  Web_App_App_OpenRoute_Returns,
  Web_App_App_OpenRoute_Route,
  Web_App_App_OpenTorrentProfile,
  Web_App_App_OpenTorrentProfile_Profile,
  Web_App_App_OpenTorrentProfile_Returns,
  Web_App_App_OpenView,
  Web_App_App_OpenView_Returns,
  Web_App_App_OpenView_View,
  Web_App_App_OpenVPN,
  Web_App_App_OpenVPN_Replace,
  Web_App_App_OpenVPN_Returns,
  Web_App_App_OpenVPN_Target,
  Web_App_App_Organization,
  Web_App_App_OrganizationDialogOpen,
  Web_App_App_OrganizationDialogOpenState,
  Web_App_App_OrganizationRevision,
  Web_App_App_OrganizationState,
  Web_App_App_Phase,
  Web_App_App_PhaseState,
  Web_App_App_ProfileDialogMode,
  Web_App_App_ProfileDialogModeState,
  Web_App_App_ProfileFolderOverlaps,
  Web_App_App_ProfileFolderOverlapsState,
  Web_App_App_Profiles,
  Web_App_App_ProfilesState,
  Web_App_App_Protection,
  Web_App_App_Providers,
  Web_App_App_ProvidersState,
  Web_App_App_RefreshAccessData,
  Web_App_App_RefreshAccessData_AccessResults,
  Web_App_App_RefreshAccessData_Returns,
  Web_App_App_RefreshAccessData_TokensResult,
  Web_App_App_RefreshAccessData_WebProxyResult,
  Web_App_App_RefreshDetail,
  Web_App_App_RefreshDetail_Detail,
  Web_App_App_RefreshDetail_Returns,
  Web_App_App_RefreshIntervalID,
  Web_App_App_RefreshOrganization,
  Web_App_App_RefreshOrganization_NextOrganization,
  Web_App_App_RefreshOrganization_Returns,
  Web_App_App_RefreshRunning,
  Web_App_App_RefreshTorrentDetail,
  Web_App_App_RefreshTorrentDetail_Detail,
  Web_App_App_RefreshTorrentDetail_Returns,
  Web_App_App_RefreshTorrentDetail_TorrentId,
  Web_App_App_RefreshTorrentOrganization,
  Web_App_App_RefreshTorrentOrganization_Returns,
  Web_App_App_RefreshVPNData,
  Web_App_App_RefreshVPNData_NextProviders,
  Web_App_App_RefreshVPNData_ProfileGroups,
  Web_App_App_RefreshVPNData_Returns,
  Web_App_App_RemovedSecrets,
  Web_App_App_RemovedSecretsState,
  Web_App_App_RenderLibraryNavigation,
  Web_App_App_RenderLibraryNavigation_MoveCount,
  Web_App_App_RenderLibraryNavigation_OnSheetClose,
  Web_App_App_RenderLibraryNavigation_Returns,
  Web_App_App_RenderView,
  Web_App_App_RenderView_DefaultResponse,
  Web_App_App_RenderView_DeleteResponse,
  Web_App_App_RenderView_NextToken,
  Web_App_App_RenderView_NextWebProxy,
  Web_App_App_RenderView_Overlapping,
  Web_App_App_RenderView_Returns,
  Web_App_App_RenderView_RpcCredential,
  Web_App_App_RenderView_UploadedProfiles,
  Web_App_App_RenderView_WebProxyCredential,
  Web_App_App_Returns,
  Web_App_App_RpcEnabled,
  Web_App_App_RpcLogins,
  Web_App_App_RpcLoginsState,
  Web_App_App_RpcSetting,
  Web_App_App_SaveSettings,
  Web_App_App_SaveSettings_Changes,
  Web_App_App_SaveSettings_NextSettings,
  Web_App_App_SaveSettings_Returns,
  Web_App_App_SaveTorrentOrganization,
  Web_App_App_SaveTorrentOrganization_AcceptUpdate,
  Web_App_App_SaveTorrentOrganization_AcceptUpdate_NextOrganization,
  Web_App_App_SaveTorrentOrganization_AcceptUpdate_Returns,
  Web_App_App_SaveTorrentOrganization_AcceptUpdate_TorrentList,
  Web_App_App_SaveTorrentOrganization_Input,
  Web_App_App_SaveTorrentOrganization_LatestOrganization,
  Web_App_App_SaveTorrentOrganization_MergedInput,
  Web_App_App_SaveTorrentOrganization_NextOrganization,
  Web_App_App_SaveTorrentOrganization_OpenedOrganization,
  Web_App_App_SaveTorrentOrganization_Returns,
  Web_App_App_SaveTorrentProfile,
  Web_App_App_SaveTorrentProfile_BaseComparison,
  Web_App_App_SaveTorrentProfile_CreatedProfile,
  Web_App_App_SaveTorrentProfile_DefaultProfileInput,
  Web_App_App_SaveTorrentProfile_Input,
  Web_App_App_SaveTorrentProfile_MoveTorrents,
  Web_App_App_SaveTorrentProfile_NamedInput,
  Web_App_App_SaveTorrentProfile_Returns,
  Web_App_App_SaveTorrentProfile_UpdatedDefaultProfile,
  Web_App_App_SaveTorrentProfile_UpdatedProfile,
  Web_App_App_SelectedTorrentID,
  Web_App_App_SelectedTorrentIDState,
  Web_App_App_SelectTorrent,
  Web_App_App_SelectTorrent_Detail,
  Web_App_App_SelectTorrent_Returns,
  Web_App_App_SelectTorrent_Torrent,
  Web_App_App_SetActiveRoute,
  Web_App_App_SetAddDialogOpen,
  Web_App_App_SetAddVPNConnectionDialogOpen,
  Web_App_App_SetAdministrator,
  Web_App_App_SetDefaultTorrentProfile,
  Web_App_App_SetDeletingTorrentProfile,
  Web_App_App_SetDeletingTorrentProfileBusy,
  Web_App_App_SetDeletingTorrentProfileError,
  Web_App_App_SetDeletingTorrentProfileMoveCount,
  Web_App_App_SetDeletingTorrentProfileMoveResults,
  Web_App_App_SetEditingTorrentProfile,
  Web_App_App_SetFiltersSheetOpen,
  Web_App_App_SetOrganization,
  Web_App_App_SetOrganizationDialogOpen,
  Web_App_App_SetPhase,
  Web_App_App_SetProfileDialogMode,
  Web_App_App_SetProfileFolderOverlaps,
  Web_App_App_SetProfiles,
  Web_App_App_SetProviders,
  Web_App_App_SetRemovedSecrets,
  Web_App_App_SetRPCLogins,
  Web_App_App_SetSelectedTorrentID,
  Web_App_App_SetSettings,
  Web_App_App_SetSettingsDirty,
  Web_App_App_SetSnapshot,
  Web_App_App_SetStartupError,
  Web_App_App_Settings,
  Web_App_App_SettingsDirty,
  Web_App_App_SettingsDirtyState,
  Web_App_App_SettingsState,
  Web_App_App_SetTokens,
  Web_App_App_SetTorrentDetail,
  Web_App_App_SetTorrentDetailLoading,
  Web_App_App_SetTorrentFilters,
  Web_App_App_SetTorrentProfileAndRefreshLabels,
  Web_App_App_SetTorrentProfileAndRefreshLabels_Input,
  Web_App_App_SetTorrentProfileAndRefreshLabels_Result,
  Web_App_App_SetTorrentProfileAndRefreshLabels_Returns,
  Web_App_App_SetTorrentProfiles,
  Web_App_App_SetVPNConnections,
  Web_App_App_SetVPNNavigationSequence,
  Web_App_App_SetVPNNavigationTarget,
  Web_App_App_SetWebProxy,
  Web_App_App_SignOut,
  Web_App_App_SignOut_Returns,
  Web_App_App_SignOut_RootNavigation,
  Web_App_App_Snapshot,
  Web_App_App_SnapshotErrors,
  Web_App_App_SnapshotOrganizationRevision,
  Web_App_App_SnapshotSequence,
  Web_App_App_SnapshotState,
  Web_App_App_SnapshotStatistics,
  Web_App_App_SnapshotTorrents,
  Web_App_App_StartupError,
  Web_App_App_StartupErrorState,
  Web_App_App_StartWebProxyRefresh,
  Web_App_App_StartWebProxyRefresh_Returns,
  Web_App_App_StopWebProxyRefresh,
  Web_App_App_StopWebProxyRefresh_Returns,
  Web_App_App_Tokens,
  Web_App_App_TokensState,
  Web_App_App_TorrentDetail,
  Web_App_App_TorrentDetailLoading,
  Web_App_App_TorrentDetailLoadingState,
  Web_App_App_TorrentDetailState,
  Web_App_App_TorrentFilters,
  Web_App_App_TorrentFiltersState,
  Web_App_App_TorrentLabels,
  Web_App_App_TorrentProfiles,
  Web_App_App_TorrentProfilesState,
  Web_App_App_UpdateTorrentsAndRefreshLabels,
  Web_App_App_UpdateTorrentsAndRefreshLabels_Changes,
  Web_App_App_UpdateTorrentsAndRefreshLabels_Hashes,
  Web_App_App_UpdateTorrentsAndRefreshLabels_Returns,
  Web_App_App_VpnConnections,
  Web_App_App_VpnConnectionsState,
  Web_App_App_VpnNavigationSequence,
  Web_App_App_VpnNavigationSequenceState,
  Web_App_App_VpnNavigationTarget,
  Web_App_App_VpnNavigationTargetState,
  Web_App_App_WebProxy,
  Web_App_App_WebProxyState,
  Web_App_DescribeRemovedSecret_RemovedSecret,
  Web_App_DescribeRemovedSecret_Returns,
  Web_App_InitialDefaultTorrentProfile,
} from '@/types/web/app.d.ts';

// What each secret removed with a lost key asks for, and the page where it is entered again.

/**
 * App - Describe Removed Secret.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_App_DescribeRemovedSecret_RemovedSecret} removedSecret - Removed secret.
 *
 * @returns {Web_App_DescribeRemovedSecret_Returns}
 *
 * @since 2.0.0
 */
const describeRemovedSecret = (removedSecret: Web_App_DescribeRemovedSecret_RemovedSecret): Web_App_DescribeRemovedSecret_Returns => {
  if (removedSecret['kind'] === 'notification') {
    return {
      label: `Set up the ${removedSecret['name'] ?? 'removed'} notification again`,
      view: 'notifications',
    };
  }

  if (removedSecret['kind'] === 'vpn') {
    return {
      label: 'Enter the VPN connection details again',
      view: 'vpn',
    };
  }

  return {
    label: 'Set up the authenticator app',
    view: 'security',
  };
};

/**
 * App - Initial Default Torrent Profile.
 *
 * Supplies a complete loading and signed-out fallback until configuration is read.
 * The first profile response replaces it before the editor can be opened.
 *
 * @since 2.0.0
 */
const initialDefaultTorrentProfile: Web_App_InitialDefaultTorrentProfile = {
  downloadDirectory: '/data/downloads',
  downloadDirectoryLocked: false,
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
 * App - App.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {Web_App_App_Returns}
 *
 * @since 2.0.0
 */
export const App = (): Web_App_App_Returns => {
  const initialNavigation: Web_App_App_InitialNavigation = resolveAppNavigationPath(window.location.pathname);
  const phaseState: Web_App_App_PhaseState = useState<Web_App_App_Phase>('loading');
  const phase: Web_App_App_Phase = phaseState[0];
  const setPhase: Web_App_App_SetPhase = phaseState[1];
  const administratorState: Web_App_App_AdministratorState = useState<Web_App_App_Administrator>(null);
  const administrator: Web_App_App_Administrator = administratorState[0];
  const setAdministrator: Web_App_App_SetAdministrator = administratorState[1];
  const activeRouteState: Web_App_App_ActiveRouteState = useState<Web_App_App_ActiveRoute>(initialNavigation['route']);
  const activeRoute: Web_App_App_ActiveRoute = activeRouteState[0];
  const setActiveRoute: Web_App_App_SetActiveRoute = activeRouteState[1];
  const activeView: Web_App_App_ActiveView = activeRoute['view'];
  const snapshotState: Web_App_App_SnapshotState = useState<Web_App_App_Snapshot>(null);
  const snapshot: Web_App_App_Snapshot = snapshotState[0];
  const setSnapshot: Web_App_App_SetSnapshot = snapshotState[1];
  const settingsState: Web_App_App_SettingsState = useState<Web_App_App_Settings>(null);
  const settings: Web_App_App_Settings = settingsState[0];
  const setSettings: Web_App_App_SetSettings = settingsState[1];
  const organizationState: Web_App_App_OrganizationState = useState<Web_App_App_Organization>(null);
  const organization: Web_App_App_Organization = organizationState[0];
  const setOrganization: Web_App_App_SetOrganization = organizationState[1];
  const providersState: Web_App_App_ProvidersState = useState<Web_App_App_Providers>([]);
  const providers: Web_App_App_Providers = providersState[0];
  const setProviders: Web_App_App_SetProviders = providersState[1];
  const profilesState: Web_App_App_ProfilesState = useState<Web_App_App_Profiles>([]);
  const profiles: Web_App_App_Profiles = profilesState[0];
  const setProfiles: Web_App_App_SetProfiles = profilesState[1];
  const torrentProfilesState: Web_App_App_TorrentProfilesState = useState<Web_App_App_TorrentProfiles>([]);
  const torrentProfiles: Web_App_App_TorrentProfiles = torrentProfilesState[0];
  const setTorrentProfiles: Web_App_App_SetTorrentProfiles = torrentProfilesState[1];
  const profileFolderOverlapsState: Web_App_App_ProfileFolderOverlapsState = useState<Web_App_App_ProfileFolderOverlaps>([]);
  const profileFolderOverlaps: Web_App_App_ProfileFolderOverlaps = profileFolderOverlapsState[0];
  const setProfileFolderOverlaps: Web_App_App_SetProfileFolderOverlaps = profileFolderOverlapsState[1];
  const defaultTorrentProfileState: Web_App_App_DefaultTorrentProfileState = useState<Web_App_App_DefaultTorrentProfile>(initialDefaultTorrentProfile);
  const defaultTorrentProfile: Web_App_App_DefaultTorrentProfile = defaultTorrentProfileState[0];
  const setDefaultTorrentProfile: Web_App_App_SetDefaultTorrentProfile = defaultTorrentProfileState[1];
  const tokensState: Web_App_App_TokensState = useState<Web_App_App_Tokens>([]);
  const tokens: Web_App_App_Tokens = tokensState[0];
  const setTokens: Web_App_App_SetTokens = tokensState[1];
  const rpcLoginsState: Web_App_App_RpcLoginsState = useState<Web_App_App_RpcLogins>([]);
  const rpcLogins: Web_App_App_RpcLogins = rpcLoginsState[0];
  const setRPCLogins: Web_App_App_SetRPCLogins = rpcLoginsState[1];
  const webProxyState: Web_App_App_WebProxyState = useState<Web_App_App_WebProxy>(null);
  const webProxy: Web_App_App_WebProxy = webProxyState[0];
  const setWebProxy: Web_App_App_SetWebProxy = webProxyState[1];
  const vpnConnectionsState: Web_App_App_VpnConnectionsState = useState<Web_App_App_VpnConnections>(null);
  const vpnConnections: Web_App_App_VpnConnections = vpnConnectionsState[0];
  const setVPNConnections: Web_App_App_SetVPNConnections = vpnConnectionsState[1];
  const vpnNavigationSequenceState: Web_App_App_VpnNavigationSequenceState = useState<Web_App_App_VpnNavigationSequence>(0);
  const vpnNavigationSequence: Web_App_App_VpnNavigationSequence = vpnNavigationSequenceState[0];
  const setVPNNavigationSequence: Web_App_App_SetVPNNavigationSequence = vpnNavigationSequenceState[1];
  const vpnNavigationTargetState: Web_App_App_VpnNavigationTargetState = useState<Web_App_App_VpnNavigationTarget>({ kind: 'list' });
  const vpnNavigationTarget: Web_App_App_VpnNavigationTarget = vpnNavigationTargetState[0];
  const setVPNNavigationTarget: Web_App_App_SetVPNNavigationTarget = vpnNavigationTargetState[1];
  const addDialogOpenState: Web_App_App_AddDialogOpenState = useState<Web_App_App_AddDialogOpen>(false);
  const addDialogOpen: Web_App_App_AddDialogOpen = addDialogOpenState[0];
  const setAddDialogOpen: Web_App_App_SetAddDialogOpen = addDialogOpenState[1];
  const addVPNConnectionDialogOpenState: Web_App_App_AddVPNConnectionDialogOpenState = useState<Web_App_App_AddVPNConnectionDialogOpen>(false);
  const addVPNConnectionDialogOpen: Web_App_App_AddVPNConnectionDialogOpen = addVPNConnectionDialogOpenState[0];
  const setAddVPNConnectionDialogOpen: Web_App_App_SetAddVPNConnectionDialogOpen = addVPNConnectionDialogOpenState[1];
  const selectedTorrentIDState: Web_App_App_SelectedTorrentIDState = useState<Web_App_App_SelectedTorrentID>(null);
  const selectedTorrentID: Web_App_App_SelectedTorrentID = selectedTorrentIDState[0];
  const setSelectedTorrentID: Web_App_App_SetSelectedTorrentID = selectedTorrentIDState[1];
  const torrentDetailState: Web_App_App_TorrentDetailState = useState<Web_App_App_TorrentDetail>(null);
  const torrentDetail: Web_App_App_TorrentDetail = torrentDetailState[0];
  const setTorrentDetail: Web_App_App_SetTorrentDetail = torrentDetailState[1];
  const torrentDetailLoadingState: Web_App_App_TorrentDetailLoadingState = useState<Web_App_App_TorrentDetailLoading>(false);
  const torrentDetailLoading: Web_App_App_TorrentDetailLoading = torrentDetailLoadingState[0];
  const setTorrentDetailLoading: Web_App_App_SetTorrentDetailLoading = torrentDetailLoadingState[1];
  const startupErrorState: Web_App_App_StartupErrorState = useState<Web_App_App_StartupError>('');
  const startupError: Web_App_App_StartupError = startupErrorState[0];
  const setStartupError: Web_App_App_SetStartupError = startupErrorState[1];
  const torrentFiltersState: Web_App_App_TorrentFiltersState = useState<Web_App_App_TorrentFilters>({
    connection: '',
    label: '',
    profile: '',
    status: 'all',
  });
  const torrentFilters: Web_App_App_TorrentFilters = torrentFiltersState[0];
  const setTorrentFilters: Web_App_App_SetTorrentFilters = torrentFiltersState[1];
  const filtersSheetOpenState: Web_App_App_FiltersSheetOpenState = useState<Web_App_App_FiltersSheetOpen>(false);
  const filtersSheetOpen: Web_App_App_FiltersSheetOpen = filtersSheetOpenState[0];
  const setFiltersSheetOpen: Web_App_App_SetFiltersSheetOpen = filtersSheetOpenState[1];
  const organizationDialogOpenState: Web_App_App_OrganizationDialogOpenState = useState<Web_App_App_OrganizationDialogOpen>(false);
  const organizationDialogOpen: Web_App_App_OrganizationDialogOpen = organizationDialogOpenState[0];
  const setOrganizationDialogOpen: Web_App_App_SetOrganizationDialogOpen = organizationDialogOpenState[1];
  const profileDialogModeState: Web_App_App_ProfileDialogModeState = useState<Web_App_App_ProfileDialogMode>(null);
  const profileDialogMode: Web_App_App_ProfileDialogMode = profileDialogModeState[0];
  const setProfileDialogMode: Web_App_App_SetProfileDialogMode = profileDialogModeState[1];
  const editingTorrentProfileState: Web_App_App_EditingTorrentProfileState = useState<Web_App_App_EditingTorrentProfile>(null);
  const editingTorrentProfile: Web_App_App_EditingTorrentProfile = editingTorrentProfileState[0];
  const setEditingTorrentProfile: Web_App_App_SetEditingTorrentProfile = editingTorrentProfileState[1];
  const deletingTorrentProfileState: Web_App_App_DeletingTorrentProfileState = useState<Web_App_App_DeletingTorrentProfile>(null);
  const deletingTorrentProfile: Web_App_App_DeletingTorrentProfile = deletingTorrentProfileState[0];
  const setDeletingTorrentProfile: Web_App_App_SetDeletingTorrentProfile = deletingTorrentProfileState[1];
  const deletingTorrentProfileBusyState: Web_App_App_DeletingTorrentProfileBusyState = useState<Web_App_App_DeletingTorrentProfileBusy>(false);
  const deletingTorrentProfileBusy: Web_App_App_DeletingTorrentProfileBusy = deletingTorrentProfileBusyState[0];
  const setDeletingTorrentProfileBusy: Web_App_App_SetDeletingTorrentProfileBusy = deletingTorrentProfileBusyState[1];
  const deletingTorrentProfileErrorState: Web_App_App_DeletingTorrentProfileErrorState = useState<Web_App_App_DeletingTorrentProfileError>('');
  const deletingTorrentProfileError: Web_App_App_DeletingTorrentProfileError = deletingTorrentProfileErrorState[0];
  const setDeletingTorrentProfileError: Web_App_App_SetDeletingTorrentProfileError = deletingTorrentProfileErrorState[1];
  const deletingTorrentProfileMoveCountState: Web_App_App_DeletingTorrentProfileMoveCountState = useState<Web_App_App_DeletingTorrentProfileMoveCount>(0);
  const deletingTorrentProfileMoveCount: Web_App_App_DeletingTorrentProfileMoveCount = deletingTorrentProfileMoveCountState[0];
  const setDeletingTorrentProfileMoveCount: Web_App_App_SetDeletingTorrentProfileMoveCount = deletingTorrentProfileMoveCountState[1];
  const deletingTorrentProfileMoveResultsState: Web_App_App_DeletingTorrentProfileMoveResultsState = useState<Web_App_App_DeletingTorrentProfileMoveResults>(null);
  const deletingTorrentProfileMoveResults: Web_App_App_DeletingTorrentProfileMoveResults = deletingTorrentProfileMoveResultsState[0];
  const setDeletingTorrentProfileMoveResults: Web_App_App_SetDeletingTorrentProfileMoveResults = deletingTorrentProfileMoveResultsState[1];
  const removedSecretsState: Web_App_App_RemovedSecretsState = useState<Web_App_App_RemovedSecrets>([]);
  const removedSecrets: Web_App_App_RemovedSecrets = removedSecretsState[0];
  const setRemovedSecrets: Web_App_App_SetRemovedSecrets = removedSecretsState[1];
  const settingsDirtyState: Web_App_App_SettingsDirtyState = useState<Web_App_App_SettingsDirty>(false);
  const settingsDirty: Web_App_App_SettingsDirty = settingsDirtyState[0];
  const setSettingsDirty: Web_App_App_SetSettingsDirty = settingsDirtyState[1];

  /**
   * App - Apply App Route.
   *
   * Keeps the rendered page and VPN editor target synchronized with a resolved
   * address. Browser Back and Forward reuse this transition without pushing.
   *
   * @param {Web_App_App_ApplyAppRoute_Route} route - Route.
   *
   * @returns {Web_App_App_ApplyAppRoute_Returns}
   *
   * @since 2.0.0
   */
  const applyAppRoute: Web_App_App_ApplyAppRoute = (route: Web_App_App_ApplyAppRoute_Route): Web_App_App_ApplyAppRoute_Returns => {
    setSettingsDirty(false);
    setActiveRoute(route);

    if (route['view'] === 'vpn') {
      setVPNNavigationTarget(route['vpnTarget'] ?? { kind: 'list' });
      setVPNNavigationSequence((currentSequence) => currentSequence + 1);
    }

    window.scrollTo(0, 0);

    return;
  };

  /**
   * App - Open Route.
   *
   * Preserves the existing unsaved-settings guard, updates browser history,
   * and then applies the matching page state. Replacements are reserved for
   * invalid dynamic destinations.
   *
   * @param {Web_App_App_OpenRoute_Route}   route     - Route.
   * @param {Web_App_App_OpenRoute_Replace} [replace] - Replace.
   *
   * @returns {Web_App_App_OpenRoute_Returns}
   *
   * @since 2.0.0
   */
  const openRoute: Web_App_App_OpenRoute = (
    route: Web_App_App_OpenRoute_Route,
    replace: Web_App_App_OpenRoute_Replace = false,
  ): Web_App_App_OpenRoute_Returns => {
    if (route['view'] === activeView && route['view'] !== 'vpn') {
      return;
    }

    if (settingsDirty === true && window.confirm('Discard your unsaved changes?') === false) {
      return;
    }

    setSettingsDirty(false);

    if (replace === true) {
      replaceNavigationPath(window, route['path']);
    } else {
      pushNavigationPath(window, route['path']);
    }

    applyAppRoute(route);

    return;
  };

  /**
   * App - Open View.
   *
   * Resolves shell destinations through the app-owned path table before the
   * shared History API transition runs.
   *
   * @param {Web_App_App_OpenView_View} view - View.
   *
   * @returns {Web_App_App_OpenView_Returns}
   *
   * @since 2.0.0
   */
  const openView: Web_App_App_OpenView = (view: Web_App_App_OpenView_View): Web_App_App_OpenView_Returns => {
    openRoute(appRouteForView(view));

    return;
  };

  /**
   * App - Open Vpn.
   *
   * Gives the list, new editor, and existing connection editor distinct paths.
   * The same transition supports pushed and replacement destinations.
   *
   * @param {Web_App_App_OpenVPN_Target}  target    - Target.
   * @param {Web_App_App_OpenVPN_Replace} [replace] - Replace.
   *
   * @returns {Web_App_App_OpenVPN_Returns}
   *
   * @since 2.0.0
   */
  const openVPN: Web_App_App_OpenVPN = (
    target: Web_App_App_OpenVPN_Target,
    replace: Web_App_App_OpenVPN_Replace = false,
  ): Web_App_App_OpenVPN_Returns => {
    openRoute(appRouteForVPNTarget(target), replace);

    return;
  };

  useEffect(() => startNavigationHistory(
    window,
    resolveAppNavigationPath,
    applyAppRoute,
  ), []);

  const incompleteDirectorySetting: Web_App_App_IncompleteDirectorySetting = (settings !== null) ? settings['settings'].find((setting) => (
    setting['key'] === 'transmission.incompleteDirectory'
  )) : undefined;
  const incompleteDirectory: Web_App_App_IncompleteDirectory = (
    incompleteDirectorySetting !== undefined
    && typeof incompleteDirectorySetting['value'] === 'string'
  ) ? incompleteDirectorySetting['value'] : undefined;
  const snapshotTorrents: Web_App_App_SnapshotTorrents = (snapshot !== null) ? snapshot['torrents'] : undefined;
  const organizationRevision: Web_App_App_OrganizationRevision = (organization !== null) ? organization['revision'] : undefined;
  const snapshotOrganizationRevision: Web_App_App_SnapshotOrganizationRevision = (snapshot !== null) ? snapshot['organizationRevision'] : undefined;
  const snapshotSequence: Web_App_App_SnapshotSequence = (snapshot !== null) ? snapshot['sequence'] : undefined;
  const torrentLabels: Web_App_App_TorrentLabels = useMemo(() => {
    const labelsByKey: Web_App_App_LabelsByKey = new Map();

    for (const label of (organization !== null) ? organization['labels'] : []) {
      labelsByKey.set(label.toLowerCase(), label);
    }

    for (const torrent of (snapshot !== null) ? snapshot['torrents'] : []) {
      for (const label of torrent['labels']) {
        if (labelsByKey.has(label.toLowerCase()) === false) {
          labelsByKey.set(label.toLowerCase(), label);
        }
      }
    }

    return [...labelsByKey.values()].sort((leftLabel, rightLabel) => (
      leftLabel.localeCompare(rightLabel, undefined, { sensitivity: 'base' })
    ));
  }, [
    organization,
    snapshotTorrents,
  ]);

  /**
   * App - Load Configuration.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @returns {Web_App_App_LoadConfiguration_Returns}
   *
   * @since 2.0.0
   */
  const loadConfiguration: Web_App_App_LoadConfiguration = async (): Web_App_App_LoadConfiguration_Returns => {
    const configurationResults: Web_App_App_LoadConfiguration_ConfigurationResults = await Promise.all([
      getSettings(),
      getProviders(),
      getTokens(),
      getTorrentOrganization(),
      getRPCLogins(),
      getWebProxy(),
      getVPNConnections(),
      getTorrentProfiles(),
    ]);
    const nextSettings: Web_App_App_LoadConfiguration_NextSettings = configurationResults[0];
    const nextProviders: Web_App_App_LoadConfiguration_NextProviders = configurationResults[1];
    const nextTokens: Web_App_App_LoadConfiguration_NextTokens = configurationResults[2];
    const nextOrganization: Web_App_App_LoadConfiguration_NextOrganization = configurationResults[3];
    const nextRPCLogins: Web_App_App_LoadConfiguration_NextRPCLogins = configurationResults[4];
    const nextWebProxy: Web_App_App_LoadConfiguration_NextWebProxy = configurationResults[5];
    const nextVPNConnections: Web_App_App_LoadConfiguration_NextVPNConnections = configurationResults[6];
    const nextTorrentProfiles: Web_App_App_LoadConfiguration_NextTorrentProfiles = configurationResults[7];
    const profileGroups: Web_App_App_LoadConfiguration_ProfileGroups = await Promise.all(
      nextProviders.map(async (provider) => getProfiles(provider['id'])),
    );

    setSettings(nextSettings);
    setProviders(nextProviders);
    setProfiles(profileGroups.flat());
    setTokens(nextTokens);
    setOrganization(nextOrganization);
    setRPCLogins(nextRPCLogins);
    setWebProxy(nextWebProxy);
    setVPNConnections(nextVPNConnections);
    setDefaultTorrentProfile(nextTorrentProfiles['defaultProfile']);
    setTorrentProfiles(nextTorrentProfiles['profiles']);
    setProfileFolderOverlaps(nextTorrentProfiles['folderOverlaps'] ?? []);

    return;
  };

  /**
   * App - Enter Application.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @returns {Web_App_App_EnterApplication_Returns}
   *
   * @since 2.0.0
   */
  const enterApplication: Web_App_App_EnterApplication = async (): Web_App_App_EnterApplication_Returns => {
    const currentAdministrator: Web_App_App_EnterApplication_CurrentAdministrator = await getCurrentAdministrator();

    if (currentAdministrator === null) {
      setPhase('login');

      return;
    }

    setAdministrator(currentAdministrator);
    setRemovedSecrets(currentAdministrator['removedSecrets'] ?? []);
    applyNavigationPath(window, resolveAppNavigationPath, applyAppRoute);
    setPhase('application');

    await loadConfiguration();

    return;
  };

  // The notice shrinks as secrets are entered again, so the list is read again after each one.

  /**
   * App - Load Removed Secrets.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @returns {Web_App_App_LoadRemovedSecrets_Returns}
   *
   * @since 2.0.0
   */
  const loadRemovedSecrets: Web_App_App_LoadRemovedSecrets = async (): Web_App_App_LoadRemovedSecrets_Returns => {
    const currentAdministrator: Web_App_App_LoadRemovedSecrets_CurrentAdministrator = await getCurrentAdministrator();

    setRemovedSecrets((currentAdministrator !== null) ? (currentAdministrator['removedSecrets'] ?? []) : []);

    return;
  };

  useEffect(() => {
    /**
     * App - Bootstrap.
     *
     * Centralizes this operation for the surrounding workflow.
     * Callers reuse one implementation instead of repeating the behavior.
     *
     * @returns {Web_App_App_Bootstrap_Returns}
     *
     * @since 2.0.0
     */
    const bootstrap: Web_App_App_Bootstrap = async (): Web_App_App_Bootstrap_Returns => {
      setStartupError('');

      try {
        const setupStatus: Web_App_App_Bootstrap_SetupStatus = await getSetupStatus();

        if (setupStatus['claimRequired'] === true) {
          setPhase('claim');

          return;
        }

        await enterApplication();
      } catch (caughtError) {
        setStartupError((caughtError instanceof Error) ? caughtError.message : 'The appliance could not be loaded.');
      }

      return;
    };

    void bootstrap();

    return;
  }, []);

  useEffect(() => {
    if (phase !== 'application') {
      return undefined;
    }

    return connectLiveEvents(
      (nextSnapshot) => setSnapshot(nextSnapshot),
    );
  }, [phase]);

  useEffect(() => {
    if (
      phase !== 'application'
      || organization === null
      || snapshot === null
      || organization['revision'] === snapshot['organizationRevision']
    ) {
      return undefined;
    }

    let effectActive: Web_App_App_EffectActive = true;

    /**
     * App - Refresh Organization.
     *
     * Profile, compatible RPC, and other-console writes surface through the live
     * snapshot, then this request replaces every saved-label picker without reload.
     *
     * @returns {Web_App_App_RefreshOrganization_Returns}
     *
     * @since 2.0.0
     */
    const refreshOrganization: Web_App_App_RefreshOrganization = async (): Web_App_App_RefreshOrganization_Returns => {
      try {
        const nextOrganization: Web_App_App_RefreshOrganization_NextOrganization = await getTorrentOrganization();

        if (effectActive === true) {
          setOrganization(nextOrganization);
        }
      } catch {
        // Focus refresh and a later live revision retain recovery paths.
      }

      return;
    };

    void refreshOrganization();

    return () => {
      effectActive = false;

      return;
    };
  }, [
    organizationRevision,
    phase,
    snapshotOrganizationRevision,
  ]);

  useEffect(() => {
    if (phase !== 'application') {
      return undefined;
    }

    let effectActive: Web_App_App_EffectActive = true;

    /**
     * App - Refresh Organization.
     *
     * Makes changes from another browser tab visible in the sidebar without
     * replacing an open dialog's local draft.
     *
     * @returns {Web_App_App_RefreshOrganization_Returns}
     *
     * @since 2.0.0
     */
    const refreshOrganization: Web_App_App_RefreshOrganization = async (): Web_App_App_RefreshOrganization_Returns => {
      try {
        const nextOrganization: Web_App_App_RefreshOrganization_NextOrganization = await getTorrentOrganization();

        if (effectActive === true) {
          setOrganization(nextOrganization);
        }
      } catch {
        // The live page stays usable and the next focus gets another chance.
      }

      return;
    };

    /**
     * App - On Focus.
     *
     * Starts the asynchronous refresh without blocking the browser focus event.
     * The listener itself therefore remains synchronous.
     *
     * @returns {Web_App_App_OnFocus_Returns}
     *
     * @since 2.4.1
     */
    const onFocus: Web_App_App_OnFocus = (): Web_App_App_OnFocus_Returns => {
      void refreshOrganization();

      return;
    };

    window.addEventListener('focus', onFocus);

    return () => {
      effectActive = false;

      window.removeEventListener('focus', onFocus);

      return;
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'application' || activeView !== 'access') {
      return undefined;
    }

    let effectActive: Web_App_App_EffectActive = true;
    let refreshIntervalID: Web_App_App_RefreshIntervalID = undefined;
    let refreshRunning: Web_App_App_RefreshRunning = false;

    /**
     * App - Refresh Access Data.
     *
     * Reads observed proxy state and token last-use times without replacing any
     * local dialog state. Slow requests never overlap or update after this view closes.
     *
     * @returns {Web_App_App_RefreshAccessData_Returns}
     *
     * @since 2.0.0
     */
    const refreshAccessData: Web_App_App_RefreshAccessData = async (): Web_App_App_RefreshAccessData_Returns => {
      if (refreshRunning === true || document.visibilityState !== 'visible') {
        return;
      }

      refreshRunning = true;

      try {
        const accessResults: Web_App_App_RefreshAccessData_AccessResults = await Promise.allSettled([
          getWebProxy(),
          getTokens(),
        ]);
        const webProxyResult: Web_App_App_RefreshAccessData_WebProxyResult = accessResults[0];
        const tokensResult: Web_App_App_RefreshAccessData_TokensResult = accessResults[1];

        if (effectActive === true && document.visibilityState === 'visible') {
          if (webProxyResult.status === 'fulfilled') {
            setWebProxy(webProxyResult.value);
          }

          if (tokensResult.status === 'fulfilled') {
            setTokens(tokensResult.value);
          }
        }
      } finally {
        refreshRunning = false;
      }

      return;
    };

    /**
     * App - Stop Web Proxy Refresh.
     *
     * Clears the active timer while the page is hidden or another view is open.
     * The next visible start performs an immediate read before scheduling more.
     *
     * @returns {Web_App_App_StopWebProxyRefresh_Returns}
     *
     * @since 2.0.0
     */
    const stopWebProxyRefresh: Web_App_App_StopWebProxyRefresh = (): Web_App_App_StopWebProxyRefresh_Returns => {
      if (refreshIntervalID === undefined) {
        return;
      }

      window.clearInterval(refreshIntervalID);

      refreshIntervalID = undefined;

      return;
    };

    /**
     * App - Start Web Proxy Refresh.
     *
     * Refreshes immediately and then every three seconds while the page is visible.
     * Repeated visibility events cannot create duplicate timers.
     *
     * @returns {Web_App_App_StartWebProxyRefresh_Returns}
     *
     * @since 2.0.0
     */
    const startWebProxyRefresh: Web_App_App_StartWebProxyRefresh = (): Web_App_App_StartWebProxyRefresh_Returns => {
      if (document.visibilityState !== 'visible' || refreshIntervalID !== undefined) {
        return;
      }

      void refreshAccessData();

      refreshIntervalID = window.setInterval(() => {
        void refreshAccessData();

        return;
      }, 3000);

      return;
    };

    /**
     * App - Handle Web Proxy Visibility Change.
     *
     * Pauses network reads in hidden tabs and resumes them when visible again.
     * Keeping the component mounted preserves open dialogs and one-time passwords.
     *
     * @returns {Web_App_App_HandleWebProxyVisibilityChange_Returns}
     *
     * @since 2.0.0
     */
    const handleWebProxyVisibilityChange: Web_App_App_HandleWebProxyVisibilityChange = (): Web_App_App_HandleWebProxyVisibilityChange_Returns => {
      if (document.visibilityState === 'visible') {
        startWebProxyRefresh();

        return;
      }

      stopWebProxyRefresh();

      return;
    };

    document.addEventListener('visibilitychange', handleWebProxyVisibilityChange);

    startWebProxyRefresh();

    return () => {
      effectActive = false;

      stopWebProxyRefresh();

      document.removeEventListener('visibilitychange', handleWebProxyVisibilityChange);

      return;
    };
  }, [
    activeView,
    phase,
  ]);

  /**
   * App - Sign Out.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @returns {Web_App_App_SignOut_Returns}
   *
   * @since 2.0.0
   */
  const signOut: Web_App_App_SignOut = async (): Web_App_App_SignOut_Returns => {
    if (settingsDirty === true && window.confirm('Discard your unsaved changes?') === false) {
      return;
    }

    await logout();

    setSettingsDirty(false);
    setAdministrator(null);
    setRemovedSecrets([]);
    setSnapshot(null);
    setSettings(null);
    setOrganization(null);
    setDefaultTorrentProfile(initialDefaultTorrentProfile);
    setTorrentProfiles([]);
    setRPCLogins([]);
    setWebProxy(null);
    setVPNConnections(null);

    const rootNavigation: Web_App_App_SignOut_RootNavigation = resolveAppNavigationPath('/');

    replaceNavigationPath(window, rootNavigation['path']);
    applyAppRoute(rootNavigation['route']);
    setPhase('login');

    return;
  };

  /**
   * App - Select Torrent.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @param {Web_App_App_SelectTorrent_Torrent} torrent - Torrent.
   *
   * @returns {Web_App_App_SelectTorrent_Returns}
   *
   * @since 2.0.0
   */
  const selectTorrent: Web_App_App_SelectTorrent = async (torrent: Web_App_App_SelectTorrent_Torrent): Web_App_App_SelectTorrent_Returns => {
    setSelectedTorrentID(torrent['id']);
    setTorrentDetail(null);
    setTorrentDetailLoading(true);

    try {
      const detail: Web_App_App_SelectTorrent_Detail = await getTorrentDetail(torrent['id']);

      setTorrentDetail(detail);
    } finally {
      setTorrentDetailLoading(false);
    }

    return;
  };

  /**
   * App - Refresh Torrent Detail.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @param {Web_App_App_RefreshTorrentDetail_TorrentId} torrentId - Torrent id.
   *
   * @returns {Web_App_App_RefreshTorrentDetail_Returns}
   *
   * @since 2.0.0
   */
  const refreshTorrentDetail: Web_App_App_RefreshTorrentDetail = async (torrentId: Web_App_App_RefreshTorrentDetail_TorrentId): Web_App_App_RefreshTorrentDetail_Returns => {
    setSelectedTorrentID(torrentId);

    const detail: Web_App_App_RefreshTorrentDetail_Detail = await getTorrentDetail(torrentId);

    setTorrentDetail(detail);

    return;
  };

  useEffect(() => {
    if (selectedTorrentID === null || snapshot === null) {
      return undefined;
    }

    let cancelled: Web_App_App_Cancelled = false;

    /**
     * App - Refresh Detail.
     *
     * Centralizes this operation for the surrounding workflow.
     * Callers reuse one implementation instead of repeating the behavior.
     *
     * @returns {Web_App_App_RefreshDetail_Returns}
     *
     * @since 2.0.0
     */
    const refreshDetail: Web_App_App_RefreshDetail = async (): Web_App_App_RefreshDetail_Returns => {
      try {
        const detail: Web_App_App_RefreshDetail_Detail = await getTorrentDetail(selectedTorrentID);

        if (cancelled === false) {
          setTorrentDetail(detail);
        }
      } catch {
        if (cancelled === false) {
          setSelectedTorrentID(null);
          setTorrentDetail(null);
        }
      }

      return;
    };

    void refreshDetail();

    return () => {
      cancelled = true;

      return;
    };
  }, [
    selectedTorrentID,
    snapshotSequence,
  ]);

  /**
   * App - Save Settings.
   *
   * Stores this module-level value in one named location.
   * Related code reuses it instead of duplicating the definition.
   *
   * @param {Web_App_App_SaveSettings_Changes} changes - Changes.
   *
   * @returns {Web_App_App_SaveSettings_Returns}
   *
   * @since 2.0.0
   */
  const saveSettings: Web_App_App_SaveSettings = async (
    changes: Web_App_App_SaveSettings_Changes,
  ): Web_App_App_SaveSettings_Returns => {
    if (settings === null) {
      throw new Error('Settings are still loading.');
    }

    const nextSettings: Web_App_App_SaveSettings_NextSettings = await updateSettings({
      expectedRevision: settings['revision'],
      changes,
    }, incompleteDirectory);

    setSettings(nextSettings);

    return;
  };

  /**
   * App - Refresh Vpn Data.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @returns {Web_App_App_RefreshVPNData_Returns}
   *
   * @since 2.0.0
   */
  const refreshVPNData: Web_App_App_RefreshVPNData = async (): Web_App_App_RefreshVPNData_Returns => {
    const nextProviders: Web_App_App_RefreshVPNData_NextProviders = await getProviders();
    const profileGroups: Web_App_App_RefreshVPNData_ProfileGroups = await Promise.all(
      nextProviders.map(async (provider) => getProfiles(provider['id'])),
    );

    setProviders(nextProviders);
    setProfiles(profileGroups.flat());

    return;
  };

  /**
   * App - Refresh Torrent Organization.
   *
   * Label-using mutations remain successful if this follow-up request is briefly
   * unavailable; the live revision and focus refresh will retry automatically.
   *
   * @returns {Web_App_App_RefreshTorrentOrganization_Returns}
   *
   * @since 2.0.0
   */
  const refreshTorrentOrganization: Web_App_App_RefreshTorrentOrganization = async (): Web_App_App_RefreshTorrentOrganization_Returns => {
    try {
      setOrganization(await getTorrentOrganization());
    } catch {
      // The live revision and focus refresh retain recovery paths.
    }

    try {
      // A saved profile folder can end an overlap, so the fix-it banner is refreshed too.
      setProfileFolderOverlaps((await getTorrentProfiles())['folderOverlaps'] ?? []);
    } catch {
      // The next full refresh retries.
    }

    return;
  };

  /**
   * App - Save Torrent Organization.
   *
   * Stores this module-level value in one named location.
   * Related code reuses it instead of duplicating the definition.
   *
   * @param {Web_App_App_SaveTorrentOrganization_Input} input - Input.
   *
   * @returns {Web_App_App_SaveTorrentOrganization_Returns}
   *
   * @since 2.0.0
   */
  const saveTorrentOrganization: Web_App_App_SaveTorrentOrganization = async (
    input: Web_App_App_SaveTorrentOrganization_Input,
  ): Web_App_App_SaveTorrentOrganization_Returns => {
    const openedOrganization: Web_App_App_SaveTorrentOrganization_OpenedOrganization = {
      labels: torrentLabels,
      revision: input['expectedRevision'],
    };

    /**
     * App - Accept Update.
     *
     * Refreshes the torrent list immediately so server-applied label removals
     * and renames appear without waiting for the next live snapshot.
     *
     * @param {Web_App_App_SaveTorrentOrganization_AcceptUpdate_NextOrganization} nextOrganization - Next organization.
     *
     * @returns {Web_App_App_SaveTorrentOrganization_AcceptUpdate_Returns}
     *
     * @since 2.0.0
     */
    const acceptUpdate: Web_App_App_SaveTorrentOrganization_AcceptUpdate = async (nextOrganization: Web_App_App_SaveTorrentOrganization_AcceptUpdate_NextOrganization): Web_App_App_SaveTorrentOrganization_AcceptUpdate_Returns => {
      setOrganization(nextOrganization);

      const torrentList: Web_App_App_SaveTorrentOrganization_AcceptUpdate_TorrentList = await getTorrents();

      setSnapshot((currentSnapshot) => {
        if (currentSnapshot === null) {
          return currentSnapshot;
        }

        return {
          ...currentSnapshot,
          errors: torrentList['errors'],
          torrents: torrentList['items'],
        };
      });

      if (selectedTorrentID !== null) {
        await refreshTorrentDetail(selectedTorrentID);
      }

      return;
    };

    try {
      const nextOrganization: Web_App_App_SaveTorrentOrganization_NextOrganization = await updateTorrentOrganization(
        input,
      );

      await acceptUpdate(nextOrganization);

      return;
    } catch (caughtError) {
      if (!(caughtError instanceof ApiError) || caughtError['code'] !== 'revision_conflict') {
        throw caughtError;
      }
    }

    const latestOrganization: Web_App_App_SaveTorrentOrganization_LatestOrganization = await getTorrentOrganization();

    setOrganization(latestOrganization);

    const mergedInput: Web_App_App_SaveTorrentOrganization_MergedInput = mergeTorrentOrganizationUpdate(
      openedOrganization,
      input,
      latestOrganization,
    );
    const nextOrganization: Web_App_App_SaveTorrentOrganization_NextOrganization = await updateTorrentOrganization(
      mergedInput,
    );

    await acceptUpdate(nextOrganization);

    return;
  };

  /**
   * App - Open New Torrent Profile.
   *
   * Clears any prior edit before showing the shared profile editor.
   * Default profile values are supplied by the dialog itself.
   *
   * @returns {Web_App_App_OpenNewTorrentProfile_Returns}
   *
   * @since 2.0.0
   */
  const openNewTorrentProfile: Web_App_App_OpenNewTorrentProfile = (): Web_App_App_OpenNewTorrentProfile_Returns => {
    setEditingTorrentProfile(null);
    setProfileDialogMode('create');

    return;
  };

  /**
   * App - Open Default Torrent Profile.
   *
   * Selects the dedicated field set while leaving named profile edit state empty.
   * The dialog then saves through the Default profile endpoint.
   *
   * @returns {Web_App_App_OpenDefaultTorrentProfile_Returns}
   *
   * @since 2.0.0
   */
  const openDefaultTorrentProfile: Web_App_App_OpenDefaultTorrentProfile = (): Web_App_App_OpenDefaultTorrentProfile_Returns => {
    setEditingTorrentProfile(null);
    setProfileDialogMode('default');

    return;
  };

  /**
   * App - Open Torrent Profile.
   *
   * Supplies one existing profile to the shared editor.
   * Saving replaces only the editable profile values.
   *
   * @param {Web_App_App_OpenTorrentProfile_Profile} profile - Profile.
   *
   * @returns {Web_App_App_OpenTorrentProfile_Returns}
   *
   * @since 2.0.0
   */
  const openTorrentProfile: Web_App_App_OpenTorrentProfile = (profile: Web_App_App_OpenTorrentProfile_Profile): Web_App_App_OpenTorrentProfile_Returns => {
    setEditingTorrentProfile(profile);
    setProfileDialogMode('edit');

    return;
  };

  /**
   * App - Save Torrent Profile.
   *
   * Reconciles create and edit responses into the alphabetical local profile list.
   * The server response remains authoritative for identity and overlaps.
   *
   * @param {Web_App_App_SaveTorrentProfile_Input}        input          - Input.
   * @param {Web_App_App_SaveTorrentProfile_MoveTorrents} [moveTorrents] - Move torrents.
   *
   * @returns {Web_App_App_SaveTorrentProfile_Returns}
   *
   * @since 2.0.0
   */
  const saveTorrentProfile: Web_App_App_SaveTorrentProfile = async (
    input: Web_App_App_SaveTorrentProfile_Input,
    moveTorrents: Web_App_App_SaveTorrentProfile_MoveTorrents = false,
  ): Web_App_App_SaveTorrentProfile_Returns => {
    if (profileDialogMode === 'default') {
      const updatedDefaultProfile: Web_App_App_SaveTorrentProfile_UpdatedDefaultProfile = await updateDefaultTorrentProfile(
        input as Web_App_App_SaveTorrentProfile_DefaultProfileInput,
        moveTorrents,
        incompleteDirectory,
      );

      setDefaultTorrentProfile(updatedDefaultProfile);
      setSettings(await getSettings());

      await refreshTorrentOrganization();

      return updatedDefaultProfile['moved'];
    }

    const namedInput: Web_App_App_SaveTorrentProfile_NamedInput = input as Web_App_App_SaveTorrentProfile_NamedInput;

    if (profileDialogMode === 'create') {
      const createdProfile: Web_App_App_SaveTorrentProfile_CreatedProfile = await createTorrentProfile(
        namedInput,
        incompleteDirectory,
      );

      setTorrentProfiles((currentProfiles) => {
        return [
          ...currentProfiles,
          createdProfile,
        ].sort((leftProfile, rightProfile) => {
          const baseComparison: Web_App_App_SaveTorrentProfile_BaseComparison = leftProfile['name'].localeCompare(rightProfile['name'], undefined, { sensitivity: 'base' });

          if (baseComparison !== 0) {
            return baseComparison;
          }

          return leftProfile['name'].localeCompare(rightProfile['name']);
        });
      });

      await refreshTorrentOrganization();

      return [];
    }

    if (editingTorrentProfile === null) {
      throw new Error('Choose a torrent profile to edit.');
    }

    const updatedProfile: Web_App_App_SaveTorrentProfile_UpdatedProfile = await updateTorrentProfile(
      editingTorrentProfile['id'],
      namedInput,
      moveTorrents,
      incompleteDirectory,
    );

    setTorrentProfiles((currentProfiles) => {
      return currentProfiles.map((profile) => (
        (profile['id'] === updatedProfile['id']) ? updatedProfile : profile
      )).sort((leftProfile, rightProfile) => {
        const baseComparison: Web_App_App_SaveTorrentProfile_BaseComparison = leftProfile['name'].localeCompare(rightProfile['name'], undefined, { sensitivity: 'base' });

        if (baseComparison !== 0) {
          return baseComparison;
        }

        return leftProfile['name'].localeCompare(rightProfile['name']);
      });
    });

    await refreshTorrentOrganization();

    return updatedProfile['moved'];
  };

  /**
   * App - Add Torrent And Refresh Labels.
   *
   * Typed labels and labels inherited from the chosen profile become picker choices
   * as soon as the successful add returns.
   *
   * @param {Web_App_App_AddTorrentAndRefreshLabels_Input} input - Input.
   *
   * @returns {Web_App_App_AddTorrentAndRefreshLabels_Returns}
   *
   * @since 2.0.0
   */
  const addTorrentAndRefreshLabels: Web_App_App_AddTorrentAndRefreshLabels = async (
    input: Web_App_App_AddTorrentAndRefreshLabels_Input,
  ): Web_App_App_AddTorrentAndRefreshLabels_Returns => {
    const result: Web_App_App_AddTorrentAndRefreshLabels_Result = await addTorrent(input);

    await refreshTorrentOrganization();

    return result;
  };

  /**
   * App - Update Torrents And Refresh Labels.
   *
   * The follow-up runs only when labels were part of the successful mutation.
   * Other detail changes keep the same request behavior without another fetch.
   *
   * @param {Web_App_App_UpdateTorrentsAndRefreshLabels_Hashes}  hashes  - Hashes.
   * @param {Web_App_App_UpdateTorrentsAndRefreshLabels_Changes} changes - Changes.
   *
   * @returns {Web_App_App_UpdateTorrentsAndRefreshLabels_Returns}
   *
   * @since 2.0.0
   */
  const updateTorrentsAndRefreshLabels: Web_App_App_UpdateTorrentsAndRefreshLabels = async (
    hashes: Web_App_App_UpdateTorrentsAndRefreshLabels_Hashes,
    changes: Web_App_App_UpdateTorrentsAndRefreshLabels_Changes,
  ): Web_App_App_UpdateTorrentsAndRefreshLabels_Returns => {
    await updateTorrents(hashes, changes);

    if (changes['labels'] !== undefined) {
      await refreshTorrentOrganization();
    }

    return;
  };

  /**
   * App - Set Torrent Profile And Refresh Labels.
   *
   * Applying a profile, including resolving Needs a profile, can write its labels to
   * torrents and therefore advances the saved-label organization.
   *
   * @param {Web_App_App_SetTorrentProfileAndRefreshLabels_Input} input - Input.
   *
   * @returns {Web_App_App_SetTorrentProfileAndRefreshLabels_Returns}
   *
   * @since 2.0.0
   */
  const setTorrentProfileAndRefreshLabels: Web_App_App_SetTorrentProfileAndRefreshLabels = async (
    input: Web_App_App_SetTorrentProfileAndRefreshLabels_Input,
  ): Web_App_App_SetTorrentProfileAndRefreshLabels_Returns => {
    const result: Web_App_App_SetTorrentProfileAndRefreshLabels_Result = await setTorrentProfile(input);

    if (result['applyOptions'] === true) {
      await refreshTorrentOrganization();
    }

    return result;
  };

  /**
   * App - Confirm Torrent Profile Deletion.
   *
   * Removes the profile, moves its torrents to Default, and keeps results open.
   * A failed move stays on its source while the deleted assignment still clears.
   *
   * @returns {Web_App_App_ConfirmTorrentProfileDeletion_Returns}
   *
   * @since 2.0.0
   */
  const confirmTorrentProfileDeletion: Web_App_App_ConfirmTorrentProfileDeletion = async (): Web_App_App_ConfirmTorrentProfileDeletion_Returns => {
    if (deletingTorrentProfile === null) {
      return;
    }

    setDeletingTorrentProfileBusy(true);
    setDeletingTorrentProfileError('');

    try {
      const deleteResponse: Web_App_App_ConfirmTorrentProfileDeletion_DeleteResponse = await deleteTorrentProfile(
        deletingTorrentProfile['id'],
        deletingTorrentProfileMoveCount > 0,
      );

      setTorrentProfiles((currentProfiles) => currentProfiles.filter(
        (profile) => profile['id'] !== deletingTorrentProfile['id'],
      ));
      setTorrentFilters((currentFilters) => ({
        ...currentFilters,
        profile: (currentFilters['profile'] === deletingTorrentProfile['id']) ? '' : currentFilters['profile'],
      }));

      if (deleteResponse['moved'].length > 0) {
        setDeletingTorrentProfileMoveCount(deleteResponse['moved'].length);
        setDeletingTorrentProfileMoveResults(deleteResponse['moved']);

        return;
      }

      setDeletingTorrentProfile(null);
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError['code'] === 'torrents_must_move') {
        const torrentCount: Web_App_App_ConfirmTorrentProfileDeletion_TorrentCount = caughtError['details']['torrents'];

        if (
          typeof torrentCount === 'number'
          && Number.isInteger(torrentCount) === true
          && torrentCount > 0
        ) {
          setDeletingTorrentProfileMoveCount(torrentCount);
        }
      }

      setDeletingTorrentProfileError((caughtError instanceof Error) ? caughtError.message : 'The profile could not be deleted.');
    } finally {
      setDeletingTorrentProfileBusy(false);
    }

    return;
  };

  const rpcEnabled: Web_App_App_RpcEnabled = useMemo(() => {
    const rpcSetting: Web_App_App_RpcSetting = (settings !== null) ? settings['settings'].find((setting) => (
      setting['key'] === 'rpc.compatibilityEnabled'
    )) : undefined;

    return rpcSetting !== undefined && rpcSetting['value'] === true;
  }, [settings]);

  if (phase === 'loading') {
    return (
      <main className="startup-screen">
        <span className="startup-mark">T</span>
        <span className="spinner" />
        <strong>Opening Transmission VPN</strong>
        {(startupError === '') ? null : <p role="alert">{startupError}</p>}
      </main>
    );
  }

  if (phase === 'claim' || phase === 'login') {
    return <AuthenticationScreen mode={phase} onSignedIn={enterApplication} />;
  }

  if (administrator === null) {
    return (
      <main className="startup-screen">
        <span className="spinner" />
        Preparing your session…
      </main>
    );
  }

  const connections: Web_App_App_Connections = (vpnConnections !== null) ? vpnConnections['connections'] : [];
  const snapshotErrors: Web_App_App_SnapshotErrors = (snapshot !== null) ? snapshot['errors'] : [];
  const snapshotStatistics: Web_App_App_SnapshotStatistics = (snapshot !== null) ? snapshot['statistics'] : undefined;
  const libraryTorrents: Web_App_App_LibraryTorrents = (snapshot !== null) ? snapshot['torrents'] : [];

  /**
   * App - Render View.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @returns {Web_App_App_RenderView_Returns}
   *
   * @since 2.0.0
   */
  const renderView: Web_App_App_RenderView = (): Web_App_App_RenderView_Returns => {
    switch (activeView) {
      case 'vpn': {
        return (
          <VpnView
            connections={vpnConnections}
            defaultProfile={defaultTorrentProfile}
            navigationSequence={vpnNavigationSequence}
            navigationTarget={vpnNavigationTarget}
            onCreate={async (input) => {
              await createVPNConnection(input);

              setVPNConnections(await getVPNConnections());

              await loadRemovedSecrets();

              return;
            }}
            onDelete={async (connectionId, input) => {
              const deleteResponse: Web_App_App_RenderView_DeleteResponse = await deleteVPNConnection(connectionId, input);

              setVPNConnections(await getVPNConnections());

              return deleteResponse;
            }}
            onDisconnect={async (connectionId) => {
              await disconnectVPNConnection(connectionId);

              setVPNConnections(await getVPNConnections());

              return;
            }}
            onMakeDefault={async (
              connectionId,
              moveTorrents = false,
            ) => {
              const defaultResponse: Web_App_App_RenderView_DefaultResponse = await setDefaultVPNConnection({
                connectionId,
                ...((moveTorrents === true) ? { moveTorrents: true as const } : {}),
              });

              setVPNConnections(await getVPNConnections());

              return defaultResponse['moved'];
            }}
            onNavigate={(target, replace = false) => {
              openVPN(target, replace);

              return;
            }}
            onOpenTorrents={(connectionId) => {
              setTorrentFilters({
                connection: connectionId,
                label: '',
                profile: '',
                status: 'all',
              });
              openView('torrents');

              return;
            }}
            onReconnect={async (connectionId) => {
              await reconnectVPNConnection(connectionId);

              setVPNConnections(await getVPNConnections());

              return;
            }}
            onRefreshCatalog={async (providerId, tunnel) => {
              await refreshVPNCatalog(providerId, tunnel);

              await refreshVPNData();

              return;
            }}
            onUploadProfile={async (tunnel, name, profile) => {
              const uploadedProfiles: Web_App_App_RenderView_UploadedProfiles = await uploadCustomProfile(tunnel, name, profile);

              await refreshVPNData();

              return uploadedProfiles;
            }}
            onUpdate={async (connectionId, input) => {
              await updateVPNConnection(connectionId, input);

              setVPNConnections(await getVPNConnections());

              await loadRemovedSecrets();

              return;
            }}
            profiles={profiles}
            providers={providers}
            snapshot={snapshot}
          />
        );
      }

      case 'settings': {
        return (
          <SettingsView
            onDirtyChange={setSettingsDirty}
            onRestartTransmission={async () => {
              await restartTransmission();

              setSettings(await getSettings());

              return;
            }}
            onSave={saveSettings}
            snapshot={settings}
          />
        );
      }

      case 'security': {
        return (
          <SecurityView
            onAuthenticatorEnabled={() => {
              void loadRemovedSecrets();

              return;
            }}
            onUsernameChanged={(username) => {
              setAdministrator((current) => (
                (current === null) ? current : {
                  ...current,
                  username,
                }
              ));

              return;
            }}
          />
        );
      }

      case 'notifications': {
        return (
          <NotificationsView
            interpreter="transmission-vpn"
            onChange={() => {
              void loadRemovedSecrets();

              return;
            }}
          />
        );
      }

      case 'access': {
        return (
          <AccessView
            connections={connections}
            onCreateRPCLogin={async (username) => {
              const rpcCredential: Web_App_App_RenderView_RpcCredential = await createRPCLogin({ username });

              setRPCLogins(await getRPCLogins());

              return rpcCredential;
            }}
            onCreateToken={async (input) => {
              const nextToken: Web_App_App_RenderView_NextToken = await createToken(input);

              setTokens(await getTokens());

              return nextToken;
            }}
            onCreateWebProxyLogin={async (input) => {
              const webProxyCredential: Web_App_App_RenderView_WebProxyCredential = await createWebProxyLogin(input);

              setWebProxy(await getWebProxy());

              return webProxyCredential;
            }}
            onDeleteRPCLogin={async (loginId) => {
              await deleteRPCLogin(loginId);

              setRPCLogins(await getRPCLogins());

              return;
            }}
            onDeleteWebProxyLogin={async (loginId) => {
              await deleteWebProxyLogin(loginId);

              setWebProxy(await getWebProxy());

              return;
            }}
            onOpenVPN={() => {
              openVPN({ kind: 'new' });

              return;
            }}
            onRefreshWebProxy={async () => {
              const nextWebProxy: Web_App_App_RenderView_NextWebProxy = await getWebProxy();

              setWebProxy(nextWebProxy);

              return nextWebProxy;
            }}
            onRevokeToken={async (tokenId) => {
              await revokeToken(tokenId);

              setTokens(await getTokens());

              return;
            }}
            onToggleRPC={async (enabled) => {
              await saveSettings({ 'rpc.compatibilityEnabled': enabled });

              return;
            }}
            onToggleWebProxy={async (enabled) => {
              const nextWebProxy: Web_App_App_RenderView_NextWebProxy = await updateWebProxy(enabled);

              setWebProxy(nextWebProxy);

              return nextWebProxy;
            }}
            onUpdateRPCLogin={async (
              loginId,
              input,
            ) => {
              const rpcCredential: Web_App_App_RenderView_RpcCredential = await updateRPCLogin(loginId, input);

              setRPCLogins(await getRPCLogins());

              return rpcCredential;
            }}
            onUpdateToken={async (tokenId, input) => {
              await updateToken(tokenId, input);

              setTokens(await getTokens());

              return;
            }}
            onUpdateWebProxyLogin={async (
              loginId,
              input,
            ) => {
              const webProxyCredential: Web_App_App_RenderView_WebProxyCredential = await updateWebProxyLogin(loginId, input);

              setWebProxy(await getWebProxy());

              return webProxyCredential;
            }}
            rpcEnabled={rpcEnabled}
            rpcLogins={rpcLogins}
            tokens={tokens}
            webProxy={webProxy}
          />
        );
      }

      default: {
        return (
          <TorrentWorkspace
            connections={connections}
            defaultProfile={defaultTorrentProfile}
            errors={snapshotErrors}
            filters={torrentFilters}
            filtersOpen={filtersSheetOpen}
            onAction={runTorrentAction}
            onAddTorrent={() => {
              if (vpnConnections === null || vpnConnections['connections'].length === 0) {
                setAddVPNConnectionDialogOpen(true);
              } else {
                setAddDialogOpen(true);
              }

              return;
            }}
            onFiltersChange={setTorrentFilters}
            onOpenFilters={() => setFiltersSheetOpen(true)}
            onRemove={removeTorrents}
            onSelectTorrent={(torrent) => {
              void selectTorrent(torrent);

              return;
            }}
            onFixProfileFolder={(profileId) => {
              if (profileId === 'default') {
                openDefaultTorrentProfile();

                return;
              }

              const overlapping: Web_App_App_RenderView_Overlapping = torrentProfiles.find(
                (profile) => profile['id'] === profileId,
              );

              if (overlapping !== undefined) {
                openTorrentProfile(overlapping);
              }

              return;
            }}
            onSetProfile={setTorrentProfileAndRefreshLabels}
            profileFolderOverlaps={profileFolderOverlaps}
            profiles={torrentProfiles}
            selectedTorrentId={selectedTorrentID}
            statistics={snapshotStatistics}
            torrents={libraryTorrents}
          />
        );
      }
    }
  };

  const lastRemovedSecret: Web_App_App_LastRemovedSecret = removedSecrets.at(-1);
  const noticeRemovedAt: Web_App_App_NoticeRemovedAt = (lastRemovedSecret !== undefined) ? lastRemovedSecret['removedAt'] : '';
  const notice: Web_App_App_Notice = (removedSecrets.length === 0) ? null : (
    <KeyNotice
      appName="Transmission VPN"
      items={removedSecrets.map((removedSecret) => {
        return {
          id: removedSecret['notificationId'] ?? removedSecret['kind'],
          label: describeRemovedSecret(removedSecret)['label'],
          onOpen: () => openView(describeRemovedSecret(removedSecret)['view']),
        };
      })}
      keyName="installation key"
      onDismiss={async () => {
        await dismissRemovedSecrets();

        setRemovedSecrets([]);

        return;
      }}
      removedAt={noticeRemovedAt}
    />
  );
  const protection: Web_App_App_Protection = describeProtection(snapshot);
  const deletingTorrentProfileDefaultConnection: Web_App_App_DeletingTorrentProfileDefaultConnection = (vpnConnections !== null) ? vpnConnections['connections'].find(
    (connection) => connection['default'] === true,
  ) : undefined;
  const deletingTorrentProfileDefaultConnectionName: Web_App_App_DeletingTorrentProfileDefaultConnectionName = (deletingTorrentProfileDefaultConnection !== undefined) ? deletingTorrentProfileDefaultConnection['name'] : 'the default VPN connection';
  const deletingTorrentProfileHasFailures: Web_App_App_DeletingTorrentProfileHasFailures = (deletingTorrentProfileMoveResults !== null) ? deletingTorrentProfileMoveResults.some(
    (result) => result['result'] === 'failed',
  ) : false;
  let deletingTorrentProfileMessage: Web_App_App_DeletingTorrentProfileMessage = '';

  if (deletingTorrentProfile !== null) {
    if (deletingTorrentProfileMoveResults !== null) {
      if (deletingTorrentProfileHasFailures === true) {
        deletingTorrentProfileMessage = `${deletingTorrentProfile['name']} was deleted. Failed torrents stayed where they were and are now assigned to ${defaultTorrentProfile['name']}.`;
      } else {
        deletingTorrentProfileMessage = `${deletingTorrentProfile['name']} was deleted. Review each torrent move below.`;
      }
    } else if (deletingTorrentProfileMoveCount === 0) {
      deletingTorrentProfileMessage = `Delete ${deletingTorrentProfile['name']}? It has no torrents to move.`;
    } else if (deletingTorrentProfileMoveCount === 1) {
      deletingTorrentProfileMessage = `Delete ${deletingTorrentProfile['name']}? Its torrent moves to ${defaultTorrentProfile['name']}'s folder, ${defaultTorrentProfile['downloadDirectory']}, and to ${deletingTorrentProfileDefaultConnectionName}.`;
    } else {
      deletingTorrentProfileMessage = `Delete ${deletingTorrentProfile['name']}? Its ${String(deletingTorrentProfileMoveCount)} torrents move to ${defaultTorrentProfile['name']}'s folder, ${defaultTorrentProfile['downloadDirectory']}, and to ${deletingTorrentProfileDefaultConnectionName}.`;
    }
  }

  let deletingTorrentProfileConfirmLabel: Web_App_App_DeletingTorrentProfileConfirmLabel = 'Delete profile';

  if (deletingTorrentProfileMoveCount > 0) {
    deletingTorrentProfileConfirmLabel = 'Delete and move';
  }

  /**
   * App - Render Library Navigation.
   *
   * Supplies the same filter and profile navigation to the desktop sidebar and
   * the phone Filters sheet, with an optional sheet close callback.
   *
   * @param {Web_App_App_RenderLibraryNavigation_OnSheetClose} [onSheetClose] - On sheet close.
   *
   * @returns {Web_App_App_RenderLibraryNavigation_Returns}
   *
   * @since 2.0.0
   */
  const renderLibraryNavigation: Web_App_App_RenderLibraryNavigation = (onSheetClose?: Web_App_App_RenderLibraryNavigation_OnSheetClose): Web_App_App_RenderLibraryNavigation_Returns => {
    return (
      <LibraryNavigation
        defaultProfile={defaultTorrentProfile}
        filters={torrentFilters}
        onCreateProfile={openNewTorrentProfile}
        onDeleteProfile={(profile) => {
          const moveCount: Web_App_App_RenderLibraryNavigation_MoveCount = libraryTorrents.filter(
            (torrent) => torrent['profileId'] === profile['id'],
          ).length;

          setDeletingTorrentProfileError('');
          setDeletingTorrentProfileMoveCount(moveCount);
          setDeletingTorrentProfileMoveResults(null);
          setDeletingTorrentProfile(profile);

          return;
        }}
        onEditDefaultProfile={openDefaultTorrentProfile}
        onEditProfile={openTorrentProfile}
        onFiltersChange={setTorrentFilters}
        onManage={() => setOrganizationDialogOpen(true)}
        onSheetClose={onSheetClose}
        organization={organization}
        profiles={torrentProfiles}
        torrents={libraryTorrents}
      />
    );
  };

  return (
    <AppShell
      activeView={activeView}
      notice={notice}
      onLogout={() => {
        void signOut();

        return;
      }}
      onViewChange={openView}
      phoneSheet={(filtersSheetOpen === true && activeView === 'torrents') ? {
        content: renderLibraryNavigation(() => setFiltersSheetOpen(false)),
        id: 'torrent-filters',
        onClose: () => setFiltersSheetOpen(false),
        title: 'Filters',
      } : undefined}
      sidebarNavigationSlot={(activeView === 'torrents') ? renderLibraryNavigation() : undefined}
      status={{
        ...protection,
        onOpen: () => openView('vpn'),
      }}
      username={administrator['username'] ?? 'Administrator'}
    >
      {renderView()}
      <AddTorrentDialog
        connections={connections}
        defaultProfile={defaultTorrentProfile}
        labelPresets={torrentLabels}
        onAdd={addTorrentAndRefreshLabels}
        onClose={() => setAddDialogOpen(false)}
        onOpenVPN={() => {
          setAddDialogOpen(false);
          openVPN({ kind: 'new' });

          return;
        }}
        open={addDialogOpen}
        profiles={torrentProfiles}
        torrents={libraryTorrents}
      />
      <ConfirmDialog
        busy={false}
        busyLabel="Opening…"
        confirmLabel="Add VPN connection"
        error=""
        message="Torrents only download through a VPN connection, so add one before adding torrents."
        onCancel={() => setAddVPNConnectionDialogOpen(false)}
        onConfirm={() => {
          setAddVPNConnectionDialogOpen(false);
          openVPN({ kind: 'new' });

          return;
        }}
        open={addVPNConnectionDialogOpen}
        title="Add a VPN connection first"
        tone="primary"
      />
      <TorrentOrganizationDialog
        labels={torrentLabels}
        onClose={() => setOrganizationDialogOpen(false)}
        onSave={saveTorrentOrganization}
        open={organizationDialogOpen}
        organization={organization}
      />
      <TorrentProfileDialog
        connections={connections}
        defaultProfile={defaultTorrentProfile}
        labelPresets={torrentLabels}
        mode={profileDialogMode ?? 'create'}
        onClose={() => setProfileDialogMode(null)}
        onSave={saveTorrentProfile}
        open={profileDialogMode !== null}
        profile={editingTorrentProfile}
        profiles={torrentProfiles}
      />
      <ConfirmDialog
        busy={deletingTorrentProfileBusy}
        busyLabel={(deletingTorrentProfileMoveCount > 0) ? 'Deleting and moving…' : 'Deleting…'}
        confirmLabel={deletingTorrentProfileConfirmLabel}
        error={deletingTorrentProfileError}
        message={deletingTorrentProfileMessage}
        onCancel={() => {
          setDeletingTorrentProfile(null);
          setDeletingTorrentProfileMoveCount(0);
          setDeletingTorrentProfileMoveResults(null);

          return;
        }}
        onConfirm={() => {
          void confirmTorrentProfileDeletion();

          return;
        }}
        open={deletingTorrentProfile !== null && deletingTorrentProfileMoveResults === null}
        title="Delete torrent profile"
        tone="danger"
      />
      {(deletingTorrentProfile === null || deletingTorrentProfileMoveResults === null) ? null : (
        <div className="dialog-backdrop" role="presentation">
          <section aria-describedby="delete-profile-results-message" aria-labelledby="delete-profile-results-title" aria-modal="true" className="dialog dialog-small" role="alertdialog">
            <div className="dialog-heading">
              <h2 id="delete-profile-results-title">Move results</h2>
            </div>
            <p className="dialog-message" id="delete-profile-results-message">{deletingTorrentProfileMessage}</p>
            <div className="torrent-move-results">
              <ul>
                {deletingTorrentProfileMoveResults.map((result) => {
                  return (
                    <li className={(result['result'] === 'failed') ? 'move-failed' : 'move-succeeded'} key={result['hash']}>
                      <strong>{result['name']}</strong>
                      <span className="move-result-copy">
                        <span className="move-result-state">{torrentMoveResultLabel(result)}</span>
                        {(result['warnings'] !== undefined) ? result['warnings'].map((warning) => <small key={warning}>{warning}</small>) : undefined}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="dialog-actions">
              <Button
                onClick={() => {
                  setDeletingTorrentProfile(null);
                  setDeletingTorrentProfileMoveCount(0);
                  setDeletingTorrentProfileMoveResults(null);

                  return;
                }}
                variant="primary"
              >
                Done
              </Button>
            </div>
          </section>
        </div>
      )}
      {(selectedTorrentID === null) ? null : (
        <TorrentDetail
          connections={connections}
          defaultProfile={defaultTorrentProfile}
          detail={torrentDetail}
          labelPresets={torrentLabels}
          loading={torrentDetailLoading}
          onAction={runTorrentAction}
          onClose={() => {
            setSelectedTorrentID(null);
            setTorrentDetail(null);

            return;
          }}
          onRefresh={refreshTorrentDetail}
          onRename={renameTorrentPath}
          onSetProfile={setTorrentProfileAndRefreshLabels}
          onUpdate={updateTorrentsAndRefreshLabels}
          profiles={torrentProfiles}
        />
      )}
    </AppShell>
  );
};
