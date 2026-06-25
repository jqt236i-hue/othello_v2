const { createCardContextBuilders } = require('../game/logic/cards-internal/context-builders.js');

describe('CardContextBuilders module', () => {
  test('builds hand/state/timing/living/presentation contexts from injected deps', () => {
    const handContext = { kind: 'hand' };
    const timingContext = { kind: 'timing' };
    const handResolver = jest.fn(() => handContext);
    const timingResolver = jest.fn(() => timingContext);

    const deps = {
      CardEffectResolverModule: {
        getCardHandManagerContext: handResolver,
        getCardEffectTimingContext: timingResolver
      },
      defaultPrng: { random: () => 0.5 },
      constants: {
        BLACK: 1,
        EMPTY: 0,
        RIBO_WILL_OWNER_TURNS: 3,
        RIBO_WILL_REPAYMENT_AMOUNT: 10,
        RIBO_WILL_SHORTAGE_DESTROY_COUNT: 2,
        ULTIMATE_DRAGON_TURNS: 8,
        ULTIMATE_DESTROY_GOD_TURNS: 6,
        ULTIMATE_HYPERACTIVE_TURNS: 12,
        STONE_SALVATION_GOD_TURNS: 12,
        EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT: 5,
        EXTREME_HYPERACTIVE_DESTROY_EVADE_LIMIT: 5,
        AFTERIMAGE_WILL_FLIP_EVADE_LIMIT: 3,
        AFTERIMAGE_WILL_DESTROY_EVADE_LIMIT: 3,
        SNIPER_WILL_TURNS: 6,
        DESTROY_DRAGON_TURNS: 3,
        LIGHTNING_WILL_TURNS: 6,
        GHOST_WILL_TURNS: 8,
        SEED_WILL_TURNS: 5,
        WILL_HUNTER_KING_TURNS: 5,
        ROBOT_VACUUM_TURNS: 5,
        TIME_STOP_GOD_TURNS: 5,
        DOUBLE_PLACE_EXTRA: 1,
        THROW_CHAIN_CONFIG_BY_TYPE: { THROW_CHAIN: { next: 'double_place_01' } },
        MARKER_KINDS: { SPECIAL_STONE: 'specialStone' },
        FLIP_CHARGE_MULTIPLIER_EFFECTS: {},
        NUMBER_CELL_CHARGE_MULTIPLIER_EFFECTS: {},
        ULTIMATE_HYPERACTIVE_FLIP_EVADE_LIMIT: 5,
        ULTIMATE_HYPERACTIVE_DESTROY_EVADE_LIMIT: 5,
        GUARD_WILL_TURNS: 3,
        GUARDIAN_GOD_TURNS: 5
      },
      modules: {
        CardDefsModule: { defs: true },
        CardCostsModule: { costs: true },
        CardSelectorsModule: { selectors: true },
        CardWorkModule: { work: true },
        CardLivingWillModule: { living: true },
        BoardOpsModule: { boardOps: true },
        StoneStatusSnapshot: { snapshot: true }
      },
      helpers: {
        hasStandardLegalMoveForPlayer: jest.fn(),
        canUseLastResortForPlayer: jest.fn(),
        canUseEqualityWillForPlayer: jest.fn(),
        canUseReinforcementWillForPlayer: jest.fn(),
        canUseTimeStopGodForPlayer: jest.fn(),
        countOpponentOccupiedCornersForPlayer: jest.fn(),
        getDestroyTargets: jest.fn(),
        getTemptWillTargets: jest.fn(),
        getCaptureWillTargets: jest.fn(),
        getStrongWindTargets: jest.fn(),
        getBuoyancyTargets: jest.fn(),
        getSuperBuoyancyTargets: jest.fn(),
        getGravityTargets: jest.fn(),
        getSuperGravityTargets: jest.fn(),
        getSuperAttractionTargets: jest.fn(),
        getTrapTargets: jest.fn(),
        getGuardTargets: jest.fn(),
        getLivingWillTargets: jest.fn(),
        getHyperactiveInheritTargets: jest.fn(),
        getExtendLifeTargets: jest.fn(),
        getCorrosionTargets: jest.fn(),
        getTimeBombTargets: jest.fn(),
        getTeleportTargets: jest.fn(),
        getCellTeleportTargets: jest.fn(),
        getCloneTargets: jest.fn(),
        getSwapTargets: jest.fn(),
        getPositionSwapTargets: jest.fn(),
        getReinforcementWillTargets: jest.fn(),
        getOccupiedBoardShapeCellsForCard: jest.fn(),
        getBoardExpansionTargets: jest.fn(),
        getBoardExpansionGodTargets: jest.fn(),
        getBoardShrinkTargets: jest.fn(),
        getBoardShrinkGodTargets: jest.fn(),
        getBlockadeTargets: jest.fn(),
        getMeteorTargets: jest.fn(),
        getFreezeTargets: jest.fn(),
        getSeedTargets: jest.fn(),
        resolveCardBoardConfig: jest.fn(),
        resolveInitialDeckCardIdsByPlayer: jest.fn(),
        buildInitialBoardBonusMap: jest.fn(),
        createStoneIdBoard: jest.fn(),
        getOpeningPlacementsForState: jest.fn(),
        cloneSalvationDestroyedLedger: jest.fn(),
        ensureCardCopyState: jest.fn(),
        ensureHandDestroyFlags: jest.fn(),
        processRiboWillTurnStartEffects: jest.fn(),
        commitDraw: jest.fn(),
        getSpecialMarkers: jest.fn(),
        getCardContext: jest.fn(),
        removeMarkersAt: jest.fn(),
        isFrozenCellForCard: jest.fn(),
        emitPresentationEvent: jest.fn(),
        addChargeValue: jest.fn(),
        addChargeWithTotal: jest.fn(),
        addMarker: jest.fn(),
        applyStrongWill: jest.fn(),
        applyRegenWill: jest.fn(),
        workDebugLog: jest.fn(),
        workDebugError: jest.fn(),
        hasBoardShapeCellForCard: jest.fn(),
        getCellValueForCard: jest.fn(),
        setCellValueForCard: jest.fn(),
        clearStoneIdAtForCard: jest.fn(),
        readCardPendingEffect: jest.fn(),
        clearCardPendingEffect: jest.fn(),
        findBombMarkerAt: jest.fn(),
        getBombMarkerType: jest.fn(),
        isOverlayOnlySpecialStoneType: jest.fn(),
        swapCellCoordinates: jest.fn(),
        getStoneIdAtForCard: jest.fn()
      }
    };

    const builders = createCardContextBuilders(deps);

    expect(builders.getCardHandManagerContext()).toBe(handContext);
    expect(builders.getCardEffectTimingContext()).toBe(timingContext);
    expect(builders.getCardStateFactoryContext()).toMatchObject({
      defaultPrng: deps.defaultPrng,
      constants: {
        RIBO_WILL_OWNER_TURNS: 3,
        RIBO_WILL_REPAYMENT_AMOUNT: 10,
        RIBO_WILL_SHORTAGE_DESTROY_COUNT: 2
      }
    });
    expect(builders.getLivingWillModuleContext()).toMatchObject({
      BoardOps: deps.modules.BoardOpsModule,
      random: deps.defaultPrng
    });
    expect(builders.getLivingWillModuleContext().defaults.timeStopTurns).toBe(5);
    expect(builders.getCardPresentationHelperContext()).toMatchObject({
      constants: { BLACK: 1, EMPTY: 0 },
      StoneStatusSnapshot: deps.modules.StoneStatusSnapshot
    });

    expect(handResolver).toHaveBeenCalledWith(expect.objectContaining({
      getDestroyTargets: deps.helpers.getDestroyTargets,
      CardDefsModule: deps.modules.CardDefsModule
    }));
    expect(timingResolver).toHaveBeenCalledWith(expect.objectContaining({
      CardWorkModule: deps.modules.CardWorkModule,
      TIME_STOP_GOD_TURNS: 5,
      STONE_SALVATION_GOD_TURNS: 12
    }));
  });

  test('throws the existing resolver error when CardEffectResolver methods are missing', () => {
    const builders = createCardContextBuilders({ CardEffectResolverModule: {} });
    expect(() => builders.getCardHandManagerContext()).toThrow('[cards.js] CardEffectResolver.getCardHandManagerContext not available');
    expect(() => builders.getCardEffectTimingContext()).toThrow('[cards.js] CardEffectResolver.getCardEffectTimingContext not available');
  });
});
