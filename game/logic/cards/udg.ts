/**
 * @file udg.ts
 * @description Ultimate Destroy God (UDG) effect helpers
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

function getRuntimeGlobalValue(key: string): any {
    if (typeof self !== 'undefined' && (self as any)[key]) {
        return (self as any)[key];
    }
    return undefined;
}

function safeRequire(id: string): any {
    try {
        return _require(id);
    } catch (e) {
        return null;
    }
}

const SharedConstants = (() => {
    if (typeof module === 'object' && module.exports) {
        return safeRequire('../../../shared-constants') || getRuntimeGlobalValue('SharedConstants');
    }

    return getRuntimeGlobalValue('SharedConstants');
})();

const BoardOpsModule = ((typeof module === 'object' && module.exports)
    ? safeRequire('../board_ops')
    : null) || getRuntimeGlobalValue('BoardOps');

const RandomSourceModule = ((typeof module === 'object' && module.exports)
    ? safeRequire('../cards-internal/random-source')
    : null) || getRuntimeGlobalValue('CardRandomSource');

const { BLACK, WHITE, EMPTY } = SharedConstants || {};
const P_BLACK = (BLACK === undefined || BLACK === null) ? 1 : BLACK;
const P_WHITE = (WHITE === undefined || WHITE === null) ? -1 : WHITE;
const P_EMPTY = (EMPTY === undefined || EMPTY === null) ? 0 : EMPTY;

function normalizeExpansionOwner(owner: any): number {
    return (owner === P_BLACK || owner === P_WHITE) ? owner : P_EMPTY;
}

interface BoardDims {
    rows: number;
    cols: number;
}

function resolveBoardDims(gameState: GameState): BoardDims {
    const board = gameState && Array.isArray((gameState as any).board) ? (gameState as any).board : null;
    const rows = board && board.length > 0 ? board.length : 8;
    const cols = board && Array.isArray(board[0]) && board[0].length > 0 ? board[0].length : rows;
    return { rows, cols };
}

function isMainBoardCell(row: number, col: number, gameState: GameState): boolean {
    const dims = resolveBoardDims(gameState);
    return Number.isInteger(row) && row >= 0 && row < dims.rows && Number.isInteger(col) && col >= 0 && col < dims.cols;
}

function resolveExpansionSide(side: any, row: number, col: number, gameState: GameState): string | null {
    if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
    const dims = resolveBoardDims(gameState);
    if (col === -1) return 'left';
    if (col === dims.cols) return 'right';
    if (row === -1) return 'top';
    if (row === dims.rows) return 'bottom';
    return null;
}

function isExpansionCoordinate(row: number, col: number, gameState: GameState): boolean {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    const dims = resolveBoardDims(gameState);
    if (row < -1 || row > dims.rows || col < -1 || col > dims.cols) return false;
    if (isMainBoardCell(row, col, gameState)) return false;
    return true;
}

function syncLegacyExpansionFields(expansion: any, gameState: GameState): void {
    if (!expansion || typeof expansion !== 'object') return;
    if (!Array.isArray(expansion.cells)) expansion.cells = [];
    const latest = expansion.cells.length > 0 ? expansion.cells[expansion.cells.length - 1] : null;
    expansion.active = !!latest;
    expansion.side = latest ? resolveExpansionSide(latest.side, latest.row, latest.col, gameState) : null;
    expansion.row = latest ? latest.row : null;
    expansion.owner = latest ? normalizeExpansionOwner(latest.owner) : EMPTY;
}

function getExpansionCells(gameState: GameState): any[] {
    if (BoardOpsModule && typeof BoardOpsModule.getExpansionDescriptors === 'function') {
        return BoardOpsModule.getExpansionDescriptors(gameState);
    }
    const expansion = (gameState && (gameState as any).boardExpansion && typeof (gameState as any).boardExpansion === 'object')
        ? (gameState as any).boardExpansion
        : null;
    if (!expansion) return [];

    const cells: any[] = [];
    const pushCell = (source: any, legacyRow?: any, legacyOwner?: any) => {
        let side: any = null;
        let row: any = null;
        let col: any = null;
        let owner: any = legacyOwner;

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

function ensureExpansionStateMutable(gameState: GameState): any {
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
    const cells = getExpansionCells(gameState);
    expansion.cells = cells.map((cell: any) => ({
        side: cell.side,
        row: cell.row,
        col: cell.col,
        owner: normalizeExpansionOwner(cell.owner)
    }));
    syncLegacyExpansionFields(expansion, gameState);
    return expansion;
}

function getCellValue(gameState: GameState, row: number, col: number): any {
    if (BoardOpsModule && typeof BoardOpsModule.getCellValue === 'function') {
        return BoardOpsModule.getCellValue(gameState, row, col);
    }
    if (isMainBoardCell(row, col, gameState)) return (gameState as any).board[row][col];
    const expansionCells = getExpansionCells(gameState);
    for (const expansion of expansionCells) {
        if (!expansion) continue;
        if (expansion.row === row && expansion.col === col) return expansion.owner;
    }
    return null;
}

function setCellValue(gameState: GameState, row: number, col: number, value: any): boolean {
    if (BoardOpsModule && typeof BoardOpsModule.setCellValue === 'function') {
        return BoardOpsModule.setCellValue(gameState, row, col, value);
    }
    if (isMainBoardCell(row, col, gameState)) {
        (gameState as any).board[row][col] = value;
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

function isBlockedDestinationCell(cardState: CardState, row: number, col: number): boolean {
    const markers = (cardState && Array.isArray((cardState as any).markers)) ? (cardState as any).markers : [];
    return markers.some((marker: any) => {
        if (!marker || marker.row !== row || marker.col !== col) return false;
        if (marker.kind !== 'specialStone') return false;
        const markerType = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
        return markerType === 'BLOCKADE' || markerType === 'METEOR_HOLE' || markerType === 'FREEZE';
    });
}

interface UDGDeps {
    selectRandomEmptyBoardShapeDestination?: (cardState: CardState, gameState: GameState, fromRow: number, fromCol: number, randomSource?: any) => { row: number; col: number } | null;
    randomSource?: any;
    moveCoexistingSpecialMarkers?: (cardState: CardState, anchorEntry: any, fromRow: number, fromCol: number, toRow: number, toCol: number) => void;
    destroyAt?: (cardState: CardState, gameState: GameState, row: number, col: number) => boolean;
    BoardOps?: any;
    decrementRemainingOwnerTurns?: boolean;
}

function getRandomTurnStartMoveDestination(cardState: CardState, gameState: GameState, fromRow: number, fromCol: number, deps: UDGDeps = {}): { row: number; col: number } | null {
    if (deps && typeof deps.selectRandomEmptyBoardShapeDestination === 'function') {
        return deps.selectRandomEmptyBoardShapeDestination(cardState, gameState, fromRow, fromCol, deps.randomSource);
    }
    const candidates: Array<{ row: number; col: number }> = [];
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
    const randomSource = (RandomSourceModule && typeof RandomSourceModule.resolveRandomSource === 'function')
        ? RandomSourceModule.resolveRandomSource(
            deps && deps.randomSource,
            null,
            'CardUdG.selectRandomEmptyDestination'
        )
        : deps.randomSource;
    const rawIndex = Math.floor(randomSource.random() * candidates.length);
    const index = Math.max(0, Math.min(candidates.length - 1, rawIndex));
    return candidates[index] || candidates[0] || null;
}

function moveCoexistingMarkers(cardState: CardState, anchorEntry: any, fromRow: number, fromCol: number, toRow: number, toCol: number, deps: UDGDeps = {}): void {
    if (deps && typeof deps.moveCoexistingSpecialMarkers === 'function') {
        deps.moveCoexistingSpecialMarkers(cardState, anchorEntry, fromRow, fromCol, toRow, toCol);
        return;
    }
    if (!Array.isArray(cardState && (cardState as any).markers)) return;
    for (const marker of (cardState as any).markers) {
        if (!marker || marker === anchorEntry) continue;
        if (marker.row !== fromRow || marker.col !== fromCol) continue;
        if (marker.kind === 'specialStone') {
            const markerTypeUpper = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
            if (markerTypeUpper === 'BLOCKADE' || markerTypeUpper === 'METEOR_HOLE' || markerTypeUpper === 'FREEZE' || markerTypeUpper === 'SEED') continue;
        }
        marker.row = toRow;
        marker.col = toCol;
    }
}

function forEachNeighborCell(gameState: GameState, row: number, col: number, handler: (r: number, c: number, value: any) => void): void {
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

interface CellSnapshot {
    row: number;
    col: number;
    value: any;
}

function getNeighborCellsSnapshot(gameState: GameState, row: number, col: number): CellSnapshot[] {
    const cells: CellSnapshot[] = [];
    forEachNeighborCell(gameState, row, col, (r, c, value) => {
        cells.push({ row: r, col: c, value });
    });
    return cells;
}

interface ProcessAnchorResult {
    moved: Array<{ from: { row: number; col: number }; to: { row: number; col: number } }>;
    destroyed: Array<{ row: number; col: number }>;
    anchors: Array<{ row: number; col: number; remainingNow: number }>;
    expired: Array<{ row: number; col: number; owner: PlayerKey; reason: string }>;
}

function collectDestroyedNeighbors(cardState: CardState, gameState: GameState, playerKey: PlayerKey, opponent: number, sourceRow: number, sourceCol: number, deps: UDGDeps = {}): Array<{ row: number; col: number }> {
    const destroyed: Array<{ row: number; col: number }> = [];
    const destroyAt = deps.destroyAt || ((cs: any, gs: GameState, r: number, c: number) => {
        const current = getCellValue(gs, r, c);
        if (current === null || current === EMPTY) return false;
        if (cs.markers) cs.markers = cs.markers.filter((m: any) => !(m.row === r && m.col === c));
        setCellValue(gs, r, c, EMPTY);
        return true;
    });

    const neighborCells = getNeighborCellsSnapshot(gameState, sourceRow, sourceCol);
    const targets = neighborCells.filter((cell) => cell && cell.value === opponent);
    const forbiddenEvadeCells = neighborCells.map((cell) => ({ row: cell.row, col: cell.col }));
    const destroyTargets = () => {
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
    };
    if (deps.BoardOps && typeof deps.BoardOps.runDestroyBlock === 'function') {
        deps.BoardOps.runDestroyBlock(cardState, gameState, destroyTargets, {});
    } else {
        destroyTargets();
    }

    return destroyed;
}

function processUltimateDestroyGodTurnStartAnchorCore(cardState: CardState, gameState: GameState, udg: any, playerKey: PlayerKey, player: number, opponent: number, deps: UDGDeps = {}): { moved: Array<{ from: { row: number; col: number }; to: { row: number; col: number } }>; destroyed: Array<{ row: number; col: number }>; anchors: Array<{ row: number; col: number; remainingNow: number }>; expired: Array<{ row: number; col: number; owner: PlayerKey; reason: string }> } {
    const moved: Array<{ from: { row: number; col: number }; to: { row: number; col: number } }> = [];
    const destroyed: Array<{ row: number; col: number }> = [];
    const anchors: Array<{ row: number; col: number; remainingNow: number }> = [];
    const expired: Array<{ row: number; col: number; owner: PlayerKey; reason: string }> = [];
    const destroyAt = deps.destroyAt || ((cs: any, gs: GameState, r: number, c: number) => {
        const current = getCellValue(gs, r, c);
        if (current === null || current === EMPTY) return false;
        if (cs.markers) cs.markers = cs.markers.filter((m: any) => !(m.row === r && m.col === c));
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
        const fromRow = udg.row;
        const fromCol = udg.col;
        let movedRes = false;
        let usedBoardOpsMove = false;
        if (deps.BoardOps && typeof deps.BoardOps.moveAt === 'function') {
            const res = deps.BoardOps.moveAt(
                cardState,
                gameState,
                fromRow,
                fromCol,
                moveTarget.row,
                moveTarget.col,
                'ULTIMATE_DESTROY_GOD',
                'ultimate_destroy_god_move'
            );
            movedRes = !!(res && res.moved);
            usedBoardOpsMove = !!(res && res.markerHandled === true);
        } else {
            movedRes = setCellValue(gameState, fromRow, fromCol, EMPTY) && setCellValue(gameState, moveTarget.row, moveTarget.col, player);
        }
        if (movedRes) {
            if (!usedBoardOpsMove) {
                moveCoexistingMarkers(cardState, udg, fromRow, fromCol, moveTarget.row, moveTarget.col, deps);
            }
            moved.push({
                from: { row: fromRow, col: fromCol },
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
            if ((cardState as any).markers) {
                (cardState as any).markers = (cardState as any).markers.filter((entry: any) => !(
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

function processUltimateDestroyGodEffects(cardState: CardState, gameState: GameState, playerKey: PlayerKey, deps: UDGDeps = {}): { moved: Array<{ from: { row: number; col: number }; to: { row: number; col: number } }>; destroyed: Array<{ row: number; col: number }>; anchors: Array<{ row: number; col: number; remainingNow: number }>; expired: Array<{ row: number; col: number; owner: PlayerKey; reason: string }> } {
    const moved: Array<{ from: { row: number; col: number }; to: { row: number; col: number } }> = [];
    const destroyed: Array<{ row: number; col: number }> = [];
    const anchors: Array<{ row: number; col: number; remainingNow: number }> = [];
    const expired: Array<{ row: number; col: number; owner: PlayerKey; reason: string }> = [];

    const P_BLACK = BLACK || 1;
    const P_WHITE = WHITE || -1;
    const player = playerKey === 'black' ? P_BLACK : P_WHITE;
    const opponent = -player;

    const destroyAt = deps.destroyAt || ((cs: any, gs: GameState, r: number, c: number) => {
        const current = getCellValue(gs, r, c);
        if (current === null || current === EMPTY) return false;
        if (cs.markers) cs.markers = cs.markers.filter((m: any) => !(m.row === r && m.col === c));
        setCellValue(gs, r, c, EMPTY);
        return true;
    });

    const udgs = ((cardState as any).markers || []).filter((s: any) => s.kind === 'specialStone' && s.data && s.data.type === 'ULTIMATE_DESTROY_GOD' && s.owner === playerKey);
    if (!udgs.length) return { moved, destroyed, anchors, expired };

    for (const udg of udgs) {
        const result = processUltimateDestroyGodTurnStartAnchorCore(cardState, gameState, udg, playerKey, player, opponent, deps);
        moved.push(...result.moved);
        destroyed.push(...result.destroyed);
        anchors.push(...result.anchors);
        expired.push(...result.expired);
    }

    if ((cardState as any).markers) {
        (cardState as any).markers = (cardState as any).markers.filter((m: any) =>
            m.kind !== 'specialStone' ||
            !m.data ||
            m.data.type !== 'ULTIMATE_DESTROY_GOD' ||
            (m.data.remainingOwnerTurns !== undefined && m.data.remainingOwnerTurns !== null && m.data.remainingOwnerTurns >= 0)
        );
    }

    return { moved, destroyed, anchors, expired };
}

interface AnchorResult {
    destroyed: Array<{ row: number; col: number }>;
    expired?: Array<{ row: number; col: number; owner: PlayerKey; reason: string }>;
}

function processUltimateDestroyGodEffectsAtAnchor(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: UDGDeps = {}): { destroyed: Array<{ row: number; col: number }>; expired?: Array<{ row: number; col: number; owner: PlayerKey; reason: string }> } {
    const destroyed: Array<{ row: number; col: number }> = [];
    const P_BLACK = BLACK || 1;
    const P_WHITE = WHITE || -1;
    const player = playerKey === 'black' ? P_BLACK : P_WHITE;
    const opponent = -player;

    const destroyAt = deps.destroyAt || ((cs: any, gs: GameState, r: number, c: number) => {
        const current = getCellValue(gs, r, c);
        if (current === null || current === EMPTY) return false;
        if (cs.markers) cs.markers = cs.markers.filter((m: any) => !(m.row === r && m.col === c));
        setCellValue(gs, r, c, EMPTY);
        return true;
    });

    const udg = ((cardState as any).markers || []).find((s: any) =>
        s.kind === 'specialStone' && s.data && s.data.type === 'ULTIMATE_DESTROY_GOD' && s.owner === playerKey && s.row === row && s.col === col
    );
    if (!udg) return { destroyed };
    if (getCellValue(gameState, row, col) !== player) return { destroyed };

    const neighborCells = getNeighborCellsSnapshot(gameState, row, col);
    const targets = neighborCells.filter((cell) => cell && cell.value === opponent);
    const forbiddenEvadeCells = neighborCells.map((cell) => ({ row: cell.row, col: cell.col }));
    const destroyTargets = () => {
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
    };
    if (deps.BoardOps && typeof deps.BoardOps.runDestroyBlock === 'function') {
        deps.BoardOps.runDestroyBlock(cardState, gameState, destroyTargets, {});
    } else {
        destroyTargets();
    }

    const before = (udg.data && (udg.data.remainingOwnerTurns !== undefined && udg.data.remainingOwnerTurns !== null))
        ? udg.data.remainingOwnerTurns
        : 0;
    const shouldDecrement = deps.decrementRemainingOwnerTurns !== false;
    const afterDec = shouldDecrement ? before - 1 : before;
    if (shouldDecrement) {
        if (udg.data) udg.data.remainingOwnerTurns = afterDec;
        if (afterDec < 0) return { destroyed };
    } else {
        if (udg.data) udg.data.remainingOwnerTurns = before;
    }

    const expired: Array<{ row: number; col: number; owner: PlayerKey; reason: string }> = [];
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
            if ((cardState as any).markers) {
                (cardState as any).markers = (cardState as any).markers.filter((entry: any) => !(
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

    if ((cardState as any).markers) {
        (cardState as any).markers = (cardState as any).markers.filter((m: any) =>
            m.kind !== 'specialStone' ||
            !m.data ||
            m.data.type !== 'ULTIMATE_DESTROY_GOD' ||
            (m.data.remainingOwnerTurns !== undefined && m.data.remainingOwnerTurns !== null && m.data.remainingOwnerTurns >= 0)
        );
    }

    return { destroyed, expired };
}

function processUltimateDestroyGodEffectsAtTurnStartAnchor(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: UDGDeps = {}): { moved: Array<{ from: { row: number; col: number }; to: { row: number; col: number } }>; destroyed: Array<{ row: number; col: number }>; anchors: Array<{ row: number; col: number; remainingNow: number }>; expired: Array<{ row: number; col: number; owner: PlayerKey; reason: string }> } {
    const moved: Array<{ from: { row: number; col: number }; to: { row: number; col: number } }> = [];
    const destroyed: Array<{ row: number; col: number }> = [];
    const anchors: Array<{ row: number; col: number; remainingNow: number }> = [];
    const expired: Array<{ row: number; col: number; owner: PlayerKey; reason: string }> = [];
    const P_BLACK = BLACK || 1;
    const P_WHITE = WHITE || -1;
    const player = playerKey === 'black' ? P_BLACK : P_WHITE;
    const opponent = -player;

    const udg = ((cardState as any).markers || []).find((s: any) =>
        s.kind === 'specialStone' && s.data && s.data.type === 'ULTIMATE_DESTROY_GOD' && s.owner === playerKey && s.row === row && s.col === col
    );
    const resolveAnchor = () => processUltimateDestroyGodTurnStartAnchorCore(cardState, gameState, udg, playerKey, player, opponent, deps);
    const result = (deps.BoardOps && typeof deps.BoardOps.runEffectBlock === 'function')
        ? deps.BoardOps.runEffectBlock(cardState, gameState, {
            kind: 'anchor_effect',
            cause: 'ULTIMATE_DESTROY_GOD',
            reason: 'udg_destroyed',
            owner: playerKey,
            sourceRow: row,
            sourceCol: col,
            randomSource: deps.randomSource || null
        }, resolveAnchor)
        : resolveAnchor();
    moved.push(...result.moved);
    destroyed.push(...result.destroyed);
    anchors.push(...result.anchors);
    expired.push(...result.expired);

    if ((cardState as any).markers) {
        (cardState as any).markers = (cardState as any).markers.filter((m: any) =>
            m.kind !== 'specialStone' ||
            !m.data ||
            m.data.type !== 'ULTIMATE_DESTROY_GOD' ||
            (m.data.remainingOwnerTurns !== undefined && m.data.remainingOwnerTurns !== null && m.data.remainingOwnerTurns >= 0)
        );
    }

    return { moved, destroyed, anchors, expired };
}

export = {
    processUltimateDestroyGodEffects,
    processUltimateDestroyGodEffectsAtAnchor,
    processUltimateDestroyGodEffectsAtTurnStartAnchor
};
