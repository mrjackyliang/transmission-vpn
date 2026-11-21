import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  confirmBackupOperation,
  confirmBackupOperationWithPasskey,
  createBackupImport,
  downloadBackupExport,
  getAccountSecurity,
  getBackupImport,
  getCurrentBackupImport,
  previewAnotherTransmissionImport,
  previewBackupImport,
} from '@/web/api.ts';
import { BackupExportDialog } from '@/web/backup-export-dialog.tsx';
import { BackupFileSource } from '@/web/backup-file-source.tsx';
import { parseBackupDocument } from '@/web/backup-format.ts';
import { BackupImportProgress } from '@/web/backup-import-progress.tsx';
import { BackupImportWizardShell } from '@/web/backup-import-wizard-shell.tsx';
import { BackupReviewList } from '@/web/backup-review-list.tsx';
import { BackupSection } from '@/web/backup-section.tsx';
import { BackupSettingsCompare } from '@/web/backup-settings-compare.tsx';
import { BackupSourceDirectoryDialog } from '@/web/backup-source-directory-dialog.tsx';
import { ConfirmIdentityStep } from '@/web/confirm-identity-step.tsx';
import { DirectoryBrowserDialog } from '@/web/directory-browser-dialog.tsx';
import {
  Button,
  Icon,
} from '@/web/primitives.tsx';
import { trailingSlashesPattern } from '@/web/regex.js';
import { showToast } from '@/web/toast.ts';

import type {
  Web_BackupView_BackupView_AccountSecurity,
  Web_BackupView_BackupView_AlreadyPresentCount,
  Web_BackupView_BackupView_AuthenticatorEnabled,
  Web_BackupView_BackupView_AvailableSteps,
  Web_BackupView_BackupView_Cancelled,
  Web_BackupView_BackupView_ChangedSettingCount,
  Web_BackupView_BackupView_ChoicesComplete,
  Web_BackupView_BackupView_ChooseFile,
  Web_BackupView_BackupView_ChooseFile_Event,
  Web_BackupView_BackupView_ChooseFile_File,
  Web_BackupView_BackupView_ChooseFile_Input,
  Web_BackupView_BackupView_ChooseFile_InputFiles,
  Web_BackupView_BackupView_ChooseFile_NextPreview,
  Web_BackupView_BackupView_ChooseFile_ParsedDocument,
  Web_BackupView_BackupView_ChooseFile_ParsedValue,
  Web_BackupView_BackupView_ChooseFile_Returns,
  Web_BackupView_BackupView_CloseWizard,
  Web_BackupView_BackupView_CloseWizard_Returns,
  Web_BackupView_BackupView_ConfigPath,
  Web_BackupView_BackupView_ConfigPathState,
  Web_BackupView_BackupView_CreateCount,
  Web_BackupView_BackupView_DataLabel,
  Web_BackupView_BackupView_DataMissingCount,
  Web_BackupView_BackupView_DataMissingNote,
  Web_BackupView_BackupView_Document,
  Web_BackupView_BackupView_DocumentRunningTorrentCount,
  Web_BackupView_BackupView_DocumentState,
  Web_BackupView_BackupView_DocumentTorrents,
  Web_BackupView_BackupView_Duration,
  Web_BackupView_BackupView_ElapsedSeconds,
  Web_BackupView_BackupView_ExportOpen,
  Web_BackupView_BackupView_ExportOpenState,
  Web_BackupView_BackupView_FileName,
  Web_BackupView_BackupView_FileNameState,
  Web_BackupView_BackupView_FolderMappings,
  Web_BackupView_BackupView_FolderMappingsState,
  Web_BackupView_BackupView_FolderPicker,
  Web_BackupView_BackupView_FolderPickerInitialPath,
  Web_BackupView_BackupView_FolderPickerPurpose,
  Web_BackupView_BackupView_FolderPickerState,
  Web_BackupView_BackupView_FoldersMapped,
  Web_BackupView_BackupView_ImportableSettings,
  Web_BackupView_BackupView_ImportJob,
  Web_BackupView_BackupView_ImportJobId,
  Web_BackupView_BackupView_ImportJobState,
  Web_BackupView_BackupView_ImportJobStatus,
  Web_BackupView_BackupView_ImportSource,
  Web_BackupView_BackupView_ImportSourceState,
  Web_BackupView_BackupView_Included,
  Web_BackupView_BackupView_IncludedProfiles,
  Web_BackupView_BackupView_IncompleteDirectory,
  Web_BackupView_BackupView_InitializePreviewChoices,
  Web_BackupView_BackupView_InitializePreviewChoices_Actions,
  Web_BackupView_BackupView_InitializePreviewChoices_Connections,
  Web_BackupView_BackupView_InitializePreviewChoices_Included,
  Web_BackupView_BackupView_InitializePreviewChoices_Names,
  Web_BackupView_BackupView_InitializePreviewChoices_NextPreview,
  Web_BackupView_BackupView_InitializePreviewChoices_Returns,
  Web_BackupView_BackupView_InspectAnotherTransmission,
  Web_BackupView_BackupView_InspectAnotherTransmission_InitializeChoices,
  Web_BackupView_BackupView_InspectAnotherTransmission_Mappings,
  Web_BackupView_BackupView_InspectAnotherTransmission_NextMappings,
  Web_BackupView_BackupView_InspectAnotherTransmission_NextPreview,
  Web_BackupView_BackupView_InspectAnotherTransmission_Path,
  Web_BackupView_BackupView_InspectAnotherTransmission_Returns,
  Web_BackupView_BackupView_KeepCount,
  Web_BackupView_BackupView_KeepVerb,
  Web_BackupView_BackupView_LoadSecurity,
  Web_BackupView_BackupView_Mapping,
  Web_BackupView_BackupView_MappingsComplete,
  Web_BackupView_BackupView_MappingTarget,
  Web_BackupView_BackupView_MergeActions,
  Web_BackupView_BackupView_MissingDefaultConnection,
  Web_BackupView_BackupView_MountedRef,
  Web_BackupView_BackupView_MoveStep,
  Web_BackupView_BackupView_MoveStep_Index,
  Web_BackupView_BackupView_MoveStep_Offset,
  Web_BackupView_BackupView_MoveStep_Returns,
  Web_BackupView_BackupView_MoveStep_Target,
  Web_BackupView_BackupView_NamedProfiles,
  Web_BackupView_BackupView_NestingConflict,
  Web_BackupView_BackupView_Next,
  Web_BackupView_BackupView_Next_Returns,
  Web_BackupView_BackupView_NextActions,
  Web_BackupView_BackupView_NextConnection,
  Web_BackupView_BackupView_NextDisabled,
  Web_BackupView_BackupView_NextIncluded,
  Web_BackupView_BackupView_NextName,
  Web_BackupView_BackupView_NoDataFound,
  Web_BackupView_BackupView_OpenExport,
  Web_BackupView_BackupView_OpenExport_Returns,
  Web_BackupView_BackupView_OpenImport,
  Web_BackupView_BackupView_OpenImport_Returns,
  Web_BackupView_BackupView_OrderedStepID,
  Web_BackupView_BackupView_OrderedStepIDs,
  Web_BackupView_BackupView_PasskeyAvailable,
  Web_BackupView_BackupView_PresentVerb,
  Web_BackupView_BackupView_Preview,
  Web_BackupView_BackupView_PreviewDataMissingCount,
  Web_BackupView_BackupView_PreviewFolders,
  Web_BackupView_BackupView_PreviewRunningTorrentCount,
  Web_BackupView_BackupView_PreviewState,
  Web_BackupView_BackupView_PreviewTorrentCount,
  Web_BackupView_BackupView_ProfileAction,
  Web_BackupView_BackupView_ProfileActions,
  Web_BackupView_BackupView_ProfileActionsState,
  Web_BackupView_BackupView_ProfileConnections,
  Web_BackupView_BackupView_ProfileConnectionsState,
  Web_BackupView_BackupView_ProfileIncluded,
  Web_BackupView_BackupView_ProfileIncludedState,
  Web_BackupView_BackupView_ProfileNames,
  Web_BackupView_BackupView_ProfileNamesState,
  Web_BackupView_BackupView_ProfileParts,
  Web_BackupView_BackupView_ProfileTotal,
  Web_BackupView_BackupView_ProgressActions,
  Web_BackupView_BackupView_ProgressJob,
  Web_BackupView_BackupView_ProgressRemaining,
  Web_BackupView_BackupView_ProgressSummary,
  Web_BackupView_BackupView_ProgressSummaryParts,
  Web_BackupView_BackupView_RecheckAmount,
  Web_BackupView_BackupView_RecheckTime,
  Web_BackupView_BackupView_RefreshExportPreview,
  Web_BackupView_BackupView_RefreshExportPreview_NextActions,
  Web_BackupView_BackupView_RefreshExportPreview_NextMappings,
  Web_BackupView_BackupView_RefreshExportPreview_Returns,
  Web_BackupView_BackupView_RefreshMappedFolder,
  Web_BackupView_BackupView_RefreshMappedFolder_NextMappings,
  Web_BackupView_BackupView_RefreshMappedFolder_Path,
  Web_BackupView_BackupView_RefreshMappedFolder_Returns,
  Web_BackupView_BackupView_RefreshMappedFolder_SourcePath,
  Web_BackupView_BackupView_RemainingSeconds,
  Web_BackupView_BackupView_RemoteLoginNote,
  Web_BackupView_BackupView_ReplaceCount,
  Web_BackupView_BackupView_ReplaceVerb,
  Web_BackupView_BackupView_ResetWizard,
  Web_BackupView_BackupView_ResetWizard_Returns,
  Web_BackupView_BackupView_Returns,
  Web_BackupView_BackupView_ReviewItems,
  Web_BackupView_BackupView_ReviewNotes,
  Web_BackupView_BackupView_RunningDetail,
  Web_BackupView_BackupView_RunningImport,
  Web_BackupView_BackupView_RunningReview,
  Web_BackupView_BackupView_RunningTitle,
  Web_BackupView_BackupView_RunningTorrentCount,
  Web_BackupView_BackupView_Sections,
  Web_BackupView_BackupView_Security,
  Web_BackupView_BackupView_SecurityState,
  Web_BackupView_BackupView_SeenTargets,
  Web_BackupView_BackupView_SelectSource,
  Web_BackupView_BackupView_SelectSource_Returns,
  Web_BackupView_BackupView_SelectSource_Source,
  Web_BackupView_BackupView_SetConfigPath,
  Web_BackupView_BackupView_SetDocument,
  Web_BackupView_BackupView_SetExportOpen,
  Web_BackupView_BackupView_SetFileName,
  Web_BackupView_BackupView_SetFolderMappings,
  Web_BackupView_BackupView_SetFolderPicker,
  Web_BackupView_BackupView_SetImportJob,
  Web_BackupView_BackupView_SetImportSource,
  Web_BackupView_BackupView_SetPreview,
  Web_BackupView_BackupView_SetProfileActions,
  Web_BackupView_BackupView_SetProfileConnections,
  Web_BackupView_BackupView_SetProfileIncluded,
  Web_BackupView_BackupView_SetProfileNames,
  Web_BackupView_BackupView_SetSecurity,
  Web_BackupView_BackupView_SetSourceBusy,
  Web_BackupView_BackupView_SetSourceError,
  Web_BackupView_BackupView_SetSourcePickerOpen,
  Web_BackupView_BackupView_SetStep,
  Web_BackupView_BackupView_SettingRows,
  Web_BackupView_BackupView_SettingsExcludedItems,
  Web_BackupView_BackupView_SettingTotal,
  Web_BackupView_BackupView_SetWizardOpen,
  Web_BackupView_BackupView_SharedTargets,
  Web_BackupView_BackupView_ShellBusy,
  Web_BackupView_BackupView_ShellOpen,
  Web_BackupView_BackupView_SkippedSettings,
  Web_BackupView_BackupView_SourceBusy,
  Web_BackupView_BackupView_SourceBusyState,
  Web_BackupView_BackupView_SourceCardClassName,
  Web_BackupView_BackupView_SourceDetails,
  Web_BackupView_BackupView_SourceError,
  Web_BackupView_BackupView_SourceErrorState,
  Web_BackupView_BackupView_SourcePath,
  Web_BackupView_BackupView_SourcePickerInitialPath,
  Web_BackupView_BackupView_SourcePickerOpen,
  Web_BackupView_BackupView_SourcePickerOpenState,
  Web_BackupView_BackupView_SourceReady,
  Web_BackupView_BackupView_StartImport,
  Web_BackupView_BackupView_StartImport_Grant,
  Web_BackupView_BackupView_StartImport_Job,
  Web_BackupView_BackupView_StartImport_Plan,
  Web_BackupView_BackupView_StartImport_Returns,
  Web_BackupView_BackupView_Step,
  Web_BackupView_BackupView_Steps,
  Web_BackupView_BackupView_StepState,
  Web_BackupView_BackupView_Target,
  Web_BackupView_BackupView_Timer,
  Web_BackupView_BackupView_TorrentCount,
  Web_BackupView_BackupView_TorrentReview,
  Web_BackupView_BackupView_TorrentTotal,
  Web_BackupView_BackupView_TotalSizeBytes,
  Web_BackupView_BackupView_UpdateVerb,
  Web_BackupView_BackupView_WizardOpen,
  Web_BackupView_BackupView_WizardOpenState,
  Web_BackupView_CountLabel_Count,
  Web_BackupView_CountLabel_Noun,
  Web_BackupView_CountLabel_Plural,
  Web_BackupView_CountLabel_Returns,
  Web_BackupView_CountLabel_Singular,
  Web_BackupView_EstimatedRecheckDuration_Returns,
  Web_BackupView_EstimatedRecheckDuration_Seconds,
  Web_BackupView_EstimatedRecheckDuration_TorrentCount,
  Web_BackupView_EstimatedRecheckDuration_TotalSizeBytes,
  Web_BackupView_ExportOptions,
  Web_BackupView_FolderPurpose_Folder,
  Web_BackupView_FolderPurpose_Returns,
  Web_BackupView_FormatBytes_Amount,
  Web_BackupView_FormatBytes_Bytes,
  Web_BackupView_FormatBytes_Returns,
  Web_BackupView_FormatBytes_UnitIndex,
  Web_BackupView_FormatBytes_Units,
  Web_BackupView_FormatBytes_Value,
  Web_BackupView_FormatDuration_Hours,
  Web_BackupView_FormatDuration_Minutes,
  Web_BackupView_FormatDuration_Returns,
  Web_BackupView_FormatDuration_Seconds,
  Web_BackupView_PresentImportItem_Detail,
  Web_BackupView_PresentImportItem_Item,
  Web_BackupView_PresentImportItem_Returns,
  Web_BackupView_PresentImportItem_Status,
  Web_BackupView_PresentImportItem_Tone,
  Web_BackupView_SettingValueLabel_Blocklists,
  Web_BackupView_SettingValueLabel_Download,
  Web_BackupView_SettingValueLabel_Incomplete,
  Web_BackupView_SettingValueLabel_Limits,
  Web_BackupView_SettingValueLabel_Queue,
  Web_BackupView_SettingValueLabel_Returns,
  Web_BackupView_SettingValueLabel_Seeding,
  Web_BackupView_SettingValueLabel_SettingKey,
  Web_BackupView_SettingValueLabel_Size,
  Web_BackupView_SettingValueLabel_Source,
  Web_BackupView_SettingValueLabel_Sources,
  Web_BackupView_SettingValueLabel_SpeedLimits,
  Web_BackupView_SettingValueLabel_Upload,
  Web_BackupView_SettingValueLabel_Value,
  Web_BackupView_SummaryNumber_Key,
  Web_BackupView_SummaryNumber_Returns,
  Web_BackupView_SummaryNumber_Summary,
  Web_BackupView_SummaryStrings_Key,
  Web_BackupView_SummaryStrings_Returns,
  Web_BackupView_SummaryStrings_Summary,
  Web_BackupView_SummaryStrings_Value,
  Web_BackupView_ValueRecord_Narrowed,
  Web_BackupView_ValueRecord_Returns,
  Web_BackupView_ValueRecord_Value,
  Web_BackupView_ValuesDiffer_Left,
  Web_BackupView_ValuesDiffer_Returns,
  Web_BackupView_ValuesDiffer_Right,
} from '@/types/web/backup-view.d.ts';

