/**
 * @file udg.js
 * @description Ultimate Destroy God (UDG) effect helpers
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'), require('../board_ops'));
    } else {
        root.CardUdG = factory(root.SharedConstants, root.BoardOps || null);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants, BoardOpsModule) {
    'use strict';

    const { BLACK, WHITE, EMPTY } = SharedConstants || {};

    if (BLACK === undefined || WHITE === undefined || EMPTY === undefined) {
        throw new Error('SharedConstants missing required values');
    }

    function normalizeExpansionOwner(owner) {
        return (owner === BLACK || owner === WHITE) ? owner : EMPTY;
    }

    function isMainBoardCell(row, col) {
        return Number.isInteger(row) && row >= 0 && row < 8 && Number.isInteger(col) && col >= 0 && col < 8;
    }

    function resolveExpansionSide(side, row, col) {
        if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
        if (col === -1) return 'left';
        if (col === 8) return 'right';
        if (row === -1) return 'top';
        if (row === 8) return 'bottom';
        return null;
    }

    function isExpansionCoordinate(row, col) {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        if (row < -1 || row > 8 || col < -1 || col > 8) return false;
        if (isMainBoardCell(row, col)) return false;
        return true;
    }

    function syncLegacyExpansionFields(expansion) {
        if (!expansion || typeof expansion !== 'object') return;
        if (!Array.isArray(expansion.cells)) expansion.cells = [];
        const latest = expansion.cells.length > 0 ? expansion.cells[expansion.cells.length - 1] : null;
        expansion.active = !!latest;
        expansion.side = latest ? resolveExpansionSide(latest.side, latest.row, latest.col) : null;
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
                if (!Number.isInteger(col) && side === 'right') col = 8;
            } else {
                side = source;
                row = legacyRow;
                if (side === 'left') col = -1;
                if (side === 'right') col = 8;
            }

            if (!isExpansionCoordinate(row, col)) return;
            if (cells.some((cell) => cell && cell.row === row && cell.col === col)) return;
            cells.push({
                side: resolveExpansionSide(side, row, col),
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
        syncLegacyExpansionFields(expansion);
        return expansion;
    }

    function getCellValue(gameState, row, col) {
        if (BoardOpsModule && typeof BoardOpsModule.getCellValue === 'function') {
            return BoardOpsModule.getCellValue(gameState, row, col);
        }
        if (isMainBoardCell(row, col)) return gameState.board[row][col];
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
            const cellCol = Number.isInteger(cell.col)
                ? cell.col
                : (cell.side === 'left' ? -1 : (cell.side === 'right' ? 8 : null));
            if (cellCol === null) continue;
            if (cell.row === row && cellCol === col) {
                expansionState.cells[i] = {
                    side: resolveExpansionSide(cell.side, cell.row, cellCol),
                    row: cell.row,
                    col: cellCol,
                    owner: normalizedOwner
                };
                syncLegacyExpansionFields(expansionState);
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

    function getNeighborCellsSnapshot(gameState, row, col) {
        const cells = [];
        forEachNeighborCell(gameState, row, col, (r, c, value) => {
            cells.push({ row: r, col: c, value });
        });
        return cells;
    }

    function processUltimateDestroyGodEffects(cardState, gameState, playerKey, deps = {}) {
        const destroyed = [];
        const anchors = [];
        const expired = [];

        const P_BLACK = BLACK || 1;
        const P_WHITE = WHITE || -1;
        const player = playerKey === 'black' ? P_BLACK : P_WHITE;
        const opponent = -player;

        const destroyAt = deps.destroyAt || ((cs, gs, r, c) => {
            const current = getCellValue(gs, r, c);
            if (current === null || current === EMPTY) return false;
            if (cs.markers) cs.markers = cs.markers.filter(m => !(m.row === r && m.col === c));
            setCellValue(gs, r, c, EMPTY);
            return true;
        });

        const udgs = (cardState.markers || []).filter(s => s.kind === 'specialStone' && s.data && s.data.type === 'ULTIMATE_DESTROY_GOD' && s.owner === playerKey);
        if (!udgs.length) return { destroyed, anchors, expired };

        for (const udg of udgs) {
            // Anchor must still be the owner's stone
            if (getCellValue(gameState, udg.row, udg.col) !== player) {
                if (udg.data) udg.data.remainingOwnerTurns = -1;
                continue;
            }

            // 1) Destroy surrounding enemy stones (Destroy)
            const neighborCells = getNeighborCellsSnapshot(gameState, udg.row, udg.col);
            const targets = neighborCells.filter((cell) => cell && cell.value === opponent);
            const forbiddenEvadeCells = neighborCells.map((cell) => ({ row: cell.row, col: cell.col }));
            for (const target of targets) {
                if (!target) continue;
                let destroyedRes = false;
                if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                    const res = deps.BoardOps.destroyAt(cardState, gameState, target.row, target.col, 'ULTIMATE_DESTROY_GOD', 'udg_destroyed', {
                        sourceRow: udg.row,
                        sourceCol: udg.col,
                        projectileOwner: playerKey,
                        projectileStone: 'udg_lightning',
                        forbiddenEvadeCells
                    });
                    destroyedRes = !!(res && res.destroyed);
                } else {
                    destroyedRes = destroyAt(cardState, gameState, target.row, target.col);
                }
                if (destroyedRes) {
                    destroyed.push({ row: target.row, col: target.col });
                }
            }

            // 2) Decrement remaining turns
            const before = (udg.data && (udg.data.remainingOwnerTurns !== undefined && udg.data.remainingOwnerTurns !== null))
                ? udg.data.remainingOwnerTurns
                : 0;
            const afterDec = before - 1;
            if (udg.data) udg.data.remainingOwnerTurns = afterDec;
            if (afterDec < 0) continue;
            anchors.push({ row: udg.row, col: udg.col, remainingNow: afterDec });

            // 3) Expire at 0: destroy anchor
            if (afterDec === 0) {
                let destroyedRes = false;
                if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                    const res = deps.BoardOps.destroyAt(cardState, gameState, udg.row, udg.col, 'ULTIMATE_DESTROY_GOD', 'anchor_expired');
                    destroyedRes = !!res.destroyed;
                } else {
                    destroyedRes = destroyAt(cardState, gameState, udg.row, udg.col);
                }
                if (destroyedRes) {
                    expired.push({ row: udg.row, col: udg.col });
                }
                if (udg.data) udg.data.remainingOwnerTurns = -1;
            }
        }

        if (cardState.markers) {
            cardState.markers = cardState.markers.filter(m =>
                m.kind !== 'specialStone' ||
                !m.data ||
                m.data.type !== 'ULTIMATE_DESTROY_GOD' ||
                (m.data.remainingOwnerTurns !== undefined && m.data.remainingOwnerTurns !== null && m.data.remainingOwnerTurns >= 0)
            );
        }

        return { destroyed, anchors, expired };
    }

    function processUltimateDestroyGodEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps = {}) {
        const destroyed = [];
        const P_BLACK = BLACK || 1;
        const P_WHITE = WHITE || -1;
        const player = playerKey === 'black' ? P_BLACK : P_WHITE;
        const opponent = -player;

        const destroyAt = deps.destroyAt || ((cs, gs, r, c) => {
            const current = getCellValue(gs, r, c);
            if (current === null || current === EMPTY) return false;
            if (cs.markers) cs.markers = cs.markers.filter(m => !(m.row === r && m.col === c));
            setCellValue(gs, r, c, EMPTY);
            return true;
        });

        const udg = (cardState.markers || []).find(s =>
            s.kind === 'specialStone' && s.data && s.data.type === 'ULTIMATE_DESTROY_GOD' && s.owner === playerKey && s.row === row && s.col === col
        );
        if (!udg) return { destroyed };
        if (getCellValue(gameState, row, col) !== player) return { destroyed };

        // 1) Destroy surrounding enemy stones (Destroy)
        const neighborCells = getNeighborCellsSnapshot(gameState, row, col);
        const targets = neighborCells.filter((cell) => cell && cell.value === opponent);
        const forbiddenEvadeCells = neighborCells.map((cell) => ({ row: cell.row, col: cell.col }));
        for (const target of targets) {
            if (!target) continue;
            let destroyedRes = false;
            if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                const res = deps.BoardOps.destroyAt(cardState, gameState, target.row, target.col, 'ULTIMATE_DESTROY_GOD', 'udg_destroyed', {
                    sourceRow: row,
                    sourceCol: col,
                    projectileOwner: playerKey,
                    projectileStone: 'udg_lightning',
                    forbiddenEvadeCells
                });
                destroyedRes = !!(res && res.destroyed);
            } else {
                destroyedRes = destroyAt(cardState, gameState, target.row, target.col);
            }
            if (destroyedRes) {
                destroyed.push({ row: target.row, col: target.col });
            }
        }

        // 2) Decrement remaining turns (skip decrement for immediate placement if requested)
        const before = (udg.data && (udg.data.remainingOwnerTurns !== undefined && udg.data.remainingOwnerTurns !== null))
            ? udg.data.remainingOwnerTurns
            : 0;
        const shouldDecrement = deps.decrementRemainingOwnerTurns !== false;
        const afterDec = shouldDecrement ? before - 1 : before;
        if (shouldDecrement) {
            if (udg.data) udg.data.remainingOwnerTurns = afterDec;
            if (afterDec < 0) return { destroyed };
        } else {
            // Keep remainingOwnerTurns unchanged for immediate (placement-turn) activation
            if (udg.data) udg.data.remainingOwnerTurns = before;
        }

        // 3) Expire at 0: destroy anchor (only when we actually decremented)
        const expired = [];
        if (shouldDecrement && afterDec === 0) {
            let destroyedRes = false;
            if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                const res = deps.BoardOps.destroyAt(cardState, gameState, udg.row, udg.col, 'ULTIMATE_DESTROY_GOD', 'anchor_expired');
                destroyedRes = !!res.destroyed;
            } else {
                destroyedRes = destroyAt(cardState, gameState, udg.row, udg.col);
            }
            if (destroyedRes) {
                expired.push({ row: udg.row, col: udg.col });
            }
            if (udg.data) udg.data.remainingOwnerTurns = -1;
        }

        // Remove expired anchors
        if (cardState.markers) {
            cardState.markers = cardState.markers.filter(m =>
                m.kind !== 'specialStone' ||
                !m.data ||
                m.data.type !== 'ULTIMATE_DESTROY_GOD' ||
                (m.data.remainingOwnerTurns !== undefined && m.data.remainingOwnerTurns !== null && m.data.remainingOwnerTurns >= 0)
            );
        }

        return { destroyed, expired };
    }

    function processUltimateDestroyGodEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps = {}) {
        // Single-anchor turn-start processing for UDG: destroy surrounding, decrement, expire
        // This re-uses the anchor-level processor with the default behavior (which decrements remainingOwnerTurns).
        const result = processUltimateDestroyGodEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps);
        return result;
    }

    return {
        processUltimateDestroyGodEffects,
        processUltimateDestroyGodEffectsAtAnchor,
        processUltimateDestroyGodEffectsAtTurnStartAnchor
    };
}));
