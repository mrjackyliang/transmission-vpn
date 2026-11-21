import { z } from 'zod';

import {
  customProfileReferencePattern,
  exitStatusPattern,
  invalidNumberPattern,
  safeNamePattern,
  settingKeyPattern,
  tooBigNumberPattern,
  tooSmallNumberPattern,
  torrentProfileIdPattern,
  wireGuardPublicKeyPattern,
} from '@/web/regex.js';

import type {
  Web_Api_AddTorrentInput,
  Web_Api_ClaimInput,
  Web_Api_CreateDirectoryInput,
  Web_Api_CreateVpnConnectionInput,
  Web_Api_CustomProfileInput,
  Web_Api_DefaultTorrentProfileInput,
  Web_Api_DeleteVpnConnectionInput,
  Web_Api_LoginInput,
  Web_Api_RemoveTorrentsInput,
  Web_Api_RenameTorrentPathInput,
  Web_Api_RPCLoginInput,
  Web_Api_SetDefaultVpnConnectionInput,
  Web_Api_SetTorrentProfileInput,
  Web_Api_TorrentActionInput,
  Web_Api_TorrentProfileInput,
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
import type {
  Web_FormValidation_AddTorrentInputSchema,
  Web_FormValidation_AddTorrentInputSchema_SourceCount,
  Web_FormValidation_BlocklistURLSchema_ParsedURL,
  Web_FormValidation_ClaimInputSchema,
  Web_FormValidation_CreateDirectoryInputSchema,
  Web_FormValidation_CreateVpnConnectionInputSchema,
  Web_FormValidation_CustomProfileInputSchema,
  Web_FormValidation_DeleteVpnConnectionInputSchema,
  Web_FormValidation_DownloadDataPathRootMessage,
  Web_FormValidation_FormatConsoleError_FormattedMessage,
  Web_FormValidation_FormatConsoleError_Message,
  Web_FormValidation_FormatConsoleError_Returns,
  Web_FormValidation_FormatConsoleError_SettingKey,
  Web_FormValidation_FormatConsoleError_SettingTitle,
  Web_FormValidation_HasUniqueNumbers_Returns,
  Web_FormValidation_HasUniqueNumbers_Values,
  Web_FormValidation_HasUniqueStrings_CaseSensitive,
  Web_FormValidation_HasUniqueStrings_NormalizedValues,
  Web_FormValidation_HasUniqueStrings_Returns,
  Web_FormValidation_HasUniqueStrings_Values,
  Web_FormValidation_IsAdministratorUsername_AllowedCharacters,
  Web_FormValidation_IsAdministratorUsername_FirstCharacter,
  Web_FormValidation_IsAdministratorUsername_FirstCharacterAllowed,
  Web_FormValidation_IsAdministratorUsername_Returns,
  Web_FormValidation_IsAdministratorUsername_Value,
  Web_FormValidation_IsIdentifier_AllowedCharacters,
  Web_FormValidation_IsIdentifier_Returns,
  Web_FormValidation_IsIdentifier_Value,
  Web_FormValidation_IsNormalizedDataPath_PathSegments,
  Web_FormValidation_IsNormalizedDataPath_Returns,
  Web_FormValidation_IsNormalizedDataPath_Value,
  Web_FormValidation_IsPlainName_CharacterCode,
  Web_FormValidation_IsPlainName_Returns,
  Web_FormValidation_IsPlainName_Value,
  Web_FormValidation_IsTorrentHash_HexadecimalCharacters,
  Web_FormValidation_IsTorrentHash_Returns,
  Web_FormValidation_IsTorrentHash_Value,
  Web_FormValidation_IsTorrentURL_ParsedURL,
  Web_FormValidation_IsTorrentURL_Protocol,
  Web_FormValidation_IsTorrentURL_Returns,
  Web_FormValidation_IsTorrentURL_Value,
  Web_FormValidation_JsonValueSchema,
  Web_FormValidation_LoginInputSchema,
  Web_FormValidation_MaximumMetainfoLength,
  Web_FormValidation_MaximumProfileLength,
  Web_FormValidation_MaximumTorrentFileBytes,
  Web_FormValidation_MaximumTrackerListLength,
  Web_FormValidation_ParseDataPath_Returns,
  Web_FormValidation_ParseDataPath_Value,
  Web_FormValidation_ParseDefaultTorrentProfileInput_IncompleteDirectory,
  Web_FormValidation_ParseInput_FirstIssue,
  Web_FormValidation_ParseInput_Result,
  Web_FormValidation_ParseInput_Schema,
  Web_FormValidation_ParseInput_Value,
  Web_FormValidation_ParseProviderID_Returns,
  Web_FormValidation_ParseProviderID_Value,
  Web_FormValidation_ParseTokenID_Returns,
  Web_FormValidation_ParseTokenID_Value,
  Web_FormValidation_ParseTorrentProfileInput_IncompleteDirectory,
  Web_FormValidation_ParseUpdateDefaultTorrentProfileInput_IncompleteDirectory,
  Web_FormValidation_ParseUpdateSettingsInput_DownloadDirectory,
  Web_FormValidation_ParseUpdateSettingsInput_IncompleteDirectory,
  Web_FormValidation_ParseUpdateSettingsInput_IncompleteDirectoryChanges,
  Web_FormValidation_ParseUpdateTorrentProfileInput_IncompleteDirectory,
  Web_FormValidation_ProviderRequiredMessage,
  Web_FormValidation_RemoveTorrentsInputSchema,
  Web_FormValidation_RenameTorrentPathInputSchema,
  Web_FormValidation_RpcLoginInputSchema,
  Web_FormValidation_SetDefaultVpnConnectionInputSchema,
  Web_FormValidation_SettingTitles,
  Web_FormValidation_SettingValueSchemas,
  Web_FormValidation_SetTorrentProfileInputSchema,
  Web_FormValidation_TorrentActionInputSchema,
  Web_FormValidation_TorrentChangesSchema,
  Web_FormValidation_UpdateDefaultTorrentProfileInputSchema,
  Web_FormValidation_UpdateRPCLoginInputSchema,
  Web_FormValidation_UpdateSettingsInputSchema,
  Web_FormValidation_UpdateSettingsInputSchema_ChangeEntries,
  Web_FormValidation_UpdateSettingsInputSchema_FirstIssue,
  Web_FormValidation_UpdateSettingsInputSchema_FirstIssueMessage,
  Web_FormValidation_UpdateSettingsInputSchema_IssueMessage,
  Web_FormValidation_UpdateSettingsInputSchema_Key,
  Web_FormValidation_UpdateSettingsInputSchema_Message,
  Web_FormValidation_UpdateSettingsInputSchema_Result,
  Web_FormValidation_UpdateSettingsInputSchema_SettingTitle,
  Web_FormValidation_UpdateSettingsInputSchema_Value,
  Web_FormValidation_UpdateSettingsInputSchema_ValueSchema,
  Web_FormValidation_UpdateTorrentOrganizationInputSchema,
  Web_FormValidation_UpdateTorrentProfileInputSchema,
  Web_FormValidation_UpdateTorrentsInputSchema,
  Web_FormValidation_UpdateVpnConnectionInputSchema,
  Web_FormValidation_UpdateWebProxyLoginInputSchema,
  Web_FormValidation_ValidateOutsideIncompleteDirectory_IncompleteDirectory,
  Web_FormValidation_ValidateOutsideIncompleteDirectory_Returns,
  Web_FormValidation_ValidateOutsideIncompleteDirectory_Value,
  Web_FormValidation_ValidatePasswordConfirmation_Confirmation,
  Web_FormValidation_ValidatePasswordConfirmation_Password,
  Web_FormValidation_ValidatePasswordConfirmation_Returns,
  Web_FormValidation_ValidateProviderCredentials_Credentials,
  Web_FormValidation_ValidateProviderCredentials_Returns,
  Web_FormValidation_ValidateProviderCredentials_SavedCredentials,
  Web_FormValidation_ValidateProviderCredentials_Tunnel,
  Web_FormValidation_ValidateProviderCredentials_Value,
  Web_FormValidation_VpnConnectionInputSchema,
  Web_FormValidation_WebProxyLoginInputSchema,
  Web_FormValidation_WireGuardKeyPattern,
} from '@/types/web/form-validation.d.ts';

/**
 * Form Validation - Maximum Torrent File Bytes.
 *
 * Matches the control API's 16 MiB limit for one added .torrent file. The add
 * dialog skips larger files before reading them into base64.
 *
 * @since 2.3.0
 */
export const maximumTorrentFileBytes: Web_FormValidation_MaximumTorrentFileBytes = 16 * 1024 * 1024;

/**
 * Form Validation - Maximum Metainfo Length.
 *
 * Holds the base64 length of a .torrent file at the byte limit, so validation
 * accepts exactly what the control API accepts after decoding.
 *
 * @since 2.3.0
 */
const maximumMetainfoLength: Web_FormValidation_MaximumMetainfoLength = Math.ceil(maximumTorrentFileBytes / 3) * 4;

/**
 * Form Validation - Maximum Profile Length.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const maximumProfileLength: Web_FormValidation_MaximumProfileLength = 900_000;

/**
 * Form Validation - Maximum Tracker List Length.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const maximumTrackerListLength: Web_FormValidation_MaximumTrackerListLength = 256 * 1024;

/**
 * Form Validation - Is Plain Name.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_FormValidation_IsPlainName_Value} value - Value.
 *
 * @returns {Web_FormValidation_IsPlainName_Returns}
 *
 * @since 2.0.0
 */
const isPlainName = (value: Web_FormValidation_IsPlainName_Value): Web_FormValidation_IsPlainName_Returns => {
  if (value === '.' || value === '..') {
    return false;
  }

  for (const character of value) {
    const characterCode: Web_FormValidation_IsPlainName_CharacterCode = character.codePointAt(0) ?? 0;

    if (
      character === '/'
      || character === '\\'
      || characterCode < 32
      || characterCode === 127
    ) {
      return false;
    }
  }

  return true;
};

/**
 * Form Validation - Is Administrator Username.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_FormValidation_IsAdministratorUsername_Value} value - Value.
 *
 * @returns {Web_FormValidation_IsAdministratorUsername_Returns}
 *
 * @since 2.0.0
 */
const isAdministratorUsername = (value: Web_FormValidation_IsAdministratorUsername_Value): Web_FormValidation_IsAdministratorUsername_Returns => {
  const allowedCharacters: Web_FormValidation_IsAdministratorUsername_AllowedCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-';
  const firstCharacter: Web_FormValidation_IsAdministratorUsername_FirstCharacter = value.slice(0, 1);
  const firstCharacterAllowed: Web_FormValidation_IsAdministratorUsername_FirstCharacterAllowed = firstCharacter !== '.'
    && firstCharacter !== '_'
    && firstCharacter !== '-'
    && allowedCharacters.includes(firstCharacter);

  return firstCharacterAllowed && [...value].every(
    (character) => allowedCharacters.includes(character),
  );
};

/**
 * Form Validation - Is Identifier.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_FormValidation_IsIdentifier_Value} value - Value.
 *
 * @returns {Web_FormValidation_IsIdentifier_Returns}
 *
 * @since 2.0.0
 */
const isIdentifier = (value: Web_FormValidation_IsIdentifier_Value): Web_FormValidation_IsIdentifier_Returns => {
  const allowedCharacters: Web_FormValidation_IsIdentifier_AllowedCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._:-';

  return [...value].every(
    (character) => allowedCharacters.includes(character),
  );
};

/**
 * Form Validation - Is Torrent Hash.
 *
 * Accepts Transmission's 40-character SHA-1 and 64-character SHA-256 forms.
 * The API normalizes accepted values to lowercase before routing them.
 *
 * @param {Web_FormValidation_IsTorrentHash_Value} value - Value.
 *
 * @returns {Web_FormValidation_IsTorrentHash_Returns}
 *
 * @since 2.0.0
 */
const isTorrentHash = (value: Web_FormValidation_IsTorrentHash_Value): Web_FormValidation_IsTorrentHash_Returns => {
  const hexadecimalCharacters: Web_FormValidation_IsTorrentHash_HexadecimalCharacters = '0123456789abcdefABCDEF';

  return (
    (
      value.length === 40
      || value.length === 64
    )
    && [...value].every(
      (character) => hexadecimalCharacters.includes(character),
    )
  );
};

/**
 * Form Validation - Is Normalized Data Path.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_FormValidation_IsNormalizedDataPath_Value} value - Value.
 *
 * @returns {Web_FormValidation_IsNormalizedDataPath_Returns}
 *
 * @since 2.0.0
 */
const isNormalizedDataPath = (value: Web_FormValidation_IsNormalizedDataPath_Value): Web_FormValidation_IsNormalizedDataPath_Returns => {
  if (value === '/data') {
    return true;
  }
  if (value.startsWith('/data/') === false || value.endsWith('/') === true) {
    return false;
  }

  const pathSegments: Web_FormValidation_IsNormalizedDataPath_PathSegments = value.slice('/data/'.length).split('/');

  return pathSegments.every((pathSegment) => (
    pathSegment !== ''
    && pathSegment !== '.'
    && pathSegment !== '..'
  ));
};

/**
 * Form Validation - Is Torrent URL.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_FormValidation_IsTorrentURL_Value} value - Value.
 *
 * @returns {Web_FormValidation_IsTorrentURL_Returns}
 *
 * @since 2.0.0
 */
const isTorrentURL = (value: Web_FormValidation_IsTorrentURL_Value): Web_FormValidation_IsTorrentURL_Returns => {
  try {
    const parsedURL: Web_FormValidation_IsTorrentURL_ParsedURL = new URL(value);
    const protocol: Web_FormValidation_IsTorrentURL_Protocol = parsedURL.protocol.toLowerCase();
    if (protocol === 'magnet:') {
      return parsedURL.searchParams.get('xt') !== null;
    }

    return (
      (
        protocol === 'http:'
        || protocol === 'https:'
      )
      && parsedURL.hostname !== ''
      && parsedURL.username === ''
      && parsedURL.password === ''
    );
  } catch {
    return false;
  }
};

/**
 * Form Validation - Has Unique Strings.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_FormValidation_HasUniqueStrings_Values}        values        - Values.
 * @param {Web_FormValidation_HasUniqueStrings_CaseSensitive} caseSensitive - Case sensitive.
 *
 * @returns {Web_FormValidation_HasUniqueStrings_Returns}
 *
 * @since 2.0.0
 */
const hasUniqueStrings = (values: Web_FormValidation_HasUniqueStrings_Values, caseSensitive: Web_FormValidation_HasUniqueStrings_CaseSensitive): Web_FormValidation_HasUniqueStrings_Returns => {
  const normalizedValues: Web_FormValidation_HasUniqueStrings_NormalizedValues = values.map((value) => (
    (caseSensitive === true) ? value : value.toLocaleLowerCase()
  ));

  return new Set(normalizedValues).size === normalizedValues.length;
};

/**
 * Form Validation - Has Unique Numbers.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_FormValidation_HasUniqueNumbers_Values} values - Values.
 *
 * @returns {Web_FormValidation_HasUniqueNumbers_Returns}
 *
 * @since 2.0.0
 */
const hasUniqueNumbers = (values: Web_FormValidation_HasUniqueNumbers_Values): Web_FormValidation_HasUniqueNumbers_Returns => new Set(values).size === values.length;

/**
 * Form Validation - Parse Input.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_FormValidation_ParseInput_Schema<Value>} schema - Schema.
 * @param {Web_FormValidation_ParseInput_Value}         value  - Value.
 *
 * @returns {Value}
 *
 * @since 2.0.0
 */
const parseInput = <Value>(
  schema: Web_FormValidation_ParseInput_Schema<Value>,
  value: Web_FormValidation_ParseInput_Value,
): Value => {
  const result: Web_FormValidation_ParseInput_Result<Value> = schema.safeParse(value);
  if (result.success === true) {
    return result.data;
  }

  const firstIssue: Web_FormValidation_ParseInput_FirstIssue = result.error.issues[0];

  if (firstIssue === undefined) {
    throw new Error('The form contains an invalid value.');
  }

  throw new Error(firstIssue.message);
};

/**
 * Form Validation - Setting Titles.
 *
 * Maps internal configuration keys to the labels people see in the console.
 * Error messages use these labels so implementation details never leak into the UI.
 *
 * @since 2.0.0
 */
const settingTitles: Web_FormValidation_SettingTitles = {
  'diagnostics.debugLogging': 'Debug logging',
  'rpc.compatibilityEnabled': 'Transmission-compatible RPC',
  'transmission.blocklistEnabled': 'Enable blocklists',
  'transmission.blocklistSources': 'Blocklist sources',
  'transmission.blocklistUpdateIntervalHours': 'Update every',
  'transmission.downloadDirectory': 'Download directory',
  'transmission.downloadQueueEnabled': 'Enable download queue',
  'transmission.downloadQueueSize': 'Download queue size',
  'transmission.incompleteDirectory': 'Incomplete folder',
  'transmission.incompleteDirectoryEnabled': 'Use incomplete folder',
  'transmission.peerLimitGlobal': 'Global peer limit',
  'transmission.peerLimitPerTorrent': 'Per-torrent peer limit',
  'transmission.peerPortRandomHigh': 'Random port high',
  'transmission.peerPortRandomLow': 'Random port low',
  'transmission.peerPortRandomOnStart': 'Randomize peer port',
};

/**
 * Form Validation - Format Console Error.
 *
 * Replaces low-level validation and process details with user-facing wording while
 * preserving server messages that are already suitable for the console.
 *
 * @param {Web_FormValidation_FormatConsoleError_Message} message - Message.
 *
 * @returns {Web_FormValidation_FormatConsoleError_Returns}
 *
 * @since 2.0.0
 */
export const formatConsoleError = (message: Web_FormValidation_FormatConsoleError_Message): Web_FormValidation_FormatConsoleError_Returns => {
  let formattedMessage: Web_FormValidation_FormatConsoleError_FormattedMessage = message;

  for (const settingEntry of Object.entries(settingTitles)) {
    const settingKey: Web_FormValidation_FormatConsoleError_SettingKey = settingEntry[0];
    const settingTitle: Web_FormValidation_FormatConsoleError_SettingTitle = settingEntry[1];

    formattedMessage = formattedMessage.replaceAll(settingKey, settingTitle);
  }

  formattedMessage = formattedMessage
    .replace(new RegExp(settingKeyPattern, 'gu'), 'the setting')
    .replace(new RegExp(customProfileReferencePattern, 'gu'), 'the selected custom profile')
    .replace(new RegExp(exitStatusPattern, 'giu'), 'the VPN process stopped unexpectedly')
    .replace(
      new RegExp(tooSmallNumberPattern, 'u'),
      'Enter a number of at least $1.',
    )
    .replace(
      new RegExp(tooBigNumberPattern, 'u'),
      'Enter a number no greater than $1.',
    )
    .replace(new RegExp(invalidNumberPattern, 'u'), 'Enter a number.');

  return formattedMessage;
};

/**
 * Form Validation - Data Path Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const dataPathSchema = z.string().refine(
  isNormalizedDataPath,
  'Choose a normalized folder beneath /data.',
);

/**
 * Form Validation - Download Data Path Root Message.
 *
 * Keeps the destination-specific guidance identical across every console form.
 * API and compatible RPC responses use the same text.
 *
 * @since 2.0.0
 */
const downloadDataPathRootMessage: Web_FormValidation_DownloadDataPathRootMessage = 'Choose a folder inside /data, not /data itself.';

/**
 * Form Validation - Download Data Path Schema.
 *
 * Requires torrent destinations below the mount root while the directory browser
 * and free-space lookup continue to accept /data itself.
 *
 * @since 2.0.0
 */
const downloadDataPathSchema = dataPathSchema.refine(
  (value) => value !== '/data',
  downloadDataPathRootMessage,
);

/**
 * Form Validation - Validate Outside Incomplete Directory.
 *
 * A slash boundary keeps similarly prefixed siblings, such as incomplete-old,
 * distinct while still reserving every descendant of the effective folder.
 *
 * @param {Web_FormValidation_ValidateOutsideIncompleteDirectory_Value}               value                 - Value.
 * @param {Web_FormValidation_ValidateOutsideIncompleteDirectory_IncompleteDirectory} [incompleteDirectory] - Incomplete directory.
 *
 * @returns {Web_FormValidation_ValidateOutsideIncompleteDirectory_Returns}
 *
 * @since 2.0.0
 */
const validateOutsideIncompleteDirectory = (
  value: Web_FormValidation_ValidateOutsideIncompleteDirectory_Value,
  incompleteDirectory?: Web_FormValidation_ValidateOutsideIncompleteDirectory_IncompleteDirectory,
): Web_FormValidation_ValidateOutsideIncompleteDirectory_Returns => {
  if (
    incompleteDirectory !== undefined
    && (
      value === incompleteDirectory
      || value.startsWith(`${incompleteDirectory}/`) === true
    )
  ) {
    throw new Error(`Choose a folder outside the incomplete folder, ${incompleteDirectory}.`);
  }

  return;
};

/**
 * Form Validation - Label Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const labelSchema = z.string()
  .min(1, 'Labels cannot be empty.')
  .max(128, 'Labels cannot exceed 128 characters.')
  .refine(
    (value) => value.includes(',') === false,
    'Labels can\'t contain commas.',
  )
  .refine(
    (value) => value.trim() === value,
    'Labels cannot start or end with whitespace.',
  );

/**
 * Form Validation - Identifier Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const identifierSchema = z.string()
  .min(1, 'An identifier is required.')
  .max(160, 'Identifiers cannot exceed 160 characters.')
  .refine(isIdentifier, 'The identifier contains unsupported characters.');

/**
 * Form Validation - Provider Required Message.
 *
 * Keeps the provider select's inline issue identical to schema validation.
 * The connection editor reuses it before provider-specific checks run.
 *
 * @since 2.0.0
 */
export const providerRequiredMessage: Web_FormValidation_ProviderRequiredMessage = 'Choose a provider.';

/**
 * Form Validation - Provider Identifier Schema.
 *
 * Gives an empty provider selection its field-specific message before applying
 * the shared identifier length and character rules to nonempty values.
 *
 * @since 2.0.0
 */
const providerIdentifierSchema = z.string()
  .min(1, providerRequiredMessage)
  .pipe(identifierSchema);

/**
 * Form Validation - Connection Name Schema.
 *
 * Keeps names readable in list rows and aligned with the profile-name limit.
 * Trimming here also makes case-insensitive duplicate checks predictable.
 *
 * @since 2.0.0
 */
const connectionNameSchema = z.string()
  .transform((name) => name.trim())
  .refine(
    (name) => [...name].length >= 1 && [...name].length <= 64,
    'Name must contain between 1 and 64 characters.',
  );

/**
 * Form Validation - Peer Port Schema.
 *
 * Reuses the valid non-privileged port range for create and update requests.
 * The shared wording matches the current connection form.
 *
 * @since 2.0.0
 */
const peerPortSchema = z.number({ error: 'Enter a number from 1,024 to 65,535.' })
  .int('Enter a whole number from 1,024 to 65,535.')
  .min(1024, 'Enter a number from 1,024 to 65,535.')
  .max(65_535, 'Enter a number from 1,024 to 65,535.');

/**
 * Form Validation - Remote Login Username Schema.
 *
 * Stores the shared username rules used by the RPC and web proxies.
 * Both backend routes accept the same character set and length.
 *
 * @since 2.0.0
 */
const remoteLoginUsernameSchema = z.string()
  .trim()
  .min(1, 'Enter a username.')
  .max(64, 'Usernames cannot exceed 64 characters.')
  .regex(new RegExp(safeNamePattern, 'u'), 'Use only letters, numbers, periods, underscores, and hyphens.');

/**
 * Form Validation - DNS Servers Schema.
 *
 * Accepts up to eight IPv4 addresses, matching the VPN API contract.
 * Duplicate addresses are rejected before a connect request is sent.
 *
 * @since 2.0.0
 */
const dnsServersSchema = z.array(
  z.ipv4('Enter one IPv4 address per line.'),
)
  .max(8, 'Enter no more than 8 DNS servers.')
  .refine(
    (servers) => hasUniqueStrings(servers, true),
    'Enter each DNS server only once.',
  );

/**
 * Form Validation - Retry Interval Schema.
 *
 * Stores the range shared by the VPN form and connect request.
 * Explicit messages keep raw Zod wording out of the console.
 *
 * @since 2.0.0
 */
const retryIntervalSchema = z.number({ error: 'Enter a number from 3 to 600.' })
  .int('Enter a whole number from 3 to 600.')
  .min(3, 'Enter a number from 3 to 600.')
  .max(600, 'Enter a number from 3 to 600.');

/**
 * Form Validation - Torrent Hashes Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const torrentHashesSchema = z.array(
  z.string()
    .refine(isTorrentHash, 'Torrent hashes must contain 40 or 64 hexadecimal characters.')
    .transform((hash) => hash.toLowerCase()),
)
  .min(1, 'Select at least one torrent.')
  .max(1000, 'Select no more than 1,000 torrents at once.')
  .refine(
    (hashes) => hasUniqueStrings(hashes, false),
    'Torrent selections cannot contain duplicates.',
  );

/**
 * Form Validation - File Indices Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const fileIndicesSchema = z.array(
  z.number().int().nonnegative('File indices cannot be negative.'),
)
  .max(100_000, 'A file selection cannot contain more than 100,000 entries.')
  .refine(hasUniqueNumbers, 'File selections cannot contain duplicates.');

/**
 * Form Validation - Torrent Changes Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const torrentChangesSchema: Web_FormValidation_TorrentChangesSchema = z.object({
  bandwidthPriority: z.union([
    z.literal(-1),
    z.literal(0),
    z.literal(1),
  ]).optional(),
  downloadLimit: z.number().int().min(0).max(1_000_000_000).optional(),
  downloadLimited: z.boolean().optional(),
  filesUnwanted: fileIndicesSchema.optional(),
  filesWanted: fileIndicesSchema.optional(),
  honorsSessionLimits: z.boolean().optional(),
  labels: z.array(labelSchema)
    .max(64, 'A torrent cannot have more than 64 labels.')
    .refine(
      (labels) => hasUniqueStrings(labels, false),
      'Torrent labels must be unique.',
    )
    .optional(),
  peerLimit: z.number().int().min(1).max(10_000).optional(),
  priorityHigh: fileIndicesSchema.optional(),
  priorityLow: fileIndicesSchema.optional(),
  priorityNormal: fileIndicesSchema.optional(),
  queuePosition: z.number().int().min(0).max(1_000_000).optional(),
  seedIdleLimit: z.number().int().min(1).max(525_600).optional(),
  seedIdleMode: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
  ]).optional(),
  seedRatioLimit: z.number().min(0).max(10_000).optional(),
  seedRatioMode: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
  ]).optional(),
  trackerList: z.string()
    .max(maximumTrackerListLength, 'Tracker tiers cannot exceed 256 KiB.')
    .optional(),
  uploadLimit: z.number().int().min(0).max(1_000_000_000).optional(),
  uploadLimited: z.boolean().optional(),
}).strict().refine(
  (changes) => Object.keys(changes).length > 0,
  'Change at least one torrent option before saving.',
);

/**
 * Form Validation - Claim Input Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const claimInputSchema: Web_FormValidation_ClaimInputSchema = z.object({
  claimCode: z.string()
    .trim()
    .min(12, 'Enter the one-time claim code from the container log.')
    .max(256, 'The one-time claim code is too long.'),
  username: z.string()
    .trim()
    .min(3, 'Usernames must contain between 3 and 64 characters.')
    .max(64, 'Usernames must contain between 3 and 64 characters.')
    .refine(
      isAdministratorUsername,
      'Usernames may use letters, numbers, periods, underscores, and hyphens, and must start with a letter or number.',
    ),
  password: z.string()
    .min(12, 'Passwords must contain between 12 and 1,024 characters.')
    .max(1024, 'Passwords must contain between 12 and 1,024 characters.'),
}).strict();

/**
 * Form Validation - Login Input Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const loginInputSchema: Web_FormValidation_LoginInputSchema = z.object({
  username: z.string()
    .trim()
    .min(1, 'Enter your username.')
    .max(64, 'The username is too long.'),
  password: z.string()
    .min(1, 'Enter your password.')
    .max(1024, 'The password is too long.'),
}).strict();

/**
 * Form Validation - Add Torrent Input Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const addTorrentInputSchema: Web_FormValidation_AddTorrentInputSchema = z.object({
  filename: z.string()
    .trim()
    .refine(isTorrentURL, 'Enter a valid HTTP, HTTPS, or magnet URL.')
    .optional(),
  labels: z.array(labelSchema)
    .max(64, 'A torrent cannot have more than 64 labels.')
    .refine(
      (labels) => hasUniqueStrings(labels, false),
      'Torrent labels must be unique.',
    )
    .optional(),
  metainfo: z.base64('Choose a valid .torrent file.')
    .min(1, 'Choose a non-empty .torrent file.')
    .max(maximumMetainfoLength, 'The .torrent file is larger than 16 MiB.')
    .optional(),
  paused: z.boolean().optional(),
  profileId: z.string()
    .regex(new RegExp(torrentProfileIdPattern, 'u'), 'Choose a valid torrent profile.')
    .optional(),
}).strict().superRefine((input, context) => {
  const sourceCount: Web_FormValidation_AddTorrentInputSchema_SourceCount = Number(input['filename'] !== undefined) + Number(input['metainfo'] !== undefined);
  if (sourceCount !== 1) {
    context.addIssue({
      code: 'custom',
      message: 'Provide exactly one torrent URL, magnet link, or .torrent file.',
    });
  }

  return;
});

/**
 * Form Validation - Torrent Profile Options Schema.
 *
 * Keeps profile validation aligned with the control API before a request is sent.
 * The editor and API client share this single set of server-compatible limits.
 *
 * @since 2.0.0
 */
const torrentProfileOptionsSchema = z.object({
  bandwidthPriority: z.union([
    z.literal(-1),
    z.literal(0),
    z.literal(1),
  ]),
  downloadLimitKBps: z.number()
    .int('Download limit must be a whole number.')
    .min(1, 'Download limit must be at least 1 KB/s.')
    .max(1_000_000_000, 'Download limit cannot exceed 1,000,000,000 KB/s.')
    .nullable(),
  peerLimit: z.number()
    .int('Peer limit must be a whole number.')
    .min(1, 'Peer limit must be at least 1.')
    .max(10_000, 'Peer limit cannot exceed 10,000.'),
  queue: z.enum([
    'normal',
    'top',
  ]),
  seeding: z.object({
    idleMinutes: z.number()
      .int('Idle minutes must be a whole number.')
      .min(1, 'Idle minutes must be at least 1.')
      .max(525_600, 'Idle minutes cannot exceed 525,600.')
      .nullable(),
    mode: z.enum([
      'limit',
      'never',
    ]),
    ratio: z.number()
      .min(0, 'Ratio cannot be negative.')
      .max(10_000, 'Ratio cannot exceed 10,000.')
      .nullable(),
  }).strict().superRefine((seeding, context) => {
    if (
      seeding['mode'] === 'limit'
      && seeding['ratio'] === null
      && seeding['idleMinutes'] === null
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Enter a ratio, idle minutes, or both when stopping at a limit.',
      });
    }

    if (
      seeding['mode'] === 'never'
      && (
        seeding['ratio'] !== null
        || seeding['idleMinutes'] !== null
      )
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Never stop cannot include a ratio or idle-minute limit.',
      });
    }

    return;
  }),
  uploadLimitKBps: z.number()
    .int('Upload limit must be a whole number.')
    .min(1, 'Upload limit must be at least 1 KB/s.')
    .max(1_000_000_000, 'Upload limit cannot exceed 1,000,000,000 KB/s.')
    .nullable(),
}).strict();

