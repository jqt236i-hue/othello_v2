import { createCardRuntimeServices, type CardRuntimeServices } from './card-runtime-contracts';

import SharedConstants = require('../../shared-constants');
import DeckSpec = require('../../shared/deck-spec');
import SpecialCardRegistry = require('../../shared/special-card-registry');
import SpecialStoneRegistry = require('../../shared/special-stone-registry-static');
import ManifestStoneRegistry = require('../../shared/manifest-stone-registry');
import EvasionStatus = require('../../shared/evasion-status');
import SharedBoardUtils = require('../../shared/shared-board-utils');
import DestroyOutcome = require('../../shared/destroy-outcome-contract');
import StoneStatusSnapshot = require('../../shared/stone-status-snapshot');
import CardRandomSource = require('./cards-internal/random-source');
import CardStateFactory = require('./cards-internal/state-factory');
import CardPresentationHelpers = require('./cards-internal/presentation-helpers');
import CardStateManager = require('../cards/state-manager');
import CardEffectResolver = require('../cards/effect-resolver');
import CardTimingProcessor = require('../cards/timing-processor');
import CardTargetResolver = require('../cards/target-resolver');
import CardCaptureSource = require('./cards-internal/capture-source');
import CardProgression = require('./cards-internal/progression');
import CardRandomBoardSpawn = require('./cards-internal/random-board-spawn');
import CardSpawnAndFlip = require('./cards-internal/spawn-and-flip-core');
import CardGeneratedSpawnFlipResolver = require('./cards-internal/generated-spawn-flip-resolver');
import CardRiboTimeStop = require('./cards-internal/ribo-time-stop');
import CardTargetAccess = require('./cards-internal/target-access');
import CardContextBuilders = require('./cards-internal/context-builders');
import CardTheoryIncarnationBindings = require('./cards-internal/theory-incarnation-bindings');
import CardDeckSetup = require('./cards-internal/deck-setup');
import CardHandAccess = require('./cards-internal/hand-access');
import CardAvailability = require('./cards-internal/card-availability');
import CardOfferBuilders = require('./cards-internal/offer-builders');
import CardEffectTargetCounts = require('./cards-internal/effect-target-counts');
import CardSalvationEffect = require('./cards-internal/salvation-effect');
import CardLossEffect = require('./cards-internal/loss-effect');
import CardFateEffect = require('./cards-internal/fate-effect');
import CardBoardConfiguration = require('./cards-internal/board-configuration');
import CardBoardShapeAccess = require('./cards-internal/board-shape-access');
import CardFlips = require('./cards/flips');
import CardCosts = require('./cards/costs');
import CardDefinitions = require('./cards/defs');
import CardUtilities = require('./cards/utils');
import CardExpansion = require('./cards/expansion');
import CardMarkers = require('./cards/markers');
import CardMovement = require('./cards/movement');
import CardTeleport = require('./cards/teleport');
import CardClone = require('./cards/clone');
import CardMeteor = require('./cards/meteor');
import CardCausalReplay = require('./cards/causal_replay');
import CardMeteorGod = require('./cards/meteor_god');
import CardShrink = require('./cards/shrink');
import CardLivingWill = require('./cards/living_will');
import CardTargets = require('./cards/targets');
import CardChain = require('./cards/chain');
import CardRegen = require('./cards/regen');
import CardZombieWill = require('./cards/zombie_will');
import CardTimeBomb = require('./cards/time_bomb');
import CardBreeding = require('./cards/breeding');
import CardHyperactive = require('./cards/hyperactive');
import CardUltimateDestroyGod = require('./cards/udg');
import CardSniper = require('./cards/sniper');
import CardLightning = require('./cards/lightning');
import CardFireWill = require('./cards/fire-will');
import CardWaterWill = require('./cards/water-will');
import CardGrassWill = require('./cards/grass-will');
import CardShinraBanshoGod = require('./cards/shinra-bansho-god');
import CardWillHunterKing = require('./cards/will_hunter_king');
import CardDestroyDragon = require('./cards/destroy_dragon');
import CardWorkWill = require('./cards/work_will');
import CardUltimateWorkGod = require('./cards/ultimate_work_god');
import DragonEffects = require('./effects/dragon');
import DestroyOneStone = require('./effects/destroy_one_stone');
import SwapWithEnemy = require('./effects/swap_with_enemy');
import CardProtect = require('./card-resolution/protect');
import CardTrap = require('./card-resolution/trap');
import CardOwnership = require('./card-resolution/ownership');
import CardBoardExpansionApply = require('./card-resolution/board-expansion-apply');
import CardStatusCells = require('./card-resolution/status-cells');
import CardHandEffects = require('./card-resolution/hand-effects');
import CardObserverWill = require('./card-resolution/observer-will');
import CardTheoryIncarnation = require('./card-resolution/theory-incarnation');
import CardChaosSummon = require('./card-resolution/chaos-summon');
import CardReincarnationWill = require('./card-resolution/reincarnation-will');
import CardBoardExecutor = require('./card-resolution/board-executor');
import SpecialStoneMarkerFactory = require('./card-resolution/special-stone-marker-factory');
import CardPositionSwap = require('./card-resolution/position-swap');
import CardSelectors = require('./cards/selectors');
import CardUsagePrechecks = require('./cards-internal/card-usage-prechecks');
import CardHandManager = require('./cards-internal/hand-manager');
import CardPendingStateManager = require('./cards-internal/pending-state-manager');
import PendingCoordinator = require('../turn/pending-coordinator');
import CardChargeLedger = require('./cards-internal/charge-ledger');
import BoardOps = require('./board_ops');
import MarkersAdapter = require('./markers_adapter');

