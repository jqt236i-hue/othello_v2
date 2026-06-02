/**
 * @file meteor.ts
 * @description Meteor helpers (Shared between Browser and Headless)
 */

import { CardState, GameState } from '../../../src/types';

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

const EMPTY = Number.isFinite(Number(SharedConstants && SharedConstants.EMPTY))
    ? Number(SharedConstants.EMPTY)
    : 0;

interface MeteorDeps {
    getMeteorTargets?(cardState: CardState, gameState: GameState, playerKey: string): Array<{row: number; col: number}>;
    getCellValueForCard?(gameState: GameState, row: number, col: number): number | null;
    destroyAt?(cardState: CardState, gameState: GameState, row: number, col: number, source: string, tag: string, options: any): any;
    isDestroyResolved?(result: any): boolean;
    clearStoneIdAtForCard?(cardState: CardState, gameState: GameState, row: number, col: number): void;
    setCellValueForCard?(gameState: GameState, row: number, col: number, value: number): boolean;
    removeMarkersAt?(cardState: CardState, row: number, col: number): void;
    addMarker?(cardState: CardState, kind: string, row: number, col: number, playerKey: string, data: any): boolean;
    applyHoleAt?(cardState: CardState, gameState: GameState, row: number, col: number, playerKey: string, meta: any): any;
    applyCellRemovalAt?(cardState: CardState, gameState: GameState, row: number, col: number, playerKey: string, cause: string, reason: string, options: any): any;
    runCellRemovalBlock?(cardState: CardState, gameState: GameState, fn: () => any, meta?: any): any;
    random?: { random(): number };
}

interface MeteorResult {
    applied: boolean;
    reason?: string;
    row?: number;
    col?: number;
    destroyed?: boolean;
}

function applyMeteorWill(cardState: CardState, gameState: GameState, playerKey: string, row: number, col: number, deps: MeteorDeps = {}): MeteorResult {
    const cs = cardState as any;
    const pending = cs && cs.pendingEffectByPlayer ? cs.pendingEffectByPlayer[playerKey] : null;
    if (!pending || pending.type !== 'METEOR_WILL' || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }

    const getMeteorTargets = deps.getMeteorTargets || (() => []);
    const getCellValueForCard = deps.getCellValueForCard || (() => null);
    const destroyAt = deps.destroyAt || null;
    const isDestroyResolved = deps.isDestroyResolved || ((result: any) => !!(result && (result.destroyed || result.livingWillRevived)));
    const clearStoneIdAtForCard = deps.clearStoneIdAtForCard || (() => {});
    const setCellValueForCard = deps.setCellValueForCard || (() => false);
    const removeMarkersAt = deps.removeMarkersAt || (() => {});
    const addMarker = deps.addMarker || (() => false);
    const applyHoleAt = deps.applyHoleAt || null;
    const applyCellRemovalAt = deps.applyCellRemovalAt || null;
    const runCellRemovalBlock = deps.runCellRemovalBlock || null;
    const random = deps.random || null;

    const targets = getMeteorTargets(cardState, gameState, playerKey);
    const allowed = Array.isArray(targets) && targets.some((target) => target && target.row === row && target.col === col);
    if (!allowed) return { applied: false, reason: 'invalid_target' };

    if (typeof applyCellRemovalAt === 'function') {
        const removeCell = () => applyCellRemovalAt(
            cardState,
            gameState,
            row,
            col,
            playerKey,
            'METEOR_WILL',
            'meteor_cell_destroy',
            {
                removalPolicy: 'absolute_only',
                removalKind: 'meteor_hole',
                random,
                randomSource: random
            }
        );
        const result = (typeof runCellRemovalBlock === 'function')
            ? runCellRemovalBlock(cardState, gameState, removeCell, { randomSource: random })
            : removeCell();
        if (!result || !result.applied) {
            return {
                applied: false,
                reason: (result && result.reason) || 'hole_failed',
                row,
                col,
                destroyed: !!(result && result.destroyed)
            };
        }

        (cardState as any).pendingEffectByPlayer[playerKey] = null;
        return { applied: true, row, col, destroyed: !!result.destroyed };
    }

    const cellValue = getCellValueForCard(gameState, row, col);
    if (cellValue === null) return { applied: false, reason: 'out_of_board' };

    let destroyed = false;
    const applyHoleOnly = () => {
        if (typeof applyHoleAt === 'function') {
            return applyHoleAt(cardState, gameState, row, col, playerKey, {});
        }
        clearStoneIdAtForCard(cardState, gameState, row, col);
        setCellValueForCard(gameState, row, col, EMPTY);
        removeMarkersAt(cardState, row, col);
        addMarker(cardState, 'specialStone', row, col, playerKey, {
            type: 'METEOR_HOLE'
        });
        return { applied: true };
    };
    const removeCell = () => {
        if (cellValue !== EMPTY) {
            if (typeof destroyAt === 'function') {
                const destroyOptions: any = { ignoreGuard: true, ignoreRegen: true };
                if (random && typeof random.random === 'function') {
                    destroyOptions.random = random;
                    destroyOptions.randomSource = random;
                }
                const result = destroyAt(
                    cardState,
                    gameState,
                    row,
                    col,
                    'METEOR_WILL',
                    'meteor_cell_destroy',
                    destroyOptions
                );
                destroyed = isDestroyResolved(result);
                if (result && result.reason === 'out_of_board') {
                    return { applied: false, reason: 'out_of_board' };
                }
                if (result && result.reason === 'absolute_protected') {
                    return { applied: false, reason: 'absolute_protected' };
                }
            }
            if (!destroyed) {
                destroyed = true;
            }
        }
        const holeResult = applyHoleOnly();
        if (!holeResult || !holeResult.applied) {
            return { applied: false, reason: (holeResult && holeResult.reason) || 'hole_failed' };
        }
        return { applied: true };
    };

    const result = (cellValue !== EMPTY && typeof runCellRemovalBlock === 'function')
        ? runCellRemovalBlock(cardState, gameState, removeCell, { randomSource: random })
        : removeCell();
    if (!result || !result.applied) return result || { applied: false, reason: 'hole_failed' };

    (cardState as any).pendingEffectByPlayer[playerKey] = null;
    return { applied: true, row, col, destroyed };
}

export = {
    applyMeteorWill
};
