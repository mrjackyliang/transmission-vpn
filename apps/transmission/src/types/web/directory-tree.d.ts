/**
 * Directory Tree.
 *
 * Shares the folder picker's pure navigation contracts with its focused tests.
 * The dialog keeps rendering and network state outside these small helpers.
 *
 * @since 2.0.0
 */
export type Web_DirectoryTree_KeyboardKey =
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'ArrowUp'
  | 'End'
  | 'Home';
export type Web_DirectoryTree_Item = {
  expanded: boolean;
  hasChildren: boolean;
  parentPath?: string | undefined;
  path: string;
};
export type Web_DirectoryTree_MoveAction = 'collapse' | 'expand' | 'none';
export type Web_DirectoryTree_Move = {
  action: Web_DirectoryTree_MoveAction;
  path: string;
};
export type Web_DirectoryTree_RowAction = 'select' | 'toggle' | 'none';

/**
 * Directory Tree - Directory ancestor paths.
 *
 * @since 2.0.0
 */
export type Web_DirectoryTree_DirectoryAncestorPaths_Path = string;
export type Web_DirectoryTree_DirectoryAncestorPaths_Returns = string[];

/**
 * Directory Tree - Directory creation parent path.
 *
 * @since 2.0.0
 */
export type Web_DirectoryTree_DirectoryCreationParentPath_Path = string | null;
export type Web_DirectoryTree_DirectoryCreationParentPath_Browsable = boolean;
export type Web_DirectoryTree_DirectoryCreationParentPath_Returns = string;

/**
 * Directory Tree - Directory expanded paths.
 *
 * @since 2.0.0
 */
export type Web_DirectoryTree_DirectoryExpandedPaths_Path = string;
export type Web_DirectoryTree_DirectoryExpandedPaths_Returns = string[];

/**
 * Directory Tree - Row click action.
 *
 * @since 2.0.0
 */
export type Web_DirectoryTree_RowClickAction_Selectable = boolean;
export type Web_DirectoryTree_RowClickAction_Usable = boolean;
export type Web_DirectoryTree_RowClickAction_Browsable = boolean;
export type Web_DirectoryTree_RowClickAction_HasSubfolders = boolean;
export type Web_DirectoryTree_RowClickAction_Returns = Web_DirectoryTree_RowAction;

/**
 * Directory Tree - Move directory tree focus.
 *
 * @since 2.0.0
 */
export type Web_DirectoryTree_MoveDirectoryTreeFocus_Items = Web_DirectoryTree_Item[];
export type Web_DirectoryTree_MoveDirectoryTreeFocus_FocusedPath = string;
export type Web_DirectoryTree_MoveDirectoryTreeFocus_Key = Web_DirectoryTree_KeyboardKey;
export type Web_DirectoryTree_MoveDirectoryTreeFocus_Returns = Web_DirectoryTree_Move;
