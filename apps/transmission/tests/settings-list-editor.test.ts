import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  getSettingListEmptyState,
  normalizeSettingListValues,
} from '../src/web/settings-list-editor.ts';

describe('settings list editor', (): void => {
  it('uses blocklist-specific empty-state copy', (): void => {
    expect(getSettingListEmptyState('transmission.blocklistSources')).toEqual({
      hint: 'Add an HTTPS address for each blocklist.',
      title: 'No sources yet',
    });
  });

  it('uses generic empty-state copy for other settings', (): void => {
    expect(getSettingListEmptyState('transmission.futureValues')).toEqual({
      hint: null,
      title: 'No values yet',
    });
  });

  it('trims values and drops empty editor rows', (): void => {
    expect(normalizeSettingListValues([
      ' https://example.com/one.gz ',
      '',
      '   ',
      'https://example.com/two.gz',
    ])).toEqual([
      'https://example.com/one.gz',
      'https://example.com/two.gz',
    ]);
  });
});
