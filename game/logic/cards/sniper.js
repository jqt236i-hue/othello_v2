/**
 * @file sniper.js
 * @description Sniper Will effect helpers
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.CardSniper = factory(root.SharedConstants);
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

    function cleanupExpiredSnipers(cardState) {
        if (!Array.isArray(cardState && cardState.markers)) return;
        cardState.markers = cardState.markers.filter((m) => (
            m.kind !== 'specialStone' ||
            !m.data ||
            m.data.type !== 'SNIPER' ||
            (Number.isFinite(Number(m.data.remainingOwnerTurns)) && Number(m.data.remainingOwnerTurns) >= 0)
        ));
    }

    function resolveRandomFn(randomLike) {
        if (typeof randomLike === 'function') return randomLike;
        if (randomLike && typeof randomLike.random === 'function') {
            return function () { return randomLike.random(); };
        }
        return Math.random;
    }

    function pickNearestEnemyTarget(gameState, sourceRow, sourceCol, enemyValue, randomFn) {
        const candidates = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] !== enemyValue) continue;
                const dr = r - sourceRow;
                const dc = c - sourceCol;
                const distSq = (dr * dr) + (dc * dc);
                candidates.push({ row: r, col: c, distSq });
            }
        }

        const expansionCells = getExpansionCells(gameState);
        for (const expansion of expansionCells) {
            if (!expansion || expansion.owner !== enemyValue) continue;
            const dr = expansion.row - sourceRow;
            const dc = expansion.col - sourceCol;
            const distSq = (dr * dr) + (dc * dc);
            candidates.push({ row: expansion.row, col: expansion.col, distSq });
        }

        if (!candidates.length) return null;
        let minDistSq = Infinity;
        for (const c of candidates) {
            if (c.distSq < minDistSq) minDistSq = c.distSq;
        }

        const nearest = candidates.filter((c) => c.distSq === minDistSq);
        if (nearest.length <= 1) return nearest[0];
        const raw = Number(randomFn());
        const normalized = Number.isFinite(raw) ? raw : Math.random();
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
            if (current === null || current === EMPTY) return false;
            if (cs.markers) cs.markers = cs.markers.filter((m) => !(m.row === r && m.col === c));
            setCellValue(gs, r, c, EMPTY);
            return true;
        });

        const snipers = (cardState.markers || []).filter((m) => (
            m.kind === 'specialStone' &&
            m.data &&
            m.data.type === 'SNIPER' &&
            m.owner === playerKey
        ));

        if (!snipers.length) return { destroyed, anchors, expired };

        for (const sniper of snipers) {
            if (getCellValue(gameState, sniper.row, sniper.col) !== playerValue) {
                if (sniper.data) sniper.data.remainingOwnerTurns = -1;
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
                } else {
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
            if (sniper.data) sniper.data.remainingOwnerTurns = afterDec;
            if (afterDec < 0) continue;

            anchors.push({ row: sniper.row, col: sniper.col, remainingNow: afterDec });

            if (afterDec === 0) {
                let destroyedRes = false;
                if (options.BoardOps && typeof options.BoardOps.destroyAt === 'function') {
                    const res = options.BoardOps.destroyAt(cardState, gameState, sniper.row, sniper.col, 'SNIPER_WILL', 'anchor_expired');
                    destroyedRes = !!(res && res.destroyed);
                } else {
                    destroyedRes = destroyAt(cardState, gameState, sniper.row, sniper.col);
                }
                if (destroyedRes) {
                    expired.push({ row: sniper.row, col: sniper.col });
                }
                if (sniper.data) sniper.data.remainingOwnerTurns = -1;
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
            if (current === null || current === EMPTY) return false;
            if (cs.markers) cs.markers = cs.markers.filter((m) => !(m.row === r && m.col === c));
            setCellValue(gs, r, c, EMPTY);
            return true;
        });

        const sniper = (cardState.markers || []).find((m) => (
            m.kind === 'specialStone' &&
            m.data &&
            m.data.type === 'SNIPER' &&
            m.owner === playerKey &&
            m.row === row &&
            m.col === col
        ));

        if (!sniper) return { destroyed, expired };
        if (getCellValue(gameState, row, col) !== playerValue) {
            if (sniper.data) sniper.data.remainingOwnerTurns = -1;
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
            } else {
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
        if (sniper.data) sniper.data.remainingOwnerTurns = afterDec;

        if (shouldDecrement && afterDec === 0) {
            let destroyedRes = false;
            if (options.BoardOps && typeof options.BoardOps.destroyAt === 'function') {
                const res = options.BoardOps.destroyAt(cardState, gameState, row, col, 'SNIPER_WILL', 'anchor_expired');
                destroyedRes = !!(res && res.destroyed);
            } else {
                destroyedRes = destroyAt(cardState, gameState, row, col);
            }
            if (destroyedRes) {
                expired.push({ row, col });
            }
            if (sniper.data) sniper.data.remainingOwnerTurns = -1;
        }

        if (shouldDecrement && afterDec < 0) {
            if (sniper.data) sniper.data.remainingOwnerTurns = -1;
        }

        cleanupExpiredSnipers(cardState);
        return { destroyed, expired };
    }

    return {
        processSniperWillEffects,
        processSniperWillEffectsAtTurnStartAnchor
    };
}));
