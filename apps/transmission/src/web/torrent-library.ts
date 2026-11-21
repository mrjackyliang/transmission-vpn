import { formatPercent } from '@/web/torrent-format.ts';

import type {
  Web_TorrentLibrary_BuildTorrentLabelSummaries_Labels,
  Web_TorrentLibrary_BuildTorrentLabelSummaries_NormalizedLabel,
  Web_TorrentLibrary_BuildTorrentLabelSummaries_Returns,
  Web_TorrentLibrary_BuildTorrentLabelSummaries_Summaries,
  Web_TorrentLibrary_BuildTorrentLabelSummaries_Summary,
  Web_TorrentLibrary_BuildTorrentLabelSummaries_Torrents,
  Web_TorrentLibrary_DefaultProfileFilterValue,
  Web_TorrentLibrary_DescribeTorrentState_Returns,
  Web_TorrentLibrary_DescribeTorrentState_Torrent,
  Web_TorrentLibrary_DescribeTrackerIssue_Returns,
  Web_TorrentLibrary_DescribeTrackerIssue_Torrent,
  Web_TorrentLibrary_DuplicateTorrentNotices_Connection,
  Web_TorrentLibrary_DuplicateTorrentNotices_ConnectionList,
  Web_TorrentLibrary_DuplicateTorrentNotices_ConnectionNames,
  Web_TorrentLibrary_DuplicateTorrentNotices_Connections,
  Web_TorrentLibrary_DuplicateTorrentNotices_DuplicatePrefix,
  Web_TorrentLibrary_DuplicateTorrentNotices_Errors,
  Web_TorrentLibrary_DuplicateTorrentNotices_FinalConnection,
  Web_TorrentLibrary_DuplicateTorrentNotices_FirstMatch,
  Web_TorrentLibrary_DuplicateTorrentNotices_Hash,
  Web_TorrentLibrary_DuplicateTorrentNotices_Matches,
  Web_TorrentLibrary_DuplicateTorrentNotices_MatchName,
  Web_TorrentLibrary_DuplicateTorrentNotices_Notices,
  Web_TorrentLibrary_DuplicateTorrentNotices_Returns,
  Web_TorrentLibrary_DuplicateTorrentNotices_SeenHashes,
  Web_TorrentLibrary_DuplicateTorrentNotices_Torrents,
  Web_TorrentLibrary_FinishedFilesLeftOut_LeftOutPhrase,
  Web_TorrentLibrary_FinishedFilesLeftOut_Reasons,
  Web_TorrentLibrary_FinishedFilesLeftOut_Returns,
  Web_TorrentLibrary_FinishedFilesLeftOut_Unavailable,
  Web_TorrentLibrary_FinishedFilesLeftOut_UnavailablePhrase,
  Web_TorrentLibrary_FinishedFilesLeftOut_Unfinished,
  Web_TorrentLibrary_FinishedFilesLeftOut_UnfinishedPhrase,
  Web_TorrentLibrary_SummarizeTorrentAddBatch_FailedCount,
  Web_TorrentLibrary_SummarizeTorrentAddBatch_FailedNoun,
  Web_TorrentLibrary_SummarizeTorrentAddBatch_Returns,
  Web_TorrentLibrary_SummarizeTorrentAddBatch_Statuses,
  Web_TorrentLibrary_SummarizeTorrentAddBatch_SuccessfulCount,
  Web_TorrentLibrary_SummarizeTorrentAddBatch_SuccessfulNoun,
  Web_TorrentLibrary_TorrentHasFinishedFiles_Returns,
  Web_TorrentLibrary_TorrentHasFinishedFiles_Torrent,
  Web_TorrentLibrary_TorrentLibraryFilters,
  Web_TorrentLibrary_TorrentMatchesFilter_Filter,
  Web_TorrentLibrary_TorrentMatchesFilter_Returns,
  Web_TorrentLibrary_TorrentMatchesFilter_Torrent,
  Web_TorrentLibrary_TorrentMatchesLibrarySelection_Returns,
  Web_TorrentLibrary_TorrentMatchesLibrarySelection_SelectedLabel,
  Web_TorrentLibrary_TorrentMatchesLibrarySelection_Selection,
  Web_TorrentLibrary_TorrentMatchesLibrarySelection_Torrent,
  Web_TorrentLibrary_TorrentProgress_Returns,
  Web_TorrentLibrary_TorrentProgress_Torrent,
  Web_TorrentLibrary_TorrentQueuePositionsAreComparable_FirstTorrent,
  Web_TorrentLibrary_TorrentQueuePositionsAreComparable_Returns,
  Web_TorrentLibrary_TorrentQueuePositionsAreComparable_Torrents,
} from '@/types/web/torrent-library.d.ts';

