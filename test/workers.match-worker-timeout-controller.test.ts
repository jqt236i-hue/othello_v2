import { createMatchWorkerTimeoutController } from '../workers/match-worker-timeout-controller';

function createRoom() {
  return {
    roomId: 'TMRX',
    stateVersion: 4,
    updatedAt: 100,
    authoritativeStateHash: 'before_hash',
    turnTimer: {
      active: true,
      turnSeatKey: 'black',
      turnStartedAt: 0,
      turnDeadlineAt: 10
    },
    snapshot: {
      gameState: {
        currentPlayer: 1,
        consecutivePasses: 0,
        turnNumber: 9,
        __resultShown: true
      },
      cardState: {
        selectedCardId: 'timeout_card',
        selectedCardOwnerKey: 'black',
        pendingEffectByPlayer: { black: { type: 'PERMA_PROTECT_NEXT_STONE' }, white: null }
      }
    }
  } as any;
}

describe('match worker timeout controller', () => {
  test('expired timeout can use injected forced pass resolver instead of direct core pass', async () => {
    const room = createRoom();
    const broadcastCalls: any[] = [];
    const applyTimeoutPassToSnapshot = jest.fn(async ({ snapshot, playerKey }: any) => ({
      ok: true,
      snapshot: {
        ...snapshot,
        gameState: {
          ...(snapshot as any).gameState,
          currentPlayer: -1,
          consecutivePasses: 1,
          turnNumber: 10
        },
        cardState: {
          ...(snapshot as any).cardState,
          turnIndex: 11,
          lastTurnStartedFor: 'white',
          pendingEffectByPlayer: { black: null, white: null }
        }
      },
      playbackEvents: [{ type: 'pass', phase: 1 }],
      effectLogs: ['forced timeout pass'],
      playbackDiagnostics: { source: 'forced-pass' }
    }));
    const loadCoreLogicModule = jest.fn(async () => ({
      applyPass() {
        throw new Error('timeout should not use direct core pass when resolver is available');
      }
    }));
    const reconcileTurnStartAndCollectPlayback = jest.fn(async () => ({
      playbackEvents: [{ type: 'draw_card', phase: 1 }],
      diagnostics: null,
      effectLogs: []
    }));

    const controller = createMatchWorkerTimeoutController({
      getRoom: () => room,
      asRecord: (value) => (value && typeof value === 'object' ? value as Record<string, unknown> : {}),
      parseSeatKeyOptional: (value) => (value === 'black' || value === 'white' ? String(value) : null),
      resolveTurnSeatKey: () => 'black',
      refreshTurnTimer: async () => false,
      saveRoom: async () => undefined,
      loadCoreLogicModule,
      applyTimeoutPassToSnapshot,
      deepClone: <T>(value: T) => JSON.parse(JSON.stringify(value)),
      stripTransientPresentationState: (snapshot: any) => {
        if (snapshot && snapshot.gameState) delete snapshot.gameState.__resultShown;
        return snapshot;
      },
      reconcileTurnStartAndCollectPlayback,
      reportPlaybackAssemblyDiagnostics: () => undefined,
      toPublicNetworkDebugEnabled: () => false,
      toDebugPlaybackDiagnostics: (diagnostics) => diagnostics,
      computeAuthoritativeStateHash: (snapshot) => `hash_${(snapshot as any).stateVersion}`,
      appendAuthorityLog: () => [],
      broadcastSnapshot: async (meta) => { broadcastCalls.push(meta); }
    } as any);

    const result = await controller.applyExpiredTurnTimeoutIfNeeded({ nowMs: 20 });

    expect(result).toEqual({ applied: true, stateVersion: 5, playerKey: 'black' });
    expect(applyTimeoutPassToSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      room,
      playerKey: 'black',
      nowMs: 20
    }));
    expect(loadCoreLogicModule).not.toHaveBeenCalled();
    expect(reconcileTurnStartAndCollectPlayback).not.toHaveBeenCalled();
    expect(room.snapshot.gameState.turnNumber).toBe(10);
    expect(room.snapshot.cardState.turnIndex).toBe(11);
    expect(room.snapshot.gameState.__resultShown).toBeUndefined();
    expect(room.snapshot.cardState.selectedCardId).toBeNull();
    expect(room.snapshot.cardState.selectedCardOwnerKey).toBeNull();
    expect(broadcastCalls[0]).toEqual(expect.objectContaining({
      actionType: 'timeout_pass',
      playbackEvents: [{ type: 'pass', phase: 1 }],
      effectLogs: ['forced timeout pass'],
      playbackDiagnostics: { source: 'forced-pass' }
    }));
  });

  test('expired timeout applies pass, clears transient pending state, and broadcasts timeout snapshot', async () => {
    const room = createRoom();
    const refreshCalls: any[] = [];
    let saveCount = 0;
    const broadcastCalls: any[] = [];
    const authorityLogEntries: any[] = [];
    const controller = createMatchWorkerTimeoutController({
      getRoom: () => room,
      asRecord: (value) => (value && typeof value === 'object' ? value as Record<string, unknown> : {}),
      parseSeatKeyOptional: (value) => (value === 'black' || value === 'white' ? String(value) : null),
      resolveTurnSeatKey: () => 'black',
      refreshTurnTimer: async (options) => {
        refreshCalls.push(options);
        return false;
      },
      saveRoom: async () => { saveCount += 1; },
      loadCoreLogicModule: async () => ({
        applyPass(gameState: any) {
          return {
            ...gameState,
            currentPlayer: -1,
            consecutivePasses: 1
          };
        }
      }),
      deepClone: <T>(value: T) => JSON.parse(JSON.stringify(value)),
      stripTransientPresentationState: (snapshot: any) => {
        if (snapshot && snapshot.gameState) {
          delete snapshot.gameState.__resultShown;
        }
        return snapshot;
      },
      reconcileTurnStartAndCollectPlayback: async (_room, snapshot: any) => ({
        playbackEvents: [{ type: 'draw_card', phase: 1 }],
        diagnostics: { warningCount: 0 },
        effectLogs: ['timeout effect'],
        snapshot
      }),
      reportPlaybackAssemblyDiagnostics: () => undefined,
      toPublicNetworkDebugEnabled: () => false,
      toDebugPlaybackDiagnostics: (diagnostics) => diagnostics,
      computeAuthoritativeStateHash: (snapshot) => `hash_${(snapshot as any).stateVersion}`,
      appendAuthorityLog: (_room, entry) => {
        authorityLogEntries.push(entry);
        return authorityLogEntries;
      },
      broadcastSnapshot: async (meta) => {
        broadcastCalls.push(meta);
      }
    });

    const result = await controller.applyExpiredTurnTimeoutIfNeeded({ nowMs: 20 });

    expect(result).toEqual({
      applied: true,
      stateVersion: 5,
      playerKey: 'black'
    });
    expect(room.snapshot.gameState.currentPlayer).toBe(-1);
    expect(room.snapshot.gameState.consecutivePasses).toBe(1);
    expect(room.snapshot.gameState.__resultShown).toBeUndefined();
    expect(room.snapshot.cardState.selectedCardId).toBeNull();
    expect(room.snapshot.cardState.selectedCardOwnerKey).toBeNull();
    expect(room.snapshot.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(room.authoritativeStateHash).toBe('hash_5');
    expect(saveCount).toBe(1);
    expect(refreshCalls).toEqual([
      { nowMs: 20, forceRestart: false },
      { nowMs: 20, forceRestart: true }
    ]);
    expect(authorityLogEntries).toHaveLength(1);
    expect(authorityLogEntries[0]).toMatchObject({
      kind: 'timeout_applied',
      actionType: 'timeout_pass',
      committedVersion: 5,
      timeoutReason: 'turn_deadline_expired'
    });
    expect(broadcastCalls).toEqual([
      expect.objectContaining({
        playerKey: 'black',
        actionType: 'timeout_pass',
        playbackEvents: [{ type: 'draw_card', phase: 1 }],
        effectLogs: ['timeout effect'],
        operationId: 'timeout_5_20'
      })
    ]);
  });

  test('mismatched timer seat triggers corrective refresh and does not broadcast', async () => {
    const room = createRoom();
    room.turnTimer.turnSeatKey = 'white';
    let saveCount = 0;
    const refreshCalls: any[] = [];
    const broadcastCalls: any[] = [];
    const controller = createMatchWorkerTimeoutController({
      getRoom: () => room,
      asRecord: (value) => (value && typeof value === 'object' ? value as Record<string, unknown> : {}),
      parseSeatKeyOptional: (value) => (value === 'black' || value === 'white' ? String(value) : null),
      resolveTurnSeatKey: () => 'black',
      refreshTurnTimer: async (options) => {
        refreshCalls.push(options);
        return true;
      },
      saveRoom: async () => { saveCount += 1; },
      loadCoreLogicModule: async () => ({
        applyPass(gameState: any) { return gameState; }
      }),
      deepClone: <T>(value: T) => JSON.parse(JSON.stringify(value)),
      stripTransientPresentationState: (snapshot) => snapshot,
      reconcileTurnStartAndCollectPlayback: async () => ({ playbackEvents: [], diagnostics: null, effectLogs: [] }),
      reportPlaybackAssemblyDiagnostics: () => undefined,
      toPublicNetworkDebugEnabled: () => false,
      toDebugPlaybackDiagnostics: (diagnostics) => diagnostics,
      computeAuthoritativeStateHash: () => 'unused',
      appendAuthorityLog: () => [],
      broadcastSnapshot: async (meta) => { broadcastCalls.push(meta); }
    });

    const result = await controller.applyExpiredTurnTimeoutIfNeeded({ nowMs: 20 });

    expect(result).toEqual({ applied: false });
    expect(saveCount).toBe(2);
    expect(refreshCalls).toEqual([
      { nowMs: 20, forceRestart: false },
      { nowMs: 20, forceRestart: true }
    ]);
    expect(broadcastCalls).toEqual([]);
  });
});
