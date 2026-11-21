import { Icon } from '@/web/primitives.tsx';

import type {
  Web_BackupReviewList_BackupReviewList_Error,
  Web_BackupReviewList_BackupReviewList_Items,
  Web_BackupReviewList_BackupReviewList_Notes,
  Web_BackupReviewList_BackupReviewList_Props,
  Web_BackupReviewList_BackupReviewList_Returns,
} from '@/types/web/backup-review-list.d.ts';

/**
 * Backup Review List - Backup Review List.
 *
 * Presents only the changes that will happen and keeps contextual notes separate.
 * Every app supplies complete human sentences without zero-count fragments.
 *
 * @param {Web_BackupReviewList_BackupReviewList_Props} props - Props.
 *
 * @returns {Web_BackupReviewList_BackupReviewList_Returns}
 *
 * @since 2.0.0
 */
export const BackupReviewList = (props: Web_BackupReviewList_BackupReviewList_Props): Web_BackupReviewList_BackupReviewList_Returns => {
  const error: Web_BackupReviewList_BackupReviewList_Error = props['error'] ?? '';
  const items: Web_BackupReviewList_BackupReviewList_Items = props['items'];
  const notes: Web_BackupReviewList_BackupReviewList_Notes = props['notes'];

  return (
    <div className="backup-review">
      <div>
        <h3>Ready to import</h3>
        <p className="dialog-message">Nothing changes until you confirm.</p>
      </div>
      <ul className="backup-review-list">
        {items.map((item) => (
          <li key={item['id']}>
            <Icon name="check" size={18} />
            <span>{item['text']}</span>
          </li>
        ))}
      </ul>
      {notes.map((note) => (
        <div className="backup-review-note" key={note['id']}>
          <Icon name={note['icon']} size={18} />
          <span>{note['text']}</span>
        </div>
      ))}
      {(error === '') ? null : <div className="form-error" role="alert">{error}</div>}
    </div>
  );
};
