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

import type { ReactElement } from 'react';

import type { Web_BackupView_SourceDirectoryDialogProps } from '@/types/web/backup-view.d.ts';
import type { Web_Backup_SourceDirectory } from '@/types/web/backup.d.ts';

/**
 * Backup Source Directory Dialog.
 *
 * Reuses the console's folder-dialog treatment for read-only source mounts.
 * The server filters virtual system trees and symlinks before anything is shown.
 *
 * @since UNRELEASED
 */
export const BackupSourceDirectoryDialog = ({
  initialPath,
  onClose,
  onSelect,
  open,
}: Web_BackupView_SourceDirectoryDialogProps): ReactElement | null => {
  const titleId: string = useId();
  const dialogRef = useDialogFocus(open);
  const [
    directory,
    setDirectory,
  ] = useState<Web_Backup_SourceDirectory | null>(null);
  const [
    selectedPath,
    setSelectedPath,
  ] = useState<string>('');
  const [
    busy,
    setBusy,
  ] = useState<boolean>(false);
  const [
    error,
    setError,
  ] = useState<string>('');

  /**
   * Backup Source Directory Dialog - Opens directory.
   *
   * Replaces the current read-only listing and selects the folder itself.
   * Server messages remain inline so an unreadable mount is actionable.
   *
   * @param {string} path - Path.
   *
   * @returns {Promise<void>}
   *
   * @since UNRELEASED
   */
  const openDirectory = async (path: string): Promise<void> => {
    setBusy(true);
    setError('');
    try {
      const nextDirectory: Web_Backup_SourceDirectory = await getBackupSourceDirectory(path);
      setDirectory(nextDirectory);
      setSelectedPath(nextDirectory['path']);
    } catch (caughtError) {
      setError((caughtError instanceof Error) ? caughtError.message : 'That folder could not be opened.');
    } finally {
      setBusy(false);
    }
  };

  useEffect((): void => {
    if (open) {
      setDirectory(null);
      setSelectedPath('');
      void openDirectory(initialPath);
    }
  }, [
    initialPath,
    open,
  ]);

  useEscapeKey((): void => {
    if (!busy) {
      onClose();
    }
  }, open);

  if (!open) {
    return null;
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
              disabled={busy || directory?.['parentPath'] === undefined}
              icon="chevron-left"
              onClick={(): void => {
                const parentPath: string | undefined = directory?.['parentPath'];
                if (parentPath !== undefined) {
                  void openDirectory(parentPath);
                }
              }}
            >
              Up
            </Button>
            <code>{directory?.['path'] ?? initialPath}</code>
          </div>
          {(busy && directory === null) ? (
            <div className="detail-loading">
              <span className="spinner" />
              {' '}
              Reading folders…
            </div>
          ) : null}
          {(error === '') ? null : <div className="form-error" role="alert">{error}</div>}
          {(directory === null) ? null : (
            <div aria-label={`Folders in ${directory['path']}`} className="backup-source-directory-list" role="listbox">
              {directory['directories'].map((entry): ReactElement => (
                <div
                  aria-selected={selectedPath === entry['path']}
                  className={(selectedPath === entry['path']) ? 'is-selected' : ''}
                  key={entry['path']}
                  role="option"
                >
                  <button
                    className="backup-source-directory-select"
                    onClick={(): void => setSelectedPath(entry['path'])}
                    onDoubleClick={(): void => {
                      void openDirectory(entry['path']);
                    }}
                    type="button"
                  >
                    <Icon name="folder" size={16} />
                    <span>{entry['name']}</span>
                  </button>
                  <button
                    aria-label={`Open ${entry['name']}`}
                    className="icon-button"
                    onClick={(event): void => {
                      event.stopPropagation();
                      void openDirectory(entry['path']);
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
              <code>{selectedPath || directory?.['path'] || initialPath}</code>
            </span>
          </div>
        </div>
        <div className="dialog-actions">
          <Button disabled={busy} onClick={onClose}>Cancel</Button>
          <Button
            disabled={busy || selectedPath === ''}
            icon="check"
            onClick={(): void => onSelect(selectedPath)}
            variant="primary"
          >
            Use this folder
          </Button>
        </div>
      </section>
    </div>
  ), document.body);
};
