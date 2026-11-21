import type {
  Dispatch,
  FormEvent,
  ReactElement,
  SetStateAction,
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

/**
 * Security View.
 *
 * @since 2.4.1
 */
export type Web_SecurityView_SecurityView_Props = Web_Components_SecurityView_Props;
export type Web_SecurityView_SecurityView_Returns = ReactElement;
export type Web_SecurityView_SecurityView_OnAuthenticatorEnabled = () => void;
export type Web_SecurityView_SecurityView_OnUsernameChanged = (username: string) => void;
export type Web_SecurityView_SecurityView_Security = Web_Api_AccountSecurity | null;
export type Web_SecurityView_SecurityView_SetSecurity = Dispatch<SetStateAction<Web_SecurityView_SecurityView_Security>>;
export type Web_SecurityView_SecurityView_SecurityState = [Web_SecurityView_SecurityView_Security, Web_SecurityView_SecurityView_SetSecurity];
export type Web_SecurityView_SecurityView_Error = unknown;
export type Web_SecurityView_SecurityView_SetError = Dispatch<SetStateAction<Web_SecurityView_SecurityView_Error>>;
export type Web_SecurityView_SecurityView_ErrorState = [Web_SecurityView_SecurityView_Error, Web_SecurityView_SecurityView_SetError];
export type Web_SecurityView_SecurityView_ErrorContext = Web_Components_SecurityView_ErrorContext;
export type Web_SecurityView_SecurityView_SetErrorContext = Dispatch<SetStateAction<Web_SecurityView_SecurityView_ErrorContext>>;
export type Web_SecurityView_SecurityView_ErrorContextState = [Web_SecurityView_SecurityView_ErrorContext, Web_SecurityView_SecurityView_SetErrorContext];
export type Web_SecurityView_SecurityView_Busy = boolean;
export type Web_SecurityView_SecurityView_SetBusy = Dispatch<SetStateAction<Web_SecurityView_SecurityView_Busy>>;
export type Web_SecurityView_SecurityView_BusyState = [Web_SecurityView_SecurityView_Busy, Web_SecurityView_SecurityView_SetBusy];
export type Web_SecurityView_SecurityView_CurrentPassword = string;
export type Web_SecurityView_SecurityView_SetCurrentPassword = Dispatch<SetStateAction<Web_SecurityView_SecurityView_CurrentPassword>>;
export type Web_SecurityView_SecurityView_CurrentPasswordState = [Web_SecurityView_SecurityView_CurrentPassword, Web_SecurityView_SecurityView_SetCurrentPassword];
export type Web_SecurityView_SecurityView_NewPassword = string;
export type Web_SecurityView_SecurityView_SetNewPassword = Dispatch<SetStateAction<Web_SecurityView_SecurityView_NewPassword>>;
export type Web_SecurityView_SecurityView_NewPasswordState = [Web_SecurityView_SecurityView_NewPassword, Web_SecurityView_SecurityView_SetNewPassword];
export type Web_SecurityView_SecurityView_ConfirmPassword = string;
export type Web_SecurityView_SecurityView_SetConfirmPassword = Dispatch<SetStateAction<Web_SecurityView_SecurityView_ConfirmPassword>>;
export type Web_SecurityView_SecurityView_ConfirmPasswordState = [Web_SecurityView_SecurityView_ConfirmPassword, Web_SecurityView_SecurityView_SetConfirmPassword];
export type Web_SecurityView_SecurityView_PasswordMismatch = boolean;
export type Web_SecurityView_SecurityView_SetPasswordMismatch = Dispatch<SetStateAction<Web_SecurityView_SecurityView_PasswordMismatch>>;
export type Web_SecurityView_SecurityView_PasswordMismatchState = [Web_SecurityView_SecurityView_PasswordMismatch, Web_SecurityView_SecurityView_SetPasswordMismatch];
export type Web_SecurityView_SecurityView_NewUsername = string;
export type Web_SecurityView_SecurityView_SetNewUsername = Dispatch<SetStateAction<Web_SecurityView_SecurityView_NewUsername>>;
export type Web_SecurityView_SecurityView_NewUsernameState = [Web_SecurityView_SecurityView_NewUsername, Web_SecurityView_SecurityView_SetNewUsername];
export type Web_SecurityView_SecurityView_UsernamePassword = string;
export type Web_SecurityView_SecurityView_SetUsernamePassword = Dispatch<SetStateAction<Web_SecurityView_SecurityView_UsernamePassword>>;
export type Web_SecurityView_SecurityView_UsernamePasswordState = [Web_SecurityView_SecurityView_UsernamePassword, Web_SecurityView_SecurityView_SetUsernamePassword];
export type Web_SecurityView_SecurityView_TotpMode = Web_Components_TotpDialog_Mode | null;
export type Web_SecurityView_SecurityView_SetTotpMode = Dispatch<SetStateAction<Web_SecurityView_SecurityView_TotpMode>>;
export type Web_SecurityView_SecurityView_TotpModeState = [Web_SecurityView_SecurityView_TotpMode, Web_SecurityView_SecurityView_SetTotpMode];
export type Web_SecurityView_SecurityView_RemovingPasskey = Web_Api_Passkey | null;
export type Web_SecurityView_SecurityView_SetRemovingPasskey = Dispatch<SetStateAction<Web_SecurityView_SecurityView_RemovingPasskey>>;
export type Web_SecurityView_SecurityView_RemovingPasskeyState = [Web_SecurityView_SecurityView_RemovingPasskey, Web_SecurityView_SecurityView_SetRemovingPasskey];
export type Web_SecurityView_SecurityView_RemovePassword = string;
export type Web_SecurityView_SecurityView_SetRemovePassword = Dispatch<SetStateAction<Web_SecurityView_SecurityView_RemovePassword>>;
export type Web_SecurityView_SecurityView_RemovePasswordState = [Web_SecurityView_SecurityView_RemovePassword, Web_SecurityView_SecurityView_SetRemovePassword];
export type Web_SecurityView_SecurityView_PasskeyName = string;
export type Web_SecurityView_SecurityView_SetPasskeyName = Dispatch<SetStateAction<Web_SecurityView_SecurityView_PasskeyName>>;
export type Web_SecurityView_SecurityView_PasskeyNameState = [Web_SecurityView_SecurityView_PasskeyName, Web_SecurityView_SecurityView_SetPasskeyName];
export type Web_SecurityView_SecurityView_PasskeyPassword = string;
export type Web_SecurityView_SecurityView_SetPasskeyPassword = Dispatch<SetStateAction<Web_SecurityView_SecurityView_PasskeyPassword>>;
export type Web_SecurityView_SecurityView_PasskeyPasswordState = [Web_SecurityView_SecurityView_PasskeyPassword, Web_SecurityView_SecurityView_SetPasskeyPassword];
export type Web_SecurityView_SecurityView_Reload_Returns = Promise<void>;
export type Web_SecurityView_SecurityView_Reload = () => Web_SecurityView_SecurityView_Reload_Returns;
export type Web_SecurityView_SecurityView_Run_Action = () => Promise<void>;
export type Web_SecurityView_SecurityView_Run_SuccessMessage = string;
export type Web_SecurityView_SecurityView_Run_Context = Web_Components_SecurityView_ErrorContext;
export type Web_SecurityView_SecurityView_Run_Returns = Promise<void>;
export type Web_SecurityView_SecurityView_Run = (action: Web_SecurityView_SecurityView_Run_Action, successMessage: Web_SecurityView_SecurityView_Run_SuccessMessage, context: Web_SecurityView_SecurityView_Run_Context) => Web_SecurityView_SecurityView_Run_Returns;
export type Web_SecurityView_SecurityView_Run_Message = string;
export type Web_SecurityView_SecurityView_IssueIn_Context = Web_Components_SecurityView_ErrorContext;
export type Web_SecurityView_SecurityView_IssueIn_Field = string;
export type Web_SecurityView_SecurityView_IssueIn_Returns = string;
export type Web_SecurityView_SecurityView_IssueIn = (context: Web_SecurityView_SecurityView_IssueIn_Context, field: Web_SecurityView_SecurityView_IssueIn_Field) => Web_SecurityView_SecurityView_IssueIn_Returns;
export type Web_SecurityView_SecurityView_FieldIssue_Context = Web_Components_SecurityView_ErrorContext;
export type Web_SecurityView_SecurityView_FieldIssue_Field = string;
export type Web_SecurityView_SecurityView_FieldIssue_Returns = ReactElement | null;
export type Web_SecurityView_SecurityView_FieldIssue = (context: Web_SecurityView_SecurityView_FieldIssue_Context, field: Web_SecurityView_SecurityView_FieldIssue_Field) => Web_SecurityView_SecurityView_FieldIssue_Returns;
export type Web_SecurityView_SecurityView_FieldIssue_Message = string;
export type Web_SecurityView_SecurityView_SubmitPasswordChange_Event = FormEvent<HTMLFormElement>;
export type Web_SecurityView_SecurityView_SubmitPasswordChange_Returns = Promise<void>;
export type Web_SecurityView_SecurityView_SubmitPasswordChange = (event: Web_SecurityView_SecurityView_SubmitPasswordChange_Event) => Web_SecurityView_SecurityView_SubmitPasswordChange_Returns;
export type Web_SecurityView_SecurityView_SubmitUsernameChange_Event = FormEvent<HTMLFormElement>;
export type Web_SecurityView_SecurityView_SubmitUsernameChange_Returns = Promise<void>;
export type Web_SecurityView_SecurityView_SubmitUsernameChange = (event: Web_SecurityView_SecurityView_SubmitUsernameChange_Event) => Web_SecurityView_SecurityView_SubmitUsernameChange_Returns;
export type Web_SecurityView_SecurityView_CloseRemove_Returns = void;
export type Web_SecurityView_SecurityView_CloseRemove = () => Web_SecurityView_SecurityView_CloseRemove_Returns;
export type Web_SecurityView_SecurityView_SubmitRemovePasskey_Returns = Promise<void>;
export type Web_SecurityView_SecurityView_SubmitRemovePasskey = () => Web_SecurityView_SecurityView_SubmitRemovePasskey_Returns;
export type Web_SecurityView_SecurityView_SubmitPasskey_Event = FormEvent<HTMLFormElement>;
export type Web_SecurityView_SecurityView_SubmitPasskey_Returns = Promise<void>;
export type Web_SecurityView_SecurityView_SubmitPasskey = (event: Web_SecurityView_SecurityView_SubmitPasskey_Event) => Web_SecurityView_SecurityView_SubmitPasskey_Returns;
export type Web_SecurityView_SecurityView_Role = string | undefined;
export type Web_SecurityView_SecurityView_RoleLabel = string | undefined;
export type Web_SecurityView_SecurityView_RemovingPasskeyName = string;

/**
 * Security View.
 *
 * @since 2.4.1
 */
export type Web_SecurityView_ShownFields = Record<Web_Components_SecurityView_ErrorContext, string[]>;
