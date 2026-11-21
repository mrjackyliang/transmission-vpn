/**
 * Theme.
 *
 * @since 2.0.0
 */
export type Web_Theme_Preference = 'system' | 'light' | 'dark';
export type Web_Theme_Option = {
  id: Web_Theme_Preference;
  label: string;
};

/**
 * Theme.
 *
 * @since 2.4.1
 */
export type Web_Theme_ApplyThemePreference_Preference = Web_Theme_Preference;
export type Web_Theme_ApplyThemePreference_Returns = void;

/**
 * Theme.
 *
 * @since 2.4.1
 */
export type Web_Theme_ReadThemePreference_Returns = Web_Theme_Preference;
export type Web_Theme_ReadThemePreference_StoredPreference = string | null;

/**
 * Theme.
 *
 * @since 2.4.1
 */
export type Web_Theme_ThemeOptions = Web_Theme_Option[];

/**
 * Theme.
 *
 * @since 2.4.1
 */
export type Web_Theme_ThemeStorageKey = string;
