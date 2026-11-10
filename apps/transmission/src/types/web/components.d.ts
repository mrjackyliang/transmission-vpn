import type {
  ReactElement,
  ReactNode,
} from 'react';

import type {
  Web_Api_AddTorrentInput,
  Web_Api_BlocklistStatus,
  Web_Api_CreatedToken,
  Web_Api_CreateTokenInput,
  Web_Api_CreateVpnConnectionInput,
  Web_Api_DefaultTorrentProfile,
  Web_Api_DefaultTorrentProfileInput,
  Web_Api_DeleteVpnConnectionInput,
  Web_Api_DeleteVpnConnectionResponse,
  Web_Api_Directory,
  Web_Api_DirectoryEntry,
  Web_Api_DirectoryPurpose,
  Web_Api_JsonValue,
  Web_Api_LiveSnapshot,
  Web_Api_MovedTorrent,
  Web_Api_Provider,
  Web_Api_RenameTorrentPathInput,
  Web_Api_RPCCredential,
  Web_Api_RPCLogin,
  Web_Api_Scope,
  Web_Api_Setting,
  Web_Api_SettingsSnapshot,
  Web_Api_SetTorrentProfileInput,
  Web_Api_SetTorrentProfileResponse,
  Web_Api_Statistics,
  Web_Api_Token,
  Web_Api_Torrent,
  Web_Api_TorrentAction,
  Web_Api_TorrentAddResult,
  Web_Api_TorrentChanges,
  Web_Api_TorrentDetail,
  Web_Api_TorrentFile,
  Web_Api_TorrentOrganization,
  Web_Api_TorrentProfile,
  Web_Api_TorrentProfileFolderOverlap,
  Web_Api_TorrentProfileInput,
  Web_Api_UpdateRPCLoginInput,
  Web_Api_UpdateTokenInput,
  Web_Api_UpdateTorrentOrganizationInput,
  Web_Api_UpdateVpnConnectionInput,
  Web_Api_UpdateWebProxyLoginInput,
  Web_Api_VpnConnection,
  Web_Api_VpnConnectionsResponse,
  Web_Api_VpnProfile,
  Web_Api_VpnTunnel,
  Web_Api_WebProxy,
  Web_Api_WebProxyCredential,
  Web_Api_WebProxyLogin,
  Web_Api_WebProxyLoginInput,
} from '@/types/web/api.d.ts';

/**
 * Components.
 *
 * @since 2.0.0
 */
export type Web_Components_View = 'torrents' | 'vpn' | 'settings' | 'access' | 'notifications' | 'security';

/**
 * Components.
 *
 * @since 2.0.0
 */
export type Web_Components_Icon_Name =
  'activity'
  | 'add'
  | 'arrow-down'
  | 'arrow-up'
  | 'archive'
  | 'bell'
  | 'bot'
  | 'check'
  | 'chevron'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-up'
  | 'clock'
  | 'containers'
  | 'copy'
  | 'download'
  | 'duplicate'
  | 'edit'
  | 'external'
  | 'features'
  | 'folder'
  | 'grip'
  | 'history'
  | 'image'
  | 'import'
  | 'invite'
  | 'key'
  | 'label'
  | 'logout'
  | 'logs'
  | 'menu'
  | 'more'
  | 'overview'
  | 'pause'
  | 'play'
  | 'plug'
  | 'refresh'
  | 'remove'
  | 'search'
  | 'send'
  | 'server'
  | 'settings'
  | 'shield'
  | 'signal'
  | 'sliders-horizontal'
  | 'stop'
  | 'torrent'
  | 'upload'
  | 'users'
  | 'variable'
  | 'warning'
  | 'x';
export type Web_Components_Icon_Props = {
  name: Web_Components_Icon_Name;
  size?: number;
};
export type Web_Components_Icon_Returns = ReactElement;

/**
 * Components.
 *
 * @since 2.0.0
 */
