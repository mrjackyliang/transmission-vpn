import {
  useEffect,
  useRef,
  useState,
} from 'react';

import { formatBlocklistSourceLine } from '@/web/blocklist-status.ts';
import {
  Button,
  Icon,
} from '@/web/primitives.tsx';
import {
  getSettingListEmptyState,
  normalizeSettingListValues,
} from '@/web/settings-list-editor.ts';

import type {
  Web_SettingsListEditor_SettingsListEditor_AtLimit,
  Web_SettingsListEditor_SettingsListEditor_Blocklist,
  Web_SettingsListEditor_SettingsListEditor_BlocklistsEnabled,
  Web_SettingsListEditor_SettingsListEditor_BlocklistStatus,
  Web_SettingsListEditor_SettingsListEditor_Disabled,
  Web_SettingsListEditor_SettingsListEditor_EditorVersion,
  Web_SettingsListEditor_SettingsListEditor_EmptyState,
  Web_SettingsListEditor_SettingsListEditor_FocusIndex,
  Web_SettingsListEditor_SettingsListEditor_InputElements,
  Web_SettingsListEditor_SettingsListEditor_InputRefs,
  Web_SettingsListEditor_SettingsListEditor_Invalid,
  Web_SettingsListEditor_SettingsListEditor_NextRows,
  Web_SettingsListEditor_SettingsListEditor_OnChange,
  Web_SettingsListEditor_SettingsListEditor_PendingFocusIndex,
  Web_SettingsListEditor_SettingsListEditor_PendingFocusIndexRef,
  Web_SettingsListEditor_SettingsListEditor_PendingInput,
  Web_SettingsListEditor_SettingsListEditor_Props,
  Web_SettingsListEditor_SettingsListEditor_Returns,
  Web_SettingsListEditor_SettingsListEditor_Rows,
  Web_SettingsListEditor_SettingsListEditor_RowsState,
  Web_SettingsListEditor_SettingsListEditor_SavedRows,
  Web_SettingsListEditor_SettingsListEditor_SavedRowsState,
  Web_SettingsListEditor_SettingsListEditor_SetRows,
  Web_SettingsListEditor_SettingsListEditor_SetSavedRows,
  Web_SettingsListEditor_SettingsListEditor_SettingKey,
  Web_SettingsListEditor_SettingsListEditor_SourceStatus,
  Web_SettingsListEditor_SettingsListEditor_SourceStatusID,
  Web_SettingsListEditor_SettingsListEditor_Title,
  Web_SettingsListEditor_SettingsListEditor_UpdateRows,
  Web_SettingsListEditor_SettingsListEditor_UpdateRows_NextRows,
  Web_SettingsListEditor_SettingsListEditor_UpdateRows_NextSavedRows,
  Web_SettingsListEditor_SettingsListEditor_UpdateRows_Returns,
  Web_SettingsListEditor_SettingsListEditor_Values,
  Web_SettingsListEditor_SettingsListEditor_ValuesRef,
} from '@/types/web/settings-list-editor.d.ts';

/**
 * Settings List Editor - Settings List Editor.
 *
 * Keeps blank editing rows local while publishing only normalized values.
 * This lets Discard and accepted snapshots reset the editor without losing drafts.
 *
 * @param {Web_SettingsListEditor_SettingsListEditor_Props} props - Props.
 *
 * @returns {Web_SettingsListEditor_SettingsListEditor_Returns}
 *
 * @since 2.0.0
 */
