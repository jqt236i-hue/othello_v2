import * as Shared from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';
import * as BoardOps from '../game/logic/board_ops.js';
import * as SpecialStoneRegistry from '../shared/special-stone-registry';
import * as EvasionStatus from '../shared/evasion-status';
import * as StoneStatusSnapshot from '../shared/stone-status-snapshot';
import * as ZombieWill from '../game/logic/cards/zombie_will';

function createPrng(randomValue = 0) {
  return {
    shuffle: (arr) => arr,
    random: () => randomValue
  };
}

function createState(randomValue = 0, board, cardStateOverrides = {}) {
  const prng = createPrng(randomValue);
  const cardState = Object.assign({
    markers: [],
    _nextMarkerId: 1,
    _nextCreatedSeq: 1,
    presentationEvents: []
  }, cardStateOverrides);
  const defaultBoard = board || [
    [0, 0, 0, 0],
    [0, 1, -1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  const gameState = { board: defaultBoard };
  return { cardState, gameState, prng };
}

describe('ZOMBIE special stone registry', () => {
  test('ZOMBIE_WILL maps to a true special stone body', () => {
    expect(SpecialStoneRegistry.getMarkerTypeForSpecialStoneCard('ZOMBIE_WILL')).toBe('ZOMBIE');
    expect(SpecialStoneRegistry.getSpecialStoneDisplayName('ZOMBIE')).toBe('屍石');
    expect(SpecialStoneRegistry.countsAsSpecialStone('ZOMBIE')).toBe(true);
    expect(SpecialStoneRegistry.canLossWillRevert('ZOMBIE')).toBe(true);
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('ZOMBIE')).toBe('true_special_stone');
  });

  test('ZOMBIE uses revival instead of flip or destroy evasion', () => {
    expect(EvasionStatus.getEvasionProfile('ZOMBIE')).toBeNull();
  });
});

describe('ZOMBIE status display and revival', () => {
  test('shows turns until infection as the countdown timer', () => {
    const snapshot = StoneStatusSnapshot.createSpecialStoneStatusSnapshot({
      type: 'ZOMBIE',
      turnsUntilInfection: 3,
      regenRemaining: 1
    }, { mode: 'raw' });

    expect(snapshot.displayTimer).toBe(3);
    expect(snapshot.timerClass).toBe('countdown-timer');
  });

  test('revives once after a flip and keeps the zombie infection marker', () => {
    const board = Array(8).fill(null).map(() => Array(8).fill(0));
    board[3][3] = Shared.WHITE;
    const cardState = {
      markers: [{
        id: 1,
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        data: { type: 'ZOMBIE', ownerColor: Shared.BLACK, turnsUntilInfection: 2, regenRemaining: 1 }
      }],
      presentationEvents: []
    };

    const result = CardLogic.applyRegenAfterFlips(cardState, { board }, [{ row: 3, col: 3 }], 'white', false);

    expect(result.regened).toEqual([{ row: 3, col: 3 }]);
    expect(board[3][3]).toBe(Shared.BLACK);
    expect(cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: 3,
        col: 3,
        owner: 'black',
        data: expect.objectContaining({
          type: 'ZOMBIE',
          turnsUntilInfection: 2,
          regenRemaining: 0
        })
      })
    ]));
    const revivedZombie = cardState.markers.find((marker) => marker && marker.data && marker.data.type === 'ZOMBIE');
    expect(revivedZombie.data).not.toHaveProperty('remainingOwnerTurns');
  });

  test('does not revive after the flip revival has been consumed', () => {
    const board = Array(8).fill(null).map(() => Array(8).fill(0));
    board[3][3] = Shared.WHITE;
    const cardState = {
      markers: [{
        id: 1,
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        data: { type: 'ZOMBIE', ownerColor: Shared.BLACK, turnsUntilInfection: 2, regenRemaining: 1 }
      }],
      presentationEvents: []
    };

    const first = CardLogic.applyRegenAfterFlips(cardState, { board }, [{ row: 3, col: 3 }], 'white', false);
    board[3][3] = Shared.WHITE;
    const second = CardLogic.applyRegenAfterFlips(cardState, { board }, [{ row: 3, col: 3 }], 'white', false);

    expect(first.regened).toEqual([{ row: 3, col: 3 }]);
    expect(second.regened).toEqual([]);
    expect(board[3][3]).toBe(Shared.WHITE);
    expect(cardState.markers.some((marker) => marker && marker.data && marker.data.type === 'ZOMBIE')).toBe(false);
  });

  test('duplicate zombie markers at one cell still allow only one revival', () => {
    const board = Array(8).fill(null).map(() => Array(8).fill(0));
    board[3][3] = Shared.WHITE;
    const cardState = {
      markers: [1, 2].map((id) => ({
        id,
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        data: { type: 'ZOMBIE', ownerColor: Shared.BLACK, turnsUntilInfection: 2, regenRemaining: 1 }
      })),
      presentationEvents: []
    };

    const first = CardLogic.applyRegenAfterFlips(cardState, { board }, [{ row: 3, col: 3 }], 'white', false);
    board[3][3] = Shared.WHITE;
    const second = CardLogic.applyRegenAfterFlips(cardState, { board }, [{ row: 3, col: 3 }], 'white', false);

    expect(first.regened).toEqual([{ row: 3, col: 3 }]);
    expect(second.regened).toEqual([]);
    expect(board[3][3]).toBe(Shared.WHITE);
    expect(cardState.markers).toHaveLength(0);
  });

  test('revives once after destruction and keeps the zombie infection marker', () => {
    const board = Array(8).fill(null).map(() => Array(8).fill(0));
    board[3][3] = Shared.BLACK;
    const cardState = CardLogic.createCardState(createPrng());
    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'ZOMBIE', ownerColor: Shared.BLACK, turnsUntilInfection: 2, regenRemaining: 1 }
    });

    const result = BoardOps.destroyAt(cardState, { board }, 3, 3, 'DESTROY_ONE_STONE', 'destroy_selected');

    expect(result).toMatchObject({ kind: 'regenerated', regenerated: true, remaining: 0 });
    expect(board[3][3]).toBe(Shared.BLACK);
    expect(cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: 3,
        col: 3,
        owner: 'black',
        data: expect.objectContaining({
          type: 'ZOMBIE',
          turnsUntilInfection: 2,
          regenRemaining: 0
        })
      })
    ]));
    const revivedZombie = cardState.markers.find((marker) => marker && marker.data && marker.data.type === 'ZOMBIE');
    expect(revivedZombie.data).not.toHaveProperty('remainingOwnerTurns');
  });

  test('does not revive after the destruction revival has been consumed', () => {
    const board = Array(8).fill(null).map(() => Array(8).fill(0));
    board[3][3] = Shared.BLACK;
    const cardState = CardLogic.createCardState(createPrng());
    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'ZOMBIE', ownerColor: Shared.BLACK, turnsUntilInfection: 2, regenRemaining: 1 }
    });

    const first = BoardOps.destroyAt(cardState, { board }, 3, 3, 'DESTROY_ONE_STONE', 'destroy_selected');
    const second = BoardOps.destroyAt(cardState, { board }, 3, 3, 'DESTROY_ONE_STONE', 'destroy_selected');

    expect(first).toMatchObject({ kind: 'regenerated', regenerated: true, remaining: 0 });
    expect(second).toMatchObject({ kind: 'destroyed', destroyed: true, regenerated: false });
    expect(board[3][3]).toBe(0);
    expect(cardState.markers.some((marker) => marker && marker.data && marker.data.type === 'ZOMBIE')).toBe(false);
  });
});

