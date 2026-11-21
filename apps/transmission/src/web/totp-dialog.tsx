import {
  useEffect,
  useId,
  useState,
} from 'react';

import {
  disableTotp,
  enableTotp,
  issueFor,
  regenerateRecoveryCodes,
  startTotpSetup,
  summaryFor,
} from '@/web/api.ts';
import { appConfig } from '@/web/app-config.ts';
import { FieldLabel } from '@/web/field-label.tsx';
import {
  Button,
  Icon,
} from '@/web/primitives.tsx';
import { whitespacePattern } from '@/web/regex.js';
import { showToast } from '@/web/toast.ts';
import { useDialogFocus } from '@/web/use-dialog-focus.ts';
import { useEscapeKey } from '@/web/use-escape-key.ts';

import type { Web_Components_TotpDialog_Props } from '@/types/web/components.d.ts';
import type {
  Web_TotpDialog_TotpDialog_Busy,
  Web_TotpDialog_TotpDialog_BusyState,
  Web_TotpDialog_TotpDialog_Code,
  Web_TotpDialog_TotpDialog_CodeIssue,
  Web_TotpDialog_TotpDialog_CodeState,
  Web_TotpDialog_TotpDialog_CopyKeySelection,
  Web_TotpDialog_TotpDialog_CopyKeySelection_Event,
  Web_TotpDialog_TotpDialog_CopyKeySelection_Returns,
  Web_TotpDialog_TotpDialog_CopyKeySelection_Selected,
  Web_TotpDialog_TotpDialog_CopyKeySelection_Selection,
  Web_TotpDialog_TotpDialog_CopyText,
  Web_TotpDialog_TotpDialog_CopyText_Message,
  Web_TotpDialog_TotpDialog_CopyText_Returns,
  Web_TotpDialog_TotpDialog_CopyText_Text,
  Web_TotpDialog_TotpDialog_Description,
  Web_TotpDialog_TotpDialog_DialogRef,
  Web_TotpDialog_TotpDialog_DownloadCodes,
  Web_TotpDialog_TotpDialog_DownloadCodes_Blob,
  Web_TotpDialog_TotpDialog_DownloadCodes_Lines,
  Web_TotpDialog_TotpDialog_DownloadCodes_Link,
  Web_TotpDialog_TotpDialog_DownloadCodes_Returns,
  Web_TotpDialog_TotpDialog_DownloadCodes_Url,
  Web_TotpDialog_TotpDialog_Error,
  Web_TotpDialog_TotpDialog_ErrorBanner,
  Web_TotpDialog_TotpDialog_ErrorState,
  Web_TotpDialog_TotpDialog_Finish,
  Web_TotpDialog_TotpDialog_Finish_Returns,
  Web_TotpDialog_TotpDialog_Mode,
  Web_TotpDialog_TotpDialog_OnAuthenticatorEnabled,
  Web_TotpDialog_TotpDialog_OnChanged,
  Web_TotpDialog_TotpDialog_OnClose,
  Web_TotpDialog_TotpDialog_Open,
  Web_TotpDialog_TotpDialog_Password,
  Web_TotpDialog_TotpDialog_PasswordIssue,
  Web_TotpDialog_TotpDialog_PasswordState,
  Web_TotpDialog_TotpDialog_RecoveryCodes,
  Web_TotpDialog_TotpDialog_RecoveryCodesState,
  Web_TotpDialog_TotpDialog_Returns,
  Web_TotpDialog_TotpDialog_Saved,
  Web_TotpDialog_TotpDialog_SavedState,
  Web_TotpDialog_TotpDialog_SecretOffsets,
  Web_TotpDialog_TotpDialog_SetBusy,
  Web_TotpDialog_TotpDialog_SetCode,
  Web_TotpDialog_TotpDialog_SetError,
  Web_TotpDialog_TotpDialog_SetPassword,
  Web_TotpDialog_TotpDialog_SetRecoveryCodes,
  Web_TotpDialog_TotpDialog_SetSaved,
  Web_TotpDialog_TotpDialog_SetSetup,
  Web_TotpDialog_TotpDialog_SetStep,
  Web_TotpDialog_TotpDialog_Setup,
  Web_TotpDialog_TotpDialog_SetupState,
  Web_TotpDialog_TotpDialog_Step,
  Web_TotpDialog_TotpDialog_StepLabel,
  Web_TotpDialog_TotpDialog_StepNumber,
  Web_TotpDialog_TotpDialog_StepState,
  Web_TotpDialog_TotpDialog_SubmitCode,
  Web_TotpDialog_TotpDialog_SubmitCode_Event,
  Web_TotpDialog_TotpDialog_SubmitCode_Result,
  Web_TotpDialog_TotpDialog_SubmitCode_Returns,
  Web_TotpDialog_TotpDialog_SubmitPassword,
  Web_TotpDialog_TotpDialog_SubmitPassword_Event,
  Web_TotpDialog_TotpDialog_SubmitPassword_Result,
  Web_TotpDialog_TotpDialog_SubmitPassword_Returns,
  Web_TotpDialog_TotpDialog_Summary,
  Web_TotpDialog_TotpDialog_Title,
  Web_TotpDialog_TotpDialog_TitleId,
  Web_TotpDialog_TotpDialog_TotalSteps,
} from '@/types/web/totp-dialog.d.ts';

