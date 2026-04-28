/**
 * @file targets.ts
 * @description Card target selection helpers (Shared between Browser and Headless)
 */
import { GameState } from '../../../src/types';
declare function getTemptWillTargets(cardState: any, gameState: GameState, playerKey: string): Array<{
    row: number;
    col: number;
}>;
declare function getCaptureWillTargets(cardState: any, gameState: GameState, playerKey: string): Array<{
    row: number;
    col: number;
}>;
declare const _default: {
    getTemptWillTargets: typeof getTemptWillTargets;
    getCaptureWillTargets: typeof getCaptureWillTargets;
};
export = _default;
//# sourceMappingURL=targets.d.ts.map