const { JSDOM } = require('jsdom');

describe('animation-engine guard timer rendering', () => {
  let dom;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.window.__telemetry__ = { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 };
    global.window.getEffectKeyForSpecialType = () => null;
    global.window.applyStoneVisualEffect = () => {};
  });

  afterEach(() => {
    if (dom && dom.window) dom.window.close();
    delete global.window;
    delete global.document;
  });

  test('uses only guard-timer for GUARD status updates', () => {
    const engine = require('../ui/animation-engine');
    const disc = document.createElement('div');
    disc.className = 'disc black';

    const oldTimer = document.createElement('div');
    oldTimer.className = 'stone-timer bomb-timer';
    oldTimer.textContent = '3';
    disc.appendChild(oldTimer);

    engine.syncDiscVisual(disc, { color: 1, special: 'GUARD', timer: 2, owner: 'black' });

    const guardTimers = disc.querySelectorAll('.guard-timer');
    expect(guardTimers.length).toBe(1);
    expect(guardTimers[0].textContent).toBe('2');
    expect(disc.querySelector('.bomb-timer')).toBeNull();
    expect(disc.querySelector('.stone-timer')).toBeNull();
  });
});
