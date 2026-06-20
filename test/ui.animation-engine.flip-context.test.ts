import { JSDOM } from 'jsdom';

describe('AnimationEngine flip suppression context', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();

    const dom = new JSDOM('<!doctype html><html><body><div id="board"><div class="cell" data-row="0" data-col="0"><div class="disc black"></div></div></div></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).HTMLElement = dom.window.HTMLElement;
    (global as any).BLACK = 1;
    (global as any).WHITE = -1;
    (global as any).EMPTY = 0;
    (global as any).SoundEngine = { playEffectByKey: jest.fn(), init: jest.fn() };
    (global as any).OwnerHelpers = null;
    window.DISABLE_ANIMATIONS = true;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    delete (global as any).window;
    delete (global as any).document;
    delete (global as any).HTMLElement;
    delete (global as any).BLACK;
    delete (global as any).WHITE;
    delete (global as any).EMPTY;
    delete (global as any).SoundEngine;
    delete (global as any).OwnerHelpers;
    delete (global as any).emitBoardUpdate;
  });

  test('arms fallback flip suppression before a hand placement playback finishes', async () => {
    const playbackState = require('../ui/playback-state-manager.js');
    const animationEngine = require('../ui/animation-engine.js');
    const board = document.getElementById('board');
    animationEngine.boardEl = board;

    let finishHandAnimation: (() => void) | null = null;
    (window as any).playHandAnimation = (_player: unknown, _row: unknown, _col: unknown, done: () => void) => {
      finishHandAnimation = done;
    };
    (global as any).emitBoardUpdate = jest.fn();

    const playPromise = animationEngine.play([
      {
        type: 'place_hand_animation',
        phase: 0,
        targets: [{ r: 0, col: 1, player: 'black' }]
      },
      {
        type: 'flip',
        phase: 1,
        targets: [{ r: 0, col: 0, ownerBefore: 'black', after: { color: -1 } }]
      }
    ]);

    expect(playbackState.getBoardUpdateContext()).toMatchObject({
      suppressFallbackFlip: true,
      source: 'animation-engine',
      reason: 'playback_start'
    });

    expect(typeof finishHandAnimation).toBe('function');
    finishHandAnimation && finishHandAnimation();
    await playPromise;
  });
});
