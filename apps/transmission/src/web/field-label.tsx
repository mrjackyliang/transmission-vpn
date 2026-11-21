import {
  Children,
  cloneElement,
  isValidElement,
  useId,
} from 'react';

import type {
  Web_FieldLabel_ControlTags,
  Web_FieldLabel_FieldLabel_BaseId,
  Web_FieldLabel_FieldLabel_Children,
  Web_FieldLabel_FieldLabel_ClassName,
  Web_FieldLabel_FieldLabel_ControlElement,
  Web_FieldLabel_FieldLabel_ControlProps,
  Web_FieldLabel_FieldLabel_DescribedBy,
  Web_FieldLabel_FieldLabel_DescribedElements,
  Web_FieldLabel_FieldLabel_DescribedIds,
  Web_FieldLabel_FieldLabel_DescribedIndex,
  Web_FieldLabel_FieldLabel_Elements,
  Web_FieldLabel_FieldLabel_Items,
  Web_FieldLabel_FieldLabel_LabelElement,
  Web_FieldLabel_FieldLabel_LabelId,
  Web_FieldLabel_FieldLabel_NamedElsewhere,
  Web_FieldLabel_FieldLabel_Props,
  Web_FieldLabel_FieldLabel_Returns,
  Web_FieldLabel_IsElement_Item,
  Web_FieldLabel_IsElement_TypeGuard,
} from '@/types/web/field-label.d.ts';

/**
 * Field Label - Control Tags.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const controlTags: Web_FieldLabel_ControlTags = [
  'input',
  'select',
  'textarea',
];

/**
 * Field Label - Is Element.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_FieldLabel_IsElement_Item} item - Item.
 *
 * @returns {Web_FieldLabel_IsElement_TypeGuard}
 *
 * @since 2.0.0
 */
const isElement = (item: Web_FieldLabel_IsElement_Item): item is Web_FieldLabel_IsElement_TypeGuard => isValidElement(item);

// FieldLabel names its control with the visible label text alone. Hints, the strength meter,
// and errors inside it become the control's description, so screen readers read them after.

/**
 * Field Label - Field Label.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_FieldLabel_FieldLabel_Props} props - Props.
 *
 * @returns {Web_FieldLabel_FieldLabel_Returns}
 *
 * @since 2.0.0
 */
export const FieldLabel = (props: Web_FieldLabel_FieldLabel_Props): Web_FieldLabel_FieldLabel_Returns => {
  const children: Web_FieldLabel_FieldLabel_Children = props['children'];
  const className: Web_FieldLabel_FieldLabel_ClassName = props['className'] ?? 'field';
  const baseId: Web_FieldLabel_FieldLabel_BaseId = useId();
  const items: Web_FieldLabel_FieldLabel_Items = Children.toArray(children);
  const elements: Web_FieldLabel_FieldLabel_Elements = items.filter(isElement);
  const labelElement: Web_FieldLabel_FieldLabel_LabelElement = elements.find((element) => element['type'] === 'span');
  const controlElement: Web_FieldLabel_FieldLabel_ControlElement = elements.find((element) => typeof element['type'] === 'string' && controlTags.includes(element['type']));

  if (labelElement === undefined || controlElement === undefined) {
    return <label className={className}>{children}</label>;
  }

  const labelId: Web_FieldLabel_FieldLabel_LabelId = labelElement['props']['id'] ?? `${baseId}-label`;
  const describedElements: Web_FieldLabel_FieldLabel_DescribedElements = elements.filter((element) => element !== labelElement && element !== controlElement);
  const describedIds: Web_FieldLabel_FieldLabel_DescribedIds = describedElements.map((element, index) => element['props']['id'] ?? `${baseId}-description-${String(index)}`);
  const controlProps: Web_FieldLabel_FieldLabel_ControlProps = controlElement['props'];
  const describedBy: Web_FieldLabel_FieldLabel_DescribedBy = [
    controlProps['aria-describedby'],
    ...describedIds,
  ].filter((id) => id !== undefined && id !== '').join(' ');
  const namedElsewhere: Web_FieldLabel_FieldLabel_NamedElsewhere = controlProps['aria-label'] !== undefined || controlProps['aria-labelledby'] !== undefined;

  return (
    <label className={className}>
      {items.map((item) => {
        if (item === labelElement) {
          return cloneElement(labelElement, { id: labelId });
        }

        if (item === controlElement) {
          return cloneElement(controlElement, {
            'aria-describedby': (describedBy === '') ? undefined : describedBy,
            'aria-labelledby': (namedElsewhere === true) ? controlProps['aria-labelledby'] : labelId,
          });
        }

        const describedIndex: Web_FieldLabel_FieldLabel_DescribedIndex = (isElement(item) === true) ? describedElements.indexOf(item) : -1;

        return (describedIndex === -1 || isElement(item) === false) ? item : cloneElement(item, { id: describedIds[describedIndex] });
      })}
    </label>
  );
};
