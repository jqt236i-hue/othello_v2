const Core = require('../game/logic/core');
const CardLogic = require('../game/logic/cards');
const TurnPipelinePhases = require('../game/turn/turn_pipeline_phases');
const PendingCoordinator = require('../game/turn/pending-coordinator');

function createPrng() {
  return {
    shuffle: (arr) => arr,
    random: () => 0
  };
}

describe('TurnPipelinePhases turn start pending cache sync', () => {
  afterEach(() => {
    PendingCoordinator.clearPendingSelectionActionCache();
  });

  test('applyTurnStartPhase prunes stale pending selection cache by turnIndex before turn logic runs', () => {
    const prng = createPrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = Core.createGameState();
    const events = [];

    cardState.debugNoDraw = true;
    cardState.turnIndex = 7;
    cardState.pendingEffectByPlayer.black = {
      type: 'GUARD_WILL',
      stage: 'selectTarget'
    };
    PendingCoordinator.storePendingSelectionAction(
      'black',
      { type: 'pending_selection', cardId: 'guard_01', turnIndex: 6 },
      'GUARD_WILL'
    );

    TurnPipelinePhases.applyTurnStartPhase(
      CardLogic,
      Core,
      cardState,
      gameState,
      'black',
      events,
      prng
    );

    expect(PendingCoordinator.readPendingSelectionAction('black')).toBeNull();
  });

  test('applyActionPhase pass clears pending selection cache even when coordinator clearPendingEffect is unavailable', () => {
    jest.resetModules();
    const pendingCoordinatorMock = {
      readPendingEffect: PendingCoordinator.readPendingEffect,
      getPendingEffectType: PendingCoordinator.getPendingEffectType,
      clearPendingSelectionAction: jest.fn((playerKey) => PendingCoordinator.clearPendingSelectionAction(playerKey)),
      syncPendingSelectionActionCache: PendingCoordinator.syncPendingSelectionActionCache
    };
    jest.doMock('../game/turn/pending-coordinator', () => pendingCoordinatorMock, { virtual: false });

    const isolatedTurnPipelinePhases = require('../game/turn/turn_pipeline_phases');
    const prng = createPrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = Core.createGameState();
    const events = [];
    const getLegalMovesSpy = jest.spyOn(Core, 'getLegalMoves').mockReturnValueOnce([]);
    try {
      cardState.pendingEffectByPlayer.black = {
        type: 'GUARD_WILL',
        stage: 'selectTarget'
      };
      PendingCoordinator.storePendingSelectionAction(
        'black',
        { type: 'pending_selection', cardId: 'guard_01', turnIndex: cardState.turnIndex },
        'GUARD_WILL'
      );

      isolatedTurnPipelinePhases.applyActionPhase(
        CardLogic,
        Core,
        cardState,
        gameState,
        'black',
        { type: 'pass' },
        events,
        prng
      );

      expect(pendingCoordinatorMock.clearPendingSelectionAction).toHaveBeenCalledWith('black');
      expect(PendingCoordinator.readPendingSelectionAction('black')).toBeNull();
    } finally {
      getLegalMovesSpy.mockRestore();
      jest.dontMock('../game/turn/pending-coordinator');
    }
  });
});
