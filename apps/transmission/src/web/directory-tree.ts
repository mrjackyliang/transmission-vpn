import type {
  Web_DirectoryTree_DirectoryAncestorPaths_AncestorPath,
  Web_DirectoryTree_DirectoryAncestorPaths_AncestorPaths,
  Web_DirectoryTree_DirectoryAncestorPaths_Path,
  Web_DirectoryTree_DirectoryAncestorPaths_PathSegments,
  Web_DirectoryTree_DirectoryAncestorPaths_Returns,
  Web_DirectoryTree_DirectoryCreationParentPath_Browsable,
  Web_DirectoryTree_DirectoryCreationParentPath_Path,
  Web_DirectoryTree_DirectoryCreationParentPath_Returns,
  Web_DirectoryTree_DirectoryExpandedPaths_Path,
  Web_DirectoryTree_DirectoryExpandedPaths_Returns,
  Web_DirectoryTree_DirectoryRowClickAction_Browsable,
  Web_DirectoryTree_DirectoryRowClickAction_HasSubfolders,
  Web_DirectoryTree_DirectoryRowClickAction_Returns,
  Web_DirectoryTree_DirectoryRowClickAction_Selectable,
  Web_DirectoryTree_DirectoryRowClickAction_Usable,
  Web_DirectoryTree_MoveDirectoryTreeFocus_CurrentIndex,
  Web_DirectoryTree_MoveDirectoryTreeFocus_CurrentItem,
  Web_DirectoryTree_MoveDirectoryTreeFocus_FirstChild,
  Web_DirectoryTree_MoveDirectoryTreeFocus_FirstItem,
  Web_DirectoryTree_MoveDirectoryTreeFocus_FocusedPath,
  Web_DirectoryTree_MoveDirectoryTreeFocus_Items,
  Web_DirectoryTree_MoveDirectoryTreeFocus_Key,
  Web_DirectoryTree_MoveDirectoryTreeFocus_LastItem,
  Web_DirectoryTree_MoveDirectoryTreeFocus_NextItem,
  Web_DirectoryTree_MoveDirectoryTreeFocus_ParentItem,
  Web_DirectoryTree_MoveDirectoryTreeFocus_PreviousItem,
  Web_DirectoryTree_MoveDirectoryTreeFocus_Returns,
} from '@/types/web/directory-tree.d.ts';

/**
 * Directory Tree - Directory Ancestor Paths.
 *
 * Lists the levels that must load before an initial folder can appear in the
 * tree. The initial folder itself is listed by its parent and is not fetched.
 *
 * @param {Web_DirectoryTree_DirectoryAncestorPaths_Path} path - Path.
 *
 * @returns {Web_DirectoryTree_DirectoryAncestorPaths_Returns}
 *
 * @since 2.0.0
 */
