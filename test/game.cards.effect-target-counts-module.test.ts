import { createEffectTargetCounts } from '../game/logic/cards-internal/effect-target-counts.js';
import * as SpecialStoneRegistry from '../shared/special-stone-registry.js';

describe('card effect target counts module', () => {
  test('collectSpecialStoneEffectTargets classifies targets and groups duplicate cells without mutating order', () => {
    const work = { row: 2, col: 2, data: { type: 'WORK' } };
    const trap = { row: 2, col: 2, data: { type: 'TRAP', hidden: true } };
    const invalid = { row: null, col: 4, data: { type: 'GHOST' } };
    const bomb = { row: 3, col: 3, data: { type: 'TIME_BOMB', category: 'bomb' } };
    const counts = createEffectTargetCounts({
      ensureMarkers: jest.fn(),
      getSpecialMarkers: () => ([
        work,
        { row: 1, col: 1, data: { type: 'GUARD' } },
        trap,
        { row: 4, col: 4, data: { type: 'FREEZE' } },
        invalid
      ]),
      getBombMarkers: () => ([bomb, bomb]),
      getMarkerRuleClass: (marker) => SpecialStoneRegistry.classifyMarkerRuleClass(marker)
    });

    const result = counts.collectSpecialStoneEffectTargets({ markers: [] });

    expect(result.markers).toEqual([work, trap, invalid, bomb]);
    expect(result.specialMarkers).toEqual([work, trap, invalid]);
    expect(result.bombMarkers).toEqual([bomb]);
    expect(result.cells).toEqual([
      { row: 2, col: 2, markers: [work, trap] },
      { row: 3, col: 3, markers: [bomb] }
    ]);
  });

  test('collectLossWillRemovals excludes guarded cells, meteor holes, and inviolable bombs', () => {
    const counts = createEffectTargetCounts({
      ensureMarkers: jest.fn(),
      getSpecialMarkers: () => ([
        { row: 1, col: 1, data: { type: 'GUARD' } },
        { row: 1, col: 1, data: { type: 'WORK' } },
        { row: 2, col: 2, data: { type: 'WORK' } },
        { row: 2, col: 5, data: { type: 'PROTECTED' } },
        { row: 2, col: 6, data: { type: 'PERMA_PROTECTED' } },
        { row: 2, col: 4, data: { type: 'GHOST', remainingOwnerTurns: 5 } },
        { row: 3, col: 3, data: { type: 'METEOR_HOLE' } },
        { row: 6, col: 6, data: { type: 'BLOCKADE', remainingOwnerTurns: 2 } }
      ]),
      getBombMarkers: () => ([
        { row: 2, col: 3, data: { type: 'TIME_BOMB' } },
        { row: 5, col: 5, data: { type: 'TIME_BOMB' } }
      ]),
      getMarkerRuleClass: (marker) => SpecialStoneRegistry.classifyMarkerRuleClass(marker),
      isInviolableCell: (_cardState, row, col) => row === 5 && col === 5
    });

    const result = counts.collectLossWillRemovals({ markers: [] });
    expect(Array.from(result.guardedCells)).toEqual(['1,1']);
    expect(result.removableSpecials).toHaveLength(4);
    expect(result.removableBombs).toHaveLength(1);
    expect(result.removed).toEqual([
      { row: 2, col: 2, owner: null, type: 'WORK' },
      { row: 2, col: 5, owner: null, type: 'PROTECTED' },
      { row: 2, col: 6, owner: null, type: 'PERMA_PROTECTED' },
      { row: 2, col: 4, owner: null, type: 'GHOST' },
      { row: 2, col: 3, owner: null, type: 'TIME_BOMB' }
    ]);
    expect(counts.getLossWillRemovableCount({ markers: [] })).toBe(5);
  });

  test('mass freeze distinguishes visible usability targets from canonical hidden-trap resolution targets', () => {
    const hiddenOpponentTrap = { row: 2, col: 2, owner: 'white', data: { type: 'TRAP', hidden: true } };
    const visibleWork = { row: 3, col: 3, owner: 'white', data: { type: 'WORK' } };
    const frozenWork = { row: 4, col: 4, owner: 'black', data: { type: 'WORK' } };
    const inviolableBomb = { row: 5, col: 5, owner: 'white', data: { type: 'TIME_BOMB', category: 'bomb' } };
    const counts = createEffectTargetCounts({
      getSpecialMarkers: () => ([hiddenOpponentTrap, visibleWork, frozenWork]),
      getBombMarkers: () => ([inviolableBomb]),
      getMarkerRuleClass: (marker) => SpecialStoneRegistry.classifyMarkerRuleClass(marker),
      isFrozenCellForCard: (_cardState, row, col) => row === 4 && col === 4,
      findManifestMarkerAt: (_cardState, row, col) => row === 5 && col === 5 ? { data: { type: 'THEORY_INCARNATION' } } : null,
      hasBoardShapeCellForCard: (_cardState, _gameState, row, col) => row >= 0 && col >= 0
    });

    expect(counts.collectMassFreezeWillTargets({}, {}, 'black')).toEqual([
      { row: 3, col: 3, markers: [visibleWork] }
    ]);
    expect(counts.getMassFreezeWillTargetCount({}, {}, 'black')).toBe(1);
    expect(counts.collectMassFreezeWillTargets({}, {}, 'black', { includeHiddenOpponentTraps: true })).toEqual([
      { row: 2, col: 2, markers: [hiddenOpponentTrap] },
      { row: 3, col: 3, markers: [visibleWork] }
    ]);
  });

  test('own hidden trap remains a visible usability target for its owner', () => {
    const ownTrap = { row: 1, col: 6, owner: 'black', data: { type: 'TRAP', hidden: true } };
    const counts = createEffectTargetCounts({
      getSpecialMarkers: () => ([ownTrap]),
      getBombMarkers: () => ([]),
      getMarkerRuleClass: (marker) => SpecialStoneRegistry.classifyMarkerRuleClass(marker)
    });

    expect(counts.getMassFreezeWillTargetCount({}, {}, 'black')).toBe(1);
    expect(counts.getMassFreezeWillTargetCount({}, {}, 'white')).toBe(0);
  });

  test('getSalvationWillTargetCount and getExecutionWillTargetCount read the per-player ledger', () => {
    const counts = createEffectTargetCounts({
      ensureSalvationDestroyedLedger: () => ({
        black: [
          { owner: 'black' },
          { owner: 'white' },
          { owner: 'black' }
        ],
        white: [{ owner: 'white' }]
      })
    });

    expect(counts.getSalvationWillTargetCount({}, 'black')).toBe(3);
    expect(counts.getSalvationWillTargetCount({}, 'white')).toBe(1);
    expect(counts.getExecutionWillTargetCount({}, 'black')).toBe(2);
    expect(counts.getExecutionWillTargetCount({}, 'white')).toBe(1);
  });
});
