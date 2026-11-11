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
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  MouseEvent,
  ReactElement,
} from 'react';

import type {
  Web_Api_DefaultTorrentProfile,
  Web_Api_MovedTorrent,
  Web_Api_Statistics,
  Web_Api_StatisticsPeriod,
  Web_Api_Torrent,
  Web_Api_TorrentAction,
  Web_Api_TorrentContentsDownload,
  Web_Api_TorrentProfile,
  Web_Api_TorrentProfileFolderOverlap,
} from '@/types/web/api.d.ts';
import type {
  Web_Components_TorrentContextMenu,
  Web_Components_TorrentFilter,
  Web_Components_TorrentFilterItem,
  Web_Components_TorrentPageSize,
  Web_Components_TorrentProfileChangeDialog_Props,
  Web_Components_TorrentSort,
  Web_Components_TorrentSortHeader_Props,
  Web_Components_TorrentSortKey,
  Web_Components_TorrentState,
  Web_Components_TorrentWorkspace_Props,
  Web_Components_TrackerIssue,
} from '@/types/web/components.d.ts';

/**
 * Torrent Workspace - Compare torrents.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const compareTorrents = (
  leftTorrent: Web_Api_Torrent,
  rightTorrent: Web_Api_Torrent,
  sort: Web_Components_TorrentSort,
): number => {
  const leftValue: number | string = leftTorrent[sort['key']];
  const rightValue: number | string = rightTorrent[sort['key']];
  const direction: number = (sort['direction'] === 'ascending') ? 1 : -1;

  if (typeof leftValue === 'string' && typeof rightValue === 'string') {
    return leftValue.localeCompare(rightValue, undefined, { sensitivity: 'base' }) * direction;
  }

  if (typeof leftValue === 'number' && typeof rightValue === 'number') {
    return (leftValue - rightValue) * direction;
  }

  return 0;
};

/**
 * Torrent Workspace - Hashes for torrent identifiers.
 *
 * Converts facade identifiers used by row selection into stable hashes only at
 * the mutation boundary. Duplicate hashes collapse to one backend selection.
 *
 * @since 2.0.0
 */
const hashesForTorrentIdentifiers = (
  torrents: Web_Api_Torrent[],
  identifiers: number[],
): string[] => [...new Set(identifiers.map(
  (identifier: number): string | undefined => torrents.find(
    (torrent: Web_Api_Torrent): boolean => torrent['id'] === identifier,
  )?.['hashString'],
).filter((hash: string | undefined): hash is string => hash !== undefined))];

