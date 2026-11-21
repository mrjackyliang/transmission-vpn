import type {
  ChangeEvent,
  Dispatch,
  FormEvent,
  ReactElement,
  RefObject,
  SetStateAction,
} from 'react';

import type {
  Web_Api_CreateVpnConnectionInput,
  Web_Api_DeleteVpnConnectionResponse,
  Web_Api_LiveVpnConnection,
  Web_Api_MovedTorrent,
  Web_Api_Provider,
  Web_Api_ProviderCredentialField,
  Web_Api_ProviderP2P,
  Web_Api_ProviderTunnel,
  Web_Api_Status,
  Web_Api_UpdateVpnConnectionInput,
  Web_Api_VpnCapacity,
  Web_Api_VpnConfigurationInput,
  Web_Api_VpnConnection,
  Web_Api_VpnConnectionRuntime,
  Web_Api_VpnProfile,
  Web_Api_VpnRuntime,
  Web_Api_VpnRuntimeState,
  Web_Api_VpnTunnel,
} from '@/types/web/api.d.ts';
import type {
  Web_Components_VpnView_NavigationTarget,
  Web_Components_VpnView_Props,
} from '@/types/web/components.d.ts';
import type { Web_UseDragReorder_Result } from '@/types/web/use-drag-reorder.d.ts';
import type {
  Web_VpnTunnels_CredentialInput,
  Web_VpnTunnels_ProfileFile,
} from '@/types/web/vpn-tunnels.d.ts';

/**
 * Vpn View.
 *
 * @since 2.4.1
 */
