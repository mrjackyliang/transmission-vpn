import type { Web_PieceMap_Square } from '@/types/web/piece-map.d.ts';

/**
 * Piece Map - Decode pieces.
 *
 * Reads Transmission's base64 bitfield of the pieces this daemon has. The first piece is
 * the highest bit of the first byte, and a damaged field reads as nothing downloaded.
 *
 * @since 2.0.0
 */
export const decodePieces = (bitfield: string, pieceCount: number): boolean[] => {
  let bytes: string = '';

  try {
    bytes = atob(bitfield);
  } catch {
    bytes = '';
  }

  return Array.from({ length: pieceCount }, (_value: unknown, index: number): boolean => {
    const byte: number = bytes.charCodeAt(Math.floor(index / 8));

    return !Number.isNaN(byte) && Math.floor(byte / (2 ** (7 - (index % 8)))) % 2 === 1;
  });
};

/**
 * Piece Map - Pieces per square.
 *
 * Groups pieces so the map stays within its row limit at the width it has.
 * Small torrents keep one piece per square.
 *
 * @since 2.0.0
 */
export const piecesPerSquare = (pieceCount: number, columns: number, maximumRows: number = 10): number => Math.max(
  1,
  Math.ceil(pieceCount / (Math.max(1, columns) * maximumRows)),
);

/**
 * Piece Map - Summarize squares.
 *
 * Folds each run of pieces into one square: how many are here, how many peers have its
 * rarest missing piece, and how many missing pieces no connected peer has.
 *
 * @since 2.0.0
 */
export const summarizeSquares = (
  have: boolean[],
  availability: number[] | undefined,
  perSquare: number,
): Web_PieceMap_Square[] => {
  const squares: Web_PieceMap_Square[] = [];

  for (let first = 0; first < have.length; first += perSquare) {
    const last: number = Math.min(have.length, first + perSquare);
    let owned: number = 0;
    let rarest: number | null = null;
    let unavailable: number = 0;

    for (let index = first; index < last; index += 1) {
      const peers: number | undefined = availability?.[index];

      if (have[index] === true) {
        owned += 1;
      } else if (peers !== undefined && peers >= 0) {
        rarest = (rarest === null) ? peers : Math.min(rarest, peers);

        if (peers === 0) {
          unavailable += 1;
        }
      }
    }

    const share: number = owned / (last - first);
    let level: Web_PieceMap_Square['level'] = 0;

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
 * Piece Map - Describe square.
 *
 * Words for one square's tooltip: which pieces it holds, how many are here, and where the
 * rest can come from.
 *
 * @since 2.0.0
 */
export const describeSquare = (square: Web_PieceMap_Square): [string, string] => {
  const title: string = (square['total'] === 1) ? `Piece ${square['first'].toLocaleString()}` : `Pieces ${square['first'].toLocaleString()}–${square['last'].toLocaleString()}`;

  if (square['owned'] === square['total']) {
    return [
      title,
      (square['total'] === 1) ? 'You have it' : `You have all ${String(square['total'])}`,
    ];
  }

  const owned: string = `You have ${String(square['owned'])} of ${String(square['total'])}`;

  if (square['unavailable'] > 0) {
    return [
      title,
      `${owned} · no connected peer has ${(square['unavailable'] === 1) ? '1 of them' : `${String(square['unavailable'])} of them`}`,
    ];
  }

  if (square['rarest'] === null) {
    return [
      title,
      owned,
    ];
  }

  return [
    title,
    `${owned} · the rest are on at least ${String(square['rarest'])} ${(square['rarest'] === 1) ? 'peer' : 'peers'}`,
  ];
};
