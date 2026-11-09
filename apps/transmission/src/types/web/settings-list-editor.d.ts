/**
 * Settings List Editor - Get setting list empty state.
 *
 * @since UNRELEASED
 */
export type Web_SettingsListEditor_GetSettingListEmptyState_SettingKey = string;
export type Web_SettingsListEditor_GetSettingListEmptyState_Returns = {
  hint: string | null;
  title: string;
};

/**
 * Settings List Editor - Normalize setting list values.
 *
 * @since UNRELEASED
 */
export type Web_SettingsListEditor_NormalizeSettingListValues_Values = string[];
export type Web_SettingsListEditor_NormalizeSettingListValues_Returns = string[];
