/**
 * @file meteor.ts
 * @description Meteor helpers (Shared between Browser and Headless)
 */

import { CardState, GameState } from '../../../src/types';
import CardCellRemovalImport = require('./cell-removal');

const CardCellRemoval: any = CardCellRemovalImport;

interface MeteorDeps {
    getMeteorTargets?(cardState: CardState, gameState: GameState, playerKey: string): Array<{row: number; col: number}>;
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
    const random = deps.random || null;

    const targets = getMeteorTargets(cardState, gameState, playerKey);
    const allowed = Array.isArray(targets) && targets.some((target) => target && target.row === row && target.col === col);
    if (!allowed) return { applied: false, reason: 'invalid_target' };

    const cellRemovalDeps = Object.assign({}, deps, { random });
    const removeCell = () => CardCellRemoval.applyHoleStyleCellRemoval(
        cardState,
        gameState,
        row,
        col,
        playerKey,
        'METEOR_WILL',
        'meteor_cell_destroy',
        cellRemovalDeps,
        { random, randomSource: random }
    );
    const result = CardCellRemoval.runHoleStyleCellRemovalBlock(
        cardState,
        gameState,
        deps,
        removeCell,
        { randomSource: random }
    );
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

export = {
    applyMeteorWill
};