/**
 * Torrent Library - Torrent Library Filters.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const torrentLibraryFilters: Web_TorrentLibrary_TorrentLibraryFilters = [
  {
    icon: 'torrent',
    id: 'all',
    label: 'All torrents',
  },
  {
    icon: 'activity',
    id: 'active',
    label: 'Active',
  },
  {
    icon: 'download',
    id: 'downloading',
    label: 'Downloading',
  },
  {
    icon: 'upload',
    id: 'seeding',
    label: 'Seeding',
  },
  {
    icon: 'pause',
    id: 'paused',
    label: 'Paused',
  },
  {
    icon: 'warning',
    id: 'needs-profile',
    label: 'Needs a profile',
  },
  {
    icon: 'check',
    id: 'checking',
    label: 'Checking',
  },
  {
    icon: 'warning',
    id: 'warning',
    label: 'Warnings',
  },
  {
    icon: 'x',
    id: 'error',
    label: 'Errors',
  },
];

/**
 * Torrent Library - Default Profile Filter Value.
 *
 * Distinguishes the explicit Default choice from an inactive profile filter.
 * Generated profile identifiers cannot collide with this internal sentinel.
 *
 * @since 2.0.0
 */
export const defaultProfileFilterValue: Web_TorrentLibrary_DefaultProfileFilterValue = '__default-profile__';

/**
 * Torrent Library - Torrent Queue Positions Are Comparable.
 *
 * Queue positions are meaningful together only when every visible torrent belongs
 * to the same Transmission daemon.
 *
 * @param {Web_TorrentLibrary_TorrentQueuePositionsAreComparable_Torrents} torrents - Torrents.
 *
 * @returns {Web_TorrentLibrary_TorrentQueuePositionsAreComparable_Returns}
 *
 * @since 2.0.0
 */
export const torrentQueuePositionsAreComparable = (
  torrents: Web_TorrentLibrary_TorrentQueuePositionsAreComparable_Torrents,
): Web_TorrentLibrary_TorrentQueuePositionsAreComparable_Returns => {
  const firstTorrent: Web_TorrentLibrary_TorrentQueuePositionsAreComparable_FirstTorrent = torrents[0];

  if (torrents.length < 2 || firstTorrent === undefined) {
    return true;
  }

  return torrents.every(
    (torrent) => torrent['connectionId'] === firstTorrent['connectionId'],
  );
};

/**
 * Torrent Library - Summarize Torrent Add Batch.
 *
 * Names a completed batch by its actual outcome and includes successful and failed
 * counts when the result is mixed.
 *
 * @param {Web_TorrentLibrary_SummarizeTorrentAddBatch_Statuses} statuses - Statuses.
 *
 * @returns {Web_TorrentLibrary_SummarizeTorrentAddBatch_Returns}
 *
 * @since 2.0.0
 */
