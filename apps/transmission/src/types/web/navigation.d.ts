import type {
  Web_Components_Icon_Name,
  Web_Components_View,
} from '@/types/web/components.d.ts';

/**
 * Navigation - Browser history URL.
 *
 * @since UNRELEASED
 */
export type Web_Navigation_HistoryURL = string | URL | null | undefined;

/**
 * Navigation - Browser history.
 *
 * @since UNRELEASED
 */
export type Web_Navigation_History = {
  pushState: (data: unknown, unused: string, url?: Web_Navigation_HistoryURL) => void;
  replaceState: (data: unknown, unused: string, url?: Web_Navigation_HistoryURL) => void;
};

/**
 * Navigation - Browser location.
 *
 * @since UNRELEASED
 */
export type Web_Navigation_Location = {
  pathname: string;
};

/**
 * Navigation - Pop state listener.
 *
 * @since UNRELEASED
 */
export type Web_Navigation_PopStateListener = () => void;

/**
 * Navigation - Browser.
 *
 * @since UNRELEASED
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
 * @since UNRELEASED
 */
export type Web_Navigation_PathMatch<Route> = {
  path: string;
  replace: boolean;
  route: Route;
};

/**
 * Navigation - Path resolver.
 *
 * @since UNRELEASED
 */
export type Web_Navigation_PathResolver<Route> = (pathname: string) => Web_Navigation_PathMatch<Route>;

/**
 * Navigation - Route listener.
 *
 * @since UNRELEASED
 */
export type Web_Navigation_RouteListener<Route> = (route: Route) => void;

/**
 * Navigation - Permission check.
 *
 * @since UNRELEASED
 */
export type Web_Navigation_CanOpen = (permission: string) => boolean;

/**
 * Navigation - Page.
 *
 * @since UNRELEASED
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
 * @since UNRELEASED
 */
export type Web_Navigation_Group = {
  id: string;
  label: string;
  pages: Web_Navigation_Page[];
};

/**
 * Navigation - Item.
 *
 * @since UNRELEASED
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
 * @since UNRELEASED
 */
export type Web_Navigation_Tabs = {
  more: Web_Navigation_Items;
  tabs: Web_Navigation_Items;
};

/**
 * Navigation - Sheet row.
 *
 * @since UNRELEASED
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
 * @since UNRELEASED
 */
export type Web_Navigation_SheetGroup = {
  id: string;
  label?: string;
  rows: Web_Navigation_SheetRow[];
};

/**
 * Navigation - Sheet level.
 *
 * @since UNRELEASED
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
 * @since UNRELEASED
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
