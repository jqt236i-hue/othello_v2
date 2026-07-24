import { JSDOM } from 'jsdom';
import {
  configureNoopDomBoardBackend,
  installPreparedDomBoardDependencies,
} from './helpers/feature-stylesheet-test-helpers';

async function waitUntil(predicate: () => boolean, label: string, attempts = 100) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (predicate()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 1));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

describe('animation-engine playback-state integration', () => {
  beforeEach(() => {
    jest.resetModules();
    global.window = {
      __telemetry__: { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 }
    };
    global.document = {
      getElementById: () => ({
        classList: { add() {}, remove() {} },
        querySelector: () => null,
        getBoundingClientRect: () => ({})
      })
    };
    global.emitBoardUpdate = jest.fn();
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.emitBoardUpdate;
  });

  test('watchdog clears playback through PlaybackStateManager', async () => {
    const playbackStateMock = {
      abortPlayback: jest.fn(),
      setSuppressNextDiffFlip: jest.fn()
    };

    jest.doMock('../ui/playback-state-manager', () => playbackStateMock);

    const engine = require('../ui/animation-engine.js');
    await engine.handleWatchdog();

    expect(playbackStateMock.abortPlayback).toHaveBeenCalledTimes(1);
    expect(global.emitBoardUpdate).toHaveBeenCalledTimes(1);
  });

  test('uses a bounded production watchdog budget that covers the longest Pixi phases', () => {
    const engine = require('../ui/animation-engine.js');

    expect(engine._resolvePlaybackWatchdogMs()).toBe(30000);
  });

  test('local watchdog preserves deferred presentation claims and returns one abort acknowledgement', async () => {
    jest.useFakeTimers();
    jest.unmock('../ui/playback-state-manager');
    global.window.PLAYBACK_WATCHDOG_MS = 10;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const manager = require('../ui/playback-state-manager.js');
    const engine = require('../ui/animation-engine.js');
    const presentationClaim = manager.claimVisualPlayback({ scope: 'presentation_drain' });
    let resolvePhase: (() => void) | null = null;
    const executePhaseSpy = jest.spyOn(engine, 'executePhase').mockImplementation(() => (
      new Promise<void>((resolve) => { resolvePhase = resolve; })
    ));

    try {
      const playPromise = engine.play(
        [{ type: 'move', phase: 1, targets: [] }],
        { deferFinalSettlement: true }
      );
      await Promise.resolve();
      await Promise.resolve();

      jest.advanceTimersByTime(20);
      await Promise.resolve();
      expect((global.window as any).__telemetry__.watchdogFired).toBe(1);
      expect(manager.hasClaimedVisualPlayback()).toBe(true);

      expect(typeof resolvePhase).toBe('function');
      resolvePhase!();
      const settlement = await playPromise;

      expect(settlement).toEqual(expect.objectContaining({
        kind: 'deferred-finalization',
        runId: expect.any(Number),
        mode: 'already-aborted-ack',
        finalize: expect.any(Function)
      }));
      expect(settlement.finalize()).toBe(true);
      expect(settlement.finalize()).toBe(false);
      expect(manager.releaseVisualPlaybackClaim(presentationClaim)).toBe(true);
      expect(manager.hasClaimedVisualPlayback()).toBe(false);
    } finally {
      executePhaseSpy.mockRestore();
      warnSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  test('debug stale guard does not abort a progressing multi-phase strict playback', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(1000);
    jest.unmock('../ui/playback-state-manager');
    global.window.PLAYBACK_WATCHDOG_MS = 60000;

    const manager = require('../ui/playback-state-manager.js');
    const engine = require('../ui/animation-engine.js');
    const abortPlayback = jest.fn(() => engine.abortAndSync());
    const phaseResolvers: Array<() => void> = [];
    const executePhaseSpy = jest.spyOn(engine, 'executePhase').mockImplementation(() => (
      new Promise<void>((resolve) => { phaseResolvers.push(resolve); })
    ));
    const sleepSpy = jest.spyOn(engine, '_sleep').mockResolvedValue(undefined);
    const flushPlaybackContinuation = async () => {
      for (let index = 0; index < 6; index += 1) {
        await Promise.resolve();
      }
    };

    manager.ensureDebugRuntime({
      readCardAnimating: () => manager.getCardAnimating(),
      readProcessing: () => manager.getProcessing(),
      abortPlayback,
      getBoardElement: () => document.getElementById('board')
    });

    try {
      const playPromise = engine.play([
        { type: 'place', phase: 1, targets: [] },
        { type: 'flip', phase: 2, targets: [] },
        { type: 'hand_add', phase: 3, targets: [{ player: 'white' }] }
      ], {
        strictNetworkPlayback: true,
        deferFinalSettlement: true
      });
      await flushPlaybackContinuation();
      expect(phaseResolvers).toHaveLength(1);

      jest.advanceTimersByTime(7000);
      phaseResolvers.shift()!();
      await flushPlaybackContinuation();
      expect(phaseResolvers).toHaveLength(1);

      jest.advanceTimersByTime(7000);
      phaseResolvers.shift()!();
      await flushPlaybackContinuation();
      expect(phaseResolvers).toHaveLength(1);

      // More than 15 seconds have elapsed since the frame began, but each phase
      // completion refreshed the progress heartbeat.
      jest.advanceTimersByTime(7000);
      expect(abortPlayback).not.toHaveBeenCalled();

      phaseResolvers.shift()!();
      const settlement = await playPromise;

      expect(settlement).toEqual(expect.objectContaining({
        kind: 'deferred-finalization',
        mode: 'finalize'
      }));
      expect(settlement.finalize()).toBe(true);
      expect(abortPlayback).not.toHaveBeenCalled();
    } finally {
      sleepSpy.mockRestore();
      executePhaseSpy.mockRestore();
      manager.clearDebugRuntime();
      manager.clearPlaybackLock();
      jest.useRealTimers();
    }
  });

  test('deferred success returns a run-scoped finalizer that settles the manager exactly once', async () => {
    const finalizePlayback = jest.fn(() => true);
    const playbackStateMock = {
      beginPlayback: jest.fn(() => ({ playbackActive: true })),
      getPlaybackActive: jest.fn(() => true),
      finalizePlayback
    };
    jest.doMock('../ui/playback-state-manager', () => playbackStateMock);
    const engine = require('../ui/animation-engine.js');
    const executePhaseSpy = jest.spyOn(engine, 'executePhase').mockResolvedValue(undefined);

    try {
      const settlement = await engine.play(
        [{ type: 'move', phase: 1, targets: [] }],
        { deferFinalSettlement: true }
      );

      expect(settlement).toEqual(expect.objectContaining({
        kind: 'deferred-finalization',
        runId: 1,
        mode: 'finalize',
        finalize: expect.any(Function)
      }));
      expect(finalizePlayback).not.toHaveBeenCalled();
      expect(settlement.finalize()).toBe(true);
      expect(settlement.finalize()).toBe(false);
      expect(finalizePlayback).toHaveBeenCalledTimes(1);
      expect(playbackStateMock.beginPlayback).toHaveBeenCalledWith(expect.objectContaining({ runId: 1 }));
      expect(finalizePlayback).toHaveBeenCalledWith(expect.objectContaining({ expectedRunId: 1 }));
    } finally {
      executePhaseSpy.mockRestore();
    }
  });

  test('empty deferred playback produces no result and does not mutate manager playback state', async () => {
    const playbackStateMock = {
      beginPlayback: jest.fn(),
      finalizePlayback: jest.fn()
    };
    jest.doMock('../ui/playback-state-manager', () => playbackStateMock);
    const engine = require('../ui/animation-engine.js');

    await expect(engine.play([], { deferFinalSettlement: true })).resolves.toBeUndefined();
    expect(playbackStateMock.beginPlayback).not.toHaveBeenCalled();
    expect(playbackStateMock.finalizePlayback).not.toHaveBeenCalled();
  });

  test('abortAndSync delegates playback abort to PlaybackStateManager when available', () => {
    const playbackStateMock = {
      abortPlayback: jest.fn()
    };
    jest.doMock('../ui/playback-state-manager', () => playbackStateMock);

    const engine = require('../ui/animation-engine.js');
    engine.abortAndSync();

    expect(playbackStateMock.abortPlayback).toHaveBeenCalledTimes(1);
    expect(global.emitBoardUpdate).toHaveBeenCalledTimes(1);
  });

  test('external abort prevents a late finalize from clearing a newer playback lock', async () => {
    jest.unmock('../ui/playback-state-manager');
    const manager = require('../ui/playback-state-manager.js');
    const engine = require('../ui/animation-engine.js');
    let resolveFirstPhase = null;
    let resolveSecondPhase = null;
    const executePhaseSpy = jest.spyOn(engine, 'executePhase')
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveFirstPhase = resolve;
      }))
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveSecondPhase = resolve;
      }));

    const firstPlayPromise = engine.play([{ type: 'move', phase: 1, targets: [] }]);
    await Promise.resolve();
    await Promise.resolve();

    manager.abortPlayback();
    const secondPlayPromise = engine.play([{ type: 'move', phase: 1, targets: [] }]);
    await Promise.resolve();
    await Promise.resolve();

    expect(typeof resolveFirstPhase).toBe('function');
    expect(typeof resolveSecondPhase).toBe('function');
    expect(manager.getPlaybackActive()).toBe(true);

    resolveFirstPhase();
    await Promise.resolve();
    await Promise.resolve();

    expect(manager.getPlaybackActive()).toBe(true);

    resolveSecondPhase();
    await secondPlayPromise;
    await firstPlayPromise;

    expect(engine.isPlaying).toBe(false);
    expect(manager.getPlaybackActive()).toBe(false);
    executePhaseSpy.mockRestore();
  });

  test('external abort still releases the local board writer owned by that run', async () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    installPreparedDomBoardDependencies(global.document);
    global.window.__telemetry__ = { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 };
    global.emitBoardUpdate = jest.fn();
    jest.unmock('../ui/playback-state-manager');

    const manager = require('../ui/playback-state-manager.js');
    const renderer = require('../ui/board-renderer.js');
    await renderer.getBoardVisualControllerReady();
    const settleSpy = jest.spyOn(renderer, 'settleBoardVisualWriter').mockImplementation((token: any) => {
      renderer.releaseBoardVisualWriter(token);
      return Promise.resolve();
    });
    let resolvePhase = null;
    const playPhaseSpy = jest.spyOn(renderer, 'playBoardVisualPhase').mockImplementation(() => (
      new Promise((resolve) => {
        resolvePhase = resolve;
      })
    ));
    const engine = require('../ui/animation-engine.js');

    try {
      const playPromise = engine.play(
        [{ type: 'place', phase: 1, targets: [] }],
        { deferFinalSettlement: true }
      );
      await waitUntil(() => (
        typeof resolvePhase === 'function'
        && renderer.getBoardVisualController().getSnapshot().mode === 'playback'
      ), 'local board writer claim');

      expect(renderer.getBoardVisualController().getSnapshot()).toEqual(expect.objectContaining({
        mode: 'playback',
        activeFrameToken: expect.stringMatching(/^local:animation-engine:/)
      }));

      manager.abortPlayback();
      expect(typeof resolvePhase).toBe('function');
      resolvePhase();
      const settlement = await playPromise;

      expect(renderer.getBoardVisualController().getSnapshot()).toEqual(expect.objectContaining({
        mode: 'idle',
        activeFrameToken: null
      }));
      expect(settlement).toEqual(expect.objectContaining({
        kind: 'deferred-finalization',
        mode: 'already-aborted-ack'
      }));
      expect(settlement.finalize()).toBe(true);
      expect(settlement.finalize()).toBe(false);
    } finally {
      settleSpy.mockRestore();
      playPhaseSpy.mockRestore();
      dom.window.close();
    }
  });

  test('direct parallel phase claims one writer and releases it after every launch settles', async () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    installPreparedDomBoardDependencies(global.document);
    global.window.__telemetry__ = { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 };
    const renderer = require('../ui/board-renderer.js');
    await renderer.getBoardVisualControllerReady();
    const claimSpy = jest.spyOn(renderer, 'claimBoardVisualWriter');
    const settleSpy = jest.spyOn(renderer, 'settleBoardVisualWriter').mockImplementation((token: any) => {
      renderer.releaseBoardVisualWriter(token);
      return Promise.resolve();
    });
    const phaseResolvers: Array<() => void> = [];
    const playPhaseSpy = jest.spyOn(renderer, 'playBoardVisualPhase').mockImplementation(() => (
      new Promise<void>((resolve) => { phaseResolvers.push(resolve); })
    ));
    const engine = require('../ui/animation-engine.js');

    try {
      const phasePromise = engine.executePhase([
        { type: 'place', phase: 2, targets: [] },
        { type: 'flip', phase: 2, targets: [] }
      ]);
      await waitUntil(() => phaseResolvers.length === 2, 'parallel board phase launch');

      expect(claimSpy).toHaveBeenCalledTimes(1);
      expect(playPhaseSpy).toHaveBeenCalledTimes(2);
      expect(playPhaseSpy.mock.calls[0][2]).toBe(playPhaseSpy.mock.calls[1][2]);
      expect(playPhaseSpy.mock.calls.map(([, events]) => events[0].presentationBatchId)).toEqual([
        expect.stringMatching(/^local-presentation:/),
        playPhaseSpy.mock.calls[0][1][0].presentationBatchId
      ]);
      expect(settleSpy).not.toHaveBeenCalled();

      phaseResolvers.forEach((resolve) => resolve());
      await phasePromise;

      expect(settleSpy).toHaveBeenCalledTimes(1);
      expect(renderer.getBoardVisualController().getSnapshot()).toEqual(expect.objectContaining({
        mode: 'idle',
        activeFrameToken: null
      }));
    } finally {
      playPhaseSpy.mockRestore();
      settleSpy.mockRestore();
      claimSpy.mockRestore();
      dom.window.close();
    }
  });

  test('overlapping play waits for the active playback instead of aborting it', async () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    installPreparedDomBoardDependencies(global.document);
    global.window.__telemetry__ = { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 };
    jest.unmock('../ui/playback-state-manager');
    const manager = require('../ui/playback-state-manager.js');
    const renderer = require('../ui/board-renderer.js');
    await renderer.getBoardVisualControllerReady();
    const settleSpy = jest.spyOn(renderer, 'settleBoardVisualWriter').mockImplementation((token: any) => {
      renderer.releaseBoardVisualWriter(token);
      return Promise.resolve();
    });
    const engine = require('../ui/animation-engine.js');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    let resolveFirstPhase = null;
    let resolveSecondPhase = null;
    const executePhaseSpy = jest.spyOn(engine, 'executePhase')
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveFirstPhase = resolve;
      }))
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveSecondPhase = resolve;
      }));

    try {
      const firstPlayPromise = engine.play([{ type: 'move', phase: 1, targets: [] }]);
      await Promise.resolve();
      await Promise.resolve();

      const secondPlayPromise = engine.play([{ type: 'move', phase: 1, targets: [] }]);
      await Promise.resolve();
      await Promise.resolve();

      expect(manager.getPlaybackActive()).toBe(true);
      expect(executePhaseSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).not.toHaveBeenCalledWith('[AnimationEngine] Already playing. Aborting previous...');

      expect(typeof resolveFirstPhase).toBe('function');
      resolveFirstPhase();
      await firstPlayPromise;
      await waitUntil(() => executePhaseSpy.mock.calls.length === 2, 'queued overlapping playback');

      expect(executePhaseSpy).toHaveBeenCalledTimes(2);
      expect(typeof resolveSecondPhase).toBe('function');
      resolveSecondPhase();
      await secondPlayPromise;

      expect(manager.getPlaybackActive()).toBe(false);
      expect(engine.isPlaying).toBe(false);
    } finally {
      settleSpy.mockRestore();
      warnSpy.mockRestore();
      executePhaseSpy.mockRestore();
      dom.window.close();
    }
  });

  test('default overlap wait follows the playback watchdog budget', () => {
    jest.unmock('../ui/playback-state-manager');
    global.window.PLAYBACK_WATCHDOG_MS = 7200;
    const engine = require('../ui/animation-engine.js');

    expect(engine._resolvePlaybackOverlapWaitMs()).toBe(7450);

    global.window.PLAYBACK_OVERLAP_WAIT_MS = 1200;
    expect(engine._resolvePlaybackOverlapWaitMs()).toBe(1200);
  });

  test('pre-armed snapshot playback lock does not log overlapping playback warning', async () => {
    jest.unmock('../ui/playback-state-manager');
    const manager = require('../ui/playback-state-manager.js');
    const renderer = require('../ui/board-renderer.js');
    configureNoopDomBoardBackend(renderer);
    await renderer.getBoardVisualControllerReady();
    const settleSpy = jest.spyOn(renderer, 'settleBoardVisualWriter').mockImplementation((token: any) => {
      renderer.releaseBoardVisualWriter(token);
      return Promise.resolve();
    });
    const engine = require('../ui/animation-engine.js');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    manager.setBusyState({
      processing: true,
      cardAnimating: true,
      playbackActive: true
    });

    try {
      await engine.play([{ type: 'move', phase: 1, targets: [] }]);
      expect(warnSpy).not.toHaveBeenCalledWith('[AnimationEngine] Already playing. Aborting previous...');
    } finally {
      settleSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  test('oversized playback batches warn but still settle every phase in order', async () => {
    global.window.PLAYBACK_EVENT_CAP = 2;
    const engine = require('../ui/animation-engine.js');
    const executePhaseSpy = jest.spyOn(engine, 'executePhase').mockResolvedValue(undefined);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await engine.play([
      { type: 'move', phase: 1, targets: [] },
      { type: 'flip', phase: 2, targets: [] },
      { type: 'destroy', phase: 3, targets: [] }
    ]);

    expect(global.emitBoardUpdate).toHaveBeenCalledTimes(1);
    expect(executePhaseSpy.mock.calls.map(([events]) => events.map((event: any) => event.type))).toEqual([
      ['move'],
      ['flip'],
      ['destroy']
    ]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Continuing ordered playback'),
      expect.objectContaining({ original: 3, cap: 2 })
    );
    expect(engine.isPlaying).toBe(false);

    warnSpy.mockRestore();
    executePhaseSpy.mockRestore();
  });

  test('cell teleport playback arms board update context to suppress expansion reveal sound', async () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    installPreparedDomBoardDependencies(global.document);
    global.window.__telemetry__ = { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 };
    global.window.DISABLE_ANIMATIONS = true;
    global.emitBoardUpdate = jest.fn();

    const playbackStateMock = {
      setInteractionLock: jest.fn(),
      armBoardUpdateContext: jest.fn()
    };
    jest.doMock('../ui/playback-state-manager', () => playbackStateMock);

    const renderer = require('../ui/board-renderer.js');
    await renderer.getBoardVisualControllerReady();
    const settleSpy = jest.spyOn(renderer, 'settleBoardVisualWriter').mockImplementation((token: any) => {
      renderer.releaseBoardVisualWriter(token);
      return Promise.resolve();
    });

    const board = document.getElementById('board');
    const fromCell = document.createElement('div');
    fromCell.className = 'cell has-disc';
    fromCell.dataset.row = '0';
    fromCell.dataset.col = '0';
    const toCell = document.createElement('div');
    toCell.className = 'cell';
    toCell.dataset.row = '0';
    toCell.dataset.col = '1';
    const disc = document.createElement('div');
    disc.className = 'disc black';
    fromCell.appendChild(disc);
    board.appendChild(fromCell);
    board.appendChild(toCell);

    try {
      const engine = require('../ui/animation-engine.js');
      await engine.play([
        {
          type: 'move',
          phase: 1,
          targets: [{
            from: { row: 0, col: 0 },
            to: { row: 0, col: 1 },
            cause: 'CELL_TELEPORT_WILL',
            reason: 'teleport_move',
            ownerAfter: 'black',
            after: { color: 1, special: null, timer: null }
          }]
        }
      ]);

      expect(playbackStateMock.armBoardUpdateContext).toHaveBeenCalledWith(expect.objectContaining({
        suppressBoardExpansionRevealSound: true,
        source: 'animation-engine',
        reason: 'post_playback_sync'
      }));
    } finally {
      settleSpy.mockRestore();
      dom.window.close();
    }
  });
});
