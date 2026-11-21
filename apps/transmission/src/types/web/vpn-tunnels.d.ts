import type {
  Web_Api_Provider,
  Web_Api_ProviderCredentialField,
  Web_Api_ProviderTunnel,
  Web_Api_VpnRuntime,
  Web_Api_VpnTunnel,
} from '@/types/web/api.d.ts';

/**
 * Vpn Tunnels.
 *
 * @since 2.0.0
 */
export type Web_VpnTunnels_CredentialInput = {
  autoComplete: string;
  className: string | undefined;
  placeholder: string | undefined;
  type: 'password' | 'text';
};

/**
 * Vpn Tunnels.
 *
 * @since 2.4.1
 */
export type Web_VpnTunnels_CredentialInput_Field = Web_Api_ProviderCredentialField;
export type Web_VpnTunnels_CredentialInput_Saved = boolean;
export type Web_VpnTunnels_CredentialInput_Returns = Web_VpnTunnels_CredentialInput;

/**
 * Vpn Tunnels.
 *
 * @since 2.4.1
 */
export type Web_VpnTunnels_DescribeTunnel_Status = Web_Api_VpnRuntime | undefined;
export type Web_VpnTunnels_DescribeTunnel_Returns = string;
export type Web_VpnTunnels_DescribeTunnel_Label = string;

/**
 * Vpn Tunnels.
 *
 * @since 2.4.1
 */
export type Web_VpnTunnels_KeptCredentials_Fields = Web_Api_ProviderCredentialField[];
export type Web_VpnTunnels_KeptCredentials_Values = Record<string, string>;
export type Web_VpnTunnels_KeptCredentials_Returns = Record<string, string>;

/**
 * Vpn Tunnels.
 *
 * @since 2.4.1
 */
export type Web_VpnTunnels_PickTunnel_Provider = Web_Api_Provider | undefined;
export type Web_VpnTunnels_PickTunnel_Preferred = Web_Api_VpnTunnel | undefined;
export type Web_VpnTunnels_PickTunnel_Returns = Web_Api_ProviderTunnel | undefined;

/**
 * Vpn Tunnels.
 *
 * @since 2.0.0
 */
export type Web_VpnTunnels_ProfileFile = {
  accept: string;
  label: string;
  prompt: string;
};

/**
 * Vpn Tunnels.
 *
 * @since 2.4.1
 */
export type Web_VpnTunnels_ProfileFile_Tunnel = Web_Api_VpnTunnel;
export type Web_VpnTunnels_ProfileFile_Returns = Web_VpnTunnels_ProfileFile;

/**
 * Vpn Tunnels.
 *
 * @since 2.4.1
 */
export type Web_VpnTunnels_ShouldInitializeConnectionEditor_InitializedSessionID = string | null;
export type Web_VpnTunnels_ShouldInitializeConnectionEditor_SessionID = string;
export type Web_VpnTunnels_ShouldInitializeConnectionEditor_ProvidersAvailable = boolean;
export type Web_VpnTunnels_ShouldInitializeConnectionEditor_Returns = boolean;

/**
 * Vpn Tunnels.
 *
 * @since 2.4.1
 */
export type Web_VpnTunnels_SubmittedCredentials_Fields = Web_Api_ProviderCredentialField[];
export type Web_VpnTunnels_SubmittedCredentials_Values = Record<string, string>;
export type Web_VpnTunnels_SubmittedCredentials_Returns = Record<string, string>;
export type Web_VpnTunnels_SubmittedCredentials_Entry = [string, string];
export type Web_VpnTunnels_SubmittedCredentials_Entries = Web_VpnTunnels_SubmittedCredentials_Entry[];

/**
 * Vpn Tunnels.
 *
 * @since 2.4.1
 */
export type Web_VpnTunnels_TunnelLabel_Tunnel = string | undefined;
export type Web_VpnTunnels_TunnelLabel_Returns = string;

/**
 * Vpn Tunnels.
 *
 * @since 2.4.1
 */
export type Web_VpnTunnels_TunnelLabels = Record<Web_Api_VpnTunnel, string>;
