import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  ApiError,
  connectionBeingRemovedMessage,
  messageForAPIError,
} from '../src/web/api.ts';
import { formatConsoleError } from '../src/web/form-validation.ts';

describe('console error wording', (): void => {
  it('replaces setting keys with their visible titles', (): void => {
    const message: string = formatConsoleError('transmission.blocklistSources: Every source must be a URL.');

    expect(message).toBe('Blocklist sources: Every source must be a URL.');
    expect(message).not.toContain('transmission.blocklistSources');
  });

  it('removes internal custom profile and process details', (): void => {
    const message: string = formatConsoleError('custom:office:0123456789ab failed with exit status 1');

    expect(message).toBe('the selected custom profile failed with the VPN process stopped unexpectedly');
    expect(message).not.toContain('custom:office');
    expect(message).not.toContain('exit status');
  });

  it('turns raw numeric validation output into an instruction', (): void => {
    expect(formatConsoleError('Too small: expected number to be >=1')).toBe('Enter a number of at least 1.');
    expect(formatConsoleError('Too big: expected number to be <=600')).toBe('Enter a number no greater than 600.');
  });

  it.each([
    [
      'capacity_reached',
      'This container allows up to 8 VPN connections. Remove one before adding another.',
      { limit: 8 },
    ],
    [
      'name_taken',
      'Enter a different connection name. That name is already in use.',
      {},
    ],
    [
      'revision_conflict',
      'This page is out of date. Reload it, then try again.',
      {},
    ],
    [
      'change_running',
      'Wait for the current VPN connection change to finish, then try again.',
      {},
    ],
    [
      'default_connection',
      'Choose a different default VPN connection before removing this one.',
      {},
    ],
    [
      'connection_in_use',
      'Choose where to move this connection\'s torrents, profiles, and proxy logins before removing it.',
      {},
    ],
    [
      'connection_being_removed',
      'The selected connection is being removed. Pick another connection.',
      {},
    ],
    [
      'move_failed',
      'One or more torrents couldn\'t be moved. The VPN connection was kept.',
      {},
    ],
    [
      'torrents_must_move',
      'Confirm moving this profile\'s torrents to its selected VPN connection.',
      {},
    ],
    [
      'torrent_not_found',
      'One or more selected torrents are no longer available. Refresh the list and try again.',
      {},
    ],
    [
      'daemon_unavailable',
      'Transmission isn\'t ready for the selected VPN connection. Wait a moment and try again.',
      {},
    ],
    [
      'vpn_connection_required',
      'Add a VPN connection before adding torrents.',
      {},
    ],
    [
      'web_proxy_connection_invalid',
      'Choose an existing VPN connection, or set up a default connection first.',
      {},
    ],
  ])('maps %s to owner-facing wording', (
    code: string,
    expected: string,
    details: Record<string, unknown>,
  ): void => {
    const message: string = messageForAPIError(code, 409, 'vpc-internal: raw_backend_code', details);

    expect(message).toBe(expected);
    expect(message).not.toContain(code);
    expect(message).not.toContain('vpc-internal');
  });

  it('keeps the API VPN test reason and endpoint', (): void => {
    const message: string = 'Couldn\'t find vpn-toronto.example.test. Check the address in the profile.';

    expect(messageForAPIError('vpn_test_failed', 502, message)).toBe(message);
  });

  it('keeps a starting Transmission 503 message', (): void => {
    expect(messageForAPIError(
      'daemon_unavailable',
      503,
      'PIA Toronto\'s Transmission is still starting.',
    )).toBe('PIA Toronto\'s Transmission is still starting.');
  });

  it('keeps the Default profile deletion move instruction', (): void => {
    const message: string = 'The profile\'s torrents must move to the Default profile before it can be deleted.';

    expect(messageForAPIError(
      'torrents_must_move',
      409,
      message,
    )).toBe(message);
  });

  it('keeps the default connection move instruction', (): void => {
    const message: string = 'The Default profile\'s torrents must move to the new default VPN connection.';

    expect(messageForAPIError(
      'torrents_must_move',
      409,
      message,
    )).toBe(message);
  });

  it('names the connection for a removal conflict', (): void => {
    const error = new ApiError(
      'The selected connection is being removed. Pick another connection.',
      'connection_being_removed',
      409,
      [],
    );

    expect(connectionBeingRemovedMessage(error, 'Mullvad New York')).toBe('Mullvad New York is being removed. Pick another connection.');
    expect(connectionBeingRemovedMessage(error, 'Mullvad New York')).not.toContain('connection_being_removed');
  });
});
