export type CardRuntimeEffectProfileId =
  | 'pure-query'
  | 'cold-cache-query'
  | 'rng-query'
  | 'cold-cache-rng-query'
  | 'canonical-mutation'
  | 'canonical-event-mutation'
  | 'canonical-rng-event-mutation'
  | 'cold-cache-canonical-mutation'
  | 'cold-cache-canonical-event-mutation'
  | 'cold-cache-canonical-rng-event-mutation'
  | 'runtime-state-mutation'
  | 'transport-payload-mutation'
  | 'presentation-event-mutation'
  | 'cold-cache-presentation-event-mutation';

export interface ExplicitCardRuntimeEntry {
  source: string;
  exportName: string;
  profile: CardRuntimeEffectProfileId;
  dependencyCohort:
    | 'state-deck-hand-charge'
    | 'target-legality'
    | 'board-topology'
    | 'marker-protection'
    | 'pending-cancellation'
    | 'canonical-resolution'
    | 'turn-phases'
    | 'command-boundary'
    | 'presentation';
  currentPreflight: 'none' | 'self' | 'outer';
  targetPreflight: 'self' | 'outer';
  dependencySensitive: boolean;
  firstObservableEffect: string;
  evidence: string;
}

type Cohort = ExplicitCardRuntimeEntry['dependencyCohort'];
type Preflight = ExplicitCardRuntimeEntry['currentPreflight'];

// This is intentionally independent of the preflight columns. A preflight can
// protect a stateful entry that has no optional runtime dependency, while a
// dependency-sensitive query may need a preflight despite making no writes.
const DEPENDENCY_INSENSITIVE_ENTRY_IDS = new Set<string>([
  'utils/match-auto-command.ts#isMatchAutoTurnPublishBody',
  'game/turn/pending-coordinator.ts#resolvePendingSelectionDispatchKey',
  'game/turn/pending-coordinator.ts#resolvePendingSelectionActionField',
  'game/turn/pending-coordinator.ts#buildPendingSelectionTargetPayload',
  'browser-vite/module-bridge.ts#resetModuleBridgeForTests'
]);

function entries(
  source: string,
  profile: CardRuntimeEffectProfileId,
  cohort: Cohort,
  currentPreflight: Preflight,
  targetPreflight: 'self' | 'outer',
  firstObservableEffect: string,
  evidence: string,
  names: readonly string[]
): ExplicitCardRuntimeEntry[] {
  return names.map((exportName) => ({
    source,
    exportName,
    profile,
    dependencyCohort: cohort,
    currentPreflight,
    targetPreflight,
    dependencySensitive: !DEPENDENCY_INSENSITIVE_ENTRY_IDS.has(`${source}#${exportName}`),
    firstObservableEffect,
    evidence
  }));
}

const FACADE_PURE_QUERY = Object.freeze([
  'getManifestMarkers', 'getActiveManifestMarkers', 'isManifestStoneMarker', 'isManifestStoneAt',
  'canUseTheoryIncarnation', 'canUseChaosSummon', 'canUseBoardExecutor', 'hasActiveObserverWillReveal',
  'getThrowChainConfig', 'getChainWillConfig',
  'getReinforcementWillTargets', 'getSupportTroopsWillTargets',
  'canUseReinforcementWillForPlayer', 'canUseSupportTroopsWillForPlayer',
  'getTimeStopGodDestroyableCount',
  'getTimeStopDeityDestroyableCount', 'canUseTimeStopDeityForPlayer', 'createZombieMarkerData',
  'hasPendingEffect', 'getPendingEffectType', 'isFreePlacementPendingType', 'getSelectableTargets',
  'getLivingWillTargets', 'getStrongWindTargets', 'getBuoyancyTargets', 'getSuperBuoyancyTargets',
  'getGravityTargets', 'getSuperGravityTargets', 'getSuperAttractionTargets',
  'getSuperAttractionPathPreview', 'getTabooReverseCandidates', 'getReverseWillTargets',
  'getTemptWillTargets', 'getCaptureWillTargets', 'getTemptTargets', 'getCaptureTargets',
  'getDestroyTargets', 'getSwapTargets', 'getPositionSwapTargets', 'getExtendLifeTargets',
  'getCorrosionTargets', 'getGuardTargets', 'getTimeBombTargets', 'getTeleportTargets',
  'getCellTeleportTargets', 'getCloneTargets', 'getBreedingTargets', 'getBoardExpansionTargets',
  'getBoardExpansionGodTargets', 'getBoardShrinkTargets', 'getBoardShrinkGodTargets',
  'getBlockadeTargets', 'getPoisonTargets', 'getScorchTargets', 'getHealingCellTargets',
  'getMeteorTargets', 'getCausalReplayTargets', 'getFreezeTargets', 'getSeedTargets',
  'getSniperTargets', 'getLightningTargets', 'getCrossBombTargets', 'getXBombTargets',
  'getReinforcementTargets', 'getEqualityTargets', 'getLastResortTargets',
  'getCurrentCornerCellsForCard', 'countOccupiedCornersForPlayer', 'isBlockedCell',
  'findManifestMarkerAt', 'isInviolableCell', 'isCardPlayLockedForPlayer',
  'isPlacementLockedForPlayer', 'isFrozenCell', 'getTrapTargets'
]);

