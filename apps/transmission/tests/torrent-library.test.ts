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
  Web_Api_Torrent,
  Web_Api_VpnConnection,
} from '../src/types/web/api.d.ts';

const createTorrent = (
  identifier: number,
  downloadDirectory: string,
  totalSize: number,
  labels: string[] = [],
  changes: Partial<Web_Api_Torrent> = {},
): Web_Api_Torrent => ({
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

const createConnection = (id: string, name: string, slot: number): Web_Api_VpnConnection => ({
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

describe('torrent library organization', (): void => {
  it('names all-success, mixed, and all-failed add batches', (): void => {
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
  });

  it('summarizes labels and separates warnings, errors, and checking states', (): void => {
    const warningTorrent = createTorrent(1, '/data/downloads', 100, ['movies'], { error: 1 });
    const errorTorrent = createTorrent(2, '/data/downloads', 200, [
      'movies',
      'archive',
    ], { error: 3 });
    const checkingTorrent = createTorrent(3, '/data/downloads', 300, ['archive'], { status: 2 });

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
  });

  it('keeps a downloading state when only its tracker reports a problem', (): void => {
    const trackerError = createTorrent(1, '/data/downloads', 100, [], {
      error: 2,
      errorString: 'torrent not found',
      status: 4,
    });
    const localError = createTorrent(2, '/data/downloads', 100, [], {
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
  });

  it('shows the check on the progress bar while verifying, matching the label', (): void => {
    const verifyingTorrent = createTorrent(1, '/data/downloads', 100, [], {
      percentDone: 0.444,
      recheckProgress: 0.456,
      status: 2,
    });
    const downloadingTorrent = createTorrent(2, '/data/downloads', 100, [], {
      percentDone: 0.444,
      recheckProgress: 0,
      status: 4,
    });

    expect(torrentProgress(verifyingTorrent)).toBe(0.456);
    expect(describeTorrentState(verifyingTorrent)['label']).toBe(`Verifying ${formatPercent(torrentProgress(verifyingTorrent))}`);
    expect(describeTorrentState(verifyingTorrent)['label']).toBe('Verifying 46%');
    expect(torrentProgress(downloadingTorrent)).toBe(0.444);
  });

  it('offers a torrent\'s files only once nothing is left to download', (): void => {
    const finished = createTorrent(1, '/data/downloads', 100, [], {
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
  });

  it('says which torrents a download of finished files left out', (): void => {
    expect(finishedFilesLeftOut(0, 0)).toBe('');
    expect(finishedFilesLeftOut(1, 0)).toBe('1 torrent hasn\'t finished downloading, so it was left out.');
    expect(finishedFilesLeftOut(2, 0)).toBe('2 torrents haven\'t finished downloading, so they were left out.');
    expect(finishedFilesLeftOut(0, 1)).toBe('1 torrent\'s files couldn\'t be read, so it was left out.');
    expect(finishedFilesLeftOut(1, 2)).toBe('1 torrent hasn\'t finished downloading, and 2 torrents\' files couldn\'t be read, so they were left out.');
  });

  it('filters unresolved profile choices independently of pause state', (): void => {
    const unresolvedTorrent = createTorrent(1, '/data/downloads', 100, [], {
      needsProfile: {
        profileIds: [
          'tpr-0000000000000001',
          'tpr-0000000000000002',
        ],
      },
      status: 0,
    });
    const ordinaryPausedTorrent = createTorrent(2, '/data/downloads', 100);

    expect(torrentMatchesFilter(unresolvedTorrent, 'needs-profile')).toBe(true);
    expect(torrentMatchesFilter(unresolvedTorrent, 'paused')).toBe(true);
    expect(torrentMatchesFilter(ordinaryPausedTorrent, 'needs-profile')).toBe(false);
  });

  it('keeps saved labels visible before torrents use them', (): void => {
    expect(buildTorrentLabelSummaries([], ['Archive'])).toEqual([{
      count: 0,
      label: 'Archive',
      saved: true,
      size: 0,
    }]);
  });

  it('filters torrents by a named or Default profile', (): void => {
    const profiledTorrent = createTorrent(1, '/data/downloads', 100, [], {
      profileId: 'tpr-0000000000000001',
    });
    const defaultProfileTorrent = createTorrent(2, '/data/downloads', 100);

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
  });

  it('filters torrents by their VPN connection', (): void => {
    const torontoTorrent = createTorrent(1, '/data/downloads', 100);
    const newYorkTorrent = createTorrent(2, '/data/downloads', 100, [], {
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
  });

  it('shows comparable queue positions for any visible single-connection set', (): void => {
    const firstTorrent = createTorrent(1, '/data/downloads', 100);
    const sameConnectionTorrent = createTorrent(2, '/data/profile', 100);
    const otherConnectionTorrent = createTorrent(3, '/data/downloads', 100, [], {
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
  });

  it('turns duplicate hash errors into one named notice without changing the list', (): void => {
    const hash: string = 'a'.repeat(40);
    const torrents: Web_Api_Torrent[] = [
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
  });
});
