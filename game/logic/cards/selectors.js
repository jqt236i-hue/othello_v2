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
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] === EMPTY) continue;
                const guarded = markers.some(m =>
                    m &&
                    m.kind === 'specialStone' &&
                    m.row === r &&
                    m.col === c &&
                    m.data &&
                    m.data.type === 'GUARD'
                );
                if (guarded) continue;
                res.push({ row: r, col: c });
            }
        }
        return res;
    }

    // Return swap targets: opponent NORMAL stones only (no special markers, no bombs)
    function getSwapTargets(cardState, gameState, playerKey) {
        const res = [];
        const opVal = playerKey === 'black' ? SharedConstants.WHITE : SharedConstants.BLACK;
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const isHiddenTrapForPlayer = (m) => (
            m &&
            m.kind === 'specialStone' &&
            m.data &&
            m.data.type === 'TRAP' &&
            m.owner &&
            m.owner !== playerKey
        );

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] !== opVal) continue;
                const hasSpecialOrBomb = markers.some(m => {
                    if (!m || m.row !== r || m.col !== c) return false;
                    if (m.kind === 'bomb') return true;
                    if (m.kind !== 'specialStone') return false;
                    if (isHiddenTrapForPlayer(m)) return false;
                    return true;
                });
                if (hasSpecialOrBomb) continue;
                res.push({ row: r, col: c });
            }
        }
        return res;
    }

    // Return position-swap targets: any occupied cell; if first target exists, exclude it.
    function getPositionSwapTargets(cardState, gameState, playerKey, pending) {
        const res = [];
        const first = pending && pending.firstTarget ? pending.firstTarget : null;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] === EMPTY) continue;
                if (first && first.row === r && first.col === c) continue;
                res.push({ row: r, col: c });
            }
        }
        return res;
    }

    // Return sacrifice targets: own stones (normal/special both allowed)
    function getSacrificeTargets(cardState, gameState, playerKey) {
        const res = [];
        const playerVal = playerKey === 'black' ? SharedConstants.BLACK : SharedConstants.WHITE;
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] === playerVal) {
                    const guarded = markers.some(m =>
                        m &&
                        m.kind === 'specialStone' &&
                        m.row === r &&
                        m.col === c &&
                        m.data &&
                        m.data.type === 'GUARD'
                    );
                    if (guarded) continue;
                    res.push({ row: r, col: c });
                }
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

    // Return trap targets: own stones (including special stones), excluding bombs/own existing trap.
    function getTrapTargets(cardState, gameState, playerKey) {
        const res = [];
        const playerVal = playerKey === 'black' ? SharedConstants.BLACK : SharedConstants.WHITE;
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] !== playerVal) continue;
                const hasBomb = markers.some(m => m && m.row === r && m.col === c && m.kind === 'bomb');
                if (hasBomb) continue;
                const hasOwnTrap = markers.some(m => (
                    m &&
                    m.row === r &&
                    m.col === c &&
                    m.kind === 'specialStone' &&
                    m.owner === playerKey &&
                    m.data &&
                    m.data.type === 'TRAP'
                ));
                if (hasOwnTrap) continue;
                res.push({ row: r, col: c });
            }
        }
        return res;
    }

    // Return guard targets: own stones (normal/special both allowed), excluding bombs.
    function getGuardTargets(cardState, gameState, playerKey) {
        const res = [];
        const playerVal = playerKey === 'black' ? SharedConstants.BLACK : SharedConstants.WHITE;
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] !== playerVal) continue;
                const hasBomb = markers.some(m => m && m.row === r && m.col === c && m.kind === 'bomb');
                if (hasBomb) continue;
                res.push({ row: r, col: c });
            }
        }
        return res;
    }

    // Return time-bomb targets: own stones (normal/special both allowed), excluding bombs.
    function getTimeBombTargets(cardState, gameState, playerKey) {
        return getGuardTargets(cardState, gameState, playerKey);
    }

    return {
        getDestroyTargets,
        getSwapTargets,
        getPositionSwapTargets,
        getSacrificeTargets,
        getStrongWindTargets,
        getTrapTargets,
        getGuardTargets,
        getTimeBombTargets
    };
}));
