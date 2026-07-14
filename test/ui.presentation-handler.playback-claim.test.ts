describe('PresentationHandler playback claim', () => {
  afterEach(() => {
    jest.dontMock('../game/cpu-turn-handler');
    jest.dontMock('../ui/board-renderer');
    jest.resetModules();
    delete (global as any).AnimationEngine;
    delete (global as any).GameEvents;
    delete (global as any).GamePresentationRuntime;
    delete (global as any).PlaybackStateManager;
  });

  test('claims visual playback before dispatching AnimationEngine playback', async () => {
    const order: string[] = [];
    const claim = { id: 7 };
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
      play: jest.fn(async (_events, options) => {
        order.push('play');
        options.onFinalizationReady(() => {
          order.push('finalize');
          return true;
        });
      })
    };

    const PresentationHandler = require('../ui/presentation-handler.js');

    await PresentationHandler.handlePresentationEvent({
      type: 'PLAYBACK_EVENTS',
      events: [{ type: 'destroy', phase: 1, targets: [{ r: 2, col: 3 }] }],
      meta: { source: 'unit-test' }
    });

    expect(order).toEqual(['claim', 'play', 'finalize', 'release']);
    expect((global as any).PlaybackStateManager.claimVisualPlayback).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'unit-test',
        eventCount: 1,
        eventTypes: ['destroy']
      })
    );
    expect((global as any).AnimationEngine.play).toHaveBeenCalledWith(
      [{ type: 'destroy', phase: 1, targets: [{ r: 2, col: 3 }] }],
      expect.objectContaining({ deferFinalSettlement: true })
    );
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
      play: jest.fn(async (_events, options) => {
        order.push('play');
        (global as any).emitBoardUpdate();
        options.onFinalizationReady(() => {
          order.push('finalize');
          return true;
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

  test('hands strict network ownership to an opaque settlement handle until committed-frame sync succeeds', async () => {
    const order: string[] = [];
    const managerClaim = { id: 31 };
    const boardWriterToken = { id: 32, frameToken: 'network:7', mode: 'network' };
    jest.doMock('../ui/board-renderer', () => ({
      claimBoardVisualWriter: jest.fn((frameToken, mode) => {
        order.push(`board-claim:${frameToken}:${mode}`);
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
        order.push('board-apply-committed');
        return true;
      }),
      releaseBoardVisualWriter: jest.fn((token) => {
        expect(token).toBe(boardWriterToken);
        order.push('board-release');
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
      play: jest.fn(async (_events, options) => {
        order.push('play');
        options.onFinalizationReady(() => {
          order.push('manager-finalize');
          return true;
        });
      })
    };

    const PresentationHandler = require('../ui/presentation-handler.js');
    const handle = await PresentationHandler.handlePresentationEvent({
      type: 'PLAYBACK_EVENTS',
      events: [{ type: 'move', phase: 1 }],
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

    const receipt = Object.freeze({
      kind: 'network-visual-commit',
      visualSeq: 7,
      visualVersion: 8
    });
    await handle.applyCommittedFrame(receipt);
    await handle.applyCommittedFrame(receipt);
    await handle.settle();
    await expect(handle.settle()).resolves.toBe(false);
    expect(order).toEqual([
      'manager-claim',
      'board-claim:network:7:network',
      'play',
      'board-await-commit',
      'board-apply-committed',
      'board-release',
      'manager-finalize',
      'manager-release'
    ]);
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
      play: jest.fn(async (_events, options) => {
        order.push('play');
        options.onFinalizationReady(() => {
          order.push('manager-finalize');
          return true;
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

  test('holds a drain claim across multiple drained playback batches', async () => {
    const order: string[] = [];
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
      play: jest.fn(async (payload, options) => {
        order.push(`play:${payload[0].type}`);
        options.onFinalizationReady(() => {
          order.push(`finalize:${payload[0].type}`);
          return true;
        });
        if (payload[0].type === 'move') {
          order.push(`between:${(global as any).PlaybackStateManager.hasClaimedVisualPlayback()}`);
        }
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
      'claim:batch_handoff',
      'play:destroy',
      'release:3',
      'board-final-sync',
      'board-release',
      'finalize:move',
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
      play: jest.fn(async (_payload, options) => {
        order.push('play');
        options.onFinalizationReady(() => {
          order.push('manager-finalize');
          return true;
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
});
