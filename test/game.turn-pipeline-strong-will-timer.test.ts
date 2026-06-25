import * as Core from '../game/logic/core.js';
import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';

function createPrng() {
  return {
    shuffle: (arr) => arr,
    random: () => 0
  };
}

describe('TurnPipelinePhases Strong Will persistence', () => {
  test('turn start leaves Strong Will without promotion progress or countdown events', () => {
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
        type: 'PERMA_PROTECTED'
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
    expect(marker.data).not.toHaveProperty('strongWillPromotionOwnerTurnStarts');
    expect(marker.data).not.toHaveProperty('strongWillPromotionThreshold');

    expect(cardState.presentationEvents || []).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'STATUS_TICK',
        row: 2,
        col: 3,
        meta: expect.objectContaining({ special: 'PERMA_PROTECTED' })
      })
    ]));
  });
});
