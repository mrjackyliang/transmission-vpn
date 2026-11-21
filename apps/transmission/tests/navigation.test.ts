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
  Tests_Web_Navigation_CanOpen,
  Tests_Web_Navigation_CanOpen_Permission,
  Tests_Web_Navigation_CanOpen_Returns,
  Tests_Web_Navigation_CreateHistoryBrowser_Entries,
  Tests_Web_Navigation_CreateHistoryBrowser_InitialPath,
  Tests_Web_Navigation_CreateHistoryBrowser_Listeners,
  Tests_Web_Navigation_CreateHistoryBrowser_Move,
  Tests_Web_Navigation_CreateHistoryBrowser_Move_Direction,
  Tests_Web_Navigation_CreateHistoryBrowser_Move_NextPath,
  Tests_Web_Navigation_CreateHistoryBrowser_Move_NextPosition,
  Tests_Web_Navigation_CreateHistoryBrowser_Move_Returns,
  Tests_Web_Navigation_CreateHistoryBrowser_NextPath,
  Tests_Web_Navigation_CreateHistoryBrowser_Returns,
  Tests_Web_Navigation_HistoryFixture,
  Tests_Web_Navigation_HistoryPosition,
  Tests_Web_Navigation_MoreGroup,
  Tests_Web_Navigation_PathFromHistoryUrl_CurrentPath,
  Tests_Web_Navigation_PathFromHistoryUrl_Returns,
  Tests_Web_Navigation_PathFromHistoryUrl_Url,
  Tests_Web_Navigation_RememberRoute,
  Tests_Web_Navigation_RememberRoute_Returns,
  Tests_Web_Navigation_RememberRoute_Route,
  Tests_Web_Navigation_RouteState,
  Tests_Web_Navigation_Stop,
  Tests_Web_Navigation_TorrentsItem,
  Tests_Web_Navigation_VisibleGroup,
  Tests_Web_Navigation_VisibleRowLabels,
  Tests_Web_Navigation_VisibleSheetGroup,
} from '../src/types/tests/web/navigation.test.d.ts';
import type { Web_AppNavigation_Route } from '../src/types/web/app-navigation.d.ts';
import type {
  Web_Navigation_Browser,
  Web_Navigation_Item,
  Web_Navigation_Items,
  Web_Navigation_Location,
  Web_Navigation_SheetLevel,
  Web_Navigation_SheetStack,
  Web_Navigation_Tabs,
} from '../src/types/web/navigation.d.ts';

/**
 * Navigation - Path From History URL.
 *
 * @param {Tests_Web_Navigation_PathFromHistoryUrl_Url}         url         - Url.
 * @param {Tests_Web_Navigation_PathFromHistoryUrl_CurrentPath} currentPath - Current path.
 *
 * @returns {Tests_Web_Navigation_PathFromHistoryUrl_Returns}
 *
 * @since 2.0.0
 */
const pathFromHistoryURL = (
  url: Tests_Web_Navigation_PathFromHistoryUrl_Url,
  currentPath: Tests_Web_Navigation_PathFromHistoryUrl_CurrentPath,
): Tests_Web_Navigation_PathFromHistoryUrl_Returns => {
  if (url === undefined || url === null) {
    return currentPath;
  }

  if (url instanceof URL) {
    return url.pathname;
  }

  return new URL(url, 'http://navigation.test').pathname;
};

/**
 * Navigation - Create History Browser.
 *
 * @param {Tests_Web_Navigation_CreateHistoryBrowser_InitialPath} initialPath - Initial path.
 *
 * @returns {Tests_Web_Navigation_CreateHistoryBrowser_Returns}
 *
 * @since 2.0.0
 */
