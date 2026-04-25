/**
 * @file destroy_dragon.js
 * @description Destroy Dragon effect helpers
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'), require('../board_ops'), require('../cards-internal/random-source'));
    } else {
        root.CardDestroyDragon = factory(root.SharedConstants, root.BoardOps || null, root.CardRandomSource || null);
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
        if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
        const dims = resolveBoardDims(gameState);
        if (col === -1) return 'left';
        if (col === dims.cols) return 'right';
        if (row === -1) return 'top';
        if (row === dims.rows) return 'bottom';
        return null;
    }

    function isExpansionCoordinate(row, col, gameState) {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        const dims = resolveBoardDims(gameState);
        if (row < -1 || row > dims.rows || col < -1 || col > dims.cols) return false;
        if (isMainBoardCell(row, col, gameState)) return false;
        return true;
    }

    function syncLegacyExpansionFields(expansion, gameState) {
        if (!expansion || typeof expansion !== 'object') return;
        if (!Array.isArray(expansion.cells)) expansion.cells = [];
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
        if (!expansion) return [];

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
                if (!Number.isInteger(col) && side === 'left') col = -1;
                if (!Number.isInteger(col) && side === 'right') col = resolveBoardDims(gameState).cols;
            } else {
                side = source;
                row = legacyRow;
                if (side === 'left') col = -1;
                if (side === 'right') col = resolveBoardDims(gameState).cols;
            }

            if (!isExpansionCoordinate(row, col, gameState)) return;
            if (cells.some((cell) => cell && cell.row === row && cell.col === col)) return;
            cells.push({
                side: resolveExpansionSide(side, row, col, gameState),
                row,
                col,
                owner: normalizeExpansionOwner(owner)
            });
        };

        if (Array.isArray(expansion.cells)) {
            for (const cell of expansion.cells) {
                if (!cell || typeof cell !== 'object') continue;
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
        if (isMainBoardCell(row, col, gameState)) return gameState.board[row][col];
        const expansionCells = getExpansionCells(gameState);
        for (const expansion of expansionCells) {
            if (!expansion) continue;
            if (expansion.row === row && expansion.col === col) return expansion.owner;
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
        if (!Array.isArray(expansionState.cells)) return false;
        const normalizedOwner = normalizeExpansionOwner(value);
        for (let i = 0; i < expansionState.cells.length; i++) {
            const cell = expansionState.cells[i];
            if (!cell) continue;
            const cellCol = Number.isInteger(cell.col)
                ? cell.col
                : (cell.side === 'left' ? -1 : (cell.side === 'right' ? resolveBoardDims(gameState).cols : null));
            if (cellCol === null) continue;
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

    function forEachNeighborCell(gameState, row, col, handler) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = row + dr;
                const c = col + dc;
                const value = getCellValue(gameState, r, c);
                if (value === null) continue;
                handler(r, c, value);
            }
        }
    }

    function resolveRandomFn(randomLike) {
        if (RandomSourceModule && typeof RandomSourceModule.resolveRandomFunction === 'function') {
            return RandomSourceModule.resolveRandomFunction(randomLike, null, 'CardDestroyDragon');
        }
        if (typeof randomLike === 'function') return randomLike;
        if (randomLike && typeof randomLike.random === 'function') {
            return function () { return randomLike.random(); };
        }
        throw new Error('CardDestroyDragon requires an injected deterministic PRNG.');
    }

    function pickRandomAdjacentEnemyTarget(gameState, sourceRow, sourceCol, enemyValue, randomFn) {
        const candidates = [];
        forEachNeighborCell(gameState, sourceRow, sourceCol, (row, col, value) => {
            if (value !== enemyValue) return;
            candidates.push({ row, col });
        });
        if (!candidates.length) return null;
        const raw = Number(randomFn());
        if (!Number.isFinite(raw)) {
            throw new Error('CardDestroyDragon received a PRNG that returned a non-finite value.');
        }
        const normalized = Math.max(0, Math.min(0.999999, raw));
        const idx = Math.max(0, Math.min(candidates.length - 1, Math.floor(normalized * candidates.length)));
        return candidates[idx] || null;
    }

    function cleanupExpiredDestroyDragons(cardState) {
        if (!Array.isArray(cardState && cardState.markers)) return;
        cardState.markers = cardState.markers.filter((m) => (
            m.kind !== 'specialStone' ||
            !m.data ||
            m.data.type !== 'DESTROY_DRAGON' ||
            (Number.isFinite(Number(m.data.remainingOwnerTurns)) && Number(m.data.remainingOwnerTurns) >= 0)
        ));
    }

    function destroyAdjacentEnemyAtRandom(cardState, gameState, playerKey, sourceRow, sourceCol, enemyValue, deps, randomFn, destroyAt) {
        const target = pickRandomAdjacentEnemyTarget(gameState, sourceRow, sourceCol, enemyValue, randomFn);
        if (!target) return null;

        const destroyMeta = {
            sourceRow,
            sourceCol,
            projectileOwner: playerKey,
            projectileStone: 'destroy_dragon'
        };

        let destroyedRes = false;
        if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
            const res = deps.BoardOps.destroyAt(
                cardState,
                gameState,
                target.row,
                target.col,
                'DESTROY_DRAGON',
                'destroy_dragon_breath',
                destroyMeta
            );
            destroyedRes = !!(res && res.destroyed);
        } else {
            destroyedRes = destroyAt(cardState, gameState, target.row, target.col);
        }
        if (!destroyedRes) return null;

        return {
            row: target.row,
            col: target.col,
            sourceRow,
            sourceCol
        };
    }

    function processDestroyDragonEffects(cardState, gameState, playerKey, deps = {}) {
        const destroyed = [];
        const anchors = [];
        const expired = [];

        const randomFn = resolveRandomFn(deps.random);
        const player = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const enemy = -player;

        const destroyAt = deps.destroyAt || ((cs, gs, row, col) => {
            const current = getCellValue(gs, row, col);
            if (current === null || current === EMPTY) return false;
            if (cs.markers) cs.markers = cs.markers.filter((m) => !(m.row === row && m.col === col));
            setCellValue(gs, row, col, EMPTY);
            return true;
        });

        const dragons = (cardState.markers || []).filter((m) => (
            m.kind === 'specialStone' &&
            m.data &&
            m.data.type === 'DESTROY_DRAGON' &&
            m.owner === playerKey
        ));
        if (!dragons.length) return { destroyed, anchors, expired };

        for (const dragon of dragons) {
            if (getCellValue(gameState, dragon.row, dragon.col) !== player) {
                if (dragon.data) dragon.data.remainingOwnerTurns = -1;
                continue;
            }

            const oneDestroyed = destroyAdjacentEnemyAtRandom(
                cardState,
                gameState,
                playerKey,
                dragon.row,
                dragon.col,
                enemy,
                deps,
                randomFn,
                destroyAt
            );
            if (oneDestroyed) destroyed.push(oneDestroyed);

            const before = (dragon.data && Number.isFinite(Number(dragon.data.remainingOwnerTurns)))
                ? Number(dragon.data.remainingOwnerTurns)
                : 0;
            const afterDec = before - 1;
            if (dragon.data) dragon.data.remainingOwnerTurns = afterDec;
            if (afterDec < 0) continue;

            anchors.push({ row: dragon.row, col: dragon.col, remainingNow: afterDec });

            if (afterDec === 0) {
                let revertedRes = false;
                if (deps.BoardOps && typeof deps.BoardOps.revertSpecialStoneAt === 'function') {
                    const res = deps.BoardOps.revertSpecialStoneAt(
                        cardState,
                        gameState,
                        dragon.row,
                        dragon.col,
                        'DESTROY_DRAGON',
                        playerKey,
                        'DESTROY_DRAGON',
                        'anchor_expired'
                    );
                    revertedRes = !!(res && res.reverted);
                } else {
                    if (cardState.markers) {
                        cardState.markers = cardState.markers.filter((entry) => !(
                            entry &&
                            entry.kind === 'specialStone' &&
                            entry.row === dragon.row &&
                            entry.col === dragon.col &&
                            entry.owner === playerKey &&
                            entry.data &&
                            entry.data.type === 'DESTROY_DRAGON'
                        ));
                    }
                    revertedRes = true;
                }
                if (revertedRes) {
                    expired.push({ row: dragon.row, col: dragon.col, owner: playerKey, reason: 'anchor_expired' });
                }
                if (dragon.data) dragon.data.remainingOwnerTurns = -1;
            }
        }

        cleanupExpiredDestroyDragons(cardState);
        return { destroyed, anchors, expired };
    }

    function processDestroyDragonEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps = {}) {
        const destroyed = [];
        const expired = [];

        const randomFn = resolveRandomFn(deps.random);
        const player = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const enemy = -player;

        const destroyAt = deps.destroyAt || ((cs, gs, targetRow, targetCol) => {
            const current = getCellValue(gs, targetRow, targetCol);
            if (current === null || current === EMPTY) return false;
            if (cs.markers) cs.markers = cs.markers.filter((m) => !(m.row === targetRow && m.col === targetCol));
            setCellValue(gs, targetRow, targetCol, EMPTY);
            return true;
        });

        const dragon = (cardState.markers || []).find((m) => (
            m.kind === 'specialStone' &&
            m.data &&
            m.data.type === 'DESTROY_DRAGON' &&
            m.owner === playerKey &&
            m.row === row &&
            m.col === col
        ));
        if (!dragon) return { destroyed, expired };

        if (getCellValue(gameState, row, col) !== player) {
            if (dragon.data) dragon.data.remainingOwnerTurns = -1;
            cleanupExpiredDestroyDragons(cardState);
            return { destroyed, expired };
        }

        const oneDestroyed = destroyAdjacentEnemyAtRandom(
            cardState,
            gameState,
            playerKey,
            row,
            col,
            enemy,
            deps,
            randomFn,
            destroyAt
        );
        if (oneDestroyed) destroyed.push(oneDestroyed);

        const shouldDecrement = deps.decrementRemainingOwnerTurns !== false;
        const before = (dragon.data && Number.isFinite(Number(dragon.data.remainingOwnerTurns)))
            ? Number(dragon.data.remainingOwnerTurns)
            : 0;
        const afterDec = shouldDecrement ? (before - 1) : before;

        if (dragon.data) dragon.data.remainingOwnerTurns = afterDec;

        if (shouldDecrement && afterDec === 0) {
            let revertedRes = false;
            if (deps.BoardOps && typeof deps.BoardOps.revertSpecialStoneAt === 'function') {
                const res = deps.BoardOps.revertSpecialStoneAt(
                    cardState,
                    gameState,
                    row,
                    col,
                    'DESTROY_DRAGON',
                    playerKey,
                    'DESTROY_DRAGON',
                    'anchor_expired'
                );
                revertedRes = !!(res && res.reverted);
            } else {
                if (cardState.markers) {
                    cardState.markers = cardState.markers.filter((entry) => !(
                        entry &&
                        entry.kind === 'specialStone' &&
                        entry.row === row &&
                        entry.col === col &&
                        entry.owner === playerKey &&
                        entry.data &&
                        entry.data.type === 'DESTROY_DRAGON'
                    ));
                }
                revertedRes = true;
            }
            if (revertedRes) {
                expired.push({ row, col, owner: playerKey, reason: 'anchor_expired' });
            }
            if (dragon.data) dragon.data.remainingOwnerTurns = -1;
        }

        if (shouldDecrement && afterDec < 0) {
            if (dragon.data) dragon.data.remainingOwnerTurns = -1;
        }

        cleanupExpiredDestroyDragons(cardState);
        return { destroyed, expired };
    }

    function processDestroyDragonEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps = {}) {
        return processDestroyDragonEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps);
    }

    return {
        processDestroyDragonEffects,
        processDestroyDragonEffectsAtAnchor,
        processDestroyDragonEffectsAtTurnStartAnchor
    };
}));
