/**
 * @file trap.ts
 * @description Trap Will effects
 */
import type { CardState, GameState, PlayerKey } from '../../../src/types';
declare function applyTrapWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: any): Record<string, any>;
declare function processTrapEffects(cardState: CardState, gameState: GameState, activePlayerKey: PlayerKey, options: any, deps: any): Record<string, any>;
declare const _default: {
    applyTrapWill: typeof applyTrapWill;
    processTrapEffects: typeof processTrapEffects;
};
export = _default;
//# sourceMappingURL=trap.d.ts.map