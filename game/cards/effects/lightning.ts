/**
 * @file lightning.ts
 * @description Lightning Will effects wrapper (delegates to game/logic/cards/lightning.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import * as LightningModule from '../../logic/cards/lightning';

interface LightningExports {
  processLightningWillEffects: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
  processLightningWillEffectsAtAnchor: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
  processLightningWillEffectsAtTurnStartAnchor: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
}

const exports: LightningExports = {
  processLightningWillEffects: LightningModule.processLightningWillEffects,
  processLightningWillEffectsAtAnchor: LightningModule.processLightningWillEffectsAtAnchor,
  processLightningWillEffectsAtTurnStartAnchor: LightningModule.processLightningWillEffectsAtTurnStartAnchor
};

export = exports;
