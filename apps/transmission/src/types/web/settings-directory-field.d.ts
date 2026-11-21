import type {
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  ReactElement,
  SetStateAction,
} from 'react';

import type { Web_Components_SettingsDirectoryField_Props } from '@/types/web/components.d.ts';

/**
 * Settings Directory Field.
 *
 * @since 2.4.1
 */
export type Web_SettingsDirectoryField_SettingsDirectoryField_Props = Web_Components_SettingsDirectoryField_Props;
export type Web_SettingsDirectoryField_SettingsDirectoryField_Returns = ReactElement;
export type Web_SettingsDirectoryField_SettingsDirectoryField_Disabled = Web_Components_SettingsDirectoryField_Props['disabled'];
export type Web_SettingsDirectoryField_SettingsDirectoryField_OnChange = Web_Components_SettingsDirectoryField_Props['onChange'];
export type Web_SettingsDirectoryField_SettingsDirectoryField_Purpose = Web_Components_SettingsDirectoryField_Props['purpose'];
export type Web_SettingsDirectoryField_SettingsDirectoryField_Title = Web_Components_SettingsDirectoryField_Props['title'];
export type Web_SettingsDirectoryField_SettingsDirectoryField_Value = Web_Components_SettingsDirectoryField_Props['value'];
export type Web_SettingsDirectoryField_SettingsDirectoryField_BrowserOpen = boolean;
export type Web_SettingsDirectoryField_SettingsDirectoryField_BrowserOpenState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_SettingsDirectoryField_SettingsDirectoryField_SetBrowserOpen = Dispatch<SetStateAction<boolean>>;
export type Web_SettingsDirectoryField_SettingsDirectoryField_OpenWithKeyboard_Event = ReactKeyboardEvent<HTMLInputElement>;
export type Web_SettingsDirectoryField_SettingsDirectoryField_OpenWithKeyboard_Returns = void;
export type Web_SettingsDirectoryField_SettingsDirectoryField_OpenWithKeyboard = (event: Web_SettingsDirectoryField_SettingsDirectoryField_OpenWithKeyboard_Event) => Web_SettingsDirectoryField_SettingsDirectoryField_OpenWithKeyboard_Returns;