export type Web_Components_Button_Variant = 'primary' | 'secondary' | 'quiet' | 'danger';
export type Web_Components_Button_Props = {
  block?: boolean;
  children: ReactNode;
  disabled?: boolean;
  icon?: Web_Components_Icon_Name;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: Web_Components_Button_Variant;
};

/**
 * Components.
 *
 * @since 2.0.0
 */
export type Web_Components_ConfirmDialog_Tone = 'danger' | 'primary';

/**
 * Components.
 *
 * @since 2.0.0
 */
export type Web_Components_ConfirmDialog_Props = {
  busy: boolean;
  busyLabel: string;
  children?: ReactNode;
  confirmDisabled?: boolean;
  confirmLabel: string;
  error: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
  tone?: Web_Components_ConfirmDialog_Tone;
};

/**
 * Components.
 *
 * @since 2.0.0
 */
export type Web_Components_TotpDialog_Mode = 'disable' | 'recovery' | 'setup';

/**
 * Components.
 *
 * @since 2.0.0
 */
export type Web_Components_TotpDialog_Step = 'codes' | 'password' | 'scan';

/**
 * Components.
 *
 * @since 2.0.0
 */
export type Web_Components_TotpDialog_Props = {
  mode: Web_Components_TotpDialog_Mode | null;
  onAuthenticatorEnabled: () => void;
  onChanged: () => Promise<void>;
  onClose: () => void;
};

/**
 * Components - App Shell phone sheet.
 *
 * @since 2.0.0
 */
export type Web_Components_AppShell_PhoneSheet = {
  content: ReactNode;
  id: string;
  onClose: () => void;
  title: string;
};

/**
 * Components.
 *
 * @since 2.0.0
 */
export type Web_Components_AppShell_Props = {
  accountDetail?: ReactNode;
  activeView: Web_Components_View;
  canOpen?: (permission: string) => boolean;
  children: ReactNode;
  notice: ReactNode;
  onLogout: () => void;
  onViewChange: (view: Web_Components_View) => void;
  phonePageTop?: ReactNode;
  phoneSheet?: Web_Components_AppShell_PhoneSheet | undefined;
  sidebarNavigationSlot?: ReactNode;
  sidebarTop?: ReactNode;
  status?: Web_Components_ShellStatus;
  username: string;
};
export type Web_Components_ConnectionTone = 'blocked' | 'connecting' | 'idle' | 'partial' | 'protected';
export type Web_Components_ConnectionStatus = {
  detail: string;
  label: string;
  tone: Web_Components_ConnectionTone;
};
export type Web_Components_ShellStatus = Web_Components_ConnectionStatus & {
  onOpen: () => void;
};
export type Web_Components_ProtectionTone = 'protected' | 'partial' | 'connecting' | 'blocked';
export type Web_Components_Protection = {
  detail: string;
  label: string;
  tone: Web_Components_ProtectionTone;
};
export type Web_Components_AccountMenu_Props = {
  detail?: ReactNode;
  onLogout: () => void;
  onViewChange: (view: Web_Components_View) => void;
  username: string;
};
/**
 * Components.
 *
 * @since 2.0.0
 */
export type Web_Components_AuthenticationScreen_Mode = 'claim' | 'login';
export type Web_Components_AuthenticationScreen_Props = {
  mode: Web_Components_AuthenticationScreen_Mode;
  onSignedIn: () => Promise<void>;
};

/**
 * Components.
 *
 * @since 2.0.0
 */
