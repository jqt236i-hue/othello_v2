'use strict';

import { GameState } from '../../../src/types';

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

const RandomSourceModule = ((typeof module === 'object' && module.exports)
    ? safeRequire('../cards-internal/random-source')
    : null) || (typeof self !== 'undefined' ? (self as any).CardRandomSource : null);

const EMPTY = Number.isFinite(Number(SharedConstants && SharedConstants.EMPTY))
    ? Number(SharedConstants.EMPTY)
    : 0;

const STRONG_WIND_LEFT_DIRECTION = [0, -1];
const STRONG_WIND_RIGHT_DIRECTION = [0, 1];

function resolveRandomSource(prng: any) {
    if (RandomSourceModule && typeof RandomSourceModule.resolveRandomSource === 'function') {
        return RandomSourceModule.resolveRandomSource(prng, null, 'CardMovement');
    }
    if (prng && typeof prng.random === 'function')
        return prng;
    throw new Error('CardMovement requires an injected deterministic PRNG.');
}

function getMarkers(cardState: any, deps: any): any[] {
    if (deps && typeof deps.getMarkers === 'function') {
        return deps.getMarkers(cardState);
    }
    return Array.isArray(cardState && cardState.markers) ? cardState.markers : [];
}

function moveMarkers(cardState: any, fromRow: number, fromCol: number, toRow: number, toCol: number, deps: any) {
    const markers = getMarkers(cardState, deps);
    for (const marker of markers) {
        if (!marker)
            continue;
        if (marker.row !== fromRow || marker.col !== fromCol)
            continue;
        const markerTypeUpper = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
        if (markerTypeUpper === 'BLOCKADE' || markerTypeUpper === 'METEOR_HOLE' || markerTypeUpper === 'FREEZE' || markerTypeUpper === 'SEED')
            continue;
        marker.row = toRow;
        marker.col = toCol;
    }
}

interface MovePlan {
    from: { row: number; col: number };
    to: { row: number; col: number };
    destroyed: Array<{row: number; col: number}>;
    direction: number[];
    movedDistance: number;
}

function normalizeLineDirection(fromRow: number, fromCol: number, toRow: number, toCol: number): number[] | null {
    const rowDelta = toRow - fromRow;
    const colDelta = toCol - fromCol;
    if (rowDelta === 0 && colDelta === 0)
        return null;
    const absRow = Math.abs(rowDelta);
    const absCol = Math.abs(colDelta);
    if (rowDelta !== 0 && colDelta !== 0 && absRow !== absCol)
        return null;
    if (rowDelta !== 0 && colDelta !== 0)
        return [rowDelta > 0 ? 1 : -1, colDelta > 0 ? 1 : -1];
    if (rowDelta !== 0)
        return [rowDelta > 0 ? 1 : -1, 0];
    return [0, colDelta > 0 ? 1 : -1];
}

function collectVerticalCrushMovePlan(cardState: any, gameState: GameState, row: number, col: number, dr: number, deps: any): MovePlan | null {
    if (!Number.isInteger(row) || !Number.isInteger(col))
        return null;
    if (dr !== -1 && dr !== 1)
        return null;
    const hasBoardShapeCellForCard = deps.hasBoardShapeCellForCard || (() => false);
    const isBlockedCell = deps.isBlockedCell || (() => false);
    const getCellValueForCard = deps.getCellValueForCard || (() => null);
    const findSpecialMarkerAt = deps.findSpecialMarkerAt || (() => null);
    const firstRow = row + dr;
    if (!hasBoardShapeCellForCard(cardState, gameState, firstRow, col))
        return null;
    const destroyed: Array<{row: number; col: number}> = [];
    let to: { row: number; col: number } | null = null;
    for (let currentRow = firstRow; hasBoardShapeCellForCard(cardState, gameState, currentRow, col); currentRow += dr) {
        if (isBlockedCell(cardState, currentRow, col, gameState))
            break;
        if (getCellValueForCard(gameState, currentRow, col) !== EMPTY) {
            const guard = findSpecialMarkerAt(cardState, currentRow, col, 'GUARD');
            if (guard)
                break;
            destroyed.push({ row: currentRow, col });
            const ghost = findSpecialMarkerAt(cardState, currentRow, col, 'GHOST');
            if (!ghost) {
                to = { row: currentRow, col };
            }
            continue;
        }
        to = { row: currentRow, col };
    }
    if (!to)
        return null;
    const movedDistance = Math.abs(to.row - row) + Math.abs(to.col - col);
    if (movedDistance <= 0)
        return null;
    return {
        from: { row, col },
        to,
        destroyed,
        direction: [dr, 0],
        movedDistance
    };
}

