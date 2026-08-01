import { JSDOM } from 'jsdom';
import {
  createNetworkSpecialStonePerformanceFixture,
  runHeadlessFixtureTurnStart
} from './helpers/network-special-stone-performance-fixtures';

const AnimationConstants = require('../ui/animation-constants.js');
const StateHash = require('../shared/state-hash.js');

function nominalEventDurationMs(event: any): number {
  const explicit = Number(event && (event.durationMs ?? event.duration));
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  switch (String(event && event.type || '').toLowerCase()) {
    case 'move': return Number(AnimationConstants.MOVE_MS) || 400;
    case 'flip': return Number(AnimationConstants.FLIP_MS) || 460;
    case 'destroy': return Number(AnimationConstants.FADE_OUT_MS) || 500;
    case 'spawn':
    case 'place':
      return Math.max(
        Number(AnimationConstants.FADE_IN_MS) || 300,
        Number(AnimationConstants.POSITIVE_HIGHLIGHT_MIN_VISIBLE_MS) || 500
      );
    case 'status_applied':
    case 'status_removed': return Number(AnimationConstants.OVERLAY_CROSSFADE_MS) || 600;
    case 'observer_bubble':
      return (Number(AnimationConstants.OBSERVER_BUBBLE_MS) || 3000)
        + (Number(AnimationConstants.OBSERVER_BUBBLE_FADE_MS) || 700);
    case 'theory_incarnation_spawn_roulette':
      return (Number(AnimationConstants.THEORY_SPAWN_ROULETTE_MS) || 2500)
        + (Number(AnimationConstants.THEORY_SPAWN_MATERIALIZE_MS) || 2000);
    case 'manifest_ending': return 2000;
    case 'round_bonus_banner': return 3000;
    default: return 0;
  }
}

function playbackContract(events: any[]) {
  const phaseDurations = new Map<string, number>();
  const soundKeys: string[] = [];
  events.forEach((event: any, index: number) => {
    const phase = String(Object.prototype.hasOwnProperty.call(event || {}, 'phase') ? event.phase : index);
    phaseDurations.set(phase, Math.max(phaseDurations.get(phase) || 0, nominalEventDurationMs(event)));
    if (event && event.soundKey) soundKeys.push(String(event.soundKey));
    for (const target of (event && Array.isArray(event.targets) ? event.targets : [])) {
      if (target && target.soundKey) soundKeys.push(String(target.soundKey));
    }
  });
  return {
    eventCount: events.length,
    phaseCount: phaseDurations.size,
    durationMs: Array.from(phaseDurations.values()).reduce((sum, value) => sum + value, 0)
      + Math.max(0, phaseDurations.size - 1) * (Number(AnimationConstants.PHASE_GAP_MS) || 200),
    playbackDigest: StateHash.computeStableHash(events),
    soundDigest: StateHash.computeStableHash(soundKeys)
  };
}

