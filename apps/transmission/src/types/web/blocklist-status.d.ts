import type { Web_Api_BlocklistStatus } from '@/types/web/api.d.ts';

/**
 * Blocklist Status - Format blocklist copy date.
 *
 * @since UNRELEASED
 */
export type Web_BlocklistStatus_FormatBlocklistCopyDate_Value = string;
export type Web_BlocklistStatus_FormatBlocklistCopyDate_Returns = string;

/**
 * Blocklist Status - Format blocklist last updated.
 *
 * @since UNRELEASED
 */
export type Web_BlocklistStatus_FormatBlocklistLastUpdated_Status = Web_Api_BlocklistStatus;
export type Web_BlocklistStatus_FormatBlocklistLastUpdated_Now = number;
export type Web_BlocklistStatus_FormatBlocklistLastUpdated_Returns = string | null;

/**
 * Blocklist Status - Format blocklist next update.
 *
 * @since UNRELEASED
 */
export type Web_BlocklistStatus_FormatBlocklistNextUpdate_Status = Web_Api_BlocklistStatus;
export type Web_BlocklistStatus_FormatBlocklistNextUpdate_Now = number;
export type Web_BlocklistStatus_FormatBlocklistNextUpdate_Returns = string | null;

/**
 * Blocklist Status - Format blocklist source line.
 *
 * @since UNRELEASED
 */
export type Web_BlocklistStatus_FormatBlocklistSourceLine_Status = Web_Api_BlocklistStatus;
export type Web_BlocklistStatus_FormatBlocklistSourceLine_SourceUrl = string;
export type Web_BlocklistStatus_FormatBlocklistSourceLine_Enabled = boolean;
export type Web_BlocklistStatus_FormatBlocklistSourceLine_Now = number;
export type Web_BlocklistStatus_FormatBlocklistSourceLine_Returns = Web_BlocklistStatus_SourceLine | null;
export type Web_BlocklistStatus_FormatBlocklistSourceLine_MatchedSource = Web_Api_BlocklistStatus['sources'][number] | undefined;
export type Web_BlocklistStatus_FormatBlocklistSourceLine_FirstPendingIndex = number;
export type Web_BlocklistStatus_FormatBlocklistSourceLine_SourceIndex = number;
export type Web_BlocklistStatus_FormatBlocklistSourceLine_Text = string;
export type Web_BlocklistStatus_FormatBlocklistSourceLine_Tone = Web_BlocklistStatus_SourceLine_Tone;
export type Web_BlocklistStatus_FormatBlocklistSourceLine_RelativeTime = string;
export type Web_BlocklistStatus_FormatBlocklistSourceLine_ErrorText = string;
export type Web_BlocklistStatus_FormatBlocklistSourceLine_CopyDate = string;
export type Web_BlocklistStatus_FormatBlocklistSourceLine_SeparatedErrorText = string;

/**
 * Blocklist Status - Format blocklist summary.
 *
 * @since UNRELEASED
 */
export type Web_BlocklistStatus_FormatBlocklistSummary_Status = Web_Api_BlocklistStatus;
export type Web_BlocklistStatus_FormatBlocklistSummary_Returns = string;
export type Web_BlocklistStatus_FormatBlocklistSummary_SourceCount = number;
export type Web_BlocklistStatus_FormatBlocklistSummary_FirstPendingIndex = number;
export type Web_BlocklistStatus_FormatBlocklistSummary_CurrentSource = number;
export type Web_BlocklistStatus_FormatBlocklistSummary_RangeLabel = string;
export type Web_BlocklistStatus_FormatBlocklistSummary_SourceLabel = string;

/**
 * Blocklist Status - Source line.
 *
 * @since UNRELEASED
 */
export type Web_BlocklistStatus_SourceLine_Tone = 'default' | 'danger' | 'active' | 'muted';
export type Web_BlocklistStatus_SourceLine = {
  text: string;
  tone: Web_BlocklistStatus_SourceLine_Tone;
};
