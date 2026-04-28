/**
 * @file board-utils.ts
 * @description Board utility functions shared across modules
 */
import { Board, PlayerValue, DiscCount } from '../src/types';
/**
 * Count discs on the board.
 */
declare function countDiscs(board: Board): DiscCount;
/**
 * Count discs by player value.
 */
declare function countDiscsByPlayer(board: Board, playerValue: PlayerValue): {
    own: number;
    opp: number;
    empties: number;
};
/**
 * Get board dimensions.
 */
declare function getBoardSize(board: Board): {
    rows: number;
    cols: number;
} | null;
declare const _default: {
    countDiscs: typeof countDiscs;
    countDiscsByPlayer: typeof countDiscsByPlayer;
    getBoardSize: typeof getBoardSize;
};
export = _default;
//# sourceMappingURL=board-utils.d.ts.map