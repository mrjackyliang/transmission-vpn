/// <reference lib="dom" />

import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  deleteDirectory,
  deleteTorrentProfile,
  deleteVPNConnection,
  getBlocklistStatus,
  getDirectory,
  getTorrentDetail,
  getTorrentOrganization,
  getVPNConnections,
  getWebProxy,
  removeTorrents,
  renameTorrentPath,
  requestBlocklistUpdate,
  runTorrentAction,
  setDefaultVPNConnection,
  setTorrentProfile,
  updateTorrentProfile,
  updateTorrents,
} from '../src/web/api.ts';

import type {
  Tests_Web_Api_Assignment,
  Tests_Web_Api_AssignmentMoved,
  Tests_Web_Api_Body,
  Tests_Web_Api_ConnectionId,
  Tests_Web_Api_DefaultConnection_Result,
  Tests_Web_Api_Detail,
  Tests_Web_Api_Directory,
  Tests_Web_Api_FetchInput,
  Tests_Web_Api_FetchOptions,
  Tests_Web_Api_FetchResponse,
  Tests_Web_Api_Hash,
  Tests_Web_Api_Moved,
  Tests_Web_Api_Organization,
  Tests_Web_Api_Path,
  Tests_Web_Api_Profile,
  Tests_Web_Api_ProfileDeletion_Result,
  Tests_Web_Api_ProfileId,
  Tests_Web_Api_ProfileInput,
  Tests_Web_Api_ProfileMoved,
  Tests_Web_Api_Removal,
  Tests_Web_Api_RemovalMoved,
  Tests_Web_Api_RequestBody,
  Tests_Web_Api_RequestMethod,
  Tests_Web_Api_RequestPath,
  Tests_Web_Api_Requests,
  Tests_Web_Api_ResponseBody,
  Tests_Web_Api_Status,
  Tests_Web_Api_VpnConnections_Response,
  Tests_Web_Api_Warning,
  Tests_Web_Api_WebProxy_Response,
} from '../src/types/tests/web/api.test.d.ts';

