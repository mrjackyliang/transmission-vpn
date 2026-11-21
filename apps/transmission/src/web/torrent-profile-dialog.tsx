import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ApiError,
  connectionBeingRemovedMessage,
  issueFor,
} from '@/web/api.ts';
import { DirectoryBrowserDialog } from '@/web/directory-browser-dialog.tsx';
import {
  parseDefaultTorrentProfileInput,
  parseTorrentProfileInput,
} from '@/web/form-validation.ts';
import { LabelPicker } from '@/web/organization-controls.tsx';
import {
  Button,
  Icon,
} from '@/web/primitives.tsx';
import { torrentMoveResultLabel } from '@/web/torrent-move-result.ts';
import { torrentProfileDialogFields } from '@/web/torrent-profile-fields.ts';
import {
  torrentNameMatchesPattern,
  torrentPatternsOverlap,
} from '@/web/torrent-profile-matcher.ts';
import { useEscapeKey } from '@/web/use-escape-key.ts';

import type {
  Web_TorrentProfileDialog_ParseLabelList_Returns,
  Web_TorrentProfileDialog_ParseLabelList_Value,
  Web_TorrentProfileDialog_ParsePatterns_Returns,
  Web_TorrentProfileDialog_ParsePatterns_Rows,
  Web_TorrentProfileDialog_TorrentProfileDialog_BrowserOpen,
  Web_TorrentProfileDialog_TorrentProfileDialog_BrowserOpenState,
  Web_TorrentProfileDialog_TorrentProfileDialog_BuildInput,
  Web_TorrentProfileDialog_TorrentProfileDialog_BuildInput_Returns,
  Web_TorrentProfileDialog_TorrentProfileDialog_BuildInput_SharedInput,
  Web_TorrentProfileDialog_TorrentProfileDialog_Busy,
  Web_TorrentProfileDialog_TorrentProfileDialog_BusyState,
  Web_TorrentProfileDialog_TorrentProfileDialog_ConnectionId,
  Web_TorrentProfileDialog_TorrentProfileDialog_ConnectionIdState,
  Web_TorrentProfileDialog_TorrentProfileDialog_ConnectionName,
  Web_TorrentProfileDialog_TorrentProfileDialog_ConnectionName_Connection,
  Web_TorrentProfileDialog_TorrentProfileDialog_ConnectionName_Returns,
  Web_TorrentProfileDialog_TorrentProfileDialog_ConnectionName_TargetId,
  Web_TorrentProfileDialog_TorrentProfileDialog_Connections,
  Web_TorrentProfileDialog_TorrentProfileDialog_CurrentPatterns,
  Web_TorrentProfileDialog_TorrentProfileDialog_DefaultConnection,
  Web_TorrentProfileDialog_TorrentProfileDialog_DefaultConnectionName,
  Web_TorrentProfileDialog_TorrentProfileDialog_DefaultProfile,
  Web_TorrentProfileDialog_TorrentProfileDialog_DownloadDirectory,
  Web_TorrentProfileDialog_TorrentProfileDialog_DownloadDirectoryState,
  Web_TorrentProfileDialog_TorrentProfileDialog_DownloadLimit,
  Web_TorrentProfileDialog_TorrentProfileDialog_DownloadLimited,
  Web_TorrentProfileDialog_TorrentProfileDialog_DownloadLimitedState,
  Web_TorrentProfileDialog_TorrentProfileDialog_DownloadLimitKBps,
  Web_TorrentProfileDialog_TorrentProfileDialog_DownloadLimitState,
  Web_TorrentProfileDialog_TorrentProfileDialog_Fields,
  Web_TorrentProfileDialog_TorrentProfileDialog_FolderIssue,
  Web_TorrentProfileDialog_TorrentProfileDialog_GeneralError,
  Web_TorrentProfileDialog_TorrentProfileDialog_IdleMinutes,
  Web_TorrentProfileDialog_TorrentProfileDialog_IdleMinutesState,
  Web_TorrentProfileDialog_TorrentProfileDialog_IdleMinutesValue,
  Web_TorrentProfileDialog_TorrentProfileDialog_LabelPresets,
  Web_TorrentProfileDialog_TorrentProfileDialog_Labels,
  Web_TorrentProfileDialog_TorrentProfileDialog_LabelsState,
  Web_TorrentProfileDialog_TorrentProfileDialog_Mode,
  Web_TorrentProfileDialog_TorrentProfileDialog_MoveConfirmation,
  Web_TorrentProfileDialog_TorrentProfileDialog_MoveConfirmationState,
  Web_TorrentProfileDialog_TorrentProfileDialog_MoveResults,
  Web_TorrentProfileDialog_TorrentProfileDialog_MoveResultsState,
  Web_TorrentProfileDialog_TorrentProfileDialog_MoveTorrentNoun,
  Web_TorrentProfileDialog_TorrentProfileDialog_Name,
  Web_TorrentProfileDialog_TorrentProfileDialog_NameIssue,
  Web_TorrentProfileDialog_TorrentProfileDialog_NameState,
  Web_TorrentProfileDialog_TorrentProfileDialog_NextPatterns,
  Web_TorrentProfileDialog_TorrentProfileDialog_OnClose,
  Web_TorrentProfileDialog_TorrentProfileDialog_OnSave,
  Web_TorrentProfileDialog_TorrentProfileDialog_Open,
  Web_TorrentProfileDialog_TorrentProfileDialog_Options,
  Web_TorrentProfileDialog_TorrentProfileDialog_OverlapProfileNames,
  Web_TorrentProfileDialog_TorrentProfileDialog_OverlapProfileNoun,
  Web_TorrentProfileDialog_TorrentProfileDialog_PatternInputRefs,
  Web_TorrentProfileDialog_TorrentProfileDialog_PatternInputs,
  Web_TorrentProfileDialog_TorrentProfileDialog_PatternOverlaps,
  Web_TorrentProfileDialog_TorrentProfileDialog_Patterns,
  Web_TorrentProfileDialog_TorrentProfileDialog_PatternsState,
  Web_TorrentProfileDialog_TorrentProfileDialog_PatternTryName,
  Web_TorrentProfileDialog_TorrentProfileDialog_PatternTryNameState,
  Web_TorrentProfileDialog_TorrentProfileDialog_PeerLimit,
  Web_TorrentProfileDialog_TorrentProfileDialog_PeerLimitState,
  Web_TorrentProfileDialog_TorrentProfileDialog_PendingIndex,
  Web_TorrentProfileDialog_TorrentProfileDialog_PendingInput,
  Web_TorrentProfileDialog_TorrentProfileDialog_PendingPatternFocus,
  Web_TorrentProfileDialog_TorrentProfileDialog_PendingPatternFocusRef,
  Web_TorrentProfileDialog_TorrentProfileDialog_Priority,
  Web_TorrentProfileDialog_TorrentProfileDialog_PriorityState,
  Web_TorrentProfileDialog_TorrentProfileDialog_Profile,
  Web_TorrentProfileDialog_TorrentProfileDialog_ProfilePickerId,
  Web_TorrentProfileDialog_TorrentProfileDialog_Profiles,
  Web_TorrentProfileDialog_TorrentProfileDialog_Props,
  Web_TorrentProfileDialog_TorrentProfileDialog_Queue,
  Web_TorrentProfileDialog_TorrentProfileDialog_QueueState,
  Web_TorrentProfileDialog_TorrentProfileDialog_Ratio,
  Web_TorrentProfileDialog_TorrentProfileDialog_RatioState,
  Web_TorrentProfileDialog_TorrentProfileDialog_RatioValue,
  Web_TorrentProfileDialog_TorrentProfileDialog_Returns,
  Web_TorrentProfileDialog_TorrentProfileDialog_SaveButtonLabel,
  Web_TorrentProfileDialog_TorrentProfileDialog_SaveError,
  Web_TorrentProfileDialog_TorrentProfileDialog_SaveErrorState,
  Web_TorrentProfileDialog_TorrentProfileDialog_SaveProfile,
  Web_TorrentProfileDialog_TorrentProfileDialog_SaveProfile_Event,
  Web_TorrentProfileDialog_TorrentProfileDialog_SaveProfile_Input,
  Web_TorrentProfileDialog_TorrentProfileDialog_SaveProfile_Returns,
  Web_TorrentProfileDialog_TorrentProfileDialog_SeedingMode,
  Web_TorrentProfileDialog_TorrentProfileDialog_SeedingModeState,
  Web_TorrentProfileDialog_TorrentProfileDialog_SetBrowserOpen,
  Web_TorrentProfileDialog_TorrentProfileDialog_SetBusy,
  Web_TorrentProfileDialog_TorrentProfileDialog_SetConnectionId,
  Web_TorrentProfileDialog_TorrentProfileDialog_SetDownloadDirectory,
  Web_TorrentProfileDialog_TorrentProfileDialog_SetDownloadLimit,
  Web_TorrentProfileDialog_TorrentProfileDialog_SetDownloadLimited,
  Web_TorrentProfileDialog_TorrentProfileDialog_SetIdleMinutes,
  Web_TorrentProfileDialog_TorrentProfileDialog_SetLabels,
  Web_TorrentProfileDialog_TorrentProfileDialog_SetMoveConfirmation,
  Web_TorrentProfileDialog_TorrentProfileDialog_SetMoveResults,
  Web_TorrentProfileDialog_TorrentProfileDialog_SetName,
  Web_TorrentProfileDialog_TorrentProfileDialog_SetPatterns,
  Web_TorrentProfileDialog_TorrentProfileDialog_SetPatternTryName,
  Web_TorrentProfileDialog_TorrentProfileDialog_SetPeerLimit,
  Web_TorrentProfileDialog_TorrentProfileDialog_SetPriority,
  Web_TorrentProfileDialog_TorrentProfileDialog_SetQueue,
  Web_TorrentProfileDialog_TorrentProfileDialog_SetRatio,
  Web_TorrentProfileDialog_TorrentProfileDialog_SetSaveError,
  Web_TorrentProfileDialog_TorrentProfileDialog_SetSeedingMode,
  Web_TorrentProfileDialog_TorrentProfileDialog_SetStartPaused,
  Web_TorrentProfileDialog_TorrentProfileDialog_SetUploadLimit,
  Web_TorrentProfileDialog_TorrentProfileDialog_SetUploadLimited,
  Web_TorrentProfileDialog_TorrentProfileDialog_Source,
  Web_TorrentProfileDialog_TorrentProfileDialog_StartPaused,
  Web_TorrentProfileDialog_TorrentProfileDialog_StartPausedState,
  Web_TorrentProfileDialog_TorrentProfileDialog_Title,
  Web_TorrentProfileDialog_TorrentProfileDialog_TrimmedTryName,
  Web_TorrentProfileDialog_TorrentProfileDialog_TryMatches,
  Web_TorrentProfileDialog_TorrentProfileDialog_UploadLimit,
  Web_TorrentProfileDialog_TorrentProfileDialog_UploadLimited,
  Web_TorrentProfileDialog_TorrentProfileDialog_UploadLimitedState,
  Web_TorrentProfileDialog_TorrentProfileDialog_UploadLimitKBps,
  Web_TorrentProfileDialog_TorrentProfileDialog_UploadLimitState,
} from '@/types/web/torrent-profile-dialog.d.ts';

