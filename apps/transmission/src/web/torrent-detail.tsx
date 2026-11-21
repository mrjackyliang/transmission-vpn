import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { connectionBeingRemovedMessage } from '@/web/api.ts';
import { FieldLabel } from '@/web/field-label.tsx';
import { LabelPicker } from '@/web/organization-controls.tsx';
import { PieceMapSection } from '@/web/piece-map-section.tsx';
import {
  Button,
  Icon,
} from '@/web/primitives.tsx';
import { showToast } from '@/web/toast.ts';
import {
  formatBytes,
  formatDate,
  formatDuration,
  formatPercent,
  formatRate,
  formatRatio,
} from '@/web/torrent-format.ts';
import {
  describeTorrentState,
  describeTrackerIssue,
  torrentProgress,
} from '@/web/torrent-library.ts';
import { torrentMoveResultLabel } from '@/web/torrent-move-result.ts';
import {
  describeTorrentProfileChange,
  torrentProfileRefreshID,
} from '@/web/torrent-profile-change.ts';
import { torrentNameMatchesPattern } from '@/web/torrent-profile-matcher.ts';
import { useEscapeKey } from '@/web/use-escape-key.ts';

import type {
  Web_TorrentDetail_CopyText_Returns,
  Web_TorrentDetail_CopyText_Value,
  Web_TorrentDetail_FileDraftsFromDetail_Drafts,
  Web_TorrentDetail_FileDraftsFromDetail_FileCount,
  Web_TorrentDetail_FileDraftsFromDetail_Files,
  Web_TorrentDetail_FileDraftsFromDetail_FileStats,
  Web_TorrentDetail_FileDraftsFromDetail_Returns,
  Web_TorrentDetail_FileDraftsFromDetail_Statistics,
  Web_TorrentDetail_FileDraftsFromDetail_StatisticsPriority,
  Web_TorrentDetail_FileDraftsFromDetail_StatisticsWanted,
  Web_TorrentDetail_OptionsFromDetail_Detail,
  Web_TorrentDetail_OptionsFromDetail_Returns,
  Web_TorrentDetail_TorrentDetail_ApplyProfileOptions,
  Web_TorrentDetail_TorrentDetail_ApplyProfileOptionsState,
  Web_TorrentDetail_TorrentDetail_ApplyTorrentProfile,
  Web_TorrentDetail_TorrentDetail_ApplyTorrentProfile_DefaultConnection,
  Web_TorrentDetail_TorrentDetail_ApplyTorrentProfile_Response,
  Web_TorrentDetail_TorrentDetail_ApplyTorrentProfile_Returns,
  Web_TorrentDetail_TorrentDetail_ApplyTorrentProfile_SelectedProfile,
  Web_TorrentDetail_TorrentDetail_ApplyTorrentProfile_TargetConnection,
  Web_TorrentDetail_TorrentDetail_ApplyTorrentProfile_TargetConnectionId,
  Web_TorrentDetail_TorrentDetail_ApplyTorrentProfile_TargetConnectionName,
  Web_TorrentDetail_TorrentDetail_AssignedProfile,
  Web_TorrentDetail_TorrentDetail_AssignedProfileName,
  Web_TorrentDetail_TorrentDetail_Busy,
  Web_TorrentDetail_TorrentDetail_BusyState,
  Web_TorrentDetail_TorrentDetail_Completed,
  Web_TorrentDetail_TorrentDetail_Connections,
  Web_TorrentDetail_TorrentDetail_DefaultConnection,
  Web_TorrentDetail_TorrentDetail_DefaultProfile,
  Web_TorrentDetail_TorrentDetail_Detail,
  Web_TorrentDetail_TorrentDetail_DetailConnection,
  Web_TorrentDetail_TorrentDetail_DetailConnectionId,
  Web_TorrentDetail_TorrentDetail_DetailDownloadDir,
  Web_TorrentDetail_TorrentDetail_DetailFiles,
  Web_TorrentDetail_TorrentDetail_DetailId,
  Web_TorrentDetail_TorrentDetail_DetailName,
  Web_TorrentDetail_TorrentDetail_DetailNeedsProfile,
  Web_TorrentDetail_TorrentDetail_DetailProfileId,
  Web_TorrentDetail_TorrentDetail_Draft,
  Web_TorrentDetail_TorrentDetail_EtaLabel,
  Web_TorrentDetail_TorrentDetail_FileDrafts,
  Web_TorrentDetail_TorrentDetail_FileDraftsState,
  Web_TorrentDetail_TorrentDetail_FileQuery,
  Web_TorrentDetail_TorrentDetail_FileQueryState,
  Web_TorrentDetail_TorrentDetail_FilteredFiles,
  Web_TorrentDetail_TorrentDetail_LabelPresets,
  Web_TorrentDetail_TorrentDetail_Length,
  Web_TorrentDetail_TorrentDetail_Loading,
  Web_TorrentDetail_TorrentDetail_MatchingPattern,
  Web_TorrentDetail_TorrentDetail_MatchingResolutionProfiles,
  Web_TorrentDetail_TorrentDetail_NextPriority,
  Web_TorrentDetail_TorrentDetail_NextWanted,
  Web_TorrentDetail_TorrentDetail_NormalizedQuery,
  Web_TorrentDetail_TorrentDetail_OnAction,
  Web_TorrentDetail_TorrentDetail_OnClose,
  Web_TorrentDetail_TorrentDetail_OnRefresh,
  Web_TorrentDetail_TorrentDetail_OnRename,
  Web_TorrentDetail_TorrentDetail_OnSetProfile,
  Web_TorrentDetail_TorrentDetail_OnUpdate,
  Web_TorrentDetail_TorrentDetail_Options,
  Web_TorrentDetail_TorrentDetail_OptionsBandwidthPriority,
  Web_TorrentDetail_TorrentDetail_OptionsSeedIdleMode,
  Web_TorrentDetail_TorrentDetail_OptionsSeedRatioMode,
  Web_TorrentDetail_TorrentDetail_OptionsState,
  Web_TorrentDetail_TorrentDetail_ProfileChangeHint,
  Web_TorrentDetail_TorrentDetail_ProfileId,
  Web_TorrentDetail_TorrentDetail_ProfileIdState,
  Web_TorrentDetail_TorrentDetail_ProfileMoveResults,
  Web_TorrentDetail_TorrentDetail_ProfileMoveResultsState,
  Web_TorrentDetail_TorrentDetail_Profiles,
  Web_TorrentDetail_TorrentDetail_Progress,
  Web_TorrentDetail_TorrentDetail_Props,
  Web_TorrentDetail_TorrentDetail_RenameAvailable,
  Web_TorrentDetail_TorrentDetail_RenameName,
  Web_TorrentDetail_TorrentDetail_RenameNameState,
  Web_TorrentDetail_TorrentDetail_RenameTorrent,
  Web_TorrentDetail_TorrentDetail_RenameTorrent_Event,
  Web_TorrentDetail_TorrentDetail_RenameTorrent_Returns,
  Web_TorrentDetail_TorrentDetail_ResolutionAllowsAnyProfile,
  Web_TorrentDetail_TorrentDetail_ResolutionError,
  Web_TorrentDetail_TorrentDetail_ResolutionErrorState,
  Web_TorrentDetail_TorrentDetail_ResolutionOpen,
  Web_TorrentDetail_TorrentDetail_ResolutionOpenState,
  Web_TorrentDetail_TorrentDetail_ResolutionProfileIDs,
  Web_TorrentDetail_TorrentDetail_ResolutionProfiles,
  Web_TorrentDetail_TorrentDetail_ResolutionResults,
  Web_TorrentDetail_TorrentDetail_ResolutionResultsState,
  Web_TorrentDetail_TorrentDetail_ResolveTorrentProfile,
  Web_TorrentDetail_TorrentDetail_ResolveTorrentProfile_Response,
  Web_TorrentDetail_TorrentDetail_ResolveTorrentProfile_Returns,
  Web_TorrentDetail_TorrentDetail_ResolveTorrentProfile_SelectedProfileId,
  Web_TorrentDetail_TorrentDetail_Returns,
  Web_TorrentDetail_TorrentDetail_RunMutation,
  Web_TorrentDetail_TorrentDetail_RunMutation_Mutation,
  Web_TorrentDetail_TorrentDetail_RunMutation_Returns,
  Web_TorrentDetail_TorrentDetail_RunMutation_SuccessMessage,
  Web_TorrentDetail_TorrentDetail_SaveFiles,
  Web_TorrentDetail_TorrentDetail_SaveFiles_Changes,
  Web_TorrentDetail_TorrentDetail_SaveFiles_Draft,
  Web_TorrentDetail_TorrentDetail_SaveFiles_FilesUnwanted,
  Web_TorrentDetail_TorrentDetail_SaveFiles_FilesWanted,
  Web_TorrentDetail_TorrentDetail_SaveFiles_Index,
  Web_TorrentDetail_TorrentDetail_SaveFiles_IndexValue,
  Web_TorrentDetail_TorrentDetail_SaveFiles_PriorityHigh,
  Web_TorrentDetail_TorrentDetail_SaveFiles_PriorityLow,
  Web_TorrentDetail_TorrentDetail_SaveFiles_PriorityNormal,
  Web_TorrentDetail_TorrentDetail_SaveFiles_Returns,
  Web_TorrentDetail_TorrentDetail_SaveOptions,
  Web_TorrentDetail_TorrentDetail_SaveOptions_Changes,
  Web_TorrentDetail_TorrentDetail_SaveOptions_Event,
  Web_TorrentDetail_TorrentDetail_SaveOptions_Labels,
  Web_TorrentDetail_TorrentDetail_SaveOptions_Returns,
  Web_TorrentDetail_TorrentDetail_SaveTrackers,
  Web_TorrentDetail_TorrentDetail_SaveTrackers_Returns,
  Web_TorrentDetail_TorrentDetail_SelectedProfile,
  Web_TorrentDetail_TorrentDetail_SelectedProfileChanged,
  Web_TorrentDetail_TorrentDetail_SelectedProfileConnection,
  Web_TorrentDetail_TorrentDetail_SelectedProfileConnectionID,
  Web_TorrentDetail_TorrentDetail_SelectedProfileConnectionName,
  Web_TorrentDetail_TorrentDetail_SelectedProfileData,
  Web_TorrentDetail_TorrentDetail_SetAllFiles,
  Web_TorrentDetail_TorrentDetail_SetAllFiles_Draft,
  Web_TorrentDetail_TorrentDetail_SetAllFiles_Index,
  Web_TorrentDetail_TorrentDetail_SetAllFiles_NextDrafts,
  Web_TorrentDetail_TorrentDetail_SetAllFiles_Returns,
  Web_TorrentDetail_TorrentDetail_SetAllFiles_Wanted,
  Web_TorrentDetail_TorrentDetail_SetAllPriorities,
  Web_TorrentDetail_TorrentDetail_SetAllPriorities_Draft,
  Web_TorrentDetail_TorrentDetail_SetAllPriorities_Index,
  Web_TorrentDetail_TorrentDetail_SetAllPriorities_NextDrafts,
  Web_TorrentDetail_TorrentDetail_SetAllPriorities_Priority,
  Web_TorrentDetail_TorrentDetail_SetAllPriorities_Returns,
  Web_TorrentDetail_TorrentDetail_SetApplyProfileOptions,
  Web_TorrentDetail_TorrentDetail_SetBusy,
  Web_TorrentDetail_TorrentDetail_SetFileDrafts,
  Web_TorrentDetail_TorrentDetail_SetFileQuery,
  Web_TorrentDetail_TorrentDetail_SetOptions,
  Web_TorrentDetail_TorrentDetail_SetProfileId,
  Web_TorrentDetail_TorrentDetail_SetProfileMoveResults,
  Web_TorrentDetail_TorrentDetail_SetRenameName,
  Web_TorrentDetail_TorrentDetail_SetResolutionError,
  Web_TorrentDetail_TorrentDetail_SetResolutionOpen,
  Web_TorrentDetail_TorrentDetail_SetResolutionResults,
  Web_TorrentDetail_TorrentDetail_SetTab,
  Web_TorrentDetail_TorrentDetail_SetTrackerList,
  Web_TorrentDetail_TorrentDetail_Tab,
  Web_TorrentDetail_TorrentDetail_TabKeys,
  Web_TorrentDetail_TorrentDetail_TabLabels,
  Web_TorrentDetail_TorrentDetail_TabState,
  Web_TorrentDetail_TorrentDetail_TrackerIssue,
  Web_TorrentDetail_TorrentDetail_TrackerList,
  Web_TorrentDetail_TorrentDetail_TrackerListState,
  Web_TorrentDetail_TorrentDetail_TrackerStatus,
  Web_TorrentDetail_TrackerListFromDetail_Group,
  Web_TorrentDetail_TrackerListFromDetail_Returns,
  Web_TorrentDetail_TrackerListFromDetail_TrackerGroups,
  Web_TorrentDetail_TrackerListFromDetail_TrackerList,
  Web_TorrentDetail_TrackerListFromDetail_Trackers,
} from '@/types/web/torrent-detail.d.ts';

