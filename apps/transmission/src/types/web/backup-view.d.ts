import type {
  ChangeEvent,
  Dispatch,
  ReactElement,
  RefObject,
  SetStateAction,
} from 'react';

import type { Web_Api_AccountSecurity } from '@/types/web/api.d.ts';
import type {
  Web_BackupComponents_ExportOption,
  Web_BackupComponents_ImportProgressItem,
  Web_BackupComponents_ImportProgressJob,
  Web_BackupComponents_ImportProgressTone,
  Web_BackupComponents_ReviewItem,
  Web_BackupComponents_ReviewNote,
  Web_BackupComponents_RunningImport,
  Web_BackupComponents_SettingsCompareExcludedItem,
  Web_BackupComponents_SettingsCompareRow,
  Web_BackupComponents_WizardStep,
} from '@/types/web/backup-components.d.ts';
import type {
  Web_Backup_Document,
  Web_Backup_ExportSections,
  Web_Backup_ImportFolderPreview,
  Web_Backup_ImportItem,
  Web_Backup_ImportJob,
  Web_Backup_ImportPlan,
  Web_Backup_ImportPreview,
  Web_Backup_ImportProfilePreview,
  Web_Backup_ImportSettingPreview,
  Web_Backup_ImportSourcePreview,
} from '@/types/web/backup.d.ts';

/**
 * Backup View.
 *
 * @since 2.4.1
 */
