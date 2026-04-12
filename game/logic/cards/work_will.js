/**
 * @file work_will.js
 * @description Work Will (出稼ぎの意志) helpers
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(
            require('../../../shared-constants'),
            (function () {
                try {
                    return require('./utils');
                } catch (e) {
                    return null;
                }
            })(),
            (function () {
                try {
                    return require('../board_ops');
                } catch (e) {
                    return null;
                }
            })(),
            (function () {
                try {
                    return require('./markers');
                } catch (e) {
                    return null;
                }
            })()
        );
    } else {
        root.CardWork = factory(root.SharedConstants, root.CardUtils || null, root.BoardOps || null, root.CardMarkers || null);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants, CardUtils, BoardOps, CardMarkersModule) {
    'use strict';

    const { BLACK, WHITE, EMPTY, CHARGE_MAX } = SharedConstants || {};

    function getGlobalScope() {
        return (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
    }

    function getCardMarkersModule() {
        if (CardMarkersModule) return CardMarkersModule;
        const globalScope = getGlobalScope();
        return globalScope.CardMarkers || null;
    }

    function isWorkDebugEnabled(cardState) {
        if (cardState && cardState.debugWorkLog === true) return true;
        try {
            if (typeof globalThis !== 'undefined' && globalThis.DEBUG_WORK_LOG === true) return true;
        } catch (e) { /* ignore */ }
        return false;
    }

    function isFrozenCell(cardState, row, col) {
        return !!(CardUtils && typeof CardUtils.isFrozenCell === 'function' && CardUtils.isFrozenCell(cardState, row, col));
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

    function getExpansionCells(gameState) {
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

    function syncLegacyExpansionFields(expansion, gameState) {
        if (!expansion || typeof expansion !== 'object') return;
        if (!Array.isArray(expansion.cells)) expansion.cells = [];
        const latest = expansion.cells.length > 0 ? expansion.cells[expansion.cells.length - 1] : null;
        expansion.active = !!latest;
        expansion.side = latest ? resolveExpansionSide(latest.side, latest.row, latest.col, gameState) : null;
        expansion.row = latest ? latest.row : null;
        expansion.owner = latest ? normalizeExpansionOwner(latest.owner) : EMPTY;
    }

    function clearExpansionCellOwner(gameState, row, col) {
        if (!isExpansionCoordinate(row, col, gameState)) return false;
        const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
            ? gameState.boardExpansion
            : null;
        if (!expansion) return false;
        const cells = getExpansionCells(gameState);
        if (!cells.length) return false;
        let changed = false;
        expansion.cells = cells.map((cell) => {
            if (!cell) return cell;
            if (cell.row === row && cell.col === col) {
                changed = changed || cell.owner !== EMPTY;
                return {
                    side: resolveExpansionSide(cell.side, cell.row, cell.col, gameState),
                    row: cell.row,
                    col: cell.col,
                    owner: EMPTY
                };
            }
            return {
                side: resolveExpansionSide(cell.side, cell.row, cell.col, gameState),
                row: cell.row,
                col: cell.col,
                owner: normalizeExpansionOwner(cell.owner)
            };
        });
        syncLegacyExpansionFields(expansion, gameState);
        return changed;
    }

    function getCellValue(gameState, row, col) {
        if (BoardOps && typeof BoardOps.getCellValue === 'function') {
            return BoardOps.getCellValue(gameState, row, col);
        }
        const expansionCells = getExpansionCells(gameState);
        for (const cell of expansionCells) {
            if (!cell) continue;
            if (cell.row === row && cell.col === col) return normalizeExpansionOwner(cell.owner);
        }
        if (isMainBoardCell(row, col, gameState)) return gameState.board[row][col];
        if (!Array.isArray(gameState && gameState.board)) return null;
        if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
        if (row < 0 || row >= gameState.board.length) return null;
        const rowArr = gameState.board[row];
        if (!Array.isArray(rowArr) || col < 0 || col >= rowArr.length) return null;
        return rowArr[col];
    }

    function addChargeWithTotal(cardState, playerKey, amount) {
        if (!cardState || !amount) return 0;
        if (!cardState.charge) cardState.charge = { black: 0, white: 0 };
        if (!cardState.chargeGainedTotal) cardState.chargeGainedTotal = { black: 0, white: 0 };
        const deltaRes = (CardUtils && typeof CardUtils.addChargeWithDelta === 'function')
            ? CardUtils.addChargeWithDelta(cardState, playerKey, amount, 'work_income')
            : null;
        let added = deltaRes ? (Number(deltaRes.delta) || 0) : 0;
        if (!deltaRes) {
            const before = cardState.charge[playerKey] || 0;
            const after = Math.min(CHARGE_MAX || 99, before + amount);
            cardState.charge[playerKey] = after;
            added = after - before;
        }
        if (added > 0) {
            cardState.chargeGainedTotal[playerKey] = (cardState.chargeGainedTotal[playerKey] || 0) + added;
        }

        return added;
    }

    function placeWorkStone(cardState, gameState, playerKey, row, col, deps = {}) {
        if (isWorkDebugEnabled(cardState)) {
            try { console.log('[WORK_DEBUG] placeWorkStone called', { playerKey, row, col }); } catch (e) { /* ignore */ }
        }
        // Ensure only one per player: remove old work stone if exists
        const prev = (cardState.workAnchorPosByPlayer && cardState.workAnchorPosByPlayer[playerKey]) || null;
        const removeMarkersAt = deps.removeMarkersAt || ((cs, r, c, options) => {
            const cardMarkers = getCardMarkersModule();
            if (cardMarkers && typeof cardMarkers.removeMarkersAt === 'function') {
                cardMarkers.removeMarkersAt(cs, r, c, options);
                return;
            }
            if (!cs || !Array.isArray(cs.markers)) return;
            const opts = options || {};
            cs.markers = cs.markers.filter((marker) => {
                if (!marker || marker.row !== r || marker.col !== c) return true;
                if (opts.kind && marker.kind !== opts.kind) return true;
                if (opts.type && (!marker.data || marker.data.type !== opts.type)) return true;
                if (opts.owner && marker.owner !== opts.owner) return true;
                return false;
            });
        });
        if (prev && (prev.row !== row || prev.col !== col)) {
            removeMarkersAt(cardState, prev.row, prev.col, { kind: 'specialStone', type: 'WORK', owner: playerKey });
            cardState.workAnchorPosByPlayer[playerKey] = null;
        }

        // Add marker
        const addMarker = deps.addMarker || ((cs, kind, r, c, owner, data) => {
            const cardMarkers = getCardMarkersModule();
            if (cardMarkers && typeof cardMarkers.addMarker === 'function') {
                cardMarkers.addMarker(cs, kind, r, c, owner, Object.assign({ type: 'WORK', ownerColor: owner, workStage: 0, remainingOwnerTurns: 5 }, data || {}));
                return { placed: true };
            }
            if (!cs.markers) cs.markers = [];
            if (typeof cs._nextMarkerId !== 'number') cs._nextMarkerId = 1;
            const id = cs._nextMarkerId++;
            if (typeof cs._nextCreatedSeq !== 'number') cs._nextCreatedSeq = 1;
            const createdSeq = cs._nextCreatedSeq++;
            cs.markers.push({
                id,
                row: r,
                col: c,
                kind: kind,
                owner,
                createdSeq,
                data: Object.assign({ type: 'WORK', ownerColor: owner, workStage: 0, remainingOwnerTurns: 5 }, data || {})
            });
            return { placed: true };
        });

        addMarker(cardState, 'specialStone', row, col, playerKey, { type: 'WORK', ownerColor: playerKey, workStage: 0, remainingOwnerTurns: 5 });
        // anchor pos
        if (!cardState.workAnchorPosByPlayer) cardState.workAnchorPosByPlayer = { black: null, white: null };
        cardState.workAnchorPosByPlayer[playerKey] = { row, col };

        return { placed: true };
    }

    function revertAnchorStone(cardState, gameState, row, col, ownerKey, reason) {
        const r = Number(row);
        const c = Number(col);
        if (!Number.isInteger(r) || !Number.isInteger(c)) return false;
        const removalReason = reason || 'duration_end';

        if (BoardOps && typeof BoardOps.revertSpecialStoneAt === 'function') {
            const revertRes = BoardOps.revertSpecialStoneAt(
                cardState,
                gameState,
                r,
                c,
                'WORK',
                ownerKey,
                'WORK_WILL',
                removalReason
            );
            if (revertRes && revertRes.reverted && removalReason === 'duration_end') {
                clearExpansionCellOwner(gameState, r, c);
            }
            return !!(revertRes && revertRes.reverted);
        }

        const beforeCount = Array.isArray(cardState && cardState.markers)
            ? cardState.markers.length
            : 0;
        cardState.markers = (cardState.markers || []).filter((marker) => !(
            marker &&
            marker.kind === 'specialStone' &&
            marker.row === r &&
            marker.col === c &&
            marker.owner === ownerKey &&
            marker.data &&
            marker.data.type === 'WORK'
        ));
        const removed = (cardState.markers || []).length !== beforeCount;
        if (removed && removalReason === 'duration_end') {
            clearExpansionCellOwner(gameState, r, c);
        }
        return removed;
    }

    function processWorkEffects(cardState, gameState, playerKey, deps = {}) {
        const P_BLACK = BLACK || 1;
        const P_WHITE = WHITE || -1;
        const ownerVal = playerKey === 'black' ? P_BLACK : P_WHITE;

        // locate work stone via anchor or fallback scan
        const anchor = (cardState.workAnchorPosByPlayer && cardState.workAnchorPosByPlayer[playerKey]) || null;
        let row = null, col = null;
        if (anchor) { row = anchor.row; col = anchor.col; }
        let special = null;
        if (row !== null) {
            special = (cardState.markers || []).find(s => s.kind === 'specialStone' && s.data && s.data.type === 'WORK' && s.owner === playerKey && s.row === row && s.col === col);
        }
        if (!special) {
            // fallback: search
            special = (cardState.markers || []).find(s => s.kind === 'specialStone' && s.data && s.data.type === 'WORK' && s.owner === playerKey);
            if (special) { row = special.row; col = special.col; cardState.workAnchorPosByPlayer[playerKey] = { row, col }; }
        }

        if (!special) {
            return {
                gained: 0,
                removed: false,
                row: Number.isInteger(row) ? row : null,
                col: Number.isInteger(col) ? col : null,
                removedReason: null,
                incomeStep: null
            };
        }

        if (isFrozenCell(cardState, row, col)) {
            return {
                gained: 0,
                removed: false,
                row,
                col,
                removedReason: null,
                incomeStep: null
            };
        }

        // validate: cell must exist and match ownerColor
        const cellVal = getCellValue(gameState, row, col);
        const ownerColor = (special.data && special.data.ownerColor) || special.owner; // ownerColor may be string 'black'/'white'
        const expectedVal = ownerColor === 'black' ? P_BLACK : (ownerColor === 'white' ? P_WHITE : (playerKey === 'black' ? P_BLACK : P_WHITE));
        if (cellVal === null || cellVal === EMPTY || cellVal !== expectedVal) {
            // remove special marker
            cardState.markers = (cardState.markers || []).filter(m => !(m.kind === 'specialStone' && m.data && m.data.type === 'WORK' && m.owner === playerKey && m.row === row && m.col === col));
            cardState.workAnchorPosByPlayer[playerKey] = null;
            return {
                gained: 0,
                removed: true,
                row,
                col,
                removedReason: 'anchor_lost',
                incomeStep: null
            };
        }

        // compute gain based on workStage (0..4), and lifetime based on remainingOwnerTurns
        const rawStage = (special.data && typeof special.data.workStage === 'number') ? special.data.workStage : 0;
        const stage = Math.max(0, Math.min(4, Math.trunc(rawStage)));
        const rawRemaining = (special.data && typeof special.data.remainingOwnerTurns === 'number')
            ? special.data.remainingOwnerTurns
            : (5 - stage);
        const remainingBefore = Math.max(0, Math.trunc(rawRemaining));
        if (remainingBefore <= 0) {
            revertAnchorStone(cardState, gameState, row, col, playerKey, 'duration_end');
            cardState.workAnchorPosByPlayer[playerKey] = null;
            return {
                gained: 0,
                removed: true,
                row,
                col,
                removedReason: 'duration_end',
                incomeStep: null
            };
        }

        const gain = Math.min(CHARGE_MAX || 99, (1 << stage)); // 1,2,4,8,16
        // apply charge with clamp at CHARGE_MAX
        addChargeWithTotal(cardState, playerKey, gain);

        // Advance stage as 0..4 loop so extended turns restart from 1 after 16.
        const newStage = (stage + 1) % 5;
        const remainingAfter = Math.max(0, remainingBefore - 1);
        // update marker (stage + remainingOwnerTurns)
        for (const s of (cardState.markers || [])) {
            if (s.kind === 'specialStone' && s.data && s.data.type === 'WORK' && s.row === row && s.col === col && s.owner === playerKey) {
                s.data.workStage = newStage;
                s.data.remainingOwnerTurns = remainingAfter;
                if (s.data.ownerColor === undefined) s.data.ownerColor = s.owner;
            }
        }

        let removed = false;
        if (remainingAfter <= 0) {
            // remove marker and anchor
            revertAnchorStone(cardState, gameState, row, col, playerKey, 'duration_end');
            cardState.workAnchorPosByPlayer[playerKey] = null;
            removed = true;
        }

        return {
            gained: gain,
            removed,
            row,
            col,
            removedReason: removed ? 'duration_end' : null,
            incomeStep: stage + 1
        };
    }

    return {
        placeWorkStone,
        processWorkEffects
    };
}));
