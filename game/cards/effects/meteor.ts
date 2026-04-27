/**
 * @file meteor.ts
 * @description Meteor Will effects wrapper (delegates to game/logic/cards/meteor.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import * as MeteorModule from '../../logic/cards/meteor';

interface MeteorExports {
  applyMeteorWill: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
}

const exports: MeteorExports = {
  applyMeteorWill: MeteorModule.applyMeteorWill
};

export = exports;
