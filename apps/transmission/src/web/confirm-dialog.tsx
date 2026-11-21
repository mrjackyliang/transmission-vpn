import { useId } from 'react';

import {
  Button,
  Icon,
} from '@/web/primitives.tsx';
import { useDialogFocus } from '@/web/use-dialog-focus.ts';
import { useEscapeKey } from '@/web/use-escape-key.ts';

import type {
  Web_ConfirmDialog_ConfirmDialog_Busy,
  Web_ConfirmDialog_ConfirmDialog_BusyLabel,
  Web_ConfirmDialog_ConfirmDialog_Children,
  Web_ConfirmDialog_ConfirmDialog_ConfirmDisabled,
  Web_ConfirmDialog_ConfirmDialog_ConfirmLabel,
  Web_ConfirmDialog_ConfirmDialog_DialogRef,
  Web_ConfirmDialog_ConfirmDialog_Error,
  Web_ConfirmDialog_ConfirmDialog_Message,
  Web_ConfirmDialog_ConfirmDialog_MessageId,
  Web_ConfirmDialog_ConfirmDialog_OnCancel,
  Web_ConfirmDialog_ConfirmDialog_OnConfirm,
  Web_ConfirmDialog_ConfirmDialog_Open,
  Web_ConfirmDialog_ConfirmDialog_Props,
  Web_ConfirmDialog_ConfirmDialog_Returns,
  Web_ConfirmDialog_ConfirmDialog_Submit,
  Web_ConfirmDialog_ConfirmDialog_Submit_Event,
  Web_ConfirmDialog_ConfirmDialog_Submit_Returns,
  Web_ConfirmDialog_ConfirmDialog_Title,
  Web_ConfirmDialog_ConfirmDialog_TitleId,
  Web_ConfirmDialog_ConfirmDialog_Tone,
} from '@/types/web/confirm-dialog.d.ts';

/**
 * Confirm Dialog - Confirm Dialog.
 *
 * Asks before an action that removes or replaces something, with a title,
 * one sentence, Cancel, and the action. Extra fields, like a password,
 * go between the sentence and the buttons.
 *
 * @param {Web_ConfirmDialog_ConfirmDialog_Props} props - Props.
 *
 * @returns {Web_ConfirmDialog_ConfirmDialog_Returns}
 *
 * @since 2.0.0
 */
export const ConfirmDialog = (props: Web_ConfirmDialog_ConfirmDialog_Props): Web_ConfirmDialog_ConfirmDialog_Returns => {
  const busy: Web_ConfirmDialog_ConfirmDialog_Busy = props['busy'];
  const busyLabel: Web_ConfirmDialog_ConfirmDialog_BusyLabel = props['busyLabel'];
  const children: Web_ConfirmDialog_ConfirmDialog_Children = props['children'];
  const confirmDisabled: Web_ConfirmDialog_ConfirmDialog_ConfirmDisabled = props['confirmDisabled'] ?? false;
  const confirmLabel: Web_ConfirmDialog_ConfirmDialog_ConfirmLabel = props['confirmLabel'];
  const error: Web_ConfirmDialog_ConfirmDialog_Error = props['error'];
  const message: Web_ConfirmDialog_ConfirmDialog_Message = props['message'];
  const onCancel: Web_ConfirmDialog_ConfirmDialog_OnCancel = props['onCancel'];
  const onConfirm: Web_ConfirmDialog_ConfirmDialog_OnConfirm = props['onConfirm'];
  const open: Web_ConfirmDialog_ConfirmDialog_Open = props['open'];
  const title: Web_ConfirmDialog_ConfirmDialog_Title = props['title'];
  const tone: Web_ConfirmDialog_ConfirmDialog_Tone = props['tone'] ?? 'danger';
  const titleId: Web_ConfirmDialog_ConfirmDialog_TitleId = useId();
  const messageId: Web_ConfirmDialog_ConfirmDialog_MessageId = useId();
  const dialogRef: Web_ConfirmDialog_ConfirmDialog_DialogRef = useDialogFocus(open);

  useEscapeKey(() => {
    if (busy === false) {
      onCancel();
    }

    return;
  }, open);

  if (open === false) {
    return null;
  }

  /**
   * Confirm Dialog - Submit.
   *
   * Runs the action from the button or from Enter in a field.
   * Nothing runs while the action is busy or not allowed yet.
   *
   * @param {Web_ConfirmDialog_ConfirmDialog_Submit_Event} event - Event.
   *
   * @returns {Web_ConfirmDialog_ConfirmDialog_Submit_Returns}
   *
   * @since 2.0.0
   */
  const submit: Web_ConfirmDialog_ConfirmDialog_Submit = (event: Web_ConfirmDialog_ConfirmDialog_Submit_Event): Web_ConfirmDialog_ConfirmDialog_Submit_Returns => {
    event.preventDefault();

    if (busy === true || confirmDisabled === true) {
      return;
    }

    onConfirm();

    return;
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
            <Button disabled={busy || confirmDisabled} type="submit" variant={tone}>{(busy === true) ? busyLabel : confirmLabel}</Button>
          </div>
        </form>
      </section>
    </div>
  );
};
