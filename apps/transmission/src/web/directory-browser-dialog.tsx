import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import {
  ApiError,
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
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_AppendVisibleItems,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_AppendVisibleItems_Depth,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_AppendVisibleItems_Directory,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_AppendVisibleItems_ParentPath,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_AppendVisibleItems_Returns,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ApprovedInitialPath,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_BeginCreate,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_BeginCreate_ParentPath,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_BeginCreate_Returns,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_BeginCreate_SelectionBrowsable,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_BeginCreate_SelectionPath,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_BeginCreate_Tree,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreatedPath,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateError,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateErrorState,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateFolder,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateFolder_CreatedDirectory,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateFolder_ExistingFolder,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateFolder_ExistingPath,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateFolder_Name,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateFolder_ParentPath,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateFolder_RefreshedParent,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateFolder_Returns,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateFolder_Selected,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateInput,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateInputElement,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateInputRef,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateParentPath,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateParentPathState,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Creating,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreatingState,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_DeleteConfirmationOpen,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_DeleteConfirmationOpenState,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_DeleteError,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_DeleteErrorState,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_DeleteSelectedFolder,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_DeleteSelectedFolder_DeletedName,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_DeleteSelectedFolder_ParentPath,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_DeleteSelectedFolder_Returns,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Deleting,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_DeletingState,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_DialogTitle,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_EntryHasSubfolders,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_EntryHasSubfolders_Entry,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_EntryHasSubfolders_LoadedLevel,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_EntryHasSubfolders_Returns,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ExpandedPaths,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ExpandedPathsState,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_FocusedPath,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_FocusedPathState,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_FocusTreePath,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_FocusTreePath_Path,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_FocusTreePath_Returns,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_FocusTreePath_Row,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_FocusTreePath_Scroll,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_FolderName,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_FolderNameState,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_HandleEscape,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_HandleEscape_Returns,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_HandleTreeKeyDown,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_HandleTreeKeyDown_Entry,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_HandleTreeKeyDown_Event,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_HandleTreeKeyDown_KeyboardKey,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_HandleTreeKeyDown_Move,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_HandleTreeKeyDown_Returns,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_HandleTreeKeyDown_RowAction,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Initialize,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Initialize_AncestorEntry,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Initialize_FallbackFocusedPath,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Initialize_FirstEntry,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Initialize_InitialEntry,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Initialize_InitialExpandedPaths,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Initialize_InitialPathRevealed,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Initialize_LoadedEntries,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Initialize_NextExpandedPaths,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Initialize_NextFocusedPath,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Initialize_Returns,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Initialize_RootLevel,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_InitialPath,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_KeyboardItems,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Levels,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LevelsRef,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LevelsState,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LoadErrors,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LoadErrorsState,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LoadingPaths,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LoadingPathsState,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LoadLevel,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LoadLevel_CachedLevel,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LoadLevel_Directory,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LoadLevel_NextErrors,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LoadLevel_OpenSequence,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LoadLevel_Path,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LoadLevel_Refresh,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LoadLevel_RequestSequence,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LoadLevel_Returns,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_NewFolderDisabled,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_OnClose,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_OnSelect,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Open,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_OpenSequence,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_OpenSequenceRef,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ProfileId,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Props,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Purpose,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_CanShowToggle,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_Depth,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_Directory,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_Expanded,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_FirstVisibleItem,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_FirstVisiblePath,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_HasSubfolders,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_ParentPath,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_Returns,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_RowAction,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_Rows,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_Selected,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_SelectedClass,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_TabStop,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_ToggleIconClass,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_ToggleVerb,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_UnusableClass,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevelStatus,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevelStatus_Depth,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevelStatus_LoadError,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevelStatus_Path,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevelStatus_Returns,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevelStatus_Rows,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RequestSequences,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RequestSequencesRef,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Returns,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ReturnToTree,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ReturnToTree_PreviousFocusedPath,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ReturnToTree_PreviousRow,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ReturnToTree_PreviousScrollTop,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ReturnToTree_Returns,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ReturnToTree_Tree,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RevealFolder,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RevealFolder_FolderEntry,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RevealFolder_FolderPath,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RevealFolder_ParentLevel,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RevealFolder_ParentPath,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RevealFolder_Returns,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RevealFolder_Selectable,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Row,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RowElements,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RowRefs,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SelectedEntry,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SelectedPath,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SelectedPathState,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SelectionContent,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Sequence,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SetCreateError,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SetCreateParentPath,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SetCreating,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SetDeleteConfirmationOpen,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SetDeleteError,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SetDeleting,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SetExpandedPaths,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SetFocusedPath,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SetFolderName,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SetLevels,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SetLoadErrors,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SetLoadingPaths,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SetSelectedPath,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_StoreLevel,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_StoreLevel_Directory,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_StoreLevel_NextLevels,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_StoreLevel_Returns,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ToggleExpanded,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ToggleExpanded_Entry,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ToggleExpanded_Returns,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ToggleSelection,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ToggleSelection_Entry,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ToggleSelection_Returns,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_TreeDepthStyle,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_TreeDialogTitle,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_TreeElement,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_TreeFocusAfterCreateRef,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_TreeFocusBeforeCreateRef,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_TreeFocusPath,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_TreeRef,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_TreeScrollTop,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_TreeScrollTopBeforeCreateRef,
  Web_DirectoryBrowserDialog_DirectoryBrowserDialog_VisibleItems,
  Web_DirectoryBrowserDialog_MessageFor_CaughtError,
  Web_DirectoryBrowserDialog_MessageFor_Fallback,
  Web_DirectoryBrowserDialog_MessageFor_Returns,
  Web_DirectoryBrowserDialog_ParentPathFor_Path,
  Web_DirectoryBrowserDialog_ParentPathFor_Returns,
} from '@/types/web/directory-browser-dialog.d.ts';

