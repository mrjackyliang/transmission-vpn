import { formatRelative } from '@/web/torrent-format.ts';

import type {
  Web_BlocklistStatus_FormatBlocklistCopyDate_Returns,
  Web_BlocklistStatus_FormatBlocklistCopyDate_Value,
  Web_BlocklistStatus_FormatBlocklistLastUpdated_Now,
  Web_BlocklistStatus_FormatBlocklistLastUpdated_Returns,
  Web_BlocklistStatus_FormatBlocklistLastUpdated_Status,
  Web_BlocklistStatus_FormatBlocklistNextUpdate_Now,
  Web_BlocklistStatus_FormatBlocklistNextUpdate_Returns,
  Web_BlocklistStatus_FormatBlocklistNextUpdate_Status,
  Web_BlocklistStatus_FormatBlocklistSourceLine_CopyDate,
  Web_BlocklistStatus_FormatBlocklistSourceLine_Enabled,
  Web_BlocklistStatus_FormatBlocklistSourceLine_ErrorText,
  Web_BlocklistStatus_FormatBlocklistSourceLine_FirstPendingIndex,
  Web_BlocklistStatus_FormatBlocklistSourceLine_MatchedSource,
  Web_BlocklistStatus_FormatBlocklistSourceLine_Now,
  Web_BlocklistStatus_FormatBlocklistSourceLine_RelativeTime,
  Web_BlocklistStatus_FormatBlocklistSourceLine_Returns,
  Web_BlocklistStatus_FormatBlocklistSourceLine_SeparatedErrorText,
  Web_BlocklistStatus_FormatBlocklistSourceLine_SourceIndex,
  Web_BlocklistStatus_FormatBlocklistSourceLine_SourceUrl,
  Web_BlocklistStatus_FormatBlocklistSourceLine_Status,
  Web_BlocklistStatus_FormatBlocklistSourceLine_Text,
  Web_BlocklistStatus_FormatBlocklistSourceLine_Tone,
  Web_BlocklistStatus_FormatBlocklistSummary_CurrentSource,
  Web_BlocklistStatus_FormatBlocklistSummary_FirstPendingIndex,
  Web_BlocklistStatus_FormatBlocklistSummary_RangeLabel,
  Web_BlocklistStatus_FormatBlocklistSummary_Returns,
  Web_BlocklistStatus_FormatBlocklistSummary_SourceCount,
  Web_BlocklistStatus_FormatBlocklistSummary_SourceLabel,
  Web_BlocklistStatus_FormatBlocklistSummary_Status,
} from '@/types/web/blocklist-status.d.ts';

/**
 * Blocklist Status - Format blocklist copy date.
 *
 * Keeps the last-good copy date compact enough for one source status line.
 * Invalid timestamps are omitted instead of presenting misleading recovery text.
 *
 * @param {Web_BlocklistStatus_FormatBlocklistCopyDate_Value} value - Value.
 *
 * @private
 *
 * @returns {Web_BlocklistStatus_FormatBlocklistCopyDate_Returns}
 *
 * @since UNRELEASED
 */
const formatBlocklistCopyDate = (
  value: Web_BlocklistStatus_FormatBlocklistCopyDate_Value,
): Web_BlocklistStatus_FormatBlocklistCopyDate_Returns => {
  const date: Date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
  }).format(date);
};

/**
 * Blocklist Status - Format blocklist last updated.
 *
 * Builds the optional successful-update detail below the aggregate summary.
 * Unknown and invalid timestamps stay absent from the Settings row.
 *
 * @param {Web_BlocklistStatus_FormatBlocklistLastUpdated_Status} status - Status.
 * @param {Web_BlocklistStatus_FormatBlocklistLastUpdated_Now}    now    - Now.
 *
 * @returns {Web_BlocklistStatus_FormatBlocklistLastUpdated_Returns}
 *
 * @since UNRELEASED
 */