function collectLineCrushMovePlanToTarget(cardState: any, gameState: GameState, row: number, col: number, targetRow: number, targetCol: number, deps: any): MovePlan | null {
    if (!Number.isInteger(row) || !Number.isInteger(col) || !Number.isInteger(targetRow) || !Number.isInteger(targetCol))
        return null;
    const direction = normalizeLineDirection(row, col, targetRow, targetCol);
    if (!direction)
        return null;
    const hasBoardShapeCellForCard = deps.hasBoardShapeCellForCard || (() => false);
    const isBlockedCell = deps.isBlockedCell || (() => false);
    const getCellValueForCard = deps.getCellValueForCard || (() => null);
    const findSpecialMarkerAt = deps.findSpecialMarkerAt || (() => null);
    if (!hasBoardShapeCellForCard(cardState, gameState, targetRow, targetCol))
        return null;
    const destroyed: Array<{row: number; col: number}> = [];
    const [dr, dc] = direction;
    let currentRow = row + dr;
    let currentCol = col + dc;
    while (hasBoardShapeCellForCard(cardState, gameState, currentRow, currentCol)) {
        if (isBlockedCell(cardState, currentRow, currentCol, gameState))
            return null;
        const cellValue = getCellValueForCard(gameState, currentRow, currentCol);
        if (cellValue !== EMPTY) {
            if (findSpecialMarkerAt(cardState, currentRow, currentCol, 'GUARD'))
                return null;
            const isDestination = currentRow === targetRow && currentCol === targetCol;
            if (isDestination && findSpecialMarkerAt(cardState, currentRow, currentCol, 'GHOST'))
                return null;
            destroyed.push({ row: currentRow, col: currentCol });
        }
        if (currentRow === targetRow && currentCol === targetCol) {
            const movedDistance = Math.abs(targetRow - row) + Math.abs(targetCol - col);
            if (movedDistance <= 0)
                return null;
            return {
                from: { row, col },
                to: { row: targetRow, col: targetCol },
                destroyed,
                direction,
                movedDistance
            };
        }
        currentRow += dr;
        currentCol += dc;
    }
    return null;
}

function collectVerticalSlideMoveOption(cardState: any, gameState: GameState, row: number, col: number, dr: number, deps: any): MoveOption | null {
    if (!Number.isInteger(row) || !Number.isInteger(col))
        return null;
    if (dr !== -1 && dr !== 1)
        return null;
    const hasBoardShapeCellForCard = deps.hasBoardShapeCellForCard || (() => false);
    const isBlockedCell = deps.isBlockedCell || (() => false);
    const getCellValueForCard = deps.getCellValueForCard || (() => null);
    const firstRow = row + dr;
    if (!hasBoardShapeCellForCard(cardState, gameState, firstRow, col))
        return null;
    if (isBlockedCell(cardState, firstRow, col, gameState))
        return null;
    if (getCellValueForCard(gameState, firstRow, col) !== EMPTY)
        return null;
    let targetRow = firstRow;
    for (let currentRow = firstRow + dr; hasBoardShapeCellForCard(cardState, gameState, currentRow, col); currentRow += dr) {
        if (isBlockedCell(cardState, currentRow, col, gameState))
            break;
        if (getCellValueForCard(gameState, currentRow, col) !== EMPTY)
            break;
        targetRow = currentRow;
    }
    const distance = Math.abs(targetRow - row);
    if (distance <= 0)
        return null;
    return {
        direction: [dr, 0],
        target: { row: targetRow, col },
        distance
    };
}

