export type Web_Backup_Purpose = 'export' | 'import';

export type Web_Backup_ExportSections = {
  labels: boolean;
  notifications: boolean;
  remoteAccess: boolean;
  settingsAndProfiles: boolean;
  torrents: boolean;
  vpnConnections: boolean;
};

export type Web_Backup_ProfileOptions = {
  bandwidthPriority: number;
  downloadLimitKBps: number | null;
  peerLimit: number;
  queue: string;
  seeding: {
    idleMinutes: number | null;
    mode: string;
    ratio: number | null;
  };
  uploadLimitKBps: number | null;
};

export type Web_Backup_Profile = {
  connectionId: string | null;
  createdAt: string;
  downloadDirectory: string;
  id: string;
  labels: string[];
  matchPatterns: string[];
  name: string;
  options: Web_Backup_ProfileOptions;
  startPaused: boolean;
  updatedAt: string;
};

export type Web_Backup_Document = {
  appVersion: string;
  exportedAt: string;
  format: 'transmission-vpn-export';
  labels?: string[] | undefined;
  notifications?: Array<{
    events: string[];
    id: string;
    name: string;
    secrets: Record<string, string>;
    service: string;
    settings: Record<string, string>;
  }> | undefined;
  remoteAccess?: {
    apiTokens: Array<{
      createdAt: string;
      expiresAt: string | null;
      id: string;
      lastUsedAt: string | null;
      name: string;
      scopes: string[];
      tokenDigest: string;
    }>;
    rpcLogins: Array<{
      createdAt: string;
      id: string;
      lastUsedAt: string | null;
      secretDigest: string;
      updatedAt: string;
      username: string;
    }>;
  } | undefined;
  settingsAndProfiles?: {
    defaultProfile: {
      downloadDirectory: string;
      labels: string[];
      name: string;
      options: Web_Backup_ProfileOptions;
      startPaused: boolean;
    };
    profiles: Web_Backup_Profile[];
    settings: Array<{
      key: string;
      value: unknown;
    }>;
  } | undefined;
  torrents?: Array<{
    addedDate?: number | undefined;
    connectionId: string;
    downloadDirectory: string;
    hash: string;
    labels: string[];
    limits: {
      bandwidthPriority: number;
      downloadLimit: number;
      downloadLimited: boolean;
      honorsSessionLimits: boolean;
      peerLimit: number;
      seedIdleLimit: number;
      seedIdleMode: number;
      seedRatioLimit: number;
      seedRatioMode: number;
      uploadLimit: number;
      uploadLimited: boolean;
    };
    metainfo: string;
    name: string;
    paused: boolean;
    percentDone: number;
    profileId: string | null;
    profileName: string;
  }> | undefined;
  version: 1;
  vpnConnections?: {
    connections: Array<{
      credentials: Record<string, string>;
      default: boolean;
      dnsServers: string[];
      enabled: boolean;
      endpointStrategy: 'sticky' | 'ordered' | 'randomized';
      id: string;
      name: string;
      peerPort: number;
      profileIds: string[];
      providerId: string;
      retryIntervalSeconds: number;
      slot: number;
      tunnel: 'openvpn' | 'wireguard';
    }>;
    profiles: Array<{
      city: string;
      configuration: string;
      continent: string;
      country: string;
      countryCode: string;
      displayName: string;
      fingerprint: string;
      id: string;
      protocol: string;
      providerId: string;
      remoteHost: string;
      remotePort: number;
      source: string;
      tunnel: 'openvpn' | 'wireguard';
    }>;
  } | undefined;
};

export type Web_Backup_Grant = {
  expiresAt: string;
  grant: string;
};

export type Web_Backup_ImportFolderPreview = {
  dataFound: boolean;
  dataFoundCount?: number | undefined;
  dataFoundStatus?: 'empty' | 'found' | 'not-found' | 'partial' | undefined;
  conflict?: string | undefined;
  dataTotal?: number | undefined;
  description?: string | undefined;
  kind?: 'default' | 'download' | 'empty' | 'incomplete' | undefined;
  mappedPath?: string | undefined;
  sourcePath: string;
  torrentCount?: number | undefined;
};

export type Web_Backup_ImportProfilePreview = {
  default: boolean;
  existingId: string | null;
  existingName: string | null;
  id: string;
  included: boolean;
  connectionId?: string | null | undefined;
  empty?: boolean | undefined;
  name: string;
  note?: string | undefined;
  sourcePath?: string | undefined;
  suggestedAction: 'replace';
};

export type Web_Backup_ImportConnectionPreview = {
  default: boolean;
  id: string;
  name: string;
};

export type Web_Backup_ImportSourcePreview = {
  incompleteDirectory?: string | undefined;
  readOnly: boolean;
  settingsFile: string;
  torrentCount: number;
  version: number;
};

export type Web_Backup_ImportSettingPreview = {
  fileValue: unknown;
  hereValue?: unknown;
  key: string;
  reason?: string | undefined;
  title: string;
  willImport: boolean;
};

export type Web_Backup_ImportPreview = {
  actions: string[];
  alreadyPresentCount?: number | undefined;
  appVersion: string;
  connections: Web_Backup_ImportConnectionPreview[];
  dataFoundBytes?: number | undefined;
  dataMissingCount?: number | undefined;
  exportedAt: string;
  folders: Web_Backup_ImportFolderPreview[];
  hasRemoteLogins: boolean;
  profiles: Web_Backup_ImportProfilePreview[];
  runningTorrentCount?: number | undefined;
  sections: string[];
  settings: Web_Backup_ImportSettingPreview[];
  sourceDetails?: Web_Backup_ImportSourcePreview | undefined;
  totalSizeBytes: number;
  torrentCount: number;
};

export type Web_Backup_ImportState = 'queued' | 'rechecking' | 'seeding' | 'downloading' | 'paused' | 'data-missing' | 'already-added' | 'failed';

export type Web_Backup_ImportItem = {
  detail: string;
  folder: string;
  hash: string;
  name: string;
  profileName: string;
  progress: number;
  state: Web_Backup_ImportState;
};

export type Web_Backup_ImportJob = {
  completedAt: string | null;
  completedTorrents: number;
  createdAt: string;
  error: string;
  id: string;
  items: Web_Backup_ImportItem[];
  source: 'another-transmission' | 'transmission-vpn-export';
  startedAt: string | null;
  status: 'queued' | 'running' | 'completed' | 'failed';
  summary: Record<string, unknown>;
  totalTorrents: number;
  updatedAt: string;
};

export type Web_Backup_ExportImportPlan = {
  document: Web_Backup_Document;
  folderMappings: Record<string, string>;
  profileActions: Record<string, 'replace' | 'keep'>;
  source: 'transmission-vpn-export';
};

export type Web_Backup_TransmissionImportPlan = {
  configPath: string;
  folderMappings: Record<string, string>;
  profileActions: Record<string, 'replace' | 'keep'>;
  profileConnections: Record<string, string | null>;
  profileIncluded: Record<string, boolean>;
  profileNames: Record<string, string>;
  source: 'another-transmission';
};

export type Web_Backup_ImportPlan = Web_Backup_ExportImportPlan | Web_Backup_TransmissionImportPlan;

export type Web_Backup_SourceDirectory = {
  directories: Array<{
    hasSubfolders: boolean;
    name: string;
    path: string;
  }>;
  parentPath?: string | undefined;
  path: string;
};
