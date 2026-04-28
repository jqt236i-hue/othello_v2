"use strict";
/**
 * @file target-resolver.js
 * @description Card target resolution helpers (extracted from game/logic/cards.js)
 * Pure functions only. No UI dependencies.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../shared-constants'), require('../../shared/shared-board-utils'), require('../logic/cards/markers'), require('../logic/cards/selectors'), require('../logic/cards/targets'));
    }
    else {
        root.CardTargetResolver = factory(root.SharedConstants, root.SharedBoardUtils, root.CardMarkers, root.CardSelectors, root.CardTargets);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants, SharedBoardUtils, CardMarkers, CardSelectors, CardTargets) {
    'use strict';
    const { BLACK, WHITE, EMPTY, DIRECTIONS, BOARD_SIZE } = SharedConstants || {};
    const BoardUtils = SharedBoardUtils || null;
    const Markers = CardMarkers || {};
    const Selectors = CardSelectors || {};
    const Targets = CardTargets || {};
    // ---- Helpers ----
    function resolveBoardConfig(gameState) {
        if (BoardUtils && typeof BoardUtils.resolveBoardConfig === 'function') {
            return BoardUtils.resolveBoardConfig(gameState);
        }
        const board = gameState && Array.isArray(gameState.board) ? gameState.board : null;
        const rows = Array.isArray(board) && board.length > 0 ? board.length : 8;
        const cols = Array.isArray(board) && Array.isArray(board[0]) && board[0].length > 0 ? board[0].length : rows;
        return {
            rows,
            cols,
            baseBounds: { minRow: 0, maxRow: rows - 1, minCol: 0, maxCol: cols - 1 },
            outerBounds: { minRow: -1, maxRow: rows, minCol: -1, maxCol: cols }
        };
    }
    function isMainBoardCell(row, col, gameState) {
        if (BoardUtils && typeof BoardUtils.isMainBoardCell === 'function') {
            return BoardUtils.isMainBoardCell(row, col, gameState);
        }
        const config = resolveBoardConfig(gameState);
        return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < config.rows && col >= 0 && col < config.cols;
    }
    function getCellValue(gameState, row, col) {
        if (BoardUtils && typeof BoardUtils.getCellValue === 'function') {
            return BoardUtils.getCellValue(gameState && gameState.board, row, col);
        }
        if (isMainBoardCell(row, col, gameState)) {
            return (gameState && Array.isArray(gameState.board) && Array.isArray(gameState.board[row]))
                ? gameState.board[row][col]
                : null;
        }
        for (const cell of getExpansionCells(gameState)) {
            if (!cell)
                continue;
            if (cell.row === row && cell.col === col) {
                return Number(cell.owner);
            }
        }
        return null;
    }
    function getExpansionCells(gameState) {
        if (BoardUtils && typeof BoardUtils.collectExpansionDescriptors === 'function') {
            return BoardUtils.collectExpansionDescriptors(gameState && gameState.boardExpansion, gameState);
        }
        const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
            ? gameState.boardExpansion
            : null;
        if (!expansion)
            return [];
        const config = resolveBoardConfig(gameState);
        const cells = [];
        const pushCell = (source) => {
            let side = null;
            let row = null;
            let col = null;
            let owner = null;
            if (source && typeof source === 'object') {
                side = source.side;
                row = source.row;
                col = source.col;
                owner = source.owner;
                if (!Number.isInteger(col) && side === 'left')
                    col = config.outerBounds.minCol;
                if (!Number.isInteger(col) && side === 'right')
                    col = config.outerBounds.maxCol;
            }
            if (!Number.isInteger(row) || !Number.isInteger(col))
                return;
            if (row < config.outerBounds.minRow || row > config.outerBounds.maxRow)
                return;
            if (col < config.outerBounds.minCol || col > config.outerBounds.maxCol)
                return;
            if (isMainBoardCell(row, col, gameState))
                return;
            if (cells.some((c) => c && c.row === row && c.col === col))
                return;
            const normalizedOwner = (owner === BLACK || owner === WHITE) ? owner : EMPTY;
            cells.push({ side, row, col, owner: normalizedOwner });
        };
        if (Array.isArray(expansion.cells)) {
            for (const cell of expansion.cells) {
                if (!cell || typeof cell !== 'object')
                    continue;
                pushCell(cell);
            }
        }
        if (cells.length === 0 && expansion.active === true) {
            pushCell(expansion);
        }
        return cells;
    }
    function forEachBoardShapeCell(gameState, visitor) {
        if (typeof visitor !== 'function')
            return;
        if (BoardUtils && typeof BoardUtils.forEachBoardShapeCell === 'function') {
            BoardUtils.forEachBoardShapeCell(gameState, visitor);
            return;
        }
        if (!gameState || !Array.isArray(gameState.board))
            return;
        const config = resolveBoardConfig(gameState);
        for (let row = 0; row < config.rows; row++) {
            const boardRow = Array.isArray(gameState.board[row]) ? gameState.board[row] : [];
            for (let col = 0; col < config.cols; col++) {
                visitor(row, col, boardRow[col]);
            }
        }
        for (const cell of getExpansionCells(gameState)) {
            if (!cell)
                continue;
            visitor(cell.row, cell.col, Number(cell.owner));
        }
    }
    function hasBoardShapeCell(gameState, row, col) {
        return getCellValue(gameState, row, col) !== null;
    }
    function isBlockedCell(cardState, row, col) {
        if (Markers && typeof Markers.getBlockingMarkers === 'function') {
            return Markers.getBlockingMarkers(cardState).some(m => m.row === row && m.col === col);
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.some(m => (m &&
            m.kind === 'specialStone' &&
            m.row === row &&
            m.col === col &&
            m.data &&
            (m.data.type === 'BLOCKADE' || m.data.type === 'METEOR_HOLE' || m.data.type === 'FREEZE')));
    }
    function isAbsoluteProtectedCell(cardState, row, col) {
        if (Markers && typeof Markers.findSpecialMarkerAt === 'function') {
            return !!Markers.findSpecialMarkerAt(cardState, row, col, 'ABSOLUTE_PROTECTED');
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.some(m => (m &&
            m.kind === 'specialStone' &&
            m.row === row &&
            m.col === col &&
            m.data &&
            m.data.type === 'ABSOLUTE_PROTECTED'));
    }
    function isFrozenCell(cardState, row, col) {
        if (Markers && typeof Markers.isFrozenCellForCard === 'function') {
            return !!Markers.isFrozenCellForCard(cardState, row, col);
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.some(m => (m &&
            m.kind === 'specialStone' &&
            m.row === row &&
            m.col === col &&
            m.data &&
            m.data.type === 'FREEZE'));
    }
    function isMeteorHoleCell(cardState, row, col) {
        if (Markers && typeof Markers.isMeteorHoleCell === 'function') {
            return !!Markers.isMeteorHoleCell(cardState, row, col);
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.some(m => (m &&
            m.kind === 'specialStone' &&
            m.row === row &&
            m.col === col &&
            m.data &&
            m.data.type === 'METEOR_HOLE'));
    }
    function isGuardProtectedCell(cardState, row, col) {
        if (Markers && typeof Markers.isGuardProtectedCell === 'function') {
            return !!Markers.isGuardProtectedCell(cardState, row, col);
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.some(m => (m &&
            m.kind === 'specialStone' &&
            m.row === row &&
            m.col === col &&
            m.data &&
            m.data.type === 'GUARD'));
    }
    function hasSeedMarkerAt(cardState, row, col) {
        if (Markers && typeof Markers.findSpecialMarkerAt === 'function') {
            return !!Markers.findSpecialMarkerAt(cardState, row, col, 'SEED');
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.some(m => (m &&
            m.kind === 'specialStone' &&
            m.row === row &&
            m.col === col &&
            m.data &&
            m.data.type === 'SEED'));
    }
    function isSpecialStoneAt(cardState, row, col) {
        if (Markers && typeof Markers.isSpecialStoneAt === 'function') {
            return !!Markers.isSpecialStoneAt(cardState, row, col);
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.some(m => (m &&
            m.kind === 'specialStone' &&
            m.row === row &&
            m.col === col));
    }
    function getSpecialOwnerAt(cardState, row, col) {
        if (Markers && typeof Markers.getSpecialOwnerAt === 'function') {
            return Markers.getSpecialOwnerAt(cardState, row, col);
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const marker = markers.find(m => (m &&
            m.kind === 'specialStone' &&
            m.row === row &&
            m.col === col));
        return marker ? marker.owner : null;
    }
    function isBombCategoryMarker(marker) {
        if (Markers && typeof Markers.isBombCategoryMarker === 'function') {
            return Markers.isBombCategoryMarker(marker);
        }
        return !!(marker &&
            marker.kind === 'specialStone' &&
            marker.data &&
            marker.data.category === 'bomb');
    }
    function getSpecialMarkers(cardState) {
        if (Markers && typeof Markers.getSpecialMarkers === 'function') {
            return Markers.getSpecialMarkers(cardState);
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.filter(m => m && m.kind === 'specialStone');
    }
    function getBombMarkers(cardState) {
        if (Markers && typeof Markers.getBombMarkers === 'function') {
            return Markers.getBombMarkers(cardState);
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.filter(m => m && m.kind === 'specialStone' && m.data && m.data.category === 'bomb');
    }
    function findSpecialMarkerAt(cardState, row, col, type, owner) {
        if (Markers && typeof Markers.findSpecialMarkerAt === 'function') {
            return Markers.findSpecialMarkerAt(cardState, row, col, type, owner);
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.find(m => (m &&
            m.kind === 'specialStone' &&
            m.row === row &&
            m.col === col &&
            (!type || (m.data && m.data.type === type)) &&
            (!owner || m.owner === owner))) || null;
    }
    function toBoardCellKey(row, col) {
        return `${row},${col}`;
    }
    function getCurrentBoardShapeCells(cardState, gameState) {
        const cells = [];
        const config = resolveBoardConfig(gameState);
        for (let row = 0; row < config.rows; row++) {
            for (let col = 0; col < config.cols; col++) {
                if (isMeteorHoleCell(cardState, row, col))
                    continue;
                cells.push({ row, col });
            }
        }
        for (const desc of getExpansionCells(gameState)) {
            if (!desc || !Number.isInteger(desc.row) || !Number.isInteger(desc.col))
                continue;
            if (isMeteorHoleCell(cardState, desc.row, desc.col))
                continue;
            cells.push({ row: desc.row, col: desc.col });
        }
        return cells;
    }
    function getOccupiedBoardShapeCells(cardState, gameState) {
        return getCurrentBoardShapeCells(cardState, gameState)
            .filter((cell) => getCellValue(gameState, cell.row, cell.col) !== EMPTY);
    }
    function getEmptyBoardShapeCells(cardState, gameState) {
        return getCurrentBoardShapeCells(cardState, gameState)
            .filter((cell) => getCellValue(gameState, cell.row, cell.col) === EMPTY);
    }
    function isPositionSwapProtectedCell(cardState, row, col) {
        return !!(findSpecialMarkerAt(cardState, row, col, 'GLUTTONOUS') ||
            findSpecialMarkerAt(cardState, row, col, 'ABSOLUTE_PROTECTED'));
    }
    function collectEmptyNeighborCells(cardState, gameState, row, col) {
        const neighbors = [];
        const seen = new Set();
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0)
                    continue;
                const targetRow = row + dr;
                const targetCol = col + dc;
                if (!hasBoardShapeCell(gameState, targetRow, targetCol))
                    continue;
                if (getCellValue(gameState, targetRow, targetCol) !== EMPTY)
                    continue;
                if (isBlockedCell(cardState, targetRow, targetCol))
                    continue;
                const key = `${targetRow},${targetCol}`;
                if (seen.has(key))
                    continue;
                seen.add(key);
                neighbors.push({ row: targetRow, col: targetCol });
            }
        }
        return neighbors;
    }
    function getCardContext(cardState) {
        const specials = getSpecialMarkers(cardState);
        const absoluteProtectedStones = specials
            .filter((s) => s.data && s.data.type === 'ABSOLUTE_PROTECTED')
            .map((s) => ({
            row: s.row,
            col: s.col,
            owner: s.owner === 'black' ? (BLACK || 1) : (WHITE || -1)
        }));
        const blockedCells = [];
        for (const m of specials) {
            if (!m || !m.data)
                continue;
            if (m.data.type === 'BLOCKADE' || m.data.type === 'METEOR_HOLE' || m.data.type === 'FREEZE') {
                blockedCells.push({ row: m.row, col: m.col });
            }
        }
        return {
            absoluteProtectedStones,
            blockedCells
        };
    }
    function getTabooReverseDirectionalFlips(gameState, row, col, ownerVal, direction, context) {
        const blockedCells = context && context.blockedCells ? context.blockedCells : [];
        const absoluteProtectedStones = context && context.absoluteProtectedStones ? context.absoluteProtectedStones : [];
        const blockedSet = blockedCells.length
            ? new Set(blockedCells.map(p => `${p.row},${p.col}`))
            : null;
        const absoluteSet = absoluteProtectedStones.length
            ? new Set(absoluteProtectedStones.map((p) => `${p.row},${p.col}`))
            : null;
        const [dr, dc] = direction;
        const flips = [];
        let r = row + dr;
        let c = col + dc;
        while (getCellValue(gameState, r, c) === -ownerVal) {
            const key = `${r},${c}`;
            if (blockedSet && blockedSet.has(key)) {
                return [];
            }
            if (!(absoluteSet && absoluteSet.has(key))) {
                flips.push({ row: r, col: c });
            }
            r += dr;
            c += dc;
        }
        const tail = getCellValue(gameState, r, c);
        if (blockedSet && blockedSet.has(`${r},${c}`)) {
            return [];
        }
        if (tail === ownerVal) {
            return [];
        }
        return flips;
    }
    function countDiscsByPlayer(gameState, playerKey) {
        const playerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        let own = 0;
        let opp = 0;
        forEachBoardShapeCell(gameState, (r, c, value) => {
            if (value === playerVal)
                own += 1;
            else if (value === -playerVal)
                opp += 1;
        });
        return { own, opp };
    }
    function getDiscDisadvantageForPlayer(gameState, playerKey) {
        const counts = countDiscsByPlayer(gameState, playerKey);
        return Math.max(0, counts.opp - counts.own);
    }
    function hasStandardLegalMoveForPlayer(cardState, gameState, playerKey) {
        // Fallback: check if there is any empty cell with at least one opponent neighbor
        // and a self stone beyond it in any direction.
        const playerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const opponentVal = -playerVal;
        const directions = DIRECTIONS || [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1], [0, 1],
            [1, -1], [1, 0], [1, 1]
        ];
        for (const cell of getCurrentBoardShapeCells(cardState, gameState)) {
            const row = cell.row;
            const col = cell.col;
            if (getCellValue(gameState, row, col) !== EMPTY)
                continue;
            if (isBlockedCell(cardState, row, col))
                continue;
            for (const [dr, dc] of directions) {
                let r = row + dr;
                let c = col + dc;
                let hasOpponent = false;
                while (getCellValue(gameState, r, c) === opponentVal) {
                    hasOpponent = true;
                    r += dr;
                    c += dc;
                }
                if (hasOpponent && getCellValue(gameState, r, c) === playerVal) {
                    return true;
                }
            }
        }
        return false;
    }
    function getBoardExpansionGodCornerDescriptors(gameState) {
        const config = resolveBoardConfig(gameState);
        const lastRow = config.baseBounds.maxRow;
        const lastCol = config.baseBounds.maxCol;
        const outerMinRow = config.outerBounds.minRow;
        const outerMaxRow = config.outerBounds.maxRow;
        const outerMinCol = config.outerBounds.minCol;
        const outerMaxCol = config.outerBounds.maxCol;
        return [
            {
                row: 0,
                col: 0,
                cells: [
                    { row: outerMinRow, col: 0 },
                    { row: outerMinRow, col: outerMinCol },
                    { row: 0, col: outerMinCol }
                ]
            },
            {
                row: 0,
                col: lastCol,
                cells: [
                    { row: outerMinRow, col: lastCol },
                    { row: outerMinRow, col: outerMaxCol },
                    { row: 0, col: outerMaxCol }
                ]
            },
            {
                row: lastRow,
                col: 0,
                cells: [
                    { row: outerMaxRow, col: 0 },
                    { row: outerMaxRow, col: outerMinCol },
                    { row: lastRow, col: outerMinCol }
                ]
            },
            {
                row: lastRow,
                col: lastCol,
                cells: [
                    { row: lastRow, col: outerMaxCol },
                    { row: outerMaxRow, col: outerMaxCol },
                    { row: outerMaxRow, col: lastCol }
                ]
            }
        ];
    }
    function getBoardExpansionWillCellDescriptors(gameState) {
        const config = resolveBoardConfig(gameState);
        const cells = [];
        for (let row = 0; row < config.rows; row++) {
            cells.push({ row, col: config.outerBounds.minCol, side: 'left' });
            cells.push({ row, col: config.outerBounds.maxCol, side: 'right' });
        }
        return cells;
    }
    function resolveExpansionSide(side, row, col, gameState) {
        if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom')
            return side;
        const config = resolveBoardConfig(gameState);
        if (col === config.outerBounds.minCol)
            return 'left';
        if (col === config.outerBounds.maxCol)
            return 'right';
        if (row === config.outerBounds.minRow)
            return 'top';
        if (row === config.outerBounds.maxRow)
            return 'bottom';
        return null;
    }
    function normalizeExpansionOwner(owner) {
        return (owner === BLACK || owner === WHITE) ? owner : EMPTY;
    }
    function isInnerPlayableCellForReinforcement(cardState, gameState, row, col) {
        if (!hasBoardShapeCell(gameState, row, col))
            return false;
        const orthogonal = [
            [row - 1, col],
            [row + 1, col],
            [row, col - 1],
            [row, col + 1]
        ];
        return orthogonal.every((pos) => hasBoardShapeCell(gameState, pos[0], pos[1]));
    }
    function isAdjacentToAnyStoneForReinforcement(cardState, gameState, row, col) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0)
                    continue;
                const nextRow = row + dr;
                const nextCol = col + dc;
                if (!hasBoardShapeCell(gameState, nextRow, nextCol))
                    continue;
                if (getCellValue(gameState, nextRow, nextCol) !== EMPTY)
                    return true;
            }
        }
        return false;
    }
    // ---- 29 Target Functions ----
    function getTrapTargets(cardState, gameState, playerKey) {
        if (typeof Selectors.getTrapTargets === 'function') {
            return Selectors.getTrapTargets(cardState, gameState, playerKey);
        }
        const playerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const res = [];
        for (const cell of getOccupiedBoardShapeCells(cardState, gameState)) {
            const row = cell.row;
            const col = cell.col;
            if (getCellValue(gameState, row, col) !== playerVal)
                continue;
            const hasBomb = markers.some(m => m && m.row === row && m.col === col && isBombCategoryMarker(m));
            if (hasBomb)
                continue;
            if (isAbsoluteProtectedCell(cardState, row, col))
                continue;
            const hasOwnTrap = markers.some(m => (m &&
                m.row === row &&
                m.col === col &&
                m.kind === 'specialStone' &&
                m.owner === playerKey &&
                m.data &&
                m.data.type === 'TRAP'));
            if (hasOwnTrap)
                continue;
            res.push({ row, col });
        }
        return res;
    }
    function getTeleportTargets(cardState, gameState) {
        if (typeof Selectors.getTeleportTargets === 'function') {
            return Selectors.getTeleportTargets(cardState, gameState);
        }
        const destinations = getEmptyBoardShapeCells(cardState, gameState)
            .filter((cell) => !isBlockedCell(cardState, cell.row, cell.col));
        if (!destinations.length)
            return [];
        return getOccupiedBoardShapeCells(cardState, gameState)
            .filter((cell) => !isAbsoluteProtectedCell(cardState, cell.row, cell.col));
    }
    function getBoardExpansionTargets(cardState, gameState, playerKey) {
        if (typeof Selectors.getBoardExpansionTargets === 'function') {
            return Selectors.getBoardExpansionTargets(cardState, gameState, playerKey);
        }
        if (!gameState || !gameState.board)
            return [];
        const config = resolveBoardConfig(gameState);
        const blockedEdgeTargets = new Set();
        const expansionCells = getExpansionCells(gameState);
        for (const cell of expansionCells) {
            if (!cell)
                continue;
            if (cell.col === config.outerBounds.minCol && Number.isInteger(cell.row) && cell.row >= 0 && cell.row < config.rows) {
                blockedEdgeTargets.add(`${cell.row},0`);
            }
            if (cell.col === config.outerBounds.maxCol && Number.isInteger(cell.row) && cell.row >= 0 && cell.row < config.rows) {
                blockedEdgeTargets.add(`${cell.row},${config.baseBounds.maxCol}`);
            }
        }
        const res = [];
        for (let r = 0; r < config.rows; r++) {
            if (!blockedEdgeTargets.has(`${r},0`)) {
                res.push({ row: r, col: 0, side: 'left' });
            }
            if (!blockedEdgeTargets.has(`${r},${config.baseBounds.maxCol}`)) {
                res.push({ row: r, col: config.baseBounds.maxCol, side: 'right' });
            }
        }
        return res;
    }
    function getBoardShrinkTargets(cardState, gameState, playerKey) {
        if (typeof Selectors.getBoardShrinkTargets === 'function') {
            return Selectors.getBoardShrinkTargets(cardState, gameState, playerKey);
        }
        return [];
    }
    function getTabooReverseCandidates(cardState, gameState, playerKey, row, col) {
        if (!gameState || !Array.isArray(gameState.board))
            return [];
        if (!Number.isInteger(row) || !Number.isInteger(col))
            return [];
        const targetValue = getCellValue(gameState, row, col);
        if (targetValue !== EMPTY)
            return [];
        const context = getCardContext(cardState);
        const blockedCells = (context && Array.isArray(context.blockedCells)) ? context.blockedCells : [];
        const blockedSet = blockedCells.length
            ? new Set(blockedCells.map((p) => `${p.row},${p.col}`))
            : null;
        if (blockedSet && blockedSet.has(`${row},${col}`))
            return [];
        const ownerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const candidates = [];
        for (const direction of (DIRECTIONS || [])) {
            if (!Array.isArray(direction) || direction.length !== 2)
                continue;
            const flips = getTabooReverseDirectionalFlips(gameState, row, col, ownerVal, direction, context);
            if (!Array.isArray(flips) || flips.length === 0)
                continue;
            candidates.push({
                direction: [direction[0], direction[1]],
                flips,
                score: flips.length
            });
        }
        return candidates;
    }
    function getSelectableTargets(cardState, gameState, playerKey) {
        const pending = (cardState && cardState.pendingEffectByPlayer) ? cardState.pendingEffectByPlayer[playerKey] : null;
        if (!pending)
            return [];
        // Build local selectors map
        const localSelectors = {
            getTrapTargets,
            getGuardTargets,
            getTimeBombTargets,
            getTeleportTargets,
            getCellTeleportTargets,
            getCloneTargets,
            getSplitTargets,
            getBoardExpansionTargets,
            getBoardShrinkTargets,
            getBlockadeTargets,
            getMeteorTargets,
            getFreezeTargets,
            getSeedTargets,
            getTemptTargets,
            getCaptureTargets,
            getPositionSwapTargets,
            getDestroyTargets,
            getSwapTargets,
            getLivingWillTargets,
            getHyperactiveInheritTargets,
            getExtendLifeTargets,
            getCorrosionTargets,
            getBoardExpansionGodTargets,
            getBoardShrinkGodTargets
        };
        const SelectorOrchestrator = (function () {
            try {
                return require('../logic/cards-internal/selector-orchestrator');
            }
            catch (e) {
                return null;
            }
        })();
        if (SelectorOrchestrator && typeof SelectorOrchestrator.getSelectableTargetsForPending === 'function') {
            return SelectorOrchestrator.getSelectableTargetsForPending({
                cardState,
                gameState,
                playerKey,
                pending,
                selectorsModule: Selectors,
                constants: { BLACK, WHITE, EMPTY },
                helpers: {
                    getCurrentBoardShapeCellsForCard: getCurrentBoardShapeCells,
                    getCellValueForCard: getCellValue,
                    getExpansionDescriptorsForCard: getExpansionCells,
                    isPositionSwapProtectedCell
                },
                localSelectors
            });
        }
        // Fallback for common pending types
        const type = pending.type;
        if (type === 'TRAP_WILL')
            return getTrapTargets(cardState, gameState, playerKey);
        if (type === 'GUARD_WILL' || type === 'GUARDIAN_GOD')
            return getGuardTargets(cardState, gameState, playerKey);
        if (type === 'TIME_BOMB')
            return getTimeBombTargets(cardState, gameState, playerKey);
        if (type === 'TELEPORT_WILL')
            return getTeleportTargets(cardState, gameState);
        if (type === 'CELL_TELEPORT_WILL')
            return getCellTeleportTargets(cardState, gameState);
        if (type === 'CLONE_WILL')
            return getCloneTargets(cardState, gameState, playerKey);
        if (type === 'SPLIT_WILL')
            return getSplitTargets(cardState, gameState, playerKey);
        if (type === 'BOARD_EXPANSION_WILL')
            return getBoardExpansionTargets(cardState, gameState, playerKey);
        if (type === 'BOARD_SHRINK_WILL')
            return getBoardShrinkTargets(cardState, gameState, playerKey);
        if (type === 'BLOCKADE_WILL')
            return getBlockadeTargets(cardState, gameState, playerKey);
        if (type === 'METEOR_WILL')
            return getMeteorTargets(cardState, gameState, playerKey);
        if (type === 'FREEZE_WILL')
            return getFreezeTargets(cardState, gameState, playerKey);
        if (type === 'SEED_WILL')
            return getSeedTargets(cardState, gameState, playerKey);
        if (type === 'TEMPT_WILL')
            return getTemptTargets(cardState, gameState, playerKey);
        if (type === 'CAPTURE_WILL')
            return getCaptureTargets(cardState, gameState, playerKey);
        if (type === 'POSITION_SWAP_WILL')
            return getPositionSwapTargets(cardState, gameState, playerKey, pending);
        if (type === 'DESTROY_ONE_STONE')
            return getDestroyTargets(cardState, gameState);
        if (type === 'SWAP_WITH_ENEMY')
            return getSwapTargets(cardState, gameState, playerKey);
        if (type === 'LIVING_WILL')
            return getLivingWillTargets(cardState, gameState, playerKey);
        if (type === 'HYPERACTIVE_INHERIT_WILL')
            return getHyperactiveInheritTargets(cardState, gameState, playerKey);
        if (type === 'EXTEND_LIFE_WILL' || type === 'EXTEND_LIFE_GOD')
            return getExtendLifeTargets(cardState, gameState, playerKey);
        if (type === 'CORROSION_WILL')
            return getCorrosionTargets(cardState, gameState, playerKey);
        if (type === 'BOARD_EXPANSION_GOD')
            return getBoardExpansionGodTargets(cardState, gameState, playerKey);
        if (type === 'BOARD_SHRINK_GOD')
            return getBoardShrinkGodTargets(cardState, gameState, playerKey);
        return [];
    }
    function getDestroyTargets(cardState, gameState) {
        if (typeof Selectors.getDestroyTargets === 'function') {
            return Selectors.getDestroyTargets(cardState, gameState);
        }
        const res = [];
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        forEachBoardShapeCell(gameState, (r, c, owner) => {
            if (owner === EMPTY)
                return;
            const guarded = markers.some(m => m &&
                m.kind === 'specialStone' &&
                m.row === r &&
                m.col === c &&
                m.data &&
                m.data.type === 'GUARD');
            if (guarded)
                return;
            if (isFrozenCell(cardState, r, c))
                return;
            res.push({ row: r, col: c });
        });
        return res;
    }
    function getSwapTargets(cardState, gameState, playerKey) {
        if (typeof Selectors.getSwapTargets === 'function') {
            return Selectors.getSwapTargets(cardState, gameState, playerKey);
        }
        const res = [];
        const opVal = playerKey === 'black' ? WHITE : BLACK;
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const isHiddenTrapForPlayer = (m) => (m &&
            m.kind === 'specialStone' &&
            m.data &&
            m.data.type === 'TRAP' &&
            m.owner &&
            m.owner !== playerKey);
        forEachBoardShapeCell(gameState, (r, c, owner) => {
            if (owner !== opVal)
                return;
            const hasSpecialOrBomb = markers.some(m => {
                if (!m || m.row !== r || m.col !== c)
                    return false;
                if (m.kind !== 'specialStone')
                    return false;
                if (isHiddenTrapForPlayer(m))
                    return false;
                const isExpiredUltimateHyperactive = !!(m.data &&
                    m.data.type === 'ULTIMATE_HYPERACTIVE' &&
                    Number.isFinite(Number(m.data.remainingOwnerTurns)) &&
                    Number(m.data.remainingOwnerTurns) <= 0);
                if (isExpiredUltimateHyperactive)
                    return false;
                return true;
            });
            if (hasSpecialOrBomb)
                return;
            res.push({ row: r, col: c });
        });
        return res;
    }
    function getGuardTargets(cardState, gameState, playerKey) {
        if (typeof Selectors.getGuardTargets === 'function') {
            return Selectors.getGuardTargets(cardState, gameState, playerKey);
        }
        const playerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const res = [];
        for (const cell of getOccupiedBoardShapeCells(cardState, gameState)) {
            const row = cell.row;
            const col = cell.col;
            if (getCellValue(gameState, row, col) !== playerVal)
                continue;
            const hasBomb = markers.some(m => m && m.row === row && m.col === col && isBombCategoryMarker(m));
            if (hasBomb)
                continue;
            if (isAbsoluteProtectedCell(cardState, row, col))
                continue;
            res.push({ row, col });
        }
        return res;
    }
    function getCaptureTargets(cardState, gameState, playerKey) {
        if (typeof Targets.getCaptureWillTargets === 'function') {
            return Targets.getCaptureWillTargets(cardState, gameState, playerKey);
        }
        // Fallback: same as tempt targets filtered by capturable source
        const temptTargets = getTemptTargets(cardState, gameState, playerKey);
        return temptTargets.filter((target) => {
            const marker = findSpecialMarkerAt(cardState, target.row, target.col);
            return !!marker;
        });
    }
    function getTemptTargets(cardState, gameState, playerKey) {
        if (typeof Targets.getTemptWillTargets === 'function') {
            return Targets.getTemptWillTargets(cardState, gameState, playerKey);
        }
        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        const res = [];
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const isGuarded = (r, c) => markers.some(m => m &&
            m.kind === 'specialStone' &&
            m.row === r &&
            m.col === c &&
            m.data &&
            m.data.type === 'GUARD');
        forEachBoardShapeCell(gameState, (r, c) => {
            if (isGuarded(r, c))
                return;
            if (!isSpecialStoneAt(cardState, r, c))
                return;
            if (getSpecialOwnerAt(cardState, r, c) !== opponentKey)
                return;
            if (getCellValue(gameState, r, c) === EMPTY)
                return;
            res.push({ row: r, col: c });
        });
        return res;
    }
    function getPositionSwapTargets(cardState, gameState, playerKey, pending) {
        if (typeof Selectors.getPositionSwapTargets === 'function') {
            return Selectors.getPositionSwapTargets(cardState, gameState, playerKey, pending);
        }
        const res = [];
        const first = pending && pending.firstTarget ? pending.firstTarget : null;
        forEachBoardShapeCell(gameState, (r, c, owner) => {
            if (owner === EMPTY)
                return;
            if (first && first.row === r && first.col === c)
                return;
            if (isPositionSwapProtectedCell(cardState, r, c))
                return;
            res.push({ row: r, col: c });
        });
        return res;
    }
    function getSeedTargets(cardState, gameState, playerKey) {
        if (typeof Selectors.getSeedTargets === 'function') {
            return Selectors.getSeedTargets(cardState, gameState);
        }
        if (!gameState || !gameState.board)
            return [];
        const res = [];
        forEachBoardShapeCell(gameState, (r, c, owner) => {
            if (owner !== EMPTY)
                return;
            if (isBlockedCell(cardState, r, c))
                return;
            if (hasSeedMarkerAt(cardState, r, c))
                return;
            res.push({ row: r, col: c });
        });
        return res;
    }
    function getCloneTargets(cardState, gameState, playerKey) {
        if (typeof Selectors.getCloneTargets === 'function') {
            return Selectors.getCloneTargets(cardState, gameState, playerKey);
        }
        const playerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const res = [];
        for (const cell of getOccupiedBoardShapeCells(cardState, gameState)) {
            if (getCellValue(gameState, cell.row, cell.col) !== playerVal)
                continue;
            if (collectEmptyNeighborCells(cardState, gameState, cell.row, cell.col).length === 0)
                continue;
            res.push({ row: cell.row, col: cell.col });
        }
        return res;
    }
    function getSplitTargets(cardState, gameState, playerKey) {
        return getCloneTargets(cardState, gameState, playerKey);
    }
    function getBreedingTargets(cardState, gameState, playerKey) {
        // BREEDING_WILL is a next-stone effect; no board targets to select.
        return [];
    }
    function getMeteorTargets(cardState, gameState, playerKey) {
        if (typeof Selectors.getMeteorTargets === 'function') {
            return Selectors.getMeteorTargets(cardState, gameState);
        }
        if (!gameState || !gameState.board)
            return [];
        const res = [];
        forEachBoardShapeCell(gameState, (r, c) => {
            if (isMeteorHoleCell(cardState, r, c))
                return;
            if (isAbsoluteProtectedCell(cardState, r, c))
                return;
            res.push({ row: r, col: c });
        });
        return res;
    }
    function getFreezeTargets(cardState, gameState, playerKey) {
        if (typeof Selectors.getFreezeTargets === 'function') {
            return Selectors.getFreezeTargets(cardState, gameState);
        }
        if (!gameState || !gameState.board)
            return [];
        const res = [];
        forEachBoardShapeCell(gameState, (r, c) => {
            if (isBlockedCell(cardState, r, c))
                return;
            if (hasSeedMarkerAt(cardState, r, c))
                return;
            res.push({ row: r, col: c });
        });
        return res;
    }
    function getBlockadeTargets(cardState, gameState, playerKey) {
        if (typeof Selectors.getBlockadeTargets === 'function') {
            return Selectors.getBlockadeTargets(cardState, gameState);
        }
        if (!gameState || !gameState.board)
            return [];
        const res = [];
        forEachBoardShapeCell(gameState, (r, c, owner) => {
            if (owner !== EMPTY)
                return;
            if (isBlockedCell(cardState, r, c))
                return;
            if (hasSeedMarkerAt(cardState, r, c))
                return;
            res.push({ row: r, col: c });
        });
        return res;
    }
    function getCellTeleportTargets(cardState, gameState) {
        if (typeof Selectors.getCellTeleportTargets === 'function') {
            return Selectors.getCellTeleportTargets(cardState, gameState);
        }
        if (!gameState || !gameState.board)
            return [];
        const activeExpansionCells = getExpansionCells(gameState);
        const activeByKey = new Map();
        for (const cell of activeExpansionCells) {
            if (!cell)
                continue;
            activeByKey.set(`${cell.row},${cell.col}`, cell);
        }
        const destinations = [];
        const seen = new Set();
        const pushCandidate = (row, col, side) => {
            const key = `${row},${col}`;
            if (seen.has(key))
                return;
            seen.add(key);
            const activeCell = activeByKey.get(key) || null;
            const owner = activeCell ? normalizeExpansionOwner(activeCell.owner) : EMPTY;
            if (owner !== EMPTY)
                return;
            if (isBlockedCell(cardState, row, col))
                return;
            destinations.push({ row, col, side: resolveExpansionSide(side, row, col, gameState), active: !!activeCell });
        };
        for (const cell of getBoardExpansionWillCellDescriptors(gameState)) {
            if (!cell)
                continue;
            pushCandidate(cell.row, cell.col, cell.side);
        }
        for (const corner of getBoardExpansionGodCornerDescriptors(gameState)) {
            if (!corner || !Array.isArray(corner.cells))
                continue;
            for (const cell of corner.cells) {
                if (!cell)
                    continue;
                pushCandidate(cell.row, cell.col, resolveExpansionSide(null, cell.row, cell.col, gameState));
            }
        }
        if (!destinations.length)
            return [];
        const res = [];
        forEachBoardShapeCell(gameState, (r, c, owner) => {
            if (owner === EMPTY)
                return;
            if (isMeteorHoleCell(cardState, r, c))
                return;
            res.push({ row: r, col: c });
        });
        return res;
    }
    function getSniperTargets(cardState, gameState, playerKey) {
        // SNIPER_WILL is a next-stone effect; no board targets to select.
        return [];
    }
    function getTimeBombTargets(cardState, gameState, playerKey) {
        if (typeof Selectors.getTimeBombTargets === 'function') {
            return Selectors.getTimeBombTargets(cardState, gameState, playerKey);
        }
        return getGuardTargets(cardState, gameState, playerKey);
    }
    function getLightningTargets(cardState, gameState, playerKey) {
        // LIGHTNING_WILL is a next-stone effect; no board targets to select.
        return [];
    }
    function getCrossBombTargets(cardState, gameState, playerKey) {
        // CROSS_BOMB is a next-stone effect; no board targets to select.
        return [];
    }
    function getXBombTargets(cardState, gameState, playerKey) {
        // X_BOMB is a next-stone effect; no board targets to select.
        return [];
    }
    function getReinforcementTargets(cardState, gameState, playerKey) {
        if (!gameState || !Array.isArray(gameState.board))
            return [];
        return getEmptyBoardShapeCells(cardState, gameState)
            .filter((cell) => {
            const row = Number(cell && cell.row);
            const col = Number(cell && cell.col);
            if (!Number.isInteger(row) || !Number.isInteger(col))
                return false;
            if (!isInnerPlayableCellForReinforcement(cardState, gameState, row, col))
                return false;
            return isAdjacentToAnyStoneForReinforcement(cardState, gameState, row, col);
        });
    }
    function getEqualityTargets(cardState, gameState, playerKey) {
        // EQUALITY_WILL spawns on empty cells; return all empty spawnable cells.
        return getEmptyBoardShapeCells(cardState, gameState)
            .filter((cell) => !isBlockedCell(cardState, cell.row, cell.col));
    }
    function getCornerTributeTargets(cardState, gameState, playerKey) {
        // CORNER_TRIBUTE has no board targets; it is a condition-only card.
        return [];
    }
    function getLastResortTargets(cardState, gameState, playerKey) {
        // LAST_RESORT places stones on empty cells when no legal moves and losing.
        return getEmptyBoardShapeCells(cardState, gameState);
    }
    // Additional helpers that are also target-related and used by getSelectableTargets
    function getLivingWillTargets(cardState, gameState, playerKey) {
        if (typeof Selectors.getLivingWillTargets === 'function') {
            return Selectors.getLivingWillTargets(cardState, gameState, playerKey);
        }
        const playerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const res = [];
        for (const cell of getOccupiedBoardShapeCells(cardState, gameState)) {
            const row = cell.row;
            const col = cell.col;
            if (getCellValue(gameState, row, col) !== playerVal)
                continue;
            const hasBomb = markers.some(m => m && m.row === row && m.col === col && isBombCategoryMarker(m));
            if (hasBomb)
                continue;
            if (isAbsoluteProtectedCell(cardState, row, col))
                continue;
            const hasLivingWill = markers.some(m => (m &&
                m.row === row &&
                m.col === col &&
                m.kind === 'specialStone' &&
                m.data &&
                m.data.type === 'LIVING_WILL'));
            if (hasLivingWill)
                continue;
            res.push({ row, col });
        }
        return res;
    }
    function getHyperactiveInheritTargets(cardState, gameState, playerKey) {
        if (typeof Selectors.getHyperactiveInheritTargets === 'function') {
            return Selectors.getHyperactiveInheritTargets(cardState, gameState, playerKey);
        }
        return getGuardTargets(cardState, gameState, playerKey);
    }
    function getExtendLifeTargets(cardState, gameState, playerKey) {
        if (typeof Selectors.getExtendLifeTargets === 'function') {
            return Selectors.getExtendLifeTargets(cardState, gameState, playerKey);
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const res = [];
        for (const m of markers) {
            if (!m || m.kind !== 'specialStone')
                continue;
            if (m.owner !== playerKey)
                continue;
            const rem = (m.data && Number.isFinite(m.data.remainingOwnerTurns)) ? Number(m.data.remainingOwnerTurns) : null;
            if (!Number.isFinite(rem) || rem <= 0)
                continue;
            res.push({ row: m.row, col: m.col });
        }
        return res;
    }
    function getCorrosionTargets(cardState, gameState, playerKey) {
        if (typeof Selectors.getCorrosionTargets === 'function') {
            return Selectors.getCorrosionTargets(cardState, gameState, playerKey);
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const res = [];
        for (const m of markers) {
            if (!m || m.kind !== 'specialStone')
                continue;
            const rem = (m.data && Number.isFinite(m.data.remainingOwnerTurns)) ? Number(m.data.remainingOwnerTurns) : null;
            if (!Number.isFinite(rem) || rem <= 0)
                continue;
            res.push({ row: m.row, col: m.col });
        }
        return res;
    }
    function getBoardExpansionGodTargets(cardState, gameState, playerKey) {
        if (typeof Selectors.getBoardExpansionGodTargets === 'function') {
            return Selectors.getBoardExpansionGodTargets(cardState, gameState, playerKey);
        }
        if (!gameState || !gameState.board)
            return [];
        const expansionCells = getExpansionCells(gameState);
        const occupied = new Set(expansionCells.map((cell) => `${cell.row},${cell.col}`));
        const pending = cardState && cardState.pendingEffectByPlayer
            ? cardState.pendingEffectByPlayer[playerKey]
            : null;
        const selectedKeys = new Set();
        const selectedTargets = [];
        if (pending && pending.type === 'BOARD_EXPANSION_GOD') {
            if (pending.firstTarget && Number.isInteger(pending.firstTarget.row) && Number.isInteger(pending.firstTarget.col)) {
                selectedTargets.push(pending.firstTarget);
            }
            if (Array.isArray(pending.selectedTargets)) {
                selectedTargets.push(...pending.selectedTargets);
            }
        }
        for (const target of selectedTargets) {
            if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col))
                continue;
            selectedKeys.add(`${target.row},${target.col}`);
        }
        const res = [];
        for (const corner of getBoardExpansionGodCornerDescriptors(gameState)) {
            if (!corner || !Array.isArray(corner.cells))
                continue;
            if (selectedKeys.has(`${corner.row},${corner.col}`))
                continue;
            const hasOccupied = corner.cells.some((cell) => occupied.has(`${cell.row},${cell.col}`));
            if (hasOccupied)
                continue;
            res.push({ row: corner.row, col: corner.col });
        }
        return res;
    }
    function getBoardShrinkGodTargets(cardState, gameState, playerKey) {
        if (typeof Selectors.getBoardShrinkGodTargets === 'function') {
            return Selectors.getBoardShrinkGodTargets(cardState, gameState, playerKey);
        }
        return [];
    }
    return {
        getTrapTargets,
        getTeleportTargets,
        getBoardExpansionTargets,
        getBoardShrinkTargets,
        getTabooReverseCandidates,
        getSelectableTargets,
        getDestroyTargets,
        getSwapTargets,
        getGuardTargets,
        getCaptureTargets,
        getTemptTargets,
        getPositionSwapTargets,
        getSeedTargets,
        getCloneTargets,
        getSplitTargets,
        getBreedingTargets,
        getMeteorTargets,
        getFreezeTargets,
        getBlockadeTargets,
        getCellTeleportTargets,
        getSniperTargets,
        getTimeBombTargets,
        getLightningTargets,
        getCrossBombTargets,
        getXBombTargets,
        getReinforcementTargets,
        getEqualityTargets,
        getCornerTributeTargets,
        getLastResortTargets
    };
}));
//# sourceMappingURL=target-resolver.js.map