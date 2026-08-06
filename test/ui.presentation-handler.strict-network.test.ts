describe('PresentationHandler strict network playback', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('../ui/board-renderer');
    delete (global as any).AnimationEngine;
    delete (global as any).GameEvents;
  });

  test('passes strict option through and rejects playback failures', async () => {
    const playbackError = new Error('network_playback_watchdog');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const boardWriterToken = Object.freeze({ id: 1, frameToken: 'network:1', mode: 'network' });
    const abortBoardVisualWriterBeforeHandoff = jest.fn(async () => true);
    jest.doMock('../ui/board-renderer', () => ({
      claimBoardVisualWriter: jest.fn(() => boardWriterToken),
      abortBoardVisualWriterBeforeHandoff
    }));
    (global as any).GameEvents = {
      gameEvents: {
        on: jest.fn()
      }
    };
    (global as any).AnimationEngine = {
      play: jest.fn().mockRejectedValue(playbackError)
    };

    try {
      const PresentationHandler = require('../ui/presentation-handler.js');

      await expect(PresentationHandler.handlePresentationEvent({
        type: 'PLAYBACK_EVENTS',
        events: [{
          type: 'CROSSFADE_STONE',
          phase: 1,
          row: 2,
          col: 3,
          effectKey: 'regenStone',
          durationMs: 600
        }],
        meta: {
          source: 'network_timeline',
          strictNetworkPlayback: true,
          visualSeq: 1
        }
      })).rejects.toThrow(/network_playback_watchdog/);

      expect((global as any).AnimationEngine.play).toHaveBeenCalledWith(
        [expect.objectContaining({
          type: 'crossfade_stone',
          phase: 1,
          row: 2,
          col: 3,
          effectKey: 'regenStone',
          durationMs: 600,
          visualSeq: 1,
          meta: expect.objectContaining({ visualSeq: 1 })
        })],
        expect.objectContaining({
          strictNetworkPlayback: true,
          deferFinalSettlement: true
        })
      );
      expect((global as any).AnimationEngine.play.mock.calls[0][1]).not.toHaveProperty('onFinalizationReady');
      expect(abortBoardVisualWriterBeforeHandoff).toHaveBeenCalledWith(boardWriterToken);
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('defers a special-stone speech bubble until the committed network frame has its cell anchor', async () => {
    const boardWriterToken = Object.freeze({ id: 17, frameToken: 'network:17', mode: 'network' });
    const cellRect = Object.freeze({
      left: 120,
      top: 220,
      right: 160,
      bottom: 260,
      width: 40,
      height: 40
    });
    let committed = false;
    const renderer = {
      claimBoardVisualWriter: jest.fn(() => boardWriterToken),
      getBoardVisualControllerReady: jest.fn(async () => undefined),
      getBoardCellClientRect: jest.fn(() => (committed ? cellRect : null)),
      beginBoardVisualFrameCommit: jest.fn(() => true),
      applyCommittedBoardVisualFrame: jest.fn(async () => {
        committed = true;
        return true;
      }),
      releaseBoardVisualWriter: jest.fn()
    };
    const playbackSettlement = Object.freeze({
      kind: 'deferred-finalization',
      runId: 1,
      mode: 'finalize',
      finalize: jest.fn(() => true)
    });
    jest.doMock('../ui/board-renderer', () => renderer);
    (global as any).GameEvents = { gameEvents: { on: jest.fn() } };
    (global as any).AnimationEngine = {
      play: jest.fn(async () => playbackSettlement),
      handleObserverBubble: jest.fn(async () => {
        expect(committed).toBe(true);
        expect(renderer.getBoardCellClientRect(2, 3)).toBe(cellRect);
      })
    };

    const PresentationHandler = require('../ui/presentation-handler.js');
    const settlement = await PresentationHandler.handlePresentationEvent({
      type: 'PLAYBACK_EVENTS',
      events: [{
        type: 'observer_bubble',
        rawType: 'SPECIAL_STONE_BUBBLE',
        phase: 3,
        targets: [{
          r: 2,
          col: 3,
          owner: 'black',
          special: 'TIME_STOP',
          text: '時は止まった'
        }]
      }],
      meta: {
        source: 'network_timeline',
        strictNetworkPlayback: true,
        visualSeq: 17
      }
    });

    expect((global as any).AnimationEngine.play).not.toHaveBeenCalled();
    expect((global as any).AnimationEngine.handleObserverBubble).not.toHaveBeenCalled();

    await settlement.applyCommittedFrame({
      kind: 'network-visual-commit',
      visualSeq: 17,
      visualVersion: 42,
      snapshotOwnership: 'copy_on_commit'
    });

    expect(renderer.applyCommittedBoardVisualFrame).toHaveBeenCalledWith(
      boardWriterToken,
      expect.objectContaining({ visualSeq: 17 })
    );
    expect((global as any).AnimationEngine.handleObserverBubble).toHaveBeenCalledWith(
      expect.objectContaining({ rawType: 'SPECIAL_STONE_BUBBLE' }),
      expect.objectContaining({ requireAnchor: true })
    );
    await expect(settlement.settle()).resolves.toBe(true);
    expect(renderer.releaseBoardVisualWriter).toHaveBeenCalledWith(boardWriterToken);
  });

  test('rejects malformed strict standalone board events instead of downgrading to a local writer', async () => {
    (global as any).GameEvents = { gameEvents: { on: jest.fn() } };
    const claimBoardVisualWriter = jest.fn();
    jest.doMock('../ui/board-renderer', () => ({ claimBoardVisualWriter }));

    const PresentationHandler = require('../ui/presentation-handler.js');

    await expect(PresentationHandler.handlePresentationEvent({
      type: 'CROSSFADE_STONE',
      row: 1,
      col: 4,
      meta: {
        source: 'network_timeline',
        strictNetworkPlayback: true,
        visualSeq: 9
      }
    })).rejects.toThrow('strict_network_standalone_board_event_requires_playback_batch');
    expect(claimBoardVisualWriter).not.toHaveBeenCalled();
  });
});
