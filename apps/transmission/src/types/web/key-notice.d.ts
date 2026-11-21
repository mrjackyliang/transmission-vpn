import type {
  Dispatch,
  ReactElement,
  SetStateAction,
} from 'react';

import type { Web_Components_KeyNotice_Item } from '@/types/web/components.d.ts';

/**
 * Key Notice.
 *
 * @since 2.4.1
 */
export type Web_KeyNotice_KeyNotice_Returns = ReactElement;
export type Web_KeyNotice_KeyNotice_AppName = string;
export type Web_KeyNotice_KeyNotice_Items = Web_Components_KeyNotice_Item[];
export type Web_KeyNotice_KeyNotice_KeyName = string;
export type Web_KeyNotice_KeyNotice_OnDismiss = () => Promise<void>;
export type Web_KeyNotice_KeyNotice_RemovedAt = string;
export type Web_KeyNotice_KeyNotice_BusyState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_KeyNotice_KeyNotice_Busy = boolean;
export type Web_KeyNotice_KeyNotice_SetBusy = Dispatch<SetStateAction<boolean>>;
export type Web_KeyNotice_KeyNotice_ErrorState = [unknown, Dispatch<SetStateAction<unknown>>];
export type Web_KeyNotice_KeyNotice_Error = unknown;
export type Web_KeyNotice_KeyNotice_SetError = Dispatch<SetStateAction<unknown>>;
export type Web_KeyNotice_KeyNotice_Dismiss_Returns = Promise<void>;
export type Web_KeyNotice_KeyNotice_Dismiss = () => Web_KeyNotice_KeyNotice_Dismiss_Returns;