export type Web_Components_TorrentWorkspace_Props = {
  connections: Web_Api_VpnConnection[];
  defaultProfile: Web_Api_DefaultTorrentProfile;
  errors: string[];
  filters: Web_Components_TorrentFilters;
  filtersOpen: boolean;
  onAction: (action: Web_Api_TorrentAction, hashes: string[]) => Promise<void>;
  onAddTorrent: () => void;
  onFiltersChange: (filters: Web_Components_TorrentFilters) => void;
  onOpenFilters: () => void;
  onRemove: (hashes: string[], deleteLocalData: boolean) => Promise<void>;
  onFixProfileFolder: (profileId: string) => void;
  onSelectTorrent: (torrent: Web_Api_Torrent) => void;
  onSetProfile: (input: Web_Api_SetTorrentProfileInput) => Promise<Web_Api_SetTorrentProfileResponse>;
  profileFolderOverlaps: Web_Api_TorrentProfileFolderOverlap[];
  profiles: Web_Api_TorrentProfile[];
  selectedTorrentId: number | null;
  statistics?: Web_Api_Statistics | undefined;
  torrents: Web_Api_Torrent[];
};
export type Web_Components_TorrentFilter =
  | 'all'
  | 'active'
  | 'checking'
  | 'downloading'
  | 'seeding'
  | 'paused'
  | 'needs-profile'
  | 'error'
  | 'warning';
export type Web_Components_TorrentFilters = {
  connection: string;
  label: string;
  profile: string;
  status: Web_Components_TorrentFilter;
};
export type Web_Components_LibraryNavigation_Props = {
  defaultProfile: Web_Api_DefaultTorrentProfile;
  filters: Web_Components_TorrentFilters;
  onCreateProfile: () => void;
  onDeleteProfile: (profile: Web_Api_TorrentProfile) => void;
  onEditDefaultProfile: () => void;
  onEditProfile: (profile: Web_Api_TorrentProfile) => void;
  onFiltersChange: (filters: Web_Components_TorrentFilters) => void;
  onManage: () => void;
  onSheetClose?: (() => void) | undefined;
  organization: Web_Api_TorrentOrganization | null;
  profiles: Web_Api_TorrentProfile[];
  torrents: Web_Api_Torrent[];
};
export type Web_Components_TorrentFilterItem = {
  icon: Web_Components_Icon_Name;
  id: Web_Components_TorrentFilter;
  label: string;
};
export type Web_Components_TorrentLibrarySelection =
  | {
    kind: 'status';
    value: Web_Components_TorrentFilter;
  }
  | {
    kind: 'label';
    value: string;
  }
  | {
    kind: 'profile';
    value: string | null;
  }
  | {
    kind: 'connection';
    value: string;
  };
export type Web_Components_TorrentLabelSummary = {
  count: number;
  label: string;
  saved: boolean;
  size: number;
};
export type Web_Components_TorrentStateTone = 'downloading' | 'seeding' | 'paused' | 'queued' | 'checking' | 'error';
export type Web_Components_TorrentState = {
  label: string;
  tone: Web_Components_TorrentStateTone;
};
export type Web_Components_TrackerIssue = {
  label: string;
  reply: string;
};
export type Web_Components_TorrentSortKey =
  | 'queuePosition'
  | 'name'
  | 'sizeWhenDone'
  | 'percentDone'
  | 'rateDownload'
  | 'rateUpload'
  | 'uploadRatio'
  | 'eta'
  | 'peersConnected';
export type Web_Components_TorrentSortDirection = 'ascending' | 'descending';
export type Web_Components_TorrentSort = {
  direction: Web_Components_TorrentSortDirection;
  key: Web_Components_TorrentSortKey;
};
export type Web_Components_TorrentPageSize = 25 | 50 | 100;
export type Web_Components_TorrentContextMenu = {
  torrentIds: number[];
  x: number;
  y: number;
};
export type Web_Components_TorrentProfileChangeDialog_Props = {
  connections: Web_Api_VpnConnection[];
  defaultProfile: Web_Api_DefaultTorrentProfile;
  hashes: string[];
  onClose: () => void;
  onSetProfile: (input: Web_Api_SetTorrentProfileInput) => Promise<Web_Api_SetTorrentProfileResponse>;
  profiles: Web_Api_TorrentProfile[];
  torrents: Web_Api_Torrent[];
};
export type Web_Components_TorrentSortHeader_Props = {
  activeSort: Web_Components_TorrentSort;
  label: string;
  onSort: (key: Web_Components_TorrentSortKey) => void;
  sortKey: Web_Components_TorrentSortKey;
};

