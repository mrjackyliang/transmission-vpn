import type {
  Dispatch,
  ReactElement,
  RefObject,
  SetStateAction,
} from 'react';

import type { Web_PieceMap_Square } from '@/types/web/piece-map.d.ts';

/**
 * Piece Map Section.
 *
 * @since 2.4.1
 */
export type Web_PieceMapSection_PieceMapSection_Props = {
  availability: number[] | undefined;
  peersConnected: number;
  pieceCount: number | undefined;
  pieceSize: number | undefined;
  pieces: string | undefined;
};
export type Web_PieceMapSection_PieceMapSection_Returns = ReactElement;
export type Web_PieceMapSection_PieceMapSection_Availability = number[] | undefined;
export type Web_PieceMapSection_PieceMapSection_PeersConnected = number;
export type Web_PieceMapSection_PieceMapSection_PieceCount = number | undefined;
export type Web_PieceMapSection_PieceMapSection_PieceSize = number | undefined;
export type Web_PieceMapSection_PieceMapSection_Pieces = string | undefined;
export type Web_PieceMapSection_PieceMapSection_Section = HTMLElement | null;
export type Web_PieceMapSection_PieceMapSection_SectionRef = RefObject<Web_PieceMapSection_PieceMapSection_Section>;
export type Web_PieceMapSection_PieceMapSection_Grid = HTMLDivElement | null;
export type Web_PieceMapSection_PieceMapSection_GridRef = RefObject<Web_PieceMapSection_PieceMapSection_Grid>;
export type Web_PieceMapSection_PieceMapSection_TipElement = HTMLDivElement | null;
export type Web_PieceMapSection_PieceMapSection_TipRef = RefObject<Web_PieceMapSection_PieceMapSection_TipElement>;
export type Web_PieceMapSection_PieceMapSection_Columns = number;
export type Web_PieceMapSection_PieceMapSection_SetColumns = Dispatch<SetStateAction<Web_PieceMapSection_PieceMapSection_Columns>>;
export type Web_PieceMapSection_PieceMapSection_ColumnsState = [Web_PieceMapSection_PieceMapSection_Columns, Web_PieceMapSection_PieceMapSection_SetColumns];
export type Web_PieceMapSection_PieceMapSection_HoveredSquare = number | null;
export type Web_PieceMapSection_PieceMapSection_SetHoveredSquare = Dispatch<SetStateAction<Web_PieceMapSection_PieceMapSection_HoveredSquare>>;
export type Web_PieceMapSection_PieceMapSection_HoveredSquareState = [Web_PieceMapSection_PieceMapSection_HoveredSquare, Web_PieceMapSection_PieceMapSection_SetHoveredSquare];
export type Web_PieceMapSection_PieceMapSection_TipPosition_Left = number;
export type Web_PieceMapSection_PieceMapSection_TipPosition_Top = number;
export type Web_PieceMapSection_PieceMapSection_TipPosition = {
  left: Web_PieceMapSection_PieceMapSection_TipPosition_Left;
  top: Web_PieceMapSection_PieceMapSection_TipPosition_Top;
} | null;
export type Web_PieceMapSection_PieceMapSection_SetTipPosition = Dispatch<SetStateAction<Web_PieceMapSection_PieceMapSection_TipPosition>>;
export type Web_PieceMapSection_PieceMapSection_TipPositionState = [Web_PieceMapSection_PieceMapSection_TipPosition, Web_PieceMapSection_PieceMapSection_SetTipPosition];
export type Web_PieceMapSection_PieceMapSection_Count = number;
export type Web_PieceMapSection_PieceMapSection_Have = boolean[];
export type Web_PieceMapSection_PieceMapSection_PerSquare = number;
export type Web_PieceMapSection_PieceMapSection_Squares = Web_PieceMap_Square[];
export type Web_PieceMapSection_PieceMapSection_Measure_Returns = void;
export type Web_PieceMapSection_PieceMapSection_Measure = () => Web_PieceMapSection_PieceMapSection_Measure_Returns;
export type Web_PieceMapSection_PieceMapSection_Observer = ResizeObserver;
export type Web_PieceMapSection_PieceMapSection_Square = HTMLElement | null | undefined;
export type Web_PieceMapSection_PieceMapSection_Owned = number;
export type Web_PieceMapSection_PieceMapSection_Hovered = Web_PieceMap_Square | undefined;
export type Web_PieceMapSection_PieceMapSection_Tip = [string, string] | null;
export type Web_PieceMapSection_PieceMapSection_PieceSizeLabel = string;
export type Web_PieceMapSection_PieceMapSection_Target = EventTarget;

/**
 * Piece Map Section.
 *
 * @since 2.4.1
 */
export type Web_PieceMapSection_SquareGap = number;

/**
 * Piece Map Section.
 *
 * @since 2.4.1
 */
export type Web_PieceMapSection_SquareSize = number;
