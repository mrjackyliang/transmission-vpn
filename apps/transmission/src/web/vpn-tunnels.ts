import type {
  Web_VpnTunnels_CredentialInput_Field,
  Web_VpnTunnels_CredentialInput_Returns,
  Web_VpnTunnels_CredentialInput_Saved,
  Web_VpnTunnels_DescribeTunnel_Label,
  Web_VpnTunnels_DescribeTunnel_Returns,
  Web_VpnTunnels_DescribeTunnel_Status,
  Web_VpnTunnels_KeptCredentials_Fields,
  Web_VpnTunnels_KeptCredentials_Returns,
  Web_VpnTunnels_KeptCredentials_Values,
  Web_VpnTunnels_PickTunnel_Preferred,
  Web_VpnTunnels_PickTunnel_Provider,
  Web_VpnTunnels_PickTunnel_Returns,
  Web_VpnTunnels_ProfileFile_Returns,
  Web_VpnTunnels_ProfileFile_Tunnel,
  Web_VpnTunnels_ShouldInitializeConnectionEditor_InitializedSessionID,
  Web_VpnTunnels_ShouldInitializeConnectionEditor_ProvidersAvailable,
  Web_VpnTunnels_ShouldInitializeConnectionEditor_Returns,
  Web_VpnTunnels_ShouldInitializeConnectionEditor_SessionID,
  Web_VpnTunnels_SubmittedCredentials_Entries,
  Web_VpnTunnels_SubmittedCredentials_Fields,
  Web_VpnTunnels_SubmittedCredentials_Returns,
  Web_VpnTunnels_SubmittedCredentials_Values,
  Web_VpnTunnels_TunnelLabel_Returns,
  Web_VpnTunnels_TunnelLabel_Tunnel,
  Web_VpnTunnels_TunnelLabels,
} from '@/types/web/vpn-tunnels.d.ts';

/**
 * Vpn Tunnels - Tunnel Labels.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const tunnelLabels: Web_VpnTunnels_TunnelLabels = {
  openvpn: 'OpenVPN',
  wireguard: 'WireGuard',
};

/**
 * Vpn Tunnels - Should Initialize Connection Editor.
 *
 * Initializes one editor session after its provider data is available. Refreshing
 * that data keeps the in-progress draft, while opening another connection starts a
 * fresh session.
 *
 * @param {Web_VpnTunnels_ShouldInitializeConnectionEditor_InitializedSessionID} initializedSessionID - Initialized session i d.
 * @param {Web_VpnTunnels_ShouldInitializeConnectionEditor_SessionID}            sessionID            - Session i d.
 * @param {Web_VpnTunnels_ShouldInitializeConnectionEditor_ProvidersAvailable}   providersAvailable   - Providers available.
 *
 * @returns {Web_VpnTunnels_ShouldInitializeConnectionEditor_Returns}
 *
 * @since 2.0.0
 */
export const shouldInitializeConnectionEditor = (
  initializedSessionID: Web_VpnTunnels_ShouldInitializeConnectionEditor_InitializedSessionID,
  sessionID: Web_VpnTunnels_ShouldInitializeConnectionEditor_SessionID,
  providersAvailable: Web_VpnTunnels_ShouldInitializeConnectionEditor_ProvidersAvailable,
): Web_VpnTunnels_ShouldInitializeConnectionEditor_Returns => providersAvailable && initializedSessionID !== sessionID;

/**
 * Vpn Tunnels - Tunnel Label.
 *
 * Names a tunnel for the interface. An unknown value reads as OpenVPN, the tunnel every
 * configuration saved before WireGuard used.
 *
 * @param {Web_VpnTunnels_TunnelLabel_Tunnel} tunnel - Tunnel.
 *
 * @returns {Web_VpnTunnels_TunnelLabel_Returns}
 *
 * @since 2.0.0
 */
export const tunnelLabel = (tunnel: Web_VpnTunnels_TunnelLabel_Tunnel): Web_VpnTunnels_TunnelLabel_Returns => (
  (tunnel === 'wireguard') ? tunnelLabels['wireguard'] : tunnelLabels['openvpn']
);

/**
 * Vpn Tunnels - Pick Tunnel.
 *
 * Returns the preferred tunnel when the provider offers it, then OpenVPN, then the
 * provider's only tunnel, so providers with both open on OpenVPN.
 *
 * @param {Web_VpnTunnels_PickTunnel_Provider}  provider  - Provider.
 * @param {Web_VpnTunnels_PickTunnel_Preferred} preferred - Preferred.
 *
 * @returns {Web_VpnTunnels_PickTunnel_Returns}
 *
 * @since 2.0.0
 */
