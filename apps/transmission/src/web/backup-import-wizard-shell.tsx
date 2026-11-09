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

import type { ReactElement } from 'react';

import type {
  Web_BackupComponents_ImportWizardShell_Props,
  Web_BackupComponents_WizardStep,
} from '@/types/web/backup-components.d.ts';

/**
 * Backup Import Wizard Shell.
 *
 * Supplies the full-size dialog, step pills and predictable Back/Next controls while
 * app code owns the source-specific pages.
 *
 * @since UNRELEASED
 */
export const BackupImportWizardShell = ({
  backDisabled = false,
  busy = false,
  children,
  currentStep,
  description,
  hideNavigation = false,
  nextDisabled = false,
  nextIcon,
  nextLabel = 'Next',
  onBack,
  onClose,
  onNext,
  open,
  steps,
  title,
}: Web_BackupComponents_ImportWizardShell_Props): ReactElement | null => {
  const titleId: string = useId();
  const dialogRef = useDialogFocus(open, currentStep);
  useEffect((): void => {
    const body: HTMLElement | null = dialogRef.current?.querySelector<HTMLElement>('.backup-wizard-body') ?? null;
    if (open && body !== null) {
      body.scrollTop = 0;
      body.scrollLeft = 0;
    }

    // Narrow screens scroll the step strip sideways, so keep the current step in view.
    const pills: HTMLElement | null = dialogRef.current?.querySelector<HTMLElement>('.backup-step-pills') ?? null;
    const current: HTMLElement | null = pills?.querySelector<HTMLElement>('[aria-current="step"]') ?? null;
    if (open && pills !== null && current !== null) {
      const pillsBox: DOMRect = pills.getBoundingClientRect();
      const currentBox: DOMRect = current.getBoundingClientRect();
      pills.scrollLeft += (currentBox.left + (currentBox.width / 2)) - (pillsBox.left + (pillsBox.width / 2));
    }
  }, [
    currentStep,
    dialogRef,
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

  const currentIndex: number = steps.findIndex((step: Web_BackupComponents_WizardStep): boolean => step['id'] === currentStep);

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
          {steps.map((step: Web_BackupComponents_WizardStep, index: number): ReactElement => (
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
        {(hideNavigation) ? null : (
          <div className="dialog-actions backup-wizard-actions">
            <Button disabled={busy || backDisabled} onClick={onBack}>Back</Button>
            <Button {...((nextIcon === undefined) ? {} : { icon: nextIcon })} disabled={busy || nextDisabled} onClick={onNext} variant="primary">
              {(busy) ? 'Working…' : nextLabel}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
};
