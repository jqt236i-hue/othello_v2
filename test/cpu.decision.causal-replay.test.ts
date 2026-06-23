const { createCpuDecisionPendingActions } = require('../game/cpu-decision-pending-actions.js');
const { createCpuDecisionPendingScore } = require('../game/cpu-decision-pending-score.js');

describe('CPU causal replay pending action', () => {
  test('cpuSelectCausalReplayWillWithPolicy publishes causalReplayTarget through pending pipeline', async () => {
    const runCpuPendingSelectionViaPipeline = jest.fn(async () => ({ ok: true }));
    const cardState: any = {
      pendingEffectByPlayer: { white: { type: 'CAUSAL_REPLAY_WILL', stage: 'selectTarget' } }
    };
    const gameState: any = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };
    const actions = createCpuDecisionPendingActions({
      buildCardUseDecisionContext: jest.fn(),
      choosePendingTargetWithPolicyAsync: jest.fn(async () => ({ row: 0, col: 0 })),
      chooseTimeBombTargetWithPolicy: jest.fn(),
      clearCpuPendingEffect: jest.fn(),
      cpuDebugLog: jest.fn(),
      emitCpuEffectLog: jest.fn(),
      emitCpuSelectionStateChange: jest.fn(),
      filterCloneTargetsForLv6: (_playerKey, targets) => targets,
      getActiveProtectionForPlayer: jest.fn(),
      getBoardCellValueSafe: (board, row, col) => board[row]?.[col] ?? null,
      getCardLogic: () => ({
        getCausalReplayTargets: () => [{ row: 0, col: 0 }, { row: 4, col: 4 }],
        applyCausalReplayWill: jest.fn(() => ({ applied: true }))
      }),
      getCardState: () => cardState,
      getCpuPolicyCore: jest.fn(),
      getCpuRng: () => ({ random: () => 0.5 }),
      getCurrentCpuBoard: () => gameState.board,
      getFlipBlockers: () => [],
      getGameState: () => gameState,
      getLegalMoves: () => [],
      handOffSelectionTurnInGameState: jest.fn(),
      maybeContinueCpuSelectionTurnHandoff: jest.fn(),
      readCpuPendingEffect: (playerKey) => cardState.pendingEffectByPlayer[playerKey],
      resolveCpuDecisionLevelForPlayer: () => 6,
      resolvePlayerValue: (playerKey) => (playerKey === 'black' ? 1 : -1),
      resolveSharedBoardUtilsModule: jest.fn(),
      runCpuPendingSelectionViaPipeline
    });

    await actions.cpuSelectCausalReplayWillWithPolicy('white');

    expect(runCpuPendingSelectionViaPipeline).toHaveBeenCalledWith(
      'white',
      { causalReplayTarget: { row: 0, col: 0 } },
      'CAUSAL_REPLAY_WILL'
    );
  });

  test('CAUSAL_REPLAY_WILL target score prefers restoring corner holes over center holes', () => {
    const scorer = createCpuDecisionPendingScore({
      getCurrentCpuBoard: () => Array.from({ length: 8 }, () => Array(8).fill(0)),
      resolvePlayerValue: () => -1,
      getBoardCellValueSafe: (board, row, col) => board[row]?.[col] ?? null,
      isCornerCell: (row, col) => (row === 0 || row === 7) && (col === 0 || col === 7),
      isEdgeCell: (row, col) => row === 0 || row === 7 || col === 0 || col === 7,
      countAdjacentCellsByValue: () => 0,
      getBoardBonusValueAt: () => 0,
      getMarkerProfileAt: () => ({ ownSpecialScore: 0, oppSpecialScore: 0, ownBombCount: 0, oppBombCount: 0 }),
      getTimedMarkerProfileAt: () => null,
      scoreSeatStrategicValue: () => 0,
      countBoardStatsForPlayer: () => ({ discDiff: 0 }),
      getCornerProximity: () => null,
      getCpuSmartnessLevel: () => 6,
      getCardState: () => ({}),
      getCpuPolicyCore: () => null,
      buildMovePlanContext: jest.fn(),
      simulatePendingPlacementBoard: jest.fn(),
      getStrongWindLandingProfile: () => null,
      getForcedCornerLaneBonus: () => 0,
      getForcedCornerLaneAntiPatternPenalty: () => 0,
      isCloneSplitEligibleSource: () => true
    });

    expect(
      scorer.scorePendingTargetByType('white', 'CAUSAL_REPLAY_WILL', { row: 0, col: 0 }, null)
    ).toBeGreaterThan(
      scorer.scorePendingTargetByType('white', 'CAUSAL_REPLAY_WILL', { row: 3, col: 3 }, null)
    );
  });
});
