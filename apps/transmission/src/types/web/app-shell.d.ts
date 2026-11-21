import type {
  Dispatch,
  ReactElement,
  ReactNode,
  RefObject,
  SetStateAction,
} from 'react';

import type {
  Web_Components_AccountMenu_Props,
  Web_Components_AppShell_PhoneSheet,
  Web_Components_AppShell_Props,
  Web_Components_ShellStatus,
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
import type { Web_Theme_Preference } from '@/types/web/theme.d.ts';

/**
 * App Shell.
 *
 * @since 2.4.1
 */
export type Web_AppShell_AccountMenu_Props = Web_Components_AccountMenu_Props;
export type Web_AppShell_AccountMenu_Returns = ReactElement;
export type Web_AppShell_AccountMenu_Detail = ReactNode;
export type Web_AppShell_AccountMenu_OnLogout = () => void;
export type Web_AppShell_AccountMenu_OnViewChange = (view: Web_Components_View) => void;
export type Web_AppShell_AccountMenu_Username = string;
export type Web_AppShell_AccountMenu_Open = boolean;
export type Web_AppShell_AccountMenu_SetOpen = Dispatch<SetStateAction<Web_AppShell_AccountMenu_Open>>;
export type Web_AppShell_AccountMenu_OpenState = [Web_AppShell_AccountMenu_Open, Web_AppShell_AccountMenu_SetOpen];
export type Web_AppShell_AccountMenu_ThemePreference = Web_Theme_Preference;
export type Web_AppShell_AccountMenu_SetThemePreference = Dispatch<SetStateAction<Web_AppShell_AccountMenu_ThemePreference>>;
export type Web_AppShell_AccountMenu_ThemePreferenceState = [Web_AppShell_AccountMenu_ThemePreference, Web_AppShell_AccountMenu_SetThemePreference];
export type Web_AppShell_AccountMenu_AppearanceId = string;

/**
 * App Shell.
 *
 * @since 2.4.1
 */
export type Web_AppShell_AppShell_Props = Web_Components_AppShell_Props;
export type Web_AppShell_AppShell_Returns = ReactElement;
export type Web_AppShell_AppShell_AccountDetail = ReactNode;
export type Web_AppShell_AppShell_ActiveView = Web_Components_View;
export type Web_AppShell_AppShell_CanOpen = (permission: string) => boolean;
export type Web_AppShell_AppShell_Children = ReactNode;
export type Web_AppShell_AppShell_Notice = ReactNode;
export type Web_AppShell_AppShell_OnLogout = () => void;
export type Web_AppShell_AppShell_OnViewChange = (view: Web_Components_View) => void;
export type Web_AppShell_AppShell_PhonePageTop = ReactNode;
export type Web_AppShell_AppShell_PhoneSheet = Web_Components_AppShell_PhoneSheet | undefined;
export type Web_AppShell_AppShell_SidebarNavigationSlot = ReactNode;
export type Web_AppShell_AppShell_SidebarTop = ReactNode;
export type Web_AppShell_AppShell_Status = Web_Components_ShellStatus | undefined;
export type Web_AppShell_AppShell_Username = string;
export type Web_AppShell_AppShell_NavSheetStack = Web_Navigation_SheetStack;
export type Web_AppShell_AppShell_SetNavSheetStack = Dispatch<SetStateAction<Web_AppShell_AppShell_NavSheetStack>>;
export type Web_AppShell_AppShell_NavSheetStackState = [Web_AppShell_AppShell_NavSheetStack, Web_AppShell_AppShell_SetNavSheetStack];
export type Web_AppShell_AppShell_SidebarNavigationCanScroll = boolean;
export type Web_AppShell_AppShell_SetSidebarNavigationCanScroll = Dispatch<SetStateAction<Web_AppShell_AppShell_SidebarNavigationCanScroll>>;
export type Web_AppShell_AppShell_SidebarNavigationCanScrollState = [Web_AppShell_AppShell_SidebarNavigationCanScroll, Web_AppShell_AppShell_SetSidebarNavigationCanScroll];
export type Web_AppShell_AppShell_SidebarNavigationAtEnd = boolean;
export type Web_AppShell_AppShell_SetSidebarNavigationAtEnd = Dispatch<SetStateAction<Web_AppShell_AppShell_SidebarNavigationAtEnd>>;
export type Web_AppShell_AppShell_SidebarNavigationAtEndState = [Web_AppShell_AppShell_SidebarNavigationAtEnd, Web_AppShell_AppShell_SetSidebarNavigationAtEnd];
export type Web_AppShell_AppShell_SidebarNavigationRefValue = HTMLDivElement | null;
export type Web_AppShell_AppShell_SidebarNavigationRef = RefObject<Web_AppShell_AppShell_SidebarNavigationRefValue>;
export type Web_AppShell_AppShell_NavigationItems = Web_Navigation_Items;
export type Web_AppShell_AppShell_PhoneNavigation = Web_Navigation_Tabs;
export type Web_AppShell_AppShell_NavSheetRoot = Web_Navigation_SheetLevel | undefined;
export type Web_AppShell_AppShell_StackedNavSheetLevel = Web_Navigation_SheetLevel | undefined;
export type Web_AppShell_AppShell_PhoneSheetLevel = Web_Navigation_SheetLevel | undefined;
export type Web_AppShell_AppShell_CurrentNavSheetLevel = Web_Navigation_SheetLevel | undefined;
export type Web_AppShell_AppShell_MoreCurrent = boolean;
export type Web_AppShell_AppShell_Navigation = HTMLDivElement | null;
export type Web_AppShell_AppShell_UpdateSidebarOverflow_Returns = void;
export type Web_AppShell_AppShell_UpdateSidebarOverflow = () => Web_AppShell_AppShell_UpdateSidebarOverflow_Returns;
export type Web_AppShell_AppShell_UpdateSidebarOverflow_CanScroll = boolean;
export type Web_AppShell_AppShell_ResizeObserver = ResizeObserver;
export type Web_AppShell_AppShell_FrameId = number;
export type Web_AppShell_AppShell_ClosePhoneNavigation_Returns = void;
export type Web_AppShell_AppShell_ClosePhoneNavigation = () => Web_AppShell_AppShell_ClosePhoneNavigation_Returns;
export type Web_AppShell_AppShell_ChangeView_View = Web_Components_View;
export type Web_AppShell_AppShell_ChangeView_Returns = void;
export type Web_AppShell_AppShell_ChangeView = (view: Web_AppShell_AppShell_ChangeView_View) => Web_AppShell_AppShell_ChangeView_Returns;
export type Web_AppShell_AppShell_HandlePhoneTab_Item = Web_Navigation_Item;
export type Web_AppShell_AppShell_HandlePhoneTab_Returns = void;
export type Web_AppShell_AppShell_HandlePhoneTab = (item: Web_AppShell_AppShell_HandlePhoneTab_Item) => Web_AppShell_AppShell_HandlePhoneTab_Returns;
export type Web_AppShell_AppShell_HandlePhoneTab_PhoneSheetId = string | undefined;
export type Web_AppShell_AppShell_HandlePhoneTab_NavSheetRootId = string | undefined;
export type Web_AppShell_AppShell_HandlePhoneTab_OpenSheetId = string | undefined;
export type Web_AppShell_AppShell_HandlePhoneTab_Action = Web_Navigation_PhoneTabAction;
export type Web_AppShell_AppShell_HandleMoreTab_Returns = void;
export type Web_AppShell_AppShell_HandleMoreTab = () => Web_AppShell_AppShell_HandleMoreTab_Returns;
export type Web_AppShell_AppShell_PopPhoneNavigation_Returns = void;
export type Web_AppShell_AppShell_PopPhoneNavigation = () => Web_AppShell_AppShell_PopPhoneNavigation_Returns;
export type Web_AppShell_AppShell_PushPhoneNavigation_Level = Web_Navigation_SheetLevel;
export type Web_AppShell_AppShell_PushPhoneNavigation_Returns = void;
export type Web_AppShell_AppShell_PushPhoneNavigation = (level: Web_AppShell_AppShell_PushPhoneNavigation_Level) => Web_AppShell_AppShell_PushPhoneNavigation_Returns;
export type Web_AppShell_AppShell_RenderDesktopPage_Item = Web_Navigation_Item;
export type Web_AppShell_AppShell_RenderDesktopPage_Page = Web_Navigation_Page;
export type Web_AppShell_AppShell_RenderDesktopPage_Returns = ReactElement;
export type Web_AppShell_AppShell_RenderDesktopPage = (item: Web_AppShell_AppShell_RenderDesktopPage_Item, page: Web_AppShell_AppShell_RenderDesktopPage_Page) => Web_AppShell_AppShell_RenderDesktopPage_Returns;
export type Web_AppShell_AppShell_RenderDesktopItem_Item = Web_Navigation_Item;
export type Web_AppShell_AppShell_RenderDesktopItem_Returns = ReactElement;
export type Web_AppShell_AppShell_RenderDesktopItem = (item: Web_AppShell_AppShell_RenderDesktopItem_Item) => Web_AppShell_AppShell_RenderDesktopItem_Returns;
export type Web_AppShell_AppShell_CustomSheet = ReactNode;
export type Web_AppShell_AppShell_SidebarNavigationScrollableClassName = string;
export type Web_AppShell_AppShell_SidebarNavigationAtEndClassName = string;
export type Web_AppShell_AppShell_Current = boolean;
export type Web_AppShell_AppShell_HasSheet = boolean;
export type Web_AppShell_AppShell_Expanded = boolean;
