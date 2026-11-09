import {
  useEffect,
  useState,
} from 'react';

import {
  getNotificationEvents,
  getNotifications,
  removeNotification,
  summaryFor,
  testNotification,
} from '@/web/api.ts';
import { ConfirmDialog } from '@/web/confirm-dialog.tsx';
import {
  formatRelative,
  keepTogether,
} from '@/web/format.ts';
import { NotificationDialog } from '@/web/notification-dialog.tsx';
import { findNotificationService } from '@/web/notification-services.ts';
import {
  Button,
  Icon,
} from '@/web/primitives.tsx';
import { showToast } from '@/web/toast.ts';

import type { ReactElement } from 'react';

import type {
  Web_Notifications_Event,
  Web_Notifications_Field,
  Web_Notifications_Target,
  Web_Notifications_TestResult,
  Web_Notifications_ViewProps,
} from '@/types/web/notifications.d.ts';

// describeTarget sums up a destination's events and its last send in one line, which wraps
// between its parts. A failed last send gets its own line, from failedSendText.

/**
 * Notifications View - Describe target.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const describeTarget = (target: Web_Notifications_Target): string => {
  const eventCount: string = keepTogether(`${target['events'].length} ${(target['events'].length === 1) ? 'event' : 'events'}`);

  if (target['lastAttemptAt'] === null) {
    return `${eventCount} · ${keepTogether('not sent yet')}`;
  }

  if (target['lastError'] !== null) {
    return eventCount;
  }

  return `${eventCount} · ${keepTogether(`last sent ${formatRelative(target['lastAttemptAt'])}`)}`;
};

// failedSendText says when the last send failed and why, or is empty when it didn't fail.

/**
 * Notifications View - Failed send text.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const failedSendText = (target: Web_Notifications_Target): string => {
  if (target['lastAttemptAt'] === null || target['lastError'] === null) {
    return '';
  }

  return `Last attempt failed ${formatRelative(target['lastAttemptAt'])}: ${target['lastError']}`;
};

// fieldPhrase writes a field label mid-sentence: "Bot token" becomes "bot token", while
// "URL" and "Apprise URL" keep their capitals.

/**
 * Notifications View - Field phrase.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const fieldPhrase = (label: string): string => {
  const firstWord: string = label.split(' ')[0] ?? '';

  if (firstWord === firstWord.toUpperCase() || firstWord === 'Apprise') {
    return label;
  }

  return `${label.charAt(0).toLowerCase()}${label.slice(1)}`;
};

// missingSecretsText names the secrets a lost key removed, in the dialog's words.

/**
 * Notifications View - Missing secrets text.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const missingSecretsText = (target: Web_Notifications_Target): string => {
  const labels: string[] = findNotificationService(target['service'])['fields']
    .filter((field: Web_Notifications_Field): boolean => target['secretsMissing'].includes(field['key']))
    .map((field: Web_Notifications_Field): string => fieldPhrase(field['label']));

  return `Enter the ${labels.join(' and ')} again. Alerts are paused until you do.`;
};

/**
 * Notifications View.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const NotificationsView = ({
  interpreter,
  onChange,
}: Web_Notifications_ViewProps): ReactElement => {
  const [
    targets,
    setTargets,
  ] = useState<Web_Notifications_Target[] | null>(null);
  const [
    events,
    setEvents,
  ] = useState<Web_Notifications_Event[]>([]);
  const [
    dialogOpen,
    setDialogOpen,
  ] = useState<boolean>(false);
  const [
    editingTarget,
    setEditingTarget,
  ] = useState<Web_Notifications_Target | null>(null);
  const [
    removing,
    setRemoving,
  ] = useState<Web_Notifications_Target | null>(null);
  const [
    removeError,
    setRemoveError,
  ] = useState<string>('');
  const [
    testing,
    setTesting,
  ] = useState<string>('');
  const [
    busy,
    setBusy,
  ] = useState<boolean>(false);
  const [
    error,
    setError,
  ] = useState<string>('');

  /**
   * Notifications View - Load.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const load = async (): Promise<void> => {
    try {
      const [
        nextTargets,
        nextEvents,
      ] = await Promise.all([
        getNotifications(),
        getNotificationEvents(),
      ]);

      setTargets(nextTargets);
      setEvents(nextEvents);
    } catch (caughtError) {
      setError(summaryFor(caughtError, [], 'Notifications could not be loaded.'));
    }
  };

  useEffect((): void => {
    void load();
  }, []);

  // reload refreshes the list after a change, then lets the app refresh its key notice.

  /**
   * Notifications View - Reload.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const reload = async (): Promise<void> => {
    await load();

    if (onChange !== undefined) {
      onChange();
    }
  };

  /**
   * Notifications View - Remove.
   *
   * Removes the destination picked in the confirm dialog. A failure stays in the dialog,
   * so it can be tried again or cancelled.
   *
   * @since 2.0.0
   */
  const remove = async (target: Web_Notifications_Target): Promise<void> => {
    setBusy(true);
    setRemoveError('');
    try {
      await removeNotification(target['id']);
      setRemoving(null);
      showToast(`${target['name']} removed.`, true);
      await reload();
    } catch (caughtError) {
      setRemoveError(summaryFor(caughtError, [], 'The notification could not be removed.'));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Notifications View - Sends test.
   *
   * Sends a test alert to one destination and reports the result as a toast,
   * with the service's reason when it couldn't be delivered.
   *
   * @since 2.0.0
   */
  const sendTest = async (target: Web_Notifications_Target): Promise<void> => {
    setTesting(target['id']);
    try {
      const result: Web_Notifications_TestResult = await testNotification(target['id']);

      if (result['delivered']) {
        showToast(`Test sent to ${target['name']}.`, true);
      } else {
        showToast(`The test to ${target['name']} couldn't be sent: ${result['message'] ?? 'no reason was given.'}`, false);
      }

      await load();
    } catch (caughtError) {
      showToast(summaryFor(caughtError, [], 'The test could not be sent.'), false);
    } finally {
      setTesting('');
    }
  };

  return (
    <section className="workspace-section">
      <div className="workspace-heading workspace-heading-split">
        <div>
          <h1>Notifications</h1>
          <p>Alerts for the events you choose, sent to ntfy, Telegram, email, and other services.</p>
        </div>
        <Button
          disabled={targets === null}
          icon="add"
          onClick={(): void => {
            setEditingTarget(null);
            setDialogOpen(true);
          }}
          variant="primary"
        >
          Add notification
        </Button>
      </div>

      {(error === '') ? null : (
        <div className="form-error" role="alert">
          <Icon name="warning" size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="panel">
        <section className="form-section">
          <div className="form-section-head">
            <h2>Destinations</h2>
            {(targets === null) ? null : <span>{`${targets.length} ${(targets.length === 1) ? 'destination' : 'destinations'}`}</span>}
          </div>
          {(targets === null) ? (
            <p className="select-list select-list-empty">Loading…</p>
          ) : null}
          {(targets !== null && targets.length === 0) ? (
            <p className="select-list select-list-empty">No notifications yet. Add one for each app or chat that should get alerts.</p>
          ) : null}
          {(targets !== null && targets.length > 0) ? (
            <div className="select-list token-list">
              {targets.map((target: Web_Notifications_Target): ReactElement => {
                return (
                  <div className="select-list-row token-row" key={target['id']}>
                    <div className="select-list-main">
                      <span className="token-title">
                        <span className="token-name">{target['name']}</span>
                        <span className="tag">{findNotificationService(target['service'])['label']}</span>
                      </span>
                      <small>{describeTarget(target)}</small>
                      {(failedSendText(target) === '') ? null : <small className="field-error">{failedSendText(target)}</small>}
                      {(target['lastErrorDetails'] === null || target['lastErrorDetails'] === undefined) ? null : (
                        <details className="notification-error-details">
                          <summary>Details</summary>
                          <code>{target['lastErrorDetails']}</code>
                        </details>
                      )}
                      {(target['secretsMissing'].length === 0) ? null : <small className="field-error">{missingSecretsText(target)}</small>}
                    </div>
                    <span className="token-actions">
                      <Button
                        disabled={testing !== '' || target['secretsMissing'].length > 0}
                        icon="send"
                        onClick={(): void => {
                          void sendTest(target);
                        }}
                        variant="quiet"
                      >
                        {(testing === target['id']) ? 'Sending…' : 'Send test'}
                      </Button>
                      <Button
                        icon="edit"
                        onClick={(): void => {
                          setEditingTarget(target);
                          setDialogOpen(true);
                        }}
                        variant="quiet"
                      >
                        Edit
                      </Button>
                      <Button
                        icon="remove"
                        onClick={(): void => {
                          setRemoveError('');
                          setRemoving(target);
                        }}
                        variant="danger"
                      >
                        Remove
                      </Button>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>
      </div>

      <NotificationDialog
        events={events}
        interpreter={interpreter}
        onClose={(): void => setDialogOpen(false)}
        onSaved={reload}
        open={dialogOpen}
        target={editingTarget}
      />

      <ConfirmDialog
        busy={busy}
        busyLabel="Removing…"
        confirmLabel="Remove"
        error={removeError}
        message="Alerts stop going to this destination. You can add it again later."
        onCancel={(): void => setRemoving(null)}
        onConfirm={(): void => {
          if (removing !== null) {
            void remove(removing);
          }
        }}
        open={removing !== null}
        title={`Remove ${removing?.['name'] ?? 'destination'}?`}
      />
    </section>
  );
};
