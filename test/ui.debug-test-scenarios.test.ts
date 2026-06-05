const DebugTestScenarios = require('../ui/debug-test-scenarios.js');

describe('debug test scenarios', () => {
  test('requires debug query before resolving observer will scenario', () => {
    expect(DebugTestScenarios.resolveDebugTestScenarioFromQuery('?testScenario=observer_will_ready')).toBe(null);
    expect(DebugTestScenarios.resolveDebugTestScenarioFromQuery('?debug=1&testScenario=observer_will_ready')).toBe('observer_will_ready');
    expect(DebugTestScenarios.resolveDebugTestScenarioFromQuery('?debug=true&testScenario=observer_will_ready')).toBe('observer_will_ready');
    expect(DebugTestScenarios.resolveDebugTestScenarioFromQuery('?debug=1&testScenario=theory_incarnation_ready')).toBe('theory_incarnation_ready');
  });

  test('observer_will_ready prepares a local state that satisfies the 18 turn usage condition', () => {
    const gameState: any = {
      currentPlayer: -1,
      turnNumber: 0,
      consecutivePasses: 1,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    const cardState: any = {
      hands: { black: ['silver_stone'], white: [] },
      decks: { black: ['destroy_01'], white: ['guard_01'] },
      charge: { black: 0, white: 0 },
      pendingEffectByPlayer: { black: { type: 'DUMMY' }, white: { type: 'DUMMY' } },
      hasUsedCardThisTurnByPlayer: { black: true, white: true },
      markers: [{ kind: 'manifestStone', row: 0, col: 0, owner: 'black', data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 4 } }],
      turnIndex: 0
    };

    const result = DebugTestScenarios.applyDebugTestScenarioAfterReset({
      scenarioId: 'observer_will_ready',
      gameState,
      cardState
    });

    expect(result).toEqual(expect.objectContaining({
      applied: true,
      scenarioId: 'observer_will_ready'
    }));
    expect(gameState.currentPlayer).toBe(1);
    expect(gameState.turnNumber).toBeGreaterThanOrEqual(18);
    expect(gameState.consecutivePasses).toBe(0);
    expect(cardState.turnIndex).toBeGreaterThanOrEqual(18);
    expect(cardState.charge.black).toBeGreaterThanOrEqual(99);
    expect(cardState.hands.black).toContain('observer_will_01');
    expect(cardState.hands.white).toEqual(['rebuild_01', 'gold_stone', 'silver_stone']);
    expect(cardState.pendingEffectByPlayer).toEqual({ black: null, white: null });
    expect(cardState.hasUsedCardThisTurnByPlayer).toEqual({ black: false, white: false });
    expect(cardState.markers).toEqual([]);
    expect(cardState.selectedCardId).toBe('observer_will_01');
    expect(cardState.selectedCardOwnerKey).toBe('black');
    expect(cardState._handCopyIdsByPlayer.black).toHaveLength(cardState.hands.black.length);
    expect(cardState._handCopyIdsByPlayer.white).toHaveLength(cardState.hands.white.length);
  });

  test('theory_incarnation_ready prepares a local state that satisfies the number cell total condition', () => {
    const gameState: any = {
      currentPlayer: -1,
      turnNumber: 0,
      consecutivePasses: 1,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    const cardState: any = {
      hands: { black: ['silver_stone'], white: ['guard_01'] },
      decks: { black: ['destroy_01'], white: ['guard_01'] },
      charge: { black: 0, white: 0 },
      pendingEffectByPlayer: { black: { type: 'DUMMY' }, white: { type: 'DUMMY' } },
      hasUsedCardThisTurnByPlayer: { black: true, white: true },
      markers: [{ kind: 'manifestStone', row: 0, col: 0, owner: 'black', data: { type: 'THEORY_INCARNATION', remainingOwnerTurns: 3 } }],
      numberCellCollectedTotalByPlayer: { black: 3, white: 2 }
    };

    const result = DebugTestScenarios.applyDebugTestScenarioAfterReset({
      scenarioId: 'theory_incarnation_ready',
      gameState,
      cardState
    });

    expect(result).toEqual(expect.objectContaining({
      applied: true,
      scenarioId: 'theory_incarnation_ready'
    }));
    expect(gameState.currentPlayer).toBe(1);
    expect(gameState.consecutivePasses).toBe(0);
    expect(cardState.hands.black).toEqual(['theory_incarnation_01']);
    expect(cardState.hands.white).toEqual([]);
    expect(cardState.charge.black).toBeGreaterThanOrEqual(99);
    expect(cardState.numberCellCollectedTotalByPlayer.black).toBe(42);
    expect(cardState.pendingEffectByPlayer).toEqual({ black: null, white: null });
    expect(cardState.hasUsedCardThisTurnByPlayer).toEqual({ black: false, white: false });
    expect(cardState.markers).toEqual([]);
    expect(cardState.selectedCardId).toBe('theory_incarnation_01');
    expect(cardState.selectedCardOwnerKey).toBe('black');
    expect(cardState.theoryIncarnationStateByPlayer).toEqual({ black: null, white: null });
    expect(cardState.theoryNumberCellByCell).toEqual({});
  });
});
