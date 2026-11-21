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

import type {
  Tests_Web_TorrentProfileMatcher_BroadProfile,
  Tests_Web_TorrentProfileMatcher_CreateProfile_Id,
  Tests_Web_TorrentProfileMatcher_CreateProfile_MatchPatterns,
  Tests_Web_TorrentProfileMatcher_CreateProfile_Name,
  Tests_Web_TorrentProfileMatcher_CreateProfile_Returns,
  Tests_Web_TorrentProfileMatcher_Expected,
  Tests_Web_TorrentProfileMatcher_GuessedName,
  Tests_Web_TorrentProfileMatcher_Left,
  Tests_Web_TorrentProfileMatcher_Link,
  Tests_Web_TorrentProfileMatcher_Name,
  Tests_Web_TorrentProfileMatcher_PreviewedName,
  Tests_Web_TorrentProfileMatcher_Profile,
  Tests_Web_TorrentProfileMatcher_Right,
  Tests_Web_TorrentProfileMatcher_SpecificProfile,
} from '../src/types/tests/web/torrent-profile-matcher.test.d.ts';

/**
 * Torrent Profile Matcher - Create Profile.
 *
 * Supplies stable defaults so each matcher example highlights only its patterns.
 *
 * @param {Tests_Web_TorrentProfileMatcher_CreateProfile_Id}            id            - Id.
 * @param {Tests_Web_TorrentProfileMatcher_CreateProfile_Name}          name          - Name.
 * @param {Tests_Web_TorrentProfileMatcher_CreateProfile_MatchPatterns} matchPatterns - Match patterns.
 *
 * @returns {Tests_Web_TorrentProfileMatcher_CreateProfile_Returns}
 *
 * @since 2.0.0
 */
const createProfile = (
  id: Tests_Web_TorrentProfileMatcher_CreateProfile_Id,
  name: Tests_Web_TorrentProfileMatcher_CreateProfile_Name,
  matchPatterns: Tests_Web_TorrentProfileMatcher_CreateProfile_MatchPatterns,
): Tests_Web_TorrentProfileMatcher_CreateProfile_Returns => ({
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

describe('torrent profile matcher', () => {
  it('matches case-insensitive complete-name globs with star and question mark', () => {
    expect(torrentNameMatchesPattern('The Show S01E03 1080p', '*s??e03*')).toBe(true);

    expect(torrentNameMatchesPattern('linux.iso', 'linux.?so')).toBe(true);

    expect(torrentNameMatchesPattern('linux.iso.extra', 'linux.?so')).toBe(false);

    expect(torrentNameMatchesPattern('literal[1]', 'literal[1]')).toBe(true);

    return;
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
  ])('decides overlap for %s', (_name: Tests_Web_TorrentProfileMatcher_Name, left: Tests_Web_TorrentProfileMatcher_Left, right: Tests_Web_TorrentProfileMatcher_Right, expected: Tests_Web_TorrentProfileMatcher_Expected) => {
    expect(torrentPatternsOverlap(left, right)).toBe(expected);

    return;
  });

  it('derives matching names from files, magnets, and remote URLs', () => {
    expect(torrentNameFromFile('Example.Release.TORRENT')).toBe('Example.Release');

    expect(torrentNameFromLink('magnet:?xt=urn:btih:abc&dn=The%20Show%20S01E01')).toBe('The Show S01E01');

    expect(torrentNameFromLink('https://example.test/torrents/Linux%20ISO.torrent?key=value')).toBe('Linux ISO.torrent');

    return;
  });

  it('returns every matching profile', () => {
    const broadProfile: Tests_Web_TorrentProfileMatcher_BroadProfile = createProfile('tpr-0000000000000001', 'Everything', ['*show*']);
    const specificProfile: Tests_Web_TorrentProfileMatcher_SpecificProfile = createProfile('tpr-0000000000000002', 'TV', ['*S??E??*']);

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

    return;
  });

  it('uses a previewed metainfo name for profile matching', () => {
    const profile: Tests_Web_TorrentProfileMatcher_Profile = createProfile('tpr-0000000000000003', 'Arch Linux', ['archlinux-*']);
    const link: Tests_Web_TorrentProfileMatcher_Link = 'https://archlinux.org/releng/releases/2026.11.01/torrent/';
    const guessedName: Tests_Web_TorrentProfileMatcher_GuessedName = torrentNameFromLink(link);
    const previewedName: Tests_Web_TorrentProfileMatcher_PreviewedName = torrentNameFromLink(
      link,
      'archlinux-2026.11.01-x86_64.iso',
    );

    expect(guessedName).toBe('torrent');

    expect(matchTorrentProfiles(guessedName, [profile])).toEqual([]);

    expect(matchTorrentProfiles(previewedName, [profile])).toEqual([profile]);

    return;
  });

  return;
});
