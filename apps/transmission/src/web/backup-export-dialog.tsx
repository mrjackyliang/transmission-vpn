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

import type {
  Web_BackupExportDialog_BackupExportDialog_AuthenticatorEnabled,
  Web_BackupExportDialog_BackupExportDialog_Description,
  Web_BackupExportDialog_BackupExportDialog_DialogRef,
  Web_BackupExportDialog_BackupExportDialog_ExportError,
  Web_BackupExportDialog_BackupExportDialog_ExportErrorState,
  Web_BackupExportDialog_BackupExportDialog_NextChecked,
  Web_BackupExportDialog_BackupExportDialog_OnClose,
  Web_BackupExportDialog_BackupExportDialog_OnConfirm,
  Web_BackupExportDialog_BackupExportDialog_OnExport,
  Web_BackupExportDialog_BackupExportDialog_OnPasskey,
  Web_BackupExportDialog_BackupExportDialog_Open,
  Web_BackupExportDialog_BackupExportDialog_Options,
  Web_BackupExportDialog_BackupExportDialog_PasskeyAvailable,
  Web_BackupExportDialog_BackupExportDialog_Props,
  Web_BackupExportDialog_BackupExportDialog_Returns,
  Web_BackupExportDialog_BackupExportDialog_SecretWarning,
  Web_BackupExportDialog_BackupExportDialog_SelectedCount,
  Web_BackupExportDialog_BackupExportDialog_Selection,
  Web_BackupExportDialog_BackupExportDialog_SelectionState,
  Web_BackupExportDialog_BackupExportDialog_SetExportError,
  Web_BackupExportDialog_BackupExportDialog_SetSelection,
  Web_BackupExportDialog_BackupExportDialog_SetStep,
  Web_BackupExportDialog_BackupExportDialog_Step,
  Web_BackupExportDialog_BackupExportDialog_StepNumber,
  Web_BackupExportDialog_BackupExportDialog_StepState,
  Web_BackupExportDialog_BackupExportDialog_Title,
  Web_BackupExportDialog_BackupExportDialog_TitleId,
} from '@/types/web/backup-export-dialog.d.ts';

/**
 * Backup Export Dialog - Backup Export Dialog.
 *
 * Collects portable sections before requiring a fresh, single-use identity grant.
 * Keeps secret-bearing export data out of browser application state.
 *
 * @param {Web_BackupExportDialog_BackupExportDialog_Props} props - Props.
 *
 * @returns {Web_BackupExportDialog_BackupExportDialog_Returns}
 *
 * @since 2.0.0
 */
export const BackupExportDialog = (props: Web_BackupExportDialog_BackupExportDialog_Props): Web_BackupExportDialog_BackupExportDialog_Returns => {
  const authenticatorEnabled: Web_BackupExportDialog_BackupExportDialog_AuthenticatorEnabled = props['authenticatorEnabled'];
  const description: Web_BackupExportDialog_BackupExportDialog_Description = props['description'];
  const onClose: Web_BackupExportDialog_BackupExportDialog_OnClose = props['onClose'];
  const onConfirm: Web_BackupExportDialog_BackupExportDialog_OnConfirm = props['onConfirm'];
  const onExport: Web_BackupExportDialog_BackupExportDialog_OnExport = props['onExport'];
  const onPasskey: Web_BackupExportDialog_BackupExportDialog_OnPasskey = props['onPasskey'];
  const open: Web_BackupExportDialog_BackupExportDialog_Open = props['open'];
  const options: Web_BackupExportDialog_BackupExportDialog_Options = props['options'];
  const passkeyAvailable: Web_BackupExportDialog_BackupExportDialog_PasskeyAvailable = props['passkeyAvailable'];
  const secretWarning: Web_BackupExportDialog_BackupExportDialog_SecretWarning = props['secretWarning'];
  const title: Web_BackupExportDialog_BackupExportDialog_Title = props['title'];
  const stepState: Web_BackupExportDialog_BackupExportDialog_StepState = useState<Web_BackupExportDialog_BackupExportDialog_Step>('sections');
  const step: Web_BackupExportDialog_BackupExportDialog_Step = stepState[0];
  const setStep: Web_BackupExportDialog_BackupExportDialog_SetStep = stepState[1];
  const selectionState: Web_BackupExportDialog_BackupExportDialog_SelectionState = useState<Web_BackupExportDialog_BackupExportDialog_Selection>({});
  const selection: Web_BackupExportDialog_BackupExportDialog_Selection = selectionState[0];
  const setSelection: Web_BackupExportDialog_BackupExportDialog_SetSelection = selectionState[1];
  const exportErrorState: Web_BackupExportDialog_BackupExportDialog_ExportErrorState = useState<Web_BackupExportDialog_BackupExportDialog_ExportError>('');
  const exportError: Web_BackupExportDialog_BackupExportDialog_ExportError = exportErrorState[0];
  const setExportError: Web_BackupExportDialog_BackupExportDialog_SetExportError = exportErrorState[1];
  const titleId: Web_BackupExportDialog_BackupExportDialog_TitleId = useId();
  const dialogRef: Web_BackupExportDialog_BackupExportDialog_DialogRef = useDialogFocus(open, step);

  useEffect(() => {
    if (open === false) {
      return;
    }

    setStep('sections');

    setSelection(Object.fromEntries(options.map((option) => [
      option['id'],
      true,
    ])));

    setExportError('');

    return;
  }, [
    open,
    options,
  ]);

  useEscapeKey(onClose, open);

  if (open === false) {
    return null;
  }

  const selectedCount: Web_BackupExportDialog_BackupExportDialog_SelectedCount = Object.values(selection).filter(Boolean).length;
  const stepNumber: Web_BackupExportDialog_BackupExportDialog_StepNumber = (step === 'sections') ? 1 : 2;

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
            <span className="dialog-step">{`Step ${stepNumber} of 2`}</span>
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
            onBack={() => {
              setExportError('');

              setStep('sections');

              return;
            }}
            onConfirm={onConfirm}
            onConfirmed={async (grant) => {
              setExportError('');

              try {
                await onExport(selection, grant);

                onClose();
              } catch (caughtError) {
                setExportError((caughtError instanceof Error) ? caughtError.message : 'The export could not be created.');

                throw caughtError;
              }

              return;
            }}
            onPasskey={onPasskey}
            passkeyAvailable={passkeyAvailable}
          />
        ) : (
          <div className="dialog-body">
            <div className="backup-export-options">
              {options.map((option) => (
                <label aria-label={option['label']} className="check-row" htmlFor={`backup-export-${option['id']}`} key={option['id']}>
                  <input
                    checked={selection[option['id']] ?? false}
                    id={`backup-export-${option['id']}`}
                    onChange={(event) => {
                      const nextChecked: Web_BackupExportDialog_BackupExportDialog_NextChecked = event.target.checked;

                      setSelection((current) => ({
                        ...current,
                        [option['id']]: nextChecked,
                      }));

                      return;
                    }}
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
              <Button disabled={selectedCount === 0} onClick={() => setStep('confirm')} variant="primary">Continue</Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
