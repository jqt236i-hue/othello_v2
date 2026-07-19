const EffectBounds = require('../ui/board-visual/effect-bounds');
const PlaybackTypes = require('../ui/board-visual/playback-types');

describe('board visual effect bounds manifest', () => {
  test('covers the Phase 0 visual families and keeps cross-surface effects global', () => {
    const inventory = EffectBounds.PHASE0_PRESENTATION_EFFECT_FAMILY_INVENTORY;
    expect(Object.keys(inventory)).toEqual([
      'PLACE',
      'FLIP',
      'DESTROY',
      'SPAWN',
      'MOVE',
      'STATUS',
      'BOARD_EXPANSION',
      'BOARD_SHRINK',
      'THEORY_INCARNATION',
      'OBSERVER_WILL',
      'MANIFEST'
    ]);

    for (const family of Object.values(inventory).flat() as string[]) {
      expect(EffectBounds.getBoardVisualEffectBounds(family).family).toBe(family);
    }

    const knownConcreteEventTypes = [
      ...PlaybackTypes.BOARD_PLAYBACK_EVENT_TYPES,
      ...PlaybackTypes.GLOBAL_PRESENTATION_EVENT_TYPES,
      'manifest_ending'
    ].sort();
    expect(Object.keys(EffectBounds.PRESENTATION_EVENT_EFFECT_FAMILY_INVENTORY).sort()).toEqual(
      knownConcreteEventTypes
    );
    for (const families of Object.values(EffectBounds.PRESENTATION_EVENT_EFFECT_FAMILY_INVENTORY) as string[][]) {
      for (const family of families) {
        expect(EffectBounds.getBoardVisualEffectBounds(family).family).toBe(family);
      }
    }

    expect(EffectBounds.GLOBAL_DOM_EFFECT_FAMILIES).toEqual([
      'observer_bubble',
      'cross-surface-trajectory',
      'source-to-board',
      'fullscreen'
    ]);
    for (const family of EffectBounds.GLOBAL_DOM_EFFECT_FAMILIES) {
      expect(EffectBounds.getBoardVisualEffectBounds(family)).toMatchObject({
        family,
        route: 'global-dom',
        extentCells: {
          top: 'unbounded',
          right: 'unbounded',
          bottom: 'unbounded',
          left: 'unbounded'
        }
      });
    }
  });

  test('all board-local edges are explicit and at most two cells without clamping', () => {
    let observedTwoCellFamily = false;
    for (const family of EffectBounds.BOARD_LOCAL_EFFECT_FAMILIES) {
      const entry = EffectBounds.getBoardVisualEffectBounds(family);
      expect(entry.route).toBe('board-local');
      expect(Object.keys(entry.extentCells).sort()).toEqual(['bottom', 'left', 'right', 'top']);
      for (const extent of Object.values(entry.extentCells) as number[]) {
        expect(Number.isFinite(extent)).toBe(true);
        expect(extent).toBeGreaterThanOrEqual(0);
        expect(extent).toBeLessThanOrEqual(2);
        if (extent === 2) observedTwoCellFamily = true;
      }
    }
    expect(observedTwoCellFamily).toBe(true);
    expect(EffectBounds.getMaxBoardLocalEffectGutterCells()).toEqual({
      top: 2,
      right: 2,
      bottom: 2,
      left: 2
    });
    expect(EffectBounds.getBoardVisualEffectBounds('board-source-trajectory')).toEqual({
      family: 'board-source-trajectory',
      route: 'board-local',
      extentCells: { top: 2, right: 2, bottom: 2, left: 2 }
    });
    expect(EffectBounds.PRESENTATION_EVENT_EFFECT_FAMILY_INVENTORY.destroy).toEqual([
      'destroy',
      'board-source-trajectory'
    ]);
    expect(EffectBounds.PRESENTATION_EVENT_EFFECT_FAMILY_INVENTORY.place_hand_animation).toEqual([
      'cross-surface-trajectory'
    ]);
  });

  test('unknown families and invalid bounds fail explicitly', () => {
    expect(() => EffectBounds.getBoardVisualEffectBounds('not-in-inventory')).toThrow(
      expect.objectContaining({ code: 'unknown_effect_family', family: 'not-in-inventory' })
    );
    expect(() => EffectBounds.validateBoardVisualEffectBoundsManifest({
      oversized: {
        route: 'board-local',
        extentCells: { top: 2.01, right: 0, bottom: 0, left: 0 }
      }
    })).toThrow(expect.objectContaining({ code: 'invalid_effect_bounds_manifest', family: 'oversized' }));
    expect(() => EffectBounds.validateBoardVisualEffectBoundsManifest({
      silent_clamp_candidate: {
        route: 'board-local',
        extentCells: { top: -1, right: 0, bottom: 0, left: 0 }
      }
    })).toThrow(expect.objectContaining({ code: 'invalid_effect_bounds_manifest', family: 'silent_clamp_candidate' }));
    expect(() => EffectBounds.validateBoardVisualEffectBoundsManifest({
      missing_edge: {
        route: 'board-local',
        extentCells: { top: 1, right: 1, bottom: 1 }
      }
    })).toThrow(expect.objectContaining({ code: 'invalid_effect_bounds_manifest', family: 'missing_edge' }));
    expect(() => EffectBounds.getBoardVisualEffectMaterializationGutter(['observer_bubble'])).toThrow(
      expect.objectContaining({ code: 'global_effect_not_materializable', family: 'observer_bubble' })
    );
  });

  test.each([
    ['top-left', { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 }, { minRow: -2, maxRow: 2, minCol: -2, maxCol: 2 }],
    ['top-right', { minRow: 0, maxRow: 0, minCol: 7, maxCol: 7 }, { minRow: -2, maxRow: 2, minCol: 5, maxCol: 9 }],
    ['bottom-right', { minRow: 7, maxRow: 7, minCol: 7, maxCol: 7 }, { minRow: 5, maxRow: 9, minCol: 5, maxCol: 9 }],
    ['bottom-left', { minRow: 7, maxRow: 7, minCol: 0, maxCol: 0 }, { minRow: 5, maxRow: 9, minCol: -2, maxCol: 2 }]
  ])('materializes the %s corner without dropping any edge gutter', (_name, source, expected) => {
    expect(EffectBounds.expandBoardVisualEffectMaterializationBounds(source, ['destroy'])).toEqual(expected);
  });

  test.each([
    ['top', { minRow: 0, maxRow: 0, minCol: 3, maxCol: 4 }, { minRow: -2, maxRow: 2, minCol: 1, maxCol: 6 }],
    ['right', { minRow: 3, maxRow: 4, minCol: 7, maxCol: 7 }, { minRow: 1, maxRow: 6, minCol: 5, maxCol: 9 }],
    ['bottom', { minRow: 7, maxRow: 7, minCol: 3, maxCol: 4 }, { minRow: 5, maxRow: 9, minCol: 1, maxCol: 6 }],
    ['left', { minRow: 3, maxRow: 4, minCol: 0, maxCol: 0 }, { minRow: 1, maxRow: 6, minCol: -2, maxCol: 2 }]
  ])('materializes the %s edge without clipping', (_name, source, expected) => {
    expect(EffectBounds.expandBoardVisualEffectMaterializationBounds(source, ['destroy'])).toEqual(expected);
  });

  test('materializes all four corners and four edges for every board-local effect family', () => {
    const placements = [
      { name: 'top-left', source: { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 } },
      { name: 'top-right', source: { minRow: 0, maxRow: 0, minCol: 7, maxCol: 7 } },
      { name: 'bottom-right', source: { minRow: 7, maxRow: 7, minCol: 7, maxCol: 7 } },
      { name: 'bottom-left', source: { minRow: 7, maxRow: 7, minCol: 0, maxCol: 0 } },
      { name: 'top', source: { minRow: 0, maxRow: 0, minCol: 3, maxCol: 4 } },
      { name: 'right', source: { minRow: 3, maxRow: 4, minCol: 7, maxCol: 7 } },
      { name: 'bottom', source: { minRow: 7, maxRow: 7, minCol: 3, maxCol: 4 } },
      { name: 'left', source: { minRow: 3, maxRow: 4, minCol: 0, maxCol: 0 } }
    ];

    for (const family of EffectBounds.BOARD_LOCAL_EFFECT_FAMILIES as string[]) {
      const extent = EffectBounds.getBoardVisualEffectMaterializationGutter([family]);
      for (const placement of placements) {
        const expanded = EffectBounds.expandBoardVisualEffectMaterializationBounds(
          placement.source,
          [family]
        );
        expect({ family, placement: placement.name, expanded }).toEqual({
          family,
          placement: placement.name,
          expanded: {
            minRow: placement.source.minRow - extent.top,
            maxRow: placement.source.maxRow + extent.bottom,
            minCol: placement.source.minCol - extent.left,
            maxCol: placement.source.maxCol + extent.right
          }
        });
      }
    }
  });

  test('ceil-composes fractional per-edge extents for the viewport materializer', () => {
    expect(EffectBounds.getBoardVisualEffectMaterializationGutter([
      'place',
      'theory_incarnation_spawn_roulette'
    ])).toEqual({ top: 2, right: 2, bottom: 2, left: 2 });
    expect(EffectBounds.getBoardVisualEffectMaterializationGutter([])).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    });
  });
});
