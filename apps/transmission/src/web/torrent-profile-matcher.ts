import { torrentExtensionPattern } from '@/web/regex.js';

import type {
  Web_TorrentProfileMatcher_DecodePathSegment_PathSegment,
  Web_TorrentProfileMatcher_DecodePathSegment_Returns,
  Web_TorrentProfileMatcher_EscapeRegularExpressionCharacter_Character,
  Web_TorrentProfileMatcher_EscapeRegularExpressionCharacter_Returns,
  Web_TorrentProfileMatcher_MatchTorrentProfiles_Profiles,
  Web_TorrentProfileMatcher_MatchTorrentProfiles_Returns,
  Web_TorrentProfileMatcher_MatchTorrentProfiles_TorrentName,
  Web_TorrentProfileMatcher_TorrentNameFromFile_FileName,
  Web_TorrentProfileMatcher_TorrentNameFromFile_Returns,
  Web_TorrentProfileMatcher_TorrentNameFromLink_Link,
  Web_TorrentProfileMatcher_TorrentNameFromLink_ParsedLink,
  Web_TorrentProfileMatcher_TorrentNameFromLink_PathSegments,
  Web_TorrentProfileMatcher_TorrentNameFromLink_PreviewName,
  Web_TorrentProfileMatcher_TorrentNameFromLink_Returns,
  Web_TorrentProfileMatcher_TorrentNameMatchesPattern_Expression,
  Web_TorrentProfileMatcher_TorrentNameMatchesPattern_Name,
  Web_TorrentProfileMatcher_TorrentNameMatchesPattern_Pattern,
  Web_TorrentProfileMatcher_TorrentNameMatchesPattern_Returns,
  Web_TorrentProfileMatcher_TorrentPatternsOverlap_LeftPattern,
  Web_TorrentProfileMatcher_TorrentPatternsOverlap_LeftRune,
  Web_TorrentProfileMatcher_TorrentPatternsOverlap_LeftRunes,
  Web_TorrentProfileMatcher_TorrentPatternsOverlap_LeftStar,
  Web_TorrentProfileMatcher_TorrentPatternsOverlap_NextState,
  Web_TorrentProfileMatcher_TorrentPatternsOverlap_Queue,
  Web_TorrentProfileMatcher_TorrentPatternsOverlap_Returns,
  Web_TorrentProfileMatcher_TorrentPatternsOverlap_RightPattern,
  Web_TorrentProfileMatcher_TorrentPatternsOverlap_RightRune,
  Web_TorrentProfileMatcher_TorrentPatternsOverlap_RightRunes,
  Web_TorrentProfileMatcher_TorrentPatternsOverlap_RightStar,
  Web_TorrentProfileMatcher_TorrentPatternsOverlap_State,
  Web_TorrentProfileMatcher_TorrentPatternsOverlap_StateKey,
  Web_TorrentProfileMatcher_TorrentPatternsOverlap_Visited,
} from '@/types/web/torrent-profile-matcher.d.ts';

/**
 * Torrent Profile Matcher - Escape Regular Expression Character.
 *
 * Converts a literal glob character without changing supported wildcards.
 * This keeps punctuation in profile patterns literal and safe.
 *
 * @param {Web_TorrentProfileMatcher_EscapeRegularExpressionCharacter_Character} character - Character.
 *
 * @returns {Web_TorrentProfileMatcher_EscapeRegularExpressionCharacter_Returns}
 *
 * @since 2.0.0
 */
const escapeRegularExpressionCharacter = (character: Web_TorrentProfileMatcher_EscapeRegularExpressionCharacter_Character): Web_TorrentProfileMatcher_EscapeRegularExpressionCharacter_Returns => (
  ('\\^$+.[\]{}()|'.includes(character) === true) ? `\\${character}` : character
);

/**
 * Torrent Profile Matcher - Torrent Name Matches Pattern.
 *
 * Matches a complete torrent name using case-insensitive `*` and `?` globs.
 * Anchoring prevents a partial substring from becoming an accidental match.
 *
 * @param {Web_TorrentProfileMatcher_TorrentNameMatchesPattern_Name}    name    - Name.
 * @param {Web_TorrentProfileMatcher_TorrentNameMatchesPattern_Pattern} pattern - Pattern.
 *
 * @returns {Web_TorrentProfileMatcher_TorrentNameMatchesPattern_Returns}
 *
 * @since 2.0.0
 */
