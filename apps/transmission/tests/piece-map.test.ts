import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  decodePieces,
  describeSquare,
  piecesPerSquare,
  summarizeSquares,
} from '../src/web/piece-map.ts';

describe('piece map', (): void => {
  it('reads Transmission\'s bitfield with the first piece in the highest bit', (): void => {
    // Bytes 10100000 and 10000000 → pieces 1, 3, and 9 are here.
    const bitfield: string = btoa(String.fromCharCode(parseInt('10100000', 2), parseInt('10000000', 2)));

    expect(decodePieces(bitfield, 10)).toEqual([
      true,
      false,
      true,
      false,
      false,
      false,
      false,
      false,
      true,
      false,
    ]);
    expect(decodePieces('not base64!', 3)).toEqual([
      false,
      false,
      false,
    ]);
  });

  it('groups pieces to stay within ten rows', (): void => {
    expect(piecesPerSquare(500, 59)).toBe(1);
    expect(piecesPerSquare(3104, 59)).toBe(6);
    expect(piecesPerSquare(3104, 31)).toBe(11);
    expect(piecesPerSquare(10, 0)).toBe(1);
  });

  it('shades each square by how much of it is here and flags pieces no peer has', (): void => {
    const squares = summarizeSquares([
      true,
      true,
      true,
      false,
      false,
      false,
      true,
      false,
      true,
    ], [
      -1,
      -1,
      -1,
      3,
      0,
      2,
      -1,
      5,
      -1,
    ], 3);

    expect(squares.map((square): number => square['level'])).toEqual([
      4,
      0,
      3,
    ]);
    expect(squares[1]).toMatchObject({
      first: 4,
      last: 6,
      owned: 0,
      rarest: 0,
      unavailable: 1,
    });
    expect(squares[2]).toMatchObject({
      owned: 2,
      rarest: 5,
      unavailable: 0,
    });
  });

  it('describes a square for its tooltip', (): void => {
    expect(describeSquare({
      first: 1201,
      last: 1206,
      level: 3,
      owned: 4,
      rarest: 9,
      total: 6,
      unavailable: 0,
    })).toEqual([
      'Pieces 1,201–1,206',
      'You have 4 of 6 · the rest are on at least 9 peers',
    ]);
    expect(describeSquare({
      first: 7,
      last: 7,
      level: 0,
      owned: 0,
      rarest: 0,
      total: 1,
      unavailable: 1,
    })).toEqual([
      'Piece 7',
      'You have 0 of 1 · no connected peer has 1 of them',
    ]);
  });
});
