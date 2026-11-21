import type {
  Dispatch,
  ReactElement,
  RefObject,
  SetStateAction,
} from 'react';

import type {
  Web_BackupComponents_ExportDialog_Props,
  Web_BackupComponents_ExportSelection,
} from '@/types/web/backup-components.d.ts';

/**
 * Backup Export Dialog.
 *
 * @since 2.4.1
 */
export type Web_BackupExportDialog_BackupExportDialog_Props = Web_BackupComponents_ExportDialog_Props;
export type Web_BackupExportDialog_BackupExportDialog_Returns = ReactElement | null;
export type Web_BackupExportDialog_BackupExportDialog_AuthenticatorEnabled = Web_BackupComponents_ExportDialog_Props['authenticatorEnabled'];
export type Web_BackupExportDialog_BackupExportDialog_Description = Web_BackupComponents_ExportDialog_Props['description'];
export type Web_BackupExportDialog_BackupExportDialog_OnClose = Web_BackupComponents_ExportDialog_Props['onClose'];
export type Web_BackupExportDialog_BackupExportDialog_OnConfirm = Web_BackupComponents_ExportDialog_Props['onConfirm'];
export type Web_BackupExportDialog_BackupExportDialog_OnExport = Web_BackupComponents_ExportDialog_Props['onExport'];
export type Web_BackupExportDialog_BackupExportDialog_OnPasskey = Web_BackupComponents_ExportDialog_Props['onPasskey'];
export type Web_BackupExportDialog_BackupExportDialog_Open = Web_BackupComponents_ExportDialog_Props['open'];
export type Web_BackupExportDialog_BackupExportDialog_Options = Web_BackupComponents_ExportDialog_Props['options'];
export type Web_BackupExportDialog_BackupExportDialog_PasskeyAvailable = Web_BackupComponents_ExportDialog_Props['passkeyAvailable'];
export type Web_BackupExportDialog_BackupExportDialog_SecretWarning = Web_BackupComponents_ExportDialog_Props['secretWarning'];
export type Web_BackupExportDialog_BackupExportDialog_Title = Web_BackupComponents_ExportDialog_Props['title'];
export type Web_BackupExportDialog_BackupExportDialog_Step = 'sections' | 'confirm';
export type Web_BackupExportDialog_BackupExportDialog_SetStep = Dispatch<SetStateAction<Web_BackupExportDialog_BackupExportDialog_Step>>;
export type Web_BackupExportDialog_BackupExportDialog_StepState = [Web_BackupExportDialog_BackupExportDialog_Step, Web_BackupExportDialog_BackupExportDialog_SetStep];
export type Web_BackupExportDialog_BackupExportDialog_Selection = Web_BackupComponents_ExportSelection;
export type Web_BackupExportDialog_BackupExportDialog_SetSelection = Dispatch<SetStateAction<Web_BackupExportDialog_BackupExportDialog_Selection>>;
export type Web_BackupExportDialog_BackupExportDialog_SelectionState = [Web_BackupExportDialog_BackupExportDialog_Selection, Web_BackupExportDialog_BackupExportDialog_SetSelection];
export type Web_BackupExportDialog_BackupExportDialog_ExportError = string;
export type Web_BackupExportDialog_BackupExportDialog_SetExportError = Dispatch<SetStateAction<Web_BackupExportDialog_BackupExportDialog_ExportError>>;
export type Web_BackupExportDialog_BackupExportDialog_ExportErrorState = [Web_BackupExportDialog_BackupExportDialog_ExportError, Web_BackupExportDialog_BackupExportDialog_SetExportError];
export type Web_BackupExportDialog_BackupExportDialog_TitleId = string;
export type Web_BackupExportDialog_BackupExportDialog_DialogRef = RefObject<HTMLElement | null>;
export type Web_BackupExportDialog_BackupExportDialog_SelectedCount = number;
export type Web_BackupExportDialog_BackupExportDialog_StepNumber = number;
export type Web_BackupExportDialog_BackupExportDialog_NextChecked = boolean;
