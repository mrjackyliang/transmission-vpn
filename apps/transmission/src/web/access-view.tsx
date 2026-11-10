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
  FormEvent,
  ReactElement,
  ReactNode,
} from 'react';

import type {
  Web_Api_RPCCredential,
  Web_Api_RPCLogin,
  Web_Api_Token,
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
 * Access View - Break address at boundaries.
 *
 * Lets an address wrap after its "://" and each path slash without splitting
 * its host, port, or a path segment.
 *
 * @since 2.0.0
 */
const breakAddressAtBoundaries = (address: string): ReactNode => {
  const schemeIndex: number = address.indexOf('://');

  if (schemeIndex === -1) {
    return address;
  }

  const authorityStart: number = schemeIndex + 3;
  const pathStart: number = address.indexOf('/', authorityStart);
  const authorityEnd: number = (pathStart === -1) ? address.length : pathStart;
  const parts: ReactNode[] = [
    address.slice(0, authorityStart),
    <wbr key="scheme" />,
    address.slice(authorityStart, authorityEnd),
  ];
  if (pathStart !== -1) {
    address.slice(pathStart).split('/').forEach((segment: string, index: number): void => {
      if (index > 0) {
        parts.push('/', <wbr key={`path-${index}`} />);
      }
      if (segment !== '') {
        parts.push(segment);
      }
    });
  }

  return <>{parts}</>;
};

/**
 * Access View.
 *
 * Manages dedicated credentials for compatible RPC clients, API scripts, and
 * devices that route web traffic through the VPN.
 *
 * @since 2.0.0
 */
export const AccessView = ({
  connections,
  onCreateRPCLogin,
  onCreateToken,
  onCreateWebProxyLogin,
  onDeleteRPCLogin,
  onDeleteWebProxyLogin,
  onOpenVPN,
  onRefreshWebProxy,
  onRevokeToken,
  onToggleRPC,
  onToggleWebProxy,
  onUpdateRPCLogin,
  onUpdateToken,
  onUpdateWebProxyLogin,
  rpcEnabled,
  rpcLogins,
  tokens,
  webProxy,
}: Web_Components_AccessView_Props): ReactElement => {
  const [
    tokenDialogOpen,
    setTokenDialogOpen,
  ] = useState<boolean>(false);
  const [
    editingToken,
    setEditingToken,
  ] = useState<Web_Api_Token | null>(null);
  const [
    revoking,
    setRevoking,
  ] = useState<Web_Api_Token | null>(null);
  const [
    loginDialog,
    setLoginDialog,
  ] = useState<Web_Components_AccessView_LoginDialog | null>(null);
  const [
    editingLogin,
    setEditingLogin,
  ] = useState<Web_Components_AccessView_EditingLogin>(null);
  const [
    deletingLogin,
    setDeletingLogin,
  ] = useState<Web_Components_AccessView_DeletingLogin | null>(null);
  const [
    username,
    setUsername,
  ] = useState<string>('');
  const [
    connectionID,
    setConnectionID,
  ] = useState<string>('');
  const [
    regeneratePassword,
    setRegeneratePassword,
  ] = useState<boolean>(false);
  const [
    loginCredential,
    setLoginCredential,
  ] = useState<Web_Components_AccessView_Credential | null>(null);
  const [
    credentialTitle,
    setCredentialTitle,
  ] = useState<string>('Login added');
  const [
    busy,
    setBusy,
  ] = useState<boolean>(false);
  const [
    rpcRequestedEnabled,
    setRPCRequestedEnabled,
  ] = useState<boolean | null>(null);
  const [
    webProxyRequestedEnabled,
    setWebProxyRequestedEnabled,
  ] = useState<boolean | null>(null);
  const [
    actionError,
    setActionError,
  ] = useState<unknown>(null);
  const [
    copied,
    setCopied,
  ] = useState<string>('');
  const rpcTransitionSequenceRef = useRef<number>(0);
  const webProxyTransitionSequenceRef = useRef<number>(0);
  const webProxyTransitionStartedAtRef = useRef<number>(0);
  const webProxyStateRef = useRef<Web_Api_WebProxyState>(webProxy?.['state'] ?? 'off');
  const refreshWebProxyRef = useRef(onRefreshWebProxy);

  const loginDialogTitleId: string = useId();
  const credentialDialogTitleId: string = useId();
  const loginDialogRef = useDialogFocus(loginDialog !== null);
  const credentialDialogRef = useDialogFocus(loginCredential !== null);
  const hostname: string = window.location.hostname || 'localhost';
  const rpcEndpoint: string = `http://${hostname}:9091/transmission/rpc`;
  const webProxyPort: number = webProxy?.['port'] ?? 22605;
  const httpAddress: string = `http://${hostname}:${String(webProxyPort)}`;
  const socksAddress: string = `socks5://${hostname}:${String(webProxyPort)}`;
  const defaultConnection = connections.find((connection): boolean => connection['default']);
  const hasVPNConnections: boolean = connections.length > 0;

  useEffect((): void => {
    webProxyStateRef.current = webProxy?.['state'] ?? 'off';
  }, [webProxy?.['state']]);
  useEffect((): void => {
    refreshWebProxyRef.current = onRefreshWebProxy;
  }, [onRefreshWebProxy]);

  useEffect((): (() => void) | undefined => {
    if (rpcRequestedEnabled === null) {
      return undefined;
    }

    const transitionSequence: number = rpcTransitionSequenceRef.current;
    const timeoutID: number = window.setTimeout((): void => {
      if (transitionSequence !== rpcTransitionSequenceRef.current) {
        return;
      }

      rpcTransitionSequenceRef.current = transitionSequence + 1;
      setRPCRequestedEnabled(null);
      showToast(
        `The RPC proxy didn't finish turning ${(rpcRequestedEnabled) ? 'on' : 'off'}. Check its status and try again.`,
        false,
      );
    }, proxyTransitionTimeoutMilliseconds);

    return (): void => window.clearTimeout(timeoutID);
  }, [rpcRequestedEnabled]);

  useEffect((): (() => void) | undefined => {
    if (webProxyRequestedEnabled === null) {
      return undefined;
    }

    let effectActive: boolean = true;
    let pollTimeoutID: number | undefined = undefined;
    const transitionSequence: number = webProxyTransitionSequenceRef.current;

    /**
     * Access View - Finishes web proxy transition.
     *
     * Resolves matching runtime state or restores the switch after the shared
     * timeout. A sequence check keeps an older request from ending a newer one.
     *
     * @param {Web_Api_WebProxyState} reportedState - Reported state.
     *
     * @returns {boolean}
     *
     * @since 2.0.0
     */
    const finishWebProxyTransition = (reportedState: Web_Api_WebProxyState): boolean => {
      if (transitionSequence !== webProxyTransitionSequenceRef.current) {
        return true;
      }

      const transitionStatus: 'busy' | 'settled' | 'timed-out' = proxyTransitionStatus(
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
        showToast(
          `The web proxy didn't finish turning ${(webProxyRequestedEnabled) ? 'on' : 'off'}. Check its status and try again.`,
          false,
        );

        return true;
      }

      return false;
    };

    /**
     * Access View - Polls web proxy transition.
     *
     * Reads observed state once a second without overlapping requests. Cleanup
     * prevents an unmounted access page from applying a late result.
     *
     * @returns {Promise<void>}
     *
     * @since 2.0.0
     */
    const pollWebProxyTransition = async (): Promise<void> => {
      if (!effectActive || finishWebProxyTransition(webProxyStateRef.current)) {
        return;
      }

      try {
        const nextWebProxy = await refreshWebProxyRef.current();
        if (!effectActive || finishWebProxyTransition(nextWebProxy['state'])) {
          return;
        }
      } catch {
        if (!effectActive) {
          return;
        }
      }

      pollTimeoutID = window.setTimeout((): void => {
        void pollWebProxyTransition();
      }, 1000);
    };

    pollTimeoutID = window.setTimeout((): void => {
      void pollWebProxyTransition();
    }, 1000);

    return (): void => {
      effectActive = false;
      if (pollTimeoutID !== undefined) {
        window.clearTimeout(pollTimeoutID);
      }
    };
  }, [webProxyRequestedEnabled]);

  useEscapeKey((): void => {
    if (!busy) {
      setLoginDialog(null);
    }
  }, loginDialog !== null);
  useEscapeKey((): void => {
    if (!busy) {
      setLoginCredential(null);
    }
  }, loginCredential !== null);

  /**
   * Access View - Copies value.
   *
   * Copies one address or one-time secret and briefly changes its icon.
   * Clipboard contents are never persisted in component state.
   *
   * @since 2.0.0
   */
  const copyValue = async (label: string, value: string): Promise<void> => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout((): void => setCopied(''), 1800);
  };

  /**
   * Access View - Opens login dialog.
   *
   * Resets form state before adding or editing a remote login.
   * The selected login supplies the edit form's initial username.
   *
   * @since 2.0.0
   */
  const openLoginDialog = (
    dialog: Web_Components_AccessView_LoginDialog,
    login: Web_Api_RPCLogin | Web_Api_WebProxyLogin | null = null,
  ): void => {
    let initialConnectionID: string = (defaultConnection === undefined) ? connections[0]?.['id'] ?? '' : '';
    if (login !== null && 'connectionId' in login) {
      initialConnectionID = login['connectionId'] ?? '';
    }

    setEditingLogin(login);
    setUsername((login === null) ? '' : login['username']);
    setConnectionID(initialConnectionID);
    setRegeneratePassword(false);
    setActionError(null);
    setLoginDialog(dialog);
  };

  /**
   * Access View - Toggles RPC.
   *
   * Changes the compatibility proxy setting and reports a server rejection.
   * The switch remains disabled until the request finishes.
   *
   * @since 2.0.0
   */
  const toggleRPC = async (): Promise<void> => {
    if (rpcRequestedEnabled !== null) {
      return;
    }

    const requestedEnabled: boolean = !rpcEnabled;
    const transitionSequence: number = rpcTransitionSequenceRef.current + 1;
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
  };

  /**
   * Access View - Toggles web proxy.
   *
   * Saves the desired proxy state independently from its login collection.
   * Any VPN prerequisite rejection is shown in an error toast.
   *
   * @since 2.0.0
   */
  const toggleWebProxy = async (): Promise<void> => {
    if (webProxyRequestedEnabled !== null) {
      return;
    }

    const requestedEnabled: boolean = !(webProxy?.['enabled'] ?? false);
    const transitionSequence: number = webProxyTransitionSequenceRef.current + 1;
    webProxyTransitionSequenceRef.current = transitionSequence;
    webProxyTransitionStartedAtRef.current = Date.now();
    setWebProxyRequestedEnabled(requestedEnabled);
    try {
      const nextWebProxy = await onToggleWebProxy(requestedEnabled);
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
  };

  /**
   * Access View - Submits login.
   *
   * Creates an RPC or web proxy login, or saves either kind of edited login.
   * Generated passwords move directly into the one-time result dialog.
   *
   * @since 2.0.0
   */
  const submitLogin = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (loginDialog === null) {
      return;
    }

    setBusy(true);
    setActionError(null);
    try {
      if (loginDialog === 'rpc-add') {
        const credential: Web_Api_RPCCredential = await onCreateRPCLogin(username);
        setCredentialTitle('Login added');
        setLoginCredential(credential);
      } else if (loginDialog === 'web-add') {
        const credential: Web_Api_WebProxyCredential = await onCreateWebProxyLogin({
          connectionId: (connectionID === '') ? null : connectionID,
          username,
        });
        setCredentialTitle('Web proxy login added');
        setLoginCredential(credential);
      } else if (loginDialog === 'rpc-edit' && editingLogin !== null) {
        const credential: Web_Api_RPCCredential = await onUpdateRPCLogin(editingLogin['id'], {
          ...((regeneratePassword) ? { regeneratePassword: true } : {}),
          username,
        });
        if (credential['password'] !== undefined) {
          setCredentialTitle('Password regenerated');
          setLoginCredential(credential);
        } else {
          showToast(`${username.trim()} saved.`, true);
        }
      } else if (loginDialog === 'web-edit' && editingLogin !== null) {
        const credential: Web_Api_WebProxyCredential = await onUpdateWebProxyLogin(editingLogin['id'], {
          ...((hasVPNConnections) ? {
            connectionId: (connectionID === '') ? null : connectionID,
          } : {}),
          ...((regeneratePassword) ? { regeneratePassword: true } : {}),
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
  };

  /**
   * Access View - Deletes login.
   *
   * Revokes the selected RPC or web proxy credential after confirmation.
   * A failed deletion remains open so it can be retried.
   *
   * @since 2.0.0
   */
  const deleteLogin = async (login: Web_Components_AccessView_DeletingLogin): Promise<void> => {
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
  };

  /**
   * Access View - Revokes token.
   *
   * Revokes the token picked in the confirm dialog.
   * A successful request refreshes the token list through the app.
   *
   * @since 2.0.0
   */
  const revoke = async (token: Web_Api_Token): Promise<void> => {
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
  };

  /**
   * Access View - Expiry label.
   *
   * Formats a token's expiry for its metadata row.
   * Expired timestamps are distinguished from future expiry dates.
   *
   * @since 2.0.0
   */
  const expiryLabel = (token: Web_Api_Token): string => {
    if (token['expiresAt'] === null) {
      return 'no expiry';
    }

    return (Date.parse(token['expiresAt']) <= Date.now()) ? `expired ${formatShortDate(token['expiresAt'])}` : `expires ${formatShortDate(token['expiresAt'])}`;
  };

  const rpcSwitchEnabled: boolean = rpcRequestedEnabled ?? rpcEnabled;
  const webProxySwitchEnabled: boolean = webProxyRequestedEnabled ?? (webProxy?.['enabled'] ?? false);
  let rpcProxyState: 'no-logins' | 'off' | 'ready' | 'turning' = 'off';
  let rpcProxyStateLabel: string = 'Off';
  let rpcProxyHelp: string = 'Not accepting connections.';
  if (rpcEnabled && rpcLogins.length === 0) {
    rpcProxyState = 'no-logins';
    rpcProxyStateLabel = 'No logins';
    rpcProxyHelp = 'Add a login before remote apps can sign in.';
  } else if (rpcEnabled) {
    rpcProxyState = 'ready';
    rpcProxyStateLabel = 'Ready';
    rpcProxyHelp = 'Remote apps sign in with RPC logins.';
  }
  // While switching, only the chip changes; the line keeps describing the current state so it changes once.
  if (rpcRequestedEnabled !== null) {
    rpcProxyState = 'turning';
    rpcProxyStateLabel = `Turning ${(rpcRequestedEnabled) ? 'on' : 'off'}…`;
  }
  let webProxyState: 'error' | 'no-logins' | 'off' | 'ready' | 'turning' | 'waiting' = 'off';
  let webProxyStateLabel: string = 'Off';
  let webProxyHelp: string = 'Not accepting connections.';
  if (webProxy?.['state'] === 'listening' && webProxy['logins'].length === 0) {
    webProxyState = 'no-logins';
    webProxyStateLabel = 'No logins';
    webProxyHelp = 'Add a login before anyone can use the proxy.';
  } else if (webProxy?.['state'] === 'listening') {
    webProxyState = 'ready';
    webProxyStateLabel = 'Ready';
    webProxyHelp = 'Connections leave through the login\'s VPN.';
  } else if (webProxy?.['state'] === 'waiting-for-vpn') {
    webProxyState = 'waiting';
    webProxyStateLabel = 'Waiting for the VPN';
    webProxyHelp = 'The proxy starts after the VPN is connected.';
  } else if (webProxy?.['state'] === 'error') {
    webProxyState = 'error';
    webProxyStateLabel = 'Error';
  }
  if (webProxyRequestedEnabled !== null) {
    webProxyState = 'turning';
    webProxyStateLabel = `Turning ${(webProxyRequestedEnabled) ? 'on' : 'off'}…`;
  }
  webProxyHelp = webProxy?.['error'] ?? webProxyHelp;
  const usernameIssue: string = issueFor(actionError, 'username');
  const selectedConnection = (connectionID === '') ? defaultConnection : connections.find(
    (connection): boolean => connection['id'] === connectionID,
  );
  const loginSummary: string = connectionBeingRemovedMessage(
    actionError,
    selectedConnection?.['name'] ?? 'The selected connection',
  ) ?? summaryFor(actionError, [
    'connectionId',
    'username',
  ], 'The login could not be saved.');
  const confirmError: string = summaryFor(actionError, [], 'The credential could not be removed.');
  const generatedPassword: string = loginCredential?.['password'] ?? '';

  /**
   * Access View - Connection label.
   *
   * Distinguishes an explicit connection from the current default while still
   * naming the effective route used by the login.
   *
   * @since 2.0.0
   */
  const connectionLabel = (login: Web_Api_WebProxyLogin): string => {
    const storedConnection = connections.find((candidate): boolean => candidate['id'] === login['connectionId']);
    const effectiveConnection = connections.find((candidate): boolean => candidate['id'] === login['effectiveConnectionId']);

    if (login['connectionId'] === null || storedConnection === undefined) {
      return `Default (${effectiveConnection?.['name'] ?? defaultConnection?.['name'] ?? 'connection'})`;
    }

    return storedConnection['name'];
  };
  let loginSubmitLabel: string = 'Add login';
  if (busy) {
    loginSubmitLabel = 'Saving…';
  } else if (loginDialog === 'rpc-edit' || loginDialog === 'web-edit') {
    loginSubmitLabel = 'Save login';
  }
  let loginDialogHeading: string = 'Add login';
  let loginDialogDescription: string = 'Create credentials for another device that uses the web proxy.';
  if (loginDialog === 'rpc-add') {
    loginDialogDescription = 'Create credentials for a remote Transmission app.';
  } else if (loginDialog === 'rpc-edit') {
    loginDialogHeading = 'Edit login';
    loginDialogDescription = 'Change the username or password for a remote Transmission app.';
  } else if (loginDialog === 'web-edit') {
    loginDialogHeading = 'Edit login';
    loginDialogDescription = (hasVPNConnections) ? 'Change the username, VPN connection, or password for a device that uses the web proxy.' : 'Change the username or password for a device that uses the web proxy.';
  }
  const loginSubmitDisabled: boolean = busy || (!hasVPNConnections && (
    loginDialog === 'rpc-add' || loginDialog === 'web-add'
  ));
  let rpcLoginPrompt: ReactElement | null = null;
  if (!hasVPNConnections) {
    rpcLoginPrompt = (
      <div className="proxy-login-empty">
        <p>Logins can be added once there&apos;s a VPN connection.</p>
      </div>
    );
  } else if (rpcLogins.length === 0) {
    rpcLoginPrompt = (
      <div className="proxy-login-empty">
        <p>No logins yet.</p>
        <Button icon="add" onClick={(): void => openLoginDialog('rpc-add')} variant="primary">Add login</Button>
      </div>
    );
  }
  let webProxyLoginPrompt: ReactElement | null = null;
  if (!hasVPNConnections) {
    webProxyLoginPrompt = (
      <div className="proxy-login-empty">
        <p>Logins can be added once there&apos;s a VPN connection.</p>
      </div>
    );
  } else if ((webProxy?.['logins'].length ?? 0) === 0) {
    webProxyLoginPrompt = (
      <div className="proxy-login-empty">
        <p>No logins yet.</p>
        <Button icon="add" onClick={(): void => openLoginDialog('web-add')} variant="primary">Add login</Button>
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
                <span className="switch-label">{(rpcSwitchEnabled) ? 'On' : 'Off'}</span>
                <input
                  aria-busy={rpcRequestedEnabled !== null}
                  aria-label="Enable the RPC proxy"
                  checked={rpcSwitchEnabled}
                  disabled={busy || rpcRequestedEnabled !== null || (!hasVPNConnections && !rpcSwitchEnabled)}
                  onChange={(): void => {
                    void toggleRPC();
                  }}
                  type="checkbox"
                />
                <span className="switch-track"><span /></span>
              </label>
            </div>
            {(hasVPNConnections) ? null : (
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
                  onClick={(): void => {
                    void copyValue('rpc-url', rpcEndpoint);
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
              {(!hasVPNConnections || rpcLogins.length === 0) ? null : <Button icon="add" onClick={(): void => openLoginDialog('rpc-add')}>Add login</Button>}
            </div>
            {rpcLoginPrompt}
            {(rpcLogins.length === 0) ? null : (
              <div className="proxy-login-list">
                {rpcLogins.map((login: Web_Api_RPCLogin): ReactElement => (
                  <div className="proxy-login-row rpc-login-row" key={login['id']}>
                    <div className="proxy-login-copy">
                      <strong>{login['username']}</strong>
                      <small>{(login['lastUsedAt'] === null) ? 'Never used' : `Last used ${formatRelative(login['lastUsedAt'])}`}</small>
                    </div>
                    <div className="proxy-login-actions rpc-login-actions">
                      <Button disabled={busy} icon="edit" onClick={(): void => openLoginDialog('rpc-edit', login)} variant="quiet">Edit</Button>
                      <Button
                        disabled={busy}
                        icon="remove"
                        onClick={(): void => {
                          setActionError(null);
                          setDeletingLogin({
                            id: login['id'],
                            kind: 'rpc',
                            username: login['username'],
                          });
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
                onClick={(): void => {
                  setEditingToken(null);
                  setTokenDialogOpen(true);
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
                {tokens.map((token: Web_Api_Token): ReactElement => (
                  <div className="token-strip" key={token['id']}>
                    <div className="token-strip-copy">
                      <span className="token-title">
                        <strong>{token['name']}</strong>
                        {token['scopes'].map((scope: string): ReactElement => <span className="tag" key={scope}>{scope}</span>)}
                      </span>
                      <small>
                        {[
                          `created ${formatShortDate(token['createdAt'])}`,
                          (token['lastUsedAt'] === null) ? 'never used' : `used ${formatRelative(token['lastUsedAt'])}`,
                          expiryLabel(token),
                        ].map((part: string): string => keepTogether(part)).join(' · ')}
                      </small>
                    </div>
                    <div className="panel-actions token-actions">
                      <Button
                        icon="edit"
                        onClick={(): void => {
                          setEditingToken(token);
                          setTokenDialogOpen(true);
                        }}
                        variant="quiet"
                      >
                        Edit
                      </Button>
                      <Button
                        icon="remove"
                        onClick={(): void => {
                          setActionError(null);
                          setRevoking(token);
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
                <span className="switch-label">{(webProxySwitchEnabled) ? 'On' : 'Off'}</span>
                <input
                  aria-busy={webProxyRequestedEnabled !== null}
                  aria-label="Enable the web proxy"
                  checked={webProxySwitchEnabled}
                  disabled={busy || webProxy === null || webProxyRequestedEnabled !== null || (!hasVPNConnections && !webProxySwitchEnabled)}
                  onChange={(): void => {
                    void toggleWebProxy();
                  }}
                  type="checkbox"
                />
                <span className="switch-track"><span /></span>
              </label>
            </div>
            {(hasVPNConnections) ? null : (
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
              ].map(([
                label = '',
                value = '']: string[
              ]): ReactElement => (
                <div className="copy-row" key={label}>
                  <span>{label}</span>
                  <code title={value}>{breakAddressAtBoundaries(value)}</code>
                  <button
                    aria-label={`Copy ${label}`}
                    className="icon-button"
                    onClick={(): void => {
                      void copyValue(label, value);
                    }}
                    title={`Copy ${label}`}
                    type="button"
                  >
                    <Icon name={(copied === label) ? 'check' : 'copy'} size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="form-section proxy-login-section">
            <div className="form-section-head">
              <h2>Logins</h2>
              {(!hasVPNConnections || (webProxy?.['logins'].length ?? 0) === 0) ? null : <Button icon="add" onClick={(): void => openLoginDialog('web-add')}>Add login</Button>}
            </div>
            {webProxyLoginPrompt}
            {((webProxy?.['logins'].length ?? 0) === 0) ? null : (
              <div className="proxy-login-list">
                {webProxy?.['logins'].map((login: Web_Api_WebProxyLogin): ReactElement => (
                  <div className="proxy-login-row web-proxy-login-row" key={login['id']}>
                    <div className="proxy-login-copy">
                      <strong>{login['username']}</strong>
                      <small>{`VPN · ${connectionLabel(login)}`}</small>
                    </div>
                    <div className="proxy-login-actions web-proxy-login-actions">
                      <Button disabled={busy} icon="edit" onClick={(): void => openLoginDialog('web-edit', login)} variant="quiet">Edit</Button>
                      <Button
                        disabled={busy}
                        icon="remove"
                        onClick={(): void => {
                          setActionError(null);
                          setDeletingLogin({
                            id: login['id'],
                            kind: 'web',
                            username: login['username'],
                          });
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

      <TokenDialog onClose={(): void => setTokenDialogOpen(false)} onCreate={onCreateToken} onUpdate={onUpdateToken} open={tokenDialogOpen} token={editingToken} />

      {(loginDialog === null) ? null : (
        <div className="dialog-backdrop proxy-login-backdrop" role="presentation">
          <section aria-labelledby={loginDialogTitleId} aria-modal="true" className="dialog proxy-login-dialog" ref={loginDialogRef} role="dialog" tabIndex={-1}>
            <div className="dialog-heading">
              <div>
                <h2 id={loginDialogTitleId}>{loginDialogHeading}</h2>
                <p>{loginDialogDescription}</p>
              </div>
              <button aria-label="Close" className="icon-button" disabled={busy} onClick={(): void => setLoginDialog(null)} type="button"><Icon name="x" size={18} /></button>
            </div>
            <form
              noValidate
              onSubmit={(event: FormEvent<HTMLFormElement>): void => {
                void submitLogin(event);
              }}
            >
              <FieldLabel>
                <span>Username</span>
                <input {...passwordManagerIgnore} autoComplete="off" onChange={(event): void => setUsername(event.currentTarget.value)} type="text" value={username} />
                {(usernameIssue === '') ? null : <small className="field-error">{usernameIssue}</small>}
              </FieldLabel>
              {(loginDialog === 'rpc-add') ? <p className="credential-note">A password is generated for this app and shown once.</p> : null}
              {(loginDialog === 'web-add') ? <p className="credential-note">A password is generated for this device and shown once.</p> : null}
              {(loginDialog === 'web-add' || (loginDialog === 'web-edit' && hasVPNConnections)) ? (
                <FieldLabel>
                  <span>VPN connection</span>
                  <select onChange={(event): void => setConnectionID(event.currentTarget.value)} value={connectionID}>
                    {(defaultConnection === undefined) ? null : <option value="">{`Default (${defaultConnection['name']})`}</option>}
                    {connections.map((connection): ReactElement => (
                      <option key={connection['id']} value={connection['id']}>{connection['name']}</option>
                    ))}
                  </select>
                  <small>Connections leave through the login&apos;s VPN.</small>
                </FieldLabel>
              ) : null}
              {(loginDialog === 'rpc-edit' || loginDialog === 'web-edit') ? (
                <label aria-label="Generate a new password" className="check-row">
                  <input checked={regeneratePassword} onChange={(event): void => setRegeneratePassword(event.currentTarget.checked)} type="checkbox" />
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
                <Button disabled={busy} onClick={(): void => setLoginDialog(null)}>Cancel</Button>
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
              <button aria-label="Close" className="icon-button" onClick={(): void => setLoginCredential(null)} type="button"><Icon name="x" size={18} /></button>
            </div>
            <div className="dialog-body">
              <label className="field">
                <span>Generated password</span>
                <span className="generated-secret-field">
                  <input aria-label="Generated password" className="monospace" readOnly type="text" value={generatedPassword} />
                  <button
                    aria-label="Copy generated password"
                    className="icon-button generated-secret-copy"
                    onClick={(): void => {
                      void copyValue('login-password', generatedPassword);
                    }}
                    title="Copy generated password"
                    type="button"
                  >
                    <Icon name={(copied === 'login-password') ? 'check' : 'copy'} size={16} />
                  </button>
                </span>
              </label>
              <div className="dialog-actions"><Button onClick={(): void => setLoginCredential(null)} variant="primary">Done</Button></div>
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
        onCancel={(): void => setDeletingLogin(null)}
        onConfirm={(): void => {
          if (deletingLogin !== null) {
            void deleteLogin(deletingLogin);
          }
        }}
        open={deletingLogin !== null}
        title={`Delete ${deletingLogin?.['username'] ?? 'login'}?`}
      />

      <ConfirmDialog
        busy={busy}
        busyLabel="Revoking…"
        confirmLabel="Revoke"
        error={(revoking === null) ? '' : confirmError}
        message="Apps using this token stop working right away. This can't be undone."
        onCancel={(): void => setRevoking(null)}
        onConfirm={(): void => {
          if (revoking !== null) {
            void revoke(revoking);
          }
        }}
        open={revoking !== null}
        title={`Revoke ${revoking?.['name'] ?? 'token'}?`}
      />
    </section>
  );
};
