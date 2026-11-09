import {
  Button,
  Icon,
} from '@/web/primitives.tsx';

import type { ReactElement } from 'react';

import type {
  Web_BackupComponents_ImportProgress_Props,
  Web_BackupComponents_ImportProgressItem,
} from '@/types/web/backup-components.d.ts';

/**
 * Backup Import Progress.
 *
 * Renders persisted item progress and every final outcome.
 * Offers the same background and completion actions after a page reload.
 *
 * @since UNRELEASED
 */
export const BackupImportProgress = ({
  applyingLabel,
  contextColumn,
  headingSummary,
  itemColumn,
  job,
  onBackground,
  onDone,
  progressLabel,
  remainingLabel,
}: Web_BackupComponents_ImportProgress_Props): ReactElement => {
  const total: number = job['total'];
  const complete: number = job['completed'];
  const terminal: boolean = job['status'] === 'completed' || job['status'] === 'failed';
  let fraction: number = complete / total;
  if (total === 0) {
    fraction = (job['status'] === 'completed') ? 1 : 0;
  }
  let heading: string = 'Importing';
  if (job['status'] === 'failed') {
    heading = 'Import stopped';
  } else if (terminal) {
    heading = 'Import complete';
  }

  return (
    <div className="backup-import-progress">
      <div className="backup-import-progress-heading">
        <span className={(terminal) ? 'backup-progress-icon is-done' : 'backup-progress-icon'}>
          {(terminal) ? <Icon name="check" size={20} /> : <span className="spinner" />}
        </span>
        <div>
          <h3>{heading}</h3>
          <p>{(total === 0) ? applyingLabel : progressLabel(complete, total)}</p>
          {(headingSummary === undefined) ? null : <small>{headingSummary}</small>}
        </div>
      </div>
      {(remainingLabel === undefined || terminal) ? null : <p className="backup-progress-remaining">{remainingLabel}</p>}
      <div
        aria-label={`${Math.round(fraction * 100)}% complete`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(fraction * 100)}
        className="backup-progress-bar"
        role="progressbar"
      >
        <span style={{ width: `${Math.round(fraction * 100)}%` }} />
      </div>
      {(job['error'] === '') ? null : <div className="form-error" role="alert">{job['error']}</div>}
      {(job['items'].length === 0) ? null : (
        <div className="backup-progress-table-wrap">
          <table className="backup-progress-table">
            <thead>
              <tr>
                <th>{itemColumn}</th>
                <th>{contextColumn}</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {job['items'].map((item: Web_BackupComponents_ImportProgressItem): ReactElement => (
                <tr key={item['id']}>
                  <td data-label={itemColumn}>{item['name']}</td>
                  <td data-label={contextColumn}>{item['context']}</td>
                  <td data-label="Status">
                    <span className={`backup-state backup-state-${item['tone']}`}>{item['status']}</span>
                    {(item['detail'] === undefined) ? null : <small className="backup-state-detail">{item['detail']}</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="dialog-actions">
        {(terminal) ? null : <Button onClick={onBackground}>Keep importing in the background</Button>}
        <Button disabled={!terminal} onClick={onDone} variant="primary">Done</Button>
      </div>
    </div>
  );
};
