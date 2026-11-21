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

import type { Tests_Web_DirectoryTree_Items } from '../src/types/tests/web/directory-tree.test.d.ts';

describe('directory tree helpers', () => {
  it('lists the root and every parent needed to reveal a path', () => {
    expect(directoryAncestorPaths('/data/media/films/classics')).toEqual([
      '/data',
      '/data/media',
      '/data/media/films',
    ]);

    expect(directoryAncestorPaths('/data/downloads')).toEqual(['/data']);

    expect(directoryAncestorPaths('/outside')).toEqual(['/data']);

    return;
  });

  it('expands ancestors below the fixed data root', () => {
    expect(directoryExpandedPaths('/data/media/films/classics')).toEqual([
      '/data/media',
      '/data/media/films',
    ]);

    expect(directoryExpandedPaths('/data/downloads')).toEqual([]);

    return;
  });

  it('targets the selected folder, data root, or an unbrowsable selection parent', () => {
    expect(directoryCreationParentPath('/data/media', true)).toBe('/data/media');

    expect(directoryCreationParentPath(null, true)).toBe('/data');

    expect(directoryCreationParentPath('/data/incomplete', false)).toBe('/data');

    expect(directoryCreationParentPath('/data/incomplete/working', false)).toBe('/data/incomplete');

    return;
  });

  it('opens a browsable folder when the folder itself cannot be selected', () => {
    expect(directoryRowClickAction(true, true, true, true)).toBe('select');

    expect(directoryRowClickAction(false, false, true, true)).toBe('toggle');

    expect(directoryRowClickAction(false, false, true, false)).toBe('none');

    return;
  });

  it('moves focus through visible rows and requests tree actions', () => {
    const items: Tests_Web_DirectoryTree_Items = [
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

    return;
  });

  return;
});
