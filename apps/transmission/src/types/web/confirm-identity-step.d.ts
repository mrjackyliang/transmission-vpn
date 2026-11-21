import type {
  Dispatch,
  FormEvent,
  ReactElement,
  SetStateAction,
} from 'react';

/**
 * Confirm Identity Step.
 *
 * @since 2.4.1
 */
export type Web_ConfirmIdentityStep_ConfirmIdentityStep_Returns = ReactElement;
export type Web_ConfirmIdentityStep_ConfirmIdentityStep_AuthenticatorEnabled = boolean;
export type Web_ConfirmIdentityStep_ConfirmIdentityStep_Description = string;
export type Web_ConfirmIdentityStep_ConfirmIdentityStep_OnBack = () => void;
export type Web_ConfirmIdentityStep_ConfirmIdentityStep_OnConfirm = (password: string, code: string) => Promise<string>;
export type Web_ConfirmIdentityStep_ConfirmIdentityStep_OnConfirmed = (grant: string) => Promise<void> | void;
export type Web_ConfirmIdentityStep_ConfirmIdentityStep_OnPasskey = () => Promise<string>;
export type Web_ConfirmIdentityStep_ConfirmIdentityStep_PasskeyAvailable = boolean;
export type Web_ConfirmIdentityStep_ConfirmIdentityStep_PasswordState = [string, Dispatch<SetStateAction<string>>];
export type Web_ConfirmIdentityStep_ConfirmIdentityStep_Password = string;
export type Web_ConfirmIdentityStep_ConfirmIdentityStep_SetPassword = Dispatch<SetStateAction<string>>;
export type Web_ConfirmIdentityStep_ConfirmIdentityStep_CodeState = [string, Dispatch<SetStateAction<string>>];
export type Web_ConfirmIdentityStep_ConfirmIdentityStep_Code = string;
export type Web_ConfirmIdentityStep_ConfirmIdentityStep_SetCode = Dispatch<SetStateAction<string>>;
export type Web_ConfirmIdentityStep_ConfirmIdentityStep_BusyState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_ConfirmIdentityStep_ConfirmIdentityStep_Busy = boolean;
export type Web_ConfirmIdentityStep_ConfirmIdentityStep_SetBusy = Dispatch<SetStateAction<boolean>>;
export type Web_ConfirmIdentityStep_ConfirmIdentityStep_ErrorState = [string, Dispatch<SetStateAction<string>>];
export type Web_ConfirmIdentityStep_ConfirmIdentityStep_Error = string;
export type Web_ConfirmIdentityStep_ConfirmIdentityStep_SetError = Dispatch<SetStateAction<string>>;
export type Web_ConfirmIdentityStep_ConfirmIdentityStep_Finish_Grant = string;
export type Web_ConfirmIdentityStep_ConfirmIdentityStep_Finish_Returns = Promise<void>;
export type Web_ConfirmIdentityStep_ConfirmIdentityStep_Finish = (grant: Web_ConfirmIdentityStep_ConfirmIdentityStep_Finish_Grant) => Web_ConfirmIdentityStep_ConfirmIdentityStep_Finish_Returns;
export type Web_ConfirmIdentityStep_ConfirmIdentityStep_Submit_Event = FormEvent<HTMLFormElement>;
export type Web_ConfirmIdentityStep_ConfirmIdentityStep_Submit_Returns = Promise<void>;
export type Web_ConfirmIdentityStep_ConfirmIdentityStep_Submit = (event: Web_ConfirmIdentityStep_ConfirmIdentityStep_Submit_Event) => Web_ConfirmIdentityStep_ConfirmIdentityStep_Submit_Returns;
export type Web_ConfirmIdentityStep_ConfirmIdentityStep_ConfirmWithPasskey_Returns = Promise<void>;
export type Web_ConfirmIdentityStep_ConfirmIdentityStep_ConfirmWithPasskey = () => Web_ConfirmIdentityStep_ConfirmIdentityStep_ConfirmWithPasskey_Returns;
