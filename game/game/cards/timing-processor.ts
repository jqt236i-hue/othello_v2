// @ts-nocheck
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

/**
 * @file timing-processor.ts
 * @description Turn timing and periodic effect processors
 */
function _require(id) {
    if (typeof __non_webpack_require__ !== 'undefined') {
        return __non_webpack_require__(id);
    }
    if (typeof require === 'function') {
        return _require(id);
    }
    throw new Error('Unable to require ' + id);
}
const SharedConstants = (typeof module === 'object' && module.exports)
    ? _require('../../shared-constants')
    : (typeof self !== 'undefined' ? self.SharedConstants : undefined);
const CardEffectTimingModule = (typeof module === 'object' && module.exports)
    ? _require('../logic/cards-internal/effect-timing')
    : (typeof self !== 'undefined' ? self.CardEffectTiming : null);
const CardTimeBombModule = (typeof module === 'object' && module.exports)
    ? _require('../logic/cards/time_bomb')
    : (typeof self !== 'undefined' ? self.CardTimeBomb : null);
const DragonEffectsModule = (typeof module === 'object' && module.exports)
    ? _require('../logic/effects/dragon')
    : (typeof self !== 'undefined' ? self.DragonEffects : null);
const CardUdgModule = (typeof module === 'object' && module.exports)
    ? _require('../logic/cards/udg')
    : (typeof self !== 'undefined' ? self.CardUdg : null);
const CardHyperactiveModule = (typeof module === 'object' && module.exports)
    ? _require('../logic/cards/hyperactive')
    : (typeof self !== 'undefined' ? self.CardHyperactive : null);
