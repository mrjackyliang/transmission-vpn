import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  describeTorrentProfileChange,
  remapSelectedTorrentIDs,
  torrentProfileRefreshID,
} from '../src/web/torrent-profile-change.ts';

import type { Web_Api_Torrent } from '../src/types/web/api.d.ts';

describe('torrent profile change hint', (): void => {
  it('always names the target folder', (): void => {
    expect(describeTorrentProfileChange(
      '/data/linux',
      'vpc-0123456789abcdef',
      'vpc-0123456789abcdef',
      'Toronto',
    )).toBe('Files move to /data/linux.');
  });

  it('also names the target connection when it changes', (): void => {
    expect(describeTorrentProfileChange(
      '/data/downloads/music',
      'vpc-0123456789abcdef',
      'vpc-fedcba9876543210',
      'Mullvad New York',
    )).toBe('Files move to /data/downloads/music. Moves to Mullvad New York.');
  });
});

describe('torrent profile identity handoff', (): void => {
  it('refreshes the new facade identifier after a successful connection move', (): void => {
    expect(torrentProfileRefreshID(12, 'ABC123', [{
      hash: 'abc123',
      id: 33_554_444,
      name: 'Moved torrent',
      result: 'moved',
    }])).toBe(33_554_444);
  });

  it('keeps the current identifier when a move fails', (): void => {
    expect(torrentProfileRefreshID(12, 'abc123', [{
      error: 'Target unavailable',
      hash: 'abc123',
      name: 'Moved torrent',
      result: 'failed',
    }])).toBe(12);
  });

  it('keeps a bulk selection on the same torrent after its facade identifier changes', (): void => {
    const movedTorrent = {
      hashString: 'abc123',
      id: 33_554_444,
    } as Web_Api_Torrent;

    expect(remapSelectedTorrentIDs(
      [12],
      new Map([[
        12,
        'ABC123',
      ]]),
      [movedTorrent],
    )).toEqual([33_554_444]);
  });
});
