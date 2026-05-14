import { JSDOM } from 'jsdom';

describe('PlaybackStateManager runtime helpers', () => {
  let dom;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    jest.setSystemTime(1000);

    dom = new JSDOM('<!doctype html><html><body><div id="board" class="playback-locked"></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
  });

  afterEach(() => {
    try {
      const manager = require('../ui/playback-state-manager.js');
      if (manager && typeof manager.clearPlaybackLock === 'function') {
        manager.clearPlaybackLock();
      }
      if (manager && typeof manager.clearDebugRuntime === 'function') {
        manager.clearDebugRuntime();
      }
    } catch (e) { /* ignore */ }
    if (dom && dom.window) dom.window.close();
    delete global.window;
    delete global.document;
    jest.useRealTimers();
  });

  test('syncLegacyWindowFlags mirrors card animation and processing flags', () => {
    const manager = require('../ui/playback-state-manager.js');
    const result = manager.syncLegacyWindowFlags({
      readCardAnimating: () => true,
      readProcessing: () => true
    });

    expect(result).toEqual({
      isCardAnimating: true,
      isProcessing: true,
      playbackActive: false
    });
    expect(global.window.isCardAnimating).toBe(true);
    expect(global.window.isProcessing).toBe(true);
  });

  test('setInteractionLock mirrors processing and card animation flags together', () => {
    const manager = require('../ui/playback-state-manager.js');
    manager.setInteractionLock(true);

    expect(manager.getPlaybackActive()).toBe(true);
    expect(manager.getCardAnimating()).toBe(true);
    expect(manager.getProcessing()).toBe(true);
    expect(global.window.isCardAnimating).toBe(true);
    expect(global.window.isProcessing).toBe(true);

    manager.setInteractionLock(false);

    expect(manager.getPlaybackActive()).toBe(false);
    expect(manager.getCardAnimating()).toBe(false);
    expect(manager.getProcessing()).toBe(false);
    expect(global.window.isCardAnimating).toBe(false);
    expect(global.window.isProcessing).toBe(false);
  });

  test('playback stale helpers reflect animation engine state and configured timeout', () => {
    const manager = require('../ui/playback-state-manager.js');
    global.window.PASS_STALE_PLAYBACK_MS = 2500;
    global.window.AnimationEngine = { isPlaying: true };

    manager.setPlaybackActive(true);
    manager.setPlaybackStartedAt(1000);

    expect(manager.getPlaybackStaleMs()).toBe(2500);
    expect(manager.isPlaybackRunning()).toBe(true);
    expect(manager.isPlaybackStale()).toBe(false);

    global.window.AnimationEngine.isPlaying = false;
    expect(manager.isPlaybackRunning()).toBe(false);
    expect(manager.isPlaybackStale()).toBe(true);
  });

  test('playback stale helpers fall back to elapsed playback time when engine state is unavailable', () => {
    const manager = require('../ui/playback-state-manager.js');
    global.window.PASS_STALE_PLAYBACK_MS = 2000;
    delete global.window.AnimationEngine;

    manager.setPlaybackActive(true);
    manager.setPlaybackStartedAt(1000);

    jest.setSystemTime(2500);
    expect(manager.isPlaybackRunning()).toBe(true);
    expect(manager.isPlaybackStale()).toBe(false);

    jest.setSystemTime(3101);
    expect(manager.isPlaybackStale()).toBe(true);
  });

  test('clearPlaybackLock clears startedAt so the next playback starts fresh', () => {
    const manager = require('../ui/playback-state-manager.js');
    delete global.window.AnimationEngine;
    global.window.PASS_STALE_PLAYBACK_MS = 2000;

    manager.beginPlayback({ startedAt: 1000 });
    jest.setSystemTime(4005);
    expect(manager.isPlaybackStale()).toBe(true);

    manager.clearPlaybackLock();
    expect(manager.getPlaybackStartedAt()).toBeNull();
    expect(global.window.__playbackActiveSince).toBeNull();

    jest.setSystemTime(5000);
    manager.beginPlayback();
    expect(manager.getPlaybackStartedAt()).toBe(5000);
    expect(manager.isPlaybackStale()).toBe(false);
  });

  test('ensureDebugRuntime aborts stuck playback that was started through the manager', () => {
    const manager = require('../ui/playback-state-manager.js');
    const abortPlayback = jest.fn();
    const board = document.getElementById('board');

    manager.ensureDebugRuntime({
      readCardAnimating: () => false,
      readProcessing: () => false,
      abortPlayback,
      getBoardElement: () => board
    });
    manager.setPlaybackActive(true);

    expect(manager.getPlaybackStartedAt()).not.toBeNull();

    jest.advanceTimersByTime(15501);

    expect(abortPlayback).toHaveBeenCalledTimes(1);
    expect(global.window.VisualPlaybackActive).toBe(false);
    expect(global.window.__playbackActiveSince).toBeNull();
    expect(board.classList.contains('playback-locked')).toBe(false);
  });

  test('board update context is one-shot and mirrors legacy suppress flag', () => {
    const manager = require('../ui/playback-state-manager.js');
    const armed = manager.armBoardUpdateContext({
      suppressFallbackFlip: true,
      suppressBoardExpansionRevealSound: true,
      source: 'unit-test',
      reason: 'post_playback_sync'
    });

    expect(armed).toMatchObject({
      suppressFallbackFlip: true,
      suppressBoardExpansionRevealSound: true,
      source: 'unit-test',
      reason: 'post_playback_sync'
    });
    expect(manager.getSuppressNextDiffFlip()).toBe(true);
    expect(manager.getBoardUpdateContext()).toMatchObject({
      suppressFallbackFlip: true,
      suppressBoardExpansionRevealSound: true,
      source: 'unit-test',
      reason: 'post_playback_sync'
    });
    expect(global.window.__suppressNextDiffFlip).toBe(true);
    expect(global.window.__suppressNextBoardExpansionRevealSound).toBe(true);

    const consumed = manager.consumeBoardUpdateContext();
    expect(consumed).toMatchObject({
      suppressFallbackFlip: true,
      suppressBoardExpansionRevealSound: true,
      source: 'unit-test',
      reason: 'post_playback_sync'
    });
    expect(manager.getBoardUpdateContext()).toBeNull();
    expect(manager.getSuppressNextDiffFlip()).toBe(false);
    expect(global.window.__suppressNextDiffFlip).toBe(false);
    expect(global.window.__suppressNextBoardExpansionRevealSound).toBe(false);
  });

  test('clearPlaybackLock clears stale board update context', () => {
    const manager = require('../ui/playback-state-manager.js');
    manager.setPlaybackActive(true);
    manager.armBoardUpdateContext({
      suppressFallbackFlip: true,
      source: 'unit-test',
      reason: 'stale_context'
    });

    manager.clearPlaybackLock();

    expect(manager.getPlaybackActive()).toBe(false);
    expect(manager.getBoardUpdateContext()).toBeNull();
    expect(global.window.__suppressNextDiffFlip).toBe(false);
    expect(global.window.__suppressNextBoardExpansionRevealSound).toBe(false);
  });

  test('abortPlayback clears playback timing and busy flags together', () => {
    const manager = require('../ui/playback-state-manager.js');
    manager.setInteractionLock(true);
    manager.setPlaybackStartedAt(1234);
    manager.armBoardUpdateContext({
      suppressFallbackFlip: true,
      source: 'unit-test',
      reason: 'abort_cleanup'
    });

    manager.abortPlayback();

    expect(manager.getPlaybackActive()).toBe(false);
    expect(manager.getCardAnimating()).toBe(false);
    expect(manager.getProcessing()).toBe(false);
    expect(manager.getPlaybackStartedAt()).toBeNull();
    expect(manager.getBoardUpdateContext()).toBeNull();
    expect(global.window.__playbackActiveSince).toBeNull();
  });

  test('abortPlayback invokes the registered playback abort handle only once', () => {
    const manager = require('../ui/playback-state-manager.js');
    const abort = jest.fn(() => true);

    manager.registerPlaybackAbortHandle({ abort });
    manager.setInteractionLock(true);

    manager.abortPlayback();
    manager.abortPlayback();

    expect(abort).toHaveBeenCalledTimes(1);
    expect(manager.getPlaybackActive()).toBe(false);
    expect(manager.getProcessing()).toBe(false);
    expect(manager.getCardAnimating()).toBe(false);
  });
});
