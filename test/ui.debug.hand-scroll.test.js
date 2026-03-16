const path = require('path');
const { JSDOM } = require('jsdom');

function dispatchPointer(target, type, props) {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  const p = props || {};
  Object.defineProperty(ev, 'pointerId', { value: p.pointerId ?? 1 });
  Object.defineProperty(ev, 'pointerType', { value: p.pointerType ?? 'touch' });
  Object.defineProperty(ev, 'button', { value: p.button ?? 0 });
  Object.defineProperty(ev, 'buttons', { value: p.buttons ?? (type === 'pointerdown' || type === 'pointermove' ? 1 : 0) });
  Object.defineProperty(ev, 'clientX', { value: p.clientX ?? 0 });
  Object.defineProperty(ev, 'clientY', { value: p.clientY ?? 0 });
  target.dispatchEvent(ev);
}

function dispatchWheel(target, props) {
  const ev = new Event('wheel', { bubbles: true, cancelable: true });
  const p = props || {};
  Object.defineProperty(ev, 'deltaX', { value: p.deltaX ?? 0 });
  Object.defineProperty(ev, 'deltaY', { value: p.deltaY ?? 0 });
  target.dispatchEvent(ev);
}

describe('debug hand fling', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    try { delete global.window; } catch (e) {}
    try { delete global.document; } catch (e) {}
    try { delete global.Event; } catch (e) {}
    try { delete global.addLog; } catch (e) {}
    try { delete global.fillDebugHand; } catch (e) {}
    try { delete global.renderCardUI; } catch (e) {}
  });

  test('debug on allows immediate horizontal swipe and suppresses post-drag card click', () => {
    const dom = new JSDOM(`
      <!doctype html>
      <html>
        <body>
          <div id="hand-black" class="hand-container"><div class="hand-track"><div id="black-card" class="card-item visible clickable"></div></div></div>
          <div id="hand-white" class="hand-container"></div>
          <button id="autoToggleBtn" type="button">AUTO: ON</button>
        </body>
      </html>
    `);
    global.window = dom.window;
    global.document = dom.window.document;
    global.Event = dom.window.Event;
    global.addLog = jest.fn();
    global.fillDebugHand = jest.fn();
    global.renderCardUI = jest.fn();

    const uiState = {
      DEBUG_MODE_ALLOWED: false,
      DEBUG_UNLIMITED_USAGE: false,
      DEBUG_HUMAN_VS_HUMAN: false,
      disableAutoMode: jest.fn()
    };
    const registerCalls = [];

    jest.isolateModules(() => {
      jest.doMock(path.resolve(__dirname, '..', 'ui', 'bootstrap.js'), () => ({
        registerUIGlobals: (obj) => {
          registerCalls.push(obj);
          Object.assign(uiState, obj);
          return obj;
        },
        getRegisteredUIGlobals: () => uiState
      }), { virtual: false });

      require(path.resolve(__dirname, '..', 'ui', 'handlers', 'debug.js'));
    });

    const registered = registerCalls.find((entry) => entry && typeof entry.setupDebugControls === 'function');
    expect(registered).toBeTruthy();

    const debugBtn = document.createElement('button');
    const humanBtn = document.createElement('button');
    const visualBtn = document.createElement('button');
    registered.setupDebugControls(debugBtn, humanBtn, visualBtn);

    debugBtn.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
    expect(document.documentElement.classList.contains('debug-layout')).toBe(true);

    const handBlackEl = document.getElementById('hand-black');
    const handTrackEl = handBlackEl.querySelector('.hand-track');
    const cardEl = document.getElementById('black-card');
    Object.defineProperty(handBlackEl, 'clientWidth', { configurable: true, value: 120 });
    Object.defineProperty(handTrackEl, 'scrollWidth', { configurable: true, value: 320 });
    handTrackEl.getBoundingClientRect = () => ({ width: 320, left: 0, right: 320, top: 0, bottom: 80, height: 80 });
    handBlackEl.scrollLeft = 0;
    const clickSpy = jest.fn();
    cardEl.addEventListener('click', clickSpy);

    dispatchPointer(cardEl, 'pointerdown', { clientX: 160, clientY: 32 });
    dispatchPointer(handBlackEl, 'pointermove', { clientX: 92, clientY: 35 });
    expect(handTrackEl.style.transform).toBe('translate3d(-68px, 0, 0)');

    dispatchPointer(handBlackEl, 'pointerup', { clientX: 92, clientY: 35 });
    jest.advanceTimersByTime(32);
    cardEl.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
    expect(clickSpy).not.toHaveBeenCalled();
  });

  test('normal click with minor jitter does not suppress card click', () => {
    const dom = new JSDOM(`
      <!doctype html>
      <html>
        <body>
          <div id="hand-black" class="hand-container"><div class="hand-track"><div id="black-card" class="card-item visible clickable"></div></div></div>
          <div id="hand-white" class="hand-container"></div>
          <button id="autoToggleBtn" type="button">AUTO: ON</button>
        </body>
      </html>
    `);
    global.window = dom.window;
    global.document = dom.window.document;
    global.Event = dom.window.Event;
    global.addLog = jest.fn();
    global.fillDebugHand = jest.fn();
    global.renderCardUI = jest.fn();

    const uiState = {
      DEBUG_MODE_ALLOWED: false,
      DEBUG_UNLIMITED_USAGE: false,
      DEBUG_HUMAN_VS_HUMAN: false,
      disableAutoMode: jest.fn()
    };
    const registerCalls = [];

    jest.isolateModules(() => {
      jest.doMock(path.resolve(__dirname, '..', 'ui', 'bootstrap.js'), () => ({
        registerUIGlobals: (obj) => {
          registerCalls.push(obj);
          Object.assign(uiState, obj);
          return obj;
        },
        getRegisteredUIGlobals: () => uiState
      }), { virtual: false });

      require(path.resolve(__dirname, '..', 'ui', 'handlers', 'debug.js'));
    });

    const registered = registerCalls.find((entry) => entry && typeof entry.setupDebugControls === 'function');
    const debugBtn = document.createElement('button');
    registered.setupDebugControls(debugBtn, document.createElement('button'), document.createElement('button'));
    debugBtn.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));

    const handBlackEl = document.getElementById('hand-black');
    const handTrackEl = handBlackEl.querySelector('.hand-track');
    const cardEl = document.getElementById('black-card');
    Object.defineProperty(handBlackEl, 'clientWidth', { configurable: true, value: 120 });
    Object.defineProperty(handTrackEl, 'scrollWidth', { configurable: true, value: 320 });
    handTrackEl.getBoundingClientRect = () => ({ width: 320, left: 0, right: 320, top: 0, bottom: 80, height: 80 });
    const clickSpy = jest.fn();
    cardEl.addEventListener('click', clickSpy);

    // Simulate a normal click (150ms) with slight horizontal jitter (12px)
    dispatchPointer(cardEl, 'pointerdown', { clientX: 100, clientY: 32 });
    jest.advanceTimersByTime(80);
    dispatchPointer(handBlackEl, 'pointermove', { clientX: 112, clientY: 34 });
    jest.advanceTimersByTime(70);
    dispatchPointer(handBlackEl, 'pointerup', { clientX: 112, clientY: 34 });
    cardEl.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  test('debug on allows mouse wheel to move hand horizontally', () => {
    const dom = new JSDOM(`
      <!doctype html>
      <html>
        <body>
          <div id="hand-black" class="hand-container"><div class="hand-track"><div id="black-card" class="card-item visible clickable"></div></div></div>
          <div id="hand-white" class="hand-container"></div>
          <button id="autoToggleBtn" type="button">AUTO: ON</button>
        </body>
      </html>
    `);
    global.window = dom.window;
    global.document = dom.window.document;
    global.Event = dom.window.Event;
    global.addLog = jest.fn();
    global.fillDebugHand = jest.fn();
    global.renderCardUI = jest.fn();

    const uiState = {
      DEBUG_MODE_ALLOWED: false,
      DEBUG_UNLIMITED_USAGE: false,
      DEBUG_HUMAN_VS_HUMAN: false,
      disableAutoMode: jest.fn()
    };
    const registerCalls = [];

    jest.isolateModules(() => {
      jest.doMock(path.resolve(__dirname, '..', 'ui', 'bootstrap.js'), () => ({
        registerUIGlobals: (obj) => {
          registerCalls.push(obj);
          Object.assign(uiState, obj);
          return obj;
        },
        getRegisteredUIGlobals: () => uiState
      }), { virtual: false });

      require(path.resolve(__dirname, '..', 'ui', 'handlers', 'debug.js'));
    });

    const registered = registerCalls.find((entry) => entry && typeof entry.setupDebugControls === 'function');
    const debugBtn = document.createElement('button');
    registered.setupDebugControls(debugBtn, document.createElement('button'), document.createElement('button'));
    debugBtn.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));

    const handBlackEl = document.getElementById('hand-black');
    const handTrackEl = handBlackEl.querySelector('.hand-track');
    Object.defineProperty(handBlackEl, 'clientWidth', { configurable: true, value: 120 });
    Object.defineProperty(handTrackEl, 'scrollWidth', { configurable: true, value: 320 });
    handTrackEl.getBoundingClientRect = () => ({ width: 320, left: 0, right: 320, top: 0, bottom: 80, height: 80 });

    dispatchWheel(handBlackEl, { deltaY: 50 });
    expect(handTrackEl.style.transform).toBe('translate3d(-45px, 0, 0)');
  });

  test('debug hand wheel clamps at the edge instead of wrapping', () => {
    const dom = new JSDOM(`
      <!doctype html>
      <html>
        <body>
          <div id="hand-black" class="hand-container"><div class="hand-track"><div id="black-card" class="card-item visible clickable"></div></div></div>
          <div id="hand-white" class="hand-container"></div>
          <button id="autoToggleBtn" type="button">AUTO: ON</button>
        </body>
      </html>
    `);
    global.window = dom.window;
    global.document = dom.window.document;
    global.Event = dom.window.Event;
    global.addLog = jest.fn();
    global.fillDebugHand = jest.fn();
    global.renderCardUI = jest.fn();

    const uiState = {
      DEBUG_MODE_ALLOWED: false,
      DEBUG_UNLIMITED_USAGE: false,
      DEBUG_HUMAN_VS_HUMAN: false,
      disableAutoMode: jest.fn()
    };
    const registerCalls = [];

    jest.isolateModules(() => {
      jest.doMock(path.resolve(__dirname, '..', 'ui', 'bootstrap.js'), () => ({
        registerUIGlobals: (obj) => {
          registerCalls.push(obj);
          Object.assign(uiState, obj);
          return obj;
        },
        getRegisteredUIGlobals: () => uiState
      }), { virtual: false });

      require(path.resolve(__dirname, '..', 'ui', 'handlers', 'debug.js'));
    });

    const registered = registerCalls.find((entry) => entry && typeof entry.setupDebugControls === 'function');
    const debugBtn = document.createElement('button');
    registered.setupDebugControls(debugBtn, document.createElement('button'), document.createElement('button'));
    debugBtn.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));

    const handBlackEl = document.getElementById('hand-black');
    const handTrackEl = handBlackEl.querySelector('.hand-track');
    Object.defineProperty(handBlackEl, 'clientWidth', { configurable: true, value: 120 });
    Object.defineProperty(handTrackEl, 'scrollWidth', { configurable: true, value: 320 });
    handTrackEl.getBoundingClientRect = () => ({ width: 320, left: 0, right: 320, top: 0, bottom: 80, height: 80 });

    dispatchWheel(handBlackEl, { deltaY: 300 });
    expect(handTrackEl.style.transform).toBe('translate3d(-200px, 0, 0)');

    dispatchWheel(handBlackEl, { deltaY: -230 });
    expect(handTrackEl.style.transform).toBe('translate3d(0px, 0, 0)');
  });

  test('orphaned drag state is cleaned up when pointermove detects buttons=0', () => {
    const dom = new JSDOM(`
      <!doctype html>
      <html>
        <body>
          <div id="hand-black" class="hand-container"><div class="hand-track"><div id="black-card" class="card-item visible clickable"></div></div></div>
          <div id="hand-white" class="hand-container"></div>
          <button id="autoToggleBtn" type="button">AUTO: ON</button>
        </body>
      </html>
    `);
    global.window = dom.window;
    global.document = dom.window.document;
    global.Event = dom.window.Event;
    global.addLog = jest.fn();
    global.fillDebugHand = jest.fn();
    global.renderCardUI = jest.fn();

    const uiState = {
      DEBUG_MODE_ALLOWED: false,
      DEBUG_UNLIMITED_USAGE: false,
      DEBUG_HUMAN_VS_HUMAN: false,
      disableAutoMode: jest.fn()
    };
    const registerCalls = [];

    jest.isolateModules(() => {
      jest.doMock(path.resolve(__dirname, '..', 'ui', 'bootstrap.js'), () => ({
        registerUIGlobals: (obj) => {
          registerCalls.push(obj);
          Object.assign(uiState, obj);
          return obj;
        },
        getRegisteredUIGlobals: () => uiState
      }), { virtual: false });

      require(path.resolve(__dirname, '..', 'ui', 'handlers', 'debug.js'));
    });

    const registered = registerCalls.find((entry) => entry && typeof entry.setupDebugControls === 'function');
    const debugBtn = document.createElement('button');
    registered.setupDebugControls(debugBtn, document.createElement('button'), document.createElement('button'));
    debugBtn.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));

    const handBlackEl = document.getElementById('hand-black');
    const handTrackEl = handBlackEl.querySelector('.hand-track');
    const cardEl = document.getElementById('black-card');
    Object.defineProperty(handBlackEl, 'clientWidth', { configurable: true, value: 120 });
    Object.defineProperty(handTrackEl, 'scrollWidth', { configurable: true, value: 320 });
    handTrackEl.getBoundingClientRect = () => ({ width: 320, left: 0, right: 320, top: 0, bottom: 80, height: 80 });

    // pointerdown on card – starts tracking
    dispatchPointer(cardEl, 'pointerdown', { clientX: 160, clientY: 32, buttons: 1 });
    // Long-press timer fires
    jest.advanceTimersByTime(350);
    expect(handBlackEl.classList.contains('debug-hand-fling-ready')).toBe(true);

    // Simulate pointer returning with button already released (buttons=0)
    dispatchPointer(handBlackEl, 'pointermove', { clientX: 120, clientY: 32, buttons: 0 });

    // State should be cleaned up – fling-ready class removed
    expect(handBlackEl.classList.contains('debug-hand-fling-ready')).toBe(false);
    expect(handBlackEl.classList.contains('debug-hand-fling-dragging')).toBe(false);

    // Subsequent click should NOT be suppressed
    const clickSpy = jest.fn();
    cardEl.addEventListener('click', clickSpy);
    cardEl.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  test('fling hard-stops at boundary instead of continuing', () => {
    const dom = new JSDOM(`
      <!doctype html>
      <html>
        <body>
          <div id="hand-black" class="hand-container"><div class="hand-track"><div id="black-card" class="card-item visible clickable"></div></div></div>
          <div id="hand-white" class="hand-container"></div>
          <button id="autoToggleBtn" type="button">AUTO: ON</button>
        </body>
      </html>
    `);
    global.window = dom.window;
    global.document = dom.window.document;
    global.Event = dom.window.Event;
    global.addLog = jest.fn();
    global.fillDebugHand = jest.fn();
    global.renderCardUI = jest.fn();

    let rafCallbacks = [];
    dom.window.requestAnimationFrame = (cb) => { rafCallbacks.push(cb); return rafCallbacks.length; };
    dom.window.cancelAnimationFrame = () => {};

    const uiState = {
      DEBUG_MODE_ALLOWED: false,
      DEBUG_UNLIMITED_USAGE: false,
      DEBUG_HUMAN_VS_HUMAN: false,
      disableAutoMode: jest.fn()
    };
    const registerCalls = [];

    jest.isolateModules(() => {
      jest.doMock(path.resolve(__dirname, '..', 'ui', 'bootstrap.js'), () => ({
        registerUIGlobals: (obj) => {
          registerCalls.push(obj);
          Object.assign(uiState, obj);
          return obj;
        },
        getRegisteredUIGlobals: () => uiState
      }), { virtual: false });

      require(path.resolve(__dirname, '..', 'ui', 'handlers', 'debug.js'));
    });

    const registered = registerCalls.find((entry) => entry && typeof entry.setupDebugControls === 'function');
    const debugBtn = document.createElement('button');
    registered.setupDebugControls(debugBtn, document.createElement('button'), document.createElement('button'));
    debugBtn.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));

    const handBlackEl = document.getElementById('hand-black');
    const handTrackEl = handBlackEl.querySelector('.hand-track');
    const cardEl = document.getElementById('black-card');
    // Container 120px, track 800px → limit = 680px
    Object.defineProperty(handBlackEl, 'clientWidth', { configurable: true, value: 120 });
    Object.defineProperty(handTrackEl, 'scrollWidth', { configurable: true, value: 800 });
    handTrackEl.getBoundingClientRect = () => ({ width: 800, left: 0, right: 800, top: 0, bottom: 80, height: 80 });

    // Wheel to the right edge
    dispatchWheel(handBlackEl, { deltaY: 800 });
    expect(handTrackEl.style.transform).toBe('translate3d(-680px, 0, 0)');

    // Start a big fling toward the right (further past the edge)
    dispatchPointer(cardEl, 'pointerdown', { clientX: 200, clientY: 32, buttons: 1 });
    jest.advanceTimersByTime(350);
    dispatchPointer(handBlackEl, 'pointermove', { clientX: 100, clientY: 32, buttons: 1 });
    dispatchPointer(handBlackEl, 'pointerup', { clientX: 100, clientY: 32 });

    // Run one RAF frame — fling should hit boundary and hard-stop
    const pendingCallbacks = [...rafCallbacks];
    rafCallbacks = [];
    pendingCallbacks.forEach(cb => cb());

    // After hitting boundary, no more RAF callbacks should be queued
    expect(rafCallbacks.length).toBe(0);
    // Offset should be clamped at the right edge
    expect(handTrackEl.style.transform).toBe('translate3d(-680px, 0, 0)');
  });

  test('all catalog cards are added by fillDebugHand and reachable by wheel scroll', () => {
    const catalogCards = require(path.resolve(__dirname, '..', 'cards', 'catalog.json')).cards;
    const totalCards = catalogCards.length;
    expect(totalCards).toBeGreaterThanOrEqual(64);

    const dom = new JSDOM(`
      <!doctype html>
      <html>
        <body>
          <div id="hand-black" class="hand-container"><div class="hand-track"><div class="card-item visible clickable"></div></div></div>
          <div id="hand-white" class="hand-container"></div>
          <button id="autoToggleBtn" type="button">AUTO: ON</button>
        </body>
      </html>
    `);
    global.window = dom.window;
    global.document = dom.window.document;
    global.Event = dom.window.Event;
    global.addLog = jest.fn();
    global.fillDebugHand = jest.fn();
    global.renderCardUI = jest.fn();

    const uiState = {
      DEBUG_MODE_ALLOWED: false,
      DEBUG_UNLIMITED_USAGE: false,
      DEBUG_HUMAN_VS_HUMAN: false,
      disableAutoMode: jest.fn()
    };
    const registerCalls = [];

    let debugActions;
    jest.isolateModules(() => {
      jest.doMock(path.resolve(__dirname, '..', 'ui', 'bootstrap.js'), () => ({
        registerUIGlobals: (obj) => {
          registerCalls.push(obj);
          Object.assign(uiState, obj);
          return obj;
        },
        getRegisteredUIGlobals: () => uiState
      }), { virtual: false });

      require(path.resolve(__dirname, '..', 'ui', 'handlers', 'debug.js'));
      debugActions = require(path.resolve(__dirname, '..', 'game', 'debug', 'debug-actions.js'));
    });

    // Enable debug mode
    const registered = registerCalls.find((entry) => entry && typeof entry.setupDebugControls === 'function');
    const debugBtn = document.createElement('button');
    registered.setupDebugControls(debugBtn, document.createElement('button'), document.createElement('button'));
    debugBtn.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));

    // Build card state with empty hands
    const cardState = {
      hands: { black: [], white: [] },
      debugHandFilled: false,
      debugNoDraw: false
    };

    // Fill debug hand — should add all catalog cards
    const result = debugActions.fillDebugHand(cardState, { fillWhite: false });
    expect(result).toBe(true);
    expect(cardState.hands.black.length).toBe(totalCards);

    // Verify every catalog card ID is present
    const handSet = new Set(cardState.hands.black);
    for (const card of catalogCards) {
      expect(handSet.has(card.id)).toBe(true);
    }

    // Simulate the hand-track with card elements
    const handBlackEl = document.getElementById('hand-black');
    const handTrackEl = handBlackEl.querySelector('.hand-track');
    handTrackEl.innerHTML = '';
    for (const cardId of cardState.hands.black) {
      const el = document.createElement('div');
      el.className = 'card-item visible';
      el.dataset.cardId = cardId;
      handTrackEl.appendChild(el);
    }

    // Set dimensions: container 300px, each card ~80px wide → track ~totalCards*80
    const trackWidth = totalCards * 80;
    Object.defineProperty(handBlackEl, 'clientWidth', { configurable: true, value: 300 });
    Object.defineProperty(handTrackEl, 'scrollWidth', { configurable: true, value: trackWidth });
    handTrackEl.getBoundingClientRect = () => ({ width: trackWidth, left: 0, right: trackWidth, top: 0, bottom: 80, height: 80 });

    // Scroll to the very end by wheel
    dispatchWheel(handBlackEl, { deltaY: trackWidth * 2 });
    const limit = trackWidth - 300;
    expect(handTrackEl.style.transform).toBe(`translate3d(-${limit}px, 0, 0)`);

    // Scroll back to start
    dispatchWheel(handBlackEl, { deltaY: -(trackWidth * 2) });
    expect(handTrackEl.style.transform).toBe('translate3d(0px, 0, 0)');

    // Verify all card elements exist in the track
    const renderedCards = handTrackEl.querySelectorAll('.card-item[data-card-id]');
    expect(renderedCards.length).toBe(totalCards);
  });
});
