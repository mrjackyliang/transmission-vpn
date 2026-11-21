import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  downloadFinishedFiles,
  downloadTorrentFiles,
} from '@/web/api.ts';
import { PHONE_NAV_SHEET_ID } from '@/web/navigation.ts';
import {
  Button,
  Icon,
} from '@/web/primitives.tsx';
import { showToast } from '@/web/toast.ts';
import {
  formatBytes,
  formatDuration,
  formatPercent,
  formatRate,
  formatRatio,
} from '@/web/torrent-format.ts';
import {
  defaultProfileFilterValue,
  describeTorrentState,
  describeTrackerIssue,
  duplicateTorrentNotices,
  finishedFilesLeftOut,
  torrentHasFinishedFiles,
  torrentLibraryFilters,
  torrentMatchesFilter,
  torrentMatchesLibrarySelection,
  torrentProgress,
  torrentQueuePositionsAreComparable,
} from '@/web/torrent-library.ts';
import { torrentMoveResultLabel } from '@/web/torrent-move-result.ts';
import { remapSelectedTorrentIDs } from '@/web/torrent-profile-change.ts';
import { useEscapeKey } from '@/web/use-escape-key.ts';

import type {
  Web_TorrentWorkspace_CompareTorrents_Direction,
  Web_TorrentWorkspace_CompareTorrents_LeftTorrent,
  Web_TorrentWorkspace_CompareTorrents_LeftValue,
  Web_TorrentWorkspace_CompareTorrents_Returns,
  Web_TorrentWorkspace_CompareTorrents_RightTorrent,
  Web_TorrentWorkspace_CompareTorrents_RightValue,
  Web_TorrentWorkspace_CompareTorrents_Sort,
  Web_TorrentWorkspace_HashesForTorrentIdentifiers_Hashes,
  Web_TorrentWorkspace_HashesForTorrentIdentifiers_Identifiers,
  Web_TorrentWorkspace_HashesForTorrentIdentifiers_IsHash,
  Web_TorrentWorkspace_HashesForTorrentIdentifiers_IsHash_Hash,
  Web_TorrentWorkspace_HashesForTorrentIdentifiers_IsHash_TypeGuard,
  Web_TorrentWorkspace_HashesForTorrentIdentifiers_MatchedTorrent,
  Web_TorrentWorkspace_HashesForTorrentIdentifiers_Returns,
  Web_TorrentWorkspace_HashesForTorrentIdentifiers_Torrents,
  Web_TorrentWorkspace_SortHeader_Active,
  Web_TorrentWorkspace_SortHeader_ActiveSort,
  Web_TorrentWorkspace_SortHeader_Ascending,
  Web_TorrentWorkspace_SortHeader_ClassNames,
  Web_TorrentWorkspace_SortHeader_Label,
  Web_TorrentWorkspace_SortHeader_OnSort,
  Web_TorrentWorkspace_SortHeader_Props,
  Web_TorrentWorkspace_SortHeader_Returns,
  Web_TorrentWorkspace_SortHeader_SortKey,
  Web_TorrentWorkspace_StatisticPeriod_Key,
  Web_TorrentWorkspace_StatisticPeriod_Returns,
  Web_TorrentWorkspace_StatisticPeriod_Statistics,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_ApplyOptions,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_ApplyOptionsState,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_Busy,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_BusyState,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_Connections,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_DefaultConnection,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_DefaultProfile,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_Error,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_ErrorState,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_Hashes,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_MoveCount,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_OnClose,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_OnSetProfile,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_ProfileID,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_ProfileIDState,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_Profiles,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_Props,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_Results,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_ResultsState,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_Returns,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_SelectedHashes,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_SelectedProfile,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_SelectedProfileData,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_SelectedTorrentNoun,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_SelectedTorrents,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_SetApplyOptions,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_SetBusy,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_SetError,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_SetProfileID,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_SetResults,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_Submit,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_Submit_Event,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_Submit_Response,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_Submit_Returns,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_TargetConnectionID,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_TorrentNoun,
  Web_TorrentWorkspace_TorrentProfileChangeDialog_Torrents,
  Web_TorrentWorkspace_TorrentWorkspace_ActiveFilterCount,
  Web_TorrentWorkspace_TorrentWorkspace_ActiveFilterLabel,
  Web_TorrentWorkspace_TorrentWorkspace_Busy,
  Web_TorrentWorkspace_TorrentWorkspace_BusyState,
  Web_TorrentWorkspace_TorrentWorkspace_ClearFilters,
  Web_TorrentWorkspace_TorrentWorkspace_ClearFilters_Returns,
  Web_TorrentWorkspace_TorrentWorkspace_CloseMenu,
  Web_TorrentWorkspace_TorrentWorkspace_CloseMenu_Returns,
  Web_TorrentWorkspace_TorrentWorkspace_CloseOnEscape,
  Web_TorrentWorkspace_TorrentWorkspace_CloseOnEscape_Event,
  Web_TorrentWorkspace_TorrentWorkspace_CloseOnEscape_Returns,
  Web_TorrentWorkspace_TorrentWorkspace_CloseOnOutsideClick,
  Web_TorrentWorkspace_TorrentWorkspace_CloseOnOutsideClick_Event,
  Web_TorrentWorkspace_TorrentWorkspace_CloseOnOutsideClick_Returns,
  Web_TorrentWorkspace_TorrentWorkspace_Connection,
  Web_TorrentWorkspace_TorrentWorkspace_ConnectionFilter,
  Web_TorrentWorkspace_TorrentWorkspace_ConnectionFilterLabel,
  Web_TorrentWorkspace_TorrentWorkspace_Connections,
  Web_TorrentWorkspace_TorrentWorkspace_ConnectionTorrentNoun,
  Web_TorrentWorkspace_TorrentWorkspace_ConnectionTorrents,
  Web_TorrentWorkspace_TorrentWorkspace_ContextMenu,
  Web_TorrentWorkspace_TorrentWorkspace_ContextMenuFinishedCount,
  Web_TorrentWorkspace_TorrentWorkspace_ContextMenuRef,
  Web_TorrentWorkspace_TorrentWorkspace_ContextMenuRefValue,
  Web_TorrentWorkspace_TorrentWorkspace_ContextMenuState,
  Web_TorrentWorkspace_TorrentWorkspace_ContextMenuTorrentFileCount,
  Web_TorrentWorkspace_TorrentWorkspace_CumulativeStatistics,
  Web_TorrentWorkspace_TorrentWorkspace_CurrentPage,
  Web_TorrentWorkspace_TorrentWorkspace_CurrentStatistics,
  Web_TorrentWorkspace_TorrentWorkspace_DefaultProfile,
  Web_TorrentWorkspace_TorrentWorkspace_DeleteLocalData,
  Web_TorrentWorkspace_TorrentWorkspace_DeleteLocalDataState,
  Web_TorrentWorkspace_TorrentWorkspace_DownloadFinishedFilesFor,
  Web_TorrentWorkspace_TorrentWorkspace_DownloadFinishedFilesFor_Hashes,
  Web_TorrentWorkspace_TorrentWorkspace_DownloadFinishedFilesFor_Identifiers,
  Web_TorrentWorkspace_TorrentWorkspace_DownloadFinishedFilesFor_LeftOut,
  Web_TorrentWorkspace_TorrentWorkspace_DownloadFinishedFilesFor_Prepared,
  Web_TorrentWorkspace_TorrentWorkspace_DownloadFinishedFilesFor_Returns,
  Web_TorrentWorkspace_TorrentWorkspace_Downloading,
  Web_TorrentWorkspace_TorrentWorkspace_DownloadingCount,
  Web_TorrentWorkspace_TorrentWorkspace_DownloadTorrentFilesFor,
  Web_TorrentWorkspace_TorrentWorkspace_DownloadTorrentFilesFor_Hashes,
  Web_TorrentWorkspace_TorrentWorkspace_DownloadTorrentFilesFor_Identifiers,
  Web_TorrentWorkspace_TorrentWorkspace_DownloadTorrentFilesFor_PronounPhrase,
  Web_TorrentWorkspace_TorrentWorkspace_DownloadTorrentFilesFor_Returns,
  Web_TorrentWorkspace_TorrentWorkspace_DownloadTorrentFilesFor_Skipped,
  Web_TorrentWorkspace_TorrentWorkspace_DownloadTorrentFilesFor_TorrentPhrase,
  Web_TorrentWorkspace_TorrentWorkspace_DuplicateNotices,
  Web_TorrentWorkspace_TorrentWorkspace_EffectiveSort,
  Web_TorrentWorkspace_TorrentWorkspace_Errors,
  Web_TorrentWorkspace_TorrentWorkspace_EveryVisibleSelected,
  Web_TorrentWorkspace_TorrentWorkspace_FilteredTorrents,
  Web_TorrentWorkspace_TorrentWorkspace_Filters,
  Web_TorrentWorkspace_TorrentWorkspace_FiltersActive,
  Web_TorrentWorkspace_TorrentWorkspace_FiltersOpen,
  Web_TorrentWorkspace_TorrentWorkspace_FirstVisibleIndex,
  Web_TorrentWorkspace_TorrentWorkspace_HandleKeyDown,
  Web_TorrentWorkspace_TorrentWorkspace_HandleKeyDown_Event,
  Web_TorrentWorkspace_TorrentWorkspace_HandleKeyDown_Returns,
  Web_TorrentWorkspace_TorrentWorkspace_KeptIDs,
  Web_TorrentWorkspace_TorrentWorkspace_LabelFilter,
  Web_TorrentWorkspace_TorrentWorkspace_LastSelectedID,
  Web_TorrentWorkspace_TorrentWorkspace_LastSelectedIDState,
  Web_TorrentWorkspace_TorrentWorkspace_NeedsProfileCount,
  Web_TorrentWorkspace_TorrentWorkspace_NeedsProfileNoun,
  Web_TorrentWorkspace_TorrentWorkspace_NextID,
  Web_TorrentWorkspace_TorrentWorkspace_NextIDs,
  Web_TorrentWorkspace_TorrentWorkspace_NormalizedQuery,
  Web_TorrentWorkspace_TorrentWorkspace_OnAction,
  Web_TorrentWorkspace_TorrentWorkspace_OnAddTorrent,
  Web_TorrentWorkspace_TorrentWorkspace_OnFiltersChange,
  Web_TorrentWorkspace_TorrentWorkspace_OnFixProfileFolder,
  Web_TorrentWorkspace_TorrentWorkspace_OnOpenFilters,
  Web_TorrentWorkspace_TorrentWorkspace_OnRemove,
  Web_TorrentWorkspace_TorrentWorkspace_OnSelectTorrent,
  Web_TorrentWorkspace_TorrentWorkspace_OnSetProfile,
  Web_TorrentWorkspace_TorrentWorkspace_OpenButtonMenu,
  Web_TorrentWorkspace_TorrentWorkspace_OpenButtonMenu_Bounds,
  Web_TorrentWorkspace_TorrentWorkspace_OpenButtonMenu_Event,
  Web_TorrentWorkspace_TorrentWorkspace_OpenButtonMenu_Returns,
  Web_TorrentWorkspace_TorrentWorkspace_OpenButtonMenu_TorrentIds,
  Web_TorrentWorkspace_TorrentWorkspace_OpenDetails,
  Web_TorrentWorkspace_TorrentWorkspace_OpenDetails_Returns,
  Web_TorrentWorkspace_TorrentWorkspace_OpenMenuAt,
  Web_TorrentWorkspace_TorrentWorkspace_OpenMenuAt_MenuHeight,
  Web_TorrentWorkspace_TorrentWorkspace_OpenMenuAt_MenuWidth,
  Web_TorrentWorkspace_TorrentWorkspace_OpenMenuAt_Returns,
  Web_TorrentWorkspace_TorrentWorkspace_OpenMenuAt_TorrentIds,
  Web_TorrentWorkspace_TorrentWorkspace_OpenMenuAt_X,
  Web_TorrentWorkspace_TorrentWorkspace_OpenMenuAt_Y,
  Web_TorrentWorkspace_TorrentWorkspace_OpenRowMenu,
  Web_TorrentWorkspace_TorrentWorkspace_OpenRowMenu_Event,
  Web_TorrentWorkspace_TorrentWorkspace_OpenRowMenu_Returns,
  Web_TorrentWorkspace_TorrentWorkspace_OpenRowMenu_Torrent,
  Web_TorrentWorkspace_TorrentWorkspace_OpenRowMenu_TorrentIds,
  Web_TorrentWorkspace_TorrentWorkspace_Page,
  Web_TorrentWorkspace_TorrentWorkspace_PageCount,
  Web_TorrentWorkspace_TorrentWorkspace_PageSize,
  Web_TorrentWorkspace_TorrentWorkspace_PageSizeState,
  Web_TorrentWorkspace_TorrentWorkspace_PageState,
  Web_TorrentWorkspace_TorrentWorkspace_PeerCount,
  Web_TorrentWorkspace_TorrentWorkspace_PeerNoun,
  Web_TorrentWorkspace_TorrentWorkspace_PerformAction,
  Web_TorrentWorkspace_TorrentWorkspace_PerformAction_Action,
  Web_TorrentWorkspace_TorrentWorkspace_PerformAction_Hashes,
  Web_TorrentWorkspace_TorrentWorkspace_PerformAction_Identifiers,
  Web_TorrentWorkspace_TorrentWorkspace_PerformAction_Returns,
  Web_TorrentWorkspace_TorrentWorkspace_ProfileChangeOpen,
  Web_TorrentWorkspace_TorrentWorkspace_ProfileChangeOpenState,
  Web_TorrentWorkspace_TorrentWorkspace_ProfileFilter,
  Web_TorrentWorkspace_TorrentWorkspace_ProfileFilterLabel,
  Web_TorrentWorkspace_TorrentWorkspace_ProfileFolderOverlaps,
  Web_TorrentWorkspace_TorrentWorkspace_Profiles,
  Web_TorrentWorkspace_TorrentWorkspace_Props,
  Web_TorrentWorkspace_TorrentWorkspace_Query,
  Web_TorrentWorkspace_TorrentWorkspace_QueryState,
  Web_TorrentWorkspace_TorrentWorkspace_RemoveOpen,
  Web_TorrentWorkspace_TorrentWorkspace_RemoveOpenState,
  Web_TorrentWorkspace_TorrentWorkspace_RemoveSelected,
  Web_TorrentWorkspace_TorrentWorkspace_RemoveSelected_Returns,
  Web_TorrentWorkspace_TorrentWorkspace_RemoveTorrentNoun,
  Web_TorrentWorkspace_TorrentWorkspace_Returns,
  Web_TorrentWorkspace_TorrentWorkspace_SeedingCount,
  Web_TorrentWorkspace_TorrentWorkspace_Selected,
  Web_TorrentWorkspace_TorrentWorkspace_SelectedConnection,
  Web_TorrentWorkspace_TorrentWorkspace_SelectedIDs,
  Web_TorrentWorkspace_TorrentWorkspace_SelectedIDsState,
  Web_TorrentWorkspace_TorrentWorkspace_SelectedProfile,
  Web_TorrentWorkspace_TorrentWorkspace_SelectedProfileName,
  Web_TorrentWorkspace_TorrentWorkspace_SelectedTorrentId,
  Web_TorrentWorkspace_TorrentWorkspace_SetBusy,
  Web_TorrentWorkspace_TorrentWorkspace_SetConnectionFilter,
  Web_TorrentWorkspace_TorrentWorkspace_SetConnectionFilter_Connection,
  Web_TorrentWorkspace_TorrentWorkspace_SetConnectionFilter_Returns,
  Web_TorrentWorkspace_TorrentWorkspace_SetContextMenu,
  Web_TorrentWorkspace_TorrentWorkspace_SetDeleteLocalData,
  Web_TorrentWorkspace_TorrentWorkspace_SetLabelFilter,
  Web_TorrentWorkspace_TorrentWorkspace_SetLabelFilter_Label,
  Web_TorrentWorkspace_TorrentWorkspace_SetLabelFilter_Returns,
  Web_TorrentWorkspace_TorrentWorkspace_SetLastSelectedID,
  Web_TorrentWorkspace_TorrentWorkspace_SetPage,
  Web_TorrentWorkspace_TorrentWorkspace_SetPageSize,
  Web_TorrentWorkspace_TorrentWorkspace_SetProfileChangeOpen,
  Web_TorrentWorkspace_TorrentWorkspace_SetProfileFilter,
  Web_TorrentWorkspace_TorrentWorkspace_SetProfileFilter_Profile,
  Web_TorrentWorkspace_TorrentWorkspace_SetProfileFilter_Returns,
  Web_TorrentWorkspace_TorrentWorkspace_SetQuery,
  Web_TorrentWorkspace_TorrentWorkspace_SetRemoveOpen,
  Web_TorrentWorkspace_TorrentWorkspace_SetSelectedIDs,
  Web_TorrentWorkspace_TorrentWorkspace_SetSort,
  Web_TorrentWorkspace_TorrentWorkspace_SetStatusFilter,
  Web_TorrentWorkspace_TorrentWorkspace_SetStatusFilter_Returns,
  Web_TorrentWorkspace_TorrentWorkspace_SetStatusFilter_Status,
  Web_TorrentWorkspace_TorrentWorkspace_ShowQueuePosition,
  Web_TorrentWorkspace_TorrentWorkspace_Sort,
  Web_TorrentWorkspace_TorrentWorkspace_SortedTorrents,
  Web_TorrentWorkspace_TorrentWorkspace_SortState,
  Web_TorrentWorkspace_TorrentWorkspace_State,
  Web_TorrentWorkspace_TorrentWorkspace_Statistics,
  Web_TorrentWorkspace_TorrentWorkspace_StatusFilter,
  Web_TorrentWorkspace_TorrentWorkspace_StatusFilterItem,
  Web_TorrentWorkspace_TorrentWorkspace_StatusFilterLabel,
  Web_TorrentWorkspace_TorrentWorkspace_ToggleSort,
  Web_TorrentWorkspace_TorrentWorkspace_ToggleSort_Key,
  Web_TorrentWorkspace_TorrentWorkspace_ToggleSort_NextDirection,
  Web_TorrentWorkspace_TorrentWorkspace_ToggleSort_Returns,
  Web_TorrentWorkspace_TorrentWorkspace_ToggleSort_SameKey,
  Web_TorrentWorkspace_TorrentWorkspace_ToggleTorrent,
  Web_TorrentWorkspace_TorrentWorkspace_ToggleTorrent_AnchorIndex,
  Web_TorrentWorkspace_TorrentWorkspace_ToggleTorrent_EndIndex,
  Web_TorrentWorkspace_TorrentWorkspace_ToggleTorrent_Identifier,
  Web_TorrentWorkspace_TorrentWorkspace_ToggleTorrent_NextIDs,
  Web_TorrentWorkspace_TorrentWorkspace_ToggleTorrent_Range,
  Web_TorrentWorkspace_TorrentWorkspace_ToggleTorrent_Returns,
  Web_TorrentWorkspace_TorrentWorkspace_ToggleTorrent_StartIndex,
  Web_TorrentWorkspace_TorrentWorkspace_ToggleTorrent_TargetIndex,
  Web_TorrentWorkspace_TorrentWorkspace_ToggleVisible,
  Web_TorrentWorkspace_TorrentWorkspace_ToggleVisible_NextIDs,
  Web_TorrentWorkspace_TorrentWorkspace_ToggleVisible_Returns,
  Web_TorrentWorkspace_TorrentWorkspace_ToggleVisible_VisibleIDs,
  Web_TorrentWorkspace_TorrentWorkspace_TorrentHashesByIDRef,
  Web_TorrentWorkspace_TorrentWorkspace_TorrentHashesByIDRefValue,
  Web_TorrentWorkspace_TorrentWorkspace_Torrents,
  Web_TorrentWorkspace_TorrentWorkspace_TrackerIssue,
  Web_TorrentWorkspace_TorrentWorkspace_VisibleIDs,
  Web_TorrentWorkspace_TorrentWorkspace_VisibleTorrents,
} from '@/types/web/torrent-workspace.d.ts';

