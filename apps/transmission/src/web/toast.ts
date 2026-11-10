import {
  Notyf,
  NotyfEvent,
} from 'notyf';

import type {
  Web_Toast_GetNotyf_Returns,
  Web_Toast_HideVisibleToasts_Returns,
  Web_Toast_HideVisibleToasts_Toast,
  Web_Toast_HideVisibleToasts_Toasts,
  Web_Toast_NotyfInstance,
  Web_Toast_SetToastErrorFormatter_Formatter,
  Web_Toast_SetToastErrorFormatter_Returns,
  Web_Toast_ShowToast_DisplayMessage,
  Web_Toast_ShowToast_Message,
  Web_Toast_ShowToast_Notification,
  Web_Toast_ShowToast_OutgoingToasts,
  Web_Toast_ShowToast_Returns,
  Web_Toast_ShowToast_SafeMessage,
  Web_Toast_ShowToast_Success,
  Web_Toast_ToastErrorFormatter,
} from '@/types/web/toast.d.ts';

/**
 * Toast - Hide visible toasts.
 *
 * Makes a replacement immediate and collects every outgoing element,
 * including leftovers hidden by an earlier replacement.
 *
 * @returns {Web_Toast_HideVisibleToasts_Returns}
 *
 * @since 2.0.0
 */
const hideVisibleToasts = (): Web_Toast_HideVisibleToasts_Returns => {
  if (typeof document === 'undefined') {
    return [];
  }

  const toasts: Web_Toast_HideVisibleToasts_Toasts = document.querySelectorAll<Web_Toast_HideVisibleToasts_Toast>('.notyf__toast');

  for (const toast of toasts) {
    toast.hidden = true;
  }

  return [...toasts];
};

/**
 * Toast - Notyf instance.
 *
 * Created on the first toast, so every toast shares one container
 * instead of adding a new one to the page each time.
 *
 * @since 2.0.0
 */
let notyfInstance: Web_Toast_NotyfInstance = undefined;

/**
 * Toast - Toast error formatter.
 *
 * Holds an application-specific error text hook when the dashboard provides one.
 * Success messages never pass through this formatter.
 *
 * @since 2.0.0
 */
let toastErrorFormatter: Web_Toast_ToastErrorFormatter = undefined;

/**
 * Toast - Get Notyf.
 *
 * Returns the shared Notyf instance. The colors are theme variables,
 * so a toast follows the light or dark theme that is showing.
 *
 * @since 2.0.0
 */
const getNotyf = (): Web_Toast_GetNotyf_Returns => {
  if (notyfInstance === undefined) {
    notyfInstance = new Notyf({
      dismissible: true,
      duration: 4000,
      ripple: false,
      types: [
        {
          background: 'var(--color-success)',
          type: 'success',
        },
        {
          background: 'var(--color-danger)',
          duration: 6000,
          type: 'error',
        },
      ],
    });
  }

  return notyfInstance;
};

/**
 * Toast - Set toast error formatter.
 *
 * Registers application-specific error wording while leaving successful results
 * and dashboards without a formatter unchanged.
 *
 * @param {Web_Toast_SetToastErrorFormatter_Formatter} formatter - Formatter.
 *
 * @returns {Web_Toast_SetToastErrorFormatter_Returns}
 *
 * @since 2.0.0
 */
export const setToastErrorFormatter = (formatter: Web_Toast_SetToastErrorFormatter_Formatter): Web_Toast_SetToastErrorFormatter_Returns => {
  toastErrorFormatter = formatter;

  return;
};

/**
 * Toast - Show toast.
 *
 * Replaces the visible toast with one result that closes on its own or when
 * clicked. Registered error formatting runs before messages are safely escaped.
 *
 * @since 2.0.0
 */
export const showToast = (message: Web_Toast_ShowToast_Message, success: Web_Toast_ShowToast_Success): Web_Toast_ShowToast_Returns => {
  const notyf: Web_Toast_GetNotyf_Returns = getNotyf();
  const outgoingToasts: Web_Toast_ShowToast_OutgoingToasts = hideVisibleToasts();

  notyf.dismissAll();

  // Dismiss first so Notyf forgets each notification before its animation target is removed.
  for (const toast of outgoingToasts) {
    toast.remove();
  }

  let displayMessage: Web_Toast_ShowToast_DisplayMessage = message;

  if (
    success === false
    && toastErrorFormatter !== undefined
  ) {
    displayMessage = toastErrorFormatter(message);
  }

  const safeMessage: Web_Toast_ShowToast_SafeMessage = displayMessage.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const notification: Web_Toast_ShowToast_Notification = (success) ? notyf.success(safeMessage) : notyf.error(safeMessage);

  notification.on(NotyfEvent.Click, (): void => {
    notyf.dismiss(notification);

    return;
  });
};
