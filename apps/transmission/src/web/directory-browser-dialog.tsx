import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import {
  createDirectory,
  deleteDirectory,
  getDirectory,
} from '@/web/api.ts';
import {
  directoryAncestorPaths,
  directoryCreationParentPath,
  directoryExpandedPaths,
  directoryRowClickAction,
  moveDirectoryTreeFocus,
} from '@/web/directory-tree.ts';
import {
  Button,
  Icon,
} from '@/web/primitives.tsx';
import { showToast } from '@/web/toast.ts';
import { useEscapeKey } from '@/web/use-escape-key.ts';

import type {
  CSSProperties,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactElement,
} from 'react';

import type {
  Web_Api_Directory,
  Web_Api_DirectoryEntry,
} from '@/types/web/api.d.ts';
import type {
  Web_Components_DirectoryBrowserDialog_Errors,
  Web_Components_DirectoryBrowserDialog_Levels,
  Web_Components_DirectoryBrowserDialog_Props,
  Web_Components_DirectoryBrowserDialog_VisibleItem,
} from '@/types/web/components.d.ts';
import type {
  Web_DirectoryTree_Item,
  Web_DirectoryTree_KeyboardKey,
  Web_DirectoryTree_Move,
  Web_DirectoryTree_RowAction,
} from '@/types/web/directory-tree.d.ts';

/**
 * Directory Browser Dialog - Parent path.
 *
 * Returns the containing folder for a normalized path below /data.
 * Keeping the calculation here prevents mutations from targeting the wrong level.
 *
 * @since 2.0.0
 */
const parentPathFor = (path: string): string => path.slice(0, path.lastIndexOf('/')) || '/data';

/**
 * Directory Browser Dialog - Error message.
 *
 * Preserves server messages and supplies a stable fallback for non-Error failures.
 * Inline actions use the same conversion so their error treatment stays consistent.
 *
 * @since 2.0.0
 */
const messageFor = (caughtError: unknown, fallback: string): string => (
  (caughtError instanceof Error) ? caughtError.message : fallback
);

/**
 * Directory Browser Dialog.
 *
 * Presents every folder below /data as one lazily loaded, keyboard-navigable tree.
 * Cached levels remain visible while a refreshed level is requested after a mutation.
 *
 * @since 2.0.0
 */
