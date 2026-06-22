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

  test('clearPlaybackLock clears selection settlement locks by default', () => {
    const manager = require('../ui/playback-state-manager.js');
    const token = manager.acquireSelectionSettlementLock({ source: 'unit-test' });

    expect(manager.hasSelectionSettlementLock()).toBe(true);

    manager.clearPlaybackLock();

    expect(manager.hasSelectionSettlementLock()).toBe(false);
    expect(manager.releaseSelectionSettlementLock(token)).toBe(false);
    expect(global.window.__selectionSettlementLockActive).toBe(false);
  });

  test('clearPlaybackLock can preserve selection settlement locks when requested', () => {
    const manager = require('../ui/playback-state-manager.js');
    const token = manager.acquireSelectionSettlementLock({ source: 'unit-test' });

    manager.clearPlaybackLock({ preserveSelectionSettlementLock: true });

    expect(manager.hasSelectionSettlementLock()).toBe(true);
    expect(manager.getProcessing()).toBe(true);

    expect(manager.releaseSelectionSettlementLock(token)).toBe(true);
    expect(manager.hasSelectionSettlementLock()).toBe(false);
  });

  test('visual playback claim defers board and UI sync after queues are drained', () => {
    const manager = require('../ui/playback-state-manager.js');
    const emptyCardState = {
      presentationEvents: [],
      _presentationEventsPersist: []
    };

    const claim = manager.claimVisualPlayback({
      source: 'unit-test',
      eventTypes: ['destroy'],
      eventCount: 1
    });

    expect(claim).toEqual(expect.objectContaining({
      id: expect.any(Number),
      meta: expect.objectContaining({
        source: 'unit-test'
      })
    }));
    expect(manager.hasClaimedVisualPlayback()).toBe(true);
    expect(manager.shouldDeferBoardUpdate({ cardState: emptyCardState })).toBe(true);
    expect(manager.shouldDeferUiSync({ cardState: emptyCardState })).toBe(true);
    expect(global.window.__visualPlaybackClaimActive).toBe(true);
    expect(global.window.__visualPlaybackClaimCount).toBe(1);

    expect(manager.releaseVisualPlaybackClaim(claim)).toBe(true);
    expect(manager.hasClaimedVisualPlayback()).toBe(false);
    expect(manager.shouldDeferBoardUpdate({ cardState: emptyCardState })).toBe(false);
    expect(manager.shouldDeferUiSync({ cardState: emptyCardState })).toBe(false);
    expect(global.window.__visualPlaybackClaimActive).toBe(false);
    expect(global.window.__visualPlaybackClaimCount).toBe(0);
  });

  test('beginPlayback keeps a drain-level visual playback claim until explicit release', () => {
    const manager = require('../ui/playback-state-manager.js');
    const board = document.getElementById('board');

    const claim = manager.claimVisualPlayback({
      source: 'unit-test',
      eventTypes: ['destroy'],
      scope: 'presentation_drain'
    });
    expect(manager.hasClaimedVisualPlayback()).toBe(true);

    const started = manager.beginPlayback({ boardElement: board, startedAt: 1234 });

    expect(started.playbackActive).toBe(true);
    expect(manager.hasClaimedVisualPlayback()).toBe(true);
    expect(manager.getPlaybackActive()).toBe(true);
    expect(global.window.VisualPlaybackActive).toBe(true);
    expect(global.window.__visualPlaybackClaimActive).toBe(true);
    expect(board.classList.contains('playback-locked')).toBe(true);

    manager.finalizePlayback({ boardElement: board, clearBoardUpdateContext: true });

    expect(manager.hasClaimedVisualPlayback()).toBe(true);
    expect(manager.shouldDeferBoardUpdate({ cardState: { presentationEvents: [], _presentationEventsPersist: [] } })).toBe(true);
    expect(manager.releaseVisualPlaybackClaim(claim)).toBe(true);
    expect(manager.getPlaybackActive()).toBe(false);
    expect(global.window.VisualPlaybackActive).toBe(false);
    expect(board.classList.contains('playback-locked')).toBe(false);
  });

  test('finalizePlayback keeps claim-owned busy and board lock until release', () => {
    const manager = require('../ui/playback-state-manager.js');
    const board = document.getElementById('board');
    const claim = manager.claimVisualPlayback({
      source: 'unit-test',
      eventTypes: ['destroy'],
      scope: 'presentation_drain'
    });

    manager.beginPlayback({ boardElement: board, startedAt: 1234 });
    manager.finalizePlayback({ boardElement: board, clearBoardUpdateContext: true });

    expect(manager.hasClaimedVisualPlayback()).toBe(true);
    expect(manager.getPlaybackActive()).toBe(true);
    expect(manager.getProcessing()).toBe(true);
    expect(manager.getCardAnimating()).toBe(true);
    expect(board.classList.contains('playback-locked')).toBe(true);

    expect(manager.releaseVisualPlaybackClaim(claim)).toBe(true);

    expect(manager.getProcessing()).toBe(false);
    expect(manager.getCardAnimating()).toBe(false);
    expect(board.classList.contains('playback-locked')).toBe(false);
  });

  test('invalid visual playback claim release does not clear unrelated busy flags', () => {
    const manager = require('../ui/playback-state-manager.js');

    manager.setBusyState({
      processing: true,
      cardAnimating: true,
      playbackActive: false
    });

    expect(manager.releaseVisualPlaybackClaim({ id: 9999 })).toBe(false);

    expect(manager.getProcessing()).toBe(true);
    expect(manager.getCardAnimating()).toBe(true);
  });

  test('visual playback claim release restores busy flags that predated the claim', () => {
    const manager = require('../ui/playback-state-manager.js');

    manager.setBusyState({
      processing: true,
      cardAnimating: false,
      playbackActive: false
    });

    const claim = manager.claimVisualPlayback({
      source: 'unit-test',
      eventTypes: ['destroy']
    });

    expect(manager.getProcessing()).toBe(true);
    expect(manager.getCardAnimating()).toBe(true);

    expect(manager.releaseVisualPlaybackClaim(claim)).toBe(true);

    expect(manager.getProcessing()).toBe(true);
    expect(manager.getCardAnimating()).toBe(false);
  });

  test('visual playback claim release does not restore processing cleared during playback', () => {
    const manager = require('../ui/playback-state-manager.js');

    manager.setBusyState({
      processing: true,
      cardAnimating: false,
      playbackActive: false
    });

    const claim = manager.claimVisualPlayback({
      source: 'cpu_card_use',
      eventTypes: ['card_use_animation']
    });

    manager.setProcessing(false);
    manager.finalizePlayback({ clearBoardUpdateContext: true });

    expect(manager.releaseVisualPlaybackClaim(claim)).toBe(true);

    expect(manager.getProcessing()).toBe(false);
    expect(manager.getCardAnimating()).toBe(false);
  });

  test('waitForVisualPlaybackDrain waits while a visual playback claim exists', async () => {
    const manager = require('../ui/playback-state-manager.js');
    const emptyCardState = {
      presentationEvents: [],
      _presentationEventsPersist: []
    };
    const claim = manager.claimVisualPlayback({
      source: 'unit-test',
      eventTypes: ['destroy'],
      scope: 'presentation_drain'
    });
    let resolved = false;

    const drainPromise = manager.waitForVisualPlaybackDrain({
      cardState: emptyCardState,
      timeoutMs: 5000
    }).then(() => {
      resolved = true;
    });

    await Promise.resolve();
    jest.advanceTimersByTime(16);
    await Promise.resolve();

    expect(resolved).toBe(false);

    expect(manager.releaseVisualPlaybackClaim(claim)).toBe(true);
    jest.advanceTimersByTime(16);
    await drainPromise;

    expect(resolved).toBe(true);
  });

  test('waitForNetworkVisualSeq delegates to the network visual settlement tracker', async () => {
    const manager = require('../ui/playback-state-manager.js');
    const tracker = {
      waitForVisualSeq: jest.fn(() => Promise.resolve({ ok: true, visualSeq: 5 }))
    };
    global.window.NetworkVisualSettlementTracker = tracker;

    await expect(manager.waitForNetworkVisualSeq(5, { timeoutMs: 1000 })).resolves.toEqual({
      ok: true,
      visualSeq: 5
    });

    expect(tracker.waitForVisualSeq).toHaveBeenCalledWith(5, { timeoutMs: 1000 });
  });

  test('clearPlaybackLock clears stale visual playback claims', () => {
    const manager = require('../ui/playback-state-manager.js');

    manager.claimVisualPlayback({
      source: 'unit-test',
      eventTypes: ['destroy']
    });
    expect(manager.hasClaimedVisualPlayback()).toBe(true);

    manager.clearPlaybackLock();

    expect(manager.hasClaimedVisualPlayback()).toBe(false);
    expect(global.window.__visualPlaybackClaimActive).toBe(false);
    expect(global.window.__visualPlaybackClaimCount).toBe(0);
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

  test('snapshot settlement keeps claimed playback busy while playback engine is running', () => {
    const manager = require('../ui/playback-state-manager.js');
    manager.beginPlayback({ startedAt: 1000 });
    global.window.AnimationEngine = { isPlaying: true };

    const settlement = manager.resolveSnapshotPlaybackSettlement({
      playbackEvents: [{ type: 'flip' }],
      cardState: { presentationEvents: [], _presentationEventsPersist: [] },
      releaseUnclaimedPlayback: true,
      clearUndrainedPlayback: true,
      boardUpdateRequested: true
    });

    expect(settlement).toMatchObject({
      clearPlaybackLock: false,
      clearTransientPresentationQueues: false,
      setBusyFalse: false,
      keepBusy: true,
      reason: null
    });
  });

  test('snapshot settlement releases stale playback lock when no queues remain and engine is idle', () => {
    const manager = require('../ui/playback-state-manager.js');
    manager.beginPlayback({ startedAt: 1000 });
    global.window.AnimationEngine = { isPlaying: false };

    const settlement = manager.resolveSnapshotPlaybackSettlement({
      playbackEvents: [],
      presentationState: { shouldKeepBusy: false },
      cardState: { presentationEvents: [], _presentationEventsPersist: [] }
    });

    expect(settlement).toMatchObject({
      clearPlaybackLock: true,
      clearTransientPresentationQueues: false,
      setBusyFalse: false,
      reason: 'stale_playback_lock'
    });
  });

  test('snapshot settlement honors explicit injected playback state over mirrored globals', () => {
    const manager = require('../ui/playback-state-manager.js');
    manager.clearPlaybackLock();
    global.window.AnimationEngine = { isPlaying: true };

    const settlement = manager.resolveSnapshotPlaybackSettlement({
      playbackEvents: [],
      presentationState: { shouldKeepBusy: false },
      cardState: { presentationEvents: [], _presentationEventsPersist: [] },
      playbackActive: true,
      playbackRunning: false,
      playbackStartedAt: 1000
    });

    expect(settlement).toMatchObject({
      clearPlaybackLock: true,
      clearTransientPresentationQueues: false,
      setBusyFalse: false,
      reason: 'stale_playback_lock'
    });
  });

  test('snapshot settlement clears undrained playback queues only after board update requested', () => {
    const manager = require('../ui/playback-state-manager.js');
    const cardState = {
      presentationEvents: [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'flip' }] }],
      _presentationEventsPersist: [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'flip' }] }]
    };

    expect(manager.resolveSnapshotPlaybackSettlement({
      playbackEvents: [{ type: 'flip' }],
      cardState,
      clearUndrainedPlayback: true,
      boardUpdateRequested: false
    })).toMatchObject({
      clearPlaybackLock: false,
      clearTransientPresentationQueues: false,
      reason: null
    });

    expect(manager.resolveSnapshotPlaybackSettlement({
      playbackEvents: [{ type: 'flip' }],
      cardState,
      clearUndrainedPlayback: true,
      boardUpdateRequested: true
    })).toMatchObject({
      clearPlaybackLock: true,
      clearTransientPresentationQueues: true,
      reason: 'undrained_playback_queue'
    });
  });

  test('snapshot settlement releases restored queue busy state when signature still matches', () => {
    const manager = require('../ui/playback-state-manager.js');
    const cardState = {
      presentationEvents: [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 1 }] }],
      _presentationEventsPersist: [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 2 }] }]
    };
    const restoredQueueSignature = JSON.stringify({
      presentationEvents: cardState.presentationEvents,
      persistentEvents: cardState._presentationEventsPersist
    });

    const settlement = manager.resolveSnapshotPlaybackSettlement({
      playbackEvents: [],
      presentationState: {
        restoredPreservedQueues: true,
        restoredQueueSignature
      },
      busyStateBeforeSnapshot: null,
      cardState
    });

    expect(settlement).toMatchObject({
      clearPlaybackLock: false,
      clearTransientPresentationQueues: true,
      setBusyFalse: true,
      reason: 'restored_queue_busy_released'
    });
  });
});
