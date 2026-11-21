import type {
  Dispatch,
  FormEvent,
  ReactElement,
  RefObject,
  SetStateAction,
} from 'react';

import type {
  Web_Api_DefaultTorrentProfile,
  Web_Api_DefaultTorrentProfileInput,
  Web_Api_MovedTorrent,
  Web_Api_TorrentProfile,
  Web_Api_TorrentProfileInput,
  Web_Api_TorrentProfileOptions,
  Web_Api_TorrentProfileOverlap,
  Web_Api_VpnConnection,
} from '@/types/web/api.d.ts';
import type { Web_Components_TorrentProfileDialog_Props } from '@/types/web/components.d.ts';
import type { Web_TorrentProfileFields_TorrentProfileField } from '@/types/web/torrent-profile-fields.d.ts';

/**
 * Torrent Profile Dialog.
 *
 * @since 2.4.1
 */
export type Web_TorrentProfileDialog_ParseLabelList_Value = string;
export type Web_TorrentProfileDialog_ParseLabelList_Returns = string[];

/**
 * Torrent Profile Dialog.
 *
 * @since 2.4.1
 */
export type Web_TorrentProfileDialog_ParsePatterns_Rows = string[];
export type Web_TorrentProfileDialog_ParsePatterns_Returns = string[];

/**
 * Torrent Profile Dialog.
 *
 * @since 2.4.1
 */
