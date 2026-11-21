import type { z } from 'zod';

import type {
  Web_Api_AddTorrentInput,
  Web_Api_ClaimInput,
  Web_Api_CreateDirectoryInput,
  Web_Api_CreateVpnConnectionInput,
  Web_Api_CustomProfileInput,
  Web_Api_DeleteVpnConnectionInput,
  Web_Api_JsonValue,
  Web_Api_LoginInput,
  Web_Api_ProviderTunnel,
  Web_Api_RemoveTorrentsInput,
  Web_Api_RenameTorrentPathInput,
  Web_Api_RPCLoginInput,
  Web_Api_Schema,
  Web_Api_SetDefaultVpnConnectionInput,
  Web_Api_SetTorrentProfileInput,
  Web_Api_TorrentActionInput,
  Web_Api_TorrentChanges,
  Web_Api_UpdateDefaultTorrentProfileInput,
  Web_Api_UpdateRPCLoginInput,
  Web_Api_UpdateSettingsInput,
  Web_Api_UpdateTorrentOrganizationInput,
  Web_Api_UpdateTorrentProfileInput,
  Web_Api_UpdateTorrentsInput,
  Web_Api_UpdateVpnConnectionInput,
  Web_Api_UpdateWebProxyLoginInput,
  Web_Api_VpnConnectionInput,
  Web_Api_WebProxyLoginInput,
} from '@/types/web/api.d.ts';

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_AddTorrentInputSchema = Web_Api_Schema<Web_Api_AddTorrentInput>;
export type Web_FormValidation_AddTorrentInputSchema_SourceCount = number;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_BlocklistURLSchema_ParsedURL = URL;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_ClaimInputSchema = Web_Api_Schema<Web_Api_ClaimInput>;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_CreateDirectoryInputSchema = Web_Api_Schema<Web_Api_CreateDirectoryInput>;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_CreateVpnConnectionInputSchema = Web_Api_Schema<Web_Api_CreateVpnConnectionInput>;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_CustomProfileInputSchema = Web_Api_Schema<Web_Api_CustomProfileInput>;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_DeleteVpnConnectionInputSchema = Web_Api_Schema<Web_Api_DeleteVpnConnectionInput>;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_DownloadDataPathRootMessage = string;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_FormatConsoleError_Message = string;
export type Web_FormValidation_FormatConsoleError_Returns = string;
export type Web_FormValidation_FormatConsoleError_FormattedMessage = string;
export type Web_FormValidation_FormatConsoleError_SettingKey = string;
export type Web_FormValidation_FormatConsoleError_SettingTitle = string;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_HasUniqueNumbers_Values = number[];
export type Web_FormValidation_HasUniqueNumbers_Returns = boolean;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_HasUniqueStrings_Values = string[];
export type Web_FormValidation_HasUniqueStrings_CaseSensitive = boolean;
export type Web_FormValidation_HasUniqueStrings_Returns = boolean;
export type Web_FormValidation_HasUniqueStrings_NormalizedValues = string[];

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_IsAdministratorUsername_Value = string;
export type Web_FormValidation_IsAdministratorUsername_Returns = boolean;
export type Web_FormValidation_IsAdministratorUsername_AllowedCharacters = string;
export type Web_FormValidation_IsAdministratorUsername_FirstCharacter = string;
export type Web_FormValidation_IsAdministratorUsername_FirstCharacterAllowed = boolean;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_IsIdentifier_Value = string;
export type Web_FormValidation_IsIdentifier_Returns = boolean;
export type Web_FormValidation_IsIdentifier_AllowedCharacters = string;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_IsNormalizedDataPath_Value = string;
export type Web_FormValidation_IsNormalizedDataPath_Returns = boolean;
export type Web_FormValidation_IsNormalizedDataPath_PathSegment = string;
export type Web_FormValidation_IsNormalizedDataPath_PathSegments = Web_FormValidation_IsNormalizedDataPath_PathSegment[];

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_IsPlainName_Value = string;
export type Web_FormValidation_IsPlainName_Returns = boolean;
export type Web_FormValidation_IsPlainName_CharacterCode = number;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_IsTorrentHash_Value = string;
export type Web_FormValidation_IsTorrentHash_Returns = boolean;
export type Web_FormValidation_IsTorrentHash_HexadecimalCharacters = string;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_IsTorrentURL_Value = string;
export type Web_FormValidation_IsTorrentURL_Returns = boolean;
export type Web_FormValidation_IsTorrentURL_ParsedURL = URL;
export type Web_FormValidation_IsTorrentURL_Protocol = string;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_JsonValueSchema = Web_Api_Schema<Web_Api_JsonValue>;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_LoginInputSchema = Web_Api_Schema<Web_Api_LoginInput>;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_MaximumMetainfoLength = number;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_MaximumProfileLength = number;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_MaximumTorrentFileBytes = number;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_MaximumTrackerListLength = number;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_ParseDataPath_Value = string;
export type Web_FormValidation_ParseDataPath_Returns = string;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_ParseDefaultTorrentProfileInput_IncompleteDirectory = string;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_ParseInput_Schema<Value> = Web_Api_Schema<Value>;
export type Web_FormValidation_ParseInput_Value = unknown;
export type Web_FormValidation_ParseInput_Result<Value> = z.ZodSafeParseResult<Value>;
export type Web_FormValidation_ParseInput_FirstIssue = z.core.$ZodIssue | undefined;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_ParseProviderID_Value = string;
export type Web_FormValidation_ParseProviderID_Returns = string;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_ParseTokenID_Value = string;
export type Web_FormValidation_ParseTokenID_Returns = string;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_ParseTorrentProfileInput_IncompleteDirectory = string;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_ParseUpdateDefaultTorrentProfileInput_IncompleteDirectory = string;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_ParseUpdateSettingsInput_IncompleteDirectory = string;
export type Web_FormValidation_ParseUpdateSettingsInput_DownloadDirectory = Web_Api_JsonValue | undefined;
export type Web_FormValidation_ParseUpdateSettingsInput_IncompleteDirectoryChanges = boolean;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_ParseUpdateTorrentProfileInput_IncompleteDirectory = string;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_ProviderRequiredMessage = string;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_RemoveTorrentsInputSchema = Web_Api_Schema<Web_Api_RemoveTorrentsInput>;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_RenameTorrentPathInputSchema = Web_Api_Schema<Web_Api_RenameTorrentPathInput>;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_RpcLoginInputSchema = Web_Api_Schema<Web_Api_RPCLoginInput>;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_SetDefaultVpnConnectionInputSchema = Web_Api_Schema<Web_Api_SetDefaultVpnConnectionInput>;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_SettingTitles = Record<string, string>;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_SettingValueSchemas = Record<string, z.ZodType>;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_SetTorrentProfileInputSchema = Web_Api_Schema<Web_Api_SetTorrentProfileInput>;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_TorrentActionInputSchema = Web_Api_Schema<Web_Api_TorrentActionInput>;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_TorrentChangesSchema = Web_Api_Schema<Web_Api_TorrentChanges>;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_UpdateDefaultTorrentProfileInputSchema = Web_Api_Schema<Web_Api_UpdateDefaultTorrentProfileInput>;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_UpdateRPCLoginInputSchema = Web_Api_Schema<Web_Api_UpdateRPCLoginInput>;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_UpdateSettingsInputSchema = Web_Api_Schema<Web_Api_UpdateSettingsInput>;
export type Web_FormValidation_UpdateSettingsInputSchema_ChangeEntry = [string, Web_Api_JsonValue];
export type Web_FormValidation_UpdateSettingsInputSchema_ChangeEntries = Web_FormValidation_UpdateSettingsInputSchema_ChangeEntry[];
export type Web_FormValidation_UpdateSettingsInputSchema_Key = string;
export type Web_FormValidation_UpdateSettingsInputSchema_Value = Web_Api_JsonValue;
export type Web_FormValidation_UpdateSettingsInputSchema_ValueSchema = z.ZodType | undefined;
export type Web_FormValidation_UpdateSettingsInputSchema_Result = z.ZodSafeParseResult<unknown>;
export type Web_FormValidation_UpdateSettingsInputSchema_FirstIssue = z.core.$ZodIssue | undefined;
export type Web_FormValidation_UpdateSettingsInputSchema_SettingTitle = string;
export type Web_FormValidation_UpdateSettingsInputSchema_FirstIssueMessage = string;
export type Web_FormValidation_UpdateSettingsInputSchema_IssueMessage = string;
export type Web_FormValidation_UpdateSettingsInputSchema_Message = string;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_UpdateTorrentOrganizationInputSchema = Web_Api_Schema<Web_Api_UpdateTorrentOrganizationInput>;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_UpdateTorrentProfileInputSchema = Web_Api_Schema<Web_Api_UpdateTorrentProfileInput>;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_UpdateTorrentsInputSchema = Web_Api_Schema<Web_Api_UpdateTorrentsInput>;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_UpdateVpnConnectionInputSchema = Web_Api_Schema<Web_Api_UpdateVpnConnectionInput>;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_UpdateWebProxyLoginInputSchema = Web_Api_Schema<Web_Api_UpdateWebProxyLoginInput>;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_ValidateOutsideIncompleteDirectory_Value = string;
export type Web_FormValidation_ValidateOutsideIncompleteDirectory_IncompleteDirectory = string;
export type Web_FormValidation_ValidateOutsideIncompleteDirectory_Returns = void;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_ValidatePasswordConfirmation_Password = string;
export type Web_FormValidation_ValidatePasswordConfirmation_Confirmation = string;
export type Web_FormValidation_ValidatePasswordConfirmation_Returns = void;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_ValidateProviderCredentials_Tunnel = Web_Api_ProviderTunnel | undefined;
export type Web_FormValidation_ValidateProviderCredentials_Credentials = Record<string, string>;
export type Web_FormValidation_ValidateProviderCredentials_SavedCredentials = string[];
export type Web_FormValidation_ValidateProviderCredentials_Returns = void;
export type Web_FormValidation_ValidateProviderCredentials_Value = string;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_VpnConnectionInputSchema = Web_Api_Schema<Web_Api_VpnConnectionInput>;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_WebProxyLoginInputSchema = Web_Api_Schema<Web_Api_WebProxyLoginInput>;

/**
 * Form Validation.
 *
 * @since 2.4.1
 */
export type Web_FormValidation_WireGuardKeyPattern = RegExp;
