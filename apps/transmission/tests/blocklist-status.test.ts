import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  formatBlocklistLastUpdated,
  formatBlocklistNextUpdate,
  formatBlocklistSourceLine,
  formatBlocklistSummary,
} from '../src/web/blocklist-status.ts';

import type { Web_Api_BlocklistStatus } from '../src/types/web/api.d.ts';

describe('blocklist status text', (): void => {
  it('maps every aggregate state to its approved summary', (): void => {
    const idleStatus: Web_Api_BlocklistStatus = {
      sources: [
        {
          ranges: 1,
          state: 'ok',
          url: 'https://example.com/one.gz',
        },
        {
          ranges: 2,
          state: 'ok',
          url: 'https://example.com/two.gz',
        },
        {
          ranges: 3,
          state: 'error',
          url: 'https://example.com/three.gz',
        },
      ],
      state: 'idle',
      totalRanges: 1_234_567,
    };
    const updatingStatus: Web_Api_BlocklistStatus = {
      sources: [
        {
          ranges: 841_203,
          state: 'ok',
          url: 'https://example.com/one.gz',
        },
        {
          ranges: 0,
          state: 'pending',
          url: 'https://example.com/two.gz',
        },
        {
          ranges: 0,
          state: 'pending',
          url: 'https://example.com/three.gz',
        },
      ],
      state: 'updating',
      totalRanges: 841_203,
    };
    const waitingStatus: Web_Api_BlocklistStatus = {
      sources: idleStatus.sources,
      state: 'waiting-for-vpn',
      totalRanges: idleStatus.totalRanges,
    };
    const disabledStatus: Web_Api_BlocklistStatus = {
      sources: idleStatus.sources,
      state: 'disabled',
      totalRanges: idleStatus.totalRanges,
    };
    const noSourcesStatus: Web_Api_BlocklistStatus = {
      sources: [],
      state: 'no-sources',
      totalRanges: 0,
    };

    expect(formatBlocklistSummary(idleStatus)).toBe('Blocking 1,234,567 address ranges from 3 sources.');
    expect(formatBlocklistSummary(updatingStatus)).toBe('Updating… 2 of 3');
    expect(formatBlocklistSummary(waitingStatus)).toBe('Waiting for the VPN to update blocklists.');
    expect(formatBlocklistSummary(disabledStatus)).toBe('Turn on blocklists to download these sources.');
    expect(formatBlocklistSummary(noSourcesStatus)).toBe('Add a source to start blocking.');
  });

  it('formats aggregate timestamps and omits unknown ones', (): void => {
    const now: number = Date.parse('2026-11-05T12:00:00Z');
    const status: Web_Api_BlocklistStatus = {
      lastSuccessAt: '2026-11-05T10:00:00Z',
      nextUpdateAt: '2026-11-06T10:00:00Z',
      sources: [],
      state: 'idle',
      totalRanges: 0,
    };

    expect(formatBlocklistLastUpdated(status, now)).toBe('Last updated 2 hours ago');
    expect(formatBlocklistNextUpdate(status, now)).toBe('Next update in 22 hours');
    expect(formatBlocklistLastUpdated({
      ...status,
      lastSuccessAt: null,
    }, now)).toBeNull();
    expect(formatBlocklistNextUpdate({
      ...status,
      nextUpdateAt: undefined,
    }, now)).toBeNull();
  });
});

describe('blocklist source status text', (): void => {
  it('formats ok, pending, and copied error results', (): void => {
    const now: number = Date.parse('2026-11-05T12:00:00Z');
    const status: Web_Api_BlocklistStatus = {
      sources: [
        {
          ranges: 841_203,
          state: 'ok',
          updatedAt: '2026-11-05T10:00:00Z',
          url: 'https://example.com/one.gz',
        },
        {
          ranges: 0,
          state: 'pending',
          url: 'https://example.com/two.gz',
        },
        {
          copyFrom: '2026-11-04T12:00:00Z',
          error: 'Couldn\'t download: the server answered 404.',
          ranges: 352_151,
          state: 'error',
          url: 'https://example.com/three.gz',
        },
      ],
      state: 'idle',
      totalRanges: 1_193_354,
    };

    expect(formatBlocklistSourceLine(status, 'https://example.com/one.gz', true, now)).toEqual({
      text: '841,203 ranges · Updated 2 hours ago',
      tone: 'default',
    });
    expect(formatBlocklistSourceLine(status, 'https://example.com/two.gz', true, now)).toEqual({
      text: 'Waiting for the first update',
      tone: 'default',
    });
    expect(formatBlocklistSourceLine(status, 'https://example.com/three.gz', true, now)).toEqual({
      text: 'Couldn\'t download: the server answered 404. Using the copy from Nov 4.',
      tone: 'danger',
    });
    expect(formatBlocklistSourceLine(status, 'https://example.com/unsaved.gz', true, now)).toBeNull();
  });

  it('shows the completed, active, and waiting rows during an update', (): void => {
    const now: number = Date.parse('2026-11-05T12:00:00Z');
    const status: Web_Api_BlocklistStatus = {
      sources: [
        {
          ranges: 841_203,
          state: 'ok',
          updatedAt: '2026-11-05T12:00:00Z',
          url: 'https://example.com/one.gz',
        },
        {
          ranges: 0,
          state: 'pending',
          url: 'https://example.com/two.gz',
        },
        {
          ranges: 0,
          state: 'pending',
          url: 'https://example.com/three.gz',
        },
      ],
      state: 'updating',
      totalRanges: 841_203,
    };

    expect(formatBlocklistSourceLine(status, 'https://example.com/one.gz', true, now)).toEqual({
      text: '841,203 ranges · Updated just now',
      tone: 'default',
    });
    expect(formatBlocklistSourceLine(status, 'https://example.com/two.gz', true, now)).toEqual({
      text: 'Downloading…',
      tone: 'active',
    });
    expect(formatBlocklistSourceLine(status, 'https://example.com/three.gz', true, now)).toEqual({
      text: 'Waiting',
      tone: 'default',
    });
  });

  it('mutes plain results while the toggle is off but keeps errors in the danger tone', (): void => {
    const status: Web_Api_BlocklistStatus = {
      sources: [
        {
          copyFrom: '2026-11-04T12:00:00Z',
          error: 'Download failed',
          ranges: 10,
          state: 'error',
          url: 'https://example.com/one.gz',
        },
        {
          ranges: 20,
          state: 'ok',
          url: 'https://example.com/two.gz',
        },
      ],
      state: 'disabled',
      totalRanges: 30,
    };

    expect(formatBlocklistSourceLine(status, 'https://example.com/one.gz', false)).toMatchObject({
      tone: 'danger',
    });
    expect(formatBlocklistSourceLine(status, 'https://example.com/two.gz', false)).toMatchObject({
      tone: 'muted',
    });
  });
});
