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
  Web_AuthScreen_AuthenticationScreen_Challenge,
  Web_AuthScreen_AuthenticationScreen_ChallengeState,
  Web_AuthScreen_AuthenticationScreen_ClaimCode,
  Web_AuthScreen_AuthenticationScreen_ClaimCodeState,
  Web_AuthScreen_AuthenticationScreen_Code,
  Web_AuthScreen_AuthenticationScreen_CodeState,
  Web_AuthScreen_AuthenticationScreen_Confirmation,
  Web_AuthScreen_AuthenticationScreen_ConfirmationState,
  Web_AuthScreen_AuthenticationScreen_Description,
  Web_AuthScreen_AuthenticationScreen_Error,
  Web_AuthScreen_AuthenticationScreen_ErrorState,
  Web_AuthScreen_AuthenticationScreen_FieldIssue,
  Web_AuthScreen_AuthenticationScreen_FieldIssue_Field,
  Web_AuthScreen_AuthenticationScreen_FieldIssue_Message,
  Web_AuthScreen_AuthenticationScreen_FieldIssue_Returns,
  Web_AuthScreen_AuthenticationScreen_HandlePasskey,
  Web_AuthScreen_AuthenticationScreen_HandlePasskey_Returns,
  Web_AuthScreen_AuthenticationScreen_HandleSubmit,
  Web_AuthScreen_AuthenticationScreen_HandleSubmit_Event,
  Web_AuthScreen_AuthenticationScreen_HandleSubmit_Result,
  Web_AuthScreen_AuthenticationScreen_HandleSubmit_Returns,
  Web_AuthScreen_AuthenticationScreen_Heading,
  Web_AuthScreen_AuthenticationScreen_IsClaim,
  Web_AuthScreen_AuthenticationScreen_Mode,
  Web_AuthScreen_AuthenticationScreen_OnSignedIn,
  Web_AuthScreen_AuthenticationScreen_Password,
  Web_AuthScreen_AuthenticationScreen_PasswordState,
  Web_AuthScreen_AuthenticationScreen_Returns,
  Web_AuthScreen_AuthenticationScreen_SecondFactorStep,
  Web_AuthScreen_AuthenticationScreen_SetChallenge,
  Web_AuthScreen_AuthenticationScreen_SetClaimCode,
  Web_AuthScreen_AuthenticationScreen_SetCode,
  Web_AuthScreen_AuthenticationScreen_SetConfirmation,
  Web_AuthScreen_AuthenticationScreen_SetError,
  Web_AuthScreen_AuthenticationScreen_SetPassword,
  Web_AuthScreen_AuthenticationScreen_SetSubmitting,
  Web_AuthScreen_AuthenticationScreen_SetUsername,
  Web_AuthScreen_AuthenticationScreen_ShowPasskey,
  Web_AuthScreen_AuthenticationScreen_SubmitLabel,
  Web_AuthScreen_AuthenticationScreen_Submitting,
  Web_AuthScreen_AuthenticationScreen_SubmittingState,
  Web_AuthScreen_AuthenticationScreen_Summary,
  Web_AuthScreen_AuthenticationScreen_Username,
  Web_AuthScreen_AuthenticationScreen_UsernameState,
} from '@/types/web/auth-screen.d.ts';
import type { Web_Components_AuthenticationScreen_Props } from '@/types/web/components.d.ts';

/**
 * Auth Screen - Authentication Screen.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_Components_AuthenticationScreen_Props} props - Props.
 *
 * @returns {Web_AuthScreen_AuthenticationScreen_Returns}
 *
 * @since 2.0.0
 */