export const directoryAncestorPaths = (
  path: Web_DirectoryTree_DirectoryAncestorPaths_Path,
): Web_DirectoryTree_DirectoryAncestorPaths_Returns => {
  const pathSegments: Web_DirectoryTree_DirectoryAncestorPaths_PathSegments = path.split('/').filter(
    (pathSegment) => pathSegment !== '',
  );
  const ancestorPaths: Web_DirectoryTree_DirectoryAncestorPaths_AncestorPaths = ['/data'];
  let ancestorPath: Web_DirectoryTree_DirectoryAncestorPaths_AncestorPath = '/data';

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
 * Directory Tree - Directory Creation Parent Path.
 *
 * Keeps folder creation inside the selected folder when it can be browsed,
 * beside an unbrowsable selection, or directly inside /data without one.
 *
 * @param {Web_DirectoryTree_DirectoryCreationParentPath_Path}      path      - Path.
 * @param {Web_DirectoryTree_DirectoryCreationParentPath_Browsable} browsable - Browsable.
 *
 * @returns {Web_DirectoryTree_DirectoryCreationParentPath_Returns}
 *
 * @since 2.0.0
 */
export const directoryCreationParentPath = (
  path: Web_DirectoryTree_DirectoryCreationParentPath_Path,
  browsable: Web_DirectoryTree_DirectoryCreationParentPath_Browsable,
): Web_DirectoryTree_DirectoryCreationParentPath_Returns => {
  if (path === null) {
    return '/data';
  }

  if (browsable === true) {
    return path;
  }

  return path.slice(0, path.lastIndexOf('/')) || '/data';
};

/**
 * Directory Tree - Directory Expanded Paths.
 *
 * Expands each listed ancestor below the fixed root so the initial folder is
 * revealed without opening the initial folder's own children.
 *
 * @param {Web_DirectoryTree_DirectoryExpandedPaths_Path} path - Path.
 *
 * @returns {Web_DirectoryTree_DirectoryExpandedPaths_Returns}
 *
 * @since 2.0.0
 */
export const directoryExpandedPaths = (
  path: Web_DirectoryTree_DirectoryExpandedPaths_Path,
): Web_DirectoryTree_DirectoryExpandedPaths_Returns => directoryAncestorPaths(path).filter(
  (ancestorPath) => ancestorPath !== '/data',
);

/**
 * Directory Tree - Directory Row Click Action.
 *
 * Chooses a valid folder, or opens a folder that cannot itself be chosen.
 * A non-selectable leaf remains inert because it has nowhere to navigate.
 *
 * @param {Web_DirectoryTree_DirectoryRowClickAction_Selectable}    selectable    - Selectable.
 * @param {Web_DirectoryTree_DirectoryRowClickAction_Usable}        usable        - Usable.
 * @param {Web_DirectoryTree_DirectoryRowClickAction_Browsable}     browsable     - Browsable.
 * @param {Web_DirectoryTree_DirectoryRowClickAction_HasSubfolders} hasSubfolders - Has subfolders.
 *
 * @returns {Web_DirectoryTree_DirectoryRowClickAction_Returns}
 *
 * @since 2.0.0
 */
export const directoryRowClickAction = (
  selectable: Web_DirectoryTree_DirectoryRowClickAction_Selectable,
  usable: Web_DirectoryTree_DirectoryRowClickAction_Usable,
  browsable: Web_DirectoryTree_DirectoryRowClickAction_Browsable,
  hasSubfolders: Web_DirectoryTree_DirectoryRowClickAction_HasSubfolders,
): Web_DirectoryTree_DirectoryRowClickAction_Returns => {
  if (selectable === true && usable === true) {
    return 'select';
  }

  if (browsable === true && hasSubfolders === true) {
    return 'toggle';
  }

  return 'none';
};

/**
 * Directory Tree - Move Directory Tree Focus.
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
 * @since 2.0.0
 */
export const moveDirectoryTreeFocus = (
  items: Web_DirectoryTree_MoveDirectoryTreeFocus_Items,
  focusedPath: Web_DirectoryTree_MoveDirectoryTreeFocus_FocusedPath,
  key: Web_DirectoryTree_MoveDirectoryTreeFocus_Key,
): Web_DirectoryTree_MoveDirectoryTreeFocus_Returns => {
  const currentIndex: Web_DirectoryTree_MoveDirectoryTreeFocus_CurrentIndex = items.findIndex(
    (item) => item['path'] === focusedPath,
  );
  const currentItem: Web_DirectoryTree_MoveDirectoryTreeFocus_CurrentItem = items[currentIndex];

  if (currentItem === undefined || items.length === 0) {
    return {
      action: 'none',
      path: focusedPath,
    };
  }

  if (key === 'ArrowDown') {
    const nextItem: Web_DirectoryTree_MoveDirectoryTreeFocus_NextItem = items[Math.min(currentIndex + 1, items.length - 1)] ?? currentItem;

    return {
      action: 'none',
      path: nextItem['path'],
    };
  }

  if (key === 'ArrowUp') {
    const previousItem: Web_DirectoryTree_MoveDirectoryTreeFocus_PreviousItem = items[Math.max(currentIndex - 1, 0)] ?? currentItem;

    return {
      action: 'none',
      path: previousItem['path'],
    };
  }

  if (key === 'Home') {
    const firstItem: Web_DirectoryTree_MoveDirectoryTreeFocus_FirstItem = items[0];

    return {
      action: 'none',
      path: (firstItem !== undefined) ? firstItem['path'] : currentItem['path'],
    };
  }

  if (key === 'End') {
    const lastItem: Web_DirectoryTree_MoveDirectoryTreeFocus_LastItem = items.at(-1);

    return {
      action: 'none',
      path: (lastItem !== undefined) ? lastItem['path'] : currentItem['path'],
    };
  }

  if (key === 'ArrowRight') {
    if (currentItem['hasChildren'] === false) {
      return {
        action: 'none',
        path: currentItem['path'],
      };
    }

    if (currentItem['expanded'] === false) {
      return {
        action: 'expand',
        path: currentItem['path'],
      };
    }

    const firstChild: Web_DirectoryTree_MoveDirectoryTreeFocus_FirstChild = items.slice(currentIndex + 1).find(
      (item) => item['parentPath'] === currentItem['path'],
    );

    return {
      action: 'none',
      path: (firstChild !== undefined) ? firstChild['path'] : currentItem['path'],
    };
  }

  if (currentItem['expanded'] === true && currentItem['hasChildren'] === true) {
    return {
      action: 'collapse',
      path: currentItem['path'],
    };
  }

  const parentItem: Web_DirectoryTree_MoveDirectoryTreeFocus_ParentItem = items.find(
    (item) => item['path'] === currentItem['parentPath'],
  );

  return {
    action: 'none',
    path: (parentItem !== undefined) ? parentItem['path'] : currentItem['path'],
  };
};
