import type {
  ReactElement,
  ReactNode,
} from 'react';

import type {
  Web_Components_Button_Props,
  Web_Components_Button_Variant,
  Web_Components_Icon_Name,
  Web_Components_Icon_Props,
} from '@/types/web/components.d.ts';

/**
 * Primitives.
 *
 * @since 2.4.1
 */
export type Web_Primitives_BrandMark_Returns = ReactElement;

/**
 * Primitives.
 *
 * @since 2.4.1
 */
export type Web_Primitives_Button_Props = Web_Components_Button_Props;
export type Web_Primitives_Button_Returns = ReactElement;
export type Web_Primitives_Button_Block = boolean;
export type Web_Primitives_Button_Children = ReactNode;
export type Web_Primitives_Button_Disabled = boolean;
export type Web_Primitives_Button_Icon = Web_Components_Icon_Name | undefined;
export type Web_Primitives_Button_OnClick = (() => void) | undefined;
export type Web_Primitives_Button_Type = 'button' | 'submit';
export type Web_Primitives_Button_Variant = Web_Components_Button_Variant;
export type Web_Primitives_Button_BlockClassName = string;

/**
 * Primitives.
 *
 * @since 2.4.1
 */
export type Web_Primitives_Icon_Props = Web_Components_Icon_Props;
export type Web_Primitives_Icon_Returns = ReactElement;
export type Web_Primitives_Icon_Name = Web_Components_Icon_Name;
export type Web_Primitives_Icon_Size = number;

/**
 * Primitives.
 *
 * @since 2.4.1
 */
export type Web_Primitives_IconElements = Record<Web_Components_Icon_Name, ReactElement>;
