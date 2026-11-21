import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  connectionBeingRemovedMessage,
  getTransmissionFreeSpace,
  isVPNConnectionRequiredError,
  previewTorrentLinks,
} from '@/web/api.ts';
import { FieldLabel } from '@/web/field-label.tsx';
import { maximumTorrentFileBytes } from '@/web/form-validation.ts';
import { LabelPicker } from '@/web/organization-controls.tsx';
import {
  Button,
  Icon,
} from '@/web/primitives.tsx';
import { lineBreakPattern } from '@/web/regex.js';
import { showToast } from '@/web/toast.ts';
import { formatBytes } from '@/web/torrent-format.ts';
import { summarizeTorrentAddBatch } from '@/web/torrent-library.ts';
import {
  matchTorrentProfiles,
  torrentNameFromFile,
  torrentNameFromLink,
  torrentNameMatchesPattern,
} from '@/web/torrent-profile-matcher.ts';
import { useEscapeKey } from '@/web/use-escape-key.ts';

import type {
  Web_AddTorrentDialog_AddTorrentDialog_AcceptFiles,
  Web_AddTorrentDialog_AddTorrentDialog_AcceptFiles_NextFiles,
  Web_AddTorrentDialog_AddTorrentDialog_AcceptFiles_Returns,
  Web_AddTorrentDialog_AddTorrentDialog_AcceptFiles_ValidFiles,
  Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource,
  Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_AddedDownloadDirectory,
  Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_Detail,
  Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_Index,
  Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_Input,
  Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_Profile,
  Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_ProfileId,
  Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_Result,
  Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_Returns,
  Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_Source,
  Web_AddTorrentDialog_AddTorrentDialog_AllProcessed,
  Web_AddTorrentDialog_AddTorrentDialog_AmbiguousMatch,
  Web_AddTorrentDialog_AddTorrentDialog_AutomaticallyMatched,
  Web_AddTorrentDialog_AddTorrentDialog_Batches,
  Web_AddTorrentDialog_AddTorrentDialog_BatchIndex,
  Web_AddTorrentDialog_AddTorrentDialog_BatchLength,
  Web_AddTorrentDialog_AddTorrentDialog_BatchLinks,
  Web_AddTorrentDialog_AddTorrentDialog_BatchResult,
  Web_AddTorrentDialog_AddTorrentDialog_BatchSummary,
  Web_AddTorrentDialog_AddTorrentDialog_BuildInput,
  Web_AddTorrentDialog_AddTorrentDialog_BuildInput_Input,
  Web_AddTorrentDialog_AddTorrentDialog_BuildInput_Metainfo,
  Web_AddTorrentDialog_AddTorrentDialog_BuildInput_Multiple,
  Web_AddTorrentDialog_AddTorrentDialog_BuildInput_NextLabels,
  Web_AddTorrentDialog_AddTorrentDialog_BuildInput_Profile,
  Web_AddTorrentDialog_AddTorrentDialog_BuildInput_ProfileData,
  Web_AddTorrentDialog_AddTorrentDialog_BuildInput_ProfileId,
  Web_AddTorrentDialog_AddTorrentDialog_BuildInput_Returns,
  Web_AddTorrentDialog_AddTorrentDialog_BuildInput_Source,
  Web_AddTorrentDialog_AddTorrentDialog_Connections,
  Web_AddTorrentDialog_AddTorrentDialog_DefaultProfile,
  Web_AddTorrentDialog_AddTorrentDialog_DefaultsKey,
  Web_AddTorrentDialog_AddTorrentDialog_DialogTitle,
  Web_AddTorrentDialog_AddTorrentDialog_DragActive,
  Web_AddTorrentDialog_AddTorrentDialog_DragActiveState,
  Web_AddTorrentDialog_AddTorrentDialog_Error,
  Web_AddTorrentDialog_AddTorrentDialog_ErrorState,
  Web_AddTorrentDialog_AddTorrentDialog_FileDropTitle,
  Web_AddTorrentDialog_AddTorrentDialog_FileMatchedProfiles,
  Web_AddTorrentDialog_AddTorrentDialog_FileName,
  Web_AddTorrentDialog_AddTorrentDialog_Files,
  Web_AddTorrentDialog_AddTorrentDialog_FileSources,
  Web_AddTorrentDialog_AddTorrentDialog_FilesState,
  Web_AddTorrentDialog_AddTorrentDialog_FirstFile,
  Web_AddTorrentDialog_AddTorrentDialog_FreeSpace,
  Web_AddTorrentDialog_AddTorrentDialog_FreeSpaceCancelled,
  Web_AddTorrentDialog_AddTorrentDialog_FreeSpaceState,
  Web_AddTorrentDialog_AddTorrentDialog_HandleSubmit,
  Web_AddTorrentDialog_AddTorrentDialog_HandleSubmit_ConnectionName,
  Web_AddTorrentDialog_AddTorrentDialog_HandleSubmit_Event,
  Web_AddTorrentDialog_AddTorrentDialog_HandleSubmit_Result,
  Web_AddTorrentDialog_AddTorrentDialog_HandleSubmit_Returns,
  Web_AddTorrentDialog_AddTorrentDialog_HandleSubmit_Source,
  Web_AddTorrentDialog_AddTorrentDialog_Hash,
  Web_AddTorrentDialog_AddTorrentDialog_HasUnresolvedProfileChoice,
  Web_AddTorrentDialog_AddTorrentDialog_LabelPresets,
  Web_AddTorrentDialog_AddTorrentDialog_Labels,
  Web_AddTorrentDialog_AddTorrentDialog_LabelsState,
  Web_AddTorrentDialog_AddTorrentDialog_LinkMatchedProfiles,
  Web_AddTorrentDialog_AddTorrentDialog_LinkName,
  Web_AddTorrentDialog_AddTorrentDialog_LinkPreviews,
  Web_AddTorrentDialog_AddTorrentDialog_LinkPreviewsState,
  Web_AddTorrentDialog_AddTorrentDialog_Links,
  Web_AddTorrentDialog_AddTorrentDialog_LinkSources,
  Web_AddTorrentDialog_AddTorrentDialog_LinkText,
  Web_AddTorrentDialog_AddTorrentDialog_LinkTextState,
  Web_AddTorrentDialog_AddTorrentDialog_MatchedPattern,
  Web_AddTorrentDialog_AddTorrentDialog_MatchedProfile,
  Web_AddTorrentDialog_AddTorrentDialog_OnAdd,
  Web_AddTorrentDialog_AddTorrentDialog_OnClose,
  Web_AddTorrentDialog_AddTorrentDialog_OnOpenVpn,
  Web_AddTorrentDialog_AddTorrentDialog_Open,
  Web_AddTorrentDialog_AddTorrentDialog_Paused,
  Web_AddTorrentDialog_AddTorrentDialog_PausedState,
  Web_AddTorrentDialog_AddTorrentDialog_Preview,
  Web_AddTorrentDialog_AddTorrentDialog_PreviewCancelled,
  Web_AddTorrentDialog_AddTorrentDialog_PreviewingLinks,
  Web_AddTorrentDialog_AddTorrentDialog_PreviewingLinksState,
  Web_AddTorrentDialog_AddTorrentDialog_PreviewName,
  Web_AddTorrentDialog_AddTorrentDialog_Previews,
  Web_AddTorrentDialog_AddTorrentDialog_ProfileConnectionLabel,
  Web_AddTorrentDialog_AddTorrentDialog_ProfileConnectionLabel_DefaultConnection,
  Web_AddTorrentDialog_AddTorrentDialog_ProfileConnectionLabel_DefaultConnectionName,
  Web_AddTorrentDialog_AddTorrentDialog_ProfileConnectionLabel_Profile,
  Web_AddTorrentDialog_AddTorrentDialog_ProfileConnectionLabel_ProfileConnection,
  Web_AddTorrentDialog_AddTorrentDialog_ProfileConnectionLabel_Returns,
  Web_AddTorrentDialog_AddTorrentDialog_ProfileOverrides,
  Web_AddTorrentDialog_AddTorrentDialog_ProfileOverridesState,
  Web_AddTorrentDialog_AddTorrentDialog_Profiles,
  Web_AddTorrentDialog_AddTorrentDialog_Props,
  Web_AddTorrentDialog_AddTorrentDialog_RequiresVpnConnection,
  Web_AddTorrentDialog_AddTorrentDialog_RequiresVpnConnectionState,
  Web_AddTorrentDialog_AddTorrentDialog_Response,
  Web_AddTorrentDialog_AddTorrentDialog_ResultLabel,
  Web_AddTorrentDialog_AddTorrentDialog_Results,
  Web_AddTorrentDialog_AddTorrentDialog_ResultsState,
  Web_AddTorrentDialog_AddTorrentDialog_Returns,
  Web_AddTorrentDialog_AddTorrentDialog_SelectedDownloadDirectory,
  Web_AddTorrentDialog_AddTorrentDialog_SelectedProfileId,
  Web_AddTorrentDialog_AddTorrentDialog_SelectedSingleProfile,
  Web_AddTorrentDialog_AddTorrentDialog_SelectedSingleProfileData,
  Web_AddTorrentDialog_AddTorrentDialog_SelectedSingleProfileId,
  Web_AddTorrentDialog_AddTorrentDialog_SelectProfile,
  Web_AddTorrentDialog_AddTorrentDialog_SelectProfile_ProfileId,
  Web_AddTorrentDialog_AddTorrentDialog_SelectProfile_Returns,
  Web_AddTorrentDialog_AddTorrentDialog_SelectProfile_SourceKey,
  Web_AddTorrentDialog_AddTorrentDialog_SelectProfileForEverySource,
  Web_AddTorrentDialog_AddTorrentDialog_SelectProfileForEverySource_Override,
  Web_AddTorrentDialog_AddTorrentDialog_SelectProfileForEverySource_ProfileId,
  Web_AddTorrentDialog_AddTorrentDialog_SelectProfileForEverySource_Returns,
  Web_AddTorrentDialog_AddTorrentDialog_SetDragActive,
  Web_AddTorrentDialog_AddTorrentDialog_SetError,
  Web_AddTorrentDialog_AddTorrentDialog_SetFiles,
  Web_AddTorrentDialog_AddTorrentDialog_SetFreeSpace,
  Web_AddTorrentDialog_AddTorrentDialog_SetLabels,
  Web_AddTorrentDialog_AddTorrentDialog_SetLinkPreviews,
  Web_AddTorrentDialog_AddTorrentDialog_SetLinkText,
  Web_AddTorrentDialog_AddTorrentDialog_SetPaused,
  Web_AddTorrentDialog_AddTorrentDialog_SetPreviewingLinks,
  Web_AddTorrentDialog_AddTorrentDialog_SetProfileOverrides,
  Web_AddTorrentDialog_AddTorrentDialog_SetRequiresVpnConnection,
  Web_AddTorrentDialog_AddTorrentDialog_SetResults,
  Web_AddTorrentDialog_AddTorrentDialog_SetSourceMode,
  Web_AddTorrentDialog_AddTorrentDialog_SetSubmitting,
  Web_AddTorrentDialog_AddTorrentDialog_SharedProfileId,
  Web_AddTorrentDialog_AddTorrentDialog_SingleDefaultsKey,
  Web_AddTorrentDialog_AddTorrentDialog_SingleDefaultsKeyRef,
  Web_AddTorrentDialog_AddTorrentDialog_SingleSource,
  Web_AddTorrentDialog_AddTorrentDialog_Size,
  Web_AddTorrentDialog_AddTorrentDialog_SourceConnectionName,
  Web_AddTorrentDialog_AddTorrentDialog_SourceConnectionName_ConnectionId,
  Web_AddTorrentDialog_AddTorrentDialog_SourceConnectionName_DefaultConnection,
  Web_AddTorrentDialog_AddTorrentDialog_SourceConnectionName_Profile,
  Web_AddTorrentDialog_AddTorrentDialog_SourceConnectionName_ProfileId,
  Web_AddTorrentDialog_AddTorrentDialog_SourceConnectionName_Returns,
  Web_AddTorrentDialog_AddTorrentDialog_SourceConnectionName_Source,
  Web_AddTorrentDialog_AddTorrentDialog_SourceConnectionName_SourceConnection,
  Web_AddTorrentDialog_AddTorrentDialog_SourceMode,
  Web_AddTorrentDialog_AddTorrentDialog_SourceModeState,
  Web_AddTorrentDialog_AddTorrentDialog_SourceProfileIds,
  Web_AddTorrentDialog_AddTorrentDialog_SourceResult,
  Web_AddTorrentDialog_AddTorrentDialog_Sources,
  Web_AddTorrentDialog_AddTorrentDialog_SubmitLabel,
  Web_AddTorrentDialog_AddTorrentDialog_Submitting,
  Web_AddTorrentDialog_AddTorrentDialog_SubmittingState,
  Web_AddTorrentDialog_AddTorrentDialog_Timeout,
  Web_AddTorrentDialog_AddTorrentDialog_Torrents,
  Web_AddTorrentDialog_AutomaticProfileSelectionValue_Returns,
  Web_AddTorrentDialog_AutomaticProfileSelectionValue_Source,
  Web_AddTorrentDialog_DefaultProfileSelectionValue,
  Web_AddTorrentDialog_DuplicateNotice_Result,
  Web_AddTorrentDialog_DuplicateNotice_Returns,
  Web_AddTorrentDialog_FileAsBase64_CommaIndex,
  Web_AddTorrentDialog_FileAsBase64_Encoded,
  Web_AddTorrentDialog_FileAsBase64_File,
  Web_AddTorrentDialog_FileAsBase64_Reader,
  Web_AddTorrentDialog_FileAsBase64_Result,
  Web_AddTorrentDialog_FileAsBase64_Returns,
  Web_AddTorrentDialog_IsTorrentFile_File,
  Web_AddTorrentDialog_IsTorrentFile_Returns,
  Web_AddTorrentDialog_MaximumTorrentPreviewLinks,
  Web_AddTorrentDialog_ParseLabels_Returns,
  Web_AddTorrentDialog_ParseLabels_Value,
  Web_AddTorrentDialog_ProfileOptionRows_Limits,
  Web_AddTorrentDialog_ProfileOptionRows_Options,
  Web_AddTorrentDialog_ProfileOptionRows_PriorityLabels,
  Web_AddTorrentDialog_ProfileOptionRows_Profile,
  Web_AddTorrentDialog_ProfileOptionRows_Returns,
  Web_AddTorrentDialog_TorrentPreviewDebounceMilliseconds,
} from '@/types/web/add-torrent-dialog.d.ts';

