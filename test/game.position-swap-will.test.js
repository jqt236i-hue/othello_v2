const CardLogic = require('../game/logic/cards');
const SharedConstants = require('../shared-constants');

describe('POSITION_SWAP_WILL (入替の意志)', () => {
  function makeState() {
    const prng = { shuffle: () => {}, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: 1
    };
    return { cardState, gameState };
  }

  test('applyCardUsage requires at least two occupied cells', () => {
    const { cardState, gameState } = makeState();
    const def = (SharedConstants.CARD_DEFS || []).find(d => d && d.type === 'POSITION_SWAP_WILL');
    expect(def).toBeTruthy();

    cardState.hands.black = [def.id];
    cardState.charge.black = 30;
    gameState.board[2][2] = 1;

    const fail = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
    expect(fail).toBe(false);

    gameState.board[4][4] = -1;
    const ok = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
    expect(ok).toBe(true);
    expect(cardState.pendingEffectByPlayer.black && cardState.pendingEffectByPlayer.black.type).toBe('POSITION_SWAP_WILL');
  });

  test('getSelectableTargets excludes first selected cell', () => {
    const { cardState, gameState } = makeState();
    gameState.board[1][1] = 1;
    gameState.board[2][2] = -1;
    gameState.board[3][3] = 1;
    cardState.pendingEffectByPlayer.black = {
      type: 'POSITION_SWAP_WILL',
      stage: 'selectTarget',
      firstTarget: { row: 2, col: 2 }
    };

    const targets = CardLogic.getSelectableTargets(cardState, gameState, 'black');
    const set = new Set(targets.map(t => `${t.row},${t.col}`));
    expect(set.has('1,1')).toBe(true);
    expect(set.has('3,3')).toBe(true);
    expect(set.has('2,2')).toBe(false);
  });

  test('second selection swaps board, markers, and stone ids', () => {
    const { cardState, gameState } = makeState();
    gameState.board[2][2] = 1;
    gameState.board[5][5] = -1;
    cardState.stoneIdMap[2][2] = 'sa';
    cardState.stoneIdMap[5][5] = 'sb';
    cardState.markers.push({
      id: 101,
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: { type: 'DRAGON', remainingOwnerTurns: 3 }
    });
    cardState.markers.push({
      id: 102,
      kind: 'bomb',
      row: 5,
      col: 5,
      owner: 'white',
      data: { remainingTurns: 2 }
    });
    cardState.workAnchorPosByPlayer.black = { row: 2, col: 2 };
    cardState.pendingEffectByPlayer.black = { type: 'POSITION_SWAP_WILL', stage: 'selectTarget', cardId: 'position_swap_01' };

    const first = CardLogic.applyPositionSwapWill(cardState, gameState, 'black', 2, 2);
    expect(first && first.applied).toBe(true);
    expect(first && first.completed).toBe(false);

    const second = CardLogic.applyPositionSwapWill(cardState, gameState, 'black', 5, 5);
    expect(second && second.applied).toBe(true);
    expect(second && second.completed).toBe(true);
    expect(gameState.board[2][2]).toBe(-1);
    expect(gameState.board[5][5]).toBe(1);
    expect(cardState.stoneIdMap[2][2]).toBe('sb');
    expect(cardState.stoneIdMap[5][5]).toBe('sa');

    const dragon = cardState.markers.find(m => m && m.id === 101);
    const bomb = cardState.markers.find(m => m && m.id === 102);
    expect(dragon.row).toBe(5);
    expect(dragon.col).toBe(5);
    expect(bomb.row).toBe(2);
    expect(bomb.col).toBe(2);
    expect(cardState.workAnchorPosByPlayer.black).toEqual({ row: 5, col: 5 });
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });
});
