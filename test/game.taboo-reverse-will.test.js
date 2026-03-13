const Shared = require('../shared-constants');
const CardLogic = require('../game/logic/cards');
const TurnPipeline = require('../game/turn/turn_pipeline');

function makeState() {
  const prng = { shuffle: (arr) => arr, random: () => 0.5 };
  const cardState = CardLogic.createCardState(prng);
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };
  return { cardState, gameState };
}

describe('TABOO_REVERSE_WILL（禁忌の反転）', () => {
  test('applyCardUsage arms pending effect without target selection', () => {
    const { cardState, gameState } = makeState();
    const def = (Shared.CARD_DEFS || []).find((card) => card && card.id === 'taboo_reverse_01');
    expect(def).toBeTruthy();

    cardState.hands.black.push(def.id);
    cardState.charge.black = Number(def.cost || 0);

    const ok = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);

    expect(ok).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toMatchObject({
      type: 'TABOO_REVERSE_WILL',
      stage: null,
      cardId: def.id
    });
  });

  test('prioritizes taboo reverse over normal flips and uses only the best one direction', () => {
    const { cardState, gameState } = makeState();
    cardState.pendingEffectByPlayer.black = { type: 'TABOO_REVERSE_WILL', cardId: 'taboo_reverse_01', stage: null };

    gameState.board[3][3] = Shared.WHITE;
    gameState.board[4][3] = Shared.BLACK;

    gameState.board[2][4] = Shared.WHITE;
    gameState.board[2][5] = Shared.WHITE;

    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 2, col: 3 });

    expect(res.gameState.board[3][3]).toBe(Shared.WHITE);
    expect(res.gameState.board[2][4]).toBe(Shared.BLACK);
    expect(res.gameState.board[2][5]).toBe(Shared.BLACK);

    const tabooEvent = res.events.find((ev) => ev && ev.type === 'taboo_reverse_flipped');
    expect(tabooEvent).toBeTruthy();
    expect(tabooEvent.details).toHaveLength(2);
    expect(tabooEvent.direction).toEqual([0, 1]);
    expect(res.cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('falls back to normal flips when taboo reverse is unavailable at that cell', () => {
    const { cardState, gameState } = makeState();
    cardState.pendingEffectByPlayer.black = { type: 'TABOO_REVERSE_WILL', cardId: 'taboo_reverse_01', stage: null };

    gameState.board[3][3] = Shared.WHITE;
    gameState.board[4][3] = Shared.BLACK;

    const candidates = CardLogic.getTabooReverseCandidates(cardState, gameState, 'black', 2, 3);
    expect(candidates).toHaveLength(0);

    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 2, col: 3 });

    expect(res.gameState.board[3][3]).toBe(Shared.BLACK);
    expect(res.events.some((ev) => ev && ev.type === 'taboo_reverse_flipped')).toBe(false);
    expect(res.cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('frozen enemy stone blocks taboo reverse candidates', () => {
    const { cardState, gameState } = makeState();
    cardState.pendingEffectByPlayer.black = { type: 'TABOO_REVERSE_WILL', cardId: 'taboo_reverse_01', stage: null };
    cardState.markers = [
      { kind: 'specialStone', row: 2, col: 5, owner: 'white', data: { type: 'FREEZE', remainingOwnerTurns: 5 } }
    ];

    gameState.board[2][4] = Shared.WHITE;
    gameState.board[2][5] = Shared.WHITE;

    const candidates = CardLogic.getTabooReverseCandidates(cardState, gameState, 'black', 2, 3);
    expect(candidates).toHaveLength(0);
  });

  test('allows placement with zero normal flips and reverses only the longest enemy line', () => {
    const { cardState, gameState } = makeState();
    cardState.pendingEffectByPlayer.black = { type: 'TABOO_REVERSE_WILL', cardId: 'taboo_reverse_01', stage: null };

    gameState.board[3][4] = Shared.WHITE;
    gameState.board[3][5] = Shared.WHITE;
    gameState.board[3][6] = Shared.WHITE;

    gameState.board[4][2] = Shared.WHITE;
    gameState.board[5][1] = Shared.WHITE;

    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 3, col: 3 });

    expect(res.gameState.board[3][4]).toBe(Shared.BLACK);
    expect(res.gameState.board[3][5]).toBe(Shared.BLACK);
    expect(res.gameState.board[3][6]).toBe(Shared.BLACK);

    expect(res.gameState.board[4][2]).toBe(Shared.WHITE);
    expect(res.gameState.board[5][1]).toBe(Shared.WHITE);

    const tabooEvent = res.events.find((ev) => ev && ev.type === 'taboo_reverse_flipped');
    expect(tabooEvent).toBeTruthy();
    expect(Array.isArray(tabooEvent.details)).toBe(true);
    expect(tabooEvent.details).toHaveLength(3);
  });

  test('breaks ties randomly among longest lines (deterministic with injected PRNG)', () => {
    const { cardState, gameState } = makeState();
    cardState.pendingEffectByPlayer.black = { type: 'TABOO_REVERSE_WILL', cardId: 'taboo_reverse_01', stage: null };

    gameState.board[3][1] = Shared.WHITE;
    gameState.board[3][2] = Shared.WHITE;
    gameState.board[3][4] = Shared.WHITE;
    gameState.board[3][5] = Shared.WHITE;

    const prng = { shuffle: (arr) => arr, random: () => 0.9 };
    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 3, col: 3 }, prng);

    expect(res.gameState.board[3][4]).toBe(Shared.BLACK);
    expect(res.gameState.board[3][5]).toBe(Shared.BLACK);
    expect(res.gameState.board[3][1]).toBe(Shared.WHITE);
    expect(res.gameState.board[3][2]).toBe(Shared.WHITE);

    const tabooEvent = res.events.find((ev) => ev && ev.type === 'taboo_reverse_flipped');
    expect(tabooEvent).toBeTruthy();
    expect(tabooEvent.direction).toEqual([0, 1]);
  });

  test('rejects move when no taboo direction candidate exists', () => {
    const { cardState, gameState } = makeState();
    cardState.pendingEffectByPlayer.black = { type: 'TABOO_REVERSE_WILL', cardId: 'taboo_reverse_01', stage: null };

    expect(() => {
      TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 3, col: 3 });
    }).toThrow('Illegal move: no flips and not free placement');

    expect(cardState.pendingEffectByPlayer.black).toMatchObject({ type: 'TABOO_REVERSE_WILL' });
    expect(gameState.board[3][3]).toBe(Shared.EMPTY);
  });
});
