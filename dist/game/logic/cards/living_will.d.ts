/**
 * @file living_will.ts
 * @description Living Will effects (Shared between Browser and Headless)
 */
import type { CardState, GameState, PlayerKey } from '../../../src/types';
interface LivingWillDeps {
    BoardOps?: any;
    random?: any;
    defaultPrng?: any;
    defaults?: any;
    readCardPendingEffect?: (state: CardState, owner: PlayerKey) => any;
    clearCardPendingEffect?: (state: CardState, owner: PlayerKey) => void;
    getLivingWillTargets?: (cardState: CardState, gameState: GameState, playerKey: PlayerKey) => any[];
}
declare function findLivingWillMarkerAt(cardState: CardState, row: number, col: number): any;
declare function shouldTriggerForSpecialLoss(livingWillMarker: any, specialType: string): boolean;
interface RestoreTrigger {
    sourceRow?: number;
    sourceCol?: number;
    cause?: string;
    reason?: string;
    relocated?: boolean;
}
interface CellPosition {
    row: number;
    col: number;
}
interface RestoreResult {
    restored: boolean;
    consumed: boolean;
    reason?: string;
    source?: CellPosition;
    destination?: CellPosition;
    owner?: PlayerKey;
    relocated?: boolean;
}
interface LivingWillTrigger extends RestoreTrigger {
    triggerKind?: string;
    flippedBy?: PlayerKey | null;
}
declare function restoreFromLivingWillSnapshot(cardState: CardState, gameState: GameState, livingWillMarker: any, trigger: LivingWillTrigger, deps?: LivingWillDeps): RestoreResult;
interface ApplyLivingWillResult {
    applied: boolean;
    reason?: string;
    row?: number;
    col?: number;
    markerId?: number | null;
    baselineOwner?: PlayerKey;
}
declare function applyLivingWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps?: LivingWillDeps): ApplyLivingWillResult;
interface ApplyLivingWillAfterFlipsResult {
    restored: CellPosition[];
}
declare function applyLivingWillAfterFlips(cardState: CardState, gameState: GameState, flips: any[], flipperKey: PlayerKey, deps?: LivingWillDeps): ApplyLivingWillAfterFlipsResult;
declare const _default: {
    applyLivingWill: typeof applyLivingWill;
    applyLivingWillAfterFlips: typeof applyLivingWillAfterFlips;
    findLivingWillMarkerAt: typeof findLivingWillMarkerAt;
    shouldTriggerForSpecialLoss: typeof shouldTriggerForSpecialLoss;
    restoreFromLivingWillSnapshot: typeof restoreFromLivingWillSnapshot;
};
export = _default;
//# sourceMappingURL=living_will.d.ts.map