export const formatBlocklistLastUpdated = (
  status: Web_BlocklistStatus_FormatBlocklistLastUpdated_Status,
  now: Web_BlocklistStatus_FormatBlocklistLastUpdated_Now = Date.now(),
): Web_BlocklistStatus_FormatBlocklistLastUpdated_Returns => {
  if (status['lastSuccessAt'] === null || status['lastSuccessAt'] === undefined) {
    return null;
  }

  const relativeTime: string = formatRelative(status['lastSuccessAt'], now);
  if (relativeTime === 'never' || relativeTime === 'unknown') {
    return null;
  }

  return `Last updated ${relativeTime}`;
};

/**
 * Blocklist Status - Format blocklist next update.
 *
 * Builds the optional scheduled-update detail below the aggregate summary.
 * States without a known schedule leave the line out entirely.
 *
 * @param {Web_BlocklistStatus_FormatBlocklistNextUpdate_Status} status - Status.
 * @param {Web_BlocklistStatus_FormatBlocklistNextUpdate_Now}    now    - Now.
 *
 * @returns {Web_BlocklistStatus_FormatBlocklistNextUpdate_Returns}
 *
 * @since UNRELEASED
 */
export const formatBlocklistNextUpdate = (
  status: Web_BlocklistStatus_FormatBlocklistNextUpdate_Status,
  now: Web_BlocklistStatus_FormatBlocklistNextUpdate_Now = Date.now(),
): Web_BlocklistStatus_FormatBlocklistNextUpdate_Returns => {
  if (status['nextUpdateAt'] === null || status['nextUpdateAt'] === undefined) {
    return null;
  }

  const relativeTime: string = formatRelative(status['nextUpdateAt'], now);
  if (relativeTime === 'never' || relativeTime === 'unknown') {
    return null;
  }

  return `Next update ${relativeTime}`;
};

/**
 * Blocklist Status - Format blocklist source line.
 *
 * Maps one saved URL to its current merger result while keeping unsaved rows blank.
 * During an update, the first pending source is active and later sources wait.
 *
 * @param {Web_BlocklistStatus_FormatBlocklistSourceLine_Status}    status    - Status.
 * @param {Web_BlocklistStatus_FormatBlocklistSourceLine_SourceUrl} sourceUrl - Source url.
 * @param {Web_BlocklistStatus_FormatBlocklistSourceLine_Enabled}   enabled   - Enabled.
 * @param {Web_BlocklistStatus_FormatBlocklistSourceLine_Now}       now       - Now.
 *
 * @returns {Web_BlocklistStatus_FormatBlocklistSourceLine_Returns}
 *
 * @since UNRELEASED
 */
