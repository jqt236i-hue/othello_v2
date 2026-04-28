/**
 * Board-related type definitions
 */
export type BoardValue = 1 | -1 | 0;
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
export declare const DIRECTIONS: Direction[];
export declare const ORTHOGONAL_DIRECTIONS: Direction[];
export interface DiscCount {
    black: number;
    white: number;
}
//# sourceMappingURL=board.d.ts.map