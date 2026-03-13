(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.CardExpansion = factory(root.SharedConstants);
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (SharedConstants) {
    'use strict';

    const {
        BLACK,
        WHITE,
        EMPTY,
        BOARD_SIZE,
        INITIAL_BOARD_BONUS_DISTRIBUTION
    } = SharedConstants || {};

    function isMainBoardCellForCard(row, col) {
        const boardSize = Number.isInteger(BOARD_SIZE) ? BOARD_SIZE : 8;
        return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < boardSize && col >= 0 && col < boardSize;
    }

    function resolveExpansionSideForCard(side, row, col) {
        if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
        if (col === -1) return 'left';
        if (col === 8) return 'right';
        if (row === -1) return 'top';
        if (row === 8) return 'bottom';
        return null;
    }

    function normalizeExpansionOwnerForCard(owner) {
        return (owner === BLACK || owner === WHITE) ? owner : EMPTY;
    }

    function isExpansionCoordinateForCard(row, col) {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        if (row < -1 || row > 8 || col < -1 || col > 8) return false;
        if (isMainBoardCellForCard(row, col)) return false;
        return true;
    }

    function getExpansionDescriptorsForCard(gameState) {
        const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
            ? gameState.boardExpansion
            : null;
        if (!expansion) return [];

        const out = [];
        const pushDescriptor = (source, legacyRow, legacyOwner) => {
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

            if (!isExpansionCoordinateForCard(row, col)) return;
            if (out.some((desc) => desc && desc.row === row && desc.col === col)) return;
            out.push({
                side: resolveExpansionSideForCard(side, row, col),
                row,
                col,
                owner: normalizeExpansionOwnerForCard(owner)
            });
        };

        if (Array.isArray(expansion.cells)) {
            for (const cell of expansion.cells) {
                if (!cell || typeof cell !== 'object') continue;
                pushDescriptor(cell);
            }
        }

        if (out.length === 0 && expansion.active === true) {
            pushDescriptor(expansion);
        }

        return out;
    }

    function syncLegacyExpansionFieldsForCard(expansion) {
        if (!expansion || typeof expansion !== 'object') return;
        if (!Array.isArray(expansion.cells)) expansion.cells = [];
        const latest = expansion.cells.length > 0 ? expansion.cells[expansion.cells.length - 1] : null;
        expansion.active = !!latest;
        expansion.side = latest ? resolveExpansionSideForCard(latest.side, latest.row, latest.col) : null;
        expansion.row = latest ? latest.row : null;
        expansion.owner = latest ? normalizeExpansionOwnerForCard(latest.owner) : EMPTY;
    }

    function ensureMutableBoardExpansionForCard(gameState) {
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
        if (!expansion.usedByPlayer || typeof expansion.usedByPlayer !== 'object') {
            expansion.usedByPlayer = { black: false, white: false };
        } else {
            expansion.usedByPlayer.black = !!expansion.usedByPlayer.black;
            expansion.usedByPlayer.white = !!expansion.usedByPlayer.white;
        }

        const descriptors = getExpansionDescriptorsForCard(gameState);
        expansion.cells = descriptors.map((desc) => ({
            side: desc.side,
            row: desc.row,
            col: desc.col,
            owner: normalizeExpansionOwnerForCard(desc.owner)
        }));
        syncLegacyExpansionFieldsForCard(expansion);
        return expansion;
    }

    function writeExpansionDescriptorsForCard(gameState, cells) {
        const boardExpansion = ensureMutableBoardExpansionForCard(gameState);
        boardExpansion.cells = (Array.isArray(cells) ? cells : []).map((cell) => ({
            side: resolveExpansionSideForCard(cell && cell.side, cell && cell.row, cell && cell.col),
            row: cell && cell.row,
            col: cell && cell.col,
            owner: normalizeExpansionOwnerForCard(cell && cell.owner)
        }));
        syncLegacyExpansionFieldsForCard(boardExpansion);
        return boardExpansion;
    }

    function getCellValueForCard(gameState, row, col) {
        if (isMainBoardCellForCard(row, col)) {
            return (gameState && Array.isArray(gameState.board) && Array.isArray(gameState.board[row]))
                ? gameState.board[row][col]
                : null;
        }
        const descriptors = getExpansionDescriptorsForCard(gameState);
        for (const desc of descriptors) {
            if (!desc) continue;
            if (desc.row === row && desc.col === col) {
                return normalizeExpansionOwnerForCard(desc.owner);
            }
        }
        return null;
    }

    function setCellValueForCard(gameState, row, col, value) {
        if (isMainBoardCellForCard(row, col)) {
            if (!gameState || !Array.isArray(gameState.board) || !Array.isArray(gameState.board[row])) return false;
            gameState.board[row][col] = value;
            return true;
        }
        const expansion = ensureMutableBoardExpansionForCard(gameState);
        if (!Array.isArray(expansion.cells)) return false;
        const normalizedOwner = normalizeExpansionOwnerForCard(value);
        for (let i = 0; i < expansion.cells.length; i++) {
            const cell = expansion.cells[i];
            if (!cell) continue;
            const cellCol = Number.isInteger(cell.col)
                ? cell.col
                : (cell.side === 'left' ? -1 : (cell.side === 'right' ? 8 : null));
            if (!Number.isInteger(cellCol)) continue;
            if (cell.row === row && cellCol === col) {
                expansion.cells[i] = {
                    side: resolveExpansionSideForCard(cell.side, cell.row, cellCol),
                    row: cell.row,
                    col: cellCol,
                    owner: normalizedOwner
                };
                syncLegacyExpansionFieldsForCard(expansion);
                return true;
            }
        }
        return false;
    }

    function getBoardExpansionGodCornerDescriptorsForCard() {
        return [
            {
                row: 0,
                col: 0,
                cells: [
                    { row: -1, col: 0 },
                    { row: -1, col: -1 },
                    { row: 0, col: -1 }
                ]
            },
            {
                row: 0,
                col: 7,
                cells: [
                    { row: -1, col: 7 },
                    { row: -1, col: 8 },
                    { row: 0, col: 8 }
                ]
            },
            {
                row: 7,
                col: 0,
                cells: [
                    { row: 8, col: 0 },
                    { row: 8, col: -1 },
                    { row: 7, col: -1 }
                ]
            },
            {
                row: 7,
                col: 7,
                cells: [
                    { row: 7, col: 8 },
                    { row: 8, col: 8 },
                    { row: 8, col: 7 }
                ]
            }
        ];
    }

    function getBoardExpansionGodPendingSelectionsForCard(pending) {
        const res = [];
        if (!pending || pending.type !== 'BOARD_EXPANSION_GOD') return res;
        if (pending.firstTarget && Number.isInteger(pending.firstTarget.row) && Number.isInteger(pending.firstTarget.col)) {
            res.push({ row: pending.firstTarget.row, col: pending.firstTarget.col });
        }
        if (Array.isArray(pending.selectedTargets)) {
            for (const target of pending.selectedTargets) {
                if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col)) continue;
                res.push({ row: target.row, col: target.col });
            }
        }
        const unique = [];
        const seen = new Set();
        for (const target of res) {
            const key = `${target.row},${target.col}`;
            if (seen.has(key)) continue;
            seen.add(key);
            unique.push(target);
        }
        return unique;
    }

    function getBoardExpansionGodAdditionsForCard(row, col) {
        const corner = getBoardExpansionGodCornerDescriptorsForCard().find((entry) => entry && entry.row === row && entry.col === col);
        if (!corner || !Array.isArray(corner.cells)) return null;
        return corner.cells.map((cell) => ({ row: cell.row, col: cell.col }));
    }

    function getBoardExpansionWillCellDescriptorsForCard() {
        const boardSize = Number.isInteger(BOARD_SIZE) ? BOARD_SIZE : 8;
        const cells = [];
        for (let row = 0; row < boardSize; row++) {
            cells.push({ row, col: -1, side: 'left' });
            cells.push({ row, col: 8, side: 'right' });
        }
        return cells;
    }

    function ensureExpansionCellForCard(gameState, row, col, owner) {
        if (isMainBoardCellForCard(row, col)) return true;
        if (!isExpansionCoordinateForCard(row, col)) return false;

        const currentValue = getCellValueForCard(gameState, row, col);
        if (currentValue !== null) {
            return setCellValueForCard(gameState, row, col, owner == null ? currentValue : owner);
        }

        const validExpansionTargets = [];
        validExpansionTargets.push(...getBoardExpansionWillCellDescriptorsForCard());
        for (const corner of getBoardExpansionGodCornerDescriptorsForCard()) {
            if (!corner || !Array.isArray(corner.cells)) continue;
            for (const cell of corner.cells) {
                if (!cell) continue;
                validExpansionTargets.push({
                    row: cell.row,
                    col: cell.col,
                    side: resolveExpansionSideForCard(null, cell.row, cell.col)
                });
            }
        }

        const matched = validExpansionTargets.find((cell) => cell && cell.row === row && cell.col === col);
        if (!matched) return false;

        const cells = getExpansionDescriptorsForCard(gameState);
        cells.push({
            side: resolveExpansionSideForCard(matched.side, row, col),
            row,
            col,
            owner: normalizeExpansionOwnerForCard(owner)
        });
        writeExpansionDescriptorsForCard(gameState, cells);
        return true;
    }

    function buildInitialBoardBonusMap(prng) {
        const boardSize = Number.isInteger(BOARD_SIZE) ? BOARD_SIZE : 8;
        const center = Math.floor(boardSize / 2);
        const initialStoneCells = [
            { row: center - 1, col: center - 1 },
            { row: center - 1, col: center },
            { row: center, col: center - 1 },
            { row: center, col: center }
        ];
        const orthogonalDirs = [
            { dr: -1, dc: 0 },
            { dr: 1, dc: 0 },
            { dr: 0, dc: -1 },
            { dr: 0, dc: 1 }
        ];

        const blocked = new Set();
        for (const stone of initialStoneCells) {
            blocked.add(`${stone.row},${stone.col}`);
            for (const dir of orthogonalDirs) {
                const nextRow = stone.row + dir.dr;
                const nextCol = stone.col + dir.dc;
                if (nextRow < 0 || nextRow >= boardSize || nextCol < 0 || nextCol >= boardSize) continue;
                blocked.add(`${nextRow},${nextCol}`);
            }
        }

        const allEmptyCells = [];
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                const key = `${row},${col}`;
                if (blocked.has(key)) continue;
                allEmptyCells.push({ row, col });
            }
        }

        const distribution = Array.isArray(INITIAL_BOARD_BONUS_DISTRIBUTION) && INITIAL_BOARD_BONUS_DISTRIBUTION.length > 0
            ? INITIAL_BOARD_BONUS_DISTRIBUTION
            : [
                { value: 1, count: 9 },
                { value: 2, count: 8 },
                { value: 3, count: 6 },
                { value: 4, count: 5 },
                { value: 5, count: 4 },
                { value: 6, count: 3 },
                { value: 7, count: 2 },
                { value: 8, count: 1 },
                { value: 9, count: 1 },
                { value: 10, count: 1 }
            ];

        const bonusValues = [];
        for (const entry of distribution) {
            if (!entry) continue;
            const value = Number(entry.value);
            const count = Number(entry.count);
            if (!Number.isInteger(value) || value < 1 || value > 10) continue;
            if (!Number.isInteger(count) || count <= 0) continue;
            for (let i = 0; i < count; i++) bonusValues.push(value);
        }

        const cells = allEmptyCells.slice();
        const values = bonusValues.slice();
        if (prng && typeof prng.shuffle === 'function') {
            prng.shuffle(cells);
            prng.shuffle(values);
        }

        const out = {};
        const assignCount = Math.min(cells.length, values.length);
        for (let i = 0; i < assignCount; i++) {
            const cell = cells[i];
            out[`${cell.row},${cell.col}`] = values[i];
        }
        return out;
    }

    return {
        isMainBoardCellForCard,
        resolveExpansionSideForCard,
        normalizeExpansionOwnerForCard,
        isExpansionCoordinateForCard,
        getExpansionDescriptorsForCard,
        syncLegacyExpansionFieldsForCard,
        ensureMutableBoardExpansionForCard,
        writeExpansionDescriptorsForCard,
        getCellValueForCard,
        setCellValueForCard,
        getBoardExpansionGodCornerDescriptorsForCard,
        getBoardExpansionGodPendingSelectionsForCard,
        getBoardExpansionGodAdditionsForCard,
        getBoardExpansionWillCellDescriptorsForCard,
        ensureExpansionCellForCard,
        buildInitialBoardBonusMap
    };
}));