/**
 * Add Torrent Dialog - Maximum Torrent Preview Links.
 *
 * Matches the server route's per-request limit while allowing larger pasted lists
 * to be split into independently bounded requests.
 *
 * @since 2.0.0
 */
const maximumTorrentPreviewLinks: Web_AddTorrentDialog_MaximumTorrentPreviewLinks = 20;

/**
 * Add Torrent Dialog - Torrent Preview Debounce Milliseconds.
 *
 * Avoids starting protected downloads for every keystroke while keeping pasted
 * links responsive.
 *
 * @since 2.0.0
 */
const torrentPreviewDebounceMilliseconds: Web_AddTorrentDialog_TorrentPreviewDebounceMilliseconds = 300;

/**
 * Add Torrent Dialog - Default Profile Selection Value.
 *
 * Keeps the explicit Default choice distinct from an unresolved empty selection.
 * The sentinel never leaves the browser request builder.
 *
 * @since 2.0.0
 */
const defaultProfileSelectionValue: Web_AddTorrentDialog_DefaultProfileSelectionValue = '__default__';

/**
 * Add Torrent Dialog - Automatic Profile Selection Value.
 *
 * Selects one match, Default for no matches, and nothing for an ambiguous match.
 * An explicit row override always takes precedence over this value.
 *
 * @param {Web_AddTorrentDialog_AutomaticProfileSelectionValue_Source} source - Source.
 *
 * @returns {Web_AddTorrentDialog_AutomaticProfileSelectionValue_Returns}
 *
 * @since 2.0.0
 */
