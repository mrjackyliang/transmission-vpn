import type {
  Web_TorrentOrganization_BuildTorrentOrganizationUpdate_Drafts,
  Web_TorrentOrganization_BuildTorrentOrganizationUpdate_ExpectedRevision,
  Web_TorrentOrganization_BuildTorrentOrganizationUpdate_OpenedLabels,
  Web_TorrentOrganization_BuildTorrentOrganizationUpdate_Returns,
  Web_TorrentOrganization_BuildTorrentOrganizationUpdate_SurvivingOriginals,
  Web_TorrentOrganization_MergeTorrentOrganizationUpdate_AddedLabels,
  Web_TorrentOrganization_MergeTorrentOrganizationUpdate_EditedOrganization,
  Web_TorrentOrganization_MergeTorrentOrganizationUpdate_LatestOrganization,
  Web_TorrentOrganization_MergeTorrentOrganizationUpdate_MergedLabels,
  Web_TorrentOrganization_MergeTorrentOrganizationUpdate_OpenedOrganization,
  Web_TorrentOrganization_MergeTorrentOrganizationUpdate_RenamedTargets,
  Web_TorrentOrganization_MergeTorrentOrganizationUpdate_Returns,
  Web_TorrentOrganization_NormalizeTorrentOrganizationValue_Returns,
  Web_TorrentOrganization_NormalizeTorrentOrganizationValue_Value,
  Web_TorrentOrganization_SortTorrentOrganizationValues_Returns,
  Web_TorrentOrganization_SortTorrentOrganizationValues_Values,
} from '@/types/web/torrent-organization.d.ts';

/**
 * Torrent Organization - Sort Torrent Organization Values.
 *
 * Keeps label lists in a stable case-insensitive order.
 * The backend remains free to preserve each label's entered casing.
 *
 * @param {Web_TorrentOrganization_SortTorrentOrganizationValues_Values} values - Values.
 *
 * @returns {Web_TorrentOrganization_SortTorrentOrganizationValues_Returns}
 *
 * @since 2.0.0
 */
export const sortTorrentOrganizationValues = (values: Web_TorrentOrganization_SortTorrentOrganizationValues_Values): Web_TorrentOrganization_SortTorrentOrganizationValues_Returns => [...values].sort(
  (leftValue, rightValue) => leftValue.localeCompare(
    rightValue,
    undefined,
    { sensitivity: 'base' },
  ),
);

/**
 * Torrent Organization - Normalize Torrent Organization Value.
 *
 * Produces the comparison key used by case-insensitive removal, rename, and
 * conflict merging. Display values keep their original casing.
 *
 * @param {Web_TorrentOrganization_NormalizeTorrentOrganizationValue_Value} value - Value.
 *
 * @returns {Web_TorrentOrganization_NormalizeTorrentOrganizationValue_Returns}
 *
 * @since 2.0.0
 */
const normalizeTorrentOrganizationValue = (value: Web_TorrentOrganization_NormalizeTorrentOrganizationValue_Value): Web_TorrentOrganization_NormalizeTorrentOrganizationValue_Returns => value.toLocaleLowerCase();

/**
 * Torrent Organization - Build Torrent Organization Update.
 *
 * Preserves each opened label's identity so deletions and renames are sent as
 * explicit operations for the backend to apply to torrents.
 *
 * @param {Web_TorrentOrganization_BuildTorrentOrganizationUpdate_ExpectedRevision} expectedRevision - Expected revision.
 * @param {Web_TorrentOrganization_BuildTorrentOrganizationUpdate_OpenedLabels}     openedLabels     - Opened labels.
 * @param {Web_TorrentOrganization_BuildTorrentOrganizationUpdate_Drafts}           drafts           - Drafts.
 *
 * @returns {Web_TorrentOrganization_BuildTorrentOrganizationUpdate_Returns}
 *
 * @since 2.0.0
 */
