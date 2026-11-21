import type {
  Web_TorrentFormat_ByteUnits,
  Web_TorrentFormat_FormatBytes_Precision,
  Web_TorrentFormat_FormatBytes_Returns,
  Web_TorrentFormat_FormatBytes_ScaledValue,
  Web_TorrentFormat_FormatBytes_UnitIndex,
  Web_TorrentFormat_FormatBytes_Value,
  Web_TorrentFormat_FormatDate_Date,
  Web_TorrentFormat_FormatDate_Returns,
  Web_TorrentFormat_FormatDate_Value,
  Web_TorrentFormat_FormatDuration_Days,
  Web_TorrentFormat_FormatDuration_Hours,
  Web_TorrentFormat_FormatDuration_Minutes,
  Web_TorrentFormat_FormatDuration_RemainingHours,
  Web_TorrentFormat_FormatDuration_RemainingMinutes,
  Web_TorrentFormat_FormatDuration_Returns,
  Web_TorrentFormat_FormatDuration_Seconds,
  Web_TorrentFormat_FormatElapsed_Now,
  Web_TorrentFormat_FormatElapsed_Returns,
  Web_TorrentFormat_FormatElapsed_Seconds,
  Web_TorrentFormat_FormatElapsed_Timestamp,
  Web_TorrentFormat_FormatElapsed_Value,
  Web_TorrentFormat_FormatPercent_Returns,
  Web_TorrentFormat_FormatPercent_Value,
  Web_TorrentFormat_FormatRate_Returns,
  Web_TorrentFormat_FormatRate_Value,
  Web_TorrentFormat_FormatRatio_Returns,
  Web_TorrentFormat_FormatRatio_Value,
  Web_TorrentFormat_FormatRelative_Days,
  Web_TorrentFormat_FormatRelative_Formatter,
  Web_TorrentFormat_FormatRelative_Hours,
  Web_TorrentFormat_FormatRelative_Minutes,
  Web_TorrentFormat_FormatRelative_Now,
  Web_TorrentFormat_FormatRelative_Returns,
  Web_TorrentFormat_FormatRelative_Seconds,
  Web_TorrentFormat_FormatRelative_Timestamp,
  Web_TorrentFormat_FormatRelative_Value,
  Web_TorrentFormat_FormatShortDate_Date,
  Web_TorrentFormat_FormatShortDate_Returns,
  Web_TorrentFormat_FormatShortDate_Value,
  Web_TorrentFormat_FormatTorrentStatus_Labels,
  Web_TorrentFormat_FormatTorrentStatus_Returns,
  Web_TorrentFormat_FormatTorrentStatus_Status,
  Web_TorrentFormat_KeepTogether_Phrase,
  Web_TorrentFormat_KeepTogether_Returns,
} from '@/types/web/torrent-format.d.ts';

/**
 * Torrent Format - Byte Units.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const byteUnits: Web_TorrentFormat_ByteUnits = [
  'B',
  'KB',
  'MB',
  'GB',
  'TB',
  'PB',
];

/**
 * Torrent Format - Format Bytes.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_TorrentFormat_FormatBytes_Value} value - Value.
 *
 * @returns {Web_TorrentFormat_FormatBytes_Returns}
 *
 * @since 2.0.0
 */
export const formatBytes = (
  value: Web_TorrentFormat_FormatBytes_Value,
): Web_TorrentFormat_FormatBytes_Returns => {
  if (Number.isFinite(value) === false || value <= 0) {
    return '0 B';
  }

  const unitIndex: Web_TorrentFormat_FormatBytes_UnitIndex = Math.max(0, Math.min(
    Math.floor(Math.log(value) / Math.log(1000)),
    byteUnits.length - 1,
  ));
  const scaledValue: Web_TorrentFormat_FormatBytes_ScaledValue = value / (1000 ** unitIndex);
  const precision: Web_TorrentFormat_FormatBytes_Precision = (scaledValue >= 100 || unitIndex === 0) ? 0 : 1;

  return `${scaledValue.toFixed(precision)} ${byteUnits[unitIndex]}`;
};

