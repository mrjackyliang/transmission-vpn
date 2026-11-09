import type {
  Web_Components_View,
  Web_Components_VpnView_NavigationTarget,
} from '@/types/web/components.d.ts';

import type {
  Web_Navigation_Items,
  Web_Navigation_PathMatch,
} from '@/types/web/navigation.d.ts';

/**
 * App Navigation.
 *
 * @since UNRELEASED
 */
export type Web_AppNavigation_Items = Web_Navigation_Items;

/**
 * App Navigation - Paths.
 *
 * @since UNRELEASED
 */
export type Web_AppNavigation_Paths = {
  account: string;
  notifications: string;
  remoteApps: string;
  root: string;
  settings: string;
  torrents: string;
  vpn: string;
  vpnConnection: string;
  vpnNew: string;
};

/**
 * App Navigation - Route.
 *
 * @since UNRELEASED
 */
export type Web_AppNavigation_Route = {
  path: string;
  view: Web_Components_View;
  vpnTarget?: Web_Components_VpnView_NavigationTarget;
};

/**
 * App Navigation - Path match.
 *
 * @since UNRELEASED
 */
export type Web_AppNavigation_PathMatch = Web_Navigation_PathMatch<Web_AppNavigation_Route>;