export type Web_TorrentProfileDialog_TorrentProfileDialog_Props = Web_Components_TorrentProfileDialog_Props;
export type Web_TorrentProfileDialog_TorrentProfileDialog_Returns = ReactElement | null;
export type Web_TorrentProfileDialog_TorrentProfileDialog_Connections = Web_Components_TorrentProfileDialog_Props['connections'];
export type Web_TorrentProfileDialog_TorrentProfileDialog_DefaultProfile = Web_Components_TorrentProfileDialog_Props['defaultProfile'];
export type Web_TorrentProfileDialog_TorrentProfileDialog_LabelPresets = Web_Components_TorrentProfileDialog_Props['labelPresets'];
export type Web_TorrentProfileDialog_TorrentProfileDialog_Mode = Web_Components_TorrentProfileDialog_Props['mode'];
export type Web_TorrentProfileDialog_TorrentProfileDialog_OnClose = Web_Components_TorrentProfileDialog_Props['onClose'];
export type Web_TorrentProfileDialog_TorrentProfileDialog_OnSave = Web_Components_TorrentProfileDialog_Props['onSave'];
export type Web_TorrentProfileDialog_TorrentProfileDialog_Open = Web_Components_TorrentProfileDialog_Props['open'];
export type Web_TorrentProfileDialog_TorrentProfileDialog_Profile = Web_Components_TorrentProfileDialog_Props['profile'];
export type Web_TorrentProfileDialog_TorrentProfileDialog_Profiles = Web_Components_TorrentProfileDialog_Props['profiles'];
export type Web_TorrentProfileDialog_TorrentProfileDialog_NameState = [string, Dispatch<SetStateAction<string>>];
export type Web_TorrentProfileDialog_TorrentProfileDialog_Name = string;
export type Web_TorrentProfileDialog_TorrentProfileDialog_SetName = Dispatch<SetStateAction<string>>;
export type Web_TorrentProfileDialog_TorrentProfileDialog_DownloadDirectoryState = [string, Dispatch<SetStateAction<string>>];
export type Web_TorrentProfileDialog_TorrentProfileDialog_DownloadDirectory = string;
export type Web_TorrentProfileDialog_TorrentProfileDialog_SetDownloadDirectory = Dispatch<SetStateAction<string>>;
export type Web_TorrentProfileDialog_TorrentProfileDialog_LabelsState = [string, Dispatch<SetStateAction<string>>];
export type Web_TorrentProfileDialog_TorrentProfileDialog_Labels = string;
export type Web_TorrentProfileDialog_TorrentProfileDialog_SetLabels = Dispatch<SetStateAction<string>>;
export type Web_TorrentProfileDialog_TorrentProfileDialog_StartPausedState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_TorrentProfileDialog_TorrentProfileDialog_StartPaused = boolean;
export type Web_TorrentProfileDialog_TorrentProfileDialog_SetStartPaused = Dispatch<SetStateAction<boolean>>;
export type Web_TorrentProfileDialog_TorrentProfileDialog_SeedingModeState = [Web_TorrentProfileDialog_TorrentProfileDialog_SeedingMode, Dispatch<SetStateAction<Web_TorrentProfileDialog_TorrentProfileDialog_SeedingMode>>];
export type Web_TorrentProfileDialog_TorrentProfileDialog_SeedingMode = 'limit' | 'never';
export type Web_TorrentProfileDialog_TorrentProfileDialog_SetSeedingMode = Dispatch<SetStateAction<Web_TorrentProfileDialog_TorrentProfileDialog_SeedingMode>>;
export type Web_TorrentProfileDialog_TorrentProfileDialog_RatioState = [string, Dispatch<SetStateAction<string>>];
export type Web_TorrentProfileDialog_TorrentProfileDialog_Ratio = string;
export type Web_TorrentProfileDialog_TorrentProfileDialog_SetRatio = Dispatch<SetStateAction<string>>;
export type Web_TorrentProfileDialog_TorrentProfileDialog_IdleMinutesState = [string, Dispatch<SetStateAction<string>>];
export type Web_TorrentProfileDialog_TorrentProfileDialog_IdleMinutes = string;
export type Web_TorrentProfileDialog_TorrentProfileDialog_SetIdleMinutes = Dispatch<SetStateAction<string>>;
export type Web_TorrentProfileDialog_TorrentProfileDialog_DownloadLimitedState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_TorrentProfileDialog_TorrentProfileDialog_DownloadLimited = boolean;
export type Web_TorrentProfileDialog_TorrentProfileDialog_SetDownloadLimited = Dispatch<SetStateAction<boolean>>;
export type Web_TorrentProfileDialog_TorrentProfileDialog_DownloadLimitState = [string, Dispatch<SetStateAction<string>>];
export type Web_TorrentProfileDialog_TorrentProfileDialog_DownloadLimit = string;
export type Web_TorrentProfileDialog_TorrentProfileDialog_SetDownloadLimit = Dispatch<SetStateAction<string>>;
export type Web_TorrentProfileDialog_TorrentProfileDialog_UploadLimitedState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_TorrentProfileDialog_TorrentProfileDialog_UploadLimited = boolean;
export type Web_TorrentProfileDialog_TorrentProfileDialog_SetUploadLimited = Dispatch<SetStateAction<boolean>>;
export type Web_TorrentProfileDialog_TorrentProfileDialog_UploadLimitState = [string, Dispatch<SetStateAction<string>>];
export type Web_TorrentProfileDialog_TorrentProfileDialog_UploadLimit = string;
export type Web_TorrentProfileDialog_TorrentProfileDialog_SetUploadLimit = Dispatch<SetStateAction<string>>;
export type Web_TorrentProfileDialog_TorrentProfileDialog_PriorityState = [Web_TorrentProfileDialog_TorrentProfileDialog_Priority, Dispatch<SetStateAction<Web_TorrentProfileDialog_TorrentProfileDialog_Priority>>];
export type Web_TorrentProfileDialog_TorrentProfileDialog_Priority = -1 | 0 | 1;
export type Web_TorrentProfileDialog_TorrentProfileDialog_SetPriority = Dispatch<SetStateAction<Web_TorrentProfileDialog_TorrentProfileDialog_Priority>>;
export type Web_TorrentProfileDialog_TorrentProfileDialog_PeerLimitState = [string, Dispatch<SetStateAction<string>>];
export type Web_TorrentProfileDialog_TorrentProfileDialog_PeerLimit = string;
export type Web_TorrentProfileDialog_TorrentProfileDialog_SetPeerLimit = Dispatch<SetStateAction<string>>;
export type Web_TorrentProfileDialog_TorrentProfileDialog_QueueState = [Web_TorrentProfileDialog_TorrentProfileDialog_Queue, Dispatch<SetStateAction<Web_TorrentProfileDialog_TorrentProfileDialog_Queue>>];
export type Web_TorrentProfileDialog_TorrentProfileDialog_Queue = 'normal' | 'top';
export type Web_TorrentProfileDialog_TorrentProfileDialog_SetQueue = Dispatch<SetStateAction<Web_TorrentProfileDialog_TorrentProfileDialog_Queue>>;
export type Web_TorrentProfileDialog_TorrentProfileDialog_PatternsState = [string[], Dispatch<SetStateAction<string[]>>];
export type Web_TorrentProfileDialog_TorrentProfileDialog_Patterns = string[];
export type Web_TorrentProfileDialog_TorrentProfileDialog_SetPatterns = Dispatch<SetStateAction<string[]>>;
export type Web_TorrentProfileDialog_TorrentProfileDialog_PatternTryNameState = [string, Dispatch<SetStateAction<string>>];
export type Web_TorrentProfileDialog_TorrentProfileDialog_PatternTryName = string;
export type Web_TorrentProfileDialog_TorrentProfileDialog_SetPatternTryName = Dispatch<SetStateAction<string>>;
export type Web_TorrentProfileDialog_TorrentProfileDialog_PatternInputRefs = RefObject<Web_TorrentProfileDialog_TorrentProfileDialog_PatternInputs>;
export type Web_TorrentProfileDialog_TorrentProfileDialog_PatternInput = HTMLInputElement | null;
export type Web_TorrentProfileDialog_TorrentProfileDialog_PatternInputs = Web_TorrentProfileDialog_TorrentProfileDialog_PatternInput[];
export type Web_TorrentProfileDialog_TorrentProfileDialog_PendingPatternFocusRef = RefObject<Web_TorrentProfileDialog_TorrentProfileDialog_PendingPatternFocus>;
export type Web_TorrentProfileDialog_TorrentProfileDialog_PendingPatternFocus = number | null;
export type Web_TorrentProfileDialog_TorrentProfileDialog_ConnectionIdState = [string, Dispatch<SetStateAction<string>>];
export type Web_TorrentProfileDialog_TorrentProfileDialog_ConnectionId = string;
export type Web_TorrentProfileDialog_TorrentProfileDialog_SetConnectionId = Dispatch<SetStateAction<string>>;
export type Web_TorrentProfileDialog_TorrentProfileDialog_BrowserOpenState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_TorrentProfileDialog_TorrentProfileDialog_BrowserOpen = boolean;
export type Web_TorrentProfileDialog_TorrentProfileDialog_SetBrowserOpen = Dispatch<SetStateAction<boolean>>;
export type Web_TorrentProfileDialog_TorrentProfileDialog_MoveConfirmationState = [Web_TorrentProfileDialog_TorrentProfileDialog_MoveConfirmation, Dispatch<SetStateAction<Web_TorrentProfileDialog_TorrentProfileDialog_MoveConfirmation>>];
export type Web_TorrentProfileDialog_TorrentProfileDialog_MoveConfirmation_Count = number;
export type Web_TorrentProfileDialog_TorrentProfileDialog_MoveConfirmation_Input = Web_Api_DefaultTorrentProfileInput | Web_Api_TorrentProfileInput;
export type Web_TorrentProfileDialog_TorrentProfileDialog_MoveConfirmation_Message = string;
export type Web_TorrentProfileDialog_TorrentProfileDialog_MoveConfirmation = {
  count: Web_TorrentProfileDialog_TorrentProfileDialog_MoveConfirmation_Count;
  input: Web_TorrentProfileDialog_TorrentProfileDialog_MoveConfirmation_Input;
  message: Web_TorrentProfileDialog_TorrentProfileDialog_MoveConfirmation_Message;
} | null;
export type Web_TorrentProfileDialog_TorrentProfileDialog_SetMoveConfirmation = Dispatch<SetStateAction<Web_TorrentProfileDialog_TorrentProfileDialog_MoveConfirmation>>;
export type Web_TorrentProfileDialog_TorrentProfileDialog_MoveResultsState = [Web_Api_MovedTorrent[] | null, Dispatch<SetStateAction<Web_Api_MovedTorrent[] | null>>];
export type Web_TorrentProfileDialog_TorrentProfileDialog_MoveResults = Web_Api_MovedTorrent[] | null;
export type Web_TorrentProfileDialog_TorrentProfileDialog_SetMoveResults = Dispatch<SetStateAction<Web_Api_MovedTorrent[] | null>>;
export type Web_TorrentProfileDialog_TorrentProfileDialog_BusyState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_TorrentProfileDialog_TorrentProfileDialog_Busy = boolean;
export type Web_TorrentProfileDialog_TorrentProfileDialog_SetBusy = Dispatch<SetStateAction<boolean>>;
export type Web_TorrentProfileDialog_TorrentProfileDialog_SaveErrorState = [unknown, Dispatch<SetStateAction<unknown>>];
export type Web_TorrentProfileDialog_TorrentProfileDialog_SaveError = unknown;
export type Web_TorrentProfileDialog_TorrentProfileDialog_SetSaveError = Dispatch<SetStateAction<unknown>>;
export type Web_TorrentProfileDialog_TorrentProfileDialog_PendingIndex = number | null;
export type Web_TorrentProfileDialog_TorrentProfileDialog_PendingInput = HTMLInputElement | null | undefined;
export type Web_TorrentProfileDialog_TorrentProfileDialog_Source = Web_Api_DefaultTorrentProfile | Web_Api_TorrentProfile | null;
export type Web_TorrentProfileDialog_TorrentProfileDialog_Options = Web_Api_TorrentProfileOptions | undefined;
export type Web_TorrentProfileDialog_TorrentProfileDialog_RatioValue = number | null;
export type Web_TorrentProfileDialog_TorrentProfileDialog_IdleMinutesValue = number | null;
export type Web_TorrentProfileDialog_TorrentProfileDialog_DownloadLimitKBps = number | null | undefined;
export type Web_TorrentProfileDialog_TorrentProfileDialog_UploadLimitKBps = number | null | undefined;
export type Web_TorrentProfileDialog_TorrentProfileDialog_ConnectionName_TargetId = string;
export type Web_TorrentProfileDialog_TorrentProfileDialog_ConnectionName_Returns = string;
export type Web_TorrentProfileDialog_TorrentProfileDialog_ConnectionName = (targetId: Web_TorrentProfileDialog_TorrentProfileDialog_ConnectionName_TargetId) => Web_TorrentProfileDialog_TorrentProfileDialog_ConnectionName_Returns;
export type Web_TorrentProfileDialog_TorrentProfileDialog_ConnectionName_Connection = Web_Api_VpnConnection | undefined;
export type Web_TorrentProfileDialog_TorrentProfileDialog_BuildInput_Returns = Web_Api_DefaultTorrentProfileInput | Web_Api_TorrentProfileInput;
export type Web_TorrentProfileDialog_TorrentProfileDialog_BuildInput = () => Web_TorrentProfileDialog_TorrentProfileDialog_BuildInput_Returns;
export type Web_TorrentProfileDialog_TorrentProfileDialog_BuildInput_SharedInput = Web_Api_DefaultTorrentProfileInput;
export type Web_TorrentProfileDialog_TorrentProfileDialog_SaveProfile_Event = FormEvent<HTMLFormElement>;
export type Web_TorrentProfileDialog_TorrentProfileDialog_SaveProfile_Returns = Promise<void>;
export type Web_TorrentProfileDialog_TorrentProfileDialog_SaveProfile = (event: Web_TorrentProfileDialog_TorrentProfileDialog_SaveProfile_Event) => Web_TorrentProfileDialog_TorrentProfileDialog_SaveProfile_Returns;
export type Web_TorrentProfileDialog_TorrentProfileDialog_SaveProfile_Input = Web_Api_DefaultTorrentProfileInput | Web_Api_TorrentProfileInput;
export type Web_TorrentProfileDialog_TorrentProfileDialog_DefaultConnection = Web_Api_VpnConnection | undefined;
export type Web_TorrentProfileDialog_TorrentProfileDialog_DefaultConnectionName = string | undefined;
export type Web_TorrentProfileDialog_TorrentProfileDialog_NameIssue = string;
export type Web_TorrentProfileDialog_TorrentProfileDialog_FolderIssue = string;
export type Web_TorrentProfileDialog_TorrentProfileDialog_GeneralError = string;
export type Web_TorrentProfileDialog_TorrentProfileDialog_ProfilePickerId = string;
export type Web_TorrentProfileDialog_TorrentProfileDialog_Fields = Web_TorrentProfileFields_TorrentProfileField[];
export type Web_TorrentProfileDialog_TorrentProfileDialog_CurrentPatterns = string[];
export type Web_TorrentProfileDialog_TorrentProfileDialog_TrimmedTryName = string;
export type Web_TorrentProfileDialog_TorrentProfileDialog_TryMatches = string[];
export type Web_TorrentProfileDialog_TorrentProfileDialog_PatternOverlaps = Web_Api_TorrentProfileOverlap[];
export type Web_TorrentProfileDialog_TorrentProfileDialog_OverlapProfileNames = string;
export type Web_TorrentProfileDialog_TorrentProfileDialog_OverlapProfileNoun = string;
export type Web_TorrentProfileDialog_TorrentProfileDialog_MoveTorrentNoun = string;
export type Web_TorrentProfileDialog_TorrentProfileDialog_Title = string;
export type Web_TorrentProfileDialog_TorrentProfileDialog_SaveButtonLabel = string;
export type Web_TorrentProfileDialog_TorrentProfileDialog_NextPatterns = string[];
