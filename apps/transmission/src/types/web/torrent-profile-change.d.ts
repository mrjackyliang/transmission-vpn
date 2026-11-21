import type {
  Web_Api_MovedTorrent,
  Web_Api_Torrent,
} from '@/types/web/api.d.ts';

/**
 * Torrent Profile Change.
 *
 * @since 2.4.1
 */
export type Web_TorrentProfileChange_DescribeTorrentProfileChange_DownloadDirectory = string;
export type Web_TorrentProfileChange_DescribeTorrentProfileChange_CurrentConnectionId = string | undefined;
export type Web_TorrentProfileChange_DescribeTorrentProfileChange_TargetConnectionId = string | undefined;
export type Web_TorrentProfileChange_DescribeTorrentProfileChange_TargetConnectionName = string;
export type Web_TorrentProfileChange_DescribeTorrentProfileChange_Returns = string;
export type Web_TorrentProfileChange_DescribeTorrentProfileChange_FolderHint = string;

/**
 * Torrent Profile Change.
 *
 * @since 2.4.1
 */
export type Web_TorrentProfileChange_RemapSelectedTorrentIds_SelectedIds = number[];
export type Web_TorrentProfileChange_RemapSelectedTorrentIds_PreviousHashesById = ReadonlyMap<number, string>;
export type Web_TorrentProfileChange_RemapSelectedTorrentIds_Torrents = Web_Api_Torrent[];
export type Web_TorrentProfileChange_RemapSelectedTorrentIds_Returns = number[];
export type Web_TorrentProfileChange_RemapSelectedTorrentIds_NextIdsByHash = Map<string, number>;
export type Web_TorrentProfileChange_RemapSelectedTorrentIds_NextIds = number[];
export type Web_TorrentProfileChange_RemapSelectedTorrentIds_PreviousHash = string | undefined;

/**
 * Torrent Profile Change.
 *
 * @since 2.4.1
 */
export type Web_TorrentProfileChange_TorrentProfileRefreshId_CurrentId = number;
export type Web_TorrentProfileChange_TorrentProfileRefreshId_Hash = string;
export type Web_TorrentProfileChange_TorrentProfileRefreshId_Results = Web_Api_MovedTorrent[];
export type Web_TorrentProfileChange_TorrentProfileRefreshId_Returns = number;
export type Web_TorrentProfileChange_TorrentProfileRefreshId_MovedResult = Web_Api_MovedTorrent | undefined;
