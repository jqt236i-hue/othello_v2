/**
 * @file swap_with_enemy.ts
 * @description SWAP_WITH_ENEMY helper - TypeScript module for browser and Node.js
 */

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
    : null) || (typeof self !== 'undefined' ? ((self as any).SharedBoardUtils || null) : null);

function resolveSwapWithEnemyModuleOrNull(id: string, resolveSelfFallback: () => any): any {
    if (typeof require === 'function') {
        try {
            return _require(id);
        } catch (e) {
            return null;
        }
    }
    return resolveSelfFallback();
}

const CardUtils = resolveSwapWithEnemyModuleOrNull('../cards/utils', () => {
    if (typeof self !== 'undefined' && (self as any).CardUtils) {
        return (self as any).CardUtils;
    }
    return null;
});

const CoreModule = resolveSwapWithEnemyModuleOrNull('../core', () => {
    if (typeof self !== 'undefined') {
        return (self as any).CoreLogic || (self as any).Core || null;
    }
    return null;
});

const { BLACK, WHITE, EMPTY, CHARGE_MAX } = SharedConstants || {};
const P_BLACK = BLACK || 1;
const P_WHITE = WHITE || -1;
const P_EMPTY = (typeof EMPTY === 'number') ? EMPTY : 0;

interface BoardBounds {
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
}

interface SwapResult {
    swapped: boolean;
    flipped?: { row: number; col: number }[];
}

interface SwapDeps {
    BoardOps?: any;
    clearHyperactiveAtPositions?: (cardState: any, positions: { row: number; col: number }[]) => void;
    clearBombAt?: (cardState: any, row: number, col: number) => void;
    Core?: any;
    cardContext?: any;
    emitPresentationEvent?: (cardState: any, event: any) => void;
}

function resolveBoardBounds(gameState: any): BoardBounds | null {
    if (SharedBoardUtils && typeof SharedBoardUtils.resolveBoardBounds === 'function') {
        return SharedBoardUtils.resolveBoardBounds(gameState && gameState.board);
    }
    const board = gameState && gameState.board;
    if (!Array.isArray(board) || board.length <= 0) return null;
    let maxCol = -1;
    for (const row of board) {
        if (Array.isArray(row) && row.length > 0) {
            maxCol = Math.max(maxCol, row.length - 1);
        }
    }
    if (maxCol < 0) return null;
    return { minRow: 0, maxRow: board.length - 1, minCol: 0, maxCol };
}

function isMainBoardCell(gameState: any, row: number, col: number): boolean {
    const bounds = resolveBoardBounds(gameState);
    return !!(
        bounds &&
        Number.isInteger(row) &&
        Number.isInteger(col) &&
        row >= bounds.minRow &&
        row <= bounds.maxRow &&
        col >= bounds.minCol &&
        col <= bounds.maxCol
    );
}

function normalizeFlips(flips: number[][]): [number, number][] {
    if (!Array.isArray(flips) || flips.length === 0) return [];
    return flips
        .filter(f => Array.isArray(f) && Number.isInteger(f[0]) && Number.isInteger(f[1]))
        .map(f => [f[0], f[1]] as [number, number]);
}

interface ExpansionCell {
    row: number;
    col: number;
    owner: number;
}

function getExpansionCells(gameState: any): ExpansionCell[] {
    const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
        ? gameState.boardExpansion
        : null;
    if (!expansion) return [];

    const cells = Array.isArray((expansion as any).cells)
        ? expansion.cells
        : (expansion.active ? [expansion] : []);

    return cells
        .map((cell: any) => {
            if (!cell || typeof cell !== 'object') return null;
            const row = Number(cell.row);
            const col = Number.isInteger(cell.col)
                ? cell.col
                : (
                    cell.side === 'left' ? -1
                        : (cell.side === 'right' ? ((resolveBoardBounds(gameState) || { maxCol: -1 }).maxCol + 1)
                            : (cell.side === 'top' || cell.side === 'bottom' ? Number(cell.col) : null))
                );
            if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
            return { row, col, owner: Number(cell.owner || 0) };
        })
        .filter(Boolean) as ExpansionCell[];
}

