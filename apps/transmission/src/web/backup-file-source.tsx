import { Icon } from '@/web/primitives.tsx';

import type {
  Web_BackupFileSource_BackupFileSource_Busy,
  Web_BackupFileSource_BackupFileSource_Description,
  Web_BackupFileSource_BackupFileSource_FileName,
  Web_BackupFileSource_BackupFileSource_Label,
  Web_BackupFileSource_BackupFileSource_Name,
  Web_BackupFileSource_BackupFileSource_OnFileChange,
  Web_BackupFileSource_BackupFileSource_OnSelect,
  Web_BackupFileSource_BackupFileSource_Props,
  Web_BackupFileSource_BackupFileSource_Returns,
  Web_BackupFileSource_BackupFileSource_Selected,
  Web_BackupFileSource_BackupFileSource_SelectedClassName,
} from '@/types/web/backup-file-source.d.ts';

/**
 * Backup File Source - Backup File Source.
 *
 * Presents the common selected radio card, file button, and chosen filename.
 * App-specific copy and parsing stay with the backup view that supplies it.
 *
 * @param {Web_BackupFileSource_BackupFileSource_Props} props - Props.
 *
 * @returns {Web_BackupFileSource_BackupFileSource_Returns}
 *
 * @since 2.0.0
 */
export const BackupFileSource = (props: Web_BackupFileSource_BackupFileSource_Props): Web_BackupFileSource_BackupFileSource_Returns => {
  const busy: Web_BackupFileSource_BackupFileSource_Busy = props['busy'];
  const description: Web_BackupFileSource_BackupFileSource_Description = props['description'];
  const fileName: Web_BackupFileSource_BackupFileSource_FileName = props['fileName'];
  const label: Web_BackupFileSource_BackupFileSource_Label = props['label'];
  const name: Web_BackupFileSource_BackupFileSource_Name = props['name'];
  const onFileChange: Web_BackupFileSource_BackupFileSource_OnFileChange = props['onFileChange'];
  const onSelect: Web_BackupFileSource_BackupFileSource_OnSelect = props['onSelect'];
  const selected: Web_BackupFileSource_BackupFileSource_Selected = props['selected'];
  const selectedClassName: Web_BackupFileSource_BackupFileSource_SelectedClassName = (selected === true) ? ' is-selected' : '';

  return (
    <label className={`backup-source-card${selectedClassName}`}>
      <input
        aria-label={label}
        checked={selected}
        className="backup-source-radio"
        disabled={busy}
        name={name}
        onChange={onSelect}
        type="radio"
      />
      <span className="backup-source-card-heading">
        <Icon name="upload" size={22} />
        <span>
          <strong>{label}</strong>
          <p>{description}</p>
        </span>
      </span>
      <span className="backup-file-control">
        <span className="button button-secondary">
          <Icon name="folder" size={16} />
          <span>Choose file…</span>
          <input
            accept="application/json,.json"
            className="visually-hidden"
            disabled={busy}
            onChange={onFileChange}
            type="file"
          />
        </span>
        <span className={(fileName === '') ? 'backup-file-name is-empty' : 'backup-file-name'}>
          {(fileName === '') ? 'No file chosen' : fileName}
        </span>
      </span>
    </label>
  );
};
