type CardContextBuilderDeps = {
    CardEffectResolverModule?: any;
    defaultPrng?: any;
    constants?: Record<string, any>;
    modules?: Record<string, any>;
    helpers?: Record<string, any>;
};

function requireResolverMethod(moduleRef: any, name: string) {
    const fn = moduleRef && moduleRef[name];
    if (typeof fn !== 'function') {
        throw new Error(`[cards.js] CardEffectResolver.${name} not available`);
    }
    return fn;
}

export function createCardContextBuilders(deps: CardContextBuilderDeps) {
    const contextDeps = deps || {};
    const constants = contextDeps.constants || {};
    const modules = contextDeps.modules || {};
    const helpers = contextDeps.helpers || {};

    return {
        getCardHandManagerContext() {
            return requireResolverMethod(contextDeps.CardEffectResolverModule, 'getCardHandManagerContext')({
                hasStandardLegalMoveForPlayer: helpers.hasStandardLegalMoveForPlayer,
                canUseLastResortForPlayer: helpers.canUseLastResortForPlayer,
                canUseEqualityWillForPlayer: helpers.canUseEqualityWillForPlayer,
                canUseReinforcementWillForPlayer: helpers.canUseReinforcementWillForPlayer,
                canUseSupportTroopsWillForPlayer: helpers.canUseSupportTroopsWillForPlayer,
                canUseTimeStopGodForPlayer: helpers.canUseTimeStopGodForPlayer,
                buildHeavenBlessingSeedHint: helpers.buildHeavenBlessingSeedHint,
                buildHeavenBlessingOffers: helpers.buildHeavenBlessingOffers,
                buildCondemnOffers: helpers.buildCondemnOffers,
                buildObserverWillOffers: helpers.buildObserverWillOffers,
                getLossWillRemovableCount: helpers.getLossWillRemovableCount,
                getSalvationWillTargetCount: helpers.getSalvationWillTargetCount,
                getExecutionWillTargetCount: helpers.getExecutionWillTargetCount,
                countOpponentOccupiedCornersForPlayer: helpers.countOpponentOccupiedCornersForPlayer,
                getDestroyTargets: helpers.getDestroyTargets,
                getTemptWillTargets: helpers.getTemptWillTargets,
                getCaptureWillTargets: helpers.getCaptureWillTargets,
                getStrongWindTargets: helpers.getStrongWindTargets,
                getBuoyancyTargets: helpers.getBuoyancyTargets,
                getSuperBuoyancyTargets: helpers.getSuperBuoyancyTargets,
                getGravityTargets: helpers.getGravityTargets,
                getSuperGravityTargets: helpers.getSuperGravityTargets,
                getSuperAttractionTargets: helpers.getSuperAttractionTargets,
                getTrapTargets: helpers.getTrapTargets,
                getGuardTargets: helpers.getGuardTargets,
                getLivingWillTargets: helpers.getLivingWillTargets,
                getHyperactiveInheritTargets: helpers.getHyperactiveInheritTargets,
                getExtendLifeTargets: helpers.getExtendLifeTargets,
                getCorrosionTargets: helpers.getCorrosionTargets,
                getTimeBombTargets: helpers.getTimeBombTargets,
                getTeleportTargets: helpers.getTeleportTargets,
                getCellTeleportTargets: helpers.getCellTeleportTargets,
                getCloneTargets: helpers.getCloneTargets,
                getSwapTargets: helpers.getSwapTargets,
                getPositionSwapTargets: helpers.getPositionSwapTargets,
                getReverseWillTargets: helpers.getReverseWillTargets,
                getReinforcementWillTargets: helpers.getReinforcementWillTargets,
                getOccupiedBoardShapeCellsForCard: helpers.getOccupiedBoardShapeCellsForCard,
                getBoardExpansionTargets: helpers.getBoardExpansionTargets,
                getBoardExpansionGodTargets: helpers.getBoardExpansionGodTargets,
                getBoardShrinkTargets: helpers.getBoardShrinkTargets,
                getBoardShrinkGodTargets: helpers.getBoardShrinkGodTargets,
                getBlockadeTargets: helpers.getBlockadeTargets,
                getMeteorTargets: helpers.getMeteorTargets,
                getCausalReplayTargets: helpers.getCausalReplayTargets,
                getFreezeTargets: helpers.getFreezeTargets,
                getSeedTargets: helpers.getSeedTargets,
                CardDefsModule: modules.CardDefsModule,
                CardCostsModule: modules.CardCostsModule,
                CardSelectorsModule: modules.CardSelectorsModule,
                CardBoardExecutorResolutionModule: modules.CardBoardExecutorResolutionModule
            });
        },

        getCardStateFactoryContext() {
            return {
                defaultPrng: contextDeps.defaultPrng,
                constants: {
                    RIBO_WILL_OWNER_TURNS: constants.RIBO_WILL_OWNER_TURNS,
                    RIBO_WILL_REPAYMENT_AMOUNT: constants.RIBO_WILL_REPAYMENT_AMOUNT,
                    RIBO_WILL_SHORTAGE_DESTROY_COUNT: constants.RIBO_WILL_SHORTAGE_DESTROY_COUNT
                },
                resolveCardBoardConfig: helpers.resolveCardBoardConfig,
                resolveInitialDeckCardIdsByPlayer: helpers.resolveInitialDeckCardIdsByPlayer,
                buildInitialBoardBonusMap: helpers.buildInitialBoardBonusMap,
                createStoneIdBoard: helpers.createStoneIdBoard,
                getOpeningPlacementsForState: helpers.getOpeningPlacementsForState,
                cloneSalvationDestroyedLedger: helpers.cloneSalvationDestroyedLedger,
                ensureCardCopyState: helpers.ensureCardCopyState
            };
        },

        getCardEffectTimingContext() {
            return requireResolverMethod(contextDeps.CardEffectResolverModule, 'getCardEffectTimingContext')({
                defaultPrng: contextDeps.defaultPrng,
                _ensureHandDestroyFlags: helpers.ensureHandDestroyFlags,
                processRiboWillTurnStartEffects: helpers.processRiboWillTurnStartEffects,
                processObserverWillRepaymentsAtTurnStart: helpers.processObserverWillRepaymentsAtTurnStart,
                processBoardExecutorHandTaxAtTurnStart: helpers.processBoardExecutorHandTaxAtTurnStart,
                commitDraw: helpers.commitDraw,
                getSpecialMarkers: helpers.getSpecialMarkers,
                getCardContext: helpers.getCardContext,
                getFlipsWithContext: helpers.getFlipsWithContext,
                getOccupiedOriginFlipsWithContext: helpers.getOccupiedOriginFlipsWithContext,
                removeMarkersAt: helpers.removeMarkersAt,
                isFrozenCellForCard: helpers.isFrozenCellForCard,
                emitPresentationEvent: helpers.emitPresentationEvent,
                addChargeValue: helpers.addChargeValue,
                addChargeWithTotal: helpers.addChargeWithTotal,
                addMarker: helpers.addMarker,
                clearBombAt: helpers.clearBombAt,
                clearHyperactiveAtPositions: helpers.clearHyperactiveAtPositions,
                applyStrongWill: helpers.applyStrongWill,
                applyAbsoluteProtect: helpers.applyAbsoluteProtect,
                applyRegenWill: helpers.applyRegenWill,
                workDebugLog: helpers.workDebugLog,
                workDebugError: helpers.workDebugError,
                hasBoardShapeCellForCard: helpers.hasBoardShapeCellForCard,
                getCellValueForCard: helpers.getCellValueForCard,
                setCellValueForCard: helpers.setCellValueForCard,
                clearStoneIdAtForCard: helpers.clearStoneIdAtForCard,
                CardWorkModule: modules.CardWorkModule,
                CardLivingWillModule: modules.CardLivingWillModule,
                CardSpawnAndFlipModule: modules.CardSpawnAndFlipModule,
                CardBoardExecutorResolutionModule: modules.CardBoardExecutorResolutionModule,
                BoardOpsModule: modules.BoardOpsModule,
                ULTIMATE_DRAGON_TURNS: constants.ULTIMATE_DRAGON_TURNS,
                ULTIMATE_DESTROY_GOD_TURNS: constants.ULTIMATE_DESTROY_GOD_TURNS,
                ULTIMATE_HYPERACTIVE_TURNS: constants.ULTIMATE_HYPERACTIVE_TURNS,
                STONE_SALVATION_GOD_TURNS: constants.STONE_SALVATION_GOD_TURNS,
                EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT: constants.EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT,
                EXTREME_HYPERACTIVE_DESTROY_EVADE_LIMIT: constants.EXTREME_HYPERACTIVE_DESTROY_EVADE_LIMIT,
                AFTERIMAGE_WILL_FLIP_EVADE_LIMIT: constants.AFTERIMAGE_WILL_FLIP_EVADE_LIMIT,
                AFTERIMAGE_WILL_DESTROY_EVADE_LIMIT: constants.AFTERIMAGE_WILL_DESTROY_EVADE_LIMIT,
                SNIPER_WILL_TURNS: constants.SNIPER_WILL_TURNS,
                DESTROY_DRAGON_TURNS: constants.DESTROY_DRAGON_TURNS,
                LIGHTNING_WILL_TURNS: constants.LIGHTNING_WILL_TURNS,
                METEOR_GOD_TURNS: constants.METEOR_GOD_TURNS,
                GHOST_WILL_TURNS: constants.GHOST_WILL_TURNS,
                SEED_WILL_TURNS: constants.SEED_WILL_TURNS,
                WILL_HUNTER_KING_TURNS: constants.WILL_HUNTER_KING_TURNS,
                ROBOT_VACUUM_TURNS: constants.ROBOT_VACUUM_TURNS,
                TIME_STOP_GOD_TURNS: constants.TIME_STOP_GOD_TURNS,
                DOUBLE_PLACE_EXTRA: constants.DOUBLE_PLACE_EXTRA,
                THROW_CHAIN_CONFIG_BY_TYPE: constants.THROW_CHAIN_CONFIG_BY_TYPE,
                MARKER_KINDS: constants.MARKER_KINDS,
                FLIP_CHARGE_MULTIPLIER_EFFECTS: constants.FLIP_CHARGE_MULTIPLIER_EFFECTS,
                NUMBER_CELL_CHARGE_MULTIPLIER_EFFECTS: constants.NUMBER_CELL_CHARGE_MULTIPLIER_EFFECTS
            });
        },

        getLivingWillModuleContext() {
            return {
                readCardPendingEffect: helpers.readCardPendingEffect,
                clearCardPendingEffect: helpers.clearCardPendingEffect,
                getLivingWillTargets: typeof helpers.getLivingWillTargets === 'function'
                    ? helpers.getLivingWillTargets
                    : (() => []),
                emitPresentationEvent: helpers.emitPresentationEvent,
                BoardOps: modules.BoardOpsModule,
                getCardContext: helpers.getCardContext,
                getFlipsWithContext: helpers.getFlipsWithContext,
                getOccupiedOriginFlipsWithContext: helpers.getOccupiedOriginFlipsWithContext,
                clearBombAt: helpers.clearBombAt,
                clearHyperactiveAtPositions: helpers.clearHyperactiveAtPositions,
                addChargeWithTotal: helpers.addChargeWithTotal,
                random: contextDeps.defaultPrng,
                defaults: {
                    regenReviveLimit: 3,
                    breedingTurns: 5,
                    proliferationTurns: 10,
                    ultimateDragonTurns: constants.ULTIMATE_DRAGON_TURNS,
                    ultimateDestroyGodTurns: constants.ULTIMATE_DESTROY_GOD_TURNS,
                    stoneSalvationGodTurns: constants.STONE_SALVATION_GOD_TURNS,
                    sniperTurns: constants.SNIPER_WILL_TURNS,
                    ghostTurns: constants.GHOST_WILL_TURNS,
                    afterimageFlipEvadeLimit: constants.AFTERIMAGE_WILL_FLIP_EVADE_LIMIT,
                    afterimageDestroyEvadeLimit: constants.AFTERIMAGE_WILL_DESTROY_EVADE_LIMIT,
                    timeStopTurns: constants.TIME_STOP_GOD_TURNS,
                    willHunterKingTurns: constants.WILL_HUNTER_KING_TURNS,
                    destroyDragonTurns: constants.DESTROY_DRAGON_TURNS,
                    lightningTurns: constants.LIGHTNING_WILL_TURNS,
                    meteorGodTurns: constants.METEOR_GOD_TURNS,
                    extremeHyperactiveFlipEvadeLimit: constants.EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT,
                    extremeHyperactiveDestroyEvadeLimit: constants.EXTREME_HYPERACTIVE_DESTROY_EVADE_LIMIT,
                    robotVacuumTurns: constants.ROBOT_VACUUM_TURNS,
                    ultimateHyperactiveTurns: constants.ULTIMATE_HYPERACTIVE_TURNS,
                    ultimateHyperactiveFlipEvadeLimit: constants.ULTIMATE_HYPERACTIVE_FLIP_EVADE_LIMIT,
                    ultimateHyperactiveDestroyEvadeLimit: constants.ULTIMATE_HYPERACTIVE_DESTROY_EVADE_LIMIT,
                    guardTurns: constants.GUARD_WILL_TURNS,
                    guardianGodTurns: constants.GUARDIAN_GOD_TURNS,
                    workTurns: 5
                }
            };
        },

        getCardPresentationHelperContext() {
            return {
                constants: { BLACK: constants.BLACK, EMPTY: constants.EMPTY },
                StoneStatusSnapshot: modules.StoneStatusSnapshot,
                BoardOpsModule: modules.BoardOpsModule,
                getSpecialMarkers: helpers.getSpecialMarkers,
                findBombMarkerAt: helpers.findBombMarkerAt,
                getBombMarkerType: helpers.getBombMarkerType,
                isOverlayOnlySpecialStoneType: helpers.isOverlayOnlySpecialStoneType,
                getCellValueForCard: helpers.getCellValueForCard,
                setCellValueForCard: helpers.setCellValueForCard,
                swapCellCoordinates: helpers.swapCellCoordinates,
                getStoneIdAtForCard: helpers.getStoneIdAtForCard,
                emitPresentationEvent: helpers.emitPresentationEvent
            };
        }
    };
}

module.exports = {
    createCardContextBuilders
};
