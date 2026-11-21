import {
  useEffect,
  useId,
} from 'react';

import {
  Button,
  Icon,
} from '@/web/primitives.tsx';
import { useDialogFocus } from '@/web/use-dialog-focus.ts';
import { useEscapeKey } from '@/web/use-escape-key.ts';

import type {
  Web_BackupImportWizardShell_BackupImportWizardShell_BackDisabled,
  Web_BackupImportWizardShell_BackupImportWizardShell_Body,
  Web_BackupImportWizardShell_BackupImportWizardShell_Busy,
  Web_BackupImportWizardShell_BackupImportWizardShell_Children,
  Web_BackupImportWizardShell_BackupImportWizardShell_Current,
  Web_BackupImportWizardShell_BackupImportWizardShell_CurrentBox,
  Web_BackupImportWizardShell_BackupImportWizardShell_CurrentIndex,
  Web_BackupImportWizardShell_BackupImportWizardShell_CurrentStep,
  Web_BackupImportWizardShell_BackupImportWizardShell_Description,
  Web_BackupImportWizardShell_BackupImportWizardShell_Dialog,
  Web_BackupImportWizardShell_BackupImportWizardShell_DialogRef,
  Web_BackupImportWizardShell_BackupImportWizardShell_HideNavigation,
  Web_BackupImportWizardShell_BackupImportWizardShell_NextDisabled,
  Web_BackupImportWizardShell_BackupImportWizardShell_NextIcon,
  Web_BackupImportWizardShell_BackupImportWizardShell_NextLabel,
  Web_BackupImportWizardShell_BackupImportWizardShell_OnBack,
  Web_BackupImportWizardShell_BackupImportWizardShell_OnClose,
  Web_BackupImportWizardShell_BackupImportWizardShell_OnNext,
  Web_BackupImportWizardShell_BackupImportWizardShell_Open,
  Web_BackupImportWizardShell_BackupImportWizardShell_Pills,
  Web_BackupImportWizardShell_BackupImportWizardShell_PillsBox,
  Web_BackupImportWizardShell_BackupImportWizardShell_Props,
  Web_BackupImportWizardShell_BackupImportWizardShell_Returns,
  Web_BackupImportWizardShell_BackupImportWizardShell_Steps,
  Web_BackupImportWizardShell_BackupImportWizardShell_Title,
  Web_BackupImportWizardShell_BackupImportWizardShell_TitleId,
} from '@/types/web/backup-import-wizard-shell.d.ts';

/**
 * Backup Import Wizard Shell - Backup Import Wizard Shell.
 *
 * Supplies the full-size dialog, step pills and predictable Back/Next controls while
 * app code owns the source-specific pages.
 *
 * @param {Web_BackupImportWizardShell_BackupImportWizardShell_Props} props - Props.
 *
 * @returns {Web_BackupImportWizardShell_BackupImportWizardShell_Returns}
 *
 * @since 2.0.0
 */