/**
 * Form Validation - Default Torrent Profile Input Schema.
 *
 * Validates the editable fields shared with a named profile while omitting
 * name matching and VPN selection, which the Default profile does not expose.
 *
 * @since 2.0.0
 */
const defaultTorrentProfileInputSchema = z.object({
  downloadDirectory: downloadDataPathSchema,
  labels: z.array(labelSchema)
    .max(64, 'A profile cannot have more than 64 labels.')
    .refine(
      (labels) => hasUniqueStrings(labels, false),
      'Profile labels must be unique.',
    ),
  name: z.string()
    .transform((name) => name.trim())
    .refine(
      (name) => [...name].length >= 1 && [...name].length <= 64,
      'Name must contain between 1 and 64 characters.',
    ),
  options: torrentProfileOptionsSchema,
  startPaused: z.boolean(),
}).strict();

/**
 * Form Validation - Torrent Profile Input Schema.
 *
 * Adds the identity, connection, and filename-matching fields available only
 * to named profiles.
 *
 * @since 2.0.0
 */
const torrentProfileInputSchema = defaultTorrentProfileInputSchema.extend({
  connectionId: identifierSchema.nullable(),
  matchPatterns: z.array(z.string().refine(
    (pattern) => [...pattern].length >= 1 && [...pattern].length <= 128,
    'Each name pattern must contain between 1 and 128 characters.',
  )).max(64, 'Enter no more than 64 name patterns.'),
}).strict();

