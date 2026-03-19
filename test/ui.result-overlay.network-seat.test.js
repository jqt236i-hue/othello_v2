const { JSDOM } = require('jsdom');

describe('result overlay seat perspective', () => {
  let dom;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });

    global.window = dom.window;
    global.document = dom.window.document;
    global.localStorage = dom.window.localStorage;

    global.gameState = { currentPlayer: 1, board: [], turnNumber: 0 };
    global.cardState = {
      chargeGainedTotal: { black: 0, white: 0 },
      cardUseCountByPlayer: { black: 0, white: 0 },
      totalFlipCountByPlayer: { black: 0, white: 0 },
      cornerCaptureCountByPlayer: { black: 0, white: 0 },
      turnCountByPlayer: { black: 0, white: 0 },
      turnIndex: 0
    };
    global.cpuSmartness = { black: 1, white: 1 };
    global.countDiscs = jest.fn(() => ({ black: 0, white: 0 }));
    global.resetGame = jest.fn();
    window.MATCH_MODE = 'cpu';
  });

  afterEach(() => {
    try {
      if (dom && dom.window && typeof dom.window.close === 'function') {
        dom.window.close();
      }
    } catch (e) {}

    delete global.window;
    delete global.document;
    delete global.localStorage;
    delete global.gameState;
    delete global.cardState;
    delete global.cpuSmartness;
    delete global.countDiscs;
    delete global.resetGame;
  });

  test('network白席で白優勢なら勝利表示になる', () => {
    window.NetworkMatchClient = { getSeatKey: () => 'white' };
    global.countDiscs.mockReturnValue({ black: 24, white: 40 });

    const mod = require('../ui/result-overlay.js');
    mod.showResultOverlay();

    const overlay = document.getElementById('result-overlay');
    const title = document.querySelector('.result-title');

    expect(overlay).toBeTruthy();
    expect(overlay.className).toContain('win');
    expect(title && title.textContent).toBe('勝利！');
  });

  test('network白席で黒優勢なら敗北表示になる', () => {
    window.NetworkMatchClient = { getSeatKey: () => 'white' };
    global.countDiscs.mockReturnValue({ black: 41, white: 23 });

    const mod = require('../ui/result-overlay.js');
    mod.showResultOverlay();

    const overlay = document.getElementById('result-overlay');
    const title = document.querySelector('.result-title');

    expect(overlay).toBeTruthy();
    expect(overlay.className).toContain('lose');
    expect(title && title.textContent).toBe('敗北...');
  });

  test('network座席の大文字と空白を正規化して白視点の勝敗を表示する', () => {
    window.NetworkMatchClient = { getSeatKey: () => ' WHITE ' };
    global.countDiscs.mockReturnValue({ black: 24, white: 40 });

    const mod = require('../ui/result-overlay.js');
    mod.showResultOverlay();

    const overlay = document.getElementById('result-overlay');
    const title = document.querySelector('.result-title');

    expect(overlay).toBeTruthy();
    expect(overlay.className).toContain('win');
    expect(title && title.textContent).toBe('勝利！');
  });

  test('座席情報が無い場合は従来通り黒視点で判定する', () => {
    global.countDiscs.mockReturnValue({ black: 39, white: 25 });

    const mod = require('../ui/result-overlay.js');
    mod.showResultOverlay();

    const overlay = document.getElementById('result-overlay');
    const title = document.querySelector('.result-title');

    expect(overlay).toBeTruthy();
    expect(overlay.className).toContain('win');
    expect(title && title.textContent).toBe('勝利！');
  });

  test('勝敗タイトルと最終スコアの間に黒白の石枚数を表示する', () => {
    global.countDiscs.mockReturnValue({ black: 48, white: 16 });

    const mod = require('../ui/result-overlay.js');
    mod.showResultOverlay();

    const title = document.querySelector('.result-title');
    const countsLine = document.querySelector('.result-counts');
    const totalScore = document.querySelector('.result-total-score');

    expect(countsLine && countsLine.textContent).toContain('黒 48枚');
    expect(countsLine && countsLine.textContent).toContain('白 16枚');
    expect(title && title.nextElementSibling).toBe(countsLine);
    expect(countsLine && countsLine.nextElementSibling).toBe(totalScore);
  });

  test('総反転枚数と角取得数を詳細統計で保持する', () => {
    global.countDiscs.mockReturnValue({ black: 32, white: 32 });
    global.cardState.totalFlipCountByPlayer = { black: 12, white: 9 };
    global.cardState.cornerCaptureCountByPlayer = { black: 3, white: 1 };

    const mod = require('../ui/result-overlay.js');
    mod.showResultOverlay();

    const labels = Array.from(document.querySelectorAll('.result-stat-label')).map((el) => el.textContent);
    const statsNode = document.querySelector('.result-stats');
    const statsText = statsNode ? statsNode.textContent : '';

    expect(labels).toEqual(expect.arrayContaining(['総反転枚数', '角取得数']));
    expect(statsText).toContain('黒 12');
    expect(statsText).toContain('白 9');
    expect(statsText).toContain('黒 3');
    expect(statsText).toContain('白 1');
  });

  test('盤面が全マス自色なら完全勝利表示になる', () => {
    global.countDiscs.mockReturnValue({ black: 64, white: 0 });

    const mod = require('../ui/result-overlay.js');
    mod.showResultOverlay();

    const overlay = document.getElementById('result-overlay');
    const title = document.querySelector('.result-title');

    expect(overlay).toBeTruthy();
    expect(overlay.className).toContain('win');
    expect(overlay.className).toContain('perfect-win');
    expect(title && title.textContent).toBe('完全勝利！');
  });

  test('盤面が全マス相手色なら完全敗北表示になる', () => {
    window.NetworkMatchClient = { getSeatKey: () => 'white' };
    global.countDiscs.mockReturnValue({ black: 64, white: 0 });

    const mod = require('../ui/result-overlay.js');
    mod.showResultOverlay();

    const overlay = document.getElementById('result-overlay');
    const title = document.querySelector('.result-title');

    expect(overlay).toBeTruthy();
    expect(overlay.className).toContain('lose');
    expect(overlay.className).toContain('perfect-lose');
    expect(title && title.textContent).toBe('完全敗北...');
  });

  test('空きマスがあっても盤面石が自色のみなら完全勝利表示になる', () => {
    global.countDiscs.mockReturnValue({ black: 35, white: 0 });

    const mod = require('../ui/result-overlay.js');
    mod.showResultOverlay();

    const overlay = document.getElementById('result-overlay');
    const title = document.querySelector('.result-title');

    expect(overlay).toBeTruthy();
    expect(overlay.className).toContain('win');
    expect(overlay.className).toContain('perfect-win');
    expect(title && title.textContent).toBe('完全勝利！');
  });

  test('空きマスがあっても盤面石が相手色のみなら完全敗北表示になる', () => {
    window.NetworkMatchClient = { getSeatKey: () => 'white' };
    global.countDiscs.mockReturnValue({ black: 35, white: 0 });

    const mod = require('../ui/result-overlay.js');
    mod.showResultOverlay();

    const overlay = document.getElementById('result-overlay');
    const title = document.querySelector('.result-title');

    expect(overlay).toBeTruthy();
    expect(overlay.className).toContain('lose');
    expect(overlay.className).toContain('perfect-lose');
    expect(title && title.textContent).toBe('完全敗北...');
  });

  test('理論値条件で最終スコア11000を表示する', () => {
    global.countDiscs.mockReturnValue({ black: 76, white: 0 });
    global.cardState.chargeGainedTotal = { black: 800, white: 0 };
    global.cardState.totalFlipCountByPlayer = { black: 150, white: 0 };
    global.cardState.cornerCaptureCountByPlayer = { black: 4, white: 0 };
    global.cardState.turnCountByPlayer = { black: 0, white: 0 };
    global.cardState.turnIndex = 0;
    global.gameState.turnNumber = -1;

    const mod = require('../ui/result-overlay.js');
    mod.showResultOverlay();

    const totalScore = document.querySelector('.result-total-score-value');
    const breakdownText = (document.querySelector('.result-score-breakdown') || {}).textContent || '';
    const supportDetailText = (document.querySelector('.result-support-breakdown') || {}).textContent || '';

    expect(totalScore && totalScore.textContent).toBe('11000');
    expect(breakdownText).toContain('勝敗ボーナス5000');
    expect(breakdownText).toContain('速攻ボーナス1500');
    expect(breakdownText).toContain('黒一色ボーナス1500');
    expect(breakdownText).toContain('補助ボーナス3000');
    expect(supportDetailText).toContain('反転1500');
    expect(supportDetailText).toContain('自石1500');
    expect(supportDetailText).not.toContain('布石');
    expect(supportDetailText).not.toContain('/ 角');
  });

  test('39手終局では速攻ボーナスが減点される', () => {
    global.countDiscs.mockReturnValue({ black: 35, white: 0 });
    global.cardState.totalFlipCountByPlayer = { black: 44, white: 0 };
    global.cardState.cornerCaptureCountByPlayer = { black: 2, white: 0 };
    global.cardState.turnCountByPlayer = { black: 20, white: 19 };

    const mod = require('../ui/result-overlay.js');
    mod.showResultOverlay();

    const breakdownText = (document.querySelector('.result-score-breakdown') || {}).textContent || '';
    expect(breakdownText).toContain('速攻ボーナス915');
  });

  test('補助ボーナスが上限へ張り付きにくい配点で計算される', () => {
    global.countDiscs.mockReturnValue({ black: 49, white: 16 });
    global.cardState.chargeGainedTotal = { black: 175, white: 238 };
    global.cardState.totalFlipCountByPlayer = { black: 99, white: 86 };
    global.cardState.cornerCaptureCountByPlayer = { black: 1, white: 0 };
    global.cardState.turnCountByPlayer = { black: 40, white: 39 };

    const mod = require('../ui/result-overlay.js');
    mod.showResultOverlay();

    const breakdownText = (document.querySelector('.result-score-breakdown') || {}).textContent || '';
    const supportDetailText = (document.querySelector('.result-support-breakdown') || {}).textContent || '';

    expect(breakdownText).toContain('補助ボーナス1957');
    expect(supportDetailText).toContain('反転990');
    expect(supportDetailText).toContain('自石967');
  });

  test('詳細統計は初期非表示でボタン押下で展開される', () => {
    global.countDiscs.mockReturnValue({ black: 40, white: 24 });

    const mod = require('../ui/result-overlay.js');
    mod.showResultOverlay();

    const toggleBtn = document.querySelector('.result-detail-toggle');
    const stats = document.querySelector('.result-stats');
    expect(toggleBtn).toBeTruthy();
    expect(stats).toBeTruthy();
    expect(stats.hidden).toBe(true);

    toggleBtn.click();
    expect(stats.hidden).toBe(false);
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
  });

  test('CPU対戦時のみレベル別に最高点を更新する', () => {
    window.MATCH_MODE = 'cpu';
    global.cpuSmartness.white = 4;
    global.countDiscs.mockReturnValue({ black: 76, white: 0 });
    global.cardState.chargeGainedTotal = { black: 800, white: 0 };
    global.cardState.totalFlipCountByPlayer = { black: 150, white: 0 };
    global.cardState.cornerCaptureCountByPlayer = { black: 4, white: 0 };
    global.cardState.turnCountByPlayer = { black: 0, white: 0 };
    global.cardState.turnIndex = 0;
    global.gameState.turnNumber = -1;

    const mod = require('../ui/result-overlay.js');
    mod.showResultOverlay();

    const key = 'othello_cpu_leaderboard_v5';
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    expect(saved.cpu).toBeTruthy();
    expect(saved.cpu['4']).toBeTruthy();
    expect(saved.cpu['4'].bestScore).toBe(11000);
  });

  test('ネット対戦時はスコア表示してもランキングへ保存しない', () => {
    window.MATCH_MODE = 'network';
    window.NetworkMatchClient = { getSeatKey: () => 'black' };
    global.countDiscs.mockReturnValue({ black: 52, white: 12 });
    global.cardState.turnCountByPlayer = { black: 40, white: 40 };

    const mod = require('../ui/result-overlay.js');
    mod.showResultOverlay();

    const metaText = (document.querySelector('.result-score-meta') || {}).textContent || '';
    const key = 'othello_cpu_leaderboard_v5';

    expect(metaText).toContain('共有ランキング');
    expect(localStorage.getItem(key)).toBeNull();
  });

  test('終局時に共有ランキング送信を呼ぶ', () => {
    const submitScore = jest.fn(() => Promise.resolve({ ok: true, updated: true, rank: 1 }));
    window.LeaderboardClient = {
      submitScore,
      resolveServerBaseUrl: () => 'http://127.0.0.1:8788'
    };
    global.countDiscs.mockReturnValue({ black: 44, white: 20 });

    const mod = require('../ui/result-overlay.js');
    mod.showResultOverlay();

    expect(submitScore).toHaveBeenCalled();
  });

  test('通常ローカル対戦では共有ランキングを自動送信しない', () => {
    const submitScore = jest.fn(() => Promise.resolve({ ok: true, updated: true, rank: 1 }));
    window.LeaderboardClient = {
      submitScore,
      resolveServerBaseUrl: () => 'http://localhost'
    };
    global.countDiscs.mockReturnValue({ black: 44, white: 20 });

    const mod = require('../ui/result-overlay.js');
    mod.showResultOverlay();

    expect(submitScore).not.toHaveBeenCalled();
  });

  test('ネット対戦の再戦ボタンは requestRematch を優先する', async () => {
    window.MATCH_MODE = 'network';
    const requestRematch = jest.fn(() => Promise.resolve({ ok: true }));
    window.NetworkMatchClient = {
      getSeatKey: () => 'black',
      isActive: () => true,
      requestRematch
    };
    global.countDiscs.mockReturnValue({ black: 36, white: 28 });

    const mod = require('../ui/result-overlay.js');
    mod.showResultOverlay();

    const restartBtn = document.querySelector('.result-btn-row .premium-btn.primary');
    expect(restartBtn).toBeTruthy();

    restartBtn.click();
    await Promise.resolve();

    expect(requestRematch).toHaveBeenCalledTimes(1);
    expect(global.resetGame).not.toHaveBeenCalled();
  });

  test('ネット対戦でも未接続時は従来どおり resetGame を呼ぶ', () => {
    window.MATCH_MODE = 'network';
    const requestRematch = jest.fn(() => Promise.resolve({ ok: true }));
    window.NetworkMatchClient = {
      getSeatKey: () => 'black',
      isActive: () => false,
      requestRematch
    };
    global.countDiscs.mockReturnValue({ black: 30, white: 34 });

    const mod = require('../ui/result-overlay.js');
    mod.showResultOverlay();

    const restartBtn = document.querySelector('.result-btn-row .premium-btn.primary');
    expect(restartBtn).toBeTruthy();

    restartBtn.click();

    expect(requestRematch).not.toHaveBeenCalled();
    expect(global.resetGame).toHaveBeenCalledTimes(1);
  });

});
