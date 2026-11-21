import { Button } from '@/web/primitives.tsx';

import type {
  Web_BackupSection_BackupSection_Description,
  Web_BackupSection_BackupSection_ImportJob,
  Web_BackupSection_BackupSection_OnExport,
  Web_BackupSection_BackupSection_OnImport,
  Web_BackupSection_BackupSection_OnOpenImport,
  Web_BackupSection_BackupSection_Props,
  Web_BackupSection_BackupSection_Returns,
  Web_BackupSection_BackupSection_RowLabel,
  Web_BackupSection_BackupSection_Title,
} from '@/types/web/backup-section.d.ts';

/**
 * Backup Section - Backup Section.
 *
 * Presents the portable export/import actions and reopens durable background work.
 * Its panel remains outside the Settings save bar because each action is immediate.
 *
 * @param {Web_BackupSection_BackupSection_Props} props - Props.
 *
 * @returns {Web_BackupSection_BackupSection_Returns}
 *
 * @since 2.0.0
 */
export const BackupSection = (props: Web_BackupSection_BackupSection_Props): Web_BackupSection_BackupSection_Returns => {
  const description: Web_BackupSection_BackupSection_Description = props['description'];
  const importJob: Web_BackupSection_BackupSection_ImportJob = props['importJob'];
  const onExport: Web_BackupSection_BackupSection_OnExport = props['onExport'];
  const onImport: Web_BackupSection_BackupSection_OnImport = props['onImport'];
  const onOpenImport: Web_BackupSection_BackupSection_OnOpenImport = props['onOpenImport'];
  const rowLabel: Web_BackupSection_BackupSection_RowLabel = props['rowLabel'];
  const title: Web_BackupSection_BackupSection_Title = props['title'];

  return (
    <div className="panel backup-section">
      <h2>{title}</h2>
      <div className="setting-list">
        <div className="setting-row backup-setting-row">
          <div className="setting-copy backup-section-copy">
            <div className="setting-title"><span>{rowLabel}</span></div>
            <p>{description}</p>
            {(importJob === null) ? null : (
              <button className="backup-running" onClick={onOpenImport} type="button">
                <span>
                  <strong>{importJob['title']}</strong>
                  <small>{importJob['detail']}</small>
                </span>
                <span aria-hidden="true" className="backup-running-meter">
                  <span style={{ width: `${Math.round(importJob['progress'] * 100)}%` }} />
                </span>
              </button>
            )}
          </div>
          <div className="setting-control backup-section-actions">
            <Button icon="download" onClick={onExport}>Export…</Button>
            <Button icon="upload" onClick={onImport}>Import…</Button>
          </div>
        </div>
      </div>
    </div>
  );
};