const createHistoryBrowser = (initialPath: Tests_Web_Navigation_CreateHistoryBrowser_InitialPath): Tests_Web_Navigation_CreateHistoryBrowser_Returns => {
  const entries: Tests_Web_Navigation_CreateHistoryBrowser_Entries = [initialPath];
  const position: Tests_Web_Navigation_HistoryPosition = { value: 0 };
  const listeners: Tests_Web_Navigation_CreateHistoryBrowser_Listeners = new Set();
  const location: Web_Navigation_Location = { pathname: initialPath };

  /**
   * Navigation - Move.
   *
   * @param {Tests_Web_Navigation_CreateHistoryBrowser_Move_Direction} direction - Direction.
   *
   * @returns {Tests_Web_Navigation_CreateHistoryBrowser_Move_Returns}
   *
   * @since 2.0.0
   */
  const move: Tests_Web_Navigation_CreateHistoryBrowser_Move = (direction: Tests_Web_Navigation_CreateHistoryBrowser_Move_Direction): Tests_Web_Navigation_CreateHistoryBrowser_Move_Returns => {
    const nextPosition: Tests_Web_Navigation_CreateHistoryBrowser_Move_NextPosition = position['value'] + direction;

    if (nextPosition < 0 || nextPosition >= entries.length) {
      return;
    }

    const nextPath: Tests_Web_Navigation_CreateHistoryBrowser_Move_NextPath = entries.at(nextPosition);

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
    addEventListener: (_type, listener) => {
      listeners.add(listener);

      return;
    },
    history: {
      pushState: (_data, _unused, url) => {
        const nextPath: Tests_Web_Navigation_CreateHistoryBrowser_NextPath = pathFromHistoryURL(url, location['pathname']);

        entries.splice(position['value'] + 1);

        entries.push(nextPath);

        position.value = entries.length - 1;
        location.pathname = nextPath;

        return;
      },
      replaceState: (_data, _unused, url) => {
        const nextPath: Tests_Web_Navigation_CreateHistoryBrowser_NextPath = pathFromHistoryURL(url, location['pathname']);

        entries.splice(position['value'], 1, nextPath);

        location.pathname = nextPath;

        return;
      },
    },
    location,
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);

      return;
    },
  };

  return {
    back: () => move(-1),
    browser,
    entries,
    forward: () => move(1),
  };
};

