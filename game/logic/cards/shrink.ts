/**
 * @file shrink.ts
 * @description Board shrink helpers (Shared between Browser and Headless)
 */

import { CardState, GameState } from '../../../src/types';
import CardCellRemovalImport = require('./cell-removal');

const BOARD_SHRINK_SELECTION_COUNT = 3;
const BOARD_SHRINK_HOLE_VISUAL_VARIANT = 'BOARD_FRAME';

const CardCellRemoval: any = CardCellRemovalImport;

interface Target { row: number; col: number }

interface ShrinkDeps {
    applyCellRemovalAt?(cardState: CardState, gameState: GameState, row: number, col: number, playerKey: string, cause: string, reason: string, options: any): any;
    runCellRemovalBlock?(cardState: CardState, gameState: GameState, fn: () => any, meta?: any): any;
    random?: { random(): number };
    getBoardShrinkTargets?(cardState: CardState, gameState: GameState, playerKey: string): Target[];
    getBoardShrinkGodTargets?(cardState: CardState, gameState: GameState, playerKey: string): Array<Target & { lineCells?: Target[]; lineKey?: string }>;
}

interface HoleResult {
    applied: boolean;
    reason?: string;
    row: number;
    col: number;
    destroyed?: boolean;
}

interface ShrinkResult {
    applied: boolean;
    reason?: string;
    completed?: boolean;
    selectedCount?: number;
    maxSelections?: number;
    remainingSelections?: number;
    target?: Target;
    selectedTargets?: Target[];
    changedTargets?: Target[];
    skippedTargets?: Array<Target & { reason: string }>;
    firstTarget?: Target;
    lineKey?: string | null;
    lineTargets?: Target[];
    source?: Target;
}

function cloneTarget(target: any): Target | null {
    if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col)) return null;
    return { row: target.row, col: target.col };
}

