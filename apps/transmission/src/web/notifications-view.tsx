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

import type {
  Web_NotificationsView_DescribeTarget_EventCount,
  Web_NotificationsView_DescribeTarget_EventNoun,
  Web_NotificationsView_DescribeTarget_Returns,
  Web_NotificationsView_DescribeTarget_Target,
  Web_NotificationsView_FailedSendText_Returns,
  Web_NotificationsView_FailedSendText_Target,
  Web_NotificationsView_FieldPhrase_FirstWord,
  Web_NotificationsView_FieldPhrase_Label,
  Web_NotificationsView_FieldPhrase_Returns,
  Web_NotificationsView_MissingSecretsText_Labels,
  Web_NotificationsView_MissingSecretsText_Returns,
  Web_NotificationsView_MissingSecretsText_Target,
  Web_NotificationsView_NotificationsView_Busy,
  Web_NotificationsView_NotificationsView_BusyState,
  Web_NotificationsView_NotificationsView_DestinationNoun,
  Web_NotificationsView_NotificationsView_DialogOpen,
  Web_NotificationsView_NotificationsView_DialogOpenState,
  Web_NotificationsView_NotificationsView_EditingTarget,
  Web_NotificationsView_NotificationsView_EditingTargetState,
  Web_NotificationsView_NotificationsView_Error,
  Web_NotificationsView_NotificationsView_ErrorState,
  Web_NotificationsView_NotificationsView_Events,
  Web_NotificationsView_NotificationsView_EventsState,
  Web_NotificationsView_NotificationsView_Interpreter,
  Web_NotificationsView_NotificationsView_Load,
  Web_NotificationsView_NotificationsView_Load_NextEvents,
  Web_NotificationsView_NotificationsView_Load_NextTargets,
  Web_NotificationsView_NotificationsView_Load_Results,
  Web_NotificationsView_NotificationsView_Load_Returns,
  Web_NotificationsView_NotificationsView_OnChange,
  Web_NotificationsView_NotificationsView_Reload,
  Web_NotificationsView_NotificationsView_Reload_Returns,
  Web_NotificationsView_NotificationsView_Remove,
  Web_NotificationsView_NotificationsView_Remove_Returns,
  Web_NotificationsView_NotificationsView_Remove_Target,
  Web_NotificationsView_NotificationsView_RemoveError,
  Web_NotificationsView_NotificationsView_RemoveErrorState,
  Web_NotificationsView_NotificationsView_Removing,
  Web_NotificationsView_NotificationsView_RemovingName,
  Web_NotificationsView_NotificationsView_RemovingState,
  Web_NotificationsView_NotificationsView_Returns,
  Web_NotificationsView_NotificationsView_SendTest,
  Web_NotificationsView_NotificationsView_SendTest_Result,
  Web_NotificationsView_NotificationsView_SendTest_Returns,
  Web_NotificationsView_NotificationsView_SendTest_Target,
  Web_NotificationsView_NotificationsView_SetBusy,
  Web_NotificationsView_NotificationsView_SetDialogOpen,
  Web_NotificationsView_NotificationsView_SetEditingTarget,
  Web_NotificationsView_NotificationsView_SetError,
  Web_NotificationsView_NotificationsView_SetEvents,
  Web_NotificationsView_NotificationsView_SetRemoveError,
  Web_NotificationsView_NotificationsView_SetRemoving,
  Web_NotificationsView_NotificationsView_SetTargets,
  Web_NotificationsView_NotificationsView_SetTesting,
  Web_NotificationsView_NotificationsView_Targets,
  Web_NotificationsView_NotificationsView_TargetsState,
  Web_NotificationsView_NotificationsView_Testing,
  Web_NotificationsView_NotificationsView_TestingState,
} from '@/types/web/notifications-view.d.ts';
import type { Web_Notifications_ViewProps } from '@/types/web/notifications.d.ts';

// describeTarget sums up a destination's events and its last send in one line, which wraps
// between its parts. A failed last send gets its own line, from failedSendText.

/**
 * Notifications View - Describe Target.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_NotificationsView_DescribeTarget_Target} target - Target.
 *
 * @returns {Web_NotificationsView_DescribeTarget_Returns}
 *
 * @since 2.0.0
 */
const describeTarget = (target: Web_NotificationsView_DescribeTarget_Target): Web_NotificationsView_DescribeTarget_Returns => {
  const eventNoun: Web_NotificationsView_DescribeTarget_EventNoun = (target['events'].length === 1) ? 'event' : 'events';
  const eventCount: Web_NotificationsView_DescribeTarget_EventCount = keepTogether(`${target['events'].length} ${eventNoun}`);

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
 * Notifications View - Failed Send Text.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_NotificationsView_FailedSendText_Target} target - Target.
 *
 * @returns {Web_NotificationsView_FailedSendText_Returns}
 *
 * @since 2.0.0
 */
