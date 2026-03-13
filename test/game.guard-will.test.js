const SharedConstants = require('../shared-constants');
const CardLogic = require('../game/logic/cards');
const BoardOps = require('../game/logic/board_ops');
const CardSelectors = require('../game/logic/cards/selectors');

describe('GUARD_WILL / GUARDIAN_GOD (守る意志/守護神)', () => {
  function makeState() {
    const prng = { shuffle: () => {}, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: 1,
      turnNumber: 1,
      consecutivePasses: 0
    };
    return { cardState, gameState };
  }

  test('can guard own stone and clear pending', () => {
    const guardDef = (SharedConstants.CARD_DEFS || []).find(d => d && d.type === 'GUARD_WILL');
    expect(guardDef).toBeTruthy();

    const { cardState, gameState } = makeState();
    gameState.board[2][2] = 1;
    cardState.hands.black = [guardDef.id];
    cardState.charge.black = guardDef.cost;

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', guardDef.id);
    expect(used).toBe(true);
    expect(cardState.pendingEffectByPlayer.black && cardState.pendingEffectByPlayer.black.type).toBe('GUARD_WILL');

    const applied = CardLogic.applyGuardWill(cardState, gameState, 'black', 2, 2);
    expect(applied && applied.applied).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();

    const guardMarker = (cardState.markers || []).find(m => m && m.row === 2 && m.col === 2 && m.data && m.data.type === 'GUARD');
    expect(guardMarker).toBeTruthy();
    expect(guardMarker.owner).toBe('black');
    expect(guardMarker.data.remainingOwnerTurns).toBe(3);
  });

  test('can apply guardian god protection with 10-turn duration', () => {
    const guardianDef = (SharedConstants.CARD_DEFS || []).find(d => d && d.type === 'GUARDIAN_GOD');
    expect(guardianDef).toBeTruthy();

    const { cardState, gameState } = makeState();
    gameState.board[2][3] = 1;
    cardState.hands.black = [guardianDef.id];
    cardState.charge.black = guardianDef.cost;

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', guardianDef.id);
    expect(used).toBe(true);
    expect(cardState.pendingEffectByPlayer.black && cardState.pendingEffectByPlayer.black.type).toBe('GUARDIAN_GOD');

    const applied = CardLogic.applyGuardWill(cardState, gameState, 'black', 2, 3);
    expect(applied && applied.applied).toBe(true);

    let guardMarker = (cardState.markers || []).find(m => m && m.row === 2 && m.col === 3 && m.data && m.data.type === 'GUARD');
    expect(guardMarker).toBeTruthy();
    expect(guardMarker.owner).toBe('black');
    expect(guardMarker.data.remainingOwnerTurns).toBe(10);

    CardLogic.onTurnStart(cardState, 'white', gameState);
    guardMarker = (cardState.markers || []).find(m => m && m.row === 2 && m.col === 3 && m.data && m.data.type === 'GUARD');
    expect(guardMarker.data.remainingOwnerTurns).toBe(10);

    CardLogic.onTurnStart(cardState, 'black', gameState);
    guardMarker = (cardState.markers || []).find(m => m && m.row === 2 && m.col === 3 && m.data && m.data.type === 'GUARD');
    expect(guardMarker.data.remainingOwnerTurns).toBe(9);
  });

  test('destroy is blocked while guarded', () => {
    const { cardState, gameState } = makeState();
    gameState.board[3][3] = 1;
    cardState.markers.push({
      id: 101,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'GUARD', remainingOwnerTurns: 3 }
    });

    const destroyed = BoardOps.destroyAt(cardState, gameState, 3, 3, 'SYSTEM', 'test');
    expect(destroyed && destroyed.destroyed).toBe(false);
    expect(destroyed && destroyed.reason).toBe('guard_protected');
    expect(gameState.board[3][3]).toBe(1);
  });

  test('swap target excludes guarded stones', () => {
    const { cardState, gameState } = makeState();
    gameState.board[4][4] = -1; // white stone
    cardState.markers.push({
      id: 102,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'white',
      data: { type: 'GUARD', remainingOwnerTurns: 3 }
    });

    const targets = CardSelectors.getSwapTargets(cardState, gameState, 'black');
    expect(targets.some(t => t.row === 4 && t.col === 4)).toBe(false);
  });

  test('tempt is blocked while guarded', () => {
    const { cardState, gameState } = makeState();
    gameState.board[5][5] = -1; // white stone
    cardState.markers.push(
      {
        id: 103,
        kind: 'specialStone',
        row: 5,
        col: 5,
        owner: 'white',
        data: { type: 'DRAGON', remainingOwnerTurns: 4 }
      },
      {
        id: 104,
        kind: 'specialStone',
        row: 5,
        col: 5,
        owner: 'white',
        data: { type: 'GUARD', remainingOwnerTurns: 3 }
      }
    );

    cardState.pendingEffectByPlayer.black = { type: 'TEMPT_WILL', stage: 'selectTarget' };
    const res = CardLogic.applyTemptWill(cardState, gameState, 'black', 5, 5);
    expect(res && res.applied).toBe(false);
    expect(res && res.reason).toBe('guarded');
    expect(gameState.board[5][5]).toBe(-1);
  });

  test('guard duration decreases on owner turns only and then expires', () => {
    const { cardState, gameState } = makeState();
    gameState.board[1][1] = 1;
    cardState.markers.push({
      id: 105,
      kind: 'specialStone',
      row: 1,
      col: 1,
      owner: 'black',
      data: { type: 'GUARD', remainingOwnerTurns: 3 }
    });

    CardLogic.onTurnStart(cardState, 'white', gameState);
    let guard = (cardState.markers || []).find(m => m && m.data && m.data.type === 'GUARD');
    expect(guard.data.remainingOwnerTurns).toBe(3);

    CardLogic.onTurnStart(cardState, 'black', gameState);
    guard = (cardState.markers || []).find(m => m && m.data && m.data.type === 'GUARD');
    expect(guard.data.remainingOwnerTurns).toBe(2);

    CardLogic.onTurnStart(cardState, 'black', gameState);
    guard = (cardState.markers || []).find(m => m && m.data && m.data.type === 'GUARD');
    expect(guard.data.remainingOwnerTurns).toBe(1);

    CardLogic.onTurnStart(cardState, 'black', gameState);
    guard = (cardState.markers || []).find(m => m && m.data && m.data.type === 'GUARD');
    expect(guard).toBeUndefined();
  });

  test('guarded stone is not flipped by DRAGON immediate effect', () => {
    const { cardState, gameState } = makeState();
    gameState.board[3][3] = 1;   // black dragon anchor
    gameState.board[3][4] = -1;  // white guarded stone
    cardState.markers.push(
      {
        id: 201,
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        data: { type: 'DRAGON', remainingOwnerTurns: 5 }
      },
      {
        id: 202,
        kind: 'specialStone',
        row: 3,
        col: 4,
        owner: 'white',
        data: { type: 'GUARD', remainingOwnerTurns: 3 }
      }
    );

    CardLogic.processDragonEffectsAtAnchor(cardState, gameState, 'black', 3, 3);
    expect(gameState.board[3][4]).toBe(-1);
  });

  test('guarded stone is not flipped by DRAGON turn-start effect', () => {
    const { cardState, gameState } = makeState();
    gameState.board[4][4] = 1;   // black dragon anchor
    gameState.board[4][5] = -1;  // white guarded stone
    cardState.markers.push(
      {
        id: 203,
        kind: 'specialStone',
        row: 4,
        col: 4,
        owner: 'black',
        data: { type: 'DRAGON', remainingOwnerTurns: 5 }
      },
      {
        id: 204,
        kind: 'specialStone',
        row: 4,
        col: 5,
        owner: 'white',
        data: { type: 'GUARD', remainingOwnerTurns: 3 }
      }
    );

    CardLogic.processDragonEffectsAtTurnStartAnchor(cardState, gameState, 'black', 4, 4);
    expect(gameState.board[4][5]).toBe(-1);
  });

  test('can guard own expansion stone', () => {
    const { cardState, gameState } = makeState();
    gameState.boardExpansion = {
      active: false,
      side: null,
      row: null,
      owner: SharedConstants.EMPTY,
      usedByPlayer: { black: false, white: false },
      cells: [{ side: 'left', row: 2, col: -1, owner: SharedConstants.BLACK }]
    };
    cardState.pendingEffectByPlayer.black = { type: 'GUARD_WILL', stage: 'selectTarget', cardId: 'guard_expansion_01' };

    const applied = CardLogic.applyGuardWill(cardState, gameState, 'black', 2, -1);

    expect(applied).toMatchObject({ applied: true, row: 2, col: -1 });
    expect(cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 2, col: -1, owner: 'black', data: expect.objectContaining({ type: 'GUARD', remainingOwnerTurns: 3 }) })
    ]));
  });

  test('tempt targets and steals opponent expansion special stone', () => {
    const { cardState, gameState } = makeState();
    gameState.boardExpansion = {
      active: false,
      side: null,
      row: null,
      owner: SharedConstants.EMPTY,
      usedByPlayer: { black: false, white: false },
      cells: [{ side: 'left', row: 5, col: -1, owner: SharedConstants.WHITE }]
    };
    cardState.markers.push({
      id: 301,
      kind: 'specialStone',
      row: 5,
      col: -1,
      owner: 'white',
      data: { type: 'DRAGON', remainingOwnerTurns: 4 }
    });

    const targets = CardLogic.getTemptWillTargets(cardState, gameState, 'black');
    expect(targets).toEqual(expect.arrayContaining([{ row: 5, col: -1 }]));

    cardState.pendingEffectByPlayer.black = { type: 'TEMPT_WILL', stage: 'selectTarget' };
    const res = CardLogic.applyTemptWill(cardState, gameState, 'black', 5, -1);

    expect(res).toMatchObject({ applied: true });
    expect(gameState.boardExpansion.cells.find((cell) => cell && cell.row === 5 && cell.col === -1).owner).toBe(SharedConstants.BLACK);
    const marker = cardState.markers.find((entry) => entry && entry.row === 5 && entry.col === -1 && entry.data && entry.data.type === 'DRAGON');
    expect(marker && marker.owner).toBe('black');
  });
});
