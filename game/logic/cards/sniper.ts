declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

import type { CardState, GameState, PlayerKey } from '../../../src/types';

<<<<<<< Updated upstream
// These are provided externally (template context)
declare const options: { BoardOps: { revertSpecialStoneAt: Function } };
declare let cardState: CardState;
declare let gameState: GameState;
declare let row: number;
declare let col: number;
declare let playerKey: PlayerKey;
declare let revertedRes: boolean;

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
=======
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

const sniper = { handleSniperAnchorExpiry };
>>>>>>> Stashed changes

// sniper is provided as a global by the build system (esbuild-banner.js)
declare const sniper: any;

export = sniper;
