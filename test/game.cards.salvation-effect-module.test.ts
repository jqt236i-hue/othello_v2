import {
  cloneSalvationDestroyedEntries,
  cloneSalvationDestroyedLedger,
  createCardSalvationEffect,
  ensureSalvationDestroyedLedger
} from '../game/logic/cards-internal/salvation-effect.js';

describe('card salvation effect module', () => {
  test('clones destroyed entries with owner and special-stone metadata', () => {
    expect(cloneSalvationDestroyedEntries([
      { row: 1, col: 2, owner: 'black', wasSpecial: true },
      { row: 3, col: 4, owner: 'red', wasSpecial: false },
      null
    ])).toEqual([
      { row: 1, col: 2, owner: 'black', wasSpecial: true },
      { row: 3, col: 4, owner: null, wasSpecial: false },
      { row: null, col: null, owner: null, wasSpecial: false }
    ]);
  });

  test('ensures salvation destroyed ledger from current or legacy state', () => {
    const existing = { black: [{ row: 1, col: 1 }], white: [] };
    const cardStateWithExisting = { prevOpponentTurnDestroyedStonesByPlayer: existing };

    expect(ensureSalvationDestroyedLedger(cardStateWithExisting)).toBe(existing);
    expect(ensureSalvationDestroyedLedger(null)).toBeNull();

    const cardStateWithLegacy = {
      prevOpponentTurnDestroyedNormalByPlayer: {
        black: [{ row: 2, col: 3, owner: 'white', wasSpecial: true }],
        white: [{ row: 4, col: 5 }]
      }
    };

    expect(ensureSalvationDestroyedLedger(cardStateWithLegacy)).toEqual({
      black: [{ row: 2, col: 3, owner: 'white', wasSpecial: true }],
      white: [{ row: 4, col: 5, owner: null, wasSpecial: false }]
    });
    expect(cardStateWithLegacy.prevOpponentTurnDestroyedStonesByPlayer).toEqual(
      cloneSalvationDestroyedLedger(cardStateWithLegacy.prevOpponentTurnDestroyedNormalByPlayer)
    );
  });

  test('returns not_pending when the pending effect is absent or different', () => {
    const effect = createCardSalvationEffect({
      readCardPendingEffect: () => ({ type: 'OTHER' })
    });

    expect(effect.applySalvationWill({}, {}, 'black', null)).toEqual({
      applied: false,
      reason: 'not_pending',
      spawned: [],
      requestedCount: 0,
      spawnedCount: 0
    });
  });

  test('clears empty tracked ledgers and returns no_tracked_stones', () => {
    const ledger = { black: [], white: [{ row: 1, col: 1 }] };
    const clearPending = jest.fn();
    const effect = createCardSalvationEffect({
      readCardPendingEffect: () => ({ type: 'SALVATION_WILL' }),
      ensureSalvationDestroyedLedger: () => ledger,
      clearCardPendingEffect: clearPending
    });

    expect(effect.applySalvationWill({}, {}, 'black', null)).toEqual({
      applied: false,
      reason: 'no_tracked_stones',
      spawned: [],
      requestedCount: 0,
      spawnedCount: 0
    });
    expect(ledger.black).toEqual([]);
    expect(clearPending).toHaveBeenCalledWith({}, 'black');
  });

  test('delegates spawn usage with requestedCount and consumes the ledger after success', () => {
    const cardState = {};
    const gameState = { board: [] };
    const ledger = { black: [{ row: 1, col: 1 }, { row: 2, col: 2 }], white: [] };
    const clearPending = jest.fn();
    const resolveSpawn = jest.fn(() => ({
      applied: true,
      requestedCount: 2,
      spawnedCount: 2,
      spawned: [{ row: 0, col: 1 }, { row: 0, col: 2 }]
    }));
    const effect = createCardSalvationEffect({
      readCardPendingEffect: () => ({ type: 'SALVATION_WILL' }),
      ensureSalvationDestroyedLedger: () => ledger,
      clearCardPendingEffect: clearPending,
      resolveRandomBoardSpawnEffectUsage: resolveSpawn
    });

    const result = effect.applySalvationWill(cardState, gameState, 'black', { random: () => 0 });

    expect(resolveSpawn).toHaveBeenCalledWith(
      cardState,
      gameState,
      'black',
      2,
      { random: expect.any(Function) },
      'SALVATION_WILL',
      'salvation_spawn',
      expect.objectContaining({
        normalFlip: true,
        flipReason: 'salvation_flip',
        spawnMetaFactory: expect.any(Function)
      })
    );
    const spawnMetaFactory = resolveSpawn.mock.calls[0][7].spawnMetaFactory;
    expect(spawnMetaFactory(2)).toEqual({ owner: 'black', requestedCount: 2, spawnIndex: 2 });
    expect(result).toEqual({
      applied: true,
      requestedCount: 2,
      spawnedCount: 2,
      spawned: [{ row: 0, col: 1 }, { row: 0, col: 2 }]
    });
    expect(ledger.black).toEqual([]);
    expect(clearPending).toHaveBeenCalledWith(cardState, 'black');
  });
});
