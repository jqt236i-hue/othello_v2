const path = require('path');
const { JSDOM } = require('jsdom');

function dispatchPointer(target, type, props) {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  const p = props || {};
  Object.defineProperty(ev, 'pointerId', { value: p.pointerId ?? 1 });
  Object.defineProperty(ev, 'pointerType', { value: p.pointerType ?? 'touch' });
  Object.defineProperty(ev, 'button', { value: p.button ?? 0 });
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

  test('debug on enables long-press hand fling and suppresses post-drag card click', () => {
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
    jest.advanceTimersByTime(140);
    dispatchPointer(handBlackEl, 'pointermove', { clientX: 92, clientY: 35 });
    expect(handTrackEl.style.transform).toBe('translate3d(-68px, 0, 0)');

    dispatchPointer(handBlackEl, 'pointerup', { clientX: 92, clientY: 35 });
    jest.advanceTimersByTime(32);
    cardEl.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
    expect(clickSpy).not.toHaveBeenCalled();
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
});
