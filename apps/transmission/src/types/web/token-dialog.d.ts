import type {
  Dispatch,
  FormEvent,
  ReactElement,
  SetStateAction,
} from 'react';

import type {
  Web_Api_CreatedToken,
  Web_Api_CreateTokenInput,
  Web_Api_Scope,
  Web_Api_Token,
  Web_Api_UpdateTokenInput,
} from '@/types/web/api.d.ts';
import type {
  Web_Components_ScopeOption,
  Web_Components_TokenDialog_Expiry,
} from '@/types/web/components.d.ts';

/**
 * Token Dialog.
 *
 * @since 2.4.1
 */
export type Web_TokenDialog_ExpiryDate_Expiry = Web_Components_TokenDialog_Expiry;
export type Web_TokenDialog_ExpiryDate_Returns = string | null | undefined;

/**
 * Token Dialog.
 *
 * @since 2.4.1
 */
export type Web_TokenDialog_IncludingScope_Scopes = Web_Api_Scope[];
export type Web_TokenDialog_IncludingScope_Scope = Web_Api_Scope;
export type Web_TokenDialog_IncludingScope_Returns = Web_Api_Scope | undefined;
export type Web_TokenDialog_IncludingScope_Including = Web_Components_ScopeOption | undefined;

/**
 * Token Dialog.
 *
 * @since 2.4.1
 */
export type Web_TokenDialog_ScopeOptions = Web_Components_ScopeOption[];

/**
 * Token Dialog.
 *
 * @since 2.4.1
 */
export type Web_TokenDialog_TokenDialog_Returns = ReactElement | null;
export type Web_TokenDialog_TokenDialog_AllowedScopes = Web_Api_Scope[];
export type Web_TokenDialog_TokenDialog_OnClose = () => void;
export type Web_TokenDialog_TokenDialog_OnCreate = (input: Web_Api_CreateTokenInput) => Promise<Web_Api_CreatedToken>;
export type Web_TokenDialog_TokenDialog_OnUpdate = (tokenId: string, input: Web_Api_UpdateTokenInput) => Promise<void>;
export type Web_TokenDialog_TokenDialog_Open = boolean;
export type Web_TokenDialog_TokenDialog_Token = Web_Api_Token | null;
export type Web_TokenDialog_TokenDialog_NameState = [string, Dispatch<SetStateAction<string>>];
export type Web_TokenDialog_TokenDialog_Name = string;
export type Web_TokenDialog_TokenDialog_SetName = Dispatch<SetStateAction<string>>;
export type Web_TokenDialog_TokenDialog_ScopesState = [Web_Api_Scope[], Dispatch<SetStateAction<Web_Api_Scope[]>>];
export type Web_TokenDialog_TokenDialog_Scopes = Web_Api_Scope[];
export type Web_TokenDialog_TokenDialog_SetScopes = Dispatch<SetStateAction<Web_Api_Scope[]>>;
export type Web_TokenDialog_TokenDialog_ExpiryState = [Web_Components_TokenDialog_Expiry, Dispatch<SetStateAction<Web_Components_TokenDialog_Expiry>>];
export type Web_TokenDialog_TokenDialog_Expiry = Web_Components_TokenDialog_Expiry;
export type Web_TokenDialog_TokenDialog_SetExpiry = Dispatch<SetStateAction<Web_Components_TokenDialog_Expiry>>;
export type Web_TokenDialog_TokenDialog_ErrorState = [unknown, Dispatch<SetStateAction<unknown>>];
export type Web_TokenDialog_TokenDialog_Error = unknown;
export type Web_TokenDialog_TokenDialog_SetError = Dispatch<SetStateAction<unknown>>;
export type Web_TokenDialog_TokenDialog_BusyState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_TokenDialog_TokenDialog_Busy = boolean;
export type Web_TokenDialog_TokenDialog_SetBusy = Dispatch<SetStateAction<boolean>>;
export type Web_TokenDialog_TokenDialog_CreatedTokenState = [Web_Api_CreatedToken | null, Dispatch<SetStateAction<Web_Api_CreatedToken | null>>];
export type Web_TokenDialog_TokenDialog_CreatedToken = Web_Api_CreatedToken | null;
export type Web_TokenDialog_TokenDialog_SetCreatedToken = Dispatch<SetStateAction<Web_Api_CreatedToken | null>>;
export type Web_TokenDialog_TokenDialog_CopiedState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_TokenDialog_TokenDialog_Copied = boolean;
export type Web_TokenDialog_TokenDialog_SetCopied = Dispatch<SetStateAction<boolean>>;
export type Web_TokenDialog_TokenDialog_Editing = boolean;
export type Web_TokenDialog_TokenDialog_ToggleScope_Option = Web_Components_ScopeOption;
export type Web_TokenDialog_TokenDialog_ToggleScope_Returns = void;
export type Web_TokenDialog_TokenDialog_ToggleScope_Included = Web_Api_Scope | undefined;
export type Web_TokenDialog_TokenDialog_ToggleScope = (option: Web_TokenDialog_TokenDialog_ToggleScope_Option) => Web_TokenDialog_TokenDialog_ToggleScope_Returns;
export type Web_TokenDialog_TokenDialog_Submit_Event = FormEvent<HTMLFormElement>;
export type Web_TokenDialog_TokenDialog_Submit_Returns = Promise<void>;
export type Web_TokenDialog_TokenDialog_Submit_OrderedScopes = Web_Api_Scope[];
export type Web_TokenDialog_TokenDialog_Submit_ExpiresAt = string | null | undefined;
export type Web_TokenDialog_TokenDialog_Submit_NextToken = Web_Api_CreatedToken;
export type Web_TokenDialog_TokenDialog_Submit = (event: Web_TokenDialog_TokenDialog_Submit_Event) => Web_TokenDialog_TokenDialog_Submit_Returns;
export type Web_TokenDialog_TokenDialog_NameIssue = string;
export type Web_TokenDialog_TokenDialog_ScopesIssue = string;
export type Web_TokenDialog_TokenDialog_Summary = string;
export type Web_TokenDialog_TokenDialog_Allowed = boolean;
export type Web_TokenDialog_TokenDialog_IncludedBy = Web_Api_Scope | undefined;
export type Web_TokenDialog_TokenDialog_Endpoints = string[];
