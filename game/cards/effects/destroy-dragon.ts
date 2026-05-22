/**
 * @file destroy-dragon.ts
 * @description Destroy Dragon effects wrapper (delegates to game/logic/cards/destroy_dragon.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import DestroyDragonModule = require('../../logic/cards/destroy_dragon');

type DestroyDragonEffectsDeps = Record<string, unknown>;

interface DestroyDragonDestroyedPosition {
  row: number;
  col: number;
  sourceRow: number;
  sourceCol: number;
}

interface DestroyDragonExpiredPosition {
  row: number;
  col: number;
  owner: PlayerKey;
  reason: string;
}

interface DestroyDragonProcessResult {
  destroyed: DestroyDragonDestroyedPosition[];
  anchors: Array<{ row: number; col: number; remainingNow: number }>;
  expired: DestroyDragonExpiredPosition[];
}

interface DestroyDragonEffectsExports {
  processDestroyDragonEffects(cardState: CardState, gameState: GameState, playerKey: PlayerKey, deps?: DestroyDragonEffectsDeps): DestroyDragonProcessResult;
  processDestroyDragonEffectsAtAnchor(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps?: DestroyDragonEffectsDeps): DestroyDragonProcessResult;
  processDestroyDragonEffectsAtTurnStartAnchor(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps?: DestroyDragonEffectsDeps): DestroyDragonProcessResult;
}

const _exports: DestroyDragonEffectsExports = {
  processDestroyDragonEffects: DestroyDragonModule.processDestroyDragonEffects as unknown as DestroyDragonEffectsExports['processDestroyDragonEffects'],
  processDestroyDragonEffectsAtAnchor: DestroyDragonModule.processDestroyDragonEffectsAtAnchor as unknown as DestroyDragonEffectsExports['processDestroyDragonEffectsAtAnchor'],
  processDestroyDragonEffectsAtTurnStartAnchor: DestroyDragonModule.processDestroyDragonEffectsAtTurnStartAnchor as unknown as DestroyDragonEffectsExports['processDestroyDragonEffectsAtTurnStartAnchor']
};

export = _exports;