/**
 * Form Validation - Update Torrent Profile Input Schema.
 *
 * Adds the explicit move confirmation accepted only by the update route.
 * A false flag is omitted so the wire payload follows the API contract.
 *
 * @since 2.0.0
 */
const updateTorrentProfileInputSchema: Web_FormValidation_UpdateTorrentProfileInputSchema = torrentProfileInputSchema.extend({
  moveTorrents: z.literal(true).optional(),
}).strict();

/**
 * Form Validation - Update Default Torrent Profile Input Schema.
 *
 * Adds the explicit move confirmation used when the Default profile folder
 * changes while torrents are assigned to it.
 *
 * @since 2.0.0
 */
const updateDefaultTorrentProfileInputSchema: Web_FormValidation_UpdateDefaultTorrentProfileInputSchema = defaultTorrentProfileInputSchema.extend({
  moveTorrents: z.literal(true).optional(),
}).strict();

/**
 * Form Validation - Create Directory Input Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const createDirectoryInputSchema: Web_FormValidation_CreateDirectoryInputSchema = z.object({
  parentPath: dataPathSchema,
  name: z.string()
    .min(1, 'Enter a folder name.')
    .max(255, 'Folder names cannot exceed 255 characters.')
    .refine(
      (value) => value.trim() === value,
      'Folder names cannot start or end with whitespace.',
    )
    .refine(isPlainName, 'Folder names cannot contain path separators, control characters, or dot entries.'),
}).strict();

/**
 * Form Validation - Custom Profile Input Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const customProfileInputSchema: Web_FormValidation_CustomProfileInputSchema = z.object({
  tunnel: z.enum([
    'openvpn',
    'wireguard',
  ]),
  profileName: z.string()
    .trim()
    .min(1, 'Choose a profile file.')
    .max(255, 'The profile file name is too long.')
    .refine(isPlainName, 'The profile file name must be a plain filename.'),
  profile: z.string()
    .min(1, 'The profile file is empty.')
    .max(maximumProfileLength, 'The profile file is too large.'),
}).strict();

/**
 * Form Validation - Rpc Login Input Schema.
 *
 * Stores the RPC login form contract in one reusable schema.
 * The backend generates the corresponding password.
 *
 * @since 2.0.0
 */