/**
 * Torrent Workspace - Compare Torrents.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_TorrentWorkspace_CompareTorrents_LeftTorrent}  leftTorrent  - Left torrent.
 * @param {Web_TorrentWorkspace_CompareTorrents_RightTorrent} rightTorrent - Right torrent.
 * @param {Web_TorrentWorkspace_CompareTorrents_Sort}         sort         - Sort.
 *
 * @returns {Web_TorrentWorkspace_CompareTorrents_Returns}
 *
 * @since 2.0.0
 */
const compareTorrents = (
  leftTorrent: Web_TorrentWorkspace_CompareTorrents_LeftTorrent,
  rightTorrent: Web_TorrentWorkspace_CompareTorrents_RightTorrent,
  sort: Web_TorrentWorkspace_CompareTorrents_Sort,
): Web_TorrentWorkspace_CompareTorrents_Returns => {
  const leftValue: Web_TorrentWorkspace_CompareTorrents_LeftValue = leftTorrent[sort['key']];
  const rightValue: Web_TorrentWorkspace_CompareTorrents_RightValue = rightTorrent[sort['key']];
  const direction: Web_TorrentWorkspace_CompareTorrents_Direction = (sort['direction'] === 'ascending') ? 1 : -1;

  if (typeof leftValue === 'string' && typeof rightValue === 'string') {
    return leftValue.localeCompare(rightValue, undefined, { sensitivity: 'base' }) * direction;
  }

  if (typeof leftValue === 'number' && typeof rightValue === 'number') {
    return (leftValue - rightValue) * direction;
  }

  return 0;
};

/**
 * Torrent Workspace - Hashes For Torrent Identifiers.
 *
 * Converts facade identifiers used by row selection into stable hashes only at
 * the mutation boundary. Duplicate hashes collapse to one backend selection.
 *
 * @param {Web_TorrentWorkspace_HashesForTorrentIdentifiers_Torrents}    torrents    - Torrents.
 * @param {Web_TorrentWorkspace_HashesForTorrentIdentifiers_Identifiers} identifiers - Identifiers.
 *
 * @returns {Web_TorrentWorkspace_HashesForTorrentIdentifiers_Returns}
 *
 * @since 2.0.0
 */
const hashesForTorrentIdentifiers = (
  torrents: Web_TorrentWorkspace_HashesForTorrentIdentifiers_Torrents,
  identifiers: Web_TorrentWorkspace_HashesForTorrentIdentifiers_Identifiers,
): Web_TorrentWorkspace_HashesForTorrentIdentifiers_Returns => {
  const hashes: Web_TorrentWorkspace_HashesForTorrentIdentifiers_Hashes = identifiers.map((identifier) => {
    const matchedTorrent: Web_TorrentWorkspace_HashesForTorrentIdentifiers_MatchedTorrent = torrents.find(
      (torrent) => torrent['id'] === identifier,
    );

    if (matchedTorrent === undefined) {
      return undefined;
    }

    return matchedTorrent['hashString'];
  });

  /**
   * Torrent Workspace - Is Hash.
   *
   * Keeps the identifiers that still match a torrent in the list.
   * Identifiers for torrents that left the list have no hash.
   *
   * @param {Web_TorrentWorkspace_HashesForTorrentIdentifiers_IsHash_Hash} hash - Hash.
   *
   * @returns {Web_TorrentWorkspace_HashesForTorrentIdentifiers_IsHash_TypeGuard}
   *
   * @since 2.4.1
   */
  const isHash: Web_TorrentWorkspace_HashesForTorrentIdentifiers_IsHash = (hash: Web_TorrentWorkspace_HashesForTorrentIdentifiers_IsHash_Hash): hash is Web_TorrentWorkspace_HashesForTorrentIdentifiers_IsHash_TypeGuard => hash !== undefined;

  return [...new Set(hashes.filter(isHash))];
};

