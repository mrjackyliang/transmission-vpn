import { useState } from 'react';

import { summaryFor } from '@/web/api.ts';
import { formatDate } from '@/web/format.ts';
import {
  Button,
  Icon,
} from '@/web/primitives.tsx';

import type { ReactElement } from 'react';

import type {
  Web_Components_KeyNotice_Item,
  Web_Components_KeyNotice_Props,
} from '@/types/web/components.d.ts';

// Lists what a lost key took, on every page, until each one is entered again or the notice is dismissed.

/**
 * Key Notice.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const KeyNotice = ({
  appName,
  items,
  keyName,
  onDismiss,
  removedAt,
}: Web_Components_KeyNotice_Props): ReactElement => {
  const [
    busy,
    setBusy,
  ] = useState<boolean>(false);
  const [
    error,
    setError,
  ] = useState<unknown>(null);

  /**
   * Key Notice - Dismiss.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const dismiss = async (): Promise<void> => {
    setBusy(true);
    setError(null);

    try {
      await onDismiss();
    } catch (caughtError) {
      setError(caughtError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="key-notice-title" className="key-notice">
      <Icon name="warning" size={20} />
      <div className="key-notice-body">
        <strong id="key-notice-title">Saved secrets were removed</strong>
        <p>{`${appName} started without its ${keyName} on ${formatDate(removedAt)}, so it made a new one. Secrets locked with the old key can't be opened anymore. Enter these again:`}</p>
        <ul>
          {items.map((item: Web_Components_KeyNotice_Item): ReactElement => (
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
            onClick={(): void => {
              void dismiss();
            }}
          >
            Dismiss
          </Button>
        </div>
      </div>
    </section>
  );
};
