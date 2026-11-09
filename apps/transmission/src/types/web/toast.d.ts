import type {
  Notyf,
  NotyfNotification,
} from 'notyf';

/**
 * Toast.
 *
 * @since 2.0.0
 */
export type Web_Toast_NotyfInstance = Notyf | undefined;
export type Web_Toast_ToastErrorFormatter = ((message: string) => string) | undefined;
export type Web_Toast_GetNotyf_Returns = Notyf;
export type Web_Toast_HideVisibleToasts_Toast = HTMLElement & {
  remove: () => void;
};
export type Web_Toast_HideVisibleToasts_Returns = Web_Toast_HideVisibleToasts_Toast[];
export type Web_Toast_HideVisibleToasts_Toasts = NodeListOf<Web_Toast_HideVisibleToasts_Toast>;
export type Web_Toast_SetToastErrorFormatter_Formatter = ((message: string) => string) | undefined;
export type Web_Toast_SetToastErrorFormatter_Returns = void;
export type Web_Toast_ShowToast_Message = string;
export type Web_Toast_ShowToast_Success = boolean;
export type Web_Toast_ShowToast_DisplayMessage = string;
export type Web_Toast_ShowToast_SafeMessage = string;
export type Web_Toast_ShowToast_Notification = NotyfNotification;
export type Web_Toast_ShowToast_OutgoingToasts = Web_Toast_HideVisibleToasts_Toast[];
export type Web_Toast_ShowToast_Returns = void;
