const CardLogic = require('../game/logic/cards');

describe('STRONG_WIND_WILL', () => {
  function makeState() {
    const prng = { shuffle: () => {}, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: 1
    };
    cardState.pendingEffectByPlayer.black = { type: 'STRONG_WIND_WILL', stage: 'selectTarget', cardId: 'strong_wind_01' };
    return { cardState, gameState };
  }

  test('moves selected stone to farthest reachable cell in selected direction and moves marker too', () => {
    const { cardState, gameState } = makeState();

    // source stone
    gameState.board[3][3] = 1;
    cardState.stoneIdMap[3][3] = 's10';
    // block up/down/left immediately, allow right lane
    gameState.board[2][3] = -1;
    gameState.board[4][3] = -1;
    gameState.board[3][2] = -1;
    // right side: empty at (3,4)(3,5), blocker at (3,6)
    gameState.board[3][6] = -1;
    cardState.stoneIdMap[3][6] = 's11';

    // marker on source should follow moved stone
    cardState.markers.push({
      id: 'm1',
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'PERMA_PROTECTED' }
    });

    const res = CardLogic.applyStrongWindWill(
      cardState,
      gameState,
      'black',
      3,
      3,
      { random: () => 0.0 } // only one direction candidate, deterministic
    );

    expect(res && res.applied).toBe(true);
    expect(res.from).toEqual({ row: 3, col: 3 });
    expect(res.to).toEqual({ row: 3, col: 5 });

    expect(gameState.board[3][3]).toBe(0);
    expect(gameState.board[3][5]).toBe(1);
    expect(cardState.stoneIdMap[3][3]).toBeNull();
    expect(cardState.stoneIdMap[3][5]).toBe('s10');

    const movedMarker = cardState.markers.find(m => m.id === 'm1');
    expect(movedMarker.row).toBe(3);
    expect(movedMarker.col).toBe(5);

    expect(cardState.pendingEffectByPlayer.black).toBeNull();

    const moveEvents = (cardState._presentationEventsPersist || []).filter(e => e.type === 'MOVE');
    expect(moveEvents.length).toBeGreaterThanOrEqual(1);
    expect(moveEvents[0].cause).toBe('STRONG_WIND_WILL');
    expect(moveEvents[0].reason).toBe('strong_wind_move');
  });

  test('rejects selecting a stone with no orthogonal empty adjacent cell', () => {
    const { cardState, gameState } = makeState();
    gameState.board[3][3] = 1;
    gameState.board[2][3] = -1;
    gameState.board[4][3] = -1;
    gameState.board[3][2] = -1;
    gameState.board[3][4] = -1;

    const res = CardLogic.applyStrongWindWill(cardState, gameState, 'black', 3, 3, { random: () => 0.5 });
    expect(res && res.applied).toBe(false);
    expect(cardState.pendingEffectByPlayer.black).toBeTruthy();
    expect(gameState.board[3][3]).toBe(1);
  });
});

