describe('PresentationHandler playback claim', () => {
  afterEach(() => {
    jest.dontMock('../game/cpu-turn-handler');
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
      play: jest.fn(async () => {
        order.push('play');
      })
    };

    const PresentationHandler = require('../ui/presentation-handler.js');

    await PresentationHandler.handlePresentationEvent({
      type: 'PLAYBACK_EVENTS',
      events: [{ type: 'destroy', phase: 1, targets: [{ r: 2, col: 3 }] }],
      meta: { source: 'unit-test' }
    });

    expect(order).toEqual(['claim', 'play', 'release']);
    expect((global as any).PlaybackStateManager.claimVisualPlayback).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'unit-test',
        eventCount: 1,
        eventTypes: ['destroy']
      })
    );
    expect((global as any).AnimationEngine.play).toHaveBeenCalledWith([
      { type: 'destroy', phase: 1, targets: [{ r: 2, col: 3 }] }
    ]);
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
        if (payload[0].type === 'move') {
          order.push(`between:${(global as any).PlaybackStateManager.hasClaimedVisualPlayback()}`);
        }
      })
    };

    const PresentationHandler = require('../ui/presentation-handler.js');

    await PresentationHandler.onBoardUpdated();

    expect(order).toEqual([
      'claim:presentation_drain',
      'claim:batch_handoff',
      'play:move',
      'between:true',
      'release:2',
      'claim:batch_handoff',
      'play:destroy',
      'release:3',
      'release:1'
    ]);
  });
});