describe('special-stone playback phase batching', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.dontMock('../ui/animation-destroy-events');
    jest.dontMock('../ui/animation-destroy-source-events');
    delete (global as any).window;
    delete (global as any).document;
  });

  test('late-special playback keeps the characterized event, phase, duration, and sound contract', () => {
    const fixture = createNetworkSpecialStonePerformanceFixture('late-special-20');
    const result = runHeadlessFixtureTurnStart(fixture);

    expect(playbackContract(result.playbackEvents)).toEqual({
      eventCount: 42,
      phaseCount: 9,
      durationMs: 12400,
      playbackDigest: 'fnv1a32:0743f7b1',
      soundDigest: 'fnv1a32:fb5bcb1a'
    });
  });

  test('cell lookup is shared within one phase and discarded before the next phase', async () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="board"><div class="cell" data-row="2" data-col="3"></div></div>
    </body></html>`);
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;

    const { createDomBoardPlaybackHandlers } = require('../ui/board-dom-compat/runtime');
    const { createDomBoardPlaybackExecutor } = require('../ui/board-dom-compat/playback');
    const board = document.getElementById('board') as HTMLElement;
    const querySelector = jest.spyOn(board, 'querySelector');
    const executor = createDomBoardPlaybackExecutor(createDomBoardPlaybackHandlers({
      boardElement: board,
      documentRef: document
    }));
    const token = { id: 1, frameToken: 'batching:4', mode: 'local' };
    const firstScope = { phaseKey: '4', stepIndex: 0 };
    const event = {
      type: '__dom_compatibility_final_state',
      phase: 4,
      targets: [{ r: 2, col: 3, after: { color: 0, special: null, timer: null } }]
    };

    await executor.playPhase([event, event], { token, phaseScope: firstScope });
    expect(querySelector).toHaveBeenCalledTimes(1);

    await executor.playPhase([
      { ...event, phase: 5 }
    ], {
      token,
      phaseScope: { phaseKey: '5', stepIndex: 1 }
    });
    expect(querySelector).toHaveBeenCalledTimes(2);

    dom.window.close();
  });

  test('transient overlays batch body mutations into one append and one removal per phase', async () => {
    jest.doMock('../ui/animation-destroy-events', () => ({
      handleDestroyEvent: async (event: any, deps: any) => {
        await Promise.all(event.targets.map((target: any) => deps.playDestroySourceAnimation(
          target,
          deps.resolveDestroySourceAnimationProfile(target)
        )));
      }
    }));
    jest.doMock('../ui/animation-destroy-source-events', () => ({
      animateUdgLightningStrike: async (_target: any, deps: any) => {
        deps.transientOverlayBatch.append(document.createElement('div'));
      }
    }));
    const dom = new JSDOM(`<!doctype html><html><body><div id="board">
      <div class="cell" data-row="1" data-col="3"></div>
      <div class="cell" data-row="2" data-col="3"></div>
      <div class="cell" data-row="2" data-col="4"></div>
    </div></body></html>`);
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;

    const board = document.getElementById('board') as HTMLElement;
    Object.defineProperty(board, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, right: 300, bottom: 300, width: 300, height: 300 })
    });
    for (const cell of Array.from(board.querySelectorAll<HTMLElement>('.cell'))) {
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      Object.defineProperty(cell, 'getBoundingClientRect', {
        value: () => ({
          left: col * 30,
          top: row * 30,
          right: (col + 1) * 30,
          bottom: (row + 1) * 30,
          width: 30,
          height: 30
        })
      });
    }

    const { createDomBoardPlaybackHandlers } = require('../ui/board-dom-compat/runtime');
    const { createDomBoardPlaybackExecutor } = require('../ui/board-dom-compat/playback');
    const executor = createDomBoardPlaybackExecutor(createDomBoardPlaybackHandlers({
      boardElement: board,
      documentRef: document,
      isNoAnim: () => false
    }));
    const bodyAppend = jest.spyOn(document.body, 'appendChild');
    const bodyRemove = jest.spyOn(document.body, 'removeChild');
    const target = {
      r: 2,
      col: 3,
      sourceRow: 1,
      sourceCol: 3,
      cause: 'ULTIMATE_DESTROY_GOD',
      reason: 'udg_destroyed'
    };

    await executor.playPhase([
      { type: 'destroy', phase: 8, targets: [target] },
      { type: 'destroy', phase: 8, targets: [{ ...target, col: 4 }] }
    ], {
      token: { id: 1, frameToken: 'batching:8', mode: 'local' },
      phaseScope: { phaseKey: '8', stepIndex: 0 }
    });

    expect(bodyAppend).toHaveBeenCalledTimes(1);
    expect(bodyRemove).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.transient-overlay-batch')).toBeNull();
    dom.window.close();
  });

  test('a completed playback requests exactly one scheduled final board refresh', async () => {
    jest.doMock('../ui/animation-shared.js', () => ({
      isNoAnim: () => true,
      getTimer: () => ({
        setTimeout: () => 1,
        clearTimeout: jest.fn(),
        clearScope: jest.fn(),
        newScope: () => 1
      })
    }));
    const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;

    const BoardUpdateDispatch = require('../ui/board-update-dispatch');
    const requestBoardUpdate = jest.spyOn(BoardUpdateDispatch, 'requestBoardUpdate').mockReturnValue(true);
    const engine = require('../ui/animation-engine.js');
    jest.spyOn(engine, 'executePhase').mockResolvedValue(undefined);

    await engine.play([
      { type: 'log', phase: 1, message: 'first' },
      { type: 'log', phase: 2, message: 'second' }
    ]);

    expect(requestBoardUpdate).toHaveBeenCalledTimes(1);
    dom.window.close();
  });
});
