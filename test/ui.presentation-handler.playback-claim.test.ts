async function flushMicrotasks(iterations = 16): Promise<void> {
  for (let index = 0; index < iterations; index += 1) await Promise.resolve();
}

let playbackSettlementRunId = 0;
function createPlaybackSettlement(onFinalize: () => void = () => {}, mode: 'finalize' | 'already-aborted-ack' = 'finalize') {
  let finalized = false;
  return Object.freeze({
    kind: 'deferred-finalization' as const,
    runId: ++playbackSettlementRunId,
    mode,
    finalize() {
      if (finalized) return false;
      onFinalize();
      finalized = true;
      return true;
    }
  });
}

describe('PresentationHandler playback claim', () => {
  afterEach(() => {
    jest.dontMock('../game/cpu-turn-handler');
    jest.dontMock('../ui/board-renderer');
    jest.dontMock('../ui/playback-engine');
    jest.resetModules();
    delete (global as any).AnimationEngine;
    delete (global as any).GameEvents;
    delete (global as any).GamePresentationRuntime;
    delete (global as any).PlaybackStateManager;
    delete (global as any).emitBoardUpdate;
  });

  test('claims visual playback before dispatching AnimationEngine playback', async () => {
    const order: string[] = [];
    const claim = { id: 7 };
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (global as any).GameEvents = {
      gameEvents: {
        on: jest.fn()
      }
    };
    (global as any).PlaybackStateManager = {
      claimVisualPlayback: jest.fn(() => {
        order.push('claim');
        return claim;
      }),
      releaseVisualPlaybackClaim: jest.fn((token) => {
        expect(token).toBe(claim);
        order.push('release');
        return true;
      })
    };
    (global as any).AnimationEngine = {
      play: jest.fn(async () => {
        order.push('play');
        return createPlaybackSettlement(() => {
          order.push('finalize');
        });
      })
    };

    const PresentationHandler = require('../ui/presentation-handler.js');

    try {
      await PresentationHandler.handlePresentationEvent({
        type: 'PLAYBACK_EVENTS',
        events: [{ type: 'destroy', phase: 1, targets: [{ r: 2, col: 3 }] }],
        meta: { source: 'unit-test' }
      });
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }

    expect(order).toEqual(['claim', 'play', 'finalize', 'release']);
    expect((global as any).PlaybackStateManager.claimVisualPlayback).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'unit-test',
        eventCount: 1,
        eventTypes: ['destroy']
      })
    );
    expect((global as any).AnimationEngine.play).toHaveBeenCalledWith(
      [expect.objectContaining({
        type: 'destroy',
        phase: 1,
        targets: [{ r: 2, col: 3 }],
        presentationBatchId: expect.stringMatching(/^local-presentation:\d+$/)
      })],
      expect.objectContaining({ deferFinalSettlement: true })
    );
    expect((global as any).AnimationEngine.play).toHaveBeenCalledTimes(1);
  });

  test('empty local payload creates no playback result and no manager claim', async () => {
    (global as any).GameEvents = { gameEvents: { on: jest.fn() } };
    (global as any).PlaybackStateManager = {
      claimVisualPlayback: jest.fn(),
      releaseVisualPlaybackClaim: jest.fn()
    };
    (global as any).AnimationEngine = { play: jest.fn() };
    const PresentationHandler = require('../ui/presentation-handler.js');

    await expect(PresentationHandler.handlePresentationEvent({
      type: 'PLAYBACK_EVENTS',
      events: [],
      meta: { source: 'unit-test' }
    })).resolves.toBeUndefined();

    expect((global as any).PlaybackStateManager.claimVisualPlayback).not.toHaveBeenCalled();
    expect((global as any).PlaybackStateManager.releaseVisualPlaybackClaim).not.toHaveBeenCalled();
    expect((global as any).AnimationEngine.play).not.toHaveBeenCalled();
  });

  test('payload success without a typed settlement rejects and releases its outer claim once', async () => {
    const claim = { id: 71 };
    (global as any).GameEvents = { gameEvents: { on: jest.fn() } };
    (global as any).PlaybackStateManager = {
      claimVisualPlayback: jest.fn(() => claim),
      releaseVisualPlaybackClaim: jest.fn(() => true)
    };
    (global as any).AnimationEngine = { play: jest.fn().mockResolvedValue(undefined) };
    const PresentationHandler = require('../ui/presentation-handler.js');

    await expect(PresentationHandler.handlePresentationEvent({
      type: 'PLAYBACK_EVENTS',
      events: [{ type: 'move', phase: 1 }],
      meta: { source: 'unit-test' }
    })).rejects.toEqual(expect.objectContaining({
      name: 'PresentationPlaybackError',
      code: 'playback_settlement_result_invalid'
    }));

    expect((global as any).PlaybackStateManager.releaseVisualPlaybackClaim).toHaveBeenCalledTimes(1);
    expect((global as any).PlaybackStateManager.releaseVisualPlaybackClaim).toHaveBeenCalledWith(claim);
  });

  test('does not replay a non-strict batch when dispatcher playback rejects after side effects start', async () => {
    const originalFailure = new Error('playback failed after partial presentation');
    const claim = { id: 8 };
    const playSound = jest.fn();
    const showGlobalOverlay = jest.fn();
    (global as any).GameEvents = { gameEvents: { on: jest.fn() } };
    (global as any).PlaybackStateManager = {
      claimVisualPlayback: jest.fn(() => claim),
      releaseVisualPlaybackClaim: jest.fn(() => true)
    };
    (global as any).AnimationEngine = {
      play: jest.fn(async () => {
        playSound('impact');
        showGlobalOverlay('manifest');
        throw originalFailure;
      })
    };

    const PresentationHandler = require('../ui/presentation-handler.js');

    await expect(PresentationHandler.handlePresentationEvent({
      type: 'PLAYBACK_EVENTS',
      events: [
        { type: 'sound', phase: 1, key: 'impact' },
        { type: 'manifest', phase: 1, overlay: 'manifest' }
      ],
      meta: { source: 'unit-test' }
    })).rejects.toBe(originalFailure);

    expect((global as any).AnimationEngine.play).toHaveBeenCalledTimes(1);
    expect(playSound).toHaveBeenCalledTimes(1);
    expect(showGlobalOverlay).toHaveBeenCalledTimes(1);
  });

  test('uses the direct AnimationEngine fallback only when playback dispatcher is unavailable', async () => {
    const order: string[] = [];
    const claim = { id: 10 };
    jest.doMock('../ui/playback-engine', () => ({}));
    (global as any).GameEvents = { gameEvents: { on: jest.fn() } };
    (global as any).PlaybackStateManager = {
      claimVisualPlayback: jest.fn(() => {
        order.push('claim');
        return claim;
      }),
      releaseVisualPlaybackClaim: jest.fn(() => {
        order.push('release');
        return true;
      })
    };
    (global as any).AnimationEngine = {
      play: jest.fn(async () => {
        order.push('fallback-play');
        return createPlaybackSettlement(() => {
          order.push('finalize');
        });
      })
    };

    const PresentationHandler = require('../ui/presentation-handler.js');

    await expect(PresentationHandler.handlePresentationEvent({
      type: 'PLAYBACK_EVENTS',
      events: [{ type: 'destroy', phase: 1, targets: [{ r: 4, col: 5 }] }],
      meta: { source: 'unit-test' }
    })).resolves.toBeUndefined();

    expect((global as any).AnimationEngine.play).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['claim', 'fallback-play', 'finalize', 'release']);
  });

  test('propagates a direct AnimationEngine fallback failure and releases its claim without replay', async () => {
    const originalFailure = new Error('renderer resource failed');
    const claim = { id: 11 };
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.doMock('../ui/playback-engine', () => ({}));
    (global as any).GameEvents = { gameEvents: { on: jest.fn() } };
    (global as any).PlaybackStateManager = {
      claimVisualPlayback: jest.fn(() => claim),
      releaseVisualPlaybackClaim: jest.fn(() => true)
    };
    (global as any).AnimationEngine = {
      play: jest.fn(async () => {
        throw originalFailure;
      })
    };

    const PresentationHandler = require('../ui/presentation-handler.js');

    await expect(PresentationHandler.handlePresentationEvent({
      type: 'PLAYBACK_EVENTS',
      events: [{ type: 'move', phase: 1 }],
      meta: { source: 'unit-test' }
    })).rejects.toBe(originalFailure);

    warnSpy.mockRestore();
    expect((global as any).AnimationEngine.play).toHaveBeenCalledTimes(1);
    expect((global as any).PlaybackStateManager.releaseVisualPlaybackClaim).toHaveBeenCalledTimes(1);
    expect((global as any).PlaybackStateManager.releaseVisualPlaybackClaim).toHaveBeenCalledWith(claim);
  });

  test('requests board sync again after releasing playback claim', async () => {
    const order: string[] = [];
    const claim = { id: 9 };
    let claimActive = false;
    (global as any).GameEvents = {
      gameEvents: {
        on: jest.fn()
      }
    };
    (global as any).emitBoardUpdate = jest.fn(() => {
      order.push(`emit:${claimActive}`);
      return true;
    });
    (global as any).PlaybackStateManager = {
      claimVisualPlayback: jest.fn(() => {
        claimActive = true;
        order.push('claim');
        return claim;
      }),
      releaseVisualPlaybackClaim: jest.fn((token) => {
        expect(token).toBe(claim);
        claimActive = false;
        order.push('release');
        return true;
      })
    };
    (global as any).AnimationEngine = {
      play: jest.fn(async () => {
        order.push('play');
        (global as any).emitBoardUpdate();
        return createPlaybackSettlement(() => {
          order.push('finalize');
        });
      })
    };

    const PresentationHandler = require('../ui/presentation-handler.js');

    await PresentationHandler.handlePresentationEvent({
      type: 'PLAYBACK_EVENTS',
      events: [{ type: 'spawn', phase: 1, targets: [{ r: 2, col: 3 }] }],
      meta: { source: 'unit-test' }
    });

    expect(order).toEqual(['claim', 'play', 'emit:true', 'finalize', 'release', 'emit:false']);
  });

  test('does not claim suppressed playback batches', async () => {
    (global as any).GameEvents = {
      gameEvents: {
        on: jest.fn()
      }
    };
    (global as any).PlaybackStateManager = {
      claimVisualPlayback: jest.fn(),
      releaseVisualPlaybackClaim: jest.fn()
    };
    (global as any).AnimationEngine = {
      play: jest.fn()
    };

    const PresentationHandler = require('../ui/presentation-handler.js');

    await PresentationHandler.handlePresentationEvent({
      type: 'PLAYBACK_EVENTS',
      events: [{ type: 'destroy', phase: 1, targets: [{ r: 2, col: 3 }] }],
      meta: {
        source: 'self_snapshot_sync',
        suppressPlayback: true
      }
    });

    expect((global as any).PlaybackStateManager.claimVisualPlayback).not.toHaveBeenCalled();
    expect((global as any).PlaybackStateManager.releaseVisualPlaybackClaim).not.toHaveBeenCalled();
    expect((global as any).AnimationEngine.play).not.toHaveBeenCalled();
  });

  test('settles a synthetic local writer when a board update has no playback events', async () => {
    let markSettlementStarted: () => void = () => undefined;
    const settlementStarted = new Promise<void>((resolve) => {
      markSettlementStarted = resolve;
    });
    let completeSettlement: () => void = () => undefined;
    const settlement = new Promise<boolean>((resolve) => {
      completeSettlement = () => resolve(true);
    });
    const settleAutoBoardVisualWriter = jest.fn(() => {
      markSettlementStarted();
      return settlement;
    });
    const runtime = {
      createBoardUpdateDrainController: jest.fn(() => ({
        requestDrain: async (runDrain: any) => runDrain()
      })),
      flushPendingPresentationEvents: jest.fn(() => [])
    };
    jest.doMock('../game/cpu-turn-handler', () => ({ PresentationRuntime: runtime }));
    jest.doMock('../ui/board-renderer', () => ({
      getBoardVisualControllerReady: jest.fn(async () => undefined),
      settleAutoBoardVisualWriter
    }));
    (global as any).GameEvents = { gameEvents: { on: jest.fn() } };

    const PresentationHandler = require('../ui/presentation-handler.js');

    let boardUpdateResolved = false;
    const boardUpdate = PresentationHandler.onBoardUpdated().then(() => {
      boardUpdateResolved = true;
    });
    await settlementStarted;

    expect(boardUpdateResolved).toBe(false);

    completeSettlement();
    await expect(boardUpdate).resolves.toBeUndefined();

    expect(runtime.flushPendingPresentationEvents).toHaveBeenCalledTimes(1);
    expect(settleAutoBoardVisualWriter).toHaveBeenCalledTimes(1);
    expect(boardUpdateResolved).toBe(true);
  });

  test('returns an opaque strict handle after source trajectories and holds ownership until committed-frame sync succeeds', async () => {
    const order: string[] = [];
    const playedEvents: any[] = [];
    const soundCalls: string[] = [];
    const effectLogs: string[] = [];
    const originalEvents = [
      {
        type: 'destroy',
        phase: 4,
        sequenceIndex: 0,
        actionId: 'op_7',
        effectBlockId: 'op_7:destroy',
        targets: [{
          r: 0,
          col: 0,
          sourceRow: 1,
          sourceCol: 1,
          cause: 'SNIPER_WILL',
          reason: 'sniper_shot'
        }]
      },
      {
        type: 'flip',
        phase: 5,
        sequenceIndex: 1,
        actionId: 'op_7',
        effectBlockId: 'op_7:zombie',
        targets: [{
          r: 2,
          col: 3,
          cause: 'ZOMBIE',
          reason: 'zombie_infection',
          meta: { sourceRow: 3, sourceCol: 3 }
        }]
      }
    ];
    const managerClaim = { id: 31 };
    const boardWriterToken = { id: 32, frameToken: 'network:7', mode: 'network' };
    let boardClaimHeld = false;
    let managerClaimHeld = false;
    let inputLocked = false;
    (global as any).emitBoardUpdate = jest.fn(() => {
      order.push('board-sync');
      return true;
    });
    let applyAttempt = 0;
    jest.doMock('../ui/board-renderer', () => ({
      claimBoardVisualWriter: jest.fn((frameToken, mode) => {
        order.push(`board-claim:${frameToken}:${mode}`);
        boardClaimHeld = true;
        return boardWriterToken;
      }),
      beginBoardVisualFrameCommit: jest.fn((token) => {
        expect(token).toBe(boardWriterToken);
        order.push('board-await-commit');
        return true;
      }),
      applyCommittedBoardVisualFrame: jest.fn(async (token, receipt) => {
        expect(token).toBe(boardWriterToken);
        expect(receipt).toEqual(expect.objectContaining({
          kind: 'network-visual-commit',
          visualSeq: 7
        }));
        applyAttempt += 1;
        order.push(`board-apply-committed:${applyAttempt}`);
        if (applyAttempt === 1) throw new Error('context lost after trajectory phase');
        return true;
      }),
      releaseBoardVisualWriter: jest.fn((token) => {
        expect(token).toBe(boardWriterToken);
        order.push('board-release');
        boardClaimHeld = false;
        return true;
      })
    }));
    (global as any).GameEvents = { gameEvents: { on: jest.fn() } };
    (global as any).PlaybackStateManager = {
      claimVisualPlayback: jest.fn(() => {
        order.push('manager-claim');
        managerClaimHeld = true;
        inputLocked = true;
        return managerClaim;
      }),
      releaseVisualPlaybackClaim: jest.fn((claim) => {
        expect(claim).toBe(managerClaim);
        order.push('manager-release');
        managerClaimHeld = false;
        inputLocked = false;
        return true;
      })
    };
    (global as any).AnimationEngine = {
      play: jest.fn(async (events) => {
        order.push('play');
        playedEvents.push(...events);
        for (const event of events) {
          soundCalls.push(`sound:${event.type}`);
          effectLogs.push(`log:${event.type}`);
        }
        return createPlaybackSettlement(() => {
          order.push('manager-finalize');
        });
      })
    };

    const PresentationHandler = require('../ui/presentation-handler.js');
    const handle = await PresentationHandler.handlePresentationEvent({
      type: 'PLAYBACK_EVENTS',
      events: originalEvents,
      meta: { source: 'network_timeline', strictNetworkPlayback: true, visualSeq: 7 }
    });

    expect(Object.isFrozen(handle)).toBe(true);
    expect(handle).toEqual(expect.objectContaining({
      kind: 'strict-network-settlement',
      visualSeq: 7,
      applyCommittedFrame: expect.any(Function),
      settle: expect.any(Function),
      cancel: expect.any(Function)
    }));
    expect(Object.keys(handle).sort()).toEqual(['applyCommittedFrame', 'cancel', 'kind', 'settle', 'visualSeq']);
    expect(order).toEqual([
      'manager-claim',
      'board-claim:network:7:network',
      'play',
      'board-await-commit'
    ]);
    expect(playedEvents.map((event) => event.type)).toEqual(['destroy', 'flip']);
    expect(playedEvents.map((event) => event.sequenceIndex)).toEqual([0, 1]);
    expect(playedEvents.map((event) => event.actionId)).toEqual(['op_7', 'op_7']);
    expect(playedEvents.map((event) => event.effectBlockId)).toEqual(['op_7:destroy', 'op_7:zombie']);
    expect(soundCalls).toEqual(['sound:destroy', 'sound:flip']);
    expect(effectLogs).toEqual(['log:destroy', 'log:flip']);
    expect(boardClaimHeld).toBe(true);
    expect(managerClaimHeld).toBe(true);
    expect(inputLocked).toBe(true);

    const receipt = Object.freeze({
      kind: 'network-visual-commit',
      visualSeq: 7,
      visualVersion: 8
    });
    await expect(handle.applyCommittedFrame(receipt)).rejects.toThrow('context lost after trajectory phase');
    expect(boardClaimHeld).toBe(true);
    expect(managerClaimHeld).toBe(true);
    expect(inputLocked).toBe(true);
    expect((global as any).AnimationEngine.play).toHaveBeenCalledTimes(1);
    expect(soundCalls).toHaveLength(2);
    expect(effectLogs).toHaveLength(2);
    await handle.applyCommittedFrame(receipt);
    await handle.applyCommittedFrame(receipt);
    expect(boardClaimHeld).toBe(true);
    expect(managerClaimHeld).toBe(true);
    expect(inputLocked).toBe(true);
    await handle.settle();
    await expect(handle.settle()).resolves.toBe(false);
    expect(order).toEqual([
      'manager-claim',
      'board-claim:network:7:network',
      'play',
      'board-await-commit',
      'board-apply-committed:1',
      'board-apply-committed:2',
      'board-release',
      'manager-finalize',
      'manager-release',
      'board-sync'
    ]);
    expect(boardClaimHeld).toBe(false);
    expect(managerClaimHeld).toBe(false);
    expect(inputLocked).toBe(false);
    expect((global as any).AnimationEngine.play).toHaveBeenCalledTimes(1);
    expect(soundCalls).toEqual(['sound:destroy', 'sound:flip']);
    expect(effectLogs).toEqual(['log:destroy', 'log:flip']);
    expect((global as any).emitBoardUpdate).toHaveBeenCalledTimes(1);
  });

  test('releases strict network ownership in the handler when playback fails before handoff', async () => {
    const order: string[] = [];
    const managerClaim = { id: 41 };
    const boardWriterToken = { id: 42 };
    jest.doMock('../ui/board-renderer', () => ({
      claimBoardVisualWriter: jest.fn(() => {
        order.push('board-claim');
        return boardWriterToken;
      }),
      abortBoardVisualWriterBeforeHandoff: jest.fn(async (token) => {
        expect(token).toBe(boardWriterToken);
        order.push('board-abort');
        return true;
      })
    }));
    (global as any).GameEvents = { gameEvents: { on: jest.fn() } };
    (global as any).PlaybackStateManager = {
      claimVisualPlayback: jest.fn(() => {
        order.push('manager-claim');
        return managerClaim;
      }),
      releaseVisualPlaybackClaim: jest.fn((claim) => {
        expect(claim).toBe(managerClaim);
        order.push('manager-release');
        return true;
      })
    };
    (global as any).AnimationEngine = {
      play: jest.fn(async () => {
        order.push('play');
        throw new Error('strict playback failed');
      })
    };

    const PresentationHandler = require('../ui/presentation-handler.js');
    await expect(PresentationHandler.handlePresentationEvent({
      type: 'PLAYBACK_EVENTS',
      events: [{ type: 'move', phase: 1 }],
      meta: { source: 'network_timeline', strictNetworkPlayback: true, visualSeq: 8 }
    })).rejects.toThrow('strict playback failed');

    expect(order).toEqual([
      'manager-claim',
      'board-claim',
      'play',
      'board-abort',
      'manager-release'
    ]);
  });

  test('finalizes a registered strict playback run when committed-frame preparation fails before handoff', async () => {
    const order: string[] = [];
    const managerClaim = { id: 45 };
    const boardWriterToken = { id: 46 };
    jest.doMock('../ui/board-renderer', () => ({
      claimBoardVisualWriter: jest.fn(() => {
        order.push('board-claim');
        return boardWriterToken;
      }),
      beginBoardVisualFrameCommit: jest.fn(() => {
        order.push('board-prepare');
        return false;
      }),
      abortBoardVisualWriterBeforeHandoff: jest.fn(async (token) => {
        expect(token).toBe(boardWriterToken);
        order.push('board-abort');
        return true;
      })
    }));
    (global as any).GameEvents = { gameEvents: { on: jest.fn() } };
    (global as any).PlaybackStateManager = {
      claimVisualPlayback: jest.fn(() => {
        order.push('manager-claim');
        return managerClaim;
      }),
      releaseVisualPlaybackClaim: jest.fn((claim) => {
        expect(claim).toBe(managerClaim);
        order.push('manager-release');
        return true;
      })
    };
    (global as any).AnimationEngine = {
      play: jest.fn(async () => {
        order.push('play');
        return createPlaybackSettlement(() => {
          order.push('manager-finalize');
        });
      })
    };

    const PresentationHandler = require('../ui/presentation-handler.js');
    await expect(PresentationHandler.handlePresentationEvent({
      type: 'PLAYBACK_EVENTS',
      events: [{ type: 'move', phase: 1 }],
      meta: { source: 'network_timeline', strictNetworkPlayback: true, visualSeq: 82 }
    })).rejects.toEqual(expect.objectContaining({
      name: 'PresentationPlaybackError',
      code: 'strict_network_commit_prepare_failed',
      strictNetworkPlayback: true,
      visualSeq: 82
    }));

    expect(order).toEqual([
      'manager-claim',
      'board-claim',
      'play',
      'board-prepare',
      'board-abort',
      'manager-finalize',
      'manager-release'
    ]);
  });

  test('retains a strict recovery handle when manager release fails before handoff', async () => {
    const managerClaim = { id: 43 };
    const boardWriterToken = { id: 44 };
    const abortBoardVisualWriterBeforeHandoff = jest.fn(async () => true);
    jest.doMock('../ui/board-renderer', () => ({
      claimBoardVisualWriter: jest.fn(() => boardWriterToken),
      abortBoardVisualWriterBeforeHandoff
    }));
    (global as any).GameEvents = { gameEvents: { on: jest.fn() } };
    const releaseVisualPlaybackClaim = jest.fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const recordVisualPlaybackSettlementError = jest.fn(() => true);
    (global as any).PlaybackStateManager = {
      claimVisualPlayback: jest.fn(() => managerClaim),
      releaseVisualPlaybackClaim,
      recordVisualPlaybackSettlementError
    };
    (global as any).AnimationEngine = {
      play: jest.fn(async () => {
        throw new Error('strict playback failed before handoff');
      })
    };

    const PresentationHandler = require('../ui/presentation-handler.js');
    const error = await PresentationHandler.handlePresentationEvent({
      type: 'PLAYBACK_EVENTS',
      events: [{ type: 'move', phase: 1 }],
      meta: { source: 'network_timeline', strictNetworkPlayback: true, visualSeq: 81 }
    }).catch((caught: any) => caught);

    expect(error).toMatchObject({ message: 'strict playback failed before handoff' });
    expect(error.recoveryError).toMatchObject({
      name: 'PresentationPlaybackError',
      code: 'strict_network_manager_release_failed',
      strictNetworkPlayback: true,
      visualSeq: 81
    });
    expect(error.strictSettlementRecoveryHandle).toMatchObject({
      kind: 'strict-network-settlement',
      visualSeq: 81
    });
    expect(abortBoardVisualWriterBeforeHandoff).toHaveBeenCalledTimes(1);
    expect(releaseVisualPlaybackClaim).toHaveBeenCalledTimes(1);

    await expect(error.strictSettlementRecoveryHandle.cancel('release_retry')).resolves.toBe(true);
    expect(recordVisualPlaybackSettlementError).toHaveBeenCalledWith(
      managerClaim,
      expect.objectContaining({ message: 'release_retry' }),
      { stage: 'pre-handoff-recovery-cancel', visualSeq: 81 }
    );
    expect(abortBoardVisualWriterBeforeHandoff).toHaveBeenCalledTimes(1);
    expect(releaseVisualPlaybackClaim).toHaveBeenCalledTimes(2);
  });

  test('cancels a handed-off strict settlement with manager lock held until board restore', async () => {
    const order: string[] = [];
    const managerClaim = { id: 51 };
    const boardWriterToken = { id: 52 };
    jest.doMock('../ui/board-renderer', () => ({
      claimBoardVisualWriter: jest.fn(() => {
        order.push('board-claim');
        return boardWriterToken;
      }),
      beginBoardVisualFrameCommit: jest.fn(() => {
        order.push('board-await-commit');
        return true;
      }),
      cancelBoardVisualWriterAfterHandoff: jest.fn(async (token) => {
        expect(token).toBe(boardWriterToken);
        order.push('board-cancel');
        return true;
      })
    }));
    (global as any).GameEvents = { gameEvents: { on: jest.fn() } };
    (global as any).PlaybackStateManager = {
      claimVisualPlayback: jest.fn(() => {
        order.push('manager-claim');
        return managerClaim;
      }),
      recordVisualPlaybackSettlementError: jest.fn((claim) => {
        expect(claim).toBe(managerClaim);
        order.push('manager-pause');
        return true;
      }),
      releaseVisualPlaybackClaim: jest.fn((claim) => {
        expect(claim).toBe(managerClaim);
        order.push('manager-release');
        return true;
      })
    };
    (global as any).AnimationEngine = {
      play: jest.fn(async () => {
        order.push('play');
        return createPlaybackSettlement(() => {
          order.push('manager-finalize');
        });
      })
    };

    const PresentationHandler = require('../ui/presentation-handler.js');
    const handle = await PresentationHandler.handlePresentationEvent({
      type: 'PLAYBACK_EVENTS',
      events: [{ type: 'move', phase: 1 }],
      meta: { source: 'network_timeline', strictNetworkPlayback: true, visualSeq: 9 }
    });

    await expect(Promise.all([
      handle.cancel('session-switch'),
      handle.cancel('duplicate')
    ])).resolves.toEqual([true, true]);
    await expect(handle.cancel('after-release')).resolves.toBe(false);
    expect(order).toEqual([
      'manager-claim',
      'board-claim',
      'play',
      'board-await-commit',
      'manager-pause',
      'board-cancel',
      'manager-finalize',
      'manager-release'
    ]);
  });

  test('keeps boot-time presentation events queued and unclaimed until the board backend is ready', async () => {
    let resolveReady!: () => void;
    const ready = new Promise<void>((resolve) => { resolveReady = resolve; });
    const order: string[] = [];
    const drainClaim = { id: 81 };
    const batchClaim = { id: 82 };
    const boardWriterToken = { id: 83, frameToken: 'local:boot-ready', mode: 'local' };
    const runtime = {
      createBoardUpdateDrainController: jest.fn(() => ({
        requestDrain: async (runDrain: any) => runDrain()
      })),
      flushPendingPresentationEvents: jest.fn(() => {
        order.push('flush');
        return [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'move', phase: 1 }] }];
      })
    };
    jest.doMock('../game/cpu-turn-handler', () => ({ PresentationRuntime: runtime }));
    const claimBoardVisualWriter = jest.fn(() => {
      order.push('board-claim');
      return boardWriterToken;
    });
    jest.doMock('../ui/board-renderer', () => ({
      getBoardVisualControllerReady: jest.fn(async () => {
        order.push('ready-wait');
        await ready;
        order.push('ready');
      }),
      claimBoardVisualWriter,
      settleBoardVisualWriter: jest.fn(async () => {
        order.push('board-settle');
        return true;
      }),
      releaseBoardVisualWriter: jest.fn()
    }));
    (global as any).GameEvents = { gameEvents: { on: jest.fn() } };
    (global as any).PlaybackStateManager = {
      claimVisualPlayback: jest.fn((meta) => {
        order.push(`manager-claim:${meta.scope}`);
        return meta.scope === 'presentation_drain' ? drainClaim : batchClaim;
      }),
      releaseVisualPlaybackClaim: jest.fn(() => true),
      hasClaimedVisualPlayback: jest.fn(() => true)
    };
    (global as any).AnimationEngine = {
      play: jest.fn(async () => {
        order.push('play');
        return createPlaybackSettlement();
      })
    };

    const PresentationHandler = require('../ui/presentation-handler.js');
    let finished = false;
    const draining = PresentationHandler.onBoardUpdated().then(() => { finished = true; });
    await flushMicrotasks(2);

    expect(finished).toBe(false);
    expect(runtime.flushPendingPresentationEvents).not.toHaveBeenCalled();
    expect((global as any).PlaybackStateManager.claimVisualPlayback).not.toHaveBeenCalled();
    expect(claimBoardVisualWriter).not.toHaveBeenCalled();

    resolveReady();
    await draining;

    expect(order.slice(0, 4)).toEqual([
      'ready-wait',
      'ready',
      'flush',
      'manager-claim:presentation_drain'
    ]);
    expect(order.indexOf('board-claim')).toBeGreaterThan(order.indexOf('flush'));
    expect(order.indexOf('play')).toBeGreaterThan(order.indexOf('board-claim'));
    expect(order).toContain('board-settle');
  });

  test('holds a drain claim across multiple drained playback batches', async () => {
    const order: string[] = [];
    let activeRunId: number | null = null;
    let nextRunId = 0;
    const drainClaim = { id: 1 };
    const batchClaimOne = { id: 2 };
    const batchClaimTwo = { id: 3 };
    const claims = [drainClaim, batchClaimOne, batchClaimTwo];
    const runtime = {
      createBoardUpdateDrainController: jest.fn(() => ({
        requestDrain: async (runDrain: any) => {
          await runDrain();
        }
      })),
      scheduleCpuTurn: jest.fn(),
      flushPendingPresentationEvents: jest.fn(() => [
        { type: 'PLAYBACK_EVENTS', events: [{ type: 'move', phase: 1 }] },
        { type: 'PLAYBACK_EVENTS', events: [{ type: 'destroy', phase: 2, targets: [{ r: 2, col: 3 }] }] }
      ])
    };
    jest.doMock('../game/cpu-turn-handler', () => ({
      PresentationRuntime: runtime
    }));
    const boardWriterToken = { id: 11, frameToken: 'local:1', mode: 'local' };
    jest.doMock('../ui/board-renderer', () => ({
      claimBoardVisualWriter: jest.fn((frameToken, mode) => {
        order.push(`board-claim:${frameToken}:${mode}`);
        return boardWriterToken;
      }),
      renderBoard: jest.fn(() => {
        order.push('board-final-sync');
      }),
      releaseBoardVisualWriter: jest.fn((token) => {
        expect(token).toBe(boardWriterToken);
        order.push('board-release');
        return true;
      })
    }));
    (global as any).GameEvents = {
      gameEvents: {
        on: jest.fn()
      }
    };
    (global as any).PlaybackStateManager = {
      claimVisualPlayback: jest.fn((meta) => {
        order.push(`claim:${meta.scope}`);
        return claims.shift();
      }),
      releaseVisualPlaybackClaim: jest.fn((claim) => {
        order.push(`release:${claim.id}`);
        return true;
      }),
      hasClaimedVisualPlayback: jest.fn(() => true)
    };
    (global as any).AnimationEngine = {
      play: jest.fn(async (payload) => {
        order.push(`play:${payload[0].type}`);
        const runId = ++nextRunId;
        activeRunId = runId;
        let finalized = false;
        const settlement = Object.freeze({
          kind: 'deferred-finalization' as const,
          runId,
          mode: 'finalize' as const,
          finalize() {
            if (finalized || activeRunId !== runId) return false;
            order.push(`finalize:${payload[0].type}`);
            finalized = true;
            activeRunId = null;
            return true;
          }
        });
        if (payload[0].type === 'move') {
          order.push(`between:${(global as any).PlaybackStateManager.hasClaimedVisualPlayback()}`);
        }
        return settlement;
      })
    };

    const PresentationHandler = require('../ui/presentation-handler.js');

    await PresentationHandler.onBoardUpdated();

    expect(order).toEqual([
      'claim:presentation_drain',
      'board-claim:local:1:local',
      'claim:batch_handoff',
      'play:move',
      'between:true',
      'release:2',
      'finalize:move',
      'claim:batch_handoff',
      'play:destroy',
      'release:3',
      'board-final-sync',
      'board-release',
      'finalize:destroy',
      'release:1'
    ]);
  });

  test('retains local writer and manager claims until final-frame recovery succeeds without replaying events', async () => {
    const order: string[] = [];
    const managerClaim = { id: 21 };
    const batchClaim = { id: 22 };
    const boardWriterToken = { id: 23, frameToken: 'local:21', mode: 'local' };
    let flushCount = 0;
    let releaseAttempts = 0;
    const runtime = {
      createBoardUpdateDrainController: jest.fn(() => ({
        requestDrain: async (runDrain: any) => runDrain()
      })),
      scheduleCpuTurn: jest.fn(),
      flushPendingPresentationEvents: jest.fn(() => {
        flushCount += 1;
        return flushCount === 1
          ? [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'move', phase: 1 }] }]
          : [];
      })
    };
    jest.doMock('../game/cpu-turn-handler', () => ({ PresentationRuntime: runtime }));
    jest.doMock('../ui/board-renderer', () => ({
      claimBoardVisualWriter: jest.fn(() => {
        order.push('board-claim');
        return boardWriterToken;
      }),
      renderBoard: jest.fn(() => order.push('board-final-sync')),
      releaseBoardVisualWriter: jest.fn((token) => {
        expect(token).toBe(boardWriterToken);
        releaseAttempts += 1;
        order.push(`board-release:${releaseAttempts}`);
        if (releaseAttempts === 1) throw new Error('context lost');
        return true;
      })
    }));
    (global as any).GameEvents = { gameEvents: { on: jest.fn() } };
    (global as any).PlaybackStateManager = {
      claimVisualPlayback: jest.fn((meta) => meta.scope === 'presentation_drain' ? managerClaim : batchClaim),
      releaseVisualPlaybackClaim: jest.fn((claim) => {
        order.push(`manager-release:${claim.id}`);
        return true;
      }),
      hasClaimedVisualPlayback: jest.fn(() => true)
    };
    (global as any).AnimationEngine = {
      play: jest.fn(async () => {
        order.push('play');
        return createPlaybackSettlement(() => {
          order.push('manager-finalize');
        });
      })
    };

    const PresentationHandler = require('../ui/presentation-handler.js');

    await expect(PresentationHandler.onBoardUpdated()).rejects.toThrow('context lost');
    expect((global as any).AnimationEngine.play).toHaveBeenCalledTimes(1);
    expect((global as any).PlaybackStateManager.releaseVisualPlaybackClaim).toHaveBeenCalledTimes(1);
    expect((global as any).PlaybackStateManager.releaseVisualPlaybackClaim).toHaveBeenCalledWith(batchClaim);

    await PresentationHandler.onBoardUpdated();

    expect((global as any).AnimationEngine.play).toHaveBeenCalledTimes(1);
    expect(order).toEqual([
      'board-claim',
      'play',
      'manager-release:22',
      'board-final-sync',
      'board-release:1',
      'board-final-sync',
      'board-release:2',
      'manager-finalize',
      'manager-release:21'
    ]);
  });

  test('retains a drain settlement after a transient finalizer failure and retries without replay', async () => {
    const order: string[] = [];
    const drainClaim = { id: 31 };
    const batchClaim = { id: 32 };
    const boardWriterToken = { id: 33, frameToken: 'local:31', mode: 'local' };
    let flushCount = 0;
    let finalizeAttempts = 0;
    const runtime = {
      createBoardUpdateDrainController: jest.fn(() => ({
        requestDrain: async (runDrain: any) => runDrain()
      })),
      scheduleCpuTurn: jest.fn(),
      flushPendingPresentationEvents: jest.fn(() => {
        flushCount += 1;
        return flushCount === 1
          ? [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'move', phase: 1 }] }]
          : [];
      })
    };
    jest.doMock('../game/cpu-turn-handler', () => ({ PresentationRuntime: runtime }));
    jest.doMock('../ui/board-renderer', () => ({
      getBoardVisualControllerReady: jest.fn(async () => undefined),
      claimBoardVisualWriter: jest.fn(() => {
        order.push('board-claim');
        return boardWriterToken;
      }),
      settleBoardVisualWriter: jest.fn(async (token) => {
        expect(token).toBe(boardWriterToken);
        order.push('board-settle');
        return true;
      }),
      releaseBoardVisualWriter: jest.fn(() => true),
      settleAutoBoardVisualWriter: jest.fn(async () => true)
    }));
    (global as any).GameEvents = { gameEvents: { on: jest.fn() } };
    (global as any).PlaybackStateManager = {
      claimVisualPlayback: jest.fn((meta) => (
        meta.scope === 'presentation_drain' ? drainClaim : batchClaim
      )),
      releaseVisualPlaybackClaim: jest.fn((claim) => {
        order.push(`manager-release:${claim.id}`);
        return true;
      }),
      hasClaimedVisualPlayback: jest.fn(() => true)
    };
    (global as any).AnimationEngine = {
      play: jest.fn(async () => {
        order.push('play');
        return createPlaybackSettlement(() => {
          finalizeAttempts += 1;
          order.push(`manager-finalize:${finalizeAttempts}`);
          if (finalizeAttempts === 1) throw new Error('temporary manager failure');
        });
      })
    };

    const PresentationHandler = require('../ui/presentation-handler.js');

    await expect(PresentationHandler.onBoardUpdated()).rejects.toThrow('temporary manager failure');
    expect((global as any).AnimationEngine.play).toHaveBeenCalledTimes(1);
    expect((global as any).PlaybackStateManager.releaseVisualPlaybackClaim).toHaveBeenCalledTimes(1);
    expect((global as any).PlaybackStateManager.releaseVisualPlaybackClaim).toHaveBeenCalledWith(batchClaim);

    await expect(PresentationHandler.onBoardUpdated()).resolves.toBeUndefined();

    expect((global as any).AnimationEngine.play).toHaveBeenCalledTimes(1);
    expect(order).toEqual([
      'board-claim',
      'play',
      'manager-release:32',
      'board-settle',
      'manager-finalize:1',
      'manager-finalize:2',
      'manager-release:31'
    ]);
  });

  test('keeps standalone cosmetic board effects fire-and-forget while sharing one writer lease', async () => {
    const deferred = () => {
      let resolve!: () => void;
      const promise = new Promise<void>((done) => { resolve = done; });
      return { promise, resolve };
    };
    const ready = deferred();
    const crossfade = deferred();
    const protection = deferred();
    const boardWriterToken = { id: 51, frameToken: 'local:legacy-presentation:1', mode: 'local' };
    const runtime = {
      createBoardUpdateDrainController: jest.fn(() => ({
        requestDrain: async (runDrain: any) => runDrain()
      })),
      flushPendingPresentationEvents: jest.fn(() => [
        { type: 'CROSSFADE_STONE', row: 1, col: 2, durationMs: 600 },
        { type: 'PROTECTION_EXPIRE', row: 3, col: 4, durationMs: 600 }
      ])
    };
    jest.doMock('../game/cpu-turn-handler', () => ({ PresentationRuntime: runtime }));
    const claimBoardVisualWriter = jest.fn(() => boardWriterToken);
    const playBoardVisualPhase = jest.fn((_token, events) => {
      return events[0].type === 'CROSSFADE_STONE' ? crossfade.promise : protection.promise;
    });
    const settleBoardVisualWriter = jest.fn(async () => true);
    jest.doMock('../ui/board-renderer', () => ({
      getBoardVisualControllerReady: jest.fn(() => ready.promise),
      claimBoardVisualWriter,
      playBoardVisualPhase,
      settleBoardVisualWriter,
      releaseBoardVisualWriter: jest.fn()
    }));
    (global as any).GameEvents = { gameEvents: { on: jest.fn() } };
    (global as any).PlaybackStateManager = {
      claimVisualPlayback: jest.fn(),
      releaseVisualPlaybackClaim: jest.fn()
    };

    const PresentationHandler = require('../ui/presentation-handler.js');
    let drainFinished = false;
    const draining = PresentationHandler.onBoardUpdated().then(() => { drainFinished = true; });
    await Promise.resolve();
    await Promise.resolve();

    expect(drainFinished).toBe(false);
    expect(runtime.flushPendingPresentationEvents).not.toHaveBeenCalled();
    expect((global as any).PlaybackStateManager.claimVisualPlayback).not.toHaveBeenCalled();
    expect(claimBoardVisualWriter).not.toHaveBeenCalled();

    ready.resolve();
    await draining;
    await flushMicrotasks(2);
    expect(drainFinished).toBe(true);
    expect(claimBoardVisualWriter).toHaveBeenCalledTimes(1);
    expect(playBoardVisualPhase).toHaveBeenCalledTimes(2);
    expect(playBoardVisualPhase.mock.calls.map((call) => call[0])).toEqual([
      boardWriterToken,
      boardWriterToken
    ]);

    crossfade.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(settleBoardVisualWriter).not.toHaveBeenCalled();

    protection.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(settleBoardVisualWriter).toHaveBeenCalledTimes(1);
    expect(settleBoardVisualWriter).toHaveBeenCalledWith(boardWriterToken);
  });

  test('recovers a detached cosmetic lease before a later fire-and-forget effect claims again', async () => {
    const firstToken = { id: 61, frameToken: 'local:legacy-presentation:1', mode: 'local' };
    const secondToken = { id: 62, frameToken: 'local:legacy-presentation:2', mode: 'local' };
    const claimBoardVisualWriter = jest.fn()
      .mockReturnValueOnce(firstToken)
      .mockReturnValueOnce(secondToken);
    const playBoardVisualPhase = jest.fn(async () => undefined);
    const enterBoardVisualRecovery = jest.fn(() => true);
    const settleBoardVisualWriter = jest.fn()
      .mockRejectedValueOnce(new Error('initial_settlement_failed'))
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);
    const releaseBoardVisualWriter = jest.fn();
    jest.doMock('../ui/board-renderer', () => ({
      getBoardVisualControllerReady: jest.fn(async () => undefined),
      claimBoardVisualWriter,
      playBoardVisualPhase,
      enterBoardVisualRecovery,
      settleBoardVisualWriter,
      releaseBoardVisualWriter
    }));
    (global as any).GameEvents = { gameEvents: { on: jest.fn() } };
    const claimVisualPlayback = jest.fn();
    const setInteractionLock = jest.fn((locked) => locked === true);
    const recordVisualPlaybackSettlementError = jest.fn(() => true);
    const releaseVisualPlaybackClaim = jest.fn(() => true);
    (global as any).PlaybackStateManager = {
      claimVisualPlayback,
      setInteractionLock,
      recordVisualPlaybackSettlementError,
      releaseVisualPlaybackClaim
    };

    const PresentationHandler = require('../ui/presentation-handler.js');
    expect(PresentationHandler.handlePresentationEvent({
      type: 'CROSSFADE_STONE',
      row: 1,
      col: 2
    })).toBeUndefined();
    await flushMicrotasks();

    expect(claimBoardVisualWriter).toHaveBeenCalledTimes(1);
    expect(playBoardVisualPhase).toHaveBeenCalledTimes(1);
    expect(enterBoardVisualRecovery).toHaveBeenCalledTimes(1);
    expect(enterBoardVisualRecovery).toHaveBeenCalledWith(firstToken, expect.objectContaining({
      name: 'PresentationPlaybackError',
      code: 'board_writer_settlement_failed'
    }));
    expect(settleBoardVisualWriter).toHaveBeenCalledTimes(2);
    expect(releaseBoardVisualWriter).not.toHaveBeenCalled();

    expect(PresentationHandler.handlePresentationEvent({
      type: 'PROTECTION_EXPIRE',
      row: 3,
      col: 4
    })).toBeUndefined();
    await flushMicrotasks();

    expect(claimBoardVisualWriter).toHaveBeenCalledTimes(2);
    expect(playBoardVisualPhase).toHaveBeenCalledTimes(2);
    expect(settleBoardVisualWriter).toHaveBeenCalledTimes(3);
    expect(settleBoardVisualWriter).toHaveBeenNthCalledWith(3, secondToken);
    expect(releaseBoardVisualWriter).not.toHaveBeenCalled();
    expect(claimVisualPlayback).not.toHaveBeenCalled();
    expect(setInteractionLock).not.toHaveBeenCalled();
    expect(recordVisualPlaybackSettlementError).not.toHaveBeenCalled();
    expect(releaseVisualPlaybackClaim).not.toHaveBeenCalled();
  });

  test('retains a detached cosmetic lease and typed-rejects the next launch when recovery fails', async () => {
    const retainedToken = { id: 71, frameToken: 'local:legacy-presentation:1', mode: 'local' };
    const managerClaim = { id: 72 };
    const caughtErrors: any[] = [];
    const originalCatch = Promise.prototype.catch;
    const catchSpy = jest.spyOn(Promise.prototype as any, 'catch').mockImplementation(function (
      this: Promise<any>,
      onRejected: any
    ) {
      return originalCatch.call(this, (error: any) => {
        caughtErrors.push(error);
        return typeof onRejected === 'function' ? onRejected(error) : undefined;
      });
    });
    const claimBoardVisualWriter = jest.fn(() => retainedToken);
    const playBoardVisualPhase = jest.fn(async () => undefined);
    const enterBoardVisualRecovery = jest.fn(() => true);
    const settleBoardVisualWriter = jest.fn(async () => {
      throw new Error('checkpoint_restore_failed');
    });
    const releaseBoardVisualWriter = jest.fn();
    jest.doMock('../ui/board-renderer', () => ({
      getBoardVisualControllerReady: jest.fn(async () => undefined),
      claimBoardVisualWriter,
      playBoardVisualPhase,
      enterBoardVisualRecovery,
      settleBoardVisualWriter,
      releaseBoardVisualWriter
    }));
    (global as any).GameEvents = { gameEvents: { on: jest.fn() } };
    const claimVisualPlayback = jest.fn(() => managerClaim);
    const setInteractionLock = jest.fn((locked) => locked === true);
    const recordVisualPlaybackSettlementError = jest.fn(() => true);
    const releaseVisualPlaybackClaim = jest.fn(() => true);
    (global as any).PlaybackStateManager = {
      claimVisualPlayback,
      setInteractionLock,
      recordVisualPlaybackSettlementError,
      releaseVisualPlaybackClaim
    };

    try {
      const PresentationHandler = require('../ui/presentation-handler.js');
      expect(PresentationHandler.handlePresentationEvent({
        type: 'CROSSFADE_STONE',
        row: 2,
        col: 2
      })).toBeUndefined();
      await flushMicrotasks();
      expect(PresentationHandler.handlePresentationEvent({
        type: 'PROTECTION_EXPIRE',
        row: 2,
        col: 3
      })).toBeUndefined();
      await flushMicrotasks();
    } finally {
      catchSpy.mockRestore();
    }

    expect(caughtErrors.filter((error) => error && error.code).map((error) => error.code)).toEqual([
      'board_writer_settlement_failed',
      'board_writer_recovery_unresolved'
    ]);
    expect(claimBoardVisualWriter).toHaveBeenCalledTimes(1);
    expect(playBoardVisualPhase).toHaveBeenCalledTimes(1);
    expect(enterBoardVisualRecovery).toHaveBeenCalledTimes(1);
    expect(settleBoardVisualWriter).toHaveBeenCalledTimes(2);
    expect(settleBoardVisualWriter.mock.calls.map((call) => call[0])).toEqual([
      retainedToken,
      retainedToken
    ]);
    expect(releaseBoardVisualWriter).not.toHaveBeenCalled();
    expect(claimVisualPlayback).toHaveBeenCalledTimes(1);
    expect(claimVisualPlayback).toHaveBeenCalledWith(expect.objectContaining({
      source: 'presentation-handler',
      scope: 'generic',
      reason: 'detached_board_writer_recovery_unresolved',
      eventCount: 1,
      eventTypes: ['CROSSFADE_STONE'],
      strictNetworkPlayback: false,
      restoreBusyBaseline: false
    }));
    expect(setInteractionLock).toHaveBeenCalledTimes(1);
    expect(setInteractionLock).toHaveBeenCalledWith(true);
    expect(recordVisualPlaybackSettlementError).toHaveBeenCalledTimes(1);
    expect(recordVisualPlaybackSettlementError).toHaveBeenCalledWith(
      managerClaim,
      expect.objectContaining({
        name: 'PresentationPlaybackError',
        code: 'board_writer_settlement_failed'
      }),
      { stage: 'detached-board-writer-recovery' }
    );
    expect(releaseVisualPlaybackClaim).not.toHaveBeenCalled();
  });
});
