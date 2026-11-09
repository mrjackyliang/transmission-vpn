import type {
  KeyboardEvent,
  PointerEvent,
} from 'react';

/**
 * Use Drag Reorder.
 *
 * @since UNRELEASED
 */
export type Web_UseDragReorder_Result = {
  announcement: string;
  draggingID: string | null;
  handleKeyDown: (event: KeyboardEvent<HTMLElement>, id: string, index: number, count: number, label: string) => void;
  handlePointerDown: (event: PointerEvent<HTMLElement>, id: string) => void;
};