let defaultServices: CardRuntimeServices | null = null;

export function composeDefaultCardRuntimeServices(): CardRuntimeServices {
    return createCardRuntimeServices({
        state: {
            sharedConstants: SharedConstants,
            deckSpec: DeckSpec,
            randomSourceModule: CardRandomSource,
            stateFactory: CardStateFactory,
            stateManager: CardStateManager,
            deckSetup: CardDeckSetup,
            handAccess: CardHandAccess,
            handManager: CardHandManager,
            availability: CardAvailability,
            costs: CardCosts,
            definitions: CardDefinitions,
            utilities: CardUtilities,
            progression: CardProgression,
            offerBuilders: CardOfferBuilders,
            targetCounts: CardEffectTargetCounts,
            salvationEffect: CardSalvationEffect,
            lossEffect: CardLossEffect,
            fateEffect: CardFateEffect
        },
        targeting: {
            targetResolver: CardTargetResolver,
            targetAccess: CardTargetAccess,
            selectors: CardSelectors,
            usagePrechecks: CardUsagePrechecks,
            targets: CardTargets,
            boardConfiguration: CardBoardConfiguration,
            boardShapeAccess: CardBoardShapeAccess,
            flips: CardFlips
        },
        board: {
            sharedBoardUtils: SharedBoardUtils,
            boardOps: BoardOps,
            markersAdapter: MarkersAdapter,
            expansion: CardExpansion,
            shrink: CardShrink,
            movement: CardMovement,
            teleport: CardTeleport,
            clone: CardClone,
            meteor: CardMeteor,
            causalReplay: CardCausalReplay,
            randomBoardSpawn: CardRandomBoardSpawn,
            spawnAndFlip: CardSpawnAndFlip,
            generatedSpawnFlipResolver: CardGeneratedSpawnFlipResolver
        },
        marker: {
            specialCardRegistry: SpecialCardRegistry,
            specialStoneRegistry: SpecialStoneRegistry,
            manifestStoneRegistry: ManifestStoneRegistry,
            evasionStatus: EvasionStatus,
            destroyOutcome: DestroyOutcome,
            stoneStatusSnapshot: StoneStatusSnapshot,
            presentationHelpers: CardPresentationHelpers,
            contextBuilders: CardContextBuilders,
            captureSource: CardCaptureSource,
            markers: CardMarkers
        },
        pending: {
            pendingStateManager: CardPendingStateManager,
            pendingCoordinator: PendingCoordinator,
            chargeLedger: CardChargeLedger,
            effectResolver: CardEffectResolver,
            timingProcessor: CardTimingProcessor,
            riboTimeStop: CardRiboTimeStop
        },
        resolution: {
            theoryIncarnationBindings: CardTheoryIncarnationBindings,
            chain: CardChain,
            regen: CardRegen,
            livingWill: CardLivingWill,
            meteorGod: CardMeteorGod,
            zombieWill: CardZombieWill,
            timeBomb: CardTimeBomb,
            breeding: CardBreeding,
            hyperactive: CardHyperactive,
            ultimateDestroyGod: CardUltimateDestroyGod,
            sniper: CardSniper,
            lightning: CardLightning,
            fireWill: CardFireWill,
            waterWill: CardWaterWill,
            grassWill: CardGrassWill,
            shinraBanshoGod: CardShinraBanshoGod,
            willHunterKing: CardWillHunterKing,
            destroyDragon: CardDestroyDragon,
            workWill: CardWorkWill,
            ultimateWorkGod: CardUltimateWorkGod,
            dragonEffects: DragonEffects,
            destroyOneStone: DestroyOneStone,
            swapWithEnemy: SwapWithEnemy,
            protect: CardProtect,
            trap: CardTrap,
            ownership: CardOwnership,
            boardExpansionApply: CardBoardExpansionApply,
            statusCells: CardStatusCells,
            handEffects: CardHandEffects,
            observerWill: CardObserverWill,
            theoryIncarnation: CardTheoryIncarnation,
            chaosSummon: CardChaosSummon,
            reincarnationWill: CardReincarnationWill,
            boardExecutor: CardBoardExecutor,
            specialStoneMarkerFactory: SpecialStoneMarkerFactory,
            positionSwap: CardPositionSwap
        }
    });
}

export function getDefaultCardRuntimeServices(): CardRuntimeServices {
    if (!defaultServices) defaultServices = composeDefaultCardRuntimeServices();
    return defaultServices;
}
