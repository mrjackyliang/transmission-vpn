import type {
  Web_Api_TorrentOrganization,
  Web_Api_UpdateTorrentOrganizationInput,
} from '@/types/web/api.d.ts';

/**
 * Torrent Organization.
 *
 * @since 2.4.1
 */
export type Tests_Web_TorrentOrganization_EditedOrganization = Web_Api_UpdateTorrentOrganizationInput;
export type Tests_Web_TorrentOrganization_OpenedOrganization = Web_Api_TorrentOrganization;
export type Tests_Web_TorrentOrganization_Result = Web_Api_UpdateTorrentOrganizationInput;

/**
 * Torrent Organization.
 *
 * @since 2.4.1
 */
export type Tests_Web_TorrentOrganization_Organization_Revision = number;
export type Tests_Web_TorrentOrganization_Organization_Labels = string[];
export type Tests_Web_TorrentOrganization_Organization_Returns = Web_Api_TorrentOrganization;