export const pickTunnel = (
  provider: Web_VpnTunnels_PickTunnel_Provider,
  preferred: Web_VpnTunnels_PickTunnel_Preferred,
): Web_VpnTunnels_PickTunnel_Returns => {
  if (provider === undefined) {
    return undefined;
  }

  return provider['tunnels'].find((tunnel) => tunnel['id'] === preferred)
    ?? provider['tunnels'].find((tunnel) => tunnel['id'] === 'openvpn')
    ?? provider['tunnels'][0];
};

/**
 * Vpn Tunnels - Describe Tunnel.
 *
 * Reads the status card's Tunnel value, adding the WireGuard engine once the controller
 * reports it.
 *
 * @param {Web_VpnTunnels_DescribeTunnel_Status} status - Status.
 *
 * @returns {Web_VpnTunnels_DescribeTunnel_Returns}
 *
 * @since 2.0.0
 */
export const describeTunnel = (status: Web_VpnTunnels_DescribeTunnel_Status): Web_VpnTunnels_DescribeTunnel_Returns => {
  if (status === undefined || status['tunnel'] === undefined) {
    return '—';
  }

  const label: Web_VpnTunnels_DescribeTunnel_Label = tunnelLabel(status['tunnel']);

  if (status['implementation'] === undefined) {
    return label;
  }

  return `${label} (${status['implementation']})`;
};

/**
 * Vpn Tunnels - Submitted Credentials.
 *
 * Keeps only the tunnel's own fields that were filled in, so a key typed for another
 * tunnel or provider is never sent.
 *
 * @param {Web_VpnTunnels_SubmittedCredentials_Fields} fields - Fields.
 * @param {Web_VpnTunnels_SubmittedCredentials_Values} values - Values.
 *
 * @returns {Web_VpnTunnels_SubmittedCredentials_Returns}
 *
 * @since 2.0.0
 */
export const submittedCredentials = (
  fields: Web_VpnTunnels_SubmittedCredentials_Fields,
  values: Web_VpnTunnels_SubmittedCredentials_Values,
): Web_VpnTunnels_SubmittedCredentials_Returns => {
  const entries: Web_VpnTunnels_SubmittedCredentials_Entries = fields.map((field) => [
    field['key'],
    values[field['key']] ?? '',
  ]);

  return Object.fromEntries(
    entries.filter((entry) => entry[1].trim() !== ''),
  );
};

/**
 * Vpn Tunnels - Kept Credentials.
 *
 * Drops secret values after a connection attempt and keeps the rest, such as a username
 * or a tunnel address, for the next attempt.
 *
 * @param {Web_VpnTunnels_KeptCredentials_Fields} fields - Fields.
 * @param {Web_VpnTunnels_KeptCredentials_Values} values - Values.
 *
 * @returns {Web_VpnTunnels_KeptCredentials_Returns}
 *
 * @since 2.0.0
 */
export const keptCredentials = (
  fields: Web_VpnTunnels_KeptCredentials_Fields,
  values: Web_VpnTunnels_KeptCredentials_Values,
): Web_VpnTunnels_KeptCredentials_Returns => Object.fromEntries(
  Object.entries(values).filter((entry) => fields.some(
    (field) => field['key'] === entry[0] && field['secret'] === false,
  )),
);

/**
 * Vpn Tunnels - Credential Input.
 *
 * Chooses how a sign-in field is typed and shown: keys and addresses are monospace,
 * secrets are masked, and no field is the browser's to fill or to suggest a password for.
 *
 * @param {Web_VpnTunnels_CredentialInput_Field} field   - Field.
 * @param {Web_VpnTunnels_CredentialInput_Saved} [saved] - Saved.
 *
 * @returns {Web_VpnTunnels_CredentialInput_Returns}
 *
 * @since 2.0.0
 */
export const credentialInput = (
  field: Web_VpnTunnels_CredentialInput_Field,
  saved: Web_VpnTunnels_CredentialInput_Saved = false,
): Web_VpnTunnels_CredentialInput_Returns => {
  switch (field['kind']) {
    case 'wireguard-key': {
      return {
        autoComplete: 'off',
        className: 'monospace key-input',
        placeholder: (saved === true) ? '••••••••' : undefined,
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
        placeholder: (saved === true) ? '••••••••' : undefined,
        type: 'password',
      };
    }

    default: {
      return {
        autoComplete: 'off',
        className: undefined,
        placeholder: undefined,
        type: (field['secret'] === true) ? 'password' : 'text',
      };
    }
  }
};

/**
 * Vpn Tunnels - Profile File.
 *
 * Describes the custom upload for a tunnel: what the file picker accepts and how the
 * file is named in prompts.
 *
 * @param {Web_VpnTunnels_ProfileFile_Tunnel} tunnel - Tunnel.
 *
 * @returns {Web_VpnTunnels_ProfileFile_Returns}
 *
 * @since 2.0.0
 */
export const profileFile = (tunnel: Web_VpnTunnels_ProfileFile_Tunnel): Web_VpnTunnels_ProfileFile_Returns => {
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
