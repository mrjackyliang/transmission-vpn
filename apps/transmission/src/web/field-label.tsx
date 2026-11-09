import {
  Children,
  cloneElement,
  isValidElement,
  useId,
} from 'react';

import type { ReactElement, ReactNode } from 'react';

import type {
  Web_FieldLabel_Element,
  Web_FieldLabel_Props,
} from '@/types/web/field-label.d.ts';

/**
 * Field Label - Control tags.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const controlTags: string[] = [
  'input',
  'select',
  'textarea',
];

/**
 * Field Label - Checks whether element.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const isElement = (item: ReactNode): item is Web_FieldLabel_Element => isValidElement(item);

// FieldLabel names its control with the visible label text alone. Hints, the strength meter,
// and errors inside it become the control's description, so screen readers read them after.

/**
 * Field Label.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const FieldLabel = ({
  children,
  className = 'field',
}: Web_FieldLabel_Props): ReactElement => {
  const baseId: string = useId();
  const items: ReactNode[] = Children.toArray(children);
  const elements: Web_FieldLabel_Element[] = items.filter(isElement);
  const labelElement: Web_FieldLabel_Element | undefined = elements.find((element: Web_FieldLabel_Element): boolean => element['type'] === 'span');
  const controlElement: Web_FieldLabel_Element | undefined = elements.find((element: Web_FieldLabel_Element): boolean => typeof element['type'] === 'string' && controlTags.includes(element['type']));

  if (labelElement === undefined || controlElement === undefined) {
    return <label className={className}>{children}</label>;
  }

  const labelId: string = labelElement['props']['id'] ?? `${baseId}-label`;
  const describedElements: Web_FieldLabel_Element[] = elements.filter((element: Web_FieldLabel_Element): boolean => element !== labelElement && element !== controlElement);
  const describedIds: string[] = describedElements.map((element: Web_FieldLabel_Element, index: number): string => element['props']['id'] ?? `${baseId}-description-${String(index)}`);
  const controlProps: Web_FieldLabel_Element['props'] = controlElement['props'];
  const describedBy: string = [
    controlProps['aria-describedby'],
    ...describedIds,
  ].filter((id: string | undefined): boolean => id !== undefined && id !== '').join(' ');
  const namedElsewhere: boolean = controlProps['aria-label'] !== undefined || controlProps['aria-labelledby'] !== undefined;

  return (
    <label className={className}>
      {items.map((item: ReactNode): ReactNode => {
        if (item === labelElement) {
          return cloneElement(labelElement, { id: labelId });
        }

        if (item === controlElement) {
          return cloneElement(controlElement, {
            'aria-describedby': (describedBy === '') ? undefined : describedBy,
            'aria-labelledby': (namedElsewhere === true) ? controlProps['aria-labelledby'] : labelId,
          });
        }

        const describedIndex: number = (isElement(item) === true) ? describedElements.indexOf(item) : -1;

        return (describedIndex === -1 || isElement(item) === false) ? item : cloneElement(item, { id: describedIds[describedIndex] });
      })}
    </label>
  );
};
