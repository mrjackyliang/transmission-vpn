import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  parseAddTorrentInput,
  parseClaimInput,
  parseCreateDirectoryInput,
  parseCreateVpnConnectionInput,
  parseDeleteVpnConnectionInput,
  parseLoginInput,
  parseRenameTorrentPathInput,
  parseRPCLoginInput,
  parseSetDefaultVpnConnectionInput,
  parseTorrentProfileInput,
  parseUpdateRPCLoginInput,
  parseUpdateSettingsInput,
  parseUpdateTorrentOrganizationInput,
  parseUpdateTorrentProfileInput,
  parseUpdateTorrentsInput,
  parseUpdateVpnConnectionInput,
  parseUpdateWebProxyLoginInput,
  parseVPNConnectionInput,
  parseWebProxyLoginInput,
  validateProviderCredentials,
} from '../src/web/form-validation.ts';

import type { Web_Api_ProviderTunnel } from '../src/types/web/api.d.ts';

describe('form validation', (): void => {
  it('normalizes authentication fields and enforces account policy', (): void => {
    expect(parseClaimInput({
      claimCode: ' ABCDE-23456-FGHIJ ',
      password: 'a secure local password',
      username: ' administrator ',
    })).toEqual({
      claimCode: 'ABCDE-23456-FGHIJ',
      password: 'a secure local password',
      username: 'administrator',
    });
    expect((): void => {
      parseClaimInput({
        claimCode: 'short',
        password: 'short',
        username: '_invalid',
      });
    }).toThrow();
    expect((): void => {
      parseLoginInput({
        password: '',
        username: '',
      });
    }).toThrow('Enter your username.');
  });

  it('requires one safe torrent source and valid organization values', (): void => {
    expect(parseAddTorrentInput({
      filename: 'magnet:?xt=urn:btih:abcdef',
      labels: ['Archive'],
      paused: true,
    })).toMatchObject({
      filename: 'magnet:?xt=urn:btih:abcdef',
    });
    expect((): void => {
      parseAddTorrentInput({
        filename: 'file:///tmp/example.torrent',
      });
    }).toThrow('Enter a valid HTTP, HTTPS, or magnet URL.');
    expect((): void => {
      parseAddTorrentInput({
        filename: 'https://example.com/example.torrent',
        metainfo: 'YWJj',
      });
    }).toThrow('Provide exactly one torrent URL, magnet link, or .torrent file.');
    expect((): void => {
      parseAddTorrentInput({
        filename: 'https://example.com/example.torrent',
        labels: ['tv,hd'],
      });
    }).toThrow('Labels can\'t contain commas.');
    expect((): void => {
      parseUpdateTorrentOrganizationInput({
        expectedRevision: 1,
        labels: [
          'Movies',
          'movies',
        ],
        removedLabels: [],
        renamedLabels: [],
      });
    }).toThrow();
    expect((): void => {
      parseUpdateTorrentOrganizationInput({
        expectedRevision: 1,
        labels: [],
        removedLabels: [],
        renamedLabels: [{
          from: '',
          to: 'Movies',
        }],
      });
    }).toThrow();
  });

  it('rejects profile and settings folders inside the effective incomplete folder', (): void => {
    const incompleteDirectory: string = '/data/incomplete';
    const message: string = 'Choose a folder outside the incomplete folder, /data/incomplete.';

    const profile = {
      connectionId: null,
      downloadDirectory: '/data/incomplete/profile',
      labels: [],
      matchPatterns: [],
      name: 'Reserved',
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
    expect((): void => {
      parseTorrentProfileInput(profile, incompleteDirectory);
    }).toThrow(message);
    expect((): void => {
      parseUpdateTorrentProfileInput(profile, incompleteDirectory);
    }).toThrow(message);
    expect((): void => {
      parseUpdateSettingsInput({
        changes: {
          'transmission.downloadDirectory': '/data/incomplete/default',
        },
        expectedRevision: 3,
      }, incompleteDirectory);
    }).toThrow(message);
  });

  it('validates torrent profiles with server-compatible option limits', (): void => {
    const validProfile = {
      connectionId: null,
      downloadDirectory: '/data/tv',
      labels: ['TV'],
      matchPatterns: [
        '*S??E??*',
        '*season*',
      ],
      name: ' TV ',
      options: {
        bandwidthPriority: 1 as const,
        downloadLimitKBps: null,
        peerLimit: 50,
        queue: 'top' as const,
        seeding: {
          idleMinutes: 60,
          mode: 'limit' as const,
          ratio: null,
        },
        uploadLimitKBps: 500,
      },
      startPaused: false,
    };

    expect(parseTorrentProfileInput(validProfile)).toMatchObject({
      name: 'TV',
      options: {
        peerLimit: 50,
      },
    });
    expect((): void => {
      parseTorrentProfileInput({
        ...validProfile,
        labels: ['tv,hd'],
      });
    }).toThrow('Labels can\'t contain commas.');
    expect((): void => {
      parseTorrentProfileInput({
        ...validProfile,
        options: {
          ...validProfile['options'],
          seeding: {
            idleMinutes: null,
            mode: 'limit',
            ratio: null,
          },
        },
      });
    }).toThrow('Enter a ratio, idle minutes, or both');
    expect((): void => {
      parseTorrentProfileInput({
        ...validProfile,
        options: {
          ...validProfile['options'],
          peerLimit: 10_001,
        },
      });
    }).toThrow('Peer limit cannot exceed 10,000.');
    expect((): void => {
      parseTorrentProfileInput({
        ...validProfile,
        downloadDirectory: '/data',
      });
    }).toThrow('Choose a folder inside /data, not /data itself.');
    expect((): void => {
      parseUpdateTorrentProfileInput({
        ...validProfile,
        downloadDirectory: '/data',
      });
    }).toThrow('Choose a folder inside /data, not /data itself.');
  });

  it('rejects unsafe folders and torrent edits', (): void => {
    expect((): void => {
      parseCreateDirectoryInput({
        name: '../outside',
        parentPath: '/data',
      });
    }).toThrow('Folder names cannot contain path separators');
    expect((): void => {
      parseRenameTorrentPathInput({
        hashes: ['a'.repeat(40)],
        name: 'bad/name',
        path: 'current-name',
      });
    }).toThrow('Torrent names cannot contain path separators');
    expect((): void => {
      parseUpdateTorrentsInput({
        changes: {
          peerLimit: 0,
        },
        hashes: ['a'.repeat(40)],
      });
    }).toThrow();
  });

  it('validates settings with the same key-specific ranges as the server', (): void => {
    expect(parseUpdateSettingsInput({
      changes: {
        'transmission.peerPortRandomHigh': 1024,
        'transmission.peerPortRandomLow': 65_535,
      },
      expectedRevision: 3,
    })).toMatchObject({
      expectedRevision: 3,
    });
    expect((): void => {
      parseUpdateSettingsInput({
        changes: {
          'transmission.peerPortRandomLow': 1023,
        },
        expectedRevision: 3,
      });
    }).toThrow('Random port low: Enter a number from 1,024 to 65,535.');
    expect((): void => {
      parseUpdateSettingsInput({
        changes: {
          'transmission.peerPortRandomHigh': 65_536,
        },
        expectedRevision: 3,
      });
    }).toThrow('Random port high: Enter a number from 1,024 to 65,535.');
    expect((): void => {
      parseUpdateSettingsInput({
        changes: {
          'unknown.setting': true,
        },
        expectedRevision: 3,
      });
    }).toThrow('That setting is not supported.');
    expect((): void => {
      parseUpdateSettingsInput({
        changes: {
          'access.compatibleRPCEnabled': true,
        },
        expectedRevision: 3,
      });
    }).toThrow('That setting is not supported.');
    for (const key of [
      'transmission.downloadDirectory',
      'transmission.incompleteDirectory',
    ]) {
      expect((): void => {
        parseUpdateSettingsInput({
          changes: {
            [key]: '/data',
          },
          expectedRevision: 3,
        });
      }).toThrow('Choose a folder inside /data, not /data itself.');
    }
  });

  it('validates VPN pools, DNS addresses, and credential metadata', (): void => {
    const configuration = {
      credentials: {
        password: 'password',
        username: 'username',
      },
      dnsServers: ['9.9.9.9'],
      endpointStrategy: 'sticky' as const,
      profileIds: ['purevpn:example'],
      providerId: 'purevpn',
      retryIntervalSeconds: 10,
      tunnel: 'openvpn' as const,
    };
    expect(parseCreateVpnConnectionInput({
      ...configuration,
      name: ' PureVPN Toronto ',
      peerPort: 42_370,
    })).toMatchObject({
      name: 'PureVPN Toronto',
      peerPort: 42_370,
      providerId: 'purevpn',
      tunnel: 'openvpn',
    });
    expect(parseUpdateVpnConnectionInput({
      expectedRevision: 2,
      name: 'Renamed',
      peerPort: 42_371,
    })).toEqual({
      expectedRevision: 2,
      name: 'Renamed',
      peerPort: 42_371,
    });
    expect(parseDeleteVpnConnectionInput({ moveTo: 'vpc-0123456789abcdef' })).toEqual({ moveTo: 'vpc-0123456789abcdef' });
    expect(parseSetDefaultVpnConnectionInput({ connectionId: 'vpc-fedcba9876543210' })).toEqual({ connectionId: 'vpc-fedcba9876543210' });
    expect(parseSetDefaultVpnConnectionInput({
      connectionId: 'vpc-fedcba9876543210',
      moveTorrents: true,
    })).toEqual({
      connectionId: 'vpc-fedcba9876543210',
      moveTorrents: true,
    });
    expect((): void => {
      parseCreateVpnConnectionInput({
        ...configuration,
        name: 'Office',
        providerId: '',
      });
    }).toThrow('Choose a provider.');
    expect((): void => {
      parseUpdateVpnConnectionInput({
        configuration: {
          ...configuration,
          providerId: '',
        },
        expectedRevision: 2,
      });
    }).toThrow('Choose a provider.');
    expect((): void => {
      parseCreateVpnConnectionInput({
        ...configuration,
        name: 'Office',
        peerPort: 80,
      });
    }).toThrow('Enter a number from 1,024 to 65,535.');
    expect((): void => {
      parseCreateVpnConnectionInput({
        ...configuration,
        dnsServers: ['dns.example.com'],
        name: 'Office',
        profileIds: [
          'purevpn:example',
          'purevpn:example',
        ],
        retryIntervalSeconds: 1,
      });
    }).toThrow();
    expect((): void => {
      parseCreateVpnConnectionInput({
        ...configuration,
        dnsServers: ['2001:db8::1'],
        name: 'Office',
      });
    }).toThrow('Enter one IPv4 address per line.');
    expect((): void => {
      parseCreateVpnConnectionInput({
        ...configuration,
        dnsServers: ['::ffff:1.2.3.4'],
        name: 'Office',
      });
    }).toThrow('Enter one IPv4 address per line.');
    expect((): void => {
      parseCreateVpnConnectionInput({
        ...configuration,
        credentials: {
          privateKey: 'line one\nline two',
        },
        name: 'Mullvad',
        profileIds: ['mullvad:wg-se-sto-wg-001:000000000001'],
        providerId: 'mullvad',
        tunnel: 'wireguard',
      });
    }).toThrow('A VPN credential contains unsupported characters.');
  });

  it('validates remote logins and VPN connection controls', (): void => {
    expect(parseRPCLoginInput({ username: ' living-room.tv ' })).toEqual({ username: 'living-room.tv' });
    expect(parseWebProxyLoginInput({
      connectionId: null,
      username: 'tablet',
    })).toEqual({
      connectionId: null,
      username: 'tablet',
    });
    expect(parseUpdateWebProxyLoginInput({
      connectionId: 'vpc-0123456789abcdef',
      regeneratePassword: true,
    })).toEqual({
      connectionId: 'vpc-0123456789abcdef',
      regeneratePassword: true,
    });
    expect(parseUpdateTorrentProfileInput({
      connectionId: null,
      downloadDirectory: '/data/tv',
      labels: [],
      matchPatterns: [],
      moveTorrents: true,
      name: 'TV',
      options: {
        bandwidthPriority: 0,
        downloadLimitKBps: null,
        peerLimit: 50,
        queue: 'normal',
        seeding: {
          idleMinutes: null,
          mode: 'never',
          ratio: null,
        },
        uploadLimitKBps: null,
      },
      startPaused: false,
    })).toMatchObject({ moveTorrents: true });
    expect(parseVPNConnectionInput({
      dnsServers: [
        '10.64.0.1',
        '1.1.1.1',
      ],
      retryIntervalSeconds: 10,
    })).toMatchObject({ retryIntervalSeconds: 10 });

    expect((): void => {
      parseRPCLoginInput({ username: 'not allowed' });
    }).toThrow('Use only letters, numbers, periods, underscores, and hyphens.');
    expect((): void => {
      parseVPNConnectionInput({
        dnsServers: ['2001:db8::1'],
        retryIntervalSeconds: 10,
      });
    }).toThrow('Enter one IPv4 address per line.');
    expect((): void => {
      parseVPNConnectionInput({
        dnsServers: [],
        retryIntervalSeconds: 2,
      });
    }).toThrow('Enter a number from 3 to 600.');
  });

  it('validates RPC login updates', (): void => {
    expect(parseUpdateRPCLoginInput({ username: ' living-room.tv ' })).toEqual({
      username: 'living-room.tv',
    });
    expect(parseUpdateRPCLoginInput({ regeneratePassword: true })).toEqual({
      regeneratePassword: true,
    });
    expect(parseUpdateRPCLoginInput({
      regeneratePassword: true,
      username: 'tablet',
    })).toEqual({
      regeneratePassword: true,
      username: 'tablet',
    });
    expect((): void => {
      parseUpdateRPCLoginInput({ username: 'not allowed' });
    }).toThrow('Use only letters, numbers, periods, underscores, and hyphens.');
  });

  it('checks WireGuard keys and tunnel addresses by field kind', (): void => {
    const mullvadTunnel: Web_Api_ProviderTunnel = {
      catalogSource: 'https://api.mullvad.net/www/relays/all/',
      credentialFields: [
        {
          description: '',
          key: 'privateKey',
          kind: 'wireguard-key',
          label: 'Private key',
          required: true,
          secret: true,
        },
        {
          description: '',
          key: 'address',
          kind: 'ipv4-address',
          label: 'Tunnel address',
          required: true,
          secret: false,
        },
      ],
      description: '',
      id: 'wireguard',
      supportsCatalogRefresh: true,
      supportsProfileUpload: false,
    };
    const privateKey: string = 'yAnz5TF+lXXJte14tji3zlMNq+hd2rYUIgJBgB3fBmk=';

    expect((): void => {
      validateProviderCredentials(mullvadTunnel, {
        address: '10.68.12.34/32',
        privateKey,
      });
    }).not.toThrow();
    expect((): void => {
      validateProviderCredentials(mullvadTunnel, {
        address: '10.68.12.34',
        privateKey: ` ${privateKey} `,
      });
    }).not.toThrow();
    expect((): void => {
      validateProviderCredentials(mullvadTunnel, {}, [
        'privateKey',
        'address',
      ]);
    }).not.toThrow();
    expect((): void => {
      validateProviderCredentials(mullvadTunnel, {}, ['privateKey']);
    }).toThrow('Tunnel address is required.');
    expect((): void => {
      validateProviderCredentials(mullvadTunnel, { privateKey });
    }).toThrow('Tunnel address is required.');
    expect((): void => {
      validateProviderCredentials(mullvadTunnel, {
        address: '10.68.12.34/32',
        privateKey: 'not-a-key',
      });
    }).toThrow('Private key must be a WireGuard key: 44 characters of base64 ending in =.');
    expect((): void => {
      validateProviderCredentials(mullvadTunnel, {
        address: 'fd00::2/128',
        privateKey,
      });
    }).toThrow('Tunnel address must be an IPv4 address such as 10.68.12.34/32.');
  });
});
