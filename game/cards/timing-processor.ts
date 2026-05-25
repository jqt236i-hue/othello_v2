/**
 * @file timing-processor.ts
 * @description Turn timing and periodic effect processors
 */

import { CardState, GameState } from '../../src/types';

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

function readRuntimeGlobal(globalKey: string): any {
    if (!globalKey) return null;
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any)[globalKey]) {
            return (globalThis as any)[globalKey];
        }
        if (typeof self !== 'undefined' && (self as any)[globalKey]) {
            return (self as any)[globalKey];
        }
    } catch (e) {
        return null;
    }
    return null;
}

function unwrapModule(mod: any): any {
    if (mod && typeof mod === 'object' && Object.prototype.hasOwnProperty.call(mod, 'default')) {
        return mod.default || mod;
    }
    return mod;
}

const CardModuleResolver = safeRequire('../logic/cards-internal/module-resolver');

function loadRuntimeModule(id: string, globalKey: string): any {
    if (CardModuleResolver && typeof CardModuleResolver.resolveModule === 'function') {
        const resolved = CardModuleResolver.resolveModule({
            globalName: globalKey,
            requirePath: id,
            requireFn: _require,
            label: globalKey
        });
        if (resolved) return unwrapModule(resolved);
    }

    return unwrapModule(safeRequire(id)) || unwrapModule(readRuntimeGlobal(globalKey));
}

function requireRuntimeModule(id: string, globalKey: string): any {
    const mod = loadRuntimeModule(id, globalKey);
    if (!mod) {
        throw new Error(`[timing-processor.ts] ${globalKey} module not available`);
    }
    return mod;
}

const CardEffectTimingModule = requireRuntimeModule('../logic/cards-internal/effect-timing', 'CardEffectTiming');

const CardTimeBombModule = requireRuntimeModule('../logic/cards/time_bomb', 'CardTimeBomb');

const DragonEffectsModule = requireRuntimeModule('../logic/effects/dragon', 'DragonEffects');

const CardUdgModule = requireRuntimeModule('../logic/cards/udg', 'CardUdg');

const CardHyperactiveModule = requireRuntimeModule('../logic/cards/hyperactive', 'CardHyperactive');

function onTurnStart(cardState: CardState, playerKey: string, gameState: GameState, prng: any, effectTimingContext: any) {
    if (!CardEffectTimingModule || typeof CardEffectTimingModule.onTurnStart !== 'function') {
        throw new Error('[timing-processor.ts] CardEffectTiming.onTurnStart not available');
    }
    return CardEffectTimingModule.onTurnStart(cardState, playerKey, gameState, prng, effectTimingContext);
}

function onTurnEnd(cardState: CardState, gameState: GameState, playerKey: string, deps: any) {
    const { readCardPendingEffect, clearCardPendingEffect, isChainWillCardType } = deps || {};
    const cs = cardState as any;
    const pending = typeof readCardPendingEffect === 'function'
        ? readCardPendingEffect(cardState, playerKey)
        : (cs && cs.pendingEffectByPlayer ? cs.pendingEffectByPlayer[playerKey] : null);
    if (pending && typeof isChainWillCardType === 'function' && isChainWillCardType(pending.type)) {
        if (typeof clearCardPendingEffect === 'function') {
            clearCardPendingEffect(cardState, playerKey);
        }
        else if (cs && cs.pendingEffectByPlayer) {
            cs.pendingEffectByPlayer[playerKey] = null;
        }
    }
}

function applyPlacementEffects(cardState: CardState, gameState: GameState, playerKey: string, row: number, col: number, flipCount: number, effectTimingContext: any) {
    if (!CardEffectTimingModule || typeof CardEffectTimingModule.applyPlacementEffects !== 'function') {
        throw new Error('[timing-processor.ts] CardEffectTiming.applyPlacementEffects not available');
    }
    return CardEffectTimingModule.applyPlacementEffects(cardState, gameState, playerKey, row, col, flipCount, effectTimingContext);
}

function tickBombs(cardState: CardState, gameState: GameState, playerKey: string, deps: any) {
    const { BoardOpsModule, destroyAt } = deps || {};
    return CardTimeBombModule.tickBombs(cardState, gameState, playerKey, { BoardOps: BoardOpsModule, destroyAt });
}

function tickBombAt(cardState: CardState, gameState: GameState, bomb: any, activeKey: string, deps: any) {
    const { BoardOpsModule, destroyAt, removeMarkersAt } = deps || {};
    if (!bomb)
        return { exploded: [], destroyed: [], removed: false };
    return CardTimeBombModule.tickBombAt(cardState, gameState, bomb, activeKey, {
        BoardOps: BoardOpsModule,
        destroyAt,
        removeMarkersAt
    });
}

function processDragonEffects(cardState: CardState, gameState: GameState, playerKey: string, deps: any) {
    const { BoardOpsModule, getCardContext, selectRandomEmptyBoardShapeDestination, moveCoexistingSpecialMarkers } = deps || {};
    const dragonDeps = {
        BoardOps: BoardOpsModule,
        getCardContext,
        selectRandomEmptyBoardShapeDestination,
        moveCoexistingSpecialMarkers
    };
    return DragonEffectsModule.processDragonEffects(cardState, gameState, playerKey, dragonDeps);
}

function processUltimateDestroyGodEffects(cardState: CardState, gameState: GameState, playerKey: string, deps: any) {
    const { destroyAt, BoardOpsModule, selectRandomEmptyBoardShapeDestination, moveCoexistingSpecialMarkers } = deps || {};
    const udgDeps = {
        destroyAt,
        BoardOps: BoardOpsModule,
        selectRandomEmptyBoardShapeDestination,
        moveCoexistingSpecialMarkers
    };
    return CardUdgModule.processUltimateDestroyGodEffects(cardState, gameState, playerKey, udgDeps);
}

function processHyperactiveMoves(cardState: CardState, gameState: GameState, prng: any, deps: any) {
    const { defaultPrng, getFlipsWithContextLocal, clearBombAt, clearHyperactiveAtPositions, isBlockedCell, getCardContext, BoardOpsModule, destroyAt } = deps || {};
    return CardHyperactiveModule.processHyperactiveMoves(cardState, gameState, prng, {
        defaultPrng,
        getFlipsWithContext: getFlipsWithContextLocal,
        clearBombAt,
        clearHyperactiveAtPositions,
        isBlockedCell,
        getCardContext,
        BoardOps: BoardOpsModule,
        destroyAt
    });
}

export = {
    onTurnStart,
    onTurnEnd,
    applyPlacementEffects,
    tickBombs,
    tickBombAt,
    processDragonEffects,
    processUltimateDestroyGodEffects,
    processHyperactiveMoves
};