export type Web_BackupView_BackupView_Returns = ReactElement;
export type Web_BackupView_BackupView_Security = Web_Api_AccountSecurity | null;
export type Web_BackupView_BackupView_SetSecurity = Dispatch<SetStateAction<Web_BackupView_BackupView_Security>>;
export type Web_BackupView_BackupView_SecurityState = [Web_BackupView_BackupView_Security, Web_BackupView_BackupView_SetSecurity];
export type Web_BackupView_BackupView_ExportOpen = boolean;
export type Web_BackupView_BackupView_SetExportOpen = Dispatch<SetStateAction<Web_BackupView_BackupView_ExportOpen>>;
export type Web_BackupView_BackupView_ExportOpenState = [Web_BackupView_BackupView_ExportOpen, Web_BackupView_BackupView_SetExportOpen];
export type Web_BackupView_BackupView_WizardOpen = boolean;
export type Web_BackupView_BackupView_SetWizardOpen = Dispatch<SetStateAction<Web_BackupView_BackupView_WizardOpen>>;
export type Web_BackupView_BackupView_WizardOpenState = [Web_BackupView_BackupView_WizardOpen, Web_BackupView_BackupView_SetWizardOpen];
export type Web_BackupView_BackupView_Step = 'source' | 'folders' | 'profiles' | 'settings' | 'review' | 'confirm' | 'importing';
export type Web_BackupView_BackupView_SetStep = Dispatch<SetStateAction<Web_BackupView_BackupView_Step>>;
export type Web_BackupView_BackupView_StepState = [Web_BackupView_BackupView_Step, Web_BackupView_BackupView_SetStep];
export type Web_BackupView_BackupView_ImportSource = 'another-transmission' | 'transmission-vpn-export';
export type Web_BackupView_BackupView_SetImportSource = Dispatch<SetStateAction<Web_BackupView_BackupView_ImportSource>>;
export type Web_BackupView_BackupView_ImportSourceState = [Web_BackupView_BackupView_ImportSource, Web_BackupView_BackupView_SetImportSource];
export type Web_BackupView_BackupView_Document = Web_Backup_Document | null;
export type Web_BackupView_BackupView_SetDocument = Dispatch<SetStateAction<Web_BackupView_BackupView_Document>>;
export type Web_BackupView_BackupView_DocumentState = [Web_BackupView_BackupView_Document, Web_BackupView_BackupView_SetDocument];
export type Web_BackupView_BackupView_FileName = string;
export type Web_BackupView_BackupView_SetFileName = Dispatch<SetStateAction<Web_BackupView_BackupView_FileName>>;
export type Web_BackupView_BackupView_FileNameState = [Web_BackupView_BackupView_FileName, Web_BackupView_BackupView_SetFileName];
export type Web_BackupView_BackupView_ConfigPath = string;
export type Web_BackupView_BackupView_SetConfigPath = Dispatch<SetStateAction<Web_BackupView_BackupView_ConfigPath>>;
export type Web_BackupView_BackupView_ConfigPathState = [Web_BackupView_BackupView_ConfigPath, Web_BackupView_BackupView_SetConfigPath];
export type Web_BackupView_BackupView_Preview = Web_Backup_ImportPreview | null;
export type Web_BackupView_BackupView_SetPreview = Dispatch<SetStateAction<Web_BackupView_BackupView_Preview>>;
export type Web_BackupView_BackupView_PreviewState = [Web_BackupView_BackupView_Preview, Web_BackupView_BackupView_SetPreview];
export type Web_BackupView_BackupView_FolderMappings = Record<string, string>;
export type Web_BackupView_BackupView_SetFolderMappings = Dispatch<SetStateAction<Web_BackupView_BackupView_FolderMappings>>;
export type Web_BackupView_BackupView_FolderMappingsState = [Web_BackupView_BackupView_FolderMappings, Web_BackupView_BackupView_SetFolderMappings];
export type Web_BackupView_BackupView_ProfileAction = 'replace' | 'keep';
export type Web_BackupView_BackupView_ProfileActions = Record<string, Web_BackupView_BackupView_ProfileAction>;
export type Web_BackupView_BackupView_SetProfileActions = Dispatch<SetStateAction<Web_BackupView_BackupView_ProfileActions>>;
export type Web_BackupView_BackupView_ProfileActionsState = [Web_BackupView_BackupView_ProfileActions, Web_BackupView_BackupView_SetProfileActions];
export type Web_BackupView_BackupView_ProfileNames = Record<string, string>;
export type Web_BackupView_BackupView_SetProfileNames = Dispatch<SetStateAction<Web_BackupView_BackupView_ProfileNames>>;
export type Web_BackupView_BackupView_ProfileNamesState = [Web_BackupView_BackupView_ProfileNames, Web_BackupView_BackupView_SetProfileNames];
export type Web_BackupView_BackupView_ProfileConnections = Record<string, string | null>;
export type Web_BackupView_BackupView_SetProfileConnections = Dispatch<SetStateAction<Web_BackupView_BackupView_ProfileConnections>>;
export type Web_BackupView_BackupView_ProfileConnectionsState = [Web_BackupView_BackupView_ProfileConnections, Web_BackupView_BackupView_SetProfileConnections];
export type Web_BackupView_BackupView_ProfileIncluded = Record<string, boolean>;
export type Web_BackupView_BackupView_SetProfileIncluded = Dispatch<SetStateAction<Web_BackupView_BackupView_ProfileIncluded>>;
export type Web_BackupView_BackupView_ProfileIncludedState = [Web_BackupView_BackupView_ProfileIncluded, Web_BackupView_BackupView_SetProfileIncluded];
export type Web_BackupView_BackupView_SourceBusy = boolean;
export type Web_BackupView_BackupView_SetSourceBusy = Dispatch<SetStateAction<Web_BackupView_BackupView_SourceBusy>>;
export type Web_BackupView_BackupView_SourceBusyState = [Web_BackupView_BackupView_SourceBusy, Web_BackupView_BackupView_SetSourceBusy];
export type Web_BackupView_BackupView_SourceError = string;
export type Web_BackupView_BackupView_SetSourceError = Dispatch<SetStateAction<Web_BackupView_BackupView_SourceError>>;
export type Web_BackupView_BackupView_SourceErrorState = [Web_BackupView_BackupView_SourceError, Web_BackupView_BackupView_SetSourceError];
export type Web_BackupView_BackupView_ImportJob = Web_Backup_ImportJob | null;
export type Web_BackupView_BackupView_SetImportJob = Dispatch<SetStateAction<Web_BackupView_BackupView_ImportJob>>;
export type Web_BackupView_BackupView_ImportJobState = [Web_BackupView_BackupView_ImportJob, Web_BackupView_BackupView_SetImportJob];
export type Web_BackupView_BackupView_FolderPicker = {
  initialPath: string;
  purpose: 'download' | 'incomplete' | 'profile';
  sourcePath: string;
} | null;
export type Web_BackupView_BackupView_SetFolderPicker = Dispatch<SetStateAction<Web_BackupView_BackupView_FolderPicker>>;
export type Web_BackupView_BackupView_FolderPickerState = [Web_BackupView_BackupView_FolderPicker, Web_BackupView_BackupView_SetFolderPicker];
export type Web_BackupView_BackupView_SourcePickerOpen = boolean;
export type Web_BackupView_BackupView_SetSourcePickerOpen = Dispatch<SetStateAction<Web_BackupView_BackupView_SourcePickerOpen>>;
export type Web_BackupView_BackupView_SourcePickerOpenState = [Web_BackupView_BackupView_SourcePickerOpen, Web_BackupView_BackupView_SetSourcePickerOpen];
export type Web_BackupView_BackupView_MountedRef = RefObject<boolean>;
export type Web_BackupView_BackupView_ImportJobId = string | undefined;
export type Web_BackupView_BackupView_ImportJobStatus = Web_Backup_ImportJob['status'] | undefined;
export type Web_BackupView_BackupView_Cancelled = boolean;
export type Web_BackupView_BackupView_Timer = number;
export type Web_BackupView_BackupView_LoadSecurity = () => Promise<Web_Api_AccountSecurity>;
export type Web_BackupView_BackupView_AccountSecurity = Web_Api_AccountSecurity;
export type Web_BackupView_BackupView_OpenExport_Returns = Promise<void>;
export type Web_BackupView_BackupView_OpenExport = () => Web_BackupView_BackupView_OpenExport_Returns;
export type Web_BackupView_BackupView_ResetWizard_Returns = void;
export type Web_BackupView_BackupView_ResetWizard = () => Web_BackupView_BackupView_ResetWizard_Returns;
export type Web_BackupView_BackupView_OpenImport_Returns = void;
export type Web_BackupView_BackupView_OpenImport = () => Web_BackupView_BackupView_OpenImport_Returns;
export type Web_BackupView_BackupView_CloseWizard_Returns = void;
export type Web_BackupView_BackupView_CloseWizard = () => Web_BackupView_BackupView_CloseWizard_Returns;
export type Web_BackupView_BackupView_InitializePreviewChoices_NextPreview = Web_Backup_ImportPreview;
export type Web_BackupView_BackupView_InitializePreviewChoices_Returns = void;
export type Web_BackupView_BackupView_InitializePreviewChoices = (nextPreview: Web_BackupView_BackupView_InitializePreviewChoices_NextPreview) => Web_BackupView_BackupView_InitializePreviewChoices_Returns;
export type Web_BackupView_BackupView_InitializePreviewChoices_Actions = Record<string, 'replace' | 'keep'>;
export type Web_BackupView_BackupView_InitializePreviewChoices_Names = Record<string, string>;
export type Web_BackupView_BackupView_InitializePreviewChoices_Connections = Record<string, string | null>;
export type Web_BackupView_BackupView_InitializePreviewChoices_Included = Record<string, boolean>;
export type Web_BackupView_BackupView_InspectAnotherTransmission_Path = string;
export type Web_BackupView_BackupView_InspectAnotherTransmission_Mappings = Record<string, string>;
export type Web_BackupView_BackupView_InspectAnotherTransmission_InitializeChoices = boolean;
export type Web_BackupView_BackupView_InspectAnotherTransmission_Returns = Promise<void>;
export type Web_BackupView_BackupView_InspectAnotherTransmission = (path: Web_BackupView_BackupView_InspectAnotherTransmission_Path, mappings: Web_BackupView_BackupView_InspectAnotherTransmission_Mappings, initializeChoices: Web_BackupView_BackupView_InspectAnotherTransmission_InitializeChoices) => Web_BackupView_BackupView_InspectAnotherTransmission_Returns;
export type Web_BackupView_BackupView_InspectAnotherTransmission_NextPreview = Web_Backup_ImportPreview;
export type Web_BackupView_BackupView_InspectAnotherTransmission_NextMappings = Record<string, string>;
export type Web_BackupView_BackupView_ChooseFile_Event = ChangeEvent<HTMLInputElement>;
export type Web_BackupView_BackupView_ChooseFile_Returns = Promise<void>;
export type Web_BackupView_BackupView_ChooseFile = (event: Web_BackupView_BackupView_ChooseFile_Event) => Web_BackupView_BackupView_ChooseFile_Returns;
export type Web_BackupView_BackupView_ChooseFile_Input = HTMLInputElement;
export type Web_BackupView_BackupView_ChooseFile_InputFiles = FileList | null;
export type Web_BackupView_BackupView_ChooseFile_File = File | undefined;
export type Web_BackupView_BackupView_ChooseFile_ParsedValue = unknown;
export type Web_BackupView_BackupView_ChooseFile_ParsedDocument = Web_Backup_Document;
export type Web_BackupView_BackupView_ChooseFile_NextPreview = Web_Backup_ImportPreview;
export type Web_BackupView_BackupView_SelectSource_Source = 'another-transmission' | 'transmission-vpn-export';
export type Web_BackupView_BackupView_SelectSource_Returns = void;
export type Web_BackupView_BackupView_SelectSource = (source: Web_BackupView_BackupView_SelectSource_Source) => Web_BackupView_BackupView_SelectSource_Returns;
export type Web_BackupView_BackupView_Steps = Web_BackupComponents_WizardStep[];
export type Web_BackupView_BackupView_AvailableSteps = Web_BackupComponents_WizardStep[];
export type Web_BackupView_BackupView_OrderedStepID = Web_BackupView_BackupView_Step;
export type Web_BackupView_BackupView_OrderedStepIDs = Web_BackupView_BackupView_OrderedStepID[];
export type Web_BackupView_BackupView_MoveStep_Offset = number;
export type Web_BackupView_BackupView_MoveStep_Returns = void;
export type Web_BackupView_BackupView_MoveStep = (offset: Web_BackupView_BackupView_MoveStep_Offset) => Web_BackupView_BackupView_MoveStep_Returns;
export type Web_BackupView_BackupView_MoveStep_Index = number;
export type Web_BackupView_BackupView_MoveStep_Target = Web_BackupView_BackupView_Step | undefined;
export type Web_BackupView_BackupView_SharedTargets = Set<string>;
export type Web_BackupView_BackupView_SeenTargets = Set<string>;
export type Web_BackupView_BackupView_PreviewFolders = Web_Backup_ImportFolderPreview[];
export type Web_BackupView_BackupView_Target = string;
export type Web_BackupView_BackupView_NestingConflict = boolean;
export type Web_BackupView_BackupView_FoldersMapped = boolean;
export type Web_BackupView_BackupView_MappingsComplete = boolean;
export type Web_BackupView_BackupView_ChoicesComplete = boolean;
export type Web_BackupView_BackupView_SourceReady = boolean;
export type Web_BackupView_BackupView_MissingDefaultConnection = boolean;
export type Web_BackupView_BackupView_NextDisabled = boolean;
export type Web_BackupView_BackupView_Next_Returns = void;
export type Web_BackupView_BackupView_Next = () => Web_BackupView_BackupView_Next_Returns;
export type Web_BackupView_BackupView_StartImport_Grant = string;
export type Web_BackupView_BackupView_StartImport_Returns = Promise<void>;
export type Web_BackupView_BackupView_StartImport = (grant: Web_BackupView_BackupView_StartImport_Grant) => Web_BackupView_BackupView_StartImport_Returns;
export type Web_BackupView_BackupView_StartImport_Plan = Web_Backup_ImportPlan | undefined;
export type Web_BackupView_BackupView_StartImport_Job = Web_Backup_ImportJob;
export type Web_BackupView_BackupView_PasskeyAvailable = boolean;
export type Web_BackupView_BackupView_RunningImport = Web_BackupComponents_RunningImport | null;
export type Web_BackupView_BackupView_RunningTitle = string;
export type Web_BackupView_BackupView_RunningDetail = string;
export type Web_BackupView_BackupView_ProgressJob = Web_BackupComponents_ImportProgressJob | null;
export type Web_BackupView_BackupView_ImportableSettings = Web_Backup_ImportSettingPreview[];
export type Web_BackupView_BackupView_SkippedSettings = Web_Backup_ImportSettingPreview[];
export type Web_BackupView_BackupView_SettingRows = Web_BackupComponents_SettingsCompareRow[];
export type Web_BackupView_BackupView_SettingsExcludedItems = Web_BackupComponents_SettingsCompareExcludedItem[];
export type Web_BackupView_BackupView_IncludedProfiles = Web_Backup_ImportProfilePreview[];
export type Web_BackupView_BackupView_TotalSizeBytes = number;
export type Web_BackupView_BackupView_AlreadyPresentCount = number;
export type Web_BackupView_BackupView_PreviewTorrentCount = number;
export type Web_BackupView_BackupView_TorrentCount = number;
export type Web_BackupView_BackupView_PreviewRunningTorrentCount = number | undefined;
export type Web_BackupView_BackupView_DocumentTorrents = Web_Backup_Document['torrents'];
export type Web_BackupView_BackupView_DocumentRunningTorrentCount = number | undefined;
export type Web_BackupView_BackupView_RunningTorrentCount = number;
export type Web_BackupView_BackupView_PreviewDataMissingCount = number | undefined;
export type Web_BackupView_BackupView_DataMissingCount = number;
export type Web_BackupView_BackupView_ChangedSettingCount = number;
export type Web_BackupView_BackupView_RecheckTime = string;
export type Web_BackupView_BackupView_ReviewItems = Web_BackupComponents_ReviewItem[];
export type Web_BackupView_BackupView_NamedProfiles = Web_Backup_ImportProfilePreview[];
export type Web_BackupView_BackupView_CreateCount = number;
export type Web_BackupView_BackupView_ReplaceCount = number;
export type Web_BackupView_BackupView_KeepCount = number;
export type Web_BackupView_BackupView_ProfileParts = string[];
export type Web_BackupView_BackupView_ReplaceVerb = string;
export type Web_BackupView_BackupView_KeepVerb = string;
export type Web_BackupView_BackupView_UpdateVerb = string;
export type Web_BackupView_BackupView_MergeActions = string[];
export type Web_BackupView_BackupView_NoDataFound = boolean;
export type Web_BackupView_BackupView_RecheckAmount = string;
export type Web_BackupView_BackupView_TorrentReview = string;
export type Web_BackupView_BackupView_RunningReview = string;
export type Web_BackupView_BackupView_PresentVerb = string;
export type Web_BackupView_BackupView_ReviewNotes = Web_BackupComponents_ReviewNote[];
export type Web_BackupView_BackupView_DataMissingNote = string;
export type Web_BackupView_BackupView_RemoteLoginNote = string;
export type Web_BackupView_BackupView_ProgressSummary = string | undefined;
export type Web_BackupView_BackupView_ProgressSummaryParts = string[];
export type Web_BackupView_BackupView_TorrentTotal = number;
export type Web_BackupView_BackupView_ProfileTotal = number;
export type Web_BackupView_BackupView_SettingTotal = number;
export type Web_BackupView_BackupView_ProgressActions = string[];
export type Web_BackupView_BackupView_ProgressRemaining = string | undefined;
export type Web_BackupView_BackupView_RemainingSeconds = number;
export type Web_BackupView_BackupView_ElapsedSeconds = number;
export type Web_BackupView_BackupView_Duration = string;
export type Web_BackupView_BackupView_RefreshExportPreview_NextMappings = Record<string, string>;
export type Web_BackupView_BackupView_RefreshExportPreview_NextActions = Record<string, string>;
export type Web_BackupView_BackupView_RefreshExportPreview_Returns = Promise<void>;
export type Web_BackupView_BackupView_RefreshExportPreview = (nextMappings: Web_BackupView_BackupView_RefreshExportPreview_NextMappings, nextActions: Web_BackupView_BackupView_RefreshExportPreview_NextActions) => Web_BackupView_BackupView_RefreshExportPreview_Returns;
export type Web_BackupView_BackupView_RefreshMappedFolder_SourcePath = string;
export type Web_BackupView_BackupView_RefreshMappedFolder_Path = string;
export type Web_BackupView_BackupView_RefreshMappedFolder_Returns = void;
export type Web_BackupView_BackupView_RefreshMappedFolder = (sourcePath: Web_BackupView_BackupView_RefreshMappedFolder_SourcePath, path: Web_BackupView_BackupView_RefreshMappedFolder_Path) => Web_BackupView_BackupView_RefreshMappedFolder_Returns;
export type Web_BackupView_BackupView_RefreshMappedFolder_NextMappings = Record<string, string>;
export type Web_BackupView_BackupView_AuthenticatorEnabled = boolean;
export type Web_BackupView_BackupView_ShellBusy = boolean;
export type Web_BackupView_BackupView_ShellOpen = boolean;
export type Web_BackupView_BackupView_SourceCardClassName = string;
export type Web_BackupView_BackupView_SourceDetails = Web_Backup_ImportSourcePreview | undefined;
export type Web_BackupView_BackupView_IncompleteDirectory = string | undefined;
export type Web_BackupView_BackupView_FolderPickerInitialPath = string;
export type Web_BackupView_BackupView_FolderPickerPurpose = 'download' | 'incomplete' | 'profile' | undefined;
export type Web_BackupView_BackupView_SourcePickerInitialPath = string;
export type Web_BackupView_BackupView_Sections = Web_Backup_ExportSections;
export type Web_BackupView_BackupView_Mapping = string;
export type Web_BackupView_BackupView_DataLabel = string;
export type Web_BackupView_BackupView_MappingTarget = string;
export type Web_BackupView_BackupView_SourcePath = string;
export type Web_BackupView_BackupView_Included = boolean;
export type Web_BackupView_BackupView_NextIncluded = boolean;
export type Web_BackupView_BackupView_NextName = string;
export type Web_BackupView_BackupView_NextConnection = string | null;
export type Web_BackupView_BackupView_NextActions = Record<string, Web_BackupView_BackupView_ProfileAction>;

