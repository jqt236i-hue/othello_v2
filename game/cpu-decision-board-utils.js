/**
 * @file cpu-decision-board-utils.js
 * @description Shared board/card type helpers for cpu-decision (UMD)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(
            require('../shared/shared-board-utils'),
            require('../shared/shared-card-heuristics')
        );
    } else {
        root.CpuDecisionBoardUtils = factory(root.SharedBoardUtils, root.SharedCardHeuristics);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedBoardUtils, SharedCardHeuristics) {
    const DEFAULT_CORNER_RECOVERY_CARD_TYPES = new Set([
        'DESTROY_ONE_STONE',
        'SWAP_WITH_ENEMY',
        'POSITION_SWAP_WILL',
        'STRONG_WIND_WILL',
        'TABOO_REVERSE_WILL',
        'TEMPT_WILL',
        'CAPTURE_WILL',
        'METEOR_WILL',
        'ULTIMATE_DESTROY_GOD',
        'ULTIMATE_REVERSE_DRAGON'
    ]);

    const DEFAULT_CORNER_HOLD_CARD_TYPES = new Set([
        'PROTECTED_NEXT_STONE',
        'PERMA_PROTECT_NEXT_STONE',
        'GUARD_WILL',
        'GUARDIAN_GOD',
        'REGEN_WILL',
        'BLOCKADE_WILL'
    ]);

    const DEFAULT_CHARGE_RAMP_CARD_TYPES = new Set([
        'TREASURE_BOX',
        'GOLD_STONE',
        'RAINBOW_STONE',
        'SILVER_STONE',
        'CRYSTAL_STONE',
        'PLUNDER_WILL',
        'WORK_WILL'
    ]);

    const BoardUtils = SharedBoardUtils || null;
    const CardHeuristics = SharedCardHeuristics || null;

    function countBoardEmpties(board) {
        if (BoardUtils && typeof BoardUtils.countBoardEmpties === 'function') {
            return BoardUtils.countBoardEmpties(board);
        }
        if (!Array.isArray(board)) return 0;
        let empties = 0;
        for (let r = 0; r < board.length; r++) {
            const row = Array.isArray(board[r]) ? board[r] : [];
            for (let c = 0; c < row.length; c++) {
                if (row[c] === 0) empties += 1;
            }
        }
        return empties;
    }

    function isStandardBoard8x8(board) {
        return !!(BoardUtils && typeof BoardUtils.isStandardBoard8x8 === 'function' && BoardUtils.isStandardBoard8x8(board));
    }

    function resolveBoardBounds(boardOrRows, maybeCols) {
        if (BoardUtils && typeof BoardUtils.resolveBoardBounds === 'function') {
            return BoardUtils.resolveBoardBounds(boardOrRows, maybeCols);
        }
        if (Array.isArray(boardOrRows)) {
            if (boardOrRows.length <= 0) return null;
            let maxCol = -1;
            for (const row of boardOrRows) {
                if (Array.isArray(row) && row.length > 0) {
                    maxCol = Math.max(maxCol, row.length - 1);
                }
            }
            if (maxCol < 0) return null;
            return { maxRow: boardOrRows.length - 1, maxCol };
        }
        const rows = Number.isFinite(boardOrRows) ? Math.max(1, Math.floor(boardOrRows)) : 8;
        const cols = Number.isFinite(maybeCols) ? Math.max(1, Math.floor(maybeCols)) : rows;
        return { maxRow: rows - 1, maxCol: cols - 1 };
    }

    function isCornerCell(row, col, boardOrRows, maybeCols) {
        if (BoardUtils && typeof BoardUtils.isCornerCell === 'function') {
            return BoardUtils.isCornerCell(row, col, boardOrRows, maybeCols);
        }
        const bounds = resolveBoardBounds(boardOrRows, maybeCols);
        if (!bounds) return false;
        return (
            Number.isInteger(row) &&
            Number.isInteger(col) &&
            (row === 0 || row === bounds.maxRow) &&
            (col === 0 || col === bounds.maxCol)
        );
    }

    function isEdgeCell(row, col, boardOrRows, maybeCols) {
        if (BoardUtils && typeof BoardUtils.isEdgeCell === 'function') {
            return BoardUtils.isEdgeCell(row, col, boardOrRows, maybeCols);
        }
        const bounds = resolveBoardBounds(boardOrRows, maybeCols);
        if (!bounds) return false;
        return (
            Number.isInteger(row) &&
            Number.isInteger(col) &&
            (row === 0 || row === bounds.maxRow || col === 0 || col === bounds.maxCol)
        );
    }

    function resolveCardStateCardStateRef(cardStateOverride) {
        if (cardStateOverride && typeof cardStateOverride === 'object') return cardStateOverride;
        try {
            if (typeof globalThis !== 'undefined' && globalThis.cardState) return globalThis.cardState;
        } catch (e) { /* ignore */ }
        return null;
    }

    function getBoardBonusValueAt(row, col, cardStateOverride) {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return 0;
        const cs = resolveCardStateCardStateRef(cardStateOverride);
        if (!cs) return 0;
        const key = `${row},${col}`;
        const consumed = (cs.boardBonusConsumedByCell && cs.boardBonusConsumedByCell[key] === true);
        if (consumed) return 0;
        const raw = Number(cs.boardBonusByCell && cs.boardBonusByCell[key] ? cs.boardBonusByCell[key] : 0);
        return Number.isFinite(raw) && raw > 0 ? raw : 0;
    }

    function countCornerControl(board, playerValue) {
        if (BoardUtils && typeof BoardUtils.countCornerControl === 'function') {
            return BoardUtils.countCornerControl(board, playerValue);
        }
        if (!Array.isArray(board)) return { ownCorners: 0, oppCorners: 0 };
        const bounds = resolveBoardBounds(board);
        if (!bounds) return { ownCorners: 0, oppCorners: 0 };
        const corners = [
            [0, 0],
            [0, bounds.maxCol],
            [bounds.maxRow, 0],
            [bounds.maxRow, bounds.maxCol]
        ];
        let ownCorners = 0;
        let oppCorners = 0;
        for (const one of corners) {
            const row = Array.isArray(board[one[0]]) ? board[one[0]] : null;
            if (!row || one[1] < 0 || one[1] >= row.length) continue;
            const v = row[one[1]];
            if (v === playerValue) ownCorners += 1;
            else if (v === -playerValue) oppCorners += 1;
        }
        return { ownCorners, oppCorners };
    }

    function countEdgeControl(board, playerValue) {
        if (BoardUtils && typeof BoardUtils.countEdgeControl === 'function') {
            return BoardUtils.countEdgeControl(board, playerValue);
        }
        if (!Array.isArray(board)) return { ownEdges: 0, oppEdges: 0 };
        const bounds = resolveBoardBounds(board);
        if (!bounds) return { ownEdges: 0, oppEdges: 0 };
        let ownEdges = 0;
        let oppEdges = 0;
        for (let row = 0; row <= bounds.maxRow; row++) {
            const rowCells = Array.isArray(board[row]) ? board[row] : [];
            for (let col = 0; col < rowCells.length; col++) {
                if (!isEdgeCell(row, col, board) || isCornerCell(row, col, board)) continue;
                const v = rowCells[col];
                if (v === playerValue) ownEdges += 1;
                else if (v === -playerValue) oppEdges += 1;
            }
        }
        return { ownEdges, oppEdges };
    }

    function isRecoveryCardType(cardType) {
        if (CardHeuristics && typeof CardHeuristics.isRecoveryCardType === 'function') {
            return CardHeuristics.isRecoveryCardType(cardType);
        }
        return DEFAULT_CORNER_RECOVERY_CARD_TYPES.has(String(cardType || ''));
    }

    function isHoldCardType(cardType) {
        if (CardHeuristics && typeof CardHeuristics.isHoldCardType === 'function') {
            return CardHeuristics.isHoldCardType(cardType);
        }
        return DEFAULT_CORNER_HOLD_CARD_TYPES.has(String(cardType || ''));
    }

    function isChargeRampCardType(cardType) {
        if (CardHeuristics && typeof CardHeuristics.isChargeRampCardType === 'function') {
            return CardHeuristics.isChargeRampCardType(cardType);
        }
        return DEFAULT_CHARGE_RAMP_CARD_TYPES.has(String(cardType || ''));
    }

    function resolveCardType(cardId, cardDef, cardLogicOverride) {
        if (cardDef && typeof cardDef.type === 'string' && cardDef.type) return cardDef.type;
        let cardLogic = cardLogicOverride || null;
        if (!cardLogic) {
            try {
                if (typeof globalThis !== 'undefined' && globalThis.CardLogic) {
                    cardLogic = globalThis.CardLogic;
                }
            } catch (e) { /* ignore */ }
        }
        if (!cardId || !cardLogic || typeof cardLogic.getCardDef !== 'function') return '';
        try {
            const def = cardLogic.getCardDef(cardId);
            return (def && typeof def.type === 'string') ? def.type : '';
        } catch (e) {
            return '';
        }
    }

    return {
        DEFAULT_CORNER_RECOVERY_CARD_TYPES,
        DEFAULT_CORNER_HOLD_CARD_TYPES,
        DEFAULT_CHARGE_RAMP_CARD_TYPES,
        countBoardEmpties,
        isStandardBoard8x8,
        resolveBoardBounds,
        isCornerCell,
        isEdgeCell,
        getBoardBonusValueAt,
        countCornerControl,
        countEdgeControl,
        isRecoveryCardType,
        isHoldCardType,
        isChargeRampCardType,
        resolveCardType
    };
}));
