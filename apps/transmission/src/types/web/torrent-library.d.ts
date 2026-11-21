import type {
  Web_Api_Torrent,
  Web_Api_VpnConnection,
} from '@/types/web/api.d.ts';
import type {
  Web_Components_TorrentFilter,
  Web_Components_TorrentFilterItem,
  Web_Components_TorrentLabelSummary,
  Web_Components_TorrentLibrarySelection,
  Web_Components_TorrentState,
  Web_Components_TrackerIssue,
} from '@/types/web/components.d.ts';

/**
 * Torrent Library.
 *
 * @since 2.4.1
 */
export type Web_TorrentLibrary_BuildTorrentLabelSummaries_Torrents = Web_Api_Torrent[];
export type Web_TorrentLibrary_BuildTorrentLabelSummaries_Labels = string[];
export type Web_TorrentLibrary_BuildTorrentLabelSummaries_Returns = Web_Components_TorrentLabelSummary[];
export type Web_TorrentLibrary_BuildTorrentLabelSummaries_Summaries = Map<string, Web_Components_TorrentLabelSummary>;
export type Web_TorrentLibrary_BuildTorrentLabelSummaries_NormalizedLabel = string;
export type Web_TorrentLibrary_BuildTorrentLabelSummaries_Summary = Web_Components_TorrentLabelSummary;

/**
 * Torrent Library.
 *
 * @since 2.4.1
 */
export type Web_TorrentLibrary_DefaultProfileFilterValue = string;

/**
 * Torrent Library.
 *
 * @since 2.4.1
 */
export type Web_TorrentLibrary_DescribeTorrentState_Torrent = Web_Api_Torrent;
export type Web_TorrentLibrary_DescribeTorrentState_Returns = Web_Components_TorrentState;

/**
 * Torrent Library.
 *
 * @since 2.4.1
 */
export type Web_TorrentLibrary_DescribeTrackerIssue_Torrent = Web_Api_Torrent;
export type Web_TorrentLibrary_DescribeTrackerIssue_Returns = Web_Components_TrackerIssue | null;

/**
 * Torrent Library.
 *
 * @since 2.4.1
 */
export type Web_TorrentLibrary_DuplicateTorrentNotices_Errors = string[];
export type Web_TorrentLibrary_DuplicateTorrentNotices_Torrents = Web_Api_Torrent[];
export type Web_TorrentLibrary_DuplicateTorrentNotices_Connections = Web_Api_VpnConnection[];
export type Web_TorrentLibrary_DuplicateTorrentNotices_Returns = string[];
export type Web_TorrentLibrary_DuplicateTorrentNotices_DuplicatePrefix = string;
export type Web_TorrentLibrary_DuplicateTorrentNotices_SeenHashes = Set<string>;
export type Web_TorrentLibrary_DuplicateTorrentNotices_Notices = string[];
export type Web_TorrentLibrary_DuplicateTorrentNotices_Hash = string;
export type Web_TorrentLibrary_DuplicateTorrentNotices_Matches = Web_Api_Torrent[];
export type Web_TorrentLibrary_DuplicateTorrentNotices_ConnectionNames = string[];
export type Web_TorrentLibrary_DuplicateTorrentNotices_Connection = Web_Api_VpnConnection | undefined;
export type Web_TorrentLibrary_DuplicateTorrentNotices_FinalConnection = string;
export type Web_TorrentLibrary_DuplicateTorrentNotices_ConnectionList = string;
export type Web_TorrentLibrary_DuplicateTorrentNotices_FirstMatch = Web_Api_Torrent | undefined;
export type Web_TorrentLibrary_DuplicateTorrentNotices_MatchName = string;

/**
 * Torrent Library.
 *
 * @since 2.4.1
 */
export type Web_TorrentLibrary_FinishedFilesLeftOut_Unfinished = number;
export type Web_TorrentLibrary_FinishedFilesLeftOut_Unavailable = number;
export type Web_TorrentLibrary_FinishedFilesLeftOut_Returns = string;
export type Web_TorrentLibrary_FinishedFilesLeftOut_Reasons = string[];
export type Web_TorrentLibrary_FinishedFilesLeftOut_UnfinishedPhrase = string;
export type Web_TorrentLibrary_FinishedFilesLeftOut_UnavailablePhrase = string;
export type Web_TorrentLibrary_FinishedFilesLeftOut_LeftOutPhrase = string;

/**
 * Torrent Library.
 *
 * @since 2.4.1
 */
export type Web_TorrentLibrary_SummarizeTorrentAddBatch_Status = 'added' | 'duplicate' | 'failed';
export type Web_TorrentLibrary_SummarizeTorrentAddBatch_Statuses = Web_TorrentLibrary_SummarizeTorrentAddBatch_Status[];
export type Web_TorrentLibrary_SummarizeTorrentAddBatch_Returns = {
  detail: string;
  title: string;
};
export type Web_TorrentLibrary_SummarizeTorrentAddBatch_FailedCount = number;
export type Web_TorrentLibrary_SummarizeTorrentAddBatch_SuccessfulCount = number;
export type Web_TorrentLibrary_SummarizeTorrentAddBatch_SuccessfulNoun = string;
export type Web_TorrentLibrary_SummarizeTorrentAddBatch_FailedNoun = string;

/**
 * Torrent Library.
 *
 * @since 2.4.1
 */
export type Web_TorrentLibrary_TorrentHasFinishedFiles_Torrent = Web_Api_Torrent;
export type Web_TorrentLibrary_TorrentHasFinishedFiles_Returns = boolean;

/**
 * Torrent Library.
 *
 * @since 2.4.1
 */
export type Web_TorrentLibrary_TorrentLibraryFilters = Web_Components_TorrentFilterItem[];

/**
 * Torrent Library.
 *
 * @since 2.4.1
 */
export type Web_TorrentLibrary_TorrentMatchesFilter_Torrent = Web_Api_Torrent;
export type Web_TorrentLibrary_TorrentMatchesFilter_Filter = Web_Components_TorrentFilter;
export type Web_TorrentLibrary_TorrentMatchesFilter_Returns = boolean;

/**
 * Torrent Library.
 *
 * @since 2.4.1
 */
export type Web_TorrentLibrary_TorrentMatchesLibrarySelection_Torrent = Web_Api_Torrent;
export type Web_TorrentLibrary_TorrentMatchesLibrarySelection_Selection = Web_Components_TorrentLibrarySelection;
export type Web_TorrentLibrary_TorrentMatchesLibrarySelection_Returns = boolean;
export type Web_TorrentLibrary_TorrentMatchesLibrarySelection_SelectedLabel = string;

/**
 * Torrent Library.
 *
 * @since 2.4.1
 */
export type Web_TorrentLibrary_TorrentProgress_Torrent = Web_Api_Torrent;
export type Web_TorrentLibrary_TorrentProgress_Returns = number;

/**
 * Torrent Library.
 *
 * @since 2.4.1
 */
export type Web_TorrentLibrary_TorrentQueuePositionsAreComparable_Torrents = Web_Api_Torrent[];
export type Web_TorrentLibrary_TorrentQueuePositionsAreComparable_Returns = boolean;
export type Web_TorrentLibrary_TorrentQueuePositionsAreComparable_FirstTorrent = Web_Api_Torrent | undefined;