const { EMPTY } = SharedConstants || {};
function onTurnStart(cardState, playerKey, gameState, prng, effectTimingContext) {
    if (!CardEffectTimingModule || typeof CardEffectTimingModule.onTurnStart !== 'function') {
        throw new Error('[timing-processor.ts] CardEffectTiming.onTurnStart not available');
    }
    return CardEffectTimingModule.onTurnStart(cardState, playerKey, gameState, prng, effectTimingContext);
}
function onTurnEnd(cardState, gameState, playerKey, deps) {
    const { readCardPendingEffect, clearCardPendingEffect, isChainWillCardType } = deps || {};
    const cs = cardState;
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
function applyPlacementEffects(cardState, gameState, playerKey, row, col, flipCount, effectTimingContext) {
    if (!CardEffectTimingModule || typeof CardEffectTimingModule.applyPlacementEffects !== 'function') {
        throw new Error('[timing-processor.ts] CardEffectTiming.applyPlacementEffects not available');
    }
    return CardEffectTimingModule.applyPlacementEffects(cardState, gameState, playerKey, row, col, flipCount, effectTimingContext);
}
function tickBombs(cardState, gameState, playerKey, deps) {
    const { BoardOpsModule, destroyAt } = deps || {};
    if (CardTimeBombModule && typeof CardTimeBombModule.tickBombs === 'function') {
        return CardTimeBombModule.tickBombs(cardState, gameState, playerKey, { BoardOps: BoardOpsModule, destroyAt });
    }
    console.warn('[timing-processor.ts] CardTimeBomb module not available');
    return { exploded: [], destroyed: [] };
}
function tickBombAt(cardState, gameState, bomb, activeKey, deps) {
    const { BoardOpsModule, destroyAt, removeMarkerById, removeMarkersAt, getBombMarkers, MARKER_CATEGORIES } = deps || {};
    if (!bomb)
        return { exploded: [], destroyed: [], removed: false };
    if (CardTimeBombModule && typeof CardTimeBombModule.tickBombAt === 'function') {
        return CardTimeBombModule.tickBombAt(cardState, gameState, bomb, activeKey, { BoardOps: BoardOpsModule, destroyAt });
    }
    const bombs = typeof getBombMarkers === 'function' ? getBombMarkers(cardState) : [];
    const idx = bombs.findIndex((b) => (bomb.id && b.id === bomb.id) || (b.row === bomb.row && b.col === bomb.col && b.owner === bomb.owner && b.createdSeq === bomb.createdSeq));
    if (idx === -1)
        return { exploded: [], destroyed: [], removed: false };
    const b = bombs[idx];
    if (activeKey && b.owner !== activeKey)
        return { exploded: [], destroyed: [], removed: false };
    if (b.data && b.data.placedTurn === cardState.turnIndex)
        return { exploded: [], destroyed: [], removed: false };
    if (!b.data)
        b.data = {};
    b.data.remainingTurns = (typeof b.data.remainingTurns === 'number') ? b.data.remainingTurns - 1 : -1;
    if (b.data.remainingTurns <= 0) {
        const exploded = [{ row: b.row, col: b.col }];
        const destroyed = [];
        const targets = [];
        const forbiddenEvadeCells = [];
        const board = gameState && Array.isArray(gameState.board) ? gameState.board : [];
        const rows = board.length || 8;
        const cols = board[0] && board[0].length || rows;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const r = b.row + dr;
                const c = b.col + dc;
                if (r < 0 || r >= rows || c < 0 || c >= cols)
                    continue;
                forbiddenEvadeCells.push({ row: r, col: c });
                if (board[r][c] === EMPTY)
                    continue;
                targets.push({ row: r, col: c });
            }
        }
        for (const target of targets) {
            let destroyedRes = false;
            if (BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function') {
                const res = BoardOpsModule.destroyAt(cardState, gameState, target.row, target.col, 'TIME_BOMB', 'bomb_explosion', {
                    forbiddenEvadeCells
                });
                destroyedRes = !!(res && res.destroyed);
            }
            else if (typeof destroyAt === 'function') {
                destroyedRes = destroyAt(cardState, gameState, target.row, target.col);
            }
            if (destroyedRes)
                destroyed.push({ row: target.row, col: target.col });
        }
        if (typeof removeMarkerById === 'function' && b.id !== undefined) {
            removeMarkerById(cardState, b.id);
        }
        else if (typeof removeMarkersAt === 'function') {
            removeMarkersAt(cardState, b.row, b.col, { category: (MARKER_CATEGORIES || {}).BOMB, owner: b.owner });
        }
        return { exploded, destroyed, removed: true };
    }
    return { exploded: [], destroyed: [], removed: false };
}
function processDragonEffects(cardState, gameState, playerKey, deps) {
    const { BoardOpsModule, getCardContext, selectRandomEmptyBoardShapeDestination, moveCoexistingSpecialMarkers } = deps || {};
    const dragonDeps = {
        BoardOps: BoardOpsModule,
        getCardContext,
        selectRandomEmptyBoardShapeDestination,
        moveCoexistingSpecialMarkers
    };
    if (DragonEffectsModule && typeof DragonEffectsModule.processDragonEffects === 'function') {
        return DragonEffectsModule.processDragonEffects(cardState, gameState, playerKey, dragonDeps);
    }
    console.warn('[timing-processor.ts] DragonEffects module not available');
    return { converted: [], destroyed: [], anchors: [] };
}
function processUltimateDestroyGodEffects(cardState, gameState, playerKey, deps) {
    const { destroyAt, BoardOpsModule, selectRandomEmptyBoardShapeDestination, moveCoexistingSpecialMarkers } = deps || {};
    const udgDeps = {
        destroyAt,
        BoardOps: BoardOpsModule,
        selectRandomEmptyBoardShapeDestination,
        moveCoexistingSpecialMarkers
    };
    if (CardUdgModule && typeof CardUdgModule.processUltimateDestroyGodEffects === 'function') {
        return CardUdgModule.processUltimateDestroyGodEffects(cardState, gameState, playerKey, udgDeps);
    }
    console.warn('[timing-processor.ts] CardUdG module not available');
    return { destroyed: [], anchors: [], expired: [] };
}
function processHyperactiveMoves(cardState, gameState, prng, deps) {
    const { defaultPrng, getFlipsWithContextLocal, clearBombAt, clearHyperactiveAtPositions, isBlockedCell, getCardContext, BoardOpsModule, destroyAt } = deps || {};
    if (CardHyperactiveModule && typeof CardHyperactiveModule.processHyperactiveMoves === 'function') {
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
    console.warn('[timing-processor.ts] CardHyperactive module not available');
    return { moved: [], destroyed: [], flipped: [], flippedByOwner: { black: [], white: [] } };
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