const rpcLoginInputSchema: Web_FormValidation_RpcLoginInputSchema = z.object({
  username: remoteLoginUsernameSchema,
}).strict();

/**
 * Form Validation - Update Rpc Login Input Schema.
 *
 * Allows either an editable username or an explicit password regeneration request.
 * Omitted fields retain their current values.
 *
 * @since 2.0.0
 */
const updateRPCLoginInputSchema: Web_FormValidation_UpdateRPCLoginInputSchema = z.object({
  regeneratePassword: z.boolean().optional(),
  username: remoteLoginUsernameSchema.optional(),
}).strict();

/**
 * Form Validation - Web Proxy Login Input Schema.
 *
 * Stores the web proxy login form contract in one reusable schema.
 * The backend generates the corresponding password.
 *
 * @since 2.0.0
 */
const webProxyLoginInputSchema: Web_FormValidation_WebProxyLoginInputSchema = z.object({
  connectionId: identifierSchema.nullable(),
  username: remoteLoginUsernameSchema,
}).strict();

/**
 * Form Validation - Update Web Proxy Login Input Schema.
 *
 * Allows either editable metadata or an explicit password regeneration request.
 * Omitted fields retain their current values.
 *
 * @since 2.0.0
 */
const updateWebProxyLoginInputSchema: Web_FormValidation_UpdateWebProxyLoginInputSchema = z.object({
  connectionId: identifierSchema.nullable().optional(),
  regeneratePassword: z.boolean().optional(),
  username: remoteLoginUsernameSchema.optional(),
}).strict();

