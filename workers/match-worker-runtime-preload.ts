type MatchWorkerRuntimeGlobalScope = Record<string, unknown>;
const ModuleExportUtils = require('../shared/module-export-utils');
const runtimeGlobalKeys: string[] = [];

export const WORKER_RUNTIME_GLOBAL_KEYS: readonly string[] = runtimeGlobalKeys;

function getRuntimeGlobalScopes(): MatchWorkerRuntimeGlobalScope[] {
    const scopes: MatchWorkerRuntimeGlobalScope[] = [];
    if (typeof globalThis !== 'undefined' && globalThis) {
        scopes.push(globalThis as MatchWorkerRuntimeGlobalScope);
    }
    if (typeof self !== 'undefined' && self) {
        const selfScope = self as MatchWorkerRuntimeGlobalScope;
        if (!scopes.includes(selfScope)) {
            scopes.push(selfScope);
        }
    }
    return scopes;
}

function unwrapModule(mod: unknown): unknown {
    if (ModuleExportUtils && typeof ModuleExportUtils.unwrapModuleExport === 'function') {
        return ModuleExportUtils.unwrapModuleExport(mod);
    }
    return mod && typeof mod === 'object' && 'default' in mod ? (mod as Record<string, unknown>).default : mod;
}

function hasUsableRuntimeModule(mod: unknown): boolean {
    if (ModuleExportUtils && typeof ModuleExportUtils.hasUsableModuleExport === 'function') {
        return ModuleExportUtils.hasUsableModuleExport(mod);
    }
    if (!mod) return false;
    if (typeof mod === 'function') return true;
    if (typeof mod !== 'object') return true;
    return Object.keys(mod as Record<string, unknown>).some((key) => key !== '__esModule');
}

const scopes = getRuntimeGlobalScopes();

function hasUsableGlobalRuntimeModule(globalKey: string): boolean {
    if (!globalKey) return false;
    for (const scope of scopes) {
        if (hasUsableRuntimeModule(scope[globalKey])) return true;
    }
    return false;
}

function setGlobalRuntimeModule(globalKey: string, value: unknown): void {
    for (const scope of scopes) {
        scope[globalKey] = value;
    }
}

function installRuntimeModule(globalKey: string, loadModule: () => unknown): void {
    if (!runtimeGlobalKeys.includes(globalKey)) {
        runtimeGlobalKeys.push(globalKey);
    }
    if (hasUsableGlobalRuntimeModule(globalKey)) return;
    const loadedModule = unwrapModule(loadModule());
    if (hasUsableRuntimeModule(loadedModule)) {
        setGlobalRuntimeModule(globalKey, loadedModule);
        return;
    }
    if (hasUsableGlobalRuntimeModule(globalKey)) return;
    setGlobalRuntimeModule(globalKey, loadedModule);
}

