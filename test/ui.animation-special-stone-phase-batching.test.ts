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
    delete (global as any).window;
    delete (global as any).document;
  });

  test('late-special playback keeps the characterized event, phase, duration, and sound contract', () => {
    const fixture = createNetworkSpecialStonePerformanceFixture('late-special-20');
    const result = runHeadlessFixtureTurnStart(fixture);

    expect(playbackContract(result.playbackEvents)).toEqual({
      eventCount: 45,
      phaseCount: 9,
      durationMs: 15700,
      playbackDigest: 'fnv1a32:b0651467',
      soundDigest: 'fnv1a32:2d67f1de'
    });
  });

  test('cell lookup is shared within one phase and discarded before the next phase', async () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="board"><div class="cell" data-row="2" data-col="3"></div></div>
    </body></html>`);
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;

    const engine = require('../ui/animation-engine.js');
    const board = document.getElementById('board') as HTMLElement;
    const querySelector = jest.spyOn(board, 'querySelector');
    const contexts: any[] = [];
    jest.spyOn(engine, 'executeEvent').mockImplementation(async () => {
      contexts.push(engine._phaseContext);
      expect(engine.getCellEl(2, 3)).toBeTruthy();
      expect(engine.getCellEl(2, 3)).toBeTruthy();
    });

    await engine.executePhase([
      { type: 'log', phase: 4 },
      { type: 'log', phase: 4 }
    ]);
    expect(querySelector).toHaveBeenCalledTimes(1);
    expect(contexts[0]).toBe(contexts[1]);
    expect(engine._phaseContext).toBeNull();

    await engine.executePhase([{ type: 'log', phase: 5 }]);
    expect(querySelector).toHaveBeenCalledTimes(2);
    expect(contexts[2]).not.toBe(contexts[0]);

    dom.window.close();
  });

  test('transient overlays batch body mutations into one append and one removal per phase', async () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;

    const engine = require('../ui/animation-engine.js');
    const bodyAppend = jest.spyOn(document.body, 'appendChild');
    const bodyRemove = jest.spyOn(document.body, 'removeChild');
    const context = engine._buildPhaseContext([]);

    await engine._withPhaseContext(context, async () => {
      context.transientOverlayBatch.append(document.createElement('div'));
      context.transientOverlayBatch.append(document.createElement('div'));
      expect(bodyAppend).toHaveBeenCalledTimes(1);
      expect(document.querySelectorAll('.transient-overlay-batch > div')).toHaveLength(2);
    });

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
