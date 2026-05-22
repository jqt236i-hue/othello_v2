/**
 * @file sniper.ts
 * @description Sniper Will effects wrapper (delegates to game/logic/cards/sniper.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import SniperModule = require('../../logic/cards/sniper');

type SniperEffectsDeps = Record<string, unknown>;

interface SniperDestroyedPosition {
  row: number;
  col: number;
  sourceRow: number;
  sourceCol: number;
}

interface SniperExpiredPosition {
  row: number;
  col: number;
  owner: PlayerKey;
  reason: string;
}

interface SniperProcessResult {
  destroyed: SniperDestroyedPosition[];
  anchors: Array<{ row: number; col: number; remainingNow: number }>;
  expired: SniperExpiredPosition[];
}

interface SniperTurnStartResult {
  destroyed: SniperDestroyedPosition[];
  expired: SniperExpiredPosition[];
}

interface SniperEffectsExports {
  processSniperWillEffects(cardState: CardState, gameState: GameState, playerKey: PlayerKey, deps?: SniperEffectsDeps): SniperProcessResult;
  processSniperWillEffectsAtTurnStartAnchor(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps?: SniperEffectsDeps): SniperTurnStartResult;
}

const _exports: SniperEffectsExports = {
  processSniperWillEffects: SniperModule.processSniperWillEffects as unknown as SniperEffectsExports['processSniperWillEffects'],
  processSniperWillEffectsAtTurnStartAnchor: SniperModule.processSniperWillEffectsAtTurnStartAnchor as unknown as SniperEffectsExports['processSniperWillEffectsAtTurnStartAnchor']
};

export = _exports;
