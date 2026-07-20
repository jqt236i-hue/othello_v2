import * as fs from 'fs';
import * as path from 'path';
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
        avatarStoneType: 'LIGHTNING',
        bio: '首位を狙っています',
        bestScore: 9131,
        mode: 'cpu',
        cpuLevel: 1
      },
      {
        rank: 2,
        playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0002',
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
        avatarStoneType: 'GHOST',
        bio: '盤面を観測中です',
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
        playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0002',
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
    ],
    shortestTurnsCpu: [
      {
        rank: 1,
        playerId: 'player_short_0001',
        playerName: '速手',
        turnCount: 37,
        mode: 'cpu',
        cpuLevel: 1,
        category: 'shortestTurns'
      },
      {
        rank: 2,
        playerId: 'player_short_0002',
        playerName: '短勝',
        turnCount: 40,
        mode: 'cpu',
        cpuLevel: 1,
        category: 'shortestTurns'
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
        : options && options.category === 'shortestTurns'
        ? leaderboardEntriesByMode.shortestTurnsCpu
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

    const matchMode = require('../ui/handlers/match-mode.ts');
    window.setupMatchModeControls = matchMode.setupMatchModeControls;
    window.MatchMode = matchMode;
    window.setupMatchModeControls(buildUiRefs());
    expect(document.querySelectorAll('link[data-card-reversi-feature-style="leaderboard"]')).toHaveLength(0);
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

  test('ランキングパネルを開くと5種別タブとMODEボタンを組み立てる', async () => {
    document.getElementById('leaderboardOpenBtn').click();
    await Promise.resolve();
    await Promise.resolve();

    const stylesheet = document.querySelector('link[data-card-reversi-feature-style="leaderboard"]');
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
    expect(Array.from(tabs?.querySelectorAll('button') || []).map((button) => button.textContent)).toEqual(['スコアランキング', 'レートランキング', 'タイムアタック', '最長手数', '最短手数']);
    expect(document.getElementById('leaderboardCategoryScore')?.getAttribute('aria-pressed')).toBe('true');
    expect(document.getElementById('leaderboardCategoryTimeDefense')?.classList.contains('is-compact')).toBe(true);
    expect(document.getElementById('leaderboardCategoryShortestTurns')?.classList.contains('is-compact')).toBe(true);
    expect(modeBtn?.textContent).toBe('MODE');
    expect(modeBtn?.getAttribute('aria-label')).toBe('表示モード: 総合');
    expect(infoBtn?.textContent).toBe('ⓘ');
    expect(infoBtn?.getAttribute('aria-label')).toBe('ランキング説明');
    expect(document.getElementById('leaderboardDetailBtn')).toBeNull();
    expect(podium?.textContent).toContain('ざわた');
    expect(podium?.textContent).toContain('すわわわん');
    expect(podium?.textContent).toContain('swqp');
    expect(podium?.textContent).toContain('#0002');
    expect(list?.textContent).toContain('なれ。');
    expect(list?.textContent).toContain('アルファ');
    expect(list?.textContent).toContain('#0001');
    const idSuffix = list?.querySelector('.leaderboard-name-id');
    expect(idSuffix?.getAttribute('title')).toContain('player_');
    expect(podium?.querySelector('.leaderboard-name-id')?.getAttribute('title')).toContain('p_ABCDEFGHIJKLMNOPQRSTUV0002');
  });

  test('ランキングのプレイヤーを押すとプロフィールを表示し、上位3名には透過アイコン背景を置く', async () => {
    document.getElementById('leaderboardOpenBtn').click();
    await Promise.resolve();
    await Promise.resolve();

    const podiumBg = document.querySelector('.leaderboard-podium-card.is-rank-1 .leaderboard-podium-avatar-bg') as HTMLElement | null;
    expect(podiumBg).toBeTruthy();
    expect(podiumBg?.style.backgroundImage).toContain('rakurai');

    const alphaRow = Array.from(document.querySelectorAll('.leaderboard-row'))
      .find((row) => row.textContent?.includes('アルファ')) as HTMLElement | undefined;
    expect(alphaRow).toBeTruthy();
    expect(alphaRow?.getAttribute('role')).toBe('button');

    alphaRow?.click();

    const overlay = document.getElementById('leaderboardProfileOverlay');
    expect(overlay?.classList.contains('is-open')).toBe(true);
    expect(overlay?.getAttribute('aria-hidden')).toBe('false');
    expect(overlay?.querySelector('.leaderboard-profile-name')?.textContent).toBe('アルファ');
    expect(overlay?.querySelector('.leaderboard-profile-id')?.textContent).toContain('player_alpha_0001');
    expect(overlay?.querySelector('.leaderboard-profile-bio')?.textContent).toBe('盤面を観測中です');
    expect((overlay?.querySelector('.leaderboard-profile-avatar-img') as HTMLImageElement | null)?.src).toContain('GHOST');

    (overlay?.querySelector('.leaderboard-profile-close') as HTMLElement | null)?.click();
    expect(overlay?.classList.contains('is-open')).toBe(false);
    expect(overlay?.getAttribute('aria-hidden')).toBe('true');
  });

  test('ランキング種別タブは通常幅と半幅タブで2段に収めるCSSにする', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '..', 'styles-leaderboard.css'), 'utf8');
    const filterTabColumns = Array.from(
      css.matchAll(
        /#leaderboardFilterTabs\s*\{[^}]*grid-template-columns:\s*repeat\((\d+),\s*minmax\(0,\s*1fr\)\);/g
      )
    ).map((match) => match[1]);

    expect(filterTabColumns.length).toBeGreaterThan(0);
    expect(filterTabColumns).toEqual(filterTabColumns.map(() => '4'));
    expect(css).toMatch(/\.leaderboard-filter-tab\s*\{[\s\S]*grid-column:\s*span\s+2/);
    expect(css).toMatch(/\.leaderboard-filter-tab\.is-compact\s*\{[\s\S]*grid-column:\s*span\s+1/);
  });

  test('ランキング種別タブ直下の入力行は大きく空けない', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '..', 'styles-leaderboard.css'), 'utf8');
    const nameRowMargins = Array.from(
      css.matchAll(/#leaderboardNameRow\s*\{[^}]*margin-top:\s*calc\((\d+)px\s*\*/g)
    ).map((match) => Number(match[1]));

    expect(nameRowMargins.length).toBeGreaterThan(0);
    expect(Math.max(...nameRowMargins)).toBeLessThanOrEqual(28);
  });

  test('ランキング一覧は最下行が下部フレームに隠れないスクロール余白を持つ', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '..', 'styles-leaderboard.css'), 'utf8');

    expect(css).toMatch(/#leaderboardListViewport\s*\{[\s\S]*padding:\s*0\s+calc\(8px\s*\*\s*var\(--layout-stage-scale\)\)\s+calc\(46px\s*\*\s*var\(--layout-stage-scale\)\)/);
    expect(css).toMatch(/#leaderboardListViewport\s*\{[\s\S]*scroll-padding-bottom:\s*calc\(46px\s*\*\s*var\(--layout-stage-scale\)\)/);
  });

  test('ポディウムの名前ラベルは本文だけを中央固定し player id は右側へ逃がす', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '..', 'styles-leaderboard.css'), 'utf8');
    const podiumNameRules = Array.from(css.matchAll(/\.leaderboard-podium-name\s*\{([^}]*)\}/g), (match) => match[1]);
    const podiumNameTextRules = Array.from(css.matchAll(/\.leaderboard-podium-name\s+\.leaderboard-name-text\s*\{([^}]*)\}/g), (match) => match[1]);
    const podiumNameIdRules = Array.from(css.matchAll(/\.leaderboard-podium-name\s+\.leaderboard-name-id\s*\{([^}]*)\}/g), (match) => match[1]);

    expect(podiumNameRules.length).toBeGreaterThan(0);
    expect(podiumNameTextRules.length).toBeGreaterThan(0);
    expect(podiumNameIdRules.length).toBeGreaterThan(0);
    expect(
      podiumNameRules.some(
        (rule) => /display:\s*grid;/.test(rule) && /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+minmax\(0,\s*1fr\);/.test(rule)
      )
    ).toBe(true);
    expect(podiumNameTextRules.some((rule) => /grid-column:\s*2;/.test(rule))).toBe(true);
    expect(
      podiumNameIdRules.some(
        (rule) => /grid-column:\s*3;/.test(rule) && /justify-self:\s*start;/.test(rule)
      )
    ).toBe(true);
  });

  test('ポディウムのプロフィール背景アイコンは少し下げて配置する', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '..', 'styles-leaderboard.css'), 'utf8');
    const podiumAvatarRules = Array.from(
      css.matchAll(/\.leaderboard-podium-avatar-bg\s*\{([^}]*)\}/g),
      (match) => match[1]
    );

    expect(podiumAvatarRules.length).toBeGreaterThan(0);
    expect(
      podiumAvatarRules.some(
        (rule) => /top:\s*53%;/.test(rule) && /transform:\s*translate\(-50%,\s*-50%\);/.test(rule)
      )
    ).toBe(true);
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

  test('最長手数タブでは手数列と長手数記録を表示する', async () => {
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

  test('最短手数タブでは手数列と短手数記録を表示する', async () => {
    document.getElementById('leaderboardOpenBtn').click();
    await Promise.resolve();
    await Promise.resolve();

    const shortestTab = document.getElementById('leaderboardCategoryShortestTurns');
    shortestTab.click();
    await Promise.resolve();
    await Promise.resolve();

    const podium = document.getElementById('leaderboardPodium');
    const header = document.getElementById('leaderboardTableHeader');
    const summary = document.getElementById('leaderboardSummary');

    expect(shortestTab.getAttribute('aria-pressed')).toBe('true');
    expect(fetchLeaderboard).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 100, mode: 'all', category: 'shortestTurns' }));
    expect(header?.textContent).toContain('手数');
    expect(header?.textContent).not.toContain('タイム');
    expect(header?.textContent).not.toContain('スコア');
    expect(podium?.textContent).toContain('速手');
    expect(podium?.textContent).toContain('37手');
    expect(summary?.textContent).toContain('あなたの最短記録');
  });

  test('ⓘボタンでランキング説明パネルを開く', async () => {
    document.getElementById('leaderboardOpenBtn').click();
    await Promise.resolve();
    await Promise.resolve();

    const infoBtn = document.getElementById('leaderboardInfoBtn');
    const panel = document.getElementById('leaderboardDetailsPanel');
    expect(infoBtn).toBeTruthy();
    expect(panel?.textContent).toContain('スコアランキング');
    expect(panel?.textContent).toContain('最短手数');
    expect(document.getElementById('leaderboardModal').classList.contains('is-detail-open')).toBe(false);

    infoBtn.click();

    expect(infoBtn.getAttribute('aria-pressed')).toBe('true');
    expect(document.getElementById('leaderboardModal').classList.contains('is-detail-open')).toBe(true);
    expect(panel?.textContent).toContain('15:00超過');
  });
});
