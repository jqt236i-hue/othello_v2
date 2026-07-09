import { JSDOM } from 'jsdom';

describe('AnimationFlipEvents', () => {
  beforeEach(() => {
    jest.resetModules();
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="board">
        <div class="cell" data-row="2" data-col="2"><div class="disc black"></div></div>
        <div class="cell" data-row="2" data-col="3"><div class="disc white"></div></div>
      </div>
    </body></html>`);
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
  });

  afterEach(() => {
    delete (global as any).window;
    delete (global as any).document;
  });

  function createDeps(triggerFlip: jest.Mock) {
    return {
      eventTypes: { FLIP: 'flip' },
      flipMs: 10,
      fadeOutMs: 10,
      zombieBiteMs: 800,
      isNoAnim: () => false,
      getCellEl: (row: number, col: number) => document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`),
      resolveOwnerColorFromBefore: () => 1,
      resolveOwnerClassFromColor: () => 'black',
      syncDiscVisual: jest.fn((disc: HTMLElement, state: any) => {
        disc.classList.toggle('black', state.color === 1);
        disc.classList.toggle('white', state.color === -1);
      }),
      runWithEffectTargetHighlight: (_cell: Element, _eventType: string, _target: unknown, runner: () => Promise<void>) => runner(),
      sleep: jest.fn(() => Promise.resolve()),
      animationShared: {
        triggerFlip,
        removeFlip: jest.fn()
      }
    };
  }

  test('dedupes repeated flip targets for the same cell in one event', async () => {
    const flipEvents = require('../ui/animation-flip-events.js');
    const triggerFlip = jest.fn();
    const deps = createDeps(triggerFlip);

    await flipEvents.handleFlipEvent(
      {
        type: 'flip',
        targets: [
          { r: 2, col: 3, ownerBefore: 'black', after: { color: -1 } },
          { r: 2, col: 3, ownerBefore: 'black', after: { color: -1 } }
        ]
      },
      deps
    );

    expect(triggerFlip).toHaveBeenCalledTimes(1);
    expect(deps.syncDiscVisual).toHaveBeenCalledTimes(1);
  });

  test('syncs flipped color before starting the CSS flip animation', async () => {
    const flipEvents = require('../ui/animation-flip-events.js');
    const calls: string[] = [];
    const triggerFlip = jest.fn();
    const deps = createDeps(triggerFlip);
    deps.syncDiscVisual = jest.fn((disc: HTMLElement, state: any) => {
      calls.push(`sync:${state.color}`);
      disc.classList.toggle('black', state.color === 1);
      disc.classList.toggle('white', state.color === -1);
    });
    deps.animationShared.triggerFlip = jest.fn(() => {
      calls.push('trigger');
    });

    await flipEvents.handleFlipEvent(
      {
        type: 'flip',
        targets: [{ r: 2, col: 3, ownerBefore: 'black', after: { color: -1 } }]
      },
      deps
    );

    expect(calls).toEqual(['sync:-1', 'trigger']);
    const disc = document.querySelector('.cell[data-row="2"][data-col="3"] .disc') as HTMLElement;
    expect(disc.classList.contains('white')).toBe(true);
  });

  test('marks playback-flipped discs so final diff sync does not replay fallback flip', async () => {
    const flipEvents = require('../ui/animation-flip-events.js');
    const playbackFlipMarker = require('../ui/playback-flip-marker.js');
    const triggerFlip = jest.fn();
    const deps = createDeps(triggerFlip);

    await flipEvents.handleFlipEvent(
      {
        type: 'flip',
        targets: [{ r: 2, col: 3, ownerBefore: 'black', after: { color: -1 } }]
      },
      deps
    );

    const disc = document.querySelector('.cell[data-row="2"][data-col="3"] .disc') as HTMLElement;
    expect(disc.dataset.playbackFlipAt).toMatch(/^\d+$/);
    expect(playbackFlipMarker.hasRecentPlaybackFlipMarker(disc)).toBe(true);
  });

  test('keeps using the shared CSS flip helper when element.animate is available', async () => {
    const flipEvents = require('../ui/animation-flip-events.js');
    const triggerFlip = jest.fn();
    const deps = createDeps(triggerFlip);
    const disc = document.querySelector('.cell[data-row="2"][data-col="3"] .disc') as any;
    disc.animate = jest.fn();

    await flipEvents.handleFlipEvent(
      {
        type: 'flip',
        targets: [{ r: 2, col: 3, ownerBefore: 'black', after: { color: -1 } }]
      },
      deps
    );

    expect(disc.animate).not.toHaveBeenCalled();
    expect(triggerFlip).toHaveBeenCalledTimes(1);
  });

  test('plays the zombie bite, syncs the infected stone, and skips the regular flip pathway', async () => {
    const flipEvents = require('../ui/animation-flip-events.js');
    const playbackFlipMarker = require('../ui/playback-flip-marker.js');
    const calls: string[] = [];
    const triggerFlip = jest.fn(() => calls.push('trigger'));
    const deps = createDeps(triggerFlip);
    deps.syncDiscVisual = jest.fn((disc: HTMLElement, state: any) => {
      calls.push(`sync:${state.color}`);
      disc.classList.toggle('black', state.color === 1);
      disc.classList.toggle('white', state.color === -1);
    });
    deps.sleep = jest.fn((ms: number) => {
      if (ms === 800) {
        calls.push('bite');
        expect(document.querySelector('.zombie-bite-shadow')).not.toBeNull();
        expect(document.querySelectorAll('.zombie-bite-fang')).toHaveLength(2);
        expect(document.querySelector('.cell[data-row="2"][data-col="3"]')?.classList.contains('zombie-bite-active')).toBe(true);
      }
      return Promise.resolve();
    });

    await flipEvents.handleFlipEvent({
      type: 'flip',
      targets: [{
        r: 2,
        col: 3,
        ownerBefore: 'white',
        cause: 'ZOMBIE',
        reason: 'zombie_infection',
        meta: { sourceRow: 2, sourceCol: 2 },
        after: { color: 1, special: 'ZOMBIE' }
      }]
    }, deps);

    expect(calls).toEqual(['bite', 'sync:1']);
    // Infection must NOT take the regular flip pathway.
    expect(triggerFlip).not.toHaveBeenCalled();
    expect(deps.animationShared.removeFlip).not.toHaveBeenCalled();
    const sleepMsArgs = deps.sleep.mock.calls.map((c) => c[0]);
    expect(sleepMsArgs).not.toContain(deps.flipMs);

    const disc = document.querySelector('.cell[data-row="2"][data-col="3"] .disc') as HTMLElement;
    // No playback flip marker should be left behind on the infected disc.
    expect(disc.dataset.playbackFlipAt).toBeUndefined();
    expect(playbackFlipMarker.hasRecentPlaybackFlipMarker(disc)).toBe(false);
    // Visual state should already reflect the infected player's color.
    expect(disc.classList.contains('black')).toBe(true);

    expect(document.querySelector('.zombie-bite-shadow')).toBeNull();
    expect(document.querySelectorAll('.zombie-bite-fang')).toHaveLength(0);
    expect(document.querySelector('.zombie-bite-active')).toBeNull();
  });

  test('keeps the regular flip pathway for non-zombie-infection CHANGE events', async () => {
    const flipEvents = require('../ui/animation-flip-events.js');
    const playbackFlipMarker = require('../ui/playback-flip-marker.js');
    const triggerFlip = jest.fn();
    const deps = createDeps(triggerFlip);

    await flipEvents.handleFlipEvent({
      type: 'flip',
      targets: [{ r: 2, col: 3, ownerBefore: 'black', after: { color: -1 } }]
    }, deps);

    expect(triggerFlip).toHaveBeenCalledTimes(1);
    expect(deps.sleep).toHaveBeenCalledWith(deps.flipMs);
    const disc = document.querySelector('.cell[data-row="2"][data-col="3"] .disc') as HTMLElement;
    expect(playbackFlipMarker.hasRecentPlaybackFlipMarker(disc)).toBe(true);
  });

  test('skips zombie bite DOM when animations are disabled', async () => {
    const flipEvents = require('../ui/animation-flip-events.js');
    const triggerFlip = jest.fn();
    const deps = createDeps(triggerFlip);
    deps.isNoAnim = () => true;
    deps.sleep = jest.fn(() => Promise.resolve());

    await flipEvents.handleFlipEvent({
      type: 'flip',
      targets: [{
        r: 2,
        col: 3,
        cause: 'ZOMBIE',
        reason: 'zombie_infection',
        meta: { sourceRow: 2, sourceCol: 2 },
        after: { color: 1, special: 'ZOMBIE' }
      }]
    }, deps);

    expect(document.querySelector('.zombie-bite-shadow')).toBeNull();
    expect(document.querySelector('.zombie-bite-fang')).toBeNull();
    expect(deps.sleep).not.toHaveBeenCalledWith(800);
    expect(deps.syncDiscVisual).toHaveBeenCalledTimes(1);
    expect(triggerFlip).not.toHaveBeenCalled();
  });
});