export const summarizeTorrentAddBatch = (
  statuses: Web_TorrentLibrary_SummarizeTorrentAddBatch_Statuses,
): Web_TorrentLibrary_SummarizeTorrentAddBatch_Returns => {
  const failedCount: Web_TorrentLibrary_SummarizeTorrentAddBatch_FailedCount = statuses.filter((status) => status === 'failed').length;
  const successfulCount: Web_TorrentLibrary_SummarizeTorrentAddBatch_SuccessfulCount = statuses.length - failedCount;

  if (failedCount === 0) {
    const successfulNoun: Web_TorrentLibrary_SummarizeTorrentAddBatch_SuccessfulNoun = (successfulCount === 1) ? 'torrent' : 'torrents';

    return {
      detail: `${successfulCount} ${successfulNoun} added.`,
      title: 'Torrents added',
    };
  }

  if (successfulCount === 0) {
    const failedNoun: Web_TorrentLibrary_SummarizeTorrentAddBatch_FailedNoun = (failedCount === 1) ? 'torrent' : 'torrents';

    return {
      detail: `${failedCount} ${failedNoun} failed.`,
      title: 'No torrents were added',
    };
  }

  return {
    detail: `${successfulCount} added · ${failedCount} failed.`,
    title: 'Some torrents weren\'t added',
  };
};

/**
 * Torrent Library - Duplicate Torrent Notices.
 *
 * Resolves duplicate hash event codes through the visible torrent and VPN data.
 * Missing relationships stay quiet so an internal hash or connection identifier
 * is never presented as a fallback label.
 *
 * @param {Web_TorrentLibrary_DuplicateTorrentNotices_Errors}      errors      - Errors.
 * @param {Web_TorrentLibrary_DuplicateTorrentNotices_Torrents}    torrents    - Torrents.
 * @param {Web_TorrentLibrary_DuplicateTorrentNotices_Connections} connections - Connections.
 *
 * @returns {Web_TorrentLibrary_DuplicateTorrentNotices_Returns}
 *
 * @since 2.0.0
 */
export const duplicateTorrentNotices = (
  errors: Web_TorrentLibrary_DuplicateTorrentNotices_Errors,
  torrents: Web_TorrentLibrary_DuplicateTorrentNotices_Torrents,
  connections: Web_TorrentLibrary_DuplicateTorrentNotices_Connections,
): Web_TorrentLibrary_DuplicateTorrentNotices_Returns => {
  const duplicatePrefix: Web_TorrentLibrary_DuplicateTorrentNotices_DuplicatePrefix = 'duplicate-torrent:';
  const seenHashes: Web_TorrentLibrary_DuplicateTorrentNotices_SeenHashes = new Set();
  const notices: Web_TorrentLibrary_DuplicateTorrentNotices_Notices = [];

  for (const error of errors) {
    if (error.startsWith(duplicatePrefix) === false) {
      continue;
    }

    const hash: Web_TorrentLibrary_DuplicateTorrentNotices_Hash = error.slice(duplicatePrefix.length).toLowerCase();

    if (hash === '' || seenHashes.has(hash) === true) {
      continue;
    }

    seenHashes.add(hash);

    const matches: Web_TorrentLibrary_DuplicateTorrentNotices_Matches = torrents.filter(
      (torrent) => torrent['hashString'].toLowerCase() === hash,
    );
    const connectionNames: Web_TorrentLibrary_DuplicateTorrentNotices_ConnectionNames = [...new Set(matches.map((torrent) => {
      const connection: Web_TorrentLibrary_DuplicateTorrentNotices_Connection = connections.find(
        (vpnConnection) => vpnConnection['id'] === torrent['connectionId'],
      );

      return (connection !== undefined) ? connection['name'] : undefined;
    }).filter((name) => name !== undefined))];

    if (matches.length === 0 || connectionNames.length < 2) {
      continue;
    }

    const finalConnection: Web_TorrentLibrary_DuplicateTorrentNotices_FinalConnection = connectionNames.at(-1) ?? '';
    let connectionList: Web_TorrentLibrary_DuplicateTorrentNotices_ConnectionList = `${connectionNames[0] ?? ''} and ${finalConnection}`;

    if (connectionNames.length > 2) {
      connectionList = `${connectionNames.slice(0, -1).join(', ')}, and ${finalConnection}`;
    }

    const firstMatch: Web_TorrentLibrary_DuplicateTorrentNotices_FirstMatch = matches[0];
    const matchName: Web_TorrentLibrary_DuplicateTorrentNotices_MatchName = (firstMatch !== undefined) ? firstMatch['name'] : 'Torrent';

    notices.push(`“${matchName}” appears on ${connectionList}.`);
  }

  return notices;
};

