import { JSDOM } from 'jsdom';

describe('match-mode shared leaderboard panel', () => {
  let dom;
  let fetchLeaderboard;
  const leaderboardEntriesByMode = {
    all: [
      {
        rank: 1,
        playerId: 'player_beta_0002',
        playerName: 'ざわた',
        bestScore: 9131,
        mode: 'cpu',
        cpuLevel: 1
      },
      {
        rank: 2,
        playerId: 'player_gamma_0003',
        playerName: 'すわわわん',
        bestScore: 9013,
        mode: 'cpu',
        cpuLevel: 1
      },
      {
        rank: 3,
        playerId: 'player_delta_0004',
        playerName: 'swqp',
        bestScore: 9013,
        mode: 'cpu',
        cpuLevel: 1
      },
      {
        rank: 4,
        playerId: 'player_alpha_0001',
        playerName: 'アルファ',
        bestScore: 8543,
        mode: 'network',
        cpuLevel: null
      },
      {
        rank: 5,
        playerId: 'player_epsilon_0005',
        playerName: 'なれ。',
        bestScore: 8212,
        mode: 'cpu',
        cpuLevel: 1
      }
    ],
    network: [
      {
        rank: 1,
        playerId: 'player_zeta_0006',
        playerName: 'Rin',
        bestScore: 9200,
        mode: 'network',
        cpuLevel: null
      },
      {
        rank: 2,
        playerId: 'player_alpha_0001',
        playerName: 'アルファ',
        bestScore: 8543,
        mode: 'network',
        cpuLevel: null
      },
      {
        rank: 3,
        playerId: 'player_eta_0007',
        playerName: 'Ghg',
        bestScore: 7513,
        mode: 'network',
        cpuLevel: null
      }
    ],
    cpu: [
      {
        rank: 1,
        playerId: 'player_beta_0002',
        playerName: 'ざわた',
        bestScore: 9131,
        mode: 'cpu',
        cpuLevel: 1
      },
      {
        rank: 2,
        playerId: 'player_gamma_0003',
        playerName: 'すわわわん',
        bestScore: 9013,
        mode: 'cpu',
        cpuLevel: 1
      },
      {
        rank: 3,
        playerId: 'player_delta_0004',
        playerName: 'swqp',
        bestScore: 9013,
        mode: 'cpu',
        cpuLevel: 1
      },
      {
        rank: 4,
        playerId: 'player_epsilon_0005',
        playerName: 'なれ。',
        bestScore: 8212,
        mode: 'cpu',
        cpuLevel: 1
      }
    ],
    cpuLv6: [
      {
        rank: 1,
        playerId: 'player_theta_0008',
        playerName: '観測者',
        bestScore: 9300,
        mode: 'cpu',
        cpuLevel: 6
      },
      {
        rank: 2,
        playerId: 'player_iota_0009',
        playerName: '分岐',
        bestScore: 8800,
        mode: 'cpu',
        cpuLevel: 6
      }
    ],
    timeAttackCpu: [
      {
        rank: 1,
        playerId: 'player_time_0001',
        playerName: '速太',
        bestTimeMs: 182340,
        mode: 'cpu',
        cpuLevel: 1,
        category: 'timeAttack'
      },
      {
        rank: 2,
        playerId: 'player_time_0002',
        playerName: '疾風',
        bestTimeMs: 205000,
        mode: 'cpu',
        cpuLevel: 1,
        category: 'timeAttack'
      }
    ],
    timeDefenseCpu: [
      {
        rank: 1,
        playerId: 'player_defense_0001',
        playerName: '粘太',
        turnCount: 58,
        mode: 'cpu',
        cpuLevel: 1,
        category: 'timeDefense'
      },
      {
        rank: 2,
        playerId: 'player_defense_0002',
        playerName: '長考',
        turnCount: 51,
        mode: 'cpu',
        cpuLevel: 1,
        category: 'timeDefense'
      }
    ]
  };

  function buildUiRefs() {
    return {
      modeCpuBtn: document.getElementById('modeCpuBtn'),
      modeNetworkBtn: document.getElementById('modeNetworkBtn'),
      controlPanel: document.getElementById('control-panel'),
      networkPanel: document.getElementById('networkPanel'),
      networkOverlay: document.getElementById('networkOverlay'),
      networkCloseBtn: document.getElementById('networkCloseBtn'),
      networkStatus: document.getElementById('networkStatusText'),
      networkTimerStatus: document.getElementById('networkTimerStatus'),
      leaderboardOpenBtn: document.getElementById('leaderboardOpenBtn'),
      leaderboardOverlay: document.getElementById('leaderboardOverlay'),
      leaderboardPanel: document.getElementById('leaderboardModal'),
      leaderboardCloseBtn: document.getElementById('leaderboardCloseBtn'),
      leaderboardNameInput: document.getElementById('leaderboardNameInput'),
      leaderboardReloadBtn: document.getElementById('leaderboardReloadBtn'),
      leaderboardStatus: document.getElementById('leaderboardStatusText'),
      leaderboardList: document.getElementById('leaderboardList'),
      autoToggleBtn: document.getElementById('autoToggleBtn')
    };
  }

  beforeEach(() => {
    jest.resetModules();

    dom = new JSDOM(
      '<!doctype html><html><body>' +
      '<button id="modeCpuBtn">CPU</button>' +
      '<button id="modeNetworkBtn">ネット対戦</button>' +
      '<button id="leaderboardOpenBtn">ランキング</button>' +
      '<button id="autoToggleBtn">AUTO: OFF</button>' +
      '<div id="control-panel"></div>' +
      '<div id="networkPanel"></div>' +
      '<div id="networkOverlay"></div>' +
      '<button id="networkCloseBtn">閉じる</button>' +
      '<div id="networkStatusText"></div>' +
      '<div id="networkTimerStatus"></div>' +
      '<div id="leaderboardOverlay">' +
      '  <div id="leaderboardModal">' +
      '    <div id="leaderboardModalHeader">' +
      '      <div class="leaderboard-title">スコアランキング</div>' +
      '      <button id="leaderboardCloseBtn">閉じる</button>' +
      '    </div>' +
      '    <div id="leaderboardModalBody">' +
      '      <div id="leaderboardNameRow">' +
      '        <label for="leaderboardNameInput">名前</label>' +
      '        <input id="leaderboardNameInput" />' +
      '        <button id="leaderboardReloadBtn">更新</button>' +
      '      </div>' +
      '      <div id="leaderboardStatusText"></div>' +
      '      <div id="leaderboardList"></div>' +
      '    </div>' +
      '  </div>' +
      '</div>' +
      '</body></html>',
      { url: 'http://localhost/' }
    );

    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;
    global.addLog = jest.fn();
    global.updateCpuCharacter = jest.fn();

    window.NetworkMatchClient = {
      leaveRoom: jest.fn(async () => ({ ok: true })),
      setStatusWriter: jest.fn(),
      setRoomStateListener: jest.fn(),
      setTurnTimerListener: jest.fn(),
      setChatListener: jest.fn(),
      hasTwoPlayers: jest.fn(() => false),
      getSeatNames: jest.fn(() => ({ black: '', white: '' })),
      getSeatKey: jest.fn(() => 'black')
    };

    fetchLeaderboard = jest.fn(async (options) => ({
      ok: true,
      updatedAt: new Date('2026-06-20T06:40:00+09:00').getTime(),
      entries: options && options.category === 'timeAttack'
        ? leaderboardEntriesByMode.timeAttackCpu
        : options && options.category === 'timeDefense'
        ? leaderboardEntriesByMode.timeDefenseCpu
        : options && options.mode === 'cpu' && options.cpuLevel === 6
        ? leaderboardEntriesByMode.cpuLv6
        : leaderboardEntriesByMode[(options && options.mode) || 'all'] || leaderboardEntriesByMode.all,
      requestedLimit: options && options.limit,
      requestedMode: options && options.mode,
      requestedCategory: options && options.category
    }));

    window.LeaderboardClient = {
      getPlayerName: jest.fn(() => 'ななし'),
      setPlayerName: jest.fn((value) => value),
      getPlayerId: jest.fn(() => 'player_alpha_0001'),
      fetchLeaderboard
    };

    require('../ui/handlers/match-mode.js');
    window.setupMatchModeControls(buildUiRefs());
  });

  afterEach(() => {
    try {
      if (dom && dom.window && typeof dom.window.close === 'function') {
        dom.window.close();
      }
    } catch (e) {
      // ignore
    }

    delete global.window;
    delete global.document;
    delete global.location;
    delete global.addLog;
    delete global.updateCpuCharacter;
    delete global.LeaderboardClient;
    delete global.loadLazyRuntimeGroup;
  });

  test('初期化時に速攻開始フックをturn-managerへ同期する', () => {
    const turnManager = require('../game/turn-manager.js');
    expect(turnManager.getUIImpl()).toEqual(expect.objectContaining({
      onTimeAttackFirstMove: expect.any(Function)
    }));
  });

  test('ランキングパネルを開くと上位100件を取得する', async () => {
    document.getElementById('leaderboardOpenBtn').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchLeaderboard).toHaveBeenCalledWith(expect.objectContaining({ limit: 100, mode: 'all', category: 'score' }));
    expect(document.getElementById('leaderboardOverlay').classList.contains('is-open')).toBe(true);
    expect(document.getElementById('leaderboardList').textContent).toContain('なれ。');
    expect(document.getElementById('leaderboardList').textContent).toContain('アルファ');
  });

  test('ランキングクライアント未読込なら初回オープンでoptional runtimeを読む', async () => {
    delete window.LeaderboardClient;
    delete global.LeaderboardClient;
    expect(window.LeaderboardClient).toBeUndefined();
    expect(global.LeaderboardClient).toBeUndefined();
    const lazyClient = {
      getPlayerName: jest.fn(() => 'ななし'),
      setPlayerName: jest.fn((value) => value),
      getPlayerId: jest.fn(() => 'player_alpha_0001'),
      fetchLeaderboard
    };
    window.loadLazyRuntimeGroup = jest.fn(async (group) => {
      expect(group).toBe('leaderboard');
      window.LeaderboardClient = lazyClient;
      return true;
    });

    document.getElementById('leaderboardOpenBtn').click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setImmediate(resolve));

    expect(document.getElementById('leaderboardOverlay').classList.contains('is-open')).toBe(true);
    expect(window.loadLazyRuntimeGroup).toHaveBeenCalledTimes(1);
    expect(fetchLeaderboard).toHaveBeenCalledWith(expect.objectContaining({ limit: 100, mode: 'all', category: 'score' }));
    expect(document.getElementById('leaderboardStatusText').textContent).not.toBe('ランキング機能を利用できません');
  });

  test('ランキングパネルは10位以降の返却行も描画する', async () => {
    const manyEntries = Array.from({ length: 14 }, (_item, index) => ({
      rank: index + 1,
      playerId: `player_many_${String(index + 1).padStart(4, '0')}`,
      playerName: `記録${index + 1}`,
      bestScore: 9000 - index,
      mode: 'cpu',
      cpuLevel: 1
    }));
    fetchLeaderboard.mockImplementationOnce(async (options) => ({
      ok: true,
      updatedAt: new Date('2026-06-20T06:40:00+09:00').getTime(),
      entries: manyEntries,
      requestedLimit: options && options.limit,
      requestedMode: options && options.mode,
      requestedCategory: options && options.category
    }));

    document.getElementById('leaderboardOpenBtn').click();
    await Promise.resolve();
    await Promise.resolve();

    const rows = Array.from(document.querySelectorAll('.leaderboard-row'));
    expect(fetchLeaderboard).toHaveBeenCalledWith(expect.objectContaining({ limit: 100, mode: 'all', category: 'score' }));
    expect(rows).toHaveLength(14);
    expect(document.getElementById('leaderboardList').textContent).toContain('記録14');
  });

  test('ランキングパネルを開くと2種別タブとMODEボタンを組み立てる', async () => {
    document.getElementById('leaderboardOpenBtn').click();
    await Promise.resolve();
    await Promise.resolve();

    const stylesheet = document.querySelector('link[href="styles-leaderboard.css"]');
    const podium = document.getElementById('leaderboardPodium');
    const summary = document.getElementById('leaderboardSummary');
    const tabs = document.getElementById('leaderboardFilterTabs');
    const modeBtn = document.getElementById('leaderboardModeBtn');
    const infoBtn = document.getElementById('leaderboardInfoBtn');
    const list = document.getElementById('leaderboardList');

    expect(stylesheet).toBeTruthy();
    expect(document.querySelector('.leaderboard-title-main')?.textContent).toBe('ランキング');
    expect(summary?.textContent).toContain('8543');
    expect(summary?.textContent).toContain('#4');
    expect(summary?.textContent).toContain('06:40');
    expect(Array.from(tabs?.querySelectorAll('button') || []).map((button) => button.textContent)).toEqual(['スコアランキング', 'タイムアタック', 'タイムディフェンス']);
    expect(document.getElementById('leaderboardCategoryScore')?.getAttribute('aria-pressed')).toBe('true');
    expect(modeBtn?.textContent).toBe('MODE');
    expect(modeBtn?.getAttribute('aria-label')).toBe('表示モード: 総合');
    expect(infoBtn?.textContent).toBe('ⓘ');
    expect(infoBtn?.getAttribute('aria-label')).toBe('ランキング説明');
    expect(document.getElementById('leaderboardDetailBtn')).toBeNull();
    expect(podium?.textContent).toContain('ざわた');
    expect(podium?.textContent).toContain('すわわわん');
    expect(podium?.textContent).toContain('swqp');
    expect(list?.textContent).toContain('なれ。');
    expect(list?.textContent).toContain('アルファ');
  });

  test('MODEボタンで対人へ切り替えると対人記録だけを表示して全Lvを隠す', async () => {
    document.getElementById('leaderboardOpenBtn').click();
    await Promise.resolve();
    await Promise.resolve();

    const modeBtn = document.getElementById('leaderboardModeBtn');
    modeBtn.click();
    await Promise.resolve();
    const networkOption = document.getElementById('leaderboardModeOptionNetwork');
    networkOption.click();
    await Promise.resolve();
    await Promise.resolve();

    const list = document.getElementById('leaderboardList');
    const summary = document.getElementById('leaderboardSummary');
    const levelControl = document.getElementById('leaderboardCpuLevelControl');

    expect(modeBtn.getAttribute('aria-expanded')).toBe('false');
    expect(modeBtn.textContent).toBe('MODE');
    expect(modeBtn.getAttribute('aria-label')).toBe('表示モード: 対人');
    expect(fetchLeaderboard).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 100, mode: 'network', category: 'score' }));
    expect(list?.textContent).not.toContain('なれ。');
    expect(list?.textContent).toContain('Rin');
    expect(list?.textContent).toContain('アルファ');
    expect(summary?.textContent).toContain('8543');
    expect(levelControl?.classList.contains('is-visible')).toBe(false);
  });

  test('CPUタブではレベルボタンからレベル別ランキングに切り替えられる', async () => {
    document.getElementById('leaderboardOpenBtn').click();
    await Promise.resolve();
    await Promise.resolve();

    const levelBtn = document.getElementById('leaderboardCpuLevelBtn');
    expect(levelBtn).toBeTruthy();
    expect(levelBtn?.textContent).toContain('全Lv');

    const modeBtn = document.getElementById('leaderboardModeBtn');
    modeBtn.click();
    await Promise.resolve();
    const cpuOption = document.getElementById('leaderboardModeOptionCpu');
    cpuOption.click();
    await Promise.resolve();
    await Promise.resolve();

    levelBtn.click();
    await Promise.resolve();

    const lv6Option = document.getElementById('leaderboardCpuLevelOption6');
    expect(lv6Option).toBeTruthy();
    lv6Option.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchLeaderboard).toHaveBeenLastCalledWith(expect.objectContaining({
      limit: 100,
      mode: 'cpu',
      cpuLevel: 6,
      category: 'score'
    }));
    expect(levelBtn?.textContent).toContain('Lv6');
    expect(document.getElementById('leaderboardPodium').textContent).toContain('分岐');
  });

  test('タイムアタックタブではタイム列と短時間記録を表示する', async () => {
    document.getElementById('leaderboardOpenBtn').click();
    await Promise.resolve();
    await Promise.resolve();

    const timeTab = document.getElementById('leaderboardCategoryTimeAttack');
    timeTab.click();
    await Promise.resolve();
    await Promise.resolve();

    const podium = document.getElementById('leaderboardPodium');
    const header = document.getElementById('leaderboardTableHeader');

    expect(timeTab.getAttribute('aria-pressed')).toBe('true');
    expect(fetchLeaderboard).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 100, mode: 'all', category: 'timeAttack' }));
    expect(header?.textContent).toContain('タイム');
    expect(header?.textContent).not.toContain('スコア');
    expect(podium?.textContent).toContain('速太');
    expect(podium?.textContent).toContain('03:02.34');
  });

  test('タイムディフェンスタブでは手数列と長手数記録を表示する', async () => {
    document.getElementById('leaderboardOpenBtn').click();
    await Promise.resolve();
    await Promise.resolve();

    const defenseTab = document.getElementById('leaderboardCategoryTimeDefense');
    defenseTab.click();
    await Promise.resolve();
    await Promise.resolve();

    const podium = document.getElementById('leaderboardPodium');
    const header = document.getElementById('leaderboardTableHeader');
    const summary = document.getElementById('leaderboardSummary');

    expect(defenseTab.getAttribute('aria-pressed')).toBe('true');
    expect(fetchLeaderboard).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 100, mode: 'all', category: 'timeDefense' }));
    expect(header?.textContent).toContain('手数');
    expect(header?.textContent).not.toContain('タイム');
    expect(header?.textContent).not.toContain('スコア');
    expect(podium?.textContent).toContain('粘太');
    expect(podium?.textContent).toContain('58手');
    expect(summary?.textContent).toContain('あなたの最長記録');
  });

  test('ⓘボタンでランキング説明パネルを開く', async () => {
    document.getElementById('leaderboardOpenBtn').click();
    await Promise.resolve();
    await Promise.resolve();

    const infoBtn = document.getElementById('leaderboardInfoBtn');
    const panel = document.getElementById('leaderboardDetailsPanel');
    expect(infoBtn).toBeTruthy();
    expect(panel?.textContent).toContain('スコアランキング');
    expect(document.getElementById('leaderboardModal').classList.contains('is-detail-open')).toBe(false);

    infoBtn.click();

    expect(infoBtn.getAttribute('aria-pressed')).toBe('true');
    expect(document.getElementById('leaderboardModal').classList.contains('is-detail-open')).toBe(true);
    expect(panel?.textContent).toContain('15:00超過');
  });
});
