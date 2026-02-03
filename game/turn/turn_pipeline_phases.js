/**
 * @file turn_pipeline_phases.js
 * @description Turn pipeline phase helpers (UMD)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.TurnPipelinePhases = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    const MarkersAdapter = (() => {
        if (typeof require === 'function') {
            try {
                return require('../logic/markers_adapter');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.MarkersAdapter || null;
    })();
    const MARKER_KINDS = MarkersAdapter && MarkersAdapter.MARKER_KINDS;

    function applyTurnStartPhase(CardLogic, Core, cardState, gameState, playerKey, events, prng) {
        const p = prng || undefined;

        if (cardState.lastTurnStartedFor !== playerKey) {
            // Snapshot timers before any turn-start processing (for visual timer updates).
            const timerSnapshot = new Map();
            try {
                const sourceMarkers = (MarkersAdapter && typeof MarkersAdapter.getMarkers === 'function')
                    ? MarkersAdapter.getMarkers(cardState)
                    : (cardState.markers || []);
                for (const m of sourceMarkers) {
                    if (!m || !m.data) continue;
                    const key = (m.id !== undefined && m.id !== null)
                        ? `${m.kind}:${m.id}`
                        : `${m.kind}:${m.row},${m.col}:${m.owner}:${m.createdSeq || 0}`;
                    if (m.kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : 'bomb')) {
                        if (typeof m.data.remainingTurns === 'number') {
                            timerSnapshot.set(key, { timer: m.data.remainingTurns, special: 'TIME_BOMB', owner: m.owner, row: m.row, col: m.col, kind: m.kind });
                        }
                    } else if (m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone')) {
                        if (typeof m.data.remainingOwnerTurns === 'number') {
                            timerSnapshot.set(key, { timer: m.data.remainingOwnerTurns, special: m.data.type || null, owner: m.owner, row: m.row, col: m.col, kind: m.kind });
                        }
                    }
                }
            } catch (e) { /* ignore snapshot failures */ }

            CardLogic.onTurnStart(cardState, playerKey, gameState, p);
            events.push({ type: 'turn_start', player: playerKey });

            // Start-of-turn effects: process all markers (bombs & special stones) in creation order
            const sourceMarkers = (MarkersAdapter && typeof MarkersAdapter.getMarkers === 'function')
                ? MarkersAdapter.getMarkers(cardState)
                : (cardState.markers || []);
            const markers = sourceMarkers
                .map(m => ({
                    kind: m.kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : 'bomb') ? 'bomb' : 'special',
                    marker: m,
                    createdSeq: (m.createdSeq || 0)
                }))
                .sort((a, b) => (a.createdSeq || 0) - (b.createdSeq || 0));

            const hyperAggregated = { moved: [], destroyed: [], flipped: [], flippedByOwner: { black: [], white: [] } };

            for (const m of markers) {
                if (m.kind === 'bomb') {
                    const res = CardLogic.tickBombAt(cardState, gameState, m.marker, playerKey);
                    if (res && res.exploded && res.exploded.length) {
                        events.push({ type: 'bombs_exploded', details: res });
                    }
                } else if (m.kind === 'special') {
                    const t = (m.marker.data && m.marker.data.type ? m.marker.data.type : '').toUpperCase();
                    const owner = m.marker.owner;
                    const row = m.marker.row;
                    const col = m.marker.col;
                    if (t === 'ULTIMATE_DESTROY_GOD' && owner === playerKey) {
                        const res = CardLogic.processUltimateDestroyGodEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col);
                        if (res && res.destroyed && res.destroyed.length) events.push({ type: 'udg_destroyed_start', details: res.destroyed });
                        if (res && res.expired && res.expired.length) events.push({ type: 'udg_expired_start', details: res.expired });
                    } else if (t === 'DRAGON' && owner === playerKey) {
                        const res = CardLogic.processDragonEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col);
                        if (res && res.converted && res.converted.length) {
                            cardState.charge[playerKey] = Math.min(30, (cardState.charge[playerKey] || 0) + res.converted.length);
                            events.push({ type: 'dragon_converted_start', details: res.converted });
                        }
                        if (res && res.destroyed && res.destroyed.length) events.push({ type: 'dragon_destroyed_anchor_start', details: res.destroyed });
                    } else if (t === 'BREEDING' && owner === playerKey) {
                        const res = CardLogic.processBreedingEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, p);
                        if (res && res.spawned && res.spawned.length) events.push({ type: 'breeding_spawned_start', details: res.spawned });
                        if (res && res.flipped && res.flipped.length) {
                            cardState.charge[playerKey] = Math.min(30, (cardState.charge[playerKey] || 0) + res.flipped.length);
                            events.push({ type: 'breeding_flipped_start', details: res.flipped });
                        }
                        if (res && res.destroyed && res.destroyed.length) events.push({ type: 'breeding_destroyed_anchor_start', details: res.destroyed });
                    } else if (t === 'HYPERACTIVE') {
                        // Hyperactive moves can trigger for both owners; process per-anchor by owner
                        const ownerKey = owner;
                        if (typeof console !== 'undefined' && console.log) console.log('[TurnPipeline] processing HYPERACTIVE anchor', { row, col, owner: ownerKey, createdSeq: m.createdSeq });
                        const res = CardLogic.processHyperactiveMoveAtAnchor(cardState, gameState, ownerKey, row, col, p);
                        if (typeof console !== 'undefined' && console.log) console.log('[TurnPipeline] hyperactive result', { row, col, owner: ownerKey, res });
                        if (res && res.moved && res.moved.length) {
                            events.push({ type: 'hyperactive_moved_start', details: res.moved });
                            hyperAggregated.moved.push(...res.moved);
                        }
                        if (res && res.destroyed && res.destroyed.length) {
                            events.push({ type: 'hyperactive_destroyed_start', details: res.destroyed });
                            hyperAggregated.destroyed.push(...res.destroyed);
                        }
                        if (res && res.flipped && res.flipped.length) {
                            events.push({ type: 'hyperactive_flipped_start', details: res.flipped });
                            hyperAggregated.flipped.push(...res.flipped);
                            hyperAggregated.flippedByOwner[ownerKey] = hyperAggregated.flippedByOwner[ownerKey] || [];
                            hyperAggregated.flippedByOwner[ownerKey].push(...res.flipped);
                            // Rule: flip count grants charge to the effect owner (clamped to 30).
                            cardState.charge = cardState.charge || { black: 0, white: 0 };
                            cardState.charge[ownerKey] = Math.min(30, (cardState.charge[ownerKey] || 0) + res.flipped.length);
                        }
                    }
                }
            }

            // After processing all markers, apply REGEN interaction based on aggregated hyperactive flips
            const hyperByOwner = hyperAggregated.flippedByOwner || {};
            const regenTriggered = [];
            const regenCaptureFlips = [];
            const regenCaptureByOwner = { black: [], white: [] };
            for (const ownerKey of ['black', 'white']) {
                const flips = hyperByOwner[ownerKey] || [];
                if (!flips.length) continue;
                if (typeof CardLogic.applyRegenAfterFlips !== 'function') continue;
                const regenRes = CardLogic.applyRegenAfterFlips(cardState, gameState, flips, ownerKey);
                if (regenRes && regenRes.regened && regenRes.regened.length) regenTriggered.push(...regenRes.regened);
                if (regenRes && regenRes.captureFlips && regenRes.captureFlips.length) {
                    regenCaptureFlips.push(...regenRes.captureFlips);
                    regenCaptureByOwner[ownerKey] = regenCaptureByOwner[ownerKey] || [];
                    regenCaptureByOwner[ownerKey].push(...regenRes.captureFlips);
                }
            }
            if (regenCaptureFlips.length && typeof CardLogic.clearHyperactiveAtPositions === 'function') {
                CardLogic.clearHyperactiveAtPositions(cardState, regenCaptureFlips);
            }
            if (regenTriggered.length) {
                events.push({ type: 'regen_triggered_start', details: regenTriggered });
            }
            if (regenCaptureFlips.length) {
                // Capture flips grant charge to the regen owner (clamped to 30).
                cardState.charge = cardState.charge || { black: 0, white: 0 };
                for (const ownerKey of ['black', 'white']) {
                    const arr = regenCaptureByOwner[ownerKey] || [];
                    if (!arr.length) continue;
                    cardState.charge[ownerKey] = Math.min(30, (cardState.charge[ownerKey] || 0) + arr.length);
                }
                events.push({ type: 'regen_capture_flipped_start', details: regenCaptureFlips });
            }

            // Emit timer update events when remaining turns changed.
            try {
                const afterMarkers = (MarkersAdapter && typeof MarkersAdapter.getMarkers === 'function')
                    ? MarkersAdapter.getMarkers(cardState)
                    : (cardState.markers || []);
                for (const m of afterMarkers) {
                    if (!m || !m.data) continue;
                    const key = (m.id !== undefined && m.id !== null)
                        ? `${m.kind}:${m.id}`
                        : `${m.kind}:${m.row},${m.col}:${m.owner}:${m.createdSeq || 0}`;
                    const before = timerSnapshot.get(key);
                    if (m.kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : 'bomb')) {
                        if (typeof m.data.remainingTurns !== 'number') continue;
                        if (!before || before.timer !== m.data.remainingTurns) {
                            if (typeof CardLogic.emitPresentationEvent === 'function') {
                                CardLogic.emitPresentationEvent(cardState, {
                                    type: 'STATUS_TICK',
                                    row: m.row,
                                    col: m.col,
                                    meta: { special: 'TIME_BOMB', timer: m.data.remainingTurns, owner: m.owner }
                                });
                            }
                        }
                    } else if (m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone')) {
                        if (typeof m.data.remainingOwnerTurns !== 'number') continue;
                        if (!before || before.timer !== m.data.remainingOwnerTurns) {
                            if (typeof CardLogic.emitPresentationEvent === 'function') {
                                CardLogic.emitPresentationEvent(cardState, {
                                    type: 'STATUS_TICK',
                                    row: m.row,
                                    col: m.col,
                                    meta: { special: m.data.type || null, timer: m.data.remainingOwnerTurns, owner: m.owner }
                                });
                            }
                        }
                    }
                }
            } catch (e) { /* ignore */ }

        }
    }

    function applyCardUsagePhase(CardLogic, cardState, gameState, playerKey, action, events) {
        if (action.useCardId) {
            const ok = CardLogic.applyCardUsage(
                cardState,
                gameState,
                playerKey,
                action.useCardId,
                action.useCardOwnerKey,
                action.debugOptions
            );
            if (!ok) {
                throw new Error('applyCardUsage failed');
            }
            events.push({ type: 'card_used', player: playerKey, cardId: action.useCardId });
        }
    }

    function applyActionPhase(CardLogic, Core, cardState, gameState, playerKey, action, events, prng, BoardOps) {
        const p = prng || undefined;

        if (action.type === 'pass') {
            const newState = Core.applyPass(gameState);
            Object.assign(gameState, newState);
            events.push({ type: 'pass', player: playerKey });
        } else if (action.type === 'use_card') {
            events.push({ type: 'card_used_only', player: playerKey, cardId: action.useCardId || null });
            return;
        } else if (action.type === 'cancel_card') {
            const res = (typeof CardLogic.cancelPendingSelection === 'function')
                ? CardLogic.cancelPendingSelection(cardState, playerKey, action.cancelOptions)
                : { canceled: false, reason: 'not_supported' };
            events.push({ type: 'card_cancelled', player: playerKey, canceled: !!res.canceled, reason: res.reason || null, cardId: res.cardId || null });
            return;
        } else if (action.type === 'place') {
            // 3.5) Optional pre-placement selection effects (for cards that require a target)
            const pending = cardState.pendingEffectByPlayer[playerKey];
            if (pending && pending.type === 'DESTROY_ONE_STONE' && action.destroyTarget) {
                const destroyed = CardLogic.applyDestroyEffect(
                    cardState,
                    gameState,
                    playerKey,
                    action.destroyTarget.row,
                    action.destroyTarget.col
                );
                events.push({ type: 'destroy_selected', player: playerKey, target: action.destroyTarget, destroyed });
                // Selection-only pre-placement effect: stop after handling selection
                return;
            } else if (pending && pending.type === 'DESTROY_ONE_STONE' && action.destroyTarget == null) {
                throw new Error('DESTROY_ONE_STONE requires destroyTarget before placement');
            }
            if (pending && pending.type === 'TEMPT_WILL' && action.temptTarget) {
                const res = CardLogic.applyTemptWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.temptTarget.row,
                    action.temptTarget.col
                );
                events.push({ type: 'tempt_selected', player: playerKey, target: action.temptTarget, applied: !!(res && res.applied) });
                // Selection-only pre-placement effect: stop after handling selection
                return;
            } else if (pending && pending.type === 'TEMPT_WILL' && action.temptTarget == null) {
                throw new Error('TEMPT_WILL requires temptTarget before placement');
            }
            if (pending && pending.type === 'INHERIT_WILL' && action.inheritTarget) {
                const res = CardLogic.applyInheritWill(
                    cardState,
                    gameState,
                    playerKey,
                    action.inheritTarget.row,
                    action.inheritTarget.col
                );
                events.push({ type: 'inherit_selected', player: playerKey, target: action.inheritTarget, applied: !!(res && res.applied) });
                // Selection-only pre-placement effect: stop after handling selection
                return;
            } else if (pending && pending.type === 'INHERIT_WILL' && action.inheritTarget == null) {
                throw new Error('INHERIT_WILL requires inheritTarget before placement');
            }

            // Determine flips using a safe context helper when possible
            let ctx = null;
            try {
                const ctxHelper = (typeof require === 'function') ? require('../logic/context') : (typeof globalThis !== 'undefined' ? globalThis.GameLogicContext : null);
                if (ctxHelper && typeof ctxHelper.getSafeCardContext === 'function') {
                    ctx = ctxHelper.getSafeCardContext(cardState);
                }
            } catch (e) { /* ignore and fallback */ }
            if (!ctx) {
                try { ctx = CardLogic.getCardContext(cardState); } catch (e) { ctx = { protectedStones: [], permaProtectedStones: [], bombs: [] }; }
            }
            const player = playerKey === 'black' ? Core.BLACK : Core.WHITE;

            // SWAP_WITH_ENEMY supports selecting an opponent stone as the placement coordinate in browser.
            let originalCellVal = null;
            const pendingType = CardLogic.getPendingEffectType(cardState, playerKey);
            const swapOnEnemy = pendingType === 'SWAP_WITH_ENEMY' && gameState.board[action.row][action.col] === -player;

            if (pendingType === 'SWAP_WITH_ENEMY') {
                if (swapOnEnemy) {
                    const swapped = CardLogic.applySwapEffect(cardState, gameState, playerKey, action.row, action.col);
                    events.push({ type: 'swap_selected', player: playerKey, row: action.row, col: action.col, swapped });
                    if (!swapped) {
                        throw new Error('SWAP_WITH_ENEMY: invalid target (protected/bomb?)');
                    }
                } else {
                    throw new Error('SWAP_WITH_ENEMY requires selecting an enemy stone before placement');
                }
            }

            if (swapOnEnemy) {
                originalCellVal = gameState.board[action.row][action.col];
                gameState.board[action.row][action.col] = Core.EMPTY;
            }

            const flips = Core.getFlipsWithContext(gameState, action.row, action.col, player, ctx);
            let flipCount = flips.length;

            if (swapOnEnemy) {
                gameState.board[action.row][action.col] = originalCellVal;
            }

            // For legality, require flips > 0 unless FREE_PLACEMENT pending
            const freePlacement = pendingType === 'FREE_PLACEMENT';
            if (flipCount === 0 && !freePlacement && !swapOnEnemy) {
                throw new Error('Illegal move: no flips and not free placement');
            }

            // Save pre-extra to determine if this placement consumes an existing extra place
            const preExtra = cardState.extraPlaceRemainingByPlayer[playerKey] || 0;

            if (BoardOps && typeof BoardOps.spawnAt === 'function') {
                BoardOps.spawnAt(cardState, gameState, action.row, action.col, playerKey, 'SYSTEM', 'standard_place');
                for (const [fr, fc] of flips) {
                    BoardOps.changeAt(cardState, gameState, fr, fc, playerKey, 'SYSTEM', 'standard_flip');
                }
                gameState.currentPlayer = -player;
                gameState.consecutivePasses = 0;
                gameState.turnNumber = (gameState.turnNumber || 0) + 1;
            } else {
                const newState = Core.applyMove(gameState, { row: action.row, col: action.col, flips });
                Object.assign(gameState, newState);
            }

            events.push({ type: 'place', player: playerKey, row: action.row, col: action.col, flips: flips.slice() });
            if (flips.length > 0 && typeof CardLogic.clearBombAt === 'function') {
                for (const [r, c] of flips) {
                    CardLogic.clearBombAt(cardState, r, c);
                }
            }
            if (flips.length > 0 && typeof CardLogic.clearHyperactiveAtPositions === 'function') {
                const flippedPositions = flips.map(([r, c]) => ({ row: r, col: c }));
                CardLogic.clearHyperactiveAtPositions(cardState, flippedPositions);
            }

            // REGEN handling immediately after primary flips
            if (flipCount > 0 && typeof CardLogic.applyRegenAfterFlips === 'function') {
                const regenRes = CardLogic.applyRegenAfterFlips(cardState, gameState, flips, playerKey);
                if (regenRes.regened && regenRes.regened.length) {
                    events.push({ type: 'regen_triggered', details: regenRes.regened });
                }
                if (regenRes.captureFlips && regenRes.captureFlips.length) {
                    flips.push(...regenRes.captureFlips.map(p2 => [p2.row, p2.col]));
                    flipCount = flips.length;
                    events.push({ type: 'regen_capture_flipped', details: regenRes.captureFlips });
                }
            }

            // CHAIN_WILL: apply extra flips after normal flips, before placement effects
            if (typeof CardLogic.applyChainWillAfterMove === 'function') {
                const chainRes = CardLogic.applyChainWillAfterMove(cardState, gameState, playerKey, flips, p);
                if (chainRes && chainRes.flips && chainRes.flips.length) {
                    flips.push(...chainRes.flips.map(pos => [pos.row, pos.col]));
                    flipCount = flips.length;
                    events.push({ type: 'chain_flipped', details: chainRes.flips });
                }

                // REGEN after chain flips
                if (chainRes && chainRes.flips && chainRes.flips.length && typeof CardLogic.applyRegenAfterFlips === 'function') {
                    const regenRes2 = CardLogic.applyRegenAfterFlips(cardState, gameState, chainRes.flips, playerKey);
                    if (regenRes2.regened && regenRes2.regened.length) {
                        events.push({ type: 'regen_triggered', details: regenRes2.regened });
                    }
                    if (regenRes2.captureFlips && regenRes2.captureFlips.length) {
                        flips.push(...regenRes2.captureFlips.map(p3 => [p3.row, p3.col]));
                        flipCount = flips.length;
                        events.push({ type: 'regen_capture_flipped', details: regenRes2.captureFlips });
                    }
                }
            }

            // 4) Apply placement effects (charge, special stones, etc.)
            const effects = CardLogic.applyPlacementEffects(cardState, gameState, playerKey, action.row, action.col, flipCount);
            events.push({ type: 'placement_effects', player: playerKey, effects });

            // GOLD/SILVER: the placed stone disappears on the opponent's next turn start.

            // Immediate activation on placement turn (spec): dragon/breeding fire immediately after normal flips.
            if (effects && effects.dragonPlaced && typeof CardLogic.processDragonEffectsAtAnchor === 'function') {
                const dragonNow = CardLogic.processDragonEffectsAtAnchor(cardState, gameState, playerKey, action.row, action.col);
                if (dragonNow.converted && dragonNow.converted.length) {
                    cardState.charge[playerKey] = Math.min(30, (cardState.charge[playerKey] || 0) + dragonNow.converted.length);
                    events.push({ type: 'dragon_converted_immediate', details: dragonNow.converted });
                }
            }
            if (effects && effects.breedingPlaced && typeof CardLogic.processBreedingEffectsAtAnchor === 'function') {
                const breedingNow = CardLogic.processBreedingEffectsAtAnchor(cardState, gameState, playerKey, action.row, action.col, p);
                if (breedingNow.spawned && breedingNow.spawned.length) {
                    events.push({ type: 'breeding_spawned_immediate', details: breedingNow.spawned });
                }
                if (breedingNow.flipped && breedingNow.flipped.length) {
                    cardState.charge[playerKey] = Math.min(30, (cardState.charge[playerKey] || 0) + breedingNow.flipped.length);
                    events.push({ type: 'breeding_flipped_immediate', details: breedingNow.flipped });
                }
            }
            if (effects && effects.ultimateDestroyGodPlaced && typeof CardLogic.processUltimateDestroyGodEffectsAtAnchor === 'function') {
                const udgNow = CardLogic.processUltimateDestroyGodEffectsAtAnchor(cardState, gameState, playerKey, action.row, action.col, { decrementRemainingOwnerTurns: false });
                if (udgNow.destroyed && udgNow.destroyed.length) {
                    events.push({ type: 'udg_destroyed_immediate', details: udgNow.destroyed });
                }
            }
            // NOTE: Per spec change (2026-01-26), hyperactive stones do NOT move on the placement turn.
            // Previous behavior ran an immediate hyperactive activation here; it has been removed so that
            // hyperactive moves only occur at turn-start processing (consistent and deterministic).
            if (effects && effects.hyperactivePlaced) {
                if (typeof console !== 'undefined' && console.log) console.log('[TurnPipeline] hyperactivePlaced detected on placement — immediate activation suppressed by spec');
            }

            // If preExtra > 0 then this placement consumes one extra place
            if (preExtra > 0) {
                cardState.extraPlaceRemainingByPlayer[playerKey] = Math.max(0, (cardState.extraPlaceRemainingByPlayer[playerKey] || 0) - 1);
                events.push({ type: 'extra_place_consumed', player: playerKey });
            }
        } else {
            throw new Error('Unknown action.type');
        }
    }

    return { applyTurnStartPhase, applyCardUsagePhase, applyActionPhase };
}));