export type Web_VpnView_ConnectionEditor_Props_Connection = Web_Api_VpnConnection | null;
export type Web_VpnView_ConnectionEditor_Props_DefaultPeerPort = number;
export type Web_VpnView_ConnectionEditor_Props_OnBack = () => void;
export type Web_VpnView_ConnectionEditor_Props_Profiles = Web_Api_VpnProfile[];
export type Web_VpnView_ConnectionEditor_Props_Providers = Web_Api_Provider[];
export type Web_VpnView_ConnectionEditor_Props = {
  connection: Web_VpnView_ConnectionEditor_Props_Connection;
  defaultPeerPort: Web_VpnView_ConnectionEditor_Props_DefaultPeerPort;
  onBack: Web_VpnView_ConnectionEditor_Props_OnBack;
  onCreate: Web_Components_VpnView_Props['onCreate'];
  onDisconnect: Web_Components_VpnView_Props['onDisconnect'];
  onMakeDefault: Web_Components_VpnView_Props['onMakeDefault'];
  onReconnect: Web_Components_VpnView_Props['onReconnect'];
  onRefreshCatalog: Web_Components_VpnView_Props['onRefreshCatalog'];
  onUpdate: Web_Components_VpnView_Props['onUpdate'];
  onUploadProfile: Web_Components_VpnView_Props['onUploadProfile'];
  profiles: Web_VpnView_ConnectionEditor_Props_Profiles;
  providers: Web_VpnView_ConnectionEditor_Props_Providers;
  snapshot: Web_Components_VpnView_Props['snapshot'];
};
export type Web_VpnView_ConnectionEditor_Returns = ReactElement;
export type Web_VpnView_ConnectionEditor_Connection = Web_Api_VpnConnection | null;
export type Web_VpnView_ConnectionEditor_DefaultPeerPort = number;
export type Web_VpnView_ConnectionEditor_OnBack = () => void;
export type Web_VpnView_ConnectionEditor_OnCreate = Web_Components_VpnView_Props['onCreate'];
export type Web_VpnView_ConnectionEditor_OnDisconnect = Web_Components_VpnView_Props['onDisconnect'];
export type Web_VpnView_ConnectionEditor_OnMakeDefault = Web_Components_VpnView_Props['onMakeDefault'];
export type Web_VpnView_ConnectionEditor_OnReconnect = Web_Components_VpnView_Props['onReconnect'];
export type Web_VpnView_ConnectionEditor_OnRefreshCatalog = Web_Components_VpnView_Props['onRefreshCatalog'];
export type Web_VpnView_ConnectionEditor_OnUpdate = Web_Components_VpnView_Props['onUpdate'];
export type Web_VpnView_ConnectionEditor_OnUploadProfile = Web_Components_VpnView_Props['onUploadProfile'];
export type Web_VpnView_ConnectionEditor_Profiles = Web_Api_VpnProfile[];
export type Web_VpnView_ConnectionEditor_Providers = Web_Api_Provider[];
export type Web_VpnView_ConnectionEditor_Snapshot = Web_Components_VpnView_Props['snapshot'];
export type Web_VpnView_ConnectionEditor_NameState = [string, Dispatch<SetStateAction<string>>];
export type Web_VpnView_ConnectionEditor_Name = string;
export type Web_VpnView_ConnectionEditor_SetName = Dispatch<SetStateAction<string>>;
export type Web_VpnView_ConnectionEditor_PeerPortState = [string, Dispatch<SetStateAction<string>>];
export type Web_VpnView_ConnectionEditor_PeerPort = string;
export type Web_VpnView_ConnectionEditor_SetPeerPort = Dispatch<SetStateAction<string>>;
export type Web_VpnView_ConnectionEditor_ProviderIDState = [string, Dispatch<SetStateAction<string>>];
export type Web_VpnView_ConnectionEditor_ProviderID = string;
export type Web_VpnView_ConnectionEditor_SetProviderID = Dispatch<SetStateAction<string>>;
export type Web_VpnView_ConnectionEditor_ProviderSubmissionAttemptedState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_VpnView_ConnectionEditor_ProviderSubmissionAttempted = boolean;
export type Web_VpnView_ConnectionEditor_SetProviderSubmissionAttempted = Dispatch<SetStateAction<boolean>>;
export type Web_VpnView_ConnectionEditor_TunnelChoiceState = [Web_Api_VpnTunnel, Dispatch<SetStateAction<Web_Api_VpnTunnel>>];
export type Web_VpnView_ConnectionEditor_TunnelChoice = Web_Api_VpnTunnel;
export type Web_VpnView_ConnectionEditor_SetTunnelChoice = Dispatch<SetStateAction<Web_Api_VpnTunnel>>;
export type Web_VpnView_ConnectionEditor_ProfileIDsState = [string[], Dispatch<SetStateAction<string[]>>];
export type Web_VpnView_ConnectionEditor_ProfileIDs = string[];
export type Web_VpnView_ConnectionEditor_SetProfileIDs = Dispatch<SetStateAction<string[]>>;
export type Web_VpnView_ConnectionEditor_EndpointStrategyState = [Web_Api_VpnConnection['endpointStrategy'], Dispatch<SetStateAction<Web_Api_VpnConnection['endpointStrategy']>>];
export type Web_VpnView_ConnectionEditor_EndpointStrategy = Web_Api_VpnConnection['endpointStrategy'];
export type Web_VpnView_ConnectionEditor_SetEndpointStrategy = Dispatch<SetStateAction<Web_Api_VpnConnection['endpointStrategy']>>;
export type Web_VpnView_ConnectionEditor_SearchState = [string, Dispatch<SetStateAction<string>>];
export type Web_VpnView_ConnectionEditor_Search = string;
export type Web_VpnView_ConnectionEditor_SetSearch = Dispatch<SetStateAction<string>>;
export type Web_VpnView_ConnectionEditor_ContinentState = [string, Dispatch<SetStateAction<string>>];
export type Web_VpnView_ConnectionEditor_Continent = string;
export type Web_VpnView_ConnectionEditor_SetContinent = Dispatch<SetStateAction<string>>;
export type Web_VpnView_ConnectionEditor_ProtocolState = [string, Dispatch<SetStateAction<string>>];
export type Web_VpnView_ConnectionEditor_Protocol = string;
export type Web_VpnView_ConnectionEditor_SetProtocol = Dispatch<SetStateAction<string>>;
export type Web_VpnView_ConnectionEditor_VisibleProfileCountState = [number, Dispatch<SetStateAction<number>>];
export type Web_VpnView_ConnectionEditor_VisibleProfileCount = number;
export type Web_VpnView_ConnectionEditor_SetVisibleProfileCount = Dispatch<SetStateAction<number>>;
export type Web_VpnView_ConnectionEditor_CredentialsState = [Record<string, string>, Dispatch<SetStateAction<Record<string, string>>>];
export type Web_VpnView_ConnectionEditor_Credentials = Record<string, string>;
export type Web_VpnView_ConnectionEditor_SetCredentials = Dispatch<SetStateAction<Record<string, string>>>;
export type Web_VpnView_ConnectionEditor_DnsModeState = ['provider' | 'custom', Dispatch<SetStateAction<'provider' | 'custom'>>];
export type Web_VpnView_ConnectionEditor_DnsMode = 'provider' | 'custom';
export type Web_VpnView_ConnectionEditor_SetDNSMode = Dispatch<SetStateAction<'provider' | 'custom'>>;
export type Web_VpnView_ConnectionEditor_CustomDNSState = [string, Dispatch<SetStateAction<string>>];
export type Web_VpnView_ConnectionEditor_CustomDNS = string;
export type Web_VpnView_ConnectionEditor_SetCustomDNS = Dispatch<SetStateAction<string>>;
export type Web_VpnView_ConnectionEditor_RetryIntervalState = [string, Dispatch<SetStateAction<string>>];
export type Web_VpnView_ConnectionEditor_RetryInterval = string;
export type Web_VpnView_ConnectionEditor_SetRetryInterval = Dispatch<SetStateAction<string>>;
export type Web_VpnView_ConnectionEditor_BusyActionState = [string, Dispatch<SetStateAction<string>>];
export type Web_VpnView_ConnectionEditor_BusyAction = string;
export type Web_VpnView_ConnectionEditor_SetBusyAction = Dispatch<SetStateAction<string>>;
export type Web_VpnView_ConnectionEditor_ErrorState = [string, Dispatch<SetStateAction<string>>];
export type Web_VpnView_ConnectionEditor_Error = string;
export type Web_VpnView_ConnectionEditor_SetError = Dispatch<SetStateAction<string>>;
export type Web_VpnView_ConnectionEditor_FieldErrorState = [Error | null, Dispatch<SetStateAction<Error | null>>];
export type Web_VpnView_ConnectionEditor_FieldError = Error | null;
export type Web_VpnView_ConnectionEditor_SetFieldError = Dispatch<SetStateAction<Error | null>>;
export type Web_VpnView_ConnectionEditor_CustomFileState = [File | null, Dispatch<SetStateAction<File | null>>];
export type Web_VpnView_ConnectionEditor_CustomFile = File | null;
export type Web_VpnView_ConnectionEditor_SetCustomFile = Dispatch<SetStateAction<File | null>>;
export type Web_VpnView_ConnectionEditor_TunnelLabelID = string;
export type Web_VpnView_ConnectionEditor_UploadHintID = string;
export type Web_VpnView_ConnectionEditor_ReorderHintID = string;
export type Web_VpnView_ConnectionEditor_InitializedSessionIDRef = RefObject<string | null>;
export type Web_VpnView_ConnectionEditor_InitializedSessionID = string | null;
export type Web_VpnView_ConnectionEditor_PoolListRef = RefObject<HTMLOListElement | null>;
export type Web_VpnView_ConnectionEditor_PoolList = HTMLOListElement | null;
export type Web_VpnView_ConnectionEditor_SessionID = string;
export type Web_VpnView_ConnectionEditor_NextProviderID = string;
export type Web_VpnView_ConnectionEditor_NextProvider = Web_Api_Provider | undefined;
export type Web_VpnView_ConnectionEditor_NextPickedTunnel = Web_Api_ProviderTunnel | undefined;
export type Web_VpnView_ConnectionEditor_NextPickedTunnelID = Web_Api_VpnTunnel;
export type Web_VpnView_ConnectionEditor_NextTunnel = Web_Api_VpnTunnel;
export type Web_VpnView_ConnectionEditor_SelectedProvider = Web_Api_Provider | undefined;
export type Web_VpnView_ConnectionEditor_SelectedP2P = Web_Api_ProviderP2P | null;
export type Web_VpnView_ConnectionEditor_SelectedTunnel = Web_Api_ProviderTunnel | undefined;
export type Web_VpnView_ConnectionEditor_TunnelID = Web_Api_VpnTunnel;
export type Web_VpnView_ConnectionEditor_IsWireGuard = boolean;
export type Web_VpnView_ConnectionEditor_UploadFile = Web_VpnTunnels_ProfileFile;
export type Web_VpnView_ConnectionEditor_ProviderProfiles = Web_Api_VpnProfile[];
export type Web_VpnView_ConnectionEditor_ProfileByID = Map<string, Web_Api_VpnProfile>;
export type Web_VpnView_ConnectionEditor_ProfileEntry = [string, Web_Api_VpnProfile];
export type Web_VpnView_ConnectionEditor_ProfileEntries = Web_VpnView_ConnectionEditor_ProfileEntry[];
export type Web_VpnView_ConnectionEditor_SelectedProfiles = Web_Api_VpnProfile[];
export type Web_VpnView_ConnectionEditor_SelectedProfile = Web_Api_VpnProfile | undefined;
export type Web_VpnView_ConnectionEditor_PoolReorder = Web_UseDragReorder_Result;
export type Web_VpnView_ConnectionEditor_Continents = string[];
export type Web_VpnView_ConnectionEditor_FilteredProfiles = Web_Api_VpnProfile[];
export type Web_VpnView_ConnectionEditor_NormalizedSearch = string;
export type Web_VpnView_ConnectionEditor_VisibleProfiles = Web_Api_VpnProfile[];
export type Web_VpnView_ConnectionEditor_CredentialFields = Web_Api_ProviderCredentialField[];
export type Web_VpnView_ConnectionEditor_SavedCredentials = string[];
export type Web_VpnView_ConnectionEditor_NameIssue = string;
export type Web_VpnView_ConnectionEditor_PeerPortIssue = string;
export type Web_VpnView_ConnectionEditor_ProviderIssue = string;
export type Web_VpnView_ConnectionEditor_Runtime = Web_Api_VpnRuntime | undefined;
export type Web_VpnView_ConnectionEditor_RuntimeState = Web_Api_VpnRuntimeState | undefined;
export type Web_VpnView_ConnectionEditor_RuntimeProviderID = string | undefined;
export type Web_VpnView_ConnectionEditor_RuntimeProfileID = string | undefined;
export type Web_VpnView_ConnectionEditor_RuntimeTunnel = Web_Api_VpnTunnel | undefined;
export type Web_VpnView_ConnectionEditor_RuntimeInterface = string | undefined;
export type Web_VpnView_ConnectionEditor_RuntimeLastHandshakeAt = string | undefined;
export type Web_VpnView_ConnectionEditor_RuntimeRemoteHost = string | undefined;
export type Web_VpnView_ConnectionEditor_RuntimeRemotePort = number | undefined;
export type Web_VpnView_ConnectionEditor_RuntimeEndpointStrategy = Web_Api_VpnConnectionRuntime['endpointStrategy'] | undefined;
export type Web_VpnView_ConnectionEditor_RuntimeEndpointCount = number | undefined;
export type Web_VpnView_ConnectionEditor_RuntimeEndpointPosition = number | undefined;
export type Web_VpnView_ConnectionEditor_RuntimeLastError = string | undefined;
export type Web_VpnView_ConnectionEditor_ConnectionProviderID = string | undefined;
export type Web_VpnView_ConnectionEditor_ActiveProviderID = string | undefined;
export type Web_VpnView_ConnectionEditor_ActiveProvider = Web_Api_Provider | undefined;
export type Web_VpnView_ConnectionEditor_ActiveProfile = Web_Api_VpnProfile | undefined;
export type Web_VpnView_ConnectionEditor_ActiveProviderName = string | undefined;
export type Web_VpnView_ConnectionEditor_SelectedProviderName = string | undefined;
export type Web_VpnView_ConnectionEditor_ProviderLabel = string;
export type Web_VpnView_ConnectionEditor_Firewall = Web_Api_Status['runtime']['firewall'] | undefined;
export type Web_VpnView_ConnectionEditor_RuntimeTone = string;
export type Web_VpnView_ConnectionEditor_RuntimeLabel = string;
export type Web_VpnView_ConnectionEditor_StatusIsProtected = boolean;
export type Web_VpnView_ConnectionEditor_StatusIsWireGuard = boolean;
export type Web_VpnView_ConnectionEditor_InterfaceLabel = string;
export type Web_VpnView_ConnectionEditor_HandshakeLabel = string;
export type Web_VpnView_ConnectionEditor_RemotePort = string;
export type Web_VpnView_ConnectionEditor_ProtocolSuffix = string;
export type Web_VpnView_ConnectionEditor_EndpointLabel = string;
export type Web_VpnView_ConnectionEditor_StrategySuffix = string;
export type Web_VpnView_ConnectionEditor_ProfileCountNoun = string;
export type Web_VpnView_ConnectionEditor_PoolLabel = string;
export type Web_VpnView_ConnectionEditor_FirewallLabel = string;
export type Web_VpnView_ConnectionEditor_NormalizedDNS = string[];
export type Web_VpnView_ConnectionEditor_CredentialsDirty = boolean;
export type Web_VpnView_ConnectionEditor_ConfigurationDirty = boolean;
export type Web_VpnView_ConnectionEditor_MetadataDirty = boolean;
export type Web_VpnView_ConnectionEditor_RenameOnly = boolean;
export type Web_VpnView_ConnectionEditor_ChangeRunning = boolean;
export type Web_VpnView_ConnectionEditor_DnsHint = string;
export type Web_VpnView_ConnectionEditor_ResetSelection_Returns = void;
export type Web_VpnView_ConnectionEditor_ResetSelection = () => Web_VpnView_ConnectionEditor_ResetSelection_Returns;
export type Web_VpnView_ConnectionEditor_ToggleProfile_ProfileID = string;
export type Web_VpnView_ConnectionEditor_ToggleProfile_Returns = void;
export type Web_VpnView_ConnectionEditor_ToggleProfile = (profileID: Web_VpnView_ConnectionEditor_ToggleProfile_ProfileID) => Web_VpnView_ConnectionEditor_ToggleProfile_Returns;
export type Web_VpnView_ConnectionEditor_BuildConfiguration_Returns = Web_Api_VpnConfigurationInput;
export type Web_VpnView_ConnectionEditor_BuildConfiguration = () => Web_VpnView_ConnectionEditor_BuildConfiguration_Returns;
export type Web_VpnView_ConnectionEditor_Submit_Event = FormEvent<HTMLFormElement>;
export type Web_VpnView_ConnectionEditor_Submit_Returns = Promise<void>;
export type Web_VpnView_ConnectionEditor_Submit = (event: Web_VpnView_ConnectionEditor_Submit_Event) => Web_VpnView_ConnectionEditor_Submit_Returns;
export type Web_VpnView_ConnectionEditor_Submit_CreateInput = Web_Api_CreateVpnConnectionInput;
export type Web_VpnView_ConnectionEditor_Submit_UpdateInput = Web_Api_UpdateVpnConnectionInput;
export type Web_VpnView_ConnectionEditor_Submit_ShownFields = string[];
export type Web_VpnView_ConnectionEditor_RunConnectionAction_Action = 'default' | 'disconnect' | 'reconnect';
export type Web_VpnView_ConnectionEditor_RunConnectionAction_Returns = Promise<void>;
export type Web_VpnView_ConnectionEditor_RunConnectionAction = (action: Web_VpnView_ConnectionEditor_RunConnectionAction_Action) => Web_VpnView_ConnectionEditor_RunConnectionAction_Returns;
export type Web_VpnView_ConnectionEditor_HandleCustomFile_Event = ChangeEvent<HTMLInputElement>;
export type Web_VpnView_ConnectionEditor_HandleCustomFile_Returns = void;
export type Web_VpnView_ConnectionEditor_HandleCustomFile = (event: Web_VpnView_ConnectionEditor_HandleCustomFile_Event) => Web_VpnView_ConnectionEditor_HandleCustomFile_Returns;
export type Web_VpnView_ConnectionEditor_HandleCustomFile_Files = FileList | null;
export type Web_VpnView_ConnectionEditor_HandleCustomFile_File = File | undefined;
export type Web_VpnView_ConnectionEditor_UploadProfile_Returns = Promise<void>;
export type Web_VpnView_ConnectionEditor_UploadProfile = () => Web_VpnView_ConnectionEditor_UploadProfile_Returns;
export type Web_VpnView_ConnectionEditor_UploadProfile_ProfileContent = string;
export type Web_VpnView_ConnectionEditor_UploadProfile_UploadedProfiles = Web_Api_VpnProfile[];
export type Web_VpnView_ConnectionEditor_UploadProfile_FirstUploadedProfile = Web_Api_VpnProfile | undefined;
export type Web_VpnView_ConnectionEditor_UploadProfile_UploadedNoun = string;
export type Web_VpnView_ConnectionEditor_TunnelControl = ReactElement | null;
export type Web_VpnView_ConnectionEditor_PrimaryButtonLabel = string;
export type Web_VpnView_ConnectionEditor_ActionsRenameOnlyClass = string;
export type Web_VpnView_ConnectionEditor_SubmitDisabled = boolean;
export type Web_VpnView_ConnectionEditor_Selected = boolean;
export type Web_VpnView_ConnectionEditor_Saved = boolean;
export type Web_VpnView_ConnectionEditor_Input = Web_VpnTunnels_CredentialInput;
export type Web_VpnView_ConnectionEditor_Description = string;
export type Web_VpnView_ConnectionEditor_Separator = string;
export type Web_VpnView_ConnectionEditor_FieldIssue = string;
export type Web_VpnView_ConnectionEditor_CredentialHelp = ReactElement | null;
export type Web_VpnView_ConnectionEditor_NextValue = string;