function getBoardShrinkPendingSelectionsForCard(pending: any): Target[] {
    if (!pending || pending.type !== 'BOARD_SHRINK_WILL' || !Array.isArray(pending.selectedTargets)) return [];
    const unique: Target[] = [];
    const seen = new Set<string>();
    for (const target of pending.selectedTargets) {
        const cloned = cloneTarget(target);
        if (!cloned) continue;
        const key = `${cloned.row},${cloned.col}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(cloned);
    }
    return unique;
}

function applyHoleAt(cardState: CardState, gameState: GameState, playerKey: string, row: number, col: number, deps: ShrinkDeps, options: any): HoleResult {
    const resolvedDeps = deps || {};
    const resolvedOptions = options || {};
    const random = resolvedDeps.random || null;
    const cardType = typeof resolvedOptions.cardType === 'string' && resolvedOptions.cardType
        ? resolvedOptions.cardType
        : 'BOARD_SHRINK_WILL';
    const destroyReason = typeof resolvedOptions.destroyReason === 'string' && resolvedOptions.destroyReason
        ? resolvedOptions.destroyReason
        : 'board_shrink_cell_destroy';

    const result = CardCellRemoval.applyHoleStyleCellRemoval(
        cardState,
        gameState,
        row,
        col,
        playerKey,
        cardType,
        destroyReason,
        resolvedDeps,
        {
            random,
            randomSource: random,
            holeMeta: {
                visualVariant: BOARD_SHRINK_HOLE_VISUAL_VARIANT
            }
        }
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
    return { applied: true, row, col, destroyed: !!result.destroyed };
}

function applyBoardShrinkWill(cardState: CardState, gameState: GameState, playerKey: string, row: number, col: number, deps: ShrinkDeps): ShrinkResult {
    const cs = cardState as any;
    const pending = cs && cs.pendingEffectByPlayer ? cs.pendingEffectByPlayer[playerKey] : null;
    if (!pending || pending.type !== 'BOARD_SHRINK_WILL' || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }

    const getBoardShrinkTargets = deps && deps.getBoardShrinkTargets
        ? deps.getBoardShrinkTargets
        : (() => []);
    const targets = getBoardShrinkTargets(cardState, gameState, playerKey);
    const allowed = Array.isArray(targets) && targets.some((target) => target && target.row === row && target.col === col);
    if (!allowed) return { applied: false, reason: 'invalid_target' };

    const currentSelections = getBoardShrinkPendingSelectionsForCard(pending);
    const nextSelections = currentSelections.concat({ row, col }).map((target) => ({ row: target.row, col: target.col }));
    const maxSelections = Number.isFinite(Number(pending.maxSelections))
        ? Math.max(1, Math.trunc(Number(pending.maxSelections)))
        : BOARD_SHRINK_SELECTION_COUNT;

    if (nextSelections.length < maxSelections) {
        pending.selectedTargets = nextSelections;
        pending.selectedCount = pending.selectedTargets.length;
        pending.maxSelections = maxSelections;
        return {
            applied: true,
            completed: false,
            selectedCount: pending.selectedCount,
            maxSelections,
            remainingSelections: maxSelections - pending.selectedCount,
            target: { row, col },
            selectedTargets: pending.selectedTargets.map((target: any) => ({ row: target.row, col: target.col }))
        };
    }

    const changedTargets: Target[] = [];
    const skippedTargets: Array<Target & { reason: string }> = [];
    const applySelections = () => {
        for (const target of nextSelections) {
            const result = applyHoleAt(cardState, gameState, playerKey, target.row, target.col, deps, {
                cardType: 'BOARD_SHRINK_WILL',
                destroyReason: 'board_shrink_cell_destroy'
            });
            if (result && result.applied) {
                changedTargets.push({ row: target.row, col: target.col });
            } else {
                skippedTargets.push({
                    row: target.row,
                    col: target.col,
                    reason: result && result.reason ? result.reason : 'invalid_target'
                });
            }
        }
    };
    if (deps && typeof deps.runCellRemovalBlock === 'function') {
        deps.runCellRemovalBlock(cardState, gameState, applySelections, { randomSource: deps.random || null });
    } else {
        applySelections();
    }

    cs.pendingEffectByPlayer[playerKey] = null;
    return {
        applied: true,
        completed: true,
        source: { row, col },
        selectedTargets: nextSelections.map((target) => ({ row: target.row, col: target.col })),
        changedTargets,
        skippedTargets
    };
}

function applyBoardShrinkGod(cardState: CardState, gameState: GameState, playerKey: string, row: number, col: number, deps: ShrinkDeps): ShrinkResult {
    const cs = cardState as any;
    const pending = cs && cs.pendingEffectByPlayer ? cs.pendingEffectByPlayer[playerKey] : null;
    if (!pending || pending.type !== 'BOARD_SHRINK_GOD' || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }

    const getBoardShrinkGodTargets = deps && deps.getBoardShrinkGodTargets
        ? deps.getBoardShrinkGodTargets
        : (() => []);
    const targets = getBoardShrinkGodTargets(cardState, gameState, playerKey);
    const selectedTarget = Array.isArray(targets)
        ? targets.find((target) => target && target.row === row && target.col === col)
        : null;
    if (!selectedTarget) return { applied: false, reason: 'invalid_target' };

    const firstTarget = cloneTarget(pending.firstTarget);
    if (!firstTarget) {
        pending.firstTarget = { row, col };
        return {
            applied: true,
            completed: false,
            target: { row, col },
            firstTarget: { row, col }
        };
    }

    const lineCells = Array.isArray(selectedTarget.lineCells)
        ? selectedTarget.lineCells.map(cloneTarget).filter((target) => !!target)
        : [];
    if (lineCells.length === 0) return { applied: false, reason: 'invalid_target' };

    const changedTargets: Target[] = [];
    const skippedTargets: Array<Target & { reason: string }> = [];
    const applyLine = () => {
        for (const target of lineCells) {
            const result = applyHoleAt(cardState, gameState, playerKey, target.row, target.col, deps, {
                cardType: 'BOARD_SHRINK_GOD',
                destroyReason: 'board_shrink_god_cell_destroy'
            });
            if (result && result.applied) {
                changedTargets.push({ row: target.row, col: target.col });
            } else {
                skippedTargets.push({
                    row: target.row,
                    col: target.col,
                    reason: result && result.reason ? result.reason : 'invalid_target'
                });
            }
        }
    };
    if (deps && typeof deps.runCellRemovalBlock === 'function') {
        deps.runCellRemovalBlock(cardState, gameState, applyLine, { randomSource: deps.random || null });
    } else {
        applyLine();
    }

    cs.pendingEffectByPlayer[playerKey] = null;
    return {
        applied: true,
        completed: true,
        firstTarget,
        target: { row, col },
        lineKey: selectedTarget.lineKey || null,
        lineTargets: lineCells,
        changedTargets,
        skippedTargets
    };
}

export = {
    BOARD_SHRINK_SELECTION_COUNT,
    getBoardShrinkPendingSelectionsForCard,
    applyBoardShrinkWill,
    applyBoardShrinkGod
};
