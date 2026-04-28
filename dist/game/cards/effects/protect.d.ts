/**
 * @file protect.ts
 * @description Protection effects: Strong Will, Absolute Protect, Guard Will
 */
import type { CardState, GameState, PlayerKey } from '../../../src/types';
declare function applyStrongWill(cardState: CardState, playerKey: PlayerKey, row: number, col: number, deps: any): Record<string, any>;
declare function applyAbsoluteProtect(cardState: CardState, playerKey: PlayerKey, row: number, col: number, deps: any): Record<string, any>;
declare function applyGuardWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: any): Record<string, any>;
declare const _default: {
    applyStrongWill: typeof applyStrongWill;
    applyAbsoluteProtect: typeof applyAbsoluteProtect;
    applyGuardWill: typeof applyGuardWill;
};
export = _default;
//# sourceMappingURL=protect.d.ts.map