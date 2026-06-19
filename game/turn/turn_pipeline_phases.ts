declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

    const TURN_PIPELINE_PHASE_MODULE_GLOBALS: Record<string, string> = Object.freeze({
        '../logic/markers_adapter': 'MarkersAdapter',
        '../logic/cards/utils': 'CardUtils',
        '../logic/context': 'CardContext',
        '../../shared-constants': 'SharedConstants',
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

    const FALLBACK_WORK_BUBBLE_SPEECH = Object.freeze({
        placeLines: Object.freeze(['ここで稼ぐ！']),
        lostLine: 'あああああああああああああ'
    });

    function getLegacySpecialStoneBubbleSpeech(type: any) {
        const key = String(type || '').trim().toUpperCase();
        if (key === 'WORK') {
            return {
                placeLines: (
                    PhaseHelpersModule &&
                    Array.isArray(PhaseHelpersModule.WORK_PLACE_LINES) &&
                    PhaseHelpersModule.WORK_PLACE_LINES.length > 0
                ) ? PhaseHelpersModule.WORK_PLACE_LINES : FALLBACK_WORK_BUBBLE_SPEECH.placeLines,
                lostLine: (
                    PhaseHelpersModule &&
                    typeof PhaseHelpersModule.WORK_LOST_LINE === 'string'
                ) ? PhaseHelpersModule.WORK_LOST_LINE : FALLBACK_WORK_BUBBLE_SPEECH.lostLine
            };
        }
        return null;
    }

    const getSpecialStoneBubbleSpeech = (
        PhaseHelpersModule &&
        typeof PhaseHelpersModule.getSpecialStoneBubbleSpeech === 'function'
    ) ? PhaseHelpersModule.getSpecialStoneBubbleSpeech : getLegacySpecialStoneBubbleSpeech;
    const workBubbleSpeech = getSpecialStoneBubbleSpeech('WORK') || getLegacySpecialStoneBubbleSpeech('WORK');
    const WORK_PLACE_LINES = (
        workBubbleSpeech &&
        Array.isArray(workBubbleSpeech.placeLines) &&
        workBubbleSpeech.placeLines.length > 0
    ) ? workBubbleSpeech.placeLines : FALLBACK_WORK_BUBBLE_SPEECH.placeLines;
    const WORK_LOST_LINE = (
        workBubbleSpeech &&
        typeof workBubbleSpeech.lostLine === 'string'
    ) ? workBubbleSpeech.lostLine : FALLBACK_WORK_BUBBLE_SPEECH.lostLine;
    function resolveStrongWillDisplayTimer(markerData: any) {
        if (!markerData || String(markerData.type || '').toUpperCase() !== 'PERMA_PROTECTED') return undefined;
        const rawThreshold = Number(markerData.strongWillPromotionThreshold);
        const thresholdFallback = Number(SharedConstantsModule && SharedConstantsModule.STRONG_WILL_PROMOTION_OWNER_TURNS);
        const threshold = Number.isFinite(rawThreshold)
            ? Math.max(1, Math.trunc(rawThreshold))
            : (Number.isFinite(thresholdFallback) ? Math.max(1, Math.trunc(thresholdFallback)) : 20);
        const rawProgress = Number(markerData.strongWillPromotionOwnerTurnStarts);
        const progress = Number.isFinite(rawProgress) ? Math.max(0, Math.trunc(rawProgress)) : 0;
        return Math.max(0, threshold - progress);
    }

    function resolveSpecialStatusTimer(markerData: any) {
        const remainingOwnerTurns = Number(markerData && markerData.remainingOwnerTurns);
        if (Number.isFinite(remainingOwnerTurns)) return Math.max(0, Math.trunc(remainingOwnerTurns));
        return resolveStrongWillDisplayTimer(markerData);
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
        : function resolveWorkIncomeLineFallback(gained: any) {
            return `布石+${Number(gained) || 0} 労働の成果だ`;
        };

    const getSpecialStoneBubbleSpeechLines = (
        PhaseHelpersModule &&
        typeof PhaseHelpersModule.getSpecialStoneBubbleSpeechLines === 'function'
    )
        ? PhaseHelpersModule.getSpecialStoneBubbleSpeechLines
        : function getSpecialStoneBubbleSpeechLinesFallback(type: any, scenario: any) {
            const speech = getSpecialStoneBubbleSpeech(type);
            if (!speech) return null;
            const scenarioKey = String(scenario || '').trim().toLowerCase();
            if (scenarioKey === 'place' && Array.isArray(speech.placeLines) && speech.placeLines.length > 0) {
                return speech.placeLines;
            }
            if (scenarioKey === 'destroy' && typeof speech.lostLine === 'string' && speech.lostLine) {
                return [speech.lostLine];
            }
            if (Array.isArray(speech[scenarioKey]) && speech[scenarioKey].length > 0) {
                return speech[scenarioKey];
            }
            return null;
        };

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

    function applyTurnStartPhase(CardLogic: any, Core: any, cardState: any, gameState: any, playerKey: any, events: any, prng: any) {
        const p = prng || undefined;

        if (PendingCoordinatorModule && typeof PendingCoordinatorModule.syncPendingSelectionActionCache === 'function') {
            PendingCoordinatorModule.syncPendingSelectionActionCache(cardState);
        }

        if (cardState.lastTurnStartedFor !== playerKey) {
            // Set the active turn player for SALVATION_WILL destruction tracking and reset the
            // opponent's beneficiary ledger so this turn can accumulate every destroyed stone.
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

            // Clear FATE_WILL controller for the opponent if the current player was that controller.
            // This means the single controlled opponent turn has already completed.
            if (cardState.fateWillControllerByTurnOwner) {
                if (cardState.fateWillControllerByTurnOwner[opponentKeyForSalvation] === playerKey) {
                    cardState.fateWillControllerByTurnOwner[opponentKeyForSalvation] = null;
                }
            }

            if (!(TurnRoundStateModule && typeof TurnRoundStateModule.ensureGameRoundState === 'function' && typeof TurnRoundStateModule.applyPendingRoundBonusAtTurnStart === 'function')) {
                throw new Error('TurnPipeline round state module unavailable');
            }
            TurnRoundStateModule.ensureGameRoundState({ Core, gameState });
            const roundBonusSummary = TurnRoundStateModule.applyPendingRoundBonusAtTurnStart({
                CardLogic,
                Core,
                cardState,
                gameState,
                events,
                addChargeWithTotal
            });
            const eventStartIndex = Array.isArray(events)
                ? events.length
                : 0;
            const presentationStartIndex = Array.isArray(cardState.presentationEvents)
                ? cardState.presentationEvents.length
                : 0;
            const workMarkersBeforeStart = snapshotWorkMarkers(cardState);
            const specialStoneSpeechBeforeStart = snapshotSpecialStoneSpeechMarkers(cardState);
            const timerSnapshot = (TurnStartTimerPhaseModule && typeof TurnStartTimerPhaseModule.snapshotTurnStartTimers === 'function')
                ? TurnStartTimerPhaseModule.snapshotTurnStartTimers(cardState, {
                    getMarkers: (nextCardState: any) => (MarkersAdapter && typeof MarkersAdapter.getMarkers === 'function')
                        ? MarkersAdapter.getMarkers(nextCardState)
                        : (nextCardState.markers || []),
                    isBombCategoryMarker,
                    resolveSpecialStatusTimer,
                    specialStoneKind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone'
                })
                : new Map();
            const turnStartTimerTickEmittedKeys = new Set<string>();

            const othelloMode = isOthelloModeForTurnPipelinePhases();
            const turnStartMarkerAnchors = (!othelloMode && TurnStartMarkerPhaseModule && typeof TurnStartMarkerPhaseModule.collectTurnStartMarkerAnchors === 'function')
                ? TurnStartMarkerPhaseModule.collectTurnStartMarkerAnchors(cardState, {
                    getMarkers: (nextCardState: any) => (MarkersAdapter && typeof MarkersAdapter.getMarkers === 'function')
                        ? MarkersAdapter.getMarkers(nextCardState)
                        : (nextCardState.markers || []),
                    isBombCategoryMarker
                })
                : [];
            const turnStartOptions: any = {
                deferGuardDurationEndUntilAfterTurnStartMarkers: true
            };
            if (roundBonusSummary) {
                turnStartOptions.skipStoneSalvationGodRevives = true;
            }
            const hasSplitTurnStartHooks = !othelloMode
                && CardLogic
                && typeof CardLogic.onTurnStartBeforeAnchors === 'function'
                && typeof CardLogic.drawForTurnStart === 'function';
            const turnStartSummary = othelloMode
                ? null
                : (hasSplitTurnStartHooks
                    ? (CardLogic.onTurnStartBeforeAnchors(cardState, playerKey, gameState, p, turnStartOptions) || null)
                    : (CardLogic.onTurnStart(cardState, playerKey, gameState, p, turnStartOptions) || null));
            events.push({ type: 'turn_start', player: playerKey });
            if (turnStartSummary && turnStartSummary.ribo && Array.isArray(turnStartSummary.ribo.entries)) {
                for (const entry of turnStartSummary.ribo.entries) {
                    if (!entry) continue;
                    if (entry.shortage) {
                        events.push({
                            type: 'ribo_will_shortage',
                            player: playerKey,
                            destroyed: Array.isArray(entry.destroyed) ? entry.destroyed.slice() : [],
                            destroyedCount: Number(entry.destroyedCount) || 0,
                            remainingOwnerTurns: Number(entry.remainingOwnerTurnsAfter) || 0,
                            completed: entry.completed === true
                        });
                    } else {
                        events.push({
                            type: 'ribo_will_repaid',
                            player: playerKey,
                            repaid: Number(entry.repaid) || 0,
                            remainingOwnerTurns: Number(entry.remainingOwnerTurnsAfter) || 0,
                            completed: entry.completed === true
                        });
                    }
                }
            }
            if (turnStartSummary && turnStartSummary.observerWill && Array.isArray(turnStartSummary.observerWill.entries)) {
                for (const entry of turnStartSummary.observerWill.entries) {
                    if (!entry) continue;
                    if (entry.shortage) {
                        events.push({
                            type: 'observer_will_shortage',
                            player: playerKey,
                            destroyed: Array.isArray(entry.destroyed) ? entry.destroyed.slice() : [],
                            destroyedCount: Number(entry.destroyedCount) || 0,
                            remainingOwnerTurns: Number(entry.remainingOwnerTurnsAfter) || 0,
                            completed: entry.completed === true
                        });
                    } else {
                        events.push({
                            type: 'observer_will_repaid',
                            player: playerKey,
                            repaid: Number(entry.repaid) || 0,
                            remainingOwnerTurns: Number(entry.remainingOwnerTurnsAfter) || 0,
                            completed: entry.completed === true
                        });
                    }
                }
            }
            if (turnStartSummary && turnStartSummary.boardExecutor && turnStartSummary.boardExecutor.applied) {
                events.push({
                    type: 'board_executor_hand_tax',
                    player: playerKey,
                    lost: Number(turnStartSummary.boardExecutor.lost) || 0,
                    handCount: Number(turnStartSummary.boardExecutor.handCount) || 0
                });
            }
            if (turnStartSummary && Array.isArray(turnStartSummary.generatedSpawnFlipResults) && turnStartSummary.generatedSpawnFlipResults.length) {
                applyGeneratedSpawnFlipResultsTurnStart(
                    CardLogic,
                    cardState,
                    gameState,
                    events,
                    turnStartSummary.generatedSpawnFlipResults
                );
            }

            if (othelloMode) {
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
                        timerSnapshot,
                        marker,
                        emittedTimerTickKeys: turnStartTimerTickEmittedKeys,
                        getMarkers: (nextCardState: any) => (MarkersAdapter && typeof MarkersAdapter.getMarkers === 'function')
                            ? MarkersAdapter.getMarkers(nextCardState)
                            : (nextCardState.markers || []),
                        isBombCategoryMarker,
                        resolveSpecialStatusTimer,
                        specialStoneKind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone'
                    });
                })
                : undefined;
            const processedTurnStartMarkers = (TurnStartMarkerPhaseModule && typeof TurnStartMarkerPhaseModule.processTurnStartMarkers === 'function')
                ? TurnStartMarkerPhaseModule.processTurnStartMarkers({
                    CardLogic,
                    cardState,
                    gameState,
                    playerKey,
                    events,
                    prng: p,
                    markers: turnStartMarkerAnchors,
                    isFrozenCell,
                    awardBoardChargeGain,
                    flushPostFlipRevivesForAnchor,
                    emitTimerStatusTickForAnchor,
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
                    workMarkersBeforeStart,
                    specialStoneSpeechBeforeStart,
                    eventStartIndex,
                    presentationStartIndex,
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
                    timerSnapshot,
                    emittedTimerTickKeys: turnStartTimerTickEmittedKeys,
                    getMarkers: (nextCardState: any) => (MarkersAdapter && typeof MarkersAdapter.getMarkers === 'function')
                        ? MarkersAdapter.getMarkers(nextCardState)
                        : (nextCardState.markers || []),
                    isBombCategoryMarker,
                    resolveSpecialStatusTimer,
                    specialStoneKind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone'
                });
            }

            if (hasSplitTurnStartHooks) {
                CardLogic.drawForTurnStart(cardState, playerKey, p, turnStartOptions);
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

    function getActionCellOwner(gameState: any, row: any, col: any) {
        if (!gameState) return null;

        const boardRow = Array.isArray(gameState.board) ? gameState.board[row] : null;
        if (Array.isArray(boardRow) && Number.isInteger(col) && col >= 0 && col < boardRow.length) {
            return boardRow[col];
        }

        const expansion = gameState.boardExpansion;
        const cells = Array.isArray(expansion && expansion.cells)
            ? expansion.cells
            : ((expansion && expansion.active) ? [expansion] : []);

        for (const cell of cells) {
            if (!cell) continue;
            const cellRow = Number(cell.row);
            let cellCol = Number.isInteger(cell.col) ? cell.col : null;
            if (!Number.isInteger(cellCol)) {
                if (cell.side === 'left') cellCol = -1;
                else if (cell.side === 'right') cellCol = 8;
            }
            if (cellRow !== row || cellCol !== col) continue;
            const owner = Number(cell.owner);
            return Number.isFinite(owner) ? owner : null;
        }

        return null;
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

    function applyActionPhase(CardLogic: any, Core: any, cardState: any, gameState: any, playerKey: any, action: any, events: any, prng: any, BoardOps: any) {
        const p = prng || undefined;
        const workMarkersBeforeAction = snapshotWorkMarkers(cardState);
        const specialStoneSpeechBeforeAction = snapshotSpecialStoneSpeechMarkers(cardState);
        const eventStartIndex = Array.isArray(events)
            ? events.length
            : 0;
        const presentationStartIndex = Array.isArray(cardState.presentationEvents)
            ? cardState.presentationEvents.length
            : 0;
        try {
            if (action.type === 'pass') {
                const playerValue = playerKey === 'black' ? Core.BLACK : Core.WHITE;
                const ctx = resolveSafeCardContext(CardLogic, cardState);
                const legalMoves = Core.getLegalMoves(gameState, playerValue, ctx);
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
                // Pass policy: abandon any unresolved card effect for this turn.
                applyPassCompletion(CardLogic, Core, cardState, gameState, playerKey, events);
            } else if (action.type === 'use_card') {
            events.push({ type: 'card_used_only', player: playerKey, cardId: action.useCardId || null });
            return;
        } else if (action.type === 'cancel_card') {
            const res = (typeof CardLogic.cancelPendingSelection === 'function')
                ? CardLogic.cancelPendingSelection(cardState, playerKey, action.cancelOptions)
                : { canceled: false, reason: 'not_supported' };
            events.push({ type: 'card_cancelled', player: playerKey, canceled: !!res.canceled, reason: res.reason || null, cardId: res.cardId || null });
            return;
        } else if (action.type === 'destroy_hand_card') {
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
            return;
        } else if (action.type === 'place') {
            // 3.5) Optional pre-placement selection effects (for cards that require a target)
            const pending = readPendingForActionPhase(cardState, playerKey);
            hydrateDeferredPendingSelectionState(pending, action);
            if (ActionPhasePrePlacementSelectionModule && typeof ActionPhasePrePlacementSelectionModule.resolvePrePlacementSelectionAction === 'function') {
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
                if (handledPrePlacementSelection) {
                    const immediateSelectionResult = handledPrePlacementSelection && typeof handledPrePlacementSelection === 'object'
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
                    const generatedSpawnFlipResults = handledPrePlacementSelection && typeof handledPrePlacementSelection === 'object'
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
                    return;
                }
            }

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
                    getActionCellOwner,
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
                    applyPlacementBoardBonusGain,
                    applyPostFlipRevives,
                    isOthelloMode: () => isOthelloModeForTurnPipelinePhases()
                })
                : null;
            if (!placementResolution) {
                throw new Error('TurnPipeline placement resolution module unavailable');
            }
            if (placementResolution.completedSelectionOnly) {
                return;
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
                    emitWorkBubblePresentation,
                    pickRandomLine,
                    workPlaceLines: WORK_PLACE_LINES,
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
        } else {
            throw new Error('Unknown action.type');
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
                    workMarkersBeforePhase: workMarkersBeforeAction,
                    specialStoneSpeechBeforePhase: specialStoneSpeechBeforeAction,
                    removalReason: 'removed_during_action',
                    emitWorkRemovedPresentationFromSnapshots,
                    emitSpecialStoneBubblesFromPhase
                });
            }
        }
    }

export = { applyTurnStartPhase, applyCardUsagePhase, applyActionPhase, setTurnPipelinePhasesRuntime };
