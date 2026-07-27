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

function resolveUdgModuleOrGlobal(id: string, globalKey: string): any {
    if (typeof module === 'object' && module.exports) {
        return safeRequire(id) || getRuntimeGlobalValue(globalKey);
    }

    return getRuntimeGlobalValue(globalKey);
}

const SharedConstants = resolveUdgModuleOrGlobal('../../../shared-constants', 'SharedConstants');
const BoardUtils = resolveUdgModuleOrGlobal('../../../shared/shared-board-utils', 'SharedBoardUtils');
const BoardOpsModule = resolveUdgModuleOrGlobal('../board_ops', 'BoardOps');
const RandomSourceModule = resolveUdgModuleOrGlobal('../cards-internal/random-source', 'CardRandomSource');
const CardMarkersModule = resolveUdgModuleOrGlobal('./markers', 'CardMarkers');
const SpecialStoneRegistry = resolveUdgModuleOrGlobal('../../../shared/special-stone-registry', 'SpecialStoneRegistry');

const { BLACK, WHITE, EMPTY } = SharedConstants || {};
const P_BLACK = (BLACK === undefined || BLACK === null) ? 1 : BLACK;
const P_WHITE = (WHITE === undefined || WHITE === null) ? -1 : WHITE;
const P_EMPTY = (EMPTY === undefined || EMPTY === null) ? 0 : EMPTY;
const MANIFEST_STONE_TYPES = new Set(['THEORY_INCARNATION', 'BOARD_EXECUTOR', 'OBSERVER_WILL']);

if (!BoardUtils ||
    typeof BoardUtils.createBoardContext !== 'function' ||
    typeof BoardUtils.collectBoardCoordinates !== 'function' ||
    typeof BoardUtils.getCellValue !== 'function' ||
    typeof BoardUtils.setCellValue !== 'function') {
    throw new Error('SharedBoardUtils BoardContext access is required by CardUdG');
}

function createBoardContext(gameState: GameState, cardState: CardState): any {
    return BoardUtils.createBoardContext(gameState, cardState);
}

function collectBoardCells(gameState: GameState, cardState: CardState): Array<{ row: number; col: number; owner: any }> {
    const context = createBoardContext(gameState, cardState);
    return BoardUtils.collectBoardCoordinates(context).map((cell: { row: number; col: number }) => ({
        row: cell.row,
        col: cell.col,
        owner: BoardUtils.getCellValue(context, cell.row, cell.col)
    }));
}

function getCellValue(gameState: GameState, row: number, col: number, cardState: CardState): any {
    return BoardUtils.getCellValue(createBoardContext(gameState, cardState), row, col);
}

function setCellValue(gameState: GameState, row: number, col: number, value: any, cardState: CardState): boolean {
    return BoardUtils.setCellValue(createBoardContext(gameState, cardState), row, col, value);
}

function createUdgMarkersAtLookup(cardState: CardState) {
    const markers = (cardState && Array.isArray((cardState as any).markers)) ? (cardState as any).markers : [];
    const markerIndex = CardMarkersModule && typeof CardMarkersModule.createMarkerCellIndex === 'function'
        ? CardMarkersModule.createMarkerCellIndex(cardState)
        : null;
    return (row: any, col: any) => markerIndex
        ? markerIndex.get(row, col)
        : markers.filter((m: any) => m && m.row === row && m.col === col);
}

function isBlockedDestinationCell(cardState: CardState, row: number, col: number, markersAt?: (row: any, col: any) => any[]): boolean {
    const markers = typeof markersAt === 'function'
        ? markersAt(row, col)
        : ((cardState && Array.isArray((cardState as any).markers)) ? (cardState as any).markers : []);
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
    isManifestStoneAt?: (cardState: CardState, row: number, col: number) => boolean;
    markersAt?: (row: any, col: any) => any[];
    decrementRemainingOwnerTurns?: boolean;
}

function isManifestMarkerForUdg(marker: any): boolean {
    if (!marker) return false;
    if (CardMarkersModule && typeof CardMarkersModule.isManifestStoneMarker === 'function') {
        return CardMarkersModule.isManifestStoneMarker(marker) === true;
    }
    return !!(
        (marker.kind === 'manifestStone' || marker.kind === 'specialStone') &&
        MANIFEST_STONE_TYPES.has(String(marker.data && marker.data.type || '').toUpperCase())
    );
}

function isManifestTarget(cardState: CardState, row: number, col: number, deps: UDGDeps = {}): boolean {
    if (deps && typeof deps.isManifestStoneAt === 'function') {
        return !!deps.isManifestStoneAt(cardState, row, col);
    }
    if (deps && typeof deps.markersAt === 'function') {
        return deps.markersAt(row, col).some((marker: any) => isManifestMarkerForUdg(marker));
    }
    if (CardMarkersModule && typeof CardMarkersModule.isManifestStoneAt === 'function') {
        return !!CardMarkersModule.isManifestStoneAt(cardState, row, col);
    }
    const markers = (cardState && Array.isArray((cardState as any).markers)) ? (cardState as any).markers : [];
    return markers.some((marker: any) => (
        marker &&
        marker.row === row &&
        marker.col === col &&
        isManifestMarkerForUdg(marker)
    ));
}