describe('console navigation', () => {
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

  it('keeps four phone targets and puts Settings and Notifications in More', () => {
    const tabs: Web_Navigation_Tabs = phoneTabs(appNavigationItems);

    expect(PHONE_TABS).toBe(4);

    expect(tabs['tabs'].map((item) => item['id'])).toEqual([
      'torrents',
      'vpn',
      'access',
    ]);

    expect(tabs['more'].map((item) => item['id'])).toEqual([
      'settings',
      'notifications',
    ]);

    expect(tabs['tabs'].length + 1).toBeLessThanOrEqual(PHONE_TABS);

    const moreLevel: Web_Navigation_SheetLevel = createMoreNavSheetLevel(tabs['more']);
    const moreGroup: Tests_Web_Navigation_MoreGroup = moreLevel['groups'].at(0);

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

    return;
  });

  it('keeps the desktop order and uses the short Remote apps label only in the phone bar', () => {
    expect(appNavigationItems.map((item) => item['label'])).toEqual([
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

    return;
  });

  it('keeps Torrents as a plain tab without custom sheet configuration', () => {
    const torrentsItem: Tests_Web_Navigation_TorrentsItem = appNavigationItems.at(0);

    if (torrentsItem === undefined) {
      throw new Error('Torrents navigation is required.');
    }

    expect(navigationItemHasSheet(torrentsItem)).toBe(false);

    expect(Object.hasOwn(torrentsItem, 'sheet')).toBe(false);

    expect(phoneTabAction(torrentsItem, 'torrents')).toEqual({ kind: 'scroll-top' });

    return;
  });

  it('opens a group sheet on the first tap with only pages the role can use', () => {
    const canOpen: Tests_Web_Navigation_CanOpen = (permission: Tests_Web_Navigation_CanOpen_Permission): Tests_Web_Navigation_CanOpen_Returns => permission === 'notifications:write';
    const visibleItems: Web_Navigation_Items = visibleNavigationItems([groupedItem], canOpen);
    const visibleGroup: Tests_Web_Navigation_VisibleGroup = visibleItems.at(0);

    if (visibleGroup === undefined) {
      throw new Error('The Settings group needs one visible page.');
    }

    expect(firstNavigationView(visibleGroup)).toBe('notifications');

    expect(navigationItemHasSheet(visibleGroup)).toBe(true);

    const visibleSheetGroup: Tests_Web_Navigation_VisibleSheetGroup = createNavSheetLevel(visibleGroup)['groups'].at(0);
    const visibleRowLabels: Tests_Web_Navigation_VisibleRowLabels = (visibleSheetGroup !== undefined) ? visibleSheetGroup['rows'].map((row) => row['label']) : undefined;

    expect(visibleRowLabels).toEqual(['Notifications']);

    expect(phoneTabAction(visibleGroup, 'notifications')).toEqual({
      kind: 'open-sheet',
      level: createNavSheetLevel(visibleGroup),
    });

    expect(phoneTabAction(visibleGroup, 'notifications', 'settings')).toEqual({ kind: 'close-sheet' });

    return;
  });

  it('marks a parent current for its page and every declared child view', () => {
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

    return;
  });

  it('maps every console page and VPN editor through the app path table', () => {
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

    return;
  });

  it('pushes page entries and restores them with Back and Forward', () => {
    const fixture: Tests_Web_Navigation_HistoryFixture = createHistoryBrowser('/');
    const routeState: Tests_Web_Navigation_RouteState = {
      value: resolveAppNavigationPath('/')['route'],
    };
    const rememberRoute: Tests_Web_Navigation_RememberRoute = (route: Tests_Web_Navigation_RememberRoute_Route): Tests_Web_Navigation_RememberRoute_Returns => {
      routeState.value = route;

      return;
    };
    const stop: Tests_Web_Navigation_Stop = startNavigationHistory(
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

    return;
  });

  it('replaces an unknown path with the first page', () => {
    const fixture: Tests_Web_Navigation_HistoryFixture = createHistoryBrowser('/missing');
    const routeState: Tests_Web_Navigation_RouteState = {
      value: resolveAppNavigationPath('/')['route'],
    };
    const stop: Tests_Web_Navigation_Stop = startNavigationHistory(
      fixture['browser'],
      resolveAppNavigationPath,
      (route) => {
        routeState.value = route;

        return;
      },
    );

    expect(fixture['entries']).toEqual(['/torrents']);

    expect(fixture['browser']['location']['pathname']).toBe('/torrents');

    expect(routeState['value']).toEqual(appRouteForView('torrents'));

    stop();

    return;
  });

  it('restores the requested address after sign-in or first-run setup', () => {
    const fixture: Tests_Web_Navigation_HistoryFixture = createHistoryBrowser('/account');
    const routeState: Tests_Web_Navigation_RouteState = {
      value: resolveAppNavigationPath('/')['route'],
    };
    const rememberRoute: Tests_Web_Navigation_RememberRoute = (route: Tests_Web_Navigation_RememberRoute_Route): Tests_Web_Navigation_RememberRoute_Returns => {
      routeState.value = route;

      return;
    };
    const stop: Tests_Web_Navigation_Stop = startNavigationHistory(
      fixture['browser'],
      resolveAppNavigationPath,
      rememberRoute,
    );

    applyNavigationPath(fixture['browser'], resolveAppNavigationPath, rememberRoute);

    applyNavigationPath(fixture['browser'], resolveAppNavigationPath, rememberRoute);

    expect(fixture['entries']).toEqual(['/account']);

    expect(routeState['value']).toEqual(appRouteForView('security'));

    stop();

    return;
  });

  it('opens, pushes, pops, and closes the sheet stack without mutation', () => {
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

    return;
  });

  return;
});