export const SettingsListEditor = (props: Web_SettingsListEditor_SettingsListEditor_Props): Web_SettingsListEditor_SettingsListEditor_Returns => {
  const blocklistStatus: Web_SettingsListEditor_SettingsListEditor_BlocklistStatus = props['blocklistStatus'];
  const blocklistsEnabled: Web_SettingsListEditor_SettingsListEditor_BlocklistsEnabled = props['blocklistsEnabled'];
  const disabled: Web_SettingsListEditor_SettingsListEditor_Disabled = props['disabled'];
  const editorVersion: Web_SettingsListEditor_SettingsListEditor_EditorVersion = props['editorVersion'];
  const onChange: Web_SettingsListEditor_SettingsListEditor_OnChange = props['onChange'];
  const settingKey: Web_SettingsListEditor_SettingsListEditor_SettingKey = props['settingKey'];
  const title: Web_SettingsListEditor_SettingsListEditor_Title = props['title'];
  const values: Web_SettingsListEditor_SettingsListEditor_Values = props['values'];
  const rowsState: Web_SettingsListEditor_SettingsListEditor_RowsState = useState<Web_SettingsListEditor_SettingsListEditor_Rows>(values);
  const rows: Web_SettingsListEditor_SettingsListEditor_Rows = rowsState[0];
  const setRows: Web_SettingsListEditor_SettingsListEditor_SetRows = rowsState[1];
  const savedRowsState: Web_SettingsListEditor_SettingsListEditor_SavedRowsState = useState<Web_SettingsListEditor_SettingsListEditor_SavedRows>(values);
  const savedRows: Web_SettingsListEditor_SettingsListEditor_SavedRows = savedRowsState[0];
  const setSavedRows: Web_SettingsListEditor_SettingsListEditor_SetSavedRows = savedRowsState[1];
  const valuesRef: Web_SettingsListEditor_SettingsListEditor_ValuesRef = useRef<Web_SettingsListEditor_SettingsListEditor_Values>(values);
  const inputRefs: Web_SettingsListEditor_SettingsListEditor_InputRefs = useRef<Web_SettingsListEditor_SettingsListEditor_InputElements>([]);
  const pendingFocusIndexRef: Web_SettingsListEditor_SettingsListEditor_PendingFocusIndexRef = useRef<Web_SettingsListEditor_SettingsListEditor_FocusIndex>(null);
  const blocklist: Web_SettingsListEditor_SettingsListEditor_Blocklist = settingKey === 'transmission.blocklistSources';
  const atLimit: Web_SettingsListEditor_SettingsListEditor_AtLimit = blocklist && rows.length >= 20;
  const emptyState: Web_SettingsListEditor_SettingsListEditor_EmptyState = getSettingListEmptyState(settingKey);

  valuesRef.current = values;

  useEffect(() => {
    setRows(valuesRef.current);
    setSavedRows(valuesRef.current);
    pendingFocusIndexRef.current = null;

    return;
  }, [editorVersion]);

  useEffect(() => {
    const pendingFocusIndex: Web_SettingsListEditor_SettingsListEditor_PendingFocusIndex = pendingFocusIndexRef.current;
    if (pendingFocusIndex !== null) {
      const pendingInput: Web_SettingsListEditor_SettingsListEditor_PendingInput = inputRefs.current[pendingFocusIndex];

      if (pendingInput !== undefined && pendingInput !== null) {
        pendingInput.focus();
      }

      pendingFocusIndexRef.current = null;
    }

    return;
  }, [rows]);

  /**
   * Settings List Editor - Update Rows.
   *
   * Stores exact editor text locally before normalizing the Settings draft.
   * Empty and whitespace-only rows therefore remain visible without being saved.
   *
   * @param {Web_SettingsListEditor_SettingsListEditor_UpdateRows_NextRows}      nextRows        - Next rows.
   * @param {Web_SettingsListEditor_SettingsListEditor_UpdateRows_NextSavedRows} [nextSavedRows] - Next saved rows.
   *
   * @returns {Web_SettingsListEditor_SettingsListEditor_UpdateRows_Returns}
   *
   * @since 2.0.0
   */
  const updateRows: Web_SettingsListEditor_SettingsListEditor_UpdateRows = (nextRows: Web_SettingsListEditor_SettingsListEditor_UpdateRows_NextRows, nextSavedRows: Web_SettingsListEditor_SettingsListEditor_UpdateRows_NextSavedRows = savedRows): Web_SettingsListEditor_SettingsListEditor_UpdateRows_Returns => {
    setRows(nextRows);
    setSavedRows(nextSavedRows);
    onChange(normalizeSettingListValues(nextRows));

    return;
  };

  return (
    <div className="settings-list-editor">
      <div className="settings-list-box">
        <div className="settings-list-body">
          {(rows.length === 0) ? (
            <div className="settings-list-empty-state">
              <strong>{emptyState['title']}</strong>
              {(emptyState['hint'] === null) ? null : <span>{emptyState['hint']}</span>}
            </div>
          ) : rows.map((value, index) => {
            const invalid: Web_SettingsListEditor_SettingsListEditor_Invalid = (
              blocklist === true
              && value.trim() !== ''
              && (
                value.startsWith('https://') === false
                || value.includes('@') === true
              )
            );
            const sourceStatus: Web_SettingsListEditor_SettingsListEditor_SourceStatus = (
              blocklist === true
              && blocklistStatus !== null
              && savedRows[index] === value
            ) ? formatBlocklistSourceLine(blocklistStatus, value, blocklistsEnabled) : null;
            const sourceStatusID: Web_SettingsListEditor_SettingsListEditor_SourceStatusID = `blocklist-source-${index + 1}-status`;

            return (
              <div className="settings-list-item" key={index}>
                <div className="settings-list-row">
                  <input
                    aria-describedby={(sourceStatus === null) ? undefined : sourceStatusID}
                    aria-invalid={invalid}
                    aria-label={`${title} ${index + 1}`}
                    autoComplete={(blocklist === true) ? 'off' : undefined}
                    className="setting-input"
                    disabled={disabled}
                    inputMode={(blocklist === true) ? 'url' : undefined}
                    onChange={(event) => {
                      const nextRows: Web_SettingsListEditor_SettingsListEditor_NextRows = [...rows];

                      Reflect.set(nextRows, index, event.currentTarget.value);

                      updateRows(nextRows);

                      return;
                    }}
                    placeholder={(blocklist === true) ? 'e.g. https://example.com/blocklist.gz' : undefined}
                    ref={(input) => {
                      Reflect.set(inputRefs.current, index, input);

                      return;
                    }}
                    spellCheck={(blocklist === true) ? false : undefined}
                    type={(blocklist === true) ? 'url' : 'text'}
                    value={value}
                  />
                  <button
                    aria-label={`Remove source ${index + 1}`}
                    className="icon-button settings-list-remove"
                    disabled={disabled}
                    onClick={() => {
                      updateRows(
                        rows.filter((_row, rowIndex) => rowIndex !== index),
                        savedRows.filter((_saved, rowIndex) => rowIndex !== index),
                      );

                      return;
                    }}
                    type="button"
                  >
                    <Icon name="remove" size={16} />
                  </button>
                </div>
                {(invalid === true) ? <small className="field-error">Use an https:// address without a username or password.</small> : null}
                {(sourceStatus === null) ? null : (
                  <small className={`source-status source-status-${sourceStatus['tone']}`} id={sourceStatusID}>
                    {sourceStatus['text']}
                  </small>
                )}
              </div>
            );
          })}
        </div>
        <div className="settings-list-footer">
          <Button
            disabled={disabled || atLimit}
            icon="add"
            onClick={() => {
              pendingFocusIndexRef.current = rows.length;
              updateRows([
                ...rows,
                '',
              ], [
                ...savedRows,
                null,
              ]);

              return;
            }}
          >
            Add source
          </Button>
          {(blocklist === true) ? <small className="settings-list-hint">Up to 20 sources.</small> : null}
        </div>
      </div>
    </div>
  );
};
