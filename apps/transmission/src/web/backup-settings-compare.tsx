import type {
  Web_BackupSettingsCompare_BackupSettingsCompare_AttentionItems,
  Web_BackupSettingsCompare_BackupSettingsCompare_Description,
  Web_BackupSettingsCompare_BackupSettingsCompare_EmptyMessage,
  Web_BackupSettingsCompare_BackupSettingsCompare_ExcludedItems,
  Web_BackupSettingsCompare_BackupSettingsCompare_FileColumn,
  Web_BackupSettingsCompare_BackupSettingsCompare_Props,
  Web_BackupSettingsCompare_BackupSettingsCompare_Returns,
  Web_BackupSettingsCompare_BackupSettingsCompare_Rows,
} from '@/types/web/backup-settings-compare.d.ts';

/**
 * Backup Settings Compare - Backup Settings Compare.
 *
 * Renders the shared Setting, In the file, and Here comparison treatment.
 * Imported items that need a fix, then values left out, are listed below it with
 * their reasons.
 *
 * @param {Web_BackupSettingsCompare_BackupSettingsCompare_Props} props - Props.
 *
 * @returns {Web_BackupSettingsCompare_BackupSettingsCompare_Returns}
 *
 * @since 2.0.0
 */
export const BackupSettingsCompare = (props: Web_BackupSettingsCompare_BackupSettingsCompare_Props): Web_BackupSettingsCompare_BackupSettingsCompare_Returns => {
  const attentionItems: Web_BackupSettingsCompare_BackupSettingsCompare_AttentionItems = props['attentionItems'] ?? [];
  const description: Web_BackupSettingsCompare_BackupSettingsCompare_Description = props['description'];
  const emptyMessage: Web_BackupSettingsCompare_BackupSettingsCompare_EmptyMessage = props['emptyMessage'] ?? 'Nothing from this file will replace settings here.';
  const excludedItems: Web_BackupSettingsCompare_BackupSettingsCompare_ExcludedItems = props['excludedItems'];
  const fileColumn: Web_BackupSettingsCompare_BackupSettingsCompare_FileColumn = props['fileColumn'];
  const rows: Web_BackupSettingsCompare_BackupSettingsCompare_Rows = props['rows'];

  return (
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
              {rows.map((row) => (
                <tr className={(row['changed'] === true) ? 'is-different' : ''} key={row['id']}>
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
            {attentionItems.map((item) => (
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
            {excludedItems.map((item) => (
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
};
