const SharedConstants = require('../shared-constants');
const CardLogic = require('../game/logic/cards');
const CardWork = require('../game/logic/cards/work_will');

function createStates() {
  const prng = { shuffle: (arr) => arr, random: () => 0.5 };
  const cardState = CardLogic.createCardState(prng);
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(0)),
    currentPlayer: SharedConstants.BLACK,
    turnNumber: 0,
    consecutivePasses: 0
  };
  return { cardState, gameState };
}

describe('EXTEND_LIFE_WILL × WORK_WILL', () => {
  test('getUsableCardIds は対象がない EXTEND_LIFE_WILL を使用可能扱いしない', () => {
    const def = (SharedConstants.CARD_DEFS || []).find((d) => d && d.type === 'EXTEND_LIFE_WILL');
    expect(def).toBeTruthy();

    const { cardState, gameState } = createStates();
    cardState.hands.black = [def.id];
    cardState.charge.black = def.cost;

    const usable = CardLogic.getUsableCardIds(cardState, gameState, 'black');
    expect(usable).toEqual([]);
  });

  test('getSelectableTargets returns own timed special stones while EXTEND_LIFE_WILL is pending', () => {
    const { cardState, gameState } = createStates();

    gameState.board[2][2] = SharedConstants.BLACK;
    gameState.board[3][3] = SharedConstants.BLACK;

    cardState.markers.push({
      id: 9101,
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: { type: 'WORK', ownerColor: 'black', workStage: 3, remainingOwnerTurns: 2 }
    });
    cardState.markers.push({
      id: 9102,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'WORK', ownerColor: 'black', workStage: 3, remainingOwnerTurns: 0 }
    });

    cardState.pendingEffectByPlayer.black = { type: 'EXTEND_LIFE_WILL', stage: 'selectTarget' };

    const targets = CardLogic.getSelectableTargets(cardState, gameState, 'black');
    expect(targets).toEqual([{ row: 2, col: 2 }]);
  });

  test('applyExtendLifeWill doubles remainingOwnerTurns on own WORK stone', () => {
    const def = (SharedConstants.CARD_DEFS || []).find((d) => d && d.type === 'EXTEND_LIFE_WILL');
    expect(def).toBeTruthy();

    const { cardState, gameState } = createStates();
    gameState.board[2][2] = SharedConstants.BLACK;
    cardState.hands.black = [def.id];
    cardState.charge.black = def.cost;
    cardState.markers.push({
      id: 9001,
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: { type: 'WORK', ownerColor: 'black', workStage: 4, remainingOwnerTurns: 1 }
    });

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
    expect(used).toBe(true);

    const res = CardLogic.applyExtendLifeWill(cardState, gameState, 'black', 2, 2);
    expect(res && res.applied).toBe(true);
    expect(res.previousRemainingOwnerTurns).toBe(1);
    expect(res.newRemainingOwnerTurns).toBe(2);

    const work = (cardState.markers || []).find((m) => m && m.row === 2 && m.col === 2 && m.data && m.data.type === 'WORK');
    expect(work).toBeTruthy();
    expect(work.data.remainingOwnerTurns).toBe(2);
  });

  test('applyExtendLifeWill doubles both special stone and GUARD remainingOwnerTurns on same cell', () => {
    const def = (SharedConstants.CARD_DEFS || []).find((d) => d && d.type === 'EXTEND_LIFE_WILL');
    expect(def).toBeTruthy();

    const { cardState, gameState } = createStates();
    gameState.board[2][2] = SharedConstants.BLACK;
    cardState.hands.black = [def.id];
    cardState.charge.black = def.cost;
    cardState.markers.push(
      {
        id: 9004,
        kind: 'specialStone',
        row: 2,
        col: 2,
        owner: 'black',
        data: { type: 'WORK', ownerColor: 'black', workStage: 4, remainingOwnerTurns: 2 }
      },
      {
        id: 9005,
        kind: 'specialStone',
        row: 2,
        col: 2,
        owner: 'black',
        data: { type: 'GUARD', remainingOwnerTurns: 3 }
      }
    );

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
    expect(used).toBe(true);

    const res = CardLogic.applyExtendLifeWill(cardState, gameState, 'black', 2, 2);
    expect(res && res.applied).toBe(true);
    expect(res.previousRemainingOwnerTurns).toBe(2);
    expect(res.newRemainingOwnerTurns).toBe(4);

    const work = (cardState.markers || []).find((m) => m && m.row === 2 && m.col === 2 && m.data && m.data.type === 'WORK');
    const guard = (cardState.markers || []).find((m) => m && m.row === 2 && m.col === 2 && m.data && m.data.type === 'GUARD');
    expect(work).toBeTruthy();
    expect(guard).toBeTruthy();
    expect(work.data.remainingOwnerTurns).toBe(4);
    expect(guard.data.remainingOwnerTurns).toBe(6);
  });

  test('EXTEND_LIFE_WILL で持続5超になった WORK stone は 1→2→4→8→16 を繰り返す', () => {
    const def = (SharedConstants.CARD_DEFS || []).find((d) => d && d.type === 'EXTEND_LIFE_WILL');
    expect(def).toBeTruthy();

    const { cardState, gameState } = createStates();
    gameState.board[3][3] = SharedConstants.BLACK;
    cardState.hands.black = [def.id];
    cardState.charge.black = def.cost;
    cardState.workAnchorPosByPlayer.black = { row: 3, col: 3 };
    cardState.markers.push({
      id: 9002,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'WORK', ownerColor: 'black', workStage: 0, remainingOwnerTurns: 5 }
    });

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
    expect(used).toBe(true);

    const extended = CardLogic.applyExtendLifeWill(cardState, gameState, 'black', 3, 3);
    expect(extended && extended.applied).toBe(true);
    expect(extended.previousRemainingOwnerTurns).toBe(5);
    expect(extended.newRemainingOwnerTurns).toBe(10);

    const gains = [];
    for (let i = 0; i < 10; i += 1) {
      const one = CardWork.processWorkEffects(cardState, gameState, 'black');
      gains.push(one.gained);
      expect(one.removed).toBe(i === 9);
    }
    expect(gains).toEqual([1, 2, 4, 8, 16, 1, 2, 4, 8, 16]);

    const work = (cardState.markers || []).find((m) => m && m.row === 3 && m.col === 3 && m.data && m.data.type === 'WORK');
    expect(work).toBeUndefined();
  });

  test('WORK stone self-destructs when remainingOwnerTurns reaches 0', () => {
    const { cardState, gameState } = createStates();
    gameState.board[4][4] = SharedConstants.BLACK;
    cardState.workAnchorPosByPlayer.black = { row: 4, col: 4 };
    cardState.markers.push({
      id: 9003,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'WORK', ownerColor: 'black', workStage: 4, remainingOwnerTurns: 1 }
    });

    const res = CardWork.processWorkEffects(cardState, gameState, 'black');
    expect(res.gained).toBe(16);
    expect(res.removed).toBe(true);

    const work = (cardState.markers || []).find((m) => m && m.row === 4 && m.col === 4 && m.data && m.data.type === 'WORK');
    expect(work).toBeUndefined();
    expect(gameState.board[4][4]).toBe(SharedConstants.EMPTY);
  });
});
