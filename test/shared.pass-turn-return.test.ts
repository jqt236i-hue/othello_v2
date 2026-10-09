import PassTurnReturn = require('../shared/pass-turn-return');

// 01-rulebook.md §8.2 / §8.4: 2回目のパスで終局せず先にパスした側へ手番が戻った時だけ「続行」通知を出す。
describe('didPassReturnTurn', () => {
  const { didPassReturnTurn } = PassTurnReturn;

  test('is true when the second pass hands the turn back to the player who passed first', () => {
    expect(didPassReturnTurn({ consecutivePasses: 1 }, { consecutivePasses: 1, currentPlayer: 1 }, 'white')).toBe(true);
    expect(didPassReturnTurn({ consecutivePasses: 1 }, { consecutivePasses: 1, currentPlayer: -1 }, 'black')).toBe(true);
  });

  test('is false for the first pass', () => {
    expect(didPassReturnTurn({ consecutivePasses: 0 }, { consecutivePasses: 1, currentPlayer: 1 }, 'white')).toBe(false);
  });

  test('is false when the second pass ends the game', () => {
    expect(didPassReturnTurn({ consecutivePasses: 1 }, { consecutivePasses: 2, currentPlayer: 1 }, 'white')).toBe(false);
  });

  test('is false when time stop keeps the turn with the player who passed', () => {
    expect(didPassReturnTurn({ consecutivePasses: 1 }, { consecutivePasses: 1, currentPlayer: -1 }, 'white')).toBe(false);
  });

  test('is false for missing states or an unknown player', () => {
    expect(didPassReturnTurn(null, { consecutivePasses: 1, currentPlayer: 1 }, 'white')).toBe(false);
    expect(didPassReturnTurn({ consecutivePasses: 1 }, null, 'white')).toBe(false);
    expect(didPassReturnTurn({ consecutivePasses: 1 }, { consecutivePasses: 1, currentPlayer: 1 }, 'red')).toBe(false);
  });
});
