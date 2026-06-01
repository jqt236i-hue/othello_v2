const { createCpuDecisionMovePlan } = require('../game/cpu-decision-move-plan');

function createMovePlan(overrides: any = {}) {
  const board = overrides.board || [
    [0, 0, 0, 0],
    [0, 1, -1, 0],
    [0, -1, 1, 0],
    [0, 0, 0, 0]
  ];
  const cardState = overrides.cardState || {
    charge: { black: 5, white: 0 },
    boardBonusByCell: { '0,1': 3 },
    boardBonusConsumedByCell: {}
  };
  const cardLogic = overrides.cardLogic || {
    getCardCost: (cardId: any) => (cardId === 'recover' ? 8 : 3)
  };
  const onStrictPendingPlacementOverride = overrides.onStrictPendingPlacementOverride || jest.fn();

  return createCpuDecisionMovePlan({
    getGameState: () => ({ board }),
    getCardState: () => cardState,
    getCardLogic: () => cardLogic,
    resolvePlayerValue: (playerKey: any) => (playerKey === 'black' ? 1 : -1),
    getShapeAwareBoard: (sourceBoard: any) => sourceBoard,
    isPlayableBoard: (sourceBoard: any) => Array.isArray(sourceBoard) && sourceBoard.length > 0,
    countCornerControl: overrides.countCornerControl || (() => ({ ownCorners: 0, oppCorners: 1 })),
    isCornerCell: (row: any, col: any, sourceBoard: any) => {
      const maxRow = Array.isArray(sourceBoard) ? sourceBoard.length - 1 : 7;
      const maxCol = Array.isArray(sourceBoard && sourceBoard[0]) ? sourceBoard[0].length - 1 : 7;
      return (row === 0 || row === maxRow) && (col === 0 || col === maxCol);
    },
    isEdgeCell: (row: any, col: any, sourceBoard: any) => {
      const maxRow = Array.isArray(sourceBoard) ? sourceBoard.length - 1 : 7;
      const maxCol = Array.isArray(sourceBoard && sourceBoard[0]) ? sourceBoard[0].length - 1 : 7;
      return row === 0 || row === maxRow || col === 0 || col === maxCol;
    },
    getBoardBonusValueAt: (row: any, col: any) => (row === 0 && col === 1 ? 3 : 0),
    getHandCardIdsForPlayer: () => ['recover', 'hold'],
    resolveCardType: (cardId: any) => {
      if (cardId === 'recover') return 'LIVING_WILL';
      if (cardId === 'hold') return 'GUARD_WILL';
      if (cardId === 'setup') return 'SETUP_WILL';
      return String(cardId || '');
    },
    isRecoveryCardType: (cardType: any) => cardType === 'LIVING_WILL',
    isHoldCardType: (cardType: any) => cardType === 'GUARD_WILL',
    keepCardTypesForLowCharge: new Set(['GUARD_WILL']),
    getCardPlanPressureProfile: (cardType: any) => (cardType === 'SETUP_WILL'
      ? { basePressure: 3, cornerWindowPressure: 3, recoveryGapPressure: 3, recoveryEmergencyPressure: 3 }
      : null),
    computeCardPlanPressure: overrides.computeCardPlanPressure || (() => 2),
    resolveCardPlanPressureThreshold: overrides.resolveCardPlanPressureThreshold || (() => 3),
    readPendingEffect: () => ({ placementsRemaining: 2 }),
    resolvePendingType: overrides.resolvePendingType || (() => 'DOUBLE_PLACE'),
    countBoardStatsForPlayer: () => ({ empties: 4, discDiff: 2 }),
    countPlayableCells: () => 16,
    getTargetAwareUsableCardIds: () => ['recover'],
    getCpuPolicyCore: overrides.getCpuPolicyCore || (() => ({
      getMovePlanProfileForCardType: () => ({
        stabilityBias: 3,
        emptyAdjBias: 0,
        cornerBias: 0,
        edgeBias: 2,
        innerBias: -1
      })
    })),
    getCurrentCpuBoard: () => board,
    onStrictPendingPlacementOverride
  });
}