describe('API response schemas', () => {
  it('parses blocklist status and normalizes a null source list', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({
      lastAttemptAt: null,
      lastSuccessAt: null,
      nextUpdateAt: null,
      sources: null,
      state: 'no-sources',
      totalRanges: 0,
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    }));

    try {
      const status: Tests_Web_Api_Status = await getBlocklistStatus();

      expect(status).toMatchObject({
        sources: [],
        state: 'no-sources',
        totalRanges: 0,
      });
    } finally {
      vi.unstubAllGlobals();
    }

    return;
  });

  it('accepts the empty 202 blocklist update response', async () => {
    let requestMethod: Tests_Web_Api_RequestMethod = '';
    let requestPath: Tests_Web_Api_RequestPath = '';

    vi.stubGlobal('document', { cookie: '' });
    vi.stubGlobal('fetch', async (input: Tests_Web_Api_FetchInput, options: Tests_Web_Api_FetchOptions = {}): Tests_Web_Api_FetchResponse => {
      requestMethod = options.method ?? 'GET';
      requestPath = String(input);

      return new Response(null, { status: 202 });
    });

    try {
      await expect(requestBlocklistUpdate()).resolves.toBeUndefined();

      expect(requestMethod).toBe('POST');

      expect(requestPath).toBe('/api/v1/blocklists/update');
    } finally {
      vi.unstubAllGlobals();
    }

    return;
  });

  it('accepts a no-content directory deletion response', async () => {
    let requestMethod: Tests_Web_Api_RequestMethod = '';
    let requestPath: Tests_Web_Api_RequestPath = '';

    vi.stubGlobal('document', { cookie: '' });
    vi.stubGlobal('fetch', async (input: Tests_Web_Api_FetchInput, options: Tests_Web_Api_FetchOptions = {}): Tests_Web_Api_FetchResponse => {
      requestMethod = options.method ?? 'GET';
      requestPath = String(input);

      return new Response(null, { status: 204 });
    });

    try {
      await expect(deleteDirectory('/data/empty', 'incomplete')).resolves.toBeUndefined();

      expect(requestMethod).toBe('DELETE');

      expect(requestPath).toBe('/api/v1/storage/directories?path=%2Fdata%2Fempty&purpose=incomplete');
    } finally {
      vi.unstubAllGlobals();
    }

    return;
  });

  it('confirms profile deletion and parses per-torrent move results', async () => {
    const hash: Tests_Web_Api_Hash = 'c'.repeat(40);
    const profileId: Tests_Web_Api_ProfileId = 'tpr-0123456789abcdef';
    let requestBody: Tests_Web_Api_RequestBody = {};
    let requestMethod: Tests_Web_Api_RequestMethod = '';

    vi.stubGlobal('document', { cookie: '' });
    vi.stubGlobal('fetch', async (_input: Tests_Web_Api_FetchInput, options: Tests_Web_Api_FetchOptions = {}): Tests_Web_Api_FetchResponse => {
      requestBody = JSON.parse(String(options.body ?? '{}')) as Tests_Web_Api_RequestBody;
      requestMethod = options.method ?? 'GET';

      return new Response(JSON.stringify({
        moved: [{
          error: 'The target Transmission daemon did not add the torrent.',
          hash,
          name: 'Example torrent',
          result: 'failed',
        }],
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    });

    try {
      const result: Tests_Web_Api_ProfileDeletion_Result = await deleteTorrentProfile(profileId, true);

      expect(requestMethod).toBe('DELETE');

      expect(requestBody).toEqual({ moveTorrents: true });

      expect(result['moved'][0]).toMatchObject({
        hash,
        result: 'failed',
      });
    } finally {
      vi.unstubAllGlobals();
    }

    return;
  });

  it('confirms a default connection change and parses per-torrent move results', async () => {
    const connectionId: Tests_Web_Api_ConnectionId = 'vpc-fedcba9876543210';
    const hash: Tests_Web_Api_Hash = 'd'.repeat(40);
    let requestBody: Tests_Web_Api_RequestBody = {};
    let requestMethod: Tests_Web_Api_RequestMethod = '';

    vi.stubGlobal('document', { cookie: '' });
    vi.stubGlobal('fetch', async (_input: Tests_Web_Api_FetchInput, options: Tests_Web_Api_FetchOptions = {}): Tests_Web_Api_FetchResponse => {
      requestBody = JSON.parse(String(options.body ?? '{}')) as Tests_Web_Api_RequestBody;
      requestMethod = options.method ?? 'GET';

      return new Response(JSON.stringify({
        connections: [],
        moved: [{
          hash,
          name: 'Default profile torrent',
          result: 'moved',
        }],
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    });

    try {
      const result: Tests_Web_Api_DefaultConnection_Result = await setDefaultVPNConnection({
        connectionId,
        moveTorrents: true,
      });

      expect(requestMethod).toBe('PUT');

      expect(requestBody).toEqual({
        connectionId,
        moveTorrents: true,
      });

      expect(result['moved']).toEqual([{
        hash,
        name: 'Default profile torrent',
        result: 'moved',
      }]);
    } finally {
      vi.unstubAllGlobals();
    }

    return;
  });

  it('parses purpose-aware directory entries and normalizes null tags', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({
      directories: [{
        browsable: true,
        deletable: false,
        deleteUnavailableReason: 'Only empty folders can be deleted here.',
        empty: false,
        hasSubfolders: true,
        name: 'films',
        path: '/data/media/films',
        selectable: true,
        tags: null,
        usable: true,
      }],
      downloadAllowed: false,
      downloadUnavailableReason: 'Open a folder inside /data.',
      path: '/data',
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    }));

    try {
      const directory: Tests_Web_Api_Directory = await getDirectory('/data', 'incomplete');

      expect(directory['directories'][0]).toMatchObject({
        browsable: true,
        deletable: false,
        empty: false,
        hasSubfolders: true,
        selectable: true,
        tags: [],
        usable: true,
      });
    } finally {
      vi.unstubAllGlobals();
    }

    return;
  });

  it('normalizes a null directory list to an empty array', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({
      directories: null,
      downloadAllowed: false,
      path: '/data',
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    }));

    try {
      const directory: Tests_Web_Api_Directory = await getDirectory('/data', 'download');

      expect(directory['directories']).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }

    return;
  });

  it('treats null response lists as empty arrays', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({
      labels: null,
      revision: 0,
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    }));

    try {
      const organization: Tests_Web_Api_Organization = await getTorrentOrganization();

      expect(organization['labels']).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }

    return;
  });

  it('accepts the multi-connection list and capacity contract', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({
      capacity: {
        cpus: 4,
        limit: 8,
        memoryBytes: 0,
        source: 'fallback',
        used: 1,
      },
      changeRunning: false,
      connections: [{
        changeRunning: false,
        createdAt: '2026-11-01T12:00:00Z',
        daemon: {
          bindAddress: '10.64.0.2',
          peerPort: 42_370,
          rpcPort: 9092,
          state: 'ready',
        },
        default: true,
        dnsServers: [],
        enabled: true,
        endpointStrategy: 'sticky',
        id: 'vpc-0123456789abcdef',
        name: 'Office',
        needsSetup: false,
        peerPort: 42_370,
        profileIds: ['custom:office:0123456789ab'],
        providerId: 'custom',
        retryIntervalSeconds: 10,
        revision: 3,
        savedCredentials: [
          'username',
          'password',
        ],
        runtime: {
          address: '10.64.0.2',
          attempt: 1,
          endpointCount: 1,
          endpointPosition: 1,
          endpointStrategy: 'sticky',
          interface: 'tun0',
          lastError: '',
          profileId: 'custom:office:0123456789ab',
          providerId: 'custom',
          remoteHost: 'vpn.example.com',
          remotePort: 1194,
          state: 'protected',
          transitionedAt: '2026-11-04T12:00:00Z',
          tunnel: 'openvpn',
        },
        slot: 0,
        torrentCount: 6,
        tunnel: 'openvpn',
        updatedAt: '2026-11-04T12:00:00Z',
      }],
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    }));

    try {
      const response: Tests_Web_Api_VpnConnections_Response = await getVPNConnections();

      expect(response['capacity']).toMatchObject({
        limit: 8,
        used: 1,
      });

      expect(response['connections'][0]).toMatchObject({
        id: 'vpc-0123456789abcdef',
        name: 'Office',
        peerPort: 42_370,
        revision: 3,
        savedCredentials: [
          'username',
          'password',
        ],
        slot: 0,
      });
    } finally {
      vi.unstubAllGlobals();
    }

    return;
  });

  it('sends stable hashes for every torrent mutation shape', async () => {
    const hash: Tests_Web_Api_Hash = 'a'.repeat(40);
    const requests: Tests_Web_Api_Requests = [];

    vi.stubGlobal('document', { cookie: '' });
    vi.stubGlobal('fetch', async (input: Tests_Web_Api_FetchInput, options: Tests_Web_Api_FetchOptions = {}): Tests_Web_Api_FetchResponse => {
      const path: Tests_Web_Api_Path = String(input);
      const body: Tests_Web_Api_Body = JSON.parse(String(options.body ?? '{}')) as Tests_Web_Api_Body;

      requests.push({
        body,
        method: options.method ?? 'GET',
        path,
      });
      if (path === '/api/v1/torrents/remove') {
        return new Response(null, { status: 204 });
      }
      let responseBody: Tests_Web_Api_ResponseBody = { hashes: [hash] };
      if (path === '/api/v1/torrents/actions') {
        responseBody = {
          action: body['action'],
          hashes: [hash],
        };
      } else if (path === '/api/v1/torrents/profile') {
        responseBody = {
          applyOptions: false,
          hashes: [hash],
          moved: [],
          profileId: null,
        };
      } else if (path === '/api/v1/torrents/rename') {
        responseBody = {
          hashes: [hash],
          path: 'Renamed',
        };
      }

      return new Response(JSON.stringify(responseBody), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    });

    try {
      await runTorrentAction('stop', [hash]);
      await updateTorrents([hash], { peerLimit: 50 });
      await renameTorrentPath({
        hashes: [hash],
        name: 'Renamed',
        path: 'Original',
      });
      await setTorrentProfile({
        applyOptions: false,
        hashes: [hash],
        profileId: null,
      });
      await removeTorrents([hash], false);

      expect(requests).toHaveLength(5);

      for (const request of requests) {
        expect(request['body']).toMatchObject({ hashes: [hash] });

        expect(request['body']).not.toHaveProperty('ids');
      }
    } finally {
      vi.unstubAllGlobals();
    }

    return;
  });

  it('accepts warnings on every per-torrent move response', async () => {
    const hash: Tests_Web_Api_Hash = 'b'.repeat(40);
    const connectionId: Tests_Web_Api_ConnectionId = 'vpc-0123456789abcdef';
    const profileId: Tests_Web_Api_ProfileId = 'tpr-0123456789abcdef';
    const warning: Tests_Web_Api_Warning = 'The torrent moved, but its restart could not be confirmed.';
    const moved: Tests_Web_Api_Moved = [{
      hash,
      name: 'Example torrent',
      result: 'moved' as const,
      warnings: [warning],
    }];
    const profileInput: Tests_Web_Api_ProfileInput = {
      connectionId,
      downloadDirectory: '/data/downloads',
      labels: [],
      matchPatterns: [],
      name: 'Examples',
      options: {
        bandwidthPriority: 0 as const,
        downloadLimitKBps: null,
        peerLimit: 50,
        queue: 'normal' as const,
        seeding: {
          idleMinutes: null,
          mode: 'never' as const,
          ratio: null,
        },
        uploadLimitKBps: null,
      },
      startPaused: false,
    };

    vi.stubGlobal('document', { cookie: '' });
    vi.stubGlobal('fetch', async (input: Tests_Web_Api_FetchInput): Tests_Web_Api_FetchResponse => {
      const path: Tests_Web_Api_Path = String(input);
      let body: Tests_Web_Api_Body = {};
      if (path.startsWith('/api/v1/vpn/connections/') === true) {
        body = {
          logins: 0,
          moved,
          profiles: 0,
        };
      } else if (path.startsWith('/api/v1/torrent-profiles/') === true) {
        body = {
          ...profileInput,
          createdAt: '2026-11-05T12:00:00Z',
          id: profileId,
          moved,
          overlaps: [],
          updatedAt: '2026-11-05T12:00:01Z',
        };
      } else {
        body = {
          applyOptions: true,
          hashes: [hash],
          moved,
          profileId,
        };
      }

      return new Response(JSON.stringify(body), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    });

    try {
      const removal: Tests_Web_Api_Removal = await deleteVPNConnection(connectionId, { moveTo: 'vpc-fedcba9876543210' });
      const profile: Tests_Web_Api_Profile = await updateTorrentProfile(profileId, profileInput, true);
      const assignment: Tests_Web_Api_Assignment = await setTorrentProfile({
        applyOptions: true,
        hashes: [hash],
        profileId,
      });
      const removalMoved: Tests_Web_Api_RemovalMoved = removal['moved'][0];
      const profileMoved: Tests_Web_Api_ProfileMoved = profile['moved'][0];
      const assignmentMoved: Tests_Web_Api_AssignmentMoved = assignment['moved'][0];

      expect((removalMoved !== undefined) ? removalMoved['warnings'] : undefined).toEqual([warning]);

      expect((profileMoved !== undefined) ? profileMoved['warnings'] : undefined).toEqual([warning]);

      expect(assignmentMoved).toMatchObject({
        result: 'moved',
        warnings: [warning],
      });
    } finally {
      vi.unstubAllGlobals();
    }

    return;
  });

  it('accepts a web proxy login whose stored connection is missing', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({
      enabled: true,
      logins: [{
        connectionId: 'vpc-ffffffffffffffff',
        effectiveConnectionId: 'vpc-0123456789abcdef',
        id: 'wpl-0123456789abcdef',
        passwordSet: true,
        username: 'living-room',
      }],
      port: 22_605,
      state: 'listening',
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    }));

    try {
      const response: Tests_Web_Api_WebProxy_Response = await getWebProxy();

      expect(response['logins'][0]).toMatchObject({
        connectionId: 'vpc-ffffffffffffffff',
        effectiveConnectionId: 'vpc-0123456789abcdef',
      });
    } finally {
      vi.unstubAllGlobals();
    }

    return;
  });

  it('reads the 1 and 0 Transmission sends for wanted files in a torrent detail', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({
      activityDate: 0,
      addedDate: 0,
      connectionId: 'vpc-0123456789abcdef',
      downloadDir: '/data',
      downloadedEver: 0,
      error: 0,
      errorString: '',
      eta: -1,
      hashString: '0ee16262f2e1d7e11c3aa76e1520b6580b7cbf0d',
      id: 16_777_218,
      isFinished: false,
      isPrivate: false,
      isStalled: false,
      labels: [],
      leftUntilDone: 1,
      metadataPercentComplete: 1,
      name: 'example.iso',
      needsProfile: null,
      peersConnected: 0,
      peersGettingFromUs: 0,
      peersSendingToUs: 0,
      percentDone: 0.5,
      priorities: [
        0,
        0,
      ],
      profileId: null,
      queuePosition: 0,
      rateDownload: 0,
      rateUpload: 0,
      recheckProgress: 0,
      sizeWhenDone: 2,
      status: 4,
      totalSize: 2,
      uploadedEver: 0,
      uploadRatio: 0,
      wanted: [
        1,
        0,
      ],
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    }));

    try {
      const detail: Tests_Web_Api_Detail = await getTorrentDetail(16_777_218);

      expect(detail['wanted']).toEqual([
        true,
        false,
      ]);
    } finally {
      vi.unstubAllGlobals();
    }

    return;
  });

  return;
});