/**
 * Backup View - Export Options.
 *
 * Keeps app-specific copy and section identifiers outside the reusable dialog.
 * Every option starts selected when the export dialog opens.
 *
 * @since 2.0.0
 */
const exportOptions: Web_BackupView_ExportOptions = [
  {
    id: 'settingsAndProfiles',
    label: 'Settings and profiles',
    description: 'Global Transmission settings and every torrent profile.',
  },
  {
    id: 'labels',
    label: 'Labels',
    description: 'Saved library labels, including labels not used right now.',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Destinations, event choices, and their sign-ins.',
  },
  {
    id: 'torrents',
    label: 'Torrent list',
    description: 'Metainfo, profile, labels, limits, and paused state — never downloaded data.',
  },
  {
    id: 'vpnConnections',
    label: 'VPN connections',
    description: 'Providers, endpoints, sign-ins, DNS, and connection choices.',
  },
  {
    id: 'remoteAccess',
    label: 'Remote app logins and API tokens',
    description: 'Compatible RPC logins and scoped API tokens.',
  },
];

/**
 * Backup View - Count Label.
 *
 * Keeps singular and plural review copy correct for every imported count.
 * Callers may provide an irregular plural when appending “s” is not enough.
 *
 * @param {Web_BackupView_CountLabel_Count}    count    - Count.
 * @param {Web_BackupView_CountLabel_Singular} singular - Singular.
 * @param {Web_BackupView_CountLabel_Plural}   [plural] - Plural.
 *
 * @returns {Web_BackupView_CountLabel_Returns}
 *
 * @since 2.0.0
 */
const countLabel = (count: Web_BackupView_CountLabel_Count, singular: Web_BackupView_CountLabel_Singular, plural: Web_BackupView_CountLabel_Plural = `${singular}s`): Web_BackupView_CountLabel_Returns => {
  const noun: Web_BackupView_CountLabel_Noun = (count === 1) ? singular : plural;

  return `${count.toLocaleString()} ${noun}`;
};

/**
 * Backup View - Value Record.
 *
 * Narrows one unknown preview value before compound setting presentation.
 * Scalars intentionally become an empty record instead of being coerced.
 *
 * @param {Web_BackupView_ValueRecord_Value} value - Value.
 *
 * @returns {Web_BackupView_ValueRecord_Returns}
 *
 * @since 2.0.0
 */
const valueRecord = (value: Web_BackupView_ValueRecord_Value): Web_BackupView_ValueRecord_Returns => {
  if (
    typeof value === 'object'
    && value !== null
    && Array.isArray(value) === false
  ) {
    return value as Web_BackupView_ValueRecord_Narrowed;
  }

  return {};
};

/**
 * Backup View - Setting Value Label.
 *
 * Converts storage values into the same human language used by Settings.
 * Compound source mappings remain one easy-to-scan row.
 *
 * @param {Web_BackupView_SettingValueLabel_SettingKey} settingKey - Setting key.
 * @param {Web_BackupView_SettingValueLabel_Value}      value      - Value.
 *
 * @returns {Web_BackupView_SettingValueLabel_Returns}
 *
 * @since 2.0.0
 */
const settingValueLabel = (settingKey: Web_BackupView_SettingValueLabel_SettingKey, value: Web_BackupView_SettingValueLabel_Value): Web_BackupView_SettingValueLabel_Returns => {
  if (typeof value === 'boolean') {
    return (value === true) ? 'On' : 'Off';
  }

  if (settingKey === 'transmission.downloadQueue') {
    const queue: Web_BackupView_SettingValueLabel_Queue = valueRecord(value);

    if (queue['enabled'] !== true) {
      return 'Off';
    }

    const size: Web_BackupView_SettingValueLabel_Size = (typeof queue['size'] === 'number') ? queue['size'] : 0;

    return `On · ${size.toLocaleString()} at once`;
  }

  if (settingKey === 'transmission.downloadQueueSize' && typeof value === 'number') {
    return `${value.toLocaleString()} at once`;
  }

  if (
    (
      settingKey === 'transmission.peerLimitGlobal'
      || settingKey === 'profile.default.peerLimit'
    )
    && typeof value === 'number'
  ) {
    return countLabel(value, 'peer');
  }

  if (settingKey === 'profile.default.seeding') {
    const seeding: Web_BackupView_SettingValueLabel_Seeding = valueRecord(value);

    if (seeding['mode'] !== 'limit') {
      return 'No limit';
    }

    const limits: Web_BackupView_SettingValueLabel_Limits = [];

    if (typeof seeding['ratio'] === 'number') {
      limits.push(`ratio ${seeding['ratio']}`);
    }

    if (typeof seeding['idleMinutes'] === 'number') {
      limits.push(`${seeding['idleMinutes']} min idle`);
    }

    return `Stop at ${limits.join(' or ')}`;
  }

  if (settingKey === 'profile.default.speedLimits') {
    const speedLimits: Web_BackupView_SettingValueLabel_SpeedLimits = valueRecord(value);
    const download: Web_BackupView_SettingValueLabel_Download = (typeof speedLimits['download'] === 'number') ? `${speedLimits['download']} KB/s` : 'Unlimited';
    const upload: Web_BackupView_SettingValueLabel_Upload = (typeof speedLimits['upload'] === 'number') ? `${speedLimits['upload']} KB/s` : 'Unlimited';

    return `Down ${download} · Up ${upload}`;
  }

  if (settingKey === 'transmission.blocklists') {
    const blocklists: Web_BackupView_SettingValueLabel_Blocklists = valueRecord(value);

    if (blocklists['enabled'] !== true) {
      return 'Off';
    }

    const sources: Web_BackupView_SettingValueLabel_Sources = (Array.isArray(blocklists['sources']) === true) ? blocklists['sources'].filter((source) => typeof source === 'string') : [];
    const source: Web_BackupView_SettingValueLabel_Source = (typeof blocklists['source'] === 'string') ? blocklists['source'] : sources.join(', ');

    return (source === '') ? 'On' : `On · ${source}`;
  }

  if (settingKey === 'transmission.incompleteFolder') {
    const incomplete: Web_BackupView_SettingValueLabel_Incomplete = valueRecord(value);

    return (incomplete['enabled'] === true) ? `On · ${String(incomplete['path'] ?? '')}` : 'Off';
  }

  if (Array.isArray(value) === true) {
    return (value.length === 0) ? 'None' : value.map(String).join(', ');
  }

  if (typeof value === 'number') {
    return value.toLocaleString();
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value === null || value === undefined) {
    return '—';
  }

  return JSON.stringify(value);
};

