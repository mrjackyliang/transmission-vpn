import {
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import {
  connectionBeingRemovedMessage,
  issueFor,
  summaryFor,
} from '@/web/api.ts';
import { ConfirmDialog } from '@/web/confirm-dialog.tsx';
import { FieldLabel } from '@/web/field-label.tsx';
import {
  formatRelative,
  formatShortDate,
  keepTogether,
} from '@/web/format.ts';
import {
  Button,
  Icon,
  passwordManagerIgnore,
} from '@/web/primitives.tsx';
import {
  proxyTransitionStatus,
  proxyTransitionTimeoutMilliseconds,
} from '@/web/proxy-transition.ts';
import { showToast } from '@/web/toast.ts';
import { TokenDialog } from '@/web/token-dialog.tsx';
import { useDialogFocus } from '@/web/use-dialog-focus.ts';
import { useEscapeKey } from '@/web/use-escape-key.ts';

import type {
  Web_AccessView_AccessView_ActionError,
  Web_AccessView_AccessView_ActionErrorState,
  Web_AccessView_AccessView_Busy,
  Web_AccessView_AccessView_BusyState,
  Web_AccessView_AccessView_ConfirmError,
  Web_AccessView_AccessView_ConnectionId,
  Web_AccessView_AccessView_ConnectionIdState,
  Web_AccessView_AccessView_ConnectionLabel,
  Web_AccessView_AccessView_ConnectionLabel_EffectiveConnection,
  Web_AccessView_AccessView_ConnectionLabel_FallbackName,
  Web_AccessView_AccessView_ConnectionLabel_Login,
  Web_AccessView_AccessView_ConnectionLabel_Returns,
  Web_AccessView_AccessView_ConnectionLabel_StoredConnection,
  Web_AccessView_AccessView_Connections,
  Web_AccessView_AccessView_Copied,
  Web_AccessView_AccessView_CopiedState,
  Web_AccessView_AccessView_CopyValue,
  Web_AccessView_AccessView_CopyValue_Label,
  Web_AccessView_AccessView_CopyValue_Returns,
  Web_AccessView_AccessView_CopyValue_Value,
  Web_AccessView_AccessView_CredentialDialogRef,
  Web_AccessView_AccessView_CredentialDialogTitleId,
  Web_AccessView_AccessView_CredentialTitle,
  Web_AccessView_AccessView_CredentialTitleState,
  Web_AccessView_AccessView_DefaultConnection,
  Web_AccessView_AccessView_DeleteLogin,
  Web_AccessView_AccessView_DeleteLogin_Login,
  Web_AccessView_AccessView_DeleteLogin_Returns,
  Web_AccessView_AccessView_DeletingLogin,
  Web_AccessView_AccessView_DeletingLoginName,
  Web_AccessView_AccessView_DeletingLoginState,
  Web_AccessView_AccessView_EditingLogin,
  Web_AccessView_AccessView_EditingLoginState,
  Web_AccessView_AccessView_EditingToken,
  Web_AccessView_AccessView_EditingTokenState,
  Web_AccessView_AccessView_EffectActive,
  Web_AccessView_AccessView_ExpiryLabel,
  Web_AccessView_AccessView_ExpiryLabel_Returns,
  Web_AccessView_AccessView_ExpiryLabel_Token,
  Web_AccessView_AccessView_FinishWebProxyTransition,
  Web_AccessView_AccessView_FinishWebProxyTransition_ReportedState,
  Web_AccessView_AccessView_FinishWebProxyTransition_Returns,
  Web_AccessView_AccessView_FinishWebProxyTransition_TransitionStatus,
  Web_AccessView_AccessView_FirstConnection,
  Web_AccessView_AccessView_FirstConnectionId,
  Web_AccessView_AccessView_GeneratedPassword,
  Web_AccessView_AccessView_HasVpnConnections,
  Web_AccessView_AccessView_Hostname,
  Web_AccessView_AccessView_HttpAddress,
  Web_AccessView_AccessView_Label,
  Web_AccessView_AccessView_LoginCredential,
  Web_AccessView_AccessView_LoginCredentialState,
  Web_AccessView_AccessView_LoginDialog,
  Web_AccessView_AccessView_LoginDialogDescription,
  Web_AccessView_AccessView_LoginDialogHeading,
  Web_AccessView_AccessView_LoginDialogRef,
  Web_AccessView_AccessView_LoginDialogState,
  Web_AccessView_AccessView_LoginDialogTitleId,
  Web_AccessView_AccessView_LoginSubmitDisabled,
  Web_AccessView_AccessView_LoginSubmitLabel,
  Web_AccessView_AccessView_LoginSummary,
  Web_AccessView_AccessView_OnCreateRpcLogin,
  Web_AccessView_AccessView_OnCreateToken,
  Web_AccessView_AccessView_OnCreateWebProxyLogin,
  Web_AccessView_AccessView_OnDeleteRpcLogin,
  Web_AccessView_AccessView_OnDeleteWebProxyLogin,
  Web_AccessView_AccessView_OnOpenVpn,
  Web_AccessView_AccessView_OnRefreshWebProxy,
  Web_AccessView_AccessView_OnRevokeToken,
  Web_AccessView_AccessView_OnToggleRpc,
  Web_AccessView_AccessView_OnToggleWebProxy,
  Web_AccessView_AccessView_OnUpdateRpcLogin,
  Web_AccessView_AccessView_OnUpdateToken,
  Web_AccessView_AccessView_OnUpdateWebProxyLogin,
  Web_AccessView_AccessView_OpenLoginDialog,
  Web_AccessView_AccessView_OpenLoginDialog_Dialog,
  Web_AccessView_AccessView_OpenLoginDialog_InitialConnectionId,
  Web_AccessView_AccessView_OpenLoginDialog_Login,
  Web_AccessView_AccessView_OpenLoginDialog_Returns,
  Web_AccessView_AccessView_PollTimeoutId,
  Web_AccessView_AccessView_PollWebProxyTransition,
  Web_AccessView_AccessView_PollWebProxyTransition_NextWebProxy,
  Web_AccessView_AccessView_PollWebProxyTransition_Returns,
  Web_AccessView_AccessView_Props,
  Web_AccessView_AccessView_RefreshWebProxyRef,
  Web_AccessView_AccessView_RegeneratePassword,
  Web_AccessView_AccessView_RegeneratePasswordState,
  Web_AccessView_AccessView_Returns,
  Web_AccessView_AccessView_Revoke,
  Web_AccessView_AccessView_Revoke_Returns,
  Web_AccessView_AccessView_Revoke_Token,
  Web_AccessView_AccessView_Revoking,
  Web_AccessView_AccessView_RevokingName,
  Web_AccessView_AccessView_RevokingState,
  Web_AccessView_AccessView_RpcEnabled,
  Web_AccessView_AccessView_RpcEndpoint,
  Web_AccessView_AccessView_RpcLoginPrompt,
  Web_AccessView_AccessView_RpcLogins,
  Web_AccessView_AccessView_RpcProxyHelp,
  Web_AccessView_AccessView_RpcProxyState,
  Web_AccessView_AccessView_RpcProxyStateLabel,
  Web_AccessView_AccessView_RpcRequestedDirection,
  Web_AccessView_AccessView_RpcRequestedEnabled,
  Web_AccessView_AccessView_RpcRequestedEnabledState,
  Web_AccessView_AccessView_RpcSwitchDisabled,
  Web_AccessView_AccessView_RpcSwitchEnabled,
  Web_AccessView_AccessView_RpcTransitionSequenceRef,
  Web_AccessView_AccessView_SelectedConnection,
  Web_AccessView_AccessView_SelectedConnectionName,
  Web_AccessView_AccessView_SetActionError,
  Web_AccessView_AccessView_SetBusy,
  Web_AccessView_AccessView_SetConnectionId,
  Web_AccessView_AccessView_SetCopied,
  Web_AccessView_AccessView_SetCredentialTitle,
  Web_AccessView_AccessView_SetDeletingLogin,
  Web_AccessView_AccessView_SetEditingLogin,
  Web_AccessView_AccessView_SetEditingToken,
  Web_AccessView_AccessView_SetLoginCredential,
  Web_AccessView_AccessView_SetLoginDialog,
  Web_AccessView_AccessView_SetRegeneratePassword,
  Web_AccessView_AccessView_SetRevoking,
  Web_AccessView_AccessView_SetRpcRequestedEnabled,
  Web_AccessView_AccessView_SetTokenDialogOpen,
  Web_AccessView_AccessView_SetUsername,
  Web_AccessView_AccessView_SetWebProxyRequestedEnabled,
  Web_AccessView_AccessView_ShowConnectionField,
  Web_AccessView_AccessView_SocksAddress,
  Web_AccessView_AccessView_SubmitLogin,
  Web_AccessView_AccessView_SubmitLogin_Credential,
  Web_AccessView_AccessView_SubmitLogin_Event,
  Web_AccessView_AccessView_SubmitLogin_Returns,
  Web_AccessView_AccessView_SubmitLogin_WebCredential,
  Web_AccessView_AccessView_TimeoutId,
  Web_AccessView_AccessView_ToggleRpc,
  Web_AccessView_AccessView_ToggleRpc_RequestedEnabled,
  Web_AccessView_AccessView_ToggleRpc_Returns,
  Web_AccessView_AccessView_ToggleRpc_TransitionSequence,
  Web_AccessView_AccessView_ToggleWebProxy,
  Web_AccessView_AccessView_ToggleWebProxy_NextWebProxy,
  Web_AccessView_AccessView_ToggleWebProxy_RequestedEnabled,
  Web_AccessView_AccessView_ToggleWebProxy_Returns,
  Web_AccessView_AccessView_ToggleWebProxy_TransitionSequence,
  Web_AccessView_AccessView_TokenDialogOpen,
  Web_AccessView_AccessView_TokenDialogOpenState,
  Web_AccessView_AccessView_Tokens,
  Web_AccessView_AccessView_TransitionSequence,
  Web_AccessView_AccessView_Username,
  Web_AccessView_AccessView_UsernameIssue,
  Web_AccessView_AccessView_UsernameState,
  Web_AccessView_AccessView_Value,
  Web_AccessView_AccessView_WebProxy,
  Web_AccessView_AccessView_WebProxyEnabled,
  Web_AccessView_AccessView_WebProxyError,
  Web_AccessView_AccessView_WebProxyHelp,
  Web_AccessView_AccessView_WebProxyLoginCount,
  Web_AccessView_AccessView_WebProxyLoginPrompt,
  Web_AccessView_AccessView_WebProxyLogins,
  Web_AccessView_AccessView_WebProxyObservedState,
  Web_AccessView_AccessView_WebProxyPort,
  Web_AccessView_AccessView_WebProxyRequestedDirection,
  Web_AccessView_AccessView_WebProxyRequestedEnabled,
  Web_AccessView_AccessView_WebProxyRequestedEnabledState,
  Web_AccessView_AccessView_WebProxyState,
  Web_AccessView_AccessView_WebProxyStateLabel,
  Web_AccessView_AccessView_WebProxyStateRef,
  Web_AccessView_AccessView_WebProxySwitchDisabled,
  Web_AccessView_AccessView_WebProxySwitchEnabled,
  Web_AccessView_AccessView_WebProxyTransitionSequenceRef,
  Web_AccessView_AccessView_WebProxyTransitionStartedAtRef,
  Web_AccessView_BreakAddressAtBoundaries_Address,
  Web_AccessView_BreakAddressAtBoundaries_AuthorityEnd,
  Web_AccessView_BreakAddressAtBoundaries_AuthorityStart,
  Web_AccessView_BreakAddressAtBoundaries_Parts,
  Web_AccessView_BreakAddressAtBoundaries_PathStart,
  Web_AccessView_BreakAddressAtBoundaries_Returns,
  Web_AccessView_BreakAddressAtBoundaries_SchemeIndex,
} from '@/types/web/access-view.d.ts';

/**
 * Access View - Break Address At Boundaries.
 *
 * Lets an address wrap after its "://" and each path slash without splitting
 * its host, port, or a path segment.
 *
 * @param {Web_AccessView_BreakAddressAtBoundaries_Address} address - Address.
 *
 * @returns {Web_AccessView_BreakAddressAtBoundaries_Returns}
 *
 * @since 2.0.0
 */
const breakAddressAtBoundaries = (address: Web_AccessView_BreakAddressAtBoundaries_Address): Web_AccessView_BreakAddressAtBoundaries_Returns => {
  const schemeIndex: Web_AccessView_BreakAddressAtBoundaries_SchemeIndex = address.indexOf('://');

  if (schemeIndex === -1) {
    return address;
  }

  const authorityStart: Web_AccessView_BreakAddressAtBoundaries_AuthorityStart = schemeIndex + 3;
  const pathStart: Web_AccessView_BreakAddressAtBoundaries_PathStart = address.indexOf('/', authorityStart);
  const authorityEnd: Web_AccessView_BreakAddressAtBoundaries_AuthorityEnd = (pathStart === -1) ? address.length : pathStart;
  const parts: Web_AccessView_BreakAddressAtBoundaries_Parts = [
    address.slice(0, authorityStart),
    <wbr key="scheme" />,
    address.slice(authorityStart, authorityEnd),
  ];

  if (pathStart !== -1) {
    address.slice(pathStart).split('/').forEach((segment, index) => {
      if (index > 0) {
        parts.push('/', <wbr key={`path-${index}`} />);
      }

      if (segment !== '') {
        parts.push(segment);
      }

      return;
    });
  }

  return <>{parts}</>;
};

/**
 * Access View - Access View.
 *
 * Manages dedicated credentials for compatible RPC clients, API scripts, and
 * devices that route web traffic through the VPN.
 *
 * @param {Web_AccessView_AccessView_Props} props - Props.
 *
 * @returns {Web_AccessView_AccessView_Returns}
 *
 * @since 2.0.0
 */
export const AccessView = (props: Web_AccessView_AccessView_Props): Web_AccessView_AccessView_Returns => {
  const connections: Web_AccessView_AccessView_Connections = props['connections'];
  const onCreateRPCLogin: Web_AccessView_AccessView_OnCreateRpcLogin = props['onCreateRPCLogin'];
  const onCreateToken: Web_AccessView_AccessView_OnCreateToken = props['onCreateToken'];
  const onCreateWebProxyLogin: Web_AccessView_AccessView_OnCreateWebProxyLogin = props['onCreateWebProxyLogin'];
  const onDeleteRPCLogin: Web_AccessView_AccessView_OnDeleteRpcLogin = props['onDeleteRPCLogin'];
  const onDeleteWebProxyLogin: Web_AccessView_AccessView_OnDeleteWebProxyLogin = props['onDeleteWebProxyLogin'];
  const onOpenVPN: Web_AccessView_AccessView_OnOpenVpn = props['onOpenVPN'];
  const onRefreshWebProxy: Web_AccessView_AccessView_OnRefreshWebProxy = props['onRefreshWebProxy'];
  const onRevokeToken: Web_AccessView_AccessView_OnRevokeToken = props['onRevokeToken'];
  const onToggleRPC: Web_AccessView_AccessView_OnToggleRpc = props['onToggleRPC'];
  const onToggleWebProxy: Web_AccessView_AccessView_OnToggleWebProxy = props['onToggleWebProxy'];
  const onUpdateRPCLogin: Web_AccessView_AccessView_OnUpdateRpcLogin = props['onUpdateRPCLogin'];
  const onUpdateToken: Web_AccessView_AccessView_OnUpdateToken = props['onUpdateToken'];
  const onUpdateWebProxyLogin: Web_AccessView_AccessView_OnUpdateWebProxyLogin = props['onUpdateWebProxyLogin'];
  const rpcEnabled: Web_AccessView_AccessView_RpcEnabled = props['rpcEnabled'];
  const rpcLogins: Web_AccessView_AccessView_RpcLogins = props['rpcLogins'];
  const tokens: Web_AccessView_AccessView_Tokens = props['tokens'];
  const webProxy: Web_AccessView_AccessView_WebProxy = props['webProxy'];
  const tokenDialogOpenState: Web_AccessView_AccessView_TokenDialogOpenState = useState<Web_AccessView_AccessView_TokenDialogOpen>(false);
  const tokenDialogOpen: Web_AccessView_AccessView_TokenDialogOpen = tokenDialogOpenState[0];
  const setTokenDialogOpen: Web_AccessView_AccessView_SetTokenDialogOpen = tokenDialogOpenState[1];
  const editingTokenState: Web_AccessView_AccessView_EditingTokenState = useState<Web_AccessView_AccessView_EditingToken>(null);
  const editingToken: Web_AccessView_AccessView_EditingToken = editingTokenState[0];
  const setEditingToken: Web_AccessView_AccessView_SetEditingToken = editingTokenState[1];
  const revokingState: Web_AccessView_AccessView_RevokingState = useState<Web_AccessView_AccessView_Revoking>(null);
  const revoking: Web_AccessView_AccessView_Revoking = revokingState[0];
  const setRevoking: Web_AccessView_AccessView_SetRevoking = revokingState[1];
  const loginDialogState: Web_AccessView_AccessView_LoginDialogState = useState<Web_AccessView_AccessView_LoginDialog>(null);
  const loginDialog: Web_AccessView_AccessView_LoginDialog = loginDialogState[0];
  const setLoginDialog: Web_AccessView_AccessView_SetLoginDialog = loginDialogState[1];
  const editingLoginState: Web_AccessView_AccessView_EditingLoginState = useState<Web_AccessView_AccessView_EditingLogin>(null);
  const editingLogin: Web_AccessView_AccessView_EditingLogin = editingLoginState[0];
  const setEditingLogin: Web_AccessView_AccessView_SetEditingLogin = editingLoginState[1];
  const deletingLoginState: Web_AccessView_AccessView_DeletingLoginState = useState<Web_AccessView_AccessView_DeletingLogin>(null);
  const deletingLogin: Web_AccessView_AccessView_DeletingLogin = deletingLoginState[0];
  const setDeletingLogin: Web_AccessView_AccessView_SetDeletingLogin = deletingLoginState[1];
  const usernameState: Web_AccessView_AccessView_UsernameState = useState<Web_AccessView_AccessView_Username>('');
  const username: Web_AccessView_AccessView_Username = usernameState[0];
  const setUsername: Web_AccessView_AccessView_SetUsername = usernameState[1];
  const connectionIDState: Web_AccessView_AccessView_ConnectionIdState = useState<Web_AccessView_AccessView_ConnectionId>('');
  const connectionID: Web_AccessView_AccessView_ConnectionId = connectionIDState[0];
  const setConnectionID: Web_AccessView_AccessView_SetConnectionId = connectionIDState[1];
  const regeneratePasswordState: Web_AccessView_AccessView_RegeneratePasswordState = useState<Web_AccessView_AccessView_RegeneratePassword>(false);
  const regeneratePassword: Web_AccessView_AccessView_RegeneratePassword = regeneratePasswordState[0];
  const setRegeneratePassword: Web_AccessView_AccessView_SetRegeneratePassword = regeneratePasswordState[1];
  const loginCredentialState: Web_AccessView_AccessView_LoginCredentialState = useState<Web_AccessView_AccessView_LoginCredential>(null);
  const loginCredential: Web_AccessView_AccessView_LoginCredential = loginCredentialState[0];
  const setLoginCredential: Web_AccessView_AccessView_SetLoginCredential = loginCredentialState[1];
  const credentialTitleState: Web_AccessView_AccessView_CredentialTitleState = useState<Web_AccessView_AccessView_CredentialTitle>('Login added');
  const credentialTitle: Web_AccessView_AccessView_CredentialTitle = credentialTitleState[0];
  const setCredentialTitle: Web_AccessView_AccessView_SetCredentialTitle = credentialTitleState[1];
  const busyState: Web_AccessView_AccessView_BusyState = useState<Web_AccessView_AccessView_Busy>(false);
  const busy: Web_AccessView_AccessView_Busy = busyState[0];
  const setBusy: Web_AccessView_AccessView_SetBusy = busyState[1];
  const rpcRequestedEnabledState: Web_AccessView_AccessView_RpcRequestedEnabledState = useState<Web_AccessView_AccessView_RpcRequestedEnabled>(null);
  const rpcRequestedEnabled: Web_AccessView_AccessView_RpcRequestedEnabled = rpcRequestedEnabledState[0];
  const setRPCRequestedEnabled: Web_AccessView_AccessView_SetRpcRequestedEnabled = rpcRequestedEnabledState[1];
  const webProxyRequestedEnabledState: Web_AccessView_AccessView_WebProxyRequestedEnabledState = useState<Web_AccessView_AccessView_WebProxyRequestedEnabled>(null);
  const webProxyRequestedEnabled: Web_AccessView_AccessView_WebProxyRequestedEnabled = webProxyRequestedEnabledState[0];
  const setWebProxyRequestedEnabled: Web_AccessView_AccessView_SetWebProxyRequestedEnabled = webProxyRequestedEnabledState[1];
  const actionErrorState: Web_AccessView_AccessView_ActionErrorState = useState<Web_AccessView_AccessView_ActionError>(null);
  const actionError: Web_AccessView_AccessView_ActionError = actionErrorState[0];
  const setActionError: Web_AccessView_AccessView_SetActionError = actionErrorState[1];
  const copiedState: Web_AccessView_AccessView_CopiedState = useState<Web_AccessView_AccessView_Copied>('');
  const copied: Web_AccessView_AccessView_Copied = copiedState[0];
  const setCopied: Web_AccessView_AccessView_SetCopied = copiedState[1];
  const webProxyObservedState: Web_AccessView_AccessView_WebProxyObservedState = (webProxy !== null) ? webProxy['state'] : undefined;
  const rpcTransitionSequenceRef: Web_AccessView_AccessView_RpcTransitionSequenceRef = useRef(0);
  const webProxyTransitionSequenceRef: Web_AccessView_AccessView_WebProxyTransitionSequenceRef = useRef(0);
  const webProxyTransitionStartedAtRef: Web_AccessView_AccessView_WebProxyTransitionStartedAtRef = useRef(0);
  const webProxyStateRef: Web_AccessView_AccessView_WebProxyStateRef = useRef(webProxyObservedState ?? 'off');
  const refreshWebProxyRef: Web_AccessView_AccessView_RefreshWebProxyRef = useRef(onRefreshWebProxy);

  const loginDialogTitleId: Web_AccessView_AccessView_LoginDialogTitleId = useId();
  const credentialDialogTitleId: Web_AccessView_AccessView_CredentialDialogTitleId = useId();
  const loginDialogRef: Web_AccessView_AccessView_LoginDialogRef = useDialogFocus(loginDialog !== null);
  const credentialDialogRef: Web_AccessView_AccessView_CredentialDialogRef = useDialogFocus(loginCredential !== null);
  const hostname: Web_AccessView_AccessView_Hostname = (window.location.hostname !== '') ? window.location.hostname : 'localhost';
  const rpcEndpoint: Web_AccessView_AccessView_RpcEndpoint = `http://${hostname}:9091/transmission/rpc`;
  const webProxyPort: Web_AccessView_AccessView_WebProxyPort = (webProxy !== null) ? webProxy['port'] : 22605;
  const webProxyEnabled: Web_AccessView_AccessView_WebProxyEnabled = (webProxy !== null) ? webProxy['enabled'] : false;
  const httpAddress: Web_AccessView_AccessView_HttpAddress = `http://${hostname}:${String(webProxyPort)}`;
  const socksAddress: Web_AccessView_AccessView_SocksAddress = `socks5://${hostname}:${String(webProxyPort)}`;
  const defaultConnection: Web_AccessView_AccessView_DefaultConnection = connections.find((connection) => connection['default'] === true);
  const hasVPNConnections: Web_AccessView_AccessView_HasVpnConnections = connections.length > 0;

  useEffect(() => {
    webProxyStateRef.current = webProxyObservedState ?? 'off';

    return;
  }, [webProxyObservedState]);

  useEffect(() => {
    refreshWebProxyRef.current = onRefreshWebProxy;

    return;
  }, [onRefreshWebProxy]);

  useEffect(() => {
    if (rpcRequestedEnabled === null) {
      return undefined;
    }

    const transitionSequence: Web_AccessView_AccessView_TransitionSequence = rpcTransitionSequenceRef.current;
    const timeoutID: Web_AccessView_AccessView_TimeoutId = window.setTimeout(() => {
      if (transitionSequence !== rpcTransitionSequenceRef.current) {
        return;
      }

      rpcTransitionSequenceRef.current = transitionSequence + 1;

      setRPCRequestedEnabled(null);

      const rpcRequestedDirection: Web_AccessView_AccessView_RpcRequestedDirection = (rpcRequestedEnabled === true) ? 'on' : 'off';

      showToast(
        `The RPC proxy didn't finish turning ${rpcRequestedDirection}. Check its status and try again.`,
        false,
      );

      return;
    }, proxyTransitionTimeoutMilliseconds);

    return () => window.clearTimeout(timeoutID);
  }, [rpcRequestedEnabled]);

  useEffect(() => {
    if (webProxyRequestedEnabled === null) {
      return undefined;
    }

    let effectActive: Web_AccessView_AccessView_EffectActive = true;
    let pollTimeoutID: Web_AccessView_AccessView_PollTimeoutId = undefined;
    const transitionSequence: Web_AccessView_AccessView_TransitionSequence = webProxyTransitionSequenceRef.current;

    /**
     * Access View - Finish Web Proxy Transition.
     *
     * Resolves matching runtime state or restores the switch after the shared
     * timeout. A sequence check keeps an older request from ending a newer one.
     *
     * @param {Web_AccessView_AccessView_FinishWebProxyTransition_ReportedState} reportedState - Reported state.
     *
     * @returns {Web_AccessView_AccessView_FinishWebProxyTransition_Returns}
     *
     * @since 2.0.0
     */
    const finishWebProxyTransition: Web_AccessView_AccessView_FinishWebProxyTransition = (reportedState: Web_AccessView_AccessView_FinishWebProxyTransition_ReportedState): Web_AccessView_AccessView_FinishWebProxyTransition_Returns => {
      if (transitionSequence !== webProxyTransitionSequenceRef.current) {
        return true;
      }

      const transitionStatus: Web_AccessView_AccessView_FinishWebProxyTransition_TransitionStatus = proxyTransitionStatus(
        webProxyRequestedEnabled,
        reportedState,
        Date.now() - webProxyTransitionStartedAtRef.current,
      );

      if (transitionStatus === 'settled') {
        webProxyTransitionSequenceRef.current = transitionSequence + 1;

        setWebProxyRequestedEnabled(null);

        return true;
      }

      if (transitionStatus === 'timed-out') {
        webProxyTransitionSequenceRef.current = transitionSequence + 1;

        setWebProxyRequestedEnabled(null);

        const webProxyRequestedDirection: Web_AccessView_AccessView_WebProxyRequestedDirection = (webProxyRequestedEnabled === true) ? 'on' : 'off';

        showToast(
          `The web proxy didn't finish turning ${webProxyRequestedDirection}. Check its status and try again.`,
          false,
        );

        return true;
      }

      return false;
    };

    /**
     * Access View - Poll Web Proxy Transition.
     *
     * Reads observed state once a second without overlapping requests. Cleanup
     * prevents an unmounted access page from applying a late result.
     *
     * @returns {Web_AccessView_AccessView_PollWebProxyTransition_Returns}
     *
     * @since 2.0.0
     */
    const pollWebProxyTransition: Web_AccessView_AccessView_PollWebProxyTransition = async (): Web_AccessView_AccessView_PollWebProxyTransition_Returns => {
      if (effectActive === false || finishWebProxyTransition(webProxyStateRef.current) === true) {
        return;
      }

      try {
        const nextWebProxy: Web_AccessView_AccessView_PollWebProxyTransition_NextWebProxy = await refreshWebProxyRef.current();

        if (effectActive !== true || finishWebProxyTransition(nextWebProxy['state']) === true) {
          return;
        }
      } catch {
        if (effectActive !== true) {
          return;
        }
      }

      pollTimeoutID = window.setTimeout(() => {
        void pollWebProxyTransition();

        return;
      }, 1000);

      return;
    };

    pollTimeoutID = window.setTimeout(() => {
      void pollWebProxyTransition();

      return;
    }, 1000);

    return () => {
      effectActive = false;

      if (pollTimeoutID !== undefined) {
        window.clearTimeout(pollTimeoutID);
      }

      return;
    };
  }, [webProxyRequestedEnabled]);

  useEscapeKey(() => {
    if (busy === false) {
      setLoginDialog(null);
    }

    return;
  }, loginDialog !== null);

  useEscapeKey(() => {
    if (busy === false) {
      setLoginCredential(null);
    }

    return;
  }, loginCredential !== null);

  /**
   * Access View - Copy Value.
   *
   * Copies one address or one-time secret and briefly changes its icon.
   * Clipboard contents are never persisted in component state.
   *
   * @param {Web_AccessView_AccessView_CopyValue_Label} label - Label.
   * @param {Web_AccessView_AccessView_CopyValue_Value} value - Value.
   *
   * @returns {Web_AccessView_AccessView_CopyValue_Returns}
   *
   * @since 2.0.0
   */
  const copyValue: Web_AccessView_AccessView_CopyValue = async (label: Web_AccessView_AccessView_CopyValue_Label, value: Web_AccessView_AccessView_CopyValue_Value): Web_AccessView_AccessView_CopyValue_Returns => {
    await navigator.clipboard.writeText(value);

    setCopied(label);

    window.setTimeout(() => setCopied(''), 1800);

    return;
  };

  /**
   * Access View - Open Login Dialog.
   *
   * Resets form state before adding or editing a remote login.
   * The selected login supplies the edit form's initial username.
   *
   * @param {Web_AccessView_AccessView_OpenLoginDialog_Dialog} dialog  - Dialog.
   * @param {Web_AccessView_AccessView_OpenLoginDialog_Login}  [login] - Login.
   *
   * @returns {Web_AccessView_AccessView_OpenLoginDialog_Returns}
   *
   * @since 2.0.0
   */
  const openLoginDialog: Web_AccessView_AccessView_OpenLoginDialog = (
    dialog: Web_AccessView_AccessView_OpenLoginDialog_Dialog,
    login: Web_AccessView_AccessView_OpenLoginDialog_Login = null,
  ): Web_AccessView_AccessView_OpenLoginDialog_Returns => {
    const firstConnection: Web_AccessView_AccessView_FirstConnection = connections[0];
    const firstConnectionID: Web_AccessView_AccessView_FirstConnectionId = (firstConnection !== undefined) ? firstConnection['id'] : '';
    let initialConnectionID: Web_AccessView_AccessView_OpenLoginDialog_InitialConnectionId = (defaultConnection === undefined) ? firstConnectionID : '';

    if (login !== null && 'connectionId' in login) {
      initialConnectionID = login['connectionId'] ?? '';
    }

    setEditingLogin(login);

    setUsername((login === null) ? '' : login['username']);

    setConnectionID(initialConnectionID);

    setRegeneratePassword(false);

    setActionError(null);

    setLoginDialog(dialog);

    return;
  };

  /**
   * Access View - Toggle Rpc.
   *
   * Changes the compatibility proxy setting and reports a server rejection.
   * The switch remains disabled until the request finishes.
   *
   * @returns {Web_AccessView_AccessView_ToggleRpc_Returns}
   *
   * @since 2.0.0
   */
  const toggleRPC: Web_AccessView_AccessView_ToggleRpc = async (): Web_AccessView_AccessView_ToggleRpc_Returns => {
    if (rpcRequestedEnabled !== null) {
      return;
    }

    const requestedEnabled: Web_AccessView_AccessView_ToggleRpc_RequestedEnabled = rpcEnabled === false;
    const transitionSequence: Web_AccessView_AccessView_ToggleRpc_TransitionSequence = rpcTransitionSequenceRef.current + 1;

    rpcTransitionSequenceRef.current = transitionSequence;

    setRPCRequestedEnabled(requestedEnabled);

    try {
      await onToggleRPC(requestedEnabled);

      if (transitionSequence === rpcTransitionSequenceRef.current) {
        setRPCRequestedEnabled(null);
      }
    } catch (caughtError) {
      if (transitionSequence === rpcTransitionSequenceRef.current) {
        setRPCRequestedEnabled(null);

        showToast((caughtError instanceof Error) ? caughtError.message : 'RPC access could not be changed.', false);
      }
    }

    return;
  };

  /**
   * Access View - Toggle Web Proxy.
   *
   * Saves the desired proxy state independently from its login collection.
   * Any VPN prerequisite rejection is shown in an error toast.
   *
   * @returns {Web_AccessView_AccessView_ToggleWebProxy_Returns}
   *
   * @since 2.0.0
   */
  const toggleWebProxy: Web_AccessView_AccessView_ToggleWebProxy = async (): Web_AccessView_AccessView_ToggleWebProxy_Returns => {
    if (webProxyRequestedEnabled !== null) {
      return;
    }

    const requestedEnabled: Web_AccessView_AccessView_ToggleWebProxy_RequestedEnabled = webProxyEnabled === false;
    const transitionSequence: Web_AccessView_AccessView_ToggleWebProxy_TransitionSequence = webProxyTransitionSequenceRef.current + 1;

    webProxyTransitionSequenceRef.current = transitionSequence;
    webProxyTransitionStartedAtRef.current = Date.now();

    setWebProxyRequestedEnabled(requestedEnabled);

    try {
      const nextWebProxy: Web_AccessView_AccessView_ToggleWebProxy_NextWebProxy = await onToggleWebProxy(requestedEnabled);

      if (
        transitionSequence === webProxyTransitionSequenceRef.current
        && proxyTransitionStatus(
          requestedEnabled,
          nextWebProxy['state'],
          Date.now() - webProxyTransitionStartedAtRef.current,
        ) === 'settled'
      ) {
        setWebProxyRequestedEnabled(null);
      }
    } catch (caughtError) {
      if (transitionSequence === webProxyTransitionSequenceRef.current) {
        setWebProxyRequestedEnabled(null);

        showToast((caughtError instanceof Error) ? caughtError.message : 'The web proxy could not be changed.', false);
      }
    }

    return;
  };

  /**
   * Access View - Submit Login.
   *
   * Creates an RPC or web proxy login, or saves either kind of edited login.
   * Generated passwords move directly into the one-time result dialog.
   *
   * @param {Web_AccessView_AccessView_SubmitLogin_Event} event - Event.
   *
   * @returns {Web_AccessView_AccessView_SubmitLogin_Returns}
   *
   * @since 2.0.0
   */
  const submitLogin: Web_AccessView_AccessView_SubmitLogin = async (event: Web_AccessView_AccessView_SubmitLogin_Event): Web_AccessView_AccessView_SubmitLogin_Returns => {
    event.preventDefault();

    if (loginDialog === null) {
      return;
    }

    setBusy(true);

    setActionError(null);

    try {
      if (loginDialog === 'rpc-add') {
        const credential: Web_AccessView_AccessView_SubmitLogin_Credential = await onCreateRPCLogin(username);

        setCredentialTitle('Login added');

        setLoginCredential(credential);
      } else if (loginDialog === 'web-add') {
        const credential: Web_AccessView_AccessView_SubmitLogin_WebCredential = await onCreateWebProxyLogin({
          connectionId: (connectionID === '') ? null : connectionID,
          username,
        });

        setCredentialTitle('Web proxy login added');

        setLoginCredential(credential);
      } else if (loginDialog === 'rpc-edit' && editingLogin !== null) {
        const credential: Web_AccessView_AccessView_SubmitLogin_Credential = await onUpdateRPCLogin(editingLogin['id'], {
          ...((regeneratePassword === true) ? { regeneratePassword: true } : {}),
          username,
        });

        if (credential['password'] !== undefined) {
          setCredentialTitle('Password regenerated');

          setLoginCredential(credential);
        } else {
          showToast(`${username.trim()} saved.`, true);
        }
      } else if (loginDialog === 'web-edit' && editingLogin !== null) {
        const credential: Web_AccessView_AccessView_SubmitLogin_WebCredential = await onUpdateWebProxyLogin(editingLogin['id'], {
          ...((hasVPNConnections === true) ? {
            connectionId: (connectionID === '') ? null : connectionID,
          } : {}),
          ...((regeneratePassword === true) ? { regeneratePassword: true } : {}),
          username,
        });

        if (credential['password'] !== undefined) {
          setCredentialTitle('Web proxy password regenerated');

          setLoginCredential(credential);
        } else {
          showToast(`${username.trim()} saved.`, true);
        }
      }

      setLoginDialog(null);
    } catch (caughtError) {
      setActionError(caughtError);
    } finally {
      setBusy(false);
    }

    return;
  };

  /**
   * Access View - Delete Login.
   *
   * Revokes the selected RPC or web proxy credential after confirmation.
   * A failed deletion remains open so it can be retried.
   *
   * @param {Web_AccessView_AccessView_DeleteLogin_Login} login - Login.
   *
   * @returns {Web_AccessView_AccessView_DeleteLogin_Returns}
   *
   * @since 2.0.0
   */
  const deleteLogin: Web_AccessView_AccessView_DeleteLogin = async (login: Web_AccessView_AccessView_DeleteLogin_Login): Web_AccessView_AccessView_DeleteLogin_Returns => {
    setBusy(true);

    setActionError(null);

    try {
      if (login['kind'] === 'rpc') {
        await onDeleteRPCLogin(login['id']);
      } else {
        await onDeleteWebProxyLogin(login['id']);
      }

      setDeletingLogin(null);

      showToast(`${login['username']} deleted.`, true);
    } catch (caughtError) {
      setActionError(caughtError);
    } finally {
      setBusy(false);
    }

    return;
  };

  /**
   * Access View - Revoke.
   *
   * Revokes the token picked in the confirm dialog.
   * A successful request refreshes the token list through the app.
   *
   * @param {Web_AccessView_AccessView_Revoke_Token} token - Token.
   *
   * @returns {Web_AccessView_AccessView_Revoke_Returns}
   *
   * @since 2.0.0
   */
  const revoke: Web_AccessView_AccessView_Revoke = async (token: Web_AccessView_AccessView_Revoke_Token): Web_AccessView_AccessView_Revoke_Returns => {
    setBusy(true);

    setActionError(null);

    try {
      await onRevokeToken(token['id']);

      setRevoking(null);

      showToast(`${token['name']} revoked.`, true);
    } catch (caughtError) {
      setActionError(caughtError);
    } finally {
      setBusy(false);
    }

    return;
  };

  /**
   * Access View - Expiry Label.
   *
   * Formats a token's expiry for its metadata row.
   * Expired timestamps are distinguished from future expiry dates.
   *
   * @param {Web_AccessView_AccessView_ExpiryLabel_Token} token - Token.
   *
   * @returns {Web_AccessView_AccessView_ExpiryLabel_Returns}
   *
   * @since 2.0.0
   */
  const expiryLabel: Web_AccessView_AccessView_ExpiryLabel = (token: Web_AccessView_AccessView_ExpiryLabel_Token): Web_AccessView_AccessView_ExpiryLabel_Returns => {
    if (token['expiresAt'] === null) {
      return 'no expiry';
    }

    return (Date.parse(token['expiresAt']) <= Date.now()) ? `expired ${formatShortDate(token['expiresAt'])}` : `expires ${formatShortDate(token['expiresAt'])}`;
  };

  const webProxyLogins: Web_AccessView_AccessView_WebProxyLogins = (webProxy !== null) ? webProxy['logins'] : [];
  const webProxyLoginCount: Web_AccessView_AccessView_WebProxyLoginCount = webProxyLogins.length;
  const rpcSwitchEnabled: Web_AccessView_AccessView_RpcSwitchEnabled = rpcRequestedEnabled ?? rpcEnabled;
  const webProxySwitchEnabled: Web_AccessView_AccessView_WebProxySwitchEnabled = webProxyRequestedEnabled ?? webProxyEnabled;
  let rpcProxyState: Web_AccessView_AccessView_RpcProxyState = 'off';
  let rpcProxyStateLabel: Web_AccessView_AccessView_RpcProxyStateLabel = 'Off';
  let rpcProxyHelp: Web_AccessView_AccessView_RpcProxyHelp = 'Not accepting connections.';

  if (rpcEnabled === true && rpcLogins.length === 0) {
    rpcProxyState = 'no-logins';
    rpcProxyStateLabel = 'No logins';
    rpcProxyHelp = 'Add a login before remote apps can sign in.';
  } else if (rpcEnabled === true) {
    rpcProxyState = 'ready';
    rpcProxyStateLabel = 'Ready';
    rpcProxyHelp = 'Remote apps sign in with RPC logins.';
  }

  // While switching, only the chip changes; the line keeps describing the current state so it changes once.
  if (rpcRequestedEnabled !== null) {
    const rpcRequestedDirection: Web_AccessView_AccessView_RpcRequestedDirection = (rpcRequestedEnabled === true) ? 'on' : 'off';

    rpcProxyState = 'turning';
    rpcProxyStateLabel = `Turning ${rpcRequestedDirection}…`;
  }

  let webProxyState: Web_AccessView_AccessView_WebProxyState = 'off';
  let webProxyStateLabel: Web_AccessView_AccessView_WebProxyStateLabel = 'Off';
  let webProxyHelp: Web_AccessView_AccessView_WebProxyHelp = 'Not accepting connections.';

  if (webProxyObservedState === 'listening' && webProxyLoginCount === 0) {
    webProxyState = 'no-logins';
    webProxyStateLabel = 'No logins';
    webProxyHelp = 'Add a login before anyone can use the proxy.';
  } else if (webProxyObservedState === 'listening') {
    webProxyState = 'ready';
    webProxyStateLabel = 'Ready';
    webProxyHelp = 'Connections leave through the login\'s VPN.';
  } else if (webProxyObservedState === 'waiting-for-vpn') {
    webProxyState = 'waiting';
    webProxyStateLabel = 'Waiting for the VPN';
    webProxyHelp = 'The proxy starts after the VPN is connected.';
  } else if (webProxyObservedState === 'error') {
    webProxyState = 'error';
    webProxyStateLabel = 'Error';
  }

  if (webProxyRequestedEnabled !== null) {
    const webProxyRequestedDirection: Web_AccessView_AccessView_WebProxyRequestedDirection = (webProxyRequestedEnabled === true) ? 'on' : 'off';

    webProxyState = 'turning';
    webProxyStateLabel = `Turning ${webProxyRequestedDirection}…`;
  }

  const webProxyError: Web_AccessView_AccessView_WebProxyError = (webProxy !== null) ? webProxy['error'] : undefined;

  webProxyHelp = webProxyError ?? webProxyHelp;

  const usernameIssue: Web_AccessView_AccessView_UsernameIssue = issueFor(actionError, 'username');
  const selectedConnection: Web_AccessView_AccessView_SelectedConnection = (connectionID === '') ? defaultConnection : connections.find(
    (connection) => connection['id'] === connectionID,
  );
  const selectedConnectionName: Web_AccessView_AccessView_SelectedConnectionName = (selectedConnection !== undefined) ? selectedConnection['name'] : 'The selected connection';
  const loginSummary: Web_AccessView_AccessView_LoginSummary = connectionBeingRemovedMessage(
    actionError,
    selectedConnectionName,
  ) ?? summaryFor(actionError, [
    'connectionId',
    'username',
  ], 'The login could not be saved.');
  const confirmError: Web_AccessView_AccessView_ConfirmError = summaryFor(actionError, [], 'The credential could not be removed.');
  const generatedPassword: Web_AccessView_AccessView_GeneratedPassword = (loginCredential !== null) ? loginCredential['password'] ?? '' : '';

  /**
   * Access View - Connection Label.
   *
   * Distinguishes an explicit connection from the current default while still
   * naming the effective route used by the login.
   *
   * @param {Web_AccessView_AccessView_ConnectionLabel_Login} login - Login.
   *
   * @returns {Web_AccessView_AccessView_ConnectionLabel_Returns}
   *
   * @since 2.0.0
   */
  const connectionLabel: Web_AccessView_AccessView_ConnectionLabel = (login: Web_AccessView_AccessView_ConnectionLabel_Login): Web_AccessView_AccessView_ConnectionLabel_Returns => {
    const storedConnection: Web_AccessView_AccessView_ConnectionLabel_StoredConnection = connections.find((candidate) => candidate['id'] === login['connectionId']);
    const effectiveConnection: Web_AccessView_AccessView_ConnectionLabel_EffectiveConnection = connections.find((candidate) => candidate['id'] === login['effectiveConnectionId']);

    if (login['connectionId'] === null || storedConnection === undefined) {
      let fallbackName: Web_AccessView_AccessView_ConnectionLabel_FallbackName = 'connection';

      if (effectiveConnection !== undefined) {
        fallbackName = effectiveConnection['name'];
      } else if (defaultConnection !== undefined) {
        fallbackName = defaultConnection['name'];
      }

      return `Default (${fallbackName})`;
    }

    return storedConnection['name'];
  };

  let loginSubmitLabel: Web_AccessView_AccessView_LoginSubmitLabel = 'Add login';

  if (busy === true) {
    loginSubmitLabel = 'Saving…';
  } else if (loginDialog === 'rpc-edit' || loginDialog === 'web-edit') {
    loginSubmitLabel = 'Save login';
  }

  let loginDialogHeading: Web_AccessView_AccessView_LoginDialogHeading = 'Add login';
  let loginDialogDescription: Web_AccessView_AccessView_LoginDialogDescription = 'Create credentials for another device that uses the web proxy.';

  if (loginDialog === 'rpc-add') {
    loginDialogDescription = 'Create credentials for a remote Transmission app.';
  } else if (loginDialog === 'rpc-edit') {
    loginDialogHeading = 'Edit login';
    loginDialogDescription = 'Change the username or password for a remote Transmission app.';
  } else if (loginDialog === 'web-edit') {
    loginDialogHeading = 'Edit login';
    loginDialogDescription = (hasVPNConnections === true) ? 'Change the username, VPN connection, or password for a device that uses the web proxy.' : 'Change the username or password for a device that uses the web proxy.';
  }

  const loginSubmitDisabled: Web_AccessView_AccessView_LoginSubmitDisabled = (
    busy === true
    || (
      hasVPNConnections === false
      && (
        loginDialog === 'rpc-add'
        || loginDialog === 'web-add'
      )
    )
  );
  const rpcSwitchDisabled: Web_AccessView_AccessView_RpcSwitchDisabled = (
    busy === true
    || rpcRequestedEnabled !== null
    || (
      hasVPNConnections === false
      && rpcSwitchEnabled === false
    )
  );
  const webProxySwitchDisabled: Web_AccessView_AccessView_WebProxySwitchDisabled = (
    busy === true
    || webProxy === null
    || webProxyRequestedEnabled !== null
    || (
      hasVPNConnections === false
      && webProxySwitchEnabled === false
    )
  );
  const showConnectionField: Web_AccessView_AccessView_ShowConnectionField = (
    loginDialog === 'web-add'
    || (
      loginDialog === 'web-edit'
      && hasVPNConnections === true
    )
  );
  const deletingLoginName: Web_AccessView_AccessView_DeletingLoginName = (deletingLogin !== null) ? deletingLogin['username'] : 'login';
  const revokingName: Web_AccessView_AccessView_RevokingName = (revoking !== null) ? revoking['name'] : 'token';
  let rpcLoginPrompt: Web_AccessView_AccessView_RpcLoginPrompt = null;

  if (hasVPNConnections === false) {
    rpcLoginPrompt = (
      <div className="proxy-login-empty">
        <p>Logins can be added once there&apos;s a VPN connection.</p>
      </div>
    );
  } else if (rpcLogins.length === 0) {
    rpcLoginPrompt = (
      <div className="proxy-login-empty">
        <p>No logins yet.</p>
        <Button icon="add" onClick={() => openLoginDialog('rpc-add')} variant="primary">Add login</Button>
      </div>
    );
  }

  let webProxyLoginPrompt: Web_AccessView_AccessView_WebProxyLoginPrompt = null;

  if (hasVPNConnections === false) {
    webProxyLoginPrompt = (
      <div className="proxy-login-empty">
        <p>Logins can be added once there&apos;s a VPN connection.</p>
      </div>
    );
  } else if (webProxyLoginCount === 0) {
    webProxyLoginPrompt = (
      <div className="proxy-login-empty">
        <p>No logins yet.</p>
        <Button icon="add" onClick={() => openLoginDialog('web-add')} variant="primary">Add login</Button>
      </div>
    );
  }

  return (
    <section className="workspace-section">
      <div className="workspace-heading">
        <h1>Remote apps</h1>
        <p>Connect remote apps, scripts, and other devices.</p>
      </div>

      <div className="proxy-grid">
        <article className="panel proxy-card rpc-proxy-card">
          <section className="form-section">
            <div className="form-section-head">
              <div className="proxy-card-title">
                <Icon name="torrent" size={18} />
                <h2>RPC proxy</h2>
              </div>
              <label className="switch-control">
                <span className="switch-label">{(rpcSwitchEnabled === true) ? 'On' : 'Off'}</span>
                <input
                  aria-busy={rpcRequestedEnabled !== null}
                  aria-label="Enable the RPC proxy"
                  checked={rpcSwitchEnabled}
                  disabled={rpcSwitchDisabled}
                  onChange={() => {
                    void toggleRPC();

                    return;
                  }}
                  type="checkbox"
                />
                <span className="switch-track"><span /></span>
              </label>
            </div>
            {(hasVPNConnections === true) ? null : (
              <p className="proxy-disabled-note">
                <button className="inline-link-button" onClick={onOpenVPN} type="button">Add VPN connection</button>
                {' to turn this on.'}
              </p>
            )}
            <div className="proxy-state-row">
              <span className={`state-chip ${rpcProxyState}`}>
                <span className="status-dot" />
                {rpcProxyStateLabel}
              </span>
              <span className="proxy-help">{rpcProxyHelp}</span>
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-head"><h2>Connection details</h2></div>
            <div className="copy-list">
              <div className="copy-row">
                <span>URL</span>
                <code title={rpcEndpoint}>{breakAddressAtBoundaries(rpcEndpoint)}</code>
                <button
                  aria-label="Copy URL"
                  className="icon-button"
                  onClick={() => {
                    void copyValue('rpc-url', rpcEndpoint);

                    return;
                  }}
                  title="Copy URL"
                  type="button"
                >
                  <Icon name={(copied === 'rpc-url') ? 'check' : 'copy'} size={16} />
                </button>
              </div>
            </div>
          </section>

          <section className="form-section proxy-login-section rpc-login-section">
            <div className="form-section-head">
              <h2>Logins</h2>
              {(hasVPNConnections === false || rpcLogins.length === 0) ? null : <Button icon="add" onClick={() => openLoginDialog('rpc-add')}>Add login</Button>}
            </div>
            {rpcLoginPrompt}
            {(rpcLogins.length === 0) ? null : (
              <div className="proxy-login-list">
                {rpcLogins.map((login) => (
                  <div className="proxy-login-row rpc-login-row" key={login['id']}>
                    <div className="proxy-login-copy">
                      <strong>{login['username']}</strong>
                      <small>{(login['lastUsedAt'] === null) ? 'Never used' : `Last used ${formatRelative(login['lastUsedAt'])}`}</small>
                    </div>
                    <div className="proxy-login-actions rpc-login-actions">
                      <Button disabled={busy} icon="edit" onClick={() => openLoginDialog('rpc-edit', login)} variant="quiet">Edit</Button>
                      <Button
                        disabled={busy}
                        icon="remove"
                        onClick={() => {
                          setActionError(null);

                          setDeletingLogin({
                            id: login['id'],
                            kind: 'rpc',
                            username: login['username'],
                          });

                          return;
                        }}
                        variant="danger"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </article>

        <article className="panel proxy-card api-tokens-card">
          <section className="form-section api-tokens-header">
            <div className="form-section-head">
              <div className="proxy-card-title">
                <Icon name="key" size={18} />
                <h2>API tokens</h2>
              </div>
              <Button
                icon="add"
                onClick={() => {
                  setEditingToken(null);

                  setTokenDialogOpen(true);

                  return;
                }}
                variant="primary"
              >
                Create token
              </Button>
            </div>
            <p className="proxy-help">Scripts using the API sign in with these tokens.</p>
          </section>

          <section className="form-section api-token-list">
            {(tokens.length === 0) ? <div className="token-empty"><p>No tokens yet.</p></div> : (
              <div className="token-list">
                {tokens.map((token) => (
                  <div className="token-strip" key={token['id']}>
                    <div className="token-strip-copy">
                      <span className="token-title">
                        <strong>{token['name']}</strong>
                        {token['scopes'].map((scope) => <span className="tag" key={scope}>{scope}</span>)}
                      </span>
                      <small>
                        {[
                          `created ${formatShortDate(token['createdAt'])}`,
                          (token['lastUsedAt'] === null) ? 'never used' : `used ${formatRelative(token['lastUsedAt'])}`,
                          expiryLabel(token),
                        ].map((part) => keepTogether(part)).join(' · ')}
                      </small>
                    </div>
                    <div className="panel-actions token-actions">
                      <Button
                        icon="edit"
                        onClick={() => {
                          setEditingToken(token);

                          setTokenDialogOpen(true);

                          return;
                        }}
                        variant="quiet"
                      >
                        Edit
                      </Button>
                      <Button
                        icon="remove"
                        onClick={() => {
                          setActionError(null);

                          setRevoking(token);

                          return;
                        }}
                        variant="danger"
                      >
                        Revoke
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </article>

        <article className="panel proxy-card web-proxy-card">
          <section className="form-section">
            <div className="form-section-head">
              <div className="proxy-card-title">
                <Icon name="shield" size={18} />
                <h2>Web proxy</h2>
              </div>
              <label className="switch-control">
                <span className="switch-label">{(webProxySwitchEnabled === true) ? 'On' : 'Off'}</span>
                <input
                  aria-busy={webProxyRequestedEnabled !== null}
                  aria-label="Enable the web proxy"
                  checked={webProxySwitchEnabled}
                  disabled={webProxySwitchDisabled}
                  onChange={() => {
                    void toggleWebProxy();

                    return;
                  }}
                  type="checkbox"
                />
                <span className="switch-track"><span /></span>
              </label>
            </div>
            {(hasVPNConnections === true) ? null : (
              <p className="proxy-disabled-note">
                <button className="inline-link-button" onClick={onOpenVPN} type="button">Add VPN connection</button>
                {' to turn this on.'}
              </p>
            )}
            <div className="proxy-state-row">
              <span className={`state-chip ${webProxyState}`}>
                <span className="status-dot" />
                {webProxyStateLabel}
              </span>
              <span className="proxy-help">{webProxyHelp}</span>
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-head"><h2>Addresses</h2></div>
            <div className="copy-list">
              {[
                [
                  'HTTP',
                  httpAddress,
                ],
                [
                  'SOCKS5',
                  socksAddress,
                ],
              ].map((address) => {
                const label: Web_AccessView_AccessView_Label = address[0] ?? '';
                const value: Web_AccessView_AccessView_Value = address[1] ?? '';

                return (
                  <div className="copy-row" key={label}>
                    <span>{label}</span>
                    <code title={value}>{breakAddressAtBoundaries(value)}</code>
                    <button
                      aria-label={`Copy ${label}`}
                      className="icon-button"
                      onClick={() => {
                        void copyValue(label, value);

                        return;
                      }}
                      title={`Copy ${label}`}
                      type="button"
                    >
                      <Icon name={(copied === label) ? 'check' : 'copy'} size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="form-section proxy-login-section">
            <div className="form-section-head">
              <h2>Logins</h2>
              {(hasVPNConnections === false || webProxyLoginCount === 0) ? null : <Button icon="add" onClick={() => openLoginDialog('web-add')}>Add login</Button>}
            </div>
            {webProxyLoginPrompt}
            {(webProxyLoginCount === 0) ? null : (
              <div className="proxy-login-list">
                {webProxyLogins.map((login) => (
                  <div className="proxy-login-row web-proxy-login-row" key={login['id']}>
                    <div className="proxy-login-copy">
                      <strong>{login['username']}</strong>
                      <small>{`VPN · ${connectionLabel(login)}`}</small>
                    </div>
                    <div className="proxy-login-actions web-proxy-login-actions">
                      <Button disabled={busy} icon="edit" onClick={() => openLoginDialog('web-edit', login)} variant="quiet">Edit</Button>
                      <Button
                        disabled={busy}
                        icon="remove"
                        onClick={() => {
                          setActionError(null);

                          setDeletingLogin({
                            id: login['id'],
                            kind: 'web',
                            username: login['username'],
                          });

                          return;
                        }}
                        variant="danger"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </article>
      </div>

      <TokenDialog onClose={() => setTokenDialogOpen(false)} onCreate={onCreateToken} onUpdate={onUpdateToken} open={tokenDialogOpen} token={editingToken} />

      {(loginDialog === null) ? null : (
        <div className="dialog-backdrop proxy-login-backdrop" role="presentation">
          <section aria-labelledby={loginDialogTitleId} aria-modal="true" className="dialog proxy-login-dialog" ref={loginDialogRef} role="dialog" tabIndex={-1}>
            <div className="dialog-heading">
              <div>
                <h2 id={loginDialogTitleId}>{loginDialogHeading}</h2>
                <p>{loginDialogDescription}</p>
              </div>
              <button aria-label="Close" className="icon-button" disabled={busy} onClick={() => setLoginDialog(null)} type="button"><Icon name="x" size={18} /></button>
            </div>
            <form
              noValidate
              onSubmit={(event) => {
                void submitLogin(event);

                return;
              }}
            >
              <FieldLabel>
                <span>Username</span>
                <input {...passwordManagerIgnore} autoComplete="off" onChange={(event) => setUsername(event.currentTarget.value)} type="text" value={username} />
                {(usernameIssue === '') ? null : <small className="field-error">{usernameIssue}</small>}
              </FieldLabel>
              {(loginDialog === 'rpc-add') ? <p className="credential-note">A password is generated for this app and shown once.</p> : null}
              {(loginDialog === 'web-add') ? <p className="credential-note">A password is generated for this device and shown once.</p> : null}
              {(showConnectionField === true) ? (
                <FieldLabel>
                  <span>VPN connection</span>
                  <select onChange={(event) => setConnectionID(event.currentTarget.value)} value={connectionID}>
                    {(defaultConnection === undefined) ? null : <option value="">{`Default (${defaultConnection['name']})`}</option>}
                    {connections.map((connection) => (
                      <option key={connection['id']} value={connection['id']}>{connection['name']}</option>
                    ))}
                  </select>
                  <small>Connections leave through the login&apos;s VPN.</small>
                </FieldLabel>
              ) : null}
              {(loginDialog === 'rpc-edit' || loginDialog === 'web-edit') ? (
                <label aria-label="Generate a new password" className="check-row">
                  <input checked={regeneratePassword} onChange={(event) => setRegeneratePassword(event.currentTarget.checked)} type="checkbox" />
                  <span>
                    <strong>Generate a new password</strong>
                    <small>The current password stops working when you save. The new one is shown once.</small>
                  </span>
                </label>
              ) : null}
              {(loginSummary === '') ? null : (
                <div className="form-error" role="alert">
                  <Icon name="warning" size={16} />
                  <span>{loginSummary}</span>
                </div>
              )}
              <div className="dialog-actions">
                <Button disabled={busy} onClick={() => setLoginDialog(null)}>Cancel</Button>
                <Button disabled={loginSubmitDisabled} type="submit" variant="primary">{loginSubmitLabel}</Button>
              </div>
            </form>
          </section>
        </div>
      )}

      {(loginCredential === null) ? null : (
        <div className="dialog-backdrop proxy-login-backdrop" role="presentation">
          <section aria-labelledby={credentialDialogTitleId} aria-modal="true" className="dialog proxy-login-dialog" ref={credentialDialogRef} role="dialog" tabIndex={-1}>
            <div className="dialog-heading">
              <div>
                <h2 id={credentialDialogTitleId}>{credentialTitle}</h2>
                <p>{'Copy this password now. It won\'t be shown again.'}</p>
              </div>
              <button aria-label="Close" className="icon-button" onClick={() => setLoginCredential(null)} type="button"><Icon name="x" size={18} /></button>
            </div>
            <div className="dialog-body">
              <label className="field">
                <span>Generated password</span>
                <span className="generated-secret-field">
                  <input aria-label="Generated password" className="monospace" readOnly type="text" value={generatedPassword} />
                  <button
                    aria-label="Copy generated password"
                    className="icon-button generated-secret-copy"
                    onClick={() => {
                      void copyValue('login-password', generatedPassword);

                      return;
                    }}
                    title="Copy generated password"
                    type="button"
                  >
                    <Icon name={(copied === 'login-password') ? 'check' : 'copy'} size={16} />
                  </button>
                </span>
              </label>
              <div className="dialog-actions"><Button onClick={() => setLoginCredential(null)} variant="primary">Done</Button></div>
            </div>
          </section>
        </div>
      )}

      <ConfirmDialog
        busy={busy}
        busyLabel="Deleting…"
        confirmLabel="Delete"
        error={(deletingLogin === null) ? '' : confirmError}
        message="Apps using this login stop working right away. This can't be undone."
        onCancel={() => setDeletingLogin(null)}
        onConfirm={() => {
          if (deletingLogin !== null) {
            void deleteLogin(deletingLogin);
          }

          return;
        }}
        open={deletingLogin !== null}
        title={`Delete ${deletingLoginName}?`}
      />

      <ConfirmDialog
        busy={busy}
        busyLabel="Revoking…"
        confirmLabel="Revoke"
        error={(revoking === null) ? '' : confirmError}
        message="Apps using this token stop working right away. This can't be undone."
        onCancel={() => setRevoking(null)}
        onConfirm={() => {
          if (revoking !== null) {
            void revoke(revoking);
          }

          return;
        }}
        open={revoking !== null}
        title={`Revoke ${revokingName}?`}
      />
    </section>
  );
};
