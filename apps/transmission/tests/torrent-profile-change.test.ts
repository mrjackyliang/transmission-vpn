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

import type { Tests_Web_TorrentProfileChange_MovedTorrent } from '../src/types/tests/web/torrent-profile-change.test.d.ts';

describe('torrent profile change hint', () => {
  it('always names the target folder', () => {
    expect(describeTorrentProfileChange(
      '/data/linux',
      'vpc-0123456789abcdef',
      'vpc-0123456789abcdef',
      'Toronto',
    )).toBe('Files move to /data/linux.');

    return;
  });

  it('also names the target connection when it changes', () => {
    expect(describeTorrentProfileChange(
      '/data/downloads/music',
      'vpc-0123456789abcdef',
      'vpc-fedcba9876543210',
      'Mullvad New York',
    )).toBe('Files move to /data/downloads/music. Moves to Mullvad New York.');

    return;
  });

  return;
});

describe('torrent profile identity handoff', () => {
  it('refreshes the new facade identifier after a successful connection move', () => {
    expect(torrentProfileRefreshID(12, 'ABC123', [{
      hash: 'abc123',
      id: 33_554_444,
      name: 'Moved torrent',
      result: 'moved',
    }])).toBe(33_554_444);

    return;
  });

  it('keeps the current identifier when a move fails', () => {
    expect(torrentProfileRefreshID(12, 'abc123', [{
      error: 'Target unavailable',
      hash: 'abc123',
      name: 'Moved torrent',
      result: 'failed',
    }])).toBe(12);

    return;
  });

  it('keeps a bulk selection on the same torrent after its facade identifier changes', () => {
    const movedTorrent: Tests_Web_TorrentProfileChange_MovedTorrent = {
      hashString: 'abc123',
      id: 33_554_444,
    } as Tests_Web_TorrentProfileChange_MovedTorrent;

    expect(remapSelectedTorrentIDs(
      [12],
      new Map([[
        12,
        'ABC123',
      ]]),
      [movedTorrent],
    )).toEqual([33_554_444]);

    return;
  });

  return;
});
