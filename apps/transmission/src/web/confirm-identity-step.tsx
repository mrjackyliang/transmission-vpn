import { useState } from 'react';

import { FieldLabel } from '@/web/field-label.tsx';
import {
  Button,
  Icon,
} from '@/web/primitives.tsx';
import { nonDigitPattern } from '@/web/regex.js';

import type { Web_BackupComponents_ConfirmIdentityStep_Props } from '@/types/web/backup-components.d.ts';
import type {
  Web_ConfirmIdentityStep_ConfirmIdentityStep_AuthenticatorEnabled,
  Web_ConfirmIdentityStep_ConfirmIdentityStep_Busy,
  Web_ConfirmIdentityStep_ConfirmIdentityStep_BusyState,
  Web_ConfirmIdentityStep_ConfirmIdentityStep_Code,
  Web_ConfirmIdentityStep_ConfirmIdentityStep_CodeState,
  Web_ConfirmIdentityStep_ConfirmIdentityStep_ConfirmWithPasskey,
  Web_ConfirmIdentityStep_ConfirmIdentityStep_ConfirmWithPasskey_Returns,
  Web_ConfirmIdentityStep_ConfirmIdentityStep_Description,
  Web_ConfirmIdentityStep_ConfirmIdentityStep_Error,
  Web_ConfirmIdentityStep_ConfirmIdentityStep_ErrorState,
  Web_ConfirmIdentityStep_ConfirmIdentityStep_Finish,
  Web_ConfirmIdentityStep_ConfirmIdentityStep_Finish_Grant,
  Web_ConfirmIdentityStep_ConfirmIdentityStep_Finish_Returns,
  Web_ConfirmIdentityStep_ConfirmIdentityStep_OnBack,
  Web_ConfirmIdentityStep_ConfirmIdentityStep_OnConfirm,
  Web_ConfirmIdentityStep_ConfirmIdentityStep_OnConfirmed,
  Web_ConfirmIdentityStep_ConfirmIdentityStep_OnPasskey,
  Web_ConfirmIdentityStep_ConfirmIdentityStep_PasskeyAvailable,
  Web_ConfirmIdentityStep_ConfirmIdentityStep_Password,
  Web_ConfirmIdentityStep_ConfirmIdentityStep_PasswordState,
  Web_ConfirmIdentityStep_ConfirmIdentityStep_Returns,
  Web_ConfirmIdentityStep_ConfirmIdentityStep_SetBusy,
  Web_ConfirmIdentityStep_ConfirmIdentityStep_SetCode,
  Web_ConfirmIdentityStep_ConfirmIdentityStep_SetError,
  Web_ConfirmIdentityStep_ConfirmIdentityStep_SetPassword,
  Web_ConfirmIdentityStep_ConfirmIdentityStep_Submit,
  Web_ConfirmIdentityStep_ConfirmIdentityStep_Submit_Event,
  Web_ConfirmIdentityStep_ConfirmIdentityStep_Submit_Returns,
} from '@/types/web/confirm-identity-step.d.ts';

/**
 * Confirm Identity Step - Confirm Identity Step.
 *
 * Reuses the same password, authenticator and passkey choices for every sensitive
 * workflow without retaining credentials after the confirmation request finishes.
 *
 * @param {Web_BackupComponents_ConfirmIdentityStep_Props} props - Props.
 *
 * @returns {Web_ConfirmIdentityStep_ConfirmIdentityStep_Returns}
 *
 * @since 2.0.0
 */
