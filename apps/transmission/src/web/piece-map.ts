import type {
  Web_PieceMap_DecodePieces_Bitfield,
  Web_PieceMap_DecodePieces_Byte,
  Web_PieceMap_DecodePieces_Bytes,
  Web_PieceMap_DecodePieces_PieceCount,
  Web_PieceMap_DecodePieces_Returns,
  Web_PieceMap_DescribeSquare_Owned,
  Web_PieceMap_DescribeSquare_PeerLabel,
  Web_PieceMap_DescribeSquare_Returns,
  Web_PieceMap_DescribeSquare_Square,
  Web_PieceMap_DescribeSquare_Title,
  Web_PieceMap_DescribeSquare_UnavailableLabel,
  Web_PieceMap_PiecesPerSquare_Columns,
  Web_PieceMap_PiecesPerSquare_MaximumRows,
  Web_PieceMap_PiecesPerSquare_PieceCount,
  Web_PieceMap_PiecesPerSquare_Returns,
  Web_PieceMap_SummarizeSquares_Availability,
  Web_PieceMap_SummarizeSquares_Have,
  Web_PieceMap_SummarizeSquares_Last,
  Web_PieceMap_SummarizeSquares_Level,
  Web_PieceMap_SummarizeSquares_Owned,
  Web_PieceMap_SummarizeSquares_Peers,
  Web_PieceMap_SummarizeSquares_PerSquare,
  Web_PieceMap_SummarizeSquares_Rarest,
  Web_PieceMap_SummarizeSquares_Returns,
  Web_PieceMap_SummarizeSquares_Share,
  Web_PieceMap_SummarizeSquares_Squares,
  Web_PieceMap_SummarizeSquares_Unavailable,
} from '@/types/web/piece-map.d.ts';

/**
 * Piece Map - Decode Pieces.
 *
 * Reads Transmission's base64 bitfield of the pieces this daemon has. The first piece is
 * the highest bit of the first byte, and a damaged field reads as nothing downloaded.
 *
 * @param {Web_PieceMap_DecodePieces_Bitfield}   bitfield   - Bitfield.
 * @param {Web_PieceMap_DecodePieces_PieceCount} pieceCount - Piece count.
 *
 * @returns {Web_PieceMap_DecodePieces_Returns}
 *
 * @since 2.0.0
 */
export const decodePieces = (bitfield: Web_PieceMap_DecodePieces_Bitfield, pieceCount: Web_PieceMap_DecodePieces_PieceCount): Web_PieceMap_DecodePieces_Returns => {
  let bytes: Web_PieceMap_DecodePieces_Bytes = '';

  try {
    bytes = atob(bitfield);
  } catch {
    bytes = '';
  }

  return Array.from({ length: pieceCount }, (_value, index) => {
    const byte: Web_PieceMap_DecodePieces_Byte = bytes.charCodeAt(Math.floor(index / 8));

    return Number.isNaN(byte) === false && Math.floor(byte / (2 ** (7 - (index % 8)))) % 2 === 1;
  });
};

/**
 * Piece Map - Pieces Per Square.
 *
 * Groups pieces so the map stays within its row limit at the width it has.
 * Small torrents keep one piece per square.
 *
 * @param {Web_PieceMap_PiecesPerSquare_PieceCount}  pieceCount    - Piece count.
 * @param {Web_PieceMap_PiecesPerSquare_Columns}     columns       - Columns.
 * @param {Web_PieceMap_PiecesPerSquare_MaximumRows} [maximumRows] - Maximum rows.
 *
 * @returns {Web_PieceMap_PiecesPerSquare_Returns}
 *
 * @since 2.0.0
 */
export const piecesPerSquare = (pieceCount: Web_PieceMap_PiecesPerSquare_PieceCount, columns: Web_PieceMap_PiecesPerSquare_Columns, maximumRows: Web_PieceMap_PiecesPerSquare_MaximumRows = 10): Web_PieceMap_PiecesPerSquare_Returns => Math.max(
  1,
  Math.ceil(pieceCount / (Math.max(1, columns) * maximumRows)),
);

