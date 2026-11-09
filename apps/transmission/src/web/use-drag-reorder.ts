import {
  useEffect,
  useRef,
  useState,
} from 'react';

import type { RefObject } from 'react';

import type { Web_UseDragReorder_Result } from '@/types/web/use-drag-reorder.d.ts';

/**
 * Use Drag Reorder - Place listed ID.
 *
 * Moves one listed item to a new place in an ordered list of IDs. Places count only the
 * listed items, and IDs missing from the list stay after them.
 *
 * @param {string[]}                         ids              - Ids.
 * @param {Pick<ReadonlySet<string>, 'has'>} listed           - Listed.
 * @param {string}                           id               - Id.
 * @param {number}                           destinationIndex - Destination index.
 *
 * @since UNRELEASED
 */
export const placeListedID = (
  ids: string[],
  listed: Pick<ReadonlySet<string>, 'has'>,
  id: string,
  destinationIndex: number,
): string[] => {
  const listedIDs: string[] = ids.filter((currentID): boolean => listed.has(currentID));
  const others: string[] = listedIDs.filter((listedID): boolean => listedID !== id);
  const index: number = Math.min(Math.max(destinationIndex, 0), others.length);

  if (!listed.has(id) || listedIDs.indexOf(id) === index) {
    return ids;
  }

  return [
    ...others.slice(0, index),
    id,
    ...others.slice(index),
    ...ids.filter((currentID): boolean => !listed.has(currentID)),
  ];
};

/**
 * Use Drag Reorder - Use drag reorder.
 *
 * Reorders a list's rows by dragging a grip handle or pressing the up and down arrow keys on
 * it. Rows carry `data-reorder-id` and their handle the `reorder-handle` class. Each move
 * reports the row's new place, and the drop ending each change lets a saved list save once.
 *
 * @param {RefObject<HTMLElement | null>}                  listRef - List ref.
 * @param {(id: string, destinationIndex: number) => void} onMove  - On move.
 * @param {() => void}                                     onDrop  - On drop.
 *
 * @since UNRELEASED
 */
export const useDragReorder = (
  listRef: RefObject<HTMLElement | null>,
  onMove: (id: string, destinationIndex: number) => void,
  onDrop: () => void = (): void => undefined,
): Web_UseDragReorder_Result => {
  const [
    draggingID,
    setDraggingID,
  ] = useState<string | null>(null);
  const [
    announcement,
    setAnnouncement,
  ] = useState<string>('');
  const onMoveRef = useRef<(id: string, destinationIndex: number) => void>(onMove);
  const onDropRef = useRef<() => void>(onDrop);
  const focusIDRef = useRef<string | null>(null);

  useEffect((): void => {
    onMoveRef.current = onMove;
    onDropRef.current = onDrop;
  });

  useEffect((): (() => void) | undefined => {
    if (draggingID === null) {
      return undefined;
    }

    /**
     * Use Drag Reorder - Follow drag.
     *
     * Moves the held row past every row whose middle the pointer has crossed. Window
     * listeners keep the drag alive while React moves the held row's element.
     *
     * @param {PointerEvent} event - Event.
     *
     * @since UNRELEASED
     */
    const followDrag = (event: PointerEvent): void => {
      const rows: HTMLElement[] = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-reorder-id]') ?? []);
      const destinationIndex: number = rows.filter((row): boolean => {
        const rect: DOMRect = row.getBoundingClientRect();

        return row.dataset['reorderId'] !== draggingID && event.clientY > rect.top + (rect.height / 2);
      }).length;

      onMoveRef.current(draggingID, destinationIndex);
    };

    /**
     * Use Drag Reorder - Finish drag.
     *
     * Drops the held row where it is when the pointer is released or cancelled.
     * The list's owner saves the new order from its drop handler.
     *
     * @since UNRELEASED
     */
    const finishDrag = (): void => {
      setDraggingID(null);
      onDropRef.current();
    };

    window.addEventListener('pointermove', followDrag);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);

    return (): void => {
      window.removeEventListener('pointermove', followDrag);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };
  }, [
    draggingID,
    listRef,
  ]);

  useEffect((): void => {
    const id: string | null = focusIDRef.current;

    if (id === null) {
      return;
    }

    // React can move the row's element to its new place, which drops focus, so put it back.
    focusIDRef.current = null;
    Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-reorder-id]') ?? [])
      .find((row): boolean => row.dataset['reorderId'] === id)
      ?.querySelector<HTMLElement>('.reorder-handle')
      ?.focus();
  });

  return {
    announcement,
    draggingID,
    handleKeyDown: (event, id, index, count, label): void => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
        return;
      }

      event.preventDefault();

      const destinationIndex: number = index + ((event.key === 'ArrowUp') ? -1 : 1);

      if (destinationIndex < 0 || destinationIndex >= count) {
        return;
      }

      focusIDRef.current = id;
      onMoveRef.current(id, destinationIndex);
      onDropRef.current();
      setAnnouncement(`${label} moved to position ${String(destinationIndex + 1)} of ${String(count)}.`);
    },
    handlePointerDown: (event, id): void => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      setDraggingID(id);
    },
  };
};
