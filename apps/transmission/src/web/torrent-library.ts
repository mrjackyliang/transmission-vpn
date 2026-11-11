import { formatPercent } from '@/web/torrent-format.ts';

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
 * Torrent Library - Torrent library filters.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const torrentLibraryFilters: Web_Components_TorrentFilterItem[] = [
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
 * Torrent Library - Default profile filter value.
 *
 * Distinguishes the explicit Default choice from an inactive profile filter.
 * Generated profile identifiers cannot collide with this internal sentinel.
 *
 * @since 2.0.0
 */
export const defaultProfileFilterValue: string = '__default-profile__';

/**
 * Torrent Library - Compare queue-position ownership.
 *
 * Queue positions are meaningful together only when every visible torrent belongs
 * to the same Transmission daemon.
 *
 * @param {Web_Api_Torrent[]} torrents - Torrents.
 *
 * @returns {boolean}
 *
 * @since 2.0.0
 */
export const torrentQueuePositionsAreComparable = (
  torrents: Web_Api_Torrent[],
): boolean => torrents.length < 2 || torrents.every(
  (torrent: Web_Api_Torrent): boolean => torrent['connectionId'] === torrents[0]?.['connectionId'],
);

/**
 * Torrent Library - Summarize add batch.
 *
 * Names a completed batch by its actual outcome and includes successful and failed
 * counts when the result is mixed.
 *
 * @since 2.0.0
 */
export const summarizeTorrentAddBatch = (
  statuses: ('added' | 'duplicate' | 'failed')[],
): {
  detail: string
  title: string
} => {
  const failedCount: number = statuses.filter((status): boolean => status === 'failed').length;
  const successfulCount: number = statuses.length - failedCount;
  if (failedCount === 0) {
    return {
      detail: `${successfulCount} ${(successfulCount === 1) ? 'torrent' : 'torrents'} added.`,
      title: 'Torrents added',
    };
  }
  if (successfulCount === 0) {
    return {
      detail: `${failedCount} ${(failedCount === 1) ? 'torrent' : 'torrents'} failed.`,
      title: 'No torrents were added',
    };
  }

  return {
    detail: `${successfulCount} added · ${failedCount} failed.`,
    title: 'Some torrents weren\'t added',
  };
};

/**
 * Torrent Library - Duplicate torrent notices.
 *
 * Resolves duplicate hash event codes through the visible torrent and VPN data.
 * Missing relationships stay quiet so an internal hash or connection identifier
 * is never presented as a fallback label.
 *
 * @since 2.0.0
 */
export const duplicateTorrentNotices = (
  errors: string[],
  torrents: Web_Api_Torrent[],
  connections: Web_Api_VpnConnection[],
): string[] => {
  const duplicatePrefix: string = 'duplicate-torrent:';
  const seenHashes: Set<string> = new Set<string>();
  const notices: string[] = [];

  for (const error of errors) {
    if (!error.startsWith(duplicatePrefix)) {
      continue;
    }
    const hash: string = error.slice(duplicatePrefix.length).toLowerCase();
    if (hash === '' || seenHashes.has(hash)) {
      continue;
    }
    seenHashes.add(hash);

    const matches: Web_Api_Torrent[] = torrents.filter(
      (torrent: Web_Api_Torrent): boolean => torrent['hashString'].toLowerCase() === hash,
    );
    const connectionNames: string[] = [...new Set(matches.map(
      (torrent: Web_Api_Torrent): string | undefined => connections.find(
        (connection: Web_Api_VpnConnection): boolean => connection['id'] === torrent['connectionId'],
      )?.['name'],
    ).filter((name: string | undefined): name is string => name !== undefined))];

    if (matches.length === 0 || connectionNames.length < 2) {
      continue;
    }
    const finalConnection: string = connectionNames.at(-1) ?? '';
    let connectionList: string = `${connectionNames[0] ?? ''} and ${finalConnection}`;
    if (connectionNames.length > 2) {
      connectionList = `${connectionNames.slice(0, -1).join(', ')}, and ${finalConnection}`;
    }

    notices.push(`“${matches[0]?.['name'] ?? 'Torrent'}” appears on ${connectionList}.`);
  }

  return notices;
};

/**
 * Torrent Library - Torrent matches filter.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const torrentMatchesFilter = (
  torrent: Web_Api_Torrent,
  filter: Web_Components_TorrentFilter,
): boolean => {
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
 * Torrent Library - Build torrent label summaries.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const buildTorrentLabelSummaries = (
  torrents: Web_Api_Torrent[],
  labels: string[] = [],
): Web_Components_TorrentLabelSummary[] => {
  const summaries: Map<string, Web_Components_TorrentLabelSummary> = new Map<string, Web_Components_TorrentLabelSummary>();
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
      const normalizedLabel: string = label.toLowerCase();
      const summary: Web_Components_TorrentLabelSummary = summaries.get(normalizedLabel) ?? {
        count: 0,
        label,
        saved: false,
        size: 0,
      };
      summary['count'] += 1;
      summary['size'] += torrent['totalSize'];
      summaries.set(normalizedLabel, summary);
    }
  }

  return [...summaries.values()].sort((leftSummary: Web_Components_TorrentLabelSummary, rightSummary: Web_Components_TorrentLabelSummary): number => (
    leftSummary['label'].localeCompare(rightSummary['label'], undefined, { sensitivity: 'base' })
  ));
};

/**
 * Torrent Library - Torrent matches library selection.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const torrentMatchesLibrarySelection = (
  torrent: Web_Api_Torrent,
  selection: Web_Components_TorrentLibrarySelection,
): boolean => {
  if (selection['kind'] === 'status') {
    return torrentMatchesFilter(torrent, selection['value']);
  }
  if (selection['kind'] === 'label') {
    const selectedLabel: string = selection['value'].toLowerCase();

    return torrent['labels'].some((label: string): boolean => label.toLowerCase() === selectedLabel);
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
 * Torrent Library - Describe tracker issue.
 *
 * Names a tracker's warning or error. A public torrent keeps finding peers through DHT and
 * peer exchange, so the row shows a short note and keeps the tracker's own reply, such as
 * "torrent not found", for the tooltip instead of letting it read like the torrent's state.
 *
 * @since 2.0.0
 */
export const describeTrackerIssue = (torrent: Web_Api_Torrent): Web_Components_TrackerIssue | null => {
  if (torrent['error'] !== 1 && torrent['error'] !== 2) {
    return null;
  }

  return {
    label: (torrent['error'] === 1) ? 'Tracker warning' : 'Tracker not working',
    reply: (torrent['errorString'] === '') ? 'The tracker gave no reply.' : `The tracker replied “${torrent['errorString']}”.`,
  };
};

/**
 * Torrent Library - Torrent progress.
 *
 * Returns the fraction a progress bar shows: how much of the check is done while
 * Transmission verifies the data, so the bar matches the Verifying label, and how
 * much is downloaded the rest of the time.
 *
 * @since 2.1.0
 */
export const torrentProgress = (
  torrent: Web_Api_Torrent,
): number => ((torrent['status'] === 2) ? torrent['recheckProgress'] : torrent['percentDone']);

// Describes what a torrent is doing in words, plus the tone used for its dot and progress bar.

/**
 * Torrent Library - Describe torrent state.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const describeTorrentState = (
  torrent: Web_Api_Torrent,
): Web_Components_TorrentState => {
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
