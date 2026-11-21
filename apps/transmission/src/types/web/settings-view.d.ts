import type {
  Dispatch,
  ReactElement,
  RefObject,
  SetStateAction,
} from 'react';

import type {
  Web_Api_BlocklistStatus,
  Web_Api_JsonValue,
  Web_Api_Setting,
} from '@/types/web/api.d.ts';
import type {
  Web_Components_SettingsView_Drafts,
  Web_Components_SettingsView_Props,
} from '@/types/web/components.d.ts';

/**
 * Settings View.
 *
 * @since 2.4.1
 */
export type Web_SettingsView_AllTorrentKeys = string[];

/**
 * Settings View.
 *
 * @since 2.4.1
 */
export type Web_SettingsView_BlocklistKeys = string[];

/**
 * Settings View.
 *
 * @since 2.4.1
 */
export type Web_SettingsView_DiagnosticKeys = string[];

/**
 * Settings View.
 *
 * @since 2.4.1
 */
export type Web_SettingsView_NetworkKeys = string[];

/**
 * Settings View.
 *
 * @since 2.4.1
 */
export type Web_SettingsView_SelectSettings_Settings = Web_Api_Setting[];
export type Web_SettingsView_SelectSettings_Keys = string[];
export type Web_SettingsView_SelectSettings_Returns = Web_Api_Setting[];

/**
 * Settings View.
 *
 * @since 2.4.1
 */
