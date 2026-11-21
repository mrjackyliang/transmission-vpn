import type {
  Dispatch,
  KeyboardEvent,
  PointerEvent,
  RefObject,
  SetStateAction,
} from 'react';

/**
 * Use Drag Reorder.
 *
 * @since 2.4.1
 */
export type Web_UseDragReorder_PlaceListedID_Ids = string[];
export type Web_UseDragReorder_PlaceListedID_Listed = Pick<ReadonlySet<string>, 'has'>;
export type Web_UseDragReorder_PlaceListedID_Id = string;
export type Web_UseDragReorder_PlaceListedID_DestinationIndex = number;
export type Web_UseDragReorder_PlaceListedID_Returns = string[];
export type Web_UseDragReorder_PlaceListedID_ListedIDs = string[];
export type Web_UseDragReorder_PlaceListedID_Others = string[];
export type Web_UseDragReorder_PlaceListedID_Index = number;

/**
 * Use Drag Reorder.
 *
 * @since 2.0.0
 */
export type Web_UseDragReorder_Result = {
  announcement: string;
  draggingID: string | null;
  handleKeyDown: (event: KeyboardEvent<HTMLElement>, id: string, index: number, count: number, label: string) => void;
  handlePointerDown: (event: PointerEvent<HTMLElement>, id: string) => void;
};

/**
 * Use Drag Reorder.
 *
 * @since 2.4.1
 */
export type Web_UseDragReorder_UseDragReorder_ListRef = RefObject<HTMLElement | null>;
export type Web_UseDragReorder_UseDragReorder_OnMove = (id: string, destinationIndex: number) => void;
export type Web_UseDragReorder_UseDragReorder_OnDrop = () => void;
export type Web_UseDragReorder_UseDragReorder_Returns = Web_UseDragReorder_Result;
export type Web_UseDragReorder_UseDragReorder_DraggingID = string | null;
export type Web_UseDragReorder_UseDragReorder_SetDraggingID = Dispatch<SetStateAction<Web_UseDragReorder_UseDragReorder_DraggingID>>;
export type Web_UseDragReorder_UseDragReorder_DraggingIDState = [Web_UseDragReorder_UseDragReorder_DraggingID, Web_UseDragReorder_UseDragReorder_SetDraggingID];
export type Web_UseDragReorder_UseDragReorder_Announcement = string;
export type Web_UseDragReorder_UseDragReorder_SetAnnouncement = Dispatch<SetStateAction<Web_UseDragReorder_UseDragReorder_Announcement>>;
export type Web_UseDragReorder_UseDragReorder_AnnouncementState = [Web_UseDragReorder_UseDragReorder_Announcement, Web_UseDragReorder_UseDragReorder_SetAnnouncement];
export type Web_UseDragReorder_UseDragReorder_OnMoveRef = RefObject<Web_UseDragReorder_UseDragReorder_OnMove>;
export type Web_UseDragReorder_UseDragReorder_OnDropRef = RefObject<Web_UseDragReorder_UseDragReorder_OnDrop>;
export type Web_UseDragReorder_UseDragReorder_FocusID = string | null;
export type Web_UseDragReorder_UseDragReorder_FocusIDRef = RefObject<Web_UseDragReorder_UseDragReorder_FocusID>;
export type Web_UseDragReorder_UseDragReorder_FollowDrag_Event = globalThis.PointerEvent;
export type Web_UseDragReorder_UseDragReorder_FollowDrag_Returns = void;
export type Web_UseDragReorder_UseDragReorder_FollowDrag = (event: Web_UseDragReorder_UseDragReorder_FollowDrag_Event) => Web_UseDragReorder_UseDragReorder_FollowDrag_Returns;
export type Web_UseDragReorder_UseDragReorder_FollowDrag_List = HTMLElement | null;
export type Web_UseDragReorder_UseDragReorder_FollowDrag_Rows = HTMLElement[];
export type Web_UseDragReorder_UseDragReorder_FollowDrag_DestinationIndex = number;
export type Web_UseDragReorder_UseDragReorder_FollowDrag_Rect = DOMRect;
export type Web_UseDragReorder_UseDragReorder_FinishDrag_Returns = void;
export type Web_UseDragReorder_UseDragReorder_FinishDrag = () => Web_UseDragReorder_UseDragReorder_FinishDrag_Returns;
export type Web_UseDragReorder_UseDragReorder_Id = string | null;
export type Web_UseDragReorder_UseDragReorder_List = HTMLElement | null;
export type Web_UseDragReorder_UseDragReorder_Rows = HTMLElement[];
export type Web_UseDragReorder_UseDragReorder_Row = HTMLElement | undefined;
export type Web_UseDragReorder_UseDragReorder_Handle = HTMLElement | null;
export type Web_UseDragReorder_UseDragReorder_DestinationIndex = number;
