import type {
  Web_Components_Icon_Name,
  Web_Components_View,
} from '@/types/web/components.d.ts';

/**
 * Navigation - Browser history URL.
 *
 * @since 2.0.0
 */
export type Web_Navigation_HistoryURL = string | URL | null | undefined;

/**
 * Navigation - Browser history.
 *
 * @since 2.0.0
 */
export type Web_Navigation_History = {
  pushState: (data: unknown, unused: string, url?: Web_Navigation_HistoryURL) => void;
  replaceState: (data: unknown, unused: string, url?: Web_Navigation_HistoryURL) => void;
};

/**
 * Navigation - Browser location.
 *
 * @since 2.0.0
 */
export type Web_Navigation_Location = {
  pathname: string;
};

/**
 * Navigation - Pop state listener.
 *
 * @since 2.0.0
 */
export type Web_Navigation_PopStateListener = () => void;

/**
 * Navigation - Browser.
 *
 * @since 2.0.0
 */
export type Web_Navigation_Browser = {
  addEventListener: (type: 'popstate', listener: Web_Navigation_PopStateListener) => void;
  history: Web_Navigation_History;
  location: Web_Navigation_Location;
  removeEventListener: (type: 'popstate', listener: Web_Navigation_PopStateListener) => void;
};

/**
 * Navigation - Path match.
 *
 * @since 2.0.0
 */
export type Web_Navigation_PathMatch<Route> = {
  path: string;
  replace: boolean;
  route: Route;
};

/**
 * Navigation - Path resolver.
 *
 * @since 2.0.0
 */
export type Web_Navigation_PathResolver<Route> = (pathname: string) => Web_Navigation_PathMatch<Route>;

/**
 * Navigation - Route listener.
 *
 * @since 2.0.0
 */
export type Web_Navigation_RouteListener<Route> = (route: Route) => void;

/**
 * Navigation - Permission check.
 *
 * @since 2.0.0
 */
export type Web_Navigation_CanOpen = (permission: string) => boolean;

/**
 * Navigation - Page.
 *
 * @since 2.0.0
 */
export type Web_Navigation_Page = {
  activeViews?: Web_Components_View[];
  count?: number;
  description?: string;
  icon?: Web_Components_Icon_Name;
  id: Web_Components_View;
  label: string;
  permission?: string;
};

/**
 * Navigation - Group.
 *
 * @since 2.0.0
 */
export type Web_Navigation_Group = {
  id: string;
  label: string;
  pages: Web_Navigation_Page[];
};

/**
 * Navigation - Item.
 *
 * @since 2.0.0
 */
export type Web_Navigation_Item = {
  description?: string;
  groups: Web_Navigation_Group[];
  icon: Web_Components_Icon_Name;
  id: string;
  isGroup?: boolean;
  label: string;
  permission?: string;
  shortLabel?: string;
};

export type Web_Navigation_Items = Web_Navigation_Item[];

/**
 * Navigation - Phone tabs.
 *
 * @since 2.0.0
 */
export type Web_Navigation_Tabs = {
  more: Web_Navigation_Items;
  tabs: Web_Navigation_Items;
};

/**
 * Navigation - Sheet row.
 *
 * @since 2.0.0
 */
export type Web_Navigation_SheetRow = {
  count?: number;
  description?: string;
  id: string;
  icon: Web_Components_Icon_Name;
  label: string;
  level?: Web_Navigation_SheetLevel;
  view?: Web_Components_View;
  views: Web_Components_View[];
};

/**
 * Navigation - Sheet group.
 *
 * @since 2.0.0
 */
export type Web_Navigation_SheetGroup = {
  id: string;
  label?: string;
  rows: Web_Navigation_SheetRow[];
};

/**
 * Navigation - Sheet level.
 *
 * @since 2.0.0
 */
export type Web_Navigation_SheetLevel = {
  groups: Web_Navigation_SheetGroup[];
  id: string;
  parentTitle?: string;
  title: string;
};

export type Web_Navigation_SheetStack = Web_Navigation_SheetLevel[];

