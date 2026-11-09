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
  Web_Api_Provider,
  Web_Api_ProviderCredentialField,
  Web_Api_ProviderTunnel,
  Web_Api_VpnConnectionRuntime,
  Web_Api_VpnTunnel,
} from '../src/types/web/api.d.ts';

const field = (key: string, kind: Web_Api_ProviderCredentialField['kind'], secret: boolean): Web_Api_ProviderCredentialField => ({
  description: '',
  key,
  kind,
  label: key,
  required: false,
  secret,
});

const tunnel = (id: Web_Api_ProviderTunnel['id'], credentialFields: Web_Api_ProviderCredentialField[]): Web_Api_ProviderTunnel => ({
  catalogSource: 'upload',
  credentialFields,
  description: '',
  id,
  supportsCatalogRefresh: false,
  supportsProfileUpload: true,
});

const provider = (tunnels: Web_Api_ProviderTunnel[]): Web_Api_Provider => ({
  description: '',
  displayName: 'Test',
  id: 'test',
  p2p: null,
  supportsPortForwarding: false,
  tunnels,
});

const runtime = (
  tunnelID: Web_Api_VpnTunnel,
  implementation?: 'kernel' | 'userspace',
): Web_Api_VpnConnectionRuntime => ({
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

const openVPN: Web_Api_ProviderTunnel = tunnel('openvpn', [
  field('username', 'text', false),
  field('password', 'password', true),
]);
const wireGuard: Web_Api_ProviderTunnel = tunnel('wireguard', [
  field('privateKey', 'wireguard-key', true),
  field('address', 'ipv4-address', false),
]);

describe('VPN tunnels', (): void => {
  it('opens providers with both tunnels on OpenVPN unless another is preferred', (): void => {
    expect(pickTunnel(provider([
      wireGuard,
      openVPN,
    ]), undefined)?.id).toBe('openvpn');
    expect(pickTunnel(provider([
      openVPN,
      wireGuard,
    ]), 'wireguard')?.id).toBe('wireguard');
    expect(pickTunnel(provider([wireGuard]), 'openvpn')?.id).toBe('wireguard');
    expect(pickTunnel(undefined, 'openvpn')).toBeUndefined();
  });

  it('initializes a new-connection editor once while provider data refreshes', (): void => {
    expect(shouldInitializeConnectionEditor(null, 'new', false)).toBe(false);
    expect(shouldInitializeConnectionEditor(null, 'new', true)).toBe(true);
    expect(shouldInitializeConnectionEditor('new', 'new', true)).toBe(false);
    expect(shouldInitializeConnectionEditor('new', 'vpc-0000000000000001', true)).toBe(true);
  });

  it('names the tunnel and its WireGuard engine for the status card', (): void => {
    expect(describeTunnel(undefined)).toBe('—');
    expect(describeTunnel(runtime('openvpn'))).toBe('OpenVPN');
    expect(describeTunnel(runtime('wireguard', 'userspace'))).toBe('WireGuard (userspace)');
  });

  it('sends only the filled fields of the chosen tunnel and keeps no secret afterward', (): void => {
    const typed: Record<string, string> = {
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
  });

  it('masks keys in monospace, gives addresses an example, and never asks for a browser password', (): void => {
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
  });

  it('counts a recent handshake in seconds', (): void => {
    const now: number = Date.parse('2026-11-03T12:00:42Z');

    expect(formatElapsed('2026-11-03T12:00:00Z', now)).toBe('42 seconds ago');
    expect(formatElapsed('2026-11-03T11:58:42Z', now)).toBe('2 minutes ago');
    expect(formatElapsed(undefined, now)).toBe('never');
  });
});
