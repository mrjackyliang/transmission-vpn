import type {
  Web_Format_FormatDate_Date,
  Web_Format_FormatDate_Returns,
  Web_Format_FormatDate_Value,
  Web_Format_FormatDuration_Days,
  Web_Format_FormatDuration_Hours,
  Web_Format_FormatDuration_Minutes,
  Web_Format_FormatDuration_RemainingHours,
  Web_Format_FormatDuration_RemainingMinutes,
  Web_Format_FormatDuration_Returns,
  Web_Format_FormatDuration_Seconds,
  Web_Format_FormatRelative_Days,
  Web_Format_FormatRelative_Formatter,
  Web_Format_FormatRelative_Hours,
  Web_Format_FormatRelative_Minutes,
  Web_Format_FormatRelative_Now,
  Web_Format_FormatRelative_Returns,
  Web_Format_FormatRelative_Seconds,
  Web_Format_FormatRelative_Timestamp,
  Web_Format_FormatRelative_Value,
  Web_Format_FormatShortDate_Date,
  Web_Format_FormatShortDate_Returns,
  Web_Format_FormatShortDate_Value,
  Web_Format_KeepTogether_Phrase,
  Web_Format_KeepTogether_Returns,
} from '@/types/web/format.d.ts';

/**
 * Format - Duration.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_Format_FormatDuration_Seconds} seconds - Seconds.
 *
 * @returns {Web_Format_FormatDuration_Returns}
 *
 * @since 2.0.0
 */
export const formatDuration = (
  seconds: Web_Format_FormatDuration_Seconds,
): Web_Format_FormatDuration_Returns => {
  if (Number.isFinite(seconds) === false || seconds < 0) {
    return '—';
  }

  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const minutes: Web_Format_FormatDuration_Minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours: Web_Format_FormatDuration_Hours = Math.floor(minutes / 60);
  const remainingMinutes: Web_Format_FormatDuration_RemainingMinutes = minutes % 60;

  if (hours < 24) {
    return `${hours}h ${remainingMinutes}m`;
  }

  const days: Web_Format_FormatDuration_Days = Math.floor(hours / 24);
  const remainingHours: Web_Format_FormatDuration_RemainingHours = hours % 24;

  return `${days}d ${remainingHours}h`;
};

/**
 * Format - Date.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_Format_FormatDate_Value} value - Value.
 *
 * @returns {Web_Format_FormatDate_Returns}
 *
 * @since 2.0.0
 */
export const formatDate = (
  value: Web_Format_FormatDate_Value,
): Web_Format_FormatDate_Returns => {
  if (
    value === null
    || value === undefined
    || value === ''
  ) {
    return 'Never';
  }

  const date: Web_Format_FormatDate_Date = new Date(value);

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
 * Format - Short Date.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_Format_FormatShortDate_Value} value - Value.
 *
 * @returns {Web_Format_FormatShortDate_Returns}
 *
 * @since 2.0.0
 */
export const formatShortDate = (
  value: Web_Format_FormatShortDate_Value,
): Web_Format_FormatShortDate_Returns => {
  if (
    value === null
    || value === undefined
    || value === ''
  ) {
    return 'never';
  }

  const date: Web_Format_FormatShortDate_Date = new Date(value);

  if (Number.isNaN(date.getTime()) === true) {
    return 'unknown';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(date);
};

// formatRelative says how long ago something happened, in the largest whole unit.

/**
 * Format - Relative.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_Format_FormatRelative_Value} value - Value.
 * @param {Web_Format_FormatRelative_Now}   now   - Now.
 *
 * @returns {Web_Format_FormatRelative_Returns}
 *
 * @since 2.0.0
 */
export const formatRelative = (
  value: Web_Format_FormatRelative_Value,
  now: Web_Format_FormatRelative_Now = Date.now(),
): Web_Format_FormatRelative_Returns => {
  if (
    value === null
    || value === undefined
    || value === ''
  ) {
    return 'never';
  }

  const timestamp: Web_Format_FormatRelative_Timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp) === true) {
    return 'unknown';
  }

  const seconds: Web_Format_FormatRelative_Seconds = Math.round((now - timestamp) / 1000);

  if (seconds < 45) {
    return 'just now';
  }

  const formatter: Web_Format_FormatRelative_Formatter = new Intl.RelativeTimeFormat(undefined, {
    numeric: 'auto',
  });
  const minutes: Web_Format_FormatRelative_Minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return formatter.format(-minutes, 'minute');
  }

  const hours: Web_Format_FormatRelative_Hours = Math.round(minutes / 60);

  if (hours < 24) {
    return formatter.format(-hours, 'hour');
  }

  const days: Web_Format_FormatRelative_Days = Math.round(hours / 24);

  if (days < 30) {
    return formatter.format(-days, 'day');
  }

  return formatDate(value);
};

// keepTogether swaps a phrase's spaces for no-break spaces, so a wrapping line never splits it.

/**
 * Format - Keep Together.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_Format_KeepTogether_Phrase} phrase - Phrase.
 *
 * @returns {Web_Format_KeepTogether_Returns}
 *
 * @since 2.0.0
 */
export const keepTogether = (
  phrase: Web_Format_KeepTogether_Phrase,
): Web_Format_KeepTogether_Returns => phrase.replaceAll(' ', '\u00A0');
