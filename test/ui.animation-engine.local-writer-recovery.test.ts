import { JSDOM } from 'jsdom';
import { PresentationPlaybackError } from '../ui/board-visual/playback-types';

type RendererFixture = ReturnType<typeof installRendererFixture>;

function installRendererFixture(options?: {
  recoveryFails?: boolean;
  initialSettlementFails?: boolean;
  deferFirstPhase?: boolean;
  deferSecondPhase?: boolean;
  deferReady?: boolean;
  preflightError?: Error;
}) {
  let activeToken: any = null;
  let mode = 'idle';
  let nextTokenId = 1;
  let settlementAttempt = 0;
  let firstPhaseResolver: (() => void) | null = null;
  let secondPhaseResolver: (() => void) | null = null;
  let readyResolver: (() => void) | null = null;
  const readyPromise = options?.deferReady === true
    ? new Promise<void>((resolve) => { readyResolver = resolve; })
    : Promise.resolve();
  const releasedTokenIds = new Set<number>();
  const lifecycle: string[] = [];

  const fixture = {
    get activeToken() { return activeToken; },
    get mode() { return mode; },
    get releaseCount() { return releasedTokenIds.size; },
    lifecycle,
    resolveReady: () => {
      if (!readyResolver) throw new Error('ready_not_pending');
      const resolve = readyResolver;
      readyResolver = null;
      resolve();
    },
    resolveFirstPhase: () => {
      if (!firstPhaseResolver) throw new Error('first_phase_not_pending');
      const resolve = firstPhaseResolver;
      firstPhaseResolver = null;
      resolve();
    },
    resolveSecondPhase: () => {
      if (!secondPhaseResolver) throw new Error('second_phase_not_pending');
      const resolve = secondPhaseResolver;
      secondPhaseResolver = null;
      resolve();
    },
    getBoardVisualControllerReady: jest.fn(() => readyPromise),
    ...(options?.preflightError ? {
      validateBoardVisualPhase: jest.fn(() => Promise.reject(options.preflightError))
    } : {}),
    claimBoardVisualWriter: jest.fn((frameToken: string, writerMode: 'local' | 'network') => {
      if (activeToken) throw new Error('writer_already_claimed');
      activeToken = Object.freeze({ id: nextTokenId++, frameToken, mode: writerMode });
      mode = 'playback';
      lifecycle.push(`claim:${activeToken.id}`);
      return activeToken;
    }),
    playBoardVisualPhase: jest.fn((token: any) => {
      lifecycle.push(`play:${token.id}`);
      const playCount = lifecycle.filter((entry) => entry.startsWith('play:')).length;
      if (options?.deferFirstPhase === true && playCount === 1) {
        return new Promise<void>((resolve) => { firstPhaseResolver = resolve; });
      }
      if (options?.deferSecondPhase === true && playCount === 2) {
        return new Promise<void>((resolve) => { secondPhaseResolver = resolve; });
      }
      return Promise.resolve();
    }),
    enterBoardVisualRecovery: jest.fn((token: any) => {
      if (token !== activeToken) throw new Error('recovery_token_mismatch');
      mode = 'recovering';
      lifecycle.push(`recover:${token.id}`);
      return true;
    }),
    settleBoardVisualWriter: jest.fn(async (token: any) => {
      if (token !== activeToken) throw new Error('settlement_token_mismatch');
      settlementAttempt += 1;
      lifecycle.push(`settle:${token.id}`);
      if (options?.initialSettlementFails !== false && settlementAttempt === 1) {
        throw new Error('initial_settlement_failed');
      }
      if (options?.recoveryFails === true) throw new Error('checkpoint_restore_failed');
      if (releasedTokenIds.has(token.id)) throw new Error('writer_released_twice');
      releasedTokenIds.add(token.id);
      lifecycle.push(`release:${token.id}`);
      activeToken = null;
      mode = 'idle';
    }),
    releaseBoardVisualWriter: jest.fn()
  };

  jest.doMock('../ui/board-renderer', () => fixture);
  return fixture;
}

