/**
 * @file udg.js
 * @description Ultimate Destroy God (UDG) effect helpers
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.CardUdG = factory(root.SharedConstants);
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
            forEachNeighborCell(gameState, udg.row, udg.col, (r, c, value) => {
                    if (value !== opponent) return;
                    let destroyedRes = false;
                    if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                            const res = deps.BoardOps.destroyAt(cardState, gameState, r, c, 'ULTIMATE_DESTROY_GOD', 'udg_destroyed', {
                                sourceRow: udg.row,
                                sourceCol: udg.col,
                                projectileOwner: playerKey,
                                projectileStone: 'udg_lightning'
                            });
                        destroyedRes = !!res.destroyed;
                    } else {
                        destroyedRes = destroyAt(cardState, gameState, r, c);
                    }
                    if (destroyedRes) {
                        destroyed.push({ row: r, col: c });
                    }
            });

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
        forEachNeighborCell(gameState, row, col, (r, c, value) => {
                if (value !== opponent) return;
                let destroyedRes = false;
                if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                    const res = deps.BoardOps.destroyAt(cardState, gameState, r, c, 'ULTIMATE_DESTROY_GOD', 'udg_destroyed', {
                        sourceRow: row,
                        sourceCol: col,
                        projectileOwner: playerKey,
                        projectileStone: 'udg_lightning'
                    });
                    destroyedRes = !!res.destroyed;
                } else {
                    destroyedRes = destroyAt(cardState, gameState, r, c);
                }
                if (destroyedRes) {
                    destroyed.push({ row: r, col: c });
                }
        });

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
