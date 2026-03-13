const { JSDOM } = require('jsdom');

describe('animation-engine inherited hyperactive timer rendering', () => {
  let dom;
  let applyStoneVisualEffectMock;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.window.__telemetry__ = { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 };
    global.window.getEffectKeyForSpecialType = (type) => (type ? `effect-${String(type).toLowerCase()}` : null);
    applyStoneVisualEffectMock = jest.fn();
    global.window.applyStoneVisualEffect = applyStoneVisualEffectMock;
  });

  afterEach(() => {
    if (dom && dom.window) dom.window.close();
    delete global.window;
    delete global.document;
  });

  test('INHERITED_HYPERACTIVE は見た目を上書きせず、継承タイマーのみ表示する', () => {
    const engine = require('../ui/animation-engine');
    const disc = document.createElement('div');
    disc.className = 'disc black';

    engine.syncDiscVisual(disc, {
      color: 1,
      special: 'INHERITED_HYPERACTIVE',
      timer: 4,
      inheritedTimer: 4,
      owner: 'black',
      flipEvadeRemaining: 1,
      inheritedFlipEvadeRemaining: 1
    });

    const timer = disc.querySelector('.inherited-hyperactive-timer');
    const evadeTimer = disc.querySelector('.flip-evade-timer');
    expect(timer).not.toBeNull();
    expect(timer.textContent).toBe('4');
    expect(timer.classList.contains('special-timer')).toBe(true);
    expect(evadeTimer).not.toBeNull();
    expect(evadeTimer.textContent).toBe('1');
    expect(disc.querySelector('.guard-timer')).toBeNull();
    expect(applyStoneVisualEffectMock).not.toHaveBeenCalled();
  });

  test('flipEvadeRemaining は 0 でも表示する', () => {
    const engine = require('../ui/animation-engine');
    const disc = document.createElement('div');
    disc.className = 'disc black';

    engine.syncDiscVisual(disc, {
      color: 1,
      special: 'HYPERACTIVE',
      timer: 5,
      owner: 'black',
      flipEvadeRemaining: 0
    });

    const evadeTimer = disc.querySelector('.flip-evade-timer');
    expect(evadeTimer).not.toBeNull();
    expect(evadeTimer.textContent).toBe('0');
  });

  test('通常特殊石と継承多動が共存する場合、反転回避回数は合算表示する', () => {
    const engine = require('../ui/animation-engine');
    const disc = document.createElement('div');
    disc.className = 'disc black';

    engine.syncDiscVisual(disc, {
      color: 1,
      special: 'ULTIMATE_HYPERACTIVE',
      timer: 10,
      inheritedTimer: 4,
      owner: 'black',
      inheritedOwner: 'black',
      flipEvadeRemaining: 5,
      inheritedFlipEvadeRemaining: 1
    });

    const evadeTimers = disc.querySelectorAll('.flip-evade-timer');
    expect(evadeTimers.length).toBe(1);
    expect(evadeTimers[0].textContent).toBe('6');
    const inheritedTimer = disc.querySelector('.inherited-hyperactive-timer');
    expect(inheritedTimer).not.toBeNull();
    expect(inheritedTimer.textContent).toBe('4');
  });

  test('flipEvadeRemaining が未設定(null)なら通常石で表示しない', () => {
    const engine = require('../ui/animation-engine');
    const disc = document.createElement('div');
    disc.className = 'disc black';

    engine.syncDiscVisual(disc, {
      color: 1,
      special: null,
      timer: null,
      owner: 'black',
      flipEvadeRemaining: null,
      inheritedFlipEvadeRemaining: null
    });

    const evadeTimer = disc.querySelector('.flip-evade-timer');
    expect(evadeTimer).toBeNull();
  });

  test('非多動系特殊石は flipEvadeRemaining=0 でも表示しない', () => {
    const engine = require('../ui/animation-engine');
    const disc = document.createElement('div');
    disc.className = 'disc black';

    engine.syncDiscVisual(disc, {
      color: 1,
      special: 'DRAGON',
      timer: 3,
      owner: 'black',
      flipEvadeRemaining: 0,
      inheritedFlipEvadeRemaining: null
    });

    const evadeTimer = disc.querySelector('.flip-evade-timer');
    expect(evadeTimer).toBeNull();
  });

  test('通常特殊石タイマーと継承タイマーを同時表示できる', () => {
    const engine = require('../ui/animation-engine');
    const disc = document.createElement('div');
    disc.className = 'disc black';

    engine.syncDiscVisual(disc, {
      color: 1,
      special: 'DRAGON',
      timer: 3,
      inheritedTimer: 4,
      owner: 'black',
      inheritedOwner: 'black'
    });

    const dragonTimer = disc.querySelector('.dragon-timer');
    const inheritedTimer = disc.querySelector('.inherited-hyperactive-timer');
    expect(dragonTimer).not.toBeNull();
    expect(dragonTimer.textContent).toBe('3');
    expect(inheritedTimer).not.toBeNull();
    expect(inheritedTimer.textContent).toBe('4');
    expect(disc.querySelectorAll('.stone-timer, .guard-timer').length).toBe(2);
  });
});
