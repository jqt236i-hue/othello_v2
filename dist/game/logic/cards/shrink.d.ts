/**
 * @file shrink.ts
 * @description Board shrink helpers (Shared between Browser and Headless)
 */
import { CardState, GameState } from '../../../src/types';
interface Target {
    row: number;
    col: number;
}
interface ShrinkDeps {
    getCellValueForCard?(gameState: GameState, row: number, col: number): number | null;
    destroyAt?(cardState: CardState, gameState: GameState, row: number, col: number, cardType: string, destroyReason: string, options: any): any;
    isDestroyResolved?(result: any): boolean;
    clearStoneIdAtForCard?(cardState: CardState, gameState: GameState, row: number, col: number): void;
    setCellValueForCard?(gameState: GameState, row: number, col: number, value: number): boolean;
    removeMarkersAt?(cardState: CardState, row: number, col: number): void;
    addMarker?(cardState: CardState, kind: string, row: number, col: number, playerKey: string, data: any): boolean;
    isAbsoluteProtectedCell?(cardState: CardState, row: number, col: number): boolean;
    isFrozenCell?(cardState: CardState, row: number, col: number): boolean;
    random?: {
        random(): number;
    };
    getBoardShrinkTargets?(cardState: CardState, gameState: GameState, playerKey: string): Target[];
    getBoardShrinkGodTargets?(cardState: CardState, gameState: GameState, playerKey: string): Array<Target & {
        lineCells?: Target[];
        lineKey?: string;
    }>;
}
interface ShrinkResult {
    applied: boolean;
    reason?: string;
    completed?: boolean;
    selectedCount?: number;
    maxSelections?: number;
    remainingSelections?: number;
    target?: Target;
    selectedTargets?: Target[];
    changedTargets?: Target[];
    skippedTargets?: Array<Target & {
        reason: string;
    }>;
    firstTarget?: Target;
    lineKey?: string | null;
    lineTargets?: Target[];
    source?: Target;
}
declare function getBoardShrinkPendingSelectionsForCard(pending: any): Target[];
declare function applyBoardShrinkWill(cardState: CardState, gameState: GameState, playerKey: string, row: number, col: number, deps: ShrinkDeps): ShrinkResult;
declare function applyBoardShrinkGod(cardState: CardState, gameState: GameState, playerKey: string, row: number, col: number, deps: ShrinkDeps): ShrinkResult;
declare const _default: {
    BOARD_SHRINK_SELECTION_COUNT: number;
    getBoardShrinkPendingSelectionsForCard: typeof getBoardShrinkPendingSelectionsForCard;
    applyBoardShrinkWill: typeof applyBoardShrinkWill;
    applyBoardShrinkGod: typeof applyBoardShrinkGod;
};
export = _default;
//# sourceMappingURL=shrink.d.ts.map