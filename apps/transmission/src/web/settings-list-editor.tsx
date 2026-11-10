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

import type { ReactElement } from 'react';

import type { Web_BlocklistStatus_SourceLine } from '@/types/web/blocklist-status.d.ts';
import type { Web_Components_SettingsListEditor_Props } from '@/types/web/components.d.ts';
import type { Web_SettingsListEditor_GetSettingListEmptyState_Returns } from '@/types/web/settings-list-editor.d.ts';

/**
 * Settings List Editor.
 *
 * Keeps blank editing rows local while publishing only normalized values.
 * This lets Discard and accepted snapshots reset the editor without losing drafts.
 *
 * @since 2.0.0
 */
export const SettingsListEditor = ({
  blocklistStatus,
  blocklistsEnabled,
  disabled,
  editorVersion,
  onChange,
  settingKey,
  title,
  values,
}: Web_Components_SettingsListEditor_Props): ReactElement => {
  const [
    rows,
    setRows,
  ] = useState<string[]>(values);
  const [
    savedRows,
    setSavedRows,
  ] = useState<Array<string | null>>(values);
  const valuesRef = useRef<string[]>(values);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const pendingFocusIndexRef = useRef<number | null>(null);
  const blocklist: boolean = settingKey === 'transmission.blocklistSources';
  const atLimit: boolean = blocklist && rows.length >= 20;
  const emptyState: Web_SettingsListEditor_GetSettingListEmptyState_Returns = getSettingListEmptyState(settingKey);

  valuesRef.current = values;

  useEffect((): void => {
    setRows(valuesRef.current);
    setSavedRows(valuesRef.current);
    pendingFocusIndexRef.current = null;
  }, [editorVersion]);

  useEffect((): void => {
    const pendingFocusIndex: number | null = pendingFocusIndexRef.current;
    if (pendingFocusIndex !== null) {
      inputRefs.current[pendingFocusIndex]?.focus();
      pendingFocusIndexRef.current = null;
    }
  }, [rows]);

  /**
   * Settings List Editor - Update rows.
   *
   * Stores exact editor text locally before normalizing the Settings draft.
   * Empty and whitespace-only rows therefore remain visible without being saved.
   *
   * @since 2.0.0
   */
  const updateRows = (nextRows: string[], nextSavedRows: Array<string | null> = savedRows): void => {
    setRows(nextRows);
    setSavedRows(nextSavedRows);
    onChange(normalizeSettingListValues(nextRows));
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
          ) : rows.map((value: string, index: number): ReactElement => {
            const invalid: boolean = blocklist && value.trim() !== '' && (
              !value.startsWith('https://')
              || value.includes('@')
            );
            const sourceStatus: Web_BlocklistStatus_SourceLine | null = (
              blocklist
              && blocklistStatus !== null
              && savedRows[index] === value
            ) ? formatBlocklistSourceLine(blocklistStatus, value, blocklistsEnabled) : null;
            const sourceStatusID: string = `blocklist-source-${index + 1}-status`;

            return (
              <div className="settings-list-item" key={index}>
                <div className="settings-list-row">
                  <input
                    aria-describedby={(sourceStatus === null) ? undefined : sourceStatusID}
                    aria-invalid={invalid}
                    aria-label={`${title} ${index + 1}`}
                    autoComplete={(blocklist) ? 'off' : undefined}
                    className="setting-input"
                    disabled={disabled}
                    inputMode={(blocklist) ? 'url' : undefined}
                    onChange={(event): void => {
                      const nextRows: string[] = [...rows];
                      nextRows[index] = event.currentTarget.value;
                      updateRows(nextRows);
                    }}
                    placeholder={(blocklist) ? 'e.g. https://example.com/blocklist.gz' : undefined}
                    ref={(input: HTMLInputElement | null): void => {
                      inputRefs.current[index] = input;
                    }}
                    spellCheck={(blocklist) ? false : undefined}
                    type={(blocklist) ? 'url' : 'text'}
                    value={value}
                  />
                  <button
                    aria-label={`Remove source ${index + 1}`}
                    className="icon-button settings-list-remove"
                    disabled={disabled}
                    onClick={(): void => updateRows(
                      rows.filter((_row: string, rowIndex: number): boolean => rowIndex !== index),
                      savedRows.filter((_saved: string | null, rowIndex: number): boolean => rowIndex !== index),
                    )}
                    type="button"
                  >
                    <Icon name="remove" size={16} />
                  </button>
                </div>
                {(invalid) ? <small className="field-error">Use an https:// address without a username or password.</small> : null}
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
            onClick={(): void => {
              pendingFocusIndexRef.current = rows.length;
              updateRows([
                ...rows,
                '',
              ], [
                ...savedRows,
                null,
              ]);
            }}
          >
            Add source
          </Button>
          {(blocklist) ? <small className="settings-list-hint">Up to 20 sources.</small> : null}
        </div>
      </div>
    </div>
  );
};