installRuntimeModule('CardCatalog', () => require('../cards/catalog.js'));
installRuntimeModule('SharedConstants', () => require('../shared-constants.js'));
installRuntimeModule('SharedBoardUtils', () => require('../shared/shared-board-utils.js'));
installRuntimeModule('DeckSpecHelpers', () => require('../shared/deck-spec.js'));
installRuntimeModule('DeckCodecModule', () => require('../shared/deck-codec.js'));
installRuntimeModule('PlayerEncoding', () => require('../shared/player-encoding.js'));
installRuntimeModule('DestroyOutcomeContract', () => require('../shared/destroy-outcome-contract.js'));
installRuntimeModule('EvasionStatus', () => require('../shared/evasion-status.js'));
installRuntimeModule('ManifestStoneRegistry', () => require('../shared/manifest-stone-registry.js'));
installRuntimeModule('StoneStatusSnapshot', () => require('../shared/stone-status-snapshot.js'));
installRuntimeModule('SpecialCardRegistry', () => require('../shared/special-card-registry.js'));
installRuntimeModule('SpecialStoneRegistry', () => require('../shared/special-stone-registry.js'));
installRuntimeModule('PresentationEffectProfiles', () => require('../shared/presentation-effect-profiles.js'));
installRuntimeModule('NetworkActionSchema', () => require('../shared/network-action-schema.js'));
installRuntimeModule('PlaybackEventHelpers', () => require('../shared/playback-event-helpers.js'));
installRuntimeModule('ControllerEvents', () => require('../game/controller-events.js'));
installRuntimeModule('SeededPRNG', () => require('../game/schema/prng.js'));
installRuntimeModule('CardRandomSource', () => require('../game/logic/cards-internal/random-source.js'));
installRuntimeModule('CardEvasionDestination', () => require('../game/logic/cards-internal/evasion-destination.js'));
installRuntimeModule('CardStateFactory', () => require('../game/logic/cards-internal/state-factory.js'));
installRuntimeModule('CardModuleResolver', () => require('../game/logic/cards-internal/module-resolver.js'));
installRuntimeModule('CardProtectionContext', () => require('../game/logic/cards-internal/protection-context.js'));
installRuntimeModule('CardPresentationHelpers', () => require('../game/logic/cards-internal/presentation-helpers.js'));
installRuntimeModule('CardCaptureSource', () => require('../game/logic/cards-internal/capture-source.js'));
installRuntimeModule('CardProgression', () => require('../game/logic/cards-internal/progression.js'));
installRuntimeModule('CardRandomBoardSpawn', () => require('../game/logic/cards-internal/random-board-spawn.js'));
installRuntimeModule('CardSpawnAndFlip', () => require('../game/logic/cards-internal/spawn-and-flip.js'));
installRuntimeModule('CardGeneratedSpawnFlipResolver', () => require('../game/logic/cards-internal/generated-spawn-flip-resolver.js'));
installRuntimeModule('CardRiboTimeStop', () => require('../game/logic/cards-internal/ribo-time-stop.js'));
installRuntimeModule('CardTargetAccess', () => require('../game/logic/cards-internal/target-access.js'));
installRuntimeModule('CardContextBuilders', () => require('../game/logic/cards-internal/context-builders.js'));
installRuntimeModule('CardTheoryIncarnationBindings', () => require('../game/logic/cards-internal/theory-incarnation-bindings.js'));
installRuntimeModule('CardDeckSetup', () => require('../game/logic/cards-internal/deck-setup.js'));
installRuntimeModule('CardHandAccess', () => require('../game/logic/cards-internal/hand-access.js'));
installRuntimeModule('CardAvailability', () => require('../game/logic/cards-internal/card-availability.js'));
installRuntimeModule('CardOfferBuilders', () => require('../game/logic/cards-internal/offer-builders.js'));
installRuntimeModule('CardEffectTargetCounts', () => require('../game/logic/cards-internal/effect-target-counts.js'));
installRuntimeModule('CardSalvationEffect', () => require('../game/logic/cards-internal/salvation-effect.js'));
installRuntimeModule('CardLossEffect', () => require('../game/logic/cards-internal/loss-effect.js'));
installRuntimeModule('CardFateEffect', () => require('../game/logic/cards-internal/fate-effect.js'));
installRuntimeModule('CardBoardConfiguration', () => require('../game/logic/cards-internal/board-configuration.js'));
installRuntimeModule('CardBoardShapeAccess', () => require('../game/logic/cards-internal/board-shape-access.js'));
installRuntimeModule('CardExpansionFallback', () => require('../game/logic/cards-internal/expansion-fallback.js'));
installRuntimeModule('CardHandManager', () => require('../game/logic/cards-internal/hand-manager.js'));
installRuntimeModule('CardChargeLedger', () => require('../game/logic/cards-internal/charge-ledger.js'));
installRuntimeModule('CardPendingStateManager', () => require('../game/logic/cards-internal/pending-state-manager.js'));
installRuntimeModule('CardUsagePrechecks', () => require('../game/logic/cards-internal/card-usage-prechecks.js'));
installRuntimeModule('CardEffectTiming', () => require('../game/logic/cards-internal/effect-timing.js'));
installRuntimeModule('CardUtils', () => require('../game/logic/cards/utils.js'));
installRuntimeModule('CardContext', () => require('../game/logic/context.js'));
installRuntimeModule('CardExpansion', () => require('../game/logic/cards/expansion.js'));
installRuntimeModule('CardSelectorsCoreUtils', () => require('../game/logic/cards/selectors-core-utils.js'));
installRuntimeModule('CardSelectorsBoardShape', () => require('../game/logic/cards/selectors-board-shape.js'));
installRuntimeModule('CardCellRemoval', () => require('../game/logic/cards/cell-removal.js'));
installRuntimeModule('CardCausalReplay', () => require('../game/logic/cards/causal_replay.js'));
installRuntimeModule('CardMovement', () => require('../game/logic/cards/movement.js'));
installRuntimeModule('CardTeleport', () => require('../game/logic/cards/teleport.js'));
installRuntimeModule('CardClone', () => require('../game/logic/cards/clone.js'));
installRuntimeModule('CardMeteor', () => require('../game/logic/cards/meteor.js'));
installRuntimeModule('CardMeteorGod', () => require('../game/logic/cards/meteor_god.js'));
installRuntimeModule('CardShrink', () => require('../game/logic/cards/shrink.js'));
installRuntimeModule('CardLivingWill', () => require('../game/logic/cards/living_will.js'));
installRuntimeModule('CardTargets', () => require('../game/logic/cards/targets.js'));
installRuntimeModule('CardFlips', () => require('../game/logic/cards/flips.js'));
installRuntimeModule('CardChain', () => require('../game/logic/cards/chain.js'));
installRuntimeModule('CardRegen', () => require('../game/logic/cards/regen.js'));
installRuntimeModule('CardZombieWill', () => require('../game/logic/cards/zombie_will.js'));
installRuntimeModule('CardTimeBomb', () => require('../game/logic/cards/time_bomb.js'));
installRuntimeModule('CardBreeding', () => require('../game/logic/cards/breeding.js'));
installRuntimeModule('DragonEffects', () => require('../game/logic/effects/dragon.js'));
installRuntimeModule('CardUdg', () => require('../game/logic/cards/udg.js'));
installRuntimeModule('CardHyperactiveBoardShape', () => require('../game/logic/cards/hyperactive-board-shape.js'));
installRuntimeModule('CardHyperactive', () => require('../game/logic/cards/hyperactive.js'));
installRuntimeModule('CardSniper', () => require('../game/logic/cards/sniper.js'));
installRuntimeModule('CardLightning', () => require('../game/logic/cards/lightning.js'));
installRuntimeModule('CardWillHunterKing', () => require('../game/logic/cards/will_hunter_king.js'));
installRuntimeModule('CardDestroyDragon', () => require('../game/logic/cards/destroy_dragon.js'));
installRuntimeModule('CardSelectors', () => require('../game/logic/cards/selectors.js'));
installRuntimeModule('CardWork', () => require('../game/logic/cards/work_will.js'));
installRuntimeModule('CardSacrificeWill', () => require('../game/logic/cards/sacrifice_will.js'));
installRuntimeModule('CardMarkers', () => require('../game/logic/cards/markers.js'));
installRuntimeModule('BoardOps', () => require('../game/logic/board_ops.js'));
installRuntimeModule('DestroyOneStoneEffects', () => require('../game/logic/effects/destroy_one_stone.js'));
installRuntimeModule('SwapWithEnemyEffects', () => require('../game/logic/effects/swap_with_enemy.js'));
installRuntimeModule('CardProtectEffects', () => require('../game/logic/card-resolution/protect.js'));
installRuntimeModule('CardTrapEffects', () => require('../game/logic/card-resolution/trap.js'));
installRuntimeModule('CardOwnershipEffects', () => require('../game/logic/card-resolution/ownership.js'));
installRuntimeModule('CardBoardExpansionApply', () => require('../game/logic/card-resolution/board-expansion-apply.js'));
installRuntimeModule('CardHandEffects', () => require('../game/logic/card-resolution/hand-effects.js'));
installRuntimeModule('CardObserverWillResolution', () => require('../game/logic/card-resolution/observer-will.js'));
installRuntimeModule('CardTheoryIncarnationResolution', () => require('../game/logic/card-resolution/theory-incarnation.js'));
installRuntimeModule('CardChaosSummonResolution', () => require('../game/logic/card-resolution/chaos-summon.js'));
installRuntimeModule('CardBoardExecutorResolution', () => require('../game/logic/card-resolution/board-executor.js'));
installRuntimeModule('SpecialStoneMarkerFactory', () => require('../game/logic/card-resolution/special-stone-marker-factory.js'));
installRuntimeModule('CardPositionSwapEffects', () => require('../game/logic/card-resolution/position-swap.js'));
installRuntimeModule('CardStatusCellsEffects', () => require('../game/logic/card-resolution/status-cells.js'));
installRuntimeModule('CardStateManager', () => require('../game/cards/state-manager.js'));
installRuntimeModule('CardUsageConsumptionStage', () => require('../game/cards/card-usage-consumption-stage.js'));
installRuntimeModule('CardUsagePendingStage', () => require('../game/cards/card-usage-pending-stage.js'));
installRuntimeModule('CardUsageImmediateStage', () => require('../game/cards/card-usage-immediate-stage.js'));
installRuntimeModule('CardUsageSacrificeStage', () => require('../game/cards/card-usage-sacrifice-stage.js'));
installRuntimeModule('CardUsagePresentationStage', () => require('../game/cards/card-usage-presentation-stage.js'));
installRuntimeModule('CardUsageValidationStage', () => require('../game/cards/card-usage-validation-stage.js'));
installRuntimeModule('CardEffectResolver', () => require('../game/cards/effect-resolver.js'));
installRuntimeModule('CardTimingProcessor', () => require('../game/cards/timing-processor.js'));
installRuntimeModule('CardTargetResolver', () => require('../game/cards/target-resolver.js'));
installRuntimeModule('MarkersAdapter', () => require('../game/logic/markers_adapter.js'));
installRuntimeModule('OwnerHelpers', () => require('../utils/owner-helpers.js'));
installRuntimeModule('PlaybackPlanner', () => require('../shared/playback-planner.js'));
installRuntimeModule('TurnPipelinePhaseHelpers', () => require('../game/turn/turn_pipeline_phase_helpers.js'));
installRuntimeModule('TurnPendingCoordinator', () => require('../game/turn/pending-coordinator.js'));
installRuntimeModule('TurnSubPlacementContinuation', () => require('../game/turn/sub-placement-continuation.js'));
installRuntimeModule('TurnActionPhaseContinuation', () => require('../game/turn/action-phase/continuation.js'));
installRuntimeModule('TurnActionPhasePlacementEffects', () => require('../game/turn/action-phase/placement-effects.js'));
installRuntimeModule('TurnCardUsageImmediateEffects', () => require('../game/turn/card-usage/immediate-effects.js'));
installRuntimeModule('TurnBoardCharge', () => require('../game/turn/board-charge.js'));
installRuntimeModule('TurnPresentationHelpers', () => require('../game/turn/presentation-helpers.js'));
installRuntimeModule('TurnRoundState', () => require('../game/turn/round-state.js'));
installRuntimeModule('TurnTheorySpawnImmediateEffects', () => require('../game/turn/theory-spawn-immediate-effects.js'));
installRuntimeModule('TurnTheorySpawnResolution', () => require('../game/turn/theory-spawn-resolution.js'));
installRuntimeModule('TurnActionPhasePrePlacementSelection', () => require('../game/turn/action-phase/pre-placement-selection.js'));
installRuntimeModule('TurnActionPhasePlaceResolution', () => require('../game/turn/action-phase/place-resolution.js'));
installRuntimeModule('TurnActionPhasePlacementImmediateEffects', () => require('../game/turn/action-phase/placement-immediate-effects.js'));
installRuntimeModule('TurnActionPhaseTurnHandoff', () => require('../game/turn/action-phase/turn-handoff.js'));
installRuntimeModule('TurnPhasePresentationFinalizer', () => require('../game/turn/phase-presentation-finalizer.js'));
installRuntimeModule('TurnStartBombPhase', () => require('../game/turn/turn-start/bomb-phase.js'));
installRuntimeModule('TurnStartSpecialStonePhase', () => require('../game/turn/turn-start/special-stone-phase.js'));
installRuntimeModule('TurnStartMarkerPhase', () => require('../game/turn/turn-start/marker-phase.js'));
installRuntimeModule('TurnStartPostProcessing', () => require('../game/turn/turn-start/post-processing.js'));
installRuntimeModule('TurnStartTimerPhase', () => require('../game/turn/turn-start/timer-phase.js'));
installRuntimeModule('PipelineUIBoardEventPlayback', () => require('../game/turn/pipeline-ui/board-event-playback.js'));
installRuntimeModule('PipelineUIBoardEventMapper', () => require('../game/turn/pipeline-ui/board-event-mapper.js'));
installRuntimeModule('PipelineUIPassiveEventPlayback', () => require('../game/turn/pipeline-ui/passive-event-playback.js'));
installRuntimeModule('PipelineUIPlaybackAfterState', () => require('../game/turn/pipeline-ui/playback-after-state.js'));
installRuntimeModule('PipelineUILogMappers', () => require('../game/turn/pipeline-ui/log-mappers.js'));
installRuntimeModule('PipelineUIPlaybackUtils', () => require('../game/turn/pipeline-ui/playback-utils.js'));
installRuntimeModule('PipelineUIGeneratedThrowChainPlayback', () => require('../game/turn/pipeline-ui/generated-throw-chain-playback.js'));
installRuntimeModule('PipelineUICardEconomySoundCues', () => require('../game/turn/pipeline-ui/card-economy-sound-cues.js'));
installRuntimeModule('PipelineUICoreSoundCues', () => require('../game/turn/pipeline-ui/core-sound-cues.js'));
installRuntimeModule('PipelineUIDestroySoundCues', () => require('../game/turn/pipeline-ui/destroy-sound-cues.js'));
installRuntimeModule('PipelineUISelectionSoundCues', () => require('../game/turn/pipeline-ui/selection-sound-cues.js'));
installRuntimeModule('PipelineUISoundCueHelpers', () => require('../game/turn/pipeline-ui/sound-cue-helpers.js'));
installRuntimeModule('PipelineUISoundCueAssembler', () => require('../game/turn/pipeline-ui/sound-cue-assembler.js'));
installRuntimeModule('PipelineUIPresentationEventIndex', () => require('../game/turn/pipeline-ui/presentation-event-index.js'));

Object.freeze(runtimeGlobalKeys);
