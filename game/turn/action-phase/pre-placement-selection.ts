type ResolvePrePlacementSelectionActionOptions = {
    CardLogic: any;
    cardState: any;
    gameState: any;
    playerKey: any;
    action: any;
    events: any[];
    prng: any;
    pending: any;
    createDestroyOutcome: (kindOrResult: any, details: any) => any;
    isDestroyOutcomeResolved: (result: any) => boolean;
    applyTrapEffectsAfterSelection: () => void;
    handOffTurnAfterSelection: () => void;
    emitDurationSelectionStatusTick: (target: any, reason: any, highlightTone: any) => void;
    emitHandRemovePresentation: (payload: any) => void;
    emitHandAddPresentation?: (payload: any) => void;
};

function resolvePrePlacementSelectionAction(options: ResolvePrePlacementSelectionActionOptions): any {
    const opts = (options && typeof options === 'object') ? options : ({} as ResolvePrePlacementSelectionActionOptions);
    const pending = opts.pending;
    const action = opts.action || {};
    const p = opts.prng || undefined;

    if (pending && pending.type === 'DESTROY_ONE_STONE' && action.destroyTarget) {
        const destroyResult = typeof opts.CardLogic.applyDestroyEffectDetailed === 'function'
            ? opts.CardLogic.applyDestroyEffectDetailed(
                opts.cardState,
                opts.gameState,
                opts.playerKey,
                action.destroyTarget.row,
                action.destroyTarget.col
            )
            : {
                destroyed: !!opts.CardLogic.applyDestroyEffect(
                    opts.cardState,
                    opts.gameState,
                    opts.playerKey,
                    action.destroyTarget.row,
                    action.destroyTarget.col
                )
            };
        const normalizedDestroyResult = opts.createDestroyOutcome(destroyResult, null);
        const applied = opts.isDestroyOutcomeResolved(normalizedDestroyResult);
        opts.events.push({
            type: 'destroy_selected',
            player: opts.playerKey,
            target: action.destroyTarget,
            applied,
            kind: normalizedDestroyResult && normalizedDestroyResult.kind ? normalizedDestroyResult.kind : null,
            destroyed: !!(normalizedDestroyResult && normalizedDestroyResult.destroyed),
            regenerated: !!(normalizedDestroyResult && normalizedDestroyResult.regenerated),
            evaded: !!(normalizedDestroyResult && normalizedDestroyResult.evaded),
            blockedByGhost: !!(normalizedDestroyResult && normalizedDestroyResult.blockedByGhost),
            proliferated: !!(normalizedDestroyResult && normalizedDestroyResult.proliferated),
            reason: normalizedDestroyResult && normalizedDestroyResult.reason ? normalizedDestroyResult.reason : null,
            from: normalizedDestroyResult && normalizedDestroyResult.from ? normalizedDestroyResult.from : null,
            to: normalizedDestroyResult && normalizedDestroyResult.to ? normalizedDestroyResult.to : null
        });
        opts.applyTrapEffectsAfterSelection();
        return {
            handled: true,
            generatedSpawnFlipResults: Array.isArray(normalizedDestroyResult && normalizedDestroyResult.generatedSpawnFlipResults)
                ? normalizedDestroyResult.generatedSpawnFlipResults
                : []
        };
    } else if (pending && pending.type === 'DESTROY_ONE_STONE' && action.destroyTarget == null) {
        throw new Error('DESTROY_ONE_STONE requires destroyTarget before placement');
    }

    if (pending && pending.type === 'REVERSE_WILL' && action.reverseWillTarget) {
        const res = opts.CardLogic.applyReverseWill(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.reverseWillTarget.row,
            action.reverseWillTarget.col
        );
        if (!res || res.applied !== true) {
            throw new Error('REVERSE_WILL: invalid target');
        }
        opts.events.push({
            type: 'reverse_will_flipped',
            player: opts.playerKey,
            owner: res && res.owner ? res.owner : null,
            target: action.reverseWillTarget,
            applied: !!(res && res.applied),
            details: res && Array.isArray(res.flipped) ? res.flipped.slice() : [],
            blocked: res && Array.isArray(res.blocked) ? res.blocked.slice() : [],
            blockedByGhost: !!(res && res.blockedByGhost),
            logicalFlipCount: Number.isInteger(res && res.logicalFlipCount) ? res.logicalFlipCount : 0,
            flipCount: Number.isInteger(res && res.flipCount) ? res.flipCount : 0
        });
        opts.applyTrapEffectsAfterSelection();
        return true;
    } else if (pending && pending.type === 'REVERSE_WILL' && action.reverseWillTarget == null) {
        throw new Error('REVERSE_WILL requires reverseWillTarget before placement');
    }

    if (pending && pending.type === 'STRONG_WIND_WILL' && action.strongWindTarget) {
        const res = opts.CardLogic.applyStrongWindWill(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.strongWindTarget.row,
            action.strongWindTarget.col,
            p
        );
        opts.events.push({
            type: 'strong_wind_selected',
            player: opts.playerKey,
            target: action.strongWindTarget,
            applied: !!(res && res.applied),
            from: res && res.from ? res.from : null,
            to: res && res.to ? res.to : null
        });
        opts.applyTrapEffectsAfterSelection();
        return true;
    } else if (pending && pending.type === 'STRONG_WIND_WILL' && action.strongWindTarget == null) {
        throw new Error('STRONG_WIND_WILL requires strongWindTarget before placement');
    }

    if (pending && pending.type === 'BUOYANCY_WILL' && action.buoyancyTarget) {
        const res = opts.CardLogic.applyBuoyancyWill(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.buoyancyTarget.row,
            action.buoyancyTarget.col
        );
        opts.events.push({
            type: 'buoyancy_selected',
            player: opts.playerKey,
            target: action.buoyancyTarget,
            applied: !!(res && res.applied),
            from: res && res.from ? res.from : null,
            to: res && res.to ? res.to : null,
            destroyed: res && Array.isArray(res.destroyed) ? res.destroyed.slice() : []
        });
        opts.applyTrapEffectsAfterSelection();
        return true;
    } else if (pending && pending.type === 'BUOYANCY_WILL' && action.buoyancyTarget == null) {
        throw new Error('BUOYANCY_WILL requires buoyancyTarget before placement');
    }

    if (pending && pending.type === 'SUPER_BUOYANCY_WILL' && action.superBuoyancyTarget) {
        const res = opts.CardLogic.applySuperBuoyancyWill(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.superBuoyancyTarget.row,
            action.superBuoyancyTarget.col
        );
        opts.events.push({
            type: 'super_buoyancy_selected',
            player: opts.playerKey,
            target: action.superBuoyancyTarget,
            applied: !!(res && res.applied),
            from: res && res.from ? res.from : null,
            to: res && res.to ? res.to : null,
            destroyed: res && Array.isArray(res.destroyed) ? res.destroyed.slice() : []
        });
        opts.applyTrapEffectsAfterSelection();
        return true;
    } else if (pending && pending.type === 'SUPER_BUOYANCY_WILL' && action.superBuoyancyTarget == null) {
        throw new Error('SUPER_BUOYANCY_WILL requires superBuoyancyTarget before placement');
    }

    if (pending && pending.type === 'GRAVITY_WILL' && action.gravityTarget) {
        const res = opts.CardLogic.applyGravityWill(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.gravityTarget.row,
            action.gravityTarget.col
        );
        opts.events.push({
            type: 'gravity_selected',
            player: opts.playerKey,
            target: action.gravityTarget,
            applied: !!(res && res.applied),
            from: res && res.from ? res.from : null,
            to: res && res.to ? res.to : null,
            destroyed: res && Array.isArray(res.destroyed) ? res.destroyed.slice() : []
        });
        opts.applyTrapEffectsAfterSelection();
        return true;
    } else if (pending && pending.type === 'GRAVITY_WILL' && action.gravityTarget == null) {
        throw new Error('GRAVITY_WILL requires gravityTarget before placement');
    }

    if (pending && pending.type === 'SUPER_GRAVITY_WILL' && action.superGravityTarget) {
        const res = opts.CardLogic.applySuperGravityWill(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.superGravityTarget.row,
            action.superGravityTarget.col
        );
        opts.events.push({
            type: 'super_gravity_selected',
            player: opts.playerKey,
            target: action.superGravityTarget,
            applied: !!(res && res.applied),
            from: res && res.from ? res.from : null,
            to: res && res.to ? res.to : null,
            destroyed: res && Array.isArray(res.destroyed) ? res.destroyed.slice() : []
        });
        opts.applyTrapEffectsAfterSelection();
        return true;
    } else if (pending && pending.type === 'SUPER_GRAVITY_WILL' && action.superGravityTarget == null) {
        throw new Error('SUPER_GRAVITY_WILL requires superGravityTarget before placement');
    }

    if (pending && pending.type === 'SUPER_ATTRACTION_WILL' && action.superAttractionTarget) {
        const res = opts.CardLogic.applySuperAttractionWill(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.superAttractionTarget.row,
            action.superAttractionTarget.col,
            p
        );
        opts.events.push({
            type: res && res.completed === false ? 'super_attraction_first_selected' : 'super_attraction_selected',
            player: opts.playerKey,
            target: action.superAttractionTarget,
            applied: !!(res && res.applied),
            completed: res && res.completed === false ? false : !!(res && res.applied),
            firstTarget: res && res.firstTarget ? res.firstTarget : null,
            from: res && res.from ? res.from : null,
            to: res && res.to ? res.to : null,
            destroyed: res && Array.isArray(res.destroyed) ? res.destroyed.slice() : [],
            selectedPathVariant: res && res.selectedPathVariant ? res.selectedPathVariant : null,
            pathCells: res && Array.isArray(res.pathCells) ? res.pathCells.slice() : [],
            segments: res && Array.isArray(res.segments) ? res.segments.slice() : [],
            waypoints: res && Array.isArray(res.waypoints) ? res.waypoints.slice() : []
        });
        opts.applyTrapEffectsAfterSelection();
        return true;
    } else if (pending && pending.type === 'SUPER_ATTRACTION_WILL' && action.superAttractionTarget == null) {
        throw new Error('SUPER_ATTRACTION_WILL requires superAttractionTarget before placement');
    }

    if (pending && (pending.type === 'TELEPORT_WILL' || pending.type === 'CELL_TELEPORT_WILL') && action.teleportTarget) {
        const res = pending.type === 'CELL_TELEPORT_WILL'
            ? opts.CardLogic.applyCellTeleportWill(
                opts.cardState,
                opts.gameState,
                opts.playerKey,
                action.teleportTarget.row,
                action.teleportTarget.col,
                p
            )
            : opts.CardLogic.applyTeleportWill(
                opts.cardState,
                opts.gameState,
                opts.playerKey,
                action.teleportTarget.row,
                action.teleportTarget.col,
                p
            );
        opts.events.push({
            type: 'teleport_selected',
            player: opts.playerKey,
            cardType: pending.type,
            target: action.teleportTarget,
            applied: !!(res && res.applied),
            from: res && res.from ? res.from : null,
            to: res && res.to ? res.to : null,
            createdDestination: !!(res && res.createdDestination)
        });
        opts.applyTrapEffectsAfterSelection();
        return true;
    } else if (pending && (pending.type === 'TELEPORT_WILL' || pending.type === 'CELL_TELEPORT_WILL') && action.teleportTarget == null) {
        throw new Error(`${pending.type} requires teleportTarget before placement`);
    }

    if (pending && pending.type === 'HEAVEN_BLESSING' && action.heavenBlessingCardId) {
        const res = opts.CardLogic.applyHeavenBlessingChoice(
            opts.cardState,
            opts.playerKey,
            action.heavenBlessingCardId
        );
        opts.events.push({
            type: 'heaven_blessing_selected',
            player: opts.playerKey,
            selectedCardId: action.heavenBlessingCardId,
            applied: !!(res && res.applied)
        });
        return true;
    } else if (pending && pending.type === 'HEAVEN_BLESSING' && action.heavenBlessingCardId == null) {
        throw new Error('HEAVEN_BLESSING requires heavenBlessingCardId before placement');
    }

    if (pending && pending.type === 'CONDEMN_WILL' && action.condemnTargetIndex != null) {
        const res = opts.CardLogic.applyCondemnWill(
            opts.cardState,
            opts.playerKey,
            action.condemnTargetIndex
        );
        opts.events.push({
            type: 'condemn_selected',
            player: opts.playerKey,
            condemnTargetIndex: action.condemnTargetIndex,
            applied: !!(res && res.applied),
            destroyedCardId: (res && res.destroyedCardId) ? res.destroyedCardId : null
        });
        if (!res || !res.applied) {
            throw new Error(`CONDEMN_WILL selection failed: ${(res && res.reason) || 'invalid_target'}`);
        }
        if (res && res.applied) {
            const opponentKey = opts.playerKey === 'black' ? 'white' : 'black';
            opts.emitHandRemovePresentation({
                player: opponentKey,
                count: 1,
                reason: 'condemn_will',
                cardId: (res && res.destroyedCardId) ? res.destroyedCardId : null,
                cardIds: (res && res.destroyedCardId) ? [res.destroyedCardId] : []
            });
        }
        return true;
    } else if (pending && pending.type === 'CONDEMN_WILL' && action.condemnTargetIndex == null) {
        throw new Error('CONDEMN_WILL requires condemnTargetIndex before placement');
    }

    if (pending && pending.type === 'OBSERVER_WILL' && action.observerWillTargetIndex != null) {
        const res = opts.CardLogic.applyObserverWillChoice(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.observerWillTargetIndex
        );
        opts.events.push({
            type: 'observer_will_selected',
            player: opts.playerKey,
            observerWillTargetIndex: action.observerWillTargetIndex,
            applied: !!(res && res.applied),
            stolenCardId: (res && res.stolenCardId) ? res.stolenCardId : null,
            stolenCardCopyId: (res && Number.isInteger(res.stolenCardCopyId)) ? res.stolenCardCopyId : null,
            repaymentAmount: (res && Number.isFinite(res.repaymentAmount)) ? Number(res.repaymentAmount) : null
        });
        if (!res || !res.applied) {
            throw new Error(`OBSERVER_WILL selection failed: ${(res && res.reason) || 'invalid_target'}`);
        }
        if (res && res.applied) {
            const opponentKey = opts.playerKey === 'black' ? 'white' : 'black';
            opts.emitHandRemovePresentation({
                player: opponentKey,
                count: 1,
                reason: 'observer_will',
                cardId: (res && res.stolenCardId) ? res.stolenCardId : null,
                cardIds: (res && res.stolenCardId) ? [res.stolenCardId] : []
            });
            if (typeof opts.emitHandAddPresentation === 'function') {
                opts.emitHandAddPresentation({
                    player: opts.playerKey,
                    count: 1,
                    reason: 'observer_will',
                    cardId: res.stolenCardId || null,
                    meta: {
                        sourceType: 'OBSERVER_WILL',
                        sourceCardId: pending.cardId || null
                    }
                });
            }
        }
        return true;
    } else if (pending && pending.type === 'OBSERVER_WILL' && action.observerWillTargetIndex == null) {
        throw new Error('OBSERVER_WILL requires observerWillTargetIndex before placement');
    }

    if (pending && pending.type === 'TEMPT_WILL' && action.temptTarget) {
        const res = opts.CardLogic.applyTemptWill(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.temptTarget.row,
            action.temptTarget.col
        );
        opts.events.push({
            type: 'tempt_selected',
            player: opts.playerKey,
            target: action.temptTarget,
            applied: !!(res && res.applied),
            blockedByGhost: !!(res && res.blockedByGhost)
        });
        opts.applyTrapEffectsAfterSelection();
        return true;
    } else if (pending && pending.type === 'TEMPT_WILL' && action.temptTarget == null) {
        throw new Error('TEMPT_WILL requires temptTarget before placement');
    }

    if (pending && pending.type === 'CAPTURE_WILL' && action.captureTarget) {
        const res = opts.CardLogic.applyCaptureWill(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.captureTarget.row,
            action.captureTarget.col
        );
        opts.events.push({
            type: 'capture_selected',
            player: opts.playerKey,
            target: action.captureTarget,
            applied: !!(res && res.applied),
            blockedByGhost: !!(res && res.blockedByGhost),
            capturedCardId: (res && res.capturedCardId) ? res.capturedCardId : null,
            capturedCardType: (res && res.capturedCardType) ? res.capturedCardType : null,
            capturedCardName: (res && res.capturedCardName) ? res.capturedCardName : null,
            sourceSpecialType: (res && res.sourceSpecialType) ? res.sourceSpecialType : null,
            insertIndex: (res && Number.isInteger(res.insertIndex)) ? res.insertIndex : null
        });
        opts.applyTrapEffectsAfterSelection();
        return true;
    } else if (pending && pending.type === 'CAPTURE_WILL' && action.captureTarget == null) {
        throw new Error('CAPTURE_WILL requires captureTarget before placement');
    }

    if (pending && pending.type === 'SWAP_WITH_ENEMY' && action.swapTarget) {
        const swapped = opts.CardLogic.applySwapEffect(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.swapTarget.row,
            action.swapTarget.col
        );
        opts.events.push({ type: 'swap_selected', player: opts.playerKey, row: action.swapTarget.row, col: action.swapTarget.col, swapped });
        if (!swapped) {
            throw new Error('SWAP_WITH_ENEMY: invalid target (protected/bomb?)');
        }
        opts.applyTrapEffectsAfterSelection();
        opts.handOffTurnAfterSelection();
        return true;
    } else if (pending && pending.type === 'SWAP_WITH_ENEMY' && action.swapTarget == null) {
        const hasLegacyBoardClickTarget = Number.isInteger(action.row) && Number.isInteger(action.col);
        if (!hasLegacyBoardClickTarget) {
            throw new Error('SWAP_WITH_ENEMY requires swapTarget before placement');
        }
        return false;
    }

    if (pending && pending.type === 'POSITION_SWAP_WILL' && action.positionSwapTarget) {
        const res = opts.CardLogic.applyPositionSwapWill(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.positionSwapTarget.row,
            action.positionSwapTarget.col
        );
        opts.events.push({
            type: res && res.completed ? 'position_swap_selected' : 'position_swap_first_selected',
            player: opts.playerKey,
            target: action.positionSwapTarget,
            from: res && res.from ? res.from : (res && res.firstTarget ? res.firstTarget : null),
            to: res && res.to ? res.to : null,
            applied: !!(res && res.applied),
            completed: !!(res && res.completed)
        });
        opts.applyTrapEffectsAfterSelection();
        return true;
    } else if (pending && pending.type === 'POSITION_SWAP_WILL' && action.positionSwapTarget == null) {
        throw new Error('POSITION_SWAP_WILL requires positionSwapTarget before placement');
    }

    if (pending && pending.type === 'TRAP_WILL' && action.trapTarget) {
        const res = opts.CardLogic.applyTrapWill(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.trapTarget.row,
            action.trapTarget.col
        );
        opts.events.push({ type: 'trap_selected', player: opts.playerKey, applied: !!(res && res.applied) });
        if (res && res.applied) {
            opts.handOffTurnAfterSelection();
        }
        return true;
    } else if (pending && pending.type === 'TRAP_WILL' && action.trapTarget == null) {
        throw new Error('TRAP_WILL requires trapTarget before placement');
    }

    if (pending && (pending.type === 'GUARD_WILL' || pending.type === 'GUARDIAN_GOD') && action.guardTarget) {
        const res = opts.CardLogic.applyGuardWill(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.guardTarget.row,
            action.guardTarget.col
        );
        opts.events.push({ type: 'guard_selected', player: opts.playerKey, target: action.guardTarget, applied: !!(res && res.applied) });
        return true;
    } else if (pending && (pending.type === 'GUARD_WILL' || pending.type === 'GUARDIAN_GOD') && action.guardTarget == null) {
        throw new Error('GUARD-like card requires guardTarget before placement');
    }

    if (pending && pending.type === 'LIVING_WILL' && action.livingWillTarget) {
        const res = opts.CardLogic.applyLivingWill(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.livingWillTarget.row,
            action.livingWillTarget.col
        );
        opts.events.push({ type: 'living_will_selected', player: opts.playerKey, target: action.livingWillTarget, applied: !!(res && res.applied) });
        return true;
    } else if (pending && pending.type === 'LIVING_WILL' && action.livingWillTarget == null) {
        throw new Error('LIVING_WILL requires livingWillTarget before placement');
    }

    if (pending && (pending.type === 'EXTEND_LIFE_WILL' || pending.type === 'EXTEND_LIFE_GOD') && action.extendTarget) {
        const applyExtendLife = pending.type === 'EXTEND_LIFE_GOD'
            ? opts.CardLogic.applyExtendLifeGod
            : opts.CardLogic.applyExtendLifeWill;
        const res = applyExtendLife(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.extendTarget.row,
            action.extendTarget.col
        );
        opts.events.push({
            type: 'extend_life_selected',
            player: opts.playerKey,
            target: action.extendTarget,
            applied: !!(res && res.applied),
            cardType: pending.type,
            multiplier: res && Number.isFinite(res.multiplier) ? Number(res.multiplier) : (pending.type === 'EXTEND_LIFE_GOD' ? 4 : 2),
            details: res ? { previous: res.previousRemainingOwnerTurns, current: res.newRemainingOwnerTurns } : null
        });
        if (res && res.applied) {
            opts.emitDurationSelectionStatusTick(action.extendTarget, 'extend_life_applied', 'positive');
        }
        return true;
    } else if (pending && (pending.type === 'EXTEND_LIFE_WILL' || pending.type === 'EXTEND_LIFE_GOD') && action.extendTarget == null) {
        throw new Error(`${pending.type} requires extendTarget before placement`);
    }

    if (pending && pending.type === 'CORROSION_WILL' && action.corrosionTarget) {
        const res = opts.CardLogic.applyCorrosionWill(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.corrosionTarget.row,
            action.corrosionTarget.col
        );
        opts.events.push({
            type: 'corrosion_will_resolved',
            player: opts.playerKey,
            target: action.corrosionTarget,
            applied: !!(res && res.applied),
            affectedCount: Number(res && res.affectedCount) || 0,
            details: Array.isArray(res && res.details) ? res.details : []
        });
        if (res && res.applied && Number(res.affectedCount) > 0) {
            opts.emitDurationSelectionStatusTick(action.corrosionTarget, 'corrosion_applied', 'negative');
        }
        return true;
    } else if (pending && pending.type === 'CORROSION_WILL' && action.corrosionTarget == null) {
        throw new Error('CORROSION_WILL requires corrosionTarget before placement');
    }

    if (pending && pending.type === 'TIME_BOMB' && action.bombTarget) {
        const res = opts.CardLogic.applyTimeBombWill(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.bombTarget.row,
            action.bombTarget.col
        );
        opts.events.push({ type: 'time_bomb_selected', player: opts.playerKey, target: action.bombTarget, applied: !!(res && res.applied) });
        return true;
    } else if (pending && pending.type === 'TIME_BOMB' && action.bombTarget == null) {
        throw new Error('TIME_BOMB requires bombTarget before placement');
    }

    if (pending && pending.type === 'CLONE_WILL' && action.cloneTarget) {
        const res = opts.CardLogic.applyCloneWill(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.cloneTarget.row,
            action.cloneTarget.col,
            p
        );
        opts.events.push({
            type: 'clone_selected',
            player: opts.playerKey,
            target: action.cloneTarget,
            applied: !!(res && res.applied),
            details: (res && Array.isArray(res.spawned)) ? res.spawned : [],
            spawned: (res && Array.isArray(res.spawned)) ? res.spawned : [],
            flipped: (res && Array.isArray(res.flipped)) ? res.flipped : []
        });
        return { handled: true, immediateFlipResult: res, immediateFlipSourceType: 'clone_will_selection' };
    } else if (pending && pending.type === 'CLONE_WILL' && action.cloneTarget == null) {
        throw new Error('CLONE_WILL requires cloneTarget before placement');
    }

    if (pending && (pending.type === 'BOARD_EXPANSION_WILL' || pending.type === 'BOARD_EXPANSION_GOD') && action.expansionTarget) {
        const isGodExpansion = pending.type === 'BOARD_EXPANSION_GOD';
        const applyFn = (isGodExpansion && typeof opts.CardLogic.applyBoardExpansionGod === 'function')
            ? opts.CardLogic.applyBoardExpansionGod
            : opts.CardLogic.applyBoardExpansionWill;
        const res = applyFn(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.expansionTarget.row,
            action.expansionTarget.col
        );
        if (isGodExpansion && res && res.applied && res.completed === false) {
            opts.events.push({
                type: 'board_expansion_first_selected',
                player: opts.playerKey,
                cardType: pending.type,
                target: action.expansionTarget,
                selectedCount: Number(res.selectedCount) || 1,
                maxSelections: Number(res.maxSelections) || 2,
                remainingSelections: Number(res.remainingSelections) || 1,
                selectedTargets: Array.isArray(res.selectedTargets) ? res.selectedTargets : null,
                applied: true,
                completed: false
            });
        } else {
            opts.events.push({
                type: 'board_expansion_selected',
                player: opts.playerKey,
                cardType: pending.type,
                target: action.expansionTarget,
                side: res && res.side ? res.side : null,
                row: res && Number.isInteger(res.row) ? res.row : null,
                added: (res && Array.isArray(res.added)) ? res.added : null,
                selectedTargets: (res && Array.isArray(res.selectedTargets)) ? res.selectedTargets : null,
                sources: (res && Array.isArray(res.sources)) ? res.sources : null,
                applied: !!(res && res.applied),
                completed: !(res && res.completed === false)
            });
        }
        return true;
    } else if (pending && (pending.type === 'BOARD_EXPANSION_WILL' || pending.type === 'BOARD_EXPANSION_GOD') && action.expansionTarget == null) {
        throw new Error(`${pending.type} requires expansionTarget before placement`);
    }

    if (pending && (pending.type === 'BOARD_SHRINK_WILL' || pending.type === 'BOARD_SHRINK_GOD') && action.shrinkTarget) {
        const isGodShrink = pending.type === 'BOARD_SHRINK_GOD';
        const applyFn = (isGodShrink && typeof opts.CardLogic.applyBoardShrinkGod === 'function')
            ? opts.CardLogic.applyBoardShrinkGod
            : opts.CardLogic.applyBoardShrinkWill;
        const res = applyFn(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.shrinkTarget.row,
            action.shrinkTarget.col
        );
        opts.events.push({
            type: 'board_shrink_selected',
            player: opts.playerKey,
            cardType: pending.type,
            target: action.shrinkTarget,
            firstTarget: res && res.firstTarget ? res.firstTarget : null,
            selectedCount: Number.isFinite(Number(res && res.selectedCount)) ? Number(res.selectedCount) : null,
            maxSelections: Number.isFinite(Number(res && res.maxSelections)) ? Number(res.maxSelections) : null,
            remainingSelections: Number.isFinite(Number(res && res.remainingSelections)) ? Number(res.remainingSelections) : null,
            selectedTargets: (res && Array.isArray(res.selectedTargets)) ? res.selectedTargets : null,
            lineTargets: (res && Array.isArray(res.lineTargets)) ? res.lineTargets : null,
            changedTargets: (res && Array.isArray(res.changedTargets)) ? res.changedTargets : null,
            skippedTargets: (res && Array.isArray(res.skippedTargets)) ? res.skippedTargets : null,
            applied: !!(res && res.applied),
            completed: !(res && res.completed === false)
        });
        return true;
    } else if (pending && (pending.type === 'BOARD_SHRINK_WILL' || pending.type === 'BOARD_SHRINK_GOD') && action.shrinkTarget == null) {
        throw new Error(`${pending.type} requires shrinkTarget before placement`);
    }

    if (pending && pending.type === 'BLOCKADE_WILL' && action.blockadeTarget) {
        const res = opts.CardLogic.applyBlockadeWill(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.blockadeTarget.row,
            action.blockadeTarget.col
        );
        opts.events.push({ type: 'blockade_selected', player: opts.playerKey, target: action.blockadeTarget, applied: !!(res && res.applied) });
        return true;
    } else if (pending && pending.type === 'BLOCKADE_WILL' && action.blockadeTarget == null) {
        throw new Error('BLOCKADE_WILL requires blockadeTarget before placement');
    }

    if (pending && pending.type === 'METEOR_WILL' && action.meteorTarget) {
        const res = opts.CardLogic.applyMeteorWill(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.meteorTarget.row,
            action.meteorTarget.col,
            p
        );
        opts.events.push({
            type: 'meteor_selected',
            player: opts.playerKey,
            target: action.meteorTarget,
            applied: !!(res && res.applied),
            destroyed: !!(res && res.destroyed)
        });
        return true;
    } else if (pending && pending.type === 'METEOR_WILL' && action.meteorTarget == null) {
        throw new Error('METEOR_WILL requires meteorTarget before placement');
    }

    if (pending && pending.type === 'FREEZE_WILL' && action.freezeTarget) {
        const res = opts.CardLogic.applyFreezeWill(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.freezeTarget.row,
            action.freezeTarget.col
        );
        opts.events.push({ type: 'freeze_selected', player: opts.playerKey, target: action.freezeTarget, applied: !!(res && res.applied) });
        return true;
    } else if (pending && pending.type === 'FREEZE_WILL' && action.freezeTarget == null) {
        throw new Error('FREEZE_WILL requires freezeTarget before placement');
    }

    if (pending && pending.type === 'SEED_WILL' && action.seedTarget) {
        const res = opts.CardLogic.applySeedWill(
            opts.cardState,
            opts.gameState,
            opts.playerKey,
            action.seedTarget.row,
            action.seedTarget.col
        );
        opts.events.push({ type: 'seed_selected', player: opts.playerKey, target: action.seedTarget, applied: !!(res && res.applied) });
        return true;
    } else if (pending && pending.type === 'SEED_WILL' && action.seedTarget == null) {
        throw new Error('SEED_WILL requires seedTarget before placement');
    }

    return false;
}

const ActionPhasePrePlacementSelectionModule = {
    resolvePrePlacementSelectionAction
};

try {
    const root = (typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : null)) as any;
    if (root && !root.TurnActionPhasePrePlacementSelection) {
        root.TurnActionPhasePrePlacementSelection = ActionPhasePrePlacementSelectionModule;
    }
} catch (e) { /* ignore global registration fallback */ }

export = ActionPhasePrePlacementSelectionModule;
