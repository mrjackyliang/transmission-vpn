import {
  describe,
  expect,
  it,
} from 'vitest';

import { formatPercent } from '../src/web/torrent-format.ts';
import {
  buildTorrentLabelSummaries,
  describeTorrentState,
  describeTrackerIssue,
  duplicateTorrentNotices,
  finishedFilesLeftOut,
  summarizeTorrentAddBatch,
  torrentHasFinishedFiles,
  torrentMatchesFilter,
  torrentMatchesLibrarySelection,
  torrentProgress,
  torrentQueuePositionsAreComparable,
} from '../src/web/torrent-library.ts';

import type {
  Tests_Web_TorrentLibrary_CheckingTorrent,
  Tests_Web_TorrentLibrary_CreateConnection_Id,
  Tests_Web_TorrentLibrary_CreateConnection_Name,
  Tests_Web_TorrentLibrary_CreateConnection_Returns,
  Tests_Web_TorrentLibrary_CreateConnection_Slot,
  Tests_Web_TorrentLibrary_CreateTorrent_Changes,
  Tests_Web_TorrentLibrary_CreateTorrent_DownloadDirectory,
  Tests_Web_TorrentLibrary_CreateTorrent_Identifier,
  Tests_Web_TorrentLibrary_CreateTorrent_Labels,
  Tests_Web_TorrentLibrary_CreateTorrent_Returns,
  Tests_Web_TorrentLibrary_CreateTorrent_TotalSize,
  Tests_Web_TorrentLibrary_DefaultProfileTorrent,
  Tests_Web_TorrentLibrary_DownloadingTorrent,
  Tests_Web_TorrentLibrary_ErrorTorrent,
  Tests_Web_TorrentLibrary_Finished,
  Tests_Web_TorrentLibrary_FirstTorrent,
  Tests_Web_TorrentLibrary_Hash,
  Tests_Web_TorrentLibrary_LocalError,
  Tests_Web_TorrentLibrary_NewYorkTorrent,
  Tests_Web_TorrentLibrary_OrdinaryPausedTorrent,
  Tests_Web_TorrentLibrary_OtherConnectionTorrent,
  Tests_Web_TorrentLibrary_ProfiledTorrent,
  Tests_Web_TorrentLibrary_SameConnectionTorrent,
  Tests_Web_TorrentLibrary_TorontoTorrent,
  Tests_Web_TorrentLibrary_Torrents,
  Tests_Web_TorrentLibrary_TrackerError,
  Tests_Web_TorrentLibrary_UnresolvedTorrent,
  Tests_Web_TorrentLibrary_VerifyingTorrent,
  Tests_Web_TorrentLibrary_WarningTorrent,
} from '../src/types/tests/web/torrent-library.test.d.ts';

const createTorrent = (
  identifier: Tests_Web_TorrentLibrary_CreateTorrent_Identifier,
  downloadDirectory: Tests_Web_TorrentLibrary_CreateTorrent_DownloadDirectory,
  totalSize: Tests_Web_TorrentLibrary_CreateTorrent_TotalSize,
  labels: Tests_Web_TorrentLibrary_CreateTorrent_Labels = [],
  changes: Tests_Web_TorrentLibrary_CreateTorrent_Changes = {},
): Tests_Web_TorrentLibrary_CreateTorrent_Returns => ({
  activityDate: 0,
  addedDate: 0,
  connectionId: 'vpc-0000000000000000',
  downloadDir: downloadDirectory,
  downloadedEver: 0,
  error: 0,
  errorString: '',
  eta: 0,
  hashString: `hash-${identifier}`,
  id: identifier,
  isFinished: false,
  isPrivate: false,
  isStalled: false,
  labels,
  leftUntilDone: totalSize,
  metadataPercentComplete: 1,
  name: `Torrent ${identifier}`,
  needsProfile: null,
  peersConnected: 0,
  peersGettingFromUs: 0,
  peersSendingToUs: 0,
  percentDone: 0,
  profileId: null,
  queuePosition: identifier,
  rateDownload: 0,
  rateUpload: 0,
  recheckProgress: 0,
  sizeWhenDone: totalSize,
  status: 0,
  totalSize,
  uploadedEver: 0,
  uploadRatio: 0,
  ...changes,
});

