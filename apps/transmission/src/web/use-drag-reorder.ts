import {
  useEffect,
  useRef,
  useState,
} from 'react';

import type {
  Web_UseDragReorder_PlaceListedID_DestinationIndex,
  Web_UseDragReorder_PlaceListedID_Id,
  Web_UseDragReorder_PlaceListedID_Ids,
  Web_UseDragReorder_PlaceListedID_Index,
  Web_UseDragReorder_PlaceListedID_Listed,
  Web_UseDragReorder_PlaceListedID_ListedIDs,
  Web_UseDragReorder_PlaceListedID_Others,
  Web_UseDragReorder_PlaceListedID_Returns,
  Web_UseDragReorder_UseDragReorder_Announcement,
  Web_UseDragReorder_UseDragReorder_AnnouncementState,
  Web_UseDragReorder_UseDragReorder_DestinationIndex,
  Web_UseDragReorder_UseDragReorder_DraggingID,
  Web_UseDragReorder_UseDragReorder_DraggingIDState,
  Web_UseDragReorder_UseDragReorder_FinishDrag,
  Web_UseDragReorder_UseDragReorder_FinishDrag_Returns,
  Web_UseDragReorder_UseDragReorder_FocusID,
  Web_UseDragReorder_UseDragReorder_FocusIDRef,
  Web_UseDragReorder_UseDragReorder_FollowDrag,
  Web_UseDragReorder_UseDragReorder_FollowDrag_DestinationIndex,
  Web_UseDragReorder_UseDragReorder_FollowDrag_Event,
  Web_UseDragReorder_UseDragReorder_FollowDrag_List,
  Web_UseDragReorder_UseDragReorder_FollowDrag_Rect,
  Web_UseDragReorder_UseDragReorder_FollowDrag_Returns,
  Web_UseDragReorder_UseDragReorder_FollowDrag_Rows,
  Web_UseDragReorder_UseDragReorder_Handle,
  Web_UseDragReorder_UseDragReorder_Id,
  Web_UseDragReorder_UseDragReorder_List,
  Web_UseDragReorder_UseDragReorder_ListRef,
  Web_UseDragReorder_UseDragReorder_OnDrop,
  Web_UseDragReorder_UseDragReorder_OnDropRef,
  Web_UseDragReorder_UseDragReorder_OnMove,
  Web_UseDragReorder_UseDragReorder_OnMoveRef,
  Web_UseDragReorder_UseDragReorder_Returns,
  Web_UseDragReorder_UseDragReorder_Row,
  Web_UseDragReorder_UseDragReorder_Rows,
  Web_UseDragReorder_UseDragReorder_SetAnnouncement,
  Web_UseDragReorder_UseDragReorder_SetDraggingID,
} from '@/types/web/use-drag-reorder.d.ts';

/**
 * Use Drag Reorder - Place Listed ID.
 *
 * Moves one listed item to a new place in an ordered list of IDs. Places count only the
 * listed items, and IDs missing from the list stay after them.
 *
 * @param {Web_UseDragReorder_PlaceListedID_Ids}              ids              - Ids.
 * @param {Web_UseDragReorder_PlaceListedID_Listed}           listed           - Listed.
 * @param {Web_UseDragReorder_PlaceListedID_Id}               id               - Id.
 * @param {Web_UseDragReorder_PlaceListedID_DestinationIndex} destinationIndex - Destination index.
 *
 * @returns {Web_UseDragReorder_PlaceListedID_Returns}
 *
 * @since 2.0.0
 */
export const placeListedID = (
  ids: Web_UseDragReorder_PlaceListedID_Ids,
  listed: Web_UseDragReorder_PlaceListedID_Listed,
  id: Web_UseDragReorder_PlaceListedID_Id,
  destinationIndex: Web_UseDragReorder_PlaceListedID_DestinationIndex,
): Web_UseDragReorder_PlaceListedID_Returns => {
  const listedIDs: Web_UseDragReorder_PlaceListedID_ListedIDs = ids.filter((currentID) => listed.has(currentID));
  const others: Web_UseDragReorder_PlaceListedID_Others = listedIDs.filter((listedID) => listedID !== id);
  const index: Web_UseDragReorder_PlaceListedID_Index = Math.min(Math.max(destinationIndex, 0), others.length);

  if (listed.has(id) === false || listedIDs.indexOf(id) === index) {
    return ids;
  }

  return [
    ...others.slice(0, index),
    id,
    ...others.slice(index),
    ...ids.filter((currentID) => listed.has(currentID) === false),
  ];
};

/**
 * Use Drag Reorder - Use Drag Reorder.
 *
 * Reorders a list's rows by dragging a grip handle or pressing the up and down arrow keys on
 * it. Rows carry `data-reorder-id` and their handle the `reorder-handle` class. Each move
 * reports the row's new place, and the drop ending each change lets a saved list save once.
 *
 * @param {Web_UseDragReorder_UseDragReorder_ListRef} listRef  - List ref.
 * @param {Web_UseDragReorder_UseDragReorder_OnMove}  onMove   - On move.
 * @param {Web_UseDragReorder_UseDragReorder_OnDrop}  [onDrop] - On drop.
 *
 * @returns {Web_UseDragReorder_UseDragReorder_Returns}
 *
 * @since 2.0.0
 */