function getCellValue(gameState: any, row: number, col: number): number | null {
    if (!gameState || !Array.isArray(gameState.board)) return null;
    if (isMainBoardCell(gameState, row, col)) {
        return gameState.board[row][col];
    }
    const expansionCells = getExpansionCells(gameState);
    for (const cell of expansionCells) {
        if (cell.row === row && cell.col === col) return cell.owner;
    }
    return null;
}

function setCellValue(gameState: any, row: number, col: number, value: number): boolean {
    if (!gameState || !Array.isArray(gameState.board)) return false;
    if (isMainBoardCell(gameState, row, col)) {
        gameState.board[row][col] = value;
        return true;
    }
    const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
        ? gameState.boardExpansion
        : null;
    if (!expansion) return false;

    const cells = Array.isArray(expansion.cells)
        ? expansion.cells.slice()
        : (expansion.active ? [Object.assign({}, expansion)] : []);
    let changed = false;
    for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (!cell || typeof cell !== 'object') continue;
        const cellRow = Number(cell.row);
        const cellCol = Number.isInteger(cell.col)
            ? cell.col
            : (cell.side === 'left' ? -1 : (cell.side === 'right' ? ((resolveBoardBounds(gameState) || { maxCol: -1 }).maxCol + 1) : Number(cell.col)));
        if (!Number.isInteger(cellRow) || !Number.isInteger(cellCol)) continue;
        if (cellRow !== row || cellCol !== col) continue;
        cells[i] = Object.assign({}, cell, { owner: Number(value) });
        changed = true;
        break;
    }
    if (!changed) return false;

    if (Array.isArray(expansion.cells)) {
        expansion.cells = cells;
    } else if (expansion.active) {
        const matched = cells.find((cell: any) => cell && Number(cell.row) === row && Number(cell.col) === col);
        if (matched) expansion.owner = Number(value);
    }
    return true;
}

function resolveSwapFlips(gameState: any, row: number, col: number, player: number, context: any, core: any): [number, number][] {
    if (!core || typeof core.getFlipsWithContext !== 'function') return [];
    if (!gameState) return [];
    const prev = getCellValue(gameState, row, col);
    if (prev === null) return [];
    if (!setCellValue(gameState, row, col, P_EMPTY)) return [];
    try {
        return normalizeFlips(core.getFlipsWithContext(gameState, row, col, player, context || {}));
    } finally {
        setCellValue(gameState, row, col, prev);
    }
}

