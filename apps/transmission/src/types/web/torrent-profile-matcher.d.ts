import type { Web_Api_TorrentProfile } from '@/types/web/api.d.ts';

/**
 * Torrent Profile Matcher.
 *
 * @since 2.4.1
 */
export type Web_TorrentProfileMatcher_DecodePathSegment_PathSegment = string;
export type Web_TorrentProfileMatcher_DecodePathSegment_Returns = string;

/**
 * Torrent Profile Matcher.
 *
 * @since 2.4.1
 */
export type Web_TorrentProfileMatcher_EscapeRegularExpressionCharacter_Character = string;
export type Web_TorrentProfileMatcher_EscapeRegularExpressionCharacter_Returns = string;

/**
 * Torrent Profile Matcher.
 *
 * @since 2.0.0
 */
export type Web_TorrentProfileMatcher_GlobState = {
  left: number;
  right: number;
};

/**
 * Torrent Profile Matcher.
 *
 * @since 2.4.1
 */
export type Web_TorrentProfileMatcher_MatchTorrentProfiles_TorrentName = string;
export type Web_TorrentProfileMatcher_MatchTorrentProfiles_Profiles = Web_Api_TorrentProfile[];
export type Web_TorrentProfileMatcher_MatchTorrentProfiles_Returns = Web_Api_TorrentProfile[];

/**
 * Torrent Profile Matcher.
 *
 * @since 2.4.1
 */
export type Web_TorrentProfileMatcher_TorrentNameFromFile_FileName = string;
export type Web_TorrentProfileMatcher_TorrentNameFromFile_Returns = string;

/**
 * Torrent Profile Matcher.
 *
 * @since 2.4.1
 */
export type Web_TorrentProfileMatcher_TorrentNameFromLink_Link = string;
export type Web_TorrentProfileMatcher_TorrentNameFromLink_PreviewName = string;
export type Web_TorrentProfileMatcher_TorrentNameFromLink_Returns = string;
export type Web_TorrentProfileMatcher_TorrentNameFromLink_ParsedLink = URL;
export type Web_TorrentProfileMatcher_TorrentNameFromLink_PathSegments = string[];

/**
 * Torrent Profile Matcher.
 *
 * @since 2.4.1
 */
export type Web_TorrentProfileMatcher_TorrentNameMatchesPattern_Name = string;
export type Web_TorrentProfileMatcher_TorrentNameMatchesPattern_Pattern = string;
export type Web_TorrentProfileMatcher_TorrentNameMatchesPattern_Returns = boolean;
export type Web_TorrentProfileMatcher_TorrentNameMatchesPattern_Expression = string;

/**
 * Torrent Profile Matcher.
 *
 * @since 2.4.1
 */
export type Web_TorrentProfileMatcher_TorrentPatternsOverlap_LeftPattern = string;
export type Web_TorrentProfileMatcher_TorrentPatternsOverlap_RightPattern = string;
export type Web_TorrentProfileMatcher_TorrentPatternsOverlap_Returns = boolean;
export type Web_TorrentProfileMatcher_TorrentPatternsOverlap_LeftRunes = string[];
export type Web_TorrentProfileMatcher_TorrentPatternsOverlap_RightRunes = string[];
export type Web_TorrentProfileMatcher_TorrentPatternsOverlap_Queue = Web_TorrentProfileMatcher_GlobState[];
export type Web_TorrentProfileMatcher_TorrentPatternsOverlap_Visited = Set<string>;
export type Web_TorrentProfileMatcher_TorrentPatternsOverlap_State = Web_TorrentProfileMatcher_GlobState | undefined;
export type Web_TorrentProfileMatcher_TorrentPatternsOverlap_StateKey = string;
export type Web_TorrentProfileMatcher_TorrentPatternsOverlap_LeftRune = string | undefined;
export type Web_TorrentProfileMatcher_TorrentPatternsOverlap_RightRune = string | undefined;
export type Web_TorrentProfileMatcher_TorrentPatternsOverlap_LeftStar = boolean;
export type Web_TorrentProfileMatcher_TorrentPatternsOverlap_RightStar = boolean;
export type Web_TorrentProfileMatcher_TorrentPatternsOverlap_NextState = Web_TorrentProfileMatcher_GlobState;
