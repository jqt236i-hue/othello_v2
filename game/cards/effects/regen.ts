/**
 * @file regen.ts
 * @description Regen Will effects wrapper (delegates to game/logic/cards/regen.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import * as RegenModule from '../../logic/cards/regen';

interface RegenExports {
  applyRegenWill: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
  applyRegenAfterFlips: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
}

const exports: RegenExports = {
  applyRegenWill: RegenModule.applyRegenWill,
  applyRegenAfterFlips: RegenModule.applyRegenAfterFlips
};

export = exports;
