import { useState } from 'react';

import { summaryFor } from '@/web/api.ts';
import { formatDate } from '@/web/format.ts';
import {
  Button,
  Icon,
} from '@/web/primitives.tsx';

import type { Web_Components_KeyNotice_Props } from '@/types/web/components.d.ts';
import type {
  Web_KeyNotice_KeyNotice_AppName,
  Web_KeyNotice_KeyNotice_Busy,
  Web_KeyNotice_KeyNotice_BusyState,
  Web_KeyNotice_KeyNotice_Dismiss,
  Web_KeyNotice_KeyNotice_Dismiss_Returns,
  Web_KeyNotice_KeyNotice_Error,
  Web_KeyNotice_KeyNotice_ErrorState,
  Web_KeyNotice_KeyNotice_Items,
  Web_KeyNotice_KeyNotice_KeyName,
  Web_KeyNotice_KeyNotice_OnDismiss,
  Web_KeyNotice_KeyNotice_RemovedAt,
  Web_KeyNotice_KeyNotice_Returns,
  Web_KeyNotice_KeyNotice_SetBusy,
  Web_KeyNotice_KeyNotice_SetError,
} from '@/types/web/key-notice.d.ts';

// Lists what a lost key took, on every page, until each one is entered again or the notice is dismissed.

/**
 * Key Notice - Key Notice.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_Components_KeyNotice_Props} props - Props.
 *
 * @returns {Web_KeyNotice_KeyNotice_Returns}
 *
 * @since 2.0.0
 */
export const KeyNotice = (props: Web_Components_KeyNotice_Props): Web_KeyNotice_KeyNotice_Returns => {
  const appName: Web_KeyNotice_KeyNotice_AppName = props['appName'];
  const items: Web_KeyNotice_KeyNotice_Items = props['items'];
  const keyName: Web_KeyNotice_KeyNotice_KeyName = props['keyName'];
  const onDismiss: Web_KeyNotice_KeyNotice_OnDismiss = props['onDismiss'];
  const removedAt: Web_KeyNotice_KeyNotice_RemovedAt = props['removedAt'];
  const busyState: Web_KeyNotice_KeyNotice_BusyState = useState<Web_KeyNotice_KeyNotice_Busy>(false);
  const busy: Web_KeyNotice_KeyNotice_Busy = busyState[0];
  const setBusy: Web_KeyNotice_KeyNotice_SetBusy = busyState[1];
  const errorState: Web_KeyNotice_KeyNotice_ErrorState = useState<Web_KeyNotice_KeyNotice_Error>(null);
  const error: Web_KeyNotice_KeyNotice_Error = errorState[0];
  const setError: Web_KeyNotice_KeyNotice_SetError = errorState[1];

  /**
   * Key Notice - Dismiss.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @returns {Web_KeyNotice_KeyNotice_Dismiss_Returns}
   *
   * @since 2.0.0
   */
  const dismiss: Web_KeyNotice_KeyNotice_Dismiss = async (): Web_KeyNotice_KeyNotice_Dismiss_Returns => {
    setBusy(true);
    setError(null);

    try {
      await onDismiss();
    } catch (caughtError) {
      setError(caughtError);
    } finally {
      setBusy(false);
    }

    return;
  };

  return (
    <section aria-labelledby="key-notice-title" className="key-notice">
      <Icon name="warning" size={20} />
      <div className="key-notice-body">
        <strong id="key-notice-title">Saved secrets were removed</strong>
        <p>{`${appName} started without its ${keyName} on ${formatDate(removedAt)}, so it made a new one. Secrets locked with the old key can't be opened anymore. Enter these again:`}</p>
        <ul>
          {items.map((item) => (
            <li key={item['id']}>
              <button className="text-button" onClick={item['onOpen']} type="button">{item['label']}</button>
            </li>
          ))}
        </ul>
        {(error === null) ? null : (
          <div className="form-error" role="alert">
            {summaryFor(error, [], 'The notice could not be dismissed.')}
          </div>
        )}
        <div className="key-notice-actions">
          <Button
            disabled={busy}
            onClick={() => {
              void dismiss();

              return;
            }}
          >
            Dismiss
          </Button>
        </div>
      </div>
    </section>
  );
};