/**
 * Backup View - Values Differ.
 *
 * Compares JSON-shaped preview values without converting booleans into strings.
 * The result drives the visual emphasis in the Settings comparison.
 *
 * @param {Web_BackupView_ValuesDiffer_Left}  left  - Left.
 * @param {Web_BackupView_ValuesDiffer_Right} right - Right.
 *
 * @returns {Web_BackupView_ValuesDiffer_Returns}
 *
 * @since 2.0.0
 */
const valuesDiffer = (left: Web_BackupView_ValuesDiffer_Left, right: Web_BackupView_ValuesDiffer_Right): Web_BackupView_ValuesDiffer_Returns => JSON.stringify(left) !== JSON.stringify(right);

/**
 * Backup View - Format Bytes.
 *
 * Produces a compact binary-unit label for the amount that will be re-checked.
 * One decimal is retained only when it helps a value below ten stay meaningful.
 *
 * @param {Web_BackupView_FormatBytes_Bytes} bytes - Bytes.
 *
 * @returns {Web_BackupView_FormatBytes_Returns}
 *
 * @since 2.0.0
 */
const formatBytes = (bytes: Web_BackupView_FormatBytes_Bytes): Web_BackupView_FormatBytes_Returns => {
  if (bytes <= 0) {
    return '';
  }

  const units: Web_BackupView_FormatBytes_Units = [
    'B',
    'KB',
    'MB',
    'GB',
    'TB',
  ];
  let value: Web_BackupView_FormatBytes_Value = bytes;
  let unitIndex: Web_BackupView_FormatBytes_UnitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const amount: Web_BackupView_FormatBytes_Amount = (value >= 10 || unitIndex === 0) ? Math.round(value) : value.toFixed(1);

  return `${amount} ${units[unitIndex]}`;
};

/**
 * Backup View - Format Duration.
 *
 * Gives the review and live progress screens a deliberately approximate time.
 * This avoids implying disk-speed precision that the browser cannot know.
 *
 * @param {Web_BackupView_FormatDuration_Seconds} seconds - Seconds.
 *
 * @returns {Web_BackupView_FormatDuration_Returns}
 *
 * @since 2.0.0
 */
const formatDuration = (seconds: Web_BackupView_FormatDuration_Seconds): Web_BackupView_FormatDuration_Returns => {
  if (seconds < 60) {
    return 'about a minute';
  }

  if (seconds < 3600) {
    const minutes: Web_BackupView_FormatDuration_Minutes = Math.max(1, Math.round(seconds / 60));

    return `about ${countLabel(minutes, 'minute')}`;
  }

  const hours: Web_BackupView_FormatDuration_Hours = Math.max(1, Math.round(seconds / 3600));

  return `about ${countLabel(hours, 'hour')}`;
};

/**
 * Backup View - Estimated Recheck Duration.
 *
 * Uses a conservative disk-throughput baseline plus per-torrent startup time.
 * The estimate is guidance only and is always described as approximate.
 *
 * @param {Web_BackupView_EstimatedRecheckDuration_TorrentCount}   torrentCount   - Torrent count.
 * @param {Web_BackupView_EstimatedRecheckDuration_TotalSizeBytes} totalSizeBytes - Total size bytes.
 *
 * @returns {Web_BackupView_EstimatedRecheckDuration_Returns}
 *
 * @since 2.0.0
 */
const estimatedRecheckDuration = (torrentCount: Web_BackupView_EstimatedRecheckDuration_TorrentCount, totalSizeBytes: Web_BackupView_EstimatedRecheckDuration_TotalSizeBytes): Web_BackupView_EstimatedRecheckDuration_Returns => {
  const seconds: Web_BackupView_EstimatedRecheckDuration_Seconds = Math.max(30, (totalSizeBytes / (80 * 1024 * 1024)) + (torrentCount * 2));

  return formatDuration(seconds);
};

/**
 * Backup View - Present Import Item.
 *
 * Translates durable torrent states into the shared progress row and state pills.
 * Missing-data context remains a second line so the red pill stays easy to scan.
 *
 * @param {Web_BackupView_PresentImportItem_Item} item - Item.
 *
 * @returns {Web_BackupView_PresentImportItem_Returns}
 *
 * @since 2.0.0
 */
const presentImportItem = (item: Web_BackupView_PresentImportItem_Item): Web_BackupView_PresentImportItem_Returns => {
  let status: Web_BackupView_PresentImportItem_Status = item['state'];
  let tone: Web_BackupView_PresentImportItem_Tone = 'muted';
  let detail: Web_BackupView_PresentImportItem_Detail = undefined;

  switch (item['state']) {
    case 'queued': {
      status = 'Queued';
      break;
    }

    case 'rechecking': {
      status = `Re-checking ${Math.round(item['progress'] * 100)}%`;
      tone = 'active';
      break;
    }

    case 'seeding': {
      status = 'Seeding';
      tone = 'success';
      break;
    }

    case 'downloading': {
      status = 'Downloading';
      tone = 'success';
      break;
    }

    case 'paused': {
      status = 'Paused';
      break;
    }

    case 'data-missing': {
      status = 'Data missing';
      tone = 'danger';
      detail = `Its files weren’t found in ${item['folder']}`;
      break;
    }

    case 'already-added': {
      status = 'Already added';
      break;
    }

    case 'failed': {
      status = 'Could not import';
      tone = 'danger';
      detail = item['detail'];
      break;
    }

    default: {
      break;
    }
  }

  return {
    context: item['profileName'],
    ...((detail === undefined) ? {} : { detail }),
    id: item['hash'],
    name: item['name'],
    status,
    tone,
  };
};

/**
 * Backup View - Summary Number.
 *
 * Reads one numeric persisted-job summary field with a stable zero fallback.
 * This keeps jobs created by an earlier build compatible with the new header.
 *
 * @param {Web_BackupView_SummaryNumber_Summary} summary - Summary.
 * @param {Web_BackupView_SummaryNumber_Key}     key     - Key.
 *
 * @returns {Web_BackupView_SummaryNumber_Returns}
 *
 * @since 2.0.0
 */
const summaryNumber = (summary: Web_BackupView_SummaryNumber_Summary, key: Web_BackupView_SummaryNumber_Key): Web_BackupView_SummaryNumber_Returns => (
  (typeof summary[key] === 'number') ? summary[key] : 0
);

/**
 * Backup View - Summary Strings.
 *
 * Reads one string-list job summary field while ignoring older or malformed values.
 * Import jobs created before merge summaries therefore remain safe to display.
 *
 * @param {Web_BackupView_SummaryStrings_Summary} summary - Summary.
 * @param {Web_BackupView_SummaryStrings_Key}     key     - Key.
 *
 * @returns {Web_BackupView_SummaryStrings_Returns}
 *
 * @since 2.0.0
 */
const summaryStrings = (summary: Web_BackupView_SummaryStrings_Summary, key: Web_BackupView_SummaryStrings_Key): Web_BackupView_SummaryStrings_Returns => {
  const value: Web_BackupView_SummaryStrings_Value = summary[key];

  if (Array.isArray(value) === false) {
    return [];
  }

  return value.filter((entry) => typeof entry === 'string');
};

/**
 * Backup View - Folder Purpose.
 *
 * Selects the app's destination-folder policy for one imported folder role.
 * Default, incomplete, and named-profile ownership retain their normal rules.
 *
 * @param {Web_BackupView_FolderPurpose_Folder} folder - Folder.
 *
 * @returns {Web_BackupView_FolderPurpose_Returns}
 *
 * @since 2.0.0
 */
const folderPurpose = (folder: Web_BackupView_FolderPurpose_Folder): Web_BackupView_FolderPurpose_Returns => {
  if (folder['kind'] === 'incomplete') {
    return 'incomplete';
  }

  if (folder['kind'] === 'default') {
    return 'download';
  }

  return 'profile';
};

/**
 * Backup View - Backup View.
 *
 * Owns the app's export sections and both import sources while reusable backup
 * foundations supply the section, shell, confirmation, and progress structure.
 *
 * @returns {Web_BackupView_BackupView_Returns}
 *
 * @since 2.0.0
 */
