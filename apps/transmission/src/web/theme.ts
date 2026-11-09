import { appConfig } from '@/web/app-config.ts';

import type {
  Web_Theme_Option,
  Web_Theme_Preference,
} from '@/types/web/theme.d.ts';

/**
 * Theme - Theme storage key.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const themeStorageKey: string = appConfig['storageKeys']['theme'];

/**
 * Theme - Theme options.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const themeOptions: Web_Theme_Option[] = [
  {
    id: 'system',
    label: 'System',
  },
  {
    id: 'light',
    label: 'Light',
  },
  {
    id: 'dark',
    label: 'Dark',
  },
];

/**
 * Theme - Reads theme preference.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const readThemePreference = (): Web_Theme_Preference => {
  try {
    const storedPreference: string | null = window.localStorage.getItem(themeStorageKey);
    if (storedPreference === 'light' || storedPreference === 'dark') {
      return storedPreference;
    }
  } catch {
    return 'system';
  }

  return 'system';
};

/**
 * Theme - Applies theme preference.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const applyThemePreference = (preference: Web_Theme_Preference): void => {
  Reflect.set(document.documentElement.dataset, 'theme', preference);
  try {
    window.localStorage.setItem(themeStorageKey, preference);
  } catch {
    return;
  }
};
