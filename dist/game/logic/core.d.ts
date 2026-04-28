/**
 * @file core.ts
 * @description Core Othello Logic (Shared between Browser and Headless)
 * Pure functions only. No UI dependencies.
 */
interface ExpansionCell {
    side: string | null;
    row: number;
    col: number;
    owner: number;
}
interface PendingRoundBonus {
    roundNumber: number;
    amount: number;
}
interface Move {
    row: number;
    col: number;
    flips: [number, number][];
}
interface DiscCount {
    black: number;
    white: number;
}
declare function ensureRoundState(state: any): any;
declare function resolveRoundBonusAmount(roundNumber: number): number;
declare function advanceRoundAfterCompletedTurn(state: any, player: any, options?: any): {
    advanced: boolean;
    roundNumber: number;
    pendingRoundBonus: PendingRoundBonus | null;
};
declare function consumePendingRoundBonus(state: any): PendingRoundBonus | null;
declare function getExpansionCells(state: any): ExpansionCell[];
declare function createGameState(boardConfigInput?: any): any;
declare function copyGameState(state: any): any;
interface FlipContext {
    protectedStones?: {
        row: number;
        col: number;
    }[];
    permaProtectedStones?: {
        row: number;
        col: number;
    }[];
    blockedCells?: {
        row: number;
        col: number;
    }[];
}
declare function getFlipsWithContext(state: any, row: number, col: number, player: number, context?: FlipContext): [number, number][];
declare function applyMove(state: any, move: Move): any;
declare function applyPass(state: any): any;
declare function isGameOver(state: any): boolean;
declare function countDiscs(state: any): DiscCount;
declare function getLegalMoves(state: any, player: number, context?: FlipContext): Move[];
declare function getFreePlacementMoves(state: any, player: number, context?: FlipContext): Move[];
declare function hasLegalMove(state: any, player: number, context?: FlipContext): boolean;
declare const _default: {
    BLACK: any;
    WHITE: any;
    EMPTY: any;
    DIRECTIONS: any;
    createGameState: typeof createGameState;
    copyGameState: typeof copyGameState;
    ensureRoundState: typeof ensureRoundState;
    resolveRoundBonusAmount: typeof resolveRoundBonusAmount;
    advanceRoundAfterCompletedTurn: typeof advanceRoundAfterCompletedTurn;
    consumePendingRoundBonus: typeof consumePendingRoundBonus;
    getExpansionCells: typeof getExpansionCells;
    getFlipsWithContext: typeof getFlipsWithContext;
    applyMove: typeof applyMove;
    applyPass: typeof applyPass;
    isGameOver: typeof isGameOver;
    countDiscs: typeof countDiscs;
    getLegalMoves: typeof getLegalMoves;
    getFreePlacementMoves: typeof getFreePlacementMoves;
    hasLegalMove: typeof hasLegalMove;
};
export = _default;
//# sourceMappingURL=core.d.ts.map