/**
 * Torrent Workspace - Sort Header.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_TorrentWorkspace_SortHeader_Props} props - Props.
 *
 * @returns {Web_TorrentWorkspace_SortHeader_Returns}
 *
 * @since 2.0.0
 */
const SortHeader = (props: Web_TorrentWorkspace_SortHeader_Props): Web_TorrentWorkspace_SortHeader_Returns => {
  const activeSort: Web_TorrentWorkspace_SortHeader_ActiveSort = props['activeSort'];
  const label: Web_TorrentWorkspace_SortHeader_Label = props['label'];
  const onSort: Web_TorrentWorkspace_SortHeader_OnSort = props['onSort'];
  const sortKey: Web_TorrentWorkspace_SortHeader_SortKey = props['sortKey'];
  const active: Web_TorrentWorkspace_SortHeader_Active = activeSort['key'] === sortKey;
  const ascending: Web_TorrentWorkspace_SortHeader_Ascending = active && activeSort['direction'] === 'ascending';
  const classNames: Web_TorrentWorkspace_SortHeader_ClassNames = ['sort-header'];

  if (active === true) {
    classNames.push('sort-header-active');
  }

  if (ascending === true) {
    classNames.push('sort-header-ascending');
  }

  return (
    <button className={classNames.join(' ')} onClick={() => onSort(sortKey)} type="button">
      {label}
      <Icon name="chevron-down" size={14} />
    </button>
  );
};

/**
 * Torrent Workspace - Statistic Period.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_TorrentWorkspace_StatisticPeriod_Statistics} statistics - Statistics.
 * @param {Web_TorrentWorkspace_StatisticPeriod_Key}        key        - Key.
 *
 * @returns {Web_TorrentWorkspace_StatisticPeriod_Returns}
 *
 * @since 2.0.0
 */
const statisticPeriod = (
  statistics: Web_TorrentWorkspace_StatisticPeriod_Statistics,
  key: Web_TorrentWorkspace_StatisticPeriod_Key,
): Web_TorrentWorkspace_StatisticPeriod_Returns => {
  if (statistics === undefined) {
    return undefined;
  }

  return statistics[key];
};

/**
 * Torrent Workspace - Torrent Profile Change Dialog.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_TorrentWorkspace_TorrentProfileChangeDialog_Props} props - Props.
 *
 * @returns {Web_TorrentWorkspace_TorrentProfileChangeDialog_Returns}
 *
 * @since 2.0.0
 */
