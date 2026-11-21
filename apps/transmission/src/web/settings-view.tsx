import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  getBlocklistStatus,
  issueFor,
  requestBlocklistUpdate,
  summaryFor,
} from '@/web/api.ts';
import { BackupView } from '@/web/backup-view.tsx';
import {
  formatBlocklistLastUpdated,
  formatBlocklistNextUpdate,
  formatBlocklistSummary,
} from '@/web/blocklist-status.ts';
import { ConfirmDialog } from '@/web/confirm-dialog.tsx';
import {
  Button,
  Icon,
} from '@/web/primitives.tsx';
import { SettingsDirectoryField } from '@/web/settings-directory-field.tsx';
import { SettingsListEditor } from '@/web/settings-list-editor.tsx';
import { showToast } from '@/web/toast.ts';

import type {
  Web_SettingsView_AllTorrentKeys,
  Web_SettingsView_BlocklistKeys,
  Web_SettingsView_DiagnosticKeys,
  Web_SettingsView_NetworkKeys,
  Web_SettingsView_SelectSettings_Keys,
  Web_SettingsView_SelectSettings_Returns,
  Web_SettingsView_SelectSettings_Settings,
  Web_SettingsView_SettingsView_Attempt,
  Web_SettingsView_SettingsView_BlocklistEnabledSetting,
  Web_SettingsView_SettingsView_BlocklistEnabledValue,
  Web_SettingsView_SettingsView_BlocklistLastUpdated,
  Web_SettingsView_SettingsView_BlocklistMountedRef,
  Web_SettingsView_SettingsView_BlocklistNextUpdate,
  Web_SettingsView_SettingsView_BlocklistsEnabled,
  Web_SettingsView_SettingsView_BlocklistSettings,
  Web_SettingsView_SettingsView_BlocklistState,
  Web_SettingsView_SettingsView_BlocklistStatus,
  Web_SettingsView_SettingsView_BlocklistStatusError,
  Web_SettingsView_SettingsView_BlocklistStatusErrorState,
  Web_SettingsView_SettingsView_BlocklistStatusRequestRunningRef,
  Web_SettingsView_SettingsView_BlocklistStatusState,
  Web_SettingsView_SettingsView_BlocklistSummary,
  Web_SettingsView_SettingsView_BlocklistUpdateBaselineAttemptRef,
  Web_SettingsView_SettingsView_BlocklistUpdateBusyClass,
  Web_SettingsView_SettingsView_BlocklistUpdateDisabled,
  Web_SettingsView_SettingsView_BlocklistUpdateObservedRef,
  Web_SettingsView_SettingsView_BlocklistUpdatePending,
  Web_SettingsView_SettingsView_BlocklistUpdatePendingState,
  Web_SettingsView_SettingsView_BlocklistUpdatePollingRef,
  Web_SettingsView_SettingsView_BlocklistUpdating,
  Web_SettingsView_SettingsView_ChangeCount,
  Web_SettingsView_SettingsView_ChangeNoun,
  Web_SettingsView_SettingsView_Changes,
  Web_SettingsView_SettingsView_DiagnosticSettings,
  Web_SettingsView_SettingsView_Dirty,
  Web_SettingsView_SettingsView_Drafts,
  Web_SettingsView_SettingsView_DraftsState,
  Web_SettingsView_SettingsView_DraftValue,
  Web_SettingsView_SettingsView_Flag,
  Web_SettingsView_SettingsView_GlobalSettings,
  Web_SettingsView_SettingsView_ListEditorVersion,
  Web_SettingsView_SettingsView_ListEditorVersionState,
  Web_SettingsView_SettingsView_NetworkSettings,
  Web_SettingsView_SettingsView_NextAttempt,
  Web_SettingsView_SettingsView_NextDrafts,
  Web_SettingsView_SettingsView_NextStatus,
  Web_SettingsView_SettingsView_OnDirtyChange,
  Web_SettingsView_SettingsView_OnRestartTransmission,
  Web_SettingsView_SettingsView_OnSave,
  Web_SettingsView_SettingsView_PendingRestartTitles,
  Web_SettingsView_SettingsView_PollInterval,
  Web_SettingsView_SettingsView_PollTimer,
  Web_SettingsView_SettingsView_Props,
  Web_SettingsView_SettingsView_RapidPolling,
  Web_SettingsView_SettingsView_RefreshBlocklistStatus,
  Web_SettingsView_SettingsView_RefreshBlocklistStatus_Returns,
  Web_SettingsView_SettingsView_RenderInput,
  Web_SettingsView_SettingsView_RenderInput_Returns,
  Web_SettingsView_SettingsView_RenderInput_Setting,
  Web_SettingsView_SettingsView_RenderInput_StringValues,
  Web_SettingsView_SettingsView_RenderInput_Value,
  Web_SettingsView_SettingsView_RenderSetting,
  Web_SettingsView_SettingsView_RenderSetting_FieldIssue,
  Web_SettingsView_SettingsView_RenderSetting_Notes,
  Web_SettingsView_SettingsView_RenderSetting_Returns,
  Web_SettingsView_SettingsView_RenderSetting_RowClassNames,
  Web_SettingsView_SettingsView_RenderSetting_Setting,
  Web_SettingsView_SettingsView_ResetDrafts,
  Web_SettingsView_SettingsView_ResetDrafts_NextDrafts,
  Web_SettingsView_SettingsView_ResetDrafts_Returns,
  Web_SettingsView_SettingsView_Restart,
  Web_SettingsView_SettingsView_Restart_Returns,
  Web_SettingsView_SettingsView_RestartDialogOpen,
  Web_SettingsView_SettingsView_RestartDialogOpenState,
  Web_SettingsView_SettingsView_RestartError,
  Web_SettingsView_SettingsView_RestartErrorState,
  Web_SettingsView_SettingsView_Restarting,
  Web_SettingsView_SettingsView_RestartingState,
  Web_SettingsView_SettingsView_RestartSummary,
  Web_SettingsView_SettingsView_Returns,
  Web_SettingsView_SettingsView_Save,
  Web_SettingsView_SettingsView_Save_Returns,
  Web_SettingsView_SettingsView_Save_ShownFieldIssue,
  Web_SettingsView_SettingsView_SaveError,
  Web_SettingsView_SettingsView_SaveErrorState,
  Web_SettingsView_SettingsView_Saving,
  Web_SettingsView_SettingsView_SavingState,
  Web_SettingsView_SettingsView_SetBlocklistStatus,
  Web_SettingsView_SettingsView_SetBlocklistStatusError,
  Web_SettingsView_SettingsView_SetBlocklistUpdatePending,
  Web_SettingsView_SettingsView_SetDrafts,
  Web_SettingsView_SettingsView_SetListEditorVersion,
  Web_SettingsView_SettingsView_SetRestartDialogOpen,
  Web_SettingsView_SettingsView_SetRestartError,
  Web_SettingsView_SettingsView_SetRestarting,
  Web_SettingsView_SettingsView_SetSaveError,
  Web_SettingsView_SettingsView_SetSaving,
  Web_SettingsView_SettingsView_Snapshot,
  Web_SettingsView_SettingsView_SnapshotSettings,
  Web_SettingsView_SettingsView_UpdateBlocklists,
  Web_SettingsView_SettingsView_UpdateBlocklists_Returns,
  Web_SettingsView_SettingsView_UpdateDraft,
  Web_SettingsView_SettingsView_UpdateDraft_Key,
  Web_SettingsView_SettingsView_UpdateDraft_Returns,
  Web_SettingsView_SettingsView_UpdateDraft_Value,
  Web_SettingsView_SettingsView_VisibleSettings,
  Web_SettingsView_SettingsView_Warn,
  Web_SettingsView_SettingsView_Warn_Event,
  Web_SettingsView_SettingsView_Warn_Returns,
  Web_SettingsView_VisibleSettingKeys,
} from '@/types/web/settings-view.d.ts';

