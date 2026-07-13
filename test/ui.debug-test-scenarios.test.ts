const DebugTestScenarios = require('../ui/debug-test-scenarios.js');
const CardLogic = require('../game/logic/cards.js');

describe('debug test scenarios', () => {
  test('requires debug query before resolving observer will scenario', () => {
    expect(DebugTestScenarios.resolveDebugTestScenarioFromQuery('?testScenario=observer_will_ready')).toBe(null);
    expect(DebugTestScenarios.resolveDebugTestScenarioFromQuery('?debug=1&testScenario=observer_will_ready')).toBe('observer_will_ready');
    expect(DebugTestScenarios.resolveDebugTestScenarioFromQuery('?debug=true&testScenario=observer_will_ready')).toBe('observer_will_ready');
    expect(DebugTestScenarios.resolveDebugTestScenarioFromQuery('?debug=1&testScenario=theory_incarnation_ready')).toBe('theory_incarnation_ready');
    expect(DebugTestScenarios.resolveDebugTestScenarioFromQuery('?debug=1&testScenario=theory_incarnation_spawn_ready')).toBe('theory_incarnation_spawn_ready');
    expect(DebugTestScenarios.resolveDebugTestScenarioFromQuery('?debug=1&test-scenario=theory-incarnation-spawn-ready')).toBe('theory_incarnation_spawn_ready');
    expect(DebugTestScenarios.resolveDebugTestScenarioFromQuery('?debug=1&testScenario=special_cards_ready')).toBe('special_cards_ready');
    expect(DebugTestScenarios.resolveDebugTestScenarioFromQuery('?debug=1&test-scenario=special-cards-ready')).toBe('special_cards_ready');
  });

  test('special debug query resolves the special cards ready scenario without debug query', () => {
    expect(DebugTestScenarios.resolveDebugTestScenarioFromQuery('?specialDebug=1')).toBe('special_cards_ready');
    expect(DebugTestScenarios.resolveDebugTestScenarioFromQuery('?special-debug=1')).toBe('special_cards_ready');
    expect(DebugTestScenarios.resolveDebugTestScenarioFromQuery('?specialDebug=true')).toBe('special_cards_ready');
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

  test('theory_incarnation_spawn_ready prepares a local state for the next placement spawn', () => {
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
      markers: [],
      numberCellCollectedTotalByPlayer: { black: 3, white: 2 }
    };

    const result = DebugTestScenarios.applyDebugTestScenarioAfterReset({
      scenarioId: 'theory_incarnation_spawn_ready',
      gameState,
      cardState
    });

    expect(result).toEqual(expect.objectContaining({
      applied: true,
      scenarioId: 'theory_incarnation_spawn_ready'
    }));
    expect(result).not.toHaveProperty('runTurnStartPlayer');
    expect(gameState.currentPlayer).toBe(1);
    expect(gameState.board[2][3]).toBe(1);
    expect(cardState.hands.black).toEqual([]);
    expect(cardState.markers).toEqual([
      expect.objectContaining({
        kind: 'specialStone',
        row: 2,
        col: 3,
        owner: 'black',
        data: expect.objectContaining({ type: 'THEORY_INCARNATION', remainingOwnerTurns: 3 })
      })
    ]);
    expect(cardState.lastTurnStartedFor).toBe(null);
    expect(cardState.theoryIncarnationStateByPlayer.black).toEqual(expect.objectContaining({
      sessionId: 'debug_theory_spawn_black',
      ownerKey: 'black',
      remainingSpawnCount: 3
    }));
    expect(Object.keys(cardState.theoryNumberCellsBySession.debug_theory_spawn_black.cells)).toHaveLength(5);
    expect(cardState.theoryNumberCellByCell['0,0']).toEqual({ sessionId: 'debug_theory_spawn_black', ownerKey: 'black' });
  });

  test('special_cards_ready prepares a local starting state with all three special cards usable', () => {
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
      markers: [{ kind: 'manifestStone', row: 0, col: 0, owner: 'black', data: { type: 'OBSERVER_WILL' } }],
      turnIndex: 0,
      numberCellCollectedTotalByPlayer: { black: 3, white: 2 }
    };

    const result = DebugTestScenarios.applyDebugTestScenarioAfterReset({
      scenarioId: 'special_cards_ready',
      gameState,
      cardState
    });

    expect(result).toEqual(expect.objectContaining({
      applied: true,
      scenarioId: 'special_cards_ready'
    }));
    expect(gameState.currentPlayer).toBe(1);
    expect(gameState.turnNumber).toBeGreaterThanOrEqual(18);
    expect(gameState.board[2][3]).toBe(1);
    expect(gameState.board[2][4]).toBe(-1);
    expect(gameState.board[3][5]).toBe(-1);
    expect(cardState.turnIndex).toBeGreaterThanOrEqual(18);
    expect(cardState.hands.black).toEqual([
      'theory_incarnation_01',
      'board_executor_01',
      'observer_will_01'
    ]);
    expect(cardState.hands.white).toEqual(['rebuild_01', 'gold_stone', 'silver_stone']);
    expect(cardState.charge.black).toBeGreaterThanOrEqual(99);
    expect(cardState.numberCellCollectedTotalByPlayer.black).toBe(42);
    expect(cardState.pendingEffectByPlayer).toEqual({ black: null, white: null });
    expect(cardState.hasUsedCardThisTurnByPlayer).toEqual({ black: false, white: false });
    expect(cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'specialStone',
        row: 2,
        col: 3,
        owner: 'black',
        data: expect.objectContaining({
          type: 'AFTERIMAGE_WILL',
          flipEvadeRemaining: 6,
          destroyEvadeRemaining: 6
        })
      }),
      expect.objectContaining({ kind: 'specialStone', row: 2, col: 4, owner: 'white', data: expect.objectContaining({ type: 'TRAP' }) }),
      expect.objectContaining({ kind: 'bomb', row: 3, col: 5, owner: 'white', data: expect.objectContaining({ type: 'TIME_BOMB' }) })
    ]));
    expect(cardState.markers).toHaveLength(3);
    expect(CardLogic.canUseBoardExecutor(cardState, 'black')).toBe(true);
    expect(cardState.markers.some((marker: any) => marker.kind === 'manifestStone')).toBe(false);
    expect(cardState.selectedCardId).toBe('theory_incarnation_01');
    expect(cardState._handCopyIdsByPlayer.black).toHaveLength(3);
    expect(cardState._handCopyIdsByPlayer.white).toHaveLength(3);
  });
});