/**
 * Torrent Detail - Copy Text.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_TorrentDetail_CopyText_Value} value - Value.
 *
 * @returns {Web_TorrentDetail_CopyText_Returns}
 *
 * @since 2.0.0
 */
const copyText = async (value: Web_TorrentDetail_CopyText_Value): Web_TorrentDetail_CopyText_Returns => {
  await navigator.clipboard.writeText(value);

  return;
};

/**
 * Torrent Detail - Tracker List From Detail.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_TorrentDetail_TrackerListFromDetail_TrackerList} trackerList - Tracker list.
 * @param {Web_TorrentDetail_TrackerListFromDetail_Trackers}    trackers    - Trackers.
 *
 * @returns {Web_TorrentDetail_TrackerListFromDetail_Returns}
 *
 * @since 2.0.0
 */
const trackerListFromDetail = (
  trackerList: Web_TorrentDetail_TrackerListFromDetail_TrackerList,
  trackers: Web_TorrentDetail_TrackerListFromDetail_Trackers,
): Web_TorrentDetail_TrackerListFromDetail_Returns => {
  if (trackerList !== undefined) {
    return trackerList;
  }

  const trackerGroups: Web_TorrentDetail_TrackerListFromDetail_TrackerGroups = new Map();

  for (const tracker of trackers ?? []) {
    const group: Web_TorrentDetail_TrackerListFromDetail_Group = trackerGroups.get(tracker['tier']) ?? [];

    group.push(tracker['announce']);

    trackerGroups.set(tracker['tier'], group);
  }

  return [...trackerGroups.values()].map((group) => group.join('\n')).join('\n\n');
};

/**
 * Torrent Detail - File Drafts From Detail.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_TorrentDetail_FileDraftsFromDetail_Files}     files     - Files.
 * @param {Web_TorrentDetail_FileDraftsFromDetail_FileStats} fileStats - File stats.
 *
 * @returns {Web_TorrentDetail_FileDraftsFromDetail_Returns}
 *
 * @since 2.0.0
 */
const fileDraftsFromDetail = (
  files: Web_TorrentDetail_FileDraftsFromDetail_Files,
  fileStats: Web_TorrentDetail_FileDraftsFromDetail_FileStats,
): Web_TorrentDetail_FileDraftsFromDetail_Returns => {
  const drafts: Web_TorrentDetail_FileDraftsFromDetail_Drafts = {};
  const fileCount: Web_TorrentDetail_FileDraftsFromDetail_FileCount = (files !== undefined) ? files.length : 0;

  for (let index = 0; index < fileCount; index += 1) {
    const statistics: Web_TorrentDetail_FileDraftsFromDetail_Statistics = (fileStats !== undefined) ? fileStats[index] : undefined;
    const statisticsPriority: Web_TorrentDetail_FileDraftsFromDetail_StatisticsPriority = (statistics !== undefined) ? statistics['priority'] : undefined;
    const statisticsWanted: Web_TorrentDetail_FileDraftsFromDetail_StatisticsWanted = (statistics !== undefined) ? statistics['wanted'] : undefined;

    Reflect.set(drafts, index, {
      priority: statisticsPriority ?? 0,
      wanted: statisticsWanted ?? true,
    });
  }

  return drafts;
};

/**
 * Torrent Detail - Options From Detail.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_TorrentDetail_OptionsFromDetail_Detail} detail - Detail.
 *
 * @returns {Web_TorrentDetail_OptionsFromDetail_Returns}
 *
 * @since 2.0.0
 */
const optionsFromDetail = (
  detail: Web_TorrentDetail_OptionsFromDetail_Detail,
): Web_TorrentDetail_OptionsFromDetail_Returns => ({
  bandwidthPriority: detail['bandwidthPriority'] ?? 0,
  downloadLimit: detail['downloadLimit'] ?? 0,
  downloadLimited: detail['downloadLimited'] ?? false,
  honorsSessionLimits: detail['honorsSessionLimits'] ?? true,
  labels: detail['labels'].join(', '),
  peerLimit: (
    detail['peer-limit']
    ?? detail['maxConnectedPeers']
    ?? 50
  ),
  seedIdleLimit: detail['seedIdleLimit'] ?? 30,
  seedIdleMode: (detail['seedIdleMode'] === 1) ? 1 : 2,
  seedRatioLimit: detail['seedRatioLimit'] ?? 2,
  seedRatioMode: (detail['seedRatioMode'] === 1) ? 1 : 2,
  uploadLimit: detail['uploadLimit'] ?? 0,
  uploadLimited: detail['uploadLimited'] ?? false,
});