const FACADE_COLD_CACHE_QUERY = Object.freeze([
  'copyCardState', 'canUseCard', 'analyzeCardUsability', 'getUsableCardIds', 'hasUsableCard',
  'getCardContext', 'buildCondemnOffers', 'getCardDef', 'getCardType', 'getCardDisplayName',
  'getCardCodeName', 'getCardCost', 'buildHeavenBlessingSeedHint', 'getHandCopyIdAt',
  'getHandCopyIds', 'isCardCopyIdRevealedToViewer', 'getEffectiveCardCostForCopy',
  'getEqualityWillBoardCounts', 'getEqualityWillChargeState', 'getReinforcementWillTargetCount',
  'getSupportTroopsWillTargetCount', 'getLossWillRemovableCount', 'collectMassFreezeWillTargets',
  'getMassFreezeWillTargetCount', 'getSalvationWillTargetCount', 'getExecutionWillTargetCount',
  'getFateWillControllerForTurnOwner'
]);

const FACADE_RNG_QUERY = Object.freeze(['pickTabooReverseFlips']);

const FACADE_COLD_CACHE_RNG_QUERY = Object.freeze(['buildHeavenBlessingOffers']);

const FACADE_CANONICAL_MUTATION = Object.freeze([
  'addMarker', 'removeMarkerById', 'addNumberCellCollectedTotal', 'destroyAt', 'clearBombAt',
  'clearHyperactiveAtPositions', 'consumeGeneratedSpawnFlipResults'
]);

const FACADE_COLD_CACHE_CANONICAL_MUTATION = Object.freeze([
  'destroyHandCard', 'ensureCardCopyState', 'revealCurrentHandToViewer',
  'setCardCostOverrideForCopyId', 'addCardCostModifierForCopyId', 'addCardToHand',
  'addCardToDiscard', 'removeHandCardAt', 'clearHandToDiscard',
  'moveDiscardCardToHandByCardId', 'allocateStoneId'
]);

const FACADE_CANONICAL_EVENT_MUTATION = Object.freeze([
  'applyObserverWillStoneReservation', 'applyTheoryIncarnationStoneReservation',
  'applyBoardExecutorStoneReservation', 'processUltimateDestroyGodEffects', 'processDragonEffects',
  'processDragonEffectsAtTurnStartAnchor', 'processDragonEffectsAtAnchor', 'applyPositionSwapWill',
  'applyStrongWill', 'applyHeavenBlessingChoice', 'applyRevealHandWill', 'applyCondemnWill',
  'applyObserverWillChoice', 'applyTemptWill', 'applyCaptureWill', 'applyExtendLifeWill',
  'applyExtendLifeGod', 'processHealingCellDurationBoosts', 'applyCorrosionWill', 'applyGuardWill',
  'applyTimeBombWill', 'applyBoardExpansionWill', 'applyBoardExpansionGod',
  'applyBoardShrinkWill', 'applyBoardShrinkGod', 'applyBlockadeWill', 'applyPoisonWill',
  'applyScorchedCell', 'applyHealingCell', 'syncPoisonContacts', 'syncScorchContacts',
  'syncHazardContacts', 'processPoisonTurnEnd', 'processStatusCellTurnEnd', 'applyFreezeWill',
  'applySeedWill', 'applySeedMarker', 'applyMassFreezeWill',
  'applyBuoyancyWill', 'applySuperBuoyancyWill', 'applyGravityWill', 'applySuperGravityWill',
  'armRiboWillEffect', 'resolveEqualityWillUsage', 'consumeTimeStopConsecutiveTurn', 'applyRegenWill',
  'applyRegenAfterFlips', 'processTimeStopEffectsAtTurnStartAnchor', 'cancelPendingSelection',
  'transferCellMarkerOwnership', 'applyTrapWill', 'processTrapEffects', 'applyCausalReplayWill'
]);