describe('ZOMBIE infection logic', () => {
  test('third owner turn start infects one adjacent enemy normal stone', () => {
    const { cardState, gameState, prng } = createState(0, null, {
      markers: [{
        id: 'zombie-1',
        kind: 'specialStone',
        row: 1,
        col: 1,
        owner: 'black',
        createdSeq: 1,
        data: { type: 'ZOMBIE', ownerColor: Shared.BLACK, turnsUntilInfection: 1, regenRemaining: 1 }
      }],
      _nextMarkerId: 2,
      _nextCreatedSeq: 2
    });

    const result = ZombieWill.processZombieEffectsAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      1,
      1,
      prng,
      { BoardOps }
    );

    expect(result.infected).toEqual([{ row: 1, col: 2 }]);
    expect(gameState.board[1][2]).toBe(Shared.BLACK);
    const infectedMarker = cardState.markers.find((m) => m.row === 1 && m.col === 2 && m.owner === 'black');
    expect(infectedMarker).toBeTruthy();
    expect(infectedMarker.data.type).toBe('ZOMBIE');
    expect(infectedMarker.data.turnsUntilInfection).toBe(3);
    expect(infectedMarker.data.regenRemaining).toBe(1);
    expect(cardState.markers[0].data.turnsUntilInfection).toBe(3);
  });

  test('passes the zombie source position to the infection change event', () => {
    const { cardState, gameState, prng } = createState(0, null, {
      markers: [{
        id: 'zombie-source',
        kind: 'specialStone',
        row: 1,
        col: 1,
        owner: 'black',
        createdSeq: 1,
        data: { type: 'ZOMBIE', ownerColor: Shared.BLACK, turnsUntilInfection: 1, regenRemaining: 1 }
      }]
    });
    const changeAt = jest.fn(BoardOps.changeAt);

    ZombieWill.processZombieEffectsAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      1,
      1,
      prng,
      { BoardOps: { changeAt } }
    );

    expect(changeAt).toHaveBeenCalledWith(
      cardState,
      gameState,
      1,
      2,
      'black',
      'ZOMBIE',
      'zombie_infection',
      { sourceRow: 1, sourceCol: 1 }
    );
  });

  test('emits the infection change event through the production CardLogic wrapper', () => {
    const { cardState, gameState, prng } = createState(0, null, {
      markers: [{
        id: 'zombie-production-source',
        kind: 'specialStone',
        row: 1,
        col: 1,
        owner: 'black',
        createdSeq: 1,
        data: { type: 'ZOMBIE', ownerColor: Shared.BLACK, turnsUntilInfection: 1, regenRemaining: 1 }
      }]
    });

    CardLogic.processZombieEffectsAtTurnStartAnchor(cardState, gameState, 'black', 1, 1, prng);

    expect(cardState.presentationEvents).toContainEqual(expect.objectContaining({
      type: 'CHANGE',
      row: 1,
      col: 2,
      cause: 'ZOMBIE',
      reason: 'zombie_infection',
      meta: expect.objectContaining({ sourceRow: 1, sourceCol: 1 })
    }));
  });

  test('non-triggering owner turn only decrements infection counter', () => {
    const { cardState, gameState, prng } = createState(0, null, {
      markers: [{
        id: 'zombie-2',
        kind: 'specialStone',
        row: 1,
        col: 1,
        owner: 'black',
        createdSeq: 1,
        data: { type: 'ZOMBIE', ownerColor: Shared.BLACK, turnsUntilInfection: 3, regenRemaining: 1 }
      }],
      _nextMarkerId: 2,
      _nextCreatedSeq: 2
    });

    const result = ZombieWill.processZombieEffectsAtTurnStartAnchor(cardState, gameState, 'black', 1, 1, prng);

    expect(result.infected).toEqual([]);
    expect(gameState.board[1][2]).toBe(Shared.WHITE);
    expect(cardState.markers[0].data.turnsUntilInfection).toBe(2);
  });

  test('infection ignores stones protected by GUARD status markers', () => {
    const { cardState, gameState, prng } = createState(0, null, {
      markers: [
        {
          id: 'zombie-3',
          kind: 'specialStone',
          row: 1,
          col: 1,
          owner: 'black',
          createdSeq: 1,
          data: { type: 'ZOMBIE', ownerColor: Shared.BLACK, turnsUntilInfection: 1, regenRemaining: 1 }
        },
        {
          id: 'guard-1',
          kind: 'specialStone',
          row: 1,
          col: 2,
          owner: 'white',
          createdSeq: 2,
          data: { type: 'GUARD', remainingOwnerTurns: 3 }
        }
      ],
      _nextMarkerId: 3,
      _nextCreatedSeq: 3
    });

    const result = ZombieWill.processZombieEffectsAtTurnStartAnchor(cardState, gameState, 'black', 1, 1, prng);

    expect(result.infected).toEqual([]);
    expect(gameState.board[1][2]).toBe(Shared.WHITE);
  });

  test('infection crosses from a base anchor into an adjacent expansion cell', () => {
    const board = Array.from({ length: 4 }, () => Array(4).fill(0));
    board[1][3] = Shared.BLACK;
    const { cardState, gameState, prng } = createState(0, board, {
      markers: [{
        id: 'zombie-base',
        kind: 'specialStone',
        row: 1,
        col: 3,
        owner: 'black',
        data: { type: 'ZOMBIE', ownerColor: Shared.BLACK, turnsUntilInfection: 1, regenRemaining: 1 }
      }]
    });
    gameState.boardExpansion = {
      cells: [{ side: 'right', row: 1, col: 4, owner: Shared.WHITE }]
    };

    const result = ZombieWill.processZombieEffectsAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      1,
      3,
      prng,
      { BoardOps }
    );

    expect(result.infected).toEqual([{ row: 1, col: 4 }]);
    expect(gameState.boardExpansion.cells[0].owner).toBe(Shared.BLACK);
    expect(cardState.markers).toContainEqual(expect.objectContaining({
      row: 1,
      col: 4,
      owner: 'black',
      data: expect.objectContaining({ type: 'ZOMBIE' })
    }));
  });

  test('infection crosses from an expansion anchor back into the base board', () => {
    const board = Array.from({ length: 4 }, () => Array(4).fill(0));
    board[1][3] = Shared.WHITE;
    const { cardState, gameState, prng } = createState(0, board, {
      markers: [{
        id: 'zombie-expansion',
        kind: 'specialStone',
        row: 1,
        col: 4,
        owner: 'black',
        data: { type: 'ZOMBIE', ownerColor: Shared.BLACK, turnsUntilInfection: 1, regenRemaining: 1 }
      }]
    });
    gameState.boardExpansion = {
      cells: [{ side: 'right', row: 1, col: 4, owner: Shared.BLACK }]
    };

    const result = ZombieWill.processZombieEffectsAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      1,
      4,
      prng,
      { BoardOps }
    );

    expect(result.infected).toEqual([{ row: 1, col: 3 }]);
    expect(gameState.board[1][3]).toBe(Shared.BLACK);
  });

  test('meteor holes are neither infection sources nor targets', () => {
    const { cardState, gameState, prng } = createState(0, null, {
      markers: [
        {
          id: 'zombie-hole-check',
          kind: 'specialStone',
          row: 1,
          col: 1,
          owner: 'black',
          data: { type: 'ZOMBIE', ownerColor: Shared.BLACK, turnsUntilInfection: 1, regenRemaining: 1 }
        },
        {
          id: 'target-hole',
          kind: 'specialStone',
          row: 1,
          col: 2,
          data: { type: 'METEOR_HOLE' }
        }
      ]
    });

    const result = ZombieWill.processZombieEffectsAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      1,
      1,
      prng,
      { BoardOps }
    );
    expect(result.infected).toEqual([]);
    expect(gameState.board[1][2]).toBe(Shared.WHITE);

    cardState.markers.push({
      id: 'source-hole',
      kind: 'specialStone',
      row: 1,
      col: 1,
      data: { type: 'METEOR_HOLE' }
    });
    expect(ZombieWill.processZombieEffectsAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      1,
      1,
      prng,
      { BoardOps }
    )).toEqual({ infected: [], anchors: [] });
  });

  test('triggering infection fails fast when BoardOps or CardMarkers is unavailable', () => {
    const first = createState(0, null, {
      markers: [{
        id: 'missing-board-ops',
        kind: 'specialStone',
        row: 1,
        col: 1,
        owner: 'black',
        data: { type: 'ZOMBIE', ownerColor: Shared.BLACK, turnsUntilInfection: 1, regenRemaining: 1 }
      }]
    });
    expect(() => ZombieWill.processZombieEffectsAtTurnStartAnchor(
      first.cardState,
      first.gameState,
      'black',
      1,
      1,
      first.prng
    )).toThrow('BoardOps.changeAt is required');
    expect(first.gameState.board[1][2]).toBe(Shared.WHITE);
    expect(first.cardState.markers[0].data.turnsUntilInfection).toBe(1);

    const second = createState(0, null, {
      markers: [{
        id: 'missing-card-markers',
        kind: 'specialStone',
        row: 1,
        col: 1,
        owner: 'black',
        data: { type: 'ZOMBIE', ownerColor: Shared.BLACK, turnsUntilInfection: 1, regenRemaining: 1 }
      }]
    });
    expect(() => ZombieWill.processZombieEffectsAtTurnStartAnchor(
      second.cardState,
      second.gameState,
      'black',
      1,
      1,
      second.prng,
      { BoardOps, CardMarkers: null }
    )).toThrow('CardMarkers.addMarker is required');
    expect(second.gameState.board[1][2]).toBe(Shared.WHITE);
  });

  test('createZombieMarkerData produces marker data with one revival', () => {
    const data = ZombieWill.createZombieMarkerData('white');
    expect(data.type).toBe('ZOMBIE');
    expect(data.ownerColor).toBe(Shared.WHITE);
    expect(data.turnsUntilInfection).toBe(ZombieWill.ZOMBIE_INFECTION_INTERVAL);
    expect(data.regenRemaining).toBe(1);
  });
});
