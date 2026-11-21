import type {
  ReactElement,
  ReactNode,
  RefObject,
} from 'react';

import type { Web_Components_View } from '@/types/web/components.d.ts';
import type { Web_Navigation_SheetLevel } from '@/types/web/navigation.d.ts';

/**
 * Nav Sheet.
 *
 * @since 2.4.1
 */
export type Web_NavSheet_NavSheet_Returns = ReactElement;
export type Web_NavSheet_NavSheet_ActiveView = Web_Components_View;
export type Web_NavSheet_NavSheet_Children = ReactNode | undefined;
export type Web_NavSheet_NavSheet_Level = Web_Navigation_SheetLevel;
export type Web_NavSheet_NavSheet_OnBack = () => void;
export type Web_NavSheet_NavSheet_OnClose = () => void;
export type Web_NavSheet_NavSheet_OnNavigate = (view: Web_Components_View) => void;
export type Web_NavSheet_NavSheet_OnPush = (level: Web_Navigation_SheetLevel) => void;
export type Web_NavSheet_NavSheet_FocusKey = string;
export type Web_NavSheet_NavSheet_DialogRef = RefObject<HTMLElement | null>;
export type Web_NavSheet_NavSheet_HeadingRef = RefObject<HTMLHeadingElement | null>;
export type Web_NavSheet_NavSheet_Heading = HTMLHeadingElement | null;
export type Web_NavSheet_NavSheet_Current = boolean;

/**
 * Nav Sheet.
 *
 * @since 2.0.0
 */
export type Web_NavSheet_Props = {
  activeView: Web_Components_View;
  children?: ReactNode;
  level: Web_Navigation_SheetLevel;
  onBack: () => void;
  onClose: () => void;
  onNavigate: (view: Web_Components_View) => void;
  onPush: (level: Web_Navigation_SheetLevel) => void;
};
