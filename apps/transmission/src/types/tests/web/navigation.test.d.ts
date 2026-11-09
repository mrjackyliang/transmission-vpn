import type { Web_AppNavigation_Route } from '@/types/web/app-navigation.d.ts';
import type { Web_Navigation_Browser } from '@/types/web/navigation.d.ts';

/**
 * Navigation.
 *
 * @since UNRELEASED
 */
export type Tests_Web_Navigation_HistoryFixture = {
  back: () => void;
  browser: Web_Navigation_Browser;
  entries: string[];
  forward: () => void;
};

/**
 * Navigation.
 *
 * @since UNRELEASED
 */
export type Tests_Web_Navigation_HistoryPosition = {
  value: number;
};

/**
 * Navigation.
 *
 * @since UNRELEASED
 */
export type Tests_Web_Navigation_RouteState = {
  value: Web_AppNavigation_Route;
};
