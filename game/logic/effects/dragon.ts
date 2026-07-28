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

function resolveDragonModuleOrGlobal(id: string, globalKey: string): any {
    if (typeof module === 'object' && module.exports) {
        return safeRequire(id) || getRuntimeGlobalValue(globalKey);
    }

    return getRuntimeGlobalValue(globalKey);
}

const SharedConstants = resolveDragonModuleOrGlobal('../../../shared-constants', 'SharedConstants');
const SharedBoardUtils = resolveDragonModuleOrGlobal('../../../shared/shared-board-utils', 'SharedBoardUtils');
const RandomSourceModule = resolveDragonModuleOrGlobal('../cards-internal/random-source', 'CardRandomSource');
const DefaultBoardOps = resolveDragonModuleOrGlobal('../board_ops', 'BoardOps');
const SpecialStoneRegistry = resolveDragonModuleOrGlobal('../../../shared/special-stone-registry', 'SpecialStoneRegistry');

const { BLACK, WHITE } = SharedConstants || {};
const P_BLACK = BLACK || 1;
const P_WHITE = WHITE || -1;
const P_EMPTY = 0;

if (
    !SharedBoardUtils
    || typeof SharedBoardUtils.createBoardContext !== 'function'
    || typeof SharedBoardUtils.createBoardView !== 'function'
    || typeof SharedBoardUtils.getCellValue !== 'function'
    || typeof SharedBoardUtils.setCellValue !== 'function'
    || typeof SharedBoardUtils.toBoardCellKey !== 'function'
) {
    throw new Error('SharedBoardUtils BoardContext APIs are required by DragonEffects');
}

interface DragonDeps {
    BoardOps?: any;
    getCardContext?: (cardState: any) => any;
    moveCoexistingSpecialMarkers?: (cardState: any, anchorEntry: any, fromRow: number, fromCol: number, toRow: number, toCol: number) => void;
    selectRandomEmptyBoardShapeDestination?: (cardState: any, gameState: any, fromRow: number, fromCol: number, randomSource: any) => { row: number; col: number } | null;
    randomSource?: any;
    resolveFlipEvasion?: (cardState: any, gameState: any, flipCells: Array<{ row: number; col: number }>, ownerAfterKey: string, randomSource: any) => any;
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

function createDragonBoardContext(cardState: any, gameState: any): any {
    return SharedBoardUtils.createBoardContext(gameState, cardState);
}

function createDragonBoardView(cardState: any, gameState: any): any {
    return SharedBoardUtils.createBoardView(gameState, { cardState, strict: false });
}

function getCellValue(cardState: any, gameState: any, row: number, col: number): number | null {
    return SharedBoardUtils.getCellValue(createDragonBoardContext(cardState, gameState), row, col);
}

function setCellValue(cardState: any, gameState: any, row: number, col: number, value: number): boolean {
    return SharedBoardUtils.setCellValue(createDragonBoardContext(cardState, gameState), row, col, value);
}

function isExpansionCoordinate(cardState: any, gameState: any, row: number, col: number): boolean {
    const view = createDragonBoardView(cardState, gameState);
    return view.topology.expansionKeys.has(SharedBoardUtils.toBoardCellKey(row, col));
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
    const view = createDragonBoardView(cardState, gameState);
    for (const cell of view.coordinates) {
        if (cell.row === fromRow && cell.col === fromCol) continue;
        if (view.get(cell.row, cell.col) !== P_EMPTY) continue;
        if (isBlockedDestinationCell(cardState, cell.row, cell.col)) continue;
        candidates.push({ row: cell.row, col: cell.col });
    }
    if (!candidates.length) return null;
    let randomSource = deps && deps.randomSource;
    if (RandomSourceModule && typeof RandomSourceModule.resolveRandomSource === 'function') {
        randomSource = RandomSourceModule.resolveRandomSource(
            randomSource,
            null,
            'DragonEffects.selectRandomEmptyDestination'
        );
    }
    if (!randomSource || typeof randomSource.random !== 'function') {
        throw new Error('DragonEffects.selectRandomEmptyDestination requires an injected deterministic PRNG.');
    }
    const raw = Number(randomSource.random());
    if (!Number.isFinite(raw)) {
        throw new Error('DragonEffects.selectRandomEmptyDestination received a PRNG that returned a non-finite value.');
    }
    const rawIndex = Math.floor(Math.max(0, Math.min(0.999999, raw)) * candidates.length);
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
        if (!SpecialStoneRegistry || typeof SpecialStoneRegistry.isBoardMarker !== 'function') {
            throw new Error('SpecialStoneRegistry.isBoardMarker is required by DragonEffects');
        }
        const boardMarker = SpecialStoneRegistry.isBoardMarker(marker);
        if (boardMarker) continue;
        marker.row = toRow;
        marker.col = toCol;
    }
}

