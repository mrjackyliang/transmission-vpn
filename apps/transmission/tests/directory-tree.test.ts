import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  directoryAncestorPaths,
  directoryCreationParentPath,
  directoryExpandedPaths,
  directoryRowClickAction,
  moveDirectoryTreeFocus,
} from '../src/web/directory-tree.ts';

import type { Web_DirectoryTree_Item } from '../src/types/web/directory-tree.d.ts';

describe('directory tree helpers', (): void => {
  it('lists the root and every parent needed to reveal a path', (): void => {
    expect(directoryAncestorPaths('/data/media/films/classics')).toEqual([
      '/data',
      '/data/media',
      '/data/media/films',
    ]);
    expect(directoryAncestorPaths('/data/downloads')).toEqual(['/data']);
    expect(directoryAncestorPaths('/outside')).toEqual(['/data']);
  });

  it('expands ancestors below the fixed data root', (): void => {
    expect(directoryExpandedPaths('/data/media/films/classics')).toEqual([
      '/data/media',
      '/data/media/films',
    ]);
    expect(directoryExpandedPaths('/data/downloads')).toEqual([]);
  });

  it('targets the selected folder, data root, or an unbrowsable selection parent', (): void => {
    expect(directoryCreationParentPath('/data/media', true)).toBe('/data/media');
    expect(directoryCreationParentPath(null, true)).toBe('/data');
    expect(directoryCreationParentPath('/data/incomplete', false)).toBe('/data');
    expect(directoryCreationParentPath('/data/incomplete/working', false)).toBe('/data/incomplete');
  });

  it('opens a browsable folder when the folder itself cannot be selected', (): void => {
    expect(directoryRowClickAction(true, true, true, true)).toBe('select');
    expect(directoryRowClickAction(false, false, true, true)).toBe('toggle');
    expect(directoryRowClickAction(false, false, true, false)).toBe('none');
  });

  it('moves focus through visible rows and requests tree actions', (): void => {
    const items: Web_DirectoryTree_Item[] = [
      {
        expanded: false,
        hasChildren: false,
        parentPath: '/data',
        path: '/data/downloads',
      },
      {
        expanded: true,
        hasChildren: true,
        parentPath: '/data',
        path: '/data/media',
      },
      {
        expanded: false,
        hasChildren: true,
        parentPath: '/data/media',
        path: '/data/media/films',
      },
      {
        expanded: false,
        hasChildren: false,
        parentPath: '/data',
        path: '/data/old-stuff',
      },
    ];

    expect(moveDirectoryTreeFocus(items, '/data/media', 'ArrowUp')).toEqual({
      action: 'none',
      path: '/data/downloads',
    });
    expect(moveDirectoryTreeFocus(items, '/data/media', 'ArrowDown')).toEqual({
      action: 'none',
      path: '/data/media/films',
    });
    expect(moveDirectoryTreeFocus(items, '/data/downloads', 'End')).toEqual({
      action: 'none',
      path: '/data/old-stuff',
    });
    expect(moveDirectoryTreeFocus(items, '/data/old-stuff', 'Home')).toEqual({
      action: 'none',
      path: '/data/downloads',
    });
    expect(moveDirectoryTreeFocus(items, '/data/media', 'ArrowRight')).toEqual({
      action: 'none',
      path: '/data/media/films',
    });
    expect(moveDirectoryTreeFocus(items, '/data/media/films', 'ArrowRight')).toEqual({
      action: 'expand',
      path: '/data/media/films',
    });
    expect(moveDirectoryTreeFocus(items, '/data/media', 'ArrowLeft')).toEqual({
      action: 'collapse',
      path: '/data/media',
    });
    expect(moveDirectoryTreeFocus(items, '/data/media/films', 'ArrowLeft')).toEqual({
      action: 'none',
      path: '/data/media',
    });
  });
});