const createConnection = (id: Tests_Web_TorrentLibrary_CreateConnection_Id, name: Tests_Web_TorrentLibrary_CreateConnection_Name, slot: Tests_Web_TorrentLibrary_CreateConnection_Slot): Tests_Web_TorrentLibrary_CreateConnection_Returns => ({
  changeRunning: false,
  createdAt: '2026-11-01T12:00:00Z',
  daemon: {
    bindAddress: `10.64.${String(slot)}.2`,
    peerPort: 51_413 + slot,
    rpcPort: 9092 + slot,
    state: 'ready',
  },
  default: slot === 0,
  dnsServers: [],
  enabled: true,
  endpointStrategy: 'sticky',
  id,
  name,
  needsSetup: false,
  peerPort: 51_413 + slot,
  profileIds: ['profile'],
  providerId: 'custom',
  retryIntervalSeconds: 10,
  revision: 1,
  savedCredentials: [],
  runtime: {
    address: `10.31.${String(slot)}.2`,
    attempt: 1,
    endpointCount: 1,
    endpointPosition: 1,
    endpointStrategy: 'sticky',
    interface: `tun${String(slot)}`,
    lastError: '',
    profileId: 'profile',
    providerId: 'custom',
    remoteHost: 'vpn.example.com',
    remotePort: 1194,
    state: 'protected',
    transitionedAt: '2026-11-01T12:00:00Z',
    tunnel: 'openvpn',
  },
  slot,
  torrentCount: 1,
  tunnel: 'openvpn',
  updatedAt: '2026-11-01T12:00:00Z',
});

