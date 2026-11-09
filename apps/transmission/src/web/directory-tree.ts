import type {
  Web_DirectoryTree_DirectoryAncestorPaths_Path,
  Web_DirectoryTree_DirectoryAncestorPaths_Returns,
  Web_DirectoryTree_DirectoryCreationParentPath_Browsable,
  Web_DirectoryTree_DirectoryCreationParentPath_Path,
  Web_DirectoryTree_DirectoryCreationParentPath_Returns,
  Web_DirectoryTree_DirectoryExpandedPaths_Path,
  Web_DirectoryTree_DirectoryExpandedPaths_Returns,
  Web_DirectoryTree_Item,
  Web_DirectoryTree_MoveDirectoryTreeFocus_FocusedPath,
  Web_DirectoryTree_MoveDirectoryTreeFocus_Items,
  Web_DirectoryTree_MoveDirectoryTreeFocus_Key,
  Web_DirectoryTree_MoveDirectoryTreeFocus_Returns,
  Web_DirectoryTree_RowClickAction_Browsable,
  Web_DirectoryTree_RowClickAction_HasSubfolders,
  Web_DirectoryTree_RowClickAction_Returns,
  Web_DirectoryTree_RowClickAction_Selectable,
  Web_DirectoryTree_RowClickAction_Usable,
} from '@/types/web/directory-tree.d.ts';

/**
 * Directory Tree - Directory ancestor paths.
 *
 * Lists the levels that must load before an initial folder can appear in the
 * tree. The initial folder itself is listed by its parent and is not fetched.
 *
 * @param {Web_DirectoryTree_DirectoryAncestorPaths_Path} path - Path.
 *
 * @returns {Web_DirectoryTree_DirectoryAncestorPaths_Returns}
 *
 * @since UNRELEASED
 */
export const directoryAncestorPaths = (
  path: Web_DirectoryTree_DirectoryAncestorPaths_Path,
): Web_DirectoryTree_DirectoryAncestorPaths_Returns => {
  const pathSegments: string[] = path.split('/').filter(
    (pathSegment: string): boolean => pathSegment !== '',
  );
  const ancestorPaths: string[] = ['/data'];
  let ancestorPath: string = '/data';

  if (pathSegments[0] !== 'data') {
    return ancestorPaths;
  }

  for (const pathSegment of pathSegments.slice(1, -1)) {
    ancestorPath = `${ancestorPath}/${pathSegment}`;
    ancestorPaths.push(ancestorPath);
  }

  return ancestorPaths;
};

/**
 * Directory Tree - Directory creation parent path.
 *
 * Keeps folder creation inside the selected folder when it can be browsed,
 * beside an unbrowsable selection, or directly inside /data without one.
 *
 * @param {Web_DirectoryTree_DirectoryCreationParentPath_Path}      path      - Path.
 * @param {Web_DirectoryTree_DirectoryCreationParentPath_Browsable} browsable - Browsable.
 *
 * @returns {Web_DirectoryTree_DirectoryCreationParentPath_Returns}
 *
 * @since UNRELEASED
 */
export const directoryCreationParentPath = (
  path: Web_DirectoryTree_DirectoryCreationParentPath_Path,
  browsable: Web_DirectoryTree_DirectoryCreationParentPath_Browsable,
): Web_DirectoryTree_DirectoryCreationParentPath_Returns => {
  if (path === null) {
    return '/data';
  }

  if (browsable) {
    return path;
  }

  return path.slice(0, path.lastIndexOf('/')) || '/data';
};

/**
 * Directory Tree - Directory expanded paths.
 *
 * Expands each listed ancestor below the fixed root so the initial folder is
 * revealed without opening the initial folder's own children.
 *
 * @param {Web_DirectoryTree_DirectoryExpandedPaths_Path} path - Path.
 *
 * @returns {Web_DirectoryTree_DirectoryExpandedPaths_Returns}
 *
 * @since UNRELEASED
 */
export const directoryExpandedPaths = (
  path: Web_DirectoryTree_DirectoryExpandedPaths_Path,
): Web_DirectoryTree_DirectoryExpandedPaths_Returns => directoryAncestorPaths(path).filter(
  (ancestorPath: string): boolean => ancestorPath !== '/data',
);

