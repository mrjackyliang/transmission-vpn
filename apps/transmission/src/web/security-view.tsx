import {
  useEffect,
  useState,
} from 'react';

import {
  addPasskey,
  changePassword,
  changeUsername,
  getAccountSecurity,
  issueFor,
  removePasskey,
  summaryFor,
} from '@/web/api.ts';
import { appConfig } from '@/web/app-config.ts';
import { ConfirmDialog } from '@/web/confirm-dialog.tsx';
import { FieldLabel } from '@/web/field-label.tsx';
import {
  formatDate,
  keepTogether,
} from '@/web/format.ts';
import { PasswordMeter } from '@/web/password-meter.tsx';
import { Button } from '@/web/primitives.tsx';
import { showToast } from '@/web/toast.ts';
import { TotpDialog } from '@/web/totp-dialog.tsx';

import type {
  FormEvent,
  ReactElement,
} from 'react';

import type {
  Web_Api_AccountSecurity,
  Web_Api_Passkey,
} from '@/types/web/api.d.ts';
import type {
  Web_Components_SecurityView_ErrorContext,
  Web_Components_SecurityView_Props,
  Web_Components_TotpDialog_Mode,
} from '@/types/web/components.d.ts';

// The fields each form shows an issue next to, so its banner can stay hidden.

