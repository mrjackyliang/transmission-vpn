import type {
  Dispatch,
  FormEvent,
  ReactElement,
  SetStateAction,
} from 'react';

import type { Web_Api_LoginResult } from '@/types/web/api.d.ts';
import type { Web_Components_AuthenticationScreen_Mode } from '@/types/web/components.d.ts';

/**
 * Auth Screen.
 *
 * @since 2.4.1
 */
export type Web_AuthScreen_AuthenticationScreen_Returns = ReactElement;
export type Web_AuthScreen_AuthenticationScreen_Mode = Web_Components_AuthenticationScreen_Mode;
export type Web_AuthScreen_AuthenticationScreen_OnSignedIn = () => Promise<void>;
export type Web_AuthScreen_AuthenticationScreen_ClaimCodeState = [string, Dispatch<SetStateAction<string>>];
export type Web_AuthScreen_AuthenticationScreen_ClaimCode = string;
export type Web_AuthScreen_AuthenticationScreen_SetClaimCode = Dispatch<SetStateAction<string>>;
export type Web_AuthScreen_AuthenticationScreen_UsernameState = [string, Dispatch<SetStateAction<string>>];
export type Web_AuthScreen_AuthenticationScreen_Username = string;
export type Web_AuthScreen_AuthenticationScreen_SetUsername = Dispatch<SetStateAction<string>>;
export type Web_AuthScreen_AuthenticationScreen_PasswordState = [string, Dispatch<SetStateAction<string>>];
export type Web_AuthScreen_AuthenticationScreen_Password = string;
export type Web_AuthScreen_AuthenticationScreen_SetPassword = Dispatch<SetStateAction<string>>;
export type Web_AuthScreen_AuthenticationScreen_ConfirmationState = [string, Dispatch<SetStateAction<string>>];
export type Web_AuthScreen_AuthenticationScreen_Confirmation = string;
export type Web_AuthScreen_AuthenticationScreen_SetConfirmation = Dispatch<SetStateAction<string>>;
export type Web_AuthScreen_AuthenticationScreen_ChallengeState = [string, Dispatch<SetStateAction<string>>];
export type Web_AuthScreen_AuthenticationScreen_Challenge = string;
export type Web_AuthScreen_AuthenticationScreen_SetChallenge = Dispatch<SetStateAction<string>>;
export type Web_AuthScreen_AuthenticationScreen_CodeState = [string, Dispatch<SetStateAction<string>>];
export type Web_AuthScreen_AuthenticationScreen_Code = string;
export type Web_AuthScreen_AuthenticationScreen_SetCode = Dispatch<SetStateAction<string>>;
export type Web_AuthScreen_AuthenticationScreen_ErrorState = [unknown, Dispatch<SetStateAction<unknown>>];
export type Web_AuthScreen_AuthenticationScreen_Error = unknown;
export type Web_AuthScreen_AuthenticationScreen_SetError = Dispatch<SetStateAction<unknown>>;
export type Web_AuthScreen_AuthenticationScreen_SubmittingState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_AuthScreen_AuthenticationScreen_Submitting = boolean;
export type Web_AuthScreen_AuthenticationScreen_SetSubmitting = Dispatch<SetStateAction<boolean>>;
export type Web_AuthScreen_AuthenticationScreen_IsClaim = boolean;
export type Web_AuthScreen_AuthenticationScreen_SecondFactorStep = boolean;
export type Web_AuthScreen_AuthenticationScreen_ShowPasskey = boolean;
export type Web_AuthScreen_AuthenticationScreen_Summary = string;
export type Web_AuthScreen_AuthenticationScreen_HandleSubmit_Event = FormEvent<HTMLFormElement>;
export type Web_AuthScreen_AuthenticationScreen_HandleSubmit_Returns = Promise<void>;
export type Web_AuthScreen_AuthenticationScreen_HandleSubmit_Result = Web_Api_LoginResult;
export type Web_AuthScreen_AuthenticationScreen_HandleSubmit = (event: Web_AuthScreen_AuthenticationScreen_HandleSubmit_Event) => Web_AuthScreen_AuthenticationScreen_HandleSubmit_Returns;
export type Web_AuthScreen_AuthenticationScreen_HandlePasskey_Returns = Promise<void>;
export type Web_AuthScreen_AuthenticationScreen_HandlePasskey = () => Web_AuthScreen_AuthenticationScreen_HandlePasskey_Returns;
export type Web_AuthScreen_AuthenticationScreen_Heading = string;
export type Web_AuthScreen_AuthenticationScreen_Description = string;
export type Web_AuthScreen_AuthenticationScreen_SubmitLabel = string;
export type Web_AuthScreen_AuthenticationScreen_FieldIssue_Field = string;
export type Web_AuthScreen_AuthenticationScreen_FieldIssue_Returns = ReactElement | null;
export type Web_AuthScreen_AuthenticationScreen_FieldIssue_Message = string;
export type Web_AuthScreen_AuthenticationScreen_FieldIssue = (field: Web_AuthScreen_AuthenticationScreen_FieldIssue_Field) => Web_AuthScreen_AuthenticationScreen_FieldIssue_Returns;
