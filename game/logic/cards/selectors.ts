/**
 * @file selectors.ts
 * @description Card selectable-target helpers (Shared between Browser and Headless)
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

function resolveSelectorsModuleOrGlobal(id: string, globalKey: string): any {
    if (typeof module === 'object' && module.exports) {
        return safeRequire(id) || getRuntimeGlobalValue(globalKey);
    }

    return getRuntimeGlobalValue(globalKey);
}

const SharedConstants = resolveSelectorsModuleOrGlobal('../../../shared-constants', 'SharedConstants');
const CardUtils = resolveSelectorsModuleOrGlobal('./utils', 'CardUtils');
const SharedBoardUtils = resolveSelectorsModuleOrGlobal('../../../shared/shared-board-utils', 'SharedBoardUtils');
const SelectorsCoreUtils = resolveSelectorsModuleOrGlobal('./selectors-core-utils', 'CardSelectorsCoreUtils');
const SelectorsBoardShape = resolveSelectorsModuleOrGlobal('./selectors-board-shape', 'CardSelectorsBoardShape');

const { EMPTY } = SharedConstants || {};
const P_EMPTY = (EMPTY === undefined || EMPTY === null) ? 0 : EMPTY;
const BOARD_SHRINK_SELECTION_COUNT = 3;

function getSelectorsBoardShapeDeps() {
    return {
        SharedBoardUtils,
        SharedConstants,
        P_EMPTY
    };
}

function isBlockingMarkerType(type: string): boolean {
    if (SelectorsCoreUtils && typeof SelectorsCoreUtils.isBlockingMarkerType === 'function') {
        return SelectorsCoreUtils.isBlockingMarkerType(type);
    }
    return type === 'BLOCKADE' || type === 'METEOR_HOLE' || type === 'FREEZE';
}

function isBombCategoryMarker(marker: any): boolean {
    if (SelectorsCoreUtils && typeof SelectorsCoreUtils.isBombCategoryMarker === 'function') {
        return SelectorsCoreUtils.isBombCategoryMarker(marker);
    }
    return !!(
        marker &&
        marker.kind === 'specialStone' &&
        marker.data &&
        marker.data.category === 'bomb'
    );
}

function isManifestStoneMarkerForSelectors(marker: any): boolean {
    if (CardUtils && typeof CardUtils.isManifestStoneMarker === 'function') {
        return CardUtils.isManifestStoneMarker(marker) === true;
    }
    if (SelectorsCoreUtils && typeof SelectorsCoreUtils.isManifestStoneMarker === 'function') {
        return SelectorsCoreUtils.isManifestStoneMarker(marker) === true;
    }
    const type = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
    return !!(
        marker &&
        (marker.kind === 'manifestStone' || marker.kind === 'specialStone') &&
        (type === 'THEORY_INCARNATION' || type === 'BOARD_EXECUTOR' || type === 'OBSERVER_WILL')
    );
}

function isFrozenCell(cardState: CardState, row: number, col: number): boolean {
    if (SelectorsCoreUtils && typeof SelectorsCoreUtils.isFrozenCell === 'function') {
        return SelectorsCoreUtils.isFrozenCell(cardState, row, col, CardUtils);
    }
    if (CardUtils && typeof CardUtils.isFrozenCell === 'function') {
        return !!CardUtils.isFrozenCell(cardState, row, col);
    }
    const cs = cardState as any;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    return markers.some((m: any) => (
        m &&
        m.kind === 'specialStone' &&
        m.row === row &&
        m.col === col &&
        m.data &&
        m.data.type === 'FREEZE'
    ));
}

function hasSeedMarkerAt(cardState: CardState, row: number, col: number): boolean {
    if (SelectorsCoreUtils && typeof SelectorsCoreUtils.hasSeedMarkerAt === 'function') {
        return SelectorsCoreUtils.hasSeedMarkerAt(cardState, row, col);
    }
    const cs = cardState as any;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    return markers.some((m: any) => (
        m &&
        m.kind === 'specialStone' &&
        m.row === row &&
        m.col === col &&
        m.data &&
        m.data.type === 'SEED'
    ));
}

function isBlockedCell(cardState: CardState, row: number, col: number): boolean {
    if (SelectorsCoreUtils && typeof SelectorsCoreUtils.isBlockedCell === 'function') {
        return SelectorsCoreUtils.isBlockedCell(cardState, row, col);
    }
    const cs = cardState as any;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    return markers.some((m: any) => (
        m &&
        m.kind === 'specialStone' &&
        m.row === row &&
        m.col === col &&
        m.data &&
        isBlockingMarkerType(m.data.type)
    ));
}

function isMeteorHoleCell(cardState: CardState, row: number, col: number): boolean {
    if (SelectorsCoreUtils && typeof SelectorsCoreUtils.isMeteorHoleCell === 'function') {
        return SelectorsCoreUtils.isMeteorHoleCell(cardState, row, col);
    }
    const cs = cardState as any;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    return markers.some((m: any) => (
        m &&
        m.kind === 'specialStone' &&
        m.row === row &&
        m.col === col &&
        m.data &&
        m.data.type === 'METEOR_HOLE'
    ));
}

function isGuardProtectedCell(cardState: CardState, row: number, col: number): boolean {
    if (SelectorsCoreUtils && typeof SelectorsCoreUtils.isGuardProtectedCell === 'function') {
        return SelectorsCoreUtils.isGuardProtectedCell(cardState, row, col);
    }
    const cs = cardState as any;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    return markers.some((m: any) => (
        m &&
        m.kind === 'specialStone' &&
        m.row === row &&
        m.col === col &&
        m.data &&
        m.data.type === 'GUARD'
    ));
}

function isInviolableCell(cardState: CardState, row: number, col: number): boolean {
    if (SelectorsCoreUtils && typeof SelectorsCoreUtils.isInviolableCell === 'function') {
        return SelectorsCoreUtils.isInviolableCell(cardState, row, col);
    }
    if (CardUtils && typeof CardUtils.isManifestStoneAt === 'function' && CardUtils.isManifestStoneAt(cardState, row, col)) {
        return true;
    }
    const cs = cardState as any;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    return markers.some((m: any) => (
        m &&
        m.row === row &&
        m.col === col &&
        (
            m.kind === 'manifestStone' ||
            (
                m.kind === 'specialStone' &&
                m.data &&
                isManifestStoneMarkerForSelectors(m)
            )
        )
    ));
}

function isPositionSwapProtectedCell(cardState: CardState, row: number, col: number): boolean {
    if (SelectorsCoreUtils && typeof SelectorsCoreUtils.isPositionSwapProtectedCell === 'function') {
        return SelectorsCoreUtils.isPositionSwapProtectedCell(cardState, row, col);
    }
    if (isFrozenCell(cardState, row, col)) return true;
    if (isInviolableCell(cardState, row, col)) return true;
    const cs = cardState as any;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    const marker = markers.find((m: any) => (
        m &&
        m.kind === 'specialStone' &&
        m.row === row &&
        m.col === col &&
        m.data &&
        m.data.type === 'GLUTTONOUS'
    ));
    return !!marker;
}

function getCellValue(cardState: CardState, gameState: GameState, row: number, col: number): any {
    if (!SelectorsBoardShape || typeof SelectorsBoardShape.getCellValue !== 'function') {
        throw new Error('CardSelectorsBoardShape.getCellValue is required');
    }
    return SelectorsBoardShape.getCellValue(
        cardState,
        gameState,
        row,
        col,
        getSelectorsBoardShapeDeps()
    );
}

function hasBoardShapeCell(cardState: CardState, gameState: GameState, row: number, col: number): boolean {
    if (!SelectorsBoardShape || typeof SelectorsBoardShape.hasBoardShapeCell !== 'function') {
        throw new Error('CardSelectorsBoardShape.hasBoardShapeCell is required');
    }
    return SelectorsBoardShape.hasBoardShapeCell(
        cardState,
        gameState,
        row,
        col,
        getSelectorsBoardShapeDeps()
    );
}

function forEachBoardShapeCell(
    cardState: CardState,
    gameState: GameState,
    visitor: (r: number, c: number, owner: number) => void
): void {
    if (!SelectorsBoardShape || typeof SelectorsBoardShape.forEachBoardShapeCell !== 'function') {
        throw new Error('CardSelectorsBoardShape.forEachBoardShapeCell is required');
    }
    return SelectorsBoardShape.forEachBoardShapeCell(
        cardState,
        gameState,
        visitor,
        getSelectorsBoardShapeDeps()
    );
}

function getPendingEffect(cardState: CardState, playerKey: PlayerKey): any {
    const cs = cardState as any;
    if (!cs || !cs.pendingEffectByPlayer || !playerKey) return null;
    return cs.pendingEffectByPlayer[playerKey] || null;
}

function toTargetKey(row: number, col: number): string {
    return `${row},${col}`;
}

function getShapeAwareBoard(cardState: CardState, gameState: GameState): any {
    if (
        !SharedBoardUtils
        || typeof SharedBoardUtils.createBoardContext !== 'function'
    ) {
        throw new Error('SharedBoardUtils.createBoardContext is required by CardSelectors');
    }
    const gs = gameState as any;
    if (!gs || !Array.isArray(gs.board)) return null;
    return SharedBoardUtils.createBoardContext(gs, cardState || null);
}

function getBoardShrinkSelectedKeys(cardState: CardState, playerKey: PlayerKey): Set<string> {
    const pending = getPendingEffect(cardState, playerKey);
    if (!pending || pending.type !== 'BOARD_SHRINK_WILL' || !Array.isArray(pending.selectedTargets)) return new Set();
    const selectedKeys = new Set<string>();
    for (const target of pending.selectedTargets) {
        if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col)) continue;
        selectedKeys.add(toTargetKey(target.row, target.col));
    }
    return selectedKeys;
}

interface LineDescriptor {
    cells: any[];
}

function hasShrinkGodHoleCandidate(cardState: CardState, lineDescriptor: LineDescriptor): boolean {
    if (!lineDescriptor || !Array.isArray(lineDescriptor.cells)) return false;
    return lineDescriptor.cells.some((cell: any) => (
        cell &&
        Number.isInteger(cell.row) &&
        Number.isInteger(cell.col) &&
        !isInviolableCell(cardState, cell.row, cell.col)
    ));
}

interface BoardShrinkGodLineDescriptor {
    corner: { row: number; col: number };
    directionTarget: { row: number; col: number };
    direction?: any;
    cells: any[];
    canonicalKey?: string;
    key?: string;
}

function getBoardShrinkGodLineDescriptors(cardState: CardState, gameState: GameState, playerKey: PlayerKey): BoardShrinkGodLineDescriptor[] {
    const board = getShapeAwareBoard(cardState, gameState);
    if (!board || !SharedBoardUtils || typeof SharedBoardUtils.getCornerEdgeLineDescriptors !== 'function') return [];
    const lines = SharedBoardUtils.getCornerEdgeLineDescriptors(board);
    const rawLineCountByCorner = new Map<string, number>();
    for (const line of lines) {
        if (!line || !line.corner || !Number.isInteger(line.corner.row) || !Number.isInteger(line.corner.col)) continue;
        const cornerKey = toTargetKey(line.corner.row, line.corner.col);
        rawLineCountByCorner.set(cornerKey, (rawLineCountByCorner.get(cornerKey) || 0) + 1);
    }
    const pending = getPendingEffect(cardState, playerKey);
    const firstTarget = pending && pending.type === 'BOARD_SHRINK_GOD' && pending.firstTarget
        ? pending.firstTarget
        : null;
    return lines.filter((line: any) => {
        if (!line || !line.corner || !line.directionTarget) return false;
        if (firstTarget && (line.corner.row !== firstTarget.row || line.corner.col !== firstTarget.col)) return false;
        if (!firstTarget) {
            const cornerKey = toTargetKey(line.corner.row, line.corner.col);
            if ((rawLineCountByCorner.get(cornerKey) || 0) < 2) return false;
        }
        return hasShrinkGodHoleCandidate(cardState, line);
    });
}

interface TargetCell {
    row: number;
    col: number;
    side?: string | null;
    direction?: { row: number; col: number } | null;
    directionKey?: string | null;
    additions?: { row: number; col: number }[];
    selectedTargets?: { row: number; col: number }[];
    lineCells?: { row: number; col: number }[];
}

// Return all non-empty cells (for DESTROY_ONE_STONE)
function getDestroyTargets(cardState: CardState, gameState: GameState): TargetCell[] {
    const res: TargetCell[] = [];
    const cs = cardState as any;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    forEachBoardShapeCell(cardState, gameState, (r, c, owner) => {
        if (owner === P_EMPTY) return;
        if (isInviolableCell(cardState, r, c)) return;
        const guarded = markers.some((m: any) =>
            m &&
            m.kind === 'specialStone' &&
            m.row === r &&
            m.col === c &&
            m.data &&
            m.data.type === 'GUARD'
        );
        if (guarded) return;
        if (isFrozenCell(cardState, r, c)) return;
        res.push({ row: r, col: c });
    });

    return res;
}

// Return swap targets: opponent NORMAL stones only (no special markers, no bombs)
function getSwapTargets(cardState: CardState, gameState: GameState, playerKey: PlayerKey): TargetCell[] {
    const res: TargetCell[] = [];
    const opVal = playerKey === 'black' ? SharedConstants.WHITE : SharedConstants.BLACK;
    const cs = cardState as any;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    const isHiddenTrapForPlayer = (m: any) => (
        m &&
        m.kind === 'specialStone' &&
        m.data &&
        m.data.type === 'TRAP' &&
        m.owner &&
        m.owner !== playerKey
    );

    const canSwapCell = (row: number, col: number, ownerValue: number) => {
        if (ownerValue !== opVal) return;
        if (isInviolableCell(cardState, row, col)) return;
        const hasSpecialOrBomb = markers.some((m: any) => {
            if (!m || m.row !== row || m.col !== col) return false;
            if (m.kind !== 'specialStone') return false;
            if (isHiddenTrapForPlayer(m)) return false;
            const isExpiredUltimateHyperactive = !!(
                m.data &&
                m.data.type === 'ULTIMATE_HYPERACTIVE' &&
                Number.isFinite(Number(m.data.remainingOwnerTurns)) &&
                Number(m.data.remainingOwnerTurns) <= 0
            );
            if (isExpiredUltimateHyperactive) return false;
            return true;
        });
        if (hasSpecialOrBomb) return;
        res.push({ row, col });
    };

    forEachBoardShapeCell(cardState, gameState, (r, c, owner) => {
        canSwapCell(r, c, owner);
    });
    return res;
}

// Return position-swap targets: any occupied cell; if first target exists, exclude it.
function getPositionSwapTargets(cardState: CardState, gameState: GameState, playerKey: PlayerKey, pending: any): TargetCell[] {
    const res: TargetCell[] = [];
    const first = pending && pending.firstTarget ? pending.firstTarget : null;

    const pushIfOccupied = (row: number, col: number, ownerValue: number) => {
        if (ownerValue === P_EMPTY) return;
        if (first && first.row === row && first.col === col) return;
        if (isPositionSwapProtectedCell(cardState, row, col)) return;
        res.push({ row, col });
    };

    forEachBoardShapeCell(cardState, gameState, (r, c, owner) => {
        pushIfOccupied(r, c, owner);
    });
    return res;
}

interface DestinationCell extends TargetCell {
    side?: string | null;
    active?: boolean;
}

function _getStrongWindDirectionDestination(cardState: CardState, gameState: GameState, row: number, col: number, dr: number, dc: number): DestinationCell | null {
    const nr = row + dr;
    const nc = col + dc;
    if (!hasBoardShapeCell(cardState, gameState, nr, nc)) return null;
    if (getCellValue(cardState, gameState, nr, nc) !== P_EMPTY) return null;
    if (isBlockedCell(cardState, nr, nc)) return null;

    let tr = nr;
    let tc = nc;
    while (true) {
        const rr = tr + dr;
        const cc = tc + dc;
        if (!hasBoardShapeCell(cardState, gameState, rr, cc)) break;
        if (getCellValue(cardState, gameState, rr, cc) !== P_EMPTY) break;
        if (isBlockedCell(cardState, rr, cc)) break;
        tr = rr;
        tc = cc;
    }
    return { row: tr, col: tc };
}

// Return strong-wind targets: any non-empty stone that has at least one movable horizontal direction.
function getStrongWindTargets(cardState: CardState, gameState: GameState): TargetCell[] {
    const res: TargetCell[] = [];
    forEachBoardShapeCell(cardState, gameState, (r, c, owner) => {
        if (owner === P_EMPTY) return;
        if (isInviolableCell(cardState, r, c)) return;
        let movable = false;
        for (const d of [[0, -1], [0, 1]]) {
            if (_getStrongWindDirectionDestination(cardState, gameState, r, c, d[0], d[1])) {
                movable = true;
                break;
            }
        }
        if (movable) res.push({ row: r, col: c });
    });
    return res;
}

function _collectVerticalCrushDestination(cardState: CardState, gameState: GameState, row: number, col: number, dr: number): DestinationCell | null {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    if (dr !== -1 && dr !== 1) return null;

    const firstRow = row + dr;
    if (!hasBoardShapeCell(cardState, gameState, firstRow, col)) return null;

    let destination: DestinationCell | null = null;
    for (let r = firstRow; hasBoardShapeCell(cardState, gameState, r, col); r += dr) {
        if (isBlockedCell(cardState, r, col)) break;
        if (getCellValue(cardState, gameState, r, col) !== P_EMPTY && isGuardProtectedCell(cardState, r, col)) break;
        destination = { row: r, col };
    }
    return destination;
}

function isGhostCell(cardState: CardState, row: number, col: number): boolean {
    const cs = cardState as any;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    return markers.some((m: any) => (
        m &&
        m.kind === 'specialStone' &&
        m.row === row &&
        m.col === col &&
        m.data &&
        m.data.type === 'GHOST'
    ));
}

function getSuperAttractionPathCandidates(fromRow: number, fromCol: number, toRow: number, toCol: number): any[] {
    if (SelectorsCoreUtils && typeof SelectorsCoreUtils.getSuperAttractionPathCandidates === 'function') {
        return SelectorsCoreUtils.getSuperAttractionPathCandidates(
            { row: fromRow, col: fromCol },
            { row: toRow, col: toCol }
        );
    }
    return [];
}

function isSuperAttractionPathCandidateLegal(cardState: CardState, gameState: GameState, candidate: any): boolean {
    const pathCells = Array.isArray(candidate && candidate.pathCells) ? candidate.pathCells : [];
    if (pathCells.length <= 0) return false;

    for (let index = 0; index < pathCells.length; index += 1) {
        const point = pathCells[index];
        if (!point || !hasBoardShapeCell(cardState, gameState, point.row, point.col)) return false;
        if (isBlockedCell(cardState, point.row, point.col)) return false;

        const owner = getCellValue(cardState, gameState, point.row, point.col);
        if (owner !== P_EMPTY && isGuardProtectedCell(cardState, point.row, point.col)) return false;
        if (index === pathCells.length - 1 && owner !== P_EMPTY && isGhostCell(cardState, point.row, point.col)) return false;
    }

    return true;
}

function canSuperAttractionTravelTo(cardState: CardState, gameState: GameState, fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    if (!hasBoardShapeCell(cardState, gameState, toRow, toCol)) return false;
    const candidates = getSuperAttractionPathCandidates(fromRow, fromCol, toRow, toCol);
    return candidates.some((candidate: any) => isSuperAttractionPathCandidateLegal(cardState, gameState, candidate));
}

function hasSuperAttractionDestination(cardState: CardState, gameState: GameState, row: number, col: number): boolean {
    let found = false;
    forEachBoardShapeCell(cardState, gameState, (targetRow, targetCol) => {
        if (found) return;
        if (targetRow === row && targetCol === col) return;
        if (canSuperAttractionTravelTo(cardState, gameState, row, col, targetRow, targetCol)) {
            found = true;
        }
    });
    return found;
}

function getSuperAttractionTargets(cardState: CardState, gameState: GameState, playerKey?: PlayerKey, pending?: any): TargetCell[] {
    const first = pending && pending.firstTarget
        ? { row: pending.firstTarget.row, col: pending.firstTarget.col }
        : null;
    const res: TargetCell[] = [];
    if (first && Number.isInteger(first.row) && Number.isInteger(first.col)) {
        const firstOwner = getCellValue(cardState, gameState, first.row, first.col);
        if (firstOwner === null || firstOwner === P_EMPTY) return res;
        if (isInviolableCell(cardState, first.row, first.col)) return res;
    forEachBoardShapeCell(cardState, gameState, (r, c) => {
            if (r === first.row && c === first.col) return;
            if (canSuperAttractionTravelTo(cardState, gameState, first.row, first.col, r, c)) {
                res.push({ row: r, col: c });
            }
        });
        return res;
    }

    forEachBoardShapeCell(cardState, gameState, (r, c, owner) => {
        if (owner === P_EMPTY) return;
        if (isInviolableCell(cardState, r, c)) return;
        if (hasSuperAttractionDestination(cardState, gameState, r, c)) {
            res.push({ row: r, col: c });
        }
    });
    return res;
}

function cloneSuperAttractionPathCandidate(candidate: any): any {
    return {
        variant: candidate && candidate.variant ? candidate.variant : 'single_segment',
        pathCells: Array.isArray(candidate && candidate.pathCells)
            ? candidate.pathCells.map((point: any) => ({ row: point.row, col: point.col }))
            : [],
        segments: Array.isArray(candidate && candidate.segments)
            ? candidate.segments.map((segment: any) => ({
                from: { row: segment.from.row, col: segment.from.col },
                to: { row: segment.to.row, col: segment.to.col },
                dr: segment.dr,
                dc: segment.dc,
                length: segment.length
            }))
            : [],
        waypoints: Array.isArray(candidate && candidate.waypoints)
            ? candidate.waypoints.map((point: any) => ({ row: point.row, col: point.col }))
            : [],
        movedDistance: Number(candidate && candidate.movedDistance) || 0
    };
}

function getSuperAttractionPathPreview(cardState: CardState, gameState: GameState, from: any, to: any): any[] {
    const fromRow = Number(from && from.row);
    const fromCol = Number(from && from.col);
    const toRow = Number(to && to.row);
    const toCol = Number(to && to.col);
    if (
        !Number.isInteger(fromRow) ||
        !Number.isInteger(fromCol) ||
        !Number.isInteger(toRow) ||
        !Number.isInteger(toCol)
    ) {
        return [];
    }
    if (fromRow === toRow && fromCol === toCol) return [];
    const firstOwner = getCellValue(cardState, gameState, fromRow, fromCol);
    if (firstOwner === null || firstOwner === P_EMPTY) return [];
    if (!hasBoardShapeCell(cardState, gameState, toRow, toCol)) return [];

    return getSuperAttractionPathCandidates(fromRow, fromCol, toRow, toCol)
        .filter((candidate: any) => isSuperAttractionPathCandidateLegal(cardState, gameState, candidate))
        .map(cloneSuperAttractionPathCandidate);
}

function _collectVerticalSlideDestination(cardState: CardState, gameState: GameState, row: number, col: number, dr: number): DestinationCell | null {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    if (dr !== -1 && dr !== 1) return null;

    const firstRow = row + dr;
    if (!hasBoardShapeCell(cardState, gameState, firstRow, col)) return null;
    if (isBlockedCell(cardState, firstRow, col)) return null;
    if (getCellValue(cardState, gameState, firstRow, col) !== P_EMPTY) return null;

    let destination: DestinationCell = { row: firstRow, col };
    for (let r = firstRow + dr; hasBoardShapeCell(cardState, gameState, r, col); r += dr) {
        if (isBlockedCell(cardState, r, col)) break;
        if (getCellValue(cardState, gameState, r, col) !== P_EMPTY) break;
        destination = { row: r, col };
    }
    return destination;
}

function _getVerticalCrushTargets(cardState: CardState, gameState: GameState, dr: number): TargetCell[] {
    const res: TargetCell[] = [];
    forEachBoardShapeCell(cardState, gameState, (r, c, owner) => {
        if (owner === P_EMPTY) return;
        if (isInviolableCell(cardState, r, c)) return;
        const destination = _collectVerticalCrushDestination(cardState, gameState, r, c, dr);
        if (!destination) return;
        if (destination.row === r && destination.col === c) return;
        res.push({ row: r, col: c });
    });
    return res;
}

function _getVerticalSlideTargets(cardState: CardState, gameState: GameState, dr: number): TargetCell[] {
    const res: TargetCell[] = [];
    forEachBoardShapeCell(cardState, gameState, (r, c, owner) => {
        if (owner === P_EMPTY) return;
        if (isInviolableCell(cardState, r, c)) return;
        const destination = _collectVerticalSlideDestination(cardState, gameState, r, c, dr);
        if (!destination) return;
        res.push({ row: r, col: c });
    });
    return res;
}

function getSuperBuoyancyTargets(cardState: CardState, gameState: GameState): TargetCell[] {
    return _getVerticalCrushTargets(cardState, gameState, -1);
}

function getBuoyancyTargets(cardState: CardState, gameState: GameState): TargetCell[] {
    return _getVerticalSlideTargets(cardState, gameState, -1);
}

function getSuperGravityTargets(cardState: CardState, gameState: GameState): TargetCell[] {
    return _getVerticalCrushTargets(cardState, gameState, 1);
}

function getGravityTargets(cardState: CardState, gameState: GameState): TargetCell[] {
    return _getVerticalSlideTargets(cardState, gameState, 1);
}

// Return trap targets: own stones (including special stones), excluding bombs/own existing trap/inviolable cells.
function getTrapTargets(cardState: CardState, gameState: GameState, playerKey: PlayerKey): TargetCell[] {
    const res: TargetCell[] = [];
    const playerVal = playerKey === 'black' ? SharedConstants.BLACK : SharedConstants.WHITE;
    const cs = cardState as any;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];

    forEachBoardShapeCell(cardState, gameState, (r, c, owner) => {
        if (owner !== playerVal) return;
        const hasBomb = markers.some((m: any) => m && m.row === r && m.col === c && isBombCategoryMarker(m));
        if (hasBomb) return;
        if (isInviolableCell(cardState, r, c)) return;
        const hasOwnTrap = markers.some((m: any) => (
            m &&
            m.row === r &&
            m.col === c &&
            m.kind === 'specialStone' &&
            m.owner === playerKey &&
            m.data &&
            m.data.type === 'TRAP'
        ));
        if (hasOwnTrap) return;
        res.push({ row: r, col: c });
    });
    return res;
}

// Return guard targets: own stones (normal/special both allowed), excluding bombs/inviolable cells.
function getGuardTargets(cardState: CardState, gameState: GameState, playerKey: PlayerKey): TargetCell[] {
    const res: TargetCell[] = [];
    const playerVal = playerKey === 'black' ? SharedConstants.BLACK : SharedConstants.WHITE;
    const cs = cardState as any;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    forEachBoardShapeCell(cardState, gameState, (r, c, owner) => {
        if (owner !== playerVal) return;
        const hasBomb = markers.some((m: any) => m && m.row === r && m.col === c && isBombCategoryMarker(m));
        if (hasBomb) return;
        if (isInviolableCell(cardState, r, c)) return;
        res.push({ row: r, col: c });
    });
    return res;
}

function getLivingWillTargets(cardState: CardState, gameState: GameState, playerKey: PlayerKey): TargetCell[] {
    const res: TargetCell[] = [];
    const playerVal = playerKey === 'black' ? SharedConstants.BLACK : SharedConstants.WHITE;
    const cs = cardState as any;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    forEachBoardShapeCell(cardState, gameState, (r, c, owner) => {
        if (owner !== playerVal) return;
        const hasBomb = markers.some((m: any) => m && m.row === r && m.col === c && isBombCategoryMarker(m));
        if (hasBomb) return;
        if (isInviolableCell(cardState, r, c)) return;
        const hasLivingWill = markers.some((m: any) => (
            m &&
            m.kind === 'specialStone' &&
            m.row === r &&
            m.col === c &&
            m.data &&
            m.data.type === 'LIVING_WILL'
        ));
        if (hasLivingWill) return;
        res.push({ row: r, col: c });
    });
    return res;
}

// Return hyperactive-inherit targets: own stones (normal/special both allowed), excluding bombs.
// This includes already-special stones like HYPERACTIVE / ROBOT_VACUUM / ULTIMATE_HYPERACTIVE.
function getHyperactiveInheritTargets(cardState: CardState, gameState: GameState, playerKey: PlayerKey): TargetCell[] {
    return getGuardTargets(cardState, gameState, playerKey);
}

function getExtendLifeTargets(cardState: CardState, _gameState: GameState, playerKey: PlayerKey): TargetCell[] {
    const ownerKey = String(playerKey || '');
    const cs = cardState as any;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    const isTrueSpecialStoneMarker = CardUtils && typeof CardUtils.isTrueSpecialStoneMarker === 'function'
        ? CardUtils.isTrueSpecialStoneMarker
        : (() => false);
    const isDurationAffectableMarker = CardUtils && typeof CardUtils.isDurationAffectableMarker === 'function'
        ? CardUtils.isDurationAffectableMarker
        : (() => false);
    const res: TargetCell[] = [];
    const seen = new Set<string>();
    for (const marker of markers) {
        if (!marker || marker.kind !== 'specialStone') continue;
        if (!isTrueSpecialStoneMarker(marker)) continue;
        if (!isDurationAffectableMarker(marker)) continue;
        if (marker.owner !== ownerKey) continue;
        const remaining = (marker.data && Number.isFinite(marker.data.remainingOwnerTurns))
            ? Number(marker.data.remainingOwnerTurns)
            : null;
        if (typeof remaining !== 'number' || remaining <= 0) continue;
        const key = `${marker.row},${marker.col}`;
        if (seen.has(key)) continue;
        seen.add(key);
        res.push({ row: marker.row, col: marker.col });
    }
    return res;
}

function getCorrosionTargets(cardState: CardState, _gameState: GameState, _playerKey: PlayerKey): TargetCell[] {
    const cs = cardState as any;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    const isDurationAffectableMarker = CardUtils && typeof CardUtils.isDurationAffectableMarker === 'function'
        ? CardUtils.isDurationAffectableMarker
        : ((marker: any) => !!(marker && marker.kind === 'specialStone'));
    const res: TargetCell[] = [];
    const seen = new Set<string>();
    for (const marker of markers) {
        if (!marker || marker.kind !== 'specialStone') continue;
        if (!isDurationAffectableMarker(marker)) continue;
        if (isGuardProtectedCell(cardState, marker.row, marker.col)) continue;
        const remaining = (marker.data && Number.isFinite(marker.data.remainingOwnerTurns))
            ? Number(marker.data.remainingOwnerTurns)
            : null;
        if (typeof remaining !== 'number' || remaining <= 0) continue;
        const key = `${marker.row},${marker.col}`;
        if (seen.has(key)) continue;
        seen.add(key);
        res.push({ row: marker.row, col: marker.col });
    }
    return res;
}

// Return time-bomb targets: own stones (normal/special both allowed), excluding bombs.
function getTimeBombTargets(cardState: CardState, gameState: GameState, playerKey: PlayerKey): TargetCell[] {
    return getGuardTargets(cardState, gameState, playerKey);
}

// Return teleport targets: any occupied stone (owner/type unrestricted)
// when at least one non-blocked empty destination exists on board.
function getTeleportTargets(cardState: CardState, gameState: GameState): TargetCell[] {
    const gs = gameState as any;
    if (!gs || !Array.isArray(gs.board)) return [];

    let hasDestination = false;
    forEachBoardShapeCell(cardState, gameState, (r, c, owner) => {
        if (hasDestination) return;
        if (owner !== P_EMPTY) return;
        if (isBlockedCell(cardState, r, c)) return;
        hasDestination = true;
    });
    if (!hasDestination) return [];

    const res: TargetCell[] = [];
    forEachBoardShapeCell(cardState, gameState, (r, c, owner) => {
        if (owner === P_EMPTY) return;
        if (isFrozenCell(cardState, r, c)) return;
        if (isInviolableCell(cardState, r, c)) return;
        res.push({ row: r, col: c });
    });
    return res;
}

function hasAnyCloneSpawnSpace(cardState: CardState, gameState: GameState): boolean {
    let found = false;
    forEachBoardShapeCell(cardState, gameState, (r, c, owner) => {
        if (found) return;
        if (owner !== P_EMPTY) return;
        if (isBlockedCell(cardState, r, c)) return;
        found = true;
    });
    return found;
}

function getCloneTargets(cardState: CardState, gameState: GameState, playerKey: PlayerKey): TargetCell[] {
    if (!hasAnyCloneSpawnSpace(cardState, gameState)) return [];
    const res: TargetCell[] = [];
    const playerVal = playerKey === 'black' ? SharedConstants.BLACK : SharedConstants.WHITE;
    forEachBoardShapeCell(cardState, gameState, (r, c, owner) => {
        if (owner !== playerVal) return;
        if (isInviolableCell(cardState, r, c)) return;
        res.push({ row: r, col: c });
    });
    return res;
}

function resolveExpansionSide(side: string | null, row: number, col: number, gameState: GameState): string | null {
    if (!SelectorsBoardShape || typeof SelectorsBoardShape.resolveExpansionSide !== 'function') {
        throw new Error('CardSelectorsBoardShape.resolveExpansionSide is required');
    }
    return SelectorsBoardShape.resolveExpansionSide(side, row, col, gameState, getSelectorsBoardShapeDeps());
}

interface ExpansionCell {
    side: string | null;
    row: number;
    col: number;
    owner: number;
}

function getExpansionCells(cardState: CardState, gameState: GameState): ExpansionCell[] {
    if (!SelectorsBoardShape || typeof SelectorsBoardShape.getExpansionCells !== 'function') {
        throw new Error('CardSelectorsBoardShape.getExpansionCells is required');
    }
    return SelectorsBoardShape.getExpansionCells(
        cardState,
        gameState,
        getSelectorsBoardShapeDeps()
    );
}

function resolveExpansionTargetSide(directionKey: any): string | null {
    const key = String(directionKey || '').toLowerCase();
    if (key === 'left') return 'left';
    if (key === 'right') return 'right';
    if (key === 'up') return 'top';
    if (key === 'down') return 'bottom';
    return null;
}

function mapExpansionSocketTarget(socket: any): TargetCell | null {
    if (!socket || !socket.anchor || !Number.isInteger(socket.anchor.row) || !Number.isInteger(socket.anchor.col)) return null;
    const additions = Array.isArray(socket.additions)
        ? socket.additions
            .filter((cell: any) => cell && Number.isInteger(cell.row) && Number.isInteger(cell.col))
            .map((cell: any) => ({ row: cell.row, col: cell.col }))
        : [];
    if (!additions.length || typeof socket.directionKey !== 'string' || !socket.directionKey) return null;
    return {
        row: socket.anchor.row,
        col: socket.anchor.col,
        side: resolveExpansionTargetSide(socket.directionKey),
        direction: socket.direction && Number.isInteger(socket.direction.row) && Number.isInteger(socket.direction.col)
            ? { row: socket.direction.row, col: socket.direction.col }
            : null,
        directionKey: socket.directionKey,
        additions
    };
}

function getBoardExpansionSocketTargets(cardState: CardState, gameState: GameState): TargetCell[] {
    const board = getShapeAwareBoard(cardState, gameState);
    if (!board || !SharedBoardUtils || typeof SharedBoardUtils.getBoardExpansionEdgeSockets !== 'function') return [];
    return SharedBoardUtils.getBoardExpansionEdgeSockets(board)
        .map(mapExpansionSocketTarget)
        .filter((target: TargetCell | null): target is TargetCell => !!target);
}

function getBoardExpansionGodSocketTargets(cardState: CardState, gameState: GameState): TargetCell[] {
    const board = getShapeAwareBoard(cardState, gameState);
    if (!board || !SharedBoardUtils || typeof SharedBoardUtils.getBoardExpansionCornerSockets !== 'function') return [];
    return SharedBoardUtils.getBoardExpansionCornerSockets(board)
        .map(mapExpansionSocketTarget)
        .filter((target: TargetCell | null): target is TargetCell => !!target);
}

function getBoardExpansionTargets(cardState: CardState, gameState: GameState, playerKey: PlayerKey): TargetCell[] {
    return getBoardExpansionSocketTargets(cardState, gameState);
}

function getExpansionTargetIdentity(target: any): string | null {
    if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col)) return null;
    const directionKey = typeof target.directionKey === 'string' ? target.directionKey : '';
    return `${target.row},${target.col},${directionKey}`;
}

function getBoardExpansionGodTargets(cardState: CardState, gameState: GameState, playerKey: PlayerKey): TargetCell[] {
    const gs = gameState as any;
    if (!gs || !gs.board) return [];

    const socketTargets = getBoardExpansionGodSocketTargets(cardState, gameState);
    const cs = cardState as any;
    const pending = cs && cs.pendingEffectByPlayer
        ? cs.pendingEffectByPlayer[playerKey]
        : null;
    const selectedKeys = new Set<string>();
    const selectedAnchorKeys = new Set<string>();
    const selectedAdditionKeys = new Set<string>();
    const selectedTargets: any[] = [];
    if (pending && pending.type === 'BOARD_EXPANSION_GOD') {
        if (pending.firstTarget && Number.isInteger(pending.firstTarget.row) && Number.isInteger(pending.firstTarget.col)) {
            selectedTargets.push(pending.firstTarget);
        }
        if (Array.isArray(pending.selectedTargets)) {
            selectedTargets.push(...pending.selectedTargets);
        }
    }
    for (const target of selectedTargets) {
        if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col)) continue;
        const identity = getExpansionTargetIdentity(target);
        if (identity && typeof target.directionKey === 'string' && target.directionKey) selectedKeys.add(identity);
        else selectedAnchorKeys.add(`${target.row},${target.col}`);
        const matchingSocket = socketTargets.find((candidate) => (
            candidate.row === target.row &&
            candidate.col === target.col &&
            (typeof target.directionKey !== 'string' || !target.directionKey || candidate.directionKey === target.directionKey)
        ));
        if (matchingSocket && Array.isArray(matchingSocket.additions)) {
            for (const cell of matchingSocket.additions) {
                if (cell && Number.isInteger(cell.row) && Number.isInteger(cell.col)) {
                    selectedAdditionKeys.add(`${cell.row},${cell.col}`);
                }
            }
        }
    }

    return socketTargets.filter((target) => {
        const identity = getExpansionTargetIdentity(target);
        if (identity && selectedKeys.has(identity)) return false;
        if (selectedAnchorKeys.has(`${target.row},${target.col}`)) return false;
        return !(Array.isArray(target.additions) && target.additions.some((cell) => selectedAdditionKeys.has(`${cell.row},${cell.col}`)));
    });
}

function getCellTeleportDestinations(cardState: CardState, gameState: GameState): DestinationCell[] {
    const gs = gameState as any;
    if (!gs || !gs.board) return [];

    const activeExpansionCells = getExpansionCells(cardState, gameState);
    const activeByKey = new Map<string, ExpansionCell>();
    for (const cell of activeExpansionCells) {
        if (!cell) continue;
        activeByKey.set(`${cell.row},${cell.col}`, cell);
    }

    const candidates: DestinationCell[] = [];
    const seen = new Set<string>();
    const pushCandidate = (row: number, col: number, side: string | null) => {
        const key = `${row},${col}`;
        if (seen.has(key)) return;
        seen.add(key);
        const activeCell = activeByKey.get(key) || null;
        const owner = activeCell ? Number(activeCell.owner) : P_EMPTY;
        if (owner !== P_EMPTY) return;
        if (isBlockedCell(cardState, row, col)) return;
        candidates.push({
            row,
            col,
            side: resolveExpansionSide(side, row, col, gameState),
            active: !!activeCell
        });
    };

    for (const cell of activeExpansionCells) {
        if (!cell) continue;
        pushCandidate(cell.row, cell.col, cell.side);
    }
    const socketTargets = getBoardExpansionSocketTargets(cardState, gameState)
        .concat(getBoardExpansionGodSocketTargets(cardState, gameState));
    for (const target of socketTargets) {
        for (const cell of Array.isArray(target.additions) ? target.additions : []) {
            pushCandidate(cell.row, cell.col, resolveExpansionSide(null, cell.row, cell.col, gameState));
        }
    }

    return candidates;
}

function getCellTeleportTargets(cardState: CardState, gameState: GameState): TargetCell[] {
    const gs = gameState as any;
    if (!gs || !gs.board) return [];
    const destinations = getCellTeleportDestinations(cardState, gameState);
    if (!destinations.length) return [];

    const res: TargetCell[] = [];
    forEachBoardShapeCell(cardState, gameState, (r, c, owner) => {
        if (owner === P_EMPTY) return;
        if (isFrozenCell(cardState, r, c)) return;
        if (isInviolableCell(cardState, r, c)) return;
        if (isMeteorHoleCell(cardState, r, c)) return;
        res.push({ row: r, col: c });
    });

    return res;
}

function normalizeTargetCell(target: any): TargetCell | null {
    const row = Number(target && target.row);
    const col = Number(target && target.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    return { row, col };
}

function areOrthogonallyAdjacent(a: any, b: any): boolean {
    if (!a || !b) return false;
    return Math.abs(Number(a.row) - Number(b.row)) + Math.abs(Number(a.col) - Number(b.col)) === 1;
}

function buildBoardShrinkPerimeterGraph(cells: TargetCell[]): Map<string, TargetCell[]> {
    const out = new Map<string, TargetCell[]>();
    const normalized = cells.map(normalizeTargetCell).filter((cell): cell is TargetCell => !!cell);
    for (const cell of normalized) {
        out.set(toTargetKey(cell.row, cell.col), []);
    }
    for (let i = 0; i < normalized.length; i++) {
        for (let j = i + 1; j < normalized.length; j++) {
            const a = normalized[i];
            const b = normalized[j];
            if (!areOrthogonallyAdjacent(a, b)) continue;
            out.get(toTargetKey(a.row, a.col))!.push(b);
            out.get(toTargetKey(b.row, b.col))!.push(a);
        }
    }
    return out;
}

function isConnectedBoardShrinkSelection(cells: TargetCell[], graph: Map<string, TargetCell[]>): boolean {
    const normalized = cells.map(normalizeTargetCell).filter((cell): cell is TargetCell => !!cell);
    if (normalized.length <= 1) return normalized.length === 1;
    const expectedKeys = new Set(normalized.map((cell) => toTargetKey(cell.row, cell.col)));
    const start = normalized[0];
    const visited = new Set<string>();
    const stack = [start];
    while (stack.length > 0) {
        const current = stack.pop()!;
        const currentKey = toTargetKey(current.row, current.col);
        if (visited.has(currentKey)) continue;
        visited.add(currentKey);
        const neighbors = graph.get(currentKey) || [];
        for (const neighbor of neighbors) {
            const neighborKey = toTargetKey(neighbor.row, neighbor.col);
            if (expectedKeys.has(neighborKey) && !visited.has(neighborKey)) {
                stack.push(neighbor);
            }
        }
    }
    return visited.size === expectedKeys.size;
}

function canCompleteBoardShrinkSelection(cells: TargetCell[], allCells: TargetCell[], graph: Map<string, TargetCell[]>): boolean {
    const normalized = cells.map(normalizeTargetCell).filter((cell): cell is TargetCell => !!cell);
    if (normalized.length >= BOARD_SHRINK_SELECTION_COUNT) {
        return normalized.length === BOARD_SHRINK_SELECTION_COUNT && isConnectedBoardShrinkSelection(normalized, graph);
    }
    const selectedKeys = new Set(normalized.map((cell) => toTargetKey(cell.row, cell.col)));
    for (const candidate of allCells) {
        const candidateKey = toTargetKey(candidate.row, candidate.col);
        if (selectedKeys.has(candidateKey)) continue;
        const next = normalized.concat(candidate);
        if (!isConnectedBoardShrinkSelection(next, graph)) continue;
        if (canCompleteBoardShrinkSelection(next, allCells, graph)) return true;
    }
    return false;
}

function resolveBoardShrinkDirection(selectedTargets: TargetCell[], target: TargetCell): { row: number; col: number } | null {
    for (let i = selectedTargets.length - 1; i >= 0; i--) {
        const selected = selectedTargets[i];
        if (!areOrthogonallyAdjacent(selected, target)) continue;
        return {
            row: target.row - selected.row,
            col: target.col - selected.col
        };
    }
    return null;
}

function filterBoardShrinkContinuousTargets(selectedTargets: TargetCell[], perimeterTargets: TargetCell[]): TargetCell[] {
    const selected = selectedTargets.map(normalizeTargetCell).filter((cell): cell is TargetCell => !!cell);
    const candidates = perimeterTargets.map(normalizeTargetCell).filter((cell): cell is TargetCell => !!cell);
    const allCells = selected.concat(candidates);
    const graph = buildBoardShrinkPerimeterGraph(allCells);
    if (selected.length >= BOARD_SHRINK_SELECTION_COUNT) return [];
    if (selected.length > 0 && !isConnectedBoardShrinkSelection(selected, graph)) return [];

    return candidates
        .filter((target) => {
            const nextSelection = selected.concat(target);
            if (!isConnectedBoardShrinkSelection(nextSelection, graph)) return false;
            return canCompleteBoardShrinkSelection(nextSelection, allCells, graph);
        })
        .map((target) => {
            const nextSelection = selected.concat(target).map((cell) => ({ row: cell.row, col: cell.col }));
            return {
                row: target.row,
                col: target.col,
                direction: resolveBoardShrinkDirection(selected, target),
                selectedTargets: nextSelection,
                lineCells: nextSelection
            };
        });
}

// Return blockade targets: all empty cells (including active expansion cells), excluding already blocked cells.
function getBlockadeTargets(cardState: CardState, gameState: GameState): TargetCell[] {
    const gs = gameState as any;
    if (!gs || !gs.board) return [];
    const res: TargetCell[] = [];
    forEachBoardShapeCell(cardState, gameState, (r, c, owner) => {
        if (owner !== P_EMPTY) return;
        if (isBlockedCell(cardState, r, c)) return;
        if (hasSeedMarkerAt(cardState, r, c)) return;
        res.push({ row: r, col: c });
    });

    return res;
}

// Return meteor targets: all board cells + active expansion cells, excluding already destroyed holes.
function getMeteorTargets(cardState: CardState, gameState: GameState): TargetCell[] {
    const gs = gameState as any;
    if (!gs || !gs.board) return [];
    const res: TargetCell[] = [];
    forEachBoardShapeCell(cardState, gameState, (r, c) => {
        if (isMeteorHoleCell(cardState, r, c)) return;
        if (isInviolableCell(cardState, r, c)) return;
        res.push({ row: r, col: c });
    });
    return res;
}

// Poison may be placed under empty or occupied cells. Holes and an existing poison cell are excluded.
function getPoisonTargets(cardState: CardState, gameState: GameState): TargetCell[] {
    const gs = gameState as any;
    if (!gs || !gs.board) return [];
    const res: TargetCell[] = [];
    forEachBoardShapeCell(cardState, gameState, (r, c) => {
        if (isMeteorHoleCell(cardState, r, c)) return;
        const alreadyPoisoned = Array.isArray((cardState as any).markers) && (cardState as any).markers.some((marker: any) => (
            marker && marker.row === r && marker.col === c && marker.data && marker.data.type === 'POISON_CELL'
        ));
        if (alreadyPoisoned) return;
        res.push({ row: r, col: c });
    });
    return res;
}

// Scorch may overwrite any temporary special cell. Permanent holes are excluded.
function getScorchTargets(cardState: CardState, gameState: GameState): TargetCell[] {
    const gs = gameState as any;
    if (!gs || !gs.board) return [];
    const res: TargetCell[] = [];
    forEachBoardShapeCell(cardState, gameState, (r, c) => {
        if (isMeteorHoleCell(cardState, r, c)) return;
        res.push({ row: r, col: c });
    });
    return res;
}

// Return causal replay targets: existing meteor holes only.
function getCausalReplayTargets(cardState: CardState, gameState: GameState): TargetCell[] {
    const gs = gameState as any;
    if (!gs || !gs.board) return [];
    if (!SelectorsBoardShape || typeof SelectorsBoardShape.getMeteorHoleCells !== 'function') {
        throw new Error('CardSelectorsBoardShape.getMeteorHoleCells is required');
    }
    return SelectorsBoardShape.getMeteorHoleCells(
        cardState,
        gameState,
        getSelectorsBoardShapeDeps()
    );
}

function getBoardShrinkTargets(cardState: CardState, gameState: GameState, playerKey: PlayerKey): TargetCell[] {
    const board = getShapeAwareBoard(cardState, gameState);
    if (!board || !SharedBoardUtils || typeof SharedBoardUtils.getPerimeterCells !== 'function') return [];
    const selectedTargets = Array.from(getBoardShrinkSelectedKeys(cardState, playerKey))
        .map((key) => {
            const parts = String(key).split(',');
            const row = Number(parts[0]);
            const col = Number(parts[1]);
            return Number.isInteger(row) && Number.isInteger(col) ? { row, col } : null;
        })
        .filter((target): target is { row: number; col: number } => !!target);
    const selectedKeys = new Set(selectedTargets.map((target) => toTargetKey(target.row, target.col)));
    const perimeterTargets = SharedBoardUtils.getPerimeterCells(board)
        .filter((cell: any) => {
            if (!cell || !Number.isInteger(cell.row) || !Number.isInteger(cell.col)) return false;
            if (selectedKeys.has(toTargetKey(cell.row, cell.col))) return false;
            return true;
        })
        .map((cell: any) => ({ row: cell.row, col: cell.col }));
    return filterBoardShrinkContinuousTargets(selectedTargets, perimeterTargets);
}

interface CornerTarget {
    row: number;
    col: number;
    lineTargets?: any[];
    corner?: { row: number; col: number };
    direction?: any;
    lineCells?: { row: number; col: number }[];
    lineKey?: string | null;
}

function getBoardShrinkGodTargets(cardState: CardState, gameState: GameState, playerKey: PlayerKey): CornerTarget[] {
    const lineDescriptors = getBoardShrinkGodLineDescriptors(cardState, gameState, playerKey);
    const pending = getPendingEffect(cardState, playerKey);
    if (pending && pending.type === 'BOARD_SHRINK_GOD' && pending.firstTarget) {
        return lineDescriptors.map((line) => ({
            row: line.directionTarget.row,
            col: line.directionTarget.col,
            corner: { row: line.corner.row, col: line.corner.col },
            direction: line.direction,
            lineCells: Array.isArray(line.cells)
                ? line.cells.map((cell: any) => ({ row: cell.row, col: cell.col }))
                : [],
            lineKey: line.canonicalKey || line.key || null
        }));
    }

    const cornerMap = new Map<string, CornerTarget>();
    for (const line of lineDescriptors) {
        const key = toTargetKey(line.corner.row, line.corner.col);
        const linePreview = {
            row: line.directionTarget.row,
            col: line.directionTarget.col,
            lineCells: Array.isArray(line.cells)
                ? line.cells.map((cell: any) => ({ row: cell.row, col: cell.col }))
                : [],
            lineKey: line.canonicalKey || line.key || null
        };
        if (cornerMap.has(key)) {
            cornerMap.get(key)!.lineTargets!.push(linePreview);
            continue;
        }
        cornerMap.set(key, {
            row: line.corner.row,
            col: line.corner.col,
            lineTargets: [linePreview]
        });
    }
    return Array.from(cornerMap.values());
}

function getFreezeTargets(cardState: CardState, gameState: GameState): TargetCell[] {
    const gs = gameState as any;
    if (!gs || !gs.board) return [];
    const res: TargetCell[] = [];
    forEachBoardShapeCell(cardState, gameState, (r, c) => {
        if (isBlockedCell(cardState, r, c)) return;
        if (hasSeedMarkerAt(cardState, r, c)) return;
        res.push({ row: r, col: c });
    });
    return res;
}

function getSeedTargets(cardState: CardState, gameState: GameState): TargetCell[] {
    const gs = gameState as any;
    if (!gs || !gs.board) return [];
    const res: TargetCell[] = [];
    forEachBoardShapeCell(cardState, gameState, (r, c, owner) => {
        if (owner !== P_EMPTY) return;
        if (isBlockedCell(cardState, r, c)) return;
        if (hasSeedMarkerAt(cardState, r, c)) return;
        res.push({ row: r, col: c });
    });
    return res;
}

export = {
    getDestroyTargets,
    getSwapTargets,
    getPositionSwapTargets,
    getStrongWindTargets,
    getBuoyancyTargets,
    getSuperBuoyancyTargets,
    getSuperAttractionTargets,
    getSuperAttractionPathPreview,
    getGravityTargets,
    getSuperGravityTargets,
    getTrapTargets,
    getGuardTargets,
    getLivingWillTargets,
    getHyperactiveInheritTargets,
    getExtendLifeTargets,
    getCorrosionTargets,
    getTimeBombTargets,
    getTeleportTargets,
    getCellTeleportTargets,
    getCellTeleportDestinations,
    getCloneTargets,
    getBoardExpansionSocketTargets,
    getBoardExpansionGodSocketTargets,
    getBoardExpansionTargets,
    getBoardExpansionGodTargets,
    getBlockadeTargets,
    getPoisonTargets,
    getScorchTargets,
    getMeteorTargets,
    getCausalReplayTargets,
    getBoardShrinkTargets,
    getBoardShrinkGodTargets,
    getFreezeTargets,
    getSeedTargets,
    isBlockedCell
};
