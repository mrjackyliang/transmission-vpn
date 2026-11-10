import {
  NotyfEvent,
  NotyfNotification,
} from 'notyf';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { formatConsoleError } from '../src/web/form-validation.ts';
import {
  setToastErrorFormatter,
  showToast,
} from '../src/web/toast.ts';

import type {
  Tests_Web_Toast_ClickHandler,
  Tests_Web_Toast_ErrorNotification,
  Tests_Web_Toast_Notification,
  Tests_Web_Toast_NotificationCall,
  Tests_Web_Toast_NotificationOn,
  Tests_Web_Toast_NotyfMocks,
  Tests_Web_Toast_SuccessNotification,
  Tests_Web_Toast_VisibleToast,
  Tests_Web_Toast_VisibleToasts,
} from '../src/types/tests/web/toast.test.d.ts';

/**
 * Tests - Web - Toast - Notyf Mocks.
 *
 * Records each toast operation without creating browser DOM elements.
 * The real toast module still owns replacement and click behavior.
 *
 * @since 2.0.0
 */
const notyfMocks: Tests_Web_Toast_NotyfMocks = vi.hoisted(() => ({
  dismiss: vi.fn(),
  dismissAll: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock('notyf', () => ({
  Notyf: vi.fn(function notyf() {
    return notyfMocks;
  }),
  NotyfEvent: {
    Click: 'click',
    Dismiss: 'dismiss',
  },
  NotyfNotification: vi.fn(function notyfNotification() {
    return {
      on: vi.fn(),
    };
  }),
}));

/**
 * Tests - Web - Toast - Toast.
 *
 * Verifies the dashboard keeps only its latest result visible.
 * The suite also preserves the existing click-to-dismiss behavior.
 *
 * @since 2.0.0
 */
describe('toast', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();

    vi.clearAllMocks();

    setToastErrorFormatter(undefined);

    const errorNotification: Tests_Web_Toast_ErrorNotification = new NotyfNotification({});
    const successNotification: Tests_Web_Toast_SuccessNotification = new NotyfNotification({});

    notyfMocks['error'].mockReturnValue(errorNotification);

    notyfMocks['success'].mockReturnValue(successNotification);

    return;
  });

  it('formats error messages without changing success messages', () => {
    setToastErrorFormatter((message) => `Readable: ${message}`);

    showToast('Low-level failure.', false);

    showToast('Saved.', true);

    expect(notyfMocks['error']).toHaveBeenCalledWith('Readable: Low-level failure.');

    expect(notyfMocks['success']).toHaveBeenCalledWith('Saved.');

    return;
  });

  it('formats Transmission setting keys in error toasts', () => {
    setToastErrorFormatter(formatConsoleError);

    showToast('transmission.peerLimitPerTorrent could not be saved.', false);

    expect(notyfMocks['error']).toHaveBeenCalledWith('Per-torrent peer limit could not be saved.');

    return;
  });

  it('escapes error messages after formatting', () => {
    setToastErrorFormatter(() => '<Readable & safe>');

    showToast('Low-level failure.', false);

    expect(notyfMocks['error']).toHaveBeenCalledWith('&lt;Readable &amp; safe&gt;');

    return;
  });

  it('keeps error messages unchanged without a formatter', () => {
    setToastErrorFormatter(undefined);

    showToast('Connection failed.', false);

    expect(notyfMocks['error']).toHaveBeenCalledWith('Connection failed.');

    return;
  });

  it('dismisses the visible toast before showing a second toast', () => {
    showToast('First result.', true);

    showToast('Second result.', true);

    expect(notyfMocks['dismissAll']).toHaveBeenCalledTimes(2);

    expect(notyfMocks['success']).toHaveBeenNthCalledWith(1, 'First result.');

    expect(notyfMocks['success']).toHaveBeenNthCalledWith(2, 'Second result.');

    expect(notyfMocks['success'].mock.invocationCallOrder[0]).toBeLessThan(notyfMocks['dismissAll'].mock.invocationCallOrder[1] ?? 0);

    expect(notyfMocks['dismissAll'].mock.invocationCallOrder[1]).toBeLessThan(notyfMocks['success'].mock.invocationCallOrder[1] ?? 0);

    return;
  });

  it('removes replaced toast elements from the DOM', () => {
    const toasts: Tests_Web_Toast_VisibleToasts = [];

    vi.stubGlobal('document', {
      querySelectorAll: vi.fn(() => toasts),
    });

    notyfMocks['success'].mockImplementation(() => {
      const toast: Tests_Web_Toast_VisibleToast = {
        hidden: false,
        remove: vi.fn(() => {
          toasts.splice(toasts.indexOf(toast), 1);

          return;
        }),
      };

      toasts.push(toast);

      return new NotyfNotification({});
    });

    showToast('First result.', true);

    showToast('Second result.', true);

    showToast('Third result.', true);

    showToast('Fourth result.', true);

    showToast('Fifth result.', true);

    expect(toasts).toHaveLength(1);

    expect(toasts[0]).toMatchObject({ hidden: false });

    return;
  });

  it('leaves success as the final toast after an error', () => {
    showToast('Connection failed.', false);

    showToast('Saved.', true);

    expect(notyfMocks['error']).toHaveBeenCalledWith('Connection failed.');

    expect(notyfMocks['success']).toHaveBeenCalledWith('Saved.');

    expect(notyfMocks['error'].mock.invocationCallOrder[0]).toBeLessThan(notyfMocks['dismissAll'].mock.invocationCallOrder[1] ?? 0);

    expect(notyfMocks['dismissAll'].mock.invocationCallOrder[1]).toBeLessThan(notyfMocks['success'].mock.invocationCallOrder[0] ?? 0);

    return;
  });

  it('leaves error as the final toast after a success', () => {
    showToast('Saved.', true);

    showToast('Connection failed.', false);

    expect(notyfMocks['success']).toHaveBeenCalledWith('Saved.');

    expect(notyfMocks['error']).toHaveBeenCalledWith('Connection failed.');

    expect(notyfMocks['success'].mock.invocationCallOrder[0]).toBeLessThan(notyfMocks['dismissAll'].mock.invocationCallOrder[1] ?? 0);

    expect(notyfMocks['dismissAll'].mock.invocationCallOrder[1]).toBeLessThan(notyfMocks['error'].mock.invocationCallOrder[0] ?? 0);

    return;
  });

  it('dismisses the current toast when it is clicked', () => {
    const notification: Tests_Web_Toast_Notification = new NotyfNotification({});
    const notificationOn: Tests_Web_Toast_NotificationOn = vi.spyOn(notification, 'on');

    notyfMocks['success'].mockReturnValue(notification);

    showToast('Saved.', true);

    expect(notificationOn).toHaveBeenCalledWith(NotyfEvent.Click, expect.any(Function));

    const notificationCall: Tests_Web_Toast_NotificationCall = notificationOn.mock.calls.at(0);

    if (notificationCall === undefined) {
      throw new Error('The click handler was not registered.');
    }

    const clickHandler: Tests_Web_Toast_ClickHandler = notificationCall[1];

    clickHandler({ target: notification });

    expect(notyfMocks['dismiss']).toHaveBeenCalledWith(notification);

    return;
  });

  return;
});
