import type { ReactNode } from 'react';

/**
 * Password strength.
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
