import type {
  IncomingMessage,
  ServerResponse,
} from 'node:http';

import type { Plugin } from 'vite';

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MockNotificationService = 'apprise' | 'discord' | 'email' | 'gotify' | 'matrix' | 'ntfy' | 'ntfy-reverse-proxy' | 'pushover' | 'slack' | 'telegram' | 'webhook';

export type MockApi_MockNotification = {
  createdAt: string;
  events: string[];
  id: string;
  lastAttemptAt: string | null;
  lastError: string | null;
  lastErrorDetails: string | null;
  name: string;
  secrets: Record<string, true>;
  secretsMissing: string[];
  service: MockApi_MockNotificationService;
  settings: Record<string, string>;
  updatedAt: string;
};

// MockApi_MockNotificationField is one service field: [key, message when missing, secret, required].
export type MockApi_MockNotificationField = [string, string, boolean, boolean];

// MockApi_MockNotificationInput is a checked create or edit body, with the optional secrets to clear.
export type MockApi_MockNotificationInput = Pick<MockApi_MockNotification, 'events' | 'name' | 'secrets' | 'service' | 'settings'> & {
  clearSecrets: string[];
};

export type MockApi_MockRPCLogin = {
  createdAt: string;
  id: string;
  lastUsedAt: string | null;
  username: string;
};

export type MockApi_MockBlocklistSourceStatus = {
  copyFrom?: string;
  error?: string;
  ranges: number;
  state: 'error' | 'ok' | 'pending';
  updatedAt?: string;
  url: string;
};

export type MockApi_MockBlocklistStatus = {
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  nextUpdateAt?: string;
  sources: MockApi_MockBlocklistSourceStatus[];
  state: 'disabled' | 'idle' | 'no-sources' | 'updating' | 'waiting-for-vpn';
  totalRanges: number;
};

export type MockApi_MockWebProxyLogin = {
  connectionId: string | null;
  id: string;
  passwordSet: boolean;
  username: string;
};

export type MockApi_MockBackupImportSourceItem = {
  complete: boolean;
  duplicate: boolean;
  folder: string;
  hash: string;
  missing: boolean;
  name: string;
  paused: boolean;
  profileName: string;
};

export type MockApi_MockBackupImport = {
  actions: string[];
  createdAt: string;
  id: string;
  items: MockApi_MockBackupImportSourceItem[];
  profileCount: number;
  settingCount: number;
  source: 'another-transmission' | 'transmission-vpn-export';
  startedAtMilliseconds: number;
  totalSizeBytes: number;
};

export type MockApi_MockBackupMergeResult = {
  apiTokenAdditions: number;
  apiTokenDuplicateSkips: number;
  apiTokenMaximumSkips: number;
  notificationAdditions: number;
  notificationMaximumSkips: number;
  notificationReplacements: number;
  rpcLoginAdditions: number;
  rpcLoginMaximumSkips: number;
  rpcLoginReplacements: number;
};

export type MockApi_MockVPNConnection = {
  changeRunning: boolean;
  createdAt: string;
  daemon: {
    bindAddress: string;
    peerPort: number;
    rpcPort: number;
    state: 'exited' | 'missing' | 'ready' | 'starting';
  };
  default: boolean;
  dnsServers: string[];
  enabled: boolean;
  endpointStrategy: 'ordered' | 'randomized' | 'sticky';
  id: string;
  name: string;
  needsSetup: boolean;
  peerPort: number;
  profileIds: string[];
  providerId: string;
  revision: number;
  retryIntervalSeconds: number;
  savedCredentials: string[];
  runtime: Record<string, unknown>;
  slot: number;
  tunnel: 'openvpn' | 'wireguard';
  updatedAt: string;
};

export type MockApi_MockVPNCredentialField = {
  key: string;
  label: string;
  required: boolean;
};

export type MockApi_MockTorrent = {
  'activityDate': number;
  'addedDate': number;
  'bandwidthPriority': -1 | 0 | 1;
  'comment': string;
  'connectionId': string;
  'doneDate': number;
  'downloadDir': string;
  'downloadLimit': number;
  'downloadLimited': boolean;
  'downloadedEver': number;
  'error': number;
  'errorString': string;
  'eta': number;
  'hashString': string;
  'honorsSessionLimits': boolean;
  'id': number;
  'isFinished': boolean;
  'isPrivate': boolean;
  'isStalled': boolean;
  'labels': string[];
  'leftUntilDone': number;
  'metadataPercentComplete': number;
  'name': string;
  'needsProfile': {
    profileIds: string[];
  } | null;
  'peersConnected': number;
  'peersGettingFromUs': number;
  'peersSendingToUs': number;
  'percentDone': number;
  'peer-limit': number;
  'profileId': string | null;
  'queuePosition': number;
  'rateDownload': number;
  'rateUpload': number;
  'recheckProgress': number;
  'secondsDownloading': number;
  'secondsSeeding': number;
  'seedIdleLimit': number;
  'seedIdleMode': 0 | 1 | 2;
  'seedRatioLimit': number;
  'seedRatioMode': 0 | 1 | 2;
  'sizeWhenDone': number;
  'status': number;
  'totalSize': number;
  'uploadedEver': number;
  'uploadLimit': number;
  'uploadLimited': boolean;
  'uploadRatio': number;
};

export type MockApi_MockTorrentProfile = {
  connectionId: string | null;
  createdAt: string;
  downloadDirectory: string;
  id: string;
  labels: string[];
  matchPatterns: string[];
  name: string;
  overlaps: {
    ownPattern: string;
    pattern: string;
    profileId: string;
    profileName: string;
  }[];
  options: {
    bandwidthPriority: -1 | 0 | 1;
    downloadLimitKBps: number | null;
    peerLimit: number;
    queue: 'normal' | 'top';
    seeding: {
      idleMinutes: number | null;
      mode: 'limit' | 'never';
      ratio: number | null;
    };
    uploadLimitKBps: number | null;
  };
  startPaused: boolean;
  updatedAt: string;
};

export type MockApi_MockDefaultTorrentProfile = Pick<MockApi_MockTorrentProfile, 'downloadDirectory' | 'labels' | 'name' | 'options' | 'startPaused'> & {
  downloadDirectoryLocked: boolean;
};

export type MockApi_MockDirectoryMetadata = {
  files: number;
  mountPoint: boolean;
  readable: boolean;
};

export type MockApi_MockDirectoryPurpose = 'download' | 'incomplete' | 'profile';

export type MockApi_MockDirectoryDeletionPolicy = {
  code: 'directory_browser_unavailable' | 'directory_in_use' | 'directory_not_empty' | 'torrent_locations_unavailable' | '';
  message: string;
};

export type MockApi_MockTorrentLinkPreview = {
  hash: string;
  index: number;
  name: string;
  totalSize?: number;
};

export type MockApi_MockTorrentSeed = {
  comment?: string;
  dir: string;
  error?: string;
  labels: string[];
  name: string;
  percent: number;
  privateTracker?: boolean;
  size: number;
  status: number;
};

export type MockApi_MockZipFile = {
  content: Buffer;
  name: string;
};

export type MockApi_MockContentDownload = {
  content: Buffer;
  fileName: string;
};

export type MockApi_MockTorrentSelection = {
  field: 'hashes' | 'ids';
  hashes: string[];
  ids: number[];
  items: MockApi_MockTorrent[];
};

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_Gibibyte = number;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_DownloadDataPathRootMessage = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_IsDownloadDataRoot_Value = unknown;

export type MockApi_IsDownloadDataRoot_Returns = boolean;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_DataPathContains_ParentPath = string;

export type MockApi_DataPathContains_CandidatePath = string;

export type MockApi_DataPathContains_Returns = boolean;

export type MockApi_DataPathContains_Parent = string;

export type MockApi_DataPathContains_Candidate = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_DataPathContainsIgnoringCase_ParentPath = string;

export type MockApi_DataPathContainsIgnoringCase_CandidatePath = string;

export type MockApi_DataPathContainsIgnoringCase_Returns = boolean;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_DataPathsEqualIgnoringCase_FirstPath = string;

export type MockApi_DataPathsEqualIgnoringCase_SecondPath = string;

