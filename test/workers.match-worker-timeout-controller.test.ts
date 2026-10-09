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

function stripTransientChargeDeltaState(snapshot: any) {
  if (snapshot?.cardState && typeof snapshot.cardState === 'object') {
    snapshot.cardState.chargeDeltaEvents = [];
  }
  return snapshot;
}

describe('match worker timeout controller', () => {
  test('expired timeout can use injected forced pass resolver instead of direct core pass', async () => {
    const room = createRoom();
    const broadcastCalls: any[] = [];
    const applyTimeoutPassToSnapshot = jest.fn(async ({ snapshot }: any) => {
      const gameState = {
        ...(snapshot as any).gameState,
        currentPlayer: -1,
        consecutivePasses: 1,
        turnNumber: 10
      };
      delete gameState.__resultShown;
      return {
        ok: true,
        snapshot: {
          ...snapshot,
          gameState,
          cardState: {
            ...(snapshot as any).cardState,
            turnIndex: 11,
            lastTurnStartedFor: 'white',
            selectedCardId: null,
            selectedCardOwnerKey: null,
            pendingEffectByPlayer: { black: null, white: null },
            chargeDeltaEvents: [{
              seq: 1,
              player: 'white',
              before: 0,
              after: 5,
              delta: 5,
              reason: 'ultimate_work_god_income'
            }]
          }
        },
        playbackEvents: [{ type: 'pass', phase: 1 }],
        effectLogs: ['forced timeout pass'],
        playbackDiagnostics: { source: 'forced-pass' }
      };
    });
    const ensureInitialPresentationSnapshots = jest.fn();
    let artifactChargeDeltaEvents: any[] = [];
    const buildPublishViewerArtifacts = jest.fn((currentRoom: any) => {
      artifactChargeDeltaEvents = JSON.parse(JSON.stringify(
        currentRoom.snapshot.cardState.chargeDeltaEvents
      ));
      return {
        canonicalHash: 'hash_5',
        projectedSnapshots: {
          black: { stateVersion: 5 },
          white: { stateVersion: 5 },
          spectator: { stateVersion: 5 }
        },
        snapshotPayloads: {}
      };
    });
    const appendPresentationFrameForAcceptedPublish = jest.fn((_room, options) => ({
      visualSeq: 1,
      stateVersionFrom: options.previousStateVersion,
      stateVersionTo: options.nextStateVersion,
      operationId: options.operationId,
      actorSeatKey: options.actorSeatKey,
      actionType: options.actionType
    }));
    const normalizeSnapshotBoardContract = jest.fn(() => ({ ok: true, errors: [] }));

    const controller = createMatchWorkerTimeoutController({
      getRoom: () => room,
      parseSeatKeyOptional: (value) => (value === 'black' || value === 'white' ? String(value) : null),
      resolveTurnSeatKey: () => 'black',
      refreshTurnTimer: async () => false,
      saveRoom: async () => undefined,
      applyTimeoutPassToSnapshot,
      deepClone: <T>(value: T) => JSON.parse(JSON.stringify(value)),
      computeAuthoritativeStateHash: (snapshot) => `hash_${(snapshot as any).stateVersion}`,
      stripTransientChargeDeltaState,
      normalizeSnapshotBoardContract,
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
    expect(normalizeSnapshotBoardContract).toHaveBeenCalledWith(
      expect.objectContaining({ stateVersion: 5 }),
      { allowLegacy: true, requireFullSnapshot: true }
    );
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
    expect(artifactChargeDeltaEvents).toHaveLength(1);
    expect(room.snapshot.cardState.chargeDeltaEvents).toEqual([]);
    expect(broadcastCalls[0]).toEqual(expect.objectContaining({
      actionType: 'timeout_pass',
      autoPassNotice: { playerKey: 'black', reason: 'timeout_pass' },
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
      applyTimeoutPassToSnapshot: async ({ snapshot }) => {
        const gameState = {
          ...(snapshot as any).gameState,
          currentPlayer: -1,
          consecutivePasses: 1
        };
        delete gameState.__resultShown;
        return {
          ok: true,
          snapshot: {
            ...snapshot,
            gameState,
            cardState: {
              ...(snapshot as any).cardState,
              selectedCardId: null,
              selectedCardOwnerKey: null,
              pendingEffectByPlayer: { black: null, white: null }
            }
          },
          playbackEvents: [{ type: 'draw_card', phase: 1 }],
          effectLogs: ['timeout effect'],
          playbackDiagnostics: { warningCount: 0 }
        };
      },
      deepClone: <T>(value: T) => JSON.parse(JSON.stringify(value)),
      computeAuthoritativeStateHash: (snapshot) => `hash_${(snapshot as any).stateVersion}`,
      stripTransientChargeDeltaState,
      normalizeSnapshotBoardContract: () => ({ ok: true, errors: [] }),
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

  // 01-rulebook.md §8.4: 時間切れパスで先にパスした相手へ手番が戻った時は、両席に「続行」通知も届ける。
  test('timeout pass that hands the turn back marks the pass notice as turn returned', async () => {
    const room = createRoom();
    room.snapshot.gameState.consecutivePasses = 1;
    const broadcastCalls: any[] = [];
    const controller = createMatchWorkerTimeoutController({
      getRoom: () => room,
      parseSeatKeyOptional: (value) => (value === 'black' || value === 'white' ? String(value) : null),
      resolveTurnSeatKey: () => 'black',
      refreshTurnTimer: async () => false,
      saveRoom: async () => undefined,
      applyTimeoutPassToSnapshot: async ({ snapshot }: any) => ({
        ok: true,
        snapshot: {
          ...snapshot,
          gameState: { ...snapshot.gameState, currentPlayer: -1, consecutivePasses: 1, turnNumber: 10 }
        },
        playbackEvents: [{ type: 'pass', phase: 1 }]
      }),
      deepClone: <T>(value: T) => JSON.parse(JSON.stringify(value)),
      computeAuthoritativeStateHash: () => 'hash',
      stripTransientChargeDeltaState,
      normalizeSnapshotBoardContract: () => ({ ok: true, errors: [] }),
      appendAuthorityLog: () => [],
      ensureInitialPresentationSnapshots: jest.fn(),
      buildPublishViewerArtifacts: jest.fn(() => ({ canonicalHash: 'hash', projectedSnapshots: {}, snapshotPayloads: {} })),
      appendPresentationFrameForAcceptedPublish: jest.fn((_room, options) => ({ visualSeq: 1, operationId: options.operationId })),
      broadcastSnapshot: async (meta) => { broadcastCalls.push(meta); }
    } as any);

    const result = await controller.applyExpiredTurnTimeoutIfNeeded({ nowMs: 20 });

    expect(result).toEqual({ applied: true, stateVersion: 5, playerKey: 'black' });
    expect(broadcastCalls[0].autoPassNotice).toEqual({ playerKey: 'black', reason: 'timeout_pass', turnReturned: true });
  });

  test('missing shared timeout resolver fails closed before timer refresh or save', async () => {
    const room = createRoom();
    const before = JSON.parse(JSON.stringify(room));
    const refreshTurnTimer = jest.fn(async () => false);
    const saveRoom = jest.fn(async () => undefined);
    const controller = createMatchWorkerTimeoutController({
      getRoom: () => room,
      parseSeatKeyOptional: (value) => (value === 'black' || value === 'white' ? String(value) : null),
      resolveTurnSeatKey: () => 'black',
      refreshTurnTimer,
      saveRoom,
      deepClone: <T>(value: T) => JSON.parse(JSON.stringify(value)),
      computeAuthoritativeStateHash: () => 'unused',
      stripTransientChargeDeltaState,
      normalizeSnapshotBoardContract: () => ({ ok: true, errors: [] }),
      appendAuthorityLog: () => [],
      ensureInitialPresentationSnapshots: jest.fn(),
      buildPublishViewerArtifacts: jest.fn(() => ({})),
      appendPresentationFrameForAcceptedPublish: jest.fn(),
      broadcastSnapshot: jest.fn(async () => undefined)
    } as any);

    await expect(controller.applyExpiredTurnTimeoutIfNeeded({ nowMs: 20 }))
      .resolves.toEqual({ applied: false });
    expect(refreshTurnTimer).not.toHaveBeenCalled();
    expect(saveRoom).not.toHaveBeenCalled();
    expect(room).toEqual(before);
  });

  test('shared timeout command rejection leaves authority and presentation state unchanged', async () => {
    const room = createRoom();
    const before = JSON.parse(JSON.stringify(room));
    const saveRoom = jest.fn(async () => undefined);
    const ensureInitialPresentationSnapshots = jest.fn();
    const appendPresentationFrameForAcceptedPublish = jest.fn();
    const broadcastSnapshot = jest.fn(async () => undefined);
    const controller = createMatchWorkerTimeoutController({
      getRoom: () => room,
      parseSeatKeyOptional: (value) => (value === 'black' || value === 'white' ? String(value) : null),
      resolveTurnSeatKey: () => 'black',
      refreshTurnTimer: jest.fn(async () => false),
      saveRoom,
      applyTimeoutPassToSnapshot: jest.fn(async () => ({
        ok: false,
        rejectedReason: 'INVALID_SNAPSHOT'
      })),
      deepClone: <T>(value: T) => JSON.parse(JSON.stringify(value)),
      computeAuthoritativeStateHash: () => 'unused',
      stripTransientChargeDeltaState,
      normalizeSnapshotBoardContract: () => ({ ok: true, errors: [] }),
      appendAuthorityLog: () => [],
      ensureInitialPresentationSnapshots,
      buildPublishViewerArtifacts: jest.fn(() => ({})),
      appendPresentationFrameForAcceptedPublish,
      broadcastSnapshot
    } as any);

    await expect(controller.applyExpiredTurnTimeoutIfNeeded({ nowMs: 20 }))
      .resolves.toEqual({ applied: false });
    expect(saveRoom).not.toHaveBeenCalled();
    expect(ensureInitialPresentationSnapshots).not.toHaveBeenCalled();
    expect(appendPresentationFrameForAcceptedPublish).not.toHaveBeenCalled();
    expect(broadcastSnapshot).not.toHaveBeenCalled();
    expect(room).toEqual(before);
  });

  test('mismatched timer seat triggers corrective refresh and does not broadcast', async () => {
    const room = createRoom();
    room.turnTimer.turnSeatKey = 'white';
    let saveCount = 0;
    const refreshCalls: any[] = [];
    const broadcastCalls: any[] = [];
    const controller = createMatchWorkerTimeoutController({
      getRoom: () => room,
      parseSeatKeyOptional: (value) => (value === 'black' || value === 'white' ? String(value) : null),
      resolveTurnSeatKey: () => 'black',
      refreshTurnTimer: async (options) => {
        refreshCalls.push(options);
        return true;
      },
      saveRoom: async () => { saveCount += 1; },
      applyTimeoutPassToSnapshot: jest.fn(async () => ({ ok: false })),
      deepClone: <T>(value: T) => JSON.parse(JSON.stringify(value)),
      computeAuthoritativeStateHash: () => 'unused',
      stripTransientChargeDeltaState,
      normalizeSnapshotBoardContract: () => ({ ok: true, errors: [] }),
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
      parseSeatKeyOptional: (value) => (value === 'black' || value === 'white' ? String(value) : null),
      resolveTurnSeatKey: () => room.snapshot.gameState.currentPlayer === 1 ? 'black' : 'white',
      refreshTurnTimer: async () => false,
      saveRoom,
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
      computeAuthoritativeStateHash: () => 'unused',
      stripTransientChargeDeltaState,
      normalizeSnapshotBoardContract: () => ({ ok: true, errors: [] }),
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
