import type {
  Web_Api_MovedTorrent,
  Web_Api_Torrent,
} from '@/types/web/api.d.ts';

/**
 * Torrent Profile Change - Describes move.
 *
 * Explains the target folder for every profile change and adds the VPN target
 * only when the effective connection changes.
 *
 * @since 2.0.0
 */
export const describeTorrentProfileChange = (
  downloadDirectory: string,
  currentConnectionID: string | undefined,
  targetConnectionID: string | undefined,
  targetConnectionName: string,
): string => {
  const folderHint: string = `Files move to ${downloadDirectory}.`;
  if (currentConnectionID === targetConnectionID) {
    return folderHint;
  }

  return `${folderHint} Moves to ${targetConnectionName}.`;
};

/**
 * Torrent Profile Change - Refresh identifier.
 *
 * Cross-connection moves replace Transmission's facade identifier. A successful
 * move follows that new identity; failed or same-connection outcomes keep the
 * currently open identifier.
 *
 * @since 2.0.0
 */
export const torrentProfileRefreshID = (
  currentID: number,
  hash: string,
  results: Web_Api_MovedTorrent[],
): number => {
  const movedResult: Web_Api_MovedTorrent | undefined = results.find(
    (result: Web_Api_MovedTorrent): boolean => result['hash'].toLowerCase() === hash.toLowerCase(),
  );

  return (movedResult?.['result'] !== 'failed' && movedResult?.['id'] !== undefined) ? movedResult['id'] : currentID;
};

/**
 * Torrent Profile Change - Remaps selected identifiers.
 *
 * Keeps bulk selections attached to their stable hashes when a cross-connection
 * move gives one or more torrents new facade identifiers.
 *
 * @since 2.0.0
 */
export const remapSelectedTorrentIDs = (
  selectedIDs: number[],
  previousHashesByID: ReadonlyMap<number, string>,
  torrents: Web_Api_Torrent[],
): number[] => {
  const nextIDsByHash: Map<string, number> = new Map(
    torrents.map((torrent: Web_Api_Torrent): [string, number] => [
      torrent['hashString'].toLowerCase(),
      torrent['id'],
    ]),
  );
  const nextIDs: number[] = selectedIDs.map((identifier: number): number | undefined => {
    const previousHash: string | undefined = previousHashesByID.get(identifier);
    if (previousHash !== undefined) {
      return nextIDsByHash.get(previousHash.toLowerCase());
    }

    return (torrents.some((torrent: Web_Api_Torrent): boolean => torrent['id'] === identifier)) ? identifier : undefined;
  }).filter((identifier: number | undefined): identifier is number => identifier !== undefined);

  return [...new Set(nextIDs)];
};