/**
 * Torrent Format - Format Rate.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_TorrentFormat_FormatRate_Value} value - Value.
 *
 * @returns {Web_TorrentFormat_FormatRate_Returns}
 *
 * @since 2.0.0
 */
export const formatRate = (
  value: Web_TorrentFormat_FormatRate_Value,
): Web_TorrentFormat_FormatRate_Returns => `${formatBytes(value)}/s`;

/**
 * Torrent Format - Format Duration.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_TorrentFormat_FormatDuration_Seconds} seconds - Seconds.
 *
 * @returns {Web_TorrentFormat_FormatDuration_Returns}
 *
 * @since 2.0.0
 */
export const formatDuration = (
  seconds: Web_TorrentFormat_FormatDuration_Seconds,
): Web_TorrentFormat_FormatDuration_Returns => {
  if (
    Number.isFinite(seconds) === false
    || seconds < 0
    || seconds >= 2_147_483_647
  ) {
    return '∞';
  }
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const minutes: Web_TorrentFormat_FormatDuration_Minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours: Web_TorrentFormat_FormatDuration_Hours = Math.floor(minutes / 60);
  const remainingMinutes: Web_TorrentFormat_FormatDuration_RemainingMinutes = minutes % 60;
  if (hours < 24) {
    return `${hours}h ${remainingMinutes}m`;
  }

  const days: Web_TorrentFormat_FormatDuration_Days = Math.floor(hours / 24);
  const remainingHours: Web_TorrentFormat_FormatDuration_RemainingHours = hours % 24;

  return `${days}d ${remainingHours}h`;
};

/**
 * Torrent Format - Format Ratio.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_TorrentFormat_FormatRatio_Value} value - Value.
 *
 * @returns {Web_TorrentFormat_FormatRatio_Returns}
 *
 * @since 2.0.0
 */
export const formatRatio = (
  value: Web_TorrentFormat_FormatRatio_Value,
): Web_TorrentFormat_FormatRatio_Returns => {
  if (Number.isFinite(value) === false || value < 0) {
    return '—';
  }

  return value.toFixed((value >= 100) ? 0 : 2);
};

/**
 * Torrent Format - Format Percent.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_TorrentFormat_FormatPercent_Value} value - Value.
 *
 * @returns {Web_TorrentFormat_FormatPercent_Returns}
 *
 * @since 2.0.0
 */
