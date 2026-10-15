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

function createCountingPrng(values: number[]) {
  const prng = {
    calls: 0,
    random: () => {
      const value = values[Math.min(prng.calls, values.length - 1)];
      prng.calls += 1;
      return value;
    }
  };
  return prng;
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

function zombieMarker(id: string, row: number, col: number, owner = 'black') {
  return {
    id,
    kind: 'specialStone',
    row,
    col,
    owner,
    createdSeq: 1,
    data: { type: 'ZOMBIE', ownerColor: owner === 'black' ? Shared.BLACK : Shared.WHITE, regenRemaining: 1 }
  };
}

function emptyBoard(size: number) {
  return Array.from({ length: size }, () => Array(size).fill(Shared.EMPTY));
}

describe('ZOMBIE special stone registry', () => {
  test('ZOMBIE_WILL maps to a true special stone body', () => {
    expect(SpecialStoneRegistry.getMarkerTypeForSpecialStoneCard('ZOMBIE_WILL')).toBe('ZOMBIE');
    expect(SpecialStoneRegistry.getSpecialStoneDisplayName('ZOMBIE')).toBe('屍石');
    expect(SpecialStoneRegistry.getSpecialStoneDescription('ZOMBIE')).toContain('一番近い敵通常石へ1マス寄り');
    expect(SpecialStoneRegistry.getSpecialStoneDescription('ZOMBIE')).toContain('20%の確率で噛んで');
    expect(SpecialStoneRegistry.countsAsSpecialStone('ZOMBIE')).toBe(true);
    expect(SpecialStoneRegistry.canLossWillRevert('ZOMBIE')).toBe(true);
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('ZOMBIE')).toBe('true_special_stone');
  });

  test('ZOMBIE uses revival instead of flip or destroy evasion', () => {
    expect(EvasionStatus.getEvasionProfile('ZOMBIE')).toBeNull();
  });
});

describe('ZOMBIE placement', () => {
  test('places a permanent zombie with one revival and no bite countdown', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
      currentPlayer: Shared.BLACK,
      turnNumber: 1,
      consecutivePasses: 0
    };
    gameState.board[3][3] = Shared.BLACK;
    cardState.pendingEffectByPlayer.black = {
      type: 'ZOMBIE_WILL',
      stage: null,
      cardId: 'zombie_will_01'
    };

    const effects = CardLogic.applyPlacementEffects(cardState, gameState, 'black', 3, 3, 0);
    const marker = cardState.markers.find((entry) => (
      entry &&
      entry.kind === 'specialStone' &&
      entry.row === 3 &&
      entry.col === 3 &&
      entry.owner === 'black' &&
      entry.data &&
      entry.data.type === 'ZOMBIE'
    ));

    expect(effects).toMatchObject({ zombiePlaced: true });
    expect(marker && marker.data).toMatchObject(ZombieWill.createZombieMarkerData('black'));
    expect(marker.data).not.toHaveProperty('turnsUntilInfection');
    expect(marker.data).not.toHaveProperty('remainingOwnerTurns');
  });
});