function getRandomTurnStartMoveDestination(cardState: CardState, gameState: GameState, fromRow: number, fromCol: number, deps: UDGDeps = {}): { row: number; col: number } | null {
    if (deps && typeof deps.selectRandomEmptyBoardShapeDestination === 'function') {
        return deps.selectRandomEmptyBoardShapeDestination(cardState, gameState, fromRow, fromCol, deps.randomSource);
    }
    const candidates: Array<{ row: number; col: number }> = [];
    const markersAt = createUdgMarkersAtLookup(cardState);
    for (const cell of collectBoardCells(gameState, cardState)) {
        if (cell.row === fromRow && cell.col === fromCol) continue;
        if (cell.owner !== EMPTY) continue;
        if (isBlockedDestinationCell(cardState, cell.row, cell.col, markersAt)) continue;
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
        const boardMarker = SpecialStoneRegistry && typeof SpecialStoneRegistry.isBoardMarker === 'function'
            ? SpecialStoneRegistry.isBoardMarker(marker)
            : (CardMarkersModule && typeof CardMarkersModule.getMarkerRuleClass === 'function'
                ? CardMarkersModule.getMarkerRuleClass(marker) === 'board_marker'
                : ['BLOCKADE', 'METEOR_HOLE', 'FREEZE', 'SEED', 'POISON_CELL', 'SCORCHED_CELL']
                    .includes(String(marker && marker.data && marker.data.type || '').toUpperCase()));
        if (boardMarker) continue;
        marker.row = toRow;
        marker.col = toCol;
    }
}

function forEachNeighborCell(cardState: CardState, gameState: GameState, row: number, col: number, handler: (r: number, c: number, value: any) => void): void {
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const r = row + dr;
            const c = col + dc;
            const value = getCellValue(gameState, r, c, cardState);
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

function getNeighborCellsSnapshot(cardState: CardState, gameState: GameState, row: number, col: number): CellSnapshot[] {
    const cells: CellSnapshot[] = [];
    forEachNeighborCell(cardState, gameState, row, col, (r, c, value) => {
        cells.push({ row: r, col: c, value });
    });
    return cells;
}

function collectDestroyedNeighbors(cardState: CardState, gameState: GameState, playerKey: PlayerKey, opponent: number, sourceRow: number, sourceCol: number, deps: UDGDeps = {}): Array<{ row: number; col: number }> {
    const destroyed: Array<{ row: number; col: number }> = [];
    const destroyAt = deps.destroyAt || ((cs: any, gs: GameState, r: number, c: number) => {
        const current = getCellValue(gs, r, c, cs);
        if (current === null || current === EMPTY) return false;
        if (cs.markers) cs.markers = cs.markers.filter((m: any) => !(m.row === r && m.col === c));
        return setCellValue(gs, r, c, EMPTY, cs);
    });

    const neighborCells = getNeighborCellsSnapshot(cardState, gameState, sourceRow, sourceCol);
    const markersAt = createUdgMarkersAtLookup(cardState);
    const targetDeps = { ...deps, markersAt };
    const targets = neighborCells.filter((cell) => cell && cell.value === opponent && !isManifestTarget(cardState, cell.row, cell.col, targetDeps));
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
        const current = getCellValue(gs, r, c, cs);
        if (current === null || current === EMPTY) return false;
        if (cs.markers) cs.markers = cs.markers.filter((m: any) => !(m.row === r && m.col === c));
        return setCellValue(gs, r, c, EMPTY, cs);
    });

    if (!udg) return { moved, destroyed, anchors, expired };
    if (getCellValue(gameState, udg.row, udg.col, cardState) !== player) {
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
            movedRes = setCellValue(gameState, fromRow, fromCol, EMPTY, cardState) &&
                setCellValue(gameState, moveTarget.row, moveTarget.col, player, cardState);
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
        const current = getCellValue(gs, r, c, cs);
        if (current === null || current === EMPTY) return false;
        if (cs.markers) cs.markers = cs.markers.filter((m: any) => !(m.row === r && m.col === c));
        return setCellValue(gs, r, c, EMPTY, cs);
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

function processUltimateDestroyGodEffectsAtAnchor(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: UDGDeps = {}): { destroyed: Array<{ row: number; col: number }>; expired?: Array<{ row: number; col: number; owner: PlayerKey; reason: string }> } {
    const destroyed: Array<{ row: number; col: number }> = [];
    const P_BLACK = BLACK || 1;
    const P_WHITE = WHITE || -1;
    const player = playerKey === 'black' ? P_BLACK : P_WHITE;
    const opponent = -player;

    const destroyAt = deps.destroyAt || ((cs: any, gs: GameState, r: number, c: number) => {
        const current = getCellValue(gs, r, c, cs);
        if (current === null || current === EMPTY) return false;
        if (cs.markers) cs.markers = cs.markers.filter((m: any) => !(m.row === r && m.col === c));
        return setCellValue(gs, r, c, EMPTY, cs);
    });

    const udg = ((cardState as any).markers || []).find((s: any) =>
        s.kind === 'specialStone' && s.data && s.data.type === 'ULTIMATE_DESTROY_GOD' && s.owner === playerKey && s.row === row && s.col === col
    );
    if (!udg) return { destroyed };
    if (getCellValue(gameState, row, col, cardState) !== player) return { destroyed };

    const neighborCells = getNeighborCellsSnapshot(cardState, gameState, row, col);
    const markersAt = createUdgMarkersAtLookup(cardState);
    const targetDeps = { ...deps, markersAt };
    const targets = neighborCells.filter((cell) => cell && cell.value === opponent && !isManifestTarget(cardState, cell.row, cell.col, targetDeps));
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
