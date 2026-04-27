/**
 * @file timing-processor.js
 * @description Turn timing and periodic effect processors (extracted from cards.js)
 * Delegates to specialized internal modules.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(
            require('../../shared-constants'),
            require('../logic/cards-internal/effect-timing'),
            require('../logic/cards/time_bomb'),
            require('../logic/effects/dragon'),
            require('../logic/cards/udg'),
            require('../logic/cards/hyperactive')
        );
    } else {
        root.CardTimingProcessor = factory(
            root.SharedConstants,
            root.CardEffectTiming || null,
            root.CardTimeBomb || null,
            root.DragonEffects || null,
            root.CardUdg || null,
            root.CardHyperactive || null
        );
    }
}(typeof self !== 'undefined' ? self : this, function (
    SharedConstants,
    CardEffectTimingModule,
    CardTimeBombModule,
    DragonEffectsModule,
    CardUdgModule,
    CardHyperactiveModule
) {
    'use strict';

    const { EMPTY } = SharedConstants || {};

    /**
     * Turn start processing
     */
    function onTurnStart(cardState, playerKey, gameState, prng, effectTimingContext) {
        if (!CardEffectTimingModule || typeof CardEffectTimingModule.onTurnStart !== 'function') {
            throw new Error('[timing-processor.js] CardEffectTiming.onTurnStart not available');
        }
        return CardEffectTimingModule.onTurnStart(
            cardState,
            playerKey,
            gameState,
            prng,
            effectTimingContext
        );
    }

    /**
     * Called when a turn ends (after move or pass)
     */
    function onTurnEnd(cardState, gameState, playerKey, deps) {
        const { readCardPendingEffect, clearCardPendingEffect, isChainWillCardType } = deps || {};
        const pending = typeof readCardPendingEffect === 'function'
            ? readCardPendingEffect(cardState, playerKey)
            : (cardState && cardState.pendingEffectByPlayer ? cardState.pendingEffectByPlayer[playerKey] : null);
        if (pending && typeof isChainWillCardType === 'function' && isChainWillCardType(pending.type)) {
            if (typeof clearCardPendingEffect === 'function') {
                clearCardPendingEffect(cardState, playerKey);
            } else if (cardState && cardState.pendingEffectByPlayer) {
                cardState.pendingEffectByPlayer[playerKey] = null;
            }
        }
    }

    /**
     * Apply effects after placement
     */
    function applyPlacementEffects(cardState, gameState, playerKey, row, col, flipCount, effectTimingContext) {
        if (!CardEffectTimingModule || typeof CardEffectTimingModule.applyPlacementEffects !== 'function') {
            throw new Error('[timing-processor.js] CardEffectTiming.applyPlacementEffects not available');
        }
        return CardEffectTimingModule.applyPlacementEffects(
            cardState,
            gameState,
            playerKey,
            row,
            col,
            flipCount,
            effectTimingContext
        );
    }

    /**
     * Process Bomb countdowns
     */
    function tickBombs(cardState, gameState, playerKey, deps) {
        const { BoardOpsModule, destroyAt } = deps || {};
        if (CardTimeBombModule && typeof CardTimeBombModule.tickBombs === 'function') {
            return CardTimeBombModule.tickBombs(cardState, gameState, playerKey, { BoardOps: BoardOpsModule, destroyAt });
        }
        console.warn('[timing-processor.js] CardTimeBomb module not available');
        return { exploded: [], destroyed: [] };
    }

    /**
     * Tick a single bomb (by object) at turn start.
     */
    function tickBombAt(cardState, gameState, bomb, activeKey, deps) {
        const { BoardOpsModule, destroyAt, removeMarkerById, removeMarkersAt, getBombMarkers, MARKER_CATEGORIES } = deps || {};
        if (!bomb) return { exploded: [], destroyed: [], removed: false };
        if (CardTimeBombModule && typeof CardTimeBombModule.tickBombAt === 'function') {
            return CardTimeBombModule.tickBombAt(cardState, gameState, bomb, activeKey, { BoardOps: BoardOpsModule, destroyAt });
        }
        // Fallback: emulate tick for single bomb
        const bombs = typeof getBombMarkers === 'function' ? getBombMarkers(cardState) : [];
        const idx = bombs.findIndex(b => (bomb.id && b.id === bomb.id) || (b.row === bomb.row && b.col === bomb.col && b.owner === bomb.owner && b.createdSeq === bomb.createdSeq));
        if (idx === -1) return { exploded: [], destroyed: [], removed: false };
        const b = bombs[idx];
        if (activeKey && b.owner !== activeKey) return { exploded: [], destroyed: [], removed: false };
        if (b.data && b.data.placedTurn === cardState.turnIndex) return { exploded: [], destroyed: [], removed: false };
        if (!b.data) b.data = {};
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
                    if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
                    forbiddenEvadeCells.push({ row: r, col: c });
                    if (board[r][c] === EMPTY) continue;
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
                } else if (typeof destroyAt === 'function') {
                    destroyedRes = destroyAt(cardState, gameState, target.row, target.col);
                }
                if (destroyedRes) destroyed.push({ row: target.row, col: target.col });
            }
            if (typeof removeMarkerById === 'function' && b.id !== undefined) {
                removeMarkerById(cardState, b.id);
            } else if (typeof removeMarkersAt === 'function') {
                removeMarkersAt(cardState, b.row, b.col, { category: (MARKER_CATEGORIES || {}).BOMB, owner: b.owner });
            }
            return { exploded, destroyed, removed: true };
        }
        return { exploded: [], destroyed: [], removed: false };
    }

    /**
     * Process Dragon effects
     */
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
        console.warn('[timing-processor.js] DragonEffects module not available');
        return { converted: [], destroyed: [], anchors: [] };
    }

    /**
     * Process ULTIMATE_DESTROY_GOD effects at owner turn start.
     */
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
        console.warn('[timing-processor.js] CardUdG module not available');
        return { destroyed: [], anchors: [], expired: [] };
    }

    /**
     * Process hyperactive moves
     */
    function processHyperactiveMoves(cardState, gameState, prng, deps) {
        const {
            defaultPrng,
            getFlipsWithContextLocal,
            clearBombAt,
            clearHyperactiveAtPositions,
            isBlockedCell,
            getCardContext,
            BoardOpsModule,
            destroyAt
        } = deps || {};
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
        console.warn('[timing-processor.js] CardHyperactive module not available');
        return { moved: [], destroyed: [], flipped: [], flippedByOwner: { black: [], white: [] } };
    }

    return {
        onTurnStart,
        onTurnEnd,
        applyPlacementEffects,
        tickBombs,
        tickBombAt,
        processDragonEffects,
        processUltimateDestroyGodEffects,
        processHyperactiveMoves
    };
}));
