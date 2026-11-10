/**
 * Settings List Editor - Get setting list empty state.
 *
 * @since 2.0.0
 */
export type Web_SettingsListEditor_GetSettingListEmptyState_SettingKey = string;
export type Web_SettingsListEditor_GetSettingListEmptyState_Returns = {
  hint: string | null;
  title: string;
};

/**
 * Settings List Editor - Normalize setting list values.
 *
 * @since 2.0.0
 */
export type Web_SettingsListEditor_NormalizeSettingListValues_Values = string[];
export type Web_SettingsListEditor_NormalizeSettingListValues_Returns = string[];