function forEachNeighborCell(cardState: any, gameState: any, row: number, col: number, handler: (r: number, c: number, value: number) => void): void {
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const r = row + dr;
            const c = col + dc;
            const value = getCellValue(cardState, gameState, r, c);
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

function normalizeFlipCell(cell: any): { row: number; col: number } | null {
    if (Array.isArray(cell) && Number.isInteger(cell[0]) && Number.isInteger(cell[1])) {
        return { row: cell[0], col: cell[1] };
    }
    if (cell && Number.isInteger(cell.row) && Number.isInteger(cell.col)) {
        return { row: cell.row, col: cell.col };
    }
    return null;
}

function resolveDragonFlipEvasion(cardState: any, gameState: any, targets: Array<{ row: number; col: number }>, playerKey: string, deps: DragonDeps): Array<{ row: number; col: number }> {
    if (!targets.length || !(deps && typeof deps.resolveFlipEvasion === 'function')) {
        return targets.slice();
    }
    const result = deps.resolveFlipEvasion(cardState, gameState, targets, playerKey, deps.randomSource);
    if (!result || !Array.isArray(result.remainingFlips)) {
        return targets.slice();
    }
    return result.remainingFlips
        .map((cell: any) => normalizeFlipCell(cell))
        .filter((cell: { row: number; col: number } | null): cell is { row: number; col: number } => !!cell);
}

function collectDragonConversionTargets(cardState: any, gameState: any, row: number, col: number, opponent: number, protectedSet: Set<string>): Array<{ row: number; col: number }> {
    const targets: Array<{ row: number; col: number }> = [];
    forEachNeighborCell(cardState, gameState, row, col, (r, c, value) => {
        if (value !== opponent) return;
        const key = `${r},${c}`;
        if (protectedSet.has(key)) return;
        targets.push({ row: r, col: c });
    });
    return targets;
}

function applyDragonConversions(cardState: any, gameState: any, playerKey: string, player: number, opponent: number, row: number, col: number, reason: string, protectedSet: Set<string>, clearBombAt: (row: number, col: number) => void, deps: DragonDeps): Array<{ row: number; col: number }> {
    const BoardOps = deps.BoardOps || DefaultBoardOps;
    if (!BoardOps || typeof BoardOps.changeAt !== 'function') {
        throw new Error('DragonEffects requires BoardOps.changeAt for ownership changes');
    }
    const targets = collectDragonConversionTargets(cardState, gameState, row, col, opponent, protectedSet);
    const remainingTargets = resolveDragonFlipEvasion(cardState, gameState, targets, playerKey, deps);
    const converted: Array<{ row: number; col: number }> = [];

    for (const target of remainingTargets) {
        if (getCellValue(cardState, gameState, target.row, target.col) !== opponent) continue;
        const changeResult = BoardOps.changeAt(cardState, gameState, target.row, target.col, playerKey, 'DRAGON', reason);
        const changed = !!(changeResult && changeResult.changed);
        if (!changed) continue;
        clearBombAt(target.row, target.col);
        converted.push({ row: target.row, col: target.col });
    }

    return converted;
}

function processDragonEffects(cardState: any, gameState: any, playerKey: string, deps: DragonDeps = {}): DragonEffectResult {
    const BoardOps = deps.BoardOps || DefaultBoardOps;
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

        if (getCellValue(cardState, gameState, dragon.row, dragon.col) !== player) {
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

        converted.push(...applyDragonConversions(
            cardState,
            gameState,
            playerKey,
            player,
            opponent,
            dragon.row,
            dragon.col,
            'dragon_convert',
            protectedSet,
            clearBombAt,
            deps
        ));

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
            if (isExpansionCoordinate(cardState, gameState, dragon.row, dragon.col)) {
                setCellValue(cardState, gameState, dragon.row, dragon.col, P_EMPTY);
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

    return { converted, destroyed, anchors };
}

function processDragonEffectsAtAnchor(cardState: any, gameState: any, playerKey: string, row: number, col: number, deps: DragonDeps = {}): Omit<DragonEffectResult, 'anchors'> {
    const converted: { row: number; col: number }[] = [];
    const destroyed: { row: number; col: number; owner: string; reason: string }[] = [];

    const player = playerKey === 'black' ? P_BLACK : P_WHITE;
    const opponent = -player;

    const dragon = ((cardState.markers || []) as any[]).find((s: any) =>
        s.kind === 'specialStone' && s.data && s.data.type === 'DRAGON' && s.owner === playerKey && s.row === row && s.col === col
    );
    if (!dragon) return { converted, destroyed };
    if (getCellValue(cardState, gameState, row, col) !== player) return { converted, destroyed };

    const protectedSet = buildDragonFlipProtectedSet(cardState, deps);
    const clearBombAt = (r: number, c: number) => {
        if (!(cardState as any).markers || !(cardState as any).markers.length) return;
        const b = (cardState as any).markers.find((x: any) => isBombCategoryMarker(x) && x.row === r && x.col === c);
        if (!b) return;
        (cardState as any).markers = (cardState as any).markers.filter((x: any) => !(isBombCategoryMarker(x) && x.row === r && x.col === c));
    };

    converted.push(...applyDragonConversions(
        cardState,
        gameState,
        playerKey,
        player,
        opponent,
        row,
        col,
        'dragon_convert_immediate',
        protectedSet,
        clearBombAt,
        deps
    ));

    return { converted, destroyed };
}

function processDragonEffectsAtTurnStartAnchor(cardState: any, gameState: any, playerKey: string, row: number, col: number, deps: DragonDeps = {}): DragonEffectAtAnchorResult {
    const BoardOps = deps.BoardOps || DefaultBoardOps;
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

    if (getCellValue(cardState, gameState, row, col) !== player) {
        if (dragon.data) dragon.data.remainingOwnerTurns = -1;
        return { moved, converted, destroyed, anchors };
    }

    let anchorRow = row;
    let anchorCol = col;
    const moveTarget = getRandomTurnStartMoveDestination(cardState, gameState, row, col, deps);
    if (moveTarget) {
        let movedRes = false;
        let usedBoardOpsMove = false;
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
            usedBoardOpsMove = !!(res && res.markerHandled === true);
        } else {
            movedRes = setCellValue(cardState, gameState, row, col, P_EMPTY)
                && setCellValue(cardState, gameState, moveTarget.row, moveTarget.col, player);
        }
        if (movedRes) {
            if (!usedBoardOpsMove) {
                moveCoexistingMarkers(cardState, dragon, row, col, moveTarget.row, moveTarget.col, deps);
            }
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

    converted.push(...applyDragonConversions(
        cardState,
        gameState,
        playerKey,
        player,
        opponent,
        anchorRow,
        anchorCol,
        'dragon_convert',
        protectedSet,
        clearBombAt,
        deps
    ));

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
        if (isExpansionCoordinate(cardState, gameState, anchorRow, anchorCol)) {
            setCellValue(cardState, gameState, anchorRow, anchorCol, P_EMPTY);
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

    return { moved, converted, destroyed, anchors };
}

export = {
    processDragonEffects,
    processDragonEffectsAtAnchor,
    processDragonEffectsAtTurnStartAnchor
};