export const ConfirmIdentityStep = (props: Web_BackupComponents_ConfirmIdentityStep_Props): Web_ConfirmIdentityStep_ConfirmIdentityStep_Returns => {
  const authenticatorEnabled: Web_ConfirmIdentityStep_ConfirmIdentityStep_AuthenticatorEnabled = props['authenticatorEnabled'];
  const description: Web_ConfirmIdentityStep_ConfirmIdentityStep_Description = props['description'];
  const onBack: Web_ConfirmIdentityStep_ConfirmIdentityStep_OnBack = props['onBack'];
  const onConfirm: Web_ConfirmIdentityStep_ConfirmIdentityStep_OnConfirm = props['onConfirm'];
  const onConfirmed: Web_ConfirmIdentityStep_ConfirmIdentityStep_OnConfirmed = props['onConfirmed'];
  const onPasskey: Web_ConfirmIdentityStep_ConfirmIdentityStep_OnPasskey = props['onPasskey'];
  const passkeyAvailable: Web_ConfirmIdentityStep_ConfirmIdentityStep_PasskeyAvailable = props['passkeyAvailable'];
  const passwordState: Web_ConfirmIdentityStep_ConfirmIdentityStep_PasswordState = useState<Web_ConfirmIdentityStep_ConfirmIdentityStep_Password>('');
  const password: Web_ConfirmIdentityStep_ConfirmIdentityStep_Password = passwordState[0];
  const setPassword: Web_ConfirmIdentityStep_ConfirmIdentityStep_SetPassword = passwordState[1];
  const codeState: Web_ConfirmIdentityStep_ConfirmIdentityStep_CodeState = useState<Web_ConfirmIdentityStep_ConfirmIdentityStep_Code>('');
  const code: Web_ConfirmIdentityStep_ConfirmIdentityStep_Code = codeState[0];
  const setCode: Web_ConfirmIdentityStep_ConfirmIdentityStep_SetCode = codeState[1];
  const busyState: Web_ConfirmIdentityStep_ConfirmIdentityStep_BusyState = useState<Web_ConfirmIdentityStep_ConfirmIdentityStep_Busy>(false);
  const busy: Web_ConfirmIdentityStep_ConfirmIdentityStep_Busy = busyState[0];
  const setBusy: Web_ConfirmIdentityStep_ConfirmIdentityStep_SetBusy = busyState[1];
  const errorState: Web_ConfirmIdentityStep_ConfirmIdentityStep_ErrorState = useState<Web_ConfirmIdentityStep_ConfirmIdentityStep_Error>('');
  const error: Web_ConfirmIdentityStep_ConfirmIdentityStep_Error = errorState[0];
  const setError: Web_ConfirmIdentityStep_ConfirmIdentityStep_SetError = errorState[1];

  /**
   * Confirm Identity Step - Finish.
   *
   * Clears typed credentials before handing the short-lived grant to its mutation.
   * This keeps reusable confirmation state from retaining account secrets.
   *
   * @param {Web_ConfirmIdentityStep_ConfirmIdentityStep_Finish_Grant} grant - Grant.
   *
   * @returns {Web_ConfirmIdentityStep_ConfirmIdentityStep_Finish_Returns}
   */
  const finish: Web_ConfirmIdentityStep_ConfirmIdentityStep_Finish = async (grant: Web_ConfirmIdentityStep_ConfirmIdentityStep_Finish_Grant): Web_ConfirmIdentityStep_ConfirmIdentityStep_Finish_Returns => {
    setPassword('');
    setCode('');

    await onConfirmed(grant);

    return;
  };

  /**
   * Confirm Identity Step - Submit.
   *
   * Exchanges password and optional authenticator code through the supplied ceremony.
   * Errors remain in the step so the user can retry without losing context.
   *
   * @param {Web_ConfirmIdentityStep_ConfirmIdentityStep_Submit_Event} event - Event.
   *
   * @returns {Web_ConfirmIdentityStep_ConfirmIdentityStep_Submit_Returns}
   */
  const submit: Web_ConfirmIdentityStep_ConfirmIdentityStep_Submit = async (event: Web_ConfirmIdentityStep_ConfirmIdentityStep_Submit_Event): Web_ConfirmIdentityStep_ConfirmIdentityStep_Submit_Returns => {
    event.preventDefault();

    setBusy(true);
    setError('');

    try {
      await finish(await onConfirm(password, code));
    } catch (caughtError) {
      setError((caughtError instanceof Error) ? caughtError.message : 'Your identity could not be confirmed.');
    } finally {
      setBusy(false);
    }

    return;
  };

  /**
   * Confirm Identity Step - Confirm With Passkey.
   *
   * Runs the supplied passkey ceremony and forwards its matching scoped grant.
   * Password fields are cleared by the same completion path on success.
   *
   * @returns {Web_ConfirmIdentityStep_ConfirmIdentityStep_ConfirmWithPasskey_Returns}
   */
  const confirmWithPasskey: Web_ConfirmIdentityStep_ConfirmIdentityStep_ConfirmWithPasskey = async (): Web_ConfirmIdentityStep_ConfirmIdentityStep_ConfirmWithPasskey_Returns => {
    setBusy(true);
    setError('');

    try {
      await finish(await onPasskey());
    } catch (caughtError) {
      setError((caughtError instanceof Error) ? caughtError.message : 'The passkey could not be used.');
    } finally {
      setBusy(false);
    }

    return;
  };

  return (
    <form onSubmit={(event) => {
      void submit(event);

      return;
    }}
    >
      <p className="dialog-message">{description}</p>
      {(error === '') ? null : <div className="form-error" role="alert">{error}</div>}
      <FieldLabel>
        <span>Password</span>
        <input
          autoComplete="current-password"
          data-dialog-initial-focus
          disabled={busy}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </FieldLabel>
      {(authenticatorEnabled === false) ? null : (
        <FieldLabel>
          <span>Authenticator code</span>
          <input
            autoComplete="one-time-code"
            disabled={busy}
            inputMode="numeric"
            maxLength={6}
            onChange={(event) => setCode(event.target.value.replace(new RegExp(nonDigitPattern, 'gu'), '').slice(0, 6))}
            pattern="[0-9]{6}"
            required
            type="text"
            value={code}
          />
        </FieldLabel>
      )}
      {(passkeyAvailable === false) ? null : (
        <button
          className="backup-passkey-button"
          disabled={busy}
          onClick={() => {
            void confirmWithPasskey();

            return;
          }}
          type="button"
        >
          <Icon name="key" size={18} />
          Use a passkey instead
        </button>
      )}
      <div className="dialog-actions">
        <Button disabled={busy} onClick={onBack}>Back</Button>
        <Button
          disabled={(
            busy === true
            || password === ''
            || (
              authenticatorEnabled === true
              && code.length !== 6
            )
          )}
          type="submit"
          variant="primary"
        >
          {(busy === true) ? 'Confirming…' : 'Confirm'}
        </Button>
      </div>
    </form>
  );
};