/**
 * Vpn View.
 *
 * @since 2.4.1
 */
export type Web_VpnView_ConnectionState_Connection = Web_Api_VpnConnection;
export type Web_VpnView_ConnectionState_Snapshot = Web_Components_VpnView_Props['snapshot'];
export type Web_VpnView_ConnectionState_Returns = Web_Api_VpnRuntime;
export type Web_VpnView_ConnectionState_LiveConnection = Web_Api_LiveVpnConnection | undefined;

/**
 * Vpn View.
 *
 * @since 2.4.1
 */
export type Web_VpnView_DefaultChangeState_Connection = Web_Api_VpnConnection;
export type Web_VpnView_DefaultChangeState_DefaultProfileTorrents = number;
export type Web_VpnView_DefaultChangeState_FollowingProfileTorrents = number;
export type Web_VpnView_DefaultChangeState_Torrents = number;
export type Web_VpnView_DefaultChangeState = {
  connection: Web_VpnView_DefaultChangeState_Connection;
  defaultProfileTorrents: Web_VpnView_DefaultChangeState_DefaultProfileTorrents;
  followingProfileTorrents: Web_VpnView_DefaultChangeState_FollowingProfileTorrents;
  torrents: Web_VpnView_DefaultChangeState_Torrents;
};

/**
 * Vpn View.
 *
 * @since 2.4.1
 */