/**
 * Torrent Profile Dialog - Parse Label List.
 *
 * Converts comma-separated labels into the API's string array.
 * Whitespace-only entries are discarded before validation.
 *
 * @param {Web_TorrentProfileDialog_ParseLabelList_Value} value - Value.
 *
 * @returns {Web_TorrentProfileDialog_ParseLabelList_Returns}
 *
 * @since 2.0.0
 */
const parseLabelList = (value: Web_TorrentProfileDialog_ParseLabelList_Value): Web_TorrentProfileDialog_ParseLabelList_Returns => {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
};

/**
 * Torrent Profile Dialog - Parse Patterns.
 *
 * Treats every non-empty row as one automatic-match pattern.
 * Trimming rows avoids invisible trailing characters in a glob.
 *
 * @param {Web_TorrentProfileDialog_ParsePatterns_Rows} rows - Rows.
 *
 * @returns {Web_TorrentProfileDialog_ParsePatterns_Returns}
 *
 * @since 2.0.0
 */
const parsePatterns = (rows: Web_TorrentProfileDialog_ParsePatterns_Rows): Web_TorrentProfileDialog_ParsePatterns_Returns => {
  return rows
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern !== '');
};

/**
 * Torrent Profile Dialog - Torrent Profile Dialog.
 *
 * Creates named profiles and edits named or Default profile-owned folder,
 * label, and Transmission option bundles.
 *
 * @param {Web_TorrentProfileDialog_TorrentProfileDialog_Props} props - Props.
 *
 * @returns {Web_TorrentProfileDialog_TorrentProfileDialog_Returns}
 *
 * @since 2.0.0
 */