export const useDragReorder = (
  listRef: Web_UseDragReorder_UseDragReorder_ListRef,
  onMove: Web_UseDragReorder_UseDragReorder_OnMove,
  onDrop: Web_UseDragReorder_UseDragReorder_OnDrop = () => undefined,
): Web_UseDragReorder_UseDragReorder_Returns => {
  const draggingIDState: Web_UseDragReorder_UseDragReorder_DraggingIDState = useState<Web_UseDragReorder_UseDragReorder_DraggingID>(null);
  const draggingID: Web_UseDragReorder_UseDragReorder_DraggingID = draggingIDState[0];
  const setDraggingID: Web_UseDragReorder_UseDragReorder_SetDraggingID = draggingIDState[1];
  const announcementState: Web_UseDragReorder_UseDragReorder_AnnouncementState = useState<Web_UseDragReorder_UseDragReorder_Announcement>('');
  const announcement: Web_UseDragReorder_UseDragReorder_Announcement = announcementState[0];
  const setAnnouncement: Web_UseDragReorder_UseDragReorder_SetAnnouncement = announcementState[1];
  const onMoveRef: Web_UseDragReorder_UseDragReorder_OnMoveRef = useRef<Web_UseDragReorder_UseDragReorder_OnMove>(onMove);
  const onDropRef: Web_UseDragReorder_UseDragReorder_OnDropRef = useRef<Web_UseDragReorder_UseDragReorder_OnDrop>(onDrop);
  const focusIDRef: Web_UseDragReorder_UseDragReorder_FocusIDRef = useRef<Web_UseDragReorder_UseDragReorder_FocusID>(null);

  useEffect(() => {
    onMoveRef.current = onMove;
    onDropRef.current = onDrop;

    return;
  });

  useEffect(() => {
    if (draggingID === null) {
      return undefined;
    }

    /**
     * Use Drag Reorder - Follow Drag.
     *
     * Moves the held row past every row whose middle the pointer has crossed. Window
     * listeners keep the drag alive while React moves the held row's element.
     *
     * @param {Web_UseDragReorder_UseDragReorder_FollowDrag_Event} event - Event.
     *
     * @returns {Web_UseDragReorder_UseDragReorder_FollowDrag_Returns}
     *
     * @since 2.0.0
     */
    const followDrag: Web_UseDragReorder_UseDragReorder_FollowDrag = (event: Web_UseDragReorder_UseDragReorder_FollowDrag_Event): Web_UseDragReorder_UseDragReorder_FollowDrag_Returns => {
      const list: Web_UseDragReorder_UseDragReorder_FollowDrag_List = listRef.current;
      const rows: Web_UseDragReorder_UseDragReorder_FollowDrag_Rows = Array.from((list !== null) ? list.querySelectorAll<HTMLElement>('[data-reorder-id]') : []);
      const destinationIndex: Web_UseDragReorder_UseDragReorder_FollowDrag_DestinationIndex = rows.filter((row) => {
        const rect: Web_UseDragReorder_UseDragReorder_FollowDrag_Rect = row.getBoundingClientRect();

        return row.dataset['reorderId'] !== draggingID && event.clientY > rect.top + (rect.height / 2);
      }).length;

      onMoveRef.current(draggingID, destinationIndex);

      return;
    };

    /**
     * Use Drag Reorder - Finish Drag.
     *
     * Drops the held row where it is when the pointer is released or cancelled.
     * The list's owner saves the new order from its drop handler.
     *
     * @returns {Web_UseDragReorder_UseDragReorder_FinishDrag_Returns}
     *
     * @since 2.0.0
     */
    const finishDrag: Web_UseDragReorder_UseDragReorder_FinishDrag = (): Web_UseDragReorder_UseDragReorder_FinishDrag_Returns => {
      setDraggingID(null);

      onDropRef.current();

      return;
    };

    window.addEventListener('pointermove', followDrag);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);

    return () => {
      window.removeEventListener('pointermove', followDrag);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);

      return;
    };
  }, [
    draggingID,
    listRef,
  ]);

  useEffect(() => {
    const id: Web_UseDragReorder_UseDragReorder_Id = focusIDRef.current;

    if (id === null) {
      return;
    }

    // React can move the row's element to its new place, which drops focus, so put it back.
    focusIDRef.current = null;

    const list: Web_UseDragReorder_UseDragReorder_List = listRef.current;
    const rows: Web_UseDragReorder_UseDragReorder_Rows = Array.from((list !== null) ? list.querySelectorAll<HTMLElement>('[data-reorder-id]') : []);
    const row: Web_UseDragReorder_UseDragReorder_Row = rows.find((currentRow) => currentRow.dataset['reorderId'] === id);

    if (row === undefined) {
      return;
    }

    const handle: Web_UseDragReorder_UseDragReorder_Handle = row.querySelector<HTMLElement>('.reorder-handle');

    if (handle === null) {
      return;
    }

    handle.focus();

    return;
  });

  return {
    announcement,
    draggingID,
    handleKeyDown: (event, id, index, count, label) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
        return;
      }

      event.preventDefault();

      const destinationIndex: Web_UseDragReorder_UseDragReorder_DestinationIndex = index + ((event.key === 'ArrowUp') ? -1 : 1);

      if (destinationIndex < 0 || destinationIndex >= count) {
        return;
      }

      focusIDRef.current = id;

      onMoveRef.current(id, destinationIndex);

      onDropRef.current();

      setAnnouncement(`${label} moved to position ${String(destinationIndex + 1)} of ${String(count)}.`);

      return;
    },
    handlePointerDown: (event, id) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();

      setDraggingID(id);

      return;
    },
  };
};