export const formatPercent = (
  value: Web_TorrentFormat_FormatPercent_Value,
): Web_TorrentFormat_FormatPercent_Returns => `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

/**
 * Torrent Format - Format Torrent Status.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_TorrentFormat_FormatTorrentStatus_Status} status - Status.
 *
 * @returns {Web_TorrentFormat_FormatTorrentStatus_Returns}
 *
 * @since 2.0.0
 */
export const formatTorrentStatus = (
  status: Web_TorrentFormat_FormatTorrentStatus_Status,
): Web_TorrentFormat_FormatTorrentStatus_Returns => {
  const labels: Web_TorrentFormat_FormatTorrentStatus_Labels = {
    0: 'Paused',
    1: 'Queued to verify',
    2: 'Verifying',
    3: 'Queued to download',
    4: 'Downloading',
    5: 'Queued to seed',
    6: 'Seeding',
  };

  return labels[status] ?? 'Unknown';
};

/**
 * Torrent Format - Format Date.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_TorrentFormat_FormatDate_Value} value - Value.
 *
 * @returns {Web_TorrentFormat_FormatDate_Returns}
 *
 * @since 2.0.0
 */
export const formatDate = (
  value: Web_TorrentFormat_FormatDate_Value,
): Web_TorrentFormat_FormatDate_Returns => {
  if (
    value === null
    || value === undefined
    || value === 0
    || value === ''
  ) {
    return 'Never';
  }

  const date: Web_TorrentFormat_FormatDate_Date = (typeof value === 'number') ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime()) === true) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

// formatShortDate shows a date without the time, for lists where space is tight.

/**
 * Torrent Format - Format Short Date.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_TorrentFormat_FormatShortDate_Value} value - Value.
 *
 * @returns {Web_TorrentFormat_FormatShortDate_Returns}
 *
 * @since 2.0.0
 */
export const formatShortDate = (
  value: Web_TorrentFormat_FormatShortDate_Value,
): Web_TorrentFormat_FormatShortDate_Returns => {
  if (
    value === null
    || value === undefined
    || value === 0
    || value === ''
  ) {
    return 'never';
  }

  const date: Web_TorrentFormat_FormatShortDate_Date = (typeof value === 'number') ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime()) === true) {
    return 'unknown';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(date);
};

// formatRelative says how long ago something happened, in the largest whole unit.

/**
 * Torrent Format - Format Relative.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_TorrentFormat_FormatRelative_Value} value - Value.
 * @param {Web_TorrentFormat_FormatRelative_Now}   [now] - Now.
 *
 * @returns {Web_TorrentFormat_FormatRelative_Returns}
 *
 * @since 2.0.0
 */
export const formatRelative = (
  value: Web_TorrentFormat_FormatRelative_Value,
  now: Web_TorrentFormat_FormatRelative_Now = Date.now(),
): Web_TorrentFormat_FormatRelative_Returns => {
  if (
    value === null
    || value === undefined
    || value === ''
  ) {
    return 'never';
  }

  const timestamp: Web_TorrentFormat_FormatRelative_Timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp) === true) {
    return 'unknown';
  }

  const seconds: Web_TorrentFormat_FormatRelative_Seconds = Math.round((now - timestamp) / 1000);
  if (Math.abs(seconds) < 45) {
    return 'just now';
  }

  const formatter: Web_TorrentFormat_FormatRelative_Formatter = new Intl.RelativeTimeFormat(undefined, {
    numeric: 'always',
  });
  const minutes: Web_TorrentFormat_FormatRelative_Minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) {
    return formatter.format(-minutes, 'minute');
  }

  const hours: Web_TorrentFormat_FormatRelative_Hours = Math.round(minutes / 60);
  if (Math.abs(hours) <= 24) {
    return formatter.format(-hours, 'hour');
  }

  const days: Web_TorrentFormat_FormatRelative_Days = Math.round(hours / 24);
  if (Math.abs(days) < 30) {
    return formatter.format(-days, 'day');
  }

  return formatDate(value);
};

// formatElapsed is formatRelative with seconds, for values that change every few seconds, such as
// a WireGuard handshake.

/**
 * Torrent Format - Format Elapsed.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_TorrentFormat_FormatElapsed_Value} value - Value.
 * @param {Web_TorrentFormat_FormatElapsed_Now}   [now] - Now.
 *
 * @returns {Web_TorrentFormat_FormatElapsed_Returns}
 *
 * @since 2.0.0
 */
export const formatElapsed = (
  value: Web_TorrentFormat_FormatElapsed_Value,
  now: Web_TorrentFormat_FormatElapsed_Now = Date.now(),
): Web_TorrentFormat_FormatElapsed_Returns => {
  if (
    value === null
    || value === undefined
    || value === ''
  ) {
    return 'never';
  }

  const timestamp: Web_TorrentFormat_FormatElapsed_Timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp) === true) {
    return 'unknown';
  }

  const seconds: Web_TorrentFormat_FormatElapsed_Seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds >= 60) {
    return formatRelative(value, now);
  }

  return new Intl.RelativeTimeFormat(undefined, {
    numeric: 'auto',
  }).format(-seconds, 'second');
};

// keepTogether swaps a phrase's spaces for no-break spaces, so a wrapping line never splits it.

/**
 * Torrent Format - Keep Together.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_TorrentFormat_KeepTogether_Phrase} phrase - Phrase.
 *
 * @returns {Web_TorrentFormat_KeepTogether_Returns}
 *
 * @since 2.0.0
 */
export const keepTogether = (
  phrase: Web_TorrentFormat_KeepTogether_Phrase,
): Web_TorrentFormat_KeepTogether_Returns => phrase.replaceAll(' ', '\u00A0');
