declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

import type { CardState, GameState, PlayerKey } from '../../../src/types';

interface BoardOps {
    revertSpecialStoneAt(cardState: any, gameState: any, row: number, col: number, type: string, owner: string, willType: string, reason: string): { reverted: boolean } | null;
}

function handleSniperAnchorExpiry(options: { BoardOps: BoardOps }, cardState: any, gameState: any, row: number, col: number, playerKey: string): boolean {
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
    return !!(res && res.reverted);
}

// These functions are provided by the runtime JS module, but we declare them here for the wrapper
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sniper: Record<string, any> = { handleSniperAnchorExpiry };

export = sniper;
