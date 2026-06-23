import * as SharedConstants from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';
import * as CardWork from '../game/logic/cards/work_will.js';

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
    gameState.board[4][4] = SharedConstants.BLACK;

    cardState.markers.push({
      id: 9101,
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: { type: 'WORK', ownerColor: 'black', workStage: 3, remainingOwnerTurns: 2 }
    });
    cardState.markers.push({
      id: 9103,
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: { type: 'GUARD', remainingOwnerTurns: 3 }
    });
    cardState.markers.push({
      id: 9102,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'WORK', ownerColor: 'black', workStage: 3, remainingOwnerTurns: 0 }
    });
    cardState.markers.push({
      id: 9104,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'BLOCKADE', remainingOwnerTurns: 3 }
    });

    cardState.pendingEffectByPlayer.black = { type: 'EXTEND_LIFE_WILL', stage: 'selectTarget' };

    const targets = CardLogic.getSelectableTargets(cardState, gameState, 'black');
    expect(targets).toEqual([{ row: 2, col: 2 }]);
  });

  test('getSelectableTargets returns own timed special stones while EXTEND_LIFE_GOD is pending', () => {
    const { cardState, gameState } = createStates();

    gameState.board[2][2] = SharedConstants.BLACK;
    gameState.board[3][3] = SharedConstants.BLACK;

    cardState.markers.push({
      id: 9201,
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: { type: 'WORK', ownerColor: 'black', workStage: 3, remainingOwnerTurns: 2 }
    });
    cardState.markers.push({
      id: 9202,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'WORK', ownerColor: 'black', workStage: 3, remainingOwnerTurns: 0 }
    });

    cardState.pendingEffectByPlayer.black = { type: 'EXTEND_LIFE_GOD', stage: 'selectTarget' };

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

  test('applyExtendLifeGod quadruples remainingOwnerTurns on own WORK stone', () => {
    const def = (SharedConstants.CARD_DEFS || []).find((d) => d && d.type === 'EXTEND_LIFE_GOD');
    expect(def).toBeTruthy();

    const { cardState, gameState } = createStates();
    gameState.board[2][2] = SharedConstants.BLACK;
    cardState.hands.black = [def.id];
    cardState.charge.black = def.cost;
    cardState.markers.push({
      id: 9011,
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: { type: 'WORK', ownerColor: 'black', workStage: 4, remainingOwnerTurns: 2 }
    });

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
    expect(used).toBe(true);

    const res = CardLogic.applyExtendLifeGod(cardState, gameState, 'black', 2, 2);
    expect(res && res.applied).toBe(true);
    expect(res.previousRemainingOwnerTurns).toBe(2);
    expect(res.newRemainingOwnerTurns).toBe(8);
    expect(res.multiplier).toBe(4);

    const work = (cardState.markers || []).find((m) => m && m.row === 2 && m.col === 2 && m.data && m.data.type === 'WORK');
    expect(work).toBeTruthy();
    expect(work.data.remainingOwnerTurns).toBe(8);
  });

  test('EXTEND_LIFE_GOD で持続5超になった WORK stone は 1→2→4→8→16 を繰り返す', () => {
    const def = (SharedConstants.CARD_DEFS || []).find((d) => d && d.type === 'EXTEND_LIFE_GOD');
    expect(def).toBeTruthy();

    const { cardState, gameState } = createStates();
    gameState.board[3][3] = SharedConstants.BLACK;
    cardState.hands.black = [def.id];
    cardState.charge.black = def.cost;
    cardState.workAnchorPosByPlayer.black = { row: 3, col: 3 };
    cardState.markers.push({
      id: 9012,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'WORK', ownerColor: 'black', workStage: 0, remainingOwnerTurns: 5 }
    });

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
    expect(used).toBe(true);

    const extended = CardLogic.applyExtendLifeGod(cardState, gameState, 'black', 3, 3);
    expect(extended && extended.applied).toBe(true);
    expect(extended.previousRemainingOwnerTurns).toBe(5);
    expect(extended.newRemainingOwnerTurns).toBe(20);

    const gains = [];
    const uncappedChargeGain = (_cardState, _playerKey, amount) => amount;
    for (let i = 0; i < 20; i += 1) {
      const one = CardWork.processWorkEffects(cardState, gameState, 'black', { addChargeWithTotal: uncappedChargeGain });
      gains.push(one.gained);
      expect(one.removed).toBe(i === 19);
    }
    expect(gains).toEqual([1, 2, 4, 8, 16, 1, 2, 4, 8, 16, 1, 2, 4, 8, 16, 1, 2, 4, 8, 16]);
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

  test('WORK stone reverts to a normal stone when remainingOwnerTurns reaches 0', () => {
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
    expect(gameState.board[4][4]).toBe(SharedConstants.BLACK);
  });

  test('WORK stone does not grant charge after anchor is lost before owner turn start', () => {
    const { cardState, gameState } = createStates();
    gameState.board[4][4] = SharedConstants.WHITE;
    cardState.workAnchorPosByPlayer.black = { row: 4, col: 4 };
    cardState.markers.push({
      id: 9006,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'WORK', ownerColor: 'black', workStage: 2, remainingOwnerTurns: 3 }
    });

    const res = CardWork.processWorkEffects(cardState, gameState, 'black');
    expect(res).toMatchObject({
      gained: 0,
      removed: true,
      row: 4,
      col: 4,
      removedReason: 'anchor_lost'
    });
    expect(cardState.charge.black).toBe(0);
    expect(cardState.workAnchorPosByPlayer.black).toBeNull();
    expect((cardState.markers || []).find((m) => m && m.row === 4 && m.col === 4 && m.data && m.data.type === 'WORK')).toBeUndefined();
    expect(gameState.board[4][4]).toBe(SharedConstants.WHITE);
  });

  test('placeWorkStone keeps earlier WORK stones and processWorkEffects resolves each active marker', () => {
    const { cardState, gameState } = createStates();
    gameState.board[1][1] = SharedConstants.BLACK;
    gameState.board[2][2] = SharedConstants.BLACK;

    const first = CardWork.placeWorkStone(cardState, gameState, 'black', 1, 1);
    const second = CardWork.placeWorkStone(cardState, gameState, 'black', 2, 2);

    expect(first).toEqual({ placed: true });
    expect(second).toEqual({ placed: true });
    expect(cardState.markers).toHaveLength(2);
    expect(cardState.markers).toEqual([
      expect.objectContaining({
        id: 1,
        createdSeq: 1,
        row: 1,
        col: 1,
        kind: 'specialStone',
        owner: 'black',
        data: expect.objectContaining({ type: 'WORK' })
      }),
      expect.objectContaining({
        id: 2,
        createdSeq: 2,
        row: 2,
        col: 2,
        kind: 'specialStone',
        owner: 'black',
        data: expect.objectContaining({ type: 'WORK' })
      })
    ]);
    expect(cardState.workAnchorPosByPlayer.black).toEqual({ row: 2, col: 2 });

    const res = CardWork.processWorkEffects(cardState, gameState, 'black');
    expect(res).toMatchObject({
      gained: 2,
      removed: false,
      entries: [
        expect.objectContaining({ row: 1, col: 1, gained: 1, removed: false, incomeStep: 1 }),
        expect.objectContaining({ row: 2, col: 2, gained: 1, removed: false, incomeStep: 1 })
      ]
    });
    expect(cardState.charge.black).toBe(2);
    expect(cardState.markers.map((marker) => marker.data.workStage)).toEqual([1, 1]);
    expect(cardState.markers.map((marker) => marker.data.remainingOwnerTurns)).toEqual([4, 4]);
  });
});