/**
 * Navigation - Phone tab action.
 *
 * @since 2.0.0
 */
export type Web_Navigation_PhoneTabAction =
  | {
    kind: 'close-sheet';
  }
  | {
    kind: 'navigate';
    view: Web_Components_View;
  }
  | {
    kind: 'open-sheet';
    level: Web_Navigation_SheetLevel;
  }
  | {
    kind: 'scroll-top';
  };

/**
 * Navigation.
 *
 * @since 2.4.1
 */
export type Web_Navigation_CloseNavSheetStack_Returns = Web_Navigation_SheetLevel[];

/**
 * Navigation.
 *
 * @since 2.4.1
 */
export type Web_Navigation_CreateMoreNavSheetLevel_Rows = Web_Navigation_SheetRow[];
export type Web_Navigation_CreateMoreNavSheetLevel_Pages = Web_Navigation_Page[];
export type Web_Navigation_CreateMoreNavSheetLevel_Views = Web_Components_View[];
export type Web_Navigation_CreateMoreNavSheetLevel_FirstPage = Web_Navigation_Page | undefined;
export type Web_Navigation_CreateMoreNavSheetLevel_Description = string | undefined;

/**
 * Navigation.
 *
 * @since 2.4.1
 */
export type Web_Navigation_CreateNavSheetLevel_ParentTitle = string;
export type Web_Navigation_CreateNavSheetLevel_Groups = Web_Navigation_SheetGroup[];
export type Web_Navigation_CreateNavSheetLevel_Rows = Web_Navigation_SheetRow[];
export type Web_Navigation_CreateNavSheetLevel_ShowGroupLabel = boolean;

/**
 * Navigation.
 *
 * @since 2.4.1
 */
export type Web_Navigation_FindNavigationGroup_Returns = Web_Navigation_Group | undefined;
export type Web_Navigation_FindNavigationGroup_Group = Web_Navigation_Group | undefined;

/**
 * Navigation.
 *
 * @since 2.4.1
 */
export type Web_Navigation_FirstNavigationView_FirstPage = Web_Navigation_Page | undefined;

/**
 * Navigation.
 *
 * @since 2.4.1
 */
export type Web_Navigation_NavigationItemHasSheet_Returns = boolean;

/**
 * Navigation.
 *
 * @since 2.4.1
 */
export type Web_Navigation_NavigationItemHoldsView_Returns = boolean;

/**
 * Navigation.
 *
 * @since 2.4.1
 */
export type Web_Navigation_NavigationItemPages_Returns = Web_Navigation_Page[];

/**
 * Navigation.
 *
 * @since 2.4.1
 */
export type Web_Navigation_NavigationPageViews_Returns = Web_Components_View[];

/**
 * Navigation.
 *
 * @since 2.4.1
 */
export type Web_Navigation_PhoneNavigationLabel_Returns = string;

/**
 * Navigation.
 *
 * @since 2.4.1
 */
export type Web_Navigation_PhoneTabAction_OpenSheetId = string;

/**
 * Navigation.
 *
 * @since 2.4.1
 */
export type Web_Navigation_PushNavigationPath_Path = string;
export type Web_Navigation_PushNavigationPath_Returns = void;

/**
 * Navigation.
 *
 * @since 2.4.1
 */
export type Web_Navigation_ReplaceNavigationPath_Path = string;
export type Web_Navigation_ReplaceNavigationPath_Returns = void;

/**
 * Navigation.
 *
 * @since 2.4.1
 */
export type Web_Navigation_StartNavigationHistory_Returns = () => void;
export type Web_Navigation_StartNavigationHistory_HandlePopState_Returns = void;
export type Web_Navigation_StartNavigationHistory_HandlePopState = () => Web_Navigation_StartNavigationHistory_HandlePopState_Returns;

/**
 * Navigation.
 *
 * @since 2.4.1
 */
export type Web_Navigation_VisibleNavigationItems_Groups = Web_Navigation_Group[];
export type Web_Navigation_VisibleNavigationItems_Pages = Web_Navigation_Page[];
