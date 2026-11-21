import type {
  Web_VpnDefaultChange_DefaultVpnMoveConfirmation_ConnectionName,
  Web_VpnDefaultChange_DefaultVpnMoveConfirmation_DefaultProfileTorrents,
  Web_VpnDefaultChange_DefaultVpnMoveConfirmation_FollowingProfileTorrents,
  Web_VpnDefaultChange_DefaultVpnMoveConfirmation_MoveVerb,
  Web_VpnDefaultChange_DefaultVpnMoveConfirmation_Returns,
  Web_VpnDefaultChange_DefaultVpnMoveConfirmation_SourceClause,
  Web_VpnDefaultChange_DefaultVpnMoveConfirmation_TorrentNoun,
  Web_VpnDefaultChange_DefaultVpnMoveConfirmation_Torrents,
} from '@/types/web/vpn-default-change.d.ts';

/**
 * Vpn Default Change - Default Vpn Move Confirmation.
 *
 * Names the profile groups represented by the backend's torrent counts.
 * The dialog stays accurate when either group or both groups must move.
 *
 * @param {Web_VpnDefaultChange_DefaultVpnMoveConfirmation_ConnectionName}           connectionName           - Connection name.
 * @param {Web_VpnDefaultChange_DefaultVpnMoveConfirmation_Torrents}                 torrents                 - Torrents.
 * @param {Web_VpnDefaultChange_DefaultVpnMoveConfirmation_DefaultProfileTorrents}   defaultProfileTorrents   - Default profile torrents.
 * @param {Web_VpnDefaultChange_DefaultVpnMoveConfirmation_FollowingProfileTorrents} followingProfileTorrents - Following profile torrents.
 *
 * @returns {Web_VpnDefaultChange_DefaultVpnMoveConfirmation_Returns}
 *
 * @since 2.0.0
 */
export const defaultVPNMoveConfirmation = (
  connectionName: Web_VpnDefaultChange_DefaultVpnMoveConfirmation_ConnectionName,
  torrents: Web_VpnDefaultChange_DefaultVpnMoveConfirmation_Torrents,
  defaultProfileTorrents: Web_VpnDefaultChange_DefaultVpnMoveConfirmation_DefaultProfileTorrents,
  followingProfileTorrents: Web_VpnDefaultChange_DefaultVpnMoveConfirmation_FollowingProfileTorrents,
): Web_VpnDefaultChange_DefaultVpnMoveConfirmation_Returns => {
  const torrentNoun: Web_VpnDefaultChange_DefaultVpnMoveConfirmation_TorrentNoun = (torrents === 1) ? 'torrent' : 'torrents';
  const moveVerb: Web_VpnDefaultChange_DefaultVpnMoveConfirmation_MoveVerb = (torrents === 1) ? 'moves' : 'move';
  let sourceClause: Web_VpnDefaultChange_DefaultVpnMoveConfirmation_SourceClause = '.';
  if (defaultProfileTorrents > 0 && followingProfileTorrents > 0) {
    sourceClause = ': from the Default profile and profiles that follow the default connection.';
  } else if (defaultProfileTorrents > 0) {
    sourceClause = ' from the Default profile.';
  } else if (followingProfileTorrents > 0) {
    sourceClause = ' from profiles that follow the default connection.';
  }

  return `Make ${connectionName} the default? ${String(torrents)} ${torrentNoun} ${moveVerb} to it${sourceClause}`;
};
