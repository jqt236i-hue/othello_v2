import * as path from 'path';
import { JSDOM } from 'jsdom';

function setupBattleStatusDom(gameStateOverride: any = {}) {
  const dom = new JSDOM(
    '<!doctype html><html><body>' +
    '<div id="board-frame"></div>' +
    '<div id="round-display-panel"></div>' +
    '<div id="effect-live-panel" aria-live="polite" aria-atomic="false"></div>' +
    '<img id="cpu-character-img" />' +
    '<div id="cpu-level-label"></div>' +
    '<div id="hero-label"></div>' +
    '</body></html>',
    { runScripts: 'outside-only', url: 'http://localhost/' }
  );

  const { window } = dom;
  const boardFrame = window.document.getElementById('board-frame') as any;
  const effectPanel = window.document.getElementById('effect-live-panel') as any;
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
  window.getComputedStyle = (element) => {
    if (element === window.document.documentElement) {
      return { getPropertyValue: (name: string) => name === '--layout-stage-scale' ? '1' : '' } as any;
    }
    if (element === effectPanel) {
      return { display: 'block', visibility: 'visible', getPropertyValue: () => '' } as any;
    }
    return nativeGetComputedStyle(element);
  };

  window.cpuSmartness = { white: 1 };
  window.CPU_LEVEL_NAMES = { 1: 'CPU Lv1' };
  window.BLACK = 1;
  window.WHITE = -1;
  window.gameState = Object.assign({
    turnNumber: 6,
    roundNumber: 4,
    currentPlayer: 1,
    board: [
      [1, 1, 0, -1],
      [1, -1, 0, 0],
      [0, -1, 1, 0],
      [0, 0, 0, -1]
    ]
  }, gameStateOverride);
  window.getElement = (key: string) => {
    const map: Record<string, Element | null> = {
      cpuCharacterImg: window.document.getElementById('cpu-character-img'),
      cpuLevelLabel: window.document.getElementById('cpu-level-label')
    };
    return map[key] || null;
  };
  window.Image = class FakeImage {
    _src = '';
    onload: null | (() => void) = null;
    set src(value: string) {
      this._src = value;
      if (typeof this.onload === 'function') this.onload();
    }
    get src() {
      return this._src;
    }
  } as any;

  global.window = window as any;
  global.document = window.document as any;
  global.cpuSmartness = window.cpuSmartness;
  global.CPU_LEVEL_NAMES = window.CPU_LEVEL_NAMES;
  global.BLACK = 1;
  global.WHITE = -1;
  global.getElement = window.getElement;
  global.Image = window.Image;
  global.gameState = window.gameState;

  jest.resetModules();
  const statusDisplay = require(path.join(__dirname, '..', 'ui', 'status-display.js'));
  window.updateStatus = statusDisplay.updateStatus;
  window.recordBattleStatusEvent = statusDisplay.recordBattleStatusEvent;
  window.clearBattleStatusPanel = statusDisplay.clearBattleStatusPanel;

  return { dom, window, effectPanel, statusDisplay };
}

function teardownBattleStatusDom(dom: JSDOM) {
  delete global.window;
  delete global.document;
  delete global.cpuSmartness;
  delete global.CPU_LEVEL_NAMES;
  delete global.BLACK;
  delete global.WHITE;
  delete global.getElement;
  delete global.Image;
  delete global.gameState;
  dom.window.close();
}

describe('battle status panel', () => {
  test('effect panel becomes a compact score and turn status surface', () => {
    const { dom, window, effectPanel } = setupBattleStatusDom();

    window.updateStatus();

    expect(effectPanel.querySelector('.battle-status-round')?.textContent).toBe('ROUND 4');
    expect(effectPanel.querySelector('.battle-status-kicker')).toBeNull();
    expect(effectPanel.querySelector('.battle-status-count--black')?.textContent).toBe('4');
    expect(effectPanel.querySelector('.battle-status-count--white')?.textContent).toBe('4');
    expect(effectPanel.querySelector('.battle-status-count--black')?.getAttribute('aria-label')).toBe('黒石 4');
    expect(effectPanel.querySelector('.battle-status-count--white')?.getAttribute('aria-label')).toBe('白石 4');
    expect(effectPanel.querySelector('.battle-status-count--black .battle-status-stone--black')).not.toBeNull();
    expect(effectPanel.querySelector('.battle-status-count--white .battle-status-stone--white')).not.toBeNull();
    expect(effectPanel.querySelector('.battle-status-turn')?.textContent).toBe('あなたのターン');
    expect(effectPanel.querySelector('.battle-status-latest')?.textContent).toBe('直近 -');
    expect(effectPanel.querySelector('.battle-status-latest-label')?.textContent).toBe('直近');
    expect(effectPanel.querySelector('.battle-status-latest-value')?.textContent).toBe('-');

    teardownBattleStatusDom(dom);
  });

  test('records only card-related summary events and strips fast turn noise', () => {
    const { dom, window, effectPanel } = setupBattleStatusDom();

    window.recordBattleStatusEvent('黒: 数字マスD3: 布石+3');
    expect(effectPanel.querySelector('.battle-status-latest')?.textContent).toBe('直近 -');

    window.recordBattleStatusEvent('黒がドローしました');
    expect(effectPanel.querySelector('.battle-status-latest')?.textContent).toBe('直近 -');

    window.recordBattleStatusEvent('黒: D3 に置き、2枚反転');
    expect(effectPanel.querySelector('.battle-status-latest')?.textContent).toBe('直近 -');

    window.recordBattleStatusEvent('黒: パス (置ける場所がありません)');
    expect(effectPanel.querySelector('.battle-status-latest')?.textContent).toBe('直近 -');

    window.recordBattleStatusEvent('黒がカードを使用: 宝石 (布石 -2)');
    expect(effectPanel.querySelector('.battle-status-latest')?.textContent).toBe('直近 宝石を使用');
    expect(effectPanel.querySelector('.battle-status-latest-value')?.textContent).toBe('宝石を使用');

    window.recordBattleStatusEvent('白: 交換でD3を変換');
    expect(effectPanel.querySelector('.battle-status-latest')?.textContent).toBe('直近 交換: D3を変換');

    window.recordBattleStatusEvent('白: 罠石が発動');
    expect(effectPanel.querySelector('.battle-status-latest')?.textContent).toBe('直近 罠石が発動');

    window.clearBattleStatusPanel();
    expect(effectPanel.querySelector('.battle-status-latest')?.textContent).toBe('直近 -');

    teardownBattleStatusDom(dom);
  });
});
