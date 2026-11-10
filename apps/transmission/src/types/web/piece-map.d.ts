/**
 * Piece Map.
 *
 * @since 2.0.0
 */
export type Web_PieceMap_Square = {
  first: number;
  last: number;
  level: 0 | 1 | 2 | 3 | 4;
  owned: number;
  rarest: number | null;
  total: number;
  unavailable: number;
};

/**
 * Piece Map.
 *
 * @since 2.0.0
 */
export type Web_PieceMap_Props = {
  availability: number[] | undefined;
  peersConnected: number;
  pieceCount: number | undefined;
  pieceSize: number | undefined;
  pieces: string | undefined;
};

/**
 * Piece Map.
 *
 * @since 2.0.0
 */
export type Web_PieceMap_TipPosition = {
  left: number;
  top: number;
};
