import { Icon } from '@/web/primitives.tsx';

import type { ReactElement } from 'react';

import type {
  Web_BackupComponents_ReviewItem,
  Web_BackupComponents_ReviewList_Props,
  Web_BackupComponents_ReviewNote,
} from '@/types/web/backup-components.d.ts';

/**
 * Backup Review List.
 *
 * Presents only the changes that will happen and keeps contextual notes separate.
 * Every app supplies complete human sentences without zero-count fragments.
 *
 * @since UNRELEASED
 */
export const BackupReviewList = ({
  error = '',
  items,
  notes,
}: Web_BackupComponents_ReviewList_Props): ReactElement => (
  <div className="backup-review">
    <div>
      <h3>Ready to import</h3>
      <p className="dialog-message">Nothing changes until you confirm.</p>
    </div>
    <ul className="backup-review-list">
      {items.map((item: Web_BackupComponents_ReviewItem): ReactElement => (
        <li key={item['id']}>
          <Icon name="check" size={18} />
          <span>{item['text']}</span>
        </li>
      ))}
    </ul>
    {notes.map((note: Web_BackupComponents_ReviewNote): ReactElement => (
      <div className="backup-review-note" key={note['id']}>
        <Icon name={note['icon']} size={18} />
        <span>{note['text']}</span>
      </div>
    ))}
    {(error === '') ? null : <div className="form-error" role="alert">{error}</div>}
  </div>
);
