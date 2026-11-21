import type {
  Dispatch,
  FormEvent,
  ReactElement,
  RefObject,
  SetStateAction,
} from 'react';

import type {
  Web_Api_AddTorrentInput,
  Web_Api_DefaultTorrentProfile,
  Web_Api_TorrentAddResult,
  Web_Api_TorrentLinkPreview,
  Web_Api_TorrentLinkPreviewResponse,
  Web_Api_TorrentProfile,
  Web_Api_TorrentProfileOptions,
  Web_Api_VpnConnection,
} from '@/types/web/api.d.ts';
import type {
  Web_Components_AddTorrentDialog_Props,
  Web_Components_AddTorrentResult,
  Web_Components_AddTorrentSource,
} from '@/types/web/components.d.ts';

/**
 * Add Torrent Dialog.
 *
 * @since 2.4.1
 */
export type Web_AddTorrentDialog_AddTorrentDialog_Props = Web_Components_AddTorrentDialog_Props;
export type Web_AddTorrentDialog_AddTorrentDialog_Returns = ReactElement | null;
export type Web_AddTorrentDialog_AddTorrentDialog_Connections = Web_Components_AddTorrentDialog_Props['connections'];
export type Web_AddTorrentDialog_AddTorrentDialog_DefaultProfile = Web_Components_AddTorrentDialog_Props['defaultProfile'];
export type Web_AddTorrentDialog_AddTorrentDialog_LabelPresets = Web_Components_AddTorrentDialog_Props['labelPresets'];
export type Web_AddTorrentDialog_AddTorrentDialog_Open = Web_Components_AddTorrentDialog_Props['open'];
export type Web_AddTorrentDialog_AddTorrentDialog_OnAdd = Web_Components_AddTorrentDialog_Props['onAdd'];
export type Web_AddTorrentDialog_AddTorrentDialog_OnClose = Web_Components_AddTorrentDialog_Props['onClose'];
export type Web_AddTorrentDialog_AddTorrentDialog_OnOpenVpn = Web_Components_AddTorrentDialog_Props['onOpenVPN'];
export type Web_AddTorrentDialog_AddTorrentDialog_Profiles = Web_Components_AddTorrentDialog_Props['profiles'];
export type Web_AddTorrentDialog_AddTorrentDialog_Torrents = Web_Components_AddTorrentDialog_Props['torrents'];
export type Web_AddTorrentDialog_AddTorrentDialog_SourceModeState = [Web_AddTorrentDialog_AddTorrentDialog_SourceMode, Dispatch<SetStateAction<Web_AddTorrentDialog_AddTorrentDialog_SourceMode>>];
export type Web_AddTorrentDialog_AddTorrentDialog_SourceMode = 'link' | 'file';
export type Web_AddTorrentDialog_AddTorrentDialog_SetSourceMode = Dispatch<SetStateAction<Web_AddTorrentDialog_AddTorrentDialog_SourceMode>>;
export type Web_AddTorrentDialog_AddTorrentDialog_LinkTextState = [string, Dispatch<SetStateAction<string>>];
export type Web_AddTorrentDialog_AddTorrentDialog_LinkText = string;
export type Web_AddTorrentDialog_AddTorrentDialog_SetLinkText = Dispatch<SetStateAction<string>>;
export type Web_AddTorrentDialog_AddTorrentDialog_FilesState = [File[], Dispatch<SetStateAction<File[]>>];
export type Web_AddTorrentDialog_AddTorrentDialog_Files = File[];
export type Web_AddTorrentDialog_AddTorrentDialog_SetFiles = Dispatch<SetStateAction<File[]>>;
export type Web_AddTorrentDialog_AddTorrentDialog_ProfileOverridesState = [Record<string, string>, Dispatch<SetStateAction<Record<string, string>>>];
export type Web_AddTorrentDialog_AddTorrentDialog_ProfileOverrides = Record<string, string>;
export type Web_AddTorrentDialog_AddTorrentDialog_SetProfileOverrides = Dispatch<SetStateAction<Record<string, string>>>;
export type Web_AddTorrentDialog_AddTorrentDialog_LabelsState = [string, Dispatch<SetStateAction<string>>];
export type Web_AddTorrentDialog_AddTorrentDialog_Labels = string;
export type Web_AddTorrentDialog_AddTorrentDialog_SetLabels = Dispatch<SetStateAction<string>>;
export type Web_AddTorrentDialog_AddTorrentDialog_PausedState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_AddTorrentDialog_AddTorrentDialog_Paused = boolean;
export type Web_AddTorrentDialog_AddTorrentDialog_SetPaused = Dispatch<SetStateAction<boolean>>;
export type Web_AddTorrentDialog_AddTorrentDialog_DragActiveState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_AddTorrentDialog_AddTorrentDialog_DragActive = boolean;
export type Web_AddTorrentDialog_AddTorrentDialog_SetDragActive = Dispatch<SetStateAction<boolean>>;
export type Web_AddTorrentDialog_AddTorrentDialog_ResultsState = [Record<string, Web_Components_AddTorrentResult>, Dispatch<SetStateAction<Record<string, Web_Components_AddTorrentResult>>>];
export type Web_AddTorrentDialog_AddTorrentDialog_Results = Record<string, Web_Components_AddTorrentResult>;
export type Web_AddTorrentDialog_AddTorrentDialog_SetResults = Dispatch<SetStateAction<Record<string, Web_Components_AddTorrentResult>>>;
export type Web_AddTorrentDialog_AddTorrentDialog_ErrorState = [string, Dispatch<SetStateAction<string>>];
export type Web_AddTorrentDialog_AddTorrentDialog_Error = string;
export type Web_AddTorrentDialog_AddTorrentDialog_SetError = Dispatch<SetStateAction<string>>;
export type Web_AddTorrentDialog_AddTorrentDialog_RequiresVpnConnectionState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_AddTorrentDialog_AddTorrentDialog_RequiresVpnConnection = boolean;
export type Web_AddTorrentDialog_AddTorrentDialog_SetRequiresVpnConnection = Dispatch<SetStateAction<boolean>>;
export type Web_AddTorrentDialog_AddTorrentDialog_SubmittingState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_AddTorrentDialog_AddTorrentDialog_Submitting = boolean;
export type Web_AddTorrentDialog_AddTorrentDialog_SetSubmitting = Dispatch<SetStateAction<boolean>>;
export type Web_AddTorrentDialog_AddTorrentDialog_FreeSpaceState = [number | null, Dispatch<SetStateAction<number | null>>];
export type Web_AddTorrentDialog_AddTorrentDialog_FreeSpace = number | null;
export type Web_AddTorrentDialog_AddTorrentDialog_SetFreeSpace = Dispatch<SetStateAction<number | null>>;
export type Web_AddTorrentDialog_AddTorrentDialog_LinkPreviewsState = [Record<number, Web_Api_TorrentLinkPreview>, Dispatch<SetStateAction<Record<number, Web_Api_TorrentLinkPreview>>>];
export type Web_AddTorrentDialog_AddTorrentDialog_LinkPreviews = Record<number, Web_Api_TorrentLinkPreview>;
export type Web_AddTorrentDialog_AddTorrentDialog_SetLinkPreviews = Dispatch<SetStateAction<Record<number, Web_Api_TorrentLinkPreview>>>;
export type Web_AddTorrentDialog_AddTorrentDialog_PreviewingLinksState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_AddTorrentDialog_AddTorrentDialog_PreviewingLinks = boolean;
export type Web_AddTorrentDialog_AddTorrentDialog_SetPreviewingLinks = Dispatch<SetStateAction<boolean>>;
export type Web_AddTorrentDialog_AddTorrentDialog_SingleDefaultsKeyRef = RefObject<string>;
export type Web_AddTorrentDialog_AddTorrentDialog_SingleDefaultsKey = string;
export type Web_AddTorrentDialog_AddTorrentDialog_Links = string[];
export type Web_AddTorrentDialog_AddTorrentDialog_LinkSources = Web_Components_AddTorrentSource[];
export type Web_AddTorrentDialog_AddTorrentDialog_Preview = Web_Api_TorrentLinkPreview | undefined;
export type Web_AddTorrentDialog_AddTorrentDialog_PreviewName = string | undefined;
export type Web_AddTorrentDialog_AddTorrentDialog_LinkName = string;
export type Web_AddTorrentDialog_AddTorrentDialog_LinkMatchedProfiles = Web_Api_TorrentProfile[];
export type Web_AddTorrentDialog_AddTorrentDialog_Hash = string | null;
export type Web_AddTorrentDialog_AddTorrentDialog_Size = number | null;
export type Web_AddTorrentDialog_AddTorrentDialog_FileSources = Web_Components_AddTorrentSource[];
export type Web_AddTorrentDialog_AddTorrentDialog_FileName = string;
export type Web_AddTorrentDialog_AddTorrentDialog_FileMatchedProfiles = Web_Api_TorrentProfile[];
export type Web_AddTorrentDialog_AddTorrentDialog_Sources = Web_Components_AddTorrentSource[];
export type Web_AddTorrentDialog_AddTorrentDialog_HasUnresolvedProfileChoice = boolean;
export type Web_AddTorrentDialog_AddTorrentDialog_SingleSource = Web_Components_AddTorrentSource | undefined;
export type Web_AddTorrentDialog_AddTorrentDialog_SourceProfileIds = string[];
export type Web_AddTorrentDialog_AddTorrentDialog_SharedProfileId = string;
export type Web_AddTorrentDialog_AddTorrentDialog_SelectedSingleProfileId = string;
export type Web_AddTorrentDialog_AddTorrentDialog_SelectedSingleProfile = Web_Api_TorrentProfile | undefined;
export type Web_AddTorrentDialog_AddTorrentDialog_SelectedSingleProfileData = Web_Api_DefaultTorrentProfile | Web_Api_TorrentProfile;
export type Web_AddTorrentDialog_AddTorrentDialog_SelectedDownloadDirectory = string;
export type Web_AddTorrentDialog_AddTorrentDialog_PreviewCancelled = boolean;
export type Web_AddTorrentDialog_AddTorrentDialog_Timeout = number;
export type Web_AddTorrentDialog_AddTorrentDialog_Batch = string[];
export type Web_AddTorrentDialog_AddTorrentDialog_Batches = Web_AddTorrentDialog_AddTorrentDialog_Batch[];
export type Web_AddTorrentDialog_AddTorrentDialog_Previews = Record<number, Web_Api_TorrentLinkPreview>;
export type Web_AddTorrentDialog_AddTorrentDialog_BatchIndex = number;
export type Web_AddTorrentDialog_AddTorrentDialog_Response = Web_Api_TorrentLinkPreviewResponse | null;
export type Web_AddTorrentDialog_AddTorrentDialog_BatchLinks = string[] | undefined;
export type Web_AddTorrentDialog_AddTorrentDialog_BatchLength = number;
export type Web_AddTorrentDialog_AddTorrentDialog_DefaultsKey = string;
export type Web_AddTorrentDialog_AddTorrentDialog_FreeSpaceCancelled = boolean;
export type Web_AddTorrentDialog_AddTorrentDialog_AcceptFiles_NextFiles = File[];
export type Web_AddTorrentDialog_AddTorrentDialog_AcceptFiles_Returns = void;
export type Web_AddTorrentDialog_AddTorrentDialog_AcceptFiles = (nextFiles: Web_AddTorrentDialog_AddTorrentDialog_AcceptFiles_NextFiles) => Web_AddTorrentDialog_AddTorrentDialog_AcceptFiles_Returns;
export type Web_AddTorrentDialog_AddTorrentDialog_AcceptFiles_ValidFiles = File[];
export type Web_AddTorrentDialog_AddTorrentDialog_SelectProfile_SourceKey = string;
export type Web_AddTorrentDialog_AddTorrentDialog_SelectProfile_ProfileId = string;
export type Web_AddTorrentDialog_AddTorrentDialog_SelectProfile_Returns = void;
export type Web_AddTorrentDialog_AddTorrentDialog_SelectProfile = (sourceKey: Web_AddTorrentDialog_AddTorrentDialog_SelectProfile_SourceKey, profileId: Web_AddTorrentDialog_AddTorrentDialog_SelectProfile_ProfileId) => Web_AddTorrentDialog_AddTorrentDialog_SelectProfile_Returns;
export type Web_AddTorrentDialog_AddTorrentDialog_SelectProfileForEverySource_ProfileId = string;
export type Web_AddTorrentDialog_AddTorrentDialog_SelectProfileForEverySource_Returns = void;
export type Web_AddTorrentDialog_AddTorrentDialog_SelectProfileForEverySource = (profileId: Web_AddTorrentDialog_AddTorrentDialog_SelectProfileForEverySource_ProfileId) => Web_AddTorrentDialog_AddTorrentDialog_SelectProfileForEverySource_Returns;
export type Web_AddTorrentDialog_AddTorrentDialog_SelectProfileForEverySource_Override = [string, string];
export type Web_AddTorrentDialog_AddTorrentDialog_SourceConnectionName_Source = Web_Components_AddTorrentSource;
export type Web_AddTorrentDialog_AddTorrentDialog_SourceConnectionName_Returns = string;
export type Web_AddTorrentDialog_AddTorrentDialog_SourceConnectionName = (source: Web_AddTorrentDialog_AddTorrentDialog_SourceConnectionName_Source) => Web_AddTorrentDialog_AddTorrentDialog_SourceConnectionName_Returns;
export type Web_AddTorrentDialog_AddTorrentDialog_SourceConnectionName_ProfileId = string;
export type Web_AddTorrentDialog_AddTorrentDialog_SourceConnectionName_Profile = Web_Api_TorrentProfile | undefined;
export type Web_AddTorrentDialog_AddTorrentDialog_SourceConnectionName_ConnectionId = string | undefined;
export type Web_AddTorrentDialog_AddTorrentDialog_SourceConnectionName_DefaultConnection = Web_Api_VpnConnection | undefined;
export type Web_AddTorrentDialog_AddTorrentDialog_SourceConnectionName_SourceConnection = Web_Api_VpnConnection | undefined;
export type Web_AddTorrentDialog_AddTorrentDialog_ProfileConnectionLabel_Profile = Web_Api_DefaultTorrentProfile | Web_Api_TorrentProfile;
export type Web_AddTorrentDialog_AddTorrentDialog_ProfileConnectionLabel_Returns = string;
export type Web_AddTorrentDialog_AddTorrentDialog_ProfileConnectionLabel = (profile: Web_AddTorrentDialog_AddTorrentDialog_ProfileConnectionLabel_Profile) => Web_AddTorrentDialog_AddTorrentDialog_ProfileConnectionLabel_Returns;
export type Web_AddTorrentDialog_AddTorrentDialog_ProfileConnectionLabel_DefaultConnection = Web_Api_VpnConnection | undefined;
export type Web_AddTorrentDialog_AddTorrentDialog_ProfileConnectionLabel_DefaultConnectionName = string | undefined;
export type Web_AddTorrentDialog_AddTorrentDialog_ProfileConnectionLabel_ProfileConnection = Web_Api_VpnConnection | undefined;
export type Web_AddTorrentDialog_AddTorrentDialog_BuildInput_Source = Web_Components_AddTorrentSource;
export type Web_AddTorrentDialog_AddTorrentDialog_BuildInput_Multiple = boolean;
export type Web_AddTorrentDialog_AddTorrentDialog_BuildInput_Returns = Promise<Web_Api_AddTorrentInput>;
export type Web_AddTorrentDialog_AddTorrentDialog_BuildInput = (source: Web_AddTorrentDialog_AddTorrentDialog_BuildInput_Source, multiple: Web_AddTorrentDialog_AddTorrentDialog_BuildInput_Multiple) => Web_AddTorrentDialog_AddTorrentDialog_BuildInput_Returns;
export type Web_AddTorrentDialog_AddTorrentDialog_BuildInput_ProfileId = string;
export type Web_AddTorrentDialog_AddTorrentDialog_BuildInput_Profile = Web_Api_TorrentProfile | undefined;
export type Web_AddTorrentDialog_AddTorrentDialog_BuildInput_ProfileData = Web_Api_DefaultTorrentProfile | Web_Api_TorrentProfile;
export type Web_AddTorrentDialog_AddTorrentDialog_BuildInput_Input = Web_Api_AddTorrentInput;
export type Web_AddTorrentDialog_AddTorrentDialog_BuildInput_NextLabels = string[];
export type Web_AddTorrentDialog_AddTorrentDialog_BuildInput_Metainfo = string;
export type Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_Index = number;
export type Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_Returns = Promise<void>;
export type Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource = (index: Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_Index) => Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_Returns;
export type Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_Source = Web_Components_AddTorrentSource | undefined;
export type Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_Input = Web_Api_AddTorrentInput;
export type Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_Result = Web_Api_TorrentAddResult;
export type Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_ProfileId = string;
export type Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_Profile = Web_Api_TorrentProfile | undefined;
export type Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_AddedDownloadDirectory = string;
export type Web_AddTorrentDialog_AddTorrentDialog_AddBatchSource_Detail = string;
export type Web_AddTorrentDialog_AddTorrentDialog_HandleSubmit_Event = FormEvent<HTMLFormElement>;
export type Web_AddTorrentDialog_AddTorrentDialog_HandleSubmit_Returns = Promise<void>;
export type Web_AddTorrentDialog_AddTorrentDialog_HandleSubmit = (event: Web_AddTorrentDialog_AddTorrentDialog_HandleSubmit_Event) => Web_AddTorrentDialog_AddTorrentDialog_HandleSubmit_Returns;
export type Web_AddTorrentDialog_AddTorrentDialog_HandleSubmit_Source = Web_Components_AddTorrentSource | undefined;
export type Web_AddTorrentDialog_AddTorrentDialog_HandleSubmit_Result = Web_Api_TorrentAddResult;
export type Web_AddTorrentDialog_AddTorrentDialog_HandleSubmit_ConnectionName = string;
export type Web_AddTorrentDialog_AddTorrentDialog_AllProcessed = boolean;
export type Web_AddTorrentDialog_AddTorrentDialog_BatchSummary_Detail = string;
export type Web_AddTorrentDialog_AddTorrentDialog_BatchSummary_Title = string;
export type Web_AddTorrentDialog_AddTorrentDialog_BatchSummary = {
  detail: Web_AddTorrentDialog_AddTorrentDialog_BatchSummary_Detail;
  title: Web_AddTorrentDialog_AddTorrentDialog_BatchSummary_Title;
};
export type Web_AddTorrentDialog_AddTorrentDialog_BatchResult = Web_Components_AddTorrentResult | undefined;
export type Web_AddTorrentDialog_AddTorrentDialog_DialogTitle = string;
export type Web_AddTorrentDialog_AddTorrentDialog_FileDropTitle = string | undefined;
export type Web_AddTorrentDialog_AddTorrentDialog_FirstFile = File | undefined;
export type Web_AddTorrentDialog_AddTorrentDialog_SubmitLabel = string;
export type Web_AddTorrentDialog_AddTorrentDialog_MatchedPattern = string | undefined;
export type Web_AddTorrentDialog_AddTorrentDialog_MatchedProfile = Web_Api_TorrentProfile | undefined;
export type Web_AddTorrentDialog_AddTorrentDialog_SourceResult = Web_Components_AddTorrentResult | undefined;
export type Web_AddTorrentDialog_AddTorrentDialog_AmbiguousMatch = boolean;
export type Web_AddTorrentDialog_AddTorrentDialog_SelectedProfileId = string;
export type Web_AddTorrentDialog_AddTorrentDialog_AutomaticallyMatched = boolean;
export type Web_AddTorrentDialog_AddTorrentDialog_ResultLabel = string;

