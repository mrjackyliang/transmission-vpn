import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { Tests_Web_Primitives_IconModule } from '../src/types/tests/web/primitives.test.d.ts';

describe('primitives', () => {
  it('renders every icon with Lucide drawing attributes', async () => {
    const iconModule: Tests_Web_Primitives_IconModule = await vi.importActual<Tests_Web_Primitives_IconModule>('../src/web/primitives.tsx');

    for (const name of [
      'activity',
      'add',
      'arrow-down',
      'arrow-up',
      'bell',
      'bot',
      'check',
      'chevron',
      'chevron-down',
      'chevron-left',
      'chevron-up',
      'clock',
      'containers',
      'copy',
      'download',
      'duplicate',
      'edit',
      'external',
      'features',
      'folder',
      'grip',
      'history',
      'image',
      'import',
      'invite',
      'key',
      'label',
      'logout',
      'logs',
      'menu',
      'more',
      'overview',
      'pause',
      'play',
      'plug',
      'refresh',
      'remove',
      'search',
      'send',
      'server',
      'settings',
      'shield',
      'signal',
      'stop',
      'torrent',
      'upload',
      'users',
      'variable',
      'warning',
      'x',
    ] as const) {
      expect(renderToStaticMarkup(createElement(iconModule['Icon'], { name }))).toContain('<svg');

      expect(renderToStaticMarkup(createElement(iconModule['Icon'], { name }))).toContain('fill="none"');

      expect(renderToStaticMarkup(createElement(iconModule['Icon'], { name }))).toContain('viewBox="0 0 24 24"');

      expect(renderToStaticMarkup(createElement(iconModule['Icon'], { name }))).toContain('stroke="currentColor"');

      expect(renderToStaticMarkup(createElement(iconModule['Icon'], { name }))).toContain('stroke-width="2"');

      expect(renderToStaticMarkup(createElement(iconModule['Icon'], { name }))).toContain('stroke-linecap="round"');

      expect(renderToStaticMarkup(createElement(iconModule['Icon'], { name }))).toContain('stroke-linejoin="round"');
    }

    return;
  });

  return;
});