describe('cpu decision move plan module', () => {
  test('buildCornerPlanState captures corner pressure, legal-edge bonus, and recovery gap', () => {
    const movePlan = createMovePlan();

    const plan = movePlan.buildCornerPlanState('black', [{ row: 0, col: 1 }, { row: 1, col: 1 }], ['hold']);

    expect(plan).toEqual({
      ownCorners: 0,
      oppCorners: 1,
      hasCornerMoveNow: false,
      hasEdgeMoveNow: true,
      cornerEmergency: true,
      cornerHoldMode: false,
      recoveryReady: false,
      recoveryCostGap: 3,
      maxBoardBonusOnLegalMoves: 3,
      highBonusMoveAvailable: true
    });
  });

  test('isCardChoiceAllowedByPlan blocks setup cards while a corner move is available', () => {
    const movePlan = createMovePlan();

    const allowed = movePlan.isCardChoiceAllowedByPlan(
      'black',
      6,
      3,
      'setup',
      null,
      { hasCornerMoveNow: true },
      { ownCharge: 20, reserveChargeFloor: 0 }
    );

    expect(allowed).toBe(false);
  });

  test('isCardChoiceAllowedByPlan uses pressure profile when forced card use bypasses corner hold', () => {
    const movePlan = createMovePlan({
      computeCardPlanPressure: () => 4,
      resolveCardPlanPressureThreshold: () => 3
    });

    const allowed = movePlan.isCardChoiceAllowedByPlan(
      'black',
      6,
      3,
      'setup',
      null,
      { hasCornerMoveNow: true },
      { ownCharge: 20, reserveChargeFloor: 0, forceUseCard: true }
    );

    expect(allowed).toBe(true);
  });

  test('isCardChoiceAllowedByPlan allows narrow DESTROY_ONE_STONE recovery window one point below pressure', () => {
    const movePlan = createMovePlan({
      countCornerControl: () => ({ ownCorners: 1, oppCorners: 0 }),
      resolveCardType: (cardId: any) => {
        if (cardId === 'destroy') return 'DESTROY_ONE_STONE';
        return String(cardId || '');
      },
      getCardPlanPressureProfile: (cardType: any) => (cardType === 'DESTROY_ONE_STONE'
        ? { basePressure: 4, cornerWindowPressure: 5, recoveryGapPressure: 4, recoveryEmergencyPressure: 0 }
        : null),
      computeCardPlanPressure: () => 3,
      resolveCardPlanPressureThreshold: () => 4
    });

    const allowed = movePlan.isCardChoiceAllowedByPlan(
      'white',
      6,
      1,
      'destroy',
      { id: 'destroy', type: 'DESTROY_ONE_STONE' },
      { hasCornerMoveNow: false, cornerHoldMode: true, cornerEmergency: false },
      {
        ownCharge: 30,
        reserveChargeFloor: 0,
        whiteLv6Mode: true,
        discDiff: 2
      }
    );

    expect(allowed).toBe(true);
  });

  test('buildMovePlanContext assembles pending placement and reserve recovery context', () => {
    const movePlan = createMovePlan({
      cardState: {
        charge: { black: 9, white: 0 },
        boardBonusByCell: { '0,1': 3 },
        boardBonusConsumedByCell: {}
      },
      countCornerControl: () => ({ ownCorners: 1, oppCorners: 0 }),
      cardLogic: {
        getCardCost: (cardId: any) => (cardId === 'recover' ? 8 : 3)
      }
    });

    const context = movePlan.buildMovePlanContext('black', 6, [{ row: 0, col: 1 }]);

    expect(context).toMatchObject({
      level: 6,
      playerValue: 1,
      ownCharge: 9,
      ownDiscs: 7,
      reserveRecoveryCardReady: true,
      reserveRecoveryCardCostGap: 0,
      hasCornerHoldCardReady: false,
      pendingType: 'DOUBLE_PLACE',
      pendingPlacementsRemaining: 2,
      preferEdgeRetention: true
    });
    expect(context.boardBonusByCell).toEqual({ '0,1': 3 });
  });

  test('shouldRespectPendingPlacementPlanStrictly requires a stable anchored profile', () => {
    const movePlan = createMovePlan();

    expect(movePlan.shouldRespectPendingPlacementPlanStrictly('DOUBLE_PLACE')).toBe(true);

    const loosePlan = createMovePlan({
      getCpuPolicyCore: () => ({
        getMovePlanProfileForCardType: () => ({
          stabilityBias: 1,
          emptyAdjBias: 0,
          cornerBias: 0,
          edgeBias: 1,
          innerBias: 0
        })
      })
    });
    expect(loosePlan.shouldRespectPendingPlacementPlanStrictly('DOUBLE_PLACE')).toBe(false);
  });

  test('maybeOverrideWithStrictPendingPlacement returns a much better anchored move', () => {
    const onStrictPendingPlacementOverride = jest.fn();
    const movePlan = createMovePlan({ onStrictPendingPlacementOverride });
    const selected = { row: 1, col: 1 };
    const anchored = { row: 0, col: 1 };

    const result = movePlan.maybeOverrideWithStrictPendingPlacement(
      selected,
      [selected, anchored],
      'black',
      (move: any) => (move === anchored ? 4000 : 0)
    );

    expect(result).toBe(anchored);
    expect(onStrictPendingPlacementOverride).toHaveBeenCalledWith('black', 'DOUBLE_PLACE', anchored);
  });
});
