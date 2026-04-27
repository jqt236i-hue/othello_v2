/**
 * @file teleport.ts
 * @description Teleport effects wrapper (delegates to game/logic/cards/teleport.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import * as TeleportModule from '../../logic/cards/teleport';

interface TeleportExports {
  applyTeleportWill: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    prng?: unknown,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
  applyCellTeleportWill: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    prng?: unknown,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
}

const exports: TeleportExports = {
  applyTeleportWill: TeleportModule.applyTeleportWill,
  applyCellTeleportWill: TeleportModule.applyCellTeleportWill
};

export = exports;