interface MoveOption {
    direction: number[];
    target: { row: number; col: number };
    distance: number;
}

function getStrongWindMoveOptions(cardState: any, gameState: GameState, row: number, col: number, deps: any): MoveOption[] {
    const options: MoveOption[] = [];
    for (const direction of [STRONG_WIND_LEFT_DIRECTION, STRONG_WIND_RIGHT_DIRECTION]) {
        const option = getStrongWindMoveOptionForDirection(cardState, gameState, row, col, direction, deps);
        if (option)
            options.push(option);
    }
    return options;
}

function getStrongWindMoveOptionForDirection(cardState: any, gameState: GameState, row: number, col: number, direction: number[], deps: any): MoveOption | null {
    const hasBoardShapeCellForCard = deps.hasBoardShapeCellForCard || (() => false);
    const getCellValueForCard = deps.getCellValueForCard || (() => null);
    const isBlockedCell = deps.isBlockedCell || (() => false);
    const nextRow = row + direction[0];
    const nextCol = col + direction[1];
    if (!hasBoardShapeCellForCard(cardState, gameState, nextRow, nextCol))
        return null;
    if (getCellValueForCard(gameState, nextRow, nextCol) !== EMPTY)
        return null;
    if (isBlockedCell(cardState, nextRow, nextCol, gameState))
        return null;
    let targetRow = nextRow;
    let targetCol = nextCol;
    while (true) {
        const probeRow = targetRow + direction[0];
        const probeCol = targetCol + direction[1];
        if (!hasBoardShapeCellForCard(cardState, gameState, probeRow, probeCol))
            break;
        if (getCellValueForCard(gameState, probeRow, probeCol) !== EMPTY)
            break;
        if (isBlockedCell(cardState, probeRow, probeCol, gameState))
            break;
        targetRow = probeRow;
        targetCol = probeCol;
    }
    const distance = Math.abs(targetRow - row) + Math.abs(targetCol - col);
    return {
        direction,
        target: { row: targetRow, col: targetCol },
        distance
    };
}

interface MovementResult {
    applied: boolean;
    completed?: boolean;
    reason?: string;
    firstTarget?: { row: number; col: number };
    from?: { row: number; col: number };
    to?: { row: number; col: number };
    direction?: number[];
    movedDistance?: number;
    chargeGained?: number;
    destroyed?: Array<{row: number; col: number}>;
    destroyedCount?: number;
    failedAt?: { row: number; col: number };
}

