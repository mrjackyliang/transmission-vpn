import { useId } from 'react';

import {
  Button,
  Icon,
} from '@/web/primitives.tsx';
import { useDialogFocus } from '@/web/use-dialog-focus.ts';
import { useEscapeKey } from '@/web/use-escape-key.ts';

import type {
  FormEvent,
  ReactElement,
} from 'react';

import type { Web_Components_ConfirmDialog_Props } from '@/types/web/components.d.ts';

/**
 * Confirm Dialog.
 *
 * Asks before an action that removes or replaces something, with a title,
 * one sentence, Cancel, and the action. Extra fields, like a password,
 * go between the sentence and the buttons.
 *
 * @since 2.0.0
 */
export const ConfirmDialog = ({
  busy,
  busyLabel,
  children,
  confirmDisabled = false,
  confirmLabel,
  error,
  message,
  onCancel,
  onConfirm,
  open,
  title,
  tone = 'danger',
}: Web_Components_ConfirmDialog_Props): ReactElement | null => {
  const titleId: string = useId();
  const messageId: string = useId();
  const dialogRef = useDialogFocus(open);

  useEscapeKey((): void => {
    if (!busy) {
      onCancel();
    }
  }, open);

  if (!open) {
    return null;
  }

  /**
   * Confirm Dialog - Submit.
   *
   * Runs the action from the button or from Enter in a field.
   * Nothing runs while the action is busy or not allowed yet.
   *
   * @since 2.0.0
   */
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (busy || confirmDisabled) {
      return;
    }

    onConfirm();
  };

  return (
    <div className="dialog-backdrop" role="presentation">
      <section aria-describedby={messageId} aria-labelledby={titleId} aria-modal="true" className="dialog dialog-small" ref={dialogRef} role="alertdialog" tabIndex={-1}>
        <div className="dialog-heading">
          <h2 id={titleId}>{title}</h2>
          <button aria-label="Close" className="icon-button" disabled={busy} onClick={onCancel} type="button">
            <Icon name="x" size={18} />
          </button>
        </div>

        <form noValidate onSubmit={submit}>
          <p className="dialog-message" id={messageId}>{message}</p>
          {children}
          {(error === '') ? null : (
            <div className="form-error" role="alert">
              <Icon name="warning" size={16} />
              <span>{error}</span>
            </div>
          )}
          <div className="dialog-actions">
            <Button disabled={busy} onClick={onCancel}>Cancel</Button>
            <Button disabled={busy || confirmDisabled} type="submit" variant={tone}>{(busy) ? busyLabel : confirmLabel}</Button>
          </div>
        </form>
      </section>
    </div>
  );
};
