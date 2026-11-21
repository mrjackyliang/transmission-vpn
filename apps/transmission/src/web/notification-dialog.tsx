import {
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import {
  createNotification,
  issueFor,
  summaryFor,
  updateNotification,
} from '@/web/api.ts';
import { FieldLabel } from '@/web/field-label.tsx';
import {
  findNotificationService,
  notificationServiceIssue,
  notificationServices,
  notificationServiceValues,
} from '@/web/notification-services.ts';
import {
  Button,
  Icon,
  passwordManagerIgnore,
} from '@/web/primitives.tsx';
import { showToast } from '@/web/toast.ts';
import { useEscapeKey } from '@/web/use-escape-key.ts';

import type { ReactElement } from 'react';

import type {
  Web_NotificationDialog_FieldHint_Cleared,
  Web_NotificationDialog_FieldHint_Field,
  Web_NotificationDialog_FieldHint_Interpreter,
  Web_NotificationDialog_FieldHint_Returns,
  Web_NotificationDialog_FieldHint_Target,
  Web_NotificationDialog_NotificationDialog_ActionLabel,
  Web_NotificationDialog_NotificationDialog_BaseId,
  Web_NotificationDialog_NotificationDialog_Busy,
  Web_NotificationDialog_NotificationDialog_BusyState,
  Web_NotificationDialog_NotificationDialog_CanClear,
  Web_NotificationDialog_NotificationDialog_Cleared,
  Web_NotificationDialog_NotificationDialog_ClearSecrets,
  Web_NotificationDialog_NotificationDialog_ClearSecretsState,
  Web_NotificationDialog_NotificationDialog_Error,
  Web_NotificationDialog_NotificationDialog_ErrorState,
  Web_NotificationDialog_NotificationDialog_Events,
  Web_NotificationDialog_NotificationDialog_EventsIssue,
  Web_NotificationDialog_NotificationDialog_Fields,
  Web_NotificationDialog_NotificationDialog_Hint,
  Web_NotificationDialog_NotificationDialog_Interpreter,
  Web_NotificationDialog_NotificationDialog_Issue,
  Web_NotificationDialog_NotificationDialog_Missing,
  Web_NotificationDialog_NotificationDialog_Name,
  Web_NotificationDialog_NotificationDialog_NameIssue,
  Web_NotificationDialog_NotificationDialog_NameState,
  Web_NotificationDialog_NotificationDialog_NextService,
  Web_NotificationDialog_NotificationDialog_NextValue,
  Web_NotificationDialog_NotificationDialog_Note,
  Web_NotificationDialog_NotificationDialog_OnClose,
  Web_NotificationDialog_NotificationDialog_OnSaved,
  Web_NotificationDialog_NotificationDialog_Open,
  Web_NotificationDialog_NotificationDialog_Props,
  Web_NotificationDialog_NotificationDialog_Returns,
  Web_NotificationDialog_NotificationDialog_Saved,
  Web_NotificationDialog_NotificationDialog_SelectedEvents,
  Web_NotificationDialog_NotificationDialog_SelectedEventsState,
  Web_NotificationDialog_NotificationDialog_Service,
  Web_NotificationDialog_NotificationDialog_ServiceIssue,
  Web_NotificationDialog_NotificationDialog_ServiceSelectRef,
  Web_NotificationDialog_NotificationDialog_ServiceSelectRefValue,
  Web_NotificationDialog_NotificationDialog_ServiceState,
  Web_NotificationDialog_NotificationDialog_ServiceSubmissionAttempted,
  Web_NotificationDialog_NotificationDialog_ServiceSubmissionAttemptedState,
  Web_NotificationDialog_NotificationDialog_SetBusy,
  Web_NotificationDialog_NotificationDialog_SetClearSecrets,
  Web_NotificationDialog_NotificationDialog_SetError,
  Web_NotificationDialog_NotificationDialog_SetName,
  Web_NotificationDialog_NotificationDialog_SetSelectedEvents,
  Web_NotificationDialog_NotificationDialog_SetService,
  Web_NotificationDialog_NotificationDialog_SetServiceSubmissionAttempted,
  Web_NotificationDialog_NotificationDialog_SetValues,
  Web_NotificationDialog_NotificationDialog_Submit,
  Web_NotificationDialog_NotificationDialog_Submit_Event,
  Web_NotificationDialog_NotificationDialog_Submit_OrderedEvents,
  Web_NotificationDialog_NotificationDialog_Submit_Returns,
  Web_NotificationDialog_NotificationDialog_Submit_ServiceSelect,
  Web_NotificationDialog_NotificationDialog_Submit_Settings,
  Web_NotificationDialog_NotificationDialog_Summary,
  Web_NotificationDialog_NotificationDialog_Target,
  Web_NotificationDialog_NotificationDialog_ToggleEvent,
  Web_NotificationDialog_NotificationDialog_ToggleEvent_Key,
  Web_NotificationDialog_NotificationDialog_ToggleEvent_Returns,
  Web_NotificationDialog_NotificationDialog_Values,
  Web_NotificationDialog_NotificationDialog_ValuesState,
} from '@/types/web/notification-dialog.d.ts';
import type {
  Web_Notifications_Event,
  Web_Notifications_ServiceDefinition,
} from '@/types/web/notifications.d.ts';

// fieldHint explains a field below it, unless a problem with it is shown instead.

/**
 * Notification Dialog - Field Hint.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_NotificationDialog_FieldHint_Field}       field       - Field.
 * @param {Web_NotificationDialog_FieldHint_Target}      target      - Target.
 * @param {Web_NotificationDialog_FieldHint_Interpreter} interpreter - Interpreter.
 * @param {Web_NotificationDialog_FieldHint_Cleared}     cleared     - Cleared.
 *
 * @returns {Web_NotificationDialog_FieldHint_Returns}
 *
 * @since 2.0.0
 */
const fieldHint = (field: Web_NotificationDialog_FieldHint_Field, target: Web_NotificationDialog_FieldHint_Target, interpreter: Web_NotificationDialog_FieldHint_Interpreter, cleared: Web_NotificationDialog_FieldHint_Cleared): Web_NotificationDialog_FieldHint_Returns => {
  if (cleared === true) {
    if (target !== null && target['secretsMissing'].includes(field['key']) === true) {
      return 'Alerts will resume without this optional value.';
    }

    return 'This optional value will be removed when you save.';
  }

  if (
    target !== null
    && field['secret'] === true
    && target['secretsMissing'].includes(field['key']) === true
  ) {
    return 'A lost key removed it. Enter it again.';
  }

  if (
    target !== null
    && field['secret'] === true
    && target['secrets'][field['key']] === true
  ) {
    return 'Saved. Leave blank to keep it.';
  }

  return (field['hint'] ?? '').replace('{interpreter}', interpreter);
};

/**
 * Notification Dialog - Notification Dialog.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_NotificationDialog_NotificationDialog_Props} props - Props.
 *
 * @returns {Web_NotificationDialog_NotificationDialog_Returns}
 *
 * @since 2.0.0
 */
export const NotificationDialog = (props: Web_NotificationDialog_NotificationDialog_Props): Web_NotificationDialog_NotificationDialog_Returns => {
  const events: Web_NotificationDialog_NotificationDialog_Events = props['events'];
  const interpreter: Web_NotificationDialog_NotificationDialog_Interpreter = props['interpreter'];
  const onClose: Web_NotificationDialog_NotificationDialog_OnClose = props['onClose'];
  const onSaved: Web_NotificationDialog_NotificationDialog_OnSaved = props['onSaved'];
  const open: Web_NotificationDialog_NotificationDialog_Open = props['open'];
  const target: Web_NotificationDialog_NotificationDialog_Target = props['target'];
  const serviceState: Web_NotificationDialog_NotificationDialog_ServiceState = useState<Web_NotificationDialog_NotificationDialog_Service>('');
  const service: Web_NotificationDialog_NotificationDialog_Service = serviceState[0];
  const setService: Web_NotificationDialog_NotificationDialog_SetService = serviceState[1];
  const serviceSubmissionAttemptedState: Web_NotificationDialog_NotificationDialog_ServiceSubmissionAttemptedState = useState<Web_NotificationDialog_NotificationDialog_ServiceSubmissionAttempted>(false);
  const serviceSubmissionAttempted: Web_NotificationDialog_NotificationDialog_ServiceSubmissionAttempted = serviceSubmissionAttemptedState[0];
  const setServiceSubmissionAttempted: Web_NotificationDialog_NotificationDialog_SetServiceSubmissionAttempted = serviceSubmissionAttemptedState[1];
  const nameState: Web_NotificationDialog_NotificationDialog_NameState = useState<Web_NotificationDialog_NotificationDialog_Name>('');
  const name: Web_NotificationDialog_NotificationDialog_Name = nameState[0];
  const setName: Web_NotificationDialog_NotificationDialog_SetName = nameState[1];
  const valuesState: Web_NotificationDialog_NotificationDialog_ValuesState = useState<Web_NotificationDialog_NotificationDialog_Values>({});
  const values: Web_NotificationDialog_NotificationDialog_Values = valuesState[0];
  const setValues: Web_NotificationDialog_NotificationDialog_SetValues = valuesState[1];
  const selectedEventsState: Web_NotificationDialog_NotificationDialog_SelectedEventsState = useState<Web_NotificationDialog_NotificationDialog_SelectedEvents>([]);
  const selectedEvents: Web_NotificationDialog_NotificationDialog_SelectedEvents = selectedEventsState[0];
  const setSelectedEvents: Web_NotificationDialog_NotificationDialog_SetSelectedEvents = selectedEventsState[1];
  const clearSecretsState: Web_NotificationDialog_NotificationDialog_ClearSecretsState = useState<Web_NotificationDialog_NotificationDialog_ClearSecrets>([]);
  const clearSecrets: Web_NotificationDialog_NotificationDialog_ClearSecrets = clearSecretsState[0];
  const setClearSecrets: Web_NotificationDialog_NotificationDialog_SetClearSecrets = clearSecretsState[1];
  const errorState: Web_NotificationDialog_NotificationDialog_ErrorState = useState<Web_NotificationDialog_NotificationDialog_Error>(null);
  const error: Web_NotificationDialog_NotificationDialog_Error = errorState[0];
  const setError: Web_NotificationDialog_NotificationDialog_SetError = errorState[1];
  const busyState: Web_NotificationDialog_NotificationDialog_BusyState = useState<Web_NotificationDialog_NotificationDialog_Busy>(false);
  const busy: Web_NotificationDialog_NotificationDialog_Busy = busyState[0];
  const setBusy: Web_NotificationDialog_NotificationDialog_SetBusy = busyState[1];

  const baseId: Web_NotificationDialog_NotificationDialog_BaseId = useId();
  const serviceSelectRef: Web_NotificationDialog_NotificationDialog_ServiceSelectRef = useRef<Web_NotificationDialog_NotificationDialog_ServiceSelectRefValue>(null);

  useEscapeKey(onClose, open);

  useEffect(() => {
    if (open === false) {
      return;
    }

    if (target === null) {
      setService('');
      setName('');
      setValues({});
      setSelectedEvents(events.filter((event) => event['defaultEnabled'] === true).map((event) => event['key']));
    } else {
      setService(target['service']);
      setName(target['name']);
      setValues({
        ...notificationServiceValues(target['service']),
        ...target['settings'],
      });
      setSelectedEvents(target['events']);
    }

    setError(null);
    setClearSecrets([]);
    setServiceSubmissionAttempted(false);

    return;
  }, [
    events,
    open,
    target,
  ]);

  if (open === false) {
    return null;
  }

  // A new notification starts on "— Select one —", so its service fields wait for a choice.
  const fields: Web_NotificationDialog_NotificationDialog_Fields = (service === '') ? [] : findNotificationService(service)['fields'];

  /**
   * Notification Dialog - Toggle Event.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @param {Web_NotificationDialog_NotificationDialog_ToggleEvent_Key} key - Key.
   *
   * @returns {Web_NotificationDialog_NotificationDialog_ToggleEvent_Returns}
   *
   * @since 2.0.0
   */
  const toggleEvent: Web_NotificationDialog_NotificationDialog_ToggleEvent = (key: Web_NotificationDialog_NotificationDialog_ToggleEvent_Key): Web_NotificationDialog_NotificationDialog_ToggleEvent_Returns => {
    setSelectedEvents((current) => (
      (current.includes(key) === true) ? current.filter((candidate) => candidate !== key) : [
        ...current,
        key,
      ]
    ));

    return;
  };

  /**
   * Notification Dialog - Submit.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @param {Web_NotificationDialog_NotificationDialog_Submit_Event} event - Event.
   *
   * @returns {Web_NotificationDialog_NotificationDialog_Submit_Returns}
   *
   * @since 2.0.0
   */
  const submit: Web_NotificationDialog_NotificationDialog_Submit = async (event: Web_NotificationDialog_NotificationDialog_Submit_Event): Web_NotificationDialog_NotificationDialog_Submit_Returns => {
    event.preventDefault();

    setServiceSubmissionAttempted(true);

    if (service === '') {
      const serviceSelect: Web_NotificationDialog_NotificationDialog_Submit_ServiceSelect = serviceSelectRef.current;

      if (serviceSelect !== null) {
        serviceSelect.focus();
      }

      return;
    }

    setBusy(true);
    setError(null);

    const orderedEvents: Web_NotificationDialog_NotificationDialog_Submit_OrderedEvents = events
      .map((option) => option['key'])
      .filter((key) => selectedEvents.includes(key));
    const settings: Web_NotificationDialog_NotificationDialog_Submit_Settings = Object.fromEntries(fields.map((field) => [
      field['key'],
      (values[field['key']] ?? '').trim(),
    ]));

    try {
      if (target === null) {
        await createNotification({
          events: orderedEvents,
          name,
          service,
          settings,
        });
      } else {
        await updateNotification(target['id'], {
          clearSecrets,
          events: orderedEvents,
          name,
          settings,
        });
      }

      await onSaved();
      showToast((target === null) ? `${name.trim()} added.` : `${name.trim()} saved.`, true);
      onClose();
    } catch (caughtError) {
      setError(caughtError);
    } finally {
      setBusy(false);
    }

    return;
  };

  let serviceIssue: Web_NotificationDialog_NotificationDialog_ServiceIssue = issueFor(error, 'service');

  if (serviceIssue === '') {
    serviceIssue = notificationServiceIssue(service, serviceSubmissionAttempted);
  }

  const nameIssue: Web_NotificationDialog_NotificationDialog_NameIssue = issueFor(error, 'name');
  const eventsIssue: Web_NotificationDialog_NotificationDialog_EventsIssue = issueFor(error, 'events');
  const summary: Web_NotificationDialog_NotificationDialog_Summary = summaryFor(error, [
    'events',
    'name',
    'service',
    ...fields.map((field) => `settings.${field['key']}`),
  ], 'The notification could not be saved.');

  return (
    <div className="dialog-backdrop" role="presentation">
      <section aria-labelledby="notification-dialog-title" aria-modal="true" className="dialog" role="dialog">
        <div className="dialog-heading">
          <div>
            <h2 id="notification-dialog-title">{(target === null) ? 'Add notification' : `Edit ${target['name']}`}</h2>
            <p>{(target === null) ? 'Pick a service, then the events it should hear about.' : 'Leave a saved secret blank to keep it.'}</p>
          </div>
          <button aria-label="Close" className="icon-button" onClick={onClose} type="button">
            <Icon name="x" size={18} />
          </button>
        </div>

        <form noValidate onSubmit={submit}>
          <FieldLabel>
            <span>Service</span>
            <select
              aria-invalid={serviceIssue !== ''}
              className="select-control"
              disabled={target !== null}
              onChange={(event) => {
                const nextService: Web_NotificationDialog_NotificationDialog_NextService = event.currentTarget.value as Web_NotificationDialog_NotificationDialog_NextService;

                setService(nextService);
                setValues(notificationServiceValues(nextService));
                setServiceSubmissionAttempted(false);

                return;
              }}
              ref={serviceSelectRef}
              value={service}
            >
              <option className="select-placeholder" value="">— Select one —</option>
              {notificationServices.map((option: Web_Notifications_ServiceDefinition): ReactElement => <option key={option['key']} value={option['key']}>{option['label']}</option>)}
            </select>
            {(serviceIssue === '') ? null : <small className="field-error">{serviceIssue}</small>}
          </FieldLabel>

          <FieldLabel>
            <span>Name</span>
            <input
              aria-invalid={nameIssue !== ''}
              onChange={(event) => setName(event.currentTarget.value)}
              placeholder="e.g. My phone"
              value={name}
            />
            {(nameIssue === '') ? <small>{'A name you\'ll recognize, like the device or chat it goes to.'}</small> : <small className="field-error">{nameIssue}</small>}
          </FieldLabel>

          {fields.map((field) => {
            const issue: Web_NotificationDialog_NotificationDialog_Issue = issueFor(error, `settings.${field['key']}`);
            const cleared: Web_NotificationDialog_NotificationDialog_Cleared = clearSecrets.includes(field['key']);
            const hint: Web_NotificationDialog_NotificationDialog_Hint = fieldHint(field, target, interpreter, cleared);
            const saved: Web_NotificationDialog_NotificationDialog_Saved = (
              target !== null
              && field['secret'] === true
              && target['secrets'][field['key']] === true
            );
            const missing: Web_NotificationDialog_NotificationDialog_Missing = target !== null && target['secretsMissing'].includes(field['key']);
            const canClear: Web_NotificationDialog_NotificationDialog_CanClear = (
              target !== null
              && field['secret'] === true
              && field['optional'] === true
              && (
                saved === true
                || missing === true
              )
            );
            let actionLabel: Web_NotificationDialog_NotificationDialog_ActionLabel = (saved === true) ? 'Remove saved value' : 'Continue without this value';
            let note: Web_NotificationDialog_NotificationDialog_Note = null;

            if (cleared === true) {
              actionLabel = (saved === true) ? 'Keep saved value' : 'Require this value';
            }

            if (issue !== '') {
              note = <small className="field-error">{issue}</small>;
            } else if (hint !== '') {
              note = <small>{hint}</small>;
            }

            return (
              <div className="notification-field" key={`${service}-${field['key']}`}>
                <FieldLabel>
                  <span>{field['label']}</span>
                  {(field['kind'] === 'select') ? (
                    <select
                      className="select-control"
                      onChange={(event) => {
                        const nextValue: Web_NotificationDialog_NotificationDialog_NextValue = event.currentTarget.value;

                        setValues((current) => ({
                          ...current,
                          [field['key']]: nextValue,
                        }));

                        return;
                      }}
                      value={values[field['key']] ?? ''}
                    >
                      {(field['options'] ?? []).map((option): ReactElement => <option key={option['value']} value={option['value']}>{option['label']}</option>)}
                    </select>
                  ) : (
                    <input
                      {...passwordManagerIgnore}
                      aria-invalid={issue !== ''}
                      autoCapitalize="none"
                      autoComplete="off"
                      className={(field['kind'] === 'url' || field['kind'] === 'password') ? 'monospace' : undefined}
                      disabled={cleared}
                      inputMode={(field['kind'] === 'number') ? 'numeric' : undefined}
                      onChange={(event) => {
                        const nextValue: Web_NotificationDialog_NotificationDialog_NextValue = event.currentTarget.value;

                        setValues((current) => ({
                          ...current,
                          [field['key']]: nextValue,
                        }));

                        return;
                      }}
                      placeholder={(saved === true) ? 'Saved' : (field['placeholder'] ?? '')}
                      spellCheck={false}
                      type={(field['kind'] === 'password') ? 'password' : 'text'}
                      value={values[field['key']] ?? ''}
                    />
                  )}
                  {note}
                </FieldLabel>
                {(canClear === true) ? (
                  <button
                    aria-pressed={cleared}
                    className="text-button notification-secret-action"
                    onClick={() => {
                      setClearSecrets((current) => (
                        (current.includes(field['key']) === true) ? current.filter((key) => key !== field['key']) : [
                          ...current,
                          field['key'],
                        ]
                      ));
                      setValues((current) => ({
                        ...current,
                        [field['key']]: '',
                      }));

                      return;
                    }}
                    type="button"
                  >
                    {actionLabel}
                  </button>
                ) : null}
              </div>
            );
          })}

          <fieldset className="scope-fieldset">
            <legend>Events</legend>
            {events.map((option: Web_Notifications_Event): ReactElement => (
              <label aria-label={option['label']} className="check-row" key={option['key']}>
                <input
                  aria-describedby={`${baseId}-${option['key']}-description`}
                  aria-labelledby={`${baseId}-${option['key']}-label`}
                  checked={selectedEvents.includes(option['key'])}
                  onChange={() => toggleEvent(option['key'])}
                  type="checkbox"
                />
                <span>
                  <strong id={`${baseId}-${option['key']}-label`}>{option['label']}</strong>
                  <small id={`${baseId}-${option['key']}-description`}>{option['description']}</small>
                </span>
              </label>
            ))}
            {(eventsIssue === '') ? null : <small className="field-error">{eventsIssue}</small>}
          </fieldset>

          {(summary === '') ? null : (
            <div className="form-error" role="alert">
              <Icon name="warning" size={16} />
              <span>{summary}</span>
            </div>
          )}

          <div className="dialog-actions">
            <Button onClick={onClose}>Cancel</Button>
            <Button
              disabled={(
                busy === true
                || selectedEvents.length === 0
                || name.trim() === ''
              )}
              type="submit"
              variant="primary"
            >
              {(target === null) ? 'Add notification' : 'Save'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
};
