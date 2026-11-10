import type { Web_Components_View } from '@/types/web/components.d.ts';
import type {
  Web_Navigation_Browser,
  Web_Navigation_CanOpen,
  Web_Navigation_Group,
  Web_Navigation_Item,
  Web_Navigation_Items,
  Web_Navigation_Page,
  Web_Navigation_PathMatch,
  Web_Navigation_PathResolver,
  Web_Navigation_PhoneTabAction,
  Web_Navigation_RouteListener,
  Web_Navigation_SheetGroup,
  Web_Navigation_SheetLevel,
  Web_Navigation_SheetRow,
  Web_Navigation_SheetStack,
  Web_Navigation_Tabs,
} from '@/types/web/navigation.d.ts';

/**
 * Navigation - Sheet ID.
 *
 * Gives every phone sheet trigger the same stable accessibility target.
 * The rendered dialog uses this value for its matching element ID.
 *
 * @since 2.0.0
 */
export const PHONE_NAV_SHEET_ID = 'phone-navigation-sheet';

/**
 * Navigation - Phone tab limit.
 *
 * The fourth and final target becomes More whenever destinations overflow.
 * The helper and shell share this value so their target counts cannot drift.
 *
 * @since 2.0.0
 */
export const PHONE_TABS = 4;

/**
 * Navigation - Apply path.
 *
 * Resolves the browser's current address, normalizes an unknown path with a
 * replacement, and publishes the route without adding a history entry.
 * Apps supply their own path table while sharing this browser behavior.
 *
 * @param {Web_Navigation_Browser}              browser - Browser.
 * @param {Web_Navigation_PathResolver<Route>}  resolve - Resolve.
 * @param {Web_Navigation_RouteListener<Route>} onRoute - On route.
 *
 * @returns {Route}
 *
 * @since 2.0.0
 */
export const applyNavigationPath = <Route>(
  browser: Web_Navigation_Browser,
  resolve: Web_Navigation_PathResolver<Route>,
  onRoute: Web_Navigation_RouteListener<Route>,
): Route => {
  const match: Web_Navigation_PathMatch<Route> = resolve(browser['location']['pathname']);

  if (match['replace']) {
    browser['history'].replaceState(null, '', match['path']);
  }

  onRoute(match['route']);

  return match['route'];
};

/**
 * Navigation - Push path.
 *
 * Adds a real browser history entry only when the destination differs from the
 * current address. Route state remains app-owned and is applied by the caller.
 *
 * @param {Web_Navigation_Browser} browser - Browser.
 * @param {string}                 path    - Path.
 *
 * @since 2.0.0
 */
export const pushNavigationPath = (
  browser: Web_Navigation_Browser,
  path: string,
): void => {
  if (browser['location']['pathname'] === path) {
    return;
  }

  browser['history'].pushState(null, '', path);

  return;
};

/**
 * Navigation - Replace path.
 *
 * Changes the current browser entry without creating a new Back destination.
 * Sign-out and invalid dynamic destinations use this transition.
 *
 * @param {Web_Navigation_Browser} browser - Browser.
 * @param {string}                 path    - Path.
 *
 * @since 2.0.0
 */
export const replaceNavigationPath = (
  browser: Web_Navigation_Browser,
  path: string,
): void => {
  browser['history'].replaceState(null, '', path);

  return;
};

/**
 * Navigation - Start history.
 *
 * Applies the initial path and restores app route state for every browser
 * Back or Forward event. The returned cleanup removes only this listener.
 *
 * @param {Web_Navigation_Browser}              browser - Browser.
 * @param {Web_Navigation_PathResolver<Route>}  resolve - Resolve.
 * @param {Web_Navigation_RouteListener<Route>} onRoute - On route.
 *
 * @returns {() => void}
 *
 * @since 2.0.0
 */