describe('torrent library organization', () => {
  it('names all-success, mixed, and all-failed add batches', () => {
    expect(summarizeTorrentAddBatch([
      'added',
      'duplicate',
    ])).toStrictEqual({
      detail: '2 torrents added.',
      title: 'Torrents added',
    });

    expect(summarizeTorrentAddBatch([
      'added',
      'failed',
    ])).toStrictEqual({
      detail: '1 added · 1 failed.',
      title: 'Some torrents weren\'t added',
    });

    expect(summarizeTorrentAddBatch([
      'failed',
      'failed',
    ])).toStrictEqual({
      detail: '2 torrents failed.',
      title: 'No torrents were added',
    });

    return;
  });

  it('summarizes labels and separates warnings, errors, and checking states', () => {
    const warningTorrent: Tests_Web_TorrentLibrary_WarningTorrent = createTorrent(1, '/data/downloads', 100, ['movies'], { error: 1 });
    const errorTorrent: Tests_Web_TorrentLibrary_ErrorTorrent = createTorrent(2, '/data/downloads', 200, [
      'movies',
      'archive',
    ], { error: 3 });
    const checkingTorrent: Tests_Web_TorrentLibrary_CheckingTorrent = createTorrent(3, '/data/downloads', 300, ['archive'], { status: 2 });

    expect(buildTorrentLabelSummaries([
      warningTorrent,
      errorTorrent,
      checkingTorrent,
    ])).toEqual([
      {
        count: 2,
        label: 'archive',
        saved: false,
        size: 500,
      },
      {
        count: 2,
        label: 'movies',
        saved: false,
        size: 300,
      },
    ]);

    expect(torrentMatchesFilter(warningTorrent, 'warning')).toBe(true);

    expect(torrentMatchesFilter(warningTorrent, 'error')).toBe(false);

    expect(torrentMatchesFilter(errorTorrent, 'error')).toBe(true);

    expect(torrentMatchesFilter(checkingTorrent, 'checking')).toBe(true);

    return;
  });

  it('keeps a downloading state when only its tracker reports a problem', () => {
    const trackerError: Tests_Web_TorrentLibrary_TrackerError = createTorrent(1, '/data/downloads', 100, [], {
      error: 2,
      errorString: 'torrent not found',
      status: 4,
    });
    const localError: Tests_Web_TorrentLibrary_LocalError = createTorrent(2, '/data/downloads', 100, [], {
      error: 3,
      errorString: 'No data found',
      status: 0,
    });

    expect(describeTorrentState(trackerError)).toEqual({
      label: 'Downloading',
      tone: 'downloading',
    });

    expect(describeTrackerIssue(trackerError)).toEqual({
      label: 'Tracker not working',
      reply: 'The tracker replied “torrent not found”.',
    });

    expect(torrentMatchesFilter(trackerError, 'warning')).toBe(true);

    expect(torrentMatchesFilter(trackerError, 'error')).toBe(false);

    expect(describeTorrentState(localError)).toEqual({
      label: 'No data found',
      tone: 'error',
    });

    expect(describeTrackerIssue(localError)).toBeNull();

    expect(torrentMatchesFilter(localError, 'error')).toBe(true);

    return;
  });

  it('shows the check on the progress bar while verifying, matching the label', () => {
    const verifyingTorrent: Tests_Web_TorrentLibrary_VerifyingTorrent = createTorrent(1, '/data/downloads', 100, [], {
      percentDone: 0.444,
      recheckProgress: 0.456,
      status: 2,
    });
    const downloadingTorrent: Tests_Web_TorrentLibrary_DownloadingTorrent = createTorrent(2, '/data/downloads', 100, [], {
      percentDone: 0.444,
      recheckProgress: 0,
      status: 4,
    });

    expect(torrentProgress(verifyingTorrent)).toBe(0.456);

    expect(describeTorrentState(verifyingTorrent)['label']).toBe(`Verifying ${formatPercent(torrentProgress(verifyingTorrent))}`);

    expect(describeTorrentState(verifyingTorrent)['label']).toBe('Verifying 46%');

    expect(torrentProgress(downloadingTorrent)).toBe(0.444);

    return;
  });

  it('offers a torrent\'s files only once nothing is left to download', () => {
    const finished: Tests_Web_TorrentLibrary_Finished = createTorrent(1, '/data/downloads', 100, [], {
      leftUntilDone: 0,
      percentDone: 1,
    });

    expect(torrentHasFinishedFiles(finished)).toBe(true);

    expect(torrentHasFinishedFiles(createTorrent(2, '/data/downloads', 100, [], { leftUntilDone: 1 }))).toBe(false);

    expect(torrentHasFinishedFiles({
      ...finished,
      metadataPercentComplete: 0.5,
    })).toBe(false);

    expect(torrentHasFinishedFiles(createTorrent(3, '/data/downloads', 0, [], { leftUntilDone: 0 }))).toBe(false);

    return;
  });

  it('says which torrents a download of finished files left out', () => {
    expect(finishedFilesLeftOut(0, 0)).toBe('');

    expect(finishedFilesLeftOut(1, 0)).toBe('1 torrent hasn\'t finished downloading, so it was left out.');

    expect(finishedFilesLeftOut(2, 0)).toBe('2 torrents haven\'t finished downloading, so they were left out.');

    expect(finishedFilesLeftOut(0, 1)).toBe('1 torrent\'s files couldn\'t be read, so it was left out.');

    expect(finishedFilesLeftOut(1, 2)).toBe('1 torrent hasn\'t finished downloading, and 2 torrents\' files couldn\'t be read, so they were left out.');

    return;
  });

  it('filters unresolved profile choices independently of pause state', () => {
    const unresolvedTorrent: Tests_Web_TorrentLibrary_UnresolvedTorrent = createTorrent(1, '/data/downloads', 100, [], {
      needsProfile: {
        profileIds: [
          'tpr-0000000000000001',
          'tpr-0000000000000002',
        ],
      },
      status: 0,
    });
    const ordinaryPausedTorrent: Tests_Web_TorrentLibrary_OrdinaryPausedTorrent = createTorrent(2, '/data/downloads', 100);

    expect(torrentMatchesFilter(unresolvedTorrent, 'needs-profile')).toBe(true);

    expect(torrentMatchesFilter(unresolvedTorrent, 'paused')).toBe(true);

    expect(torrentMatchesFilter(ordinaryPausedTorrent, 'needs-profile')).toBe(false);

    return;
  });

  it('keeps saved labels visible before torrents use them', () => {
    expect(buildTorrentLabelSummaries([], ['Archive'])).toEqual([{
      count: 0,
      label: 'Archive',
      saved: true,
      size: 0,
    }]);

    return;
  });

  it('filters torrents by a named or Default profile', () => {
    const profiledTorrent: Tests_Web_TorrentLibrary_ProfiledTorrent = createTorrent(1, '/data/downloads', 100, [], {
      profileId: 'tpr-0000000000000001',
    });
    const defaultProfileTorrent: Tests_Web_TorrentLibrary_DefaultProfileTorrent = createTorrent(2, '/data/downloads', 100);

    expect(torrentMatchesLibrarySelection(profiledTorrent, {
      kind: 'profile',
      value: 'tpr-0000000000000001',
    })).toBe(true);

    expect(torrentMatchesLibrarySelection(defaultProfileTorrent, {
      kind: 'profile',
      value: null,
    })).toBe(true);

    expect(torrentMatchesLibrarySelection(profiledTorrent, {
      kind: 'profile',
      value: null,
    })).toBe(false);

    return;
  });

  it('filters torrents by their VPN connection', () => {
    const torontoTorrent: Tests_Web_TorrentLibrary_TorontoTorrent = createTorrent(1, '/data/downloads', 100);
    const newYorkTorrent: Tests_Web_TorrentLibrary_NewYorkTorrent = createTorrent(2, '/data/downloads', 100, [], {
      connectionId: 'vpc-0000000000000001',
    });

    expect(torrentMatchesLibrarySelection(torontoTorrent, {
      kind: 'connection',
      value: 'vpc-0000000000000000',
    })).toBe(true);

    expect(torrentMatchesLibrarySelection(newYorkTorrent, {
      kind: 'connection',
      value: 'vpc-0000000000000000',
    })).toBe(false);

    return;
  });

  it('shows comparable queue positions for any visible single-connection set', () => {
    const firstTorrent: Tests_Web_TorrentLibrary_FirstTorrent = createTorrent(1, '/data/downloads', 100);
    const sameConnectionTorrent: Tests_Web_TorrentLibrary_SameConnectionTorrent = createTorrent(2, '/data/profile', 100);
    const otherConnectionTorrent: Tests_Web_TorrentLibrary_OtherConnectionTorrent = createTorrent(3, '/data/downloads', 100, [], {
      connectionId: 'vpc-0000000000000001',
    });

    expect(torrentQueuePositionsAreComparable([])).toBe(true);

    expect(torrentQueuePositionsAreComparable([firstTorrent])).toBe(true);

    expect(torrentQueuePositionsAreComparable([
      firstTorrent,
      sameConnectionTorrent,
    ])).toBe(true);

    expect(torrentQueuePositionsAreComparable([
      firstTorrent,
      otherConnectionTorrent,
    ])).toBe(false);

    return;
  });

  it('turns duplicate hash errors into one named notice without changing the list', () => {
    const hash: Tests_Web_TorrentLibrary_Hash = 'a'.repeat(40);
    const torrents: Tests_Web_TorrentLibrary_Torrents = [
      createTorrent(1, '/data/downloads', 100, [], {
        hashString: hash,
        name: 'Ubuntu 26.10',
      }),
      createTorrent(16_777_217, '/data/downloads', 100, [], {
        connectionId: 'vpc-0000000000000001',
        hashString: hash,
        name: 'Ubuntu 26.10',
      }),
    ];

    expect(duplicateTorrentNotices(
      [
        `duplicate-torrent:${hash}`,
        `duplicate-torrent:${hash}`,
      ],
      torrents,
      [
        createConnection('vpc-0000000000000000', 'PIA Toronto', 0),
        createConnection('vpc-0000000000000001', 'Mullvad New York', 1),
      ],
    )).toEqual(['“Ubuntu 26.10” appears on PIA Toronto and Mullvad New York.']);

    expect(torrents).toHaveLength(2);

    return;
  });

  return;
});
