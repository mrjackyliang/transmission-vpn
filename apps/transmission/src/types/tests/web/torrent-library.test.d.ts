import type {
  Web_Api_Torrent,
  Web_Api_VpnConnection,
} from '@/types/web/api.d.ts';

/**
 * Torrent Library.
 *
 * @since 2.4.1
 */
export type Tests_Web_TorrentLibrary_CheckingTorrent = Web_Api_Torrent;
export type Tests_Web_TorrentLibrary_DefaultProfileTorrent = Web_Api_Torrent;
export type Tests_Web_TorrentLibrary_DownloadingTorrent = Web_Api_Torrent;
export type Tests_Web_TorrentLibrary_ErrorTorrent = Web_Api_Torrent;
export type Tests_Web_TorrentLibrary_Finished = Web_Api_Torrent;
export type Tests_Web_TorrentLibrary_FirstTorrent = Web_Api_Torrent;
export type Tests_Web_TorrentLibrary_Hash = string;
export type Tests_Web_TorrentLibrary_LocalError = Web_Api_Torrent;
export type Tests_Web_TorrentLibrary_NewYorkTorrent = Web_Api_Torrent;
export type Tests_Web_TorrentLibrary_OrdinaryPausedTorrent = Web_Api_Torrent;
export type Tests_Web_TorrentLibrary_OtherConnectionTorrent = Web_Api_Torrent;
export type Tests_Web_TorrentLibrary_ProfiledTorrent = Web_Api_Torrent;
export type Tests_Web_TorrentLibrary_SameConnectionTorrent = Web_Api_Torrent;
export type Tests_Web_TorrentLibrary_TorontoTorrent = Web_Api_Torrent;
export type Tests_Web_TorrentLibrary_Torrents = Web_Api_Torrent[];
export type Tests_Web_TorrentLibrary_TrackerError = Web_Api_Torrent;
export type Tests_Web_TorrentLibrary_UnresolvedTorrent = Web_Api_Torrent;
export type Tests_Web_TorrentLibrary_VerifyingTorrent = Web_Api_Torrent;
export type Tests_Web_TorrentLibrary_WarningTorrent = Web_Api_Torrent;

/**
 * Torrent Library.
 *
 * @since 2.4.1
 */
export type Tests_Web_TorrentLibrary_CreateConnection_Id = string;
export type Tests_Web_TorrentLibrary_CreateConnection_Name = string;
export type Tests_Web_TorrentLibrary_CreateConnection_Slot = number;
export type Tests_Web_TorrentLibrary_CreateConnection_Returns = Web_Api_VpnConnection;

/**
 * Torrent Library.
 *
 * @since 2.4.1
 */
export type Tests_Web_TorrentLibrary_CreateTorrent_Identifier = number;
export type Tests_Web_TorrentLibrary_CreateTorrent_DownloadDirectory = string;
export type Tests_Web_TorrentLibrary_CreateTorrent_TotalSize = number;
export type Tests_Web_TorrentLibrary_CreateTorrent_Labels = string[];
export type Tests_Web_TorrentLibrary_CreateTorrent_Changes = Partial<Web_Api_Torrent>;
export type Tests_Web_TorrentLibrary_CreateTorrent_Returns = Web_Api_Torrent;
