import type { Web_Api_MovedTorrent } from '@/types/web/api.d.ts';

/**
 * Torrent Move Result - Gets status label.
 *
 * Names each profile move outcome consistently in single, batch, and profile
 * editor result lists. Failed moves prefer the backend's actionable error.
 *
 * @since UNRELEASED
 */
export const torrentMoveResultLabel = (result: Web_Api_MovedTorrent): string => {
  if (result['result'] === 'moved') {
    return 'Moved';
  }
  if (result['result'] === 'already-there') {
    return 'Already there';
  }

  return result['error'] ?? 'Failed';
};