export const startNavigationHistory = <Route>(
  browser: Web_Navigation_Browser,
  resolve: Web_Navigation_PathResolver<Route>,
  onRoute: Web_Navigation_RouteListener<Route>,
): (() => void) => {
  /**
   * Navigation - Handle pop state.
   *
   * Resolves the address reached by browser history navigation.
   * Back and Forward therefore share the initial path application behavior.
   *
   * @since 2.0.0
   */
  const handlePopState = (): void => {
    applyNavigationPath(browser, resolve, onRoute);

    return;
  };

  browser.addEventListener('popstate', handlePopState);
  applyNavigationPath(browser, resolve, onRoute);

  return (): void => {
    browser.removeEventListener('popstate', handlePopState);

    return;
  };
};

/**
 * Navigation - Page views.
 *
 * Includes editor and detail views that belong to a parent destination.
 * Current-state checks use the same complete view list on every surface.
 *
 * @param {Web_Navigation_Page} page - Page.
 *
 * @returns {Web_Components_View[]}
 *
 * @since 2.0.0
 */
export const navigationPageViews = (page: Web_Navigation_Page): Web_Components_View[] => [
  page['id'],
  ...(page['activeViews'] ?? []),
];

/**
 * Navigation - Visible items.
 *
 * Applies item and page permissions once for every desktop and phone surface.
 * Empty groups and items are removed without mutating the configured data.
 *
 * @param {Web_Navigation_Items}   items   - Items.
 * @param {Web_Navigation_CanOpen} canOpen - Can open.
 *
 * @returns {Web_Navigation_Items}
 *
 * @since 2.0.0
 */
export const visibleNavigationItems = (
  items: Web_Navigation_Items,
  canOpen: Web_Navigation_CanOpen,
): Web_Navigation_Items => items.flatMap((item: Web_Navigation_Item): Web_Navigation_Items => {
  if (item['permission'] !== undefined && !canOpen(item['permission'])) {
    return [];
  }

  const groups: Web_Navigation_Group[] = item['groups'].flatMap(
    (group: Web_Navigation_Group): Web_Navigation_Group[] => {
      const pages: Web_Navigation_Page[] = group['pages'].filter(
        (page: Web_Navigation_Page): boolean => page['permission'] === undefined || canOpen(page['permission']),
      );

      return (pages.length === 0) ? [] : [{
        ...group,
        pages,
      }];
    },
  );

  return (groups.length === 0) ? [] : [{
    ...item,
    groups,
  }];
});

/**
 * Navigation - Item pages.
 *
 * Flattens an item's configured groups while preserving their page order.
 * First-page, current-state, sheet, and chip helpers reuse this sequence.
 *
 * @param {Web_Navigation_Item} item - Item.
 *
 * @returns {Web_Navigation_Page[]}
 *
 * @since 2.0.0
 */
export const navigationItemPages = (item: Web_Navigation_Item): Web_Navigation_Page[] => item['groups'].flatMap(
  (group: Web_Navigation_Group): Web_Navigation_Page[] => group['pages'],
);

/**
 * Navigation - First view.
 *
 * Selects the first already-authorized page represented by an item.
 * Visibility filtering happens before this helper reaches grouped navigation.
 *
 * @param {Web_Navigation_Item} item - Item.
 *
 * @returns {Web_Components_View}
 *
 * @since 2.0.0
 */
export const firstNavigationView = (item: Web_Navigation_Item): Web_Components_View => {
  const firstPage: Web_Navigation_Page | undefined = navigationItemPages(item).at(0);

  if (firstPage === undefined) {
    throw new Error('A navigation item needs at least one visible page.');
  }

  return firstPage['id'];
};

/**
 * Navigation - Find group.
 *
 * Finds the group containing the active page for the optional phone chip row.
 * Declared child views resolve to the same group as their primary page.
 *
 * @param {Web_Navigation_Items} items - Items.
 * @param {Web_Components_View}  view  - View.
 *
 * @returns {Web_Navigation_Group | undefined}
 *
 * @since 2.0.0
 */
export const findNavigationGroup = (
  items: Web_Navigation_Items,
  view: Web_Components_View,
): Web_Navigation_Group | undefined => {
  for (const item of items) {
    const group: Web_Navigation_Group | undefined = item['groups'].find(
      (candidate: Web_Navigation_Group): boolean => candidate['pages'].some(
        (page: Web_Navigation_Page): boolean => navigationPageViews(page).includes(view),
      ),
    );

    if (group !== undefined) {
      return group;
    }
  }

  return undefined;
};