/**
 * Add Torrent Dialog.
 *
 * @since 2.4.1
 */
export type Web_AddTorrentDialog_AutomaticProfileSelectionValue_Source = Web_Components_AddTorrentSource;
export type Web_AddTorrentDialog_AutomaticProfileSelectionValue_Returns = string;

/**
 * Add Torrent Dialog.
 *
 * @since 2.4.1
 */
export type Web_AddTorrentDialog_DefaultProfileSelectionValue = string;

/**
 * Add Torrent Dialog.
 *
 * @since 2.4.1
 */
export type Web_AddTorrentDialog_DuplicateNotice_Result = Web_Api_TorrentAddResult;
export type Web_AddTorrentDialog_DuplicateNotice_Returns = string;

/**
 * Add Torrent Dialog.
 *
 * @since 2.4.1
 */
export type Web_AddTorrentDialog_FileAsBase64_File = File;
export type Web_AddTorrentDialog_FileAsBase64_Returns = Promise<string>;
export type Web_AddTorrentDialog_FileAsBase64_Encoded = string;
export type Web_AddTorrentDialog_FileAsBase64_Reader = FileReader;
export type Web_AddTorrentDialog_FileAsBase64_Result = string;
export type Web_AddTorrentDialog_FileAsBase64_CommaIndex = number;

