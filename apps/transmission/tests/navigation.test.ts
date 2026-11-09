import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  appNavigationItems,
  appNavigationPaths,
  appRouteForView,
  appRouteForVPNTarget,
  resolveAppNavigationPath,
} from '../src/web/app-navigation.ts';
import {
  applyNavigationPath,
  closeNavSheetStack,
  createMoreNavSheetLevel,
  createNavSheetLevel,
  firstNavigationView,
  navigationItemHasSheet,
  navigationItemHoldsView,
  openNavSheetStack,
  PHONE_TABS,
  phoneNavigationLabel,
  phoneTabAction,
  phoneTabs,
  popNavSheetStack,
  pushNavigationPath,
  pushNavSheetStack,
  startNavigationHistory,
  visibleNavigationItems,
} from '../src/web/navigation.ts';

import type {
  Tests_Web_Navigation_HistoryFixture,
  Tests_Web_Navigation_HistoryPosition,
  Tests_Web_Navigation_RouteState,
} from '../src/types/tests/web/navigation.test.d.ts';
import type { Web_AppNavigation_Route } from '../src/types/web/app-navigation.d.ts';
import type {
  Web_Navigation_Browser,
  Web_Navigation_CanOpen,
  Web_Navigation_HistoryURL,
  Web_Navigation_Item,
  Web_Navigation_Items,
  Web_Navigation_Location,
  Web_Navigation_PopStateListener,
  Web_Navigation_SheetGroup,
  Web_Navigation_SheetLevel,
  Web_Navigation_SheetStack,
  Web_Navigation_Tabs,
} from '../src/types/web/navigation.d.ts';

/**
 * Navigation Test - Path from history URL.
 *
 * @param {Web_Navigation_HistoryURL} url         - Url.
 * @param {string}                    currentPath - Current path.
 *
 * @returns {string}
 *
 * @since UNRELEASED
 */
const pathFromHistoryURL = (
  url: Web_Navigation_HistoryURL,
  currentPath: string,
): string => {
  if (url === undefined || url === null) {
    return currentPath;
  }

  if (url instanceof URL) {
    return url.pathname;
  }

  return new URL(url, 'http://navigation.test').pathname;
};

/**
 * Navigation Test - Creates history browser.
 *
 * @param {string} initialPath - Initial path.
 *
 * @returns {Tests_Web_Navigation_HistoryFixture}
 *
 * @since UNRELEASED
 */
const createHistoryBrowser = (initialPath: string): Tests_Web_Navigation_HistoryFixture => {
  const entries: string[] = [initialPath];
  const position: Tests_Web_Navigation_HistoryPosition = { value: 0 };
  const listeners: Set<Web_Navigation_PopStateListener> = new Set<Web_Navigation_PopStateListener>();
  const location: Web_Navigation_Location = { pathname: initialPath };

  /**
   * Navigation Test - Moves history.
   *
   * @param {number} direction - Direction.
   *
   * @since UNRELEASED
   */
  const move = (direction: number): void => {
    const nextPosition: number = position['value'] + direction;
    if (nextPosition < 0 || nextPosition >= entries.length) {
      return;
    }

    const nextPath: string | undefined = entries.at(nextPosition);
    if (nextPath === undefined) {
      return;
    }

    position.value = nextPosition;
    location.pathname = nextPath;
    for (const listener of listeners) {
      listener();
    }

    return;
  };

  const browser: Web_Navigation_Browser = {
    addEventListener: (_type, listener): void => {
      listeners.add(listener);

      return;
    },
    history: {
      pushState: (_data, _unused, url): void => {
        const nextPath: string = pathFromHistoryURL(url, location['pathname']);

        entries.splice(position['value'] + 1);
        entries.push(nextPath);
        position.value = entries.length - 1;
        location.pathname = nextPath;

        return;
      },
      replaceState: (_data, _unused, url): void => {
        const nextPath: string = pathFromHistoryURL(url, location['pathname']);

        entries.splice(position['value'], 1, nextPath);
        location.pathname = nextPath;

        return;
      },
    },
    location,
    removeEventListener: (_type, listener): void => {
      listeners.delete(listener);

      return;
    },
  };

  return {
    back: (): void => move(-1),
    browser,
    entries,
    forward: (): void => move(1),
  };
};