const automaticProfileSelectionValue = (source: Web_AddTorrentDialog_AutomaticProfileSelectionValue_Source): Web_AddTorrentDialog_AutomaticProfileSelectionValue_Returns => {
  if (source['matchedProfileIds'].length === 1) {
    return source['matchedProfileIds'][0] ?? '';
  }

  if (source['matchedProfileIds'].length === 0) {
    return defaultProfileSelectionValue;
  }

  return '';
};

/**
 * Add Torrent Dialog - File As Base64.
 *
 * Reads metainfo in the encoding expected by the torrent add route.
 * The data URL prefix is removed before the request is built.
 *
 * @param {Web_AddTorrentDialog_FileAsBase64_File} file - File.
 *
 * @returns {Web_AddTorrentDialog_FileAsBase64_Returns}
 *
 * @since 2.0.0
 */
const fileAsBase64 = async (file: Web_AddTorrentDialog_FileAsBase64_File): Web_AddTorrentDialog_FileAsBase64_Returns => new Promise<Web_AddTorrentDialog_FileAsBase64_Encoded>((resolve, reject) => {
  const reader: Web_AddTorrentDialog_FileAsBase64_Reader = new FileReader();

  reader.onerror = () => reject(new Error('The torrent file could not be read.'));
  reader.onload = () => {
    const result: Web_AddTorrentDialog_FileAsBase64_Result = (typeof reader.result === 'string') ? reader.result : '';
    const commaIndex: Web_AddTorrentDialog_FileAsBase64_CommaIndex = result.indexOf(',');

    resolve((commaIndex >= 0) ? result.slice(commaIndex + 1) : result);

    return;
  };

  reader.readAsDataURL(file);

  return;
});

/**
 * Add Torrent Dialog - Duplicate Notice.
 *
 * Names the existing torrent and its durable profile and VPN owners without
 * treating Transmission's duplicate result as a failed add.
 *
 * @param {Web_AddTorrentDialog_DuplicateNotice_Result} result - Result.
 *
 * @returns {Web_AddTorrentDialog_DuplicateNotice_Returns}
 *
 * @since 2.0.0
 */
const duplicateNotice = (result: Web_AddTorrentDialog_DuplicateNotice_Result): Web_AddTorrentDialog_DuplicateNotice_Returns => (
  `Already added: ${result['name']}, in ${result['profileName']} on ${result['connectionName']}.`
);

/**
 * Add Torrent Dialog - Is Torrent File.
 *
 * Accepts the standard extension or browser-provided BitTorrent MIME type.
 * Size validation remains separate so the error can explain the exact limit.
 *
 * @param {Web_AddTorrentDialog_IsTorrentFile_File} file - File.
 *
 * @returns {Web_AddTorrentDialog_IsTorrentFile_Returns}
 *
 * @since 2.0.0
 */
const isTorrentFile = (file: Web_AddTorrentDialog_IsTorrentFile_File): Web_AddTorrentDialog_IsTorrentFile_Returns => (
  file.name.toLowerCase().endsWith('.torrent')
  || file.type === 'application/x-bittorrent'
);

/**
 * Add Torrent Dialog - Parse Labels.
 *
 * Converts the editable comma-separated field into an API label list.
 * Empty segments are ignored in the same way as the organization controls.
 *
 * @param {Web_AddTorrentDialog_ParseLabels_Value} value - Value.
 *
 * @returns {Web_AddTorrentDialog_ParseLabels_Returns}
 *
 * @since 2.0.0
 */
const parseLabels = (value: Web_AddTorrentDialog_ParseLabels_Value): Web_AddTorrentDialog_ParseLabels_Returns => {
  return value
    .split(',')
    .map((label) => label.trim())
    .filter((label) => label !== '');
};

/**
 * Add Torrent Dialog - Profile Option Rows.
 *
 * Lists the server-applied options that are not individually editable here, one per line
 * with the profile editor's labels. Folder, labels, and paused state stay explicit fields.
 *
 * @param {Web_AddTorrentDialog_ProfileOptionRows_Profile} profile - Profile.
 *
 * @returns {Web_AddTorrentDialog_ProfileOptionRows_Returns}
 *
 * @since 2.0.0
 */
const profileOptionRows = (profile: Web_AddTorrentDialog_ProfileOptionRows_Profile): Web_AddTorrentDialog_ProfileOptionRows_Returns => {
  const options: Web_AddTorrentDialog_ProfileOptionRows_Options = profile['options'];
  const limits: Web_AddTorrentDialog_ProfileOptionRows_Limits = [];

  if (options['seeding']['ratio'] !== null) {
    limits.push(`at ratio ${options['seeding']['ratio']}`);
  }

  if (options['seeding']['idleMinutes'] !== null) {
    limits.push(`after ${options['seeding']['idleMinutes']} idle minutes`);
  }

  const priorityLabels: Web_AddTorrentDialog_ProfileOptionRows_PriorityLabels = {
    '-1': 'Low',
    '0': 'Normal',
    '1': 'High',
  };

  return [
    [
      'Seeding',
      (options['seeding']['mode'] === 'never' || limits.length === 0) ? 'Never stop' : `Stop ${limits.join(' or ')}`,
    ],
    [
      'Download limit',
      (options['downloadLimitKBps'] === null) ? 'Unlimited' : `${options['downloadLimitKBps'].toLocaleString()} KB/s`,
    ],
    [
      'Upload limit',
      (options['uploadLimitKBps'] === null) ? 'Unlimited' : `${options['uploadLimitKBps'].toLocaleString()} KB/s`,
    ],
    [
      'Priority',
      priorityLabels[options['bandwidthPriority']],
    ],
    [
      'Peer limit',
      String(options['peerLimit']),
    ],
    [
      'Queue position',
      (options['queue'] === 'top') ? 'Top' : 'Normal',
    ],
  ];
};

/**
 * Add Torrent Dialog - Add Torrent Dialog.
 *
 * Adds one source with editable profile defaults or processes many in order.
 * Ambiguous automatic matches wait for an explicit profile choice.
 *
 * @param {Web_AddTorrentDialog_AddTorrentDialog_Props} props - Props.
 *
 * @returns {Web_AddTorrentDialog_AddTorrentDialog_Returns}
 *
 * @since 2.0.0
 */