const TorrentProfileChangeDialog = (props: Web_TorrentWorkspace_TorrentProfileChangeDialog_Props): Web_TorrentWorkspace_TorrentProfileChangeDialog_Returns => {
  const connections: Web_TorrentWorkspace_TorrentProfileChangeDialog_Connections = props['connections'];
  const defaultProfile: Web_TorrentWorkspace_TorrentProfileChangeDialog_DefaultProfile = props['defaultProfile'];
  const hashes: Web_TorrentWorkspace_TorrentProfileChangeDialog_Hashes = props['hashes'];
  const onClose: Web_TorrentWorkspace_TorrentProfileChangeDialog_OnClose = props['onClose'];
  const onSetProfile: Web_TorrentWorkspace_TorrentProfileChangeDialog_OnSetProfile = props['onSetProfile'];
  const profiles: Web_TorrentWorkspace_TorrentProfileChangeDialog_Profiles = props['profiles'];
  const torrents: Web_TorrentWorkspace_TorrentProfileChangeDialog_Torrents = props['torrents'];

  useEscapeKey(onClose, true);

  const profileIDState: Web_TorrentWorkspace_TorrentProfileChangeDialog_ProfileIDState = useState<Web_TorrentWorkspace_TorrentProfileChangeDialog_ProfileID>('');
  const profileID: Web_TorrentWorkspace_TorrentProfileChangeDialog_ProfileID = profileIDState[0];
  const setProfileID: Web_TorrentWorkspace_TorrentProfileChangeDialog_SetProfileID = profileIDState[1];
  const applyOptionsState: Web_TorrentWorkspace_TorrentProfileChangeDialog_ApplyOptionsState = useState<Web_TorrentWorkspace_TorrentProfileChangeDialog_ApplyOptions>(false);
  const applyOptions: Web_TorrentWorkspace_TorrentProfileChangeDialog_ApplyOptions = applyOptionsState[0];
  const setApplyOptions: Web_TorrentWorkspace_TorrentProfileChangeDialog_SetApplyOptions = applyOptionsState[1];
  const resultsState: Web_TorrentWorkspace_TorrentProfileChangeDialog_ResultsState = useState<Web_TorrentWorkspace_TorrentProfileChangeDialog_Results>(null);
  const results: Web_TorrentWorkspace_TorrentProfileChangeDialog_Results = resultsState[0];
  const setResults: Web_TorrentWorkspace_TorrentProfileChangeDialog_SetResults = resultsState[1];
  const busyState: Web_TorrentWorkspace_TorrentProfileChangeDialog_BusyState = useState<Web_TorrentWorkspace_TorrentProfileChangeDialog_Busy>(false);
  const busy: Web_TorrentWorkspace_TorrentProfileChangeDialog_Busy = busyState[0];
  const setBusy: Web_TorrentWorkspace_TorrentProfileChangeDialog_SetBusy = busyState[1];
  const errorState: Web_TorrentWorkspace_TorrentProfileChangeDialog_ErrorState = useState<Web_TorrentWorkspace_TorrentProfileChangeDialog_Error>('');
  const error: Web_TorrentWorkspace_TorrentProfileChangeDialog_Error = errorState[0];
  const setError: Web_TorrentWorkspace_TorrentProfileChangeDialog_SetError = errorState[1];

  /**
   * Torrent Workspace - Submit.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @param {Web_TorrentWorkspace_TorrentProfileChangeDialog_Submit_Event} event - Event.
   *
   * @returns {Web_TorrentWorkspace_TorrentProfileChangeDialog_Submit_Returns}
   *
   * @since 2.0.0
   */
  const submit: Web_TorrentWorkspace_TorrentProfileChangeDialog_Submit = async (event: Web_TorrentWorkspace_TorrentProfileChangeDialog_Submit_Event): Web_TorrentWorkspace_TorrentProfileChangeDialog_Submit_Returns => {
    event.preventDefault();

    setBusy(true);
    setError('');

    try {
      const response: Web_TorrentWorkspace_TorrentProfileChangeDialog_Submit_Response = await onSetProfile({
        applyOptions,
        hashes,
        profileId: (profileID === '') ? null : profileID,
      });

      setResults(response['moved']);
    } catch (caughtError) {
      setError((caughtError instanceof Error) ? caughtError.message : 'The profile couldn\'t be changed.');
    } finally {
      setBusy(false);
    }

    return;
  };

  const selectedProfile: Web_TorrentWorkspace_TorrentProfileChangeDialog_SelectedProfile = profiles.find(
    (profile) => profile['id'] === profileID,
  );
  const selectedProfileData: Web_TorrentWorkspace_TorrentProfileChangeDialog_SelectedProfileData = selectedProfile ?? defaultProfile;
  const defaultConnection: Web_TorrentWorkspace_TorrentProfileChangeDialog_DefaultConnection = connections.find((connection) => connection['default'] === true);
  let targetConnectionID: Web_TorrentWorkspace_TorrentProfileChangeDialog_TargetConnectionID = (defaultConnection !== undefined) ? defaultConnection['id'] : undefined;

  if ('connectionId' in selectedProfileData && selectedProfileData['connectionId'] !== null) {
    targetConnectionID = selectedProfileData['connectionId'];
  }

  const selectedHashes: Web_TorrentWorkspace_TorrentProfileChangeDialog_SelectedHashes = new Set(hashes);
  const selectedTorrents: Web_TorrentWorkspace_TorrentProfileChangeDialog_SelectedTorrents = torrents.filter(
    (torrent) => selectedHashes.has(torrent['hashString']),
  );
  const moveCount: Web_TorrentWorkspace_TorrentProfileChangeDialog_MoveCount = selectedTorrents.filter((torrent) => (
    torrent['downloadDir'] !== selectedProfileData['downloadDirectory']
    || torrent['connectionId'] !== targetConnectionID
  )).length;
  const torrentNoun: Web_TorrentWorkspace_TorrentProfileChangeDialog_TorrentNoun = (hashes.length === 1) ? 'torrent' : 'torrents';
  const selectedTorrentNoun: Web_TorrentWorkspace_TorrentProfileChangeDialog_SelectedTorrentNoun = (selectedTorrents.length === 1) ? 'torrent' : 'torrents';

  return (
    <div className="dialog-backdrop" role="presentation">
      <section aria-labelledby="change-profile-title" aria-modal="true" className="dialog dialog-small" role="dialog">
        <div className="dialog-heading">
          <h2 id="change-profile-title">{(results === null) ? `Change profile for ${hashes.length} ${torrentNoun}` : 'Profile change results'}</h2>
          <button aria-label="Close" className="icon-button" onClick={onClose} type="button"><Icon name="x" /></button>
        </div>
        {(results === null) ? (
          <form noValidate onSubmit={submit}>
            <label className="field">
              <span>Profile</span>
              <select onChange={(event) => setProfileID(event.currentTarget.value)} value={profileID}>
                <option value="">{defaultProfile['name']}</option>
                {profiles.map((profile) => (
                  <option key={profile['id']} value={profile['id']}>{profile['name']}</option>
                ))}
              </select>
            </label>
            <p>{`${moveCount} of ${selectedTorrents.length} selected ${selectedTorrentNoun} will move folder or VPN.`}</p>
            <label aria-label="Also apply its labels and limits" className="check-row">
              <input checked={applyOptions} onChange={(event) => setApplyOptions(event.currentTarget.checked)} type="checkbox" />
              <span>
                <strong>Also apply its labels and limits</strong>
                <small>Copies the profile settings to the selected torrents now.</small>
              </span>
            </label>
            {(error === '') ? null : <div className="form-error" role="alert">{error}</div>}
            <div className="dialog-actions">
              <Button onClick={onClose}>Cancel</Button>
              <Button disabled={busy} type="submit" variant="primary">{(busy === true) ? 'Applying…' : 'Apply'}</Button>
            </div>
          </form>
        ) : (
          <>
            <div className="torrent-move-results">
              <ul>
                {results.map((result) => (
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
              <Button onClick={onClose} variant="primary">Done</Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

/**
 * Torrent Workspace - Torrent Workspace.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_TorrentWorkspace_TorrentWorkspace_Props} props - Props.
 *
 * @returns {Web_TorrentWorkspace_TorrentWorkspace_Returns}
 *
 * @since 2.0.0
 */
export const TorrentWorkspace = (props: Web_TorrentWorkspace_TorrentWorkspace_Props): Web_TorrentWorkspace_TorrentWorkspace_Returns => {
  const connections: Web_TorrentWorkspace_TorrentWorkspace_Connections = props['connections'];
  const defaultProfile: Web_TorrentWorkspace_TorrentWorkspace_DefaultProfile = props['defaultProfile'];
  const errors: Web_TorrentWorkspace_TorrentWorkspace_Errors = props['errors'];
  const filters: Web_TorrentWorkspace_TorrentWorkspace_Filters = props['filters'];
  const filtersOpen: Web_TorrentWorkspace_TorrentWorkspace_FiltersOpen = props['filtersOpen'];
  const onAction: Web_TorrentWorkspace_TorrentWorkspace_OnAction = props['onAction'];
  const onFixProfileFolder: Web_TorrentWorkspace_TorrentWorkspace_OnFixProfileFolder = props['onFixProfileFolder'];
  const profileFolderOverlaps: Web_TorrentWorkspace_TorrentWorkspace_ProfileFolderOverlaps = props['profileFolderOverlaps'];
  const onAddTorrent: Web_TorrentWorkspace_TorrentWorkspace_OnAddTorrent = props['onAddTorrent'];
  const onFiltersChange: Web_TorrentWorkspace_TorrentWorkspace_OnFiltersChange = props['onFiltersChange'];
  const onOpenFilters: Web_TorrentWorkspace_TorrentWorkspace_OnOpenFilters = props['onOpenFilters'];
  const onRemove: Web_TorrentWorkspace_TorrentWorkspace_OnRemove = props['onRemove'];
  const onSelectTorrent: Web_TorrentWorkspace_TorrentWorkspace_OnSelectTorrent = props['onSelectTorrent'];
  const onSetProfile: Web_TorrentWorkspace_TorrentWorkspace_OnSetProfile = props['onSetProfile'];
  const profiles: Web_TorrentWorkspace_TorrentWorkspace_Profiles = props['profiles'];
  const selectedTorrentId: Web_TorrentWorkspace_TorrentWorkspace_SelectedTorrentId = props['selectedTorrentId'];
  const statistics: Web_TorrentWorkspace_TorrentWorkspace_Statistics = props['statistics'];
  const torrents: Web_TorrentWorkspace_TorrentWorkspace_Torrents = props['torrents'];
  const connectionFilter: Web_TorrentWorkspace_TorrentWorkspace_ConnectionFilter = filters['connection'];
  const statusFilter: Web_TorrentWorkspace_TorrentWorkspace_StatusFilter = filters['status'];
  const labelFilter: Web_TorrentWorkspace_TorrentWorkspace_LabelFilter = filters['label'];
  const profileFilter: Web_TorrentWorkspace_TorrentWorkspace_ProfileFilter = filters['profile'];

  /**
   * Torrent Workspace - Set Status Filter.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @param {Web_TorrentWorkspace_TorrentWorkspace_SetStatusFilter_Status} status - Status.
   *
   * @returns {Web_TorrentWorkspace_TorrentWorkspace_SetStatusFilter_Returns}
   *
   * @since 2.0.0
   */
  const setStatusFilter: Web_TorrentWorkspace_TorrentWorkspace_SetStatusFilter = (status: Web_TorrentWorkspace_TorrentWorkspace_SetStatusFilter_Status): Web_TorrentWorkspace_TorrentWorkspace_SetStatusFilter_Returns => onFiltersChange({
    ...filters,
    status,
  });

  /**
   * Torrent Workspace - Set Label Filter.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @param {Web_TorrentWorkspace_TorrentWorkspace_SetLabelFilter_Label} label - Label.
   *
   * @returns {Web_TorrentWorkspace_TorrentWorkspace_SetLabelFilter_Returns}
   *
   * @since 2.0.0
   */
  const setLabelFilter: Web_TorrentWorkspace_TorrentWorkspace_SetLabelFilter = (label: Web_TorrentWorkspace_TorrentWorkspace_SetLabelFilter_Label): Web_TorrentWorkspace_TorrentWorkspace_SetLabelFilter_Returns => onFiltersChange({
    ...filters,
    label,
  });

  /**
   * Torrent Workspace - Set Profile Filter.
   *
   * Updates the shared sidebar and the active-filter pills.
   * An empty string disables this independent filter dimension.
   *
   * @param {Web_TorrentWorkspace_TorrentWorkspace_SetProfileFilter_Profile} profile - Profile.
   *
   * @returns {Web_TorrentWorkspace_TorrentWorkspace_SetProfileFilter_Returns}
   *
   * @since 2.0.0
   */
  const setProfileFilter: Web_TorrentWorkspace_TorrentWorkspace_SetProfileFilter = (profile: Web_TorrentWorkspace_TorrentWorkspace_SetProfileFilter_Profile): Web_TorrentWorkspace_TorrentWorkspace_SetProfileFilter_Returns => onFiltersChange({
    ...filters,
    profile,
  });

  /**
   * Torrent Workspace - Set Connection Filter.
   *
   * Clears or selects the VPN dimension independently from library filters.
   * The VPN connection list uses this handler through shared filter state.
   *
   * @param {Web_TorrentWorkspace_TorrentWorkspace_SetConnectionFilter_Connection} connection - Connection.
   *
   * @returns {Web_TorrentWorkspace_TorrentWorkspace_SetConnectionFilter_Returns}
   *
   * @since 2.0.0
   */
  const setConnectionFilter: Web_TorrentWorkspace_TorrentWorkspace_SetConnectionFilter = (connection: Web_TorrentWorkspace_TorrentWorkspace_SetConnectionFilter_Connection): Web_TorrentWorkspace_TorrentWorkspace_SetConnectionFilter_Returns => onFiltersChange({
    ...filters,
    connection,
  });
  const queryState: Web_TorrentWorkspace_TorrentWorkspace_QueryState = useState<Web_TorrentWorkspace_TorrentWorkspace_Query>('');
  const query: Web_TorrentWorkspace_TorrentWorkspace_Query = queryState[0];
  const setQuery: Web_TorrentWorkspace_TorrentWorkspace_SetQuery = queryState[1];
  const selectedIDsState: Web_TorrentWorkspace_TorrentWorkspace_SelectedIDsState = useState<Web_TorrentWorkspace_TorrentWorkspace_SelectedIDs>([]);
  const selectedIDs: Web_TorrentWorkspace_TorrentWorkspace_SelectedIDs = selectedIDsState[0];
  const setSelectedIDs: Web_TorrentWorkspace_TorrentWorkspace_SetSelectedIDs = selectedIDsState[1];
  const lastSelectedIDState: Web_TorrentWorkspace_TorrentWorkspace_LastSelectedIDState = useState<Web_TorrentWorkspace_TorrentWorkspace_LastSelectedID>(null);
  const lastSelectedID: Web_TorrentWorkspace_TorrentWorkspace_LastSelectedID = lastSelectedIDState[0];
  const setLastSelectedID: Web_TorrentWorkspace_TorrentWorkspace_SetLastSelectedID = lastSelectedIDState[1];
  const sortState: Web_TorrentWorkspace_TorrentWorkspace_SortState = useState<Web_TorrentWorkspace_TorrentWorkspace_Sort>({
    direction: 'ascending',
    key: 'queuePosition',
  });
  const sort: Web_TorrentWorkspace_TorrentWorkspace_Sort = sortState[0];
  const setSort: Web_TorrentWorkspace_TorrentWorkspace_SetSort = sortState[1];
  const pageState: Web_TorrentWorkspace_TorrentWorkspace_PageState = useState<Web_TorrentWorkspace_TorrentWorkspace_Page>(1);
  const page: Web_TorrentWorkspace_TorrentWorkspace_Page = pageState[0];
  const setPage: Web_TorrentWorkspace_TorrentWorkspace_SetPage = pageState[1];
  const pageSizeState: Web_TorrentWorkspace_TorrentWorkspace_PageSizeState = useState<Web_TorrentWorkspace_TorrentWorkspace_PageSize>(25);
  const pageSize: Web_TorrentWorkspace_TorrentWorkspace_PageSize = pageSizeState[0];
  const setPageSize: Web_TorrentWorkspace_TorrentWorkspace_SetPageSize = pageSizeState[1];
  const busyState: Web_TorrentWorkspace_TorrentWorkspace_BusyState = useState<Web_TorrentWorkspace_TorrentWorkspace_Busy>(false);
  const busy: Web_TorrentWorkspace_TorrentWorkspace_Busy = busyState[0];
  const setBusy: Web_TorrentWorkspace_TorrentWorkspace_SetBusy = busyState[1];
  const removeOpenState: Web_TorrentWorkspace_TorrentWorkspace_RemoveOpenState = useState<Web_TorrentWorkspace_TorrentWorkspace_RemoveOpen>(false);
  const removeOpen: Web_TorrentWorkspace_TorrentWorkspace_RemoveOpen = removeOpenState[0];
  const setRemoveOpen: Web_TorrentWorkspace_TorrentWorkspace_SetRemoveOpen = removeOpenState[1];
  const profileChangeOpenState: Web_TorrentWorkspace_TorrentWorkspace_ProfileChangeOpenState = useState<Web_TorrentWorkspace_TorrentWorkspace_ProfileChangeOpen>(false);
  const profileChangeOpen: Web_TorrentWorkspace_TorrentWorkspace_ProfileChangeOpen = profileChangeOpenState[0];
  const setProfileChangeOpen: Web_TorrentWorkspace_TorrentWorkspace_SetProfileChangeOpen = profileChangeOpenState[1];
  const deleteLocalDataState: Web_TorrentWorkspace_TorrentWorkspace_DeleteLocalDataState = useState<Web_TorrentWorkspace_TorrentWorkspace_DeleteLocalData>(false);
  const deleteLocalData: Web_TorrentWorkspace_TorrentWorkspace_DeleteLocalData = deleteLocalDataState[0];
  const setDeleteLocalData: Web_TorrentWorkspace_TorrentWorkspace_SetDeleteLocalData = deleteLocalDataState[1];
  const contextMenuState: Web_TorrentWorkspace_TorrentWorkspace_ContextMenuState = useState<Web_TorrentWorkspace_TorrentWorkspace_ContextMenu>(null);
  const contextMenu: Web_TorrentWorkspace_TorrentWorkspace_ContextMenu = contextMenuState[0];
  const setContextMenu: Web_TorrentWorkspace_TorrentWorkspace_SetContextMenu = contextMenuState[1];
  const contextMenuRef: Web_TorrentWorkspace_TorrentWorkspace_ContextMenuRef = useRef<Web_TorrentWorkspace_TorrentWorkspace_ContextMenuRefValue>(null);
  const torrentHashesByIDRef: Web_TorrentWorkspace_TorrentWorkspace_TorrentHashesByIDRef = useRef<Web_TorrentWorkspace_TorrentWorkspace_TorrentHashesByIDRefValue>(new Map(
    torrents.map((torrent) => [
      torrent['id'],
      torrent['hashString'],
    ] as const),
  ));

  useEscapeKey(() => setRemoveOpen(false), removeOpen);

  useEffect(() => {
    setSelectedIDs((currentIDs) => (
      remapSelectedTorrentIDs(currentIDs, torrentHashesByIDRef.current, torrents)
    ));
    setLastSelectedID((currentID) => {
      if (currentID === null) {
        return null;
      }

      const nextIDs: Web_TorrentWorkspace_TorrentWorkspace_NextIDs = remapSelectedTorrentIDs([currentID], torrentHashesByIDRef.current, torrents);
      const nextID: Web_TorrentWorkspace_TorrentWorkspace_NextID = nextIDs[0];

      return nextID ?? null;
    });
    torrentHashesByIDRef.current = new Map(
      torrents.map((torrent) => [
        torrent['id'],
        torrent['hashString'],
      ] as const),
    );

    return;
  }, [torrents]);

  useEffect(() => setPage(1), [
    connectionFilter,
    labelFilter,
    pageSize,
    profileFilter,
    query,
    sort,
    statusFilter,
  ]);

  // Another list starts with nothing checked, so an action can't reach torrents that
  // were checked in a list that is no longer on screen.
  useEffect(() => {
    setSelectedIDs([]);
    setLastSelectedID(null);

    return;
  }, [
    connectionFilter,
    labelFilter,
    profileFilter,
    statusFilter,
  ]);

  useEffect(() => {
    if (contextMenu === null) {
      return undefined;
    }

    /**
     * Torrent Workspace - Close Menu.
     *
     * Centralizes this operation for the surrounding workflow.
     * Callers reuse one implementation instead of repeating the behavior.
     *
     * @returns {Web_TorrentWorkspace_TorrentWorkspace_CloseMenu_Returns}
     *
     * @since 2.0.0
     */
    const closeMenu: Web_TorrentWorkspace_TorrentWorkspace_CloseMenu = (): Web_TorrentWorkspace_TorrentWorkspace_CloseMenu_Returns => setContextMenu(null);

    // Clicks inside the menu keep it open; its buttons close it once their action starts.

    /**
     * Torrent Workspace - Close On Outside Click.
     *
     * Centralizes this operation for the surrounding workflow.
     * Callers reuse one implementation instead of repeating the behavior.
     *
     * @param {Web_TorrentWorkspace_TorrentWorkspace_CloseOnOutsideClick_Event} event - Event.
     *
     * @returns {Web_TorrentWorkspace_TorrentWorkspace_CloseOnOutsideClick_Returns}
     *
     * @since 2.0.0
     */
    const closeOnOutsideClick: Web_TorrentWorkspace_TorrentWorkspace_CloseOnOutsideClick = (event: Web_TorrentWorkspace_TorrentWorkspace_CloseOnOutsideClick_Event): Web_TorrentWorkspace_TorrentWorkspace_CloseOnOutsideClick_Returns => {
      if (
        event.target instanceof Node
        && contextMenuRef.current !== null
        && contextMenuRef.current.contains(event.target) === true
      ) {
        return;
      }

      closeMenu();

      return;
    };

    /**
     * Torrent Workspace - Close On Escape.
     *
     * Centralizes this operation for the surrounding workflow.
     * Callers reuse one implementation instead of repeating the behavior.
     *
     * @param {Web_TorrentWorkspace_TorrentWorkspace_CloseOnEscape_Event} event - Event.
     *
     * @returns {Web_TorrentWorkspace_TorrentWorkspace_CloseOnEscape_Returns}
     *
     * @since 2.0.0
     */
    const closeOnEscape: Web_TorrentWorkspace_TorrentWorkspace_CloseOnEscape = (event: Web_TorrentWorkspace_TorrentWorkspace_CloseOnEscape_Event): Web_TorrentWorkspace_TorrentWorkspace_CloseOnEscape_Returns => {
      if (event.key === 'Escape') {
        closeMenu();
      }

      return;
    };

    window.addEventListener('click', closeOnOutsideClick);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      window.removeEventListener('click', closeOnOutsideClick);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('keydown', closeOnEscape);

      return;
    };
  }, [contextMenu]);

  const filteredTorrents: Web_TorrentWorkspace_TorrentWorkspace_FilteredTorrents = useMemo(() => {
    const normalizedQuery: Web_TorrentWorkspace_TorrentWorkspace_NormalizedQuery = query.trim().toLowerCase();

    return torrents.filter((torrent) => (
      torrentMatchesFilter(torrent, statusFilter)
      && (
        connectionFilter === ''
        || torrentMatchesLibrarySelection(torrent, {
          kind: 'connection',
          value: connectionFilter,
        })
      )
      && (
        labelFilter === ''
        || torrentMatchesLibrarySelection(torrent, {
          kind: 'label',
          value: labelFilter,
        })
      )
      && (
        profileFilter === ''
        || torrentMatchesLibrarySelection(torrent, {
          kind: 'profile',
          value: (profileFilter === defaultProfileFilterValue) ? null : profileFilter,
        })
      )
      && (
        normalizedQuery === ''
        || torrent['name'].toLowerCase().includes(normalizedQuery)
        || torrent['labels'].some((label) => label.toLowerCase().includes(normalizedQuery))
      )
    ));
  }, [
    connectionFilter,
    labelFilter,
    profileFilter,
    query,
    statusFilter,
    torrents,
  ]);

  const showQueuePosition: Web_TorrentWorkspace_TorrentWorkspace_ShowQueuePosition = connections.length <= 1 || torrentQueuePositionsAreComparable(filteredTorrents);
  const effectiveSort: Web_TorrentWorkspace_TorrentWorkspace_EffectiveSort = (showQueuePosition === false && sort['key'] === 'queuePosition') ? {
    direction: 'ascending',
    key: 'name',
  } : sort;
  const sortedTorrents: Web_TorrentWorkspace_TorrentWorkspace_SortedTorrents = useMemo(() => (
    [...filteredTorrents].sort((leftTorrent, rightTorrent) => (
      compareTorrents(leftTorrent, rightTorrent, effectiveSort)
    ))
  ), [
    effectiveSort,
    filteredTorrents,
  ]);

  const pageCount: Web_TorrentWorkspace_TorrentWorkspace_PageCount = Math.max(1, Math.ceil(sortedTorrents.length / pageSize));
  const currentPage: Web_TorrentWorkspace_TorrentWorkspace_CurrentPage = Math.min(page, pageCount);
  const firstVisibleIndex: Web_TorrentWorkspace_TorrentWorkspace_FirstVisibleIndex = (currentPage - 1) * pageSize;
  const visibleTorrents: Web_TorrentWorkspace_TorrentWorkspace_VisibleTorrents = useMemo(() => (
    sortedTorrents.slice(firstVisibleIndex, firstVisibleIndex + pageSize)
  ), [
    firstVisibleIndex,
    pageSize,
    sortedTorrents,
  ]);
  const everyVisibleSelected: Web_TorrentWorkspace_TorrentWorkspace_EveryVisibleSelected = visibleTorrents.length > 0 && visibleTorrents.every(
    (torrent) => selectedIDs.includes(torrent['id']),
  );

  // Checks only ever cover rows on screen. A search, another page, a new sort, or a
  // torrent leaving the list unchecks what it hides, so actions never reach those rows.
  useEffect(() => {
    const visibleIDs: Web_TorrentWorkspace_TorrentWorkspace_VisibleIDs = new Set(
      visibleTorrents.map((torrent) => torrent['id']),
    );

    setSelectedIDs((currentIDs) => {
      const keptIDs: Web_TorrentWorkspace_TorrentWorkspace_KeptIDs = currentIDs.filter((identifier) => visibleIDs.has(identifier));

      return (keptIDs.length === currentIDs.length) ? currentIDs : keptIDs;
    });
    setLastSelectedID((currentID) => (
      (currentID === null || visibleIDs.has(currentID) === true) ? currentID : null
    ));

    return;
  }, [visibleTorrents]);
  const connectionTorrents: Web_TorrentWorkspace_TorrentWorkspace_ConnectionTorrents = (connectionFilter === '') ? torrents : torrents.filter(
    (torrent) => torrent['connectionId'] === connectionFilter,
  );
  const downloadingCount: Web_TorrentWorkspace_TorrentWorkspace_DownloadingCount = connectionTorrents.filter((torrent) => torrentMatchesFilter(torrent, 'downloading')).length;
  const seedingCount: Web_TorrentWorkspace_TorrentWorkspace_SeedingCount = connectionTorrents.filter((torrent) => torrentMatchesFilter(torrent, 'seeding')).length;
  const currentStatistics: Web_TorrentWorkspace_TorrentWorkspace_CurrentStatistics = statisticPeriod(statistics, 'current-stats');
  const cumulativeStatistics: Web_TorrentWorkspace_TorrentWorkspace_CumulativeStatistics = statisticPeriod(statistics, 'cumulative-stats');
  const statusFilterItem: Web_TorrentWorkspace_TorrentWorkspace_StatusFilterItem = torrentLibraryFilters.find((filter) => filter['id'] === statusFilter);
  const statusFilterLabel: Web_TorrentWorkspace_TorrentWorkspace_StatusFilterLabel = (statusFilterItem !== undefined) ? statusFilterItem['label'] : 'All torrents';
  const selectedProfile: Web_TorrentWorkspace_TorrentWorkspace_SelectedProfile = profiles.find(
    (profile) => profile['id'] === profileFilter,
  );
  const selectedProfileName: Web_TorrentWorkspace_TorrentWorkspace_SelectedProfileName = (selectedProfile !== undefined) ? selectedProfile['name'] : '';
  const profileFilterLabel: Web_TorrentWorkspace_TorrentWorkspace_ProfileFilterLabel = (profileFilter === defaultProfileFilterValue) ? defaultProfile['name'] : selectedProfileName;
  const selectedConnection: Web_TorrentWorkspace_TorrentWorkspace_SelectedConnection = connections.find((connection) => connection['id'] === connectionFilter);
  const connectionFilterLabel: Web_TorrentWorkspace_TorrentWorkspace_ConnectionFilterLabel = (selectedConnection !== undefined) ? selectedConnection['name'] : connectionFilter;
  const activeFilterCount: Web_TorrentWorkspace_TorrentWorkspace_ActiveFilterCount = Number(statusFilter !== 'all')
    + Number(profileFilter !== '')
    + Number(labelFilter !== '');
  const activeFilterLabel: Web_TorrentWorkspace_TorrentWorkspace_ActiveFilterLabel = (activeFilterCount === 1) ? '1 active filter' : `${activeFilterCount} active filters`;
  const filtersActive: Web_TorrentWorkspace_TorrentWorkspace_FiltersActive = (
    connectionFilter !== ''
    || statusFilter !== 'all'
    || labelFilter !== ''
    || profileFilter !== ''
    || query !== ''
  );
  const duplicateNotices: Web_TorrentWorkspace_TorrentWorkspace_DuplicateNotices = useMemo(
    () => duplicateTorrentNotices(errors, torrents, connections),
    [
      connections,
      errors,
      torrents,
    ],
  );
  const needsProfileCount: Web_TorrentWorkspace_TorrentWorkspace_NeedsProfileCount = torrents.filter(
    (torrent) => torrent['needsProfile'] !== null,
  ).length;
  const contextMenuTorrentFileCount: Web_TorrentWorkspace_TorrentWorkspace_ContextMenuTorrentFileCount = (contextMenu === null) ? 0 : torrents.filter(
    (torrent) => (
      contextMenu['torrentIds'].includes(torrent['id']) && torrent['metadataPercentComplete'] >= 1
    ),
  ).length;
  const contextMenuFinishedCount: Web_TorrentWorkspace_TorrentWorkspace_ContextMenuFinishedCount = (contextMenu === null) ? 0 : torrents.filter(
    (torrent) => (
      contextMenu['torrentIds'].includes(torrent['id']) && torrentHasFinishedFiles(torrent)
    ),
  ).length;

  /**
   * Torrent Workspace - Toggle Sort.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @param {Web_TorrentWorkspace_TorrentWorkspace_ToggleSort_Key} key - Key.
   *
   * @returns {Web_TorrentWorkspace_TorrentWorkspace_ToggleSort_Returns}
   *
   * @since 2.0.0
   */
  const toggleSort: Web_TorrentWorkspace_TorrentWorkspace_ToggleSort = (key: Web_TorrentWorkspace_TorrentWorkspace_ToggleSort_Key): Web_TorrentWorkspace_TorrentWorkspace_ToggleSort_Returns => {
    setSort((currentSort) => {
      const sameKey: Web_TorrentWorkspace_TorrentWorkspace_ToggleSort_SameKey = currentSort['key'] === key;
      const nextDirection: Web_TorrentWorkspace_TorrentWorkspace_ToggleSort_NextDirection = (sameKey === true && currentSort['direction'] === 'ascending') ? 'descending' : 'ascending';

      return {
        direction: (sameKey === true) ? nextDirection : 'ascending',
        key,
      };
    });

    return;
  };

  /**
   * Torrent Workspace - Toggle Visible.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @returns {Web_TorrentWorkspace_TorrentWorkspace_ToggleVisible_Returns}
   *
   * @since 2.0.0
   */
  const toggleVisible: Web_TorrentWorkspace_TorrentWorkspace_ToggleVisible = (): Web_TorrentWorkspace_TorrentWorkspace_ToggleVisible_Returns => {
    if (everyVisibleSelected === true) {
      const visibleIDs: Web_TorrentWorkspace_TorrentWorkspace_ToggleVisible_VisibleIDs = new Set(
        visibleTorrents.map((torrent) => torrent['id']),
      );

      setSelectedIDs((currentIDs) => (
        currentIDs.filter((identifier) => visibleIDs.has(identifier) === false)
      ));

      return;
    }

    const nextIDs: Web_TorrentWorkspace_TorrentWorkspace_ToggleVisible_NextIDs = new Set(selectedIDs);

    for (const torrent of visibleTorrents) {
      nextIDs.add(torrent['id']);
    }

    setSelectedIDs([...nextIDs]);

    return;
  };

  /**
   * Torrent Workspace - Toggle Torrent.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @param {Web_TorrentWorkspace_TorrentWorkspace_ToggleTorrent_Identifier} identifier - Identifier.
   * @param {Web_TorrentWorkspace_TorrentWorkspace_ToggleTorrent_Range}      range      - Range.
   *
   * @returns {Web_TorrentWorkspace_TorrentWorkspace_ToggleTorrent_Returns}
   *
   * @since 2.0.0
   */
  const toggleTorrent: Web_TorrentWorkspace_TorrentWorkspace_ToggleTorrent = (identifier: Web_TorrentWorkspace_TorrentWorkspace_ToggleTorrent_Identifier, range: Web_TorrentWorkspace_TorrentWorkspace_ToggleTorrent_Range): Web_TorrentWorkspace_TorrentWorkspace_ToggleTorrent_Returns => {
    // A shift-click range stays on this page, so it never checks rows you can't see.
    if (range === true && lastSelectedID !== null) {
      const anchorIndex: Web_TorrentWorkspace_TorrentWorkspace_ToggleTorrent_AnchorIndex = visibleTorrents.findIndex((torrent) => torrent['id'] === lastSelectedID);
      const targetIndex: Web_TorrentWorkspace_TorrentWorkspace_ToggleTorrent_TargetIndex = visibleTorrents.findIndex((torrent) => torrent['id'] === identifier);

      if (anchorIndex >= 0 && targetIndex >= 0) {
        const startIndex: Web_TorrentWorkspace_TorrentWorkspace_ToggleTorrent_StartIndex = Math.min(anchorIndex, targetIndex);
        const endIndex: Web_TorrentWorkspace_TorrentWorkspace_ToggleTorrent_EndIndex = Math.max(anchorIndex, targetIndex);
        const nextIDs: Web_TorrentWorkspace_TorrentWorkspace_ToggleTorrent_NextIDs = new Set(selectedIDs);

        for (const torrent of visibleTorrents.slice(startIndex, endIndex + 1)) {
          nextIDs.add(torrent['id']);
        }

        setSelectedIDs([...nextIDs]);
        setLastSelectedID(identifier);

        return;
      }
    }

    setSelectedIDs((currentIDs) => (
      (currentIDs.includes(identifier) === true) ? currentIDs.filter((currentID) => currentID !== identifier) : [
        ...currentIDs,
        identifier,
      ]
    ));
    setLastSelectedID(identifier);

    return;
  };

  /**
   * Torrent Workspace - Perform Action.
   *
   * Stores this module-level value in one named location.
   * Related code reuses it instead of duplicating the definition.
   *
   * @param {Web_TorrentWorkspace_TorrentWorkspace_PerformAction_Action}      action      - Action.
   * @param {Web_TorrentWorkspace_TorrentWorkspace_PerformAction_Identifiers} identifiers - Identifiers.
   *
   * @returns {Web_TorrentWorkspace_TorrentWorkspace_PerformAction_Returns}
   *
   * @since 2.0.0
   */
  const performAction: Web_TorrentWorkspace_TorrentWorkspace_PerformAction = async (
    action: Web_TorrentWorkspace_TorrentWorkspace_PerformAction_Action,
    identifiers: Web_TorrentWorkspace_TorrentWorkspace_PerformAction_Identifiers,
  ): Web_TorrentWorkspace_TorrentWorkspace_PerformAction_Returns => {
    if (identifiers.length === 0) {
      return;
    }

    const hashes: Web_TorrentWorkspace_TorrentWorkspace_PerformAction_Hashes = hashesForTorrentIdentifiers(torrents, identifiers);

    if (hashes.length === 0) {
      return;
    }

    setBusy(true);

    try {
      await onAction(action, hashes);
      setContextMenu(null);
    } catch (caughtError) {
      showToast((caughtError instanceof Error) ? caughtError.message : 'That action didn\'t go through. Try again.', false);
    } finally {
      setBusy(false);
    }

    return;
  };

  /**
   * Torrent Workspace - Download Torrent Files For.
   *
   * Saves one torrent's .torrent file, or a zip for several. A toast says when
   * torrents still fetching their metadata were left out.
   *
   * @param {Web_TorrentWorkspace_TorrentWorkspace_DownloadTorrentFilesFor_Identifiers} identifiers - Identifiers.
   *
   * @returns {Web_TorrentWorkspace_TorrentWorkspace_DownloadTorrentFilesFor_Returns}
   *
   * @since 2.2.0
   */
  const downloadTorrentFilesFor: Web_TorrentWorkspace_TorrentWorkspace_DownloadTorrentFilesFor = async (identifiers: Web_TorrentWorkspace_TorrentWorkspace_DownloadTorrentFilesFor_Identifiers): Web_TorrentWorkspace_TorrentWorkspace_DownloadTorrentFilesFor_Returns => {
    const hashes: Web_TorrentWorkspace_TorrentWorkspace_DownloadTorrentFilesFor_Hashes = hashesForTorrentIdentifiers(torrents, identifiers);

    if (hashes.length === 0) {
      return;
    }

    setBusy(true);

    try {
      const skipped: Web_TorrentWorkspace_TorrentWorkspace_DownloadTorrentFilesFor_Skipped = await downloadTorrentFiles(hashes);

      setContextMenu(null);
      if (skipped > 0) {
        const torrentPhrase: Web_TorrentWorkspace_TorrentWorkspace_DownloadTorrentFilesFor_TorrentPhrase = (skipped === 1) ? 'torrent has' : 'torrents have';
        const pronounPhrase: Web_TorrentWorkspace_TorrentWorkspace_DownloadTorrentFilesFor_PronounPhrase = (skipped === 1) ? 'it was' : 'they were';

        showToast(`${skipped} ${torrentPhrase} no .torrent file yet, so ${pronounPhrase} left out.`, true);
      }
    } catch (caughtError) {
      showToast((caughtError instanceof Error) ? caughtError.message : 'The torrent files couldn\'t be downloaded.', false);
    } finally {
      setBusy(false);
    }

    return;
  };

  /**
   * Torrent Workspace - Download Finished Files For.
   *
   * Downloads a finished torrent's file, or a zip of its files, and one zip for several
   * torrents. A toast says which selected torrents were left out and why.
   *
   * @param {Web_TorrentWorkspace_TorrentWorkspace_DownloadFinishedFilesFor_Identifiers} identifiers - Identifiers.
   *
   * @returns {Web_TorrentWorkspace_TorrentWorkspace_DownloadFinishedFilesFor_Returns}
   *
   * @since 2.2.0
   */
  const downloadFinishedFilesFor: Web_TorrentWorkspace_TorrentWorkspace_DownloadFinishedFilesFor = async (identifiers: Web_TorrentWorkspace_TorrentWorkspace_DownloadFinishedFilesFor_Identifiers): Web_TorrentWorkspace_TorrentWorkspace_DownloadFinishedFilesFor_Returns => {
    const hashes: Web_TorrentWorkspace_TorrentWorkspace_DownloadFinishedFilesFor_Hashes = hashesForTorrentIdentifiers(torrents, identifiers);

    if (hashes.length === 0) {
      return;
    }

    setBusy(true);

    try {
      const prepared: Web_TorrentWorkspace_TorrentWorkspace_DownloadFinishedFilesFor_Prepared = await downloadFinishedFiles(hashes);

      setContextMenu(null);

      const leftOut: Web_TorrentWorkspace_TorrentWorkspace_DownloadFinishedFilesFor_LeftOut = finishedFilesLeftOut(prepared['unfinished'], prepared['unavailable']);

      if (leftOut !== '') {
        showToast(leftOut, true);
      }
    } catch (caughtError) {
      showToast((caughtError instanceof Error) ? caughtError.message : 'The files couldn\'t be downloaded.', false);
    } finally {
      setBusy(false);
    }

    return;
  };

  /**
   * Torrent Workspace - Remove Selected.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @returns {Web_TorrentWorkspace_TorrentWorkspace_RemoveSelected_Returns}
   *
   * @since 2.0.0
   */
  const removeSelected: Web_TorrentWorkspace_TorrentWorkspace_RemoveSelected = async (): Web_TorrentWorkspace_TorrentWorkspace_RemoveSelected_Returns => {
    setBusy(true);

    try {
      await onRemove(hashesForTorrentIdentifiers(torrents, selectedIDs), deleteLocalData);
      setSelectedIDs([]);
      setRemoveOpen(false);
      setDeleteLocalData(false);
    } catch (caughtError) {
      showToast((caughtError instanceof Error) ? caughtError.message : 'The torrents couldn\'t be removed.', false);
    } finally {
      setBusy(false);
    }

    return;
  };

  // Opens the action menu next to a point, flipping above it when there is no room below.

  /**
   * Torrent Workspace - Open Menu At.
   *
   * Stores this module-level value in one named location.
   * Related code reuses it instead of duplicating the definition.
   *
   * @param {Web_TorrentWorkspace_TorrentWorkspace_OpenMenuAt_X}          x          - X.
   * @param {Web_TorrentWorkspace_TorrentWorkspace_OpenMenuAt_Y}          y          - Y.
   * @param {Web_TorrentWorkspace_TorrentWorkspace_OpenMenuAt_TorrentIds} torrentIds - Torrent ids.
   *
   * @returns {Web_TorrentWorkspace_TorrentWorkspace_OpenMenuAt_Returns}
   *
   * @since 2.0.0
   */
  const openMenuAt: Web_TorrentWorkspace_TorrentWorkspace_OpenMenuAt = (
    x: Web_TorrentWorkspace_TorrentWorkspace_OpenMenuAt_X,
    y: Web_TorrentWorkspace_TorrentWorkspace_OpenMenuAt_Y,
    torrentIds: Web_TorrentWorkspace_TorrentWorkspace_OpenMenuAt_TorrentIds,
  ): Web_TorrentWorkspace_TorrentWorkspace_OpenMenuAt_Returns => {
    const menuHeight: Web_TorrentWorkspace_TorrentWorkspace_OpenMenuAt_MenuHeight = 340;
    const menuWidth: Web_TorrentWorkspace_TorrentWorkspace_OpenMenuAt_MenuWidth = 220;

    setContextMenu({
      torrentIds,
      x: Math.min(x, window.innerWidth - menuWidth - 8),
      y: (y + menuHeight > window.innerHeight) ? Math.max(8, y - menuHeight) : y,
    });

    return;
  };

  /**
   * Torrent Workspace - Open Row Menu.
   *
   * Stores this module-level value in one named location.
   * Related code reuses it instead of duplicating the definition.
   *
   * @param {Web_TorrentWorkspace_TorrentWorkspace_OpenRowMenu_Event}   event   - Event.
   * @param {Web_TorrentWorkspace_TorrentWorkspace_OpenRowMenu_Torrent} torrent - Torrent.
   *
   * @returns {Web_TorrentWorkspace_TorrentWorkspace_OpenRowMenu_Returns}
   *
   * @since 2.0.0
   */
  const openRowMenu: Web_TorrentWorkspace_TorrentWorkspace_OpenRowMenu = (
    event: Web_TorrentWorkspace_TorrentWorkspace_OpenRowMenu_Event,
    torrent: Web_TorrentWorkspace_TorrentWorkspace_OpenRowMenu_Torrent,
  ): Web_TorrentWorkspace_TorrentWorkspace_OpenRowMenu_Returns => {
    event.preventDefault();

    event.stopPropagation();

    const torrentIds: Web_TorrentWorkspace_TorrentWorkspace_OpenRowMenu_TorrentIds = (selectedIDs.includes(torrent['id']) === true) ? selectedIDs : [torrent['id']];

    openMenuAt(event.clientX, event.clientY, torrentIds);

    return;
  };

  /**
   * Torrent Workspace - Open Button Menu.
   *
   * Stores this module-level value in one named location.
   * Related code reuses it instead of duplicating the definition.
   *
   * @param {Web_TorrentWorkspace_TorrentWorkspace_OpenButtonMenu_Event}      event      - Event.
   * @param {Web_TorrentWorkspace_TorrentWorkspace_OpenButtonMenu_TorrentIds} torrentIds - Torrent ids.
   *
   * @returns {Web_TorrentWorkspace_TorrentWorkspace_OpenButtonMenu_Returns}
   *
   * @since 2.0.0
   */
  const openButtonMenu: Web_TorrentWorkspace_TorrentWorkspace_OpenButtonMenu = (
    event: Web_TorrentWorkspace_TorrentWorkspace_OpenButtonMenu_Event,
    torrentIds: Web_TorrentWorkspace_TorrentWorkspace_OpenButtonMenu_TorrentIds,
  ): Web_TorrentWorkspace_TorrentWorkspace_OpenButtonMenu_Returns => {
    event.stopPropagation();

    const bounds: Web_TorrentWorkspace_TorrentWorkspace_OpenButtonMenu_Bounds = event.currentTarget.getBoundingClientRect();

    openMenuAt(bounds.right - 220, bounds.bottom + 4, torrentIds);

    return;
  };

  /**
   * Torrent Workspace - Clear Filters.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @returns {Web_TorrentWorkspace_TorrentWorkspace_ClearFilters_Returns}
   *
   * @since 2.0.0
   */
  const clearFilters: Web_TorrentWorkspace_TorrentWorkspace_ClearFilters = (): Web_TorrentWorkspace_TorrentWorkspace_ClearFilters_Returns => {
    onFiltersChange({
      connection: '',
      label: '',
      profile: '',
      status: 'all',
    });
    setQuery('');

    return;
  };

  const connectionTorrentNoun: Web_TorrentWorkspace_TorrentWorkspace_ConnectionTorrentNoun = (connectionTorrents.length === 1) ? 'torrent' : 'torrents';
  const needsProfileNoun: Web_TorrentWorkspace_TorrentWorkspace_NeedsProfileNoun = (needsProfileCount === 1) ? 'torrent matches' : 'torrents match';
  const removeTorrentNoun: Web_TorrentWorkspace_TorrentWorkspace_RemoveTorrentNoun = (selectedIDs.length === 1) ? 'torrent' : 'torrents';

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Torrents</h1>
          <p>
            {(connectionFilter === '')
              ? `${connectionTorrents.length} total · ${downloadingCount} downloading · ${seedingCount} seeding`
              : `${connectionTorrents.length} ${connectionTorrentNoun} on ${connectionFilterLabel} · ${downloadingCount} downloading · ${seedingCount} seeding`}
          </p>
        </div>
        <div className="page-header-actions">
          <div aria-label="Current transfer rates" className="rates" role="group">
            <span title="Download rate">
              <Icon name="arrow-down" size={16} />
              {formatRate((statistics === undefined) ? 0 : statistics['downloadSpeed'])}
            </span>
            <span title="Upload rate">
              <Icon name="arrow-up" size={16} />
              {formatRate((statistics === undefined) ? 0 : statistics['uploadSpeed'])}
            </span>
          </div>
          <Button icon="add" onClick={onAddTorrent} variant="primary">Add torrent</Button>
        </div>
      </header>

      {(profileFolderOverlaps.length === 0) ? null : (
        <div className="torrent-folder-overlap-banner" role="alert">
          <p>
            <strong>Profile folders overlap.</strong>
            {' New torrents can’t be added to these profiles until each one has its own folder.'}
          </p>
          <ul>
            {profileFolderOverlaps.map((overlap) => (
              <li key={overlap['profileId']}>
                <span>
                  <strong>{(overlap['profileId'] === 'default') ? overlap['profileName'] : `${overlap['profileName']} profile`}</strong>
                  {` — ${overlap['message']}`}
                </span>
                <Button onClick={() => onFixProfileFolder(overlap['profileId'])}>Change folder</Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(needsProfileCount === 0) ? null : (
        <div className="torrent-profile-choice-banner" role="status">
          <span>{`${needsProfileCount} ${needsProfileNoun} more than one profile.`}</span>
          <Button
            onClick={() => {
              onFiltersChange({
                connection: '',
                label: '',
                profile: '',
                status: 'needs-profile',
              });
              setQuery('');

              return;
            }}
          >
            Resolve
          </Button>
        </div>
      )}

      {duplicateNotices.map((notice) => (
        <p className="torrent-duplicate-notice" key={notice} role="status">{notice}</p>
      ))}

      <div className="filter-bar">
        <div className="filter-controls">
          <label className="search-field">
            <Icon name="search" size={16} />
            <span className="visually-hidden">Search torrents</span>
            <input
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search"
              type="search"
              value={query}
            />
          </label>
          <button
            aria-controls={PHONE_NAV_SHEET_ID}
            aria-expanded={filtersOpen}
            aria-haspopup="dialog"
            className="torrent-filters-button"
            onClick={onOpenFilters}
            type="button"
          >
            <Icon name="sliders-horizontal" size={16} />
            <span>Filters</span>
            {(activeFilterCount === 0) ? null : (
              <span
                aria-label={activeFilterLabel}
                className="torrent-filters-count"
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {(
        connectionFilter === ''
        && statusFilter === 'all'
        && labelFilter === ''
        && profileFilter === ''
      ) ? null : (
          <div aria-label="Active filters" className="active-filters" role="group">
            <span>Showing</span>
            {(connectionFilter === '') ? null : (
              <button className="filter-pill filter-pill-vpn" onClick={() => setConnectionFilter('')} type="button">
                <Icon name="shield" size={13} />
                {`VPN: ${connectionFilterLabel}`}
                <Icon name="x" size={12} />
              </button>
            )}
            {(statusFilter === 'all') ? null : (
              <button className="filter-pill" onClick={() => setStatusFilter('all')} type="button">
                {statusFilterLabel}
                <Icon name="x" size={12} />
              </button>
            )}
            {(labelFilter === '') ? null : (
              <button className="filter-pill" onClick={() => setLabelFilter('')} type="button">
                <Icon name="label" size={13} />
                {labelFilter}
                <Icon name="x" size={12} />
              </button>
            )}
            {(profileFilter === '') ? null : (
              <button className="filter-pill" onClick={() => setProfileFilter('')} type="button">
                <Icon name="settings" size={13} />
                {profileFilterLabel}
                <Icon name="x" size={12} />
              </button>
            )}
            <button className="filter-clear" onClick={clearFilters} type="button">Clear all</button>
          </div>
        )}

      <div className="table-card">
        {(visibleTorrents.length === 0) ? (
          <div className="empty-state">
            <span><Icon name={(torrents.length === 0) ? 'torrent' : 'search'} size={22} /></span>
            <h2>{(torrents.length === 0) ? 'No torrents yet' : 'Nothing matches these filters'}</h2>
            <p>
              {(torrents.length === 0)
                ? 'Add a magnet link, a torrent URL, or a .torrent file to get started.'
                : 'Try a different status, profile, label, or search.'}
            </p>
            {(torrents.length === 0) ? (
              <Button icon="add" onClick={onAddTorrent} variant="primary">Add torrent</Button>
            ) : null}
            {(torrents.length > 0 && filtersActive === true) ? (
              <Button onClick={clearFilters}>Clear filters</Button>
            ) : null}
          </div>
        ) : (
          <table className="torrent-list">
            <thead>
              <tr>
                <th className="cell-select">
                  <input
                    aria-label="Select all torrents on this page"
                    checked={everyVisibleSelected}
                    onChange={toggleVisible}
                    type="checkbox"
                  />
                </th>
                {(showQueuePosition === true) ? <th className="cell-queue"><SortHeader activeSort={effectiveSort} label="#" onSort={toggleSort} sortKey="queuePosition" /></th> : null}
                <th className="cell-name"><SortHeader activeSort={effectiveSort} label="Name" onSort={toggleSort} sortKey="name" /></th>
                <th><SortHeader activeSort={effectiveSort} label="Progress" onSort={toggleSort} sortKey="percentDone" /></th>
                <th className="numeric column-secondary"><SortHeader activeSort={effectiveSort} label="Size" onSort={toggleSort} sortKey="sizeWhenDone" /></th>
                <th className="numeric"><SortHeader activeSort={effectiveSort} label="Down" onSort={toggleSort} sortKey="rateDownload" /></th>
                <th className="numeric"><SortHeader activeSort={effectiveSort} label="Up" onSort={toggleSort} sortKey="rateUpload" /></th>
                <th className="numeric column-secondary"><SortHeader activeSort={effectiveSort} label="ETA" onSort={toggleSort} sortKey="eta" /></th>
                <th className="numeric column-secondary"><SortHeader activeSort={effectiveSort} label="Ratio" onSort={toggleSort} sortKey="uploadRatio" /></th>
                <th className="cell-actions"><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {visibleTorrents.map((torrent) => {
                const selected: Web_TorrentWorkspace_TorrentWorkspace_Selected = selectedIDs.includes(torrent['id']);
                const state: Web_TorrentWorkspace_TorrentWorkspace_State = describeTorrentState(torrent);
                const trackerIssue: Web_TorrentWorkspace_TorrentWorkspace_TrackerIssue = describeTrackerIssue(torrent);
                const connection: Web_TorrentWorkspace_TorrentWorkspace_Connection = connections.find((candidate) => candidate['id'] === torrent['connectionId']);
                const downloading: Web_TorrentWorkspace_TorrentWorkspace_Downloading = state['tone'] === 'downloading';
                const peerCount: Web_TorrentWorkspace_TorrentWorkspace_PeerCount = torrent['peersConnected'];
                const peerNoun: Web_TorrentWorkspace_TorrentWorkspace_PeerNoun = (peerCount === 1) ? 'peer' : 'peers';

                /**
                 * Torrent Workspace - Open Details.
                 *
                 * Centralizes this operation for the surrounding workflow.
                 * Callers reuse one implementation instead of repeating the behavior.
                 *
                 * @returns {Web_TorrentWorkspace_TorrentWorkspace_OpenDetails_Returns}
                 *
                 * @since 2.0.0
                 */
                const openDetails: Web_TorrentWorkspace_TorrentWorkspace_OpenDetails = (): Web_TorrentWorkspace_TorrentWorkspace_OpenDetails_Returns => onSelectTorrent(torrent);

                /**
                 * Torrent Workspace - Handle Key Down.
                 *
                 * Centralizes this operation for the surrounding workflow.
                 * Callers reuse one implementation instead of repeating the behavior.
                 *
                 * @param {Web_TorrentWorkspace_TorrentWorkspace_HandleKeyDown_Event} event - Event.
                 *
                 * @returns {Web_TorrentWorkspace_TorrentWorkspace_HandleKeyDown_Returns}
                 *
                 * @since 2.0.0
                 */
                const handleKeyDown: Web_TorrentWorkspace_TorrentWorkspace_HandleKeyDown = (event: Web_TorrentWorkspace_TorrentWorkspace_HandleKeyDown_Event): Web_TorrentWorkspace_TorrentWorkspace_HandleKeyDown_Returns => {
                  if (event.key === 'Enter') {
                    event.preventDefault();

                    openDetails();
                  }

                  return;
                };

                return (
                  <tr
                    aria-selected={selected || selectedTorrentId === torrent['id']}
                    className="torrent-list-row"
                    key={torrent['id']}
                    onClick={openDetails}
                    onContextMenu={(event) => openRowMenu(event, torrent)}
                    onKeyDown={handleKeyDown}
                    tabIndex={0}
                  >
                    <td className="cell-select">
                      <input
                        aria-label={`Select ${torrent['name']}`}
                        checked={selected}
                        onClick={(event) => {
                          event.stopPropagation();

                          toggleTorrent(torrent['id'], event.shiftKey);

                          return;
                        }}
                        readOnly
                        type="checkbox"
                      />
                    </td>
                    {(showQueuePosition === true) ? <td className="cell-queue">{torrent['queuePosition'] + 1}</td> : null}
                    <td className="cell-name">
                      <div className="torrent-name" title={torrent['name']}>{torrent['name']}</div>
                      <div className={(state['tone'] === 'error') ? 'torrent-meta torrent-meta-error' : 'torrent-meta'}>
                        <span className={`status-dot status-${state['tone']}`} />
                        <span className="torrent-state">{state['label']}</span>
                        {(peerCount > 0) ? <span>{`· ${peerCount} ${peerNoun}`}</span> : null}
                        {(trackerIssue === null) ? null : <span className="torrent-tracker-issue" title={trackerIssue['reply']}>{trackerIssue['label']}</span>}
                        {(torrent['needsProfile'] === null) ? null : <span className="tag tag-warning">Needs a profile</span>}
                        {(torrent['isStalled'] === true) ? <span className="tag tag-warning">Stalled</span> : null}
                        {(torrent['isPrivate'] === true) ? <span className="tag">Private</span> : null}
                        {(connection === undefined) ? null : (
                          <span className="tag tag-vpn">
                            <Icon name="shield" size={11} />
                            {connection['name']}
                          </span>
                        )}
                        {torrent['labels'].slice(0, 3).map((label) => (
                          <span className="tag" key={label}>{label}</span>
                        ))}
                      </div>
                      <div className={`progress progress-inline status-${state['tone']}`}>
                        <span style={{ width: formatPercent(torrentProgress(torrent)) }} />
                      </div>
                    </td>
                    <td className={`cell-progress status-${state['tone']}`}>
                      <span>{formatPercent(torrentProgress(torrent))}</span>
                      <div className="progress">
                        <span style={{ width: formatPercent(torrentProgress(torrent)) }} />
                      </div>
                    </td>
                    <td className="numeric column-secondary">{formatBytes(torrent['sizeWhenDone'])}</td>
                    <td className={(torrent['rateDownload'] > 0) ? 'numeric cell-rate-active' : 'numeric cell-muted'}>
                      {(torrent['rateDownload'] > 0) ? formatRate(torrent['rateDownload']) : '—'}
                    </td>
                    <td className={(torrent['rateUpload'] > 0) ? 'numeric cell-rate-active' : 'numeric cell-muted'}>
                      {(torrent['rateUpload'] > 0) ? formatRate(torrent['rateUpload']) : '—'}
                    </td>
                    <td className={(downloading === true && torrent['eta'] >= 0) ? 'numeric column-secondary' : 'numeric column-secondary cell-muted'}>
                      {(downloading === true && torrent['eta'] >= 0) ? formatDuration(torrent['eta']) : '—'}
                    </td>
                    <td className="numeric column-secondary">{formatRatio(torrent['uploadRatio'])}</td>
                    <td className="cell-actions">
                      <button
                        aria-expanded={contextMenu !== null && contextMenu['torrentIds'].includes(torrent['id'])}
                        aria-haspopup="menu"
                        aria-label={`Actions for ${torrent['name']}`}
                        className="icon-button"
                        onClick={(event) => openButtonMenu(event, (selected === true) ? selectedIDs : [torrent['id']])}
                        type="button"
                      >
                        <Icon name="more" size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <footer className="table-footer">
          <div className="session-stats">
            <span>
              {'This session '}
              <strong>{`↓ ${formatBytes((currentStatistics === undefined) ? 0 : currentStatistics['downloadedBytes'])}`}</strong>
              {' '}
              <strong>{`↑ ${formatBytes((currentStatistics === undefined) ? 0 : currentStatistics['uploadedBytes'])}`}</strong>
            </span>
            <span>
              {'All time '}
              <strong>{`↓ ${formatBytes((cumulativeStatistics === undefined) ? 0 : cumulativeStatistics['downloadedBytes'])}`}</strong>
              {' '}
              <strong>{`↑ ${formatBytes((cumulativeStatistics === undefined) ? 0 : cumulativeStatistics['uploadedBytes'])}`}</strong>
            </span>
          </div>
          {(sortedTorrents.length === 0) ? null : (
            <div className="pagination">
              <span>{`${firstVisibleIndex + 1}–${Math.min(firstVisibleIndex + pageSize, sortedTorrents.length)} of ${sortedTorrents.length}`}</span>
              <select
                aria-label="Rows per page"
                className="select-control"
                onChange={(event) => setPageSize(Number(event.currentTarget.value) as Web_TorrentWorkspace_TorrentWorkspace_PageSize)}
                value={pageSize}
              >
                <option value="25">25 rows</option>
                <option value="50">50 rows</option>
                <option value="100">100 rows</option>
              </select>
              <button aria-label="Previous page" className="icon-button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} type="button">
                <span style={{ transform: 'rotate(180deg)' }}><Icon name="chevron" size={16} /></span>
              </button>
              <button aria-label="Next page" className="icon-button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)} type="button">
                <Icon name="chevron" size={16} />
              </button>
            </div>
          )}
        </footer>
      </div>

      {(selectedIDs.length === 0) ? null : (
        <div aria-label="Selected torrents" className="selection-bar" role="toolbar">
          <strong>{`${selectedIDs.length} selected`}</strong>
          <Button
            disabled={busy}
            icon="play"
            onClick={() => {
              void performAction('start', selectedIDs);

              return;
            }}
          >
            Start
          </Button>
          <Button
            disabled={busy}
            icon="pause"
            onClick={() => {
              void performAction('stop', selectedIDs);

              return;
            }}
          >
            Pause
          </Button>
          <Button disabled={busy} icon="settings" onClick={() => setProfileChangeOpen(true)}>Change profile</Button>
          <Button disabled={busy} icon="remove" onClick={() => setRemoveOpen(true)}>Remove</Button>
          <button
            aria-haspopup="menu"
            aria-label="More actions"
            className="icon-button"
            onClick={(event) => openButtonMenu(event, selectedIDs)}
            type="button"
          >
            <Icon name="more" size={18} />
          </button>
          <span className="selection-bar-divider" />
          <button
            aria-label="Clear selection"
            className="icon-button"
            onClick={() => setSelectedIDs([])}
            type="button"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      {(contextMenu === null) ? null : (
        <div
          className="menu context-menu"
          ref={contextMenuRef}
          role="menu"
          style={{
            left: contextMenu['x'],
            top: contextMenu['y'],
          }}
        >
          <button
            onClick={() => {
              void performAction('start', contextMenu['torrentIds']);

              return;
            }}
            role="menuitem"
            type="button"
          >
            <Icon name="play" size={16} />
            Start
          </button>
          <button
            onClick={() => {
              void performAction('start-now', contextMenu['torrentIds']);

              return;
            }}
            role="menuitem"
            type="button"
          >
            <Icon name="play" size={16} />
            Start now, skip the queue
          </button>
          <button
            onClick={() => {
              void performAction('stop', contextMenu['torrentIds']);

              return;
            }}
            role="menuitem"
            type="button"
          >
            <Icon name="pause" size={16} />
            Pause
          </button>
          <hr />
          <button
            onClick={() => {
              void performAction('verify', contextMenu['torrentIds']);

              return;
            }}
            role="menuitem"
            type="button"
          >
            <Icon name="check" size={16} />
            Verify local data
          </button>
          <button
            onClick={() => {
              void performAction('reannounce', contextMenu['torrentIds']);

              return;
            }}
            role="menuitem"
            type="button"
          >
            <Icon name="refresh" size={16} />
            Ask trackers for more peers
          </button>
          <button
            disabled={busy || contextMenuTorrentFileCount === 0}
            onClick={() => {
              void downloadTorrentFilesFor(contextMenu['torrentIds']);

              return;
            }}
            role="menuitem"
            title={(contextMenuTorrentFileCount === 0) ? 'Available once Transmission has the torrent\'s metadata' : undefined}
            type="button"
          >
            <Icon name="download" size={16} />
            {(contextMenu['torrentIds'].length === 1) ? 'Download torrent file' : 'Download torrent files'}
          </button>
          {(contextMenuFinishedCount === 0) ? null : (
            <button
              disabled={busy}
              onClick={() => {
                void downloadFinishedFilesFor(contextMenu['torrentIds']);

                return;
              }}
              role="menuitem"
              type="button"
            >
              <Icon name="download" size={16} />
              Download finished files
            </button>
          )}
          <hr />
          <button
            onClick={() => {
              void performAction('queue-top', contextMenu['torrentIds']);

              return;
            }}
            role="menuitem"
            type="button"
          >
            <Icon name="arrow-up" size={16} />
            Move to top of queue
          </button>
          <button
            onClick={() => {
              void performAction('queue-up', contextMenu['torrentIds']);

              return;
            }}
            role="menuitem"
            type="button"
          >
            <Icon name="chevron-up" size={16} />
            Move up one
          </button>
          <button
            onClick={() => {
              void performAction('queue-down', contextMenu['torrentIds']);

              return;
            }}
            role="menuitem"
            type="button"
          >
            <Icon name="chevron-down" size={16} />
            Move down one
          </button>
          <button
            onClick={() => {
              void performAction('queue-bottom', contextMenu['torrentIds']);

              return;
            }}
            role="menuitem"
            type="button"
          >
            <Icon name="arrow-down" size={16} />
            Move to bottom of queue
          </button>
          <hr />
          <button
            className="menu-danger"
            onClick={() => {
              setSelectedIDs(contextMenu['torrentIds']);
              setContextMenu(null);
              setRemoveOpen(true);

              return;
            }}
            role="menuitem"
            type="button"
          >
            <Icon name="remove" size={16} />
            Remove…
          </button>
        </div>
      )}

      {(removeOpen === true) ? (
        <div className="dialog-backdrop" role="presentation">
          <section aria-labelledby="remove-title" aria-modal="true" className="dialog dialog-small" role="dialog">
            <div className="dialog-heading">
              <h2 id="remove-title">{`Remove ${selectedIDs.length} ${removeTorrentNoun}?`}</h2>
              <button aria-label="Close" className="icon-button" onClick={() => setRemoveOpen(false)} type="button"><Icon name="x" /></button>
            </div>
            <p>{'They\'ll be removed from the list. Downloaded files stay on disk unless you choose to delete them.'}</p>
            <label aria-label="Also delete the downloaded files" className="check-row check-row-danger">
              <input
                checked={deleteLocalData}
                onChange={(event) => setDeleteLocalData(event.currentTarget.checked)}
                type="checkbox"
              />
              <span>
                <strong>Also delete the downloaded files</strong>
                <small>{'This can\'t be undone.'}</small>
              </span>
            </label>
            <div className="dialog-actions">
              <Button onClick={() => setRemoveOpen(false)}>Cancel</Button>
              <Button
                disabled={busy}
                onClick={() => {
                  void removeSelected();

                  return;
                }}
                variant="danger"
              >
                {(deleteLocalData === true) ? 'Remove and delete files' : 'Remove'}
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      {(profileChangeOpen === true) ? (
        <TorrentProfileChangeDialog
          connections={connections}
          defaultProfile={defaultProfile}
          hashes={hashesForTorrentIdentifiers(torrents, selectedIDs)}
          onClose={() => setProfileChangeOpen(false)}
          onSetProfile={onSetProfile}
          profiles={profiles}
          torrents={torrents}
        />
      ) : null}

    </section>
  );
};
