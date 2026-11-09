import type {
  Web_AppNavigation_Items,
  Web_AppNavigation_PathMatch,
  Web_AppNavigation_Paths,
  Web_AppNavigation_Route,
} from '@/types/web/app-navigation.d.ts';
import type {
  Web_Components_View,
  Web_Components_VpnView_NavigationTarget,
} from '@/types/web/components.d.ts';

/**
 * App Navigation - Paths.
 *
 * Owns every bookmarkable console address, including the reserved dynamic VPN
 * connection segment. Shared history code consumes routes produced here.
 *
 * @since UNRELEASED
 */
export const appNavigationPaths: Web_AppNavigation_Paths = {
  account: '/account',
  notifications: '/notifications',
  remoteApps: '/remote-apps',
  root: '/',
  settings: '/settings',
  torrents: '/torrents',
  vpn: '/vpn',
  vpnConnection: '/vpn/:connection-id',
  vpnNew: '/vpn/new',
};

/**
 * App Navigation - Items.
 *
 * Defines Transmission VPN navigation separately from the shared shell and
 * helpers. Desktop keeps this full order while phones derive their four tabs.
 *
 * @since UNRELEASED
 */
export const appNavigationItems: Web_AppNavigation_Items = [
  {
    groups: [{
      id: 'torrents',
      label: 'Torrents',
      pages: [{
        id: 'torrents',
        label: 'Torrents',
      }],
    }],
    icon: 'torrent',
    id: 'torrents',
    label: 'Torrents',
  },
  {
    groups: [{
      id: 'vpn',
      label: 'VPN',
      pages: [{
        id: 'vpn',
        label: 'VPN',
      }],
    }],
    icon: 'shield',
    id: 'vpn',
    label: 'VPN',
  },
  {
    groups: [{
      id: 'access',
      label: 'Remote apps',
      pages: [{
        id: 'access',
        label: 'Remote apps',
      }],
    }],
    icon: 'key',
    id: 'access',
    label: 'Remote apps',
    shortLabel: 'Apps',
  },
  {
    description: 'Queue, network and blocklists',
    groups: [{
      id: 'settings',
      label: 'Settings',
      pages: [{
        id: 'settings',
        label: 'Settings',
      }],
    }],
    icon: 'settings',
    id: 'settings',
    label: 'Settings',
  },
  {
    description: 'Where alerts are sent',
    groups: [{
      id: 'notifications',
      label: 'Notifications',
      pages: [{
        id: 'notifications',
        label: 'Notifications',
      }],
    }],
    icon: 'bell',
    id: 'notifications',
    label: 'Notifications',
  },
];

/**
 * App Navigation - Route for view.
 *
 * Returns the canonical path used by shell navigation. The root address is a
 * valid Torrents alias, while an explicit Torrents navigation uses /torrents.
 *
 * @param {Web_Components_View} view - View.
 *
 * @returns {Web_AppNavigation_Route}
 *
 * @since UNRELEASED
 */
export const appRouteForView = (view: Web_Components_View): Web_AppNavigation_Route => {
  switch (view) {
    case 'access': {
      return {
        path: appNavigationPaths['remoteApps'],
        view,
      };
    }

    case 'notifications': {
      return {
        path: appNavigationPaths['notifications'],
        view,
      };
    }

    case 'security': {
      return {
        path: appNavigationPaths['account'],
        view,
      };
    }

    case 'settings': {
      return {
        path: appNavigationPaths['settings'],
        view,
      };
    }

    case 'vpn': {
      return {
        path: appNavigationPaths['vpn'],
        view,
        vpnTarget: { kind: 'list' },
      };
    }

    default: {
      return {
        path: appNavigationPaths['torrents'],
        view: 'torrents',
      };
    }
  }
};

/**
 * App Navigation - Route for VPN target.
 *
 * Builds the list, new-connection, or encoded connection editor address.
 * Connection identifiers remain opaque to the browser route.
 *
 * @param {Web_Components_VpnView_NavigationTarget} target - Target.
 *
 * @returns {Web_AppNavigation_Route}
 *
 * @since UNRELEASED
 */
export const appRouteForVPNTarget = (
  target: Web_Components_VpnView_NavigationTarget,
): Web_AppNavigation_Route => {
  if (target['kind'] === 'new') {
    return {
      path: appNavigationPaths['vpnNew'],
      view: 'vpn',
      vpnTarget: target,
    };
  }

  if (target['kind'] === 'connection') {
    const connectionPath: string = `${appNavigationPaths['vpn']}/${encodeURIComponent(target['connectionID'])}`;

    return {
      path: connectionPath,
      view: 'vpn',
      vpnTarget: target,
    };
  }

  return appRouteForView('vpn');
};

/**
 * App Navigation - Resolve path.
 *
 * Parses static pages and the VPN editor segment. Unknown or malformed paths
 * fall back to the first page and request a History API replacement.
 *
 * @param {string} pathname - Pathname.
 *
 * @returns {Web_AppNavigation_PathMatch}
 *
 * @since UNRELEASED
 */
export const resolveAppNavigationPath = (pathname: string): Web_AppNavigation_PathMatch => {
  if (pathname === appNavigationPaths['root']) {
    return {
      path: pathname,
      replace: false,
      route: {
        path: pathname,
        view: 'torrents',
      },
    };
  }

  if (pathname === appNavigationPaths['vpnNew']) {
    const route: Web_AppNavigation_Route = appRouteForVPNTarget({ kind: 'new' });

    return {
      path: route['path'],
      replace: false,
      route,
    };
  }

  for (const view of [
    'torrents',
    'vpn',
    'access',
    'settings',
    'notifications',
    'security',
  ] as const) {
    const route: Web_AppNavigation_Route = appRouteForView(view);
    if (pathname === route['path']) {
      return {
        path: route['path'],
        replace: false,
        route,
      };
    }
  }

  const connectionPrefix: string = `${appNavigationPaths['vpn']}/`;
  if (pathname.startsWith(connectionPrefix)) {
    const encodedConnectionID: string = pathname.slice(connectionPrefix.length);
    if (encodedConnectionID !== '' && !encodedConnectionID.includes('/')) {
      try {
        const connectionID: string = decodeURIComponent(encodedConnectionID);
        if (connectionID !== '' && connectionID !== 'new') {
          const route: Web_AppNavigation_Route = appRouteForVPNTarget({
            connectionID,
            kind: 'connection',
          });

          return {
            path: route['path'],
            replace: pathname !== route['path'],
            route,
          };
        }
      } catch {
        // Malformed percent encoding follows the same first-page fallback.
      }
    }
  }

  const route: Web_AppNavigation_Route = appRouteForView('torrents');

  return {
    path: route['path'],
    replace: true,
    route,
  };
};
