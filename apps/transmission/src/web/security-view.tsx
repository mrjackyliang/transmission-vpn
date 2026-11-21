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

import type { ReactElement } from 'react';

import type { Web_Api_Passkey } from '@/types/web/api.d.ts';
import type {
  Web_SecurityView_SecurityView_Busy,
  Web_SecurityView_SecurityView_BusyState,
  Web_SecurityView_SecurityView_CloseRemove,
  Web_SecurityView_SecurityView_CloseRemove_Returns,
  Web_SecurityView_SecurityView_ConfirmPassword,
  Web_SecurityView_SecurityView_ConfirmPasswordState,
  Web_SecurityView_SecurityView_CurrentPassword,
  Web_SecurityView_SecurityView_CurrentPasswordState,
  Web_SecurityView_SecurityView_Error,
  Web_SecurityView_SecurityView_ErrorContext,
  Web_SecurityView_SecurityView_ErrorContextState,
  Web_SecurityView_SecurityView_ErrorState,
  Web_SecurityView_SecurityView_FieldIssue,
  Web_SecurityView_SecurityView_FieldIssue_Context,
  Web_SecurityView_SecurityView_FieldIssue_Field,
  Web_SecurityView_SecurityView_FieldIssue_Message,
  Web_SecurityView_SecurityView_FieldIssue_Returns,
  Web_SecurityView_SecurityView_IssueIn,
  Web_SecurityView_SecurityView_IssueIn_Context,
  Web_SecurityView_SecurityView_IssueIn_Field,
  Web_SecurityView_SecurityView_IssueIn_Returns,
  Web_SecurityView_SecurityView_NewPassword,
  Web_SecurityView_SecurityView_NewPasswordState,
  Web_SecurityView_SecurityView_NewUsername,
  Web_SecurityView_SecurityView_NewUsernameState,
  Web_SecurityView_SecurityView_OnAuthenticatorEnabled,
  Web_SecurityView_SecurityView_OnUsernameChanged,
  Web_SecurityView_SecurityView_PasskeyName,
  Web_SecurityView_SecurityView_PasskeyNameState,
  Web_SecurityView_SecurityView_PasskeyPassword,
  Web_SecurityView_SecurityView_PasskeyPasswordState,
  Web_SecurityView_SecurityView_PasswordMismatch,
  Web_SecurityView_SecurityView_PasswordMismatchState,
  Web_SecurityView_SecurityView_Props,
  Web_SecurityView_SecurityView_Reload,
  Web_SecurityView_SecurityView_Reload_Returns,
  Web_SecurityView_SecurityView_RemovePassword,
  Web_SecurityView_SecurityView_RemovePasswordState,
  Web_SecurityView_SecurityView_RemovingPasskey,
  Web_SecurityView_SecurityView_RemovingPasskeyName,
  Web_SecurityView_SecurityView_RemovingPasskeyState,
  Web_SecurityView_SecurityView_Returns,
  Web_SecurityView_SecurityView_Role,
  Web_SecurityView_SecurityView_RoleLabel,
  Web_SecurityView_SecurityView_Run,
  Web_SecurityView_SecurityView_Run_Action,
  Web_SecurityView_SecurityView_Run_Context,
  Web_SecurityView_SecurityView_Run_Message,
  Web_SecurityView_SecurityView_Run_Returns,
  Web_SecurityView_SecurityView_Run_SuccessMessage,
  Web_SecurityView_SecurityView_Security,
  Web_SecurityView_SecurityView_SecurityState,
  Web_SecurityView_SecurityView_SetBusy,
  Web_SecurityView_SecurityView_SetConfirmPassword,
  Web_SecurityView_SecurityView_SetCurrentPassword,
  Web_SecurityView_SecurityView_SetError,
  Web_SecurityView_SecurityView_SetErrorContext,
  Web_SecurityView_SecurityView_SetNewPassword,
  Web_SecurityView_SecurityView_SetNewUsername,
  Web_SecurityView_SecurityView_SetPasskeyName,
  Web_SecurityView_SecurityView_SetPasskeyPassword,
  Web_SecurityView_SecurityView_SetPasswordMismatch,
  Web_SecurityView_SecurityView_SetRemovePassword,
  Web_SecurityView_SecurityView_SetRemovingPasskey,
  Web_SecurityView_SecurityView_SetSecurity,
  Web_SecurityView_SecurityView_SetTotpMode,
  Web_SecurityView_SecurityView_SetUsernamePassword,
  Web_SecurityView_SecurityView_SubmitPasskey,
  Web_SecurityView_SecurityView_SubmitPasskey_Event,
  Web_SecurityView_SecurityView_SubmitPasskey_Returns,
  Web_SecurityView_SecurityView_SubmitPasswordChange,
  Web_SecurityView_SecurityView_SubmitPasswordChange_Event,
  Web_SecurityView_SecurityView_SubmitPasswordChange_Returns,
  Web_SecurityView_SecurityView_SubmitRemovePasskey,
  Web_SecurityView_SecurityView_SubmitRemovePasskey_Returns,
  Web_SecurityView_SecurityView_SubmitUsernameChange,
  Web_SecurityView_SecurityView_SubmitUsernameChange_Event,
  Web_SecurityView_SecurityView_SubmitUsernameChange_Returns,
  Web_SecurityView_SecurityView_TotpMode,
  Web_SecurityView_SecurityView_TotpModeState,
  Web_SecurityView_SecurityView_UsernamePassword,
  Web_SecurityView_SecurityView_UsernamePasswordState,
  Web_SecurityView_ShownFields,
} from '@/types/web/security-view.d.ts';

