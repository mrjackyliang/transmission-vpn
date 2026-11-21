import type { ReactNode } from 'react';

/**
 * Password Strength.
 *
 * @since 2.0.0
 */
export type Web_PasswordStrength_Score = 0 | 1 | 2 | 3 | 4;
export type Web_PasswordStrength_SpanKind = 'hint' | 'repeat' | 'sequence' | 'word' | 'year';
export type Web_PasswordStrength_Span = {
  bits: number;
  end: number;
  kind: Web_PasswordStrength_SpanKind;
  start: number;
  text: string;
};
export type Web_PasswordStrength_Result = {
  advice: string;
  label: string;
  score: Web_PasswordStrength_Score;
};
export type Web_PasswordStrength_MeterProps = {
  hints?: string[];
  id?: string;
  issue?: ReactNode;
  password: string;
};

/**
 * Password Strength.
 *
 * @since 2.4.1
 */
export type Web_PasswordStrength_AdviceFor_Spans = Web_PasswordStrength_Span[];
export type Web_PasswordStrength_AdviceFor_Repeated = boolean;
export type Web_PasswordStrength_AdviceFor_Score = Web_PasswordStrength_Score;
export type Web_PasswordStrength_AdviceFor_Returns = string;
export type Web_PasswordStrength_AdviceFor_Word = Web_PasswordStrength_Span | undefined;
export type Web_PasswordStrength_AdviceFor_Kinds = Set<Web_PasswordStrength_SpanKind>;

/**
 * Password Strength.
 *
 * @since 2.4.1
 */
export type Web_PasswordStrength_CheckPasswordStrength_Password = string;
export type Web_PasswordStrength_CheckPasswordStrength_Hints = string[];
export type Web_PasswordStrength_CheckPasswordStrength_Returns = Web_PasswordStrength_Result;
export type Web_PasswordStrength_CheckPasswordStrength_Unit = string;
export type Web_PasswordStrength_CheckPasswordStrength_Repeated = boolean;
export type Web_PasswordStrength_CheckPasswordStrength_Spans = Web_PasswordStrength_Span[];
export type Web_PasswordStrength_CheckPasswordStrength_LengthDifference = number;
export type Web_PasswordStrength_CheckPasswordStrength_Chosen = Web_PasswordStrength_Span[];
export type Web_PasswordStrength_CheckPasswordStrength_Covered = number;
export type Web_PasswordStrength_CheckPasswordStrength_Bits = number;
export type Web_PasswordStrength_CheckPasswordStrength_Score = Web_PasswordStrength_Score;

/**
 * Password Strength.
 *
 * @since 2.4.1
 */
export type Web_PasswordStrength_CommonWords = string[];

/**
 * Password Strength.
 *
 * @since 2.4.1
 */
export type Web_PasswordStrength_FindSpans_Value = string;
export type Web_PasswordStrength_FindSpans_Hints = string[];
export type Web_PasswordStrength_FindSpans_Returns = Web_PasswordStrength_Span[];
export type Web_PasswordStrength_FindSpans_Lower = string;
export type Web_PasswordStrength_FindSpans_Spans = Web_PasswordStrength_Span[];
export type Web_PasswordStrength_FindSpans_Add_Start = number;
export type Web_PasswordStrength_FindSpans_Add_End = number;
export type Web_PasswordStrength_FindSpans_Add_Kind = Web_PasswordStrength_SpanKind;
export type Web_PasswordStrength_FindSpans_Add_Returns = void;
export type Web_PasswordStrength_FindSpans_Add = (start: Web_PasswordStrength_FindSpans_Add_Start, end: Web_PasswordStrength_FindSpans_Add_End, kind: Web_PasswordStrength_FindSpans_Add_Kind) => Web_PasswordStrength_FindSpans_Add_Returns;
export type Web_PasswordStrength_FindSpans_AddEvery_Haystack = string;
export type Web_PasswordStrength_FindSpans_AddEvery_Needle = string;
export type Web_PasswordStrength_FindSpans_AddEvery_Kind = Web_PasswordStrength_SpanKind;
export type Web_PasswordStrength_FindSpans_AddEvery_Returns = void;
export type Web_PasswordStrength_FindSpans_AddEvery = (haystack: Web_PasswordStrength_FindSpans_AddEvery_Haystack, needle: Web_PasswordStrength_FindSpans_AddEvery_Needle, kind: Web_PasswordStrength_FindSpans_AddEvery_Kind) => Web_PasswordStrength_FindSpans_AddEvery_Returns;
export type Web_PasswordStrength_FindSpans_AddEvery_Index = number;
export type Web_PasswordStrength_FindSpans_Needle = string;
export type Web_PasswordStrength_FindSpans_Start = number;
export type Web_PasswordStrength_FindSpans_Position = number;
export type Web_PasswordStrength_FindSpans_Length = number;
export type Web_PasswordStrength_FindSpans_RunStart = number;

/**
 * Password Strength.
 *
 * @since 2.4.1
 */
export type Web_PasswordStrength_Labels = string[];

/**
 * Password Strength.
 *
 * @since 2.4.1
 */
export type Web_PasswordStrength_LetterSwaps = Record<string, string>;

/**
 * Password Strength.
 *
 * @since 2.4.1
 */
export type Web_PasswordStrength_MinimumPasswordLength = number;

/**
 * Password Strength.
 *
 * @since 2.4.1
 */
export type Web_PasswordStrength_OrderedRows = string[];

/**
 * Password Strength.
 *
 * @since 2.4.1
 */
export type Web_PasswordStrength_PatternBits = Record<Web_PasswordStrength_SpanKind, number>;

/**
 * Password Strength.
 *
 * @since 2.4.1
 */
export type Web_PasswordStrength_PoolSize_Value = string;
export type Web_PasswordStrength_PoolSize_Returns = number;
export type Web_PasswordStrength_PoolSize_Size = number;

/**
 * Password Strength.
 *
 * @since 2.4.1
 */
export type Web_PasswordStrength_ShortestRepeat_Value = string;
export type Web_PasswordStrength_ShortestRepeat_Returns = string;

/**
 * Password Strength.
 *
 * @since 2.4.1
 */
export type Web_PasswordStrength_UndoSwaps_Value = string;
export type Web_PasswordStrength_UndoSwaps_One = string;
export type Web_PasswordStrength_UndoSwaps_Returns = string;
