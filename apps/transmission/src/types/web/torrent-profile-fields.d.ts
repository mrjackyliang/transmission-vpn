import type { Web_Components_TorrentProfileDialog_Mode } from '@/types/web/components.d.ts';

/**
 * Torrent Profile Fields.
 *
 * @since 2.4.1
 */
export type Web_TorrentProfileFields_TorrentProfileDialogFields_Mode = Web_Components_TorrentProfileDialog_Mode;
export type Web_TorrentProfileFields_TorrentProfileDialogFields_Returns = Web_TorrentProfileFields_TorrentProfileField[];

/**
 * Torrent Profile Fields.
 *
 * @since 2.4.1
 */
export type Web_TorrentProfileFields_TorrentProfileField =
  | 'bandwidthPriority'
  | 'connectionId'
  | 'downloadDirectory'
  | 'downloadLimitKBps'
  | 'labels'
  | 'matchPatterns'
  | 'name'
  | 'peerLimit'
  | 'queue'
  | 'seeding'
  | 'startPaused'
  | 'uploadLimitKBps';
