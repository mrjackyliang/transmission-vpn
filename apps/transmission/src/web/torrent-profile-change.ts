import type {
  Web_TorrentProfileChange_DescribeTorrentProfileChange_CurrentConnectionId,
  Web_TorrentProfileChange_DescribeTorrentProfileChange_DownloadDirectory,
  Web_TorrentProfileChange_DescribeTorrentProfileChange_FolderHint,
  Web_TorrentProfileChange_DescribeTorrentProfileChange_Returns,
  Web_TorrentProfileChange_DescribeTorrentProfileChange_TargetConnectionId,
  Web_TorrentProfileChange_DescribeTorrentProfileChange_TargetConnectionName,
  Web_TorrentProfileChange_RemapSelectedTorrentIds_NextIds,
  Web_TorrentProfileChange_RemapSelectedTorrentIds_NextIdsByHash,
  Web_TorrentProfileChange_RemapSelectedTorrentIds_PreviousHash,
  Web_TorrentProfileChange_RemapSelectedTorrentIds_PreviousHashesById,
  Web_TorrentProfileChange_RemapSelectedTorrentIds_Returns,
  Web_TorrentProfileChange_RemapSelectedTorrentIds_SelectedIds,
  Web_TorrentProfileChange_RemapSelectedTorrentIds_Torrents,
  Web_TorrentProfileChange_TorrentProfileRefreshId_CurrentId,
  Web_TorrentProfileChange_TorrentProfileRefreshId_Hash,
  Web_TorrentProfileChange_TorrentProfileRefreshId_MovedResult,
  Web_TorrentProfileChange_TorrentProfileRefreshId_Results,
  Web_TorrentProfileChange_TorrentProfileRefreshId_Returns,
} from '@/types/web/torrent-profile-change.d.ts';

/**
 * Torrent Profile Change - Describe Torrent Profile Change.
 *
 * Explains the target folder for every profile change and adds the VPN target
 * only when the effective connection changes.
 *
 * @param {Web_TorrentProfileChange_DescribeTorrentProfileChange_DownloadDirectory}    downloadDirectory    - Download directory.
 * @param {Web_TorrentProfileChange_DescribeTorrentProfileChange_CurrentConnectionId}  currentConnectionID  - Current connection i d.
 * @param {Web_TorrentProfileChange_DescribeTorrentProfileChange_TargetConnectionId}   targetConnectionID   - Target connection i d.
 * @param {Web_TorrentProfileChange_DescribeTorrentProfileChange_TargetConnectionName} targetConnectionName - Target connection name.
 *
 * @returns {Web_TorrentProfileChange_DescribeTorrentProfileChange_Returns}
 *
 * @since 2.0.0
 */
export const describeTorrentProfileChange = (
  downloadDirectory: Web_TorrentProfileChange_DescribeTorrentProfileChange_DownloadDirectory,
  currentConnectionID: Web_TorrentProfileChange_DescribeTorrentProfileChange_CurrentConnectionId,
  targetConnectionID: Web_TorrentProfileChange_DescribeTorrentProfileChange_TargetConnectionId,
  targetConnectionName: Web_TorrentProfileChange_DescribeTorrentProfileChange_TargetConnectionName,
): Web_TorrentProfileChange_DescribeTorrentProfileChange_Returns => {
  const folderHint: Web_TorrentProfileChange_DescribeTorrentProfileChange_FolderHint = `Files move to ${downloadDirectory}.`;

  if (currentConnectionID === targetConnectionID) {
    return folderHint;
  }

  return `${folderHint} Moves to ${targetConnectionName}.`;
};

/**
 * Torrent Profile Change - Torrent Profile Refresh ID.
 *
 * Cross-connection moves replace Transmission's facade identifier. A successful
 * move follows that new identity; failed or same-connection outcomes keep the
 * currently open identifier.
 *
 * @param {Web_TorrentProfileChange_TorrentProfileRefreshId_CurrentId} currentID - Current i d.
 * @param {Web_TorrentProfileChange_TorrentProfileRefreshId_Hash}      hash      - Hash.
 * @param {Web_TorrentProfileChange_TorrentProfileRefreshId_Results}   results   - Results.
 *
 * @returns {Web_TorrentProfileChange_TorrentProfileRefreshId_Returns}
 *
 * @since 2.0.0
 */
export const torrentProfileRefreshID = (
  currentID: Web_TorrentProfileChange_TorrentProfileRefreshId_CurrentId,
  hash: Web_TorrentProfileChange_TorrentProfileRefreshId_Hash,
  results: Web_TorrentProfileChange_TorrentProfileRefreshId_Results,
): Web_TorrentProfileChange_TorrentProfileRefreshId_Returns => {
  const movedResult: Web_TorrentProfileChange_TorrentProfileRefreshId_MovedResult = results.find(
    (result) => result['hash'].toLowerCase() === hash.toLowerCase(),
  );

  if (movedResult === undefined) {
    return currentID;
  }

  return (movedResult['result'] !== 'failed' && movedResult['id'] !== undefined) ? movedResult['id'] : currentID;
};

/**
 * Torrent Profile Change - Remap Selected Torrent I Ds.
 *
 * Keeps bulk selections attached to their stable hashes when a cross-connection
 * move gives one or more torrents new facade identifiers.
 *
 * @param {Web_TorrentProfileChange_RemapSelectedTorrentIds_SelectedIds}        selectedIDs        - Selected i ds.
 * @param {Web_TorrentProfileChange_RemapSelectedTorrentIds_PreviousHashesById} previousHashesByID - Previous hashes by i d.
 * @param {Web_TorrentProfileChange_RemapSelectedTorrentIds_Torrents}           torrents           - Torrents.
 *
 * @returns {Web_TorrentProfileChange_RemapSelectedTorrentIds_Returns}
 *
 * @since 2.0.0
 */
export const remapSelectedTorrentIDs = (
  selectedIDs: Web_TorrentProfileChange_RemapSelectedTorrentIds_SelectedIds,
  previousHashesByID: Web_TorrentProfileChange_RemapSelectedTorrentIds_PreviousHashesById,
  torrents: Web_TorrentProfileChange_RemapSelectedTorrentIds_Torrents,
): Web_TorrentProfileChange_RemapSelectedTorrentIds_Returns => {
  const nextIDsByHash: Web_TorrentProfileChange_RemapSelectedTorrentIds_NextIdsByHash = new Map();

  for (const torrent of torrents) {
    nextIDsByHash.set(torrent['hashString'].toLowerCase(), torrent['id']);
  }

  const nextIDs: Web_TorrentProfileChange_RemapSelectedTorrentIds_NextIds = selectedIDs.map((identifier) => {
    const previousHash: Web_TorrentProfileChange_RemapSelectedTorrentIds_PreviousHash = previousHashesByID.get(identifier);

    if (previousHash !== undefined) {
      return nextIDsByHash.get(previousHash.toLowerCase());
    }

    return (torrents.some((torrent) => torrent['id'] === identifier) === true) ? identifier : undefined;
  }).filter((identifier) => identifier !== undefined);

  return [...new Set(nextIDs)];
};
