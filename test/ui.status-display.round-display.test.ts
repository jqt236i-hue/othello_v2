import * as path from 'path';
import { JSDOM } from 'jsdom';

function setupStatusDisplayDom(gameStateOverride) {
  const dom = new JSDOM(
    '<!doctype html><html><body>' +
    '<div id="board-frame"></div>' +
    '<div id="round-display-panel"></div>' +
    '<div id="effect-live-panel"></div>' +
    '<img id="cpu-character-img" />' +
    '<div id="cpu-level-label"></div>' +
    '<div id="hero-label"></div>' +
    '</body></html>',
    { runScripts: 'outside-only', url: 'http://localhost/' }
  );

  const { window } = dom;
  const boardFrame = window.document.getElementById('board-frame');
  const effectPanel = window.document.getElementById('effect-live-panel');
  const roundPanel = window.document.getElementById('round-display-panel');
  const nativeGetComputedStyle = window.getComputedStyle.bind(window);

  boardFrame.getBoundingClientRect = () => ({
    left: 720,
    top: 212,
    width: 520,
    height: 520,
    right: 1240,
    bottom: 732
  });
  effectPanel.getBoundingClientRect = () => ({
    left: 418,
    top: 464,
    width: 198,
    height: 172,
    right: 616,
    bottom: 636
  });
  Object.defineProperty(roundPanel, 'offsetHeight', {
    configurable: true,
    get() {
      return 28;
    }
  });

  window.getComputedStyle = (element) => {
    if (element === window.document.documentElement) {
      return {
        getPropertyValue(name) {
          return name === '--layout-stage-scale' ? '1' : '';
        }
      };
    }
    if (element === effectPanel) {
      return {
        display: 'block',
        visibility: 'visible',
        getPropertyValue() {
          return '';
        }
      };
    }
    return nativeGetComputedStyle(element);
  };

  window.cpuSmartness = { white: 1 };
  window.CPU_LEVEL_NAMES = { 1: 'CPU Lv1' };
  window.gameState = Object.assign({ turnNumber: 0, roundNumber: 1 }, gameStateOverride || {});
  window.getElement = (key) => {
    const map = {
      cpuCharacterImg: window.document.getElementById('cpu-character-img'),
      cpuLevelLabel: window.document.getElementById('cpu-level-label')
    };
    return map[key] || null;
  };
  window.Image = class FakeImage {
    set src(value) {
      this._src = value;
      if (typeof this.onload === 'function') this.onload();
    }
    get src() {
      return this._src || '';
    }
  };

  global.window = window;
  global.document = window.document;
  global.cpuSmartness = window.cpuSmartness;
  global.CPU_LEVEL_NAMES = window.CPU_LEVEL_NAMES;
  global.getElement = window.getElement;
  global.Image = window.Image;
  global.gameState = window.gameState;

  jest.resetModules();
  const statusDisplay = require(path.join(__dirname, '..', 'ui', 'status-display.js'));
  window.showRoundBonusDisplay = statusDisplay.showRoundBonusDisplay;
  window.clearRoundDisplayBonus = statusDisplay.clearRoundDisplayBonus;
  window.updateRoundDisplay = statusDisplay.updateRoundDisplay;

  return { dom, window, roundPanel };
}

function teardownStatusDisplayDom(dom) {
  delete global.window;
  delete global.document;
  delete global.cpuSmartness;
  delete global.CPU_LEVEL_NAMES;
  delete global.getElement;
  delete global.Image;
  delete global.gameState;
  dom.window.close();
}

describe('status-display round bonus surface', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('keeps the legacy round pill hidden during normal status updates', () => {
    const { dom, window, roundPanel } = setupStatusDisplayDom({ turnNumber: 999, roundNumber: 1 });

    expect(roundPanel.textContent).toBe('');
    expect(roundPanel.style.display).toBe('none');
    expect(roundPanel.style.visibility).toBe('hidden');

    window.gameState.turnNumber = 1;
    window.gameState.roundNumber = 1;
    window.updateStatus();
    expect(roundPanel.textContent).toBe('');
    expect(roundPanel.style.display).toBe('none');

    window.gameState.turnNumber = 2;
    window.gameState.roundNumber = 2;
    window.updateStatus();
    expect(roundPanel.textContent).toBe('');

    window.gameState.turnNumber = 100;
    window.gameState.roundNumber = 10;
    window.updateStatus();
    expect(roundPanel.textContent).toBe('');

    teardownStatusDisplayDom(dom);
  });

  test('shows round bonus as a board-centered toast and then hides it', () => {
    jest.useFakeTimers();
    const { dom, window, roundPanel } = setupStatusDisplayDom({ turnNumber: 18, roundNumber: 10 });

    window.showRoundBonusDisplay({ amount: 5, durationMs: 200, fadeOutMs: 50 });
    expect(roundPanel.textContent).toContain('ROUND BONUS');
    expect(roundPanel.textContent).toContain('+5');
    expect(roundPanel.textContent).toContain('布石');
    expect(roundPanel.style.left).toBe('980px');
    expect(roundPanel.style.top).toBe('188px');
    expect(roundPanel.classList.contains('is-round-bonus-active')).toBe(true);
    expect(roundPanel.classList.contains('is-round-bonus-fading')).toBe(false);

    jest.advanceTimersByTime(200);
    expect(roundPanel.textContent).toContain('+5');
    expect(roundPanel.classList.contains('is-round-bonus-active')).toBe(true);
    expect(roundPanel.classList.contains('is-round-bonus-fading')).toBe(true);

    jest.advanceTimersByTime(50);
    expect(roundPanel.textContent).toBe('');
    expect(roundPanel.style.display).toBe('none');
    expect(roundPanel.classList.contains('is-round-bonus-active')).toBe(false);
    expect(roundPanel.classList.contains('is-round-bonus-fading')).toBe(false);

    teardownStatusDisplayDom(dom);
  });

  test('restarting the bonus banner refreshes the text and timeout window', () => {
    jest.useFakeTimers();
    const { dom, window, roundPanel } = setupStatusDisplayDom({ turnNumber: 18, roundNumber: 10 });

    window.showRoundBonusDisplay({ amount: 5, durationMs: 200, fadeOutMs: 50 });
    jest.advanceTimersByTime(150);

    window.showRoundBonusDisplay({ amount: 6, durationMs: 200, fadeOutMs: 50 });
    expect(roundPanel.textContent).toContain('+6');
    expect(roundPanel.classList.contains('is-round-bonus-active')).toBe(true);
    expect(roundPanel.classList.contains('is-round-bonus-fading')).toBe(false);

    jest.advanceTimersByTime(80);
    expect(roundPanel.textContent).toContain('+6');
    expect(roundPanel.classList.contains('is-round-bonus-fading')).toBe(false);

    jest.advanceTimersByTime(120);
    expect(roundPanel.textContent).toContain('+6');
    expect(roundPanel.classList.contains('is-round-bonus-active')).toBe(true);
    expect(roundPanel.classList.contains('is-round-bonus-fading')).toBe(true);

    jest.advanceTimersByTime(50);
    expect(roundPanel.textContent).toBe('');
    expect(roundPanel.style.display).toBe('none');
    expect(roundPanel.classList.contains('is-round-bonus-active')).toBe(false);
    expect(roundPanel.classList.contains('is-round-bonus-fading')).toBe(false);

    teardownStatusDisplayDom(dom);
  });
});
