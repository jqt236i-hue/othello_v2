import * as SharedConstants from '../shared-constants.js';
import * as CardWork from '../game/logic/cards/work_will.js';

function createStates() {
  const cardState = {
    markers: [],
    workAnchorPosByPlayer: { black: null, white: null },
    charge: { black: 0, white: 0 }
  };
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(SharedConstants.EMPTY)),
    boardExpansion: {
      active: true,
      side: 'right',
      row: 7,
      owner: SharedConstants.BLACK,
      cells: [{ side: 'right', row: 7, col: 8, owner: SharedConstants.BLACK }]
    }
  };
  return { cardState, gameState };
}

describe('WORK_WILL on expansion cells', () => {
  test('processWorkEffects gains charge from a right expansion anchor cell', () => {
    const { cardState, gameState } = createStates();
    cardState.workAnchorPosByPlayer.black = { row: 7, col: 8 };
    cardState.markers.push({
      id: 5001,
      kind: 'specialStone',
      row: 7,
      col: 8,
      owner: 'black',
      data: { type: 'WORK', ownerColor: 'black', workStage: 0, remainingOwnerTurns: 2 }
    });

    const res = CardWork.processWorkEffects(cardState, gameState, 'black');
    expect(res.gained).toBe(1);
    expect(res.removed).toBe(false);
    expect(cardState.charge.black).toBe(1);

    const work = cardState.markers.find((m) => m && m.row === 7 && m.col === 8 && m.data && m.data.type === 'WORK');
    expect(work).toBeTruthy();
    expect(work.data.workStage).toBe(1);
    expect(work.data.remainingOwnerTurns).toBe(1);
  });

  test('processWorkEffects uses injected charge helper and returns actual gained amount', () => {
    const { cardState, gameState } = createStates();
    const addChargeWithTotal = jest.fn(() => 2);
    cardState.workAnchorPosByPlayer.black = { row: 7, col: 8 };
    cardState.markers.push({
      id: 5004,
      kind: 'specialStone',
      row: 7,
      col: 8,
      owner: 'black',
      data: { type: 'WORK', ownerColor: 'black', workStage: 0, remainingOwnerTurns: 2 }
    });

    const res = CardWork.processWorkEffects(cardState, gameState, 'black', { addChargeWithTotal });

    expect(addChargeWithTotal).toHaveBeenCalledWith(cardState, 'black', 1, expect.objectContaining({
      sourceType: 'work_gain'
    }));
    expect(res.gained).toBe(2);
  });

  test('processWorkEffects clears an expansion anchor cell when duration ends', () => {
    const { cardState, gameState } = createStates();
    cardState.workAnchorPosByPlayer.black = { row: 7, col: 8 };
    cardState.markers.push({
      id: 5002,
      kind: 'specialStone',
      row: 7,
      col: 8,
      owner: 'black',
      data: { type: 'WORK', ownerColor: 'black', workStage: 4, remainingOwnerTurns: 1 }
    });

    const res = CardWork.processWorkEffects(cardState, gameState, 'black');
    expect(res.gained).toBe(16);
    expect(res.removed).toBe(true);
    expect(cardState.workAnchorPosByPlayer.black).toBeNull();
    expect(cardState.markers.find((m) => m && m.row === 7 && m.col === 8 && m.data && m.data.type === 'WORK')).toBeUndefined();
    expect(gameState.boardExpansion.cells[0].owner).toBe(SharedConstants.EMPTY);
  });

  test('processWorkEffects clears a bottom expansion anchor cell when duration ends', () => {
    const cardState = {
      markers: [],
      workAnchorPosByPlayer: { black: { row: 8, col: 3 }, white: null },
      charge: { black: 0, white: 0 }
    };
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(SharedConstants.EMPTY)),
      boardExpansion: {
        active: true,
        side: 'bottom',
        row: 8,
        owner: SharedConstants.BLACK,
        cells: [{ side: 'bottom', row: 8, col: 3, owner: SharedConstants.BLACK }]
      }
    };

    cardState.markers.push({
      id: 5003,
      kind: 'specialStone',
      row: 8,
      col: 3,
      owner: 'black',
      data: { type: 'WORK', ownerColor: 'black', workStage: 4, remainingOwnerTurns: 1 }
    });

    const res = CardWork.processWorkEffects(cardState, gameState, 'black');
    expect(res.gained).toBe(16);
    expect(res.removed).toBe(true);
    expect(cardState.workAnchorPosByPlayer.black).toBeNull();
    expect(cardState.markers.find((m) => m && m.row === 8 && m.col === 3 && m.data && m.data.type === 'WORK')).toBeUndefined();
    expect(gameState.boardExpansion.cells[0].owner).toBe(SharedConstants.EMPTY);
  });

  test('processWorkEffects treats an expansion meteor hole as a lost anchor', () => {
    const { cardState, gameState } = createStates();
    cardState.workAnchorPosByPlayer.black = { row: 7, col: 8 };
    cardState.markers.push(
      {
        id: 5005,
        kind: 'specialStone',
        row: 7,
        col: 8,
        owner: 'black',
        data: { type: 'WORK', ownerColor: 'black', workStage: 0, remainingOwnerTurns: 2 }
      },
      {
        id: 5006,
        kind: 'specialStone',
        row: 7,
        col: 8,
        owner: 'black',
        data: { type: 'METEOR_HOLE' }
      }
    );

    const res = CardWork.processWorkEffects(cardState, gameState, 'black');

    expect(res).toMatchObject({
      gained: 0,
      removed: true,
      row: 7,
      col: 8,
      removedReason: 'anchor_lost'
    });
    expect(cardState.charge.black).toBe(0);
    expect(cardState.markers).toEqual([
      expect.objectContaining({ data: expect.objectContaining({ type: 'METEOR_HOLE' }) })
    ]);
  });
});
