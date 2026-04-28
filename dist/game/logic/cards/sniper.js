"use strict";
/**
 * @file sniper.js
 * @description Sniper Will effect helpers
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'), require('../board_ops'), require('../cards-internal/random-source'));
    }
    else {
        root.CardSniper = factory(root.SharedConstants, root.BoardOps || null, root.CardRandomSource || null);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants, BoardOpsModule, RandomSourceModule) {
    'use strict';
    const { BLACK, WHITE, EMPTY } = SharedConstants || {};
    if (BLACK === undefined || WHITE === undefined || EMPTY === undefined) {
        throw new Error('SharedConstants missing required values');
    }
    function normalizeExpansionOwner(owner) {
        return (owner === BLACK || owner === WHITE) ? owner : EMPTY;
    }
    function resolveBoardDims(gameState) {
        const board = gameState && Array.isArray(gameState.board) ? gameState.board : null;
        const rows = board && board.length > 0 ? board.length : 8;
        const cols = board && Array.isArray(board[0]) && board[0].length > 0 ? board[0].length : rows;
        return { rows, cols };
    }
    function isMainBoardCell(row, col, gameState) {
        const dims = resolveBoardDims(gameState);
        return Number.isInteger(row) && row >= 0 && row < dims.rows && Number.isInteger(col) && col >= 0 && col < dims.cols;
    }
    function resolveExpansionSide(side, row, col, gameState) {
        if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom')
            return side;
        const dims = resolveBoardDims(gameState);
        if (col === -1)
            return 'left';
        if (col === dims.cols)
            return 'right';
        if (row === -1)
            return 'top';
        if (row === dims.rows)
            return 'bottom';
        return null;
    }
    function isExpansionCoordinate(row, col, gameState) {
        if (!Number.isInteger(row) || !Number.isInteger(col))
            return false;
        const dims = resolveBoardDims(gameState);
        if (row < -1 || row > dims.rows || col < -1 || col > dims.cols)
            return false;
        if (isMainBoardCell(row, col, gameState))
            return false;
        return true;
    }
    function syncLegacyExpansionFields(expansion, gameState) {
        if (!expansion || typeof expansion !== 'object')
            return;
        if (!Array.isArray(expansion.cells))
            expansion.cells = [];
        const latest = expansion.cells.length > 0 ? expansion.cells[expansion.cells.length - 1] : null;
        expansion.active = !!latest;
        expansion.side = latest ? resolveExpansionSide(latest.side, latest.row, latest.col, gameState) : null;
        expansion.row = latest ? latest.row : null;
        expansion.owner = latest ? normalizeExpansionOwner(latest.owner) : EMPTY;
    }
    function getExpansionCells(gameState) {
        if (BoardOpsModule && typeof BoardOpsModule.getExpansionDescriptors === 'function') {
            return BoardOpsModule.getExpansionDescriptors(gameState);
        }
        const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
            ? gameState.boardExpansion
            : null;
        if (!expansion)
            return [];
        const cells = [];
        const pushCell = (source, legacyRow, legacyOwner) => {
            let side = null;
            let row = null;
            let col = null;
            let owner = legacyOwner;
            if (source && typeof source === 'object') {
                side = source.side;
                row = source.row;
                col = source.col;
                owner = source.owner;
                if (!Number.isInteger(col) && side === 'left')
                    col = -1;
                if (!Number.isInteger(col) && side === 'right')
                    col = resolveBoardDims(gameState).cols;
            }
            else {
                side = source;
                row = legacyRow;
                if (side === 'left')
                    col = -1;
                if (side === 'right')
                    col = resolveBoardDims(gameState).cols;
            }
            if (!isExpansionCoordinate(row, col, gameState))
                return;
            if (cells.some((cell) => cell && cell.row === row && cell.col === col))
                return;
            cells.push({
                side: resolveExpansionSide(side, row, col, gameState),
                row,
                col,
                owner: normalizeExpansionOwner(owner)
            });
        };
        if (Array.isArray(expansion.cells)) {
            for (const cell of expansion.cells) {
                if (!cell || typeof cell !== 'object')
                    continue;
                pushCell(cell);
            }
        }
        if (cells.length === 0 && expansion.active === true) {
            pushCell(expansion);
        }
        return cells;
    }
    function ensureExpansionStateMutable(gameState) {
        if (!gameState.boardExpansion || typeof gameState.boardExpansion !== 'object') {
            gameState.boardExpansion = {
                active: false,
                side: null,
                row: null,
                owner: EMPTY,
                usedByPlayer: { black: false, white: false },
                cells: []
            };
            return gameState.boardExpansion;
        }
        const expansion = gameState.boardExpansion;
        const cells = getExpansionCells(gameState);
        expansion.cells = cells.map((cell) => ({
            side: cell.side,
            row: cell.row,
            col: cell.col,
            owner: normalizeExpansionOwner(cell.owner)
        }));
        syncLegacyExpansionFields(expansion, gameState);
        return expansion;
    }
    function getCellValue(gameState, row, col) {
        if (BoardOpsModule && typeof BoardOpsModule.getCellValue === 'function') {
            return BoardOpsModule.getCellValue(gameState, row, col);
        }
        if (isMainBoardCell(row, col, gameState))
            return gameState.board[row][col];
        const expansionCells = getExpansionCells(gameState);
        for (const expansion of expansionCells) {
            if (!expansion)
                continue;
            if (expansion.row === row && expansion.col === col)
                return expansion.owner;
        }
        return null;
    }
    function setCellValue(gameState, row, col, value) {
        if (BoardOpsModule && typeof BoardOpsModule.setCellValue === 'function') {
            return BoardOpsModule.setCellValue(gameState, row, col, value);
        }
        if (isMainBoardCell(row, col, gameState)) {
            gameState.board[row][col] = value;
            return true;
        }
        const expansionState = ensureExpansionStateMutable(gameState);
        if (!Array.isArray(expansionState.cells))
            return false;
        const normalizedOwner = normalizeExpansionOwner(value);
        for (let i = 0; i < expansionState.cells.length; i++) {
            const cell = expansionState.cells[i];
            if (!cell)
                continue;
            const cellCol = Number.isInteger(cell.col)
                ? cell.col
                : (cell.side === 'left' ? -1 : (cell.side === 'right' ? resolveBoardDims(gameState).cols : null));
            if (cellCol === null)
                continue;
            if (cell.row === row && cellCol === col) {
                expansionState.cells[i] = {
                    side: resolveExpansionSide(cell.side, cell.row, cellCol, gameState),
                    row: cell.row,
                    col: cellCol,
                    owner: normalizedOwner
                };
                syncLegacyExpansionFields(expansionState, gameState);
                return true;
            }
        }
        return false;
    }
    function cleanupExpiredSnipers(cardState) {
        if (!Array.isArray(cardState && cardState.markers))
            return;
        cardState.markers = cardState.markers.filter((m) => (m.kind !== 'specialStone' ||
            !m.data ||
            m.data.type !== 'SNIPER' ||
            (Number.isFinite(Number(m.data.remainingOwnerTurns)) && Number(m.data.remainingOwnerTurns) >= 0)));
    }
    function resolveRandomFn(randomLike) {
        if (RandomSourceModule && typeof RandomSourceModule.resolveRandomFunction === 'function') {
            return RandomSourceModule.resolveRandomFunction(randomLike, null, 'CardSniper');
        }
        if (typeof randomLike === 'function')
            return randomLike;
        if (randomLike && typeof randomLike.random === 'function') {
            return function () { return randomLike.random(); };
        }
        throw new Error('CardSniper requires an injected deterministic PRNG.');
    }
    function pickNearestEnemyTarget(gameState, sourceRow, sourceCol, enemyValue, randomFn) {
        const candidates = [];
        const dims = resolveBoardDims(gameState);
        for (let r = 0; r < dims.rows; r++) {
            for (let c = 0; c < dims.cols; c++) {
                if (gameState.board[r][c] !== enemyValue)
                    continue;
                const dr = r - sourceRow;
                const dc = c - sourceCol;
                const distSq = (dr * dr) + (dc * dc);
                candidates.push({ row: r, col: c, distSq });
            }
        }
        const expansionCells = getExpansionCells(gameState);
        for (const expansion of expansionCells) {
            if (!expansion || expansion.owner !== enemyValue)
                continue;
            const dr = expansion.row - sourceRow;
            const dc = expansion.col - sourceCol;
            const distSq = (dr * dr) + (dc * dc);
            candidates.push({ row: expansion.row, col: expansion.col, distSq });
        }
        if (!candidates.length)
            return null;
        let minDistSq = Infinity;
        for (const c of candidates) {
            if (c.distSq < minDistSq)
                minDistSq = c.distSq;
        }
        const nearest = candidates.filter((c) => c.distSq === minDistSq);
        if (nearest.length <= 1)
            return nearest[0];
        const raw = Number(randomFn());
        if (!Number.isFinite(raw)) {
            throw new Error('CardSniper received a PRNG that returned a non-finite value.');
        }
        const normalized = Math.max(0, Math.min(0.999999, raw));
        const idx = Math.max(0, Math.min(nearest.length - 1, Math.floor(normalized * nearest.length)));
        return nearest[idx];
    }
    function processSniperWillEffects(cardState, gameState, playerKey, deps) {
        const options = deps || {};
        const randomFn = resolveRandomFn(options.random);
        const destroyed = [];
        const anchors = [];
        const expired = [];
        const playerValue = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const enemyValue = -playerValue;
        const destroyAt = options.destroyAt || ((cs, gs, r, c) => {
            const current = getCellValue(gs, r, c);
            if (current === null || current === EMPTY)
                return false;
            if (cs.markers)
                cs.markers = cs.markers.filter((m) => !(m.row === r && m.col === c));
            setCellValue(gs, r, c, EMPTY);
            return true;
        });
        const snipers = (cardState.markers || []).filter((m) => (m.kind === 'specialStone' &&
            m.data &&
            m.data.type === 'SNIPER' &&
            m.owner === playerKey));
        if (!snipers.length)
            return { destroyed, anchors, expired };
        for (const sniper of snipers) {
            if (getCellValue(gameState, sniper.row, sniper.col) !== playerValue) {
                if (sniper.data)
                    sniper.data.remainingOwnerTurns = -1;
                continue;
            }
            const target = pickNearestEnemyTarget(gameState, sniper.row, sniper.col, enemyValue, randomFn);
            if (target) {
                let destroyedRes = false;
                const destroyMeta = {
                    sourceRow: sniper.row,
                    sourceCol: sniper.col,
                    projectileOwner: playerKey,
                    projectileStone: 'normal'
                };
                if (options.BoardOps && typeof options.BoardOps.destroyAt === 'function') {
                    const res = options.BoardOps.destroyAt(cardState, gameState, target.row, target.col, 'SNIPER_WILL', 'sniper_shot', destroyMeta);
                    destroyedRes = !!(res && res.destroyed);
                }
                else {
                    destroyedRes = destroyAt(cardState, gameState, target.row, target.col);
                }
                if (destroyedRes) {
                    destroyed.push({
                        row: target.row,
                        col: target.col,
                        sourceRow: sniper.row,
                        sourceCol: sniper.col
                    });
                }
            }
            const before = (sniper.data && Number.isFinite(Number(sniper.data.remainingOwnerTurns)))
                ? Number(sniper.data.remainingOwnerTurns)
                : 0;
            const afterDec = before - 1;
            if (sniper.data)
                sniper.data.remainingOwnerTurns = afterDec;
            if (afterDec < 0)
                continue;
            anchors.push({ row: sniper.row, col: sniper.col, remainingNow: afterDec });
            if (afterDec === 0) {
                let revertedRes = false;
                if (options.BoardOps && typeof options.BoardOps.revertSpecialStoneAt === 'function') {
                    const res = options.BoardOps.revertSpecialStoneAt(cardState, gameState, sniper.row, sniper.col, 'SNIPER', playerKey, 'SNIPER_WILL', 'anchor_expired');
                    revertedRes = !!(res && res.reverted);
                }
                else {
                    if (cardState.markers) {
                        cardState.markers = cardState.markers.filter((entry) => !(entry &&
                            entry.kind === 'specialStone' &&
                            entry.row === sniper.row &&
                            entry.col === sniper.col &&
                            entry.owner === playerKey &&
                            entry.data &&
                            entry.data.type === 'SNIPER'));
                    }
                    revertedRes = true;
                }
                if (revertedRes) {
                    expired.push({ row: sniper.row, col: sniper.col, owner: playerKey, reason: 'anchor_expired' });
                }
                if (sniper.data)
                    sniper.data.remainingOwnerTurns = -1;
            }
        }
        cleanupExpiredSnipers(cardState);
        return { destroyed, anchors, expired };
    }
    function processSniperWillEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps) {
        const options = deps || {};
        const randomFn = resolveRandomFn(options.random);
        const destroyed = [];
        const expired = [];
        const playerValue = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const enemyValue = -playerValue;
        const destroyAt = options.destroyAt || ((cs, gs, r, c) => {
            const current = getCellValue(gs, r, c);
            if (current === null || current === EMPTY)
                return false;
            if (cs.markers)
                cs.markers = cs.markers.filter((m) => !(m.row === r && m.col === c));
            setCellValue(gs, r, c, EMPTY);
            return true;
        });
        const sniper = (cardState.markers || []).find((m) => (m.kind === 'specialStone' &&
            m.data &&
            m.data.type === 'SNIPER' &&
            m.owner === playerKey &&
            m.row === row &&
            m.col === col));
        if (!sniper)
            return { destroyed, expired };
        if (getCellValue(gameState, row, col) !== playerValue) {
            if (sniper.data)
                sniper.data.remainingOwnerTurns = -1;
            cleanupExpiredSnipers(cardState);
            return { destroyed, expired };
        }
        const target = pickNearestEnemyTarget(gameState, row, col, enemyValue, randomFn);
        if (target) {
            let destroyedRes = false;
            const destroyMeta = {
                sourceRow: row,
                sourceCol: col,
                projectileOwner: playerKey,
                projectileStone: 'normal'
            };
            if (options.BoardOps && typeof options.BoardOps.destroyAt === 'function') {
                const res = options.BoardOps.destroyAt(cardState, gameState, target.row, target.col, 'SNIPER_WILL', 'sniper_shot', destroyMeta);
                destroyedRes = !!(res && res.destroyed);
            }
            else {
                destroyedRes = destroyAt(cardState, gameState, target.row, target.col);
            }
            if (destroyedRes) {
                destroyed.push({
                    row: target.row,
                    col: target.col,
                    sourceRow: row,
                    sourceCol: col
                });
            }
        }
        const shouldDecrement = options.decrementRemainingOwnerTurns !== false;
        const before = (sniper.data && Number.isFinite(Number(sniper.data.remainingOwnerTurns)))
            ? Number(sniper.data.remainingOwnerTurns)
            : 0;
        const afterDec = shouldDecrement ? (before - 1) : before;
        if (sniper.data)
            sniper.data.remainingOwnerTurns = afterDec;
        if (shouldDecrement && afterDec === 0) {
            let revertedRes = false;
            if (options.BoardOps && typeof options.BoardOps.revertSpecialStoneAt === 'function') {
                const res = options.BoardOps.revertSpecialStoneAt(cardState, gameState, row, col, 'SNIPER', playerKey, 'SNIPER_WILL', 'anchor_expired');
                revertedRes = !!(res && res.reverted);
            }
            else {
                if (cardState.markers) {
                    cardState.markers = cardState.markers.filter((entry) => !(entry &&
                        entry.kind === 'specialStone' &&
                        entry.row === row &&
                        entry.col === col &&
                        entry.owner === playerKey &&
                        entry.data &&
                        entry.data.type === 'SNIPER'));
                }
                revertedRes = true;
            }
            if (revertedRes) {
                expired.push({ row, col, owner: playerKey, reason: 'anchor_expired' });
            }
            if (sniper.data)
                sniper.data.remainingOwnerTurns = -1;
        }
        if (shouldDecrement && afterDec < 0) {
            if (sniper.data)
                sniper.data.remainingOwnerTurns = -1;
        }
        cleanupExpiredSnipers(cardState);
        return { destroyed, expired };
    }
    return {
        processSniperWillEffects,
        processSniperWillEffectsAtTurnStartAnchor
    };
}));
//# sourceMappingURL=sniper.js.map