// The fields each form shows an issue next to, so its banner can stay hidden.

/**
 * Security View - Shown Fields.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const shownFields: Web_SecurityView_ShownFields = {
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
 * Security View - Security View.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_SecurityView_SecurityView_Props} props - Props.
 *
 * @returns {Web_SecurityView_SecurityView_Returns}
 *
 * @since 2.0.0
 */
export const SecurityView = (props: Web_SecurityView_SecurityView_Props): Web_SecurityView_SecurityView_Returns => {
  const onAuthenticatorEnabled: Web_SecurityView_SecurityView_OnAuthenticatorEnabled = props['onAuthenticatorEnabled'];
  const onUsernameChanged: Web_SecurityView_SecurityView_OnUsernameChanged = props['onUsernameChanged'];
  const securityState: Web_SecurityView_SecurityView_SecurityState = useState<Web_SecurityView_SecurityView_Security>(null);
  const security: Web_SecurityView_SecurityView_Security = securityState[0];
  const setSecurity: Web_SecurityView_SecurityView_SetSecurity = securityState[1];
  const errorState: Web_SecurityView_SecurityView_ErrorState = useState<Web_SecurityView_SecurityView_Error>(null);
  const error: Web_SecurityView_SecurityView_Error = errorState[0];
  const setError: Web_SecurityView_SecurityView_SetError = errorState[1];
  const errorContextState: Web_SecurityView_SecurityView_ErrorContextState = useState<Web_SecurityView_SecurityView_ErrorContext>('page');
  const errorContext: Web_SecurityView_SecurityView_ErrorContext = errorContextState[0];
  const setErrorContext: Web_SecurityView_SecurityView_SetErrorContext = errorContextState[1];
  const busyState: Web_SecurityView_SecurityView_BusyState = useState<Web_SecurityView_SecurityView_Busy>(false);
  const busy: Web_SecurityView_SecurityView_Busy = busyState[0];
  const setBusy: Web_SecurityView_SecurityView_SetBusy = busyState[1];
  const currentPasswordState: Web_SecurityView_SecurityView_CurrentPasswordState = useState<Web_SecurityView_SecurityView_CurrentPassword>('');
  const currentPassword: Web_SecurityView_SecurityView_CurrentPassword = currentPasswordState[0];
  const setCurrentPassword: Web_SecurityView_SecurityView_SetCurrentPassword = currentPasswordState[1];
  const newPasswordState: Web_SecurityView_SecurityView_NewPasswordState = useState<Web_SecurityView_SecurityView_NewPassword>('');
  const newPassword: Web_SecurityView_SecurityView_NewPassword = newPasswordState[0];
  const setNewPassword: Web_SecurityView_SecurityView_SetNewPassword = newPasswordState[1];
  const confirmPasswordState: Web_SecurityView_SecurityView_ConfirmPasswordState = useState<Web_SecurityView_SecurityView_ConfirmPassword>('');
  const confirmPassword: Web_SecurityView_SecurityView_ConfirmPassword = confirmPasswordState[0];
  const setConfirmPassword: Web_SecurityView_SecurityView_SetConfirmPassword = confirmPasswordState[1];
  const passwordMismatchState: Web_SecurityView_SecurityView_PasswordMismatchState = useState<Web_SecurityView_SecurityView_PasswordMismatch>(false);
  const passwordMismatch: Web_SecurityView_SecurityView_PasswordMismatch = passwordMismatchState[0];
  const setPasswordMismatch: Web_SecurityView_SecurityView_SetPasswordMismatch = passwordMismatchState[1];
  const newUsernameState: Web_SecurityView_SecurityView_NewUsernameState = useState<Web_SecurityView_SecurityView_NewUsername>('');
  const newUsername: Web_SecurityView_SecurityView_NewUsername = newUsernameState[0];
  const setNewUsername: Web_SecurityView_SecurityView_SetNewUsername = newUsernameState[1];
  const usernamePasswordState: Web_SecurityView_SecurityView_UsernamePasswordState = useState<Web_SecurityView_SecurityView_UsernamePassword>('');
  const usernamePassword: Web_SecurityView_SecurityView_UsernamePassword = usernamePasswordState[0];
  const setUsernamePassword: Web_SecurityView_SecurityView_SetUsernamePassword = usernamePasswordState[1];
  const totpModeState: Web_SecurityView_SecurityView_TotpModeState = useState<Web_SecurityView_SecurityView_TotpMode>(null);
  const totpMode: Web_SecurityView_SecurityView_TotpMode = totpModeState[0];
  const setTotpMode: Web_SecurityView_SecurityView_SetTotpMode = totpModeState[1];
  const removingPasskeyState: Web_SecurityView_SecurityView_RemovingPasskeyState = useState<Web_SecurityView_SecurityView_RemovingPasskey>(null);
  const removingPasskey: Web_SecurityView_SecurityView_RemovingPasskey = removingPasskeyState[0];
  const setRemovingPasskey: Web_SecurityView_SecurityView_SetRemovingPasskey = removingPasskeyState[1];
  const removePasswordState: Web_SecurityView_SecurityView_RemovePasswordState = useState<Web_SecurityView_SecurityView_RemovePassword>('');
  const removePassword: Web_SecurityView_SecurityView_RemovePassword = removePasswordState[0];
  const setRemovePassword: Web_SecurityView_SecurityView_SetRemovePassword = removePasswordState[1];
  const passkeyNameState: Web_SecurityView_SecurityView_PasskeyNameState = useState<Web_SecurityView_SecurityView_PasskeyName>('');
  const passkeyName: Web_SecurityView_SecurityView_PasskeyName = passkeyNameState[0];
  const setPasskeyName: Web_SecurityView_SecurityView_SetPasskeyName = passkeyNameState[1];
  const passkeyPasswordState: Web_SecurityView_SecurityView_PasskeyPasswordState = useState<Web_SecurityView_SecurityView_PasskeyPassword>('');
  const passkeyPassword: Web_SecurityView_SecurityView_PasskeyPassword = passkeyPasswordState[0];
  const setPasskeyPassword: Web_SecurityView_SecurityView_SetPasskeyPassword = passkeyPasswordState[1];

  /**
   * Security View - Reload.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @returns {Web_SecurityView_SecurityView_Reload_Returns}
   *
   * @since 2.0.0
   */
  const reload: Web_SecurityView_SecurityView_Reload = async (): Web_SecurityView_SecurityView_Reload_Returns => {
    setSecurity(await getAccountSecurity());

    return;
  };

  useEffect(() => {
    void reload().catch((caughtError) => setError(caughtError));

    return;
  }, []);

  // Runs one action with shared busy and error handling. Field errors stay beside their field; the rest show as toasts.

  /**
   * Security View - Run.
   *
   * Runs one form's request, reloads the page's data, and confirms it with a toast.
   * An error the form's fields can't show also becomes a toast.
   *
   * @param {Web_SecurityView_SecurityView_Run_Action}         action         - Action.
   * @param {Web_SecurityView_SecurityView_Run_SuccessMessage} successMessage - Success message.
   * @param {Web_SecurityView_SecurityView_Run_Context}        context        - Context.
   *
   * @returns {Web_SecurityView_SecurityView_Run_Returns}
   *
   * @since 2.0.0
   */
  const run: Web_SecurityView_SecurityView_Run = async (action: Web_SecurityView_SecurityView_Run_Action, successMessage: Web_SecurityView_SecurityView_Run_SuccessMessage, context: Web_SecurityView_SecurityView_Run_Context): Web_SecurityView_SecurityView_Run_Returns => {
    setBusy(true);
    setError(null);
    setErrorContext(context);

    try {
      await action();
      await reload();
      showToast(successMessage, true);
    } catch (caughtError) {
      const message: Web_SecurityView_SecurityView_Run_Message = summaryFor(caughtError, shownFields[context], 'That didn\'t work. Try again.');

      setError(caughtError);

      if (message !== '') {
        showToast(message, false);
      }
    } finally {
      setBusy(false);
    }

    return;
  };

  // Field issues only belong to the form that sent the request.

  /**
   * Security View - Issue In.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @param {Web_SecurityView_SecurityView_IssueIn_Context} context - Context.
   * @param {Web_SecurityView_SecurityView_IssueIn_Field}   field   - Field.
   *
   * @returns {Web_SecurityView_SecurityView_IssueIn_Returns}
   *
   * @since 2.0.0
   */
  const issueIn: Web_SecurityView_SecurityView_IssueIn = (context: Web_SecurityView_SecurityView_IssueIn_Context, field: Web_SecurityView_SecurityView_IssueIn_Field): Web_SecurityView_SecurityView_IssueIn_Returns => (
    (errorContext === context) ? issueFor(error, field) : ''
  );

  /**
   * Security View - Field Issue.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @param {Web_SecurityView_SecurityView_FieldIssue_Context} context - Context.
   * @param {Web_SecurityView_SecurityView_FieldIssue_Field}   field   - Field.
   *
   * @returns {Web_SecurityView_SecurityView_FieldIssue_Returns}
   *
   * @since 2.0.0
   */
  const fieldIssue: Web_SecurityView_SecurityView_FieldIssue = (context: Web_SecurityView_SecurityView_FieldIssue_Context, field: Web_SecurityView_SecurityView_FieldIssue_Field): Web_SecurityView_SecurityView_FieldIssue_Returns => {
    const message: Web_SecurityView_SecurityView_FieldIssue_Message = issueIn(context, field);

    return (message === '') ? null : <small className="field-error">{message}</small>;
  };

  /**
   * Security View - Submit Password Change.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @param {Web_SecurityView_SecurityView_SubmitPasswordChange_Event} event - Event.
   *
   * @returns {Web_SecurityView_SecurityView_SubmitPasswordChange_Returns}
   *
   * @since 2.0.0
   */
  const submitPasswordChange: Web_SecurityView_SecurityView_SubmitPasswordChange = async (event: Web_SecurityView_SecurityView_SubmitPasswordChange_Event): Web_SecurityView_SecurityView_SubmitPasswordChange_Returns => {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      setPasswordMismatch(true);

      return;
    }

    await run(async () => {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      return;
    }, 'Password changed. Other devices were signed out.', 'password');

    return;
  };

  /**
   * Security View - Submit Username Change.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @param {Web_SecurityView_SecurityView_SubmitUsernameChange_Event} event - Event.
   *
   * @returns {Web_SecurityView_SecurityView_SubmitUsernameChange_Returns}
   *
   * @since 2.0.0
   */
  const submitUsernameChange: Web_SecurityView_SecurityView_SubmitUsernameChange = async (event: Web_SecurityView_SecurityView_SubmitUsernameChange_Event): Web_SecurityView_SecurityView_SubmitUsernameChange_Returns => {
    event.preventDefault();

    await run(async () => {
      await changeUsername(newUsername, usernamePassword);
      onUsernameChanged(newUsername.trim());
      setNewUsername('');
      setUsernamePassword('');

      return;
    }, 'Username changed.', 'username');

    return;
  };

  /**
   * Security View - Close Remove.
   *
   * Closes the passkey removal dialog and clears its password and error.
   * The passkey stays as it was.
   *
   * @returns {Web_SecurityView_SecurityView_CloseRemove_Returns}
   *
   * @since 2.0.0
   */
  const closeRemove: Web_SecurityView_SecurityView_CloseRemove = (): Web_SecurityView_SecurityView_CloseRemove_Returns => {
    setRemovingPasskey(null);
    setRemovePassword('');
    setError(null);

    return;
  };

  /**
   * Security View - Submit Remove Passkey.
   *
   * Removes the passkey with the account password from the dialog.
   * A wrong password stays in the dialog, beside its field.
   *
   * @returns {Web_SecurityView_SecurityView_SubmitRemovePasskey_Returns}
   *
   * @since 2.0.0
   */
  const submitRemovePasskey: Web_SecurityView_SecurityView_SubmitRemovePasskey = async (): Web_SecurityView_SecurityView_SubmitRemovePasskey_Returns => {
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

    return;
  };

  /**
   * Security View - Submit Passkey.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @param {Web_SecurityView_SecurityView_SubmitPasskey_Event} event - Event.
   *
   * @returns {Web_SecurityView_SecurityView_SubmitPasskey_Returns}
   *
   * @since 2.0.0
   */
  const submitPasskey: Web_SecurityView_SecurityView_SubmitPasskey = async (event: Web_SecurityView_SecurityView_SubmitPasskey_Event): Web_SecurityView_SecurityView_SubmitPasskey_Returns => {
    event.preventDefault();

    await run(async () => {
      await addPasskey(passkeyName, passkeyPassword);
      setPasskeyName('');
      setPasskeyPassword('');

      return;
    }, 'Passkey added.', 'passkey');

    return;
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

  const role: Web_SecurityView_SecurityView_Role = security['role'];
  const roleLabel: Web_SecurityView_SecurityView_RoleLabel = (role === undefined) ? undefined : appConfig['roleLabels'][role];
  const removingPasskeyName: Web_SecurityView_SecurityView_RemovingPasskeyName = (removingPasskey === null) ? 'passkey' : removingPasskey['name'];

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
              <input aria-invalid={issueIn('password', 'currentPassword') !== ''} autoComplete="current-password" onChange={(event) => setCurrentPassword(event.currentTarget.value)} type="password" value={currentPassword} />
              {fieldIssue('password', 'currentPassword')}
            </FieldLabel>
            <div className="field-row">
              <FieldLabel>
                <span>New password</span>
                <input
                  aria-invalid={issueIn('password', 'newPassword') !== ''}
                  autoComplete="new-password"
                  onChange={(event) => {
                    setNewPassword(event.currentTarget.value);
                    setPasswordMismatch(false);

                    return;
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
                  onChange={(event) => {
                    setConfirmPassword(event.currentTarget.value);
                    setPasswordMismatch(false);

                    return;
                  }}
                  type="password"
                  value={confirmPassword}
                />
                {(passwordMismatch === true) ? <small className="field-error">{'The new passwords don\'t match.'}</small> : null}
              </FieldLabel>
            </div>
            <div className="panel-actions">
              <Button
                disabled={(
                  busy === true
                  || currentPassword === ''
                  || newPassword === ''
                )}
                type="submit"
              >
                Change password
              </Button>
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
                <input aria-invalid={issueIn('username', 'username') !== ''} autoCapitalize="none" autoComplete="username" onChange={(event) => setNewUsername(event.currentTarget.value)} spellCheck={false} value={newUsername} />
                {fieldIssue('username', 'username')}
              </FieldLabel>
              <FieldLabel>
                <span>Your password</span>
                <input aria-invalid={issueIn('username', 'password') !== ''} autoComplete="current-password" onChange={(event) => setUsernamePassword(event.currentTarget.value)} type="password" value={usernamePassword} />
                {fieldIssue('username', 'password')}
              </FieldLabel>
            </div>
            <div className="panel-actions">
              <Button
                disabled={(
                  busy === true
                  || newUsername.trim() === ''
                  || usernamePassword === ''
                )}
                type="submit"
              >
                Change username
              </Button>
            </div>
          </form>
        </section>

        <section className="form-section">
          <div className="form-section-head">
            <h2>Authenticator app</h2>
            <span className={(security['totpEnabled'] === true) ? 'security-state security-state-on' : 'security-state'}>
              {(security['totpEnabled'] === true) ? `On · ${security['recoveryCodesRemaining']} recovery codes left` : 'Off'}
            </span>
          </div>

          {(security['totpEnabled'] === true) ? (
            <div className="panel-actions panel-actions-start">
              <Button disabled={busy} onClick={() => setTotpMode('recovery')}>New recovery codes</Button>
              <Button disabled={busy} onClick={() => setTotpMode('disable')} variant="danger">Turn off</Button>
            </div>
          ) : (
            <div className="security-row">
              <p className="form-section-note">Ask for a 6&#8209;digit code from an app like 1Password, Google Authenticator or Authy after your password.</p>
              <Button disabled={busy} onClick={() => setTotpMode('setup')}>Set up</Button>
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
                    onClick={() => {
                      setError(null);
                      setRemovingPasskey(passkey);

                      return;
                    }}
                    variant="danger"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}

          {(security['passkeysAvailable'] === true) ? (
            <form className="security-form" noValidate onSubmit={submitPasskey}>
              <div className="field-row">
                <FieldLabel>
                  <span>Passkey name</span>
                  <input aria-invalid={issueIn('passkey', 'name') !== ''} onChange={(event) => setPasskeyName(event.currentTarget.value)} placeholder="e.g. My laptop" value={passkeyName} />
                  {fieldIssue('passkey', 'name')}
                </FieldLabel>
                <FieldLabel>
                  <span>Your password</span>
                  <input aria-invalid={issueIn('passkey', 'password') !== ''} autoComplete="current-password" onChange={(event) => setPasskeyPassword(event.currentTarget.value)} type="password" value={passkeyPassword} />
                  {fieldIssue('passkey', 'password')}
                </FieldLabel>
              </div>
              <div className="panel-actions">
                <Button
                  disabled={(
                    busy === true
                    || passkeyName.trim() === ''
                    || passkeyPassword === ''
                  )}
                  icon="add"
                  type="submit"
                >
                  Add passkey
                </Button>
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
        onClose={() => setTotpMode(null)}
      />

      <ConfirmDialog
        busy={busy}
        busyLabel="Removing…"
        confirmDisabled={removePassword === ''}
        confirmLabel="Remove passkey"
        error={(errorContext === 'prompt') ? summaryFor(error, shownFields['prompt'], 'The passkey could not be removed.') : ''}
        message="It stops working right away. Enter your account password to remove it."
        onCancel={closeRemove}
        onConfirm={() => {
          void submitRemovePasskey();

          return;
        }}
        open={removingPasskey !== null}
        title={`Remove ${removingPasskeyName}?`}
      >
        <FieldLabel>
          <span>Password</span>
          <input
            aria-invalid={issueIn('prompt', 'password') !== ''}
            autoComplete="current-password"
            onChange={(event) => setRemovePassword(event.currentTarget.value)}
            type="password"
            value={removePassword}
          />
          {fieldIssue('prompt', 'password')}
        </FieldLabel>
      </ConfirmDialog>
    </section>
  );
};
