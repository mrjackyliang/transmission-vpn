import {
  describe,
  expect,
  it,
} from 'vitest';

import { formatRelative } from '../src/web/torrent-format.ts';

import type { Tests_Web_Format_Now } from '../src/types/tests/web/format.test.d.ts';

describe('relative time formatting', () => {
  it('formats recent, past, and future timestamps in whole units', () => {
    const now: Tests_Web_Format_Now = Date.parse('2026-11-05T12:00:00Z');

    expect(formatRelative('2026-11-05T11:59:40Z', now)).toBe('just now');

    expect(formatRelative('2026-11-05T11:58:00Z', now)).toBe('2 minutes ago');

    expect(formatRelative('2026-11-05T10:00:00Z', now)).toBe('2 hours ago');

    expect(formatRelative('2026-11-03T12:00:00Z', now)).toBe('2 days ago');

    expect(formatRelative('2026-11-05T14:00:00Z', now)).toBe('in 2 hours');

    expect(formatRelative('2026-11-06T12:00:00Z', now)).toBe('in 24 hours');

    return;
  });

  return;
});
