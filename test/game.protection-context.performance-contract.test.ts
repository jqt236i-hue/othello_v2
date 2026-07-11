const Markers = require('../game/logic/cards/markers.js');
const ProtectionContext = require('../game/logic/cards-internal/protection-context.js');
const Shared = require('../shared-constants.js');
const SpecialStoneRegistry = require('../shared/special-stone-registry.js');
const ManifestStoneRegistry = require('../shared/manifest-stone-registry.js');

function legacyProtectionContext(cardState) {
  const specials = Markers.getSpecialMarkers(cardState);
  const manifests = Markers.getManifestMarkers(cardState);
  const ownerValue = (owner) => owner === 'black' ? Shared.BLACK : (owner === 'white' ? Shared.WHITE : owner);
  return {
    protectedStones: specials
      .filter((entry) => String(entry && entry.data && entry.data.type || '').toUpperCase() === 'PROTECTED')
      .map((entry) => ({ row: entry.row, col: entry.col, owner: entry.owner })),
    inviolableStones: manifests.map((entry) => ({ row: entry.row, col: entry.col, owner: ownerValue(entry.owner) })),
    permaProtectedStones: specials
      .filter((entry) => {
        const type = String(entry && entry.data && entry.data.type || '').toUpperCase();
        if (type && type !== 'PROTECTED') {
          const info = SpecialStoneRegistry.getSpecialStoneInfo(type);
          if (info && info.flipProtected === true) return true;
        }
        return type === 'FREEZE' || Markers.isFrozenCellForCard(cardState, entry.row, entry.col);
      })
      .concat(manifests)
      .map((entry) => ({ row: entry.row, col: entry.col, owner: ownerValue(entry.owner) })),
    bombs: Markers.getBombMarkers(cardState).map((entry) => ({
      row: entry.row,
      col: entry.col,
      remainingTurns: entry.data ? entry.data.remainingTurns : undefined,
      owner: entry.owner,
      placedTurn: entry.data ? entry.data.placedTurn : undefined,
      createdSeq: entry.createdSeq
    })),
    blockedCells: Markers.getBlockingMarkers(cardState).map((entry) => ({
      row: entry.row,
      col: entry.col,
      type: entry.data ? entry.data.type : null,
      remainingOwnerTurns: entry.data ? entry.data.remainingOwnerTurns : undefined,
      owner: entry.owner
    }))
  };
}

function buildIndexed(cardState, onMarkerVisited = () => {}) {
  return ProtectionContext.buildCardProtectionContext(cardState, {
    constants: Shared,
    SpecialStoneRegistry,
    ManifestStoneRegistry,
    createMarkerContextIndex: (state, options) => Markers.createMarkerContextIndex(state, { ...options, onMarkerVisited })
  });
}

describe('marker context performance contract', () => {
  test('visits each canonical marker exactly once and preserves source order and identity', () => {
    const markers = Array.from({ length: 20 }, (_, index) => ({
      id: `marker-${index}`,
      kind: 'specialStone',
      row: Math.floor(index / 8),
      col: index % 8,
      owner: index % 2 === 0 ? 'black' : 'white',
      data: {
        type: index % 5 === 0 ? 'FREEZE' : (index % 3 === 0 ? 'TIME_BOMB' : 'PROTECTED'),
        ...(index % 3 === 0 ? { category: 'bomb', remainingTurns: 2 } : {})
      }
    }));
    const visited: any[] = [];

    const context = Markers.createMarkerContextIndex({ markers }, {
      onMarkerVisited: (marker, index) => visited.push([marker, index])
    });

    expect(context.scanCount).toBe(20);
    expect(visited).toHaveLength(20);
    expect(visited.map(([, index]) => index)).toEqual(Array.from({ length: 20 }, (_, index) => index));
    expect(context.specialMarkers.every((marker) => markers.includes(marker))).toBe(true);
    expect(context.bombMarkers.every((marker) => markers.includes(marker))).toBe(true);
    expect(context.blockingMarkers.every((marker) => markers.includes(marker))).toBe(true);
    expect(markers.map((marker) => marker.id)).toEqual(Array.from({ length: 20 }, (_, index) => `marker-${index}`));
  });

  test('builds protection context with one marker scan and no per-special frozen scan', () => {
    const markers = Array.from({ length: 20 }, (_, index) => ({
      id: index + 1,
      kind: 'specialStone',
      row: Math.floor(index / 8),
      col: index % 8,
      owner: index % 2 === 0 ? 'black' : 'white',
      data: { type: index === 19 ? 'FREEZE' : 'PROTECTED', remainingOwnerTurns: 3 }
    }));
    const visits = jest.fn();
    const frozenOracle = jest.fn(() => true);

    const result = ProtectionContext.buildCardProtectionContext({ markers }, {
      constants: Shared,
      SpecialStoneRegistry,
      ManifestStoneRegistry,
      createMarkerContextIndex: (state, options) => Markers.createMarkerContextIndex(state, { ...options, onMarkerVisited: visits }),
      isFrozenCellForCard: frozenOracle
    });

    expect(visits).toHaveBeenCalledTimes(20);
    expect(frozenOracle).not.toHaveBeenCalled();
    expect(result.protectedStones).toHaveLength(19);
    expect(result.permaProtectedStones).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 2, col: 3 })
    ]));
  });

  test('matches the legacy oracle across deterministic mixed marker matrices', () => {
    const types = ['PROTECTED', 'PERMA_PROTECTED', 'FREEZE', 'BLOCKADE', 'METEOR_HOLE', 'TIME_BOMB', 'GUARD', 'GHOST'];
    for (let matrix = 0; matrix < 40; matrix += 1) {
      const markers = Array.from({ length: 24 }, (_, index) => {
        const type = types[(matrix * 7 + index * 3) % types.length];
        const manifest = index === 23 && matrix % 3 === 0;
        return {
          id: `${matrix}-${index}`,
          kind: manifest ? 'manifestStone' : 'specialStone',
          row: (matrix + index * 5) % 8,
          col: (matrix * 3 + index * 7) % 8,
          owner: (matrix + index) % 2 === 0 ? 'black' : 'white',
          createdSeq: index + 1,
          data: manifest
            ? { type: 'OBSERVER_WILL', remainingOwnerTurns: 3 }
            : {
                type,
                ...(type === 'TIME_BOMB' ? { category: 'bomb', remainingTurns: 2, placedTurn: matrix } : {}),
                ...(!['TIME_BOMB', 'PERMA_PROTECTED'].includes(type) ? { remainingOwnerTurns: 3 } : {})
              }
        };
      });
      const cardState = { markers };
      expect(buildIndexed(cardState)).toEqual(legacyProtectionContext(cardState));
    }
  });
});