const failedSendText = (target: Web_NotificationsView_FailedSendText_Target): Web_NotificationsView_FailedSendText_Returns => {
  if (target['lastAttemptAt'] === null || target['lastError'] === null) {
    return '';
  }

  return `Last attempt failed ${formatRelative(target['lastAttemptAt'])}: ${target['lastError']}`;
};

// fieldPhrase writes a field label mid-sentence: "Bot token" becomes "bot token", while
// "URL" and "Apprise URL" keep their capitals.

/**
 * Notifications View - Field Phrase.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_NotificationsView_FieldPhrase_Label} label - Label.
 *
 * @returns {Web_NotificationsView_FieldPhrase_Returns}
 *
 * @since 2.0.0
 */
const fieldPhrase = (label: Web_NotificationsView_FieldPhrase_Label): Web_NotificationsView_FieldPhrase_Returns => {
  const firstWord: Web_NotificationsView_FieldPhrase_FirstWord = label.split(' ')[0] ?? '';

  if (firstWord === firstWord.toUpperCase() || firstWord === 'Apprise') {
    return label;
  }

  return `${label.charAt(0).toLowerCase()}${label.slice(1)}`;
};

// missingSecretsText names the secrets a lost key removed, in the dialog's words.

/**
 * Notifications View - Missing Secrets Text.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_NotificationsView_MissingSecretsText_Target} target - Target.
 *
 * @returns {Web_NotificationsView_MissingSecretsText_Returns}
 *
 * @since 2.0.0
 */
const missingSecretsText = (target: Web_NotificationsView_MissingSecretsText_Target): Web_NotificationsView_MissingSecretsText_Returns => {
  const labels: Web_NotificationsView_MissingSecretsText_Labels = findNotificationService(target['service'])['fields']
    .filter((field) => target['secretsMissing'].includes(field['key']))
    .map((field) => fieldPhrase(field['label']));

  return `Enter the ${labels.join(' and ')} again. Alerts are paused until you do.`;
};

/**
 * Notifications View - Notifications View.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_Notifications_ViewProps} props - Props.
 *
 * @returns {Web_NotificationsView_NotificationsView_Returns}
 *
 * @since 2.0.0
 */