function applyStrongWindWill(cardState: any, gameState: GameState, playerKey: string, row: number, col: number, prng: any, deps: any = {}): MovementResult {
    const cs = cardState as any;
    const pending = cs && cs.pendingEffectByPlayer ? cs.pendingEffectByPlayer[playerKey] : null;
    if (!pending || pending.type !== 'STRONG_WIND_WILL' || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }
    const getCellValueForCard = deps.getCellValueForCard || (() => null);
    const setCellValueForCard = deps.setCellValueForCard || (() => false);
    const moveAt = deps.moveAt || null;
    const cellValue = getCellValueForCard(gameState, row, col);
    if (cellValue === null)
        return { applied: false, reason: 'out_of_board' };
    if (cellValue === EMPTY)
        return { applied: false, reason: 'empty' };
    const randomSource = resolveRandomSource(prng);
    const selectedDirection = randomSource.random() < 0.5
        ? STRONG_WIND_LEFT_DIRECTION
        : STRONG_WIND_RIGHT_DIRECTION;
    const selected = getStrongWindMoveOptionForDirection(cardState, gameState, row, col, selectedDirection, deps);
    if (!selected)
        return { applied: false, reason: 'no_move_options' };
    const to = selected.target;
    const movedDistance = Math.abs(to.row - row) + Math.abs(to.col - col);
    if (typeof moveAt === 'function') {
        const result = moveAt(cardState, gameState, row, col, to.row, to.col, 'STRONG_WIND_WILL', 'strong_wind_move');
        if (!result || !result.moved) {
            return { applied: false, reason: 'move_failed' };
        }
        if (result.markerHandled !== true) {
            moveMarkers(cardState, row, col, to.row, to.col, deps);
        }
    }
    else {
        const cleared = setCellValueForCard(gameState, row, col, EMPTY);
        const placed = setCellValueForCard(gameState, to.row, to.col, cellValue);
        if (!cleared || !placed) {
            return { applied: false, reason: 'move_failed' };
        }
        moveMarkers(cardState, row, col, to.row, to.col, deps);
    }
    cs.pendingEffectByPlayer[playerKey] = null;
    return {
        applied: true,
        from: { row, col },
        to,
        direction: selected.direction,
        movedDistance,
        chargeGained: 0
    };
}

function applyVerticalCrushWill(cardState: any, gameState: GameState, playerKey: string, row: number, col: number, config: any, deps: any = {}): MovementResult {
    const cfg = config || {};
    const pendingType = String(cfg.pendingType || '');
    const direction = Number(cfg.direction);
    const moveReason = String(cfg.moveReason || '').trim();
    const destroyReason = String(cfg.destroyReason || '').trim();
    const targetGetter = typeof cfg.targetGetter === 'function' ? cfg.targetGetter : (() => []);
    const getCellValueForCard = deps.getCellValueForCard || (() => null);
    const destroyAt = deps.destroyAt || null;
    const destroyAtLegacy = deps.destroyAtLegacy || (() => false);
    const resolveDestroy = deps.isDestroyResolved || ((result: any) => !!(result && result.destroyed));
    const moveAt = deps.moveAt || null;
    const setCellValueForCard = deps.setCellValueForCard || (() => false);
    const runDestroyBlock = typeof deps.runDestroyBlock === 'function' ? deps.runDestroyBlock : null;
    const cs = cardState as any;
    const pending = cs && cs.pendingEffectByPlayer ? cs.pendingEffectByPlayer[playerKey] : null;
    if (!pending || pending.type !== pendingType || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }
    const cellValue = getCellValueForCard(gameState, row, col);
    if (cellValue === null)
        return { applied: false, reason: 'out_of_board' };
    if (cellValue === EMPTY)
        return { applied: false, reason: 'empty' };
    const targets = targetGetter(cardState, gameState);
    const allowed = Array.isArray(targets) && targets.some((target: any) => target && target.row === row && target.col === col);
    if (!allowed)
        return { applied: false, reason: 'invalid_target' };
    const plan = collectVerticalCrushMovePlan(cardState, gameState, row, col, direction, deps);
    if (!plan)
        return { applied: false, reason: 'no_move_options' };
    const totalTravelDistance = Number(plan.movedDistance) || Math.abs(plan.to.row - row) || 1;
    const destroyed: Array<{row: number; col: number}> = [];
    let blockFailure: MovementResult | null = null;
    const applyCrush = () => {
        for (let index = 0; index < plan.destroyed.length; index += 1) {
            const target = plan.destroyed[index];
            if (!target)
                continue;
            const collisionDistance = Math.abs(target.row - row);
            const collisionProgress = Math.max(0, Math.min(1, collisionDistance / totalTravelDistance));
            if (typeof destroyAt === 'function') {
                const result = destroyAt(cardState, gameState, target.row, target.col, pendingType, destroyReason, {
                    sourceRow: row,
                    sourceCol: col,
                    collisionIndex: index + 1,
                    collisionCount: plan.destroyed.length,
                    collisionProgress,
                    travelDistance: totalTravelDistance,
                    travelToRow: plan.to.row,
                    travelToCol: plan.to.col
                });
                if (!resolveDestroy(result)) {
                    blockFailure = { applied: false, reason: 'destroy_failed', failedAt: { row: target.row, col: target.col } };
                    return;
                }
            }
            else {
                const destroyedOk = destroyAtLegacy(cardState, gameState, target.row, target.col);
                if (!destroyedOk) {
                    blockFailure = { applied: false, reason: 'destroy_failed', failedAt: { row: target.row, col: target.col } };
                    return;
                }
            }
            destroyed.push({ row: target.row, col: target.col });
        }
        if (typeof moveAt === 'function') {
            const result = moveAt(cardState, gameState, row, col, plan.to.row, plan.to.col, pendingType, moveReason, {
                collisionCount: destroyed.length,
                travelDistance: totalTravelDistance
            });
            if (!result || !result.moved) {
                blockFailure = { applied: false, reason: 'move_failed' };
                return;
            }
            if (result.markerHandled !== true) {
                moveMarkers(cardState, row, col, plan.to.row, plan.to.col, deps);
            }
        }
        else {
            const cleared = setCellValueForCard(gameState, row, col, EMPTY);
            const placed = setCellValueForCard(gameState, plan.to.row, plan.to.col, cellValue);
            if (!cleared || !placed) {
                blockFailure = { applied: false, reason: 'move_failed' };
                return;
            }
            moveMarkers(cardState, row, col, plan.to.row, plan.to.col, deps);
        }
    };
    if (runDestroyBlock) {
        runDestroyBlock(cardState, gameState, applyCrush, {});
    }
    else {
        applyCrush();
    }
    if (blockFailure) return blockFailure;
    cs.pendingEffectByPlayer[playerKey] = null;
    return {
        applied: true,
        from: { row, col },
        to: plan.to,
        destroyed,
        destroyedCount: destroyed.length,
        movedDistance: plan.movedDistance,
        direction: plan.direction
    };
}

