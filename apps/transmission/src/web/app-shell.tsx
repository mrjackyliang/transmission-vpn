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

import type { ReactElement } from 'react';

import type {
  Web_AppShell_AccountMenu_AppearanceId,
  Web_AppShell_AccountMenu_Detail,
  Web_AppShell_AccountMenu_OnLogout,
  Web_AppShell_AccountMenu_OnViewChange,
  Web_AppShell_AccountMenu_Open,
  Web_AppShell_AccountMenu_OpenState,
  Web_AppShell_AccountMenu_Props,
  Web_AppShell_AccountMenu_Returns,
  Web_AppShell_AccountMenu_SetOpen,
  Web_AppShell_AccountMenu_SetThemePreference,
  Web_AppShell_AccountMenu_ThemePreference,
  Web_AppShell_AccountMenu_ThemePreferenceState,
  Web_AppShell_AccountMenu_Username,
  Web_AppShell_AppShell_AccountDetail,
  Web_AppShell_AppShell_ActiveView,
  Web_AppShell_AppShell_CanOpen,
  Web_AppShell_AppShell_ChangeView,
  Web_AppShell_AppShell_ChangeView_Returns,
  Web_AppShell_AppShell_ChangeView_View,
  Web_AppShell_AppShell_Children,
  Web_AppShell_AppShell_ClosePhoneNavigation,
  Web_AppShell_AppShell_ClosePhoneNavigation_Returns,
  Web_AppShell_AppShell_Current,
  Web_AppShell_AppShell_CurrentNavSheetLevel,
  Web_AppShell_AppShell_CustomSheet,
  Web_AppShell_AppShell_Expanded,
  Web_AppShell_AppShell_FrameId,
  Web_AppShell_AppShell_HandleMoreTab,
  Web_AppShell_AppShell_HandleMoreTab_Returns,
  Web_AppShell_AppShell_HandlePhoneTab,
  Web_AppShell_AppShell_HandlePhoneTab_Action,
  Web_AppShell_AppShell_HandlePhoneTab_Item,
  Web_AppShell_AppShell_HandlePhoneTab_NavSheetRootId,
  Web_AppShell_AppShell_HandlePhoneTab_OpenSheetId,
  Web_AppShell_AppShell_HandlePhoneTab_PhoneSheetId,
  Web_AppShell_AppShell_HandlePhoneTab_Returns,
  Web_AppShell_AppShell_HasSheet,
  Web_AppShell_AppShell_MoreCurrent,
  Web_AppShell_AppShell_Navigation,
  Web_AppShell_AppShell_NavigationItems,
  Web_AppShell_AppShell_NavSheetRoot,
  Web_AppShell_AppShell_NavSheetStack,
  Web_AppShell_AppShell_NavSheetStackState,
  Web_AppShell_AppShell_Notice,
  Web_AppShell_AppShell_OnLogout,
  Web_AppShell_AppShell_OnViewChange,
  Web_AppShell_AppShell_PhoneNavigation,
  Web_AppShell_AppShell_PhonePageTop,
  Web_AppShell_AppShell_PhoneSheet,
  Web_AppShell_AppShell_PhoneSheetLevel,
  Web_AppShell_AppShell_PopPhoneNavigation,
  Web_AppShell_AppShell_PopPhoneNavigation_Returns,
  Web_AppShell_AppShell_Props,
  Web_AppShell_AppShell_PushPhoneNavigation,
  Web_AppShell_AppShell_PushPhoneNavigation_Level,
  Web_AppShell_AppShell_PushPhoneNavigation_Returns,
  Web_AppShell_AppShell_RenderDesktopItem,
  Web_AppShell_AppShell_RenderDesktopItem_Item,
  Web_AppShell_AppShell_RenderDesktopItem_Returns,
  Web_AppShell_AppShell_RenderDesktopPage,
  Web_AppShell_AppShell_RenderDesktopPage_Item,
  Web_AppShell_AppShell_RenderDesktopPage_Page,
  Web_AppShell_AppShell_RenderDesktopPage_Returns,
  Web_AppShell_AppShell_ResizeObserver,
  Web_AppShell_AppShell_Returns,
  Web_AppShell_AppShell_SetNavSheetStack,
  Web_AppShell_AppShell_SetSidebarNavigationAtEnd,
  Web_AppShell_AppShell_SetSidebarNavigationCanScroll,
  Web_AppShell_AppShell_SidebarNavigationAtEnd,
  Web_AppShell_AppShell_SidebarNavigationAtEndClassName,
  Web_AppShell_AppShell_SidebarNavigationAtEndState,
  Web_AppShell_AppShell_SidebarNavigationCanScroll,
  Web_AppShell_AppShell_SidebarNavigationCanScrollState,
  Web_AppShell_AppShell_SidebarNavigationRef,
  Web_AppShell_AppShell_SidebarNavigationRefValue,
  Web_AppShell_AppShell_SidebarNavigationScrollableClassName,
  Web_AppShell_AppShell_SidebarNavigationSlot,
  Web_AppShell_AppShell_SidebarTop,
  Web_AppShell_AppShell_StackedNavSheetLevel,
  Web_AppShell_AppShell_Status,
  Web_AppShell_AppShell_UpdateSidebarOverflow,
  Web_AppShell_AppShell_UpdateSidebarOverflow_CanScroll,
  Web_AppShell_AppShell_UpdateSidebarOverflow_Returns,
  Web_AppShell_AppShell_Username,
} from '@/types/web/app-shell.d.ts';
import type {
  Web_Navigation_Item,
  Web_Navigation_Page,
} from '@/types/web/navigation.d.ts';
import type { Web_Theme_Option } from '@/types/web/theme.d.ts';

