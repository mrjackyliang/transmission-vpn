import {
  useEffect,
  useId,
  useState,
} from 'react';

import { ConfirmIdentityStep } from '@/web/confirm-identity-step.tsx';
import {
  Button,
  Icon,
} from '@/web/primitives.tsx';
import { useDialogFocus } from '@/web/use-dialog-focus.ts';
import { useEscapeKey } from '@/web/use-escape-key.ts';

import type { ReactElement } from 'react';

import type {
  Web_BackupComponents_ExportDialog_Props,
  Web_BackupComponents_ExportOption,
  Web_BackupComponents_ExportSelection,
} from '@/types/web/backup-components.d.ts';

/**
 * Backup Export Dialog.
 *
 * Collects portable sections before requiring a fresh, single-use identity grant.
 * Keeps secret-bearing export data out of browser application state.
 *
 * @since UNRELEASED
 */
export const BackupExportDialog = ({
  authenticatorEnabled,
  description,
  onClose,
  onConfirm,
  onExport,
  onPasskey,
  open,
  options,
  passkeyAvailable,
  secretWarning,
  title,
}: Web_BackupComponents_ExportDialog_Props): ReactElement | null => {
  const [
    step,
    setStep,
  ] = useState<'sections' | 'confirm'>('sections');
  const [
    selection,
    setSelection,
  ] = useState<Web_BackupComponents_ExportSelection>({});
  const [
    exportError,
    setExportError,
  ] = useState<string>('');
  const titleId: string = useId();
  const dialogRef = useDialogFocus(open, step);

  useEffect((): void => {
    if (!open) {
      return;
    }
    setStep('sections');
    setSelection(Object.fromEntries(options.map((option: Web_BackupComponents_ExportOption): [string, boolean] => [
      option['id'],
      true,
    ])));
    setExportError('');
  }, [
    open,
    options,
  ]);

  useEscapeKey(onClose, open);

  if (!open) {
    return null;
  }

  const selectedCount: number = Object.values(selection).filter(Boolean).length;

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="dialog backup-export-dialog"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="dialog-heading dialog-heading-stepped">
          <div>
            <h2 id={titleId}>{(step === 'sections') ? title : 'Confirm it’s you'}</h2>
          </div>
          <div className="dialog-heading-end">
            <span className="dialog-step">{`Step ${(step === 'sections') ? 1 : 2} of 2`}</span>
            <button aria-label="Close" className="icon-button" onClick={onClose} type="button">
              <Icon name="x" size={18} />
            </button>
          </div>
          <p>{(step === 'sections') ? description : 'This export can reveal passwords and keys.'}</p>
        </div>

        {(step === 'confirm') ? (
          <ConfirmIdentityStep
            authenticatorEnabled={authenticatorEnabled}
            description="Enter the sign-in details for this account. The confirmation works for this export only."
            onBack={(): void => {
              setExportError('');
              setStep('sections');
            }}
            onConfirm={onConfirm}
            onConfirmed={async (grant: string): Promise<void> => {
              setExportError('');
              try {
                await onExport(selection, grant);
                onClose();
              } catch (caughtError) {
                setExportError((caughtError instanceof Error) ? caughtError.message : 'The export could not be created.');
                throw caughtError;
              }
            }}
            onPasskey={onPasskey}
            passkeyAvailable={passkeyAvailable}
          />
        ) : (
          <div className="dialog-body">
            <div className="backup-export-options">
              {options.map((option: Web_BackupComponents_ExportOption): ReactElement => (
                <label aria-label={option['label']} className="check-row" htmlFor={`backup-export-${option['id']}`} key={option['id']}>
                  <input
                    checked={selection[option['id']] ?? false}
                    id={`backup-export-${option['id']}`}
                    onChange={(event): void => setSelection((current: Web_BackupComponents_ExportSelection): Web_BackupComponents_ExportSelection => ({
                      ...current,
                      [option['id']]: event.target.checked,
                    }))}
                    type="checkbox"
                  />
                  <span>
                    <strong>{option['label']}</strong>
                    <small>{option['description']}</small>
                  </span>
                </label>
              ))}
            </div>
            <div className="backup-secret-warning">
              <Icon name="warning" size={18} />
              <span>{secretWarning}</span>
            </div>
            {(exportError === '') ? null : <div className="form-error" role="alert">{exportError}</div>}
            <div className="dialog-actions">
              <Button onClick={onClose}>Cancel</Button>
              <Button disabled={selectedCount === 0} onClick={(): void => setStep('confirm')} variant="primary">Continue</Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
