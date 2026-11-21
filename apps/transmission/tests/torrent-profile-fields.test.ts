import {
  describe,
  expect,
  it,
} from 'vitest';

import { torrentProfileDialogFields } from '../src/web/torrent-profile-fields.ts';

import type { Tests_Web_TorrentProfileFields_Fields } from '../src/types/tests/web/torrent-profile-fields.test.d.ts';

describe('torrent profile editor fields', () => {
  it('uses the reduced Default profile field set', () => {
    expect(torrentProfileDialogFields('default')).toEqual([
      'name',
      'downloadDirectory',
      'labels',
      'startPaused',
      'seeding',
      'downloadLimitKBps',
      'uploadLimitKBps',
      'bandwidthPriority',
      'peerLimit',
      'queue',
    ]);

    return;
  });

  it('adds named-profile identity, VPN, and matching fields', () => {
    const fields: Tests_Web_TorrentProfileFields_Fields = torrentProfileDialogFields('edit');

    expect(fields).toContain('name');

    expect(fields).toContain('connectionId');

    expect(fields).toContain('matchPatterns');

    return;
  });

  return;
});
