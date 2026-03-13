/**
 * @file destroy_dragon.js
 * @description Destroy Dragon effect helpers
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.CardDestroyDragon = factory(root.SharedConstants);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants) {
    'use strict';

    const { BLACK, WHITE, EMPTY } = SharedConstants || {};

    if (BLACK === undefined || WHITE === undefined || EMPTY === undefined) {
        throw new Error('SharedConstants missing required values');
    }

    function normalizeExpansionOwner(owner) {
        return (owner === BLACK || owner === WHITE) ? owner : EMPTY;
    }

    function getExpansionCells(gameState) {
        const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
            ? gameState.boardExpansion
            : null;
        if (!expansion) return [];

        const cells = [];
        const pushCell = (side, row, owner) => {
            if (side !== 'left' && side !== 'right') return;
            if (!Number.isInteger(row) || row < 0 || row >= 8) return;
            const col = side === 'left' ? -1 : 8;
            if (cells.some((cell) => cell && cell.row === row && cell.col === col)) return;
            cells.push({ side, row, col, owner: normalizeExpansionOwner(owner) });
        };

        if (Array.isArray(expansion.cells)) {
            for (const cell of expansion.cells) {
                if (!cell || typeof cell !== 'object') continue;
                pushCell(cell.side, cell.row, cell.owner);
            }
        }

        if (cells.length === 0 && expansion.active === true) {
            pushCell(expansion.side, expansion.row, expansion.owner);
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
            owner: normalizeExpansionOwner(cell.owner)
        }));
        const latest = expansion.cells.length > 0 ? expansion.cells[expansion.cells.length - 1] : null;
        expansion.active = !!latest;
        expansion.side = latest ? latest.side : null;
        expansion.row = latest ? latest.row : null;
        expansion.owner = latest ? normalizeExpansionOwner(latest.owner) : EMPTY;
        return expansion;
    }

    function getCellValue(gameState, row, col) {
        if (row >= 0 && row < 8 && col >= 0 && col < 8) return gameState.board[row][col];
        const expansionCells = getExpansionCells(gameState);
        for (const expansion of expansionCells) {
            if (!expansion) continue;
            if (expansion.row === row && expansion.col === col) return expansion.owner;
        }
        return null;
    }

    function setCellValue(gameState, row, col, value) {
        if (row >= 0 && row < 8 && col >= 0 && col < 8) {
            gameState.board[row][col] = value;
            return true;
        }
        const expansionState = ensureExpansionStateMutable(gameState);
        if (!Array.isArray(expansionState.cells)) return false;
        const normalizedOwner = normalizeExpansionOwner(value);
        for (let i = 0; i < expansionState.cells.length; i++) {
            const cell = expansionState.cells[i];
            if (!cell) continue;
            const cellCol = cell.side === 'left' ? -1 : (cell.side === 'right' ? 8 : null);
            if (cellCol === null) continue;
            if (cell.row === row && cellCol === col) {
                expansionState.cells[i] = { side: cell.side, row: cell.row, owner: normalizedOwner };
                const latest = expansionState.cells.length > 0 ? expansionState.cells[expansionState.cells.length - 1] : null;
                expansionState.active = !!latest;
                expansionState.side = latest ? latest.side : null;
                expansionState.row = latest ? latest.row : null;
                expansionState.owner = latest ? normalizeExpansionOwner(latest.owner) : EMPTY;
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
        if (typeof randomLike === 'function') return randomLike;
        if (randomLike && typeof randomLike.random === 'function') {
            return function () { return randomLike.random(); };
        }
        return Math.random;
    }

    function pickRandomAdjacentEnemyTarget(gameState, sourceRow, sourceCol, enemyValue, randomFn) {
        const candidates = [];
        forEachNeighborCell(gameState, sourceRow, sourceCol, (row, col, value) => {
            if (value !== enemyValue) return;
            candidates.push({ row, col });
        });
        if (!candidates.length) return null;
        const raw = Number(randomFn());
        const normalized = Number.isFinite(raw) ? raw : Math.random();
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
                let destroyedRes = false;
                if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                    const res = deps.BoardOps.destroyAt(cardState, gameState, dragon.row, dragon.col, 'DESTROY_DRAGON', 'anchor_expired');
                    destroyedRes = !!(res && res.destroyed);
                } else {
                    destroyedRes = destroyAt(cardState, gameState, dragon.row, dragon.col);
                }
                if (destroyedRes) {
                    expired.push({ row: dragon.row, col: dragon.col });
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
            let destroyedRes = false;
            if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                const res = deps.BoardOps.destroyAt(cardState, gameState, row, col, 'DESTROY_DRAGON', 'anchor_expired');
                destroyedRes = !!(res && res.destroyed);
            } else {
                destroyedRes = destroyAt(cardState, gameState, row, col);
            }
            if (destroyedRes) {
                expired.push({ row, col });
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
