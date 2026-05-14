/**
 * @file dragon.ts
 * @description DRAGON effect helper - TypeScript module for browser and Node.js
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

function getRuntimeGlobalValue(key: string): any {
    if (typeof globalThis !== 'undefined' && (globalThis as any)[key]) {
        return (globalThis as any)[key];
    }
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
    const runtimeSharedConstants = getRuntimeGlobalValue('SharedConstants');
    if (runtimeSharedConstants) return runtimeSharedConstants;

    if (typeof module === 'object' && module.exports) {
        return safeRequire('../../../shared-constants') || runtimeSharedConstants;
    }

    return runtimeSharedConstants;
})();

const RandomSourceModule = getRuntimeGlobalValue('CardRandomSource') || ((typeof module === 'object' && module.exports)
    ? safeRequire('../cards-internal/random-source')
    : (typeof self !== 'undefined' ? ((self as any).CardRandomSource || null) : null));

const { BLACK, WHITE } = SharedConstants || {};
const P_BLACK = BLACK || 1;
const P_WHITE = WHITE || -1;
const P_EMPTY = 0;

interface BoardDims {
    rows: number;
    cols: number;
}

interface ExpansionCell {
    side: string | null;
    row: number;
    col: number;
    owner: number;
}

interface DragonDeps {
    BoardOps?: any;
    getCardContext?: (cardState: any) => any;
    moveCoexistingSpecialMarkers?: (cardState: any, anchorEntry: any, fromRow: number, fromCol: number, toRow: number, toCol: number) => void;
    selectRandomEmptyBoardShapeDestination?: (cardState: any, gameState: any, fromRow: number, fromCol: number, randomSource: any) => { row: number; col: number } | null;
    randomSource?: any;
}

interface DragonEffectResult {
    converted: { row: number; col: number }[];
    destroyed: { row: number; col: number; owner: string; reason: string }[];
    anchors: { row: number; col: number; remainingNow: number }[];
}

interface DragonEffectAtAnchorResult {
    moved: { from: { row: number; col: number }; to: { row: number; col: number } }[];
    converted: { row: number; col: number }[];
    destroyed: { row: number; col: number; owner: string; reason: string }[];
    anchors: { row: number; col: number; remainingNow: number }[];
}

function normalizeExpansionOwner(owner: number): number {
    return (owner === P_BLACK || owner === P_WHITE) ? owner : 0;
}

function resolveBoardDims(gameState: any): BoardDims {
    const board = gameState && Array.isArray(gameState.board) ? gameState.board : null;
    const rows = board && board.length > 0 ? board.length : 8;
    const cols = board && Array.isArray(board[0]) && board[0].length > 0 ? board[0].length : rows;
    return { rows, cols };
}

function isMainBoardCell(row: number, col: number, gameState: any): boolean {
    const dims = resolveBoardDims(gameState);
    return Number.isInteger(row) && row >= 0 && row < dims.rows && Number.isInteger(col) && col >= 0 && col < dims.cols;
}

function resolveExpansionSide(side: string | null, row: number, col: number, gameState: any): string | null {
    if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
    const dims = resolveBoardDims(gameState);
    if (col === -1) return 'left';
    if (col === dims.cols) return 'right';
    if (row === -1) return 'top';
    if (row === dims.rows) return 'bottom';
    return null;
}

function isExpansionCoordinate(row: number, col: number, gameState: any): boolean {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    const dims = resolveBoardDims(gameState);
    if (row < -1 || row > dims.rows || col < -1 || col > dims.cols) return false;
    if (isMainBoardCell(row, col, gameState)) return false;
    return true;
}

function syncLegacyExpansionFields(expansion: any, gameState: any): void {
    if (!expansion || typeof expansion !== 'object') return;
    if (!Array.isArray(expansion.cells)) expansion.cells = [];
    const latest = expansion.cells.length > 0 ? expansion.cells[expansion.cells.length - 1] : null;
    expansion.active = !!latest;
    expansion.side = latest ? resolveExpansionSide(latest.side, latest.row, latest.col, gameState) : null;
    expansion.row = latest ? latest.row : null;
    expansion.owner = latest ? normalizeExpansionOwner(latest.owner) : 0;
}

function getExpansionCells(gameState: any): ExpansionCell[] {
    const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
        ? gameState.boardExpansion
        : null;
    if (!expansion) return [];

    const cells: ExpansionCell[] = [];
    const pushCell = (source: any, legacyRow?: number | null, legacyOwner?: number) => {
        let side: string | null = null;
        let row: number | null | undefined = null;
        let col: any = null;
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

        if (!isExpansionCoordinate(row as number, col as number, gameState)) return;
        if (cells.some((cell) => cell && cell.row === row && cell.col === col)) return;
        cells.push({
            side: resolveExpansionSide(side, row as number, col as number, gameState),
            row: row as number,
            col: col as number,
            owner: normalizeExpansionOwner(owner as number)
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

function ensureExpansionStateMutable(gameState: any): any {
    if (!(gameState as any).boardExpansion || typeof (gameState as any).boardExpansion !== 'object') {
        (gameState as any).boardExpansion = {
            active: false,
            side: null,
            row: null,
            owner: 0,
            usedByPlayer: { black: false, white: false },
            cells: []
        };
        return (gameState as any).boardExpansion;
    }
    const expansion = (gameState as any).boardExpansion;
    const cells = getExpansionCells(gameState);
    expansion.cells = cells.map((cell) => ({
        side: cell.side,
        row: cell.row,
        col: cell.col,
        owner: normalizeExpansionOwner(cell.owner)
    }));
    syncLegacyExpansionFields(expansion, gameState);
    return expansion;
}

function getCellValue(gameState: any, row: number, col: number): number | null {
    if (isMainBoardCell(row, col, gameState)) return gameState.board[row][col];
    const expansionCells = getExpansionCells(gameState);
    for (const expansion of expansionCells) {
        if (!expansion) continue;
        if (expansion.row === row && expansion.col === col) return expansion.owner;
    }
    return null;
}

function setCellValue(gameState: any, row: number, col: number, value: number): boolean {
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

function isBlockedDestinationCell(cardState: any, row: number, col: number): boolean {
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    return markers.some((marker: any) => {
        if (!marker || marker.row !== row || marker.col !== col) return false;
        if (marker.kind !== 'specialStone') return false;
        const markerType = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
        return markerType === 'BLOCKADE' || markerType === 'METEOR_HOLE' || markerType === 'FREEZE';
    });
}

function getRandomTurnStartMoveDestination(cardState: any, gameState: any, fromRow: number, fromCol: number, deps: DragonDeps = {}): { row: number; col: number } | null {
    if (deps && typeof deps.selectRandomEmptyBoardShapeDestination === 'function') {
        return deps.selectRandomEmptyBoardShapeDestination(cardState, gameState, fromRow, fromCol, deps.randomSource);
    }
    const candidates: { row: number; col: number }[] = [];
    const dims = resolveBoardDims(gameState);
    for (let row = 0; row < dims.rows; row++) {
        for (let col = 0; col < dims.cols; col++) {
            if (row === fromRow && col === fromCol) continue;
            if (getCellValue(gameState, row, col) !== P_EMPTY) continue;
            if (isBlockedDestinationCell(cardState, row, col)) continue;
            candidates.push({ row, col });
        }
    }
    const expansionCells = getExpansionCells(gameState);
    for (const cell of expansionCells) {
        if (!cell || !Number.isInteger(cell.row) || !Number.isInteger(cell.col)) continue;
        if (cell.row === fromRow && cell.col === fromCol) continue;
        if (getCellValue(gameState, cell.row, cell.col) !== P_EMPTY) continue;
        if (isBlockedDestinationCell(cardState, cell.row, cell.col)) continue;
        candidates.push({ row: cell.row, col: cell.col });
    }
    if (!candidates.length) return null;
    let randomSource = deps && deps.randomSource;
    if (randomSource) {
        if (RandomSourceModule && typeof RandomSourceModule.resolveRandomSource === 'function') {
            randomSource = RandomSourceModule.resolveRandomSource(
                randomSource,
                null,
                'DragonEffects.selectRandomEmptyDestination'
            );
        }
    } else {
        randomSource = { random: () => Math.random() };
    }
    const rawIndex = Math.floor(randomSource.random() * candidates.length);
    const index = Math.max(0, Math.min(candidates.length - 1, rawIndex));
    return candidates[index] || candidates[0] || null;
}

function moveCoexistingMarkers(cardState: any, anchorEntry: any, fromRow: number, fromCol: number, toRow: number, toCol: number, deps: DragonDeps = {}): void {
    if (deps && typeof deps.moveCoexistingSpecialMarkers === 'function') {
        deps.moveCoexistingSpecialMarkers(cardState, anchorEntry, fromRow, fromCol, toRow, toCol);
        return;
    }
    if (!Array.isArray(cardState && cardState.markers)) return;
    for (const marker of cardState.markers as any[]) {
        if (!marker || marker === anchorEntry) continue;
        if (marker.row !== fromRow || marker.col !== fromCol) continue;
        if (marker.kind === 'specialStone') {
            const markerTypeUpper = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
            if (markerTypeUpper === 'BLOCKADE' || markerTypeUpper === 'METEOR_HOLE') continue;
        }
        marker.row = toRow;
        marker.col = toCol;
    }
}

function forEachNeighborCell(gameState: any, row: number, col: number, handler: (r: number, c: number, value: number) => void): void {
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

function buildDragonFlipProtectedSet(cardState: any, deps: DragonDeps = {}): Set<string> {
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    const protectedSet = new Set<string>();

    const addCells = (cells: any[]) => {
        if (!Array.isArray(cells)) return;
        for (const cell of cells) {
            if (!cell || !Number.isInteger(cell.row) || !Number.isInteger(cell.col)) continue;
            protectedSet.add(`${cell.row},${cell.col}`);
        }
    };

    if (deps && typeof deps.getCardContext === 'function') {
        try {
            const context = deps.getCardContext(cardState) || {};
            addCells(context.protectedStones);
            addCells(context.permaProtectedStones);
        } catch (e) {
            // ignore and fallback to marker-type list
        }
    }

    if (protectedSet.size === 0) {
        const fallbackProtectedTypes = new Set([
            'PROTECTED',
            'PERMA_PROTECTED',
            'DRAGON',
            'BREEDING',
            'DESTROY_DRAGON',
            'LIGHTNING',
            'GLUTTONOUS',
            'ULTIMATE_DESTROY_GOD',
            'GUARD'
        ]);
        for (const marker of markers) {
            if (!marker || marker.kind !== 'specialStone' || !marker.data) continue;
            if (!fallbackProtectedTypes.has(marker.data.type)) continue;
            protectedSet.add(`${marker.row},${marker.col}`);
        }
    }

    for (const marker of markers) {
        if (!marker || marker.kind !== 'specialStone' || !marker.data) continue;
        if (marker.data.type !== 'ULTIMATE_HYPERACTIVE') continue;
        protectedSet.add(`${marker.row},${marker.col}`);
    }

    return protectedSet;
}

function isBombCategoryMarker(marker: any): boolean {
    return !!(
        marker &&
        marker.kind === 'specialStone' &&
        marker.data &&
        marker.data.category === 'bomb'
    );
}

function processDragonEffects(cardState: any, gameState: any, playerKey: string, deps: DragonDeps = {}): DragonEffectResult {
    const BoardOps = deps.BoardOps;
    const converted: { row: number; col: number }[] = [];
    const destroyed: { row: number; col: number; owner: string; reason: string }[] = [];
    const anchors: { row: number; col: number; remainingNow: number }[] = [];

    const player = playerKey === 'black' ? P_BLACK : P_WHITE;
    const opponent = -player;

    const protectedSet = buildDragonFlipProtectedSet(cardState, deps);
    const dragons = ((cardState.markers || []) as any[]).filter((s: any) => s.kind === 'specialStone' && s.data && s.data.type === 'DRAGON');

    const isBombCategoryMarkerLocal = (marker: any) => !!(
        marker &&
        marker.kind === 'specialStone' &&
        marker.data &&
        (marker.data.category === 'bomb' || marker.data.type === 'TIME_BOMB')
    );

    const clearBombAt = (row: number, col: number) => {
        if (!(cardState as any).markers || !(cardState as any).markers.length) return;
        const b = (cardState as any).markers.find((x: any) => isBombCategoryMarkerLocal(x) && x.row === row && x.col === col);
        if (!b) return;
        (cardState as any).markers = (cardState as any).markers.filter((x: any) => !(isBombCategoryMarkerLocal(x) && x.row === row && x.col === col));
    };

    for (const dragon of dragons) {
        if (dragon.owner !== playerKey) continue;

        if (getCellValue(gameState, dragon.row, dragon.col) !== player) {
            if (dragon.data) dragon.data.remainingOwnerTurns = -1;
            continue;
        }

        const before = (dragon.data && (dragon.data.remainingOwnerTurns !== undefined && dragon.data.remainingOwnerTurns !== null))
            ? dragon.data.remainingOwnerTurns
            : 0;
        const afterDec = before - 1;
        if (dragon.data) dragon.data.remainingOwnerTurns = afterDec;
        if (afterDec < 0) continue;
        anchors.push({ row: dragon.row, col: dragon.col, remainingNow: afterDec });

        forEachNeighborCell(gameState, dragon.row, dragon.col, (r, c, value) => {
            if (value === opponent) {
                const key = `${r},${c}`;
                if (protectedSet.has(key)) return;
                if (BoardOps && typeof BoardOps.changeAt === 'function') {
                    BoardOps.changeAt(cardState, gameState, r, c, playerKey, 'DRAGON', 'dragon_convert');
                } else {
                    setCellValue(gameState, r, c, player);
                }
                clearBombAt(r, c);
                converted.push({ row: r, col: c });
            }
        });

        if (afterDec === 0) {
            destroyed.push({ row: dragon.row, col: dragon.col, owner: playerKey, reason: 'anchor_expired' });
            if (BoardOps && typeof BoardOps.revertSpecialStoneAt === 'function') {
                BoardOps.revertSpecialStoneAt(
                    cardState,
                    gameState,
                    dragon.row,
                    dragon.col,
                    'DRAGON',
                    playerKey,
                    'DRAGON',
                    'anchor_expired'
                );
            } else {
                (cardState as any).markers = ((cardState as any).markers || []).filter((entry: any) => !(
                    entry &&
                    entry.kind === 'specialStone' &&
                    entry.row === dragon.row &&
                    entry.col === dragon.col &&
                    entry.owner === playerKey &&
                    entry.data &&
                    entry.data.type === 'DRAGON'
                ));
            }
            if (isExpansionCoordinate(dragon.row, dragon.col, gameState)) {
                setCellValue(gameState, dragon.row, dragon.col, P_EMPTY);
            }
            if (dragon.data) dragon.data.remainingOwnerTurns = -1;
        }
    }

    if ((cardState as any).markers) {
        (cardState as any).markers = (cardState as any).markers.filter((s: any) =>
            s.kind !== 'specialStone' ||
            !s.data ||
            s.data.type !== 'DRAGON' ||
            (s.data.remainingOwnerTurns !== undefined && s.data.remainingOwnerTurns !== null && s.data.remainingOwnerTurns >= 0)
        );
    }

    if (converted.length > 0 && (cardState as any).markers) {
        const removeSet = new Set(converted.map(p => `${p.row},${p.col}`));
        (cardState as any).markers = (cardState as any).markers.filter((s: any) =>
            s.kind !== 'specialStone' ||
            !s.data ||
            (s.data.type !== 'HYPERACTIVE' && s.data.type !== 'ESCAPE_HYPERACTIVE') ||
            !removeSet.has(`${s.row},${s.col}`)
        );
    }

    return { converted, destroyed, anchors };
}

function processDragonEffectsAtAnchor(cardState: any, gameState: any, playerKey: string, row: number, col: number, deps: DragonDeps = {}): Omit<DragonEffectResult, 'anchors'> {
    const BoardOps = deps.BoardOps;
    const converted: { row: number; col: number }[] = [];
    const destroyed: { row: number; col: number; owner: string; reason: string }[] = [];

    const player = playerKey === 'black' ? P_BLACK : P_WHITE;
    const opponent = -player;

    const dragon = ((cardState.markers || []) as any[]).find((s: any) =>
        s.kind === 'specialStone' && s.data && s.data.type === 'DRAGON' && s.owner === playerKey && s.row === row && s.col === col
    );
    if (!dragon) return { converted, destroyed };
    if (getCellValue(gameState, row, col) !== player) return { converted, destroyed };

    const protectedSet = buildDragonFlipProtectedSet(cardState, deps);
    const clearBombAt = (r: number, c: number) => {
        if (!(cardState as any).markers || !(cardState as any).markers.length) return;
        const b = (cardState as any).markers.find((x: any) => isBombCategoryMarker(x) && x.row === r && x.col === c);
        if (!b) return;
        (cardState as any).markers = (cardState as any).markers.filter((x: any) => !(isBombCategoryMarker(x) && x.row === r && x.col === c));
    };

    forEachNeighborCell(gameState, row, col, (r, c, value) => {
        if (value !== opponent) return;
        const key = `${r},${c}`;
        if (protectedSet.has(key)) return;
        if (BoardOps && typeof BoardOps.changeAt === 'function') {
            BoardOps.changeAt(cardState, gameState, r, c, playerKey, 'DRAGON', 'dragon_convert_immediate');
        } else {
            setCellValue(gameState, r, c, player);
        }
        clearBombAt(r, c);
        converted.push({ row: r, col: c });
    });

    if (converted.length > 0 && (cardState as any).markers) {
        const removeSet = new Set(converted.map(p => `${p.row},${p.col}`));
        (cardState as any).markers = (cardState as any).markers.filter((s: any) =>
            s.kind !== 'specialStone' ||
            !s.data ||
            (s.data.type !== 'HYPERACTIVE' && s.data.type !== 'ESCAPE_HYPERACTIVE') ||
            !removeSet.has(`${s.row},${s.col}`)
        );
    }

    return { converted, destroyed };
}

function processDragonEffectsAtTurnStartAnchor(cardState: any, gameState: any, playerKey: string, row: number, col: number, deps: DragonDeps = {}): DragonEffectAtAnchorResult {
    const BoardOps = deps.BoardOps;
    const moved: { from: { row: number; col: number }; to: { row: number; col: number } }[] = [];
    const converted: { row: number; col: number }[] = [];
    const destroyed: { row: number; col: number; owner: string; reason: string }[] = [];
    const anchors: { row: number; col: number; remainingNow: number }[] = [];

    const player = playerKey === 'black' ? P_BLACK : P_WHITE;
    const opponent = -player;

    const dragon = ((cardState.markers || []) as any[]).find((s: any) =>
        s.kind === 'specialStone' && s.data && s.data.type === 'DRAGON' && s.owner === playerKey && s.row === row && s.col === col
    );
    if (!dragon) return { moved, converted, destroyed, anchors };

    if (getCellValue(gameState, row, col) !== player) {
        if (dragon.data) dragon.data.remainingOwnerTurns = -1;
        return { moved, converted, destroyed, anchors };
    }

    let anchorRow = row;
    let anchorCol = col;
    const moveTarget = getRandomTurnStartMoveDestination(cardState, gameState, row, col, deps);
    if (moveTarget) {
        let movedRes = false;
        if (BoardOps && typeof BoardOps.moveAt === 'function') {
            const res = BoardOps.moveAt(
                cardState,
                gameState,
                row,
                col,
                moveTarget.row,
                moveTarget.col,
                'ULTIMATE_REVERSE_DRAGON',
                'ultimate_reverse_dragon_move'
            );
            movedRes = !!(res && res.moved);
        } else {
            movedRes = setCellValue(gameState, row, col, P_EMPTY) && setCellValue(gameState, moveTarget.row, moveTarget.col, player);
        }
        if (movedRes) {
            moveCoexistingMarkers(cardState, dragon, row, col, moveTarget.row, moveTarget.col, deps);
            dragon.row = moveTarget.row;
            dragon.col = moveTarget.col;
            anchorRow = moveTarget.row;
            anchorCol = moveTarget.col;
            moved.push({
                from: { row, col },
                to: { row: moveTarget.row, col: moveTarget.col }
            });
        }
    }

    const before = (dragon.data && (dragon.data.remainingOwnerTurns !== undefined && dragon.data.remainingOwnerTurns !== null))
        ? dragon.data.remainingOwnerTurns
        : 0;
    const afterDec = before - 1;
    if (dragon.data) dragon.data.remainingOwnerTurns = afterDec;
    if (afterDec < 0) return { moved, converted, destroyed, anchors };
    anchors.push({ row: anchorRow, col: anchorCol, remainingNow: afterDec });

    const protectedSet = buildDragonFlipProtectedSet(cardState, deps);
    const clearBombAt = (r: number, c: number) => {
        if (!(cardState as any).markers || !(cardState as any).markers.length) return;
        const b = (cardState as any).markers.find((x: any) => isBombCategoryMarker(x) && x.row === r && x.col === c);
        if (!b) return;
        (cardState as any).markers = (cardState as any).markers.filter((x: any) => !(isBombCategoryMarker(x) && x.row === r && x.col === c));
    };

    forEachNeighborCell(gameState, anchorRow, anchorCol, (r, c, value) => {
        if (value === opponent) {
            const key = `${r},${c}`;
            if (protectedSet.has(key)) return;
            if (BoardOps && typeof BoardOps.changeAt === 'function') {
                BoardOps.changeAt(cardState, gameState, r, c, playerKey, 'DRAGON', 'dragon_convert');
            } else {
                setCellValue(gameState, r, c, player);
            }
            clearBombAt(r, c);
            converted.push({ row: r, col: c });
        }
    });

    if (afterDec === 0) {
        destroyed.push({ row: anchorRow, col: anchorCol, owner: playerKey, reason: 'anchor_expired' });
        if (BoardOps && typeof BoardOps.revertSpecialStoneAt === 'function') {
            BoardOps.revertSpecialStoneAt(
                cardState,
                gameState,
                anchorRow,
                anchorCol,
                'DRAGON',
                playerKey,
                'DRAGON',
                'anchor_expired'
            );
        } else {
            (cardState as any).markers = ((cardState as any).markers || []).filter((entry: any) => !(
                entry &&
                entry.kind === 'specialStone' &&
                entry.row === anchorRow &&
                entry.col === anchorCol &&
                entry.owner === playerKey &&
                entry.data &&
                entry.data.type === 'DRAGON'
            ));
        }
        if (isExpansionCoordinate(anchorRow, anchorCol, gameState)) {
            setCellValue(gameState, anchorRow, anchorCol, P_EMPTY);
        }
        if (dragon.data) dragon.data.remainingOwnerTurns = -1;
    }

    if ((cardState as any).markers) {
        (cardState as any).markers = (cardState as any).markers.filter((s: any) =>
            s.kind !== 'specialStone' ||
            !s.data ||
            s.data.type !== 'DRAGON' ||
            (s.data.remainingOwnerTurns !== undefined && s.data.remainingOwnerTurns !== null && s.data.remainingOwnerTurns >= 0)
        );
    }

    if (converted.length > 0 && (cardState as any).markers) {
        const removeSet = new Set(converted.map(p => `${p.row},${p.col}`));
        (cardState as any).markers = (cardState as any).markers.filter((s: any) =>
            s.kind !== 'specialStone' ||
            !s.data ||
            (s.data.type !== 'HYPERACTIVE' && s.data.type !== 'ESCAPE_HYPERACTIVE') ||
            !removeSet.has(`${s.row},${s.col}`)
        );
    }

    return { moved, converted, destroyed, anchors };
}

export = {
    processDragonEffects,
    processDragonEffectsAtAnchor,
    processDragonEffectsAtTurnStartAnchor
};
