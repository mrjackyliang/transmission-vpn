import type {
  Dispatch,
  ReactElement,
  SetStateAction,
} from 'react';

import type {
  Web_Api_AddTorrentInput,
  Web_Api_Administrator,
  Web_Api_CreatedToken,
  Web_Api_DefaultTorrentProfile,
  Web_Api_DefaultTorrentProfileInput,
  Web_Api_DeleteTorrentProfileResponse,
  Web_Api_DeleteVpnConnectionResponse,
  Web_Api_JsonValue,
  Web_Api_LiveSnapshot,
  Web_Api_MovedTorrent,
  Web_Api_Provider,
  Web_Api_RemovedSecret,
  Web_Api_RPCCredential,
  Web_Api_RPCLogin,
  Web_Api_Setting,
  Web_Api_SettingsSnapshot,
  Web_Api_SetTorrentProfileInput,
  Web_Api_SetTorrentProfileResponse,
  Web_Api_SetupStatus,
  Web_Api_Statistics,
  Web_Api_Token,
  Web_Api_Torrent,
  Web_Api_TorrentAddResult,
  Web_Api_TorrentChanges,
  Web_Api_TorrentDetail,
  Web_Api_TorrentListResponse,
  Web_Api_TorrentOrganization,
  Web_Api_TorrentProfile,
  Web_Api_TorrentProfileFolderOverlap,
  Web_Api_TorrentProfileInput,
  Web_Api_TorrentProfilesResponse,
  Web_Api_UpdateDefaultTorrentProfileResponse,
  Web_Api_UpdateTorrentOrganizationInput,
  Web_Api_UpdateTorrentProfileResponse,
  Web_Api_VpnConnection,
  Web_Api_VpnConnectionsResponse,
  Web_Api_VpnDefaultResponse,
  Web_Api_VpnProfile,
  Web_Api_WebProxy,
  Web_Api_WebProxyCredential,
} from '@/types/web/api.d.ts';
import type {
  Web_AppNavigation_PathMatch,
  Web_AppNavigation_Route,
} from '@/types/web/app-navigation.d.ts';
import type {
  Web_Components_Protection,
  Web_Components_TorrentFilters,
  Web_Components_TorrentProfileDialog_Mode,
  Web_Components_View,
  Web_Components_VpnView_NavigationTarget,
} from '@/types/web/components.d.ts';

/**
 * App.
 *
 * @since 2.4.1
 */
