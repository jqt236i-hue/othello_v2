const CardLogic = require('../game/logic/cards');

describe('SWAP_WITH_ENEMY normal-stone only policy', () => {
  function makeState() {
    const prng = { shuffle: () => {}, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: 1
    };
    return { cardState, gameState };
  }

  test('getSelectableTargets(SWAP) excludes enemy special stones', () => {
    const { cardState, gameState } = makeState();
    cardState.pendingEffectByPlayer.black = { type: 'SWAP_WITH_ENEMY', stage: 'selectTarget', cardId: 'swap_01' };

    // Enemy normal stone (selectable)
    gameState.board[2][2] = -1;
    // Enemy special stone (not selectable for SWAP)
    gameState.board[2][3] = -1;
    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 2,
      col: 3,
      owner: 'white',
      data: { type: 'WORK', remainingOwnerTurns: 3 }
    });

    const targets = CardLogic.getSelectableTargets(cardState, gameState, 'black');
    const set = new Set(targets.map(t => `${t.row},${t.col}`));
    expect(set.has('2,2')).toBe(true);
    expect(set.has('2,3')).toBe(false);
  });

  test('applySwapEffect rejects enemy special stone target', () => {
    const { cardState, gameState } = makeState();
    gameState.board[4][4] = -1;
    cardState.markers.push({
      id: 2,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'white',
      data: { type: 'WORK', remainingOwnerTurns: 4 }
    });

    const ok = CardLogic.applySwapEffect(cardState, gameState, 'black', 4, 4);
    expect(ok).toBe(false);
    expect(gameState.board[4][4]).toBe(-1);
  });

  test('applySwapEffect accepts enemy normal stone target', () => {
    const { cardState, gameState } = makeState();
    gameState.board[4][5] = -1;

    const ok = CardLogic.applySwapEffect(cardState, gameState, 'black', 4, 5);
    expect(ok).toBe(true);
    expect(gameState.board[4][5]).toBe(1);
  });

  test('SWAP treats hidden opponent trap as normal-stone target', () => {
    const { cardState, gameState } = makeState();
    cardState.pendingEffectByPlayer.black = { type: 'SWAP_WITH_ENEMY', stage: 'selectTarget', cardId: 'swap_01' };
    gameState.board[1][1] = -1;
    cardState.markers.push({
      id: 9,
      kind: 'specialStone',
      row: 1,
      col: 1,
      owner: 'white',
      data: { type: 'TRAP', hidden: true }
    });

    const targets = CardLogic.getSelectableTargets(cardState, gameState, 'black');
    const set = new Set(targets.map(t => `${t.row},${t.col}`));
    expect(set.has('1,1')).toBe(true);

    const ok = CardLogic.applySwapEffect(cardState, gameState, 'black', 1, 1);
    expect(ok).toBe(true);
    expect(gameState.board[1][1]).toBe(1);
  });

  test('TEMPT_WILL still accepts enemy special stone target', () => {
    const { cardState, gameState } = makeState();
    cardState.pendingEffectByPlayer.black = { type: 'TEMPT_WILL', stage: 'selectTarget', cardId: 'tempt_01' };

    gameState.board[5][5] = -1;
    cardState.markers.push({
      id: 3,
      kind: 'specialStone',
      row: 5,
      col: 5,
      owner: 'white',
      data: { type: 'WORK', remainingOwnerTurns: 2 }
    });

    const res = CardLogic.applyTemptWill(cardState, gameState, 'black', 5, 5);
    expect(res && res.applied).toBe(true);
    expect(gameState.board[5][5]).toBe(1);
  });
});
