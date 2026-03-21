/**
 * @file effect-timing.js
 * @description Turn-start and placement-effect orchestration shared between Browser and Headless.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CardEffectTiming = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function getConstants(context) {
        const constants = (context && context.constants) || {};
        return {
            BLACK: Number.isFinite(Number(constants.BLACK)) ? Number(constants.BLACK) : 1,
            WHITE: Number.isFinite(Number(constants.WHITE)) ? Number(constants.WHITE) : -1,
            EMPTY: Number.isFinite(Number(constants.EMPTY)) ? Number(constants.EMPTY) : 0,
            DRAW_INTERVAL: Number.isFinite(Number(constants.DRAW_INTERVAL)) ? Number(constants.DRAW_INTERVAL) : 1,
            FLIP_CHARGE_MULTIPLIER_EFFECTS: constants.FLIP_CHARGE_MULTIPLIER_EFFECTS || {},
            NUMBER_CELL_CHARGE_MULTIPLIER_EFFECTS: constants.NUMBER_CELL_CHARGE_MULTIPLIER_EFFECTS || {},
            ULTIMATE_DRAGON_TURNS: constants.ULTIMATE_DRAGON_TURNS,
            ULTIMATE_DESTROY_GOD_TURNS: constants.ULTIMATE_DESTROY_GOD_TURNS,
            ULTIMATE_HYPERACTIVE_TURNS: constants.ULTIMATE_HYPERACTIVE_TURNS,
            EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT: Number.isFinite(Number(constants.EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT))
                ? Number(constants.EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT)
                : 3,
            ULTIMATE_HYPERACTIVE_FLIP_EVADE_LIMIT: Number.isFinite(Number(constants.ULTIMATE_HYPERACTIVE_FLIP_EVADE_LIMIT))
                ? Number(constants.ULTIMATE_HYPERACTIVE_FLIP_EVADE_LIMIT)
                : 3,
            ULTIMATE_HYPERACTIVE_DESTROY_EVADE_LIMIT: Number.isFinite(Number(constants.ULTIMATE_HYPERACTIVE_DESTROY_EVADE_LIMIT))
                ? Number(constants.ULTIMATE_HYPERACTIVE_DESTROY_EVADE_LIMIT)
                : 1,
            SNIPER_WILL_TURNS: constants.SNIPER_WILL_TURNS,
            DESTROY_DRAGON_TURNS: constants.DESTROY_DRAGON_TURNS,
            LIGHTNING_WILL_TURNS: constants.LIGHTNING_WILL_TURNS,
            OBSERVER_WILL_TURNS: constants.OBSERVER_WILL_TURNS,
            WILL_HUNTER_KING_TURNS: constants.WILL_HUNTER_KING_TURNS,
            ROBOT_VACUUM_TURNS: constants.ROBOT_VACUUM_TURNS,
            STRONG_WILL_PROMOTION_OWNER_TURNS: constants.STRONG_WILL_PROMOTION_OWNER_TURNS,
            TIME_STOP_GOD_TURNS: Number.isFinite(Number(constants.TIME_STOP_GOD_TURNS))
                ? Number(constants.TIME_STOP_GOD_TURNS)
                : 3,
            DOUBLE_PLACE_EXTRA: constants.DOUBLE_PLACE_EXTRA,
            THROW_CHAIN_CONFIG_BY_TYPE: constants.THROW_CHAIN_CONFIG_BY_TYPE || {},
            MARKER_KINDS: constants.MARKER_KINDS || null
        };
    }

    function getThrowChainConfig(constants, type) {
        const key = String(type || '');
        return key ? (constants.THROW_CHAIN_CONFIG_BY_TYPE[key] || null) : null;
    }

    function getHelpers(context) {
        return (context && context.helpers) || {};
    }

    function getBoardOps(context) {
        return context && context.modules ? context.modules.BoardOpsModule : null;
    }

    function resolveNodeModule(path) {
        if (!(typeof module === 'object' && module.exports) || typeof require !== 'function') return null;
        try {
            return require(path);
        } catch (e) {
            return null;
        }
    }

    function resolveGlobalModule(name) {
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope && globalScope[name] ? globalScope[name] : null;
    }

    function getSpecialStoneKind(constants) {
        return constants.MARKER_KINDS ? constants.MARKER_KINDS.SPECIAL_STONE : 'specialStone';
    }

    function getStrongWillPromotionOwnerTurns(constants) {
        const raw = Number(constants && constants.STRONG_WILL_PROMOTION_OWNER_TURNS);
        return Number.isFinite(raw) ? Math.max(1, Math.trunc(raw)) : 10;
    }

    function processStrongWillPromotionOnTurnStart(cardState, playerKey, specialMarkers, helpers, constants) {
        const markers = Array.isArray(cardState && cardState.markers)
            ? cardState.markers
            : (Array.isArray(specialMarkers) ? specialMarkers : []);
        if (!markers.length) return;

        const threshold = getStrongWillPromotionOwnerTurns(constants);
        for (const marker of markers) {
            if (!marker || !marker.data || marker.data.type !== 'PERMA_PROTECTED') continue;
            if (marker.owner !== playerKey) continue;
            if (!Number.isInteger(marker.row) || !Number.isInteger(marker.col)) continue;

            const progress = Number.isFinite(Number(marker.data.strongWillPromotionOwnerTurnStarts))
                ? Math.max(0, Math.trunc(Number(marker.data.strongWillPromotionOwnerTurnStarts)))
                : 0;
            const nextProgress = progress + 1;
            marker.data.strongWillPromotionOwnerTurnStarts = nextProgress;
            marker.data.strongWillPromotionThreshold = threshold;

            if (nextProgress < threshold) continue;

            marker.data.type = 'ABSOLUTE_PROTECTED';
            delete marker.data.strongWillPromotionOwnerTurnStarts;
            delete marker.data.strongWillPromotionThreshold;

            if (typeof helpers.emitPresentationEvent === 'function') {
                helpers.emitPresentationEvent(cardState, {
                    type: 'STATUS_APPLIED',
                    row: marker.row,
                    col: marker.col,
                    reason: 'strong_will_promoted',
                    meta: {
                        special: 'ABSOLUTE_PROTECTED',
                        owner: marker.owner || playerKey,
                        reason: 'strong_will_promoted',
                        promotedFrom: 'PERMA_PROTECTED'
                    }
                });
            }
        }
    }

    function onTurnStart(cardState, playerKey, gameState, prng, context) {
        const helpers = getHelpers(context);
        const constants = getConstants(context);
        const BoardOpsModule = getBoardOps(context);
        const p = prng || (context && context.defaultPrng);
        const summary = {
            ribo: {
                entries: [],
                totalRepaid: 0,
                totalDestroyed: 0,
                completedCount: 0
            }
        };

        cardState.turnCountByPlayer[playerKey]++;
        cardState.turnIndex++;
        cardState.lastTurnStartedFor = playerKey;

        if (!cardState.breedingSproutByOwner || typeof cardState.breedingSproutByOwner !== 'object') {
            cardState.breedingSproutByOwner = { black: [], white: [] };
        }
        if (!Array.isArray(cardState.breedingSproutByOwner.black)) cardState.breedingSproutByOwner.black = [];
        if (!Array.isArray(cardState.breedingSproutByOwner.white)) cardState.breedingSproutByOwner.white = [];
        if (!cardState._breedingSproutClearedTokenByOwner || typeof cardState._breedingSproutClearedTokenByOwner !== 'object') {
            cardState._breedingSproutClearedTokenByOwner = { black: null, white: null };
        }
        const breedingSproutToken = `${playerKey}:${Number.isFinite(cardState.turnIndex) ? cardState.turnIndex : 0}`;
        if (cardState._breedingSproutClearedTokenByOwner[playerKey] !== breedingSproutToken) {
            cardState._breedingSproutClearedTokenByOwner[playerKey] = breedingSproutToken;
            cardState.breedingSproutByOwner[playerKey] = [];
        }

        cardState.hasUsedCardThisTurnByPlayer[playerKey] = false;
        if (typeof helpers.ensureHandDestroyFlags === 'function') {
            helpers.ensureHandDestroyFlags(cardState);
        }
        cardState.hasDestroyedCardThisTurnByPlayer[playerKey] = false;
        cardState.extraPlaceRemainingByPlayer[playerKey] = 0;
        if (!cardState.infinitePlaceActiveByPlayer) cardState.infinitePlaceActiveByPlayer = { black: false, white: false };
        if (!cardState.multiPlaceSourceTypeByPlayer) cardState.multiPlaceSourceTypeByPlayer = { black: null, white: null };
        cardState.infinitePlaceActiveByPlayer[playerKey] = false;
        cardState.multiPlaceSourceTypeByPlayer[playerKey] = null;

        if (typeof helpers.processRiboWillTurnStartEffects === 'function') {
            summary.ribo = helpers.processRiboWillTurnStartEffects(cardState, gameState, playerKey, p);
        }

        if (cardState.debugNoDraw !== true && cardState.turnCountByPlayer[playerKey] % constants.DRAW_INTERVAL === 0) {
            if (typeof helpers.commitDraw === 'function') {
                helpers.commitDraw(cardState, playerKey, p);
            }
        }

        const specialMarkers = typeof helpers.getSpecialMarkers === 'function'
            ? helpers.getSpecialMarkers(cardState)
            : [];
        const frozenCellsActiveAtTurnStart = new Set(
            specialMarkers
                .filter((marker) => marker && marker.data && marker.data.type === 'FREEZE')
                .map((marker) => `${marker.row},${marker.col}`)
        );
        cardState._frozenCellsActiveAtTurnStart = frozenCellsActiveAtTurnStart;

        processStrongWillPromotionOnTurnStart(cardState, playerKey, specialMarkers, helpers, constants);

        const specialStoneKind = getSpecialStoneKind(constants);
        for (const marker of specialMarkers) {
            const data = marker.data || {};
            if (data.expiresForPlayer === playerKey) {
                if (data.type === 'GOLD' || data.type === 'SILVER') {
                    if (BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function') {
                        BoardOpsModule.destroyAt(cardState, gameState, marker.row, marker.col, 'SYSTEM', 'gold_silver_expired');
                    } else {
                        if (gameState && gameState.board) gameState.board[marker.row][marker.col] = constants.EMPTY;
                        if (typeof helpers.removeMarkersAt === 'function') {
                            helpers.removeMarkersAt(cardState, marker.row, marker.col, { kind: specialStoneKind, type: data.type, owner: marker.owner });
                        }
                    }
                } else if (typeof helpers.removeMarkersAt === 'function') {
                    helpers.removeMarkersAt(cardState, marker.row, marker.col, { kind: specialStoneKind, type: data.type, owner: marker.owner });
                }
                continue;
            }
            if (typeof data.remainingOwnerTurns === 'number' && data.remainingOwnerTurns <= 0) {
                if (typeof helpers.removeMarkersAt === 'function') {
                    helpers.removeMarkersAt(cardState, marker.row, marker.col, { kind: specialStoneKind, type: data.type, owner: marker.owner });
                }
                continue;
            }
            if (data.type === 'REGEN' && (data.regenRemaining || 0) <= 0) {
                if (typeof helpers.removeMarkersAt === 'function') {
                    helpers.removeMarkersAt(cardState, marker.row, marker.col, { kind: specialStoneKind, type: data.type, owner: marker.owner });
                }
            }
            if (data.type !== 'FREEZE' && typeof helpers.isFrozenCellForCard === 'function' && helpers.isFrozenCellForCard(cardState, marker.row, marker.col)) {
                continue;
            }
            if ((data.type === 'GUARD' || data.type === 'BLOCKADE' || data.type === 'FREEZE') && marker.owner === playerKey && typeof data.remainingOwnerTurns === 'number') {
                data.remainingOwnerTurns -= 1;
                if (data.remainingOwnerTurns <= 0 && typeof helpers.removeMarkersAt === 'function') {
                    if (typeof helpers.emitPresentationEvent === 'function') {
                        helpers.emitPresentationEvent(cardState, {
                            type: 'STATUS_REMOVED',
                            row: marker.row,
                            col: marker.col,
                            reason: 'duration_end',
                            meta: {
                                special: data.type,
                                owner: marker.owner,
                                reason: 'duration_end'
                            }
                        });
                    }
                    helpers.removeMarkersAt(cardState, marker.row, marker.col, {
                        kind: specialStoneKind,
                        type: data.type,
                        owner: marker.owner
                    });
                }
            }
        }

        let workMod = resolveNodeModule('../cards/work_will');
        if (!workMod) workMod = resolveGlobalModule('CardWork');
        if (workMod && typeof workMod.processWorkEffects === 'function') {
            try {
                const res = workMod.processWorkEffects(cardState, gameState, playerKey);
                if (!cardState.presentationEvents) cardState.presentationEvents = [];
                const row = Number.isInteger(res && res.row) ? res.row : null;
                const col = Number.isInteger(res && res.col) ? res.col : null;
                const removedReason = (res && typeof res.removedReason === 'string' && res.removedReason)
                    ? res.removedReason
                    : null;
                const incomeStep = Number.isFinite(Number(res && res.incomeStep))
                    ? Number(res.incomeStep)
                    : null;
                if (res && res.gained && res.gained > 0) {
                    if (typeof helpers.emitPresentationEvent === 'function') {
                        helpers.emitPresentationEvent(cardState, {
                            type: 'WORK_INCOME',
                            player: playerKey,
                            row,
                            col,
                            gained: res.gained,
                            removed: !!res.removed,
                            reason: removedReason,
                            meta: { reason: removedReason, incomeStep }
                        });
                    }
                } else if (res && res.removed && typeof helpers.emitPresentationEvent === 'function') {
                    helpers.emitPresentationEvent(cardState, {
                        type: 'WORK_REMOVED',
                        player: playerKey,
                        row,
                        col,
                        removed: true,
                        reason: removedReason,
                        meta: { reason: removedReason }
                    });
                }
            } catch (e) {
                // swallow to avoid breaking turn start in environments without module
            }
        }

        return summary;
    }

    function applyPlacementEffects(cardState, gameState, playerKey, row, col, flipCount, context) {
        const helpers = getHelpers(context);
        const constants = getConstants(context);
        const BoardOpsModule = getBoardOps(context);
        const effects = { chargeGained: 0 };
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (pending && (pending.type === 'FREE_PLACEMENT' || pending.type === 'SNIPER_WILL' || pending.type === 'LAST_RESORT')) {
            effects.freePlacementUsed = true;
        }
        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        const ownerVal = playerKey === 'black' ? constants.BLACK : constants.WHITE;
        const opponentVal = -ownerVal;
        const specialStoneKind = getSpecialStoneKind(constants);
        const bombKind = constants.MARKER_KINDS ? constants.MARKER_KINDS.BOMB : 'bomb';

        let chargeGain = flipCount;

        const flipMultiplierConfig = pending ? constants.FLIP_CHARGE_MULTIPLIER_EFFECTS[pending.type] : null;
        const numberCellMultiplierConfig = pending ? constants.NUMBER_CELL_CHARGE_MULTIPLIER_EFFECTS[pending.type] : null;
        const chargeMultiplierConfig = flipMultiplierConfig || numberCellMultiplierConfig;
        if (flipMultiplierConfig) {
            chargeGain = flipCount * flipMultiplierConfig.multiplier;
            effects[flipMultiplierConfig.effectFlag] = true;
            if (BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function') {
                BoardOpsModule.destroyAt(cardState, gameState, row, col, 'SYSTEM', flipMultiplierConfig.destroyReason);
            } else {
                gameState.board[row][col] = constants.EMPTY;
            }
        } else if (numberCellMultiplierConfig) {
            effects[numberCellMultiplierConfig.effectFlag] = true;
            if (BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function') {
                BoardOpsModule.destroyAt(cardState, gameState, row, col, 'SYSTEM', numberCellMultiplierConfig.destroyReason);
            } else {
                gameState.board[row][col] = constants.EMPTY;
            }
        }

        if (pending && pending.type === 'PLUNDER_WILL') {
            const mod = resolveNodeModule('../effects/plunder_will');
            const plunderEffect = mod && mod.applyPlunderWill;
            if (typeof plunderEffect === 'function') {
                const res = plunderEffect(cardState, playerKey, flipCount);
                chargeGain += (res.plundered || 0);
                effects.plunderAmount = res.plundered || 0;
            } else {
                const stolen = Math.min(flipCount, cardState.charge[opponentKey]);
                if (typeof helpers.addChargeValue === 'function') {
                    helpers.addChargeValue(cardState, opponentKey, -stolen, 'plunder_loss');
                }
                chargeGain += stolen;
                effects.plunderAmount = stolen;
            }
        }

        if (typeof helpers.addChargeWithTotal === 'function') {
            helpers.addChargeWithTotal(cardState, playerKey, chargeGain);
        }
        effects.chargeGained = chargeGain;
        if (chargeMultiplierConfig && chargeMultiplierConfig.gainField && effects[chargeMultiplierConfig.gainField] == null) {
            effects[chargeMultiplierConfig.gainField] = 0;
        }

        if (pending && pending.type === 'PROTECTED_NEXT_STONE') {
            const mod = resolveNodeModule('../effects/protected_next_stone');
            if (mod && typeof mod.applyProtectedNextStone === 'function') {
                const res = mod.applyProtectedNextStone(cardState, playerKey, row, col);
                if (res.applied) effects.protected = true;
            } else if (typeof helpers.addMarker === 'function') {
                helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
                    type: 'PROTECTED',
                    expiresForPlayer: playerKey
                });
                effects.protected = true;
            }
        }

        if (pending && pending.type === 'PERMA_PROTECT_NEXT_STONE') {
            const mod = resolveNodeModule('../effects/perma_protect_next_stone');
            if (mod && typeof mod.applyPermaProtectNextStone === 'function') {
                const res = mod.applyPermaProtectNextStone(cardState, playerKey, row, col);
                if (res.applied) effects.permaProtected = true;
            } else if (typeof helpers.applyStrongWill === 'function') {
                const res = helpers.applyStrongWill(cardState, playerKey, row, col);
                if (res && res.applied) effects.permaProtected = true;
            }
        }

        if (pending && pending.type === 'REGEN_WILL' && typeof helpers.applyRegenWill === 'function') {
            helpers.applyRegenWill(cardState, playerKey, row, col);
            effects.regenPlaced = true;
        }

        try {
            if (typeof helpers.workDebugLog === 'function') {
                helpers.workDebugLog(cardState, '[WORK_DEBUG] workNextPlacementArmedByPlayer state:', cardState.workNextPlacementArmedByPlayer, 'playerKey:', playerKey, 'row:', row, 'col:', col);
            }
            if (cardState.workNextPlacementArmedByPlayer && cardState.workNextPlacementArmedByPlayer[playerKey]) {
                let workMod = resolveNodeModule('../cards/work_will');
                if (!workMod) workMod = resolveGlobalModule('CardWork');
                try {
                    if (workMod && typeof workMod.placeWorkStone === 'function') {
                        if (typeof helpers.workDebugLog === 'function') {
                            helpers.workDebugLog(cardState, '[WORK_DEBUG] Calling placeWorkStone for', playerKey, row, col);
                        }
                        workMod.placeWorkStone(cardState, gameState, playerKey, row, col, { addMarker: helpers.addMarker });
                        effects.workPlaced = true;
                        try {
                            if (typeof globalThis !== 'undefined') globalThis._lastWorkPlaced = { playerKey, row, col };
                            else if (typeof global !== 'undefined') global._lastWorkPlaced = { playerKey, row, col };
                        } catch (e) { /* ignore */ }
                    } else if (typeof helpers.workDebugLog === 'function') {
                        helpers.workDebugLog(cardState, '[WORK_DEBUG] workMod.placeWorkStone not available, workMod:', !!workMod);
                    }
                } catch (e) {
                    if (typeof helpers.workDebugError === 'function') {
                        helpers.workDebugError(cardState, '[WORK_DEBUG] placeWorkStone threw', e && e.message ? e.message : e);
                    }
                }
                cardState.workNextPlacementArmedByPlayer[playerKey] = false;
            }
        } catch (e) { /* defensive */ }

        if (pending && pending.type === 'ULTIMATE_REVERSE_DRAGON') {
            if (typeof helpers.addMarker === 'function') {
                helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
                    type: 'DRAGON',
                    remainingOwnerTurns: constants.ULTIMATE_DRAGON_TURNS
                });
                effects.dragonPlaced = true;
            }
        }

        if (pending && pending.type === 'BREEDING_WILL' && typeof helpers.addMarker === 'function') {
            helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
                type: 'BREEDING',
                remainingOwnerTurns: 5
            });
            effects.breedingPlaced = true;
        }

        if (pending && pending.type === 'ULTIMATE_DESTROY_GOD' && typeof helpers.addMarker === 'function') {
            helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
                type: 'ULTIMATE_DESTROY_GOD',
                remainingOwnerTurns: constants.ULTIMATE_DESTROY_GOD_TURNS
            });
            effects.ultimateDestroyGodPlaced = true;
        }

        if (pending && pending.type === 'SNIPER_WILL' && typeof helpers.addMarker === 'function') {
            helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
                type: 'SNIPER',
                remainingOwnerTurns: constants.SNIPER_WILL_TURNS
            });
            effects.sniperPlaced = true;
        }

        if (pending && pending.type === 'OBSERVER_WILL' && typeof helpers.addMarker === 'function') {
            helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
                type: 'OBSERVER',
                remainingOwnerTurns: constants.OBSERVER_WILL_TURNS
            });
            effects.observerPlaced = true;
        }

        if (pending && pending.type === 'TIME_STOP_GOD' && typeof helpers.addMarker === 'function') {
            const remainingOwnerTurns = Number.isFinite(Number(constants.TIME_STOP_GOD_TURNS))
                ? Math.max(1, Math.trunc(Number(constants.TIME_STOP_GOD_TURNS)))
                : 3;
            helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
                type: 'TIME_STOP',
                remainingOwnerTurns
            });
            effects.timeStopPlaced = true;
        }

        if (pending && pending.type === 'WILL_HUNTER_KING' && typeof helpers.addMarker === 'function') {
            helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
                type: 'WILL_HUNTER_KING',
                remainingOwnerTurns: constants.WILL_HUNTER_KING_TURNS,
                flipEvadeRemaining: 2,
                destroyEvadeRemaining: 2
            });
            effects.willHunterKingPlaced = true;
        }

        if (pending && pending.type === 'DESTROY_DRAGON_WILL' && typeof helpers.addMarker === 'function') {
            helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
                type: 'DESTROY_DRAGON',
                remainingOwnerTurns: constants.DESTROY_DRAGON_TURNS
            });
            effects.destroyDragonPlaced = true;
        }

        if (pending && pending.type === 'LIGHTNING_WILL' && typeof helpers.addMarker === 'function') {
            helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
                type: 'LIGHTNING',
                remainingOwnerTurns: constants.LIGHTNING_WILL_TURNS
            });
            effects.lightningPlaced = true;
        }

        if (pending && pending.type === 'HYPERACTIVE_WILL' && typeof helpers.addMarker === 'function') {
            cardState.hyperactiveSeqCounter = (cardState.hyperactiveSeqCounter || 0) + 1;
            helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
                type: 'HYPERACTIVE',
                flipEvadeRemaining: 1,
                hyperactiveSeq: cardState.hyperactiveSeqCounter
            });
            effects.hyperactivePlaced = true;
        }

        if (pending && pending.type === 'EXTREME_HYPERACTIVE_WILL' && typeof helpers.addMarker === 'function') {
            cardState.hyperactiveSeqCounter = (cardState.hyperactiveSeqCounter || 0) + 1;
            helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
                type: 'EXTREME_HYPERACTIVE',
                flipEvadeRemaining: constants.EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT,
                hyperactiveSeq: cardState.hyperactiveSeqCounter
            });
            effects.hyperactivePlaced = true;
            effects.extremeHyperactivePlaced = true;
        }

        if (pending && pending.type === 'ESCAPE_WILL' && typeof helpers.addMarker === 'function') {
            cardState.hyperactiveSeqCounter = (cardState.hyperactiveSeqCounter || 0) + 1;
            helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
                type: 'ESCAPE_HYPERACTIVE',
                flipEvadeRemaining: 1,
                hyperactiveSeq: cardState.hyperactiveSeqCounter
            });
            effects.hyperactivePlaced = true;
            effects.escapeHyperactivePlaced = true;
        }

        if (pending && pending.type === 'ROBOT_VACUUM_WILL' && typeof helpers.addMarker === 'function') {
            cardState.hyperactiveSeqCounter = (cardState.hyperactiveSeqCounter || 0) + 1;
            helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
                type: 'ROBOT_VACUUM',
                hyperactiveSeq: cardState.hyperactiveSeqCounter,
                remainingOwnerTurns: constants.ROBOT_VACUUM_TURNS
            });
            effects.hyperactivePlaced = true;
            effects.robotVacuumPlaced = true;
        }

        if (pending && pending.type === 'GLUTTONOUS_WILL' && typeof helpers.addMarker === 'function') {
            cardState.hyperactiveSeqCounter = (cardState.hyperactiveSeqCounter || 0) + 1;
            helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
                type: 'GLUTTONOUS',
                hyperactiveSeq: cardState.hyperactiveSeqCounter,
                gluttonousMissStreak: 0
            });
            effects.hyperactivePlaced = true;
            effects.gluttonousPlaced = true;
        }

        if (pending && pending.type === 'INSTANT_HYPERACTIVE_WILL' && typeof helpers.addMarker === 'function') {
            cardState.hyperactiveSeqCounter = (cardState.hyperactiveSeqCounter || 0) + 1;
            helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
                type: 'HYPERACTIVE',
                hyperactiveSeq: cardState.hyperactiveSeqCounter,
                instantPlacementOnly: true
            });
            effects.hyperactivePlaced = true;
            effects.instantHyperactivePlaced = true;
        }

        if (pending && pending.type === 'ULTIMATE_HYPERACTIVE_GOD' && typeof helpers.addMarker === 'function') {
            helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, {
                type: 'ULTIMATE_HYPERACTIVE',
                remainingOwnerTurns: constants.ULTIMATE_HYPERACTIVE_TURNS,
                flipEvadeRemaining: constants.ULTIMATE_HYPERACTIVE_FLIP_EVADE_LIMIT,
                destroyEvadeRemaining: constants.ULTIMATE_HYPERACTIVE_DESTROY_EVADE_LIMIT
            });
            effects.ultimateHyperactivePlaced = true;
        }

        function explodeCells(cells, cause, reason) {
            const targetMap = new Map();
            for (const pos of cells) {
                const targetRow = Number(pos && pos.row);
                const targetCol = Number(pos && pos.col);
                if (!Number.isInteger(targetRow) || !Number.isInteger(targetCol)) continue;
                if (typeof helpers.hasBoardShapeCellForCard === 'function' && !helpers.hasBoardShapeCellForCard(cardState, gameState, targetRow, targetCol)) continue;
                const key = `${targetRow},${targetCol}`;
                if (!targetMap.has(key)) {
                    targetMap.set(key, { row: targetRow, col: targetCol });
                }
            }
            const validTargets = Array.from(targetMap.values());
            const forbiddenEvadeCells = validTargets.map((pos) => ({ row: pos.row, col: pos.col }));
            let destroyedCount = 0;
            for (const pos of validTargets) {
                const prev = (BoardOpsModule && typeof BoardOpsModule.getCellValue === 'function')
                    ? BoardOpsModule.getCellValue(gameState, pos.row, pos.col)
                    : (typeof helpers.getCellValueForCard === 'function' ? helpers.getCellValueForCard(gameState, pos.row, pos.col) : null);
                if (prev === constants.EMPTY || prev === null) continue;
                if (BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function') {
                    const res = BoardOpsModule.destroyAt(cardState, gameState, pos.row, pos.col, cause, reason, {
                        forbiddenEvadeCells
                    });
                    if (res && res.destroyed) destroyedCount++;
                } else {
                    if (typeof helpers.removeMarkersAt === 'function') {
                        helpers.removeMarkersAt(cardState, pos.row, pos.col);
                    }
                    if (typeof helpers.setCellValueForCard !== 'function' || !helpers.setCellValueForCard(gameState, pos.row, pos.col, constants.EMPTY)) continue;
                    if (typeof helpers.clearStoneIdAtForCard === 'function') {
                        helpers.clearStoneIdAtForCard(cardState, gameState, pos.row, pos.col);
                    }
                    destroyedCount++;
                }
            }
            return destroyedCount;
        }

        if (pending && (pending.type === 'CROSS_BOMB' || pending.type === 'X_BOMB')) {
            const targets = [{ row, col }];
            for (const dist of [1, 2]) {
                if (pending.type === 'CROSS_BOMB') {
                    targets.push(
                        { row: row - dist, col },
                        { row: row + dist, col },
                        { row, col: col - dist },
                        { row, col: col + dist }
                    );
                } else {
                    targets.push(
                        { row: row - dist, col: col - dist },
                        { row: row - dist, col: col + dist },
                        { row: row + dist, col: col - dist },
                        { row: row + dist, col: col + dist }
                    );
                }
            }

            if (pending.type === 'CROSS_BOMB') {
                const destroyedCount = explodeCells(targets, 'CROSS_BOMB', 'cross_bomb_explosion');
                effects.crossBombExploded = true;
                effects.crossBombDestroyed = destroyedCount;
            } else {
                const destroyedCount = explodeCells(targets, 'X_BOMB', 'x_bomb_explosion');
                effects.xBombExploded = true;
                effects.xBombDestroyed = destroyedCount;
            }
        }

        const throwChainConfig = pending ? getThrowChainConfig(constants, pending.type) : null;
        if (pending && throwChainConfig) {
            if (!cardState.extraPlaceRemainingByPlayer) cardState.extraPlaceRemainingByPlayer = {};
            if (!cardState.infinitePlaceActiveByPlayer) cardState.infinitePlaceActiveByPlayer = { black: false, white: false };
            if (!cardState.multiPlaceSourceTypeByPlayer) cardState.multiPlaceSourceTypeByPlayer = { black: null, white: null };

            cardState.extraPlaceRemainingByPlayer[playerKey] = throwChainConfig.extraPlacements;
            cardState.infinitePlaceActiveByPlayer[playerKey] = throwChainConfig.infinite === true;
            cardState.multiPlaceSourceTypeByPlayer[playerKey] = pending.type;

            effects.doublePlaceActivated = true;
            effects.multiPlaceActivatedType = pending.type;
            effects.multiPlaceActivatedName = throwChainConfig.name || pending.type;
            effects.multiPlaceRemaining = throwChainConfig.infinite === true ? null : throwChainConfig.extraPlacements;
            effects.multiPlaceInfinite = throwChainConfig.infinite === true;
        }

        if (pending && pending.type === 'LAST_RESORT') {
            const remainingBefore = Number.isFinite(Number(pending.placementsRemaining))
                ? Math.max(0, Math.floor(Number(pending.placementsRemaining)))
                : 3;
            const remainingAfter = Math.max(0, remainingBefore - 1);
            pending.placementsRemaining = remainingAfter;

            if (remainingBefore > 1) {
                if (!cardState.extraPlaceRemainingByPlayer) cardState.extraPlaceRemainingByPlayer = {};
                const currentExtra = Math.max(0, Number(cardState.extraPlaceRemainingByPlayer[playerKey] || 0));
                const extraGrant = Number.isFinite(Number(constants.DOUBLE_PLACE_EXTRA))
                    ? Math.max(1, Math.floor(Number(constants.DOUBLE_PLACE_EXTRA)))
                    : 1;
                cardState.extraPlaceRemainingByPlayer[playerKey] = currentExtra + extraGrant;
                effects.lastResortContinues = true;
            } else {
                effects.lastResortCompleted = true;
            }
        }

        if (!(pending && pending.type === 'LAST_RESORT' && Number(pending.placementsRemaining || 0) > 0)) {
            cardState.pendingEffectByPlayer[playerKey] = null;
        }

        return effects;
    }

    return {
        onTurnStart,
        applyPlacementEffects
    };
}));