/**
 * Components.
 *
 * @since 2.0.0
 */
export type Web_Components_TorrentDetail_Props = {
  connections: Web_Api_VpnConnection[];
  defaultProfile: Web_Api_DefaultTorrentProfile;
  detail: Web_Api_TorrentDetail | null;
  labelPresets: string[];
  loading: boolean;
  onAction: (action: Web_Api_TorrentAction, hashes: string[]) => Promise<void>;
  onClose: () => void;
  onRefresh: (torrentId: number) => Promise<void>;
  onRename: (input: Web_Api_RenameTorrentPathInput) => Promise<void>;
  onSetProfile: (input: Web_Api_SetTorrentProfileInput) => Promise<Web_Api_SetTorrentProfileResponse>;
  onUpdate: (hashes: string[], changes: Web_Api_TorrentChanges) => Promise<void>;
  profiles: Web_Api_TorrentProfile[];
};
export type Web_Components_TorrentDetail_Tab = 'overview' | 'files' | 'peers' | 'trackers' | 'options';
export type Web_Components_TorrentFileDraft = {
  priority: -1 | 0 | 1;
  wanted: boolean;
};
export type Web_Components_TorrentFileDrafts = Record<number, Web_Components_TorrentFileDraft>;
export type Web_Components_TorrentFileRow = {
  file: Web_Api_TorrentFile;
  index: number;
};
export type Web_Components_TorrentOptionsDraft = {
  bandwidthPriority: -1 | 0 | 1;
  downloadLimit: number;
  downloadLimited: boolean;
  honorsSessionLimits: boolean;
  labels: string;
  peerLimit: number;
  seedIdleLimit: number;
  seedIdleMode: 0 | 1 | 2;
  seedRatioLimit: number;
  seedRatioMode: 0 | 1 | 2;
  uploadLimit: number;
  uploadLimited: boolean;
};

/**
 * Components.
 *
 * @since 2.0.0
 */
export type Web_Components_AddTorrentDialog_Props = {
  connections: Web_Api_VpnConnection[];
  defaultProfile: Web_Api_DefaultTorrentProfile;
  labelPresets: string[];
  open: boolean;
  onAdd: (input: Web_Api_AddTorrentInput) => Promise<Web_Api_TorrentAddResult>;
  onClose: () => void;
  onOpenVPN: () => void;
  profiles: Web_Api_TorrentProfile[];
  torrents: Web_Api_Torrent[];
};
export type Web_Components_AddTorrentSource = {
  alreadyAdded: boolean;
  checking: boolean;
  displayName: string;
  file?: File | undefined;
  hash: string | null;
  key: string;
  kind: 'file' | 'link';
  link?: string | undefined;
  matchedProfileIds: string[];
  name: string;
  size: number | null;
};
export type Web_Components_AddTorrentResult = {
  detail: string;
  requiresVPNConnection?: boolean | undefined;
  status: 'added' | 'duplicate' | 'failed';
};

/**
 * Components.
 *
 * @since 2.0.0
 */
