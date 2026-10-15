import * as Shared from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';
import * as Core from '../game/logic/core.js';
import * as BoardOps from '../game/logic/board_ops.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';
import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';

// Ownership-change reactions (復活石 / 屍石の復活、復活回数を使い切った屍石の通常石化) must follow
// every path that changes a stone's colour, and a special-stone body must never disagree with the
// colour of the stone it sits on. These scenarios were found by random self-play (see
// test/game.special-stone-ownership.fuzz.test.ts) and each one reproduces a formerly corrupt state.

function createPrng(randomValue = 0) {
  return {
    shuffle: (arr: any[]) => arr,
    random: () => randomValue
  };
}

function emptyBoard() {
  return Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY));
}

function createState(owner: 'black' | 'white') {
  const prng = createPrng();
  const cardState: any = CardLogic.createCardState(prng);
  const gameState: any = Core.createGameState();
  gameState.board = emptyBoard();
  gameState.currentPlayer = owner === 'black' ? Shared.BLACK : Shared.WHITE;
  gameState.turnNumber = 20;
  cardState.charge = { black: 99, white: 99 };
  return { cardState, gameState, prng };
}

function placeStones(gameState: any, stones: Array<[number, number, number]>) {
  for (const [row, col, value] of stones) gameState.board[row][col] = value;
}

function zombie(cardState: any, row: number, col: number, owner: 'black' | 'white', regenRemaining = 1) {
  return CardLogic.addMarker(cardState, 'specialStone', row, col, owner, {
    type: 'ZOMBIE',
    ownerColor: owner === 'black' ? Shared.BLACK : Shared.WHITE,
    regenRemaining
  });
}

function zombieMarkersAt(cardState: any, row: number, col: number) {
  return (cardState.markers || []).filter((m: any) => (
    m && m.kind === 'specialStone' && m.row === row && m.col === col && m.data && m.data.type === 'ZOMBIE'
  ));
}

function bodyMarkersAt(cardState: any, row: number, col: number) {
  return (cardState.markers || []).filter((m: any) => m && m.kind === 'specialStone' && m.row === row && m.col === col);
}

function expectConsistentBodies(cardState: any, gameState: any) {
  for (const marker of cardState.markers || []) {
    if (!marker || marker.kind !== 'specialStone' || !marker.data) continue;
    const type = String(marker.data.type || '').toUpperCase();
    if (type !== 'ZOMBIE' && type !== 'REGEN') continue;
    const expected = marker.owner === 'black' ? Shared.BLACK : Shared.WHITE;
    expect({ type, owner: marker.owner, row: marker.row, col: marker.col, cell: gameState.board[marker.row][marker.col] })
      .toEqual({ type, owner: marker.owner, row: marker.row, col: marker.col, cell: expected });
  }
}

describe('placement recaptured by a revival in the same move', () => {
  // White places a zombie at (6,6); the flip revives the black zombie at (5,5), whose capture takes
  // (6,6) back. The white zombie must still come into being and react to that capture.
  function setupRecapture(pending: any) {
    const s = createState('white');
    placeStones(s.gameState, [[3, 3, Shared.WHITE], [4, 4, Shared.BLACK], [5, 5, Shared.BLACK], [7, 7, Shared.BLACK]]);
    zombie(s.cardState, 5, 5, 'black', 1);
    s.cardState.pendingEffectByPlayer.white = pending;
    return s;
  }

  test('a recaptured 屍石 placement revives once and keeps marker and colour in agreement', () => {
    const s = setupRecapture({ type: 'ZOMBIE_WILL', stage: null, cardId: 'zombie_will_01' });

    const result = TurnPipeline.applyTurn(s.cardState, s.gameState, 'white', { type: 'place', row: 6, col: 6 }, s.prng, { skipTurnStart: true });

    expect(result.events.some((e: any) => e.type === 'regen_capture_flipped')).toBe(true);
    expect(s.gameState.board[6][6]).toBe(Shared.WHITE);
    expect(zombieMarkersAt(s.cardState, 6, 6)).toEqual([expect.objectContaining({ owner: 'white', data: expect.objectContaining({ regenRemaining: 0 }) })]);
    // The black zombie spent its revival on the first flip and then lost the stone to the white zombie's revival capture.
    expect(s.gameState.board[5][5]).toBe(Shared.WHITE);
    expect(zombieMarkersAt(s.cardState, 5, 5)).toEqual([]);
    expectConsistentBodies(s.cardState, s.gameState);
  });

  test('a recaptured reverting body (弱い石) is lost with the stone instead of lingering on the enemy stone', () => {
    const s = setupRecapture({ type: 'PROTECTED_NEXT_STONE', stage: null, cardId: 'hard_01' });

    TurnPipeline.applyTurn(s.cardState, s.gameState, 'white', { type: 'place', row: 6, col: 6 }, s.prng, { skipTurnStart: true });

    expect(s.gameState.board[6][6]).toBe(Shared.BLACK);
    expect(bodyMarkersAt(s.cardState, 6, 6)).toEqual([]);
    expect(s.cardState.pendingEffectByPlayer.white).toBeNull();
  });
});