/**
 * Backup View.
 *
 * @since 2.4.1
 */
export type Web_BackupView_CountLabel_Count = number;
export type Web_BackupView_CountLabel_Singular = string;
export type Web_BackupView_CountLabel_Plural = string;
export type Web_BackupView_CountLabel_Returns = string;
export type Web_BackupView_CountLabel_Noun = string;

/**
 * Backup View.
 *
 * @since 2.4.1
 */
export type Web_BackupView_EstimatedRecheckDuration_TorrentCount = number;
export type Web_BackupView_EstimatedRecheckDuration_TotalSizeBytes = number;
export type Web_BackupView_EstimatedRecheckDuration_Returns = string;
export type Web_BackupView_EstimatedRecheckDuration_Seconds = number;

/**
 * Backup View.
 *
 * @since 2.4.1
 */
export type Web_BackupView_ExportOptions = Web_BackupComponents_ExportOption[];

/**
 * Backup View.
 *
 * @since 2.4.1
 */
export type Web_BackupView_FolderPurpose_Folder = Web_Backup_ImportFolderPreview;
export type Web_BackupView_FolderPurpose_Returns = 'download' | 'incomplete' | 'profile';

/**
 * Backup View.
 *
 * @since 2.4.1
 */
export type Web_BackupView_FormatBytes_Bytes = number;
export type Web_BackupView_FormatBytes_Returns = string;
export type Web_BackupView_FormatBytes_Units = string[];
export type Web_BackupView_FormatBytes_Value = number;
export type Web_BackupView_FormatBytes_UnitIndex = number;
export type Web_BackupView_FormatBytes_Amount = number | string;