/**
 * Settings View - All Torrent Keys.
 *
 * Keeps global torrent settings ahead of the dedicated network and blocklist rows.
 * They apply to every torrent regardless of profile selection.
 *
 * @since 2.0.0
 */
const allTorrentKeys: Web_SettingsView_AllTorrentKeys = [
  'transmission.incompleteDirectoryEnabled',
  'transmission.incompleteDirectory',
  'transmission.downloadQueueEnabled',
  'transmission.downloadQueueSize',
  'transmission.peerLimitGlobal',
];

/**
 * Settings View - Network Keys.
 *
 * Preserves the peer port range order used by the server registry.
 * The range bounds stay directly below the random-port switch.
 *
 * @since 2.0.0
 */
const networkKeys: Web_SettingsView_NetworkKeys = [
  'transmission.peerPortRandomOnStart',
  'transmission.peerPortRandomLow',
  'transmission.peerPortRandomHigh',
];

/**
 * Settings View - Blocklist Keys.
 *
 * Keeps the blocklist switch before its source list.
 * The two controls remain adjacent in the global group.
 *
 * @since 2.0.0
 */
const blocklistKeys: Web_SettingsView_BlocklistKeys = [
  'transmission.blocklistEnabled',
  'transmission.blocklistSources',
  'transmission.blocklistUpdateIntervalHours',
];

