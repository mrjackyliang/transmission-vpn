import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  proxyTransitionStatus,
  proxyTransitionTimeoutMilliseconds,
} from '../src/web/proxy-transition.ts';

describe('proxy transition status', (): void => {
  it('settles when observed runtime state matches the request', (): void => {
    expect(proxyTransitionStatus(false, 'off', 0)).toBe('settled');
    expect(proxyTransitionStatus(true, 'listening', 0)).toBe('settled');
    expect(proxyTransitionStatus(true, 'waiting-for-vpn', 0)).toBe('settled');
  });

  it('stays busy while runtime state has not caught up', (): void => {
    expect(proxyTransitionStatus(true, 'off', 2_000)).toBe('busy');
    expect(proxyTransitionStatus(false, 'listening', 2_000)).toBe('busy');
    expect(proxyTransitionStatus(true, 'error', 2_000)).toBe('busy');
  });

  it('times out after fifteen seconds without a match', (): void => {
    expect(proxyTransitionStatus(
      true,
      'off',
      proxyTransitionTimeoutMilliseconds,
    )).toBe('timed-out');
  });
});