export const NotificationsView = (props: Web_Notifications_ViewProps): Web_NotificationsView_NotificationsView_Returns => {
  const interpreter: Web_NotificationsView_NotificationsView_Interpreter = props['interpreter'];
  const onChange: Web_NotificationsView_NotificationsView_OnChange = props['onChange'];
  const targetsState: Web_NotificationsView_NotificationsView_TargetsState = useState<Web_NotificationsView_NotificationsView_Targets>(null);
  const targets: Web_NotificationsView_NotificationsView_Targets = targetsState[0];
  const setTargets: Web_NotificationsView_NotificationsView_SetTargets = targetsState[1];
  const eventsState: Web_NotificationsView_NotificationsView_EventsState = useState<Web_NotificationsView_NotificationsView_Events>([]);
  const events: Web_NotificationsView_NotificationsView_Events = eventsState[0];
  const setEvents: Web_NotificationsView_NotificationsView_SetEvents = eventsState[1];
  const dialogOpenState: Web_NotificationsView_NotificationsView_DialogOpenState = useState<Web_NotificationsView_NotificationsView_DialogOpen>(false);
  const dialogOpen: Web_NotificationsView_NotificationsView_DialogOpen = dialogOpenState[0];
  const setDialogOpen: Web_NotificationsView_NotificationsView_SetDialogOpen = dialogOpenState[1];
  const editingTargetState: Web_NotificationsView_NotificationsView_EditingTargetState = useState<Web_NotificationsView_NotificationsView_EditingTarget>(null);
  const editingTarget: Web_NotificationsView_NotificationsView_EditingTarget = editingTargetState[0];
  const setEditingTarget: Web_NotificationsView_NotificationsView_SetEditingTarget = editingTargetState[1];
  const removingState: Web_NotificationsView_NotificationsView_RemovingState = useState<Web_NotificationsView_NotificationsView_Removing>(null);
  const removing: Web_NotificationsView_NotificationsView_Removing = removingState[0];
  const setRemoving: Web_NotificationsView_NotificationsView_SetRemoving = removingState[1];
  const removeErrorState: Web_NotificationsView_NotificationsView_RemoveErrorState = useState<Web_NotificationsView_NotificationsView_RemoveError>('');
  const removeError: Web_NotificationsView_NotificationsView_RemoveError = removeErrorState[0];
  const setRemoveError: Web_NotificationsView_NotificationsView_SetRemoveError = removeErrorState[1];
  const testingState: Web_NotificationsView_NotificationsView_TestingState = useState<Web_NotificationsView_NotificationsView_Testing>('');
  const testing: Web_NotificationsView_NotificationsView_Testing = testingState[0];
  const setTesting: Web_NotificationsView_NotificationsView_SetTesting = testingState[1];
  const busyState: Web_NotificationsView_NotificationsView_BusyState = useState<Web_NotificationsView_NotificationsView_Busy>(false);
  const busy: Web_NotificationsView_NotificationsView_Busy = busyState[0];
  const setBusy: Web_NotificationsView_NotificationsView_SetBusy = busyState[1];
  const errorState: Web_NotificationsView_NotificationsView_ErrorState = useState<Web_NotificationsView_NotificationsView_Error>('');
  const error: Web_NotificationsView_NotificationsView_Error = errorState[0];
  const setError: Web_NotificationsView_NotificationsView_SetError = errorState[1];

  /**
   * Notifications View - Load.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @returns {Web_NotificationsView_NotificationsView_Load_Returns}
   *
   * @since 2.0.0
   */
  const load: Web_NotificationsView_NotificationsView_Load = async (): Web_NotificationsView_NotificationsView_Load_Returns => {
    try {
      const results: Web_NotificationsView_NotificationsView_Load_Results = await Promise.all([
        getNotifications(),
        getNotificationEvents(),
      ]);
      const nextTargets: Web_NotificationsView_NotificationsView_Load_NextTargets = results[0];
      const nextEvents: Web_NotificationsView_NotificationsView_Load_NextEvents = results[1];

      setTargets(nextTargets);
      setEvents(nextEvents);
    } catch (caughtError) {
      setError(summaryFor(caughtError, [], 'Notifications could not be loaded.'));
    }

    return;
  };

  useEffect(() => {
    void load();

    return;
  }, []);

  // reload refreshes the list after a change, then lets the app refresh its key notice.

  /**
   * Notifications View - Reload.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @returns {Web_NotificationsView_NotificationsView_Reload_Returns}
   *
   * @since 2.0.0
   */
  const reload: Web_NotificationsView_NotificationsView_Reload = async (): Web_NotificationsView_NotificationsView_Reload_Returns => {
    await load();

    if (onChange !== undefined) {
      onChange();
    }

    return;
  };

  /**
   * Notifications View - Remove.
   *
   * Removes the destination picked in the confirm dialog. A failure stays in the dialog,
   * so it can be tried again or cancelled.
   *
   * @param {Web_NotificationsView_NotificationsView_Remove_Target} target - Target.
   *
   * @returns {Web_NotificationsView_NotificationsView_Remove_Returns}
   *
   * @since 2.0.0
   */
  const remove: Web_NotificationsView_NotificationsView_Remove = async (target: Web_NotificationsView_NotificationsView_Remove_Target): Web_NotificationsView_NotificationsView_Remove_Returns => {
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

    return;
  };

  /**
   * Notifications View - Send Test.
   *
   * Sends a test alert to one destination and reports the result as a toast,
   * with the service's reason when it couldn't be delivered.
   *
   * @param {Web_NotificationsView_NotificationsView_SendTest_Target} target - Target.
   *
   * @returns {Web_NotificationsView_NotificationsView_SendTest_Returns}
   *
   * @since 2.0.0
   */
  const sendTest: Web_NotificationsView_NotificationsView_SendTest = async (target: Web_NotificationsView_NotificationsView_SendTest_Target): Web_NotificationsView_NotificationsView_SendTest_Returns => {
    setTesting(target['id']);

    try {
      const result: Web_NotificationsView_NotificationsView_SendTest_Result = await testNotification(target['id']);

      if (result['delivered'] === true) {
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

    return;
  };

  const destinationNoun: Web_NotificationsView_NotificationsView_DestinationNoun = (targets !== null && targets.length === 1) ? 'destination' : 'destinations';
  const removingName: Web_NotificationsView_NotificationsView_RemovingName = (removing === null) ? 'destination' : removing['name'];

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
          onClick={() => {
            setEditingTarget(null);
            setDialogOpen(true);

            return;
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
            {(targets === null) ? null : <span>{`${targets.length} ${destinationNoun}`}</span>}
          </div>
          {(targets === null) ? (
            <p className="select-list select-list-empty">Loading…</p>
          ) : null}
          {(targets !== null && targets.length === 0) ? (
            <p className="select-list select-list-empty">No notifications yet. Add one for each app or chat that should get alerts.</p>
          ) : null}
          {(targets !== null && targets.length > 0) ? (
            <div className="select-list token-list">
              {targets.map((target) => {
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
                        onClick={() => {
                          void sendTest(target);

                          return;
                        }}
                        variant="quiet"
                      >
                        {(testing === target['id']) ? 'Sending…' : 'Send test'}
                      </Button>
                      <Button
                        icon="edit"
                        onClick={() => {
                          setEditingTarget(target);
                          setDialogOpen(true);

                          return;
                        }}
                        variant="quiet"
                      >
                        Edit
                      </Button>
                      <Button
                        icon="remove"
                        onClick={() => {
                          setRemoveError('');
                          setRemoving(target);

                          return;
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
        onClose={() => setDialogOpen(false)}
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
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing !== null) {
            void remove(removing);
          }

          return;
        }}
        open={removing !== null}
        title={`Remove ${removingName}?`}
      />
    </section>
  );
};
