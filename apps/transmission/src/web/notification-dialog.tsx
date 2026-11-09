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

import type {
  FormEvent,
  ReactElement,
} from 'react';

import type {
  Web_Notifications_DialogProps,
  Web_Notifications_Event,
  Web_Notifications_Field,
  Web_Notifications_Service,
  Web_Notifications_ServiceDefinition,
  Web_Notifications_Target,
} from '@/types/web/notifications.d.ts';

// fieldHint explains a field below it, unless a problem with it is shown instead.

/**
 * Notification Dialog - Field hint.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const fieldHint = (field: Web_Notifications_Field, target: Web_Notifications_Target | null, interpreter: string, cleared: boolean): string => {
  if (cleared) {
    if (target !== null && target['secretsMissing'].includes(field['key'])) {
      return 'Alerts will resume without this optional value.';
    }

    return 'This optional value will be removed when you save.';
  }

  if (target !== null && field['secret'] === true && target['secretsMissing'].includes(field['key'])) {
    return 'A lost key removed it. Enter it again.';
  }

  if (target !== null && field['secret'] === true && target['secrets'][field['key']] === true) {
    return 'Saved. Leave blank to keep it.';
  }

  return (field['hint'] ?? '').replace('{interpreter}', interpreter);
};

/**
 * Notification Dialog.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const NotificationDialog = ({
  events,
  interpreter,
  onClose,
  onSaved,
  open,
  target,
}: Web_Notifications_DialogProps): ReactElement | null => {
  const [
    service,
    setService,
  ] = useState<Web_Notifications_Service | ''>('');
  const [
    serviceSubmissionAttempted,
    setServiceSubmissionAttempted,
  ] = useState<boolean>(false);
  const [
    name,
    setName,
  ] = useState<string>('');
  const [
    values,
    setValues,
  ] = useState<Record<string, string>>({});
  const [
    selectedEvents,
    setSelectedEvents,
  ] = useState<string[]>([]);
  const [
    clearSecrets,
    setClearSecrets,
  ] = useState<string[]>([]);
  const [
    error,
    setError,
  ] = useState<unknown>(null);
  const [
    busy,
    setBusy,
  ] = useState<boolean>(false);

  const baseId: string = useId();
  const serviceSelectRef = useRef<HTMLSelectElement | null>(null);

  useEscapeKey(onClose, open);

  useEffect((): void => {
    if (!open) {
      return;
    }

    if (target === null) {
      setService('');
      setName('');
      setValues({});
      setSelectedEvents(events.filter((event: Web_Notifications_Event): boolean => event['defaultEnabled']).map((event: Web_Notifications_Event): string => event['key']));
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
  }, [
    events,
    open,
    target,
  ]);

  if (!open) {
    return null;
  }

  // A new notification starts on "— Select one —", so its service fields wait for a choice.
  const fields: Web_Notifications_Field[] = (service === '') ? [] : findNotificationService(service)['fields'];

  /**
   * Notification Dialog - Toggles event.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const toggleEvent = (key: string): void => {
    setSelectedEvents((current: string[]): string[] => (
      (current.includes(key)) ? current.filter((candidate: string): boolean => candidate !== key) : [
        ...current,
        key,
      ]
    ));
  };

  /**
   * Notification Dialog - Submit.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setServiceSubmissionAttempted(true);

    if (service === '') {
      const serviceSelect: HTMLSelectElement | null = serviceSelectRef.current;
      if (serviceSelect !== null) {
        serviceSelect.focus();
      }

      return;
    }

    setBusy(true);
    setError(null);

    const orderedEvents: string[] = events
      .map((option: Web_Notifications_Event): string => option['key'])
      .filter((key: string): boolean => selectedEvents.includes(key));
    const settings: Record<string, string> = Object.fromEntries(fields.map((field: Web_Notifications_Field): [string, string] => [
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
  };

  let serviceIssue: string = issueFor(error, 'service');
  if (serviceIssue === '') {
    serviceIssue = notificationServiceIssue(service, serviceSubmissionAttempted);
  }
  const nameIssue: string = issueFor(error, 'name');
  const eventsIssue: string = issueFor(error, 'events');
  const summary: string = summaryFor(error, [
    'events',
    'name',
    'service',
    ...fields.map((field: Web_Notifications_Field): string => `settings.${field['key']}`),
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
              onChange={(event): void => {
                const nextService: Web_Notifications_Service | '' = event.currentTarget.value as Web_Notifications_Service | '';

                setService(nextService);
                setValues(notificationServiceValues(nextService));
                setServiceSubmissionAttempted(false);
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
              onChange={(event): void => setName(event.currentTarget.value)}
              placeholder="e.g. My phone"
              value={name}
            />
            {(nameIssue === '') ? <small>{'A name you\'ll recognize, like the device or chat it goes to.'}</small> : <small className="field-error">{nameIssue}</small>}
          </FieldLabel>

          {fields.map((field: Web_Notifications_Field): ReactElement => {
            const issue: string = issueFor(error, `settings.${field['key']}`);
            const cleared: boolean = clearSecrets.includes(field['key']);
            const hint: string = fieldHint(field, target, interpreter, cleared);
            const saved: boolean = target !== null && field['secret'] === true && target['secrets'][field['key']] === true;
            const missing: boolean = target !== null && target['secretsMissing'].includes(field['key']);
            const canClear: boolean = target !== null && field['secret'] === true && field['optional'] === true && (saved || missing);
            let actionLabel: string = (saved) ? 'Remove saved value' : 'Continue without this value';
            let note: ReactElement | null = null;

            if (cleared) {
              actionLabel = (saved) ? 'Keep saved value' : 'Require this value';
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
                      onChange={(event): void => {
                        const nextValue: string = event.currentTarget.value;

                        setValues((current: Record<string, string>): Record<string, string> => ({
                          ...current,
                          [field['key']]: nextValue,
                        }));
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
                      onChange={(event): void => {
                        const nextValue: string = event.currentTarget.value;

                        setValues((current: Record<string, string>): Record<string, string> => ({
                          ...current,
                          [field['key']]: nextValue,
                        }));
                      }}
                      placeholder={(saved) ? 'Saved' : (field['placeholder'] ?? '')}
                      spellCheck={false}
                      type={(field['kind'] === 'password') ? 'password' : 'text'}
                      value={values[field['key']] ?? ''}
                    />
                  )}
                  {note}
                </FieldLabel>
                {(canClear) ? (
                  <button
                    aria-pressed={cleared}
                    className="text-button notification-secret-action"
                    onClick={(): void => {
                      setClearSecrets((current: string[]): string[] => (
                        (current.includes(field['key'])) ? current.filter((key: string): boolean => key !== field['key']) : [
                          ...current,
                          field['key'],
                        ]
                      ));
                      setValues((current: Record<string, string>): Record<string, string> => ({
                        ...current,
                        [field['key']]: '',
                      }));
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
                  onChange={(): void => toggleEvent(option['key'])}
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
            <Button disabled={busy || selectedEvents.length === 0 || name.trim() === ''} type="submit" variant="primary">
              {(target === null) ? 'Add notification' : 'Save'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
};