export type Web_VpnView_EndpointStrategy = Web_Api_VpnConnection['endpointStrategy'];

/**
 * Vpn View.
 *
 * @since 2.4.1
 */
export type Web_VpnView_EndpointStrategyDescriptions = Record<Web_Api_VpnConnection['endpointStrategy'], string>;

/**
 * Vpn View.
 *
 * @since 2.4.1
 */
export type Web_VpnView_MaximumCustomProfileBytes = number;

/**
 * Vpn View.
 *
 * @since 2.4.1
 */
export type Web_VpnView_MovedTorrents_Details = Record<string, unknown>;
export type Web_VpnView_MovedTorrents_Returns = Web_Api_MovedTorrent[];
export type Web_VpnView_MovedTorrents_Moved = Web_Api_MovedTorrent[];

/**
 * Vpn View.
 *
 * @since 2.4.1
 */
export type Web_VpnView_ParseDependencies_Details = Record<string, unknown>;
export type Web_VpnView_ParseDependencies_Returns = Web_VpnView_RemoveDependencies;
export type Web_VpnView_ParseDependencies_Logins = Web_VpnView_RemoveDependencies_Logins;
export type Web_VpnView_ParseDependencies_Profiles = Web_VpnView_RemoveDependencies_Profiles;

/**
 * Vpn View.
 *
 * @since 2.4.1
 */
