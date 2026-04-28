/**
 * @file meteor.ts
 * @description Meteor Will effects wrapper (delegates to game/logic/cards/meteor.js)
 */
import type { CardState, GameState, PlayerKey } from '../../../src/types';
interface MeteorExports {
    applyMeteorWill: (cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps?: Record<string, unknown>) => any;
}
declare const exports: MeteorExports;
export = exports;
//# sourceMappingURL=meteor.d.ts.map