export type Web_SettingsView_SettingsView_Props = Web_Components_SettingsView_Props;
export type Web_SettingsView_SettingsView_Returns = ReactElement;
export type Web_SettingsView_SettingsView_OnDirtyChange = Web_Components_SettingsView_Props['onDirtyChange'];
export type Web_SettingsView_SettingsView_OnRestartTransmission = Web_Components_SettingsView_Props['onRestartTransmission'];
export type Web_SettingsView_SettingsView_OnSave = Web_Components_SettingsView_Props['onSave'];
export type Web_SettingsView_SettingsView_Snapshot = Web_Components_SettingsView_Props['snapshot'];
export type Web_SettingsView_SettingsView_DraftsState = [Web_Components_SettingsView_Drafts, Dispatch<SetStateAction<Web_Components_SettingsView_Drafts>>];
export type Web_SettingsView_SettingsView_Drafts = Web_Components_SettingsView_Drafts;
export type Web_SettingsView_SettingsView_SetDrafts = Dispatch<SetStateAction<Web_Components_SettingsView_Drafts>>;
export type Web_SettingsView_SettingsView_SavingState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_SettingsView_SettingsView_Saving = boolean;
export type Web_SettingsView_SettingsView_SetSaving = Dispatch<SetStateAction<boolean>>;
export type Web_SettingsView_SettingsView_SaveErrorState = [unknown, Dispatch<SetStateAction<unknown>>];
export type Web_SettingsView_SettingsView_SaveError = unknown;
export type Web_SettingsView_SettingsView_SetSaveError = Dispatch<SetStateAction<unknown>>;
export type Web_SettingsView_SettingsView_RestartDialogOpenState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_SettingsView_SettingsView_RestartDialogOpen = boolean;
export type Web_SettingsView_SettingsView_SetRestartDialogOpen = Dispatch<SetStateAction<boolean>>;
export type Web_SettingsView_SettingsView_RestartingState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_SettingsView_SettingsView_Restarting = boolean;
export type Web_SettingsView_SettingsView_SetRestarting = Dispatch<SetStateAction<boolean>>;
export type Web_SettingsView_SettingsView_RestartErrorState = [unknown, Dispatch<SetStateAction<unknown>>];
export type Web_SettingsView_SettingsView_RestartError = unknown;
export type Web_SettingsView_SettingsView_SetRestartError = Dispatch<SetStateAction<unknown>>;
export type Web_SettingsView_SettingsView_ListEditorVersionState = [number, Dispatch<SetStateAction<number>>];
export type Web_SettingsView_SettingsView_ListEditorVersion = number;
export type Web_SettingsView_SettingsView_SetListEditorVersion = Dispatch<SetStateAction<number>>;
export type Web_SettingsView_SettingsView_BlocklistStatusState = [Web_Api_BlocklistStatus | null, Dispatch<SetStateAction<Web_Api_BlocklistStatus | null>>];
export type Web_SettingsView_SettingsView_BlocklistStatus = Web_Api_BlocklistStatus | null;
export type Web_SettingsView_SettingsView_SetBlocklistStatus = Dispatch<SetStateAction<Web_Api_BlocklistStatus | null>>;
export type Web_SettingsView_SettingsView_BlocklistStatusErrorState = [string, Dispatch<SetStateAction<string>>];
export type Web_SettingsView_SettingsView_BlocklistStatusError = string;
export type Web_SettingsView_SettingsView_SetBlocklistStatusError = Dispatch<SetStateAction<string>>;
export type Web_SettingsView_SettingsView_BlocklistUpdatePendingState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_SettingsView_SettingsView_BlocklistUpdatePending = boolean;
export type Web_SettingsView_SettingsView_SetBlocklistUpdatePending = Dispatch<SetStateAction<boolean>>;
export type Web_SettingsView_SettingsView_Flag = boolean;
export type Web_SettingsView_SettingsView_BlocklistMountedRef = RefObject<boolean>;
export type Web_SettingsView_SettingsView_BlocklistStatusRequestRunningRef = RefObject<boolean>;
export type Web_SettingsView_SettingsView_Attempt = string | null | undefined;
export type Web_SettingsView_SettingsView_BlocklistUpdateBaselineAttemptRef = RefObject<string | null | undefined>;
export type Web_SettingsView_SettingsView_BlocklistUpdateObservedRef = RefObject<boolean>;
export type Web_SettingsView_SettingsView_BlocklistUpdatePollingRef = RefObject<boolean>;
export type Web_SettingsView_SettingsView_BlocklistState = Web_Api_BlocklistStatus['state'] | undefined;
export type Web_SettingsView_SettingsView_SnapshotSettings = Web_Api_Setting[];
export type Web_SettingsView_SettingsView_VisibleSettings = Web_Api_Setting[];
export type Web_SettingsView_SettingsView_RefreshBlocklistStatus_Returns = Promise<void>;
export type Web_SettingsView_SettingsView_RefreshBlocklistStatus = () => Web_SettingsView_SettingsView_RefreshBlocklistStatus_Returns;
export type Web_SettingsView_SettingsView_NextStatus = Web_Api_BlocklistStatus;
export type Web_SettingsView_SettingsView_NextAttempt = string | null | undefined;
export type Web_SettingsView_SettingsView_RapidPolling = boolean;
export type Web_SettingsView_SettingsView_PollInterval = number;
export type Web_SettingsView_SettingsView_PollTimer = number;
export type Web_SettingsView_SettingsView_NextDrafts = Web_Components_SettingsView_Drafts;
export type Web_SettingsView_SettingsView_Changes = Record<string, Web_Api_JsonValue>;
export type Web_SettingsView_SettingsView_DraftValue = Web_Api_JsonValue;
export type Web_SettingsView_SettingsView_ChangeCount = number;
export type Web_SettingsView_SettingsView_Dirty = boolean;
export type Web_SettingsView_SettingsView_BlocklistEnabledSetting = Web_Api_Setting | undefined;
export type Web_SettingsView_SettingsView_BlocklistEnabledValue = Web_Api_JsonValue | undefined;
export type Web_SettingsView_SettingsView_BlocklistsEnabled = boolean;
export type Web_SettingsView_SettingsView_Warn_Event = BeforeUnloadEvent;
export type Web_SettingsView_SettingsView_Warn_Returns = void;
export type Web_SettingsView_SettingsView_Warn = (event: Web_SettingsView_SettingsView_Warn_Event) => Web_SettingsView_SettingsView_Warn_Returns;
export type Web_SettingsView_SettingsView_UpdateDraft_Key = string;
export type Web_SettingsView_SettingsView_UpdateDraft_Value = Web_Api_JsonValue;
export type Web_SettingsView_SettingsView_UpdateDraft_Returns = void;
export type Web_SettingsView_SettingsView_UpdateDraft = (key: Web_SettingsView_SettingsView_UpdateDraft_Key, value: Web_SettingsView_SettingsView_UpdateDraft_Value) => Web_SettingsView_SettingsView_UpdateDraft_Returns;
export type Web_SettingsView_SettingsView_Save_Returns = Promise<void>;
export type Web_SettingsView_SettingsView_Save = () => Web_SettingsView_SettingsView_Save_Returns;
export type Web_SettingsView_SettingsView_Save_ShownFieldIssue = boolean;
export type Web_SettingsView_SettingsView_UpdateBlocklists_Returns = Promise<void>;
export type Web_SettingsView_SettingsView_UpdateBlocklists = () => Web_SettingsView_SettingsView_UpdateBlocklists_Returns;
export type Web_SettingsView_SettingsView_Restart_Returns = Promise<void>;
export type Web_SettingsView_SettingsView_Restart = () => Web_SettingsView_SettingsView_Restart_Returns;
export type Web_SettingsView_SettingsView_ResetDrafts_Returns = void;
export type Web_SettingsView_SettingsView_ResetDrafts = () => Web_SettingsView_SettingsView_ResetDrafts_Returns;
export type Web_SettingsView_SettingsView_ResetDrafts_NextDrafts = Web_Components_SettingsView_Drafts;
export type Web_SettingsView_SettingsView_RenderInput_Setting = Web_Api_Setting;
export type Web_SettingsView_SettingsView_RenderInput_Returns = ReactElement;
export type Web_SettingsView_SettingsView_RenderInput = (setting: Web_SettingsView_SettingsView_RenderInput_Setting) => Web_SettingsView_SettingsView_RenderInput_Returns;
export type Web_SettingsView_SettingsView_RenderInput_Value = Web_Api_JsonValue;
export type Web_SettingsView_SettingsView_RenderInput_StringValues = string[];
export type Web_SettingsView_SettingsView_RenderSetting_Setting = Web_Api_Setting;
export type Web_SettingsView_SettingsView_RenderSetting_Returns = ReactElement;
export type Web_SettingsView_SettingsView_RenderSetting = (setting: Web_SettingsView_SettingsView_RenderSetting_Setting) => Web_SettingsView_SettingsView_RenderSetting_Returns;
export type Web_SettingsView_SettingsView_RenderSetting_Notes = string[];
export type Web_SettingsView_SettingsView_RenderSetting_FieldIssue = string;
export type Web_SettingsView_SettingsView_RenderSetting_RowClassNames = string[];
export type Web_SettingsView_SettingsView_GlobalSettings = Web_Api_Setting[];
export type Web_SettingsView_SettingsView_NetworkSettings = Web_Api_Setting[];
export type Web_SettingsView_SettingsView_BlocklistSettings = Web_Api_Setting[];
export type Web_SettingsView_SettingsView_DiagnosticSettings = Web_Api_Setting[];
export type Web_SettingsView_SettingsView_PendingRestartTitles = string[];
export type Web_SettingsView_SettingsView_RestartSummary = string;
export type Web_SettingsView_SettingsView_BlocklistSummary = string;
export type Web_SettingsView_SettingsView_BlocklistLastUpdated = string | null;
export type Web_SettingsView_SettingsView_BlocklistNextUpdate = string | null;
export type Web_SettingsView_SettingsView_BlocklistUpdating = boolean;
export type Web_SettingsView_SettingsView_BlocklistUpdateDisabled = boolean;
export type Web_SettingsView_SettingsView_BlocklistUpdateBusyClass = string;
export type Web_SettingsView_SettingsView_ChangeNoun = string;

/**
 * Settings View.
 *
 * @since 2.4.1
 */
export type Web_SettingsView_VisibleSettingKeys = string[];