const FACADE_COLD_CACHE_CANONICAL_EVENT_MUTATION = Object.freeze([
  'applyDestroyEffect', 'applyDestroyEffectDetailed', 'applySwapEffect', 'applySwapEffectDetailed',
  'applyLivingWill', 'applyLivingWillAfterFlips', 'applyPostFlipRevives', 'applyReverseWill',
  'swapOccupiedCellsWithPresentation', 'applyLossWill', 'applyFateWill'
]);

const FACADE_CANONICAL_RNG_EVENT_MUTATION = Object.freeze([
  'processTheoryIncarnationMarkerAtPlacement',
  'processTheoryIncarnationMarkerAtTurnStart', 'processTheoryIncarnationMarkerAfterOwnerPlacement',
  'processTheoryIncarnationOwnerPass', 'processBoardExecutorMarkerAtTurnStart',
  'processBoardExecutorHandTaxAtTurnStart', 'processObserverWillMarkerAtTurnStart',
  'processObserverWillRepaymentsAtTurnStart',
  'processBreedingEffects', 'processSniperWillEffects', 'processDestroyDragonEffects',
  'processLightningWillEffects', 'processFireWillEffects', 'processWaterWillEffects',
  'processGrassWillEffects', 'processMeteorGodEffects', 'resolveShinraBanshoGodFusions',
  'consumeStoneSalvationGodRevives', 'spawnAndFlipPlacement',
  'tickBombs', 'tickBombAt', 'applyTeleportWill',
  'applyCellTeleportWill', 'applyCloneWill', 'applyMeteorWill',
  'applyExecutionWill', 'applyStrongWindWill', 'applySuperAttractionWill',
  'resolveReinforcementWillUsage', 'resolveSupportTroopsWillUsage', 'resolveTimeStopGodUsage',
  'resolveTimeStopDeityUsage', 'processZombieEffectsAtTurnStartAnchor',
  'processUltimateWorkGodAtTurnStartAnchor', 'applyChainWillAfterMove',
  'processBreedingEffectsAtTurnStartAnchor', 'processBreedingEffectsAtAnchor',
  'processUltimateDestroyGodEffectsAtTurnStartAnchor', 'processUltimateDestroyGodEffectsAtAnchor',
  'processSniperWillEffectsAtTurnStartAnchor', 'processLightningWillEffectsAtTurnStartAnchor',
  'processLightningWillEffectsAtAnchor', 'processFireWillEffectsAtTurnStartAnchor',
  'processFireWillEffectsAtAnchor', 'processWaterWillEffectsAtTurnStartAnchor',
  'processWaterWillEffectsAtAnchor', 'processGrassWillEffectsAtTurnStartAnchor',
  'processGrassWillEffectsAtAnchor', 'processShinraBanshoGodAtTurnStartAnchor',
  'processMeteorGodEffectsAtTurnStartAnchor', 'processMeteorGodEffectsAtAnchor',
  'processWillHunterKingEffectsAtTurnStartAnchor', 'processDestroyDragonEffectsAtAnchor',
  'processDestroyDragonEffectsAtTurnStartAnchor', 'resolveHyperactiveFlipEvasion',
  'processHyperactiveMoves', 'processHyperactiveMoveAtAnchor', 'processGluttonousMoveAtAnchor',
  'processRobotVacuumMoveAtAnchor', 'processInstantHyperactiveMoveAtAnchor',
  'processUltimateHyperactiveMoveAtAnchor', 'applyChaosSummonUsage'
]);

const FACADE_COLD_CACHE_CANONICAL_RNG_EVENT_MUTATION = Object.freeze([
  'dealInitialHands', 'commitDraw', 'applyCardUsage', 'onTurnStart',
  'onTurnStartBeforeAnchors', 'drawForTurnStart', 'flushDeferredTurnStartStatusExpirations',
  'processTurnStartStatusMarkerAnchor', 'applyPlacementEffects', 'applySalvationWill'
]);

const FACADE_PRESENTATION = Object.freeze(['emitPresentationEvent', 'flushPresentationEvents']);