/**
 * Torrent Detail - Torrent Detail.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_TorrentDetail_TorrentDetail_Props} props - Props.
 *
 * @returns {Web_TorrentDetail_TorrentDetail_Returns}
 *
 * @since 2.0.0
 */
export const TorrentDetail = (props: Web_TorrentDetail_TorrentDetail_Props): Web_TorrentDetail_TorrentDetail_Returns => {
  const connections: Web_TorrentDetail_TorrentDetail_Connections = props['connections'];
  const defaultProfile: Web_TorrentDetail_TorrentDetail_DefaultProfile = props['defaultProfile'];
  const detail: Web_TorrentDetail_TorrentDetail_Detail = props['detail'];
  const labelPresets: Web_TorrentDetail_TorrentDetail_LabelPresets = props['labelPresets'];
  const loading: Web_TorrentDetail_TorrentDetail_Loading = props['loading'];
  const onAction: Web_TorrentDetail_TorrentDetail_OnAction = props['onAction'];
  const onClose: Web_TorrentDetail_TorrentDetail_OnClose = props['onClose'];
  const onRefresh: Web_TorrentDetail_TorrentDetail_OnRefresh = props['onRefresh'];
  const onRename: Web_TorrentDetail_TorrentDetail_OnRename = props['onRename'];
  const onSetProfile: Web_TorrentDetail_TorrentDetail_OnSetProfile = props['onSetProfile'];
  const onUpdate: Web_TorrentDetail_TorrentDetail_OnUpdate = props['onUpdate'];
  const profiles: Web_TorrentDetail_TorrentDetail_Profiles = props['profiles'];
  const tabState: Web_TorrentDetail_TorrentDetail_TabState = useState<Web_TorrentDetail_TorrentDetail_Tab>('overview');
  const tab: Web_TorrentDetail_TorrentDetail_Tab = tabState[0];
  const setTab: Web_TorrentDetail_TorrentDetail_SetTab = tabState[1];
  const fileQueryState: Web_TorrentDetail_TorrentDetail_FileQueryState = useState<Web_TorrentDetail_TorrentDetail_FileQuery>('');
  const fileQuery: Web_TorrentDetail_TorrentDetail_FileQuery = fileQueryState[0];
  const setFileQuery: Web_TorrentDetail_TorrentDetail_SetFileQuery = fileQueryState[1];
  const fileDraftsState: Web_TorrentDetail_TorrentDetail_FileDraftsState = useState<Web_TorrentDetail_TorrentDetail_FileDrafts>({});
  const fileDrafts: Web_TorrentDetail_TorrentDetail_FileDrafts = fileDraftsState[0];
  const setFileDrafts: Web_TorrentDetail_TorrentDetail_SetFileDrafts = fileDraftsState[1];
  const trackerListState: Web_TorrentDetail_TorrentDetail_TrackerListState = useState<Web_TorrentDetail_TorrentDetail_TrackerList>('');
  const trackerList: Web_TorrentDetail_TorrentDetail_TrackerList = trackerListState[0];
  const setTrackerList: Web_TorrentDetail_TorrentDetail_SetTrackerList = trackerListState[1];
  const optionsState: Web_TorrentDetail_TorrentDetail_OptionsState = useState<Web_TorrentDetail_TorrentDetail_Options>(null);
  const options: Web_TorrentDetail_TorrentDetail_Options = optionsState[0];
  const setOptions: Web_TorrentDetail_TorrentDetail_SetOptions = optionsState[1];
  const renameNameState: Web_TorrentDetail_TorrentDetail_RenameNameState = useState<Web_TorrentDetail_TorrentDetail_RenameName>('');
  const renameName: Web_TorrentDetail_TorrentDetail_RenameName = renameNameState[0];
  const setRenameName: Web_TorrentDetail_TorrentDetail_SetRenameName = renameNameState[1];
  const busyState: Web_TorrentDetail_TorrentDetail_BusyState = useState<Web_TorrentDetail_TorrentDetail_Busy>(false);
  const busy: Web_TorrentDetail_TorrentDetail_Busy = busyState[0];
  const setBusy: Web_TorrentDetail_TorrentDetail_SetBusy = busyState[1];
  const profileIdState: Web_TorrentDetail_TorrentDetail_ProfileIdState = useState<Web_TorrentDetail_TorrentDetail_ProfileId>('');
  const profileId: Web_TorrentDetail_TorrentDetail_ProfileId = profileIdState[0];
  const setProfileId: Web_TorrentDetail_TorrentDetail_SetProfileId = profileIdState[1];
  const applyProfileOptionsState: Web_TorrentDetail_TorrentDetail_ApplyProfileOptionsState = useState<Web_TorrentDetail_TorrentDetail_ApplyProfileOptions>(true);
  const applyProfileOptions: Web_TorrentDetail_TorrentDetail_ApplyProfileOptions = applyProfileOptionsState[0];
  const setApplyProfileOptions: Web_TorrentDetail_TorrentDetail_SetApplyProfileOptions = applyProfileOptionsState[1];
  const profileMoveResultsState: Web_TorrentDetail_TorrentDetail_ProfileMoveResultsState = useState<Web_TorrentDetail_TorrentDetail_ProfileMoveResults>([]);
  const profileMoveResults: Web_TorrentDetail_TorrentDetail_ProfileMoveResults = profileMoveResultsState[0];
  const setProfileMoveResults: Web_TorrentDetail_TorrentDetail_SetProfileMoveResults = profileMoveResultsState[1];
  const resolutionOpenState: Web_TorrentDetail_TorrentDetail_ResolutionOpenState = useState<Web_TorrentDetail_TorrentDetail_ResolutionOpen>(false);
  const resolutionOpen: Web_TorrentDetail_TorrentDetail_ResolutionOpen = resolutionOpenState[0];
  const setResolutionOpen: Web_TorrentDetail_TorrentDetail_SetResolutionOpen = resolutionOpenState[1];
  const resolutionResultsState: Web_TorrentDetail_TorrentDetail_ResolutionResultsState = useState<Web_TorrentDetail_TorrentDetail_ResolutionResults>(null);
  const resolutionResults: Web_TorrentDetail_TorrentDetail_ResolutionResults = resolutionResultsState[0];
  const setResolutionResults: Web_TorrentDetail_TorrentDetail_SetResolutionResults = resolutionResultsState[1];
  const resolutionErrorState: Web_TorrentDetail_TorrentDetail_ResolutionErrorState = useState<Web_TorrentDetail_TorrentDetail_ResolutionError>('');
  const resolutionError: Web_TorrentDetail_TorrentDetail_ResolutionError = resolutionErrorState[0];
  const setResolutionError: Web_TorrentDetail_TorrentDetail_SetResolutionError = resolutionErrorState[1];
  const detailId: Web_TorrentDetail_TorrentDetail_DetailId = (detail !== null) ? detail['id'] : undefined;
  const detailProfileId: Web_TorrentDetail_TorrentDetail_DetailProfileId = (detail !== null) ? detail['profileId'] : undefined;
  const detailFiles: Web_TorrentDetail_TorrentDetail_DetailFiles = (detail !== null) ? detail['files'] : undefined;

  useEffect(() => {
    setTab('overview');
    setFileQuery('');
    if (detail !== null) {
      setFileDrafts(fileDraftsFromDetail(detail['files'], detail['fileStats']));
      setTrackerList(trackerListFromDetail(detail['trackerList'], detail['trackers']));
      setOptions(optionsFromDetail(detail));
      setRenameName(detail['name']);
      setProfileId(detail['profileId'] ?? '');
      setApplyProfileOptions(true);
      setProfileMoveResults([]);
      setResolutionOpen(false);
      setResolutionResults(null);
      setResolutionError('');
    }

    return;
  }, [detailId]);

  useEffect(() => {
    setProfileId(detailProfileId ?? '');

    return;
  }, [detailProfileId]);

  const filteredFiles: Web_TorrentDetail_TorrentDetail_FilteredFiles = useMemo(() => {
    const normalizedQuery: Web_TorrentDetail_TorrentDetail_NormalizedQuery = fileQuery.trim().toLowerCase();

    return (detailFiles ?? [])
      .map((file, index) => ({
        file,
        index,
      }))
      .filter((row) => (
        normalizedQuery === '' || row['file']['name'].toLowerCase().includes(normalizedQuery)
      ));
  }, [
    detailFiles,
    fileQuery,
  ]);

  /**
   * Torrent Detail - Run Mutation.
   *
   * Stores this module-level value in one named location.
   * Related code reuses it instead of duplicating the definition.
   *
   * @param {Web_TorrentDetail_TorrentDetail_RunMutation_Mutation}       mutation       - Mutation.
   * @param {Web_TorrentDetail_TorrentDetail_RunMutation_SuccessMessage} successMessage - Success message.
   *
   * @returns {Web_TorrentDetail_TorrentDetail_RunMutation_Returns}
   *
   * @since 2.0.0
   */
  const runMutation: Web_TorrentDetail_TorrentDetail_RunMutation = async (
    mutation: Web_TorrentDetail_TorrentDetail_RunMutation_Mutation,
    successMessage: Web_TorrentDetail_TorrentDetail_RunMutation_SuccessMessage,
  ): Web_TorrentDetail_TorrentDetail_RunMutation_Returns => {
    if (detail === null) {
      return;
    }

    setBusy(true);
    try {
      await mutation();
      await onRefresh(detail['id']);
      showToast(successMessage, true);
    } catch (caughtError) {
      showToast((caughtError instanceof Error) ? caughtError.message : 'The torrent could not be updated.', false);
    } finally {
      setBusy(false);
    }

    return;
  };

  /**
   * Torrent Detail - Save Files.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @returns {Web_TorrentDetail_TorrentDetail_SaveFiles_Returns}
   *
   * @since 2.0.0
   */
  const saveFiles: Web_TorrentDetail_TorrentDetail_SaveFiles = async (): Web_TorrentDetail_TorrentDetail_SaveFiles_Returns => {
    if (detail === null) {
      return;
    }

    const filesWanted: Web_TorrentDetail_TorrentDetail_SaveFiles_FilesWanted = [];
    const filesUnwanted: Web_TorrentDetail_TorrentDetail_SaveFiles_FilesUnwanted = [];
    const priorityHigh: Web_TorrentDetail_TorrentDetail_SaveFiles_PriorityHigh = [];
    const priorityLow: Web_TorrentDetail_TorrentDetail_SaveFiles_PriorityLow = [];
    const priorityNormal: Web_TorrentDetail_TorrentDetail_SaveFiles_PriorityNormal = [];

    for (const fileDraftEntry of Object.entries(fileDrafts)) {
      const indexValue: Web_TorrentDetail_TorrentDetail_SaveFiles_IndexValue = fileDraftEntry[0];
      const draft: Web_TorrentDetail_TorrentDetail_SaveFiles_Draft = fileDraftEntry[1];
      const index: Web_TorrentDetail_TorrentDetail_SaveFiles_Index = Number(indexValue);

      ((draft['wanted'] === true) ? filesWanted : filesUnwanted).push(index);

      if (draft['priority'] === 1) {
        priorityHigh.push(index);
      } else if (draft['priority'] === -1) {
        priorityLow.push(index);
      } else {
        priorityNormal.push(index);
      }
    }

    const changes: Web_TorrentDetail_TorrentDetail_SaveFiles_Changes = {
      filesUnwanted,
      filesWanted,
      priorityHigh,
      priorityLow,
      priorityNormal,
    };

    await runMutation(
      async () => onUpdate([detail['hashString']], changes),
      'File selection and priorities saved.',
    );

    return;
  };

  /**
   * Torrent Detail - Save Trackers.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @returns {Web_TorrentDetail_TorrentDetail_SaveTrackers_Returns}
   *
   * @since 2.0.0
   */
  const saveTrackers: Web_TorrentDetail_TorrentDetail_SaveTrackers = async (): Web_TorrentDetail_TorrentDetail_SaveTrackers_Returns => {
    if (detail === null) {
      return;
    }

    await runMutation(
      async () => onUpdate([detail['hashString']], { trackerList: trackerList.trim() }),
      'Tracker tiers saved.',
    );

    return;
  };

  /**
   * Torrent Detail - Save Options.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @param {Web_TorrentDetail_TorrentDetail_SaveOptions_Event} event - Event.
   *
   * @returns {Web_TorrentDetail_TorrentDetail_SaveOptions_Returns}
   *
   * @since 2.0.0
   */
  const saveOptions: Web_TorrentDetail_TorrentDetail_SaveOptions = async (event: Web_TorrentDetail_TorrentDetail_SaveOptions_Event): Web_TorrentDetail_TorrentDetail_SaveOptions_Returns => {
    event.preventDefault();
    if (detail === null || options === null) {
      return;
    }

    const labels: Web_TorrentDetail_TorrentDetail_SaveOptions_Labels = options['labels']
      .split(',')
      .map((label) => label.trim())
      .filter((label) => label !== '');
    const changes: Web_TorrentDetail_TorrentDetail_SaveOptions_Changes = {
      bandwidthPriority: options['bandwidthPriority'],
      downloadLimit: options['downloadLimit'],
      downloadLimited: options['downloadLimited'],
      honorsSessionLimits: options['honorsSessionLimits'],
      labels,
      peerLimit: options['peerLimit'],
      seedIdleLimit: options['seedIdleLimit'],
      seedIdleMode: options['seedIdleMode'],
      seedRatioLimit: options['seedRatioLimit'],
      seedRatioMode: options['seedRatioMode'],
      uploadLimit: options['uploadLimit'],
      uploadLimited: options['uploadLimited'],
    };

    await runMutation(
      async () => onUpdate([detail['hashString']], changes),
      'Torrent options saved.',
    );

    return;
  };

  /**
   * Torrent Detail - Rename Torrent.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @param {Web_TorrentDetail_TorrentDetail_RenameTorrent_Event} event - Event.
   *
   * @returns {Web_TorrentDetail_TorrentDetail_RenameTorrent_Returns}
   *
   * @since 2.0.0
   */
  const renameTorrent: Web_TorrentDetail_TorrentDetail_RenameTorrent = async (event: Web_TorrentDetail_TorrentDetail_RenameTorrent_Event): Web_TorrentDetail_TorrentDetail_RenameTorrent_Returns => {
    event.preventDefault();
    if (detail === null) {
      return;
    }

    await runMutation(
      async () => onRename({
        hashes: [detail['hashString']],
        name: renameName.trim(),
        path: detail['name'],
      }),
      'Torrent root renamed.',
    );

    return;
  };

  /**
   * Torrent Detail - Apply Torrent Profile.
   *
   * Assigns or clears the profile and optionally copies its labels and limits.
   * The refreshed detail becomes the source of truth after the mutation.
   *
   * @returns {Web_TorrentDetail_TorrentDetail_ApplyTorrentProfile_Returns}
   *
   * @since 2.0.0
   */
  const applyTorrentProfile: Web_TorrentDetail_TorrentDetail_ApplyTorrentProfile = async (): Web_TorrentDetail_TorrentDetail_ApplyTorrentProfile_Returns => {
    if (detail === null) {
      return;
    }

    const selectedProfile: Web_TorrentDetail_TorrentDetail_ApplyTorrentProfile_SelectedProfile = profiles.find(
      (profile) => profile['id'] === profileId,
    );
    const defaultConnection: Web_TorrentDetail_TorrentDetail_ApplyTorrentProfile_DefaultConnection = connections.find((connection) => connection['default'] === true);
    let targetConnectionId: Web_TorrentDetail_TorrentDetail_ApplyTorrentProfile_TargetConnectionId = (defaultConnection !== undefined) ? defaultConnection['id'] : undefined;

    if (selectedProfile !== undefined && selectedProfile['connectionId'] !== null) {
      targetConnectionId = selectedProfile['connectionId'];
    }

    const targetConnection: Web_TorrentDetail_TorrentDetail_ApplyTorrentProfile_TargetConnection = connections.find(
      (connection) => connection['id'] === targetConnectionId,
    );
    const targetConnectionName: Web_TorrentDetail_TorrentDetail_ApplyTorrentProfile_TargetConnectionName = (targetConnection !== undefined) ? targetConnection['name'] : 'The selected connection';

    setBusy(true);
    setProfileMoveResults([]);
    try {
      const response: Web_TorrentDetail_TorrentDetail_ApplyTorrentProfile_Response = await onSetProfile({
        applyOptions: applyProfileOptions,
        hashes: [detail['hashString']],
        profileId: (profileId === '') ? null : profileId,
      });

      setProfileMoveResults(response['moved']);
      await onRefresh(torrentProfileRefreshID(detail['id'], detail['hashString'], response['moved']));
      showToast((profileId === '') ? `${defaultProfile['name']} applied.` : 'Torrent profile applied.', true);
    } catch (caughtError) {
      showToast(connectionBeingRemovedMessage(caughtError, targetConnectionName) ?? (
        (caughtError instanceof Error) ? caughtError.message : 'The torrent could not be updated.'
      ), false);
    } finally {
      setBusy(false);
    }

    return;
  };

  /**
   * Torrent Detail - Resolve Torrent Profile.
   *
   * Applies the selected profile's labels and limits, then leaves move outcomes in
   * the dialog using the same result rows as an ordinary profile change.
   *
   * @param {Web_TorrentDetail_TorrentDetail_ResolveTorrentProfile_SelectedProfileId} selectedProfileId - Selected profile id.
   *
   * @returns {Web_TorrentDetail_TorrentDetail_ResolveTorrentProfile_Returns}
   *
   * @since 2.0.0
   */
  const resolveTorrentProfile: Web_TorrentDetail_TorrentDetail_ResolveTorrentProfile = async (selectedProfileId: Web_TorrentDetail_TorrentDetail_ResolveTorrentProfile_SelectedProfileId): Web_TorrentDetail_TorrentDetail_ResolveTorrentProfile_Returns => {
    if (detail === null) {
      return;
    }

    setBusy(true);
    setResolutionError('');
    try {
      const response: Web_TorrentDetail_TorrentDetail_ResolveTorrentProfile_Response = await onSetProfile({
        applyOptions: true,
        hashes: [detail['hashString']],
        profileId: selectedProfileId,
      });

      setResolutionResults(response['moved']);
      await onRefresh(torrentProfileRefreshID(detail['id'], detail['hashString'], response['moved']));
    } catch (caughtError) {
      setResolutionError((caughtError instanceof Error) ? caughtError.message : 'The profile choice could not be applied.');
    } finally {
      setBusy(false);
    }

    return;
  };

  /**
   * Torrent Detail - Set All Files.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @param {Web_TorrentDetail_TorrentDetail_SetAllFiles_Wanted} wanted - Wanted.
   *
   * @returns {Web_TorrentDetail_TorrentDetail_SetAllFiles_Returns}
   *
   * @since 2.0.0
   */
  const setAllFiles: Web_TorrentDetail_TorrentDetail_SetAllFiles = (wanted: Web_TorrentDetail_TorrentDetail_SetAllFiles_Wanted): Web_TorrentDetail_TorrentDetail_SetAllFiles_Returns => {
    setFileDrafts((currentDrafts) => {
      const nextDrafts: Web_TorrentDetail_TorrentDetail_SetAllFiles_NextDrafts = {};

      for (const currentDraftEntry of Object.entries(currentDrafts)) {
        const index: Web_TorrentDetail_TorrentDetail_SetAllFiles_Index = currentDraftEntry[0];
        const draft: Web_TorrentDetail_TorrentDetail_SetAllFiles_Draft = currentDraftEntry[1];

        Reflect.set(nextDrafts, Number(index), {
          ...draft,
          wanted,
        });
      }

      return nextDrafts;
    });

    return;
  };

  /**
   * Torrent Detail - Set All Priorities.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @param {Web_TorrentDetail_TorrentDetail_SetAllPriorities_Priority} priority - Priority.
   *
   * @returns {Web_TorrentDetail_TorrentDetail_SetAllPriorities_Returns}
   *
   * @since 2.0.0
   */
  const setAllPriorities: Web_TorrentDetail_TorrentDetail_SetAllPriorities = (priority: Web_TorrentDetail_TorrentDetail_SetAllPriorities_Priority): Web_TorrentDetail_TorrentDetail_SetAllPriorities_Returns => {
    setFileDrafts((currentDrafts) => {
      const nextDrafts: Web_TorrentDetail_TorrentDetail_SetAllPriorities_NextDrafts = {};

      for (const currentDraftEntry of Object.entries(currentDrafts)) {
        const index: Web_TorrentDetail_TorrentDetail_SetAllPriorities_Index = currentDraftEntry[0];
        const draft: Web_TorrentDetail_TorrentDetail_SetAllPriorities_Draft = currentDraftEntry[1];

        Reflect.set(nextDrafts, Number(index), {
          ...draft,
          priority,
        });
      }

      return nextDrafts;
    });

    return;
  };

  useEscapeKey(onClose, resolutionOpen === false);

  const tabLabels: Web_TorrentDetail_TorrentDetail_TabLabels = {
    files: 'Files',
    options: 'Options',
    overview: 'Overview',
    peers: 'Peers',
    trackers: 'Trackers',
  };
  const assignedProfile: Web_TorrentDetail_TorrentDetail_AssignedProfile = profiles.find(
    (profile) => profile['id'] === detailProfileId,
  );
  const detailConnectionId: Web_TorrentDetail_TorrentDetail_DetailConnectionId = (detail !== null) ? detail['connectionId'] : undefined;
  const detailConnection: Web_TorrentDetail_TorrentDetail_DetailConnection = connections.find((connection) => connection['id'] === detailConnectionId);
  const selectedProfile: Web_TorrentDetail_TorrentDetail_SelectedProfile = profiles.find((profile) => profile['id'] === profileId);
  const defaultConnection: Web_TorrentDetail_TorrentDetail_DefaultConnection = connections.find((connection) => connection['default'] === true);
  const selectedProfileData: Web_TorrentDetail_TorrentDetail_SelectedProfileData = selectedProfile ?? defaultProfile;
  let selectedProfileConnectionID: Web_TorrentDetail_TorrentDetail_SelectedProfileConnectionID = (defaultConnection !== undefined) ? defaultConnection['id'] : undefined;

  if ('connectionId' in selectedProfileData && selectedProfileData['connectionId'] !== null) {
    selectedProfileConnectionID = selectedProfileData['connectionId'];
  }

  const selectedProfileConnection: Web_TorrentDetail_TorrentDetail_SelectedProfileConnection = connections.find((connection) => connection['id'] === selectedProfileConnectionID);
  const detailDownloadDir: Web_TorrentDetail_TorrentDetail_DetailDownloadDir = (detail !== null) ? detail['downloadDir'] : undefined;
  const selectedProfileChanged: Web_TorrentDetail_TorrentDetail_SelectedProfileChanged = (
    profileId !== (detailProfileId ?? '')
    || selectedProfileData['downloadDirectory'] !== detailDownloadDir
    || selectedProfileConnectionID !== detailConnectionId
  );
  const selectedProfileConnectionName: Web_TorrentDetail_TorrentDetail_SelectedProfileConnectionName = (selectedProfileConnection !== undefined) ? selectedProfileConnection['name'] : 'the profile connection';
  const profileChangeHint: Web_TorrentDetail_TorrentDetail_ProfileChangeHint = describeTorrentProfileChange(
    selectedProfileData['downloadDirectory'],
    detailConnectionId,
    selectedProfileConnectionID,
    selectedProfileConnectionName,
  );
  const renameAvailable: Web_TorrentDetail_TorrentDetail_RenameAvailable = (
    detail !== null
    && detail['metadataPercentComplete'] >= 1
    && detail['name'].trim() !== ''
    && detailFiles !== undefined
    && detailFiles.length > 0
  );
  const detailNeedsProfile: Web_TorrentDetail_TorrentDetail_DetailNeedsProfile = (detail !== null) ? detail['needsProfile'] : null;
  const resolutionProfileIDs: Web_TorrentDetail_TorrentDetail_ResolutionProfileIDs = (detailNeedsProfile !== null) ? detailNeedsProfile['profileIds'] : [];
  const matchingResolutionProfiles: Web_TorrentDetail_TorrentDetail_MatchingResolutionProfiles = profiles.filter(
    (candidate) => resolutionProfileIDs.includes(candidate['id']),
  );
  const resolutionAllowsAnyProfile: Web_TorrentDetail_TorrentDetail_ResolutionAllowsAnyProfile = resolutionProfileIDs.length === 0
    || matchingResolutionProfiles.length === 0;
  const resolutionProfiles: Web_TorrentDetail_TorrentDetail_ResolutionProfiles = (resolutionAllowsAnyProfile === true) ? profiles : matchingResolutionProfiles;
  const detailName: Web_TorrentDetail_TorrentDetail_DetailName = (detail !== null) ? detail['name'] : undefined;
  const trackerIssue: Web_TorrentDetail_TorrentDetail_TrackerIssue = (detail !== null) ? describeTrackerIssue(detail) : null;
  const etaLabel: Web_TorrentDetail_TorrentDetail_EtaLabel = (detail !== null && detail['eta'] >= 0) ? formatDuration(detail['eta']) : '—';
  const assignedProfileName: Web_TorrentDetail_TorrentDetail_AssignedProfileName = (assignedProfile !== undefined) ? assignedProfile['name'] : defaultProfile['name'];

  return (
    <>
      <button aria-label="Close torrent details" className="detail-scrim" onClick={onClose} type="button" />
      <aside className="detail-panel" aria-label="Torrent details">
        <header className="detail-header">
          <div className="detail-title">
            <h2 title={detailName}>{detailName ?? 'Loading…'}</h2>
            {(detail === null) ? null : (
              <p className={(describeTorrentState(detail)['tone'] === 'error') ? 'torrent-meta torrent-meta-error' : 'torrent-meta'}>
                <span className={`status-dot status-${describeTorrentState(detail)['tone']}`} />
                <span className="torrent-state">{describeTorrentState(detail)['label']}</span>
                <span>{`· queue #${detail['queuePosition'] + 1}`}</span>
                {(trackerIssue === null) ? null : <span className="torrent-tracker-issue" title={trackerIssue['reply']}>{trackerIssue['label']}</span>}
              </p>
            )}
          </div>
          <button aria-label="Close torrent details" className="icon-button" onClick={onClose} type="button"><Icon name="x" /></button>
        </header>

        {(loading === true || detail === null) ? (
          <div className="detail-loading">
            <span className="spinner" />
            Loading…
          </div>
        ) : (
          <>
            <div className={`detail-progress status-${describeTorrentState(detail)['tone']}`}>
              <div className="detail-progress-numbers">
                <strong>{formatPercent(torrentProgress(detail))}</strong>
                <span>{`${formatBytes(detail['downloadedEver'])} of ${formatBytes(detail['sizeWhenDone'])}`}</span>
              </div>
              <div className="progress"><span style={{ width: formatPercent(torrentProgress(detail)) }} /></div>
              <div className="detail-rates">
                <span>
                  <Icon name="arrow-down" size={14} />
                  {formatRate(detail['rateDownload'])}
                </span>
                <span>
                  <Icon name="arrow-up" size={14} />
                  {formatRate(detail['rateUpload'])}
                </span>
                <span>{`ETA ${etaLabel}`}</span>
              </div>
            </div>

            <div className="detail-actions" aria-label="Torrent actions">
              {(detail['needsProfile'] === null) ? null : (
                <Button
                  disabled={busy}
                  onClick={() => {
                    setResolutionError('');
                    setResolutionResults(null);
                    setResolutionOpen(true);

                    return;
                  }}
                  variant="primary"
                >
                  Resolve
                </Button>
              )}
              {/* A stopped torrent can only start, and any other can only pause, so one button shows. */}
              {(detail['status'] === 0) ? (
                <Button
                  disabled={busy}
                  icon="play"
                  onClick={() => {
                    void runMutation(async () => onAction('start', [detail['hashString']]), 'Started.');

                    return;
                  }}
                >
                  Start
                </Button>
              ) : (
                <Button
                  disabled={busy}
                  icon="pause"
                  onClick={() => {
                    void runMutation(async () => onAction('stop', [detail['hashString']]), 'Paused.');

                    return;
                  }}
                >
                  Pause
                </Button>
              )}
              <Button
                disabled={busy}
                icon="check"
                onClick={() => {
                  void runMutation(async () => onAction('verify', [detail['hashString']]), 'Verifying local data.');

                  return;
                }}
              >
                Verify
              </Button>
              <Button
                disabled={busy}
                icon="refresh"
                onClick={() => {
                  void runMutation(async () => onAction('reannounce', [detail['hashString']]), 'Asked trackers for more peers.');

                  return;
                }}
              >
                Reannounce
              </Button>
            </div>

            <div className="detail-tabs" role="tablist">
              {(Object.keys(tabLabels) as Web_TorrentDetail_TorrentDetail_TabKeys).sort((left, right) => (
                [
                  'overview',
                  'files',
                  'peers',
                  'trackers',
                  'options',
                ].indexOf(left) - [
                  'overview',
                  'files',
                  'peers',
                  'trackers',
                  'options',
                ].indexOf(right)
              )).map((item) => (
                <button aria-selected={tab === item} key={item} onClick={() => setTab(item)} role="tab" type="button">{tabLabels[item]}</button>
              ))}
            </div>

            <div className="detail-content">
              {(tab === 'overview') ? (
                <PieceMapSection
                  availability={detail['availability']}
                  peersConnected={detail['peersConnected']}
                  pieceCount={detail['pieceCount']}
                  pieceSize={detail['pieceSize']}
                  pieces={detail['pieces']}
                />
              ) : null}
              {(tab === 'overview') ? (
                <dl className="details details-plain detail-overview">
                  <div>
                    <dt>Ratio</dt>
                    <dd>{formatRatio(detail['uploadRatio'])}</dd>
                  </div>
                  <div>
                    <dt>Peers</dt>
                    <dd>{`${detail['peersConnected']} (${detail['peersSendingToUs']} ↓ · ${detail['peersGettingFromUs']} ↑)`}</dd>
                  </div>
                  <div>
                    <dt>Downloaded</dt>
                    <dd>{formatBytes(detail['downloadedEver'])}</dd>
                  </div>
                  <div>
                    <dt>Uploaded</dt>
                    <dd>{formatBytes(detail['uploadedEver'])}</dd>
                  </div>
                  <div>
                    <dt>Added</dt>
                    <dd>{formatDate(detail['addedDate'])}</dd>
                  </div>
                  <div>
                    <dt>Completed</dt>
                    <dd>{formatDate(detail['doneDate'] ?? 0)}</dd>
                  </div>
                  <div className="details-wide">
                    <dt>VPN connection</dt>
                    <dd className="profile-derived-value">{(detailConnection !== undefined) ? detailConnection['name'] : detail['connectionId']}</dd>
                  </div>
                  <div>
                    <dt>Time downloading</dt>
                    <dd>{formatDuration(detail['secondsDownloading'] ?? 0)}</dd>
                  </div>
                  <div>
                    <dt>Time seeding</dt>
                    <dd>{formatDuration(detail['secondsSeeding'] ?? 0)}</dd>
                  </div>
                  <div className="details-wide">
                    <dt>Location</dt>
                    <dd className="profile-derived-value">{detail['downloadDir']}</dd>
                  </div>
                  <div className="details-wide">
                    <dt>Info hash</dt>
                    <dd>{detail['hashString']}</dd>
                  </div>
                  <div className="details-wide">
                    <dt>Magnet link</dt>
                    <dd className="details-copy">
                      <span>{detail['magnetLink'] ?? 'Unavailable'}</span>
                      <button
                        className="icon-button"
                        disabled={detail['magnetLink'] === undefined}
                        onClick={() => {
                          if (detail['magnetLink'] !== undefined) {
                            void copyText(detail['magnetLink']).then(() => showToast('Magnet link copied.', true));
                          }

                          return;
                        }}
                        title="Copy magnet link"
                        type="button"
                      >
                        <Icon name="copy" size={16} />
                      </button>
                    </dd>
                  </div>
                  {(detail['creator'] === undefined || detail['creator'] === '') ? null : (
                    <div>
                      <dt>Created by</dt>
                      <dd>{detail['creator']}</dd>
                    </div>
                  )}
                  {(detail['isPrivate'] === true) ? (
                    <div>
                      <dt>Tracker type</dt>
                      <dd>Private</dd>
                    </div>
                  ) : null}
                  {(detail['comment'] === undefined || detail['comment'] === '') ? null : (
                    <div className="details-wide">
                      <dt>Comment</dt>
                      <dd className="details-prose">{detail['comment']}</dd>
                    </div>
                  )}
                </dl>
              ) : null}

              {(tab === 'files') ? (
                <div className="detail-section">
                  <div className="detail-tools">
                    <label className="search-field">
                      <Icon name="search" size={15} />
                      <span className="visually-hidden">Filter files</span>
                      <input onChange={(event) => setFileQuery(event.currentTarget.value)} placeholder="Filter files" type="search" value={fileQuery} />
                    </label>
                    <button className="text-button" onClick={() => setAllFiles(true)} type="button">All</button>
                    <button className="text-button" onClick={() => setAllFiles(false)} type="button">None</button>
                    <select
                      aria-label="Set priority for all files"
                      className="select-control"
                      onChange={(event) => setAllPriorities(Number(event.currentTarget.value) as Web_TorrentDetail_TorrentDetail_SetAllPriorities_Priority)}
                      value=""
                    >
                      <option value="">Priority for all…</option>
                      <option value="1">High</option>
                      <option value="0">Normal</option>
                      <option value="-1">Low</option>
                    </select>
                  </div>

                  <div className="detail-list" role="table" aria-label="Torrent files">
                    {filteredFiles.map((row) => {
                      const draft: Web_TorrentDetail_TorrentDetail_Draft = fileDrafts[row['index']] ?? {
                        priority: 0,
                        wanted: true,
                      };
                      const completed: Web_TorrentDetail_TorrentDetail_Completed = row['file']['bytesCompleted'];
                      const length: Web_TorrentDetail_TorrentDetail_Length = row['file']['length'];
                      const progress: Web_TorrentDetail_TorrentDetail_Progress = (length <= 0) ? 1 : completed / length;

                      return (
                        <div className={(draft['wanted'] === true) ? 'file-row' : 'file-row file-row-unwanted'} key={`${row['file']['name']}-${row['index']}`} role="row">
                          <input
                            aria-label={`Download ${row['file']['name']}`}
                            checked={draft['wanted']}
                            onChange={(event) => {
                              const nextWanted: Web_TorrentDetail_TorrentDetail_NextWanted = event.currentTarget.checked;

                              setFileDrafts((currentDrafts) => ({
                                ...currentDrafts,
                                [row['index']]: {
                                  ...draft,
                                  wanted: nextWanted,
                                },
                              }));

                              return;
                            }}
                            type="checkbox"
                          />
                          <div className="file-row-main">
                            <span className="file-row-name" title={row['file']['name']}>{row['file']['name']}</span>
                            <div className="progress"><span style={{ width: formatPercent(progress) }} /></div>
                            <span className="file-row-meta">{`${formatBytes(completed)} of ${formatBytes(length)} · ${formatPercent(progress)}`}</span>
                          </div>
                          <select
                            aria-label={`Priority for ${row['file']['name']}`}
                            className="select-control"
                            disabled={draft['wanted'] === false}
                            onChange={(event) => {
                              const nextPriority: Web_TorrentDetail_TorrentDetail_NextPriority = Number(event.currentTarget.value) as Web_TorrentDetail_TorrentDetail_NextPriority;

                              setFileDrafts((currentDrafts) => ({
                                ...currentDrafts,
                                [row['index']]: {
                                  ...draft,
                                  priority: nextPriority,
                                },
                              }));

                              return;
                            }}
                            value={draft['priority']}
                          >
                            <option value="1">High</option>
                            <option value="0">Normal</option>
                            <option value="-1">Low</option>
                          </select>
                        </div>
                      );
                    })}
                    {(filteredFiles.length === 0) ? <p className="detail-empty">No matching files.</p> : null}
                  </div>
                  <div className="detail-footer">
                    <span>{`${Object.values(fileDrafts).filter((draft) => draft['wanted']).length} of ${Object.keys(fileDrafts).length} files selected`}</span>
                    <Button
                      disabled={busy || Object.keys(fileDrafts).length === 0}
                      onClick={() => {
                        void saveFiles();

                        return;
                      }}
                      variant="primary"
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : null}

              {(tab === 'peers') ? (
                <table className="detail-table" aria-label="Connected peers">
                  <thead>
                    <tr>
                      <th>Address</th>
                      <th>Client</th>
                      <th className="numeric">Has</th>
                      <th className="numeric">Down</th>
                      <th className="numeric">Up</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail['peers'] ?? []).map((peer, index) => (
                      <tr key={`${peer['address']}-${peer['port']}-${index}`}>
                        <td>
                          <span className="mono">{`${peer['address']}:${peer['port']}`}</span>
                          <small>
                            {[
                              (peer['isEncrypted'] === true) ? 'encrypted' : 'plain',
                              (peer['isIncoming'] === true) ? 'incoming' : 'outgoing',
                              peer['flagStr'],
                            ].join(' · ')}
                          </small>
                        </td>
                        <td>{peer['clientName'] || 'Unknown'}</td>
                        <td className="numeric">{formatPercent(peer['progress'])}</td>
                        <td className="numeric">{(peer['rateToClient'] > 0) ? formatRate(peer['rateToClient']) : '—'}</td>
                        <td className="numeric">{(peer['rateToPeer'] > 0) ? formatRate(peer['rateToPeer']) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  {((detail['peers'] ?? []).length === 0) ? (
                    <caption className="detail-empty">No peers connected.</caption>
                  ) : null}
                </table>
              ) : null}

              {(tab === 'trackers') ? (
                <div className="detail-section">
                  <div className="detail-list">
                    {(detail['trackerStats'] ?? []).map((tracker) => {
                      const trackerStatus: Web_TorrentDetail_TorrentDetail_TrackerStatus = (tracker['lastAnnounceSucceeded'] === true) ? 'status-seeding' : 'status-error';

                      return (
                        <div className="tracker-row" key={tracker['id']}>
                          <div className="tracker-row-head">
                            <span className={`status-dot ${trackerStatus}`} />
                            <span className="mono" title={tracker['announce']}>{tracker['host']}</span>
                            <span className="tag">{`tier ${tracker['tier'] + 1}`}</span>
                          </div>
                          <p className={(tracker['lastAnnounceSucceeded'] === true) ? 'tracker-row-result' : 'tracker-row-result tracker-row-failed'}>
                            {tracker['lastAnnounceResult'] || 'No announce yet'}
                          </p>
                          <p className="tracker-row-stats">
                            {`${tracker['seederCount']} seeders · ${tracker['leecherCount']} leechers · ${tracker['downloadCount']} downloads · next announce ${formatDate(tracker['nextAnnounceTime'])}`}
                          </p>
                        </div>
                      );
                    })}
                    {((detail['trackerStats'] ?? []).length === 0) ? <p className="detail-empty">No trackers.</p> : null}
                  </div>
                  <FieldLabel>
                    <span>Tracker list</span>
                    <textarea
                      className="monospace"
                      onChange={(event) => setTrackerList(event.currentTarget.value)}
                      placeholder={[
                        'e.g. https://tracker.example/announce',
                        '',
                        'https://backup.example/announce',
                      ].join('\n')}
                      rows={7}
                      value={trackerList}
                    />
                    <small>One tracker per line. A blank line starts the next tier.</small>
                  </FieldLabel>
                  <div className="detail-footer">
                    <span />
                    <Button
                      disabled={busy}
                      onClick={() => {
                        void saveTrackers();

                        return;
                      }}
                      variant="primary"
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : null}

              {(tab === 'options' && options !== null) ? (
                <div className="detail-section">
                  <section className="profile-apply-card">
                    <h3>Profile</h3>
                    <div className="profile-apply-row">
                      <div className="field profile-apply-field">
                        <span>Profile</span>
                        <div className="profile-apply-controls">
                          <select
                            aria-label="Profile"
                            onChange={(event) => {
                              setProfileId(event.currentTarget.value);
                              setProfileMoveResults([]);

                              return;
                            }}
                            value={profileId}
                          >
                            <option value="">{defaultProfile['name']}</option>
                            {profiles.map((profile) => (
                              <option key={profile['id']} value={profile['id']}>{profile['name']}</option>
                            ))}
                          </select>
                          <Button
                            disabled={busy}
                            onClick={() => {
                              void applyTorrentProfile();

                              return;
                            }}
                            variant="primary"
                          >
                            Apply
                          </Button>
                        </div>
                        {(selectedProfileChanged === true) ? <small>{profileChangeHint}</small> : null}
                      </div>
                    </div>
                    <label aria-label="Also apply its labels and limits" className="check-row">
                      <input
                        checked={applyProfileOptions}
                        onChange={(event) => setApplyProfileOptions(event.currentTarget.checked)}
                        type="checkbox"
                      />
                      <span>
                        <strong>Also apply its labels and limits</strong>
                        <small>Copies the profile settings to this torrent now.</small>
                      </span>
                    </label>
                    {(profileMoveResults.length === 0) ? null : (
                      <div className="torrent-move-results">
                        <ul>
                          {profileMoveResults.map((result) => (
                            <li className={(result['result'] === 'failed') ? 'move-failed' : 'move-succeeded'} key={result['hash']}>
                              <strong>{result['name']}</strong>
                              <span className="move-result-copy">
                                <span className="move-result-state">{torrentMoveResultLabel(result)}</span>
                                {(result['warnings'] !== undefined) ? result['warnings'].map((warning) => <small key={warning}>{warning}</small>) : undefined}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </section>

                  <form className="detail-form" noValidate onSubmit={saveOptions}>
                    <h3>Labels and limits</h3>
                    <LabelPicker
                      labels={labelPresets}
                      onChange={(value) => setOptions({
                        ...options,
                        labels: value,
                      })}
                      title="Labels"
                      value={options['labels']}
                    />
                    <div className="field-row">
                      <FieldLabel>
                        <span>Bandwidth priority</span>
                        <select
                          onChange={(event) => setOptions({
                            ...options,
                            bandwidthPriority: Number(event.currentTarget.value) as Web_TorrentDetail_TorrentDetail_OptionsBandwidthPriority,
                          })}
                          value={options['bandwidthPriority']}
                        >
                          <option value="1">High</option>
                          <option value="0">Normal</option>
                          <option value="-1">Low</option>
                        </select>
                      </FieldLabel>
                      <FieldLabel>
                        <span>Maximum peers</span>
                        <input
                          onChange={(event) => setOptions({
                            ...options,
                            peerLimit: Number(event.currentTarget.value),
                          })}
                          type="number"
                          value={options['peerLimit']}
                        />
                      </FieldLabel>
                    </div>
                    <label aria-label="Follow global speed limits" className="check-row">
                      <input
                        checked={options['honorsSessionLimits']}
                        onChange={(event) => setOptions({
                          ...options,
                          honorsSessionLimits: event.currentTarget.checked,
                        })}
                        type="checkbox"
                      />
                      <span><strong>Follow global speed limits</strong></span>
                    </label>
                    <div className="field-row">
                      <div className="limit-field">
                        <label aria-label="Limit download (KB/s)" className="check-row">
                          <input
                            checked={options['downloadLimited']}
                            onChange={(event) => setOptions({
                              ...options,
                              downloadLimited: event.currentTarget.checked,
                            })}
                            type="checkbox"
                          />
                          <span><strong>Limit download (KB/s)</strong></span>
                        </label>
                        <input
                          aria-label="Download limit in KB/s"
                          className="setting-input"
                          disabled={options['downloadLimited'] === false}
                          onChange={(event) => setOptions({
                            ...options,
                            downloadLimit: Number(event.currentTarget.value),
                          })}
                          type="number"
                          value={options['downloadLimit']}
                        />
                      </div>
                      <div className="limit-field">
                        <label aria-label="Limit upload (KB/s)" className="check-row">
                          <input
                            checked={options['uploadLimited']}
                            onChange={(event) => setOptions({
                              ...options,
                              uploadLimited: event.currentTarget.checked,
                            })}
                            type="checkbox"
                          />
                          <span><strong>Limit upload (KB/s)</strong></span>
                        </label>
                        <input
                          aria-label="Upload limit in KB/s"
                          className="setting-input"
                          disabled={options['uploadLimited'] === false}
                          onChange={(event) => setOptions({
                            ...options,
                            uploadLimit: Number(event.currentTarget.value),
                          })}
                          type="number"
                          value={options['uploadLimit']}
                        />
                      </div>
                    </div>

                    <h3>Seeding</h3>
                    <div className="field-row">
                      <FieldLabel>
                        <span>Stop at ratio</span>
                        <select
                          onChange={(event) => setOptions({
                            ...options,
                            seedRatioMode: Number(event.currentTarget.value) as Web_TorrentDetail_TorrentDetail_OptionsSeedRatioMode,
                          })}
                          value={options['seedRatioMode']}
                        >
                          <option value="1">Custom</option>
                          <option value="2">Never stop</option>
                        </select>
                      </FieldLabel>
                      <FieldLabel>
                        <span>Ratio</span>
                        <input
                          disabled={options['seedRatioMode'] !== 1}
                          onChange={(event) => setOptions({
                            ...options,
                            seedRatioLimit: Number(event.currentTarget.value),
                          })}
                          step="0.1"
                          type="number"
                          value={options['seedRatioLimit']}
                        />
                      </FieldLabel>
                      <FieldLabel>
                        <span>Stop when idle</span>
                        <select
                          onChange={(event) => setOptions({
                            ...options,
                            seedIdleMode: Number(event.currentTarget.value) as Web_TorrentDetail_TorrentDetail_OptionsSeedIdleMode,
                          })}
                          value={options['seedIdleMode']}
                        >
                          <option value="1">Custom</option>
                          <option value="2">Never stop</option>
                        </select>
                      </FieldLabel>
                      <FieldLabel>
                        <span>Idle minutes</span>
                        <input
                          disabled={options['seedIdleMode'] !== 1}
                          onChange={(event) => setOptions({
                            ...options,
                            seedIdleLimit: Number(event.currentTarget.value),
                          })}
                          type="number"
                          value={options['seedIdleLimit']}
                        />
                      </FieldLabel>
                    </div>
                    <p className="form-section-note">
                      {`${assignedProfileName} supplies the defaults, so each option can be custom or never stop.`}
                    </p>
                    <div className="detail-footer">
                      <span />
                      <Button disabled={busy} type="submit" variant="primary">Save options</Button>
                    </div>
                  </form>

                  <form className="detail-form" noValidate onSubmit={renameTorrent}>
                    <h3>Name</h3>
                    <FieldLabel>
                      <span>Top-level file or folder name</span>
                      <input
                        disabled={renameAvailable === false}
                        onChange={(event) => setRenameName(event.currentTarget.value)}
                        type="text"
                        value={renameName}
                      />
                      {(renameAvailable === true) ? null : <small>Available once the torrent&apos;s metadata has downloaded.</small>}
                    </FieldLabel>
                    <div className="detail-footer">
                      <span />
                      <Button
                        disabled={(
                          busy === true
                          || renameAvailable === false
                          || renameName.trim() === detail['name']
                          || renameName.trim() === ''
                        )}
                        type="submit"
                      >
                        Rename
                      </Button>
                    </div>
                  </form>
                </div>
              ) : null}
            </div>
          </>
        )}
      </aside>
      {(resolutionOpen === false || detail === null) ? null : (
        <div className="dialog-backdrop" role="presentation">
          <section aria-labelledby="resolve-profile-title" aria-modal="true" className="dialog dialog-small" role="dialog">
            <div className="dialog-heading">
              <div>
                <h2 id="resolve-profile-title">Choose a profile</h2>
                <p>{detail['name']}</p>
              </div>
              <button
                aria-label="Close"
                className="icon-button"
                disabled={busy}
                onClick={() => setResolutionOpen(false)}
                type="button"
              >
                <Icon name="x" />
              </button>
            </div>
            {(resolutionResults === null) ? (
              <>
                <p>{(resolutionAllowsAnyProfile === true) ? 'The original matches are no longer available. Choose any profile.' : 'Choose the profile this torrent belongs to.'}</p>
                <div className="profile-resolution-list">
                  {(resolutionAllowsAnyProfile === true) ? (
                    <button
                      disabled={busy}
                      onClick={() => {
                        void resolveTorrentProfile(null);

                        return;
                      }}
                      type="button"
                    >
                      <strong>{defaultProfile['name']}</strong>
                    </button>
                  ) : null}
                  {resolutionProfiles.map((candidate) => {
                    const matchingPattern: Web_TorrentDetail_TorrentDetail_MatchingPattern = (
                      candidate['matchPatterns'].find((pattern) => torrentNameMatchesPattern(detail['name'], pattern))
                      ?? candidate['matchPatterns'][0]
                      ?? 'No current matching pattern'
                    );

                    return (
                      <button
                        disabled={busy}
                        key={candidate['id']}
                        onClick={() => {
                          void resolveTorrentProfile(candidate['id']);

                          return;
                        }}
                        type="button"
                      >
                        <strong>{candidate['name']}</strong>
                        <span>{matchingPattern}</span>
                      </button>
                    );
                  })}
                </div>
                {(resolutionError === '') ? null : <div className="form-error" role="alert">{resolutionError}</div>}
                <div className="dialog-actions">
                  <Button disabled={busy} onClick={() => setResolutionOpen(false)}>Cancel</Button>
                </div>
              </>
            ) : (
              <>
                <div className="torrent-move-results">
                  <ul>
                    {resolutionResults.map((result) => (
                      <li className={(result['result'] === 'failed') ? 'move-failed' : 'move-succeeded'} key={result['hash']}>
                        <strong>{result['name']}</strong>
                        <span className="move-result-copy">
                          <span className="move-result-state">{torrentMoveResultLabel(result)}</span>
                          {(result['warnings'] !== undefined) ? result['warnings'].map((warning) => <small key={warning}>{warning}</small>) : undefined}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="dialog-actions">
                  <Button onClick={() => setResolutionOpen(false)} variant="primary">Done</Button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
};
