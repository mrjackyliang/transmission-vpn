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
import { showToast } from '@/web/toast.ts';

import type {
  ChangeEvent,
  ReactElement,
} from 'react';

import type { Web_Api_AccountSecurity } from '@/types/web/api.d.ts';
import type {
  Web_BackupComponents_ExportOption,
  Web_BackupComponents_ExportSelection,
  Web_BackupComponents_ImportProgressItem,
  Web_BackupComponents_ImportProgressJob,
  Web_BackupComponents_ReviewItem,
  Web_BackupComponents_ReviewNote,
  Web_BackupComponents_RunningImport,
  Web_BackupComponents_SettingsCompareExcludedItem,
  Web_BackupComponents_SettingsCompareRow,
  Web_BackupComponents_WizardStep,
} from '@/types/web/backup-components.d.ts';
import type {
  Web_BackupView_FolderPicker,
  Web_BackupView_Source,
  Web_BackupView_Step,
} from '@/types/web/backup-view.d.ts';
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
} from '@/types/web/backup.d.ts';

/**
 * Backup View - Available export sections.
 *
 * Keeps app-specific copy and section identifiers outside the reusable dialog.
 * Every option starts selected when the export dialog opens.
 *
 * @since UNRELEASED
 */
const exportOptions: Web_BackupComponents_ExportOption[] = [
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
 * Backup View - Count label.
 *
 * Keeps singular and plural review copy correct for every imported count.
 * Callers may provide an irregular plural when appending “s” is not enough.
 *
 * @since UNRELEASED
 */
const countLabel = (count: number, singular: string, plural: string = `${singular}s`): string => (
  `${count.toLocaleString()} ${(count === 1) ? singular : plural}`
);

/**
 * Backup View - Value record.
 *
 * Narrows one unknown preview value before compound setting presentation.
 * Scalars intentionally become an empty record instead of being coerced.
 *
 * @since UNRELEASED
 */
const valueRecord = (value: unknown): Record<string, unknown> => (
  (typeof value === 'object' && value !== null && !Array.isArray(value)) ? value as Record<string, unknown> : {}
);

/**
 * Backup View - Formats a setting value.
 *
 * Converts storage values into the same human language used by Settings.
 * Compound source mappings remain one easy-to-scan row.
 *
 * @since UNRELEASED
 */
const settingValueLabel = (settingKey: string, value: unknown): string => {
  if (typeof value === 'boolean') {
    return (value) ? 'On' : 'Off';
  }
  if (settingKey === 'transmission.downloadQueue') {
    const queue: Record<string, unknown> = valueRecord(value);
    if (queue['enabled'] !== true) {
      return 'Off';
    }
    const size: number = (typeof queue['size'] === 'number') ? queue['size'] : 0;

    return `On · ${size.toLocaleString()} at once`;
  }
  if (settingKey === 'transmission.downloadQueueSize' && typeof value === 'number') {
    return `${value.toLocaleString()} at once`;
  }
  if ((settingKey === 'transmission.peerLimitGlobal' || settingKey === 'profile.default.peerLimit') && typeof value === 'number') {
    return countLabel(value, 'peer');
  }
  if (settingKey === 'profile.default.seeding') {
    const seeding: Record<string, unknown> = valueRecord(value);
    if (seeding['mode'] !== 'limit') {
      return 'No limit';
    }
    const limits: string[] = [];
    if (typeof seeding['ratio'] === 'number') {
      limits.push(`ratio ${seeding['ratio']}`);
    }
    if (typeof seeding['idleMinutes'] === 'number') {
      limits.push(`${seeding['idleMinutes']} min idle`);
    }

    return `Stop at ${limits.join(' or ')}`;
  }
  if (settingKey === 'profile.default.speedLimits') {
    const limits: Record<string, unknown> = valueRecord(value);
    const download: string = (typeof limits['download'] === 'number') ? `${limits['download']} KB/s` : 'Unlimited';
    const upload: string = (typeof limits['upload'] === 'number') ? `${limits['upload']} KB/s` : 'Unlimited';

    return `Down ${download} · Up ${upload}`;
  }
  if (settingKey === 'transmission.blocklists') {
    const blocklists: Record<string, unknown> = valueRecord(value);
    if (blocklists['enabled'] !== true) {
      return 'Off';
    }
    const sources: string[] = (Array.isArray(blocklists['sources'])) ? blocklists['sources'].filter((source: unknown): source is string => typeof source === 'string') : [];
    const source: string = (typeof blocklists['source'] === 'string') ? blocklists['source'] : sources.join(', ');

    return (source === '') ? 'On' : `On · ${source}`;
  }
  if (settingKey === 'transmission.incompleteFolder') {
    const incomplete: Record<string, unknown> = valueRecord(value);

    return (incomplete['enabled'] === true) ? `On · ${String(incomplete['path'] ?? '')}` : 'Off';
  }
  if (Array.isArray(value)) {
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
 * Backup View - Values differ.
 *
 * Compares JSON-shaped preview values without converting booleans into strings.
 * The result drives the visual emphasis in the Settings comparison.
 *
 * @since UNRELEASED
 */
const valuesDiffer = (left: unknown, right: unknown): boolean => JSON.stringify(left) !== JSON.stringify(right);

/**
 * Backup View - Formats bytes.
 *
 * Produces a compact binary-unit label for the amount that will be re-checked.
 * One decimal is retained only when it helps a value below ten stay meaningful.
 *
 * @since UNRELEASED
 */
const formatBytes = (bytes: number): string => {
  if (bytes <= 0) {
    return '';
  }
  const units: string[] = [
    'B',
    'KB',
    'MB',
    'GB',
    'TB',
  ];
  let value: number = bytes;
  let unitIndex: number = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${(value >= 10 || unitIndex === 0) ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`;
};

/**
 * Backup View - Formats duration.
 *
 * Gives the review and live progress screens a deliberately approximate time.
 * This avoids implying disk-speed precision that the browser cannot know.
 *
 * @since UNRELEASED
 */
const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return 'about a minute';
  }
  if (seconds < 3600) {
    const minutes: number = Math.max(1, Math.round(seconds / 60));

    return `about ${countLabel(minutes, 'minute')}`;
  }
  const hours: number = Math.max(1, Math.round(seconds / 3600));

  return `about ${countLabel(hours, 'hour')}`;
};

/**
 * Backup View - Estimates re-check duration.
 *
 * Uses a conservative disk-throughput baseline plus per-torrent startup time.
 * The estimate is guidance only and is always described as approximate.
 *
 * @since UNRELEASED
 */
const estimatedRecheckDuration = (torrentCount: number, totalSizeBytes: number): string => {
  const seconds: number = Math.max(30, (totalSizeBytes / (80 * 1024 * 1024)) + (torrentCount * 2));

  return formatDuration(seconds);
};

/**
 * Backup View - Presents torrent import progress.
 *
 * Translates durable torrent states into the shared progress row and state pills.
 * Missing-data context remains a second line so the red pill stays easy to scan.
 *
 * @since UNRELEASED
 */
const presentImportItem = (item: Web_Backup_ImportItem): Web_BackupComponents_ImportProgressItem => {
  let status: string = item['state'];
  let tone: Web_BackupComponents_ImportProgressItem['tone'] = 'muted';
  let detail: string | undefined = undefined;
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
 * Backup View - Summary number.
 *
 * Reads one numeric persisted-job summary field with a stable zero fallback.
 * This keeps jobs created by an earlier build compatible with the new header.
 *
 * @since UNRELEASED
 */
const summaryNumber = (summary: Record<string, unknown>, key: string): number => (
  (typeof summary[key] === 'number') ? summary[key] : 0
);

/**
 * Backup View - Summary strings.
 *
 * Reads one string-list job summary field while ignoring older or malformed values.
 * Import jobs created before merge summaries therefore remain safe to display.
 *
 * @since UNRELEASED
 */
const summaryStrings = (summary: Record<string, unknown>, key: string): string[] => {
  const value: unknown = summary[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry: unknown): entry is string => typeof entry === 'string');
};

/**
 * Backup View - Folder purpose.
 *
 * Selects the app's destination-folder policy for one imported folder role.
 * Default, incomplete, and named-profile ownership retain their normal rules.
 *
 * @since UNRELEASED
 */
const folderPurpose = (folder: Web_Backup_ImportFolderPreview): 'download' | 'incomplete' | 'profile' => {
  if (folder['kind'] === 'incomplete') {
    return 'incomplete';
  }
  if (folder['kind'] === 'default') {
    return 'download';
  }

  return 'profile';
};

/**
 * Backup View.
 *
 * Owns the app's export sections and both import sources while reusable backup
 * foundations supply the section, shell, confirmation, and progress structure.
 *
 * @since UNRELEASED
 */
export const BackupView = (): ReactElement => {
  const [
    security,
    setSecurity,
  ] = useState<Web_Api_AccountSecurity | null>(null);
  const [
    exportOpen,
    setExportOpen,
  ] = useState<boolean>(false);
  const [
    wizardOpen,
    setWizardOpen,
  ] = useState<boolean>(false);
  const [
    step,
    setStep,
  ] = useState<Web_BackupView_Step>('source');
  const [
    importSource,
    setImportSource,
  ] = useState<Web_BackupView_Source>('transmission-vpn-export');
  const [
    document,
    setDocument,
  ] = useState<Web_Backup_Document | null>(null);
  const [
    fileName,
    setFileName,
  ] = useState<string>('');
  const [
    configPath,
    setConfigPath,
  ] = useState<string>('/import');
  const [
    preview,
    setPreview,
  ] = useState<Web_Backup_ImportPreview | null>(null);
  const [
    folderMappings,
    setFolderMappings,
  ] = useState<Record<string, string>>({});
  const [
    profileActions,
    setProfileActions,
  ] = useState<Record<string, 'replace' | 'keep'>>({});
  const [
    profileNames,
    setProfileNames,
  ] = useState<Record<string, string>>({});
  const [
    profileConnections,
    setProfileConnections,
  ] = useState<Record<string, string | null>>({});
  const [
    profileIncluded,
    setProfileIncluded,
  ] = useState<Record<string, boolean>>({});
  const [
    sourceBusy,
    setSourceBusy,
  ] = useState<boolean>(false);
  const [
    sourceError,
    setSourceError,
  ] = useState<string>('');
  const [
    importJob,
    setImportJob,
  ] = useState<Web_Backup_ImportJob | null>(null);
  const [
    folderPicker,
    setFolderPicker,
  ] = useState<Web_BackupView_FolderPicker | null>(null);
  const [
    sourcePickerOpen,
    setSourcePickerOpen,
  ] = useState<boolean>(false);
  const mountedRef = useRef<boolean>(true);

  useEffect((): (() => void) => {
    mountedRef.current = true;
    void getCurrentBackupImport().then((job: Web_Backup_ImportJob | null): void => {
      if (mountedRef.current) {
        setImportJob(job);
      }
    }).catch((): void => undefined);

    return (): void => {
      mountedRef.current = false;
    };
  }, []);

  useEffect((): (() => void) | undefined => {
    if (importJob === null || importJob['status'] === 'completed' || importJob['status'] === 'failed') {
      return undefined;
    }
    let cancelled: boolean = false;
    const timer: number = window.setInterval((): void => {
      void getBackupImport(importJob['id']).then((job: Web_Backup_ImportJob): void => {
        if (!cancelled) {
          setImportJob(job);
        }
      }).catch((): void => undefined);
    }, 1000);

    return (): void => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    importJob?.['id'],
    importJob?.['status'],
  ]);

  const loadSecurity = useCallback(async (): Promise<Web_Api_AccountSecurity> => {
    const accountSecurity: Web_Api_AccountSecurity = await getAccountSecurity();
    setSecurity(accountSecurity);

    return accountSecurity;
  }, []);

  /**
   * Backup View - Opens export.
   *
   * Refreshes current confirmation capabilities before showing secret choices.
   * A failed account read leaves the dialog closed and reports one toast.
   *
   * @returns {Promise<void>}
   *
   * @since UNRELEASED
   */
  const openExport = async (): Promise<void> => {
    try {
      await loadSecurity();
      setExportOpen(true);
    } catch {
      showToast('Account security could not be loaded.', false);
    }
  };

  /**
   * Backup View - Resets wizard.
   *
   * Releases local source material and every decision from a previous attempt.
   * Persisted server progress remains independent in the import-job state.
   *
   * @since UNRELEASED
   */
  const resetWizard = (): void => {
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
  };

  /**
   * Backup View - Opens import.
   *
   * Restores a durable running job or starts a clean source selection.
   * Background work therefore stays reachable after leaving Settings.
   *
   * @since UNRELEASED
   */
  const openImport = (): void => {
    if (importJob !== null) {
      setStep('importing');
      setWizardOpen(true);

      return;
    }
    resetWizard();
    setWizardOpen(true);
  };

  /**
   * Backup View - Closes wizard.
   *
   * Dismisses local dialogs without cancelling a persisted import job.
   * Source documents are released whenever no job progress is being shown.
   *
   * @since UNRELEASED
   */
  const closeWizard = (): void => {
    setWizardOpen(false);
    setFolderPicker(null);
    setSourcePickerOpen(false);
    if (step !== 'importing') {
      setDocument(null);
      setPreview(null);
    }
  };

  /**
   * Backup View - Initializes preview choices.
   *
   * Applies server suggestions once when a source is first inspected.
   * Later folder-count refreshes preserve names, connections, and inclusion choices.
   *
   * @param {Web_Backup_ImportPreview} nextPreview - Next preview.
   *
   * @since UNRELEASED
   */
  const initializePreviewChoices = (nextPreview: Web_Backup_ImportPreview): void => {
    const actions: Record<string, 'replace' | 'keep'> = {};
    const names: Record<string, string> = {};
    const connections: Record<string, string | null> = {};
    const included: Record<string, boolean> = {};
    for (const profile of nextPreview['profiles']) {
      actions[profile['id']] = 'replace';
      if (profile['sourcePath'] !== undefined) {
        names[profile['sourcePath']] = profile['name'];
        connections[profile['sourcePath']] = profile['connectionId'] ?? null;
        included[profile['sourcePath']] = profile['included'];
      }
    }
    setProfileActions(actions);
    setProfileNames(names);
    setProfileConnections(connections);
    setProfileIncluded(included);
  };

  /**
   * Backup View - Inspects another Transmission.
   *
   * Requests a fresh read-only projection and merges same-path folder suggestions.
   * A mapping refresh can retain profile decisions by skipping initialization.
   *
   * @param {string}                 path              - Path.
   * @param {Record<string, string>} mappings          - Mappings.
   * @param {boolean}                initializeChoices - Initialize choices.
   *
   * @returns {Promise<void>}
   *
   * @since UNRELEASED
   */
  const inspectAnotherTransmission = async (
    path: string,
    mappings: Record<string, string>,
    initializeChoices: boolean,
  ): Promise<void> => {
    setSourceBusy(true);
    setSourceError('');
    try {
      const nextPreview: Web_Backup_ImportPreview = await previewAnotherTransmissionImport(path, mappings);
      const nextMappings: Record<string, string> = { ...mappings };
      for (const folder of nextPreview['folders']) {
        if ((nextMappings[folder['sourcePath']] ?? '') === '' && folder['mappedPath'] !== undefined) {
          nextMappings[folder['sourcePath']] = folder['mappedPath'];
        }
      }
      setPreview(nextPreview);
      setFolderMappings(nextMappings);
      setDocument(null);
      if (initializeChoices) {
        initializePreviewChoices(nextPreview);
      }
    } catch (caughtError) {
      setPreview(null);
      setSourceError((caughtError instanceof Error) ? caughtError.message : 'That config folder could not be inspected.');
    } finally {
      setSourceBusy(false);
    }
  };

  /**
   * Backup View - Chooses export file.
   *
   * Parses the file locally before asking the server for environment conflicts.
   * The native input is cleared so choosing the same corrected file works again.
   *
   * @param {ChangeEvent<HTMLInputElement>} event - Event.
   *
   * @returns {Promise<void>}
   *
   * @since UNRELEASED
   */
  const chooseFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const input: HTMLInputElement = event.currentTarget;
    const file: File | undefined = input.files?.[0];
    input.value = '';
    if (file === undefined) {
      return;
    }
    setImportSource('transmission-vpn-export');
    setSourceBusy(true);
    setSourceError('');
    try {
      const parsedValue: unknown = JSON.parse(await file.text());
      const parsedDocument: Web_Backup_Document = parseBackupDocument(parsedValue);
      const nextPreview: Web_Backup_ImportPreview = await previewBackupImport(parsedDocument);
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
  };

  /**
   * Backup View - Selects source.
   *
   * Clears decisions that belong to the other source and inspects mounted config.
   * Re-selecting an unresolved mounted source retries its current path.
   *
   * @param {Web_BackupView_Source} source - Source.
   *
   * @since UNRELEASED
   */
  const selectSource = (source: Web_BackupView_Source): void => {
    if (source === importSource) {
      if (source === 'another-transmission' && preview === null && !sourceBusy) {
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
  };

  const steps: Web_BackupComponents_WizardStep[] = useMemo((): Web_BackupComponents_WizardStep[] => {
    const availableSteps: Web_BackupComponents_WizardStep[] = [{
      id: 'source',
      label: 'Source',
    }];
    if ((preview?.['folders'].length ?? 0) > 0) {
      availableSteps.push({
        id: 'folders',
        label: 'Folders',
      });
    }
    if ((preview?.['profiles'].length ?? 0) > 0) {
      availableSteps.push({
        id: 'profiles',
        label: 'Profiles',
      });
    }
    if ((preview?.['settings'].length ?? 0) > 0) {
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

  const orderedStepIDs: Web_BackupView_Step[] = steps.map(
    (wizardStep: Web_BackupComponents_WizardStep): Web_BackupView_Step => wizardStep['id'] as Web_BackupView_Step,
  );

  /**
   * Backup View - Moves step.
   *
   * Navigates through the derived list so absent optional steps stay skipped.
   * An out-of-range move leaves the current wizard state unchanged.
   *
   * @param {number} offset - Offset.
   *
   * @since UNRELEASED
   */
  const moveStep = (offset: number): void => {
    const index: number = orderedStepIDs.indexOf(step);
    const target: Web_BackupView_Step | undefined = orderedStepIDs[index + offset];
    if (target !== undefined) {
      setStep(target);
    }
  };

  // Each profile owns one folder, so two old download folders cannot share a target.
  const sharedTargets: Set<string> = new Set<string>();
  const seenTargets: Set<string> = new Set<string>();
  for (const folder of preview?.['folders'] ?? []) {
    const target: string = (folderMappings[folder['sourcePath']] ?? '').replace(/\/+$/, '').toLowerCase();
    if (folder['kind'] === 'incomplete' || target === '') {
      continue;
    }
    if (seenTargets.has(target)) {
      sharedTargets.add(target);
    }
    seenTargets.add(target);
  }
  const nestingConflict: boolean = preview?.['folders'].some(
    (folder: Web_Backup_ImportFolderPreview): boolean => (folder['conflict'] ?? '') !== '',
  ) ?? false;
  const mappingsComplete: boolean = sharedTargets.size === 0 && !nestingConflict && (preview?.['folders'].every(
    (folder: Web_Backup_ImportFolderPreview): boolean => (folderMappings[folder['sourcePath']] ?? '') !== '',
  ) ?? true);
  const choicesComplete: boolean = preview?.['profiles'].every(
    (profile: Web_Backup_ImportProfilePreview): boolean => {
      if (importSource === 'another-transmission' && profile['sourcePath'] !== undefined) {
        if (profile['empty'] === true && profileIncluded[profile['sourcePath']] === false) {
          return true;
        }
        if ((profileNames[profile['sourcePath']] ?? '').trim() === '') {
          return false;
        }
      }

      return profile['default'] || profile['existingId'] === null || profileActions[profile['id']] !== undefined;
    },
  ) ?? true;
  const sourceReady: boolean = preview !== null && (
    (importSource === 'transmission-vpn-export' && document !== null)
    || importSource === 'another-transmission'
  );
  const missingDefaultConnection: boolean = (preview?.['torrentCount'] ?? 0) > 0
    && preview !== null
    && !preview['connections'].some((connection): boolean => connection['default']);
  const nextDisabled: boolean = (
    (step === 'review' && (missingDefaultConnection || nestingConflict))
    || (step === 'source' && !sourceReady)
    || (step === 'folders' && !mappingsComplete)
    || (step === 'profiles' && !choicesComplete)
  );

  /**
   * Backup View - Advances wizard.
   *
   * The review boundary refreshes identity-confirmation capabilities first.
   * Earlier steps move immediately through the currently available pages.
   *
   * @since UNRELEASED
   */
  const next = (): void => {
    if (step === 'review') {
      void loadSecurity().then((): void => setStep('confirm')).catch((): void => {
        showToast('Account security could not be loaded.', false);
      });

      return;
    }
    moveStep(1);
  };

  /**
   * Backup View - Starts import.
   *
   * Builds the discriminated plan for the selected source and consumes one grant.
   * The returned durable job immediately replaces all source-specific progress.
   *
   * @param {string} grant - Grant.
   *
   * @returns {Promise<void>}
   *
   * @since UNRELEASED
   */
  const startImport = async (grant: string): Promise<void> => {
    let plan: Web_Backup_ImportPlan | undefined = undefined;
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
    const job: Web_Backup_ImportJob = await createBackupImport(plan, grant);
    setImportJob(job);
    setStep('importing');
  };

  const passkeyAvailable: boolean = security?.['passkeysAvailable'] === true && security['passkeys'].length > 0;
  let runningImport: Web_BackupComponents_RunningImport | null = null;
  if (importJob !== null) {
    let runningTitle: string = 'Import in progress';
    let runningDetail: string = `Re-checked ${importJob['completedTorrents']} of ${importJob['totalTorrents']}`;
    if (importJob['status'] === 'completed') {
      runningTitle = 'Import complete';
      runningDetail = 'See what changed';
    } else if (importJob['status'] === 'failed') {
      runningTitle = 'Import stopped';
      runningDetail = importJob['error'] || 'Needs review';
    }
    runningImport = {
      detail: runningDetail,
      progress: (importJob['totalTorrents'] === 0) ? 0 : importJob['completedTorrents'] / importJob['totalTorrents'],
      title: runningTitle,
    };
  }
  const progressJob: Web_BackupComponents_ImportProgressJob | null = (importJob === null) ? null : {
    completed: importJob['completedTorrents'],
    error: importJob['error'],
    items: importJob['items'].map(presentImportItem),
    status: importJob['status'],
    total: importJob['totalTorrents'],
  };
  const importableSettings: Web_Backup_ImportSettingPreview[] = preview?.['settings'].filter(
    (setting: Web_Backup_ImportSettingPreview): boolean => setting['willImport'],
  ) ?? [];
  const skippedSettings: Web_Backup_ImportSettingPreview[] = preview?.['settings'].filter(
    (setting: Web_Backup_ImportSettingPreview): boolean => !setting['willImport'],
  ) ?? [];
  const settingRows: Web_BackupComponents_SettingsCompareRow[] = importableSettings.map(
    (setting: Web_Backup_ImportSettingPreview): Web_BackupComponents_SettingsCompareRow => ({
      changed: valuesDiffer(setting['fileValue'], setting['hereValue']),
      fileValue: settingValueLabel(setting['key'], setting['fileValue']),
      hereValue: settingValueLabel(setting['key'], setting['hereValue']),
      id: setting['key'],
      label: setting['title'],
    }),
  );
  const settingsExcludedItems: Web_BackupComponents_SettingsCompareExcludedItem[] = skippedSettings.map(
    (setting: Web_Backup_ImportSettingPreview): Web_BackupComponents_SettingsCompareExcludedItem => ({
      id: setting['key'],
      label: setting['title'],
      reason: setting['reason'] ?? 'There is no equivalent setting here.',
    }),
  );
  const includedProfiles: Web_Backup_ImportProfilePreview[] = preview?.['profiles'].filter(
    (profile: Web_Backup_ImportProfilePreview): boolean => (
      profile['sourcePath'] === undefined
      || profile['empty'] !== true
      || profileIncluded[profile['sourcePath']] !== false
    ),
  ) ?? [];
  let totalSizeBytes: number = preview?.['totalSizeBytes'] ?? 0;
  if (importSource === 'another-transmission' && preview?.['dataFoundBytes'] !== undefined) {
    totalSizeBytes = preview['dataFoundBytes'];
  }
  const alreadyPresentCount: number = preview?.['alreadyPresentCount'] ?? 0;
  const torrentCount: number = Math.max(0, (preview?.['torrentCount'] ?? 0) - alreadyPresentCount);
  const runningTorrentCount: number = preview?.['runningTorrentCount']
    ?? document?.['torrents']?.filter((torrent): boolean => !torrent['paused']).length
    ?? 0;
  const dataMissingCount: number = (importSource === 'another-transmission') ? preview?.['dataMissingCount'] ?? 0 : 0;
  const changedSettingCount: number = settingRows.filter((row: Web_BackupComponents_SettingsCompareRow): boolean => row['changed']).length;
  const recheckTime: string = estimatedRecheckDuration(torrentCount - dataMissingCount, totalSizeBytes);
  const reviewItems: Web_BackupComponents_ReviewItem[] = [];
  if (importSource === 'another-transmission') {
    const namedProfiles: Web_Backup_ImportProfilePreview[] = includedProfiles.filter((profile): boolean => !profile['default']);
    const createCount: number = namedProfiles.filter((profile): boolean => profile['existingId'] === null).length;
    const replaceCount: number = namedProfiles.filter((profile): boolean => (
      profile['existingId'] !== null && (profileActions[profile['id']] ?? 'replace') === 'replace'
    )).length;
    const keepCount: number = namedProfiles.length - createCount - replaceCount;
    const profileParts: string[] = [];
    if (createCount > 0) {
      profileParts.push(`Create ${countLabel(createCount, 'profile')} from the mapped folders`);
    }
    if (replaceCount > 0) {
      profileParts.push(`${(profileParts.length > 0) ? 'replace' : 'Replace'} ${countLabel(replaceCount, 'profile')} with the same name`);
    }
    if (keepCount > 0) {
      profileParts.push(`${(profileParts.length > 0) ? 'keep' : 'Keep'} ${countLabel(keepCount, 'profile')} as they are here`);
    }
    profileParts.push(`${(profileParts.length > 0) ? 'and update' : 'Update'} the Default profile`);
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
  const mergeActions: string[] = preview?.['actions'] ?? [];
  for (const mergeAction of mergeActions) {
    reviewItems.push({
      id: `merge-${reviewItems.length}`,
      text: mergeAction,
    });
  }
  const noDataFound: boolean = torrentCount > 0 && dataMissingCount >= torrentCount;
  if (torrentCount > 0) {
    let torrentReview: string = `Add ${countLabel(torrentCount, 'torrent')} paused, then re-check${(totalSizeBytes > 0) ? ` ${formatBytes(totalSizeBytes)}` : ' its data'} on disk`;
    if (noDataFound) {
      torrentReview = `Add ${countLabel(torrentCount, 'torrent')} paused`;
    }
    reviewItems.push({
      id: 'torrents',
      text: torrentReview,
    });
  }
  if (runningTorrentCount > 0 && !noDataFound) {
    let runningReview: string = 'Start the torrent that was running once its check finishes';
    if (runningTorrentCount > 1) {
      runningReview = 'Start each torrent that was running once its check finishes';
    }
    reviewItems.push({
      id: 'running-torrents',
      text: runningReview,
    });
  }
  if (alreadyPresentCount > 0) {
    reviewItems.push({
      id: 'present-torrents',
      text: `Skip ${countLabel(alreadyPresentCount, 'torrent')} that ${(alreadyPresentCount === 1) ? 'is' : 'are'} already here`,
    });
  }
  const reviewNotes: Web_BackupComponents_ReviewNote[] = [];
  if (nestingConflict) {
    reviewNotes.push({
      icon: 'warning',
      id: 'folder-overlap',
      text: 'Some profile folders would overlap. Go back to Folders and give each profile a folder of its own.',
    });
  }
  if (missingDefaultConnection) {
    reviewNotes.push({
      icon: 'warning',
      id: 'default-connection',
      text: 'Add and test a default VPN connection before importing torrents.',
    });
  }
  if (dataMissingCount > 0) {
    let dataMissingNote: string = `No data was found for ${countLabel(dataMissingCount, 'torrent')}. They stay as Data missing until their files are in the mapped folders.`;
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
  if (preview?.['hasRemoteLogins'] === false) {
    let remoteLoginNote: string = 'This export has no RPC logins. Add one afterwards for each remote app that needs it.';
    if (importSource === 'another-transmission') {
      remoteLoginNote = 'Afterwards, add an RPC login for each app that used the old Transmission and paste it into that app.';
    }
    reviewNotes.push({
      icon: 'key',
      id: 'remote-logins',
      text: remoteLoginNote,
    });
  }
  let progressSummary: string | undefined = undefined;
  if (importJob !== null) {
    const progressSummaryParts: string[] = [];
    const torrentTotal: number = importJob['totalTorrents'];
    const profileTotal: number = summaryNumber(importJob['summary'], 'profileCount');
    const settingTotal: number = summaryNumber(importJob['summary'], 'settingCount');
    if (torrentTotal > 0) {
      progressSummaryParts.push(countLabel(torrentTotal, 'torrent'));
    }
    if (profileTotal > 0) {
      progressSummaryParts.push(countLabel(profileTotal, 'profile'));
    }
    if (settingTotal > 0) {
      progressSummaryParts.push(countLabel(settingTotal, 'setting'));
    }
    const progressActions: string[] = summaryStrings(importJob['summary'], 'actions');
    for (const progressAction of progressActions) {
      progressSummaryParts.push(progressAction);
    }
    progressSummary = progressSummaryParts.join(' · ');
  }
  let progressRemaining: string | undefined = undefined;
  if (importJob !== null && importJob['status'] !== 'completed' && importJob['status'] !== 'failed') {
    let remainingSeconds: number = Math.max(30, summaryNumber(importJob['summary'], 'totalSizeBytes') / (80 * 1024 * 1024));
    if (importJob['completedTorrents'] > 0 && importJob['startedAt'] !== null) {
      const elapsedSeconds: number = Math.max(1, (Date.now() - Date.parse(importJob['startedAt'])) / 1000);
      remainingSeconds = elapsedSeconds / importJob['completedTorrents'] * (importJob['totalTorrents'] - importJob['completedTorrents']);
    }
    const duration: string = formatDuration(remainingSeconds);
    progressRemaining = `${duration.charAt(0).toUpperCase()}${duration.slice(1)} left`;
  }

  /**
   * Backup View - Refreshes mapped folder.
   *
   * Stores a destination choice and asks mounted sources to recount visible data.
   * Export imports keep their already-computed binary found-or-missing state.
   *
   * @param {string} sourcePath - Source path.
   * @param {string} path       - Path.
   *
   * @since UNRELEASED
   */
  const refreshMappedFolder = (sourcePath: string, path: string): void => {
    const nextMappings: Record<string, string> = {
      ...folderMappings,
      [sourcePath]: path,
    };
    setFolderMappings(nextMappings);
    if (importSource === 'another-transmission') {
      void inspectAnotherTransmission(configPath, nextMappings, false);
    } else {
      void refreshExportPreview(nextMappings, profileActions);
    }
  };

  /**
   * Backup View - Refreshes export preview.
   *
   * Re-checks an export file's profile folders after a folder or Replace/Keep choice
   * changes, so folders that would overlap stay listed until each has its own.
   *
   * @since UNRELEASED
   */
  const refreshExportPreview = async (
    nextMappings: Record<string, string>,
    nextActions: Record<string, string>,
  ): Promise<void> => {
    if (document === null) {
      return;
    }
    try {
      setPreview(await previewBackupImport(document, nextMappings, nextActions));
    } catch (caughtError) {
      setSourceError((caughtError instanceof Error) ? caughtError.message : 'The import could not be checked again.');
    }
  };

  return (
    <>
      <BackupSection
        description="Save this setup to a file, or bring one in. You can also import from another Transmission."
        importJob={runningImport}
        onExport={(): void => {
          void openExport();
        }}
        onImport={openImport}
        onOpenImport={openImport}
        rowLabel="Export and import"
        title="Backup"
      />

      <BackupExportDialog
        authenticatorEnabled={security?.['totpEnabled'] ?? false}
        description="Choose what to save in this export."
        onClose={(): void => setExportOpen(false)}
        onConfirm={async (password: string, code: string): Promise<string> => confirmBackupOperation('export', password, code)}
        onExport={async (selection: Web_BackupComponents_ExportSelection, grant: string): Promise<void> => {
          const sections: Web_Backup_ExportSections = {
            labels: selection['labels'] ?? false,
            notifications: selection['notifications'] ?? false,
            remoteAccess: selection['remoteAccess'] ?? false,
            settingsAndProfiles: selection['settingsAndProfiles'] ?? false,
            torrents: selection['torrents'] ?? false,
            vpnConnections: selection['vpnConnections'] ?? false,
          };
          await downloadBackupExport(sections, grant);
          showToast('Export downloaded.', true);
        }}
        onPasskey={async (): Promise<string> => confirmBackupOperationWithPasskey('export')}
        open={exportOpen}
        options={exportOptions}
        passkeyAvailable={passkeyAvailable}
        secretWarning="The file includes passwords and keys in plain text. Keep it somewhere safe."
        title="Export"
      />

      <BackupImportWizardShell
        backDisabled={step === 'source' || step === 'importing'}
        busy={sourceBusy && step !== 'source'}
        currentStep={(step === 'confirm') ? 'review' : step}
        description={(step === 'importing') ? 'You can close this dialog without stopping the import.' : 'Bring settings and torrents into this Transmission.'}
        hideNavigation={step === 'confirm' || step === 'importing'}
        nextDisabled={nextDisabled}
        nextIcon={(step === 'review') ? 'upload' : undefined}
        nextLabel={(step === 'review') ? 'Import' : 'Next'}
        onBack={(): void => moveStep(-1)}
        onClose={closeWizard}
        onNext={next}
        open={wizardOpen && folderPicker === null && !sourcePickerOpen}
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
              onFileChange={(event: ChangeEvent<HTMLInputElement>): void => {
                void chooseFile(event);
              }}
              onSelect={(): void => selectSource('transmission-vpn-export')}
              selected={importSource === 'transmission-vpn-export'}
            />

            <label className={`backup-source-card${(importSource === 'another-transmission') ? ' is-selected' : ''}`}>
              <input checked={importSource === 'another-transmission'} className="backup-source-radio" name="backup-source" onChange={(): void => selectSource('another-transmission')} type="radio" />
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
                  onBlur={(): void => {
                    if (importSource === 'another-transmission') {
                      void inspectAnotherTransmission(configPath, {}, true);
                    }
                  }}
                  onChange={(event): void => setConfigPath(event.currentTarget.value)}
                  onKeyDown={(event): void => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void inspectAnotherTransmission(configPath, {}, true);
                    }
                  }}
                  spellCheck={false}
                  type="text"
                  value={configPath}
                />
                <Button disabled={sourceBusy} onClick={(): void => setSourcePickerOpen(true)}>Browse</Button>
              </span>
              {(importSource !== 'another-transmission' || preview?.['sourceDetails'] === undefined) ? null : (
                <span className="backup-source-check is-valid">
                  <Icon name="check" size={16} />
                  {`Transmission ${preview['sourceDetails']['version']} · ${preview['sourceDetails']['settingsFile']} · ${countLabel(preview['sourceDetails']['torrentCount'], 'torrent')} · nothing in it will be changed`}
                </span>
              )}
            </label>
            {(sourceBusy) ? (
              <p className="backup-source-status">
                <span className="spinner" />
                {' '}
                Checking source…
              </p>
            ) : null}
            {(sourceError === '') ? null : <div className="form-error" role="alert">{sourceError}</div>}
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
                  {preview['folders'].map((folder: Web_Backup_ImportFolderPreview): ReactElement => {
                    const mapping: string = folderMappings[folder['sourcePath']] ?? folder['mappedPath'] ?? '';
                    let dataLabel: string = 'Not found';
                    if (folder['dataFoundStatus'] === 'empty' && (folder['torrentCount'] ?? 0) > 0) {
                      dataLabel = 'In incomplete folder';
                    } else if (folder['dataFoundStatus'] === 'empty') {
                      dataLabel = 'Empty';
                    } else if ((folder['dataTotal'] ?? 0) > 0) {
                      dataLabel = `${folder['dataFoundCount'] ?? 0} of ${folder['dataTotal'] ?? 0}`;
                    } else if (folder['dataFound']) {
                      dataLabel = 'Found';
                    }

                    return (
                      <tr key={folder['sourcePath']}>
                        <td data-label="There">
                          <code>{folder['sourcePath']}</code>
                          {(folder['description'] === undefined) ? null : <small>{folder['description']}</small>}
                        </td>
                        <td data-label="Here">
                          <span className="backup-folder-field">
                            <code aria-label={`Folder here for ${folder['sourcePath']}`} className="backup-folder-path" data-empty={(mapping === '') ? 'true' : undefined}>{(mapping === '') ? 'No folder chosen' : mapping}</code>
                            <Button onClick={(): void => setFolderPicker({
                              initialPath: mapping || '/data',
                              purpose: folderPurpose(folder),
                              sourcePath: folder['sourcePath'],
                            })}
                            >
                              Browse…
                            </Button>
                          </span>
                          {(folder['kind'] === 'incomplete' || !sharedTargets.has(mapping.replace(/\/+$/, '').toLowerCase())) ? null : (
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
                  {preview['profiles'].map((profile: Web_Backup_ImportProfilePreview): ReactElement => {
                    const sourcePath: string = profile['sourcePath'] ?? '';
                    const included: boolean = profile['empty'] !== true || profileIncluded[sourcePath] !== false;

                    return (
                      <tr className={(!included) ? 'is-muted' : ''} key={profile['id']}>
                        <td data-label="Folder">
                          {(sourcePath === '') ? profile['name'] : <code>{sourcePath}</code>}
                          {(profile['note'] === undefined) ? null : <small>{profile['note']}</small>}
                        </td>
                        <td data-label="Profile">
                          {(profile['default']) ? (
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
                                  onChange={(event): void => setProfileIncluded((current): Record<string, boolean> => ({
                                    ...current,
                                    [sourcePath]: event.currentTarget.checked,
                                  }))}
                                  type="checkbox"
                                />
                              )}
                              {(importSource === 'another-transmission') ? (
                                <input
                                  aria-label={`Profile name for ${sourcePath}`}
                                  disabled={!included}
                                  onChange={(event): void => setProfileNames((current): Record<string, string> => ({
                                    ...current,
                                    [sourcePath]: event.currentTarget.value,
                                  }))}
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
                              disabled={profile['default'] || !included}
                              onChange={(event): void => setProfileConnections((current): Record<string, string | null> => ({
                                ...current,
                                [sourcePath]: event.currentTarget.value || null,
                              }))}
                              value={profileConnections[sourcePath] ?? ''}
                            >
                              <option value="">Follow default connection</option>
                              {preview['connections'].map((connection): ReactElement => <option key={connection['id']} value={connection['id']}>{connection['name']}</option>)}
                            </select>
                          ) : (profile['existingName'] ?? 'New profile')}
                        </td>
                        <td data-label="Action">
                          {(!included) ? 'Skip' : null}
                          {(included && profile['default']) ? 'Update in place' : null}
                          {(included && !profile['default'] && profile['existingId'] === null) ? 'Add' : null}
                          {(included && !profile['default'] && profile['existingId'] !== null) ? (
                            <select
                              aria-label={`Action for ${profile['name']}`}
                              className="select-control"
                              onChange={(event): void => {
                                const nextActions: Record<string, 'replace' | 'keep'> = {
                                  ...profileActions,
                                  [profile['id']]: event.currentTarget.value as 'replace' | 'keep',
                                };
                                setProfileActions(nextActions);
                                if (importSource !== 'another-transmission') {
                                  void refreshExportPreview(folderMappings, nextActions);
                                }
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
            {(importSource !== 'another-transmission' || preview['sourceDetails']?.['incompleteDirectory'] === undefined) ? null : (
              <p className="backup-incomplete-note">{`The incomplete folder becomes ${folderMappings[preview['sourceDetails']['incompleteDirectory']] ?? preview['sourceDetails']['incompleteDirectory']}, so unfinished downloads continue in place.`}</p>
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
            authenticatorEnabled={security?.['totpEnabled'] ?? false}
            description="Confirm the current account before applying this import."
            onBack={(): void => setStep('review')}
            onConfirm={async (password: string, code: string): Promise<string> => confirmBackupOperation('import', password, code)}
            onConfirmed={startImport}
            onPasskey={async (): Promise<string> => confirmBackupOperationWithPasskey('import')}
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
            onDone={(): void => {
              setWizardOpen(false);
              setImportJob(null);
              resetWizard();
            }}
            progressLabel={(completed: number, total: number): string => `Re-checked ${completed} of ${total}`}
            remainingLabel={progressRemaining}
          />
        )}
      </BackupImportWizardShell>

      <DirectoryBrowserDialog
        initialPath={folderPicker?.['initialPath'] ?? '/data'}
        onClose={(): void => setFolderPicker(null)}
        onSelect={(path: string): void => {
          if (folderPicker !== null) {
            refreshMappedFolder(folderPicker['sourcePath'], path);
          }
          setFolderPicker(null);
        }}
        open={folderPicker !== null}
        profileId={(folderPicker?.['purpose'] === 'profile') ? 'new' : undefined}
        purpose={folderPicker?.['purpose'] ?? 'download'}
      />

      <BackupSourceDirectoryDialog
        initialPath={configPath || '/'}
        onClose={(): void => setSourcePickerOpen(false)}
        onSelect={(path: string): void => {
          setConfigPath(path);
          setSourcePickerOpen(false);
          setImportSource('another-transmission');
          void inspectAnotherTransmission(path, {}, true);
        }}
        open={sourcePickerOpen}
      />
    </>
  );
};
