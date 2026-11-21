import type {
  Dispatch,
  FormEvent,
  ReactElement,
  SetStateAction,
} from 'react';

import type {
  Web_Api_DefaultTorrentProfile,
  Web_Api_MovedTorrent,
  Web_Api_SetTorrentProfileResponse,
  Web_Api_TorrentChanges,
  Web_Api_TorrentDetail,
  Web_Api_TorrentFile,
  Web_Api_TorrentFileStats,
  Web_Api_TorrentNeedsProfile,
  Web_Api_TorrentProfile,
  Web_Api_VpnConnection,
} from '@/types/web/api.d.ts';
import type {
  Web_Components_TorrentDetail_Props,
  Web_Components_TorrentDetail_Tab,
  Web_Components_TorrentFileDraft,
  Web_Components_TorrentFileDrafts,
  Web_Components_TorrentFileRow,
  Web_Components_TorrentOptionsDraft,
  Web_Components_TrackerIssue,
} from '@/types/web/components.d.ts';

/**
 * Torrent Detail.
 *
 * @since 2.4.1
 */
export type Web_TorrentDetail_CopyText_Value = string;
export type Web_TorrentDetail_CopyText_Returns = Promise<void>;

/**
 * Torrent Detail.
 *
 * @since 2.4.1
 */
export type Web_TorrentDetail_FileDraftsFromDetail_Files = Web_Api_TorrentFile[] | undefined;
export type Web_TorrentDetail_FileDraftsFromDetail_FileStats = Web_Api_TorrentFileStats[] | undefined;
export type Web_TorrentDetail_FileDraftsFromDetail_Returns = Web_Components_TorrentFileDrafts;
export type Web_TorrentDetail_FileDraftsFromDetail_Drafts = Web_Components_TorrentFileDrafts;
export type Web_TorrentDetail_FileDraftsFromDetail_FileCount = number;
export type Web_TorrentDetail_FileDraftsFromDetail_Statistics = Web_Api_TorrentFileStats | undefined;
export type Web_TorrentDetail_FileDraftsFromDetail_StatisticsPriority = Web_Api_TorrentFileStats['priority'] | undefined;
export type Web_TorrentDetail_FileDraftsFromDetail_StatisticsWanted = Web_Api_TorrentFileStats['wanted'] | undefined;

/**
 * Torrent Detail.
 *
 * @since 2.4.1
 */
export type Web_TorrentDetail_OptionsFromDetail_Detail = Web_Api_TorrentDetail;
export type Web_TorrentDetail_OptionsFromDetail_Returns = Web_Components_TorrentOptionsDraft;

/**
 * Torrent Detail.
 *
 * @since 2.4.1
 */
