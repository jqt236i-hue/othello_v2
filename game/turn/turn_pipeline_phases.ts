declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

    const TURN_PIPELINE_PHASE_MODULE_GLOBALS: Record<string, string> = Object.freeze({
        '../logic/markers_adapter': 'MarkersAdapter',
        '../logic/cards/utils': 'CardUtils',
        '../logic/context': 'CardContext',
        '../../shared-constants': 'SharedConstants',
        '../../shared/shared-board-utils': 'SharedBoardUtils',
        '../../utils/owner-helpers': 'OwnerHelpers',
        '../../shared/destroy-outcome-contract': 'DestroyOutcomeContract',
        './turn_pipeline_phase_helpers': 'TurnPipelinePhaseHelpers',
        './pending-coordinator': 'TurnPendingCoordinator',
        './sub-placement-continuation': 'TurnSubPlacementContinuation',
        './action-phase/continuation': 'TurnActionPhaseContinuation',
        './action-phase/placement-effects': 'TurnActionPhasePlacementEffects',
        './card-usage/immediate-effects': 'TurnCardUsageImmediateEffects',
        './board-charge': 'TurnBoardCharge',
        './presentation-helpers': 'TurnPresentationHelpers',
        './round-state': 'TurnRoundState',
        './action-phase/pre-placement-selection': 'TurnActionPhasePrePlacementSelection',
        './action-phase/place-resolution': 'TurnActionPhasePlaceResolution',
        './action-phase/placement-immediate-effects': 'TurnActionPhasePlacementImmediateEffects',
        './action-phase/turn-handoff': 'TurnActionPhaseTurnHandoff',
        './phase-presentation-finalizer': 'TurnPhasePresentationFinalizer',
        './turn-start/marker-phase': 'TurnStartMarkerPhase',
        './turn-start/post-processing': 'TurnStartPostProcessing',
        './turn-start/timer-phase': 'TurnStartTimerPhase',
        './theory-spawn-resolution': 'TurnTheorySpawnResolution'
    });

    const TURN_PIPELINE_PHASE_STATIC_MODULE_LOADERS: Record<string, () => any> = Object.freeze({
        '../logic/markers_adapter': () => require('../logic/markers_adapter'),
        '../logic/cards/utils': () => require('../logic/cards/utils'),
        '../logic/context': () => require('../logic/context'),
        '../../shared-constants': () => require('../../shared-constants'),
        '../../shared/shared-board-utils': () => require('../../shared/shared-board-utils'),
        '../../utils/owner-helpers': () => require('../../utils/owner-helpers'),
        '../../shared/destroy-outcome-contract': () => require('../../shared/destroy-outcome-contract'),
        './turn_pipeline_phase_helpers': () => require('./turn_pipeline_phase_helpers'),
        './pending-coordinator': () => require('./pending-coordinator'),
        './sub-placement-continuation': () => require('./sub-placement-continuation'),
        './action-phase/continuation': () => require('./action-phase/continuation'),
        './action-phase/placement-effects': () => require('./action-phase/placement-effects'),
        './card-usage/immediate-effects': () => require('./card-usage/immediate-effects'),
        './board-charge': () => require('./board-charge'),
        './presentation-helpers': () => require('./presentation-helpers'),
        './round-state': () => require('./round-state'),
        './action-phase/pre-placement-selection': () => require('./action-phase/pre-placement-selection'),
        './action-phase/place-resolution': () => require('./action-phase/place-resolution'),
        './action-phase/placement-immediate-effects': () => require('./action-phase/placement-immediate-effects'),
        './action-phase/turn-handoff': () => require('./action-phase/turn-handoff'),
        './phase-presentation-finalizer': () => require('./phase-presentation-finalizer'),
        './turn-start/marker-phase': () => require('./turn-start/marker-phase'),
        './turn-start/post-processing': () => require('./turn-start/post-processing'),
        './turn-start/timer-phase': () => require('./turn-start/timer-phase'),
        './theory-spawn-resolution': () => require('./theory-spawn-resolution')
    });

    function getRuntimeModuleGlobal(globalKey: string): any {
        if (!globalKey) return null;
        try {
            if (typeof self !== 'undefined' && (self as any)[globalKey]) {
                return (self as any)[globalKey];
            }
            if (typeof globalThis !== 'undefined' && (globalThis as any)[globalKey]) {
                return (globalThis as any)[globalKey];
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function unwrapOptionalModule(value: any, depth = 0): any {
        if (!value || typeof value !== 'object' || depth > 5) return value;
        if (value['module.exports'] && value['module.exports'] !== value) {
            return unwrapOptionalModule(value['module.exports'], depth + 1);
        }
        if (value.default && value.default !== value) {
            return unwrapOptionalModule(value.default, depth + 1);
        }
        return value;
    }

    function hasUsableOptionalModule(value: any): boolean {
        if (!value) return false;
        if (typeof value === 'function') return true;
        if (typeof value !== 'object') return true;
        return Object.keys(value).some((key) => key !== '__esModule');
    }

    function requireOptionalModule(id: string): any {
        const staticLoader = TURN_PIPELINE_PHASE_STATIC_MODULE_LOADERS[id];
        if (typeof staticLoader === 'function') {
            try {
                const staticModule = unwrapOptionalModule(staticLoader());
                if (hasUsableOptionalModule(staticModule)) return staticModule;
            } catch (e) { /* fall through to runtime require/global fallback */ }
        }
        try {
            const requiredModule = unwrapOptionalModule(_require(id));
            if (hasUsableOptionalModule(requiredModule)) return requiredModule;
        } catch (e) {
            /* fall through to global fallback */
        }
        return unwrapOptionalModule(getRuntimeModuleGlobal(TURN_PIPELINE_PHASE_MODULE_GLOBALS[id]));
    }

    const MarkersAdapter = requireOptionalModule('../logic/markers_adapter');
    const MARKER_KINDS = MarkersAdapter && MarkersAdapter.MARKER_KINDS;
    function isBombCategoryMarker(marker: any) {
        if (MarkersAdapter && typeof MarkersAdapter.isBombCategoryMarker === 'function') {
            return MarkersAdapter.isBombCategoryMarker(marker);
        }
        return !!(
            marker &&
            marker.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') &&
            marker.data &&
            marker.data.category === 'bomb'
        );
    }
    const CardUtilsModule = requireOptionalModule('../logic/cards/utils');
    const SharedConstantsModule = requireOptionalModule('../../shared-constants');
    const SharedBoardUtils = requireOptionalModule('../../shared/shared-board-utils');
    const OwnerHelpersModule = requireOptionalModule('../../utils/owner-helpers');
    const DestroyOutcomeContract = requireOptionalModule('../../shared/destroy-outcome-contract');
    const DESTROY_OUTCOME_KINDS = (DestroyOutcomeContract && DestroyOutcomeContract.DESTROY_OUTCOME_KINDS) || Object.freeze({
        DESTROYED: 'destroyed',
        REGENERATED: 'regenerated',
        LIVING_WILL_RESTORED: 'living_will_restored',
        GHOST_BLOCKED: 'ghost_blocked',
        PROLIFERATED: 'proliferated',
        EVADED_MOVE: 'evaded_move'
    });

    function createDestroyOutcome(kindOrResult: any, details: any) {
        if (DestroyOutcomeContract && typeof DestroyOutcomeContract.createDestroyOutcome === 'function') {
            return DestroyOutcomeContract.createDestroyOutcome(kindOrResult, details);
        }
        const source = (typeof kindOrResult === 'string')
            ? Object.assign({}, (details && typeof details === 'object') ? details : {}, { kind: kindOrResult })
            : Object.assign({}, (kindOrResult && typeof kindOrResult === 'object') ? kindOrResult : {});
        const kind = (source && source.kind) || (
            source && source.livingWillRevived ? DESTROY_OUTCOME_KINDS.LIVING_WILL_RESTORED
                : source && source.regenerated ? DESTROY_OUTCOME_KINDS.REGENERATED
                : source && source.proliferated ? DESTROY_OUTCOME_KINDS.PROLIFERATED
                : source && source.blockedByGhost ? DESTROY_OUTCOME_KINDS.GHOST_BLOCKED
                    : source && source.evaded ? DESTROY_OUTCOME_KINDS.EVADED_MOVE
                        : source && source.destroyed ? DESTROY_OUTCOME_KINDS.DESTROYED
                            : null
        );
        const outcome = Object.assign({}, source, {
            destroyed: kind === DESTROY_OUTCOME_KINDS.DESTROYED || source.destroyed === true,
            regenerated: kind === DESTROY_OUTCOME_KINDS.REGENERATED || source.regenerated === true,
            livingWillRevived: kind === DESTROY_OUTCOME_KINDS.LIVING_WILL_RESTORED || source.livingWillRevived === true,
            evaded: kind === DESTROY_OUTCOME_KINDS.EVADED_MOVE || source.evaded === true,
            blockedByGhost: kind === DESTROY_OUTCOME_KINDS.GHOST_BLOCKED || source.blockedByGhost === true,
            proliferated: kind === DESTROY_OUTCOME_KINDS.PROLIFERATED || source.proliferated === true
        });
        if (kind) outcome.kind = kind;
        if (outcome.to && typeof outcome.destination === 'undefined') outcome.destination = outcome.to;
        if (outcome.from && typeof outcome.source === 'undefined') outcome.source = outcome.from;
        return outcome;
    }

    function isDestroyOutcomeResolved(result: any) {
        if (DestroyOutcomeContract && typeof DestroyOutcomeContract.isDestroyOutcomeResolved === 'function') {
            return DestroyOutcomeContract.isDestroyOutcomeResolved(result);
        }
        return !!(result && (result.destroyed || result.regenerated || result.livingWillRevived || result.evaded || result.blockedByGhost || result.proliferated));
    }

    function applyPostFlipRevives(CardLogic: any, cardState: any, gameState: any, flips: any, ownerKey: any) {
        if (CardLogic && typeof CardLogic.applyPostFlipRevives === 'function') {
            return CardLogic.applyPostFlipRevives(cardState, gameState, flips, ownerKey);
        }
        const regenRes = (CardLogic && typeof CardLogic.applyRegenAfterFlips === 'function')
            ? CardLogic.applyRegenAfterFlips(cardState, gameState, flips, ownerKey)
            : { regened: [], captureFlips: [] };
        const livingWillInputs: any[] = [
            ...(Array.isArray(flips) ? flips : []),
            ...(regenRes && Array.isArray(regenRes.captureFlips) ? regenRes.captureFlips : [])
        ];
        const livingWillRes = (CardLogic && typeof CardLogic.applyLivingWillAfterFlips === 'function')
            ? CardLogic.applyLivingWillAfterFlips(cardState, gameState, livingWillInputs, ownerKey)
            : { restored: [] };
        return { regenRes, livingWillRes };
    }

    function resolveGeneratedSpawnFlipSourceType(result: any, phase: 'immediate' | 'turn_start'): string {
        const cause = String(result && result.cause ? result.cause : '').toUpperCase();
        if (phase === 'turn_start') {
            if (cause === 'SEED_WILL') return 'seed_turn_start';
            if (cause === 'PROLIFERATION_WILL') return 'proliferation_turn_start';
            if (cause === 'STONE_SALVATION_GOD') return 'stone_salvation_god_turn_start';
            return 'generated_spawn_turn_start';
        }
        if (cause === 'CLONE_WILL') return 'clone_will_selection';
        if (cause === 'PROLIFERATION_WILL') return 'proliferation_immediate';
        if (cause === 'STONE_SALVATION_GOD') return 'stone_salvation_god_immediate';
        return 'generated_spawn_immediate';
    }

    function applyGeneratedSpawnFlipResultsImmediate(CardLogic: any, cardState: any, gameState: any, events: any[], results: any[]) {
        const entries = Array.isArray(results) ? results : [];
        for (const result of entries) {
            const flipped = Array.isArray(result && result.flipped) ? result.flipped : [];
            if (!flipped.length) continue;
            const ownerKey = result && result.ownerKey === 'white' ? 'white' : 'black';
            const reviveRes = applyPostFlipRevives(CardLogic, cardState, gameState, flipped, ownerKey);
            const regenRes = reviveRes.regenRes;
            const livingWillRes = reviveRes.livingWillRes;
            if (regenRes && regenRes.regened && regenRes.regened.length) {
                events.push({ type: 'regen_triggered', details: regenRes.regened });
            }
            if (regenRes && regenRes.captureFlips && regenRes.captureFlips.length) {
                if (typeof CardLogic.clearHyperactiveAtPositions === 'function') {
                    CardLogic.clearHyperactiveAtPositions(cardState, regenRes.captureFlips);
                }
                const firstCapture = regenRes.captureFlips[0] || {};
                awardBoardChargeGain(CardLogic, cardState, ownerKey, regenRes.captureFlips.length, {
                    targetRow: firstCapture.row,
                    targetCol: firstCapture.col,
                    sourceType: 'regen_capture_immediate'
                });
                events.push({ type: 'regen_capture_flipped', details: regenRes.captureFlips });
            }
            if (livingWillRes && livingWillRes.restored && livingWillRes.restored.length) {
                events.push({ type: 'living_will_triggered', details: livingWillRes.restored });
            }
            const firstFlip = flipped[0] || {};
            awardBoardChargeGain(CardLogic, cardState, ownerKey, flipped.length, {
                targetRow: firstFlip.row,
                targetCol: firstFlip.col,
                sourceType: resolveGeneratedSpawnFlipSourceType(result, 'immediate')
            });
        }
    }

    function applyGeneratedSpawnFlipResultsTurnStart(CardLogic: any, cardState: any, gameState: any, events: any[], results: any[]) {
        const entries = Array.isArray(results) ? results : [];
        for (const result of entries) {
            const flipped = Array.isArray(result && result.flipped) ? result.flipped : [];
            if (!flipped.length) continue;
            const ownerKey = result && result.ownerKey === 'white' ? 'white' : 'black';
            const reviveRes = applyPostFlipRevives(CardLogic, cardState, gameState, flipped, ownerKey);
            const regenRes = reviveRes.regenRes;
            const livingWillRes = reviveRes.livingWillRes;
            if (regenRes && regenRes.regened && regenRes.regened.length) {
                events.push({ type: 'regen_triggered_start', details: regenRes.regened });
            }
            if (regenRes && regenRes.captureFlips && regenRes.captureFlips.length) {
                if (typeof CardLogic.clearHyperactiveAtPositions === 'function') {
                    CardLogic.clearHyperactiveAtPositions(cardState, regenRes.captureFlips);
                }
                const firstCapture = regenRes.captureFlips[0] || {};
                awardBoardChargeGain(CardLogic, cardState, ownerKey, regenRes.captureFlips.length, {
                    targetRow: firstCapture.row,
                    targetCol: firstCapture.col,
                    sourceType: 'regen_capture_turn_start'
                });
                events.push({ type: 'regen_capture_flipped_start', details: regenRes.captureFlips });
            }
            if (livingWillRes && livingWillRes.restored && livingWillRes.restored.length) {
                events.push({ type: 'living_will_triggered_start', details: livingWillRes.restored });
            }
            const firstFlip = flipped[0] || {};
            awardBoardChargeGain(CardLogic, cardState, ownerKey, flipped.length, {
                targetRow: firstFlip.row,
                targetCol: firstFlip.col,
                sourceType: resolveGeneratedSpawnFlipSourceType(result, 'turn_start')
            });
        }
    }

    function normalizePendingTypeForActionPhase(pendingType: any) {
        return String(pendingType || '').trim().toUpperCase();
    }

    function matchesPendingTypeForActionPhase(pending: any, expectedType: any) {
        const normalizedPendingType = normalizePendingTypeForActionPhase(pending && pending.type);
        if (!normalizedPendingType) return false;
        const expectedTypes = Array.isArray(expectedType) ? expectedType : [expectedType];
        return expectedTypes.some((type: any) => normalizePendingTypeForActionPhase(type) === normalizedPendingType);
    }

    let turnPipelinePhasesRuntime: any = null;
    function setTurnPipelinePhasesRuntime(runtime: any) {
        turnPipelinePhasesRuntime = (runtime && typeof runtime === 'object') ? runtime : null;
    }

    function isTurnPipelinePhasesDebugAvailable() {
        try {
            return turnPipelinePhasesRuntime
                && typeof turnPipelinePhasesRuntime.isDebugLogAvailable === 'function'
                && turnPipelinePhasesRuntime.isDebugLogAvailable() === true;
        } catch (e) { /* ignore */ }
        return false;
    }

    function logTurnPipelinePhasesDebug(...args: any[]) {
        if (!isTurnPipelinePhasesDebugAvailable()) return;
        try {
            const debugLogFn = turnPipelinePhasesRuntime && typeof turnPipelinePhasesRuntime.debugLog === 'function'
                ? turnPipelinePhasesRuntime.debugLog
                : null;
            if (debugLogFn) {
                debugLogFn(args[0], 'debug', args.length > 1 ? args.slice(1) : undefined);
                return;
            }
            if (typeof console !== 'undefined' && typeof console.log === 'function') {
                console.log(...args);
            }
        } catch (e) { /* ignore */ }
    }

    function readTurnPipelinePhasesMatchMode() {
        if (turnPipelinePhasesRuntime && typeof turnPipelinePhasesRuntime.readMatchMode === 'function') {
            try {
                const mode = turnPipelinePhasesRuntime.readMatchMode();
                if (mode) return mode;
            } catch (e) { /* ignore */ }
        }
        if (turnPipelinePhasesRuntime && typeof turnPipelinePhasesRuntime.getCurrentMatchMode === 'function') {
            try {
                const mode = turnPipelinePhasesRuntime.getCurrentMatchMode();
                if (mode) return mode;
            } catch (e) { /* ignore */ }
        }
        if (turnPipelinePhasesRuntime && typeof turnPipelinePhasesRuntime.MATCH_MODE !== 'undefined') {
            return turnPipelinePhasesRuntime.MATCH_MODE;
        }
        return null;
    }

    function isOthelloModeForTurnPipelinePhases() {
        const injectedMode = String(readTurnPipelinePhasesMatchMode() || '').trim().toLowerCase();
        if (injectedMode === 'reversi' || injectedMode === 'othello') return true;
        if (turnPipelinePhasesRuntime && typeof turnPipelinePhasesRuntime.MATCH_MODE !== 'undefined') return false;
        if (turnPipelinePhasesRuntime && (typeof turnPipelinePhasesRuntime.readMatchMode === 'function' || typeof turnPipelinePhasesRuntime.getCurrentMatchMode === 'function') && injectedMode) return false;
        if (turnPipelinePhasesRuntime) {
            try {
                if (OwnerHelpersModule && typeof OwnerHelpersModule.isReversiMode === 'function') {
                    return OwnerHelpersModule.isReversiMode(turnPipelinePhasesRuntime);
                }
                if (OwnerHelpersModule && typeof OwnerHelpersModule.isOthelloMode === 'function') {
                    return OwnerHelpersModule.isOthelloMode(turnPipelinePhasesRuntime);
                }
            } catch (e) { /* ignore */ }
        }
        try {
            const matchMode = readTurnPipelinePhasesMatchMode();
            return matchMode === 'reversi' || matchMode === 'othello';
        } catch (e) { /* ignore */ }
        return false;
    }

    function requirePendingActionValue(pending: any, expectedType: any, value: any, errorMessage: any) {
        if (!matchesPendingTypeForActionPhase(pending, expectedType)) return false;
        if (value == null) {
            throw new Error(errorMessage);
        }
        return true;
    }

    function readPendingForActionPhase(cardState: any, playerKey: any) {
        if (PendingCoordinatorModule && typeof PendingCoordinatorModule.readPendingEffect === 'function') {
            return PendingCoordinatorModule.readPendingEffect(cardState, playerKey);
        }
        return (cardState && cardState.pendingEffectByPlayer)
            ? (cardState.pendingEffectByPlayer[playerKey] || null)
            : null;
    }

    function getPendingEffectTypeForActionPhase(CardLogic: any, cardState: any, playerKey: any) {
        if (PendingCoordinatorModule && typeof PendingCoordinatorModule.getPendingEffectType === 'function') {
            return PendingCoordinatorModule.getPendingEffectType(cardState, playerKey);
        }
        if (typeof CardLogic.getPendingEffectType === 'function') {
            return CardLogic.getPendingEffectType(cardState, playerKey);
        }
        const pending = readPendingForActionPhase(cardState, playerKey);
        return pending ? pending.type : null;
    }

    function clearPendingForActionPhase(cardState: any, playerKey: any) {
        if (PendingCoordinatorModule && typeof PendingCoordinatorModule.clearPendingEffect === 'function') {
            return PendingCoordinatorModule.clearPendingEffect(cardState, playerKey, {
                clearSelectionAction: true
            });
        }
        if (cardState && cardState.pendingEffectByPlayer) {
            cardState.pendingEffectByPlayer[playerKey] = null;
        }
        if (PendingCoordinatorModule && typeof PendingCoordinatorModule.clearPendingSelectionAction === 'function') {
            PendingCoordinatorModule.clearPendingSelectionAction(playerKey);
        }
        return { ok: true, playerKey };
    }

    const resolvedChargeMax = Number(SharedConstantsModule && SharedConstantsModule.CHARGE_MAX);
    const CHARGE_MAX = Number.isFinite(resolvedChargeMax)
        ? resolvedChargeMax
        : 99;

    const PhaseHelpersModule = requireOptionalModule('./turn_pipeline_phase_helpers');
    const PendingCoordinatorModule = requireOptionalModule('./pending-coordinator');
    const SubPlacementContinuationModule = requireOptionalModule('./sub-placement-continuation');
    const ActionPhaseContinuationModule = requireOptionalModule('./action-phase/continuation');
    const ActionPhasePlacementEffectsModule = requireOptionalModule('./action-phase/placement-effects');
    const CardUsageImmediateEffectsModule = requireOptionalModule('./card-usage/immediate-effects');
    const TurnBoardChargeModule = requireOptionalModule('./board-charge');
    const TurnPresentationHelpersModule = requireOptionalModule('./presentation-helpers');
    const TurnRoundStateModule = requireOptionalModule('./round-state');
    const ActionPhasePrePlacementSelectionModule = requireOptionalModule('./action-phase/pre-placement-selection');
    const ActionPhasePlaceResolutionModule = requireOptionalModule('./action-phase/place-resolution');
    const ActionPhasePlacementImmediateEffectsModule = requireOptionalModule('./action-phase/placement-immediate-effects');
    const ActionPhaseTurnHandoffModule = requireOptionalModule('./action-phase/turn-handoff');
    const PhasePresentationFinalizerModule = requireOptionalModule('./phase-presentation-finalizer');
    const TurnStartMarkerPhaseModule = requireOptionalModule('./turn-start/marker-phase');
    const TurnStartPostProcessingModule = requireOptionalModule('./turn-start/post-processing');
    const TurnStartTimerPhaseModule = requireOptionalModule('./turn-start/timer-phase');
    const TheorySpawnResolutionModule = requireOptionalModule('./theory-spawn-resolution');

    function applyPassCompletion(CardLogic: any, Core: any, cardState: any, gameState: any, playerKey: any, events: any[], reason?: any) {
        if (!(Core && typeof Core.applyPass === 'function')) {
            throw new Error('TurnPipeline pass completion requires Core.applyPass');
        }
        const playerValue = playerKey === 'black' ? Core.BLACK : Core.WHITE;
        clearPendingForActionPhase(cardState, playerKey);
        if (CardLogic && typeof CardLogic.processPoisonTurnEnd === 'function') {
            CardLogic.processPoisonTurnEnd(cardState, gameState, Number(gameState && gameState.turnNumber || 0));
        }
        const newState = Core.applyPass(gameState);
        Object.assign(gameState, newState);
        const timeStopPassRes = (ActionPhaseTurnHandoffModule && typeof ActionPhaseTurnHandoffModule.consumeTimeStopCompletedTurn === 'function')
            ? ActionPhaseTurnHandoffModule.consumeTimeStopCompletedTurn({ CardLogic, cardState, playerKey })
            : { consumed: false, remaining: 0, continueTurn: false };
        if (timeStopPassRes.continueTurn === true) {
            gameState.currentPlayer = playerValue;
            if (cardState) {
                cardState.lastTurnStartedFor = null;
            }
        }
        const passEvent: any = { type: 'pass', player: playerKey };
        const reasonKey = String(reason || '').trim();
        if (reasonKey) passEvent.reason = reasonKey;
        events.push(passEvent);
        return timeStopPassRes;
    }

    function applyNonPassTurnCompletion(CardLogic: any, Core: any, cardState: any, gameState: any, playerKey: any) {
        const playerValue = playerKey === 'black' ? Core.BLACK : Core.WHITE;
        const turnNumberAfterCompletion = Number(gameState && gameState.turnNumber || 0) + 1;
        if (ActionPhaseTurnHandoffModule && typeof ActionPhaseTurnHandoffModule.handOffCompletedTurn === 'function') {
            return ActionPhaseTurnHandoffModule.handOffCompletedTurn({
                Core,
                CardLogic,
                cardState,
                gameState,
                playerKey,
                turnNumberAfterCompletion,
                advanceGameRoundAfterCompletedTurn: (nextCore: any, nextGameState: any, nextPlayerKey: any, options: any) => {
                    if (TurnRoundStateModule && typeof TurnRoundStateModule.advanceGameRoundAfterCompletedTurn === 'function') {
                        return TurnRoundStateModule.advanceGameRoundAfterCompletedTurn({
                            Core: nextCore,
                            gameState: nextGameState,
                            playerKey: nextPlayerKey,
                            options,
                            normalizePlayerKey
                        });
                    }
                    if (nextCore && typeof nextCore.advanceRoundAfterCompletedTurn === 'function') {
                        return nextCore.advanceRoundAfterCompletedTurn(nextGameState, nextPlayerKey, options);
                    }
                    return null;
                }
            });
        }
        if (Core && typeof Core.advanceRoundAfterCompletedTurn === 'function') {
            Core.advanceRoundAfterCompletedTurn(gameState, playerKey, null);
        }
        const timeStopPassRes = (ActionPhaseTurnHandoffModule && typeof ActionPhaseTurnHandoffModule.consumeTimeStopCompletedTurn === 'function')
            ? ActionPhaseTurnHandoffModule.consumeTimeStopCompletedTurn({ CardLogic, cardState, playerKey })
            : { consumed: false, remaining: 0, continueTurn: false };
        gameState.currentPlayer = timeStopPassRes.continueTurn === true ? playerValue : -playerValue;
        gameState.consecutivePasses = 0;
        gameState.turnNumber = turnNumberAfterCompletion;
        if (timeStopPassRes.continueTurn === true && cardState) {
            cardState.lastTurnStartedFor = null;
        }
        return timeStopPassRes;
    }

    function resolveSpecialStatusTimer(markerData: any) {
        const remainingOwnerTurns = Number(markerData && markerData.remainingOwnerTurns);
        if (Number.isFinite(remainingOwnerTurns)) return Math.max(0, Math.trunc(remainingOwnerTurns));
        return undefined;
    }

    function cloneDeferredPendingSelectionValue(value: any): any {
        if (Array.isArray(value)) {
            return value.map((item: any) => cloneDeferredPendingSelectionValue(item));
        }
        if (!value || typeof value !== 'object') return value;
        const cloned: Record<string, any> = {};
        const keys = Object.keys(value);
        for (let index = 0; index < keys.length; index += 1) {
            const key = keys[index];
            cloned[key] = cloneDeferredPendingSelectionValue(value[key]);
        }
        return cloned;
    }

    function hydrateDeferredPendingSelectionState(pending: any, action: any) {
        if (!pending || !action || !action.pendingSelectionState || typeof action.pendingSelectionState !== 'object') {
            return false;
        }
        const transportState = action.pendingSelectionState;
        if (String(transportState.type || '').trim().toUpperCase() !== String(pending.type || '').trim().toUpperCase()) {
            return false;
        }

        const keys = Object.keys(transportState);
        let hydrated = false;
        for (let index = 0; index < keys.length; index += 1) {
            const key = keys[index];
            if (key === 'type' || key === 'stage') continue;
            pending[key] = cloneDeferredPendingSelectionValue(transportState[key]);
            hydrated = true;
        }
        if (typeof transportState.stage === 'string' && transportState.stage) {
            pending.stage = transportState.stage;
        }
        return hydrated;
    }

    const pickRandomLine = (
        PhaseHelpersModule &&
        typeof PhaseHelpersModule.pickRandomLine === 'function'
    )
        ? PhaseHelpersModule.pickRandomLine
        : function pickRandomLineFallback(lines: any, prng: any) {
            if (!Array.isArray(lines) || lines.length === 0) return null;
            const source = (prng && typeof prng.random === 'function') ? prng : Math;
            let value = Number(source.random());
            if (!Number.isFinite(value)) value = 0;
            if (value < 0) value = 0;
            if (value >= 1) value = 0.999999;
            const index = Math.floor(value * lines.length);
            return lines[Math.max(0, Math.min(lines.length - 1, index))] || null;
        };

    const resolveWorkIncomeLine = (
        PhaseHelpersModule &&
        typeof PhaseHelpersModule.resolveWorkIncomeLine === 'function'
    )
        ? PhaseHelpersModule.resolveWorkIncomeLine
        : function resolveWorkIncomeLineFallback() { return null; };

    const getSpecialStoneBubbleSpeechLines = (
        PhaseHelpersModule &&
        typeof PhaseHelpersModule.getSpecialStoneBubbleSpeechLines === 'function'
    )
        ? PhaseHelpersModule.getSpecialStoneBubbleSpeechLines
        : function getSpecialStoneBubbleSpeechLinesFallback() { return null; };

    const pickSpecialStoneBubbleSpeechLine = (
        PhaseHelpersModule &&
        typeof PhaseHelpersModule.pickSpecialStoneBubbleSpeechLine === 'function'
    )
        ? PhaseHelpersModule.pickSpecialStoneBubbleSpeechLine
        : function pickSpecialStoneBubbleSpeechLineFallback(type: any, scenario: any, prng: any) {
            return pickRandomLine(getSpecialStoneBubbleSpeechLines(type, scenario), prng);
        };

    function getTurnPresentationHelperDeps() {
        return {
            CardUtilsModule,
            OwnerHelpersModule,
            MarkersAdapter,
            MARKER_KINDS,
            getSpecialStoneBubbleSpeechLines,
            pickSpecialStoneBubbleSpeechLine,
            resolveWorkIncomeLine
        };
    }

    function emitSpecialStonePlacementBubbleFromEffects(CardLogic: any, cardState: any, playerKey: any, row: any, col: any, effects: any, prng: any) {
        if (!(TurnPresentationHelpersModule && typeof TurnPresentationHelpersModule.emitSpecialStonePlacementBubbleFromEffects === 'function')) {
            throw new Error('TurnPipeline presentation helper module unavailable');
        }
        return TurnPresentationHelpersModule.emitSpecialStonePlacementBubbleFromEffects(
            CardLogic,
            cardState,
            playerKey,
            row,
            col,
            effects,
            prng,
            getTurnPresentationHelperDeps()
        );
    }

    function emitBoardChargeBubblePresentation(CardLogic: any, cardState: any, payload: any) {
        if (!(TurnPresentationHelpersModule && typeof TurnPresentationHelpersModule.emitBoardChargeBubblePresentation === 'function')) {
            throw new Error('TurnPipeline presentation helper module unavailable');
        }
        return TurnPresentationHelpersModule.emitBoardChargeBubblePresentation(CardLogic, cardState, payload);
    }

    function addChargeWithTotal(cardState: any, playerKey: any, amount: any, options: any) {
        if (!(TurnBoardChargeModule && typeof TurnBoardChargeModule.addChargeWithTotal === 'function')) {
            throw new Error('TurnPipeline board charge module unavailable');
        }
        return TurnBoardChargeModule.addChargeWithTotal(cardState, playerKey, amount, options, {
            CardUtilsModule,
            chargeMax: CHARGE_MAX
        });
    }

    function applyPlacementBoardBonusGain(CardLogic: any, cardState: any, playerKey: any, row: any, col: any, amount: any, flipCount: any) {
        if (!(TurnBoardChargeModule && typeof TurnBoardChargeModule.applyPlacementBoardBonusGain === 'function')) {
            throw new Error('TurnPipeline board charge module unavailable');
        }
        return TurnBoardChargeModule.applyPlacementBoardBonusGain(CardLogic, cardState, playerKey, row, col, amount, flipCount, {
            CardUtilsModule,
            chargeMax: CHARGE_MAX,
            emitBoardChargeBubblePresentation
        });
    }

    function buildPlacementChargeBubblePayload(playerKey: any, row: any, col: any, flipCount: any, boardBonusGained: any, effects: any) {
        if (!(TurnBoardChargeModule && typeof TurnBoardChargeModule.buildPlacementChargeBubblePayload === 'function')) {
            throw new Error('TurnPipeline board charge module unavailable');
        }
        return TurnBoardChargeModule.buildPlacementChargeBubblePayload(playerKey, row, col, flipCount, boardBonusGained, effects);
    }

    function awardBoardChargeGain(CardLogic: any, cardState: any, playerKey: any, amount: any, options: any) {
        if (!(TurnBoardChargeModule && typeof TurnBoardChargeModule.awardBoardChargeGain === 'function')) {
            throw new Error('TurnPipeline board charge module unavailable');
        }
        return TurnBoardChargeModule.awardBoardChargeGain(CardLogic, cardState, playerKey, amount, options, {
            CardUtilsModule,
            chargeMax: CHARGE_MAX,
            emitBoardChargeBubblePresentation
        });
    }

    function transferChargeBetweenPlayers(cardState: any, fromPlayerKey: any, toPlayerKey: any, amount: any, reasonKey: any) {
        if (!(TurnBoardChargeModule && typeof TurnBoardChargeModule.transferChargeBetweenPlayers === 'function')) {
            throw new Error('TurnPipeline board charge module unavailable');
        }
        return TurnBoardChargeModule.transferChargeBetweenPlayers(cardState, fromPlayerKey, toPlayerKey, amount, reasonKey, {
            CardUtilsModule,
            chargeMax: CHARGE_MAX
        });
    }

    function pushTrapEvents(events: any, trapRes: any) {
        if (!events || !trapRes) return;
        if (Array.isArray(trapRes.triggered) && trapRes.triggered.length > 0) {
            events.push({ type: 'trap_triggered', details: trapRes.triggered.slice() });
        }
        if (Array.isArray(trapRes.expired) && trapRes.expired.length > 0) {
            events.push({ type: 'trap_expired', details: trapRes.expired.slice() });
        }
        if (Array.isArray(trapRes.disarmed) && trapRes.disarmed.length > 0) {
            events.push({ type: 'trap_disarmed', details: trapRes.disarmed.slice() });
        }
    }

    function snapshotWorkMarkers(cardState: any) {
        if (!(TurnPresentationHelpersModule && typeof TurnPresentationHelpersModule.snapshotWorkMarkers === 'function')) {
            throw new Error('TurnPipeline presentation helper module unavailable');
        }
        return TurnPresentationHelpersModule.snapshotWorkMarkers(cardState, getTurnPresentationHelperDeps());
    }

    function isWorkDurationEndPresentationEvent(ev: any) {
        if (!(TurnPresentationHelpersModule && typeof TurnPresentationHelpersModule.isWorkDurationEndPresentationEvent === 'function')) {
            throw new Error('TurnPipeline presentation helper module unavailable');
        }
        return TurnPresentationHelpersModule.isWorkDurationEndPresentationEvent(ev);
    }

    function emitWorkRemovedPresentationFromSnapshots(CardLogic: any, cardState: any, beforeSnapshot: any, options: any) {
        if (!(TurnPresentationHelpersModule && typeof TurnPresentationHelpersModule.emitWorkRemovedPresentationFromSnapshots === 'function')) {
            throw new Error('TurnPipeline presentation helper module unavailable');
        }
        return TurnPresentationHelpersModule.emitWorkRemovedPresentationFromSnapshots(
            CardLogic,
            cardState,
            beforeSnapshot,
            options,
            getTurnPresentationHelperDeps()
        );
    }
    function emitObserverBubblePresentation(CardLogic: any, cardState: any, payload: any) {
        if (!(TurnPresentationHelpersModule && typeof TurnPresentationHelpersModule.emitObserverBubblePresentation === 'function')) {
            throw new Error('TurnPipeline presentation helper module unavailable');
        }
        return TurnPresentationHelpersModule.emitObserverBubblePresentation(CardLogic, cardState, payload);
    }

    function emitWorkBubblePresentation(CardLogic: any, cardState: any, payload: any) {
        if (!(TurnPresentationHelpersModule && typeof TurnPresentationHelpersModule.emitWorkBubblePresentation === 'function')) {
            throw new Error('TurnPipeline presentation helper module unavailable');
        }
        return TurnPresentationHelpersModule.emitWorkBubblePresentation(
            CardLogic,
            cardState,
            payload,
            getTurnPresentationHelperDeps()
        );
    }
    function snapshotSpecialStoneSpeechMarkers(cardState: any) {
        if (!(TurnPresentationHelpersModule && typeof TurnPresentationHelpersModule.snapshotSpecialStoneSpeechMarkers === 'function')) {
            throw new Error('TurnPipeline presentation helper module unavailable');
        }
        return TurnPresentationHelpersModule.snapshotSpecialStoneSpeechMarkers(cardState, getTurnPresentationHelperDeps());
    }

    function normalizePlayerKey(player: any) {
        if (!(TurnPresentationHelpersModule && typeof TurnPresentationHelpersModule.normalizePlayerKey === 'function')) {
            throw new Error('TurnPipeline presentation helper module unavailable');
        }
        return TurnPresentationHelpersModule.normalizePlayerKey(player, getTurnPresentationHelperDeps());
    }

    function emitSpecialStoneBubblesFromPhase(CardLogic: any, cardState: any, options: any) {
        if (!(TurnPresentationHelpersModule && typeof TurnPresentationHelpersModule.emitSpecialStoneBubblesFromPhase === 'function')) {
            throw new Error('TurnPipeline presentation helper module unavailable');
        }
        return TurnPresentationHelpersModule.emitSpecialStoneBubblesFromPhase(
            CardLogic,
            cardState,
            options,
            getTurnPresentationHelperDeps()
        );
    }

    function isFrozenCell(cardState: any, row: any, col: any) {
        if (!(TurnPresentationHelpersModule && typeof TurnPresentationHelpersModule.isFrozenCell === 'function')) {
            throw new Error('TurnPipeline presentation helper module unavailable');
        }
        return TurnPresentationHelpersModule.isFrozenCell(cardState, row, col, getTurnPresentationHelperDeps());
    }

    function emitHandRemovePresentation(CardLogic: any, cardState: any, payload: any) {
        if (!(TurnPresentationHelpersModule && typeof TurnPresentationHelpersModule.emitHandRemovePresentation === 'function')) {
            throw new Error('TurnPipeline presentation helper module unavailable');
        }
        return TurnPresentationHelpersModule.emitHandRemovePresentation(
            CardLogic,
            cardState,
            payload,
            getTurnPresentationHelperDeps()
        );
    }

    function emitHandAddPresentation(CardLogic: any, cardState: any, payload: any) {
        if (!(TurnPresentationHelpersModule && typeof TurnPresentationHelpersModule.emitHandAddPresentation === 'function')) {
            throw new Error('TurnPipeline presentation helper module unavailable');
        }
        return TurnPresentationHelpersModule.emitHandAddPresentation(
            CardLogic,
            cardState,
            payload,
            getTurnPresentationHelperDeps()
        );
    }

    function emitTrapHandRemoveEvents(CardLogic: any, cardState: any, trapRes: any) {
        if (!(TurnPresentationHelpersModule && typeof TurnPresentationHelpersModule.emitTrapHandRemoveEvents === 'function')) {
            throw new Error('TurnPipeline presentation helper module unavailable');
        }
        return TurnPresentationHelpersModule.emitTrapHandRemoveEvents(
            CardLogic,
            cardState,
            trapRes,
            getTurnPresentationHelperDeps()
        );
    }

    type TurnPipelinePhaseContext = {
        CardLogic: any;
        Core: any;
        cardState: any;
        gameState: any;
        playerKey: any;
        events: any[];
        prng: any;
        BoardOps?: any;
        action?: any;
    };

    type TurnPhasePresentationSnapshot = {
        workMarkersBeforePhase: any;
        specialStoneSpeechBeforePhase: any;
        eventStartIndex: number;
        presentationStartIndex: number;
    };

    type TurnStartStageState = TurnPhasePresentationSnapshot & {
        timerSnapshot: any;
        turnStartTimerTickEmittedKeys: Set<string>;
        othelloMode: boolean;
        turnStartMarkerAnchors: any[];
        turnStartOptions: any;
        hasSplitTurnStartHooks: boolean;
    };

    function createTurnPipelinePhaseContext(
        CardLogic: any,
        Core: any,
        cardState: any,
        gameState: any,
        playerKey: any,
        events: any,
        prng: any,
        BoardOps?: any,
        action?: any
    ): TurnPipelinePhaseContext {
        return {
            CardLogic,
            Core,
            cardState,
            gameState,
            playerKey,
            events,
            prng: prng || undefined,
            BoardOps,
            action
        };
    }

    function snapshotTurnPhasePresentationStart(ctx: TurnPipelinePhaseContext): TurnPhasePresentationSnapshot {
        return {
            workMarkersBeforePhase: snapshotWorkMarkers(ctx.cardState),
            specialStoneSpeechBeforePhase: snapshotSpecialStoneSpeechMarkers(ctx.cardState),
            eventStartIndex: Array.isArray(ctx.events) ? ctx.events.length : 0,
            presentationStartIndex: Array.isArray(ctx.cardState.presentationEvents)
                ? ctx.cardState.presentationEvents.length
                : 0
        };
    }

    function syncTurnStartPendingSelectionCache(ctx: TurnPipelinePhaseContext): void {
        if (PendingCoordinatorModule && typeof PendingCoordinatorModule.syncPendingSelectionActionCache === 'function') {
            PendingCoordinatorModule.syncPendingSelectionActionCache(ctx.cardState);
        }
    }

    function beginTurnStartForPlayer(ctx: TurnPipelinePhaseContext): boolean {
        const { cardState, playerKey } = ctx;
        if (cardState.lastTurnStartedFor === playerKey) return false;

        const opponentKeyForSalvation = playerKey === 'black' ? 'white' : 'black';
        cardState._activeTurnPlayer = playerKey;
        if (!cardState.prevOpponentTurnDestroyedStonesByPlayer) {
            const legacySalvationLedger = (cardState.prevOpponentTurnDestroyedNormalByPlayer && typeof cardState.prevOpponentTurnDestroyedNormalByPlayer === 'object')
                ? cardState.prevOpponentTurnDestroyedNormalByPlayer
                : null;
            cardState.prevOpponentTurnDestroyedStonesByPlayer = legacySalvationLedger
                ? {
                    black: Array.isArray(legacySalvationLedger.black) ? legacySalvationLedger.black.map((entry: any) => ({ ...entry })) : [],
                    white: Array.isArray(legacySalvationLedger.white) ? legacySalvationLedger.white.map((entry: any) => ({ ...entry })) : []
                }
                : { black: [], white: [] };
        }
        cardState.prevOpponentTurnDestroyedStonesByPlayer[opponentKeyForSalvation] = [];

        if (cardState.fateWillControllerByTurnOwner) {
            if (cardState.fateWillControllerByTurnOwner[opponentKeyForSalvation] === playerKey) {
                cardState.fateWillControllerByTurnOwner[opponentKeyForSalvation] = null;
            }
        }
        return true;
    }

    function applyTurnStartRoundBonus(ctx: TurnPipelinePhaseContext): any {
        if (!(TurnRoundStateModule && typeof TurnRoundStateModule.ensureGameRoundState === 'function' && typeof TurnRoundStateModule.applyPendingRoundBonusAtTurnStart === 'function')) {
            throw new Error('TurnPipeline round state module unavailable');
        }
        TurnRoundStateModule.ensureGameRoundState({ Core: ctx.Core, gameState: ctx.gameState });
        return TurnRoundStateModule.applyPendingRoundBonusAtTurnStart({
            CardLogic: ctx.CardLogic,
            Core: ctx.Core,
            cardState: ctx.cardState,
            gameState: ctx.gameState,
            events: ctx.events,
            addChargeWithTotal
        });
    }

    function resolveBoardBonusGain(CardLogic: any, cardState: any, playerKey: any, row: any, col: any, options: any) {
        if (!(TurnBoardChargeModule && typeof TurnBoardChargeModule.resolveBoardBonusGain === 'function')) {
            throw new Error('TurnPipeline board charge module unavailable');
        }
        return TurnBoardChargeModule.resolveBoardBonusGain(CardLogic, cardState, playerKey, row, col, options, {
            CardUtilsModule,
            chargeMax: CHARGE_MAX,
            emitBoardChargeBubblePresentation
        });
    }

    function getTurnPhaseMarkers(nextCardState: any): any[] {
        return (MarkersAdapter && typeof MarkersAdapter.getMarkers === 'function')
            ? MarkersAdapter.getMarkers(nextCardState)
            : (nextCardState.markers || []);
    }

    function prepareTurnStartStage(ctx: TurnPipelinePhaseContext, roundBonusSummary: any): TurnStartStageState {
        const phaseSnapshot = snapshotTurnPhasePresentationStart(ctx);
        const timerSnapshot = (TurnStartTimerPhaseModule && typeof TurnStartTimerPhaseModule.snapshotTurnStartTimers === 'function')
            ? TurnStartTimerPhaseModule.snapshotTurnStartTimers(ctx.cardState, {
                getMarkers: getTurnPhaseMarkers,
                isBombCategoryMarker,
                resolveSpecialStatusTimer,
                specialStoneKind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone'
            })
            : new Map();
        const othelloMode = isOthelloModeForTurnPipelinePhases();
        const turnStartMarkerAnchors = (!othelloMode && TurnStartMarkerPhaseModule && typeof TurnStartMarkerPhaseModule.collectTurnStartMarkerAnchors === 'function')
            ? TurnStartMarkerPhaseModule.collectTurnStartMarkerAnchors(ctx.cardState, {
                getMarkers: getTurnPhaseMarkers,
                isBombCategoryMarker
            })
            : [];
        const turnStartOptions: any = {
            deferGuardDurationEndUntilAfterTurnStartMarkers: true,
            deferStatusDurationUntilTurnStartMarkers: true
        };
        if (roundBonusSummary) {
            turnStartOptions.skipStoneSalvationGodRevives = true;
        }
        const hasSplitTurnStartHooks = !othelloMode
            && ctx.CardLogic
            && typeof ctx.CardLogic.onTurnStartBeforeAnchors === 'function'
            && typeof ctx.CardLogic.drawForTurnStart === 'function';
        return {
            ...phaseSnapshot,
            timerSnapshot,
            turnStartTimerTickEmittedKeys: new Set<string>(),
            othelloMode,
            turnStartMarkerAnchors,
            turnStartOptions,
            hasSplitTurnStartHooks
        };
    }

    function emitTurnStartRepaymentEntries(events: any[], playerKey: any, entries: any[], shortageType: string, repaidType: string): void {
        for (const entry of entries) {
            if (!entry) continue;
            if (entry.shortage) {
                events.push({
                    type: shortageType,
                    player: playerKey,
                    destroyed: Array.isArray(entry.destroyed) ? entry.destroyed.slice() : [],
                    destroyedCount: Number(entry.destroyedCount) || 0,
                    remainingOwnerTurns: Number(entry.remainingOwnerTurnsAfter) || 0,
                    completed: entry.completed === true
                });
            } else {
                events.push({
                    type: repaidType,
                    player: playerKey,
                    repaid: Number(entry.repaid) || 0,
                    remainingOwnerTurns: Number(entry.remainingOwnerTurnsAfter) || 0,
                    completed: entry.completed === true
                });
            }
        }
    }

    function emitTurnStartSummaryEvents(ctx: TurnPipelinePhaseContext, turnStartSummary: any): void {
        if (turnStartSummary && turnStartSummary.ribo && Array.isArray(turnStartSummary.ribo.entries)) {
            emitTurnStartRepaymentEntries(
                ctx.events,
                ctx.playerKey,
                turnStartSummary.ribo.entries,
                'ribo_will_shortage',
                'ribo_will_repaid'
            );
        }
        if (turnStartSummary && turnStartSummary.observerWill && Array.isArray(turnStartSummary.observerWill.entries)) {
            emitTurnStartRepaymentEntries(
                ctx.events,
                ctx.playerKey,
                turnStartSummary.observerWill.entries,
                'observer_will_shortage',
                'observer_will_repaid'
            );
        }
        if (turnStartSummary && turnStartSummary.boardExecutor && turnStartSummary.boardExecutor.applied) {
            ctx.events.push({
                type: 'board_executor_hand_tax',
                player: ctx.playerKey,
                lost: Number(turnStartSummary.boardExecutor.lost) || 0,
                handCount: Number(turnStartSummary.boardExecutor.handCount) || 0
            });
        }
        if (turnStartSummary && Array.isArray(turnStartSummary.generatedSpawnFlipResults) && turnStartSummary.generatedSpawnFlipResults.length) {
            applyGeneratedSpawnFlipResultsTurnStart(
                ctx.CardLogic,
                ctx.cardState,
                ctx.gameState,
                ctx.events,
                turnStartSummary.generatedSpawnFlipResults
            );
        }
    }

    function finalizeActionPhasePresentation(ctx: TurnPipelinePhaseContext, phaseSnapshot: TurnPhasePresentationSnapshot): void {
        if (PhasePresentationFinalizerModule && typeof PhasePresentationFinalizerModule.finalizePhasePresentation === 'function') {
            PhasePresentationFinalizerModule.finalizePhasePresentation({
                CardLogic: ctx.CardLogic,
                cardState: ctx.cardState,
                playerKey: ctx.playerKey,
                events: ctx.events,
                prng: ctx.prng,
                eventStartIndex: phaseSnapshot.eventStartIndex,
                presentationStartIndex: phaseSnapshot.presentationStartIndex,
                workMarkersBeforePhase: phaseSnapshot.workMarkersBeforePhase,
                specialStoneSpeechBeforePhase: phaseSnapshot.specialStoneSpeechBeforePhase,
                removalReason: 'removed_during_action',
                emitWorkRemovedPresentationFromSnapshots,
                emitSpecialStoneBubblesFromPhase
            });
        }
    }

    function applyPassActionStage(ctx: TurnPipelinePhaseContext): void {
        const { CardLogic, Core, cardState, gameState, playerKey, events } = ctx;
        const action = ctx.action || {};
        const p = ctx.prng;
        const playerValue = playerKey === 'black' ? Core.BLACK : Core.WHITE;
        const cardCtx = resolveSafeCardContext(CardLogic, cardState);
        const legalMoves = Core.getLegalMoves(gameState, playerValue, cardCtx);
        const placementLocked = CardLogic
            && typeof CardLogic.isPlacementLockedForPlayer === 'function'
            && CardLogic.isPlacementLockedForPlayer(cardState, playerKey) === true;
        const forcePass = action && (
            action.forcePass === true
            || action.timeoutPass === true
            || String(action.reason || '').trim().toLowerCase() === 'timeout'
        );
        const autoNoActionPass = action && action.autoNoActionPass === true;
        if (autoNoActionPass && !forcePass) {
            const pending = readPendingForActionPhase(cardState, playerKey);
            if (pending) {
                throw new Error('Illegal auto pass: pending action available');
            }
            if (legalMoves.length > 0 && !placementLocked) {
                throw new Error('Illegal auto pass: legal moves available');
            }
            const hasUsableCard = CardLogic
                && typeof CardLogic.hasUsableCard === 'function'
                && CardLogic.hasUsableCard(cardState, gameState, playerKey) === true;
            if (hasUsableCard) {
                throw new Error('Illegal auto pass: usable card available');
            }
        }
        if (legalMoves.length > 0 && !placementLocked && !forcePass) {
            throw new Error('Illegal pass: legal moves available');
        }
        if (
            CardLogic &&
            typeof CardLogic.processTheoryIncarnationOwnerPass === 'function' &&
            !isOthelloModeForTurnPipelinePhases()
        ) {
            const theoryPassRes = CardLogic.processTheoryIncarnationOwnerPass(cardState, gameState, playerKey, p);
            if (theoryPassRes && theoryPassRes.expired) {
                events.push({ type: 'theory_incarnation_marker_expired', detail: theoryPassRes.expired });
            }
        }
        applyPassCompletion(CardLogic, Core, cardState, gameState, playerKey, events);
    }

    function applyUseCardOnlyActionStage(ctx: TurnPipelinePhaseContext): void {
        const action = ctx.action || {};
        ctx.events.push({ type: 'card_used_only', player: ctx.playerKey, cardId: action.useCardId || null });
    }

    function applyCancelCardActionStage(ctx: TurnPipelinePhaseContext): void {
        const action = ctx.action || {};
        const res = (typeof ctx.CardLogic.cancelPendingSelection === 'function')
            ? ctx.CardLogic.cancelPendingSelection(ctx.cardState, ctx.playerKey, action.cancelOptions)
            : { canceled: false, reason: 'not_supported' };
        ctx.events.push({
            type: 'card_cancelled',
            player: ctx.playerKey,
            canceled: !!res.canceled,
            reason: res.reason || null,
            cardId: res.cardId || null
        });
    }

    function applyDestroyHandCardActionStage(ctx: TurnPipelinePhaseContext): void {
        const { CardLogic, cardState, playerKey, events } = ctx;
        const action = ctx.action || {};
        if (
            SubPlacementContinuationModule &&
            typeof SubPlacementContinuationModule.isSubPlacementTurnActive === 'function' &&
            SubPlacementContinuationModule.isSubPlacementTurnActive(cardState, playerKey)
        ) {
            throw new Error('destroy_hand_card failed: sub-placement is active');
        }
        const res = (typeof CardLogic.destroyHandCard === 'function')
            ? CardLogic.destroyHandCard(cardState, playerKey, action.destroyCardId, action.destroyOptions)
            : { applied: false, reason: 'not_supported' };
        if (!res || !res.applied) {
            throw new Error(`destroy_hand_card failed${res && res.reason ? `: ${res.reason}` : ''}`);
        }
        emitHandRemovePresentation(CardLogic, cardState, {
            player: playerKey,
            count: 1,
            reason: 'destroy_hand_card',
            cardId: res.destroyedCardId || action.destroyCardId || null
        });
        events.push({ type: 'hand_card_destroyed', player: playerKey, cardId: res.destroyedCardId || action.destroyCardId || null });
    }

    function applyTurnStartPhase(CardLogic: any, Core: any, cardState: any, gameState: any, playerKey: any, events: any, prng: any, BoardOps?: any) {
        const ctx = createTurnPipelinePhaseContext(CardLogic, Core, cardState, gameState, playerKey, events, prng, BoardOps);
        const p = ctx.prng;

        syncTurnStartPendingSelectionCache(ctx);

        if (beginTurnStartForPlayer(ctx)) {
            const roundBonusSummary = applyTurnStartRoundBonus(ctx);
            const turnStartStage = prepareTurnStartStage(ctx, roundBonusSummary);
            const turnStartSummary = turnStartStage.othelloMode
                ? null
                : (turnStartStage.hasSplitTurnStartHooks
                    ? (CardLogic.onTurnStartBeforeAnchors(cardState, playerKey, gameState, p, turnStartStage.turnStartOptions) || null)
                    : (CardLogic.onTurnStart(cardState, playerKey, gameState, p, turnStartStage.turnStartOptions) || null));
            events.push({ type: 'turn_start', player: playerKey });
            emitTurnStartSummaryEvents(ctx, turnStartSummary);

            if (turnStartStage.othelloMode) {
                return { ok: true, events };
            }

            // Start-of-turn effects: process all markers (bombs & special stones) in creation order.
            const flushPostFlipRevivesForAnchor = (TurnStartPostProcessingModule && typeof TurnStartPostProcessingModule.flushTurnStartPostFlipRevives === 'function')
                ? ((flippedByOwner: any) => {
                    TurnStartPostProcessingModule.flushTurnStartPostFlipRevives({
                        CardLogic,
                        cardState,
                        gameState,
                        events,
                        flippedByOwner,
                        applyPostFlipRevives,
                        awardBoardChargeGain
                    });
                })
                : undefined;
            const emitTimerStatusTickForAnchor = (TurnStartTimerPhaseModule && typeof TurnStartTimerPhaseModule.emitTurnStartTimerStatusTickForMarker === 'function')
                ? ((marker: any) => {
                    TurnStartTimerPhaseModule.emitTurnStartTimerStatusTickForMarker({
                        CardLogic,
                        cardState,
                        timerSnapshot: turnStartStage.timerSnapshot,
                        marker,
                        emittedTimerTickKeys: turnStartStage.turnStartTimerTickEmittedKeys,
                        getMarkers: getTurnPhaseMarkers,
                        isBombCategoryMarker,
                        resolveSpecialStatusTimer,
                        specialStoneKind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone'
                    });
                })
                : undefined;
            const applyGeneratedSpawnFlipResultsForAnchor = (results: any[]) => {
                applyGeneratedSpawnFlipResultsTurnStart(
                    CardLogic,
                    cardState,
                    gameState,
                    events,
                    results
                );
            };
            const processedTurnStartMarkers = (TurnStartMarkerPhaseModule && typeof TurnStartMarkerPhaseModule.processTurnStartMarkers === 'function')
                ? TurnStartMarkerPhaseModule.processTurnStartMarkers({
                    CardLogic,
                    BoardOps,
                    cardState,
                    gameState,
                    playerKey,
                    events,
                    prng: p,
                    markers: turnStartStage.turnStartMarkerAnchors,
                    isBombCategoryMarker,
                    isFrozenCell,
                    awardBoardChargeGain,
                    flushPostFlipRevivesForAnchor,
                    emitTimerStatusTickForAnchor,
                    applyGeneratedSpawnFlipResultsForAnchor,
                    debugLog: logTurnPipelinePhasesDebug
                })
                : {
                    hyperAggregated: { moved: [], destroyed: [], flipped: [], flippedByOwner: { black: [], white: [] } }
                };
            const hyperAggregated = processedTurnStartMarkers.hyperAggregated;
            if (CardLogic && typeof CardLogic.flushDeferredTurnStartStatusExpirations === 'function') {
                CardLogic.flushDeferredTurnStartStatusExpirations(cardState, gameState, {
                    deferGuardDurationEndUntilAfterTurnStartMarkers: true
                });
            }
            if (CardLogic && typeof CardLogic.syncPoisonContacts === 'function') {
                CardLogic.syncPoisonContacts(cardState, gameState, Number(gameState && gameState.turnNumber || 0));
            }
            if (typeof CardLogic.consumeGeneratedSpawnFlipResults === 'function') {
                applyGeneratedSpawnFlipResultsTurnStart(
                    CardLogic,
                    cardState,
                    gameState,
                    events,
                    CardLogic.consumeGeneratedSpawnFlipResults(cardState)
                );
            }

            if (TurnStartPostProcessingModule && typeof TurnStartPostProcessingModule.finalizeTurnStartMarkerProcessing === 'function') {
                TurnStartPostProcessingModule.finalizeTurnStartMarkerProcessing({
                    CardLogic,
                    cardState,
                        gameState,
                        playerKey,
                        events,
                        prng: p,
                        processedTurnStartMarkers,
                        workMarkersBeforeStart: turnStartStage.workMarkersBeforePhase,
                        specialStoneSpeechBeforeStart: turnStartStage.specialStoneSpeechBeforePhase,
                        eventStartIndex: turnStartStage.eventStartIndex,
                        presentationStartIndex: turnStartStage.presentationStartIndex,
                        applyPostFlipRevives,
                        awardBoardChargeGain,
                        pushTrapEvents,
                    emitTrapHandRemoveEvents,
                    normalizePlayerKey,
                    isWorkDurationEndPresentationEvent,
                    emitWorkRemovedPresentationFromSnapshots,
                    emitSpecialStoneBubblesFromPhase
                })
            }

            if (TurnStartTimerPhaseModule && typeof TurnStartTimerPhaseModule.emitTurnStartTimerStatusTicks === 'function') {
                TurnStartTimerPhaseModule.emitTurnStartTimerStatusTicks({
                    CardLogic,
                    cardState,
                    timerSnapshot: turnStartStage.timerSnapshot,
                    emittedTimerTickKeys: turnStartStage.turnStartTimerTickEmittedKeys,
                    getMarkers: getTurnPhaseMarkers,
                    isBombCategoryMarker,
                    resolveSpecialStatusTimer,
                    specialStoneKind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone'
                });
            }

            if (turnStartStage.hasSplitTurnStartHooks) {
                CardLogic.drawForTurnStart(cardState, playerKey, p, turnStartStage.turnStartOptions);
            }

            delete cardState._frozenCellsActiveAtTurnStart;

        }
    }

    function applyCardUsagePhase(CardLogic: any, cardState: any, gameState: any, playerKey: any, action: any, events: any, prng: any) {
        const p = prng || undefined;
        const workMarkersBeforeUsage = snapshotWorkMarkers(cardState);
        const specialStoneSpeechBeforeUsage = snapshotSpecialStoneSpeechMarkers(cardState);
        const eventStartIndex = Array.isArray(events)
            ? events.length
            : 0;
        const presentationStartIndex = Array.isArray(cardState.presentationEvents)
            ? cardState.presentationEvents.length
            : 0;
        try {
            if (action.useCardId) {
                if (
                    SubPlacementContinuationModule &&
                    typeof SubPlacementContinuationModule.isSubPlacementTurnActive === 'function' &&
                    SubPlacementContinuationModule.isSubPlacementTurnActive(cardState, playerKey)
                ) {
                    throw new Error('applyCardUsage failed: sub-placement is active');
                }
                const mergedDebugOptions = (action && action.debugOptions && typeof action.debugOptions === 'object')
                    ? { ...action.debugOptions }
                    : {};
                if (p && typeof p.random === 'function') {
                    mergedDebugOptions.prng = p;
                }
                const requestedHandIndex = Number(action.useCardHandIndex);
                if (Number.isInteger(requestedHandIndex) && requestedHandIndex >= 0) {
                    mergedDebugOptions.handIndex = Math.trunc(requestedHandIndex);
                }
                const ok = CardLogic.applyCardUsage(
                    cardState,
                    gameState,
                    playerKey,
                    action.useCardId,
                    action.useCardOwnerKey,
                    mergedDebugOptions
                );
                if (!ok) {
                    throw new Error('applyCardUsage failed');
                }
                events.push({ type: 'card_used', player: playerKey, cardId: action.useCardId });

                const pendingType = getPendingEffectTypeForActionPhase(CardLogic, cardState, playerKey);
                if (CardUsageImmediateEffectsModule && typeof CardUsageImmediateEffectsModule.resolveImmediateCardUsageEffects === 'function') {
                    CardUsageImmediateEffectsModule.resolveImmediateCardUsageEffects({
                        CardLogic,
                        cardState,
                        gameState,
                        playerKey,
                        events,
                        prng: p,
                        pendingType,
                        addChargeWithTotal,
                        clearPendingForActionPhase,
                        transferChargeBetweenPlayers,
                        applyPostFlipRevives,
                        resolveBoardBonusGain,
                        awardBoardChargeGain,
                        emitHandRemovePresentation
                    });
                }
                if (typeof CardLogic.consumeGeneratedSpawnFlipResults === 'function') {
                    applyGeneratedSpawnFlipResultsImmediate(
                        CardLogic,
                        cardState,
                        gameState,
                        events,
                        CardLogic.consumeGeneratedSpawnFlipResults(cardState)
                    );
                }

            }
        } finally {
            if (PhasePresentationFinalizerModule && typeof PhasePresentationFinalizerModule.finalizePhasePresentation === 'function') {
                PhasePresentationFinalizerModule.finalizePhasePresentation({
                    CardLogic,
                    cardState,
                    playerKey,
                    events,
                    prng: p,
                    eventStartIndex,
                    presentationStartIndex,
                    workMarkersBeforePhase: workMarkersBeforeUsage,
                    specialStoneSpeechBeforePhase: specialStoneSpeechBeforeUsage,
                    removalReason: 'removed_during_card_usage',
                    emitWorkRemovedPresentationFromSnapshots,
                    emitSpecialStoneBubblesFromPhase
                });
            }
        }
    }

    function resolveSafeCardContext(CardLogic: any, cardState: any) {
        let ctx = null;
        try {
            const ctxHelper = requireOptionalModule('../logic/context');
            if (ctxHelper && typeof ctxHelper.getSafeCardContext === 'function') {
                ctx = ctxHelper.getSafeCardContext(cardState, undefined, undefined, CardLogic);
            }
        } catch (e) { /* ignore and fallback */ }
        if (!ctx) {
            try { ctx = CardLogic.getCardContext(cardState); } catch (e) { ctx = { protectedStones: [], permaProtectedStones: [], bombs: [] }; }
        }
        return ctx;
    }

    function getActionCellOwner(gameState: any, cardState: any, row: any, col: any) {
        if (!gameState || !Array.isArray(gameState.board)) return null;
        if (
            !SharedBoardUtils
            || typeof SharedBoardUtils.createBoardContext !== 'function'
            || typeof SharedBoardUtils.getCellValue !== 'function'
        ) {
            throw new Error('SharedBoardUtils BoardContext APIs are required by TurnPipelinePhases');
        }
        return SharedBoardUtils.getCellValue(
            SharedBoardUtils.createBoardContext(gameState, cardState ?? null),
            row,
            col
        );
    }

    function applyTrapEffectsAfterSelection(CardLogic: any, cardState: any, gameState: any, playerKey: any, events: any) {
        if (!CardLogic || typeof CardLogic.processTrapEffects !== 'function') return;
        const trapRes = CardLogic.processTrapEffects(cardState, gameState, playerKey, { expireOnOwnerTurnStart: false });
        pushTrapEvents(events, trapRes);
        emitTrapHandRemoveEvents(CardLogic, cardState, trapRes);
    }

    function findPrimaryDurationMarkerAt(cardState: any, row: any, col: any) {
        const markers = cardState && Array.isArray(cardState.markers) ? cardState.markers : [];
        const matches = markers.filter((marker: any) => {
            if (!marker || marker.kind !== (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone')) return false;
            if (marker.row !== row || marker.col !== col) return false;
            const timer = marker.data ? resolveSpecialStatusTimer(marker.data) : undefined;
            return timer !== undefined && Number.isFinite(Number(timer)) && Number(timer) > 0;
        });
        return matches.find((marker: any) => marker && marker.data && marker.data.type !== 'GUARD') || matches[0] || null;
    }

    function hasDurationSelectionStatusTick(cardState: any, row: any, col: any, reason: any, presentationStartIndex: any) {
        const events = cardState && Array.isArray(cardState.presentationEvents)
            ? cardState.presentationEvents.slice(Number(presentationStartIndex) || 0)
            : [];
        return events.some((event: any) => (
            event &&
            event.type === 'STATUS_TICK' &&
            event.row === row &&
            event.col === col &&
            event.meta &&
            event.meta.reason === reason
        ));
    }

    function emitDurationSelectionStatusTick(CardLogic: any, cardState: any, target: any, reason: any, highlightTone: any, presentationStartIndex: any) {
        if (!target || !CardLogic || typeof CardLogic.emitPresentationEvent !== 'function') return;
        const row = target.row;
        const col = target.col;
        if (!Number.isInteger(row) || !Number.isInteger(col)) return;
        if (hasDurationSelectionStatusTick(cardState, row, col, reason, presentationStartIndex)) return;
        const marker = findPrimaryDurationMarkerAt(cardState, row, col);
        if (!marker || !marker.data) return;
        const timer = resolveSpecialStatusTimer(marker.data);
        if (timer === undefined) return;
        CardLogic.emitPresentationEvent(cardState, {
            type: 'STATUS_TICK',
            row,
            col,
            meta: {
                special: marker.data.type || null,
                timer,
                owner: marker.owner || null,
                reason,
                highlightTone
            }
        });
    }

    function applyPrePlacementSelectionStage(ctx: TurnPipelinePhaseContext, presentationStartIndex: number): boolean {
        const { CardLogic, Core, cardState, gameState, playerKey, action, events } = ctx;
        const p = ctx.prng;
        const pending = readPendingForActionPhase(cardState, playerKey);
        hydrateDeferredPendingSelectionState(pending, action);
        if (!(ActionPhasePrePlacementSelectionModule && typeof ActionPhasePrePlacementSelectionModule.resolvePrePlacementSelectionAction === 'function')) {
            return false;
        }
        const handledPrePlacementSelection = ActionPhasePrePlacementSelectionModule.resolvePrePlacementSelectionAction({
            CardLogic,
            cardState,
            gameState,
            playerKey,
            action,
            events,
            prng: p,
            pending,
            createDestroyOutcome,
            isDestroyOutcomeResolved,
            applyTrapEffectsAfterSelection: () => applyTrapEffectsAfterSelection(CardLogic, cardState, gameState, playerKey, events),
            handOffTurnAfterSelection: () => {
                if (!(ActionPhaseTurnHandoffModule && typeof ActionPhaseTurnHandoffModule.handOffTurnAfterSelection === 'function')) {
                    throw new Error('TurnPipeline handoff module unavailable');
                }
                ActionPhaseTurnHandoffModule.handOffTurnAfterSelection({
                    Core,
                    CardLogic,
                    cardState,
                    gameState,
                    playerKey,
                    advanceGameRoundAfterCompletedTurn: (nextCore: any, nextGameState: any, nextPlayerKey: any, options: any) => {
                        if (!(TurnRoundStateModule && typeof TurnRoundStateModule.advanceGameRoundAfterCompletedTurn === 'function')) {
                            throw new Error('TurnPipeline round state module unavailable');
                        }
                        return TurnRoundStateModule.advanceGameRoundAfterCompletedTurn({
                            Core: nextCore,
                            gameState: nextGameState,
                            playerKey: nextPlayerKey,
                            options,
                            normalizePlayerKey
                        });
                    }
                });
            },
            emitDurationSelectionStatusTick: (target: any, reason: any, highlightTone: any) => (
                emitDurationSelectionStatusTick(CardLogic, cardState, target, reason, highlightTone, presentationStartIndex)
            ),
            emitHandRemovePresentation: (payload: any) => emitHandRemovePresentation(CardLogic, cardState, payload),
            emitHandAddPresentation: (payload: any) => emitHandAddPresentation(CardLogic, cardState, payload)
        });
        if (!handledPrePlacementSelection) return false;

        const immediateSelectionResult = typeof handledPrePlacementSelection === 'object'
            ? handledPrePlacementSelection.immediateFlipResult
            : null;
        if (immediateSelectionResult && Array.isArray(immediateSelectionResult.flipped) && immediateSelectionResult.flipped.length) {
            applyGeneratedSpawnFlipResultsImmediate(CardLogic, cardState, gameState, events, [{
                ownerKey: playerKey,
                cause: 'CLONE_WILL',
                reason: 'clone_spawn',
                flipped: immediateSelectionResult.flipped
            }]);
        }
        const generatedSpawnFlipResults = typeof handledPrePlacementSelection === 'object'
            ? handledPrePlacementSelection.generatedSpawnFlipResults
            : null;
        if (Array.isArray(generatedSpawnFlipResults) && generatedSpawnFlipResults.length) {
            applyGeneratedSpawnFlipResultsImmediate(
                CardLogic,
                cardState,
                gameState,
                events,
                generatedSpawnFlipResults
            );
        }
        if (typeof CardLogic.consumeGeneratedSpawnFlipResults === 'function') {
            applyGeneratedSpawnFlipResultsImmediate(
                CardLogic,
                cardState,
                gameState,
                events,
                CardLogic.consumeGeneratedSpawnFlipResults(cardState)
            );
        }
        return true;
    }

    function applyPlacementResolutionStage(ctx: TurnPipelinePhaseContext): boolean {
        const { CardLogic, Core, BoardOps, cardState, gameState, playerKey, action, events } = ctx;
        const p = ctx.prng;
        const pendingType = getPendingEffectTypeForActionPhase(CardLogic, cardState, playerKey);
        const placementResolution = (ActionPhasePlaceResolutionModule && typeof ActionPhasePlaceResolutionModule.resolvePlacementAction === 'function')
            ? ActionPhasePlaceResolutionModule.resolvePlacementAction({
                CardLogic,
                Core,
                BoardOps,
                cardState,
                gameState,
                playerKey,
                action,
                events,
                prng: p,
                pendingType,
                resolveSafeCardContext,
                getActionCellOwner: (state: any, row: any, col: any) => (
                    getActionCellOwner(state, cardState, row, col)
                ),
                getPendingEffectTypeForActionPhase,
                applyTrapEffectsAfterSelection: () => applyTrapEffectsAfterSelection(CardLogic, cardState, gameState, playerKey, events),
                handOffTurnAfterSelection: () => {
                    if (!(ActionPhaseTurnHandoffModule && typeof ActionPhaseTurnHandoffModule.handOffTurnAfterSelection === 'function')) {
                        throw new Error('TurnPipeline handoff module unavailable');
                    }
                    ActionPhaseTurnHandoffModule.handOffTurnAfterSelection({
                        Core,
                        CardLogic,
                        cardState,
                        gameState,
                        playerKey,
                        advanceGameRoundAfterCompletedTurn: (nextCore: any, nextGameState: any, nextPlayerKey: any, options: any) => {
                            if (!(TurnRoundStateModule && typeof TurnRoundStateModule.advanceGameRoundAfterCompletedTurn === 'function')) {
                                throw new Error('TurnPipeline round state module unavailable');
                            }
                            return TurnRoundStateModule.advanceGameRoundAfterCompletedTurn({
                                Core: nextCore,
                                gameState: nextGameState,
                                playerKey: nextPlayerKey,
                                options,
                                normalizePlayerKey
                            });
                        }
                    });
                },
                resolveBoardBonusGain,
                applyPlacementBoardBonusGain,
                applyPostFlipRevives,
                isOthelloMode: () => isOthelloModeForTurnPipelinePhases()
            })
            : null;
        if (!placementResolution) {
            throw new Error('TurnPipeline placement resolution module unavailable');
        }
        if (placementResolution.completedSelectionOnly) {
            return true;
        }
        const preExtra = placementResolution.preExtra || 0;
        const turnNumberBeforePlace = Number(placementResolution.turnNumberBeforePlace || 0);
        const othelloMode = !!placementResolution.othelloMode;
        const numberCellMultiplierConfig = placementResolution.numberCellMultiplierConfig || null;
        const boardBonusGained = Number(placementResolution.boardBonusGained || 0);
        const flipCount = Number(placementResolution.flipCount || 0);
        const theoryManifestPlaced = placementResolution.theoryManifestPlaced === true;

        const effects = (ActionPhasePlacementEffectsModule && typeof ActionPhasePlacementEffectsModule.resolvePlacementEffects === 'function')
            ? ActionPhasePlacementEffectsModule.resolvePlacementEffects({
                CardLogic,
                cardState,
                gameState,
                playerKey,
                action,
                flipCount,
                othelloMode,
                boardBonusGained,
                numberCellMultiplierConfig,
                events
            })
            : null;
        if (!effects) {
            throw new Error('TurnPipeline placement effects module unavailable');
        }
        if (ActionPhasePlacementImmediateEffectsModule && typeof ActionPhasePlacementImmediateEffectsModule.resolvePlacementImmediateEffects === 'function') {
            ActionPhasePlacementImmediateEffectsModule.resolvePlacementImmediateEffects({
                CardLogic,
                cardState,
                gameState,
                playerKey,
                action,
                events,
                effects,
                prng: p,
                othelloMode,
                boardBonusGained,
                flipCount,
                awardBoardChargeGain,
                applyPostFlipRevives,
                buildPlacementChargeBubblePayload,
                emitBoardChargeBubblePresentation,
                emitSpecialStonePlacementBubbleFromEffects,
                pushTrapEvents,
                emitTrapHandRemoveEvents,
                debugLog: logTurnPipelinePhasesDebug
            });
        }
        if (typeof CardLogic.consumeGeneratedSpawnFlipResults === 'function') {
            applyGeneratedSpawnFlipResultsImmediate(
                CardLogic,
                cardState,
                gameState,
                events,
                CardLogic.consumeGeneratedSpawnFlipResults(cardState)
            );
        }

        if (
            !theoryManifestPlaced &&
            !othelloMode &&
            CardLogic &&
            typeof CardLogic.processTheoryIncarnationMarkerAfterOwnerPlacement === 'function'
        ) {
            const theoryPlacementRes = CardLogic.processTheoryIncarnationMarkerAfterOwnerPlacement(cardState, gameState, playerKey, p);
            if (theoryPlacementRes && theoryPlacementRes.spawned) {
                if (!TheorySpawnResolutionModule || typeof TheorySpawnResolutionModule.resolveTheorySpawnTurnResult !== 'function') {
                    throw new Error('TurnPipeline theory spawn resolution module unavailable');
                }
                TheorySpawnResolutionModule.resolveTheorySpawnTurnResult({
                    CardLogic,
                    cardState,
                    gameState,
                    playerKey,
                    events,
                    spawned: theoryPlacementRes.spawned,
                    prng: p,
                    timing: 'after_owner_placement',
                    awardBoardChargeGain
                });
            }
            if (theoryPlacementRes && theoryPlacementRes.expired) {
                events.push({ type: 'theory_incarnation_marker_expired', detail: theoryPlacementRes.expired });
            }
        }

        if (ActionPhaseContinuationModule && typeof ActionPhaseContinuationModule.resolvePlacementContinuation === 'function') {
            ActionPhaseContinuationModule.resolvePlacementContinuation({
                Core,
                CardLogic,
                cardState,
                gameState,
                playerKey,
                pendingType,
                preExtra,
                turnNumberBeforePlace,
                events,
                resolveSafeCardContext,
                readPendingForActionPhase,
                clearPendingForActionPhase,
                keepTurnActive: () => {
                    const playerValue = playerKey === 'black' ? Core.BLACK : Core.WHITE;
                    gameState.currentPlayer = playerValue;
                    gameState.consecutivePasses = 0;
                    gameState.turnNumber = turnNumberBeforePlace;
                },
                handOffCompletedTurn: () => {
                    if (!(ActionPhaseTurnHandoffModule && typeof ActionPhaseTurnHandoffModule.handOffCompletedTurn === 'function')) {
                        throw new Error('TurnPipeline handoff module unavailable');
                    }
                    ActionPhaseTurnHandoffModule.handOffCompletedTurn({
                        Core,
                        CardLogic,
                        cardState,
                        gameState,
                        playerKey,
                        turnNumberAfterCompletion: turnNumberBeforePlace + 1,
                        advanceGameRoundAfterCompletedTurn: (nextCore: any, nextGameState: any, nextPlayerKey: any, options: any) => {
                            if (!(TurnRoundStateModule && typeof TurnRoundStateModule.advanceGameRoundAfterCompletedTurn === 'function')) {
                                throw new Error('TurnPipeline round state module unavailable');
                            }
                            return TurnRoundStateModule.advanceGameRoundAfterCompletedTurn({
                                Core: nextCore,
                                gameState: nextGameState,
                                playerKey: nextPlayerKey,
                                options,
                                normalizePlayerKey
                            });
                        }
                    });
                }
            });
        } else {
            throw new Error('TurnPipeline continuation module unavailable');
        }
        return false;
    }

    function applyActionPhase(CardLogic: any, Core: any, cardState: any, gameState: any, playerKey: any, action: any, events: any, prng: any, BoardOps: any) {
        const ctx = createTurnPipelinePhaseContext(CardLogic, Core, cardState, gameState, playerKey, events, prng, BoardOps, action);
        const actionTurnNumber = Number(gameState && gameState.turnNumber || 0);
        const phaseSnapshot = snapshotTurnPhasePresentationStart(ctx);
        const presentationStartIndex = phaseSnapshot.presentationStartIndex;
        try {
            if (action.type === 'pass') {
                applyPassActionStage(ctx);
            } else if (action.type === 'use_card') {
            applyUseCardOnlyActionStage(ctx);
            return;
        } else if (action.type === 'cancel_card') {
            applyCancelCardActionStage(ctx);
            return;
        } else if (action.type === 'destroy_hand_card') {
            applyDestroyHandCardActionStage(ctx);
            return;
        } else if (action.type === 'place') {
            if (applyPrePlacementSelectionStage(ctx, presentationStartIndex)) {
                return;
            }
            if (applyPlacementResolutionStage(ctx)) {
                return;
            }
        } else {
            throw new Error('Unknown action.type');
        }
        } finally {
            if (CardLogic && typeof CardLogic.syncPoisonContacts === 'function') {
                CardLogic.syncPoisonContacts(cardState, gameState, actionTurnNumber);
            }
            finalizeActionPhasePresentation(ctx, phaseSnapshot);
        }
    }

export = { applyTurnStartPhase, applyCardUsagePhase, applyActionPhase, setTurnPipelinePhasesRuntime };