/**
 * Form Validation - Vpn Connection Input Schema.
 *
 * Validates the connection controls independently from provider credentials.
 * The full connect schema reuses the same limits.
 *
 * @since 2.0.0
 */
const vpnConnectionInputSchema: Web_FormValidation_VpnConnectionInputSchema = z.object({
  dnsServers: dnsServersSchema,
  retryIntervalSeconds: retryIntervalSchema,
}).strict();

/**
 * Form Validation - Vpn Configuration Input Schema.
 *
 * Validates the test-and-connect portion shared by create and update routes.
 * Connection identity fields remain outside this nested configuration body.
 *
 * @since 2.0.0
 */
const vpnConfigurationInputSchema = z.object({
  providerId: providerIdentifierSchema,
  profileIds: z.array(identifierSchema)
    .min(1, 'Add at least one endpoint to the pool.')
    .max(128, 'An endpoint pool cannot contain more than 128 profiles.')
    .refine(
      (profileIDs) => hasUniqueStrings(profileIDs, true),
      'The endpoint pool cannot contain duplicates.',
    ),
  tunnel: z.enum([
    'openvpn',
    'wireguard',
  ]),
  endpointStrategy: z.enum([
    'sticky',
    'ordered',
    'randomized',
  ]),
  credentials: z.record(
    z.string()
      .min(1, 'A VPN credential name is invalid.')
      .refine(isIdentifier, 'A VPN credential name is invalid.'),
    z.string()
      .max(2048, 'VPN credentials cannot exceed 2,048 characters.')
      .refine(
        (value) => (
          value.includes('\r') === false
          && value.includes('\n') === false
          && value.includes('\0') === false
        ),
        'A VPN credential contains unsupported characters.',
      ),
  ),
  dnsServers: dnsServersSchema,
  retryIntervalSeconds: retryIntervalSchema,
}).strict();

/**
 * Form Validation - Create Vpn Connection Input Schema.
 *
 * Combines one named connection and its tested VPN configuration.
 * Peer port is optional because the server can allocate its default.
 *
 * @since 2.0.0
 */
const createVpnConnectionInputSchema: Web_FormValidation_CreateVpnConnectionInputSchema = vpnConfigurationInputSchema.extend({
  name: connectionNameSchema,
  peerPort: peerPortSchema.optional(),
}).strict();

/**
 * Form Validation - Update Vpn Connection Input Schema.
 *
 * Allows a reconnect-free name or peer-port update and an optional tested
 * configuration. The expected revision is mandatory for every update.
 *
 * @since 2.0.0
 */
const updateVpnConnectionInputSchema: Web_FormValidation_UpdateVpnConnectionInputSchema = z.object({
  expectedRevision: z.number().int().min(1, 'The connection revision is invalid.'),
  name: connectionNameSchema.optional(),
  peerPort: peerPortSchema.optional(),
  configuration: vpnConfigurationInputSchema.optional(),
}).strict().refine(
  (input) => input['name'] !== undefined
    || input['peerPort'] !== undefined
    || input['configuration'] !== undefined,
  'Change the name, peer port, or VPN configuration.',
);

/**
 * Form Validation - Set Default Vpn Connection Input Schema.
 *
 * Validates the global default-switch request before it reaches the API client.
 * The connection identifier uses the same contract as every related request.
 *
 * @since 2.0.0
 */
const setDefaultVpnConnectionInputSchema: Web_FormValidation_SetDefaultVpnConnectionInputSchema = z.object({
  connectionId: identifierSchema,
  moveTorrents: z.literal(true).optional(),
}).strict();

/**
 * Form Validation - Delete Vpn Connection Input Schema.
 *
 * Accepts no destination for the dependency probe and one destination when the
 * owner confirms moving dependants before removal.
 *
 * @since 2.0.0
 */
const deleteVpnConnectionInputSchema: Web_FormValidation_DeleteVpnConnectionInputSchema = z.object({
  moveTo: identifierSchema.optional(),
}).strict();

