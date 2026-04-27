/**
 * @file hyperactive.ts
 * @description Hyperactive effects wrapper (delegates to game/logic/cards/hyperactive.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import * as HyperactiveModule from '../../logic/cards/hyperactive';

interface HyperactiveExports {
  applyHyperactiveInheritWill: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
}

const exports: HyperactiveExports = {
  applyHyperactiveInheritWill: HyperactiveModule.applyHyperactiveInheritWill
};

export = exports;