function applySuperAttractionWill(cardState: any, gameState: GameState, playerKey: string, row: number, col: number, deps: any = {}): MovementResult {
    const pendingType = 'SUPER_ATTRACTION_WILL';
    const cs = cardState as any;
    const pending = cs && cs.pendingEffectByPlayer ? cs.pendingEffectByPlayer[playerKey] : null;
    const getCellValueForCard = deps.getCellValueForCard || (() => null);
    const targetGetter = typeof deps.getSuperAttractionTargets === 'function' ? deps.getSuperAttractionTargets : (() => []);
    const destroyAt = deps.destroyAt || null;
    const destroyAtLegacy = deps.destroyAtLegacy || (() => false);
    const resolveDestroy = deps.isDestroyResolved || ((result: any) => !!(result && result.destroyed));
    const moveAt = deps.moveAt || null;
    const setCellValueForCard = deps.setCellValueForCard || (() => false);
    const runDestroyBlock = typeof deps.runDestroyBlock === 'function' ? deps.runDestroyBlock : null;

    if (!pending || pending.type !== pendingType || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }
    const targets = targetGetter(cardState, gameState, playerKey, pending);
    const allowed = Array.isArray(targets) && targets.some((target: any) => target && target.row === row && target.col === col);
    if (!allowed)
        return { applied: false, reason: 'invalid_target' };
    if (!pending.firstTarget) {
        const selectedValue = getCellValueForCard(gameState, row, col);
        if (selectedValue === null)
            return { applied: false, reason: 'out_of_board' };
        if (selectedValue === EMPTY)
            return { applied: false, reason: 'empty' };
        pending.firstTarget = { row, col };
        return {
            applied: true,
            completed: false,
            firstTarget: { row, col },
            chargeGained: 0
        };
    }

    const first = { row: pending.firstTarget.row, col: pending.firstTarget.col };
    const cellValue = getCellValueForCard(gameState, first.row, first.col);
    if (cellValue === null)
        return { applied: false, reason: 'source_out_of_board' };
    if (cellValue === EMPTY)
        return { applied: false, reason: 'source_empty' };
    const plan = collectLineCrushMovePlanToTarget(cardState, gameState, first.row, first.col, row, col, deps);
    if (!plan)
        return { applied: false, reason: 'no_move_options' };
    const totalTravelDistance = Number(plan.movedDistance) || 1;
    const destroyed: Array<{row: number; col: number}> = [];
    let blockFailure: MovementResult | null = null;
    const applyCrush = () => {
        for (let index = 0; index < plan.destroyed.length; index += 1) {
            const target = plan.destroyed[index];
            if (!target)
                continue;
            const collisionDistance = Math.abs(target.row - first.row) + Math.abs(target.col - first.col);
            const collisionProgress = Math.max(0, Math.min(1, collisionDistance / totalTravelDistance));
            if (typeof destroyAt === 'function') {
                const result = destroyAt(cardState, gameState, target.row, target.col, pendingType, 'super_attraction_collision', {
                    sourceRow: first.row,
                    sourceCol: first.col,
                    collisionIndex: index + 1,
                    collisionCount: plan.destroyed.length,
                    collisionProgress,
                    travelDistance: totalTravelDistance,
                    travelToRow: plan.to.row,
                    travelToCol: plan.to.col
                });
                if (!resolveDestroy(result)) {
                    blockFailure = { applied: false, reason: 'destroy_failed', failedAt: { row: target.row, col: target.col } };
                    return;
                }
            }
            else {
                const destroyedOk = destroyAtLegacy(cardState, gameState, target.row, target.col);
                if (!destroyedOk) {
                    blockFailure = { applied: false, reason: 'destroy_failed', failedAt: { row: target.row, col: target.col } };
                    return;
                }
            }
            destroyed.push({ row: target.row, col: target.col });
        }
        if (typeof moveAt === 'function') {
            const result = moveAt(cardState, gameState, first.row, first.col, plan.to.row, plan.to.col, pendingType, 'super_attraction_move', {
                collisionCount: destroyed.length,
                travelDistance: totalTravelDistance
            });
            if (!result || !result.moved) {
                blockFailure = { applied: false, reason: 'move_failed' };
                return;
            }
            if (result.markerHandled !== true) {
                moveMarkers(cardState, first.row, first.col, plan.to.row, plan.to.col, deps);
            }
        }
        else {
            const cleared = setCellValueForCard(gameState, first.row, first.col, EMPTY);
            const placed = setCellValueForCard(gameState, plan.to.row, plan.to.col, cellValue);
            if (!cleared || !placed) {
                blockFailure = { applied: false, reason: 'move_failed' };
                return;
            }
            moveMarkers(cardState, first.row, first.col, plan.to.row, plan.to.col, deps);
        }
    };
    if (runDestroyBlock) {
        runDestroyBlock(cardState, gameState, applyCrush, {});
    }
    else {
        applyCrush();
    }
    if (blockFailure) return blockFailure;
    cs.pendingEffectByPlayer[playerKey] = null;
    return {
        applied: true,
        completed: true,
        firstTarget: first,
        from: first,
        to: plan.to,
        destroyed,
        destroyedCount: destroyed.length,
        movedDistance: plan.movedDistance,
        direction: plan.direction
    };
}