/**
 * Navigation - Item has sheet.
 *
 * Limits tab-owned sheets to explicit groups of pages.
 * Ordinary destinations always navigate directly.
 *
 * @param {Web_Navigation_Item} item - Item.
 *
 * @returns {boolean}
 *
 * @since 2.0.0
 */
export const navigationItemHasSheet = (item: Web_Navigation_Item): boolean => (
  item['isGroup'] === true
);

/**
 * Navigation - Item holds view.
 *
 * Marks a parent current for its primary pages and declared child views.
 * Desktop items, group tabs, and More all share this comparison.
 *
 * @param {Web_Navigation_Item} item - Item.
 * @param {Web_Components_View} view - View.
 *
 * @returns {boolean}
 *
 * @since 2.0.0
 */
export const navigationItemHoldsView = (
  item: Web_Navigation_Item,
  view: Web_Components_View,
): boolean => navigationItemPages(item).some(
  (page: Web_Navigation_Page): boolean => navigationPageViews(page).includes(view),
);

/**
 * Navigation - Phone label.
 *
 * Uses compact copy only in the constrained bottom bar.
 * Sidebar, sheet, chip, and page labels keep their full wording.
 *
 * @param {Web_Navigation_Item} item - Item.
 *
 * @returns {string}
 *
 * @since 2.0.0
 */
export const phoneNavigationLabel = (item: Web_Navigation_Item): string => item['shortLabel'] ?? item['label'];

/**
 * Navigation - Phone tabs.
 *
 * Returns at most four targets: either four direct tabs, or three plus More.
 * Both returned lists preserve the source sidebar order without mutation.
 *
 * @param {Web_Navigation_Items} items - Items.
 *
 * @returns {Web_Navigation_Tabs}
 *
 * @since 2.0.0
 */
export const phoneTabs = (items: Web_Navigation_Items): Web_Navigation_Tabs => {
  if (items.length <= PHONE_TABS) {
    return {
      more: [],
      tabs: [...items],
    };
  }

  return {
    more: items.slice(PHONE_TABS - 1),
    tabs: items.slice(0, PHONE_TABS - 1),
  };
};

/**
 * Navigation - Sheet level.
 *
 * Converts a grouped navigation item into selectable page rows.
 * Nested More destinations carry their parent title for the Back action.
 *
 * @param {Web_Navigation_Item} item          - Item.
 * @param {string}              [parentTitle] - Parent title.
 *
 * @returns {Web_Navigation_SheetLevel}
 *
 * @since 2.0.0
 */
export const createNavSheetLevel = (
  item: Web_Navigation_Item,
  parentTitle?: string,
): Web_Navigation_SheetLevel => {
  const groups: Web_Navigation_SheetGroup[] = item['groups'].map(
    (group: Web_Navigation_Group): Web_Navigation_SheetGroup => {
      const rows: Web_Navigation_SheetRow[] = group['pages'].map(
        (page: Web_Navigation_Page): Web_Navigation_SheetRow => ({
          ...((page['count'] === undefined) ? {} : { count: page['count'] }),
          ...((page['description'] === undefined) ? {} : { description: page['description'] }),
          id: `${group['id']}-${page['id']}`,
          icon: page['icon'] ?? item['icon'],
          label: page['label'],
          view: page['id'],
          views: navigationPageViews(page),
        }),
      );
      const showGroupLabel: boolean = item['groups'].length > 1 && group['label'] !== item['label'];

      return {
        ...((showGroupLabel) ? { label: group['label'] } : {}),
        id: group['id'],
        rows,
      };
    },
  );

  return {
    groups,
    id: item['id'],
    ...((parentTitle === undefined) ? {} : { parentTitle }),
    title: item['label'],
  };
};

/**
 * Navigation - Phone tab action.
 *
 * Opens group sheets immediately while plain tabs navigate or scroll their
 * already-open page to the top. Open group sheets toggle closed on reselect.
 *
 * @param {Web_Navigation_Item} item          - Item.
 * @param {Web_Components_View} activeView    - Active view.
 * @param {string}              [openSheetId] - Open sheet id.
 *
 * @returns {Web_Navigation_PhoneTabAction}
 *
 * @since 2.0.0
 */
