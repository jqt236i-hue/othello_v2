const SpecialEffectsHelpers = require('../game/special-effects/helpers.ts');

function special(type: string, row: number, col: number, owner: 'black' | 'white' = 'white', data: any = {}) {
  return {
    id: `${type}-${row}-${col}`,
    kind: 'specialStone',
    row,
    col,
    owner,
    data: { type, ...data }
  };
}

describe('special effects helpers', () => {
  afterEach(() => {
    delete (global as any).cardState;
    delete (global as any).MarkersAdapter;
  });

  test('derives flip blockers from the shared special stone registry', () => {
    (global as any).cardState = {
      markers: [
        special('METEOR_GOD', 0, 1),
        special('LIGHTNING', 1, 2),
        special('ABSOLUTE_PROTECTED', 2, 3),
        special('STONE_SALVATION_GOD', 3, 4),
        special('PROTECTED', 4, 5),
        special('REGEN', 5, 6),
        special('ULTIMATE_HYPERACTIVE', 6, 7, 'white', { remainingOwnerTurns: 0 }),
        special('ULTIMATE_HYPERACTIVE', 7, 0, 'black', { remainingOwnerTurns: 2 })
      ]
    };

    const blockers = SpecialEffectsHelpers.getFlipBlockers();

    expect(blockers).toEqual(expect.arrayContaining([
      { row: 0, col: 1, owner: 'white' },
      { row: 1, col: 2, owner: 'white' },
      { row: 2, col: 3, owner: 'white' },
      { row: 3, col: 4, owner: 'white' },
      { row: 7, col: 0, owner: 'black' }
    ]));
    expect(blockers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 4, col: 5 }),
      expect.objectContaining({ row: 5, col: 6 }),
      expect.objectContaining({ row: 6, col: 7 })
    ]));
  });

  test('requires the shared special stone registry instead of silently degrading', () => {
    jest.isolateModules(() => {
      jest.doMock('../shared/special-stone-registry', () => {
        throw new Error('registry intentionally unavailable');
      });

      delete (global as any).SpecialStoneRegistry;
      (global as any).cardState = {
        markers: [
          special('METEOR_GOD', 0, 1),
          special('ULTIMATE_HYPERACTIVE', 1, 2, 'black', { remainingOwnerTurns: 2 })
        ]
      };

      const isolatedHelpers = require('../game/special-effects/helpers.ts');

      expect(() => isolatedHelpers.getFlipBlockers())
        .toThrow('[special-effects/helpers] SpecialStoneRegistry.getSpecialStoneInfo required');
    });
    jest.dontMock('../shared/special-stone-registry');
  });
});
