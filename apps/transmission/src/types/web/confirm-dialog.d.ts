import type {
  FormEvent,
  ReactElement,
  RefObject,
} from 'react';

import type { Web_Components_ConfirmDialog_Props } from '@/types/web/components.d.ts';

/**
 * Confirm Dialog.
 *
 * @since 2.4.1
 */
export type Web_ConfirmDialog_ConfirmDialog_Props = Web_Components_ConfirmDialog_Props;
export type Web_ConfirmDialog_ConfirmDialog_Returns = ReactElement | null;
export type Web_ConfirmDialog_ConfirmDialog_Busy = Web_Components_ConfirmDialog_Props['busy'];
export type Web_ConfirmDialog_ConfirmDialog_BusyLabel = Web_Components_ConfirmDialog_Props['busyLabel'];
export type Web_ConfirmDialog_ConfirmDialog_Children = Web_Components_ConfirmDialog_Props['children'];
export type Web_ConfirmDialog_ConfirmDialog_ConfirmDisabled = NonNullable<Web_Components_ConfirmDialog_Props['confirmDisabled']>;
export type Web_ConfirmDialog_ConfirmDialog_ConfirmLabel = Web_Components_ConfirmDialog_Props['confirmLabel'];
export type Web_ConfirmDialog_ConfirmDialog_Error = Web_Components_ConfirmDialog_Props['error'];
export type Web_ConfirmDialog_ConfirmDialog_Message = Web_Components_ConfirmDialog_Props['message'];
export type Web_ConfirmDialog_ConfirmDialog_OnCancel = Web_Components_ConfirmDialog_Props['onCancel'];
export type Web_ConfirmDialog_ConfirmDialog_OnConfirm = Web_Components_ConfirmDialog_Props['onConfirm'];
export type Web_ConfirmDialog_ConfirmDialog_Open = Web_Components_ConfirmDialog_Props['open'];
export type Web_ConfirmDialog_ConfirmDialog_Title = Web_Components_ConfirmDialog_Props['title'];
export type Web_ConfirmDialog_ConfirmDialog_Tone = NonNullable<Web_Components_ConfirmDialog_Props['tone']>;
export type Web_ConfirmDialog_ConfirmDialog_TitleId = string;
export type Web_ConfirmDialog_ConfirmDialog_MessageId = string;
export type Web_ConfirmDialog_ConfirmDialog_DialogRef = RefObject<HTMLElement | null>;
export type Web_ConfirmDialog_ConfirmDialog_Submit_Event = FormEvent<HTMLFormElement>;
export type Web_ConfirmDialog_ConfirmDialog_Submit_Returns = void;
export type Web_ConfirmDialog_ConfirmDialog_Submit = (event: Web_ConfirmDialog_ConfirmDialog_Submit_Event) => Web_ConfirmDialog_ConfirmDialog_Submit_Returns;
