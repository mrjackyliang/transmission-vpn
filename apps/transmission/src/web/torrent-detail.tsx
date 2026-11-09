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
} from '@/web/torrent-library.ts';
import { torrentMoveResultLabel } from '@/web/torrent-move-result.ts';
import {
  describeTorrentProfileChange,
  torrentProfileRefreshID,
} from '@/web/torrent-profile-change.ts';
import { torrentNameMatchesPattern } from '@/web/torrent-profile-matcher.ts';
import { useEscapeKey } from '@/web/use-escape-key.ts';

import type {
  ChangeEvent,
  FormEvent,
  ReactElement,
} from 'react';

import type {
  Web_Api_DefaultTorrentProfile,
  Web_Api_MovedTorrent,
  Web_Api_SetTorrentProfileResponse,
  Web_Api_TorrentChanges,
  Web_Api_TorrentFile,
  Web_Api_TorrentFileStats,
  Web_Api_TorrentPeer,
  Web_Api_TorrentProfile,
  Web_Api_TorrentTrackerStats,
} from '@/types/web/api.d.ts';
import type {
  Web_Components_TorrentDetail_Props,
  Web_Components_TorrentDetail_Tab,
  Web_Components_TorrentFileDraft,
  Web_Components_TorrentFileDrafts,
  Web_Components_TorrentFileRow,
  Web_Components_TorrentOptionsDraft,
} from '@/types/web/components.d.ts';

