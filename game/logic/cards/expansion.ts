/**
 * @file expansion.ts
 * @description Board Expansion helpers (Shared between Browser and Headless)
 */

import type { CardState, GameState } from '../../../src/types';

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
    if (!BoardUtils || typeof BoardUtils.resolveBoardConfig !== 'function') {
        throw new Error('SharedBoardUtils.resolveBoardConfig is required by CardExpansion');
    }
    return BoardUtils.resolveBoardConfig(boardOrConfig);
}

function isMainBoardCellForCard(row: number, col: number, boardOrConfig: any): boolean {
    if (!BoardUtils || typeof BoardUtils.isMainBoardCell !== 'function') {
        throw new Error('SharedBoardUtils.isMainBoardCell is required by CardExpansion');
    }
    return BoardUtils.isMainBoardCell(row, col, boardOrConfig);
}

function resolveExpansionSideForCard(side: any, row: number, col: number, boardOrConfig: any): string | null {
    if (!BoardUtils || typeof BoardUtils.resolveExpansionSide !== 'function') {
        throw new Error('SharedBoardUtils.resolveExpansionSide is required by CardExpansion');
    }
    return BoardUtils.resolveExpansionSide(side, row, col, boardOrConfig);
}

function normalizeExpansionOwnerForCard(owner: any): number {
    return (owner === BLACK || owner === WHITE) ? owner : EMPTY;
}

function isExpansionCoordinateForCard(row: number, col: number, boardOrConfig: any): boolean {
    if (!BoardUtils || typeof BoardUtils.isExpansionCoordinate !== 'function') {
        throw new Error('SharedBoardUtils.isExpansionCoordinate is required by CardExpansion');
    }
    return BoardUtils.isExpansionCoordinate(row, col, boardOrConfig);
}

function getOpeningCellsForCard(boardOrConfig: any): Array<{ row: number; col: number }> {
    if (!BoardUtils || typeof BoardUtils.getOpeningCells !== 'function') {
        throw new Error('SharedBoardUtils.getOpeningCells is required by CardExpansion');
    }
    return BoardUtils.getOpeningCells(boardOrConfig);
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
            if (!isMainBoardCellForCard(row, col, config)) continue;
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

    const restrictedMinRow = minRow - 1;
    const restrictedMaxRow = maxRow + 1;
    const restrictedMinCol = minCol - 1;
    const restrictedMaxCol = maxCol + 1;
    for (let row = restrictedMinRow; row <= restrictedMaxRow; row++) {
        for (let col = restrictedMinCol; col <= restrictedMaxCol; col++) {
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

function getExpansionDescriptorsForCard(cardState: CardState | null, gameState: GameState): any[] {
    if (!BoardUtils || typeof BoardUtils.createBoardView !== 'function') {
        throw new Error('SharedBoardUtils.createBoardView is required by CardExpansion');
    }
    return BoardUtils.createBoardView(gameState, {
        cardState,
        strict: false
    }).expansionCells.map((cell: any) => ({ ...cell }));
}

function syncLegacyExpansionFieldsForCard(expansion: any, boardOrConfig: any): void {
    if (!expansion || typeof expansion !== 'object') return;
    if (!Array.isArray(expansion.cells)) expansion.cells = [];
    const latest = expansion.cells.length > 0 ? expansion.cells[expansion.cells.length - 1] : null;
    expansion.active = !!latest;
    expansion.side = latest ? resolveExpansionSideForCard(latest.side, latest.row, latest.col, boardOrConfig) : null;
    expansion.row = latest ? latest.row : null;
    expansion.col = latest ? latest.col : null;
    expansion.owner = latest ? normalizeExpansionOwnerForCard(latest.owner) : EMPTY;
}

function ensureMutableBoardExpansionForCard(cardState: CardState | null, gameState: GameState): any {
    if (!(gameState as any).boardExpansion || typeof (gameState as any).boardExpansion !== 'object') {
        (gameState as any).boardExpansion = {
            active: false,
            side: null,
            row: null,
            col: null,
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

    if (!BoardUtils || typeof BoardUtils.canonicalizeStateBoard !== 'function') {
        throw new Error('SharedBoardUtils.canonicalizeStateBoard is required by CardExpansion');
    }
    const inspection = BoardUtils.canonicalizeStateBoard(gameState, cardState, { strict: false });
    if (!inspection || inspection.ok !== true) {
        throw new Error('Invalid board expansion state');
    }
    return expansion;
}

function writeExpansionDescriptorsForCard(cardState: CardState | null, gameState: GameState, cells: any[]): any {
    const boardExpansion = ensureMutableBoardExpansionForCard(cardState, gameState);
    boardExpansion.cells = (Array.isArray(cells) ? cells : []).map((cell: any) => ({
        side: resolveExpansionSideForCard(cell && cell.side, cell && cell.row, cell && cell.col, gameState),
        row: cell && cell.row,
        col: cell && cell.col,
        owner: normalizeExpansionOwnerForCard(cell && cell.owner)
    }));
    if (!BoardUtils || typeof BoardUtils.canonicalizeStateBoard !== 'function') {
        throw new Error('SharedBoardUtils.canonicalizeStateBoard is required by CardExpansion');
    }
    const inspection = BoardUtils.canonicalizeStateBoard(gameState, cardState, { strict: false });
    if (!inspection || inspection.ok !== true) {
        throw new Error('Invalid board expansion descriptors');
    }
    return boardExpansion;
}

function getCellValueForCard(cardState: CardState | null, gameState: GameState, row: number, col: number): any {
    if (!BoardUtils || typeof BoardUtils.getStateCellValue !== 'function') {
        throw new Error('SharedBoardUtils.getStateCellValue is required by CardExpansion');
    }
    return BoardUtils.getStateCellValue(gameState, row, col, cardState);
}

function setCellValueForCard(cardState: CardState | null, gameState: GameState, row: number, col: number, value: any): boolean {
    if (!BoardUtils || typeof BoardUtils.setStateCellValue !== 'function') {
        throw new Error('SharedBoardUtils.setStateCellValue is required by CardExpansion');
    }
    return BoardUtils.setStateCellValue(gameState, row, col, value, cardState);
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

function ensureExpansionCellForCard(
    cardState: CardState | null,
    gameState: GameState,
    row: number,
    col: number,
    owner: any
): boolean {
    const boardConfig = resolveCardBoardConfig(gameState);
    if (isMainBoardCellForCard(row, col, boardConfig)) {
        return getCellValueForCard(cardState, gameState, row, col) !== null;
    }
    if (!isExpansionCoordinateForCard(row, col, boardConfig)) return false;

    const currentValue = getCellValueForCard(cardState, gameState, row, col);
    if (currentValue !== null) {
        return setCellValueForCard(cardState, gameState, row, col, owner == null ? currentValue : owner);
    }
    if (!BoardUtils || typeof BoardUtils.addStateExpansionCells !== 'function') {
        throw new Error('SharedBoardUtils.addStateExpansionCells is required by CardExpansion');
    }
    const result = BoardUtils.addStateExpansionCells(gameState, [{
        side: resolveExpansionSideForCard(null, row, col, boardConfig),
        row,
        col,
        owner: normalizeExpansionOwnerForCard(owner)
    }], cardState);
    if (!result || result.added !== true) return false;
    ensureMutableBoardExpansionForCard(cardState, gameState);
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
