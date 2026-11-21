import {
  describe,
  expect,
  it,
} from 'vitest';

import { formatElapsed } from '../src/web/torrent-format.ts';
import {
  credentialInput,
  describeTunnel,
  keptCredentials,
  pickTunnel,
  profileFile,
  shouldInitializeConnectionEditor,
  submittedCredentials,
} from '../src/web/vpn-tunnels.ts';

import type {
  Tests_Web_VpnTunnels_Field_Key,
  Tests_Web_VpnTunnels_Field_Kind,
  Tests_Web_VpnTunnels_Field_Returns,
  Tests_Web_VpnTunnels_Field_Secret,
  Tests_Web_VpnTunnels_OpenVPN,
  Tests_Web_VpnTunnels_Provider_Returns,
  Tests_Web_VpnTunnels_Provider_Tunnels,
  Tests_Web_VpnTunnels_Runtime_Implementation,
  Tests_Web_VpnTunnels_Runtime_Returns,
  Tests_Web_VpnTunnels_Runtime_TunnelID,
  Tests_Web_VpnTunnels_Tunnel_CredentialFields,
  Tests_Web_VpnTunnels_Tunnel_Id,
  Tests_Web_VpnTunnels_Tunnel_Returns,
  Tests_Web_VpnTunnels_VpnTunnels_BothTunnels,
  Tests_Web_VpnTunnels_VpnTunnels_Now,
  Tests_Web_VpnTunnels_VpnTunnels_OnlyWireGuard,
  Tests_Web_VpnTunnels_VpnTunnels_PreferredWireGuard,
  Tests_Web_VpnTunnels_VpnTunnels_Typed,
  Tests_Web_VpnTunnels_WireGuard,
} from '../src/types/tests/web/vpn-tunnels.test.d.ts';

const field = (key: Tests_Web_VpnTunnels_Field_Key, kind: Tests_Web_VpnTunnels_Field_Kind, secret: Tests_Web_VpnTunnels_Field_Secret): Tests_Web_VpnTunnels_Field_Returns => ({
  description: '',
  key,
  kind,
  label: key,
  required: false,
  secret,
});

const tunnel = (id: Tests_Web_VpnTunnels_Tunnel_Id, credentialFields: Tests_Web_VpnTunnels_Tunnel_CredentialFields): Tests_Web_VpnTunnels_Tunnel_Returns => ({
  catalogSource: 'upload',
  credentialFields,
  description: '',
  id,
  supportsCatalogRefresh: false,
  supportsProfileUpload: true,
});

const provider = (tunnels: Tests_Web_VpnTunnels_Provider_Tunnels): Tests_Web_VpnTunnels_Provider_Returns => ({
  description: '',
  displayName: 'Test',
  id: 'test',
  p2p: null,
  supportsPortForwarding: false,
  tunnels,
});

const runtime = (
  tunnelID: Tests_Web_VpnTunnels_Runtime_TunnelID,
  implementation?: Tests_Web_VpnTunnels_Runtime_Implementation,
): Tests_Web_VpnTunnels_Runtime_Returns => ({
  address: '10.64.0.2',
  attempt: 1,
  endpointCount: 1,
  endpointPosition: 1,
  endpointStrategy: 'sticky',
  interface: 'tun0',
  lastError: '',
  profileId: 'profile',
  providerId: 'provider',
  remoteHost: 'vpn.example.com',
  remotePort: 1194,
  state: 'protected',
  transitionedAt: '2026-11-03T12:00:00Z',
  tunnel: tunnelID,
  ...((implementation === undefined) ? {} : { implementation }),
});

const openVPN: Tests_Web_VpnTunnels_OpenVPN = tunnel('openvpn', [
  field('username', 'text', false),
  field('password', 'password', true),
]);
const wireGuard: Tests_Web_VpnTunnels_WireGuard = tunnel('wireguard', [
  field('privateKey', 'wireguard-key', true),
  field('address', 'ipv4-address', false),
]);

