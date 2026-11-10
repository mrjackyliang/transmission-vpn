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

import type { ReactElement } from 'react';

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
 * Settings View - All torrent keys.
 *
 * Keeps global torrent settings ahead of the dedicated network and blocklist rows.
 * They apply to every torrent regardless of profile selection.
 *
 * @since 2.0.0
 */
const allTorrentKeys: string[] = [
  'transmission.incompleteDirectoryEnabled',
  'transmission.incompleteDirectory',
  'transmission.downloadQueueEnabled',
  'transmission.downloadQueueSize',
  'transmission.peerLimitGlobal',
];

/**
 * Settings View - Network keys.
 *
 * Preserves the peer port range order used by the server registry.
 * The range bounds stay directly below the random-port switch.
 *
 * @since 2.0.0
 */
const networkKeys: string[] = [
  'transmission.peerPortRandomOnStart',
  'transmission.peerPortRandomLow',
  'transmission.peerPortRandomHigh',
];

/**
 * Settings View - Blocklist keys.
 *
 * Keeps the blocklist switch before its source list.
 * The two controls remain adjacent in the global group.
 *
 * @since 2.0.0
 */
const blocklistKeys: string[] = [
  'transmission.blocklistEnabled',
  'transmission.blocklistSources',
  'transmission.blocklistUpdateIntervalHours',
];

/**
 * Settings View - Visible keys.
 *
 * Limits this screen to global Transmission settings that are not owned by a
 * torrent profile.
 *
 * @since 2.0.0
 */
const visibleSettingKeys: string[] = [
  ...allTorrentKeys,
  ...networkKeys,
  ...blocklistKeys,
];

/**
 * Settings View - Selects settings.
 *
 * Returns settings in a requested key order while ignoring missing registry entries.
 * This lets older backends omit a definition without breaking the page.
 *
 * @since 2.0.0
 */
const selectSettings = (settings: Web_Api_Setting[], keys: string[]): Web_Api_Setting[] => keys
  .map((key: string): Web_Api_Setting | undefined => settings.find(
    (setting: Web_Api_Setting): boolean => setting['key'] === key,
  ))
  .filter((setting: Web_Api_Setting | undefined): setting is Web_Api_Setting => setting !== undefined);

/**
 * Settings View.
 *
 * Edits global Transmission defaults while VPN and RPC settings remain on their
 * dedicated screens.
 *
 * @since 2.0.0
 */