describe('flips made by an evading stone', () => {
  test('a 残像石 that evades a placement flip and captures a 屍石 triggers the zombie revival', () => {
    const s = createState('black');
    // Black places (3,2) flipping the white afterimage at (2,2) (ended by the black zombie at (1,2)).
    // The afterimage evades to its only free neighbour (1,1) and captures (1,2) between itself and (1,3).
    placeStones(s.gameState, [
      [1, 2, Shared.BLACK], [1, 3, Shared.WHITE],
      [2, 1, Shared.WHITE], [2, 2, Shared.WHITE], [2, 3, Shared.WHITE],
      [3, 1, Shared.WHITE], [3, 3, Shared.WHITE]
    ]);
    zombie(s.cardState, 1, 2, 'black', 1);
    CardLogic.addMarker(s.cardState, 'specialStone', 2, 2, 'white', { type: 'AFTERIMAGE_WILL', flipEvadeRemaining: 6, destroyEvadeRemaining: 6 });

    const result = TurnPipeline.applyTurn(s.cardState, s.gameState, 'black', { type: 'place', row: 3, col: 2 }, s.prng, { skipTurnStart: true });

    const afterimage = s.cardState.markers.find((m: any) => m.data && m.data.type === 'AFTERIMAGE_WILL');
    expect(afterimage).toMatchObject({ row: 1, col: 1, owner: 'white' });
    expect(s.gameState.board[1][2]).toBe(Shared.BLACK);
    expect(zombieMarkersAt(s.cardState, 1, 2)).toEqual([expect.objectContaining({ owner: 'black', data: expect.objectContaining({ regenRemaining: 0 }) })]);
    expect(result.events.some((e: any) => e.type === 'regen_triggered')).toBe(true);
    expectConsistentBodies(s.cardState, s.gameState);
  });
});

describe('capture flips of a destroy-triggered revival', () => {
  test('a zombie captured by another zombie reviving from destruction gets its own revival', () => {
    const s = createState('black');
    placeStones(s.gameState, [[3, 3, Shared.WHITE], [4, 4, Shared.BLACK], [5, 5, Shared.WHITE], [6, 6, Shared.BLACK]]);
    zombie(s.cardState, 4, 4, 'black', 1);
    zombie(s.cardState, 5, 5, 'white', 1);

    const outcome = BoardOps.destroyAt(s.cardState, s.gameState, 5, 5, 'DESTROY_ONE_STONE', 'destroy_selected');
    expect(outcome).toMatchObject({ regenerated: true });
    // The white revival captured the black zombie at (4,4) without any reaction yet.
    expect(s.gameState.board[4][4]).toBe(Shared.WHITE);
    expect(zombieMarkersAt(s.cardState, 4, 4)[0].owner).toBe('black');

    const settled = CardLogic.settleOwnershipChangeReactions(s.cardState, s.gameState);

    expect(settled.settled).toBe(true);
    expect(settled.regened).toEqual(expect.arrayContaining([{ row: 4, col: 4 }]));
    expect(s.gameState.board[4][4]).toBe(Shared.BLACK);
    expect(zombieMarkersAt(s.cardState, 4, 4)).toEqual([expect.objectContaining({ owner: 'black', data: expect.objectContaining({ regenRemaining: 0 }) })]);
    // The black zombie's revival captured the depleted white zombie back, which then became a plain black stone.
    expect(s.gameState.board[5][5]).toBe(Shared.BLACK);
    expect(zombieMarkersAt(s.cardState, 5, 5)).toEqual([]);
    expectConsistentBodies(s.cardState, s.gameState);
  });

  test('the action phase settles reactions left behind by a card effect', () => {
    const s = createState('black');
    placeStones(s.gameState, [[3, 3, Shared.WHITE], [4, 4, Shared.BLACK], [5, 5, Shared.WHITE], [6, 6, Shared.BLACK], [0, 0, Shared.BLACK]]);
    zombie(s.cardState, 4, 4, 'black', 1);
    zombie(s.cardState, 5, 5, 'white', 1);
    s.cardState.pendingEffectByPlayer.black = { type: 'DESTROY_ONE_STONE', stage: 'selectTarget', cardId: 'destroy_01' };

    const result = TurnPipeline.applyTurn(s.cardState, s.gameState, 'black', { type: 'place', destroyTarget: { row: 5, col: 5 } }, s.prng, { skipTurnStart: true });

    expect(result.events.some((e: any) => e.type === 'destroy_selected')).toBe(true);
    expect(s.gameState.board[4][4]).toBe(Shared.BLACK);
    expect(zombieMarkersAt(s.cardState, 4, 4)).toEqual([expect.objectContaining({ owner: 'black', data: expect.objectContaining({ regenRemaining: 0 }) })]);
    expectConsistentBodies(s.cardState, s.gameState);
  });
});