/**
 * Form Validation - Update Torrent Organization Input Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const updateTorrentOrganizationInputSchema: Web_FormValidation_UpdateTorrentOrganizationInputSchema = z.object({
  expectedRevision: z.number().int().nonnegative('The organization revision is invalid.'),
  labels: z.array(labelSchema)
    .max(1024, 'Save no more than 1,024 labels.')
    .refine(
      (labels) => hasUniqueStrings(labels, false),
      'Labels must be unique.',
    ),
  removedLabels: z.array(labelSchema)
    .max(1024, 'Remove no more than 1,024 labels.')
    .refine(
      (labels) => hasUniqueStrings(labels, false),
      'Removed labels must be unique.',
    ),
  renamedLabels: z.array(z.object({
    from: labelSchema,
    to: labelSchema,
  }).strict()).max(1024, 'Rename no more than 1,024 labels.'),
}).strict();

/**
 * Form Validation - JSON Value Schema.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const jsonValueSchema: Web_FormValidation_JsonValueSchema = z.lazy(() => z.union([
  z.boolean(),
  z.number(),
  z.string(),
  z.null(),
  z.array(jsonValueSchema),
  z.record(z.string(), jsonValueSchema),
]));

/**
 * Form Validation - Blocklist URL Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const blocklistURLSchema = z.url('Every blocklist source must be a valid URL.').refine(
  (value) => {
    const parsedURL: Web_FormValidation_BlocklistURLSchema_ParsedURL = new URL(value);

    return (
      parsedURL.protocol === 'https:'
      && parsedURL.username === ''
      && parsedURL.password === ''
    );
  },
  'Every blocklist source must use HTTPS without embedded credentials.',
);

/**
 * Form Validation - Setting Value Schemas.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const settingValueSchemas: Web_FormValidation_SettingValueSchemas = {
  'diagnostics.debugLogging': z.boolean(),
  'rpc.compatibilityEnabled': z.boolean(),
  'transmission.blocklistEnabled': z.boolean(),
  'transmission.blocklistSources': z.array(blocklistURLSchema).max(20, 'Enter no more than 20 blocklist sources.'),
  'transmission.blocklistUpdateIntervalHours': z.number({ error: 'Enter a number from 1 to 168.' })
    .int('Enter a whole number from 1 to 168.')
    .min(1, 'Enter a number from 1 to 168.')
    .max(168, 'Enter a number from 1 to 168.'),
  'transmission.downloadDirectory': downloadDataPathSchema,
  'transmission.downloadQueueEnabled': z.boolean(),
  'transmission.downloadQueueSize': z.number({ error: 'Enter a number from 1 to 1,000.' })
    .int('Enter a whole number from 1 to 1,000.')
    .min(1, 'Enter a number from 1 to 1,000.')
    .max(1000, 'Enter a number from 1 to 1,000.'),
  'transmission.incompleteDirectory': downloadDataPathSchema,
  'transmission.incompleteDirectoryEnabled': z.boolean(),
  'transmission.peerLimitGlobal': z.number({ error: 'Enter a number from 1 to 100,000.' })
    .int('Enter a whole number from 1 to 100,000.')
    .min(1, 'Enter a number from 1 to 100,000.')
    .max(100_000, 'Enter a number from 1 to 100,000.'),
  'transmission.peerPortRandomOnStart': z.boolean(),
  'transmission.peerPortRandomLow': z.number({ error: 'Enter a number from 1,024 to 65,535.' })
    .int('Enter a whole number from 1,024 to 65,535.')
    .min(1024, 'Enter a number from 1,024 to 65,535.')
    .max(65_535, 'Enter a number from 1,024 to 65,535.'),
  'transmission.peerPortRandomHigh': z.number({ error: 'Enter a number from 1,024 to 65,535.' })
    .int('Enter a whole number from 1,024 to 65,535.')
    .min(1024, 'Enter a number from 1,024 to 65,535.')
    .max(65_535, 'Enter a number from 1,024 to 65,535.'),
};

/**
 * Form Validation - Update Settings Input Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const updateSettingsInputSchema: Web_FormValidation_UpdateSettingsInputSchema = z.object({
  expectedRevision: z.number().int().nonnegative('The settings revision is invalid.'),
  changes: z.record(z.string(), jsonValueSchema),
}).strict().superRefine((input, context) => {
  const changeEntries: Web_FormValidation_UpdateSettingsInputSchema_ChangeEntries = Object.entries(input['changes']);
  if (changeEntries.length === 0) {
    context.addIssue({
      code: 'custom',
      message: 'Change at least one setting before saving.',
      path: ['changes'],
    });

    return;
  }
  if (changeEntries.length > 256) {
    context.addIssue({
      code: 'custom',
      message: 'No more than 256 settings may be changed at once.',
      path: ['changes'],
    });

    return;
  }

  for (const changeEntry of changeEntries) {
    const key: Web_FormValidation_UpdateSettingsInputSchema_Key = changeEntry[0];
    const value: Web_FormValidation_UpdateSettingsInputSchema_Value = changeEntry[1];
    const valueSchema: Web_FormValidation_UpdateSettingsInputSchema_ValueSchema = settingValueSchemas[key];
    if (valueSchema === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'That setting is not supported.',
        path: [
          'changes',
          key,
        ],
      });

      continue;
    }

    const result: Web_FormValidation_UpdateSettingsInputSchema_Result = valueSchema.safeParse(value);
    if (result.success === false) {
      const firstIssue: Web_FormValidation_UpdateSettingsInputSchema_FirstIssue = result.error.issues[0];
      const settingTitle: Web_FormValidation_UpdateSettingsInputSchema_SettingTitle = settingTitles[key] ?? 'Setting';
      const firstIssueMessage: Web_FormValidation_UpdateSettingsInputSchema_FirstIssueMessage = (firstIssue !== undefined) ? firstIssue.message : 'Enter a valid value.';
      const issueMessage: Web_FormValidation_UpdateSettingsInputSchema_IssueMessage = formatConsoleError(firstIssueMessage);
      const message: Web_FormValidation_UpdateSettingsInputSchema_Message = (issueMessage === downloadDataPathRootMessage) ? issueMessage : `${settingTitle}: ${issueMessage}`;

      context.addIssue({
        code: 'custom',
        message,
        path: [
          'changes',
          key,
        ],
      });
    }
  }

  return;
});

/**
 * Form Validation - Set Torrent Profile Input Schema.
 *
 * Validates profile assignment requests before the details drawer submits them.
 * A null profile identifier deliberately represents the Default profile.
 *
 * @since 2.0.0
 */
const setTorrentProfileInputSchema: Web_FormValidation_SetTorrentProfileInputSchema = z.object({
  applyOptions: z.boolean(),
  hashes: torrentHashesSchema,
  profileId: z.string().regex(new RegExp(torrentProfileIdPattern, 'u'), 'Choose a valid torrent profile.').nullable(),
}).strict();

/**
 * Form Validation - Rename Torrent Path Input Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const renameTorrentPathInputSchema: Web_FormValidation_RenameTorrentPathInputSchema = z.object({
  hashes: torrentHashesSchema.refine(
    (hashes) => hashes.length === 1,
    'Choose one torrent to rename.',
  ),
  name: z.string()
    .min(1, 'Enter a new torrent name.')
    .max(255, 'Torrent names cannot exceed 255 characters.')
    .refine(isPlainName, 'Torrent names cannot contain path separators, control characters, or dot entries.'),
  path: z.string()
    .min(1, 'The torrent path is missing.')
    .max(4096, 'The torrent path is too long.')
    .refine(
      (value) => (
        value.startsWith('/') === false
        && value.startsWith('../') === false
        && value !== '.'
        && value !== '..'
      ),
      'The torrent path must stay within the torrent.',
    ),
}).strict();

/**
 * Form Validation - Torrent Action Input Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const torrentActionInputSchema: Web_FormValidation_TorrentActionInputSchema = z.object({
  action: z.enum([
    'queue-bottom',
    'queue-down',
    'queue-top',
    'queue-up',
    'reannounce',
    'start',
    'start-now',
    'stop',
    'verify',
  ]),
  hashes: torrentHashesSchema,
}).strict();

/**
 * Form Validation - Remove Torrents Input Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const removeTorrentsInputSchema: Web_FormValidation_RemoveTorrentsInputSchema = z.object({
  deleteLocalData: z.boolean(),
  hashes: torrentHashesSchema,
}).strict();

/**
 * Form Validation - Update Torrents Input Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const updateTorrentsInputSchema: Web_FormValidation_UpdateTorrentsInputSchema = z.object({
  changes: torrentChangesSchema,
  hashes: torrentHashesSchema,
}).strict();

/**
 * Form Validation - Parse Add Torrent Input.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_Api_AddTorrentInput} input - Input.
 *
 * @returns {Web_Api_AddTorrentInput}
 *
 * @since 2.0.0
 */
export const parseAddTorrentInput = (
  input: Web_Api_AddTorrentInput,
): Web_Api_AddTorrentInput => parseInput(addTorrentInputSchema, input);

/**
 * Form Validation - Parse Claim Input.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_Api_ClaimInput} input - Input.
 *
 * @returns {Web_Api_ClaimInput}
 *
 * @since 2.0.0
 */
export const parseClaimInput = (input: Web_Api_ClaimInput): Web_Api_ClaimInput => parseInput(
  claimInputSchema,
  input,
);

/**
 * Form Validation - Parse Create Vpn Connection Input.
 *
 * Normalizes the name and validates the complete test-and-connect request.
 * The result can be sent directly to the collection route.
 *
 * @param {Web_Api_CreateVpnConnectionInput} input - Input.
 *
 * @returns {Web_Api_CreateVpnConnectionInput}
 *
 * @since 2.0.0
 */
export const parseCreateVpnConnectionInput = (
  input: Web_Api_CreateVpnConnectionInput,
): Web_Api_CreateVpnConnectionInput => parseInput(
  createVpnConnectionInputSchema,
  input,
);

/**
 * Form Validation - Parse Delete Vpn Connection Input.
 *
 * Validates an optional move destination used by the removal dialog.
 * An empty object performs the dependency probe defined by the API.
 *
 * @param {Web_Api_DeleteVpnConnectionInput} input - Input.
 *
 * @returns {Web_Api_DeleteVpnConnectionInput}
 *
 * @since 2.0.0
 */
export const parseDeleteVpnConnectionInput = (
  input: Web_Api_DeleteVpnConnectionInput,
): Web_Api_DeleteVpnConnectionInput => parseInput(deleteVpnConnectionInputSchema, input);

/**
 * Form Validation - Parse Set Default Vpn Connection Input.
 *
 * Validates the target identifier for the global default switch.
 * Keeping this parser shared prevents route-specific identifier drift.
 *
 * @param {Web_Api_SetDefaultVpnConnectionInput} input - Input.
 *
 * @returns {Web_Api_SetDefaultVpnConnectionInput}
 *
 * @since 2.0.0
 */
export const parseSetDefaultVpnConnectionInput = (
  input: Web_Api_SetDefaultVpnConnectionInput,
): Web_Api_SetDefaultVpnConnectionInput => parseInput(setDefaultVpnConnectionInputSchema, input);