/**
 * Torrent Library - Torrent Matches Filter.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_TorrentLibrary_TorrentMatchesFilter_Torrent} torrent - Torrent.
 * @param {Web_TorrentLibrary_TorrentMatchesFilter_Filter}  filter  - Filter.
 *
 * @returns {Web_TorrentLibrary_TorrentMatchesFilter_Returns}
 *
 * @since 2.0.0
 */
export const torrentMatchesFilter = (
  torrent: Web_TorrentLibrary_TorrentMatchesFilter_Torrent,
  filter: Web_TorrentLibrary_TorrentMatchesFilter_Filter,
): Web_TorrentLibrary_TorrentMatchesFilter_Returns => {
  switch (filter) {
    case 'active': {
      return torrent['rateDownload'] > 0 || torrent['rateUpload'] > 0;
    }

    case 'checking': {
      return torrent['status'] === 1 || torrent['status'] === 2;
    }

    case 'downloading': {
      return torrent['status'] === 3 || torrent['status'] === 4;
    }

    case 'seeding': {
      return torrent['status'] === 5 || torrent['status'] === 6;
    }

    case 'paused': {
      return torrent['status'] === 0;
    }

    case 'needs-profile': {
      return torrent['needsProfile'] !== null;
    }

    // A tracker that isn't working is a warning, because the torrent itself hasn't failed.
    case 'warning': {
      return torrent['error'] === 1 || torrent['error'] === 2;
    }

    case 'error': {
      return torrent['error'] === 3;
    }

    default: {
      return true;
    }
  }
};

/**
 * Torrent Library - Build Torrent Label Summaries.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_TorrentLibrary_BuildTorrentLabelSummaries_Torrents} torrents - Torrents.
 * @param {Web_TorrentLibrary_BuildTorrentLabelSummaries_Labels}   [labels] - Labels.
 *
 * @returns {Web_TorrentLibrary_BuildTorrentLabelSummaries_Returns}
 *
 * @since 2.0.0
 */
export const buildTorrentLabelSummaries = (
  torrents: Web_TorrentLibrary_BuildTorrentLabelSummaries_Torrents,
  labels: Web_TorrentLibrary_BuildTorrentLabelSummaries_Labels = [],
): Web_TorrentLibrary_BuildTorrentLabelSummaries_Returns => {
  const summaries: Web_TorrentLibrary_BuildTorrentLabelSummaries_Summaries = new Map();

  for (const label of labels) {
    summaries.set(label.toLowerCase(), {
      count: 0,
      label,
      saved: true,
      size: 0,
    });
  }

  for (const torrent of torrents) {
    for (const label of torrent['labels']) {
      const normalizedLabel: Web_TorrentLibrary_BuildTorrentLabelSummaries_NormalizedLabel = label.toLowerCase();
      const summary: Web_TorrentLibrary_BuildTorrentLabelSummaries_Summary = summaries.get(normalizedLabel) ?? {
        count: 0,
        label,
        saved: false,
        size: 0,
      };

      Reflect.set(summary, 'count', summary['count'] + 1);

      Reflect.set(summary, 'size', summary['size'] + torrent['totalSize']);

      summaries.set(normalizedLabel, summary);
    }
  }

  return [...summaries.values()].sort((leftSummary, rightSummary) => (
    leftSummary['label'].localeCompare(rightSummary['label'], undefined, { sensitivity: 'base' })
  ));
};

