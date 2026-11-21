import type {
  Web_SettingsListEditor_GetSettingListEmptyState_Returns,
  Web_SettingsListEditor_GetSettingListEmptyState_SettingKey,
  Web_SettingsListEditor_NormalizeSettingListValues_Returns,
  Web_SettingsListEditor_NormalizeSettingListValues_Values,
} from '@/types/web/settings-list-editor.d.ts';

/**
 * Settings List Editor - Get Setting List Empty State.
 *
 * Selects empty-state copy without coupling the shared editor to one setting.
 * Blocklist sources get task-specific guidance while future lists stay neutral.
 *
 * @param {Web_SettingsListEditor_GetSettingListEmptyState_SettingKey} settingKey - Setting key.
 *
 * @returns {Web_SettingsListEditor_GetSettingListEmptyState_Returns}
 *
 * @since 2.0.0
 */
export const getSettingListEmptyState = (
  settingKey: Web_SettingsListEditor_GetSettingListEmptyState_SettingKey,
): Web_SettingsListEditor_GetSettingListEmptyState_Returns => {
  if (settingKey === 'transmission.blocklistSources') {
    return {
      hint: 'Add an HTTPS address for each blocklist.',
      title: 'No sources yet',
    };
  }

  return {
    hint: null,
    title: 'No values yet',
  };
};

/**
 * Settings List Editor - Normalize Setting List Values.
 *
 * Keeps blank rows in the editor while sending only trimmed, non-empty values
 * into the Settings draft and save transaction.
 *
 * @param {Web_SettingsListEditor_NormalizeSettingListValues_Values} values - Values.
 *
 * @returns {Web_SettingsListEditor_NormalizeSettingListValues_Returns}
 *
 * @since 2.0.0
 */
export const normalizeSettingListValues = (
  values: Web_SettingsListEditor_NormalizeSettingListValues_Values,
): Web_SettingsListEditor_NormalizeSettingListValues_Returns => {
  return values
    .map((value) => value.trim())
    .filter((value) => value !== '');
};