export const formatBlocklistSourceLine = (
  status: Web_BlocklistStatus_FormatBlocklistSourceLine_Status,
  sourceUrl: Web_BlocklistStatus_FormatBlocklistSourceLine_SourceUrl,
  enabled: Web_BlocklistStatus_FormatBlocklistSourceLine_Enabled,
  now: Web_BlocklistStatus_FormatBlocklistSourceLine_Now = Date.now(),
): Web_BlocklistStatus_FormatBlocklistSourceLine_Returns => {
  const matchedSource: Web_BlocklistStatus_FormatBlocklistSourceLine_MatchedSource = status['sources'].find(
    (source): boolean => source['url'] === sourceUrl,
  );
  if (matchedSource === undefined) {
    return null;
  }

  let text: Web_BlocklistStatus_FormatBlocklistSourceLine_Text = '';
  let tone: Web_BlocklistStatus_FormatBlocklistSourceLine_Tone = 'default';

  if (status['state'] === 'updating' && matchedSource['state'] === 'pending') {
    const firstPendingIndex: Web_BlocklistStatus_FormatBlocklistSourceLine_FirstPendingIndex = status['sources'].findIndex(
      (source): boolean => source['state'] === 'pending',
    );
    const sourceIndex: Web_BlocklistStatus_FormatBlocklistSourceLine_SourceIndex = status['sources'].indexOf(matchedSource);

    if (sourceIndex === firstPendingIndex) {
      text = 'Downloading…';
      tone = 'active';
    } else {
      text = 'Waiting';
    }
  } else if (matchedSource['state'] === 'ok') {
    if (matchedSource['updatedAt'] === null || matchedSource['updatedAt'] === undefined) {
      text = `${matchedSource['ranges'].toLocaleString()} ranges`;
    } else {
      const relativeTime: Web_BlocklistStatus_FormatBlocklistSourceLine_RelativeTime = formatRelative(
        matchedSource['updatedAt'],
        now,
      );

      if (relativeTime === 'never' || relativeTime === 'unknown') {
        text = `${matchedSource['ranges'].toLocaleString()} ranges`;
      } else {
        text = `${matchedSource['ranges'].toLocaleString()} ranges · Updated ${relativeTime}`;
      }
    }
  } else if (matchedSource['state'] === 'pending') {
    text = 'Waiting for the first update';
  } else {
    const errorText: Web_BlocklistStatus_FormatBlocklistSourceLine_ErrorText = matchedSource['error'] ?? 'The source could not be updated.';

    text = errorText;
    tone = 'danger';

    if (matchedSource['copyFrom'] !== null && matchedSource['copyFrom'] !== undefined) {
      const copyDate: Web_BlocklistStatus_FormatBlocklistSourceLine_CopyDate = formatBlocklistCopyDate(matchedSource['copyFrom']);
      if (copyDate !== '') {
        const separatedErrorText: Web_BlocklistStatus_FormatBlocklistSourceLine_SeparatedErrorText = (
          errorText.endsWith('.')
          || errorText.endsWith('!')
          || errorText.endsWith('?')
        ) ? errorText : `${errorText}.`;

        text = `${separatedErrorText} Using the copy from ${copyDate}.`;
      }
    }
  }

  // Errors keep the danger tone even while blocklists are off; only plain results are muted.
  if (!enabled && tone !== 'danger') {
    tone = 'muted';
  }

  return {
    text,
    tone,
  };
};

/**
 * Blocklist Status - Format blocklist summary.
 *
 * Maps every merger state to the approved Settings copy.
 * Idle and updating summaries use the device locale for their counts.
 *
 * @param {Web_BlocklistStatus_FormatBlocklistSummary_Status} status - Status.
 *
 * @returns {Web_BlocklistStatus_FormatBlocklistSummary_Returns}
 *
 * @since UNRELEASED
 */
export const formatBlocklistSummary = (
  status: Web_BlocklistStatus_FormatBlocklistSummary_Status,
): Web_BlocklistStatus_FormatBlocklistSummary_Returns => {
  if (status['state'] === 'disabled') {
    return 'Turn on blocklists to download these sources.';
  }
  if (status['state'] === 'no-sources') {
    return 'Add a source to start blocking.';
  }
  if (status['state'] === 'waiting-for-vpn') {
    return 'Waiting for the VPN to update blocklists.';
  }

  const sourceCount: Web_BlocklistStatus_FormatBlocklistSummary_SourceCount = status['sources'].length;
  if (status['state'] === 'updating') {
    const firstPendingIndex: Web_BlocklistStatus_FormatBlocklistSummary_FirstPendingIndex = status['sources'].findIndex(
      (source): boolean => source['state'] === 'pending',
    );
    let currentSource: Web_BlocklistStatus_FormatBlocklistSummary_CurrentSource = sourceCount;
    if (firstPendingIndex !== -1) {
      currentSource = firstPendingIndex + 1;
    }

    return `Updating… ${currentSource.toLocaleString()} of ${sourceCount.toLocaleString()}`;
  }

  const rangeLabel: Web_BlocklistStatus_FormatBlocklistSummary_RangeLabel = (status['totalRanges'] === 1) ? 'address range' : 'address ranges';
  const sourceLabel: Web_BlocklistStatus_FormatBlocklistSummary_SourceLabel = (sourceCount === 1) ? 'source' : 'sources';

  return `Blocking ${status['totalRanges'].toLocaleString()} ${rangeLabel} from ${sourceCount.toLocaleString()} ${sourceLabel}.`;
};
