const Planner = require('../game/cpu-network-command-planner');

function pendingInput(overrides: any = {}) {
  const pending = { type: 'GRAVITY_WILL', stage: 'selectTarget', cardId: 'gravity_01', pendingEffectId: 'p1', sourceHandIndex: 0 };
  return {
    playerKey: 'black',
    gameState: { board: [[0]], currentPlayer: 1, turnNumber: 10 },
    cardState: { turnIndex: 10, hands: { black: [], white: [] }, pendingEffectByPlayer: { black: pending, white: null } },
    CardLogic: { getGravityTargets: () => [{ row: 0, col: 0 }, { row: 1, col: 1 }] },
    PendingCoordinator: { resolvePendingSelectionActionField: () => 'gravityTarget' },
    PendingSelectionRegistry: {
      getPendingSelectionTargetMethod: () => 'getGravityTargets',
      getPendingSelectionEntry: () => ({ needsTargetSelection: true, cancellable: true })
    },
    ...overrides
  };
}

describe('CpuNetworkCommandPlanner pending target progress', () => {
  test('moves to the next target when the same selection step is planned again', () => {
    const input = pendingInput();
    const first = Planner.planCpuNetworkCommand(input);
    expect(first.action.gravityTarget).toEqual({ row: 0, col: 0 });
    // Same pending step still open: the previous target changed nothing.
    const second = Planner.planCpuNetworkCommand(pendingInput());
    expect(second.action.gravityTarget).toEqual({ row: 1, col: 1 });
  });

  test('cancels once every target of the step has been tried', () => {
    Planner.planCpuNetworkCommand(pendingInput({ gameState: { board: [[0]], currentPlayer: 1, turnNumber: 11 } }));
    Planner.planCpuNetworkCommand(pendingInput({ gameState: { board: [[0]], currentPlayer: 1, turnNumber: 11 } }));
    const third = Planner.planCpuNetworkCommand(pendingInput({ gameState: { board: [[0]], currentPlayer: 1, turnNumber: 11 } }));
    expect(third.actionType).toBe('cancel_card');
  });
});
