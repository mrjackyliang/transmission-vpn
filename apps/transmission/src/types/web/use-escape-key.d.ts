import type { MutableRefObject } from 'react';

/**
 * Use Escape Key.
 *
 * @since 2.4.1
 */
export type Web_UseEscapeKey_HandleKeyDown_Event = KeyboardEvent;
export type Web_UseEscapeKey_HandleKeyDown_Returns = void;
export type Web_UseEscapeKey_HandleKeyDown_TopLayer = (() => void) | undefined;

/**
 * Use Escape Key.
 *
 * @since 2.4.1
 */
export type Web_UseEscapeKey_LayerStack_Layer = () => void;
export type Web_UseEscapeKey_LayerStack = Web_UseEscapeKey_LayerStack_Layer[];

/**
 * Use Escape Key.
 *
 * @since 2.4.1
 */
export type Web_UseEscapeKey_UseEscapeKey_OnClose = () => void;
export type Web_UseEscapeKey_UseEscapeKey_Active = boolean;
export type Web_UseEscapeKey_UseEscapeKey_Returns = void;
export type Web_UseEscapeKey_UseEscapeKey_LatestOnClose = MutableRefObject<() => void>;
export type Web_UseEscapeKey_UseEscapeKey_Layer_Returns = void;
export type Web_UseEscapeKey_UseEscapeKey_Layer = () => Web_UseEscapeKey_UseEscapeKey_Layer_Returns;
export type Web_UseEscapeKey_UseEscapeKey_Index = number;
