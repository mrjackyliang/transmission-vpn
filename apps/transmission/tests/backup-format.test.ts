import {
  describe,
  expect,
  it,
} from 'vitest';

import { parseBackupDocument } from '../src/web/backup-format.ts';

import type {
  Tests_Web_BackupFormat_Document,
  Tests_Web_BackupFormat_MissingVersion,
} from '../src/types/tests/web/backup-format.test.d.ts';

describe('backup format', () => {
  it('accepts a complete version-one document', () => {
    const document: Tests_Web_BackupFormat_Document = {
      appVersion: '2.0.0',
      exportedAt: '2026-11-08T12:00:00Z',
      format: 'transmission-vpn-export',
      labels: [],
      version: 1,
    };

    expect(parseBackupDocument(document)).toEqual(document);

    return;
  });

  it('rejects bad format, version, missing fields and unknown keys', () => {
    const document: Tests_Web_BackupFormat_Document = {
      appVersion: '2.0.0',
      exportedAt: '2026-11-08T12:00:00Z',
      format: 'transmission-vpn-export',
      labels: [],
      version: 1,
    };
    const missingVersion: Tests_Web_BackupFormat_MissingVersion = { ...document };
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
      expect(() => {
        parseBackupDocument(invalid);

        return;
      }).toThrow();
    }

    return;
  });

  return;
});
