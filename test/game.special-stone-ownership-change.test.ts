import * as Shared from '../shared-constants.js';
import * as BoardOps from '../game/logic/board_ops.js';
import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';

const ImmediateEffectDispatcher = require('../game/turn/immediate-effect-dispatcher');
const PRNG = { shuffle: (items: any[]) => items, random: () => 0 };

function makeState() {
  const cardState = CardLogic.createCardState(PRNG);
  cardState.debugNoDraw = true;
  cardState.presentationEvents = [];
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };
  return { cardState, gameState };
}

function addMarker(cardState: any, type: string, row: number, col: number, owner = 'white', data: any = {}) {
  const marker = {
    id: `${type}-${row}-${col}`,
    kind: 'specialStone',
    row,
    col,
    owner,
    createdSeq: (cardState.markers || []).length + 1,
    data: { type, ...data }
  };
  cardState.markers.push(marker);
  return marker;
}

function findMarker(cardState: any, type: string, row: number, col: number) {
  return (cardState.markers || []).find((marker: any) => (
    marker && marker.row === row && marker.col === col && marker.data && marker.data.type === type
  ));
}

describe('special-stone ownership-change lifecycle', () => {
  test.each([
    ['SACRIFICE', {}],
    ['PROLIFERATION', {}],
    ['SNIPER', { remainingOwnerTurns: 3 }],
    ['WORK', { remainingOwnerTurns: 3, ownerColor: 'white' }],
    ['TIME_STOP', { remainingOwnerTurns: 3 }],
    ['TIME_STOP_DEITY', { remainingOwnerTurns: 3 }],
    ['TIME_BOMB', { category: 'bomb', remainingTurns: 3 }]
  ])('BoardOps removes %s on an actual owner change regardless of reason text', (type, data) => {
    const { cardState, gameState } = makeState();
    gameState.board[3][3] = Shared.WHITE;
    addMarker(cardState, type as string, 3, 3, 'white', data);
    if (type === 'WORK') cardState.workAnchorPosByPlayer.white = { row: 3, col: 3 };

    const result = BoardOps.changeAt(cardState, gameState, 3, 3, 'black', 'UNIT_TEST', 'owner_changed_without_flip_word');

    expect(result.changed).toBe(true);
    expect(result.removedSpecialMarkers).toEqual(expect.arrayContaining([
      expect.objectContaining({ type })
    ]));
    expect(findMarker(cardState, type as string, 3, 3)).toBeUndefined();
    if (type === 'WORK') expect(cardState.workAnchorPosByPlayer.white).toBeNull();
  });

  test.each([
    ['REGEN', { regenRemaining: 3 }],
    ['ZOMBIE', { regenRemaining: 1 }],
    ['LIVING_WILL', { baseline: { owner: 'white', value: Shared.WHITE, markers: [] } }],
    ['TRAP', { hidden: true }],
    ['POISONED', { remainingTurns: 5 }]
  ])('BoardOps retains %s until its reaction or independent lifecycle resolves', (type, data) => {
    const { cardState, gameState } = makeState();
    gameState.board[3][3] = Shared.WHITE;
    addMarker(cardState, type as string, 3, 3, 'white', data);

    const result = BoardOps.changeAt(cardState, gameState, 3, 3, 'black', 'UNIT_TEST', 'conversion');

    expect(result.changed).toBe(true);
    expect(result.removedSpecialMarkers).toEqual([]);
    expect(findMarker(cardState, type as string, 3, 3)).toBeTruthy();
  });

  test('standard placement normalizes Sacrifice and it cannot nullify a later card', () => {
    const { cardState, gameState } = makeState();
    gameState.board[3][3] = Shared.WHITE;
    gameState.board[3][4] = Shared.BLACK;
    addMarker(cardState, 'SACRIFICE', 3, 3, 'white', { remainingOwnerTurns: 5 });

    TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 3, col: 2 }, PRNG);

    expect(gameState.board[3][3]).toBe(Shared.BLACK);
    expect(findMarker(cardState, 'SACRIFICE', 3, 3)).toBeUndefined();

    cardState.hands.black = ['destroy_01'];
    cardState.charge.black = 99;
    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', 'destroy_01')).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({ type: 'DESTROY_ONE_STONE' }));
    expect(gameState.board[3][3]).toBe(Shared.BLACK);
  });

  test('dragon conversion invokes the same regen reaction used by standard flips', () => {
    const { cardState, gameState } = makeState();
    gameState.board[3][3] = Shared.BLACK;
    gameState.board[3][4] = Shared.WHITE;
    addMarker(cardState, 'DRAGON', 3, 3, 'black', { remainingOwnerTurns: 5 });
    addMarker(cardState, 'REGEN', 3, 4, 'white', { regenRemaining: 1, remainingOwnerTurns: 1 });
    const events: any[] = [];

    ImmediateEffectDispatcher.resolveImmediateEffects({
      CardLogic,
      cardState,
      gameState,
      playerKey: 'black',
      events,
      row: 3,
      col: 3,
      typeKey: 'DRAGON',
      randomSource: PRNG,
      awardBoardChargeGain: () => {}
    });

    expect(gameState.board[3][4]).toBe(Shared.WHITE);
    expect(findMarker(cardState, 'REGEN', 3, 4)).toBeUndefined();
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'dragon_converted_immediate' }),
      expect.objectContaining({ type: 'regen_triggered', details: [{ row: 3, col: 4 }] })
    ]));
  });

  test('swap resolves revives from only the captures that actually changed', () => {
    const { cardState, gameState } = makeState();
    gameState.board[3][2] = Shared.BLACK;
    gameState.board[3][3] = Shared.WHITE;
    gameState.board[3][4] = Shared.WHITE;
    gameState.board[3][5] = Shared.BLACK;
    addMarker(cardState, 'REGEN', 3, 4, 'white', { regenRemaining: 1, remainingOwnerTurns: 1 });

    const result = CardLogic.applySwapEffectDetailed(cardState, gameState, 'black', 3, 3);

    expect(result).toMatchObject({
      swapped: true,
      flipped: [{ row: 3, col: 4 }],
      postFlipRevives: { regenRes: { regened: [{ row: 3, col: 4 }] } }
    });
    expect(gameState.board[3][3]).toBe(Shared.BLACK);
    expect(gameState.board[3][4]).toBe(Shared.WHITE);
  });

  test('Reverse Will resolves regen on its actual card-effect flips', () => {
    const { cardState, gameState } = makeState();
    cardState.pendingEffectByPlayer.black = { type: 'REVERSE_WILL', cardId: 'reverse_will_01', stage: 'selectTarget' };
    gameState.board[2][2] = Shared.BLACK;
    gameState.board[2][3] = Shared.WHITE;
    gameState.board[2][4] = Shared.BLACK;
    addMarker(cardState, 'REGEN', 2, 3, 'white', { regenRemaining: 1, remainingOwnerTurns: 1 });

    const result = CardLogic.applyReverseWill(cardState, gameState, 'black', 2, 2);

    expect(result).toMatchObject({
      applied: true,
      flipped: [{ row: 2, col: 3 }],
      postFlipRevives: { regenRes: { regened: [{ row: 2, col: 3 }] } }
    });
    expect(gameState.board[2][3]).toBe(Shared.WHITE);
  });

  test('Living Will follow-up flips are fed back into the ordered reaction queue', () => {
    const { cardState, gameState } = makeState();
    gameState.board[4][4] = Shared.BLACK;
    gameState.board[4][5] = Shared.WHITE;
    gameState.board[4][6] = Shared.BLACK;
    cardState.pendingEffectByPlayer.black = { type: 'LIVING_WILL', stage: 'selectTarget' };
    expect(CardLogic.applyLivingWill(cardState, gameState, 'black', 4, 4)).toMatchObject({ applied: true });
    addMarker(cardState, 'REGEN', 4, 5, 'white', { regenRemaining: 1, remainingOwnerTurns: 1 });

    expect(BoardOps.changeAt(cardState, gameState, 4, 4, 'white', 'UNIT_TEST', 'initial_flip').changed).toBe(true);
    const reaction = CardLogic.applyPostFlipRevives(cardState, gameState, [{ row: 4, col: 4 }], 'white');

    expect(gameState.board[4][4]).toBe(Shared.BLACK);
    expect(gameState.board[4][5]).toBe(Shared.WHITE);
    expect(reaction.regenRes.regened).toEqual([{ row: 4, col: 5 }]);
    expect(reaction.batches).toEqual(expect.arrayContaining([
      expect.objectContaining({ ownerKey: 'white', source: 'initial', flips: [{ row: 4, col: 4 }] }),
      expect.objectContaining({ ownerKey: 'black', source: 'living_will_restore', flips: [{ row: 4, col: 5 }] })
    ]));
  });

  test('Tempt transfers marker state but does not increment flip or corner totals', () => {
    const { cardState, gameState } = makeState();
    gameState.board[0][0] = Shared.WHITE;
    cardState.pendingEffectByPlayer.black = { type: 'TEMPT_WILL', stage: 'selectTarget', cardId: 'tempt_01' };
    addMarker(cardState, 'SACRIFICE', 0, 0, 'white', { remainingOwnerTurns: 4 });
    const flipsBefore = cardState.totalFlipCountByPlayer.black;
    const cornersBefore = cardState.cornerCaptureCountByPlayer.black;

    expect(CardLogic.applyTemptWill(cardState, gameState, 'black', 0, 0)).toMatchObject({ applied: true });

    expect(gameState.board[0][0]).toBe(Shared.BLACK);
    expect(findMarker(cardState, 'SACRIFICE', 0, 0)).toMatchObject({ owner: 'black', data: { remainingOwnerTurns: 4 } });
    expect(cardState.totalFlipCountByPlayer.black).toBe(flipsBefore);
    expect(cardState.cornerCaptureCountByPlayer.black).toBe(cornersBefore);
    const changeEvent = cardState.presentationEvents.find((event: any) => event && event.type === 'CHANGE' && event.row === 0 && event.col === 0);
    expect(changeEvent.meta).not.toHaveProperty('ownershipChangeMode');
    expect(changeEvent.meta).not.toHaveProperty('countAsFlip');
  });
});
