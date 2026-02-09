const SharedConstants = require('../shared-constants');
const CardLogic = require('../game/logic/cards');

describe('TRAP_WILL (罠の意志)', () => {
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

  test('can set trap on own stone and clear pending', () => {
    const trapDef = (SharedConstants.CARD_DEFS || []).find(d => d && d.type === 'TRAP_WILL');
    expect(trapDef).toBeTruthy();

    const { cardState, gameState } = makeState();
    gameState.board[2][2] = 1;
    cardState.hands.black = [trapDef.id];
    cardState.charge.black = trapDef.cost;

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', trapDef.id);
    expect(used).toBe(true);
    expect(cardState.pendingEffectByPlayer.black && cardState.pendingEffectByPlayer.black.type).toBe('TRAP_WILL');

    const applied = CardLogic.applyTrapWill(cardState, gameState, 'black', 2, 2);
    expect(applied && applied.applied).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();

    const trapMarker = (cardState.markers || []).find(m => m && m.row === 2 && m.col === 2 && m.data && m.data.type === 'TRAP');
    expect(trapMarker).toBeTruthy();
    expect(trapMarker.owner).toBe('black');
  });

  test('trigger: steals charge + up to 3 cards, overflow goes to owner deck', () => {
    const { cardState, gameState } = makeState();

    // Trap owned by black at C3 (2,2), currently flipped by white on white turn.
    gameState.board[2][2] = -1;
    cardState.markers.push({
      id: 11,
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: { type: 'TRAP', hidden: true }
    });
    cardState.charge.black = 5;
    cardState.charge.white = 12;
    cardState.hands.black = ['b1', 'b2', 'b3', 'b4'];
    cardState.hands.white = ['w1', 'w2', 'w3', 'w4'];
    cardState.deck = ['d0'];

    const res = CardLogic.processTrapEffects(cardState, gameState, 'white', { expireOnOwnerTurnStart: false });
    expect(res.triggered.length).toBe(1);
    expect(res.expired.length).toBe(0);
    expect(res.disarmed.length).toBe(0);

    expect(cardState.charge.white).toBe(0);
    expect(cardState.charge.black).toBe(17);
    expect(cardState.hands.black).toEqual(['b1', 'b2', 'b3', 'b4', 'w1']);
    expect(cardState.hands.white).toEqual(['w4']);
    expect(cardState.deck).toEqual(['d0', 'w2', 'w3']);

    const remainingTrap = (cardState.markers || []).find(m => m && m.data && m.data.type === 'TRAP');
    expect(remainingTrap).toBeUndefined();
  });

  test('expires on owner turn start if not triggered', () => {
    const { cardState, gameState } = makeState();
    gameState.board[3][3] = 1;
    cardState.markers.push({
      id: 12,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'TRAP', hidden: true }
    });

    const res = CardLogic.processTrapEffects(cardState, gameState, 'black', { expireOnOwnerTurnStart: true });
    expect(res.triggered.length).toBe(0);
    expect(res.expired.length).toBe(1);
    expect(gameState.board[3][3]).toBe(0);

    const remainingTrap = (cardState.markers || []).find(m => m && m.data && m.data.type === 'TRAP');
    expect(remainingTrap).toBeUndefined();
  });
});
