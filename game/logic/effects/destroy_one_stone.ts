/**
 * @file destroy_one_stone.ts
 * @description DESTROY_ONE_STONE helper - UMD module for browser and Node.js
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
    } catch (_e) {
        return null;
    }
}

function getRuntimeGlobalValue(key: string): any {
    if (typeof self !== 'undefined' && (self as any)[key]) {
        return (self as any)[key];
    }
    return undefined;
}

function resolveDestroyOneStoneModuleOrGlobal(id: string, globalKey: string): any {
    return safeRequire(id) || getRuntimeGlobalValue(globalKey);
}

const BoardOpsModule = resolveDestroyOneStoneModuleOrGlobal('../board_ops', 'BoardOps');
const DestroyOutcomeContract = resolveDestroyOneStoneModuleOrGlobal('../../../shared/destroy-outcome-contract', 'DestroyOutcomeContract');
const ExpansionFallbackModule = resolveDestroyOneStoneModuleOrGlobal('../cards-internal/expansion-fallback', 'CardExpansionFallback');

const DESTROY_OUTCOME_KINDS = (DestroyOutcomeContract && DestroyOutcomeContract.DESTROY_OUTCOME_KINDS)
    || Object.freeze({
        DESTROYED: 'destroyed',
        REGENERATED: 'regenerated',
        GHOST_BLOCKED: 'ghost_blocked',
        PROLIFERATED: 'proliferated',
        EVADED_MOVE: 'evaded_move'
    });

if (!ExpansionFallbackModule) {
    throw new Error('CardExpansionFallback missing required helpers');
}

const getCellValue = ExpansionFallbackModule.getCellValue as (gameState: GameState, row: number, col: number) => number | null;
const setCellValue = ExpansionFallbackModule.setCellValue as (gameState: GameState, row: number, col: number, value: number) => boolean;

function createDestroyOutcome(kindOrResult?: string | any, details?: any): any {
    if (DestroyOutcomeContract && typeof DestroyOutcomeContract.createDestroyOutcome === 'function') {
        return DestroyOutcomeContract.createDestroyOutcome(kindOrResult, details);
    }
    const source = (typeof kindOrResult === 'string')
        ? Object.assign({}, (details && typeof details === 'object') ? details : {}, { kind: kindOrResult })
        : Object.assign({}, (kindOrResult && typeof kindOrResult === 'object') ? kindOrResult : {});
    const kind = (source && source.kind) || (
        source && source.regenerated ? DESTROY_OUTCOME_KINDS.REGENERATED
            : source && source.proliferated ? DESTROY_OUTCOME_KINDS.PROLIFERATED
            : source && source.blockedByGhost ? DESTROY_OUTCOME_KINDS.GHOST_BLOCKED
                : source && source.evaded ? DESTROY_OUTCOME_KINDS.EVADED_MOVE
                    : source && source.destroyed ? DESTROY_OUTCOME_KINDS.DESTROYED
                        : null
    );
    const outcome = Object.assign({}, source, {
        destroyed: kind === DESTROY_OUTCOME_KINDS.DESTROYED || source.destroyed === true,
        regenerated: kind === DESTROY_OUTCOME_KINDS.REGENERATED || source.regenerated === true,
        evaded: kind === DESTROY_OUTCOME_KINDS.EVADED_MOVE || source.evaded === true,
        blockedByGhost: kind === DESTROY_OUTCOME_KINDS.GHOST_BLOCKED || source.blockedByGhost === true,
        proliferated: kind === DESTROY_OUTCOME_KINDS.PROLIFERATED || source.proliferated === true
    });
    if (kind) outcome.kind = kind;
    if (outcome.to && typeof outcome.destination === 'undefined') outcome.destination = outcome.to;
    if (outcome.from && typeof outcome.source === 'undefined') outcome.source = outcome.from;
    return outcome;
}

function isDestroyResolved(result: any): boolean {
    if (DestroyOutcomeContract && typeof DestroyOutcomeContract.isDestroyOutcomeResolved === 'function') {
        return DestroyOutcomeContract.isDestroyOutcomeResolved(result);
    }
    return !!(result && (result.destroyed || result.regenerated || result.evaded || result.blockedByGhost || result.proliferated));
}

interface DestroyDeps {
    BoardOps?: any;
    destroyAt?(cardState: CardState, gameState: GameState, row: number, col: number, source?: string, tag?: string): boolean;
}

function applyDestroyOneStone(cardState: CardState, gameState: GameState, playerKey: string, row: number, col: number, deps: DestroyDeps = {}): any {
    const result = createDestroyOutcome();
    if (!gameState) return result;

    const BoardOps = deps.BoardOps || BoardOpsModule;
    const destroyAtFn = deps.destroyAt;

    // Prefer BoardOps.destroyAt to ensure unified behavior and presentation event emission
    if (BoardOps && typeof BoardOps.destroyAt === 'function') {
        const randomSource = (cardState as { _boardOpsRandomSource?: any; _currentActionMeta?: any; _defaultRandomSource?: any })._boardOpsRandomSource
            || ((cardState as { _currentActionMeta?: any })._currentActionMeta && (cardState as { _currentActionMeta?: any })._currentActionMeta.randomSource)
            || (cardState as { _defaultRandomSource?: any })._defaultRandomSource
            || null;
        const meta = randomSource && typeof randomSource.random === 'function' ? { randomSource } : undefined;
        const res = BoardOps.destroyAt(cardState, gameState, row, col, 'DESTROY_ONE_STONE', 'destroy_one_stone', meta);
        if (isDestroyResolved(res)) {
            const cs = cardState as any;
            cs.pendingEffectByPlayer = cs.pendingEffectByPlayer || { black: null, white: null };
            cs.pendingEffectByPlayer[playerKey] = null;
            return createDestroyOutcome(res);
        }
        // If BoardOps rejected destroy (e.g. guard protection), do not bypass with fallback paths.
        if (res && res.destroyed === false) {
            return result;
        }
    }

    // If destroyAt function provided
    if (typeof destroyAtFn === 'function') {
        if (getCellValue(gameState, row, col) === 0) return result;
        const destroyed = destroyAtFn(cardState, gameState, row, col);
        if (destroyed) {
            const cs = cardState as any;
            cs.pendingEffectByPlayer = cs.pendingEffectByPlayer || { black: null, white: null };
            cs.pendingEffectByPlayer[playerKey] = null;
            return createDestroyOutcome(DESTROY_OUTCOME_KINDS.DESTROYED);
        }
    }

    // Fallback: original inline behavior
    if (getCellValue(gameState, row, col) === 0) return result;
    if (cardState && cardState.markers) {
        cardState.markers = cardState.markers.filter((m: any) => !(m.row === row && m.col === col));
    }
    setCellValue(gameState, row, col, 0);
    const cs = cardState as any;
    cs.pendingEffectByPlayer = cs.pendingEffectByPlayer || { black: null, white: null };
    cs.pendingEffectByPlayer[playerKey] = null;
    return createDestroyOutcome(DESTROY_OUTCOME_KINDS.DESTROYED);
}

export = {
    applyDestroyOneStone
};
