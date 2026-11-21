import { appConfig } from '@/web/app-config.ts';

import type {
  Web_Theme_ApplyThemePreference_Preference,
  Web_Theme_ApplyThemePreference_Returns,
  Web_Theme_ReadThemePreference_Returns,
  Web_Theme_ReadThemePreference_StoredPreference,
  Web_Theme_ThemeOptions,
  Web_Theme_ThemeStorageKey,
} from '@/types/web/theme.d.ts';

/**
 * Theme - Storage Key.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const themeStorageKey: Web_Theme_ThemeStorageKey = appConfig['storageKeys']['theme'];

/**
 * Theme - Options.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const themeOptions: Web_Theme_ThemeOptions = [
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
 * Theme - Read Theme Preference.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {Web_Theme_ReadThemePreference_Returns}
 *
 * @since 2.0.0
 */
export const readThemePreference = (): Web_Theme_ReadThemePreference_Returns => {
  try {
    const storedPreference: Web_Theme_ReadThemePreference_StoredPreference = window.localStorage.getItem(themeStorageKey);

    if (storedPreference === 'light' || storedPreference === 'dark') {
      return storedPreference;
    }
  } catch {
    return 'system';
  }

  return 'system';
};

/**
 * Theme - Apply Theme Preference.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_Theme_ApplyThemePreference_Preference} preference - Preference.
 *
 * @returns {Web_Theme_ApplyThemePreference_Returns}
 *
 * @since 2.0.0
 */
export const applyThemePreference = (preference: Web_Theme_ApplyThemePreference_Preference): Web_Theme_ApplyThemePreference_Returns => {
  Reflect.set(document.documentElement.dataset, 'theme', preference);

  try {
    window.localStorage.setItem(themeStorageKey, preference);
  } catch {
    return;
  }

  return;
};
