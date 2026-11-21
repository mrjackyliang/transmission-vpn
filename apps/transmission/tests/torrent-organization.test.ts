import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  buildTorrentOrganizationUpdate,
  mergeTorrentOrganizationUpdate,
} from '../src/web/torrent-organization.ts';

import type {
  Tests_Web_TorrentOrganization_EditedOrganization,
  Tests_Web_TorrentOrganization_OpenedOrganization,
  Tests_Web_TorrentOrganization_Organization_Labels,
  Tests_Web_TorrentOrganization_Organization_Returns,
  Tests_Web_TorrentOrganization_Organization_Revision,
  Tests_Web_TorrentOrganization_Result,
} from '../src/types/tests/web/torrent-organization.test.d.ts';

/**
 * Torrent Organization - Organization.
 *
 * Supplies a compact labels-only server revision for update and conflict tests.
 *
 * @param {Tests_Web_TorrentOrganization_Organization_Revision} revision - Revision.
 * @param {Tests_Web_TorrentOrganization_Organization_Labels}   labels   - Labels.
 *
 * @returns {Tests_Web_TorrentOrganization_Organization_Returns}
 *
 * @since 2.0.0
 */
const organization = (
  revision: Tests_Web_TorrentOrganization_Organization_Revision,
  labels: Tests_Web_TorrentOrganization_Organization_Labels,
): Tests_Web_TorrentOrganization_Organization_Returns => ({
  labels,
  revision,
});

describe('torrent organization updates', () => {
  it('sends deleted and renamed labels as explicit operations', () => {
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

    return;
  });

  it('replays removals, renames, and additions over a newer revision', () => {
    const openedOrganization: Tests_Web_TorrentOrganization_OpenedOrganization = organization(5, [
      'Archive',
      'Film',
    ]);
    const editedOrganization: Tests_Web_TorrentOrganization_EditedOrganization = buildTorrentOrganizationUpdate(
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
    const result: Tests_Web_TorrentOrganization_Result = mergeTorrentOrganizationUpdate(
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

    return;
  });

  it('preserves a case-only rename', () => {
    const openedOrganization: Tests_Web_TorrentOrganization_OpenedOrganization = organization(9, ['Movies']);
    const editedOrganization: Tests_Web_TorrentOrganization_EditedOrganization = buildTorrentOrganizationUpdate(
      openedOrganization['revision'],
      openedOrganization['labels'],
      [{
        id: 'movies',
        original: 'Movies',
        value: 'movies',
      }],
    );
    const result: Tests_Web_TorrentOrganization_Result = mergeTorrentOrganizationUpdate(
      openedOrganization,
      editedOrganization,
      organization(10, [
        'MOVIES',
        'Shows',
      ]),
    );

    expect(result['labels']).toEqual([
      'movies',
      'Shows',
    ]);

    return;
  });

  return;
});