export type Web_Components_DirectoryBrowserDialog_Props = {
  initialPath: string;
  onClose: () => void;
  onSelect: (path: string) => void;
  open: boolean;
  profileId?: string | undefined;
  purpose?: Web_Api_DirectoryPurpose | undefined;
};
export type Web_Components_DirectoryBrowserDialog_Directory = Web_Api_Directory;
export type Web_Components_DirectoryBrowserDialog_Levels = Record<string, Web_Api_Directory>;
export type Web_Components_DirectoryBrowserDialog_Errors = Record<string, string>;
export type Web_Components_DirectoryBrowserDialog_VisibleItem = {
  depth: number;
  entry: Web_Api_DirectoryEntry;
  parentPath: string;
};
export type Web_Components_LabelPicker_Props = {
  labels: string[];
  onChange: (value: string) => void;
  title: string;
  value: string;
};
export type Web_Components_TorrentOrganizationDialog_Props = {
  labels: string[];
  onClose: () => void;
  onSave: (input: Web_Api_UpdateTorrentOrganizationInput) => Promise<void>;
  open: boolean;
  organization: Web_Api_TorrentOrganization | null;
};
export type Web_Components_TorrentOrganizationLabelDraft = {
  id: string;
  original: string | null;
  value: string;
};
export type Web_Components_TorrentProfileDialog_Mode = 'create' | 'default' | 'edit';
export type Web_Components_TorrentProfileDialog_Props = {
  connections: Web_Api_VpnConnection[];
  defaultProfile: Web_Api_DefaultTorrentProfile;
  labelPresets: string[];
  mode: Web_Components_TorrentProfileDialog_Mode;
  onClose: () => void;
  onSave: (
    input: Web_Api_TorrentProfileInput | Web_Api_DefaultTorrentProfileInput,
    moveTorrents?: boolean,
  ) => Promise<Web_Api_MovedTorrent[]>;
  open: boolean;
  profile: Web_Api_TorrentProfile | null;
  profiles: Web_Api_TorrentProfile[];
};

/**
 * Components - VPN navigation target.
 *
 * Distinguishes ordinary VPN page navigation from setup actions that should
 * open the new-connection form when capacity remains available.
 *
 * @since 2.0.0
 */
export type Web_Components_VpnView_NavigationTarget =
  | {
    kind: 'connection';
    connectionID: string;
  }
  | {
    kind: 'list';
  }
  | {
    kind: 'new';
  };

/**
 * Components.
 *
 * @since 2.0.0
 */
export type Web_Components_VpnView_Props = {
  connections: Web_Api_VpnConnectionsResponse | null;
  defaultProfile: Web_Api_DefaultTorrentProfile;
  navigationSequence: number;
  navigationTarget: Web_Components_VpnView_NavigationTarget;
  onCreate: (input: Web_Api_CreateVpnConnectionInput) => Promise<void>;
  onDelete: (connectionId: string, input: Web_Api_DeleteVpnConnectionInput) => Promise<Web_Api_DeleteVpnConnectionResponse>;
  onDisconnect: (connectionId: string) => Promise<void>;
  onMakeDefault: (connectionId: string, moveTorrents?: boolean) => Promise<Web_Api_MovedTorrent[]>;
  onNavigate: (target: Web_Components_VpnView_NavigationTarget, replace?: boolean) => void;
  onOpenTorrents: (connectionId: string) => void;
  onReconnect: (connectionId: string) => Promise<void>;
  onRefreshCatalog: (providerId: string, tunnel: Web_Api_VpnTunnel) => Promise<void>;
  onUpdate: (connectionId: string, input: Web_Api_UpdateVpnConnectionInput) => Promise<void>;
  onUploadProfile: (tunnel: Web_Api_VpnTunnel, name: string, profile: string) => Promise<Web_Api_VpnProfile[]>;
  profiles: Web_Api_VpnProfile[];
  providers: Web_Api_Provider[];
  snapshot: Web_Api_LiveSnapshot | null;
};

/**
 * Components.
 *
 * @since 2.0.0
 */
export type Web_Components_SettingsView_Props = {
  onDirtyChange: (dirty: boolean) => void;
  onRestartTransmission: () => Promise<void>;
  onSave: (changes: Record<string, Web_Api_JsonValue>) => Promise<void>;
  snapshot: Web_Api_SettingsSnapshot | null;
};
export type Web_Components_SettingsView_Drafts = Record<string, Web_Api_JsonValue>;
export type Web_Components_SettingsView_Groups = Record<string, Web_Api_Setting[]>;
export type Web_Components_SettingsDirectoryField_Props = {
  disabled: boolean;
  onChange: (value: string) => void;
  purpose: Web_Api_DirectoryPurpose;
  title: string;
  value: string;
};
export type Web_Components_SettingsListEditor_Props = {
  blocklistStatus: Web_Api_BlocklistStatus | null;
  blocklistsEnabled: boolean;
  disabled: boolean;
  editorVersion: number;
  onChange: (values: string[]) => void;
  settingKey: string;
  title: string;
  values: string[];
};