export const AddTorrentDialog = (props: Web_AddTorrentDialog_AddTorrentDialog_Props): Web_AddTorrentDialog_AddTorrentDialog_Returns => {
  const connections: Web_AddTorrentDialog_AddTorrentDialog_Connections = props['connections'];
  const defaultProfile: Web_AddTorrentDialog_AddTorrentDialog_DefaultProfile = props['defaultProfile'];
  const labelPresets: Web_AddTorrentDialog_AddTorrentDialog_LabelPresets = props['labelPresets'];
  const open: Web_AddTorrentDialog_AddTorrentDialog_Open = props['open'];
  const onAdd: Web_AddTorrentDialog_AddTorrentDialog_OnAdd = props['onAdd'];
  const onClose: Web_AddTorrentDialog_AddTorrentDialog_OnClose = props['onClose'];
  const onOpenVPN: Web_AddTorrentDialog_AddTorrentDialog_OnOpenVpn = props['onOpenVPN'];
  const profiles: Web_AddTorrentDialog_AddTorrentDialog_Profiles = props['profiles'];
  const torrents: Web_AddTorrentDialog_AddTorrentDialog_Torrents = props['torrents'];
  const sourceModeState: Web_AddTorrentDialog_AddTorrentDialog_SourceModeState = useState<Web_AddTorrentDialog_AddTorrentDialog_SourceMode>('link');
  const sourceMode: Web_AddTorrentDialog_AddTorrentDialog_SourceMode = sourceModeState[0];
  const setSourceMode: Web_AddTorrentDialog_AddTorrentDialog_SetSourceMode = sourceModeState[1];
  const linkTextState: Web_AddTorrentDialog_AddTorrentDialog_LinkTextState = useState<Web_AddTorrentDialog_AddTorrentDialog_LinkText>('');
  const linkText: Web_AddTorrentDialog_AddTorrentDialog_LinkText = linkTextState[0];
  const setLinkText: Web_AddTorrentDialog_AddTorrentDialog_SetLinkText = linkTextState[1];
  const filesState: Web_AddTorrentDialog_AddTorrentDialog_FilesState = useState<Web_AddTorrentDialog_AddTorrentDialog_Files>([]);
  const files: Web_AddTorrentDialog_AddTorrentDialog_Files = filesState[0];
  const setFiles: Web_AddTorrentDialog_AddTorrentDialog_SetFiles = filesState[1];
  const profileOverridesState: Web_AddTorrentDialog_AddTorrentDialog_ProfileOverridesState = useState<Web_AddTorrentDialog_AddTorrentDialog_ProfileOverrides>({});
  const profileOverrides: Web_AddTorrentDialog_AddTorrentDialog_ProfileOverrides = profileOverridesState[0];
  const setProfileOverrides: Web_AddTorrentDialog_AddTorrentDialog_SetProfileOverrides = profileOverridesState[1];
  const labelsState: Web_AddTorrentDialog_AddTorrentDialog_LabelsState = useState<Web_AddTorrentDialog_AddTorrentDialog_Labels>('');
  const labels: Web_AddTorrentDialog_AddTorrentDialog_Labels = labelsState[0];
  const setLabels: Web_AddTorrentDialog_AddTorrentDialog_SetLabels = labelsState[1];
  const pausedState: Web_AddTorrentDialog_AddTorrentDialog_PausedState = useState<Web_AddTorrentDialog_AddTorrentDialog_Paused>(false);
  const paused: Web_AddTorrentDialog_AddTorrentDialog_Paused = pausedState[0];
  const setPaused: Web_AddTorrentDialog_AddTorrentDialog_SetPaused = pausedState[1];
  const dragActiveState: Web_AddTorrentDialog_AddTorrentDialog_DragActiveState = useState<Web_AddTorrentDialog_AddTorrentDialog_DragActive>(false);
  const dragActive: Web_AddTorrentDialog_AddTorrentDialog_DragActive = dragActiveState[0];
  const setDragActive: Web_AddTorrentDialog_AddTorrentDialog_SetDragActive = dragActiveState[1];
  const resultsState: Web_AddTorrentDialog_AddTorrentDialog_ResultsState = useState<Web_AddTorrentDialog_AddTorrentDialog_Results>({});
  const results: Web_AddTorrentDialog_AddTorrentDialog_Results = resultsState[0];
  const setResults: Web_AddTorrentDialog_AddTorrentDialog_SetResults = resultsState[1];
  const errorState: Web_AddTorrentDialog_AddTorrentDialog_ErrorState = useState<Web_AddTorrentDialog_AddTorrentDialog_Error>('');
  const error: Web_AddTorrentDialog_AddTorrentDialog_Error = errorState[0];
  const setError: Web_AddTorrentDialog_AddTorrentDialog_SetError = errorState[1];
  const requiresVPNConnectionState: Web_AddTorrentDialog_AddTorrentDialog_RequiresVpnConnectionState = useState<Web_AddTorrentDialog_AddTorrentDialog_RequiresVpnConnection>(false);
  const requiresVPNConnection: Web_AddTorrentDialog_AddTorrentDialog_RequiresVpnConnection = requiresVPNConnectionState[0];
  const setRequiresVPNConnection: Web_AddTorrentDialog_AddTorrentDialog_SetRequiresVpnConnection = requiresVPNConnectionState[1];
  const submittingState: Web_AddTorrentDialog_AddTorrentDialog_SubmittingState = useState<Web_AddTorrentDialog_AddTorrentDialog_Submitting>(false);
  const submitting: Web_AddTorrentDialog_AddTorrentDialog_Submitting = submittingState[0];
  const setSubmitting: Web_AddTorrentDialog_AddTorrentDialog_SetSubmitting = submittingState[1];
  const freeSpaceState: Web_AddTorrentDialog_AddTorrentDialog_FreeSpaceState = useState<Web_AddTorrentDialog_AddTorrentDialog_FreeSpace>(null);
  const freeSpace: Web_AddTorrentDialog_AddTorrentDialog_FreeSpace = freeSpaceState[0];
  const setFreeSpace: Web_AddTorrentDialog_AddTorrentDialog_SetFreeSpace = freeSpaceState[1];
  const linkPreviewsState: Web_AddTorrentDialog_AddTorrentDialog_LinkPreviewsState = useState<Web_AddTorrentDialog_AddTorrentDialog_LinkPreviews>({});
  const linkPreviews: Web_AddTorrentDialog_AddTorrentDialog_LinkPreviews = linkPreviewsState[0];
  const setLinkPreviews: Web_AddTorrentDialog_AddTorrentDialog_SetLinkPreviews = linkPreviewsState[1];
  const previewingLinksState: Web_AddTorrentDialog_AddTorrentDialog_PreviewingLinksState = useState<Web_AddTorrentDialog_AddTorrentDialog_PreviewingLinks>(false);
  const previewingLinks: Web_AddTorrentDialog_AddTorrentDialog_PreviewingLinks = previewingLinksState[0];
  const setPreviewingLinks: Web_AddTorrentDialog_AddTorrentDialog_SetPreviewingLinks = previewingLinksState[1];
  const singleDefaultsKeyRef: Web_AddTorrentDialog_AddTorrentDialog_SingleDefaultsKeyRef = useRef<Web_AddTorrentDialog_AddTorrentDialog_SingleDefaultsKey>('');

  const links: Web_AddTorrentDialog_AddTorrentDialog_Links = useMemo(() => {
    return linkText.split(new RegExp(lineBreakPattern, 'u'))
      .map((link) => link.trim())
      .filter((link) => link !== '');
  }, [linkText]);

  const linkSources: Web_AddTorrentDialog_AddTorrentDialog_LinkSources = useMemo<Web_AddTorrentDialog_AddTorrentDialog_LinkSources>(() => (
    links.map((link, index) => {
      const preview: Web_AddTorrentDialog_AddTorrentDialog_Preview = linkPreviews[index];
      const previewName: Web_AddTorrentDialog_AddTorrentDialog_PreviewName = (preview !== undefined) ? preview['name'] : undefined;
      const name: Web_AddTorrentDialog_AddTorrentDialog_LinkName = torrentNameFromLink(link, previewName);
      const matchedProfiles: Web_AddTorrentDialog_AddTorrentDialog_LinkMatchedProfiles = matchTorrentProfiles(name, profiles);
      const hash: Web_AddTorrentDialog_AddTorrentDialog_Hash = (preview !== undefined) ? preview['hash'].toLowerCase() : null;
      const size: Web_AddTorrentDialog_AddTorrentDialog_Size = (preview !== undefined) ? (preview['totalSize'] ?? null) : null;

      return {
        alreadyAdded: hash !== null && torrents.some(
          (torrent) => torrent['hashString'].toLowerCase() === hash,
        ),
        checking: previewingLinks && preview === undefined,
        displayName: name,
        hash,
        key: `link-${index}-${link}`,
        kind: 'link',
        link,
        matchedProfileIds: matchedProfiles.map((profile) => profile['id']),
        name,
        size,
      };
    })
  ), [
    linkPreviews,
    links,
    previewingLinks,
    profiles,
    torrents,
  ]);

  const fileSources: Web_AddTorrentDialog_AddTorrentDialog_FileSources = useMemo<Web_AddTorrentDialog_AddTorrentDialog_FileSources>(() => (
    files.map((file, index) => {
      const name: Web_AddTorrentDialog_AddTorrentDialog_FileName = torrentNameFromFile(file.name);
      const matchedProfiles: Web_AddTorrentDialog_AddTorrentDialog_FileMatchedProfiles = matchTorrentProfiles(name, profiles);

      return {
        alreadyAdded: false,
        checking: false,
        displayName: file.name,
        file,
        hash: null,
        key: `file-${index}-${file.name}-${file.lastModified}`,
        kind: 'file',
        matchedProfileIds: matchedProfiles.map((profile) => profile['id']),
        name,
        size: file.size,
      };
    })
  ), [
    files,
    profiles,
  ]);

  const sources: Web_AddTorrentDialog_AddTorrentDialog_Sources = (sourceMode === 'link') ? linkSources : fileSources;
  const hasUnresolvedProfileChoice: Web_AddTorrentDialog_AddTorrentDialog_HasUnresolvedProfileChoice = sources.some(
    (source) => (
      source['matchedProfileIds'].length > 1
      && profileOverrides[source['key']] === undefined
    ),
  );
  const singleSource: Web_AddTorrentDialog_AddTorrentDialog_SingleSource = (sources.length === 1) ? sources[0] : undefined;
  const sourceProfileIds: Web_AddTorrentDialog_AddTorrentDialog_SourceProfileIds = sources.map(
    (source) => profileOverrides[source['key']] ?? automaticProfileSelectionValue(source),
  );

  // The shared select shows the profile every source uses, or its placeholder when they differ.
  const sharedProfileId: Web_AddTorrentDialog_AddTorrentDialog_SharedProfileId = (sourceProfileIds.length > 0 && sourceProfileIds.every((profileId) => profileId === sourceProfileIds[0]) === true) ? (sourceProfileIds[0] ?? '') : '';
  const selectedSingleProfileId: Web_AddTorrentDialog_AddTorrentDialog_SelectedSingleProfileId = (singleSource === undefined) ? defaultProfileSelectionValue : profileOverrides[singleSource['key']]
    ?? automaticProfileSelectionValue(singleSource);
  const selectedSingleProfile: Web_AddTorrentDialog_AddTorrentDialog_SelectedSingleProfile = profiles.find(
    (profile) => profile['id'] === selectedSingleProfileId,
  );
  const selectedSingleProfileData: Web_AddTorrentDialog_AddTorrentDialog_SelectedSingleProfileData = selectedSingleProfile ?? defaultProfile;
  const selectedDownloadDirectory: Web_AddTorrentDialog_AddTorrentDialog_SelectedDownloadDirectory = selectedSingleProfileData['downloadDirectory'];

  useEffect(() => {
    if (open === false) {
      setSourceMode('link');
      setLinkText('');
      setFiles([]);
      setProfileOverrides({});
      setLabels('');
      setPaused(false);
      setDragActive(false);
      setResults({});
      setError('');
      setRequiresVPNConnection(false);
      setSubmitting(false);
      setFreeSpace(null);
      setLinkPreviews({});
      setPreviewingLinks(false);
      singleDefaultsKeyRef.current = '';
    }

    return;
  }, [open]);

  useEffect(() => {
    if (
      open === false
      || sourceMode !== 'link'
      || links.length === 0
    ) {
      setLinkPreviews({});
      setPreviewingLinks(false);

      return undefined;
    }

    let cancelled: Web_AddTorrentDialog_AddTorrentDialog_PreviewCancelled = false;

    setLinkPreviews({});
    setPreviewingLinks(true);

    const timeout: Web_AddTorrentDialog_AddTorrentDialog_Timeout = window.setTimeout(() => {
      const batches: Web_AddTorrentDialog_AddTorrentDialog_Batches = [];

      for (let index = 0; index < links.length; index += maximumTorrentPreviewLinks) {
        batches.push(links.slice(index, index + maximumTorrentPreviewLinks));
      }

      void Promise.all(batches.map(async (batch, batchIndex) => {
        try {
          return {
            batchIndex,
            response: await previewTorrentLinks(batch),
          };
        } catch {
          return {
            batchIndex,
            response: null,
          };
        }
      })).then((responses) => {
        if (cancelled === true) {
          return;
        }

        const previews: Web_AddTorrentDialog_AddTorrentDialog_Previews = {};

        for (const batchResponse of responses) {
          const batchIndex: Web_AddTorrentDialog_AddTorrentDialog_BatchIndex = batchResponse['batchIndex'];
          const response: Web_AddTorrentDialog_AddTorrentDialog_Response = batchResponse['response'];

          if (response === null) {
            continue;
          }

          const batchLinks: Web_AddTorrentDialog_AddTorrentDialog_BatchLinks = batches[batchIndex];
          const batchLength: Web_AddTorrentDialog_AddTorrentDialog_BatchLength = (batchLinks !== undefined) ? batchLinks.length : 0;

          for (const preview of response['items']) {
            if (preview['index'] >= 0 && preview['index'] < batchLength) {
              Reflect.set(
                previews,
                (batchIndex * maximumTorrentPreviewLinks) + preview['index'],
                preview,
              );
            }
          }
        }

        setLinkPreviews(previews);
        setPreviewingLinks(false);

        return;
      });

      return;
    }, torrentPreviewDebounceMilliseconds);

    return () => {
      cancelled = true;

      window.clearTimeout(timeout);

      return;
    };
  }, [
    links,
    open,
    sourceMode,
  ]);

  useEffect(() => {
    if (singleSource === undefined) {
      singleDefaultsKeyRef.current = '';

      return;
    }

    const defaultsKey: Web_AddTorrentDialog_AddTorrentDialog_DefaultsKey = `${singleSource['key']}:${selectedSingleProfileId}`;

    if (singleDefaultsKeyRef.current === defaultsKey) {
      return;
    }

    singleDefaultsKeyRef.current = defaultsKey;

    setLabels(selectedSingleProfileData['labels'].join(', '));
    setPaused(selectedSingleProfileData['startPaused']);

    return;
  }, [
    selectedSingleProfileData,
    selectedSingleProfileId,
    singleSource,
  ]);

  useEffect(() => {
    if (open === false || singleSource === undefined) {
      setFreeSpace(null);

      return undefined;
    }

    let cancelled: Web_AddTorrentDialog_AddTorrentDialog_FreeSpaceCancelled = false;

    setFreeSpace(null);

    void getTransmissionFreeSpace(selectedDownloadDirectory).then((availableBytes) => {
      if (cancelled === false) {
        setFreeSpace(availableBytes);
      }

      return;
    }).catch(() => {
      if (cancelled === false) {
        setFreeSpace(null);
      }

      return;
    });

    return () => {
      cancelled = true;

      return;
    };
  }, [
    open,
    selectedDownloadDirectory,
    singleSource,
  ]);

  useEscapeKey(onClose, open === true && submitting === false);

  if (open === false) {
    return null;
  }

  /**
   * Add Torrent Dialog - Accept Files.
   *
   * Adds every valid dropped or selected file while reporting rejected entries.
   * Repeated file selections append so a person can build one ordered batch.
   *
   * @param {Web_AddTorrentDialog_AddTorrentDialog_AcceptFiles_NextFiles} nextFiles - Next files.
   *
   * @returns {Web_AddTorrentDialog_AddTorrentDialog_AcceptFiles_Returns}
   *
   * @since 2.0.0
   */
  const acceptFiles: Web_AddTorrentDialog_AddTorrentDialog_AcceptFiles = (nextFiles: Web_AddTorrentDialog_AddTorrentDialog_AcceptFiles_NextFiles): Web_AddTorrentDialog_AddTorrentDialog_AcceptFiles_Returns => {
    const validFiles: Web_AddTorrentDialog_AddTorrentDialog_AcceptFiles_ValidFiles = nextFiles.filter((file) => (
      isTorrentFile(file)
      && file.size > 0
      && file.size <= maximumTorrentFileBytes
    ));

    setFiles((currentFiles) => [
      ...currentFiles,
      ...validFiles,
    ]);
    setSourceMode('file');
    setResults({});
    setRequiresVPNConnection(false);
    setError((validFiles.length === nextFiles.length) ? '' : 'Some files were skipped. Choose non-empty .torrent files up to 16 MiB.');

    return;
  };

  /**
   * Add Torrent Dialog - Select Profile.
   *
   * Stores an explicit choice separately from an automatic match.
   * This also removes the Matched tag after a person changes the selection.
   *
   * @param {Web_AddTorrentDialog_AddTorrentDialog_SelectProfile_SourceKey} sourceKey - Source key.
   * @param {Web_AddTorrentDialog_AddTorrentDialog_SelectProfile_ProfileId} profileId - Profile id.
   *
   * @returns {Web_AddTorrentDialog_AddTorrentDialog_SelectProfile_Returns}
   *
   * @since 2.0.0
   */
  const selectProfile: Web_AddTorrentDialog_AddTorrentDialog_SelectProfile = (sourceKey: Web_AddTorrentDialog_AddTorrentDialog_SelectProfile_SourceKey, profileId: Web_AddTorrentDialog_AddTorrentDialog_SelectProfile_ProfileId): Web_AddTorrentDialog_AddTorrentDialog_SelectProfile_Returns => {
    setProfileOverrides((currentOverrides) => ({
      ...currentOverrides,
      [sourceKey]: profileId,
    }));
    setResults({});
    setRequiresVPNConnection(false);

    return;
  };

  /**
   * Add Torrent Dialog - Select Profile For Every Source.
   *
   * Applies one explicit choice to every source in the list at once.
   * Each source's own select still changes it afterwards.
   *
   * @param {Web_AddTorrentDialog_AddTorrentDialog_SelectProfileForEverySource_ProfileId} profileId - Profile id.
   *
   * @returns {Web_AddTorrentDialog_AddTorrentDialog_SelectProfileForEverySource_Returns}
   *
   * @since 2.3.0
   */
  const selectProfileForEverySource: Web_AddTorrentDialog_AddTorrentDialog_SelectProfileForEverySource = (profileId: Web_AddTorrentDialog_AddTorrentDialog_SelectProfileForEverySource_ProfileId): Web_AddTorrentDialog_AddTorrentDialog_SelectProfileForEverySource_Returns => {
    setProfileOverrides(Object.fromEntries(sources.map<Web_AddTorrentDialog_AddTorrentDialog_SelectProfileForEverySource_Override>((source) => [
      source['key'],
      profileId,
    ])));
    setResults({});
    setRequiresVPNConnection(false);

    return;
  };

  /**
   * Add Torrent Dialog - Source Connection Name.
   *
   * Resolves the selected profile through the current default when needed.
   * Conflict messages name the same connection the backend tried to use.
   *
   * @param {Web_AddTorrentDialog_AddTorrentDialog_SourceConnectionName_Source} source - Source.
   *
   * @returns {Web_AddTorrentDialog_AddTorrentDialog_SourceConnectionName_Returns}
   *
   * @since 2.0.0
   */
  const sourceConnectionName: Web_AddTorrentDialog_AddTorrentDialog_SourceConnectionName = (source: Web_AddTorrentDialog_AddTorrentDialog_SourceConnectionName_Source): Web_AddTorrentDialog_AddTorrentDialog_SourceConnectionName_Returns => {
    const profileId: Web_AddTorrentDialog_AddTorrentDialog_SourceConnectionName_ProfileId = profileOverrides[source['key']]
      ?? ((source['matchedProfileIds'].length === 1) ? source['matchedProfileIds'][0] ?? '' : defaultProfileSelectionValue);
    const profile: Web_AddTorrentDialog_AddTorrentDialog_SourceConnectionName_Profile = profiles.find(
      (candidate) => candidate['id'] === profileId,
    );
    let connectionId: Web_AddTorrentDialog_AddTorrentDialog_SourceConnectionName_ConnectionId = (profile !== undefined && profile['connectionId'] !== null) ? profile['connectionId'] : undefined;

    if (profile === undefined || profile['connectionId'] === null) {
      const defaultConnection: Web_AddTorrentDialog_AddTorrentDialog_SourceConnectionName_DefaultConnection = connections.find((connection) => connection['default']);

      connectionId = (defaultConnection !== undefined) ? defaultConnection['id'] : undefined;
    }

    const sourceConnection: Web_AddTorrentDialog_AddTorrentDialog_SourceConnectionName_SourceConnection = connections.find((connection) => connection['id'] === connectionId);

    return (sourceConnection !== undefined) ? sourceConnection['name'] : 'The selected connection';
  };

  /**
   * Add Torrent Dialog - Profile Connection Label.
   *
   * Names an explicit connection or the current default used by profiles whose
   * connection follows the container default.
   *
   * @param {Web_AddTorrentDialog_AddTorrentDialog_ProfileConnectionLabel_Profile} profile - Profile.
   *
   * @returns {Web_AddTorrentDialog_AddTorrentDialog_ProfileConnectionLabel_Returns}
   *
   * @since 2.0.0
   */
  const profileConnectionLabel: Web_AddTorrentDialog_AddTorrentDialog_ProfileConnectionLabel = (profile: Web_AddTorrentDialog_AddTorrentDialog_ProfileConnectionLabel_Profile): Web_AddTorrentDialog_AddTorrentDialog_ProfileConnectionLabel_Returns => {
    const defaultConnection: Web_AddTorrentDialog_AddTorrentDialog_ProfileConnectionLabel_DefaultConnection = connections.find((connection) => connection['default']);

    if (!('connectionId' in profile) || profile['connectionId'] === null) {
      const defaultConnectionName: Web_AddTorrentDialog_AddTorrentDialog_ProfileConnectionLabel_DefaultConnectionName = (defaultConnection !== undefined) ? defaultConnection['name'] : undefined;

      return `Default (${defaultConnectionName ?? 'connection'})`;
    }

    const profileConnection: Web_AddTorrentDialog_AddTorrentDialog_ProfileConnectionLabel_ProfileConnection = connections.find((connection) => connection['id'] === profile['connectionId']);

    return (profileConnection !== undefined) ? profileConnection['name'] : 'Unavailable connection';
  };

  /**
   * Add Torrent Dialog - Build Input.
   *
   * Applies editable values for one source and profile defaults for a batch.
   * Source content is converted only when its request is ready to run.
   *
   * @param {Web_AddTorrentDialog_AddTorrentDialog_BuildInput_Source}   source   - Source.
   * @param {Web_AddTorrentDialog_AddTorrentDialog_BuildInput_Multiple} multiple - Multiple.
   *
   * @returns {Web_AddTorrentDialog_AddTorrentDialog_BuildInput_Returns}
   *
   * @since 2.0.0
   */
  const buildInput: Web_AddTorrentDialog_AddTorrentDialog_BuildInput = async (
    source: Web_AddTorrentDialog_AddTorrentDialog_BuildInput_Source,
    multiple: Web_AddTorrentDialog_AddTorrentDialog_BuildInput_Multiple,
  ): Web_AddTorrentDialog_AddTorrentDialog_BuildInput_Returns => {
    const profileId: Web_AddTorrentDialog_AddTorrentDialog_BuildInput_ProfileId = profileOverrides[source['key']]
      ?? ((source['matchedProfileIds'].length === 1) ? source['matchedProfileIds'][0] ?? '' : defaultProfileSelectionValue);
    const profile: Web_AddTorrentDialog_AddTorrentDialog_BuildInput_Profile = profiles.find(
      (candidate) => candidate['id'] === profileId,
    );
    const profileData: Web_AddTorrentDialog_AddTorrentDialog_BuildInput_ProfileData = profile ?? defaultProfile;
    const input: Web_AddTorrentDialog_AddTorrentDialog_BuildInput_Input = {
      paused: (multiple === true) ? profileData['startPaused'] : paused,
    };
    const nextLabels: Web_AddTorrentDialog_AddTorrentDialog_BuildInput_NextLabels = (multiple === true) ? profileData['labels'] : parseLabels(labels);

    if (profile !== undefined) {
      Reflect.set(input, 'profileId', profile['id']);
    }

    Reflect.set(input, 'labels', nextLabels);

    if (source['kind'] === 'link' && source['link'] !== undefined) {
      Reflect.set(input, 'filename', source['link']);
    } else if (source['file'] !== undefined) {
      const metainfo: Web_AddTorrentDialog_AddTorrentDialog_BuildInput_Metainfo = await fileAsBase64(source['file']);

      Reflect.set(input, 'metainfo', metainfo);
    }

    return input;
  };

  /**
   * Add Torrent Dialog - Add Batch Source.
   *
   * Recurses after each settled request to preserve the visible source order.
   * Every source gets an independent success, duplicate, or failure result.
   *
   * @param {Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_Index} index - Index.
   *
   * @returns {Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_Returns}
   *
   * @since 2.0.0
   */
  const addBatchSource: Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource = async (index: Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_Index): Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_Returns => {
    const source: Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_Source = sources[index];

    if (source === undefined) {
      return;
    }

    try {
      const input: Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_Input = await buildInput(source, true);
      const result: Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_Result = await onAdd(input);
      const profileId: Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_ProfileId = profileOverrides[source['key']]
        ?? ((source['matchedProfileIds'].length === 1) ? source['matchedProfileIds'][0] ?? '' : defaultProfileSelectionValue);
      const profile: Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_Profile = profiles.find(
        (candidate) => candidate['id'] === profileId,
      );
      const addedDownloadDirectory: Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_AddedDownloadDirectory = (profile ?? defaultProfile)['downloadDirectory'];

      setResults((currentResults) => ({
        ...currentResults,
        [source['key']]: {
          detail: (result['duplicate'] === true) ? duplicateNotice(result) : `Added to ${addedDownloadDirectory}`,
          status: (result['duplicate'] === true) ? 'duplicate' : 'added',
        },
      }));
    } catch (caughtError) {
      const detail: Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_Detail = connectionBeingRemovedMessage(
        caughtError,
        sourceConnectionName(source),
      ) ?? ((caughtError instanceof Error) ? caughtError.message : 'The torrent could not be added.');

      setResults((currentResults) => ({
        ...currentResults,
        [source['key']]: {
          detail,
          requiresVPNConnection: isVPNConnectionRequiredError(caughtError),
          status: 'failed',
        },
      }));
    }

    await addBatchSource(index + 1);

    return;
  };

  /**
   * Add Torrent Dialog - Handle Submit.
   *
   * Closes after one successful source and retains multi-source result rows.
   * This makes partial batch failures visible without losing their reasons.
   *
   * @param {Web_AddTorrentDialog_AddTorrentDialog_HandleSubmit_Event} event - Event.
   *
   * @returns {Web_AddTorrentDialog_AddTorrentDialog_HandleSubmit_Returns}
   *
   * @since 2.0.0
   */
  const handleSubmit: Web_AddTorrentDialog_AddTorrentDialog_HandleSubmit = async (event: Web_AddTorrentDialog_AddTorrentDialog_HandleSubmit_Event): Web_AddTorrentDialog_AddTorrentDialog_HandleSubmit_Returns => {
    event.preventDefault();

    setError('');
    setRequiresVPNConnection(false);

    if (sources.length === 0) {
      setError((sourceMode === 'link') ? 'Enter at least one torrent URL or magnet link.' : 'Choose at least one .torrent file.');

      return;
    }

    if (hasUnresolvedProfileChoice === true) {
      setError('Pick a profile for every torrent that matches more than one profile.');

      return;
    }

    setSubmitting(true);
    setResults({});

    try {
      if (sources.length > 1) {
        await addBatchSource(0);

        return;
      }

      const source: Web_AddTorrentDialog_AddTorrentDialog_HandleSubmit_Source = sources[0];

      if (source === undefined) {
        return;
      }

      const result: Web_AddTorrentDialog_AddTorrentDialog_HandleSubmit_Result = await onAdd(await buildInput(source, false));

      if (result['duplicate'] === true) {
        showToast(duplicateNotice(result), true);
      }

      onClose();
    } catch (caughtError) {
      const source: Web_AddTorrentDialog_AddTorrentDialog_HandleSubmit_Source = sources[0];
      const connectionName: Web_AddTorrentDialog_AddTorrentDialog_HandleSubmit_ConnectionName = (source === undefined) ? 'The selected connection' : sourceConnectionName(source);

      setError(connectionBeingRemovedMessage(caughtError, connectionName) ?? (
        (caughtError instanceof Error) ? caughtError.message : 'The torrent could not be added.'
      ));
      setRequiresVPNConnection(isVPNConnectionRequiredError(caughtError));
    } finally {
      setSubmitting(false);
    }

    return;
  };

  const allProcessed: Web_AddTorrentDialog_AddTorrentDialog_AllProcessed = sources.length > 1
    && sources.every((source) => results[source['key']] !== undefined);
  const batchSummary: Web_AddTorrentDialog_AddTorrentDialog_BatchSummary = summarizeTorrentAddBatch(sources.flatMap(
    (source) => {
      const result: Web_AddTorrentDialog_AddTorrentDialog_BatchResult = results[source['key']];

      return (result === undefined) ? [] : [result['status']];
    },
  ));
  let dialogTitle: Web_AddTorrentDialog_AddTorrentDialog_DialogTitle = 'Add torrent';

  if (allProcessed === true) {
    dialogTitle = batchSummary['title'];
  } else if (sources.length > 1) {
    dialogTitle = 'Add torrents';
  }

  let fileDropTitle: Web_AddTorrentDialog_AddTorrentDialog_FileDropTitle = `${files.length} .torrent files`;

  if (files.length === 0) {
    fileDropTitle = 'Drop .torrent files here';
  } else if (files.length === 1) {
    const firstFile: Web_AddTorrentDialog_AddTorrentDialog_FirstFile = files[0];

    fileDropTitle = (firstFile !== undefined) ? firstFile.name : undefined;
  }

  let submitLabel: Web_AddTorrentDialog_AddTorrentDialog_SubmitLabel = 'Add torrent';

  if (submitting === true) {
    submitLabel = 'Adding…';
  } else if (sources.length > 1) {
    submitLabel = 'Add torrents';
  }

  let matchedPattern: Web_AddTorrentDialog_AddTorrentDialog_MatchedPattern = undefined;

  if (singleSource !== undefined && singleSource['matchedProfileIds'].length === 1) {
    const matchedProfile: Web_AddTorrentDialog_AddTorrentDialog_MatchedProfile = profiles.find((profile) => profile['id'] === singleSource['matchedProfileIds'][0]);

    if (matchedProfile !== undefined) {
      matchedPattern = matchedProfile['matchPatterns'].find((pattern) => torrentNameMatchesPattern(singleSource['name'], pattern));
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        aria-labelledby="add-torrent-title"
        aria-modal="true"
        className={(sources.length > 1) ? 'dialog dialog-wide' : 'dialog'}
        role="dialog"
      >
        <div className="dialog-heading">
          <div>
            <h2 id="add-torrent-title">{dialogTitle}</h2>
            {(allProcessed === true) ? <p>{batchSummary['detail']}</p> : null}
            {(allProcessed === false && sources.length > 1) ? <p>Review the matched profile for each source.</p> : null}
            {(allProcessed === false && singleSource !== undefined) ? (
              <p className="torrent-preview-summary">
                <span>{singleSource['displayName']}</span>
                {(singleSource['size'] === null) ? null : <span>{formatBytes(singleSource['size'])}</span>}
                {(singleSource['checking'] === true) ? <span className="torrent-preview-checking">Checking…</span> : null}
                {(singleSource['alreadyAdded'] === true) ? <span className="torrent-preview-duplicate">Already added</span> : null}
              </p>
            ) : null}
          </div>
          <button aria-label="Close" className="icon-button" disabled={submitting} onClick={onClose} type="button">
            <Icon name="x" />
          </button>
        </div>

        {(allProcessed === false) ? (
          <div className="source-tabs" role="tablist">
            <button
              aria-selected={sourceMode === 'link'}
              onClick={() => {
                setSourceMode('link');
                setResults({});

                return;
              }}
              role="tab"
              type="button"
            >
              Links or magnets
            </button>
            <button
              aria-selected={sourceMode === 'file'}
              onClick={() => {
                setSourceMode('file');
                setResults({});

                return;
              }}
              role="tab"
              type="button"
            >
              Torrent files
            </button>
          </div>
        ) : null}

        <form noValidate onSubmit={handleSubmit}>
          {(allProcessed === false && sourceMode === 'link') ? (
            <FieldLabel>
              <span>Torrent URLs or magnet links</span>
              <textarea
                onChange={(event) => {
                  setLinkText(event.currentTarget.value);
                  setResults({});

                  return;
                }}
                placeholder={[
                  'One per line',
                  'magnet:?xt=urn:btih:…',
                ].join('\n')}
                rows={4}
                value={linkText}
              />
              <small>Enter one link per line.</small>
            </FieldLabel>
          ) : null}

          {(allProcessed === false && sourceMode === 'file') ? (
            <label
              className={(dragActive === true) ? 'file-drop file-drop-active' : 'file-drop'}
              onDragEnter={() => setDragActive(true)}
              onDragLeave={() => setDragActive(false)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();

                setDragActive(false);

                acceptFiles([...event.dataTransfer.files]);

                return;
              }}
            >
              <Icon name="upload" size={24} />
              <strong>{fileDropTitle}</strong>
              <span>{(files.length === 0) ? 'or browse from this device' : 'Drop more files here, or browse this device'}</span>
              <input
                accept=".torrent,application/x-bittorrent"
                multiple
                onChange={(event) => acceptFiles([...(event.currentTarget.files ?? [])])}
                type="file"
              />
            </label>
          ) : null}

          {(
            allProcessed === true
            || sources.length <= 1
            || singleSource !== undefined
          ) ? null : (
              <label className="field">
                <span>Profile for every source</span>
                <select
                  className="select-control"
                  disabled={submitting}
                  onChange={(event) => selectProfileForEverySource(event.currentTarget.value)}
                  value={sharedProfileId}
                >
                  <option className="select-placeholder" disabled value="">— Select one —</option>
                  <option value={defaultProfileSelectionValue}>{defaultProfile['name']}</option>
                  {profiles.map((profile) => (
                    <option key={profile['id']} value={profile['id']}>{profile['name']}</option>
                  ))}
                </select>
              </label>
            )}

          {(sources.length <= 1 || singleSource !== undefined) ? null : (
            <div className="torrent-file-list">
              {sources.map((source) => {
                const result: Web_AddTorrentDialog_AddTorrentDialog_SourceResult = results[source['key']];
                const ambiguousMatch: Web_AddTorrentDialog_AddTorrentDialog_AmbiguousMatch = source['matchedProfileIds'].length > 1
                  && profileOverrides[source['key']] === undefined;
                const selectedProfileId: Web_AddTorrentDialog_AddTorrentDialog_SelectedProfileId = profileOverrides[source['key']]
                  ?? automaticProfileSelectionValue(source);
                const automaticallyMatched: Web_AddTorrentDialog_AddTorrentDialog_AutomaticallyMatched = profileOverrides[source['key']] === undefined
                  && source['matchedProfileIds'].length === 1;
                let resultLabel: Web_AddTorrentDialog_AddTorrentDialog_ResultLabel = 'Failed';

                if (result !== undefined && result['status'] === 'added') {
                  resultLabel = 'Added';
                } else if (result !== undefined && result['status'] === 'duplicate') {
                  resultLabel = 'Already added';
                }

                return (
                  <div className="torrent-file-row" key={source['key']}>
                    <div className="torrent-file-copy">
                      <div className="torrent-file-title">
                        <strong title={source['displayName']}>{source['displayName']}</strong>
                        {(source['checking'] === true) ? <span className="torrent-preview-checking">Checking…</span> : null}
                        {(source['alreadyAdded'] === true) ? <span className="torrent-preview-duplicate">Already added</span> : null}
                      </div>
                      <small>{(source['size'] === null) ? source['link'] : formatBytes(source['size'])}</small>
                    </div>
                    {(result === undefined) ? (
                      <div className="profile-select-with-tag">
                        <select
                          aria-label={`Profile for ${source['displayName']}`}
                          className="select-control"
                          disabled={submitting}
                          onChange={(event) => selectProfile(source['key'], event.currentTarget.value)}
                          value={selectedProfileId}
                        >
                          {(ambiguousMatch === true) ? (
                            <option disabled value="">{`Matches ${source['matchedProfileIds'].length} profiles. Pick one.`}</option>
                          ) : null}
                          <option value={defaultProfileSelectionValue}>{defaultProfile['name']}</option>
                          {profiles.map((profile) => (
                            <option key={profile['id']} value={profile['id']}>{profile['name']}</option>
                          ))}
                        </select>
                        {(automaticallyMatched === true) ? <span className="tag match-tag">Matched</span> : null}
                      </div>
                    ) : (
                      <div className="torrent-result">
                        <span className={`state-chip result-${result['status']}`}>{resultLabel}</span>
                        <small>{result['detail']}</small>
                        {(result['requiresVPNConnection'] === true) ? (
                          <button className="inline-link-button" onClick={onOpenVPN} type="button">Add VPN connection</button>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {(singleSource === undefined) ? null : (
            <>
              <label className="field">
                <span>Profile</span>
                <span className="profile-select-with-tag">
                  <select
                    onChange={(event) => selectProfile(singleSource['key'], event.currentTarget.value)}
                    value={selectedSingleProfileId}
                  >
                    {(singleSource['matchedProfileIds'].length > 1 && profileOverrides[singleSource['key']] === undefined) ? (
                      <option disabled value="">{`Matches ${singleSource['matchedProfileIds'].length} profiles. Pick one.`}</option>
                    ) : null}
                    <option value={defaultProfileSelectionValue}>{defaultProfile['name']}</option>
                    {profiles.map((profile) => (
                      <option key={profile['id']} value={profile['id']}>{profile['name']}</option>
                    ))}
                  </select>
                  {(profileOverrides[singleSource['key']] === undefined && singleSource['matchedProfileIds'].length === 1) ? <span className="tag match-tag">Matched</span> : null}
                </span>
                {(singleSource['matchedProfileIds'].length === 1) ? (
                  <small>{`Matched by ${matchedPattern ?? 'a profile pattern'}`}</small>
                ) : null}
                {(singleSource['matchedProfileIds'].length > 1 && profileOverrides[singleSource['key']] === undefined) ? (
                  <small>{`Matches ${singleSource['matchedProfileIds'].length} profiles. Pick one.`}</small>
                ) : null}
              </label>

              <div className="field-row">
                <label className="field">
                  <span>Download location</span>
                  <input className="profile-derived-value" readOnly type="text" value={selectedDownloadDirectory} />
                  {(freeSpace === null) ? null : <small className="free-space-value">{`${formatBytes(freeSpace)} free`}</small>}
                </label>
                <label className="field">
                  <span>VPN connection</span>
                  <input className="profile-derived-value" readOnly type="text" value={profileConnectionLabel(selectedSingleProfileData)} />
                </label>
              </div>

              <LabelPicker
                labels={labelPresets}
                onChange={setLabels}
                title="Labels"
                value={labels}
              />

              <label aria-label="Add paused" className="check-row">
                <input checked={paused} onChange={(event) => setPaused(event.currentTarget.checked)} type="checkbox" />
                <span>
                  <strong>Add paused</strong>
                  <small>Review files and options before it starts.</small>
                </span>
              </label>

              <div className="also-applies">
                <Icon name="settings" size={16} />
                <div>
                  <strong>Also applies</strong>
                  <dl>
                    {profileOptionRows(selectedSingleProfileData).map((row) => (
                      <div key={row[0]}>
                        <dt>{row[0]}</dt>
                        <dd>{row[1]}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </>
          )}

          {(error === '') ? null : (
            <div className="form-error" role="alert">
              <span>{error}</span>
              {(requiresVPNConnection === true) ? <button className="inline-link-button" onClick={onOpenVPN} type="button">Add VPN connection</button> : null}
            </div>
          )}

          <div className="dialog-actions">
            {(allProcessed === true) ? (
              <Button onClick={onClose} variant="primary">Done</Button>
            ) : (
              <>
                <Button disabled={submitting} onClick={onClose}>Cancel</Button>
                <Button
                  disabled={(
                    submitting === true
                    || previewingLinks === true
                    || sources.length === 0
                    || hasUnresolvedProfileChoice === true
                  )}
                  icon="add"
                  type="submit"
                  variant="primary"
                >
                  {submitLabel}
                </Button>
              </>
            )}
          </div>
        </form>
      </section>
    </div>
  );
};
