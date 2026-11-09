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

describe('API response schemas', (): void => {
  it('parses blocklist status and normalizes a null source list', async (): Promise<void> => {
    vi.stubGlobal('fetch', async (): Promise<Response> => new Response(JSON.stringify({
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
      const status = await getBlocklistStatus();

      expect(status).toMatchObject({
        sources: [],
        state: 'no-sources',
        totalRanges: 0,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('accepts the empty 202 blocklist update response', async (): Promise<void> => {
    let requestMethod: string = '';
    let requestPath: string = '';
    vi.stubGlobal('document', { cookie: '' });
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, options: RequestInit = {}): Promise<Response> => {
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
  });

  it('accepts a no-content directory deletion response', async (): Promise<void> => {
    let requestMethod: string = '';
    let requestPath: string = '';
    vi.stubGlobal('document', { cookie: '' });
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, options: RequestInit = {}): Promise<Response> => {
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
  });

  it('confirms profile deletion and parses per-torrent move results', async (): Promise<void> => {
    const hash: string = 'c'.repeat(40);
    const profileId: string = 'tpr-0123456789abcdef';
    let requestBody: Record<string, unknown> = {};
    let requestMethod: string = '';
    vi.stubGlobal('document', { cookie: '' });
    vi.stubGlobal('fetch', async (_input: RequestInfo | URL, options: RequestInit = {}): Promise<Response> => {
      requestBody = JSON.parse(String(options.body ?? '{}')) as Record<string, unknown>;
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
      const result = await deleteTorrentProfile(profileId, true);

      expect(requestMethod).toBe('DELETE');
      expect(requestBody).toEqual({ moveTorrents: true });
      expect(result['moved'][0]).toMatchObject({
        hash,
        result: 'failed',
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('confirms a default connection change and parses per-torrent move results', async (): Promise<void> => {
    const connectionId: string = 'vpc-fedcba9876543210';
    const hash: string = 'd'.repeat(40);
    let requestBody: Record<string, unknown> = {};
    let requestMethod: string = '';
    vi.stubGlobal('document', { cookie: '' });
    vi.stubGlobal('fetch', async (_input: RequestInfo | URL, options: RequestInit = {}): Promise<Response> => {
      requestBody = JSON.parse(String(options.body ?? '{}')) as Record<string, unknown>;
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
      const result = await setDefaultVPNConnection({
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
  });

  it('parses purpose-aware directory entries and normalizes null tags', async (): Promise<void> => {
    vi.stubGlobal('fetch', async (): Promise<Response> => new Response(JSON.stringify({
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
      const directory = await getDirectory('/data', 'incomplete');

      expect(directory.directories[0]).toMatchObject({
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
  });

  it('normalizes a null directory list to an empty array', async (): Promise<void> => {
    vi.stubGlobal('fetch', async (): Promise<Response> => new Response(JSON.stringify({
      directories: null,
      downloadAllowed: false,
      path: '/data',
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    }));

    try {
      const directory = await getDirectory('/data', 'download');

      expect(directory.directories).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('treats null response lists as empty arrays', async (): Promise<void> => {
    vi.stubGlobal('fetch', async (): Promise<Response> => new Response(JSON.stringify({
      labels: null,
      revision: 0,
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    }));

    try {
      const organization = await getTorrentOrganization();

      expect(organization.labels).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('accepts the multi-connection list and capacity contract', async (): Promise<void> => {
    vi.stubGlobal('fetch', async (): Promise<Response> => new Response(JSON.stringify({
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
      const response = await getVPNConnections();

      expect(response.capacity).toMatchObject({
        limit: 8,
        used: 1,
      });
      expect(response.connections[0]).toMatchObject({
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
  });

  it('sends stable hashes for every torrent mutation shape', async (): Promise<void> => {
    const hash: string = 'a'.repeat(40);
    const requests: {
      body: Record<string, unknown>
      method: string
      path: string
    }[] = [];
    vi.stubGlobal('document', { cookie: '' });
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, options: RequestInit = {}): Promise<Response> => {
      const path: string = String(input);
      const body: Record<string, unknown> = JSON.parse(String(options.body ?? '{}')) as Record<string, unknown>;
      requests.push({
        body,
        method: options.method ?? 'GET',
        path,
      });
      if (path === '/api/v1/torrents/remove') {
        return new Response(null, { status: 204 });
      }
      let responseBody: Record<string, unknown> = { hashes: [hash] };
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
        expect(request.body).toMatchObject({ hashes: [hash] });
        expect(request.body).not.toHaveProperty('ids');
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('accepts warnings on every per-torrent move response', async (): Promise<void> => {
    const hash: string = 'b'.repeat(40);
    const connectionId: string = 'vpc-0123456789abcdef';
    const profileId: string = 'tpr-0123456789abcdef';
    const warning: string = 'The torrent moved, but its restart could not be confirmed.';
    const moved = [{
      hash,
      name: 'Example torrent',
      result: 'moved' as const,
      warnings: [warning],
    }];
    const profileInput = {
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
    vi.stubGlobal('fetch', async (input: RequestInfo | URL): Promise<Response> => {
      const path: string = String(input);
      let body: Record<string, unknown> = {};
      if (path.startsWith('/api/v1/vpn/connections/')) {
        body = {
          logins: 0,
          moved,
          profiles: 0,
        };
      } else if (path.startsWith('/api/v1/torrent-profiles/')) {
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
      const removal = await deleteVPNConnection(connectionId, { moveTo: 'vpc-fedcba9876543210' });
      const profile = await updateTorrentProfile(profileId, profileInput, true);
      const assignment = await setTorrentProfile({
        applyOptions: true,
        hashes: [hash],
        profileId,
      });

      expect(removal.moved[0]?.warnings).toEqual([warning]);
      expect(profile.moved[0]?.warnings).toEqual([warning]);
      expect(assignment.moved[0]).toMatchObject({
        result: 'moved',
        warnings: [warning],
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('accepts a web proxy login whose stored connection is missing', async (): Promise<void> => {
    vi.stubGlobal('fetch', async (): Promise<Response> => new Response(JSON.stringify({
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
      const response = await getWebProxy();

      expect(response.logins[0]).toMatchObject({
        connectionId: 'vpc-ffffffffffffffff',
        effectiveConnectionId: 'vpc-0123456789abcdef',
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reads the 1 and 0 Transmission sends for wanted files in a torrent detail', async (): Promise<void> => {
    vi.stubGlobal('fetch', async (): Promise<Response> => new Response(JSON.stringify({
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
      const detail = await getTorrentDetail(16_777_218);

      expect(detail['wanted']).toEqual([
        true,
        false,
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
