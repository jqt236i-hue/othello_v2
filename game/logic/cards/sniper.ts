// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

import type { CardState, GameState, PlayerKey } from '../../../src/types';

const res = options.BoardOps.revertSpecialStoneAt(
                    cardState,
                    gameState,
                    row,
                    col,
                    'SNIPER',
                    playerKey,
                    'SNIPER_WILL',
                    'anchor_expired'
                );
                revertedRes = !!(res && res.reverted);

export = sniper;