function applyVerticalSlideWill(cardState: any, gameState: GameState, playerKey: string, row: number, col: number, config: any, deps: any = {}): MovementResult {
    const cfg = config || {};
    const pendingType = String(cfg.pendingType || '');
    const direction = Number(cfg.direction);
    const moveReason = String(cfg.moveReason || '').trim();
    const targetGetter = typeof cfg.targetGetter === 'function' ? cfg.targetGetter : (() => []);
    const getCellValueForCard = deps.getCellValueForCard || (() => null);
    const moveAt = deps.moveAt || null;
    const setCellValueForCard = deps.setCellValueForCard || (() => false);
    const cs = cardState as any;
    const pending = cs && cs.pendingEffectByPlayer ? cs.pendingEffectByPlayer[playerKey] : null;
    if (!pending || pending.type !== pendingType || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }
    const cellValue = getCellValueForCard(gameState, row, col);
    if (cellValue === null)
        return { applied: false, reason: 'out_of_board' };
    if (cellValue === EMPTY)
        return { applied: false, reason: 'empty' };
    const targets = targetGetter(cardState, gameState);
    const allowed = Array.isArray(targets) && targets.some((target: any) => target && target.row === row && target.col === col);
    if (!allowed)
        return { applied: false, reason: 'invalid_target' };
    const selected = collectVerticalSlideMoveOption(cardState, gameState, row, col, direction, deps);
    if (!selected)
        return { applied: false, reason: 'no_move_options' };
    const to = selected.target;
    const movedDistance = Math.abs(to.row - row) + Math.abs(to.col - col);
    if (typeof moveAt === 'function') {
        const result = moveAt(cardState, gameState, row, col, to.row, to.col, pendingType, moveReason);
        if (!result || !result.moved) {
            return { applied: false, reason: 'move_failed' };
        }
        if (result.markerHandled !== true) {
            moveMarkers(cardState, row, col, to.row, to.col, deps);
        }
    }
    else {
        const cleared = setCellValueForCard(gameState, row, col, EMPTY);
        const placed = setCellValueForCard(gameState, to.row, to.col, cellValue);
        if (!cleared || !placed) {
            return { applied: false, reason: 'move_failed' };
        }
        moveMarkers(cardState, row, col, to.row, to.col, deps);
    }
    cs.pendingEffectByPlayer[playerKey] = null;
    return {
        applied: true,
        from: { row, col },
        to,
        destroyed: [],
        destroyedCount: 0,
        movedDistance,
        direction: selected.direction
    };
}

