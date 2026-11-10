/**
 * VPN Default Change - Gets move confirmation.
 *
 * Names the profile groups represented by the backend's torrent counts.
 * The dialog stays accurate when either group or both groups must move.
 *
 * @since 2.0.0
 */
export const defaultVPNMoveConfirmation = (
  connectionName: string,
  torrents: number,
  defaultProfileTorrents: number,
  followingProfileTorrents: number,
): string => {
  const torrentNoun: string = (torrents === 1) ? 'torrent' : 'torrents';
  const moveVerb: string = (torrents === 1) ? 'moves' : 'move';
  let sourceClause: string = '.';
  if (defaultProfileTorrents > 0 && followingProfileTorrents > 0) {
    sourceClause = ': from the Default profile and profiles that follow the default connection.';
  } else if (defaultProfileTorrents > 0) {
    sourceClause = ' from the Default profile.';
  } else if (followingProfileTorrents > 0) {
    sourceClause = ' from profiles that follow the default connection.';
  }

  return `Make ${connectionName} the default? ${String(torrents)} ${torrentNoun} ${moveVerb} to it${sourceClause}`;
};