/**
 * Torrent Workspace - Sort header.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const SortHeader = ({
  activeSort,
  label,
  onSort,
  sortKey,
}: Web_Components_TorrentSortHeader_Props): ReactElement => {
  const active: boolean = activeSort['key'] === sortKey;
  const ascending: boolean = active && activeSort['direction'] === 'ascending';
  const classNames: string[] = ['sort-header'];

  if (active) {
    classNames.push('sort-header-active');
  }

  if (ascending) {
    classNames.push('sort-header-ascending');
  }

  return (
    <button className={classNames.join(' ')} onClick={(): void => onSort(sortKey)} type="button">
      {label}
      <Icon name="chevron-down" size={14} />
    </button>
  );
};

/**
 * Torrent Workspace - Statistic period.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const statisticPeriod = (
  statistics: Web_Api_Statistics | undefined,
  key: 'current-stats' | 'cumulative-stats',
): Web_Api_StatisticsPeriod | undefined => {
  if (statistics === undefined) {
    return undefined;
  }

  return statistics[key];
};

/**
 * Torrent Workspace - Torrent profile change dialog.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const TorrentProfileChangeDialog = ({
  connections,
  defaultProfile,
  hashes,
  onClose,
  onSetProfile,
  profiles,
  torrents,
}: Web_Components_TorrentProfileChangeDialog_Props): ReactElement => {
  useEscapeKey(onClose, true);

  const [
    profileID,
    setProfileID,
  ] = useState<string>('');
  const [
    applyOptions,
    setApplyOptions,
  ] = useState<boolean>(false);
  const [
    results,
    setResults,
  ] = useState<Web_Api_MovedTorrent[] | null>(null);
  const [
    busy,
    setBusy,
  ] = useState<boolean>(false);
  const [
    error,
    setError,
  ] = useState<string>('');

  /**
   * Torrent Workspace - Submit.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const response = await onSetProfile({
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
  };

  const selectedProfile: Web_Api_TorrentProfile | undefined = profiles.find(
    (profile: Web_Api_TorrentProfile): boolean => profile['id'] === profileID,
  );
  const selectedProfileData: Web_Api_DefaultTorrentProfile | Web_Api_TorrentProfile = selectedProfile ?? defaultProfile;
  const defaultConnection = connections.find((connection): boolean => connection['default']);
  const targetConnectionID: string | undefined = (
    !('connectionId' in selectedProfileData) || selectedProfileData['connectionId'] === null
  ) ? defaultConnection?.['id'] : selectedProfileData['connectionId'];
  const selectedHashes: Set<string> = new Set(hashes);
  const selectedTorrents: Web_Api_Torrent[] = torrents.filter(
    (torrent: Web_Api_Torrent): boolean => selectedHashes.has(torrent['hashString']),
  );
  const moveCount: number = selectedTorrents.filter((torrent: Web_Api_Torrent): boolean => (
    torrent['downloadDir'] !== selectedProfileData['downloadDirectory']
    || torrent['connectionId'] !== targetConnectionID
  )).length;
  const torrentNoun: string = (hashes.length === 1) ? 'torrent' : 'torrents';

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
              <select onChange={(event): void => setProfileID(event.currentTarget.value)} value={profileID}>
                <option value="">{defaultProfile['name']}</option>
                {profiles.map((profile: Web_Api_TorrentProfile): ReactElement => (
                  <option key={profile['id']} value={profile['id']}>{profile['name']}</option>
                ))}
              </select>
            </label>
            <p>{`${moveCount} of ${selectedTorrents.length} selected ${(selectedTorrents.length === 1) ? 'torrent' : 'torrents'} will move folder or VPN.`}</p>
            <label aria-label="Also apply its labels and limits" className="check-row">
              <input checked={applyOptions} onChange={(event): void => setApplyOptions(event.currentTarget.checked)} type="checkbox" />
              <span>
                <strong>Also apply its labels and limits</strong>
                <small>Copies the profile settings to the selected torrents now.</small>
              </span>
            </label>
            {(error === '') ? null : <div className="form-error" role="alert">{error}</div>}
            <div className="dialog-actions">
              <Button onClick={onClose}>Cancel</Button>
              <Button disabled={busy} type="submit" variant="primary">{(busy) ? 'Applying…' : 'Apply'}</Button>
            </div>
          </form>
        ) : (
          <>
            <div className="torrent-move-results">
              <ul>
                {results.map((result: Web_Api_MovedTorrent): ReactElement => (
                  <li className={(result['result'] === 'failed') ? 'move-failed' : 'move-succeeded'} key={result['hash']}>
                    <strong>{result['name']}</strong>
                    <span className="move-result-copy">
                      <span className="move-result-state">{torrentMoveResultLabel(result)}</span>
                      {result['warnings']?.map((warning: string): ReactElement => <small key={warning}>{warning}</small>)}
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
 * Torrent Workspace.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const TorrentWorkspace = ({
  connections,
  defaultProfile,
  errors,
  filters,
  filtersOpen,
  onAction,
  onFixProfileFolder,
  profileFolderOverlaps,
  onAddTorrent,
  onFiltersChange,
  onOpenFilters,
  onRemove,
  onSelectTorrent,
  onSetProfile,
  profiles,
  selectedTorrentId,
  statistics,
  torrents,
}: Web_Components_TorrentWorkspace_Props): ReactElement => {
  const connectionFilter: string = filters['connection'];
  const statusFilter: Web_Components_TorrentFilter = filters['status'];
  const labelFilter: string = filters['label'];
  const profileFilter: string = filters['profile'];

  /**
   * Torrent Workspace - Set status filter.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const setStatusFilter = (status: Web_Components_TorrentFilter): void => onFiltersChange({
    ...filters,
    status,
  });

  /**
   * Torrent Workspace - Set label filter.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const setLabelFilter = (label: string): void => onFiltersChange({
    ...filters,
    label,
  });

  /**
   * Torrent Workspace - Sets profile filter.
   *
   * Updates the shared sidebar and the active-filter pills.
   * An empty string disables this independent filter dimension.
   *
   * @since 2.0.0
   */
  const setProfileFilter = (profile: string): void => onFiltersChange({
    ...filters,
    profile,
  });

  /**
   * Torrent Workspace - Sets connection filter.
   *
   * Clears or selects the VPN dimension independently from library filters.
   * The VPN connection list uses this handler through shared filter state.
   *
   * @since 2.0.0
   */
  const setConnectionFilter = (connection: string): void => onFiltersChange({
    ...filters,
    connection,
  });
  const [
    query,
    setQuery,
  ] = useState<string>('');
  const [
    selectedIDs,
    setSelectedIDs,
  ] = useState<number[]>([]);
  const [
    lastSelectedID,
    setLastSelectedID,
  ] = useState<number | null>(null);
  const [
    sort,
    setSort,
  ] = useState<Web_Components_TorrentSort>({
    direction: 'ascending',
    key: 'queuePosition',
  });
  const [
    page,
    setPage,
  ] = useState<number>(1);
  const [
    pageSize,
    setPageSize,
  ] = useState<Web_Components_TorrentPageSize>(25);
  const [
    busy,
    setBusy,
  ] = useState<boolean>(false);
  const [
    removeOpen,
    setRemoveOpen,
  ] = useState<boolean>(false);
  const [
    profileChangeOpen,
    setProfileChangeOpen,
  ] = useState<boolean>(false);
  const [
    deleteLocalData,
    setDeleteLocalData,
  ] = useState<boolean>(false);
  const [
    contextMenu,
    setContextMenu,
  ] = useState<Web_Components_TorrentContextMenu | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const torrentHashesByIDRef = useRef<ReadonlyMap<number, string>>(new Map(
    torrents.map((torrent: Web_Api_Torrent): [number, string] => [
      torrent['id'],
      torrent['hashString'],
    ]),
  ));

  useEscapeKey((): void => setRemoveOpen(false), removeOpen);

  useEffect((): void => {
    setSelectedIDs((currentIDs: number[]): number[] => (
      remapSelectedTorrentIDs(currentIDs, torrentHashesByIDRef.current, torrents)
    ));
    setLastSelectedID((currentID: number | null): number | null => {
      if (currentID === null) {
        return null;
      }
      const [nextID] = remapSelectedTorrentIDs([currentID], torrentHashesByIDRef.current, torrents);

      return nextID ?? null;
    });
    torrentHashesByIDRef.current = new Map(
      torrents.map((torrent: Web_Api_Torrent): [number, string] => [
        torrent['id'],
        torrent['hashString'],
      ]),
    );
  }, [torrents]);

  useEffect((): void => setPage(1), [
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
  useEffect((): void => {
    setSelectedIDs([]);
    setLastSelectedID(null);
  }, [
    connectionFilter,
    labelFilter,
    profileFilter,
    statusFilter,
  ]);

  useEffect((): (() => void) | undefined => {
    if (contextMenu === null) {
      return undefined;
    }

    /**
     * Torrent Workspace - Closes menu.
     *
     * Centralizes this operation for the surrounding workflow.
     * Callers reuse one implementation instead of repeating the behavior.
     *
     * @since 2.0.0
     */
    const closeMenu = (): void => setContextMenu(null);
    // Clicks inside the menu keep it open; its buttons close it once their action starts.

    /**
     * Torrent Workspace - Closes on outside click.
     *
     * Centralizes this operation for the surrounding workflow.
     * Callers reuse one implementation instead of repeating the behavior.
     *
     * @since 2.0.0
     */
    const closeOnOutsideClick = (event: globalThis.MouseEvent): void => {
      if (event.target instanceof Node && contextMenuRef.current !== null && contextMenuRef.current.contains(event.target)) {
        return;
      }

      closeMenu();
    };

    /**
     * Torrent Workspace - Closes on escape.
     *
     * Centralizes this operation for the surrounding workflow.
     * Callers reuse one implementation instead of repeating the behavior.
     *
     * @since 2.0.0
     */
    const closeOnEscape = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    window.addEventListener('click', closeOnOutsideClick);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('keydown', closeOnEscape);

    return (): void => {
      window.removeEventListener('click', closeOnOutsideClick);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [contextMenu]);

  const filteredTorrents: Web_Api_Torrent[] = useMemo((): Web_Api_Torrent[] => {
    const normalizedQuery: string = query.trim().toLowerCase();

    return torrents.filter((torrent: Web_Api_Torrent): boolean => (
      torrentMatchesFilter(torrent, statusFilter)
      && (connectionFilter === '' || torrentMatchesLibrarySelection(torrent, {
        kind: 'connection',
        value: connectionFilter,
      }))
      && (labelFilter === '' || torrentMatchesLibrarySelection(torrent, {
        kind: 'label',
        value: labelFilter,
      }))
      && (profileFilter === '' || torrentMatchesLibrarySelection(torrent, {
        kind: 'profile',
        value: (profileFilter === defaultProfileFilterValue) ? null : profileFilter,
      }))
      && (
        normalizedQuery === ''
        || torrent['name'].toLowerCase().includes(normalizedQuery)
        || torrent['labels'].some((label: string): boolean => label.toLowerCase().includes(normalizedQuery))
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

  const showQueuePosition: boolean = connections.length <= 1 || torrentQueuePositionsAreComparable(filteredTorrents);
  const effectiveSort: Web_Components_TorrentSort = (!showQueuePosition && sort['key'] === 'queuePosition') ? {
    direction: 'ascending',
    key: 'name',
  } : sort;
  const sortedTorrents: Web_Api_Torrent[] = useMemo((): Web_Api_Torrent[] => (
    [...filteredTorrents].sort((leftTorrent: Web_Api_Torrent, rightTorrent: Web_Api_Torrent): number => (
      compareTorrents(leftTorrent, rightTorrent, effectiveSort)
    ))
  ), [
    effectiveSort,
    filteredTorrents,
  ]);

  const pageCount: number = Math.max(1, Math.ceil(sortedTorrents.length / pageSize));
  const currentPage: number = Math.min(page, pageCount);
  const firstVisibleIndex: number = (currentPage - 1) * pageSize;
  const visibleTorrents: Web_Api_Torrent[] = useMemo((): Web_Api_Torrent[] => (
    sortedTorrents.slice(firstVisibleIndex, firstVisibleIndex + pageSize)
  ), [
    firstVisibleIndex,
    pageSize,
    sortedTorrents,
  ]);
  const everyVisibleSelected: boolean = visibleTorrents.length > 0 && visibleTorrents.every(
    (torrent: Web_Api_Torrent): boolean => selectedIDs.includes(torrent['id']),
  );

  // Checks only ever cover rows on screen. A search, another page, a new sort, or a
  // torrent leaving the list unchecks what it hides, so actions never reach those rows.
  useEffect((): void => {
    const visibleIDs: Set<number> = new Set(
      visibleTorrents.map((torrent: Web_Api_Torrent): number => torrent['id']),
    );

    setSelectedIDs((currentIDs: number[]): number[] => {
      const keptIDs: number[] = currentIDs.filter((identifier: number): boolean => visibleIDs.has(identifier));

      return (keptIDs.length === currentIDs.length) ? currentIDs : keptIDs;
    });
    setLastSelectedID((currentID: number | null): number | null => (
      (currentID === null || visibleIDs.has(currentID)) ? currentID : null
    ));
  }, [visibleTorrents]);
  const connectionTorrents: Web_Api_Torrent[] = (connectionFilter === '') ? torrents : torrents.filter(
    (torrent: Web_Api_Torrent): boolean => torrent['connectionId'] === connectionFilter,
  );
  const downloadingCount: number = connectionTorrents.filter((torrent: Web_Api_Torrent): boolean => torrentMatchesFilter(torrent, 'downloading')).length;
  const seedingCount: number = connectionTorrents.filter((torrent: Web_Api_Torrent): boolean => torrentMatchesFilter(torrent, 'seeding')).length;
  const currentStatistics: Web_Api_StatisticsPeriod | undefined = statisticPeriod(statistics, 'current-stats');
  const cumulativeStatistics: Web_Api_StatisticsPeriod | undefined = statisticPeriod(statistics, 'cumulative-stats');
  const statusFilterLabel: string = torrentLibraryFilters.find((filter: Web_Components_TorrentFilterItem): boolean => filter['id'] === statusFilter)?.['label'] ?? 'All torrents';
  const selectedProfile: Web_Api_TorrentProfile | undefined = profiles.find(
    (profile: Web_Api_TorrentProfile): boolean => profile['id'] === profileFilter,
  );
  const profileFilterLabel: string = (profileFilter === defaultProfileFilterValue) ? defaultProfile['name'] : selectedProfile?.['name'] ?? '';
  const selectedConnection = connections.find((connection): boolean => connection['id'] === connectionFilter);
  const connectionFilterLabel: string = selectedConnection?.['name'] ?? connectionFilter;
  const activeFilterCount: number = Number(statusFilter !== 'all')
    + Number(profileFilter !== '')
    + Number(labelFilter !== '');
  const activeFilterLabel: string = (activeFilterCount === 1) ? '1 active filter' : `${activeFilterCount} active filters`;
  const filtersActive: boolean = connectionFilter !== '' || statusFilter !== 'all' || labelFilter !== '' || profileFilter !== '' || query !== '';
  const duplicateNotices: string[] = useMemo(
    (): string[] => duplicateTorrentNotices(errors, torrents, connections),
    [
      connections,
      errors,
      torrents,
    ],
  );
  const needsProfileCount: number = torrents.filter(
    (torrent: Web_Api_Torrent): boolean => torrent['needsProfile'] !== null,
  ).length;
  const contextMenuTorrentFileCount: number = (contextMenu === null) ? 0 : torrents.filter(
    (torrent: Web_Api_Torrent): boolean => (
      contextMenu['torrentIds'].includes(torrent['id']) && torrent['metadataPercentComplete'] >= 1
    ),
  ).length;
  const contextMenuFinishedCount: number = (contextMenu === null) ? 0 : torrents.filter(
    (torrent: Web_Api_Torrent): boolean => (
      contextMenu['torrentIds'].includes(torrent['id']) && torrentHasFinishedFiles(torrent)
    ),
  ).length;

  /**
   * Torrent Workspace - Toggles sort.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const toggleSort = (key: Web_Components_TorrentSortKey): void => {
    setSort((currentSort: Web_Components_TorrentSort): Web_Components_TorrentSort => {
      const sameKey: boolean = currentSort['key'] === key;
      const nextDirection: Web_Components_TorrentSort['direction'] = (sameKey && currentSort['direction'] === 'ascending') ? 'descending' : 'ascending';

      return {
        direction: (sameKey) ? nextDirection : 'ascending',
        key,
      };
    });
  };

  /**
   * Torrent Workspace - Toggles visible.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const toggleVisible = (): void => {
    if (everyVisibleSelected) {
      const visibleIDs: Set<number> = new Set(
        visibleTorrents.map((torrent: Web_Api_Torrent): number => torrent['id']),
      );

      setSelectedIDs((currentIDs: number[]): number[] => (
        currentIDs.filter((identifier: number): boolean => !visibleIDs.has(identifier))
      ));

      return;
    }

    const nextIDs: Set<number> = new Set(selectedIDs);

    for (const torrent of visibleTorrents) {
      nextIDs.add(torrent['id']);
    }

    setSelectedIDs([...nextIDs]);
  };

  /**
   * Torrent Workspace - Toggles torrent.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const toggleTorrent = (identifier: number, range: boolean): void => {
    // A shift-click range stays on this page, so it never checks rows you can't see.
    if (range && lastSelectedID !== null) {
      const anchorIndex: number = visibleTorrents.findIndex((torrent: Web_Api_Torrent): boolean => torrent['id'] === lastSelectedID);
      const targetIndex: number = visibleTorrents.findIndex((torrent: Web_Api_Torrent): boolean => torrent['id'] === identifier);

      if (anchorIndex >= 0 && targetIndex >= 0) {
        const startIndex: number = Math.min(anchorIndex, targetIndex);
        const endIndex: number = Math.max(anchorIndex, targetIndex);
        const nextIDs: Set<number> = new Set(selectedIDs);

        for (const torrent of visibleTorrents.slice(startIndex, endIndex + 1)) {
          nextIDs.add(torrent['id']);
        }

        setSelectedIDs([...nextIDs]);
        setLastSelectedID(identifier);

        return;
      }
    }

    setSelectedIDs((currentIDs: number[]): number[] => (
      (currentIDs.includes(identifier)) ? currentIDs.filter((currentID: number): boolean => currentID !== identifier) : [
        ...currentIDs,
        identifier,
      ]
    ));
    setLastSelectedID(identifier);
  };

  /**
   * Torrent Workspace - Perform action.
   *
   * Stores this module-level value in one named location.
   * Related code reuses it instead of duplicating the definition.
   *
   * @since 2.0.0
   */
  const performAction = async (
    action: Web_Api_TorrentAction,
    identifiers: number[],
  ): Promise<void> => {
    if (identifiers.length === 0) {
      return;
    }
    const hashes: string[] = hashesForTorrentIdentifiers(torrents, identifiers);
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
  };

  /**
   * Torrent Workspace - Downloads torrent files.
   *
   * Saves one torrent's .torrent file, or a zip for several. A toast says when
   * torrents still fetching their metadata were left out.
   *
   * @since 2.2.0
   */
  const downloadTorrentFilesFor = async (identifiers: number[]): Promise<void> => {
    const hashes: string[] = hashesForTorrentIdentifiers(torrents, identifiers);
    if (hashes.length === 0) {
      return;
    }

    setBusy(true);

    try {
      const skipped: number = await downloadTorrentFiles(hashes);
      setContextMenu(null);
      if (skipped > 0) {
        showToast(`${skipped} ${(skipped === 1) ? 'torrent has' : 'torrents have'} no .torrent file yet, so ${(skipped === 1) ? 'it was' : 'they were'} left out.`, true);
      }
    } catch (caughtError) {
      showToast((caughtError instanceof Error) ? caughtError.message : 'The torrent files couldn\'t be downloaded.', false);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Torrent Workspace - Downloads finished files.
   *
   * Downloads a finished torrent's file, or a zip of its files, and one zip for several
   * torrents. A toast says which selected torrents were left out and why.
   *
   * @since 2.2.0
   */
  const downloadFinishedFilesFor = async (identifiers: number[]): Promise<void> => {
    const hashes: string[] = hashesForTorrentIdentifiers(torrents, identifiers);
    if (hashes.length === 0) {
      return;
    }

    setBusy(true);

    try {
      const prepared: Web_Api_TorrentContentsDownload = await downloadFinishedFiles(hashes);
      setContextMenu(null);
      const leftOut: string = finishedFilesLeftOut(prepared['unfinished'], prepared['unavailable']);
      if (leftOut !== '') {
        showToast(leftOut, true);
      }
    } catch (caughtError) {
      showToast((caughtError instanceof Error) ? caughtError.message : 'The files couldn\'t be downloaded.', false);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Torrent Workspace - Removes selected.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const removeSelected = async (): Promise<void> => {
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
  };

  // Opens the action menu next to a point, flipping above it when there is no room below.

  /**
   * Torrent Workspace - Open menu at.
   *
   * Stores this module-level value in one named location.
   * Related code reuses it instead of duplicating the definition.
   *
   * @since 2.0.0
   */
  const openMenuAt = (
    x: number,
    y: number,
    torrentIds: number[],
  ): void => {
    const menuHeight: number = 340;
    const menuWidth: number = 220;

    setContextMenu({
      torrentIds,
      x: Math.min(x, window.innerWidth - menuWidth - 8),
      y: (y + menuHeight > window.innerHeight) ? Math.max(8, y - menuHeight) : y,
    });
  };

  /**
   * Torrent Workspace - Open row menu.
   *
   * Stores this module-level value in one named location.
   * Related code reuses it instead of duplicating the definition.
   *
   * @since 2.0.0
   */
  const openRowMenu = (
    event: MouseEvent<HTMLElement>,
    torrent: Web_Api_Torrent,
  ): void => {
    event.preventDefault();
    event.stopPropagation();

    const torrentIds: number[] = (selectedIDs.includes(torrent['id'])) ? selectedIDs : [torrent['id']];

    openMenuAt(event.clientX, event.clientY, torrentIds);
  };

  /**
   * Torrent Workspace - Open button menu.
   *
   * Stores this module-level value in one named location.
   * Related code reuses it instead of duplicating the definition.
   *
   * @since 2.0.0
   */
  const openButtonMenu = (
    event: MouseEvent<HTMLButtonElement>,
    torrentIds: number[],
  ): void => {
    event.stopPropagation();

    const bounds: DOMRect = event.currentTarget.getBoundingClientRect();

    openMenuAt(bounds.right - 220, bounds.bottom + 4, torrentIds);
  };

  /**
   * Torrent Workspace - Clear filters.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const clearFilters = (): void => {
    onFiltersChange({
      connection: '',
      label: '',
      profile: '',
      status: 'all',
    });
    setQuery('');
  };

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Torrents</h1>
          <p>
            {(connectionFilter === '')
              ? `${connectionTorrents.length} total · ${downloadingCount} downloading · ${seedingCount} seeding`
              : `${connectionTorrents.length} ${(connectionTorrents.length === 1) ? 'torrent' : 'torrents'} on ${connectionFilterLabel} · ${downloadingCount} downloading · ${seedingCount} seeding`}
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
            {profileFolderOverlaps.map((overlap: Web_Api_TorrentProfileFolderOverlap): ReactElement => (
              <li key={overlap['profileId']}>
                <span>
                  <strong>{(overlap['profileId'] === 'default') ? overlap['profileName'] : `${overlap['profileName']} profile`}</strong>
                  {` — ${overlap['message']}`}
                </span>
                <Button onClick={(): void => onFixProfileFolder(overlap['profileId'])}>Change folder</Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(needsProfileCount === 0) ? null : (
        <div className="torrent-profile-choice-banner" role="status">
          <span>{`${needsProfileCount} ${(needsProfileCount === 1) ? 'torrent matches' : 'torrents match'} more than one profile.`}</span>
          <Button
            onClick={(): void => {
              onFiltersChange({
                connection: '',
                label: '',
                profile: '',
                status: 'needs-profile',
              });
              setQuery('');
            }}
          >
            Resolve
          </Button>
        </div>
      )}

      {duplicateNotices.map((notice: string): ReactElement => (
        <p className="torrent-duplicate-notice" key={notice} role="status">{notice}</p>
      ))}

      <div className="filter-bar">
        <div className="filter-controls">
          <label className="search-field">
            <Icon name="search" size={16} />
            <span className="visually-hidden">Search torrents</span>
            <input
              onChange={(event): void => setQuery(event.currentTarget.value)}
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

      {(connectionFilter === '' && statusFilter === 'all' && labelFilter === '' && profileFilter === '') ? null : (
        <div aria-label="Active filters" className="active-filters" role="group">
          <span>Showing</span>
          {(connectionFilter === '') ? null : (
            <button className="filter-pill filter-pill-vpn" onClick={(): void => setConnectionFilter('')} type="button">
              <Icon name="shield" size={13} />
              {`VPN: ${connectionFilterLabel}`}
              <Icon name="x" size={12} />
            </button>
          )}
          {(statusFilter === 'all') ? null : (
            <button className="filter-pill" onClick={(): void => setStatusFilter('all')} type="button">
              {statusFilterLabel}
              <Icon name="x" size={12} />
            </button>
          )}
          {(labelFilter === '') ? null : (
            <button className="filter-pill" onClick={(): void => setLabelFilter('')} type="button">
              <Icon name="label" size={13} />
              {labelFilter}
              <Icon name="x" size={12} />
            </button>
          )}
          {(profileFilter === '') ? null : (
            <button className="filter-pill" onClick={(): void => setProfileFilter('')} type="button">
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
            {(torrents.length > 0 && filtersActive) ? (
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
                {(showQueuePosition) ? <th className="cell-queue"><SortHeader activeSort={effectiveSort} label="#" onSort={toggleSort} sortKey="queuePosition" /></th> : null}
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
              {visibleTorrents.map((torrent: Web_Api_Torrent): ReactElement => {
                const selected: boolean = selectedIDs.includes(torrent['id']);
                const state: Web_Components_TorrentState = describeTorrentState(torrent);
                const trackerIssue: Web_Components_TrackerIssue | null = describeTrackerIssue(torrent);
                const connection = connections.find((candidate): boolean => candidate['id'] === torrent['connectionId']);
                const downloading: boolean = state['tone'] === 'downloading';
                const peerCount: number = torrent['peersConnected'];

                /**
                 * Torrent Workspace - Opens details.
                 *
                 * Centralizes this operation for the surrounding workflow.
                 * Callers reuse one implementation instead of repeating the behavior.
                 *
                 * @since 2.0.0
                 */
                const openDetails = (): void => onSelectTorrent(torrent);

                /**
                 * Torrent Workspace - Handles key down.
                 *
                 * Centralizes this operation for the surrounding workflow.
                 * Callers reuse one implementation instead of repeating the behavior.
                 *
                 * @since 2.0.0
                 */
                const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>): void => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    openDetails();
                  }
                };

                return (
                  <tr
                    aria-selected={selected || selectedTorrentId === torrent['id']}
                    className="torrent-list-row"
                    key={torrent['id']}
                    onClick={openDetails}
                    onContextMenu={(event: MouseEvent<HTMLTableRowElement>): void => openRowMenu(event, torrent)}
                    onKeyDown={handleKeyDown}
                    tabIndex={0}
                  >
                    <td className="cell-select">
                      <input
                        aria-label={`Select ${torrent['name']}`}
                        checked={selected}
                        onClick={(event: MouseEvent<HTMLInputElement>): void => {
                          event.stopPropagation();
                          toggleTorrent(torrent['id'], event.shiftKey);
                        }}
                        readOnly
                        type="checkbox"
                      />
                    </td>
                    {(showQueuePosition) ? <td className="cell-queue">{torrent['queuePosition'] + 1}</td> : null}
                    <td className="cell-name">
                      <div className="torrent-name" title={torrent['name']}>{torrent['name']}</div>
                      <div className={(state['tone'] === 'error') ? 'torrent-meta torrent-meta-error' : 'torrent-meta'}>
                        <span className={`status-dot status-${state['tone']}`} />
                        <span className="torrent-state">{state['label']}</span>
                        {(peerCount > 0) ? <span>{`· ${peerCount} ${(peerCount === 1) ? 'peer' : 'peers'}`}</span> : null}
                        {(trackerIssue === null) ? null : <span className="torrent-tracker-issue" title={trackerIssue['reply']}>{trackerIssue['label']}</span>}
                        {(torrent['needsProfile'] === null) ? null : <span className="tag tag-warning">Needs a profile</span>}
                        {(torrent['isStalled']) ? <span className="tag tag-warning">Stalled</span> : null}
                        {(torrent['isPrivate']) ? <span className="tag">Private</span> : null}
                        {(connection === undefined) ? null : (
                          <span className="tag tag-vpn">
                            <Icon name="shield" size={11} />
                            {connection['name']}
                          </span>
                        )}
                        {torrent['labels'].slice(0, 3).map((label: string): ReactElement => (
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
                    <td className={(downloading && torrent['eta'] >= 0) ? 'numeric column-secondary' : 'numeric column-secondary cell-muted'}>
                      {(downloading && torrent['eta'] >= 0) ? formatDuration(torrent['eta']) : '—'}
                    </td>
                    <td className="numeric column-secondary">{formatRatio(torrent['uploadRatio'])}</td>
                    <td className="cell-actions">
                      <button
                        aria-expanded={contextMenu !== null && contextMenu['torrentIds'].includes(torrent['id'])}
                        aria-haspopup="menu"
                        aria-label={`Actions for ${torrent['name']}`}
                        className="icon-button"
                        onClick={(event: MouseEvent<HTMLButtonElement>): void => openButtonMenu(event, (selected) ? selectedIDs : [torrent['id']])}
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
                onChange={(event: ChangeEvent<HTMLSelectElement>): void => setPageSize(Number(event.currentTarget.value) as Web_Components_TorrentPageSize)}
                value={pageSize}
              >
                <option value="25">25 rows</option>
                <option value="50">50 rows</option>
                <option value="100">100 rows</option>
              </select>
              <button aria-label="Previous page" className="icon-button" disabled={currentPage <= 1} onClick={(): void => setPage(currentPage - 1)} type="button">
                <span style={{ transform: 'rotate(180deg)' }}><Icon name="chevron" size={16} /></span>
              </button>
              <button aria-label="Next page" className="icon-button" disabled={currentPage >= pageCount} onClick={(): void => setPage(currentPage + 1)} type="button">
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
            onClick={(): void => {
              void performAction('start', selectedIDs);
            }}
          >
            Start
          </Button>
          <Button
            disabled={busy}
            icon="pause"
            onClick={(): void => {
              void performAction('stop', selectedIDs);
            }}
          >
            Pause
          </Button>
          <Button disabled={busy} icon="settings" onClick={(): void => setProfileChangeOpen(true)}>Change profile</Button>
          <Button disabled={busy} icon="remove" onClick={(): void => setRemoveOpen(true)}>Remove</Button>
          <button
            aria-haspopup="menu"
            aria-label="More actions"
            className="icon-button"
            onClick={(event: MouseEvent<HTMLButtonElement>): void => openButtonMenu(event, selectedIDs)}
            type="button"
          >
            <Icon name="more" size={18} />
          </button>
          <span className="selection-bar-divider" />
          <button
            aria-label="Clear selection"
            className="icon-button"
            onClick={(): void => setSelectedIDs([])}
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
            onClick={(): void => {
              void performAction('start', contextMenu['torrentIds']);
            }}
            role="menuitem"
            type="button"
          >
            <Icon name="play" size={16} />
            Start
          </button>
          <button
            onClick={(): void => {
              void performAction('start-now', contextMenu['torrentIds']);
            }}
            role="menuitem"
            type="button"
          >
            <Icon name="play" size={16} />
            Start now, skip the queue
          </button>
          <button
            onClick={(): void => {
              void performAction('stop', contextMenu['torrentIds']);
            }}
            role="menuitem"
            type="button"
          >
            <Icon name="pause" size={16} />
            Pause
          </button>
          <hr />
          <button
            onClick={(): void => {
              void performAction('verify', contextMenu['torrentIds']);
            }}
            role="menuitem"
            type="button"
          >
            <Icon name="check" size={16} />
            Verify local data
          </button>
          <button
            onClick={(): void => {
              void performAction('reannounce', contextMenu['torrentIds']);
            }}
            role="menuitem"
            type="button"
          >
            <Icon name="refresh" size={16} />
            Ask trackers for more peers
          </button>
          <button
            disabled={busy || contextMenuTorrentFileCount === 0}
            onClick={(): void => {
              void downloadTorrentFilesFor(contextMenu['torrentIds']);
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
              onClick={(): void => {
                void downloadFinishedFilesFor(contextMenu['torrentIds']);
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
            onClick={(): void => {
              void performAction('queue-top', contextMenu['torrentIds']);
            }}
            role="menuitem"
            type="button"
          >
            <Icon name="arrow-up" size={16} />
            Move to top of queue
          </button>
          <button
            onClick={(): void => {
              void performAction('queue-up', contextMenu['torrentIds']);
            }}
            role="menuitem"
            type="button"
          >
            <Icon name="chevron-up" size={16} />
            Move up one
          </button>
          <button
            onClick={(): void => {
              void performAction('queue-down', contextMenu['torrentIds']);
            }}
            role="menuitem"
            type="button"
          >
            <Icon name="chevron-down" size={16} />
            Move down one
          </button>
          <button
            onClick={(): void => {
              void performAction('queue-bottom', contextMenu['torrentIds']);
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
            onClick={(): void => {
              setSelectedIDs(contextMenu['torrentIds']);
              setContextMenu(null);
              setRemoveOpen(true);
            }}
            role="menuitem"
            type="button"
          >
            <Icon name="remove" size={16} />
            Remove…
          </button>
        </div>
      )}

      {(removeOpen) ? (
        <div className="dialog-backdrop" role="presentation">
          <section aria-labelledby="remove-title" aria-modal="true" className="dialog dialog-small" role="dialog">
            <div className="dialog-heading">
              <h2 id="remove-title">{`Remove ${selectedIDs.length} ${(selectedIDs.length === 1) ? 'torrent' : 'torrents'}?`}</h2>
              <button aria-label="Close" className="icon-button" onClick={(): void => setRemoveOpen(false)} type="button"><Icon name="x" /></button>
            </div>
            <p>{'They\'ll be removed from the list. Downloaded files stay on disk unless you choose to delete them.'}</p>
            <label aria-label="Also delete the downloaded files" className="check-row check-row-danger">
              <input
                checked={deleteLocalData}
                onChange={(event): void => setDeleteLocalData(event.currentTarget.checked)}
                type="checkbox"
              />
              <span>
                <strong>Also delete the downloaded files</strong>
                <small>{'This can\'t be undone.'}</small>
              </span>
            </label>
            <div className="dialog-actions">
              <Button onClick={(): void => setRemoveOpen(false)}>Cancel</Button>
              <Button
                disabled={busy}
                onClick={(): void => {
                  void removeSelected();
                }}
                variant="danger"
              >
                {(deleteLocalData) ? 'Remove and delete files' : 'Remove'}
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      {(profileChangeOpen) ? (
        <TorrentProfileChangeDialog
          connections={connections}
          defaultProfile={defaultProfile}
          hashes={hashesForTorrentIdentifiers(torrents, selectedIDs)}
          onClose={(): void => setProfileChangeOpen(false)}
          onSetProfile={onSetProfile}
          profiles={profiles}
          torrents={torrents}
        />
      ) : null}

    </section>
  );
};
