import { GameState } from '../../../src/types';
interface MovementResult {
    applied: boolean;
    reason?: string;
    from?: {
        row: number;
        col: number;
    };
    to?: {
        row: number;
        col: number;
    };
    direction?: number[];
    movedDistance?: number;
    chargeGained?: number;
    destroyed?: Array<{
        row: number;
        col: number;
    }>;
    destroyedCount?: number;
    failedAt?: {
        row: number;
        col: number;
    };
}
declare function applyStrongWindWill(cardState: any, gameState: GameState, playerKey: string, row: number, col: number, prng: any, deps?: any): MovementResult;
declare function applySuperBuoyancyWill(cardState: any, gameState: GameState, playerKey: string, row: number, col: number, deps?: any): MovementResult;
declare function applySuperGravityWill(cardState: any, gameState: GameState, playerKey: string, row: number, col: number, deps?: any): MovementResult;
declare const _default: {
    applyStrongWindWill: typeof applyStrongWindWill;
    applySuperBuoyancyWill: typeof applySuperBuoyancyWill;
    applySuperGravityWill: typeof applySuperGravityWill;
};
export = _default;
//# sourceMappingURL=movement.d.ts.map