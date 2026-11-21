import {
  useEffect,
  useId,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { getBackupSourceDirectory } from '@/web/api.ts';
import {
  Button,
  Icon,
} from '@/web/primitives.tsx';
import { useDialogFocus } from '@/web/use-dialog-focus.ts';
import { useEscapeKey } from '@/web/use-escape-key.ts';

import type {
  Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_Busy,
  Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_BusyState,
  Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_DialogRef,
  Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_Directory,
  Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_DirectoryPath,
  Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_DirectoryState,
  Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_Error,
  Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_ErrorState,
  Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_InitialPath,
  Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_OnClose,
  Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_OnSelect,
  Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_Open,
  Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_OpenDirectory,
  Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_OpenDirectory_NextDirectory,
  Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_OpenDirectory_Path,
  Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_OpenDirectory_Returns,
  Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_ParentPath,
  Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_Props,
  Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_Returns,
  Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_SelectedDisplayPath,
  Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_SelectedPath,
  Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_SelectedPathState,
  Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_SetBusy,
  Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_SetDirectory,
  Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_SetError,
  Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_SetSelectedPath,
  Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_TitleId,
} from '@/types/web/backup-source-directory-dialog.d.ts';

/**
 * Backup Source Directory Dialog - Backup Source Directory Dialog.
 *
 * Reuses the console's folder-dialog treatment for read-only source mounts.
 * The server filters virtual system trees and symlinks before anything is shown.
 *
 * @param {Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_Props} props - Props.
 *
 * @returns {Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_Returns}
 *
 * @since 2.0.0
 */
export const BackupSourceDirectoryDialog = (props: Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_Props): Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_Returns => {
  const initialPath: Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_InitialPath = props['initialPath'];
  const onClose: Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_OnClose = props['onClose'];
  const onSelect: Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_OnSelect = props['onSelect'];
  const open: Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_Open = props['open'];
  const titleId: Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_TitleId = useId();
  const dialogRef: Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_DialogRef = useDialogFocus(open);
  const directoryState: Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_DirectoryState = useState<Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_Directory>(null);
  const directory: Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_Directory = directoryState[0];
  const setDirectory: Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_SetDirectory = directoryState[1];
  const selectedPathState: Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_SelectedPathState = useState<Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_SelectedPath>('');
  const selectedPath: Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_SelectedPath = selectedPathState[0];
  const setSelectedPath: Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_SetSelectedPath = selectedPathState[1];
  const busyState: Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_BusyState = useState<Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_Busy>(false);
  const busy: Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_Busy = busyState[0];
  const setBusy: Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_SetBusy = busyState[1];
  const errorState: Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_ErrorState = useState<Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_Error>('');
  const error: Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_Error = errorState[0];
  const setError: Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_SetError = errorState[1];

  /**
   * Backup Source Directory Dialog - Open Directory.
   *
   * Replaces the current read-only listing and selects the folder itself.
   * Server messages remain inline so an unreadable mount is actionable.
   *
   * @param {Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_OpenDirectory_Path} path - Path.
   *
   * @returns {Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_OpenDirectory_Returns}
   *
   * @since 2.0.0
   */
  const openDirectory: Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_OpenDirectory = async (path: Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_OpenDirectory_Path): Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_OpenDirectory_Returns => {
    setBusy(true);
    setError('');

    try {
      const nextDirectory: Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_OpenDirectory_NextDirectory = await getBackupSourceDirectory(path);

      setDirectory(nextDirectory);
      setSelectedPath(nextDirectory['path']);
    } catch (caughtError) {
      setError((caughtError instanceof Error) ? caughtError.message : 'That folder could not be opened.');
    } finally {
      setBusy(false);
    }

    return;
  };

  useEffect(() => {
    if (open === true) {
      setDirectory(null);
      setSelectedPath('');

      void openDirectory(initialPath);
    }

    return;
  }, [
    initialPath,
    open,
  ]);

  useEscapeKey(() => {
    if (busy === false) {
      onClose();
    }

    return;
  }, open);

  if (open === false) {
    return null;
  }

  const directoryPath: Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_DirectoryPath = (directory !== null) ? directory['path'] : undefined;
  const parentPath: Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_ParentPath = (directory !== null) ? directory['parentPath'] : undefined;
  let selectedDisplayPath: Web_BackupSourceDirectoryDialog_BackupSourceDirectoryDialog_SelectedDisplayPath = initialPath;

  if (directoryPath !== undefined && directoryPath !== '') {
    selectedDisplayPath = directoryPath;
  }

  if (selectedPath !== '') {
    selectedDisplayPath = selectedPath;
  }

  return createPortal((
    <div className="dialog-backdrop dialog-backdrop-directory folder-picker-backdrop" role="presentation">
      <section aria-labelledby={titleId} aria-modal="true" className="dialog dialog-directory-browser backup-source-picker" ref={dialogRef} role="dialog" tabIndex={-1}>
        <div className="dialog-heading">
          <div>
            <h2 id={titleId}>Choose config folder</h2>
            <p>Readable folders are shown. Nothing in them will be changed.</p>
          </div>
          <button aria-label="Close folder picker" className="icon-button" disabled={busy} onClick={onClose} type="button"><Icon name="x" size={18} /></button>
        </div>

        <div className="backup-source-browser">
          <div className="backup-source-browser-toolbar">
            <Button
              disabled={busy === true || parentPath === undefined}
              icon="chevron-left"
              onClick={() => {
                if (parentPath !== undefined) {
                  void openDirectory(parentPath);
                }

                return;
              }}
            >
              Up
            </Button>
            <code>{directoryPath ?? initialPath}</code>
          </div>
          {(busy === true && directory === null) ? (
            <div className="detail-loading">
              <span className="spinner" />
              {' '}
              Reading folders…
            </div>
          ) : null}
          {(error === '') ? null : <div className="form-error" role="alert">{error}</div>}
          {(directory === null) ? null : (
            <div aria-label={`Folders in ${directory['path']}`} className="backup-source-directory-list" role="listbox">
              {directory['directories'].map((entry) => (
                <div
                  aria-selected={selectedPath === entry['path']}
                  className={(selectedPath === entry['path']) ? 'is-selected' : ''}
                  key={entry['path']}
                  role="option"
                >
                  <button
                    className="backup-source-directory-select"
                    onClick={() => setSelectedPath(entry['path'])}
                    onDoubleClick={() => {
                      void openDirectory(entry['path']);

                      return;
                    }}
                    type="button"
                  >
                    <Icon name="folder" size={16} />
                    <span>{entry['name']}</span>
                  </button>
                  <button
                    aria-label={`Open ${entry['name']}`}
                    className="icon-button"
                    onClick={(event) => {
                      event.stopPropagation();

                      void openDirectory(entry['path']);

                      return;
                    }}
                    type="button"
                  >
                    <Icon name="chevron" size={14} />
                  </button>
                </div>
              ))}
              {(directory['directories'].length === 0) ? <p className="backup-source-directory-empty">No subfolders</p> : null}
            </div>
          )}
        </div>

        <div className="folder-selection folder-selection-current">
          <div className="folder-selection-copy">
            <Icon name="folder" size={18} />
            <span>
              <small>Selected</small>
              <code>{selectedDisplayPath}</code>
            </span>
          </div>
        </div>
        <div className="dialog-actions">
          <Button disabled={busy} onClick={onClose}>Cancel</Button>
          <Button
            disabled={busy === true || selectedPath === ''}
            icon="check"
            onClick={() => onSelect(selectedPath)}
            variant="primary"
          >
            Use this folder
          </Button>
        </div>
      </section>
    </div>
  ), document.body);
};