function applySuperBuoyancyWill(cardState: any, gameState: GameState, playerKey: string, row: number, col: number, deps: any = {}): MovementResult {
    return applyVerticalCrushWill(cardState, gameState, playerKey, row, col, {
        pendingType: 'SUPER_BUOYANCY_WILL',
        direction: -1,
        moveReason: 'super_buoyancy_move',
        destroyReason: 'super_buoyancy_collision',
        targetGetter: deps.getSuperBuoyancyTargets
    }, deps);
}

function applyBuoyancyWill(cardState: any, gameState: GameState, playerKey: string, row: number, col: number, deps: any = {}): MovementResult {
    return applyVerticalSlideWill(cardState, gameState, playerKey, row, col, {
        pendingType: 'BUOYANCY_WILL',
        direction: -1,
        moveReason: 'buoyancy_move',
        targetGetter: deps.getBuoyancyTargets
    }, deps);
}

function applySuperGravityWill(cardState: any, gameState: GameState, playerKey: string, row: number, col: number, deps: any = {}): MovementResult {
    return applyVerticalCrushWill(cardState, gameState, playerKey, row, col, {
        pendingType: 'SUPER_GRAVITY_WILL',
        direction: 1,
        moveReason: 'super_gravity_move',
        destroyReason: 'super_gravity_collision',
        targetGetter: deps.getSuperGravityTargets
    }, deps);
}

function applyGravityWill(cardState: any, gameState: GameState, playerKey: string, row: number, col: number, deps: any = {}): MovementResult {
    return applyVerticalSlideWill(cardState, gameState, playerKey, row, col, {
        pendingType: 'GRAVITY_WILL',
        direction: 1,
        moveReason: 'gravity_move',
        targetGetter: deps.getGravityTargets
    }, deps);
}

export = {
    applyStrongWindWill,
    applyBuoyancyWill,
    applySuperBuoyancyWill,
    applySuperAttractionWill,
    applyGravityWill,
    applySuperGravityWill
};