/**
 * Components.
 *
 * @since 2.0.0
 */
export type Web_Components_AccessView_Props = {
  connections: Web_Api_VpnConnection[];
  onCreateRPCLogin: (username: string) => Promise<Web_Api_RPCCredential>;
  onCreateToken: (input: Web_Api_CreateTokenInput) => Promise<Web_Api_CreatedToken>;
  onCreateWebProxyLogin: (input: Web_Api_WebProxyLoginInput) => Promise<Web_Api_WebProxyCredential>;
  onDeleteRPCLogin: (loginId: string) => Promise<void>;
  onDeleteWebProxyLogin: (loginId: string) => Promise<void>;
  onOpenVPN: () => void;
  onRefreshWebProxy: () => Promise<Web_Api_WebProxy>;
  onRevokeToken: (tokenId: string) => Promise<void>;
  onToggleRPC: (enabled: boolean) => Promise<void>;
  onToggleWebProxy: (enabled: boolean) => Promise<Web_Api_WebProxy>;
  onUpdateRPCLogin: (loginId: string, input: Web_Api_UpdateRPCLoginInput) => Promise<Web_Api_RPCCredential>;
  onUpdateToken: (tokenId: string, input: Web_Api_UpdateTokenInput) => Promise<void>;
  onUpdateWebProxyLogin: (loginId: string, input: Web_Api_UpdateWebProxyLoginInput) => Promise<Web_Api_WebProxyCredential>;
  rpcEnabled: boolean;
  rpcLogins: Web_Api_RPCLogin[];
  tokens: Web_Api_Token[];
  webProxy: Web_Api_WebProxy | null;
};
export type Web_Components_AccessView_Credential = Web_Api_RPCCredential | Web_Api_WebProxyCredential;
export type Web_Components_AccessView_LoginDialog = 'rpc-add' | 'rpc-edit' | 'web-add' | 'web-edit';
export type Web_Components_AccessView_DeletingLogin = {
  id: string;
  kind: 'rpc' | 'web';
  username: string;
};
export type Web_Components_AccessView_EditingLogin = Web_Api_RPCLogin | Web_Api_WebProxyLogin | null;

/**
 * Components.
 *
 * @since 2.0.0
 */
export type Web_Components_TokenDialog_Expiry = '30' | '90' | '365' | 'keep' | 'never';
export type Web_Components_TokenDialog_Props = {
  allowedScopes?: Web_Api_Scope[];
  onClose: () => void;
  onCreate: (input: Web_Api_CreateTokenInput) => Promise<Web_Api_CreatedToken>;
  onUpdate: (tokenId: string, input: Web_Api_UpdateTokenInput) => Promise<void>;
  open: boolean;
  token: Web_Api_Token | null;
};

/**
 * Components.
 *
 * @since 2.0.0
 */
export type Web_Components_ScopeOption = {
  description: string;
  endpoints?: string[];
  id: Web_Api_Scope;
  includes?: Web_Api_Scope;
};

/**
 * Components.
 *
 * @since 2.0.0
 */
export type Web_Components_SecurityView_ErrorContext = 'page' | 'passkey' | 'password' | 'prompt' | 'username';

/**
 * Components.
 *
 * @since 2.0.0
 */
export type Web_Components_SecurityView_Props = {
  onAuthenticatorEnabled: () => void;
  onUsernameChanged: (username: string) => void;
};

/**
 * Components.
 *
 * @since 2.0.0
 */
export type Web_Components_KeyNotice_Item = {
  id: string;
  label: string;
  onOpen: () => void;
};
export type Web_Components_KeyNotice_Props = {
  appName: string;
  items: Web_Components_KeyNotice_Item[];
  keyName: string;
  onDismiss: () => Promise<void>;
  removedAt: string;
};