export type Web_App_App_Returns = ReactElement;
export type Web_App_App_InitialNavigation = Web_AppNavigation_PathMatch;
export type Web_App_App_Phase = 'loading' | 'claim' | 'login' | 'application';
export type Web_App_App_SetPhase = Dispatch<SetStateAction<Web_App_App_Phase>>;
export type Web_App_App_PhaseState = [Web_App_App_Phase, Web_App_App_SetPhase];
export type Web_App_App_Administrator = Web_Api_Administrator | null;
export type Web_App_App_SetAdministrator = Dispatch<SetStateAction<Web_App_App_Administrator>>;
export type Web_App_App_AdministratorState = [Web_App_App_Administrator, Web_App_App_SetAdministrator];
export type Web_App_App_ActiveRoute = Web_AppNavigation_Route;
export type Web_App_App_SetActiveRoute = Dispatch<SetStateAction<Web_App_App_ActiveRoute>>;
export type Web_App_App_ActiveRouteState = [Web_App_App_ActiveRoute, Web_App_App_SetActiveRoute];
export type Web_App_App_ActiveView = Web_Components_View;
export type Web_App_App_Snapshot = Web_Api_LiveSnapshot | null;
export type Web_App_App_SetSnapshot = Dispatch<SetStateAction<Web_App_App_Snapshot>>;
export type Web_App_App_SnapshotState = [Web_App_App_Snapshot, Web_App_App_SetSnapshot];
export type Web_App_App_Settings = Web_Api_SettingsSnapshot | null;
export type Web_App_App_SetSettings = Dispatch<SetStateAction<Web_App_App_Settings>>;
export type Web_App_App_SettingsState = [Web_App_App_Settings, Web_App_App_SetSettings];
export type Web_App_App_Organization = Web_Api_TorrentOrganization | null;
export type Web_App_App_SetOrganization = Dispatch<SetStateAction<Web_App_App_Organization>>;
export type Web_App_App_OrganizationState = [Web_App_App_Organization, Web_App_App_SetOrganization];
export type Web_App_App_Providers = Web_Api_Provider[];
export type Web_App_App_SetProviders = Dispatch<SetStateAction<Web_App_App_Providers>>;
export type Web_App_App_ProvidersState = [Web_App_App_Providers, Web_App_App_SetProviders];
export type Web_App_App_Profiles = Web_Api_VpnProfile[];
export type Web_App_App_SetProfiles = Dispatch<SetStateAction<Web_App_App_Profiles>>;
export type Web_App_App_ProfilesState = [Web_App_App_Profiles, Web_App_App_SetProfiles];
export type Web_App_App_TorrentProfiles = Web_Api_TorrentProfile[];
export type Web_App_App_SetTorrentProfiles = Dispatch<SetStateAction<Web_App_App_TorrentProfiles>>;
export type Web_App_App_TorrentProfilesState = [Web_App_App_TorrentProfiles, Web_App_App_SetTorrentProfiles];
export type Web_App_App_ProfileFolderOverlaps = Web_Api_TorrentProfileFolderOverlap[];
export type Web_App_App_SetProfileFolderOverlaps = Dispatch<SetStateAction<Web_App_App_ProfileFolderOverlaps>>;
export type Web_App_App_ProfileFolderOverlapsState = [Web_App_App_ProfileFolderOverlaps, Web_App_App_SetProfileFolderOverlaps];
export type Web_App_App_DefaultTorrentProfile = Web_Api_DefaultTorrentProfile;
export type Web_App_App_SetDefaultTorrentProfile = Dispatch<SetStateAction<Web_App_App_DefaultTorrentProfile>>;
export type Web_App_App_DefaultTorrentProfileState = [Web_App_App_DefaultTorrentProfile, Web_App_App_SetDefaultTorrentProfile];
export type Web_App_App_Tokens = Web_Api_Token[];
export type Web_App_App_SetTokens = Dispatch<SetStateAction<Web_App_App_Tokens>>;
export type Web_App_App_TokensState = [Web_App_App_Tokens, Web_App_App_SetTokens];
export type Web_App_App_RpcLogins = Web_Api_RPCLogin[];
export type Web_App_App_SetRPCLogins = Dispatch<SetStateAction<Web_App_App_RpcLogins>>;
export type Web_App_App_RpcLoginsState = [Web_App_App_RpcLogins, Web_App_App_SetRPCLogins];
export type Web_App_App_WebProxy = Web_Api_WebProxy | null;
export type Web_App_App_SetWebProxy = Dispatch<SetStateAction<Web_App_App_WebProxy>>;
export type Web_App_App_WebProxyState = [Web_App_App_WebProxy, Web_App_App_SetWebProxy];
export type Web_App_App_VpnConnections = Web_Api_VpnConnectionsResponse | null;
export type Web_App_App_SetVPNConnections = Dispatch<SetStateAction<Web_App_App_VpnConnections>>;
export type Web_App_App_VpnConnectionsState = [Web_App_App_VpnConnections, Web_App_App_SetVPNConnections];
export type Web_App_App_VpnNavigationSequence = number;
export type Web_App_App_SetVPNNavigationSequence = Dispatch<SetStateAction<Web_App_App_VpnNavigationSequence>>;
export type Web_App_App_VpnNavigationSequenceState = [Web_App_App_VpnNavigationSequence, Web_App_App_SetVPNNavigationSequence];
export type Web_App_App_VpnNavigationTarget = Web_Components_VpnView_NavigationTarget;
export type Web_App_App_SetVPNNavigationTarget = Dispatch<SetStateAction<Web_App_App_VpnNavigationTarget>>;
export type Web_App_App_VpnNavigationTargetState = [Web_App_App_VpnNavigationTarget, Web_App_App_SetVPNNavigationTarget];
export type Web_App_App_AddDialogOpen = boolean;
export type Web_App_App_SetAddDialogOpen = Dispatch<SetStateAction<Web_App_App_AddDialogOpen>>;
export type Web_App_App_AddDialogOpenState = [Web_App_App_AddDialogOpen, Web_App_App_SetAddDialogOpen];
export type Web_App_App_AddVPNConnectionDialogOpen = boolean;
export type Web_App_App_SetAddVPNConnectionDialogOpen = Dispatch<SetStateAction<Web_App_App_AddVPNConnectionDialogOpen>>;
export type Web_App_App_AddVPNConnectionDialogOpenState = [Web_App_App_AddVPNConnectionDialogOpen, Web_App_App_SetAddVPNConnectionDialogOpen];
export type Web_App_App_SelectedTorrentID = number | null;
export type Web_App_App_SetSelectedTorrentID = Dispatch<SetStateAction<Web_App_App_SelectedTorrentID>>;
export type Web_App_App_SelectedTorrentIDState = [Web_App_App_SelectedTorrentID, Web_App_App_SetSelectedTorrentID];
export type Web_App_App_TorrentDetail = Web_Api_TorrentDetail | null;
export type Web_App_App_SetTorrentDetail = Dispatch<SetStateAction<Web_App_App_TorrentDetail>>;
export type Web_App_App_TorrentDetailState = [Web_App_App_TorrentDetail, Web_App_App_SetTorrentDetail];
export type Web_App_App_TorrentDetailLoading = boolean;
export type Web_App_App_SetTorrentDetailLoading = Dispatch<SetStateAction<Web_App_App_TorrentDetailLoading>>;
export type Web_App_App_TorrentDetailLoadingState = [Web_App_App_TorrentDetailLoading, Web_App_App_SetTorrentDetailLoading];
export type Web_App_App_StartupError = string;
export type Web_App_App_SetStartupError = Dispatch<SetStateAction<Web_App_App_StartupError>>;
export type Web_App_App_StartupErrorState = [Web_App_App_StartupError, Web_App_App_SetStartupError];
export type Web_App_App_TorrentFilters = Web_Components_TorrentFilters;
export type Web_App_App_SetTorrentFilters = Dispatch<SetStateAction<Web_App_App_TorrentFilters>>;
export type Web_App_App_TorrentFiltersState = [Web_App_App_TorrentFilters, Web_App_App_SetTorrentFilters];
export type Web_App_App_FiltersSheetOpen = boolean;
export type Web_App_App_SetFiltersSheetOpen = Dispatch<SetStateAction<Web_App_App_FiltersSheetOpen>>;
export type Web_App_App_FiltersSheetOpenState = [Web_App_App_FiltersSheetOpen, Web_App_App_SetFiltersSheetOpen];
export type Web_App_App_OrganizationDialogOpen = boolean;
export type Web_App_App_SetOrganizationDialogOpen = Dispatch<SetStateAction<Web_App_App_OrganizationDialogOpen>>;
export type Web_App_App_OrganizationDialogOpenState = [Web_App_App_OrganizationDialogOpen, Web_App_App_SetOrganizationDialogOpen];
export type Web_App_App_ProfileDialogMode = Web_Components_TorrentProfileDialog_Mode | null;
export type Web_App_App_SetProfileDialogMode = Dispatch<SetStateAction<Web_App_App_ProfileDialogMode>>;
export type Web_App_App_ProfileDialogModeState = [Web_App_App_ProfileDialogMode, Web_App_App_SetProfileDialogMode];
export type Web_App_App_EditingTorrentProfile = Web_Api_TorrentProfile | null;
export type Web_App_App_SetEditingTorrentProfile = Dispatch<SetStateAction<Web_App_App_EditingTorrentProfile>>;
export type Web_App_App_EditingTorrentProfileState = [Web_App_App_EditingTorrentProfile, Web_App_App_SetEditingTorrentProfile];
export type Web_App_App_DeletingTorrentProfile = Web_Api_TorrentProfile | null;
export type Web_App_App_SetDeletingTorrentProfile = Dispatch<SetStateAction<Web_App_App_DeletingTorrentProfile>>;
export type Web_App_App_DeletingTorrentProfileState = [Web_App_App_DeletingTorrentProfile, Web_App_App_SetDeletingTorrentProfile];
export type Web_App_App_DeletingTorrentProfileBusy = boolean;
export type Web_App_App_SetDeletingTorrentProfileBusy = Dispatch<SetStateAction<Web_App_App_DeletingTorrentProfileBusy>>;
export type Web_App_App_DeletingTorrentProfileBusyState = [Web_App_App_DeletingTorrentProfileBusy, Web_App_App_SetDeletingTorrentProfileBusy];
export type Web_App_App_DeletingTorrentProfileError = string;
export type Web_App_App_SetDeletingTorrentProfileError = Dispatch<SetStateAction<Web_App_App_DeletingTorrentProfileError>>;
export type Web_App_App_DeletingTorrentProfileErrorState = [Web_App_App_DeletingTorrentProfileError, Web_App_App_SetDeletingTorrentProfileError];
export type Web_App_App_DeletingTorrentProfileMoveCount = number;
export type Web_App_App_SetDeletingTorrentProfileMoveCount = Dispatch<SetStateAction<Web_App_App_DeletingTorrentProfileMoveCount>>;
export type Web_App_App_DeletingTorrentProfileMoveCountState = [Web_App_App_DeletingTorrentProfileMoveCount, Web_App_App_SetDeletingTorrentProfileMoveCount];
export type Web_App_App_DeletingTorrentProfileMoveResults = Web_Api_MovedTorrent[] | null;
export type Web_App_App_SetDeletingTorrentProfileMoveResults = Dispatch<SetStateAction<Web_App_App_DeletingTorrentProfileMoveResults>>;
export type Web_App_App_DeletingTorrentProfileMoveResultsState = [Web_App_App_DeletingTorrentProfileMoveResults, Web_App_App_SetDeletingTorrentProfileMoveResults];
export type Web_App_App_RemovedSecrets = Web_Api_RemovedSecret[];
export type Web_App_App_SetRemovedSecrets = Dispatch<SetStateAction<Web_App_App_RemovedSecrets>>;
export type Web_App_App_RemovedSecretsState = [Web_App_App_RemovedSecrets, Web_App_App_SetRemovedSecrets];
export type Web_App_App_SettingsDirty = boolean;
export type Web_App_App_SetSettingsDirty = Dispatch<SetStateAction<Web_App_App_SettingsDirty>>;
export type Web_App_App_SettingsDirtyState = [Web_App_App_SettingsDirty, Web_App_App_SetSettingsDirty];
export type Web_App_App_ApplyAppRoute_Route = Web_AppNavigation_Route;
export type Web_App_App_ApplyAppRoute_Returns = void;
export type Web_App_App_ApplyAppRoute = (route: Web_App_App_ApplyAppRoute_Route) => Web_App_App_ApplyAppRoute_Returns;
export type Web_App_App_OpenRoute_Route = Web_AppNavigation_Route;
export type Web_App_App_OpenRoute_Replace = boolean;
export type Web_App_App_OpenRoute_Returns = void;
export type Web_App_App_OpenRoute = (route: Web_App_App_OpenRoute_Route, replace?: Web_App_App_OpenRoute_Replace) => Web_App_App_OpenRoute_Returns;
export type Web_App_App_OpenView_View = Web_Components_View;
export type Web_App_App_OpenView_Returns = void;
export type Web_App_App_OpenView = (view: Web_App_App_OpenView_View) => Web_App_App_OpenView_Returns;
export type Web_App_App_OpenVPN_Target = Web_Components_VpnView_NavigationTarget;
export type Web_App_App_OpenVPN_Replace = boolean;
export type Web_App_App_OpenVPN_Returns = void;
export type Web_App_App_OpenVPN = (target: Web_App_App_OpenVPN_Target, replace?: Web_App_App_OpenVPN_Replace) => Web_App_App_OpenVPN_Returns;
export type Web_App_App_IncompleteDirectorySetting = Web_Api_Setting | undefined;
export type Web_App_App_IncompleteDirectory = string | undefined;
export type Web_App_App_SnapshotTorrents = Web_Api_Torrent[] | undefined;
export type Web_App_App_OrganizationRevision = number | undefined;
export type Web_App_App_SnapshotOrganizationRevision = number | undefined;
export type Web_App_App_SnapshotSequence = number | undefined;
export type Web_App_App_TorrentLabels = string[];
export type Web_App_App_LabelsByKey = Map<string, string>;
export type Web_App_App_LoadConfiguration_Returns = Promise<void>;
export type Web_App_App_LoadConfiguration = () => Web_App_App_LoadConfiguration_Returns;
export type Web_App_App_LoadConfiguration_ConfigurationResults = [
  Web_Api_SettingsSnapshot,
  Web_Api_Provider[],
  Web_Api_Token[],
  Web_Api_TorrentOrganization,
  Web_Api_RPCLogin[],
  Web_Api_WebProxy,
  Web_Api_VpnConnectionsResponse,
  Web_Api_TorrentProfilesResponse,
];
export type Web_App_App_LoadConfiguration_NextSettings = Web_Api_SettingsSnapshot;
export type Web_App_App_LoadConfiguration_NextProviders = Web_Api_Provider[];
export type Web_App_App_LoadConfiguration_NextTokens = Web_Api_Token[];
export type Web_App_App_LoadConfiguration_NextOrganization = Web_Api_TorrentOrganization;
export type Web_App_App_LoadConfiguration_NextRPCLogins = Web_Api_RPCLogin[];
export type Web_App_App_LoadConfiguration_NextWebProxy = Web_Api_WebProxy;
export type Web_App_App_LoadConfiguration_NextVPNConnections = Web_Api_VpnConnectionsResponse;
export type Web_App_App_LoadConfiguration_NextTorrentProfiles = Web_Api_TorrentProfilesResponse;
export type Web_App_App_LoadConfiguration_ProfileGroup = Web_Api_VpnProfile[];
export type Web_App_App_LoadConfiguration_ProfileGroups = Web_App_App_LoadConfiguration_ProfileGroup[];
export type Web_App_App_EnterApplication_Returns = Promise<void>;
export type Web_App_App_EnterApplication = () => Web_App_App_EnterApplication_Returns;
export type Web_App_App_EnterApplication_CurrentAdministrator = Web_Api_Administrator | null;
export type Web_App_App_LoadRemovedSecrets_Returns = Promise<void>;
export type Web_App_App_LoadRemovedSecrets = () => Web_App_App_LoadRemovedSecrets_Returns;
export type Web_App_App_LoadRemovedSecrets_CurrentAdministrator = Web_Api_Administrator | null;
export type Web_App_App_Bootstrap_Returns = Promise<void>;
export type Web_App_App_Bootstrap = () => Web_App_App_Bootstrap_Returns;
export type Web_App_App_Bootstrap_SetupStatus = Web_Api_SetupStatus;
export type Web_App_App_EffectActive = boolean;
export type Web_App_App_RefreshOrganization_Returns = Promise<void>;
export type Web_App_App_RefreshOrganization = () => Web_App_App_RefreshOrganization_Returns;
export type Web_App_App_RefreshOrganization_NextOrganization = Web_Api_TorrentOrganization;
export type Web_App_App_OnFocus_Returns = void;
export type Web_App_App_OnFocus = () => Web_App_App_OnFocus_Returns;
export type Web_App_App_RefreshIntervalID = number | undefined;
export type Web_App_App_RefreshRunning = boolean;
export type Web_App_App_RefreshAccessData_Returns = Promise<void>;
export type Web_App_App_RefreshAccessData = () => Web_App_App_RefreshAccessData_Returns;
export type Web_App_App_RefreshAccessData_WebProxyResult = PromiseSettledResult<Web_Api_WebProxy>;
export type Web_App_App_RefreshAccessData_TokensResult = PromiseSettledResult<Web_Api_Token[]>;
export type Web_App_App_RefreshAccessData_AccessResults = [Web_App_App_RefreshAccessData_WebProxyResult, Web_App_App_RefreshAccessData_TokensResult];
export type Web_App_App_StopWebProxyRefresh_Returns = void;
export type Web_App_App_StopWebProxyRefresh = () => Web_App_App_StopWebProxyRefresh_Returns;
export type Web_App_App_StartWebProxyRefresh_Returns = void;
export type Web_App_App_StartWebProxyRefresh = () => Web_App_App_StartWebProxyRefresh_Returns;
export type Web_App_App_HandleWebProxyVisibilityChange_Returns = void;
export type Web_App_App_HandleWebProxyVisibilityChange = () => Web_App_App_HandleWebProxyVisibilityChange_Returns;
export type Web_App_App_SignOut_Returns = Promise<void>;
export type Web_App_App_SignOut = () => Web_App_App_SignOut_Returns;
export type Web_App_App_SignOut_RootNavigation = Web_AppNavigation_PathMatch;
export type Web_App_App_SelectTorrent_Torrent = Web_Api_Torrent;
export type Web_App_App_SelectTorrent_Returns = Promise<void>;
export type Web_App_App_SelectTorrent = (torrent: Web_App_App_SelectTorrent_Torrent) => Web_App_App_SelectTorrent_Returns;
export type Web_App_App_SelectTorrent_Detail = Web_Api_TorrentDetail;
export type Web_App_App_RefreshTorrentDetail_TorrentId = number;
export type Web_App_App_RefreshTorrentDetail_Returns = Promise<void>;
export type Web_App_App_RefreshTorrentDetail = (torrentId: Web_App_App_RefreshTorrentDetail_TorrentId) => Web_App_App_RefreshTorrentDetail_Returns;
export type Web_App_App_RefreshTorrentDetail_Detail = Web_Api_TorrentDetail;
export type Web_App_App_Cancelled = boolean;
export type Web_App_App_RefreshDetail_Returns = Promise<void>;
export type Web_App_App_RefreshDetail = () => Web_App_App_RefreshDetail_Returns;
export type Web_App_App_RefreshDetail_Detail = Web_Api_TorrentDetail;
export type Web_App_App_SaveSettings_Changes = Record<string, Web_Api_JsonValue>;
export type Web_App_App_SaveSettings_Returns = Promise<void>;
export type Web_App_App_SaveSettings = (changes: Web_App_App_SaveSettings_Changes) => Web_App_App_SaveSettings_Returns;
export type Web_App_App_SaveSettings_NextSettings = Web_Api_SettingsSnapshot;
export type Web_App_App_RefreshVPNData_Returns = Promise<void>;
export type Web_App_App_RefreshVPNData = () => Web_App_App_RefreshVPNData_Returns;
export type Web_App_App_RefreshVPNData_NextProviders = Web_Api_Provider[];
export type Web_App_App_RefreshVPNData_ProfileGroup = Web_Api_VpnProfile[];
export type Web_App_App_RefreshVPNData_ProfileGroups = Web_App_App_RefreshVPNData_ProfileGroup[];
export type Web_App_App_RefreshTorrentOrganization_Returns = Promise<void>;
export type Web_App_App_RefreshTorrentOrganization = () => Web_App_App_RefreshTorrentOrganization_Returns;
export type Web_App_App_SaveTorrentOrganization_Input = Web_Api_UpdateTorrentOrganizationInput;
export type Web_App_App_SaveTorrentOrganization_Returns = Promise<void>;
export type Web_App_App_SaveTorrentOrganization = (input: Web_App_App_SaveTorrentOrganization_Input) => Web_App_App_SaveTorrentOrganization_Returns;
export type Web_App_App_SaveTorrentOrganization_OpenedOrganization = Web_Api_TorrentOrganization;
export type Web_App_App_SaveTorrentOrganization_AcceptUpdate_NextOrganization = Web_Api_TorrentOrganization;
export type Web_App_App_SaveTorrentOrganization_AcceptUpdate_Returns = Promise<void>;
export type Web_App_App_SaveTorrentOrganization_AcceptUpdate = (nextOrganization: Web_App_App_SaveTorrentOrganization_AcceptUpdate_NextOrganization) => Web_App_App_SaveTorrentOrganization_AcceptUpdate_Returns;
export type Web_App_App_SaveTorrentOrganization_AcceptUpdate_TorrentList = Web_Api_TorrentListResponse;
export type Web_App_App_SaveTorrentOrganization_NextOrganization = Web_Api_TorrentOrganization;
export type Web_App_App_SaveTorrentOrganization_LatestOrganization = Web_Api_TorrentOrganization;
export type Web_App_App_SaveTorrentOrganization_MergedInput = Web_Api_UpdateTorrentOrganizationInput;
export type Web_App_App_OpenNewTorrentProfile_Returns = void;
export type Web_App_App_OpenNewTorrentProfile = () => Web_App_App_OpenNewTorrentProfile_Returns;
export type Web_App_App_OpenDefaultTorrentProfile_Returns = void;
export type Web_App_App_OpenDefaultTorrentProfile = () => Web_App_App_OpenDefaultTorrentProfile_Returns;
export type Web_App_App_OpenTorrentProfile_Profile = Web_Api_TorrentProfile;
export type Web_App_App_OpenTorrentProfile_Returns = void;
export type Web_App_App_OpenTorrentProfile = (profile: Web_App_App_OpenTorrentProfile_Profile) => Web_App_App_OpenTorrentProfile_Returns;
export type Web_App_App_SaveTorrentProfile_Input = Web_Api_DefaultTorrentProfileInput | Web_Api_TorrentProfileInput;
export type Web_App_App_SaveTorrentProfile_MoveTorrents = boolean;
export type Web_App_App_SaveTorrentProfile_Returns = Promise<Web_Api_MovedTorrent[]>;
export type Web_App_App_SaveTorrentProfile = (input: Web_App_App_SaveTorrentProfile_Input, moveTorrents?: Web_App_App_SaveTorrentProfile_MoveTorrents) => Web_App_App_SaveTorrentProfile_Returns;
export type Web_App_App_SaveTorrentProfile_UpdatedDefaultProfile = Web_Api_UpdateDefaultTorrentProfileResponse;
export type Web_App_App_SaveTorrentProfile_DefaultProfileInput = Web_Api_DefaultTorrentProfileInput;
export type Web_App_App_SaveTorrentProfile_NamedInput = Web_Api_TorrentProfileInput;
export type Web_App_App_SaveTorrentProfile_CreatedProfile = Web_Api_TorrentProfile;
export type Web_App_App_SaveTorrentProfile_BaseComparison = number;
export type Web_App_App_SaveTorrentProfile_UpdatedProfile = Web_Api_UpdateTorrentProfileResponse;
export type Web_App_App_AddTorrentAndRefreshLabels_Input = Web_Api_AddTorrentInput;
export type Web_App_App_AddTorrentAndRefreshLabels_Returns = Promise<Web_Api_TorrentAddResult>;
export type Web_App_App_AddTorrentAndRefreshLabels = (input: Web_App_App_AddTorrentAndRefreshLabels_Input) => Web_App_App_AddTorrentAndRefreshLabels_Returns;
export type Web_App_App_AddTorrentAndRefreshLabels_Result = Web_Api_TorrentAddResult;
export type Web_App_App_UpdateTorrentsAndRefreshLabels_Hashes = string[];
export type Web_App_App_UpdateTorrentsAndRefreshLabels_Changes = Web_Api_TorrentChanges;
export type Web_App_App_UpdateTorrentsAndRefreshLabels_Returns = Promise<void>;
export type Web_App_App_UpdateTorrentsAndRefreshLabels = (hashes: Web_App_App_UpdateTorrentsAndRefreshLabels_Hashes, changes: Web_App_App_UpdateTorrentsAndRefreshLabels_Changes) => Web_App_App_UpdateTorrentsAndRefreshLabels_Returns;
export type Web_App_App_SetTorrentProfileAndRefreshLabels_Input = Web_Api_SetTorrentProfileInput;
export type Web_App_App_SetTorrentProfileAndRefreshLabels_Returns = Promise<Web_Api_SetTorrentProfileResponse>;
export type Web_App_App_SetTorrentProfileAndRefreshLabels = (input: Web_App_App_SetTorrentProfileAndRefreshLabels_Input) => Web_App_App_SetTorrentProfileAndRefreshLabels_Returns;
export type Web_App_App_SetTorrentProfileAndRefreshLabels_Result = Web_Api_SetTorrentProfileResponse;
export type Web_App_App_ConfirmTorrentProfileDeletion_Returns = Promise<void>;
export type Web_App_App_ConfirmTorrentProfileDeletion = () => Web_App_App_ConfirmTorrentProfileDeletion_Returns;
export type Web_App_App_ConfirmTorrentProfileDeletion_DeleteResponse = Web_Api_DeleteTorrentProfileResponse;
export type Web_App_App_ConfirmTorrentProfileDeletion_TorrentCount = unknown;
export type Web_App_App_RpcEnabled = boolean;
export type Web_App_App_RpcSetting = Web_Api_Setting | undefined;
export type Web_App_App_Connections = Web_Api_VpnConnection[];
export type Web_App_App_SnapshotErrors = string[];
export type Web_App_App_SnapshotStatistics = Web_Api_Statistics | undefined;
export type Web_App_App_LibraryTorrents = Web_Api_Torrent[];
export type Web_App_App_RenderView_Returns = ReactElement;
export type Web_App_App_RenderView = () => Web_App_App_RenderView_Returns;
export type Web_App_App_RenderView_DeleteResponse = Web_Api_DeleteVpnConnectionResponse;
export type Web_App_App_RenderView_DefaultResponse = Web_Api_VpnDefaultResponse;
export type Web_App_App_RenderView_UploadedProfiles = Web_Api_VpnProfile[];
export type Web_App_App_RenderView_RpcCredential = Web_Api_RPCCredential;
export type Web_App_App_RenderView_NextToken = Web_Api_CreatedToken;
export type Web_App_App_RenderView_WebProxyCredential = Web_Api_WebProxyCredential;
export type Web_App_App_RenderView_NextWebProxy = Web_Api_WebProxy;
export type Web_App_App_RenderView_Overlapping = Web_Api_TorrentProfile | undefined;
export type Web_App_App_LastRemovedSecret = Web_Api_RemovedSecret | undefined;
export type Web_App_App_NoticeRemovedAt = string;
export type Web_App_App_Notice = ReactElement | null;
export type Web_App_App_Protection = Web_Components_Protection;
export type Web_App_App_DeletingTorrentProfileDefaultConnection = Web_Api_VpnConnection | undefined;
export type Web_App_App_DeletingTorrentProfileDefaultConnectionName = string;
export type Web_App_App_DeletingTorrentProfileHasFailures = boolean;
export type Web_App_App_DeletingTorrentProfileMessage = string;
export type Web_App_App_DeletingTorrentProfileConfirmLabel = string;
export type Web_App_App_RenderLibraryNavigation_OnSheetClose = (() => void) | undefined;
export type Web_App_App_RenderLibraryNavigation_Returns = ReactElement;
export type Web_App_App_RenderLibraryNavigation = (onSheetClose?: Web_App_App_RenderLibraryNavigation_OnSheetClose) => Web_App_App_RenderLibraryNavigation_Returns;
export type Web_App_App_RenderLibraryNavigation_MoveCount = number;

/**
 * App.
 *
 * @since 2.4.1
 */
export type Web_App_DescribeRemovedSecret_RemovedSecret = Web_Api_RemovedSecret;
export type Web_App_DescribeRemovedSecret_Returns_Label = string;
export type Web_App_DescribeRemovedSecret_Returns_View = Web_Components_View;
export type Web_App_DescribeRemovedSecret_Returns = {
  label: Web_App_DescribeRemovedSecret_Returns_Label;
  view: Web_App_DescribeRemovedSecret_Returns_View;
};

/**
 * App.
 *
 * @since 2.4.1
 */
export type Web_App_InitialDefaultTorrentProfile = Web_Api_DefaultTorrentProfile;