describe('ZOMBIE status display and revival', () => {
  test('shows no stone timer and lists the remaining revival in stone info', () => {
    const snapshot = StoneStatusSnapshot.createSpecialStoneStatusSnapshot({
      type: 'ZOMBIE',
      regenRemaining: 1
    }, { mode: 'raw' });
    const marker = zombieMarker('zombie-info', 0, 0);
    const tags = StoneStatusSnapshot.buildSpecialStoneStatusTags([{
      kind: marker.kind,
      marker,
      type: 'ZOMBIE',
      timer: undefined,
      regenRemaining: 1
    }], {});

    expect(snapshot.displayTimer).toBeNull();
    expect(snapshot.timerClass).not.toBe('countdown-timer');
    expect(tags).toEqual(['特殊石', '復活 残り1回']);
  });

  test('stone info omits the revival tag once the revival is spent', () => {
    const marker = zombieMarker('zombie-info-spent', 0, 0);
    const tags = StoneStatusSnapshot.buildSpecialStoneStatusTags([{
      kind: marker.kind,
      marker,
      type: 'ZOMBIE',
      regenRemaining: 0
    }], {});

    expect(tags).toEqual(['特殊石']);
  });

  test('revives once after a flip and keeps the zombie marker', () => {
    const board = Array(8).fill(null).map(() => Array(8).fill(0));
    board[3][3] = Shared.WHITE;
    const cardState = {
      markers: [zombieMarker('zombie-flip', 3, 3)],
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
      markers: [zombieMarker('zombie-flip-twice', 3, 3)],
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
      markers: [1, 2].map((id) => zombieMarker(`zombie-dup-${id}`, 3, 3)),
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

  test('revives once after destruction and keeps the zombie marker', () => {
    const board = Array(8).fill(null).map(() => Array(8).fill(0));
    board[3][3] = Shared.BLACK;
    const cardState = CardLogic.createCardState(createPrng());
    cardState.markers.push(zombieMarker('zombie-destroy', 3, 3));

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
    cardState.markers.push(zombieMarker('zombie-destroy-twice', 3, 3));

    const first = BoardOps.destroyAt(cardState, { board }, 3, 3, 'DESTROY_ONE_STONE', 'destroy_selected');
    const second = BoardOps.destroyAt(cardState, { board }, 3, 3, 'DESTROY_ONE_STONE', 'destroy_selected');

    expect(first).toMatchObject({ kind: 'regenerated', regenerated: true, remaining: 0 });
    expect(second).toMatchObject({ kind: 'destroyed', destroyed: true, regenerated: false });
    expect(board[3][3]).toBe(0);
    expect(cardState.markers.some((marker) => marker && marker.data && marker.data.type === 'ZOMBIE')).toBe(false);
  });
});

describe('ZOMBIE bite roll', () => {
  test('bites one adjacent enemy normal stone when the 20% roll succeeds', () => {
    const { cardState, gameState, prng } = createState(0, null, {
      markers: [zombieMarker('zombie-1', 1, 1)],
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
    const bittenMarker = cardState.markers.find((m) => m.row === 1 && m.col === 2 && m.owner === 'black');
    expect(bittenMarker).toBeTruthy();
    expect(bittenMarker.data).toEqual(ZombieWill.createZombieMarkerData('black'));
  });

  test('a roll at or above 20% misses and leaves the board unchanged', () => {
    const { cardState, gameState } = createState(0, null, {
      markers: [zombieMarker('zombie-miss', 1, 1)]
    });
    const prng = createCountingPrng([ZombieWill.ZOMBIE_INFECTION_CHANCE]);

    const result = ZombieWill.processZombieEffectsAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      1,
      1,
      prng,
      { BoardOps }
    );

    expect(result).toEqual({ infected: [] });
    expect(gameState.board[1][2]).toBe(Shared.WHITE);
    expect(cardState.markers).toHaveLength(1);
    expect(prng.calls).toBe(1);
  });

  test('the roll just below 20% still bites', () => {
    const { cardState, gameState } = createState(0, null, {
      markers: [zombieMarker('zombie-edge', 1, 1)]
    });
    const prng = createCountingPrng([0.1999, 0]);

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
    expect(prng.calls).toBe(2);
  });

  test('does not roll when no prey is adjacent', () => {
    const board = Array.from({ length: 4 }, () => Array(4).fill(0));
    board[1][1] = Shared.BLACK;
    const { cardState, gameState } = createState(0, board, {
      markers: [zombieMarker('zombie-no-target', 1, 1)]
    });
    const prng = createCountingPrng([0]);

    const result = ZombieWill.processZombieEffectsAtTurnStartAnchor(cardState, gameState, 'black', 1, 1, prng);

    expect(result).toEqual({ infected: [] });
    expect(prng.calls).toBe(0);
  });

  test('passes the zombie source position to the bite change event', () => {
    const { cardState, gameState, prng } = createState(0, null, {
      markers: [zombieMarker('zombie-source', 1, 1)]
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

  test('bites ignore stones protected by GUARD status markers', () => {
    const { cardState, gameState, prng } = createState(0, null, {
      markers: [
        zombieMarker('zombie-3', 1, 1),
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

  test('bites cross from a base anchor into an adjacent expansion cell', () => {
    const board = Array.from({ length: 4 }, () => Array(4).fill(0));
    board[1][3] = Shared.BLACK;
    const { cardState, gameState, prng } = createState(0, board, {
      markers: [zombieMarker('zombie-base', 1, 3)]
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

  test('bites cross from an expansion anchor back into the base board', () => {
    const board = Array.from({ length: 4 }, () => Array(4).fill(0));
    board[1][3] = Shared.WHITE;
    const { cardState, gameState, prng } = createState(0, board, {
      markers: [zombieMarker('zombie-expansion', 1, 4)]
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

  test('meteor holes are neither bite sources nor targets', () => {
    const { cardState, gameState, prng } = createState(0, null, {
      markers: [
        zombieMarker('zombie-hole-check', 1, 1),
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
    )).toEqual({ infected: [] });
  });

  test('a successful bite fails fast when BoardOps or CardMarkers is unavailable', () => {
    const first = createState(0, null, {
      markers: [zombieMarker('missing-board-ops', 1, 1)]
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

    const second = createState(0, null, {
      markers: [zombieMarker('missing-card-markers', 1, 1)]
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

  test('createZombieMarkerData produces marker data with one revival and no countdown', () => {
    expect(ZombieWill.ZOMBIE_INFECTION_CHANCE).toBe(0.2);
    expect(ZombieWill.createZombieMarkerData('white')).toEqual({
      type: 'ZOMBIE',
      ownerColor: Shared.WHITE,
      regenRemaining: 1
    });
  });
});

describe('ZOMBIE movement toward prey', () => {
  test('moves one step toward the nearest prey, then bites from the new position', () => {
    const board = emptyBoard(4);
    board[2][0] = Shared.BLACK;
    board[0][1] = Shared.WHITE;
    const { cardState, gameState } = createState(0, board, {
      markers: [zombieMarker('zombie-production-source', 2, 0)]
    });
    const prng = createCountingPrng([0]);

    const result = CardLogic.processZombieEffectsAtTurnStartAnchor(cardState, gameState, 'black', 2, 0, prng);

    // (1,0) and (1,1) are both one step from the prey and touch it once; the tie uses the PRNG.
    expect(result.moved).toEqual([{
      from: { row: 2, col: 0 },
      to: { row: 1, col: 0 },
      specialType: 'ZOMBIE'
    }]);
    expect(result.source).toEqual({ row: 1, col: 0 });
    expect(result.infected).toEqual([{ row: 0, col: 1 }]);
    expect(prng.calls).toBe(3);
    expect(cardState.presentationEvents[0]).toEqual(expect.objectContaining({
      type: 'MOVE',
      prevRow: 2,
      prevCol: 0,
      row: 1,
      col: 0,
      cause: 'ZOMBIE',
      reason: 'zombie_move',
      meta: expect.objectContaining({ moveIntent: 'hyperactive_move' })
    }));
    expect(cardState.presentationEvents).toContainEqual(expect.objectContaining({
      type: 'CHANGE',
      row: 0,
      col: 1,
      cause: 'ZOMBIE',
      reason: 'zombie_infection',
      meta: expect.objectContaining({ sourceRow: 1, sourceCol: 0 })
    }));
  });

  test('stays put when prey is already adjacent and only rolls the bite', () => {
    const board = emptyBoard(4);
    board[1][1] = Shared.BLACK;
    board[0][1] = Shared.WHITE;
    const { cardState, gameState } = createState(0, board, {
      markers: [zombieMarker('zombie-adjacent', 1, 1)]
    });
    const prng = createCountingPrng([0.5]);

    const result = CardLogic.processZombieEffectsAtTurnStartAnchor(cardState, gameState, 'black', 1, 1, prng);

    expect(result).toEqual({ infected: [] });
    expect(cardState.markers[0]).toMatchObject({ row: 1, col: 1 });
    expect(prng.calls).toBe(1);
    expect(cardState.presentationEvents.some((event) => event.type === 'MOVE')).toBe(false);
  });

  test('prefers the closer cell that touches more prey without using the PRNG', () => {
    const board = emptyBoard(8);
    board[3][3] = Shared.BLACK;
    board[1][2] = Shared.WHITE;
    board[1][4] = Shared.WHITE;
    const { cardState, gameState } = createState(0, board, {
      markers: [zombieMarker('zombie-tiebreak', 3, 3)]
    });
    const prng = createCountingPrng([0.9]);

    const result = CardLogic.processZombieEffectsAtTurnStartAnchor(cardState, gameState, 'black', 3, 3, prng);

    expect(result.moved).toEqual([expect.objectContaining({
      from: { row: 3, col: 3 },
      to: { row: 2, col: 3 }
    })]);
    expect(result.infected).toEqual([]);
    expect(prng.calls).toBe(1);
  });

  test('walks over several owner turns until prey is adjacent', () => {
    const board = emptyBoard(8);
    board[7][0] = Shared.BLACK;
    board[3][0] = Shared.WHITE;
    const { cardState, gameState } = createState(0, board, {
      markers: [zombieMarker('zombie-walker', 7, 0)]
    });
    const prng = createPrng(0.9);
    const distanceToPrey = () => Math.max(Math.abs(cardState.markers[0].row - 3), Math.abs(cardState.markers[0].col - 0));

    for (const expectedDistance of [3, 2, 1]) {
      const result = CardLogic.processZombieEffectsAtTurnStartAnchor(
        cardState,
        gameState,
        'black',
        cardState.markers[0].row,
        cardState.markers[0].col,
        prng
      );
      expect(result.moved).toHaveLength(1);
      expect(result.infected).toEqual([]);
      expect(distanceToPrey()).toBe(expectedDistance);
    }
    const settled = { row: cardState.markers[0].row, col: cardState.markers[0].col };
    const adjacent = CardLogic.processZombieEffectsAtTurnStartAnchor(cardState, gameState, 'black', settled.row, settled.col, prng);
    expect(adjacent.moved || []).toEqual([]);
    expect(cardState.markers[0]).toMatchObject(settled);
    expect(gameState.board[3][0]).toBe(Shared.WHITE);
  });

  test('does not move or consume a random value when the board has no prey', () => {
    const board = emptyBoard(4);
    board[1][1] = Shared.BLACK;
    const { cardState, gameState } = createState(0, board, {
      markers: [zombieMarker('zombie-alone', 1, 1)]
    });
    const prng = createCountingPrng([0]);

    const result = CardLogic.processZombieEffectsAtTurnStartAnchor(cardState, gameState, 'black', 1, 1, prng);

    expect(result).toEqual({ infected: [] });
    expect(cardState.markers[0]).toMatchObject({ row: 1, col: 1 });
    expect(prng.calls).toBe(0);
  });

  test('does not chase prey that cannot be bitten', () => {
    const board = emptyBoard(8);
    board[5][5] = Shared.BLACK;
    board[1][1] = Shared.WHITE;
    const { cardState, gameState } = createState(0, board, {
      markers: [
        zombieMarker('zombie-guarded-prey', 5, 5),
        {
          id: 'guard-far',
          kind: 'specialStone',
          row: 1,
          col: 1,
          owner: 'white',
          createdSeq: 2,
          data: { type: 'GUARD', remainingOwnerTurns: 3 }
        }
      ]
    });
    const prng = createCountingPrng([0]);

    const result = CardLogic.processZombieEffectsAtTurnStartAnchor(cardState, gameState, 'black', 5, 5, prng);

    expect(result.moved || []).toEqual([]);
    expect(prng.calls).toBe(0);
  });

  test('stays when no adjacent empty cell gets closer to the prey', () => {
    const board = emptyBoard(8);
    board[4][3] = Shared.BLACK;
    board[3][2] = Shared.BLACK;
    board[3][3] = Shared.BLACK;
    board[3][4] = Shared.BLACK;
    board[0][3] = Shared.WHITE;
    const { cardState, gameState } = createState(0, board, {
      markers: [zombieMarker('zombie-boxed', 4, 3)]
    });
    // The prey is 4 steps away; the free neighbours (4,2), (4,4) and row 5 are not closer.
    const prng = createCountingPrng([0]);

    const result = CardLogic.processZombieEffectsAtTurnStartAnchor(cardState, gameState, 'black', 4, 3, prng);

    expect(result.moved || []).toEqual([]);
    expect(cardState.markers[0]).toMatchObject({ row: 4, col: 3 });
    expect(prng.calls).toBe(0);
    expect(cardState.presentationEvents.some((event) => event.type === 'MOVE')).toBe(false);
  });
});
