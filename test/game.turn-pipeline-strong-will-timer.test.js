const SharedConstants = require('../shared-constants');
const Core = require('../game/logic/core');
const CardLogic = require('../game/logic/cards');
const TurnPipelinePhases = require('../game/turn/turn_pipeline_phases');

function createPrng() {
  return {
    shuffle: (arr) => arr,
    random: () => 0
  };
}

describe('TurnPipelinePhases Strong Will timer metadata', () => {
  test('turn start emits STATUS_TICK with Strong Will countdown after owner progress advances', () => {
    const prng = createPrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = Core.createGameState();
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.currentPlayer = Core.BLACK;
    cardState.debugNoDraw = true;
    cardState.presentationEvents = [];

    gameState.board[2][3] = Core.BLACK;
    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 2,
      col: 3,
      owner: 'black',
      data: {
        type: 'PERMA_PROTECTED',
        strongWillPromotionOwnerTurnStarts: 0,
        strongWillPromotionThreshold: SharedConstants.STRONG_WILL_PROMOTION_OWNER_TURNS
      }
    });

    const events = [];
    TurnPipelinePhases.applyTurnStartPhase(
      CardLogic,
      Core,
      cardState,
      gameState,
      'black',
      events,
      prng
    );

    const marker = cardState.markers.find((entry) => (
      entry &&
      entry.kind === 'specialStone' &&
      entry.row === 2 &&
      entry.col === 3
    ));
    expect(marker).toBeTruthy();
    expect(marker.data.type).toBe('PERMA_PROTECTED');
    expect(marker.data.strongWillPromotionOwnerTurnStarts).toBe(1);

    const timerTick = (cardState.presentationEvents || []).find((event) => (
      event &&
      event.type === 'STATUS_TICK' &&
      event.row === 2 &&
      event.col === 3
    ));
    expect(timerTick).toEqual(expect.objectContaining({
      type: 'STATUS_TICK',
      row: 2,
      col: 3,
      meta: expect.objectContaining({
        special: 'PERMA_PROTECTED',
        timer: SharedConstants.STRONG_WILL_PROMOTION_OWNER_TURNS - 1,
        owner: 'black'
      })
    }));
  });
});
