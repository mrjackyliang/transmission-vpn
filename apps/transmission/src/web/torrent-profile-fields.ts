import type {
  Web_TorrentProfileFields_TorrentProfileDialogFields_Mode,
  Web_TorrentProfileFields_TorrentProfileDialogFields_Returns,
} from '@/types/web/torrent-profile-fields.d.ts';

/**
 * Torrent Profile Fields - Torrent Profile Dialog Fields.
 *
 * Keeps the Default profile's reduced field set explicit and shared with the
 * editor render conditions. Named profiles add identity, VPN, and matching.
 *
 * @param {Web_TorrentProfileFields_TorrentProfileDialogFields_Mode} mode - Mode.
 *
 * @returns {Web_TorrentProfileFields_TorrentProfileDialogFields_Returns}
 *
 * @since 2.0.0
 */
export const torrentProfileDialogFields = (mode: Web_TorrentProfileFields_TorrentProfileDialogFields_Mode): Web_TorrentProfileFields_TorrentProfileDialogFields_Returns => [
  'name',
  'downloadDirectory',
  'labels',
  'startPaused',
  ...((mode === 'default') ? [] : ['connectionId'] as const),
  'seeding',
  'downloadLimitKBps',
  'uploadLimitKBps',
  'bandwidthPriority',
  'peerLimit',
  'queue',
  ...((mode === 'default') ? [] : ['matchPatterns'] as const),
];