/**
 * Settings View - Diagnostic Keys.
 *
 * Keeps debug logging last, after every setting that changes how torrents run.
 * It isn't a Transmission setting, so it stays out of the torrent groups above.
 *
 * @since 2.1.0
 */
const diagnosticKeys: Web_SettingsView_DiagnosticKeys = ['diagnostics.debugLogging'];

/**
 * Settings View - Visible Setting Keys.
 *
 * Limits this screen to global Transmission settings that are not owned by a
 * torrent profile, plus debug logging.
 *
 * @since 2.0.0
 */
const visibleSettingKeys: Web_SettingsView_VisibleSettingKeys = [
  ...allTorrentKeys,
  ...networkKeys,
  ...blocklistKeys,
  ...diagnosticKeys,
];

/**
 * Settings View - Select Settings.
 *
 * Returns settings in a requested key order while ignoring missing registry entries.
 * This lets older backends omit a definition without breaking the page.
 *
 * @param {Web_SettingsView_SelectSettings_Settings} settings - Settings.
 * @param {Web_SettingsView_SelectSettings_Keys}     keys     - Keys.
 *
 * @returns {Web_SettingsView_SelectSettings_Returns}
 *
 * @since 2.0.0
 */
const selectSettings = (settings: Web_SettingsView_SelectSettings_Settings, keys: Web_SettingsView_SelectSettings_Keys): Web_SettingsView_SelectSettings_Returns => {
  return keys
    .map((key) => settings.find(
      (setting) => setting['key'] === key,
    ))
    .filter((setting) => setting !== undefined);
};

/**
 * Settings View - Settings View.
 *
 * Edits global Transmission defaults while VPN and RPC settings remain on their
 * dedicated screens.
 *
 * @param {Web_SettingsView_SettingsView_Props} props - Props.
 *
 * @returns {Web_SettingsView_SettingsView_Returns}
 *
 * @since 2.0.0
 */
