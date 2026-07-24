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
    const ensureInitialPresentationSnapshots = jest.fn();
    const buildPublishViewerArtifacts = jest.fn(() => ({
      canonicalHash: 'hash_5',
      projectedSnapshots: {
        black: { stateVersion: 5 },
        white: { stateVersion: 5 },
        spectator: { stateVersion: 5 }
      },
      snapshotPayloads: {}
    }));
    const appendPresentationFrameForAcceptedPublish = jest.fn((_room, options) => ({
      visualSeq: 1,
      stateVersionFrom: options.previousStateVersion,
      stateVersionTo: options.nextStateVersion,
      operationId: options.operationId,
      actorSeatKey: options.actorSeatKey,
      actionType: options.actionType
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
      ensureInitialPresentationSnapshots,
      buildPublishViewerArtifacts,
      appendPresentationFrameForAcceptedPublish,
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
    expect(ensureInitialPresentationSnapshots).toHaveBeenCalledWith(room);
    expect(appendPresentationFrameForAcceptedPublish).toHaveBeenCalledWith(room, expect.objectContaining({
      previousStateVersion: 4,
      nextStateVersion: 5,
      operationId: 'timeout_5_20',
      actorSeatKey: 'black',
      actionType: 'timeout_pass'
    }));
    expect(room.snapshot.gameState.turnNumber).toBe(10);
    expect(room.snapshot.cardState.turnIndex).toBe(11);
    expect(room.snapshot.gameState.__resultShown).toBeUndefined();
    expect(room.snapshot.cardState.selectedCardId).toBeNull();
    expect(room.snapshot.cardState.selectedCardOwnerKey).toBeNull();
    expect(broadcastCalls[0]).toEqual(expect.objectContaining({
      actionType: 'timeout_pass',
      playbackEvents: [{ type: 'pass', phase: 1 }],
      effectLogs: ['forced timeout pass'],
      playbackDiagnostics: { source: 'forced-pass' },
      presentationFrameEntry: expect.objectContaining({
        visualSeq: 1,
        operationId: 'timeout_5_20'
      })
    }));
  });

  test('expired timeout applies pass, clears transient pending state, and broadcasts timeout snapshot', async () => {
    const room = createRoom();
    const refreshCalls: any[] = [];
    let saveCount = 0;
    const broadcastCalls: any[] = [];
    const authorityLogEntries: any[] = [];
    const order: string[] = [];
    const appendPresentationFrameForAcceptedPublish = jest.fn((_room, options) => {
      order.push('append-frame');
      return {
        visualSeq: 1,
        stateVersionFrom: options.previousStateVersion,
        stateVersionTo: options.nextStateVersion,
        operationId: options.operationId,
        actorSeatKey: options.actorSeatKey,
        actionType: options.actionType
      };
    });
    const controller = createMatchWorkerTimeoutController({
      getRoom: () => room,
      asRecord: (value) => (value && typeof value === 'object' ? value as Record<string, unknown> : {}),
      parseSeatKeyOptional: (value) => (value === 'black' || value === 'white' ? String(value) : null),
      resolveTurnSeatKey: () => 'black',
      refreshTurnTimer: async (options) => {
        refreshCalls.push(options);
        return false;
      },
      saveRoom: async () => {
        order.push('save-room');
        saveCount += 1;
      },
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
      ensureInitialPresentationSnapshots: () => {
        order.push('ensure-base');
      },
      buildPublishViewerArtifacts: () => ({
        canonicalHash: 'hash_5',
        projectedSnapshots: {
          black: { stateVersion: 5 },
          white: { stateVersion: 5 },
          spectator: { stateVersion: 5 }
        },
        snapshotPayloads: {}
      }),
      appendPresentationFrameForAcceptedPublish,
      broadcastSnapshot: async (meta) => {
        order.push('broadcast');
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
        operationId: 'timeout_5_20',
        presentationFrameEntry: expect.objectContaining({
          visualSeq: 1,
          stateVersionFrom: 4,
          stateVersionTo: 5
        })
      })
    ]);
    expect(appendPresentationFrameForAcceptedPublish).toHaveBeenCalledWith(room, expect.objectContaining({
      previousStateVersion: 4,
      nextStateVersion: 5,
      operationId: 'timeout_5_20',
      playbackEvents: [{ type: 'draw_card', phase: 1 }]
    }));
    expect(order).toEqual([
      'ensure-base',
      'append-frame',
      'save-room',
      'broadcast'
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
      ensureInitialPresentationSnapshots: jest.fn(),
      buildPublishViewerArtifacts: jest.fn(() => ({
        canonicalHash: 'unused',
        projectedSnapshots: {},
        snapshotPayloads: {}
      })),
      appendPresentationFrameForAcceptedPublish: jest.fn(() => ({ visualSeq: 1 })),
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

  test('abandons an expired timeout when authority changes while the resolver is pending', async () => {
    const room = createRoom();
    const saveRoom = jest.fn(async () => undefined);
    const appendPresentationFrameForAcceptedPublish = jest.fn(() => ({ visualSeq: 1 }));
    const broadcastSnapshot = jest.fn(async () => undefined);
    const controller = createMatchWorkerTimeoutController({
      getRoom: () => room,
      asRecord: (value) => (value && typeof value === 'object' ? value as Record<string, unknown> : {}),
      parseSeatKeyOptional: (value) => (value === 'black' || value === 'white' ? String(value) : null),
      resolveTurnSeatKey: () => room.snapshot.gameState.currentPlayer === 1 ? 'black' : 'white',
      refreshTurnTimer: async () => false,
      saveRoom,
      loadCoreLogicModule: async () => ({
        applyPass(gameState: any) { return gameState; }
      }),
      applyTimeoutPassToSnapshot: async ({ snapshot }) => {
        room.stateVersion = 5;
        room.snapshot = {
          ...room.snapshot,
          gameState: {
            ...room.snapshot.gameState,
            currentPlayer: -1,
            turnNumber: 10
          }
        };
        return {
          ok: true,
          snapshot: {
            ...snapshot,
            gameState: {
              ...(snapshot as any).gameState,
              currentPlayer: -1,
              turnNumber: 10
            }
          },
          playbackEvents: [{ type: 'pass', phase: 1 }]
        };
      },
      deepClone: <T>(value: T) => JSON.parse(JSON.stringify(value)),
      stripTransientPresentationState: (snapshot) => snapshot,
      reconcileTurnStartAndCollectPlayback: async () => ({ playbackEvents: [], diagnostics: null, effectLogs: [] }),
      reportPlaybackAssemblyDiagnostics: () => undefined,
      toPublicNetworkDebugEnabled: () => false,
      toDebugPlaybackDiagnostics: (diagnostics) => diagnostics,
      computeAuthoritativeStateHash: () => 'unused',
      appendAuthorityLog: () => [],
      ensureInitialPresentationSnapshots: jest.fn(),
      buildPublishViewerArtifacts: jest.fn(() => ({
        canonicalHash: 'unused',
        projectedSnapshots: {},
        snapshotPayloads: {}
      })),
      appendPresentationFrameForAcceptedPublish,
      broadcastSnapshot
    } as any);

    const result = await controller.applyExpiredTurnTimeoutIfNeeded({ nowMs: 20 });

    expect(result).toEqual({ applied: false });
    expect(room.stateVersion).toBe(5);
    expect(room.snapshot.gameState.currentPlayer).toBe(-1);
    expect(appendPresentationFrameForAcceptedPublish).not.toHaveBeenCalled();
    expect(saveRoom).not.toHaveBeenCalled();
    expect(broadcastSnapshot).not.toHaveBeenCalled();
  });
});