describe('VPN tunnels', () => {
  it('opens providers with both tunnels on OpenVPN unless another is preferred', () => {
    const bothTunnels: Tests_Web_VpnTunnels_VpnTunnels_BothTunnels = pickTunnel(provider([
      wireGuard,
      openVPN,
    ]), undefined);
    const preferredWireGuard: Tests_Web_VpnTunnels_VpnTunnels_PreferredWireGuard = pickTunnel(provider([
      openVPN,
      wireGuard,
    ]), 'wireguard');
    const onlyWireGuard: Tests_Web_VpnTunnels_VpnTunnels_OnlyWireGuard = pickTunnel(provider([wireGuard]), 'openvpn');

    expect((bothTunnels === undefined) ? undefined : bothTunnels['id']).toBe('openvpn');

    expect((preferredWireGuard === undefined) ? undefined : preferredWireGuard['id']).toBe('wireguard');

    expect((onlyWireGuard === undefined) ? undefined : onlyWireGuard['id']).toBe('wireguard');

    expect(pickTunnel(undefined, 'openvpn')).toBeUndefined();

    return;
  });

  it('initializes a new-connection editor once while provider data refreshes', () => {
    expect(shouldInitializeConnectionEditor(null, 'new', false)).toBe(false);

    expect(shouldInitializeConnectionEditor(null, 'new', true)).toBe(true);

    expect(shouldInitializeConnectionEditor('new', 'new', true)).toBe(false);

    expect(shouldInitializeConnectionEditor('new', 'vpc-0000000000000001', true)).toBe(true);

    return;
  });

  it('names the tunnel and its WireGuard engine for the status card', () => {
    expect(describeTunnel(undefined)).toBe('—');

    expect(describeTunnel(runtime('openvpn'))).toBe('OpenVPN');

    expect(describeTunnel(runtime('wireguard', 'userspace'))).toBe('WireGuard (userspace)');

    return;
  });

  it('sends only the filled fields of the chosen tunnel and keeps no secret afterward', () => {
    const typed: Tests_Web_VpnTunnels_VpnTunnels_Typed = {
      address: '10.68.12.34/32',
      password: 'left over from OpenVPN',
      privateKey: 'yAnz5TF+lXXJte14tji3zlMNq+hd2rYUIgJBgB3fBmk=',
      username: '   ',
    };

    expect(submittedCredentials(wireGuard['credentialFields'], typed)).toStrictEqual({
      address: '10.68.12.34/32',
      privateKey: 'yAnz5TF+lXXJte14tji3zlMNq+hd2rYUIgJBgB3fBmk=',
    });

    expect(submittedCredentials(openVPN['credentialFields'], typed)).toStrictEqual({
      password: 'left over from OpenVPN',
    });

    expect(submittedCredentials(openVPN['credentialFields'], {
      password: '',
      username: '',
    })).toStrictEqual({});

    expect(keptCredentials(wireGuard['credentialFields'], typed)).toStrictEqual({
      address: '10.68.12.34/32',
    });

    return;
  });

  it('masks keys in monospace, gives addresses an example, and never asks for a browser password', () => {
    expect(credentialInput(field('privateKey', 'wireguard-key', true))).toStrictEqual({
      autoComplete: 'off',
      className: 'monospace key-input',
      placeholder: undefined,
      type: 'password',
    });

    expect(credentialInput(field('address', 'ipv4-address', false))['placeholder']).toBe('e.g. 10.68.12.34/32');

    expect(credentialInput(field('password', 'password', true))['autoComplete']).toBe('off');

    expect(credentialInput(field('password', 'password', true), true)['placeholder']).toBe('••••••••');

    expect(credentialInput(field('privateKey', 'wireguard-key', true), true)['placeholder']).toBe('••••••••');

    expect(profileFile('wireguard')['accept']).toBe('.conf');

    expect(profileFile('openvpn')['prompt']).toBe('Choose an .ovpn file');

    return;
  });

  it('counts a recent handshake in seconds', () => {
    const now: Tests_Web_VpnTunnels_VpnTunnels_Now = Date.parse('2026-11-03T12:00:42Z');

    expect(formatElapsed('2026-11-03T12:00:00Z', now)).toBe('42 seconds ago');

    expect(formatElapsed('2026-11-03T11:58:42Z', now)).toBe('2 minutes ago');

    expect(formatElapsed(undefined, now)).toBe('never');

    return;
  });

  return;
});
