import {
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { appConfig } from '@/web/app-config.ts';
import { appNavigationItems } from '@/web/app-navigation.ts';
import { NavSheet } from '@/web/nav-sheet.tsx';
import {
  closeNavSheetStack,
  createMoreNavSheetLevel,
  firstNavigationView,
  navigationItemHasSheet,
  navigationItemHoldsView,
  navigationItemPages,
  openNavSheetStack,
  PHONE_NAV_SHEET_ID,
  phoneNavigationLabel,
  phoneTabAction,
  phoneTabs,
  popNavSheetStack,
  pushNavSheetStack,
  visibleNavigationItems,
} from '@/web/navigation.ts';
import {
  BrandMark,
  Icon,
} from '@/web/primitives.tsx';
import {
  applyThemePreference,
  readThemePreference,
  themeOptions,
} from '@/web/theme.ts';
import { useEscapeKey } from '@/web/use-escape-key.ts';

import type {
  ReactElement,
  ReactNode,
} from 'react';

import type {
  Web_Components_AccountMenu_Props,
  Web_Components_AppShell_Props,
  Web_Components_View,
} from '@/types/web/components.d.ts';
import type {
  Web_Navigation_Item,
  Web_Navigation_Items,
  Web_Navigation_Page,
  Web_Navigation_PhoneTabAction,
  Web_Navigation_SheetLevel,
  Web_Navigation_SheetStack,
  Web_Navigation_Tabs,
} from '@/types/web/navigation.d.ts';
import type {
  Web_Theme_Option,
  Web_Theme_Preference,
} from '@/types/web/theme.d.ts';

/**
 * App Shell - Account menu.
 *
 * Keeps appearance, account security, and sign-out actions identical at every
 * screen size while allowing an app to add a short account detail.
 *
 * @param {Web_Components_AccountMenu_Props} props - Props.
 *
 * @returns {ReactElement}
 *
 * @since 2.0.0
 */
const AccountMenu = ({
  detail,
  onLogout,
  onViewChange,
  username,
}: Web_Components_AccountMenu_Props): ReactElement => {
  const [
    open,
    setOpen,
  ] = useState<boolean>(false);
  const [
    themePreference,
    setThemePreference,
  ] = useState<Web_Theme_Preference>(readThemePreference);
  const appearanceId: string = useId();

  useEffect((): void => applyThemePreference(themePreference), [themePreference]);
  useEscapeKey((): void => setOpen(false), open);

  return (
    <div className="account">
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="account-button"
        onClick={(): void => setOpen(!open)}
        type="button"
      >
        <span aria-hidden="true" className="avatar">{username.slice(0, 1).toUpperCase()}</span>
        <span className="account-copy">
          <span>{username}</span>
          {(detail === undefined) ? null : <small>{detail}</small>}
        </span>
        <Icon name="more" size={18} />
      </button>

      {(open) ? (
        <>
          <button
            aria-label="Close menu"
            className="menu-scrim"
            onClick={(): void => setOpen(false)}
            type="button"
          />
          <div className="menu account-menu" role="menu">
            <div className="account-menu-section">
              <span id={appearanceId}>Appearance</span>
              <div aria-labelledby={appearanceId} className="segmented" role="group">
                {themeOptions.map((option: Web_Theme_Option): ReactElement => (
                  <button
                    aria-pressed={themePreference === option['id']}
                    key={option['id']}
                    onClick={(): void => setThemePreference(option['id'])}
                    type="button"
                  >
                    {option['label']}
                  </button>
                ))}
              </div>
            </div>
            <hr />
            <button
              onClick={(): void => {
                setOpen(false);
                onViewChange('security');
              }}
              role="menuitem"
              type="button"
            >
              <Icon name="key" size={16} />
              {appConfig['securityLabel']}
            </button>
            <button
              onClick={(): void => {
                setOpen(false);
                onLogout();
              }}
              role="menuitem"
              type="button"
            >
              <Icon name="logout" size={16} />
              Sign out
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
};

/**
 * App Shell.
 *
 * Renders the byte-for-byte shared desktop and phone frame around per-app
 * navigation data, status, server controls, and custom sheet content.
 *
 * @param {Web_Components_AppShell_Props} props - Props.
 *
 * @returns {ReactElement}
 *
 * @since 2.0.0
 */
export const AppShell = ({
  accountDetail,
  activeView,
  canOpen = (): boolean => true,
  children,
  notice,
  onLogout,
  onViewChange,
  phonePageTop,
  phoneSheet,
  sidebarNavigationSlot,
  sidebarTop,
  status,
  username,
}: Web_Components_AppShell_Props): ReactElement => {
  const [
    navSheetStack,
    setNavSheetStack,
  ] = useState<Web_Navigation_SheetStack>([]);
  const [
    sidebarNavigationCanScroll,
    setSidebarNavigationCanScroll,
  ] = useState<boolean>(false);
  const [
    sidebarNavigationAtEnd,
    setSidebarNavigationAtEnd,
  ] = useState<boolean>(true);
  const sidebarNavigationRef = useRef<HTMLDivElement>(null);
  const navigationItems: Web_Navigation_Items = visibleNavigationItems(appNavigationItems, canOpen);
  const phoneNavigation: Web_Navigation_Tabs = phoneTabs(navigationItems);
  const navSheetRoot: Web_Navigation_SheetLevel | undefined = navSheetStack.at(0);
  const stackedNavSheetLevel: Web_Navigation_SheetLevel | undefined = navSheetStack.at(-1);
  const phoneSheetLevel: Web_Navigation_SheetLevel | undefined = (phoneSheet === undefined) ? undefined : {
    groups: [],
    id: phoneSheet['id'],
    title: phoneSheet['title'],
  };
  const currentNavSheetLevel: Web_Navigation_SheetLevel | undefined = phoneSheetLevel ?? stackedNavSheetLevel;
  const moreCurrent: boolean = phoneNavigation['more'].some(
    (item: Web_Navigation_Item): boolean => navigationItemHoldsView(item, activeView),
  );

  useEffect((): (() => void) | undefined => {
    const navigation: HTMLDivElement | null = sidebarNavigationRef.current;
    if (sidebarNavigationSlot === undefined || navigation === null) {
      setSidebarNavigationCanScroll(false);
      setSidebarNavigationAtEnd(true);

      return undefined;
    }

    /**
     * App Shell - Update sidebar overflow cue.
     *
     * Shows the bottom fade only while more navigation content remains below
     * the viewport. A one-pixel tolerance avoids subpixel rounding flicker.
     *
     * @since 2.0.0
     */
    const updateSidebarOverflow = (): void => {
      const canScroll: boolean = navigation.scrollHeight > navigation.clientHeight + 1;
      setSidebarNavigationCanScroll(canScroll);
      setSidebarNavigationAtEnd(
        !canScroll
        || navigation.scrollTop + navigation.clientHeight >= navigation.scrollHeight - 1,
      );
    };

    const resizeObserver: ResizeObserver = new ResizeObserver(updateSidebarOverflow);
    resizeObserver.observe(navigation);
    for (const child of navigation.children) {
      resizeObserver.observe(child);
    }
    navigation.addEventListener('scroll', updateSidebarOverflow, { passive: true });
    const frameID: number = window.requestAnimationFrame(updateSidebarOverflow);

    return (): void => {
      window.cancelAnimationFrame(frameID);
      resizeObserver.disconnect();
      navigation.removeEventListener('scroll', updateSidebarOverflow);
    };
  }, [sidebarNavigationSlot]);

  /**
   * App Shell - Close phone navigation.
   *
   * Clears the complete stack for tabs, rows, chips, Escape, and the scrim.
   * A later open starts from the selected tab's root level.
   *
   * @since 2.0.0
   */
  const closePhoneNavigation = (): void => {
    setNavSheetStack(closeNavSheetStack());

    if (phoneSheet !== undefined) {
      phoneSheet.onClose();
    }
  };

  /**
   * App Shell - Change view.
   *
   * Closes any phone sheet before handing a page change back to the app.
   * Desktop links and phone controls therefore share one transition.
   *
   * @param {Web_Components_View} view - View.
   *
   * @since 2.0.0
   */
  const changeView = (view: Web_Components_View): void => {
    closePhoneNavigation();
    onViewChange(view);
  };

  /**
   * App Shell - Handle phone tab.
   *
   * Opens groups as sheets, navigates plain tabs, and scrolls current pages.
   * A second tap on an open group closes its sheet without changing pages.
   *
   * @param {Web_Navigation_Item} item - Item.
   *
   * @since 2.0.0
   */
  const handlePhoneTab = (item: Web_Navigation_Item): void => {
    const openSheetId: string | undefined = phoneSheet?.['id'] ?? navSheetRoot?.['id'];
    const action: Web_Navigation_PhoneTabAction = phoneTabAction(item, activeView, openSheetId);

    switch (action['kind']) {
      case 'close-sheet': {
        closePhoneNavigation();

        return;
      }

      case 'navigate': {
        changeView(action['view']);

        return;
      }

      case 'open-sheet': {
        closePhoneNavigation();
        setNavSheetStack(openNavSheetStack(action['level']));

        return;
      }

      case 'scroll-top': {
        closePhoneNavigation();
        window.scrollTo(0, 0);

        return;
      }

      default: {
        return;
      }
    }
  };

  /**
   * App Shell - Handle More tab.
   *
   * Opens More directly because it has no page of its own.
   * A second tap closes the same root sheet and its nested levels.
   *
   * @since 2.0.0
   */
  const handleMoreTab = (): void => {
    if (phoneSheet === undefined && navSheetRoot?.['id'] === 'more') {
      closePhoneNavigation();

      return;
    }

    closePhoneNavigation();
    setNavSheetStack(openNavSheetStack(createMoreNavSheetLevel(phoneNavigation['more'])));
  };

  /**
   * App Shell - Pop phone navigation.
   *
   * Returns a nested More destination to its parent without closing the dialog.
   * The sheet component moves focus to the newly visible heading.
   *
   * @since 2.0.0
   */
  const popPhoneNavigation = (): void => setNavSheetStack(popNavSheetStack(navSheetStack));

  /**
   * App Shell - Push phone navigation.
   *
   * Adds a grouped overflow destination inside the current sheet.
   * Its parent stays available for the shared Back action.
   *
   * @param {Web_Navigation_SheetLevel} level - Level.
   *
   * @since 2.0.0
   */
  const pushPhoneNavigation = (level: Web_Navigation_SheetLevel): void => {
    setNavSheetStack(pushNavSheetStack(navSheetStack, level));
  };

  /**
   * App Shell - Render desktop page.
   *
   * Renders a grouped page with its own icon and complete current-view set.
   * Role-filtered groups use the same pages on desktop and phones.
   *
   * @param {Web_Navigation_Item} item - Item.
   * @param {Web_Navigation_Page} page - Page.
   *
   * @returns {ReactElement}
   *
   * @since 2.0.0
   */
  const renderDesktopPage = (
    item: Web_Navigation_Item,
    page: Web_Navigation_Page,
  ): ReactElement => (
    <button
      aria-current={(navigationItemHoldsView({
        ...item,
        groups: [{
          id: page['id'],
          label: page['label'],
          pages: [page],
        }],
      }, activeView)) ? 'page' : undefined}
      className="nav-item"
      key={page['id']}
      onClick={(): void => changeView(page['id'])}
      type="button"
    >
      <Icon name={page['icon'] ?? item['icon']} size={18} />
      {page['label']}
    </button>
  );

  /**
   * App Shell - Render desktop item.
   *
   * Renders ordinary items directly and grouped items under a sidebar heading.
   * Both paths use the same app navigation data as the phone bar.
   *
   * @param {Web_Navigation_Item} item - Item.
   *
   * @returns {ReactElement}
   *
   * @since 2.0.0
   */
  const renderDesktopItem = (item: Web_Navigation_Item): ReactElement => {
    if (item['isGroup'] === true) {
      return (
        <div className="nav-group" key={item['id']}>
          <h2 className="nav-group-title">{item['label']}</h2>
          {navigationItemPages(item).map((page: Web_Navigation_Page): ReactElement => renderDesktopPage(item, page))}
        </div>
      );
    }

    return (
      <button
        aria-current={(navigationItemHoldsView(item, activeView)) ? 'page' : undefined}
        className="nav-item"
        key={item['id']}
        onClick={(): void => changeView(firstNavigationView(item))}
        type="button"
      >
        <Icon name={item['icon']} size={18} />
        {item['label']}
      </button>
    );
  };

  const customSheet: ReactNode = phoneSheet?.['content'];

  return (
    <div className="app">
      <aside className="app-sidebar">
        <div className="brand">
          <BrandMark />
          <span>{appConfig['brandName']}</span>
        </div>

        {(sidebarTop === undefined) ? null : <div className="sidebar-top-slot">{sidebarTop}</div>}

        <nav aria-label="Main" className="nav">
          {navigationItems.map(renderDesktopItem)}
        </nav>

        {(sidebarNavigationSlot === undefined) ? null : (
          <div
            className={`sidebar-navigation-slot${(sidebarNavigationCanScroll) ? ' is-scrollable' : ''}${(sidebarNavigationAtEnd) ? ' is-at-end' : ''}`}
            ref={sidebarNavigationRef}
          >
            {sidebarNavigationSlot}
          </div>
        )}

        <div className={(sidebarNavigationSlot === undefined) ? 'sidebar-footer' : 'sidebar-footer sidebar-footer-divided'}>
          {(status === undefined) ? null : (
            <button
              className={`shell-status-card status-${status['tone']}`}
              onClick={status['onOpen']}
              type="button"
            >
              <span className="status-dot" />
              <strong>{status['label']}</strong>
              <small>{status['detail']}</small>
            </button>
          )}
          <AccountMenu
            detail={accountDetail}
            onLogout={onLogout}
            onViewChange={changeView}
            username={username}
          />
        </div>
      </aside>

      <header className="mobile-header">
        <div className="brand">
          <BrandMark />
          <span>{appConfig['brandName']}</span>
        </div>
        <div className="mobile-header-end">
          {(status === undefined) ? null : (
            <button
              className={`shell-status-pill status-${status['tone']}`}
              onClick={status['onOpen']}
              type="button"
            >
              <span className="status-dot" />
              {status['label']}
            </button>
          )}
          <AccountMenu
            detail={accountDetail}
            onLogout={onLogout}
            onViewChange={changeView}
            username={username}
          />
        </div>
      </header>

      {(phonePageTop === undefined) ? null : <div className="phone-page-top">{phonePageTop}</div>}

      <main className="app-main">
        {notice}
        {children}
      </main>

      {(currentNavSheetLevel === undefined) ? null : (
        <NavSheet
          activeView={activeView}
          level={currentNavSheetLevel}
          onBack={popPhoneNavigation}
          onClose={closePhoneNavigation}
          onNavigate={changeView}
          onPush={pushPhoneNavigation}
        >
          {customSheet}
        </NavSheet>
      )}

      <nav aria-label="Main" className="tab-bar">
        {phoneNavigation['tabs'].map((item: Web_Navigation_Item): ReactElement => {
          const current: boolean = navigationItemHoldsView(item, activeView);
          const hasSheet: boolean = navigationItemHasSheet(item);
          const expanded: boolean = navSheetRoot?.['id'] === item['id'];

          return (
            <button
              aria-controls={(hasSheet) ? PHONE_NAV_SHEET_ID : undefined}
              aria-current={(current) ? 'page' : undefined}
              aria-expanded={(hasSheet) ? expanded : undefined}
              className="tab-bar-item"
              key={item['id']}
              onClick={(): void => handlePhoneTab(item)}
              type="button"
            >
              <Icon name={item['icon']} size={20} />
              <span className="tab-bar-label">{phoneNavigationLabel(item)}</span>
            </button>
          );
        })}
        {(phoneNavigation['more'].length === 0) ? null : (
          <button
            aria-controls={PHONE_NAV_SHEET_ID}
            aria-current={(moreCurrent) ? 'page' : undefined}
            aria-expanded={navSheetRoot?.['id'] === 'more'}
            className="tab-bar-item"
            onClick={handleMoreTab}
            type="button"
          >
            <Icon name="more" size={20} />
            <span className="tab-bar-label">More</span>
          </button>
        )}
      </nav>
    </div>
  );
};
