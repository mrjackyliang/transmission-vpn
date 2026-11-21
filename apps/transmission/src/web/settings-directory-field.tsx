import { useState } from 'react';

import { DirectoryBrowserDialog } from '@/web/directory-browser-dialog.tsx';
import { Button } from '@/web/primitives.tsx';

import type {
  Web_SettingsDirectoryField_SettingsDirectoryField_BrowserOpen,
  Web_SettingsDirectoryField_SettingsDirectoryField_BrowserOpenState,
  Web_SettingsDirectoryField_SettingsDirectoryField_Disabled,
  Web_SettingsDirectoryField_SettingsDirectoryField_OnChange,
  Web_SettingsDirectoryField_SettingsDirectoryField_OpenWithKeyboard,
  Web_SettingsDirectoryField_SettingsDirectoryField_OpenWithKeyboard_Event,
  Web_SettingsDirectoryField_SettingsDirectoryField_OpenWithKeyboard_Returns,
  Web_SettingsDirectoryField_SettingsDirectoryField_Props,
  Web_SettingsDirectoryField_SettingsDirectoryField_Purpose,
  Web_SettingsDirectoryField_SettingsDirectoryField_Returns,
  Web_SettingsDirectoryField_SettingsDirectoryField_SetBrowserOpen,
  Web_SettingsDirectoryField_SettingsDirectoryField_Title,
  Web_SettingsDirectoryField_SettingsDirectoryField_Value,
} from '@/types/web/settings-directory-field.d.ts';

/**
 * Settings Directory Field - Settings Directory Field.
 *
 * Keeps the read-only path field and its purpose-aware picker together.
 * SettingsView can therefore retain its existing generic row rendering.
 *
 * @param {Web_SettingsDirectoryField_SettingsDirectoryField_Props} props - Props.
 *
 * @returns {Web_SettingsDirectoryField_SettingsDirectoryField_Returns}
 *
 * @since 2.0.0
 */
export const SettingsDirectoryField = (props: Web_SettingsDirectoryField_SettingsDirectoryField_Props): Web_SettingsDirectoryField_SettingsDirectoryField_Returns => {
  const disabled: Web_SettingsDirectoryField_SettingsDirectoryField_Disabled = props['disabled'];
  const onChange: Web_SettingsDirectoryField_SettingsDirectoryField_OnChange = props['onChange'];
  const purpose: Web_SettingsDirectoryField_SettingsDirectoryField_Purpose = props['purpose'];
  const title: Web_SettingsDirectoryField_SettingsDirectoryField_Title = props['title'];
  const value: Web_SettingsDirectoryField_SettingsDirectoryField_Value = props['value'];
  const browserOpenState: Web_SettingsDirectoryField_SettingsDirectoryField_BrowserOpenState = useState<Web_SettingsDirectoryField_SettingsDirectoryField_BrowserOpen>(false);
  const browserOpen: Web_SettingsDirectoryField_SettingsDirectoryField_BrowserOpen = browserOpenState[0];
  const setBrowserOpen: Web_SettingsDirectoryField_SettingsDirectoryField_SetBrowserOpen = browserOpenState[1];

  /**
   * Settings Directory Field - Open With Keyboard.
   *
   * Makes the path box behave like its adjacent Browse button.
   * Enter and Space remain available when a keyboard user focuses the field.
   *
   * @param {Web_SettingsDirectoryField_SettingsDirectoryField_OpenWithKeyboard_Event} event - Event.
   *
   * @returns {Web_SettingsDirectoryField_SettingsDirectoryField_OpenWithKeyboard_Returns}
   *
   * @since 2.0.0
   */
  const openWithKeyboard: Web_SettingsDirectoryField_SettingsDirectoryField_OpenWithKeyboard = (event: Web_SettingsDirectoryField_SettingsDirectoryField_OpenWithKeyboard_Event): Web_SettingsDirectoryField_SettingsDirectoryField_OpenWithKeyboard_Returns => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();

      setBrowserOpen(true);
    }

    return;
  };

  return (
    <>
      <div className="directory-field-row settings-directory-field">
        <input
          aria-label={`${title} path`}
          className="setting-input settings-directory-value"
          disabled={disabled}
          onClick={() => setBrowserOpen(true)}
          onKeyDown={openWithKeyboard}
          readOnly
          type="text"
          value={value}
        />
        <Button disabled={disabled} icon="folder" onClick={() => setBrowserOpen(true)}>Browse</Button>
      </div>
      <DirectoryBrowserDialog
        initialPath={value}
        onClose={() => setBrowserOpen(false)}
        onSelect={(path) => {
          onChange(path);
          setBrowserOpen(false);

          return;
        }}
        open={browserOpen}
        purpose={purpose}
      />
    </>
  );
};
