import { JSDOM } from 'jsdom';

describe('AnimationHandEvents place hand playback', () => {
  beforeEach(() => {
    jest.resetModules();
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
  });

  afterEach(() => {
    delete (global as any).window;
    delete (global as any).document;
  });

  test('waits for returned hand animation promise after placement callback', async () => {
    const handEvents = require('../ui/animation-hand-events.js');
    let resolveHandAnimation: (() => void) | null = null;
    const handAnimationFinished = new Promise<void>((resolve) => {
      resolveHandAnimation = resolve;
    });
    (window as any).playHandAnimation = jest.fn((_player: unknown, _row: unknown, _col: unknown, done: () => void) => {
      done();
      return handAnimationFinished;
    });

    const playback = handEvents.handleHandPlaybackEvent(
      {
        type: 'place_hand_animation',
        targets: [{ r: 2, col: 3, player: 'black' }]
      },
      {
        timer: () => ({ setTimeout: jest.fn(() => 1), clearTimeout: jest.fn() }),
        playbackScope: null,
        resolvePlaceHandDescriptor: () => ({ playerKey: 'black', r: 2, col: 3 }),
        shouldPlayPlaceHandAnimation: () => true,
        resolvePlayerValue: () => 1,
        consumeLocalCardUseAnimationSkip: () => false,
        armSkipNextCardUseButtonSound: jest.fn(),
        armLocalCardUseAnimationSkip: jest.fn(),
        executeEvent: jest.fn(),
        fallbackPlayHandAnimation: null
      }
    );

    let settled = false;
    playback.then(() => {
      settled = true;
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(settled).toBe(false);

    resolveHandAnimation && resolveHandAnimation();
    await playback;
    expect(settled).toBe(true);
  });
});
