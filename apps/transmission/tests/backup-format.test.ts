import {
  describe,
  expect,
  it,
} from 'vitest';

import { parseBackupDocument } from '../src/web/backup-format.ts';

describe('backup format', (): void => {
  it('accepts a complete version-one document', (): void => {
    const document: Record<string, unknown> = {
      appVersion: '2.0.0',
      exportedAt: '2026-11-08T12:00:00Z',
      format: 'transmission-vpn-export',
      labels: [],
      version: 1,
    };

    expect(parseBackupDocument(document)).toEqual(document);
  });

  it('rejects bad format, version, missing fields and unknown keys', (): void => {
    const document: Record<string, unknown> = {
      appVersion: '2.0.0',
      exportedAt: '2026-11-08T12:00:00Z',
      format: 'transmission-vpn-export',
      labels: [],
      version: 1,
    };
    const missingVersion: Record<string, unknown> = { ...document };
    delete missingVersion['version'];

    for (const invalid of [
      {
        ...document,
        format: 'another-export',
      },
      {
        ...document,
        version: 2,
      },
      missingVersion,
      {
        ...document,
        appVersion: undefined,
      },
      {
        ...document,
        labels: undefined,
        settingsAndProfiles: {},
      },
      {
        ...document,
        unexpected: true,
      },
    ]) {
      expect((): void => {
        parseBackupDocument(invalid);
      }).toThrow();
    }
  });
});
