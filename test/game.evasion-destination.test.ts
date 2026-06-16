import EvasionDestination = require('../game/logic/cards-internal/evasion-destination');

function prng(values: number[]) {
  let index = 0;
  return {
    random: () => {
      const value = values[index] ?? values[values.length - 1] ?? 0;
      index += 1;
      return value;
    }
  };
}

describe('evasion destination helper', () => {
  test('selects nearest empty candidate by Chebyshev distance', () => {
    const destination = EvasionDestination.selectNearestEmptyEvasionDestination(
      { row: 4, col: 4 },
      [
        { row: 0, col: 0 },
        { row: 4, col: 7 },
        { row: 6, col: 6 }
      ],
      prng([0])
    );

    expect(destination).toEqual({ row: 6, col: 6 });
  });

  test('uses deterministic random selection for equal Chebyshev distance', () => {
    const candidates = [
      { row: 2, col: 2 },
      { row: 2, col: 4 },
      { row: 4, col: 2 },
      { row: 4, col: 4 }
    ];

    const first = EvasionDestination.selectNearestEmptyEvasionDestination(
      { row: 3, col: 3 },
      candidates,
      prng([0])
    );
    const last = EvasionDestination.selectNearestEmptyEvasionDestination(
      { row: 3, col: 3 },
      candidates,
      prng([0.999])
    );

    expect(first).toEqual({ row: 2, col: 2 });
    expect(last).toEqual({ row: 4, col: 4 });
  });

  test('excludes origin, duplicate, and forbidden cells before scoring', () => {
    const destination = EvasionDestination.selectNearestEmptyEvasionDestination(
      { row: 3, col: 3 },
      [
        { row: 3, col: 3 },
        { row: 2, col: 2 },
        { row: 2, col: 2 },
        { row: 1, col: 1 }
      ],
      prng([0]),
      { forbiddenCells: [{ row: 2, col: 2 }] }
    );

    expect(destination).toEqual({ row: 1, col: 1 });
  });

  test('returns null when no candidate remains', () => {
    const destination = EvasionDestination.selectNearestEmptyEvasionDestination(
      { row: 3, col: 3 },
      [{ row: 3, col: 3 }],
      prng([0])
    );

    expect(destination).toBeNull();
  });
});
