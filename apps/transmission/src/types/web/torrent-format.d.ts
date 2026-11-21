/**
 * Torrent Format.
 *
 * @since 2.4.1
 */
export type Web_TorrentFormat_ByteUnits = string[];

/**
 * Torrent Format.
 *
 * @since 2.0.0
 */
export type Web_TorrentFormat_FormatBytes_Value = number;
export type Web_TorrentFormat_FormatBytes_Returns = string;
export type Web_TorrentFormat_FormatBytes_UnitIndex = number;
export type Web_TorrentFormat_FormatBytes_ScaledValue = number;
export type Web_TorrentFormat_FormatBytes_Precision = number;

/**
 * Torrent Format.
 *
 * @since 2.0.0
 */
export type Web_TorrentFormat_FormatDate_Value = number | string | null | undefined;
export type Web_TorrentFormat_FormatDate_Returns = string;
export type Web_TorrentFormat_FormatDate_Date = Date;

/**
 * Torrent Format.
 *
 * @since 2.0.0
 */
export type Web_TorrentFormat_FormatDuration_Seconds = number;
export type Web_TorrentFormat_FormatDuration_Returns = string;
export type Web_TorrentFormat_FormatDuration_Minutes = number;
export type Web_TorrentFormat_FormatDuration_Hours = number;
export type Web_TorrentFormat_FormatDuration_RemainingMinutes = number;
export type Web_TorrentFormat_FormatDuration_Days = number;
export type Web_TorrentFormat_FormatDuration_RemainingHours = number;

/**
 * Torrent Format.
 *
 * @since 2.0.0
 */
export type Web_TorrentFormat_FormatElapsed_Value = string | null | undefined;
export type Web_TorrentFormat_FormatElapsed_Now = number;
export type Web_TorrentFormat_FormatElapsed_Returns = string;
export type Web_TorrentFormat_FormatElapsed_Timestamp = number;
export type Web_TorrentFormat_FormatElapsed_Seconds = number;

/**
 * Torrent Format.
 *
 * @since 2.0.0
 */
export type Web_TorrentFormat_FormatPercent_Value = number;
export type Web_TorrentFormat_FormatPercent_Returns = string;

/**
 * Torrent Format.
 *
 * @since 2.0.0
 */
export type Web_TorrentFormat_FormatRate_Value = number;
export type Web_TorrentFormat_FormatRate_Returns = string;

/**
 * Torrent Format.
 *
 * @since 2.0.0
 */
export type Web_TorrentFormat_FormatRatio_Value = number;
export type Web_TorrentFormat_FormatRatio_Returns = string;

/**
 * Torrent Format.
 *
 * @since 2.0.0
 */
export type Web_TorrentFormat_FormatRelative_Value = string | null | undefined;
export type Web_TorrentFormat_FormatRelative_Now = number;
export type Web_TorrentFormat_FormatRelative_Returns = string;
export type Web_TorrentFormat_FormatRelative_Timestamp = number;
export type Web_TorrentFormat_FormatRelative_Seconds = number;
export type Web_TorrentFormat_FormatRelative_Formatter = Intl.RelativeTimeFormat;
export type Web_TorrentFormat_FormatRelative_Minutes = number;
export type Web_TorrentFormat_FormatRelative_Hours = number;
export type Web_TorrentFormat_FormatRelative_Days = number;

/**
 * Torrent Format.
 *
 * @since 2.4.1
 */
export type Web_TorrentFormat_FormatShortDate_Value = number | string | null | undefined;
export type Web_TorrentFormat_FormatShortDate_Returns = string;
export type Web_TorrentFormat_FormatShortDate_Date = Date;

/**
 * Torrent Format.
 *
 * @since 2.0.0
 */
export type Web_TorrentFormat_FormatTorrentStatus_Status = number;
export type Web_TorrentFormat_FormatTorrentStatus_Returns = string;
export type Web_TorrentFormat_FormatTorrentStatus_Labels = Record<number, string>;

/**
 * Torrent Format.
 *
 * @since 2.0.0
 */
export type Web_TorrentFormat_KeepTogether_Phrase = string;
export type Web_TorrentFormat_KeepTogether_Returns = string;