describe('console navigation', (): void => {
  const groupedItem: Web_Navigation_Item = {
    groups: [{
      id: 'settings',
      label: 'Settings',
      pages: [
        {
          id: 'settings',
          label: 'Settings',
          permission: 'settings:write',
        },
        {
          id: 'notifications',
          label: 'Notifications',
          permission: 'notifications:write',
        },
      ],
    }],
    icon: 'settings',
    id: 'settings',
    isGroup: true,
    label: 'Settings',
  };

  it('keeps four phone targets and puts Settings and Notifications in More', (): void => {
    const tabs: Web_Navigation_Tabs = phoneTabs(appNavigationItems);

    expect(PHONE_TABS).toBe(4);
    expect(tabs['tabs'].map((item: Web_Navigation_Item): string => item['id'])).toEqual([
      'torrents',
      'vpn',
      'access',
    ]);
    expect(tabs['more'].map((item: Web_Navigation_Item): string => item['id'])).toEqual([
      'settings',
      'notifications',
    ]);
    expect(tabs['tabs'].length + 1).toBeLessThanOrEqual(PHONE_TABS);

    const moreLevel: Web_Navigation_SheetLevel = createMoreNavSheetLevel(tabs['more']);
    const moreGroup: Web_Navigation_SheetGroup | undefined = moreLevel['groups'].at(0);

    if (moreGroup === undefined) {
      throw new Error('The More sheet needs a row group.');
    }

    expect(moreGroup['rows']).toMatchObject([
      {
        description: 'Queue, network and blocklists',
        label: 'Settings',
      },
      {
        description: 'Where alerts are sent',
        label: 'Notifications',
      },
    ]);
  });

  it('keeps the desktop order and uses the short Remote apps label only in the phone bar', (): void => {
    expect(appNavigationItems.map((item: Web_Navigation_Item): string => item['label'])).toEqual([
      'Torrents',
      'VPN',
      'Remote apps',
      'Settings',
      'Notifications',
    ]);
    expect(appNavigationItems.map(phoneNavigationLabel)).toEqual([
      'Torrents',
      'VPN',
      'Apps',
      'Settings',
      'Notifications',
    ]);
  });

  it('keeps Torrents as a plain tab without custom sheet configuration', (): void => {
    const torrentsItem: Web_Navigation_Item | undefined = appNavigationItems.at(0);

    if (torrentsItem === undefined) {
      throw new Error('Torrents navigation is required.');
    }

    expect(navigationItemHasSheet(torrentsItem)).toBe(false);
    expect(Object.hasOwn(torrentsItem, 'sheet')).toBe(false);
    expect(phoneTabAction(torrentsItem, 'torrents')).toEqual({ kind: 'scroll-top' });
  });

  it('opens a group sheet on the first tap with only pages the role can use', (): void => {
    const canOpen: Web_Navigation_CanOpen = (permission: string): boolean => permission === 'notifications:write';
    const visibleItems: Web_Navigation_Items = visibleNavigationItems([groupedItem], canOpen);
    const visibleGroup: Web_Navigation_Item | undefined = visibleItems.at(0);

    if (visibleGroup === undefined) {
      throw new Error('The Settings group needs one visible page.');
    }

    expect(firstNavigationView(visibleGroup)).toBe('notifications');
    expect(navigationItemHasSheet(visibleGroup)).toBe(true);
    expect(createNavSheetLevel(visibleGroup)['groups'].at(0)?.['rows'].map((row): string => row['label'])).toEqual(['Notifications']);
    expect(phoneTabAction(visibleGroup, 'notifications')).toEqual({
      kind: 'open-sheet',
      level: createNavSheetLevel(visibleGroup),
    });
    expect(phoneTabAction(visibleGroup, 'notifications', 'settings')).toEqual({ kind: 'close-sheet' });
  });

  it('marks a parent current for its page and every declared child view', (): void => {
    const item: Web_Navigation_Item = {
      groups: [{
        id: 'torrents',
        label: 'Torrents',
        pages: [{
          activeViews: ['security'],
          id: 'torrents',
          label: 'Torrents',
        }],
      }],
      icon: 'torrent',
      id: 'torrents',
      label: 'Torrents',
    };

    expect(navigationItemHoldsView(item, 'torrents')).toBe(true);
    expect(navigationItemHoldsView(item, 'security')).toBe(true);
    expect(navigationItemHoldsView(item, 'vpn')).toBe(false);
  });

  it('maps every console page and VPN editor through the app path table', (): void => {
    expect(appNavigationPaths).toEqual({
      account: '/account',
      notifications: '/notifications',
      remoteApps: '/remote-apps',
      root: '/',
      settings: '/settings',
      torrents: '/torrents',
      vpn: '/vpn',
      vpnConnection: '/vpn/:connection-id',
      vpnNew: '/vpn/new',
    });

    expect(resolveAppNavigationPath('/')['route']).toMatchObject({
      path: '/',
      view: 'torrents',
    });
    expect(resolveAppNavigationPath('/torrents')['route']).toEqual(appRouteForView('torrents'));
    expect(resolveAppNavigationPath('/vpn')['route']).toEqual(appRouteForView('vpn'));
    expect(resolveAppNavigationPath('/remote-apps')['route']).toEqual(appRouteForView('access'));
    expect(resolveAppNavigationPath('/settings')['route']).toEqual(appRouteForView('settings'));
    expect(resolveAppNavigationPath('/notifications')['route']).toEqual(appRouteForView('notifications'));
    expect(resolveAppNavigationPath('/account')['route']).toEqual(appRouteForView('security'));
    expect(resolveAppNavigationPath('/vpn/new')['route']).toEqual(appRouteForVPNTarget({ kind: 'new' }));

    const connectionRoute: Web_AppNavigation_Route = appRouteForVPNTarget({
      connectionID: 'provider/connection id',
      kind: 'connection',
    });

    expect(connectionRoute['path']).toBe('/vpn/provider%2Fconnection%20id');
    expect(resolveAppNavigationPath(connectionRoute['path'])['route']).toEqual(connectionRoute);
  });

  it('pushes page entries and restores them with Back and Forward', (): void => {
    const fixture: Tests_Web_Navigation_HistoryFixture = createHistoryBrowser('/');
    const routeState: Tests_Web_Navigation_RouteState = {
      value: resolveAppNavigationPath('/')['route'],
    };
    const rememberRoute = (route: Web_AppNavigation_Route): void => {
      routeState.value = route;

      return;
    };
    const stop: () => void = startNavigationHistory(
      fixture['browser'],
      resolveAppNavigationPath,
      rememberRoute,
    );
    const vpnRoute: Web_AppNavigation_Route = appRouteForView('vpn');

    pushNavigationPath(fixture['browser'], vpnRoute['path']);
    applyNavigationPath(fixture['browser'], resolveAppNavigationPath, rememberRoute);

    const settingsRoute: Web_AppNavigation_Route = appRouteForView('settings');

    pushNavigationPath(fixture['browser'], settingsRoute['path']);
    applyNavigationPath(fixture['browser'], resolveAppNavigationPath, rememberRoute);

    expect(fixture['entries']).toEqual([
      '/',
      '/vpn',
      '/settings',
    ]);
    expect(routeState['value']).toEqual(settingsRoute);

    fixture.back();

    expect(routeState['value']).toEqual(vpnRoute);
    expect(fixture['browser']['location']['pathname']).toBe('/vpn');

    fixture.forward();

    expect(routeState['value']).toEqual(settingsRoute);
    expect(fixture['browser']['location']['pathname']).toBe('/settings');

    stop();
  });

  it('replaces an unknown path with the first page', (): void => {
    const fixture: Tests_Web_Navigation_HistoryFixture = createHistoryBrowser('/missing');
    const routeState: Tests_Web_Navigation_RouteState = {
      value: resolveAppNavigationPath('/')['route'],
    };
    const stop: () => void = startNavigationHistory(
      fixture['browser'],
      resolveAppNavigationPath,
      (route: Web_AppNavigation_Route): void => {
        routeState.value = route;

        return;
      },
    );

    expect(fixture['entries']).toEqual(['/torrents']);
    expect(fixture['browser']['location']['pathname']).toBe('/torrents');
    expect(routeState['value']).toEqual(appRouteForView('torrents'));

    stop();
  });

  it('restores the requested address after sign-in or first-run setup', (): void => {
    const fixture: Tests_Web_Navigation_HistoryFixture = createHistoryBrowser('/account');
    const routeState: Tests_Web_Navigation_RouteState = {
      value: resolveAppNavigationPath('/')['route'],
    };
    const rememberRoute = (route: Web_AppNavigation_Route): void => {
      routeState.value = route;

      return;
    };
    const stop: () => void = startNavigationHistory(
      fixture['browser'],
      resolveAppNavigationPath,
      rememberRoute,
    );

    applyNavigationPath(fixture['browser'], resolveAppNavigationPath, rememberRoute);
    applyNavigationPath(fixture['browser'], resolveAppNavigationPath, rememberRoute);

    expect(fixture['entries']).toEqual(['/account']);
    expect(routeState['value']).toEqual(appRouteForView('security'));

    stop();
  });

  it('opens, pushes, pops, and closes the sheet stack without mutation', (): void => {
    const moreLevel: Web_Navigation_SheetLevel = createMoreNavSheetLevel([groupedItem]);
    const childLevel: Web_Navigation_SheetLevel = createNavSheetLevel(groupedItem, 'More');
    const rootStack: Web_Navigation_SheetStack = openNavSheetStack(moreLevel);
    const pushedStack: Web_Navigation_SheetStack = pushNavSheetStack(rootStack, childLevel);

    expect(rootStack).toEqual([moreLevel]);
    expect(pushedStack).toEqual([
      moreLevel,
      childLevel,
    ]);
    expect(popNavSheetStack(pushedStack)).toEqual([moreLevel]);
    expect(popNavSheetStack(rootStack)).toBe(rootStack);
    expect(closeNavSheetStack()).toEqual([]);
  });
});