export const SettingsView = ({
  onDirtyChange,
  onRestartTransmission,
  onSave,
  snapshot,
}: Web_Components_SettingsView_Props): ReactElement => {
  const [
    drafts,
    setDrafts,
  ] = useState<Web_Components_SettingsView_Drafts>({});
  const [
    saving,
    setSaving,
  ] = useState<boolean>(false);
  const [
    saveError,
    setSaveError,
  ] = useState<unknown>(null);
  const [
    restartDialogOpen,
    setRestartDialogOpen,
  ] = useState<boolean>(false);
  const [
    restarting,
    setRestarting,
  ] = useState<boolean>(false);
  const [
    restartError,
    setRestartError,
  ] = useState<unknown>(null);
  const [
    listEditorVersion,
    setListEditorVersion,
  ] = useState<number>(0);
  const [
    blocklistStatus,
    setBlocklistStatus,
  ] = useState<Web_Api_BlocklistStatus | null>(null);
  const [
    blocklistStatusError,
    setBlocklistStatusError,
  ] = useState<string>('');
  const [
    blocklistUpdatePending,
    setBlocklistUpdatePending,
  ] = useState<boolean>(false);
  const blocklistMountedRef = useRef<boolean>(false);
  const blocklistStatusRequestRunningRef = useRef<boolean>(false);
  const blocklistUpdateBaselineAttemptRef = useRef<string | null | undefined>(undefined);
  const blocklistUpdateObservedRef = useRef<boolean>(false);
  const blocklistUpdatePollingRef = useRef<boolean>(false);

  const visibleSettings: Web_Api_Setting[] = (snapshot?.['settings'] ?? []).filter(
    (setting: Web_Api_Setting): boolean => visibleSettingKeys.includes(setting['key']),
  );

  /**
   * Settings View - Refreshes blocklist status.
   *
   * Reads one merger snapshot without overlapping a request already in flight.
   * Manual updates keep fast polling until a completed attempt is observed.
   *
   * @returns {Promise<void>}
   *
   * @since 2.0.0
   */
  const refreshBlocklistStatus = useCallback(async (): Promise<void> => {
    if (blocklistStatusRequestRunningRef.current) {
      return;
    }

    blocklistStatusRequestRunningRef.current = true;
    try {
      const nextStatus: Web_Api_BlocklistStatus = await getBlocklistStatus();
      if (!blocklistMountedRef.current) {
        return;
      }

      setBlocklistStatus(nextStatus);
      setBlocklistStatusError('');

      if (blocklistUpdatePollingRef.current) {
        if (nextStatus['state'] === 'updating') {
          blocklistUpdateObservedRef.current = true;
        }

        const nextAttempt: string | null | undefined = nextStatus['lastAttemptAt'];
        if (
          nextStatus['state'] !== 'updating'
          && (
            blocklistUpdateObservedRef.current
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
      if (blocklistMountedRef.current) {
        setBlocklistStatusError('Blocklist status could not be loaded.');
      }
    } finally {
      blocklistStatusRequestRunningRef.current = false;
    }
  }, []);

  useEffect((): (() => void) => {
    blocklistMountedRef.current = true;
    void refreshBlocklistStatus();

    return (): void => {
      blocklistMountedRef.current = false;
    };
  }, [refreshBlocklistStatus]);

  useEffect((): (() => void) => {
    const rapidPolling: boolean = blocklistUpdatePending || blocklistStatus?.['state'] === 'updating';
    const pollInterval: number = (rapidPolling) ? 3_000 : 60_000;
    const pollTimer: number = window.setInterval((): void => {
      void refreshBlocklistStatus();
    }, pollInterval);

    return (): void => window.clearInterval(pollTimer);
  }, [
    blocklistStatus?.['state'],
    blocklistUpdatePending,
    refreshBlocklistStatus,
  ]);

  useEffect((): void => {
    if (snapshot === null) {
      return;
    }

    const nextDrafts: Web_Components_SettingsView_Drafts = {};
    for (const setting of visibleSettings) {
      Reflect.set(nextDrafts, setting['key'], setting['value']);
    }
    setDrafts(nextDrafts);
    setListEditorVersion((currentVersion: number): number => currentVersion + 1);
    setSaveError(null);
  }, [snapshot]);

  const changes: Record<string, Web_Api_JsonValue> = {};
  for (const setting of visibleSettings) {
    const draftValue: Web_Api_JsonValue = drafts[setting['key']] ?? setting['value'];
    if (JSON.stringify(draftValue) !== JSON.stringify(setting['value'])) {
      Reflect.set(changes, setting['key'], draftValue);
    }
  }
  const changeCount: number = Object.keys(changes).length;
  const dirty: boolean = changeCount > 0;
  const blocklistEnabledSetting: Web_Api_Setting | undefined = visibleSettings.find(
    (setting: Web_Api_Setting): boolean => setting['key'] === 'transmission.blocklistEnabled',
  );
  const blocklistEnabledValue: Web_Api_JsonValue | undefined = (
    blocklistEnabledSetting === undefined
  ) ? undefined : drafts[blocklistEnabledSetting['key']] ?? blocklistEnabledSetting['value'];
  const blocklistsEnabled: boolean = blocklistEnabledValue === true;

  useEffect((): (() => void) => {
    /**
     * Settings View - Warn.
     *
     * Keeps the browser's native data-loss warning while drafts are unsaved.
     * The listener is removed as soon as the page is clean.
     *
     * @since 2.0.0
     */
    const warn = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };

    if (dirty) {
      window.addEventListener('beforeunload', warn);
    }

    return (): void => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect((): (() => void) => {
    onDirtyChange(dirty);

    return (): void => onDirtyChange(false);
  }, [
    dirty,
    onDirtyChange,
  ]);

  /**
   * Settings View - Updates draft.
   *
   * Stores one edited value without changing the accepted snapshot.
   * Dirty state is derived from these drafts on every render.
   *
   * @since 2.0.0
   */
  const updateDraft = (key: string, value: Web_Api_JsonValue): void => {
    setSaveError(null);
    setDrafts((currentDrafts: Web_Components_SettingsView_Drafts): Web_Components_SettingsView_Drafts => ({
      ...currentDrafts,
      [key]: value,
    }));
  };

  /**
   * Settings View - Saves settings.
   *
   * Applies every visible draft in one optimistic-revision transaction.
   * The accepted response immediately replaces the current snapshot.
   *
   * @since 2.0.0
   */
  const save = async (): Promise<void> => {
    if (changeCount === 0) {
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await onSave(changes);
      await refreshBlocklistStatus();
      setListEditorVersion((currentVersion: number): number => currentVersion + 1);
      showToast('Settings saved.', true);
    } catch (caughtError) {
      setSaveError(caughtError);
      const shownFieldIssue: boolean = visibleSettings.some((setting: Web_Api_Setting): boolean => (
        issueFor(caughtError, `changes.${setting['key']}`) !== ''
      ));
      if (!shownFieldIssue) {
        showToast((caughtError instanceof Error) ? caughtError.message : 'Settings could not be saved.', false);
      }
    } finally {
      setSaving(false);
    }
  };

  /**
   * Settings View - Requests blocklist update.
   *
   * Queues a merger run and keeps the refresh icon busy while fast polling.
   * Field-less action errors follow the console rule and appear as a toast.
   *
   * @returns {Promise<void>}
   *
   * @since 2.0.0
   */
  const updateBlocklists = async (): Promise<void> => {
    blocklistUpdateBaselineAttemptRef.current = blocklistStatus?.['lastAttemptAt'];
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
  };

  /**
   * Settings View - Restarts Transmission.
   *
   * Applies accepted restart-impact settings and refreshes the snapshot through the app.
   * A successful refresh clears the pending notice.
   *
   * @since 2.0.0
   */
  const restart = async (): Promise<void> => {
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
  };

  /**
   * Settings View - Resets drafts.
   *
   * Restores every visible field to the accepted value.
   * Hidden VPN and RPC settings are never added to the drafts.
   *
   * @since 2.0.0
   */
  const resetDrafts = (): void => {
    const nextDrafts: Web_Components_SettingsView_Drafts = {};
    for (const setting of visibleSettings) {
      Reflect.set(nextDrafts, setting['key'], setting['value']);
    }
    setDrafts(nextDrafts);
    setListEditorVersion((currentVersion: number): number => currentVersion + 1);
    setSaveError(null);
  };

  /**
   * Settings View - Renders input.
   *
   * Chooses the native control that matches one JSON setting value.
   * Locked settings reuse the same controls in a disabled state.
   *
   * @since 2.0.0
   */
  const renderInput = (setting: Web_Api_Setting): ReactElement => {
    const value: Web_Api_JsonValue = drafts[setting['key']] ?? setting['value'];

    if (setting['key'] === 'transmission.incompleteDirectory') {
      return (
        <SettingsDirectoryField
          disabled={setting['locked']}
          onChange={(path: string): void => updateDraft(setting['key'], path)}
          purpose="incomplete"
          title={setting['title']}
          value={(typeof value === 'string') ? value : ''}
        />
      );
    }

    if (typeof value === 'boolean') {
      return (
        <label className="switch-control">
          <input aria-label={setting['title']} checked={value} disabled={setting['locked']} onChange={(event): void => updateDraft(setting['key'], event.currentTarget.checked)} type="checkbox" />
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
              onChange={(event): void => updateDraft(setting['key'], Number(event.currentTarget.value))}
              step="1"
              type="number"
              value={value}
            />
            <span>hours</span>
          </label>
        );
      }

      return (
        <input aria-label={setting['title']} className="setting-input setting-input-number" disabled={setting['locked']} onChange={(event): void => updateDraft(setting['key'], Number(event.currentTarget.value))} step="1" type="number" value={value} />
      );
    }

    if (Array.isArray(value)) {
      const stringValues: string[] = value.filter((item: Web_Api_JsonValue): item is string => typeof item === 'string');

      return (
        <SettingsListEditor
          blocklistStatus={blocklistStatus}
          blocklistsEnabled={blocklistsEnabled}
          disabled={setting['locked']}
          editorVersion={listEditorVersion}
          onChange={(values: string[]): void => updateDraft(setting['key'], values)}
          settingKey={setting['key']}
          title={setting['title']}
          values={stringValues}
        />
      );
    }

    return (
      <input aria-label={setting['title']} className="setting-input" disabled={setting['locked']} onChange={(event): void => updateDraft(setting['key'], event.currentTarget.value)} type="text" value={(typeof value === 'string') ? value : ''} />
    );
  };

  /**
   * Settings View - Renders setting row.
   *
   * Preserves each setting's key, restart note, source note, and lock state.
   * The row structure matches both approved setting groups.
   *
   * @since 2.0.0
   */
  const renderSetting = (setting: Web_Api_Setting): ReactElement => {
    const notes: string[] = [];
    const fieldIssue: string = issueFor(saveError, `changes.${setting['key']}`);
    const rowClassNames: string[] = ['setting-row'];
    if (blocklistKeys.includes(setting['key'])) {
      rowClassNames.push('blocklist-setting-row');
    }
    if (setting['key'] === 'transmission.blocklistSources') {
      rowClassNames.push('blocklist-source-setting');
    }
    if (setting['applyImpact'] === 'transmission-restart') {
      notes.push('Transmission restart required');
    }
    if ((setting['source'] === 'user' || setting['source'] === 'managed-seed') && !setting['locked']) {
      notes.push('Changed from default');
    }

    return (
      <div className={rowClassNames.join(' ')} key={setting['key']}>
        <div className="setting-copy">
          <div className="setting-title">
            <span>{setting['title']}</span>
            {(setting['locked']) ? <span className="tag" title={`Set by ${setting['source']} configuration`}>Locked</span> : null}
          </div>
          <p>{setting['description']}</p>
          <p className="setting-meta">
            <span className="mono">{setting['key']}</span>
            {notes.map((note: string): ReactElement => <span key={note}>{`· ${note}`}</span>)}
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

  const globalSettings: Web_Api_Setting[] = selectSettings(visibleSettings, allTorrentKeys);
  const networkSettings: Web_Api_Setting[] = selectSettings(visibleSettings, networkKeys);
  const blocklistSettings: Web_Api_Setting[] = selectSettings(visibleSettings, blocklistKeys);
  const pendingRestartTitles: string[] = selectSettings(
    visibleSettings,
    snapshot['pendingRestartKeys'],
  ).map((setting: Web_Api_Setting): string => setting['title']);
  const restartSummary: string = summaryFor(restartError, [], 'Transmission could not be restarted.');
  const blocklistSummary: string = (blocklistStatus === null) ? blocklistStatusError || 'Loading blocklist status…' : formatBlocklistSummary(blocklistStatus);
  const blocklistLastUpdated: string | null = (blocklistStatus === null) ? null : formatBlocklistLastUpdated(blocklistStatus);
  const blocklistNextUpdate: string | null = (blocklistStatus === null) ? null : formatBlocklistNextUpdate(blocklistStatus);
  const blocklistUpdating: boolean = blocklistUpdatePending || blocklistStatus?.['state'] === 'updating';
  const blocklistUpdateDisabled: boolean = (
    blocklistStatus === null
    || blocklistUpdating
    || blocklistStatus['state'] === 'disabled'
    || blocklistStatus['state'] === 'no-sources'
    || blocklistStatus['state'] === 'waiting-for-vpn'
  );

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
            onClick={(): void => {
              setRestartError(null);
              setRestartDialogOpen(true);
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
                  className={`button button-secondary blocklist-update-button${(blocklistUpdating) ? ' is-busy' : ''}`}
                  disabled={blocklistUpdateDisabled}
                  onClick={(): void => {
                    void updateBlocklists();
                  }}
                  type="button"
                >
                  <Icon name="refresh" size={16} />
                  <span>Update now</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <BackupView />

      {(changeCount > 0) ? (
        <div className="save-bar" role="region" aria-label="Unsaved changes">
          <strong>{`${changeCount} unsaved ${(changeCount === 1) ? 'change' : 'changes'}`}</strong>
          <Button disabled={saving} onClick={resetDrafts}>Discard</Button>
          <Button
            disabled={saving}
            onClick={(): void => {
              void save();
            }}
            variant="primary"
          >
            {(saving) ? 'Saving…' : 'Save'}
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        busy={restarting}
        busyLabel="Restarting…"
        confirmLabel="Restart Transmission"
        error={restartSummary}
        message="Transmission pauses briefly while the accepted settings are applied."
        onCancel={(): void => setRestartDialogOpen(false)}
        onConfirm={(): void => {
          void restart();
        }}
        open={restartDialogOpen}
        title="Restart Transmission?"
        tone="primary"
      />
    </section>
  );
};