function installPlaybackStateFixture() {
  let active = false;
  let processing = false;
  let cardAnimating = false;
  let abortHandle: any = null;
  let nextClaimId = 1;
  const claims = new Map<number, any>();
  const fixture = {
    beginPlayback: jest.fn(() => {
      active = true;
      processing = true;
      cardAnimating = true;
      return { playbackActive: true };
    }),
    finalizePlayback: jest.fn(() => {
      active = false;
      processing = false;
      cardAnimating = false;
      return null;
    }),
    abortPlayback: jest.fn(() => {
      const handle = abortHandle;
      abortHandle = null;
      if (handle && typeof handle.abort === 'function') handle.abort();
      active = false;
      processing = false;
      cardAnimating = false;
      claims.clear();
      return true;
    }),
    getPlaybackActive: jest.fn(() => active || claims.size > 0),
    getProcessing: jest.fn(() => processing),
    getCardAnimating: jest.fn(() => cardAnimating || active || claims.size > 0),
    setInteractionLock: jest.fn((locked: boolean) => {
      active = locked === true;
      processing = locked === true;
      cardAnimating = locked === true;
      return locked === true;
    }),
    setBusyState: jest.fn((state: any) => {
      if (Object.prototype.hasOwnProperty.call(state, 'playbackActive')) active = state.playbackActive === true;
      if (Object.prototype.hasOwnProperty.call(state, 'processing')) processing = state.processing === true;
      if (Object.prototype.hasOwnProperty.call(state, 'cardAnimating')) cardAnimating = state.cardAnimating === true;
      return { playbackActive: active, isProcessing: processing, isCardAnimating: cardAnimating };
    }),
    claimVisualPlayback: jest.fn((meta: any) => {
      const claim = Object.freeze({ id: nextClaimId++, meta });
      claims.set(claim.id, claim);
      processing = true;
      cardAnimating = true;
      return claim;
    }),
    releaseVisualPlaybackClaim: jest.fn((claim: any) => claims.delete(claim && claim.id)),
    recordVisualPlaybackSettlementError: jest.fn((claim: any) => claims.get(claim && claim.id) === claim),
    registerPlaybackAbortHandle: jest.fn((handle: any) => {
      abortHandle = handle;
      return true;
    }),
    clearPlaybackAbortHandle: jest.fn((handle: any) => {
      if (abortHandle === handle) abortHandle = null;
      return true;
    }),
    armBoardUpdateContext: jest.fn()
  };
  jest.doMock('../ui/playback-state-manager', () => fixture);
  return fixture;
}

async function waitUntil(predicate: () => boolean, timeoutMs = 500): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt >= timeoutMs) throw new Error('wait_until_timed_out');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

