const DestroyOutcomeContract = require('../shared/destroy-outcome-contract');

describe('DestroyOutcomeContract', () => {
  test('normalizes regenerated outcomes and treats them as resolved', () => {
    const out = DestroyOutcomeContract.createDestroyOutcome(
      DestroyOutcomeContract.DESTROY_OUTCOME_KINDS.REGENERATED,
      {
        reason: 'regen_triggered',
        row: 3,
        col: 3,
        owner: 'black',
        remaining: 2
      }
    );

    expect(out).toMatchObject({
      kind: 'regenerated',
      destroyed: false,
      regenerated: true,
      evaded: false,
      blockedByGhost: false,
      proliferated: false,
      reason: 'regen_triggered',
      row: 3,
      col: 3,
      owner: 'black',
      remaining: 2
    });
    expect(DestroyOutcomeContract.isDestroyOutcomeResolved(out)).toBe(true);
  });

  test('normalizes proliferated outcomes with kind and aliases', () => {
    const out = DestroyOutcomeContract.createDestroyOutcome(
      DestroyOutcomeContract.DESTROY_OUTCOME_KINDS.PROLIFERATED,
      {
        reason: 'proliferation_triggered',
        from: { row: 3, col: 3 },
        to: { row: 2, col: 2 }
      }
    );

    expect(out).toMatchObject({
      kind: 'proliferated',
      destroyed: false,
      evaded: false,
      blockedByGhost: false,
      proliferated: true,
      reason: 'proliferation_triggered',
      from: { row: 3, col: 3 },
      to: { row: 2, col: 2 },
      source: { row: 3, col: 3 },
      destination: { row: 2, col: 2 }
    });
  });

  test('derives outcome kind and resolved state from legacy flags', () => {
    expect(DestroyOutcomeContract.getDestroyOutcomeKind({ regenerated: true })).toBe('regenerated');
    expect(DestroyOutcomeContract.getDestroyOutcomeKind({ blockedByGhost: true })).toBe('ghost_blocked');
    expect(DestroyOutcomeContract.getDestroyOutcomeKind({ evaded: true })).toBe('evaded_move');
    expect(DestroyOutcomeContract.getDestroyOutcomeKind({ destroyed: true })).toBe('destroyed');
    expect(DestroyOutcomeContract.isDestroyOutcomeResolved({ regenerated: true })).toBe(true);
    expect(DestroyOutcomeContract.isDestroyOutcomeResolved({ proliferated: true })).toBe(true);
    expect(DestroyOutcomeContract.isDestroyOutcomeResolved({ destroyed: false })).toBe(false);
  });
});
