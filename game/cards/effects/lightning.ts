/**
 * @file lightning.ts
 * @description Lightning Will effects wrapper (delegates to game/logic/cards/lightning.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import LightningModule = require('../../logic/cards/lightning');

type LightningEffectsDeps = Record<string, unknown>;

interface LightningDestroyedPosition {
  row: number;
  col: number;
  sourceRow: number;
  sourceCol: number;
}

interface LightningExpiredPosition {
  row: number;
  col: number;
  owner: PlayerKey;
  reason: string;
}

interface LightningProcessResult {
  destroyed: LightningDestroyedPosition[];
  anchors: Array<{ row: number; col: number; remainingNow: number }>;
  expired: LightningExpiredPosition[];
}

interface LightningEffectsExports {
  processLightningWillEffects(cardState: CardState, gameState: GameState, playerKey: PlayerKey, deps?: LightningEffectsDeps): LightningProcessResult;
  processLightningWillEffectsAtAnchor(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps?: LightningEffectsDeps): LightningProcessResult;
  processLightningWillEffectsAtTurnStartAnchor(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps?: LightningEffectsDeps): LightningProcessResult;
}

const _exports: LightningEffectsExports = {
  processLightningWillEffects: LightningModule.processLightningWillEffects as unknown as LightningEffectsExports['processLightningWillEffects'],
  processLightningWillEffectsAtAnchor: LightningModule.processLightningWillEffectsAtAnchor as unknown as LightningEffectsExports['processLightningWillEffectsAtAnchor'],
  processLightningWillEffectsAtTurnStartAnchor: LightningModule.processLightningWillEffectsAtTurnStartAnchor as unknown as LightningEffectsExports['processLightningWillEffectsAtTurnStartAnchor']
};

export = _exports;
