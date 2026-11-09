import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Button,
  Icon,
} from '@/web/primitives.tsx';
import {
  buildTorrentOrganizationUpdate,
  sortTorrentOrganizationValues,
} from '@/web/torrent-organization.ts';
import { useEscapeKey } from '@/web/use-escape-key.ts';

import type {
  FormEvent,
  ReactElement,
} from 'react';

import type {
  Web_Components_TorrentOrganizationDialog_Props,
  Web_Components_TorrentOrganizationLabelDraft,
} from '@/types/web/components.d.ts';

/**
 * Torrent Organization Dialog.
 *
 * Edits saved and in-use labels while retaining their original identities for
 * torrent-wide removal and rename operations.
 *
 * @since 2.0.0
 */
export const TorrentOrganizationDialog = ({
  labels,
  onClose,
  onSave,
  open,
  organization,
}: Web_Components_TorrentOrganizationDialog_Props): ReactElement | null => {
  const [
    labelDrafts,
    setLabelDrafts,
  ] = useState<Web_Components_TorrentOrganizationLabelDraft[]>([]);
  const [
    openedLabels,
    setOpenedLabels,
  ] = useState<string[]>([]);
  const [
    newLabel,
    setNewLabel,
  ] = useState<string>('');
  const [
    busy,
    setBusy,
  ] = useState<boolean>(false);
  const [
    error,
    setError,
  ] = useState<string>('');
  const [
    initialized,
    setInitialized,
  ] = useState<boolean>(false);
  const nextLabelID = useRef<number>(0);

  useEffect((): void => {
    if (!open) {
      setInitialized(false);

      return;
    }
    if (initialized || organization === null) {
      return;
    }

    const sortedLabels: string[] = sortTorrentOrganizationValues(labels);
    setLabelDrafts(sortedLabels.map((label: string, index: number): Web_Components_TorrentOrganizationLabelDraft => ({
      id: `opened-${String(index)}`,
      original: label,
      value: label,
    })));
    setOpenedLabels(sortedLabels);
    setNewLabel('');
    setBusy(false);
    setError('');
    nextLabelID.current = 0;
    setInitialized(true);
  }, [
    initialized,
    labels,
    open,
    organization,
  ]);

  useEscapeKey(onClose, open);

  if (!open || organization === null) {
    return null;
  }

  /**
   * Torrent Organization Dialog - Adds label.
   *
   * Adds one unsaved label draft after checking the same length and uniqueness
   * rules used by the request parser.
   *
   * @since UNRELEASED
   */
  const addLabel = (): void => {
    const normalizedLabel: string = newLabel.trim();
    if (normalizedLabel === '' || normalizedLabel.length > 128) {
      setError('Labels must contain between 1 and 128 characters.');

      return;
    }
    if (labelDrafts.some(
      (draft: Web_Components_TorrentOrganizationLabelDraft): boolean => draft['value'].trim().toLowerCase() === normalizedLabel.toLowerCase(),
    )) {
      setError('That label is already listed.');

      return;
    }

    setLabelDrafts((currentDrafts: Web_Components_TorrentOrganizationLabelDraft[]): Web_Components_TorrentOrganizationLabelDraft[] => [
      ...currentDrafts,
      {
        id: `new-${String(nextLabelID.current)}`,
        original: null,
        value: normalizedLabel,
      },
    ]);
    nextLabelID.current += 1;
    setNewLabel('');
    setError('');
  };

  /**
   * Torrent Organization Dialog - Updates label.
   *
   * Changes only the displayed value while preserving the original label used
   * to build a rename operation.
   *
   * @since UNRELEASED
   */
  const updateLabel = (id: string, value: string): void => {
    setLabelDrafts((currentDrafts: Web_Components_TorrentOrganizationLabelDraft[]): Web_Components_TorrentOrganizationLabelDraft[] => currentDrafts.map(
      (draft: Web_Components_TorrentOrganizationLabelDraft): Web_Components_TorrentOrganizationLabelDraft => (
        (draft['id'] === id) ? {
          ...draft,
          value,
        } : draft
      ),
    ));
  };

  /**
   * Torrent Organization Dialog - Save.
   *
   * Sends the complete label set together with explicit removal and rename
   * operations so the server can update affected torrents.
   *
   * @since 2.0.0
   */
  const save = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const normalizedLabels: string[] = labelDrafts.map(
      (draft: Web_Components_TorrentOrganizationLabelDraft): string => draft['value'].trim(),
    );
    if (normalizedLabels.some((label: string): boolean => label === '' || label.length > 128)) {
      setError('Labels must contain between 1 and 128 characters.');

      return;
    }
    if (new Set(normalizedLabels.map((label: string): string => label.toLowerCase())).size !== normalizedLabels.length) {
      setError('Labels must be unique.');

      return;
    }

    setBusy(true);
    setError('');
    try {
      await onSave(buildTorrentOrganizationUpdate(
        organization['revision'],
        openedLabels,
        labelDrafts,
      ));
      onClose();
    } catch (caughtError) {
      setError((caughtError instanceof Error) ? caughtError.message : 'The labels couldn\'t be saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dialog-backdrop" role="presentation">
      <section aria-labelledby="torrent-organization-title" aria-modal="true" className="dialog dialog-organization" role="dialog">
        <div className="dialog-heading">
          <div>
            <h2 id="torrent-organization-title">Labels</h2>
            <p>Every label your torrents and profiles use.</p>
          </div>
          <button aria-label="Close" className="icon-button" onClick={onClose} type="button"><Icon name="x" /></button>
        </div>

        <form noValidate onSubmit={save}>
          <section className="organization-editor-section">
            <div className="organization-add-row">
              <input
                aria-label="New label"
                onChange={(event): void => setNewLabel(event.currentTarget.value)}
                placeholder="e.g. Archive"
                type="text"
                value={newLabel}
              />
              <Button disabled={newLabel.trim() === ''} onClick={addLabel} type="button">Add</Button>
            </div>
            <div className="organization-value-list">
              {(labelDrafts.length === 0) ? (
                <p className="organization-empty">No labels yet.</p>
              ) : labelDrafts.map((draft: Web_Components_TorrentOrganizationLabelDraft, index: number): ReactElement => (
                <div className="organization-value-row" key={draft['id']}>
                  <input
                    aria-label={`Label ${index + 1}`}
                    onChange={(event): void => updateLabel(draft['id'], event.currentTarget.value)}
                    type="text"
                    value={draft['value']}
                  />
                  <button
                    aria-label={`Remove ${draft['value']}`}
                    className="icon-button organization-remove-button"
                    onClick={(): void => setLabelDrafts((currentDrafts: Web_Components_TorrentOrganizationLabelDraft[]): Web_Components_TorrentOrganizationLabelDraft[] => currentDrafts.filter(
                      (currentDraft: Web_Components_TorrentOrganizationLabelDraft): boolean => currentDraft['id'] !== draft['id'],
                    ))}
                    type="button"
                  >
                    <Icon name="remove" size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <p className="organization-safety-note">Removing a label here removes it from its torrents and profiles. Renaming one renames it on them.</p>
          {(error === '') ? null : <div className="form-error" role="alert">{error}</div>}
          <div className="dialog-actions">
            <Button onClick={onClose}>Cancel</Button>
            <Button disabled={busy} icon="check" type="submit" variant="primary">{(busy) ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </section>
    </div>
  );
};
