import { JSDOM } from 'jsdom';

describe('速攻の終局固定と対象条件', () => {
  let dom: JSDOM;
  let result: typeof import('../ui/result-overlay');

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    jest.setSystemTime(1000);
    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
    global.window = dom.window as any;
    global.document = dom.window.document;
    global.localStorage = dom.window.localStorage;
    global.gameState = {
      currentPlayer: 1, board: Array.from({ length: 8 }, () => Array(8).fill(1)),
      boardConfig: { rows: 8, cols: 8, shape: 'rectangle', standard8x8: true }, turnNumber: 42
    };
    global.cardState = {
      chargeGainedTotal: { black: 0, white: 0 }, cardUseCountByPlayer: { black: 0, white: 0 },
      totalFlipCountByPlayer: { black: 0, white: 0 }, cornerCaptureCountByPlayer: { black: 0, white: 0 },
      turnCountByPlayer: { black: 24, white: 18 }, turnIndex: 42
    };
    global.cpuSmartness = { black: 1, white: 1 };
    global.countDiscs = jest.fn(() => ({ black: 44, white: 20 }));
    global.addLog = jest.fn();
    global.resetGame = jest.fn();
    window.MATCH_MODE = 'cpu';
    result = require('../ui/result-overlay.ts');
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    dom.window.close();
    for (const key of ['window', 'document', 'localStorage', 'gameState', 'cardState', 'cpuSmartness', 'countDiscs', 'addLog', 'resetGame']) {
      delete (global as any)[key];
    }
  });

  function timeText() { return document.querySelector('.result-time-attack')?.textContent; }

  test('勝利確定後の表示待ちと再表示待ちは記録に含めない', () => {
    expect(result.markTimeAttackStarted()).toBe(1000);
    jest.setSystemTime(61000);
    result.showResult();
    expect(timeText()).toBeUndefined();
    jest.advanceTimersByTime(2000);
    expect(timeText()).toBe('速攻 01:00.00');
    result.dismissResultOverlayIfPresent();
    jest.setSystemTime(121000);
    result.showResultOverlay({ replay: true });
    expect(timeText()).toBe('速攻 01:00.00');
  });

  test('899秒での勝利は表示を待っても15分超過にならない', () => {
    result.markTimeAttackStarted();
    jest.setSystemTime(900000);
    result.showResult();
    jest.advanceTimersByTime(2000);
    expect(timeText()).toBe('速攻 14:59.00');
  });

  test.each([[900000, '速攻 15:00.00'], [900001, '速攻 --15:00超過']])(
    '勝利確定まで%dmsの記録は上限を厳密に判定する', (elapsed, expected) => {
      result.markTimeAttackStarted();
      jest.setSystemTime(1000 + Number(elapsed));
      result.showResult();
      jest.advanceTimersByTime(2000);
      expect(timeText()).toBe(expected);
    }
  );

  test.each(['network', 'reversi'])('%sでは計測を開始せず速攻欄も出さない', (mode) => {
    window.MATCH_MODE = mode;
    expect(result.markTimeAttackStarted()).toBeNull();
    jest.setSystemTime(61000);
    result.showResultOverlay();
    expect(timeText()).toBeUndefined();
    expect(result.resolveTimeAttackSummary('win', { startedAt: 1000 }).eligible).toBe(false);
  });

  test.each([
    { rows: 6, cols: 6, shape: 'rectangle', standard8x8: false },
    { rows: 8, cols: 8, shape: 'circle', standard8x8: true }
  ])('非標準盤面では計測も表示もしない: %j', (config) => {
    global.gameState.boardConfig = config;
    expect(result.markTimeAttackStarted()).toBeNull();
    jest.setSystemTime(61000);
    result.showResultOverlay();
    expect(timeText()).toBeUndefined();
  });

  test.each([{ black: 20, white: 44 }, { black: 32, white: 32 }])('敗北と引き分けでは記録にしない: %j', (counts) => {
    result.markTimeAttackStarted();
    global.countDiscs.mockReturnValue(counts);
    jest.setSystemTime(61000);
    result.showResult();
    jest.advanceTimersByTime(2000);
    expect(timeText()).toBeUndefined();
  });

  test.each(['DEBUG_UNLIMITED_USAGE', 'DEBUG_HUMAN_VS_HUMAN'])('%sでは有効記録にしない', (flag) => {
    result.markTimeAttackStarted();
    (window as any)[flag] = true;
    jest.setSystemTime(61000);
    result.showResultOverlay();
    expect(timeText()).toBeUndefined();
    expect(result.resolveTimeAttackSummary('win').eligible).toBe(false);
  });

  test('対局中断・リタイア後は優勢でも速攻記録を作らない', () => {
    result.markTimeAttackStarted();
    jest.setSystemTime(61000);
    result.showResult({ retired: true });
    jest.advanceTimersByTime(2000);
    expect(timeText()).toBeUndefined();
    result.showResultOverlay({ replay: true });
    expect(timeText()).toBeUndefined();
  });

  test('リセットで前の開始時刻・終局結果・予約表示をすべて破棄する', () => {
    result.markTimeAttackStarted();
    jest.setSystemTime(61000);
    result.showResult();
    result.resetResultPresentationState(null);
    global.gameState.__resultShown = false;
    jest.advanceTimersByTime(2000);
    expect(timeText()).toBeUndefined();
    expect(result.resolveTimeAttackSummary('win').eligible).toBe(false);
    result.markTimeAttackStarted();
    jest.advanceTimersByTime(3000);
    result.showResult();
    jest.advanceTimersByTime(2000);
    expect(timeText()).toBe('速攻 00:03.00');
  });

  test('計測開始後や結果確定後に対人へ切り替えても速攻を表示しない', () => {
    result.markTimeAttackStarted();
    jest.setSystemTime(61000);
    result.showResultOverlay();
    expect(timeText()).toBe('速攻 01:00.00');
    window.MATCH_MODE = 'network';
    result.showResultOverlay({ replay: true });
    expect(timeText()).toBeUndefined();
  });

  test('開始時刻のない再表示は記録を新しく作らない', () => {
    jest.setSystemTime(61000);
    result.showResultOverlay({ replay: true });
    expect(timeText()).toBeUndefined();
  });
});