function applySwapWithEnemy(cardState: any, gameState: any, playerKey: string, row: number, col: number, deps: SwapDeps = {}): SwapResult {
    const boardOpsInstance = deps.BoardOps;
    const clearHyperactiveAtPositions = deps.clearHyperactiveAtPositions;
    const clearBombAt = deps.clearBombAt;
    const core = deps.Core || CoreModule || null;
    const cardContext = deps.cardContext || {};
    const result: SwapResult = { swapped: false };

    const player = playerKey === 'black' ? P_BLACK : P_WHITE;
    const opponent = -player;

    if (!gameState || getCellValue(gameState, row, col) !== opponent) return result;

    const hasSpecialOrBomb = (cardState.markers || []).some((m: any) => {
        if (!m || m.row !== row || m.col !== col) return false;
        if (m.kind !== 'specialStone') return false;
        const isHiddenTrapForPlayer = !!(m.data && m.data.type === 'TRAP' && m.owner && m.owner !== playerKey);
        if (isHiddenTrapForPlayer) return false;
        const isExpiredUltimateHyperactive = !!(
            m.data &&
            m.data.type === 'ULTIMATE_HYPERACTIVE' &&
            Number.isFinite(Number(m.data.remainingOwnerTurns)) &&
            Number(m.data.remainingOwnerTurns) <= 0
        );
        if (isExpiredUltimateHyperactive) return false;
        return true;
    });
    if (hasSpecialOrBomb) return result;

    if (boardOpsInstance && typeof boardOpsInstance.changeAt === 'function') {
        const changeResult = boardOpsInstance.changeAt(cardState, gameState, row, col, playerKey, 'SWAP', 'swap_with_enemy');
        if (!changeResult || changeResult.changed !== true) return result;
    } else {
        if (!setCellValue(gameState, row, col, player)) return result;
    }

    if (typeof clearHyperactiveAtPositions === 'function') {
        clearHyperactiveAtPositions(cardState, [{ row, col }]);
    } else if (cardState.markers && cardState.markers.length) {
        (cardState as any).markers = cardState.markers.filter((s: any) =>
            !(
                s.kind === 'specialStone' &&
                s.data &&
                (s.data.type === 'HYPERACTIVE' || s.data.type === 'ESCAPE_HYPERACTIVE' || s.data.type === 'EXTREME_HYPERACTIVE') &&
                s.row === row &&
                s.col === col
            )
        );
    }

    const swapFlips = resolveSwapFlips(gameState, row, col, player, cardContext, core);
    if (swapFlips.length > 0) {
        const appliedSwapFlips: { row: number; col: number }[] = [];
        for (const [fr, fc] of swapFlips) {
            let changed = true;
            if (boardOpsInstance && typeof boardOpsInstance.changeAt === 'function') {
                const changeRes = boardOpsInstance.changeAt(cardState, gameState, fr, fc, playerKey, 'SWAP', 'swap_with_enemy_capture');
                changed = !!(changeRes && changeRes.changed);
            } else {
                (gameState as any).board[fr][fc] = player;
            }
            if (!changed) continue;
            if (typeof clearBombAt === 'function') {
                clearBombAt(cardState, fr, fc);
            }
            appliedSwapFlips.push({ row: fr, col: fc });
        }
        if (appliedSwapFlips.length > 0 && typeof clearHyperactiveAtPositions === 'function') {
            clearHyperactiveAtPositions(cardState, appliedSwapFlips);
        }
    }

    (cardState as any).pendingEffectByPlayer = cardState.pendingEffectByPlayer || { black: null, white: null };
    (cardState as any).pendingEffectByPlayer[playerKey] = null;

    (cardState as any).charge = cardState.charge || { black: 0, white: 0 };
    const chargeGain = 1 + swapFlips.length;
    const chargeMeta = {
        popupKind: 'board',
        sourceType: 'swap_flip_gain',
        anchorRow: row,
        anchorCol: col
    };
    let added = 0;
    if (CardUtils && typeof CardUtils.addChargeWithDelta === 'function') {
        const deltaRes = CardUtils.addChargeWithDelta(cardState, playerKey, chargeGain, 'swap_flip_gain', chargeMeta);
        added = deltaRes ? (Number(deltaRes.delta) || 0) : 0;
    } else {
        const before = Number((cardState as any).charge[playerKey] || 0);
        (cardState as any).charge[playerKey] = Math.min(CHARGE_MAX || 99, ((cardState as any).charge[playerKey] || 0) + chargeGain);
        added = Number((cardState as any).charge[playerKey] || 0) - before;
    }
    if (added > 0 && typeof deps.emitPresentationEvent === 'function') {
        deps.emitPresentationEvent(cardState, {
            type: 'CHARGE_BUBBLE',
            player: playerKey,
            row,
            col,
            gained: added,
            meta: {
                owner: playerKey,
                sourceType: 'swap_flip_gain'
            }
        });
    }

    result.swapped = true;
    result.flipped = swapFlips.map(([fr, fc]) => ({ row: fr, col: fc }));
    return result;
}

export = {
    applySwapWithEnemy
};
