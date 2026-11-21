import type { ReactElement, ReactNode } from 'react';

/**
 * Field Label.
 *
 * @since 2.0.0
 */
export type Web_FieldLabel_ElementProps = {
  'aria-describedby'?: string | undefined;
  'aria-label'?: string | undefined;
  'aria-labelledby'?: string | undefined;
  'id'?: string | undefined;
};
export type Web_FieldLabel_Element = ReactElement<Web_FieldLabel_ElementProps>;
export type Web_FieldLabel_Props = {
  children: ReactNode;
  className?: string;
};

/**
 * Field Label.
 *
 * @since 2.4.1
 */
export type Web_FieldLabel_ControlTags = string[];

/**
 * Field Label.
 *
 * @since 2.4.1
 */
export type Web_FieldLabel_FieldLabel_Props = Web_FieldLabel_Props;
export type Web_FieldLabel_FieldLabel_Returns = ReactElement;
export type Web_FieldLabel_FieldLabel_Children = ReactNode;
export type Web_FieldLabel_FieldLabel_ClassName = string;
export type Web_FieldLabel_FieldLabel_BaseId = string;
export type Web_FieldLabel_FieldLabel_Items = ReactNode[];
export type Web_FieldLabel_FieldLabel_Elements = Web_FieldLabel_Element[];
export type Web_FieldLabel_FieldLabel_LabelElement = Web_FieldLabel_Element | undefined;
export type Web_FieldLabel_FieldLabel_ControlElement = Web_FieldLabel_Element | undefined;
export type Web_FieldLabel_FieldLabel_LabelId = string;
export type Web_FieldLabel_FieldLabel_DescribedElements = Web_FieldLabel_Element[];
export type Web_FieldLabel_FieldLabel_DescribedIds = string[];
export type Web_FieldLabel_FieldLabel_ControlProps = Web_FieldLabel_ElementProps;
export type Web_FieldLabel_FieldLabel_DescribedBy = string;
export type Web_FieldLabel_FieldLabel_NamedElsewhere = boolean;
export type Web_FieldLabel_FieldLabel_DescribedIndex = number;

/**
 * Field Label.
 *
 * @since 2.4.1
 */
export type Web_FieldLabel_IsElement_Item = ReactNode;
export type Web_FieldLabel_IsElement_TypeGuard = Web_FieldLabel_Element;
