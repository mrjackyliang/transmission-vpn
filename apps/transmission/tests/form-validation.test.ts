import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  maximumTorrentFileBytes,
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

import type {
  Tests_Web_FormValidation_Configuration,
  Tests_Web_FormValidation_IncompleteDirectory,
  Tests_Web_FormValidation_LargestMetainfoLength,
  Tests_Web_FormValidation_Message,
  Tests_Web_FormValidation_MullvadTunnel,
  Tests_Web_FormValidation_ParsedInput,
  Tests_Web_FormValidation_ParsedMetainfo,
  Tests_Web_FormValidation_PrivateKey,
  Tests_Web_FormValidation_Profile,
  Tests_Web_FormValidation_ValidProfile,
} from '../src/types/tests/web/form-validation.test.d.ts';

describe('form validation', () => {
  it('normalizes authentication fields and enforces account policy', () => {
    expect(parseClaimInput({
      claimCode: ' ABCDE-23456-FGHIJ ',
      password: 'a secure local password',
      username: ' administrator ',
    })).toEqual({
      claimCode: 'ABCDE-23456-FGHIJ',
      password: 'a secure local password',
      username: 'administrator',
    });

    expect(() => {
      parseClaimInput({
        claimCode: 'short',
        password: 'short',
        username: '_invalid',
      });

      return;
    }).toThrow();

    expect(() => {
      parseLoginInput({
        password: '',
        username: '',
      });

      return;
    }).toThrow('Enter your username.');

    return;
  });

  it('requires one safe torrent source and valid organization values', () => {
    expect(parseAddTorrentInput({
      filename: 'magnet:?xt=urn:btih:abcdef',
      labels: ['Archive'],
      paused: true,
    })).toMatchObject({
      filename: 'magnet:?xt=urn:btih:abcdef',
    });

    expect(() => {
      parseAddTorrentInput({
        filename: 'file:///tmp/example.torrent',
      });

      return;
    }).toThrow('Enter a valid HTTP, HTTPS, or magnet URL.');

    expect(() => {
      parseAddTorrentInput({
        filename: 'https://example.com/example.torrent',
        metainfo: 'YWJj',
      });

      return;
    }).toThrow('Provide exactly one torrent URL, magnet link, or .torrent file.');

    expect(() => {
      parseAddTorrentInput({
        filename: 'https://example.com/example.torrent',
        labels: ['tv,hd'],
      });

      return;
    }).toThrow('Labels can\'t contain commas.');

    expect(() => {
      parseUpdateTorrentOrganizationInput({
        expectedRevision: 1,
        labels: [
          'Movies',
          'movies',
        ],
        removedLabels: [],
        renamedLabels: [],
      });

      return;
    }).toThrow();

    expect(() => {
      parseUpdateTorrentOrganizationInput({
        expectedRevision: 1,
        labels: [],
        removedLabels: [],
        renamedLabels: [{
          from: '',
          to: 'Movies',
        }],
      });

      return;
    }).toThrow();

    return;
  });

  it('accepts .torrent files up to 16 MiB', () => {
    const largestMetainfoLength: Tests_Web_FormValidation_LargestMetainfoLength = Math.ceil(maximumTorrentFileBytes / 3) * 4;

    expect(maximumTorrentFileBytes).toBe(16_777_216);

    const parsedInput: Tests_Web_FormValidation_ParsedInput = parseAddTorrentInput({
      metainfo: 'A'.repeat(largestMetainfoLength),
    });
    const parsedMetainfo: Tests_Web_FormValidation_ParsedMetainfo = parsedInput['metainfo'];

    expect((parsedMetainfo !== undefined) ? parsedMetainfo.length : undefined).toBe(largestMetainfoLength);

    expect(() => {
      parseAddTorrentInput({
        metainfo: 'A'.repeat(largestMetainfoLength + 4),
      });

      return;
    }).toThrow('The .torrent file is larger than 16 MiB.');

    return;
  });

  it('rejects profile and settings folders inside the effective incomplete folder', () => {
    const incompleteDirectory: Tests_Web_FormValidation_IncompleteDirectory = '/data/incomplete';
    const message: Tests_Web_FormValidation_Message = 'Choose a folder outside the incomplete folder, /data/incomplete.';

    const profile: Tests_Web_FormValidation_Profile = {
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

    expect(() => {
      parseTorrentProfileInput(profile, incompleteDirectory);

      return;
    }).toThrow(message);

    expect(() => {
      parseUpdateTorrentProfileInput(profile, incompleteDirectory);

      return;
    }).toThrow(message);

    expect(() => {
      parseUpdateSettingsInput({
        changes: {
          'transmission.downloadDirectory': '/data/incomplete/default',
        },
        expectedRevision: 3,
      }, incompleteDirectory);

      return;
    }).toThrow(message);

    return;
  });

  it('validates torrent profiles with server-compatible option limits', () => {
    const validProfile: Tests_Web_FormValidation_ValidProfile = {
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

    expect(() => {
      parseTorrentProfileInput({
        ...validProfile,
        labels: ['tv,hd'],
      });

      return;
    }).toThrow('Labels can\'t contain commas.');

    expect(() => {
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

      return;
    }).toThrow('Enter a ratio, idle minutes, or both');

    expect(() => {
      parseTorrentProfileInput({
        ...validProfile,
        options: {
          ...validProfile['options'],
          peerLimit: 10_001,
        },
      });

      return;
    }).toThrow('Peer limit cannot exceed 10,000.');

    expect(() => {
      parseTorrentProfileInput({
        ...validProfile,
        downloadDirectory: '/data',
      });

      return;
    }).toThrow('Choose a folder inside /data, not /data itself.');

    expect(() => {
      parseUpdateTorrentProfileInput({
        ...validProfile,
        downloadDirectory: '/data',
      });

      return;
    }).toThrow('Choose a folder inside /data, not /data itself.');

    return;
  });

  it('rejects unsafe folders and torrent edits', () => {
    expect(() => {
      parseCreateDirectoryInput({
        name: '../outside',
        parentPath: '/data',
      });

      return;
    }).toThrow('Folder names cannot contain path separators');

    expect(() => {
      parseRenameTorrentPathInput({
        hashes: ['a'.repeat(40)],
        name: 'bad/name',
        path: 'current-name',
      });

      return;
    }).toThrow('Torrent names cannot contain path separators');

    expect(() => {
      parseUpdateTorrentsInput({
        changes: {
          peerLimit: 0,
        },
        hashes: ['a'.repeat(40)],
      });

      return;
    }).toThrow();

    return;
  });

  it('validates settings with the same key-specific ranges as the server', () => {
    expect(parseUpdateSettingsInput({
      changes: {
        'transmission.peerPortRandomHigh': 1024,
        'transmission.peerPortRandomLow': 65_535,
      },
      expectedRevision: 3,
    })).toMatchObject({
      expectedRevision: 3,
    });

    expect(() => {
      parseUpdateSettingsInput({
        changes: {
          'transmission.peerPortRandomLow': 1023,
        },
        expectedRevision: 3,
      });

      return;
    }).toThrow('Random port low: Enter a number from 1,024 to 65,535.');

    expect(() => {
      parseUpdateSettingsInput({
        changes: {
          'transmission.peerPortRandomHigh': 65_536,
        },
        expectedRevision: 3,
      });

      return;
    }).toThrow('Random port high: Enter a number from 1,024 to 65,535.');

    expect(() => {
      parseUpdateSettingsInput({
        changes: {
          'unknown.setting': true,
        },
        expectedRevision: 3,
      });

      return;
    }).toThrow('That setting is not supported.');

    expect(() => {
      parseUpdateSettingsInput({
        changes: {
          'access.compatibleRPCEnabled': true,
        },
        expectedRevision: 3,
      });

      return;
    }).toThrow('That setting is not supported.');

    for (const key of [
      'transmission.downloadDirectory',
      'transmission.incompleteDirectory',
    ]) {
      expect(() => {
        parseUpdateSettingsInput({
          changes: {
            [key]: '/data',
          },
          expectedRevision: 3,
        });

        return;
      }).toThrow('Choose a folder inside /data, not /data itself.');
    }

    return;
  });

  it('validates VPN pools, DNS addresses, and credential metadata', () => {
    const configuration: Tests_Web_FormValidation_Configuration = {
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

    expect(() => {
      parseCreateVpnConnectionInput({
        ...configuration,
        name: 'Office',
        providerId: '',
      });

      return;
    }).toThrow('Choose a provider.');

    expect(() => {
      parseUpdateVpnConnectionInput({
        configuration: {
          ...configuration,
          providerId: '',
        },
        expectedRevision: 2,
      });

      return;
    }).toThrow('Choose a provider.');

    expect(() => {
      parseCreateVpnConnectionInput({
        ...configuration,
        name: 'Office',
        peerPort: 80,
      });

      return;
    }).toThrow('Enter a number from 1,024 to 65,535.');

    expect(() => {
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

      return;
    }).toThrow();

    expect(() => {
      parseCreateVpnConnectionInput({
        ...configuration,
        dnsServers: ['2001:db8::1'],
        name: 'Office',
      });

      return;
    }).toThrow('Enter one IPv4 address per line.');

    expect(() => {
      parseCreateVpnConnectionInput({
        ...configuration,
        dnsServers: ['::ffff:1.2.3.4'],
        name: 'Office',
      });

      return;
    }).toThrow('Enter one IPv4 address per line.');

    expect(() => {
      parseCreateVpnConnectionInput({
        ...configuration,
        credentials: {
          privateKey: [
            'line one',
            'line two',
          ].join('\n'),
        },
        name: 'Mullvad',
        profileIds: ['mullvad:wg-se-sto-wg-001:000000000001'],
        providerId: 'mullvad',
        tunnel: 'wireguard',
      });

      return;
    }).toThrow('A VPN credential contains unsupported characters.');

    return;
  });

  it('validates remote logins and VPN connection controls', () => {
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

    expect(() => {
      parseRPCLoginInput({ username: 'not allowed' });

      return;
    }).toThrow('Use only letters, numbers, periods, underscores, and hyphens.');

    expect(() => {
      parseVPNConnectionInput({
        dnsServers: ['2001:db8::1'],
        retryIntervalSeconds: 10,
      });

      return;
    }).toThrow('Enter one IPv4 address per line.');

    expect(() => {
      parseVPNConnectionInput({
        dnsServers: [],
        retryIntervalSeconds: 2,
      });

      return;
    }).toThrow('Enter a number from 3 to 600.');

    return;
  });

  it('validates RPC login updates', () => {
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

    expect(() => {
      parseUpdateRPCLoginInput({ username: 'not allowed' });

      return;
    }).toThrow('Use only letters, numbers, periods, underscores, and hyphens.');

    return;
  });

  it('checks WireGuard keys and tunnel addresses by field kind', () => {
    const mullvadTunnel: Tests_Web_FormValidation_MullvadTunnel = {
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
    const privateKey: Tests_Web_FormValidation_PrivateKey = 'yAnz5TF+lXXJte14tji3zlMNq+hd2rYUIgJBgB3fBmk=';

    expect(() => {
      validateProviderCredentials(mullvadTunnel, {
        address: '10.68.12.34/32',
        privateKey,
      });

      return;
    }).not.toThrow();

    expect(() => {
      validateProviderCredentials(mullvadTunnel, {
        address: '10.68.12.34',
        privateKey: ` ${privateKey} `,
      });

      return;
    }).not.toThrow();

    expect(() => {
      validateProviderCredentials(mullvadTunnel, {}, [
        'privateKey',
        'address',
      ]);

      return;
    }).not.toThrow();

    expect(() => {
      validateProviderCredentials(mullvadTunnel, {}, ['privateKey']);

      return;
    }).toThrow('Tunnel address is required.');

    expect(() => {
      validateProviderCredentials(mullvadTunnel, { privateKey });

      return;
    }).toThrow('Tunnel address is required.');

    expect(() => {
      validateProviderCredentials(mullvadTunnel, {
        address: '10.68.12.34/32',
        privateKey: 'not-a-key',
      });

      return;
    }).toThrow('Private key must be a WireGuard key: 44 characters of base64 ending in =.');

    expect(() => {
      validateProviderCredentials(mullvadTunnel, {
        address: 'fd00::2/128',
        privateKey,
      });

      return;
    }).toThrow('Tunnel address must be an IPv4 address such as 10.68.12.34/32.');

    return;
  });

  return;
});
