import type { Web_AppNavigation_Route } from '@/types/web/app-navigation.d.ts';
import type {
  Web_Navigation_Browser,
  Web_Navigation_HistoryURL,
  Web_Navigation_Item,
  Web_Navigation_PopStateListener,
  Web_Navigation_SheetGroup,
} from '@/types/web/navigation.d.ts';

/**
 * Navigation.
 *
 * @since 2.4.1
 */
export type Tests_Web_Navigation_CanOpen_Permission = string;

export type Tests_Web_Navigation_CanOpen_Returns = boolean;

export type Tests_Web_Navigation_CanOpen = (permission: Tests_Web_Navigation_CanOpen_Permission) => Tests_Web_Navigation_CanOpen_Returns;

/**
 * Navigation.
 *
 * @since 2.4.1
 */
export type Tests_Web_Navigation_CreateHistoryBrowser_InitialPath = string;

export type Tests_Web_Navigation_CreateHistoryBrowser_Returns = Tests_Web_Navigation_HistoryFixture;

export type Tests_Web_Navigation_CreateHistoryBrowser_Entries = string[];

export type Tests_Web_Navigation_CreateHistoryBrowser_Listeners = Set<Web_Navigation_PopStateListener>;

export type Tests_Web_Navigation_CreateHistoryBrowser_Move_Direction = number;

export type Tests_Web_Navigation_CreateHistoryBrowser_Move_Returns = void;

export type Tests_Web_Navigation_CreateHistoryBrowser_Move = (direction: Tests_Web_Navigation_CreateHistoryBrowser_Move_Direction) => Tests_Web_Navigation_CreateHistoryBrowser_Move_Returns;

export type Tests_Web_Navigation_CreateHistoryBrowser_Move_NextPosition = number;

export type Tests_Web_Navigation_CreateHistoryBrowser_Move_NextPath = string | undefined;

export type Tests_Web_Navigation_CreateHistoryBrowser_NextPath = string;

/**
 * Navigation.
 *
 * @since 2.0.0
 */
export type Tests_Web_Navigation_HistoryFixture = {
  back: () => void;
  browser: Web_Navigation_Browser;
  entries: string[];
  forward: () => void;
};

/**
 * Navigation.
 *
 * @since 2.0.0
 */
export type Tests_Web_Navigation_HistoryPosition = {
  value: number;
};

/**
 * Navigation.
 *
 * @since 2.4.1
 */
export type Tests_Web_Navigation_MoreGroup = Web_Navigation_SheetGroup | undefined;

/**
 * Navigation.
 *
 * @since 2.4.1
 */
export type Tests_Web_Navigation_PathFromHistoryUrl_Url = Web_Navigation_HistoryURL;

export type Tests_Web_Navigation_PathFromHistoryUrl_CurrentPath = string;

export type Tests_Web_Navigation_PathFromHistoryUrl_Returns = string;

/**
 * Navigation.
 *
 * @since 2.4.1
 */
export type Tests_Web_Navigation_RememberRoute_Route = Web_AppNavigation_Route;

export type Tests_Web_Navigation_RememberRoute_Returns = void;

export type Tests_Web_Navigation_RememberRoute = (route: Tests_Web_Navigation_RememberRoute_Route) => Tests_Web_Navigation_RememberRoute_Returns;

/**
 * Navigation.
 *
 * @since 2.0.0
 */
export type Tests_Web_Navigation_RouteState = {
  value: Web_AppNavigation_Route;
};

/**
 * Navigation.
 *
 * @since 2.4.1
 */
export type Tests_Web_Navigation_Stop = () => void;

/**
 * Navigation.
 *
 * @since 2.4.1
 */
export type Tests_Web_Navigation_TorrentsItem = Web_Navigation_Item | undefined;

/**
 * Navigation.
 *
 * @since 2.4.1
 */
export type Tests_Web_Navigation_VisibleGroup = Web_Navigation_Item | undefined;

/**
 * Navigation.
 *
 * @since 2.4.1
 */
export type Tests_Web_Navigation_VisibleRowLabels = string[] | undefined;

/**
 * Navigation.
 *
 * @since 2.4.1
 */
export type Tests_Web_Navigation_VisibleSheetGroup = Web_Navigation_SheetGroup | undefined;
