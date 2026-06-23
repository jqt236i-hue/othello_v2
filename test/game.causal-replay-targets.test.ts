import * as CardLogic from '../game/logic/cards.js';
import * as Core from '../game/logic/core.js';
import * as SharedConstants from '../shared-constants.js';

function createPrng(randomValue = 0.5) {
  return {
    shuffle: (arr) => arr,
    random: () => randomValue
  };
}

describe('CAUSAL_REPLAY_WILL target availability', () => {
  test('only METEOR_HOLE cells are selectable targets', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.board[4][4] = Core.BLACK;
    cardState.markers.push(
      { id: 'hole_1', kind: 'specialStone', row: 2, col: 3, owner: 'black', data: { type: 'METEOR_HOLE' } },
      { id: 'blockade_1', kind: 'specialStone', row: 1, col: 1, owner: 'black', data: { type: 'BLOCKADE' } }
    );

    const targets = CardLogic.getCausalReplayTargets(cardState, gameState, 'black');

    expect(targets).toContainEqual({ row: 2, col: 3 });
    expect(targets).not.toContainEqual({ row: 1, col: 1 });
    expect(targets).not.toContainEqual({ row: 4, col: 4 });
  });

  test('card cannot be used while no hole cells exist', () => {
    const def = (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'CAUSAL_REPLAY_WILL');
    expect(def).toBeTruthy();

    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;
    cardState.charge.black = 99;
    cardState.hands.black = [def.id];

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);

    expect(used).toBe(false);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(cardState.hands.black).toContain(def.id);
  });
});
