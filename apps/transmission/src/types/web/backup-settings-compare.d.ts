import type { ReactElement } from 'react';

import type {
  Web_BackupComponents_SettingsCompare_Props,
  Web_BackupComponents_SettingsCompareExcludedItem,
} from '@/types/web/backup-components.d.ts';

/**
 * Backup Settings Compare.
 *
 * @since 2.4.1
 */
export type Web_BackupSettingsCompare_BackupSettingsCompare_Props = Web_BackupComponents_SettingsCompare_Props;
export type Web_BackupSettingsCompare_BackupSettingsCompare_Returns = ReactElement;
export type Web_BackupSettingsCompare_BackupSettingsCompare_AttentionItem = Web_BackupComponents_SettingsCompareExcludedItem;
export type Web_BackupSettingsCompare_BackupSettingsCompare_AttentionItems = Web_BackupSettingsCompare_BackupSettingsCompare_AttentionItem[];
export type Web_BackupSettingsCompare_BackupSettingsCompare_Description = Web_BackupComponents_SettingsCompare_Props['description'];
export type Web_BackupSettingsCompare_BackupSettingsCompare_EmptyMessage = string;
export type Web_BackupSettingsCompare_BackupSettingsCompare_ExcludedItems = Web_BackupComponents_SettingsCompare_Props['excludedItems'];
export type Web_BackupSettingsCompare_BackupSettingsCompare_FileColumn = Web_BackupComponents_SettingsCompare_Props['fileColumn'];
export type Web_BackupSettingsCompare_BackupSettingsCompare_Rows = Web_BackupComponents_SettingsCompare_Props['rows'];