export type Web_VpnView_RemoveDependencies_Torrents = number;
export type Web_VpnView_RemoveDependencies_Profile_Id = string;
export type Web_VpnView_RemoveDependencies_Profile_Name = string;
export type Web_VpnView_RemoveDependencies_Profile = {
  id: Web_VpnView_RemoveDependencies_Profile_Id;
  name: Web_VpnView_RemoveDependencies_Profile_Name;
};
export type Web_VpnView_RemoveDependencies_Profiles = Web_VpnView_RemoveDependencies_Profile[];
export type Web_VpnView_RemoveDependencies_Login_Id = string;
export type Web_VpnView_RemoveDependencies_Login_Username = string;
export type Web_VpnView_RemoveDependencies_Login = {
  id: Web_VpnView_RemoveDependencies_Login_Id;
  username: Web_VpnView_RemoveDependencies_Login_Username;
};
export type Web_VpnView_RemoveDependencies_Logins = Web_VpnView_RemoveDependencies_Login[];
export type Web_VpnView_RemoveDependencies = {
  torrents: Web_VpnView_RemoveDependencies_Torrents;
  profiles: Web_VpnView_RemoveDependencies_Profiles;
  logins: Web_VpnView_RemoveDependencies_Logins;
};

/**
 * Vpn View.
 *
 * @since 2.4.1
 */
