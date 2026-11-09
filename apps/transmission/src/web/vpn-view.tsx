import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ApiError,
  connectionBeingRemovedMessage,
  issueFor,
  summaryFor,
} from '@/web/api.ts';
import { ConfirmDialog } from '@/web/confirm-dialog.tsx';
import { FieldLabel } from '@/web/field-label.tsx';
import {
  formatConsoleError,
  parseVPNConnectionInput,
  providerRequiredMessage,
  validateProviderCredentials,
} from '@/web/form-validation.ts';
import { formatDate } from '@/web/format.ts';
import {
  Button,
  Icon,
  passwordManagerIgnore,
} from '@/web/primitives.tsx';
import { showToast } from '@/web/toast.ts';
import {
  formatBytes,
  formatElapsed,
} from '@/web/torrent-format.ts';
import { torrentMoveResultLabel } from '@/web/torrent-move-result.ts';
import {
  placeListedID,
  useDragReorder,
} from '@/web/use-drag-reorder.ts';
import { defaultVPNMoveConfirmation } from '@/web/vpn-default-change.ts';
import {
  credentialInput,
  describeTunnel,
  keptCredentials,
  pickTunnel,
  profileFile,
  shouldInitializeConnectionEditor,
  submittedCredentials,
  tunnelLabel,
} from '@/web/vpn-tunnels.ts';

import type {
  ChangeEvent,
  FormEvent,
  ReactElement,
} from 'react';

import type {
  Web_Api_CreateVpnConnectionInput,
  Web_Api_MovedTorrent,
  Web_Api_Provider,
  Web_Api_ProviderCredentialField,
  Web_Api_ProviderP2P,
  Web_Api_ProviderTunnel,
  Web_Api_UpdateVpnConnectionInput,
  Web_Api_VpnConfigurationInput,
  Web_Api_VpnConnection,
  Web_Api_VpnProfile,
  Web_Api_VpnRuntime,
  Web_Api_VpnTunnel,
} from '@/types/web/api.d.ts';
import type {
  Web_Components_VpnView_NavigationTarget,
  Web_Components_VpnView_Props,
} from '@/types/web/components.d.ts';
import type { Web_UseDragReorder_Result } from '@/types/web/use-drag-reorder.d.ts';
import type {
  Web_VpnTunnels_CredentialInput,
  Web_VpnTunnels_ProfileFile,
} from '@/types/web/vpn-tunnels.d.ts';

/**
 * VPN View - Remove dependencies.
 *
 * Names the resources reported by a connection-in-use response.
 * The dialog renders each group as a separate one-item-per-line list.
 *
 * @since UNRELEASED
 */
type RemoveDependencies = {
  torrents: number
  profiles: {
    id: string
    name: string
  }[]
  logins: {
    id: string
    username: string
  }[]
};

/**
 * VPN View - Remove state.
 *
 * Keeps the selected row together with its server-reported dependencies.
 * This prevents stale list data from replacing the conflict response.
 *
 * @since UNRELEASED
 */
type RemoveState = {
  connection: Web_Api_VpnConnection
  dependencies: RemoveDependencies
};

/**
 * VPN View - Default change state.
 *
 * Keeps the selected target with the server-counted profile-group totals.
 * The conflict identifies Default-profile and following-profile torrents.
 *
 * @since UNRELEASED
 */
type DefaultChangeState = {
  connection: Web_Api_VpnConnection
  defaultProfileTorrents: number
  followingProfileTorrents: number
  torrents: number
};

/**
 * VPN View - Endpoint strategy.
 *
 * Reuses the stored connection union for the editor state.
 * The form and API therefore cannot drift between strategy spellings.
 *
 * @since UNRELEASED
 */
type EndpointStrategy = Web_Api_VpnConnection['endpointStrategy'];

/**
 * VPN View - Maximum custom profile bytes.
 *
 * Keeps custom uploads within the same bound as the original VPN page.
 * The browser rejects oversized files before reading them into memory.
 *
 * @since UNRELEASED
 */
const maximumCustomProfileBytes: number = 900_000;

/**
 * VPN View - Endpoint strategy descriptions.
 *
 * Explains how the ordered pool is used after an endpoint fails.
 * The selected strategy updates the approved helper copy in place.
 *
 * @since UNRELEASED
 */
const endpointStrategyDescriptions: Record<EndpointStrategy, string> = {
  ordered: 'Move to the next endpoint after a connection fails.',
  randomized: 'Shuffle the endpoint order for each failover cycle.',
  sticky: 'Keep using the current endpoint until it stops working.',
};

/**
 * VPN View - State labels.
 *
 * Gives controller states the approved sentence-case chip text.
 * Unknown future states still fall back to their server value.
 *
 * @since UNRELEASED
 */
const stateLabels: Record<string, string> = {
  'blocked': 'Blocked',
  'connecting': 'Connecting',
  'disconnected': 'Disconnected',
  'error': 'Error',
  'protected': 'Protected',
  'reconnecting': 'Connecting',
  'setup-required': 'Setup required',
};

/**
 * VPN View - Connection state.
 *
 * Prefers the newest event snapshot while the durable list refresh catches up.
 * Stored runtime remains available before the first event arrives.
 *
 * @since UNRELEASED
 */
const connectionState = (
  connection: Web_Api_VpnConnection,
  snapshot: Web_Components_VpnView_Props['snapshot'],
): Web_Api_VpnRuntime => snapshot?.['connections'].find(
  (candidate): boolean => candidate['connectionId'] === connection['id'],
) ?? connection['runtime'];

/**
 * VPN View - Status reason.
 *
 * Provides the second line beneath each state chip.
 * Controller errors take precedence over generated activity text.
 *
 * @since UNRELEASED
 */
const statusReason = (runtime: Web_Api_VpnRuntime): string => {
  if (runtime['lastError'] !== undefined && runtime['lastError'] !== '') {
    return runtime['lastError'];
  }
  if (runtime['state'] === 'protected' && runtime['lastHandshakeAt'] !== undefined) {
    return `Handshake ${formatElapsed(runtime['lastHandshakeAt'])}`;
  }
  if (runtime['state'] === 'connecting' || runtime['state'] === 'reconnecting') {
    return `Attempt ${runtime['attempt']}`;
  }
  // OpenVPN has no handshake time, so a protected OpenVPN row has no second line.
  if (runtime['state'] === 'protected') {
    return '';
  }

  return 'Torrent traffic is blocked';
};

/**
 * VPN View - Status tone.
 *
 * Maps all non-protected terminal states to the blocked visual treatment.
 * Connecting states retain their progress treatment instead.
 *
 * @since UNRELEASED
 */
const statusTone = (state: string): string => {
  if (state === 'protected') {
    return 'protected';
  }
  if (state === 'connecting' || state === 'reconnecting') {
    return 'connecting';
  }

  return 'blocked';
};

/**
 * VPN View - Parse dependencies.
 *
 * Safely narrows optional error details before the remove dialog uses them.
 * Missing groups become empty lists so partial responses remain renderable.
 *
 * @since UNRELEASED
 */
const parseDependencies = (details: Record<string, unknown>): RemoveDependencies => ({
  logins: (Array.isArray(details['logins'])) ? details['logins'] as RemoveDependencies['logins'] : [],
  profiles: (Array.isArray(details['profiles'])) ? details['profiles'] as RemoveDependencies['profiles'] : [],
  torrents: (typeof details['torrents'] === 'number') ? details['torrents'] : 0,
});

/**
 * VPN View - Moved torrents.
 *
 * Extracts partial move results from a move-failed error response.
 * An absent result list is represented as an empty list.
 *
 * @since UNRELEASED
 */
const movedTorrents = (details: Record<string, unknown>): Web_Api_MovedTorrent[] => (
  (Array.isArray(details['moved'])) ? details['moved'] as Web_Api_MovedTorrent[] : []
);

/**
 * VPN connection editor.
 *
 * Creates a connection or updates one existing slot. Configuration changes are
 * tested and connected; name-only and peer-port-only changes save in place.
 *
 * @since UNRELEASED
 */