export const DirectoryBrowserDialog = ({
  initialPath,
  onClose,
  onSelect,
  open,
  profileId,
  purpose = 'download',
}: Web_Components_DirectoryBrowserDialog_Props): ReactElement | null => {
  const [
    levels,
    setLevels,
  ] = useState<Web_Components_DirectoryBrowserDialog_Levels>({});
  const [
    expandedPaths,
    setExpandedPaths,
  ] = useState<string[]>([]);
  const [
    loadingPaths,
    setLoadingPaths,
  ] = useState<string[]>([]);
  const [
    loadErrors,
    setLoadErrors,
  ] = useState<Web_Components_DirectoryBrowserDialog_Errors>({});
  const [
    selectedPath,
    setSelectedPath,
  ] = useState<string | null>(null);
  const [
    focusedPath,
    setFocusedPath,
  ] = useState<string | null>(null);
  const [
    createParentPath,
    setCreateParentPath,
  ] = useState<string | null>(null);
  const [
    folderName,
    setFolderName,
  ] = useState<string>('');
  const [
    creating,
    setCreating,
  ] = useState<boolean>(false);
  const [
    createError,
    setCreateError,
  ] = useState<string>('');
  const [
    deleteConfirmationOpen,
    setDeleteConfirmationOpen,
  ] = useState<boolean>(false);
  const [
    deleting,
    setDeleting,
  ] = useState<boolean>(false);
  const [
    deleteError,
    setDeleteError,
  ] = useState<string>('');
  const levelsRef = useRef<Web_Components_DirectoryBrowserDialog_Levels>({});
  const openSequenceRef = useRef<number>(0);
  const requestSequencesRef = useRef<Map<string, number>>(new Map());
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const treeFocusAfterCreateRef = useRef<string | null>(null);
  const treeFocusBeforeCreateRef = useRef<string | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const treeScrollTopBeforeCreateRef = useRef<number>(0);
  const createInputRef = useRef<HTMLInputElement>(null);

  // Stores one authoritative level in both the render state and request cache.
  const storeLevel = useCallback((directory: Web_Api_Directory): void => {
    const nextLevels: Web_Components_DirectoryBrowserDialog_Levels = {
      ...levelsRef.current,
      [directory['path']]: directory,
    };
    levelsRef.current = nextLevels;
    setLevels(nextLevels);
  }, []);

  // Loads one level while ignoring replies superseded for the same path or dialog opening.
  const loadLevel = useCallback(async (
    path: string,
    refresh: boolean = false,
  ): Promise<Web_Api_Directory | null> => {
    const cachedLevel: Web_Api_Directory | undefined = levelsRef.current[path];
    if (!refresh && cachedLevel !== undefined) {
      return cachedLevel;
    }

    const openSequence: number = openSequenceRef.current;
    const requestSequence: number = (requestSequencesRef.current.get(path) ?? 0) + 1;
    requestSequencesRef.current.set(path, requestSequence);
    setLoadingPaths((currentPaths: string[]): string[] => (
      (currentPaths.includes(path)) ? currentPaths : [
        ...currentPaths,
        path,
      ]
    ));
    setLoadErrors((currentErrors: Web_Components_DirectoryBrowserDialog_Errors): Web_Components_DirectoryBrowserDialog_Errors => {
      const nextErrors: Web_Components_DirectoryBrowserDialog_Errors = { ...currentErrors };
      Reflect.deleteProperty(nextErrors, path);

      return nextErrors;
    });

    try {
      const directory: Web_Api_Directory = await getDirectory(path, purpose, profileId);
      if (
        openSequence !== openSequenceRef.current
        || requestSequence !== requestSequencesRef.current.get(path)
      ) {
        return null;
      }

      storeLevel(directory);

      return directory;
    } catch (caughtError) {
      if (
        openSequence === openSequenceRef.current
        && requestSequence === requestSequencesRef.current.get(path)
      ) {
        setLoadErrors((currentErrors: Web_Components_DirectoryBrowserDialog_Errors): Web_Components_DirectoryBrowserDialog_Errors => ({
          ...currentErrors,
          [path]: messageFor(caughtError, 'The folder could not be opened.'),
        }));
      }

      return null;
    } finally {
      if (
        openSequence === openSequenceRef.current
        && requestSequence === requestSequencesRef.current.get(path)
      ) {
        setLoadingPaths((currentPaths: string[]): string[] => currentPaths.filter(
          (loadingPath: string): boolean => loadingPath !== path,
        ));
      }
    }
  }, [
    profileId,
    purpose,
    storeLevel,
  ]);

  // Moves the roving tree focus and optionally reveals the target.
  const focusTreePath = useCallback((path: string, scroll: boolean = false): void => {
    setFocusedPath(path);
    window.requestAnimationFrame((): void => {
      const row: HTMLDivElement | undefined = rowRefs.current.get(path);
      if (row !== undefined) {
        row.focus({ preventScroll: !scroll });
        if (scroll) {
          row.scrollIntoView({ block: 'nearest' });
        }
      }
    });
  }, []);

  useEffect((): (() => void) | undefined => {
    openSequenceRef.current += 1;
    const openSequence: number = openSequenceRef.current;
    if (!open) {
      return undefined;
    }

    levelsRef.current = {};
    requestSequencesRef.current.clear();
    treeFocusAfterCreateRef.current = null;
    treeFocusBeforeCreateRef.current = null;
    treeScrollTopBeforeCreateRef.current = 0;
    setLevels({});
    setExpandedPaths([]);
    setLoadingPaths([]);
    setLoadErrors({});
    setSelectedPath(null);
    setFocusedPath(null);
    setCreateParentPath(null);
    setFolderName('');
    setCreating(false);
    setCreateError('');
    setDeleteConfirmationOpen(false);
    setDeleting(false);
    setDeleteError('');

    const approvedInitialPath: string = (
      initialPath === '/data'
      || initialPath.startsWith('/data/')
    ) ? initialPath : '/data';

    /**
     * Directory Browser Dialog - Initialize.
     *
     * Loads each ancestor in order before revealing the initial folder.
     * The opening sequence prevents an older dialog state from winning a race.
     *
     * @since 2.0.0
     */
    const initialize = async (): Promise<void> => {
      for (const ancestorPath of directoryAncestorPaths(approvedInitialPath)) {
        if (openSequence !== openSequenceRef.current) {
          return;
        }

        if (await loadLevel(ancestorPath, true) === null) {
          break;
        }
      }

      if (openSequence !== openSequenceRef.current) {
        return;
      }

      const loadedEntries: Web_Api_DirectoryEntry[] = Object.values(levelsRef.current)
        .flatMap((directory: Web_Api_Directory): Web_Api_DirectoryEntry[] => directory['directories']);
      const initialEntry: Web_Api_DirectoryEntry | undefined = loadedEntries
        .find((entry: Web_Api_DirectoryEntry): boolean => entry['path'] === approvedInitialPath);
      const initialExpandedPaths: string[] = directoryExpandedPaths(approvedInitialPath);
      const nextExpandedPaths: string[] = initialExpandedPaths.filter(
        (path: string): boolean => {
          const ancestorEntry: Web_Api_DirectoryEntry | undefined = loadedEntries.find(
            (entry: Web_Api_DirectoryEntry): boolean => entry['path'] === path,
          );

          return (
            levelsRef.current[path] !== undefined
            && ancestorEntry?.['browsable'] === true
          );
        },
      );
      const initialPathRevealed: boolean = nextExpandedPaths.length === initialExpandedPaths.length;
      const firstEntry: Web_Api_DirectoryEntry | undefined = levelsRef.current['/data']?.['directories'][0];
      const nextFocusedPath: string | undefined = (
        initialPathRevealed && initialEntry !== undefined
      ) ? initialEntry['path'] : firstEntry?.['path'];

      setExpandedPaths(nextExpandedPaths);
      if (initialPathRevealed && initialEntry?.['selectable'] === true && initialEntry['usable']) {
        setSelectedPath(initialEntry['path']);
      }
      if (nextFocusedPath !== undefined) {
        window.requestAnimationFrame((): void => {
          window.requestAnimationFrame((): void => focusTreePath(nextFocusedPath, true));
        });
      }
    };

    void initialize();

    return (): void => {
      if (openSequenceRef.current === openSequence) {
        openSequenceRef.current += 1;
      }
    };
  }, [
    focusTreePath,
    initialPath,
    loadLevel,
    open,
  ]);

  /**
   * Directory Browser Dialog - Return to tree.
   *
   * Restores the tree viewport and the row that held roving focus before the
   * name step opened. Prevented focus scrolling keeps the viewport unchanged.
   *
   * @since 2.0.0
   */
  const returnToTree = (): void => {
    const previousFocusedPath: string | null = treeFocusBeforeCreateRef.current;
    const previousScrollTop: number = treeScrollTopBeforeCreateRef.current;

    setCreateParentPath(null);
    setFolderName('');
    setCreateError('');
    window.requestAnimationFrame((): void => {
      window.requestAnimationFrame((): void => {
        const tree: HTMLDivElement | null = treeRef.current;
        if (previousFocusedPath !== null) {
          rowRefs.current.get(previousFocusedPath)?.focus({ preventScroll: true });
        }
        if (tree !== null) {
          tree.scrollTop = previousScrollTop;
        }
      });
    });
  };

  /**
   * Directory Browser Dialog - Handle Escape.
   *
   * Returns from the name step or dismisses delete confirmation before closing.
   * Layered handling preserves the tree state beneath the active dialog content.
   *
   * @since 2.0.0
   */
  const handleEscape = (): void => {
    if (createParentPath !== null) {
      if (!creating) {
        returnToTree();
      }

      return;
    }

    if (deleteConfirmationOpen) {
      setDeleteConfirmationOpen(false);
      setDeleteError('');

      return;
    }

    onClose();
  };

  useEscapeKey(handleEscape, open);

  useEffect((): void => {
    if (createParentPath !== null) {
      createInputRef.current?.focus();
    }
  }, [createParentPath]);

  useEffect((): void => {
    const createdPath: string | null = treeFocusAfterCreateRef.current;
    if (createParentPath !== null || createdPath === null) {
      return;
    }

    const row: HTMLDivElement | undefined = rowRefs.current.get(createdPath);
    if (row === undefined) {
      return;
    }

    treeFocusAfterCreateRef.current = null;
    row.focus({ preventScroll: true });
    row.scrollIntoView({ block: 'nearest' });
  }, [
    createParentPath,
    expandedPaths,
    levels,
  ]);

  if (!open) {
    return null;
  }

  const selectedEntry: Web_Api_DirectoryEntry | undefined = Object.values(levels)
    .flatMap((directory: Web_Api_Directory): Web_Api_DirectoryEntry[] => directory['directories'])
    .find((entry: Web_Api_DirectoryEntry): boolean => entry['path'] === selectedPath);

  /**
   * Directory Browser Dialog - Entry has subfolders.
   *
   * Returns child state from a loaded level when one is available.
   * A refreshed cache corrects an older parent row after create or delete.
   *
   * @since 2.0.0
   */
  const entryHasSubfolders = (entry: Web_Api_DirectoryEntry): boolean => {
    const loadedLevel: Web_Api_Directory | undefined = levels[entry['path']];

    return (loadedLevel === undefined) ? entry['hasSubfolders'] : loadedLevel['directories'].length > 0;
  };

  const visibleItems: Web_Components_DirectoryBrowserDialog_VisibleItem[] = [];
  /**
   * Directory Browser Dialog - Append visible items.
   *
   * Flattens expanded levels into the visual order used by roving focus.
   * Recursive traversal keeps keyboard movement aligned with the rendered tree.
   *
   * @since 2.0.0
   */
  const appendVisibleItems = (parentPath: string, depth: number): void => {
    const directory: Web_Api_Directory | undefined = levels[parentPath];
    if (directory === undefined) {
      return;
    }

    for (const entry of directory['directories']) {
      visibleItems.push({
        depth,
        entry,
        parentPath,
      });
      if (expandedPaths.includes(entry['path'])) {
        appendVisibleItems(entry['path'], depth + 1);
      }
    }
  };
  appendVisibleItems('/data', 0);

  const keyboardItems: Web_DirectoryTree_Item[] = visibleItems.map(
    (item: Web_Components_DirectoryBrowserDialog_VisibleItem): Web_DirectoryTree_Item => ({
      expanded: expandedPaths.includes(item['entry']['path']),
      hasChildren: item['entry']['browsable'] && entryHasSubfolders(item['entry']),
      parentPath: item['parentPath'],
      path: item['entry']['path'],
    }),
  );

  /**
   * Directory Browser Dialog - Toggle selection.
   *
   * Selects a row, or clears it when the same row is selected again.
   * Confirmation state is tied to one selection and is discarded on change.
   *
   * @since 2.0.0
   */
  const toggleSelection = (entry: Web_Api_DirectoryEntry): void => {
    if (!entry['selectable'] || !entry['usable']) {
      return;
    }

    setSelectedPath((currentPath: string | null): string | null => (
      (currentPath === entry['path']) ? null : entry['path']
    ));
    setDeleteConfirmationOpen(false);
    setDeleteError('');
    focusTreePath(entry['path']);
  };

  /**
   * Directory Browser Dialog - Toggle expanded.
   *
   * Expands or collapses a row and lazily loads its children.
   * Unbrowsable entries never issue child requests. Purpose-unusable folders
   * remain navigable so a usable descendant can still be chosen.
   *
   * @since 2.0.0
   */
  const toggleExpanded = async (entry: Web_Api_DirectoryEntry): Promise<void> => {
    if (!entry['browsable'] || !entryHasSubfolders(entry)) {
      return;
    }

    if (expandedPaths.includes(entry['path'])) {
      setExpandedPaths((currentPaths: string[]): string[] => currentPaths.filter(
        (path: string): boolean => path !== entry['path'],
      ));

      return;
    }

    setExpandedPaths((currentPaths: string[]): string[] => [
      ...currentPaths,
      entry['path'],
    ]);
    await loadLevel(entry['path']);
  };

  /**
   * Directory Browser Dialog - Handle tree key down.
   *
   * Applies the WAI-ARIA tree keyboard pattern to one row.
   * Pure movement decisions are shared with the focused helper tests.
   *
   * @since 2.0.0
   */
  const handleTreeKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
    entry: Web_Api_DirectoryEntry,
  ): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const rowAction: Web_DirectoryTree_RowAction = directoryRowClickAction(
        entry['selectable'],
        entry['usable'],
        entry['browsable'],
        entryHasSubfolders(entry),
      );
      if (rowAction === 'select') {
        toggleSelection(entry);
      } else if (rowAction === 'toggle') {
        void toggleExpanded(entry);
      }

      return;
    }

    if (![
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'End',
      'Home',
    ].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const move: Web_DirectoryTree_Move = moveDirectoryTreeFocus(
      keyboardItems,
      entry['path'],
      event.key as Web_DirectoryTree_KeyboardKey,
    );
    if (move['action'] === 'expand') {
      void toggleExpanded(entry);
    } else if (move['action'] === 'collapse') {
      setExpandedPaths((currentPaths: string[]): string[] => currentPaths.filter(
        (path: string): boolean => path !== entry['path'],
      ));
    }
    focusTreePath(move['path']);
  };

  /**
   * Directory Browser Dialog - Begin create.
   *
   * Captures the tree viewport before opening the folder-name step.
   * The target follows selection and browsability without changing tree state.
   *
   * @since 2.0.0
   */
  const beginCreate = (): void => {
    let selectionPath: string | null = null;
    let selectionBrowsable: boolean = true;
    if (selectedEntry !== undefined) {
      selectionPath = selectedEntry['path'];
      selectionBrowsable = selectedEntry['browsable'];
    }

    const parentPath: string = directoryCreationParentPath(selectionPath, selectionBrowsable);
    const tree: HTMLDivElement | null = treeRef.current;
    treeFocusBeforeCreateRef.current = focusedPath;
    treeScrollTopBeforeCreateRef.current = (tree === null) ? 0 : tree.scrollTop;

    setFolderName('');
    setCreateError('');
    setCreateParentPath(parentPath);
    setDeleteConfirmationOpen(false);
    setDeleteError('');
  };

  /**
   * Directory Browser Dialog - Create folder.
   *
   * Creates the folder, refreshes its parent, then selects and reveals it.
   * Keeping the name step open on refresh failure leaves a visible recovery message.
   *
   * @since 2.0.0
   */
  const createFolder = async (): Promise<void> => {
    if (createParentPath === null || folderName.trim() === '') {
      return;
    }

    setCreating(true);
    setCreateError('');
    try {
      const createdDirectory: Web_Api_Directory = await createDirectory(
        {
          name: folderName.trim(),
          parentPath: createParentPath,
        },
        purpose,
        profileId,
      );
      const refreshedParent: Web_Api_Directory | null = await loadLevel(createParentPath, true);
      if (refreshedParent === null) {
        setCreateError('The folder was created, but the folder list could not be refreshed. Retry the folder list.');

        return;
      }

      if (createParentPath !== '/data') {
        setExpandedPaths((currentPaths: string[]): string[] => (
          (currentPaths.includes(createParentPath)) ? currentPaths : [
            ...currentPaths,
            createParentPath,
          ]
        ));
      }
      setCreateParentPath(null);
      setFolderName('');
      const createdEntry: Web_Api_DirectoryEntry | undefined = refreshedParent['directories'].find(
        (entry: Web_Api_DirectoryEntry): boolean => entry['path'] === createdDirectory['path'],
      );
      setSelectedPath((createdEntry?.['selectable'] === true && createdEntry['usable']) ? createdDirectory['path'] : null);
      setFocusedPath(createdDirectory['path']);
      setDeleteConfirmationOpen(false);
      treeFocusAfterCreateRef.current = createdDirectory['path'];
    } catch (caughtError) {
      setCreateError(messageFor(caughtError, 'The folder could not be created.'));
    } finally {
      setCreating(false);
    }
  };

  /**
   * Directory Browser Dialog - Delete selected folder.
   *
   * Deletes the selected folder and refreshes its parent level.
   * The follow-up request remains authoritative after the no-content response.
   *
   * @since 2.0.0
   */
  const deleteSelectedFolder = async (): Promise<void> => {
    if (selectedEntry === undefined || !selectedEntry['deletable']) {
      return;
    }

    const deletedName: string = selectedEntry['name'];
    const parentPath: string = parentPathFor(selectedEntry['path']);
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteDirectory(selectedEntry['path'], purpose, profileId);
      await loadLevel(parentPath, true);
      setSelectedPath(null);
      setDeleteConfirmationOpen(false);
      showToast(`Deleted “${deletedName}”.`, true);
    } catch (caughtError) {
      setDeleteError(messageFor(caughtError, 'The folder could not be deleted.'));
    } finally {
      setDeleting(false);
    }
  };

  /**
   * Directory Browser Dialog - Render level status.
   *
   * Renders loading and retry rows immediately below a level.
   * Cached rows remain present while a refreshed request is in flight.
   *
   * @since 2.0.0
   */
  const renderLevelStatus = (path: string, depth: number): ReactElement[] => {
    const rows: ReactElement[] = [];
    if (loadingPaths.includes(path)) {
      rows.push(<p className="folder-tree-status" key={`loading-${path}`} style={{ '--tree-depth': depth } as CSSProperties}>Loading…</p>);
    }
    const loadError: string | undefined = loadErrors[path];
    if (loadError !== undefined) {
      rows.push((
        <div className="folder-tree-error" key={`error-${path}`} role="alert" style={{ '--tree-depth': depth } as CSSProperties}>
          <span>{loadError}</span>
          <button
            onClick={(): void => {
              void loadLevel(path, true);
            }}
            type="button"
          >
            Retry
          </button>
        </div>
      ));
    }

    return rows;
  };

  /**
   * Directory Browser Dialog - Render level.
   *
   * Renders one cached level and its expanded descendants.
   * Indentation stays inside every full-width hover and selection tint.
   *
   * @since 2.0.0
   */
  const renderLevel = (parentPath: string, depth: number): ReactElement[] => {
    const rows: ReactElement[] = [];
    rows.push(...renderLevelStatus(parentPath, depth));

    const directory: Web_Api_Directory | undefined = levels[parentPath];
    if (directory === undefined) {
      return rows;
    }

    for (const entry of directory['directories']) {
      const selected: boolean = selectedPath === entry['path'];
      const expanded: boolean = expandedPaths.includes(entry['path']);
      const hasSubfolders: boolean = entryHasSubfolders(entry);
      const canShowToggle: boolean = hasSubfolders && entry['browsable'];
      const rowAction: Web_DirectoryTree_RowAction = directoryRowClickAction(
        entry['selectable'],
        entry['usable'],
        entry['browsable'],
        hasSubfolders,
      );
      rows.push((
        <div
          aria-disabled={(entry['selectable'] && entry['usable']) ? undefined : 'true'}
          aria-expanded={(canShowToggle) ? expanded : undefined}
          aria-level={depth + 1}
          aria-selected={selected}
          className={`folder-tree-row${(selected) ? ' is-selected' : ''}${(entry['usable']) ? '' : ' is-unusable'}`}
          key={entry['path']}
          onFocus={(): void => setFocusedPath(entry['path'])}
          onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>): void => handleTreeKeyDown(event, entry)}
          ref={(row: HTMLDivElement | null): void => {
            if (row === null) {
              rowRefs.current.delete(entry['path']);
            } else {
              rowRefs.current.set(entry['path'], row);
            }
          }}
          role="treeitem"
          style={{ '--tree-depth': depth } as CSSProperties}
          tabIndex={(focusedPath === entry['path'] || (focusedPath === null && visibleItems[0]?.['entry']['path'] === entry['path'])) ? 0 : -1}
          title={entry['unusableReason']}
        >
          {(canShowToggle) ? (
            <button
              aria-label={`${(expanded) ? 'Collapse' : 'Expand'} ${entry['name']}`}
              className="folder-tree-toggle"
              disabled={!entry['browsable']}
              onClick={(): void => {
                void toggleExpanded(entry);
              }}
              tabIndex={-1}
              type="button"
            >
              <span className={`folder-tree-toggle-icon${(expanded) ? ' is-open' : ''}`}><Icon name="chevron" size={12} /></span>
            </button>
          ) : <span aria-hidden="true" className="folder-tree-toggle" />}
          <button
            aria-label={(entry['usable'] || entry['unusableReason'] === undefined)
              ? `Select ${entry['name']}`
              : `Select ${entry['name']}. ${entry['unusableReason']}`}
            aria-disabled={(entry['selectable'] && entry['usable']) ? undefined : 'true'}
            className="folder-tree-select"
            onClick={(event): void => {
              if (event.detail === 1) {
                if (rowAction === 'select') {
                  toggleSelection(entry);
                } else if (rowAction === 'toggle') {
                  void toggleExpanded(entry);
                }
              }
            }}
            onDoubleClick={(): void => {
              if (rowAction === 'select') {
                void toggleExpanded(entry);
              }
            }}
            tabIndex={-1}
            title={entry['unusableReason']}
            type="button"
          >
            <Icon name="folder" size={15} />
            <strong className="folder-row-name">{entry['name']}</strong>
            {entry['tags'].map((tag: string): ReactElement => <span className="tag folder-tag" key={tag}>{tag}</span>)}
            {(selected) ? <span className="folder-selected-check"><Icon name="check" size={16} /></span> : null}
          </button>
        </div>
      ));
      if (expanded) {
        rows.push(...renderLevel(entry['path'], depth + 1));
      }
    }

    return rows;
  };

  const newFolderDisabled: boolean = loadingPaths.length > 0 || creating || deleting;
  let treeDialogTitle: string = 'Choose download location';
  if (purpose === 'incomplete') {
    treeDialogTitle = 'Choose incomplete folder';
  } else if (purpose === 'profile') {
    treeDialogTitle = 'Choose profile folder';
  }
  const dialogTitle: string = (createParentPath === null) ? treeDialogTitle : 'New folder';
  let selectionContent: ReactElement | undefined = undefined;

  if (selectedEntry === undefined) {
    selectionContent = (
      <div className="folder-selection folder-selection-empty">
        <Icon name="folder" size={18} />
        <span>No folder selected</span>
      </div>
    );
  } else if (deleteConfirmationOpen) {
    selectionContent = (
      <>
        <div className="folder-selection folder-selection-confirm">
          <div className="folder-selection-confirm-copy">
            <Icon name="warning" size={18} />
            <strong>{`Delete the empty folder “${selectedEntry['name']}”?`}</strong>
          </div>
          <div className="folder-selection-confirm-actions">
            <Button
              disabled={deleting}
              onClick={(): void => {
                setDeleteConfirmationOpen(false);
                setDeleteError('');
              }}
              variant="quiet"
            >
              Keep folder
            </Button>
            <Button
              disabled={deleting}
              icon="remove"
              onClick={(): void => {
                void deleteSelectedFolder();
              }}
              variant="danger"
            >
              {(deleting) ? 'Deleting…' : 'Delete folder'}
            </Button>
          </div>
        </div>
        {(deleteError === '') ? null : <p className="folder-delete-error" role="alert">{deleteError}</p>}
      </>
    );
  } else {
    selectionContent = (
      <>
        <div className="folder-selection folder-selection-current">
          <div className="folder-selection-copy">
            <Icon name="folder" size={18} />
            <span>
              <small>Selected</small>
              <code>{selectedEntry['path']}</code>
            </span>
          </div>
          <Button
            disabled={!selectedEntry['deletable']}
            icon="remove"
            onClick={(): void => {
              setDeleteConfirmationOpen(true);
              setDeleteError('');
            }}
            variant="quiet"
          >
            Delete
          </Button>
        </div>
        {(selectedEntry['deletable'] || selectedEntry['deleteUnavailableReason'] === undefined) ? null : (
          <p className="folder-delete-reason">
            <Icon name="warning" size={16} />
            <span>{selectedEntry['deleteUnavailableReason']}</span>
          </p>
        )}
      </>
    );
  }

  return createPortal((
    <div className="dialog-backdrop dialog-backdrop-directory folder-picker-backdrop" role="presentation">
      <section aria-labelledby="folder-picker-title" aria-modal="true" className="dialog dialog-directory-browser folder-picker-dialog" role="dialog">
        <div className="dialog-heading">
          <div>
            <h2 id="folder-picker-title">{dialogTitle}</h2>
            {(createParentPath === null) ? <p>Pick a folder inside /data, or make a new one.</p> : null}
          </div>
          <button aria-label="Close folder picker" className="icon-button folder-picker-close" onClick={onClose} type="button"><Icon name="x" size={18} /></button>
        </div>

        {(createParentPath === null) ? (
          <>
            <div className="folder-browser-area">
              <div className="folder-toolbar folder-tree-toolbar">
                <span>Folders in /data</span>
                <Button
                  disabled={newFolderDisabled}
                  icon="add"
                  onClick={beginCreate}
                >
                  New folder
                </Button>
              </div>
              <div aria-label="Folders in /data" className="folder-tree" ref={treeRef} role="tree">
                {renderLevel('/data', 0)}
              </div>
            </div>

            <div className="folder-selection-area">
              {selectionContent}
            </div>

            <div className="dialog-actions">
              <Button onClick={onClose}>Cancel</Button>
              <Button
                disabled={selectedEntry === undefined || !selectedEntry['usable']}
                icon="check"
                onClick={(): void => {
                  if (selectedEntry !== undefined && selectedEntry['usable']) {
                    onSelect(selectedEntry['path']);
                  }
                }}
                variant="primary"
              >
                Use this folder
              </Button>
            </div>
          </>
        ) : (
          <form
            className="folder-create-step"
            noValidate
            onSubmit={(event: FormEvent<HTMLFormElement>): void => {
              event.preventDefault();
              event.stopPropagation();
              void createFolder();
            }}
          >
            <div className="folder-create-inside">
              <span>Inside</span>
              <code>{createParentPath}</code>
            </div>
            <label className="field folder-create-field">
              <span>Folder name</span>
              <input
                aria-invalid={createError !== ''}
                autoComplete="off"
                disabled={creating}
                onChange={(event): void => setFolderName(event.currentTarget.value)}
                placeholder="e.g. Movies"
                ref={createInputRef}
                spellCheck={false}
                type="text"
                value={folderName}
              />
              {(createError === '') ? null : <small className="field-error" role="alert">{createError}</small>}
            </label>
            <div className="dialog-actions">
              <Button disabled={creating} onClick={returnToTree}>Cancel</Button>
              <Button
                disabled={creating || folderName.trim() === ''}
                type="submit"
                variant="primary"
              >
                {(creating) ? 'Creating…' : 'Create folder'}
              </Button>
            </div>
          </form>
        )}
      </section>
    </div>
  ), document.body);
};
