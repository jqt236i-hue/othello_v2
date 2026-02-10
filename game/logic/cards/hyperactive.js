/**
 * @file hyperactive.js
 * @description Hyperactive effect helpers (Shared between Browser and Headless)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.CardHyperactive = factory(root.SharedConstants);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants) {
    'use strict';

    const { BLACK, WHITE, EMPTY } = SharedConstants || {};
    const ORTHO_DIRS = [
        { dr: -1, dc: 0 }, // up
        { dr: 0, dc: 1 },  // right
        { dr: 1, dc: 0 },  // down
        { dr: 0, dc: -1 }  // left
    ];

    function clearUltimateHyperactiveAtPositions(cardState, positions) {
        if (!cardState || !Array.isArray(cardState.markers)) return;
        const removeSet = new Set((positions || []).map(p => `${p.row},${p.col}`));
        cardState.markers = cardState.markers.filter(m => {
            if (!m || m.kind !== 'specialStone') return true;
            if (!m.data || m.data.type !== 'ULTIMATE_HYPERACTIVE') return true;
            return !removeSet.has(`${m.row},${m.col}`);
        });
    }

    function moveMarkersAt(cardState, fromRow, fromCol, toRow, toCol) {
        if (!cardState || !Array.isArray(cardState.markers)) return;
        for (const m of cardState.markers) {
            if (!m || m.row !== fromRow || m.col !== fromCol) continue;
            m.row = toRow;
            m.col = toCol;
        }
    }

    function getNeighborEmptyCandidates(gameState, row, col) {
        const out = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = row + dr;
                const c = col + dc;
                if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
                if (gameState.board[r][c] === EMPTY) out.push({ row: r, col: c });
            }
        }
        return out;
    }

    function getOrthogonalPushOptions(gameState, row, col, maxSteps = 2) {
        const options = [];
        for (const d of ORTHO_DIRS) {
            const nr = row + d.dr;
            const nc = col + d.dc;
            if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) continue;
            if (gameState.board[nr][nc] !== EMPTY) continue;

            let tr = nr;
            let tc = nc;
            let steps = 1;
            while (steps < maxSteps) {
                const rr = tr + d.dr;
                const cc = tc + d.dc;
                if (rr < 0 || rr >= 8 || cc < 0 || cc >= 8) break;
                if (gameState.board[rr][cc] !== EMPTY) break;
                tr = rr;
                tc = cc;
                steps++;
            }
            options.push({ direction: d, target: { row: tr, col: tc }, steps });
        }
        return options;
    }

    function getAdjacentEnemyPositions(gameState, row, col, enemyVal) {
        const out = [];
        for (const d of ORTHO_DIRS) {
            const r = row + d.dr;
            const c = col + d.dc;
            if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
            if (gameState.board[r][c] === enemyVal) out.push({ row: r, col: c });
        }
        return out;
    }

    function pushStoneByWind(cardState, gameState, fromRow, fromCol, prng, deps = {}) {
        const p = prng || (deps.defaultPrng || { random: () => 0 });
        const options = getOrthogonalPushOptions(gameState, fromRow, fromCol, 2);
        if (!options.length) {
            return { moved: false, from: { row: fromRow, col: fromCol }, to: { row: fromRow, col: fromCol }, steps: 0 };
        }

        const picked = options[Math.floor(p.random() * options.length)];
        const to = picked.target;
        let moved = false;
        if (deps.BoardOps && typeof deps.BoardOps.moveAt === 'function') {
            const res = deps.BoardOps.moveAt(
                cardState,
                gameState,
                fromRow,
                fromCol,
                to.row,
                to.col,
                'ULTIMATE_HYPERACTIVE_GOD',
                'ultimate_hyperactive_blow',
                { steps: picked.steps }
            );
            moved = !!(res && res.moved);
        } else {
            const val = gameState.board[fromRow][fromCol];
            if (val !== EMPTY && gameState.board[to.row][to.col] === EMPTY) {
                gameState.board[fromRow][fromCol] = EMPTY;
                gameState.board[to.row][to.col] = val;
                moved = true;
            }
        }
        if (!moved) {
            return { moved: false, from: { row: fromRow, col: fromCol }, to: { row: fromRow, col: fromCol }, steps: 0 };
        }

        moveMarkersAt(cardState, fromRow, fromCol, to.row, to.col);
        return { moved: true, from: { row: fromRow, col: fromCol }, to, steps: picked.steps };
    }

    function moveHyperactiveOnce(cardState, gameState, entry, prng, deps = {}) {
        const p = prng || (deps.defaultPrng || { random: () => 0 });
        const destroyAt = deps.destroyAt || ((cs, gs, r, c) => {
            if (gs.board[r][c] === EMPTY) return false;
            if (cs.markers) cs.markers = cs.markers.filter(m => !(m.row === r && m.col === c));
            gs.board[r][c] = EMPTY;
            return true;
        });
        const getFlipsWithContext = deps.getFlipsWithContext || (() => []);
        const clearHyperactiveAtPositions = deps.clearHyperactiveAtPositions || ((cs, positions) => { if (cs.markers) cs.markers = cs.markers.filter(m => !(m.kind === 'specialStone' && m.data && m.data.type === 'HYPERACTIVE' && positions.some(p => p.row === m.row && p.col === m.col))); });
        const clearBombAt = deps.clearBombAt || ((cs, r, c) => { if (cs.markers) cs.markers = cs.markers.filter(m => !(m.kind === 'bomb' && m.row === r && m.col === c)); });

        const moved = [];
        const destroyed = [];
        const flipped = [];

        const ownerKey = entry.owner;
        const ownerVal = ownerKey === 'black' ? (BLACK || 1) : (WHITE || -1);

        // Anchor must still be owner's stone
        if (gameState.board[entry.row][entry.col] !== ownerVal) {
            // remove the anchor
            clearHyperactiveAtPositions(cardState, [{ row: entry.row, col: entry.col }]);
            return { moved, destroyed, flipped, ownerKey };
        }

        const candidates = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = entry.row + dr;
                const c = entry.col + dc;
                if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
                if (gameState.board[r][c] === EMPTY) {
                    candidates.push({ row: r, col: c });
                }
            }
        }
        if (typeof console !== 'undefined' && console.log) console.log('[HYPERACTIVE] moveHyperactiveOnce candidates', candidates.length, 'at', { row: entry.row, col: entry.col, owner: entry.owner });

        if (candidates.length === 0) {
            let destroyedRes = false;
            if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                const res = deps.BoardOps.destroyAt(cardState, gameState, entry.row, entry.col, 'HYPERACTIVE', 'no_candidates');
                destroyedRes = !!res.destroyed;
            } else {
                destroyedRes = destroyAt(cardState, gameState, entry.row, entry.col);
            }
            if (destroyedRes) {
                destroyed.push({ row: entry.row, col: entry.col });
            }
            return { moved, destroyed, flipped, ownerKey };
        }

        const index = Math.floor(p.random() * candidates.length);
        const target = candidates[index];
        if (typeof console !== 'undefined' && console.log) console.log('[HYPERACTIVE] selected target', { index, target, candidatesLen: candidates.length });

        // Compute flips as if placing on the target cell.
        const flipCells = getFlipsWithContext(gameState, target.row, target.col, ownerVal, deps.getCardContext ? deps.getCardContext(cardState) : {});

        if (deps.BoardOps && typeof deps.BoardOps.moveAt === 'function') {
            deps.BoardOps.moveAt(cardState, gameState, entry.row, entry.col, target.row, target.col, 'HYPERACTIVE', 'hyperactive_move');
        } else {
            gameState.board[entry.row][entry.col] = EMPTY;
            gameState.board[target.row][target.col] = ownerVal;
        }
        moved.push({ from: { row: entry.row, col: entry.col }, to: { row: target.row, col: target.col } });

        entry.row = target.row;
        entry.col = target.col;

        if (flipCells.length > 0) {
            const flipPositions = flipCells.map(([r, c]) => ({ row: r, col: c }));
            for (const [r, c] of flipCells) {
                if (deps.BoardOps && typeof deps.BoardOps.changeAt === 'function') {
                    deps.BoardOps.changeAt(cardState, gameState, r, c, ownerKey, 'HYPERACTIVE', 'hyperactive_flip');
                } else {
                    gameState.board[r][c] = ownerVal;
                }
            }
            // If a hyperactive stone flips/gets converted, it loses hyperactive status.
            clearHyperactiveAtPositions(cardState, flipPositions);
            flipped.push(...flipPositions);
        }

        return { moved, destroyed, flipped, ownerKey };
    }

    function processHyperactiveMoves(cardState, gameState, prng, deps = {}) {
        const moved = [];
        const destroyed = [];
        const flipped = [];
        const flippedByOwner = { black: [], white: [] };

        const entries = (cardState.markers || [])
            .filter(s => s.kind === 'specialStone' && s.data && s.data.type === 'HYPERACTIVE')
            .slice()
            .sort((a, b) => (a.createdSeq || 0) - (b.createdSeq || 0));

        for (const entry of entries) {
            if (!(cardState.markers || []).includes(entry)) continue;
            const res = moveHyperactiveOnce(cardState, gameState, entry, prng, deps);
            moved.push(...res.moved);
            destroyed.push(...res.destroyed);
            flipped.push(...res.flipped);
            if (res.flipped.length > 0 && res.ownerKey && flippedByOwner[res.ownerKey]) {
                flippedByOwner[res.ownerKey].push(...res.flipped);
            }
        }

        return { moved, destroyed, flipped, flippedByOwner };
    }

    function processHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, deps = {}) {
        const entry = (cardState.markers || []).find(s => s.kind === 'specialStone' && s.data && s.data.type === 'HYPERACTIVE' && s.owner === playerKey && s.row === row && s.col === col);
        if (!entry) return { moved: [], destroyed: [], flipped: [] };
        return moveHyperactiveOnce(cardState, gameState, entry, prng, deps);
    }

    function processUltimateHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, deps = {}) {
        const p = prng || (deps.defaultPrng || { random: () => 0 });
        const entry = (cardState.markers || []).find(s =>
            s &&
            s.kind === 'specialStone' &&
            s.data &&
            s.data.type === 'ULTIMATE_HYPERACTIVE' &&
            s.owner === playerKey &&
            s.row === row &&
            s.col === col
        );
        if (!entry) {
            return { moved: [], destroyed: [], blown: [], chargeGain: 0, ownerKey: playerKey };
        }

        const ownerKey = entry.owner;
        const ownerVal = ownerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const enemyVal = -ownerVal;
        const clearUltimateAtPositions = deps.clearUltimateAtPositions || clearUltimateHyperactiveAtPositions;
        const destroyAt = deps.destroyAt || ((cs, gs, r, c) => {
            if (gs.board[r][c] === EMPTY) return false;
            if (cs.markers) cs.markers = cs.markers.filter(m => !(m.row === r && m.col === c));
            gs.board[r][c] = EMPTY;
            return true;
        });

        const moved = [];
        const destroyed = [];
        const blown = [];
        let chargeGain = 0;

        // Anchor is removed if the board owner no longer matches marker owner.
        if (gameState.board[entry.row][entry.col] !== ownerVal) {
            clearUltimateAtPositions(cardState, [{ row: entry.row, col: entry.col }]);
            return { moved, destroyed, blown, chargeGain, ownerKey };
        }

        for (let step = 1; step <= 2; step++) {
            const candidates = getNeighborEmptyCandidates(gameState, entry.row, entry.col);
            if (!candidates.length) {
                let destroyedRes = false;
                if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                    const res = deps.BoardOps.destroyAt(cardState, gameState, entry.row, entry.col, 'ULTIMATE_HYPERACTIVE_GOD', 'no_candidates');
                    destroyedRes = !!(res && res.destroyed);
                } else {
                    destroyedRes = destroyAt(cardState, gameState, entry.row, entry.col);
                }
                if (destroyedRes) destroyed.push({ row: entry.row, col: entry.col });
                break;
            }

            const target = candidates[Math.floor(p.random() * candidates.length)];
            const from = { row: entry.row, col: entry.col };
            let movedRes = false;
            if (deps.BoardOps && typeof deps.BoardOps.moveAt === 'function') {
                const res = deps.BoardOps.moveAt(
                    cardState,
                    gameState,
                    entry.row,
                    entry.col,
                    target.row,
                    target.col,
                    'ULTIMATE_HYPERACTIVE_GOD',
                    'ultimate_hyperactive_step_move',
                    { step }
                );
                movedRes = !!(res && res.moved);
            } else {
                gameState.board[entry.row][entry.col] = EMPTY;
                gameState.board[target.row][target.col] = ownerVal;
                movedRes = true;
            }

            if (!movedRes) break;
            entry.row = target.row;
            entry.col = target.col;
            moved.push({ from, to: { row: target.row, col: target.col }, step });

            // Snapshot adjacent enemies first, then process each (fixed order: up→right→down→left).
            const adjacentEnemies = getAdjacentEnemyPositions(gameState, entry.row, entry.col, enemyVal);
            for (const enemy of adjacentEnemies) {
                if (gameState.board[enemy.row][enemy.col] !== enemyVal) continue;
                const blowRes = pushStoneByWind(cardState, gameState, enemy.row, enemy.col, p, deps);
                if (!blowRes.moved) continue;
                blown.push({
                    from: blowRes.from,
                    to: blowRes.to,
                    steps: blowRes.steps,
                    sourceStep: step
                });
                chargeGain += 2;
            }
        }

        return { moved, destroyed, blown, chargeGain, ownerKey };
    }

    return {
        moveHyperactiveOnce,
        processHyperactiveMoves,
        processHyperactiveMoveAtAnchor,
        processUltimateHyperactiveMoveAtAnchor
    };
}));