export const SettingsView = (props: Web_SettingsView_SettingsView_Props): Web_SettingsView_SettingsView_Returns => {
  const onDirtyChange: Web_SettingsView_SettingsView_OnDirtyChange = props['onDirtyChange'];
  const onRestartTransmission: Web_SettingsView_SettingsView_OnRestartTransmission = props['onRestartTransmission'];
  const onSave: Web_SettingsView_SettingsView_OnSave = props['onSave'];
  const snapshot: Web_SettingsView_SettingsView_Snapshot = props['snapshot'];
  const draftsState: Web_SettingsView_SettingsView_DraftsState = useState<Web_SettingsView_SettingsView_Drafts>({});
  const drafts: Web_SettingsView_SettingsView_Drafts = draftsState[0];
  const setDrafts: Web_SettingsView_SettingsView_SetDrafts = draftsState[1];
  const savingState: Web_SettingsView_SettingsView_SavingState = useState<Web_SettingsView_SettingsView_Saving>(false);
  const saving: Web_SettingsView_SettingsView_Saving = savingState[0];
  const setSaving: Web_SettingsView_SettingsView_SetSaving = savingState[1];
  const saveErrorState: Web_SettingsView_SettingsView_SaveErrorState = useState<Web_SettingsView_SettingsView_SaveError>(null);
  const saveError: Web_SettingsView_SettingsView_SaveError = saveErrorState[0];
  const setSaveError: Web_SettingsView_SettingsView_SetSaveError = saveErrorState[1];
  const restartDialogOpenState: Web_SettingsView_SettingsView_RestartDialogOpenState = useState<Web_SettingsView_SettingsView_RestartDialogOpen>(false);
  const restartDialogOpen: Web_SettingsView_SettingsView_RestartDialogOpen = restartDialogOpenState[0];
  const setRestartDialogOpen: Web_SettingsView_SettingsView_SetRestartDialogOpen = restartDialogOpenState[1];
  const restartingState: Web_SettingsView_SettingsView_RestartingState = useState<Web_SettingsView_SettingsView_Restarting>(false);
  const restarting: Web_SettingsView_SettingsView_Restarting = restartingState[0];
  const setRestarting: Web_SettingsView_SettingsView_SetRestarting = restartingState[1];
  const restartErrorState: Web_SettingsView_SettingsView_RestartErrorState = useState<Web_SettingsView_SettingsView_RestartError>(null);
  const restartError: Web_SettingsView_SettingsView_RestartError = restartErrorState[0];
  const setRestartError: Web_SettingsView_SettingsView_SetRestartError = restartErrorState[1];
  const listEditorVersionState: Web_SettingsView_SettingsView_ListEditorVersionState = useState<Web_SettingsView_SettingsView_ListEditorVersion>(0);
  const listEditorVersion: Web_SettingsView_SettingsView_ListEditorVersion = listEditorVersionState[0];
  const setListEditorVersion: Web_SettingsView_SettingsView_SetListEditorVersion = listEditorVersionState[1];
  const blocklistStatusState: Web_SettingsView_SettingsView_BlocklistStatusState = useState<Web_SettingsView_SettingsView_BlocklistStatus>(null);
  const blocklistStatus: Web_SettingsView_SettingsView_BlocklistStatus = blocklistStatusState[0];
  const setBlocklistStatus: Web_SettingsView_SettingsView_SetBlocklistStatus = blocklistStatusState[1];
  const blocklistStatusErrorState: Web_SettingsView_SettingsView_BlocklistStatusErrorState = useState<Web_SettingsView_SettingsView_BlocklistStatusError>('');
  const blocklistStatusError: Web_SettingsView_SettingsView_BlocklistStatusError = blocklistStatusErrorState[0];
  const setBlocklistStatusError: Web_SettingsView_SettingsView_SetBlocklistStatusError = blocklistStatusErrorState[1];
  const blocklistUpdatePendingState: Web_SettingsView_SettingsView_BlocklistUpdatePendingState = useState<Web_SettingsView_SettingsView_BlocklistUpdatePending>(false);
  const blocklistUpdatePending: Web_SettingsView_SettingsView_BlocklistUpdatePending = blocklistUpdatePendingState[0];
  const setBlocklistUpdatePending: Web_SettingsView_SettingsView_SetBlocklistUpdatePending = blocklistUpdatePendingState[1];
  const blocklistMountedRef: Web_SettingsView_SettingsView_BlocklistMountedRef = useRef<Web_SettingsView_SettingsView_Flag>(false);
  const blocklistStatusRequestRunningRef: Web_SettingsView_SettingsView_BlocklistStatusRequestRunningRef = useRef<Web_SettingsView_SettingsView_Flag>(false);
  const blocklistUpdateBaselineAttemptRef: Web_SettingsView_SettingsView_BlocklistUpdateBaselineAttemptRef = useRef<Web_SettingsView_SettingsView_Attempt>(undefined);
  const blocklistUpdateObservedRef: Web_SettingsView_SettingsView_BlocklistUpdateObservedRef = useRef<Web_SettingsView_SettingsView_Flag>(false);
  const blocklistUpdatePollingRef: Web_SettingsView_SettingsView_BlocklistUpdatePollingRef = useRef<Web_SettingsView_SettingsView_Flag>(false);
  const blocklistState: Web_SettingsView_SettingsView_BlocklistState = (blocklistStatus === null) ? undefined : blocklistStatus['state'];

  const snapshotSettings: Web_SettingsView_SettingsView_SnapshotSettings = (snapshot === null) ? [] : snapshot['settings'];
  const visibleSettings: Web_SettingsView_SettingsView_VisibleSettings = snapshotSettings.filter(
    (setting) => visibleSettingKeys.includes(setting['key']),
  );

  /**
   * Settings View - Refresh Blocklist Status.
   *
   * Reads one merger snapshot without overlapping a request already in flight.
   * Manual updates keep fast polling until a completed attempt is observed.
   *
   * @returns {Web_SettingsView_SettingsView_RefreshBlocklistStatus_Returns}
   *
   * @since 2.0.0
   */
  const refreshBlocklistStatus: Web_SettingsView_SettingsView_RefreshBlocklistStatus = useCallback(async (): Web_SettingsView_SettingsView_RefreshBlocklistStatus_Returns => {
    if (blocklistStatusRequestRunningRef.current === true) {
      return;
    }

    blocklistStatusRequestRunningRef.current = true;
    try {
      const nextStatus: Web_SettingsView_SettingsView_NextStatus = await getBlocklistStatus();
      if (blocklistMountedRef.current === false) {
        return;
      }

      setBlocklistStatus(nextStatus);
      setBlocklistStatusError('');

      if (blocklistUpdatePollingRef.current === true) {
        if (nextStatus['state'] === 'updating') {
          blocklistUpdateObservedRef.current = true;
        }

        const nextAttempt: Web_SettingsView_SettingsView_NextAttempt = nextStatus['lastAttemptAt'];
        if (
          nextStatus['state'] !== 'updating'
          && (
            blocklistUpdateObservedRef.current === true
            || (
              nextAttempt !== null
              && nextAttempt !== undefined
              && nextAttempt !== blocklistUpdateBaselineAttemptRef.current
            )
          )
        ) {
          blocklistUpdatePollingRef.current = false;
          setBlocklistUpdatePending(false);
        }
      }
    } catch {
      if (blocklistMountedRef.current === true) {
        setBlocklistStatusError('Blocklist status could not be loaded.');
      }
    } finally {
      blocklistStatusRequestRunningRef.current = false;
    }

    return;
  }, []);

  useEffect(() => {
    blocklistMountedRef.current = true;
    void refreshBlocklistStatus();

    return () => {
      blocklistMountedRef.current = false;

      return;
    };
  }, [refreshBlocklistStatus]);

  useEffect(() => {
    const rapidPolling: Web_SettingsView_SettingsView_RapidPolling = blocklistUpdatePending || blocklistState === 'updating';
    const pollInterval: Web_SettingsView_SettingsView_PollInterval = (rapidPolling === true) ? 3_000 : 60_000;
    const pollTimer: Web_SettingsView_SettingsView_PollTimer = window.setInterval(() => {
      void refreshBlocklistStatus();

      return;
    }, pollInterval);

    return () => window.clearInterval(pollTimer);
  }, [
    blocklistState,
    blocklistUpdatePending,
    refreshBlocklistStatus,
  ]);

  useEffect(() => {
    if (snapshot === null) {
      return;
    }

    const nextDrafts: Web_SettingsView_SettingsView_NextDrafts = {};

    for (const setting of visibleSettings) {
      Reflect.set(nextDrafts, setting['key'], setting['value']);
    }
    setDrafts(nextDrafts);
    setListEditorVersion((currentVersion) => currentVersion + 1);
    setSaveError(null);

    return;
  }, [snapshot]);

  const changes: Web_SettingsView_SettingsView_Changes = {};

  for (const setting of visibleSettings) {
    const draftValue: Web_SettingsView_SettingsView_DraftValue = drafts[setting['key']] ?? setting['value'];
    if (JSON.stringify(draftValue) !== JSON.stringify(setting['value'])) {
      Reflect.set(changes, setting['key'], draftValue);
    }
  }
  const changeCount: Web_SettingsView_SettingsView_ChangeCount = Object.keys(changes).length;
  const dirty: Web_SettingsView_SettingsView_Dirty = changeCount > 0;
  const blocklistEnabledSetting: Web_SettingsView_SettingsView_BlocklistEnabledSetting = visibleSettings.find(
    (setting) => setting['key'] === 'transmission.blocklistEnabled',
  );
  const blocklistEnabledValue: Web_SettingsView_SettingsView_BlocklistEnabledValue = (
    blocklistEnabledSetting === undefined
  ) ? undefined : drafts[blocklistEnabledSetting['key']] ?? blocklistEnabledSetting['value'];
  const blocklistsEnabled: Web_SettingsView_SettingsView_BlocklistsEnabled = blocklistEnabledValue === true;

  useEffect(() => {
    /**
     * Settings View - Warn.
     *
     * Keeps the browser's native data-loss warning while drafts are unsaved.
     * The listener is removed as soon as the page is clean.
     *
     * @param {Web_SettingsView_SettingsView_Warn_Event} event - Event.
     *
     * @returns {Web_SettingsView_SettingsView_Warn_Returns}
     *
     * @since 2.0.0
     */
    const warn: Web_SettingsView_SettingsView_Warn = (event: Web_SettingsView_SettingsView_Warn_Event): Web_SettingsView_SettingsView_Warn_Returns => {
      event.preventDefault();

      return;
    };

    if (dirty === true) {
      window.addEventListener('beforeunload', warn);
    }

    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    onDirtyChange(dirty);

    return () => onDirtyChange(false);
  }, [
    dirty,
    onDirtyChange,
  ]);

  /**
   * Settings View - Update Draft.
   *
   * Stores one edited value without changing the accepted snapshot.
   * Dirty state is derived from these drafts on every render.
   *
   * @param {Web_SettingsView_SettingsView_UpdateDraft_Key}   key   - Key.
   * @param {Web_SettingsView_SettingsView_UpdateDraft_Value} value - Value.
   *
   * @returns {Web_SettingsView_SettingsView_UpdateDraft_Returns}
   *
   * @since 2.0.0
   */
  const updateDraft: Web_SettingsView_SettingsView_UpdateDraft = (key: Web_SettingsView_SettingsView_UpdateDraft_Key, value: Web_SettingsView_SettingsView_UpdateDraft_Value): Web_SettingsView_SettingsView_UpdateDraft_Returns => {
    setSaveError(null);
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [key]: value,
    }));

    return;
  };

  /**
   * Settings View - Save.
   *
   * Applies every visible draft in one optimistic-revision transaction.
   * The accepted response immediately replaces the current snapshot.
   *
   * @returns {Web_SettingsView_SettingsView_Save_Returns}
   *
   * @since 2.0.0
   */
  const save: Web_SettingsView_SettingsView_Save = async (): Web_SettingsView_SettingsView_Save_Returns => {
    if (changeCount === 0) {
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await onSave(changes);
      await refreshBlocklistStatus();
      setListEditorVersion((currentVersion) => currentVersion + 1);
      showToast('Settings saved.', true);
    } catch (caughtError) {
      setSaveError(caughtError);
      const shownFieldIssue: Web_SettingsView_SettingsView_Save_ShownFieldIssue = visibleSettings.some((setting) => (
        issueFor(caughtError, `changes.${setting['key']}`) !== ''
      ));
      if (shownFieldIssue === false) {
        showToast((caughtError instanceof Error) ? caughtError.message : 'Settings could not be saved.', false);
      }
    } finally {
      setSaving(false);
    }

    return;
  };

  /**
   * Settings View - Update Blocklists.
   *
   * Queues a merger run and keeps the refresh icon busy while fast polling.
   * Field-less action errors follow the console rule and appear as a toast.
   *
   * @returns {Web_SettingsView_SettingsView_UpdateBlocklists_Returns}
   *
   * @since 2.0.0
   */
  const updateBlocklists: Web_SettingsView_SettingsView_UpdateBlocklists = async (): Web_SettingsView_SettingsView_UpdateBlocklists_Returns => {
    blocklistUpdateBaselineAttemptRef.current = (blocklistStatus === null) ? undefined : blocklistStatus['lastAttemptAt'];
    blocklistUpdateObservedRef.current = false;
    blocklistUpdatePollingRef.current = true;
    setBlocklistUpdatePending(true);

    try {
      await requestBlocklistUpdate();
      await refreshBlocklistStatus();
    } catch (caughtError) {
      blocklistUpdatePollingRef.current = false;
      setBlocklistUpdatePending(false);
      showToast((caughtError instanceof Error) ? caughtError.message : 'Blocklists could not be updated.', false);
    }

    return;
  };

  /**
   * Settings View - Restart.
   *
   * Applies accepted restart-impact settings and refreshes the snapshot through the app.
   * A successful refresh clears the pending notice.
   *
   * @returns {Web_SettingsView_SettingsView_Restart_Returns}
   *
   * @since 2.0.0
   */
  const restart: Web_SettingsView_SettingsView_Restart = async (): Web_SettingsView_SettingsView_Restart_Returns => {
    setRestarting(true);
    setRestartError(null);
    try {
      await onRestartTransmission();
      setRestartDialogOpen(false);
      showToast('Transmission is restarting.', true);
    } catch (caughtError) {
      setRestartError(caughtError);
    } finally {
      setRestarting(false);
    }

    return;
  };

  /**
   * Settings View - Reset Drafts.
   *
   * Restores every visible field to the accepted value.
   * Hidden VPN and RPC settings are never added to the drafts.
   *
   * @returns {Web_SettingsView_SettingsView_ResetDrafts_Returns}
   *
   * @since 2.0.0
   */
  const resetDrafts: Web_SettingsView_SettingsView_ResetDrafts = (): Web_SettingsView_SettingsView_ResetDrafts_Returns => {
    const nextDrafts: Web_SettingsView_SettingsView_ResetDrafts_NextDrafts = {};

    for (const setting of visibleSettings) {
      Reflect.set(nextDrafts, setting['key'], setting['value']);
    }
    setDrafts(nextDrafts);
    setListEditorVersion((currentVersion) => currentVersion + 1);
    setSaveError(null);

    return;
  };

  /**
   * Settings View - Render Input.
   *
   * Chooses the native control that matches one JSON setting value.
   * Locked settings reuse the same controls in a disabled state.
   *
   * @param {Web_SettingsView_SettingsView_RenderInput_Setting} setting - Setting.
   *
   * @returns {Web_SettingsView_SettingsView_RenderInput_Returns}
   *
   * @since 2.0.0
   */
  const renderInput: Web_SettingsView_SettingsView_RenderInput = (setting: Web_SettingsView_SettingsView_RenderInput_Setting): Web_SettingsView_SettingsView_RenderInput_Returns => {
    const value: Web_SettingsView_SettingsView_RenderInput_Value = drafts[setting['key']] ?? setting['value'];

    if (setting['key'] === 'transmission.incompleteDirectory') {
      return (
        <SettingsDirectoryField
          disabled={setting['locked']}
          onChange={(path) => updateDraft(setting['key'], path)}
          purpose="incomplete"
          title={setting['title']}
          value={(typeof value === 'string') ? value : ''}
        />
      );
    }

    if (typeof value === 'boolean') {
      return (
        <label className="switch-control">
          <input aria-label={setting['title']} checked={value} disabled={setting['locked']} onChange={(event) => updateDraft(setting['key'], event.currentTarget.checked)} type="checkbox" />
          <span className="switch-track"><span /></span>
        </label>
      );
    }

    if (typeof value === 'number') {
      if (setting['key'] === 'transmission.blocklistUpdateIntervalHours') {
        return (
          <label className="input-suffix blocklist-update-interval">
            <input
              aria-label={setting['title']}
              className="setting-input setting-input-number"
              disabled={setting['locked']}
              max="168"
              min="1"
              onChange={(event) => updateDraft(setting['key'], Number(event.currentTarget.value))}
              step="1"
              type="number"
              value={value}
            />
            <span>hours</span>
          </label>
        );
      }

      return (
        <input aria-label={setting['title']} className="setting-input setting-input-number" disabled={setting['locked']} onChange={(event) => updateDraft(setting['key'], Number(event.currentTarget.value))} step="1" type="number" value={value} />
      );
    }

    if (Array.isArray(value) === true) {
      const stringValues: Web_SettingsView_SettingsView_RenderInput_StringValues = value.filter((item) => typeof item === 'string');

      return (
        <SettingsListEditor
          blocklistStatus={blocklistStatus}
          blocklistsEnabled={blocklistsEnabled}
          disabled={setting['locked']}
          editorVersion={listEditorVersion}
          onChange={(values) => updateDraft(setting['key'], values)}
          settingKey={setting['key']}
          title={setting['title']}
          values={stringValues}
        />
      );
    }

    return (
      <input aria-label={setting['title']} className="setting-input" disabled={setting['locked']} onChange={(event) => updateDraft(setting['key'], event.currentTarget.value)} type="text" value={(typeof value === 'string') ? value : ''} />
    );
  };

  /**
   * Settings View - Render Setting.
   *
   * Preserves each setting's key, restart note, source note, and lock state.
   * The row structure matches both approved setting groups.
   *
   * @param {Web_SettingsView_SettingsView_RenderSetting_Setting} setting - Setting.
   *
   * @returns {Web_SettingsView_SettingsView_RenderSetting_Returns}
   *
   * @since 2.0.0
   */
  const renderSetting: Web_SettingsView_SettingsView_RenderSetting = (setting: Web_SettingsView_SettingsView_RenderSetting_Setting): Web_SettingsView_SettingsView_RenderSetting_Returns => {
    const notes: Web_SettingsView_SettingsView_RenderSetting_Notes = [];
    const fieldIssue: Web_SettingsView_SettingsView_RenderSetting_FieldIssue = issueFor(saveError, `changes.${setting['key']}`);
    const rowClassNames: Web_SettingsView_SettingsView_RenderSetting_RowClassNames = ['setting-row'];
    if (blocklistKeys.includes(setting['key']) === true) {
      rowClassNames.push('blocklist-setting-row');
    }
    if (setting['key'] === 'transmission.blocklistSources') {
      rowClassNames.push('blocklist-source-setting');
    }
    if (setting['applyImpact'] === 'transmission-restart') {
      notes.push('Transmission restart required');
    }
    if (
      (
        setting['source'] === 'user'
        || setting['source'] === 'managed-seed'
      )
      && setting['locked'] === false
    ) {
      notes.push('Changed from default');
    }

    return (
      <div className={rowClassNames.join(' ')} key={setting['key']}>
        <div className="setting-copy">
          <div className="setting-title">
            <span>{setting['title']}</span>
            {(setting['locked'] === true) ? <span className="tag" title={`Set by ${setting['source']} configuration`}>Locked</span> : null}
          </div>
          <p>{setting['description']}</p>
          <p className="setting-meta">
            <span className="mono">{setting['key']}</span>
            {notes.map((note) => <span key={note}>{`· ${note}`}</span>)}
          </p>
        </div>
        <div className="setting-control">
          {renderInput(setting)}
          {(fieldIssue === '') ? null : <small className="field-error">{fieldIssue}</small>}
        </div>
      </div>
    );
  };

  if (snapshot === null) {
    return (
      <div className="detail-loading">
        <span className="spinner" />
        Loading settings…
      </div>
    );
  }

  const globalSettings: Web_SettingsView_SettingsView_GlobalSettings = selectSettings(visibleSettings, allTorrentKeys);
  const networkSettings: Web_SettingsView_SettingsView_NetworkSettings = selectSettings(visibleSettings, networkKeys);
  const blocklistSettings: Web_SettingsView_SettingsView_BlocklistSettings = selectSettings(visibleSettings, blocklistKeys);
  const diagnosticSettings: Web_SettingsView_SettingsView_DiagnosticSettings = selectSettings(visibleSettings, diagnosticKeys);
  const pendingRestartTitles: Web_SettingsView_SettingsView_PendingRestartTitles = selectSettings(
    visibleSettings,
    snapshot['pendingRestartKeys'],
  ).map((setting) => setting['title']);
  const restartSummary: Web_SettingsView_SettingsView_RestartSummary = summaryFor(restartError, [], 'Transmission could not be restarted.');
  const blocklistSummary: Web_SettingsView_SettingsView_BlocklistSummary = (blocklistStatus === null) ? blocklistStatusError || 'Loading blocklist status…' : formatBlocklistSummary(blocklistStatus);
  const blocklistLastUpdated: Web_SettingsView_SettingsView_BlocklistLastUpdated = (blocklistStatus === null) ? null : formatBlocklistLastUpdated(blocklistStatus);
  const blocklistNextUpdate: Web_SettingsView_SettingsView_BlocklistNextUpdate = (blocklistStatus === null) ? null : formatBlocklistNextUpdate(blocklistStatus);
  const blocklistUpdating: Web_SettingsView_SettingsView_BlocklistUpdating = blocklistUpdatePending || blocklistState === 'updating';
  const blocklistUpdateDisabled: Web_SettingsView_SettingsView_BlocklistUpdateDisabled = (
    blocklistStatus === null
    || blocklistUpdating
    || blocklistStatus['state'] === 'disabled'
    || blocklistStatus['state'] === 'no-sources'
    || blocklistStatus['state'] === 'waiting-for-vpn'
  );
  const blocklistUpdateBusyClass: Web_SettingsView_SettingsView_BlocklistUpdateBusyClass = (blocklistUpdating === true) ? ' is-busy' : '';
  const changeNoun: Web_SettingsView_SettingsView_ChangeNoun = (changeCount === 1) ? 'change' : 'changes';

  return (
    <section className="workspace-section">
      <div className="workspace-heading">
        <h1>Settings</h1>
        <p>These are global settings.</p>
      </div>

      {(pendingRestartTitles.length === 0) ? null : (
        <div className="restart-notice">
          <div className="restart-notice-copy">
            <Icon name="warning" size={18} />
            <strong>{`Restart Transmission to apply: ${pendingRestartTitles.join(', ')}`}</strong>
          </div>
          <Button
            icon="refresh"
            onClick={() => {
              setRestartError(null);
              setRestartDialogOpen(true);

              return;
            }}
          >
            Restart Transmission
          </Button>
        </div>
      )}

      <div className="panel">
        <section className="form-section">
          <div className="setting-list">
            {globalSettings.map(renderSetting)}
            {networkSettings.map(renderSetting)}
            {blocklistSettings.map(renderSetting)}
            <div className="setting-row blocklist-setting-row blocklist-status-row">
              <div className="setting-copy blocklist-status-copy">
                <div className="setting-title"><span>Blocklist status</span></div>
                <p className="blocklist-status-summary">{blocklistSummary}</p>
                {(blocklistLastUpdated === null) ? null : <span className="blocklist-status-detail">{blocklistLastUpdated}</span>}
                {(blocklistNextUpdate === null) ? null : <span className="blocklist-status-detail">{blocklistNextUpdate}</span>}
              </div>
              <div className="setting-control">
                <button
                  aria-busy={blocklistUpdating}
                  className={`button button-secondary blocklist-update-button${blocklistUpdateBusyClass}`}
                  disabled={blocklistUpdateDisabled}
                  onClick={() => {
                    void updateBlocklists();

                    return;
                  }}
                  type="button"
                >
                  <Icon name="refresh" size={16} />
                  <span>Update now</span>
                </button>
              </div>
            </div>
            {diagnosticSettings.map(renderSetting)}
          </div>
        </section>
      </div>

      <BackupView />

      {(changeCount > 0) ? (
        <div className="save-bar" role="region" aria-label="Unsaved changes">
          <strong>{`${changeCount} unsaved ${changeNoun}`}</strong>
          <Button disabled={saving} onClick={resetDrafts}>Discard</Button>
          <Button
            disabled={saving}
            onClick={() => {
              void save();

              return;
            }}
            variant="primary"
          >
            {(saving === true) ? 'Saving…' : 'Save'}
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        busy={restarting}
        busyLabel="Restarting…"
        confirmLabel="Restart Transmission"
        error={restartSummary}
        message="Transmission pauses briefly while the accepted settings are applied."
        onCancel={() => setRestartDialogOpen(false)}
        onConfirm={() => {
          void restart();

          return;
        }}
        open={restartDialogOpen}
        title="Restart Transmission?"
        tone="primary"
      />
    </section>
  );
};
