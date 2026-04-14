const { JSDOM } = require('jsdom');

describe('animation-engine inherited hyperactive timer rendering', () => {
  let dom;
  let applyStoneVisualEffectMock;
  let clearStoneVisualEffectStateMock;
  let setDiscStoneImageMock;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.window.__telemetry__ = { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 };
    global.window.getEffectKeyForSpecialType = (type) => (type ? `effect-${String(type).toLowerCase()}` : null);
    applyStoneVisualEffectMock = jest.fn();
    clearStoneVisualEffectStateMock = jest.fn();
    setDiscStoneImageMock = jest.fn();
    global.window.applyStoneVisualEffect = applyStoneVisualEffectMock;
    global.window.clearStoneVisualEffectState = clearStoneVisualEffectStateMock;
    global.window.setDiscStoneImage = setDiscStoneImageMock;
  });

  afterEach(() => {
    if (dom && dom.window) dom.window.close();
    delete global.window;
    delete global.document;
  });

  test('INHERITED_HYPERACTIVE は見た目を上書きせず、継承タイマーと回避カウントを表示する', () => {
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
      inheritedFlipEvadeRemaining: 1,
      destroyEvadeRemaining: 1
    });

    const timer = disc.querySelector('.inherited-hyperactive-timer');
    const evadeTimer = disc.querySelector('.flip-evade-timer');
    const destroyEvadeTimer = disc.querySelector('.destroy-evade-timer');
    expect(timer).not.toBeNull();
    expect(timer.textContent).toBe('4');
    expect(timer.classList.contains('special-timer')).toBe(true);
    expect(evadeTimer).not.toBeNull();
    expect(evadeTimer.textContent).toBe('1');
    expect(destroyEvadeTimer).not.toBeNull();
    expect(destroyEvadeTimer.textContent).toBe('1');
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

  test('特殊石同期は通常石への描き戻しなしで visual を載せる', () => {
    const engine = require('../ui/animation-engine');
    const disc = document.createElement('div');
    disc.className = 'disc black';
    global.window.getEffectKeyForSpecialType = (type) => (type ? `effect-${String(type).toLowerCase()}` : null);
    global.window.applyStoneVisualEffect = applyStoneVisualEffectMock;
    global.window.clearStoneVisualEffectState = clearStoneVisualEffectStateMock;
    global.window.setDiscStoneImage = setDiscStoneImageMock;

    engine.syncDiscVisual(disc, {
      color: 1,
      special: 'HYPERACTIVE',
      owner: 'black'
    });

    expect(setDiscStoneImageMock).not.toHaveBeenCalled();
    expect(clearStoneVisualEffectStateMock).toHaveBeenCalledWith(disc, { skipRenderReset: true });
    expect(applyStoneVisualEffectMock).toHaveBeenCalledWith(disc, 'effect-hyperactive', { owner: 'black' });
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

  test('WILL_HUNTER_KING は破壊回避カウントを表示する', () => {
    const engine = require('../ui/animation-engine');
    const disc = document.createElement('div');
    disc.className = 'disc black';

    engine.syncDiscVisual(disc, {
      color: 1,
      special: 'WILL_HUNTER_KING',
      timer: 8,
      owner: 'black',
      flipEvadeRemaining: 2,
      destroyEvadeRemaining: 2
    });

    const destroyEvadeTimer = disc.querySelector('.destroy-evade-timer');
    const flipEvadeTimer = disc.querySelector('.flip-evade-timer');
    expect(destroyEvadeTimer).not.toBeNull();
    expect(destroyEvadeTimer.textContent).toBe('2');
    expect(flipEvadeTimer).not.toBeNull();
    expect(flipEvadeTimer.textContent).toBe('2');
  });

  test('EXTREME_HYPERACTIVE は破壊回避カウントを表示する', () => {
    const engine = require('../ui/animation-engine');
    const disc = document.createElement('div');
    disc.className = 'disc black';

    engine.syncDiscVisual(disc, {
      color: 1,
      special: 'EXTREME_HYPERACTIVE',
      owner: 'black',
      flipEvadeRemaining: 3,
      destroyEvadeRemaining: 1
    });

    const destroyEvadeTimer = disc.querySelector('.destroy-evade-timer');
    const flipEvadeTimer = disc.querySelector('.flip-evade-timer');
    expect(destroyEvadeTimer).not.toBeNull();
    expect(destroyEvadeTimer.textContent).toBe('1');
    expect(flipEvadeTimer).not.toBeNull();
    expect(flipEvadeTimer.textContent).toBe('3');
  });
});
