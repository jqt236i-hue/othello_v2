import * as Shared from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';

const PRNG = { shuffle: (arr: any[]) => arr, random: () => 0.5 };

function makeEmptyBoard() {
  return Array(8).fill(null).map(() => Array(8).fill(Shared.EMPTY));
}

function makeState() {
  const cardState = CardLogic.createCardState(PRNG);
  cardState.debugNoDraw = true;
  const gameState = {
    board: makeEmptyBoard(),
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };
  return { cardState, gameState };
}

describe('REVERSE_WILL（反転の意志）', () => {
  test('can be used when at least one existing stone can trigger flips', () => {
    const { cardState, gameState } = makeState();
    cardState.hands.black = ['reverse_will_01'];
    cardState.charge.black = 10;
    gameState.board[2][2] = Shared.BLACK;
    gameState.board[2][3] = Shared.WHITE;
    gameState.board[2][4] = Shared.BLACK;

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', 'reverse_will_01');

    expect(used).toBe(true);
    expect(cardState.charge.black).toBe(0);
    expect(cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({
      type: 'REVERSE_WILL',
      cardId: 'reverse_will_01',
      stage: 'selectTarget'
    }));
  });

  test('uses an existing own stone as a normal flip origin and keeps the turn open for placement', () => {
    const { cardState, gameState } = makeState();
    cardState.pendingEffectByPlayer.black = {
      type: 'REVERSE_WILL',
      cardId: 'reverse_will_01',
      stage: 'selectTarget'
    };
    cardState.charge.black = 0;
    gameState.board[2][2] = Shared.BLACK;
    gameState.board[2][3] = Shared.WHITE;
    gameState.board[2][4] = Shared.BLACK;
    gameState.board[3][3] = Shared.WHITE;
    gameState.board[3][4] = Shared.BLACK;

    const selected = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      {
        type: 'place',
        reverseWillTarget: { row: 2, col: 2 },
        pendingSelectionState: { type: 'REVERSE_WILL', cardId: 'reverse_will_01', stage: 'selectTarget' }
      },
      PRNG
    );

    expect(selected.gameState.board[2][3]).toBe(Shared.BLACK);
    expect(selected.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'reverse_will_flipped',
        player: 'black',
        owner: 'black',
        target: { row: 2, col: 2 },
        details: expect.arrayContaining([{ row: 2, col: 3 }])
      })
    ]));
    expect(selected.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(selected.gameState.currentPlayer).toBe(Shared.BLACK);

    const placed = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 3, col: 2 },
      PRNG,
      { skipTurnStart: true }
    );

    expect(placed.gameState.board[3][3]).toBe(Shared.BLACK);
    expect(placed.gameState.board[3][2]).toBe(Shared.BLACK);
    expect(placed.gameState.currentPlayer).toBe(Shared.WHITE);
  });

  test('can choose an opponent stone and awards the resulting flips to that stone owner', () => {
    const { cardState, gameState } = makeState();
    cardState.pendingEffectByPlayer.black = {
      type: 'REVERSE_WILL',
      cardId: 'reverse_will_01',
      stage: 'selectTarget'
    };
    cardState.charge.black = 0;
    cardState.charge.white = 0;
    gameState.board[2][2] = Shared.WHITE;
    gameState.board[2][3] = Shared.BLACK;
    gameState.board[2][4] = Shared.WHITE;
    gameState.board[3][3] = Shared.WHITE;
    gameState.board[3][4] = Shared.BLACK;

    const selected = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      {
        type: 'place',
        reverseWillTarget: { row: 2, col: 2 },
        pendingSelectionState: { type: 'REVERSE_WILL', cardId: 'reverse_will_01', stage: 'selectTarget' }
      },
      PRNG
    );

    expect(selected.gameState.board[2][3]).toBe(Shared.WHITE);
    expect(selected.cardState.totalFlipCountByPlayer.white).toBeGreaterThanOrEqual(1);
    expect(selected.cardState.charge.white).toBeGreaterThanOrEqual(1);
    expect(selected.cardState.charge.black).toBe(0);
    expect(selected.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'reverse_will_flipped',
        player: 'black',
        owner: 'white',
        details: [{ row: 2, col: 3 }]
      })
    ]));

    const placed = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 3, col: 2 },
      PRNG,
      { skipTurnStart: true }
    );

    expect(placed.cardState.charge.black).toBe(1);
  });

  test('lists only occupied stones that can actually flip from the current board', () => {
    const { cardState, gameState } = makeState();
    gameState.board[1][1] = Shared.BLACK;
    gameState.board[2][2] = Shared.BLACK;
    gameState.board[2][3] = Shared.WHITE;
    gameState.board[2][4] = Shared.BLACK;

    const targets = CardLogic.getReverseWillTargets(cardState, gameState);

    expect(targets).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 2, col: 2, owner: 'black', flipCount: 1 })
    ]));
    expect(targets).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 1, col: 1 })
    ]));
  });

  test('rejects stale or forged targets without clearing pending selection', () => {
    const { cardState, gameState } = makeState();
    cardState.pendingEffectByPlayer.black = {
      type: 'REVERSE_WILL',
      cardId: 'reverse_will_01',
      stage: 'selectTarget'
    };
    gameState.board[2][2] = Shared.BLACK;
    gameState.board[2][3] = Shared.WHITE;
    gameState.board[2][4] = Shared.BLACK;

    const result = CardLogic.applyReverseWill(cardState, gameState, 'black', 1, 1);

    expect(result).toEqual(expect.objectContaining({
      applied: false,
      reason: 'invalid_target',
      target: { row: 1, col: 1 }
    }));
    expect(gameState.board[2][3]).toBe(Shared.WHITE);
    expect(cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({
      type: 'REVERSE_WILL',
      cardId: 'reverse_will_01',
      stage: 'selectTarget'
    }));
  });

  test('treats ghost-only reverse lines as a successful card effect with zero actual flips', () => {
    const { cardState, gameState } = makeState();
    cardState.pendingEffectByPlayer.black = {
      type: 'REVERSE_WILL',
      cardId: 'reverse_will_01',
      stage: 'selectTarget'
    };
    gameState.board[2][2] = Shared.BLACK;
    gameState.board[2][3] = Shared.WHITE;
    gameState.board[2][4] = Shared.BLACK;
    cardState.markers.push({
      kind: 'specialStone',
      row: 2,
      col: 3,
      owner: 'white',
      data: { type: 'GHOST', remainingOwnerTurns: 5 }
    });

    const selected = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      {
        type: 'place',
        reverseWillTarget: { row: 2, col: 2 },
        pendingSelectionState: { type: 'REVERSE_WILL', cardId: 'reverse_will_01', stage: 'selectTarget' }
      },
      PRNG
    );

    expect(selected.gameState.board[2][3]).toBe(Shared.WHITE);
    expect(selected.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(selected.cardState.charge.black).toBe(0);
    expect(selected.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'reverse_will_flipped',
        applied: true,
        blockedByGhost: true,
        details: [],
        blocked: [{ row: 2, col: 3, reason: 'ghost_protected' }],
        logicalFlipCount: 1,
        flipCount: 0
      })
    ]));
    expect(selected.presentationEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'CHANGE',
        row: 2,
        col: 3,
        cause: 'REVERSE_WILL',
        reason: 'reverse_will_flip',
        meta: expect.objectContaining({ blockedByGhost: true })
      })
    ]));
  });

  test('lets flip-evasion stones dodge REVERSE_WILL card-effect flips', () => {
    const { cardState, gameState } = makeState();
    cardState.pendingEffectByPlayer.black = {
      type: 'REVERSE_WILL',
      cardId: 'reverse_will_01',
      stage: 'selectTarget'
    };
    cardState.charge.black = 0;
    gameState.board[2][2] = Shared.BLACK;
    gameState.board[2][3] = Shared.WHITE;
    gameState.board[2][4] = Shared.BLACK;
    cardState.markers.push({
      id: 'afterimage_reverse_target',
      kind: 'specialStone',
      row: 2,
      col: 3,
      owner: 'white',
      data: { type: 'AFTERIMAGE_WILL', flipEvadeRemaining: 3, destroyEvadeRemaining: 3 }
    });

    const selected = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      {
        type: 'place',
        reverseWillTarget: { row: 2, col: 2 },
        pendingSelectionState: { type: 'REVERSE_WILL', cardId: 'reverse_will_01', stage: 'selectTarget' }
      },
      PRNG
    );

    const marker = selected.cardState.markers.find((entry: any) => entry && entry.id === 'afterimage_reverse_target');
    expect(selected.gameState.board[2][3]).toBe(Shared.EMPTY);
    expect(marker).toBeTruthy();
    expect(marker.row === 2 && marker.col === 3).toBe(false);
    expect(selected.gameState.board[marker.row][marker.col]).toBe(Shared.WHITE);
    expect(marker.data.flipEvadeRemaining).toBe(2);
    expect(marker.data.destroyEvadeRemaining).toBe(3);
    expect(selected.cardState.charge.black).toBe(0);
    expect(selected.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'reverse_will_flipped',
        applied: true,
        details: [],
        logicalFlipCount: 1,
        flipCount: 0
      })
    ]));
  });
});