/**
 * App Shell - Account Menu.
 *
 * Keeps appearance, account security, and sign-out actions identical at every
 * screen size while allowing an app to add a short account detail.
 *
 * @param {Web_AppShell_AccountMenu_Props} props - Props.
 *
 * @returns {Web_AppShell_AccountMenu_Returns}
 *
 * @since 2.0.0
 */
const AccountMenu = (props: Web_AppShell_AccountMenu_Props): Web_AppShell_AccountMenu_Returns => {
  const detail: Web_AppShell_AccountMenu_Detail = props['detail'];
  const onLogout: Web_AppShell_AccountMenu_OnLogout = props['onLogout'];
  const onViewChange: Web_AppShell_AccountMenu_OnViewChange = props['onViewChange'];
  const username: Web_AppShell_AccountMenu_Username = props['username'];
  const openState: Web_AppShell_AccountMenu_OpenState = useState<Web_AppShell_AccountMenu_Open>(false);
  const open: Web_AppShell_AccountMenu_Open = openState[0];
  const setOpen: Web_AppShell_AccountMenu_SetOpen = openState[1];
  const themePreferenceState: Web_AppShell_AccountMenu_ThemePreferenceState = useState<Web_AppShell_AccountMenu_ThemePreference>(readThemePreference);
  const themePreference: Web_AppShell_AccountMenu_ThemePreference = themePreferenceState[0];
  const setThemePreference: Web_AppShell_AccountMenu_SetThemePreference = themePreferenceState[1];
  const appearanceId: Web_AppShell_AccountMenu_AppearanceId = useId();

  useEffect(() => applyThemePreference(themePreference), [themePreference]);
  useEscapeKey(() => setOpen(false), open);

  return (
    <div className="account">
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="account-button"
        onClick={() => setOpen(open === false)}
        type="button"
      >
        <span aria-hidden="true" className="avatar">{username.slice(0, 1).toUpperCase()}</span>
        <span className="account-copy">
          <span>{username}</span>
          {(detail === undefined) ? null : <small>{detail}</small>}
        </span>
        <Icon name="more" size={18} />
      </button>

      {(open === true) ? (
        <>
          <button
            aria-label="Close menu"
            className="menu-scrim"
            onClick={() => setOpen(false)}
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
                    onClick={() => setThemePreference(option['id'])}
                    type="button"
                  >
                    {option['label']}
                  </button>
                ))}
              </div>
            </div>
            <hr />
            <button
              onClick={() => {
                setOpen(false);
                onViewChange('security');

                return;
              }}
              role="menuitem"
              type="button"
            >
              <Icon name="key" size={16} />
              {appConfig['securityLabel']}
            </button>
            <button
              onClick={() => {
                setOpen(false);
                onLogout();

                return;
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
 * App Shell - App Shell.
 *
 * Renders the byte-for-byte shared desktop and phone frame around per-app
 * navigation data, status, server controls, and custom sheet content.
 *
 * @param {Web_AppShell_AppShell_Props} props - Props.
 *
 * @returns {Web_AppShell_AppShell_Returns}
 *
 * @since 2.0.0
 */
export const AppShell = (props: Web_AppShell_AppShell_Props): Web_AppShell_AppShell_Returns => {
  const accountDetail: Web_AppShell_AppShell_AccountDetail = props['accountDetail'];
  const activeView: Web_AppShell_AppShell_ActiveView = props['activeView'];
  const canOpen: Web_AppShell_AppShell_CanOpen = props['canOpen'] ?? (() => true);
  const children: Web_AppShell_AppShell_Children = props['children'];
  const notice: Web_AppShell_AppShell_Notice = props['notice'];
  const onLogout: Web_AppShell_AppShell_OnLogout = props['onLogout'];
  const onViewChange: Web_AppShell_AppShell_OnViewChange = props['onViewChange'];
  const phonePageTop: Web_AppShell_AppShell_PhonePageTop = props['phonePageTop'];
  const phoneSheet: Web_AppShell_AppShell_PhoneSheet = props['phoneSheet'];
  const sidebarNavigationSlot: Web_AppShell_AppShell_SidebarNavigationSlot = props['sidebarNavigationSlot'];
  const sidebarTop: Web_AppShell_AppShell_SidebarTop = props['sidebarTop'];
  const status: Web_AppShell_AppShell_Status = props['status'];
  const username: Web_AppShell_AppShell_Username = props['username'];
  const navSheetStackState: Web_AppShell_AppShell_NavSheetStackState = useState<Web_AppShell_AppShell_NavSheetStack>([]);
  const navSheetStack: Web_AppShell_AppShell_NavSheetStack = navSheetStackState[0];
  const setNavSheetStack: Web_AppShell_AppShell_SetNavSheetStack = navSheetStackState[1];
  const sidebarNavigationCanScrollState: Web_AppShell_AppShell_SidebarNavigationCanScrollState = useState<Web_AppShell_AppShell_SidebarNavigationCanScroll>(false);
  const sidebarNavigationCanScroll: Web_AppShell_AppShell_SidebarNavigationCanScroll = sidebarNavigationCanScrollState[0];
  const setSidebarNavigationCanScroll: Web_AppShell_AppShell_SetSidebarNavigationCanScroll = sidebarNavigationCanScrollState[1];
  const sidebarNavigationAtEndState: Web_AppShell_AppShell_SidebarNavigationAtEndState = useState<Web_AppShell_AppShell_SidebarNavigationAtEnd>(true);
  const sidebarNavigationAtEnd: Web_AppShell_AppShell_SidebarNavigationAtEnd = sidebarNavigationAtEndState[0];
  const setSidebarNavigationAtEnd: Web_AppShell_AppShell_SetSidebarNavigationAtEnd = sidebarNavigationAtEndState[1];
  const sidebarNavigationRef: Web_AppShell_AppShell_SidebarNavigationRef = useRef<Web_AppShell_AppShell_SidebarNavigationRefValue>(null);
  const navigationItems: Web_AppShell_AppShell_NavigationItems = visibleNavigationItems(appNavigationItems, canOpen);
  const phoneNavigation: Web_AppShell_AppShell_PhoneNavigation = phoneTabs(navigationItems);
  const navSheetRoot: Web_AppShell_AppShell_NavSheetRoot = navSheetStack.at(0);
  const stackedNavSheetLevel: Web_AppShell_AppShell_StackedNavSheetLevel = navSheetStack.at(-1);
  const phoneSheetLevel: Web_AppShell_AppShell_PhoneSheetLevel = (phoneSheet === undefined) ? undefined : {
    groups: [],
    id: phoneSheet['id'],
    title: phoneSheet['title'],
  };
  const currentNavSheetLevel: Web_AppShell_AppShell_CurrentNavSheetLevel = phoneSheetLevel ?? stackedNavSheetLevel;
  const moreCurrent: Web_AppShell_AppShell_MoreCurrent = phoneNavigation['more'].some(
    (item) => navigationItemHoldsView(item, activeView),
  );

  useEffect(() => {
    const navigation: Web_AppShell_AppShell_Navigation = sidebarNavigationRef.current;

    if (sidebarNavigationSlot === undefined || navigation === null) {
      setSidebarNavigationCanScroll(false);
      setSidebarNavigationAtEnd(true);

      return undefined;
    }

    /**
     * App Shell - Update Sidebar Overflow.
     *
     * Shows the bottom fade only while more navigation content remains below
     * the viewport. A one-pixel tolerance avoids subpixel rounding flicker.
     *
     * @returns {Web_AppShell_AppShell_UpdateSidebarOverflow_Returns}
     *
     * @since 2.0.0
     */
    const updateSidebarOverflow: Web_AppShell_AppShell_UpdateSidebarOverflow = (): Web_AppShell_AppShell_UpdateSidebarOverflow_Returns => {
      const canScroll: Web_AppShell_AppShell_UpdateSidebarOverflow_CanScroll = navigation.scrollHeight > navigation.clientHeight + 1;

      setSidebarNavigationCanScroll(canScroll);
      setSidebarNavigationAtEnd(
        canScroll === false
        || navigation.scrollTop + navigation.clientHeight >= navigation.scrollHeight - 1,
      );

      return;
    };

    const resizeObserver: Web_AppShell_AppShell_ResizeObserver = new ResizeObserver(updateSidebarOverflow);

    resizeObserver.observe(navigation);

    for (const child of navigation.children) {
      resizeObserver.observe(child);
    }

    navigation.addEventListener('scroll', updateSidebarOverflow, { passive: true });

    const frameID: Web_AppShell_AppShell_FrameId = window.requestAnimationFrame(updateSidebarOverflow);

    return () => {
      window.cancelAnimationFrame(frameID);

      resizeObserver.disconnect();

      navigation.removeEventListener('scroll', updateSidebarOverflow);

      return;
    };
  }, [sidebarNavigationSlot]);

  /**
   * App Shell - Close Phone Navigation.
   *
   * Clears the complete stack for tabs, rows, chips, Escape, and the scrim.
   * A later open starts from the selected tab's root level.
   *
   * @returns {Web_AppShell_AppShell_ClosePhoneNavigation_Returns}
   *
   * @since 2.0.0
   */
  const closePhoneNavigation: Web_AppShell_AppShell_ClosePhoneNavigation = (): Web_AppShell_AppShell_ClosePhoneNavigation_Returns => {
    setNavSheetStack(closeNavSheetStack());

    if (phoneSheet !== undefined) {
      phoneSheet.onClose();
    }

    return;
  };

  /**
   * App Shell - Change View.
   *
   * Closes any phone sheet before handing a page change back to the app.
   * Desktop links and phone controls therefore share one transition.
   *
   * @param {Web_AppShell_AppShell_ChangeView_View} view - View.
   *
   * @returns {Web_AppShell_AppShell_ChangeView_Returns}
   *
   * @since 2.0.0
   */
  const changeView: Web_AppShell_AppShell_ChangeView = (view: Web_AppShell_AppShell_ChangeView_View): Web_AppShell_AppShell_ChangeView_Returns => {
    closePhoneNavigation();
    onViewChange(view);

    return;
  };

  /**
   * App Shell - Handle Phone Tab.
   *
   * Opens groups as sheets, navigates plain tabs, and scrolls current pages.
   * A second tap on an open group closes its sheet without changing pages.
   *
   * @param {Web_AppShell_AppShell_HandlePhoneTab_Item} item - Item.
   *
   * @returns {Web_AppShell_AppShell_HandlePhoneTab_Returns}
   *
   * @since 2.0.0
   */
  const handlePhoneTab: Web_AppShell_AppShell_HandlePhoneTab = (item: Web_AppShell_AppShell_HandlePhoneTab_Item): Web_AppShell_AppShell_HandlePhoneTab_Returns => {
    const phoneSheetId: Web_AppShell_AppShell_HandlePhoneTab_PhoneSheetId = (phoneSheet === undefined) ? undefined : phoneSheet['id'];
    const navSheetRootId: Web_AppShell_AppShell_HandlePhoneTab_NavSheetRootId = (navSheetRoot === undefined) ? undefined : navSheetRoot['id'];
    const openSheetId: Web_AppShell_AppShell_HandlePhoneTab_OpenSheetId = phoneSheetId ?? navSheetRootId;
    const action: Web_AppShell_AppShell_HandlePhoneTab_Action = phoneTabAction(item, activeView, openSheetId);

    switch (action['kind']) {
      case 'close-sheet': {
        closePhoneNavigation();

        break;
      }

      case 'navigate': {
        changeView(action['view']);

        break;
      }

      case 'open-sheet': {
        closePhoneNavigation();
        setNavSheetStack(openNavSheetStack(action['level']));

        break;
      }

      case 'scroll-top': {
        closePhoneNavigation();

        window.scrollTo(0, 0);

        break;
      }

      default: {
        break;
      }
    }

    return;
  };

  /**
   * App Shell - Handle More Tab.
   *
   * Opens More directly because it has no page of its own.
   * A second tap closes the same root sheet and its nested levels.
   *
   * @returns {Web_AppShell_AppShell_HandleMoreTab_Returns}
   *
   * @since 2.0.0
   */
  const handleMoreTab: Web_AppShell_AppShell_HandleMoreTab = (): Web_AppShell_AppShell_HandleMoreTab_Returns => {
    if (
      phoneSheet === undefined
      && navSheetRoot !== undefined
      && navSheetRoot['id'] === 'more'
    ) {
      closePhoneNavigation();

      return;
    }

    closePhoneNavigation();
    setNavSheetStack(openNavSheetStack(createMoreNavSheetLevel(phoneNavigation['more'])));

    return;
  };

  /**
   * App Shell - Pop Phone Navigation.
   *
   * Returns a nested More destination to its parent without closing the dialog.
   * The sheet component moves focus to the newly visible heading.
   *
   * @returns {Web_AppShell_AppShell_PopPhoneNavigation_Returns}
   *
   * @since 2.0.0
   */
  const popPhoneNavigation: Web_AppShell_AppShell_PopPhoneNavigation = (): Web_AppShell_AppShell_PopPhoneNavigation_Returns => setNavSheetStack(popNavSheetStack(navSheetStack));

  /**
   * App Shell - Push Phone Navigation.
   *
   * Adds a grouped overflow destination inside the current sheet.
   * Its parent stays available for the shared Back action.
   *
   * @param {Web_AppShell_AppShell_PushPhoneNavigation_Level} level - Level.
   *
   * @returns {Web_AppShell_AppShell_PushPhoneNavigation_Returns}
   *
   * @since 2.0.0
   */
  const pushPhoneNavigation: Web_AppShell_AppShell_PushPhoneNavigation = (level: Web_AppShell_AppShell_PushPhoneNavigation_Level): Web_AppShell_AppShell_PushPhoneNavigation_Returns => {
    setNavSheetStack(pushNavSheetStack(navSheetStack, level));

    return;
  };

  /**
   * App Shell - Render Desktop Page.
   *
   * Renders a grouped page with its own icon and complete current-view set.
   * Role-filtered groups use the same pages on desktop and phones.
   *
   * @param {Web_AppShell_AppShell_RenderDesktopPage_Item} item - Item.
   * @param {Web_AppShell_AppShell_RenderDesktopPage_Page} page - Page.
   *
   * @returns {Web_AppShell_AppShell_RenderDesktopPage_Returns}
   *
   * @since 2.0.0
   */
  const renderDesktopPage: Web_AppShell_AppShell_RenderDesktopPage = (
    item: Web_AppShell_AppShell_RenderDesktopPage_Item,
    page: Web_AppShell_AppShell_RenderDesktopPage_Page,
  ): Web_AppShell_AppShell_RenderDesktopPage_Returns => (
    <button
      aria-current={(navigationItemHoldsView({
        ...item,
        groups: [{
          id: page['id'],
          label: page['label'],
          pages: [page],
        }],
      }, activeView) === true) ? 'page' : undefined}
      className="nav-item"
      key={page['id']}
      onClick={() => changeView(page['id'])}
      type="button"
    >
      <Icon name={page['icon'] ?? item['icon']} size={18} />
      {page['label']}
    </button>
  );

  /**
   * App Shell - Render Desktop Item.
   *
   * Renders ordinary items directly and grouped items under a sidebar heading.
   * Both paths use the same app navigation data as the phone bar.
   *
   * @param {Web_AppShell_AppShell_RenderDesktopItem_Item} item - Item.
   *
   * @returns {Web_AppShell_AppShell_RenderDesktopItem_Returns}
   *
   * @since 2.0.0
   */
  const renderDesktopItem: Web_AppShell_AppShell_RenderDesktopItem = (item: Web_AppShell_AppShell_RenderDesktopItem_Item): Web_AppShell_AppShell_RenderDesktopItem_Returns => {
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
        aria-current={(navigationItemHoldsView(item, activeView) === true) ? 'page' : undefined}
        className="nav-item"
        key={item['id']}
        onClick={() => changeView(firstNavigationView(item))}
        type="button"
      >
        <Icon name={item['icon']} size={18} />
        {item['label']}
      </button>
    );
  };

  const customSheet: Web_AppShell_AppShell_CustomSheet = (phoneSheet === undefined) ? undefined : phoneSheet['content'];
  const sidebarNavigationScrollableClassName: Web_AppShell_AppShell_SidebarNavigationScrollableClassName = (sidebarNavigationCanScroll === true) ? ' is-scrollable' : '';
  const sidebarNavigationAtEndClassName: Web_AppShell_AppShell_SidebarNavigationAtEndClassName = (sidebarNavigationAtEnd === true) ? ' is-at-end' : '';

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
            className={`sidebar-navigation-slot${sidebarNavigationScrollableClassName}${sidebarNavigationAtEndClassName}`}
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
          const current: Web_AppShell_AppShell_Current = navigationItemHoldsView(item, activeView);
          const hasSheet: Web_AppShell_AppShell_HasSheet = navigationItemHasSheet(item);
          const expanded: Web_AppShell_AppShell_Expanded = navSheetRoot !== undefined && navSheetRoot['id'] === item['id'];

          return (
            <button
              aria-controls={(hasSheet === true) ? PHONE_NAV_SHEET_ID : undefined}
              aria-current={(current === true) ? 'page' : undefined}
              aria-expanded={(hasSheet === true) ? expanded : undefined}
              className="tab-bar-item"
              key={item['id']}
              onClick={() => handlePhoneTab(item)}
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
            aria-current={(moreCurrent === true) ? 'page' : undefined}
            aria-expanded={navSheetRoot !== undefined && navSheetRoot['id'] === 'more'}
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
