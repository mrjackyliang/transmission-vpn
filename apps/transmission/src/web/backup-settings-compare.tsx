import type { ReactElement } from 'react';

import type {
  Web_BackupComponents_SettingsCompare_Props,
  Web_BackupComponents_SettingsCompareExcludedItem,
  Web_BackupComponents_SettingsCompareRow,
} from '@/types/web/backup-components.d.ts';

/**
 * Backup Settings Compare.
 *
 * Renders the shared Setting, In the file, and Here comparison treatment.
 * Imported items that need a fix, then values left out, are listed below it with
 * their reasons.
 *
 * @since UNRELEASED
 */
export const BackupSettingsCompare = ({
  attentionItems = [],
  description,
  emptyMessage = 'Nothing from this file will replace settings here.',
  excludedItems,
  fileColumn,
  rows,
}: Web_BackupComponents_SettingsCompare_Props): ReactElement => (
  <div className="dialog-body backup-step-body">
    <div>
      <h3>Settings</h3>
      <p className="dialog-message">{description}</p>
    </div>
    {(rows.length === 0) ? <div className="backup-empty-section">{emptyMessage}</div> : (
      <div className="backup-progress-table-wrap backup-compare-table-wrap">
        <table className="backup-compare-table backup-settings-table">
          <thead>
            <tr>
              <th>Setting</th>
              <th>{fileColumn}</th>
              <th>Here</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row: Web_BackupComponents_SettingsCompareRow): ReactElement => (
              <tr className={(row['changed']) ? 'is-different' : ''} key={row['id']}>
                <td data-label="Setting"><strong>{row['label']}</strong></td>
                <td data-label={fileColumn}>{row['fileValue']}</td>
                <td data-label="Here">{row['hereValue']}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
    {(attentionItems.length === 0) ? null : (
      <details className="backup-not-brought-over backup-needs-attention">
        <summary>{`Needs attention after import (${attentionItems.length})`}</summary>
        <div>
          {attentionItems.map((item: Web_BackupComponents_SettingsCompareExcludedItem): ReactElement => (
            <p key={item['id']}>
              <strong>{item['label']}</strong>
              <span>{item['reason']}</span>
            </p>
          ))}
        </div>
      </details>
    )}
    {(excludedItems.length === 0) ? null : (
      <details className="backup-not-brought-over">
        <summary>{`Not brought over (${excludedItems.length})`}</summary>
        <div>
          {excludedItems.map((item: Web_BackupComponents_SettingsCompareExcludedItem): ReactElement => (
            <p key={item['id']}>
              <strong>{item['label']}</strong>
              <span>{item['reason']}</span>
            </p>
          ))}
        </div>
      </details>
    )}
  </div>
);
