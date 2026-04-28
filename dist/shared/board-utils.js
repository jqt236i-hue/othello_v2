"use strict";
/**
 * @file board-utils.ts
 * @description Board utility functions shared across modules
 */
const SharedConstants = require('../shared-constants');
const EMPTY = Number.isFinite(Number(SharedConstants && SharedConstants.EMPTY))
    ? Number(SharedConstants.EMPTY)
    : 0;
const BLACK = Number.isFinite(Number(SharedConstants && SharedConstants.BLACK))
    ? Number(SharedConstants.BLACK)
    : 1;
const WHITE = Number.isFinite(Number(SharedConstants && SharedConstants.WHITE))
    ? Number(SharedConstants.WHITE)
    : -1;
/**
 * Count discs on the board.
 */
function countDiscs(board) {
    const rows = Array.isArray(board) ? board : [];
    let black = 0;
    let white = 0;
    for (let row = 0; row < rows.length; row++) {
        const line = Array.isArray(rows[row]) ? rows[row] : [];
        for (let col = 0; col < line.length; col++) {
            const value = Number(line[col]);
            if (value === BLACK)
                black += 1;
            else if (value === WHITE)
                white += 1;
        }
    }
    return { black, white };
}
/**
 * Count discs by player value.
 */
function countDiscsByPlayer(board, playerValue) {
    if (!Array.isArray(board))
        return { own: 0, opp: 0, empties: 0 };
    let own = 0;
    let opp = 0;
    let empties = 0;
    for (let r = 0; r < board.length; r++) {
        const row = Array.isArray(board[r]) ? board[r] : [];
        for (let c = 0; c < row.length; c++) {
            const v = row[c];
            if (v === playerValue)
                own += 1;
            else if (v === -playerValue)
                opp += 1;
            else if (v === EMPTY)
                empties += 1;
        }
    }
    return { own, opp, empties };
}
/**
 * Get board dimensions.
 */
function getBoardSize(board) {
    if (!Array.isArray(board) || board.length <= 0)
        return null;
    let cols = 0;
    for (const row of board) {
        if (Array.isArray(row))
            cols = Math.max(cols, row.length);
    }
    if (cols <= 0)
        return null;
    return { rows: board.length, cols };
}
module.exports = {
    countDiscs,
    countDiscsByPlayer,
    getBoardSize
};
//# sourceMappingURL=board-utils.js.map