import type {
  Web_AppNavigation_AppRouteForVpnTarget_ConnectionPath,
  Web_AppNavigation_Items,
  Web_AppNavigation_PathMatch,
  Web_AppNavigation_Paths,
  Web_AppNavigation_ResolveAppNavigationPath_ConnectionId,
  Web_AppNavigation_ResolveAppNavigationPath_ConnectionPrefix,
  Web_AppNavigation_ResolveAppNavigationPath_EncodedConnectionId,
  Web_AppNavigation_ResolveAppNavigationPath_Pathname,
  Web_AppNavigation_Route,
} from '@/types/web/app-navigation.d.ts';
import type {
  Web_Components_View,
  Web_Components_VpnView_NavigationTarget,
} from '@/types/web/components.d.ts';

/**
 * App Navigation - App Navigation Paths.
 *
 * Owns every bookmarkable console address, including the reserved dynamic VPN
 * connection segment. Shared history code consumes routes produced here.
 *
 * @since 2.0.0
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
 * App Navigation - App Navigation Items.
 *
 * Defines Transmission VPN navigation separately from the shared shell and
 * helpers. Desktop keeps this full order while phones derive their four tabs.
 *
 * @since 2.0.0
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
 * App Navigation - App Route For View.
 *
 * Returns the canonical path used by shell navigation. The root address is a
 * valid Torrents alias, while an explicit Torrents navigation uses /torrents.
 *
 * @param {Web_Components_View} view - View.
 *
 * @returns {Web_AppNavigation_Route}
 *
 * @since 2.0.0
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
 * App Navigation - App Route For Vpn Target.
 *
 * Builds the list, new-connection, or encoded connection editor address.
 * Connection identifiers remain opaque to the browser route.
 *
 * @param {Web_Components_VpnView_NavigationTarget} target - Target.
 *
 * @returns {Web_AppNavigation_Route}
 *
 * @since 2.0.0
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
    const connectionPath: Web_AppNavigation_AppRouteForVpnTarget_ConnectionPath = `${appNavigationPaths['vpn']}/${encodeURIComponent(target['connectionID'])}`;

    return {
      path: connectionPath,
      view: 'vpn',
      vpnTarget: target,
    };
  }

  return appRouteForView('vpn');
};

/**
 * App Navigation - Resolve App Navigation Path.
 *
 * Parses static pages and the VPN editor segment. Unknown or malformed paths
 * fall back to the first page and request a History API replacement.
 *
 * @param {Web_AppNavigation_ResolveAppNavigationPath_Pathname} pathname - Pathname.
 *
 * @returns {Web_AppNavigation_PathMatch}
 *
 * @since 2.0.0
 */
export const resolveAppNavigationPath = (pathname: Web_AppNavigation_ResolveAppNavigationPath_Pathname): Web_AppNavigation_PathMatch => {
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

  const connectionPrefix: Web_AppNavigation_ResolveAppNavigationPath_ConnectionPrefix = `${appNavigationPaths['vpn']}/`;

  if (pathname.startsWith(connectionPrefix) === true) {
    const encodedConnectionID: Web_AppNavigation_ResolveAppNavigationPath_EncodedConnectionId = pathname.slice(connectionPrefix.length);

    if (encodedConnectionID !== '' && encodedConnectionID.includes('/') === false) {
      try {
        const connectionID: Web_AppNavigation_ResolveAppNavigationPath_ConnectionId = decodeURIComponent(encodedConnectionID);

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