/**
 * Backup View.
 *
 * @since 2.4.1
 */
export type Web_BackupView_FormatDuration_Seconds = number;
export type Web_BackupView_FormatDuration_Returns = string;
export type Web_BackupView_FormatDuration_Minutes = number;
export type Web_BackupView_FormatDuration_Hours = number;

/**
 * Backup View.
 *
 * @since 2.4.1
 */
export type Web_BackupView_PresentImportItem_Item = Web_Backup_ImportItem;
export type Web_BackupView_PresentImportItem_Returns = Web_BackupComponents_ImportProgressItem;
export type Web_BackupView_PresentImportItem_Status = string;
export type Web_BackupView_PresentImportItem_Tone = Web_BackupComponents_ImportProgressTone;
export type Web_BackupView_PresentImportItem_Detail = string | undefined;

/**
 * Backup View.
 *
 * @since 2.4.1
 */
export type Web_BackupView_SettingValueLabel_SettingKey = string;
export type Web_BackupView_SettingValueLabel_Value = unknown;
export type Web_BackupView_SettingValueLabel_Returns = string;
export type Web_BackupView_SettingValueLabel_Queue = Record<string, unknown>;
export type Web_BackupView_SettingValueLabel_Size = number;
export type Web_BackupView_SettingValueLabel_Seeding = Record<string, unknown>;
export type Web_BackupView_SettingValueLabel_Limits = string[];
export type Web_BackupView_SettingValueLabel_SpeedLimits = Record<string, unknown>;
export type Web_BackupView_SettingValueLabel_Download = string;
export type Web_BackupView_SettingValueLabel_Upload = string;
export type Web_BackupView_SettingValueLabel_Blocklists = Record<string, unknown>;
export type Web_BackupView_SettingValueLabel_Sources = string[];
export type Web_BackupView_SettingValueLabel_Source = string;
export type Web_BackupView_SettingValueLabel_Incomplete = Record<string, unknown>;

/**
 * Backup View.
 *
 * @since 2.4.1
 */
export type Web_BackupView_SummaryNumber_Summary = Record<string, unknown>;
export type Web_BackupView_SummaryNumber_Key = string;
export type Web_BackupView_SummaryNumber_Returns = number;

/**
 * Backup View.
 *
 * @since 2.4.1
 */
export type Web_BackupView_SummaryStrings_Summary = Record<string, unknown>;
export type Web_BackupView_SummaryStrings_Key = string;
export type Web_BackupView_SummaryStrings_Returns = string[];
export type Web_BackupView_SummaryStrings_Value = unknown;

/**
 * Backup View.
 *
 * @since 2.4.1
 */
export type Web_BackupView_ValueRecord_Value = unknown;
export type Web_BackupView_ValueRecord_Returns = Record<string, unknown>;
export type Web_BackupView_ValueRecord_Narrowed = Record<string, unknown>;

/**
 * Backup View.
 *
 * @since 2.4.1
 */
export type Web_BackupView_ValuesDiffer_Left = unknown;
export type Web_BackupView_ValuesDiffer_Right = unknown;
export type Web_BackupView_ValuesDiffer_Returns = boolean;