/**
 * Security View - Shown fields.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const shownFields: Record<Web_Components_SecurityView_ErrorContext, string[]> = {
  page: [],
  passkey: [
    'name',
    'password',
  ],
  password: [
    'currentPassword',
    'newPassword',
  ],
  prompt: ['password'],
  username: [
    'password',
    'username',
  ],
};

/**
 * Security View.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const SecurityView = ({
  onAuthenticatorEnabled,
  onUsernameChanged,
}: Web_Components_SecurityView_Props): ReactElement => {
  const [
    security,
    setSecurity,
  ] = useState<Web_Api_AccountSecurity | null>(null);
  const [
    error,
    setError,
  ] = useState<unknown>(null);
  const [
    errorContext,
    setErrorContext,
  ] = useState<Web_Components_SecurityView_ErrorContext>('page');
  const [
    busy,
    setBusy,
  ] = useState<boolean>(false);
  const [
    currentPassword,
    setCurrentPassword,
  ] = useState<string>('');
  const [
    newPassword,
    setNewPassword,
  ] = useState<string>('');
  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState<string>('');
  const [
    passwordMismatch,
    setPasswordMismatch,
  ] = useState<boolean>(false);
  const [
    newUsername,
    setNewUsername,
  ] = useState<string>('');
  const [
    usernamePassword,
    setUsernamePassword,
  ] = useState<string>('');
  const [
    totpMode,
    setTotpMode,
  ] = useState<Web_Components_TotpDialog_Mode | null>(null);
  const [
    removingPasskey,
    setRemovingPasskey,
  ] = useState<Web_Api_Passkey | null>(null);
  const [
    removePassword,
    setRemovePassword,
  ] = useState<string>('');
  const [
    passkeyName,
    setPasskeyName,
  ] = useState<string>('');
  const [
    passkeyPassword,
    setPasskeyPassword,
  ] = useState<string>('');

  /**
   * Security View - Reload.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const reload = async (): Promise<void> => {
    setSecurity(await getAccountSecurity());
  };

  useEffect((): void => {
    void reload().catch((caughtError: unknown): void => setError(caughtError));
  }, []);

  // Runs one action with shared busy and error handling. Field errors stay beside their field; the rest show as toasts.

  /**
   * Security View - Run.
   *
   * Runs one form's request, reloads the page's data, and confirms it with a toast.
   * An error the form's fields can't show also becomes a toast.
   *
   * @since 2.0.0
   */
  const run = async (action: () => Promise<void>, successMessage: string, context: Web_Components_SecurityView_ErrorContext): Promise<void> => {
    setBusy(true);
    setError(null);
    setErrorContext(context);

    try {
      await action();
      await reload();
      showToast(successMessage, true);
    } catch (caughtError) {
      const message: string = summaryFor(caughtError, shownFields[context], 'That didn\'t work. Try again.');

      setError(caughtError);

      if (message !== '') {
        showToast(message, false);
      }
    } finally {
      setBusy(false);
    }
  };

  // Field issues only belong to the form that sent the request.

  /**
   * Security View - Issue in.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const issueIn = (context: Web_Components_SecurityView_ErrorContext, field: string): string => (
    (errorContext === context) ? issueFor(error, field) : ''
  );

  /**
   * Security View - Field issue.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const fieldIssue = (context: Web_Components_SecurityView_ErrorContext, field: string): ReactElement | null => {
    const message: string = issueIn(context, field);

    return (message === '') ? null : <small className="field-error">{message}</small>;
  };

  /**
   * Security View - Submit password change.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const submitPasswordChange = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      setPasswordMismatch(true);

      return;
    }

    await run(async (): Promise<void> => {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }, 'Password changed. Other devices were signed out.', 'password');
  };

  /**
   * Security View - Submit username change.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const submitUsernameChange = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    await run(async (): Promise<void> => {
      await changeUsername(newUsername, usernamePassword);
      onUsernameChanged(newUsername.trim());
      setNewUsername('');
      setUsernamePassword('');
    }, 'Username changed.', 'username');
  };

  /**
   * Security View - Close remove.
   *
   * Closes the passkey removal dialog and clears its password and error.
   * The passkey stays as it was.
   *
   * @since 2.0.0
   */
  const closeRemove = (): void => {
    setRemovingPasskey(null);
    setRemovePassword('');
    setError(null);
  };

  /**
   * Security View - Submit remove passkey.
   *
   * Removes the passkey with the account password from the dialog.
   * A wrong password stays in the dialog, beside its field.
   *
   * @since 2.0.0
   */
  const submitRemovePasskey = async (): Promise<void> => {
    if (removingPasskey === null) {
      return;
    }

    setBusy(true);
    setError(null);
    setErrorContext('prompt');

    try {
      await removePasskey(removingPasskey['id'], removePassword);
      closeRemove();
      await reload();
      showToast('Passkey removed.', true);
    } catch (caughtError) {
      setError(caughtError);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Security View - Submit passkey.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const submitPasskey = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    await run(async (): Promise<void> => {
      await addPasskey(passkeyName, passkeyPassword);
      setPasskeyName('');
      setPasskeyPassword('');
    }, 'Passkey added.', 'passkey');
  };

  if (security === null) {
    return (
      <div className="detail-loading">
        {(error === null) ? (
          <>
            <span className="spinner" />
            Loading sign-in settings…
          </>
        ) : summaryFor(error, [], 'Sign-in settings could not be loaded.')}
      </div>
    );
  }

  const role: string | undefined = security['role'];
  const roleLabel: string | undefined = (role === undefined) ? undefined : appConfig['roleLabels'][role];

  return (
    <section className="workspace-section">
      <div className="workspace-heading">
        <h1>{appConfig['securityLabel']}</h1>
        <p>{(roleLabel === undefined) ? `Signed in as ${security['username']}.` : `Signed in as ${security['username']} (${roleLabel}).`}</p>
      </div>

      <div className="panel">
        <section className="form-section">
          <div className="form-section-head">
            <h2>Password</h2>
          </div>
          <form className="security-form" noValidate onSubmit={submitPasswordChange}>
            <input autoComplete="username" hidden readOnly type="text" value={security['username']} />
            <FieldLabel>
              <span>Current password</span>
              <input aria-invalid={issueIn('password', 'currentPassword') !== ''} autoComplete="current-password" onChange={(event): void => setCurrentPassword(event.currentTarget.value)} type="password" value={currentPassword} />
              {fieldIssue('password', 'currentPassword')}
            </FieldLabel>
            <div className="field-row">
              <FieldLabel>
                <span>New password</span>
                <input
                  aria-invalid={issueIn('password', 'newPassword') !== ''}
                  autoComplete="new-password"
                  onChange={(event): void => {
                    setNewPassword(event.currentTarget.value);
                    setPasswordMismatch(false);
                  }}
                  type="password"
                  value={newPassword}
                />
                <PasswordMeter hints={[security['username']]} issue={fieldIssue('password', 'newPassword')} password={newPassword} />
              </FieldLabel>
              <FieldLabel>
                <span>Confirm new password</span>
                <input
                  aria-invalid={passwordMismatch}
                  autoComplete="new-password"
                  onChange={(event): void => {
                    setConfirmPassword(event.currentTarget.value);
                    setPasswordMismatch(false);
                  }}
                  type="password"
                  value={confirmPassword}
                />
                {(passwordMismatch) ? <small className="field-error">{'The new passwords don\'t match.'}</small> : null}
              </FieldLabel>
            </div>
            <div className="panel-actions">
              <Button disabled={busy || currentPassword === '' || newPassword === ''} type="submit">Change password</Button>
            </div>
          </form>
        </section>

        <section className="form-section">
          <div className="form-section-head">
            <h2>Username</h2>
            <span className="mono">{security['username']}</span>
          </div>
          <form className="security-form" noValidate onSubmit={submitUsernameChange}>
            <div className="field-row">
              <FieldLabel>
                <span>New username</span>
                <input aria-invalid={issueIn('username', 'username') !== ''} autoCapitalize="none" autoComplete="username" onChange={(event): void => setNewUsername(event.currentTarget.value)} spellCheck={false} value={newUsername} />
                {fieldIssue('username', 'username')}
              </FieldLabel>
              <FieldLabel>
                <span>Your password</span>
                <input aria-invalid={issueIn('username', 'password') !== ''} autoComplete="current-password" onChange={(event): void => setUsernamePassword(event.currentTarget.value)} type="password" value={usernamePassword} />
                {fieldIssue('username', 'password')}
              </FieldLabel>
            </div>
            <div className="panel-actions">
              <Button disabled={busy || newUsername.trim() === '' || usernamePassword === ''} type="submit">Change username</Button>
            </div>
          </form>
        </section>

        <section className="form-section">
          <div className="form-section-head">
            <h2>Authenticator app</h2>
            <span className={(security['totpEnabled']) ? 'security-state security-state-on' : 'security-state'}>
              {(security['totpEnabled']) ? `On · ${security['recoveryCodesRemaining']} recovery codes left` : 'Off'}
            </span>
          </div>

          {(security['totpEnabled']) ? (
            <div className="panel-actions panel-actions-start">
              <Button disabled={busy} onClick={(): void => setTotpMode('recovery')}>New recovery codes</Button>
              <Button disabled={busy} onClick={(): void => setTotpMode('disable')} variant="danger">Turn off</Button>
            </div>
          ) : (
            <div className="security-row">
              <p className="form-section-note">Ask for a 6&#8209;digit code from an app like 1Password, Google Authenticator or Authy after your password.</p>
              <Button disabled={busy} onClick={(): void => setTotpMode('setup')}>Set up</Button>
            </div>
          )}
        </section>

        <section className="form-section">
          <div className="form-section-head">
            <h2>Passkeys</h2>
            <span>{`${security['passkeys'].length} saved`}</span>
          </div>

          {(security['passkeys'].length === 0) ? null : (
            <div className="select-list">
              {security['passkeys'].map((passkey: Web_Api_Passkey): ReactElement => (
                <div className="select-list-row token-row" key={passkey['id']}>
                  <span className="select-list-main">
                    <span>{passkey['name']}</span>
                    <small>
                      <span className="mono">{passkey['hostname'] ?? 'Hostname not recorded yet'}</span>
                      {` · ${keepTogether(`added ${formatDate(passkey['createdAt'])}`)} · ${keepTogether((passkey['lastUsedAt'] === null) ? 'never used' : `last used ${formatDate(passkey['lastUsedAt'])}`)}`}
                    </small>
                  </span>
                  <Button
                    disabled={busy}
                    icon="remove"
                    onClick={(): void => {
                      setError(null);
                      setRemovingPasskey(passkey);
                    }}
                    variant="danger"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}

          {(security['passkeysAvailable']) ? (
            <form className="security-form" noValidate onSubmit={submitPasskey}>
              <div className="field-row">
                <FieldLabel>
                  <span>Passkey name</span>
                  <input aria-invalid={issueIn('passkey', 'name') !== ''} onChange={(event): void => setPasskeyName(event.currentTarget.value)} placeholder="e.g. My laptop" value={passkeyName} />
                  {fieldIssue('passkey', 'name')}
                </FieldLabel>
                <FieldLabel>
                  <span>Your password</span>
                  <input aria-invalid={issueIn('passkey', 'password') !== ''} autoComplete="current-password" onChange={(event): void => setPasskeyPassword(event.currentTarget.value)} type="password" value={passkeyPassword} />
                  {fieldIssue('passkey', 'password')}
                </FieldLabel>
              </div>
              <div className="panel-actions">
                <Button disabled={busy || passkeyName.trim() === '' || passkeyPassword === ''} icon="add" type="submit">Add passkey</Button>
              </div>
            </form>
          ) : (
            <p className="form-section-note">
              {'Passkeys need https and a domain name, and this page is open at '}
              <span className="mono">{security['hostname']}</span>
              {`. Open the ${appConfig['securitySurfaceName']} at its domain to add one.`}
            </p>
          )}
          <p className="form-section-note">A passkey only works at the address it was added on.</p>
        </section>
      </div>

      <TotpDialog
        mode={totpMode}
        onAuthenticatorEnabled={onAuthenticatorEnabled}
        onChanged={reload}
        onClose={(): void => setTotpMode(null)}
      />

      <ConfirmDialog
        busy={busy}
        busyLabel="Removing…"
        confirmDisabled={removePassword === ''}
        confirmLabel="Remove passkey"
        error={(errorContext === 'prompt') ? summaryFor(error, shownFields['prompt'], 'The passkey could not be removed.') : ''}
        message="It stops working right away. Enter your account password to remove it."
        onCancel={closeRemove}
        onConfirm={(): void => {
          void submitRemovePasskey();
        }}
        open={removingPasskey !== null}
        title={`Remove ${removingPasskey?.['name'] ?? 'passkey'}?`}
      >
        <FieldLabel>
          <span>Password</span>
          <input
            aria-invalid={issueIn('prompt', 'password') !== ''}
            autoComplete="current-password"
            onChange={(event): void => setRemovePassword(event.currentTarget.value)}
            type="password"
            value={removePassword}
          />
          {fieldIssue('prompt', 'password')}
        </FieldLabel>
      </ConfirmDialog>
    </section>
  );
};
