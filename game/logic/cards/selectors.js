/**
 * @file selectors.js
 * @description Card selectable-target helpers (Shared between Browser and Headless)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'), require('./utils'));
    } else {
        root.CardSelectors = factory(root.SharedConstants, root.CardUtils);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants, CardUtils) {
    'use strict';

    const { EMPTY } = SharedConstants || {};

    if (EMPTY === undefined) {
        throw new Error('SharedConstants not loaded');
    }

    // Return all non-empty cells (for DESTROY_ONE_STONE)
    function getDestroyTargets(cardState, gameState) {
        const res = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] !== EMPTY) res.push({ row: r, col: c });
            }
        }
        return res;
    }

    // Return swap targets: opponent stones excluding protected/bomb
    function getSwapTargets(cardState, gameState, playerKey) {
        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        const opponentVal = (playerKey === 'black') ? (SharedConstants.BLACK) * -1 : (SharedConstants.WHITE) * -1; // not used, we'll just compare values

        const protectedSet = new Set(
            (cardState.markers || [])
                .filter(m => m.kind === 'specialStone' && m.data && (m.data.type === 'PROTECTED' || m.data.type === 'PERMA_PROTECTED' || m.data.type === 'DRAGON' || m.data.type === 'BREEDING' || m.data.type === 'ULTIMATE_DESTROY_GOD'))
                .map(m => `${m.row},${m.col}`)
        );
        const bombSet = new Set((cardState.markers || []).filter(m => m.kind === 'bomb').map(m => `${m.row},${m.col}`));

        const res = [];
        const opVal = playerKey === 'black' ? SharedConstants.WHITE : SharedConstants.BLACK;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] !== opVal) continue;
                const key = `${r},${c}`;
                if (protectedSet.has(key) || bombSet.has(key)) continue;
                res.push({ row: r, col: c });
            }
        }
        return res;
    }

    // Return sacrifice targets: own stones (normal/special both allowed)
    function getSacrificeTargets(cardState, gameState, playerKey) {
        const res = [];
        const playerVal = playerKey === 'black' ? SharedConstants.BLACK : SharedConstants.WHITE;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] === playerVal) {
                    res.push({ row: r, col: c });
                }
            }
        }
        return res;
    }

    // Return inherit targets: normal stones for player (uses CardUtils if available)
    function getInheritTargets(cardState, gameState, playerKey) {
        if (CardUtils && typeof CardUtils.isNormalStoneForPlayer === 'function') {
            const res = [];
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    if (CardUtils.isNormalStoneForPlayer(cardState, gameState, playerKey, r, c)) {
                        res.push({ row: r, col: c });
                    }
                }
            }
            return res;
        }
        // Fallback: replicate minimal logic
        const res = [];
        const playerVal = playerKey === 'black' ? SharedConstants.BLACK : SharedConstants.WHITE;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] !== playerVal) continue;
                const markers = cardState.markers || [];
                if (markers.some(m => m.kind === 'specialStone' && m.row === r && m.col === c)) continue;
                if (markers.some(m => m.kind === 'bomb' && m.row === r && m.col === c)) continue;
                res.push({ row: r, col: c });
            }
        }
        return res;
    }

    function _getStrongWindDirectionDestination(gameState, row, col, dr, dc) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) return null;
        if (gameState.board[nr][nc] !== EMPTY) return null;

        let tr = nr;
        let tc = nc;
        while (true) {
            const rr = tr + dr;
            const cc = tc + dc;
            if (rr < 0 || rr >= 8 || cc < 0 || cc >= 8) break;
            if (gameState.board[rr][cc] !== EMPTY) break;
            tr = rr;
            tc = cc;
        }
        return { row: tr, col: tc };
    }

    // Return strong-wind targets: any non-empty stone that has at least one movable orthogonal direction.
    function getStrongWindTargets(cardState, gameState) {
        const dirs = [
            { dr: -1, dc: 0 },
            { dr: 1, dc: 0 },
            { dr: 0, dc: -1 },
            { dr: 0, dc: 1 }
        ];
        const res = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] === EMPTY) continue;
                let movable = false;
                for (const d of dirs) {
                    if (_getStrongWindDirectionDestination(gameState, r, c, d.dr, d.dc)) {
                        movable = true;
                        break;
                    }
                }
                if (movable) res.push({ row: r, col: c });
            }
        }
        return res;
    }

    return {
        getDestroyTargets,
        getSwapTargets,
        getInheritTargets,
        getSacrificeTargets,
        getStrongWindTargets
    };
}));