/**
 * Directory Browser Dialog - Parent Path For.
 *
 * Returns the containing folder for a normalized path below /data.
 * Keeping the calculation here prevents mutations from targeting the wrong level.
 *
 * @param {Web_DirectoryBrowserDialog_ParentPathFor_Path} path - Path.
 *
 * @returns {Web_DirectoryBrowserDialog_ParentPathFor_Returns}
 *
 * @since 2.0.0
 */
const parentPathFor = (path: Web_DirectoryBrowserDialog_ParentPathFor_Path): Web_DirectoryBrowserDialog_ParentPathFor_Returns => path.slice(0, path.lastIndexOf('/')) || '/data';

/**
 * Directory Browser Dialog - Message For.
 *
 * Preserves server messages and supplies a stable fallback for non-Error failures.
 * Inline actions use the same conversion so their error treatment stays consistent.
 *
 * @param {Web_DirectoryBrowserDialog_MessageFor_CaughtError} caughtError - Caught error.
 * @param {Web_DirectoryBrowserDialog_MessageFor_Fallback}    fallback    - Fallback.
 *
 * @returns {Web_DirectoryBrowserDialog_MessageFor_Returns}
 *
 * @since 2.0.0
 */
const messageFor = (caughtError: Web_DirectoryBrowserDialog_MessageFor_CaughtError, fallback: Web_DirectoryBrowserDialog_MessageFor_Fallback): Web_DirectoryBrowserDialog_MessageFor_Returns => (
  (caughtError instanceof Error) ? caughtError.message : fallback
);

/**
 * Directory Browser Dialog - Directory Browser Dialog.
 *
 * Presents every folder below /data as one lazily loaded, keyboard-navigable tree.
 * Cached levels remain visible while a refreshed level is requested after a mutation.
 *
 * @param {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Props} props - Props.
 *
 * @returns {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Returns}
 *
 * @since 2.0.0
 */