export type Web_VpnView_RemoveState_Connection = Web_Api_VpnConnection;
export type Web_VpnView_RemoveState_Dependencies = Web_VpnView_RemoveDependencies;
export type Web_VpnView_RemoveState = {
  connection: Web_VpnView_RemoveState_Connection;
  dependencies: Web_VpnView_RemoveState_Dependencies;
};

/**
 * Vpn View.
 *
 * @since 2.4.1
 */
export type Web_VpnView_StateLabels = Record<string, string>;

/**
 * Vpn View.
 *
 * @since 2.4.1
 */
export type Web_VpnView_StatusReason_Runtime = Web_Api_VpnRuntime;
export type Web_VpnView_StatusReason_Returns = string;

/**
 * Vpn View.
 *
 * @since 2.4.1
 */
export type Web_VpnView_StatusTone_State = string;
export type Web_VpnView_StatusTone_Returns = string;

/**
 * Vpn View.
 *
 * @since 2.4.1
 */
export type Web_VpnView_VpnView_Props = Web_Components_VpnView_Props;
export type Web_VpnView_VpnView_Returns = ReactElement;
export type Web_VpnView_VpnView_Response = Web_Components_VpnView_Props['connections'];
export type Web_VpnView_VpnView_DefaultProfile = Web_Components_VpnView_Props['defaultProfile'];
export type Web_VpnView_VpnView_NavigationSequence = Web_Components_VpnView_Props['navigationSequence'];
export type Web_VpnView_VpnView_NavigationTarget = Web_Components_VpnView_Props['navigationTarget'];
export type Web_VpnView_VpnView_OnCreate = Web_Components_VpnView_Props['onCreate'];
export type Web_VpnView_VpnView_OnDelete = Web_Components_VpnView_Props['onDelete'];
export type Web_VpnView_VpnView_OnDisconnect = Web_Components_VpnView_Props['onDisconnect'];
export type Web_VpnView_VpnView_OnMakeDefault = Web_Components_VpnView_Props['onMakeDefault'];
export type Web_VpnView_VpnView_OnNavigate = Web_Components_VpnView_Props['onNavigate'];
export type Web_VpnView_VpnView_OnOpenTorrents = Web_Components_VpnView_Props['onOpenTorrents'];
export type Web_VpnView_VpnView_OnReconnect = Web_Components_VpnView_Props['onReconnect'];
export type Web_VpnView_VpnView_OnRefreshCatalog = Web_Components_VpnView_Props['onRefreshCatalog'];
export type Web_VpnView_VpnView_OnUpdate = Web_Components_VpnView_Props['onUpdate'];
export type Web_VpnView_VpnView_OnUploadProfile = Web_Components_VpnView_Props['onUploadProfile'];
export type Web_VpnView_VpnView_Profiles = Web_Components_VpnView_Props['profiles'];
export type Web_VpnView_VpnView_Providers = Web_Components_VpnView_Props['providers'];
export type Web_VpnView_VpnView_Snapshot = Web_Components_VpnView_Props['snapshot'];
export type Web_VpnView_VpnView_SelectedIDState = [string | 'new' | null, Dispatch<SetStateAction<string | 'new' | null>>];
export type Web_VpnView_VpnView_SelectedID = string | 'new' | null;
export type Web_VpnView_VpnView_SetSelectedID = Dispatch<SetStateAction<string | 'new' | null>>;
export type Web_VpnView_VpnView_RemoveStateState = [Web_VpnView_RemoveState | null, Dispatch<SetStateAction<Web_VpnView_RemoveState | null>>];
export type Web_VpnView_VpnView_RemoveState = Web_VpnView_RemoveState | null;
export type Web_VpnView_VpnView_SetRemoveState = Dispatch<SetStateAction<Web_VpnView_RemoveState | null>>;
export type Web_VpnView_VpnView_MoveToState = [string, Dispatch<SetStateAction<string>>];
export type Web_VpnView_VpnView_MoveTo = string;
export type Web_VpnView_VpnView_SetMoveTo = Dispatch<SetStateAction<string>>;
export type Web_VpnView_VpnView_RemovingState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_VpnView_VpnView_Removing = boolean;
export type Web_VpnView_VpnView_SetRemoving = Dispatch<SetStateAction<boolean>>;
export type Web_VpnView_VpnView_RemoveErrorState = [string, Dispatch<SetStateAction<string>>];
export type Web_VpnView_VpnView_RemoveError = string;
export type Web_VpnView_VpnView_SetRemoveError = Dispatch<SetStateAction<string>>;
export type Web_VpnView_VpnView_MoveResultsState = [Web_Api_MovedTorrent[], Dispatch<SetStateAction<Web_Api_MovedTorrent[]>>];
export type Web_VpnView_VpnView_MoveResults = Web_Api_MovedTorrent[];
export type Web_VpnView_VpnView_SetMoveResults = Dispatch<SetStateAction<Web_Api_MovedTorrent[]>>;
export type Web_VpnView_VpnView_RemovalCompleteState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_VpnView_VpnView_RemovalComplete = boolean;
export type Web_VpnView_VpnView_SetRemovalComplete = Dispatch<SetStateAction<boolean>>;
export type Web_VpnView_VpnView_DefaultChangeStateState = [Web_VpnView_DefaultChangeState | null, Dispatch<SetStateAction<Web_VpnView_DefaultChangeState | null>>];
export type Web_VpnView_VpnView_DefaultChangeState = Web_VpnView_DefaultChangeState | null;
export type Web_VpnView_VpnView_SetDefaultChangeState = Dispatch<SetStateAction<Web_VpnView_DefaultChangeState | null>>;
export type Web_VpnView_VpnView_DefaultChangeBusyState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_VpnView_VpnView_DefaultChangeBusy = boolean;
export type Web_VpnView_VpnView_SetDefaultChangeBusy = Dispatch<SetStateAction<boolean>>;
export type Web_VpnView_VpnView_DefaultChangeErrorState = [string, Dispatch<SetStateAction<string>>];
export type Web_VpnView_VpnView_DefaultChangeError = string;
export type Web_VpnView_VpnView_SetDefaultChangeError = Dispatch<SetStateAction<string>>;
export type Web_VpnView_VpnView_DefaultMoveResultsState = [Web_Api_MovedTorrent[], Dispatch<SetStateAction<Web_Api_MovedTorrent[]>>];
export type Web_VpnView_VpnView_DefaultMoveResults = Web_Api_MovedTorrent[];
export type Web_VpnView_VpnView_SetDefaultMoveResults = Dispatch<SetStateAction<Web_Api_MovedTorrent[]>>;
export type Web_VpnView_VpnView_DefaultChangeCompleteState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_VpnView_VpnView_DefaultChangeComplete = boolean;
export type Web_VpnView_VpnView_SetDefaultChangeComplete = Dispatch<SetStateAction<boolean>>;
export type Web_VpnView_VpnView_HandledNavigationSequenceRef = RefObject<number>;
export type Web_VpnView_VpnView_HandledNavigationSequence = number;
export type Web_VpnView_VpnView_CloseMenusOutside_Event = PointerEvent;
export type Web_VpnView_VpnView_CloseMenusOutside_Returns = void;
export type Web_VpnView_VpnView_CloseMenusOutside = (event: Web_VpnView_VpnView_CloseMenusOutside_Event) => Web_VpnView_VpnView_CloseMenusOutside_Returns;
export type Web_VpnView_VpnView_CloseMenusOnEscape_Event = KeyboardEvent;
export type Web_VpnView_VpnView_CloseMenusOnEscape_Returns = void;
export type Web_VpnView_VpnView_CloseMenusOnEscape = (event: Web_VpnView_VpnView_CloseMenusOnEscape_Event) => Web_VpnView_VpnView_CloseMenusOnEscape_Returns;
export type Web_VpnView_VpnView_Connections = Web_Api_VpnConnection[];
export type Web_VpnView_VpnView_SelectedConnection = Web_Api_VpnConnection | null;
export type Web_VpnView_VpnView_UsedPeerPorts = Set<number>;
export type Web_VpnView_VpnView_DefaultPeerPort = number;
export type Web_VpnView_VpnView_Capacity = Web_Api_VpnCapacity | undefined;
export type Web_VpnView_VpnView_AtCapacity = boolean;
export type Web_VpnView_VpnView_CapacityMemoryGigabytes = number;
export type Web_VpnView_VpnView_CapacityCpus = number | undefined;
export type Web_VpnView_VpnView_CapacityLimit = number | undefined;
export type Web_VpnView_VpnView_CapacityCpuNoun = string;
export type Web_VpnView_VpnView_CapacityDescription = string;
export type Web_VpnView_VpnView_OpenNavigationTarget_Target = Web_Components_VpnView_NavigationTarget;
export type Web_VpnView_VpnView_OpenNavigationTarget_Replace = boolean;
export type Web_VpnView_VpnView_OpenNavigationTarget_Returns = void;
export type Web_VpnView_VpnView_OpenNavigationTarget = (target: Web_VpnView_VpnView_OpenNavigationTarget_Target, replace?: Web_VpnView_VpnView_OpenNavigationTarget_Replace) => Web_VpnView_VpnView_OpenNavigationTarget_Returns;
export type Web_VpnView_VpnView_ConnectionExists = boolean;
export type Web_VpnView_VpnView_RequestRemove_Connection = Web_Api_VpnConnection;
export type Web_VpnView_VpnView_RequestRemove_Returns = Promise<void>;
export type Web_VpnView_VpnView_RequestRemove = (connection: Web_VpnView_VpnView_RequestRemove_Connection) => Web_VpnView_VpnView_RequestRemove_Returns;
export type Web_VpnView_VpnView_RequestRemove_Dependencies = Web_VpnView_RemoveDependencies;
export type Web_VpnView_VpnView_RequestRemove_DefaultCandidate = Web_Api_VpnConnection | undefined;
export type Web_VpnView_VpnView_MoveAndRemove_Returns = Promise<void>;
export type Web_VpnView_VpnView_MoveAndRemove = () => Web_VpnView_VpnView_MoveAndRemove_Returns;
export type Web_VpnView_VpnView_MoveAndRemove_TargetConnection = Web_Api_VpnConnection | undefined;
export type Web_VpnView_VpnView_MoveAndRemove_TargetConnectionName = string;
export type Web_VpnView_VpnView_MoveAndRemove_Result = Web_Api_DeleteVpnConnectionResponse;
export type Web_VpnView_VpnView_MoveAndRemove_HasWarnings = boolean;
export type Web_VpnView_VpnView_MoveAndRemove_Warnings = string[] | undefined;
export type Web_VpnView_VpnView_RequestDefaultChange_ConnectionId = string;
export type Web_VpnView_VpnView_RequestDefaultChange_Returns = Promise<Web_Api_MovedTorrent[]>;
export type Web_VpnView_VpnView_RequestDefaultChange = (connectionId: Web_VpnView_VpnView_RequestDefaultChange_ConnectionId) => Web_VpnView_VpnView_RequestDefaultChange_Returns;
export type Web_VpnView_VpnView_RequestDefaultChange_Connection = Web_Api_VpnConnection | undefined;
export type Web_VpnView_VpnView_RequestDefaultChange_Results = Web_Api_MovedTorrent[];
export type Web_VpnView_VpnView_RequestDefaultChange_TorrentCount = unknown;
export type Web_VpnView_VpnView_RequestDefaultChange_DefaultProfileTorrentCount = unknown;
export type Web_VpnView_VpnView_RequestDefaultChange_FollowingProfileTorrentCount = unknown;
export type Web_VpnView_VpnView_ConfirmDefaultChange_Returns = Promise<void>;
export type Web_VpnView_VpnView_ConfirmDefaultChange = () => Web_VpnView_VpnView_ConfirmDefaultChange_Returns;
export type Web_VpnView_VpnView_ConfirmDefaultChange_Results = Web_Api_MovedTorrent[];
export type Web_VpnView_VpnView_CloseDefaultChange_Returns = void;
export type Web_VpnView_VpnView_CloseDefaultChange = () => Web_VpnView_VpnView_CloseDefaultChange_Returns;
export type Web_VpnView_VpnView_DefaultChangeHasFailures = boolean;
export type Web_VpnView_VpnView_DefaultChangeMessage = string;
export type Web_VpnView_VpnView_DefaultChangeDialog = ReactElement;
export type Web_VpnView_VpnView_RemoveTorrentNoun = string;
export type Web_VpnView_VpnView_RemoveProfileNoun = string;
export type Web_VpnView_VpnView_RemoveLoginNoun = string;
export type Web_VpnView_VpnView_Runtime = Web_Api_VpnRuntime;
export type Web_VpnView_VpnView_Endpoint = string;
export type Web_VpnView_VpnView_ConnectionProvider = Web_Api_Provider | undefined;
export type Web_VpnView_VpnView_ProviderName = string;
export type Web_VpnView_VpnView_TorrentNoun = string;
export type Web_VpnView_VpnView_Menu = HTMLDetailsElement | null;