export const BackupImportWizardShell = (props: Web_BackupImportWizardShell_BackupImportWizardShell_Props): Web_BackupImportWizardShell_BackupImportWizardShell_Returns => {
  const backDisabled: Web_BackupImportWizardShell_BackupImportWizardShell_BackDisabled = props['backDisabled'] ?? false;
  const busy: Web_BackupImportWizardShell_BackupImportWizardShell_Busy = props['busy'] ?? false;
  const children: Web_BackupImportWizardShell_BackupImportWizardShell_Children = props['children'];
  const currentStep: Web_BackupImportWizardShell_BackupImportWizardShell_CurrentStep = props['currentStep'];
  const description: Web_BackupImportWizardShell_BackupImportWizardShell_Description = props['description'];
  const hideNavigation: Web_BackupImportWizardShell_BackupImportWizardShell_HideNavigation = props['hideNavigation'] ?? false;
  const nextDisabled: Web_BackupImportWizardShell_BackupImportWizardShell_NextDisabled = props['nextDisabled'] ?? false;
  const nextIcon: Web_BackupImportWizardShell_BackupImportWizardShell_NextIcon = props['nextIcon'];
  const nextLabel: Web_BackupImportWizardShell_BackupImportWizardShell_NextLabel = props['nextLabel'] ?? 'Next';
  const onBack: Web_BackupImportWizardShell_BackupImportWizardShell_OnBack = props['onBack'];
  const onClose: Web_BackupImportWizardShell_BackupImportWizardShell_OnClose = props['onClose'];
  const onNext: Web_BackupImportWizardShell_BackupImportWizardShell_OnNext = props['onNext'];
  const open: Web_BackupImportWizardShell_BackupImportWizardShell_Open = props['open'];
  const steps: Web_BackupImportWizardShell_BackupImportWizardShell_Steps = props['steps'];
  const title: Web_BackupImportWizardShell_BackupImportWizardShell_Title = props['title'];
  const titleId: Web_BackupImportWizardShell_BackupImportWizardShell_TitleId = useId();
  const dialogRef: Web_BackupImportWizardShell_BackupImportWizardShell_DialogRef = useDialogFocus(open, currentStep);

  useEffect(() => {
    const dialog: Web_BackupImportWizardShell_BackupImportWizardShell_Dialog = dialogRef.current;
    const body: Web_BackupImportWizardShell_BackupImportWizardShell_Body = (dialog !== null) ? dialog.querySelector<HTMLElement>('.backup-wizard-body') : null;

    if (open === true && body !== null) {
      body.scrollTop = 0;
      body.scrollLeft = 0;
    }

    // Narrow screens scroll the step strip sideways, so keep the current step in view.
    const pills: Web_BackupImportWizardShell_BackupImportWizardShell_Pills = (dialog !== null) ? dialog.querySelector<HTMLElement>('.backup-step-pills') : null;
    const current: Web_BackupImportWizardShell_BackupImportWizardShell_Current = (pills !== null) ? pills.querySelector<HTMLElement>('[aria-current="step"]') : null;

    if (
      open === true
      && pills !== null
      && current !== null
    ) {
      const pillsBox: Web_BackupImportWizardShell_BackupImportWizardShell_PillsBox = pills.getBoundingClientRect();
      const currentBox: Web_BackupImportWizardShell_BackupImportWizardShell_CurrentBox = current.getBoundingClientRect();

      pills.scrollLeft += (currentBox.left + (currentBox.width / 2)) - (pillsBox.left + (pillsBox.width / 2));
    }

    return;
  }, [
    currentStep,
    dialogRef,
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

  const currentIndex: Web_BackupImportWizardShell_BackupImportWizardShell_CurrentIndex = steps.findIndex((step) => step['id'] === currentStep);

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="dialog dialog-wide backup-wizard"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="dialog-heading">
          <div>
            <h2 id={titleId}>{title}</h2>
            <p>{description}</p>
          </div>
          <button aria-label="Close" className="icon-button" disabled={busy} onClick={onClose} type="button">
            <Icon name="x" size={18} />
          </button>
        </div>
        <ol aria-label="Import steps" className="backup-step-pills">
          {steps.map((step, index) => (
            <li
              aria-current={(step['id'] === currentStep) ? 'step' : undefined}
              className={(index < currentIndex) ? 'is-complete' : ''}
              key={step['id']}
            >
              <span>{(index < currentIndex) ? <Icon name="check" size={13} /> : index + 1}</span>
              {step['label']}
            </li>
          ))}
        </ol>
        <div className="backup-wizard-body">{children}</div>
        {(hideNavigation === true) ? null : (
          <div className="dialog-actions backup-wizard-actions">
            <Button disabled={busy || backDisabled} onClick={onBack}>Back</Button>
            <Button {...((nextIcon === undefined) ? {} : { icon: nextIcon })} disabled={busy || nextDisabled} onClick={onNext} variant="primary">
              {(busy === true) ? 'Working…' : nextLabel}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
};