export const torrentNameMatchesPattern = (name: Web_TorrentProfileMatcher_TorrentNameMatchesPattern_Name, pattern: Web_TorrentProfileMatcher_TorrentNameMatchesPattern_Pattern): Web_TorrentProfileMatcher_TorrentNameMatchesPattern_Returns => {
  const expression: Web_TorrentProfileMatcher_TorrentNameMatchesPattern_Expression = [...pattern].map((character) => {
    if (character === '*') {
      return '.*';
    }

    if (character === '?') {
      return '.';
    }

    return escapeRegularExpressionCharacter(character);
  }).join('');

  return new RegExp(`^${expression}$`, 'iu').test(name);
};

/**
 * Torrent Profile Matcher - Torrent Patterns Overlap.
 *
 * Walks the product of two finite glob automata. Asterisks have both an empty
 * transition and a consuming transition; memoized position pairs make the
 * intersection decision finite.
 *
 * @param {Web_TorrentProfileMatcher_TorrentPatternsOverlap_LeftPattern}  leftPattern  - Left pattern.
 * @param {Web_TorrentProfileMatcher_TorrentPatternsOverlap_RightPattern} rightPattern - Right pattern.
 *
 * @returns {Web_TorrentProfileMatcher_TorrentPatternsOverlap_Returns}
 *
 * @since 2.0.0
 */
export const torrentPatternsOverlap = (leftPattern: Web_TorrentProfileMatcher_TorrentPatternsOverlap_LeftPattern, rightPattern: Web_TorrentProfileMatcher_TorrentPatternsOverlap_RightPattern): Web_TorrentProfileMatcher_TorrentPatternsOverlap_Returns => {
  const leftRunes: Web_TorrentProfileMatcher_TorrentPatternsOverlap_LeftRunes = [...leftPattern];
  const rightRunes: Web_TorrentProfileMatcher_TorrentPatternsOverlap_RightRunes = [...rightPattern];
  const queue: Web_TorrentProfileMatcher_TorrentPatternsOverlap_Queue = [{
    left: 0,
    right: 0,
  }];
  const visited: Web_TorrentProfileMatcher_TorrentPatternsOverlap_Visited = new Set();

  while (queue.length > 0) {
    const state: Web_TorrentProfileMatcher_TorrentPatternsOverlap_State = queue.shift();

    if (state === undefined) {
      continue;
    }

    const stateKey: Web_TorrentProfileMatcher_TorrentPatternsOverlap_StateKey = `${state['left']}:${state['right']}`;

    if (visited.has(stateKey) === true) {
      continue;
    }

    visited.add(stateKey);

    if (state['left'] === leftRunes.length && state['right'] === rightRunes.length) {
      return true;
    }

    const leftRune: Web_TorrentProfileMatcher_TorrentPatternsOverlap_LeftRune = leftRunes[state['left']];
    const rightRune: Web_TorrentProfileMatcher_TorrentPatternsOverlap_RightRune = rightRunes[state['right']];
    const leftStar: Web_TorrentProfileMatcher_TorrentPatternsOverlap_LeftStar = leftRune === '*';
    const rightStar: Web_TorrentProfileMatcher_TorrentPatternsOverlap_RightStar = rightRune === '*';

    if (leftStar === true) {
      queue.push({
        left: state['left'] + 1,
        right: state['right'],
      });
    }

    if (rightStar === true) {
      queue.push({
        left: state['left'],
        right: state['right'] + 1,
      });
    }

    if (leftRune === undefined || rightRune === undefined) {
      continue;
    }

    if (
      leftRune !== '*'
      && leftRune !== '?'
      && rightRune !== '*'
      && rightRune !== '?'
      && leftRune.toLocaleLowerCase() !== rightRune.toLocaleLowerCase()
    ) {
      continue;
    }

    const nextState: Web_TorrentProfileMatcher_TorrentPatternsOverlap_NextState = {
      left: (leftStar === true) ? state['left'] : state['left'] + 1,
      right: (rightStar === true) ? state['right'] : state['right'] + 1,
    };

    if (nextState['left'] !== state['left'] || nextState['right'] !== state['right']) {
      queue.push(nextState);
    }
  }

  return false;
};

