import type {
  Web_Api_TorrentOrganization,
  Web_Api_UpdateTorrentOrganizationInput,
} from '@/types/web/api.d.ts';
import type { Web_Components_TorrentOrganizationLabelDraft } from '@/types/web/components.d.ts';

/**
 * Torrent Organization - Sort values.
 *
 * Keeps label lists in a stable case-insensitive order.
 * The backend remains free to preserve each label's entered casing.
 *
 * @since 2.0.0
 */
export const sortTorrentOrganizationValues = (values: string[]): string[] => [...values].sort(
  (leftValue: string, rightValue: string): number => leftValue.localeCompare(
    rightValue,
    undefined,
    { sensitivity: 'base' },
  ),
);

/**
 * Torrent Organization - Normalizes value.
 *
 * Produces the comparison key used by case-insensitive removal, rename, and
 * conflict merging. Display values keep their original casing.
 *
 * @since 2.0.0
 */
const normalizeTorrentOrganizationValue = (value: string): string => value.toLocaleLowerCase();

/**
 * Torrent Organization - Build label update.
 *
 * Preserves each opened label's identity so deletions and renames are sent as
 * explicit operations for the backend to apply to torrents.
 *
 * @since 2.0.0
 */
export const buildTorrentOrganizationUpdate = (
  expectedRevision: number,
  openedLabels: string[],
  drafts: Web_Components_TorrentOrganizationLabelDraft[],
): Web_Api_UpdateTorrentOrganizationInput => {
  const survivingOriginals: string[] = drafts.flatMap(
    (draft: Web_Components_TorrentOrganizationLabelDraft): string[] => (
      (draft['original'] === null) ? [] : [draft['original']]
    ),
  );

  return {
    expectedRevision,
    labels: sortTorrentOrganizationValues(drafts.map(
      (draft: Web_Components_TorrentOrganizationLabelDraft): string => draft['value'].trim(),
    )),
    removedLabels: openedLabels.filter((label: string): boolean => !survivingOriginals.includes(label)),
    renamedLabels: drafts.flatMap((draft: Web_Components_TorrentOrganizationLabelDraft): {
      from: string
      to: string
    }[] => (
      (draft['original'] !== null && draft['original'] !== draft['value'].trim()) ? [{
        from: draft['original'],
        to: draft['value'].trim(),
      }] : []
    )),
  };
};

/**
 * Torrent Organization - Merge update.
 *
 * Replays explicit label removals, renames, and additions over a newer server
 * revision so one automatic conflict retry keeps concurrent labels intact.
 *
 * @since 2.0.0
 */
export const mergeTorrentOrganizationUpdate = (
  openedOrganization: Web_Api_TorrentOrganization,
  editedOrganization: Web_Api_UpdateTorrentOrganizationInput,
  latestOrganization: Web_Api_TorrentOrganization,
): Web_Api_UpdateTorrentOrganizationInput => {
  const mergedLabels: string[] = latestOrganization['labels'].filter((label: string): boolean => (
    !editedOrganization['removedLabels'].some(
      (removedLabel: string): boolean => normalizeTorrentOrganizationValue(removedLabel) === normalizeTorrentOrganizationValue(label),
    )
    && !editedOrganization['renamedLabels'].some(
      (rename): boolean => normalizeTorrentOrganizationValue(rename['from']) === normalizeTorrentOrganizationValue(label),
    )
  ));
  const renamedTargets: string[] = editedOrganization['renamedLabels'].map((rename): string => rename['to']);
  const addedLabels: string[] = editedOrganization['labels'].filter((label: string): boolean => (
    !openedOrganization['labels'].some(
      (openedLabel: string): boolean => normalizeTorrentOrganizationValue(openedLabel) === normalizeTorrentOrganizationValue(label),
    )
    && !renamedTargets.some((target: string): boolean => normalizeTorrentOrganizationValue(target) === normalizeTorrentOrganizationValue(label))
  ));

  for (const label of [
    ...renamedTargets,
    ...addedLabels,
  ]) {
    if (!mergedLabels.some((mergedLabel: string): boolean => normalizeTorrentOrganizationValue(mergedLabel) === normalizeTorrentOrganizationValue(label))) {
      mergedLabels.push(label);
    }
  }

  return {
    ...editedOrganization,
    expectedRevision: latestOrganization['revision'],
    labels: sortTorrentOrganizationValues(mergedLabels),
  };
};
