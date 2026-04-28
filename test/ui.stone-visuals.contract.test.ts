import { JSDOM } from 'jsdom';

describe('ui stone visuals contract split', () => {
  let dom;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    dom = new JSDOM('<!doctype html><html><body><div class="cell"><div class="disc black"></div></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    global.applyStoneVisualEffect = jest.fn();
  });

  afterEach(() => {
    if (dom && dom.window) dom.window.close();
    delete global.window;
    delete global.document;
    delete global.requestAnimationFrame;
    delete global.applyStoneVisualEffect;
    jest.useRealTimers();
  });

  test('applyStoneVisualState applies final visual state immediately', () => {
    import * as stoneVisuals from '../ui/stone-visuals.js';
    const disc = document.querySelector('.disc');

    stoneVisuals.applyStoneVisualState(disc, {
      effectKey: 'regenStone',
      owner: 1,
      newColor: -1
    });

    expect(disc.classList.contains('white')).toBe(true);
    expect(global.applyStoneVisualEffect).toHaveBeenCalledWith(disc, 'regenStone', { owner: 1 });
  });

  test('applyStoneVisualState does not force white when newColor is 0', () => {
    import * as stoneVisuals from '../ui/stone-visuals.js';
    const disc = document.querySelector('.disc');

    stoneVisuals.applyStoneVisualState(disc, {
      effectKey: 'regenStone',
      owner: 'black',
      newColor: 0
    });

    expect(disc.classList.contains('black')).toBe(true);
    expect(disc.classList.contains('white')).toBe(false);
    expect(global.applyStoneVisualEffect).toHaveBeenCalledWith(disc, 'regenStone', { owner: 'black' });
  });

  test('crossfadeStoneVisual uses the animated API and removes overlay remnants', async () => {
    import * as stoneVisuals from '../ui/stone-visuals.js';
    const disc = document.querySelector('.disc');

    let resolved = false;
    const playback = stoneVisuals.crossfadeStoneVisual(disc, {
      effectKey: 'regenStone',
      owner: 1,
      newColor: 1,
      durationMs: 50
    });
    playback.then(() => { resolved = true; });

    jest.advanceTimersByTime(0);
    await Promise.resolve();
    expect(resolved).toBe(false);

    jest.advanceTimersByTime(50);
    await playback;

    expect(resolved).toBe(true);
    expect(document.querySelector('.stone-fade-overlay')).toBeNull();
    expect(global.applyStoneVisualEffect).toHaveBeenCalledWith(disc, 'regenStone', { owner: 1 });
  });
});
