import type { Web_Api_Schema } from '@/types/web/api.d.ts';
import type { Web_Backup_Document } from '@/types/web/backup.d.ts';

/**
 * Backup Format.
 *
 * @since 2.4.1
 */
export type Web_BackupFormat_BackupDocumentSchema = Web_Api_Schema<Web_Backup_Document>;

/**
 * Backup Format.
 *
 * @since 2.4.1
 */
export type Web_BackupFormat_ParseBackupDocument_Value = unknown;
export type Web_BackupFormat_ParseBackupDocument_Returns = Web_Backup_Document;