/**
 * Torrent Library - Torrent Matches Library Selection.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_TorrentLibrary_TorrentMatchesLibrarySelection_Torrent}   torrent   - Torrent.
 * @param {Web_TorrentLibrary_TorrentMatchesLibrarySelection_Selection} selection - Selection.
 *
 * @returns {Web_TorrentLibrary_TorrentMatchesLibrarySelection_Returns}
 *
 * @since 2.0.0
 */
export const torrentMatchesLibrarySelection = (
  torrent: Web_TorrentLibrary_TorrentMatchesLibrarySelection_Torrent,
  selection: Web_TorrentLibrary_TorrentMatchesLibrarySelection_Selection,
): Web_TorrentLibrary_TorrentMatchesLibrarySelection_Returns => {
  if (selection['kind'] === 'status') {
    return torrentMatchesFilter(torrent, selection['value']);
  }

  if (selection['kind'] === 'label') {
    const selectedLabel: Web_TorrentLibrary_TorrentMatchesLibrarySelection_SelectedLabel = selection['value'].toLowerCase();

    return torrent['labels'].some((label) => label.toLowerCase() === selectedLabel);
  }

  if (selection['kind'] === 'profile') {
    return torrent['profileId'] === selection['value'];
  }

  if (selection['kind'] === 'connection') {
    return torrent['connectionId'] === selection['value'];
  }

  return false;
};

/**
 * Torrent Library - Describe Tracker Issue.
 *
 * Names a tracker's warning or error. A public torrent keeps finding peers through DHT and
 * peer exchange, so the row shows a short note and keeps the tracker's own reply, such as
 * "torrent not found", for the tooltip instead of letting it read like the torrent's state.
 *
 * @param {Web_TorrentLibrary_DescribeTrackerIssue_Torrent} torrent - Torrent.
 *
 * @returns {Web_TorrentLibrary_DescribeTrackerIssue_Returns}
 *
 * @since 2.0.0
 */
export const describeTrackerIssue = (torrent: Web_TorrentLibrary_DescribeTrackerIssue_Torrent): Web_TorrentLibrary_DescribeTrackerIssue_Returns => {
  if (torrent['error'] !== 1 && torrent['error'] !== 2) {
    return null;
  }

  return {
    label: (torrent['error'] === 1) ? 'Tracker warning' : 'Tracker not working',
    reply: (torrent['errorString'] === '') ? 'The tracker gave no reply.' : `The tracker replied “${torrent['errorString']}”.`,
  };
};

/**
 * Torrent Library - Torrent Progress.
 *
 * Returns the fraction a progress bar shows: how much of the check is done while
 * Transmission verifies the data, so the bar matches the Verifying label, and how
 * much is downloaded the rest of the time.
 *
 * @param {Web_TorrentLibrary_TorrentProgress_Torrent} torrent - Torrent.
 *
 * @returns {Web_TorrentLibrary_TorrentProgress_Returns}
 *
 * @since 2.1.0
 */
export const torrentProgress = (
  torrent: Web_TorrentLibrary_TorrentProgress_Torrent,
): Web_TorrentLibrary_TorrentProgress_Returns => ((torrent['status'] === 2) ? torrent['recheckProgress'] : torrent['percentDone']);

/**
 * Torrent Library - Torrent Has Finished Files.
 *
 * True once a torrent has its metadata and nothing left to download, which is when
 * its files can be downloaded to this computer. A torrent that skips every file has
 * nothing to send.
 *
 * @param {Web_TorrentLibrary_TorrentHasFinishedFiles_Torrent} torrent - Torrent.
 *
 * @returns {Web_TorrentLibrary_TorrentHasFinishedFiles_Returns}
 *
 * @since 2.2.0
 */
export const torrentHasFinishedFiles = (
  torrent: Web_TorrentLibrary_TorrentHasFinishedFiles_Torrent,
): Web_TorrentLibrary_TorrentHasFinishedFiles_Returns => (
  torrent['metadataPercentComplete'] >= 1
  && torrent['leftUntilDone'] === 0
  && torrent['sizeWhenDone'] > 0
);

