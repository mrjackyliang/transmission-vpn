import {
  describe,
  expect,
  it,
} from 'vitest';

import { displayProtectionState } from '../src/web/protection-state.ts';

import type {
  Web_Api_LiveSnapshot,
  Web_Api_VpnProtection,
  Web_Api_VpnRuntimeState,
} from '../src/types/web/api.d.ts';

const snapshot = (vpnState: Web_Api_VpnRuntimeState, protectionState: Web_Api_VpnProtection['state']): Web_Api_LiveSnapshot => ({
  capturedAt: '2026-10-27T12:00:00Z',
  connections: [],
  errors: [],
  organizationRevision: 0,
  protection: {
    enabledCount: 1,
    protectedCount: (protectionState === 'protected') ? 1 : 0,
    state: (protectionState === 'protected') ? 'protected' : 'blocked',
  },
  sequence: 1,
  status: {
    claimed: true,
    connections: [],
    configurationRevision: 1,
    protection: {
      enabledCount: 1,
      protectedCount: (protectionState === 'protected') ? 1 : 0,
      state: (protectionState === 'protected') ? 'protected' : 'blocked',
    },
    protectionState,
    runtime: {
      configurationReady: true,
      firewall: {
        interfaces: [],
        ready: true,
        state: protectionState,
      },
      services: {},
    },
    schemaVersion: 1,
    version: 'test',
  },
  torrents: [],
  vpn: {
    address: '',
    attempt: 1,
    changeRunning: false,
    connectionId: 'vpc-0000000000000000',
    default: true,
    dnsServers: [],
    slot: 0,
    state: vpnState,
    transitionedAt: '2026-10-27T12:00:00Z',
  },
});

describe('protection state display', (): void => {
  it('uses the VPN controller for connecting and reconnecting transitions', (): void => {
    expect(displayProtectionState(snapshot('connecting', 'blocked'))).toBe('connecting');
    expect(displayProtectionState(snapshot('reconnecting', 'blocked'))).toBe('reconnecting');
  });

  it('uses the appliance protection state outside connection transitions', (): void => {
    expect(displayProtectionState(snapshot('blocked', 'setup-required'))).toBe('setup-required');
    expect(displayProtectionState(snapshot('protected', 'protected'))).toBe('protected');
    expect(displayProtectionState(null)).toBe('blocked');
  });
});