/**
 * Add Torrent Dialog.
 *
 * @since 2.4.1
 */
export type Web_AddTorrentDialog_IsTorrentFile_File = File;
export type Web_AddTorrentDialog_IsTorrentFile_Returns = boolean;

/**
 * Add Torrent Dialog.
 *
 * @since 2.4.1
 */
export type Web_AddTorrentDialog_MaximumTorrentPreviewLinks = number;

/**
 * Add Torrent Dialog.
 *
 * @since 2.4.1
 */
export type Web_AddTorrentDialog_ParseLabels_Value = string;
export type Web_AddTorrentDialog_ParseLabels_Returns = string[];

/**
 * Add Torrent Dialog.
 *
 * @since 2.4.1
 */
export type Web_AddTorrentDialog_ProfileOptionRows_Profile = Web_Api_DefaultTorrentProfile | Web_Api_TorrentProfile;
export type Web_AddTorrentDialog_ProfileOptionRows_Row = [string, string];
export type Web_AddTorrentDialog_ProfileOptionRows_Returns = Web_AddTorrentDialog_ProfileOptionRows_Row[];
export type Web_AddTorrentDialog_ProfileOptionRows_Options = Web_Api_TorrentProfileOptions;
export type Web_AddTorrentDialog_ProfileOptionRows_Limits = string[];
export type Web_AddTorrentDialog_ProfileOptionRows_PriorityLabels = Record<-1 | 0 | 1, string>;

/**
 * Add Torrent Dialog.
 *
 * @since 2.4.1
 */
export type Web_AddTorrentDialog_TorrentPreviewDebounceMilliseconds = number;
