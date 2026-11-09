import {
  describe,
  expect,
  it,
} from 'vitest';

import { defaultVPNMoveConfirmation } from '../src/web/vpn-default-change.ts';

describe('VPN default change', (): void => {
  it.each([
    [
      'one Default-profile torrent',
      1,
      1,
      0,
      'Make PureVPN 2 the default? 1 torrent moves to it from the Default profile.',
    ],
    [
      'several Default-profile torrents',
      3,
      3,
      0,
      'Make PureVPN 2 the default? 3 torrents move to it from the Default profile.',
    ],
    [
      'one following-profile torrent',
      1,
      0,
      1,
      'Make PureVPN 2 the default? 1 torrent moves to it from profiles that follow the default connection.',
    ],
    [
      'several following-profile torrents',
      3,
      0,
      3,
      'Make PureVPN 2 the default? 3 torrents move to it from profiles that follow the default connection.',
    ],
    [
      'both profile groups',
      3,
      1,
      2,
      'Make PureVPN 2 the default? 3 torrents move to it: from the Default profile and profiles that follow the default connection.',
    ],
  ])('describes %s', (
    _name: string,
    torrents: number,
    defaultProfileTorrents: number,
    followingProfileTorrents: number,
    expected: string,
  ): void => {
    expect(defaultVPNMoveConfirmation(
      'PureVPN 2',
      torrents,
      defaultProfileTorrents,
      followingProfileTorrents,
    )).toBe(expected);
  });
});
