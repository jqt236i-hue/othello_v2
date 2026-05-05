/**
 * @file meteor.ts
 * @description Meteor Will effects wrapper (delegates to game/logic/cards/meteor.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import MeteorModule = require('../../logic/cards/meteor');

interface MeteorExports {
  applyMeteorWill: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    deps?: Record<string, unknown>
  ) => any;
}

const effectExports: MeteorExports = {
  applyMeteorWill: MeteorModule.applyMeteorWill
};

export = effectExports;