export type MockApi_DataPathsEqualIgnoringCase_Returns = boolean;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_DuplicateTorrentEnabled = boolean;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_NoVPNConnections = boolean;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_TorrentAddOutcome = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_TorrentAddAttempt = number;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_NotificationTransportError = boolean;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_RawNotificationTransportError = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MockVPNTestFailureMessage = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MockNotificationTransportFailure_Raw = string;

export type MockApi_MockNotificationTransportFailure_Returns = string;

export type MockApi_MockNotificationTransportFailure_LookupMatch = RegExpMatchArray | null;

export type MockApi_MockNotificationTransportFailure_LookupHost = string | undefined;

export type MockApi_MockNotificationTransportFailure_TransportMatch = RegExpMatchArray | null;

export type MockApi_MockNotificationTransportFailure_TransportHost = string | undefined;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_NorthwindConnectionId = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_FabrikamConnectionId = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_ContosoConnectionId = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_ConnectionBeingRemovedId = string | null;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_TorrentMoveWarnings = string[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MissingWebProxyConnectionId = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_TorrentSeeds = MockApi_MockTorrentSeed[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_CreateTorrents_Returns = MockApi_MockTorrent[];

export type MockApi_CreateTorrents_Torrent = MockApi_MockTorrent;

export type MockApi_CreateTorrents_Now = number;

export type MockApi_CreateTorrents_Downloaded = number;

export type MockApi_CreateTorrents_Uploaded = number;

export type MockApi_CreateTorrents_AddedDate = number;

export type MockApi_CreateTorrents_SecondsDownloading = number;

export type MockApi_CreateTorrents_DoneDate = number;

export type MockApi_CreateTorrents_ConnectionId = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MockPieces_Torrent = MockApi_MockTorrent;

export type MockApi_MockPieces_Returns = Record<string, unknown>;

export type MockApi_MockPieces_PieceSize = number;

export type MockApi_MockPieces_PieceCount = number;

export type MockApi_MockPieces_Target = number;

export type MockApi_MockPieces_Have = boolean[];

export type MockApi_MockPieces_Seed = number;

export type MockApi_MockPieces_Filled = number;

export type MockApi_MockPieces_Random_Returns = number;

export type MockApi_MockPieces_Random = () => MockApi_MockPieces_Random_Returns;

export type MockApi_MockPieces_Start = number;

export type MockApi_MockPieces_End = number;

export type MockApi_MockPieces_Bytes = number[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_TorrentProfiles = MockApi_MockTorrentProfile[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_TorrentPatternsOverlap_LeftPattern = string;

export type MockApi_TorrentPatternsOverlap_RightPattern = string;

export type MockApi_TorrentPatternsOverlap_Returns = boolean;

export type MockApi_TorrentPatternsOverlap_LeftCharacters = string[];

export type MockApi_TorrentPatternsOverlap_RightCharacters = string[];

export type MockApi_TorrentPatternsOverlap_Queue = [number, number][];

export type MockApi_TorrentPatternsOverlap_Visited = Set<string>;

export type MockApi_TorrentPatternsOverlap_State = [number, number] | undefined;

export type MockApi_TorrentPatternsOverlap_LeftIndex = number;

export type MockApi_TorrentPatternsOverlap_RightIndex = number;

export type MockApi_TorrentPatternsOverlap_StateKey = string;

export type MockApi_TorrentPatternsOverlap_LeftCharacter = string | undefined;

export type MockApi_TorrentPatternsOverlap_RightCharacter = string | undefined;

export type MockApi_TorrentPatternsOverlap_LeftStar = boolean;

export type MockApi_TorrentPatternsOverlap_RightStar = boolean;

export type MockApi_TorrentPatternsOverlap_NextState = [number, number];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_RefreshTorrentProfilePresentation_Returns = void;

export type MockApi_RefreshTorrentProfilePresentation_Overlaps = MockApi_MockTorrentProfile['overlaps'];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_DefaultTorrentProfile = MockApi_MockDefaultTorrentProfile;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_ProfileFolderOwner_DirectoryPath = string;

export type MockApi_ProfileFolderOwner_ExcludedProfileID = string;

export type MockApi_ProfileFolderOwner_Returns = MockApi_ProfileFolderOwner_Owner | undefined;

export type MockApi_ProfileFolderOwner_Relation = 'contains' | 'inside' | 'same';

export type MockApi_ProfileFolderOwner_Owner = {
  id: string;
  name: string;
  relation: MockApi_ProfileFolderOwner_Relation;
};

export type MockApi_ProfileFolderOwner_RelationTo_OwnerPath = string;

export type MockApi_ProfileFolderOwner_RelationTo_Returns = MockApi_ProfileFolderOwner_Relation | undefined;

export type MockApi_ProfileFolderOwner_RelationTo = (ownerPath: MockApi_ProfileFolderOwner_RelationTo_OwnerPath) => MockApi_ProfileFolderOwner_RelationTo_Returns;

export type MockApi_ProfileFolderOwner_DefaultRelation = MockApi_ProfileFolderOwner_RelationTo_Returns;

export type MockApi_ProfileFolderOwner_RelationValue = MockApi_ProfileFolderOwner_RelationTo_Returns;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_ProfileFolderTakenMessage_DirectoryPath = string;

export type MockApi_ProfileFolderTakenMessage_OwnerName = string;

export type MockApi_ProfileFolderTakenMessage_Relation = 'contains' | 'inside' | 'same';

export type MockApi_ProfileFolderTakenMessage_Returns = string;

export type MockApi_ProfileFolderTakenMessage_FolderName = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_ProfileFolderOverlaps_Returns = MockApi_ProfileFolderOverlaps_Overlaps;

export type MockApi_ProfileFolderOverlaps_Overlap = {
  message: string;
  profileId: string;
  profileName: string;
};

export type MockApi_ProfileFolderOverlaps_Overlaps = MockApi_ProfileFolderOverlaps_Overlap[];

export type MockApi_ProfileFolderOverlaps_DefaultOwner = MockApi_ProfileFolderOwner_Returns;

export type MockApi_ProfileFolderOverlaps_Owner = MockApi_ProfileFolderOwner_Returns;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_TorrentProfileNameTaken_Name = string;

export type MockApi_TorrentProfileNameTaken_ExcludedProfileID = string;

export type MockApi_TorrentProfileNameTaken_Returns = boolean;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_DefaultTorrentProfileResponse_Returns = MockApi_MockDefaultTorrentProfile;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_TorrentProfileSequence = number;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_ApplyTorrentProfileSeeding_Torrent = MockApi_MockTorrent;

export type MockApi_ApplyTorrentProfileSeeding_Profile = MockApi_MockDefaultTorrentProfile | MockApi_MockTorrentProfile;

export type MockApi_ApplyTorrentProfileSeeding_Returns = void;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MergeTorrentLabels_Existing = string[];

export type MockApi_MergeTorrentLabels_ProfileLabels = string[];

export type MockApi_MergeTorrentLabels_Returns = string[];

export type MockApi_MergeTorrentLabels_Merged = string[];

export type MockApi_MergeTorrentLabels_Seen = Set<string>;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_ApplyTorrentProfileOptions_Torrent = MockApi_MockTorrent;

export type MockApi_ApplyTorrentProfileOptions_Profile = MockApi_MockDefaultTorrentProfile | MockApi_MockTorrentProfile;

export type MockApi_ApplyTorrentProfileOptions_Returns = void;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_Torrents = MockApi_MockTorrent[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_Profile = MockApi_MockTorrentProfile | undefined;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_NeedsProfileTorrent = MockApi_MockTorrent | undefined;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MoveTorrentsToQueueTop_SelectedTorrents = MockApi_MockTorrent[];

export type MockApi_MoveTorrentsToQueueTop_Returns = void;

export type MockApi_MoveTorrentsToQueueTop_SelectedIDs = Set<number>;

export type MockApi_MoveTorrentsToQueueTop_OrderedTorrents = MockApi_MockTorrent[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_Sequence = number;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_SignedIn = boolean;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_SetupRequired = boolean;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_SetupStartedAt = number;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_KeyReplaced = boolean;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_RemovedSecrets_RemovedSecret = {
  kind: 'authenticator' | 'notification' | 'vpn';
  name?: string;
  notificationId?: string;
  removedAt: string;
};

export type MockApi_RemovedSecrets = MockApi_RemovedSecrets_RemovedSecret[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_NotificationFields = Record<MockApi_MockNotificationService, MockApi_MockNotificationField[]>;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_NotificationEvents_NotificationEvent = {
  defaultEnabled: boolean;
  description: string;
  key: string;
  label: string;
};

export type MockApi_NotificationEvents = MockApi_NotificationEvents_NotificationEvent[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_NotificationsStartedAt = number;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_NotificationMinute = number;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_Notifications = MockApi_MockNotification[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_SecretKeys = string[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_PendingPasskeyName = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_Account = {
  password: string;
  passkeys: Record<string, unknown>[];
  recoveryCodes: string[];
  totpEnabled: boolean;
  totpSetupPending: boolean;
  username: string;
};

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_NewRecoveryCodes_Returns = string[];

export type MockApi_NewRecoveryCodes_Alphabet = string;

export type MockApi_NewRecoveryCodes_Code = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_FormatRecoveryCode_Code = string;

export type MockApi_FormatRecoveryCode_Returns = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_ExpandScopes_Scopes = string[];

export type MockApi_ExpandScopes_Returns = string[];

export type MockApi_ExpandScopes_Expanded = Set<string>;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MockQrRows = string[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MockTotpUri = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MockQrCode_Returns = string;

export type MockApi_MockQrCode_Size = number;

export type MockApi_MockQrCode_Path = string;

export type MockApi_MockQrCode_Row = string | undefined;

export type MockApi_MockQrCode_Svg = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_Directories = Map<string, MockApi_MockDirectoryMetadata>;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_SavedLabels = string[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_OrganizationRevision = number;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_SaveUsedLabels_Labels = string[];

export type MockApi_SaveUsedLabels_AdvanceRevision = boolean;

export type MockApi_SaveUsedLabels_Returns = void;

export type MockApi_SaveUsedLabels_SavedKeys = Set<string>;

export type MockApi_SaveUsedLabels_Changed = boolean;

export type MockApi_SaveUsedLabels_Key = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_ApplySavedLabelEdits_Labels = string[];

export type MockApi_ApplySavedLabelEdits_RemovedLabels = string[];

export type MockApi_ApplySavedLabelEdits_RenamedLabel = {
  from: string;
  to: string;
};

export type MockApi_ApplySavedLabelEdits_RenamedLabels = MockApi_ApplySavedLabelEdits_RenamedLabel[];

export type MockApi_ApplySavedLabelEdits_Returns = MockApi_ApplySavedLabelEdits_NextLabels;

export type MockApi_ApplySavedLabelEdits_NextLabels = string[];

export type MockApi_ApplySavedLabelEdits_Rename = MockApi_ApplySavedLabelEdits_RenamedLabel | undefined;

export type MockApi_ApplySavedLabelEdits_NextLabel = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_Settings = Record<string, unknown>[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_EffectiveStringSetting_Key = string;

export type MockApi_EffectiveStringSetting_Returns = string;

export type MockApi_EffectiveStringSetting_MatchedSetting = Record<string, unknown> | undefined;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_EnsureDirectory_DirectoryPath = string;

export type MockApi_EnsureDirectory_Returns = void;

export type MockApi_EnsureDirectory_CurrentPath = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_EnsureConfiguredDirectories_Returns = void;

export type MockApi_EnsureConfiguredDirectories_IncompleteSetting = Record<string, unknown> | undefined;

export type MockApi_EnsureConfiguredDirectories_IncompleteEnabled = boolean;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_DownloadSelection_DirectoryPath = string;

export type MockApi_DownloadSelection_Returns = {
  allowed: boolean;
  reason: string;
};

export type MockApi_DownloadSelection_IncompleteDirectory = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_DirectoryChildren_DirectoryPath = string;

export type MockApi_DirectoryChildren_Returns = string[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_IncompleteSelection_DirectoryPath = string;

export type MockApi_IncompleteSelection_Returns = {
  allowed: boolean;
  reason: string;
};

export type MockApi_IncompleteSelection_Destination = {
  path: string;
  profileName: string;
};

export type MockApi_IncompleteSelection_Clash = MockApi_IncompleteSelection_Destination | undefined;

export type MockApi_IncompleteSelection_ExactFolder = boolean;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_ProfileSelection_DirectoryPath = string;

export type MockApi_ProfileSelection_ProfileID = string;

export type MockApi_ProfileSelection_Returns = {
  allowed: boolean;
  reason: string;
};

export type MockApi_ProfileSelection_DownloadPolicy = MockApi_DownloadSelection_Returns;

export type MockApi_ProfileSelection_Owner = MockApi_ProfileFolderOwner_Returns;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_DirectoryTags_DirectoryPath = string;

export type MockApi_DirectoryTags_Returns = MockApi_DirectoryTags_Tags;

export type MockApi_DirectoryTags_Tags = string[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_DirectoryDeletionPolicy_DirectoryPath = string;

export type MockApi_DirectoryDeletionPolicy_Returns = MockApi_MockDirectoryDeletionPolicy;

export type MockApi_DirectoryDeletionPolicy_FolderName = string;

export type MockApi_DirectoryDeletionPolicy_IncompleteDirectory = string;

export type MockApi_DirectoryDeletionPolicy_ProfileFolder = {
  name: string;
  path: string;
};

export type MockApi_DirectoryDeletionPolicy_AssignedProfile = MockApi_DirectoryDeletionPolicy_ProfileFolder | undefined;

export type MockApi_DirectoryDeletionPolicy_Metadata = MockApi_MockDirectoryMetadata | undefined;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_DirectorySelection_DirectoryPath = string;

export type MockApi_DirectorySelection_Purpose = MockApi_MockDirectoryPurpose;

export type MockApi_DirectorySelection_ProfileID = string;

export type MockApi_DirectorySelection_Returns = {
  allowed: boolean;
  reason: string;
};

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_ListDirectory_DirectoryPath = string;

export type MockApi_ListDirectory_Purpose = MockApi_MockDirectoryPurpose;

export type MockApi_ListDirectory_ProfileID = string;

export type MockApi_ListDirectory_Returns = Record<string, unknown>;

export type MockApi_ListDirectory_Selection = MockApi_DirectorySelection_Returns;

export type MockApi_ListDirectory_Directory = Record<string, unknown>;

export type MockApi_ListDirectory_Metadata = MockApi_MockDirectoryMetadata;

export type MockApi_ListDirectory_ChildDirectories = string[];

export type MockApi_ListDirectory_PurposeSelection = MockApi_DirectorySelection_Returns;

export type MockApi_ListDirectory_DeletionPolicy = MockApi_MockDirectoryDeletionPolicy;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_DownloadFolderIssue_Value = unknown;

export type MockApi_DownloadFolderIssue_Returns = string;

export type MockApi_DownloadFolderIssue_IncompleteDirectory = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_SettingsRevision = number;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_PendingRestartKeys = string[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_BlocklistStatus = MockApi_MockBlocklistStatus;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_Providers = Record<string, unknown>[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_Profiles = Record<string, unknown>[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_Tokens = Record<string, unknown>[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_TokenValues = Map<string, string>;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_TokenDigests = Map<string, string>;

export type MockApi_TokenDigests_Entry = [string, string];

export type MockApi_TokenDigests_TokenID = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_TokenSequence = number;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_RpcLogins = MockApi_MockRPCLogin[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_RpcLoginDigests = Map<string, string>;

export type MockApi_RpcLoginDigests_Entry = [string, string];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_RpcLoginSequence = number;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_WebProxyLogins = MockApi_MockWebProxyLogin[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_WebProxyEnabled = boolean;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_WebProxyRuntimeEnabled = boolean;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_WebProxyTransitionSequence = number;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_WebProxyLoginSequence = number;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_VpnChangeRunning = boolean;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_VpnCapacitySource = 'cgroup-v2' | 'fallback';

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_VpnConnections = MockApi_MockVPNConnection[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_VpnCredentialValues = Map<string, Record<string, string>>;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MockVPNCredentialFields_ProviderId = string;

export type MockApi_MockVPNCredentialFields_Tunnel = 'openvpn' | 'wireguard';

export type MockApi_MockVPNCredentialFields_Returns = MockApi_MockVPNCredentialField[];

export type MockApi_MockVPNCredentialFields_ProviderDefinition = Record<string, unknown> | undefined;

export type MockApi_MockVPNCredentialFields_TunnelDefinitions = Record<string, unknown>[];

export type MockApi_MockVPNCredentialFields_TunnelDefinition = Record<string, unknown> | undefined;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_SubmittedMockVPNCredentials_Value = unknown;

export type MockApi_SubmittedMockVPNCredentials_Returns = MockApi_SubmittedMockVPNCredentials_Credentials;

export type MockApi_SubmittedMockVPNCredentials_Credentials = Record<string, string>;

export type MockApi_SubmittedMockVPNCredentials_Key = string;

export type MockApi_SubmittedMockVPNCredentials_CredentialValue = unknown;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MergedMockVPNCredentials_Connection = MockApi_MockVPNConnection;

export type MockApi_MergedMockVPNCredentials_ProviderId = string;

export type MockApi_MergedMockVPNCredentials_Tunnel = 'openvpn' | 'wireguard';

export type MockApi_MergedMockVPNCredentials_SubmittedCredentials = Record<string, string>;

export type MockApi_MergedMockVPNCredentials_Returns = MockApi_MergedMockVPNCredentials_Credentials;

export type MockApi_MergedMockVPNCredentials_SavedCredentials = Record<string, string>;

export type MockApi_MergedMockVPNCredentials_Credentials = Record<string, string>;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_SavedMockVPNCredentialKeys_ProviderId = string;

export type MockApi_SavedMockVPNCredentialKeys_Tunnel = 'openvpn' | 'wireguard';

export type MockApi_SavedMockVPNCredentialKeys_Credentials = Record<string, string>;

export type MockApi_SavedMockVPNCredentialKeys_Returns = string[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MissingMockVPNCredential_ProviderId = string;

export type MockApi_MissingMockVPNCredential_Tunnel = 'openvpn' | 'wireguard';

export type MockApi_MissingMockVPNCredential_Credentials = Record<string, string>;

export type MockApi_MissingMockVPNCredential_Returns = MockApi_MockVPNCredentialField | undefined;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_SendJSON_Response = ServerResponse;

export type MockApi_SendJSON_Status = number;

export type MockApi_SendJSON_Body = unknown;

export type MockApi_SendJSON_Returns = void;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_SendMockVPNCredentialError_Response = ServerResponse;

export type MockApi_SendMockVPNCredentialError_Prefix = string;

export type MockApi_SendMockVPNCredentialError_Field = MockApi_MockVPNCredentialField;

export type MockApi_SendMockVPNCredentialError_Returns = void;

export type MockApi_SendMockVPNCredentialError_FieldName = string;

export type MockApi_SendMockVPNCredentialError_Message = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_VpnConnectionSequence = number;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_TokenScopes = string[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_Tick_Returns = void;

export type MockApi_Tick_Downloading = boolean;

export type MockApi_Tick_Seeding = boolean;

export type MockApi_Tick_Step = number;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_TorrentSummaryFields = (keyof MockApi_MockTorrent)[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_TorrentSummary_Torrent = MockApi_MockTorrent;

export type MockApi_TorrentSummary_Returns = Record<string, unknown>;

export type MockApi_TorrentSummary_Entry = [string, MockApi_MockTorrent[keyof MockApi_MockTorrent]];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_PreviewTorrentLink_Link = string;

export type MockApi_PreviewTorrentLink_Index = number;

export type MockApi_PreviewTorrentLink_Returns = MockApi_MockTorrentLinkPreview | null;

export type MockApi_PreviewTorrentLink_ParsedLink = URL | undefined;

export type MockApi_PreviewTorrentLink_DisplayName = string | null;

export type MockApi_PreviewTorrentLink_Name = string;

export type MockApi_PreviewTorrentLink_ExactTopic = string | undefined;

export type MockApi_PreviewTorrentLink_TotalSize = number;

export type MockApi_PreviewTorrentLink_PathSegments = string[];

export type MockApi_PreviewTorrentLink_EncodedName = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_DefaultVPNConnection_Returns = MockApi_MockVPNConnection;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_IsConnectionBeingRemoved_ConnectionId = string | null | undefined;

export type MockApi_IsConnectionBeingRemoved_Returns = boolean;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_VpnProtection_Returns = Record<string, unknown>;

export type MockApi_VpnProtection_Enabled = MockApi_MockVPNConnection[];

export type MockApi_VpnProtection_ProtectedCount = number;

export type MockApi_VpnProtection_State = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_LiveVPNConnections_Returns = Record<string, unknown>[];

export type MockApi_LiveVPNConnections_Connections = MockApi_MockVPNConnection[];

export type MockApi_LiveVPNConnections_Runtime = Record<string, unknown>;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_VpnConnectionResponse_Connection = MockApi_MockVPNConnection;

export type MockApi_VpnConnectionResponse_Returns = Record<string, unknown>;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_VpnConnectionsResponse_Returns = Record<string, unknown>;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_ProtectedVPNRuntime_ProviderId = string;

export type MockApi_ProtectedVPNRuntime_Tunnel = 'openvpn' | 'wireguard';

export type MockApi_ProtectedVPNRuntime_ProfileIds = string[];

export type MockApi_ProtectedVPNRuntime_EndpointStrategy = string;

export type MockApi_ProtectedVPNRuntime_Slot = number;

export type MockApi_ProtectedVPNRuntime_Returns = Record<string, unknown>;

export type MockApi_ProtectedVPNRuntime_Profile = Record<string, unknown> | undefined;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_DefaultVPNStatus_Returns = Record<string, unknown>;

export type MockApi_DefaultVPNStatus_Connection = MockApi_MockVPNConnection;

export type MockApi_DefaultVPNStatus_Runtime = Record<string, unknown>;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_ApplianceStatus_Returns = Record<string, unknown>;

export type MockApi_ApplianceStatus_Protection = Record<string, unknown>;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_TorrentErrors_Returns = string[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_Snapshot_Returns = Record<string, unknown>;

export type MockApi_Snapshot_DownloadSpeed = number;

export type MockApi_Snapshot_UploadSpeed = number;

export type MockApi_Snapshot_ActiveTorrentCount = number;

export type MockApi_Snapshot_Protection = Record<string, unknown>;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_SendError_Response = ServerResponse;

export type MockApi_SendError_Status = number;

export type MockApi_SendError_Code = string;

export type MockApi_SendError_Message = string;

export type MockApi_SendError_Details = Record<string, unknown>;

export type MockApi_SendError_Returns = void;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_SendConnectionBeingRemoved_Response = ServerResponse;

export type MockApi_SendConnectionBeingRemoved_Returns = void;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_SendIssues_Response = ServerResponse;

export type MockApi_SendIssues_Issue = {
  field: string;
  message: string;
};

export type MockApi_SendIssues_Issues = MockApi_SendIssues_Issue[];

export type MockApi_SendIssues_Returns = void;

export type MockApi_SendIssues_FirstIssue = MockApi_SendIssues_Issue | undefined;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_PasswordIssue_Password = string;

export type MockApi_PasswordIssue_Returns = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_UsernameIssue_Username = string;

export type MockApi_UsernameIssue_Returns = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_RemoteUsernameIssue_Username = string;

export type MockApi_RemoteUsernameIssue_Returns = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_EffectiveWebProxyConnectionId_Login = MockApi_MockWebProxyLogin;

export type MockApi_EffectiveWebProxyConnectionId_Returns = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_WebProxyResponse_Returns = Record<string, unknown>;

export type MockApi_WebProxyResponse_Logins = Record<string, unknown>[];

export type MockApi_WebProxyResponse_State = string;

export type MockApi_WebProxyResponse_Available = boolean;

export type MockApi_WebProxyResponse_EffectiveConnection = MockApi_MockVPNConnection | undefined;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_EffectiveWebProxyLogin_Login = MockApi_MockWebProxyLogin;

export type MockApi_EffectiveWebProxyLogin_Returns = Record<string, unknown>;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_SendFieldError_Response = ServerResponse;

export type MockApi_SendFieldError_Code = string;

export type MockApi_SendFieldError_Field = string;

export type MockApi_SendFieldError_Message = string;

export type MockApi_SendFieldError_Status = number;

export type MockApi_SendFieldError_Returns = void;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_StartSession_Response = ServerResponse;

export type MockApi_StartSession_Returns = void;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_ReadBody_Request = IncomingMessage;

export type MockApi_ReadBody_Returns = Promise<Record<string, unknown>>;

export type MockApi_ReadBody_Chunks = Buffer[];

export type MockApi_ReadBody_Text = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_ReadTokenFields_Request = IncomingMessage;

export type MockApi_ReadTokenFields_Response = ServerResponse;

export type MockApi_ReadTokenFields_TokenId = string;

export type MockApi_ReadTokenFields_Returns = Promise<Record<string, unknown> | undefined>;

export type MockApi_ReadTokenFields_Body = Record<string, unknown>;

export type MockApi_ReadTokenFields_UnknownField = string | undefined;

export type MockApi_ReadTokenFields_Issues = {
  field: string;
  message: string;
}[];

export type MockApi_ReadTokenFields_Name = string;

export type MockApi_ReadTokenFields_Scopes = unknown[];

export type MockApi_ReadTokenFields_ExpiresAt = unknown;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_ReadIDs_Body = Record<string, unknown>;

export type MockApi_ReadIDs_Returns = number[];

export type MockApi_ReadIDs_Ids = unknown;

export type MockApi_ReadIDs_Id = number;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MockContentDownloads = Map<string, MockApi_MockContentDownload>;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MockFinishedFiles_Torrent = MockApi_MockTorrent;

export type MockApi_MockFinishedFiles_Returns = MockApi_MockZipFile[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MockTorrentFile_Torrent = MockApi_MockTorrent;

export type MockApi_MockTorrentFile_Returns = Buffer;

export type MockApi_MockTorrentFile_Name = Buffer;

export type MockApi_MockTorrentFile_Announce = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_TorrentDownloadName_Torrent = MockApi_MockTorrent;

export type MockApi_TorrentDownloadName_Returns = string;

export type MockApi_TorrentDownloadName_Cleaned = string;

export type MockApi_TorrentDownloadName_FileStem = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_AttachmentDisposition_FileName = string;

export type MockApi_AttachmentDisposition_Returns = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_StoredZip_Files = MockApi_MockZipFile[];

export type MockApi_StoredZip_Returns = Buffer;

export type MockApi_StoredZip_LocalFileSignature = number;

export type MockApi_StoredZip_CentralFileSignature = number;

export type MockApi_StoredZip_EndSignature = number;

export type MockApi_StoredZip_Utf8NamesFlag = number;

export type MockApi_StoredZip_FirstDosDate = number;

export type MockApi_StoredZip_LocalParts = Buffer[];

export type MockApi_StoredZip_CentralParts = Buffer[];

export type MockApi_StoredZip_UsedNames = Set<string>;

export type MockApi_StoredZip_Offset = number;

export type MockApi_StoredZip_ExtensionMatch = RegExpExecArray | null;

export type MockApi_StoredZip_Extension = string;

export type MockApi_StoredZip_BaseName = string;

export type MockApi_StoredZip_EntryName = string;

export type MockApi_StoredZip_NameBytes = Buffer;

export type MockApi_StoredZip_Checksum = number;

export type MockApi_StoredZip_Local = Buffer;

export type MockApi_StoredZip_Central = Buffer;

export type MockApi_StoredZip_CentralSize = number;

export type MockApi_StoredZip_End = Buffer;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_ReadTorrentSelection_Body = Record<string, unknown>;

export type MockApi_ReadTorrentSelection_Response = ServerResponse;

export type MockApi_ReadTorrentSelection_Returns = MockApi_MockTorrentSelection | undefined;

export type MockApi_ReadTorrentSelection_Starting = boolean;

export type MockApi_ReadTorrentSelection_RequestedHashes = unknown[];

export type MockApi_ReadTorrentSelection_HexadecimalCharacters = string;

export type MockApi_ReadTorrentSelection_Valid = boolean;

export type MockApi_ReadTorrentSelection_Hashes = string[];

export type MockApi_ReadTorrentSelection_Items = MockApi_MockTorrent[];

export type MockApi_ReadTorrentSelection_Ids = number[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_TorrentMutationResponse_Selection = MockApi_MockTorrentSelection;

export type MockApi_TorrentMutationResponse_Returns = Record<string, unknown>;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_ReadTorrentProfile_Body = Record<string, unknown>;

export type MockApi_ReadTorrentProfile_Id = string;

export type MockApi_ReadTorrentProfile_CreatedAt = string;

export type MockApi_ReadTorrentProfile_Returns = MockApi_MockTorrentProfile;

export type MockApi_ReadTorrentProfile_Options = Record<string, unknown>;

export type MockApi_ReadTorrentProfile_Seeding = Record<string, unknown>;

export type MockApi_ReadTorrentProfile_UpdatedAt = string;

export type MockApi_ReadTorrentProfile_BandwidthPriority = -1 | 0 | 1;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_ReadDefaultTorrentProfile_Body = Record<string, unknown>;

export type MockApi_ReadDefaultTorrentProfile_Returns = MockApi_MockDefaultTorrentProfile;

export type MockApi_ReadDefaultTorrentProfile_NormalizedProfile = MockApi_MockTorrentProfile;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_ApplyAction_Action = string;

export type MockApi_ApplyAction_Ids = number[];

export type MockApi_ApplyAction_Returns = void;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_AddedTorrentName_Filename = unknown;

export type MockApi_AddedTorrentName_FallbackId = number;

export type MockApi_AddedTorrentName_Returns = string;

export type MockApi_AddedTorrentName_SourceURL = URL;

export type MockApi_AddedTorrentName_LastSegment = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_BackupGrants = Map<string, {
  expiresAt: number;
  purpose: 'export' | 'import';
}>;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_BackupImportJob = MockApi_MockBackupImport | null;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MaximumBackupNotificationDestinations = number;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MaximumBackupRPCLogins = number;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MaximumBackupAPITokens = number;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_IssueMockBackupGrant_Purpose = 'export' | 'import';

export type MockApi_IssueMockBackupGrant_Returns = Record<string, string>;

export type MockApi_IssueMockBackupGrant_Grant = string;

export type MockApi_IssueMockBackupGrant_ExpiresAt = number;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_ConsumeMockBackupGrant_Value = unknown;

export type MockApi_ConsumeMockBackupGrant_Purpose = 'export' | 'import';

export type MockApi_ConsumeMockBackupGrant_Returns = boolean;

export type MockApi_ConsumeMockBackupGrant_Grant = string;

export type MockApi_ConsumeMockBackupGrant_Confirmation = {
  expiresAt: number;
  purpose: 'export' | 'import';
} | undefined;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MockBackupMetainfo_Returns = {
  hash: string;
  metainfo: string;
};

export type MockApi_MockBackupMetainfo_Info = Buffer;

export type MockApi_MockBackupMetainfo_Metainfo = Buffer;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MockBackupDocument_Selected = Record<string, unknown>;

export type MockApi_MockBackupDocument_Returns = Record<string, unknown>;

export type MockApi_MockBackupDocument_Document = Record<string, unknown>;

export type MockApi_MockBackupDocument_SecretEntry = [string, string];

export type MockApi_MockBackupDocument_SourceTorrent = MockApi_MockTorrent | undefined;

export type MockApi_MockBackupDocument_Metainfo = MockApi_MockBackupMetainfo_Returns;

export type MockApi_MockBackupDocument_SourceProfile = MockApi_MockTorrentProfile | undefined;

export type MockApi_MockBackupDocument_SelectedConnections = MockApi_MockVPNConnection[];

export type MockApi_MockBackupDocument_SelectedProfileIDs = Set<string>;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MockBackupCountLabel_Count = number;

export type MockApi_MockBackupCountLabel_Singular = string;

export type MockApi_MockBackupCountLabel_Plural = string;

export type MockApi_MockBackupCountLabel_Returns = string;

export type MockApi_MockBackupCountLabel_Noun = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MockBackupActionLines_Result = MockApi_MockBackupMergeResult;

export type MockApi_MockBackupActionLines_Returns = string[];

export type MockApi_MockBackupActionLines_Actions = string[];

export type MockApi_MockBackupActionLines_Verb = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MockBackupStringMap_Value = unknown;

export type MockApi_MockBackupStringMap_Returns = Record<string, string>;

export type MockApi_MockBackupStringMap_Values = Record<string, string>;

export type MockApi_MockBackupStringMap_EntryValue = unknown;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MockBackupIDIsUsed_Items = readonly {
  id: string;
}[];

export type MockApi_MockBackupIDIsUsed_Id = string;

export type MockApi_MockBackupIDIsUsed_AllowedIndex = number;

export type MockApi_MockBackupIDIsUsed_Returns = boolean;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MergeMockBackupAccess_Document = Record<string, unknown>;

export type MockApi_MergeMockBackupAccess_Apply = boolean;

export type MockApi_MergeMockBackupAccess_Returns = string[];

export type MockApi_MergeMockBackupAccess_MergedNotifications = MockApi_MockNotification[];

export type MockApi_MergeMockBackupAccess_MergedRPCLogins = MockApi_MockRPCLogin[];

export type MockApi_MergeMockBackupAccess_MergedRPCLoginDigests = Map<string, string>;

export type MockApi_MergeMockBackupAccess_MergedTokens = Record<string, unknown>[];

export type MockApi_MergeMockBackupAccess_MergedTokenDigests = Map<string, string>;

export type MockApi_MergeMockBackupAccess_Result = MockApi_MockBackupMergeResult;

export type MockApi_MergeMockBackupAccess_ImportedRecord = Record<string, unknown>;

export type MockApi_MergeMockBackupAccess_ImportedNotifications = MockApi_MergeMockBackupAccess_ImportedRecord[];

export type MockApi_MergeMockBackupAccess_Name = string;

export type MockApi_MergeMockBackupAccess_ReplaceIndex = number;

export type MockApi_MergeMockBackupAccess_Id = string;

export type MockApi_MergeMockBackupAccess_SecretValues = Record<string, string>;

export type MockApi_MergeMockBackupAccess_SecretFields = Record<string, true>;

export type MockApi_MergeMockBackupAccess_Now = string;

export type MockApi_MergeMockBackupAccess_Notification = MockApi_MockNotification;

export type MockApi_MergeMockBackupAccess_Event = string;

export type MockApi_MergeMockBackupAccess_Service = MockApi_MockNotificationService;

export type MockApi_MergeMockBackupAccess_RemoteAccess = MockApi_MergeMockBackupAccess_ImportedRecord | undefined;

export type MockApi_MergeMockBackupAccess_ImportedLogins = MockApi_MergeMockBackupAccess_ImportedRecord[];

export type MockApi_MergeMockBackupAccess_Username = string;

export type MockApi_MergeMockBackupAccess_Login = MockApi_MockRPCLogin;

export type MockApi_MergeMockBackupAccess_ReplacedLogin = MockApi_MockRPCLogin | undefined;

export type MockApi_MergeMockBackupAccess_ImportedTokens = MockApi_MergeMockBackupAccess_ImportedRecord[];

export type MockApi_MergeMockBackupAccess_Digest = string;

export type MockApi_MergeMockBackupAccess_Duplicate = boolean;

export type MockApi_MergeMockBackupAccess_Scope = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MockBackupPreview_Document = Record<string, unknown>;

export type MockApi_MockBackupPreview_Returns = Record<string, unknown>;

export type MockApi_MockBackupPreview_ImportedRecord = Record<string, unknown>;

export type MockApi_MockBackupPreview_SettingsAndProfiles = MockApi_MockBackupPreview_ImportedRecord | undefined;

export type MockApi_MockBackupPreview_ImportedDefault = MockApi_MockBackupPreview_ImportedRecord | undefined;

export type MockApi_MockBackupPreview_ImportedProfiles = MockApi_MockBackupPreview_ImportedRecord[];

export type MockApi_MockBackupPreview_FolderPaths = Set<string>;

export type MockApi_MockBackupPreview_ProfilePreview = Record<string, unknown>[];

export type MockApi_MockBackupPreview_Existing = MockApi_MockTorrentProfile | undefined;

export type MockApi_MockBackupPreview_ImportedSettings = MockApi_MockBackupPreview_ImportedRecord[];

export type MockApi_MockBackupPreview_SectionNames = [string, string][];

export type MockApi_MockBackupPreview_RemoteAccess = MockApi_MockBackupPreview_ImportedRecord | undefined;

export type MockApi_MockBackupPreview_CurrentSetting = Record<string, unknown> | undefined;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MockAnotherTransmissionPreview_FolderMappings = Record<string, unknown>;

export type MockApi_MockAnotherTransmissionPreview_Returns = Record<string, unknown>;

export type MockApi_MockAnotherTransmissionPreview_FolderFixture = {
  description: string;
  kind: 'default' | 'download' | 'empty' | 'incomplete';
  path: string;
  total: number;
};

export type MockApi_MockAnotherTransmissionPreview_FolderFixtures = MockApi_MockAnotherTransmissionPreview_FolderFixture[];

export type MockApi_MockAnotherTransmissionPreview_Folders = Record<string, unknown>[];

export type MockApi_MockAnotherTransmissionPreview_MappedPath = string;

export type MockApi_MockAnotherTransmissionPreview_Found = number;

export type MockApi_MockAnotherTransmissionPreview_DataFoundStatus = string;

export type MockApi_MockAnotherTransmissionPreview_ImportProfiles = Record<string, unknown>[];

export type MockApi_MockAnotherTransmissionPreview_MappedSettings = Record<string, unknown>[];

export type MockApi_MockAnotherTransmissionPreview_SkippedSettings = Record<string, unknown>[];

export type MockApi_MockAnotherTransmissionPreview_Total = number;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_StartMockBackupImport_Document = Record<string, unknown>;

export type MockApi_StartMockBackupImport_FolderMappings = Record<string, unknown>;

export type MockApi_StartMockBackupImport_Returns = MockApi_MockBackupImport;

export type MockApi_StartMockBackupImport_ImportedRecord = Record<string, unknown>;

export type MockApi_StartMockBackupImport_ImportedTorrents = MockApi_StartMockBackupImport_ImportedRecord[];

export type MockApi_StartMockBackupImport_Job = MockApi_MockBackupImport;

export type MockApi_StartMockBackupImport_SourceFolder = string;

export type MockApi_StartMockBackupImport_Hash = string;

export type MockApi_StartMockBackupImport_UnknownList = unknown[];

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_StartMockAnotherTransmissionImport_Body = Record<string, unknown>;

export type MockApi_StartMockAnotherTransmissionImport_Returns = MockApi_MockBackupImport;

export type MockApi_StartMockAnotherTransmissionImport_FolderMappings = Record<string, unknown>;

export type MockApi_StartMockAnotherTransmissionImport_ProfileNames = Record<string, unknown>;

export type MockApi_StartMockAnotherTransmissionImport_ProfileIncluded = Record<string, unknown>;

export type MockApi_StartMockAnotherTransmissionImport_SourceItem = {
  folder: string;
  name: string;
  profileName: string;
};

export type MockApi_StartMockAnotherTransmissionImport_SourceItems = MockApi_StartMockAnotherTransmissionImport_SourceItem[];

export type MockApi_StartMockAnotherTransmissionImport_Job = MockApi_MockBackupImport;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MockBackupImportResponse_Job = MockApi_MockBackupImport;

export type MockApi_MockBackupImportResponse_Returns = Record<string, unknown>;

export type MockApi_MockBackupImportResponse_ElapsedSeconds = number;

export type MockApi_MockBackupImportResponse_SecondsPerItem = number;

export type MockApi_MockBackupImportResponse_Items = Record<string, unknown>[];

export type MockApi_MockBackupImportResponse_ItemSeconds = number;

export type MockApi_MockBackupImportResponse_State = string;

export type MockApi_MockBackupImportResponse_Progress = number;

export type MockApi_MockBackupImportResponse_Detail = string;

export type MockApi_MockBackupImportResponse_CompletedTorrents = number;

export type MockApi_MockBackupImportResponse_EmptyJobComplete = boolean;

export type MockApi_MockBackupImportResponse_Complete = boolean;

export type MockApi_MockBackupImportResponse_Status = string;

export type MockApi_MockBackupImportResponse_Now = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MockImportSourceDirectory_Path = string;

export type MockApi_MockImportSourceDirectory_Returns = Record<string, unknown> | null;

export type MockApi_MockImportSourceDirectory_Tree = Record<string, string[]>;

export type MockApi_MockImportSourceDirectory_Children = string[] | undefined;

export type MockApi_MockImportSourceDirectory_ChildPath = string;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_HandleRequest_Request = IncomingMessage;

export type MockApi_HandleRequest_Response = ServerResponse;

export type MockApi_HandleRequest_Returns = Promise<boolean>;

export type MockApi_HandleRequest_Url = URL;

export type MockApi_HandleRequest_Path = string;

export type MockApi_HandleRequest_Method = string;

export type MockApi_HandleRequest_Body = Record<string, unknown>;

export type MockApi_HandleRequest_ClaimCode = string;

export type MockApi_HandleRequest_Username = string;

export type MockApi_HandleRequest_Password = string;

export type MockApi_HandleRequest_Issues = MockApi_SendIssues_Issues;

export type MockApi_HandleRequest_Missing = MockApi_SendIssues_Issues;

export type MockApi_HandleRequest_Code = string;

export type MockApi_HandleRequest_RecoveryIndex = number;

export type MockApi_HandleRequest_TokenId = string | undefined;

export type MockApi_HandleRequest_Token = Record<string, unknown> | undefined;

export type MockApi_HandleRequest_BackupPurpose = 'export' | 'import' | undefined;

export type MockApi_HandleRequest_PurposeText = string;

export type MockApi_HandleRequest_Selected = Record<string, unknown>;

export type MockApi_HandleRequest_SourceDirectory = Record<string, unknown> | null;

export type MockApi_HandleRequest_FolderMappings = Record<string, unknown>;

export type MockApi_HandleRequest_Document = Record<string, unknown> | undefined;

export type MockApi_HandleRequest_DocumentRecord = Record<string, unknown>;

export type MockApi_HandleRequest_Job = MockApi_MockBackupImport;

export type MockApi_HandleRequest_JobResponse = Record<string, unknown> | null;

export type MockApi_HandleRequest_BackupImportMatch = RegExpMatchArray | null;

export type MockApi_HandleRequest_Name = string;

export type MockApi_HandleRequest_Passkey = Record<string, unknown>;

export type MockApi_HandleRequest_PasskeyId = string;

export type MockApi_HandleRequest_Send = () => MockApi_HandleRequest_Send_Returns;

export type MockApi_HandleRequest_Send_Returns = void;

export type MockApi_HandleRequest_Timer = NodeJS.Timeout;

export type MockApi_HandleRequest_Issue = string;

export type MockApi_HandleRequest_RpcLogin = MockApi_MockRPCLogin;

export type MockApi_HandleRequest_GeneratedPassword = string;

export type MockApi_HandleRequest_RpcLoginMatch = RegExpMatchArray | null;

export type MockApi_HandleRequest_FoundRpcLogin = MockApi_MockRPCLogin | undefined;

export type MockApi_HandleRequest_RegeneratePassword = boolean;

export type MockApi_HandleRequest_OptionalPassword = string | undefined;

export type MockApi_HandleRequest_RequestedEnabled = boolean;

export type MockApi_HandleRequest_TransitionSequence = number;

export type MockApi_HandleRequest_UsernameMessage = string;

export type MockApi_HandleRequest_RequestedConnectionId = unknown;

export type MockApi_HandleRequest_WebProxyLogin = MockApi_MockWebProxyLogin;

export type MockApi_HandleRequest_WebProxyLoginMatch = RegExpMatchArray | null;

export type MockApi_HandleRequest_FoundWebProxyLogin = MockApi_MockWebProxyLogin | undefined;

export type MockApi_HandleRequest_PeerPort = number;

export type MockApi_HandleRequest_ProfileIds = string[];

export type MockApi_HandleRequest_ProviderId = string;

export type MockApi_HandleRequest_Tunnel = 'openvpn' | 'wireguard';

export type MockApi_HandleRequest_Credentials = Record<string, string>;

export type MockApi_HandleRequest_MissingCredential = MockApi_MockVPNCredentialField | undefined;

export type MockApi_HandleRequest_Now = string;

export type MockApi_HandleRequest_Slot = number;

export type MockApi_HandleRequest_EndpointStrategy = 'ordered' | 'randomized' | 'sticky';

export type MockApi_HandleRequest_ConnectionId = string;

export type MockApi_HandleRequest_NewConnection = MockApi_MockVPNConnection;

export type MockApi_HandleRequest_NextDefault = MockApi_MockVPNConnection | undefined;

export type MockApi_HandleRequest_PreviousDefault = MockApi_MockVPNConnection;

export type MockApi_HandleRequest_FollowingProfileIDs = Set<string>;

export type MockApi_HandleRequest_ProfileTorrents = MockApi_MockTorrent[];

export type MockApi_HandleRequest_DefaultProfileTorrents = number;

export type MockApi_HandleRequest_FollowingProfileTorrents = number;

export type MockApi_HandleRequest_Moved = Record<string, unknown>[];

export type MockApi_HandleRequest_Failed = boolean;

export type MockApi_HandleRequest_VpnConnectionMatch = RegExpMatchArray | null;

export type MockApi_HandleRequest_Connection = MockApi_MockVPNConnection | undefined;

export type MockApi_HandleRequest_Action = string | undefined;

export type MockApi_HandleRequest_MutatingConnectionRoute = boolean;

export type MockApi_HandleRequest_Configuration = Record<string, unknown>;

export type MockApi_HandleRequest_SubmittedCredentials = Record<string, string>;

export type MockApi_HandleRequest_DependentTorrents = MockApi_MockTorrent[];

export type MockApi_HandleRequest_DependentProfiles = MockApi_MockTorrentProfile[];

export type MockApi_HandleRequest_DependentLogins = MockApi_MockWebProxyLogin[];

export type MockApi_HandleRequest_MoveTo = string | undefined;

export type MockApi_HandleRequest_TargetConnection = MockApi_MockVPNConnection | undefined;

export type MockApi_HandleRequest_TargetConnectionName = string;

export type MockApi_HandleRequest_StoredMoveTo = string | null;

export type MockApi_HandleRequest_RefreshCatalogMatch = RegExpMatchArray | null;

export type MockApi_HandleRequest_TunnelName = string;

export type MockApi_HandleRequest_Setting = Record<string, unknown> | undefined;

export type MockApi_HandleRequest_TunnelDefinition = unknown;

export type MockApi_HandleRequest_SelectedTunnelDefinition = Record<string, unknown> | undefined;

export type MockApi_HandleRequest_TunnelCandidate = Record<string, unknown>;

export type MockApi_HandleRequest_TunnelCandidateMatches = boolean;

export type MockApi_HandleRequest_Catalog = unknown;

export type MockApi_HandleRequest_RefreshedCatalog = Record<string, unknown>;

export type MockApi_HandleRequest_Enabled = boolean;

export type MockApi_HandleRequest_ConfiguredSources = unknown;

export type MockApi_HandleRequest_UpdateRequestedAt = string;

export type MockApi_HandleRequest_CompletedAt = string;

export type MockApi_HandleRequest_RuntimeApply = Record<string, unknown> | undefined;

export type MockApi_HandleRequest_Changes = Record<string, unknown>;

export type MockApi_HandleRequest_RootDownloadSetting = string | undefined;

export type MockApi_HandleRequest_NextDownloadDirectory = string;

export type MockApi_HandleRequest_NextIncompleteDirectory = string;

export type MockApi_HandleRequest_FolderOwner = MockApi_ProfileFolderOwner_Returns;

export type MockApi_HandleRequest_ClashDestination = {
  path: string;
  profileName: string;
};

export type MockApi_HandleRequest_Clash = MockApi_HandleRequest_ClashDestination | undefined;

export type MockApi_HandleRequest_ExactFolder = boolean;

export type MockApi_HandleRequest_Message = string;

export type MockApi_HandleRequest_AppliedKeys = string[];

export type MockApi_HandleRequest_PendingKeys = string[];

export type MockApi_HandleRequest_SettingKey = string;

export type MockApi_HandleRequest_PurposeValue = string;

export type MockApi_HandleRequest_Purpose = MockApi_MockDirectoryPurpose;

export type MockApi_HandleRequest_ProfileID = string;

export type MockApi_HandleRequest_Created = string;

export type MockApi_HandleRequest_DirectoryPath = string;

export type MockApi_HandleRequest_Normalized = boolean;

export type MockApi_HandleRequest_DeletionPolicy = MockApi_MockDirectoryDeletionPolicy;

export type MockApi_HandleRequest_Status = number;

export type MockApi_HandleRequest_RemovedLabels = string[];

export type MockApi_HandleRequest_RenamedLabelValue = unknown;

export type MockApi_HandleRequest_RenamedLabels = MockApi_ApplySavedLabelEdits_RenamedLabels;

export type MockApi_HandleRequest_RenamedLabelRecord = Record<string, unknown>;

export type MockApi_HandleRequest_ChangedTorrents = number;

export type MockApi_HandleRequest_NextLabels = string[];

export type MockApi_HandleRequest_ProfileName = string;

export type MockApi_HandleRequest_NextProfileSequence = number;

export type MockApi_HandleRequest_ProfileId = string;

export type MockApi_HandleRequest_CreatedAt = string;

export type MockApi_HandleRequest_TorrentProfile = MockApi_MockTorrentProfile;

export type MockApi_HandleRequest_UpdatedDefaultProfile = MockApi_MockDefaultTorrentProfile;

export type MockApi_HandleRequest_FolderChanged = boolean;

export type MockApi_HandleRequest_ConnectionChanged = boolean;

export type MockApi_HandleRequest_TorrentProfileMatch = RegExpMatchArray | null;

export type MockApi_HandleRequest_ProfileIndex = number;

export type MockApi_HandleRequest_ExistingTorrentProfile = MockApi_MockTorrentProfile | undefined;

export type MockApi_HandleRequest_TargetDirectory = string;

export type MockApi_HandleRequest_AlreadyThere = boolean;

export type MockApi_HandleRequest_MoveResult = string;

export type MockApi_HandleRequest_TunnelFilter = string | null;

export type MockApi_HandleRequest_CustomTunnel = unknown;

export type MockApi_HandleRequest_CustomProfileName = unknown;

export type MockApi_HandleRequest_CustomProfileContent = unknown;

export type MockApi_HandleRequest_LooksLikeWireGuard = boolean;

export type MockApi_HandleRequest_EndpointMatches = RegExpMatchArray[];

export type MockApi_HandleRequest_TunnelLabel = string;

export type MockApi_HandleRequest_DisplayName = string;

export type MockApi_HandleRequest_Slug = string;

export type MockApi_HandleRequest_UploadedProfiles = Record<string, unknown>[];

export type MockApi_HandleRequest_RemoteProtocol = string | undefined;

export type MockApi_HandleRequest_Tcp = boolean;

export type MockApi_HandleRequest_IdPrefix = string;

export type MockApi_HandleRequest_IdSuffix = string;

export type MockApi_HandleRequest_Input = MockApi_MockNotificationInput | null;

export type MockApi_HandleRequest_Notification = MockApi_MockNotification;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_HandleRequest_NotificationInput_Body = Record<string, unknown>;

export type MockApi_HandleRequest_NotificationInput_Existing = MockApi_MockNotification | null;

export type MockApi_HandleRequest_NotificationInput_Returns = MockApi_MockNotificationInput | null;

export type MockApi_HandleRequest_NotificationInput = (body: MockApi_HandleRequest_NotificationInput_Body, existing: MockApi_HandleRequest_NotificationInput_Existing) => MockApi_HandleRequest_NotificationInput_Returns;

export type MockApi_HandleRequest_NotificationInput_Service = MockApi_MockNotificationService;

export type MockApi_HandleRequest_NotificationInput_Name = string;

export type MockApi_HandleRequest_NotificationInput_Events = string[];

export type MockApi_HandleRequest_NotificationInput_Values = Record<string, unknown>;

export type MockApi_HandleRequest_NotificationInput_PlainSettings = Record<string, string>;

export type MockApi_HandleRequest_NotificationInput_Secrets = Record<string, true>;

export type MockApi_HandleRequest_NotificationInput_Key = string;

export type MockApi_HandleRequest_NotificationInput_Missing = string;

export type MockApi_HandleRequest_NotificationInput_Secret = boolean;

export type MockApi_HandleRequest_NotificationInput_Required = boolean;

export type MockApi_HandleRequest_NotificationInput_Value = string;

export type MockApi_HandleRequest_NotificationInput_Saved = boolean;

export type MockApi_HandleRequest_NotificationInput_Clearable = string[];

export type MockApi_HandleRequest_NotificationInput_ClearSecrets = unknown[];

export type MockApi_HandleRequest_NotificationInput_InvalidIndex = number;

export type MockApi_HandleRequest_NotificationInput_ClearSecretKeys = string[];

export type MockApi_HandleRequest_NotificationInput_Replaced = string | undefined;

export type MockApi_HandleRequest_NotificationMatch = RegExpMatchArray | null;

export type MockApi_HandleRequest_Index = number;

export type MockApi_HandleRequest_FoundNotification = MockApi_MockNotification | undefined;

export type MockApi_HandleRequest_Fields = Record<string, unknown> | undefined;

export type MockApi_HandleRequest_NewToken = Record<string, unknown>;

export type MockApi_HandleRequest_Plaintext = string;

export type MockApi_HandleRequest_SelectionParam = string | null;

export type MockApi_HandleRequest_Identifiers = number[] | null;

export type MockApi_HandleRequest_TorrentItems = MockApi_MockTorrent[];

export type MockApi_HandleRequest_PreviewItems = MockApi_MockTorrentLinkPreview[];

export type MockApi_HandleRequest_Preview = MockApi_MockTorrentLinkPreview | null;

export type MockApi_HandleRequest_SelectedProfile = MockApi_MockTorrentProfile | undefined;

export type MockApi_HandleRequest_ProfileData = MockApi_MockDefaultTorrentProfile | MockApi_MockTorrentProfile;

export type MockApi_HandleRequest_Overlap = MockApi_ProfileFolderOverlaps_Overlap | undefined;

export type MockApi_HandleRequest_ProfileLabel = string;

export type MockApi_HandleRequest_DownloadDirectory = string;

export type MockApi_HandleRequest_DownloadIssue = string;

export type MockApi_HandleRequest_NextId = number;

export type MockApi_HandleRequest_SourceValue = string;

export type MockApi_HandleRequest_Hash = string;

export type MockApi_HandleRequest_TargetConnectionId = string;

export type MockApi_HandleRequest_DuplicateTorrent = MockApi_MockTorrent | undefined;

export type MockApi_HandleRequest_NowSeconds = number;

export type MockApi_HandleRequest_Paused = boolean;

export type MockApi_HandleRequest_TotalSize = number;

export type MockApi_HandleRequest_NewTorrent = MockApi_MockTorrent;

export type MockApi_HandleRequest_TorrentSelection = MockApi_MockTorrentSelection | undefined;

export type MockApi_HandleRequest_BandwidthPriority = MockApi_MockTorrent['bandwidthPriority'];

export type MockApi_HandleRequest_SeedIdleMode = MockApi_MockTorrent['seedIdleMode'];

export type MockApi_HandleRequest_SeedRatioMode = MockApi_MockTorrent['seedRatioMode'];

export type MockApi_HandleRequest_MovedTorrents = Record<string, unknown>[];

export type MockApi_HandleRequest_ResolvingSelection = boolean;

export type MockApi_HandleRequest_ResolvingProfile = boolean;

export type MockApi_HandleRequest_ExistingLabels = string[];

export type MockApi_HandleRequest_RequestedCount = number;

export type MockApi_HandleRequest_FirstTorrent = MockApi_MockTorrent | undefined;

export type MockApi_HandleRequest_DownloadHeaders = Record<string, string>;

export type MockApi_HandleRequest_ZipFile = MockApi_MockZipFile;

export type MockApi_HandleRequest_FileName = string;

export type MockApi_HandleRequest_Content = Buffer;

export type MockApi_HandleRequest_DownloadToken = string;

export type MockApi_HandleRequest_ContentDownloadMatch = RegExpExecArray | null;

export type MockApi_HandleRequest_Download = MockApi_MockContentDownload | undefined;

export type MockApi_HandleRequest_RenamedTorrent = MockApi_MockTorrent;

export type MockApi_HandleRequest_DetailMatch = RegExpMatchArray | null;

export type MockApi_HandleRequest_DetailTorrent = MockApi_MockTorrent | undefined;

/**
 * Mock API.
 *
 * @since 2.4.1
 */
export type MockApi_MockApi_Returns = Plugin;

export type MockApi_MockApi_Request = IncomingMessage;

export type MockApi_MockApi_Response = ServerResponse;

export type MockApi_MockApi_Next = () => void;
