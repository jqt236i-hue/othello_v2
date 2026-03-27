const path = require('path');
const { JSDOM } = require('jsdom');

describe('StoneVisuals.showChargeDelta immediate update', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();

    const dom = new JSDOM(`
      <!doctype html>
      <html>
        <body>
          <div id="charge-black" class="charge-display">布石: 30 / 99</div>
          <div id="charge-white" class="charge-display">布石: 12 / 99</div>
          <div id="charge-delta-black" class="charge-delta"></div>
          <div id="charge-delta-white" class="charge-delta"></div>
        </body>
      </html>
    `);
    global.window = dom.window;
    global.document = dom.window.document;
    global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    global.BLACK = 1;
    global.WHITE = -1;
    document.getElementById('charge-black').getBoundingClientRect = () => ({
      left: 480,
      top: 620,
      width: 122,
      height: 30,
      right: 602,
      bottom: 650,
      x: 480,
      y: 620,
      toJSON() { return {}; }
    });
    document.getElementById('charge-white').getBoundingClientRect = () => ({
      left: 480,
      top: 72,
      width: 122,
      height: 30,
      right: 602,
      bottom: 102,
      x: 480,
      y: 72,
      toJSON() { return {}; }
    });
    document.getElementById('charge-delta-black').getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 96,
      height: 28,
      right: 96,
      bottom: 28,
      x: 0,
      y: 0,
      toJSON() { return {}; }
    });
    document.getElementById('charge-delta-white').getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 96,
      height: 28,
      right: 96,
      bottom: 28,
      x: 0,
      y: 0,
      toJSON() { return {}; }
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.window;
    delete global.document;
    delete global.requestAnimationFrame;
    delete global.BLACK;
    delete global.WHITE;
  });

  test('restarts immediately when new delta arrives during display', () => {
    const stoneVisuals = require(path.resolve(__dirname, '..', 'ui', 'stone-visuals.js'));
    const el = document.getElementById('charge-delta-black');

    stoneVisuals.showChargeDelta('black', 1);
    jest.advanceTimersByTime(20);
    expect(el.textContent).toBe('+1');

    stoneVisuals.showChargeDelta('black', 2);
    jest.advanceTimersByTime(20);
    expect(el.textContent).toBe('+2');

    jest.advanceTimersByTime(4500);
    expect(el.textContent).toBe('');
  });

  test('anchors local slot popup above its charge counter and top slot popup below its charge counter', () => {
    const stoneVisuals = require(path.resolve(__dirname, '..', 'ui', 'stone-visuals.js'));
    const blackEl = document.getElementById('charge-delta-black');
    const whiteEl = document.getElementById('charge-delta-white');

    stoneVisuals.showChargeDelta('black', 17);
    jest.advanceTimersByTime(20);
    expect(blackEl.style.left).toBe('541px');
    expect(blackEl.style.top).toBe('584px');

    stoneVisuals.showChargeDelta('white', -4);
    jest.advanceTimersByTime(20);
    expect(whiteEl.style.left).toBe('541px');
    expect(whiteEl.style.top).toBe('110px');
  });
});
