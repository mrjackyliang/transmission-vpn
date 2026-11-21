import {
  useEffect,
  useRef,
} from 'react';

import type {
  Web_UseDialogFocus_UseDialogFocus_Action,
  Web_UseDialogFocus_UseDialogFocus_Dialog,
  Web_UseDialogFocus_UseDialogFocus_DialogRef,
  Web_UseDialogFocus_UseDialogFocus_Field,
  Web_UseDialogFocus_UseDialogFocus_FocusKey,
  Web_UseDialogFocus_UseDialogFocus_InitialTarget,
  Web_UseDialogFocus_UseDialogFocus_Open,
  Web_UseDialogFocus_UseDialogFocus_Opener,
  Web_UseDialogFocus_UseDialogFocus_Returns,
} from '@/types/web/use-dialog-focus.d.ts';

/**
 * Use Dialog Focus - Use Dialog Focus.
 *
 * Moves focus into a dialog when it opens or shows a new step, preferring a
 * declared initial target, its first field, or its first enabled action.
 * Focus returns to the button that opened it when the dialog closes.
 *
 * @param {Web_UseDialogFocus_UseDialogFocus_Open}     open     - Open.
 * @param {Web_UseDialogFocus_UseDialogFocus_FocusKey} focusKey - Focus key.
 *
 * @returns {Web_UseDialogFocus_UseDialogFocus_Returns}
 *
 * @since 2.0.0
 */
export const useDialogFocus = (open: Web_UseDialogFocus_UseDialogFocus_Open, focusKey: Web_UseDialogFocus_UseDialogFocus_FocusKey = ''): Web_UseDialogFocus_UseDialogFocus_Returns => {
  const dialogRef: Web_UseDialogFocus_UseDialogFocus_DialogRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open === false) {
      return undefined;
    }

    const opener: Web_UseDialogFocus_UseDialogFocus_Opener = document.activeElement;

    return () => {
      if (opener instanceof HTMLElement && opener.isConnected === true) {
        opener.focus();
      }

      return;
    };
  }, [open]);

  useEffect(() => {
    const dialog: Web_UseDialogFocus_UseDialogFocus_Dialog = dialogRef.current;

    if (open === false || dialog === null) {
      return;
    }

    const initialTarget: Web_UseDialogFocus_UseDialogFocus_InitialTarget = dialog.querySelector<HTMLElement>('[data-dialog-initial-focus]');
    const field: Web_UseDialogFocus_UseDialogFocus_Field = dialog.querySelector<HTMLElement>('input:not([type="checkbox"]):not([readonly]), select, textarea:not([readonly])');
    const action: Web_UseDialogFocus_UseDialogFocus_Action = dialog.querySelector<HTMLElement>('.dialog-actions button:not(:disabled)');

    (
      initialTarget
      ?? field
      ?? action
      ?? dialog
    ).focus();

    return;
  }, [
    focusKey,
    open,
  ]);

  return dialogRef;
};