/**
 * Directory Tree - Row click action.
 *
 * Chooses a valid folder, or opens a folder that cannot itself be chosen.
 * A non-selectable leaf remains inert because it has nowhere to navigate.
 *
 * @param {Web_DirectoryTree_RowClickAction_Selectable}    selectable    - Selectable.
 * @param {Web_DirectoryTree_RowClickAction_Usable}        usable        - Usable.
 * @param {Web_DirectoryTree_RowClickAction_Browsable}     browsable     - Browsable.
 * @param {Web_DirectoryTree_RowClickAction_HasSubfolders} hasSubfolders - Has subfolders.
 *
 * @returns {Web_DirectoryTree_RowClickAction_Returns}
 *
 * @since UNRELEASED
 */
export const directoryRowClickAction = (
  selectable: Web_DirectoryTree_RowClickAction_Selectable,
  usable: Web_DirectoryTree_RowClickAction_Usable,
  browsable: Web_DirectoryTree_RowClickAction_Browsable,
  hasSubfolders: Web_DirectoryTree_RowClickAction_HasSubfolders,
): Web_DirectoryTree_RowClickAction_Returns => {
  if (selectable && usable) {
    return 'select';
  }

  if (browsable && hasSubfolders) {
    return 'toggle';
  }

  return 'none';
};

/**
 * Directory Tree - Move directory tree focus.
 *
 * Implements WAI-ARIA tree movement without touching the DOM. The caller
 * applies requested expansion changes and moves focus to the returned path.
 *
 * @param {Web_DirectoryTree_MoveDirectoryTreeFocus_Items}       items       - Items.
 * @param {Web_DirectoryTree_MoveDirectoryTreeFocus_FocusedPath} focusedPath - Focused path.
 * @param {Web_DirectoryTree_MoveDirectoryTreeFocus_Key}         key         - Key.
 *
 * @returns {Web_DirectoryTree_MoveDirectoryTreeFocus_Returns}
 *
 * @since UNRELEASED
 */
export const moveDirectoryTreeFocus = (
  items: Web_DirectoryTree_MoveDirectoryTreeFocus_Items,
  focusedPath: Web_DirectoryTree_MoveDirectoryTreeFocus_FocusedPath,
  key: Web_DirectoryTree_MoveDirectoryTreeFocus_Key,
): Web_DirectoryTree_MoveDirectoryTreeFocus_Returns => {
  const currentIndex: number = items.findIndex(
    (item: Web_DirectoryTree_Item): boolean => item['path'] === focusedPath,
  );
  const currentItem: Web_DirectoryTree_Item | undefined = items[currentIndex];

  if (currentItem === undefined || items.length === 0) {
    return {
      action: 'none',
      path: focusedPath,
    };
  }

  if (key === 'ArrowDown') {
    const nextItem: Web_DirectoryTree_Item = items[Math.min(currentIndex + 1, items.length - 1)] ?? currentItem;

    return {
      action: 'none',
      path: nextItem['path'],
    };
  }

  if (key === 'ArrowUp') {
    const previousItem: Web_DirectoryTree_Item = items[Math.max(currentIndex - 1, 0)] ?? currentItem;

    return {
      action: 'none',
      path: previousItem['path'],
    };
  }

  if (key === 'Home') {
    return {
      action: 'none',
      path: items[0]?.['path'] ?? currentItem['path'],
    };
  }

  if (key === 'End') {
    return {
      action: 'none',
      path: items.at(-1)?.['path'] ?? currentItem['path'],
    };
  }

  if (key === 'ArrowRight') {
    if (!currentItem['hasChildren']) {
      return {
        action: 'none',
        path: currentItem['path'],
      };
    }

    if (!currentItem['expanded']) {
      return {
        action: 'expand',
        path: currentItem['path'],
      };
    }

    const firstChild: Web_DirectoryTree_Item | undefined = items.slice(currentIndex + 1).find(
      (item: Web_DirectoryTree_Item): boolean => item['parentPath'] === currentItem['path'],
    );

    return {
      action: 'none',
      path: firstChild?.['path'] ?? currentItem['path'],
    };
  }

  if (currentItem['expanded'] && currentItem['hasChildren']) {
    return {
      action: 'collapse',
      path: currentItem['path'],
    };
  }

  const parentItem: Web_DirectoryTree_Item | undefined = items.find(
    (item: Web_DirectoryTree_Item): boolean => item['path'] === currentItem['parentPath'],
  );

  return {
    action: 'none',
    path: parentItem?.['path'] ?? currentItem['path'],
  };
};
