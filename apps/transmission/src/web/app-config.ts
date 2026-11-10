import brandMarkUrl from '@/web/assets/brand-mark.svg';

import type { Web_AppConfig } from '@/types/web/app-config.d.ts';

/**
 * App Config - Application config.
 *
 * Keeps product copy, storage keys, and token capabilities outside the shared
 * console foundation so another app can adopt it without editing shared files.
 *
 * @since 2.0.0
 */
export const appConfig: Web_AppConfig = {
  appName: 'Transmission VPN',
  brandMarkUrl,
  brandName: 'Transmission VPN',
  claimCodeHint: 'Use the generated code from docker logs, or enter the exact mounted claim secret.',
  recoveryCodeFileName: 'transmission-vpn-recovery-codes.txt',
  roleLabels: {},
  securityLabel: 'Sign-in and security',
  securitySurfaceName: 'app',
  storageKeys: {
    theme: 'transmission-vpn-theme',
  },
  tokenDefaultScopes: [
    'torrents:read',
    'torrents:write',
  ],
  tokenNamePlaceholder: 'e.g. Phone app',
  tokenScopes: [
    {
      description: 'See torrents, their files and peers, and free space.',
      id: 'torrents:read',
    },
    {
      description: 'Add, start, stop, and remove torrents, and change their profiles.',
      id: 'torrents:write',
      includes: 'torrents:read',
    },
    {
      description: 'See the VPN connection, providers, and profiles.',
      id: 'vpn:read',
    },
    {
      description: 'Connect, reconnect, and disconnect the VPN.',
      id: 'vpn:write',
      includes: 'vpn:read',
    },
    {
      description: 'See the settings.',
      id: 'settings:read',
    },
    {
      description: 'Change the settings.',
      id: 'settings:write',
      includes: 'settings:read',
    },
  ],
};
