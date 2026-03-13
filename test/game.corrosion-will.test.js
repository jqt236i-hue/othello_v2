const SharedConstants = require('../shared-constants');
const TurnPipeline = require('../game/turn/turn_pipeline');
const CardLogic = require('../game/logic/cards');

describe('CORROSION_WILL（腐食の意志）', () => {
  function makeState() {
    const prng = { shuffle: () => {}, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: SharedConstants.BLACK,
      turnNumber: 1,
      consecutivePasses: 0
    };
    return { cardState, gameState, prng };
  }

  test('getUsableCardIds: 対象がない CORROSION_WILL は使用可能扱いしない', () => {
    const def = (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'CORROSION_WILL');
    expect(def).toBeTruthy();

    const { cardState, gameState } = makeState();
    cardState.hands.black = [def.id];
    cardState.charge.black = def.cost;

    const usable = CardLogic.getUsableCardIds(cardState, gameState, 'black');
    expect(usable).toEqual([]);
  });

  test('use card後に対象選択し、選んだ特殊石の持続ターンだけ半減する（最小1）', () => {
    const def = (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'CORROSION_WILL');
    expect(def).toBeTruthy();

    const { cardState, gameState, prng } = makeState();
    cardState.hands.black = [def.id];
    cardState.charge.black = def.cost;

    gameState.board[2][2] = SharedConstants.BLACK;
    gameState.board[3][3] = SharedConstants.WHITE;
    gameState.board[4][4] = SharedConstants.BLACK;
    gameState.board[1][1] = SharedConstants.BLACK;

    cardState.markers = [
      { id: 1, row: 2, col: 2, kind: 'specialStone', owner: 'black', createdSeq: 1, data: { type: 'WORK', remainingOwnerTurns: 5 } },
      { id: 2, row: 3, col: 3, kind: 'specialStone', owner: 'white', createdSeq: 2, data: { type: 'GUARD', remainingOwnerTurns: 3 } },
      { id: 3, row: 4, col: 4, kind: 'specialStone', owner: 'black', createdSeq: 3, data: { type: 'WORK', remainingOwnerTurns: 1 } },
      { id: 4, row: 1, col: 1, kind: 'specialStone', owner: 'black', createdSeq: 4, data: { type: 'METEOR_HOLE' } }
    ];

    const useAction = { type: 'use_card', useCardId: def.id };
    const useRes = TurnPipeline.applyTurn(cardState, gameState, 'black', useAction, prng);

    expect(useRes.events.some((e) => e && e.type === 'corrosion_will_resolved')).toBe(false);
    expect(cardState.pendingEffectByPlayer.black).toBeTruthy();
    expect(cardState.pendingEffectByPlayer.black.type).toBe('CORROSION_WILL');
    expect(cardState.pendingEffectByPlayer.black.stage).toBe('selectTarget');

    const selectAction = { type: 'place', corrosionTarget: { row: 2, col: 2 } };
    const selectRes = TurnPipeline.applyTurn(cardState, gameState, 'black', selectAction, prng);
    expect(selectRes.events.some((e) => e && e.type === 'corrosion_will_resolved' && e.applied === true && e.affectedCount === 1)).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();

    const workA = cardState.markers.find((m) => m && m.id === 1);
    const guard = cardState.markers.find((m) => m && m.id === 2);
    const workB = cardState.markers.find((m) => m && m.id === 3);
    const hole = cardState.markers.find((m) => m && m.id === 4);

    expect(workA.data.remainingOwnerTurns).toBe(2);
    expect(guard.data.remainingOwnerTurns).toBe(3);
    expect(workB.data.remainingOwnerTurns).toBe(1);
    expect(hole.data.type).toBe('METEOR_HOLE');
    expect(hole.data.remainingOwnerTurns).toBeUndefined();
  });
});
