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
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_AddLabel,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_AddLabel_NormalizedLabel,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_AddLabel_Returns,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Busy,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_BusyState,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Error,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_ErrorState,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Initialized,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_InitializedState,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_LabelDrafts,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_LabelDraftsState,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Labels,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_NewLabel,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_NewLabelState,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_NextLabelId,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_OnClose,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_OnSave,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Open,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_OpenedLabels,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_OpenedLabelsState,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Organization,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Props,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Returns,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Save,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Save_Event,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Save_NormalizedLabels,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Save_Returns,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_SetBusy,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_SetError,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_SetInitialized,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_SetLabelDrafts,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_SetNewLabel,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_SetOpenedLabels,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_SortedLabels,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_UpdateLabel,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_UpdateLabel_Id,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_UpdateLabel_Returns,
  Web_TorrentOrganizationDialog_TorrentOrganizationDialog_UpdateLabel_Value,
} from '@/types/web/torrent-organization-dialog.d.ts';

/**
 * Torrent Organization Dialog - Torrent Organization Dialog.
 *
 * Edits saved and in-use labels while retaining their original identities for
 * torrent-wide removal and rename operations.
 *
 * @param {Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Props} props - Props.
 *
 * @returns {Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Returns}
 *
 * @since 2.0.0
 */
export const TorrentOrganizationDialog = (props: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Props): Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Returns => {
  const labels: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Labels = props['labels'];
  const onClose: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_OnClose = props['onClose'];
  const onSave: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_OnSave = props['onSave'];
  const open: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Open = props['open'];
  const organization: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Organization = props['organization'];
  const labelDraftsState: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_LabelDraftsState = useState<Web_TorrentOrganizationDialog_TorrentOrganizationDialog_LabelDrafts>([]);
  const labelDrafts: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_LabelDrafts = labelDraftsState[0];
  const setLabelDrafts: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_SetLabelDrafts = labelDraftsState[1];
  const openedLabelsState: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_OpenedLabelsState = useState<Web_TorrentOrganizationDialog_TorrentOrganizationDialog_OpenedLabels>([]);
  const openedLabels: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_OpenedLabels = openedLabelsState[0];
  const setOpenedLabels: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_SetOpenedLabels = openedLabelsState[1];
  const newLabelState: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_NewLabelState = useState<Web_TorrentOrganizationDialog_TorrentOrganizationDialog_NewLabel>('');
  const newLabel: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_NewLabel = newLabelState[0];
  const setNewLabel: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_SetNewLabel = newLabelState[1];
  const busyState: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_BusyState = useState<Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Busy>(false);
  const busy: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Busy = busyState[0];
  const setBusy: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_SetBusy = busyState[1];
  const errorState: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_ErrorState = useState<Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Error>('');
  const error: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Error = errorState[0];
  const setError: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_SetError = errorState[1];
  const initializedState: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_InitializedState = useState<Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Initialized>(false);
  const initialized: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Initialized = initializedState[0];
  const setInitialized: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_SetInitialized = initializedState[1];
  const nextLabelID: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_NextLabelId = useRef<number>(0);

  useEffect(() => {
    if (open === false) {
      setInitialized(false);

      return;
    }

    if (initialized === true || organization === null) {
      return;
    }

    const sortedLabels: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_SortedLabels = sortTorrentOrganizationValues(labels);

    setLabelDrafts(sortedLabels.map((label, index) => ({
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

    return;
  }, [
    initialized,
    labels,
    open,
    organization,
  ]);

  useEscapeKey(onClose, open);

  if (open === false || organization === null) {
    return null;
  }

  /**
   * Torrent Organization Dialog - Add Label.
   *
   * Adds one unsaved label draft after checking the same length and uniqueness
   * rules used by the request parser.
   *
   * @returns {Web_TorrentOrganizationDialog_TorrentOrganizationDialog_AddLabel_Returns}
   *
   * @since 2.0.0
   */
  const addLabel: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_AddLabel = (): Web_TorrentOrganizationDialog_TorrentOrganizationDialog_AddLabel_Returns => {
    const normalizedLabel: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_AddLabel_NormalizedLabel = newLabel.trim();

    if (normalizedLabel === '' || normalizedLabel.length > 128) {
      setError('Labels must contain between 1 and 128 characters.');

      return;
    }

    if (labelDrafts.some(
      (draft) => draft['value'].trim().toLowerCase() === normalizedLabel.toLowerCase(),
    ) === true) {
      setError('That label is already listed.');

      return;
    }

    setLabelDrafts((currentDrafts) => [
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

    return;
  };

  /**
   * Torrent Organization Dialog - Update Label.
   *
   * Changes only the displayed value while preserving the original label used
   * to build a rename operation.
   *
   * @param {Web_TorrentOrganizationDialog_TorrentOrganizationDialog_UpdateLabel_Id}    id    - Id.
   * @param {Web_TorrentOrganizationDialog_TorrentOrganizationDialog_UpdateLabel_Value} value - Value.
   *
   * @returns {Web_TorrentOrganizationDialog_TorrentOrganizationDialog_UpdateLabel_Returns}
   *
   * @since 2.0.0
   */
  const updateLabel: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_UpdateLabel = (id: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_UpdateLabel_Id, value: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_UpdateLabel_Value): Web_TorrentOrganizationDialog_TorrentOrganizationDialog_UpdateLabel_Returns => {
    setLabelDrafts((currentDrafts) => currentDrafts.map(
      (draft) => (
        (draft['id'] === id) ? {
          ...draft,
          value,
        } : draft
      ),
    ));

    return;
  };

  /**
   * Torrent Organization Dialog - Save.
   *
   * Sends the complete label set together with explicit removal and rename
   * operations so the server can update affected torrents.
   *
   * @param {Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Save_Event} event - Event.
   *
   * @returns {Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Save_Returns}
   *
   * @since 2.0.0
   */
  const save: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Save = async (event: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Save_Event): Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Save_Returns => {
    event.preventDefault();

    const normalizedLabels: Web_TorrentOrganizationDialog_TorrentOrganizationDialog_Save_NormalizedLabels = labelDrafts.map(
      (draft) => draft['value'].trim(),
    );

    if (normalizedLabels.some((label) => label === '' || label.length > 128) === true) {
      setError('Labels must contain between 1 and 128 characters.');

      return;
    }

    if (new Set(normalizedLabels.map((label) => label.toLowerCase())).size !== normalizedLabels.length) {
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

    return;
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
                onChange={(event) => setNewLabel(event.currentTarget.value)}
                placeholder="e.g. Archive"
                type="text"
                value={newLabel}
              />
              <Button disabled={newLabel.trim() === ''} onClick={addLabel} type="button">Add</Button>
            </div>
            <div className="organization-value-list">
              {(labelDrafts.length === 0) ? (
                <p className="organization-empty">No labels yet.</p>
              ) : labelDrafts.map((draft, index) => (
                <div className="organization-value-row" key={draft['id']}>
                  <input
                    aria-label={`Label ${index + 1}`}
                    onChange={(event) => updateLabel(draft['id'], event.currentTarget.value)}
                    type="text"
                    value={draft['value']}
                  />
                  <button
                    aria-label={`Remove ${draft['value']}`}
                    className="icon-button organization-remove-button"
                    onClick={() => {
                      setLabelDrafts((currentDrafts) => currentDrafts.filter(
                        (currentDraft) => currentDraft['id'] !== draft['id'],
                      ));

                      return;
                    }}
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
            <Button disabled={busy} icon="check" type="submit" variant="primary">{(busy === true) ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </section>
    </div>
  );
};