export const EXPLICIT_CARD_RUNTIME_ENTRY_LEDGER: readonly ExplicitCardRuntimeEntry[] = Object.freeze([
  ...entries('game/logic/cards.ts', 'pure-query', 'target-legality', 'none', 'self', 'none (read-only result)', 'explicit facade query inventory; cold-cache queries are separated below', FACADE_PURE_QUERY),
  ...entries('game/logic/cards.ts', 'cold-cache-query', 'target-legality', 'none', 'self', 'first lazy module/cache assignment on a cold facade', 'facade call graph reaches a module-scoped lazy cache before returning', FACADE_COLD_CACHE_QUERY),
  ...entries('game/logic/cards.ts', 'rng-query', 'target-legality', 'none', 'self', 'first PRNG draw', 'function signature and call graph consume the supplied random source while returning a value', FACADE_RNG_QUERY),
  ...entries('game/logic/cards.ts', 'cold-cache-rng-query', 'state-deck-hand-charge', 'none', 'self', 'first lazy offer-builder assignment, then first offer PRNG draw', 'offer construction cold-initializes its builder before deterministic selection', FACADE_COLD_CACHE_RNG_QUERY),
  ...entries('game/logic/cards.ts', 'cold-cache-rng-query', 'state-deck-hand-charge', 'none', 'self', 'first deck PRNG draw while constructing the returned state, then generated-resolver cache assignment', 'argument evaluation calls CardStateFactory.createCardState before ensureGeneratedSpawnFlipResolver', ['createCardState']),
  ...entries('game/logic/cards.ts', 'canonical-mutation', 'state-deck-hand-charge', 'none', 'self', 'first canonical object/array write', 'explicit facade mutator inventory without an event or random path', FACADE_CANONICAL_MUTATION),
  ...entries('game/logic/cards.ts', 'cold-cache-canonical-mutation', 'state-deck-hand-charge', 'none', 'self', 'first lazy module/cache assignment on a cold facade, then first canonical object/array write', 'facade call graph reaches a module-scoped lazy cache before its canonical mutation', FACADE_COLD_CACHE_CANONICAL_MUTATION),
  ...entries('game/logic/cards.ts', 'canonical-event-mutation', 'canonical-resolution', 'none', 'self', 'first canonical write or ordered event append', 'explicit facade resolver inventory; no random parameter/path is accepted', FACADE_CANONICAL_EVENT_MUTATION),
  ...entries('game/logic/cards.ts', 'cold-cache-canonical-mutation', 'canonical-resolution', 'none', 'self', 'first timing-processor cache assignment or canonical pending-state clear', 'turn-end timing processing clears pending state and may initialize its module cache; it does not append/drain events or consume random input', ['onTurnEnd']),
  ...entries('game/logic/cards.ts', 'cold-cache-canonical-event-mutation', 'canonical-resolution', 'none', 'self', 'first lazy module/cache assignment on a cold facade, then first canonical write or ordered event append', 'facade call graph reaches a module-scoped lazy cache before its non-random resolver mutation', FACADE_COLD_CACHE_CANONICAL_EVENT_MUTATION),
  ...entries('game/logic/cards.ts', 'canonical-rng-event-mutation', 'canonical-resolution', 'none', 'self', 'first canonical write, ordered event append, or PRNG draw (whichever occurs first)', 'explicit facade resolver inventory with a random-source parameter/downstream random operation', FACADE_CANONICAL_RNG_EVENT_MUTATION),
  ...entries('game/logic/cards.ts', 'cold-cache-canonical-rng-event-mutation', 'canonical-resolution', 'none', 'self', 'first lazy module/cache assignment on a cold facade, then first canonical write, ordered event append, or PRNG draw', 'facade call graph reaches a module-scoped lazy cache before its random resolver mutation', FACADE_COLD_CACHE_CANONICAL_RNG_EVENT_MUTATION),
  ...entries('game/logic/cards.ts', 'cold-cache-canonical-rng-event-mutation', 'state-deck-hand-charge', 'none', 'self', 'first deck PRNG draw while constructing card state, before generated-resolver and hand-access cache assignment', 'initGame calls createCardState before dealInitialHands, so deterministic deck construction is the first observable effect', ['initGame']),
  ...entries('game/logic/cards.ts', 'cold-cache-presentation-event-mutation', 'presentation', 'none', 'self', 'first lazy context-builder assignment, then first presentation journal append/drain', 'presentation queue access cold-initializes the shared context-builder cache', FACADE_PRESENTATION),

  ...entries('game/cards/effect-resolver.ts', 'cold-cache-query', 'canonical-resolution', 'none', 'self', 'first compatibility module resolution/cache read', 'direct context export resolves required effect modules', ['getCardHandManagerContext', 'getCardEffectTimingContext', 'getCardContext']),
  ...entries('game/cards/effect-resolver.ts', 'canonical-rng-event-mutation', 'canonical-resolution', 'none', 'self', 'validation, then first consumption write; immediate stage may draw opts.prng', 'direct apply export passes opts.prng to immediate effects', ['applyCardUsage']),
  ...entries('game/cards/effect-resolver.ts', 'canonical-event-mutation', 'pending-cancellation', 'none', 'self', 'first refund/usage/hand/pending write', 'complete and classifier-only compatibility manager paths are executable public behavior', ['cancelPendingSelection']),

  ...entries('game/turn/turn_pipeline_phases.ts', 'canonical-rng-event-mutation', 'turn-phases', 'outer', 'outer', 'first phase state write, event append, or PRNG draw', 'phase exports are reached from the turn pipeline command entry', ['applyTurnStartPhase', 'applyCardUsagePhase', 'applyActionPhase']),
  ...entries('game/turn/turn_pipeline_phases.ts', 'runtime-state-mutation', 'turn-phases', 'none', 'self', 'assignment to turnPipelinePhasesRuntime', 'module-scoped phase runtime setter', ['setTurnPipelinePhasesRuntime']),
  ...entries('game/turn/turn_pipeline.ts', 'canonical-rng-event-mutation', 'turn-phases', 'none', 'self', 'first phase state write, event append, or PRNG draw', 'public/direct turn entry', ['applyTurn', 'applyTurnSafe']),
  ...entries('game/turn/turn_pipeline_factory.ts', 'pure-query', 'turn-phases', 'none', 'outer', 'none during construction; returned closure captures deps', 'factory currently stores deps without validating them; target outer composer validates first', ['createTurnPipelineModule']),

  ...entries('game/turn/pending-coordinator.ts', 'pure-query', 'pending-cancellation', 'none', 'self', 'none (read-only/constructed result)', 'explicit pending query/contract inventory', [
    'requiresPendingTarget', 'getPendingSelectionContract',
    'isSelectionOnlyEndTurnPendingType', 'shouldDeferNetworkPublishForPendingType',
    'shouldWaitForPlaybackIdleForPendingType', 'resolvePendingSelectionDispatchKey',
    'resolvePendingSelectionActionField', 'buildPendingSelectionTargetPayload',
    'shouldRetainPendingSelectionAction', 'readPendingSelectionAction'
  ]),
  ...entries('game/turn/pending-coordinator.ts', 'cold-cache-canonical-mutation', 'pending-cancellation', 'none', 'self', 'first owner-helper cache assignment or pendingEffectByPlayer shape repair', 'read helpers normalize through a lazy owner cache and ensure the canonical pending-by-player shape before returning', [
    'readPendingEffect', 'getPendingEffectType'
  ]),
  ...entries('game/turn/pending-coordinator.ts', 'transport-payload-mutation', 'pending-cancellation', 'none', 'self', 'first write to caller-owned transport payload', 'does not mutate canonical card state; enriches network/UI transport payload', ['applyPendingSelectionCardContext']),
  ...entries('game/turn/pending-coordinator.ts', 'canonical-mutation', 'pending-cancellation', 'none', 'self', 'first pendingEffectByPlayer write', 'canonical pending state owner', ['writePendingEffect', 'clearPendingEffect']),
  ...entries('game/turn/pending-coordinator.ts', 'cold-cache-canonical-mutation', 'pending-cancellation', 'none', 'self', 'first owner-helper/cache write or canonical pending clear, according to the requested branch', 'failure cleanup normalizes through lazy runtime caches and may also clear canonical pending state', ['clearPendingSelectionFailureState']),
  ...entries('game/turn/pending-coordinator.ts', 'runtime-state-mutation', 'pending-cancellation', 'none', 'self', 'first pendingSelectionActionByPlayer cache write', 'module-scoped pending action cache owner', [
    'storePendingSelectionAction', 'clearPendingSelectionAction',
    'clearPendingSelectionActionCache', 'syncPendingSelectionActionCache',
    'createPendingSelectionAction'
  ]),

  ...entries('utils/match-command-runtime.ts', 'pure-query', 'command-boundary', 'outer', 'outer', 'none (validation/preparation result)', 'outer command preparation/validation helpers', [
    'prepareMatchCommandAction', 'shouldSkipMatchCommandTurnStart', 'validateCanonicalMatchCommandSnapshot',
    'shouldReconcileMatchCommandTurnStart'
  ]),
  ...entries('utils/match-command-runtime.ts', 'pure-query', 'command-boundary', 'outer', 'outer', 'none on caller-owned state (returns a cloned/prepared command value)', 'command preparation validates capabilities and constructs a detached working snapshot before execution', ['prepareMatchCommandExecution']),
  ...entries('utils/match-command-runtime.ts', 'canonical-rng-event-mutation', 'command-boundary', 'outer', 'outer', 'first command state write, event append, or PRNG draw', 'pipeline execution and turn-start reconciliation are the random canonical command stages', [
    'applyPreparedMatchCommandExecution', 'reconcileMatchCommandTurnStart', 'executeMatchCommand'
  ]),
  ...entries('utils/match-command-runtime.ts', 'canonical-event-mutation', 'command-boundary', 'outer', 'outer', 'first canonical snapshot normalization or ordered presentation/event assembly', 'presentation assembly and finalization mutate the detached next snapshot and event payloads but do not consume random input', [
    'assembleMatchCommandActionPresentation', 'finalizeMatchCommandExecution'
  ]),
  ...entries('utils/match-auto-command.ts', 'pure-query', 'command-boundary', 'outer', 'outer', 'none (classification result)', 'AUTO publish shape classifier has no runtime dependency and does not invoke the planner', ['isMatchAutoTurnPublishBody']),
  ...entries('utils/match-auto-command.ts', 'cold-cache-rng-query', 'command-boundary', 'outer', 'outer', 'first planner cache/state write or planner PRNG draw', 'AUTO resolution invokes the canonical CPU network planner and is classified separately from the pure shape classifier', ['resolveMatchAutoTurnPublishBody']),
  ...entries('game/cpu-network-command-planner.ts', 'pure-query', 'command-boundary', 'outer', 'outer', 'none on canonical state (returns a planned command value)', 'UI and authority callers establish the runtime composition boundary; the planner preserves tagged runtime failures and only returns a command description', [
    'planCpuNetworkCommand', 'planCanonicalCpuNetworkCommand'
  ]),
  ...entries('scripts/local-match-runtime.ts', 'runtime-state-mutation', 'command-boundary', 'outer', 'outer', 'room construction captures the authoritative snapshot and operation ledger', 'public local authority factory exported from the production runtime module', ['createRuntime']),
  ...entries('workers/match-worker.ts', 'pure-query', 'command-boundary', 'outer', 'outer', 'none during factory construction', 'Worker composition factory', ['createWorkerTurnPipelineModule']),
  ...entries('workers/match-worker.ts', 'runtime-state-mutation', 'command-boundary', 'outer', 'outer', 'Durable Object construction/load or request dispatch reaches authoritative room state', 'public Worker Durable Object constructor and callable default.fetch authority entry', ['MatchRoomDurableObject', 'default.fetch']),
  ...entries('src/engine/selfplay-runner.ts', 'canonical-rng-event-mutation', 'command-boundary', 'outer', 'outer', 'first game initialization/turn mutation, event append, or deterministic PRNG draw', 'public selfplay execution entry exported by the production runner', ['runSingleGame']),
  ...entries('browser-vite/module-bridge.ts', 'pure-query', 'presentation', 'outer', 'outer', 'none (registered module read)', 'Vite module bridge query', ['requireBundledModule']),
  ...entries('browser-vite/module-bridge.ts', 'runtime-state-mutation', 'presentation', 'outer', 'outer', 'first registry/metadata/global bridge write', 'Vite module registration owner', [
    'registerModuleAccessors', 'installBootModuleMetadata', 'installModuleBridge', 'resetModuleBridgeForTests'
  ]),
  ...entries('entry-browser.js', 'pure-query', 'presentation', 'outer', 'outer', 'none (registered module read)', 'classic boot module lookup', ['requireBootModule']),
  ...entries('entry-browser.js', 'runtime-state-mutation', 'presentation', 'outer', 'outer', 'first classic global/module metadata write', 'classic boot registration owner', [
    'assignBootModuleGlobals', 'assignBootModuleDefaultGlobals', 'applyBootModuleEntry'
  ]),
  ...entries('workers/match-worker-runtime-preload.ts', 'runtime-state-mutation', 'command-boundary', 'outer', 'outer', 'first Worker runtime module registry/global write', 'Worker preload registry owner', ['installRuntimeModule'])
]);
