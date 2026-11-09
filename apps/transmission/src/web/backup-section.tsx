import { Button } from '@/web/primitives.tsx';

import type { ReactElement } from 'react';

import type { Web_BackupComponents_Section_Props } from '@/types/web/backup-components.d.ts';

/**
 * Backup Section.
 *
 * Presents the portable export/import actions and reopens durable background work.
 * Its panel remains outside the Settings save bar because each action is immediate.
 *
 * @since UNRELEASED
 */
export const BackupSection = ({
  description,
  importJob,
  onExport,
  onImport,
  onOpenImport,
  rowLabel,
  title,
}: Web_BackupComponents_Section_Props): ReactElement => {
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
