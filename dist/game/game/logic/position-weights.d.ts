declare function getPositionScore(row: number, col: number, boardOrRows?: any, maybeCols?: number): number;
declare function isCorner(row: number, col: number, boardOrRows?: any, maybeCols?: number): boolean;
declare function isEdge(row: number, col: number, boardOrRows?: any, maybeCols?: number): boolean;
declare function isXSquare(row: number, col: number, boardOrRows?: any, maybeCols?: number): boolean;
declare function isCSquare(row: number, col: number, boardOrRows?: any, maybeCols?: number): boolean;
declare const PositionWeights: {
    POSITION_WEIGHTS: number[][];
    getPositionScore: typeof getPositionScore;
    isCorner: typeof isCorner;
    isEdge: typeof isEdge;
    isXSquare: typeof isXSquare;
    isCSquare: typeof isCSquare;
};
export = PositionWeights;
//# sourceMappingURL=position-weights.d.ts.map