import { createEffectTargetCounts } from '../game/logic/cards-internal/effect-target-counts.js';

describe('card effect target counts module', () => {
  test('collectLossWillRemovals excludes guarded cells, meteor holes, and absolute-protected bombs', () => {
    const counts = createEffectTargetCounts({
      ensureMarkers: jest.fn(),
      getSpecialMarkers: () => ([
        { row: 1, col: 1, data: { type: 'GUARD' } },
        { row: 1, col: 1, data: { type: 'WORK' } },
        { row: 2, col: 2, data: { type: 'WORK' } },
        { row: 3, col: 3, data: { type: 'METEOR_HOLE' } },
        { row: 4, col: 4, data: { type: 'ABSOLUTE_PROTECTED' } }
      ]),
      getBombMarkers: () => ([
        { row: 2, col: 3, data: { type: 'TIME_BOMB' } },
        { row: 5, col: 5, data: { type: 'TIME_BOMB' } }
      ]),
      isAbsoluteProtectedCell: (_cardState, row, col) => row === 5 && col === 5
    });

    const result = counts.collectLossWillRemovals({ markers: [] });
    expect(Array.from(result.guardedCells)).toEqual(['1,1']);
    expect(result.removableSpecials).toHaveLength(1);
    expect(result.removableBombs).toHaveLength(1);
    expect(result.removed).toEqual([
      { row: 2, col: 2, owner: null, type: 'WORK' },
      { row: 2, col: 3, owner: null, type: 'TIME_BOMB' }
    ]);
    expect(counts.getLossWillRemovableCount({ markers: [] })).toBe(2);
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
