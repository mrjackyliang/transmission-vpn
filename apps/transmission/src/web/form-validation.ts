import { z } from 'zod';

import type {
  Web_Api_AddTorrentInput,
  Web_Api_ClaimInput,
  Web_Api_CreateDirectoryInput,
  Web_Api_CreateVpnConnectionInput,
  Web_Api_CustomProfileInput,
  Web_Api_DefaultTorrentProfileInput,
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

/**
 * Form Validation - Maximum metainfo length.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const maximumMetainfoLength: number = 960_000;

/**
 * Form Validation - Maximum profile length.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const maximumProfileLength: number = 900_000;

/**
 * Form Validation - Maximum tracker list length.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const maximumTrackerListLength: number = 256 * 1024;

/**
 * Form Validation - Checks whether plain name.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const isPlainName = (value: string): boolean => {
  if (value === '.' || value === '..') {
    return false;
  }

  for (const character of value) {
    const characterCode: number = character.codePointAt(0) ?? 0;
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
 * Form Validation - Checks whether administrator username.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const isAdministratorUsername = (value: string): boolean => {
  const allowedCharacters: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-';
  const firstCharacter: string = value.slice(0, 1);
  const firstCharacterAllowed: boolean = firstCharacter !== '.'
    && firstCharacter !== '_'
    && firstCharacter !== '-'
    && allowedCharacters.includes(firstCharacter);

  return firstCharacterAllowed && [...value].every(
    (character: string): boolean => allowedCharacters.includes(character),
  );
};

/**
 * Form Validation - Checks whether identifier.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const isIdentifier = (value: string): boolean => {
  const allowedCharacters: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._:-';

  return [...value].every(
    (character: string): boolean => allowedCharacters.includes(character),
  );
};

/**
 * Form Validation - Checks whether torrent hash.
 *
 * Accepts Transmission's 40-character SHA-1 and 64-character SHA-256 forms.
 * The API normalizes accepted values to lowercase before routing them.
 *
 * @since UNRELEASED
 */
const isTorrentHash = (value: string): boolean => {
  const hexadecimalCharacters: string = '0123456789abcdefABCDEF';

  return (value.length === 40 || value.length === 64) && [...value].every(
    (character: string): boolean => hexadecimalCharacters.includes(character),
  );
};

/**
 * Form Validation - Checks whether normalized data path.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const isNormalizedDataPath = (value: string): boolean => {
  if (value === '/data') {
    return true;
  }
  if (!value.startsWith('/data/') || value.endsWith('/')) {
    return false;
  }

  const pathSegments: string[] = value.slice('/data/'.length).split('/');

  return pathSegments.every((pathSegment: string): boolean => (
    pathSegment !== ''
    && pathSegment !== '.'
    && pathSegment !== '..'
  ));
};

/**
 * Form Validation - Checks whether torrent URL.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const isTorrentURL = (value: string): boolean => {
  try {
    const parsedURL: URL = new URL(value);
    const protocol: string = parsedURL.protocol.toLowerCase();
    if (protocol === 'magnet:') {
      return parsedURL.searchParams.get('xt') !== null;
    }

    return (
      (protocol === 'http:' || protocol === 'https:')
      && parsedURL.hostname !== ''
      && parsedURL.username === ''
      && parsedURL.password === ''
    );
  } catch {
    return false;
  }
};

/**
 * Form Validation - Checks whether unique strings.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const hasUniqueStrings = (values: string[], caseSensitive: boolean): boolean => {
  const normalizedValues: string[] = values.map((value: string): string => (
    (caseSensitive) ? value : value.toLocaleLowerCase()
  ));

  return new Set(normalizedValues).size === normalizedValues.length;
};

/**
 * Form Validation - Checks whether unique numbers.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const hasUniqueNumbers = (values: number[]): boolean => new Set(values).size === values.length;

/**
 * Form Validation - Parse input.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const parseInput = <Value>(
  schema: Web_Api_Schema<Value>,
  value: unknown,
): Value => {
  const result = schema.safeParse(value);
  if (result.success) {
    return result.data;
  }

  const firstIssue = result.error.issues[0];

  throw new Error(firstIssue?.message ?? 'The form contains an invalid value.');
};

/**
 * Form Validation - Setting titles.
 *
 * Maps internal configuration keys to the labels people see in the console.
 * Error messages use these labels so implementation details never leak into the UI.
 *
 * @since UNRELEASED
 */
const settingTitles: Record<string, string> = {
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
 * Form Validation - Formats console error.
 *
 * Replaces low-level validation and process details with user-facing wording while
 * preserving server messages that are already suitable for the console.
 *
 * @since UNRELEASED
 */
export const formatConsoleError = (message: string): string => {
  let formattedMessage: string = message;

  for (const [
    settingKey,
    settingTitle,
  ] of Object.entries(settingTitles)) {
    formattedMessage = formattedMessage.replaceAll(settingKey, settingTitle);
  }

  formattedMessage = formattedMessage
    .replace(/\b(?:rpc|transmission|vpn)\.[A-Za-z0-9.]+\b/gu, 'the setting')
    .replace(/\bcustom:[A-Za-z0-9._:-]+\b/gu, 'the selected custom profile')
    .replace(/\bexit status \d+\b/giu, 'the VPN process stopped unexpectedly')
    .replace(
      /^Too small: expected number to be >=\s*([\d.]+)$/u,
      'Enter a number of at least $1.',
    )
    .replace(
      /^Too big: expected number to be <=\s*([\d.]+)$/u,
      'Enter a number no greater than $1.',
    )
    .replace(/^Invalid input: expected number, received .+$/u, 'Enter a number.');

  return formattedMessage;
};

/**
 * Form Validation - Data path schema.
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
 * Form Validation - Download data path root message.
 *
 * Keeps the destination-specific guidance identical across every console form.
 * API and compatible RPC responses use the same text.
 *
 * @since UNRELEASED
 */
const downloadDataPathRootMessage: string = 'Choose a folder inside /data, not /data itself.';

/**
 * Form Validation - Download data path schema.
 *
 * Requires torrent destinations below the mount root while the directory browser
 * and free-space lookup continue to accept /data itself.
 *
 * @since UNRELEASED
 */
const downloadDataPathSchema = dataPathSchema.refine(
  (value: string): boolean => value !== '/data',
  downloadDataPathRootMessage,
);

/**
 * Form Validation - Checks incomplete folder containment.
 *
 * A slash boundary keeps similarly prefixed siblings, such as incomplete-old,
 * distinct while still reserving every descendant of the effective folder.
 *
 * @since UNRELEASED
 */
const validateOutsideIncompleteDirectory = (
  value: string,
  incompleteDirectory?: string,
): void => {
  if (
    incompleteDirectory === undefined
    || (
      value !== incompleteDirectory
      && !value.startsWith(`${incompleteDirectory}/`)
    )
  ) {
    return;
  }

  throw new Error(`Choose a folder outside the incomplete folder, ${incompleteDirectory}.`);
};

/**
 * Form Validation - Label schema.
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
    (value: string): boolean => !value.includes(','),
    'Labels can\'t contain commas.',
  )
  .refine(
    (value: string): boolean => value.trim() === value,
    'Labels cannot start or end with whitespace.',
  );

/**
 * Form Validation - Identifier schema.
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
 * Form Validation - Provider required message.
 *
 * Keeps the provider select's inline issue identical to schema validation.
 * The connection editor reuses it before provider-specific checks run.
 *
 * @since UNRELEASED
 */
export const providerRequiredMessage: string = 'Choose a provider.';

/**
 * Form Validation - Provider identifier schema.
 *
 * Gives an empty provider selection its field-specific message before applying
 * the shared identifier length and character rules to nonempty values.
 *
 * @since UNRELEASED
 */
const providerIdentifierSchema = z.string()
  .min(1, providerRequiredMessage)
  .pipe(identifierSchema);

/**
 * Form Validation - Connection name schema.
 *
 * Keeps names readable in list rows and aligned with the profile-name limit.
 * Trimming here also makes case-insensitive duplicate checks predictable.
 *
 * @since UNRELEASED
 */
const connectionNameSchema = z.string()
  .transform((name: string): string => name.trim())
  .refine(
    (name: string): boolean => [...name].length >= 1 && [...name].length <= 64,
    'Name must contain between 1 and 64 characters.',
  );

/**
 * Form Validation - Peer port schema.
 *
 * Reuses the valid non-privileged port range for create and update requests.
 * The shared wording matches the current connection form.
 *
 * @since UNRELEASED
 */
const peerPortSchema = z.number({ error: 'Enter a number from 1,024 to 65,535.' })
  .int('Enter a whole number from 1,024 to 65,535.')
  .min(1024, 'Enter a number from 1,024 to 65,535.')
  .max(65_535, 'Enter a number from 1,024 to 65,535.');

/**
 * Form Validation - Remote login username schema.
 *
 * Stores the shared username rules used by the RPC and web proxies.
 * Both backend routes accept the same character set and length.
 *
 * @since UNRELEASED
 */
const remoteLoginUsernameSchema = z.string()
  .trim()
  .min(1, 'Enter a username.')
  .max(64, 'Usernames cannot exceed 64 characters.')
  .regex(/^[A-Za-z0-9._-]+$/u, 'Use only letters, numbers, periods, underscores, and hyphens.');

/**
 * Form Validation - DNS servers schema.
 *
 * Accepts up to eight IPv4 addresses, matching the VPN API contract.
 * Duplicate addresses are rejected before a connect request is sent.
 *
 * @since UNRELEASED
 */
const dnsServersSchema = z.array(
  z.ipv4('Enter one IPv4 address per line.'),
)
  .max(8, 'Enter no more than 8 DNS servers.')
  .refine(
    (servers: string[]): boolean => hasUniqueStrings(servers, true),
    'Enter each DNS server only once.',
  );

/**
 * Form Validation - Retry interval schema.
 *
 * Stores the range shared by the VPN form and connect request.
 * Explicit messages keep raw Zod wording out of the console.
 *
 * @since UNRELEASED
 */
const retryIntervalSchema = z.number({ error: 'Enter a number from 3 to 600.' })
  .int('Enter a whole number from 3 to 600.')
  .min(3, 'Enter a number from 3 to 600.')
  .max(600, 'Enter a number from 3 to 600.');

/**
 * Form Validation - Torrent hashes schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const torrentHashesSchema = z.array(
  z.string()
    .refine(isTorrentHash, 'Torrent hashes must contain 40 or 64 hexadecimal characters.')
    .transform((hash: string): string => hash.toLowerCase()),
)
  .min(1, 'Select at least one torrent.')
  .max(1000, 'Select no more than 1,000 torrents at once.')
  .refine(
    (hashes: string[]): boolean => hasUniqueStrings(hashes, false),
    'Torrent selections cannot contain duplicates.',
  );

/**
 * Form Validation - File indices schema.
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
 * Form Validation - Torrent changes schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const torrentChangesSchema: Web_Api_Schema<Web_Api_TorrentChanges> = z.object({
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
      (labels: string[]): boolean => hasUniqueStrings(labels, false),
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
  (changes: Web_Api_TorrentChanges): boolean => Object.keys(changes).length > 0,
  'Change at least one torrent option before saving.',
);

/**
 * Form Validation - Claim input schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const claimInputSchema: Web_Api_Schema<Web_Api_ClaimInput> = z.object({
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
 * Form Validation - Login input schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const loginInputSchema: Web_Api_Schema<Web_Api_LoginInput> = z.object({
  username: z.string()
    .trim()
    .min(1, 'Enter your username.')
    .max(64, 'The username is too long.'),
  password: z.string()
    .min(1, 'Enter your password.')
    .max(1024, 'The password is too long.'),
}).strict();

/**
 * Form Validation - Add torrent input schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const addTorrentInputSchema: Web_Api_Schema<Web_Api_AddTorrentInput> = z.object({
  filename: z.string()
    .trim()
    .refine(isTorrentURL, 'Enter a valid HTTP, HTTPS, or magnet URL.')
    .optional(),
  labels: z.array(labelSchema)
    .max(64, 'A torrent cannot have more than 64 labels.')
    .refine(
      (labels: string[]): boolean => hasUniqueStrings(labels, false),
      'Torrent labels must be unique.',
    )
    .optional(),
  metainfo: z.base64('Choose a valid .torrent file.')
    .min(1, 'Choose a non-empty .torrent file.')
    .max(maximumMetainfoLength, 'The .torrent file is too large.')
    .optional(),
  paused: z.boolean().optional(),
  profileId: z.string()
    .regex(/^tpr-[0-9a-f]{16}$/u, 'Choose a valid torrent profile.')
    .optional(),
}).strict().superRefine((input: Web_Api_AddTorrentInput, context): void => {
  const sourceCount: number = Number(input['filename'] !== undefined) + Number(input['metainfo'] !== undefined);
  if (sourceCount !== 1) {
    context.addIssue({
      code: 'custom',
      message: 'Provide exactly one torrent URL, magnet link, or .torrent file.',
    });
  }
});

/**
 * Form Validation - Torrent profile options schema.
 *
 * Keeps profile validation aligned with the control API before a request is sent.
 * The editor and API client share this single set of server-compatible limits.
 *
 * @since UNRELEASED
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
  }).strict().superRefine((seeding, context): void => {
    if (seeding['mode'] === 'limit' && seeding['ratio'] === null && seeding['idleMinutes'] === null) {
      context.addIssue({
        code: 'custom',
        message: 'Enter a ratio, idle minutes, or both when stopping at a limit.',
      });
    }
    if (seeding['mode'] === 'never' && (seeding['ratio'] !== null || seeding['idleMinutes'] !== null)) {
      context.addIssue({
        code: 'custom',
        message: 'Never stop cannot include a ratio or idle-minute limit.',
      });
    }
  }),
  uploadLimitKBps: z.number()
    .int('Upload limit must be a whole number.')
    .min(1, 'Upload limit must be at least 1 KB/s.')
    .max(1_000_000_000, 'Upload limit cannot exceed 1,000,000,000 KB/s.')
    .nullable(),
}).strict();

/**
 * Form Validation - Default torrent profile input schema.
 *
 * Validates the editable fields shared with a named profile while omitting
 * name matching and VPN selection, which the Default profile does not expose.
 *
 * @since UNRELEASED
 */
const defaultTorrentProfileInputSchema = z.object({
  downloadDirectory: downloadDataPathSchema,
  labels: z.array(labelSchema)
    .max(64, 'A profile cannot have more than 64 labels.')
    .refine(
      (labels: string[]): boolean => hasUniqueStrings(labels, false),
      'Profile labels must be unique.',
    ),
  name: z.string()
    .transform((name: string): string => name.trim())
    .refine(
      (name: string): boolean => [...name].length >= 1 && [...name].length <= 64,
      'Name must contain between 1 and 64 characters.',
    ),
  options: torrentProfileOptionsSchema,
  startPaused: z.boolean(),
}).strict();

/**
 * Form Validation - Named torrent profile input schema.
 *
 * Adds the identity, connection, and filename-matching fields available only
 * to named profiles.
 *
 * @since UNRELEASED
 */
const torrentProfileInputSchema = defaultTorrentProfileInputSchema.extend({
  connectionId: identifierSchema.nullable(),
  matchPatterns: z.array(z.string().refine(
    (pattern: string): boolean => [...pattern].length >= 1 && [...pattern].length <= 128,
    'Each name pattern must contain between 1 and 128 characters.',
  )).max(64, 'Enter no more than 64 name patterns.'),
}).strict();

/**
 * Form Validation - Update torrent profile input schema.
 *
 * Adds the explicit move confirmation accepted only by the update route.
 * A false flag is omitted so the wire payload follows the API contract.
 *
 * @since UNRELEASED
 */
const updateTorrentProfileInputSchema: Web_Api_Schema<Web_Api_UpdateTorrentProfileInput> = torrentProfileInputSchema.extend({
  moveTorrents: z.literal(true).optional(),
}).strict();

/**
 * Form Validation - Update Default torrent profile input schema.
 *
 * Adds the explicit move confirmation used when the Default profile folder
 * changes while torrents are assigned to it.
 *
 * @since UNRELEASED
 */
const updateDefaultTorrentProfileInputSchema: Web_Api_Schema<Web_Api_UpdateDefaultTorrentProfileInput> = defaultTorrentProfileInputSchema.extend({
  moveTorrents: z.literal(true).optional(),
}).strict();

/**
 * Form Validation - Create directory input schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const createDirectoryInputSchema: Web_Api_Schema<Web_Api_CreateDirectoryInput> = z.object({
  parentPath: dataPathSchema,
  name: z.string()
    .min(1, 'Enter a folder name.')
    .max(255, 'Folder names cannot exceed 255 characters.')
    .refine(
      (value: string): boolean => value.trim() === value,
      'Folder names cannot start or end with whitespace.',
    )
    .refine(isPlainName, 'Folder names cannot contain path separators, control characters, or dot entries.'),
}).strict();

/**
 * Form Validation - Custom profile input schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const customProfileInputSchema: Web_Api_Schema<Web_Api_CustomProfileInput> = z.object({
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
 * Form Validation - RPC login input schema.
 *
 * Stores the RPC login form contract in one reusable schema.
 * The backend generates the corresponding password.
 *
 * @since UNRELEASED
 */
const rpcLoginInputSchema: Web_Api_Schema<Web_Api_RPCLoginInput> = z.object({
  username: remoteLoginUsernameSchema,
}).strict();

/**
 * Form Validation - Update RPC login input schema.
 *
 * Allows either an editable username or an explicit password regeneration request.
 * Omitted fields retain their current values.
 *
 * @since UNRELEASED
 */
const updateRPCLoginInputSchema: Web_Api_Schema<Web_Api_UpdateRPCLoginInput> = z.object({
  regeneratePassword: z.boolean().optional(),
  username: remoteLoginUsernameSchema.optional(),
}).strict();

/**
 * Form Validation - Web proxy login input schema.
 *
 * Stores the web proxy login form contract in one reusable schema.
 * The backend generates the corresponding password.
 *
 * @since UNRELEASED
 */
const webProxyLoginInputSchema: Web_Api_Schema<Web_Api_WebProxyLoginInput> = z.object({
  connectionId: identifierSchema.nullable(),
  username: remoteLoginUsernameSchema,
}).strict();

/**
 * Form Validation - Update web proxy login input schema.
 *
 * Allows either editable metadata or an explicit password regeneration request.
 * Omitted fields retain their current values.
 *
 * @since UNRELEASED
 */
const updateWebProxyLoginInputSchema: Web_Api_Schema<Web_Api_UpdateWebProxyLoginInput> = z.object({
  connectionId: identifierSchema.nullable().optional(),
  regeneratePassword: z.boolean().optional(),
  username: remoteLoginUsernameSchema.optional(),
}).strict();

/**
 * Form Validation - VPN connection input schema.
 *
 * Validates the connection controls independently from provider credentials.
 * The full connect schema reuses the same limits.
 *
 * @since UNRELEASED
 */
const vpnConnectionInputSchema: Web_Api_Schema<Web_Api_VpnConnectionInput> = z.object({
  dnsServers: dnsServersSchema,
  retryIntervalSeconds: retryIntervalSchema,
}).strict();

/**
 * Form Validation - VPN configuration input schema.
 *
 * Validates the test-and-connect portion shared by create and update routes.
 * Connection identity fields remain outside this nested configuration body.
 *
 * @since UNRELEASED
 */
const vpnConfigurationInputSchema = z.object({
  providerId: providerIdentifierSchema,
  profileIds: z.array(identifierSchema)
    .min(1, 'Add at least one endpoint to the pool.')
    .max(128, 'An endpoint pool cannot contain more than 128 profiles.')
    .refine(
      (profileIDs: string[]): boolean => hasUniqueStrings(profileIDs, true),
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
        (value: string): boolean => !value.includes('\r') && !value.includes('\n') && !value.includes('\0'),
        'A VPN credential contains unsupported characters.',
      ),
  ),
  dnsServers: dnsServersSchema,
  retryIntervalSeconds: retryIntervalSchema,
}).strict();

/**
 * Form Validation - Create VPN connection input schema.
 *
 * Combines one named connection and its tested VPN configuration.
 * Peer port is optional because the server can allocate its default.
 *
 * @since UNRELEASED
 */
const createVpnConnectionInputSchema: Web_Api_Schema<Web_Api_CreateVpnConnectionInput> = vpnConfigurationInputSchema.extend({
  name: connectionNameSchema,
  peerPort: peerPortSchema.optional(),
}).strict();

/**
 * Form Validation - Update VPN connection input schema.
 *
 * Allows a reconnect-free name or peer-port update and an optional tested
 * configuration. The expected revision is mandatory for every update.
 *
 * @since UNRELEASED
 */
const updateVpnConnectionInputSchema: Web_Api_Schema<Web_Api_UpdateVpnConnectionInput> = z.object({
  expectedRevision: z.number().int().min(1, 'The connection revision is invalid.'),
  name: connectionNameSchema.optional(),
  peerPort: peerPortSchema.optional(),
  configuration: vpnConfigurationInputSchema.optional(),
}).strict().refine(
  (input: Web_Api_UpdateVpnConnectionInput): boolean => input['name'] !== undefined
    || input['peerPort'] !== undefined
    || input['configuration'] !== undefined,
  'Change the name, peer port, or VPN configuration.',
);

/**
 * Form Validation - Set default VPN connection input schema.
 *
 * Validates the global default-switch request before it reaches the API client.
 * The connection identifier uses the same contract as every related request.
 *
 * @since UNRELEASED
 */
const setDefaultVpnConnectionInputSchema: Web_Api_Schema<Web_Api_SetDefaultVpnConnectionInput> = z.object({
  connectionId: identifierSchema,
  moveTorrents: z.literal(true).optional(),
}).strict();

/**
 * Form Validation - Delete VPN connection input schema.
 *
 * Accepts no destination for the dependency probe and one destination when the
 * owner confirms moving dependants before removal.
 *
 * @since UNRELEASED
 */
const deleteVpnConnectionInputSchema: Web_Api_Schema<Web_Api_DeleteVpnConnectionInput> = z.object({
  moveTo: identifierSchema.optional(),
}).strict();

/**
 * Form Validation - Update torrent organization input schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const updateTorrentOrganizationInputSchema: Web_Api_Schema<Web_Api_UpdateTorrentOrganizationInput> = z.object({
  expectedRevision: z.number().int().nonnegative('The organization revision is invalid.'),
  labels: z.array(labelSchema)
    .max(1024, 'Save no more than 1,024 labels.')
    .refine(
      (labels: string[]): boolean => hasUniqueStrings(labels, false),
      'Labels must be unique.',
    ),
  removedLabels: z.array(labelSchema)
    .max(1024, 'Remove no more than 1,024 labels.')
    .refine(
      (labels: string[]): boolean => hasUniqueStrings(labels, false),
      'Removed labels must be unique.',
    ),
  renamedLabels: z.array(z.object({
    from: labelSchema,
    to: labelSchema,
  }).strict()).max(1024, 'Rename no more than 1,024 labels.'),
}).strict();

/**
 * Form Validation - JSON value schema.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const jsonValueSchema: Web_Api_Schema<Web_Api_JsonValue> = z.lazy(() => z.union([
  z.boolean(),
  z.number(),
  z.string(),
  z.null(),
  z.array(jsonValueSchema),
  z.record(z.string(), jsonValueSchema),
]));

/**
 * Form Validation - Blocklist URL schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const blocklistURLSchema = z.url('Every blocklist source must be a valid URL.').refine(
  (value: string): boolean => {
    const parsedURL: URL = new URL(value);

    return parsedURL.protocol === 'https:' && parsedURL.username === '' && parsedURL.password === '';
  },
  'Every blocklist source must use HTTPS without embedded credentials.',
);

/**
 * Form Validation - Setting value schemas.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const settingValueSchemas: Record<string, z.ZodType> = {
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
 * Form Validation - Update settings input schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const updateSettingsInputSchema: Web_Api_Schema<Web_Api_UpdateSettingsInput> = z.object({
  expectedRevision: z.number().int().nonnegative('The settings revision is invalid.'),
  changes: z.record(z.string(), jsonValueSchema),
}).strict().superRefine((input: Web_Api_UpdateSettingsInput, context): void => {
  const changeEntries: [string, Web_Api_JsonValue][] = Object.entries(input['changes']);
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
    const key: string = changeEntry[0];
    const value: Web_Api_JsonValue = changeEntry[1];
    const valueSchema: z.ZodType | undefined = settingValueSchemas[key];
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

    const result = valueSchema.safeParse(value);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const settingTitle: string = settingTitles[key] ?? 'Setting';
      const issueMessage: string = formatConsoleError(firstIssue?.message ?? 'Enter a valid value.');
      const message: string = (issueMessage === downloadDataPathRootMessage) ? issueMessage : `${settingTitle}: ${issueMessage}`;

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
});

/**
 * Form Validation - Set torrent profile input schema.
 *
 * Validates profile assignment requests before the details drawer submits them.
 * A null profile identifier deliberately represents the Default profile.
 *
 * @since UNRELEASED
 */
const setTorrentProfileInputSchema: Web_Api_Schema<Web_Api_SetTorrentProfileInput> = z.object({
  applyOptions: z.boolean(),
  hashes: torrentHashesSchema,
  profileId: z.string().regex(/^tpr-[0-9a-f]{16}$/u, 'Choose a valid torrent profile.').nullable(),
}).strict();

/**
 * Form Validation - Rename torrent path input schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const renameTorrentPathInputSchema: Web_Api_Schema<Web_Api_RenameTorrentPathInput> = z.object({
  hashes: torrentHashesSchema.refine(
    (hashes: string[]): boolean => hashes.length === 1,
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
      (value: string): boolean => !value.startsWith('/') && !value.startsWith('../') && value !== '.' && value !== '..',
      'The torrent path must stay within the torrent.',
    ),
}).strict();

/**
 * Form Validation - Torrent action input schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const torrentActionInputSchema: Web_Api_Schema<Web_Api_TorrentActionInput> = z.object({
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
 * Form Validation - Remove torrents input schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const removeTorrentsInputSchema: Web_Api_Schema<Web_Api_RemoveTorrentsInput> = z.object({
  deleteLocalData: z.boolean(),
  hashes: torrentHashesSchema,
}).strict();

/**
 * Form Validation - Update torrents input schema.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const updateTorrentsInputSchema: Web_Api_Schema<Web_Api_UpdateTorrentsInput> = z.object({
  changes: torrentChangesSchema,
  hashes: torrentHashesSchema,
}).strict();

/**
 * Form Validation - Parses add torrent input.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const parseAddTorrentInput = (
  input: Web_Api_AddTorrentInput,
): Web_Api_AddTorrentInput => parseInput(addTorrentInputSchema, input);

/**
 * Form Validation - Parses claim input.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const parseClaimInput = (input: Web_Api_ClaimInput): Web_Api_ClaimInput => parseInput(
  claimInputSchema,
  input,
);

/**
 * Form Validation - Parses create VPN connection input.
 *
 * Normalizes the name and validates the complete test-and-connect request.
 * The result can be sent directly to the collection route.
 *
 * @since UNRELEASED
 */
export const parseCreateVpnConnectionInput = (
  input: Web_Api_CreateVpnConnectionInput,
): Web_Api_CreateVpnConnectionInput => parseInput(
  createVpnConnectionInputSchema,
  input,
);

/**
 * Form Validation - Parses delete VPN connection input.
 *
 * Validates an optional move destination used by the removal dialog.
 * An empty object performs the dependency probe defined by the API.
 *
 * @since UNRELEASED
 */
export const parseDeleteVpnConnectionInput = (
  input: Web_Api_DeleteVpnConnectionInput,
): Web_Api_DeleteVpnConnectionInput => parseInput(deleteVpnConnectionInputSchema, input);

/**
 * Form Validation - Parses set default VPN connection input.
 *
 * Validates the target identifier for the global default switch.
 * Keeping this parser shared prevents route-specific identifier drift.
 *
 * @since UNRELEASED
 */
export const parseSetDefaultVpnConnectionInput = (
  input: Web_Api_SetDefaultVpnConnectionInput,
): Web_Api_SetDefaultVpnConnectionInput => parseInput(setDefaultVpnConnectionInputSchema, input);

/**
 * Form Validation - Parses create directory input.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const parseCreateDirectoryInput = (input: Web_Api_CreateDirectoryInput): Web_Api_CreateDirectoryInput => parseInput(
  createDirectoryInputSchema,
  input,
);

/**
 * Form Validation - Parse custom profile input.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const parseCustomProfileInput = (
  input: Web_Api_CustomProfileInput,
): Web_Api_CustomProfileInput => parseInput(customProfileInputSchema, input);

/**
 * Form Validation - Parses RPC login input.
 *
 * Centralizes validation for creating a remote RPC login.
 * The normalized username is returned to the caller.
 *
 * @since UNRELEASED
 */
export const parseRPCLoginInput = (input: Web_Api_RPCLoginInput): Web_Api_RPCLoginInput => parseInput(
  rpcLoginInputSchema,
  input,
);

/**
 * Form Validation - Parses RPC login update.
 *
 * Centralizes validation for editing a remote RPC login.
 * Password regeneration is represented by an explicit boolean.
 *
 * @since UNRELEASED
 */
export const parseUpdateRPCLoginInput = (
  input: Web_Api_UpdateRPCLoginInput,
): Web_Api_UpdateRPCLoginInput => parseInput(updateRPCLoginInputSchema, input);

/**
 * Form Validation - Parses web proxy login input.
 *
 * Centralizes validation for creating a web proxy login.
 * The result is safe to send directly to the API.
 *
 * @since UNRELEASED
 */
export const parseWebProxyLoginInput = (
  input: Web_Api_WebProxyLoginInput,
): Web_Api_WebProxyLoginInput => parseInput(webProxyLoginInputSchema, input);

/**
 * Form Validation - Parses web proxy login update.
 *
 * Centralizes validation for editing a web proxy login.
 * Password regeneration is represented by an explicit boolean.
 *
 * @since UNRELEASED
 */
export const parseUpdateWebProxyLoginInput = (
  input: Web_Api_UpdateWebProxyLoginInput,
): Web_Api_UpdateWebProxyLoginInput => parseInput(updateWebProxyLoginInputSchema, input);

/**
 * Form Validation - Parses VPN connection input.
 *
 * Validates DNS and retry controls before combining them with provider fields.
 * It returns a normalized connection payload for the VPN request.
 *
 * @since UNRELEASED
 */
export const parseVPNConnectionInput = (
  input: Web_Api_VpnConnectionInput,
): Web_Api_VpnConnectionInput => parseInput(vpnConnectionInputSchema, input);

/**
 * Form Validation - Parses data path.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const parseDataPath = (value: string): string => parseInput(dataPathSchema, value);

/**
 * Form Validation - Parses login input.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const parseLoginInput = (input: Web_Api_LoginInput): Web_Api_LoginInput => parseInput(
  loginInputSchema,
  input,
);

/**
 * Form Validation - Parses provider ID.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const parseProviderID = (value: string): string => parseInput(identifierSchema, value);

/**
 * Form Validation - Parse remove torrents input.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const parseRemoveTorrentsInput = (
  input: Web_Api_RemoveTorrentsInput,
): Web_Api_RemoveTorrentsInput => parseInput(removeTorrentsInputSchema, input);

/**
 * Form Validation - Parse rename torrent path input.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const parseRenameTorrentPathInput = (
  input: Web_Api_RenameTorrentPathInput,
): Web_Api_RenameTorrentPathInput => parseInput(renameTorrentPathInputSchema, input);

/**
 * Form Validation - Parse set torrent profile input.
 *
 * Returns a validated profile assignment payload for the API client.
 * Invalid identifiers never reach the profile mutation route.
 *
 * @since UNRELEASED
 */
export const parseSetTorrentProfileInput = (
  input: Web_Api_SetTorrentProfileInput,
): Web_Api_SetTorrentProfileInput => parseInput(setTorrentProfileInputSchema, input);

/**
 * Form Validation - Parse torrent profile input.
 *
 * Normalizes and validates every profile editor value against server limits.
 * Callers can send the returned payload without additional field conversion.
 *
 * @since UNRELEASED
 */
export const parseTorrentProfileInput = (
  input: Web_Api_TorrentProfileInput,
  incompleteDirectory?: string,
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
 * Form Validation - Parses the Default torrent profile input.
 *
 * Validates the editable Default profile fields before creating its request.
 * Named-only identity, VPN, and matching values cannot enter this payload.
 *
 * @since UNRELEASED
 */
export const parseDefaultTorrentProfileInput = (
  input: Web_Api_DefaultTorrentProfileInput,
  incompleteDirectory?: string,
): Web_Api_DefaultTorrentProfileInput => {
  const validatedInput: Web_Api_DefaultTorrentProfileInput = parseInput(
    defaultTorrentProfileInputSchema,
    input,
  );
  validateOutsideIncompleteDirectory(validatedInput['downloadDirectory'], incompleteDirectory);

  return validatedInput;
};

/**
 * Form Validation - Parses update torrent profile input.
 *
 * Validates the profile editor payload and its optional move confirmation.
 * Only the literal true is accepted when torrent movement is authorized.
 *
 * @since UNRELEASED
 */
export const parseUpdateTorrentProfileInput = (
  input: Web_Api_UpdateTorrentProfileInput,
  incompleteDirectory?: string,
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
 * Form Validation - Parses a Default torrent profile update.
 *
 * Accepts the same optional move confirmation as named profile updates.
 * The saved fields otherwise use the reduced Default profile input contract.
 *
 * @since UNRELEASED
 */
export const parseUpdateDefaultTorrentProfileInput = (
  input: Web_Api_UpdateDefaultTorrentProfileInput,
  incompleteDirectory?: string,
): Web_Api_UpdateDefaultTorrentProfileInput => {
  const validatedInput: Web_Api_UpdateDefaultTorrentProfileInput = parseInput(
    updateDefaultTorrentProfileInputSchema,
    input,
  );
  validateOutsideIncompleteDirectory(validatedInput['downloadDirectory'], incompleteDirectory);

  return validatedInput;
};

/**
 * Form Validation - Parses update VPN connection input.
 *
 * Enforces revision control and preserves rename-only requests without a
 * configuration field, so those updates do not reconnect the tunnel.
 *
 * @since UNRELEASED
 */
export const parseUpdateVpnConnectionInput = (
  input: Web_Api_UpdateVpnConnectionInput,
): Web_Api_UpdateVpnConnectionInput => parseInput(updateVpnConnectionInputSchema, input);

/**
 * Form Validation - Parse torrent action input.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const parseTorrentActionInput = (
  input: Web_Api_TorrentActionInput,
): Web_Api_TorrentActionInput => parseInput(torrentActionInputSchema, input);

/**
 * Form Validation - Parse update settings input.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const parseUpdateSettingsInput = (
  input: Web_Api_UpdateSettingsInput,
  incompleteDirectory?: string,
): Web_Api_UpdateSettingsInput => {
  const validatedInput: Web_Api_UpdateSettingsInput = parseInput(
    updateSettingsInputSchema,
    input,
  );
  const downloadDirectory = validatedInput['changes']['transmission.downloadDirectory'];
  const incompleteDirectoryChanges = 'transmission.incompleteDirectory' in validatedInput['changes'];
  if (typeof downloadDirectory === 'string' && !incompleteDirectoryChanges) {
    validateOutsideIncompleteDirectory(downloadDirectory, incompleteDirectory);
  }

  return validatedInput;
};

/**
 * Form Validation - Parse update torrent organization input.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const parseUpdateTorrentOrganizationInput = (
  input: Web_Api_UpdateTorrentOrganizationInput,
): Web_Api_UpdateTorrentOrganizationInput => parseInput(updateTorrentOrganizationInputSchema, input);

/**
 * Form Validation - Parse update torrents input.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const parseUpdateTorrentsInput = (
  input: Web_Api_UpdateTorrentsInput,
): Web_Api_UpdateTorrentsInput => parseInput(updateTorrentsInputSchema, input);

/**
 * Form Validation - Parses token ID.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const parseTokenID = (value: string): string => parseInput(
  z.string()
    .min(1, 'The credential identifier is missing.')
    .max(64, 'The credential identifier is invalid.')
    .refine(isIdentifier, 'The credential identifier is invalid.'),
  value,
);

/**
 * Form Validation - WireGuard key pattern.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const wireGuardKeyPattern: RegExp = /^[A-Za-z0-9+/]{43}=$/;

/**
 * Form Validation - IPv4 address schema.
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
 * Form Validation - Validate provider credentials.
 *
 * Checks each field of the tunnel by its kind, with the same rules as the server.
 * Values are never repeated in a message.
 *
 * @since 2.0.0
 */
export const validateProviderCredentials = (
  tunnel: Web_Api_ProviderTunnel | undefined,
  credentials: Record<string, string>,
  savedCredentials: string[] = [],
): void => {
  if (tunnel === undefined) {
    throw new Error('Choose a supported VPN provider.');
  }

  for (const field of tunnel['credentialFields']) {
    const value: string = (credentials[field['key']] ?? '').trim();
    if (value === '') {
      if (field['required'] && !savedCredentials.includes(field['key'])) {
        throw new Error(`${field['label']} is required.`);
      }

      continue;
    }
    if (field['kind'] === 'wireguard-key' && !wireGuardKeyPattern.test(value)) {
      throw new Error(`${field['label']} must be a WireGuard key: 44 characters of base64 ending in =.`);
    }
    if (field['kind'] === 'ipv4-address' && !ipv4AddressSchema.safeParse(value).success) {
      throw new Error(`${field['label']} must be an IPv4 address such as 10.68.12.34/32.`);
    }
  }
};

/**
 * Form Validation - Validates password confirmation.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const validatePasswordConfirmation = (password: string, confirmation: string): void => {
  if (password !== confirmation) {
    throw new Error('The password confirmation does not match.');
  }
};