/**
 * Form Validation - Parse Create Directory Input.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_Api_CreateDirectoryInput} input - Input.
 *
 * @returns {Web_Api_CreateDirectoryInput}
 *
 * @since 2.0.0
 */
export const parseCreateDirectoryInput = (input: Web_Api_CreateDirectoryInput): Web_Api_CreateDirectoryInput => parseInput(
  createDirectoryInputSchema,
  input,
);

/**
 * Form Validation - Parse Custom Profile Input.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_Api_CustomProfileInput} input - Input.
 *
 * @returns {Web_Api_CustomProfileInput}
 *
 * @since 2.0.0
 */
export const parseCustomProfileInput = (
  input: Web_Api_CustomProfileInput,
): Web_Api_CustomProfileInput => parseInput(customProfileInputSchema, input);

/**
 * Form Validation - Parse Rpc Login Input.
 *
 * Centralizes validation for creating a remote RPC login.
 * The normalized username is returned to the caller.
 *
 * @param {Web_Api_RPCLoginInput} input - Input.
 *
 * @returns {Web_Api_RPCLoginInput}
 *
 * @since 2.0.0
 */
export const parseRPCLoginInput = (input: Web_Api_RPCLoginInput): Web_Api_RPCLoginInput => parseInput(
  rpcLoginInputSchema,
  input,
);

/**
 * Form Validation - Parse Update Rpc Login Input.
 *
 * Centralizes validation for editing a remote RPC login.
 * Password regeneration is represented by an explicit boolean.
 *
 * @param {Web_Api_UpdateRPCLoginInput} input - Input.
 *
 * @returns {Web_Api_UpdateRPCLoginInput}
 *
 * @since 2.0.0
 */
export const parseUpdateRPCLoginInput = (
  input: Web_Api_UpdateRPCLoginInput,
): Web_Api_UpdateRPCLoginInput => parseInput(updateRPCLoginInputSchema, input);

/**
 * Form Validation - Parse Web Proxy Login Input.
 *
 * Centralizes validation for creating a web proxy login.
 * The result is safe to send directly to the API.
 *
 * @param {Web_Api_WebProxyLoginInput} input - Input.
 *
 * @returns {Web_Api_WebProxyLoginInput}
 *
 * @since 2.0.0
 */
export const parseWebProxyLoginInput = (
  input: Web_Api_WebProxyLoginInput,
): Web_Api_WebProxyLoginInput => parseInput(webProxyLoginInputSchema, input);

/**
 * Form Validation - Parse Update Web Proxy Login Input.
 *
 * Centralizes validation for editing a web proxy login.
 * Password regeneration is represented by an explicit boolean.
 *
 * @param {Web_Api_UpdateWebProxyLoginInput} input - Input.
 *
 * @returns {Web_Api_UpdateWebProxyLoginInput}
 *
 * @since 2.0.0
 */
export const parseUpdateWebProxyLoginInput = (
  input: Web_Api_UpdateWebProxyLoginInput,
): Web_Api_UpdateWebProxyLoginInput => parseInput(updateWebProxyLoginInputSchema, input);

/**
 * Form Validation - Parse Vpn Connection Input.
 *
 * Validates DNS and retry controls before combining them with provider fields.
 * It returns a normalized connection payload for the VPN request.
 *
 * @param {Web_Api_VpnConnectionInput} input - Input.
 *
 * @returns {Web_Api_VpnConnectionInput}
 *
 * @since 2.0.0
 */
export const parseVPNConnectionInput = (
  input: Web_Api_VpnConnectionInput,
): Web_Api_VpnConnectionInput => parseInput(vpnConnectionInputSchema, input);

/**
 * Form Validation - Parse Data Path.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_FormValidation_ParseDataPath_Value} value - Value.
 *
 * @returns {Web_FormValidation_ParseDataPath_Returns}
 *
 * @since 2.0.0
 */
export const parseDataPath = (value: Web_FormValidation_ParseDataPath_Value): Web_FormValidation_ParseDataPath_Returns => parseInput(dataPathSchema, value);

/**
 * Form Validation - Parse Login Input.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_Api_LoginInput} input - Input.
 *
 * @returns {Web_Api_LoginInput}
 *
 * @since 2.0.0
 */
export const parseLoginInput = (input: Web_Api_LoginInput): Web_Api_LoginInput => parseInput(
  loginInputSchema,
  input,
);

/**
 * Form Validation - Parse Provider ID.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_FormValidation_ParseProviderID_Value} value - Value.
 *
 * @returns {Web_FormValidation_ParseProviderID_Returns}
 *
 * @since 2.0.0
 */
export const parseProviderID = (value: Web_FormValidation_ParseProviderID_Value): Web_FormValidation_ParseProviderID_Returns => parseInput(identifierSchema, value);

/**
 * Form Validation - Parse Remove Torrents Input.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_Api_RemoveTorrentsInput} input - Input.
 *
 * @returns {Web_Api_RemoveTorrentsInput}
 *
 * @since 2.0.0
 */
export const parseRemoveTorrentsInput = (
  input: Web_Api_RemoveTorrentsInput,
): Web_Api_RemoveTorrentsInput => parseInput(removeTorrentsInputSchema, input);

/**
 * Form Validation - Parse Rename Torrent Path Input.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_Api_RenameTorrentPathInput} input - Input.
 *
 * @returns {Web_Api_RenameTorrentPathInput}
 *
 * @since 2.0.0
 */
export const parseRenameTorrentPathInput = (
  input: Web_Api_RenameTorrentPathInput,
): Web_Api_RenameTorrentPathInput => parseInput(renameTorrentPathInputSchema, input);

/**
 * Form Validation - Parse Set Torrent Profile Input.
 *
 * Returns a validated profile assignment payload for the API client.
 * Invalid identifiers never reach the profile mutation route.
 *
 * @param {Web_Api_SetTorrentProfileInput} input - Input.
 *
 * @returns {Web_Api_SetTorrentProfileInput}
 *
 * @since 2.0.0
 */
export const parseSetTorrentProfileInput = (
  input: Web_Api_SetTorrentProfileInput,
): Web_Api_SetTorrentProfileInput => parseInput(setTorrentProfileInputSchema, input);

/**
 * Form Validation - Parse Torrent Profile Input.
 *
 * Normalizes and validates every profile editor value against server limits.
 * Callers can send the returned payload without additional field conversion.
 *
 * @param {Web_Api_TorrentProfileInput}                                     input                 - Input.
 * @param {Web_FormValidation_ParseTorrentProfileInput_IncompleteDirectory} [incompleteDirectory] - Incomplete directory.
 *
 * @returns {Web_Api_TorrentProfileInput}
 *
 * @since 2.0.0
 */
export const parseTorrentProfileInput = (
  input: Web_Api_TorrentProfileInput,
  incompleteDirectory?: Web_FormValidation_ParseTorrentProfileInput_IncompleteDirectory,
): Web_Api_TorrentProfileInput => {
  const validatedInput: Web_Api_TorrentProfileInput = parseInput(
    torrentProfileInputSchema,
    input,
  );

  validateOutsideIncompleteDirectory(
    validatedInput['downloadDirectory'],
    incompleteDirectory,
  );

  return validatedInput;
};

/**
 * Form Validation - Parse Default Torrent Profile Input.
 *
 * Validates the editable Default profile fields before creating its request.
 * Named-only identity, VPN, and matching values cannot enter this payload.
 *
 * @param {Web_Api_DefaultTorrentProfileInput}                                     input                 - Input.
 * @param {Web_FormValidation_ParseDefaultTorrentProfileInput_IncompleteDirectory} [incompleteDirectory] - Incomplete directory.
 *
 * @returns {Web_Api_DefaultTorrentProfileInput}
 *
 * @since 2.0.0
 */
export const parseDefaultTorrentProfileInput = (
  input: Web_Api_DefaultTorrentProfileInput,
  incompleteDirectory?: Web_FormValidation_ParseDefaultTorrentProfileInput_IncompleteDirectory,
): Web_Api_DefaultTorrentProfileInput => {
  const validatedInput: Web_Api_DefaultTorrentProfileInput = parseInput(
    defaultTorrentProfileInputSchema,
    input,
  );

  validateOutsideIncompleteDirectory(validatedInput['downloadDirectory'], incompleteDirectory);

  return validatedInput;
};

/**
 * Form Validation - Parse Update Torrent Profile Input.
 *
 * Validates the profile editor payload and its optional move confirmation.
 * Only the literal true is accepted when torrent movement is authorized.
 *
 * @param {Web_Api_UpdateTorrentProfileInput}                                     input                 - Input.
 * @param {Web_FormValidation_ParseUpdateTorrentProfileInput_IncompleteDirectory} [incompleteDirectory] - Incomplete directory.
 *
 * @returns {Web_Api_UpdateTorrentProfileInput}
 *
 * @since 2.0.0
 */
