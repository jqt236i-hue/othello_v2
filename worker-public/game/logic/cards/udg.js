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

    function isBlockedDestinationCell(cardState, row, col) {
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.some((marker) => {
            if (!marker || marker.row !== row || marker.col !== col) return false;
            if (marker.kind !== 'specialStone') return false;
            const markerType = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
            return markerType === 'BLOCKADE' || markerType === 'METEOR_HOLE' || markerType === 'FREEZE';
        });
    }

    function getRandomTurnStartMoveDestination(cardState, gameState, fromRow, fromCol, deps = {}) {
        if (deps && typeof deps.selectRandomEmptyBoardShapeDestination === 'function') {
            return deps.selectRandomEmptyBoardShapeDestination(cardState, gameState, fromRow, fromCol, deps.randomSource);
        }
        const candidates = [];
        const dims = resolveBoardDims(gameState);
        for (let row = 0; row < dims.rows; row++) {
            for (let col = 0; col < dims.cols; col++) {
                if (row === fromRow && col === fromCol) continue;
                if (getCellValue(gameState, row, col) !== EMPTY) continue;
                if (isBlockedDestinationCell(cardState, row, col)) continue;
                candidates.push({ row, col });
            }
        }
        for (const cell of getExpansionCells(gameState)) {
            if (!cell || !Number.isInteger(cell.row) || !Number.isInteger(cell.col)) continue;
            if (cell.row === fromRow && cell.col === fromCol) continue;
            if (getCellValue(gameState, cell.row, cell.col) !== EMPTY) continue;
            if (isBlockedDestinationCell(cardState, cell.row, cell.col)) continue;
            candidates.push({ row: cell.row, col: cell.col });
        }
        if (!candidates.length) return null;
        const randomSource = deps && deps.randomSource && typeof deps.randomSource.random === 'function'
            ? deps.randomSource
            : { random: () => 0 };
        const rawIndex = Math.floor(randomSource.random() * candidates.length);
        const index = Math.max(0, Math.min(candidates.length - 1, rawIndex));
        return candidates[index] || candidates[0] || null;
    }

    function moveCoexistingMarkers(cardState, anchorEntry, fromRow, fromCol, toRow, toCol, deps = {}) {
        if (deps && typeof deps.moveCoexistingSpecialMarkers === 'function') {
            deps.moveCoexistingSpecialMarkers(cardState, anchorEntry, fromRow, fromCol, toRow, toCol);
            return;
        }
        if (!Array.isArray(cardState && cardState.markers)) return;
        for (const marker of cardState.markers) {
            if (!marker || marker === anchorEntry) continue;
            if (marker.row !== fromRow || marker.col !== fromCol) continue;
            if (marker.kind === 'specialStone') {
                const markerTypeUpper = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
                if (markerTypeUpper === 'BLOCKADE' || markerTypeUpper === 'METEOR_HOLE') continue;
            }
            marker.row = toRow;
            marker.col = toCol;
        }
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

    function collectDestroyedNeighbors(cardState, gameState, playerKey, opponent, sourceRow, sourceCol, deps = {}) {
        const destroyed = [];
        const destroyAt = deps.destroyAt || ((cs, gs, r, c) => {
            const current = getCellValue(gs, r, c);
            if (current === null || current === EMPTY) return false;
            if (cs.markers) cs.markers = cs.markers.filter(m => !(m.row === r && m.col === c));
            setCellValue(gs, r, c, EMPTY);
            return true;
        });

        const neighborCells = getNeighborCellsSnapshot(gameState, sourceRow, sourceCol);
        const targets = neighborCells.filter((cell) => cell && cell.value === opponent);
        const forbiddenEvadeCells = neighborCells.map((cell) => ({ row: cell.row, col: cell.col }));
        for (const target of targets) {
            if (!target) continue;
            let destroyedRes = false;
            if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                const res = deps.BoardOps.destroyAt(cardState, gameState, target.row, target.col, 'ULTIMATE_DESTROY_GOD', 'udg_destroyed', {
                    sourceRow,
                    sourceCol,
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

        return destroyed;
    }

    function processUltimateDestroyGodTurnStartAnchorCore(cardState, gameState, udg, playerKey, player, opponent, deps = {}) {
        const moved = [];
        const destroyed = [];
        const anchors = [];
        const expired = [];
        const destroyAt = deps.destroyAt || ((cs, gs, r, c) => {
            const current = getCellValue(gs, r, c);
            if (current === null || current === EMPTY) return false;
            if (cs.markers) cs.markers = cs.markers.filter(m => !(m.row === r && m.col === c));
            setCellValue(gs, r, c, EMPTY);
            return true;
        });

        if (!udg) return { moved, destroyed, anchors, expired };
        if (getCellValue(gameState, udg.row, udg.col) !== player) {
            if (udg.data) udg.data.remainingOwnerTurns = -1;
            return { moved, destroyed, anchors, expired };
        }

        let anchorRow = udg.row;
        let anchorCol = udg.col;
        const moveTarget = getRandomTurnStartMoveDestination(cardState, gameState, udg.row, udg.col, deps);
        if (moveTarget) {
            let movedRes = false;
            if (deps.BoardOps && typeof deps.BoardOps.moveAt === 'function') {
                const res = deps.BoardOps.moveAt(
                    cardState,
                    gameState,
                    udg.row,
                    udg.col,
                    moveTarget.row,
                    moveTarget.col,
                    'ULTIMATE_DESTROY_GOD',
                    'ultimate_destroy_god_move'
                );
                movedRes = !!(res && res.moved);
            } else {
                movedRes = setCellValue(gameState, udg.row, udg.col, EMPTY) && setCellValue(gameState, moveTarget.row, moveTarget.col, player);
            }
            if (movedRes) {
                moveCoexistingMarkers(cardState, udg, udg.row, udg.col, moveTarget.row, moveTarget.col, deps);
                moved.push({
                    from: { row: udg.row, col: udg.col },
                    to: { row: moveTarget.row, col: moveTarget.col }
                });
                udg.row = moveTarget.row;
                udg.col = moveTarget.col;
                anchorRow = moveTarget.row;
                anchorCol = moveTarget.col;
            }
        }

        destroyed.push(...collectDestroyedNeighbors(cardState, gameState, playerKey, opponent, anchorRow, anchorCol, deps));

        const before = (udg.data && (udg.data.remainingOwnerTurns !== undefined && udg.data.remainingOwnerTurns !== null))
            ? udg.data.remainingOwnerTurns
            : 0;
        const afterDec = before - 1;
        if (udg.data) udg.data.remainingOwnerTurns = afterDec;
        if (afterDec < 0) return { moved, destroyed, anchors, expired };
        anchors.push({ row: anchorRow, col: anchorCol, remainingNow: afterDec });

        if (afterDec === 0) {
            let revertedRes = false;
            if (deps.BoardOps && typeof deps.BoardOps.revertSpecialStoneAt === 'function') {
                const res = deps.BoardOps.revertSpecialStoneAt(
                    cardState,
                    gameState,
                    anchorRow,
                    anchorCol,
                    'ULTIMATE_DESTROY_GOD',
                    playerKey,
                    'ULTIMATE_DESTROY_GOD',
                    'anchor_expired'
                );
                revertedRes = !!(res && res.reverted);
            } else {
                if (cardState.markers) {
                    cardState.markers = cardState.markers.filter((entry) => !(
                        entry &&
                        entry.kind === 'specialStone' &&
                        entry.row === anchorRow &&
                        entry.col === anchorCol &&
                        entry.owner === playerKey &&
                        entry.data &&
                        entry.data.type === 'ULTIMATE_DESTROY_GOD'
                    ));
                }
                revertedRes = true;
            }
            if (revertedRes) {
                expired.push({ row: anchorRow, col: anchorCol, owner: playerKey, reason: 'anchor_expired' });
            }
            if (udg.data) udg.data.remainingOwnerTurns = -1;
        }

        return { moved, destroyed, anchors, expired };
    }

    function processUltimateDestroyGodEffects(cardState, gameState, playerKey, deps = {}) {
        const moved = [];
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
        if (!udgs.length) return { moved, destroyed, anchors, expired };

        for (const udg of udgs) {
            const result = processUltimateDestroyGodTurnStartAnchorCore(cardState, gameState, udg, playerKey, player, opponent, deps);
            moved.push(...result.moved);
            destroyed.push(...result.destroyed);
            anchors.push(...result.anchors);
            expired.push(...result.expired);
        }

        if (cardState.markers) {
            cardState.markers = cardState.markers.filter(m =>
                m.kind !== 'specialStone' ||
                !m.data ||
                m.data.type !== 'ULTIMATE_DESTROY_GOD' ||
                (m.data.remainingOwnerTurns !== undefined && m.data.remainingOwnerTurns !== null && m.data.remainingOwnerTurns >= 0)
            );
        }

        return { moved, destroyed, anchors, expired };
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
            let revertedRes = false;
            if (deps.BoardOps && typeof deps.BoardOps.revertSpecialStoneAt === 'function') {
                const res = deps.BoardOps.revertSpecialStoneAt(
                    cardState,
                    gameState,
                    udg.row,
                    udg.col,
                    'ULTIMATE_DESTROY_GOD',
                    playerKey,
                    'ULTIMATE_DESTROY_GOD',
                    'anchor_expired'
                );
                revertedRes = !!(res && res.reverted);
            } else {
                if (cardState.markers) {
                    cardState.markers = cardState.markers.filter((entry) => !(
                        entry &&
                        entry.kind === 'specialStone' &&
                        entry.row === udg.row &&
                        entry.col === udg.col &&
                        entry.owner === playerKey &&
                        entry.data &&
                        entry.data.type === 'ULTIMATE_DESTROY_GOD'
                    ));
                }
                revertedRes = true;
            }
            if (revertedRes) {
                expired.push({ row: udg.row, col: udg.col, owner: playerKey, reason: 'anchor_expired' });
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
        const moved = [];
        const destroyed = [];
        const anchors = [];
        const expired = [];
        const P_BLACK = BLACK || 1;
        const P_WHITE = WHITE || -1;
        const player = playerKey === 'black' ? P_BLACK : P_WHITE;
        const opponent = -player;

        const udg = (cardState.markers || []).find(s =>
            s.kind === 'specialStone' && s.data && s.data.type === 'ULTIMATE_DESTROY_GOD' && s.owner === playerKey && s.row === row && s.col === col
        );
        const result = processUltimateDestroyGodTurnStartAnchorCore(cardState, gameState, udg, playerKey, player, opponent, deps);
        moved.push(...result.moved);
        destroyed.push(...result.destroyed);
        anchors.push(...result.anchors);
        expired.push(...result.expired);

        if (cardState.markers) {
            cardState.markers = cardState.markers.filter(m =>
                m.kind !== 'specialStone' ||
                !m.data ||
                m.data.type !== 'ULTIMATE_DESTROY_GOD' ||
                (m.data.remainingOwnerTurns !== undefined && m.data.remainingOwnerTurns !== null && m.data.remainingOwnerTurns >= 0)
            );
        }

        return { moved, destroyed, anchors, expired };
    }

    return {
        processUltimateDestroyGodEffects,
        processUltimateDestroyGodEffectsAtAnchor,
        processUltimateDestroyGodEffectsAtTurnStartAnchor
    };
}));
