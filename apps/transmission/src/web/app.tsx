import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { AccessView } from '@/web/access-view.tsx';
import { AddTorrentDialog } from '@/web/add-torrent-dialog.tsx';
import {
  addTorrent,
  ApiError,
  connectLiveEvents,
  createRPCLogin,
  createToken,
  createTorrentProfile,
  createVPNConnection,
  createWebProxyLogin,
  deleteRPCLogin,
  deleteTorrentProfile,
  deleteVPNConnection,
  deleteWebProxyLogin,
  disconnectVPNConnection,
  dismissRemovedSecrets,
  getCurrentAdministrator,
  getProfiles,
  getProviders,
  getRPCLogins,
  getSettings,
  getSetupStatus,
  getTokens,
  getTorrentDetail,
  getTorrentOrganization,
  getTorrentProfiles,
  getTorrents,
  getVPNConnections,
  getWebProxy,
  logout,
  reconnectVPNConnection,
  refreshVPNCatalog,
  removeTorrents,
  renameTorrentPath,
  restartTransmission,
  revokeToken,
  runTorrentAction,
  setDefaultVPNConnection,
  setTorrentProfile,
  updateDefaultTorrentProfile,
  updateRPCLogin,
  updateSettings,
  updateToken,
  updateTorrentOrganization,
  updateTorrentProfile,
  updateTorrents,
  updateVPNConnection,
  updateWebProxy,
  updateWebProxyLogin,
  uploadCustomProfile,
} from '@/web/api.ts';
import {
  appRouteForView,
  appRouteForVPNTarget,
  resolveAppNavigationPath,
} from '@/web/app-navigation.ts';
import { AppShell } from '@/web/app-shell.tsx';
import { AuthenticationScreen } from '@/web/auth-screen.tsx';
import { ConfirmDialog } from '@/web/confirm-dialog.tsx';
import { KeyNotice } from '@/web/key-notice.tsx';
import { LibraryNavigation } from '@/web/library-navigation.tsx';
import {
  applyNavigationPath,
  pushNavigationPath,
  replaceNavigationPath,
  startNavigationHistory,
} from '@/web/navigation.ts';
import { NotificationsView } from '@/web/notifications-view.tsx';
import { Button } from '@/web/primitives.tsx';
import { describeProtection } from '@/web/protection-state.ts';
import { SecurityView } from '@/web/security-view.tsx';
import { SettingsView } from '@/web/settings-view.tsx';
import { TorrentDetail } from '@/web/torrent-detail.tsx';
import { torrentMoveResultLabel } from '@/web/torrent-move-result.ts';
import { TorrentOrganizationDialog } from '@/web/torrent-organization-dialog.tsx';
import { mergeTorrentOrganizationUpdate } from '@/web/torrent-organization.ts';
import { TorrentProfileDialog } from '@/web/torrent-profile-dialog.tsx';
import { TorrentWorkspace } from '@/web/torrent-workspace.tsx';
import { VpnView } from '@/web/vpn-view.tsx';

import type { ReactElement } from 'react';

import type {
  Web_Api_AddTorrentInput,
  Web_Api_Administrator,
  Web_Api_CreatedToken,
  Web_Api_CreateTokenInput,
  Web_Api_DefaultTorrentProfile,
  Web_Api_DefaultTorrentProfileInput,
  Web_Api_DeleteTorrentProfileResponse,
  Web_Api_JsonValue,
  Web_Api_LiveSnapshot,
  Web_Api_MovedTorrent,
  Web_Api_Provider,
  Web_Api_RemovedSecret,
  Web_Api_RPCCredential,
  Web_Api_RPCLogin,
  Web_Api_SettingsSnapshot,
  Web_Api_SetTorrentProfileInput,
  Web_Api_SetTorrentProfileResponse,
  Web_Api_Token,
  Web_Api_Torrent,
  Web_Api_TorrentAddResult,
  Web_Api_TorrentChanges,
  Web_Api_TorrentDetail,
  Web_Api_TorrentListResponse,
  Web_Api_TorrentOrganization,
  Web_Api_TorrentProfile,
  Web_Api_TorrentProfileFolderOverlap,
  Web_Api_TorrentProfileInput,
  Web_Api_TorrentProfilesResponse,
  Web_Api_UpdateDefaultTorrentProfileResponse,
  Web_Api_UpdateRPCLoginInput,
  Web_Api_UpdateTokenInput,
  Web_Api_UpdateTorrentOrganizationInput,
  Web_Api_UpdateTorrentProfileResponse,
  Web_Api_UpdateWebProxyLoginInput,
  Web_Api_VpnConnection,
  Web_Api_VpnConnectionsResponse,
  Web_Api_VpnProfile,
  Web_Api_VpnTunnel,
  Web_Api_WebProxy,
  Web_Api_WebProxyCredential,
  Web_Api_WebProxyLoginInput,
} from '@/types/web/api.d.ts';
import type {
  Web_AppNavigation_PathMatch,
  Web_AppNavigation_Route,
} from '@/types/web/app-navigation.d.ts';
import type {
  Web_App_Phase,
  Web_App_RemovedSecretAction,
} from '@/types/web/app.d.ts';
import type {
  Web_Components_Protection,
  Web_Components_TorrentFilters,
  Web_Components_TorrentProfileDialog_Mode,
  Web_Components_View,
  Web_Components_VpnView_NavigationTarget,
} from '@/types/web/components.d.ts';

// What each secret removed with a lost key asks for, and the page where it is entered again.

/**
 * App - Describe removed secret.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const describeRemovedSecret = (removedSecret: Web_Api_RemovedSecret): Web_App_RemovedSecretAction => {
  if (removedSecret['kind'] === 'notification') {
    return {
      label: `Set up the ${removedSecret['name'] ?? 'removed'} notification again`,
      view: 'notifications',
    };
  }

  if (removedSecret['kind'] === 'vpn') {
    return {
      label: 'Enter the VPN connection details again',
      view: 'vpn',
    };
  }

  return {
    label: 'Set up the authenticator app',
    view: 'security',
  };
};

/**
 * App - Initial Default torrent profile.
 *
 * Supplies a complete loading and signed-out fallback until configuration is read.
 * The first profile response replaces it before the editor can be opened.
 *
 * @since UNRELEASED
 */
const initialDefaultTorrentProfile: Web_Api_DefaultTorrentProfile = {
  downloadDirectory: '/data/downloads',
  downloadDirectoryLocked: false,
  labels: [],
  name: 'Default profile',
  options: {
    bandwidthPriority: 0,
    downloadLimitKBps: null,
    peerLimit: 50,
    queue: 'normal',
    seeding: {
      idleMinutes: null,
      mode: 'never',
      ratio: null,
    },
    uploadLimitKBps: null,
  },
  startPaused: false,
};

