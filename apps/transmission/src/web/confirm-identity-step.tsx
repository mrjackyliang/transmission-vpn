import { useState } from 'react';

import { FieldLabel } from '@/web/field-label.tsx';
import {
  Button,
  Icon,
} from '@/web/primitives.tsx';

import type {
  FormEvent,
  ReactElement,
} from 'react';

import type { Web_BackupComponents_ConfirmIdentityStep_Props } from '@/types/web/backup-components.d.ts';

/**
 * Confirm Identity Step.
 *
 * Reuses the same password, authenticator and passkey choices for every sensitive
 * workflow without retaining credentials after the confirmation request finishes.
 *
 * @since UNRELEASED
 */
export const ConfirmIdentityStep = ({
  authenticatorEnabled,
  description,
  onBack,
  onConfirm,
  onConfirmed,
  onPasskey,
  passkeyAvailable,
}: Web_BackupComponents_ConfirmIdentityStep_Props): ReactElement => {
  const [
    password,
    setPassword,
  ] = useState<string>('');
  const [
    code,
    setCode,
  ] = useState<string>('');
  const [
    busy,
    setBusy,
  ] = useState<boolean>(false);
  const [
    error,
    setError,
  ] = useState<string>('');

  /**
   * Confirm Identity Step - Finishes confirmation.
   *
   * Clears typed credentials before handing the short-lived grant to its mutation.
   * This keeps reusable confirmation state from retaining account secrets.
   *
   * @param {string} grant - Grant.
   *
   * @returns {Promise<void>}
   */
  const finish = async (grant: string): Promise<void> => {
    setPassword('');
    setCode('');
    await onConfirmed(grant);
  };

  /**
   * Confirm Identity Step - Submits password proof.
   *
   * Exchanges password and optional authenticator code through the supplied ceremony.
   * Errors remain in the step so the user can retry without losing context.
   *
   * @param {FormEvent<HTMLFormElement>} event - Event.
   *
   * @returns {Promise<void>}
   */
  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
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
  };

  /**
   * Confirm Identity Step - Confirms with a passkey.
   *
   * Runs the supplied passkey ceremony and forwards its matching scoped grant.
   * Password fields are cleared by the same completion path on success.
   *
   * @returns {Promise<void>}
   */
  const confirmWithPasskey = async (): Promise<void> => {
    setBusy(true);
    setError('');
    try {
      await finish(await onPasskey());
    } catch (caughtError) {
      setError((caughtError instanceof Error) ? caughtError.message : 'The passkey could not be used.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event: FormEvent<HTMLFormElement>): void => {
      void submit(event);
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
          onChange={(event): void => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </FieldLabel>
      {(!authenticatorEnabled) ? null : (
        <FieldLabel>
          <span>Authenticator code</span>
          <input
            autoComplete="one-time-code"
            disabled={busy}
            inputMode="numeric"
            maxLength={6}
            onChange={(event): void => setCode(event.target.value.replace(/\D/gu, '').slice(0, 6))}
            pattern="[0-9]{6}"
            required
            type="text"
            value={code}
          />
        </FieldLabel>
      )}
      {(!passkeyAvailable) ? null : (
        <button
          className="backup-passkey-button"
          disabled={busy}
          onClick={(): void => {
            void confirmWithPasskey();
          }}
          type="button"
        >
          <Icon name="key" size={18} />
          Use a passkey instead
        </button>
      )}
      <div className="dialog-actions">
        <Button disabled={busy} onClick={onBack}>Back</Button>
        <Button disabled={busy || password === '' || (authenticatorEnabled && code.length !== 6)} type="submit" variant="primary">
          {(busy) ? 'Confirming…' : 'Confirm'}
        </Button>
      </div>
    </form>
  );
};
