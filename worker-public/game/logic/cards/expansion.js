(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'), require('../../../shared/shared-board-utils'));
    } else {
        root.CardExpansion = factory(root.SharedConstants, root.SharedBoardUtils || null);
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (SharedConstants, SharedBoardUtils) {
    'use strict';

    const {
        BLACK,
        WHITE,
        EMPTY,
        BOARD_SIZE,
        INITIAL_BOARD_BONUS_DISTRIBUTION
    } = SharedConstants || {};
    const BoardUtils = SharedBoardUtils || null;

    function resolveCardBoardConfig(boardOrConfig) {
        if (BoardUtils && typeof BoardUtils.resolveBoardConfig === 'function') {
            return BoardUtils.resolveBoardConfig(boardOrConfig);
        }
        const board = Array.isArray(boardOrConfig)
            ? boardOrConfig
            : (boardOrConfig && Array.isArray(boardOrConfig.board) ? boardOrConfig.board : null);
        const rows = Array.isArray(board) && board.length > 0
            ? board.length
            : (Number.isInteger(BOARD_SIZE) ? BOARD_SIZE : 8);
        const cols = Array.isArray(board) && Array.isArray(board[0]) && board[0].length > 0
            ? board[0].length
            : rows;
        return {
            rows,
            cols,
            standard8x8: rows === 8 && cols === 8,
            baseBounds: {
                minRow: 0,
                maxRow: rows - 1,
                minCol: 0,
                maxCol: cols - 1
            },
            outerBounds: {
                minRow: -1,
                maxRow: rows,
                minCol: -1,
                maxCol: cols
            }
        };
    }

    function isMainBoardCellForCard(row, col, boardOrConfig) {
        if (BoardUtils && typeof BoardUtils.isMainBoardCell === 'function') {
            return BoardUtils.isMainBoardCell(row, col, boardOrConfig);
        }
        const config = resolveCardBoardConfig(boardOrConfig);
        return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < config.rows && col >= 0 && col < config.cols;
    }

    function resolveExpansionSideForCard(side, row, col, boardOrConfig) {
        if (BoardUtils && typeof BoardUtils.resolveExpansionSide === 'function') {
            return BoardUtils.resolveExpansionSide(side, row, col, boardOrConfig);
        }
        if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
        const config = resolveCardBoardConfig(boardOrConfig);
        if (col === config.outerBounds.minCol) return 'left';
        if (col === config.outerBounds.maxCol) return 'right';
        if (row === config.outerBounds.minRow) return 'top';
        if (row === config.outerBounds.maxRow) return 'bottom';
        return null;
    }

    function normalizeExpansionOwnerForCard(owner) {
        return (owner === BLACK || owner === WHITE) ? owner : EMPTY;
    }

    function isExpansionCoordinateForCard(row, col, boardOrConfig) {
        if (BoardUtils && typeof BoardUtils.isExpansionCoordinate === 'function') {
            return BoardUtils.isExpansionCoordinate(row, col, boardOrConfig);
        }
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        const config = resolveCardBoardConfig(boardOrConfig);
        if (row < config.outerBounds.minRow || row > config.outerBounds.maxRow) return false;
        if (col < config.outerBounds.minCol || col > config.outerBounds.maxCol) return false;
        if (isMainBoardCellForCard(row, col, config)) return false;
        return true;
    }

    function getOpeningCellsForCard(boardOrConfig) {
        if (BoardUtils && typeof BoardUtils.getOpeningCells === 'function') {
            return BoardUtils.getOpeningCells(boardOrConfig);
        }
        const config = resolveCardBoardConfig(boardOrConfig);
        const anchorRow = Math.floor((config.rows - 2) / 2);
        const anchorCol = Math.floor((config.cols - 2) / 2);
        return [
            { row: anchorRow, col: anchorCol },
            { row: anchorRow, col: anchorCol + 1 },
            { row: anchorRow + 1, col: anchorCol },
            { row: anchorRow + 1, col: anchorCol + 1 }
        ];
    }

    function collectInitialBoardBonusCandidates(boardOrConfig) {
        const config = resolveCardBoardConfig(boardOrConfig);
        const blocked = new Set();
        const orthogonalDirs = [
            { dr: -1, dc: 0 },
            { dr: 1, dc: 0 },
            { dr: 0, dc: -1 },
            { dr: 0, dc: 1 }
        ];
        const openingCells = getOpeningCellsForCard(config);
        for (const cell of openingCells) {
            blocked.add(`${cell.row},${cell.col}`);
            for (const dir of orthogonalDirs) {
                const nextRow = cell.row + dir.dr;
                const nextCol = cell.col + dir.dc;
                if (!isMainBoardCellForCard(nextRow, nextCol, config)) continue;
                blocked.add(`${nextRow},${nextCol}`);
            }
        }

        const cells = [];
        for (let row = 0; row < config.rows; row++) {
            for (let col = 0; col < config.cols; col++) {
                if (blocked.has(`${row},${col}`)) continue;
                cells.push({ row, col });
            }
        }
        return cells;
    }

    function getNormalizedInitialBonusDistribution() {
        const source = Array.isArray(INITIAL_BOARD_BONUS_DISTRIBUTION) && INITIAL_BOARD_BONUS_DISTRIBUTION.length > 0
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
        return source.reduce((out, entry, index) => {
            if (!entry) return out;
            const value = Number(entry.value);
            const count = Number(entry.count);
            if (!Number.isInteger(value) || value < 1 || value > 10) return out;
            if (!Number.isInteger(count) || count <= 0) return out;
            out.push({ value, count, index });
            return out;
        }, []);
    }

    function scaleInitialBonusDistribution(distribution, targetCount) {
        const normalizedTarget = Number.isFinite(Number(targetCount))
            ? Math.max(0, Math.trunc(Number(targetCount)))
            : 0;
        if (!(normalizedTarget > 0)) return [];
        const source = Array.isArray(distribution) ? distribution : [];
        const sourceTotal = source.reduce((sum, entry) => sum + (Number(entry && entry.count) || 0), 0);
        if (!(sourceTotal > 0)) return [];

        const scaled = source.map((entry, index) => {
            const exact = (entry.count * normalizedTarget) / sourceTotal;
            return {
                value: entry.value,
                count: Math.floor(exact),
                fraction: exact - Math.floor(exact),
                index
            };
        });

        let assigned = scaled.reduce((sum, entry) => sum + entry.count, 0);
        let remaining = Math.max(0, normalizedTarget - assigned);
        const priority = scaled
            .slice()
            .sort((a, b) => {
                if (b.fraction !== a.fraction) return b.fraction - a.fraction;
                return a.index - b.index;
            });
        for (let i = 0; i < priority.length && remaining > 0; i++) {
            priority[i].count += 1;
            assigned += 1;
            remaining -= 1;
        }
        return scaled.filter((entry) => entry.count > 0);
    }

    function getExpansionDescriptorsForCard(gameState) {
        const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
            ? gameState.boardExpansion
            : null;
        if (!expansion) return [];
        const boardConfig = resolveCardBoardConfig(gameState);

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
                if (!Number.isInteger(col) && side === 'left') col = boardConfig.outerBounds.minCol;
                if (!Number.isInteger(col) && side === 'right') col = boardConfig.outerBounds.maxCol;
            } else {
                side = source;
                row = legacyRow;
                if (side === 'left') col = boardConfig.outerBounds.minCol;
                if (side === 'right') col = boardConfig.outerBounds.maxCol;
            }

            if (!isExpansionCoordinateForCard(row, col, boardConfig)) return;
            if (out.some((desc) => desc && desc.row === row && desc.col === col)) return;
            out.push({
                side: resolveExpansionSideForCard(side, row, col, boardConfig),
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

    function syncLegacyExpansionFieldsForCard(expansion, boardOrConfig) {
        if (!expansion || typeof expansion !== 'object') return;
        if (!Array.isArray(expansion.cells)) expansion.cells = [];
        const latest = expansion.cells.length > 0 ? expansion.cells[expansion.cells.length - 1] : null;
        expansion.active = !!latest;
        expansion.side = latest ? resolveExpansionSideForCard(latest.side, latest.row, latest.col, boardOrConfig) : null;
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
        syncLegacyExpansionFieldsForCard(expansion, gameState);
        return expansion;
    }

    function writeExpansionDescriptorsForCard(gameState, cells) {
        const boardExpansion = ensureMutableBoardExpansionForCard(gameState);
        boardExpansion.cells = (Array.isArray(cells) ? cells : []).map((cell) => ({
            side: resolveExpansionSideForCard(cell && cell.side, cell && cell.row, cell && cell.col, gameState),
            row: cell && cell.row,
            col: cell && cell.col,
            owner: normalizeExpansionOwnerForCard(cell && cell.owner)
        }));
        syncLegacyExpansionFieldsForCard(boardExpansion, gameState);
        return boardExpansion;
    }

    function getCellValueForCard(gameState, row, col) {
        if (isMainBoardCellForCard(row, col, gameState)) {
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
        if (isMainBoardCellForCard(row, col, gameState)) {
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
                : (cell.side === 'left'
                    ? resolveCardBoardConfig(gameState).outerBounds.minCol
                    : (cell.side === 'right' ? resolveCardBoardConfig(gameState).outerBounds.maxCol : null));
            if (!Number.isInteger(cellCol)) continue;
            if (cell.row === row && cellCol === col) {
                expansion.cells[i] = {
                    side: resolveExpansionSideForCard(cell.side, cell.row, cellCol, gameState),
                    row: cell.row,
                    col: cellCol,
                    owner: normalizedOwner
                };
                syncLegacyExpansionFieldsForCard(expansion, gameState);
                return true;
            }
        }
        return false;
    }

    function getBoardExpansionGodCornerDescriptorsForCard(boardOrConfig) {
        const config = resolveCardBoardConfig(boardOrConfig);
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

    function getBoardExpansionGodAdditionsForCard(row, col, boardOrConfig) {
        const corner = getBoardExpansionGodCornerDescriptorsForCard(boardOrConfig)
            .find((entry) => entry && entry.row === row && entry.col === col);
        if (!corner || !Array.isArray(corner.cells)) return null;
        return corner.cells.map((cell) => ({ row: cell.row, col: cell.col }));
    }

    function getBoardExpansionWillCellDescriptorsForCard(boardOrConfig) {
        const config = resolveCardBoardConfig(boardOrConfig);
        const cells = [];
        for (let row = 0; row < config.rows; row++) {
            cells.push({ row, col: config.outerBounds.minCol, side: 'left' });
            cells.push({ row, col: config.outerBounds.maxCol, side: 'right' });
        }
        return cells;
    }

    function ensureExpansionCellForCard(gameState, row, col, owner) {
        const boardConfig = resolveCardBoardConfig(gameState);
        if (isMainBoardCellForCard(row, col, boardConfig)) return true;
        if (!isExpansionCoordinateForCard(row, col, boardConfig)) return false;

        const currentValue = getCellValueForCard(gameState, row, col);
        if (currentValue !== null) {
            return setCellValueForCard(gameState, row, col, owner == null ? currentValue : owner);
        }

        const validExpansionTargets = [];
        validExpansionTargets.push(...getBoardExpansionWillCellDescriptorsForCard(boardConfig));
        for (const corner of getBoardExpansionGodCornerDescriptorsForCard(boardConfig)) {
            if (!corner || !Array.isArray(corner.cells)) continue;
            for (const cell of corner.cells) {
                if (!cell) continue;
                validExpansionTargets.push({
                    row: cell.row,
                    col: cell.col,
                    side: resolveExpansionSideForCard(null, cell.row, cell.col, boardConfig)
                });
            }
        }

        const matched = validExpansionTargets.find((cell) => cell && cell.row === row && cell.col === col);
        if (!matched) return false;

        const cells = getExpansionDescriptorsForCard(gameState);
        cells.push({
            side: resolveExpansionSideForCard(matched.side, row, col, boardConfig),
            row,
            col,
            owner: normalizeExpansionOwnerForCard(owner)
        });
        writeExpansionDescriptorsForCard(gameState, cells);
        return true;
    }

    function buildInitialBoardBonusMap(prng, boardOrConfig) {
        const distribution = getNormalizedInitialBonusDistribution();
        const baseCandidates = collectInitialBoardBonusCandidates(resolveCardBoardConfig());
        const candidates = collectInitialBoardBonusCandidates(boardOrConfig);
        const baseCandidateCount = baseCandidates.length > 0 ? baseCandidates.length : 60;
        const baseDistributionTotal = distribution.reduce((sum, entry) => sum + entry.count, 0);
        const targetBonusCount = Math.min(
            candidates.length,
            Math.max(0, Math.round((candidates.length * baseDistributionTotal) / baseCandidateCount))
        );
        const scaledDistribution = scaleInitialBonusDistribution(distribution, targetBonusCount);
        const bonusValues = [];
        for (const entry of scaledDistribution) {
            for (let i = 0; i < entry.count; i++) bonusValues.push(entry.value);
        }

        const cells = candidates.slice();
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
