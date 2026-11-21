import {
  Button,
  Icon,
} from '@/web/primitives.tsx';

import type {
  Web_BackupImportProgress_BackupImportProgress_ApplyingLabel,
  Web_BackupImportProgress_BackupImportProgress_Complete,
  Web_BackupImportProgress_BackupImportProgress_ContextColumn,
  Web_BackupImportProgress_BackupImportProgress_Fraction,
  Web_BackupImportProgress_BackupImportProgress_Heading,
  Web_BackupImportProgress_BackupImportProgress_HeadingSummary,
  Web_BackupImportProgress_BackupImportProgress_ItemColumn,
  Web_BackupImportProgress_BackupImportProgress_Job,
  Web_BackupImportProgress_BackupImportProgress_OnBackground,
  Web_BackupImportProgress_BackupImportProgress_OnDone,
  Web_BackupImportProgress_BackupImportProgress_ProgressLabel,
  Web_BackupImportProgress_BackupImportProgress_Props,
  Web_BackupImportProgress_BackupImportProgress_RemainingLabel,
  Web_BackupImportProgress_BackupImportProgress_Returns,
  Web_BackupImportProgress_BackupImportProgress_Terminal,
  Web_BackupImportProgress_BackupImportProgress_Total,
} from '@/types/web/backup-import-progress.d.ts';

/**
 * Backup Import Progress - Backup Import Progress.
 *
 * Renders persisted item progress and every final outcome.
 * Offers the same background and completion actions after a page reload.
 *
 * @param {Web_BackupImportProgress_BackupImportProgress_Props} props - Props.
 *
 * @returns {Web_BackupImportProgress_BackupImportProgress_Returns}
 *
 * @since 2.0.0
 */
export const BackupImportProgress = (props: Web_BackupImportProgress_BackupImportProgress_Props): Web_BackupImportProgress_BackupImportProgress_Returns => {
  const applyingLabel: Web_BackupImportProgress_BackupImportProgress_ApplyingLabel = props['applyingLabel'];
  const contextColumn: Web_BackupImportProgress_BackupImportProgress_ContextColumn = props['contextColumn'];
  const headingSummary: Web_BackupImportProgress_BackupImportProgress_HeadingSummary = props['headingSummary'];
  const itemColumn: Web_BackupImportProgress_BackupImportProgress_ItemColumn = props['itemColumn'];
  const job: Web_BackupImportProgress_BackupImportProgress_Job = props['job'];
  const onBackground: Web_BackupImportProgress_BackupImportProgress_OnBackground = props['onBackground'];
  const onDone: Web_BackupImportProgress_BackupImportProgress_OnDone = props['onDone'];
  const progressLabel: Web_BackupImportProgress_BackupImportProgress_ProgressLabel = props['progressLabel'];
  const remainingLabel: Web_BackupImportProgress_BackupImportProgress_RemainingLabel = props['remainingLabel'];
  const total: Web_BackupImportProgress_BackupImportProgress_Total = job['total'];
  const complete: Web_BackupImportProgress_BackupImportProgress_Complete = job['completed'];
  const terminal: Web_BackupImportProgress_BackupImportProgress_Terminal = job['status'] === 'completed' || job['status'] === 'failed';
  let fraction: Web_BackupImportProgress_BackupImportProgress_Fraction = complete / total;

  if (total === 0) {
    fraction = (job['status'] === 'completed') ? 1 : 0;
  }

  let heading: Web_BackupImportProgress_BackupImportProgress_Heading = 'Importing';

  if (job['status'] === 'failed') {
    heading = 'Import stopped';
  } else if (terminal === true) {
    heading = 'Import complete';
  }

  return (
    <div className="backup-import-progress">
      <div className="backup-import-progress-heading">
        <span className={(terminal === true) ? 'backup-progress-icon is-done' : 'backup-progress-icon'}>
          {(terminal === true) ? <Icon name="check" size={20} /> : <span className="spinner" />}
        </span>
        <div>
          <h3>{heading}</h3>
          <p>{(total === 0) ? applyingLabel : progressLabel(complete, total)}</p>
          {(headingSummary === undefined) ? null : <small>{headingSummary}</small>}
        </div>
      </div>
      {(remainingLabel === undefined || terminal === true) ? null : <p className="backup-progress-remaining">{remainingLabel}</p>}
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
              {job['items'].map((item) => (
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
        {(terminal === true) ? null : <Button onClick={onBackground}>Keep importing in the background</Button>}
        <Button disabled={terminal === false} onClick={onDone} variant="primary">Done</Button>
      </div>
    </div>
  );
};
