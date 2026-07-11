/**
 * @file expansion.ts
 * @description Board Expansion helpers (Shared between Browser and Headless)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

function _require(id: string): any {
    if (typeof __non_webpack_require__ !== 'undefined') {
        return __non_webpack_require__(id);
    }
    if (typeof require === 'function') {
        return require(id);
    }
    throw new Error('Unable to require ' + id);
}

function safeRequire(id: string): any {
    try {
        return _require(id);
    } catch (e) {
        return null;
    }
}

const SharedConstants = ((typeof module === 'object' && module.exports)
    ? safeRequire('../../../shared-constants')
    : null) || (typeof self !== 'undefined' ? (self as any).SharedConstants : undefined);

const SharedBoardUtils = ((typeof module === 'object' && module.exports)
    ? safeRequire('../../../shared/shared-board-utils')
    : null) || (typeof self !== 'undefined' ? (self as any).SharedBoardUtils : null);

const {
    BLACK,
    WHITE,
    EMPTY,
    BOARD_SIZE,
    INITIAL_BOARD_BONUS_DISTRIBUTION
} = SharedConstants || {};
const BoardUtils = SharedBoardUtils || null;

interface BoardConfig {
    rows: number;
    cols: number;
    standard8x8: boolean;
    baseBounds: {
        minRow: number;
        maxRow: number;
        minCol: number;
        maxCol: number;
    };
    outerBounds: {
        minRow: number;
        maxRow: number;
        minCol: number;
        maxCol: number;
    };
}

function resolveCardBoardConfig(boardOrConfig: any): BoardConfig {
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

function isMainBoardCellForCard(row: number, col: number, boardOrConfig: any): boolean {
    if (BoardUtils && typeof BoardUtils.isMainBoardCell === 'function') {
        return BoardUtils.isMainBoardCell(row, col, boardOrConfig);
    }
    const config = resolveCardBoardConfig(boardOrConfig);
    return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < config.rows && col >= 0 && col < config.cols;
}

function resolveExpansionSideForCard(side: any, row: number, col: number, boardOrConfig: any): string | null {
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

function normalizeExpansionOwnerForCard(owner: any): number {
    return (owner === BLACK || owner === WHITE) ? owner : EMPTY;
}

function isExpansionCoordinateForCard(row: number, col: number, boardOrConfig: any): boolean {
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

function getOpeningCellsForCard(boardOrConfig: any): Array<{ row: number; col: number }> {
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

function collectInitialBoardBonusCandidates(boardOrConfig: any): Array<{ row: number; col: number }> {
    const config = resolveCardBoardConfig(boardOrConfig);
    const blocked = new Set<string>();
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

    const cells: Array<{ row: number; col: number }> = [];
    for (let row = 0; row < config.rows; row++) {
        for (let col = 0; col < config.cols; col++) {
            if (blocked.has(`${row},${col}`)) continue;
            cells.push({ row, col });
        }
    }
    return cells;
}

function isLargeOpeningBonusRestrictionBoard(boardOrConfig: any): boolean {
    const config = resolveCardBoardConfig(boardOrConfig);
    return config.rows >= 8 && config.cols >= 8;
}

function getOpeningHighBonusRestrictedCellKeys(boardOrConfig: any): Set<string> {
    const config = resolveCardBoardConfig(boardOrConfig);
    const out = new Set<string>();
    if (!isLargeOpeningBonusRestrictionBoard(config)) return out;

    const openingCells = getOpeningCellsForCard(config);
    if (!Array.isArray(openingCells) || openingCells.length <= 0) return out;

    let minRow = Infinity;
    let maxRow = -Infinity;
    let minCol = Infinity;
    let maxCol = -Infinity;
    for (const cell of openingCells) {
        if (!cell || !Number.isInteger(cell.row) || !Number.isInteger(cell.col)) continue;
        minRow = Math.min(minRow, cell.row);
        maxRow = Math.max(maxRow, cell.row);
        minCol = Math.min(minCol, cell.col);
        maxCol = Math.max(maxCol, cell.col);
    }
    if (!Number.isFinite(minRow) || !Number.isFinite(maxRow) || !Number.isFinite(minCol) || !Number.isFinite(maxCol)) {
        return out;
    }

    for (let row = minRow - 1; row <= maxRow + 1; row++) {
        for (let col = minCol - 1; col <= maxCol + 1; col++) {
            if (!isMainBoardCellForCard(row, col, config)) continue;
            out.add(`${row},${col}`);
        }
    }
    return out;
}

function cellKeyOfBoardBonusCell(row: number, col: number): string {
    return `${row},${col}`;
}

function buildBoardBonusCellKeySet(cells: Array<{ row: number; col: number }>): Set<string> {
    const out = new Set<string>();
    for (const cell of cells) {
        if (!cell || !Number.isInteger(cell.row) || !Number.isInteger(cell.col)) continue;
        out.add(cellKeyOfBoardBonusCell(cell.row, cell.col));
    }
    return out;
}

function addCornerRiskBoardBonusCandidate(
    out: Array<{ row: number; col: number }>,
    seen: Set<string>,
    config: BoardConfig,
    allowedKeys: Set<string> | null,
    row: number,
    col: number
): void {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return;
    if (!isMainBoardCellForCard(row, col, config)) return;
    const key = cellKeyOfBoardBonusCell(row, col);
    if (allowedKeys && !allowedKeys.has(key)) return;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ row, col });
}

function collectCornerRiskBoardBonusCandidates(
    boardOrConfig: any,
    allowedKeys?: Set<string>
): Array<{ row: number; col: number }> {
    const config = resolveCardBoardConfig(boardOrConfig);
    const out: Array<{ row: number; col: number }> = [];
    const seen = new Set<string>();
    const allowed = allowedKeys instanceof Set ? allowedKeys : null;
    const maxRow = config.baseBounds.maxRow;
    const maxCol = config.baseBounds.maxCol;

    if (config.rows >= 3 && config.cols >= 3) {
        addCornerRiskBoardBonusCandidate(out, seen, config, allowed, 1, 1);
        addCornerRiskBoardBonusCandidate(out, seen, config, allowed, 1, maxCol - 1);
        addCornerRiskBoardBonusCandidate(out, seen, config, allowed, maxRow - 1, 1);
        addCornerRiskBoardBonusCandidate(out, seen, config, allowed, maxRow - 1, maxCol - 1);
    }

    if (config.rows >= 2 && config.cols >= 2) {
        addCornerRiskBoardBonusCandidate(out, seen, config, allowed, 0, 1);
        addCornerRiskBoardBonusCandidate(out, seen, config, allowed, 1, 0);
        addCornerRiskBoardBonusCandidate(out, seen, config, allowed, 0, maxCol - 1);
        addCornerRiskBoardBonusCandidate(out, seen, config, allowed, 1, maxCol);
        addCornerRiskBoardBonusCandidate(out, seen, config, allowed, maxRow - 1, 0);
        addCornerRiskBoardBonusCandidate(out, seen, config, allowed, maxRow, 1);
        addCornerRiskBoardBonusCandidate(out, seen, config, allowed, maxRow - 1, maxCol);
        addCornerRiskBoardBonusCandidate(out, seen, config, allowed, maxRow, maxCol - 1);
    }

    return out;
}

function findBoardBonusCellIndexByKey(
    cells: Array<{ row: number; col: number }>,
    preferredKeys: Set<string>,
    blockedKeys?: Set<string> | null
): number | null {
    for (let index = 0; index < cells.length; index += 1) {
        const cell = cells[index];
        if (!cell) continue;
        const key = cellKeyOfBoardBonusCell(cell.row, cell.col);
        if (!preferredKeys.has(key)) continue;
        if (blockedKeys && blockedKeys.has(key)) continue;
        return index;
    }
    return null;
}

interface DistributionEntry {
    value: number;
    count: number;
    index: number;
}

function getNormalizedInitialBonusDistribution(): DistributionEntry[] {
    const source = Array.isArray(INITIAL_BOARD_BONUS_DISTRIBUTION) && INITIAL_BOARD_BONUS_DISTRIBUTION.length > 0
        ? INITIAL_BOARD_BONUS_DISTRIBUTION
        : [
            { value: 1, count: 7 },
            { value: 2, count: 7 },
            { value: 3, count: 5 },
            { value: 4, count: 4 },
            { value: 5, count: 5 },
            { value: 6, count: 4 },
            { value: 7, count: 3 },
            { value: 8, count: 2 },
            { value: 9, count: 2 },
            { value: 10, count: 1 }
        ];
    return source.reduce((out: DistributionEntry[], entry: any, index: number) => {
        if (!entry) return out;
        const value = Number(entry.value);
        const count = Number(entry.count);
        if (!Number.isInteger(value) || value < 1 || value > 10) return out;
        if (!Number.isInteger(count) || count <= 0) return out;
        out.push({ value, count, index });
        return out;
    }, []);
}

interface ScaledEntry {
    value: number;
    count: number;
    fraction: number;
    index: number;
}

function scaleInitialBonusDistribution(distribution: any[], targetCount: any): ScaledEntry[] {
    const normalizedTarget = Number.isFinite(Number(targetCount))
        ? Math.max(0, Math.trunc(Number(targetCount)))
        : 0;
    if (!(normalizedTarget > 0)) return [];
    const source = Array.isArray(distribution) ? distribution : [];
    const sourceTotal = source.reduce((sum, entry) => sum + (Number(entry && entry.count) || 0), 0);
    if (!(sourceTotal > 0)) return [];

    const scaled: ScaledEntry[] = source.map((entry: any, index: number) => {
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

function getExpansionDescriptorsForCard(gameState: GameState): any[] {
    const expansion = (gameState && (gameState as any).boardExpansion && typeof (gameState as any).boardExpansion === 'object')
        ? (gameState as any).boardExpansion
        : null;
    if (!expansion) return [];
    if (BoardUtils && typeof BoardUtils.collectExpansionDescriptors === 'function') {
        return BoardUtils.collectExpansionDescriptors(expansion, gameState);
    }
    const boardConfig = resolveCardBoardConfig(gameState);

    const out: any[] = [];
    const pushDescriptor = (source: any, legacyRow?: any, legacyOwner?: any) => {
        let side: any = null;
        let row: any = null;
        let col: any = null;
        let owner: any = legacyOwner;

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

function syncLegacyExpansionFieldsForCard(expansion: any, boardOrConfig: any): void {
    if (!expansion || typeof expansion !== 'object') return;
    if (!Array.isArray(expansion.cells)) expansion.cells = [];
    const latest = expansion.cells.length > 0 ? expansion.cells[expansion.cells.length - 1] : null;
    expansion.active = !!latest;
    expansion.side = latest ? resolveExpansionSideForCard(latest.side, latest.row, latest.col, boardOrConfig) : null;
    expansion.row = latest ? latest.row : null;
    expansion.owner = latest ? normalizeExpansionOwnerForCard(latest.owner) : EMPTY;
}

function ensureMutableBoardExpansionForCard(gameState: GameState): any {
    if (!(gameState as any).boardExpansion || typeof (gameState as any).boardExpansion !== 'object') {
        (gameState as any).boardExpansion = {
            active: false,
            side: null,
            row: null,
            owner: EMPTY,
            usedByPlayer: { black: false, white: false },
            cells: []
        };
        return (gameState as any).boardExpansion;
    }

    const expansion = (gameState as any).boardExpansion;
    if (!expansion.usedByPlayer || typeof expansion.usedByPlayer !== 'object') {
        expansion.usedByPlayer = { black: false, white: false };
    } else {
        expansion.usedByPlayer.black = !!expansion.usedByPlayer.black;
        expansion.usedByPlayer.white = !!expansion.usedByPlayer.white;
    }

    const descriptors = getExpansionDescriptorsForCard(gameState);
    expansion.cells = descriptors.map((desc: any) => ({
        side: desc.side,
        row: desc.row,
        col: desc.col,
        owner: normalizeExpansionOwnerForCard(desc.owner)
    }));
    syncLegacyExpansionFieldsForCard(expansion, gameState);
    return expansion;
}

function writeExpansionDescriptorsForCard(gameState: GameState, cells: any[]): any {
    const boardExpansion = ensureMutableBoardExpansionForCard(gameState);
    boardExpansion.cells = (Array.isArray(cells) ? cells : []).map((cell: any) => ({
        side: resolveExpansionSideForCard(cell && cell.side, cell && cell.row, cell && cell.col, gameState),
        row: cell && cell.row,
        col: cell && cell.col,
        owner: normalizeExpansionOwnerForCard(cell && cell.owner)
    }));
    syncLegacyExpansionFieldsForCard(boardExpansion, gameState);
    return boardExpansion;
}

function getCellValueForCard(gameState: GameState, row: number, col: number): any {
    if (isMainBoardCellForCard(row, col, gameState)) {
        return (gameState && Array.isArray((gameState as any).board) && Array.isArray((gameState as any).board[row]))
            ? (gameState as any).board[row][col]
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

function setCellValueForCard(gameState: GameState, row: number, col: number, value: any): boolean {
    if (isMainBoardCellForCard(row, col, gameState)) {
        if (!gameState || !Array.isArray((gameState as any).board) || !Array.isArray((gameState as any).board[row])) return false;
        (gameState as any).board[row][col] = value;
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

function copyBoardExpansionSelectionForCard(target: any): any {
    return {
        row: target.row,
        col: target.col,
        ...(typeof target.directionKey === 'string' && target.directionKey ? { directionKey: target.directionKey } : {}),
        ...(Array.isArray(target.additions) ? {
            additions: target.additions
                .filter((cell: any) => cell && Number.isInteger(cell.row) && Number.isInteger(cell.col))
                .map((cell: any) => ({ row: cell.row, col: cell.col }))
        } : {})
    };
}

function getBoardExpansionGodPendingSelectionsForCard(pending: any): any[] {
    const res: any[] = [];
    if (!pending || pending.type !== 'BOARD_EXPANSION_GOD') return res;
    if (pending.firstTarget && Number.isInteger(pending.firstTarget.row) && Number.isInteger(pending.firstTarget.col)) {
        res.push(copyBoardExpansionSelectionForCard(pending.firstTarget));
    }
    if (Array.isArray(pending.selectedTargets)) {
        for (const target of pending.selectedTargets) {
            if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col)) continue;
            res.push(copyBoardExpansionSelectionForCard(target));
        }
    }
    const unique: any[] = [];
    const seen = new Set<string>();
    for (const target of res) {
        const key = `${target.row},${target.col},${target.directionKey || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(target);
    }
    return unique;
}

function ensureExpansionCellForCard(gameState: GameState, row: number, col: number, owner: any): boolean {
    const boardConfig = resolveCardBoardConfig(gameState);
    if (isMainBoardCellForCard(row, col, boardConfig)) return true;
    if (!isExpansionCoordinateForCard(row, col, boardConfig)) return false;

    const currentValue = getCellValueForCard(gameState, row, col);
    if (currentValue !== null) {
        return setCellValueForCard(gameState, row, col, owner == null ? currentValue : owner);
    }

    const cells = getExpansionDescriptorsForCard(gameState);
    cells.push({
        side: resolveExpansionSideForCard(null, row, col, boardConfig),
        row,
        col,
        owner: normalizeExpansionOwnerForCard(owner)
    });
    writeExpansionDescriptorsForCard(gameState, cells);
    return true;
}

function buildInitialBoardBonusMap(prng: any, boardOrConfig: any): Record<string, number> {
    const distribution = getNormalizedInitialBonusDistribution();
    const baseCandidates = collectInitialBoardBonusCandidates({ rows: 8, cols: 8 });
    const candidates = collectInitialBoardBonusCandidates(boardOrConfig);
    const baseCandidateCount = baseCandidates.length > 0 ? baseCandidates.length : 60;
    const baseDistributionTotal = distribution.reduce((sum, entry) => sum + entry.count, 0);
    const targetBonusCount = Math.min(
        candidates.length,
        Math.max(0, Math.round((candidates.length * baseDistributionTotal) / baseCandidateCount))
    );
    const scaledDistribution = scaleInitialBonusDistribution(distribution, targetBonusCount);
    const bonusValues: number[] = [];
    for (const entry of scaledDistribution) {
        for (let i = 0; i < entry.count; i++) bonusValues.push(entry.value);
    }

    const cells = candidates.slice();
    const highNumberValues = bonusValues.filter((value) => value >= 8);
    const regularValues = bonusValues.filter((value) => value < 8);
    if (prng && typeof prng.shuffle === 'function') {
        prng.shuffle(cells);
        prng.shuffle(highNumberValues);
        prng.shuffle(regularValues);
    }
    const values = highNumberValues.concat(regularValues);

    const out: Record<string, number> = {};
    const assignCount = Math.min(cells.length, values.length);
    const highBonusRestrictedCellKeys = getOpeningHighBonusRestrictedCellKeys(boardOrConfig);
    const useHighBonusRestriction = highBonusRestrictedCellKeys.size > 0;
    const candidateCellKeys = buildBoardBonusCellKeySet(candidates);
    const highNumberPreferredCellKeys = buildBoardBonusCellKeySet(
        collectCornerRiskBoardBonusCandidates(boardOrConfig, candidateCellKeys)
    );

    for (let i = 0; i < assignCount; i++) {
        const value = values[i];
        const avoidOpeningHighBonusZone = useHighBonusRestriction && value >= 6;
        let cellIndex: number | null = null;

        if (value >= 8 && highNumberPreferredCellKeys.size > 0) {
            cellIndex = findBoardBonusCellIndexByKey(
                cells,
                highNumberPreferredCellKeys,
                avoidOpeningHighBonusZone ? highBonusRestrictedCellKeys : null
            );
        }

        if (cellIndex === null && avoidOpeningHighBonusZone) {
            const unrestrictedIndex = cells.findIndex((cell) => {
                if (!cell) return false;
                return !highBonusRestrictedCellKeys.has(cellKeyOfBoardBonusCell(cell.row, cell.col));
            });
            if (unrestrictedIndex >= 0) cellIndex = unrestrictedIndex;
        }

        const cell = cells.splice(cellIndex === null ? 0 : cellIndex, 1)[0];
        out[cellKeyOfBoardBonusCell(cell.row, cell.col)] = value;
    }
    return out;
}

export = {
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
    getBoardExpansionGodPendingSelectionsForCard,
    ensureExpansionCellForCard,
    buildInitialBoardBonusMap
};
