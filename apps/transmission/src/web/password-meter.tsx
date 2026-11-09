import {
  checkPasswordStrength,
  minimumPasswordLength,
} from '@/web/password-strength.ts';

import type { ReactElement } from 'react';

import type {
  Web_PasswordStrength_MeterProps,
  Web_PasswordStrength_Result,
} from '@/types/web/password-strength.d.ts';

/**
 * Password Meter - Steps.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const steps: number[] = [
  1,
  2,
  3,
  4,
];

// PasswordMeter sits under every field that sets a password, with the length rule until
// the password is long enough. A problem from the server replaces the text, not the bar.

/**
 * Password Meter.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const PasswordMeter = ({
  hints = [],
  id,
  issue = null,
  password,
}: Web_PasswordStrength_MeterProps): ReactElement => {
  const strength: Web_PasswordStrength_Result = checkPasswordStrength(password, hints);
  let text: string = `At least ${minimumPasswordLength} characters.`;

  if (password.length >= minimumPasswordLength) {
    text = (strength['advice'] === '') ? `${strength['label']}.` : `${strength['label']}. ${strength['advice']}`;
  }

  return (
    <span className="password-meter" data-score={strength['score']} id={id}>
      <span
        aria-label="Password strength"
        aria-valuemax={4}
        aria-valuemin={0}
        aria-valuenow={strength['score']}
        aria-valuetext={strength['label']}
        className="password-meter-bar"
        role="meter"
      >
        {steps.map((step: number): ReactElement => <span className={(strength['score'] >= step) ? 'is-filled' : undefined} key={step} />)}
      </span>
      {issue ?? <small>{text}</small>}
    </span>
  );
};
