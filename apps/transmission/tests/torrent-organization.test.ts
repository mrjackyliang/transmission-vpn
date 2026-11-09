import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  buildTorrentOrganizationUpdate,
  mergeTorrentOrganizationUpdate,
} from '../src/web/torrent-organization.ts';

import type { Web_Api_TorrentOrganization } from '../src/types/web/api.d.ts';

/**
 * Torrent Organization Test - Creates organization.
 *
 * Supplies a compact labels-only server revision for update and conflict tests.
 *
 * @since UNRELEASED
 */
const organization = (
  revision: number,
  labels: string[],
): Web_Api_TorrentOrganization => ({
  labels,
  revision,
});

describe('torrent organization updates', (): void => {
  it('sends deleted and renamed labels as explicit operations', (): void => {
    expect(buildTorrentOrganizationUpdate(7, [
      'Archive',
      'Film',
      'Keep',
    ], [
      {
        id: 'film',
        original: 'Film',
        value: 'Movies',
      },
      {
        id: 'keep',
        original: 'Keep',
        value: 'Keep',
      },
      {
        id: 'new',
        original: null,
        value: 'New',
      },
    ])).toEqual({
      expectedRevision: 7,
      labels: [
        'Keep',
        'Movies',
        'New',
      ],
      removedLabels: ['Archive'],
      renamedLabels: [{
        from: 'Film',
        to: 'Movies',
      }],
    });
  });

  it('replays removals, renames, and additions over a newer revision', (): void => {
    const openedOrganization = organization(5, [
      'Archive',
      'Film',
    ]);
    const editedOrganization = buildTorrentOrganizationUpdate(
      openedOrganization['revision'],
      openedOrganization['labels'],
      [
        {
          id: 'film',
          original: 'Film',
          value: 'Movies',
        },
        {
          id: 'local',
          original: null,
          value: 'Local',
        },
      ],
    );
    const result = mergeTorrentOrganizationUpdate(
      openedOrganization,
      editedOrganization,
      organization(6, [
        'Archive',
        'Film',
        'Remote',
      ]),
    );

    expect(result).toEqual({
      expectedRevision: 6,
      labels: [
        'Local',
        'Movies',
        'Remote',
      ],
      removedLabels: ['Archive'],
      renamedLabels: [{
        from: 'Film',
        to: 'Movies',
      }],
    });
  });

  it('preserves a case-only rename', (): void => {
    const openedOrganization = organization(9, ['Movies']);
    const editedOrganization = buildTorrentOrganizationUpdate(
      openedOrganization['revision'],
      openedOrganization['labels'],
      [{
        id: 'movies',
        original: 'Movies',
        value: 'movies',
      }],
    );
    const result = mergeTorrentOrganizationUpdate(
      openedOrganization,
      editedOrganization,
      organization(10, [
        'MOVIES',
        'Shows',
      ]),
    );

    expect(result.labels).toEqual([
      'movies',
      'Shows',
    ]);
  });
});
