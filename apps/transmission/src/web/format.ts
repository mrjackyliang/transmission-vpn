import type {
  Web_Format_Date_Returns,
  Web_Format_Date_Value,
  Web_Format_Duration_Returns,
  Web_Format_Duration_Seconds,
  Web_Format_KeepTogether_Phrase,
  Web_Format_KeepTogether_Returns,
  Web_Format_Relative_Now,
  Web_Format_Relative_Returns,
  Web_Format_Relative_Value,
} from '@/types/web/format.d.ts';

/**
 * Format - Format duration.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const formatDuration = (
  seconds: Web_Format_Duration_Seconds,
): Web_Format_Duration_Returns => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '—';
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
 * Format - Format date.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const formatDate = (
  value: Web_Format_Date_Value,
): Web_Format_Date_Returns => {
  if (value === null || value === undefined || value === '') {
    return 'Never';
  }

  const date: Date = new Date(value);
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
  value: Web_Format_Date_Value,
): Web_Format_Date_Returns => {
  if (value === null || value === undefined || value === '') {
    return 'never';
  }

  const date: Date = new Date(value);
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
  value: Web_Format_Relative_Value,
  now: Web_Format_Relative_Now = Date.now(),
): Web_Format_Relative_Returns => {
  if (value === null || value === undefined || value === '') {
    return 'never';
  }

  const timestamp: number = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return 'unknown';
  }

  const seconds: number = Math.round((now - timestamp) / 1000);
  if (seconds < 45) {
    return 'just now';
  }

  const formatter: Intl.RelativeTimeFormat = new Intl.RelativeTimeFormat(undefined, {
    numeric: 'auto',
  });
  const minutes: number = Math.round(seconds / 60);
  if (minutes < 60) {
    return formatter.format(-minutes, 'minute');
  }

  const hours: number = Math.round(minutes / 60);
  if (hours < 24) {
    return formatter.format(-hours, 'hour');
  }

  const days: number = Math.round(hours / 24);
  if (days < 30) {
    return formatter.format(-days, 'day');
  }

  return formatDate(value);
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
  phrase: Web_Format_KeepTogether_Phrase,
): Web_Format_KeepTogether_Returns => phrase.replaceAll(' ', '\u00A0');
