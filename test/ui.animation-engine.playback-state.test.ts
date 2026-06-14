import { JSDOM } from 'jsdom';

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

  test('overlapping play waits for the active playback instead of aborting it', async () => {
    jest.unmock('../ui/playback-state-manager');
    const manager = require('../ui/playback-state-manager.js');
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
      await new Promise((resolve) => setTimeout(resolve, 30));
      await Promise.resolve();
      await Promise.resolve();

      expect(executePhaseSpy).toHaveBeenCalledTimes(2);
      expect(typeof resolveSecondPhase).toBe('function');
      resolveSecondPhase();
      await secondPlayPromise;

      expect(manager.getPlaybackActive()).toBe(false);
      expect(engine.isPlaying).toBe(false);
    } finally {
      warnSpy.mockRestore();
      executePhaseSpy.mockRestore();
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
      warnSpy.mockRestore();
    }
  });

  test('cell teleport playback arms board update context to suppress expansion reveal sound', async () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.window.__telemetry__ = { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 };
    global.window.DISABLE_ANIMATIONS = true;
    global.emitBoardUpdate = jest.fn();

    const playbackStateMock = {
      setInteractionLock: jest.fn(),
      armBoardUpdateContext: jest.fn()
    };
    jest.doMock('../ui/playback-state-manager', () => playbackStateMock);

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

    dom.window.close();
  });
});
