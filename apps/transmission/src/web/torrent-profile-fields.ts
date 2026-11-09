import type { Web_Components_TorrentProfileDialog_Mode } from '@/types/web/components.d.ts';

/**
 * Torrent Profile Fields - Editor field.
 *
 * Names every input that can be rendered by the shared profile editor.
 * Default and named modes select ordered subsets of this vocabulary.
 *
 * @since UNRELEASED
 */
export type TorrentProfileField
  = | 'bandwidthPriority'
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

/**
 * Torrent Profile Fields - Gets editor field set.
 *
 * Keeps the Default profile's reduced field set explicit and shared with the
 * editor render conditions. Named profiles add identity, VPN, and matching.
 *
 * @since UNRELEASED
 */
export const torrentProfileDialogFields = (
  mode: Web_Components_TorrentProfileDialog_Mode,
): TorrentProfileField[] => [
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
