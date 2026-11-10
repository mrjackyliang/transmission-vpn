import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  matchTorrentProfiles,
  torrentNameFromFile,
  torrentNameFromLink,
  torrentNameMatchesPattern,
  torrentPatternsOverlap,
} from '../src/web/torrent-profile-matcher.ts';

import type { Web_Api_TorrentProfile } from '../src/types/web/api.d.ts';

/**
 * Torrent Profile Matcher Test - Creates profile.
 *
 * Supplies stable defaults so each matcher example highlights only its patterns.
 *
 * @since 2.0.0
 */
const createProfile = (
  id: string,
  name: string,
  matchPatterns: string[],
): Web_Api_TorrentProfile => ({
  connectionId: null,
  createdAt: '2026-01-01T00:00:00Z',
  downloadDirectory: '/data/downloads',
  id,
  labels: [],
  matchPatterns,
  name,
  options: {
    bandwidthPriority: 0,
    downloadLimitKBps: null,
    peerLimit: 50,
    queue: 'normal',
    seeding: {
      idleMinutes: null,
      mode: 'never',
      ratio: null,
    },
    uploadLimitKBps: null,
  },
  overlaps: [],
  startPaused: false,
  updatedAt: '2026-01-01T00:00:00Z',
});

describe('torrent profile matcher', (): void => {
  it('matches case-insensitive complete-name globs with star and question mark', (): void => {
    expect(torrentNameMatchesPattern('The Show S01E03 1080p', '*s??e03*')).toBe(true);
    expect(torrentNameMatchesPattern('linux.iso', 'linux.?so')).toBe(true);
    expect(torrentNameMatchesPattern('linux.iso.extra', 'linux.?so')).toBe(false);
    expect(torrentNameMatchesPattern('literal[1]', 'literal[1]')).toBe(true);
  });

  it.each([
    [
      'identical patterns',
      'Show.S01E*',
      'Show.S01E*',
      true,
    ],
    [
      'asterisk against anything',
      '*',
      'anything',
      true,
    ],
    [
      'question marks same length',
      'S??E??',
      'S01E?2',
      true,
    ],
    [
      'question marks different lengths',
      'a?',
      'a??',
      false,
    ],
    [
      'literal mismatch',
      'movie.mkv',
      'series.mkv',
      false,
    ],
    [
      'case insensitive',
      '*.MKV',
      'Movie.mkv',
      true,
    ],
    [
      'non-overlapping pair',
      '*.mkv',
      '*.mp4',
      false,
    ],
  ])('decides overlap for %s', (_name: string, left: string, right: string, expected: boolean): void => {
    expect(torrentPatternsOverlap(left, right)).toBe(expected);
  });

  it('derives matching names from files, magnets, and remote URLs', (): void => {
    expect(torrentNameFromFile('Example.Release.TORRENT')).toBe('Example.Release');
    expect(torrentNameFromLink('magnet:?xt=urn:btih:abc&dn=The%20Show%20S01E01')).toBe('The Show S01E01');
    expect(torrentNameFromLink('https://example.test/torrents/Linux%20ISO.torrent?key=value')).toBe('Linux ISO.torrent');
  });

  it('returns every matching profile', (): void => {
    const broadProfile = createProfile('tpr-0000000000000001', 'Everything', ['*show*']);
    const specificProfile = createProfile('tpr-0000000000000002', 'TV', ['*S??E??*']);

    expect(matchTorrentProfiles('The Show S01E02', [
      broadProfile,
      specificProfile,
    ])).toEqual([
      broadProfile,
      specificProfile,
    ]);
    expect(matchTorrentProfiles('Unmatched Linux Image', [
      broadProfile,
      specificProfile,
    ])).toEqual([]);
  });

  it('uses a previewed metainfo name for profile matching', (): void => {
    const profile = createProfile('tpr-0000000000000003', 'Arch Linux', ['archlinux-*']);
    const link = 'https://archlinux.org/releng/releases/2026.11.01/torrent/';
    const guessedName: string = torrentNameFromLink(link);
    const previewedName: string = torrentNameFromLink(
      link,
      'archlinux-2026.11.01-x86_64.iso',
    );

    expect(guessedName).toBe('torrent');
    expect(matchTorrentProfiles(guessedName, [profile])).toEqual([]);
    expect(matchTorrentProfiles(previewedName, [profile])).toEqual([profile]);
  });
});
