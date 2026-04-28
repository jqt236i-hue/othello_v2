import * as path from 'path';
import { JSDOM } from 'jsdom';

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
          <div id="charge-delta-black-increase" class="charge-delta"></div>
          <div id="charge-delta-black-decrease" class="charge-delta"></div>
          <div id="charge-delta-white-increase" class="charge-delta"></div>
          <div id="charge-delta-white-decrease" class="charge-delta"></div>
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
    [
      'charge-delta-black-increase',
      'charge-delta-black-decrease',
      'charge-delta-white-increase',
      'charge-delta-white-decrease'
    ].forEach((id) => {
      document.getElementById(id).getBoundingClientRect = () => ({
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
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.window;
    delete global.document;
    delete global.requestAnimationFrame;
    delete global.BLACK;
    delete global.WHITE;
  });

  test('shows immediately and restarts when new same-side delta arrives during display', () => {
    const stoneVisuals = require(path.resolve(__dirname, '..', 'ui', 'stone-visuals.js'));
    const el = document.getElementById('charge-delta-black-increase');

    stoneVisuals.showChargeDelta('black', 1);
    expect(el.textContent).toBe('+1');
    expect(el.classList.contains('is-visible')).toBe(true);

    stoneVisuals.showChargeDelta('black', 2);
    expect(el.textContent).toBe('+2');
    expect(el.classList.contains('is-visible')).toBe(true);

    jest.advanceTimersByTime(4500);
    expect(el.textContent).toBe('');
  });

  test('uses mirrored left-right anchors for the opponent slot', () => {
    const stoneVisuals = require(path.resolve(__dirname, '..', 'ui', 'stone-visuals.js'));
    const blackIncreaseEl = document.getElementById('charge-delta-black-increase');
    const blackDecreaseEl = document.getElementById('charge-delta-black-decrease');
    const whiteIncreaseEl = document.getElementById('charge-delta-white-increase');
    const whiteDecreaseEl = document.getElementById('charge-delta-white-decrease');

    stoneVisuals.showChargeDelta('black', 17);
    stoneVisuals.showChargeDelta('black', -3);
    stoneVisuals.showChargeDelta('white', 9);
    stoneVisuals.showChargeDelta('white', -4);

    expect(blackIncreaseEl.style.left).toBe('376px');
    expect(blackIncreaseEl.style.top).toBe('621px');
    expect(blackDecreaseEl.style.left).toBe('610px');
    expect(blackDecreaseEl.style.top).toBe('621px');

    expect(whiteIncreaseEl.style.left).toBe('610px');
    expect(whiteIncreaseEl.style.top).toBe('73px');
    expect(whiteDecreaseEl.style.left).toBe('376px');
    expect(whiteDecreaseEl.style.top).toBe('73px');
  });

  test('shows positive and negative popups simultaneously on the same slot', () => {
    const stoneVisuals = require(path.resolve(__dirname, '..', 'ui', 'stone-visuals.js'));
    const increaseEl = document.getElementById('charge-delta-black-increase');
    const decreaseEl = document.getElementById('charge-delta-black-decrease');

    stoneVisuals.showChargeDelta('black', 5);
    stoneVisuals.showChargeDelta('black', -2);

    expect(increaseEl.textContent).toBe('+5');
    expect(decreaseEl.textContent).toBe('-2');
    expect(increaseEl.classList.contains('is-visible')).toBe(true);
    expect(decreaseEl.classList.contains('is-visible')).toBe(true);
    expect(increaseEl.style.left).toBe('376px');
    expect(decreaseEl.style.left).toBe('610px');
  });
});
