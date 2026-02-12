const SharedConstants = require('../shared-constants');
const CardLogic = require('../game/logic/cards');
const BoardOps = require('../game/logic/board_ops');
const CardSelectors = require('../game/logic/cards/selectors');

describe('GUARD_WILL (守る意志)', () => {
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
    expect(guardMarker.data.remainingOwnerTurns).toBe(5);
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
      data: { type: 'GUARD', remainingOwnerTurns: 5 }
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
      data: { type: 'GUARD', remainingOwnerTurns: 5 }
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
        data: { type: 'GUARD', remainingOwnerTurns: 5 }
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
      data: { type: 'GUARD', remainingOwnerTurns: 5 }
    });

    CardLogic.onTurnStart(cardState, 'white', gameState);
    let guard = (cardState.markers || []).find(m => m && m.data && m.data.type === 'GUARD');
    expect(guard.data.remainingOwnerTurns).toBe(5);

    CardLogic.onTurnStart(cardState, 'black', gameState);
    guard = (cardState.markers || []).find(m => m && m.data && m.data.type === 'GUARD');
    expect(guard.data.remainingOwnerTurns).toBe(4);

    CardLogic.onTurnStart(cardState, 'black', gameState);
    guard = (cardState.markers || []).find(m => m && m.data && m.data.type === 'GUARD');
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
});