/**
 * Totp Dialog - Totp Dialog.
 *
 * Sets up, replaces the recovery codes of, or turns off the authenticator in one dialog.
 * Each starts with the account password. Setup then shows the QR code
 * and ends with the recovery codes.
 *
 * @param {Web_Components_TotpDialog_Props} props - Props.
 *
 * @returns {Web_TotpDialog_TotpDialog_Returns}
 *
 * @since 2.0.0
 */
export const TotpDialog = (props: Web_Components_TotpDialog_Props): Web_TotpDialog_TotpDialog_Returns => {
  const mode: Web_TotpDialog_TotpDialog_Mode = props['mode'];
  const onAuthenticatorEnabled: Web_TotpDialog_TotpDialog_OnAuthenticatorEnabled = props['onAuthenticatorEnabled'];
  const onChanged: Web_TotpDialog_TotpDialog_OnChanged = props['onChanged'];
  const onClose: Web_TotpDialog_TotpDialog_OnClose = props['onClose'];
  const stepState: Web_TotpDialog_TotpDialog_StepState = useState<Web_TotpDialog_TotpDialog_Step>('password');
  const step: Web_TotpDialog_TotpDialog_Step = stepState[0];
  const setStep: Web_TotpDialog_TotpDialog_SetStep = stepState[1];
  const passwordState: Web_TotpDialog_TotpDialog_PasswordState = useState<Web_TotpDialog_TotpDialog_Password>('');
  const password: Web_TotpDialog_TotpDialog_Password = passwordState[0];
  const setPassword: Web_TotpDialog_TotpDialog_SetPassword = passwordState[1];
  const setupState: Web_TotpDialog_TotpDialog_SetupState = useState<Web_TotpDialog_TotpDialog_Setup>(null);
  const setup: Web_TotpDialog_TotpDialog_Setup = setupState[0];
  const setSetup: Web_TotpDialog_TotpDialog_SetSetup = setupState[1];
  const codeState: Web_TotpDialog_TotpDialog_CodeState = useState<Web_TotpDialog_TotpDialog_Code>('');
  const code: Web_TotpDialog_TotpDialog_Code = codeState[0];
  const setCode: Web_TotpDialog_TotpDialog_SetCode = codeState[1];
  const recoveryCodesState: Web_TotpDialog_TotpDialog_RecoveryCodesState = useState<Web_TotpDialog_TotpDialog_RecoveryCodes>([]);
  const recoveryCodes: Web_TotpDialog_TotpDialog_RecoveryCodes = recoveryCodesState[0];
  const setRecoveryCodes: Web_TotpDialog_TotpDialog_SetRecoveryCodes = recoveryCodesState[1];
  const savedState: Web_TotpDialog_TotpDialog_SavedState = useState<Web_TotpDialog_TotpDialog_Saved>(false);
  const saved: Web_TotpDialog_TotpDialog_Saved = savedState[0];
  const setSaved: Web_TotpDialog_TotpDialog_SetSaved = savedState[1];
  const busyState: Web_TotpDialog_TotpDialog_BusyState = useState<Web_TotpDialog_TotpDialog_Busy>(false);
  const busy: Web_TotpDialog_TotpDialog_Busy = busyState[0];
  const setBusy: Web_TotpDialog_TotpDialog_SetBusy = busyState[1];
  const errorState: Web_TotpDialog_TotpDialog_ErrorState = useState<Web_TotpDialog_TotpDialog_Error>(null);
  const error: Web_TotpDialog_TotpDialog_Error = errorState[0];
  const setError: Web_TotpDialog_TotpDialog_SetError = errorState[1];
  const titleId: Web_TotpDialog_TotpDialog_TitleId = useId();
  const open: Web_TotpDialog_TotpDialog_Open = mode !== null;
  const dialogRef: Web_TotpDialog_TotpDialog_DialogRef = useDialogFocus(open, step);

  // Each opening starts over, so a closed setup never shows its old QR code or codes.
  useEffect(() => {
    setStep('password');
    setPassword('');
    setSetup(null);
    setCode('');
    setRecoveryCodes([]);
    setSaved(false);
    setError(null);

    return;
  }, [mode]);

  // The recovery codes can't be shown again, so only Done closes that step.
  useEscapeKey(() => {
    if (busy === false && step !== 'codes') {
      onClose();
    }

    return;
  }, open);

  if (mode === null) {
    return null;
  }

  /**
   * Totp Dialog - Submit Password.
   *
   * Sends the password with the request the mode needs, then moves to the next step,
   * or closes the dialog when turning the authenticator off.
   *
   * @param {Web_TotpDialog_TotpDialog_SubmitPassword_Event} event - Event.
   *
   * @returns {Web_TotpDialog_TotpDialog_SubmitPassword_Returns}
   *
   * @since 2.0.0
   */
  const submitPassword: Web_TotpDialog_TotpDialog_SubmitPassword = async (event: Web_TotpDialog_TotpDialog_SubmitPassword_Event): Web_TotpDialog_TotpDialog_SubmitPassword_Returns => {
    event.preventDefault();

    setBusy(true);
    setError(null);

    try {
      if (mode === 'setup') {
        setSetup(await startTotpSetup(password));
        setStep('scan');
      } else if (mode === 'recovery') {
        const result: Web_TotpDialog_TotpDialog_SubmitPassword_Result = await regenerateRecoveryCodes(password);

        setRecoveryCodes(result['recoveryCodes']);
        setStep('codes');
        await onChanged();
      } else {
        await disableTotp(password);
        await onChanged();
        showToast('Authenticator turned off.', true);
        onClose();
      }

      setPassword('');
    } catch (caughtError) {
      setError(caughtError);
    } finally {
      setBusy(false);
    }

    return;
  };

  /**
   * Totp Dialog - Submit Code.
   *
   * Turns the authenticator on with the first code from the app,
   * then shows the recovery codes the server made with it.
   *
   * @param {Web_TotpDialog_TotpDialog_SubmitCode_Event} event - Event.
   *
   * @returns {Web_TotpDialog_TotpDialog_SubmitCode_Returns}
   *
   * @since 2.0.0
   */
  const submitCode: Web_TotpDialog_TotpDialog_SubmitCode = async (event: Web_TotpDialog_TotpDialog_SubmitCode_Event): Web_TotpDialog_TotpDialog_SubmitCode_Returns => {
    event.preventDefault();

    setBusy(true);
    setError(null);

    try {
      const result: Web_TotpDialog_TotpDialog_SubmitCode_Result = await enableTotp(code);

      setRecoveryCodes(result['recoveryCodes']);
      setSetup(null);
      setCode('');
      setStep('codes');
      onAuthenticatorEnabled();
      await onChanged();
    } catch (caughtError) {
      setError(caughtError);
    } finally {
      setBusy(false);
    }

    return;
  };

  /**
   * Totp Dialog - Copy Text.
   *
   * Copies the setup key or the recovery codes and confirms it with a toast.
   * A browser that blocks copying gets an error toast instead.
   *
   * @param {Web_TotpDialog_TotpDialog_CopyText_Text}    text    - Text.
   * @param {Web_TotpDialog_TotpDialog_CopyText_Message} message - Message.
   *
   * @returns {Web_TotpDialog_TotpDialog_CopyText_Returns}
   *
   * @since 2.0.0
   */
  const copyText: Web_TotpDialog_TotpDialog_CopyText = async (text: Web_TotpDialog_TotpDialog_CopyText_Text, message: Web_TotpDialog_TotpDialog_CopyText_Message): Web_TotpDialog_TotpDialog_CopyText_Returns => {
    try {
      await navigator.clipboard.writeText(text);

      showToast(message, true);
    } catch {
      showToast('Copying isn\'t allowed here. Select the text and copy it instead.', false);
    }

    return;
  };

  /**
   * Totp Dialog - Copy Key Selection.
   *
   * Copies a selected setup key without the gaps between its blocks,
   * so it pastes as one line, the same as the Copy button.
   *
   * @param {Web_TotpDialog_TotpDialog_CopyKeySelection_Event} event - Event.
   *
   * @returns {Web_TotpDialog_TotpDialog_CopyKeySelection_Returns}
   *
   * @since 2.0.0
   */
  const copyKeySelection: Web_TotpDialog_TotpDialog_CopyKeySelection = (event: Web_TotpDialog_TotpDialog_CopyKeySelection_Event): Web_TotpDialog_TotpDialog_CopyKeySelection_Returns => {
    const selection: Web_TotpDialog_TotpDialog_CopyKeySelection_Selection = window.getSelection();
    const selected: Web_TotpDialog_TotpDialog_CopyKeySelection_Selected = ((selection === null) ? '' : selection.toString()).replace(new RegExp(whitespacePattern, 'gu'), '');

    if (selected === '') {
      return;
    }

    event.preventDefault();

    event.clipboardData.setData('text/plain', selected);

    return;
  };

  /**
   * Totp Dialog - Download Codes.
   *
   * Saves the recovery codes as a text file.
   * The file names the address the dashboard was opened at.
   *
   * @returns {Web_TotpDialog_TotpDialog_DownloadCodes_Returns}
   *
   * @since 2.0.0
   */
  const downloadCodes: Web_TotpDialog_TotpDialog_DownloadCodes = (): Web_TotpDialog_TotpDialog_DownloadCodes_Returns => {
    const lines: Web_TotpDialog_TotpDialog_DownloadCodes_Lines = [
      `${appConfig['appName']} recovery codes for ${window.location.host}`,
      '',
      ...recoveryCodes,
      '',
      'Each code works once.',
    ];
    const blob: Web_TotpDialog_TotpDialog_DownloadCodes_Blob = new Blob([`${lines.join('\n')}\n`], { type: 'text/plain' });
    const url: Web_TotpDialog_TotpDialog_DownloadCodes_Url = URL.createObjectURL(blob);
    const link: Web_TotpDialog_TotpDialog_DownloadCodes_Link = document.createElement('a');

    link.href = url;
    link.download = appConfig['recoveryCodeFileName'];
    link.click();

    URL.revokeObjectURL(url);

    return;
  };

  /**
   * Totp Dialog - Finish.
   *
   * Closes the recovery codes step once they are saved.
   * A toast confirms the authenticator change.
   *
   * @returns {Web_TotpDialog_TotpDialog_Finish_Returns}
   *
   * @since 2.0.0
   */
  const finish: Web_TotpDialog_TotpDialog_Finish = (): Web_TotpDialog_TotpDialog_Finish_Returns => {
    showToast((mode === 'setup') ? 'Authenticator turned on.' : 'New recovery codes made. The old ones no longer work.', true);
    onClose();

    return;
  };

  const totalSteps: Web_TotpDialog_TotpDialog_TotalSteps = (mode === 'setup') ? 3 : 2;
  const stepNumber: Web_TotpDialog_TotpDialog_StepNumber = {
    codes: totalSteps,
    password: 1,
    scan: 2,
  }[step];
  const stepLabel: Web_TotpDialog_TotpDialog_StepLabel = (mode === 'disable') ? '' : `Step ${stepNumber} of ${totalSteps}`;

  // The key shows in blocks of four, so it reads and wraps like it does in authenticator apps.
  const secretOffsets: Web_TotpDialog_TotpDialog_SecretOffsets = [...Array(Math.ceil(((setup === null) ? 0 : setup['secret'].length) / 4)).keys()].map((group) => group * 4);
  const passwordIssue: Web_TotpDialog_TotpDialog_PasswordIssue = issueFor(error, 'password');
  const codeIssue: Web_TotpDialog_TotpDialog_CodeIssue = issueFor(error, 'code');
  const summary: Web_TotpDialog_TotpDialog_Summary = summaryFor(error, [
    'code',
    'password',
  ], 'That didn\'t work. Try again.');
  let title: Web_TotpDialog_TotpDialog_Title = 'Set up authenticator';
  let description: Web_TotpDialog_TotpDialog_Description = 'Enter your account password to continue.';

  if (step === 'codes') {
    title = 'Save your recovery codes';
    description = (mode === 'setup') ? 'Each code works once if you lose your authenticator. They won\'t be shown again.' : 'Each code works once if you lose your authenticator. Your old codes no longer work, and these won\'t be shown again.';
  } else if (step === 'scan') {
    description = 'Scan the QR code with your authenticator app, then enter the 6‑digit code it shows.';
  } else if (mode === 'recovery') {
    title = 'New recovery codes';
    description = 'Enter your account password. Your current recovery codes stop working.';
  } else if (mode === 'disable') {
    title = 'Turn off authenticator';
    description = 'Enter your account password. Sign-in stops asking for a code, and your recovery codes stop working.';
  }

  const errorBanner: Web_TotpDialog_TotpDialog_ErrorBanner = (summary === '') ? null : (
    <div className="form-error" role="alert">
      <Icon name="warning" size={16} />
      <span>{summary}</span>
    </div>
  );

  return (
    <div className="dialog-backdrop" role="presentation">
      <section aria-labelledby={titleId} aria-modal="true" className="dialog totp-dialog" ref={dialogRef} role="dialog" tabIndex={-1}>
        <div className="dialog-heading dialog-heading-stepped">
          <h2 id={titleId}>{title}</h2>
          <div className="dialog-heading-end">
            {(stepLabel === '') ? null : <span className="dialog-step">{stepLabel}</span>}
            {(step === 'codes') ? null : (
              <button aria-label="Close" className="icon-button" disabled={busy} onClick={onClose} type="button">
                <Icon name="x" size={18} />
              </button>
            )}
          </div>
          <p>{description}</p>
        </div>

        {(step === 'password') ? (
          <form noValidate onSubmit={submitPassword}>
            <FieldLabel>
              <span>Password</span>
              <input
                aria-invalid={passwordIssue !== ''}
                autoComplete="current-password"
                onChange={(event) => setPassword(event.currentTarget.value)}
                type="password"
                value={password}
              />
              {(passwordIssue === '') ? null : <small className="field-error">{passwordIssue}</small>}
            </FieldLabel>
            {errorBanner}
            <div className="dialog-actions">
              <Button disabled={busy} onClick={onClose}>Cancel</Button>
              <Button disabled={busy === true || password === ''} type="submit" variant={(mode === 'disable') ? 'danger' : 'primary'}>
                {(mode === 'setup') ? 'Continue' : null}
                {(mode === 'recovery') ? 'Make new codes' : null}
                {(mode === 'disable') ? 'Turn off' : null}
              </Button>
            </div>
          </form>
        ) : null}

        {(step === 'scan' && setup !== null) ? (
          <form noValidate onSubmit={submitCode}>
            <div className="totp-scan">
              <img alt="QR code for your authenticator app" className="totp-qr" height={160} src={setup['qrCode']} width={160} />
              <div className="totp-scan-fields">
                <div className="totp-key">
                  <div className="totp-key-head">
                    <span>Setup key</span>
                    <button
                      className="text-button"
                      onClick={() => {
                        void copyText(setup['secret'], 'Setup key copied.');

                        return;
                      }}
                      type="button"
                    >
                      <Icon name="copy" size={14} />
                      Copy
                    </button>
                  </div>
                  <code className="totp-secret" onCopy={copyKeySelection}>
                    {secretOffsets.map((offset) => <span key={offset}>{setup['secret'].slice(offset, offset + 4)}</span>)}
                  </code>
                </div>
                <FieldLabel>
                  <span>Code</span>
                  <input
                    aria-invalid={codeIssue !== ''}
                    autoComplete="one-time-code"
                    className="monospace"
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(event) => setCode(event.currentTarget.value)}
                    placeholder="123456"
                    value={code}
                  />
                  {(codeIssue === '') ? null : <small className="field-error">{codeIssue}</small>}
                </FieldLabel>
              </div>
            </div>
            {errorBanner}
            <div className="dialog-actions">
              <Button disabled={busy} onClick={onClose}>Cancel</Button>
              <Button disabled={busy === true || code.trim().length !== 6} type="submit" variant="primary">Turn on</Button>
            </div>
          </form>
        ) : null}

        {(step === 'codes') ? (
          <div className="totp-codes">
            <ol className="recovery-codes">
              {recoveryCodes.map((recoveryCode) => <li key={recoveryCode}>{recoveryCode}</li>)}
            </ol>
            <div className="panel-actions panel-actions-start">
              <Button
                icon="copy"
                onClick={() => {
                  void copyText(recoveryCodes.join('\n'), 'Recovery codes copied.');

                  return;
                }}
              >
                Copy all
              </Button>
              <Button icon="download" onClick={downloadCodes}>Download .txt</Button>
            </div>
            <label className="check-row">
              <input checked={saved} onChange={(event) => setSaved(event.currentTarget.checked)} type="checkbox" />
              <span>I saved these codes</span>
            </label>
            <div className="dialog-actions">
              <Button disabled={saved === false} onClick={finish} variant="primary">Done</Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
};