export const parseUpdateTorrentProfileInput = (
  input: Web_Api_UpdateTorrentProfileInput,
  incompleteDirectory?: Web_FormValidation_ParseUpdateTorrentProfileInput_IncompleteDirectory,
): Web_Api_UpdateTorrentProfileInput => {
  const validatedInput: Web_Api_UpdateTorrentProfileInput = parseInput(
    updateTorrentProfileInputSchema,
    input,
  );

  validateOutsideIncompleteDirectory(
    validatedInput['downloadDirectory'],
    incompleteDirectory,
  );

  return validatedInput;
};

/**
 * Form Validation - Parse Update Default Torrent Profile Input.
 *
 * Accepts the same optional move confirmation as named profile updates.
 * The saved fields otherwise use the reduced Default profile input contract.
 *
 * @param {Web_Api_UpdateDefaultTorrentProfileInput}                                     input                 - Input.
 * @param {Web_FormValidation_ParseUpdateDefaultTorrentProfileInput_IncompleteDirectory} [incompleteDirectory] - Incomplete directory.
 *
 * @returns {Web_Api_UpdateDefaultTorrentProfileInput}
 *
 * @since 2.0.0
 */
export const parseUpdateDefaultTorrentProfileInput = (
  input: Web_Api_UpdateDefaultTorrentProfileInput,
  incompleteDirectory?: Web_FormValidation_ParseUpdateDefaultTorrentProfileInput_IncompleteDirectory,
): Web_Api_UpdateDefaultTorrentProfileInput => {
  const validatedInput: Web_Api_UpdateDefaultTorrentProfileInput = parseInput(
    updateDefaultTorrentProfileInputSchema,
    input,
  );

  validateOutsideIncompleteDirectory(validatedInput['downloadDirectory'], incompleteDirectory);

  return validatedInput;
};

/**
 * Form Validation - Parse Update Vpn Connection Input.
 *
 * Enforces revision control and preserves rename-only requests without a
 * configuration field, so those updates do not reconnect the tunnel.
 *
 * @param {Web_Api_UpdateVpnConnectionInput} input - Input.
 *
 * @returns {Web_Api_UpdateVpnConnectionInput}
 *
 * @since 2.0.0
 */
export const parseUpdateVpnConnectionInput = (
  input: Web_Api_UpdateVpnConnectionInput,
): Web_Api_UpdateVpnConnectionInput => parseInput(updateVpnConnectionInputSchema, input);

/**
 * Form Validation - Parse Torrent Action Input.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_Api_TorrentActionInput} input - Input.
 *
 * @returns {Web_Api_TorrentActionInput}
 *
 * @since 2.0.0
 */
export const parseTorrentActionInput = (
  input: Web_Api_TorrentActionInput,
): Web_Api_TorrentActionInput => parseInput(torrentActionInputSchema, input);

/**
 * Form Validation - Parse Update Settings Input.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_Api_UpdateSettingsInput}                                     input                 - Input.
 * @param {Web_FormValidation_ParseUpdateSettingsInput_IncompleteDirectory} [incompleteDirectory] - Incomplete directory.
 *
 * @returns {Web_Api_UpdateSettingsInput}
 *
 * @since 2.0.0
 */
export const parseUpdateSettingsInput = (
  input: Web_Api_UpdateSettingsInput,
  incompleteDirectory?: Web_FormValidation_ParseUpdateSettingsInput_IncompleteDirectory,
): Web_Api_UpdateSettingsInput => {
  const validatedInput: Web_Api_UpdateSettingsInput = parseInput(
    updateSettingsInputSchema,
    input,
  );
  const downloadDirectory: Web_FormValidation_ParseUpdateSettingsInput_DownloadDirectory = validatedInput['changes']['transmission.downloadDirectory'];
  const incompleteDirectoryChanges: Web_FormValidation_ParseUpdateSettingsInput_IncompleteDirectoryChanges = 'transmission.incompleteDirectory' in validatedInput['changes'];
  if (typeof downloadDirectory === 'string' && incompleteDirectoryChanges === false) {
    validateOutsideIncompleteDirectory(downloadDirectory, incompleteDirectory);
  }

  return validatedInput;
};

/**
 * Form Validation - Parse Update Torrent Organization Input.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_Api_UpdateTorrentOrganizationInput} input - Input.
 *
 * @returns {Web_Api_UpdateTorrentOrganizationInput}
 *
 * @since 2.0.0
 */
export const parseUpdateTorrentOrganizationInput = (
  input: Web_Api_UpdateTorrentOrganizationInput,
): Web_Api_UpdateTorrentOrganizationInput => parseInput(updateTorrentOrganizationInputSchema, input);

/**
 * Form Validation - Parse Update Torrents Input.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_Api_UpdateTorrentsInput} input - Input.
 *
 * @returns {Web_Api_UpdateTorrentsInput}
 *
 * @since 2.0.0
 */
export const parseUpdateTorrentsInput = (
  input: Web_Api_UpdateTorrentsInput,
): Web_Api_UpdateTorrentsInput => parseInput(updateTorrentsInputSchema, input);

/**
 * Form Validation - Parse Token ID.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_FormValidation_ParseTokenID_Value} value - Value.
 *
 * @returns {Web_FormValidation_ParseTokenID_Returns}
 *
 * @since 2.0.0
 */
export const parseTokenID = (value: Web_FormValidation_ParseTokenID_Value): Web_FormValidation_ParseTokenID_Returns => parseInput(
  z.string()
    .min(1, 'The credential identifier is missing.')
    .max(64, 'The credential identifier is invalid.')
    .refine(isIdentifier, 'The credential identifier is invalid.'),
  value,
);

/**
 * Form Validation - Wire Guard Key Pattern.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const wireGuardKeyPattern: Web_FormValidation_WireGuardKeyPattern = new RegExp(wireGuardPublicKeyPattern);

/**
 * Form Validation - Ipv4 Address Schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const ipv4AddressSchema = z.union([
  z.ipv4(),
  z.cidrv4(),
]);

/**
 * Form Validation - Validate Provider Credentials.
 *
 * Checks each field of the tunnel by its kind, with the same rules as the server.
 * Values are never repeated in a message.
 *
 * @param {Web_FormValidation_ValidateProviderCredentials_Tunnel}           tunnel             - Tunnel.
 * @param {Web_FormValidation_ValidateProviderCredentials_Credentials}      credentials        - Credentials.
 * @param {Web_FormValidation_ValidateProviderCredentials_SavedCredentials} [savedCredentials] - Saved credentials.
 *
 * @returns {Web_FormValidation_ValidateProviderCredentials_Returns}
 *
 * @since 2.0.0
 */
export const validateProviderCredentials = (
  tunnel: Web_FormValidation_ValidateProviderCredentials_Tunnel,
  credentials: Web_FormValidation_ValidateProviderCredentials_Credentials,
  savedCredentials: Web_FormValidation_ValidateProviderCredentials_SavedCredentials = [],
): Web_FormValidation_ValidateProviderCredentials_Returns => {
  if (tunnel === undefined) {
    throw new Error('Choose a supported VPN provider.');
  }

  for (const field of tunnel['credentialFields']) {
    const value: Web_FormValidation_ValidateProviderCredentials_Value = (credentials[field['key']] ?? '').trim();
    if (value === '') {
      if (field['required'] === true && savedCredentials.includes(field['key']) === false) {
        throw new Error(`${field['label']} is required.`);
      }

      continue;
    }
    if (field['kind'] === 'wireguard-key' && wireGuardKeyPattern.test(value) === false) {
      throw new Error(`${field['label']} must be a WireGuard key: 44 characters of base64 ending in =.`);
    }
    if (field['kind'] === 'ipv4-address' && ipv4AddressSchema.safeParse(value).success === false) {
      throw new Error(`${field['label']} must be an IPv4 address such as 10.68.12.34/32.`);
    }
  }

  return;
};

/**
 * Form Validation - Validate Password Confirmation.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_FormValidation_ValidatePasswordConfirmation_Password}     password     - Password.
 * @param {Web_FormValidation_ValidatePasswordConfirmation_Confirmation} confirmation - Confirmation.
 *
 * @returns {Web_FormValidation_ValidatePasswordConfirmation_Returns}
 *
 * @since 2.0.0
 */
export const validatePasswordConfirmation = (password: Web_FormValidation_ValidatePasswordConfirmation_Password, confirmation: Web_FormValidation_ValidatePasswordConfirmation_Confirmation): Web_FormValidation_ValidatePasswordConfirmation_Returns => {
  if (password !== confirmation) {
    throw new Error('The password confirmation does not match.');
  }

  return;
};
