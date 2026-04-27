/**
 * @file sniper.ts
 * @description Sniper Will effects wrapper (delegates to game/logic/cards/sniper.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import * as SniperModule from '../../logic/cards/sniper';

interface SniperExports {
  processSniperWillEffects: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
  processSniperWillEffectsAtTurnStartAnchor: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
}

const exports: SniperExports = {
  processSniperWillEffects: SniperModule.processSniperWillEffects,
  processSniperWillEffectsAtTurnStartAnchor: SniperModule.processSniperWillEffectsAtTurnStartAnchor
};

export = exports;
