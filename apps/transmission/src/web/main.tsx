import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/web/app.tsx';
import { formatConsoleError } from '@/web/form-validation.ts';
import '@/web/styles/index.css';
import {
  applyThemePreference,
  readThemePreference,
} from '@/web/theme.ts';
import { setToastErrorFormatter } from '@/web/toast.ts';

import type { Web_Main_RootElement } from '@/types/web/main.d.ts';

setToastErrorFormatter(formatConsoleError);

applyThemePreference(readThemePreference());

/**
 * Main - Root Element.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const rootElement: Web_Main_RootElement = document.querySelector('#root');

if (rootElement === null) {
  throw new Error('The application root element was not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
