import type {
  ReactElement,
  ReactNode,
} from 'react';

import type {
  Web_PasswordStrength_MeterProps,
  Web_PasswordStrength_Result,
} from '@/types/web/password-strength.d.ts';

/**
 * Password Meter.
 *
 * @since 2.4.1
 */
export type Web_PasswordMeter_PasswordMeter_Props = Web_PasswordStrength_MeterProps;
export type Web_PasswordMeter_PasswordMeter_Returns = ReactElement;
export type Web_PasswordMeter_PasswordMeter_Hints = string[];
export type Web_PasswordMeter_PasswordMeter_Id = string | undefined;
export type Web_PasswordMeter_PasswordMeter_Issue = ReactNode;
export type Web_PasswordMeter_PasswordMeter_Password = string;
export type Web_PasswordMeter_PasswordMeter_Strength = Web_PasswordStrength_Result;
export type Web_PasswordMeter_PasswordMeter_Text = string;

/**
 * Password Meter.
 *
 * @since 2.4.1
 */
export type Web_PasswordMeter_Steps = number[];
