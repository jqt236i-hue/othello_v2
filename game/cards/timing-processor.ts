/**
 * @file timing-processor.ts
 * @description Turn timing and periodic effect processors
 */

import { CardState, GameState } from '../../src/types';
import CardEffectTimingModule = require('../logic/cards-internal/effect-timing');
import CardTimeBombModule = require('../logic/cards/time_bomb');
import DragonEffectsModule = require('../logic/effects/dragon');
import CardUdgModule = require('../logic/cards/udg');
import CardHyperactiveModule = require('../logic/cards/hyperactive');

function getCardEffectTimingModule(): any { return CardEffectTimingModule; }
function getCardTimeBombModule(): any { return CardTimeBombModule; }
function getDragonEffectsModule(): any { return DragonEffectsModule; }
function getCardUdgModule(): any { return CardUdgModule; }
function getCardHyperactiveModule(): any { return CardHyperactiveModule; }

function onTurnStart(cardState: CardState, playerKey: string, gameState: GameState, prng: any, effectTimingContext: any) {
    const CardEffectTimingModule = getCardEffectTimingModule();
    if (!CardEffectTimingModule || typeof CardEffectTimingModule.onTurnStart !== 'function') {
        throw new Error('[timing-processor.ts] CardEffectTiming.onTurnStart not available');
    }
    return CardEffectTimingModule.onTurnStart(cardState, playerKey, gameState, prng, effectTimingContext);
}

function onTurnStartBeforeAnchors(cardState: CardState, playerKey: string, gameState: GameState, prng: any, effectTimingContext: any) {
    const CardEffectTimingModule = getCardEffectTimingModule();
    if (!CardEffectTimingModule || typeof CardEffectTimingModule.onTurnStartBeforeAnchors !== 'function') {
        throw new Error('[timing-processor.ts] CardEffectTiming.onTurnStartBeforeAnchors not available');
    }
    return CardEffectTimingModule.onTurnStartBeforeAnchors(cardState, playerKey, gameState, prng, effectTimingContext);
}

function drawForTurnStart(cardState: CardState, playerKey: string, prng: any, effectTimingContext: any) {
    const CardEffectTimingModule = getCardEffectTimingModule();
    if (!CardEffectTimingModule || typeof CardEffectTimingModule.drawForTurnStart !== 'function') {
        throw new Error('[timing-processor.ts] CardEffectTiming.drawForTurnStart not available');
    }
    return CardEffectTimingModule.drawForTurnStart(cardState, playerKey, prng, effectTimingContext);
}

function flushDeferredTurnStartStatusExpirations(cardState: CardState, gameState: GameState, effectTimingContext: any) {
    const CardEffectTimingModule = getCardEffectTimingModule();
    if (!CardEffectTimingModule || typeof CardEffectTimingModule.flushDeferredTurnStartStatusExpirations !== 'function') {
        return [];
    }
    return CardEffectTimingModule.flushDeferredTurnStartStatusExpirations(cardState, gameState, effectTimingContext);
}

function processTurnStartStatusMarkerAnchor(cardState: CardState, gameState: GameState, playerKey: string, marker: any, effectTimingContext: any) {
    const CardEffectTimingModule = getCardEffectTimingModule();
    if (!CardEffectTimingModule || typeof CardEffectTimingModule.processTurnStartStatusMarkerAnchor !== 'function') {
        return { processed: false, expired: [] };
    }
    return CardEffectTimingModule.processTurnStartStatusMarkerAnchor(cardState, gameState, playerKey, marker, effectTimingContext);
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
    const CardEffectTimingModule = getCardEffectTimingModule();
    if (!CardEffectTimingModule || typeof CardEffectTimingModule.applyPlacementEffects !== 'function') {
        throw new Error('[timing-processor.ts] CardEffectTiming.applyPlacementEffects not available');
    }
    return CardEffectTimingModule.applyPlacementEffects(cardState, gameState, playerKey, row, col, flipCount, effectTimingContext);
}

function tickBombs(cardState: CardState, gameState: GameState, playerKey: string, deps: any) {
    const { BoardOpsModule, destroyAt } = deps || {};
    const CardTimeBombModule = getCardTimeBombModule();
    return CardTimeBombModule.tickBombs(cardState, gameState, playerKey, { BoardOps: BoardOpsModule, destroyAt });
}

function tickBombAt(cardState: CardState, gameState: GameState, bomb: any, activeKey: string, deps: any) {
    const { BoardOpsModule, destroyAt, removeMarkersAt } = deps || {};
    if (!bomb)
        return { exploded: [], destroyed: [], removed: false };
    const CardTimeBombModule = getCardTimeBombModule();
    return CardTimeBombModule.tickBombAt(cardState, gameState, bomb, activeKey, {
        BoardOps: BoardOpsModule,
        destroyAt,
        removeMarkersAt
    });
}

function processDragonEffects(cardState: CardState, gameState: GameState, playerKey: string, deps: any) {
    const { BoardOpsModule, getCardContext, selectRandomEmptyBoardShapeDestination, moveCoexistingSpecialMarkers, resolveFlipEvasion, randomSource } = deps || {};
    const DragonEffectsModule = getDragonEffectsModule();
    const dragonDeps = {
        BoardOps: BoardOpsModule,
        getCardContext,
        selectRandomEmptyBoardShapeDestination,
        moveCoexistingSpecialMarkers,
        resolveFlipEvasion,
        randomSource
    };
    return DragonEffectsModule.processDragonEffects(cardState, gameState, playerKey, dragonDeps);
}

function processUltimateDestroyGodEffects(cardState: CardState, gameState: GameState, playerKey: string, deps: any) {
    const { destroyAt, BoardOpsModule, isManifestStoneAt, isInviolableCell, selectRandomEmptyBoardShapeDestination, moveCoexistingSpecialMarkers } = deps || {};
    const CardUdgModule = getCardUdgModule();
    const udgDeps = {
        destroyAt,
        BoardOps: BoardOpsModule,
        isManifestStoneAt,
        isInviolableCell,
        selectRandomEmptyBoardShapeDestination,
        moveCoexistingSpecialMarkers
    };
    return CardUdgModule.processUltimateDestroyGodEffects(cardState, gameState, playerKey, udgDeps);
}

function processHyperactiveMoves(cardState: CardState, gameState: GameState, prng: any, deps: any) {
    const { defaultPrng, getFlipsWithContextLocal, clearBombAt, clearHyperactiveAtPositions, isBlockedCell, getCardContext, BoardOpsModule, destroyAt } = deps || {};
    const CardHyperactiveModule = getCardHyperactiveModule();
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
    onTurnStartBeforeAnchors,
    drawForTurnStart,
    flushDeferredTurnStartStatusExpirations,
    processTurnStartStatusMarkerAnchor,
    onTurnEnd,
    applyPlacementEffects,
    tickBombs,
    tickBombAt,
    processDragonEffects,
    processUltimateDestroyGodEffects,
    processHyperactiveMoves
};
