import {
  describe,
  expect,
  it,
} from 'vitest';

import { placeListedID } from '../src/web/use-drag-reorder.ts';

describe('drag reorder', (): void => {
  it('moves a row by its listed place and keeps unlisted IDs last', (): void => {
    const listed: Set<string> = new Set([
      'a',
      'b',
      'c',
    ]);
    const order: string[] = [
      'a',
      'b',
      'c',
    ];

    expect(placeListedID(order, listed, 'a', 2)).toEqual([
      'b',
      'c',
      'a',
    ]);
    expect(placeListedID(order, listed, 'c', 0)).toEqual([
      'c',
      'a',
      'b',
    ]);
    expect(placeListedID([
      'a',
      'gone',
      'b',
      'c',
    ], listed, 'c', 1)).toEqual([
      'a',
      'c',
      'b',
      'gone',
    ]);
    expect(placeListedID(order, listed, 'a', -1)).toBe(order);
    expect(placeListedID(order, listed, 'c', 3)).toBe(order);
    expect(placeListedID(order, listed, 'gone', 0)).toBe(order);
  });
});
