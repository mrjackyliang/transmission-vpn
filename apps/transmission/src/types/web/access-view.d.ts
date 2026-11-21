import type {
  Dispatch,
  FormEvent,
  ReactElement,
  ReactNode,
  RefObject,
  SetStateAction,
} from 'react';

import type {
  Web_Api_RPCCredential,
  Web_Api_RPCLogin,
  Web_Api_Token,
  Web_Api_VpnConnection,
  Web_Api_WebProxy,
  Web_Api_WebProxyCredential,
  Web_Api_WebProxyLogin,
  Web_Api_WebProxyState,
} from '@/types/web/api.d.ts';
import type {
  Web_Components_AccessView_Credential,
  Web_Components_AccessView_DeletingLogin,
  Web_Components_AccessView_EditingLogin,
  Web_Components_AccessView_LoginDialog,
  Web_Components_AccessView_Props,
} from '@/types/web/components.d.ts';

/**
 * Access View.
 *
 * @since 2.4.1
 */
export type Web_AccessView_AccessView_Props = Web_Components_AccessView_Props;
export type Web_AccessView_AccessView_Returns = ReactElement;
export type Web_AccessView_AccessView_Connections = Web_Api_VpnConnection[];
export type Web_AccessView_AccessView_OnCreateRpcLogin = Web_Components_AccessView_Props['onCreateRPCLogin'];
export type Web_AccessView_AccessView_OnCreateToken = Web_Components_AccessView_Props['onCreateToken'];
export type Web_AccessView_AccessView_OnCreateWebProxyLogin = Web_Components_AccessView_Props['onCreateWebProxyLogin'];
export type Web_AccessView_AccessView_OnDeleteRpcLogin = Web_Components_AccessView_Props['onDeleteRPCLogin'];
export type Web_AccessView_AccessView_OnDeleteWebProxyLogin = Web_Components_AccessView_Props['onDeleteWebProxyLogin'];
export type Web_AccessView_AccessView_OnOpenVpn = Web_Components_AccessView_Props['onOpenVPN'];
export type Web_AccessView_AccessView_OnRefreshWebProxy = Web_Components_AccessView_Props['onRefreshWebProxy'];
export type Web_AccessView_AccessView_OnRevokeToken = Web_Components_AccessView_Props['onRevokeToken'];
export type Web_AccessView_AccessView_OnToggleRpc = Web_Components_AccessView_Props['onToggleRPC'];
export type Web_AccessView_AccessView_OnToggleWebProxy = Web_Components_AccessView_Props['onToggleWebProxy'];
export type Web_AccessView_AccessView_OnUpdateRpcLogin = Web_Components_AccessView_Props['onUpdateRPCLogin'];
export type Web_AccessView_AccessView_OnUpdateToken = Web_Components_AccessView_Props['onUpdateToken'];
export type Web_AccessView_AccessView_OnUpdateWebProxyLogin = Web_Components_AccessView_Props['onUpdateWebProxyLogin'];
export type Web_AccessView_AccessView_RpcEnabled = boolean;
export type Web_AccessView_AccessView_RpcLogins = Web_Api_RPCLogin[];
export type Web_AccessView_AccessView_Tokens = Web_Api_Token[];
export type Web_AccessView_AccessView_WebProxy = Web_Api_WebProxy | null;
export type Web_AccessView_AccessView_TokenDialogOpen = boolean;
export type Web_AccessView_AccessView_SetTokenDialogOpen = Dispatch<SetStateAction<Web_AccessView_AccessView_TokenDialogOpen>>;
export type Web_AccessView_AccessView_TokenDialogOpenState = [Web_AccessView_AccessView_TokenDialogOpen, Web_AccessView_AccessView_SetTokenDialogOpen];
export type Web_AccessView_AccessView_EditingToken = Web_Api_Token | null;
export type Web_AccessView_AccessView_SetEditingToken = Dispatch<SetStateAction<Web_AccessView_AccessView_EditingToken>>;
export type Web_AccessView_AccessView_EditingTokenState = [Web_AccessView_AccessView_EditingToken, Web_AccessView_AccessView_SetEditingToken];
export type Web_AccessView_AccessView_Revoking = Web_Api_Token | null;
export type Web_AccessView_AccessView_SetRevoking = Dispatch<SetStateAction<Web_AccessView_AccessView_Revoking>>;
export type Web_AccessView_AccessView_RevokingState = [Web_AccessView_AccessView_Revoking, Web_AccessView_AccessView_SetRevoking];
export type Web_AccessView_AccessView_LoginDialog = Web_Components_AccessView_LoginDialog | null;
export type Web_AccessView_AccessView_SetLoginDialog = Dispatch<SetStateAction<Web_AccessView_AccessView_LoginDialog>>;
export type Web_AccessView_AccessView_LoginDialogState = [Web_AccessView_AccessView_LoginDialog, Web_AccessView_AccessView_SetLoginDialog];
export type Web_AccessView_AccessView_EditingLogin = Web_Components_AccessView_EditingLogin;
export type Web_AccessView_AccessView_SetEditingLogin = Dispatch<SetStateAction<Web_AccessView_AccessView_EditingLogin>>;
export type Web_AccessView_AccessView_EditingLoginState = [Web_AccessView_AccessView_EditingLogin, Web_AccessView_AccessView_SetEditingLogin];
export type Web_AccessView_AccessView_DeletingLogin = Web_Components_AccessView_DeletingLogin | null;
export type Web_AccessView_AccessView_SetDeletingLogin = Dispatch<SetStateAction<Web_AccessView_AccessView_DeletingLogin>>;
export type Web_AccessView_AccessView_DeletingLoginState = [Web_AccessView_AccessView_DeletingLogin, Web_AccessView_AccessView_SetDeletingLogin];
export type Web_AccessView_AccessView_Username = string;
export type Web_AccessView_AccessView_SetUsername = Dispatch<SetStateAction<Web_AccessView_AccessView_Username>>;
export type Web_AccessView_AccessView_UsernameState = [Web_AccessView_AccessView_Username, Web_AccessView_AccessView_SetUsername];
export type Web_AccessView_AccessView_ConnectionId = string;
export type Web_AccessView_AccessView_SetConnectionId = Dispatch<SetStateAction<Web_AccessView_AccessView_ConnectionId>>;
export type Web_AccessView_AccessView_ConnectionIdState = [Web_AccessView_AccessView_ConnectionId, Web_AccessView_AccessView_SetConnectionId];
export type Web_AccessView_AccessView_RegeneratePassword = boolean;
export type Web_AccessView_AccessView_SetRegeneratePassword = Dispatch<SetStateAction<Web_AccessView_AccessView_RegeneratePassword>>;
export type Web_AccessView_AccessView_RegeneratePasswordState = [Web_AccessView_AccessView_RegeneratePassword, Web_AccessView_AccessView_SetRegeneratePassword];
export type Web_AccessView_AccessView_LoginCredential = Web_Components_AccessView_Credential | null;
export type Web_AccessView_AccessView_SetLoginCredential = Dispatch<SetStateAction<Web_AccessView_AccessView_LoginCredential>>;
export type Web_AccessView_AccessView_LoginCredentialState = [Web_AccessView_AccessView_LoginCredential, Web_AccessView_AccessView_SetLoginCredential];
export type Web_AccessView_AccessView_CredentialTitle = string;
export type Web_AccessView_AccessView_SetCredentialTitle = Dispatch<SetStateAction<Web_AccessView_AccessView_CredentialTitle>>;
export type Web_AccessView_AccessView_CredentialTitleState = [Web_AccessView_AccessView_CredentialTitle, Web_AccessView_AccessView_SetCredentialTitle];
export type Web_AccessView_AccessView_Busy = boolean;
export type Web_AccessView_AccessView_SetBusy = Dispatch<SetStateAction<Web_AccessView_AccessView_Busy>>;
export type Web_AccessView_AccessView_BusyState = [Web_AccessView_AccessView_Busy, Web_AccessView_AccessView_SetBusy];
export type Web_AccessView_AccessView_RpcRequestedEnabled = boolean | null;
export type Web_AccessView_AccessView_SetRpcRequestedEnabled = Dispatch<SetStateAction<Web_AccessView_AccessView_RpcRequestedEnabled>>;
export type Web_AccessView_AccessView_RpcRequestedEnabledState = [Web_AccessView_AccessView_RpcRequestedEnabled, Web_AccessView_AccessView_SetRpcRequestedEnabled];
export type Web_AccessView_AccessView_WebProxyRequestedEnabled = boolean | null;
export type Web_AccessView_AccessView_SetWebProxyRequestedEnabled = Dispatch<SetStateAction<Web_AccessView_AccessView_WebProxyRequestedEnabled>>;
export type Web_AccessView_AccessView_WebProxyRequestedEnabledState = [Web_AccessView_AccessView_WebProxyRequestedEnabled, Web_AccessView_AccessView_SetWebProxyRequestedEnabled];
export type Web_AccessView_AccessView_ActionError = unknown;
export type Web_AccessView_AccessView_SetActionError = Dispatch<SetStateAction<Web_AccessView_AccessView_ActionError>>;
export type Web_AccessView_AccessView_ActionErrorState = [Web_AccessView_AccessView_ActionError, Web_AccessView_AccessView_SetActionError];
export type Web_AccessView_AccessView_Copied = string;
export type Web_AccessView_AccessView_SetCopied = Dispatch<SetStateAction<Web_AccessView_AccessView_Copied>>;
export type Web_AccessView_AccessView_CopiedState = [Web_AccessView_AccessView_Copied, Web_AccessView_AccessView_SetCopied];
export type Web_AccessView_AccessView_WebProxyObservedState = Web_Api_WebProxyState | undefined;
export type Web_AccessView_AccessView_RpcTransitionSequenceRef = RefObject<number>;
export type Web_AccessView_AccessView_WebProxyTransitionSequenceRef = RefObject<number>;
export type Web_AccessView_AccessView_WebProxyTransitionStartedAtRef = RefObject<number>;
export type Web_AccessView_AccessView_WebProxyStateRef = RefObject<Web_Api_WebProxyState>;
export type Web_AccessView_AccessView_RefreshWebProxyRef = RefObject<Web_Components_AccessView_Props['onRefreshWebProxy']>;
export type Web_AccessView_AccessView_LoginDialogTitleId = string;
export type Web_AccessView_AccessView_CredentialDialogTitleId = string;
export type Web_AccessView_AccessView_LoginDialogRef = RefObject<HTMLElement | null>;
export type Web_AccessView_AccessView_CredentialDialogRef = RefObject<HTMLElement | null>;
export type Web_AccessView_AccessView_Hostname = string;
export type Web_AccessView_AccessView_RpcEndpoint = string;
export type Web_AccessView_AccessView_WebProxyPort = number;
export type Web_AccessView_AccessView_WebProxyEnabled = boolean;
export type Web_AccessView_AccessView_HttpAddress = string;
export type Web_AccessView_AccessView_SocksAddress = string;
export type Web_AccessView_AccessView_DefaultConnection = Web_Api_VpnConnection | undefined;
export type Web_AccessView_AccessView_HasVpnConnections = boolean;
export type Web_AccessView_AccessView_TransitionSequence = number;
export type Web_AccessView_AccessView_TimeoutId = number;
export type Web_AccessView_AccessView_RpcRequestedDirection = 'off' | 'on';
export type Web_AccessView_AccessView_EffectActive = boolean;
export type Web_AccessView_AccessView_PollTimeoutId = number | undefined;
export type Web_AccessView_AccessView_FinishWebProxyTransition_ReportedState = Web_Api_WebProxyState;
export type Web_AccessView_AccessView_FinishWebProxyTransition_Returns = boolean;
export type Web_AccessView_AccessView_FinishWebProxyTransition = (reportedState: Web_AccessView_AccessView_FinishWebProxyTransition_ReportedState) => Web_AccessView_AccessView_FinishWebProxyTransition_Returns;
export type Web_AccessView_AccessView_FinishWebProxyTransition_TransitionStatus = 'busy' | 'settled' | 'timed-out';
export type Web_AccessView_AccessView_WebProxyRequestedDirection = 'off' | 'on';
export type Web_AccessView_AccessView_PollWebProxyTransition_Returns = Promise<void>;
export type Web_AccessView_AccessView_PollWebProxyTransition = () => Web_AccessView_AccessView_PollWebProxyTransition_Returns;
export type Web_AccessView_AccessView_PollWebProxyTransition_NextWebProxy = Web_Api_WebProxy;
export type Web_AccessView_AccessView_CopyValue_Label = string;
export type Web_AccessView_AccessView_CopyValue_Value = string;
export type Web_AccessView_AccessView_CopyValue_Returns = Promise<void>;
export type Web_AccessView_AccessView_CopyValue = (label: Web_AccessView_AccessView_CopyValue_Label, value: Web_AccessView_AccessView_CopyValue_Value) => Web_AccessView_AccessView_CopyValue_Returns;
export type Web_AccessView_AccessView_OpenLoginDialog_Dialog = Web_Components_AccessView_LoginDialog;
export type Web_AccessView_AccessView_OpenLoginDialog_Login = Web_Api_RPCLogin | Web_Api_WebProxyLogin | null;
export type Web_AccessView_AccessView_OpenLoginDialog_Returns = void;
export type Web_AccessView_AccessView_OpenLoginDialog = (dialog: Web_AccessView_AccessView_OpenLoginDialog_Dialog, login?: Web_AccessView_AccessView_OpenLoginDialog_Login) => Web_AccessView_AccessView_OpenLoginDialog_Returns;
export type Web_AccessView_AccessView_FirstConnection = Web_Api_VpnConnection | undefined;
export type Web_AccessView_AccessView_FirstConnectionId = string;
export type Web_AccessView_AccessView_OpenLoginDialog_InitialConnectionId = string;
export type Web_AccessView_AccessView_ToggleRpc_Returns = Promise<void>;
export type Web_AccessView_AccessView_ToggleRpc = () => Web_AccessView_AccessView_ToggleRpc_Returns;
export type Web_AccessView_AccessView_ToggleRpc_RequestedEnabled = boolean;
export type Web_AccessView_AccessView_ToggleRpc_TransitionSequence = number;
export type Web_AccessView_AccessView_ToggleWebProxy_Returns = Promise<void>;
export type Web_AccessView_AccessView_ToggleWebProxy = () => Web_AccessView_AccessView_ToggleWebProxy_Returns;
export type Web_AccessView_AccessView_ToggleWebProxy_RequestedEnabled = boolean;
export type Web_AccessView_AccessView_ToggleWebProxy_TransitionSequence = number;
export type Web_AccessView_AccessView_ToggleWebProxy_NextWebProxy = Web_Api_WebProxy;
export type Web_AccessView_AccessView_SubmitLogin_Event = FormEvent<HTMLFormElement>;
export type Web_AccessView_AccessView_SubmitLogin_Returns = Promise<void>;
export type Web_AccessView_AccessView_SubmitLogin = (event: Web_AccessView_AccessView_SubmitLogin_Event) => Web_AccessView_AccessView_SubmitLogin_Returns;
export type Web_AccessView_AccessView_SubmitLogin_Credential = Web_Api_RPCCredential;
export type Web_AccessView_AccessView_SubmitLogin_WebCredential = Web_Api_WebProxyCredential;
export type Web_AccessView_AccessView_DeleteLogin_Login = Web_Components_AccessView_DeletingLogin;
export type Web_AccessView_AccessView_DeleteLogin_Returns = Promise<void>;
export type Web_AccessView_AccessView_DeleteLogin = (login: Web_AccessView_AccessView_DeleteLogin_Login) => Web_AccessView_AccessView_DeleteLogin_Returns;
export type Web_AccessView_AccessView_Revoke_Token = Web_Api_Token;
export type Web_AccessView_AccessView_Revoke_Returns = Promise<void>;
export type Web_AccessView_AccessView_Revoke = (token: Web_AccessView_AccessView_Revoke_Token) => Web_AccessView_AccessView_Revoke_Returns;
export type Web_AccessView_AccessView_ExpiryLabel_Token = Web_Api_Token;
export type Web_AccessView_AccessView_ExpiryLabel_Returns = string;
export type Web_AccessView_AccessView_ExpiryLabel = (token: Web_AccessView_AccessView_ExpiryLabel_Token) => Web_AccessView_AccessView_ExpiryLabel_Returns;
export type Web_AccessView_AccessView_WebProxyLogins = Web_Api_WebProxyLogin[];
export type Web_AccessView_AccessView_WebProxyLoginCount = number;
export type Web_AccessView_AccessView_RpcSwitchEnabled = boolean;
export type Web_AccessView_AccessView_WebProxySwitchEnabled = boolean;
export type Web_AccessView_AccessView_RpcProxyState = 'no-logins' | 'off' | 'ready' | 'turning';
export type Web_AccessView_AccessView_RpcProxyStateLabel = string;
export type Web_AccessView_AccessView_RpcProxyHelp = string;
export type Web_AccessView_AccessView_WebProxyState = 'error' | 'no-logins' | 'off' | 'ready' | 'turning' | 'waiting';
export type Web_AccessView_AccessView_WebProxyStateLabel = string;
export type Web_AccessView_AccessView_WebProxyHelp = string;
export type Web_AccessView_AccessView_WebProxyError = string | undefined;
export type Web_AccessView_AccessView_UsernameIssue = string;
export type Web_AccessView_AccessView_SelectedConnection = Web_Api_VpnConnection | undefined;
export type Web_AccessView_AccessView_SelectedConnectionName = string;
export type Web_AccessView_AccessView_LoginSummary = string;
export type Web_AccessView_AccessView_ConfirmError = string;
export type Web_AccessView_AccessView_GeneratedPassword = string;
export type Web_AccessView_AccessView_ConnectionLabel_Login = Web_Api_WebProxyLogin;
export type Web_AccessView_AccessView_ConnectionLabel_Returns = string;
export type Web_AccessView_AccessView_ConnectionLabel = (login: Web_AccessView_AccessView_ConnectionLabel_Login) => Web_AccessView_AccessView_ConnectionLabel_Returns;
export type Web_AccessView_AccessView_ConnectionLabel_StoredConnection = Web_Api_VpnConnection | undefined;
export type Web_AccessView_AccessView_ConnectionLabel_EffectiveConnection = Web_Api_VpnConnection | undefined;
export type Web_AccessView_AccessView_ConnectionLabel_FallbackName = string;
export type Web_AccessView_AccessView_LoginSubmitLabel = string;
export type Web_AccessView_AccessView_LoginDialogHeading = string;
export type Web_AccessView_AccessView_LoginDialogDescription = string;
export type Web_AccessView_AccessView_LoginSubmitDisabled = boolean;
export type Web_AccessView_AccessView_RpcSwitchDisabled = boolean;
export type Web_AccessView_AccessView_WebProxySwitchDisabled = boolean;
export type Web_AccessView_AccessView_ShowConnectionField = boolean;
export type Web_AccessView_AccessView_DeletingLoginName = string;
export type Web_AccessView_AccessView_RevokingName = string;
export type Web_AccessView_AccessView_RpcLoginPrompt = ReactElement | null;
export type Web_AccessView_AccessView_WebProxyLoginPrompt = ReactElement | null;
export type Web_AccessView_AccessView_Label = string;
export type Web_AccessView_AccessView_Value = string;

/**
 * Access View.
 *
 * @since 2.4.1
 */
export type Web_AccessView_BreakAddressAtBoundaries_Address = string;
export type Web_AccessView_BreakAddressAtBoundaries_Returns = ReactNode;
export type Web_AccessView_BreakAddressAtBoundaries_SchemeIndex = number;
export type Web_AccessView_BreakAddressAtBoundaries_AuthorityStart = number;
export type Web_AccessView_BreakAddressAtBoundaries_PathStart = number;
export type Web_AccessView_BreakAddressAtBoundaries_AuthorityEnd = number;
export type Web_AccessView_BreakAddressAtBoundaries_Parts = ReactNode[];
