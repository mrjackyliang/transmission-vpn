import type {
  Web_Api_AddTorrentInput,
  Web_Api_ProviderTunnel,
  Web_Api_TorrentProfileInput,
  Web_Api_VpnConfigurationInput,
} from '@/types/web/api.d.ts';

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Tests_Web_FormValidation_Configuration = Web_Api_VpnConfigurationInput;
export type Tests_Web_FormValidation_IncompleteDirectory = string;
export type Tests_Web_FormValidation_LargestMetainfoLength = number;
export type Tests_Web_FormValidation_Message = string;
export type Tests_Web_FormValidation_MullvadTunnel = Web_Api_ProviderTunnel;
export type Tests_Web_FormValidation_ParsedInput = Web_Api_AddTorrentInput;
export type Tests_Web_FormValidation_ParsedMetainfo = string | undefined;
export type Tests_Web_FormValidation_PrivateKey = string;
export type Tests_Web_FormValidation_Profile = Web_Api_TorrentProfileInput;
export type Tests_Web_FormValidation_ValidProfile = Web_Api_TorrentProfileInput;
