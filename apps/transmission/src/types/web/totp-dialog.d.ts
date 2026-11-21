import type {
  ClipboardEvent,
  Dispatch,
  FormEvent,
  ReactElement,
  RefObject,
  SetStateAction,
} from 'react';

import type {
  Web_Api_RecoveryCodes,
  Web_Api_TotpSetup,
} from '@/types/web/api.d.ts';
import type {
  Web_Components_TotpDialog_Mode,
  Web_Components_TotpDialog_Step,
} from '@/types/web/components.d.ts';

/**
 * Totp Dialog.
 *
 * @since 2.4.1
 */
export type Web_TotpDialog_TotpDialog_Returns = ReactElement | null;
export type Web_TotpDialog_TotpDialog_Mode = Web_Components_TotpDialog_Mode | null;
export type Web_TotpDialog_TotpDialog_OnAuthenticatorEnabled = () => void;
export type Web_TotpDialog_TotpDialog_OnChanged = () => Promise<void>;
export type Web_TotpDialog_TotpDialog_OnClose = () => void;
export type Web_TotpDialog_TotpDialog_StepState = [Web_Components_TotpDialog_Step, Dispatch<SetStateAction<Web_Components_TotpDialog_Step>>];
export type Web_TotpDialog_TotpDialog_Step = Web_Components_TotpDialog_Step;
export type Web_TotpDialog_TotpDialog_SetStep = Dispatch<SetStateAction<Web_Components_TotpDialog_Step>>;
export type Web_TotpDialog_TotpDialog_PasswordState = [string, Dispatch<SetStateAction<string>>];
export type Web_TotpDialog_TotpDialog_Password = string;
export type Web_TotpDialog_TotpDialog_SetPassword = Dispatch<SetStateAction<string>>;
export type Web_TotpDialog_TotpDialog_SetupState = [Web_Api_TotpSetup | null, Dispatch<SetStateAction<Web_Api_TotpSetup | null>>];
export type Web_TotpDialog_TotpDialog_Setup = Web_Api_TotpSetup | null;
export type Web_TotpDialog_TotpDialog_SetSetup = Dispatch<SetStateAction<Web_Api_TotpSetup | null>>;
export type Web_TotpDialog_TotpDialog_CodeState = [string, Dispatch<SetStateAction<string>>];
export type Web_TotpDialog_TotpDialog_Code = string;
export type Web_TotpDialog_TotpDialog_SetCode = Dispatch<SetStateAction<string>>;
export type Web_TotpDialog_TotpDialog_RecoveryCodesState = [string[], Dispatch<SetStateAction<string[]>>];
export type Web_TotpDialog_TotpDialog_RecoveryCodes = string[];
export type Web_TotpDialog_TotpDialog_SetRecoveryCodes = Dispatch<SetStateAction<string[]>>;
export type Web_TotpDialog_TotpDialog_SavedState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_TotpDialog_TotpDialog_Saved = boolean;
export type Web_TotpDialog_TotpDialog_SetSaved = Dispatch<SetStateAction<boolean>>;
export type Web_TotpDialog_TotpDialog_BusyState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_TotpDialog_TotpDialog_Busy = boolean;
export type Web_TotpDialog_TotpDialog_SetBusy = Dispatch<SetStateAction<boolean>>;
export type Web_TotpDialog_TotpDialog_ErrorState = [unknown, Dispatch<SetStateAction<unknown>>];
export type Web_TotpDialog_TotpDialog_Error = unknown;
export type Web_TotpDialog_TotpDialog_SetError = Dispatch<SetStateAction<unknown>>;
export type Web_TotpDialog_TotpDialog_TitleId = string;
export type Web_TotpDialog_TotpDialog_Open = boolean;
export type Web_TotpDialog_TotpDialog_DialogRef = RefObject<HTMLElement | null>;
export type Web_TotpDialog_TotpDialog_SubmitPassword_Event = FormEvent<HTMLFormElement>;
export type Web_TotpDialog_TotpDialog_SubmitPassword_Returns = Promise<void>;
export type Web_TotpDialog_TotpDialog_SubmitPassword_Result = Web_Api_RecoveryCodes;
export type Web_TotpDialog_TotpDialog_SubmitPassword = (event: Web_TotpDialog_TotpDialog_SubmitPassword_Event) => Web_TotpDialog_TotpDialog_SubmitPassword_Returns;
export type Web_TotpDialog_TotpDialog_SubmitCode_Event = FormEvent<HTMLFormElement>;
export type Web_TotpDialog_TotpDialog_SubmitCode_Returns = Promise<void>;
export type Web_TotpDialog_TotpDialog_SubmitCode_Result = Web_Api_RecoveryCodes;
export type Web_TotpDialog_TotpDialog_SubmitCode = (event: Web_TotpDialog_TotpDialog_SubmitCode_Event) => Web_TotpDialog_TotpDialog_SubmitCode_Returns;
export type Web_TotpDialog_TotpDialog_CopyText_Text = string;
export type Web_TotpDialog_TotpDialog_CopyText_Message = string;
export type Web_TotpDialog_TotpDialog_CopyText_Returns = Promise<void>;
export type Web_TotpDialog_TotpDialog_CopyText = (text: Web_TotpDialog_TotpDialog_CopyText_Text, message: Web_TotpDialog_TotpDialog_CopyText_Message) => Web_TotpDialog_TotpDialog_CopyText_Returns;
export type Web_TotpDialog_TotpDialog_CopyKeySelection_Event = ClipboardEvent<HTMLElement>;
export type Web_TotpDialog_TotpDialog_CopyKeySelection_Returns = void;
export type Web_TotpDialog_TotpDialog_CopyKeySelection_Selection = Selection | null;
export type Web_TotpDialog_TotpDialog_CopyKeySelection_Selected = string;
export type Web_TotpDialog_TotpDialog_CopyKeySelection = (event: Web_TotpDialog_TotpDialog_CopyKeySelection_Event) => Web_TotpDialog_TotpDialog_CopyKeySelection_Returns;
export type Web_TotpDialog_TotpDialog_DownloadCodes_Returns = void;
export type Web_TotpDialog_TotpDialog_DownloadCodes_Lines = string[];
export type Web_TotpDialog_TotpDialog_DownloadCodes_Blob = Blob;
export type Web_TotpDialog_TotpDialog_DownloadCodes_Url = string;
export type Web_TotpDialog_TotpDialog_DownloadCodes_Link = HTMLAnchorElement;
export type Web_TotpDialog_TotpDialog_DownloadCodes = () => Web_TotpDialog_TotpDialog_DownloadCodes_Returns;
export type Web_TotpDialog_TotpDialog_Finish_Returns = void;
export type Web_TotpDialog_TotpDialog_Finish = () => Web_TotpDialog_TotpDialog_Finish_Returns;
export type Web_TotpDialog_TotpDialog_TotalSteps = number;
export type Web_TotpDialog_TotpDialog_StepNumber = number;
export type Web_TotpDialog_TotpDialog_StepLabel = string;
export type Web_TotpDialog_TotpDialog_SecretOffsets = number[];
export type Web_TotpDialog_TotpDialog_PasswordIssue = string;
export type Web_TotpDialog_TotpDialog_CodeIssue = string;
export type Web_TotpDialog_TotpDialog_Summary = string;
export type Web_TotpDialog_TotpDialog_Title = string;
export type Web_TotpDialog_TotpDialog_Description = string;
export type Web_TotpDialog_TotpDialog_ErrorBanner = ReactElement | null;