/**
 * Torrent Library - Finished Files Left Out.
 *
 * Says how many selected torrents a download of finished files left out, and why:
 * still downloading, or files that couldn't be read. Empty when none were left out.
 *
 * @param {Web_TorrentLibrary_FinishedFilesLeftOut_Unfinished}  unfinished  - Unfinished.
 * @param {Web_TorrentLibrary_FinishedFilesLeftOut_Unavailable} unavailable - Unavailable.
 *
 * @returns {Web_TorrentLibrary_FinishedFilesLeftOut_Returns}
 *
 * @since 2.2.0
 */
export const finishedFilesLeftOut = (
  unfinished: Web_TorrentLibrary_FinishedFilesLeftOut_Unfinished,
  unavailable: Web_TorrentLibrary_FinishedFilesLeftOut_Unavailable,
): Web_TorrentLibrary_FinishedFilesLeftOut_Returns => {
  const reasons: Web_TorrentLibrary_FinishedFilesLeftOut_Reasons = [];

  if (unfinished > 0) {
    const unfinishedPhrase: Web_TorrentLibrary_FinishedFilesLeftOut_UnfinishedPhrase = (unfinished === 1) ? 'torrent hasn\'t' : 'torrents haven\'t';

    reasons.push(`${unfinished} ${unfinishedPhrase} finished downloading`);
  }

  if (unavailable > 0) {
    const unavailablePhrase: Web_TorrentLibrary_FinishedFilesLeftOut_UnavailablePhrase = (unavailable === 1) ? 'torrent\'s files couldn\'t' : 'torrents\' files couldn\'t';

    reasons.push(`${unavailable} ${unavailablePhrase} be read`);
  }

  if (reasons.length === 0) {
    return '';
  }

  const leftOutPhrase: Web_TorrentLibrary_FinishedFilesLeftOut_LeftOutPhrase = (unfinished + unavailable === 1) ? 'it was' : 'they were';

  return `${reasons.join(', and ')}, so ${leftOutPhrase} left out.`;
};

// Describes what a torrent is doing in words, plus the tone used for its dot and progress bar.

/**
 * Torrent Library - Describe Torrent State.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_TorrentLibrary_DescribeTorrentState_Torrent} torrent - Torrent.
 *
 * @returns {Web_TorrentLibrary_DescribeTorrentState_Returns}
 *
 * @since 2.0.0
 */
export const describeTorrentState = (
  torrent: Web_TorrentLibrary_DescribeTorrentState_Torrent,
): Web_TorrentLibrary_DescribeTorrentState_Returns => {
  // Only a local error, such as missing data or a full disk, stops the torrent itself.
  if (torrent['error'] === 3) {
    return {
      label: (torrent['errorString'] === '') ? 'Error' : torrent['errorString'],
      tone: 'error',
    };
  }

  switch (torrent['status']) {
    case 0: {
      return {
        label: (torrent['percentDone'] >= 1) ? 'Finished' : 'Paused',
        tone: 'paused',
      };
    }

    case 1: {
      return {
        label: 'Waiting to verify',
        tone: 'queued',
      };
    }

    case 2: {
      return {
        label: `Verifying ${formatPercent(torrentProgress(torrent))}`,
        tone: 'checking',
      };
    }

    case 3: {
      return {
        label: 'Waiting to download',
        tone: 'queued',
      };
    }

    case 4: {
      return {
        label: 'Downloading',
        tone: 'downloading',
      };
    }

    case 5: {
      return {
        label: 'Waiting to seed',
        tone: 'queued',
      };
    }

    case 6: {
      return {
        label: 'Seeding',
        tone: 'seeding',
      };
    }

    default: {
      return {
        label: 'Unknown',
        tone: 'paused',
      };
    }
  }
};
