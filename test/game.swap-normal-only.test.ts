import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';

describe('SWAP_WITH_ENEMY normal-stone only policy', () => {
  function makeState(rows = 8, cols = rows) {
    const prng = { shuffle: () => {}, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: rows }, () => Array(cols).fill(0)),
      currentPlayer: 1,
      turnNumber: 1,
      consecutivePasses: 0
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

  test('applySwapEffect rejects enemy ghost target because ghost is not a normal stone', () => {
    const { cardState, gameState } = makeState();
    gameState.board[4][5] = -1;
    cardState.markers.push({
      id: 22,
      kind: 'specialStone',
      row: 4,
      col: 5,
      owner: 'white',
      data: { type: 'GHOST', remainingOwnerTurns: 4 }
    });

    expect(CardLogic.getSwapTargets(cardState, gameState, 'black')).not.toEqual(expect.arrayContaining([{ row: 4, col: 5 }]));
    const ok = CardLogic.applySwapEffect(cardState, gameState, 'black', 4, 5);
    expect(ok).toBe(false);
    expect(gameState.board[4][5]).toBe(-1);
    expect(cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 4, col: 5, owner: 'white', data: expect.objectContaining({ type: 'GHOST' }) })
    ]));
  });

  test('applyCardUsage arms SWAP_WITH_ENEMY when an enemy normal stone exists', () => {
    const { cardState, gameState } = makeState();
    cardState.hands.black = ['swap_01'];
    cardState.charge.black = CardLogic.getCardCost('swap_01');
    gameState.board[4][5] = -1;

    const ok = CardLogic.applyCardUsage(cardState, gameState, 'black', 'swap_01');

    expect(ok).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({
      type: 'SWAP_WITH_ENEMY',
      stage: 'selectTarget',
      cardId: 'swap_01'
    }));
  });

  test('applySwapEffect flips bracketed stones created by the swap', () => {
    const { cardState, gameState } = makeState();
    // row 3: B W W B  (target: [3,3])
    gameState.board[3][2] = 1;
    gameState.board[3][3] = -1;
    gameState.board[3][4] = -1;
    gameState.board[3][5] = 1;

    const ok = CardLogic.applySwapEffect(cardState, gameState, 'black', 3, 3);
    expect(ok).toBe(true);
    expect(gameState.board[3][3]).toBe(1);
    expect(gameState.board[3][4]).toBe(1);
    // swap 本体1 + 挟み反転1
    expect(cardState.charge.black).toBe(2);
  });

  test('applySwapEffect does not flip guarded stones', () => {
    const { cardState, gameState } = makeState();
    // row 4: B W(guard) W(target) B  -> guard があるため挟み不成立
    gameState.board[4][2] = 1;
    gameState.board[4][3] = -1;
    gameState.board[4][4] = -1;
    gameState.board[4][5] = 1;
    cardState.markers.push({
      id: 11,
      kind: 'specialStone',
      row: 4,
      col: 3,
      owner: 'white',
      data: { type: 'GUARD', remainingOwnerTurns: 2 }
    });

    const ok = CardLogic.applySwapEffect(cardState, gameState, 'black', 4, 4);
    expect(ok).toBe(true);
    expect(gameState.board[4][4]).toBe(1);
    expect(gameState.board[4][3]).toBe(-1);
    // swap 本体のみ
    expect(cardState.charge.black).toBe(1);
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

  test('SWAP includes occupied expansion cells and can capture from them', () => {
    const { cardState, gameState } = makeState();
    cardState.pendingEffectByPlayer.black = { type: 'SWAP_WITH_ENEMY', stage: 'selectTarget', cardId: 'swap_01' };
    gameState.board[3][0] = -1;
    gameState.board[3][1] = 1;
    gameState.boardExpansion = {
      active: true,
      side: 'left',
      row: 3,
      owner: -1,
      usedByPlayer: { black: false, white: false },
      cells: [{ side: 'left', row: 3, col: -1, owner: -1 }]
    };

    const targets = CardLogic.getSelectableTargets(cardState, gameState, 'black');
    expect(targets).toEqual(expect.arrayContaining([{ row: 3, col: -1 }]));

    const ok = CardLogic.applySwapEffect(cardState, gameState, 'black', 3, -1);
    expect(ok).toBe(true);
    expect(gameState.boardExpansion.cells.find((cell) => cell && cell.row === 3 && cell.col === -1).owner).toBe(1);
    expect(gameState.board[3][0]).toBe(1);
    expect(cardState.charge.black).toBe(2);
  });

  test('SWAP includes occupied right expansion cells on 10x10 and can capture from them', () => {
    const { cardState, gameState } = makeState(10, 10);
    cardState.pendingEffectByPlayer.black = { type: 'SWAP_WITH_ENEMY', stage: 'selectTarget', cardId: 'swap_01' };
    gameState.board[0][9] = 1;
    gameState.board[1][9] = -1;
    gameState.board[2][8] = 1;
    gameState.boardExpansion = {
      active: true,
      side: 'right',
      row: 0,
      owner: -1,
      usedByPlayer: { black: false, white: false },
      cells: [{ side: 'right', row: 0, col: 10, owner: -1 }]
    };

    const targets = CardLogic.getSelectableTargets(cardState, gameState, 'black');
    expect(targets).toEqual(expect.arrayContaining([{ row: 0, col: 10 }]));

    const ok = CardLogic.applySwapEffect(cardState, gameState, 'black', 0, 10);
    expect(ok).toBe(true);
    expect(gameState.boardExpansion.cells.find((cell) => cell && cell.row === 0 && cell.col === 10).owner).toBe(1);
    expect(gameState.board[1][9]).toBe(1);
    expect(cardState.charge.black).toBe(2);
  });

  test('TurnPipeline accepts top expansion selection via legacy board click', () => {
    const { cardState, gameState } = makeState();
    cardState.pendingEffectByPlayer.black = { type: 'SWAP_WITH_ENEMY', stage: 'selectTarget', cardId: 'swap_01' };
    gameState.boardExpansion = {
      active: true,
      side: 'top',
      row: -1,
      owner: -1,
      usedByPlayer: { black: true, white: false },
      cells: [{ side: 'top', row: -1, col: 0, owner: -1 }]
    };

    const result = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: -1, col: 0 });

    expect(result.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'swap_selected', row: -1, col: 0, swapped: true })
    ]));
    expect(result.gameState.boardExpansion.cells.find((cell) => cell && cell.row === -1 && cell.col === 0).owner).toBe(1);
    expect(result.gameState.currentPlayer).toBe(-1);
    expect(result.gameState.turnNumber).toBe(2);
    expect(result.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(result.cardState.charge.black).toBe(1);
  });

  test('TurnPipeline swapTarget selection ends the turn immediately', () => {
    const { cardState, gameState } = makeState();
    cardState.pendingEffectByPlayer.black = { type: 'SWAP_WITH_ENEMY', stage: 'selectTarget', cardId: 'swap_01' };
    gameState.board[2][2] = -1;
    gameState.turnNumber = 4;

    const result = TurnPipeline.applyTurn(cardState, gameState, 'black', {
      type: 'place',
      swapTarget: { row: 2, col: 2 }
    });

    expect(result.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'swap_selected', row: 2, col: 2, swapped: true })
    ]));
    expect(result.gameState.board[2][2]).toBe(1);
    expect(result.gameState.currentPlayer).toBe(-1);
    expect(result.gameState.turnNumber).toBe(5);
    expect(result.cardState.pendingEffectByPlayer.black).toBeNull();
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

  test('TEMPT_WILL steals WORK anchor but converts it to a normal stone', () => {
    const { cardState, gameState } = makeState();
    cardState.pendingEffectByPlayer.black = { type: 'TEMPT_WILL', stage: 'selectTarget', cardId: 'tempt_01' };

    gameState.board[5][5] = -1;
    cardState.workAnchorPosByPlayer.white = { row: 5, col: 5 };
    cardState.markers.push({
      id: 4,
      kind: 'specialStone',
      row: 5,
      col: 5,
      owner: 'white',
      data: { type: 'WORK', ownerColor: 'white', workStage: 2, remainingOwnerTurns: 3 }
    });

    const res = CardLogic.applyTemptWill(cardState, gameState, 'black', 5, 5);
    expect(res && res.applied).toBe(true);
    expect(gameState.board[5][5]).toBe(1);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(cardState.workAnchorPosByPlayer.white).toBeNull();
    expect((cardState.markers || []).some((m) => m && m.row === 5 && m.col === 5 && m.data && m.data.type === 'WORK')).toBe(false);
  });
});