const ConnectionEditor = ({
  connection,
  defaultPeerPort,
  onBack,
  onCreate,
  onDisconnect,
  onMakeDefault,
  onReconnect,
  onRefreshCatalog,
  onUpdate,
  onUploadProfile,
  profiles,
  providers,
  snapshot,
}: {
  connection: Web_Api_VpnConnection | null
  defaultPeerPort: number
  onBack: () => void
  onCreate: Web_Components_VpnView_Props['onCreate']
  onDisconnect: Web_Components_VpnView_Props['onDisconnect']
  onMakeDefault: Web_Components_VpnView_Props['onMakeDefault']
  onReconnect: Web_Components_VpnView_Props['onReconnect']
  onRefreshCatalog: Web_Components_VpnView_Props['onRefreshCatalog']
  onUpdate: Web_Components_VpnView_Props['onUpdate']
  onUploadProfile: Web_Components_VpnView_Props['onUploadProfile']
  profiles: Web_Api_VpnProfile[]
  providers: Web_Api_Provider[]
  snapshot: Web_Components_VpnView_Props['snapshot']
}): ReactElement => {
  const [
    name,
    setName,
  ] = useState<string>('');
  const [
    peerPort,
    setPeerPort,
  ] = useState<string>('51413');
  const [
    providerID,
    setProviderID,
  ] = useState<string>('');
  const [
    providerSubmissionAttempted,
    setProviderSubmissionAttempted,
  ] = useState<boolean>(false);
  const [
    tunnelChoice,
    setTunnelChoice,
  ] = useState<Web_Api_VpnTunnel>('openvpn');
  const [
    profileIDs,
    setProfileIDs,
  ] = useState<string[]>([]);
  const [
    endpointStrategy,
    setEndpointStrategy,
  ] = useState<EndpointStrategy>('sticky');
  const [
    search,
    setSearch,
  ] = useState<string>('');
  const [
    continent,
    setContinent,
  ] = useState<string>('all');
  const [
    protocol,
    setProtocol,
  ] = useState<string>('all');
  const [
    visibleProfileCount,
    setVisibleProfileCount,
  ] = useState<number>(100);
  const [
    credentials,
    setCredentials,
  ] = useState<Record<string, string>>({});
  const [
    dnsMode,
    setDNSMode,
  ] = useState<'provider' | 'custom'>('provider');
  const [
    customDNS,
    setCustomDNS,
  ] = useState<string>('');
  const [
    retryInterval,
    setRetryInterval,
  ] = useState<string>('10');
  const [
    busyAction,
    setBusyAction,
  ] = useState<string>('');
  const [
    error,
    setError,
  ] = useState<string>('');
  const [
    fieldError,
    setFieldError,
  ] = useState<ApiError | null>(null);
  const [
    customFile,
    setCustomFile,
  ] = useState<File | null>(null);
  const tunnelLabelID: string = useId();
  const uploadHintID: string = useId();
  const reorderHintID: string = useId();
  const initializedSessionIDRef = useRef<string | null>(null);
  const poolListRef = useRef<HTMLOListElement | null>(null);

  useEffect((): void => {
    const sessionID: string = connection?.['id'] ?? 'new';
    if (!shouldInitializeConnectionEditor(
      initializedSessionIDRef.current,
      sessionID,
      providers.length > 0,
    )) {
      return;
    }
    initializedSessionIDRef.current = sessionID;
    // A new connection starts on "— Select one —", so no provider is preferred.
    const nextProviderID = connection?.['providerId'] ?? '';
    const nextProvider = providers.find((provider): boolean => provider['id'] === nextProviderID);
    const nextTunnel = connection?.['tunnel'] ?? pickTunnel(nextProvider, 'openvpn')?.['id'] ?? 'openvpn';
    setName(connection?.['name'] ?? '');
    setPeerPort(String(connection?.['peerPort'] ?? defaultPeerPort));
    setProviderID(nextProviderID);
    setProviderSubmissionAttempted(false);
    setTunnelChoice(nextTunnel);
    setProfileIDs(connection?.['profileIds'] ?? []);
    setEndpointStrategy(connection?.['endpointStrategy'] ?? 'sticky');
    setSearch('');
    setContinent('all');
    setProtocol('all');
    setVisibleProfileCount(100);
    setCredentials({});
    setCustomFile(null);
    setDNSMode(((connection?.['dnsServers'].length ?? 0) === 0) ? 'provider' : 'custom');
    setCustomDNS(connection?.['dnsServers'].join('\n') ?? '');
    setRetryInterval(String(connection?.['retryIntervalSeconds'] ?? 10));
    setError('');
    setFieldError(null);
    setBusyAction('');
  }, [
    connection,
    defaultPeerPort,
    providers,
  ]);

  const selectedProvider: Web_Api_Provider | undefined = providers.find(
    (provider): boolean => provider['id'] === providerID,
  );
  const selectedP2P: Web_Api_ProviderP2P | null = selectedProvider?.['p2p'] ?? null;
  const selectedTunnel: Web_Api_ProviderTunnel | undefined = pickTunnel(selectedProvider, tunnelChoice);
  const tunnelID: Web_Api_VpnTunnel = selectedTunnel?.['id'] ?? 'openvpn';
  const isWireGuard: boolean = tunnelID === 'wireguard';
  const uploadFile: Web_VpnTunnels_ProfileFile = profileFile(tunnelID);
  const providerProfiles: Web_Api_VpnProfile[] = useMemo((): Web_Api_VpnProfile[] => (
    profiles.filter((profile): boolean => profile['providerId'] === providerID && profile['tunnel'] === tunnelID)
  ), [
    profiles,
    providerID,
    tunnelID,
  ]);
  const profileByID: Map<string, Web_Api_VpnProfile> = useMemo((): Map<string, Web_Api_VpnProfile> => (
    new Map(providerProfiles.map((profile): [string, Web_Api_VpnProfile] => [
      profile['id'],
      profile,
    ]))
  ), [providerProfiles]);
  const selectedProfiles: Web_Api_VpnProfile[] = profileIDs.flatMap(
    (profileID): Web_Api_VpnProfile[] => {
      const selectedProfile: Web_Api_VpnProfile | undefined = profileByID.get(profileID);

      return (selectedProfile === undefined) ? [] : [selectedProfile];
    },
  );

  // The fallback order is part of the form, so each move only changes the draft.
  const poolReorder: Web_UseDragReorder_Result = useDragReorder(poolListRef, (profileID: string, destinationIndex: number): void => {
    setProfileIDs((currentProfileIDs): string[] => placeListedID(currentProfileIDs, profileByID, profileID, destinationIndex));
  });
  const continents: string[] = useMemo((): string[] => (
    [...new Set(providerProfiles
      .map((profile): string => profile['continent'])
      .filter((value): boolean => value !== ''))]
      .sort((left, right): number => left.localeCompare(right))
  ), [providerProfiles]);
  const filteredProfiles: Web_Api_VpnProfile[] = useMemo((): Web_Api_VpnProfile[] => {
    const normalizedSearch: string = search.trim().toLocaleLowerCase();

    return providerProfiles.filter((profile): boolean => {
      if (continent !== 'all' && profile['continent'] !== continent) {
        return false;
      }
      if (protocol !== 'all' && profile['protocol'] !== protocol) {
        return false;
      }
      if (normalizedSearch === '') {
        return true;
      }

      return [
        profile['displayName'],
        profile['country'],
        profile['city'],
        profile['remoteHost'],
      ].some((value): boolean => value.toLocaleLowerCase().includes(normalizedSearch));
    });
  }, [
    continent,
    protocol,
    providerProfiles,
    search,
  ]);
  const visibleProfiles: Web_Api_VpnProfile[] = filteredProfiles.slice(0, visibleProfileCount);
  const credentialFields: Web_Api_ProviderCredentialField[] = selectedTunnel?.['credentialFields'] ?? [];
  let savedCredentials: string[] = [];
  if (
    connection !== null
    && providerID === connection['providerId']
    && tunnelID === connection['tunnel']
  ) {
    savedCredentials = connection['savedCredentials'];
  }
  const nameIssue: string = issueFor(fieldError, 'name');
  const peerPortIssue: string = issueFor(fieldError, 'peerPort');
  let providerIssue: string = issueFor(fieldError, 'providerId');
  if (providerIssue === '') {
    providerIssue = issueFor(fieldError, 'configuration.providerId');
  }
  if (providerIssue === '' && providerSubmissionAttempted && providerID === '') {
    providerIssue = providerRequiredMessage;
  }
  const runtime: Web_Api_VpnRuntime | undefined = (connection === null) ? undefined : connectionState(connection, snapshot);
  const activeProvider: Web_Api_Provider | undefined = providers.find(
    (provider): boolean => provider['id'] === (runtime?.['providerId'] ?? connection?.['providerId']),
  );
  const activeProfile: Web_Api_VpnProfile | undefined = profiles.find(
    (profile): boolean => profile['id'] === runtime?.['profileId'],
  );
  const firewall = (snapshot === null || snapshot['status'] === undefined) ? undefined : snapshot['status']['runtime']['firewall'];
  const runtimeTone: string = (runtime === undefined) ? 'blocked' : statusTone(runtime['state']);
  const runtimeLabel: string = (runtime === undefined) ? 'Not connected' : stateLabels[runtime['state']] ?? runtime['state'];
  const statusIsProtected: boolean = runtime?.['state'] === 'protected';
  const statusIsWireGuard: boolean = (runtime?.['tunnel'] ?? tunnelID) === 'wireguard';
  const interfaceLabel: string = (statusIsProtected) ? runtime?.['interface'] ?? '—' : '—';
  const handshakeLabel: string = (statusIsProtected && runtime?.['lastHandshakeAt'] !== undefined) ? formatElapsed(runtime['lastHandshakeAt']) : '—';
  const remotePort: string = (runtime?.['remotePort'] === undefined) ? '' : `:${runtime['remotePort']}`;
  const protocolSuffix: string = (activeProfile === undefined || statusIsWireGuard) ? '' : ` (${activeProfile['protocol']})`;
  let endpointLabel: string = '—';
  if (connection === null) {
    endpointLabel = 'Not tested';
  }
  if (runtime?.['remoteHost'] !== undefined) {
    endpointLabel = `${runtime['remoteHost']}${remotePort}${protocolSuffix}`;
  }
  const strategySuffix: string = (runtime?.['endpointStrategy'] === undefined) ? '' : `, ${runtime['endpointStrategy']}`;
  const poolLabel: string = (runtime?.['endpointCount'] === undefined) ? `${profileIDs.length} ${(profileIDs.length === 1) ? 'endpoint' : 'endpoints'}` : `${runtime['endpointPosition'] ?? 1} of ${runtime['endpointCount']}${strategySuffix}`;
  let firewallLabel: string = '—';
  if (connection === null) {
    firewallLabel = 'Ready';
  } else if (firewall !== undefined) {
    // Plain words for the firewall's two states. Its iptables variant stays in the health API.
    firewallLabel = (firewall['state'] === 'protected') ? 'Tunnel only' : 'Blocked';
  }
  let normalizedDNS: string[] = [];
  if (dnsMode === 'custom') {
    normalizedDNS = customDNS
      .split('\n')
      .map((server): string => server.trim())
      .filter((server): boolean => server !== '');
  }
  const credentialsDirty: boolean = Object.values(credentials).some((value): boolean => value.trim() !== '');
  const configurationDirty: boolean = connection === null
    || providerID !== connection['providerId']
    || tunnelID !== connection['tunnel']
    || endpointStrategy !== connection['endpointStrategy']
    || retryInterval !== String(connection['retryIntervalSeconds'])
    || normalizedDNS.join('\n') !== connection['dnsServers'].join('\n')
    || profileIDs.join('|') !== connection['profileIds'].join('|')
    || credentialsDirty;
  const metadataDirty: boolean = connection !== null && (
    name.trim() !== connection['name'] || Number(peerPort) !== connection['peerPort']
  );
  const renameOnly: boolean = connection !== null && metadataDirty && !configurationDirty;
  const changeRunning: boolean = connection?.['changeRunning'] === true;
  // Every Transmission looks trackers up through the default connection, so say whose DNS answers.
  let dnsHint: string = 'Web proxy logins on this connection use these servers. Tracker lookups for every connection use the default connection\'s DNS.';
  if (connection?.['default'] === true) {
    dnsHint = 'This is the default connection, so these servers answer the tracker lookups of every connection, plus this connection\'s web proxy logins.';
  } else if (connection !== null) {
    dnsHint = 'Only this connection\'s web proxy logins use these servers. Tracker lookups for every connection use the default connection\'s DNS.';
  }

  /**
   * VPN connection editor - Reset selection.
   *
   * Clears endpoint-specific state after a provider or tunnel change.
   * Filters and credentials cannot carry across different catalogs.
   *
   * @since UNRELEASED
   */
  const resetSelection = (): void => {
    setProfileIDs([]);
    setSearch('');
    setContinent('all');
    setProtocol('all');
    setVisibleProfileCount(100);
    setCredentials({});
    setCustomFile(null);
    setError('');
    setFieldError(null);
    setProviderSubmissionAttempted(false);
  };

  /**
   * VPN connection editor - Toggle profile.
   *
   * Adds or removes one endpoint while preserving the pool order.
   * The same handler serves the browser and fallback list controls.
   *
   * @param {string} profileID - Profile i d.
   *
   * @since UNRELEASED
   */
  const toggleProfile = (profileID: string): void => {
    if (!profileIDs.includes(profileID) && profileIDs.length >= 128) {
      showToast('An endpoint pool can contain up to 128 profiles.', false);

      return;
    }

    setProfileIDs((currentProfileIDs): string[] => (
      (currentProfileIDs.includes(profileID)) ? currentProfileIDs.filter((currentProfileID): boolean => currentProfileID !== profileID) : [
        ...currentProfileIDs,
        profileID,
      ]
    ));
  };

  /**
   * VPN connection editor - Build configuration.
   *
   * Normalizes the form into the exact create/update configuration body.
   * Metadata remains outside this object for rename-only saves.
   *
   * @since UNRELEASED
   */
  const buildConfiguration = (): Web_Api_VpnConfigurationInput => ({
    credentials: submittedCredentials(credentialFields, credentials),
    ...parseVPNConnectionInput({
      dnsServers: normalizedDNS,
      retryIntervalSeconds: Number(retryInterval),
    }),
    endpointStrategy,
    profileIds: profileIDs,
    providerId: providerID,
    tunnel: tunnelID,
  });

  /**
   * VPN connection editor - Submit.
   *
   * Omits configuration for metadata-only saves so the VPN stays connected.
   * New and configuration-changing submissions retain the test workflow.
   *
   * @since UNRELEASED
   */
  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setProviderSubmissionAttempted(true);
    if (providerID === '') {
      setError('');
      setFieldError(null);

      return;
    }
    setBusyAction('save');
    setError('');
    setFieldError(null);
    try {
      if (!renameOnly) {
        validateProviderCredentials(selectedTunnel, credentials, savedCredentials);
      }

      if (connection === null) {
        const input: Web_Api_CreateVpnConnectionInput = {
          ...buildConfiguration(),
          name: name.trim(),
          peerPort: Number(peerPort),
        };
        await onCreate(input);
      } else {
        const input: Web_Api_UpdateVpnConnectionInput = {
          expectedRevision: connection['revision'],
          ...((name.trim() === connection['name']) ? {} : { name: name.trim() }),
          ...((Number(peerPort) === connection['peerPort']) ? {} : { peerPort: Number(peerPort) }),
          ...((renameOnly) ? {} : { configuration: buildConfiguration() }),
        };
        await onUpdate(connection['id'], input);
      }

      setCredentials((currentCredentials): Record<string, string> => keptCredentials(credentialFields, currentCredentials));
      showToast((renameOnly) ? 'Connection saved.' : 'VPN connected.', true);
      onBack();
    } catch (caughtError) {
      const shownFields: string[] = [
        'name',
        'peerPort',
        'providerId',
        'configuration.providerId',
      ];
      for (const field of credentialFields) {
        shownFields.push(`credentials.${field['key']}`);
        shownFields.push(`configuration.credentials.${field['key']}`);
      }

      setFieldError((caughtError instanceof ApiError) ? caughtError : null);
      setError(summaryFor(caughtError, shownFields, 'The connection could not be saved.'));
    } finally {
      setBusyAction('');
    }
  };

  /**
   * VPN connection editor - Run connection action.
   *
   * Shares busy and error handling across the three row-level mutations.
   * Each action remains scoped to the open connection identifier.
   *
   * @since UNRELEASED
   */
  const runConnectionAction = async (action: 'default' | 'disconnect' | 'reconnect'): Promise<void> => {
    if (connection === null) {
      return;
    }
    setBusyAction(action);
    setError('');
    setFieldError(null);
    try {
      if (action === 'default') {
        await onMakeDefault(connection['id']);
      } else if (action === 'disconnect') {
        await onDisconnect(connection['id']);
        showToast('VPN disconnected. Torrent traffic is blocked.', true);
      } else {
        await onReconnect(connection['id']);
        showToast('VPN reconnect started.', true);
      }
    } catch (caughtError) {
      setError((caughtError instanceof Error) ? caughtError.message : 'The VPN action could not be completed.');
    } finally {
      setBusyAction('');
    }
  };

  /**
   * VPN connection editor - Handle custom file.
   *
   * Stores the selected profile until the user uploads it.
   * File content remains local until the explicit upload action.
   *
   * @param {ChangeEvent<HTMLInputElement>} event - Event.
   *
   * @since UNRELEASED
   */
  const handleCustomFile = (event: ChangeEvent<HTMLInputElement>): void => {
    setCustomFile(event.currentTarget.files?.[0] ?? null);
  };

  /**
   * VPN connection editor - Upload profile.
   *
   * Validates the browser-side size bound before reading the file.
   * A successful upload becomes the only selected custom endpoint.
   *
   * @since UNRELEASED
   */
  const uploadProfile = async (): Promise<void> => {
    if (customFile === null) {
      showToast(`Choose a ${uploadFile['label']} first.`, false);

      return;
    }
    if (customFile.size === 0 || customFile.size > maximumCustomProfileBytes) {
      showToast(`Choose a non-empty ${uploadFile['label']} smaller than 900 KB.`, false);

      return;
    }

    setBusyAction('upload');
    try {
      const profileContent: string = await customFile.text();
      const uploadedProfiles: Web_Api_VpnProfile[] = await onUploadProfile(tunnelID, customFile.name, profileContent);
      setProviderID('custom');
      setTunnelChoice(uploadedProfiles[0]?.['tunnel'] ?? tunnelID);
      setProfileIDs(uploadedProfiles.map((profile: Web_Api_VpnProfile): string => profile['id']));
      setCustomFile(null);
      showToast(`${String(uploadedProfiles.length)} VPN ${(uploadedProfiles.length === 1) ? 'endpoint' : 'endpoints'} uploaded.`, true);
    } catch (caughtError) {
      setError((caughtError instanceof Error) ? caughtError.message : 'The profile could not be uploaded.');
    } finally {
      setBusyAction('');
    }
  };

  let tunnelControl: ReactElement | null = null;
  if (selectedProvider !== undefined && selectedProvider['tunnels'].length > 1) {
    tunnelControl = (
      <div aria-labelledby={tunnelLabelID} className="field tunnel-field" role="group">
        <span id={tunnelLabelID}>Tunnel</span>
        <div className="segmented">
          {selectedProvider['tunnels'].map((tunnel): ReactElement => (
            <button
              aria-pressed={tunnel['id'] === tunnelID}
              key={tunnel['id']}
              onClick={(): void => {
                if (tunnel['id'] === tunnelID) {
                  return;
                }

                setTunnelChoice(tunnel['id']);
                resetSelection();
              }}
              type="button"
            >
              {tunnelLabel(tunnel['id'])}
            </button>
          ))}
        </div>
      </div>
    );
  } else if (selectedTunnel !== undefined) {
    tunnelControl = (
      <div className="field tunnel-field">
        <span>Tunnel</span>
        <p className="tunnel-fixed">{tunnelLabel(tunnelID)}</p>
      </div>
    );
  }

  let primaryButtonLabel: string = (renameOnly) ? 'Save' : 'Test and connect';
  if (busyAction === 'save') {
    primaryButtonLabel = (renameOnly) ? 'Saving…' : 'Testing…';
  }

  return (
    <section className="workspace-section vpn-workspace vpn-editor-page">
      <button className="vpn-back-link" onClick={onBack} type="button">
        <Icon name="chevron" size={15} />
        All connections
      </button>
      <header className="vpn-editor-heading">
        <span className="vpn-title-line">
          <h1>{(connection === null) ? 'New connection' : connection['name']}</h1>
          {(connection?.['default'] === true) ? <span className="tag vpn-default-tag">Default</span> : null}
        </span>
        {(connection === null || connection['default']) ? null : (
          <Button
            disabled={busyAction !== ''}
            icon="shield"
            onClick={(): void => {
              void runConnectionAction('default');
            }}
          >
            Make default
          </Button>
        )}
      </header>

      {(connection === null) ? null : (
        <dl aria-label="Connection details" className="details">
          <div>
            <dt>Status</dt>
            <dd className={`details-status-${runtimeTone}`}>
              <span className="status-dot" />
              {runtimeLabel}
            </dd>
          </div>
          <div>
            <dt>Tunnel</dt>
            <dd>{(runtime === undefined) ? tunnelLabel(tunnelID) : describeTunnel(runtime)}</dd>
          </div>
          <div>
            <dt>Interface</dt>
            <dd>{interfaceLabel}</dd>
          </div>
          <div>
            <dt>Provider</dt>
            <dd>{activeProvider?.['displayName'] ?? selectedProvider?.['displayName'] ?? '—'}</dd>
          </div>
          <div>
            <dt>Endpoint</dt>
            <dd title={endpointLabel}>{endpointLabel}</dd>
          </div>
          {(statusIsWireGuard) ? (
            <div>
              <dt>Last handshake</dt>
              <dd>{handshakeLabel}</dd>
            </div>
          ) : null}
          <div>
            <dt>Pool</dt>
            <dd>{poolLabel}</dd>
          </div>
          <div>
            <dt>Firewall</dt>
            <dd>{firewallLabel}</dd>
          </div>
          <div>
            <dt>State since</dt>
            <dd>{(runtime === undefined) ? '—' : formatDate(runtime['transitionedAt'])}</dd>
          </div>
          {(runtime !== undefined && runtime['attempt'] > 1) ? (
            <div>
              <dt>Attempt</dt>
              <dd>{runtime['attempt']}</dd>
            </div>
          ) : null}
        </dl>
      )}

      {(connection === null || runtime?.['lastError'] === undefined || runtime['lastError'] === '') ? null : (
        <div className="form-error">
          <strong>Connection error</strong>
          {formatConsoleError(runtime['lastError'])}
        </div>
      )}

      <form className="panel vpn-connection-form" noValidate onSubmit={submit}>
        <section className="form-section">
          <div className="form-section-head">
            <h2>Provider</h2>
            <span>{`${profileIDs.length} ${(profileIDs.length === 1) ? 'endpoint' : 'endpoints'} selected`}</span>
          </div>
          <div className="field-row">
            <FieldLabel>
              <span>Provider</span>
              <select
                aria-invalid={providerIssue !== ''}
                onChange={(event): void => {
                  const nextProviderID: string = event.currentTarget.value;
                  const nextProvider: Web_Api_Provider | undefined = providers.find((provider): boolean => provider['id'] === nextProviderID);
                  setProviderID(nextProviderID);
                  setTunnelChoice(pickTunnel(nextProvider, 'openvpn')?.['id'] ?? 'openvpn');
                  resetSelection();
                }}
                value={providerID}
              >
                <option className="select-placeholder" value="">— Select one —</option>
                {providers.map((provider): ReactElement => (
                  <option key={provider['id']} value={provider['id']}>{provider['displayName']}</option>
                ))}
              </select>
              {(providerIssue === '') ? null : <small className="field-error">{providerIssue}</small>}
            </FieldLabel>

            {tunnelControl}
          </div>

          {(selectedTunnel?.['supportsCatalogRefresh'] === true) ? (
            <div className="inline-meta">
              <span>{(selectedTunnel['catalog'] === undefined) ? 'Endpoint list not downloaded yet' : `${selectedTunnel['catalog']['endpointCount']} endpoints · updated ${formatDate(selectedTunnel['catalog']['refreshedAt'])}`}</span>
              <button
                className="text-button"
                disabled={busyAction !== ''}
                onClick={(): void => {
                  setBusyAction('catalog refresh');
                  void onRefreshCatalog(providerID, tunnelID).then((): void => {
                    showToast('Endpoint list refreshed.', true);
                  }).catch((caughtError): void => {
                    setError((caughtError instanceof Error) ? caughtError.message : 'The endpoint list could not be refreshed.');
                  }).finally((): void => setBusyAction(''));
                }}
                type="button"
              >
                {(busyAction === 'catalog refresh') ? 'Refreshing…' : 'Refresh list'}
              </button>
            </div>
          ) : null}

          {(selectedTunnel?.['supportsProfileUpload'] === true) ? (
            <div className="upload-row">
              <label className="file-drop file-drop-compact">
                <Icon name="upload" size={20} />
                <strong>{customFile?.name ?? uploadFile['prompt']}</strong>
                <span>{(customFile === null) ? 'or drop it here' : formatBytes(customFile.size)}</span>
                <input accept={uploadFile['accept']} aria-describedby={(isWireGuard) ? uploadHintID : undefined} onChange={handleCustomFile} type="file" />
              </label>
              {(isWireGuard) ? (
                <p className="form-section-note" id={uploadHintID}>The file must include its private key, one peer, and no PostUp/PreDown lines.</p>
              ) : null}
              <Button
                disabled={busyAction !== '' || customFile === null}
                onClick={(): void => {
                  void uploadProfile();
                }}
              >
                Upload profile
              </Button>
            </div>
          ) : null}
        </section>

        <section className="form-section" hidden={providerID === ''}>
          <div className="form-section-head">
            <h2>Endpoints</h2>
            <span>{`${profileIDs.length} selected · ${filteredProfiles.length} shown`}</span>
          </div>

          {(selectedP2P === null) ? null : (
            <p className={(selectedP2P['restricted']) ? 'p2p-note p2p-note-restricted' : 'p2p-note'}>
              <Icon name={(selectedP2P['restricted']) ? 'warning' : 'torrent'} size={15} />
              <span>
                {selectedP2P['note']}
                {' '}
                <a href={selectedP2P['url']} rel="noreferrer" target="_blank">{selectedP2P['linkLabel']}</a>
              </span>
            </p>
          )}

          <div className={(isWireGuard) ? 'endpoint-filters endpoint-filters-no-protocol' : 'endpoint-filters'}>
            <label className="search-field">
              <Icon name="search" size={16} />
              <span className="visually-hidden">Search endpoints</span>
              <input
                onChange={(event): void => {
                  setSearch(event.currentTarget.value);
                  setVisibleProfileCount(100);
                }}
                placeholder="Search city, country or server"
                type="search"
                value={search}
              />
            </label>
            <select
              aria-label="Filter endpoints by continent"
              className="select-control"
              onChange={(event): void => {
                setContinent(event.currentTarget.value);
                setVisibleProfileCount(100);
              }}
              value={continent}
            >
              <option value="all">All continents</option>
              {continents.map((continentName): ReactElement => (
                <option key={continentName} value={continentName}>{continentName}</option>
              ))}
            </select>
            {(isWireGuard) ? null : (
              <select
                aria-label="Filter endpoints by protocol"
                className="select-control"
                onChange={(event): void => {
                  setProtocol(event.currentTarget.value);
                  setVisibleProfileCount(100);
                }}
                value={protocol}
              >
                <option value="all">UDP and TCP</option>
                <option value="udp">UDP</option>
                <option value="tcp">TCP</option>
              </select>
            )}
          </div>

          <div className="select-list">
            {(visibleProfiles.length === 0) ? (
              <p className="select-list-empty">No endpoints match these filters.</p>
            ) : visibleProfiles.map((profile): ReactElement => {
              const selected: boolean = profileIDs.includes(profile['id']);

              return (
                <label className="select-list-row" key={profile['id']}>
                  <input checked={selected} onChange={(): void => toggleProfile(profile['id'])} type="checkbox" />
                  <span className="select-list-main">
                    <span>{profile['displayName']}</span>
                    <small className="mono">{`${profile['remoteHost']}:${profile['remotePort']}`}</small>
                  </span>
                  <span className="tag">{(isWireGuard) ? 'WireGuard' : profile['protocol'].toUpperCase()}</span>
                </label>
              );
            })}
          </div>
          {(visibleProfiles.length >= filteredProfiles.length) ? null : (
            <button className="text-button" onClick={(): void => setVisibleProfileCount((count): number => count + 100)} type="button">Show 100 more</button>
          )}
        </section>

        <section className="form-section" hidden={providerID === ''}>
          <div className="form-section-head">
            <h2>Fallback order</h2>
            <select
              aria-label="Fallback strategy"
              className="select-control"
              onChange={(event): void => setEndpointStrategy(event.currentTarget.value as EndpointStrategy)}
              value={endpointStrategy}
            >
              <option value="sticky">Sticky</option>
              <option value="ordered">Ordered</option>
              <option value="randomized">Randomized</option>
            </select>
          </div>
          <p className="form-section-note">{endpointStrategyDescriptions[endpointStrategy]}</p>
          {(selectedProfiles.length === 0) ? (
            <p className="select-list-empty select-list">Pick endpoints above. The first one is used first.</p>
          ) : (
            <>
              <ol className={(poolReorder['draggingID'] === null) ? 'select-list pool-list' : 'select-list pool-list reordering'} ref={poolListRef}>
                {selectedProfiles.map((profile, profileIndex): ReactElement => (
                  <li className={(poolReorder['draggingID'] === profile['id']) ? 'select-list-row reorder-dragging' : 'select-list-row'} data-reorder-id={profile['id']} key={profile['id']}>
                    <button
                      aria-describedby={reorderHintID}
                      aria-label={`Reorder ${profile['displayName']}`}
                      className="icon-button reorder-handle"
                      onKeyDown={(event): void => poolReorder.handleKeyDown(event, profile['id'], profileIndex, selectedProfiles.length, profile['displayName'])}
                      onPointerDown={(event): void => poolReorder.handlePointerDown(event, profile['id'])}
                      title="Drag to reorder"
                      type="button"
                    >
                      <Icon name="grip" size={15} />
                    </button>
                    <span className="pool-position">{profileIndex + 1}</span>
                    <span className="select-list-main">
                      <span>{profile['displayName']}</span>
                      <small className="mono">{(isWireGuard) ? `${profile['remoteHost']}:${profile['remotePort']}` : `${profile['remoteHost']}:${profile['remotePort']} · ${profile['protocol'].toUpperCase()}`}</small>
                    </span>
                    <span className="pool-actions">
                      <button aria-label={`Remove ${profile['displayName']}`} className="icon-button" onClick={(): void => toggleProfile(profile['id'])} title="Remove" type="button"><Icon name="x" size={15} /></button>
                    </span>
                  </li>
                ))}
              </ol>
              <span className="visually-hidden" id={reorderHintID}>Drag, or press the up and down arrow keys, to change the order.</span>
              <p aria-live="polite" className="visually-hidden">{poolReorder['announcement']}</p>
            </>
          )}
        </section>

        <div className="vpn-lower-grid" hidden={providerID === ''}>
          <section className="form-section">
            <div className="form-section-head"><h2>Sign-in</h2></div>
            {(credentialFields.length === 0) ? (
              <p className="form-section-note">{(isWireGuard) ? 'This file includes its own key.' : 'This profile includes its own credentials.'}</p>
            ) : (
              <div className="field-row">
                {credentialFields.map((field): ReactElement => {
                  const saved: boolean = savedCredentials.includes(field['key']);
                  const input: Web_VpnTunnels_CredentialInput = credentialInput(field, saved);
                  let description: string = field['description'];
                  if (saved) {
                    const separator: string = (description === '') ? '' : ' ';

                    description = `${description}${separator}Saved. Leave empty to keep it.`;
                  }
                  let fieldIssue: string = issueFor(fieldError, `configuration.credentials.${field['key']}`);
                  if (fieldIssue === '') {
                    fieldIssue = issueFor(fieldError, `credentials.${field['key']}`);
                  }
                  let credentialHelp: ReactElement | null = null;
                  if (fieldIssue !== '') {
                    credentialHelp = <small className="field-error">{fieldIssue}</small>;
                  } else if (description !== '') {
                    credentialHelp = <small>{description}</small>;
                  }

                  return (
                    <FieldLabel key={field['key']}>
                      <span>{field['label']}</span>
                      <input
                        {...passwordManagerIgnore}
                        aria-invalid={fieldIssue !== ''}
                        autoComplete={input['autoComplete']}
                        className={input['className']}
                        onChange={(event): void => {
                          const nextValue: string = event.currentTarget.value;
                          setCredentials((currentCredentials): Record<string, string> => ({
                            ...currentCredentials,
                            [field['key']]: nextValue,
                          }));
                        }}
                        placeholder={input['placeholder']}
                        spellCheck={false}
                        type={input['type']}
                        value={credentials[field['key']] ?? ''}
                      />
                      {credentialHelp}
                    </FieldLabel>
                  );
                })}
              </div>
            )}
          </section>

          <section className="form-section vpn-connection-section">
            <div className="form-section-head"><h2>Connection</h2></div>
            <div className="field-row">
              <FieldLabel>
                <span>Name</span>
                <input aria-invalid={nameIssue !== ''} onChange={(event): void => setName(event.currentTarget.value)} placeholder="Connection name" type="text" value={name} />
                {(nameIssue === '') ? null : <small className="field-error">{nameIssue}</small>}
              </FieldLabel>
              <FieldLabel>
                <span>Peer port</span>
                <input aria-invalid={peerPortIssue !== ''} max="65535" min="1024" onChange={(event): void => setPeerPort(event.currentTarget.value)} type="number" value={peerPort} />
                {(peerPortIssue === '') ? null : <small className="field-error">{peerPortIssue}</small>}
              </FieldLabel>
            </div>
            <div className="field">
              <span>DNS</span>
              <div className="segmented dns-choice">
                <button aria-pressed={dnsMode === 'provider'} onClick={(): void => setDNSMode('provider')} type="button">Provider&apos;s servers</button>
                <button aria-pressed={dnsMode === 'custom'} onClick={(): void => setDNSMode('custom')} type="button">Custom</button>
              </div>
              <small>{dnsHint}</small>
            </div>
            {(dnsMode === 'custom') ? (
              <FieldLabel className="field dns-custom-field">
                <span>IPv4 addresses</span>
                <textarea onChange={(event): void => setCustomDNS(event.currentTarget.value)} rows={4} value={customDNS} />
                <small>Up to 8 addresses, one per line.</small>
              </FieldLabel>
            ) : null}
            <FieldLabel>
              <span>Retry interval</span>
              <span className="input-suffix">
                <input max="600" min="3" onChange={(event): void => setRetryInterval(event.currentTarget.value)} type="number" value={retryInterval} />
                <span>seconds</span>
              </span>
              <small>From 3 to 600 seconds.</small>
            </FieldLabel>
          </section>
        </div>

        {(error === '') ? null : (
          <div className="form-error vpn-form-error" role="alert">
            <Icon name="warning" size={16} />
            {error}
          </div>
        )}

        {(changeRunning) ? (
          <p className="vpn-change-notice" role="status">
            <Icon name="activity" size={16} />
            A VPN change is running.
          </p>
        ) : null}

        <footer className={`form-actions vpn-actions${(renameOnly) ? ' vpn-actions-rename-only' : ''}`} hidden={providerID === ''}>
          {(connection === null) ? (
            <Button disabled={busyAction !== ''} onClick={onBack}>Cancel</Button>
          ) : (
            <Button
              disabled={busyAction !== '' || changeRunning}
              icon="pause"
              onClick={(): void => {
                void runConnectionAction('disconnect');
              }}
              variant="danger"
            >
              Disconnect and block
            </Button>
          )}
          <span className="form-actions-spacer" />
          {(connection === null) ? null : (
            <Button
              disabled={busyAction !== '' || changeRunning}
              icon="refresh"
              onClick={(): void => {
                void runConnectionAction('reconnect');
              }}
            >
              Reconnect
            </Button>
          )}
          {(renameOnly) ? (
            <Button disabled={busyAction !== '' || changeRunning || name.trim() === '' || providerID === '' || profileIDs.length === 0} type="submit" variant="primary">{primaryButtonLabel}</Button>
          ) : (
            <Button disabled={busyAction !== '' || changeRunning || name.trim() === '' || providerID === '' || profileIDs.length === 0} icon="shield" type="submit" variant="primary">{primaryButtonLabel}</Button>
          )}
          {(renameOnly) ? <small className="vpn-save-hint">Saves without reconnecting the VPN.</small> : null}
        </footer>
      </form>
    </section>
  );
};

