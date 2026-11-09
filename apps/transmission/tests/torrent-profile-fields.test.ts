import {
  describe,
  expect,
  it,
} from 'vitest';

import { torrentProfileDialogFields } from '../src/web/torrent-profile-fields.ts';

describe('torrent profile editor fields', (): void => {
  it('uses the reduced Default profile field set', (): void => {
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
  });

  it('adds named-profile identity, VPN, and matching fields', (): void => {
    const fields = torrentProfileDialogFields('edit');

    expect(fields).toContain('name');
    expect(fields).toContain('connectionId');
    expect(fields).toContain('matchPatterns');
  });
});
