import {
  useEffect,
  useRef,
} from 'react';

import type { RefObject } from 'react';

/**
 * Use Dialog Focus - Use Dialog Focus.
 *
 * Moves focus into a dialog when it opens or shows a new step, preferring a
 * declared initial target, its first field, or its first enabled action.
 * Focus returns to the button that opened it when the dialog closes.
 *
 * @param {boolean} open     - Open.
 * @param {string}  focusKey - Focus key.
 *
 * @since 2.0.0
 */
export const useDialogFocus = (open: boolean, focusKey: string = ''): RefObject<HTMLElement | null> => {
  const dialogRef: RefObject<HTMLElement | null> = useRef<HTMLElement | null>(null);

  useEffect((): (() => void) | undefined => {
    if (!open) {
      return undefined;
    }

    const opener: Element | null = document.activeElement;

    return (): void => {
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus();
      }
    };
  }, [open]);

  useEffect((): void => {
    const dialog: HTMLElement | null = dialogRef.current;

    if (!open || dialog === null) {
      return;
    }

    const initialTarget: HTMLElement | null = dialog.querySelector<HTMLElement>('[data-dialog-initial-focus]');
    const field: HTMLElement | null = dialog.querySelector<HTMLElement>('input:not([type="checkbox"]):not([readonly]), select, textarea:not([readonly])');
    const action: HTMLElement | null = dialog.querySelector<HTMLElement>('.dialog-actions button:not(:disabled)');

    (initialTarget ?? field ?? action ?? dialog).focus();
  }, [
    focusKey,
    open,
  ]);

  return dialogRef;
};