describe('breeding flips at turn start', () => {
  test('a stone captured by a 繁殖 spawn reacts like any other flipped stone', () => {
    const s = createState('white');
    placeStones(s.gameState, [
      [2, 0, Shared.WHITE], [2, 1, Shared.WHITE], [3, 0, Shared.WHITE], [4, 0, Shared.WHITE],
      [4, 1, Shared.BLACK], [5, 1, Shared.WHITE]
    ]);
    CardLogic.addMarker(s.cardState, 'specialStone', 3, 0, 'white', { type: 'BREEDING', remainingOwnerTurns: 5 });
    zombie(s.cardState, 4, 1, 'black', 1);
    s.cardState.lastTurnStartedFor = 'black';
    const events: any[] = [];

    TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, s.cardState, s.gameState, 'white', events, s.prng, BoardOps);

    expect(events.some((e: any) => e.type === 'breeding_flipped_start')).toBe(true);
    expect(s.gameState.board[3][1]).toBe(Shared.WHITE);
    expect(s.gameState.board[4][1]).toBe(Shared.BLACK);
    expect(zombieMarkersAt(s.cardState, 4, 1)).toEqual([expect.objectContaining({ owner: 'black', data: expect.objectContaining({ regenRemaining: 0 }) })]);
    expect(events.some((e: any) => e.type === 'regen_triggered_start')).toBe(true);
    expectConsistentBodies(s.cardState, s.gameState);
  });
});

describe('誘惑 on a frozen cell', () => {
  function setupFrozenTempt() {
    const s = createState('white');
    placeStones(s.gameState, [[2, 7, Shared.BLACK], [5, 5, Shared.BLACK]]);
    CardLogic.addMarker(s.cardState, 'specialStone', 2, 7, 'black', { type: 'ULTIMATE_HYPERACTIVE', remainingOwnerTurns: 12, flipEvadeRemaining: 5, destroyEvadeRemaining: 2 });
    CardLogic.addMarker(s.cardState, 'specialStone', 2, 7, 'white', { type: 'FREEZE', remainingOwnerTurns: 4, sourceType: 'MASS_FREEZE_WILL' });
    CardLogic.addMarker(s.cardState, 'specialStone', 5, 5, 'black', { type: 'GHOST', remainingOwnerTurns: 6 });
    s.cardState.pendingEffectByPlayer.white = { type: 'TEMPT_WILL', stage: 'selectTarget', cardId: 'tempt_01' };
    return s;
  }

  test('frozen special stones are not offered as targets', () => {
    const s = setupFrozenTempt();
    expect(CardLogic.getTemptWillTargets(s.cardState, s.gameState, 'white')).toEqual([{ row: 5, col: 5 }]);
  });

  test('a frozen stone refuses the colour change and keeps its owner', () => {
    const s = setupFrozenTempt();

    const result = CardLogic.applyTemptWill(s.cardState, s.gameState, 'white', 2, 7);

    expect(result).toMatchObject({ applied: false, reason: 'frozen_protected' });
    expect(s.gameState.board[2][7]).toBe(Shared.BLACK);
    const body = s.cardState.markers.find((m: any) => m.data && m.data.type === 'ULTIMATE_HYPERACTIVE');
    expect(body.owner).toBe('black');
    expect(s.cardState.pendingEffectByPlayer.white).toMatchObject({ type: 'TEMPT_WILL' });
  });
});

describe('depleted zombie bookkeeping', () => {
  test('a depleted zombie on its own colour survives a reaction pass run by its owner', () => {
    const board = emptyBoard();
    board[3][3] = Shared.BLACK;
    const cardState: any = CardLogic.createCardState(createPrng());
    zombie(cardState, 3, 3, 'black', 0);

    CardLogic.applyRegenAfterFlips(cardState, { board }, [{ row: 3, col: 3 }], 'black', false);
    CardLogic.settleOwnershipChangeReactions(cardState, { board });

    expect(board[3][3]).toBe(Shared.BLACK);
    expect(zombieMarkersAt(cardState, 3, 3)).toHaveLength(1);
  });

  test('settling turns a depleted zombie on an enemy-coloured cell into a plain stone', () => {
    const board = emptyBoard();
    board[3][3] = Shared.WHITE;
    const cardState: any = CardLogic.createCardState(createPrng());
    zombie(cardState, 3, 3, 'black', 0);

    const settled = CardLogic.settleOwnershipChangeReactions(cardState, { board });

    expect(settled.regened).toEqual([]);
    expect(board[3][3]).toBe(Shared.WHITE);
    expect(zombieMarkersAt(cardState, 3, 3)).toEqual([]);
  });

  test('settling is a no-op on a consistent board', () => {
    const board = emptyBoard();
    board[3][3] = Shared.BLACK;
    board[4][4] = Shared.WHITE;
    const cardState: any = CardLogic.createCardState(createPrng());
    zombie(cardState, 3, 3, 'black', 1);
    zombie(cardState, 4, 4, 'white', 0);
    const before = JSON.stringify({ board, markers: cardState.markers });

    const settled = CardLogic.settleOwnershipChangeReactions(cardState, { board });

    expect(settled.settled).toBe(false);
    expect(JSON.stringify({ board, markers: cardState.markers })).toBe(before);
  });
});
