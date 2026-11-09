import type {
  Web_TorrentFormat_Bytes_Returns,
  Web_TorrentFormat_Bytes_Value,
  Web_TorrentFormat_Date_Returns,
  Web_TorrentFormat_Date_Value,
  Web_TorrentFormat_Duration_Returns,
  Web_TorrentFormat_Duration_Seconds,
  Web_TorrentFormat_Elapsed_Now,
  Web_TorrentFormat_Elapsed_Returns,
  Web_TorrentFormat_Elapsed_Value,
  Web_TorrentFormat_KeepTogether_Phrase,
  Web_TorrentFormat_KeepTogether_Returns,
  Web_TorrentFormat_Percent_Returns,
  Web_TorrentFormat_Percent_Value,
  Web_TorrentFormat_Rate_Returns,
  Web_TorrentFormat_Rate_Value,
  Web_TorrentFormat_Ratio_Returns,
  Web_TorrentFormat_Ratio_Value,
  Web_TorrentFormat_Relative_Now,
  Web_TorrentFormat_Relative_Returns,
  Web_TorrentFormat_Relative_Value,
  Web_TorrentFormat_TorrentStatus_Returns,
  Web_TorrentFormat_TorrentStatus_Status,
} from '@/types/web/torrent-format.d.ts';

/**
 * Format - Byte units.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const byteUnits: string[] = [
  'B',
  'KB',
  'MB',
  'GB',
  'TB',
  'PB',
];

/**
 * Format - Format bytes.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const formatBytes = (
  value: Web_TorrentFormat_Bytes_Value,
): Web_TorrentFormat_Bytes_Returns => {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B';
  }

  const unitIndex: number = Math.max(0, Math.min(
    Math.floor(Math.log(value) / Math.log(1000)),
    byteUnits.length - 1,
  ));
  const scaledValue: number = value / (1000 ** unitIndex);
  const precision: number = (scaledValue >= 100 || unitIndex === 0) ? 0 : 1;

  return `${scaledValue.toFixed(precision)} ${byteUnits[unitIndex]}`;
};

/**
 * Format - Format rate.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const formatRate = (
  value: Web_TorrentFormat_Rate_Value,
): Web_TorrentFormat_Rate_Returns => `${formatBytes(value)}/s`;

/**
 * Format - Format duration.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const formatDuration = (
  seconds: Web_TorrentFormat_Duration_Seconds,
): Web_TorrentFormat_Duration_Returns => {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds >= 2_147_483_647) {
    return '∞';
  }
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const minutes: number = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours: number = Math.floor(minutes / 60);
  const remainingMinutes: number = minutes % 60;
  if (hours < 24) {
    return `${hours}h ${remainingMinutes}m`;
  }

  const days: number = Math.floor(hours / 24);
  const remainingHours: number = hours % 24;

  return `${days}d ${remainingHours}h`;
};

/**
 * Format - Format ratio.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const formatRatio = (
  value: Web_TorrentFormat_Ratio_Value,
): Web_TorrentFormat_Ratio_Returns => {
  if (!Number.isFinite(value) || value < 0) {
    return '—';
  }

  return value.toFixed((value >= 100) ? 0 : 2);
};

/**
 * Format - Format percent.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const formatPercent = (
  value: Web_TorrentFormat_Percent_Value,
): Web_TorrentFormat_Percent_Returns => `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

/**
 * Format - Format torrent status.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const formatTorrentStatus = (
  status: Web_TorrentFormat_TorrentStatus_Status,
): Web_TorrentFormat_TorrentStatus_Returns => {
  const labels: Record<number, string> = {
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
 * Format - Format date.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const formatDate = (
  value: Web_TorrentFormat_Date_Value,
): Web_TorrentFormat_Date_Returns => {
  if (value === null || value === undefined || value === 0 || value === '') {
    return 'Never';
  }

  const date: Date = (typeof value === 'number') ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

// formatShortDate shows a date without the time, for lists where space is tight.

/**
 * Format - Format short date.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const formatShortDate = (
  value: Web_TorrentFormat_Date_Value,
): Web_TorrentFormat_Date_Returns => {
  if (value === null || value === undefined || value === 0 || value === '') {
    return 'never';
  }

  const date: Date = (typeof value === 'number') ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'unknown';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(date);
};

// formatRelative says how long ago something happened, in the largest whole unit.

/**
 * Format - Format relative.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const formatRelative = (
  value: Web_TorrentFormat_Relative_Value,
  now: Web_TorrentFormat_Relative_Now = Date.now(),
): Web_TorrentFormat_Relative_Returns => {
  if (value === null || value === undefined || value === '') {
    return 'never';
  }

  const timestamp: number = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return 'unknown';
  }

  const seconds: number = Math.round((now - timestamp) / 1000);
  if (Math.abs(seconds) < 45) {
    return 'just now';
  }

  const formatter: Intl.RelativeTimeFormat = new Intl.RelativeTimeFormat(undefined, {
    numeric: 'always',
  });
  const minutes: number = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) {
    return formatter.format(-minutes, 'minute');
  }

  const hours: number = Math.round(minutes / 60);
  if (Math.abs(hours) <= 24) {
    return formatter.format(-hours, 'hour');
  }

  const days: number = Math.round(hours / 24);
  if (Math.abs(days) < 30) {
    return formatter.format(-days, 'day');
  }

  return formatDate(value);
};

// formatElapsed is formatRelative with seconds, for values that change every few seconds, such as
// a WireGuard handshake.

/**
 * Format - Format elapsed.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const formatElapsed = (
  value: Web_TorrentFormat_Elapsed_Value,
  now: Web_TorrentFormat_Elapsed_Now = Date.now(),
): Web_TorrentFormat_Elapsed_Returns => {
  if (value === null || value === undefined || value === '') {
    return 'never';
  }

  const timestamp: number = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return 'unknown';
  }

  const seconds: number = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds >= 60) {
    return formatRelative(value, now);
  }

  return new Intl.RelativeTimeFormat(undefined, {
    numeric: 'auto',
  }).format(-seconds, 'second');
};

// keepTogether swaps a phrase's spaces for no-break spaces, so a wrapping line never splits it.

/**
 * Format - Keep together.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const keepTogether = (
  phrase: Web_TorrentFormat_KeepTogether_Phrase,
): Web_TorrentFormat_KeepTogether_Returns => phrase.replaceAll(' ', '\u00A0');
