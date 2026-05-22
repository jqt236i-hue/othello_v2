interface MatchWorkerRuntimeGlobalScope {
    SharedConstants?: unknown;
    SharedBoardUtils?: unknown;
    DeckSpecHelpers?: unknown;
    DeckCodecModule?: unknown;
    PlayerEncoding?: unknown;
    DestroyOutcomeContract?: unknown;
    StoneStatusSnapshot?: unknown;
    SpecialStoneRegistry?: unknown;
    CardRandomSource?: unknown;
    CardStateFactory?: unknown;
    CardModuleResolver?: unknown;
    CardPresentationHelpers?: unknown;
    CardHandManager?: unknown;
    CardChargeLedger?: unknown;
    CardPendingStateManager?: unknown;
    CardUsagePrechecks?: unknown;
    CardEffectTiming?: unknown;
    CardMarkers?: unknown;
    BoardOps?: unknown;
    DestroyOneStoneEffects?: unknown;
    SwapWithEnemyEffects?: unknown;
    CardStatusCellsEffects?: unknown;
    CardStateManager?: unknown;
    CardEffectResolver?: unknown;
    CardTimingProcessor?: unknown;
    CardTargetResolver?: unknown;
}

function getRuntimeGlobalScope(): MatchWorkerRuntimeGlobalScope {
    if (typeof globalThis !== 'undefined') return globalThis as MatchWorkerRuntimeGlobalScope;
    if (typeof self !== 'undefined') return self as MatchWorkerRuntimeGlobalScope;
    return {};
}

function unwrapModule(mod: unknown): unknown {
    return mod && typeof mod === 'object' && 'default' in mod ? mod.default : mod;
}

const scope = getRuntimeGlobalScope();

if (!scope.SharedConstants) scope.SharedConstants = unwrapModule(require('../shared-constants.js'));
if (!scope.SharedBoardUtils) scope.SharedBoardUtils = unwrapModule(require('../shared/shared-board-utils.js'));
if (!scope.DeckSpecHelpers) scope.DeckSpecHelpers = unwrapModule(require('../shared/deck-spec.js'));
if (!scope.DeckCodecModule) scope.DeckCodecModule = unwrapModule(require('../shared/deck-codec.js'));
if (!scope.PlayerEncoding) scope.PlayerEncoding = unwrapModule(require('../shared/player-encoding.js'));
if (!scope.DestroyOutcomeContract) scope.DestroyOutcomeContract = unwrapModule(require('../shared/destroy-outcome-contract.js'));
if (!scope.StoneStatusSnapshot) scope.StoneStatusSnapshot = unwrapModule(require('../shared/stone-status-snapshot.js'));
if (!scope.SpecialStoneRegistry) scope.SpecialStoneRegistry = unwrapModule(require('../shared/special-stone-registry.js'));
if (!scope.CardRandomSource) scope.CardRandomSource = unwrapModule(require('../game/logic/cards-internal/random-source.js'));
if (!scope.CardStateFactory) scope.CardStateFactory = unwrapModule(require('../game/logic/cards-internal/state-factory.js'));
if (!scope.CardModuleResolver) scope.CardModuleResolver = unwrapModule(require('../game/logic/cards-internal/module-resolver.js'));
if (!scope.CardPresentationHelpers) scope.CardPresentationHelpers = unwrapModule(require('../game/logic/cards-internal/presentation-helpers.js'));
if (!scope.CardHandManager) scope.CardHandManager = unwrapModule(require('../game/logic/cards-internal/hand-manager.js'));
if (!scope.CardChargeLedger) scope.CardChargeLedger = unwrapModule(require('../game/logic/cards-internal/charge-ledger.js'));
if (!scope.CardPendingStateManager) scope.CardPendingStateManager = unwrapModule(require('../game/logic/cards-internal/pending-state-manager.js'));
if (!scope.CardUsagePrechecks) scope.CardUsagePrechecks = unwrapModule(require('../game/logic/cards-internal/card-usage-prechecks.js'));
if (!scope.CardEffectTiming) scope.CardEffectTiming = unwrapModule(require('../game/logic/cards-internal/effect-timing.js'));
if (!scope.CardMarkers) scope.CardMarkers = unwrapModule(require('../game/logic/cards/markers.js'));
if (!scope.BoardOps) scope.BoardOps = unwrapModule(require('../game/logic/board_ops.js'));
if (!scope.DestroyOneStoneEffects) scope.DestroyOneStoneEffects = unwrapModule(require('../game/logic/effects/destroy_one_stone.js'));
if (!scope.SwapWithEnemyEffects) scope.SwapWithEnemyEffects = unwrapModule(require('../game/logic/effects/swap_with_enemy.js'));
if (!scope.CardStatusCellsEffects) scope.CardStatusCellsEffects = unwrapModule(require('../game/cards/effects/status-cells.js'));
if (!scope.CardStateManager) scope.CardStateManager = unwrapModule(require('../game/cards/state-manager.js'));
if (!scope.CardEffectResolver) scope.CardEffectResolver = unwrapModule(require('../game/cards/effect-resolver.js'));
if (!scope.CardTimingProcessor) scope.CardTimingProcessor = unwrapModule(require('../game/cards/timing-processor.js'));
if (!scope.CardTargetResolver) scope.CardTargetResolver = unwrapModule(require('../game/cards/target-resolver.js'));

export {};
