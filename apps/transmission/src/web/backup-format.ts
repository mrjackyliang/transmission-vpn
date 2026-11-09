import { z } from 'zod';

import type { Web_Api_Schema } from '@/types/web/api.d.ts';
import type { Web_Backup_Document } from '@/types/web/backup.d.ts';

/**
 * Backup Format - String map schema.
 *
 * Restricts portable settings and secrets to their string-keyed API representation.
 * Rejecting nested values keeps the browser contract aligned with the Go decoder.
 *
 * @since UNRELEASED
 */
const stringMapSchema = z.record(z.string(), z.string());

/**
 * Backup Format - Profile options schema.
 *
 * Describes every behavior that travels with a torrent profile.
 * Strict nested objects prevent unsupported settings from being silently accepted.
 *
 * @since UNRELEASED
 */
const profileOptionsSchema = z.object({
  seeding: z.object({
    mode: z.string(),
    ratio: z.number().nullable(),
    idleMinutes: z.number().int().nullable(),
  }).strict(),
  downloadLimitKBps: z.number().int().nullable(),
  uploadLimitKBps: z.number().int().nullable(),
  bandwidthPriority: z.number().int(),
  peerLimit: z.number().int(),
  queue: z.string(),
}).strict();

/**
 * Backup Format - Profile schema.
 *
 * Validates portable custom profiles before conflict choices are shown.
 * Folder paths are constrained to the data volume expected by the importer.
 *
 * @since UNRELEASED
 */
const profileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  downloadDirectory: z.string().startsWith('/data/'),
  labels: z.array(z.string()),
  startPaused: z.boolean(),
  options: profileOptionsSchema,
  matchPatterns: z.array(z.string()),
  connectionId: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).strict();

/**
 * Backup Format - Torrent limits schema.
 *
 * Preserves Transmission's complete per-torrent limit representation.
 * Integer and boolean constraints prevent coercion during restore.
 *
 * @since UNRELEASED
 */
const torrentLimitsSchema = z.object({
  bandwidthPriority: z.number().int(),
  downloadLimit: z.number().int(),
  downloadLimited: z.boolean(),
  honorsSessionLimits: z.boolean(),
  peerLimit: z.number().int(),
  seedIdleLimit: z.number().int(),
  seedIdleMode: z.number().int(),
  seedRatioLimit: z.number(),
  seedRatioMode: z.number().int(),
  uploadLimit: z.number().int(),
  uploadLimited: z.boolean(),
}).strict();

/**
 * Backup Format - VPN profile schema.
 *
 * Carries provider endpoint configuration needed to recreate saved connections.
 * Bounds and enums reject configurations the control API cannot own.
 *
 * @since UNRELEASED
 */
const vpnProfileSchema = z.object({
  id: z.string().min(1),
  providerId: z.string().min(1),
  tunnel: z.enum([
    'openvpn',
    'wireguard',
  ]),
  displayName: z.string(),
  countryCode: z.string(),
  country: z.string(),
  city: z.string(),
  continent: z.string(),
  protocol: z.string(),
  remoteHost: z.string(),
  remotePort: z.number().int().min(1).max(65535),
  fingerprint: z.string(),
  source: z.string(),
  configuration: z.string().min(1),
}).strict();

/**
 * Backup Format - VPN connection schema.
 *
 * Captures connection slots, credentials and routing choices as one strict unit.
 * Slot and port limits mirror the server-side import validator.
 *
 * @since UNRELEASED
 */
const vpnConnectionSchema = z.object({
  id: z.string().min(1),
  slot: z.number().int().min(0).max(63),
  name: z.string().min(1),
  default: z.boolean(),
  enabled: z.boolean(),
  providerId: z.string().min(1),
  tunnel: z.enum([
    'openvpn',
    'wireguard',
  ]),
  profileIds: z.array(z.string()),
  endpointStrategy: z.enum([
    'sticky',
    'ordered',
    'randomized',
  ]),
  credentials: stringMapSchema,
  dnsServers: z.array(z.string()),
  retryIntervalSeconds: z.number().int().min(3).max(600),
  peerPort: z.number().int().min(1024).max(65535),
}).strict();

/**
 * Backup Format - Document schema.
 *
 * Mirrors the API's version-one schema and rejects unknown keys at every object level
 * before an uploaded file enters the wizard.
 *
 * @since UNRELEASED
 */
export const backupDocumentSchema: Web_Api_Schema<Web_Backup_Document> = z.object({
  format: z.literal('transmission-vpn-export'),
  version: z.literal(1),
  exportedAt: z.string().datetime({ offset: true }),
  appVersion: z.string().min(1),
  settingsAndProfiles: z.object({
    settings: z.array(z.object({
      key: z.string().min(1),
      value: z.json(),
    }).strict()),
    defaultProfile: z.object({
      name: z.string().min(1),
      downloadDirectory: z.string().startsWith('/data/'),
      labels: z.array(z.string()),
      startPaused: z.boolean(),
      options: profileOptionsSchema,
    }).strict(),
    profiles: z.array(profileSchema).max(100),
  }).strict().optional(),
  labels: z.array(z.string()).max(1024).optional(),
  notifications: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    service: z.string().min(1),
    events: z.array(z.string()),
    settings: stringMapSchema,
    secrets: stringMapSchema,
  }).strict()).optional(),
  torrents: z.array(z.object({
    addedDate: z.number().int().optional(),
    hash: z.string().regex(/^(?:[a-f\d]{40}|[a-f\d]{64})$/iu),
    name: z.string().min(1),
    metainfo: z.string().min(1),
    profileId: z.string().nullable(),
    profileName: z.string().min(1),
    downloadDirectory: z.string().startsWith('/data/'),
    connectionId: z.string().min(1),
    labels: z.array(z.string()),
    paused: z.boolean(),
    percentDone: z.number().min(0).max(1),
    limits: torrentLimitsSchema,
  }).strict()).max(10000).optional(),
  vpnConnections: z.object({
    profiles: z.array(vpnProfileSchema),
    connections: z.array(vpnConnectionSchema).max(64),
  }).strict().optional(),
  remoteAccess: z.object({
    rpcLogins: z.array(z.object({
      id: z.string().min(1),
      username: z.string().min(1),
      secretDigest: z.string().min(1),
      createdAt: z.string().datetime({ offset: true }),
      updatedAt: z.string().datetime({ offset: true }),
      lastUsedAt: z.string().datetime({ offset: true }).nullable(),
    }).strict()),
    apiTokens: z.array(z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      tokenDigest: z.string().min(1),
      scopes: z.array(z.string()),
      expiresAt: z.string().datetime({ offset: true }).nullable(),
      createdAt: z.string().datetime({ offset: true }),
      lastUsedAt: z.string().datetime({ offset: true }).nullable(),
    }).strict()),
  }).strict().optional(),
}).strict().refine((document: Web_Backup_Document): boolean => (
  document['settingsAndProfiles'] !== undefined
  || document['labels'] !== undefined
  || document['notifications'] !== undefined
  || document['torrents'] !== undefined
  || document['vpnConnections'] !== undefined
  || document['remoteAccess'] !== undefined
), { message: 'The export does not contain any sections.' });

/**
 * Backup Format - Parses document.
 *
 * Provides the single browser entry point for uploaded backup files.
 * Callers receive only documents that satisfy the complete version-one contract.
 *
 * @param {unknown} value - Value.
 *
 * @returns {Web_Backup_Document}
 *
 * @since UNRELEASED
 */
export const parseBackupDocument = (value: unknown): Web_Backup_Document => backupDocumentSchema.parse(value);
