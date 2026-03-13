/**
 * @file time_bomb.js
 * @description Time Bomb helpers (Shared between Browser and Headless)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'), require('../board_ops'));
    } else {
        root.CardTimeBomb = factory(root.SharedConstants, root.BoardOps || null);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants, BoardOpsModule) {
    'use strict';

    const { TIME_BOMB_TURNS } = SharedConstants || {};

    function normalizeExpansionOwner(owner) {
        return (owner === 1 || owner === -1) ? owner : 0;
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
                owner: 0,
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
        expansion.owner = latest ? normalizeExpansionOwner(latest.owner) : 0;
        return expansion;
    }

    function getCellValue(gameState, row, col) {
        if (BoardOpsModule && typeof BoardOpsModule.getCellValue === 'function') {
            return BoardOpsModule.getCellValue(gameState, row, col);
        }
        if (row >= 0 && row < 8 && col >= 0 && col < 8) return gameState.board[row][col];
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
            const cellCol = cell.side === 'left' ? -1 : (cell.side === 'right' ? 8 : null);
            if (cellCol === null) continue;
            if (cell.row === row && cellCol === col) {
                expansionState.cells[i] = { side: cell.side, row: cell.row, owner: normalizedOwner };
                const latest = expansionState.cells.length > 0 ? expansionState.cells[expansionState.cells.length - 1] : null;
                expansionState.active = !!latest;
                expansionState.side = latest ? latest.side : null;
                expansionState.row = latest ? latest.row : null;
                expansionState.owner = latest ? normalizeExpansionOwner(latest.owner) : 0;
                return true;
            }
        }
        return false;
    }

    function forEachNeighborCell(gameState, row, col, handler) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const r = row + dr;
                const c = col + dc;
                const value = getCellValue(gameState, r, c);
                if (value === null) continue;
                handler(r, c, value);
            }
        }
    }

    function getExplosionTargetsSnapshot(gameState, row, col) {
        const targets = [];
        forEachNeighborCell(gameState, row, col, (r, c, value) => {
            if (value === null || value === 0) return;
            targets.push({ row: r, col: c });
        });
        return targets;
    }

    function applyTimeBomb(cardState, playerKey, row, col, deps = {}) {
        const addMarker = deps.addMarker || ((cs, kind, r, c, owner, data) => {
            if (!cs.markers) cs.markers = [];
            const id = (typeof cs._nextMarkerId === 'number') ? cs._nextMarkerId++ : 1;
            const createdSeq = (typeof cs._nextCreatedSeq === 'number') ? cs._nextCreatedSeq++ : 1;
            cs.markers.push({
                id,
                row: r,
                col: c,
                kind: kind,
                owner,
                createdSeq,
                data: { remainingTurns: data.remainingTurns, placedTurn: data.placedTurn }
            });
            return { placed: true };
        });

        const bombs = (cardState.markers || []).filter(m => m.kind === 'bomb');
        if (bombs.some(b => b.row === row && b.col === col)) return { placed: false, reason: 'exists' };

        addMarker(cardState, 'bomb', row, col, playerKey, {
            remainingTurns: TIME_BOMB_TURNS,
            placedTurn: cardState.turnIndex
        });
        return { placed: true };
    }

    function tickBombs(cardState, gameState, playerKey, deps = {}) {
        const destroyAt = deps.destroyAt || ((cs, gs, r, c) => {
            const current = getCellValue(gs, r, c);
            if (current === null || current === 0) return false;
            // remove markers if applicable
            if (cs.markers) cs.markers = cs.markers.filter(m => !(m.row === r && m.col === c));
            setCellValue(gs, r, c, 0);
            return true;
        });

        const exploded = [];
        const destroyed = [];
        const activeKey = playerKey || cardState.lastTurnStartedFor;
        const bombs = (cardState.markers || []).filter(m => m.kind === 'bomb');
        const removeIds = new Set();

        for (const bomb of bombs) {
            if (activeKey && bomb.owner !== activeKey) {
                continue;
            }
            if (bomb.data && bomb.data.placedTurn === cardState.turnIndex) {
                continue;
            }
            if (!bomb.data) bomb.data = {};
            bomb.data.remainingTurns = (typeof bomb.data.remainingTurns === 'number') ? bomb.data.remainingTurns - 1 : -1;
            if (bomb.data.remainingTurns <= 0) {
                exploded.push({ row: bomb.row, col: bomb.col });
                const targets = getExplosionTargetsSnapshot(gameState, bomb.row, bomb.col);
                const forbiddenEvadeCells = [];
                forEachNeighborCell(gameState, bomb.row, bomb.col, (r, c, value) => {
                    if (value === null) return;
                    forbiddenEvadeCells.push({ row: r, col: c });
                });
                for (const target of targets) {
                    if (!target) continue;
                    let destroyedRes = false;
                    if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                        const res = deps.BoardOps.destroyAt(cardState, gameState, target.row, target.col, 'TIME_BOMB', 'bomb_explosion', {
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
                if (bomb.id !== undefined) {
                    removeIds.add(bomb.id);
                } else {
                    removeIds.add(`${bomb.row},${bomb.col},${bomb.owner}`);
                }
            }
        }

        if (removeIds.size > 0) {
            cardState.markers = (cardState.markers || []).filter(m => {
                if (m.kind !== 'bomb') return true;
                if (removeIds.has(m.id)) return false;
                return !removeIds.has(`${m.row},${m.col},${m.owner}`);
            });
        }
        return { exploded, destroyed };
    }

    function tickBombAt(cardState, gameState, bomb, activeKey, deps = {}) {
        if (!bomb) return { exploded: [], destroyed: [], removed: false };

        const destroyAt = deps.destroyAt || ((cs, gs, r, c) => {
            const current = getCellValue(gs, r, c);
            if (current === null || current === 0) return false;
            if (cs.markers) cs.markers = cs.markers.filter(m => !(m.row === r && m.col === c));
            setCellValue(gs, r, c, 0);
            return true;
        });

        const bombs = (cardState.markers || []).filter(m => m.kind === 'bomb');
        const idx = bombs.findIndex(b =>
            (bomb.id !== undefined && b.id === bomb.id) ||
            (b.row === bomb.row && b.col === bomb.col && b.owner === bomb.owner && b.createdSeq === bomb.createdSeq)
        );
        if (idx === -1) return { exploded: [], destroyed: [], removed: false };

        const b = bombs[idx];
        if (activeKey && b.owner !== activeKey) return { exploded: [], destroyed: [], removed: false };
        if (b.data && b.data.placedTurn === cardState.turnIndex) return { exploded: [], destroyed: [], removed: false };

        if (!b.data) b.data = {};
        b.data.remainingTurns = (typeof b.data.remainingTurns === 'number') ? b.data.remainingTurns - 1 : -1;
        if (b.data.remainingTurns > 0) return { exploded: [], destroyed: [], removed: false };

        const exploded = [{ row: b.row, col: b.col }];
        const destroyed = [];
        const targets = getExplosionTargetsSnapshot(gameState, b.row, b.col);
        const forbiddenEvadeCells = [];
        forEachNeighborCell(gameState, b.row, b.col, (r, c, value) => {
            if (value === null) return;
            forbiddenEvadeCells.push({ row: r, col: c });
        });
        for (const target of targets) {
            if (!target) continue;
            let destroyedRes = false;
            if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                const res = deps.BoardOps.destroyAt(cardState, gameState, target.row, target.col, 'TIME_BOMB', 'bomb_explosion', {
                    forbiddenEvadeCells
                });
                destroyedRes = !!(res && res.destroyed);
            } else {
                destroyedRes = destroyAt(cardState, gameState, target.row, target.col);
            }
            if (destroyedRes) destroyed.push({ row: target.row, col: target.col });
        }

        if (b.id !== undefined) {
            cardState.markers = (cardState.markers || []).filter(m => m.id !== b.id);
        } else {
            cardState.markers = (cardState.markers || []).filter(m =>
                !(m.kind === 'bomb' && m.row === b.row && m.col === b.col && m.owner === b.owner)
            );
        }
        return { exploded, destroyed, removed: true };
    }

    return {
        applyTimeBomb,
        tickBombs,
        tickBombAt
    };
}));
