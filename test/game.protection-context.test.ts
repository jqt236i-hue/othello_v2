const Shared = require('../shared-constants.js');
const SpecialStoneRegistry = require('../shared/special-stone-registry.js');
const ManifestStoneRegistry = require('../shared/manifest-stone-registry.js');
const ProtectionContext = require('../game/logic/cards-internal/protection-context');

function marker(type: string, row: number, col: number, owner: 'black' | 'white' = 'white', data: any = {}) {
  return {
    id: `${type}-${row}-${col}`,
    kind: 'specialStone',
    row,
    col,
    owner,
    data: { type, ...data }
  };
}

function registryFlipProtectedTypes(): string[] {
  return Object.entries(SpecialStoneRegistry.SPECIAL_STONE_REGISTRY || {})
    .filter(([, info]: any) => info && info.flipProtected === true)
    .map(([type]) => String(type));
}

function build(cardState: any, extraDeps: any = {}) {
  return ProtectionContext.buildCardProtectionContext(cardState, {
    constants: Shared,
    SpecialStoneRegistry,
    ManifestStoneRegistry,
    ...extraDeps
  });
}

describe('card protection context', () => {
  test('derives flip-blocking context from the shared special stone registry', () => {
    const protectedTypes = registryFlipProtectedTypes();
    expect(protectedTypes).toEqual(expect.arrayContaining([
      'PROTECTED',
      'METEOR_GOD',
      'LIGHTNING',
      'STONE_SALVATION_GOD'
    ]));

    const markers = protectedTypes.map((type, index) => (
      marker(type, Math.floor(index / 8), index % 8, 'white', { remainingOwnerTurns: 6 })
    ));
    markers.push(marker('REGEN', 7, 6, 'black', { regenRemaining: 2 }));
    markers.push(marker('ULTIMATE_HYPERACTIVE', 7, 7, 'black', { remainingOwnerTurns: 6 }));

    const context = build({ markers });
    const protectedMarker = markers.find((entry) => entry.data.type === 'PROTECTED');
    expect(protectedMarker).toBeTruthy();

    expect(context.protectedStones).toEqual([
      expect.objectContaining({
        row: protectedMarker.row,
        col: protectedMarker.col,
        owner: protectedMarker.owner
      })
    ]);
    expect(context.permaProtectedStones).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ row: protectedMarker.row, col: protectedMarker.col })
    ]));

    for (const type of protectedTypes.filter((entry) => entry !== 'PROTECTED')) {
      const original = markers.find((entry) => entry.data.type === type);
      expect(context.permaProtectedStones).toEqual(expect.arrayContaining([
        { row: original.row, col: original.col, owner: Shared.WHITE }
      ]));
    }
    expect(context.permaProtectedStones).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 7, col: 6 }),
      expect.objectContaining({ row: 7, col: 7 })
    ]));
  });

  test('keeps frozen/blocking context explicit and separate from registry flip protection', () => {
    const cardState = {
      markers: [
        marker('FREEZE', 3, 4, 'white', { remainingOwnerTurns: 5 }),
        marker('BLOCKADE', 2, 2, 'black', { remainingOwnerTurns: 3 }),
        marker('METEOR_HOLE', 5, 5, 'black', { remainingOwnerTurns: 4 })
      ]
    };

    const context = build(cardState, {
      getBlockingMarkers: (state: any) => state.markers.filter((entry: any) => (
        ['FREEZE', 'BLOCKADE', 'METEOR_HOLE'].includes(entry.data.type)
      )),
      isFrozenCellForCard: (_state: any, row: number, col: number) => row === 3 && col === 4
    });

    expect(context.cardState).toBe(cardState);
    expect(context.permaProtectedStones).toEqual(expect.arrayContaining([
      { row: 3, col: 4, owner: Shared.WHITE }
    ]));
    expect(context.blockedCells).toEqual([
      { row: 3, col: 4, type: 'FREEZE', remainingOwnerTurns: 5, owner: 'white' },
      { row: 2, col: 2, type: 'BLOCKADE', remainingOwnerTurns: 3, owner: 'black' },
      { row: 5, col: 5, type: 'METEOR_HOLE', remainingOwnerTurns: 4, owner: 'black' }
    ]);
  });

  test('carries bomb and manifest context when the caller supplies manifest markers', () => {
    const bomb = marker('TIME_BOMB', 5, 5, 'black', { category: 'bomb', remainingTurns: 2, placedTurn: 7 });
    const manifest = {
      id: 'manifest-observer',
      kind: 'manifestStone',
      row: 6,
      col: 6,
      owner: 'black',
      data: { type: 'OBSERVER_WILL' }
    };
    const cardState = { markers: [bomb, manifest] };

    const context = build(cardState, {
      getSpecialMarkers: (state: any) => state.markers.filter((entry: any) => entry.kind === 'specialStone'),
      getManifestMarkers: (state: any) => state.markers.filter((entry: any) => entry.kind === 'manifestStone'),
      getBombMarkers: (state: any) => state.markers.filter((entry: any) => entry.data && entry.data.category === 'bomb')
    });

    expect(context.inviolableStones).toEqual(expect.arrayContaining([
      { row: 6, col: 6, owner: Shared.BLACK }
    ]));
    expect(context.permaProtectedStones).toEqual(expect.arrayContaining([
      { row: 6, col: 6, owner: Shared.BLACK }
    ]));
    expect(context.bombs).toEqual([
      expect.objectContaining({ row: 5, col: 5, owner: 'black', remainingTurns: 2, placedTurn: 7 })
    ]);
  });

  test('requires the shared special stone registry instead of silently degrading', () => {
    expect(() => ProtectionContext.buildCardProtectionContext({ markers: [] }, { constants: Shared }))
      .toThrow('[protection-context] SpecialStoneRegistry.getSpecialStoneInfo required');
  });
});
