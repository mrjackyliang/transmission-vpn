/**
 * Piece Map.
 *
 * @since 2.4.1
 */
export type Web_PieceMap_DecodePieces_Bitfield = string;
export type Web_PieceMap_DecodePieces_PieceCount = number;
export type Web_PieceMap_DecodePieces_Returns = boolean[];
export type Web_PieceMap_DecodePieces_Bytes = string;
export type Web_PieceMap_DecodePieces_Byte = number;

/**
 * Piece Map.
 *
 * @since 2.4.1
 */
export type Web_PieceMap_DescribeSquare_Square = Web_PieceMap_Square;
export type Web_PieceMap_DescribeSquare_Returns = [string, string];
export type Web_PieceMap_DescribeSquare_Title = string;
export type Web_PieceMap_DescribeSquare_Owned = string;
export type Web_PieceMap_DescribeSquare_UnavailableLabel = string;
export type Web_PieceMap_DescribeSquare_PeerLabel = string;

/**
 * Piece Map.
 *
 * @since 2.4.1
 */
export type Web_PieceMap_PiecesPerSquare_PieceCount = number;
export type Web_PieceMap_PiecesPerSquare_Columns = number;
export type Web_PieceMap_PiecesPerSquare_MaximumRows = number;
export type Web_PieceMap_PiecesPerSquare_Returns = number;

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
 * @since 2.4.1
 */
export type Web_PieceMap_SummarizeSquares_Have = boolean[];
export type Web_PieceMap_SummarizeSquares_Availability = number[] | undefined;
export type Web_PieceMap_SummarizeSquares_PerSquare = number;
export type Web_PieceMap_SummarizeSquares_Returns = Web_PieceMap_Square[];
export type Web_PieceMap_SummarizeSquares_Squares = Web_PieceMap_Square[];
export type Web_PieceMap_SummarizeSquares_Last = number;
export type Web_PieceMap_SummarizeSquares_Owned = number;
export type Web_PieceMap_SummarizeSquares_Rarest = number | null;
export type Web_PieceMap_SummarizeSquares_Unavailable = number;
export type Web_PieceMap_SummarizeSquares_Peers = number | undefined;
export type Web_PieceMap_SummarizeSquares_Share = number;
export type Web_PieceMap_SummarizeSquares_Level = Web_PieceMap_Square['level'];
