import { Icon } from '@/web/primitives.tsx';

import type { ReactElement } from 'react';

import type { Web_BackupComponents_FileSource_Props } from '@/types/web/backup-components.d.ts';

/**
 * Backup File Source.
 *
 * Presents the common selected radio card, file button, and chosen filename.
 * App-specific copy and parsing stay with the backup view that supplies it.
 *
 * @since UNRELEASED
 */
export const BackupFileSource = ({
  busy,
  description,
  fileName,
  label,
  name,
  onFileChange,
  onSelect,
  selected,
}: Web_BackupComponents_FileSource_Props): ReactElement => (
  <label className={`backup-source-card${(selected) ? ' is-selected' : ''}`}>
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