export const DirectoryBrowserDialog = (props: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Props): Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Returns => {
  const initialPath: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_InitialPath = props['initialPath'];
  const onClose: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_OnClose = props['onClose'];
  const onSelect: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_OnSelect = props['onSelect'];
  const open: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Open = props['open'];
  const profileId: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ProfileId = props['profileId'];
  const purpose: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Purpose = props['purpose'] ?? 'download';
  const levelsState: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LevelsState = useState<Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Levels>({});
  const levels: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Levels = levelsState[0];
  const setLevels: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SetLevels = levelsState[1];
  const expandedPathsState: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ExpandedPathsState = useState<Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ExpandedPaths>([]);
  const expandedPaths: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ExpandedPaths = expandedPathsState[0];
  const setExpandedPaths: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SetExpandedPaths = expandedPathsState[1];
  const loadingPathsState: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LoadingPathsState = useState<Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LoadingPaths>([]);
  const loadingPaths: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LoadingPaths = loadingPathsState[0];
  const setLoadingPaths: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SetLoadingPaths = loadingPathsState[1];
  const loadErrorsState: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LoadErrorsState = useState<Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LoadErrors>({});
  const loadErrors: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LoadErrors = loadErrorsState[0];
  const setLoadErrors: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SetLoadErrors = loadErrorsState[1];
  const selectedPathState: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SelectedPathState = useState<Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SelectedPath>(null);
  const selectedPath: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SelectedPath = selectedPathState[0];
  const setSelectedPath: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SetSelectedPath = selectedPathState[1];
  const focusedPathState: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_FocusedPathState = useState<Web_DirectoryBrowserDialog_DirectoryBrowserDialog_FocusedPath>(null);
  const focusedPath: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_FocusedPath = focusedPathState[0];
  const setFocusedPath: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SetFocusedPath = focusedPathState[1];
  const createParentPathState: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateParentPathState = useState<Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateParentPath>(null);
  const createParentPath: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateParentPath = createParentPathState[0];
  const setCreateParentPath: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SetCreateParentPath = createParentPathState[1];
  const folderNameState: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_FolderNameState = useState<Web_DirectoryBrowserDialog_DirectoryBrowserDialog_FolderName>('');
  const folderName: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_FolderName = folderNameState[0];
  const setFolderName: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SetFolderName = folderNameState[1];
  const creatingState: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreatingState = useState<Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Creating>(false);
  const creating: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Creating = creatingState[0];
  const setCreating: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SetCreating = creatingState[1];
  const createErrorState: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateErrorState = useState<Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateError>('');
  const createError: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateError = createErrorState[0];
  const setCreateError: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SetCreateError = createErrorState[1];
  const deleteConfirmationOpenState: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_DeleteConfirmationOpenState = useState<Web_DirectoryBrowserDialog_DirectoryBrowserDialog_DeleteConfirmationOpen>(false);
  const deleteConfirmationOpen: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_DeleteConfirmationOpen = deleteConfirmationOpenState[0];
  const setDeleteConfirmationOpen: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SetDeleteConfirmationOpen = deleteConfirmationOpenState[1];
  const deletingState: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_DeletingState = useState<Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Deleting>(false);
  const deleting: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Deleting = deletingState[0];
  const setDeleting: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SetDeleting = deletingState[1];
  const deleteErrorState: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_DeleteErrorState = useState<Web_DirectoryBrowserDialog_DirectoryBrowserDialog_DeleteError>('');
  const deleteError: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_DeleteError = deleteErrorState[0];
  const setDeleteError: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SetDeleteError = deleteErrorState[1];
  const levelsRef: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LevelsRef = useRef<Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Levels>({});
  const openSequenceRef: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_OpenSequenceRef = useRef<Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Sequence>(0);
  const requestSequencesRef: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RequestSequencesRef = useRef<Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RequestSequences>(new Map());
  const rowRefs: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RowRefs = useRef<Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RowElements>(new Map());
  const treeFocusAfterCreateRef: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_TreeFocusAfterCreateRef = useRef<Web_DirectoryBrowserDialog_DirectoryBrowserDialog_TreeFocusPath>(null);
  const treeFocusBeforeCreateRef: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_TreeFocusBeforeCreateRef = useRef<Web_DirectoryBrowserDialog_DirectoryBrowserDialog_TreeFocusPath>(null);
  const treeRef: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_TreeRef = useRef<Web_DirectoryBrowserDialog_DirectoryBrowserDialog_TreeElement>(null);
  const treeScrollTopBeforeCreateRef: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_TreeScrollTopBeforeCreateRef = useRef<Web_DirectoryBrowserDialog_DirectoryBrowserDialog_TreeScrollTop>(0);
  const createInputRef: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateInputRef = useRef<Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateInputElement>(null);

  // Stores one authoritative level in both the render state and request cache.
  const storeLevel: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_StoreLevel = useCallback((directory: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_StoreLevel_Directory): Web_DirectoryBrowserDialog_DirectoryBrowserDialog_StoreLevel_Returns => {
    const nextLevels: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_StoreLevel_NextLevels = {
      ...levelsRef.current,
      [directory['path']]: directory,
    };

    levelsRef.current = nextLevels;

    setLevels(nextLevels);

    return;
  }, []);

  // Loads one level while ignoring replies superseded for the same path or dialog opening.
  const loadLevel: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LoadLevel = useCallback(async (
    path: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LoadLevel_Path,
    refresh: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LoadLevel_Refresh = false,
  ): Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LoadLevel_Returns => {
    const cachedLevel: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LoadLevel_CachedLevel = levelsRef.current[path];

    if (refresh === false && cachedLevel !== undefined) {
      return cachedLevel;
    }

    const openSequence: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LoadLevel_OpenSequence = openSequenceRef.current;
    const requestSequence: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LoadLevel_RequestSequence = (requestSequencesRef.current.get(path) ?? 0) + 1;

    requestSequencesRef.current.set(path, requestSequence);

    setLoadingPaths((currentPaths) => (
      (currentPaths.includes(path) === true) ? currentPaths : [
        ...currentPaths,
        path,
      ]
    ));
    setLoadErrors((currentErrors) => {
      const nextErrors: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LoadLevel_NextErrors = { ...currentErrors };

      Reflect.deleteProperty(nextErrors, path);

      return nextErrors;
    });

    try {
      const directory: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_LoadLevel_Directory = await getDirectory(path, purpose, profileId);

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
        setLoadErrors((currentErrors) => ({
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
        setLoadingPaths((currentPaths) => currentPaths.filter(
          (loadingPath) => loadingPath !== path,
        ));
      }
    }
  }, [
    profileId,
    purpose,
    storeLevel,
  ]);

  // Moves the roving tree focus and optionally reveals the target.
  const focusTreePath: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_FocusTreePath = useCallback((path: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_FocusTreePath_Path, scroll: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_FocusTreePath_Scroll = false): Web_DirectoryBrowserDialog_DirectoryBrowserDialog_FocusTreePath_Returns => {
    setFocusedPath(path);

    window.requestAnimationFrame(() => {
      const row: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_FocusTreePath_Row = rowRefs.current.get(path);

      if (row !== undefined) {
        row.focus({ preventScroll: scroll === false });

        if (scroll === true) {
          row.scrollIntoView({ block: 'nearest' });
        }
      }

      return;
    });

    return;
  }, []);

  useEffect(() => {
    openSequenceRef.current += 1;

    const openSequence: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_OpenSequence = openSequenceRef.current;

    if (open === false) {
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

    const approvedInitialPath: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ApprovedInitialPath = (
      initialPath === '/data'
      || initialPath.startsWith('/data/') === true
    ) ? initialPath : '/data';

    /**
     * Directory Browser Dialog - Initialize.
     *
     * Loads each ancestor in order before revealing the initial folder.
     * The opening sequence prevents an older dialog state from winning a race.
     *
     * @returns {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Initialize_Returns}
     *
     * @since 2.0.0
     */
    const initialize: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Initialize = async (): Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Initialize_Returns => {
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

      const loadedEntries: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Initialize_LoadedEntries = Object.values(levelsRef.current)
        .flatMap((directory) => directory['directories']);
      const initialEntry: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Initialize_InitialEntry = loadedEntries
        .find((entry) => entry['path'] === approvedInitialPath);
      const initialExpandedPaths: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Initialize_InitialExpandedPaths = directoryExpandedPaths(approvedInitialPath);
      const nextExpandedPaths: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Initialize_NextExpandedPaths = initialExpandedPaths.filter(
        (path) => {
          const ancestorEntry: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Initialize_AncestorEntry = loadedEntries.find(
            (entry) => entry['path'] === path,
          );

          return (
            levelsRef.current[path] !== undefined
            && ancestorEntry !== undefined
            && ancestorEntry['browsable'] === true
          );
        },
      );
      const initialPathRevealed: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Initialize_InitialPathRevealed = nextExpandedPaths.length === initialExpandedPaths.length;
      const rootLevel: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Initialize_RootLevel = levelsRef.current['/data'];
      const firstEntry: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Initialize_FirstEntry = (rootLevel !== undefined) ? rootLevel['directories'][0] : undefined;
      const fallbackFocusedPath: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Initialize_FallbackFocusedPath = (firstEntry !== undefined) ? firstEntry['path'] : undefined;
      const nextFocusedPath: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Initialize_NextFocusedPath = (
        initialPathRevealed === true && initialEntry !== undefined
      ) ? initialEntry['path'] : fallbackFocusedPath;

      setExpandedPaths(nextExpandedPaths);

      if (
        initialPathRevealed === true
        && initialEntry !== undefined
        && initialEntry['selectable'] === true
        && initialEntry['usable'] === true
      ) {
        setSelectedPath(initialEntry['path']);
      }

      if (nextFocusedPath !== undefined) {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => focusTreePath(nextFocusedPath, true));

          return;
        });
      }

      return;
    };

    void initialize();

    return () => {
      if (openSequenceRef.current === openSequence) {
        openSequenceRef.current += 1;
      }

      return;
    };
  }, [
    focusTreePath,
    initialPath,
    loadLevel,
    open,
  ]);

  /**
   * Directory Browser Dialog - Return To Tree.
   *
   * Restores the tree viewport and the row that held roving focus before the
   * name step opened. Prevented focus scrolling keeps the viewport unchanged.
   *
   * @returns {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ReturnToTree_Returns}
   *
   * @since 2.0.0
   */
  const returnToTree: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ReturnToTree = (): Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ReturnToTree_Returns => {
    const previousFocusedPath: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ReturnToTree_PreviousFocusedPath = treeFocusBeforeCreateRef.current;
    const previousScrollTop: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ReturnToTree_PreviousScrollTop = treeScrollTopBeforeCreateRef.current;

    setCreateParentPath(null);
    setFolderName('');
    setCreateError('');

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const tree: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ReturnToTree_Tree = treeRef.current;

        if (previousFocusedPath !== null) {
          const previousRow: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ReturnToTree_PreviousRow = rowRefs.current.get(previousFocusedPath);

          if (previousRow !== undefined) {
            previousRow.focus({ preventScroll: true });
          }
        }

        if (tree !== null) {
          tree.scrollTop = previousScrollTop;
        }

        return;
      });

      return;
    });

    return;
  };

  /**
   * Directory Browser Dialog - Handle Escape.
   *
   * Returns from the name step or dismisses delete confirmation before closing.
   * Layered handling preserves the tree state beneath the active dialog content.
   *
   * @returns {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_HandleEscape_Returns}
   *
   * @since 2.0.0
   */
  const handleEscape: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_HandleEscape = (): Web_DirectoryBrowserDialog_DirectoryBrowserDialog_HandleEscape_Returns => {
    if (createParentPath !== null) {
      if (creating === false) {
        returnToTree();
      }

      return;
    }

    if (deleteConfirmationOpen === true) {
      setDeleteConfirmationOpen(false);
      setDeleteError('');

      return;
    }

    onClose();

    return;
  };

  useEscapeKey(handleEscape, open);

  useEffect(() => {
    if (createParentPath !== null) {
      const createInput: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateInput = createInputRef.current;

      if (createInput !== null) {
        createInput.focus();
      }
    }

    return;
  }, [createParentPath]);

  useEffect(() => {
    const createdPath: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreatedPath = treeFocusAfterCreateRef.current;

    if (createParentPath !== null || createdPath === null) {
      return;
    }

    const row: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_Row = rowRefs.current.get(createdPath);

    if (row === undefined) {
      return;
    }

    treeFocusAfterCreateRef.current = null;

    row.focus({ preventScroll: true });

    row.scrollIntoView({ block: 'nearest' });

    return;
  }, [
    createParentPath,
    expandedPaths,
    levels,
  ]);

  if (open === false) {
    return null;
  }

  const selectedEntry: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SelectedEntry = Object.values(levels)
    .flatMap((directory) => directory['directories'])
    .find((entry) => entry['path'] === selectedPath);

  /**
   * Directory Browser Dialog - Entry Has Subfolders.
   *
   * Returns child state from a loaded level when one is available.
   * A refreshed cache corrects an older parent row after create or delete.
   *
   * @param {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_EntryHasSubfolders_Entry} entry - Entry.
   *
   * @returns {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_EntryHasSubfolders_Returns}
   *
   * @since 2.0.0
   */
  const entryHasSubfolders: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_EntryHasSubfolders = (entry: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_EntryHasSubfolders_Entry): Web_DirectoryBrowserDialog_DirectoryBrowserDialog_EntryHasSubfolders_Returns => {
    const loadedLevel: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_EntryHasSubfolders_LoadedLevel = levels[entry['path']];

    return (loadedLevel === undefined) ? entry['hasSubfolders'] : loadedLevel['directories'].length > 0;
  };

  const visibleItems: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_VisibleItems = [];

  /**
   * Directory Browser Dialog - Append Visible Items.
   *
   * Flattens expanded levels into the visual order used by roving focus.
   * Recursive traversal keeps keyboard movement aligned with the rendered tree.
   *
   * @param {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_AppendVisibleItems_ParentPath} parentPath - Parent path.
   * @param {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_AppendVisibleItems_Depth}      depth      - Depth.
   *
   * @returns {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_AppendVisibleItems_Returns}
   *
   * @since 2.0.0
   */
  const appendVisibleItems: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_AppendVisibleItems = (parentPath: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_AppendVisibleItems_ParentPath, depth: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_AppendVisibleItems_Depth): Web_DirectoryBrowserDialog_DirectoryBrowserDialog_AppendVisibleItems_Returns => {
    const directory: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_AppendVisibleItems_Directory = levels[parentPath];

    if (directory === undefined) {
      return;
    }

    for (const entry of directory['directories']) {
      visibleItems.push({
        depth,
        entry,
        parentPath,
      });

      if (expandedPaths.includes(entry['path']) === true) {
        appendVisibleItems(entry['path'], depth + 1);
      }
    }

    return;
  };

  appendVisibleItems('/data', 0);

  const keyboardItems: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_KeyboardItems = visibleItems.map(
    (item) => ({
      expanded: expandedPaths.includes(item['entry']['path']),
      hasChildren: item['entry']['browsable'] && entryHasSubfolders(item['entry']),
      parentPath: item['parentPath'],
      path: item['entry']['path'],
    }),
  );

  /**
   * Directory Browser Dialog - Toggle Selection.
   *
   * Selects a row, or clears it when the same row is selected again.
   * Confirmation state is tied to one selection and is discarded on change.
   *
   * @param {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ToggleSelection_Entry} entry - Entry.
   *
   * @returns {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ToggleSelection_Returns}
   *
   * @since 2.0.0
   */
  const toggleSelection: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ToggleSelection = (entry: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ToggleSelection_Entry): Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ToggleSelection_Returns => {
    if (entry['selectable'] === false || entry['usable'] === false) {
      return;
    }

    setSelectedPath((currentPath) => (
      (currentPath === entry['path']) ? null : entry['path']
    ));
    setDeleteConfirmationOpen(false);
    setDeleteError('');
    focusTreePath(entry['path']);

    return;
  };

  /**
   * Directory Browser Dialog - Toggle Expanded.
   *
   * Expands or collapses a row and lazily loads its children.
   * Unbrowsable entries never issue child requests. Purpose-unusable folders
   * remain navigable so a usable descendant can still be chosen.
   *
   * @param {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ToggleExpanded_Entry} entry - Entry.
   *
   * @returns {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ToggleExpanded_Returns}
   *
   * @since 2.0.0
   */
  const toggleExpanded: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ToggleExpanded = async (entry: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ToggleExpanded_Entry): Web_DirectoryBrowserDialog_DirectoryBrowserDialog_ToggleExpanded_Returns => {
    if (entry['browsable'] === false || entryHasSubfolders(entry) === false) {
      return;
    }

    if (expandedPaths.includes(entry['path']) === true) {
      setExpandedPaths((currentPaths) => currentPaths.filter(
        (path) => path !== entry['path'],
      ));

      return;
    }

    setExpandedPaths((currentPaths) => [
      ...currentPaths,
      entry['path'],
    ]);

    await loadLevel(entry['path']);

    return;
  };

  /**
   * Directory Browser Dialog - Handle Tree Key Down.
   *
   * Applies the WAI-ARIA tree keyboard pattern to one row.
   * Pure movement decisions are shared with the focused helper tests.
   *
   * @param {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_HandleTreeKeyDown_Event} event - Event.
   * @param {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_HandleTreeKeyDown_Entry} entry - Entry.
   *
   * @returns {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_HandleTreeKeyDown_Returns}
   *
   * @since 2.0.0
   */
  const handleTreeKeyDown: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_HandleTreeKeyDown = (
    event: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_HandleTreeKeyDown_Event,
    entry: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_HandleTreeKeyDown_Entry,
  ): Web_DirectoryBrowserDialog_DirectoryBrowserDialog_HandleTreeKeyDown_Returns => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();

      const rowAction: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_HandleTreeKeyDown_RowAction = directoryRowClickAction(
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

    if ([
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'End',
      'Home',
    ].includes(event.key) === false) {
      return;
    }

    event.preventDefault();

    const move: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_HandleTreeKeyDown_Move = moveDirectoryTreeFocus(
      keyboardItems,
      entry['path'],
      event.key as Web_DirectoryBrowserDialog_DirectoryBrowserDialog_HandleTreeKeyDown_KeyboardKey,
    );

    if (move['action'] === 'expand') {
      void toggleExpanded(entry);
    } else if (move['action'] === 'collapse') {
      setExpandedPaths((currentPaths) => currentPaths.filter(
        (path) => path !== entry['path'],
      ));
    }

    focusTreePath(move['path']);

    return;
  };

  /**
   * Directory Browser Dialog - Begin Create.
   *
   * Captures the tree viewport before opening the folder-name step.
   * The target follows selection and browsability without changing tree state.
   *
   * @returns {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_BeginCreate_Returns}
   *
   * @since 2.0.0
   */
  const beginCreate: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_BeginCreate = (): Web_DirectoryBrowserDialog_DirectoryBrowserDialog_BeginCreate_Returns => {
    let selectionPath: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_BeginCreate_SelectionPath = null;
    let selectionBrowsable: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_BeginCreate_SelectionBrowsable = true;

    if (selectedEntry !== undefined) {
      selectionPath = selectedEntry['path'];
      selectionBrowsable = selectedEntry['browsable'];
    }

    const parentPath: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_BeginCreate_ParentPath = directoryCreationParentPath(selectionPath, selectionBrowsable);
    const tree: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_BeginCreate_Tree = treeRef.current;

    treeFocusBeforeCreateRef.current = focusedPath;
    treeScrollTopBeforeCreateRef.current = (tree === null) ? 0 : tree.scrollTop;

    setFolderName('');
    setCreateError('');
    setCreateParentPath(parentPath);
    setDeleteConfirmationOpen(false);
    setDeleteError('');

    return;
  };

  /**
   * Directory Browser Dialog - Reveal Folder.
   *
   * Leaves the name step and shows one folder inside its refreshed, expanded parent.
   * The folder is selected only when it can be chosen; the result reports which.
   *
   * @param {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RevealFolder_ParentPath}  parentPath  - Parent path.
   * @param {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RevealFolder_ParentLevel} parentLevel - Parent level.
   * @param {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RevealFolder_FolderPath}  folderPath  - Folder path.
   *
   * @returns {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RevealFolder_Returns}
   *
   * @since 2.1.0
   */
  const revealFolder: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RevealFolder = (
    parentPath: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RevealFolder_ParentPath,
    parentLevel: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RevealFolder_ParentLevel,
    folderPath: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RevealFolder_FolderPath,
  ): Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RevealFolder_Returns => {
    const folderEntry: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RevealFolder_FolderEntry = parentLevel['directories'].find(
      (entry) => entry['path'] === folderPath,
    );
    const selectable: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RevealFolder_Selectable = (
      folderEntry !== undefined
      && folderEntry['selectable'] === true
      && folderEntry['usable'] === true
    );

    if (parentPath !== '/data') {
      setExpandedPaths((currentPaths) => (
        (currentPaths.includes(parentPath) === true) ? currentPaths : [
          ...currentPaths,
          parentPath,
        ]
      ));
    }

    setCreateParentPath(null);
    setFolderName('');
    setSelectedPath((selectable === true) ? folderPath : null);
    setFocusedPath(folderPath);
    setDeleteConfirmationOpen(false);
    treeFocusAfterCreateRef.current = folderPath;

    return selectable;
  };

  /**
   * Directory Browser Dialog - Create Folder.
   *
   * Creates the folder, refreshes its parent, then selects and reveals it. A name
   * that is already a folder there reveals that folder instead of failing.
   * Keeping the name step open on refresh failure leaves a visible recovery message.
   *
   * @returns {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateFolder_Returns}
   *
   * @since 2.0.0
   */
  const createFolder: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateFolder = async (): Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateFolder_Returns => {
    if (createParentPath === null || folderName.trim() === '') {
      return;
    }

    const parentPath: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateFolder_ParentPath = createParentPath;
    const name: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateFolder_Name = folderName.trim();

    setCreating(true);
    setCreateError('');

    try {
      const createdDirectory: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateFolder_CreatedDirectory = await createDirectory(
        {
          name,
          parentPath,
        },
        purpose,
        profileId,
      );
      const refreshedParent: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateFolder_RefreshedParent = await loadLevel(parentPath, true);

      if (refreshedParent === null) {
        setCreateError('The folder was created, but the folder list could not be refreshed. Retry the folder list.');

        return;
      }

      revealFolder(parentPath, refreshedParent, createdDirectory['path']);
    } catch (caughtError) {
      if (!(caughtError instanceof ApiError) || caughtError['code'] !== 'directory_exists') {
        setCreateError(messageFor(caughtError, 'The folder could not be created.'));

        return;
      }

      const existingPath: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateFolder_ExistingPath = `${parentPath}/${name}`;
      const refreshedParent: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateFolder_RefreshedParent = await loadLevel(parentPath, true);

      if (refreshedParent === null) {
        setCreateError(caughtError['message']);

        return;
      }

      // The tree lists only real folders, so a file or link with this name stays hidden.
      const existingFolder: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateFolder_ExistingFolder = refreshedParent['directories'].some(
        (entry) => entry['path'] === existingPath,
      );

      if (existingFolder === false) {
        setCreateError(`Something named “${name}” is already in ${parentPath}, and it isn’t a folder. Use another name.`);

        return;
      }

      const selected: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_CreateFolder_Selected = revealFolder(parentPath, refreshedParent, existingPath);

      showToast((selected === true) ? `“${name}” was already in ${parentPath}, so it’s selected.` : `“${name}” is already in ${parentPath}.`, true);
    } finally {
      setCreating(false);
    }

    return;
  };

  /**
   * Directory Browser Dialog - Delete Selected Folder.
   *
   * Deletes the selected folder and refreshes its parent level.
   * The follow-up request remains authoritative after the no-content response.
   *
   * @returns {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_DeleteSelectedFolder_Returns}
   *
   * @since 2.0.0
   */
  const deleteSelectedFolder: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_DeleteSelectedFolder = async (): Web_DirectoryBrowserDialog_DirectoryBrowserDialog_DeleteSelectedFolder_Returns => {
    if (selectedEntry === undefined || selectedEntry['deletable'] === false) {
      return;
    }

    const deletedName: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_DeleteSelectedFolder_DeletedName = selectedEntry['name'];
    const parentPath: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_DeleteSelectedFolder_ParentPath = parentPathFor(selectedEntry['path']);

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

    return;
  };

  /**
   * Directory Browser Dialog - Render Level Status.
   *
   * Renders loading and retry rows immediately below a level.
   * Cached rows remain present while a refreshed request is in flight.
   *
   * @param {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevelStatus_Path}  path  - Path.
   * @param {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevelStatus_Depth} depth - Depth.
   *
   * @returns {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevelStatus_Returns}
   *
   * @since 2.0.0
   */
  const renderLevelStatus: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevelStatus = (path: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevelStatus_Path, depth: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevelStatus_Depth): Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevelStatus_Returns => {
    const rows: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevelStatus_Rows = [];

    if (loadingPaths.includes(path) === true) {
      rows.push(<p className="folder-tree-status" key={`loading-${path}`} style={{ '--tree-depth': depth } as Web_DirectoryBrowserDialog_DirectoryBrowserDialog_TreeDepthStyle}>Loading…</p>);
    }

    const loadError: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevelStatus_LoadError = loadErrors[path];

    if (loadError !== undefined) {
      rows.push((
        <div className="folder-tree-error" key={`error-${path}`} role="alert" style={{ '--tree-depth': depth } as Web_DirectoryBrowserDialog_DirectoryBrowserDialog_TreeDepthStyle}>
          <span>{loadError}</span>
          <button
            onClick={() => {
              void loadLevel(path, true);

              return;
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
   * Directory Browser Dialog - Render Level.
   *
   * Renders one cached level and its expanded descendants.
   * Indentation stays inside every full-width hover and selection tint.
   *
   * @param {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_ParentPath} parentPath - Parent path.
   * @param {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_Depth}      depth      - Depth.
   *
   * @returns {Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_Returns}
   *
   * @since 2.0.0
   */
  const renderLevel: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel = (parentPath: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_ParentPath, depth: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_Depth): Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_Returns => {
    const rows: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_Rows = [];

    rows.push(...renderLevelStatus(parentPath, depth));

    const directory: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_Directory = levels[parentPath];

    if (directory === undefined) {
      return rows;
    }

    const firstVisibleItem: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_FirstVisibleItem = visibleItems[0];
    const firstVisiblePath: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_FirstVisiblePath = (firstVisibleItem !== undefined) ? firstVisibleItem['entry']['path'] : undefined;

    for (const entry of directory['directories']) {
      const selected: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_Selected = selectedPath === entry['path'];
      const expanded: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_Expanded = expandedPaths.includes(entry['path']);
      const hasSubfolders: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_HasSubfolders = entryHasSubfolders(entry);
      const canShowToggle: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_CanShowToggle = hasSubfolders && entry['browsable'];
      const rowAction: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_RowAction = directoryRowClickAction(
        entry['selectable'],
        entry['usable'],
        entry['browsable'],
        hasSubfolders,
      );
      const selectedClass: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_SelectedClass = (selected === true) ? ' is-selected' : '';
      const unusableClass: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_UnusableClass = (entry['usable'] === true) ? '' : ' is-unusable';
      const tabStop: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_TabStop = (
        focusedPath === entry['path']
        || (
          focusedPath === null
          && firstVisiblePath === entry['path']
        )
      );
      const toggleVerb: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_ToggleVerb = (expanded === true) ? 'Collapse' : 'Expand';
      const toggleIconClass: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_RenderLevel_ToggleIconClass = (expanded === true) ? ' is-open' : '';

      rows.push((
        <div
          aria-disabled={(entry['selectable'] === true && entry['usable'] === true) ? undefined : 'true'}
          aria-expanded={(canShowToggle === true) ? expanded : undefined}
          aria-level={depth + 1}
          aria-selected={selected}
          className={`folder-tree-row${selectedClass}${unusableClass}`}
          key={entry['path']}
          onFocus={() => setFocusedPath(entry['path'])}
          onKeyDown={(event) => handleTreeKeyDown(event, entry)}
          ref={(row) => {
            if (row === null) {
              rowRefs.current.delete(entry['path']);
            } else {
              rowRefs.current.set(entry['path'], row);
            }

            return;
          }}
          role="treeitem"
          style={{ '--tree-depth': depth } as Web_DirectoryBrowserDialog_DirectoryBrowserDialog_TreeDepthStyle}
          tabIndex={(tabStop === true) ? 0 : -1}
          title={entry['unusableReason']}
        >
          {(canShowToggle === true) ? (
            <button
              aria-label={`${toggleVerb} ${entry['name']}`}
              className="folder-tree-toggle"
              disabled={entry['browsable'] === false}
              onClick={() => {
                void toggleExpanded(entry);

                return;
              }}
              tabIndex={-1}
              type="button"
            >
              <span className={`folder-tree-toggle-icon${toggleIconClass}`}><Icon name="chevron" size={12} /></span>
            </button>
          ) : <span aria-hidden="true" className="folder-tree-toggle" />}
          <button
            aria-label={(entry['usable'] === true || entry['unusableReason'] === undefined)
              ? `Select ${entry['name']}`
              : `Select ${entry['name']}. ${entry['unusableReason']}`}
            aria-disabled={(entry['selectable'] === true && entry['usable'] === true) ? undefined : 'true'}
            className="folder-tree-select"
            onClick={(event) => {
              if (event.detail === 1) {
                if (rowAction === 'select') {
                  toggleSelection(entry);
                } else if (rowAction === 'toggle') {
                  void toggleExpanded(entry);
                }
              }

              return;
            }}
            onDoubleClick={() => {
              if (rowAction === 'select') {
                void toggleExpanded(entry);
              }

              return;
            }}
            tabIndex={-1}
            title={entry['unusableReason']}
            type="button"
          >
            <Icon name="folder" size={15} />
            <strong className="folder-row-name">{entry['name']}</strong>
            {entry['tags'].map((tag) => <span className="tag folder-tag" key={tag}>{tag}</span>)}
            {(selected === true) ? <span className="folder-selected-check"><Icon name="check" size={16} /></span> : null}
          </button>
        </div>
      ));

      if (expanded === true) {
        rows.push(...renderLevel(entry['path'], depth + 1));
      }
    }

    return rows;
  };

  const newFolderDisabled: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_NewFolderDisabled = (
    loadingPaths.length > 0
    || creating === true
    || deleting === true
  );
  let treeDialogTitle: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_TreeDialogTitle = 'Choose download location';

  if (purpose === 'incomplete') {
    treeDialogTitle = 'Choose incomplete folder';
  } else if (purpose === 'profile') {
    treeDialogTitle = 'Choose profile folder';
  }

  const dialogTitle: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_DialogTitle = (createParentPath === null) ? treeDialogTitle : 'New folder';
  let selectionContent: Web_DirectoryBrowserDialog_DirectoryBrowserDialog_SelectionContent = undefined;

  if (selectedEntry === undefined) {
    selectionContent = (
      <div className="folder-selection folder-selection-empty">
        <Icon name="folder" size={18} />
        <span>No folder selected</span>
      </div>
    );
  } else if (deleteConfirmationOpen === true) {
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
              onClick={() => {
                setDeleteConfirmationOpen(false);
                setDeleteError('');

                return;
              }}
              variant="quiet"
            >
              Keep folder
            </Button>
            <Button
              disabled={deleting}
              icon="remove"
              onClick={() => {
                void deleteSelectedFolder();

                return;
              }}
              variant="danger"
            >
              {(deleting === true) ? 'Deleting…' : 'Delete folder'}
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
            disabled={selectedEntry['deletable'] === false}
            icon="remove"
            onClick={() => {
              setDeleteConfirmationOpen(true);
              setDeleteError('');

              return;
            }}
            variant="quiet"
          >
            Delete
          </Button>
        </div>
        {(selectedEntry['deletable'] === true || selectedEntry['deleteUnavailableReason'] === undefined) ? null : (
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
                disabled={selectedEntry === undefined || selectedEntry['usable'] === false}
                icon="check"
                onClick={() => {
                  if (selectedEntry !== undefined && selectedEntry['usable'] === true) {
                    onSelect(selectedEntry['path']);
                  }

                  return;
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
            onSubmit={(event) => {
              event.preventDefault();

              event.stopPropagation();

              void createFolder();

              return;
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
                onChange={(event) => setFolderName(event.currentTarget.value)}
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
                {(creating === true) ? 'Creating…' : 'Create folder'}
              </Button>
            </div>
          </form>
        )}
      </section>
    </div>
  ), document.body);
};