/**
 * Piece Map - Summarize Squares.
 *
 * Folds each run of pieces into one square: how many are here, how many peers have its
 * rarest missing piece, and how many missing pieces no connected peer has.
 *
 * @param {Web_PieceMap_SummarizeSquares_Have}         have         - Have.
 * @param {Web_PieceMap_SummarizeSquares_Availability} availability - Availability.
 * @param {Web_PieceMap_SummarizeSquares_PerSquare}    perSquare    - Per square.
 *
 * @returns {Web_PieceMap_SummarizeSquares_Returns}
 *
 * @since 2.0.0
 */
export const summarizeSquares = (
  have: Web_PieceMap_SummarizeSquares_Have,
  availability: Web_PieceMap_SummarizeSquares_Availability,
  perSquare: Web_PieceMap_SummarizeSquares_PerSquare,
): Web_PieceMap_SummarizeSquares_Returns => {
  const squares: Web_PieceMap_SummarizeSquares_Squares = [];

  for (let first = 0; first < have.length; first += perSquare) {
    const last: Web_PieceMap_SummarizeSquares_Last = Math.min(have.length, first + perSquare);
    let owned: Web_PieceMap_SummarizeSquares_Owned = 0;
    let rarest: Web_PieceMap_SummarizeSquares_Rarest = null;
    let unavailable: Web_PieceMap_SummarizeSquares_Unavailable = 0;

    for (let index = first; index < last; index += 1) {
      const peers: Web_PieceMap_SummarizeSquares_Peers = (availability !== undefined) ? availability[index] : undefined;

      if (have[index] === true) {
        owned += 1;
      } else if (peers !== undefined && peers >= 0) {
        rarest = (rarest === null) ? peers : Math.min(rarest, peers);

        if (peers === 0) {
          unavailable += 1;
        }
      }
    }

    const share: Web_PieceMap_SummarizeSquares_Share = owned / (last - first);
    let level: Web_PieceMap_SummarizeSquares_Level = 0;

    if (share === 1) {
      level = 4;
    } else if (share >= 2 / 3) {
      level = 3;
    } else if (share >= 1 / 3) {
      level = 2;
    } else if (share > 0) {
      level = 1;
    }

    squares.push({
      first: first + 1,
      last,
      level,
      owned,
      rarest,
      total: last - first,
      unavailable,
    });
  }

  return squares;
};

/**
 * Piece Map - Describe Square.
 *
 * Words for one square's tooltip: which pieces it holds, how many are here, and where the
 * rest can come from.
 *
 * @param {Web_PieceMap_DescribeSquare_Square} square - Square.
 *
 * @returns {Web_PieceMap_DescribeSquare_Returns}
 *
 * @since 2.0.0
 */
export const describeSquare = (square: Web_PieceMap_DescribeSquare_Square): Web_PieceMap_DescribeSquare_Returns => {
  const title: Web_PieceMap_DescribeSquare_Title = (square['total'] === 1) ? `Piece ${square['first'].toLocaleString()}` : `Pieces ${square['first'].toLocaleString()}–${square['last'].toLocaleString()}`;

  if (square['owned'] === square['total']) {
    return [
      title,
      (square['total'] === 1) ? 'You have it' : `You have all ${String(square['total'])}`,
    ];
  }

  const owned: Web_PieceMap_DescribeSquare_Owned = `You have ${String(square['owned'])} of ${String(square['total'])}`;

  if (square['unavailable'] > 0) {
    const unavailableLabel: Web_PieceMap_DescribeSquare_UnavailableLabel = (square['unavailable'] === 1) ? '1 of them' : `${String(square['unavailable'])} of them`;

    return [
      title,
      `${owned} · no connected peer has ${unavailableLabel}`,
    ];
  }

  if (square['rarest'] === null) {
    return [
      title,
      owned,
    ];
  }

  const peerLabel: Web_PieceMap_DescribeSquare_PeerLabel = (square['rarest'] === 1) ? 'peer' : 'peers';

  return [
    title,
    `${owned} · the rest are on at least ${String(square['rarest'])} ${peerLabel}`,
  ];
};
