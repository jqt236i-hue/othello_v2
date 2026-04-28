/**
 * @file swap_with_enemy.ts
 * @description SWAP_WITH_ENEMY helper - TypeScript module for browser and Node.js
 */
interface SwapResult {
    swapped: boolean;
    flipped?: {
        row: number;
        col: number;
    }[];
}
interface SwapDeps {
    BoardOps?: any;
    clearHyperactiveAtPositions?: (cardState: any, positions: {
        row: number;
        col: number;
    }[]) => void;
    clearBombAt?: (cardState: any, row: number, col: number) => void;
    Core?: any;
    cardContext?: any;
    emitPresentationEvent?: (cardState: any, event: any) => void;
}
declare function applySwapWithEnemy(cardState: any, gameState: any, playerKey: string, row: number, col: number, deps?: SwapDeps): SwapResult;
declare const _default: {
    applySwapWithEnemy: typeof applySwapWithEnemy;
};
export = _default;
//# sourceMappingURL=swap_with_enemy.d.ts.map