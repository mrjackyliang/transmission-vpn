import type {
  Dispatch,
  ReactElement,
  SetStateAction,
} from 'react';

import type { Web_Api_TorrentProfile } from '@/types/web/api.d.ts';
import type {
  Web_Components_LibraryNavigation_Props,
  Web_Components_TorrentFilter,
  Web_Components_TorrentFilterItem,
  Web_Components_TorrentLabelSummary,
} from '@/types/web/components.d.ts';

/**
 * Library Navigation.
 *
 * @since 2.4.1
 */
export type Web_LibraryNavigation_AlwaysVisibleFilters = Web_Components_TorrentFilter[];

/**
 * Library Navigation.
 *
 * @since 2.4.1
 */
export type Web_LibraryNavigation_LibraryNavigation_Props = Web_Components_LibraryNavigation_Props;
export type Web_LibraryNavigation_LibraryNavigation_Returns = ReactElement;
export type Web_LibraryNavigation_LibraryNavigation_DefaultProfile = Web_Components_LibraryNavigation_Props['defaultProfile'];
export type Web_LibraryNavigation_LibraryNavigation_Filters = Web_Components_LibraryNavigation_Props['filters'];
export type Web_LibraryNavigation_LibraryNavigation_OnCreateProfile = Web_Components_LibraryNavigation_Props['onCreateProfile'];
export type Web_LibraryNavigation_LibraryNavigation_OnDeleteProfile = Web_Components_LibraryNavigation_Props['onDeleteProfile'];
export type Web_LibraryNavigation_LibraryNavigation_OnEditDefaultProfile = Web_Components_LibraryNavigation_Props['onEditDefaultProfile'];
export type Web_LibraryNavigation_LibraryNavigation_OnEditProfile = Web_Components_LibraryNavigation_Props['onEditProfile'];
export type Web_LibraryNavigation_LibraryNavigation_OnFiltersChange = Web_Components_LibraryNavigation_Props['onFiltersChange'];
export type Web_LibraryNavigation_LibraryNavigation_OnManage = Web_Components_LibraryNavigation_Props['onManage'];
export type Web_LibraryNavigation_LibraryNavigation_OnSheetClose = Web_Components_LibraryNavigation_Props['onSheetClose'];
export type Web_LibraryNavigation_LibraryNavigation_Organization = Web_Components_LibraryNavigation_Props['organization'];
export type Web_LibraryNavigation_LibraryNavigation_Profiles = Web_Components_LibraryNavigation_Props['profiles'];
export type Web_LibraryNavigation_LibraryNavigation_Torrents = Web_Components_LibraryNavigation_Props['torrents'];
export type Web_LibraryNavigation_LibraryNavigation_MenuProfileId = string | null;
export type Web_LibraryNavigation_LibraryNavigation_SetMenuProfileId = Dispatch<SetStateAction<Web_LibraryNavigation_LibraryNavigation_MenuProfileId>>;
export type Web_LibraryNavigation_LibraryNavigation_MenuProfileIdState = [Web_LibraryNavigation_LibraryNavigation_MenuProfileId, Web_LibraryNavigation_LibraryNavigation_SetMenuProfileId];
export type Web_LibraryNavigation_LibraryNavigation_LibraryHeadingId = string;
export type Web_LibraryNavigation_LibraryNavigation_LabelsHeadingId = string;
export type Web_LibraryNavigation_LibraryNavigation_ProfilesHeadingId = string;
export type Web_LibraryNavigation_LibraryNavigation_StatusHeadingId = string;
export type Web_LibraryNavigation_LibraryNavigation_CloseMenuOutside_Event = PointerEvent;
export type Web_LibraryNavigation_LibraryNavigation_CloseMenuOutside_Returns = void;
export type Web_LibraryNavigation_LibraryNavigation_CloseMenuOutside = (event: Web_LibraryNavigation_LibraryNavigation_CloseMenuOutside_Event) => Web_LibraryNavigation_LibraryNavigation_CloseMenuOutside_Returns;
export type Web_LibraryNavigation_LibraryNavigation_CloseMenuOnEscape_Event = KeyboardEvent;
export type Web_LibraryNavigation_LibraryNavigation_CloseMenuOnEscape_Returns = void;
export type Web_LibraryNavigation_LibraryNavigation_CloseMenuOnEscape = (event: Web_LibraryNavigation_LibraryNavigation_CloseMenuOnEscape_Event) => Web_LibraryNavigation_LibraryNavigation_CloseMenuOnEscape_Returns;
export type Web_LibraryNavigation_LibraryNavigation_LabelSummaries = Web_Components_TorrentLabelSummary[];
export type Web_LibraryNavigation_LibraryNavigation_StatusItems = Web_Components_TorrentFilterItem[];
export type Web_LibraryNavigation_LibraryNavigation_SelectLabel_Label = string;
export type Web_LibraryNavigation_LibraryNavigation_SelectLabel_Returns = void;
export type Web_LibraryNavigation_LibraryNavigation_SelectLabel = (label: Web_LibraryNavigation_LibraryNavigation_SelectLabel_Label) => Web_LibraryNavigation_LibraryNavigation_SelectLabel_Returns;
export type Web_LibraryNavigation_LibraryNavigation_SelectProfile_ProfileId = string;
export type Web_LibraryNavigation_LibraryNavigation_SelectProfile_Returns = void;
export type Web_LibraryNavigation_LibraryNavigation_SelectProfile = (profileId: Web_LibraryNavigation_LibraryNavigation_SelectProfile_ProfileId) => Web_LibraryNavigation_LibraryNavigation_SelectProfile_Returns;
export type Web_LibraryNavigation_LibraryNavigation_MenuProfile = Web_Api_TorrentProfile | undefined;
export type Web_LibraryNavigation_LibraryNavigation_ProfileMenu = ReactElement;