export type Web_TorrentDetail_TorrentDetail_Props = Web_Components_TorrentDetail_Props;
export type Web_TorrentDetail_TorrentDetail_Returns = ReactElement;
export type Web_TorrentDetail_TorrentDetail_Connections = Web_Components_TorrentDetail_Props['connections'];
export type Web_TorrentDetail_TorrentDetail_DefaultProfile = Web_Components_TorrentDetail_Props['defaultProfile'];
export type Web_TorrentDetail_TorrentDetail_Detail = Web_Components_TorrentDetail_Props['detail'];
export type Web_TorrentDetail_TorrentDetail_LabelPresets = Web_Components_TorrentDetail_Props['labelPresets'];
export type Web_TorrentDetail_TorrentDetail_Loading = Web_Components_TorrentDetail_Props['loading'];
export type Web_TorrentDetail_TorrentDetail_OnAction = Web_Components_TorrentDetail_Props['onAction'];
export type Web_TorrentDetail_TorrentDetail_OnClose = Web_Components_TorrentDetail_Props['onClose'];
export type Web_TorrentDetail_TorrentDetail_OnRefresh = Web_Components_TorrentDetail_Props['onRefresh'];
export type Web_TorrentDetail_TorrentDetail_OnRename = Web_Components_TorrentDetail_Props['onRename'];
export type Web_TorrentDetail_TorrentDetail_OnSetProfile = Web_Components_TorrentDetail_Props['onSetProfile'];
export type Web_TorrentDetail_TorrentDetail_OnUpdate = Web_Components_TorrentDetail_Props['onUpdate'];
export type Web_TorrentDetail_TorrentDetail_Profiles = Web_Components_TorrentDetail_Props['profiles'];
export type Web_TorrentDetail_TorrentDetail_Tab = Web_Components_TorrentDetail_Tab;
export type Web_TorrentDetail_TorrentDetail_SetTab = Dispatch<SetStateAction<Web_TorrentDetail_TorrentDetail_Tab>>;
export type Web_TorrentDetail_TorrentDetail_TabState = [Web_TorrentDetail_TorrentDetail_Tab, Web_TorrentDetail_TorrentDetail_SetTab];
export type Web_TorrentDetail_TorrentDetail_FileQuery = string;
export type Web_TorrentDetail_TorrentDetail_SetFileQuery = Dispatch<SetStateAction<Web_TorrentDetail_TorrentDetail_FileQuery>>;
export type Web_TorrentDetail_TorrentDetail_FileQueryState = [Web_TorrentDetail_TorrentDetail_FileQuery, Web_TorrentDetail_TorrentDetail_SetFileQuery];
export type Web_TorrentDetail_TorrentDetail_FileDrafts = Web_Components_TorrentFileDrafts;
export type Web_TorrentDetail_TorrentDetail_SetFileDrafts = Dispatch<SetStateAction<Web_TorrentDetail_TorrentDetail_FileDrafts>>;
export type Web_TorrentDetail_TorrentDetail_FileDraftsState = [Web_TorrentDetail_TorrentDetail_FileDrafts, Web_TorrentDetail_TorrentDetail_SetFileDrafts];
export type Web_TorrentDetail_TorrentDetail_TrackerList = string;
export type Web_TorrentDetail_TorrentDetail_SetTrackerList = Dispatch<SetStateAction<Web_TorrentDetail_TorrentDetail_TrackerList>>;
export type Web_TorrentDetail_TorrentDetail_TrackerListState = [Web_TorrentDetail_TorrentDetail_TrackerList, Web_TorrentDetail_TorrentDetail_SetTrackerList];
export type Web_TorrentDetail_TorrentDetail_Options = Web_Components_TorrentOptionsDraft | null;
export type Web_TorrentDetail_TorrentDetail_SetOptions = Dispatch<SetStateAction<Web_TorrentDetail_TorrentDetail_Options>>;
export type Web_TorrentDetail_TorrentDetail_OptionsState = [Web_TorrentDetail_TorrentDetail_Options, Web_TorrentDetail_TorrentDetail_SetOptions];
export type Web_TorrentDetail_TorrentDetail_RenameName = string;
export type Web_TorrentDetail_TorrentDetail_SetRenameName = Dispatch<SetStateAction<Web_TorrentDetail_TorrentDetail_RenameName>>;
export type Web_TorrentDetail_TorrentDetail_RenameNameState = [Web_TorrentDetail_TorrentDetail_RenameName, Web_TorrentDetail_TorrentDetail_SetRenameName];
export type Web_TorrentDetail_TorrentDetail_Busy = boolean;
export type Web_TorrentDetail_TorrentDetail_SetBusy = Dispatch<SetStateAction<Web_TorrentDetail_TorrentDetail_Busy>>;
export type Web_TorrentDetail_TorrentDetail_BusyState = [Web_TorrentDetail_TorrentDetail_Busy, Web_TorrentDetail_TorrentDetail_SetBusy];
export type Web_TorrentDetail_TorrentDetail_ProfileId = string;
export type Web_TorrentDetail_TorrentDetail_SetProfileId = Dispatch<SetStateAction<Web_TorrentDetail_TorrentDetail_ProfileId>>;
export type Web_TorrentDetail_TorrentDetail_ProfileIdState = [Web_TorrentDetail_TorrentDetail_ProfileId, Web_TorrentDetail_TorrentDetail_SetProfileId];
export type Web_TorrentDetail_TorrentDetail_ApplyProfileOptions = boolean;
export type Web_TorrentDetail_TorrentDetail_SetApplyProfileOptions = Dispatch<SetStateAction<Web_TorrentDetail_TorrentDetail_ApplyProfileOptions>>;
export type Web_TorrentDetail_TorrentDetail_ApplyProfileOptionsState = [Web_TorrentDetail_TorrentDetail_ApplyProfileOptions, Web_TorrentDetail_TorrentDetail_SetApplyProfileOptions];
export type Web_TorrentDetail_TorrentDetail_ProfileMoveResults = Web_Api_MovedTorrent[];
export type Web_TorrentDetail_TorrentDetail_SetProfileMoveResults = Dispatch<SetStateAction<Web_TorrentDetail_TorrentDetail_ProfileMoveResults>>;
export type Web_TorrentDetail_TorrentDetail_ProfileMoveResultsState = [Web_TorrentDetail_TorrentDetail_ProfileMoveResults, Web_TorrentDetail_TorrentDetail_SetProfileMoveResults];
export type Web_TorrentDetail_TorrentDetail_ResolutionOpen = boolean;
export type Web_TorrentDetail_TorrentDetail_SetResolutionOpen = Dispatch<SetStateAction<Web_TorrentDetail_TorrentDetail_ResolutionOpen>>;
export type Web_TorrentDetail_TorrentDetail_ResolutionOpenState = [Web_TorrentDetail_TorrentDetail_ResolutionOpen, Web_TorrentDetail_TorrentDetail_SetResolutionOpen];
export type Web_TorrentDetail_TorrentDetail_ResolutionResults = Web_Api_MovedTorrent[] | null;
export type Web_TorrentDetail_TorrentDetail_SetResolutionResults = Dispatch<SetStateAction<Web_TorrentDetail_TorrentDetail_ResolutionResults>>;
export type Web_TorrentDetail_TorrentDetail_ResolutionResultsState = [Web_TorrentDetail_TorrentDetail_ResolutionResults, Web_TorrentDetail_TorrentDetail_SetResolutionResults];
export type Web_TorrentDetail_TorrentDetail_ResolutionError = string;
export type Web_TorrentDetail_TorrentDetail_SetResolutionError = Dispatch<SetStateAction<Web_TorrentDetail_TorrentDetail_ResolutionError>>;
export type Web_TorrentDetail_TorrentDetail_ResolutionErrorState = [Web_TorrentDetail_TorrentDetail_ResolutionError, Web_TorrentDetail_TorrentDetail_SetResolutionError];
export type Web_TorrentDetail_TorrentDetail_DetailId = number | undefined;
export type Web_TorrentDetail_TorrentDetail_DetailProfileId = string | null | undefined;
export type Web_TorrentDetail_TorrentDetail_DetailFiles = Web_Api_TorrentFile[] | undefined;
export type Web_TorrentDetail_TorrentDetail_FilteredFiles = Web_Components_TorrentFileRow[];
export type Web_TorrentDetail_TorrentDetail_NormalizedQuery = string;
export type Web_TorrentDetail_TorrentDetail_RunMutation_Mutation = () => Promise<void>;
export type Web_TorrentDetail_TorrentDetail_RunMutation_SuccessMessage = string;
export type Web_TorrentDetail_TorrentDetail_RunMutation_Returns = Promise<void>;
export type Web_TorrentDetail_TorrentDetail_RunMutation = (mutation: Web_TorrentDetail_TorrentDetail_RunMutation_Mutation, successMessage: Web_TorrentDetail_TorrentDetail_RunMutation_SuccessMessage) => Web_TorrentDetail_TorrentDetail_RunMutation_Returns;
export type Web_TorrentDetail_TorrentDetail_SaveFiles_Returns = Promise<void>;
export type Web_TorrentDetail_TorrentDetail_SaveFiles = () => Web_TorrentDetail_TorrentDetail_SaveFiles_Returns;
export type Web_TorrentDetail_TorrentDetail_SaveFiles_FilesWanted = number[];
export type Web_TorrentDetail_TorrentDetail_SaveFiles_FilesUnwanted = number[];
export type Web_TorrentDetail_TorrentDetail_SaveFiles_PriorityHigh = number[];
export type Web_TorrentDetail_TorrentDetail_SaveFiles_PriorityLow = number[];
export type Web_TorrentDetail_TorrentDetail_SaveFiles_PriorityNormal = number[];
export type Web_TorrentDetail_TorrentDetail_SaveFiles_IndexValue = string;
export type Web_TorrentDetail_TorrentDetail_SaveFiles_Draft = Web_Components_TorrentFileDraft;
export type Web_TorrentDetail_TorrentDetail_SaveFiles_Index = number;
export type Web_TorrentDetail_TorrentDetail_SaveFiles_Changes = Web_Api_TorrentChanges;
export type Web_TorrentDetail_TorrentDetail_SaveTrackers_Returns = Promise<void>;
export type Web_TorrentDetail_TorrentDetail_SaveTrackers = () => Web_TorrentDetail_TorrentDetail_SaveTrackers_Returns;
export type Web_TorrentDetail_TorrentDetail_SaveOptions_Event = FormEvent<HTMLFormElement>;
export type Web_TorrentDetail_TorrentDetail_SaveOptions_Returns = Promise<void>;
export type Web_TorrentDetail_TorrentDetail_SaveOptions = (event: Web_TorrentDetail_TorrentDetail_SaveOptions_Event) => Web_TorrentDetail_TorrentDetail_SaveOptions_Returns;
export type Web_TorrentDetail_TorrentDetail_SaveOptions_Labels = string[];
export type Web_TorrentDetail_TorrentDetail_SaveOptions_Changes = Web_Api_TorrentChanges;
export type Web_TorrentDetail_TorrentDetail_RenameTorrent_Event = FormEvent<HTMLFormElement>;
export type Web_TorrentDetail_TorrentDetail_RenameTorrent_Returns = Promise<void>;
export type Web_TorrentDetail_TorrentDetail_RenameTorrent = (event: Web_TorrentDetail_TorrentDetail_RenameTorrent_Event) => Web_TorrentDetail_TorrentDetail_RenameTorrent_Returns;
export type Web_TorrentDetail_TorrentDetail_ApplyTorrentProfile_Returns = Promise<void>;
export type Web_TorrentDetail_TorrentDetail_ApplyTorrentProfile = () => Web_TorrentDetail_TorrentDetail_ApplyTorrentProfile_Returns;
export type Web_TorrentDetail_TorrentDetail_ApplyTorrentProfile_SelectedProfile = Web_Api_TorrentProfile | undefined;
export type Web_TorrentDetail_TorrentDetail_ApplyTorrentProfile_DefaultConnection = Web_Api_VpnConnection | undefined;
export type Web_TorrentDetail_TorrentDetail_ApplyTorrentProfile_TargetConnectionId = string | undefined;
export type Web_TorrentDetail_TorrentDetail_ApplyTorrentProfile_TargetConnection = Web_Api_VpnConnection | undefined;
export type Web_TorrentDetail_TorrentDetail_ApplyTorrentProfile_TargetConnectionName = string;
export type Web_TorrentDetail_TorrentDetail_ApplyTorrentProfile_Response = Web_Api_SetTorrentProfileResponse;
export type Web_TorrentDetail_TorrentDetail_ResolveTorrentProfile_SelectedProfileId = string | null;
export type Web_TorrentDetail_TorrentDetail_ResolveTorrentProfile_Returns = Promise<void>;
export type Web_TorrentDetail_TorrentDetail_ResolveTorrentProfile = (selectedProfileId: Web_TorrentDetail_TorrentDetail_ResolveTorrentProfile_SelectedProfileId) => Web_TorrentDetail_TorrentDetail_ResolveTorrentProfile_Returns;
export type Web_TorrentDetail_TorrentDetail_ResolveTorrentProfile_Response = Web_Api_SetTorrentProfileResponse;
export type Web_TorrentDetail_TorrentDetail_SetAllFiles_Wanted = boolean;
export type Web_TorrentDetail_TorrentDetail_SetAllFiles_Returns = void;
export type Web_TorrentDetail_TorrentDetail_SetAllFiles = (wanted: Web_TorrentDetail_TorrentDetail_SetAllFiles_Wanted) => Web_TorrentDetail_TorrentDetail_SetAllFiles_Returns;
export type Web_TorrentDetail_TorrentDetail_SetAllFiles_NextDrafts = Web_Components_TorrentFileDrafts;
export type Web_TorrentDetail_TorrentDetail_SetAllFiles_Index = string;
export type Web_TorrentDetail_TorrentDetail_SetAllFiles_Draft = Web_Components_TorrentFileDraft;
export type Web_TorrentDetail_TorrentDetail_SetAllPriorities_Priority = -1 | 0 | 1;
export type Web_TorrentDetail_TorrentDetail_SetAllPriorities_Returns = void;
export type Web_TorrentDetail_TorrentDetail_SetAllPriorities = (priority: Web_TorrentDetail_TorrentDetail_SetAllPriorities_Priority) => Web_TorrentDetail_TorrentDetail_SetAllPriorities_Returns;
export type Web_TorrentDetail_TorrentDetail_SetAllPriorities_NextDrafts = Web_Components_TorrentFileDrafts;
export type Web_TorrentDetail_TorrentDetail_SetAllPriorities_Index = string;
export type Web_TorrentDetail_TorrentDetail_SetAllPriorities_Draft = Web_Components_TorrentFileDraft;
export type Web_TorrentDetail_TorrentDetail_TabLabels = Record<Web_Components_TorrentDetail_Tab, string>;
export type Web_TorrentDetail_TorrentDetail_AssignedProfile = Web_Api_TorrentProfile | undefined;
export type Web_TorrentDetail_TorrentDetail_DetailConnectionId = string | undefined;
export type Web_TorrentDetail_TorrentDetail_DetailConnection = Web_Api_VpnConnection | undefined;
export type Web_TorrentDetail_TorrentDetail_SelectedProfile = Web_Api_TorrentProfile | undefined;
export type Web_TorrentDetail_TorrentDetail_DefaultConnection = Web_Api_VpnConnection | undefined;
export type Web_TorrentDetail_TorrentDetail_SelectedProfileData = Web_Api_DefaultTorrentProfile | Web_Api_TorrentProfile;
export type Web_TorrentDetail_TorrentDetail_SelectedProfileConnectionID = string | undefined;
export type Web_TorrentDetail_TorrentDetail_SelectedProfileConnection = Web_Api_VpnConnection | undefined;
export type Web_TorrentDetail_TorrentDetail_DetailDownloadDir = string | undefined;
export type Web_TorrentDetail_TorrentDetail_SelectedProfileChanged = boolean;
export type Web_TorrentDetail_TorrentDetail_SelectedProfileConnectionName = string;
export type Web_TorrentDetail_TorrentDetail_ProfileChangeHint = string;
export type Web_TorrentDetail_TorrentDetail_RenameAvailable = boolean;
export type Web_TorrentDetail_TorrentDetail_DetailNeedsProfile = Web_Api_TorrentNeedsProfile | null;
export type Web_TorrentDetail_TorrentDetail_ResolutionProfileIDs = string[];
export type Web_TorrentDetail_TorrentDetail_MatchingResolutionProfiles = Web_Api_TorrentProfile[];
export type Web_TorrentDetail_TorrentDetail_ResolutionAllowsAnyProfile = boolean;
export type Web_TorrentDetail_TorrentDetail_ResolutionProfiles = Web_Api_TorrentProfile[];
export type Web_TorrentDetail_TorrentDetail_DetailName = string | undefined;
export type Web_TorrentDetail_TorrentDetail_TrackerIssue = Web_Components_TrackerIssue | null;
export type Web_TorrentDetail_TorrentDetail_EtaLabel = string;
export type Web_TorrentDetail_TorrentDetail_AssignedProfileName = string;
export type Web_TorrentDetail_TorrentDetail_TabKeys = Web_Components_TorrentDetail_Tab[];
export type Web_TorrentDetail_TorrentDetail_Draft = Web_Components_TorrentFileDraft;
export type Web_TorrentDetail_TorrentDetail_Completed = number;
export type Web_TorrentDetail_TorrentDetail_Length = number;
export type Web_TorrentDetail_TorrentDetail_Progress = number;
export type Web_TorrentDetail_TorrentDetail_NextWanted = boolean;
export type Web_TorrentDetail_TorrentDetail_NextPriority = -1 | 0 | 1;
export type Web_TorrentDetail_TorrentDetail_TrackerStatus = string;
export type Web_TorrentDetail_TorrentDetail_MatchingPattern = string;
export type Web_TorrentDetail_TorrentDetail_OptionsBandwidthPriority = -1 | 0 | 1;
export type Web_TorrentDetail_TorrentDetail_OptionsSeedRatioMode = 0 | 1 | 2;
export type Web_TorrentDetail_TorrentDetail_OptionsSeedIdleMode = 0 | 1 | 2;

/**
 * Torrent Detail.
 *
 * @since 2.4.1
 */
export type Web_TorrentDetail_TrackerListFromDetail_TrackerList = string | undefined;
export type Web_TorrentDetail_TrackerListFromDetail_Trackers_Tracker = {
  announce: string;
  tier: number;
};
export type Web_TorrentDetail_TrackerListFromDetail_Trackers = Web_TorrentDetail_TrackerListFromDetail_Trackers_Tracker[] | undefined;
export type Web_TorrentDetail_TrackerListFromDetail_Returns = string;
export type Web_TorrentDetail_TrackerListFromDetail_TrackerGroups = Map<number, string[]>;
export type Web_TorrentDetail_TrackerListFromDetail_Group = string[];