/**
 * App.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const App = (): ReactElement => {
  const initialNavigation: Web_AppNavigation_PathMatch = resolveAppNavigationPath(window.location.pathname);
  const [
    phase,
    setPhase,
  ] = useState<Web_App_Phase>('loading');
  const [
    administrator,
    setAdministrator,
  ] = useState<Web_Api_Administrator | null>(null);
  const [
    activeRoute,
    setActiveRoute,
  ] = useState<Web_AppNavigation_Route>(initialNavigation['route']);
  const activeView: Web_Components_View = activeRoute['view'];
  const [
    snapshot,
    setSnapshot,
  ] = useState<Web_Api_LiveSnapshot | null>(null);
  const [
    settings,
    setSettings,
  ] = useState<Web_Api_SettingsSnapshot | null>(null);
  const [
    organization,
    setOrganization,
  ] = useState<Web_Api_TorrentOrganization | null>(null);
  const [
    providers,
    setProviders,
  ] = useState<Web_Api_Provider[]>([]);
  const [
    profiles,
    setProfiles,
  ] = useState<Web_Api_VpnProfile[]>([]);
  const [
    torrentProfiles,
    setTorrentProfiles,
  ] = useState<Web_Api_TorrentProfile[]>([]);
  const [
    profileFolderOverlaps,
    setProfileFolderOverlaps,
  ] = useState<Web_Api_TorrentProfileFolderOverlap[]>([]);
  const [
    defaultTorrentProfile,
    setDefaultTorrentProfile,
  ] = useState<Web_Api_DefaultTorrentProfile>(initialDefaultTorrentProfile);
  const [
    tokens,
    setTokens,
  ] = useState<Web_Api_Token[]>([]);
  const [
    rpcLogins,
    setRPCLogins,
  ] = useState<Web_Api_RPCLogin[]>([]);
  const [
    webProxy,
    setWebProxy,
  ] = useState<Web_Api_WebProxy | null>(null);
  const [
    vpnConnections,
    setVPNConnections,
  ] = useState<Web_Api_VpnConnectionsResponse | null>(null);
  const [
    vpnNavigationSequence,
    setVPNNavigationSequence,
  ] = useState<number>(0);
  const [
    vpnNavigationTarget,
    setVPNNavigationTarget,
  ] = useState<Web_Components_VpnView_NavigationTarget>({ kind: 'list' });
  const [
    addDialogOpen,
    setAddDialogOpen,
  ] = useState<boolean>(false);
  const [
    addVPNConnectionDialogOpen,
    setAddVPNConnectionDialogOpen,
  ] = useState<boolean>(false);
  const [
    selectedTorrentID,
    setSelectedTorrentID,
  ] = useState<number | null>(null);
  const [
    torrentDetail,
    setTorrentDetail,
  ] = useState<Web_Api_TorrentDetail | null>(null);
  const [
    torrentDetailLoading,
    setTorrentDetailLoading,
  ] = useState<boolean>(false);
  const [
    startupError,
    setStartupError,
  ] = useState<string>('');
  const [
    torrentFilters,
    setTorrentFilters,
  ] = useState<Web_Components_TorrentFilters>({
    connection: '',
    label: '',
    profile: '',
    status: 'all',
  });
  const [
    filtersSheetOpen,
    setFiltersSheetOpen,
  ] = useState<boolean>(false);
  const [
    organizationDialogOpen,
    setOrganizationDialogOpen,
  ] = useState<boolean>(false);
  const [
    profileDialogMode,
    setProfileDialogMode,
  ] = useState<Web_Components_TorrentProfileDialog_Mode | null>(null);
  const [
    editingTorrentProfile,
    setEditingTorrentProfile,
  ] = useState<Web_Api_TorrentProfile | null>(null);
  const [
    deletingTorrentProfile,
    setDeletingTorrentProfile,
  ] = useState<Web_Api_TorrentProfile | null>(null);
  const [
    deletingTorrentProfileBusy,
    setDeletingTorrentProfileBusy,
  ] = useState<boolean>(false);
  const [
    deletingTorrentProfileError,
    setDeletingTorrentProfileError,
  ] = useState<string>('');
  const [
    deletingTorrentProfileMoveCount,
    setDeletingTorrentProfileMoveCount,
  ] = useState<number>(0);
  const [
    deletingTorrentProfileMoveResults,
    setDeletingTorrentProfileMoveResults,
  ] = useState<Web_Api_MovedTorrent[] | null>(null);
  const [
    removedSecrets,
    setRemovedSecrets,
  ] = useState<Web_Api_RemovedSecret[]>([]);
  const [
    settingsDirty,
    setSettingsDirty,
  ] = useState<boolean>(false);

  /**
   * App - Applies route.
   *
   * Keeps the rendered page and VPN editor target synchronized with a resolved
   * address. Browser Back and Forward reuse this transition without pushing.
   *
   * @param {Web_AppNavigation_Route} route - Route.
   *
   * @since UNRELEASED
   */
  const applyAppRoute = (route: Web_AppNavigation_Route): void => {
    setSettingsDirty(false);
    setActiveRoute(route);
    if (route['view'] === 'vpn') {
      setVPNNavigationTarget(route['vpnTarget'] ?? { kind: 'list' });
      setVPNNavigationSequence((currentSequence: number): number => currentSequence + 1);
    }
    window.scrollTo(0, 0);

    return;
  };

  /**
   * App - Opens route.
   *
   * Preserves the existing unsaved-settings guard, updates browser history,
   * and then applies the matching page state. Replacements are reserved for
   * invalid dynamic destinations.
   *
   * @param {Web_AppNavigation_Route} route     - Route.
   * @param {boolean}                 [replace] - Replace.
   *
   * @since UNRELEASED
   */
  const openRoute = (
    route: Web_AppNavigation_Route,
    replace: boolean = false,
  ): void => {
    if (route['view'] === activeView && route['view'] !== 'vpn') {
      return;
    }

    if (settingsDirty && !window.confirm('Discard your unsaved changes?')) {
      return;
    }

    setSettingsDirty(false);
    if (replace) {
      replaceNavigationPath(window, route['path']);
    } else {
      pushNavigationPath(window, route['path']);
    }
    applyAppRoute(route);

    return;
  };

  /**
   * App - Opens view.
   *
   * Resolves shell destinations through the app-owned path table before the
   * shared History API transition runs.
   *
   * @param {Web_Components_View} view - View.
   *
   * @since UNRELEASED
   */
  const openView = (view: Web_Components_View): void => {
    openRoute(appRouteForView(view));

    return;
  };

  /**
   * App - Opens VPN route.
   *
   * Gives the list, new editor, and existing connection editor distinct paths.
   * The same transition supports pushed and replacement destinations.
   *
   * @param {Web_Components_VpnView_NavigationTarget} target    - Target.
   * @param {boolean}                                 [replace] - Replace.
   *
   * @since UNRELEASED
   */
  const openVPN = (
    target: Web_Components_VpnView_NavigationTarget,
    replace: boolean = false,
  ): void => {
    openRoute(appRouteForVPNTarget(target), replace);

    return;
  };

  useEffect((): (() => void) => startNavigationHistory(
    window,
    resolveAppNavigationPath,
    applyAppRoute,
  ), []);

  const incompleteDirectorySetting = settings?.['settings'].find((setting): boolean => (
    setting['key'] === 'transmission.incompleteDirectory'
  ));
  const incompleteDirectory: string | undefined = (
    typeof incompleteDirectorySetting?.['value'] === 'string'
  ) ? incompleteDirectorySetting['value'] : undefined;
  const torrentLabels: string[] = useMemo((): string[] => {
    const labelsByKey: Map<string, string> = new Map<string, string>();
    for (const label of organization?.['labels'] ?? []) {
      labelsByKey.set(label.toLowerCase(), label);
    }
    for (const torrent of snapshot?.['torrents'] ?? []) {
      for (const label of torrent['labels']) {
        if (!labelsByKey.has(label.toLowerCase())) {
          labelsByKey.set(label.toLowerCase(), label);
        }
      }
    }

    return [...labelsByKey.values()].sort((leftLabel: string, rightLabel: string): number => (
      leftLabel.localeCompare(rightLabel, undefined, { sensitivity: 'base' })
    ));
  }, [
    organization,
    snapshot?.torrents,
  ]);

  /**
   * App - Loads configuration.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const loadConfiguration = async (): Promise<void> => {
    const configurationResults = await Promise.all([
      getSettings(),
      getProviders(),
      getTokens(),
      getTorrentOrganization(),
      getRPCLogins(),
      getWebProxy(),
      getVPNConnections(),
      getTorrentProfiles(),
    ]);
    const nextSettings: Web_Api_SettingsSnapshot = configurationResults[0];
    const nextProviders: Web_Api_Provider[] = configurationResults[1];
    const nextTokens: Web_Api_Token[] = configurationResults[2];
    const nextOrganization: Web_Api_TorrentOrganization = configurationResults[3];
    const nextRPCLogins: Web_Api_RPCLogin[] = configurationResults[4];
    const nextWebProxy: Web_Api_WebProxy = configurationResults[5];
    const nextVPNConnections: Web_Api_VpnConnectionsResponse = configurationResults[6];
    const nextTorrentProfiles: Web_Api_TorrentProfilesResponse = configurationResults[7];
    const profileGroups: Web_Api_VpnProfile[][] = await Promise.all(
      nextProviders.map(async (provider: Web_Api_Provider): Promise<Web_Api_VpnProfile[]> => (
        getProfiles(provider['id'])
      )),
    );

    setSettings(nextSettings);
    setProviders(nextProviders);
    setProfiles(profileGroups.flat());
    setTokens(nextTokens);
    setOrganization(nextOrganization);
    setRPCLogins(nextRPCLogins);
    setWebProxy(nextWebProxy);
    setVPNConnections(nextVPNConnections);
    setDefaultTorrentProfile(nextTorrentProfiles['defaultProfile']);
    setTorrentProfiles(nextTorrentProfiles['profiles']);
    setProfileFolderOverlaps(nextTorrentProfiles['folderOverlaps'] ?? []);
  };

  /**
   * App - Enter application.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const enterApplication = async (): Promise<void> => {
    const currentAdministrator: Web_Api_Administrator | null = await getCurrentAdministrator();
    if (currentAdministrator === null) {
      setPhase('login');

      return;
    }

    setAdministrator(currentAdministrator);
    setRemovedSecrets(currentAdministrator['removedSecrets'] ?? []);
    applyNavigationPath(window, resolveAppNavigationPath, applyAppRoute);
    setPhase('application');
    await loadConfiguration();
  };

  // The notice shrinks as secrets are entered again, so the list is read again after each one.

  /**
   * App - Loads removed secrets.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const loadRemovedSecrets = async (): Promise<void> => {
    const currentAdministrator: Web_Api_Administrator | null = await getCurrentAdministrator();

    setRemovedSecrets(currentAdministrator?.['removedSecrets'] ?? []);
  };

  useEffect((): void => {
    /**
     * App - Bootstrap.
     *
     * Centralizes this operation for the surrounding workflow.
     * Callers reuse one implementation instead of repeating the behavior.
     *
     * @since 2.0.0
     */
    const bootstrap = async (): Promise<void> => {
      setStartupError('');
      try {
        const setupStatus = await getSetupStatus();
        if (setupStatus['claimRequired']) {
          setPhase('claim');

          return;
        }

        await enterApplication();
      } catch (caughtError) {
        setStartupError((caughtError instanceof Error) ? caughtError.message : 'The appliance could not be loaded.');
      }
    };

    void bootstrap();
  }, []);

  useEffect((): (() => void) | undefined => {
    if (phase !== 'application') {
      return undefined;
    }

    return connectLiveEvents(
      (nextSnapshot: Web_Api_LiveSnapshot): void => setSnapshot(nextSnapshot),
    );
  }, [phase]);

  useEffect((): (() => void) | undefined => {
    if (
      phase !== 'application'
      || organization === null
      || snapshot === null
      || organization['revision'] === snapshot['organizationRevision']
    ) {
      return undefined;
    }

    let effectActive: boolean = true;

    /**
     * App - Refresh torrent organization after a live revision.
     *
     * Profile, compatible RPC, and other-console writes surface through the live
     * snapshot, then this request replaces every saved-label picker without reload.
     *
     * @since UNRELEASED
     */
    const refreshOrganization = async (): Promise<void> => {
      try {
        const nextOrganization: Web_Api_TorrentOrganization = await getTorrentOrganization();
        if (effectActive) {
          setOrganization(nextOrganization);
        }
      } catch {
        // Focus refresh and a later live revision retain recovery paths.
      }
    };

    void refreshOrganization();

    return (): void => {
      effectActive = false;
    };
  }, [
    organization?.revision,
    phase,
    snapshot?.organizationRevision,
  ]);

  useEffect((): (() => void) | undefined => {
    if (phase !== 'application') {
      return undefined;
    }

    let effectActive: boolean = true;

    /**
     * App - Refresh torrent organization on focus.
     *
     * Makes changes from another browser tab visible in the sidebar without
     * replacing an open dialog's local draft.
     *
     * @since UNRELEASED
     */
    const refreshOrganization = async (): Promise<void> => {
      try {
        const nextOrganization: Web_Api_TorrentOrganization = await getTorrentOrganization();
        if (effectActive) {
          setOrganization(nextOrganization);
        }
      } catch {
        // The live page stays usable and the next focus gets another chance.
      }
    };

    /**
     * App - Organization focus.
     *
     * Starts the asynchronous refresh without blocking the browser focus event.
     * The listener itself therefore remains synchronous.
     */
    const onFocus = (): void => {
      void refreshOrganization();
    };

    window.addEventListener('focus', onFocus);

    return (): void => {
      effectActive = false;
      window.removeEventListener('focus', onFocus);
    };
  }, [phase]);

  useEffect((): (() => void) | undefined => {
    if (phase !== 'application' || activeView !== 'access') {
      return undefined;
    }

    let effectActive: boolean = true;
    let refreshIntervalID: number | undefined = undefined;
    let refreshRunning: boolean = false;

    /**
     * App - Refreshes Remote apps data.
     *
     * Reads observed proxy state and token last-use times without replacing any
     * local dialog state. Slow requests never overlap or update after this view closes.
     *
     * @since UNRELEASED
     */
    const refreshAccessData = async (): Promise<void> => {
      if (refreshRunning || document.visibilityState !== 'visible') {
        return;
      }

      refreshRunning = true;
      try {
        const [
          webProxyResult,
          tokensResult,
        ] = await Promise.allSettled([
          getWebProxy(),
          getTokens(),
        ]);
        if (effectActive && document.visibilityState === 'visible') {
          if (webProxyResult.status === 'fulfilled') {
            setWebProxy(webProxyResult.value);
          }
          if (tokensResult.status === 'fulfilled') {
            setTokens(tokensResult.value);
          }
        }
      } finally {
        refreshRunning = false;
      }
    };

    /**
     * App - Stops Remote apps refresh.
     *
     * Clears the active timer while the page is hidden or another view is open.
     * The next visible start performs an immediate read before scheduling more.
     *
     * @since UNRELEASED
     */
    const stopWebProxyRefresh = (): void => {
      if (refreshIntervalID === undefined) {
        return;
      }

      window.clearInterval(refreshIntervalID);
      refreshIntervalID = undefined;
    };

    /**
     * App - Starts Remote apps refresh.
     *
     * Refreshes immediately and then every three seconds while the page is visible.
     * Repeated visibility events cannot create duplicate timers.
     *
     * @since UNRELEASED
     */
    const startWebProxyRefresh = (): void => {
      if (document.visibilityState !== 'visible' || refreshIntervalID !== undefined) {
        return;
      }

      void refreshAccessData();
      refreshIntervalID = window.setInterval((): void => {
        void refreshAccessData();
      }, 3000);
    };

    /**
     * App - Handles Remote apps visibility change.
     *
     * Pauses network reads in hidden tabs and resumes them when visible again.
     * Keeping the component mounted preserves open dialogs and one-time passwords.
     *
     * @since UNRELEASED
     */
    const handleWebProxyVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        startWebProxyRefresh();

        return;
      }

      stopWebProxyRefresh();
    };

    document.addEventListener('visibilitychange', handleWebProxyVisibilityChange);
    startWebProxyRefresh();

    return (): void => {
      effectActive = false;
      stopWebProxyRefresh();
      document.removeEventListener('visibilitychange', handleWebProxyVisibilityChange);
    };
  }, [
    activeView,
    phase,
  ]);

  /**
   * App - Sign out.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const signOut = async (): Promise<void> => {
    if (settingsDirty && !window.confirm('Discard your unsaved changes?')) {
      return;
    }

    await logout();
    setSettingsDirty(false);
    setAdministrator(null);
    setRemovedSecrets([]);
    setSnapshot(null);
    setSettings(null);
    setOrganization(null);
    setDefaultTorrentProfile(initialDefaultTorrentProfile);
    setTorrentProfiles([]);
    setRPCLogins([]);
    setWebProxy(null);
    setVPNConnections(null);
    const rootNavigation: Web_AppNavigation_PathMatch = resolveAppNavigationPath('/');

    replaceNavigationPath(window, rootNavigation['path']);
    applyAppRoute(rootNavigation['route']);
    setPhase('login');
  };

  /**
   * App - Select torrent.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const selectTorrent = async (torrent: Web_Api_Torrent): Promise<void> => {
    setSelectedTorrentID(torrent['id']);
    setTorrentDetail(null);
    setTorrentDetailLoading(true);
    try {
      const detail: Web_Api_TorrentDetail = await getTorrentDetail(torrent['id']);
      setTorrentDetail(detail);
    } finally {
      setTorrentDetailLoading(false);
    }
  };

  /**
   * App - Refresh torrent detail.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const refreshTorrentDetail = async (torrentId: number): Promise<void> => {
    setSelectedTorrentID(torrentId);
    const detail: Web_Api_TorrentDetail = await getTorrentDetail(torrentId);
    setTorrentDetail(detail);
  };

  useEffect((): (() => void) | undefined => {
    if (selectedTorrentID === null || snapshot === null) {
      return undefined;
    }

    let cancelled: boolean = false;

    /**
     * App - Refresh detail.
     *
     * Centralizes this operation for the surrounding workflow.
     * Callers reuse one implementation instead of repeating the behavior.
     *
     * @since 2.0.0
     */
    const refreshDetail = async (): Promise<void> => {
      try {
        const detail: Web_Api_TorrentDetail = await getTorrentDetail(selectedTorrentID);
        if (!cancelled) {
          setTorrentDetail(detail);
        }
      } catch {
        if (!cancelled) {
          setSelectedTorrentID(null);
          setTorrentDetail(null);
        }
      }
    };
    void refreshDetail();

    return (): void => {
      cancelled = true;
    };
  }, [
    selectedTorrentID,
    snapshot?.sequence,
  ]);

  /**
   * App - Save settings.
   *
   * Stores this module-level value in one named location.
   * Related code reuses it instead of duplicating the definition.
   *
   * @since 2.0.0
   */
  const saveSettings = async (
    changes: Record<string, Web_Api_JsonValue>,
  ): Promise<void> => {
    if (settings === null) {
      throw new Error('Settings are still loading.');
    }

    const nextSettings: Web_Api_SettingsSnapshot = await updateSettings({
      expectedRevision: settings['revision'],
      changes,
    }, incompleteDirectory);
    setSettings(nextSettings);
  };

  /**
   * App - Refresh VPN data.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const refreshVPNData = async (): Promise<void> => {
    const nextProviders: Web_Api_Provider[] = await getProviders();
    const profileGroups: Web_Api_VpnProfile[][] = await Promise.all(
      nextProviders.map(async (provider: Web_Api_Provider): Promise<Web_Api_VpnProfile[]> => (
        getProfiles(provider['id'])
      )),
    );
    setProviders(nextProviders);
    setProfiles(profileGroups.flat());
  };

  /**
   * App - Refresh torrent organization.
   *
   * Label-using mutations remain successful if this follow-up request is briefly
   * unavailable; the live revision and focus refresh will retry automatically.
   *
   * @since UNRELEASED
   */
  const refreshTorrentOrganization = async (): Promise<void> => {
    try {
      setOrganization(await getTorrentOrganization());
    } catch {
      // The live revision and focus refresh retain recovery paths.
    }
    try {
      // A saved profile folder can end an overlap, so the fix-it banner is refreshed too.
      setProfileFolderOverlaps((await getTorrentProfiles())['folderOverlaps'] ?? []);
    } catch {
      // The next full refresh retries.
    }
  };

  /**
   * App - Save torrent organization.
   *
   * Stores this module-level value in one named location.
   * Related code reuses it instead of duplicating the definition.
   *
   * @since 2.0.0
   */
  const saveTorrentOrganization = async (
    input: Web_Api_UpdateTorrentOrganizationInput,
  ): Promise<void> => {
    const openedOrganization: Web_Api_TorrentOrganization = {
      labels: torrentLabels,
      revision: input['expectedRevision'],
    };

    /**
     * App - Accepts organization update.
     *
     * Refreshes the torrent list immediately so server-applied label removals
     * and renames appear without waiting for the next live snapshot.
     *
     * @since UNRELEASED
     */
    const acceptUpdate = async (nextOrganization: Web_Api_TorrentOrganization): Promise<void> => {
      setOrganization(nextOrganization);
      const torrentList: Web_Api_TorrentListResponse = await getTorrents();
      setSnapshot((currentSnapshot: Web_Api_LiveSnapshot | null): Web_Api_LiveSnapshot | null => (
        (currentSnapshot === null) ? currentSnapshot : {
          ...currentSnapshot,
          errors: torrentList['errors'],
          torrents: torrentList['items'],
        }
      ));
      if (selectedTorrentID !== null) {
        await refreshTorrentDetail(selectedTorrentID);
      }
    };

    try {
      const nextOrganization: Web_Api_TorrentOrganization = await updateTorrentOrganization(
        input,
      );
      await acceptUpdate(nextOrganization);

      return;
    } catch (caughtError) {
      if (!(caughtError instanceof ApiError) || caughtError['code'] !== 'revision_conflict') {
        throw caughtError;
      }
    }

    const latestOrganization: Web_Api_TorrentOrganization = await getTorrentOrganization();
    setOrganization(latestOrganization);
    const mergedInput: Web_Api_UpdateTorrentOrganizationInput = mergeTorrentOrganizationUpdate(
      openedOrganization,
      input,
      latestOrganization,
    );

    const nextOrganization: Web_Api_TorrentOrganization = await updateTorrentOrganization(
      mergedInput,
    );
    await acceptUpdate(nextOrganization);
  };

  /**
   * App - Opens new torrent profile.
   *
   * Clears any prior edit before showing the shared profile editor.
   * Default profile values are supplied by the dialog itself.
   *
   * @since UNRELEASED
   */
  const openNewTorrentProfile = (): void => {
    setEditingTorrentProfile(null);
    setProfileDialogMode('create');
  };

  /**
   * App - Opens Default torrent profile editor.
   *
   * Selects the dedicated field set while leaving named profile edit state empty.
   * The dialog then saves through the Default profile endpoint.
   *
   * @since UNRELEASED
   */
  const openDefaultTorrentProfile = (): void => {
    setEditingTorrentProfile(null);
    setProfileDialogMode('default');
  };

  /**
   * App - Opens torrent profile editor.
   *
   * Supplies one existing profile to the shared editor.
   * Saving replaces only the editable profile values.
   *
   * @since UNRELEASED
   */
  const openTorrentProfile = (profile: Web_Api_TorrentProfile): void => {
    setEditingTorrentProfile(profile);
    setProfileDialogMode('edit');
  };

  /**
   * App - Saves torrent profile.
   *
   * Reconciles create and edit responses into the alphabetical local profile list.
   * The server response remains authoritative for identity and overlaps.
   *
   * @since UNRELEASED
   */
  const saveTorrentProfile = async (
    input: Web_Api_DefaultTorrentProfileInput | Web_Api_TorrentProfileInput,
    moveTorrents: boolean = false,
  ): Promise<Web_Api_MovedTorrent[]> => {
    if (profileDialogMode === 'default') {
      const updatedDefaultProfile: Web_Api_UpdateDefaultTorrentProfileResponse = await updateDefaultTorrentProfile(
        input as Web_Api_DefaultTorrentProfileInput,
        moveTorrents,
        incompleteDirectory,
      );
      setDefaultTorrentProfile(updatedDefaultProfile);
      setSettings(await getSettings());
      await refreshTorrentOrganization();

      return updatedDefaultProfile['moved'];
    }

    const namedInput: Web_Api_TorrentProfileInput = input as Web_Api_TorrentProfileInput;
    if (profileDialogMode === 'create') {
      const createdProfile: Web_Api_TorrentProfile = await createTorrentProfile(
        namedInput,
        incompleteDirectory,
      );
      setTorrentProfiles((currentProfiles: Web_Api_TorrentProfile[]): Web_Api_TorrentProfile[] => [
        ...currentProfiles,
        createdProfile,
      ].sort((leftProfile: Web_Api_TorrentProfile, rightProfile: Web_Api_TorrentProfile): number => (
        leftProfile['name'].localeCompare(rightProfile['name'], undefined, { sensitivity: 'base' })
        || leftProfile['name'].localeCompare(rightProfile['name'])
      )));
      await refreshTorrentOrganization();

      return [];
    }

    if (editingTorrentProfile === null) {
      throw new Error('Choose a torrent profile to edit.');
    }

    const updatedProfile: Web_Api_UpdateTorrentProfileResponse = await updateTorrentProfile(
      editingTorrentProfile['id'],
      namedInput,
      moveTorrents,
      incompleteDirectory,
    );
    setTorrentProfiles((currentProfiles: Web_Api_TorrentProfile[]): Web_Api_TorrentProfile[] => currentProfiles.map(
      (profile: Web_Api_TorrentProfile): Web_Api_TorrentProfile => (
        (profile['id'] === updatedProfile['id']) ? updatedProfile : profile
      ),
    ).sort((leftProfile: Web_Api_TorrentProfile, rightProfile: Web_Api_TorrentProfile): number => (
      leftProfile['name'].localeCompare(rightProfile['name'], undefined, { sensitivity: 'base' })
      || leftProfile['name'].localeCompare(rightProfile['name'])
    )));
    await refreshTorrentOrganization();

    return updatedProfile['moved'];
  };

  /**
   * App - Adds a torrent and refreshes saved labels.
   *
   * Typed labels and labels inherited from the chosen profile become picker choices
   * as soon as the successful add returns.
   *
   * @since UNRELEASED
   */
  const addTorrentAndRefreshLabels = async (
    input: Web_Api_AddTorrentInput,
  ): Promise<Web_Api_TorrentAddResult> => {
    const result: Web_Api_TorrentAddResult = await addTorrent(input);
    await refreshTorrentOrganization();

    return result;
  };

  /**
   * App - Updates torrent labels and refreshes saved labels.
   *
   * The follow-up runs only when labels were part of the successful mutation.
   * Other detail changes keep the same request behavior without another fetch.
   *
   * @since UNRELEASED
   */
  const updateTorrentsAndRefreshLabels = async (
    hashes: string[],
    changes: Web_Api_TorrentChanges,
  ): Promise<void> => {
    await updateTorrents(hashes, changes);
    if (changes['labels'] !== undefined) {
      await refreshTorrentOrganization();
    }
  };

  /**
   * App - Sets torrent profiles and refreshes saved labels.
   *
   * Applying a profile, including resolving Needs a profile, can write its labels to
   * torrents and therefore advances the saved-label organization.
   *
   * @since UNRELEASED
   */
  const setTorrentProfileAndRefreshLabels = async (
    input: Web_Api_SetTorrentProfileInput,
  ): Promise<Web_Api_SetTorrentProfileResponse> => {
    const result: Web_Api_SetTorrentProfileResponse = await setTorrentProfile(input);
    if (result['applyOptions']) {
      await refreshTorrentOrganization();
    }

    return result;
  };

  /**
   * App - Confirms torrent profile deletion.
   *
   * Removes the profile, moves its torrents to Default, and keeps results open.
   * A failed move stays on its source while the deleted assignment still clears.
   *
   * @since UNRELEASED
   */
  const confirmTorrentProfileDeletion = async (): Promise<void> => {
    if (deletingTorrentProfile === null) {
      return;
    }

    setDeletingTorrentProfileBusy(true);
    setDeletingTorrentProfileError('');
    try {
      const deleteResponse: Web_Api_DeleteTorrentProfileResponse = await deleteTorrentProfile(
        deletingTorrentProfile['id'],
        deletingTorrentProfileMoveCount > 0,
      );
      setTorrentProfiles((currentProfiles: Web_Api_TorrentProfile[]): Web_Api_TorrentProfile[] => currentProfiles.filter(
        (profile: Web_Api_TorrentProfile): boolean => profile['id'] !== deletingTorrentProfile['id'],
      ));
      setTorrentFilters((currentFilters: Web_Components_TorrentFilters): Web_Components_TorrentFilters => ({
        ...currentFilters,
        profile: (currentFilters['profile'] === deletingTorrentProfile['id']) ? '' : currentFilters['profile'],
      }));
      if (deleteResponse['moved'].length > 0) {
        setDeletingTorrentProfileMoveCount(deleteResponse['moved'].length);
        setDeletingTorrentProfileMoveResults(deleteResponse['moved']);

        return;
      }
      setDeletingTorrentProfile(null);
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError['code'] === 'torrents_must_move') {
        const torrentCount: unknown = caughtError['details']['torrents'];
        if (typeof torrentCount === 'number' && Number.isInteger(torrentCount) && torrentCount > 0) {
          setDeletingTorrentProfileMoveCount(torrentCount);
        }
      }
      setDeletingTorrentProfileError((caughtError instanceof Error) ? caughtError.message : 'The profile could not be deleted.');
    } finally {
      setDeletingTorrentProfileBusy(false);
    }
  };

  const rpcEnabled: boolean = useMemo((): boolean => {
    const rpcSetting = settings?.settings.find((setting): boolean => (
      setting['key'] === 'rpc.compatibilityEnabled'
    ));

    return rpcSetting?.value === true;
  }, [settings]);

  if (phase === 'loading') {
    return (
      <main className="startup-screen">
        <span className="startup-mark">T</span>
        <span className="spinner" />
        <strong>Opening Transmission VPN</strong>
        {(startupError === '') ? null : <p role="alert">{startupError}</p>}
      </main>
    );
  }

  if (phase === 'claim' || phase === 'login') {
    return <AuthenticationScreen mode={phase} onSignedIn={enterApplication} />;
  }

  if (administrator === null) {
    return (
      <main className="startup-screen">
        <span className="spinner" />
        Preparing your session…
      </main>
    );
  }

  /**
   * App - Renders view.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const renderView = (): ReactElement => {
    switch (activeView) {
      case 'vpn': {
        return (
          <VpnView
            connections={vpnConnections}
            defaultProfile={defaultTorrentProfile}
            navigationSequence={vpnNavigationSequence}
            navigationTarget={vpnNavigationTarget}
            onCreate={async (input): Promise<void> => {
              await createVPNConnection(input);
              setVPNConnections(await getVPNConnections());
              await loadRemovedSecrets();
            }}
            onDelete={async (connectionId, input) => {
              const response = await deleteVPNConnection(connectionId, input);
              setVPNConnections(await getVPNConnections());

              return response;
            }}
            onDisconnect={async (connectionId: string): Promise<void> => {
              await disconnectVPNConnection(connectionId);
              setVPNConnections(await getVPNConnections());
            }}
            onMakeDefault={async (
              connectionId: string,
              moveTorrents: boolean = false,
            ): Promise<Web_Api_MovedTorrent[]> => {
              const response = await setDefaultVPNConnection({
                connectionId,
                ...((moveTorrents) ? { moveTorrents: true as const } : {}),
              });
              setVPNConnections(await getVPNConnections());

              return response['moved'];
            }}
            onNavigate={(target: Web_Components_VpnView_NavigationTarget, replace: boolean = false): void => {
              openVPN(target, replace);
            }}
            onOpenTorrents={(connectionId: string): void => {
              setTorrentFilters({
                connection: connectionId,
                label: '',
                profile: '',
                status: 'all',
              });
              openView('torrents');
            }}
            onReconnect={async (connectionId: string): Promise<void> => {
              await reconnectVPNConnection(connectionId);
              setVPNConnections(await getVPNConnections());
            }}
            onRefreshCatalog={async (providerId: string, tunnel: Web_Api_VpnTunnel): Promise<void> => {
              await refreshVPNCatalog(providerId, tunnel);
              await refreshVPNData();
            }}
            onUploadProfile={async (tunnel: Web_Api_VpnTunnel, name: string, profile: string): Promise<Web_Api_VpnProfile[]> => {
              const uploadedProfiles: Web_Api_VpnProfile[] = await uploadCustomProfile(tunnel, name, profile);
              await refreshVPNData();

              return uploadedProfiles;
            }}
            onUpdate={async (connectionId, input): Promise<void> => {
              await updateVPNConnection(connectionId, input);
              setVPNConnections(await getVPNConnections());
              await loadRemovedSecrets();
            }}
            profiles={profiles}
            providers={providers}
            snapshot={snapshot}
          />
        );
      }
      case 'settings': {
        return (
          <SettingsView
            onDirtyChange={setSettingsDirty}
            onRestartTransmission={async (): Promise<void> => {
              await restartTransmission();
              setSettings(await getSettings());
            }}
            onSave={saveSettings}
            snapshot={settings}
          />
        );
      }
      case 'security': {
        return (
          <SecurityView
            onAuthenticatorEnabled={(): void => {
              void loadRemovedSecrets();
            }}
            onUsernameChanged={(username: string): void => {
              setAdministrator((current: Web_Api_Administrator | null): Web_Api_Administrator | null => (
                (current === null) ? current : {
                  ...current,
                  username,
                }
              ));
            }}
          />
        );
      }
      case 'notifications': {
        return (
          <NotificationsView
            interpreter="transmission-vpn"
            onChange={(): void => {
              void loadRemovedSecrets();
            }}
          />
        );
      }
      case 'access': {
        return (
          <AccessView
            connections={vpnConnections?.['connections'] ?? []}
            onCreateRPCLogin={async (username: string): Promise<Web_Api_RPCCredential> => {
              const credential: Web_Api_RPCCredential = await createRPCLogin({ username });
              setRPCLogins(await getRPCLogins());

              return credential;
            }}
            onCreateToken={async (input: Web_Api_CreateTokenInput): Promise<Web_Api_CreatedToken> => {
              const nextToken: Web_Api_CreatedToken = await createToken(input);
              setTokens(await getTokens());

              return nextToken;
            }}
            onCreateWebProxyLogin={async (input: Web_Api_WebProxyLoginInput): Promise<Web_Api_WebProxyCredential> => {
              const credential: Web_Api_WebProxyCredential = await createWebProxyLogin(input);
              setWebProxy(await getWebProxy());

              return credential;
            }}
            onDeleteRPCLogin={async (loginId: string): Promise<void> => {
              await deleteRPCLogin(loginId);
              setRPCLogins(await getRPCLogins());
            }}
            onDeleteWebProxyLogin={async (loginId: string): Promise<void> => {
              await deleteWebProxyLogin(loginId);
              setWebProxy(await getWebProxy());
            }}
            onOpenVPN={(): void => {
              openVPN({ kind: 'new' });
            }}
            onRefreshWebProxy={async (): Promise<Web_Api_WebProxy> => {
              const nextWebProxy: Web_Api_WebProxy = await getWebProxy();
              setWebProxy(nextWebProxy);

              return nextWebProxy;
            }}
            onRevokeToken={async (tokenId: string): Promise<void> => {
              await revokeToken(tokenId);
              setTokens(await getTokens());
            }}
            onToggleRPC={async (enabled: boolean): Promise<void> => {
              await saveSettings({ 'rpc.compatibilityEnabled': enabled });
            }}
            onToggleWebProxy={async (enabled: boolean): Promise<Web_Api_WebProxy> => {
              const nextWebProxy: Web_Api_WebProxy = await updateWebProxy(enabled);
              setWebProxy(nextWebProxy);

              return nextWebProxy;
            }}
            onUpdateRPCLogin={async (
              loginId: string,
              input: Web_Api_UpdateRPCLoginInput,
            ): Promise<Web_Api_RPCCredential> => {
              const credential: Web_Api_RPCCredential = await updateRPCLogin(loginId, input);
              setRPCLogins(await getRPCLogins());

              return credential;
            }}
            onUpdateToken={async (tokenId: string, input: Web_Api_UpdateTokenInput): Promise<void> => {
              await updateToken(tokenId, input);
              setTokens(await getTokens());
            }}
            onUpdateWebProxyLogin={async (
              loginId: string,
              input: Web_Api_UpdateWebProxyLoginInput,
            ): Promise<Web_Api_WebProxyCredential> => {
              const credential: Web_Api_WebProxyCredential = await updateWebProxyLogin(loginId, input);
              setWebProxy(await getWebProxy());

              return credential;
            }}
            rpcEnabled={rpcEnabled}
            rpcLogins={rpcLogins}
            tokens={tokens}
            webProxy={webProxy}
          />
        );
      }
      default: {
        return (
          <TorrentWorkspace
            connections={vpnConnections?.['connections'] ?? []}
            defaultProfile={defaultTorrentProfile}
            errors={snapshot?.['errors'] ?? []}
            filters={torrentFilters}
            filtersOpen={filtersSheetOpen}
            onAction={runTorrentAction}
            onAddTorrent={(): void => {
              if ((vpnConnections?.['connections'].length ?? 0) === 0) {
                setAddVPNConnectionDialogOpen(true);
              } else {
                setAddDialogOpen(true);
              }
            }}
            onFiltersChange={setTorrentFilters}
            onOpenFilters={(): void => setFiltersSheetOpen(true)}
            onRemove={removeTorrents}
            onSelectTorrent={(torrent: Web_Api_Torrent): void => {
              void selectTorrent(torrent);
            }}
            onFixProfileFolder={(profileId: string): void => {
              if (profileId === 'default') {
                openDefaultTorrentProfile();

                return;
              }
              const overlapping: Web_Api_TorrentProfile | undefined = torrentProfiles.find(
                (profile: Web_Api_TorrentProfile): boolean => profile['id'] === profileId,
              );
              if (overlapping !== undefined) {
                openTorrentProfile(overlapping);
              }
            }}
            onSetProfile={setTorrentProfileAndRefreshLabels}
            profileFolderOverlaps={profileFolderOverlaps}
            profiles={torrentProfiles}
            selectedTorrentId={selectedTorrentID}
            statistics={snapshot?.statistics}
            torrents={snapshot?.torrents ?? []}
          />
        );
      }
    }
  };

  const notice: ReactElement | null = (removedSecrets.length === 0) ? null : (
    <KeyNotice
      appName="Transmission VPN"
      items={removedSecrets.map((removedSecret: Web_Api_RemovedSecret) => ({
        id: removedSecret['notificationId'] ?? removedSecret['kind'],
        label: describeRemovedSecret(removedSecret)['label'],
        onOpen: (): void => openView(describeRemovedSecret(removedSecret)['view']),
      }))}
      keyName="installation key"
      onDismiss={async (): Promise<void> => {
        await dismissRemovedSecrets();
        setRemovedSecrets([]);
      }}
      removedAt={removedSecrets.at(-1)?.['removedAt'] ?? ''}
    />
  );
  const protection: Web_Components_Protection = describeProtection(snapshot);
  const deletingTorrentProfileDefaultConnection: Web_Api_VpnConnection | undefined = vpnConnections?.['connections'].find(
    (connection: Web_Api_VpnConnection): boolean => connection['default'],
  );
  const deletingTorrentProfileDefaultConnectionName: string = deletingTorrentProfileDefaultConnection?.['name'] ?? 'the default VPN connection';
  const deletingTorrentProfileHasFailures: boolean = deletingTorrentProfileMoveResults?.some(
    (result: Web_Api_MovedTorrent): boolean => result['result'] === 'failed',
  ) ?? false;
  let deletingTorrentProfileMessage: string = '';
  if (deletingTorrentProfile !== null) {
    if (deletingTorrentProfileMoveResults !== null) {
      if (deletingTorrentProfileHasFailures === true) {
        deletingTorrentProfileMessage = `${deletingTorrentProfile['name']} was deleted. Failed torrents stayed where they were and are now assigned to ${defaultTorrentProfile['name']}.`;
      } else {
        deletingTorrentProfileMessage = `${deletingTorrentProfile['name']} was deleted. Review each torrent move below.`;
      }
    } else if (deletingTorrentProfileMoveCount === 0) {
      deletingTorrentProfileMessage = `Delete ${deletingTorrentProfile['name']}? It has no torrents to move.`;
    } else if (deletingTorrentProfileMoveCount === 1) {
      deletingTorrentProfileMessage = `Delete ${deletingTorrentProfile['name']}? Its torrent moves to ${defaultTorrentProfile['name']}'s folder, ${defaultTorrentProfile['downloadDirectory']}, and to ${deletingTorrentProfileDefaultConnectionName}.`;
    } else {
      deletingTorrentProfileMessage = `Delete ${deletingTorrentProfile['name']}? Its ${String(deletingTorrentProfileMoveCount)} torrents move to ${defaultTorrentProfile['name']}'s folder, ${defaultTorrentProfile['downloadDirectory']}, and to ${deletingTorrentProfileDefaultConnectionName}.`;
    }
  }
  let deletingTorrentProfileConfirmLabel: string = 'Delete profile';
  if (deletingTorrentProfileMoveCount > 0) {
    deletingTorrentProfileConfirmLabel = 'Delete and move';
  }

  /**
   * App - Renders library navigation.
   *
   * Supplies the same filter and profile navigation to the desktop sidebar and
   * the phone Filters sheet, with an optional sheet close callback.
   *
   * @param {() => void} [onSheetClose] - On sheet close.
   *
   * @returns {ReactElement}
   *
   * @since UNRELEASED
   */
  const renderLibraryNavigation = (onSheetClose?: () => void): ReactElement => (
    <LibraryNavigation
      defaultProfile={defaultTorrentProfile}
      filters={torrentFilters}
      onCreateProfile={openNewTorrentProfile}
      onDeleteProfile={(profile: Web_Api_TorrentProfile): void => {
        const moveCount: number = (snapshot?.['torrents'] ?? []).filter(
          (torrent: Web_Api_Torrent): boolean => torrent['profileId'] === profile['id'],
        ).length;
        setDeletingTorrentProfileError('');
        setDeletingTorrentProfileMoveCount(moveCount);
        setDeletingTorrentProfileMoveResults(null);
        setDeletingTorrentProfile(profile);
      }}
      onEditDefaultProfile={openDefaultTorrentProfile}
      onEditProfile={openTorrentProfile}
      onFiltersChange={setTorrentFilters}
      onManage={(): void => setOrganizationDialogOpen(true)}
      onSheetClose={onSheetClose}
      organization={organization}
      profiles={torrentProfiles}
      torrents={snapshot?.torrents ?? []}
    />
  );

  return (
    <AppShell
      activeView={activeView}
      notice={notice}
      onLogout={(): void => {
        void signOut();
      }}
      onViewChange={openView}
      phoneSheet={(filtersSheetOpen && activeView === 'torrents') ? {
        content: renderLibraryNavigation((): void => setFiltersSheetOpen(false)),
        id: 'torrent-filters',
        onClose: (): void => setFiltersSheetOpen(false),
        title: 'Filters',
      } : undefined}
      sidebarNavigationSlot={(activeView === 'torrents') ? renderLibraryNavigation() : undefined}
      status={{
        ...protection,
        onOpen: (): void => openView('vpn'),
      }}
      username={administrator['username'] ?? 'Administrator'}
    >
      {renderView()}
      <AddTorrentDialog
        connections={vpnConnections?.['connections'] ?? []}
        defaultProfile={defaultTorrentProfile}
        labelPresets={torrentLabels}
        onAdd={addTorrentAndRefreshLabels}
        onClose={(): void => setAddDialogOpen(false)}
        onOpenVPN={(): void => {
          setAddDialogOpen(false);
          openVPN({ kind: 'new' });
        }}
        open={addDialogOpen}
        profiles={torrentProfiles}
        torrents={snapshot?.['torrents'] ?? []}
      />
      <ConfirmDialog
        busy={false}
        busyLabel="Opening…"
        confirmLabel="Add VPN connection"
        error=""
        message="Torrents only download through a VPN connection, so add one before adding torrents."
        onCancel={(): void => setAddVPNConnectionDialogOpen(false)}
        onConfirm={(): void => {
          setAddVPNConnectionDialogOpen(false);
          openVPN({ kind: 'new' });
        }}
        open={addVPNConnectionDialogOpen}
        title="Add a VPN connection first"
        tone="primary"
      />
      <TorrentOrganizationDialog
        labels={torrentLabels}
        onClose={(): void => setOrganizationDialogOpen(false)}
        onSave={saveTorrentOrganization}
        open={organizationDialogOpen}
        organization={organization}
      />
      <TorrentProfileDialog
        connections={vpnConnections?.['connections'] ?? []}
        defaultProfile={defaultTorrentProfile}
        labelPresets={torrentLabels}
        mode={profileDialogMode ?? 'create'}
        onClose={(): void => setProfileDialogMode(null)}
        onSave={saveTorrentProfile}
        open={profileDialogMode !== null}
        profile={editingTorrentProfile}
        profiles={torrentProfiles}
      />
      <ConfirmDialog
        busy={deletingTorrentProfileBusy}
        busyLabel={(deletingTorrentProfileMoveCount > 0) ? 'Deleting and moving…' : 'Deleting…'}
        confirmLabel={deletingTorrentProfileConfirmLabel}
        error={deletingTorrentProfileError}
        message={deletingTorrentProfileMessage}
        onCancel={(): void => {
          setDeletingTorrentProfile(null);
          setDeletingTorrentProfileMoveCount(0);
          setDeletingTorrentProfileMoveResults(null);
        }}
        onConfirm={(): void => {
          void confirmTorrentProfileDeletion();
        }}
        open={deletingTorrentProfile !== null && deletingTorrentProfileMoveResults === null}
        title="Delete torrent profile"
        tone="danger"
      />
      {(deletingTorrentProfile === null || deletingTorrentProfileMoveResults === null) ? null : (
        <div className="dialog-backdrop" role="presentation">
          <section aria-describedby="delete-profile-results-message" aria-labelledby="delete-profile-results-title" aria-modal="true" className="dialog dialog-small" role="alertdialog">
            <div className="dialog-heading">
              <h2 id="delete-profile-results-title">Move results</h2>
            </div>
            <p className="dialog-message" id="delete-profile-results-message">{deletingTorrentProfileMessage}</p>
            <div className="torrent-move-results">
              <ul>
                {deletingTorrentProfileMoveResults.map((result: Web_Api_MovedTorrent): ReactElement => (
                  <li className={(result['result'] === 'failed') ? 'move-failed' : 'move-succeeded'} key={result['hash']}>
                    <strong>{result['name']}</strong>
                    <span className="move-result-copy">
                      <span className="move-result-state">{torrentMoveResultLabel(result)}</span>
                      {result['warnings']?.map((warning: string): ReactElement => <small key={warning}>{warning}</small>)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="dialog-actions">
              <Button
                onClick={(): void => {
                  setDeletingTorrentProfile(null);
                  setDeletingTorrentProfileMoveCount(0);
                  setDeletingTorrentProfileMoveResults(null);
                }}
                variant="primary"
              >
                Done
              </Button>
            </div>
          </section>
        </div>
      )}
      {(selectedTorrentID === null) ? null : (
        <TorrentDetail
          connections={vpnConnections?.['connections'] ?? []}
          defaultProfile={defaultTorrentProfile}
          detail={torrentDetail}
          labelPresets={torrentLabels}
          loading={torrentDetailLoading}
          onAction={runTorrentAction}
          onClose={(): void => {
            setSelectedTorrentID(null);
            setTorrentDetail(null);
          }}
          onRefresh={refreshTorrentDetail}
          onRename={renameTorrentPath}
          onSetProfile={setTorrentProfileAndRefreshLabels}
          onUpdate={updateTorrentsAndRefreshLabels}
          profiles={torrentProfiles}
        />
      )}
    </AppShell>
  );
};
