import type {
  Web_TorrentMoveResult_TorrentMoveResultLabel_Result,
  Web_TorrentMoveResult_TorrentMoveResultLabel_Returns,
} from '@/types/web/torrent-move-result.d.ts';

/**
 * Torrent Move Result - Torrent Move Result Label.
 *
 * Names each profile move outcome consistently in single, batch, and profile
 * editor result lists. Failed moves prefer the backend's actionable error.
 *
 * @param {Web_TorrentMoveResult_TorrentMoveResultLabel_Result} result - Result.
 *
 * @returns {Web_TorrentMoveResult_TorrentMoveResultLabel_Returns}
 *
 * @since 2.0.0
 */
export const torrentMoveResultLabel = (result: Web_TorrentMoveResult_TorrentMoveResultLabel_Result): Web_TorrentMoveResult_TorrentMoveResultLabel_Returns => {
  if (result['result'] === 'moved') {
    return 'Moved';
  }
  if (result['result'] === 'already-there') {
    return 'Already there';
  }

  return result['error'] ?? 'Failed';
};
