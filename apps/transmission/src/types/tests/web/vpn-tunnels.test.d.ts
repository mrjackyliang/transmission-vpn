import type {
  Web_Api_Provider,
  Web_Api_ProviderCredentialField,
  Web_Api_ProviderTunnel,
  Web_Api_VpnConnectionRuntime,
  Web_Api_VpnTunnel,
} from '@/types/web/api.d.ts';

/**
 * Vpn Tunnels.
 *
 * @since 2.4.1
 */
export type Tests_Web_VpnTunnels_Field_Key = string;
export type Tests_Web_VpnTunnels_Field_Kind = Web_Api_ProviderCredentialField['kind'];
export type Tests_Web_VpnTunnels_Field_Secret = boolean;
export type Tests_Web_VpnTunnels_Field_Returns = Web_Api_ProviderCredentialField;

/**
 * Vpn Tunnels.
 *
 * @since 2.4.1
 */
export type Tests_Web_VpnTunnels_OpenVPN = Web_Api_ProviderTunnel;

/**
 * Vpn Tunnels.
 *
 * @since 2.4.1
 */
export type Tests_Web_VpnTunnels_Provider_Tunnels = Web_Api_ProviderTunnel[];
export type Tests_Web_VpnTunnels_Provider_Returns = Web_Api_Provider;

/**
 * Vpn Tunnels.
 *
 * @since 2.4.1
 */
export type Tests_Web_VpnTunnels_Runtime_TunnelID = Web_Api_VpnTunnel;
export type Tests_Web_VpnTunnels_Runtime_Implementation = 'kernel' | 'userspace';
export type Tests_Web_VpnTunnels_Runtime_Returns = Web_Api_VpnConnectionRuntime;

/**
 * Vpn Tunnels.
 *
 * @since 2.4.1
 */
export type Tests_Web_VpnTunnels_Tunnel_Id = Web_Api_ProviderTunnel['id'];
export type Tests_Web_VpnTunnels_Tunnel_CredentialFields = Web_Api_ProviderCredentialField[];
export type Tests_Web_VpnTunnels_Tunnel_Returns = Web_Api_ProviderTunnel;

/**
 * Vpn Tunnels.
 *
 * @since 2.4.1
 */
export type Tests_Web_VpnTunnels_VpnTunnels_BothTunnels = Web_Api_ProviderTunnel | undefined;
export type Tests_Web_VpnTunnels_VpnTunnels_PreferredWireGuard = Web_Api_ProviderTunnel | undefined;
export type Tests_Web_VpnTunnels_VpnTunnels_OnlyWireGuard = Web_Api_ProviderTunnel | undefined;
export type Tests_Web_VpnTunnels_VpnTunnels_Typed = Record<string, string>;
export type Tests_Web_VpnTunnels_VpnTunnels_Now = number;

/**
 * Vpn Tunnels.
 *
 * @since 2.4.1
 */
export type Tests_Web_VpnTunnels_WireGuard = Web_Api_ProviderTunnel;
