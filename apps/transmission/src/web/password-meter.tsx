import {
  checkPasswordStrength,
  minimumPasswordLength,
} from '@/web/password-strength.ts';

import type {
  Web_PasswordMeter_PasswordMeter_Hints,
  Web_PasswordMeter_PasswordMeter_Id,
  Web_PasswordMeter_PasswordMeter_Issue,
  Web_PasswordMeter_PasswordMeter_Password,
  Web_PasswordMeter_PasswordMeter_Props,
  Web_PasswordMeter_PasswordMeter_Returns,
  Web_PasswordMeter_PasswordMeter_Strength,
  Web_PasswordMeter_PasswordMeter_Text,
  Web_PasswordMeter_Steps,
} from '@/types/web/password-meter.d.ts';

/**
 * Password Meter - Steps.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const steps: Web_PasswordMeter_Steps = [
  1,
  2,
  3,
  4,
];

// PasswordMeter sits under every field that sets a password, with the length rule until
// the password is long enough. A problem from the server replaces the text, not the bar.

/**
 * Password Meter - Password Meter.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_PasswordMeter_PasswordMeter_Props} props - Props.
 *
 * @returns {Web_PasswordMeter_PasswordMeter_Returns}
 *
 * @since 2.0.0
 */
export const PasswordMeter = (props: Web_PasswordMeter_PasswordMeter_Props): Web_PasswordMeter_PasswordMeter_Returns => {
  const hints: Web_PasswordMeter_PasswordMeter_Hints = props['hints'] ?? [];
  const id: Web_PasswordMeter_PasswordMeter_Id = props['id'];
  const issue: Web_PasswordMeter_PasswordMeter_Issue = props['issue'] ?? null;
  const password: Web_PasswordMeter_PasswordMeter_Password = props['password'];
  const strength: Web_PasswordMeter_PasswordMeter_Strength = checkPasswordStrength(password, hints);
  let text: Web_PasswordMeter_PasswordMeter_Text = `At least ${minimumPasswordLength} characters.`;

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
        {steps.map((step) => <span className={(strength['score'] >= step) ? 'is-filled' : undefined} key={step} />)}
      </span>
      {issue ?? <small>{text}</small>}
    </span>
  );
};
