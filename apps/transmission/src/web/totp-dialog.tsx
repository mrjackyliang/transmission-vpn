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
import { showToast } from '@/web/toast.ts';
import { useDialogFocus } from '@/web/use-dialog-focus.ts';
import { useEscapeKey } from '@/web/use-escape-key.ts';

import type {
  ClipboardEvent,
  FormEvent,
  ReactElement,
} from 'react';

import type {
  Web_Api_RecoveryCodes,
  Web_Api_TotpSetup,
} from '@/types/web/api.d.ts';
import type {
  Web_Components_TotpDialog_Props,
  Web_Components_TotpDialog_Step,
} from '@/types/web/components.d.ts';

/**
 * TOTP Dialog.
 *
 * Sets up, replaces the recovery codes of, or turns off the authenticator in one dialog.
 * Each starts with the account password. Setup then shows the QR code
 * and ends with the recovery codes.
 *
 * @since 2.0.0
 */
export const TotpDialog = ({
  mode,
  onAuthenticatorEnabled,
  onChanged,
  onClose,
}: Web_Components_TotpDialog_Props): ReactElement | null => {
  const [
    step,
    setStep,
  ] = useState<Web_Components_TotpDialog_Step>('password');
  const [
    password,
    setPassword,
  ] = useState<string>('');
  const [
    setup,
    setSetup,
  ] = useState<Web_Api_TotpSetup | null>(null);
  const [
    code,
    setCode,
  ] = useState<string>('');
  const [
    recoveryCodes,
    setRecoveryCodes,
  ] = useState<string[]>([]);
  const [
    saved,
    setSaved,
  ] = useState<boolean>(false);
  const [
    busy,
    setBusy,
  ] = useState<boolean>(false);
  const [
    error,
    setError,
  ] = useState<unknown>(null);
  const titleId: string = useId();
  const open: boolean = mode !== null;
  const dialogRef = useDialogFocus(open, step);

  // Each opening starts over, so a closed setup never shows its old QR code or codes.
  useEffect((): void => {
    setStep('password');
    setPassword('');
    setSetup(null);
    setCode('');
    setRecoveryCodes([]);
    setSaved(false);
    setError(null);
  }, [mode]);

  // The recovery codes can't be shown again, so only Done closes that step.
  useEscapeKey((): void => {
    if (!busy && step !== 'codes') {
      onClose();
    }
  }, open);

  if (mode === null) {
    return null;
  }

  /**
   * TOTP Dialog - Submit password.
   *
   * Sends the password with the request the mode needs, then moves to the next step,
   * or closes the dialog when turning the authenticator off.
   *
   * @since 2.0.0
   */
  const submitPassword = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      if (mode === 'setup') {
        setSetup(await startTotpSetup(password));
        setStep('scan');
      } else if (mode === 'recovery') {
        const result: Web_Api_RecoveryCodes = await regenerateRecoveryCodes(password);

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
  };

  /**
   * TOTP Dialog - Submit code.
   *
   * Turns the authenticator on with the first code from the app,
   * then shows the recovery codes the server made with it.
   *
   * @since 2.0.0
   */
  const submitCode = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const result: Web_Api_RecoveryCodes = await enableTotp(code);

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
  };

  /**
   * TOTP Dialog - Copy text.
   *
   * Copies the setup key or the recovery codes and confirms it with a toast.
   * A browser that blocks copying gets an error toast instead.
   *
   * @since 2.0.0
   */
  const copyText = async (text: string, message: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(message, true);
    } catch {
      showToast('Copying isn\'t allowed here. Select the text and copy it instead.', false);
    }
  };

  /**
   * TOTP Dialog - Copy key selection.
   *
   * Copies a selected setup key without the gaps between its blocks,
   * so it pastes as one line, the same as the Copy button.
   *
   * @since 2.0.0
   */
  const copyKeySelection = (event: ClipboardEvent<HTMLElement>): void => {
    const selected: string = (window.getSelection()?.toString() ?? '').replace(/\s+/gu, '');

    if (selected === '') {
      return;
    }

    event.preventDefault();
    event.clipboardData.setData('text/plain', selected);
  };

  /**
   * TOTP Dialog - Download codes.
   *
   * Saves the recovery codes as a text file.
   * The file names the address the dashboard was opened at.
   *
   * @since 2.0.0
   */
  const downloadCodes = (): void => {
    const lines: string[] = [
      `${appConfig['appName']} recovery codes for ${window.location.host}`,
      '',
      ...recoveryCodes,
      '',
      'Each code works once.',
    ];
    const blob: Blob = new Blob([`${lines.join('\n')}\n`], { type: 'text/plain' });
    const url: string = URL.createObjectURL(blob);
    const link: HTMLAnchorElement = document.createElement('a');

    link.href = url;
    link.download = appConfig['recoveryCodeFileName'];
    link.click();
    URL.revokeObjectURL(url);
  };

  /**
   * TOTP Dialog - Finish.
   *
   * Closes the recovery codes step once they are saved.
   * A toast confirms the authenticator change.
   *
   * @since 2.0.0
   */
  const finish = (): void => {
    showToast((mode === 'setup') ? 'Authenticator turned on.' : 'New recovery codes made. The old ones no longer work.', true);
    onClose();
  };

  const totalSteps: number = (mode === 'setup') ? 3 : 2;
  const stepNumber: number = {
    codes: totalSteps,
    password: 1,
    scan: 2,
  }[step];
  const stepLabel: string = (mode === 'disable') ? '' : `Step ${stepNumber} of ${totalSteps}`;
  // The key shows in blocks of four, so it reads and wraps like it does in authenticator apps.
  const secretOffsets: number[] = [...Array(Math.ceil(((setup === null) ? 0 : setup['secret'].length) / 4)).keys()].map((group: number): number => group * 4);
  const passwordIssue: string = issueFor(error, 'password');
  const codeIssue: string = issueFor(error, 'code');
  const summary: string = summaryFor(error, [
    'code',
    'password',
  ], 'That didn\'t work. Try again.');
  let title: string = 'Set up authenticator';
  let description: string = 'Enter your account password to continue.';

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

  const errorBanner: ReactElement | null = (summary === '') ? null : (
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
                onChange={(event): void => setPassword(event.currentTarget.value)}
                type="password"
                value={password}
              />
              {(passwordIssue === '') ? null : <small className="field-error">{passwordIssue}</small>}
            </FieldLabel>
            {errorBanner}
            <div className="dialog-actions">
              <Button disabled={busy} onClick={onClose}>Cancel</Button>
              <Button disabled={busy || password === ''} type="submit" variant={(mode === 'disable') ? 'danger' : 'primary'}>
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
                      onClick={(): void => {
                        void copyText(setup['secret'], 'Setup key copied.');
                      }}
                      type="button"
                    >
                      <Icon name="copy" size={14} />
                      Copy
                    </button>
                  </div>
                  <code className="totp-secret" onCopy={copyKeySelection}>
                    {secretOffsets.map((offset: number): ReactElement => <span key={offset}>{setup['secret'].slice(offset, offset + 4)}</span>)}
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
                    onChange={(event): void => setCode(event.currentTarget.value)}
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
              <Button disabled={busy || code.trim().length !== 6} type="submit" variant="primary">Turn on</Button>
            </div>
          </form>
        ) : null}

        {(step === 'codes') ? (
          <div className="totp-codes">
            <ol className="recovery-codes">
              {recoveryCodes.map((recoveryCode: string): ReactElement => <li key={recoveryCode}>{recoveryCode}</li>)}
            </ol>
            <div className="panel-actions panel-actions-start">
              <Button
                icon="copy"
                onClick={(): void => {
                  void copyText(recoveryCodes.join('\n'), 'Recovery codes copied.');
                }}
              >
                Copy all
              </Button>
              <Button icon="download" onClick={downloadCodes}>Download .txt</Button>
            </div>
            <label className="check-row">
              <input checked={saved} onChange={(event): void => setSaved(event.currentTarget.checked)} type="checkbox" />
              <span>I saved these codes</span>
            </label>
            <div className="dialog-actions">
              <Button disabled={!saved} onClick={finish} variant="primary">Done</Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
};
