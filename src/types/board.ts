/**
 * Board-related type definitions
 */

export type BoardValue = 1 | -1 | 0; // BLACK | WHITE | EMPTY
export type Board = BoardValue[][];

export interface CellPosition {
  row: number;
  col: number;
}

export interface BoardConfig {
  rows: number;
  cols: number;
  standard8x8: boolean;
  baseBounds: {
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
  };
  outerBounds: {
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
  };
}

export interface StonePlacement {
  row: number;
  col: number;
  owner: import('./player').PlayerKey;
}

export type Direction = [number, number];

export const DIRECTIONS: Direction[] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1]
];

export const ORTHOGONAL_DIRECTIONS: Direction[] = [
  [-1, 0], [1, 0], [0, -1], [0, 1]
];

export interface DiscCount {
  black: number;
  white: number;
}