export const buildTorrentOrganizationUpdate = (
  expectedRevision: Web_TorrentOrganization_BuildTorrentOrganizationUpdate_ExpectedRevision,
  openedLabels: Web_TorrentOrganization_BuildTorrentOrganizationUpdate_OpenedLabels,
  drafts: Web_TorrentOrganization_BuildTorrentOrganizationUpdate_Drafts,
): Web_TorrentOrganization_BuildTorrentOrganizationUpdate_Returns => {
  const survivingOriginals: Web_TorrentOrganization_BuildTorrentOrganizationUpdate_SurvivingOriginals = drafts.flatMap(
    (draft) => (
      (draft['original'] === null) ? [] : [draft['original']]
    ),
  );

  return {
    expectedRevision,
    labels: sortTorrentOrganizationValues(drafts.map(
      (draft) => draft['value'].trim(),
    )),
    removedLabels: openedLabels.filter((label) => survivingOriginals.includes(label) === false),
    renamedLabels: drafts.flatMap((draft) => (
      (draft['original'] !== null && draft['original'] !== draft['value'].trim()) ? [{
        from: draft['original'],
        to: draft['value'].trim(),
      }] : []
    )),
  };
};

/**
 * Torrent Organization - Merge Torrent Organization Update.
 *
 * Replays explicit label removals, renames, and additions over a newer server
 * revision so one automatic conflict retry keeps concurrent labels intact.
 *
 * @param {Web_TorrentOrganization_MergeTorrentOrganizationUpdate_OpenedOrganization} openedOrganization - Opened organization.
 * @param {Web_TorrentOrganization_MergeTorrentOrganizationUpdate_EditedOrganization} editedOrganization - Edited organization.
 * @param {Web_TorrentOrganization_MergeTorrentOrganizationUpdate_LatestOrganization} latestOrganization - Latest organization.
 *
 * @returns {Web_TorrentOrganization_MergeTorrentOrganizationUpdate_Returns}
 *
 * @since 2.0.0
 */
export const mergeTorrentOrganizationUpdate = (
  openedOrganization: Web_TorrentOrganization_MergeTorrentOrganizationUpdate_OpenedOrganization,
  editedOrganization: Web_TorrentOrganization_MergeTorrentOrganizationUpdate_EditedOrganization,
  latestOrganization: Web_TorrentOrganization_MergeTorrentOrganizationUpdate_LatestOrganization,
): Web_TorrentOrganization_MergeTorrentOrganizationUpdate_Returns => {
  const mergedLabels: Web_TorrentOrganization_MergeTorrentOrganizationUpdate_MergedLabels = latestOrganization['labels'].filter((label) => {
    return (
      editedOrganization['removedLabels'].some(
        (removedLabel) => normalizeTorrentOrganizationValue(removedLabel) === normalizeTorrentOrganizationValue(label),
      ) === false
      && editedOrganization['renamedLabels'].some(
        (rename) => normalizeTorrentOrganizationValue(rename['from']) === normalizeTorrentOrganizationValue(label),
      ) === false
    );
  });
  const renamedTargets: Web_TorrentOrganization_MergeTorrentOrganizationUpdate_RenamedTargets = editedOrganization['renamedLabels'].map((rename) => rename['to']);
  const addedLabels: Web_TorrentOrganization_MergeTorrentOrganizationUpdate_AddedLabels = editedOrganization['labels'].filter((label) => {
    return (
      openedOrganization['labels'].some(
        (openedLabel) => normalizeTorrentOrganizationValue(openedLabel) === normalizeTorrentOrganizationValue(label),
      ) === false
      && renamedTargets.some((target) => normalizeTorrentOrganizationValue(target) === normalizeTorrentOrganizationValue(label)) === false
    );
  });

  for (const label of [
    ...renamedTargets,
    ...addedLabels,
  ]) {
    if (mergedLabels.some((mergedLabel) => normalizeTorrentOrganizationValue(mergedLabel) === normalizeTorrentOrganizationValue(label)) === false) {
      mergedLabels.push(label);
    }
  }

  return {
    ...editedOrganization,
    expectedRevision: latestOrganization['revision'],
    labels: sortTorrentOrganizationValues(mergedLabels),
  };
};