/**
 * VPN connections page.
 *
 * Shows every isolated connection, opens its editor, and coordinates safe
 * dependency moves before a non-default connection is removed.
 *
 * @since UNRELEASED
 */
export const VpnView = ({
  connections: response,
  defaultProfile,
  navigationSequence,
  navigationTarget,
  onCreate,
  onDelete,
  onDisconnect,
  onMakeDefault,
  onNavigate,
  onOpenTorrents,
  onReconnect,
  onRefreshCatalog,
  onUpdate,
  onUploadProfile,
  profiles,
  providers,
  snapshot,
}: Web_Components_VpnView_Props): ReactElement => {
  const [
    selectedID,
    setSelectedID,
  ] = useState<string | 'new' | null>(null);
  const [
    removeState,
    setRemoveState,
  ] = useState<RemoveState | null>(null);
  const [
    moveTo,
    setMoveTo,
  ] = useState<string>('');
  const [
    removing,
    setRemoving,
  ] = useState<boolean>(false);
  const [
    removeError,
    setRemoveError,
  ] = useState<string>('');
  const [
    moveResults,
    setMoveResults,
  ] = useState<Web_Api_MovedTorrent[]>([]);
  const [
    removalComplete,
    setRemovalComplete,
  ] = useState<boolean>(false);
  const [
    defaultChangeState,
    setDefaultChangeState,
  ] = useState<DefaultChangeState | null>(null);
  const [
    defaultChangeBusy,
    setDefaultChangeBusy,
  ] = useState<boolean>(false);
  const [
    defaultChangeError,
    setDefaultChangeError,
  ] = useState<string>('');
  const [
    defaultMoveResults,
    setDefaultMoveResults,
  ] = useState<Web_Api_MovedTorrent[]>([]);
  const [
    defaultChangeComplete,
    setDefaultChangeComplete,
  ] = useState<boolean>(false);
  const handledNavigationSequenceRef = useRef<number>(-1);

  useEffect((): (() => void) => {
    /**
     * VPN view - Close row menus outside.
     *
     * Closes every open row menu that the press landed outside of. Native menus stay open
     * until toggled, so opening one menu also closes the one left open before it.
     *
     * @param {PointerEvent} event - Event.
     *
     * @since UNRELEASED
     */
    const closeMenusOutside = (event: PointerEvent): void => {
      document.querySelectorAll<HTMLDetailsElement>('details.vpn-row-menu[open]').forEach((menu): void => {
        if (!(event.target instanceof Node) || !menu.contains(event.target)) {
          menu.removeAttribute('open');
        }
      });
    };

    /**
     * VPN view - Close row menus on escape.
     *
     * Closes every open row menu when Escape is pressed.
     * The app's other menus close the same way.
     *
     * @param {KeyboardEvent} event - Event.
     *
     * @since UNRELEASED
     */
    const closeMenusOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        document.querySelectorAll<HTMLDetailsElement>('details.vpn-row-menu[open]').forEach((menu): void => {
          menu.removeAttribute('open');
        });
      }
    };

    document.addEventListener('pointerdown', closeMenusOutside);
    document.addEventListener('keydown', closeMenusOnEscape);

    return (): void => {
      document.removeEventListener('pointerdown', closeMenusOutside);
      document.removeEventListener('keydown', closeMenusOnEscape);
    };
  }, []);

  const connections = response?.['connections'] ?? [];
  const selectedConnection = (selectedID === null || selectedID === 'new') ? null : connections.find((connection): boolean => connection['id'] === selectedID) ?? null;
  const usedPeerPorts: Set<number> = new Set(connections.map((connection): number => connection['peerPort']));
  let defaultPeerPort: number = 51_413;
  while (usedPeerPorts.has(defaultPeerPort) && defaultPeerPort < 65_535) {
    defaultPeerPort += 1;
  }
  const capacity = response?.['capacity'];
  const atCapacity: boolean = capacity !== undefined && capacity['used'] >= capacity['limit'];
  const capacityMemoryGigabytes: number = (capacity === undefined) ? 0 : Math.round(capacity['memoryBytes'] / (1024 * 1024 * 1024));
  const capacityDescription: string = (capacity?.['source'] === 'fallback') ? `Memory availability could not be read, so up to ${capacity['limit']} connections are allowed` : `${capacityMemoryGigabytes} GB of memory and ${capacity?.['cpus'] ?? 0} ${(capacity?.['cpus'] === 1) ? 'CPU' : 'CPUs'} allow ${capacity?.['limit'] ?? 0}`;

  /**
   * VPN connections page - Open navigation target.
   *
   * Updates the editor immediately and delegates the matching browser address
   * to the app. Missing and unavailable deep targets replace instead of push.
   *
   * @param {Web_Components_VpnView_NavigationTarget} target    - Target.
   * @param {boolean}                                 [replace] - Replace.
   *
   * @since UNRELEASED
   */
  const openNavigationTarget = (
    target: Web_Components_VpnView_NavigationTarget,
    replace: boolean = false,
  ): void => {
    if (target['kind'] === 'connection') {
      setSelectedID(target['connectionID']);
    } else if (target['kind'] === 'new') {
      setSelectedID('new');
    } else {
      setSelectedID(null);
    }

    onNavigate(target, replace);

    return;
  };

  useEffect((): void => {
    if (response === null || handledNavigationSequenceRef.current === navigationSequence) {
      return;
    }

    handledNavigationSequenceRef.current = navigationSequence;
    if (navigationTarget['kind'] === 'connection') {
      const connectionExists: boolean = connections.some(
        (connection: Web_Api_VpnConnection): boolean => connection['id'] === navigationTarget['connectionID'],
      );
      if (!connectionExists) {
        openNavigationTarget({ kind: 'list' }, true);

        return;
      }

      setSelectedID(navigationTarget['connectionID']);

      return;
    }

    if (navigationTarget['kind'] === 'new') {
      if (atCapacity) {
        openNavigationTarget({ kind: 'list' }, true);

        return;
      }

      setSelectedID('new');

      return;
    }

    setSelectedID(null);
  }, [
    atCapacity,
    navigationSequence,
    navigationTarget,
    response,
  ]);

  /**
   * VPN connections page - Request remove.
   *
   * Removes an unused row immediately or opens dependency migration on conflict.
   * Other server errors stay visible through the global toast.
   *
   * @since UNRELEASED
   */
  const requestRemove = async (connection: Web_Api_VpnConnection): Promise<void> => {
    setRemoveError('');
    setMoveResults([]);
    setRemovalComplete(false);
    try {
      await onDelete(connection['id'], {});
      showToast(`${connection['name']} removed.`, true);
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError['code'] === 'connection_in_use') {
        const dependencies = parseDependencies(caughtError['details']);
        setRemoveState({
          connection,
          dependencies,
        });
        setMoveTo(connections.find((candidate): boolean => candidate['id'] !== connection['id'] && candidate['default'])?.['id'] ?? '');
        return;
      }
      showToast((caughtError instanceof Error) ? caughtError.message : 'The connection could not be removed.', false);
    }
  };

  /**
   * VPN connections page - Move and remove.
   *
   * Submits the selected destination and preserves partial results on failure.
   * The dialog stays open so failed torrents can be inspected and retried.
   *
   * @since UNRELEASED
   */
  const moveAndRemove = async (): Promise<void> => {
    if (removeState === null || moveTo === '') {
      return;
    }
    const targetConnectionName: string = connections.find(
      (connection): boolean => connection['id'] === moveTo,
    )?.['name'] ?? 'The selected connection';
    setRemoving(true);
    setRemoveError('');
    setMoveResults([]);
    try {
      const result = await onDelete(removeState['connection']['id'], { moveTo });
      setMoveResults(result['moved']);
      showToast(`${removeState['connection']['name']} removed.`, true);
      if (result['moved'].some((movedTorrent): boolean => (movedTorrent['warnings']?.length ?? 0) > 0)) {
        setRemovalComplete(true);
      } else {
        setRemoveState(null);
      }
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError['code'] === 'move_failed') {
        setMoveResults(movedTorrents(caughtError['details']));
      }
      setRemoveError(connectionBeingRemovedMessage(caughtError, targetConnectionName) ?? (
        (caughtError instanceof Error) ? caughtError.message : 'Some torrents could not be moved.'
      ));
    } finally {
      setRemoving(false);
    }
  };

  /**
   * VPN connections page - Request default change.
   *
   * Applies a move-free switch immediately and opens confirmation only when the
   * backend reports that Default-profile torrents would change daemon ownership.
   *
   * @since UNRELEASED
   */
  const requestDefaultChange = async (connectionId: string): Promise<Web_Api_MovedTorrent[]> => {
    const connection: Web_Api_VpnConnection | undefined = connections.find(
      (candidate: Web_Api_VpnConnection): boolean => candidate['id'] === connectionId,
    );
    if (connection === undefined) {
      showToast('The VPN connection could not be found.', false);

      return [];
    }

    try {
      const results: Web_Api_MovedTorrent[] = await onMakeDefault(connectionId);
      showToast(`${connection['name']} is now the default connection.`, true);

      return results;
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError['code'] === 'torrents_must_move') {
        const torrentCount: unknown = caughtError['details']['torrents'];
        const defaultProfileTorrentCount: unknown = caughtError['details']['defaultProfileTorrents'];
        const followingProfileTorrentCount: unknown = caughtError['details']['followingProfileTorrents'];
        if (
          typeof torrentCount === 'number'
          && Number.isInteger(torrentCount)
          && torrentCount > 0
          && typeof defaultProfileTorrentCount === 'number'
          && Number.isInteger(defaultProfileTorrentCount)
          && defaultProfileTorrentCount >= 0
          && typeof followingProfileTorrentCount === 'number'
          && Number.isInteger(followingProfileTorrentCount)
          && followingProfileTorrentCount >= 0
          && defaultProfileTorrentCount + followingProfileTorrentCount === torrentCount
        ) {
          setDefaultChangeState({
            connection,
            defaultProfileTorrents: defaultProfileTorrentCount,
            followingProfileTorrents: followingProfileTorrentCount,
            torrents: torrentCount,
          });
          setDefaultChangeError('');
          setDefaultMoveResults([]);
          setDefaultChangeComplete(false);

          return [];
        }
      }
      showToast((caughtError instanceof Error) ? caughtError.message : 'The default connection could not be changed.', false);

      return [];
    }
  };

  /**
   * VPN connections page - Confirm default change.
   *
   * Repeats the switch with explicit move consent and keeps every per-torrent
   * outcome visible even when one source remains unchanged after a failure.
   *
   * @since UNRELEASED
   */
  const confirmDefaultChange = async (): Promise<void> => {
    if (defaultChangeState === null) {
      return;
    }
    if (defaultChangeComplete) {
      setDefaultChangeState(null);

      return;
    }

    setDefaultChangeBusy(true);
    setDefaultChangeError('');
    try {
      const results: Web_Api_MovedTorrent[] = await onMakeDefault(
        defaultChangeState['connection']['id'],
        true,
      );
      setDefaultMoveResults(results);
      setDefaultChangeComplete(true);
      showToast(`${defaultChangeState['connection']['name']} is now the default connection.`, true);
    } catch (caughtError) {
      setDefaultChangeError((caughtError instanceof Error) ? caughtError.message : 'The default connection could not be changed.');
    } finally {
      setDefaultChangeBusy(false);
    }
  };

  /**
   * VPN connections page - Close default change.
   *
   * Clears confirmation and result state before another connection is selected.
   * A later conflict therefore always opens with a clean confirmation dialog.
   *
   * @since UNRELEASED
   */
  const closeDefaultChange = (): void => {
    setDefaultChangeState(null);
    setDefaultChangeError('');
    setDefaultMoveResults([]);
    setDefaultChangeComplete(false);
  };
  const defaultChangeHasFailures: boolean = defaultMoveResults.some(
    (result: Web_Api_MovedTorrent): boolean => result['result'] === 'failed',
  );
  let defaultChangeMessage: string = '';
  if (defaultChangeState !== null) {
    if (defaultChangeComplete) {
      defaultChangeMessage = (defaultChangeHasFailures) ? `${defaultChangeState['connection']['name']} is now the default. Failed torrents stayed on their old connection.` : `${defaultChangeState['connection']['name']} is now the default. Review each torrent move below.`;
    } else {
      defaultChangeMessage = defaultVPNMoveConfirmation(
        defaultChangeState['connection']['name'],
        defaultChangeState['torrents'],
        defaultChangeState['defaultProfileTorrents'],
        defaultChangeState['followingProfileTorrents'],
      );
    }
  }
  const defaultChangeDialog: ReactElement = (!defaultChangeComplete) ? (
    <ConfirmDialog
      busy={defaultChangeBusy}
      busyLabel="Making default and moving…"
      confirmLabel="Make default and move"
      error={defaultChangeError}
      message={defaultChangeMessage}
      onCancel={closeDefaultChange}
      onConfirm={(): void => {
        void confirmDefaultChange();
      }}
      open={defaultChangeState !== null}
      title="Make default connection"
      tone="primary"
    />
  ) : (
    <div className="dialog-backdrop" role="presentation">
      <section aria-describedby="default-change-results-message" aria-labelledby="default-change-results-title" aria-modal="true" className="dialog dialog-small" role="alertdialog">
        <div className="dialog-heading">
          <h2 id="default-change-results-title">Move results</h2>
        </div>
        <p className="dialog-message" id="default-change-results-message">{defaultChangeMessage}</p>
        <div className="torrent-move-results">
          <ul>
            {defaultMoveResults.map((result: Web_Api_MovedTorrent): ReactElement => (
              <li className={(result['result'] === 'failed') ? 'move-failed' : 'move-succeeded'} key={result['hash']}>
                <strong>{result['name']}</strong>
                <span className="move-result-copy">
                  <span className="move-result-state">{torrentMoveResultLabel(result)}</span>
                  {result['warnings']?.map((warning: string): ReactElement => <small key={`${result['hash']}-${warning}`}>{warning}</small>)}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="dialog-actions">
          <Button onClick={closeDefaultChange} variant="primary">Done</Button>
        </div>
      </section>
    </div>
  );

  if (selectedID !== null) {
    return (
      <>
        <ConnectionEditor
          connection={(selectedID === 'new') ? null : selectedConnection}
          defaultPeerPort={defaultPeerPort}
          onBack={(): void => openNavigationTarget({ kind: 'list' })}
          onCreate={onCreate}
          onDisconnect={onDisconnect}
          onMakeDefault={requestDefaultChange}
          onReconnect={onReconnect}
          onRefreshCatalog={onRefreshCatalog}
          onUpdate={onUpdate}
          onUploadProfile={onUploadProfile}
          profiles={profiles}
          providers={providers}
          snapshot={snapshot}
        />
        {defaultChangeDialog}
      </>
    );
  }

  return (
    <section className="workspace-section vpn-list-page">
      <header className="workspace-heading vpn-list-heading">
        <div>
          <h1>VPN</h1>
          <p>Each connection runs its own Transmission.</p>
        </div>
        <div className="vpn-add-control">
          <Button disabled={atCapacity} icon="add" onClick={(): void => openNavigationTarget({ kind: 'new' })} variant="primary">Add connection</Button>
          {(atCapacity) ? <small>Remove a connection before adding another.</small> : null}
        </div>
      </header>

      {(capacity === undefined) ? null : (
        <div className="vpn-capacity">
          <strong>{`${capacity['used']} of ${capacity['limit']} connections`}</strong>
          <span aria-label={capacityDescription} className="vpn-capacity-info" title={capacityDescription}>?</span>
        </div>
      )}

      {(connections.length === 0) ? <div className="vpn-connection-empty"><p>No connections yet.</p></div> : (
        <div className="vpn-connection-list">
          {connections.map((connection): ReactElement => {
            const runtime = connectionState(connection, snapshot);
            const endpoint: string = (runtime['remoteHost'] === undefined) ? '—' : `${runtime['remoteHost']}:${runtime['remotePort'] ?? ''}`;

            return (
              <article
                className="vpn-connection-row"
                key={connection['id']}
              >
                <button
                  aria-label={`Open ${connection['name']}`}
                  className="vpn-row-open-button"
                  onClick={(): void => openNavigationTarget({
                    connectionID: connection['id'],
                    kind: 'connection',
                  })}
                  type="button"
                />
                <div className="vpn-connection-identity">
                  <span className="vpn-title-line">
                    <strong>{connection['name']}</strong>
                    {(connection['default']) ? <span className="tag vpn-default-tag">Default</span> : null}
                  </span>
                  <span>{`${providers.find((provider): boolean => provider['id'] === connection['providerId'])?.['displayName'] ?? connection['providerId']} · ${tunnelLabel(connection['tunnel'])}`}</span>
                  {(connection['default']) ? <small className="vpn-default-note">{`${defaultProfile['name']} torrents and tracker lookups use this connection.`}</small> : null}
                </div>
                <div className="vpn-row-status">
                  <span className={`state-chip ${statusTone(runtime['state'])}`}>
                    <span className={`status-dot status-${statusTone(runtime['state'])}`} />
                    {stateLabels[runtime['state']] ?? runtime['state']}
                  </span>
                  {(statusReason(runtime) !== '') ? <small>{statusReason(runtime)}</small> : null}
                </div>
                <div className="vpn-row-endpoint">
                  <span>Current endpoint</span>
                  <code title={endpoint}>{endpoint}</code>
                  <small>{`Peer port ${connection['peerPort']}`}</small>
                </div>
                <button
                  className="vpn-torrent-link"
                  onClick={(): void => onOpenTorrents(connection['id'])}
                  type="button"
                >
                  {`${connection['torrentCount']} ${(connection['torrentCount'] === 1) ? 'torrent' : 'torrents'}`}
                </button>
                <details className="vpn-row-menu">
                  <summary aria-label={`Actions for ${connection['name']}`} className="icon-button"><Icon name="more" size={18} /></summary>
                  <div className="menu">
                    <button
                      onClick={(): void => openNavigationTarget({
                        connectionID: connection['id'],
                        kind: 'connection',
                      })}
                      type="button"
                    >
                      Open
                    </button>
                    <button
                      disabled={connection['default']}
                      onClick={(event): void => {
                        event.currentTarget.closest('details')?.removeAttribute('open');
                        void requestDefaultChange(connection['id']);
                      }}
                      type="button"
                    >
                      Make default
                    </button>
                    {(connection['default']) ? null : (
                      <button
                        className="menu-danger"
                        onClick={(event): void => {
                          event.currentTarget.closest('details')?.removeAttribute('open');
                          void requestRemove(connection);
                        }}
                        type="button"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      )}

      {(removeState === null) ? null : (
        <div className="dialog-backdrop" role="presentation">
          <section aria-labelledby="remove-vpn-title" aria-modal="true" className="dialog remove-vpn-dialog" role="alertdialog">
            <div className="dialog-heading">
              <h2 id="remove-vpn-title">{(removalComplete) ? `${removeState['connection']['name']} removed` : `Remove ${removeState['connection']['name']}?`}</h2>
              <button aria-label="Close" className="icon-button" disabled={removing} onClick={(): void => setRemoveState(null)} type="button"><Icon name="x" /></button>
            </div>
            {(removalComplete) ? <p className="dialog-message">Review the warnings from torrents that still moved successfully.</p> : (
              <>
                <p className="dialog-message">This connection is used by:</p>
                <ul className="remove-vpn-dependencies">
                  {(removeState['dependencies']['torrents'] === 0) ? null : <li><strong>{`${removeState['dependencies']['torrents']} ${(removeState['dependencies']['torrents'] === 1) ? 'torrent' : 'torrents'}`}</strong></li>}
                  {(removeState['dependencies']['profiles'].length === 0) ? null : (
                    <li>
                      <strong>{`${removeState['dependencies']['profiles'].length} ${(removeState['dependencies']['profiles'].length === 1) ? 'profile' : 'profiles'}:`}</strong>
                      {` ${removeState['dependencies']['profiles'].map((profile): string => profile['name']).join(', ')}`}
                    </li>
                  )}
                  {(removeState['dependencies']['logins'].length === 0) ? null : (
                    <li>
                      <strong>{`${removeState['dependencies']['logins'].length} web proxy ${(removeState['dependencies']['logins'].length === 1) ? 'login' : 'logins'}:`}</strong>
                      {` ${removeState['dependencies']['logins'].map((login): string => login['username']).join(', ')}`}
                    </li>
                  )}
                </ul>
                <FieldLabel>
                  <span>Move them to</span>
                  <select disabled={removing} onChange={(event): void => setMoveTo(event.currentTarget.value)} value={moveTo}>{connections.filter((connection): boolean => connection['id'] !== removeState['connection']['id']).map((connection): ReactElement => <option key={connection['id']} value={connection['id']}>{(connection['default']) ? `Default (${connection['name']})` : connection['name']}</option>)}</select>
                  <small>Torrents keep their files. Each one is checked after it moves.</small>
                </FieldLabel>
              </>
            )}
            {(removing) ? (
              <div aria-live="polite" className="vpn-remove-progress">
                <span className="spinner" />
                Moving torrents and removing connection…
              </div>
            ) : null}
            {(moveResults.length === 0) ? null : (
              <div className="torrent-move-results">
                <h3>Move results</h3>
                <ul>
                  {moveResults.map((result): ReactElement => (
                    <li className={(result['result'] === 'failed') ? 'move-failed' : 'move-succeeded'} key={result['hash']}>
                      <strong>{result['name']}</strong>
                      <span className="move-result-copy">
                        <span className="move-result-state">{(result['result'] === 'moved') ? 'Moved' : result['error'] ?? 'Failed'}</span>
                        {(result['result'] !== 'moved') ? null : result['warnings']?.map((warning): ReactElement => <small key={warning}>{warning}</small>)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(removeError === '') ? null : (
              <div className="form-error" role="alert">
                <Icon name="warning" size={16} />
                {removeError}
              </div>
            )}
            <div className="dialog-actions">
              {(removalComplete) ? (
                <Button onClick={(): void => setRemoveState(null)} variant="primary">Done</Button>
              ) : (
                <>
                  <Button disabled={removing} onClick={(): void => setRemoveState(null)}>Cancel</Button>
                  <Button
                    disabled={removing || moveTo === ''}
                    onClick={(): void => {
                      void moveAndRemove();
                    }}
                    variant="danger"
                  >
                    {(removing) ? 'Moving…' : 'Move and remove'}
                  </Button>
                </>
              )}
            </div>
          </section>
        </div>
      )}
      {defaultChangeDialog}
    </section>
  );
};
