import type {
  Web_Api_TorrentOrganization,
  Web_Api_UpdateTorrentOrganizationInput,
} from '@/types/web/api.d.ts';
import type { Web_Components_TorrentOrganizationLabelDraft } from '@/types/web/components.d.ts';

/**
 * Torrent Organization.
 *
 * @since 2.4.1
 */
export type Web_TorrentOrganization_BuildTorrentOrganizationUpdate_ExpectedRevision = number;
export type Web_TorrentOrganization_BuildTorrentOrganizationUpdate_OpenedLabels = string[];
export type Web_TorrentOrganization_BuildTorrentOrganizationUpdate_Drafts = Web_Components_TorrentOrganizationLabelDraft[];
export type Web_TorrentOrganization_BuildTorrentOrganizationUpdate_Returns = Web_Api_UpdateTorrentOrganizationInput;
export type Web_TorrentOrganization_BuildTorrentOrganizationUpdate_SurvivingOriginals = string[];

/**
 * Torrent Organization.
 *
 * @since 2.4.1
 */
export type Web_TorrentOrganization_MergeTorrentOrganizationUpdate_OpenedOrganization = Web_Api_TorrentOrganization;
export type Web_TorrentOrganization_MergeTorrentOrganizationUpdate_EditedOrganization = Web_Api_UpdateTorrentOrganizationInput;
export type Web_TorrentOrganization_MergeTorrentOrganizationUpdate_LatestOrganization = Web_Api_TorrentOrganization;
export type Web_TorrentOrganization_MergeTorrentOrganizationUpdate_Returns = Web_Api_UpdateTorrentOrganizationInput;
export type Web_TorrentOrganization_MergeTorrentOrganizationUpdate_MergedLabels = string[];
export type Web_TorrentOrganization_MergeTorrentOrganizationUpdate_RenamedTargets = string[];
export type Web_TorrentOrganization_MergeTorrentOrganizationUpdate_AddedLabels = string[];

/**
 * Torrent Organization.
 *
 * @since 2.4.1
 */
export type Web_TorrentOrganization_NormalizeTorrentOrganizationValue_Value = string;
export type Web_TorrentOrganization_NormalizeTorrentOrganizationValue_Returns = string;

/**
 * Torrent Organization.
 *
 * @since 2.4.1
 */
export type Web_TorrentOrganization_SortTorrentOrganizationValues_Values = string[];
export type Web_TorrentOrganization_SortTorrentOrganizationValues_Returns = string[];
