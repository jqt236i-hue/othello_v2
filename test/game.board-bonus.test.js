const Shared = require('../shared-constants');
const CardLogic = require('../game/logic/cards');
const TurnPipeline = require('../game/turn/turn_pipeline');

function createInitialGameState() {
  const gameState = {
    board: Array(8).fill(null).map(() => Array(8).fill(Shared.EMPTY)),
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };
  gameState.board[3][3] = Shared.WHITE;
  gameState.board[3][4] = Shared.BLACK;
  gameState.board[4][3] = Shared.BLACK;
  gameState.board[4][4] = Shared.WHITE;
  return gameState;
}

function createDeterministicPrng() {
  return {
    shuffle: (arr) => arr,
    random: () => 0.1
  };
}

describe('数字マス（初期配置・配置報酬）', () => {
  test('初期配置で40マスが所定内訳で割り当てられる', () => {
    const cardState = CardLogic.createCardState(createDeterministicPrng());
    const bonus = cardState.boardBonusByCell || {};
    const entries = Object.entries(bonus);
    const excluded = new Set([
      '3,3', '3,4', '4,3', '4,4',
      '2,3', '2,4', '5,3', '5,4',
      '3,2', '4,2', '3,5', '4,5'
    ]);

    expect(entries).toHaveLength(40);

    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
    for (const [key, value] of entries) {
      expect(excluded.has(key)).toBe(false);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(10);
      counts[value] += 1;
    }

    expect(counts[1]).toBe(9);
    expect(counts[2]).toBe(8);
    expect(counts[3]).toBe(6);
    expect(counts[4]).toBe(5);
    expect(counts[5]).toBe(4);
    expect(counts[6]).toBe(3);
    expect(counts[7]).toBe(2);
    expect(counts[8]).toBe(1);
    expect(counts[9]).toBe(1);
    expect(counts[10]).toBe(1);
    expect(Object.keys(cardState.boardBonusConsumedByCell || {})).toHaveLength(0);
  });

  test('数字マスは配置時に1回だけ加算され、空きに戻っても復活しない', () => {
    const prng = createDeterministicPrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = createInitialGameState();

    const targetKey = '0,0';
    const targetBonus = Number(cardState.boardBonusByCell[targetKey] || 0);
    expect(targetBonus).toBeGreaterThan(0);

    cardState.pendingEffectByPlayer.black = { type: 'FREE_PLACEMENT', stage: 'awaitPlace' };
    const blackChargeBefore = Number(cardState.charge.black || 0);

    const first = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 0, col: 0 },
      prng
    );

    const blackChargeAfter = Number(cardState.charge.black || 0);
    expect(blackChargeAfter - blackChargeBefore).toBe(targetBonus);
    expect(cardState.boardBonusConsumedByCell[targetKey]).toBe(true);

    gameState.board[0][0] = Shared.EMPTY;
    gameState.currentPlayer = Shared.WHITE;
    cardState.pendingEffectByPlayer.white = { type: 'FREE_PLACEMENT', stage: 'awaitPlace' };

    const second = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'white',
      { type: 'place', row: 0, col: 0 },
      prng
    );

    const secondBonusEvent = second.events.find((ev) => ev && ev.type === 'board_bonus_gain');
    expect(secondBonusEvent).toBeFalsy();
    expect(cardState.boardBonusConsumedByCell[targetKey]).toBe(true);
  });

  test('開始直後の合法4マスには数字マスが配置されない', () => {
    const cardState = CardLogic.createCardState(createDeterministicPrng());
    const bonus = cardState.boardBonusByCell || {};
    const openingMoves = ['2,3', '3,2', '4,5', '5,4'];

    for (const key of openingMoves) {
      expect(Number(bonus[key] || 0)).toBe(0);
    }
  });
});