/**
 * Torrent Detail - Copies text.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const copyText = async (value: string): Promise<void> => {
  await navigator.clipboard.writeText(value);
};

/**
 * Torrent Detail - Tracker list from detail.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const trackerListFromDetail = (
  trackerList: string | undefined,
  trackers: Array<{
    announce: string
    tier: number
  }> | undefined,
): string => {
  if (trackerList !== undefined) {
    return trackerList;
  }

  const trackerGroups: Map<number, string[]> = new Map<number, string[]>();
  for (const tracker of trackers ?? []) {
    const group: string[] = trackerGroups.get(tracker['tier']) ?? [];
    group.push(tracker['announce']);
    trackerGroups.set(tracker['tier'], group);
  }

  return [...trackerGroups.values()].map((group: string[]): string => group.join('\n')).join('\n\n');
};

/**
 * Torrent Detail - File drafts from detail.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const fileDraftsFromDetail = (
  files: Web_Api_TorrentFile[] | undefined,
  fileStats: Web_Api_TorrentFileStats[] | undefined,
): Web_Components_TorrentFileDrafts => {
  const drafts: Web_Components_TorrentFileDrafts = {};
  for (let index: number = 0; index < (files?.length ?? 0); index += 1) {
    const statistics: Web_Api_TorrentFileStats | undefined = fileStats?.[index];
    Reflect.set(drafts, index, {
      priority: statistics?.['priority'] ?? 0,
      wanted: statistics?.['wanted'] ?? true,
    });
  }

  return drafts;
};

/**
 * Torrent Detail - Options from detail.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const optionsFromDetail = (
  detail: NonNullable<Web_Components_TorrentDetail_Props['detail']>,
): Web_Components_TorrentOptionsDraft => ({
  bandwidthPriority: detail['bandwidthPriority'] ?? 0,
  downloadLimit: detail['downloadLimit'] ?? 0,
  downloadLimited: detail['downloadLimited'] ?? false,
  honorsSessionLimits: detail['honorsSessionLimits'] ?? true,
  labels: detail['labels'].join(', '),
  peerLimit: detail['peer-limit'] ?? detail['maxConnectedPeers'] ?? 50,
  seedIdleLimit: detail['seedIdleLimit'] ?? 30,
  seedIdleMode: (detail['seedIdleMode'] === 1) ? 1 : 2,
  seedRatioLimit: detail['seedRatioLimit'] ?? 2,
  seedRatioMode: (detail['seedRatioMode'] === 1) ? 1 : 2,
  uploadLimit: detail['uploadLimit'] ?? 0,
  uploadLimited: detail['uploadLimited'] ?? false,
});

/**
 * Torrent Detail.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const TorrentDetail = ({
  connections,
  defaultProfile,
  detail,
  labelPresets,
  loading,
  onAction,
  onClose,
  onRefresh,
  onRename,
  onSetProfile,
  onUpdate,
  profiles,
}: Web_Components_TorrentDetail_Props): ReactElement => {
  const [
    tab,
    setTab,
  ] = useState<Web_Components_TorrentDetail_Tab>('overview');
  const [
    fileQuery,
    setFileQuery,
  ] = useState<string>('');
  const [
    fileDrafts,
    setFileDrafts,
  ] = useState<Web_Components_TorrentFileDrafts>({});
  const [
    trackerList,
    setTrackerList,
  ] = useState<string>('');
  const [
    options,
    setOptions,
  ] = useState<Web_Components_TorrentOptionsDraft | null>(null);
  const [
    renameName,
    setRenameName,
  ] = useState<string>('');
  const [
    busy,
    setBusy,
  ] = useState<boolean>(false);
  const [
    profileId,
    setProfileId,
  ] = useState<string>('');
  const [
    applyProfileOptions,
    setApplyProfileOptions,
  ] = useState<boolean>(true);
  const [
    profileMoveResults,
    setProfileMoveResults,
  ] = useState<Web_Api_MovedTorrent[]>([]);
  const [
    resolutionOpen,
    setResolutionOpen,
  ] = useState<boolean>(false);
  const [
    resolutionResults,
    setResolutionResults,
  ] = useState<Web_Api_MovedTorrent[] | null>(null);
  const [
    resolutionError,
    setResolutionError,
  ] = useState<string>('');

  useEffect((): void => {
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
  }, [detail?.id]);

  useEffect((): void => {
    setProfileId(detail?.['profileId'] ?? '');
  }, [detail?.profileId]);

  const filteredFiles: Web_Components_TorrentFileRow[] = useMemo((): Web_Components_TorrentFileRow[] => {
    const normalizedQuery: string = fileQuery.trim().toLowerCase();

    return (detail?.['files'] ?? [])
      .map((file: Web_Api_TorrentFile, index: number): Web_Components_TorrentFileRow => ({
        file,
        index,
      }))
      .filter((row: Web_Components_TorrentFileRow): boolean => (
        normalizedQuery === '' || row['file']['name'].toLowerCase().includes(normalizedQuery)
      ));
  }, [
    detail?.files,
    fileQuery,
  ]);

  /**
   * Torrent Detail - Run mutation.
   *
   * Stores this module-level value in one named location.
   * Related code reuses it instead of duplicating the definition.
   *
   * @since 2.0.0
   */
  const runMutation = async (
    mutation: () => Promise<void>,
    successMessage: string,
  ): Promise<void> => {
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
  };

  /**
   * Torrent Detail - Save files.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const saveFiles = async (): Promise<void> => {
    if (detail === null) {
      return;
    }

    const filesWanted: number[] = [];
    const filesUnwanted: number[] = [];
    const priorityHigh: number[] = [];
    const priorityLow: number[] = [];
    const priorityNormal: number[] = [];
    for (const [
      indexValue,
      draft,
    ] of Object.entries(fileDrafts)) {
      const index: number = Number(indexValue);
      ((draft['wanted']) ? filesWanted : filesUnwanted).push(index);
      if (draft['priority'] === 1) {
        priorityHigh.push(index);
      } else if (draft['priority'] === -1) {
        priorityLow.push(index);
      } else {
        priorityNormal.push(index);
      }
    }

    const changes: Web_Api_TorrentChanges = {
      filesUnwanted,
      filesWanted,
      priorityHigh,
      priorityLow,
      priorityNormal,
    };
    await runMutation(
      async (): Promise<void> => onUpdate([detail['hashString']], changes),
      'File selection and priorities saved.',
    );
  };

  /**
   * Torrent Detail - Save trackers.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const saveTrackers = async (): Promise<void> => {
    if (detail === null) {
      return;
    }

    await runMutation(
      async (): Promise<void> => onUpdate([detail['hashString']], { trackerList: trackerList.trim() }),
      'Tracker tiers saved.',
    );
  };

  /**
   * Torrent Detail - Save options.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const saveOptions = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (detail === null || options === null) {
      return;
    }

    const labels: string[] = options['labels']
      .split(',')
      .map((label: string): string => label.trim())
      .filter((label: string): boolean => label !== '');
    const changes: Web_Api_TorrentChanges = {
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
      async (): Promise<void> => onUpdate([detail['hashString']], changes),
      'Torrent options saved.',
    );
  };

  /**
   * Torrent Detail - Rename torrent.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const renameTorrent = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (detail === null) {
      return;
    }

    await runMutation(
      async (): Promise<void> => onRename({
        hashes: [detail['hashString']],
        name: renameName.trim(),
        path: detail['name'],
      }),
      'Torrent root renamed.',
    );
  };

  /**
   * Torrent Detail - Applies torrent profile.
   *
   * Assigns or clears the profile and optionally copies its labels and limits.
   * The refreshed detail becomes the source of truth after the mutation.
   *
   * @since UNRELEASED
   */
  const applyTorrentProfile = async (): Promise<void> => {
    if (detail === null) {
      return;
    }

    const selectedProfile: Web_Api_TorrentProfile | undefined = profiles.find(
      (profile: Web_Api_TorrentProfile): boolean => profile['id'] === profileId,
    );
    let targetConnectionId: string | undefined = selectedProfile?.['connectionId'] ?? undefined;
    if (selectedProfile === undefined || selectedProfile['connectionId'] === null) {
      targetConnectionId = connections.find((connection): boolean => connection['default'])?.['id'];
    }
    const targetConnectionName: string = connections.find(
      (connection): boolean => connection['id'] === targetConnectionId,
    )?.['name'] ?? 'The selected connection';

    setBusy(true);
    setProfileMoveResults([]);
    try {
      const response: Web_Api_SetTorrentProfileResponse = await onSetProfile({
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
  };

  /**
   * Torrent Detail - Resolves an ambiguous profile match.
   *
   * Applies the selected profile's labels and limits, then leaves move outcomes in
   * the dialog using the same result rows as an ordinary profile change.
   *
   * @since UNRELEASED
   */
  const resolveTorrentProfile = async (selectedProfileId: string | null): Promise<void> => {
    if (detail === null) {
      return;
    }

    setBusy(true);
    setResolutionError('');
    try {
      const response: Web_Api_SetTorrentProfileResponse = await onSetProfile({
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
  };

  /**
   * Torrent Detail - Set all files.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const setAllFiles = (wanted: boolean): void => {
    setFileDrafts((currentDrafts: Web_Components_TorrentFileDrafts): Web_Components_TorrentFileDrafts => {
      const nextDrafts: Web_Components_TorrentFileDrafts = {};
      for (const [
        index,
        draft,
      ] of Object.entries(currentDrafts)) {
        Reflect.set(nextDrafts, Number(index), {
          ...draft,
          wanted,
        });
      }

      return nextDrafts;
    });
  };

  /**
   * Torrent Detail - Set all priorities.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const setAllPriorities = (priority: -1 | 0 | 1): void => {
    setFileDrafts((currentDrafts: Web_Components_TorrentFileDrafts): Web_Components_TorrentFileDrafts => {
      const nextDrafts: Web_Components_TorrentFileDrafts = {};
      for (const [
        index,
        draft,
      ] of Object.entries(currentDrafts)) {
        Reflect.set(nextDrafts, Number(index), {
          ...draft,
          priority,
        });
      }

      return nextDrafts;
    });
  };

  useEscapeKey(onClose, !resolutionOpen);

  const tabLabels: Record<Web_Components_TorrentDetail_Tab, string> = {
    files: 'Files',
    options: 'Options',
    overview: 'Overview',
    peers: 'Peers',
    trackers: 'Trackers',
  };
  const assignedProfile: Web_Api_TorrentProfile | undefined = profiles.find(
    (profile: Web_Api_TorrentProfile): boolean => profile['id'] === detail?.['profileId'],
  );
  const detailConnection = connections.find((connection): boolean => connection['id'] === detail?.['connectionId']);
  const selectedProfile = profiles.find((profile: Web_Api_TorrentProfile): boolean => profile['id'] === profileId);
  const defaultConnection = connections.find((connection): boolean => connection['default']);
  const selectedProfileData: Web_Api_DefaultTorrentProfile | Web_Api_TorrentProfile = selectedProfile ?? defaultProfile;
  const selectedProfileConnectionID: string | undefined = (
    !('connectionId' in selectedProfileData) || selectedProfileData['connectionId'] === null
  ) ? defaultConnection?.['id'] : selectedProfileData['connectionId'];
  const selectedProfileConnection = connections.find((connection): boolean => connection['id'] === selectedProfileConnectionID);
  const selectedProfileChanged: boolean = profileId !== (detail?.['profileId'] ?? '')
    || selectedProfileData['downloadDirectory'] !== detail?.['downloadDir']
    || selectedProfileConnectionID !== detail?.['connectionId'];
  const profileChangeHint: string = describeTorrentProfileChange(
    selectedProfileData['downloadDirectory'],
    detail?.['connectionId'],
    selectedProfileConnectionID,
    selectedProfileConnection?.['name'] ?? 'the profile connection',
  );
  const renameAvailable: boolean = detail !== null
    && detail['metadataPercentComplete'] >= 1
    && detail['name'].trim() !== ''
    && (detail['files']?.length ?? 0) > 0;
  const resolutionProfileIDs: string[] = detail?.['needsProfile']?.['profileIds'] ?? [];
  const matchingResolutionProfiles: Web_Api_TorrentProfile[] = profiles.filter(
    (candidate: Web_Api_TorrentProfile): boolean => resolutionProfileIDs.includes(candidate['id']),
  );
  const resolutionAllowsAnyProfile: boolean = resolutionProfileIDs.length === 0
    || matchingResolutionProfiles.length === 0;
  const resolutionProfiles: Web_Api_TorrentProfile[] = (resolutionAllowsAnyProfile) ? profiles : matchingResolutionProfiles;

  return (
    <>
      <button aria-label="Close torrent details" className="detail-scrim" onClick={onClose} type="button" />
      <aside className="detail-panel" aria-label="Torrent details">
        <header className="detail-header">
          <div className="detail-title">
            <h2 title={detail?.name}>{detail?.name ?? 'Loading…'}</h2>
            {(detail === null) ? null : (
              <p className={(describeTorrentState(detail)['tone'] === 'error') ? 'torrent-meta torrent-meta-error' : 'torrent-meta'}>
                <span className={`status-dot status-${describeTorrentState(detail)['tone']}`} />
                <span className="torrent-state">{describeTorrentState(detail)['label']}</span>
                <span>{`· queue #${detail['queuePosition'] + 1}`}</span>
                {(describeTrackerIssue(detail) === null) ? null : <span className="torrent-tracker-issue" title={describeTrackerIssue(detail)?.['reply']}>{describeTrackerIssue(detail)?.['label']}</span>}
              </p>
            )}
          </div>
          <button aria-label="Close torrent details" className="icon-button" onClick={onClose} type="button"><Icon name="x" /></button>
        </header>

        {(loading || detail === null) ? (
          <div className="detail-loading">
            <span className="spinner" />
            Loading…
          </div>
        ) : (
          <>
            <div className={`detail-progress status-${describeTorrentState(detail)['tone']}`}>
              <div className="detail-progress-numbers">
                <strong>{formatPercent(detail['percentDone'])}</strong>
                <span>{`${formatBytes(detail['downloadedEver'])} of ${formatBytes(detail['sizeWhenDone'])}`}</span>
              </div>
              <div className="progress"><span style={{ width: formatPercent(detail['percentDone']) }} /></div>
              <div className="detail-rates">
                <span>
                  <Icon name="arrow-down" size={14} />
                  {formatRate(detail['rateDownload'])}
                </span>
                <span>
                  <Icon name="arrow-up" size={14} />
                  {formatRate(detail['rateUpload'])}
                </span>
                <span>{`ETA ${(detail['eta'] >= 0) ? formatDuration(detail['eta']) : '—'}`}</span>
              </div>
            </div>

            <div className="detail-actions" aria-label="Torrent actions">
              {(detail['needsProfile'] === null) ? null : (
                <Button
                  disabled={busy}
                  onClick={(): void => {
                    setResolutionError('');
                    setResolutionResults(null);
                    setResolutionOpen(true);
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
                  onClick={(): void => {
                    void runMutation(async (): Promise<void> => onAction('start', [detail['hashString']]), 'Started.');
                  }}
                >
                  Start
                </Button>
              ) : (
                <Button
                  disabled={busy}
                  icon="pause"
                  onClick={(): void => {
                    void runMutation(async (): Promise<void> => onAction('stop', [detail['hashString']]), 'Paused.');
                  }}
                >
                  Pause
                </Button>
              )}
              <Button
                disabled={busy}
                icon="check"
                onClick={(): void => {
                  void runMutation(async (): Promise<void> => onAction('verify', [detail['hashString']]), 'Verifying local data.');
                }}
              >
                Verify
              </Button>
              <Button
                disabled={busy}
                icon="refresh"
                onClick={(): void => {
                  void runMutation(async (): Promise<void> => onAction('reannounce', [detail['hashString']]), 'Asked trackers for more peers.');
                }}
              >
                Reannounce
              </Button>
            </div>

            <div className="detail-tabs" role="tablist">
              {(Object.keys(tabLabels) as Web_Components_TorrentDetail_Tab[]).sort((left, right): number => (
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
              )).map((item: Web_Components_TorrentDetail_Tab): ReactElement => (
                <button aria-selected={tab === item} key={item} onClick={(): void => setTab(item)} role="tab" type="button">{tabLabels[item]}</button>
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
                    <dd className="profile-derived-value">{detailConnection?.['name'] ?? detail['connectionId']}</dd>
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
                        onClick={(): void => {
                          if (detail['magnetLink'] !== undefined) {
                            void copyText(detail['magnetLink']).then((): void => showToast('Magnet link copied.', true));
                          }
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
                  {(detail['isPrivate']) ? (
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
                      <input onChange={(event): void => setFileQuery(event.currentTarget.value)} placeholder="Filter files" type="search" value={fileQuery} />
                    </label>
                    <button className="text-button" onClick={(): void => setAllFiles(true)} type="button">All</button>
                    <button className="text-button" onClick={(): void => setAllFiles(false)} type="button">None</button>
                    <select
                      aria-label="Set priority for all files"
                      className="select-control"
                      onChange={(event: ChangeEvent<HTMLSelectElement>): void => setAllPriorities(Number(event.currentTarget.value) as -1 | 0 | 1)}
                      value=""
                    >
                      <option value="">Priority for all…</option>
                      <option value="1">High</option>
                      <option value="0">Normal</option>
                      <option value="-1">Low</option>
                    </select>
                  </div>

                  <div className="detail-list" role="table" aria-label="Torrent files">
                    {filteredFiles.map((row: Web_Components_TorrentFileRow): ReactElement => {
                      const draft: Web_Components_TorrentFileDraft = fileDrafts[row['index']] ?? {
                        priority: 0,
                        wanted: true,
                      };
                      const completed: number = row['file']['bytesCompleted'];
                      const length: number = row['file']['length'];
                      const progress: number = (length <= 0) ? 1 : completed / length;

                      return (
                        <div className={(draft['wanted']) ? 'file-row' : 'file-row file-row-unwanted'} key={`${row['file']['name']}-${row['index']}`} role="row">
                          <input
                            aria-label={`Download ${row['file']['name']}`}
                            checked={draft['wanted']}
                            onChange={(event): void => setFileDrafts((currentDrafts: Web_Components_TorrentFileDrafts): Web_Components_TorrentFileDrafts => ({
                              ...currentDrafts,
                              [row['index']]: {
                                ...draft,
                                wanted: event.currentTarget.checked,
                              },
                            }))}
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
                            disabled={!draft['wanted']}
                            onChange={(event: ChangeEvent<HTMLSelectElement>): void => setFileDrafts((currentDrafts: Web_Components_TorrentFileDrafts): Web_Components_TorrentFileDrafts => ({
                              ...currentDrafts,
                              [row['index']]: {
                                ...draft,
                                priority: Number(event.currentTarget.value) as -1 | 0 | 1,
                              },
                            }))}
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
                    <span>{`${Object.values(fileDrafts).filter((draft: Web_Components_TorrentFileDraft): boolean => draft['wanted']).length} of ${Object.keys(fileDrafts).length} files selected`}</span>
                    <Button
                      disabled={busy || Object.keys(fileDrafts).length === 0}
                      onClick={(): void => {
                        void saveFiles();
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
                    {(detail['peers'] ?? []).map((peer: Web_Api_TorrentPeer, index: number): ReactElement => (
                      <tr key={`${peer['address']}-${peer['port']}-${index}`}>
                        <td>
                          <span className="mono">{`${peer['address']}:${peer['port']}`}</span>
                          <small>
                            {[
                              (peer['isEncrypted']) ? 'encrypted' : 'plain',
                              (peer['isIncoming']) ? 'incoming' : 'outgoing',
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
                    {(detail['trackerStats'] ?? []).map((tracker: Web_Api_TorrentTrackerStats): ReactElement => (
                      <div className="tracker-row" key={tracker['id']}>
                        <div className="tracker-row-head">
                          <span className={`status-dot ${(tracker['lastAnnounceSucceeded']) ? 'status-seeding' : 'status-error'}`} />
                          <span className="mono" title={tracker['announce']}>{tracker['host']}</span>
                          <span className="tag">{`tier ${tracker['tier'] + 1}`}</span>
                        </div>
                        <p className={(tracker['lastAnnounceSucceeded']) ? 'tracker-row-result' : 'tracker-row-result tracker-row-failed'}>
                          {tracker['lastAnnounceResult'] || 'No announce yet'}
                        </p>
                        <p className="tracker-row-stats">
                          {`${tracker['seederCount']} seeders · ${tracker['leecherCount']} leechers · ${tracker['downloadCount']} downloads · next announce ${formatDate(tracker['nextAnnounceTime'])}`}
                        </p>
                      </div>
                    ))}
                    {((detail['trackerStats'] ?? []).length === 0) ? <p className="detail-empty">No trackers.</p> : null}
                  </div>
                  <FieldLabel>
                    <span>Tracker list</span>
                    <textarea
                      className="monospace"
                      onChange={(event): void => setTrackerList(event.currentTarget.value)}
                      placeholder={'e.g. https://tracker.example/announce\n\nhttps://backup.example/announce'}
                      rows={7}
                      value={trackerList}
                    />
                    <small>One tracker per line. A blank line starts the next tier.</small>
                  </FieldLabel>
                  <div className="detail-footer">
                    <span />
                    <Button
                      disabled={busy}
                      onClick={(): void => {
                        void saveTrackers();
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
                            onChange={(event): void => {
                              setProfileId(event.currentTarget.value);
                              setProfileMoveResults([]);
                            }}
                            value={profileId}
                          >
                            <option value="">{defaultProfile['name']}</option>
                            {profiles.map((profile: Web_Api_TorrentProfile): ReactElement => (
                              <option key={profile['id']} value={profile['id']}>{profile['name']}</option>
                            ))}
                          </select>
                          <Button
                            disabled={busy}
                            onClick={(): void => {
                              void applyTorrentProfile();
                            }}
                            variant="primary"
                          >
                            Apply
                          </Button>
                        </div>
                        {(selectedProfileChanged) ? <small>{profileChangeHint}</small> : null}
                      </div>
                    </div>
                    <label aria-label="Also apply its labels and limits" className="check-row">
                      <input
                        checked={applyProfileOptions}
                        onChange={(event): void => setApplyProfileOptions(event.currentTarget.checked)}
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
                          {profileMoveResults.map((result): ReactElement => (
                            <li className={(result['result'] === 'failed') ? 'move-failed' : 'move-succeeded'} key={result['hash']}>
                              <strong>{result['name']}</strong>
                              <span className="move-result-copy">
                                <span className="move-result-state">{torrentMoveResultLabel(result)}</span>
                                {result['warnings']?.map((warning): ReactElement => <small key={warning}>{warning}</small>)}
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
                      onChange={(value: string): void => setOptions({
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
                          onChange={(event): void => setOptions({
                            ...options,
                            bandwidthPriority: Number(event.currentTarget.value) as -1 | 0 | 1,
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
                          onChange={(event): void => setOptions({
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
                        onChange={(event): void => setOptions({
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
                            onChange={(event): void => setOptions({
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
                          disabled={!options['downloadLimited']}
                          onChange={(event): void => setOptions({
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
                            onChange={(event): void => setOptions({
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
                          disabled={!options['uploadLimited']}
                          onChange={(event): void => setOptions({
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
                          onChange={(event): void => setOptions({
                            ...options,
                            seedRatioMode: Number(event.currentTarget.value) as 0 | 1 | 2,
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
                          onChange={(event): void => setOptions({
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
                          onChange={(event): void => setOptions({
                            ...options,
                            seedIdleMode: Number(event.currentTarget.value) as 0 | 1 | 2,
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
                          onChange={(event): void => setOptions({
                            ...options,
                            seedIdleLimit: Number(event.currentTarget.value),
                          })}
                          type="number"
                          value={options['seedIdleLimit']}
                        />
                      </FieldLabel>
                    </div>
                    <p className="form-section-note">
                      {`${assignedProfile?.['name'] ?? defaultProfile['name']} supplies the defaults, so each option can be custom or never stop.`}
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
                        disabled={!renameAvailable}
                        onChange={(event): void => setRenameName(event.currentTarget.value)}
                        type="text"
                        value={renameName}
                      />
                      {(renameAvailable) ? null : <small>Available once the torrent&apos;s metadata has downloaded.</small>}
                    </FieldLabel>
                    <div className="detail-footer">
                      <span />
                      <Button disabled={busy || !renameAvailable || renameName.trim() === detail['name'] || renameName.trim() === ''} type="submit">Rename</Button>
                    </div>
                  </form>
                </div>
              ) : null}
            </div>
          </>
        )}
      </aside>
      {(!resolutionOpen || detail === null) ? null : (
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
                onClick={(): void => setResolutionOpen(false)}
                type="button"
              >
                <Icon name="x" />
              </button>
            </div>
            {(resolutionResults === null) ? (
              <>
                <p>{(resolutionAllowsAnyProfile) ? 'The original matches are no longer available. Choose any profile.' : 'Choose the profile this torrent belongs to.'}</p>
                <div className="profile-resolution-list">
                  {(resolutionAllowsAnyProfile) ? (
                    <button
                      disabled={busy}
                      onClick={(): void => {
                        void resolveTorrentProfile(null);
                      }}
                      type="button"
                    >
                      <strong>{defaultProfile['name']}</strong>
                    </button>
                  ) : null}
                  {resolutionProfiles.map((candidate: Web_Api_TorrentProfile): ReactElement => {
                    const matchingPattern: string = candidate['matchPatterns'].find(
                      (pattern: string): boolean => torrentNameMatchesPattern(detail['name'], pattern),
                    ) ?? candidate['matchPatterns'][0] ?? 'No current matching pattern';

                    return (
                      <button
                        disabled={busy}
                        key={candidate['id']}
                        onClick={(): void => {
                          void resolveTorrentProfile(candidate['id']);
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
                  <Button disabled={busy} onClick={(): void => setResolutionOpen(false)}>Cancel</Button>
                </div>
              </>
            ) : (
              <>
                <div className="torrent-move-results">
                  <ul>
                    {resolutionResults.map((result: Web_Api_MovedTorrent): ReactElement => (
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
                  <Button onClick={(): void => setResolutionOpen(false)} variant="primary">Done</Button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
};
