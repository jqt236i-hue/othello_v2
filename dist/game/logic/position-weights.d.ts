/**
 * @file position-weights.ts
 * @description 盤面位置評価マトリックス（ブラウザ/Headless共通）
 */
declare function getPositionScore(row: number, col: number, boardOrRows: number | number[][], maybeCols?: number): number;
declare function isCorner(row: number, col: number, boardOrRows: number | number[][], maybeCols?: number): boolean;
declare function isEdge(row: number, col: number, boardOrRows: number | number[][], maybeCols?: number): boolean;
declare function isXSquare(row: number, col: number, boardOrRows: number | number[][], maybeCols?: number): boolean;
declare function isCSquare(row: number, col: number, boardOrRows: number | number[][], maybeCols?: number): boolean;
declare const _default: {
    POSITION_WEIGHTS: number[][];
    getPositionScore: typeof getPositionScore;
    isCorner: typeof isCorner;
    isEdge: typeof isEdge;
    isXSquare: typeof isXSquare;
    isCSquare: typeof isCSquare;
};
export = _default;
//# sourceMappingURL=position-weights.d.ts.map