export const BackupView = (): Web_BackupView_BackupView_Returns => {
  const securityState: Web_BackupView_BackupView_SecurityState = useState<Web_BackupView_BackupView_Security>(null);
  const security: Web_BackupView_BackupView_Security = securityState[0];
  const setSecurity: Web_BackupView_BackupView_SetSecurity = securityState[1];
  const exportOpenState: Web_BackupView_BackupView_ExportOpenState = useState<Web_BackupView_BackupView_ExportOpen>(false);
  const exportOpen: Web_BackupView_BackupView_ExportOpen = exportOpenState[0];
  const setExportOpen: Web_BackupView_BackupView_SetExportOpen = exportOpenState[1];
  const wizardOpenState: Web_BackupView_BackupView_WizardOpenState = useState<Web_BackupView_BackupView_WizardOpen>(false);
  const wizardOpen: Web_BackupView_BackupView_WizardOpen = wizardOpenState[0];
  const setWizardOpen: Web_BackupView_BackupView_SetWizardOpen = wizardOpenState[1];
  const stepState: Web_BackupView_BackupView_StepState = useState<Web_BackupView_BackupView_Step>('source');
  const step: Web_BackupView_BackupView_Step = stepState[0];
  const setStep: Web_BackupView_BackupView_SetStep = stepState[1];
  const importSourceState: Web_BackupView_BackupView_ImportSourceState = useState<Web_BackupView_BackupView_ImportSource>('transmission-vpn-export');
  const importSource: Web_BackupView_BackupView_ImportSource = importSourceState[0];
  const setImportSource: Web_BackupView_BackupView_SetImportSource = importSourceState[1];
  const documentState: Web_BackupView_BackupView_DocumentState = useState<Web_BackupView_BackupView_Document>(null);
  const document: Web_BackupView_BackupView_Document = documentState[0];
  const setDocument: Web_BackupView_BackupView_SetDocument = documentState[1];
  const fileNameState: Web_BackupView_BackupView_FileNameState = useState<Web_BackupView_BackupView_FileName>('');
  const fileName: Web_BackupView_BackupView_FileName = fileNameState[0];
  const setFileName: Web_BackupView_BackupView_SetFileName = fileNameState[1];
  const configPathState: Web_BackupView_BackupView_ConfigPathState = useState<Web_BackupView_BackupView_ConfigPath>('/import');
  const configPath: Web_BackupView_BackupView_ConfigPath = configPathState[0];
  const setConfigPath: Web_BackupView_BackupView_SetConfigPath = configPathState[1];
  const previewState: Web_BackupView_BackupView_PreviewState = useState<Web_BackupView_BackupView_Preview>(null);
  const preview: Web_BackupView_BackupView_Preview = previewState[0];
  const setPreview: Web_BackupView_BackupView_SetPreview = previewState[1];
  const folderMappingsState: Web_BackupView_BackupView_FolderMappingsState = useState<Web_BackupView_BackupView_FolderMappings>({});
  const folderMappings: Web_BackupView_BackupView_FolderMappings = folderMappingsState[0];
  const setFolderMappings: Web_BackupView_BackupView_SetFolderMappings = folderMappingsState[1];
  const profileActionsState: Web_BackupView_BackupView_ProfileActionsState = useState<Web_BackupView_BackupView_ProfileActions>({});
  const profileActions: Web_BackupView_BackupView_ProfileActions = profileActionsState[0];
  const setProfileActions: Web_BackupView_BackupView_SetProfileActions = profileActionsState[1];
  const profileNamesState: Web_BackupView_BackupView_ProfileNamesState = useState<Web_BackupView_BackupView_ProfileNames>({});
  const profileNames: Web_BackupView_BackupView_ProfileNames = profileNamesState[0];
  const setProfileNames: Web_BackupView_BackupView_SetProfileNames = profileNamesState[1];
  const profileConnectionsState: Web_BackupView_BackupView_ProfileConnectionsState = useState<Web_BackupView_BackupView_ProfileConnections>({});
  const profileConnections: Web_BackupView_BackupView_ProfileConnections = profileConnectionsState[0];
  const setProfileConnections: Web_BackupView_BackupView_SetProfileConnections = profileConnectionsState[1];
  const profileIncludedState: Web_BackupView_BackupView_ProfileIncludedState = useState<Web_BackupView_BackupView_ProfileIncluded>({});
  const profileIncluded: Web_BackupView_BackupView_ProfileIncluded = profileIncludedState[0];
  const setProfileIncluded: Web_BackupView_BackupView_SetProfileIncluded = profileIncludedState[1];
  const sourceBusyState: Web_BackupView_BackupView_SourceBusyState = useState<Web_BackupView_BackupView_SourceBusy>(false);
  const sourceBusy: Web_BackupView_BackupView_SourceBusy = sourceBusyState[0];
  const setSourceBusy: Web_BackupView_BackupView_SetSourceBusy = sourceBusyState[1];
  const sourceErrorState: Web_BackupView_BackupView_SourceErrorState = useState<Web_BackupView_BackupView_SourceError>('');
  const sourceError: Web_BackupView_BackupView_SourceError = sourceErrorState[0];
  const setSourceError: Web_BackupView_BackupView_SetSourceError = sourceErrorState[1];
  const importJobState: Web_BackupView_BackupView_ImportJobState = useState<Web_BackupView_BackupView_ImportJob>(null);
  const importJob: Web_BackupView_BackupView_ImportJob = importJobState[0];
  const setImportJob: Web_BackupView_BackupView_SetImportJob = importJobState[1];
  const folderPickerState: Web_BackupView_BackupView_FolderPickerState = useState<Web_BackupView_BackupView_FolderPicker>(null);
  const folderPicker: Web_BackupView_BackupView_FolderPicker = folderPickerState[0];
  const setFolderPicker: Web_BackupView_BackupView_SetFolderPicker = folderPickerState[1];
  const sourcePickerOpenState: Web_BackupView_BackupView_SourcePickerOpenState = useState<Web_BackupView_BackupView_SourcePickerOpen>(false);
  const sourcePickerOpen: Web_BackupView_BackupView_SourcePickerOpen = sourcePickerOpenState[0];
  const setSourcePickerOpen: Web_BackupView_BackupView_SetSourcePickerOpen = sourcePickerOpenState[1];
  const mountedRef: Web_BackupView_BackupView_MountedRef = useRef<boolean>(true);

  useEffect(() => {
    mountedRef.current = true;

    void getCurrentBackupImport().then((job) => {
      if (mountedRef.current === true) {
        setImportJob(job);
      }

      return;
    }).catch(() => undefined);

    return () => {
      mountedRef.current = false;

      return;
    };
  }, []);

  const importJobId: Web_BackupView_BackupView_ImportJobId = (importJob !== null) ? importJob['id'] : undefined;
  const importJobStatus: Web_BackupView_BackupView_ImportJobStatus = (importJob !== null) ? importJob['status'] : undefined;

  useEffect(() => {
    if (
      importJob === null
      || importJob['status'] === 'completed'
      || importJob['status'] === 'failed'
    ) {
      return undefined;
    }

    let cancelled: Web_BackupView_BackupView_Cancelled = false;
    const timer: Web_BackupView_BackupView_Timer = window.setInterval(() => {
      void getBackupImport(importJob['id']).then((job) => {
        if (cancelled === false) {
          setImportJob(job);
        }

        return;
      }).catch(() => undefined);

      return;
    }, 1000);

    return () => {
      cancelled = true;

      window.clearInterval(timer);

      return;
    };
  }, [
    importJobId,
    importJobStatus,
  ]);

  const loadSecurity: Web_BackupView_BackupView_LoadSecurity = useCallback(async () => {
    const accountSecurity: Web_BackupView_BackupView_AccountSecurity = await getAccountSecurity();

    setSecurity(accountSecurity);

    return accountSecurity;
  }, []);

  /**
   * Backup View - Open Export.
   *
   * Refreshes current confirmation capabilities before showing secret choices.
   * A failed account read leaves the dialog closed and reports one toast.
   *
   * @returns {Web_BackupView_BackupView_OpenExport_Returns}
   *
   * @since 2.0.0
   */
  const openExport: Web_BackupView_BackupView_OpenExport = async (): Web_BackupView_BackupView_OpenExport_Returns => {
    try {
      await loadSecurity();

      setExportOpen(true);
    } catch {
      showToast('Account security could not be loaded.', false);
    }

    return;
  };

  /**
   * Backup View - Reset Wizard.
   *
   * Releases local source material and every decision from a previous attempt.
   * Persisted server progress remains independent in the import-job state.
   *
   * @returns {Web_BackupView_BackupView_ResetWizard_Returns}
   *
   * @since 2.0.0
   */
  const resetWizard: Web_BackupView_BackupView_ResetWizard = (): Web_BackupView_BackupView_ResetWizard_Returns => {
    setStep('source');
    setImportSource('transmission-vpn-export');
    setDocument(null);
    setFileName('');
    setConfigPath('/import');
    setPreview(null);
    setFolderMappings({});
    setProfileActions({});
    setProfileNames({});
    setProfileConnections({});
    setProfileIncluded({});
    setSourceError('');
    setSourceBusy(false);

    return;
  };

  /**
   * Backup View - Open Import.
   *
   * Restores a durable running job or starts a clean source selection.
   * Background work therefore stays reachable after leaving Settings.
   *
   * @returns {Web_BackupView_BackupView_OpenImport_Returns}
   *
   * @since 2.0.0
   */
  const openImport: Web_BackupView_BackupView_OpenImport = (): Web_BackupView_BackupView_OpenImport_Returns => {
    if (importJob !== null) {
      setStep('importing');
      setWizardOpen(true);

      return;
    }

    resetWizard();
    setWizardOpen(true);

    return;
  };

  /**
   * Backup View - Close Wizard.
   *
   * Dismisses local dialogs without cancelling a persisted import job.
   * Source documents are released whenever no job progress is being shown.
   *
   * @returns {Web_BackupView_BackupView_CloseWizard_Returns}
   *
   * @since 2.0.0
   */
  const closeWizard: Web_BackupView_BackupView_CloseWizard = (): Web_BackupView_BackupView_CloseWizard_Returns => {
    setWizardOpen(false);
    setFolderPicker(null);
    setSourcePickerOpen(false);

    if (step !== 'importing') {
      setDocument(null);
      setPreview(null);
    }

    return;
  };

  /**
   * Backup View - Initialize Preview Choices.
   *
   * Applies server suggestions once when a source is first inspected.
   * Later folder-count refreshes preserve names, connections, and inclusion choices.
   *
   * @param {Web_BackupView_BackupView_InitializePreviewChoices_NextPreview} nextPreview - Next preview.
   *
   * @returns {Web_BackupView_BackupView_InitializePreviewChoices_Returns}
   *
   * @since 2.0.0
   */
  const initializePreviewChoices: Web_BackupView_BackupView_InitializePreviewChoices = (nextPreview: Web_BackupView_BackupView_InitializePreviewChoices_NextPreview): Web_BackupView_BackupView_InitializePreviewChoices_Returns => {
    const actions: Web_BackupView_BackupView_InitializePreviewChoices_Actions = {};
    const names: Web_BackupView_BackupView_InitializePreviewChoices_Names = {};
    const connections: Web_BackupView_BackupView_InitializePreviewChoices_Connections = {};
    const included: Web_BackupView_BackupView_InitializePreviewChoices_Included = {};

    for (const profile of nextPreview['profiles']) {
      Reflect.set(actions, profile['id'], 'replace');

      if (profile['sourcePath'] !== undefined) {
        Reflect.set(names, profile['sourcePath'], profile['name']);
        Reflect.set(connections, profile['sourcePath'], profile['connectionId'] ?? null);
        Reflect.set(included, profile['sourcePath'], profile['included']);
      }
    }

    setProfileActions(actions);
    setProfileNames(names);
    setProfileConnections(connections);
    setProfileIncluded(included);

    return;
  };

  /**
   * Backup View - Inspect Another Transmission.
   *
   * Requests a fresh read-only projection and merges same-path folder suggestions.
   * A mapping refresh can retain profile decisions by skipping initialization.
   *
   * @param {Web_BackupView_BackupView_InspectAnotherTransmission_Path}              path              - Path.
   * @param {Web_BackupView_BackupView_InspectAnotherTransmission_Mappings}          mappings          - Mappings.
   * @param {Web_BackupView_BackupView_InspectAnotherTransmission_InitializeChoices} initializeChoices - Initialize choices.
   *
   * @returns {Web_BackupView_BackupView_InspectAnotherTransmission_Returns}
   *
   * @since 2.0.0
   */
  const inspectAnotherTransmission: Web_BackupView_BackupView_InspectAnotherTransmission = async (
    path: Web_BackupView_BackupView_InspectAnotherTransmission_Path,
    mappings: Web_BackupView_BackupView_InspectAnotherTransmission_Mappings,
    initializeChoices: Web_BackupView_BackupView_InspectAnotherTransmission_InitializeChoices,
  ): Web_BackupView_BackupView_InspectAnotherTransmission_Returns => {
    setSourceBusy(true);
    setSourceError('');

    try {
      const nextPreview: Web_BackupView_BackupView_InspectAnotherTransmission_NextPreview = await previewAnotherTransmissionImport(path, mappings);
      const nextMappings: Web_BackupView_BackupView_InspectAnotherTransmission_NextMappings = { ...mappings };

      for (const folder of nextPreview['folders']) {
        if ((nextMappings[folder['sourcePath']] ?? '') === '' && folder['mappedPath'] !== undefined) {
          Reflect.set(nextMappings, folder['sourcePath'], folder['mappedPath']);
        }
      }

      setPreview(nextPreview);
      setFolderMappings(nextMappings);
      setDocument(null);

      if (initializeChoices === true) {
        initializePreviewChoices(nextPreview);
      }
    } catch (caughtError) {
      setPreview(null);
      setSourceError((caughtError instanceof Error) ? caughtError.message : 'That config folder could not be inspected.');
    } finally {
      setSourceBusy(false);
    }

    return;
  };

  /**
   * Backup View - Choose File.
   *
   * Parses the file locally before asking the server for environment conflicts.
   * The native input is cleared so choosing the same corrected file works again.
   *
   * @param {Web_BackupView_BackupView_ChooseFile_Event} event - Event.
   *
   * @returns {Web_BackupView_BackupView_ChooseFile_Returns}
   *
   * @since 2.0.0
   */
  const chooseFile: Web_BackupView_BackupView_ChooseFile = async (event: Web_BackupView_BackupView_ChooseFile_Event): Web_BackupView_BackupView_ChooseFile_Returns => {
    const input: Web_BackupView_BackupView_ChooseFile_Input = event.currentTarget;
    const inputFiles: Web_BackupView_BackupView_ChooseFile_InputFiles = input.files;
    const file: Web_BackupView_BackupView_ChooseFile_File = (inputFiles !== null) ? inputFiles[0] : undefined;

    input.value = '';

    if (file === undefined) {
      return;
    }

    setImportSource('transmission-vpn-export');
    setSourceBusy(true);
    setSourceError('');

    try {
      const parsedValue: Web_BackupView_BackupView_ChooseFile_ParsedValue = JSON.parse(await file.text());
      const parsedDocument: Web_BackupView_BackupView_ChooseFile_ParsedDocument = parseBackupDocument(parsedValue);
      const nextPreview: Web_BackupView_BackupView_ChooseFile_NextPreview = await previewBackupImport(parsedDocument);

      setDocument(parsedDocument);
      setFileName(file.name);
      setPreview(nextPreview);
      setFolderMappings({});
      initializePreviewChoices(nextPreview);
    } catch (caughtError) {
      setDocument(null);
      setPreview(null);
      setFileName('');
      setSourceError((caughtError instanceof Error) ? `This file cannot be imported: ${caughtError.message}` : 'This file is not a valid export.');
    } finally {
      setSourceBusy(false);
    }

    return;
  };

  /**
   * Backup View - Select Source.
   *
   * Clears decisions that belong to the other source and inspects mounted config.
   * Re-selecting an unresolved mounted source retries its current path.
   *
   * @param {Web_BackupView_BackupView_SelectSource_Source} source - Source.
   *
   * @returns {Web_BackupView_BackupView_SelectSource_Returns}
   *
   * @since 2.0.0
   */
  const selectSource: Web_BackupView_BackupView_SelectSource = (source: Web_BackupView_BackupView_SelectSource_Source): Web_BackupView_BackupView_SelectSource_Returns => {
    if (source === importSource) {
      if (
        source === 'another-transmission'
        && preview === null
        && sourceBusy === false
      ) {
        void inspectAnotherTransmission(configPath, {}, true);
      }

      return;
    }

    setImportSource(source);
    setDocument(null);
    setPreview(null);
    setFolderMappings({});
    setSourceError('');

    if (source === 'another-transmission') {
      void inspectAnotherTransmission(configPath, {}, true);
    }

    return;
  };

  const steps: Web_BackupView_BackupView_Steps = useMemo<Web_BackupView_BackupView_Steps>(() => {
    const availableSteps: Web_BackupView_BackupView_AvailableSteps = [{
      id: 'source',
      label: 'Source',
    }];

    if (preview !== null && preview['folders'].length > 0) {
      availableSteps.push({
        id: 'folders',
        label: 'Folders',
      });
    }

    if (preview !== null && preview['profiles'].length > 0) {
      availableSteps.push({
        id: 'profiles',
        label: 'Profiles',
      });
    }

    if (preview !== null && preview['settings'].length > 0) {
      availableSteps.push({
        id: 'settings',
        label: 'Settings',
      });
    }

    availableSteps.push({
      id: 'review',
      label: 'Review',
    });

    if (step === 'importing') {
      availableSteps.push({
        id: 'importing',
        label: 'Importing',
      });
    }

    return availableSteps;
  }, [
    preview,
    step,
  ]);

  const orderedStepIDs: Web_BackupView_BackupView_OrderedStepIDs = steps.map(
    (wizardStep) => wizardStep['id'] as Web_BackupView_BackupView_OrderedStepID,
  );

  /**
   * Backup View - Move Step.
   *
   * Navigates through the derived list so absent optional steps stay skipped.
   * An out-of-range move leaves the current wizard state unchanged.
   *
   * @param {Web_BackupView_BackupView_MoveStep_Offset} offset - Offset.
   *
   * @returns {Web_BackupView_BackupView_MoveStep_Returns}
   *
   * @since 2.0.0
   */
  const moveStep: Web_BackupView_BackupView_MoveStep = (offset: Web_BackupView_BackupView_MoveStep_Offset): Web_BackupView_BackupView_MoveStep_Returns => {
    const index: Web_BackupView_BackupView_MoveStep_Index = orderedStepIDs.indexOf(step);
    const target: Web_BackupView_BackupView_MoveStep_Target = orderedStepIDs[index + offset];

    if (target !== undefined) {
      setStep(target);
    }

    return;
  };

  // Each profile owns one folder, so two old download folders cannot share a target.
  const sharedTargets: Web_BackupView_BackupView_SharedTargets = new Set<string>();
  const seenTargets: Web_BackupView_BackupView_SeenTargets = new Set<string>();
  const previewFolders: Web_BackupView_BackupView_PreviewFolders = (preview !== null) ? preview['folders'] : [];

  for (const folder of previewFolders) {
    const target: Web_BackupView_BackupView_Target = (folderMappings[folder['sourcePath']] ?? '').replace(trailingSlashesPattern, '').toLowerCase();

    if (folder['kind'] === 'incomplete' || target === '') {
      continue;
    }

    if (seenTargets.has(target) === true) {
      sharedTargets.add(target);
    }

    seenTargets.add(target);
  }

  const nestingConflict: Web_BackupView_BackupView_NestingConflict = (preview !== null) ? preview['folders'].some(
    (folder) => (folder['conflict'] ?? '') !== '',
  ) : false;
  const foldersMapped: Web_BackupView_BackupView_FoldersMapped = (preview !== null) ? preview['folders'].every(
    (folder) => (folderMappings[folder['sourcePath']] ?? '') !== '',
  ) : true;
  const mappingsComplete: Web_BackupView_BackupView_MappingsComplete = (
    sharedTargets.size === 0
    && nestingConflict === false
    && foldersMapped === true
  );
  const choicesComplete: Web_BackupView_BackupView_ChoicesComplete = (preview !== null) ? preview['profiles'].every(
    (profile) => {
      if (importSource === 'another-transmission' && profile['sourcePath'] !== undefined) {
        if (profile['empty'] === true && profileIncluded[profile['sourcePath']] === false) {
          return true;
        }

        if ((profileNames[profile['sourcePath']] ?? '').trim() === '') {
          return false;
        }
      }

      return (
        profile['default'] === true
        || profile['existingId'] === null
        || profileActions[profile['id']] !== undefined
      );
    },
  ) : true;
  const sourceReady: Web_BackupView_BackupView_SourceReady = (
    preview !== null
    && (
      (
        importSource === 'transmission-vpn-export'
        && document !== null
      )
      || importSource === 'another-transmission'
    )
  );
  const missingDefaultConnection: Web_BackupView_BackupView_MissingDefaultConnection = (
    preview !== null
    && preview['torrentCount'] > 0
    && preview['connections'].some((connection) => connection['default'] === true) === false
  );
  const nextDisabled: Web_BackupView_BackupView_NextDisabled = (
    (
      step === 'review'
      && (
        missingDefaultConnection === true
        || nestingConflict === true
      )
    )
    || (
      step === 'source'
      && (
        sourceReady === false
        || missingDefaultConnection === true
      )
    )
    || (
      step === 'folders'
      && mappingsComplete === false
    )
    || (
      step === 'profiles'
      && choicesComplete === false
    )
  );

  /**
   * Backup View - Next.
   *
   * The review boundary refreshes identity-confirmation capabilities first.
   * Earlier steps move immediately through the currently available pages.
   *
   * @returns {Web_BackupView_BackupView_Next_Returns}
   *
   * @since 2.0.0
   */
  const next: Web_BackupView_BackupView_Next = (): Web_BackupView_BackupView_Next_Returns => {
    if (step === 'review') {
      void loadSecurity().then(() => setStep('confirm')).catch(() => {
        showToast('Account security could not be loaded.', false);

        return;
      });

      return;
    }

    moveStep(1);

    return;
  };

  /**
   * Backup View - Start Import.
   *
   * Builds the discriminated plan for the selected source and consumes one grant.
   * The returned durable job immediately replaces all source-specific progress.
   *
   * @param {Web_BackupView_BackupView_StartImport_Grant} grant - Grant.
   *
   * @returns {Web_BackupView_BackupView_StartImport_Returns}
   *
   * @since 2.0.0
   */
  const startImport: Web_BackupView_BackupView_StartImport = async (grant: Web_BackupView_BackupView_StartImport_Grant): Web_BackupView_BackupView_StartImport_Returns => {
    let plan: Web_BackupView_BackupView_StartImport_Plan = undefined;

    if (importSource === 'transmission-vpn-export') {
      if (document === null) {
        throw new Error('Choose the export file again.');
      }

      plan = {
        document,
        folderMappings,
        profileActions,
        source: 'transmission-vpn-export',
      };
    } else {
      plan = {
        configPath,
        folderMappings,
        profileActions,
        profileConnections,
        profileIncluded,
        profileNames,
        source: 'another-transmission',
      };
    }

    if (plan === undefined) {
      throw new Error('The import source is incomplete.');
    }

    const job: Web_BackupView_BackupView_StartImport_Job = await createBackupImport(plan, grant);

    setImportJob(job);
    setStep('importing');

    return;
  };

  const passkeyAvailable: Web_BackupView_BackupView_PasskeyAvailable = (
    security !== null
    && security['passkeysAvailable'] === true
    && security['passkeys'].length > 0
  );
  let runningImport: Web_BackupView_BackupView_RunningImport = null;

  if (importJob !== null) {
    let runningTitle: Web_BackupView_BackupView_RunningTitle = 'Import in progress';
    let runningDetail: Web_BackupView_BackupView_RunningDetail = `Re-checked ${importJob['completedTorrents']} of ${importJob['totalTorrents']}`;

    if (importJob['status'] === 'completed') {
      runningTitle = 'Import complete';
      runningDetail = 'See what changed';
    } else if (importJob['status'] === 'failed') {
      runningTitle = 'Import stopped';
      runningDetail = (importJob['error'] !== '') ? importJob['error'] : 'Needs review';
    }

    runningImport = {
      detail: runningDetail,
      progress: (importJob['totalTorrents'] === 0) ? 0 : importJob['completedTorrents'] / importJob['totalTorrents'],
      title: runningTitle,
    };
  }

  const progressJob: Web_BackupView_BackupView_ProgressJob = (importJob === null) ? null : {
    completed: importJob['completedTorrents'],
    error: importJob['error'],
    items: importJob['items'].map(presentImportItem),
    status: importJob['status'],
    total: importJob['totalTorrents'],
  };
  const importableSettings: Web_BackupView_BackupView_ImportableSettings = (preview !== null) ? preview['settings'].filter(
    (setting) => setting['willImport'] === true,
  ) : [];
  const skippedSettings: Web_BackupView_BackupView_SkippedSettings = (preview !== null) ? preview['settings'].filter(
    (setting) => setting['willImport'] === false,
  ) : [];
  const settingRows: Web_BackupView_BackupView_SettingRows = importableSettings.map(
    (setting) => {
      return {
        changed: valuesDiffer(setting['fileValue'], setting['hereValue']),
        fileValue: settingValueLabel(setting['key'], setting['fileValue']),
        hereValue: settingValueLabel(setting['key'], setting['hereValue']),
        id: setting['key'],
        label: setting['title'],
      };
    },
  );
  const settingsExcludedItems: Web_BackupView_BackupView_SettingsExcludedItems = skippedSettings.map(
    (setting) => {
      return {
        id: setting['key'],
        label: setting['title'],
        reason: setting['reason'] ?? 'There is no equivalent setting here.',
      };
    },
  );
  const includedProfiles: Web_BackupView_BackupView_IncludedProfiles = (preview !== null) ? preview['profiles'].filter(
    (profile) => (
      profile['sourcePath'] === undefined
      || profile['empty'] !== true
      || profileIncluded[profile['sourcePath']] !== false
    ),
  ) : [];
  let totalSizeBytes: Web_BackupView_BackupView_TotalSizeBytes = (preview !== null) ? preview['totalSizeBytes'] : 0;

  if (
    importSource === 'another-transmission'
    && preview !== null
    && preview['dataFoundBytes'] !== undefined
  ) {
    totalSizeBytes = preview['dataFoundBytes'];
  }

  const alreadyPresentCount: Web_BackupView_BackupView_AlreadyPresentCount = (preview !== null) ? (preview['alreadyPresentCount'] ?? 0) : 0;
  const previewTorrentCount: Web_BackupView_BackupView_PreviewTorrentCount = (preview !== null) ? preview['torrentCount'] : 0;
  const torrentCount: Web_BackupView_BackupView_TorrentCount = Math.max(0, previewTorrentCount - alreadyPresentCount);
  const previewRunningTorrentCount: Web_BackupView_BackupView_PreviewRunningTorrentCount = (preview !== null) ? preview['runningTorrentCount'] : undefined;
  const documentTorrents: Web_BackupView_BackupView_DocumentTorrents = (document !== null) ? document['torrents'] : undefined;
  const documentRunningTorrentCount: Web_BackupView_BackupView_DocumentRunningTorrentCount = (documentTorrents !== undefined) ? documentTorrents.filter((torrent) => torrent['paused'] === false).length : undefined;
  const runningTorrentCount: Web_BackupView_BackupView_RunningTorrentCount = (
    previewRunningTorrentCount
    ?? documentRunningTorrentCount
    ?? 0
  );
  const previewDataMissingCount: Web_BackupView_BackupView_PreviewDataMissingCount = (preview !== null) ? preview['dataMissingCount'] : undefined;
  const dataMissingCount: Web_BackupView_BackupView_DataMissingCount = (importSource === 'another-transmission') ? (previewDataMissingCount ?? 0) : 0;
  const changedSettingCount: Web_BackupView_BackupView_ChangedSettingCount = settingRows.filter((row) => row['changed'] === true).length;
  const recheckTime: Web_BackupView_BackupView_RecheckTime = estimatedRecheckDuration(torrentCount - dataMissingCount, totalSizeBytes);
  const reviewItems: Web_BackupView_BackupView_ReviewItems = [];

  if (importSource === 'another-transmission') {
    const namedProfiles: Web_BackupView_BackupView_NamedProfiles = includedProfiles.filter((profile) => profile['default'] === false);
    const createCount: Web_BackupView_BackupView_CreateCount = namedProfiles.filter((profile) => profile['existingId'] === null).length;
    const replaceCount: Web_BackupView_BackupView_ReplaceCount = namedProfiles.filter((profile) => (
      profile['existingId'] !== null && (profileActions[profile['id']] ?? 'replace') === 'replace'
    )).length;
    const keepCount: Web_BackupView_BackupView_KeepCount = namedProfiles.length - createCount - replaceCount;
    const profileParts: Web_BackupView_BackupView_ProfileParts = [];

    if (createCount > 0) {
      profileParts.push(`Create ${countLabel(createCount, 'profile')} from the mapped folders`);
    }

    if (replaceCount > 0) {
      const replaceVerb: Web_BackupView_BackupView_ReplaceVerb = (profileParts.length > 0) ? 'replace' : 'Replace';

      profileParts.push(`${replaceVerb} ${countLabel(replaceCount, 'profile')} with the same name`);
    }

    if (keepCount > 0) {
      const keepVerb: Web_BackupView_BackupView_KeepVerb = (profileParts.length > 0) ? 'keep' : 'Keep';

      profileParts.push(`${keepVerb} ${countLabel(keepCount, 'profile')} as they are here`);
    }

    const updateVerb: Web_BackupView_BackupView_UpdateVerb = (profileParts.length > 0) ? 'and update' : 'Update';

    profileParts.push(`${updateVerb} the Default profile`);

    reviewItems.push({
      id: 'profiles',
      text: profileParts.join(', '),
    });
  } else if (includedProfiles.length > 0) {
    reviewItems.push({
      id: 'profiles',
      text: `Create or update ${countLabel(includedProfiles.length, 'profile')}`,
    });
  }

  if (changedSettingCount > 0) {
    reviewItems.push({
      id: 'settings',
      text: `Change ${countLabel(changedSettingCount, 'setting')}`,
    });
  }

  const mergeActions: Web_BackupView_BackupView_MergeActions = (preview !== null) ? preview['actions'] : [];

  for (const mergeAction of mergeActions) {
    reviewItems.push({
      id: `merge-${reviewItems.length}`,
      text: mergeAction,
    });
  }

  const noDataFound: Web_BackupView_BackupView_NoDataFound = torrentCount > 0 && dataMissingCount >= torrentCount;

  if (torrentCount > 0) {
    const recheckAmount: Web_BackupView_BackupView_RecheckAmount = (totalSizeBytes > 0) ? ` ${formatBytes(totalSizeBytes)}` : ' its data';
    let torrentReview: Web_BackupView_BackupView_TorrentReview = `Add ${countLabel(torrentCount, 'torrent')} paused, then re-check${recheckAmount} on disk`;

    if (noDataFound === true) {
      torrentReview = `Add ${countLabel(torrentCount, 'torrent')} paused`;
    }

    reviewItems.push({
      id: 'torrents',
      text: torrentReview,
    });
  }

  if (runningTorrentCount > 0 && noDataFound === false) {
    let runningReview: Web_BackupView_BackupView_RunningReview = 'Start the torrent that was running once its check finishes';

    if (runningTorrentCount > 1) {
      runningReview = 'Start each torrent that was running once its check finishes';
    }

    reviewItems.push({
      id: 'running-torrents',
      text: runningReview,
    });
  }

  if (alreadyPresentCount > 0) {
    const presentVerb: Web_BackupView_BackupView_PresentVerb = (alreadyPresentCount === 1) ? 'is' : 'are';

    reviewItems.push({
      id: 'present-torrents',
      text: `Skip ${countLabel(alreadyPresentCount, 'torrent')} that ${presentVerb} already here`,
    });
  }

  const reviewNotes: Web_BackupView_BackupView_ReviewNotes = [];

  if (nestingConflict === true) {
    reviewNotes.push({
      icon: 'warning',
      id: 'folder-overlap',
      text: 'Some profile folders would overlap. Go back to Folders and give each profile a folder of its own.',
    });
  }

  if (missingDefaultConnection === true) {
    reviewNotes.push({
      icon: 'warning',
      id: 'default-connection',
      text: 'Add and test a default VPN connection before importing torrents.',
    });
  }

  if (dataMissingCount > 0) {
    let dataMissingNote: Web_BackupView_BackupView_DataMissingNote = `No data was found for ${countLabel(dataMissingCount, 'torrent')}. They stay as Data missing until their files are in the mapped folders.`;

    if (dataMissingCount < torrentCount) {
      dataMissingNote = `No data was found for ${dataMissingCount} of ${countLabel(torrentCount, 'torrent')}. Those stay as Data missing until their files are in the mapped folders.`;
    }

    reviewNotes.push({
      icon: 'warning',
      id: 'data-missing',
      text: dataMissingNote,
    });
  }

  if (torrentCount > 0 && dataMissingCount < torrentCount) {
    reviewNotes.push({
      icon: 'clock',
      id: 'recheck-time',
      text: `Re-checking may take ${recheckTime}. You can close this dialog while it runs.`,
    });
  }

  if (preview !== null && preview['hasRemoteLogins'] === false) {
    let remoteLoginNote: Web_BackupView_BackupView_RemoteLoginNote = 'This export has no RPC logins. Add one afterwards for each remote app that needs it.';

    if (importSource === 'another-transmission') {
      remoteLoginNote = 'Afterwards, add an RPC login for each app that used the old Transmission and paste it into that app.';
    }

    reviewNotes.push({
      icon: 'key',
      id: 'remote-logins',
      text: remoteLoginNote,
    });
  }

  let progressSummary: Web_BackupView_BackupView_ProgressSummary = undefined;

  if (importJob !== null) {
    const progressSummaryParts: Web_BackupView_BackupView_ProgressSummaryParts = [];
    const torrentTotal: Web_BackupView_BackupView_TorrentTotal = importJob['totalTorrents'];
    const profileTotal: Web_BackupView_BackupView_ProfileTotal = summaryNumber(importJob['summary'], 'profileCount');
    const settingTotal: Web_BackupView_BackupView_SettingTotal = summaryNumber(importJob['summary'], 'settingCount');

    if (torrentTotal > 0) {
      progressSummaryParts.push(countLabel(torrentTotal, 'torrent'));
    }

    if (profileTotal > 0) {
      progressSummaryParts.push(countLabel(profileTotal, 'profile'));
    }

    if (settingTotal > 0) {
      progressSummaryParts.push(countLabel(settingTotal, 'setting'));
    }

    const progressActions: Web_BackupView_BackupView_ProgressActions = summaryStrings(importJob['summary'], 'actions');

    for (const progressAction of progressActions) {
      progressSummaryParts.push(progressAction);
    }

    progressSummary = progressSummaryParts.join(' · ');
  }

  let progressRemaining: Web_BackupView_BackupView_ProgressRemaining = undefined;

  if (
    importJob !== null
    && importJob['status'] !== 'completed'
    && importJob['status'] !== 'failed'
  ) {
    let remainingSeconds: Web_BackupView_BackupView_RemainingSeconds = Math.max(30, summaryNumber(importJob['summary'], 'totalSizeBytes') / (80 * 1024 * 1024));

    if (importJob['completedTorrents'] > 0 && importJob['startedAt'] !== null) {
      const elapsedSeconds: Web_BackupView_BackupView_ElapsedSeconds = Math.max(1, (Date.now() - Date.parse(importJob['startedAt'])) / 1000);

      remainingSeconds = elapsedSeconds / importJob['completedTorrents'] * (importJob['totalTorrents'] - importJob['completedTorrents']);
    }

    const duration: Web_BackupView_BackupView_Duration = formatDuration(remainingSeconds);

    progressRemaining = `${duration.charAt(0).toUpperCase()}${duration.slice(1)} left`;
  }

  /**
   * Backup View - Refresh Export Preview.
   *
   * Re-checks an export file's profile folders after a folder or Replace/Keep choice
   * changes, so folders that would overlap stay listed until each has its own.
   *
   * @param {Web_BackupView_BackupView_RefreshExportPreview_NextMappings} nextMappings - Next mappings.
   * @param {Web_BackupView_BackupView_RefreshExportPreview_NextActions}  nextActions  - Next actions.
   *
   * @returns {Web_BackupView_BackupView_RefreshExportPreview_Returns}
   *
   * @since 2.0.0
   */
  const refreshExportPreview: Web_BackupView_BackupView_RefreshExportPreview = async (
    nextMappings: Web_BackupView_BackupView_RefreshExportPreview_NextMappings,
    nextActions: Web_BackupView_BackupView_RefreshExportPreview_NextActions,
  ): Web_BackupView_BackupView_RefreshExportPreview_Returns => {
    if (document === null) {
      return;
    }

    try {
      setPreview(await previewBackupImport(document, nextMappings, nextActions));
    } catch (caughtError) {
      setSourceError((caughtError instanceof Error) ? caughtError.message : 'The import could not be checked again.');
    }

    return;
  };

  /**
   * Backup View - Refresh Mapped Folder.
   *
   * Stores a destination choice and asks mounted sources to recount visible data.
   * Export imports keep their already-computed binary found-or-missing state.
   *
   * @param {Web_BackupView_BackupView_RefreshMappedFolder_SourcePath} sourcePath - Source path.
   * @param {Web_BackupView_BackupView_RefreshMappedFolder_Path}       path       - Path.
   *
   * @returns {Web_BackupView_BackupView_RefreshMappedFolder_Returns}
   *
   * @since 2.0.0
   */
  const refreshMappedFolder: Web_BackupView_BackupView_RefreshMappedFolder = (sourcePath: Web_BackupView_BackupView_RefreshMappedFolder_SourcePath, path: Web_BackupView_BackupView_RefreshMappedFolder_Path): Web_BackupView_BackupView_RefreshMappedFolder_Returns => {
    const nextMappings: Web_BackupView_BackupView_RefreshMappedFolder_NextMappings = {
      ...folderMappings,
      [sourcePath]: path,
    };

    setFolderMappings(nextMappings);

    if (importSource === 'another-transmission') {
      void inspectAnotherTransmission(configPath, nextMappings, false);
    } else {
      void refreshExportPreview(nextMappings, profileActions);
    }

    return;
  };

  const authenticatorEnabled: Web_BackupView_BackupView_AuthenticatorEnabled = (security !== null) ? security['totpEnabled'] : false;
  const shellBusy: Web_BackupView_BackupView_ShellBusy = sourceBusy === true && step !== 'source';
  const shellOpen: Web_BackupView_BackupView_ShellOpen = (
    wizardOpen === true
    && folderPicker === null
    && sourcePickerOpen === false
  );
  const sourceCardClassName: Web_BackupView_BackupView_SourceCardClassName = (importSource === 'another-transmission') ? 'backup-source-card is-selected' : 'backup-source-card';
  const sourceDetails: Web_BackupView_BackupView_SourceDetails = (preview !== null) ? preview['sourceDetails'] : undefined;
  const incompleteDirectory: Web_BackupView_BackupView_IncompleteDirectory = (sourceDetails !== undefined) ? sourceDetails['incompleteDirectory'] : undefined;
  const folderPickerInitialPath: Web_BackupView_BackupView_FolderPickerInitialPath = (folderPicker !== null) ? folderPicker['initialPath'] : '/data';
  const folderPickerPurpose: Web_BackupView_BackupView_FolderPickerPurpose = (folderPicker !== null) ? folderPicker['purpose'] : undefined;
  const sourcePickerInitialPath: Web_BackupView_BackupView_SourcePickerInitialPath = (configPath !== '') ? configPath : '/';

  return (
    <>
      <BackupSection
        description="Save this setup to a file, or bring one in. You can also import from another Transmission."
        importJob={runningImport}
        onExport={() => {
          void openExport();

          return;
        }}
        onImport={openImport}
        onOpenImport={openImport}
        rowLabel="Export and import"
        title="Backup"
      />

      <BackupExportDialog
        authenticatorEnabled={authenticatorEnabled}
        description="Choose what to save in this export."
        onClose={() => setExportOpen(false)}
        onConfirm={async (password, code) => confirmBackupOperation('export', password, code)}
        onExport={async (selection, grant) => {
          const sections: Web_BackupView_BackupView_Sections = {
            labels: selection['labels'] ?? false,
            notifications: selection['notifications'] ?? false,
            remoteAccess: selection['remoteAccess'] ?? false,
            settingsAndProfiles: selection['settingsAndProfiles'] ?? false,
            torrents: selection['torrents'] ?? false,
            vpnConnections: selection['vpnConnections'] ?? false,
          };

          await downloadBackupExport(sections, grant);

          showToast('Export downloaded.', true);

          return;
        }}
        onPasskey={async () => confirmBackupOperationWithPasskey('export')}
        open={exportOpen}
        options={exportOptions}
        passkeyAvailable={passkeyAvailable}
        secretWarning="The file includes passwords and keys in plain text. Keep it somewhere safe."
        title="Export"
      />

      <BackupImportWizardShell
        backDisabled={step === 'source' || step === 'importing'}
        busy={shellBusy}
        currentStep={(step === 'confirm') ? 'review' : step}
        description={(step === 'importing') ? 'You can close this dialog without stopping the import.' : 'Bring settings and torrents into this Transmission.'}
        hideNavigation={step === 'confirm' || step === 'importing'}
        nextDisabled={nextDisabled}
        nextIcon={(step === 'review') ? 'upload' : undefined}
        nextLabel={(step === 'review') ? 'Import' : 'Next'}
        onBack={() => moveStep(-1)}
        onClose={closeWizard}
        onNext={next}
        open={shellOpen}
        steps={steps}
        title="Import"
      >
        {(step !== 'source') ? null : (
          <div className="backup-source-grid">
            <BackupFileSource
              busy={sourceBusy}
              description="A JSON file made from this Backup section."
              fileName={fileName}
              label="An export file"
              name="backup-source"
              onFileChange={(event) => {
                void chooseFile(event);

                return;
              }}
              onSelect={() => selectSource('transmission-vpn-export')}
              selected={importSource === 'transmission-vpn-export'}
            />

            <label className={sourceCardClassName}>
              <input checked={importSource === 'another-transmission'} className="backup-source-radio" name="backup-source" onChange={() => selectSource('another-transmission')} type="radio" />
              <span className="backup-source-card-heading">
                <Icon name="folder" size={22} />
                <span>
                  <strong>Another Transmission</strong>
                  <p>Its config folder, mounted into this container. It holds settings.json, torrents and resume.</p>
                </span>
              </span>
              <span className="backup-config-folder-field">
                <input
                  aria-label="Config folder"
                  disabled={sourceBusy}
                  onBlur={() => {
                    if (importSource === 'another-transmission') {
                      void inspectAnotherTransmission(configPath, {}, true);
                    }

                    return;
                  }}
                  onChange={(event) => setConfigPath(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();

                      void inspectAnotherTransmission(configPath, {}, true);
                    }

                    return;
                  }}
                  spellCheck={false}
                  type="text"
                  value={configPath}
                />
                <Button disabled={sourceBusy} onClick={() => setSourcePickerOpen(true)}>Browse</Button>
              </span>
              {(importSource !== 'another-transmission' || sourceDetails === undefined) ? null : (
                <span className="backup-source-check is-valid">
                  <Icon name="check" size={16} />
                  {`Transmission ${sourceDetails['version']} · ${sourceDetails['settingsFile']} · ${countLabel(sourceDetails['torrentCount'], 'torrent')} · nothing in it will be changed`}
                </span>
              )}
            </label>
            {(sourceBusy === true) ? (
              <p className="backup-source-status">
                <span className="spinner" />
                {' '}
                Checking source…
              </p>
            ) : null}
            {(sourceError === '') ? null : <div className="form-error" role="alert">{sourceError}</div>}
            {(missingDefaultConnection === false) ? null : (
              <div className="backup-review-note" role="alert">
                <Icon name="warning" size={18} />
                <span>{`Torrents need a VPN connection to run, so add a default VPN connection on the VPN page before importing ${countLabel(previewTorrentCount, 'torrent')}.`}</span>
              </div>
            )}
          </div>
        )}

        {(step !== 'folders' || preview === null) ? null : (
          <div className="dialog-body backup-step-body">
            <div>
              <h3>Folders</h3>
              <p className="dialog-message">Map each folder to an existing folder here. Data is checked by each torrent’s top-level file or folder.</p>
            </div>
            <div className="backup-progress-table-wrap backup-compare-table-wrap">
              <table className="backup-compare-table backup-folder-table">
                <thead>
                  <tr>
                    <th>There</th>
                    <th>Here</th>
                    <th>Data found</th>
                  </tr>
                </thead>
                <tbody>
                  {preview['folders'].map((folder) => {
                    const mapping: Web_BackupView_BackupView_Mapping = (
                      folderMappings[folder['sourcePath']]
                      ?? folder['mappedPath']
                      ?? ''
                    );
                    let dataLabel: Web_BackupView_BackupView_DataLabel = 'Not found';

                    if (folder['dataFoundStatus'] === 'empty' && (folder['torrentCount'] ?? 0) > 0) {
                      dataLabel = 'In incomplete folder';
                    } else if (folder['dataFoundStatus'] === 'empty') {
                      dataLabel = 'Empty';
                    } else if ((folder['dataTotal'] ?? 0) > 0) {
                      dataLabel = `${folder['dataFoundCount'] ?? 0} of ${folder['dataTotal'] ?? 0}`;
                    } else if (folder['dataFound'] === true) {
                      dataLabel = 'Found';
                    }

                    const mappingTarget: Web_BackupView_BackupView_MappingTarget = mapping.replace(trailingSlashesPattern, '').toLowerCase();

                    return (
                      <tr key={folder['sourcePath']}>
                        <td data-label="There">
                          <code>{folder['sourcePath']}</code>
                          {(folder['description'] === undefined) ? null : <small>{folder['description']}</small>}
                        </td>
                        <td data-label="Here">
                          <span className="backup-folder-field">
                            <code aria-label={`Folder here for ${folder['sourcePath']}`} className="backup-folder-path" data-empty={(mapping === '') ? 'true' : undefined}>{(mapping === '') ? 'No folder chosen' : mapping}</code>
                            <Button onClick={() => setFolderPicker({
                              initialPath: (mapping !== '') ? mapping : '/data',
                              purpose: folderPurpose(folder),
                              sourcePath: folder['sourcePath'],
                            })}
                            >
                              Browse…
                            </Button>
                          </span>
                          {(folder['kind'] === 'incomplete' || sharedTargets.has(mappingTarget) === false) ? null : (
                            <small className="field-error" role="alert">Another folder is mapped here too. Each folder needs its own.</small>
                          )}
                          {((folder['conflict'] ?? '') === '') ? null : (
                            <small className="field-error" role="alert">{folder['conflict']}</small>
                          )}
                        </td>
                        <td className={`backup-data-status is-${folder['dataFoundStatus'] ?? 'not-found'}`} data-label="Data found">{dataLabel}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(step !== 'profiles' || preview === null) ? null : (
          <div className="dialog-body backup-step-body">
            <div>
              <h3>Profiles</h3>
              <p className="dialog-message">Each download folder becomes a profile and follows the default VPN connection unless you choose another.</p>
            </div>
            <div className="backup-progress-table-wrap backup-compare-table-wrap">
              <table className="backup-compare-table backup-profile-table">
                <thead>
                  <tr>
                    <th>Folder</th>
                    <th>Profile</th>
                    <th>{(importSource === 'another-transmission') ? 'VPN connection' : 'Here'}</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {preview['profiles'].map((profile) => {
                    const sourcePath: Web_BackupView_BackupView_SourcePath = profile['sourcePath'] ?? '';
                    const included: Web_BackupView_BackupView_Included = profile['empty'] !== true || profileIncluded[sourcePath] !== false;

                    return (
                      <tr className={(included === false) ? 'is-muted' : ''} key={profile['id']}>
                        <td data-label="Folder">
                          {(sourcePath === '') ? profile['name'] : <code>{sourcePath}</code>}
                          {(profile['note'] === undefined) ? null : <small>{profile['note']}</small>}
                        </td>
                        <td data-label="Profile">
                          {(profile['default'] === true) ? (
                            <span className="backup-default-profile">
                              <strong>{profile['name']}</strong>
                              <span className="tag">Default</span>
                            </span>
                          ) : (
                            <span className="backup-profile-name-field">
                              {(profile['empty'] !== true) ? null : (
                                <input
                                  aria-label={`Create profile for ${sourcePath}`}
                                  checked={included}
                                  onChange={(event) => {
                                    const nextIncluded: Web_BackupView_BackupView_NextIncluded = event.currentTarget.checked;

                                    setProfileIncluded((current) => ({
                                      ...current,
                                      [sourcePath]: nextIncluded,
                                    }));

                                    return;
                                  }}
                                  type="checkbox"
                                />
                              )}
                              {(importSource === 'another-transmission') ? (
                                <input
                                  aria-label={`Profile name for ${sourcePath}`}
                                  disabled={included === false}
                                  onChange={(event) => {
                                    const nextName: Web_BackupView_BackupView_NextName = event.currentTarget.value;

                                    setProfileNames((current) => ({
                                      ...current,
                                      [sourcePath]: nextName,
                                    }));

                                    return;
                                  }}
                                  value={profileNames[sourcePath] ?? profile['name']}
                                />
                              ) : profile['name']}
                            </span>
                          )}
                        </td>
                        <td data-label={(importSource === 'another-transmission') ? 'VPN connection' : 'Here'}>
                          {(importSource === 'another-transmission') ? (
                            <select
                              aria-label={`VPN connection for ${profile['name']}`}
                              className="select-control"
                              disabled={profile['default'] === true || included === false}
                              onChange={(event) => {
                                const nextConnection: Web_BackupView_BackupView_NextConnection = (event.currentTarget.value !== '') ? event.currentTarget.value : null;

                                setProfileConnections((current) => ({
                                  ...current,
                                  [sourcePath]: nextConnection,
                                }));

                                return;
                              }}
                              value={profileConnections[sourcePath] ?? ''}
                            >
                              <option value="">Follow default connection</option>
                              {preview['connections'].map((connection) => <option key={connection['id']} value={connection['id']}>{connection['name']}</option>)}
                            </select>
                          ) : (profile['existingName'] ?? 'New profile')}
                        </td>
                        <td data-label="Action">
                          {(included === false) ? 'Skip' : null}
                          {(included === true && profile['default'] === true) ? 'Update in place' : null}
                          {(
                            included === true
                            && profile['default'] === false
                            && profile['existingId'] === null
                          ) ? 'Add' : null}
                          {(
                            included === true
                            && profile['default'] === false
                            && profile['existingId'] !== null
                          ) ? (
                                <select
                                  aria-label={`Action for ${profile['name']}`}
                                  className="select-control"
                                  onChange={(event) => {
                                    const nextActions: Web_BackupView_BackupView_NextActions = {
                                      ...profileActions,
                                      [profile['id']]: event.currentTarget.value as Web_BackupView_BackupView_ProfileAction,
                                    };

                                    setProfileActions(nextActions);

                                    if (importSource !== 'another-transmission') {
                                      void refreshExportPreview(folderMappings, nextActions);
                                    }

                                    return;
                                  }}
                                  value={profileActions[profile['id']] ?? 'replace'}
                                >
                                  <option value="replace">Replace</option>
                                  <option value="keep">Keep this one</option>
                                </select>
                              ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {(importSource !== 'another-transmission' || incompleteDirectory === undefined) ? null : (
              <p className="backup-incomplete-note">{`The incomplete folder becomes ${folderMappings[incompleteDirectory] ?? incompleteDirectory}, so unfinished downloads continue in place.`}</p>
            )}
          </div>
        )}

        {(step !== 'settings' || preview === null) ? null : (
          <BackupSettingsCompare
            description="Review what changes and what remains as it is here."
            excludedItems={settingsExcludedItems}
            fileColumn={(importSource === 'another-transmission') ? 'Old Transmission' : 'In the file'}
            rows={settingRows}
          />
        )}

        {(step !== 'review' || preview === null) ? null : (
          <BackupReviewList items={reviewItems} notes={reviewNotes} />
        )}

        {(step !== 'confirm') ? null : (
          <ConfirmIdentityStep
            authenticatorEnabled={authenticatorEnabled}
            description="Confirm the current account before applying this import."
            onBack={() => setStep('review')}
            onConfirm={async (password, code) => confirmBackupOperation('import', password, code)}
            onConfirmed={startImport}
            onPasskey={async () => confirmBackupOperationWithPasskey('import')}
            passkeyAvailable={passkeyAvailable}
          />
        )}

        {(step !== 'importing' || progressJob === null) ? null : (
          <BackupImportProgress
            applyingLabel="Applying settings and profiles…"
            contextColumn="Profile"
            headingSummary={progressSummary}
            itemColumn="Torrent"
            job={progressJob}
            onBackground={closeWizard}
            onDone={() => {
              setWizardOpen(false);
              setImportJob(null);
              resetWizard();

              return;
            }}
            progressLabel={(completed, total) => `Re-checked ${completed} of ${total}`}
            remainingLabel={progressRemaining}
          />
        )}
      </BackupImportWizardShell>

      <DirectoryBrowserDialog
        initialPath={folderPickerInitialPath}
        onClose={() => setFolderPicker(null)}
        onSelect={(path) => {
          if (folderPicker !== null) {
            refreshMappedFolder(folderPicker['sourcePath'], path);
          }

          setFolderPicker(null);

          return;
        }}
        open={folderPicker !== null}
        profileId={(folderPickerPurpose === 'profile') ? 'new' : undefined}
        purpose={folderPickerPurpose ?? 'download'}
      />

      <BackupSourceDirectoryDialog
        initialPath={sourcePickerInitialPath}
        onClose={() => setSourcePickerOpen(false)}
        onSelect={(path) => {
          setConfigPath(path);
          setSourcePickerOpen(false);
          setImportSource('another-transmission');

          void inspectAnotherTransmission(path, {}, true);

          return;
        }}
        open={sourcePickerOpen}
      />
    </>
  );
};