/**
 * Torrent Profile Matcher - Torrent Name From File.
 *
 * Removes the `.torrent` suffix used only by the metainfo container.
 * Extension matching is case-insensitive to reflect common file systems.
 *
 * @param {Web_TorrentProfileMatcher_TorrentNameFromFile_FileName} fileName - File name.
 *
 * @returns {Web_TorrentProfileMatcher_TorrentNameFromFile_Returns}
 *
 * @since 2.0.0
 */
export const torrentNameFromFile = (fileName: Web_TorrentProfileMatcher_TorrentNameFromFile_FileName): Web_TorrentProfileMatcher_TorrentNameFromFile_Returns => fileName.replace(new RegExp(torrentExtensionPattern, 'iu'), '');

/**
 * Torrent Profile Matcher - Decode Path Segment.
 *
 * Keeps malformed remote path text usable instead of rejecting the whole link.
 * Valid percent-encoded segments are decoded for human-readable matching.
 *
 * @param {Web_TorrentProfileMatcher_DecodePathSegment_PathSegment} pathSegment - Path segment.
 *
 * @returns {Web_TorrentProfileMatcher_DecodePathSegment_Returns}
 *
 * @since 2.0.0
 */
const decodePathSegment = (pathSegment: Web_TorrentProfileMatcher_DecodePathSegment_PathSegment): Web_TorrentProfileMatcher_DecodePathSegment_Returns => {
  try {
    return decodeURIComponent(pathSegment);
  } catch {
    return pathSegment;
  }
};

/**
 * Torrent Profile Matcher - Torrent Name From Link.
 *
 * Prefers a server-previewed metainfo name, then uses a magnet display name or
 * the final URL path segment. Invalid links remain visible as entered.
 *
 * @param {Web_TorrentProfileMatcher_TorrentNameFromLink_Link}        link          - Link.
 * @param {Web_TorrentProfileMatcher_TorrentNameFromLink_PreviewName} [previewName] - Preview name.
 *
 * @returns {Web_TorrentProfileMatcher_TorrentNameFromLink_Returns}
 *
 * @since 2.0.0
 */
export const torrentNameFromLink = (link: Web_TorrentProfileMatcher_TorrentNameFromLink_Link, previewName?: Web_TorrentProfileMatcher_TorrentNameFromLink_PreviewName): Web_TorrentProfileMatcher_TorrentNameFromLink_Returns => {
  if (previewName !== undefined && previewName.trim() !== '') {
    return previewName;
  }

  try {
    const parsedLink: Web_TorrentProfileMatcher_TorrentNameFromLink_ParsedLink = new URL(link);

    if (parsedLink.protocol.toLowerCase() === 'magnet:') {
      return parsedLink.searchParams.get('dn') ?? 'Magnet link';
    }

    const pathSegments: Web_TorrentProfileMatcher_TorrentNameFromLink_PathSegments = parsedLink.pathname.split('/').filter(Boolean);

    return decodePathSegment(pathSegments.at(-1) ?? parsedLink.hostname);
  } catch {
    return link;
  }
};

/**
 * Torrent Profile Matcher - Match Torrent Profiles.
 *
 * Returns every named profile whose supported glob matches the complete name.
 * Callers decide how to handle zero, one, or multiple matches.
 *
 * @param {Web_TorrentProfileMatcher_MatchTorrentProfiles_TorrentName} torrentName - Torrent name.
 * @param {Web_TorrentProfileMatcher_MatchTorrentProfiles_Profiles}    profiles    - Profiles.
 *
 * @returns {Web_TorrentProfileMatcher_MatchTorrentProfiles_Returns}
 *
 * @since 2.0.0
 */
export const matchTorrentProfiles = (
  torrentName: Web_TorrentProfileMatcher_MatchTorrentProfiles_TorrentName,
  profiles: Web_TorrentProfileMatcher_MatchTorrentProfiles_Profiles,
): Web_TorrentProfileMatcher_MatchTorrentProfiles_Returns => profiles.filter(
  (profile) => profile['matchPatterns'].some(
    (pattern) => torrentNameMatchesPattern(torrentName, pattern),
  ),
);
