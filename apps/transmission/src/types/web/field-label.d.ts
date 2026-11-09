import type { ReactElement, ReactNode } from 'react';

/**
 * Field label.
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
