import * as path from 'path';
import { JSDOM } from 'jsdom';

function setupBattleStatusDom(gameStateOverride: any = {}, cardStateOverride: any = {}) {
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
  window.cardState = Object.assign({ markers: [] }, cardStateOverride);
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
  global.cardState = window.cardState;

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
  delete global.cardState;
  dom.window.close();
}

describe('battle status panel', () => {
  test('effect panel becomes a compact score and turn status surface', () => {
    const { dom, window, effectPanel } = setupBattleStatusDom();

    window.updateStatus();

    expect(effectPanel.querySelector('.battle-status-round')?.textContent).toBe('ROUND 4');
    expect(effectPanel.querySelector('.battle-status-network-timer')?.textContent).toBe('');
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

  test('score includes expansion stones and excludes METEOR_HOLE cells', () => {
    const { dom, window, effectPanel } = setupBattleStatusDom({
      boardConfig: { rows: 4, cols: 4, shape: 'rectangle' },
      boardExpansion: {
        cells: [
          { side: 'right', row: 0, col: 4, owner: 1 },
          { side: 'right', row: 1, col: 4, owner: -1 }
        ]
      }
    }, {
      markers: [{
        kind: 'specialStone',
        row: 0,
        col: 0,
        data: { type: 'METEOR_HOLE' }
      }]
    });

    window.updateStatus();

    expect(effectPanel.querySelector('.battle-status-count--black')?.textContent).toBe('4');
    expect(effectPanel.querySelector('.battle-status-count--white')?.textContent).toBe('5');

    teardownBattleStatusDom(dom);
  });

  test('shows Your Turn and Enemy Turn arrival toasts for turn changes', () => {
    jest.useFakeTimers();
    const { dom, window } = setupBattleStatusDom();

    try {
      window.updateStatus();

      const toast = window.document.getElementById('turn-arrival-toast') as HTMLElement;
      expect(toast).not.toBeNull();
      expect(toast.textContent?.trim()).toBe('Your Turn');
      expect(toast.classList.contains('is-self')).toBe(true);
      expect(toast.classList.contains('is-black-turn')).toBe(true);
      expect(toast.classList.contains('is-visible')).toBe(true);
      const turnArrivalReferenceWidth = 164;
      expect(toast.style.left).toBe(`${window.innerWidth - turnArrivalReferenceWidth - 8}px`);
      expect(toast.style.top).toBe('707px');

      window.gameState.currentPlayer = -1;
      window.gameState.turnNumber = 7;
      global.gameState = window.gameState;
      window.updateStatus();

      expect(toast.textContent?.trim()).toBe('Enemy Turn');
      expect(toast.classList.contains('is-enemy')).toBe(true);
      expect(toast.classList.contains('is-white-turn')).toBe(true);
      expect(toast.classList.contains('is-black-turn')).toBe(false);
      expect(toast.classList.contains('is-visible')).toBe(true);

      jest.advanceTimersByTime(15000);
      expect(toast.classList.contains('is-hiding')).toBe(true);

      jest.advanceTimersByTime(360);
      expect(toast.classList.contains('is-visible')).toBe(false);
      expect(toast.classList.contains('is-hiding')).toBe(false);
      expect(toast.classList.contains('is-white-turn')).toBe(false);
    } finally {
      teardownBattleStatusDom(dom);
      jest.useRealTimers();
    }
  });

  test('nudges wide turn arrival art slightly right without fully moving it outside the board lane', () => {
    jest.useFakeTimers();
    const { dom, window } = setupBattleStatusDom();

    try {
      Object.defineProperty(window, 'innerWidth', { value: 1500, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

      window.updateStatus();

      const toast = window.document.getElementById('turn-arrival-toast') as HTMLElement;
      Object.defineProperty(toast, 'offsetWidth', { value: 188, configurable: true });
      Object.defineProperty(toast, 'offsetHeight', { value: 42, configurable: true });

      window.updateStatus();

      expect(toast.style.left).toBe('1082px');
      expect(toast.style.top).toBe('705px');
    } finally {
      teardownBattleStatusDom(dom);
      jest.useRealTimers();
    }
  });

  test('uses actual turn color for arrival toast while preserving network local perspective', () => {
    jest.useFakeTimers();
    const { dom, window } = setupBattleStatusDom({
      currentPlayer: -1,
      turnNumber: 8
    });

    try {
      window.MatchMode = { isNetworkModeActive: jest.fn(() => true) };
      window.NetworkMatchClient = { getSeatKey: jest.fn(() => 'white') };
      window.updateStatus();

      const toast = window.document.getElementById('turn-arrival-toast') as HTMLElement;
      expect(toast).not.toBeNull();
      expect(toast.textContent?.trim()).toBe('Your Turn');
      expect(toast.classList.contains('is-self')).toBe(true);
      expect(toast.classList.contains('is-white-turn')).toBe(true);
      expect(toast.classList.contains('is-black-turn')).toBe(false);

      window.gameState.currentPlayer = 1;
      window.gameState.turnNumber = 9;
      global.gameState = window.gameState;
      window.updateStatus();

      expect(toast.textContent?.trim()).toBe('Enemy Turn');
      expect(toast.classList.contains('is-enemy')).toBe(true);
      expect(toast.classList.contains('is-black-turn')).toBe(true);
      expect(toast.classList.contains('is-white-turn')).toBe(false);
    } finally {
      teardownBattleStatusDom(dom);
      jest.useRealTimers();
    }
  });

  test('network timer appears to the right of round only during network battle', () => {
    const { dom, window, effectPanel } = setupBattleStatusDom();
    window.MatchMode = { isNetworkModeActive: jest.fn(() => true) };

    window.updateStatus();
    window.setBattleStatusNetworkTimerInfo({
      active: true,
      turnSeatKey: 'black',
      remainingMs: 119400,
      limitSeconds: 120,
      isOwnTurn: true
    });

    const topLine = effectPanel.querySelector('.battle-status-topline');
    const roundEl = effectPanel.querySelector('.battle-status-round');
    const timerEl = effectPanel.querySelector('.battle-status-network-timer');
    expect(topLine?.children[0]).toBe(roundEl);
    expect(topLine?.children[1]).toBe(timerEl);
    expect(timerEl?.textContent).toBe('残り 120秒');
    expect(timerEl?.getAttribute('aria-label')).toBe('ネット対戦 黒の手番 残り 120 秒');
    expect((timerEl as HTMLElement).hidden).toBe(false);

    window.MatchMode.isNetworkModeActive.mockReturnValue(false);
    window.updateStatus();
    expect(timerEl?.textContent).toBe('');
    expect((timerEl as HTMLElement).hidden).toBe(true);

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
