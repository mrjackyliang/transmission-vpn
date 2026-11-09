import { useState } from 'react';

import { DirectoryBrowserDialog } from '@/web/directory-browser-dialog.tsx';
import { Button } from '@/web/primitives.tsx';

import type {
  KeyboardEvent as ReactKeyboardEvent,
  ReactElement,
} from 'react';

import type { Web_Components_SettingsDirectoryField_Props } from '@/types/web/components.d.ts';

/**
 * Settings Directory Field.
 *
 * Keeps the read-only path field and its purpose-aware picker together.
 * SettingsView can therefore retain its existing generic row rendering.
 *
 * @since UNRELEASED
 */
export const SettingsDirectoryField = ({
  disabled,
  onChange,
  purpose,
  title,
  value,
}: Web_Components_SettingsDirectoryField_Props): ReactElement => {
  const [
    browserOpen,
    setBrowserOpen,
  ] = useState<boolean>(false);

  /**
   * Settings Directory Field - Open browser with keyboard.
   *
   * Makes the path box behave like its adjacent Browse button.
   * Enter and Space remain available when a keyboard user focuses the field.
   *
   * @since UNRELEASED
   */
  const openWithKeyboard = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setBrowserOpen(true);
    }
  };

  return (
    <>
      <div className="directory-field-row settings-directory-field">
        <input
          aria-label={`${title} path`}
          className="setting-input settings-directory-value"
          disabled={disabled}
          onClick={(): void => setBrowserOpen(true)}
          onKeyDown={openWithKeyboard}
          readOnly
          type="text"
          value={value}
        />
        <Button disabled={disabled} icon="folder" onClick={(): void => setBrowserOpen(true)}>Browse</Button>
      </div>
      <DirectoryBrowserDialog
        initialPath={value}
        onClose={(): void => setBrowserOpen(false)}
        onSelect={(path: string): void => {
          onChange(path);
          setBrowserOpen(false);
        }}
        open={browserOpen}
        purpose={purpose}
      />
    </>
  );
};