export const TorrentProfileDialog = (props: Web_TorrentProfileDialog_TorrentProfileDialog_Props): Web_TorrentProfileDialog_TorrentProfileDialog_Returns => {
  const connections: Web_TorrentProfileDialog_TorrentProfileDialog_Connections = props['connections'];
  const defaultProfile: Web_TorrentProfileDialog_TorrentProfileDialog_DefaultProfile = props['defaultProfile'];
  const labelPresets: Web_TorrentProfileDialog_TorrentProfileDialog_LabelPresets = props['labelPresets'];
  const mode: Web_TorrentProfileDialog_TorrentProfileDialog_Mode = props['mode'];
  const onClose: Web_TorrentProfileDialog_TorrentProfileDialog_OnClose = props['onClose'];
  const onSave: Web_TorrentProfileDialog_TorrentProfileDialog_OnSave = props['onSave'];
  const open: Web_TorrentProfileDialog_TorrentProfileDialog_Open = props['open'];
  const profile: Web_TorrentProfileDialog_TorrentProfileDialog_Profile = props['profile'];
  const profiles: Web_TorrentProfileDialog_TorrentProfileDialog_Profiles = props['profiles'];
  const nameState: Web_TorrentProfileDialog_TorrentProfileDialog_NameState = useState<Web_TorrentProfileDialog_TorrentProfileDialog_Name>('');
  const name: Web_TorrentProfileDialog_TorrentProfileDialog_Name = nameState[0];
  const setName: Web_TorrentProfileDialog_TorrentProfileDialog_SetName = nameState[1];
  const downloadDirectoryState: Web_TorrentProfileDialog_TorrentProfileDialog_DownloadDirectoryState = useState<Web_TorrentProfileDialog_TorrentProfileDialog_DownloadDirectory>('/data/downloads/new');
  const downloadDirectory: Web_TorrentProfileDialog_TorrentProfileDialog_DownloadDirectory = downloadDirectoryState[0];
  const setDownloadDirectory: Web_TorrentProfileDialog_TorrentProfileDialog_SetDownloadDirectory = downloadDirectoryState[1];
  const labelsState: Web_TorrentProfileDialog_TorrentProfileDialog_LabelsState = useState<Web_TorrentProfileDialog_TorrentProfileDialog_Labels>('');
  const labels: Web_TorrentProfileDialog_TorrentProfileDialog_Labels = labelsState[0];
  const setLabels: Web_TorrentProfileDialog_TorrentProfileDialog_SetLabels = labelsState[1];
  const startPausedState: Web_TorrentProfileDialog_TorrentProfileDialog_StartPausedState = useState<Web_TorrentProfileDialog_TorrentProfileDialog_StartPaused>(false);
  const startPaused: Web_TorrentProfileDialog_TorrentProfileDialog_StartPaused = startPausedState[0];
  const setStartPaused: Web_TorrentProfileDialog_TorrentProfileDialog_SetStartPaused = startPausedState[1];
  const seedingModeState: Web_TorrentProfileDialog_TorrentProfileDialog_SeedingModeState = useState<Web_TorrentProfileDialog_TorrentProfileDialog_SeedingMode>('never');
  const seedingMode: Web_TorrentProfileDialog_TorrentProfileDialog_SeedingMode = seedingModeState[0];
  const setSeedingMode: Web_TorrentProfileDialog_TorrentProfileDialog_SetSeedingMode = seedingModeState[1];
  const ratioState: Web_TorrentProfileDialog_TorrentProfileDialog_RatioState = useState<Web_TorrentProfileDialog_TorrentProfileDialog_Ratio>('');
  const ratio: Web_TorrentProfileDialog_TorrentProfileDialog_Ratio = ratioState[0];
  const setRatio: Web_TorrentProfileDialog_TorrentProfileDialog_SetRatio = ratioState[1];
  const idleMinutesState: Web_TorrentProfileDialog_TorrentProfileDialog_IdleMinutesState = useState<Web_TorrentProfileDialog_TorrentProfileDialog_IdleMinutes>('');
  const idleMinutes: Web_TorrentProfileDialog_TorrentProfileDialog_IdleMinutes = idleMinutesState[0];
  const setIdleMinutes: Web_TorrentProfileDialog_TorrentProfileDialog_SetIdleMinutes = idleMinutesState[1];
  const downloadLimitedState: Web_TorrentProfileDialog_TorrentProfileDialog_DownloadLimitedState = useState<Web_TorrentProfileDialog_TorrentProfileDialog_DownloadLimited>(false);
  const downloadLimited: Web_TorrentProfileDialog_TorrentProfileDialog_DownloadLimited = downloadLimitedState[0];
  const setDownloadLimited: Web_TorrentProfileDialog_TorrentProfileDialog_SetDownloadLimited = downloadLimitedState[1];
  const downloadLimitState: Web_TorrentProfileDialog_TorrentProfileDialog_DownloadLimitState = useState<Web_TorrentProfileDialog_TorrentProfileDialog_DownloadLimit>('1000');
  const downloadLimit: Web_TorrentProfileDialog_TorrentProfileDialog_DownloadLimit = downloadLimitState[0];
  const setDownloadLimit: Web_TorrentProfileDialog_TorrentProfileDialog_SetDownloadLimit = downloadLimitState[1];
  const uploadLimitedState: Web_TorrentProfileDialog_TorrentProfileDialog_UploadLimitedState = useState<Web_TorrentProfileDialog_TorrentProfileDialog_UploadLimited>(false);
  const uploadLimited: Web_TorrentProfileDialog_TorrentProfileDialog_UploadLimited = uploadLimitedState[0];
  const setUploadLimited: Web_TorrentProfileDialog_TorrentProfileDialog_SetUploadLimited = uploadLimitedState[1];
  const uploadLimitState: Web_TorrentProfileDialog_TorrentProfileDialog_UploadLimitState = useState<Web_TorrentProfileDialog_TorrentProfileDialog_UploadLimit>('500');
  const uploadLimit: Web_TorrentProfileDialog_TorrentProfileDialog_UploadLimit = uploadLimitState[0];
  const setUploadLimit: Web_TorrentProfileDialog_TorrentProfileDialog_SetUploadLimit = uploadLimitState[1];
  const priorityState: Web_TorrentProfileDialog_TorrentProfileDialog_PriorityState = useState<Web_TorrentProfileDialog_TorrentProfileDialog_Priority>(0);
  const priority: Web_TorrentProfileDialog_TorrentProfileDialog_Priority = priorityState[0];
  const setPriority: Web_TorrentProfileDialog_TorrentProfileDialog_SetPriority = priorityState[1];
  const peerLimitState: Web_TorrentProfileDialog_TorrentProfileDialog_PeerLimitState = useState<Web_TorrentProfileDialog_TorrentProfileDialog_PeerLimit>('50');
  const peerLimit: Web_TorrentProfileDialog_TorrentProfileDialog_PeerLimit = peerLimitState[0];
  const setPeerLimit: Web_TorrentProfileDialog_TorrentProfileDialog_SetPeerLimit = peerLimitState[1];
  const queueState: Web_TorrentProfileDialog_TorrentProfileDialog_QueueState = useState<Web_TorrentProfileDialog_TorrentProfileDialog_Queue>('normal');
  const queue: Web_TorrentProfileDialog_TorrentProfileDialog_Queue = queueState[0];
  const setQueue: Web_TorrentProfileDialog_TorrentProfileDialog_SetQueue = queueState[1];
  const patternsState: Web_TorrentProfileDialog_TorrentProfileDialog_PatternsState = useState<Web_TorrentProfileDialog_TorrentProfileDialog_Patterns>([]);
  const patterns: Web_TorrentProfileDialog_TorrentProfileDialog_Patterns = patternsState[0];
  const setPatterns: Web_TorrentProfileDialog_TorrentProfileDialog_SetPatterns = patternsState[1];
  const patternTryNameState: Web_TorrentProfileDialog_TorrentProfileDialog_PatternTryNameState = useState<Web_TorrentProfileDialog_TorrentProfileDialog_PatternTryName>('');
  const patternTryName: Web_TorrentProfileDialog_TorrentProfileDialog_PatternTryName = patternTryNameState[0];
  const setPatternTryName: Web_TorrentProfileDialog_TorrentProfileDialog_SetPatternTryName = patternTryNameState[1];
  const patternInputRefs: Web_TorrentProfileDialog_TorrentProfileDialog_PatternInputRefs = useRef<Web_TorrentProfileDialog_TorrentProfileDialog_PatternInputs>([]);
  const pendingPatternFocusRef: Web_TorrentProfileDialog_TorrentProfileDialog_PendingPatternFocusRef = useRef<Web_TorrentProfileDialog_TorrentProfileDialog_PendingPatternFocus>(null);
  const connectionIDState: Web_TorrentProfileDialog_TorrentProfileDialog_ConnectionIdState = useState<Web_TorrentProfileDialog_TorrentProfileDialog_ConnectionId>('');
  const connectionID: Web_TorrentProfileDialog_TorrentProfileDialog_ConnectionId = connectionIDState[0];
  const setConnectionID: Web_TorrentProfileDialog_TorrentProfileDialog_SetConnectionId = connectionIDState[1];
  const browserOpenState: Web_TorrentProfileDialog_TorrentProfileDialog_BrowserOpenState = useState<Web_TorrentProfileDialog_TorrentProfileDialog_BrowserOpen>(false);
  const browserOpen: Web_TorrentProfileDialog_TorrentProfileDialog_BrowserOpen = browserOpenState[0];
  const setBrowserOpen: Web_TorrentProfileDialog_TorrentProfileDialog_SetBrowserOpen = browserOpenState[1];
  const moveConfirmationState: Web_TorrentProfileDialog_TorrentProfileDialog_MoveConfirmationState = useState<Web_TorrentProfileDialog_TorrentProfileDialog_MoveConfirmation>(null);
  const moveConfirmation: Web_TorrentProfileDialog_TorrentProfileDialog_MoveConfirmation = moveConfirmationState[0];
  const setMoveConfirmation: Web_TorrentProfileDialog_TorrentProfileDialog_SetMoveConfirmation = moveConfirmationState[1];
  const moveResultsState: Web_TorrentProfileDialog_TorrentProfileDialog_MoveResultsState = useState<Web_TorrentProfileDialog_TorrentProfileDialog_MoveResults>(null);
  const moveResults: Web_TorrentProfileDialog_TorrentProfileDialog_MoveResults = moveResultsState[0];
  const setMoveResults: Web_TorrentProfileDialog_TorrentProfileDialog_SetMoveResults = moveResultsState[1];
  const busyState: Web_TorrentProfileDialog_TorrentProfileDialog_BusyState = useState<Web_TorrentProfileDialog_TorrentProfileDialog_Busy>(false);
  const busy: Web_TorrentProfileDialog_TorrentProfileDialog_Busy = busyState[0];
  const setBusy: Web_TorrentProfileDialog_TorrentProfileDialog_SetBusy = busyState[1];
  const saveErrorState: Web_TorrentProfileDialog_TorrentProfileDialog_SaveErrorState = useState<Web_TorrentProfileDialog_TorrentProfileDialog_SaveError>(null);
  const saveError: Web_TorrentProfileDialog_TorrentProfileDialog_SaveError = saveErrorState[0];
  const setSaveError: Web_TorrentProfileDialog_TorrentProfileDialog_SetSaveError = saveErrorState[1];

  useEffect(() => {
    const pendingIndex: Web_TorrentProfileDialog_TorrentProfileDialog_PendingIndex = pendingPatternFocusRef.current;

    if (pendingIndex !== null) {
      const pendingInput: Web_TorrentProfileDialog_TorrentProfileDialog_PendingInput = patternInputRefs.current[pendingIndex];

      if (pendingInput !== undefined && pendingInput !== null) {
        pendingInput.focus();
      }

      pendingPatternFocusRef.current = null;
    }

    return;
  }, [patterns]);

  useEffect(() => {
    if (open === false) {
      return;
    }

    const source: Web_TorrentProfileDialog_TorrentProfileDialog_Source = (mode === 'default') ? defaultProfile : profile;
    const options: Web_TorrentProfileDialog_TorrentProfileDialog_Options = (source !== null) ? source['options'] : undefined;
    const ratioValue: Web_TorrentProfileDialog_TorrentProfileDialog_RatioValue = (options !== undefined) ? options['seeding']['ratio'] : null;
    const idleMinutesValue: Web_TorrentProfileDialog_TorrentProfileDialog_IdleMinutesValue = (options !== undefined) ? options['seeding']['idleMinutes'] : null;
    const downloadLimitKBps: Web_TorrentProfileDialog_TorrentProfileDialog_DownloadLimitKBps = (options !== undefined) ? options['downloadLimitKBps'] : undefined;
    const uploadLimitKBps: Web_TorrentProfileDialog_TorrentProfileDialog_UploadLimitKBps = (options !== undefined) ? options['uploadLimitKBps'] : undefined;

    setName((source !== null) ? source['name'] : '');
    setDownloadDirectory((source !== null) ? source['downloadDirectory'] : '/data/downloads/new');
    setLabels((source !== null) ? source['labels'].join(', ') : '');
    setStartPaused((source !== null) ? source['startPaused'] : false);
    setSeedingMode((options !== undefined) ? options['seeding']['mode'] : 'never');
    setRatio((ratioValue !== null) ? ratioValue.toString() : '');
    setIdleMinutes((idleMinutesValue !== null) ? idleMinutesValue.toString() : '');
    setDownloadLimited(downloadLimitKBps !== null && downloadLimitKBps !== undefined);
    setDownloadLimit((downloadLimitKBps !== null && downloadLimitKBps !== undefined) ? downloadLimitKBps.toString() : '1000');
    setUploadLimited(uploadLimitKBps !== null && uploadLimitKBps !== undefined);
    setUploadLimit((uploadLimitKBps !== null && uploadLimitKBps !== undefined) ? uploadLimitKBps.toString() : '500');
    setPriority((options !== undefined) ? options['bandwidthPriority'] : 0);
    setPeerLimit((options !== undefined) ? options['peerLimit'].toString() : '50');
    setQueue((options !== undefined) ? options['queue'] : 'normal');
    setPatterns((profile !== null) ? profile['matchPatterns'] : []);
    setPatternTryName('');
    setConnectionID((profile !== null && profile['connectionId'] !== null) ? profile['connectionId'] : '');
    setBrowserOpen(false);
    setMoveConfirmation(null);
    setMoveResults(null);
    setBusy(false);
    setSaveError(null);

    return;
  }, [
    defaultProfile,
    mode,
    open,
    profile,
  ]);

  useEscapeKey(onClose, (
    open === true
    && busy === false
    && browserOpen === false
  ));

  if (open === false) {
    return null;
  }

  /**
   * Torrent Profile Dialog - Connection Name.
   *
   * Resolves a nullable named-profile choice through the current default VPN.
   * Missing relationships use neutral wording in the save confirmation.
   *
   * @param {Web_TorrentProfileDialog_TorrentProfileDialog_ConnectionName_TargetId} targetId - Target id.
   *
   * @returns {Web_TorrentProfileDialog_TorrentProfileDialog_ConnectionName_Returns}
   *
   * @since 2.0.0
   */
  const connectionName: Web_TorrentProfileDialog_TorrentProfileDialog_ConnectionName = (targetId: Web_TorrentProfileDialog_TorrentProfileDialog_ConnectionName_TargetId): Web_TorrentProfileDialog_TorrentProfileDialog_ConnectionName_Returns => {
    const connection: Web_TorrentProfileDialog_TorrentProfileDialog_ConnectionName_Connection = (targetId === '') ? connections.find((candidate) => candidate['default']) : connections.find((candidate) => candidate['id'] === targetId);

    return (connection !== undefined) ? connection['name'] : 'the selected connection';
  };

  /**
   * Torrent Profile Dialog - Build Input.
   *
   * Normalizes the shared controls and selects the matching Default or named
   * profile parser before a request leaves the dialog.
   *
   * @returns {Web_TorrentProfileDialog_TorrentProfileDialog_BuildInput_Returns}
   *
   * @since 2.0.0
   */
  const buildInput: Web_TorrentProfileDialog_TorrentProfileDialog_BuildInput = (): Web_TorrentProfileDialog_TorrentProfileDialog_BuildInput_Returns => {
    const sharedInput: Web_TorrentProfileDialog_TorrentProfileDialog_BuildInput_SharedInput = {
      downloadDirectory: downloadDirectory.trim(),
      labels: parseLabelList(labels),
      name,
      options: {
        bandwidthPriority: priority,
        downloadLimitKBps: (downloadLimited === true) ? Number(downloadLimit) : null,
        peerLimit: Number(peerLimit),
        queue,
        seeding: {
          idleMinutes: (seedingMode === 'limit' && idleMinutes !== '') ? Number(idleMinutes) : null,
          mode: seedingMode,
          ratio: (seedingMode === 'limit' && ratio !== '') ? Number(ratio) : null,
        },
        uploadLimitKBps: (uploadLimited === true) ? Number(uploadLimit) : null,
      },
      startPaused,
    };

    if (mode === 'default') {
      return parseDefaultTorrentProfileInput(sharedInput);
    }

    return parseTorrentProfileInput({
      ...sharedInput,
      connectionId: (connectionID === '') ? null : connectionID,
      matchPatterns: parsePatterns(patterns),
      name,
    });
  };

  /**
   * Torrent Profile Dialog - Save Profile.
   *
   * Opens the move confirmation when the API reports that an existing folder
   * or VPN change must move assigned torrents.
   *
   * @param {Web_TorrentProfileDialog_TorrentProfileDialog_SaveProfile_Event} event - Event.
   *
   * @returns {Web_TorrentProfileDialog_TorrentProfileDialog_SaveProfile_Returns}
   *
   * @since 2.0.0
   */
  const saveProfile: Web_TorrentProfileDialog_TorrentProfileDialog_SaveProfile = async (event: Web_TorrentProfileDialog_TorrentProfileDialog_SaveProfile_Event): Web_TorrentProfileDialog_TorrentProfileDialog_SaveProfile_Returns => {
    event.preventDefault();

    setBusy(true);
    setSaveError(null);

    try {
      const input: Web_TorrentProfileDialog_TorrentProfileDialog_SaveProfile_Input = buildInput();

      await onSave(input);

      onClose();
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError['code'] === 'torrents_must_move') {
        setMoveConfirmation({
          count: (typeof caughtError['details']['torrents'] === 'number') ? caughtError['details']['torrents'] : 0,
          input: buildInput(),
          message: caughtError.message,
        });
        setMoveResults(null);

        return;
      }

      setSaveError(caughtError);
    } finally {
      setBusy(false);
    }

    return;
  };

  const defaultConnection: Web_TorrentProfileDialog_TorrentProfileDialog_DefaultConnection = connections.find((connection) => connection['default']);
  const defaultConnectionName: Web_TorrentProfileDialog_TorrentProfileDialog_DefaultConnectionName = (defaultConnection !== undefined) ? defaultConnection['name'] : undefined;
  const nameIssue: Web_TorrentProfileDialog_TorrentProfileDialog_NameIssue = issueFor(saveError, 'name');
  const folderIssue: Web_TorrentProfileDialog_TorrentProfileDialog_FolderIssue = issueFor(saveError, 'downloadDirectory');
  const generalError: Web_TorrentProfileDialog_TorrentProfileDialog_GeneralError = (folderIssue !== '' || nameIssue !== '') ? '' : connectionBeingRemovedMessage(
    saveError,
    connectionName(connectionID),
  ) ?? ((saveError instanceof Error) ? saveError.message : '');
  let profilePickerID: Web_TorrentProfileDialog_TorrentProfileDialog_ProfilePickerId = 'new';

  if (mode === 'default') {
    profilePickerID = 'default';
  } else if (profile !== null) {
    profilePickerID = profile['id'];
  }

  const fields: Web_TorrentProfileDialog_TorrentProfileDialog_Fields = torrentProfileDialogFields(mode);
  const currentPatterns: Web_TorrentProfileDialog_TorrentProfileDialog_CurrentPatterns = parsePatterns(patterns);
  const trimmedTryName: Web_TorrentProfileDialog_TorrentProfileDialog_TrimmedTryName = patternTryName.trim();
  const tryMatches: Web_TorrentProfileDialog_TorrentProfileDialog_TryMatches = (trimmedTryName === '') ? [] : currentPatterns.filter(
    (pattern) => torrentNameMatchesPattern(trimmedTryName, pattern),
  );
  const patternOverlaps: Web_TorrentProfileDialog_TorrentProfileDialog_PatternOverlaps = profiles.flatMap(
    (otherProfile) => {
      if (profile !== null && otherProfile['id'] === profile['id']) {
        return [];
      }

      return currentPatterns.flatMap((ownPattern) => (
        otherProfile['matchPatterns'].flatMap((otherPattern) => (
          (torrentPatternsOverlap(ownPattern, otherPattern) === true) ? [{
            ownPattern,
            pattern: otherPattern,
            profileId: otherProfile['id'],
            profileName: otherProfile['name'],
          }] : []
        ))
      ));
    },
  );
  const overlapProfileNames: Web_TorrentProfileDialog_TorrentProfileDialog_OverlapProfileNames = new Intl.ListFormat('en', { type: 'conjunction' }).format([...new Set(patternOverlaps.map((overlap) => overlap['profileName']))]);
  const overlapProfileNoun: Web_TorrentProfileDialog_TorrentProfileDialog_OverlapProfileNoun = (new Set(patternOverlaps.map((overlap) => overlap['profileId'])).size === 1) ? 'profile' : 'profiles';
  const moveTorrentNoun: Web_TorrentProfileDialog_TorrentProfileDialog_MoveTorrentNoun = (moveConfirmation !== null && moveConfirmation['count'] === 1) ? 'torrent' : 'torrents';
  let title: Web_TorrentProfileDialog_TorrentProfileDialog_Title = 'New profile';

  if (mode === 'default') {
    title = `Edit ${defaultProfile['name']}`;
  } else if (mode === 'edit' && profile !== null) {
    title = `Edit ${profile['name']} profile`;
  }

  let saveButtonLabel: Web_TorrentProfileDialog_TorrentProfileDialog_SaveButtonLabel = (mode === 'create') ? 'Create profile' : 'Save profile';

  if (busy === true) {
    saveButtonLabel = 'Saving…';
  }

  return (
    <div className="dialog-backdrop profile-editor-backdrop" role="presentation">
      <section aria-labelledby="torrent-profile-title" aria-modal="true" className="dialog dialog-wide" role="dialog">
        <div className="dialog-heading">
          <div>
            <h2 id="torrent-profile-title">{title}</h2>
            <p>Apply the same folder, labels, and limits when a torrent uses this profile.</p>
          </div>
          <button aria-label="Close" className="icon-button" disabled={busy} onClick={onClose} type="button"><Icon name="x" /></button>
        </div>

        <form noValidate onSubmit={saveProfile}>
          <div className={(fields.includes('name') === true) ? 'field-row' : undefined}>
            {(fields.includes('name') === false) ? null : (
              <label className="field">
                <span>Name</span>
                <input aria-invalid={nameIssue !== ''} onChange={(event) => setName(event.currentTarget.value)} placeholder="e.g. TV shows" type="text" value={name} />
                {(nameIssue === '') ? null : <small className="field-error" role="alert">{nameIssue}</small>}
              </label>
            )}
            <div className="field">
              <span>Download folder *</span>
              <div className="directory-field-row">
                <input
                  aria-invalid={folderIssue !== ''}
                  aria-label="Download folder"
                  onChange={(event) => setDownloadDirectory(event.currentTarget.value)}
                  readOnly={mode === 'default' && defaultProfile['downloadDirectoryLocked']}
                  type="text"
                  value={downloadDirectory}
                />
                {(mode === 'default' && defaultProfile['downloadDirectoryLocked'] === true) ? null : (
                  <Button icon="folder" onClick={() => setBrowserOpen(true)} type="button">Browse</Button>
                )}
              </div>
              {(folderIssue === '') ? null : <small className="field-error" role="alert">{folderIssue}</small>}
              {(mode === 'default' && defaultProfile['downloadDirectoryLocked'] === true) ? (
                <small>The Download directory is locked by managed configuration.</small>
              ) : <small>Choose one folder inside /data for this profile.</small>}
            </div>
          </div>

          <LabelPicker labels={labelPresets} onChange={setLabels} title="Labels" value={labels} />
          <label aria-label="Start paused" className="check-row">
            <input checked={startPaused} onChange={(event) => setStartPaused(event.currentTarget.checked)} type="checkbox" />
            <span>
              <strong>Start paused</strong>
              <small>Review files before downloading.</small>
            </span>
          </label>

          {(mode !== 'default') ? null : (
            <label className="field">
              <span>VPN connection</span>
              <input className="profile-derived-value" readOnly type="text" value={defaultConnectionName ?? 'No default connection'} />
              <small>Always the default connection. Change it on the VPN page.</small>
            </label>
          )}

          {(fields.includes('connectionId') === false) ? null : (
            <label className="field">
              <span>VPN connection</span>
              <select onChange={(event) => setConnectionID(event.currentTarget.value)} value={connectionID}>
                <option value="">{`Default (${defaultConnectionName ?? 'connection'})`}</option>
                {connections.map((connection) => (
                  <option key={connection['id']} value={connection['id']}>{connection['name']}</option>
                ))}
              </select>
            </label>
          )}

          <div className="dialog-divider" />
          <div className="option-card-grid">
            <section className="option-card">
              <h3>Seeding</h3>
              <label className="field">
                <span>Stop</span>
                <select onChange={(event) => setSeedingMode(event.currentTarget.value as Web_TorrentProfileDialog_TorrentProfileDialog_SeedingMode)} value={seedingMode}>
                  <option value="never">Never stop</option>
                  <option value="limit">Stop at a limit</option>
                </select>
              </label>
              <div className="field-row">
                <label className="field">
                  <span>Ratio</span>
                  <input disabled={seedingMode !== 'limit'} min="0" onChange={(event) => setRatio(event.currentTarget.value)} step="0.1" type="number" value={ratio} />
                </label>
                <label className="field">
                  <span>Idle minutes</span>
                  <input disabled={seedingMode !== 'limit'} min="1" onChange={(event) => setIdleMinutes(event.currentTarget.value)} type="number" value={idleMinutes} />
                </label>
              </div>
            </section>

            <section className="option-card">
              <h3>Speed</h3>
              <div className="field-row">
                <label className="field">
                  <span>Download limit</span>
                  <select onChange={(event) => setDownloadLimited(event.currentTarget.value === 'limit')} value={(downloadLimited === true) ? 'limit' : 'unlimited'}>
                    <option value="unlimited">Unlimited</option>
                    <option value="limit">Limit</option>
                  </select>
                  <div className="input-suffix">
                    <input disabled={downloadLimited === false} min="1" onChange={(event) => setDownloadLimit(event.currentTarget.value)} type="number" value={downloadLimit} />
                    <span>KB/s</span>
                  </div>
                </label>
                <label className="field">
                  <span>Upload limit</span>
                  <select onChange={(event) => setUploadLimited(event.currentTarget.value === 'limit')} value={(uploadLimited === true) ? 'limit' : 'unlimited'}>
                    <option value="unlimited">Unlimited</option>
                    <option value="limit">Limit</option>
                  </select>
                  <div className="input-suffix">
                    <input disabled={uploadLimited === false} min="1" onChange={(event) => setUploadLimit(event.currentTarget.value)} type="number" value={uploadLimit} />
                    <span>KB/s</span>
                  </div>
                </label>
              </div>
            </section>

            <section className="option-card">
              <h3>Torrent options</h3>
              <div className="field-row">
                <label className="field">
                  <span>Priority</span>
                  <select onChange={(event) => setPriority(Number(event.currentTarget.value) as Web_TorrentProfileDialog_TorrentProfileDialog_Priority)} value={priority}>
                    <option value={-1}>Low</option>
                    <option value={0}>Normal</option>
                    <option value={1}>High</option>
                  </select>
                </label>
                <label className="field">
                  <span>Peer limit</span>
                  <input min="1" onChange={(event) => setPeerLimit(event.currentTarget.value)} type="number" value={peerLimit} />
                  <small>50 by default.</small>
                </label>
              </div>
              <label className="field">
                <span>Queue position</span>
                <select onChange={(event) => setQueue(event.currentTarget.value as Web_TorrentProfileDialog_TorrentProfileDialog_Queue)} value={queue}>
                  <option value="normal">Normal</option>
                  <option value="top">Top</option>
                </select>
              </label>
            </section>

            {(fields.includes('matchPatterns') === false) ? null : (
              <section className="option-card">
                <h3>Auto-detect</h3>
                <p className="option-card-intro">Torrents added by remote apps join this profile when their name matches one of these patterns.</p>
                <div className="field pattern-list-field">
                  <span id="profile-pattern-list-label">Name patterns</span>
                  <div className="settings-list-box">
                    <div className="settings-list-body">
                      {(patterns.length === 0) ? (
                        <div className="settings-list-empty-state">
                          <strong>No name patterns</strong>
                          <span>Remote apps choose this profile only by folder or label.</span>
                        </div>
                      ) : patterns.map((pattern, index) => (
                        <div className="settings-list-item" key={index}>
                          <div className="settings-list-row">
                            <input
                              aria-label={`Name pattern ${index + 1}`}
                              autoCapitalize="off"
                              autoComplete="off"
                              className="monospace"
                              maxLength={128}
                              onChange={(event) => {
                                const nextPatterns: Web_TorrentProfileDialog_TorrentProfileDialog_NextPatterns = [...patterns];

                                Reflect.set(nextPatterns, index, event.currentTarget.value);

                                setPatterns(nextPatterns);

                                return;
                              }}
                              placeholder="e.g. *S??E??*"
                              ref={(input) => {
                                Reflect.set(patternInputRefs.current, index, input);

                                return;
                              }}
                              spellCheck={false}
                              type="text"
                              value={pattern}
                            />
                            <button
                              aria-label={`Remove name pattern ${index + 1}`}
                              className="icon-button settings-list-remove"
                              onClick={() => setPatterns(patterns.filter((_row, rowIndex) => rowIndex !== index))}
                              title="Remove"
                              type="button"
                            >
                              <Icon name="remove" size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="settings-list-footer">
                      <Button
                        disabled={patterns.length >= 64}
                        icon="add"
                        onClick={() => {
                          pendingPatternFocusRef.current = patterns.length;

                          setPatterns([
                            ...patterns,
                            '',
                          ]);

                          return;
                        }}
                      >
                        Add pattern
                      </Button>
                      <small className="settings-list-hint">Up to 64 patterns.</small>
                    </div>
                  </div>
                  {/* Contains-style patterns overlap with almost any other, so name each other profile once in one note. */}
                  {(patternOverlaps.length === 0) ? null : (
                    <small>
                      {`Can also match the ${overlapProfileNames} ${overlapProfileNoun}. A torrent that matches more than one will ask you to choose.`}
                    </small>
                  )}
                </div>

                <details className="pattern-guide">
                  <summary>How to write a pattern</summary>
                  <p>A pattern is a torrent name with stand-ins for the parts that change. It must match the whole name, and capital letters don&apos;t matter.</p>
                  <dl className="pattern-guide-symbols">
                    <div>
                      <dt><code>*</code></dt>
                      <dd>Any text, or none</dd>
                    </div>
                    <div>
                      <dt><code>?</code></dt>
                      <dd>Exactly one character</dd>
                    </div>
                  </dl>
                  <p>
                    Everything else, dots and dashes included, must appear as typed. To match a word anywhere in the name, put
                    {' '}
                    <code>*</code>
                    {' '}
                    on both sides.
                  </p>
                  <table className="pattern-guide-examples">
                    <thead>
                      <tr>
                        <th scope="col">Pattern</th>
                        <th scope="col">Matches</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><code>*S??E??*</code></td>
                        <td>TV episodes, like Show.Name.S01E02.1080p</td>
                      </tr>
                      <tr>
                        <td><code>*2160p*</code></td>
                        <td>Any name with 2160p in it</td>
                      </tr>
                      <tr>
                        <td><code>ubuntu-*.iso</code></td>
                        <td>Names that start with ubuntu- and end in .iso</td>
                      </tr>
                      <tr>
                        <td><code>Show Name*</code></td>
                        <td>Names that start with Show Name</td>
                      </tr>
                    </tbody>
                  </table>
                  <label className="field">
                    <span>Try a name</span>
                    <input
                      autoCapitalize="off"
                      autoComplete="off"
                      onChange={(event) => setPatternTryName(event.currentTarget.value)}
                      placeholder="Paste a torrent name"
                      spellCheck={false}
                      type="text"
                      value={patternTryName}
                    />
                    {(trimmedTryName === '') ? null : (
                      <small aria-live="polite" className={(tryMatches.length === 0) ? 'pattern-try-result' : 'pattern-try-result pattern-try-result-match'}>
                        {(tryMatches.length === 0) ? 'No pattern matches this name.' : `Matches ${new Intl.ListFormat('en', { type: 'conjunction' }).format(tryMatches)}.`}
                      </small>
                    )}
                  </label>
                </details>
              </section>
            )}
          </div>

          {(generalError === '') ? null : <div className="form-error" role="alert">{generalError}</div>}
          <div className="dialog-actions">
            <Button disabled={busy} onClick={onClose}>Cancel</Button>
            <Button disabled={busy} type="submit" variant="primary">{saveButtonLabel}</Button>
          </div>
        </form>
      </section>

      <DirectoryBrowserDialog
        initialPath={(downloadDirectory.startsWith('/data') === true) ? downloadDirectory : '/data'}
        onClose={() => setBrowserOpen(false)}
        onSelect={(path) => {
          setDownloadDirectory(path);
          setBrowserOpen(false);
          setSaveError(null);

          return;
        }}
        open={browserOpen}
        profileId={profilePickerID}
        purpose="profile"
      />

      {(moveConfirmation === null) ? null : (
        <div className="dialog-backdrop dialog-backdrop-stacked" role="presentation">
          <section aria-labelledby="move-profile-torrents-title" aria-modal="true" className="dialog dialog-small dialog-stacked" role="alertdialog">
            <div className="dialog-heading">
              <div>
                <h2 id="move-profile-torrents-title">
                  {(moveResults === null)
                    ? `Save and move ${moveConfirmation['count']} ${moveTorrentNoun}?`
                    : 'Move results'}
                </h2>
                <p>{(moveResults === null) ? moveConfirmation['message'] : 'The profile was saved. Review each torrent move below.'}</p>
              </div>
            </div>
            {(moveResults === null) ? null : (
              <div className="torrent-move-results">
                <ul>
                  {moveResults.map((result) => (
                    <li className={(result['result'] === 'failed') ? 'move-failed' : 'move-succeeded'} key={result['hash']}>
                      <strong>{result['name']}</strong>
                      <span className="move-result-copy">
                        <span className="move-result-state">
                          {torrentMoveResultLabel(result)}
                        </span>
                        {(result['warnings'] !== undefined) ? result['warnings'].map((warning) => <small key={warning}>{warning}</small>) : undefined}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(generalError === '') ? null : <div className="form-error" role="alert">{generalError}</div>}
            <div className="dialog-actions">
              {(moveResults === null) ? (
                <>
                  <Button disabled={busy} onClick={() => setMoveConfirmation(null)}>Cancel</Button>
                  <Button
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      setSaveError(null);

                      void onSave(moveConfirmation['input'], true).then((results) => {
                        setMoveResults(results);

                        return;
                      }).catch((caughtError) => {
                        setSaveError(caughtError);

                        return;
                      }).finally(() => setBusy(false));

                      return;
                    }}
                    variant="primary"
                  >
                    {(busy === true) ? 'Moving…' : 'Save and move'}
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => {
                    setMoveConfirmation(null);
                    onClose();

                    return;
                  }}
                  variant="primary"
                >
                  Done
                </Button>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