export const AuthenticationScreen = (props: Web_Components_AuthenticationScreen_Props): Web_AuthScreen_AuthenticationScreen_Returns => {
  const mode: Web_AuthScreen_AuthenticationScreen_Mode = props['mode'];
  const onSignedIn: Web_AuthScreen_AuthenticationScreen_OnSignedIn = props['onSignedIn'];
  const claimCodeState: Web_AuthScreen_AuthenticationScreen_ClaimCodeState = useState<Web_AuthScreen_AuthenticationScreen_ClaimCode>('');
  const claimCode: Web_AuthScreen_AuthenticationScreen_ClaimCode = claimCodeState[0];
  const setClaimCode: Web_AuthScreen_AuthenticationScreen_SetClaimCode = claimCodeState[1];
  const usernameState: Web_AuthScreen_AuthenticationScreen_UsernameState = useState<Web_AuthScreen_AuthenticationScreen_Username>('');
  const username: Web_AuthScreen_AuthenticationScreen_Username = usernameState[0];
  const setUsername: Web_AuthScreen_AuthenticationScreen_SetUsername = usernameState[1];
  const passwordState: Web_AuthScreen_AuthenticationScreen_PasswordState = useState<Web_AuthScreen_AuthenticationScreen_Password>('');
  const password: Web_AuthScreen_AuthenticationScreen_Password = passwordState[0];
  const setPassword: Web_AuthScreen_AuthenticationScreen_SetPassword = passwordState[1];
  const confirmationState: Web_AuthScreen_AuthenticationScreen_ConfirmationState = useState<Web_AuthScreen_AuthenticationScreen_Confirmation>('');
  const confirmation: Web_AuthScreen_AuthenticationScreen_Confirmation = confirmationState[0];
  const setConfirmation: Web_AuthScreen_AuthenticationScreen_SetConfirmation = confirmationState[1];
  const challengeState: Web_AuthScreen_AuthenticationScreen_ChallengeState = useState<Web_AuthScreen_AuthenticationScreen_Challenge>('');
  const challenge: Web_AuthScreen_AuthenticationScreen_Challenge = challengeState[0];
  const setChallenge: Web_AuthScreen_AuthenticationScreen_SetChallenge = challengeState[1];
  const codeState: Web_AuthScreen_AuthenticationScreen_CodeState = useState<Web_AuthScreen_AuthenticationScreen_Code>('');
  const code: Web_AuthScreen_AuthenticationScreen_Code = codeState[0];
  const setCode: Web_AuthScreen_AuthenticationScreen_SetCode = codeState[1];
  const errorState: Web_AuthScreen_AuthenticationScreen_ErrorState = useState<Web_AuthScreen_AuthenticationScreen_Error>(null);
  const error: Web_AuthScreen_AuthenticationScreen_Error = errorState[0];
  const setError: Web_AuthScreen_AuthenticationScreen_SetError = errorState[1];
  const submittingState: Web_AuthScreen_AuthenticationScreen_SubmittingState = useState<Web_AuthScreen_AuthenticationScreen_Submitting>(false);
  const submitting: Web_AuthScreen_AuthenticationScreen_Submitting = submittingState[0];
  const setSubmitting: Web_AuthScreen_AuthenticationScreen_SetSubmitting = submittingState[1];

  const isClaim: Web_AuthScreen_AuthenticationScreen_IsClaim = mode === 'claim';
  const secondFactorStep: Web_AuthScreen_AuthenticationScreen_SecondFactorStep = challenge !== '';
  const showPasskey: Web_AuthScreen_AuthenticationScreen_ShowPasskey = (
    isClaim === false
    && secondFactorStep === false
    && passkeysSupported() === true
  );
  const summary: Web_AuthScreen_AuthenticationScreen_Summary = summaryFor(error, [
    'claimCode',
    'code',
    'password',
    'username',
  ], 'Sign-in failed. Try again.');

  /**
   * Auth Screen - Handle Submit.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @param {Web_AuthScreen_AuthenticationScreen_HandleSubmit_Event} event - Event.
   *
   * @returns {Web_AuthScreen_AuthenticationScreen_HandleSubmit_Returns}
   *
   * @since 2.0.0
   */
  const handleSubmit: Web_AuthScreen_AuthenticationScreen_HandleSubmit = async (event: Web_AuthScreen_AuthenticationScreen_HandleSubmit_Event): Web_AuthScreen_AuthenticationScreen_HandleSubmit_Returns => {
    event.preventDefault();

    setError(null);

    if (isClaim === true && password !== confirmation) {
      setError(new Error('The two passwords don\'t match.'));

      return;
    }

    setSubmitting(true);

    try {
      if (secondFactorStep === true) {
        await submitSecondFactor(challenge, code);
        await onSignedIn();

        return;
      }

      if (isClaim === true) {
        await claimInstallation({
          claimCode,
          password,
          username,
        });
        await onSignedIn();

        return;
      }

      const result: Web_AuthScreen_AuthenticationScreen_HandleSubmit_Result = await login({
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

    return;
  };

  /**
   * Auth Screen - Handle Passkey.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @returns {Web_AuthScreen_AuthenticationScreen_HandlePasskey_Returns}
   *
   * @since 2.0.0
   */
  const handlePasskey: Web_AuthScreen_AuthenticationScreen_HandlePasskey = async (): Web_AuthScreen_AuthenticationScreen_HandlePasskey_Returns => {
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

    return;
  };

  let heading: Web_AuthScreen_AuthenticationScreen_Heading = 'Sign in';
  let description: Web_AuthScreen_AuthenticationScreen_Description = 'Use your account to continue.';
  let submitLabel: Web_AuthScreen_AuthenticationScreen_SubmitLabel = 'Sign in';

  if (isClaim === true) {
    heading = 'Set up your account';
    description = 'Enter the one-time code from the container log, then choose a username and password.';
    submitLabel = 'Create account';
  } else if (secondFactorStep === true) {
    heading = 'Enter your code';
    description = 'Open your authenticator app and enter the 6‑digit code, or use one of your recovery codes.';
    submitLabel = 'Verify';
  }

  /**
   * Auth Screen - Field Issue.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @param {Web_AuthScreen_AuthenticationScreen_FieldIssue_Field} field - Field.
   *
   * @returns {Web_AuthScreen_AuthenticationScreen_FieldIssue_Returns}
   *
   * @since 2.0.0
   */
  const fieldIssue: Web_AuthScreen_AuthenticationScreen_FieldIssue = (field: Web_AuthScreen_AuthenticationScreen_FieldIssue_Field): Web_AuthScreen_AuthenticationScreen_FieldIssue_Returns => {
    const message: Web_AuthScreen_AuthenticationScreen_FieldIssue_Message = issueFor(error, field);

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
            {(isClaim === true) ? (
              <FieldLabel>
                <span>One-time code</span>
                <input
                  aria-invalid={issueFor(error, 'claimCode') !== ''}
                  autoComplete="one-time-code"
                  className="monospace"
                  onChange={(event) => setClaimCode(event.currentTarget.value)}
                  placeholder="XXXXX-XXXXX-XXXXX"
                  spellCheck={false}
                  value={claimCode}
                />
                {fieldIssue('claimCode') ?? <small>{appConfig['claimCodeHint']}</small>}
              </FieldLabel>
            ) : null}

            {(secondFactorStep === true) ? (
              <FieldLabel>
                <span>Code</span>
                <input
                  aria-invalid={issueFor(error, 'code') !== ''}
                  autoComplete="one-time-code"
                  className="monospace"
                  inputMode="text"
                  onChange={(event) => setCode(event.currentTarget.value)}
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
                    autoComplete={(isClaim === true) ? 'username' : 'username webauthn'}
                    onChange={(event) => setUsername(event.currentTarget.value)}
                    spellCheck={false}
                    value={username}
                  />
                  {fieldIssue('username')}
                </FieldLabel>

                <FieldLabel>
                  <span>Password</span>
                  <input
                    aria-invalid={issueFor(error, 'password') !== ''}
                    autoComplete={(isClaim === true) ? 'new-password' : 'current-password'}
                    onChange={(event) => setPassword(event.currentTarget.value)}
                    type="password"
                    value={password}
                  />
                  {(isClaim === true) ? <PasswordMeter hints={[username]} issue={fieldIssue('password')} password={password} /> : fieldIssue('password')}
                </FieldLabel>
              </>
            )}

            {(isClaim === true) ? (
              <FieldLabel>
                <span>Confirm password</span>
                <input
                  autoComplete="new-password"
                  onChange={(event) => setConfirmation(event.currentTarget.value)}
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
            {(submitting === true) ? 'Please wait…' : submitLabel}
          </Button>

          {(showPasskey === true) ? (
            <>
              <div className="auth-divider"><span>or</span></div>
              <Button
                block
                disabled={submitting}
                icon="key"
                onClick={() => {
                  void handlePasskey();

                  return;
                }}
              >
                Sign in with a passkey
              </Button>
            </>
          ) : null}

          {(secondFactorStep === true) ? (
            <button
              className="text-button auth-back"
              onClick={() => {
                setChallenge('');
                setCode('');
                setError(null);

                return;
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
