import type { Web_Api_TorrentProfile } from '@/types/web/api.d.ts';
import type { Web_TorrentProfileMatcher_GlobState } from '@/types/web/torrent-profile-matcher.d.ts';

/**
 * Torrent Profile Matcher - Escapes regular-expression character.
 *
 * Converts a literal glob character without changing supported wildcards.
 * This keeps punctuation in profile patterns literal and safe.
 *
 * @since 2.0.0
 */
const escapeRegularExpressionCharacter = (character: string): string => (
  ('\\^$+.[\]{}()|'.includes(character)) ? `\\${character}` : character
);

/**
 * Torrent Profile Matcher - Checks name pattern.
 *
 * Matches a complete torrent name using case-insensitive `*` and `?` globs.
 * Anchoring prevents a partial substring from becoming an accidental match.
 *
 * @since 2.0.0
 */
export const torrentNameMatchesPattern = (name: string, pattern: string): boolean => {
  const expression: string = [...pattern].map((character: string): string => {
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
 * Torrent Profile Matcher - Checks pattern overlap.
 *
 * Walks the product of two finite glob automata. Asterisks have both an empty
 * transition and a consuming transition; memoized position pairs make the
 * intersection decision finite.
 *
 * @since 2.0.0
 */
export const torrentPatternsOverlap = (leftPattern: string, rightPattern: string): boolean => {
  const leftRunes: string[] = [...leftPattern];
  const rightRunes: string[] = [...rightPattern];
  const queue: Web_TorrentProfileMatcher_GlobState[] = [{
    left: 0,
    right: 0,
  }];
  const visited: Set<string> = new Set<string>();

  while (queue.length > 0) {
    const state: Web_TorrentProfileMatcher_GlobState | undefined = queue.shift();
    if (state === undefined) {
      continue;
    }
    const stateKey: string = `${state.left}:${state.right}`;
    if (visited.has(stateKey)) {
      continue;
    }
    visited.add(stateKey);
    if (state.left === leftRunes.length && state.right === rightRunes.length) {
      return true;
    }

    const leftRune: string | undefined = leftRunes[state.left];
    const rightRune: string | undefined = rightRunes[state.right];
    const leftStar: boolean = leftRune === '*';
    const rightStar: boolean = rightRune === '*';
    if (leftStar) {
      queue.push({
        left: state.left + 1,
        right: state.right,
      });
    }
    if (rightStar) {
      queue.push({
        left: state.left,
        right: state.right + 1,
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
    const nextState: Web_TorrentProfileMatcher_GlobState = {
      left: (leftStar) ? state.left : state.left + 1,
      right: (rightStar) ? state.right : state.right + 1,
    };
    if (nextState.left !== state.left || nextState.right !== state.right) {
      queue.push(nextState);
    }
  }

  return false;
};

/**
 * Torrent Profile Matcher - Gets file torrent name.
 *
 * Removes the `.torrent` suffix used only by the metainfo container.
 * Extension matching is case-insensitive to reflect common file systems.
 *
 * @since 2.0.0
 */
export const torrentNameFromFile = (fileName: string): string => fileName.replace(/\.torrent$/iu, '');

/**
 * Torrent Profile Matcher - Decodes path segment.
 *
 * Keeps malformed remote path text usable instead of rejecting the whole link.
 * Valid percent-encoded segments are decoded for human-readable matching.
 *
 * @since 2.0.0
 */
const decodePathSegment = (pathSegment: string): string => {
  try {
    return decodeURIComponent(pathSegment);
  } catch {
    return pathSegment;
  }
};

/**
 * Torrent Profile Matcher - Gets link torrent name.
 *
 * Prefers a server-previewed metainfo name, then uses a magnet display name or
 * the final URL path segment. Invalid links remain visible as entered.
 *
 * @since 2.0.0
 */
export const torrentNameFromLink = (link: string, previewName?: string): string => {
  if (previewName !== undefined && previewName.trim() !== '') {
    return previewName;
  }

  try {
    const parsedLink: URL = new URL(link);
    if (parsedLink.protocol.toLowerCase() === 'magnet:') {
      return parsedLink.searchParams.get('dn') ?? 'Magnet link';
    }

    const pathSegments: string[] = parsedLink.pathname.split('/').filter(Boolean);

    return decodePathSegment(pathSegments.at(-1) ?? parsedLink.hostname);
  } catch {
    return link;
  }
};

/**
 * Torrent Profile Matcher - Matches torrent profiles.
 *
 * Returns every named profile whose supported glob matches the complete name.
 * Callers decide how to handle zero, one, or multiple matches.
 *
 * @since 2.0.0
 */
export const matchTorrentProfiles = (
  torrentName: string,
  profiles: Web_Api_TorrentProfile[],
): Web_Api_TorrentProfile[] => profiles.filter(
  (profile: Web_Api_TorrentProfile): boolean => (
    profile['matchPatterns'].some(
      (pattern: string): boolean => torrentNameMatchesPattern(torrentName, pattern),
    )
  ),
);