describe('AnimationEngine local board writer recovery', () => {
  let dom: JSDOM;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).window.__telemetry__ = { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 };
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    jest.useRealTimers();
    jest.dontMock('../ui/board-renderer');
    jest.dontMock('../ui/playback-state-manager');
    try { dom.window.close(); } catch (e) { /* ignore */ }
    delete (global as any).window;
    delete (global as any).document;
  });

  test('restores the checkpoint and releases once before finalizing local playback', async () => {
    const renderer: RendererFixture = installRendererFixture();
    const playbackState = installPlaybackStateFixture();
    const engine = require('../ui/animation-engine');

    await expect(engine.play([{ type: 'place', phase: 1, targets: [] }])).rejects.toEqual(
      expect.objectContaining({
        name: 'PresentationPlaybackError',
        code: 'board_writer_settlement_failed',
        strictNetworkPlayback: false
      })
    );

    expect(renderer.enterBoardVisualRecovery).toHaveBeenCalledTimes(1);
    expect(renderer.settleBoardVisualWriter).toHaveBeenCalledTimes(2);
    expect(renderer.releaseBoardVisualWriter).not.toHaveBeenCalled();
    expect(renderer.releaseCount).toBe(1);
    expect(renderer.activeToken).toBeNull();
    expect(renderer.mode).toBe('idle');
    expect(playbackState.finalizePlayback).toHaveBeenCalledTimes(1);
    expect(playbackState.getPlaybackActive()).toBe(false);
    expect(engine._activeBoardWriterToken).toBeNull();
    expect(engine._ownsActiveBoardWriterToken).toBe(false);
    expect(engine.isPlaying).toBe(false);
  });

  test('direct phase capability failure happens before claiming or launching a writer', async () => {
    const unsupported = { type: 'crossfade_stone', phase: 1, row: 2, col: 2 };
    const preflightError = new PresentationPlaybackError(
      'board_event_unimplemented',
      unsupported,
      { strictNetworkPlayback: false }
    );
    const renderer: RendererFixture = installRendererFixture({
      initialSettlementFails: false,
      preflightError
    });
    const engine = require('../ui/animation-engine');

    await expect(engine.executePhase([
      { type: 'place', phase: 1, targets: [] },
      { type: 'sound_effect', phase: 1, soundKey: 'stone_place' },
      unsupported
    ])).rejects.toBe(preflightError);

    expect((renderer as any).validateBoardVisualPhase).toHaveBeenCalledTimes(1);
    expect(renderer.claimBoardVisualWriter).not.toHaveBeenCalled();
    expect(renderer.playBoardVisualPhase).not.toHaveBeenCalled();
    expect(renderer.activeToken).toBeNull();
    expect(renderer.lifecycle).toEqual([]);
  });

  test('waits for an externally aborted run writer before starting the next run', async () => {
    jest.useRealTimers();
    (global as any).window.PLAYBACK_OVERLAP_WAIT_MS = 500;
    const renderer: RendererFixture = installRendererFixture({
      initialSettlementFails: false,
      deferFirstPhase: true,
      deferSecondPhase: true
    });
    const playbackState = installPlaybackStateFixture();
    const engine = require('../ui/animation-engine');
    const firstPlay = engine.play([{ type: 'place', phase: 1, targets: [] }]);

    await waitUntil(() => renderer.playBoardVisualPhase.mock.calls.length === 1);
    const firstToken = renderer.activeToken;
    playbackState.abortPlayback();

    const secondPlay = engine.play([{ type: 'flip', phase: 1, targets: [] }]);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(renderer.claimBoardVisualWriter).toHaveBeenCalledTimes(1);
    expect(renderer.playBoardVisualPhase).toHaveBeenCalledTimes(1);
    expect(renderer.activeToken).toBe(firstToken);

    renderer.resolveFirstPhase();
    await firstPlay;
    await waitUntil(() => renderer.playBoardVisualPhase.mock.calls.length === 2);

    const secondToken = renderer.activeToken;
    expect(secondToken).not.toBe(firstToken);
    expect(renderer.lifecycle).toEqual([
      `claim:${firstToken.id}`,
      `play:${firstToken.id}`,
      `settle:${firstToken.id}`,
      `release:${firstToken.id}`,
      `claim:${secondToken.id}`,
      `play:${secondToken.id}`
    ]);
    expect(playbackState.finalizePlayback).not.toHaveBeenCalled();
    expect(playbackState.getPlaybackActive()).toBe(true);

    renderer.resolveSecondPhase();
    await secondPlay;

    expect(renderer.lifecycle.slice(-2)).toEqual([
      `settle:${secondToken.id}`,
      `release:${secondToken.id}`
    ]);
    expect(renderer.releaseCount).toBe(2);
    expect(playbackState.finalizePlayback).toHaveBeenCalledTimes(1);
    expect(playbackState.getPlaybackActive()).toBe(false);
  });

  test('keeps the old run claim reservation across an abort while backend readiness is pending', async () => {
    jest.useRealTimers();
    (global as any).window.PLAYBACK_OVERLAP_WAIT_MS = 500;
    const renderer: RendererFixture = installRendererFixture({
      initialSettlementFails: false,
      deferReady: true,
      deferFirstPhase: true,
      deferSecondPhase: true
    });
    const playbackState = installPlaybackStateFixture();
    const engine = require('../ui/animation-engine');
    const firstPlay = engine.play([{ type: 'place', phase: 1, targets: [] }]);

    await waitUntil(() => renderer.getBoardVisualControllerReady.mock.calls.length === 1);
    expect(renderer.claimBoardVisualWriter).not.toHaveBeenCalled();
    playbackState.abortPlayback();

    const secondPlay = engine.play([{ type: 'flip', phase: 1, targets: [] }]);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(renderer.getBoardVisualControllerReady).toHaveBeenCalledTimes(1);
    expect(renderer.claimBoardVisualWriter).not.toHaveBeenCalled();

    renderer.resolveReady();
    await waitUntil(() => renderer.playBoardVisualPhase.mock.calls.length === 1);
    const firstToken = renderer.activeToken;
    expect(firstToken.frameToken).toBe('local:animation-engine:1');
    expect(renderer.claimBoardVisualWriter).toHaveBeenCalledTimes(1);

    renderer.resolveFirstPhase();
    await firstPlay;
    await waitUntil(() => renderer.playBoardVisualPhase.mock.calls.length === 2);
    const secondToken = renderer.activeToken;

    expect(secondToken.frameToken).toBe('local:animation-engine:2');
    expect(renderer.lifecycle).toEqual([
      `claim:${firstToken.id}`,
      `play:${firstToken.id}`,
      `settle:${firstToken.id}`,
      `release:${firstToken.id}`,
      `claim:${secondToken.id}`,
      `play:${secondToken.id}`
    ]);
    expect(playbackState.finalizePlayback).not.toHaveBeenCalled();
    expect(playbackState.getPlaybackActive()).toBe(true);

    renderer.resolveSecondPhase();
    await secondPlay;
    expect(renderer.releaseCount).toBe(2);
    expect(playbackState.finalizePlayback).toHaveBeenCalledTimes(1);
    expect(playbackState.getPlaybackActive()).toBe(false);
  });

  test('overlap timeout rejects the next run without overwriting the old token', async () => {
    jest.useRealTimers();
    (global as any).window.PLAYBACK_OVERLAP_WAIT_MS = 20;
    const renderer: RendererFixture = installRendererFixture({
      initialSettlementFails: false,
      deferFirstPhase: true
    });
    const playbackState = installPlaybackStateFixture();
    const engine = require('../ui/animation-engine');
    const event = { type: 'place', phase: 1, targets: [] };
    const firstPlay = engine.play([event]);

    await waitUntil(() => renderer.playBoardVisualPhase.mock.calls.length === 1);
    const firstToken = renderer.activeToken;
    playbackState.abortPlayback();

    await expect(engine.play([event])).rejects.toEqual(expect.objectContaining({
      name: 'PresentationPlaybackError',
      code: 'board_writer_active_run_unsettled'
    }));

    expect(renderer.claimBoardVisualWriter).toHaveBeenCalledTimes(1);
    expect(renderer.playBoardVisualPhase).toHaveBeenCalledTimes(1);
    expect(renderer.activeToken).toBe(firstToken);
    expect(engine._activeBoardWriterToken).toBe(firstToken);
    expect(engine._ownsActiveBoardWriterToken).toBe(true);
    expect(renderer.releaseCount).toBe(0);
    expect(playbackState.finalizePlayback).not.toHaveBeenCalled();

    renderer.resolveFirstPhase();
    await firstPlay;
    expect(renderer.releaseCount).toBe(1);
    expect(renderer.activeToken).toBeNull();
  });

  test('keeps the token and playback manager busy when checkpoint recovery fails', async () => {
    const renderer: RendererFixture = installRendererFixture({ recoveryFails: true });
    const playbackState = installPlaybackStateFixture();
    const engine = require('../ui/animation-engine');
    const event = { type: 'place', phase: 1, targets: [] };

    await expect(engine.play([event])).rejects.toEqual(expect.objectContaining({
      name: 'PresentationPlaybackError',
      code: 'board_writer_settlement_failed'
    }));

    const retainedToken = renderer.activeToken;
    expect(retainedToken).toEqual(expect.objectContaining({ mode: 'local' }));
    expect(renderer.mode).toBe('recovering');
    expect(renderer.releaseCount).toBe(0);
    expect(playbackState.finalizePlayback).not.toHaveBeenCalled();
    expect(playbackState.getPlaybackActive()).toBe(true);
    expect(engine._activeBoardWriterToken).toBe(retainedToken);
    expect(engine._ownsActiveBoardWriterToken).toBe(true);
    expect(engine._activePlaybackRunId).not.toBeNull();
    expect(engine.isPlaying).toBe(true);

    await expect(engine.play([event])).rejects.toEqual(expect.objectContaining({
      name: 'PresentationPlaybackError',
      code: 'board_writer_recovery_unresolved'
    }));
    expect(renderer.claimBoardVisualWriter).toHaveBeenCalledTimes(1);
    expect(renderer.playBoardVisualPhase).toHaveBeenCalledTimes(1);
    expect(renderer.activeToken).toBe(retainedToken);
    expect(playbackState.finalizePlayback).not.toHaveBeenCalled();
    expect(playbackState.getPlaybackActive()).toBe(true);
  });

  test('relocks manager settlement state when recovery fails after an external abort', async () => {
    jest.useRealTimers();
    const renderer: RendererFixture = installRendererFixture({
      recoveryFails: true,
      deferFirstPhase: true
    });
    const playbackState = installPlaybackStateFixture();
    const engine = require('../ui/animation-engine');
    const event = { type: 'place', phase: 1, targets: [] };
    const playPromise = engine.play([event]);

    await waitUntil(() => renderer.playBoardVisualPhase.mock.calls.length === 1);
    const retainedToken = renderer.activeToken;
    playbackState.abortPlayback();
    expect(playbackState.getPlaybackActive()).toBe(false);
    expect(playbackState.getProcessing()).toBe(false);
    expect(playbackState.getCardAnimating()).toBe(false);

    renderer.resolveFirstPhase();
    await expect(playPromise).rejects.toEqual(expect.objectContaining({
      name: 'PresentationPlaybackError',
      code: 'board_writer_settlement_failed'
    }));

    expect(renderer.mode).toBe('recovering');
    expect(renderer.activeToken).toBe(retainedToken);
    expect(renderer.releaseCount).toBe(0);
    expect(playbackState.setInteractionLock).toHaveBeenCalledWith(true);
    expect(playbackState.claimVisualPlayback).toHaveBeenCalledTimes(1);
    expect(playbackState.recordVisualPlaybackSettlementError).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ code: 'board_writer_settlement_failed' }),
      { stage: 'local-board-writer-recovery' }
    );
    expect(playbackState.getPlaybackActive()).toBe(true);
    expect(playbackState.getProcessing()).toBe(true);
    expect(playbackState.getCardAnimating()).toBe(true);
    expect(playbackState.finalizePlayback).not.toHaveBeenCalled();
    expect(engine._activePlaybackRunId).toBe(1);
    expect(engine.isPlaying).toBe(true);
    expect(engine._activeBoardWriterToken).toBe(retainedToken);
    expect(engine._ownsActiveBoardWriterToken).toBe(true);

    await expect(engine.play([event])).rejects.toEqual(expect.objectContaining({
      name: 'PresentationPlaybackError',
      code: 'board_writer_recovery_unresolved'
    }));
    expect(renderer.claimBoardVisualWriter).toHaveBeenCalledTimes(1);
    expect(renderer.activeToken).toBe(retainedToken);
    expect(playbackState.getPlaybackActive()).toBe(true);
    expect(playbackState.getProcessing()).toBe(true);
    expect(playbackState.getCardAnimating()).toBe(true);
  });

  test('direct executePhase retains its local claim when recovery cannot settle', async () => {
    const renderer: RendererFixture = installRendererFixture({ recoveryFails: true });
    installPlaybackStateFixture();
    const engine = require('../ui/animation-engine');
    const event = { type: 'place', phase: 1, targets: [] };

    await expect(engine.executePhase([event])).rejects.toEqual(expect.objectContaining({
      name: 'PresentationPlaybackError',
      code: 'board_writer_settlement_failed'
    }));

    const retainedToken = renderer.activeToken;
    expect(retainedToken).toEqual(expect.objectContaining({
      frameToken: expect.stringMatching(/^local:animation-engine-direct:/),
      mode: 'local'
    }));
    expect(renderer.mode).toBe('recovering');
    expect(engine._activeBoardWriterToken).toBe(retainedToken);
    expect(engine._ownsActiveBoardWriterToken).toBe(true);

    await expect(engine.executePhase([event])).rejects.toEqual(expect.objectContaining({
      name: 'PresentationPlaybackError',
      code: 'board_writer_recovery_unresolved'
    }));
    expect(renderer.claimBoardVisualWriter).toHaveBeenCalledTimes(1);
    expect(renderer.settleBoardVisualWriter).toHaveBeenCalledTimes(2);
    expect(renderer.releaseBoardVisualWriter).not.toHaveBeenCalled();
    expect(renderer.releaseCount).toBe(0);
    expect(renderer.activeToken).toBe(retainedToken);
  });
});
