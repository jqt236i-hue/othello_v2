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
            })()
        );
    } else {
        root.CardWork = factory(root.SharedConstants, root.CardUtils || null, root.BoardOps || null);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants, CardUtils, BoardOps) {
    'use strict';

    const { BLACK, WHITE, EMPTY, CHARGE_MAX } = SharedConstants || {};

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

    function getCellValue(gameState, row, col) {
        if (BoardOps && typeof BoardOps.getCellValue === 'function') {
            return BoardOps.getCellValue(gameState, row, col);
        }
        const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
            ? gameState.boardExpansion
            : null;
        if (expansion) {
            const cells = Array.isArray(expansion.cells) ? expansion.cells : [];
            for (const cell of cells) {
                if (!cell || typeof cell !== 'object') continue;
                const cellCol = Number.isInteger(cell.col)
                    ? cell.col
                    : (cell.side === 'left' ? -1 : (cell.side === 'right' ? 8 : null));
                if (!Number.isInteger(cellCol)) continue;
                if (cell.row === row && cellCol === col) {
                    return (cell.owner === BLACK || cell.owner === WHITE) ? cell.owner : EMPTY;
                }
            }
            if (expansion.active === true) {
                const legacyCol = expansion.side === 'left' ? -1 : (expansion.side === 'right' ? 8 : null);
                if (Number.isInteger(legacyCol) && expansion.row === row && legacyCol === col) {
                    return (expansion.owner === BLACK || expansion.owner === WHITE) ? expansion.owner : EMPTY;
                }
            }
        }
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
        if (prev && (prev.row !== row || prev.col !== col)) {
            // remove existing specialStone of type WORK at prev
            if (cardState.markers) {
                cardState.markers = cardState.markers.filter(m => !(m.kind === 'specialStone' && m.data && m.data.type === 'WORK' && m.owner === playerKey && m.row === prev.row && m.col === prev.col));
            }
            cardState.workAnchorPosByPlayer[playerKey] = null;
        }

        // Add marker
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

    function clearAnchorStone(gameState, row, col) {
        if (!gameState) return false;

        const r = Number(row);
        const c = Number(col);
        if (
            BoardOps &&
            typeof BoardOps.getCellValue === 'function' &&
            typeof BoardOps.setCellValue === 'function' &&
            Number.isInteger(r) &&
            Number.isInteger(c) &&
            BoardOps.getCellValue(gameState, r, c) !== null
        ) {
            return BoardOps.setCellValue(gameState, r, c, EMPTY);
        }
        if (Number.isInteger(r) && Number.isInteger(c)) {
            const expansion = (gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
                ? gameState.boardExpansion
                : null;
            if (expansion) {
                const cells = [];
                const pushCell = (side, rowValue, ownerValue) => {
                    if (side !== 'left' && side !== 'right') return;
                    if (!Number.isInteger(rowValue) || rowValue < 0 || rowValue >= 8) return;
                    const colValue = side === 'left' ? -1 : 8;
                    if (cells.some((cell) => cell && cell.row === rowValue && cell.col === colValue)) return;
                    const normalizedOwner = (ownerValue === BLACK || ownerValue === WHITE) ? ownerValue : EMPTY;
                    cells.push({ side, row: rowValue, col: colValue, owner: normalizedOwner });
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

                let cleared = false;
                for (let i = 0; i < cells.length; i++) {
                    const cell = cells[i];
                    if (!cell || cell.row !== r || cell.col !== c) continue;
                    cells[i] = { side: cell.side, row: cell.row, col: cell.col, owner: EMPTY };
                    cleared = true;
                }
                if (cleared) {
                    expansion.cells = cells.map((cell) => ({
                        side: cell.side,
                        row: cell.row,
                        owner: (cell.owner === BLACK || cell.owner === WHITE) ? cell.owner : EMPTY
                    }));
                    const latest = expansion.cells.length > 0 ? expansion.cells[expansion.cells.length - 1] : null;
                    expansion.active = !!latest;
                    expansion.side = latest ? latest.side : null;
                    expansion.row = latest ? latest.row : null;
                    expansion.owner = latest ? ((latest.owner === BLACK || latest.owner === WHITE) ? latest.owner : EMPTY) : EMPTY;
                    return true;
                }
            }
        }

        if (!Array.isArray(gameState.board) || !Number.isInteger(r) || !Number.isInteger(c)) return false;
        if (r < 0 || r >= gameState.board.length) return false;
        const rowArr = gameState.board[r];
        if (!Array.isArray(rowArr) || c < 0 || c >= rowArr.length) return false;
        rowArr[c] = EMPTY;
        return true;
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
            cardState.markers = (cardState.markers || []).filter(m => !(m.kind === 'specialStone' && m.data && m.data.type === 'WORK' && m.owner === playerKey && m.row === row && m.col === col));
            cardState.workAnchorPosByPlayer[playerKey] = null;
            clearAnchorStone(gameState, row, col);
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
            cardState.markers = (cardState.markers || []).filter(m => !(m.kind === 'specialStone' && m.data && m.data.type === 'WORK' && m.owner === playerKey && m.row === row && m.col === col));
            cardState.workAnchorPosByPlayer[playerKey] = null;
            clearAnchorStone(gameState, row, col);
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
