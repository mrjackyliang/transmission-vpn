/// <reference lib="dom" />

import type {
  Notyf,
  NotyfEventCallback,
  NotyfNotification,
} from 'notyf';
import type {
  Mock,
  MockInstance,
} from 'vitest';

/**
 * Toast.
 *
 * @since 2.0.0
 */
export type Tests_Web_Toast_ClickHandler = NotyfEventCallback;

/**
 * Toast.
 *
 * @since 2.0.0
 */
export type Tests_Web_Toast_ErrorNotification = NotyfNotification;

/**
 * Toast.
 *
 * @since 2.0.0
 */
export type Tests_Web_Toast_NotyfMocks_Dismiss = Mock<Notyf['dismiss']>;

export type Tests_Web_Toast_NotyfMocks_DismissAll = Mock<Notyf['dismissAll']>;

export type Tests_Web_Toast_NotyfMocks_Error = Mock<Notyf['error']>;

export type Tests_Web_Toast_NotyfMocks_Success = Mock<Notyf['success']>;

export type Tests_Web_Toast_NotyfMocks = {
  dismiss: Tests_Web_Toast_NotyfMocks_Dismiss;
  dismissAll: Tests_Web_Toast_NotyfMocks_DismissAll;
  error: Tests_Web_Toast_NotyfMocks_Error;
  success: Tests_Web_Toast_NotyfMocks_Success;
};

/**
 * Toast.
 *
 * @since 2.0.0
 */
export type Tests_Web_Toast_Notification = NotyfNotification;

/**
 * Toast.
 *
 * @since 2.0.0
 */
export type Tests_Web_Toast_NotificationCall = Parameters<NotyfNotification['on']> | undefined;

/**
 * Toast.
 *
 * @since 2.0.0
 */
export type Tests_Web_Toast_NotificationOn = MockInstance<NotyfNotification['on']>;

/**
 * Toast.
 *
 * @since 2.0.0
 */
export type Tests_Web_Toast_SuccessNotification = NotyfNotification;

/**
 * Toast.
 *
 * @since 2.0.0
 */
export type Tests_Web_Toast_VisibleToast = {
  hidden: boolean;
  remove: () => void;
};

export type Tests_Web_Toast_VisibleToasts = Tests_Web_Toast_VisibleToast[];
