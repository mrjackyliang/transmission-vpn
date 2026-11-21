import type {
  Dispatch,
  ReactElement,
  RefObject,
  SetStateAction,
} from 'react';

import type { Web_BlocklistStatus_SourceLine } from '@/types/web/blocklist-status.d.ts';
import type { Web_Components_SettingsListEditor_Props } from '@/types/web/components.d.ts';

/**
 * Settings List Editor.
 *
 * @since 2.0.0
 */
export type Web_SettingsListEditor_GetSettingListEmptyState_SettingKey = string;
export type Web_SettingsListEditor_GetSettingListEmptyState_Returns = {
  hint: string | null;
  title: string;
};

/**
 * Settings List Editor.
 *
 * @since 2.0.0
 */
export type Web_SettingsListEditor_NormalizeSettingListValues_Values = string[];
export type Web_SettingsListEditor_NormalizeSettingListValues_Returns = string[];

/**
 * Settings List Editor.
 *
 * @since 2.4.1
 */
export type Web_SettingsListEditor_SettingsListEditor_Props = Web_Components_SettingsListEditor_Props;
export type Web_SettingsListEditor_SettingsListEditor_Returns = ReactElement;
export type Web_SettingsListEditor_SettingsListEditor_BlocklistStatus = Web_Components_SettingsListEditor_Props['blocklistStatus'];
export type Web_SettingsListEditor_SettingsListEditor_BlocklistsEnabled = Web_Components_SettingsListEditor_Props['blocklistsEnabled'];
export type Web_SettingsListEditor_SettingsListEditor_Disabled = Web_Components_SettingsListEditor_Props['disabled'];
export type Web_SettingsListEditor_SettingsListEditor_EditorVersion = Web_Components_SettingsListEditor_Props['editorVersion'];
export type Web_SettingsListEditor_SettingsListEditor_OnChange = Web_Components_SettingsListEditor_Props['onChange'];
export type Web_SettingsListEditor_SettingsListEditor_SettingKey = Web_Components_SettingsListEditor_Props['settingKey'];
export type Web_SettingsListEditor_SettingsListEditor_Title = Web_Components_SettingsListEditor_Props['title'];
export type Web_SettingsListEditor_SettingsListEditor_Values = Web_Components_SettingsListEditor_Props['values'];
export type Web_SettingsListEditor_SettingsListEditor_Rows = string[];
export type Web_SettingsListEditor_SettingsListEditor_RowsState = [string[], Dispatch<SetStateAction<string[]>>];
export type Web_SettingsListEditor_SettingsListEditor_SetRows = Dispatch<SetStateAction<string[]>>;
export type Web_SettingsListEditor_SettingsListEditor_SavedRows = (string | null)[];
export type Web_SettingsListEditor_SettingsListEditor_SavedRowsState = [(string | null)[], Dispatch<SetStateAction<(string | null)[]>>];
export type Web_SettingsListEditor_SettingsListEditor_SetSavedRows = Dispatch<SetStateAction<(string | null)[]>>;
export type Web_SettingsListEditor_SettingsListEditor_ValuesRef = RefObject<string[]>;
export type Web_SettingsListEditor_SettingsListEditor_InputElements = (HTMLInputElement | null)[];
export type Web_SettingsListEditor_SettingsListEditor_InputRefs = RefObject<(HTMLInputElement | null)[]>;
export type Web_SettingsListEditor_SettingsListEditor_FocusIndex = number | null;
export type Web_SettingsListEditor_SettingsListEditor_PendingFocusIndexRef = RefObject<number | null>;
export type Web_SettingsListEditor_SettingsListEditor_Blocklist = boolean;
export type Web_SettingsListEditor_SettingsListEditor_AtLimit = boolean;
export type Web_SettingsListEditor_SettingsListEditor_EmptyState = Web_SettingsListEditor_GetSettingListEmptyState_Returns;
export type Web_SettingsListEditor_SettingsListEditor_PendingFocusIndex = number | null;
export type Web_SettingsListEditor_SettingsListEditor_PendingInput = HTMLInputElement | null | undefined;
export type Web_SettingsListEditor_SettingsListEditor_UpdateRows_NextRows = string[];
export type Web_SettingsListEditor_SettingsListEditor_UpdateRows_NextSavedRows = (string | null)[];
export type Web_SettingsListEditor_SettingsListEditor_UpdateRows_Returns = void;
export type Web_SettingsListEditor_SettingsListEditor_UpdateRows = (nextRows: Web_SettingsListEditor_SettingsListEditor_UpdateRows_NextRows, nextSavedRows?: Web_SettingsListEditor_SettingsListEditor_UpdateRows_NextSavedRows) => Web_SettingsListEditor_SettingsListEditor_UpdateRows_Returns;
export type Web_SettingsListEditor_SettingsListEditor_Invalid = boolean;
export type Web_SettingsListEditor_SettingsListEditor_SourceStatus = Web_BlocklistStatus_SourceLine | null;
export type Web_SettingsListEditor_SettingsListEditor_SourceStatusID = string;
export type Web_SettingsListEditor_SettingsListEditor_NextRows = string[];