export const phoneTabAction = (
  item: Web_Navigation_Item,
  activeView: Web_Components_View,
  openSheetId?: string,
): Web_Navigation_PhoneTabAction => {
  if (navigationItemHasSheet(item)) {
    if (openSheetId === item['id']) {
      return { kind: 'close-sheet' };
    }

    return {
      kind: 'open-sheet',
      level: createNavSheetLevel(item),
    };
  }

  if (navigationItemHoldsView(item, activeView)) {
    return { kind: 'scroll-top' };
  }

  return {
    kind: 'navigate',
    view: firstNavigationView(item),
  };
};

/**
 * Navigation - More sheet level.
 *
 * Lists overflow destinations directly and nests items with their own sheet.
 * Short app-authored descriptions remain attached to their corresponding row.
 *
 * @param {Web_Navigation_Items} items - Items.
 *
 * @returns {Web_Navigation_SheetLevel}
 *
 * @since 2.0.0
 */
export const createMoreNavSheetLevel = (items: Web_Navigation_Items): Web_Navigation_SheetLevel => {
  const rows: Web_Navigation_SheetRow[] = items.map(
    (item: Web_Navigation_Item): Web_Navigation_SheetRow => {
      const pages: Web_Navigation_Page[] = navigationItemPages(item);
      const views: Web_Components_View[] = pages.flatMap(navigationPageViews);

      if (navigationItemHasSheet(item)) {
        return {
          count: pages.length,
          ...((item['description'] === undefined) ? {} : { description: item['description'] }),
          id: item['id'],
          icon: item['icon'],
          label: item['label'],
          level: createNavSheetLevel(item, 'More'),
          views,
        };
      }

      const firstPage: Web_Navigation_Page | undefined = pages.at(0);
      const description: string | undefined = item['description'] ?? firstPage?.['description'];

      return {
        ...((description === undefined) ? {} : { description }),
        id: item['id'],
        icon: item['icon'],
        label: item['label'],
        view: firstNavigationView(item),
        views,
      };
    },
  );

  return {
    groups: [{
      id: 'more',
      rows,
    }],
    id: 'more',
    title: 'More',
  };
};

/**
 * Navigation - Open sheet stack.
 *
 * Starts a fresh stack at the selected tab or More level.
 * Reopening never retains a nested destination from an earlier visit.
 *
 * @param {Web_Navigation_SheetLevel} level - Level.
 *
 * @returns {Web_Navigation_SheetStack}
 *
 * @since 2.0.0
 */
export const openNavSheetStack = (level: Web_Navigation_SheetLevel): Web_Navigation_SheetStack => [level];

/**
 * Navigation - Push sheet stack.
 *
 * Adds a child sheet without mutating the existing level sequence.
 * More uses this transition for grouped or custom overflow destinations.
 *
 * @param {Web_Navigation_SheetStack} stack - Stack.
 * @param {Web_Navigation_SheetLevel} level - Level.
 *
 * @returns {Web_Navigation_SheetStack}
 *
 * @since 2.0.0
 */
export const pushNavSheetStack = (
  stack: Web_Navigation_SheetStack,
  level: Web_Navigation_SheetLevel,
): Web_Navigation_SheetStack => [
  ...stack,
  level,
];

/**
 * Navigation - Pop sheet stack.
 *
 * Returns to the parent while keeping the root sheet open.
 * A root-only stack is returned unchanged because it has no Back action.
 *
 * @param {Web_Navigation_SheetStack} stack - Stack.
 *
 * @returns {Web_Navigation_SheetStack}
 *
 * @since 2.0.0
 */
export const popNavSheetStack = (stack: Web_Navigation_SheetStack): Web_Navigation_SheetStack => (
  (stack.length <= 1) ? stack : stack.slice(0, -1)
);

/**
 * Navigation - Close sheet stack.
 *
 * Clears every level after navigation, Escape, scrim, or tab dismissal.
 * The next open therefore always begins at its selected root.
 *
 * @returns {Web_Navigation_SheetStack}
 *
 * @since 2.0.0
 */
export const closeNavSheetStack = (): Web_Navigation_SheetStack => [];
