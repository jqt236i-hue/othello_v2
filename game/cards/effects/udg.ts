/**
 * @file udg.ts
 * @description Ultimate Destroy God (UDG) effects wrapper (delegates to game/logic/cards/udg.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import * as UdgModule from '../../logic/cards/udg';

interface UdgExports {
  processUltimateDestroyGodEffects: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
  processUltimateDestroyGodEffectsAtAnchor: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
  processUltimateDestroyGodEffectsAtTurnStartAnchor: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
}

const exports: UdgExports = {
  processUltimateDestroyGodEffects: UdgModule.processUltimateDestroyGodEffects,
  processUltimateDestroyGodEffectsAtAnchor: UdgModule.processUltimateDestroyGodEffectsAtAnchor,
  processUltimateDestroyGodEffectsAtTurnStartAnchor: UdgModule.processUltimateDestroyGodEffectsAtTurnStartAnchor
};

export = exports;
