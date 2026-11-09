import { useState } from 'react';

import {
  ApiError,
  claimInstallation,
  issueFor,
  login,
  signInWithPasskey,
  submitSecondFactor,
  summaryFor,
} from '@/web/api.ts';
import { appConfig } from '@/web/app-config.ts';
import { FieldLabel } from '@/web/field-label.tsx';
import { passkeysSupported } from '@/web/passkeys.ts';
import { PasswordMeter } from '@/web/password-meter.tsx';
import {
  BrandMark,
  Button,
  Icon,
} from '@/web/primitives.tsx';

import type {
  FormEvent,
  ReactElement,
} from 'react';

import type { Web_Api_LoginResult } from '@/types/web/api.d.ts';
import type { Web_Components_AuthenticationScreen_Props } from '@/types/web/components.d.ts';

/**
 * Auth Screen - Authentication screen.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const AuthenticationScreen = ({
  mode,
  onSignedIn,
}: Web_Components_AuthenticationScreen_Props): ReactElement => {
  const [
    claimCode,
    setClaimCode,
  ] = useState<string>('');
  const [
    username,
    setUsername,
  ] = useState<string>('');
  const [
    password,
    setPassword,
  ] = useState<string>('');
  const [
    confirmation,
    setConfirmation,
  ] = useState<string>('');
  const [
    challenge,
    setChallenge,
  ] = useState<string>('');
  const [
    code,
    setCode,
  ] = useState<string>('');
  const [
    error,
    setError,
  ] = useState<unknown>(null);
  const [
    submitting,
    setSubmitting,
  ] = useState<boolean>(false);

  const isClaim: boolean = mode === 'claim';
  const secondFactorStep: boolean = challenge !== '';
  const showPasskey: boolean = !isClaim && !secondFactorStep && passkeysSupported();
  const summary: string = summaryFor(error, [
    'claimCode',
    'code',
    'password',
    'username',
  ], 'Sign-in failed. Try again.');

  /**
   * Auth Screen - Handles submit.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);

    if (isClaim && password !== confirmation) {
      setError(new Error('The two passwords don\'t match.'));

      return;
    }

    setSubmitting(true);
    try {
      if (secondFactorStep) {
        await submitSecondFactor(challenge, code);
        await onSignedIn();

        return;
      }

      if (isClaim) {
        await claimInstallation({
          claimCode,
          password,
          username,
        });
        await onSignedIn();

        return;
      }

      const result: Web_Api_LoginResult = await login({
        password,
        username,
      });

      if (result['status'] === 'second_factor_required') {
        setChallenge(result['challenge']);
        setPassword('');

        return;
      }

      await onSignedIn();
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.code === 'challenge_expired') {
        setChallenge('');
        setCode('');
      }

      setError(caughtError);
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Auth Screen - Handles passkey.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const handlePasskey = async (): Promise<void> => {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithPasskey();
      await onSignedIn();
    } catch (caughtError) {
      setError((caughtError instanceof Error) ? caughtError : new Error('Passkey sign-in failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  let heading: string = 'Sign in';
  let description: string = 'Use your account to continue.';
  let submitLabel: string = 'Sign in';

  if (isClaim) {
    heading = 'Set up your account';
    description = 'Enter the one-time code from the container log, then choose a username and password.';
    submitLabel = 'Create account';
  } else if (secondFactorStep) {
    heading = 'Enter your code';
    description = 'Open your authenticator app and enter the 6\u2011digit code, or use one of your recovery codes.';
    submitLabel = 'Verify';
  }

  /**
   * Auth Screen - Field issue.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const fieldIssue = (field: string): ReactElement | null => {
    const message: string = issueFor(error, field);

    return (message === '') ? null : <small className="field-error">{message}</small>;
  };

  return (
    <main className="auth-page">
      <div className="auth-column">
        <div className="brand">
          <BrandMark />
          <span>{appConfig['brandName']}</span>
        </div>

        <form className="auth-card" noValidate onSubmit={handleSubmit}>
          <div className="auth-heading">
            <h1>{heading}</h1>
            <p>{description}</p>
          </div>

          <div className="auth-fields">
            {(isClaim) ? (
              <FieldLabel>
                <span>One-time code</span>
                <input
                  aria-invalid={issueFor(error, 'claimCode') !== ''}
                  autoComplete="one-time-code"
                  className="monospace"
                  onChange={(event): void => setClaimCode(event.currentTarget.value)}
                  placeholder="XXXXX-XXXXX-XXXXX"
                  spellCheck={false}
                  value={claimCode}
                />
                {fieldIssue('claimCode') ?? <small>{appConfig['claimCodeHint']}</small>}
              </FieldLabel>
            ) : null}

            {(secondFactorStep) ? (
              <FieldLabel>
                <span>Code</span>
                <input
                  aria-invalid={issueFor(error, 'code') !== ''}
                  autoComplete="one-time-code"
                  className="monospace"
                  inputMode="text"
                  onChange={(event): void => setCode(event.currentTarget.value)}
                  placeholder="123456 or XXXXX-XXXXX"
                  spellCheck={false}
                  value={code}
                />
                {fieldIssue('code')}
              </FieldLabel>
            ) : (
              <>
                <FieldLabel>
                  <span>Username</span>
                  <input
                    aria-invalid={issueFor(error, 'username') !== ''}
                    autoCapitalize="none"
                    autoComplete={(isClaim) ? 'username' : 'username webauthn'}
                    onChange={(event): void => setUsername(event.currentTarget.value)}
                    spellCheck={false}
                    value={username}
                  />
                  {fieldIssue('username')}
                </FieldLabel>

                <FieldLabel>
                  <span>Password</span>
                  <input
                    aria-invalid={issueFor(error, 'password') !== ''}
                    autoComplete={(isClaim) ? 'new-password' : 'current-password'}
                    onChange={(event): void => setPassword(event.currentTarget.value)}
                    type="password"
                    value={password}
                  />
                  {(isClaim) ? <PasswordMeter hints={[username]} issue={fieldIssue('password')} password={password} /> : fieldIssue('password')}
                </FieldLabel>
              </>
            )}

            {(isClaim) ? (
              <FieldLabel>
                <span>Confirm password</span>
                <input
                  autoComplete="new-password"
                  onChange={(event): void => setConfirmation(event.currentTarget.value)}
                  type="password"
                  value={confirmation}
                />
              </FieldLabel>
            ) : null}
          </div>

          {(summary === '') ? null : (
            <div className="form-error" role="alert">
              <Icon name="warning" size={16} />
              <span>{summary}</span>
            </div>
          )}

          <Button block disabled={submitting} type="submit" variant="primary">
            {(submitting) ? 'Please wait…' : submitLabel}
          </Button>

          {(showPasskey) ? (
            <>
              <div className="auth-divider"><span>or</span></div>
              <Button
                block
                disabled={submitting}
                icon="key"
                onClick={(): void => {
                  void handlePasskey();
                }}
              >
                Sign in with a passkey
              </Button>
            </>
          ) : null}

          {(secondFactorStep) ? (
            <button
              className="text-button auth-back"
              onClick={(): void => {
                setChallenge('');
                setCode('');
                setError(null);
              }}
              type="button"
            >
              Start over
            </button>
          ) : null}
        </form>

      </div>
    </main>
  );
};
