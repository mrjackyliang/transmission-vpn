import type {
  Web_Api_Provider,
  Web_Api_ProviderCredentialField,
  Web_Api_ProviderTunnel,
  Web_Api_VpnRuntime,
  Web_Api_VpnTunnel,
} from '@/types/web/api.d.ts';
import type {
  Web_VpnTunnels_CredentialInput,
  Web_VpnTunnels_ProfileFile,
} from '@/types/web/vpn-tunnels.d.ts';

/**
 * VPN Tunnels - Tunnel labels.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const tunnelLabels: Record<Web_Api_VpnTunnel, string> = {
  openvpn: 'OpenVPN',
  wireguard: 'WireGuard',
};

/**
 * VPN Tunnels - Should initialize connection editor.
 *
 * Initializes one editor session after its provider data is available. Refreshing
 * that data keeps the in-progress draft, while opening another connection starts a
 * fresh session.
 *
 * @since UNRELEASED
 */
export const shouldInitializeConnectionEditor = (
  initializedSessionID: string | null,
  sessionID: string,
  providersAvailable: boolean,
): boolean => providersAvailable && initializedSessionID !== sessionID;

/**
 * VPN Tunnels - Tunnel label.
 *
 * Names a tunnel for the interface. An unknown value reads as OpenVPN, the tunnel every
 * configuration saved before WireGuard used.
 *
 * @since 2.0.0
 */
export const tunnelLabel = (tunnel: string | undefined): string => (
  (tunnel === 'wireguard') ? tunnelLabels['wireguard'] : tunnelLabels['openvpn']
);

/**
 * VPN Tunnels - Pick tunnel.
 *
 * Returns the preferred tunnel when the provider offers it, then OpenVPN, then the
 * provider's only tunnel, so providers with both open on OpenVPN.
 *
 * @since 2.0.0
 */
export const pickTunnel = (
  provider: Web_Api_Provider | undefined,
  preferred: Web_Api_VpnTunnel | undefined,
): Web_Api_ProviderTunnel | undefined => {
  if (provider === undefined) {
    return undefined;
  }

  return provider['tunnels'].find((tunnel: Web_Api_ProviderTunnel): boolean => tunnel['id'] === preferred)
    ?? provider['tunnels'].find((tunnel: Web_Api_ProviderTunnel): boolean => tunnel['id'] === 'openvpn')
    ?? provider['tunnels'][0];
};

/**
 * VPN Tunnels - Describe tunnel.
 *
 * Reads the status card's Tunnel value, adding the WireGuard engine once the controller
 * reports it.
 *
 * @since 2.0.0
 */
export const describeTunnel = (status: Web_Api_VpnRuntime | undefined): string => {
  if (status?.tunnel === undefined) {
    return '—';
  }

  const label: string = tunnelLabel(status['tunnel']);
  if (status['implementation'] === undefined) {
    return label;
  }

  return `${label} (${status['implementation']})`;
};

/**
 * VPN Tunnels - Submitted credentials.
 *
 * Keeps only the tunnel's own fields that were filled in, so a key typed for another
 * tunnel or provider is never sent.
 *
 * @since 2.0.0
 */
export const submittedCredentials = (
  fields: Web_Api_ProviderCredentialField[],
  values: Record<string, string>,
): Record<string, string> => Object.fromEntries(
  fields
    .map((field: Web_Api_ProviderCredentialField): [string, string] => [
      field['key'],
      values[field['key']] ?? '',
    ])
    .filter((entry: [string, string]): boolean => entry[1].trim() !== ''),
);

/**
 * VPN Tunnels - Kept credentials.
 *
 * Drops secret values after a connection attempt and keeps the rest, such as a username
 * or a tunnel address, for the next attempt.
 *
 * @since 2.0.0
 */
export const keptCredentials = (
  fields: Web_Api_ProviderCredentialField[],
  values: Record<string, string>,
): Record<string, string> => Object.fromEntries(
  Object.entries(values).filter((entry: [string, string]): boolean => fields.some(
    (field: Web_Api_ProviderCredentialField): boolean => field['key'] === entry[0] && !field['secret'],
  )),
);

/**
 * VPN Tunnels - Credential input.
 *
 * Chooses how a sign-in field is typed and shown: keys and addresses are monospace,
 * secrets are masked, and no field is the browser's to fill or to suggest a password for.
 *
 * @since 2.0.0
 */
export const credentialInput = (
  field: Web_Api_ProviderCredentialField,
  saved: boolean = false,
): Web_VpnTunnels_CredentialInput => {
  switch (field['kind']) {
    case 'wireguard-key': {
      return {
        autoComplete: 'off',
        className: 'monospace key-input',
        placeholder: (saved) ? '••••••••' : undefined,
        type: 'password',
      };
    }
    case 'ipv4-address': {
      return {
        autoComplete: 'off',
        className: 'monospace',
        placeholder: 'e.g. 10.68.12.34/32',
        type: 'text',
      };
    }
    case 'password': {
      return {
        autoComplete: 'off',
        className: undefined,
        placeholder: (saved) ? '••••••••' : undefined,
        type: 'password',
      };
    }
    default: {
      return {
        autoComplete: 'off',
        className: undefined,
        placeholder: undefined,
        type: (field['secret']) ? 'password' : 'text',
      };
    }
  }
};

/**
 * VPN Tunnels - Profile file.
 *
 * Describes the custom upload for a tunnel: what the file picker accepts and how the
 * file is named in prompts.
 *
 * @since 2.0.0
 */
export const profileFile = (tunnel: Web_Api_VpnTunnel): Web_VpnTunnels_ProfileFile => {
  if (tunnel === 'wireguard') {
    return {
      accept: '.conf',
      label: 'WireGuard file',
      prompt: 'Choose a .conf file',
    };
  }

  return {
    accept: '.ovpn,application/x-openvpn-profile',
    label: 'OpenVPN profile',
    prompt: 'Choose an .ovpn file',
  };
};
